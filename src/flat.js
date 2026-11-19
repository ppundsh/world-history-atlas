// Flat-map renderer: d3-geo projections drawn on a Canvas, with Google-Maps-style navigation
// (drag to pan, wheel/pinch to zoom at the cursor, double-click to zoom in, arrow keys, +/-).
import { geoPath, geoGraticule, geoGraticule10, geoContains, geoDistance } from 'd3-geo';
import { PROJ } from './projections.js';
import { store, P } from './data.js';
import { frame, region, REGIONS } from './modes.js';
export const ROC_COLOR = '#ffb000';
import { BASEMAPS } from './styles.js';
import { labelItems, placeLabels, hatchPattern } from './labels.js';
import { planTransition, idsAt, fillMasks, ease, decodeIds } from './transition.js';

const SPHERE = { type: 'Sphere' };
const GRAT = geoGraticule10();
const MAX_K = 60;

// ★ at the government seat; the name is nudged down to avoid other names, and dropped if it can't fit
export function drawMarker(ctx, x, y, m, col, S, placed) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `20px ${S.label.font}`; ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
  ctx.strokeText('★', x - 9, y); ctx.fillStyle = m.roc ? '#1e40af' : m.color; ctx.fillText('★', x - 9, y);
  const text = m.text[col] || m.text[0];
  ctx.font = `${m.roc ? 700 : 500} 12px ${S.label.font}`;
  const w = ctx.measureText(text).width;
  let ty = y;
  const hit = yy => placed.some(b => b[0] < x + 11 + w && b[2] > x + 11 && b[1] < yy + 7 && b[3] > yy - 7);
  while (hit(ty) && ty - y < 45) ty += 14;
  if (hit(ty)) return;
  placed.push([x + 11, ty - 7, x + 11 + w, ty + 7]);
  if (ty !== y) { ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 10, ty); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; }
  ctx.strokeText(text, x + 11, ty); ctx.fillStyle = m.roc ? '#0b2a7a' : '#222'; ctx.fillText(text, x + 11, ty);
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
  get rotating() { return this.azimuthal || this.oblique; }
  // lock / unlock free movement; locking straightens the map again (north up, normal aspect) but keeps the longitude
  setFree(on) {
    this.free = !!on;
    if (!on) { this.view.roll = 0; this.gKey = null; }
    this.apply(); this.request(); this.app.onViewChange?.();
  }
  get clipRad() { return (this.def.clip || 180) * Math.PI / 180; }

  setProjection(name) {
    this.projName = name;
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
    // cylinders with a tall band (Mercator, central cylindrical) are sized by width, like Google Maps
    if (this.def.lat && this.def.surface === 'cylindrical') this.baseScale = this.W / (2 * Math.PI);
    this.apply();
  }

  apply() {
    const p = this.proj, v = this.view;
    v.k = Math.max(1, Math.min(MAX_K, v.k));
    v.lon = ((v.lon + 540) % 360) - 180;
    if (this.rotating) {
      v.lat = Math.max(-90, Math.min(90, v.lat));
      p.rotate([-v.lon, -v.lat, v.roll || 0]).scale(this.baseScale * v.k).translate([this.W / 2, this.H / 2]);
      return;
    }
    p.rotate([-v.lon, 0]).scale(this.baseScale * v.k).translate([0, 0]);
    // keep the map from scrolling past its top/bottom edge, like Google Maps
    const [[, top], [, bot]] = geoPath(p).bounds(this.outline);
    let cy = p([v.lon, v.lat])[1];
    const half = this.H / 2;
    if (bot - top <= this.H) cy = (top + bot) / 2;
    else cy = Math.max(top + half, Math.min(bot - half, cy));
    p.translate([this.W / 2, half - cy]);
    const inv = p.invert([this.W / 2, half]);
    if (inv) v.lat = inv[1];
  }

  // ---- navigation ------------------------------------------------------------------------------
  panBy(dx, dy, roll = false) {
    const p = this.proj, v = this.view;
    if (roll && this.rotating) {
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
    const p = this.proj, v = this.view;
    const before = p.invert([mx, my]);
    const k0 = v.k;
    v.k = Math.max(1, Math.min(MAX_K, v.k * factor));
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

  reset() { this.view = { lon: 60, lat: this.oblique ? 0 : 25, k: 1, roll: 0 }; this.apply(); this.request(); this.app.onViewChange?.(); }
  // back to the normal aspect: north up, and (for oblique-capable maps) the equator straight
  northUp() { this.view.roll = 0; if (this.oblique && this.view.k < 1.5) this.view.lat = 0; this.apply(); this.request(); this.app.onViewChange?.(); }

  bindEvents() {
    const c = this.canvas;
    c.tabIndex = 0;
    let moved = 0, last = null, pinch = null;
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      moved = 0; last = [e.offsetX, e.offsetY];
      if (this.pointers.size === 2) pinch = this.pinchState();
      c.classList.add('grabbing');
    });
    c.addEventListener('pointermove', e => {
      if (!this.pointers.has(e.pointerId)) { this.app.onHover?.(this.hit(e.offsetX, e.offsetY), e); return; }
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
    return f ? { polity: f.properties.p, sec: f.properties.s, prov: f.properties.prov } : null;
  }

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
    const cyl = this.def.surface === 'cylindrical' && !this.rotating;
    const rot = cyl ? [0, 0, 0] : this.proj.rotate();
    const key = [this.projName, r, cyl ? '' : rot.map(v => v.toFixed(5)).join()].join('|');
    if (this.gKey === key) return;
    // while dragging a projection whose shape changes with the view, use coarse land to stay fluid
    this.coarse = !cyl && !!this.moving && !!this.gKey && this.gKey.split('|')[0] === this.projName;
    this.gKey = key; this.cyl = cyl; this.refScale = r;
    const p = this.def.make(); if (this.def.clip) p.clipAngle(this.def.clip);
    p.rotate(rot).scale(r).translate([0, 0]);
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

  layer(name) {
    const c = (this.layers ||= {})[name] ||= document.createElement('canvas');
    if (c.width !== this.canvas.width || c.height !== this.canvas.height) { c.width = this.canvas.width; c.height = this.canvas.height; }
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
    });
  }

  // owner raster on the transition grid
  idRaster(feats, w, h, cell) {
    const c = this.idCanvas ||= document.createElement('canvas');
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d', { willReadFrequently: true });
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    this.each(g, () => {
      for (const f of feats) {
        const v = f.properties.p + 1;
        g.fillStyle = `rgb(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255})`;
        g.fill(this.P2(f));
      }
    }, 1 / cell);
    return decodeIds(g.getImageData(0, 0, w, h).data, w, h, new Set(feats.map(f => f.properties.p)));
  }

  // start / continue a territory transition when the set of polities changed under a still view
  updateTransition(feats, F, fillB) {
    const st = this.app.state, now = performance.now();
    const fkey = feats.map(f => f.properties.p).join();
    const vkey = this.viewKey();
    const cell = 3, w = Math.ceil(this.W / cell), h = Math.ceil(this.H / cell);
    const T = this.trans;
    const sameView = this.lastVKey === vkey;
    const changed = this.lastFKey != null && fkey !== this.lastFKey;
    this.lastVKey = vkey;
    if (!sameView || !st.animate) { this.trans = null; this.lastIds = null; }
    if (changed && sameView && st.animate) {
      const idB = this.idRaster(feats, w, h, cell);
      let idA = this.lastIds;
      if (T && T.plan) idA = idsAt(T.plan, ease(Math.min(1, (now - T.t0) / T.dur)));
      if (idA && idA.length === idB.length) {
        const mode = st.transition === 'jump' ? 'jump' : 'grow';
        const plan = planTransition(w, h, idA, idB, mode);
        if (plan) {
          const layerA = this.layer(T ? 'swap' : 'A');
          const g = layerA.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, layerA.width, layerA.height);
          g.drawImage(this.layers.shown || fillB, 0, 0);
          if (T) { this.layers.swap = this.layers.A; this.layers.A = layerA; }
          const mk = () => new ImageData(w, h);
          this.trans = { plan, t0: now, dur: mode === 'jump' ? 750 : st.playing ? Math.max(220, Math.min(450, 450 / st.speed)) : 400,
            layerA: this.layers.A, maskA: mk(), maskB: mk(), cell, w, h, prevFeats: this.lastFeatsDrawn, init: true };
        }
      }
      this.lastIds = idB;
    } else if (!this.lastIds || this.lastIds.length !== w * h || !sameView) {
      this.lastIds = st.animate ? this.idRaster(feats, w, h, cell) : null;
    }
    this.lastFKey = fkey;
  }

  // composite the fill layer(s) for this frame into `shown`; returns transition progress or null
  composite(fillB) {
    const T = this.trans, shown = this.layer('shown'), g = shown.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, shown.width, shown.height);
    if (!T) { g.drawImage(fillB, 0, 0); return null; }
    const t = Math.min(1, (performance.now() - T.t0) / T.dur), e = ease(t);
    if (t >= 1) { this.trans = null; g.drawImage(fillB, 0, 0); return null; }
    fillMasks(T.plan, e, T.maskA, T.maskB, T.init); T.init = false;
    const m = this.maskCanvas ||= document.createElement('canvas');
    if (m.width !== T.w || m.height !== T.h) { m.width = T.w; m.height = T.h; }
    const mg = m.getContext('2d');
    const tmp = this.layer('tmp'), tg = tmp.getContext('2d');
    g.imageSmoothingEnabled = tg.imageSmoothingEnabled = true;
    for (const [src, mask] of [[T.layerA, T.maskA], [fillB, T.maskB]]) {
      mg.putImageData(mask, 0, 0);
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over';
      tg.clearRect(0, 0, tmp.width, tmp.height); tg.drawImage(src, 0, 0);
      tg.globalCompositeOperation = 'destination-in';
      tg.drawImage(m, 0, 0, T.w * T.cell * this.dpr, T.h * T.cell * this.dpr);
      tg.globalCompositeOperation = 'source-over';
      g.drawImage(tmp, 0, 0);
    }
    this.request();                                  // keep animating
    return e;
  }

  draw() {
    const { ctx, proj, W, H, dpr } = this;
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
      if (st.basemap === 'physical' && this.relief) this.drawRelief();
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
        ctx.globalAlpha = 0.55; ctx.fillStyle = '#d9d4c7';
        for (const f of F.context) ctx.fill(this.P2(f));
        ctx.strokeStyle = 'rgba(80,80,80,0.5)'; ctx.lineWidth = lw(0.5, a);
        for (const f of F.context) ctx.stroke(this.P2(f));
        ctx.globalAlpha = 1; ctx.restore();
      });
    }
    const fillB = this.layer('B');
    this.drawFills(fillB.getContext('2d'), feats, F);
    this.updateTransition(feats, F, fillB);
    const prog = this.composite(fillB);
    const alpha = Math.min(1, S.polityAlpha * st.density / 0.85);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha; ctx.drawImage(this.layers.shown, 0, 0); ctx.globalAlpha = 1;
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
      // Taiwan with both layers: administrative boundaries over the control areas
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
      if (st.modern && store.modern) {
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

    if (st.labels) this.drawLabels(feats, S, F);
    if (st.selected != null) this.drawSelection(feats, st.selected);
    this.drawMarkers(F, S);
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
    const placed = [];
    for (const m of F.markers) {
      if (!visible([m.lon, m.lat])) continue;
      const p = proj([m.lon, m.lat]); if (!p) continue;
      drawMarker(ctx, p[0], p[1], m, col, S, placed);
    }
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
    const key = [this.projName, this.view.lon.toFixed(3), this.view.lat.toFixed(3), this.view.k.toFixed(3), this.view.roll || 0, W, H].join();
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
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.75; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(r.canvas, 0, 0, W, H);
    ctx.restore();
  }
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
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ll = inv([x * s, y * s]);
        if (!ll || !isFinite(ll[0]) || Math.abs(ll[1]) > 90) continue;
        if (this.azimuthal && geoDistance(ll, center) > this.clipRad) continue;
        let S = src, sx, sy;
        const lon = ((ll[0] + 540) % 360) - 180;
        for (const r of hi) if (lon >= r.b[0] && lon < r.b[2] && ll[1] >= r.b[1] && ll[1] < r.b[3]) { S = r; break; }
        if (S === src) {
          sx = Math.min(src.w - 1, Math.max(0, Math.floor((lon + 180) / 360 * src.w)));
          sy = Math.min(src.h - 1, Math.max(0, Math.floor((90 - ll[1]) / 180 * src.h)));
        } else {
          sx = Math.min(S.w - 1, Math.floor((lon - S.b[0]) / (S.b[2] - S.b[0]) * S.w));
          sy = Math.min(S.h - 1, Math.floor((S.b[3] - ll[1]) / (S.b[3] - S.b[1]) * S.h));
        }
        const si = (sy * S.w + sx) * 4, oi = (y * w + x) * 4;
        o[oi] = S.d[si]; o[oi + 1] = S.d[si + 1]; o[oi + 2] = S.d[si + 2]; o[oi + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return out;
  }

  drawLabels(feats, S, F) {
    const { ctx, proj, W, H } = this;
    const st = this.app.state, center = [this.view.lon, this.view.lat];
    const lim = Math.min(this.clipRad, 2.6) - 0.05;
    const items = labelItems(feats, st, proj.scale(), Math.min(34, W / 18),
      lp => (this.azimuthal && geoDistance(lp, center) > lim) ? null : proj(lp), F?.adminFeats);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    placeLabels(ctx, items, W, H, S.label);
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
  setCenter({ lon, lat, k, roll }) {
    // a whole-world view keeps the normal aspect when switching into an oblique-capable projection
    if (this.oblique && k < 1.5 && roll == null) lat = 0;
    Object.assign(this.view, { lon, lat, k, roll: roll || 0 }); this.apply(); this.request();
  }
}
