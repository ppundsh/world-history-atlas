// Distortion hint mask for flat maps: shades the map where the projection distorts the most.
// At each sample point the projection's local scale factors a ≥ b (Tissot's indicatrix, from finite
// differences, relative to the projection's nominal scale) give:
//   area error   |ln(a·b)|      — what conformal maps (Mercator…) give up
//   shape error  ln(a / b)      — what equal-area maps (Mollweide, Equal Earth…) give up
//   scale error  max(|ln a|, |ln b|) — distances; used for equidistant, compromise and perspective maps
// Each projection is judged by what it does NOT preserve. Below a tolerance (about 12 % error) nothing is
// shaded, so the well-drawn part stays fully readable; above it the shade ramps up smoothly.
import { geoDistance } from 'd3-geo';

const D2R = Math.PI / 180;
const METRIC = {
  conformal: (a, b) => Math.abs(Math.log(a * b)),
  equalArea: (a, b) => Math.log(a / b),
  equidistant: (a, b) => Math.max(Math.abs(Math.log(a)), Math.abs(Math.log(b))),
};
const T0 = 0.12, T1 = 1.3;            // tolerance band: no shade below T0, full shade from T1

export function distortionAt(proj, ll, metric) {
  const [l, f] = ll, h = 0.05;
  if (Math.abs(f) > 89.5) return null;
  const c = Math.cos(f * D2R);
  const pe = proj([l + h, f]), pw = proj([l - h, f]), pn = proj([l, f + h]), ps = proj([l, f - h]);
  if (!pe || !pw || !pn || !ps) return null;
  const k = proj.scale() * D2R * 2 * h;          // pixels for 2h degrees of arc at nominal scale
  const ex = (pe[0] - pw[0]) / (k * c), ey = (pe[1] - pw[1]) / (k * c);
  const nx = (pn[0] - ps[0]) / k, ny = (pn[1] - ps[1]) / k;
  // singular values of the Jacobian [[ex, nx], [ey, ny]]
  const E = ex * ex + ey * ey, G = nx * nx + ny * ny, F = ex * nx + ey * ny;
  const s = Math.sqrt(Math.max(0, (E - G) ** 2 + 4 * F * F));
  const a = Math.sqrt((E + G + s) / 2), b = Math.sqrt(Math.max(1e-9, (E + G - s) / 2));
  if (!isFinite(a) || !isFinite(b) || a > 1e4) return null;
  return metric(a, b);
}

export class DistortionMask {
  constructor() { this.cache = null; }
  // returns a small canvas (alpha shading) for the current view, or null
  render(map, strength, fine) {
    const { proj, W, H } = map;
    const prop = map.def.prop;
    const metric = METRIC[prop] || METRIC.equidistant;
    const step = fine ? 6 : 14;
    const w = Math.ceil(W / step) + 1, h = Math.ceil(H / step) + 1;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h), o = img.data;
    const center = [map.view.lon, map.view.lat];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ll = proj.invert([x * step, y * step]);
      if (!ll || !isFinite(ll[0]) || !isFinite(ll[1])) continue;
      if (map.azimuthal && geoDistance(ll, center) > map.clipRad) continue;
      const back = proj(ll);                       // outside the map's outline the inverse wraps around
      if (!back || Math.abs(back[0] - x * step) > 2 || Math.abs(back[1] - y * step) > 2) continue;
      const d = distortionAt(proj, ll, metric);
      if (d == null) continue;
      const t = Math.max(0, Math.min(1, (d - T0) / (T1 - T0)));
      if (!t) continue;
      const i = (y * w + x) * 4;
      o[i] = 25; o[i + 1] = 22; o[i + 2] = 45; o[i + 3] = Math.round(255 * strength * Math.pow(t, 0.8));
    }
    g.putImageData(img, 0, 0);
    return { canvas: c, step };
  }
}
