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
// language → its main country (ISO 3166 alpha-2), used when the browser gives no region
const LANG_COUNTRY = { ja: 'JP', ko: 'KR', fr: 'FR', de: 'DE', es: 'ES', it: 'IT', pt: 'PT', ru: 'RU', vi: 'VN', th: 'TH', id: 'ID', ms: 'MY',
  hi: 'IN', tr: 'TR', fa: 'IR', pl: 'PL', nl: 'NL', sv: 'SE', da: 'DK', fi: 'FI', nb: 'NO', no: 'NO', uk: 'UA', he: 'IL', el: 'GR', cs: 'CZ',
  hu: 'HU', ro: 'RO', tl: 'PH', fil: 'PH', bn: 'BD', ur: 'PK', km: 'KH', lo: 'LA', my: 'MM', mn: 'MN', ka: 'GE', hy: 'AM', kk: 'KZ' };
export async function homeCountry() {
  const langs = (navigator.languages?.length ? navigator.languages : [navigator.language || '']).filter(Boolean);
  let index = null;
  for (const tag of langs) {
    const parts = tag.split('-'), lang = parts[0].toLowerCase();
    const region = parts.slice(1).find(x => /^[A-Za-z]{2}$/.test(x))?.toUpperCase()
      || (lang === 'zh' && /hant/i.test(tag) ? 'TW' : lang === 'zh' && /hans/i.test(tag) ? 'CN' : null) || LANG_COUNTRY[lang];
    if (!region) continue;
    index ??= await fetch(BASE + 'outlines/index.json').then(r => r.json()).catch(() => ({}));
    if (index[region]) return index[region];
  }
  return null;
}
const PAIRS = [['基隆', '鵝鑾鼻'], ['台北', '高雄'], ['台中', '花蓮'], ['台南', '台東']];

// The floating shape is Taiwan by default; while a country is pinned it is that country (its borders in the
// pinned year), and Taiwan again once it is unpinned. Only Taiwan has the city-distance view.
export class TaiwanCompare {
  constructor(app) { this.app = app; this.on = false; this.center = null; this.custom = null; }
  // The default shape is the visitor's own country, from the browser's languages (a region subtag such as en-GB
  // or zh-TW, else the language's main country); Taiwan when none is known. Only Taiwan has the city distances.
  async load() {
    if (this.tw) return;
    const iso = await homeCountry();
    if (iso && iso !== 'TWN') {
      const f = await fetch(BASE + 'outlines/' + iso + '.json').then(r => r.ok ? r.json() : null).catch(() => null);
      if (f) { this.tw = { shape: f, cities: null, home: geoCentroid(f), km2: geoArea(f) * R * R, name: null, names: f.n, q: f.q }; this.apply(); return; }
    }
    const f = await fetch(BASE + 'taiwan_outline.json').then(r => r.json());
    this.tw = { shape: f, cities: f.cities, home: geoCentroid(f), km2: geoArea(f) * R * R, name: null, names: null, q: 'Q865' };
    this.apply();
  }
  // feats: the pinned country's features (or null for Taiwan); name: its name
  useShape(feats, name) {
    const polys = (feats || []).flatMap(f => f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : []);
    this.custom = polys.length ? (() => {
      const shape = { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: polys } };
      return { shape, cities: null, home: geoCentroid(shape), km2: geoArea(shape) * R * R, name };
    })() : null;
    this.apply();
  }
  apply() {
    const s = this.custom || this.tw; if (!s) return;
    Object.assign(this, { shape: s.shape, cities: s.cities, home: s.home, km2: s.km2, baseName: s.name, baseNames: s.names || null, baseQ: s.q || null });
    this.mkey = null; this.infoKey = null;
  }
  // geometry moved so that the shape's centre sits at this.center (rotation over the sphere: true size)
  moved() {
    const c = this.center, h = this.home;
    const key = c.join();
    if (this.mkey === key) return this.mcache;
    const to = geoRotation([-c[0], -c[1]]).invert, from = geoRotation([-h[0], -h[1]]);
    // rotating home → (0,0) → centre keeps meridians on meridians, so north stays up
    const move = p => to(from(p));
    const g = this.shape.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const coordinates = polys.map(poly => poly.map(ring => ring.map(move)));
    const cities = (this.cities || []).map(([hant, en, ja, lon, lat]) => ({ n: { 'zh-Hant': hant, 'zh-Hans': hant, en, ja }, key: hant, home: [lon, lat], p: move([lon, lat]) }));
    this.mcache = { feature: { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates } }, cities };
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
    const rings = m.feature.geometry.coordinates.flat().map(r => r.map(project));
    const pts = rings.flat();
    ctx.save();
    ctx.beginPath();
    for (const ring of rings) {
      let pen = false, prev = null;
      for (const p of ring) {
        if (!p || (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 400)) { pen = false; prev = p; continue; }
        if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; } else ctx.lineTo(p[0], p[1]);
        prev = p;
      }
      ctx.closePath();
    }
    ctx.fillStyle = 'rgba(30,64,175,0.30)'; ctx.fill('evenodd');
    ctx.setLineDash([]); ctx.lineWidth = 2; ctx.strokeStyle = '#1e40af'; ctx.stroke();
    // detection circle at the centre
    const cc = project(this.center);
    if (cc) {
      ctx.beginPath(); ctx.arc(cc[0], cc[1], CIRCLE, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
      ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeStyle = '#0b2a7a'; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cc[0], cc[1], 2.5, 0, 2 * Math.PI); ctx.fillStyle = '#0b2a7a'; ctx.fill();
    }
    const c = project(geoCentroid(m.feature));   // label above the shape
    const col = { en: 0, 'zh-Hant': 1, 'zh-Hans': 2, ja: 3 }[lang] ?? 0;
    const base = this.baseName || (this.baseNames ? this.baseNames[col] || this.baseNames[0] : t.twBase);
    let text = t.twCompareDrag(base);
    if (info.kind === 'area') { const L = info.lines && (this.showFull ? info.lines.full : info.lines.short); text = t.twTimes(info.name, info.ratio, base) + (L?.length ? '\n' + L.join('\n') : ''); }
    const ys = pts.filter(Boolean).map(p => p[1]), tall = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
    if (info.kind === 'border' && this.cities && tall < 150) text = t.twBorderZoom;
    if (info.kind === 'border' && this.cities && tall >= 150) {
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
      const lines = text.split('\n'), w = Math.max(...lines.filter(l => l !== '\u2500').map(l => ctx.measureText(l).width)) + 14, h = lines.length * 16 + 8;
      const bx = c[0] - w / 2, by = Math.max(4, Math.min(...pts.filter(Boolean).map(p => p[1])) - h - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#1e40af'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(bx, by, w, h, 6); ctx.fill(); ctx.stroke();
      this.labelBox = [bx, by, bx + w, by + h];
      ctx.fillStyle = '#0b2a7a';
      lines.forEach((l, i) => {
        if (l !== '\u2500') { ctx.fillText(l, c[0], by + 12 + i * 16); return; }
        // the rule between the figures and the cross ratios
        const y = by + 12 + i * 16; ctx.save(); ctx.strokeStyle = 'rgba(30,64,175,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx + 8, y); ctx.lineTo(bx + w - 8, y); ctx.stroke(); ctx.restore();
      });
    }
    ctx.restore();
  }
}
