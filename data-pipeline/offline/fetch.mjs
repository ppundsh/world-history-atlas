// Bundles every picture and description the site shows, so the published site never asks Wikimedia for
// anything (and works offline):
//   public/offline/files.json      Commons file → [webp in img/, author, licence]
//   public/offline/img/*.webp      thumbnails, shrunk and re-encoded (WebP); a local cache, packed by sheets.mjs into
//                                  period sheets (public/offline/sheets) that the site actually uses
//   public/offline/ev/<lang>.json  event key → [article title, article URL, introduction, Commons file, [lon, lat]]
//   public/offline/pages.json      "wiki:title" → Commons file (people, places, buildings, currencies)
//   public/offline/works.json      Wikidata facts of the artworks and portraits
//   public/offline/CREDITS.md      every picture with its author, licence and source page
// Incremental: what is already in the bundle is not fetched again (run with --refresh to redo everything).
// Polite to Wikimedia: one request at a time, a descriptive User-Agent, maxlag, standard thumbnail widths.
// Run it on your own computer with fetch-offline.ps1 (Windows PowerShell) in the project folder; it installs "sharp"
// for the WebP conversion and runs this script. Interrupted runs pick up where they stopped.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url), OUT = new URL('public/offline/', ROOT);
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; offline bundle build)';
const REFRESH = process.argv.includes('--refresh'), DRY = process.argv.includes('--dry');
const LANGS = { 'zh-Hant': { wl: 'zh', variant: 'zh-tw', col: 1 }, 'zh-Hans': { wl: 'zh', variant: 'zh-cn', col: 2 }, en: { wl: 'en', variant: '', col: 0 }, ja: { wl: 'ja', variant: '', col: 3 } };
const WI = { zh: 0, en: 1, ja: 2 };
// Wikimedia keeps ready-made thumbnails at standard widths (…, 250, 330, 500 …): asking for those means no new
// rendering on their servers. They are shrunk further here: events to 320 px, the rest to 200 px.
const W_EVENT = 330, W_SMALL = 250, OUT_EVENT = 320, OUT_SMALL = 200, QUALITY = 50;

const read = (p, d) => { try { return JSON.parse(readFileSync(new URL(p, OUT), 'utf8')); } catch { return d; } };
const write = (p, v) => { const u = new URL(p, OUT); mkdirSync(new URL('.', u), { recursive: true }); writeFileSync(u, JSON.stringify(v)); };
const data = p => JSON.parse(readFileSync(new URL('public/data/' + p, ROOT), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let requests = 0;
// one progress line, rewritten in place: stage, count, requests so far, time used and an estimate of what is left
const T0 = Date.now(), mmss = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
let stage = { name: '', done: 0, total: 0, t: Date.now(), d0: 0 };
function progress(name, done, total) {
  if (name !== stage.name) { if (stage.name) process.stdout.write('\n'); stage = { name, done, total, t: Date.now(), d0: done }; }
  stage.done = done; stage.total = total;
  const pct = total ? Math.floor(done / total * 100) : 100, rate = (done - stage.d0) / Math.max(1, Date.now() - stage.t);
  const left = rate > 0 && total > done ? '，本階段約剩 ' + mmss((total - done) / rate) : '';
  const bar = '█'.repeat(Math.round(pct / 5)).padEnd(20, '░');
  process.stdout.write(`\r${name} ${bar} ${pct}%  ${done}/${total}  請求 ${requests} 次  已用 ${mmss(Date.now() - T0)}${left}      `);
}
const DELAY = +(process.env.OFFLINE_DELAY ?? 250);            // ms between requests (one at a time, never in parallel)
async function get(url, init = {}, tries = 5) {
  for (let k = 0; k < tries; k++) {
    await sleep(k ? 2000 * 2 ** k : DELAY);
    try {
      requests++;
      const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, 'Api-User-Agent': UA, ...(init.headers || {}) } });
      if (r.status === 429 || r.status >= 500) continue;
      if (!r.ok) return null;
      return init.raw ? r : await r.json();
    } catch { /* retry */ }
  }
  return null;
}
const api = (wl, params) => get(`https://${wl}.wikipedia.org/w/api.php?` + new URLSearchParams({ action: 'query', format: 'json', redirects: '1', maxlag: '5', ...params }));

// ---------------------------------------------------------------- what the site shows
const { WORLD_EVENTS } = await import(new URL('src/worldEvents.gen.js', ROOT));
const EVENTS = WORLD_EVENTS.map(e => ({ ...e, n: [e.n[2], e.n[0], e.n[1], e.n[3]] }));        // [en, zh-Hant, zh-Hans, ja]
const REGIONS = ['china', 'taiwan', 'japan', 'russia', 'korea', 'vietnam', 'germany', 'poland', 'italy', 'spain', 'india', 'prc', 'usa'];
const THEMES = ['language', 'finance', 'fgo', 'internet'];
const events = EVENTS.map(e => ({ ...e, ctx: 'world', t: e.y }));
const pageReq = new Map();                                     // "wl:title" → [wl, title]
const addPage = (wl, title) => { title = (title || '').trim(); if (title) pageReq.set(wl + ':' + title, [wl, title]); };
const cut = s => (s || '').split(/[（(、,]/)[0].trim();
for (const r of REGIONS) {
  let c; try { c = data(r + '.json'); } catch { continue; }
  events.push(...(c.events || []).map(e => ({ ...e, ctx: r, t: c.start[0] + (e.m + c.start[1] - 1) / 12 })));
  for (const g of c.governments || []) for (const [lang, L] of Object.entries(LANGS)) addPage(L.wl, cut(g.n[L.col] || g.n[0]));
  for (const x of [...(c.seats || []), ...(c.local || [])]) {
    if (x.w?.[0]) addPage('zh', x.w[0]);
    else for (const L of Object.values(LANGS)) addPage(L.wl, cut(x.n[L.col] || x.n[0]));
  }
}
const workIds = new Set();
for (const t of THEMES) {
  let T; try { T = data(t + '.json'); } catch { continue; }
  events.push(...(T.events || []).map(e => ({ ...e, ctx: t, t: e.y })));
  for (const x of [...(T.points || []), ...(T.areas || [])]) {
    if (x.q) workIds.add(x.q);
    if (!T.pictures && (x.w?.[1] || x.w?.[0])) addPage(x.w[1] ? 'en' : 'zh', x.w[1] || x.w[0]);
  }
  if (T.areaPictures) for (const a of T.areas) if (a.w?.[1]) addPage('en', a.w[1]);
}
for (const p of data('people.json')) { addPage('en', p.w); addPage('zh', p.n[1]); }
// the art-history works (ids only, read from the source so the browser module needn't be loaded here)
const artSrc = readFileSync(new URL('src/artworks.js', ROOT), 'utf8');
for (const m of artSrc.slice(artSrc.indexOf('ART_WORKS = {'), artSrc.indexOf('};', artSrc.indexOf('ART_WORKS = {'))).matchAll(/'(Q\d+)'/g)) workIds.add(m[1]);
const capitalFiles = new Set(Object.values(data('capitals.json')).flat().map(c => c.img).filter(Boolean));

const eventKey = (ev, lang) => lang + '|' + (ev.n?.[0] || '') + '|' + (ev.y ?? ev.m ?? '');
console.log(`要涵蓋：${events.length} 個事件 × 4 種語言、${pageReq.size} 個人物與地點、${workIds.size} 件作品、${capitalFiles.size} 張首都圖片（已抓過的會略過）`);
if (DRY) process.exit(0);

// ---------------------------------------------------------------- events: introductions, pictures, places
const fileWant = new Map();                                    // Commons file → width
const wantFile = (f, w) => { if (f) { f = f.replace(/_/g, ' '); fileWant.set(f, Math.max(fileWant.get(f) || 0, w)); } };
const evOut = {}, PROPS = { prop: 'extracts|pageimages|info|coordinates|pageprops', exintro: '1', explaintext: '1', exsentences: '3', exlimit: '20', piprop: 'name', inprop: 'url', coprimary: 'primary', ppprop: 'wikibase_item' };
const pageRow = p => [p.title, p.fullurl, (p.extract || '').trim(), p.pageimage || null, p.coordinates?.[0] ? [p.coordinates[0].lon, p.coordinates[0].lat] : null, p.pageprops?.wikibase_item || null];
const failed = new Set();
async function byTitles(wl, variant, titles) {               // title → row (batches of 20, the extracts limit)
  const out = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    process.stdout.write(`\r先批次查詢條目 ${Math.min(i + 20, titles.length)}/${titles.length}…      `);
    const part = titles.slice(i, i + 20);
    const j = await api(wl, { ...PROPS, titles: part.join('|'), ...(variant ? { variant } : {}) });
    if (!j?.query) { part.forEach(t => failed.add(t)); continue; }   // not reached: try again next run
    const back = new Map(part.map(t => [t, t]));
    for (const n of j.query.normalized || []) back.set(n.to, back.get(n.from) || n.from);
    for (const n of j.query.redirects || []) back.set(n.to, back.get(n.from) || n.from);
    for (const p of Object.values(j.query.pages || {})) if (!p.missing) out.set(back.get(p.title) || p.title, pageRow(p));
  }
  return out;
}
async function bySearch(wl, variant, q) {
  const j = await api(wl, { ...PROPS, generator: 'search', gsrlimit: '1', gsrsearch: q, ...(variant ? { variant } : {}) });
  if (!j) return undefined;                                    // not reached (as opposed to: nothing found)
  const p = Object.values(j?.query?.pages || {}).find(x => !x.missing);
  return p ? pageRow(p) : null;
}
const saveEvents = lang => { const o = {}; for (const [k, v] of Object.entries(evOut[lang])) o[k] = Array.isArray(v) ? v.slice(0, 5) : v; write(`ev/${lang}.json`, o); };
const needPlace = new Map();                                   // qid → event rows waiting for a place
for (const lang of ['zh-Hant', 'zh-Hans', 'en', 'ja']) {
  const L = LANGS[lang], old = REFRESH ? {} : read(`ev/${lang}.json`, {}), out = evOut[lang] = {};
  const todo = events.filter(e => !(eventKey(e, lang) in old));
  for (const e of events) if (eventKey(e, lang) in old) out[eventKey(e, lang)] = old[eventKey(e, lang)];
  // simplified Chinese: the same zh articles as traditional, read in the zh-cn variant
  const titled = todo.map(e => [e, lang === 'zh-Hans' ? evOut['zh-Hant'][eventKey(e, 'zh-Hant')]?.[0] || e.w?.[WI[L.wl]] : e.w?.[WI[L.wl]]]);
  const rows = await byTitles(L.wl, L.variant, [...new Set(titled.map(([, t]) => t).filter(Boolean))]);
  let n = 0;
  for (const [e, t] of titled) {
    if (t && failed.has(t)) continue;
    let row = t ? rows.get(t) : null;
    if (!row && !t) row = await bySearch(L.wl, L.variant, (e.n[L.col] || e.n[0]).split(/[，,；;：:（(]/)[0].trim());
    if (row === undefined) continue;
    out[eventKey(e, lang)] = row || 0;                         // 0: looked up, nothing found (trimmed to 5 fields when written)
    if (row) { wantFile(row[3], W_EVENT); if (!row[4] && row[5] && e.lon == null) (needPlace.get(row[5]) || needPlace.set(row[5], []).get(row[5])).push(row); }
    progress(`[1/4] 事件說明（${lang}）`, ++n, todo.length);
    if (n % 100 === 0) saveEvents(lang);
  }
  for (const r of Object.values(out)) if (r) wantFile(r[3], W_EVENT);
  saveEvents(lang); progress(`[1/4] 事件說明（${lang}）`, todo.length, todo.length);
}
// places of events whose article has no coordinates: Wikidata P625, else the location's or the area's
const qids = [...needPlace.keys()];
for (let i = 0; i < qids.length; i += 100) {
  const q = `SELECT ?e ?c WHERE { VALUES ?e { ${qids.slice(i, i + 100).map(x => 'wd:' + x).join(' ')} } { ?e wdt:P625 ?c } UNION { ?e wdt:P276/wdt:P625 ?c } UNION { ?e wdt:P131/wdt:P625 ?c } }`;
  const j = await get('https://query.wikidata.org/sparql', { method: 'POST', headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) });
  for (const b of j?.results?.bindings || []) {
    const id = b.e.value.split('/').pop(), m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.c.value);
    if (m) for (const row of needPlace.get(id) || []) row[4] ||= [+m[1], +m[2]];
  }
}
for (const lang in evOut) { for (const k in evOut[lang]) if (Array.isArray(evOut[lang][k])) evOut[lang][k] = evOut[lang][k].slice(0, 5); write(`ev/${lang}.json`, evOut[lang]); }

// ---------------------------------------------------------------- the same picture for events close in time
// Two events of one mode that are close in time and share a picture (the same article, or a flag) would show the
// same thumbnail side by side: the later one takes another picture from its own article (one request per article,
// remembered in the bundle), or none if the article has no other usable picture.
const normF = f => (f || '').replace(/_/g, ' ');
const NOT_PHOTO = /flag|coat of arms|emblem|logo|icon|symbol|seal of|commons|wikiquote|wiktionary|portal|ambox|question|edit-|disambig|padlock|loudspeaker|speaker icon|\.svg$|\.ogv$|\.webm$|\.ogg$|\.oga$|\.mid$|\.pdf$|\.tif$|\.djvu$/i;
const imagesOf = new Map();                                    // "wl:title" → [files]
let dupDone = 0, dupTodo = 0;
for (const lang of Object.keys(evOut)) {
  const L = LANGS[lang], groups = {};
  for (const e of events) { const r = evOut[lang][eventKey(e, lang)]; if (Array.isArray(r) && r[3]) (groups[e.ctx] ||= []).push({ e, r }); }
  for (const [ctx, list] of Object.entries(groups)) {
    const win = REGIONS.includes(ctx) ? 5 : 30;                // years
    list.sort((a, b) => a.e.t - b.e.t);
    for (let i = 0; i < list.length; i++) {
      const { e, r } = list[i];
      const near = list.filter((x, j) => j !== i && Math.abs(x.e.t - e.t) <= win);
      if (!list.slice(0, i).some(x => e.t - x.e.t <= win && normF(x.r[3]) === normF(r[3]))) continue;
      dupTodo++;
      const key = L.wl + ':' + r[0];
      if (!imagesOf.has(key)) {
        const j = await api(L.wl, { prop: 'images', imlimit: '50', titles: r[0] });
        imagesOf.set(key, Object.values(j?.query?.pages || {}).flatMap(p => (p.images || []).map(x => x.title.replace(/^[^:]+:/, ''))).filter(f => !NOT_PHOTO.test(f)));
      }
      const used = new Set(near.map(x => normF(x.r[3])));
      const alt = imagesOf.get(key).find(f => !used.has(normF(f)));
      r[3] = alt || null;
      if (alt) wantFile(alt, W_EVENT);
      progress('[1/4] 替換相近時間的重複縮圖', ++dupDone, dupDone);
    }
  }
  write(`ev/${lang}.json`, evOut[lang]);
}
if (dupTodo) process.stdout.write('\n');

// ---------------------------------------------------------------- page pictures
const pages = REFRESH ? {} : read('pages.json', {});
const byWiki = {};
for (const [k, [wl, t]] of pageReq) if (!(k in pages)) (byWiki[wl] ||= []).push(t);
const pageTotal = Object.values(byWiki).reduce((a, t) => a + t.length, 0); let pageDone = 0;
for (const [wl, titles] of Object.entries(byWiki)) {
  for (let i = 0; i < titles.length; i += 50) {
    progress('[2/4] 人物與地點圖片', pageDone, pageTotal); pageDone += Math.min(50, titles.length - i);
    const part = titles.slice(i, i + 50);
    const j = await api(wl, { prop: 'pageimages', piprop: 'name', titles: part.join('|') });
    if (!j?.query) continue;                                    // not reached: try again next run
    const back = new Map(part.map(t => [t, t]));
    for (const n of j?.query?.normalized || []) back.set(n.to, back.get(n.from) || n.from);
    for (const n of j?.query?.redirects || []) back.set(n.to, back.get(n.from) || n.from);
    for (const t of part) pages[wl + ':' + t] = 0;
    for (const p of Object.values(j?.query?.pages || {})) if (p.pageimage) pages[wl + ':' + (back.get(p.title) || p.title)] = p.pageimage.replace(/_/g, ' ');
    if ((i / 50) % 5 === 4) write('pages.json', pages);
  }
}
progress('[2/4] 人物與地點圖片', pageTotal, pageTotal);
for (const f of Object.values(pages)) if (f) wantFile(f, W_SMALL);
for (const f of capitalFiles) wantFile(f, W_SMALL);

// ---------------------------------------------------------------- artworks and portraits (Wikidata)
const works = REFRESH ? {} : read('works.json', {});
const wq = [...workIds].filter(id => !(id in works));
for (let i = 0; i < wq.length; i += 150) {
  progress('[3/4] 藝術作品與肖像', i, wq.length);
  const q = `SELECT ?w ?img ?col ?colLabel ?colSite ?crLabel ?inc ?url ?en ?zht ?zh ?zhs ?ja ?zhw ?jaw ?enw WHERE {
  VALUES ?w { ${wq.slice(i, i + 150).map(x => 'wd:' + x).join(' ')} }
  OPTIONAL { ?w wdt:P18 ?img } OPTIONAL { ?w wdt:P195 ?col OPTIONAL { ?col wdt:P856 ?colSite } }
  OPTIONAL { ?w wdt:P170|wdt:P50|wdt:P84|wdt:P86 ?cr } OPTIONAL { ?w wdt:P571|wdt:P577 ?inc } OPTIONAL { ?w wdt:P973 ?url }
  OPTIONAL { ?w rdfs:label ?en FILTER(lang(?en) = 'en') } OPTIONAL { ?w rdfs:label ?zht FILTER(lang(?zht) = 'zh-tw') }
  OPTIONAL { ?w rdfs:label ?zh FILTER(lang(?zh) = 'zh') } OPTIONAL { ?w rdfs:label ?zhs FILTER(lang(?zhs) = 'zh-cn') }
  OPTIONAL { ?w rdfs:label ?ja FILTER(lang(?ja) = 'ja') }
  OPTIONAL { ?enw schema:about ?w; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?zhw schema:about ?w; schema:isPartOf <https://zh.wikipedia.org/> }
  OPTIONAL { ?jaw schema:about ?w; schema:isPartOf <https://ja.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-tw,zh-hant,zh,en". ?col rdfs:label ?colLabel. ?cr rdfs:label ?crLabel }
}`;
  const j = await get('https://query.wikidata.org/sparql', { method: 'POST', headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) });
  const v = (b, k) => b[k]?.value, last = u => u.split('/').pop();
  for (const b of j?.results?.bindings || []) {
    const id = last(v(b, 'w')), a = works[id] ??= { id, col: [] };
    if (v(b, 'img') && !a.file) a.file = decodeURIComponent(last(v(b, 'img'))).replace(/_/g, ' ');
    if (v(b, 'col') && !a.col.some(c => c.id === last(v(b, 'col')))) a.col.push({ id: last(v(b, 'col')), name: v(b, 'colLabel'), site: v(b, 'colSite') || '' });
    for (const [k, f] of [['by', 'crLabel'], ['url', 'url'], ['en', 'en'], ['zht', 'zht'], ['zh', 'zh'], ['zhs', 'zhs'], ['ja', 'ja'], ['enw', 'enw'], ['zhw', 'zhw'], ['jaw', 'jaw']])
      if (v(b, f) && !a[k]) a[k] = v(b, f);
    if (v(b, 'inc') && a.y == null) { const y = parseInt(v(b, 'inc').replace(/^\+/, ''), 10); if (isFinite(y)) a.y = y; }
    if (a.by && /^(Q\d+|t\d+)$/.test(a.by)) a.by = '';
  }
  for (const id of wq.slice(i, i + 150)) works[id] ??= { id, col: [] };
}
progress('[3/4] 藝術作品與肖像', wq.length, wq.length);
for (const a of Object.values(works)) wantFile(a.file, W_SMALL);
write('works.json', works);
write('pages.json', pages);

// ---------------------------------------------------------------- pictures: licence, author, thumbnail
const sharp = (await import('sharp')).default;
// check that a picture can be written before downloading anything (a broken path once lost a whole run's work)
const imgPath = name => fileURLToPath(new URL('img/' + name, OUT));
mkdirSync(new URL('img/', OUT), { recursive: true });
try { await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).webp().toFile(imgPath('_check.webp')); unlinkSync(imgPath('_check.webp')); }
catch (e) { console.error('\n無法寫入縮圖資料夾 public/offline/img：' + e.message); process.exit(1); }
let convFail = 0;
const files = REFRESH ? {} : read('files.json', {});
mkdirSync(new URL('img/', OUT), { recursive: true });
const have = new Set(existsSync(new URL('img/', OUT)) ? readdirSync(new URL('img/', OUT)) : []);
const todoFiles = [...fileWant.keys()].filter(f => !files[f] || !have.has(files[f][0]));
let picDone = 0;
progress('[4/4] 下載與壓縮縮圖', 0, todoFiles.length);
const clean = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
for (let i = 0; i < todoFiles.length; i += 50) {
  const part = todoFiles.slice(i, i + 50), byW = {};
  for (const f of part) (byW[fileWant.get(f)] ||= []).push(f);
  for (const [w, list] of Object.entries(byW)) {
    const j = await get('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', maxlag: '5', prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime', iiurlwidth: w, iiextmetadatafilter: 'LicenseShortName|Artist|LicenseUrl|Credit', titles: list.map(f => 'File:' + f).join('|') }));
    const back = new Map(list.map(f => ['File:' + f, f]));
    for (const n of j?.query?.normalized || []) back.set(n.to, back.get(n.from));
    for (const p of Object.values(j?.query?.pages || {})) {
      const ii = p.imageinfo?.[0], f = back.get(p.title); if (!ii?.thumburl || !f) continue;
      const m = ii.extmetadata || {}, lic = clean(m.LicenseShortName?.value);
      if (!lic) continue;                                       // no licence on record: not used
      const r = await get(ii.thumburl, { raw: true }); if (!r) continue;
      const name = createHash('sha1').update(f).digest('hex').slice(0, 16) + '.webp';
      try {
        const px = +w === W_EVENT ? OUT_EVENT : OUT_SMALL;
        await sharp(Buffer.from(await r.arrayBuffer())).resize({ width: px, height: px, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: QUALITY, effort: 6 }).toFile(imgPath(name));
        convFail = 0;
      } catch (e) {
        if (++convFail >= 20) { console.error('\n連續 20 張縮圖轉檔失敗，停止以免白白下載：' + e.message); write('files.json', files); process.exit(1); }
        continue;
      }
      files[f] = [name, clean(m.Artist?.value), lic, clean(m.LicenseUrl?.value)];
      progress('[4/4] 下載與壓縮縮圖', ++picDone, todoFiles.length);
    }
  }
  picDone = Math.max(picDone, Math.min(i + 50, todoFiles.length)); progress('[4/4] 下載與壓縮縮圖', picDone, todoFiles.length); write('files.json', files);
}
write('files.json', files);

// ---------------------------------------------------------------- credits
const lines = ['# Offline bundle: picture credits', '', 'Thumbnails of Wikimedia Commons files, resized and re-encoded as WebP for this site (no other changes). Each file keeps its licence; click through to the file page for the full licence and attribution. Event and place descriptions are excerpts of Wikipedia article introductions (CC BY-SA 4.0), linked where they are shown. Artwork facts are from Wikidata (CC0).', '', '| File | Author | Licence |', '|---|---|---|'];
for (const [f, [, a, l]] of Object.entries(files).sort()) lines.push(`| [${f.replace(/\|/g, '\\|')}](https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, '_'))}) | ${(a || '—').replace(/\|/g, '/')} | ${l} |`);
writeFileSync(new URL('CREDITS.md', OUT), lines.join('\n') + '\n');
process.stdout.write('\n');
console.log(`完成：共 ${Object.keys(files).length} 張縮圖，這次送出 ${requests} 次請求，用時 ${mmss(Date.now() - T0)}。`);
