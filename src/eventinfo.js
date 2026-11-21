// A short description and a picture for a historical event, from Wikipedia in the reader's language.
// World events name their article; regional events are looked up by name (top search hit). Only pictures
// hosted on Wikimedia Commons are used, shown with their author and licence; the text is an excerpt of
// the article's introduction (CC BY-SA 4.0) with a link to it.

import { isOffline, offlineJson, offlineFile } from './offline.js';

const cache = new Map();
const WIKI = { 'zh-Hant': ['zh', 'zh-tw'], 'zh-Hans': ['zh', 'zh-cn'], en: ['en', ''], ja: ['ja', ''] };

export function eventKey(ev, lang) { return lang + '|' + (ev.n?.[0] || '') + '|' + (ev.y ?? ev.m ?? ''); }

export function eventInfo(ev, lang, col) {
  const key = eventKey(ev, lang);
  if (!cache.has(key)) cache.set(key, load(ev, lang, col).catch(() => null));
  return cache.get(key);
}

async function load(ev, lang, col) {
  // bundled: offline/ev/<lang>.json, keyed like eventKey → [title, url, extract, Commons file, [lon, lat]]
  if (await isOffline()) {
    const e = (await offlineJson('ev/' + lang + '.json'))?.[eventKey(ev, lang)]; if (!e) return null;
    const out = { title: e[0], url: e[1], extract: e[2] || '' };
    if (e[4]) out.ll = e[4];
    const f = e[3] && await offlineFile(e[3]);
    if (f) Object.assign(out, { thumb: f.thumb, page: f.page, lic: f.lic, author: f.author, file: f.file });
    return out;
  }
  const [wl, variant] = WIKI[lang] || WIKI.en;
  const wi = { zh: 0, en: 1, ja: 2 }[wl];
  const title = ev.w?.[wi];
  let q = `https://${wl}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=extracts|pageimages|info|coordinates|pageprops`
    + '&exintro=1&explaintext=1&exsentences=3&piprop=thumbnail|name&pithumbsize=480&inprop=url&coprimary=primary&ppprop=wikibase_item' + (variant ? '&variant=' + variant : '');
  if (title) q += '&titles=' + encodeURIComponent(title);
  else {
    const name = (ev.n[col] || ev.n[0]).split(/[，,；;：:（(]/)[0].trim();
    q += '&generator=search&gsrlimit=1&gsrsearch=' + encodeURIComponent(name);
  }
  const j = await (await fetch(q)).json();
  const p = Object.values(j.query?.pages || {}).find(x => !x.missing);
  if (!p) return null;
  const out = { title: p.title, url: p.fullurl, extract: (p.extract || '').trim() };
  // where it happened: the article's own coordinates, else Wikidata's location (place, or the place's coordinates)
  const co = p.coordinates?.[0];
  if (co) out.ll = [co.lon, co.lat];
  else if (p.pageprops?.wikibase_item) out.qid = p.pageprops.wikibase_item;
  const th = p.thumbnail?.source;
  if (th && /\/wikipedia\/commons\//.test(th) && p.pageimage) {
    out.thumb = th; out.file = p.pageimage;
    try {
      const c = await (await fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata|url'
        + '&iiextmetadatafilter=LicenseShortName|Artist&titles=' + encodeURIComponent('File:' + p.pageimage))).json();
      const ii = Object.values(c.query?.pages || {})[0]?.imageinfo?.[0], m = ii?.extmetadata || {};
      out.page = ii?.descriptionurl || 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(p.pageimage);
      out.lic = m.LicenseShortName?.value || '';
      out.author = (m.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    } catch { out.page = 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(p.pageimage); }
  }
  return out;
}

// coordinates of an event from Wikidata: its own (P625), its location's (P276), or its administrative area's (P131)
const placeCache = new Map();
export function wikidataPlace(qid) {
  if (!placeCache.has(qid)) placeCache.set(qid, (async () => {
    if (await isOffline()) return null;                     // the bundle already holds every place it knows
    const q = `SELECT ?c WHERE { { wd:${qid} wdt:P625 ?c } UNION { wd:${qid} wdt:P276/wdt:P625 ?c } UNION { wd:${qid} wdt:P131/wdt:P625 ?c } } LIMIT 1`;
    const j = await (await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q))).json();
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(j.results.bindings[0]?.c?.value || '');
    return m ? [+m[1], +m[2]] : null;
  })().catch(() => null));
  return placeCache.get(qid);
}
