// Fact check of the site's data against Wikidata: for every entry tied to a Wikidata item (wikilinks.json), compare
// its year with the item's own dates (point in time P585, start P580, inception P571, opening P1619, end P582 /
// dissolved P576) and its map position with the item's coordinates (P625). The data was written by hand from memory;
// Wikidata's statements usually come from the articles in the local language, so a disagreement is worth a look.
// It only reports: data-pipeline/audit/facts.tsv lists each disagreement with links to the local-language and
// English articles, newest kind first. Nothing in the data is changed.
// Requests: Wikidata Query Service, 200 items a query (about 12), one at a time; cached in
// data-pipeline/sources/wikilinks/facts.json (--refresh starts over).
//   node data-pipeline/wiki/verify-facts.mjs [--refresh] [--years 2] [--km 150]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { walkW, dataFiles, nameOf } from './collect.mjs';
import { line } from '../lib/progress.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = path.join(ROOT, 'data-pipeline', 'sources', 'wikilinks');
const args = process.argv.slice(2), REFRESH = args.includes('--refresh');
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? +args[i + 1] : d; };
const YEARS = opt('--years', 2), KM = opt('--km', 150);
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; fact check)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data-pipeline', 'wiki', 'wikilinks.json'), 'utf8'));

// ---- entries with a time and/or a place
// roads, railways, canals, cables: Wikidata's one point can be anywhere along them, so their place is not compared
const LINEAR = new Set(['rail', 'hsr', 'highway', 'road', 'canal', 'pipeline', 'cable', 'fiber', 'metro', 'grid', 'tunnel', 'bridge']);
const qOf = (x, name) => {
  const w = Array.isArray(x.w) ? x.w : ['', x.w, ''];
  if (WL.by['name:' + name]) return WL.by['name:' + name];
  for (const [i, l] of ['zh', 'en', 'ja'].entries()) if (w[i] && WL.by[`${l}:${w[i]}`]) return WL.by[`${l}:${w[i]}`];
  return null;
};
const rows = [];
for (const { p, region } of dataFiles(ROOT)) {
  let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
  const start = Array.isArray(j.start) ? j.start : null;                       // region modes count time in months
  const mYear = m => start ? +(start[0] + (start[1] - 1 + m) / 12).toFixed(2) : null;
  const file = path.relative(ROOT, p).replace(/\\/g, '/');
  walkW(j, x => {
    const name = nameOf(x), q = qOf(x, name); if (!q) return;
    let y = null;
    if (typeof x.k?.date === 'string') y = +x.k.date.slice(0, x.k.date.indexOf('-', 1) > 0 ? x.k.date.indexOf('-', 1) : undefined);
    else if (typeof x.y === 'number') y = x.y;
    else if (typeof x.m === 'number' && start) y = mYear(x.m);
    else if (typeof x.a === 'number') y = start ? mYear(x.a) : x.a;
    const end = typeof x.b === 'number' ? (start ? mYear(x.b) : x.b) : null;
    rows.push({ file, region, name, q, y, end, lon: x.lon, lat: x.lat, rx: x.rx, line: LINEAR.has(x.k) || LINEAR.has(x.kind) || !!x.work || !!x.path, nat: Array.isArray(x.w) ? x.w[3] || '' : '' });
  });
}
const gen = await import(pathToFileURL(path.join(ROOT, 'src', 'worldEvents.gen.js')).href);
const fromGen = (list, file) => walkW(list, x => { const name = nameOf(x), q = qOf(x, name); if (q) rows.push({ file, region: null, name, q, y: x.y ?? null, end: null, lon: x.lon, lat: x.lat, nat: Array.isArray(x.w) ? x.w[3] || '' : '' }); });
fromGen(gen.WORLD_EVENTS || [], 'worldEvents');
for (const [k, v] of Object.entries(gen.MODE_EVENTS || {})) fromGen(v, 'worldEvents#' + k);
console.log(`有 Wikidata 項目的資料 ${rows.length} 筆`);

// ---- Wikidata dates and coordinates, 200 items a query
const factsFile = path.join(CACHE, 'facts.json');
const facts = !REFRESH && fs.existsSync(factsFile) ? JSON.parse(fs.readFileSync(factsFile, 'utf8')) : {};
const todo = [...new Set(rows.map(r => r.q))].filter(q => !(q in facts));
const PROPS = { P585: 'at', P580: 'start', P571: 'start', P1619: 'start', P582: 'end', P576: 'end' };
for (let i = 0; i < todo.length; i += 200) {
  const batch = todo.slice(i, i + 200);
  line(`  Wikidata 日期與座標 ${Math.min(i + 200, todo.length)}/${todo.length}`);
  const query = `SELECT ?item ?p ?t ?c WHERE { VALUES ?item { ${batch.map(q => 'wd:' + q).join(' ')} }
    { VALUES ?p { ${Object.keys(PROPS).map(p => 'wdt:' + p).join(' ')} } ?item ?p ?t. } UNION { ?item wdt:P625 ?c. } }`;
  let j;
  for (let k = 0; k < 6 && !j; k++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', signal: AbortSignal.timeout(90000),
        headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: new URLSearchParams({ query }) });
      if (r.status === 429 || r.status >= 500) { await sleep(15000 * (k + 1)); continue; }
      j = await r.json();
    } catch (e) { if (k === 5) throw e; await sleep(10000); }
  }
  for (const q of batch) facts[q] = {};
  for (const b of j.results.bindings) {
    const q = b.item.value.split('/').pop(), f = facts[q];
    if (b.c) { const m = b.c.value.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/); if (m) (f.c ||= []).push([+m[1], +m[2]]); continue; }
    const key = PROPS[b.p.value.split('/').pop()], v = b.t?.value || '';
    const m = v.match(/^([+-]?\d+)-/); if (!m) continue;
    let yr = +m[1]; if (yr <= 0 && v.startsWith('-')) yr = yr + 1;              // Wikidata: year 0 = 1 BCE
    (f[key] ||= []).push(yr);
  }
  fs.writeFileSync(factsFile, JSON.stringify(facts));
  await sleep(2000);
}
if (todo.length) process.stdout.write('\n');

// ---- entries already checked by hand and found right (data-pipeline/audit/facts_reviewed.tsv: name, kind, reason)
const RV = path.join(ROOT, 'data-pipeline', 'audit', 'facts_reviewed.tsv'), reviewed = new Set();
if (fs.existsSync(RV)) for (const l of fs.readFileSync(RV, 'utf8').split('\n')) { if (!l.trim() || l.startsWith('#')) continue; const [n, k] = l.split('\t'); reviewed.add(n + '|' + (k || '').trim()); }
let skipped = 0;

// ---- compare
const km = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const out = [], per = {};
for (const r of rows) {
  const f = facts[r.q] || {}, g = r.region || r.file.replace(/^public\/data\//, '').replace(/\.json$/, '');
  const c = per[g] ||= { checked: 0, year: 0, place: 0 };
  let checked = false;
  const wy = [...(f.at || []), ...(f.start || [])];
  if (r.y != null && wy.length) {
    checked = true;
    const d = Math.min(...wy.map(v => Math.abs(v - Math.floor(r.y))));
    // a span in our data (a–b) also agrees when Wikidata's date falls inside it
    const inside = r.end != null && wy.some(v => v >= Math.floor(r.y) - YEARS && v <= Math.ceil(r.end) + YEARS);
    // an event during something that lasted (a state, a war, a period): its year falls within the item's own start–end
    const s0 = f.start?.length ? Math.min(...f.start) : null, e0 = f.end?.length ? Math.max(...f.end) : null;
    const during = s0 != null && e0 != null && r.y >= s0 - YEARS && r.y <= e0 + YEARS;
    if (d > YEARS && !inside && !during) {
      // how likely it is wrong: a dated event (P585) that disagrees, or a year before the item began or after it ended,
      // is probably an error; a year after the item began (a dam opened after building started, a port in an older
      // city, an event linked to a broader topic) is usually not
      const y0 = Math.floor(r.y), atBad = f.at?.length && Math.min(...f.at.map(v => Math.abs(v - y0))) > YEARS;
      const high = atBad || (s0 != null && y0 < s0 - YEARS) || (e0 != null && y0 > e0 + YEARS) || (s0 == null && e0 == null);
      out.push({ level: high ? '高' : '低', kind: '年代', g, name: r.name, ours: String(Math.floor(r.y)) + (r.end != null ? '–' + Math.floor(r.end) : ''), wd: [...new Set(wy)].sort((a, b) => a - b).join('、'), diff: d, q: r.q, nat: r.nat, file: r.file }); }
  }
  if (r.lon != null && f.c?.length && !r.line) {
    checked = true;
    const d = Math.min(...f.c.map(p => km([r.lon, r.lat], p)));
    const lim = Math.max(KM, (r.rx || 0) * 111);                                 // an area: its own half-width
    if (d > lim) { out.push({ level: d > 1000 ? '高' : '低', kind: '位置', g, name: r.name, ours: `${r.lon.toFixed(2)}, ${r.lat.toFixed(2)}`, wd: f.c.map(p => p.map(v => v.toFixed(2)).join(', ')).join(' ／ '), diff: Math.round(d), q: r.q, nat: r.nat, file: r.file }); }
  }
  if (checked) c.checked++;
}
const link = t => { if (!t) return ''; const i = t.indexOf(':'); return `https://${t.slice(0, i)}.wikipedia.org/wiki/${encodeURIComponent(t.slice(i + 1).replace(/ /g, '_'))}`; };
{ const before = out.length; for (let i = out.length - 1; i >= 0; i--) if (reviewed.has(out[i].name + '|' + out[i].kind)) out.splice(i, 1); skipped = before - out.length; }
{ const seen = new Set(); for (let i = out.length - 1; i >= 0; i--) { const k = [out[i].kind, out[i].g, out[i].name, out[i].ours].join('|'); if (seen.has(k)) out.splice(i, 1); else seen.add(k); } }
for (const o of out) { per[o.g][o.kind === '年代' ? 'year' : 'place']++; if (o.level === '高') per[o.g].high = (per[o.g].high || 0) + 1; }
out.sort((a, b) => (a.level === '高' ? 0 : 1) - (b.level === '高' ? 0 : 1) || a.g.localeCompare(b.g) || a.kind.localeCompare(b.kind) || b.diff - a.diff);
fs.mkdirSync(path.join(ROOT, 'data-pipeline', 'audit'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data-pipeline', 'audit', 'facts.tsv'),
  `# 資料與 Wikidata 不一致（年代差 ${YEARS} 年以上、位置差 ${KM} 公里以上）：以當地語言條目查證後修正資料，或確認資料指的是不同的事\n` +
  '# 可能性\t種類\t模式\t資料\t我們的\tWikidata\t差距（年／公里）\tWikidata 項目\t當地語言條目\t檔案\n' +
  out.map(o => [o.level, o.kind, o.g, o.name, o.ours, o.wd, o.diff, 'https://www.wikidata.org/wiki/' + o.q, link(o.nat), o.file].join('\t')).join('\n') + '\n');
fs.writeFileSync(path.join(ROOT, 'data-pipeline', 'audit', 'facts_summary.json'), JSON.stringify({ made: new Date().toISOString().slice(0, 10), years: YEARS, km: KM, per }));
const tot = Object.values(per).reduce((a, c) => ({ checked: a.checked + c.checked, year: a.year + c.year, place: a.place + c.place, high: a.high + (c.high || 0) }), { checked: 0, year: 0, place: 0, high: 0 });
console.log(`事實查核：比對 ${tot.checked} 筆，年代不一致 ${tot.year} 筆、位置不一致 ${tot.place} 筆；其中 ${tot.high} 筆很可能有錯，另 ${skipped} 筆已人工確認無誤（data-pipeline/audit/facts.tsv，依可能性排序）`);
