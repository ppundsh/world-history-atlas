// Land mask and sea routing for submarine cables.
// The land is Natural Earth 1:50m (public/data/base50.json, the same land the site draws), rasterised once to a
// bitmap of RES degrees. Lines are tested along great circles, as the map draws them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { geoInterpolate, geoDistance } from 'd3-geo';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RES = 0.02, W = Math.round(360 / RES), H = Math.round(180 / RES);
const bits = new Uint8Array(Math.ceil(W * H / 8));
{
  const topo = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'base50.json'), 'utf8'));
  const land = feature(topo, topo.objects.ne_50m_land);
  const rows = Array.from({ length: H }, () => []);          // edges by raster row
  const ring = r => { for (let i = 0; i < r.length - 1; i++) {
    const [x0, y0] = r[i], [x1, y1] = r[i + 1]; if (y0 === y1) continue;
    const a = Math.max(0, Math.ceil((90 - Math.max(y0, y1)) / RES - 0.5)), b = Math.min(H - 1, Math.floor((90 - Math.min(y0, y1)) / RES - 0.5));
    for (let j = a; j <= b; j++) rows[j].push([x0, y0, x1, y1]);
  } };
  for (const f of land.features) {
    const g = f.geometry; if (!g) continue;
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) for (const r of poly) ring(r);
  }
  for (let j = 0; j < H; j++) {
    const y = 90 - (j + 0.5) * RES, xs = [];
    for (const [x0, y0, x1, y1] of rows[j]) if ((y0 > y) !== (y1 > y)) xs.push(x0 + (y - y0) / (y1 - y0) * (x1 - x0));
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil((xs[k] + 180) / RES - 0.5)), b = Math.min(W - 1, Math.floor((xs[k + 1] + 180) / RES - 0.5));
      for (let i = a; i <= b; i++) { const n = j * W + i; bits[n >> 3] |= 1 << (n & 7); }
    }
  }
}
const wrap = x => ((x + 180) % 360 + 360) % 360 - 180;
export function onLand(lon, lat) {
  const i = Math.min(W - 1, Math.max(0, Math.floor((wrap(lon) + 180) / RES))), j = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) / RES)));
  const n = j * W + i; return (bits[n >> 3] >> (n & 7)) & 1;
}
const deg = r => r * 180 / Math.PI;
// land, or land within r degrees (eight points around); keeps cables off the beaches
export function nearLand(lon, lat, r) {
  if (onLand(lon, lat)) return 1;
  if (!r) return 0;
  const k = r / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [0.7, -0.7], [-0.7, 0.7], [-0.7, -0.7]]) if (onLand(lon + dx * k, lat + dy * r)) return 1;
  return 0;
}
export const distDeg = (a, b) => deg(geoDistance(a, b));

// points of the great circle a→b every ~0.01°, leaving out those within `skip` degrees of the given ends
export function landHits(a, b, skip = [], buf = 0) {
  const d = distDeg(a, b), n = Math.max(2, Math.ceil(d / 0.01)), f = geoInterpolate(a, b), out = [];
  for (let i = 1; i < n; i++) {
    const p = f(i / n);
    if (skip.some(s => distDeg(p, s) < s[2])) continue;
    if (nearLand(p[0], p[1], buf)) out.push(p);
  }
  return out;
}

export function crosses(a, b, skip = [], buf = 0) {
  const d = distDeg(a, b), n = Math.max(2, Math.ceil(d / 0.01)), f = geoInterpolate(a, b);
  for (let i = 1; i < n; i++) {
    const p = f(i / n);
    let b = buf;
    for (const s of skip) if (Math.abs(p[1] - s[1]) < s[2] + 0.5) { const d = distDeg(p, s); if (d < s[2]) { b = -1; break; } if (d < s[2] + 0.4) b = 0; }
    if (b < 0) continue;                         // ashore at a landing station
    if (nearLand(p[0], p[1], b)) return true;     // no clearance asked for near a landing (harbours, inlets)
  }
  return false;
}
// Douglas–Peucker that also keeps any segment from crossing land (segments near `skip` points excepted)
export function simplify(line, tol, skip = [], keep = new Set(), buf = 0) {
  if (line.length < 3) return line;
  const flag = new Uint8Array(line.length); flag[0] = flag[line.length - 1] = 1;
  for (const k of keep) flag[k] = 1;
  const stack = [];
  for (let i = 0, last = 0; i < line.length; i++) if (flag[i] && i > last) { stack.push([last, i]); last = i; }
  while (stack.length) {
    const [s, e] = stack.pop(); if (e - s < 2) continue;
    const A = line[s], B = line[e];
    let best = -1, bd = -1;
    for (let i = s + 1; i < e; i++) { const dd = segDist(line[i], A, B); if (dd > bd) { bd = dd; best = i; } }
    if (bd > tol || crosses(A, B, skip, buf)) { flag[best] = 1; stack.push([s, best], [best, e]); }
  }
  return line.filter((_, i) => flag[i]);
}
// pull a routed line taut: from each kept point go straight to the farthest later point that is still clear of land
export function taut(line, skip = [], buf = 0) {
  const out = [line[0]]; let i = 0;
  const ok = j => !crosses(line[i], line[j], skip, buf);
  while (i < line.length - 1) {
    let j = line.length - 1;
    if (!ok(j)) {                                 // gallop out from i, then bisect: the farthest point still in sight
      let lo = i + 1, step = 1;
      while (lo + step < line.length - 1 && ok(lo + step)) { lo += step; step *= 2; }
      let hi = Math.min(line.length - 1, lo + step);
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ok(m)) lo = m; else hi = m; }
      j = lo;
    }
    out.push(line[j]); i = j;
  }
  return out;
}
function segDist(p, a, b) {               // planar, with longitude scaled by cos(lat)
  const k = Math.cos((a[1] + b[1]) / 2 * Math.PI / 180);
  const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1];
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// Shortest way by sea from a to b on a grid of `step` degrees (A*, 8 neighbours); a and b themselves may be on
// land (landing stations): cells within `near` degrees of either end count as sea. Longitudes may run past ±180.
// how far a landing station is from open water (a station up a narrow inlet the 1:50m coast closes off)
export function shoreGap(p) {
  for (const r of [0.15, 0.25, 0.4, 0.6, 0.9]) for (let k = 0; k < 32; k++) {
    const t = k / 32 * 2 * Math.PI;
    for (const f of [0.5, 1]) if (!onLand(p[0] + Math.cos(t) * r * f / Math.cos(p[1] * Math.PI / 180), p[1] + Math.sin(t) * r * f)) return r;
  }
  throw new Error(`no sea within 0.9° of ${p}`);
}
export function seaRoute(a, b, step = 0.05) {
  const na = shoreGap(a), nb = shoreGap(b);
  const tries = [[0.1, 1], [0.04, 1], [0, 1], [0, 2], [0, 3]];      // land buffer, × how far the stations may be from open water
  for (const [buf, f] of tries) { try { return { line: seaRouteBuf(a, b, step, na * f, nb * f, buf), buf, na: na * f, nb: nb * f }; } catch (e) { if (f === 3) throw e; } }
}
function seaRouteBuf(a, b, step, na, nb, buf) {
  let bx = b[0]; if (bx - a[0] > 180) bx -= 360; else if (a[0] - bx > 180) bx += 360;
  const B = [bx, b[1]];
  const key = (i, j) => (i + 20000) * 20000 + (j + 5000);
  const ci = x => Math.round(x / step), pt = (i, j) => [i * step, j * step];
  const s = [ci(a[0]), ci(a[1])], g = [ci(B[0]), ci(B[1])];
  const sea = (i, j) => { const p = pt(i, j); if (Math.abs(p[1]) > 85) return false;
    const da = Math.hypot(p[0] - a[0], p[1] - a[1]), db = Math.hypot(p[0] - B[0], p[1] - B[1]);
    if (da < na || db < nb) return true;
    return !nearLand(p[0], p[1], da < na + 0.4 || db < nb + 0.4 ? 0 : buf); };
  const edgeSea = (i, j, ni, nj) => { const p = pt(i, j), q = pt(ni, nj);
    for (const f of [0.25, 0.5, 0.75]) { const x = p[0] + (q[0] - p[0]) * f, y = p[1] + (q[1] - p[1]) * f;
      if (Math.hypot(x - a[0], y - a[1]) < na || Math.hypot(x - B[0], y - B[1]) < nb) continue;
      if (onLand(x, y)) return false; }
    return true; };
  const h = (i, j) => { const p = pt(i, j); return Math.hypot((p[0] - B[0]) * Math.cos(p[1] * Math.PI / 180), p[1] - B[1]); };
  const open = new Heap(), gs = new Map(), from = new Map(), closed = new Set();
  gs.set(key(...s), 0); open.push([h(...s), s[0], s[1]]);
  let n = 0; const budget = 1e5 + 8 * (Math.hypot(B[0] - a[0], B[1] - a[1]) / step) ** 2;
  while (open.size) {
    const [, i, j] = open.pop();
    if (i === g[0] && j === g[1]) break;
    const k0 = key(i, j); if (closed.has(k0)) continue; closed.add(k0);
    if (++n > budget) throw new Error(`seaRoute: no way by sea from ${a} to ${b}`);
    const g0 = gs.get(key(i, j)), c = Math.cos(j * step * Math.PI / 180);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj; if (!sea(ni, nj)) continue;
      if (!edgeSea(i, j, ni, nj)) continue;     // the move itself must stay off land (narrow passages)
      const ng = g0 + step * Math.hypot(di * c, dj), k = key(ni, nj);
      if (ng < (gs.get(k) ?? Infinity)) { gs.set(k, ng); from.set(k, key(i, j)); open.push([ng + h(ni, nj), ni, nj]); }
    }
  }
  const out = []; let k = key(...g);
  if (!from.has(k)) throw new Error(`seaRoute: no way by sea from ${a} to ${b}`);
  while (k !== key(...s)) { const I = Math.floor(k / 20000), i = I - 20000, j = k - I * 20000 - 5000; out.push(pt(i, j)); k = from.get(k); }
  out.reverse(); out[out.length - 1] = B;
  return [a, ...out.slice(0, -1), B];
}
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
}
