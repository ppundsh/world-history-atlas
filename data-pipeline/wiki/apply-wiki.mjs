// Rewrites the Wikipedia articles of the built data (public/data/**/*.json and src/worldEvents.gen.js) from
// data-pipeline/wiki/wikilinks.json (fetch-wikilinks.mjs): each entry's "w" becomes the articles of its Wikidata
// item, [zh, en, ja, "lang:title" in the local language (which may be one of the three)]; titles known not to exist are dropped. Entries that could
// not be tied to an item keep their titles that do exist. Run after the builds (build-all.sh does).
//   node data-pipeline/wiki/apply-wiki.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { walkW, walkUnlinked, dataFiles, nameOf } from './collect.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const F = path.join(ROOT, 'data-pipeline', 'wiki', 'wikilinks.json');
if (!fs.existsSync(F)) { console.log('apply-wiki: 沒有 wikilinks.json（先在有網路的電腦執行 .\\fetch-offline.ps1 -WikiLinks），略過'); process.exit(0); }
const { by, items, bad, src = {}, direct = {} } = JSON.parse(fs.readFileSync(F, 'utf8'));
const BAD = new Set(bad), L3 = ['zh', 'en', 'ja'];
// entries written without any article that manual.tsv now names (wikilinks.json "name:…", src, direct)
const NAMED = new Set([...Object.keys(by).filter(k => k.startsWith('name:')).map(k => k.slice(5)), ...Object.keys(src), ...Object.keys(direct)]);
const stat = { fixed: 0, dropped: 0, native: 0, same: 0 };

function fix(x, w, region) {
  const single = typeof x.w === 'string';
  // an entry without a Wikipedia article: its news or official source (manual.tsv "src:")
  const sv = src[nameOf(x)]; if (sv) { if (x.src !== sv) { x.src = sv; stat.fixed++; } x.w = ['', '', '']; return; }
  // an article with no Wikidata item yet (manual.tsv "lang:Title" that exists): linked as it is
  const dv = direct[nameOf(x)];
  if (dv && !single) { const i = dv.indexOf(':'), l = dv.slice(0, i), t = dv.slice(i + 1), out = [...w];
    if (L3.includes(l)) out[L3.indexOf(l)] = t; out.push(dv);
    if (JSON.stringify(out) !== JSON.stringify(x.w)) { x.w = out; stat.fixed++; } return; }
  const q = by[`name:${nameOf(x)}`] || [1, 0, 2].map(i => w[i] && by[`${L3[i]}:${w[i]}`]).find(Boolean);
  let out;
  if (q && items[q]) {
    const it = items[q], nat = it.nat[region || '*'] ?? it.nat['*'] ?? Object.values(it.nat).find(Boolean) ?? '';
    out = [it.zh, it.en, it.ja].map((t, i) => t || (w[i] && !BAD.has(`${L3[i]}:${w[i]}`) ? w[i] : ''));
    if (nat) { out.push(nat); stat.native++; }   // also when it is zh/en/ja: it gives the picture and the original name
  } else out = w.map((t, i) => (t && BAD.has(`${L3[i]}:${t}`) ? '' : t || ''));
  if (single) { const v = out[1] || ''; if (v !== x.w) { x.w = v; stat.fixed++; } return; }
  const before = JSON.stringify(x.w);
  x.w = out;
  if (JSON.stringify(out) !== before) { stat.fixed++; stat.dropped += w.filter((t, i) => t && !out[i]).length; } else stat.same++;
}

for (const { p, region } of dataFiles(ROOT)) {
  const text = fs.readFileSync(p, 'utf8'); let j; try { j = JSON.parse(text); } catch { continue; }
  let touched = false;
  walkW(j, (x, w) => { const b = JSON.stringify(x.w); fix(x, w, region); if (JSON.stringify(x.w) !== b) touched = true; });
  walkUnlinked(j, NAMED, x => { x.w = ['', '', '']; fix(x, x.w, region); if (x.w.some(Boolean) || x.src) touched = true; else delete x.w; });
  if (touched) fs.writeFileSync(p, JSON.stringify(j));
}
// the timeline events (a JS module written by build_events.mjs): same layout, the arrays rewritten
const G = path.join(ROOT, 'src', 'worldEvents.gen.js');
const mod = await import(pathToFileURL(G).href + '?t=' + Date.now());
let text = fs.readFileSync(G, 'utf8');
for (const [k, v] of Object.entries(mod)) {
  walkW(v, (x, w) => fix(x, w, null));
  const js = JSON.stringify(v, null, 0).replace(/},{/g, '},\n{');
  text = text.replace(new RegExp(`(export const ${k} = )[\\s\\S]*?;\\n(?=//|export|$)`), (_, a) => a + js + ';\n');
}
fs.writeFileSync(G, text);
console.log(`apply-wiki：更新 ${stat.fixed} 筆（拿掉不存在的條目 ${stat.dropped} 個、加上當地語言條目 ${stat.native} 個），${stat.same} 筆不變`);
