// public/data/growth.json: for the world mode, how many power plants, airports, ports and submarine cables
// there were each year (shown under the number of countries once a series has started).
//   plants   — gppd_years.tsv (WRI Global Power Plant Database 1.3.0, CC BY 4.0): plants with a known
//              commissioning year, counted from that year on (the database has no retirement dates)
//   airports, ports — airports.tsv, ports.tsv (Wikidata, CC0; fetch-growth.mjs): open between opening and closing
//   cables   — cables.tsv (TeleGeography, CC BY-NC-SA 3.0; fetch-growth.mjs): counted from the ready-for-service year
// A series whose source file is missing is left out.
//   node data-pipeline/growth/build-growth.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
const rows = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t')) : null;
const END = 2026;

// spans [from, to) → count per year, from the first year with at least one
function series(spans) {
  if (!spans.length) return null;
  const y0 = Math.min(...spans.map(s => s[0])), v = new Array(END - y0 + 1).fill(0);
  for (const [a, b] of spans) for (let y = a; y <= END && (b == null || y < b); y++) v[y - y0]++;
  return { y0, v };
}

const out = {};
const g = rows(path.join(HERE, 'gppd_years.tsv'));
if (g) {
  const spans = []; let mw = [];
  for (const [y, n, c] of g) { for (let i = 0; i < +n; i++) spans.push([+y, null]); mw.push([+y, +c]); }
  const s = series(spans);
  const cap = new Array(s.v.length).fill(0);
  for (const [y, c] of mw) for (let i = y - s.y0; i < cap.length; i++) cap[i] += c;
  s.gw = cap.map(c => Math.round(c / 1000));
  s.last = 2020;                                       // the database's newest plants; later years are not counted
  out.plants = s;
}
for (const k of ['airports', 'ports']) {
  const r = rows(path.join(HERE, k + '.tsv'));
  if (r?.length) out[k] = series(r.map(([, o, c]) => [+o, c ? +c : null]));
}
const c = rows(path.join(HERE, 'cables.tsv'));
if (c?.length) out.cables = series(c.filter(([, y]) => +y <= END).map(([, y]) => [+y, null]));

fs.writeFileSync(path.join(ROOT, 'public', 'data', 'growth.json'), JSON.stringify(out));
console.log('growth.json：' + Object.entries(out).map(([k, s]) => `${k} ${s.y0}–${END} (${s.v.at(-1)})`).join('，'));
