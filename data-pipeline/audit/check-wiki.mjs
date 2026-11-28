// Checks that every Wikipedia article the site links to exists, in the language it is filed under.
// Reads the built data the site uses (public/data/**/*.json and src/worldEvents.gen.js): every "w" field, either
// [zh, en, ja] or a single English title (people.json). For each language it asks the Wikipedia API about 50
// titles at a time (one request at a time, a pause between them, maxlag), then, for each title that does not
// exist, asks the article in another language of the same entry for its link to this language.
// Writes data-pipeline/audit/wiki_check.tsv: one line per title that is missing, a disambiguation page or a
// redirect, with what to use instead and where it is used. Results are cached in data-pipeline/sources/wikicheck/
// so that an interrupted run continues where it stopped (--refresh starts over).
//   node data-pipeline/audit/check-wiki.mjs [--refresh] [--delay 1000]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { line } from '../lib/progress.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = path.join(ROOT, 'data-pipeline', 'sources', 'wikicheck');
const args = process.argv.slice(2), REFRESH = args.includes('--refresh');
const DELAY = Math.max(500, +(args[args.indexOf('--delay') + 1] || 1000) || 1000);
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; link check)';
const LANGS = ['zh', 'en', 'ja'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(CACHE, { recursive: true });

// ---- every title and where it is used
const uses = { zh: new Map(), en: new Map(), ja: new Map() };   // title → [{ file, name, w }]
function add(lang, title, file, name, w) {
  title = String(title || '').trim(); if (!title) return;
  const m = uses[lang]; if (!m.has(title)) m.set(title, []);
  m.get(title).push({ file, name, w });
}
const nameOf = x => Array.isArray(x?.n) ? (x.n.find(v => /[㐀-鿿]/.test(v || '')) || x.n[0] || '') : (x?.n || x?.name || x?.id || '');
function walk(x, file) {
  if (Array.isArray(x)) { for (const v of x) walk(v, file); return; }
  if (!x || typeof x !== 'object') return;
  if (Array.isArray(x.w) && x.w.length <= 3 && x.w.every(v => v == null || typeof v === 'string')) x.w.forEach((t, i) => add(LANGS[i], t, file, nameOf(x), x.w));
  else if (typeof x.w === 'string') add('en', x.w, file, nameOf(x), [null, x.w, null]);
  for (const [k, v] of Object.entries(x)) if (k !== 'w' && v && typeof v === 'object') walk(v, file);
}
function dir(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) dir(p);
    else if (f.endsWith('.json')) { try { walk(JSON.parse(fs.readFileSync(p, 'utf8')), path.relative(ROOT, p)); } catch { /* not data */ } }
  }
}
dir(path.join(ROOT, 'public', 'data'));
const gen = await import(pathToFileURL(path.join(ROOT, 'src', 'worldEvents.gen.js')).href);
for (const [k, v] of Object.entries(gen)) walk(v, 'src/worldEvents.gen.js#' + k);
for (const l of LANGS) console.log(`${l}: ${uses[l].size} 個條目`);
if (args.includes('--count')) process.exit(0);

// ---- ask Wikipedia
async function api(lang, params) {
  const body = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', maxlag: '5', ...params });
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/w/api.php`, { method: 'POST', body, signal: AbortSignal.timeout(60000),
        headers: { 'User-Agent': UA, 'Api-User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (r.status === 429 || r.status >= 500) { await sleep(15000 * (i + 1)); continue; }
      const j = await r.json();
      if (j.error?.code === 'maxlag') { await sleep(10000); continue; }
      if (j.error) throw new Error(j.error.info);
      return j;
    } catch (e) { if (i === 5) throw e; await sleep(10000); }
  }
}
const cacheFile = l => path.join(CACHE, `pages_${l}.json`);
const res = {};
for (const l of LANGS) {
  res[l] = !REFRESH && fs.existsSync(cacheFile(l)) ? JSON.parse(fs.readFileSync(cacheFile(l), 'utf8')) : {};
  const todo = [...uses[l].keys()].filter(t => !(t in res[l]));
  if (todo.length) console.log(`${l}: 查詢 ${todo.length} 個（每批 50 個）`);
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const j = await api(l, { titles: batch.join('|'), redirects: '1', prop: 'pageprops', ppprop: 'disambiguation', ...(l === 'zh' ? { converttitles: '1' } : {}) });
    const q = j.query || {}, step = new Map();
    for (const k of ['normalized', 'converted', 'redirects']) for (const x of q[k] || []) step.set(x.from, { to: x.to, kind: k });
    const pages = new Map((q.pages || []).map(p => [p.title, p]));
    for (const t of batch) {
      let cur = t, redirect = null;
      for (let n = 0; n < 4 && step.has(cur); n++) { const s = step.get(cur); if (s.kind === 'redirects') redirect = s.to; cur = s.to; }
      const p = pages.get(cur);
      res[l][t] = !p || p.missing || p.invalid ? { s: 'missing' } : p.pageprops && 'disambiguation' in p.pageprops ? { s: 'disambig', to: cur } : redirect ? { s: 'redirect', to: cur } : { s: 'ok', to: cur };
    }
    fs.writeFileSync(cacheFile(l), JSON.stringify(res[l]));
    line(`  ${Math.min(i + 50, todo.length)}/${todo.length}`);
    await sleep(DELAY);
  }
  if (todo.length) console.log();
}

// ---- for missing titles: the other languages' articles of the same entry, and their links to this language
const ask = {};   // `${from}>${to}` → Set of existing titles in `from`
for (const l of LANGS) for (const [t, u] of uses[l]) {
  if (res[l][t]?.s !== 'missing') continue;
  for (const x of u) x.w.forEach((o, i) => { const ol = LANGS[i]; if (o && ol !== l && res[ol]?.[o]?.s && res[ol][o].s !== 'missing') (ask[`${ol}>${l}`] ??= new Set()).add(res[ol][o].to || o); });
}
const llFile = path.join(CACHE, 'langlinks.json');
const ll = !REFRESH && fs.existsSync(llFile) ? JSON.parse(fs.readFileSync(llFile, 'utf8')) : {};
for (const [k, set] of Object.entries(ask)) {
  const [from, to] = k.split('>'); ll[k] ??= {};
  const todo = [...set].filter(t => !(t in ll[k]));
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const j = await api(from, { titles: batch.join('|'), prop: 'langlinks', lllang: to, lllimit: '500' });
    const got = new Map((j.query?.pages || []).map(p => [p.title, p.langlinks?.[0]?.title || '']));
    for (const t of batch) ll[k][t] = got.get(t) ?? '';
    fs.writeFileSync(llFile, JSON.stringify(ll));
    await sleep(DELAY);
  }
}

// ---- report
const rows = [];
const count = { ok: 0, redirect: 0, disambig: 0, missing: 0 };
for (const l of LANGS) for (const [t, u] of uses[l]) {
  const r = res[l][t] || { s: 'missing' }; count[r.s]++;
  if (r.s === 'ok') continue;
  let suggest = r.to || '';
  if (r.s === 'missing') {
    for (const x of u) x.w.forEach((o, i) => { const ol = LANGS[i]; const tt = o && res[ol]?.[o] && (res[ol][o].to || o); const v = tt && ll[`${ol}>${l}`]?.[tt]; if (v && !suggest) suggest = v; });
  }
  const where = [...new Set(u.map(x => `${x.file}:${x.name}`))];
  rows.push([r.s, l, t, suggest, where.length, where.slice(0, 4).join(' ｜ ')]);
}
const order = { missing: 0, disambig: 1, redirect: 2 };
rows.sort((a, b) => order[a[0]] - order[b[0]] || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]));
fs.writeFileSync(path.join(ROOT, 'data-pipeline', 'audit', 'wiki_check.tsv'),
  `# Wikipedia link check, ${new Date().toISOString().slice(0, 10)}: ${JSON.stringify(count)}\n# status\tlang\ttitle\tuse instead (redirect target, or the article linked from another language)\tuses\twhere\n`
  + rows.map(r => r.join('\t')).join('\n') + '\n');
console.log(`完成：存在 ${count.ok}、重新導向 ${count.redirect}、消歧義頁 ${count.disambig}、不存在 ${count.missing}。結果在 data-pipeline\\audit\\wiki_check.tsv`);
