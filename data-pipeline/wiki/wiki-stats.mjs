// Wikipedia use in the site's data, for the About box: per mode, how many entries link to Wikipedia and how many
// links go to each language's Wikipedia (the zh/en/ja titles and the local-language one), plus entries that cite
// a news or official source instead. Writes public/data/wikistats.json. Run after apply-wiki.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { walkW, dataFiles } from './collect.mjs';
import { LANG_OF_REGION } from './languages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// data file → mode; anything not listed (people, capitals, …) is shown in the world mode
const FILE_MODE = { art: 'art', religions: 'religion', language: 'language', finance: 'finance', internet: 'internet', disaster: 'disaster', fgo: 'fgo' };
const modeOf = p => {
  const b = path.basename(p, '.json').replace(/_units$/, '');
  return b in LANG_OF_REGION ? b : FILE_MODE[b] || 'world';
};
const modes = {};
const add = (mode, x) => {
  const w = Array.isArray(x.w) ? x.w : ['', x.w, ''];
  const m = modes[mode] ||= { entries: 0, links: 0, src: 0, local: 0, langs: {} };
  const seen = new Set();
  ['zh', 'en', 'ja'].forEach((l, i) => { if (w[i]) seen.add(l); });
  const nat = typeof w[3] === 'string' && w[3].includes(':') ? w[3].slice(0, w[3].indexOf(':')) : '';
  if (nat) seen.add(nat);
  if (!seen.size) { if (x.src) m.src++; return; }
  if (nat) m.local++;
  m.entries++; m.links += seen.size;
  for (const l of seen) m.langs[l] = (m.langs[l] || 0) + 1;
};
for (const { p } of dataFiles(ROOT)) {
  let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
  const mode = modeOf(p);
  walkW(j, x => add(mode, x));
}
const gen = await import(pathToFileURL(path.join(ROOT, 'src', 'worldEvents.gen.js')).href);
walkW(gen.WORLD_EVENTS || [], x => add('world', x));
for (const [k, v] of Object.entries(gen.MODE_EVENTS || {})) walkW(v, x => add(k, x));

const all = { entries: 0, links: 0, src: 0, local: 0, langs: {} };
for (const m of Object.values(modes)) {
  all.entries += m.entries; all.links += m.links; all.src += m.src; all.local += m.local;
  for (const [l, n] of Object.entries(m.langs)) all.langs[l] = (all.langs[l] || 0) + n;
}
const out = { made: new Date().toISOString().slice(0, 10), all, modes };
fs.writeFileSync(path.join(ROOT, 'public', 'data', 'wikistats.json'), JSON.stringify(out));
console.log(`wiki-stats：${all.entries} 筆資料、${all.links} 個維基連結、${Object.keys(all.langs).length} 種語言；當地語言條目 ${all.local} 個，附新聞／官方來源 ${all.src} 筆`);
