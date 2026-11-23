// Photographs for info cards. A Wikipedia article's lead picture is often a map of the country's territory or of
// a battle, a flag or an emblem: on this site, which is itself a map, such pictures say nothing, so they are passed
// over for another photograph from the same article. A country's card shows a photograph of the country (Wikidata
// "image", else its Wikivoyage banner, else its article's photograph); its flag goes in the card's heading.

import { isOffline, offlineJson, offlineFile } from './offline.js';

export const MAPLIKE = /(^|[\s_(,-])maps?([\s_.),-]|$)|locator|location|orthographic|projection|territor|extent|borders?\b|boundar|\bcarte\b|\bkarte\b|\bmapa\b|地図|地圖|地图|版圖|版图|疆域|位置|flag|coat of arms|emblem|seal of|logo|\.svg$/i;
const PHOTO = /\.(jpe?g|webp|tiff?)$/i;

// a Commons file: thumbnail, page, author and licence (null if it is not on Commons)
const infos = new Map();
export function commonsInfo(file, width = 480) {
  const key = file + '|' + width;
  if (!infos.has(key)) infos.set(key, fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=' + width
    + '&iiextmetadatafilter=LicenseShortName|Artist&titles=' + encodeURIComponent('File:' + file)).then(r => r.json()).then(j => {
    const p = Object.values(j.query?.pages || {})[0], ii = p?.imageinfo?.[0];
    if (!ii || p.missing != null && !ii.thumburl) return null;
    if (!/\/wikipedia\/commons\//.test(ii.thumburl || '')) return null;
    const m = ii.extmetadata || {}, author = (m.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return { thumb: ii.thumburl, page: ii.descriptionurl, file, author, lic: m.LicenseShortName?.value || '', credit: [author.slice(0, 50), m.LicenseShortName?.value].filter(Boolean).join(' · ') };
  }).catch(() => null));
  return infos.get(key);
}

// another photograph from the article (its images in turn), when the lead picture is a map, flag or emblem
const alts = new Map();
export function altPhoto(title, wl = 'en', width = 480) {
  const key = wl + ':' + title;
  if (!alts.has(key)) alts.set(key, (async () => {
    const j = await (await fetch(`https://${wl}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=images&imlimit=50&titles=` + encodeURIComponent(title))).json();
    const files = Object.values(j.query?.pages || {}).flatMap(p => (p.images || []).map(x => x.title.replace(/^[^:]+:/, '')))
      .filter(f => PHOTO.test(f) && !MAPLIKE.test(f));
    for (const f of files.slice(0, 4)) { const i = await commonsInfo(f, width); if (i) return i; }
    return null;
  })().catch(() => null));
  return alts.get(key);
}

// a photograph of a country (by Wikidata id); sitelink: [title, wiki language] of its article, if known
const countries = new Map();
export function countryPhoto(qid, width = 480) {
  if (!/^Q\d+$/.test(qid || '')) return Promise.resolve(null);
  if (!countries.has(qid)) countries.set(qid, (async () => {
    if (await isOffline()) {
      const f = await offlineFile((await offlineJson('countries.json'))?.[qid]);
      return f && { thumb: f.thumb, page: f.page, credit: f.credit };
    }
    const j = await (await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=claims|sitelinks&sitefilter=zhwiki|enwiki|jawiki&ids=' + qid)).json();
    const e = j.entities?.[qid]; if (!e) return null;
    const vals = pid => (e.claims?.[pid] || []).filter(c => c.mainsnak?.datavalue?.value && c.rank !== 'deprecated')
      .sort((a, b) => (b.rank === 'preferred') - (a.rank === 'preferred')).map(c => c.mainsnak.datavalue.value);
    for (const f of [...vals('P18'), ...vals('P948')]) if (!MAPLIKE.test(f)) { const i = await commonsInfo(f, width); if (i) return i; }
    for (const wl of ['en', 'zh', 'ja']) {                    // the article's own photographs
      const t = e.sitelinks?.[wl + 'wiki']?.title; if (!t) continue;
      const i = await altPhoto(t, wl, width); if (i) return i;
    }
    return null;                                              // (the flag is shown in the card's heading)
  })().catch(() => null));
  return countries.get(qid);
}
