import { isEmph, ring } from './emph.js';
// Power plants and special economic zones of a country mode (data-pipeline/econ/build-econ.mjs), each layer with its
// own switch. Loaded the first time either switch is on in that mode; drawn over the map, under the other markers.
const BASE = import.meta.env.BASE_URL + 'data/econ/';
const cache = new Map();
export function loadEcon(region) {
  if (!cache.has(region)) cache.set(region, fetch(BASE + region + '.json').then(r => (r.ok ? r.json() : { plants: [], zones: [] })).catch(() => ({ plants: [], zones: [] })).then(d => { cache.set(region, d); return d; }));
  const v = cache.get(region);
  return v instanceof Promise ? v : Promise.resolve(v);
}
export const econData = region => { const v = cache.get(region); return v && !(v instanceof Promise) ? v : null; };

// fuels in build-econ.mjs order: colour, then names (English, 繁中, 简中, 日本語)
export const FUEL = [
  ['#374151', 'Coal', '燃煤', '燃煤', '石炭'], ['#f59e0b', 'Gas', '天然氣', '天然气', 'ガス'], ['#92400e', 'Oil', '燃油', '燃油', '石油'],
  ['#7c3aed', 'Nuclear', '核能', '核能', '原子力'], ['#0284c7', 'Hydro', '水力', '水力', '水力'], ['#059669', 'Wind', '風力', '风力', '風力'],
  ['#eab308', 'Solar', '太陽能', '太阳能', '太陽光'], ['#65a30d', 'Biomass', '生質能', '生物质能', 'バイオマス'], ['#dc2626', 'Geothermal', '地熱', '地热', '地熱'],
  ['#78716c', 'Waste', '廢棄物', '废弃物', '廃棄物'], ['#0ea5e9', 'Storage', '儲能', '储能', '蓄電'], ['#a855f7', 'Cogeneration', '汽電共生', '热电联产', 'コージェネ'],
  ['#57534e', 'Petcoke', '石油焦', '石油焦', '石油コークス'], ['#0891b2', 'Wave and tidal', '潮汐・波浪', '潮汐・波浪', '潮力・波力'], ['#9ca3af', 'Other', '其他', '其他', 'その他'],
];
export const ZONE = {
  epz: ['#0d9488', '▣', 'Export-processing zone', '加工出口區', '加工出口区', '輸出加工区'],
  sez: ['#dc2626', '◆', 'Special economic zone', '經濟特區', '经济特区', '経済特区'],
  ftz: ['#2563eb', '◈', 'Free-trade zone', '自由貿易區', '自由贸易区', '自由貿易区'],
  park: ['#ca8a04', '▤', 'Industrial park', '工業區', '工业区', '工業団地'],
  sci: ['#7c3aed', '◉', 'Science park', '科學園區', '科学园区', 'サイエンスパーク'],
  fin: ['#047857', '¤', 'Financial centre', '金融特區', '金融特区', '金融特区'],
  biz: ['#be185d', '▦', 'Business district', '商業特區', '商业特区', 'ビジネス地区'],
};
const minMW = k => (k < 1.5 ? 300 : k < 3 ? 80 : k < 6 ? 20 : k < 12 ? 5 : 1);   // small plants only once zoomed in

// draws the layers; fills `hits` with clickable boxes ({x0, y0, x1, y1, plant | zone})
export function drawEcon(ctx, project, { region, plants: showPlants, zones: showZones, year, k, col, font }, hits) {
  const d = econData(region); if (!d) return;
  ctx.save();
  const boxes = [], free = bx => !boxes.some(q => bx[0] < q[2] && q[0] < bx[2] && bx[1] < q[3] && q[1] < bx[3]);
  if (showPlants) {
    const lim = minMW(k), list = d.plants, W = ctx.canvas.clientWidth || 2000, H = ctx.canvas.clientHeight || 2000;
    // the 300 largest on screen (the list is sorted by size; size unknown, from OpenStreetMap, only zoomed in),
    // drawn largest last so they sit on top
    const shown = [];
    for (const p of list) {
      if (shown.length >= 300) break;
      if ((p.mu ? k < 6 : p.mw < lim) || p.a > year || (p.b != null && year >= p.b)) continue;     // not built yet, or closed (retired.tsv)
      const q = project([p.x, p.y]); if (!q || q[0] < -10 || q[1] < -10 || q[0] > W + 10 || q[1] > H + 10) continue;
      shown.push([p, q]);
    }
    for (let i = shown.length - 1; i >= 0; i--) {
      const [p, q] = shown[i];
      const r = p.mu ? 3 : Math.min(7, 1.8 + Math.sqrt(p.mw) / 9);
      ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 2 * Math.PI);
      ctx.fillStyle = FUEL[p.f][0]; ctx.globalAlpha = p.k ? 0.92 : 0.6; ctx.fill();
      ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.stroke();
      if (p.f === 3) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q[0], q[1], r * 0.35, 0, 2 * Math.PI); ctx.fill(); }   // nuclear: a dot inside
      if (isEmph('e:p:' + p.n + ':' + p.x)) ring(ctx, q[0], q[1], r + 3, FUEL[p.f][0]);
      hits.push({ x0: q[0] - r - 2, y0: q[1] - r - 2, x1: q[0] + r + 2, y1: q[1] + r + 2, plant: p, r });
    }
    // names of the largest, once zoomed in, where they do not run into one another
    const drawn = hits.filter(h => h.plant).length;
    if (drawn && drawn <= 60) {
      ctx.font = `600 10px ${font}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      let n = 0;
      for (let i = hits.length - 1; i >= 0 && n < 40; i--) {
        const h = hits[i]; if (!h.plant) continue;
        const x = h.x1 + 1, y = (h.y0 + h.y1) / 2, w = ctx.measureText(h.plant.n).width, bx = [x, y - 7, x + w, y + 7];
        if (!free(bx)) continue;
        boxes.push(bx); n++;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(h.plant.n, x, y);
        ctx.fillStyle = '#1f2937'; ctx.fillText(h.plant.n, x, y);
      }
    }
  }
  // zones over the plants. A country's key zones (z.key) are drawn larger and always named; the others are
  // smaller, and named only once zoomed in where there is room
  if (showZones) {
    const live = d.zones.filter(z => !(z.a > year + 0.999 || z.b < year));
    const zboxes = [], freeZ = bx => !zboxes.some(q => bx[0] < q[2] && q[0] < bx[2] && bx[1] < q[3] && q[1] < bx[3]);
    for (const pass of [1, 0]) for (const z of live) {
      if (!!z.key !== !!pass) continue;
      const q = project([z.x, z.y]); if (!q) continue;
      const [color, sym] = ZONE[z.kind], name = z.n[col] || z.n[0], big = !!z.key, r = big ? 10 : 7;
      ctx.save(); if (!big) ctx.globalAlpha = 0.85;
      if (big) { ctx.beginPath(); ctx.arc(q[0], q[1], 11, 0, 2 * Math.PI); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); }
      ctx.font = `700 ${big ? 15 : 12}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; if (!big) ctx.strokeText(sym, q[0], q[1]); ctx.fillStyle = color; ctx.fillText(sym, q[0], q[1]);
      const named = big || k >= 6;
      if (named) {
        ctx.font = `${big ? 700 : 600} ${big ? 12 : 10.5}px ${font}`;
        const w = ctx.measureText(name).width, h = big ? 8 : 7, test = big ? freeZ : (bx => freeZ(bx) && free(bx));
        // the name to the right, else to the left, else left out (the symbol stays, and the card names it)
        let bx = [q[0] + r + 2, q[1] - h, q[0] + r + 4 + w, q[1] + h], x = q[0] + r + 3, al = 'left';
        if (!test(bx)) { bx = [q[0] - r - 4 - w, q[1] - h, q[0] - r - 2, q[1] + h]; x = q[0] - r - 3; al = 'right'; }
        if (test(bx)) {
          zboxes.push(bx); boxes.push(bx); ctx.textAlign = al;
          ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(255,255,255,0.94)'; ctx.strokeText(name, x, q[1]); ctx.fillStyle = color; ctx.fillText(name, x, q[1]);
        }
      }
      ctx.restore();
      zboxes.push([q[0] - r, q[1] - r, q[0] + r, q[1] + r]);
      if (isEmph('e:z:' + z.id)) ring(ctx, q[0], q[1], r + 3, color);
      hits.push({ x0: q[0] - r - 1, y0: q[1] - r - 1, x1: q[0] + r + 1, y1: q[1] + r + 1, zone: z });
    }
  }
  ctx.restore();
}
export const econAt = (hits, x, y) => {
  let best = null;
  for (const h of hits || []) if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) best = h;   // the last drawn is on top
  return best;
};
