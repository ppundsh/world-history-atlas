// Wikipedia articles by Wikidata item, in Chinese, English, Japanese and the local language.
// Every entry of the site's data carries "w": its articles [zh, en, ja], written by hand and so sometimes wrong
// (data-pipeline/audit/wiki_check.tsv lists the ones that do not exist). This script ties each entry to its
// Wikidata item through whichever of its titles exists (English first), then takes the item's own sitelinks:
// the right article in each language, and also the article in the local language — the one usually written
// with the most material and pictures. apply-wiki.mjs then rewrites the built data with them.
//   local language: in a country mode, that country's languages; elsewhere, the languages of the item's country
//   (P17, or P495 country of origin). Of several, the longest article is taken.
// Requests, one at a time with a pause: about 90 to the Wikipedia APIs (50 titles each), about 12 to the Wikidata
// Query Service (300 items each), about 70 to the Wikidata API (sitelinks of 50 items), a few for article lengths.
// Cached in data-pipeline/sources/wikilinks/ (--refresh starts over). Writes data-pipeline/wiki/wikilinks.json and
// data-pipeline/wiki/unresolved.tsv (entries none of whose titles exist: to be checked by hand).
//   node data-pipeline/wiki/fetch-wikilinks.mjs [--refresh] [--delay 1000]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANG_OF_REGION, LANG_OF_COUNTRY } from './languages.mjs';
import { collect, walkUnlinked, dataFiles, nameOf } from './collect.mjs';

import { line } from '../lib/progress.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = path.join(ROOT, 'data-pipeline', 'sources', 'wikilinks');
const OUT = path.join(ROOT, 'data-pipeline', 'wiki');
const args = process.argv.slice(2), REFRESH = args.includes('--refresh');
const DELAY = Math.max(500, +(args[args.indexOf('--delay') + 1] || 1000) || 1000);
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; article links)';
const L3 = ['zh', 'en', 'ja'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(CACHE, { recursive: true });
const cached = (name, def) => { const f = path.join(CACHE, name); return !REFRESH && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : def; };
const save = (name, v) => fs.writeFileSync(path.join(CACHE, name), JSON.stringify(v));

// ---- the entries: every "w" in the built data, with the country mode it belongs to (if any)
const entries = await collect(ROOT);
console.log(`條目 ${entries.length} 筆`);

// ---- HTTP
async function call(url, init = {}) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(90000), headers: { 'User-Agent': UA, 'Api-User-Agent': UA, ...(init.headers || {}) } });
      if (r.status === 429 || r.status >= 500) { await sleep(15000 * (i + 1)); continue; }
      const j = await r.json();
      // Wikidata lagging behind (maxlag): wait as long as it asks (at least 30 s, longer each time) before trying again
      if (j.error?.code === 'maxlag') { await sleep(Math.max(+(r.headers.get('retry-after') || 0) * 1000, 30000 * (i + 1))); continue; }
      if (j.error) throw new Error(j.error.info || j.error.code);
      return j;
    } catch (e) { if (i === 5) throw e; await sleep(10000); }
  }
  // still busy after six tries (429 / 5xx / maxlag): stop with a clear message; the next run continues from the cache
  throw new Error(`維基伺服器忙碌，重試 6 次仍未回應（${new URL(url).host}）；稍後再執行一次即可從中斷處繼續`);
}
const post = (host, params) => call(`https://${host}/w/api.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params }) });

// ---- 1. title → Wikidata item, per language
const qOf = cached('titles.json', { zh: {}, en: {}, ja: {} });
for (const l of L3) {
  const todo = [...new Set(entries.flatMap(e => e.w[L3.indexOf(l)] ? [e.w[L3.indexOf(l)]] : []))].filter(t => !(t in qOf[l]));
  if (todo.length) console.log(`${l}：查 ${todo.length} 個條目的 Wikidata 項目`);
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const j = await post(`${l}.wikipedia.org`, { action: 'query', titles: batch.join('|'), redirects: '1', prop: 'pageprops', ppprop: 'wikibase_item|disambiguation', ...(l === 'zh' ? { converttitles: '1' } : {}) });
    const q = j.query || {}, step = new Map();
    for (const k of ['normalized', 'converted', 'redirects']) for (const x of q[k] || []) step.set(x.from, x.to);
    const pages = new Map((q.pages || []).map(p => [p.title, p]));
    for (const t of batch) {
      let cur = t; for (let n = 0; n < 4 && step.has(cur); n++) cur = step.get(cur);
      const p = pages.get(cur);
      qOf[l][t] = !p || p.missing || p.invalid ? '' : p.pageprops && 'disambiguation' in p.pageprops ? '!disambig' : p.pageprops?.wikibase_item || '';
    }
    save('titles.json', qOf);
    line(`  ${Math.min(i + 50, todo.length)}/${todo.length}`); await sleep(DELAY);
  }
  if (todo.length) console.log();
}

// ---- hand-checked items (manual.tsv): an entry, by its name or one of its titles ("en:Title"), → Wikidata item;
// these win over the titles
// The value is a Wikidata item (Q…), an article "lang:Title" in any language (resolved to its item here), or
// "src:https://…" for an entry that has no Wikipedia article: a news or official source shown instead.
const manual = new Map(), srcOf = {};
const MF = path.join(OUT, 'manual.tsv');
const manTitles = {};                                          // lang → titles to resolve
if (fs.existsSync(MF)) for (const l of fs.readFileSync(MF, 'utf8').split('\n')) {
  if (!l.trim() || l.startsWith('#')) continue;
  const [key, v0] = l.split('\t'), v = (v0 || '').trim(); if (!key || !v) continue;
  if (/^Q\d+$/.test(v)) manual.set(key.trim(), v);
  else if (v.startsWith('src:')) srcOf[key.trim()] = v.slice(4);
  else { const m = /^([a-z][a-z-]*):(.+)$/.exec(v); if (m) { manual.set(key.trim(), v); (manTitles[m[1]] ??= new Set()).add(m[2]); } }
}
const manQ = cached('manual_titles.json', {}), manWhy = {};
for (const [l, set] of Object.entries(manTitles)) {
  manQ[l] ??= {};
  const todo = [...set].filter(t => !manQ[l][t])  // not found last time: ask again;
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const j = await post(`${l}.wikipedia.org`, { action: 'query', titles: batch.join('|'), redirects: '1', prop: 'pageprops', ppprop: 'wikibase_item|disambiguation', ...(l === 'zh' ? { converttitles: '1' } : {}) });
    const q = j.query || {}, step = new Map();
    for (const k of ['normalized', 'converted', 'redirects']) for (const x of q[k] || []) step.set(x.from, x.to);
    const pages = new Map((q.pages || []).map(p => [p.title, p]));
    for (const t of batch) {
      let cur = t; for (let n = 0; n < 4 && step.has(cur); n++) cur = step.get(cur);
      const p = pages.get(cur);
      // '=' : the article exists but has no Wikidata item yet; it is linked as it is (wikilinks.json "direct")
      manQ[l][t] = !p || p.missing || p.invalid || (p.pageprops && 'disambiguation' in p.pageprops) ? '' : p.pageprops?.wikibase_item || `=${cur}`;
      if (!manQ[l][t]) manWhy[l + ':' + t] = p && !p.missing && !p.invalid ? '消歧義頁' : '不存在';
    }
    save('manual_titles.json', manQ); await sleep(DELAY);
  }
}
// entries written without any article (most events of the country modes) that manual.tsv names: add them too
{ const names = new Set([...manual.keys(), ...Object.keys(srcOf)]), have = new Set(entries.map(e => e.name)); let n = 0;
  for (const { p, region } of dataFiles(ROOT)) {
    let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    walkUnlinked(j, names, x => { const name = nameOf(x); if (!have.has(name)) { have.add(name); entries.push({ file: path.relative(ROOT, p), name, w: ['', '', ''], region }); n++; } });
  }
  if (n) console.log(`另有 ${n} 筆原本沒有條目的資料由 manual.tsv 指定`); }
const manualBad = [], directOf = {};
for (const [k, v] of manual) if (!/^Q\d+$/.test(v)) {
  const i = v.indexOf(':'), q = manQ[v.slice(0, i)]?.[v.slice(i + 1)];
  if (q?.startsWith('=')) { manual.delete(k); directOf[k] = v.slice(0, i + 1) + q.slice(1); }
  else if (q) manual.set(k, q); else { manual.delete(k); manualBad.push([k, v]); }
}
// for each title not found: search that Wikipedia and list the top three hits, so the right title can be picked
// without another round (cached in manual_search.json; one request at a time)
const manS = cached('manual_search.json', {});
for (const r of manualBad) {
  const v = r[1], i = v.indexOf(':'), l = v.slice(0, i), t = v.slice(i + 1);
  if (!(v in manS)) {
    const j = await post(`${l}.wikipedia.org`, { action: 'query', list: 'search', srsearch: t, srlimit: '3', srprop: 'snippet' });
    manS[v] = (j.query?.search || []).map(h => `${l}:${h.title}`); save('manual_search.json', manS); await sleep(DELAY);
  }
  r.push(manWhy[v] || '不存在', ...manS[v]);
}
fs.writeFileSync(path.join(OUT, 'manual_missing.tsv'), '# manual.tsv 裡在維基百科找不到的條目名稱：請改正或改附來源。欄位：資料\t寫的條目\t原因\t搜尋結果前三筆\n' + manualBad.map(r => r.join('\t')).join('\n') + (manualBad.length ? '\n' : ''));
if (manualBad.length) console.log(`manual.tsv 裡 ${manualBad.length} 個條目名稱不存在：` + manualBad.map(r => r.slice(0, 2).join(' → ')).join('；'));
const manualOf = e => manual.get(e.name) || e.w.map((t, i) => t && manual.get(`${L3[i]}:${t}`)).find(Boolean);
// ---- each entry's item: English first, then Chinese, then Japanese; disagreements are reported
const conflicts = [], unresolved = [];
for (const e of entries) {
  const qs = L3.map((l, i) => (e.w[i] && qOf[l][e.w[i]]) || '').map(q => q.startsWith('!') ? '' : q);
  const m = manualOf(e);
  if (m) { e.q = m; continue; }
  e.q = qs[1] || qs[0] || qs[2] || '';
  const other = [...new Set(qs.filter(Boolean))];
  if (other.length > 1) conflicts.push([e.file, e.name, e.w.join(' / '), qs.join(' / ')]);
  if (!e.q && !srcOf[e.name] && !directOf[e.name]) unresolved.push(e);
}
const items = [...new Set(entries.map(e => e.q).filter(Boolean))];
console.log(`對應到 ${items.length} 個 Wikidata 項目；${unresolved.length} 筆找不到；${conflicts.length} 筆各語言條目指向不同項目`);

// ---- 2. the countries of the items (for those outside a country mode): P17, else P495 → ISO 3166-1 alpha-2
const isoOf = cached('countries.json', {});
const needC = [...new Set(entries.filter(e => e.q && !e.region).map(e => e.q))].filter(q => !(q in isoOf));
for (let i = 0; i < needC.length; i += 300) {
  const batch = needC.slice(i, i + 300);
  const query = `SELECT ?item ?iso ?p WHERE { VALUES ?item { ${batch.map(q => 'wd:' + q).join(' ')} }
    { ?item wdt:P17 ?c . BIND(1 AS ?p) } UNION { ?item wdt:P495 ?c . BIND(2 AS ?p) } ?c wdt:P297 ?iso . }`;
  const j = await call('https://query.wikidata.org/sparql', { method: 'POST', headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ query }) });
  for (const q of batch) isoOf[q] = [];
  for (const b of j.results.bindings) {
    const q = b.item.value.split('/').pop(), iso = b.iso.value.toUpperCase();
    if (!isoOf[q].includes(iso) && (b.p.value === '1' || !isoOf[q].length)) isoOf[q].push(iso);
  }
  save('countries.json', isoOf);
  line(`  國家 ${Math.min(i + 300, needC.length)}/${needC.length}`); await sleep(DELAY * 3);
}
if (needC.length) console.log();

// ---- candidate local languages of each entry
const candOf = e => {
  if (e.region) return LANG_OF_REGION[e.region] || [];
  const langs = [];
  for (const iso of isoOf[e.q] || []) for (const l of LANG_OF_COUNTRY[iso] || []) if (!langs.includes(l)) langs.push(l);
  return langs.slice(0, 4);
};
const wikis = new Set(['zh', 'en', 'ja']);
for (const e of entries) if (e.q) for (const l of candOf(e)) wikis.add(l);

// ---- 3. sitelinks of the items, in those wikis only
const sl = cached('sitelinks.json', {});
const needS = items.filter(q => !(q in sl));
if (needS.length) console.log(`取 ${needS.length} 個項目在 ${wikis.size} 種語言的條目名稱`);
for (let i = 0; i < needS.length; i += 50) {
  const batch = needS.slice(i, i + 50);
  // all sitelinks, kept only for the wikis wanted (sitefilter takes at most 50 sites)
  const j = await post('www.wikidata.org', { action: 'wbgetentities', ids: batch.join('|'), props: 'sitelinks' });
  for (const q of batch) {
    const ent = j.entities?.[q], out = {};
    for (const [site, v] of Object.entries(ent?.sitelinks || {})) { const l = site.replace(/wiki$/, '').replace(/_/g, '-'); if (/wiki$/.test(site) && wikis.has(l)) out[l] = v.title; }
    // a merged item: follow it
    sl[ent?.redirects?.to || q] = out; if (ent?.redirects) sl[q] = out;
  }
  save('sitelinks.json', sl);
  line(`  ${Math.min(i + 50, needS.length)}/${needS.length}`); await sleep(DELAY);
}
if (needS.length) console.log();

// ---- 4. article lengths, where an entry has more than one local candidate
const len = cached('lengths.json', {});
const needL = {};
for (const e of entries) {
  const c = candOf(e).filter(l => sl[e.q]?.[l]); if (c.length < 2) continue;
  for (const l of c) { const t = sl[e.q][l]; if (!(len[l]?.[t] >= 0)) (needL[l] ??= new Set()).add(t); }
}
for (const [l, set] of Object.entries(needL)) {
  const todo = [...set]; len[l] ??= {};
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const j = await post(`${l}.wikipedia.org`, { action: 'query', titles: batch.join('|'), prop: 'info' });
    const got = new Map((j.query?.pages || []).map(p => [p.title, p.length || 0]));
    for (const t of batch) len[l][t] = got.get(t) ?? 0;
    save('lengths.json', len); await sleep(DELAY);
  }
}

// ---- output: for each title, its item; for each item, its articles; for each entry context, the local article
const by = {}, it = {};
for (const e of entries) {
  if (!e.q) continue;
  e.w.forEach((t, i) => { if (t && (qOf[L3[i]][t] || manualOf(e))) by[`${L3[i]}:${t}`] = e.q; });
  if (manualOf(e) && e.name) by[`name:${e.name}`] = e.q;
  const s = sl[e.q] || {};
  it[e.q] ??= { zh: s.zh || '', en: s.en || '', ja: s.ja || '', nat: {} };
  const c = candOf(e).filter(l => s[l]);
  const best = c.sort((a, b) => (len[b]?.[s[b]] || 0) - (len[a]?.[s[a]] || 0))[0];
  it[e.q].nat[e.region || '*'] = best ? `${best}:${s[best]}` : '';
}
// titles that do not exist (or are disambiguation pages): dropped from the data
const bad = [];
for (const l of L3) for (const [t, q] of Object.entries(qOf[l])) if (!q || q.startsWith('!')) bad.push(`${l}:${t}`);
fs.writeFileSync(path.join(OUT, 'wikilinks.json'), JSON.stringify({ made: new Date().toISOString().slice(0, 10), by, items: it, bad, src: srcOf, direct: directOf }));
const tsv = (rows, head) => head + '\n' + rows.map(r => r.join('\t')).join('\n') + '\n';
const uniq = rows => [...new Map(rows.map(r => [r.join('\t'), r])).values()];
fs.writeFileSync(path.join(OUT, 'unresolved.tsv'), tsv(uniq(unresolved.map(e => [e.file, e.name, ...e.w])), '# 這些條目的中、英、日標題都不存在（或是消歧義頁）：需要人工找正確條目、改附新聞或官方來源，或刪除\n# file\tname\tzh\ten\tja'));
fs.writeFileSync(path.join(OUT, 'conflicts.tsv'), tsv(uniq(conflicts), '# 同一筆資料的各語言標題指向不同的 Wikidata 項目（採用英文的項目）：請確認\n# file\tname\ttitles zh / en / ja\titems zh / en / ja'));
const withNat = Object.values(it).filter(x => Object.values(x.nat).some(Boolean)).length;
console.log(`完成：${Object.keys(it).length} 個項目，其中 ${withNat} 個有當地語言條目。找不到 ${unresolved.length} 筆（unresolved.tsv），不一致 ${conflicts.length} 筆（conflicts.tsv）。`);
