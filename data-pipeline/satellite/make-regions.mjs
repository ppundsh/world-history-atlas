// Sharper satellite layers for every regional mode, from NASA Blue Marble: Next Generation (public domain,
// credit "NASA Earth Observatory"), 500 m per pixel. Downloads the eight 21600×21600 tiles A1–D2 of one month
// (about 300 MB, once, into data-pipeline/sources/bmng/), then for each box in regions.tsv writes
//   public/basemap/<id>/{z}/{x}/{y}.webp   Web-Mercator tiles for the 3D globe (zoom 6 up to 8, as fine as the box allows)
//   public/basemap/<id>.jpg                an equirectangular image for the flat maps (at most 4096 px wide)
// and adds the box to public/basemap/sat/meta.json. Boxes already built (by this version) are skipped (unless --refresh).
//   node data-pipeline/satellite/make-regions.mjs [--refresh] [id …]
// Needs sharp (fetch-offline.ps1 installs it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

sharp.cache(false);
const DP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), ROOT = path.resolve(DP, '..');
const OUT = path.join(ROOT, 'public', 'basemap'), META = path.join(OUT, 'sat', 'meta.json');
const SRC = path.join(DP, 'sources', 'bmng'), MONTH = '200407';
const URL0 = `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.${MONTH}.3x21600x21600.`;
const args = process.argv.slice(2), REFRESH = args.includes('--refresh'), only = args.filter(a => !a.startsWith('--'));
const V = 2;                                        // boxes built by an older version are made again
const NATIVE = 240, BUDGET = 512, ZMIN = 6, ZCAP = 8, IMG_MAX = 4096;   // 500 m data: zoom 8 (≈600 m) is as sharp as it gets

// the eight source tiles: columns A–D (90° each from 180°W), rows 1 (north) and 2 (south)
const TILES = [];
for (const [r, lat1] of [[1, 90], [2, 0]]) for (const [i, c] of ['A', 'B', 'C', 'D'].entries()) TILES.push({ id: c + r, lon0: -180 + 90 * i, lat1, file: path.join(SRC, `world.topo.bathy.${MONTH}.3x21600x21600.${c}${r}.jpg`) });

const boxes = fs.readFileSync(path.join(DP, 'satellite', 'regions.tsv'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
  .map(l => { const [id, a, b, c, d, note] = l.split('\t'); return { id, box: [+a, +b, +c, +d], note }; })
  .filter(r => !only.length || only.includes(r.id));

async function download(t) {
  if (fs.existsSync(t.file) && fs.statSync(t.file).size > 1e6) return;
  fs.mkdirSync(SRC, { recursive: true });
  const url = URL0 + t.id + '.jpg';
  for (let i = 0; i < 4; i++) {
    try {
      process.stdout.write(`下載 Blue Marble ${t.id}（約 20–60 MB）… `);
      const r = await fetch(url, { signal: AbortSignal.timeout(900000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(t.file + '.part', buf); fs.renameSync(t.file + '.part', t.file);
      console.log(`${(buf.length / 1e6).toFixed(0)} MB`); return;
    } catch (e) { console.log(`失敗（${e.message}），重試`); await new Promise(s => setTimeout(s, 10000 * (i + 1))); }
  }
  throw new Error('無法下載 ' + url);
}

const merc = (lat, n) => (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 * n;
function tileRange(box, z) {
  const n = 2 ** z, [lon0, lat0, lon1, lat1] = box;
  return { x0: Math.floor((lon0 + 180) / 360 * n), x1: Math.ceil((lon1 + 180) / 360 * n) - 1, y0: Math.floor(merc(Math.min(85.05, lat1), n)), y1: Math.ceil(merc(Math.max(-85.05, lat0), n)) - 1 };
}
const count = (box, z) => { const t = tileRange(box, z); return (t.x1 - t.x0 + 1) * (t.y1 - t.y0 + 1); };

// the box as one RGB image at `res` pixels per degree, put together from the source tiles it touches
async function mosaic(box, res) {
  const [lon0, lat0, lon1, lat1] = box, W = Math.round((lon1 - lon0) * res), H = Math.round((lat1 - lat0) * res);
  const parts = [];
  for (const t of TILES) {
    const a = Math.max(lon0, t.lon0), b = Math.min(lon1, t.lon0 + 90), c = Math.max(lat0, t.lat1 - 90), d = Math.min(lat1, t.lat1);
    if (a >= b || c >= d) continue;
    await download(t);
    const left = Math.round((a - t.lon0) * NATIVE), top = Math.round((t.lat1 - d) * NATIVE);
    const width = Math.min(21600 - left, Math.round((b - a) * NATIVE)), height = Math.min(21600 - top, Math.round((d - c) * NATIVE));
    const w = Math.max(1, Math.round((b - a) * res)), h = Math.max(1, Math.round((d - c) * res));
    const input = await sharp(t.file, { limitInputPixels: false }).extract({ left, top, width, height }).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    parts.push({ input, raw: { width: w, height: h, channels: 3 }, left: Math.round((a - lon0) * res), top: Math.round((lat1 - d) * res) });
  }
  // composite() hands back RGBA: the alpha is dropped again, so the pixels are 3 bytes as read below (version 1
  // read the 4-byte pixels as 3-byte ones and made grey, three-times-repeated noise)
  const { data, info } = await sharp({ create: { width: W, height: H, channels: 3, background: '#0b1424' }, limitInputPixels: false }).composite(parts).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3 || data.length !== W * H * 3) throw new Error(`mosaic: ${info.channels} channels, ${data.length} bytes`);
  return { data, W, H, res };
}

async function build({ id, box, note }) {
  const meta = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, 'utf8')) : { maxzoom: 5, regions: [] };
  if (!REFRESH && meta.regions?.some(r => r.id === id && r.v === V) && fs.existsSync(path.join(OUT, id + '.jpg'))) { console.log(`${id}（${note}）已建立，略過`); return; }
  let zmax = ZMIN; while (zmax < ZCAP && count(box, zmax + 1) <= BUDGET) zmax++;
  const res = Math.min(NATIVE, 256 * 2 ** zmax / 360);
  process.stdout.write(`${id}（${note}）：層級 ${ZMIN}–${zmax}，`);
  const M = await mosaic(box, res);
  const [lon0, lat0, lon1, lat1] = box;
  let n = 0;
  for (let z = ZMIN; z <= zmax; z++) {
    const N = 2 ** z, t = tileRange(box, z);
    for (let ty = t.y0; ty <= t.y1; ty++) for (let tx = t.x0; tx <= t.x1; tx++) {
      const px = Buffer.alloc(256 * 256 * 4); let any = false;
      for (let j = 0; j < 256; j++) {
        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty * 256 + j + 0.5) / (N * 256)))) * 180 / Math.PI;
        const y = Math.floor((lat1 - lat) * M.res); if (y < 0 || y >= M.H) continue;
        for (let i = 0; i < 256; i++) {
          const lon = (tx * 256 + i + 0.5) / (N * 256) * 360 - 180, x = Math.floor((lon - lon0) * M.res);
          if (x < 0 || x >= M.W) continue;
          const s = (y * M.W + x) * 3, d = (j * 256 + i) * 4;
          px[d] = M.data[s]; px[d + 1] = M.data[s + 1]; px[d + 2] = M.data[s + 2]; px[d + 3] = 255; any = true;
        }
      }
      if (!any) continue;
      const dir = path.join(OUT, id, String(z), String(tx)); fs.mkdirSync(dir, { recursive: true });
      await sharp(px, { raw: { width: 256, height: 256, channels: 4 } }).webp({ quality: 78, alphaQuality: 60 }).toFile(path.join(dir, ty + '.webp'));
      n++;
    }
  }
  // the flat maps' image
  const s = Math.min(1, IMG_MAX / Math.max(M.W, M.H));
  await sharp(M.data, { raw: { width: M.W, height: M.H, channels: 3 } }).resize(Math.round(M.W * s), Math.round(M.H * s)).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(path.join(OUT, id + '.jpg'));
  meta.regions = (meta.regions || []).filter(r => r.id !== id).concat([{ id, v: V, bounds: [lon0, lat0, lon1, lat1], minzoom: ZMIN, maxzoom: zmax, image: id + '.jpg' }]);
  meta.regions.sort((a, b) => a.minzoom - b.minzoom || a.maxzoom - b.maxzoom);
  fs.mkdirSync(path.dirname(META), { recursive: true }); fs.writeFileSync(META, JSON.stringify(meta));
  console.log(`${n} 張圖磚、${id}.jpg`);
}

for (const b of boxes) await build(b);
console.log('完成。圖片來源：NASA Earth Observatory（Blue Marble: Next Generation，公有領域）。');
