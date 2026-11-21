// Capitals of the world-history polities (Wikidata P36 with its start/end qualifiers, the city's coordinates,
// picture and names), written to public/data/capitals.json so the site needn't query Wikidata at run time.
// Usage: node data-pipeline/capitals/build.mjs   (Wikidata is CC0)
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const polities = JSON.parse(readFileSync(new URL('public/data/polities.json', root)));
const ids = [...new Set(polities.map(r => r[10]).filter(q => /^Q\d+$/.test(q || '')))];
const out = {};
const yr = s => { if (!s) return null; const y = parseInt(s.replace(/^\+/, ''), 10); return Number.isFinite(y) ? y : null; };

for (let i = 0; i < ids.length; i += 250) {
  const q = `SELECT ?p ?cap ?coord ?start ?end ?img ?en ?zht ?zh ?zhs ?ja WHERE {
  VALUES ?p { ${ids.slice(i, i + 250).map(x => 'wd:' + x).join(' ')} }
  ?p p:P36 ?st. ?st ps:P36 ?cap. ?cap wdt:P625 ?coord.
  OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?cap wdt:P18 ?img }
  OPTIONAL { ?cap rdfs:label ?en FILTER(lang(?en) = 'en') } OPTIONAL { ?cap rdfs:label ?zht FILTER(lang(?zht) = 'zh-tw') }
  OPTIONAL { ?cap rdfs:label ?zh FILTER(lang(?zh) = 'zh') } OPTIONAL { ?cap rdfs:label ?zhs FILTER(lang(?zhs) = 'zh-cn') }
  OPTIONAL { ?cap rdfs:label ?ja FILTER(lang(?ja) = 'ja') }
}`;
  let j = null;
  for (let k = 0; k < 4 && !j; k++) {
    j = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'world-history-atlas build (github.com/ppundsh)' }, body: 'query=' + encodeURIComponent(q) })
      .then(r => r.json()).catch(() => null);
  }
  if (!j) throw new Error('Wikidata query failed at batch ' + i);
  for (const b of j.results.bindings) {
    const v = k => b[k]?.value, p = v('p').split('/').pop(), c = v('cap').split('/').pop();
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(v('coord') || ''); if (!m) continue;
    const list = out[p] ||= [];
    if (list.some(x => x.c === c && x.a === yr(v('start')) && x.b === yr(v('end')))) continue;
    list.push({ c, ll: [+(+m[1]).toFixed(3), +(+m[2]).toFixed(3)], a: yr(v('start')), b: yr(v('end')),
      n: [v('en') || '', v('zht') || v('zh') || v('en') || '', v('zhs') || v('zh') || v('zht') || v('en') || '', v('ja') || v('en') || ''],
      img: v('img') ? decodeURIComponent(v('img').split('FilePath/').pop()).replace(/_/g, ' ') : '' });
  }
  console.log(`${Math.min(i + 250, ids.length)} / ${ids.length}`);
}
writeFileSync(new URL('public/data/capitals.json', root), JSON.stringify(out));
console.log(Object.keys(out).length, 'polities with a capital');
