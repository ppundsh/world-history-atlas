// Every entry with Wikipedia articles in the site's built data: each "w" ([zh, en, ja] and, once apply-wiki.mjs
// has run, a fourth "lang:title" for the local language; or a single English title, people.json), where it is,
// what it is called and which country mode it belongs to. walkW() is shared with apply-wiki.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LANG_OF_REGION } from './languages.mjs';

export const nameOf = x => Array.isArray(x?.n) ? (x.n.find(v => /[㐀-鿿]/.test(v || '')) || x.n[0] || '') : (x?.n || x?.name || x?.id || '');
// calls fn(obj, w) for every object holding a "w" of Wikipedia titles; fn may replace obj.w
export function walkW(x, fn) {
  if (Array.isArray(x)) { for (const v of x) walkW(v, fn); return; }
  if (!x || typeof x !== 'object') return;
  if (Array.isArray(x.w) && x.w.length >= 2 && x.w.length <= 4 && x.w.every(v => v == null || typeof v === 'string')) fn(x, x.w.slice(0, 3).concat(['', '', '']).slice(0, 3));
  else if (typeof x.w === 'string' && x.w) fn(x, ['', x.w, '']);
  for (const [k, v] of Object.entries(x)) if (k !== 'w' && v && typeof v === 'object') walkW(v, fn);
}
// calls fn(obj) for every object that has names ("n") but no "w" and whose name is in the set: an entry written
// without any article (most events of the country modes) that manual.tsv now gives one
export function walkUnlinked(x, names, fn) {
  if (Array.isArray(x)) { for (const v of x) walkUnlinked(v, names, fn); return; }
  if (!x || typeof x !== 'object') return;
  // no articles at all, an empty ["", "", ""], or only a local-language article (4th item) that manual.tsv gave
  const empty = !('w' in x) || (Array.isArray(x.w) && !x.w.slice(0, 3).some(Boolean));
  if (Array.isArray(x.n) && empty && names.has(nameOf(x))) fn(x);
  for (const v of Object.values(x)) if (v && typeof v === 'object') walkUnlinked(v, names, fn);
}
// the data files and the country mode each belongs to (public/data/<region>.json, econ/<region>.json, …)
export function dataFiles(ROOT) {
  const out = [];
  const dir = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (!/chunks|outlines/.test(f)) dir(p); } else if (f.endsWith('.json')) out.push(p); } };
  dir(path.join(ROOT, 'public', 'data'));
  return out.map(p => { const b = path.basename(p, '.json').replace(/_units$/, ''); return { p, region: b in LANG_OF_REGION ? b : null }; });
}
export async function collect(ROOT) {
  const entries = [];
  for (const { p, region } of dataFiles(ROOT)) {
    let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    walkW(j, (x, w) => { if (w.some(Boolean)) entries.push({ file: path.relative(ROOT, p), name: nameOf(x), w, region }); });
  }
  const gen = await import(pathToFileURL(path.join(ROOT, 'src', 'worldEvents.gen.js')).href + '?t=' + Date.now());
  for (const [k, v] of Object.entries(gen)) walkW(v, (x, w) => entries.push({ file: 'src/worldEvents.gen.js#' + k, name: nameOf(x), w, region: null }));
  return entries;
}
