// Rebuild the geometry of every submarine cable from data-pipeline/cables/cables.tsv:
//   tg:<id>  the route from TeleGeography's Submarine Cable Map (data-pipeline/sources/cables/cable-geo.json, downloaded
//            by fetch-cables.mjs), simplified to about 2 km without letting any segment cross land, ends at its real
//            landing stations; optionally cut to a box (Taiwan and Japan modes, local excerpts).
//   route    a historical or retired cable that TeleGeography does not have: the listed landing stations, joined
//            by the shortest way at sea (never across land); " ~ " marks an overland telegraph leg.
// Writes the geometry into data-pipeline/<region>/infra.tsv and data-pipeline/internet/flows.tsv, then checks that
// no cable crosses land (Natural Earth 1:50m, as drawn by the site) except where it comes ashore.
//   node data-pipeline/cables/build-cables.mjs [--check]     (--check: only report)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { crosses, seaRoute, taut, simplify, distDeg, shoreGap, onLand } from './geo.mjs';

const DP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const TOL = 0.02, SHORE = 0.12;           // simplification tolerance; how far from a landing the line may be over land
const spec = fs.readFileSync(path.join(DP, 'cables', 'cables.tsv'), 'utf8').split('\n')
  .filter(l => l.trim() && !l.startsWith('#')).map(l => { const [target, source, stops = '', clip = '', note = ''] = l.split('\t'); return { target, source, stops, clip, note }; });

const tgFile = path.join(DP, 'sources', 'cables', 'cable-geo.json');
const TG = new Map();
if (fs.existsSync(tgFile)) for (const f of JSON.parse(fs.readFileSync(tgFile, 'utf8')).features) {
  const id = f.properties?.id; if (!id || !f.geometry) continue;
  const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
  TG.set(id, (TG.get(id) || []).concat(parts));
}
const P = s => s.split(',').map(Number);
const fmt = p => `${+p[0].toFixed(3)},${+p[1].toFixed(3)}`;
const norm = x => ((x + 180) % 360 + 360) % 360 - 180;

// ---- route: landing stations joined at sea ----
function fromStops(stops) {
  return stops.split(';').map(b => b.trim()).filter(Boolean).map(branch => {
    const toks = branch.split(/\s+/); const pts = [], land = [];
    for (const t of toks) { if (t === '~') { land[pts.length - 1] = true; continue; } pts.push(P(t)); }
    let line = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], skip = [[...a, SHORE], [...b, SHORE]];
      if (land[i - 1] || !crosses(a, b, skip)) { line.push(b); continue; }
      const { line: r, buf, na, nb } = seaRoute(a, b);
      const sk = [[...a, Math.max(SHORE, na)], [...b, Math.max(SHORE, nb)]];
      line = line.concat(taut(r, sk, buf).slice(1));
    }
    return line.map(p => [norm(p[0]), p[1]]);
  });
}

// ---- tg: TeleGeography geometry ----
function clipTo(parts, box) {
  if (!box) return parts;
  const [x0, y0, x1, y1] = box.split(',').map(Number), inside = p => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
  const out = [];
  for (const line of parts) {
    let cur = [];
    for (let i = 0; i < line.length; i++) {
      const p = line[i];
      if (i) {                                    // Liang–Barsky on the segment line[i-1] → p
        const a = line[i - 1]; let t0 = 0, t1 = 1; const dx = p[0] - a[0], dy = p[1] - a[1]; let ok = true;
        for (const [pp, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
          if (pp === 0) { if (q < 0) { ok = false; break; } continue; }
          const r = q / pp; if (pp < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
        }
        if (ok) {
          const A = [a[0] + t0 * dx, a[1] + t0 * dy], B = [a[0] + t1 * dx, a[1] + t1 * dy];
          if (!cur.length) cur.push(A);
          cur.push(B);
          if (t1 < 1) { if (cur.length > 1) out.push(cur); cur = []; }
        } else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
      }
    }
    if (cur.length > 1) out.push(cur);
  }
  return out;
}
// TeleGeography gives many cables as a set of short pieces that meet end to end; drawn one by one (each growing
// from its own start) they looked broken. Pieces are joined where exactly two of them meet; where three or more
// meet (a branching unit) they stay apart, so each branch grows out from the trunk.
function mergeParts(parts) {
  const key = p => p[0].toFixed(3) + ',' + p[1].toFixed(3);
  let lines = parts.filter(l => l.length > 1).map(l => l.slice());
  for (let changed = true; changed;) {
    changed = false;
    const deg = new Map();
    for (const l of lines) for (const p of [l[0], l[l.length - 1]]) deg.set(key(p), (deg.get(key(p)) || 0) + 1);
    outer: for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const A = lines[i], B = lines[j], a0 = key(A[0]), a1 = key(A[A.length - 1]), b0 = key(B[0]), b1 = key(B[B.length - 1]);
      let m = null;
      if (a1 === b0 && deg.get(a1) === 2) m = A.concat(B.slice(1));
      else if (a1 === b1 && deg.get(a1) === 2) m = A.concat(B.slice(0, -1).reverse());
      else if (a0 === b1 && deg.get(a0) === 2) m = B.concat(A.slice(1));
      else if (a0 === b0 && deg.get(a0) === 2) m = B.slice().reverse().concat(A.slice(1));
      if (m) { lines.splice(j, 1); lines[i] = m; changed = true; break outer; }
    }
  }
  return lines;
}
function fromTG(id, clip) {
  const raw = TG.get(id); if (!raw) return null;
  let parts = mergeParts(clipTo(raw.map(l => l.map(p => [p[0], p[1]])), clip));
  const ends = parts.flatMap(l => [l[0], l[l.length - 1]]);
  const gap = p => { try { return Math.min(0.4, Math.max(SHORE, shoreGap(p))); } catch { return SHORE; } };
  // TeleGeography's points on land are its landing stations (a trunk often runs in to a station and back out) or
  // the points of a stretch over land; the line may cross the shore around them
  const stations = parts.flat().filter(p => onLand(p[0], p[1]));
  const skip = ends.concat(stations).map(p => [...p, gap(p)]);
  // TeleGeography draws its routes schematically (about 20 points a cable), so a straight piece may cut across a
  // cape or an island: such a piece is redrawn by the shortest way at sea. Where the way by sea would be far longer
  // than the piece (more than 3 × + 2°), the cable really runs over land there (e.g. across Egypt or Panama) and
  // the piece is kept.
  parts = parts.map(line => {
    const out = [line[0]];
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      if (!crosses(a, b, skip)) { out.push(b); continue; }
      let way = null;
      try {
        const r = seaRoute(a, b), sk = skip.concat([[...a, r.na], [...b, r.nb]]);
        way = taut(r.line, sk, r.buf);
        let L = 0; for (let k = 1; k < way.length; k++) L += distDeg(way[k - 1], way[k]);
        if (L > 3 * distDeg(a, b) + 2) way = null;
      } catch { way = null; }
      if (way) out.push(...way.slice(1).map(p => [((p[0] + 180) % 360 + 360) % 360 - 180, p[1]])); else out.push(b);
    }
    return out;
  });
  parts = parts.map(line => {
    const keep = new Set();                       // vertices where another part joins (branching units), and stations
    line.forEach((p, i) => { if (onLand(p[0], p[1]) || ends.some(e => e !== p && Math.abs(e[0] - p[0]) < 1e-6 && Math.abs(e[1] - p[1]) < 1e-6)) keep.add(i); });
    return simplify(line, TOL, skip, keep);
  });
  return attachBranches(parts.filter(l => l.length > 1));
}
// A branch leaves the trunk at a branching unit somewhere along it; once the trunk has been rerouted at sea and
// simplified, the branch's sea end no longer sits on it and the branch floated loose. Each end at sea is joined
// to the nearest point of another part of the same cable (within 1°).
function attachBranches(parts) {
  if (parts.length < 2) return parts;
  const near = (p, skipI) => {
    let best = null, bd = 1;
    parts.forEach((l, i) => { if (i === skipI) return; for (let k = 1; k < l.length; k++) {
      const a = l[k - 1], b = l[k], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
      const q = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) { bd = d; best = q; }
    } });
    return bd > 1e-4 ? best : null;
  };
  return parts.map((l, i) => {
    const out = l.slice();
    if (!onLand(l[0][0], l[0][1])) { const q = near(l[0], i); if (q) out.unshift(q); }
    const e = l[l.length - 1];
    if (!onLand(e[0], e[1])) { const q = near(e, i); if (q) out.push(q); }
    return out;
  });
}

// ---- write back ----
const geom = parts => parts.map(l => l.map(fmt).join(' ')).join(';');
const files = new Map();
const load = f => { if (!files.has(f)) files.set(f, { lines: fs.readFileSync(f, 'utf8').split('\n'), dirty: false }); return files.get(f); };
const issues = [], terrestrial = []; let done = 0, waiting = 0;
const t0 = Date.now();
for (const s of spec) {
  const [region, id] = s.target.split('/');
  let parts;
  if (s.source === 'route') parts = CHECK ? null : (s.clip ? clipTo(fromStops(s.stops), s.clip) : fromStops(s.stops));
  else if (s.source.startsWith('tg:')) {
    if (!CHECK) { parts = fromTG(s.source.slice(3), s.clip); if (!parts) { waiting++; if (TG.size) issues.push(`${s.target}: TeleGeography 沒有 ${s.source}`); } }
  } else { issues.push(`${s.target}: 不明的來源 ${s.source}`); continue; }
  const isNet = region === 'internet';
  const F = load(path.join(DP, region, isNet ? 'flows.tsv' : 'infra.tsv'));
  const i = F.lines.findIndex(l => { const c = l.split('\t'); return isNet ? c[0] === id : c[0] === 'cable' && c[1] === id; });
  if (i < 0) { issues.push(`${s.target}: 找不到這條電纜`); continue; }
  const c = F.lines[i].split('\t');
  if (parts) {
    if (isNet) { while (c.length < 13) c.push(''); c[12] = geom(parts); const a = parts[0][0], b = parts[0][parts[0].length - 1]; [c[4], c[5], c[6], c[7]] = [a[0], a[1], b[0], b[1]].map(v => String(+v.toFixed(3))); }
    else c[4] = geom(parts);
    F.lines[i] = c.join('\t'); F.dirty = true; done++;
  }
  // check what is in the file now
  const g = isNet ? c[12] : c[4];
  const now = g.split(';').filter(x => x.trim()).map(x => x.trim().split(/\s+/).map(P));
  const ends = now.flatMap(l => [l[0], l[l.length - 1]]);
  const stops = s.source === 'route' ? s.stops.split(/[\s;]+/).filter(t => t && t !== '~').map(P) : [];
  const gapOf = p => { let g = SHORE; try { g = shoreGap(p); } catch {} return Math.min(0.4, Math.max(SHORE, g)); };   // inland stops of overland lines have no shore
  const skip = ends.map(p => [...p, gapOf(p)]).concat(stops.map(p => [...p, gapOf(p)]))
    .concat(s.source.startsWith('tg:') ? now.flat().filter(p => onLand(p[0], p[1])).map(p => [...p, gapOf(p)]) : []);
  const landLegs = new Set();                      // overland legs of route cables
  if (s.source === 'route') for (const b of s.stops.split(';')) { const t = b.trim().split(/\s+/); for (let k = 1; k < t.length - 1; k++) if (t[k] === '~') landLegs.add(t[k - 1] + '|' + t[k + 1]); }
  let bad = 0;
  for (const l of now) for (let k = 1; k < l.length; k++) {
    if (Math.abs(l[k][0] - l[k - 1][0]) > 180) continue;
    if (landLegs.has(fmt(l[k - 1]) + '|' + fmt(l[k])) || [...landLegs].some(x => { const [a, b] = x.split('|').map(P); return distDeg(a, l[k - 1]) < 1e-3 && distDeg(b, l[k]) < 1e-3; })) continue;
    if (crosses(l[k - 1], l[k], skip)) bad++;
  }
  // a rebuilt TeleGeography route only keeps a segment over land where TeleGeography's own line runs over land
  // (terrestrial links such as across Egypt or Panama): simplification never adds one
  if (bad && (parts || CHECK) && s.source.startsWith('tg:') && TG.size) terrestrial.push(`${s.target}（${bad}）`);
  else if (bad) issues.push(`${s.target}: ${bad} 段穿越陸地${parts ? '' : '（尚未重建）'}`);
}
for (const [f, F] of files) if (F.dirty) fs.writeFileSync(f, F.lines.join('\n'));
// put the new geometry into the built data as well, so no other build step is needed
if (!CHECK && done) {
  const ROOT = path.resolve(DP, '..');
  for (const [f, F] of [...files].sort(([a], [b]) => a.includes('internet') - b.includes('internet'))) {   // regions first, the Internet mode last
    if (!F.dirty) continue;
    const region = path.basename(path.dirname(f));
    if (region === 'internet') { execFileSync(process.execPath, [path.join(DP, 'build_theme.mjs'), 'internet'], { stdio: 'inherit' }); continue; }
    const jf = path.join(ROOT, 'public', 'data', region + '.json'); if (!fs.existsSync(jf)) continue;
    const d = JSON.parse(fs.readFileSync(jf, 'utf8'));
    const geo = new Map(F.lines.map(l => l.split('\t')).filter(c => c[0] === 'cable').map(c => [c[1], c[4].split(';').filter(x => x.trim()).map(x => x.trim().split(/\s+/).map(P))]));
    for (const w of d.works || []) {
      const parts = w.kind === 'cable' && geo.get(w.id); if (!parts) continue;
      w.path = parts.reduce((a, b) => (b.length > a.length ? b : a));
      if (parts.length > 1) w.parts = parts; else delete w.parts;
    }
    fs.writeFileSync(jf, JSON.stringify(d));
  }
}
console.log(`海纜：重建 ${done} 條${waiting ? `，${waiting} 條等待 TeleGeography 資料（執行 fetch-offline.ps1 -CablesOnly）` : ''}，${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
for (const x of issues) console.log('  ' + x);
if (terrestrial.length) console.log(`  依 TeleGeography 原始路線走陸上段（如跨埃及、巴拿馬）：${terrestrial.join('、')}`);
if (issues.some(x => /穿越陸地(?!（尚未)/.test(x) || /找不到|不明/.test(x))) process.exitCode = 1;
