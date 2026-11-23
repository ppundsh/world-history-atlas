// Figures for the floating-country comparison (modern states only): area is measured on the map; population and
// GDP come from Natural Earth's admin-0 table (public domain; POP_EST / GDP_MD with their years); the number of
// power plants and their total capacity from the WRI Global Power Plant Database 1.3.0 (CC BY 4.0, gppd_counts.tsv).
// Keyed by Wikidata id, as the polities are.
//   node data-pipeline/econ/build-compare.mjs [Natural Earth geojson dir]  →  public/data/compare.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NE = process.argv[2] || path.join(DP, 'sources', 'natural-earth-vector', 'geojson');
const countries = JSON.parse(fs.readFileSync(path.join(NE, 'ne_10m_admin_0_countries.geojson'), 'utf8')).features;
const plants = new Map(fs.readFileSync(path.join(DP, 'econ', 'gppd_counts.tsv'), 'utf8').split('\n')
  .filter(l => l.trim() && !l.startsWith('#')).map(l => { const [iso, n, mw] = l.split('\t'); return [iso, [+n, +mw]]; }));
// Natural Earth gives Taiwan's GDP at purchasing-power parity (2016); use the nominal figure, as for the others:
// 2019 GDP US$611.4 billion (DGBAS, Directorate-General of Budget, Accounting and Statistics, Executive Yuan)
const FIX = { TWN: { gdp: [611396, 2019] } };
const out = {};
for (const f of countries) {
  const p = f.properties, q = p.WIKIDATAID, iso = p.ADM0_A3;
  if (!q || p.TYPE === 'Dependency' || p.TYPE === 'Lease') continue;
  const r = { iso };
  if (p.POP_EST > 0) r.pop = [Math.round(p.POP_EST), p.POP_YEAR];
  if (p.GDP_MD > 0 && p.GDP_YEAR >= 2015) r.gdp = [p.GDP_MD, p.GDP_YEAR];      // million US dollars; older estimates left out
  Object.assign(r, FIX[iso] || {});
  const pl = plants.get(iso); if (pl) r.plants = pl;
  if (r.pop || r.gdp || r.plants) out[q] = r;
}
// polities whose Wikidata id is not the modern country's (Cliopatria names a regime, or an older state that runs on):
// they take the modern country's figures
const ALIAS = { Q188712: 'JPN', Q200686: 'FRA', Q23666: 'GBR', Q824489: 'PRT', Q13474305: 'ESP', Q3359409: 'FSM', Q204989: 'KNA', Q887803: 'BRN' };
const byIso = Object.fromEntries(Object.values(out).map(r => [r.iso, r]));
for (const [q, iso] of Object.entries(ALIAS)) if (byIso[iso] && !out[q]) out[q] = byIso[iso];
fs.writeFileSync(path.join(DP, '..', 'public', 'data', 'compare.json'), JSON.stringify(out));
console.log('compare.json:', Object.keys(out).length, 'countries');
