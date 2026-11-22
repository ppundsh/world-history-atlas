// Party of each state / province head for the regional modes whose governors are elected (Mexico, Argentina,
// Brazil, Indonesia), from Wikidata (CC0): for every state, the office its head holds (P1313), every holder of
// that office with the term's start (P39 → P580), and the holder's party at that date (the qualifier on the term,
// or the person's party membership P102 valid then).
// Writes data-pipeline/<region>/party.tsv and puts the result into public/data/<region>.json.
//   node data-pipeline/party/fetch-party.mjs [--refresh] [region …]
// One SPARQL request per country (cached in data-pipeline/sources/party/); about four requests in all.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DP = path.join(ROOT, 'data-pipeline'), CACHE = path.join(DP, 'sources', 'party');
const args = process.argv.slice(2), REFRESH = args.includes('--refresh');
const STATES = JSON.parse(fs.readFileSync(path.join(DP, 'party', 'states.json'), 'utf8'));
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; party data build)';
fs.mkdirSync(CACHE, { recursive: true });

// party labels (English, from Wikidata) → colour codes used by the site; first match wins
const MAP = {
  mexico: { from: '1929-03', rules: [[/Institutional Revolutionary|National Revolutionary|Party of the Mexican Revolution/i, 'mx_pri'], [/National Action/i, 'mx_pan'], [/Democratic Revolution/i, 'mx_prd'], [/Morena|National Regeneration/i, 'mx_morena'], [/Ecologist Green/i, 'mx_pvem'], [/Citizens' Movement|Movimiento Ciudadano|Convergence/i, 'mx_mc'], [/Encounter/i, 'mx_pes'], [/Labor Party|Labour Party/i, 'mx_pt'], [/independent/i, 'ind']], other: 'mx_other',
    note: 'mexico' },
  argentina: { from: '1983-12', rules: [[/Justicialist|Peronis|Front for Victory|Citizen's Unity|Union for the Homeland|Frente de Todos/i, 'ar_pj'], [/Radical Civic Union|Radical/i, 'ar_ucr'], [/Republican Proposal|\bPRO\b|Cambiemos|Together for Change/i, 'ar_pro'], [/Liberty Advances|Libertarian/i, 'ar_lla'], [/Neuquén People's Movement|Renewal Front|Fuerza Santacruceña|provincial|Juntos Somos Río Negro|Front for the Renewal|Movimiento Popular|Hacemos/i, 'ar_prov']], other: 'ar_other' },
  brazil: { from: '1983-03', rules: [[/Workers' Party/i, 'br_pt'], [/Brazilian Democratic Movement/i, 'br_mdb'], [/Brazilian Social Democracy/i, 'br_psdb'], [/Liberal Front|Democrats|Brazil Union|União Brasil/i, 'br_dem'], [/Democratic Social Party|National Renewal Alliance/i, 'br_pds'], [/Democratic Labour/i, 'br_pdt'], [/Brazilian Socialist/i, 'br_psb'], [/Progressistas|Progressive Party|Brazilian Progressive|Progressive Reform/i, 'br_pp'], [/Social Democratic Party/i, 'br_psd'], [/Liberal Party|Party of the Republic/i, 'br_pl'], [/Republicanos|Brazilian Republican/i, 'br_rep'], [/Communist Party of Brazil/i, 'br_pcdob']], other: 'br_other' },
  indonesia: { from: '2005-06', rules: [[/Golkar|Functional Groups/i, 'id_golkar'], [/Democratic Party of Struggle/i, 'id_pdip'], [/Democratic Party/i, 'id_demokrat'], [/Gerindra|Great Indonesia Movement/i, 'id_gerindra'], [/Prosperous Justice/i, 'id_pks'], [/National Mandate/i, 'id_pan'], [/National Awakening/i, 'id_pkb'], [/NasDem/i, 'id_nasdem'], [/United Development/i, 'id_ppp'], [/independent/i, 'ind']], other: 'id_other' },
};
const REGIONS = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : Object.keys(MAP);

const query = qids => `SELECT ?state ?person ?start ?qparty ?qpartyLabel ?party ?partyLabel ?pstart ?pend WHERE {
  VALUES ?state { ${qids.map(q => 'wd:' + q).join(' ')} }
  ?state wdt:P1313 ?pos .
  ?person p:P39 ?st . ?st ps:P39 ?pos ; pq:P580 ?start .
  OPTIONAL { ?st pq:P102 ?qparty . }
  OPTIONAL { ?person p:P102 ?ps . ?ps ps:P102 ?party . OPTIONAL { ?ps pq:P580 ?pstart . } OPTIONAL { ?ps pq:P582 ?pend . } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". ?party rdfs:label ?partyLabel . ?qparty rdfs:label ?qpartyLabel . }
}`;

async function sparql(region, qids) {
  const f = path.join(CACHE, region + '.json');
  if (fs.existsSync(f) && !REFRESH) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', signal: AbortSignal.timeout(120000),
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query: query(qids) }) });
      if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 20000 * (i + 1))); continue; }
      if (!r.ok) { console.log(`  Wikidata ${r.status}`); return null; }
      const j = await r.json();
      fs.writeFileSync(f, JSON.stringify(j));
      return j;
    } catch (e) { console.log(`  ${e.name === 'TimeoutError' ? '沒有回應' : '連線失敗'}，重試`); await new Promise(s => setTimeout(s, 10000)); }
  }
  return null;
}

const ym = d => d.slice(0, 7);
for (const region of REGIONS) {
  const cfg = MAP[region], states = STATES[region];
  process.stdout.write(`${region}: Wikidata … `);
  const j = await sparql(region, Object.keys(states));
  if (!j) { console.log('失敗，略過'); continue; }
  // terms: state + person + start → candidate parties
  const terms = new Map();
  for (const b of j.results.bindings) {
    const state = b.state.value.split('/').pop(), start = b.start.value.slice(0, 10);
    const k = state + '|' + b.person.value + '|' + start;
    const t = terms.get(k) || { state, start, q: null, parties: [] };
    if (b.qparty) t.q = b.qpartyLabel?.value;
    if (b.party) t.parties.push({ label: b.partyLabel?.value || '', a: b.pstart?.value?.slice(0, 10) || '', b: b.pend?.value?.slice(0, 10) || '' });
    terms.set(k, t);
  }
  const code = label => { for (const [re, c] of cfg.rules) if (re.test(label)) return c; return cfg.other; };
  const rows = [];
  for (const t of terms.values()) {
    if (t.start < cfg.from + '-01') continue;
    let label = t.q;
    if (!label) {
      const valid = t.parties.filter(p => (!p.a || p.a <= t.start) && (!p.b || p.b >= t.start)).sort((x, y) => (y.a || '').localeCompare(x.a || ''));
      label = (valid[0] || t.parties[0])?.label;
    }
    if (!label) continue;                        // no party known: keep the previous colour
    rows.push([states[t.state], ym(t.start), code(label), label]);
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  const out = rows.filter((r, i) => !(i && rows[i - 1][0] === r[0] && rows[i - 1][2] === r[2]));   // drop repeats of the same party
  fs.writeFileSync(path.join(DP, region, 'party.tsv'),
    `# ${region} 模式「首長政黨」：各州／省首長所屬政黨（由 data-pipeline/party/fetch-party.mjs 自 Wikidata 產生，請勿手改）。欄位：行政區 id\t起(年-月)\t政黨代碼\t（Wikidata 政黨名稱）\n` +
    `# 來源：Wikidata（CC0）各州「政府首長職位」（P1313）的歷任者與其任期開始時的政黨；${cfg.from} 起。代理或過渡首長、沒有政黨資料者沿用前一任顏色。\n` +
    out.map(r => r.join('\t')).join('\n') + '\n');
  // put it into the built data
  const f = path.join(ROOT, 'public', 'data', region + '.json');
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const idx = new Map(d.divisions.map((x, i) => [x.id, i]));
  const month = s => { const [y, m] = s.split('-').map(Number); return (y - d.start[0]) * 12 + (m - d.start[1]); };
  d.party = {};
  for (const [div, from, c] of out) if (idx.has(div)) (d.party[idx.get(div)] ||= []).push([month(from), c]);
  fs.writeFileSync(f, JSON.stringify(d));
  const used = {}; for (const r of out) used[r[2]] = (used[r[2]] || 0) + 1;
  console.log(`${terms.size} 任，寫入 ${out.length} 筆（${Object.entries(used).map(([k, v]) => k + ' ' + v).join('、')}）`);
}
