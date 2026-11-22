// Regional terrain shading for the "physical" base map: XYZ hillshade tiles (Web Mercator, 256 px) for a few
// regions, drawn under the political colours. Japan uses GSI's 陰影起伏図 tiles; Taiwan uses tiles made here
// from the Ministry of the Interior's 20 m DTM (public/relief/tw, built by data-pipeline/relief_tw.py).
// Flat maps: the tiles of the visible area are put together into one mosaic and resampled into the
// current projection; the globe uses MapLibre raster sources (see globe.js).
const BASE = import.meta.env.BASE_URL;

export const RELIEF_REGIONS = [
  { id: 'jp', bounds: [122.5, 20.0, 154.0, 45.8], minzoom: 5, maxzoom: 14,
    tiles: 'https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png',
    credit: { 'zh-Hant': '地形陰影：國土地理院（地理院タイル）', 'zh-Hans': '地形阴影：国土地理院（地理院タイル）', en: 'Hillshade: GSI Japan (地理院タイル)', ja: '陰影起伏図：国土地理院（地理院タイル）' } },
  { id: 'tw', local: true, bounds: [118.2, 21.85, 122.1, 26.4], minzoom: 6, maxzoom: 13,
    tiles: BASE + 'relief/tw/{z}/{x}/{y}.png',
    credit: { 'zh-Hant': '地形陰影：內政部 20 公尺 DTM 加工製作', 'zh-Hans': '地形阴影：内政部 20 米 DTM 加工制作', en: 'Hillshade: made from Taiwan MOI 20 m DTM', ja: '陰影：台湾内政部 20 m DTM を加工して作成' } },
];

// the other regional modes: grey hill shading like Taiwan's, made from the Terrain Tiles by
// data-pipeline/relief/make-relief.mjs into public/relief/<id> (index.json says which modes use which box)
const TERRAIN_CREDIT = { 'zh-Hant': '地形陰影：Terrain Tiles（SRTM、GMTED2010、ETOPO1 等）加工製作', 'zh-Hans': '地形阴影：Terrain Tiles（SRTM、GMTED2010、ETOPO1 等）加工制作', en: 'Hillshade: made from Terrain Tiles (SRTM, GMTED2010, ETOPO1 …)', ja: '陰影起伏：Terrain Tiles（SRTM・GMTED2010・ETOPO1 など）を加工して作成' };
const OWN = { taiwan: ['tw'], japan: ['jp'] };

// which regions a mode shows: a country mode always its own hill shading on the physical base map (a mode never
// fetches another country's tiles); the world modes Taiwan's and Japan's, with "detailed terrain" on
export function reliefFor(mode, regions, detailed = true) {
  const own = OWN[mode];
  return regions.filter(r => own ? own.includes(r.id) : detailed && (r.id === 'tw' || r.id === 'jp')).map(r => r.id);
}

const json = async u => { try { const m = await fetch(u); if (m.ok && (m.headers.get('content-type') || '').includes('json')) return await m.json(); } catch { /* none */ } return null; };
// local regions are used only when their tiles exist
export async function availableRelief() {
  const out = [];
  for (const r of RELIEF_REGIONS) {
    if (!r.local) { out.push(r); continue; }
    const m = await json(BASE + 'relief/' + r.id + '/meta.json'); if (m) out.push({ ...r, ...m });
  }
  const idx = await json(BASE + 'relief/index.json');
  for (const [id, modes] of Object.entries(idx?.regions || {})) {
    if (RELIEF_REGIONS.some(r => r.id === id)) continue;
    const m = await json(BASE + 'relief/' + id + '/meta.json'); if (!m) continue;
    out.push({ id, local: true, bounds: m.bounds, minzoom: m.minzoom, maxzoom: m.maxzoom, tiles: BASE + 'relief/' + id + '/{z}/{x}/{y}.' + (m.ext || 'png'), credit: TERRAIN_CREDIT });
    for (const mode of modes) (OWN[mode] ||= []).push(id);
  }
  return out;
}

const merc = lat => { const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };

export class Relief {
  constructor(regions, onload) { this.regions = regions; this.onload = onload; this.tiles = new Map(); this.mosaics = new Map(); }
  // credits of the regions in view
  credits(bbox) { return this.regions.filter(r => overlap(r.bounds, bbox)); }
  tile(url) {
    let t = this.tiles.get(url);
    if (!t) {
      t = { img: new Image(), ok: false };
      t.img.crossOrigin = 'anonymous';
      t.img.onload = () => { t.ok = true; this.onload(); };
      t.img.onerror = () => { t.bad = true; };
      t.img.src = url; this.tiles.set(url, t);
      if (this.tiles.size > 600) this.tiles.delete(this.tiles.keys().next().value);
    }
    return t;
  }
  // mosaic of one region for a lon/lat box at zoom z → {d, w, h, x0, y0, z} or null while loading
  mosaic(r, bbox, ppd) {
    const b = [Math.max(r.bounds[0], bbox[0]), Math.max(r.bounds[1], bbox[1]), Math.min(r.bounds[2], bbox[2]), Math.min(r.bounds[3], bbox[3])];
    if (b[0] >= b[2] || b[1] >= b[3]) return null;
    let z = Math.round(Math.log2(ppd * 360 / 256));
    z = Math.max(r.minzoom, Math.min(r.maxzoom, z));
    let x0, x1, y0, y1;
    for (;;) {
      const n = 2 ** z;
      x0 = Math.floor((b[0] + 180) / 360 * n); x1 = Math.floor((b[2] + 180) / 360 * n);
      y0 = Math.floor(merc(b[3]) * n); y1 = Math.floor(merc(b[1]) * n);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 80 || z <= r.minzoom) break;
      z--;
    }
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return null;
    const key = r.id + z + ':' + x0 + ',' + y0 + ',' + x1 + ',' + y1;
    const have = this.mosaics.get(key);
    if (have) return have;
    const list = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) list.push([x, y, this.tile(r.tiles.replace('{z}', z).replace('{x}', x).replace('{y}', y))]);
    if (list.some(([, , t]) => !t.ok && !t.bad)) return this.last?.[r.id] || null;   // keep showing the previous one while loading
    const w = (x1 - x0 + 1) * 256, h = (y1 - y0 + 1) * 256;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    for (const [x, y, t] of list) if (t.ok) g.drawImage(t.img, (x - x0) * 256, (y - y0) * 256);
    let d; try { d = g.getImageData(0, 0, w, h).data; } catch { return null; }
    const m = { d, w, h, x0, y0, z };
    this.mosaics.set(key, m);
    if (this.mosaics.size > 6) this.mosaics.delete(this.mosaics.keys().next().value);
    (this.last ||= {})[r.id] = m;
    return m;
  }
  // the current flat view's grey shading (white = no change, multiplied); each pixel takes the first region that
  // covers it
  render(proj, W, H, scale, clip) {
    const w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale)), s = 1 / scale;
    // visible lon/lat box (sampled)
    let bb = [180, 90, -180, -90];
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
      const ll = proj.invert([i / 12 * W, j / 12 * H]);
      if (!ll || !isFinite(ll[0]) || !isFinite(ll[1])) continue;
      bb = [Math.min(bb[0], ll[0]), Math.min(bb[1], ll[1]), Math.max(bb[2], ll[0]), Math.max(bb[3], ll[1])];
    }
    const regions = this.regions.filter(r => (!this.only || this.only.includes(r.id)) && overlap(r.bounds, bb));
    if (!regions.length) return null;
    const ppd = W / Math.max(0.01, bb[2] - bb[0]);
    const ms = regions.map(r => ({ r, m: this.mosaic(r, bb, ppd) })).filter(x => x.m);
    if (!ms.length) return null;
    const layer = list => {
      if (!list.length) return null;
      const out = document.createElement('canvas'); out.width = w; out.height = h;
      const g = out.getContext('2d'), img = g.createImageData(w, h), o = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ll = proj.invert([x * s, y * s]);
        if (!ll || !isFinite(ll[0]) || (clip && !clip(ll))) continue;
        for (const { r, m } of list) {
          if (ll[0] < r.bounds[0] || ll[0] > r.bounds[2] || ll[1] < r.bounds[1] || ll[1] > r.bounds[3]) continue;
          const n = 2 ** m.z;
          const px = Math.floor(((ll[0] + 180) / 360 * n - m.x0) * 256), py = Math.floor((merc(ll[1]) * n - m.y0) * 256);
          if (px < 0 || py < 0 || px >= m.w || py >= m.h) continue;
          const si = (py * m.w + px) * 4;
          if (m.d[si + 3] < 8) continue;                      // sea / no data
          const oi = (y * w + x) * 4;
          o[oi] = o[oi + 1] = o[oi + 2] = m.d[si];
          o[oi + 3] = m.d[si + 3];
          break;
        }
      }
      g.putImageData(img, 0, 0);
      return out;
    };
    return { shade: layer(ms), regions: regions.map(r => r.id) };
  }
}
const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
