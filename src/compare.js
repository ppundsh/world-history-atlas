// Floating Taiwan: Taiwan's main island at true size, dragged anywhere on the map (moved over the sphere,
// so it keeps its real size and shape whatever the projection does there — the map's distortion shows in
// how the outline is drawn).
//  - over one country: "≈ N Taiwans" (that polity's area this year ÷ Taiwan's)
//  - across a border (two or more polities under it): Taiwan's main cities and the distances between them,
//    to give a feel for the distances on that border
import { geoArea, geoCentroid, geoContains, geoDistance, geoRotation } from 'd3-geo';

const R = 6371.0088;
const BASE = import.meta.env.BASE_URL + 'data/';
export const CIRCLE = 16;                 // detection circle radius, px
const PAIRS = [['基隆', '鵝鑾鼻'], ['台北', '高雄'], ['台中', '花蓮'], ['台南', '台東']];

export class TaiwanCompare {
  constructor(app) { this.app = app; this.on = false; this.center = null; }
  async load() {
    if (this.shape) return;
    const f = await fetch(BASE + 'taiwan_outline.json').then(r => r.json());
    this.shape = f; this.cities = f.cities;
    this.home = geoCentroid(f);
    this.km2 = geoArea(f) * R * R;
  }
  // geometry moved so that Taiwan's centre sits at this.center (rotation over the sphere: true size)
  moved() {
    const c = this.center, h = this.home;
    const key = c.join();
    if (this.mkey === key) return this.mcache;
    const to = geoRotation([-c[0], -c[1]]).invert, from = geoRotation([-h[0], -h[1]]);
    // rotating home → (0,0) → centre keeps meridians on meridians, so north stays up
    const move = p => to(from(p));
    const ring = this.shape.geometry.coordinates[0].map(move);
    const cities = this.cities.map(([hant, en, ja, lon, lat]) => ({ n: { 'zh-Hant': hant, 'zh-Hans': hant, en, ja }, key: hant, home: [lon, lat], p: move([lon, lat]) }));
    this.mcache = { feature: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }, cities };
    this.mkey = key;
    return this.mcache;
  }
  contains(ll) { return this.on && this.center && geoContains(this.moved().feature, ll); }

  // what lies under the detection circle (a fixed-size ring at the centre, so small countries can be
  // picked): one polity → area comparison; several → city distances. invert(xy) → lon/lat
  summary(featureAt, project, invert) {
    const c = project(this.center); if (!c) return { kind: 'none' };
    const pts = [this.center];
    for (const r of [CIRCLE * 0.5, CIRCLE]) for (let i = 0; i < 12; i++) {
      const a = i / 12 * 2 * Math.PI, ll = invert([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
      if (ll && isFinite(ll[0])) pts.push(ll);
    }
    const ids = new Map();
    for (const p of pts) { const f = featureAt(p); if (f) ids.set(f.properties.p, f); }
    if (ids.size === 1) {
      const [[id, f]] = [...ids];
      const feats = (this.app.flat.lastFeats || [f]).filter(x => x.properties.p === id);
      const sr = feats.reduce((s, x) => s + (x.properties.area ?? geoArea(x)), 0) || geoArea(f);
      return { kind: 'area', id, ratio: sr * R * R / this.km2 };
    }
    if (ids.size > 1) return { kind: 'border' };
    return { kind: 'none' };
  }

  // draw with a projection function project(ll) → [x, y] | null, on a 2D context (CSS pixels)
  draw(ctx, project, info, lang, t) {
    const m = this.moved();
    const pts = m.feature.geometry.coordinates[0].map(project);
    ctx.save();
    ctx.beginPath();
    let pen = false, prev = null;
    for (const p of pts) {
      if (!p || (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 400)) { pen = false; prev = p; continue; }
      if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; } else ctx.lineTo(p[0], p[1]);
      prev = p;
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(30,64,175,0.30)'; ctx.fill();
    ctx.setLineDash([]); ctx.lineWidth = 2; ctx.strokeStyle = '#1e40af'; ctx.stroke();
    // detection circle at the centre
    const cc = project(this.center);
    if (cc) {
      ctx.beginPath(); ctx.arc(cc[0], cc[1], CIRCLE, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
      ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeStyle = '#0b2a7a'; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cc[0], cc[1], 2.5, 0, 2 * Math.PI); ctx.fillStyle = '#0b2a7a'; ctx.fill();
    }
    const c = project(geoCentroid(m.feature));
    let text = t.twCompareDrag;
    if (info.kind === 'area') text = t.twTimes(info.name, info.ratio);
    const ys = pts.filter(Boolean).map(p => p[1]), tall = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
    if (info.kind === 'border' && tall < 150) text = t.twBorderZoom;
    if (info.kind === 'border' && tall >= 150) {
      // Taiwan's own distances, drawn on the moved island
      const at = k => m.cities.find(x => x.key === k);
      ctx.font = `600 11px ${t.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [a, b] of PAIRS) {
        const A = at(a), B = at(b), pa = project(A.p), pb = project(B.p);
        if (!pa || !pb) continue;
        const km = Math.round(geoDistance(A.home, B.home) * R);
        ctx.setLineDash([5, 3]); ctx.strokeStyle = '#0b2a7a'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke(); ctx.setLineDash([]);
        const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2, s = `${km} km`;
        const w = ctx.measureText(s).width + 8;
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(mx - w / 2, my - 8, w, 16);
        ctx.fillStyle = '#0b2a7a'; ctx.fillText(s, mx, my);
      }
      for (const k of new Set(PAIRS.flat())) {
        const C = at(k), p = project(C.p); if (!p) continue;
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#0b2a7a'; ctx.stroke();
        ctx.fillStyle = '#0b2a7a'; ctx.textAlign = 'left'; ctx.fillText(C.n[lang] || C.n.en, p[0] + 6, p[1] - 7); ctx.textAlign = 'center';
      }
      text = t.twBorder;
    }
    if (c) {
      ctx.font = `700 12px ${t.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lines = text.split('\n'), w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14, h = lines.length * 16 + 8;
      const bx = c[0] - w / 2, by = Math.max(4, Math.min(...pts.filter(Boolean).map(p => p[1])) - h - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#1e40af'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(bx, by, w, h, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0b2a7a';
      lines.forEach((l, i) => ctx.fillText(l, c[0], by + 12 + i * 16));
    }
    ctx.restore();
  }
}
