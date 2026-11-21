// Pictures and descriptions bundled with the site (public/offline, built by data-pipeline/offline/fetch.mjs):
// thumbnails from Wikimedia Commons, shrunk and re-encoded as WebP, with each file's author and licence;
// introductions of Wikipedia articles (CC BY-SA 4.0) with links to them; Wikidata facts for the artworks.
// When the bundle is there the site asks Wikimedia for nothing at all (it also works offline); before it has
// been generated, the modules fall back to asking Wikipedia / Wikidata in the browser as they used to.

const BASE = import.meta.env.BASE_URL + 'offline/';
const cache = {};
export function offlineJson(name) {
  return (cache[name] ||= fetch(BASE + name).then(r => { if (!r.ok) throw r.status; return r.json(); }).catch(() => null));
}
// files.json: Commons file name → [image file in offline/img, author, licence]
const files = offlineJson('files.json');
export async function isOffline() { return (await files) != null; }

// The thumbnails are published packed into period sheets (offline/sheets.json, data-pipeline/offline/sheets.mjs).
// public/sw.js cuts each picture out of its sheet when the page asks for offline/img/<name>.webp, so only the
// sheets of the periods being viewed are downloaded. Where a service worker can't run, the page cuts them itself.
const sheets = offlineJson('sheets.json');
const swReady = (async () => {
  const sw = navigator.serviceWorker;
  if (!sw || !(await sheets) || !/^https?:$/.test(location.protocol)) return false;
  try {
    await sw.register(import.meta.env.BASE_URL + 'sw.js');
    if (sw.controller) return true;
    return await new Promise(res => { sw.addEventListener('controllerchange', () => res(true), { once: true }); setTimeout(() => res(!!sw.controller), 4000); });
  } catch { return false; }
})();
const sheetBitmaps = new Map(), cuts = new Map();
async function cutLocal(name) {                        // no service worker: cut the picture out here
  const S = await sheets, a = S?.at?.[name.replace(/\.webp$/, '')]; if (!a) return null;
  if (!cuts.has(name)) cuts.set(name, (async () => {
    const [s, x, y, w, h] = a, f = S.sheets[s].f;
    if (!sheetBitmaps.has(f)) sheetBitmaps.set(f, fetch(BASE + f).then(r => r.blob()).then(b => createImageBitmap(b)));
    const bmp = await sheetBitmaps.get(f), c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, x, y, w, h, 0, 0, w, h);
    return URL.createObjectURL(await new Promise(r => c.toBlob(r, 'image/webp', 0.9)));
  })().catch(() => null));
  return cuts.get(name);
}
async function thumbUrl(name) {
  if (await swReady) return BASE + 'img/' + name;
  return (await cutLocal(name)) || BASE + 'img/' + name;
}

const commonsPage = f => 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(f.replace(/ /g, '_'));
// a bundled picture: { thumb, page, author, lic, credit }, or null when the file isn't in the bundle
export async function offlineFile(name) {
  const f = await files; if (!f || !name) return null;
  const e = f[name.replace(/_/g, ' ')]; if (!e) return null;
  return { thumb: await thumbUrl(e[0]), page: commonsPage(name), author: e[1] || '', lic: e[2] || '', credit: [e[1], e[2]].filter(Boolean).join(' · '), file: name };
}
