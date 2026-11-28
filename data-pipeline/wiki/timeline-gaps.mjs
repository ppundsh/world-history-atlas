// Events the site may have missed: compare a country mode with the timeline articles of that country's own
// Wikipedia (the local language's view of what mattered). Each line of a timeline (a year, some text, the articles
// it links) counts as covered when one of its linked articles is the Wikidata item of an entry in that mode.
// The rest are candidates, ranked by the length of their longest linked article (how much the local language has
// to say about it). Also the reverse: events of ours whose local-language article is missing or short.
// Only reports — data-pipeline/audit/gaps_<region>.tsv — nothing in the data is changed.
// Requests, one at a time: the timeline texts (one each), then 50 titles a request for items and lengths.
// Cached in data-pipeline/sources/timelines/ (--refresh starts over).
//   node data-pipeline/wiki/timeline-gaps.mjs [taiwan japan …] [--refresh]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkW, nameOf } from './collect.mjs';
import { line } from '../lib/progress.mjs';

// timeline articles of each country's own Wikipedia (add a country here to check it)
const TIMELINES = {
  taiwan: [['zh', '台灣歷史年表'], ['zh', '戰後臺灣歷史年表'], ['zh', '史前臺灣歷史年表']],
  japan: [['ja', '日本史の出来事一覧'], ['ja', '幕末の年表']],
};
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = path.join(ROOT, 'data-pipeline', 'sources', 'timelines');
const args = process.argv.slice(2), REFRESH = args.includes('--refresh');
const regions = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : Object.keys(TIMELINES);
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; timeline comparison)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(CACHE, { recursive: true });
const cacheFile = n => path.join(CACHE, n);
const load = (n, d) => !REFRESH && fs.existsSync(cacheFile(n)) ? JSON.parse(fs.readFileSync(cacheFile(n), 'utf8')) : d;
const save = (n, v) => fs.writeFileSync(cacheFile(n), JSON.stringify(v));
async function api(lang, params) {
  for (let k = 0; k < 6; k++) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/w/api.php`, { method: 'POST', signal: AbortSignal.timeout(90000),
        headers: { 'User-Agent': UA, 'Api-User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params }) });
      if (r.status === 429 || r.status >= 500) { await sleep(15000 * (k + 1)); continue; }
      const j = await r.json(); if (j.error?.code === 'maxlag') { await sleep(10000); continue; }
      await sleep(1000); return j;
    } catch (e) { if (k === 5) throw e; await sleep(10000); }
  }
}
const WL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data-pipeline', 'wiki', 'wikilinks.json'), 'utf8'));
const qOfEntry = (x, name) => {
  const w = Array.isArray(x.w) ? x.w : ['', x.w, ''];
  if (WL.by['name:' + name]) return WL.by['name:' + name];
  for (const [i, l] of ['zh', 'en', 'ja'].entries()) if (w[i] && WL.by[`${l}:${w[i]}`]) return WL.by[`${l}:${w[i]}`];
  return null;
};
// wikitext → plain text
const plain = s => s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/\{\{[^{}]*\}\}/g, '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'{2,}/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

for (const region of regions) {
  const T = TIMELINES[region]; if (!T) { console.log(`${region}：沒有設定年表條目，略過`); continue; }
  const lang = T[0][0];
  // ---- our entries in this mode: items and years
  let data; try { data = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', region + '.json'), 'utf8')); } catch { console.log(`${region}：找不到資料`); continue; }
  const files = [data]; for (const f of [path.join(ROOT, 'public', 'data', 'econ', region + '.json')]) { try { files.push(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch { /* none */ } }
  const ours = new Set(), ourEvents = [];
  const start = data.start, yearOf = m => start[0] + Math.floor((start[1] - 1 + m) / 12);
  for (const j of files) walkW(j, x => {
    const q = qOfEntry(x, nameOf(x)); if (q) ours.add(q);
  });
  // every event of the mode, with or without articles (most were written without any)
  for (const x of data.events || []) if (typeof x.m === 'number') {
    const w = Array.isArray(x.w) ? x.w : [];
    ourEvents.push({ name: nameOf(x), text: (Array.isArray(x.n) ? x.n[lang === 'ja' ? 3 : 1] : '') || nameOf(x), y: yearOf(x.m), q: w.length ? qOfEntry(x, nameOf(x)) : null,
      linked: w.slice(0, 3).some(Boolean), nat: w[3] || '' });
  }
  const from = start[0];

  // ---- the timelines: lines with a year and the articles they link
  const lines = [];
  for (const [l, title] of T) {
    const key = `text_${l}_${title}.json`;
    let text = load(key, null);
    if (text == null) {
      const j = await api(l, { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: title, redirects: '1' });
      text = j?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content || '';
      if (!text) console.log(`  ${l}:${title} 取不到內容`);
      save(key, text);
    }
    let year = null;
    for (const raw of text.split('\n')) {
      if (/^=+/.test(raw)) { const m = raw.match(/(\d{3,4})年/); if (m) year = +m[1]; continue; }
      if (!/^[*#:]/.test(raw)) continue;
      const body = raw.replace(/^[*#:]+\s*/, '');
      // a line that starts with a year sets it (often written as a link, [[2024年]]); one without keeps the last
      const m = plain(body).match(/^(?:約|约)?\s*(?:西元|公元)?\s*(\d{3,4})(?:年|：|:|\s)/);
      if (m) year = +m[1];
      const links = [...body.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map(x => x[1].trim())
        .filter(t => !/^\d+年(代)?$|^\d+月\d+日$|^(File|Image|ファイル|檔案|文件|Category|分類|カテゴリ):/i.test(t));
      const txt = plain(body); if (!txt || year == null) continue;
      lines.push({ src: `${l}:${title}`, year, text: txt.slice(0, 160), links });
    }
  }
  // ---- linked articles → Wikidata items and lengths; also our events' local articles
  const meta = load(`meta_${lang}.json`, {});
  const want = [...new Set([...lines.flatMap(x => x.links), ...ourEvents.flatMap(e => e.nat.startsWith(lang + ':') ? [e.nat.slice(lang.length + 1)] : [])])].filter(t => !(t in meta));
  for (let i = 0; i < (process.env.GAPS_OFFLINE ? 0 : want.length); i += 50) {
    line(`  ${region}：查 ${Math.min(i + 50, want.length)}/${want.length} 個條目`);
    const batch = want.slice(i, i + 50);
    const j = await api(lang, { action: 'query', titles: batch.join('|'), redirects: '1', prop: 'pageprops|info', ppprop: 'wikibase_item', ...(lang === 'zh' ? { converttitles: '1' } : {}) });
    const q = j?.query || {}, step = new Map();
    for (const k of ['normalized', 'converted', 'redirects']) for (const x of q[k] || []) step.set(x.from, x.to);
    const pages = new Map((q.pages || []).map(p => [p.title, p]));
    for (const t of batch) { let c = t; for (let n = 0; n < 4 && step.has(c); n++) c = step.get(c); const p = pages.get(c); meta[t] = p && !p.missing ? [p.pageprops?.wikibase_item || '', p.length || 0, c] : ['', 0, c]; }
    save(`meta_${lang}.json`, meta);
  }
  if (want.length) process.stdout.write('\n');

  // ---- compare
  // wording: character pairs of a text without punctuation, digits and calendar words (Dice similarity)
  const pairs = t => { const c = t.replace(/[\s\d（）()「」『』《》〈〉、，。：；・·,.:;!?！？\-—–~～年月日的之與与和及]/g, ''); const s = new Set(); for (let i = 0; i < c.length - 1; i++) s.add(c.slice(i, i + 2)); return s; };
  const dice = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return 2 * n / (a.size + b.size); };
  for (const e of ourEvents) e.p = pairs(e.text);
  const EVENTISH = lang === 'ja' ? /事件|の乱|の変|の役|戦争|合戦|の戦い|条約|一揆|地震|改革|運動|事故|大火|災害|会議|騒動|の陣|政変|維新|開国|令$|法$|噴火|飢饉|選挙|開業|開通/
    : /事件|戰役|之役|战役|戰爭|战争|運動|运动|學運|選舉|选举|事故|地震|水災|颱風|條約|条约|宣言|大火|屠殺|慘案|起義|之亂|會談|危機|炮戰|砲戰|血案|法$|案$|抗爭|罷工|風災|空難|爆炸|通車|開通/;
  const inRange = lines.filter(x => x.year >= from);
  let covered = 0; const gaps = [], linksFor = new Map();     // our unlinked event → the timeline's article for it
  for (const x of inRange) {
    const items = x.links.map(t => ({ t, q: meta[t]?.[0] || '', len: meta[t]?.[1] || 0, ev: EVENTISH.test(t) }));
    const xp = pairs(x.text);
    // the closest of our events in the same year (±1): by the wording of the line, or by the name of an article it
    // links ("太陽花學運" matches a line that describes the trade agreement and links 太陽花學運)
    const titleP = items.map(i => ({ i, p: pairs(meta[i.t]?.[2] || i.t) }));
    const near = ourEvents.filter(e => Math.abs(e.y - x.year) <= 1).map(e => {
      const byTitle = titleP.map(o => ({ o, d: dice(o.p, e.p) })).sort((a, b) => b.d - a.d)[0];
      return { e, d: Math.max(dice(e.p, xp), byTitle?.d >= 0.6 ? byTitle.d : 0), art: byTitle?.d >= 0.6 ? byTitle.o.i : null };
    }).sort((a, b) => b.d - a.d)[0];
    const byItem = items.some(i => i.q && ours.has(i.q)), byText = near && near.d >= 0.35;
    if (byText && !near.e.linked && items.length) {
      // the article of this line that best matches our event's wording (an event article first)
      const cand = near.art?.q ? near.art : items.filter(i => i.q).map(i => ({ ...i, d: dice(pairs(meta[i.t]?.[2] || i.t), near.e.p) })).sort((a, b) => (b.ev - a.ev) || (b.d - a.d) || (b.len - a.len))[0];
      if (cand) { const old = linksFor.get(near.e.name); if (!old || near.d > old.sim) linksFor.set(near.e.name, { e: near.e, line: x, art: cand, sim: near.d }); }
    }
    if (byItem || byText) { covered++; continue; }
    const best = items.filter(i => i.q).sort((a, b) => (b.ev - a.ev) || (b.len - a.len))[0];
    gaps.push({ ...x, best: best?.t || '', len: best?.len || 0, q: best?.q || '', ev: !!best?.ev });
  }
  // the same article linked from several lines: keep the line that names it first
  const seen = new Set(), uniq = gaps.sort((a, b) => (b.ev - a.ev) || (b.len - a.len)).filter(g => !g.best || (!seen.has(g.best) && seen.add(g.best)));
  const thin = ourEvents.map(e => { const t = e.nat.startsWith(lang + ':') ? e.nat.slice(lang.length + 1) : ''; return { ...e, t, len: t ? meta[t]?.[1] || 0 : 0 }; })
    .filter(e => e.linked && e.len < 3000).sort((a, b) => a.len - b.len);
  const link = t => t ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}` : '';
  const out = [
    `# ${region}：當地語言年表（${T.map(t => t.join(':')).join('、')}）有、網站沒收錄的事件，依條目長度排序`,
    `# 年表 ${inRange.length} 行（${from} 年以後），已涵蓋 ${covered} 行，未涵蓋 ${inRange.length - covered} 行（不同行連到同一條目時只列一次）`,
    '# 事件條目\t年\t年表內容\t主要條目\t條目長度（位元組）\t連結\t來源（「事件條目」為是：連到的是事件本身的條目，排在前面）',
    ...uniq.map(g => [g.ev ? '是' : '', g.year, g.text, g.best, g.len, link(g.best), g.src].join('\t')),
    '',
    `# 反向：網站的事件中，當地語言條目不存在或很短（不到 3000 位元組）的 ${thin.length} 筆`,
    '# 年\t事件\t當地語言條目\t長度',
    ...thin.map(e => [e.y, e.name, e.t || '（沒有）', e.len].join('\t')),
  ];
  const unlinked = ourEvents.filter(e => !e.linked);
  const lk = [`# ${region}：網站上 ${unlinked.length} 筆沒有維基條目的事件，在當地語言年表找到同年、措辭相近的一行時，該行連到的條目（人工確認後記入 manual.tsv）`,
    '# 事件\t年\t年表內容\t建議條目\tWikidata\t相似度', ...[...linksFor.values()].sort((a, b) => b.sim - a.sim).map(v => [v.e.name, v.e.y, v.line.text, `${lang}:${meta[v.art.t]?.[2] || v.art.t}`, v.art.q, v.sim.toFixed(2)].join('\t')),
    '', '# 年表裡找不到對應的事件', ...unlinked.filter(e => !linksFor.has(e.name)).map(e => [e.name, e.y].join('\t'))];
  fs.mkdirSync(path.join(ROOT, 'data-pipeline', 'audit'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'data-pipeline', 'audit', `links_${region}.tsv`), lk.join('\n') + '\n');
  fs.writeFileSync(path.join(ROOT, 'data-pipeline', 'audit', `gaps_${region}.tsv`), out.join('\n') + '\n');
  console.log(`${region}：年表 ${inRange.length} 行，網站已涵蓋 ${covered} 行；未涵蓋的候選 ${uniq.length} 個、當地條目很少的事件 ${thin.length} 筆（gaps_${region}.tsv）；沒有條目的事件 ${unlinked.length} 筆，在年表找到建議條目 ${linksFor.size} 筆（links_${region}.tsv）`);
}
