// Compiles a hand-written regional mode (China, Taiwan) from its folder of TSV tables into
// public/data/<region>.json. Every row is validated: unknown unit, faction or division ids stop the build.
//
//   node data-pipeline/build_region.mjs china  → reads data-pipeline/china/*.tsv
//   node data-pipeline/build_region.mjs taiwan → reads data-pipeline/taiwan/*.tsv
//
// Files in the folder:
//   region.json        {"start": "YYYY-MM", "end": "YYYY-MM", "units": "<build/xxx.geojson>", "prc": "1949-10" (optional),
//                       "groups": {"alias": ["unit", …]} (optional: a name in the tables that stands for several units),
//                       "merge": true (optional: draw units of the same faction / division as one area)}
//   factions.tsv       id, colour, zh-Hant, zh-Hans, en, ja
//   control.tsv        YYYY-MM, units, faction[/secondary]
//   governments.tsv    id, from, to, lon, lat, highlight(1/0), faction, zh-Hant, zh-Hans, en, ja
//   events.tsv         YYYY-MM, zh-Hant, en, ja[, lon, lat]
//   ccp_areas.tsv      (optional) id, from, to, lon, lat, rx, ry, zh-Hant, zh-Hans, en, ja
//   seats.tsv          (optional) administrative seats shown with the division layer:
//                      id, from, to, lon, lat, division id ('' = any), zh-Hant, en, ja, Wikipedia [zh, en, ja] titles, note zh-Hant, note en, note ja
//   divisions.tsv + admin.tsv (optional) administrative divisions, same format as factions / control;
//                      in admin.tsv the value "=parent" makes a unit follow its parent unit's division from then on
import fs from 'node:fs';
import path from 'node:path';
import * as OpenCC from 'opencc-js';

const region = process.argv[2];
const here = path.join(path.dirname(new URL(import.meta.url).pathname), region);
const OUT = path.join(here, '..', '..', 'public', 'data', region + '.json');
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });     // only for prose (event notes, descriptions), never for names
const cfg = JSON.parse(fs.readFileSync(path.join(here, 'region.json'), 'utf8'));
const START = (s => { const neg = s.startsWith('-'); const [y, m] = (neg ? s.slice(1) : s).split('-').map(Number); return [neg ? -y : y, m]; })(cfg.start);
const month = s => { const neg = s.startsWith('-'); const [y, m] = (neg ? s.slice(1) : s).split('-').map(Number); return ((neg ? -y : y) - START[0]) * 12 + (m - START[1]); };
const exists = f => fs.existsSync(path.join(here, f));
const rows = f => fs.readFileSync(path.join(here, f), 'utf8').split('\n')
  .filter(l => l.trim() && !l.startsWith('#')).map(l => l.split('\t'));

const unitFeatures = JSON.parse(fs.readFileSync(path.join(here, '..', 'build', cfg.units), 'utf8')).features;
const units = unitFeatures.map(f => f.properties.id);
const parentOf = Object.fromEntries(unitFeatures.filter(f => f.properties.parent).map(f => [f.properties.id, f.properties.parent]));
const groups = cfg.groups || {};
const expand = (u, file, where) => {
  if (groups[u]) return groups[u].flatMap(x => expand(x, file, where));
  if (!units.includes(u)) throw new Error(`${file}: unknown unit "${u}" (${where})`);
  return [u];
};

function table(file) {
  const list = rows(file).map(([id, color, hant, hans, en, ja]) => ({ id, color, n: [en, hant, hans || hant, ja || hant] }));
  return { list, index: Object.fromEntries(list.map((f, i) => [f.id, i])) };
}
function timeline(file, tab) {
  const fid = (id, where) => { if (!(id in tab.index)) throw new Error(`${file}: unknown id "${id}" (${where})`); return tab.index[id]; };
  const out = Object.fromEntries(units.map(u => [u, []]));
  rows(file).map((r, i) => ({ r, i, m: month(r[0]) })).sort((a, b) => a.m - b.m || a.i - b.i).forEach(({ r, m }) => {
    const [prim, sec] = r[2].trim().split('/');
    for (const u of r[1].split(',').flatMap(s => expand(s.trim(), file, r[0]))) {
      const list = out[u], e = prim === '=parent' ? [m, -2, -1] : [m, fid(prim, r[0]), sec ? fid(sec, r[0]) : -1];
      if (list.length && list.at(-1)[0] === m) list[list.length - 1] = e; else list.push(e);
    }
  });
  // "=parent": from that month on, take the parent unit's entries
  for (const [u, l] of Object.entries(out)) {
    const k = l.findIndex(e => e[1] === -2);
    if (k < 0) continue;
    const p = out[parentOf[u]];
    if (!p) throw new Error(`${file}: unit ${u} uses =parent but has no parent`);
    const from = l[k][0], before = l.slice(0, k);
    const at = m => { let c = p[0]; for (const e of p) { if (e[0] <= m) c = e; else break; } return c; };
    out[u] = [...before, [from, at(from)[1], at(from)[2]], ...p.filter(e => e[0] > from).map(e => [...e])];
  }
  for (const [u, l] of Object.entries(out)) if (!l.length || l[0][0] !== 0) throw new Error(`${file}: unit ${u} has no state at ${cfg.start}`);
  return { out, fid };
}

const factions = table('factions.tsv');
const control = timeline('control.tsv', factions);
const governments = rows('governments.tsv').map(([id, a, b, lon, lat, roc, f, hant, hans, en, ja]) =>
  ({ id, a: month(a), b: month(b), lon: +lon, lat: +lat, roc: roc === '1', f: control.fid(f, 'governments ' + id), n: [en, hant, hans, ja] }));
const areas = exists('ccp_areas.tsv') ? rows('ccp_areas.tsv').map(([id, a, b, lon, lat, rx, ry, hant, hans, en, ja]) =>
  ({ id, a: month(a), b: month(b), lon: +lon, lat: +lat, rx: +rx, ry: +ry, n: [en, hant, hans, ja] })) : [];
let events = rows('events.tsv').map(([m, hant, en, ja, lon, lat]) => Object.assign({ m: month(m), n: [en, hant, toHans(hant), ja] },
  lon && lat ? { lon: +lon, lat: +lat } : {})).sort((a, b) => a.m - b.m);      // optional place: marked on the map when the timeline passes it

// flows.tsv (optional): marches, fronts and migrations, drawn as arrows that advance along their path
const flows = exists('flows.tsv') ? rows('flows.tsv').map(([id, a, b, color, wt, path, hant, en, ja]) => ({
  id, a: month(a), b: month(b), color, wt: +wt, path: path.trim().split(/\s+/).map(p => p.split(',').map(Number)), n: [en, hant, toHans(hant), ja] })) : [];
// infra.tsv (optional): major works. Points (dams, power plants, ports, bridges …) get an icon; lines (railways,
// high-speed lines, motorways, roads, canals) are drawn segment by segment as they open, then stay as a faint network.
// kind, id, opened (YYYY-MM), closed (YYYY-MM or blank), geometry ("lon,lat" or "lon,lat lon,lat …"),
// zh-Hant, en, ja, note zh-Hant, note en, note ja, zh Wikipedia title[, en title]. Each work is also an event.
const WORK_POINTS = ['dam', 'hydro', 'power', 'nuclear', 'wind', 'solar', 'bridge', 'port', 'airport', 'tunnel', 'space', 'industry', 'metro', 'water', 'stadium', 'datacenter', 'ixp'];
const WORK_LINES = ['rail', 'hsr', 'highway', 'road', 'canal', 'pipeline', 'fiber', 'cable', 'grid'];
const works = exists('infra.tsv') ? rows('infra.tsv').map(([kind, id, a, b, geom, hant, en, ja, dh = '', de = '', dj = '', wzh = '', wen = '']) => {
  if (!WORK_POINTS.includes(kind) && !WORK_LINES.includes(kind)) throw new Error(`infra.tsv ${id}: unknown kind "${kind}"`);
  // a line may have several parts separated by ";" (branches to landing points); the longest is its main path
  const parts = geom.split(';').map(g => g.trim()).filter(Boolean).map(g => g.split(/\s+/).map(p => p.split(',').map(Number)));
  if (!parts.length || parts.some(pts => pts.some(p => p.length !== 2 || p.some(v => !isFinite(v))))) throw new Error(`infra.tsv ${id}: bad geometry`);
  const line = WORK_LINES.includes(kind);
  if (line && parts.some(pts => pts.length < 2)) throw new Error(`infra.tsv ${id}: a ${kind} needs at least two points`);
  const pts = parts.reduce((x, y) => (y.length > x.length ? y : x));
  const w = { kind, id, a: month(a), b: b ? month(b) : month(cfg.end), n: [en, hant, toHans(hant), ja], note: [de, dh, toHans(dh), dj], w: [wzh, wen, ''] };
  return line ? { ...w, path: pts, ...(parts.length > 1 ? { parts } : {}) } : { ...w, lon: pts[0][0], lat: pts[0][1] };
}) : [];
for (const x of works) {
  const mid = x.path ? x.path[Math.floor(x.path.length / 2)] : [x.lon, x.lat];
  events.push({ m: x.a, n: x.n, lon: mid[0], lat: mid[1], k: x.kind, work: x.id, ...(x.w[0] || x.w[1] ? { w: x.w } : {}) });
}
events.sort((a, b) => a.m - b.m);
const data = { region, merge: !!cfg.merge, start: START, months: month(cfg.end) + 1, factions: factions.list, control: control.out, governments, areas, events, flows, works };
if (cfg.prc) Object.assign(data, { prc: month(cfg.prc), ccp: factions.index.ccp, prcFaction: factions.index.prc });
if (exists('divisions.tsv')) {
  const divisions = table('divisions.tsv');
  data.divisions = divisions.list;
  data.admin = timeline('admin.tsv', divisions).out;
  //   local.tsv (optional) feuds, local powers and US forces, each with its own toggle:
//   kind (feud|power|us), id, from, to, lon, lat, zh-Hant, en, ja, note zh-Hant, note en, note ja, zh Wikipedia title
if (exists('local.tsv')) data.local = rows('local.tsv').map(([kind, id, a, b, lon, lat, hant, en, ja, dh, de, dj, wzh]) => {
  if (!['feud', 'power', 'us'].includes(kind)) throw new Error(`local.tsv ${id}: kind must be feud, power or us`);
  return { kind, id, a: month(a), b: month(b), lon: +lon, lat: +lat, n: [en, hant, toHans(hant), ja], note: [de, dh, toHans(dh), dj], w: [wzh, '', ''] };
});
//   party.tsv (optional) the party of each division's head: division id, from (year-month), party code
if (exists('party.tsv')) {
  data.party = {};
  for (const [div, from, code] of rows('party.tsv')) {
    if (!(div in divisions.index)) throw new Error(`party.tsv: unknown division "${div}"`);
    (data.party[divisions.index[div]] ||= []).push([month(from), code]);
  }
  for (const k in data.party) data.party[k].sort((a, b) => a[0] - b[0]);
}
if (exists('seats.tsv')) data.seats = rows('seats.tsv').map(([id, a, b, lon, lat, div, hant, en, ja, wzh, wen, wja, dh = '', de = '', dj = '']) => {
    if (div && !(div in divisions.index)) throw new Error(`seats.tsv ${id}: unknown division "${div}"`);
    return { id, a: month(a), b: month(b), lon: +lon, lat: +lat, d: div ? divisions.index[div] : -1,
      n: [en, hant, toHans(hant), ja], w: [wzh, wen, wja], note: [de, dh, toHans(dh), dj] };
  });
}
// optional descriptions + Wikipedia articles per faction: w = [zh, en, ja] article titles, d = [en, hant, hans, ja]
if (exists('info.tsv')) {
  for (const [id, wzh, wen, wja, hant, en, ja] of rows('info.tsv')) {
    if (!(id in factions.index)) throw new Error(`info.tsv: unknown id "${id}"`);
    factions.list[factions.index[id]].info = { w: [wzh, wen, wja], d: [en, hant, toHans(hant), ja] };
  }
}
fs.writeFileSync(OUT, JSON.stringify(data));
console.log(`${region}.json:`, factions.list.length, 'factions,', units.length, 'units,', governments.length, 'governments,',
  events.length, 'events', data.divisions ? `, ${data.divisions.length} divisions` : '');
