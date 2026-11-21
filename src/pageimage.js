// The lead picture of a Wikipedia article, for places, buildings, banks and currencies mentioned in the modes.
// Only pictures hosted on Wikimedia Commons are used (free licences), with their author and licence.

import { isOffline, offlineJson, offlineFile } from './offline.js';

const info = new Map(), imgs = new Map();
let listener = null;
export function setPageImageListener(fn) { listener = fn; }

export function pageImage(title, wl = 'en') {
  if (!title) return Promise.resolve(null);
  const key = wl + ':' + title;
  if (!info.has(key)) info.set(key, (async () => {
    if (await isOffline()) {                          // offline/pages.json: "wl:title" → Commons file
      const f = await offlineFile((await offlineJson('pages.json'))?.[key]);
      return f && { thumb: f.thumb, page: f.page, credit: f.credit };
    }
    const j = await (await fetch(`https://${wl}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail|name&pithumbsize=320&titles=`
      + encodeURIComponent(title))).json();
    const p = Object.values(j.query?.pages || {})[0], th = p?.thumbnail?.source;
    if (!th || !/\/wikipedia\/commons\//.test(th) || !p.pageimage) return null;
    const out = { thumb: th, page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(p.pageimage), credit: '' };
    try {
      const c = await (await fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata'
        + '&iiextmetadatafilter=LicenseShortName|Artist&titles=' + encodeURIComponent('File:' + p.pageimage))).json();
      const m = Object.values(c.query?.pages || {})[0]?.imageinfo?.[0]?.extmetadata || {};
      out.credit = [(m.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 50), m.LicenseShortName?.value].filter(Boolean).join(' · ');
    } catch { /* credit stays empty; the file page is linked */ }
    return out;
  })().catch(() => null));
  return info.get(key);
}

// the picture as a loaded image for drawing on the map (null until it has loaded)
export function pagePicture(title) {
  if (!title) return null;
  let e = imgs.get(title);
  if (!e) {
    e = { img: null }; imgs.set(title, e);
    pageImage(title).then(i => { if (!i) return; const im = new Image(); if (!/^https?:/.test(i.thumb) || /wikimedia/.test(i.thumb)) im.crossOrigin = 'anonymous'; im.onload = () => { e.img = im; listener?.(); }; im.src = i.thumb; });
  }
  return e.img;
}

// a figure for an info panel
export function figureHtml(i, label, esc) {
  if (!i) return '';
  return `<figure class="evpic"><a href="${esc(i.page)}" target="_blank" rel="noopener"><img src="${esc(i.thumb)}" alt=""></a>
    <figcaption>${label}：${esc(i.credit || '—')} · <a href="${esc(i.page)}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>`;
}
