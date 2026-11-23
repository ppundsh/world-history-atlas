// Hill shading for the "physical" base map of every regional mode, made from elevation data:
//   public/relief/<id>   grey hill shading like Taiwan's (light from several directions, flat ground clear), shown
//                        with "detailed terrain" on. Taiwan keeps its 20 m DTM shading and Japan GSI's.
// Source: the Terrain Tiles on AWS Open Data (Mapzen / Tilezen "terrarium" PNG tiles: SRTM, GMTED2010, ETOPO1,
// EU-DEM and others; https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
// Boxes: data-pipeline/satellite/regions.tsv (the same as the satellite layers). Each folder has {z}/{x}/{y}.webp and
// meta.json; public/relief/index.json says which modes use which. (The elevation bands of public/terrain, made by
// version 2, are no longer used: that folder is removed.)
// Downloaded tiles are cached in data-pipeline/sources/terrain/. Boxes already built are skipped (--refresh redoes).
//   node data-pipeline/relief/make-relief.mjs [--refresh] [id …]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), ROOT = path.resolve(DP, '..');
const OUT_R = path.join(ROOT, 'public', 'relief'), OLD_T = path.join(ROOT, 'public', 'terrain'), CACHE = path.join(DP, 'sources', 'terrain');
const SRC = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const args = process.argv.slice(2), REFRESH = args.includes('--refresh'), only = args.filter(a => !a.startsWith('--'));
const ZMIN = +(process.env.RELIEF_ZMIN || 5), ZCAP = +(process.env.RELIEF_ZCAP || 10), BUDGET = 400;
// the box each regional mode uses (Japan keeps GSI's hillshade, Taiwan its 20 m DTM tiles)
const MODES = { ar: ['argentina'], br: ['brazil'], eg: ['egypt'], fr: ['france'], de: ['germany'], in: ['india'], id: ['indonesia'], ir: ['iran'], it: ['italy'],
  kr: ['korea'], mx: ['mexico'], ma: ['morocco'], pl: ['poland'], cn: ['china', 'prc'], ru: ['russia'], es: ['spain'], th: ['thailand'], tr: ['turkey'], uk: ['uk'],
  us: ['usa'], us_ak: ['usa'], us_hi: ['usa'], vn: ['vietnam'], ph: ['philippines'] };
const boxes = fs.readFileSync(path.join(DP, 'satellite', 'regions.tsv'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
  .map(l => { const [id, a, b, c, d, note] = l.split('\t'); return { id, box: [+a, +b, +c, +d], note }; })
  .filter(r => MODES[r.id] && (!only.length || only.includes(r.id)));

const merc = (lat, n) => (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 * n;
function range(box, z) {
  const n = 2 ** z, [lon0, lat0, lon1, lat1] = box;
  return { x0: Math.floor((lon0 + 180) / 360 * n), x1: Math.ceil((lon1 + 180) / 360 * n) - 1, y0: Math.floor(merc(Math.min(85, lat1), n)), y1: Math.ceil(merc(Math.max(-85, lat0), n)) - 1 };
}
const count = (box, z) => { const r = range(box, z); return (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1); };

let requests = 0;
async function terrain(z, x, y) {                    // elevations (metres) of one 256×256 tile, or null for none
  const n = 2 ** z; x = ((x % n) + n) % n; if (y < 0 || y >= n) return null;
  const f = path.join(CACHE, String(z), String(x), y + '.png');
  if (!fs.existsSync(f)) {
    for (let i = 0; i < 4; i++) {
      try {
        requests++;
        const r = await fetch(SRC.replace('{z}', z).replace('{x}', x).replace('{y}', y), { signal: AbortSignal.timeout(60000) });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); break;
      } catch (e) { if (i === 3) { console.log(`\n  ${z}/${x}/${y} 下載失敗（${e.message}）`); return null; } await new Promise(s => setTimeout(s, 3000 * (i + 1))); }
    }
  }
  const { data } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const e = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) e[i] = data[i * 3] * 256 + data[i * 3 + 1] + data[i * 3 + 2] / 256 - 32768;
  return e;
}

const V = 3;                                          // layers built by an older version are made again
const FEATHER = 0.6;                                  // degrees over which the shading fades out at the box's edges

// the shading of one tile (RGBA: grey, flat ground white, faded at the box's edges), or null where it is all sea.
// Light from the north-west, mixed with weaker light from the west, north and south-west ("multidirectional"
// shading): slopes facing away from the main light are not lost in black, and ranges of every direction show.
const LIGHTS = [[315, 0.5], [270, 0.2], [0, 0.2], [225, 0.1]].map(([deg, w]) => [(360 - deg + 90) * Math.PI / 180, w]);
async function render(z, x, y, box) {
  const c = await terrain(z, x, y); if (!c) return null;
  const nb = {};
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) nb[dx + ',' + dy] = await terrain(z, x + dx, y + dy);
  const at = (i, j) => {
    if (i >= 0 && i < 256 && j >= 0 && j < 256) return c[j * 256 + i];
    const t = i < 0 ? nb['-1,0'] : i > 255 ? nb['1,0'] : j < 0 ? nb['0,-1'] : nb['0,1'];
    return t ? t[((j + 256) % 256) * 256 + (i + 256) % 256] : c[Math.min(255, Math.max(0, j)) * 256 + Math.min(255, Math.max(0, i))];
  };
  const n = 2 ** z, shade = Buffer.alloc(65536 * 4); let land = false;
  const ex = z <= 6 ? 5 : z <= 8 ? 3 : 2;             // vertical exaggeration: coarse tiles need more
  const zen = Math.PI / 4;
  for (let j = 0; j < 256; j++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y * 256 + j + 0.5) / (n * 256)))) * 180 / Math.PI;
    const cell = 40075016.7 * Math.cos(lat * Math.PI / 180) / (n * 256);
    const fy = Math.min(1, Math.max(0, Math.min(lat - box[1], box[3] - lat) / FEATHER));
    for (let i = 0; i < 256; i++) {
      const h = at(i, j), o = (j * 256 + i) * 4;
      if (h <= 0) continue;                                  // sea: transparent
      const lon = (x * 256 + i + 0.5) / (n * 256) * 360 - 180;
      const fe = fy * Math.min(1, Math.max(0, Math.min(lon - box[0], box[2] - lon) / FEATHER));
      if (fe <= 0) continue;
      land = true;
      // Horn's slope and aspect
      const a = at(i - 1, j - 1), bb = at(i, j - 1), cc = at(i + 1, j - 1), d = at(i - 1, j), f = at(i + 1, j), gg = at(i - 1, j + 1), hh = at(i, j + 1), k = at(i + 1, j + 1);
      const dzdx = ((cc + 2 * f + k) - (a + 2 * d + gg)) / (8 * cell) * ex, dzdy = ((gg + 2 * hh + k) - (a + 2 * bb + cc)) / (8 * cell) * ex;
      const slope = Math.atan(Math.hypot(dzdx, dzdy)), aspect = Math.atan2(dzdy, -dzdx);
      let hs = 0;
      for (const [az, w] of LIGHTS) hs += w * Math.max(0, Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(az - aspect));
      const v = Math.round(255 * Math.min(1, hs / Math.cos(zen)));          // flat ground white (no change), shadows grey
      // the shading is laid on by multiplying: white changes nothing, so the edge fade lightens toward white
      const fade = fe * fe * (3 - 2 * fe);
      shade[o] = shade[o + 1] = shade[o + 2] = Math.round(255 - (255 - v) * fade); shade[o + 3] = 255;
    }
  }
  return land ? shade : null;
}

const readIndex = d => fs.existsSync(path.join(d, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(d, 'index.json'), 'utf8')) : { regions: {} };
const idxR = readIndex(OUT_R);
for (const id of Object.keys(idxR.regions)) if (!MODES[id]) delete idxR.regions[id];
const saveIdx = () => { fs.mkdirSync(OUT_R, { recursive: true }); fs.writeFileSync(path.join(OUT_R, 'index.json'), JSON.stringify(idxR)); };
const webp = (px, f) => { fs.mkdirSync(path.dirname(f), { recursive: true }); return sharp(px, { raw: { width: 256, height: 256, channels: 4 } }).webp({ quality: 82, alphaQuality: 50 }).toFile(f); };
if (fs.existsSync(OLD_T)) { fs.rmSync(OLD_T, { recursive: true, force: true }); console.log('已移除不再使用的高程分層色塊（public/terrain）'); }
for (const { id, box, note } of boxes) {
  let built = false; try { built = JSON.parse(fs.readFileSync(path.join(OUT_R, id, 'meta.json'), 'utf8')).v === V; } catch { /* not yet */ }
  if (!REFRESH && built) { console.log(`${id}（${note}）已建立，略過`); idxR.regions[id] = MODES[id]; continue; }
  fs.rmSync(path.join(OUT_R, id), { recursive: true, force: true });   // an older build's tiles go
  let zmax = ZMIN; while (zmax < ZCAP && count(box, zmax + 1) <= BUDGET) zmax++;
  let total = 0; for (let z = ZMIN; z <= zmax; z++) total += count(box, z);
  let done = 0, written = 0;
  for (let z = ZMIN; z <= zmax; z++) {
    const r = range(box, z);
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      const px = await render(z, x, y, box);
      if (px) { await webp(px, path.join(OUT_R, id, String(z), String(x), y + '.webp')); written++; }
      process.stdout.write(`\r${id}（${note}）層級 ${ZMIN}–${zmax}：${++done}/${total}，已下載 ${requests} 張高程圖磚      `);
    }
  }
  fs.writeFileSync(path.join(OUT_R, id, 'meta.json'), JSON.stringify({ v: V, bounds: box, minzoom: ZMIN, maxzoom: zmax, ext: 'webp' }));
  idxR.regions[id] = MODES[id];
  saveIdx();
  console.log(`\n  ${written} 張山影圖磚`);
}
saveIdx();
console.log('完成。高程資料：Terrain Tiles（AWS 開放資料；SRTM、GMTED2010、ETOPO1、EU-DEM 等）。');
