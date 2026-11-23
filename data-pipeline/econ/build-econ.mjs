// Two map layers for every country mode, each with its own switch (標記 menu):
//   power plants — the WRI Global Power Plant Database 1.3.0 (CC BY 4.0), reduced in gppd.tsv to the countries of
//                  the country modes: name, fuel, capacity, owner, year of commissioning, source;
//   special zones — industrial parks, export-processing zones, special economic zones, free-trade zones and
//                  financial or business districts that a government set up and that worked, from
//                  data-pipeline/<region>/zones.tsv (hand-made from Wikipedia and official sources).
// Writes public/data/econ/<region>.json, loaded only when one of the two switches is on.
//   node data-pipeline/econ/build-econ.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';

const here = path.dirname(fileURLToPath(import.meta.url)), DP = path.resolve(here, '..'), OUT = path.resolve(DP, '..', 'public', 'data', 'econ');
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });
// which countries' plants each mode shows (the Republic of China mode shows those of China it lived to see)
const COUNTRIES = { taiwan: ['TWN'], china: ['CHN'], prc: ['CHN'], japan: ['JPN'], korea: ['KOR', 'PRK'], vietnam: ['VNM'], thailand: ['THA'], indonesia: ['IDN'],
  philippines: ['PHL'], india: ['IND'], iran: ['IRN'], turkey: ['TUR'], egypt: ['EGY'], morocco: ['MAR'], russia: ['RUS'], poland: ['POL'], germany: ['DEU'], france: ['FRA'],
  uk: ['GBR'], spain: ['ESP'], italy: ['ITA'], usa: ['USA'], mexico: ['MEX'], brazil: ['BRA'], argentina: ['ARG'] };
export const FUELS = ['Coal', 'Gas', 'Oil', 'Nuclear', 'Hydro', 'Wind', 'Solar', 'Biomass', 'Geothermal', 'Waste', 'Storage', 'Cogeneration', 'Petcoke', 'Wave and Tidal', 'Other'];
const ZONE_KINDS = ['epz', 'sez', 'ftz', 'park', 'sci', 'fin', 'biz'];

const rows = f => fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => l.split('\t'));
const byCountry = {}, srcUrl = {};
for (const [c, name, id, mw, lat, lon, fuel, other, year, owner, source, url, ydata] of rows(path.join(here, 'gppd.tsv'))) {
  if (c === 'country') continue;
  const f = FUELS.indexOf(fuel); if (f < 0) throw new Error(`gppd.tsv ${id}: fuel ${fuel}`);
  const y = parseFloat(year);
  if (+mw < 1) continue;                               // under 1 MW: rooftop-size, left out
  (byCountry[c] ||= []).push({ n: name, f, mw: +(+mw).toFixed(1), x: +(+lon).toFixed(4), y: +(+lat).toFixed(4),
    // commissioning year when the database has it, else the year of its capacity data (shown from then on)
    a: isFinite(y) ? Math.floor(y) : +(ydata || 2019), k: isFinite(y) ? 1 : 0,
    ...(other ? { of: other.split('/').map(o => FUELS.indexOf(o)).filter(i => i >= 0) } : {}),
    ...(owner ? { o: owner } : {}), s: source, ...(url ? { u: url } : {}) });
  srcUrl[source] ||= url;
}
// OpenStreetMap plants (fetch-osm-plants.mjs): a plant within 3 km of one of the WRI list with the same fuel is that
// one (its commissioning year fills a missing one); the others are added
const ISO3 = { TW: 'TWN', CN: 'CHN', JP: 'JPN', KR: 'KOR', KP: 'PRK', VN: 'VNM', TH: 'THA', ID: 'IDN', PH: 'PHL', IN: 'IND', IR: 'IRN', TR: 'TUR', EG: 'EGY', MA: 'MAR', RU: 'RUS', PL: 'POL', DE: 'DEU', FR: 'FRA', GB: 'GBR', ES: 'ESP', IT: 'ITA', US: 'USA', MX: 'MEX', BR: 'BRA', AR: 'ARG' };
const osmFile = path.join(here, 'osm_plants.tsv');
let osmAdded = 0;
if (fs.existsSync(osmFile)) {
  const near = (p, x, y) => Math.abs(p.y - y) < 0.03 && Math.abs(p.x - x) < 0.03 / Math.max(0.2, Math.cos(y * Math.PI / 180));
  for (const [iso, name, oid, mwv, lat, lon, fuel, year, op, wd, local] of rows(osmFile)) {
    const c = ISO3[iso]; if (!c) continue;
    const list = (byCountry[c] ||= []), f = FUELS.indexOf(fuel) < 0 ? FUELS.indexOf('Other') : FUELS.indexOf(fuel), x = +(+lon).toFixed(4), y = +(+lat).toFixed(4);
    const same = list.find(p => p.f === f && near(p, x, y));
    if (same) { if (!same.k && year) { same.a = +year; same.k = 1; } continue; }
    const kind = { n: 'node', w: 'way', r: 'relation' }[oid[0]];
    list.push({ n: name + (local ? `（${local}）` : ''), f, mw: mwv ? +mwv : 0, ...(mwv ? {} : { mu: 1 }), x, y, a: year ? +year : 2024, k: year ? 1 : 0,
      ...(op ? { o: op } : {}), s: 'OpenStreetMap', u: `https://www.openstreetmap.org/${kind}/${oid.slice(1)}` });
    srcUrl.OpenStreetMap ||= 'https://www.openstreetmap.org/';
    osmAdded++;
  }
}
fs.mkdirSync(OUT, { recursive: true });
const ym = s => { const m = String(s).match(/^(-?\d+)(?:-(\d+))?$/); if (!m) throw new Error('bad date ' + s); return +m[1] + ((+m[2] || 1) - 1) / 12; };
// plants closed after the WRI snapshot (retired.tsv): their last month, so they leave the map
const retired = new Map(fs.readFileSync(path.join(DP, 'econ', 'retired.tsv'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
  .map(l => { const [iso, name, b] = l.split('\t'); return [iso + '|' + name, b]; }));
for (const [iso, list] of Object.entries(byCountry)) for (const p of list) {
  const b = retired.get(iso + '|' + p.n); if (b) p.b = ym(b);
}
for (const [region, cs] of Object.entries(COUNTRIES)) {
  // China (Republic) mode: only plants known to have been built before 1950 belong to the Republic's China;
  // plants without a known commissioning year are counted with the modern country (the PRC mode), not here
  const plants = cs.flatMap(c => byCountry[c] || []).filter(p => region !== 'china' || (p.k && p.a <= 1949)).sort((a, b) => b.mw - a.mw);
  const sources = {};
  for (const p of plants) { if (p.u && p.u === srcUrl[p.s]) delete p.u; sources[p.s] = srcUrl[p.s] || ''; }
  const zf = path.join(DP, region, 'zones.tsv');
  const zones = fs.existsSync(zf) ? rows(zf).map(([kind, id, a, b, lon, lat, hant, en, ja, dh = '', de = '', dj = '', wzh = '', wen = '', key = '']) => {
    if (!ZONE_KINDS.includes(kind)) throw new Error(`${region}/zones.tsv ${id}: kind ${kind}`);
    if (!isFinite(+lon) || !isFinite(+lat)) throw new Error(`${region}/zones.tsv ${id}: place`);
    return { kind, id, a: ym(a), b: b ? ym(b) : 9999, x: +lon, y: +lat, n: [en, hant, toHans(hant), ja], d: [de, dh, toHans(dh), dj], w: [wzh, wen], ...(key === '1' ? { key: 1 } : {}) };
  }) : [];
  fs.writeFileSync(path.join(OUT, region + '.json'), JSON.stringify({ plants, sources, zones }));
  if (region === 'taiwan') console.log('OpenStreetMap 補充', osmAdded, '座');
  console.log(region.padEnd(12), String(plants.length).padStart(5), 'plants', String(zones.length).padStart(3), 'zones');
}
