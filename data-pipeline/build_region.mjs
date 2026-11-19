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
//   events.tsv         YYYY-MM, zh-Hant, en, ja
//   ccp_areas.tsv      (optional) id, from, to, lon, lat, rx, ry, zh-Hant, zh-Hans, en, ja
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
const START = cfg.start.split('-').map(Number);
const month = s => { const [y, m] = s.split('-').map(Number); return (y - START[0]) * 12 + (m - START[1]); };
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
const events = rows('events.tsv').map(([m, hant, en, ja]) => ({ m: month(m), n: [en, hant, toHans(hant), ja] }));

const data = { region, merge: !!cfg.merge, start: START, months: month(cfg.end) + 1, factions: factions.list, control: control.out, governments, areas, events };
if (cfg.prc) Object.assign(data, { prc: month(cfg.prc), ccp: factions.index.ccp, prcFaction: factions.index.prc });
if (exists('divisions.tsv')) {
  const divisions = table('divisions.tsv');
  data.divisions = divisions.list;
  data.admin = timeline('admin.tsv', divisions).out;
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
