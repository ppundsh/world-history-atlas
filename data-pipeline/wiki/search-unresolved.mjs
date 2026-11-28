// Candidates for the entries none of whose Wikipedia titles exist (data-pipeline/wiki/unresolved.tsv): each is
// searched in Chinese Wikipedia (by its Chinese title or name) and, where it has them, in English and Japanese
// Wikipedia (by those titles); the top three hits with their Wikidata item and short description are written to
// data-pipeline/wiki/candidates.json, to be checked by hand and recorded in manual.tsv.
// One request at a time with a pause; results cached in data-pipeline/sources/wikilinks/search.json.
//   node data-pipeline/wiki/search-unresolved.mjs [--delay 1000]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { line } from '../lib/progress.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const DELAY = Math.max(500, +(args[args.indexOf('--delay') + 1] || 1000) || 1000);
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; article links)';
const CF = path.join(ROOT, 'data-pipeline', 'sources', 'wikilinks', 'search.json');
const cache = fs.existsSync(CF) ? JSON.parse(fs.readFileSync(CF, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rows = fs.readFileSync(path.join(ROOT, 'data-pipeline', 'wiki', 'unresolved.tsv'), 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
async function search(lang, q) {
  const key = lang + ':' + q; if (key in cache) return cache[key];
  const body = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', maxlag: '5', generator: 'search', gsrsearch: q, gsrlimit: '3',
    prop: 'pageprops|description', ppprop: 'wikibase_item', ...(lang === 'zh' ? { variant: 'zh-tw' } : {}) });
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/w/api.php`, { method: 'POST', body, signal: AbortSignal.timeout(60000),
        headers: { 'User-Agent': UA, 'Api-User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (r.status === 429 || r.status >= 500) { await sleep(15000); continue; }
      const j = await r.json();
      const hits = (j.query?.pages || []).sort((a, b) => a.index - b.index).map(p => ({ t: p.title, q: p.pageprops?.wikibase_item || '', d: p.description || '' }));
      cache[key] = hits; fs.writeFileSync(CF, JSON.stringify(cache)); await sleep(DELAY);
      return hits;
    } catch { await sleep(10000); }
  }
  return [];
}
const out = [];
let n = 0;
for (const [file, name, zh, en, ja] of rows) {
  const zq = (zh || name || '').replace(/[（(].*?[）)]/g, '').trim();
  const r = { file, name, titles: [zh, en, ja], hits: {} };
  if (zq) r.hits.zh = await search('zh', zq);
  if (en) r.hits.en = await search('en', en);
  if (ja) r.hits.ja = await search('ja', ja);
  out.push(r);
  line(`  ${++n}/${rows.length}`);
}
fs.writeFileSync(path.join(ROOT, 'data-pipeline', 'wiki', 'candidates.json'), JSON.stringify(out, null, 1));
console.log(`\n完成：${out.length} 筆的搜尋結果在 data-pipeline\\wiki\\candidates.json`);
