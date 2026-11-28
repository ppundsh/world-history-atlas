// Events of a country mode that still have no Wikipedia article: each is searched in that country's own Wikipedia
// (by its local-language wording, the part before a colon or comma first) and the top three hits, with their
// Wikidata item, short description and length, are written to data-pipeline/audit/search_<region>.tsv, to be
// checked by hand and recorded in manual.tsv. One request at a time; cached in data-pipeline/sources/timelines.
//   node data-pipeline/wiki/search-events.mjs [taiwan japan …]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nameOf } from './collect.mjs';
import { line } from '../lib/progress.mjs';

const LANG = { taiwan: ['zh', 1], japan: ['ja', 3] };        // the Wikipedia to search, and which name column to use
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CF = path.join(ROOT, 'data-pipeline', 'sources', 'timelines', 'search.json');
fs.mkdirSync(path.dirname(CF), { recursive: true });
const cache = fs.existsSync(CF) ? JSON.parse(fs.readFileSync(CF, 'utf8')) : {};
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; event articles)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
async function search(lang, q) {
  const key = lang + ':' + q; if (key in cache) return cache[key];
  const body = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', maxlag: '5', generator: 'search', gsrsearch: q, gsrlimit: '3',
    prop: 'pageprops|description|info', ppprop: 'wikibase_item', ...(lang === 'zh' ? { variant: 'zh-tw' } : {}) });
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/w/api.php`, { method: 'POST', body, signal: AbortSignal.timeout(60000),
        headers: { 'User-Agent': UA, 'Api-User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (r.status === 429 || r.status >= 500) { await sleep(15000 * (i + 1)); continue; }
      const j = await r.json(); if (j.error?.code === 'maxlag') { await sleep(10000); continue; }
      const hits = (j.query?.pages || []).sort((a, b) => a.index - b.index).map(p => ({ t: p.title, q: p.pageprops?.wikibase_item || '', d: p.description || '', len: p.length || 0 }));
      cache[key] = hits; fs.writeFileSync(CF, JSON.stringify(cache)); await sleep(1000);
      return hits;
    } catch { await sleep(10000); }
  }
  throw new Error(`維基伺服器忙碌，重試 6 次仍未回應（${lang}.wikipedia.org）；稍後再執行即可接著做`);
}
for (const region of args.length ? args : Object.keys(LANG)) {
  const [lang, col] = LANG[region] || []; if (!lang) { console.log(`${region}：沒有設定搜尋語言，略過`); continue; }
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', region + '.json'), 'utf8'));
  const yearOf = m => data.start[0] + Math.floor((data.start[1] - 1 + m) / 12);
  const todo = (data.events || []).filter(e => typeof e.m === 'number' && !(Array.isArray(e.w) && e.w.slice(0, 3).some(Boolean)) && !e.src);
  const rows = []; let n = 0;
  for (const e of todo) {
    const text = (Array.isArray(e.n) ? e.n[col] : '') || nameOf(e);
    const q = text.split(/[：:，,；;（(]/)[0].trim() || text;
    const hits = await search(lang, q);
    rows.push([nameOf(e), yearOf(e.m), q, ...hits.flatMap(h => [`${lang}:${h.t}`, h.q, h.d, h.len])].join('\t'));
    line(`  ${region}：${++n}/${todo.length}`);
  }
  if (todo.length) process.stdout.write('\n');
  fs.writeFileSync(path.join(ROOT, 'data-pipeline', 'audit', `search_${region}.tsv`),
    `# ${region}：網站上還沒有維基條目的 ${todo.length} 筆事件，在${lang === 'ja' ? '日文' : '中文'}維基搜尋的前三筆結果（人工確認後記入 manual.tsv）\n` +
    '# 事件\t年\t搜尋詞\t第1筆\tWikidata\t說明\t長度\t第2筆\tWikidata\t說明\t長度\t第3筆\tWikidata\t說明\t長度\n' + rows.join('\n') + '\n');
  console.log(`${region}：${todo.length} 筆沒有條目的事件已搜尋（data-pipeline/audit/search_${region}.tsv）`);
}
