// Serves the bundled thumbnails (offline/img/<name>.webp) by cutting them out of the period sheets made by
// data-pipeline/offline/sheets.mjs. A sheet is downloaded only when one of its pictures is first shown; the cut-out
// pictures are kept in the browser's cache, so later visits (and offline use) need no download at all.
// Without sheets.json, or for a picture not in any sheet, the request goes to the network as usual.
const SCOPE = self.registration.scope;
const INDEX = SCOPE + 'offline/sheets.json';
let index = null;                                    // Promise<{ v, sheets, at } | null>
const bitmaps = new Map();                           // sheet file → Promise<ImageBitmap>, the last few kept

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', e => { if (e.data === 'reload-sheets') index = null; });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (!url.startsWith(SCOPE + 'offline/img/')) return;
  const name = url.slice((SCOPE + 'offline/img/').length).split(/[?#]/)[0].replace(/\.webp$/, '');
  e.respondWith(serve(name, e.request).catch(() => fetch(e.request)));
});

function loadIndex() {
  return index ||= fetch(INDEX, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null).then(async I => {
    if (I) for (const k of await caches.keys()) if (k.startsWith('pics-') && k !== 'pics-' + I.v) caches.delete(k);   // older sheets
    return I;
  });
}
function sheetBitmap(f) {
  if (!bitmaps.has(f)) {
    bitmaps.set(f, fetch(SCOPE + 'offline/' + f).then(r => { if (!r.ok) throw r.status; return r.blob(); }).then(b => createImageBitmap(b)));
    bitmaps.get(f).catch(() => bitmaps.delete(f));
    while (bitmaps.size > 3) { const [k, p] = bitmaps.entries().next().value; bitmaps.delete(k); p.then(b => b.close?.()).catch(() => {}); }
  } else { const p = bitmaps.get(f); bitmaps.delete(f); bitmaps.set(f, p); }       // most recently used last
  return bitmaps.get(f);
}
async function serve(name, req) {
  const I = await loadIndex(); const a = I?.at?.[name];
  if (!a) return fetch(req);
  const cache = await caches.open('pics-' + I.v), key = SCOPE + 'offline/img/' + name + '.webp';
  const hit = await cache.match(key); if (hit) return hit;
  const [s, x, y, w, h] = a, bmp = await sheetBitmap(I.sheets[s].f);
  const c = new OffscreenCanvas(w, h); c.getContext('2d').drawImage(bmp, x, y, w, h, 0, 0, w, h);
  let blob = await c.convertToBlob({ type: 'image/webp', quality: 0.9 });
  const res = new Response(blob, { headers: { 'Content-Type': blob.type, 'Cache-Control': 'max-age=31536000' } });
  cache.put(key, res.clone()).catch(() => {});
  return res;
}
