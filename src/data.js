// Loads the pre-built data in public/data (all self-hosted, nothing fetched from third parties).
import { feature } from 'topojson-client';
import { geoArea, geoCentroid } from 'd3-geo';
import polylabel from 'polylabel';

const BASE = import.meta.env.BASE_URL + 'data/';
const json = p => fetch(BASE + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });

export const store = {
  meta: null, polities: null, base: null, physical: null, disputed: [], chunks: new Map(), pending: new Map(),
};

export async function loadCore() {
  const [meta, polities, base, disputed, base110] = await Promise.all([
    json('meta.json'), json('polities.json'), json('base50.json'), json('disputed.json'), json('base110.json'),
  ]);
  // coarse 1:110m land, used while the map is being dragged (re-projecting 1:50m every frame is slow)
  const o = Object.keys(base110.objects);
  store.coarse = { land: feature(base110, base110.objects[o.find(k => /land/.test(k))]), lakes: { type: 'FeatureCollection', features: [] }, rivers: { type: 'FeatureCollection', features: [] } };
  store.meta = meta;
  store.polities = polities;
  // modern countries' own label points (anchors.py): label a polity in its home part, not its biggest piece
  store.anchors = await json('anchors.json').catch(() => ({}));
  store.base = {
    land: feature(base, base.objects.ne_50m_land),
    lakes: feature(base, base.objects.ne_50m_lakes),
    rivers: feature(base, base.objects.ne_50m_rivers_lake_centerlines),
  };
  store.disputed = feature(disputed, disputed.objects.disputed).features;
  for (const f of store.disputed) f.properties.lp = labelPoint(f);
  return store;
}

export async function loadPhysical() {
  if (store.physical) return store.physical;
  const t = await json('physical.json');
  store.physical = {
    bathy: feature(t, t.objects.bathy).features.sort((a, b) => +a.properties.depth - +b.properties.depth),
    regions: feature(t, t.objects.regions).features,
    ice: feature(t, t.objects.ice),
  };
  return store.physical;
}

// present-day borders (Natural Earth 1:50m land boundary lines) for the "modern borders" overlay
export async function loadModern() {
  if (store.modern) return store.modern;
  const t = await json('modern.json');
  store.modern = feature(t, t.objects.modern);
  return store.modern;
}
// 1:10m rivers and lakes, used when zoomed in; plus local river sets (Taiwan) where Natural Earth has none
export async function loadDetail() {
  if (store.detail) return store.detail;
  store.pendingDetail ||= (async () => {
    const t = await json('detail.json');
    const d = { rivers: feature(t, t.objects.rivers), lakes: feature(t, t.objects.lakes) };
    try {
      const r = await fetch(BASE + 'rivers_tw.json');
      if (r.ok) { const tw = await r.json(); d.local = feature(tw, tw.objects[Object.keys(tw.objects)[0]]); }
    } catch { /* optional */ }
    store.detail = d;
    return d;
  })();
  return store.pendingDetail;
}

export function chunkFor(year) {
  return store.meta.chunks.find(c => year >= c.from && year <= c.to);
}

export function loadChunk(c) {
  if (store.chunks.has(c.id)) return Promise.resolve(store.chunks.get(c.id));
  if (store.pending.has(c.id)) return store.pending.get(c.id);
  const p = json('chunks/' + c.id + '.json').then(t => {
    const fc = feature(t, t.objects[c.id]).features;
    for (const f of fc) {
      f.properties.area = flatArea(f);
      lazyLabelPoint(f);
    }
    // big polities first, so that enclaves and small states are drawn on top
    fc.sort((a, b) => b.properties.area - a.properties.area);
    store.chunks.set(c.id, fc);
    store.pending.delete(c.id);
    return fc;
  });
  store.pending.set(c.id, p);
  return p;
}

// features alive in `year` (synchronous; returns null if the chunk is not loaded yet)
export function featuresFor(year) {
  const c = chunkFor(year);
  if (!c) return null;
  const fc = store.chunks.get(c.id);
  if (!fc) return null;
  return fc.filter(f => f.properties.a <= year && year <= f.properties.b);
}

export function countFor(year) {
  const m = store.meta;
  return m.counts[Math.max(0, Math.min(m.counts.length - 1, year - m.from))];
}

// area in steradians, from the flat lon/lat rings scaled by the cosine of their latitude: within a few per cent of
// the spherical area (enough for drawing order and size thresholds) at a fraction of its cost, for a whole chunk
function flatArea(f) {
  const g = f.geometry; if (!g) return 0;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null;
  if (!polys) return geoArea(f);
  const k = (Math.PI / 180) ** 2; let t = 0;
  for (const p of polys) p.forEach((r, i) => {
    let y = 0; for (const c of r) y += c[1];
    const a = Math.abs(ringArea(r)) * Math.cos(y / r.length * Math.PI / 180) * k;
    t += i ? -a : a;
  });
  return t;
}
// a chunk holds every polity of a few centuries: the label point (a costly search) is found only for those
// actually drawn, the first time one is asked for, and kept
function lazyLabelPoint(f) {
  let v;
  Object.defineProperty(f.properties, 'lp', { configurable: true, enumerable: true, get: () => (v === undefined ? (v = labelPoint(f)) : v), set: x => { v = x; } });
}

// Label anchor: pole of inaccessibility of the home ring — the one containing (or nearest to) the polity's
// anchor when it has one (modern countries, see anchors.py), otherwise the largest ring
// (planar lon/lat is good enough for placement)
function labelPoint(f) {
  const g = f.geometry;
  if (!g) return null;
  let polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  if (!polys.length) return geoCentroid(f);
  let best = null, bestA = -1;
  for (const p of polys) {
    const a = Math.abs(ringArea(p[0]));
    if (a > bestA) { bestA = a; best = p; }
  }
  const an = store.anchors?.[f.properties.p];
  if (an && polys.length > 1) {
    let home = polys.find(p => inRing(an, p[0]));
    if (!home) {                                   // nearest sizeable ring within ~6°
      let d0 = 36;
      for (const p of polys) {
        if (Math.abs(ringArea(p[0])) < bestA * 0.02) continue;
        for (const c of p[0]) { const d = (c[0] - an[0]) ** 2 + (c[1] - an[1]) ** 2; if (d < d0) { d0 = d; home = p; } }
      }
    }
    if (home && Math.abs(ringArea(home[0])) > bestA * 0.02) best = home;
  }
  // rings that cross the antimeridian: fall back to the spherical centroid
  const xs = best[0].map(c => c[0]);
  if (Math.max(...xs) - Math.min(...xs) > 300) return geoCentroid(f);
  // precision relative to the ring's size: a continent-sized ring needs no 0.05° search
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of best[0]) { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; }
  const pt = polylabel(best, Math.max(0.05, Math.min(x1 - x0, y1 - y0) / 40));
  return [pt[0], pt[1]];
}
function inRing([x, y], r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function ringArea(r) {
  let s = 0;
  for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return s / 2;
}

// ---- polity table helpers --------------------------------------------------------------------
// row: [en, zhHant, zhHans, ja, color, flags, altEn, altHant, altHans, altJa, qid, y0, y1]
export const P = {
  name(id, col) { const r = store.polities[id]; return r[col] || r[0]; },
  alt(id, altCol) { return store.polities[id][altCol] || ''; },
  color(id) { return store.polities[id][4]; },
  flags(id) { return store.polities[id][5]; },
  row(id) { return store.polities[id]; },
};
