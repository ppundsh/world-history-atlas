// people.tsv → public/data/people.json: [{ w: English Wikipedia title, n: [en, zh-Hant, zh-Hans, ja], m: [names to look for] }]
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const out = [];
for (const line of readFileSync(new URL('data-pipeline/people/people.tsv', root), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [w, hant, hans, ja, en] = line.split('\t').map(s => (s || '').trim());
  const sp = s => s.split('|').map(x => x.trim()).filter(Boolean);
  const m = [...new Set([...sp(hant), ...sp(hans), ...sp(ja), ...sp(en)])].filter(x => x.length >= 2 && !/[()]/.test(x));
  out.push({ w, n: [sp(en)[0] || w, sp(hant)[0], sp(hans)[0], sp(ja)[0]], m });
}
writeFileSync(new URL('public/data/people.json', root), JSON.stringify(out));
console.log(out.length, 'people');
