// Hidden mode: Servants of Fate/Grand Order placed at the home of their historical or legendary originals.
// classes.tsv + servants.tsv → public/data/fgo.json, in the same shape as the thematic modes (families, points).
// No artwork from the game is used: pictures are Wikimedia Commons portraits of the originals, found through
// Wikidata in the browser (see artworks.js), and the notes describe the originals in this project's own words.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';
const here = path.dirname(fileURLToPath(import.meta.url));
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });
const rows = (f, n) => fs.readFileSync(path.join(here, f), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map((l, i) => {
  const c = l.split('\t'); if (c.length !== n) throw new Error(`${f} line ${i}: ${c.length} columns`); return c;
});
const families = rows('classes.tsv', 5).map(([id, color, hant, en, ja]) => ({ id, color, n: [en, hant, toHans(hant), ja] }));
const series = Object.fromEntries(rows('series.tsv', 2).map(([id, w]) => [id, w.split(',')]));
const images = fs.existsSync(path.join(here, 'images.tsv')) ? Object.fromEntries(rows('images.tsv', 3).map(([id, url, credit]) => [id, { url, credit }])) : {};
let points = rows('servants.tsv', 13).map(([id, f, a, b, lon, lat, hant, en, ja, dh, de, wen, q]) => ({
  id, f, a: +a, b: +b, lon: +lon, lat: +lat, n: [en, hant, toHans(hant), ja], d: [de, dh, toHans(dh), de], w: ['', wen, ''], ...(q ? { q } : {}),
  ...(series[id] ? { series: series[id] } : {}), ...(images[id] ? { img: images[id] } : {}) }));
// Servants sharing one original (Alexander and Iskandar, Elisabeth and Carmilla …) are one person on the map:
// one point under both names, with both notes and every work they appear in
for (let i = 0; i < points.length; i++) {
  const p = points[i], key = p.q || p.w[1];
  if (!key) continue;
  for (let j = points.length - 1; j > i; j--) {
    const o = points[j];
    if ((o.q || o.w[1]) !== key) continue;
    p.sub = [...(p.sub || [{ id: p.id, n: p.n, f: p.f }]), { id: o.id, n: o.n, f: o.f }];       // each Servant's own name, for custom pictures
    p.n = p.n.map((x, k) => x + (k === 0 ? ' / ' : '／') + o.n[k]);
    p.ids = [...(p.ids || [p.id]), o.id];
    if (o.series) p.series = [...new Set([...(p.series || []), ...o.series])];
    if (!p.img && o.img) p.img = o.img;
    points.splice(j, 1);
  }
}
// optional custom pictures live in public/fgo/custom (kept out of git); vite.config.js lists them for the site.
// Here only a check: picture files whose name matches no Servant id.
const CUSTOM = path.join(here, '..', '..', 'public', 'fgo', 'custom');
if (fs.existsSync(CUSTOM)) {
  const ids = new Set(points.flatMap(p => p.ids || [p.id]));
  const pics = fs.readdirSync(CUSTOM).filter(f => /\.(webp|png|jpe?g)$/i.test(f));
  const stray = pics.filter(f => !ids.has(f.replace(/\.[^.]+$/, '')));
  if (stray.length) console.warn('fgo custom pictures with no matching id:', stray.join(', '));
  console.log('fgo custom pictures:', pics.length - stray.length);
}
// the list of Servants for naming custom pictures: data-pipeline/fgo/servant-ids.csv (opens in Excel)
{
  const cls = Object.fromEntries(families.map(f => [f.id, f.n]));
  const q = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  // one row per Servant (two Servants sharing an original are one point on the map, but each has its own picture)
  const rows = points.slice().sort((a, b) => a.f.localeCompare(b.f) || a.a - b.a)
    .flatMap(p => (p.sub || [{ id: p.id, n: p.n, f: p.f }]).map(x => [cls[x.f][1], x.n[1], x.n[0], x.n[3], x.id, x.id + '.webp', p.sub ? '與 ' + p.sub.filter(y => y.id !== x.id).map(y => y.n[1]).join('、') + ' 同一原型，地圖上同一個點' : ''].map(q).join(',')));
  fs.writeFileSync(path.join(here, 'servant-ids.csv'), '\ufeff' + ['職階,英靈（繁中）,English,日本語,id,檔名範例,備註', ...rows].join('\r\n') + '\r\n');
}
// the timeline: each Servant's original appears in their year
const events = points.map(p => ({ y: p.a, lon: p.lon, lat: p.lat, n: p.n, d: p.d, w: ['', p.w[1], ''], ...(p.series ? { big: true } : {}) })).sort((a, b) => a.y - b.y);
fs.writeFileSync(path.join(here, '..', '..', 'public', 'data', 'fgo.json'), JSON.stringify({ families, areas: [], points, flows: [], events, pointsAlways: true, pictures: true }));
console.log('fgo.json:', points.length, 'servants');
