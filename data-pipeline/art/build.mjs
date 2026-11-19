// Art-history mode: movements.tsv → public/data/art.json  (zh-Hans from zh-Hant with OpenCC)
import fs from 'node:fs';
import path from 'node:path';
import * as OpenCC from 'opencc-js';
const here = path.dirname(new URL(import.meta.url).pathname);
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });
const T = ['west', 'eastasia', 'southasia', 'islam', 'americas', 'africa', 'oceania', 'ancient'];
const out = fs.readFileSync(path.join(here, 'movements.tsv'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map((l, i) => {
  const c = l.split('\t');
  if (c.length < 14) throw new Error(`movements.tsv line ${i}: ${c.length} columns`);
  const [id, a, b, lon, lat, tr, hant, en, ja, wzh, wen, wja, dh, de] = c;
  if (!T.includes(tr)) throw new Error(`${id}: unknown tradition ${tr}`);
  return { id, a: +a, b: +b, lon: +lon, lat: +lat, t: tr, n: [en, hant, toHans(hant), ja], w: [wzh, wen, wja], d: [de, dh, toHans(dh), de] };
});
fs.writeFileSync(path.join(here, '..', '..', 'public', 'data', 'art.json'), JSON.stringify(out));
console.log('art.json:', out.length, 'movements');
