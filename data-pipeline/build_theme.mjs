// Thematic world modes (language, finance): data-pipeline/<mode>/ families.tsv, areas.tsv, points.tsv, flows.tsv
// [, events.tsv] → public/data/<mode>.json.   node data-pipeline/build_theme.mjs <mode>
// Names are [en, zh-Hant, zh-Hans, ja] like the other modes; zh-Hans is converted from zh-Hant with OpenCC.
import fs from 'node:fs';
import path from 'node:path';
import * as OpenCC from 'opencc-js';
const mode = process.argv[2];
if (!mode) throw new Error('usage: node build_theme.mjs <mode>');
const here = path.join(path.dirname(new URL(import.meta.url).pathname), mode);
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });
const rows = (f, n, m = n) => fs.readFileSync(path.join(here, f), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map((l, i) => {
  const c = l.split('\t'); if (c.length < n || c.length > m) throw new Error(`${f} line ${i}: ${c.length} columns, expected ${n}`); return c;
});
const fam = rows('families.tsv', 5).map(([id, color, hant, en, ja]) => ({ id, color, n: [en, hant, toHans(hant), ja] }));
const ids = new Set(fam.map(f => f.id));
const check = (f, where) => { if (!ids.has(f)) throw new Error(`${where}: unknown family ${f}`); return f; };
const areas = rows('areas.tsv', 15).map(([id, f, a, b, lon, lat, rx, ry, hant, en, ja, dh, de, wzh, wen]) => ({
  id, f: check(f, id), a: +a, b: +b, lon: +lon, lat: +lat, rx: +rx, ry: +ry, n: [en, hant, toHans(hant), ja], d: [de, dh, toHans(dh), de], w: [wzh, wen, ''] }));
const points = rows('points.tsv', 13).map(([id, f, a, b, lon, lat, hant, en, ja, dh, de, wzh, wen]) => ({
  id, f: check(f, id), a: +a, b: +b, lon: +lon, lat: +lat, n: [en, hant, toHans(hant), ja], d: [de, dh, toHans(dh), de], w: [wzh, wen, ''] }));
// an optional 13th column gives a route (lon,lat lon,lat …); in the Internet mode a flow is a cable: drawn over
// a year (g), in service until it is retired (b), then gone
// the route may hold several parts separated by ";" (branches to landing points); the longest is the main path.
// Columns 14–16 (optional): length, operators, landing points, shown on the cable's card.
const parsePts = s => s.trim().split(/\s+/).map(p => p.split(',').map(Number));
const flows = rows('flows.tsv', 12, 16).map(([id, f, a, b, x0, y0, x1, y1, wt, hant, en, ja, route = '', len = '', own = '', land = '']) => {
  const parts = route.trim() ? route.split(';').map(s => s.trim()).filter(Boolean).map(parsePts) : [];
  if (parts.some(p => p.length < 2 || p.some(q => q.length !== 2 || q.some(v => !isFinite(v))))) throw new Error(`flows.tsv ${id}: bad route`);
  const main = parts.length ? parts.reduce((x, y) => (y.length > x.length ? y : x)) : null;
  return { id, f: check(f, id), a: +a, b: +b, from: [+x0, +y0], to: [+x1, +y1], wt: +wt, n: [en, hant, toHans(hant), ja],
    ...(main ? { path: main } : {}), ...(parts.length > 1 ? { parts } : {}), ...(mode === 'internet' ? { g: 1 } : {}),
    ...(len || own || land ? { info: { len, own: own ? own.split('/') : [], land: land ? land.split('/') : [] } } : {}) };
});
// the mode's own timeline (otherwise the world events are used): year, place, names, note, Wikipedia
const events = fs.existsSync(path.join(here, 'events.tsv')) ? rows('events.tsv', 10).map(([y, lon, lat, hant, en, ja, dh, de, wzh, wen]) => ({
  y: +y, lon: +lon, lat: +lat, n: [en, hant, toHans(hant), ja], d: [de, dh, toHans(dh), de], w: [wzh, wen, ''] })).sort((a, b) => a.y - b.y) : null;
// quick views ("focus" menu): place, zoom, year and name
const focus = fs.existsSync(path.join(here, 'focus.tsv')) ? rows('focus.tsv', 8).map(([id, lon, lat, k, y, hant, en, ja]) => ({ id, lon: +lon, lat: +lat, k: +k, y: +y, n: [en, hant, toHans(hant), ja] })) : null;
fs.writeFileSync(path.join(here, '..', '..', 'public', 'data', mode + '.json'), JSON.stringify({ families: fam, areas, points, flows, ...(events ? { events } : {}), ...(focus ? { focus } : {}), ...(mode === 'finance' ? { areaPictures: true } : {}) }));
console.log(mode + '.json:', fam.length, 'families,', areas.length, 'areas,', points.length, 'points,', flows.length, 'flows', events ? ', ' + events.length + ' events' : '');
