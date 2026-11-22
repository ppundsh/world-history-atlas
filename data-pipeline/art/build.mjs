// Art-history mode: movements.tsv → public/data/art.json  (zh-Hans from zh-Hant with OpenCC)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';
const here = path.dirname(fileURLToPath(import.meta.url));
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });
const T = ['west', 'eastasia', 'southasia', 'islam', 'americas', 'africa', 'oceania', 'ancient'];
const read = (file, cols) => fs.readFileSync(path.join(here, file), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map((l, i) => {
  const c = l.split('\t');
  if (c.length < cols) throw new Error(`${file} line ${i}: ${c.length} columns`);
  const [id, a, b, lon, lat, tr, hant, en, ja, wzh, wen, wja, dh, de, k, q] = c;
  if (!T.includes(tr)) throw new Error(`${id}: unknown tradition ${tr}`);
  const x = { id, a: +a, b: +b, lon: +lon, lat: +lat, t: tr, n: [en, hant, toHans(hant), ja], w: [wzh, wen, wja], d: [de, dh, toHans(dh), de] };
  if (k) { x.k = k; x.q = q.split('|'); }          // architecture (arch) or person, with Wikidata ids of the works
  return x;
});
// art movements (✦), then architecture styles (⌂) and cultural figures (❖) from culture.tsv
const out = [...read('movements.tsv', 14), ...read('culture.tsv', 16)];
fs.writeFileSync(path.join(here, '..', '..', 'public', 'data', 'art.json'), JSON.stringify(out));
console.log('art.json:', out.length, 'items');
