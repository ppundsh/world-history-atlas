// Power plants from OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0), to add what the WRI database lacks
// (it misses many plants in some countries, and has no commissioning year for others).
// For each country of the country modes: every power=plant (node, way or relation) from the Overpass API, one
// request per country, cached in data-pipeline/sources/osm-plants/<ISO>.json (not committed), reduced to
// data-pipeline/econ/osm_plants.tsv (committed): plants of 1 MW or more, or of unknown size if thermal, nuclear,
// hydro or geothermal. build-econ.mjs merges them with the WRI list.
//   node data-pipeline/econ/fetch-osm-plants.mjs [--refresh] [ISO …]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), DP = path.resolve(here, '..');
const CACHE = path.join(DP, 'sources', 'osm-plants');
const args = process.argv.slice(2), REFRESH = args.includes('--refresh');
const ISO = ['TW', 'CN', 'JP', 'KR', 'KP', 'VN', 'TH', 'ID', 'PH', 'IN', 'IR', 'TR', 'EG', 'MA', 'RU', 'PL', 'DE', 'FR', 'GB', 'ES', 'IT', 'US', 'MX', 'BR', 'AR'];
const want = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : ISO;
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; power plant layer)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(CACHE, { recursive: true });

// OSM plant:source → the fuels of build-econ.mjs
const FUEL = { coal: 'Coal', lignite: 'Coal', gas: 'Gas', 'natural_gas': 'Gas', oil: 'Oil', diesel: 'Oil', nuclear: 'Nuclear', hydro: 'Hydro', water: 'Hydro',
  wind: 'Wind', solar: 'Solar', biomass: 'Biomass', biogas: 'Biomass', biofuel: 'Biomass', wood: 'Biomass', geothermal: 'Geothermal', waste: 'Waste',
  battery: 'Storage', tidal: 'Wave and Tidal', wave: 'Wave and Tidal' };
const BIG = new Set(['Coal', 'Gas', 'Oil', 'Nuclear', 'Hydro', 'Geothermal']);

async function query(iso) {
  const f = path.join(CACHE, iso + '.json');
  if (!REFRESH && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const q = `[out:json][timeout:900];area["ISO3166-1"="${iso}"][admin_level=2]->.a;nwr["power"="plant"](area.a);out center tags;`;
  for (let i = 0; i < 6; i++) {
    const url = OVERPASS[i % OVERPASS.length];
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(1000 * 1000) });
      if (r.ok) { const j = await r.json(); fs.writeFileSync(f, JSON.stringify(j)); return j; }
      process.stdout.write(`\n  ${new URL(url).host} 回應 ${r.status}，稍後重試`);
    } catch (e) { process.stdout.write(`\n  ${new URL(url).host} ${e.name === 'TimeoutError' ? '逾時' : '連線失敗'}，稍後重試`); }
    await sleep(20000 * (i + 1));
  }
  return null;
}
// "1200 MW", "1.2 GW", "800 kW", "yes" → MW (or null)
export function mw(v) {
  if (!v) return null;
  const m = String(v).replace(',', '.').match(/([\d.]+)\s*(gw|mw|kw|w)?/i); if (!m) return null;
  const x = parseFloat(m[1]), u = (m[2] || 'mw').toLowerCase();
  return u === 'gw' ? x * 1000 : u === 'kw' ? x / 1000 : u === 'w' ? x / 1e6 : x;
}
export function reduce(iso, j) {
  const out = [];
  for (const e of j.elements || []) {
    const t = e.tags || {}, lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon; if (lat == null) continue;
    const src = String(t['plant:source'] || t['generator:source'] || '').split(';')[0].trim().toLowerCase();
    const fuel = FUEL[src] || 'Other';
    const cap = mw(t['plant:output:electricity'] || t['generator:output:electricity']);
    if (cap != null ? cap < 1 : !BIG.has(fuel)) continue;
    const name = t['name:en'] || t.name || t['name:zh'] || ''; if (!name) continue;
    const year = (t.start_date || t['start_date:operation'] || '').match(/^(\d{4})/)?.[1] || '';
    out.push([iso, name, `${e.type[0]}${e.id}`, cap != null ? +cap.toFixed(1) : '', (+lat).toFixed(4), (+lon).toFixed(4), fuel, year, t.operator || '', t.wikidata || '', t.name && t.name !== name ? t.name : ''].map(v => String(v).replace(/[\t\n]/g, ' ')).join('\t'));
  }
  return out;
}
if (import.meta.url === 'file://' + process.argv[1] || process.argv[1]?.endsWith('fetch-osm-plants.mjs')) {
  const file = path.join(here, 'osm_plants.tsv');
  const keep = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(l => l && !l.startsWith('#') && !want.includes(l.split('\t')[0])) : [];
  const lines = [...keep];
  for (const iso of want) {
    process.stdout.write(`\r發電廠（OpenStreetMap）：${iso}      `);
    const j = await query(iso); if (!j) { process.stdout.write(`\n  ${iso} 取得失敗，下次再試`); continue; }
    lines.push(...reduce(iso, j));
    await sleep(3000);
  }
  fs.writeFileSync(file, '# Power plants from OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0), made by fetch-osm-plants.mjs\n# iso\tname\tosm id\tMW\tlat\tlon\tfuel\tyear\toperator\twikidata\tlocal name\n' + lines.join('\n') + '\n');
  console.log(`\n完成：${lines.length} 座`);
}
