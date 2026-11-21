// Packs the bundled thumbnails (public/offline/img/*.webp, made by fetch.mjs) into larger sheets by period:
//   public/offline/sheets/<hash>.webp   about 40 thumbnails each, ordered by the year they belong to
//   public/offline/sheets.json          { v, sheets: [{ f, y0, y1, n }], at: { "<img name>": [sheet, x, y, w, h] } }
// The site (public/sw.js) then fetches one sheet per period, only when a picture of that period is shown, and cuts
// the pictures out of it in the browser: a few large requests instead of thousands of small ones, and nothing of
// periods that are never visited. The single files in img/ stay on this computer as the fetch cache; they need not
// be published.
// Works offline from what fetch.mjs has saved so far, so it can be run while a download is still going on
// (fetch-offline.ps1 -SheetsOnly), and is run again automatically at the end of every fetch.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url), OUT = new URL('public/offline/', ROOT);
const PER_SHEET = +(process.env.SHEET_SIZE || 40), WIDTH = 1600, QUALITY = 72;
const read = (p, d) => { for (let k = 0; k < 5; k++) { try { return JSON.parse(readFileSync(new URL(p, OUT), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return d; } } return d; };
const data = p => { try { return JSON.parse(readFileSync(new URL('public/data/' + p, ROOT), 'utf8')); } catch { return null; } };
const norm = f => (f || '').replace(/_/g, ' ');

const files = read('files.json', null);
if (!files) { console.log('還沒有 public/offline/files.json：請先執行 fetch-offline.ps1 下載縮圖。'); process.exit(0); }
const have = new Set(existsSync(new URL('img/', OUT)) ? readdirSync(new URL('img/', OUT)) : []);

// ---------------------------------------------------------------- the year each picture belongs to
const year = new Map();                                        // Commons file → earliest year it is shown for
const at = (f, y) => { f = norm(f); if (!f || y == null || !isFinite(y)) return; if (!year.has(f) || y < year.get(f)) year.set(f, Math.round(y)); };
const monthYear = (start, m) => start[0] + Math.floor((m + start[1] - 1) / 12);
const cut = s => (s || '').split(/[（(、,]/)[0].trim();
const LANGS = { 'zh-Hant': { wl: 'zh', col: 1 }, 'zh-Hans': { wl: 'zh', col: 2 }, en: { wl: 'en', col: 0 }, ja: { wl: 'ja', col: 3 } };
const REGIONS = ['china', 'taiwan', 'japan', 'russia', 'korea', 'vietnam', 'germany', 'poland', 'italy', 'spain', 'india', 'prc', 'usa'];
const THEMES = ['language', 'finance', 'fgo', 'internet'];

// events (keyed like fetch.mjs / eventinfo.js)
const { WORLD_EVENTS } = await import(new URL('src/worldEvents.gen.js', ROOT));
const events = WORLD_EVENTS.map(e => ({ ...e, n: [e.n[2], e.n[0], e.n[1], e.n[3]], year: e.y }));
const pageYear = new Map();                                     // "wl:title" → year
const page = (wl, title, y) => { title = (title || '').trim(); if (!title || y == null) return; const k = wl + ':' + title; if (!pageYear.has(k) || y < pageYear.get(k)) pageYear.set(k, y); };
for (const r of REGIONS) {
  const c = data(r + '.json'); if (!c) continue;
  for (const e of c.events || []) events.push({ ...e, year: monthYear(c.start, e.m) });
  for (const g of c.governments || []) for (const L of Object.values(LANGS)) page(L.wl, cut(g.n[L.col] || g.n[0]), monthYear(c.start, g.a || 0));
  for (const x of [...(c.seats || []), ...(c.local || [])]) {
    const y = monthYear(c.start, x.a || 0);
    if (x.w?.[0]) page('zh', x.w[0], y); else for (const L of Object.values(LANGS)) page(L.wl, cut(x.n[L.col] || x.n[0]), y);
  }
}
const qYear = new Map();
for (const t of THEMES) {
  const T = data(t + '.json'); if (!T) continue;
  for (const e of T.events || []) if (e.y != null) events.push({ ...e, year: e.y });
  for (const x of [...(T.points || []), ...(T.areas || [])]) {
    if (x.q && x.a != null) qYear.set(x.q, Math.min(qYear.get(x.q) ?? Infinity, x.a));
    if (x.w?.[1] || x.w?.[0]) page(x.w[1] ? 'en' : 'zh', x.w[1] || x.w[0], x.a);
  }
}
const eventKey = (ev, lang) => lang + '|' + (ev.n?.[0] || '') + '|' + (ev.y ?? ev.m ?? '');
for (const lang of Object.keys(LANGS)) {
  const ev = read(`ev/${lang}.json`, {});
  for (const e of events) { const row = ev[eventKey(e, lang)]; if (Array.isArray(row)) at(row[3], e.year); }
}
// people: the year of the first event that names them
const people = data('people.json') || [];
const texts = events.map(e => [e.year, e.n.join(' ') + ' ' + (e.d || []).join(' ')]).sort((a, b) => a[0] - b[0]);
for (const p of people) {
  const names = [...new Set([...(p.m || []), ...(p.n || [])])].filter(s => s && s.length > 1);
  const hit = texts.find(([, t]) => names.some(n => t.includes(n)));
  if (hit) { page('en', p.w, hit[0]); page('zh', p.n?.[1], hit[0]); }
}
const pages = read('pages.json', {});
for (const [k, f] of Object.entries(pages)) if (f && pageYear.has(k)) at(f, pageYear.get(k));
// capitals: the start of the state they belong to
const polities = data('polities.json') || [], pStart = new Map(polities.map(p => [p[10], p[11]]));
for (const [q, list] of Object.entries(data('capitals.json') || {})) for (const c of list) at(c.img, pStart.get(q));
// artworks: the start of their style (art.json) or of the theme point that uses them
const artSrc = readFileSync(new URL('src/artworks.js', ROOT), 'utf8');
const artBlock = artSrc.slice(artSrc.indexOf('ART_WORKS = {'), artSrc.indexOf('};', artSrc.indexOf('ART_WORKS = {')));
const styleStart = new Map((data('art.json') || []).map(s => [s.id, s.a]));
for (const m of artBlock.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) for (const q of m[2].matchAll(/'(Q\d+)'/g)) if (styleStart.has(m[1])) qYear.set(q[1], Math.min(qYear.get(q[1]) ?? Infinity, styleStart.get(m[1])));
for (const [q, w] of Object.entries(read('works.json', {}))) if (w?.file && qYear.has(q)) at(w.file, qYear.get(q));

// ---------------------------------------------------------------- packing
const sharp = (await import('sharp')).default;
const pics = [];
for (const [f, e] of Object.entries(files)) if (e?.[0] && have.has(e[0])) pics.push({ name: e[0], yr: year.get(norm(f)) ?? null });
const seen = new Set(), list = pics.filter(p => !seen.has(p.name) && seen.add(p.name));
list.sort((a, b) => (a.yr ?? 1e9) - (b.yr ?? 1e9) || (a.name < b.name ? -1 : 1));
console.log(`合併縮圖：${list.length} 張（其中 ${list.filter(p => p.yr == null).length} 張找不到年代，放在最後）`);

mkdirSync(new URL('sheets/', OUT), { recursive: true });
const old = read('sheets.json', null), oldBy = new Map((old?.sheets || []).map(s => [s.key, s]));
const sheets = [], atOut = {};
let made = 0, kept = 0;
for (let i = 0; i < list.length; i += PER_SHEET) {
  const part = list.slice(i, i + PER_SHEET);
  for (const p of part) { const m = await sharp(fileURLToPath(new URL('img/' + p.name, OUT))).metadata(); p.w = m.width; p.h = m.height; }
  // shelf packing, tallest first, rows up to WIDTH px
  const order = [...part].sort((a, b) => b.h - a.h);
  let x = 0, y = 0, rowH = 0, W = 0;
  for (const p of order) { if (x + p.w > WIDTH) { y += rowH; x = 0; rowH = 0; } p.x = x; p.y = y; x += p.w; rowH = Math.max(rowH, p.h); W = Math.max(W, x); }
  const H = y + rowH, s = sheets.length;
  const key = createHash('sha1').update(order.map(p => `${p.name}@${p.x},${p.y}`).join('|')).digest('hex').slice(0, 12);
  const f = `sheets/${key}.webp`;
  if (oldBy.has(key) && existsSync(new URL(f, OUT))) kept++;
  else {
    await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
      .composite(order.map(p => ({ input: fileURLToPath(new URL('img/' + p.name, OUT)), left: p.x, top: p.y })))
      .webp({ quality: QUALITY, effort: 5 }).toFile(fileURLToPath(new URL(f, OUT)));
    made++;
  }
  const ys = part.map(p => p.yr).filter(v => v != null);
  sheets.push({ f, key, y0: ys.length ? Math.min(...ys) : null, y1: ys.length ? Math.max(...ys) : null, n: part.length });
  for (const p of order) atOut[p.name.replace(/\.webp$/, '')] = [s, p.x, p.y, p.w, p.h];
  process.stdout.write(`\r合併中 ${Math.min(i + PER_SHEET, list.length)}/${list.length}（新做 ${made} 張大圖，沿用 ${kept} 張）   `);
}
process.stdout.write('\n');
const v = createHash('sha1').update(sheets.map(s => s.key).join()).digest('hex').slice(0, 10);
writeFileSync(new URL('sheets.json', OUT), JSON.stringify({ v, sheets, at: atOut }));
// remove sheets no longer used
const used = new Set(sheets.map(s => s.f.slice(7)));
let removed = 0;
for (const f of readdirSync(new URL('sheets/', OUT))) if (!used.has(f)) { try { unlinkSync(new URL('sheets/' + f, OUT)); removed++; } catch { /* keep */ } }
const size = sheets.reduce((t, s) => { try { return t + readFileSync(new URL(s.f, OUT)).length; } catch { return t; } }, 0);
console.log(`完成：${sheets.length} 張大圖（共 ${(size / 1048576).toFixed(1)} MB），新做 ${made}、沿用 ${kept}、移除舊的 ${removed}。`);
