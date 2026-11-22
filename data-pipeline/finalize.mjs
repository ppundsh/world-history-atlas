// Stage 2: polity table → public/data/polities.json (+ meta.json)
// Wikidata labels that only existed in one Chinese script are flagged `review` by build.py; for those we
// convert characters only (OpenCC cn→tw / tw→cn, character level — no phrase/term replacement), so a
// Taiwan-usage name is never invented by conversion. Every converted name is listed in names_review.tsv.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const B = path.join(here, 'build');
const OUT = path.join(here, '..', 'public', 'data');
const toHant = OpenCC.Converter({ from: 'cn', to: 'tw' });
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });

const P = JSON.parse(fs.readFileSync(path.join(B, 'polities.json'), 'utf8'));
let converted = 0;
for (const p of P) {
  if (p.src === 'wikidata' || p.src === 'cliopatria') {
    const h = p['zh-Hant'], s = p['zh-Hans'];
    if (h) { const t = toHant(h); if (t !== h) { p['zh-Hant'] = t; p.review = true; converted++; } }
    if (s && (s === h || p.review)) { const c = toHans(s); if (c !== s) { p['zh-Hans'] = c; } }
    if (!p['zh-Hans'] && p['zh-Hant']) p['zh-Hans'] = toHans(p['zh-Hant']);
  }
}
// compact table: [en, zhHant, zhHans, ja, color, flags, altEn, altHant, altHans, altJa, qid, fromYear, toYear, religionSpans, religionInferred,
//                 peakKm2, peakYear, predecessorIds, successorIds]
const table = P.map(p => [
  p.en, p['zh-Hant'] || '', p['zh-Hans'] || '', p.ja || '', p.color,
  (p.nonstate ? 1 : 0) | (p.unrecognized ? 2 : 0) | (p.review ? 4 : 0),
  p.alt?.en || '', p.alt?.['zh-Hant'] || '', p.alt?.['zh-Hans'] || '', p.alt?.ja || '', p.qid || '', p.y0, p.y1,
  (p.rel || []).map(([a, b, c]) => `${a}:${b}:${c}`).join('|'), p.relInferred ? 1 : 0,
  p.peak?.[0] ?? 0, p.peak?.[1] ?? null, p.pred || [], p.succ || []
]);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'polities.json'), JSON.stringify(table));
fs.copyFileSync(path.join(B, 'meta.json'), path.join(OUT, 'meta.json'));
// religion legend table
const rel = fs.readFileSync(path.join(here, 'overrides', 'religions.tsv'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
  .map(l => { const [code, group, color, hant, hans, en, ja] = l.split('\t'); return { code, group, color, n: [en, hant, hans, ja] }; });
// descriptions + Wikipedia articles (religion_info.tsv): w = [zh, en, ja], d = [en, hant, hans, ja]
const relInfo = fs.readFileSync(path.join(here, 'overrides', 'religion_info.tsv'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
for (const l of relInfo) {
  const [code, wzh, wen, wja, hant, en, ja] = l.split('\t');
  const r = rel.find(x => x.code === code);
  if (!r) throw new Error('religion_info.tsv: unknown code ' + code);
  r.info = { w: [wzh, wen, wja], d: [en, hant, OpenCC.Converter({ from: 'tw', to: 'cn' })(hant), ja] };
}
fs.writeFileSync(path.join(OUT, 'religions.json'), JSON.stringify(rel));

const review = P.filter(p => p.review || !p['zh-Hant']);
fs.writeFileSync(path.join(here, 'names_review.tsv'),
  'key\tqid\ten\tzh-Hant\tzh-Hans\tja\tsrc\n' +
  review.map(p => [p.key, p.qid, p.en, p['zh-Hant'], p['zh-Hans'], p.ja, p.src].join('\t')).join('\n') + '\n');
console.log('polities', P.length, 'char-converted', converted, 'needing review', review.length);
