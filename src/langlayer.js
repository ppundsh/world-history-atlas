// Drawing for the "development of languages" mode, shared by the flat map and the globe:
// language areas (tinted ellipses) and migrations (great-circle arrows that grow while they happen).
import { geoInterpolate, geoDistance } from 'd3-geo';

// the part of a path from its start to fraction t of its length: its own points, then the moving tip. A drawn
// LineString is resampled along great circles by d3 anyway, so the points need not be densified here (that used
// to cost hundreds of thousands of interpolations a frame with detailed cable routes)
const LENS = new WeakMap();
function lensOf(path) {
  let c = LENS.get(path);
  if (!c) { c = [0]; for (let i = 1; i < path.length; i++) c.push(c[i - 1] + geoDistance(path[i - 1], path[i])); LENS.set(path, c); }
  return c;
}
function upTo(path, t) {
  if (t >= 1) return path;
  const c = lensOf(path), d = Math.max(0, t) * c[c.length - 1];
  let i = 1; while (i < path.length - 1 && c[i] < d) i++;
  const seg = c[i] - c[i - 1], tip = seg ? geoInterpolate(path[i - 1], path[i])(Math.min(1, (d - c[i - 1]) / seg)) : path[i];
  return path.slice(0, i).concat([tip]);
}
// for hit testing: long legs get a few intermediate points so the screen line follows the drawn great circle
function denseForHits(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const d = geoDistance(pts[i - 1], pts[i]) * 57.3;
    if (d > 3) { const f = geoInterpolate(pts[i - 1], pts[i]), n = Math.ceil(d / 3); for (let k = 1; k < n; k++) out.push(f(k / n)); }
    out.push(pts[i]);
  }
  return out;
}

// a hit-test entry whose screen line is only worked out when the mouse asks (projecting every line on every frame
// cost more than drawing it)
function lazyHit(h, project, coords) {
  let pts = null;
  Object.defineProperty(h, 'pts', { get: () => (pts ||= screenLine(project, denseForHits(coords))), enumerable: true });
  return h;
}

// screen polylines of what was drawn, for clicking a cable or a work: [{ kind, id, label, pts: [[x, y] …] }]
function screenLine(project, coords) {
  const out = [];
  for (const c of coords) { const q = project(c); out.push(q ? [q[0], q[1]] : null); }
  return out;
}

// the line under the mouse ('kind:id'), drawn thicker so it is clear which one the tooltip and a click mean
let HOVER = null;
let PICK = null;
export function setHoverLine(key) { const ch = key !== HOVER; HOVER = key; return ch; }
export function setPickLine(key) { PICK = key ?? null; }      // a clicked line stays thick until another click
const hot = (kind, id) => (HOVER != null && HOVER === kind + ':' + id) || (PICK != null && PICK === kind + ':' + id);

// path(geometry) adds the geometry to the context's current path; project([lon, lat]) → [x, y] or null.
// Returns the drawn cables and works as screen polylines, for hit-testing.
export function drawLang(ctx, L, path, project, font, zoom = 1) {
  const hits = [], labels = [];
  if (!L) return hits;
  ctx.save();
  for (const a of L.areas) {
    ctx.beginPath(); path(a.geometry);
    const fade = 1 - 0.75 * (a.fading || 0);
    ctx.globalAlpha = (0.26 + 0.25 * a.fresh) * fade; ctx.fillStyle = a.color; ctx.fill();
    ctx.globalAlpha = 0.9 * fade; ctx.lineWidth = 1.4 + 1.6 * a.fresh; ctx.strokeStyle = a.color; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
  if (L.works) drawWorks(ctx, L.works, path, project, font, hits, labels);
  for (const f of L.flows) {
    if (f.p <= 0 || f.alpha <= 0.02) continue;
    const full = f.path || [f.from, f.to], pts = upTo(full, f.p), n = pts.length - 1;
    const interp = t => upTo(full, t).at(-1);
    const fk = f.g != null ? 'cable' : 'flow', fid = f.id ?? f.name ?? f.label, on = fid != null && hot(fk, fid);
    const cable = f.g != null && f.pipe !== false, steam = cable && L.cableStyle === 'steam';   // fire-beacon chains and courier routes: drawn like other routes
    // cables: thin by default so that dozens of them stay readable; the reader can make them thicker
    const w = !cable ? (1.6 + f.wt * 1.1) * (on ? 2.2 : 1)
      : steam ? (2 + f.wt * 0.8) * (L.cableW ?? 1) * (on ? 1.5 : 1)
      : (0.9 + f.wt * 0.35) * (L.cableW ?? 1) * (on ? 2.4 : 1);
    // branches to other landing points grow together with the main route
    const extra = (f.parts || []).filter(q => q !== f.path && q.length > 1).map(q => upTo(q, f.p));
    ctx.globalAlpha = on ? 1 : f.alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); path({ type: 'LineString', coordinates: pts }); for (const o of extra) path({ type: 'LineString', coordinates: o });
    if (steam) {
      // ends of the drawn pieces: a branch starting on another piece gets a ball joint there, any other end (once
      // that piece has been laid all the way) bends down into the ground at its landing
      const geo = [f.path, ...(f.parts || []).filter(q => q !== f.path)].filter(q => q && q.length > 1), drawn = [pts, ...extra];
      const onOther = (p, j) => geo.some((q, k) => k !== j && q.some(v => Math.abs(v[0] - p[0]) < 1e-3 && Math.abs(v[1] - p[1]) < 1e-3));
      const ends = [];
      geo.forEach((q, j) => {
        for (const [p, done] of [[q[0], true], [q[q.length - 1], f.p >= 1]]) {
          if (!done) continue;
          const s = project(p); if (!s) continue;
          ends.push({ x: s[0], y: s[1], kind: onOther(p, j) ? 'joint' : 'down' });
        }
      });
      drawPipe(ctx, w, on, drawn.map(c => screenLine(project, c)), ends, f.color);
    }
    else {
      if (!cable || on) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = w + (cable ? 1.5 : 3); ctx.stroke(); }   // thin cables: no white halo (it doubled the drawing)
      ctx.strokeStyle = f.color; ctx.lineWidth = w; ctx.stroke();
    }
    if (fid != null && (f.name || f.label)) for (const c of [pts, ...extra]) hits.push(lazyHit({ kind: fk, id: fid, name: f.name || f.label }, project, c));
    // arrowhead at the moving tip
    const tip = project(pts[n]), back = project(interp(Math.max(0, f.p - Math.max(0.04, 0.6 / Math.max(1, zoom)) * 0.25)));
    if (tip && back && !f.noHead) {
      let dx = tip[0] - back[0], dy = tip[1] - back[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const s = 6 + w * 1.6;
      ctx.beginPath();
      ctx.moveTo(tip[0] + dx * s * 0.5, tip[1] + dy * s * 0.5);
      ctx.lineTo(tip[0] - dx * s + dy * s * 0.6, tip[1] - dy * s - dx * s * 0.6);
      ctx.lineTo(tip[0] - dx * s - dy * s * 0.6, tip[1] - dy * s + dx * s * 0.6);
      ctx.closePath(); ctx.fillStyle = f.color; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    // name beside the middle of the drawn part
    const mid = project(interp(f.p / 2));
    if (mid && f.p > 0.25 && f.label) labels.push({ text: f.label, x: mid[0], y: mid[1] - 4, color: f.color, alpha: on ? 1 : f.alpha, on });
  }
  // the names over every line (lines are drawn first, so a newly laid cable runs beneath the names); names that
  // would sit on one another slide apart, animated, with a thin leader back to their line
  placeLabels(ctx, labels, font);
  ctx.restore();
  return hits;
}

// ---- name layout ----------------------------------------------------------------------------------------
// Each name keeps its own offset from its place on the line between frames. Every frame the names are laid in a
// steady order (the highlighted first); each keeps its previous slot when still free, otherwise takes the nearest
// free one above or below; the drawn offset then eases toward that slot, so names move apart rather than jump.
const SLOTS = [0, -15, 15, -30, 30, -45, 45, -60, 60];
const lay = new Map();                                // name → { cur, target, t, seen }
let moving = false;
export const labelsMoving = () => moving;
function placeLabels(ctx, labels, font) {
  ctx.font = `600 11px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const now = performance.now(), boxes = [], hit = b => boxes.filter(q => b[0] < q[2] && q[0] < b[2] && b[1] < q[3] && q[1] < b[3]).length;
  moving = false; const seen = {};
  for (const l of labels.sort((a, b) => b.on - a.on)) {
    const w = ctx.measureText(l.text).width, box = dy => [l.x - w / 2 - 2, l.y + dy - 13, l.x + w / 2 + 2, l.y + dy + 1];
    const key = l.text + '#' + (seen[l.text] = (seen[l.text] || 0) + 1);   // the same name twice (branches) apart
    let s = lay.get(key);
    if (!s) { s = { cur: 0, target: 0, t: now }; lay.set(key, s); }
    // back on the line when there is room there, else where it was, else the nearest free slot
    let best = 0, bestN = Infinity;
    for (const dy of [0, s.target, ...SLOTS]) { const n = hit(box(dy)); if (n < bestN) { best = dy; bestN = n; if (!n) break; } }
    s.target = best; boxes.push(box(best));
    // eased per frame by elapsed time (the side-by-side copies of the world, drawn in the same frame, do not add up)
    const dt = now - s.t; s.t = now; s.seen = now;
    if (dt > 0) s.cur += (s.target - s.cur) * Math.min(1, dt / 160);
    if (Math.abs(s.target - s.cur) < 0.3) s.cur = s.target; else moving = true;
    const y = l.y + s.cur;
    ctx.globalAlpha = Math.max(0.6, l.alpha);
    if (Math.abs(s.cur) > 6) {                       // leader back to the line
      ctx.beginPath(); ctx.moveTo(l.x, l.y + 3); ctx.lineTo(l.x, y + (s.cur < 0 ? 0 : -12));
      ctx.lineWidth = 1; ctx.strokeStyle = l.color; ctx.stroke();
    }
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.strokeText(l.text, l.x, y);
    ctx.fillStyle = l.color; ctx.fillText(l.text, l.x, y);
  }
  ctx.globalAlpha = 1;
  if (lay.size > 400) for (const [k, s] of lay) if (now - s.seen > 3000) lay.delete(k);
}

// pipe style (like the old 3D Pipes screensaver): glossy metal tubes, each cable its own metal, shaded as a
// cylinder (dark rim, body, light, a white glint) with round elbows; at a landing the tube simply bends down into
// the ground. `ends`: screen points, kind 'down' (a landing) or 'joint' (a branch meeting its trunk: drawn plain).
const mix = (c, t, k) => c.map((v, i) => Math.round(v + (t[i] - v) * k));
const rgb = a => `rgb(${a[0]},${a[1]},${a[2]})`;
function tubeColors(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return { rim: rgb(mix(c, [0, 0, 0], 0.65)), dark: rgb(mix(c, [0, 0, 0], 0.35)), body: rgb(c), light: rgb(mix(c, [255, 255, 255], 0.45)), glint: 'rgba(255,255,255,0.9)' };
}
function strokeTube(ctx, w, C) {                 // the current path, as a shaded tube
  ctx.strokeStyle = C.rim; ctx.lineWidth = w + 1.2; ctx.stroke();
  ctx.strokeStyle = C.body; ctx.lineWidth = w * 0.8; ctx.stroke();
  ctx.save(); ctx.translate(-w * 0.06, -w * 0.1); ctx.strokeStyle = C.light; ctx.lineWidth = w * 0.4; ctx.stroke();
  ctx.translate(-w * 0.04, -w * 0.08); ctx.strokeStyle = C.glint; ctx.lineWidth = Math.max(0.5, w * 0.13); ctx.stroke(); ctx.restore();
}
function drawPipe(ctx, w, on, lines, ends = [], color = '#c9a04a') {
  const C = tubeColors(color.startsWith('#') ? color : '#c9a04a'), W = w * (on ? 1.15 : 1);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.save(); ctx.translate(W * 0.3 + 1, W * 0.45 + 1.5);        // shadow on the ground (a blur filter was far too slow)
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = W + 1.5; ctx.stroke(); ctx.restore();
  strokeTube(ctx, W, C);
  for (const e of ends) {
    if (e.kind === 'joint') continue;           // a branch simply runs into its trunk
    // bend down into the ground: a round elbow and a short stub straight down, cut off where it meets the ground
    const L = W * 1.3;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x, e.y + L); strokeTube(ctx, W, C);
    ctx.beginPath(); ctx.ellipse(e.x, e.y + L, W / 2 + 0.6, W * 0.2 + 0.4, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
  }
  ctx.restore();
}

// the nearest drawn line within tol pixels of (x, y)
export function lineAt(hits, x, y, tol = 7) {
  let best = null, bd = tol * tol;
  for (const h of hits || []) {
    const p = h.pts;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i]; if (!a || !b) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
      const ex = a[0] + t * dx - x, ey = a[1] + t * dy - y, d = ex * ex + ey * ey;
      if (d < bd) { bd = d; best = h; }
    }
  }
  return best;
}

// a minimal path drawer from a point projection (for the globe overlay): breaks lines where a point is hidden
export function pathFromProject(ctx, project) {
  // straight screen lines between projected points: long legs get points every 2° so they follow the great circle
  const line = coords => {
    let pen = false, prev = null;
    const put = c => { const p = project(c); if (!p) { pen = false; return; } pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); pen = true; };
    for (const c of coords) {
      if (prev) { const d = geoDistance(prev, c); if (d > 0.035) { const f = geoInterpolate(prev, c), n = Math.ceil(d / 0.035); for (let k = 1; k < n; k++) put(f(k / n)); } }
      put(c); prev = c;
    }
  };
  return g => {
    if (g.type === 'LineString') line(g.coordinates);
    else if (g.type === 'Polygon') for (const r of g.coordinates) { line(r); ctx.closePath(); }
  };
}

// major works (railways, motorways, canals …): the network built so far, faint, and each new section drawn
// along its route as it opens, highlighted for a while with its name
const WORK_STYLE = { rail: { w: 2.2, dash: [5, 4] }, hsr: { w: 2.6, dash: [7, 4] }, highway: { w: 2.6 }, road: { w: 1.8 }, canal: { w: 2.2, dash: [2, 3] }, pipeline: { w: 1.6, dash: [6, 3] }, fiber: { w: 1.8, dash: [2, 2] }, cable: { w: 1.8, dash: [8, 3] }, grid: { w: 1.6, dash: [10, 2, 2, 2] }, bridge: { w: 2.8 }, tunnel: { w: 2.8, dash: [3, 3] } };
function drawWorks(ctx, W, path, project, font, hits, labels = []) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const n of W.net) {
    if (n.alpha <= 0.02) continue;
    const st = WORK_STYLE[n.kind] || { w: 1.6 }, on = hot('work', n.id);
    ctx.globalAlpha = on ? 1 : 0.55 * n.alpha;
    ctx.beginPath(); for (const q of n.parts || [n.path]) path({ type: 'LineString', coordinates: q });
    if (on) { ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = st.w * 2 + 3; ctx.stroke(); }
    ctx.strokeStyle = n.color; ctx.lineWidth = on ? st.w * 2 : Math.max(1, st.w * 0.55); ctx.stroke();
    if (hits && n.id) for (const q of n.parts || [n.path]) hits.push(lazyHit({ kind: 'work', id: n.id, name: n.label }, project, q));
  }
  for (const l of W.lines) {
    if (l.p <= 0) continue;
    const st = WORK_STYLE[l.kind] || { w: 2 }, interp = t => upTo(l.path, t).at(-1);
    const drawn = (l.parts || [l.path]).map(q => upTo(q, l.p));
    const on = hot('work', l.id), k = on ? 2 : 1;
    ctx.globalAlpha = on ? 1 : l.alpha;
    ctx.beginPath(); for (const o of drawn) path({ type: 'LineString', coordinates: o });
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = (st.w + 1.2) * k + 3; ctx.stroke();
    ctx.strokeStyle = l.color; ctx.lineWidth = (st.w + 1.2) * k; ctx.stroke();
    if (st.dash) { ctx.setLineDash(st.dash); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, st.w * 0.45); ctx.stroke(); ctx.setLineDash([]); }
    if (hits && l.id) for (const o of drawn) hits.push(lazyHit({ kind: 'work', id: l.id, name: l.label }, project, o));
    const mid = project(interp(l.p / 2));
    if (mid && l.p > 0.25 && l.label) labels.push({ text: l.label, x: mid[0], y: mid[1] - 4, color: l.color, alpha: on ? 1 : l.alpha, on });
  }
  ctx.globalAlpha = 1;
}
