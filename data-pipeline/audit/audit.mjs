// Automatic checks of every regional (country) mode's built data, public/data/<region>.json, by kind:
// dates (in order, inside the mode's timeline), places (on land where they should be, inside the region's
// reach), routes (no zero-length or huge straight legs; rail and roads not over the sea), names in every
// language, duplicates, and the control and administration timelines.
// Prints a summary per region and writes data-pipeline/audit/findings.json (one row per finding).
//   node data-pipeline/audit/audit.mjs [region …]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { geoBounds } from 'd3-geo';
import { onLand, nearLand } from '../cables/geo.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '..', '..');
const UNIT_FILES = { china: 'china_provinces.json', taiwan: 'taiwan_units.json', japan: 'japan_units.json', russia: 'russia_units.json', korea: 'korea_units.json', philippines: 'philippines_units.json', vietnam: 'vietnam_units.json', germany: 'germany_units.json', poland: 'poland_units.json', italy: 'italy_units.json', spain: 'spain_units.json', india: 'india_units.json', prc: 'prc_units.json', usa: 'usa_units.json', france: 'france_units.json', egypt: 'egypt_units.json', iran: 'iran_units.json', turkey: 'turkey_units.json', uk: 'uk_units.json', mexico: 'mexico_units.json', morocco: 'morocco_units.json', brazil: 'brazil_units.json', argentina: 'argentina_units.json', thailand: 'thailand_units.json', indonesia: 'indonesia_units.json' };
const regions = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(UNIT_FILES);
const LINE = new Set(['rail', 'road', 'highway', 'hsr', 'metro']);
const SEA_OK = /海|灣|港|島|艦|登陸|撤退|渡|航|船|naval|sea|fleet|landing|island|bay|strait|evacuat|port|cable|ship|voyage/i;
const out = [];
const add = (region, cat, id, what, detail = '') => out.push({ region, cat, id: String(id), what, detail });
const ym = (d, m) => { const t = d.start[0] * 12 + (d.start[1] - 1) + m; return `${Math.floor(t / 12)}-${String(((t % 12) + 12) % 12 + 1).padStart(2, '0')}`; };
const names = (reg, cat, id, n) => {
  if (!Array.isArray(n)) return add(reg, cat, id, '沒有名稱');
  ['English', '繁中', '簡中', '日本語'].forEach((l, i) => { if (!n[i] || !String(n[i]).trim()) add(reg, cat, id, '缺少' + l + '名稱'); });
};
const len = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]));

for (const r of regions) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', r + '.json'), 'utf8'));
  const topo = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', UNIT_FILES[r]), 'utf8'));
  const units = feature(topo, topo.objects[Object.keys(topo.objects)[0]]);
  let [[x0, y0], [x1, y1]] = geoBounds(units);
  if (x1 < x0) { x0 = -180; x1 = 180; }
  const inReach = ([lon, lat], m) => lon >= x0 - m && lon <= x1 + m && lat >= y0 - m && lat <= y1 + m;
  const M = d.months - 1;
  const range = (cat, id, a, b) => {
    if (a == null || b == null || !isFinite(a) || !isFinite(b)) return add(r, cat, id, '缺少起訖時間');
    if (a > b) add(r, cat, id, '起始晚於結束', `${ym(d, a)} > ${ym(d, b)}`);
    if (a < -1200 || b > M + 1) add(r, cat, id, '時間超出本模式年代', `${ym(d, a)} – ${ym(d, b)}`);
  };
  const place = (cat, id, lon, lat, text, { sea = false, reach = 6 } = {}) => {
    if (lon == null || lat == null) return;
    if (!isFinite(lon) || !isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return add(r, cat, id, '座標無效', `${lon},${lat}`);
    if (!inReach([lon, lat], reach)) {
      const swapped = inReach([lat, lon], reach) && Math.abs(lat) <= 90;
      add(r, cat, id, swapped ? '座標疑似經緯顛倒' : '地點遠離本國範圍', `${lon},${lat}${text ? '　' + text : ''}`);
    }
    if (!sea && !nearLand(lon, lat, 0.12) && !(text && SEA_OK.test(text))) add(r, cat, id, '地點在海上', `${lon},${lat}${text ? '　' + text : ''}`);
  };

  // factions, divisions
  const usedF = new Set(), usedD = new Set();
  for (const [u, tl] of Object.entries(d.control || {})) {
    let last = -Infinity;
    for (const [m, f, f2] of tl) {
      if (m < last) add(r, 'control', u, '統治時間軸未依時間排序', ym(d, m));
      last = m;
      if (f >= 0) { if (!d.factions[f]) add(r, 'control', u, '指向不存在的勢力', String(f)); else usedF.add(f); }
      if (f2 >= 0) { if (!d.factions[f2]) add(r, 'control', u, '指向不存在的勢力', String(f2)); else usedF.add(f2); }
    }
    if (m0(tl) > 0) add(r, 'control', u, '開頭沒有統治資料', ym(d, 0) + ' 起');
  }
  function m0(tl) { return tl.length ? tl[0][0] : Infinity; }
  d.factions.forEach((f, i) => { names(r, 'control', f.id, f.n); if (!usedF.has(i) && !(d.governments || []).some(g => g.f === i)) add(r, 'control', f.id, '勢力未被任何地區使用'); });
  for (const [u, tl] of Object.entries(d.admin || {})) {
    let last = -Infinity;
    for (const [m, v] of tl) { if (m < last) add(r, 'admin', u, '行政區時間軸未依時間排序', ym(d, m)); last = m; if (v >= 0) { if (!d.divisions[v]) add(r, 'admin', u, '指向不存在的行政區', String(v)); else usedD.add(v); } }
  }
  (d.divisions || []).forEach((v, i) => { names(r, 'admin', v.id, v.n); if (d.admin && !usedD.has(i)) add(r, 'admin', v.id, '行政區未被任何地區使用'); });
  const unitIds = new Set(units.features.map(f => f.properties.id));
  for (const u of unitIds) { if (d.control && !d.control[u]) add(r, 'control', u, '地區沒有統治資料'); }

  // governments and seats
  for (const g of d.governments || []) { range('gov', g.id, g.a, g.b); names(r, 'gov', g.id, g.n); place('gov', g.id, g.lon, g.lat, g.n?.[1], { reach: 25 }); if (g.f != null && !d.factions[g.f]) add(r, 'gov', g.id, '指向不存在的勢力'); }
  for (const s of d.seats || []) { range('admin', s.id, s.a, s.b); names(r, 'admin', s.id, s.n); place('admin', s.id, s.lon, s.lat, s.n?.[1]); }

  // events
  const seen = new Map();
  for (const [i, e] of (d.events || []).entries()) {
    const cat = e.k === 'cable' ? 'net' : 'events', id = e.work || `#${i} ${ym(d, e.m)}`;
    if (e.m < -1200 || e.m > M + 1) add(r, cat, id, '時間超出本模式年代', ym(d, e.m));
    names(r, cat, id, e.n);
    if (e.k !== 'cable') place(cat, id, e.lon, e.lat, (e.n?.[1] || '') + ' ' + (e.n?.[0] || ''), { reach: 30 });
    const key = e.m + '|' + (e.n?.[1] || '');
    if (seen.has(key)) add(r, cat, id, '重複的事件', e.n?.[1]); seen.set(key, 1);
  }
  // flows
  for (const f of d.flows || []) {
    range('flows', f.id, f.a, f.b); names(r, 'flows', f.id, f.n);
    let far = 0;
    for (const p of f.parts || (f.path ? [f.path] : [])) {
      for (let k = 0; k < p.length; k++) {
        if (!p[k] || p[k].length !== 2 || !p[k].every(isFinite)) { add(r, 'flows', f.id, '路線點無效'); continue; }
        if (!inReach(p[k], 25)) far++;
        if (k && len(p[k - 1], p[k]) < 1e-6) add(r, 'flows', f.id, '路線有重複點', p[k].join(','));
        if (k && len(p[k - 1], p[k]) > 15) add(r, 'flows', f.id, '路線有過長的直線段（可能少了中途點）', `${p[k - 1].join(',')} → ${p[k].join(',')}`);
      }
    }
    if (far) add(r, 'flows', f.id, '路線有點遠離本國範圍（需確認是否為跨國路線）', far + ' 點');
  }
  // works
  const wseen = new Map();
  for (const w of d.works || []) {
    const cat = ['cable', 'fiber', 'ixp', 'datacenter'].includes(w.kind) ? 'net' : LINE.has(w.kind) || ['bridge', 'tunnel'].includes(w.kind) ? 'transport' : 'works';
    range(cat, w.id, w.a, w.b); names(r, cat, w.id, w.n);
    if (wseen.has(w.id)) add(r, cat, w.id, '重複的 id'); wseen.set(w.id, 1);
    if (w.path || w.parts) {
      const parts = w.parts || [w.path];
      let total = 0, sea = 0;
      for (const p of parts) for (let k = 1; k < p.length; k++) {
        const L = len(p[k - 1], p[k]); total += L;
        if (LINE.has(w.kind)) { const n = Math.max(1, Math.ceil(L / 0.02)); let s = 0; for (let j = 1; j < n; j++) { const q = [p[k - 1][0] + (p[k][0] - p[k - 1][0]) * j / n, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * j / n]; if (!nearLand(q[0], q[1], 0.05)) s++; } sea += L * s / n; }
      }
      if (LINE.has(w.kind) && total && sea / total > 0.08 && sea > 0.2) add(r, cat, w.id, '陸上路線有一段在海上', `${Math.round(sea / total * 100)}%`);
      if (!total) add(r, cat, w.id, '路線長度為零');
    } else if (w.lon != null) {
      place(cat, w.id, w.lon, w.lat, w.n?.[1], { sea: ['cable', 'port', 'bridge', 'wind'].includes(w.kind) });
    } else add(r, cat, w.id, '沒有位置');
  }
  // local powers, feuds
  for (const x of d.local || []) { range('info', x.id, x.a, x.b); names(r, 'info', x.id, x.n); place('info', x.id, x.lon, x.lat, x.n?.[1]); }
  // party timelines
  for (const [u, tl] of Object.entries(d.party || {})) { let last = -Infinity; for (const [m] of tl) { if (m < last) add(r, 'info', 'party:' + u, '選舉時間軸未依時間排序'); last = m; } }
  // areas
  for (const a of d.areas || []) { range('control', a.id || '?', a.a, a.b); }
}
fs.writeFileSync(path.join(here, 'findings.json'), JSON.stringify(out, null, 0));
const by = {};
for (const f of out) { const k = f.region + '/' + f.cat; by[k] = (by[k] || 0) + 1; }
const kinds = {}; for (const f of out) kinds[f.what] = (kinds[f.what] || 0) + 1;
console.log(out.length, 'findings'); console.log(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => v + ' ' + k).join('\n'));
