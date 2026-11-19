// Territory transitions that look like a slime mould spreading.
//
// Both renderers rasterise "which polity owns this cell" before (idA) and after (idB) a change, on a
// coarse grid. For every cell that changes owner we work out when, in 0…1, the old owner lets go (tv)
// and when the new owner arrives (ta):
//
//   grow  (playback, ±1 step)  the new owner creeps in from the land it already holds; land that becomes
//                              empty is eaten away from its edge inwards; a brand-new polity sprouts
//                              from the middle of its territory.
//   jump  (clicking far away)  all changed land first withers (edge inwards, 0…½), then the new owners
//                              grow back (½…1).
//
// Arrival times are geodesic distances over a noisy cost field (Dijkstra), so the front advances in
// fingers and veins rather than as a clean ring.

const INF = 1e9;

// fractal value noise in 0…1, fixed per grid so the veins don't flicker between transitions
const noiseCache = new Map();
function noiseField(w, h) {
  const key = w + 'x' + h;
  if (noiseCache.has(key)) return noiseCache.get(key);
  const out = new Float32Array(w * h);
  let amp = 1, total = 0;
  for (const cell of [5, 11, 23]) {
    const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) { const s = Math.sin(i * 127.1 + cell * 311.7) * 43758.5453; g[i] = s - Math.floor(s); }
    for (let y = 0; y < h; y++) {
      const fy = y / cell, y0 = fy | 0, ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < w; x++) {
        const fx = x / cell, x0 = fx | 0, tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
        const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
        out[y * w + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
      }
    }
    total += amp; amp *= 0.55;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  if (noiseCache.size > 4) noiseCache.clear();
  noiseCache.set(key, out);
  return out;
}

// binary min-heap on (dist, index)
class Heap {
  constructor(n) { this.k = new Float64Array(n); this.v = new Int32Array(n); this.n = 0; }
  push(key, val) {
    if (this.n >= this.k.length) { const k = new Float64Array(this.k.length * 2), v = new Int32Array(this.v.length * 2); k.set(this.k); v.set(this.v); this.k = k; this.v = v; }
    let i = this.n++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= key) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; }
    this.k[i] = key; this.v[i] = val;
  }
  pop() {
    const top = this.v[0], key = this.k[--this.n], val = this.v[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= this.n) break;
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= key) break;
      this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
    }
    this.k[i] = key; this.v[i] = val;
    return top;
  }
}

// Dijkstra from `seeds` over cells where allowed(i, from) is true. Returns distances (INF = unreached).
function spread(w, h, seeds, allowed, cost) {
  const d = new Float32Array(w * h).fill(INF);
  const heap = new Heap(seeds.length * 2 + 64);
  for (const s of seeds) { d[s] = 0; heap.push(0, s); }
  while (heap.n) {
    const i = heap.pop(), di = d[i];
    const x = i % w, y = (i / w) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!allowed(j, i)) continue;
      const nd = di + cost[j];
      if (nd < d[j]) { d[j] = nd; heap.push(nd, j); }
    }
  }
  return d;
}

const NB = (w, h, i, f) => {
  const x = i % w, y = (i / w) | 0;
  if (x > 0) f(i - 1); if (x < w - 1) f(i + 1); if (y > 0) f(i - w); if (y < h - 1) f(i + w);
};

// idA/idB: Int32Array per cell, -1 = no polity. Returns null when nothing changed.
export function planTransition(w, h, idA, idB, mode) {
  const n = w * h;
  const changed = [];
  for (let i = 0; i < n; i++) if (idA[i] !== idB[i]) changed.push(i);
  if (!changed.length) return null;
  const isCh = new Uint8Array(n); for (const i of changed) isCh[i] = 1;
  const noise = noiseField(w, h);
  const cost = new Float32Array(n);
  for (let i = 0; i < n; i++) { const v = noise[i]; cost[i] = 0.25 + 3.2 * v * v * v; }

  // --- growth of the new owners: from the land each already held, else from a seed in the middle
  const growSeeds = [];
  for (const i of changed) {
    const b = idB[i]; if (b < 0) continue;
    NB(w, h, i, j => { if (!isCh[j] && idB[j] === b) growSeeds.push(j); });
  }
  const growOk = (j, from) => isCh[j] && idB[j] >= 0 && idB[j] === idB[from];
  let G = spread(w, h, growSeeds, growOk, cost);
  // unreached patches (a new polity, or a new exclave): sprout from the patch's interior
  const left = changed.filter(i => idB[i] >= 0 && G[i] >= INF);
  if (left.length) {
    const comp = new Int32Array(n).fill(-1), seeds = [];
    let c = 0;
    for (const s of left) {
      if (comp[s] >= 0) continue;
      const stack = [s], cells = []; comp[s] = c;
      while (stack.length) {
        const i = stack.pop(); cells.push(i);
        NB(w, h, i, j => { if (comp[j] < 0 && isCh[j] && idB[j] === idB[s] && G[j] >= INF) { comp[j] = c; stack.push(j); } });
      }
      let sx = 0, sy = 0; for (const i of cells) { sx += i % w; sy += (i / w) | 0; }
      sx /= cells.length; sy /= cells.length;
      let best = cells[0], bd = INF;
      for (const i of cells) { const dd = (i % w - sx) ** 2 + (((i / w) | 0) - sy) ** 2; if (dd < bd) { bd = dd; best = i; } }
      seeds.push(best); c++;
    }
    const G2 = spread(w, h, seeds, (j, from) => isCh[j] && idB[j] === idB[from] && G[j] >= INF, cost);
    for (const i of left) G[i] = G2[i] < INF ? G2[i] : 0;
  }

  // --- withering of the old owners: from the edge of each owner's changed land inwards
  const witherSeeds = [];
  for (const i of changed) {
    const a = idA[i]; if (a < 0) continue;
    let edge = false;
    NB(w, h, i, j => { if (idA[j] !== a || (!isCh[j] && mode === 'jump')) edge = true; });
    if (edge) witherSeeds.push(i);
  }
  const E = spread(w, h, witherSeeds, (j, from) => isCh[j] && idA[j] === idA[from], cost);

  let gMax = 1e-6, eMax = 1e-6;
  for (const i of changed) { if (idB[i] >= 0 && G[i] < INF) gMax = Math.max(gMax, G[i]); if (idA[i] >= 0 && E[i] < INF) eMax = Math.max(eMax, E[i]); }

  const list = Int32Array.from(changed);
  const tv = new Float32Array(list.length), ta = new Float32Array(list.length);
  for (let k = 0; k < list.length; k++) {
    const i = list[k], a = idA[i], b = idB[i];
    const g = b >= 0 ? Math.min(1, G[i] / gMax) : 0;
    const e = a >= 0 ? Math.min(1, (E[i] < INF ? E[i] : 0) / eMax) : 0;
    if (mode === 'jump') {
      tv[k] = a >= 0 ? 0.5 * e : 0;
      ta[k] = b >= 0 ? 0.5 + 0.5 * g : 2;
    } else if (b >= 0) {                       // taken over (or settled) by the new owner
      ta[k] = 0.04 + 0.92 * g; tv[k] = ta[k];
    } else {                                   // lost to nobody
      tv[k] = 0.04 + 0.92 * e; ta[k] = 2;
    }
  }
  return { w, h, idA, idB, list, tv, ta, mode };
}

// owner of every cell at time t (to chain a new transition onto a running one)
export function idsAt(plan, t) {
  const out = plan.idB.slice();
  const { list, tv, ta, idA } = plan;
  for (let k = 0; k < list.length; k++) {
    const i = list[k];
    out[i] = t >= ta[k] ? plan.idB[i] : t < tv[k] ? idA[i] : -1;
  }
  return out;
}

const SOFT = 0.05;
// Fill an RGBA mask pair for time t. maskA: where the old picture still shows; maskB: where the new one does.
export function fillMasks(plan, t, maskA, maskB, init) {
  const { list, tv, ta } = plan;
  const a = maskA.data, b = maskB.data;
  if (init) {
    a.fill(0); b.fill(0);
    for (let i = 3; i < b.length; i += 4) b[i] = 255;
    for (let k = 0; k < list.length; k++) b[list[k] * 4 + 3] = 0;
  }
  for (let k = 0; k < list.length; k++) {
    const i = list[k] * 4 + 3;
    a[i] = plan.idA[list[k]] >= 0 ? 255 * Math.max(0, Math.min(1, (tv[k] - t) / SOFT + 1)) : 0;
    b[i] = 255 * Math.max(0, Math.min(1, (t - ta[k]) / SOFT));
  }
}

// Decode an id raster drawn with rgb(id+1) fills. Anti-aliased edge pixels blend two colours and can
// decode to an unrelated polity; those take the value of a neighbour instead.
export function decodeIds(data, w, h, valid) {
  const out = new Int32Array(w * h);
  for (let i = 0; i < out.length; i++) {
    const a = data[i * 4 + 3];
    if (a < 128) { out[i] = -1; continue; }
    const v = ((data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2]) - 1;
    out[i] = a === 255 && valid.has(v) ? v : -2;
  }
  for (let i = 0; i < out.length; i++) if (out[i] === -2) {
    const x = i % w;
    out[i] = x > 0 && out[i - 1] >= -1 ? out[i - 1] : i >= w && out[i - w] >= -1 ? out[i - w] : -1;
  }
  return out;
}

// stable identity of a drawn polity piece across era chunks (chunks hold separate copies of geometry)
export const pieceKey = f => (f.properties.prov ? f.properties.prov.id + ':' : '') + f.properties.p + ':' + f.properties.s + ':' + f.properties.area.toFixed(9);

export const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t) * 0.6 + t * 0.4;
