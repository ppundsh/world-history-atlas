// Capitals of the world-history polities, read from Wikidata in the visitor's browser (capital, P36, with its
// start and end qualifiers, the city's coordinates and picture). Cached for a week. Polities without a Wikidata
// item or a capital with coordinates simply get none.

import { isOffline, offlineFile } from './offline.js';

const KEY = 'capitals.v1', WEEK = 7 * 864e5;
let caps = null, loading = null;

export function capitalsReady() { return !!caps; }

export function loadCapitals(qids) {
  if (caps) return Promise.resolve(caps);
  if (loading) return loading;
  // bundled with the site (data-pipeline/capitals: read from Wikidata at build time); the live query is only a
  // fallback, since Wikidata's query service can take half a minute and sometimes drops a request
  loading = fetch(import.meta.env.BASE_URL + 'data/capitals.json').then(r => { if (!r.ok) throw r.status; return r.json(); })
    .then(d => (caps = d))
    .catch(() => {
      try {
        const c = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (c && Date.now() - c.t < WEEK) return (caps = c.d);
      } catch { /* storage unavailable */ }
      return fetchAll([...new Set(qids.filter(q => /^Q\d+$/.test(q)))]).then(d => {
        caps = d;
        try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d })); } catch { /* full */ }
        return d;
      });
    }).catch(() => { loading = null; return {}; });   // try again next time instead of keeping an empty list
  return loading;
}

async function fetchAll(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 400) {
    const q = `SELECT ?p ?cap ?coord ?start ?end ?img ?en ?zht ?zh ?zhs ?ja WHERE {
  VALUES ?p { ${ids.slice(i, i + 400).map(x => 'wd:' + x).join(' ')} }
  ?p p:P36 ?st. ?st ps:P36 ?cap. ?cap wdt:P625 ?coord.
  OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?cap wdt:P18 ?img }
  OPTIONAL { ?cap rdfs:label ?en FILTER(lang(?en) = 'en') } OPTIONAL { ?cap rdfs:label ?zht FILTER(lang(?zht) = 'zh-tw') }
  OPTIONAL { ?cap rdfs:label ?zh FILTER(lang(?zh) = 'zh') } OPTIONAL { ?cap rdfs:label ?zhs FILTER(lang(?zhs) = 'zh-cn') }
  OPTIONAL { ?cap rdfs:label ?ja FILTER(lang(?ja) = 'ja') }
}`;
    let j = null;
    for (let k = 0; k < 3 && !j; k++) {
      j = await fetch('https://query.wikidata.org/sparql', { method: 'POST',
        headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) })
        .then(r => r.json()).catch(() => null);
    }
    if (!j) continue;
    for (const b of j.results.bindings) {
      const v = k => b[k]?.value, p = v('p').split('/').pop(), c = v('cap').split('/').pop();
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(v('coord') || ''); if (!m) continue;
      const yr = s => { if (!s) return null; const y = parseInt(s.replace(/^\+/, ''), 10); return isFinite(y) ? y : null; };
      const list = out[p] ||= [];
      if (list.some(x => x.c === c && x.a === yr(v('start')))) continue;
      list.push({ c, ll: [+m[1], +m[2]], a: yr(v('start')), b: yr(v('end')),
        n: [v('en') || '', v('zht') || v('zh') || v('en') || '', v('zhs') || v('zh') || v('zht') || v('en') || '', v('ja') || v('en') || ''],
        img: v('img') ? decodeURIComponent(v('img').split('FilePath/').pop()).replace(/_/g, ' ') : '' });
    }
  }
  return out;
}

// the capital in a given year: a dated statement covering the year (the latest to start), else an undated one
export function capitalOf(qid, year) {
  const list = caps?.[qid]; if (!list?.length) return null;
  const dated = list.filter(x => (x.a != null || x.b != null) && (x.a == null || x.a <= year) && (x.b == null || year <= x.b));
  if (dated.length) return dated.sort((x, y) => (y.a ?? -1e9) - (x.a ?? -1e9))[0];
  const undated = list.filter(x => x.a == null && x.b == null);
  return undated[0] || null;
}

// a picture of the city: Commons thumbnail with author and licence
const thumbs = new Map();
export function cityThumb(file) {
  if (!file) return Promise.resolve(null);
  if (!thumbs.has(file)) thumbs.set(file, isOffline().then(off => off ? offlineFile(file).then(f => f && { url: f.thumb, credit: f.credit }) : fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=200'
    + '&iiextmetadatafilter=LicenseShortName|Artist&titles=' + encodeURIComponent('File:' + file)).then(r => r.json()).then(j => {
    const ii = Object.values(j.query?.pages || {})[0]?.imageinfo?.[0]; if (!ii) return null;
    const m = ii.extmetadata || {};
    return { url: ii.thumburl, credit: [(m.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40), m.LicenseShortName?.value].filter(Boolean).join(' · ') };
  }).catch(() => null)));
  return thumbs.get(file);
}
