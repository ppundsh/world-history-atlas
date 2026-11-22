import { DistortionMask } from './distortion.js';
import { reliefFor } from './relief.js';
// Flat-map renderer: d3-geo projections drawn on a Canvas, with Google-Maps-style navigation
// (drag to pan, wheel/pinch to zoom at the cursor, double-click to zoom in, arrow keys, +/-).
import { drawPulses, reservePulses, pulseAt, pulseCardAt } from './eventdots.js';
import { drawLang, lineAt, labelsMoving } from './langlayer.js';
import { drawClassIcon } from './classicon.js';
import { geoPath, geoGraticule, geoGraticule10, geoContains, geoDistance } from 'd3-geo';
import { PROJ } from './projections.js';
import { store, P } from './data.js';
import { frame, region, REGIONS } from './modes.js';
export const ROC_COLOR = '#ffb000';
import { BASEMAPS } from './styles.js';
import { labelItems, placeLabels, hatchPattern } from './labels.js';
import { planTransition, idsAt, fillMasks, ease, decodeIds, idColor, readbackOk } from './transition.js';

const SPHERE = { type: 'Sphere' };
const GRAT = geoGraticule10();
const MAX_K = 60;

// ★ at the government seat; the name is nudged down to avoid other names, and dropped if it can't fit
// a government seat (★) or administrative seat (◆): symbol with a dark outline and the name in a framed label.
// Pushes its clickable box to `hits` ({x0, y0, x1, y1, m}).
// Thumbnails keep clear of each other and of labels: the first spot around the marker (nearest first, then
// further rings) where at most a fifth of the picture would be covered; a leader line links it to its marker.
// A thumbnail is a card: the picture with its name in a strip underneath, so the name belongs to the picture.
// Names (boxes flagged hard: [x0, y0, x1, y1, true]) are never covered by a later picture when there is room.
export const MAX_COVER = 0.2;
export function placePicture(x, y, s, placed, cw = s, ch = s) {
  const cover = (x0, y0) => {
    let sum = 0;
    for (const b of placed) {
      const w = Math.min(x0 + cw, b[2]) - Math.max(x0, b[0]), h = Math.min(y0 + ch, b[3]) - Math.max(y0, b[1]);
      if (w > 0 && h > 0) sum += b[4] ? 1 + (w * h) / (cw * ch) : (w * h) / (cw * ch);
    }
    return sum;
  };
  const dirs = [[0, -1], [0.8, -0.8], [-0.8, -0.8], [1, 0], [-1, 0], [0.8, 0.8], [-0.8, 0.8], [0, 1]];
  const rx = cw * 0.5 + s * 0.12 + 12, ry = ch * 0.5 + s * 0.12 + 12;
  let best = null;
  for (const ring of [1, 1.6, 2.3, 3.1, 4, 5]) for (const [dx, dy] of dirs) {
    const cx = x + dx * rx * ring, cy = y + dy * ry * ring, x0 = cx - cw / 2, y0 = cy - ch / 2;
    const c = cover(x0, y0);
    if (c <= MAX_COVER) return [x0, y0];
    if (!best || c < best[2]) best = [x0, y0, c];
  }
  return [best[0], best[1]];
}
// size of a picture card: [width, height, height of the name strip, the name as it fits]
const measure = document.createElement('canvas').getContext('2d');
export const CARD_FONT = f => `600 11px ${f}`;
export function cardDims(s, name, font, aspect = 1) {
  if (!name) return [s * aspect + 6, s + 6, 0, ''];
  measure.font = CARD_FONT(font);
  const maxW = Math.max(s * aspect + 6, 150);
  let text = name, tw = measure.measureText(text).width + 12;
  while (tw > maxW && text.length > 2) { text = text.slice(0, -2) + '…'; tw = measure.measureText(text).width + 12; }
  return [Math.max(s * aspect + 6, tw), s + 6 + 16, 16, text];
}
// reserve a placed card: the picture may be partly covered by a later one, its name may not
export function reserveCard(placed, bx, by, d) {
  placed.push([bx - 2, by - 2, bx + d[0] + 2, by + d[1] - d[2]]);
  if (d[2]) placed.push([bx - 2, by + d[1] - d[2], bx + d[0] + 2, by + d[1] + 2, true]);
}
// draw a card at (bx, by): white frame, the picture (cropped square), the name underneath; returns the picture's corner
export function drawCard(ctx, bx, by, d, s, img, color, font, lineW = 2, aspect = 1) {
  const sw = s * aspect, ix = bx + (d[0] - sw) / 2, iy = by + 3;
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 5; ctx.fillStyle = 'rgba(255,255,255,0.78)';
  const R = 6;
  ctx.beginPath(); ctx.roundRect(bx, by, d[0], d[1], R); ctx.fill(); ctx.shadowBlur = 0;
  const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
  const r = Math.max(sw / nw, s / nh), w = sw / r, h = s / r;
  ctx.save(); ctx.beginPath(); ctx.roundRect(ix, iy, sw, s, Math.max(2, R - 3)); ctx.clip();
  ctx.drawImage(img, (nw - w) / 2, (nh - h) / 2, w, h, ix, iy, sw, s);
  ctx.restore();
  if (d[2]) {
    // the frame is see-through, so the name carries its own white outline
    const tx = bx + d[0] / 2, ty = by + s + 6 + d[2] / 2;
    ctx.font = CARD_FONT(font); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.strokeText(d[3], tx, ty);
    ctx.fillStyle = '#1d1d24'; ctx.fillText(d[3], tx, ty);
  }
  ctx.lineWidth = lineW; ctx.strokeStyle = color; ctx.beginPath(); ctx.roundRect(bx, by, d[0], d[1], R); ctx.stroke();
  return [ix, iy];
}
// Cards moved by hand: key → offset of the card's corner from its marker, in screen pixels. A moved card stays
// where it was put relative to its marker (it follows when the map is panned) until the mode changes.
export const cardOffsets = new Map();
export function cardUnder(hits, x, y) {
  const pu = pulseCardAt(x, y); if (pu) return pu;
  for (let i = (hits || []).length - 1; i >= 0; i--) { const h = hits[i]; if (h.card && x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return { key: h.card, x0: h.x0, y0: h.y0, ax: h.ax, ay: h.ay }; }
  return null;
}
// a card being dragged: given the pointer, move the card (both renderers)
export function dragCard(d, px, py) { cardOffsets.set(d.key, [px - d.gx - d.ax, py - d.gy - d.ay]); }
// Pictures glide to a new place instead of jumping: the offset from its marker eases toward the target, so
// panning moves the picture with its marker at once and only the change of place is animated.
const slides = new Map();
let sliding = false;
export function slideTo(key, x, y, tx, ty) {
  const now = performance.now(), want = [tx - x, ty - y];
  let e = slides.get(key);
  if (!e || now - e.seen > 1500) e = { off: want, t: now };          // new (or long unseen): appear in place
  const k = Math.min(1, (now - e.t) / 180);                           // about a fifth of a second to settle
  e.off = [e.off[0] + (want[0] - e.off[0]) * k, e.off[1] + (want[1] - e.off[1]) * k];
  if (Math.abs(want[0] - e.off[0]) > 0.5 || Math.abs(want[1] - e.off[1]) > 0.5) sliding = true; else e.off = want;
  e.t = e.seen = now; slides.set(key, e);
  return [x + e.off[0], y + e.off[1]];
}
// true (once) when a picture is still on its way: the renderer then draws another frame
export function takeSliding() { const s = sliding; sliding = false; if (slides.size > 400) for (const [k, e] of slides) if (performance.now() - e.seen > 5000) slides.delete(k); return s; }
// the pointer from a card to its marker: a slim triangle like a speech bubble's tail, wide at the card and
// tapering to the marker, so the eye follows it to the place
export function leader(ctx, x, y, x0, y0, s, color, sh = s) {
  const cx = Math.max(x0, Math.min(x0 + s, x)), cy = Math.max(y0, Math.min(y0 + sh, y));       // nearest point of the frame
  const len = Math.hypot(cx - x, cy - y);
  if (len < 6) return;
  // the base, across the pointer's direction, starts a little inside the card (drawn over it); the tip stops short
  // of the marker
  const ux = (x - cx) / len, uy = (y - cy) / len, half = Math.min(8, 3.5 + len * 0.07);
  const ex = -uy, ey = ux;
  const bx = cx - ux * 6, by = cy - uy * 6, tx = x - ux * 4, ty = y - uy * 4;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(bx - ex * half, by - ey * half); ctx.lineTo(tx, ty); ctx.lineTo(bx + ex * half, by + ey * half); ctx.closePath();
  ctx.globalAlpha *= 0.6;
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
function drawPicture(ctx, x, y, m, placed, hits, name, font) {
  const img = m.pic, s = m.picSize || 54, ar = m.picAspect || 1, d = cardDims(s, name, font, ar);
  const key = 'm:' + m.kind + ':' + m.id + ':' + (m.cap || ''), mo = cardOffsets.get(key);
  const [tx, ty] = mo ? [x + mo[0], y + mo[1]] : placePicture(x, y, s, placed, d[0], d[1]);
  reserveCard(placed, tx, ty, d);
  const [bx, by] = mo ? [tx, ty] : slideTo(key, x, y, tx, ty);
  ctx.save();
  leader(ctx, x, y, bx, by, d[0], m.color, d[1]);
  const [ix, iy] = drawCard(ctx, bx, by, d, s, img, m.color, font, 2, ar);
  if (m.cls) { const bs = Math.max(16, s * 0.34); drawClassIcon(ctx, m.cls, ix + bs / 2 + 2, iy + s - bs / 2 - 2, bs, m.color); }   // class badge inside the picture's lower-left corner, clear of the name
  ctx.restore();
  hits?.push({ x0: bx, y0: by, x1: bx + d[0], y1: by + d[1], m, card: key, ax: x, ay: y });
}
export function drawMarker(ctx, x, y, m, col, S, placed, hits) {
  const seat = m.kind !== 'gov' && m.kind != null;          // seats, feuds, local powers: smaller
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${seat ? 15 : 22}px ${S.label.font}`;
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,20,30,0.85)'; ctx.lineJoin = 'round';
  if (m.hi) {                                   // emphasised (the hidden mode's main cast): a gold halo
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fillStyle = 'rgba(245,179,1,0.35)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#f5b301'; ctx.stroke();
  }
  const text = m.text[col] || m.text[0];
  if (m.pic) drawPicture(ctx, x, y, m, placed, hits, text, S.label.font);
  if (m.cls) drawClassIcon(ctx, m.cls, x, y, 18, m.color);          // the hidden mode: class badge as the symbol
  else if (m.icon) {                                // major works: the kind's icon on a round badge
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = m.color; ctx.stroke();
    ctx.font = `12px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",${S.label.font}`; ctx.fillStyle = m.color; ctx.fillText(m.icon, x, y + 0.5);
    ctx.font = `15px ${S.label.font}`;
    if (m.quiet) { hits?.push({ x0: x - 11, y0: y - 11, x1: x + 11, y1: y + 11, m }); return; }   // older works: the icon only
  } else {
    const sym = m.sym || { seat: '◆', feud: '⚔', power: '◉', us: '✪', art: '✦' }[m.kind] || '★';
    ctx.strokeText(sym, x, y); ctx.fillStyle = m.roc ? '#1e40af' : m.color; ctx.fillText(sym, x, y);
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff'; ctx.strokeText(sym, x, y);
  }
  if (m.pic) { hits?.push({ x0: x - 11, y0: y - 11, x1: x + 11, y1: y + 11, m }); return; }   // the name is on the picture's card
  ctx.font = `${m.roc || !seat ? 700 : 600} ${seat ? 11 : 12}px ${S.label.font}`;
  const w = ctx.measureText(text).width + 10, h = seat ? 16 : 18, x0 = x + (seat ? 9 : 13);
  let ty = y;
  const over = yy => placed.some(b => b[0] < x0 + w && b[2] > x0 && b[1] < yy + h / 2 && b[3] > yy - h / 2);
  while (over(ty) && ty - y < 54) ty += h + 2;
  hits?.push({ x0: x - 11, y0: y - 11, x1: x + 11, y1: y + 11, m });
  if (over(ty)) return;
  placed.push([x0, ty - h / 2, x0 + w, ty + h / 2, true]);
  if (ty !== y) { ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.lineTo(x0, ty); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.beginPath(); ctx.roundRect(x0, ty - h / 2, w, h, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.93)'; ctx.fill();
  ctx.lineWidth = m.roc ? 2.2 : 1.6; ctx.strokeStyle = m.roc ? '#1e40af' : m.color; ctx.stroke();
  ctx.fillStyle = m.roc ? '#0b2a7a' : '#1d1d24'; ctx.textAlign = 'left';
  ctx.fillText(text, x0 + 5, ty + 0.5);
  hits?.push({ x0, y0: ty - h / 2, x1: x0 + w, y1: ty + h / 2, m });
}

export class FlatMap {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.app = app;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.view = { lon: 60, lat: 25, k: 1 };
    this.dirty = false;
    this.raster = null;                         // satellite image (equirectangular), if provided
    this.rasterCache = null;
    this.pointers = new Map();
    this.bindEvents();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }

  get base() { return this.coarse ? store.coarse : store.base; }
  get azimuthal() { return this.def?.surface === 'azimuthal'; }
  // whole-world projections without an infinite edge can be turned in every direction (oblique aspects):
  // dragging rotates the globe under the projection instead of sliding the picture
  // Such maps are locked to their standard movement by default; unlocking (this.free) allows turning them freely.
  get freeCapable() { return !!this.def && !this.def.lat && ['cylindrical', 'pseudocylindrical', 'conic', 'other'].includes(this.def.surface); }
  get oblique() { return this.freeCapable && !!this.free; }
  get rotating() { return this.azimuthal || this.oblique || !!this.aspect; }
  // lock / unlock free movement. Locking keeps the map exactly as it is (any oblique aspect included) and only
  // brings back the standard movement: dragging sideways scrolls the map along its own horizontal, dragging up
  // and down slides it, nothing tilts any more. "North up" (or reset) returns to the normal aspect.
  // Neither switch changes the picture: unlocking keeps the current rotation and the map's position on screen
  // (this.off, the rotation centre's offset from the screen centre, in units of the map's scale), and only
  // lets dragging turn the globe from there on; locking keeps the turned map and only stops it turning.
  setFree(on) {
    const v = this.view, p = this.proj;
    if (!p) { this.free = !!on; return; }
    p.angle(0); this.apply0();
    const T = p.translate(), R = p.rotate(), S = p.scale();
    if (on) {
      this.aspect = null; this.free = true;
      Object.assign(v, { lon: -R[0], lat: -R[1], roll: R[2] || 0, ty: 0 });
      this.off = [(T[0] - this.W / 2) / S, (T[1] - this.H / 2) / S];
    } else {
      this.free = false; this.off = null;
      if (Math.abs(R[1]) > 0.01 || Math.abs(R[2] || 0) > 0.01) {
        this.aspect = [R[0], R[1], R[2] || 0];
        p.rotate(this.aspect).translate([0, 0]);
        const [[, top], [, bot]] = geoPath(p).bounds(SPHERE);
        v.ty = T[1] - (this.H / 2 - (top + bot) / 2);
      } else {
        p.rotate(R).translate(T);
        const c = p.invert([this.W / 2, this.H / 2]);
        Object.assign(v, { lon: -R[0], lat: c && isFinite(c[1]) ? c[1] : 0, roll: 0 });
      }
    }
    this.gKey = null;
    this.apply(); this.request(); this.app.onViewChange?.();
  }
  // a sideways scroll in the map's own frame: rotate about the map's pole after the current rotation,
  // re-expressed as d3's [λ, φ, γ] (M = Gx(γ)·Py(φ)·Lz(λ); new = Lz(δ)·M)
  static scrollRotation([l, f, g], d) {
    const R = Math.PI / 180, cl = Math.cos(l * R), sl = Math.sin(l * R), cf = Math.cos(f * R), sf = Math.sin(f * R), cg = Math.cos(g * R), sg = Math.sin(g * R);
    const Lz = [[cl, -sl, 0], [sl, cl, 0], [0, 0, 1]], Py = [[cf, 0, -sf], [0, 1, 0], [sf, 0, cf]], Gx = [[1, 0, 0], [0, cg, -sg], [0, sg, cg]];
    const mul = (A, B) => A.map((r, i) => B[0].map((_, j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    const cd = Math.cos(d * R), sd = Math.sin(d * R);
    const N = mul([[cd, -sd, 0], [sd, cd, 0], [0, 0, 1]], mul(Gx, mul(Py, Lz)));
    return [Math.atan2(-N[0][1], N[0][0]) / R, Math.asin(Math.max(-1, Math.min(1, -N[0][2]))) / R, Math.atan2(-N[1][2], N[2][2]) / R];
  }
  get clipRad() { return (this.def.clip || 180) * Math.PI / 180; }

  setProjection(name) {
    this.projName = name;
    this.aspect = null; this.off = null;
    this.def = PROJ[name];
    this.proj = this.def.make();
    if (this.def.clip) this.proj.clipAngle(this.def.clip);
    // projections without a finite edge are fitted / scrolled within a latitude band instead of the sphere
    this.outline = this.def.lat ? geoGraticule().extentMajor([[-180, this.def.lat[0]], [180, this.def.lat[1]]]).outline() : SPHERE;
    if (this.def.lat) this.proj.clipExtent?.(null);
    this.fit();
    this.request();
  }

  setRaster(img) { this.raster = img; this.rasterCache = null; this.request(); }
  // regional sharper images [{bounds: [lon0, lat0, lon1, lat1], minzoom, img}] sampled before the global one
  setHires(list) {
    this.hiresData = (list || []).map(g => {
      const c = document.createElement('canvas'); c.width = g.img.width; c.height = g.img.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(g.img, 0, 0);
      return { b: g.bounds, w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data, minK: 2.5 };
    }).sort((a, b) => (b.w / (b.b[2] - b.b[0])) - (a.w / (a.b[2] - a.b[0])));
    this.rasterCache = null; this.request();
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.canvas.style.width = r.width + 'px';
    this.canvas.style.height = r.height + 'px';
    if (this.proj) { this.fit(); this.request(); }
  }

  // base scale: the whole sphere fits the viewport at k = 1
  fit() {
    const p = this.proj;
    p.rotate([0, 0]).scale(1).translate([0, 0]);
    const [[x0, y0], [x1, y1]] = geoPath(p).bounds(this.outline);
    this.baseScale = Math.min(this.W / (x1 - x0), this.H / (y1 - y0)) * 0.98;
    this.minK = 1;
    // cylinders with a tall band (Mercator, central cylindrical) are sized by width, like Google Maps; they may
    // still be zoomed out until the whole map is in view
    if (this.def.lat && this.def.surface === 'cylindrical') { const whole = this.baseScale; this.baseScale = this.W / (2 * Math.PI); this.minK = Math.min(1, whole / this.baseScale); }
    this.apply();
  }

  apply() {
    // "which way is up": a screen rotation of the whole projected map about the centre of the view
    if (!this.proj) return;
    this.proj.angle(0);
    this.apply0();
    const a = this.angle || 0;
    if (a) {
      const p = this.proj, [tx, ty] = p.translate(), cx = this.W / 2, cy = this.H / 2, r = -a * Math.PI / 180;
      const dx = tx - cx, dy = ty - cy;
      p.angle(a).translate([cx + dx * Math.cos(r) - dy * Math.sin(r), cy + dx * Math.sin(r) + dy * Math.cos(r)]);
    }
  }
  apply0() {
    const p = this.proj, v = this.view;
    v.k = Math.max(this.minK ?? 1, Math.min(MAX_K, v.k));
    v.lon = ((v.lon + 540) % 360) - 180;
    if (this.aspect) {                             // locked in an oblique aspect: scroll and slide only
      p.rotate(this.aspect).scale(this.baseScale * v.k).translate([0, 0]);
      const [[x0, top], [x1, bot]] = geoPath(p).bounds(SPHERE);
      const room = Math.max(0, (bot - top - this.H) / 2);
      v.ty = Math.max(-room, Math.min(room, v.ty || 0));
      p.translate([this.W / 2 - (x0 + x1) / 2, this.H / 2 - (top + bot) / 2 + v.ty]);
      const c = p.invert([this.W / 2, this.H / 2]);
      if (c && isFinite(c[0])) { v.lon = c[0]; v.lat = c[1]; }
      return;
    }
    if (this.rotating) {
      v.lat = Math.max(-90, Math.min(90, v.lat));
      const sc = this.baseScale * v.k, o = this.oblique && this.off ? this.off : [0, 0];
      p.rotate([-v.lon, -v.lat, v.roll || 0]).scale(sc).translate([this.W / 2 + o[0] * sc, this.H / 2 + o[1] * sc]);
      return;
    }
    p.rotate([-v.lon, 0]).scale(this.baseScale * v.k).translate([0, 0]);
    // keep the map from scrolling past its top/bottom edge, like Google Maps
    // (turned sideways, the map's own top/bottom runs along the screen's width)
    const Hm = Math.abs(this.angle || 0) === 90 ? this.W : this.H;
    const [[, top], [, bot]] = geoPath(p).bounds(this.outline);
    let cy = p([v.lon, v.lat])[1];
    const half = Hm / 2;
    if (bot - top <= Hm) cy = (top + bot) / 2;
    else cy = Math.max(top + half, Math.min(bot - half, cy));
    p.translate([this.W / 2, this.H / 2 + half - cy - Hm / 2]);
    const inv = p.invert([this.W / 2, this.H / 2]);
    if (inv && isFinite(inv[1])) v.lat = inv[1];
  }

  // ---- navigation ------------------------------------------------------------------------------
  panBy(dx, dy, roll = false) {
    if (this.locked) return;
    const p = this.proj, v = this.view;
    if (this.angle && !roll && (this.aspect || this.rotating)) {        // screen drag → the map's own axes
      const r = this.angle * Math.PI / 180, x = dx, y = dy;
      dx = x * Math.cos(r) - y * Math.sin(r); dy = x * Math.sin(r) + y * Math.cos(r);
    }
    if (this.aspect) {
      if (!roll) { this.aspect = FlatMap.scrollRotation(this.aspect, dx * 180 / Math.PI / p.scale()); v.ty = (v.ty || 0) + dy; }
    } else if (roll && this.rotating) {
      v.roll = ((v.roll || 0) + dx * 0.4 + 540) % 360 - 180;
    } else if (this.rotating) {
      const deg = 180 / Math.PI / p.scale();
      v.lon -= dx * deg; v.lat += dy * deg;
    } else {
      const c = p.invert([this.W / 2 - dx, this.H / 2 - dy]);
      const ref = p.invert([this.W / 2, this.H / 2]);
      if (c && ref && isFinite(c[0])) {
        let dl = c[0] - ref[0];
        if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
        v.lon += dl; v.lat = c[1];
      } else {
        v.lon -= dx * 180 / Math.PI / p.scale();
      }
    }
    this.apply(); this.markMoving(); this.request(); this.app.onViewChange?.();
  }

  markMoving() {
    this.moving = true;
    clearTimeout(this.moveTimer);
    this.moveTimer = setTimeout(() => { this.moving = false; if (this.coarse) { this.gKey = null; this.request(); } }, 160);
  }

  zoomAt(factor, mx = this.W / 2, my = this.H / 2) {
    if (this.locked) return;
    const p = this.proj, v = this.view;
    const before = p.invert([mx, my]);
    const k0 = v.k;
    v.k = Math.max(this.minK ?? 1, Math.min(MAX_K, v.k * factor));
    if (v.k === k0) return;
    this.apply();
    if (before && isFinite(before[0])) {
      const after = p(before);
      if (after) this.panBy(mx - after[0], my - after[1]);
    }
    this.request(); this.app.onViewChange?.();
  }

  animateZoom(factor, mx, my, ms = 220) {
    const t0 = performance.now();
    let done = 1;
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const target = Math.pow(factor, e);
      this.zoomAt(target / done, mx, my);
      done = target;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  reset() { this.aspect = null; this.off = null; this.view = { lon: 60, lat: this.oblique ? 0 : 25, k: this.fillK(), roll: 0 }; this.apply(); this.request(); this.app.onViewChange?.(); }
  // back to the normal aspect: north up, and (for oblique-capable maps) the equator straight
  // back to the normal aspect; which way is up (the "Up" setting) is kept
  // "Normal aspect": undo only the turning the standard movement would not allow — the tilt (turning about the
  // map's own horizontal axis) and the roll — and keep the turning along the map's horizontal (longitude) and the
  // place at the centre of the screen. "The map's horizontal" follows the chosen Up, since the whole map is turned
  // with it. Zoom stays; "Reset view" restores everything.
  northUp() {
    const v = this.view, p = this.proj;
    if (!p) return;
    if (this.azimuthal) { v.roll = 0; this.off = null; this.apply(); this.request(); this.app.onViewChange?.(); return; }
    p.angle(0); this.apply0();
    const c = p.invert([this.W / 2, this.H / 2]), lon = c && isFinite(c[0]) ? c[0] : v.lon, lat = c && isFinite(c[1]) ? c[1] : 0;
    this.aspect = null; this.off = null;
    Object.assign(v, { lon, roll: 0, ty: 0 });
    if (this.oblique) {
      // unlocked: still free to turn, but from the normal aspect, shifted so the same place stays in the middle
      v.lat = 0;
      p.rotate([-lon, 0, 0]).scale(1).translate([0, 0]);
      const q = p([lon, lat]);
      let oy = q && isFinite(q[1]) ? -q[1] : 0;
      // like the locked map, the map may not leave a gap at its top or bottom: a map shorter than the screen is
      // centred, a taller one is pulled back until its edge meets the screen's edge
      const [[, top], [, bot]] = geoPath(p).bounds(SPHERE), S = this.baseScale * v.k, half = this.H / 2 / S;
      if (bot - top <= 2 * half) oy = -(top + bot) / 2;
      else oy = Math.max(half - bot, Math.min(-half - top, oy));
      this.off = [0, oy];
    } else v.lat = lat;
    this.gKey = null;
    this.apply(); this.request(); this.app.onViewChange?.();
  }

  bindEvents() {
    const c = this.canvas;
    c.tabIndex = 0;
    let moved = 0, last = null, pinch = null;
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      const cmp = this.app.compare, ll = this.proj.invert([e.offsetX, e.offsetY]);
      if (cmp?.on && ll && cmp.contains(ll)) { this.cmpDrag = { grab: ll, c0: [...cmp.center] }; moved = 10; return; }
      // a picture card: drag it instead of the map
      const card = this.pointers.size ? null : this.cardAt(e.offsetX, e.offsetY);
      if (card) { this.cardDrag = { ...card, gx: e.offsetX - card.x0, gy: e.offsetY - card.y0, sx: e.offsetX, sy: e.offsetY, moved: 0 }; c.classList.add('grabbing'); return; }
      this.pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      moved = 0; last = [e.offsetX, e.offsetY];
      if (this.pointers.size === 2) pinch = this.pinchState();
      c.classList.add('grabbing');
    });
    c.addEventListener('pointermove', e => {
      if (this.cardDrag) {
        const d = this.cardDrag; d.moved = Math.max(d.moved, Math.abs(e.offsetX - d.sx) + Math.abs(e.offsetY - d.sy));
        if (d.moved >= 4) { dragCard(d, e.offsetX, e.offsetY); this.request(); }
        return;
      }
      if (this.cmpDrag) {
        const ll = this.proj.invert([e.offsetX, e.offsetY]), d = this.cmpDrag;
        if (ll && isFinite(ll[0])) { let dl = ll[0] - d.grab[0]; if (dl > 180) dl -= 360; if (dl < -180) dl += 360; this.app.compare.center = [d.c0[0] + dl, Math.max(-80, Math.min(80, d.c0[1] + ll[1] - d.grab[1]))]; this.request(); }
        return;
      }
      if (!this.pointers.has(e.pointerId)) {
        const cl = this.app.compare?.on && this.proj.invert([e.offsetX, e.offsetY]);
        c.style.cursor = cl && this.app.compare.contains(cl) ? 'move' : ''; this.app.onHover?.(this.hit(e.offsetX, e.offsetY), e); return; }
      this.pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (this.pointers.size === 2 && pinch) {
        const s = this.pinchState();
        this.zoomAt(s.d / pinch.d, s.cx, s.cy);
        this.panBy(s.cx - pinch.cx, s.cy - pinch.cy);
        pinch = s; moved += 10;
        return;
      }
      const dx = e.offsetX - last[0], dy = e.offsetY - last[1];
      moved += Math.abs(dx) + Math.abs(dy);
      last = [e.offsetX, e.offsetY];
      this.panBy(dx, dy, e.shiftKey || (e.buttons & 2) === 2);      // Shift- or right-drag: turn around the centre
    });
    const end = e => {
      if (this.cardDrag) {
        const d = this.cardDrag; this.cardDrag = null; c.classList.remove('grabbing');
        if (e.type === 'pointerup' && d.moved < 4) this.app.onSelect?.(this.hit(e.offsetX, e.offsetY), e);   // a click
        return;
      }
      if (this.cmpDrag) { this.cmpDrag = null; return; }
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) pinch = null;
      if (this.pointers.size === 1) last = [...this.pointers.values()][0];
      if (!this.pointers.size) c.classList.remove('grabbing');
      if (e.type === 'pointerup' && moved < 4 && !this.pointers.size) this.app.onSelect?.(this.hit(e.offsetX, e.offsetY), e);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', e => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
      this.zoomAt(f, e.offsetX, e.offsetY);
    }, { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());           // right-drag rotates
    c.addEventListener('dblclick', e => this.animateZoom(e.shiftKey ? 0.5 : 2, e.offsetX, e.offsetY));
    c.addEventListener('keydown', e => {
      const step = 80;
      const k = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (k) { e.preventDefault(); this.panBy(...k); }
      if (e.key === '+' || e.key === '=') this.animateZoom(2);
      if (e.key === '-' || e.key === '_') this.animateZoom(0.5);
    });
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
  }

  // what is under the cursor: a disputed area first, then the top-most polity
  hit(x, y) {
    const pu = pulseAt(x, y); if (pu) return { pulse: pu };
    const mk = (this.markerHits || []).find(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
    if (mk) return { marker: mk.m };
    const ln = [0, ...(this.langOffs || [])].reduce((f, o) => f || lineAt(this.lineHits, x - o, y), null); if (ln) return { line: ln };
    const ll = this.proj.invert([x, y]);
    if (!ll || !isFinite(ll[0])) return null;
    if (this.azimuthal && geoDistance(ll, [this.view.lon, this.view.lat]) > this.clipRad) return null;
    const year = this.app.state.year;
    if (!REGIONS.includes(this.app.state.mode)) for (const d of store.disputed) {
      const q = d.properties;
      if (q.a <= year && year <= q.b && geoContains(d, ll)) {
        const under = this.polityAt(ll);
        return { disputed: d, polity: under };
      }
    }
    const f = this.featureAt(ll);
    return f ? { polity: f.properties.p, sec: typeof f.properties.s === 'number' ? f.properties.s : null, prov: f.properties.prov } : null;
  }

  // the picture card under (x, y): a marker's or an event's, with its key and its marker's place
  cardAt(x, y) { return cardUnder(this.markerHits, x, y); }
  polityAt(ll) { return this.featureAt(ll)?.properties.p ?? null; }
  featureAt(ll) {
    const feats = frame(this.app.state).feats;
    for (let i = feats.length - 1; i >= 0; i--) if (geoContains(feats[i], ll)) return feats[i];
    return null;
  }

  // ---- cached geometry -------------------------------------------------------------------------
  // Paths are projected once into a reference frame (same projection and rotation, scale rounded to a
  // power of two, no translation) and kept as Path2D objects. Zooming and vertical panning are then only
  // a canvas transform, which the GPU does for free; cylindrical maps also pan sideways by translation,
  // drawing as many copies of the world as needed (like Google Maps). Changing the year reuses the cached
  // paths of every polity that did not change.
  geoState() {
    const s = this.proj.scale(), r = 2 ** Math.round(Math.log2(s));
    const cyl = this.def.surface === 'cylindrical' && !this.rotating && !this.angle;
    const rot = cyl ? [0, 0, 0] : this.proj.rotate();
    const key = [this.projName, r, cyl ? '' : rot.map(v => v.toFixed(5)).join(), this.angle || 0].join('|');
    if (this.gKey === key) return;
    // while dragging a projection whose shape changes with the view, use coarse land to stay fluid
    this.coarse = !cyl && !!this.moving && !!this.gKey && this.gKey.split('|')[0] === this.projName;
    this.gKey = key; this.cyl = cyl; this.refScale = r;
    const p = this.def.make(); if (this.def.clip) p.clipAngle(this.def.clip);
    p.rotate(rot).scale(r).translate([0, 0]).angle(this.angle || 0);
    this.refProj = p; this.refPath = geoPath(p);
    this.pcache = new WeakMap();
    if (cyl) this.worldW = p([180 - 1e-7, 0])[0] - p([-180 + 1e-7, 0])[0];
  }
  P2(obj) {
    const k = obj.geometry || obj;
    let x = this.pcache.get(k);
    if (!x) { x = new Path2D(); this.refPath.context(x)(obj); this.pcache.set(k, x); }
    return x;
  }
  // affine transforms (one per visible copy of the world) from the reference frame to the screen
  transforms(extra = 1) {
    const s = this.proj.scale(), a = s / this.refScale;
    if (!this.cyl) { const [tx, ty] = this.proj.translate(); return [[a * extra, tx * extra, ty * extra]]; }
    const [e, ty] = this.proj([0, 0]), ww = this.worldW * a, out = [];
    const n0 = Math.ceil((-e - ww / 2) / ww - 1e-9), n1 = Math.floor((this.W - e + ww / 2) / ww + 1e-9);
    for (let n = n0; n <= n1; n++) out.push([a * extra, (e + n * ww) * extra, ty * extra]);
    return out;
  }
  // run fn(scale) once per copy with ctx transformed into the reference frame
  each(ctx, fn, extra = this.dpr) {
    for (const [a, x, y] of this.transforms(extra)) { ctx.setTransform(a, 0, 0, a, x, y); fn(a / extra); }
    ctx.setTransform(extra, 0, 0, extra, 0, 0);
  }

  // ---- drawing ---------------------------------------------------------------------------------
  request() {
    if (this.dirty) return;
    this.dirty = true;
    requestAnimationFrame(() => { this.dirty = false; this.draw(); });
  }

  viewKey() { return [this.projName, this.view.lon, this.view.lat, this.view.k, this.W, this.H].join(); }

  // Fill layers are drawn at the screen's resolution when still, and at one pixel per CSS pixel during playback,
  // when they are redrawn and blended every frame (on high-density screens that is 2–4 times fewer pixels;
  // the borders and labels on top stay sharp).
  get fs() { return this.app.state.playing || this.app.state.dragging ? Math.min(1, this.dpr) : this.dpr; }
  layer(name) {
    const c = (this.layers ||= {})[name] ||= document.createElement('canvas');
    const w = Math.round(this.W * this.fs), h = Math.round(this.H * this.fs);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  // polity fills (opaque; the map's colour strength is applied when the layer is composited)
  drawFills(g, feats, F) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    this.each(g, () => {
      for (const f of feats) {
        const p = this.P2(f);
        g.fillStyle = F.color(f.properties.p); g.fill(p);
        if (f.properties.s != null) { g.fillStyle = this.stripes(F.color(f.properties.s)); g.fill(p); }
      }
    }, g.canvas.width / this.W);
  }

  // owner raster on the transition grid
  idRaster(feats, w, h, cell) {
    const c = this.idCanvas ||= document.createElement('canvas');
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d', { willReadFrequently: true });
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    // one colour per polity (not per piece), so pieces of one polity read back as one
    const idx = new Map(), ids = [];
    for (const f of feats) if (!idx.has(f.properties.p) && ids.length < 4095) { idx.set(f.properties.p, ids.length); ids.push(f.properties.p); }
    this.each(g, () => {
      for (const f of feats) {
        if (!idx.has(f.properties.p)) continue;
        g.fillStyle = idColor(idx.get(f.properties.p));
        g.fill(this.P2(f));
      }
    }, 1 / cell);
    return decodeIds(g.getImageData(0, 0, w, h).data, w, h, ids);
  }

  // start / continue a territory transition when the set of polities changed under a still view
  updateTransition(feats, F, fillB) {
    const st = this.app.state, now = performance.now();
    const fkey = feats.map(f => f.properties.p).join();
    const vkey = this.viewKey();
    const cell = 3, w = Math.ceil(this.W / cell), h = Math.ceil(this.H / cell);
    if (!w || !h) return;                         // not laid out yet (e.g. a phone before its first layout)
    const T = this.trans;
    const sameView = this.lastVKey === vkey;
    const changed = this.lastFKey != null && fkey !== this.lastFKey;
    this.lastVKey = vkey;
    // browsers that scramble canvas reads (anti-fingerprinting) cannot run the animation: changes then just appear
    this.readOk ??= readbackOk();
    const anim = st.animate && this.readOk && !st.dragging;   // dragging the timeline: changes just appear
    if (!sameView || !anim) { this.trans = null; this.lastIds = null; }
    if (changed && sameView && anim) {
      const idB = this.idRaster(feats, w, h, cell);
      let idA = this.lastIds;
      if (T && T.plan) idA = idsAt(T.plan, ease(Math.min(1, (now - T.t0) / T.dur)));
      if (idA && idA.length === idB.length) {
        const mode = st.transition === 'jump' ? 'jump' : 'grow';
        const plan = planTransition(w, h, idA, idB, mode);
        if (plan) {
          const layerA = this.layer(T ? 'swap' : 'A');
          const g = layerA.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, layerA.width, layerA.height);
          // the picture on screen until now: the running transition's, or the previous frame's fills
          g.drawImage(T ? this.layers.shown : this.prevFill?.width === fillB.width ? this.prevFill : fillB, 0, 0);
          if (T) { this.layers.swap = this.layers.A; this.layers.A = layerA; }
          const mk = () => new ImageData(w, h);
          this.trans = { plan, t0: now, dur: mode === 'jump' ? 750 : st.playing ? Math.max(220, Math.min(450, 450 / st.speed)) : 400,
            layerA: this.layers.A, maskA: mk(), maskB: mk(), cell, w, h, prevFeats: this.lastFeatsDrawn, init: true };
        }
      }
      this.lastIds = idB;
    } else if (!this.lastIds || this.lastIds.length !== w * h || !sameView) {
      this.lastIds = anim ? this.idRaster(feats, w, h, cell) : null;
    }
    this.lastFKey = fkey;
  }

  // the fill picture for this frame: the new fills as they are, or, while a transition runs, the old and new
  // fills blended through the masks. Only the box around the changed cells is composited; elsewhere the old
  // and new pictures are the same. Returns [canvas, progress or null].
  composite(fillB) {
    const T = this.trans;
    if (!T) return [fillB, null];
    const t = Math.min(1, (performance.now() - T.t0) / T.dur), e = ease(t);
    if (t >= 1 || T.layerA.width !== fillB.width) { this.trans = null; return [fillB, null]; }   // done, or the resolution changed
    const shown = this.layer('shown'), g = shown.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, shown.width, shown.height);
    g.drawImage(fillB, 0, 0);
    fillMasks(T.plan, e, T.maskA, T.maskB, T.init); T.init = false;
    const m = this.maskCanvas ||= document.createElement('canvas');
    if (m.width !== T.w || m.height !== T.h) { m.width = T.w; m.height = T.h; }
    const mg = m.getContext('2d');
    const tmp = this.layer('tmp'), tg = tmp.getContext('2d');
    g.imageSmoothingEnabled = tg.imageSmoothingEnabled = true;
    const [bx0, by0, bx1, by1] = T.plan.box, k = T.cell * shown.width / this.W;
    const px = Math.floor(bx0 * k), py = Math.floor(by0 * k), pw = Math.min(shown.width, Math.ceil(bx1 * k)) - px, ph = Math.min(shown.height, Math.ceil(by1 * k)) - py;
    if (pw <= 0 || ph <= 0) { this.request(); return [shown, e]; }
    g.clearRect(px, py, pw, ph);
    for (const [src, mask] of [[T.layerA, T.maskA], [fillB, T.maskB]]) {
      mg.putImageData(mask, 0, 0, bx0, by0, bx1 - bx0, by1 - by0);
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over';
      tg.clearRect(px, py, pw, ph); tg.drawImage(src, px, py, pw, ph, px, py, pw, ph);
      tg.globalCompositeOperation = 'destination-in';
      tg.drawImage(m, px / k, py / k, pw / k, ph / k, px, py, pw, ph);
      tg.globalCompositeOperation = 'source-over';
      g.drawImage(tmp, px, py, pw, ph, px, py, pw, ph);
    }
    this.request();                                  // keep animating
    return [shown, e];
  }

  draw() {
    if (!this.proj) return;                    // a redraw asked for before the first projection is set
    const { ctx, proj, W, H, dpr } = this;
    if (!W || !H) return;                         // nothing to draw before the first layout
    const app = this.app, st = app.state;
    const S = BASEMAPS[st.basemap];
    this.geoState();
    const live = geoPath(proj, ctx);
    const lw = (w, a) => w / a;                     // line widths are given in screen pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, W, H);

    // sphere / ocean, and clip to it
    ctx.save();
    ctx.beginPath();
    if (this.cyl) { const [[, y0], [, y1]] = geoPath(proj).bounds(this.outline); ctx.rect(0, y0, W, y1 - y0); } else live(this.outline);
    ctx.fillStyle = S.ocean; ctx.fill();
    ctx.clip();

    if (S.raster && this.raster) this.drawRaster();
    else {
      this.each(ctx, () => {
        if (st.basemap === 'physical' && store.physical && !this.coarse) for (const b of store.physical.bathy) { ctx.fillStyle = S.bathy[b.properties.depth] || S.ocean; ctx.fill(this.P2(b)); }
        ctx.fillStyle = S.land; ctx.fill(this.P2(this.base.land));
        if (st.basemap === 'physical' && store.physical && !this.coarse) {
          const col = { Desert: S.desert, 'Range/mtn': S.mountain, Plateau: S.plateau, Tundra: S.tundra };
          for (const r of store.physical.regions) { ctx.fillStyle = col[r.properties.k] || S.land; ctx.fill(this.P2(r)); }
          ctx.fillStyle = S.ice; ctx.fill(this.P2(store.physical.ice));
        }
      });
      // a country mode's own grey hill shading always; the world modes Taiwan's and Japan's with "detailed terrain" on
      const only = st.basemap === 'physical' && this.relief ? reliefFor(st.mode, this.relief.regions, st.relief) : [];
      if (only.length) { this.relief.only = only; this.drawRelief(); }
      else if (this.reliefShown?.length) { this.reliefShown = []; this.app.updateReliefCredit?.([]); }
    }

    // polities (or provinces / units in the regional modes)
    const F = frame(st);
    let feats = F.feats;
    if (!feats.length && this.lastFeats && !REGIONS.includes(st.mode)) feats = this.lastFeats; else this.lastFeats = feats;
    if (F.context) {                                  // regional modes: the rest of the world in grey
      this.each(ctx, a => {
        ctx.save();
        if (this.base?.land) ctx.clip(this.P2(this.base.land));   // coarse world shapes: keep them off the sea
        ctx.globalAlpha = 0.45; ctx.fillStyle = '#d9d4c7';    // one quiet tone, no outlines
        for (const f of F.context) ctx.fill(this.P2(f));
        ctx.globalAlpha = 1; ctx.restore();
      });
    }
    // fills alternate between two layers, so the previous frame's picture is still there when a transition starts
    this.fillFlip = !this.fillFlip;
    const fillB = this.layer(this.fillFlip ? 'B' : 'B2'), fillFeats = F.fillFeats || feats;
    this.prevFill = this.layers[this.fillFlip ? 'B2' : 'B'] || null;
    this.drawFills(fillB.getContext('2d'), fillFeats, F);
    this.updateTransition(fillFeats, F, fillB);
    const [pic, prog] = this.composite(fillB);
    const alpha = Math.min(1, S.polityAlpha * st.density / 0.85);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha; ctx.drawImage(pic, 0, 0, this.canvas.width, this.canvas.height); ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // disputed areas: owner colour under the chosen point of view, always hatched
    const disp = F.disputed ? store.disputed.filter(d => d.properties.a <= st.year && st.year <= d.properties.b) : [];
    this.hatch ||= hatchPattern(ctx);
    this.each(ctx, a => {
      if (disp.length && st.pov !== 'defacto') {
        ctx.globalAlpha = alpha;
        for (const d of disp) { const owner = d.properties.pov?.[st.pov]; if (owner == null) continue; ctx.fillStyle = F.color(owner); ctx.fill(this.P2(d)); }
        ctx.globalAlpha = 1;
      }
      for (const d of disp) {
        const p = this.P2(d);
        ctx.fillStyle = this.hatch; ctx.fill(p);
        ctx.setLineDash([4 / a, 3 / a]); ctx.strokeStyle = 'rgba(20,20,20,0.8)'; ctx.lineWidth = lw(1, a); ctx.stroke(p); ctx.setLineDash([]);
      }
      // CCP base areas (approximate)
      for (const o of F.overlays) {
        const p = this.P2(o);
        ctx.fillStyle = 'rgba(211,47,47,0.35)'; ctx.fill(p);
        ctx.setLineDash([5 / a, 3 / a]); ctx.strokeStyle = '#b71c1c'; ctx.lineWidth = lw(1.4, a); ctx.stroke(p); ctx.setLineDash([]);
      }
      // borders (cross-fading while a transition runs)
      if (st.borders) {
        const bw = lw(S.borderW * Math.min(2, 0.8 + this.view.k * 0.1), a);
        ctx.strokeStyle = S.border; ctx.lineWidth = bw;
        if (prog != null && this.trans?.prevFeats) {
          ctx.globalAlpha = 1 - prog; for (const f of this.trans.prevFeats) ctx.stroke(this.P2(f));
          ctx.globalAlpha = prog;
        }
        for (const f of feats) ctx.stroke(this.P2(f));
        ctx.globalAlpha = 1;
      }
      // both layers: control areas as a ribbon inside their edge (clip to the area, stroke twice the width)
      if (F.ribbons) {
        for (const f of F.ribbons) {
          // stroke the shared border lines rather than the area's own outline: merged areas can carry
          // zero-width seams and spikes that would show up as dots and bars inside the area
          const p = this.P2(f);
          ctx.save(); ctx.clip(p);
          ctx.globalAlpha = 0.8; ctx.strokeStyle = F.color(f.properties.p); ctx.lineWidth = lw(10, a); ctx.stroke(F.ribbonLines ? this.P2(F.ribbonLines) : p);
          ctx.restore();
        }
      }
      // divisions' boundaries
      if (F.adminLines) {
        ctx.setLineDash([5 / a, 3 / a]); ctx.lineWidth = lw(1.3, a);
        ctx.strokeStyle = 'rgba(40,40,70,0.85)'; ctx.stroke(this.P2(F.adminLines)); ctx.setLineDash([]);
      }
      // China mode: outer edge of territory held by governments that claimed to be the ROC, in gold
      if (F.rocOutline) {
        const p = this.P2(F.rocOutline);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = lw(4.2, a); ctx.stroke(p);
        ctx.strokeStyle = ROC_COLOR; ctx.lineWidth = lw(2.4, a); ctx.stroke(p);
      }
      // lakes & rivers on top of polity colours
      const zoomed = this.view.k >= 4 && store.detail && !this.coarse;
      ctx.fillStyle = S.lake; ctx.fill(this.P2(zoomed ? store.detail.lakes : this.base.lakes));
      if (st.rivers) {
        const rv = [this.P2(zoomed ? store.detail.rivers : this.base.rivers)];
        if (zoomed && store.detail.local) rv.push(this.P2(store.detail.local));
        if (zoomed) {                                   // light casing so rivers read over any polity colour
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = lw(2.8, a); for (const p of rv) ctx.stroke(p);
          ctx.strokeStyle = 'rgba(30,100,190,0.95)'; ctx.lineWidth = lw(1.3, a);
        } else { ctx.strokeStyle = S.river; ctx.lineWidth = lw(0.8, a); }
        for (const p of rv) ctx.stroke(p);
      }
      if (st.modern && store.modern && !REGIONS.includes(st.mode)) {
        ctx.setLineDash([4 / a, 2 / a]); ctx.lineWidth = lw(0.9, a);
        ctx.strokeStyle = S.modern || 'rgba(120,0,90,0.85)'; ctx.stroke(this.P2(store.modern));
        ctx.setLineDash([]);
      }
      if (st.graticule) { ctx.strokeStyle = S.graticule; ctx.lineWidth = lw(0.6, a); ctx.stroke(this.P2(GRAT)); }
    });
    if (S.paper) this.drawPaper();
    ctx.restore();
    this.lastFeatsDrawn = feats;

    // outline of the sphere
    if (!this.cyl) { ctx.beginPath(); live(this.outline); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }

    if (st.distort && this.def.prop !== 'perspective' || st.distort && this.def.light === 'gnomonic') this.drawDistortion();
    if (st.labels && !F.noLabels) this.drawLabels(feats, S, F);   // the language mode names languages, not states
    if (this.app.pin) this.drawPinned(this.app.pin.feats);
    if (st.selected != null) this.drawSelection(feats, st.selected);
    this.drawMarkers(F, S);
    if (this.app.compare?.on) {
      const center = [this.view.lon, this.view.lat];
      this.app.drawCompare(ctx, ll => (this.azimuthal && geoDistance(ll, center) > this.clipRad - 0.02) ? null : this.proj(ll), xy => this.proj.invert(xy));
    }
    this.app.eventLayer?.draw(ctx, proj => this.proj(proj), st.langInfo.col);
  }

  stripes(color) {
    this.stripeCache ||= new Map();
    if (!this.stripeCache.has(color)) {
      const c = document.createElement('canvas'); c.width = c.height = 10;
      const g = c.getContext('2d'); g.strokeStyle = color; g.lineWidth = 3.2;
      g.beginPath(); for (let i = -1; i <= 1; i++) { g.moveTo(i * 10, 10); g.lineTo(i * 10 + 10, 0); } g.stroke();
      this.stripeCache.set(color, this.ctx.createPattern(c, 'repeat'));
    }
    return this.stripeCache.get(color);
  }

  // government seats (★) and CCP base-area names in China mode
  drawMarkers(F, S) {
    const { ctx, proj } = this, st = this.app.state;
    const col = st.langInfo.col, center = [this.view.lon, this.view.lat];
    const visible = ll => !(this.azimuthal && geoDistance(ll, center) > Math.min(this.clipRad, 1.5));
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const a of F.overlays) {
      const c = a.geometry.coordinates[0], ll = [(c[0][0] + c[24][0]) / 2, (c[12][1] + c[36][1]) / 2];
      if (!visible(ll)) continue;
      const p = proj(ll); if (!p) continue;
      const name = a.properties.name[col] || a.properties.name[0];
      ctx.font = `600 11px ${S.label.font}`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'center';
      ctx.strokeText(name, p[0], p[1]); ctx.fillStyle = '#8b0000'; ctx.fillText(name, p[0], p[1]);
    }
    ctx.textAlign = 'left';
    this.lineHits = [];
    if (F.lang) {
      // kept inside the map's outline: in the conic and interrupted projections a route may otherwise run off it
      ctx.save(); ctx.beginPath();
      if (this.cyl) { const [[, y0], [, y1]] = geoPath(proj).bounds(this.outline); ctx.rect(0, y0, this.W, y1 - y0); } else geoPath(proj, ctx)(this.outline);
      ctx.clip();
      const gp = geoPath(proj, ctx), pt = ll => (visible(ll) ? proj(ll) : null);
      // the cylinders show the world more than once side by side (wide screens, zoomed out): the routes go on
      // every copy, as the land does; the hits are the middle copy's, the others found by shifting the pointer
      const e = this.cyl ? proj([0, 0])[0] : 0;
      this.langOffs = this.cyl ? this.transforms(1).map(([, x]) => x - e).filter(o => Math.abs(o) > 1) : [];
      for (const o of this.langOffs) { ctx.save(); ctx.translate(o, 0); drawLang(ctx, F.lang, g => gp(g), pt, S.label.font, this.view.k); ctx.restore(); }
      this.lineHits = drawLang(ctx, F.lang, g => gp(g), pt, S.label.font, this.view.k);
      ctx.restore();
      if (labelsMoving()) this.request();          // names still sliding apart
    }
    const placed = [], hits = this.markerHits = [];
    const marks = this.app.pin?.marks?.length ? [...this.app.pin.marks, ...F.markers] : F.markers;
    // every marker's own symbol is reserved first, so no picture lands on another marker
    for (const m of marks) { if (!m.pic || !visible([m.lon, m.lat])) continue; const p = proj([m.lon, m.lat]); if (p) placed.push([p[0] - 9, p[1] - 9, p[0] + 9, p[1] + 9]); }
    const pproj = ll => (visible(ll) ? proj(ll) : null);
    reservePulses(pproj, placed, S.label.font);
    for (const m of marks) {
      if (!visible([m.lon, m.lat])) continue;
      const p = proj([m.lon, m.lat]); if (!p) continue;
      if (m.kind && !['gov', 'art', 'langArea', 'feud', 'power', 'us', 'work'].includes(m.kind) && !(m.kind === 'cap' && (m.pin || m.big && (this.W >= 600 || m.rank < 10)))) {
        // capitals: once the country is big enough on screen; other seats only once zoomed in
        if (m.kind === 'cap') { const q = proj([m.lon, Math.min(89, m.lat + 0.5)]); if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) * 114.6 * (m.size || 0) < 44) continue; }
        else { const q = proj([m.lon + 0.5, m.lat]); if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) < 30) continue; }
      }
      if (m.alpha != null && m.alpha < 1) { ctx.save(); ctx.globalAlpha = m.alpha; drawMarker(ctx, p[0], p[1], m, col, S, placed, hits); ctx.restore(); }   // leaving: fading out
      else drawMarker(ctx, p[0], p[1], m, col, S, placed, hits);
    }
    drawPulses(ctx, S.label.font);
    if (takeSliding()) this.request();
  }

  drawPaper() {
    const { ctx, W, H } = this;
    if (!this.paper) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d'); const img = g.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = Math.random() * 40;
        img.data[i] = 120; img.data[i + 1] = 90; img.data[i + 2] = 50; img.data[i + 3] = n;
      }
      g.putImageData(img, 0, 0);
      this.paper = ctx.createPattern(c, 'repeat');
    }
    ctx.fillStyle = this.paper; ctx.fillRect(0, 0, W, H);
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(90,60,20,0)'); v.addColorStop(1, 'rgba(90,60,20,0.35)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  // Reproject an equirectangular image pixel by pixel (inverse projection). Low resolution while the
  // view is moving, full resolution once it settles.
  // regional terrain shading (relief.js), multiplied over the physical base map; coarse while moving
  drawRelief() {
    const { ctx, W, H } = this;
    const key = [this.relief.only, this.projName, this.view.lon.toFixed(3), this.view.lat.toFixed(3), this.view.k.toFixed(3), this.view.roll || 0, W, H].join();
    const c = this.reliefCache;
    if (!c || c.key !== key || c.stale) {
      const fine = c?.settledKey === key;
      const center = [this.view.lon, this.view.lat];
      const clip = this.azimuthal ? ll => geoDistance(ll, center) <= this.clipRad : null;
      const r = this.relief.render(this.proj, W, H, fine ? 0.75 : 0.3, clip);
      this.reliefCache = { key, r, settledKey: fine ? key : null };
      clearTimeout(this.reliefTimer);
      if (!fine) this.reliefTimer = setTimeout(() => { this.reliefCache.settledKey = key; this.reliefCache.stale = true; this.request(); }, 200);
    }
    const r = this.reliefCache.r;
    const shown = r ? r.regions : [];
    if (shown.join() !== (this.reliefShown || []).join()) { this.reliefShown = shown; this.app.updateReliefCredit?.(shown); }
    if (!r) return;
    ctx.save(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (r.shade) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.75; ctx.drawImage(r.shade, 0, 0, W, H); }
    ctx.restore();
  }
  // distortion hint mask (distortion.js): coarse while moving, finer once the view settles
  drawDistortion() {
    const { ctx, W, H } = this, st = this.app.state;
    const strength = this.app.distortStrength?.(this.projName) ?? 0.55;
    const key = [this.projName, this.view.lon.toFixed(3), this.view.lat.toFixed(3), this.view.k.toFixed(3), this.view.roll || 0, String(this.aspect), W, H].join();
    const c = this.distCache;
    if (!c || c.key !== key || c.strength !== strength || c.stale) {
      const fine = c?.settledKey === key;
      this.distMask ||= new DistortionMask();
      const r = this.distMask.render(this, strength, fine);
      this.distCache = { key, strength, r, settledKey: fine ? key : null };
      clearTimeout(this.distTimer);
      if (!fine) this.distTimer = setTimeout(() => { this.distCache.settledKey = key; this.distCache.stale = true; this.request(); }, 220);
    }
    const r = this.distCache.r; if (!r) return;
    ctx.save(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(r.canvas, -r.step / 2, -r.step / 2, r.canvas.width * r.step, r.canvas.height * r.step);
    ctx.restore();
  }
  setAngle(deg) { this.angle = deg || 0; this.gKey = null; if (!this.proj) return; this.apply(); this.request(); this.app.onViewChange?.(); }
  setRelief(relief) { this.relief = relief; this.reliefCache = null; if (this.proj) this.request(); }
  reliefChanged() { if (this.reliefCache) this.reliefCache.stale = true; if (this.proj) this.request(); }

  drawRaster() {
    const { ctx, proj, W, H } = this;
    const key = [this.projName, this.view.lon.toFixed(3), this.view.lat.toFixed(3), this.view.k.toFixed(3), W, H].join();
    if (this.rasterCache?.key !== key) {
      const fine = this.rasterCache?.settledKey === key;
      const scale = fine ? 1 : 0.35;
      this.rasterCache = { key, canvas: this.reproject(scale), settledKey: null };
      clearTimeout(this.rasterTimer);
      if (!fine) this.rasterTimer = setTimeout(() => { this.rasterCache.settledKey = key; this.rasterCache.key = null; this.request(); }, 180);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.rasterCache.canvas, 0, 0, W, H);
  }

  reproject(scale) {
    const src = this.rasterData ||= (() => {
      const c = document.createElement('canvas'); c.width = this.raster.width; c.height = this.raster.height;
      const g = c.getContext('2d'); g.drawImage(this.raster, 0, 0);
      return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
    })();
    const w = Math.max(1, Math.round(this.W * scale)), h = Math.max(1, Math.round(this.H * scale));
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const g = out.getContext('2d'); const img = g.createImageData(w, h); const o = img.data;
    const inv = this.proj.invert, s = 1 / scale, center = [this.view.lon, this.view.lat];
    const hi = (this.hiresData || []).filter(r => this.view.k >= r.minK);
    const az = this.azimuthal, clipRad = this.clipRad;
    // the exact inverse projection only on a coarse grid; pixels inside a cell are interpolated from its
    // corners when the cell is whole (all corners on the map, no seam), otherwise worked out one by one
    // angular distance test without geoDistance (which streams a line each time): cos of the distance
    const R = Math.PI / 180, sc = Math.sin(center[1] * R), cc = Math.cos(center[1] * R), cosClip = Math.cos(Math.min(Math.PI, clipRad));
    const exact = (x, y) => {
      const ll = inv([x * s, y * s]);
      if (!ll || !isFinite(ll[0]) || !isFinite(ll[1]) || Math.abs(ll[1]) > 90) return null;
      if (az && sc * Math.sin(ll[1] * R) + cc * Math.cos(ll[1] * R) * Math.cos((ll[0] - center[0]) * R) <= cosClip + 1e-6) return null;   // points beyond the disc come back clamped onto its edge
      return ll;
    };
    const put = (oi, lonRaw, lat) => {
      const lon = ((lonRaw + 540) % 360) - 180;
      let S = src, sx, sy;
      for (const r of hi) if (lon >= r.b[0] && lon < r.b[2] && lat >= r.b[1] && lat < r.b[3]) { S = r; break; }
      if (S === src) {
        sx = Math.min(src.w - 1, Math.max(0, Math.floor((lon + 180) / 360 * src.w)));
        sy = Math.min(src.h - 1, Math.max(0, Math.floor((90 - lat) / 180 * src.h)));
      } else {
        sx = Math.min(S.w - 1, Math.floor((lon - S.b[0]) / (S.b[2] - S.b[0]) * S.w));
        sy = Math.min(S.h - 1, Math.floor((S.b[3] - lat) / (S.b[3] - S.b[1]) * S.h));
      }
      const si = (sy * S.w + sx) * 4;
      o[oi] = S.d[si]; o[oi + 1] = S.d[si + 1]; o[oi + 2] = S.d[si + 2]; o[oi + 3] = 255;
    };
    const G = 6, gw = Math.ceil(w / G) + 1, gh = Math.ceil(h / G) + 1;
    const gl = new Float64Array(gw * gh * 2), gok = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const ll = exact(gx * G, gy * G), k = gy * gw + gx;
      if (ll) { gok[k] = 1; gl[k * 2] = ll[0]; gl[k * 2 + 1] = ll[1]; }
    }
    for (let gy = 0; gy < gh - 1; gy++) for (let gx = 0; gx < gw - 1; gx++) {
      const a = gy * gw + gx, b = a + 1, c = a + gw, d = c + 1;
      const x0 = gx * G, y0 = gy * G, x1 = Math.min(w, x0 + G), y1 = Math.min(h, y0 + G);
      if (x0 >= w || y0 >= h) continue;
      let whole = gok[a] && gok[b] && gok[c] && gok[d];
      if (whole) {
        const l0 = gl[a * 2], l1 = gl[b * 2], l2 = gl[c * 2], l3 = gl[d * 2];
        const t0 = gl[a * 2 + 1], t1 = gl[b * 2 + 1], t2 = gl[c * 2 + 1], t3 = gl[d * 2 + 1];
        // a seam (the antimeridian) or a pole inside the cell: no interpolation there
        whole = Math.max(l0, l1, l2, l3) - Math.min(l0, l1, l2, l3) < 30 && Math.max(Math.abs(t0), Math.abs(t1), Math.abs(t2), Math.abs(t3)) < 88;
        if (whole) {
          for (let y = y0; y < y1; y++) {
            const v = (y - y0) / G;
            const la = l0 + (l2 - l0) * v, lb = l1 + (l3 - l1) * v, ta = t0 + (t2 - t0) * v, tb = t1 + (t3 - t1) * v;
            for (let x = x0; x < x1; x++) { const u = (x - x0) / G; put((y * w + x) * 4, la + (lb - la) * u, ta + (tb - ta) * u); }
          }
          continue;
        }
      }
      if (!gok[a] && !gok[b] && !gok[c] && !gok[d]) {
        // off the map, unless the edge of the map could cut into the cell from a neighbouring grid point
        let near = false;
        for (let yy = Math.max(0, gy - 1); yy <= Math.min(gh - 1, gy + 2) && !near; yy++) for (let xx = Math.max(0, gx - 1); xx <= Math.min(gw - 1, gx + 2); xx++) if (gok[yy * gw + xx]) { near = true; break; }
        if (!near) continue;
      }
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const ll = exact(x, y); if (ll) put((y * w + x) * 4, ll[0], ll[1]); }
    }
    g.putImageData(img, 0, 0);
    return out;
  }

  drawLabels(feats, S, F) {
    const { ctx, proj, W, H } = this;
    const st = this.app.state, center = [this.view.lon, this.view.lat];
    const lim = Math.min(this.clipRad, 2.6) - 0.05;
    if (F?.labelOk) feats = feats.filter(f => F.labelOk(f.properties.p));
    const items = labelItems(feats, st, proj.scale(), Math.min(34, W / 18),
      lp => (this.azimuthal && geoDistance(lp, center) > lim) ? null : proj(lp), F?.adminFeats, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    placeLabels(ctx, items, W, H, S.label);
  }

  // a pinned country's borders, kept from the year it was pinned (dashed, over the later map)
  drawPinned(feats) {
    const { ctx } = this;
    ctx.save();
    this.each(ctx, a => {
      for (const f of feats) {
        const p = this.P2(f);
        ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4.5 / a; ctx.stroke(p);
        ctx.setLineDash([7 / a, 4 / a]); ctx.strokeStyle = '#c2185b'; ctx.lineWidth = 2.2 / a; ctx.stroke(p);
      }
    });
    ctx.restore();
  }
  drawSelection(feats, id) {
    const { ctx } = this;
    ctx.save();
    this.each(ctx, a => {
      for (const f of feats) if (f.properties.p === id) {
        const p = this.P2(f);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5 / a; ctx.stroke(p);
        ctx.strokeStyle = '#d12'; ctx.lineWidth = 1.6 / a; ctx.stroke(p);
      }
    });
    ctx.restore();
  }

  getCenter() { return { lon: this.view.lon, lat: this.view.lat, k: this.view.k, roll: this.view.roll || 0 }; }
  // phones held upright: a whole-world view is zoomed so the map fills the height instead of a thin band
  fillK() {
    if (this.W >= 860 || this.H <= this.W || this.azimuthal) return 1;
    const p = this.proj, r0 = p.rotate(), s0 = p.scale(), t0 = p.translate(), a0 = p.angle();
    p.angle(0).rotate([0, 0, 0]).scale(this.baseScale).translate([0, 0]);
    const [[, y0], [, y1]] = geoPath(p).bounds(this.outline || SPHERE);
    p.rotate(r0).scale(s0).translate(t0).angle(a0);
    const h = y1 - y0;
    return h > 0 && h < this.H * 0.85 ? Math.min(4, this.H / h) : 1;
  }
  setCenter({ lon, lat, k, roll }) {
    this.aspect = null; this.off = null;
    if (k <= 1.01) k = Math.max(k, this.fillK());
    // a whole-world view keeps the normal aspect when switching into an oblique-capable projection
    if (this.oblique && k < 1.5 && roll == null) lat = 0;
    Object.assign(this.view, { lon, lat, k, roll: roll || 0 }); this.apply(); this.request();
  }
}
