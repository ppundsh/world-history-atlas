import { drawLang, pathFromProject, lineAt } from './langlayer.js';
import { drawPulses, reservePulses, pulseAt } from './eventdots.js';
import { takeSliding } from './flat.js';
import { reliefFor } from './relief.js';
// 3D globe: MapLibre GL JS in globe projection. Every source is local (GeoJSON built from our own
// data, optional raster tiles under /basemap); no tile server, no remote style, no remote glyphs —
// labels are drawn on a 2D canvas overlay with system fonts.
import { Map as MlMap, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { geoDistance, geoBounds, geoMercator, geoPath } from 'd3-geo';
import { store, P, loadPhysical, chunkFor } from './data.js';
import { planTransition, ease, decodeIds, pieceKey, idColor, readbackOk } from './transition.js';
import { frame, region as reg, REGIONS } from './modes.js';
import { drawMarker, cardUnder, dragCard } from './flat.js';
import { BASEMAPS } from './styles.js';
import { labelItems, placeLabels } from './labels.js';

setWorkerUrl(workerUrl);
const EMPTY = { type: 'FeatureCollection', features: [] };
export const ROC_COLOR = '#ffb000';           // outline of territory held by a government claiming to be the ROC
// Visibility and colour are feature-state (paint-only, no re-tiling), so changing the year never makes
// the map blink: `on` = alive this year, `hide` = still growing in a transition.
const ON = a => ['case', ['boolean', ['feature-state', 'on'], false], a, 0];
const SHOWN = a => ['case', ['all', ['boolean', ['feature-state', 'on'], false], ['!', ['boolean', ['feature-state', 'hide'], false]]], a, 0];
// MapLibre zoom at which the whole globe fills ~85% of the shorter side (k = 1 on the flat map)
const fitZoom = el => { const r = el.getBoundingClientRect(); return Math.log2(Math.max(200, Math.min(r.width, r.height)) * 0.85 * Math.PI / 512); };

export class GlobeMap {
  constructor(container, overlay, app) {
    this.app = app;
    this.container = container;
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
    this.ready = false;
    this.lastKey = '';
  }

  async init(center) {
    const S = BASEMAPS[this.app.state.basemap];
    this.map = new MlMap({
      container: this.container,
      style: this.style(S),
      center: [center.lon, center.lat],
      zoom: fitZoom(this.container) + Math.log2(center.k || 1),
      attributionControl: false,
      maxPitch: 70,
      renderWorldCopies: false,
      fadeDuration: 0,
      canvasContextAttributes: { preserveDrawingBuffer: true },   // lets screenshots and recordings read the globe
    });
    await new Promise(r => this.map.once('load', r));
    this.map.addImage('hatch', hatchImage());
    this.ready = true;
    this.map.on('render', () => this.drawOverlay());
    this.map.on('move', () => this.app.onViewChange?.());
    // floating Taiwan: drag it instead of the globe
    // picture cards: drag them instead of the globe
    this.map.on('mousedown', e => {
      const card = cardUnder(this.markerHits, e.point.x, e.point.y); if (!card) return;
      this.cardDrag = { ...card, gx: e.point.x - card.x0, gy: e.point.y - card.y0, sx: e.point.x, sy: e.point.y, moved: 0 }; this.map.dragPan.disable();
    });
    this.map.on('mousemove', e => {
      const d = this.cardDrag; if (!d) return;
      d.moved = Math.max(d.moved, Math.abs(e.point.x - d.sx) + Math.abs(e.point.y - d.sy));
      if (d.moved >= 4) { dragCard(d, e.point.x, e.point.y); this.map.triggerRepaint(); }
    });
    this.map.on('mouseup', () => { const d = this.cardDrag; if (!d) return; this.cardDrag = null; this.map.dragPan.enable(); if (d.moved >= 4) { this.cmpJustDragged = true; setTimeout(() => { this.cmpJustDragged = false; }, 50); } });
    this.map.on('mousedown', e => {
      const cmp = this.app.compare, ll = [e.lngLat.lng, e.lngLat.lat];
      if (!cmp?.contains(ll)) return;
      this.cmpDrag = { grab: ll, c0: [...cmp.center] }; this.map.dragPan.disable();
    });
    this.map.on('mousemove', e => {
      if (!this.cmpDrag) return;
      const d = this.cmpDrag, cmp = this.app.compare;
      cmp.center = [d.c0[0] + e.lngLat.lng - d.grab[0], Math.max(-80, Math.min(80, d.c0[1] + e.lngLat.lat - d.grab[1]))];
      this.map.triggerRepaint();
    });
    this.map.on('mouseup', () => { if (this.cmpDrag) { this.cmpDrag = null; this.map.dragPan.enable(); this.cmpJustDragged = true; setTimeout(() => { this.cmpJustDragged = false; }, 50); } });
    this.map.on('click', e => { if (this.cmpJustDragged) return; this.app.onSelect?.(this.hit(e.point), e.originalEvent); });
    this.map.on('mousemove', e => this.app.onHover?.(this.hit(e.point), e.originalEvent));
    new ResizeObserver(() => this.resizeOverlay()).observe(this.container);
    this.resizeOverlay();
    this.update(true);
    this.applyBasemap();
  }

  style(S) {
    return {
      version: 8,
      projection: { type: 'globe' },
      sky: { 'sky-color': '#0b1830', 'horizon-color': '#4b6c9c', 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
      sources: {
        land: { type: 'geojson', data: store.base.land },
        lakes: { type: 'geojson', data: store.base.lakes },
        rivers: { type: 'geojson', data: store.base.rivers },
        polities: { type: 'geojson', data: EMPTY, promoteId: 'k' },
        polities2: { type: 'geojson', data: EMPTY, promoteId: 'k' },
        stripes: { type: 'geojson', data: EMPTY },
        pinned: { type: 'geojson', data: EMPTY },
        roc: { type: 'geojson', data: EMPTY },
        rborder: { type: 'geojson', data: EMPTY },
        aborder: { type: 'geojson', data: EMPTY },
        ribbon: { type: 'geojson', data: EMPTY },
        context: { type: 'geojson', data: EMPTY, promoteId: 'k' },
        overlay: { type: 'geojson', data: EMPTY },
        disputed: { type: 'geojson', data: EMPTY },
        bathy: { type: 'geojson', data: EMPTY },
        regions: { type: 'geojson', data: EMPTY },
        ice: { type: 'geojson', data: EMPTY },
        modern: { type: 'geojson', data: EMPTY },
        rivers10: { type: 'geojson', data: EMPTY },
        lakes10: { type: 'geojson', data: EMPTY },
        riversLocal: { type: 'geojson', data: EMPTY },
        ...(this.app.satTiles ? { sat: { type: 'raster', tiles: [this.app.satTiles], tileSize: 256, maxzoom: this.app.satMaxZoom ?? 5 } } : {}),
        ...Object.fromEntries((this.app.satRegions || []).map(r => ['sat-' + r.id, { type: 'raster', tiles: [r.tiles], tileSize: 256, bounds: r.bounds, minzoom: r.minzoom, maxzoom: r.maxzoom }])),
        ...Object.fromEntries((this.app.reliefRegions || []).map(r => ['relief-' + r.id, { type: 'raster', tiles: [r.tiles], tileSize: 256, bounds: r.bounds, minzoom: r.minzoom, maxzoom: r.maxzoom }])),
      },
      layers: [
        { id: 'ocean', type: 'background', paint: { 'background-color': S.ocean } },
        ...(this.app.satTiles ? [{ id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } }] : []),
        ...(this.app.satRegions || []).map(r => ({ id: 'sat-' + r.id, type: 'raster', source: 'sat-' + r.id, minzoom: r.minzoom - 0.5, layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } })),
        { id: 'bathy', type: 'fill', source: 'bathy', paint: { 'fill-color': ['match', ['to-string', ['get', 'depth']], '200', '#93c0e0', '2000', '#78acd6', '4000', '#5f97c8', '6000', '#4a82b8', S.ocean] } },
        { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': S.land } },
        { id: 'regions', type: 'fill', source: 'regions', paint: { 'fill-color': ['match', ['get', 'k'], 'Desert', '#eadba6', 'Range/mtn', '#cbb994', 'Plateau', '#d8cba8', 'Tundra', '#dfe3d8', S.land] } },
        { id: 'ice', type: 'fill', source: 'ice', paint: { 'fill-color': '#f6f9fc' } },
        ...(this.app.reliefRegions || []).map(r => ({ id: 'relief-' + r.id, type: 'raster', source: 'relief-' + r.id, minzoom: Math.max(0, r.minzoom - 1), layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.45, 'raster-fade-duration': 0 } })),
        { id: 'context-fill', type: 'fill', source: 'context', paint: { 'fill-color': '#d9d4c7', 'fill-opacity': ON(0.45) } },
        { id: 'context-line', type: 'line', source: 'context', paint: { 'line-color': 'rgba(80,80,80,0.5)', 'line-width': 0.5, 'line-opacity': 0 } },
        ...['', '2'].map(x => ({ id: 'polity-fill' + x, type: 'fill', source: 'polities' + x, paint: { 'fill-color': ['coalesce', ['feature-state', 'c'], ['get', 'c']], 'fill-opacity': SHOWN(S.polityAlpha) } })),
        { id: 'polity-stripe', type: 'fill', source: 'stripes', paint: { 'fill-pattern': ['concat', 'stripe-', ['get', 'sc']], 'fill-opacity': S.polityAlpha } },
        { id: 'overlay-fill', type: 'fill', source: 'overlay', paint: { 'fill-color': '#d32f2f', 'fill-opacity': 0.35 } },
        { id: 'overlay-line', type: 'line', source: 'overlay', paint: { 'line-color': '#b71c1c', 'line-width': 1.4, 'line-dasharray': [3, 2] } },
        { id: 'disputed-owner', type: 'fill', source: 'disputed', filter: ['has', 'c'], paint: { 'fill-color': ['get', 'c'], 'fill-opacity': S.polityAlpha } },
        { id: 'disputed-hatch', type: 'fill', source: 'disputed', paint: { 'fill-pattern': 'hatch' } },
        { id: 'disputed-line', type: 'line', source: 'disputed', paint: { 'line-color': 'rgba(20,20,20,0.85)', 'line-width': 1, 'line-dasharray': [3, 2] } },
        ...['', '2'].map(x => ({ id: 'polity-line' + x, type: 'line', source: 'polities' + x, paint: { 'line-color': S.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1.6], 'line-opacity': SHOWN(1) } })),
        ...['', '2'].map(x => ({ id: 'selected' + x, type: 'line', source: 'polities' + x, paint: { 'line-color': '#d12', 'line-width': 2.2, 'line-opacity': ['case', ['all', ['boolean', ['feature-state', 'on'], false], ['boolean', ['feature-state', 'sel'], false]], 1, 0] } })),
        // a pinned country's borders, kept from the year it was pinned
        { id: 'pinned-case', type: 'line', source: 'pinned', paint: { 'line-color': 'rgba(255,255,255,0.9)', 'line-width': 4.5 } },
        { id: 'pinned', type: 'line', source: 'pinned', paint: { 'line-color': '#c2185b', 'line-width': 2.2, 'line-dasharray': [3, 1.6] } },
        { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': S.lake } },
        { id: 'lakes10', type: 'fill', source: 'lakes10', minzoom: 4, paint: { 'fill-color': S.lake } },
        { id: 'rivers', type: 'line', source: 'rivers', maxzoom: 4, paint: { 'line-color': S.river, 'line-width': 0.8 } },
        { id: 'rivers10-case', type: 'line', source: 'rivers10', minzoom: 4, paint: { 'line-color': 'rgba(255,255,255,0.7)', 'line-width': 2.8 } },
        { id: 'riversLocal-case', type: 'line', source: 'riversLocal', minzoom: 4, paint: { 'line-color': 'rgba(255,255,255,0.7)', 'line-width': 2.8 } },
        { id: 'rivers10', type: 'line', source: 'rivers10', minzoom: 4, paint: { 'line-color': 'rgba(30,100,190,0.95)', 'line-width': 1.3 } },
        { id: 'riversLocal', type: 'line', source: 'riversLocal', minzoom: 4, paint: { 'line-color': 'rgba(30,100,190,0.95)', 'line-width': 1.3 } },
        { id: 'modern', type: 'line', source: 'modern', layout: { visibility: 'none' }, paint: { 'line-color': S.modern || 'rgba(120,0,90,0.85)', 'line-width': 0.9, 'line-dasharray': [4, 2] } },
        { id: 'rborder', type: 'line', source: 'rborder', paint: { 'line-color': S.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 1.6] } },
        { id: 'ribbon', type: 'line', source: 'ribbon', paint: { 'line-color': ['get', 'c'], 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 3, 7, 9] } },
        { id: 'aborder', type: 'line', source: 'aborder', paint: { 'line-color': 'rgba(40,40,70,0.85)', 'line-dasharray': [3, 2], 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 6, 1.5] } },
        { id: 'roc-case', type: 'line', source: 'roc', paint: { 'line-color': 'rgba(255,255,255,0.85)', 'line-width': 4.2 } },
        { id: 'roc-line', type: 'line', source: 'roc', paint: { 'line-color': ROC_COLOR, 'line-width': 2.4 } },
      ],
    };
  }

  resizeOverlay() {
    const r = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    this.overlay.width = Math.round(r.width * dpr); this.overlay.height = Math.round(r.height * dpr);
    this.overlay.style.width = r.width + 'px'; this.overlay.style.height = r.height + 'px';
    this.map?.resize();
    this.map?.triggerRepaint();
  }

  // The era chunk (world, religion) or the unit map (regional modes) is uploaded once; each frame only
  // updates feature-state for what changed.
  update(force = false) {
    if (!this.ready) return;
    const st = this.app.state;
    const F = frame(st);
    this.F = F;
    const feats = F.feats;
    if (!feats.length && !REGIONS.includes(st.mode)) return;
    const regional = REGIONS.includes(st.mode);
    const m = this.map;
    const prev = this.feats;
    this.feats = feats;
    // 1) geometry, uploaded only when the chunk / region changes
    const base = regional ? reg(st) : store.chunks.get(chunkFor(st.year).id);
    // a new era chunk goes into the other of two sources; the old one stays on screen until the new
    // geometry is ready, so switching eras doesn't blink either
    this.src ||= 'polities';
    if (force || base !== this.base) {
      this.base = base;
      const old = this.src, src = this.src = old === 'polities' ? 'polities2' : 'polities';
      this.endTransition();
      m.removeFeatureState({ source: src });
      this.state = new Map();
      const swap = e => {
        if (e.sourceId !== src || !e.isSourceLoaded || this.src !== src) return;
        m.off('sourcedata', swap);
        // re-apply this era's state (set while the tiles were still loading), let it render, then retire the old one
        for (const [k, w] of this.state) m.setFeatureState({ source: src, id: k }, w);
        m.triggerRepaint();
        m.once('idle', () => { if (this.src === src) m.removeFeatureState({ source: old }); });
      };
      if (this.oldSwap) m.off('sourcedata', this.oldSwap);
      this.oldSwap = swap;
      m.on('sourcedata', swap);
      if (regional) {
        m.getSource(src).setData({ type: 'FeatureCollection', features: base.units.map(u => ({ type: 'Feature', geometry: u.geometry, properties: { k: u.properties.id, c: '#cccccc' } })) });
      } else {
        base.forEach((f, i) => { f.properties.fi ??= i; });
        m.getSource(src).setData({ type: 'FeatureCollection', features: base.map(f => ({ type: 'Feature', geometry: f.geometry, properties: { k: f.properties.fi, p: f.properties.p, c: P.color(f.properties.p) } })) });
      }
      this.stripeKey = null;
    }
    // 2) per-feature state: alive, colour, ROC outline, selection
    const want = new Map();
    for (const f of regional ? (F.fillUnits || F.units) : feats) {
      const k = regional ? f.properties.prov.id : f.properties.fi;
      want.set(k, { on: true, c: F.color(f.properties.p), sel: st.selected != null && f.properties.p === st.selected });
    }
    for (const [k, old] of this.state) if (!want.has(k) && old.on) { m.setFeatureState({ source: this.src, id: k }, { on: false, sel: false }); this.state.set(k, { on: false }); }
    for (const [k, w] of want) {
      const old = this.state.get(k) || {};
      if (old.on !== w.on || old.c !== w.c || old.sel !== w.sel) { m.setFeatureState({ source: this.src, id: k }, w); this.state.set(k, w); }
    }
    // the pinned country's borders (from the year it was pinned)
    const pin = this.app.pin, pk = pin ? pin.key : '';
    if (pk !== this.pinKey) { this.pinKey = pk; m.getSource('pinned').setData({ type: 'FeatureCollection', features: pin ? pin.feats.map(f => ({ type: 'Feature', geometry: f.geometry, properties: {} })) : [] }); }
    // stripes (secondary controller) — a small separate layer, re-uploaded only when it changes
    const striped = feats.filter(f => f.properties.s != null);
    const sKey = striped.map(f => (f.properties.prov?.id ?? f.properties.fi) + ':' + f.properties.s).join();
    if (sKey !== this.stripeKey) {
      this.stripeKey = sKey;
      m.getSource('stripes').setData({ type: 'FeatureCollection', features: striped.map(f => ({ type: 'Feature', geometry: f.geometry, properties: { sc: this.stripe(F.color(f.properties.s)) } })) });
    }
    // regional modes: the rest of the world in grey (same feature-state approach), CCP areas
    const ctxChunk = regional ? store.chunks.get(chunkFor(st.year).id) : null;
    if (ctxChunk !== this.ctxChunk) {
      this.ctxChunk = ctxChunk; m.removeFeatureState({ source: 'context' }); this.ctxOn = new Set();
      ctxChunk?.forEach((f, i) => { f.properties.fi ??= i; });
      m.getSource('context').setData(ctxChunk ? { type: 'FeatureCollection', features: ctxChunk.map(f => ({ type: 'Feature', geometry: f.geometry, properties: { k: f.properties.fi } })) } : EMPTY);
    }
    if (ctxChunk) {
      const on = new Set((F.context || []).map(f => f.properties.fi));
      for (const k of this.ctxOn) if (!on.has(k)) m.setFeatureState({ source: 'context', id: k }, { on: false });
      for (const k of on) if (!this.ctxOn.has(k)) m.setFeatureState({ source: 'context', id: k }, { on: true });
      this.ctxOn = on;
    }
    const oKey = F.overlays.map(o => o.properties.name?.[0]).join();
    if (oKey !== this.overlayKey) { this.overlayKey = oKey; m.getSource('overlay').setData({ type: 'FeatureCollection', features: F.overlays }); }

    if (prev && prev !== feats && st.animate && !force) this.startTransition(prev, feats, F);
    const disp = F.disputed ? store.disputed.filter(d => d.properties.a <= st.year && st.year <= d.properties.b) : [];
    const dkey = st.mode + '|' + st.pov + '|' + disp.map(d => d.properties.name).join(',');
    if (force || dkey !== this.lastDKey) {
      this.lastDKey = dkey;
      m.getSource('disputed').setData({
        type: 'FeatureCollection',
        features: disp.map(d => {
          const owner = st.pov === 'defacto' ? null : d.properties.pov?.[st.pov];
          return { type: 'Feature', geometry: d.geometry, properties: owner == null ? { name: d.properties.name } : { name: d.properties.name, c: F.color(owner) } };
        }),
      });
    }
    if (st.modern && store.modern && !this.modernSet) { m.getSource('modern').setData(store.modern); this.modernSet = true; }
    m.setLayoutProperty('modern', 'visibility', st.modern && !REGIONS.includes(st.mode) ? 'visible' : 'none');
    m.setLayoutProperty('rivers', 'visibility', st.rivers ? 'visible' : 'none');
    // merged regional modes (Taiwan): unit fills come from feature-state, borders only between areas
    if ((F.border || null) !== this.borderSet) { this.borderSet = F.border || null; m.getSource('rborder').setData(this.borderSet || EMPTY); }
    for (const x of ['', '2']) m.setLayoutProperty('polity-line' + x, 'visibility', st.borders && !F.border ? 'visible' : 'none');
    m.setLayoutProperty('rborder', 'visibility', st.borders && F.border ? 'visible' : 'none');
    // merged regional units: no anti-aliased seams between neighbouring units of the same colour
    if (!!F.border !== this.seamless) { this.seamless = !!F.border; for (const x of ['', '2']) m.setPaintProperty('polity-fill' + x, 'fill-antialias', !this.seamless); }
    if ((F.ribbons || null) !== this.ribbonSet) {
      this.ribbonSet = F.ribbons || null;
      m.getSource('ribbon').setData(this.ribbonSet ? { type: 'FeatureCollection', features: this.ribbonSet.map(f => ({ type: 'Feature', geometry: f.geometry, properties: { c: F.color(f.properties.p) } })) } : EMPTY);
    }
    if ((F.adminLines || null) !== this.adminSet) { this.adminSet = F.adminLines || null; m.getSource('aborder').setData(this.adminSet || EMPTY); }
    if ((F.rocOutline || null) !== this.rocSet) { this.rocSet = F.rocOutline || null; m.getSource('roc').setData(this.rocSet || EMPTY); }
    if (store.detail && !this.detailSet) { m.getSource('rivers10').setData(store.detail.rivers); m.getSource('lakes10').setData(store.detail.lakes); if (store.detail.local) m.getSource('riversLocal').setData(store.detail.local); this.detailSet = true; }
    for (const id of ['rivers10', 'riversLocal', 'rivers10-case', 'riversLocal-case']) m.setLayoutProperty(id, 'visibility', st.rivers ? 'visible' : 'none');
    m.triggerRepaint();
  }

  setHidden(keys, on, src = this.src) { for (const k of keys) this.map.setFeatureState({ source: src, id: k }, { hide: on }); }

  // ---- slime-mould transition, computed on a Web-Mercator grid over the area that changed and shown
  // through a canvas source (so it stays put while the globe turns)
  startTransition(prevFeats, feats, F) {
    const st = this.app.state;
    const keyOf = pieceKey;
    const before = new Set(prevFeats.map(keyOf)), after = new Set(feats.map(keyOf));
    const added = feats.filter(f => !before.has(keyOf(f))), removed = prevFeats.filter(f => !after.has(keyOf(f)));
    if (!added.length && !removed.length) return;
    this.endTransition();
    if (!(this.readOk ??= readbackOk())) return;     // canvas reads scrambled (anti-fingerprinting): no animation
    // bounds of everything that changed
    let [x0, y0, x1, y1] = [180, 85, -180, -85];
    for (const f of [...added, ...removed]) {
      let [[a, b], [c, d]] = geoBounds(f);
      if (c < a) { a = -180; c = 180; }                 // crosses the antimeridian: take the full width
      x0 = Math.min(x0, a); x1 = Math.max(x1, c); y0 = Math.min(y0, b); y1 = Math.max(y1, d);
    }
    y0 = Math.max(-84, y0); y1 = Math.min(84, y1);
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
    const mercY = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
    const span = (x1 - x0) * Math.PI / 180, ySpan = mercY(y1) - mercY(y0);
    // about one grid cell per 2 screen pixels at the current zoom (globe radius ≈ worldSize / 2π)
    const radius = 512 * 2 ** this.map.getZoom() / (2 * Math.PI);
    const target = Math.max(48, Math.min(1100, Math.max(span, ySpan * 0.8) * radius / 2));
    const k = target / Math.max(span, ySpan);
    const w = Math.max(8, Math.round(span * k)), h = Math.max(8, Math.round(ySpan * k));
    const proj = geoMercator().scale(k).translate([0, 0]);
    const off = proj([x0, y1]);
    proj.translate([-off[0], -off[1]]);
    const ids = list => {
      const c = this.idCanvas ||= document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      const path = geoPath(proj, g);
      const idx = new Map(), out = [];
      for (const f of list) if (!idx.has(f.properties.p) && out.length < 4095) { idx.set(f.properties.p, out.length); out.push(f.properties.p); }
      for (const f of list) {
        if (!idx.has(f.properties.p)) continue;
        g.fillStyle = idColor(idx.get(f.properties.p));
        g.beginPath(); path(f); g.fill();
      }
      return decodeIds(g.getImageData(0, 0, w, h).data, w, h, out);
    };
    const idA = ids(prevFeats), idB = ids(feats);
    const plan = planTransition(w, h, idA, idB, st.transition === 'jump' ? 'jump' : 'grow');
    // cells drawn by the overlay: changed ones, and every cell of a polity that is hidden while it grows
    const hide = [...new Set(added.flatMap(f => f.properties.units || [f.properties.prov ? f.properties.prov.id : f.properties.fi]))];
    const hiddenP = new Set(added.map(f => f.properties.p));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const rgb = new Map(), col = id => { if (!rgb.has(id)) { const c = F.color(id) || '#999999'; rgb.set(id, [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]); } return rgb.get(id); };
    this.trans = {
      plan, canvas, ctx: canvas.getContext('2d'), img: new ImageData(w, h), w, h, hide, hiddenP, col, idB,
      t0: performance.now(), dur: st.transition === 'jump' ? 750 : st.playing ? Math.max(220, Math.min(450, 450 / st.speed)) : 400,
      coords: [[x0, y1], [x1, y1], [x1, y0], [x0, y0]],
    };
    const m = this.map;
    if (m.getLayer('trans')) m.removeLayer('trans');
    if (m.getSource('trans')) m.removeSource('trans');
    this.drawTransition(0);
    m.addSource('trans', { type: 'canvas', canvas, coordinates: this.trans.coords, animate: true });
    m.addLayer({ id: 'trans', type: 'raster', source: 'trans', paint: { 'raster-opacity': this.fillAlpha(), 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, 'polity-line');
    // hide the growing polities only once the overlay is on screen, so nothing blinks in between
    const T = this.trans;
    const ready = e => { if (e.sourceId === 'trans' && this.trans === T && !T.hidden) { T.hidden = true; T.t0 = performance.now(); this.setHidden(T.hide, true); m.off('sourcedata', ready); } };
    m.on('sourcedata', ready);
    T.offReady = () => m.off('sourcedata', ready);
    const tick = () => {
      if (!this.trans) return;
      if (!this.trans.hidden) { this.trans.raf = requestAnimationFrame(tick); return; }
      const t = Math.min(1, (performance.now() - this.trans.t0) / this.trans.dur);
      this.drawTransition(ease(t));
      if (t >= 1) { this.endTransition(); return; }
      this.trans.raf = requestAnimationFrame(tick);
    };
    this.trans.raf = requestAnimationFrame(tick);
  }

  drawTransition(t) {
    const T = this.trans, { plan, img, w, h, idB } = T, d = img.data;
    d.fill(0);
    const put = (i, id) => { const c = T.col(id); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; };
    for (let i = 0; i < w * h; i++) if (idB[i] >= 0 && T.hiddenP.has(idB[i])) put(i, idB[i]);
    const { list, tv, ta, idA } = plan || { list: [] };
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      d[i * 4 + 3] = 0;
      if (t >= ta[k]) { if (idB[i] >= 0) put(i, idB[i]); } else if (t < tv[k] && idA[i] >= 0) put(i, idA[i]);
    }
    T.ctx.putImageData(img, 0, 0);
  }

  endTransition() {
    if (!this.trans) return;
    cancelAnimationFrame(this.trans.raf);
    this.trans.offReady?.();
    if (this.trans.hidden) this.setHidden(this.trans.hide, false);
    this.trans = null;
    const m = this.map;
    if (m.getLayer('trans')) m.removeLayer('trans');
    if (m.getSource('trans')) m.removeSource('trans');
  }

  fillAlpha() { const st = this.app.state; return Math.min(1, BASEMAPS[st.basemap].polityAlpha * st.density / 0.85); }

  // diagonal-stripe image for a secondary controller; returns the image-name suffix
  stripe(color) {
    const id = color.replace('#', '');
    if (!this.map.hasImage('stripe-' + id)) {
      const n = 10, data = new Uint8Array(n * n * 4);
      const r = parseInt(id.slice(0, 2), 16), g = parseInt(id.slice(2, 4), 16), b = parseInt(id.slice(4, 6), 16);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const on = (x + y) % 10 < 3, i = (y * n + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = on ? 255 : 0;
      }
      this.map.addImage('stripe-' + id, { width: n, height: n, data });
    }
    return id;
  }

  async applyBasemap() {
    if (!this.ready) return;
    const st = this.app.state, S = BASEMAPS[st.basemap], m = this.map;
    m.setPaintProperty('ocean', 'background-color', S.ocean);
    m.setPaintProperty('land', 'fill-color', S.land);
    m.setPaintProperty('lakes', 'fill-color', S.lake);
    const alpha = Math.min(1, S.polityAlpha * st.density / 0.85);
    for (const x of ['', '2']) m.setPaintProperty('polity-fill' + x, 'fill-opacity', SHOWN(alpha));
    m.setPaintProperty('polity-stripe', 'fill-opacity', alpha);
    m.setPaintProperty('disputed-owner', 'fill-opacity', alpha);
    if (m.getLayer('trans')) m.setPaintProperty('trans', 'raster-opacity', alpha);
    m.setPaintProperty('rivers', 'line-color', S.river);
    m.setPaintProperty('lakes10', 'fill-color', S.lake);
    for (const x of ['', '2']) m.setPaintProperty('polity-line' + x, 'line-color', S.border);
    const phys = st.basemap === 'physical';
    if (phys) {
      const ph = await loadPhysical();
      m.getSource('bathy').setData({ type: 'FeatureCollection', features: ph.bathy });
      m.getSource('regions').setData({ type: 'FeatureCollection', features: ph.regions });
      m.getSource('ice').setData(ph.ice);
    }
    for (const id of ['bathy', 'regions', 'ice']) m.setLayoutProperty(id, 'visibility', phys ? 'visible' : 'none');
    // high-resolution hillshade: opt-in, and only the current mode's region
    const rel = phys && st.relief ? reliefFor(st.mode, this.app.reliefRegions || []) : [];
    for (const r of this.app.reliefRegions || []) m.setLayoutProperty('relief-' + r.id, 'visibility', rel.includes(r.id) ? 'visible' : 'none');
    this.app.updateReliefCredit?.(rel);
    const sat = st.basemap === 'satellite' && !!this.app.satTiles;
    if (m.getLayer('sat')) m.setLayoutProperty('sat', 'visibility', sat ? 'visible' : 'none');
    for (const r of this.app.satRegions || []) m.setLayoutProperty('sat-' + r.id, 'visibility', sat ? 'visible' : 'none');
    m.setLayoutProperty('land', 'visibility', sat ? 'none' : 'visible');
    m.triggerRepaint();
  }

  hit(point) {
    const pu = pulseAt(point.x, point.y); if (pu) return { pulse: pu };
    const mk = (this.markerHits || []).find(b => point.x >= b.x0 && point.x <= b.x1 && point.y >= b.y0 && point.y <= b.y1);
    if (mk) return { marker: mk.m };
    const ln = lineAt(this.lineHits, point.x, point.y); if (ln) return { line: ln };
    const st = this.app.state;
    const d = this.map.queryRenderedFeatures(point, { layers: ['disputed-hatch'] })[0];
    const f = this.map.queryRenderedFeatures(point, { layers: [this.src === 'polities2' ? 'polity-fill2' : 'polity-fill'] }).filter(x => x.state?.on);
    if (f.length && REGIONS.includes(st.mode)) {
      const k = f[0].properties.k;
      const hitF = (this.feats || []).find(x => x.properties.prov?.id === k || x.properties.units?.includes(k));
      return hitF ? { polity: hitF.properties.p, sec: hitF.properties.s ?? null, prov: hitF.properties.prov } : null;
    }
    const pid = f.length ? f[0].properties.p : null;
    if (d) return { disputed: store.disputed.find(x => x.properties.name === d.properties.name), polity: pid };
    return pid == null ? null : { polity: pid };
  }

  drawOverlay() {
    const { octx: ctx, W, H, dpr } = this;
    if (!ctx || !this.feats) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const st = this.app.state;
    if (this.app.compare?.on) {
      const m = this.map, cc = m.getCenter(), ctr = [cc.lng, cc.lat];
      this.app.drawCompare(ctx, ll => geoDistance(ll, ctr) > 1.5 ? null : (p => [p.x, p.y])(m.project(ll)), xy => { const l = m.unproject(xy); return [l.lng, l.lat]; });
    }
    if (!st.labels) return;
    const S = BASEMAPS[st.basemap];
    const m = this.map;
    const c = m.getCenter();
    const center = [c.lng, c.lat];
    // pixels per radian at the centre of the view ≈ globe radius on screen
    const p0 = m.project([c.lng, c.lat]), p1 = m.project([c.lng + 1, c.lat]);
    const scale = Math.hypot(p1.x - p0.x, p1.y - p0.y) * 180 / Math.PI / Math.max(0.2, Math.cos(c.lat * Math.PI / 180));
    const lf = this.F?.labelOk ? this.feats.filter(f => this.F.labelOk(f.properties.p)) : this.feats;
    const items = labelItems(lf, st, scale, Math.min(34, this.W / 18),
      lp => geoDistance(lp, center) > 1.35 ? null : (p => [p.x, p.y])(m.project(lp)), this.F?.adminFeats, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    placeLabels(ctx, items, W, H, S.label);
    this.drawMarkers(ctx, center, S);
  }

  drawMarkers(ctx, center, S) {
    const F = this.F; if (!F) return;
    const col = this.app.state.langInfo.col, m = this.map;
    ctx.textBaseline = 'middle';
    for (const a of F.overlays) {
      const c = a.geometry.coordinates[0], ll = [(c[0][0] + c[24][0]) / 2, (c[12][1] + c[36][1]) / 2];
      if (geoDistance(ll, center) > 1.4) continue;
      const p = m.project(ll), name = a.properties.name[col] || a.properties.name[0];
      ctx.font = `600 11px ${S.label.font}`; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(name, p.x, p.y);
      ctx.fillStyle = '#8b0000'; ctx.fillText(name, p.x, p.y);
    }
    this.lineHits = [];
    if (F.lang) {
      const pr = ll => { if (geoDistance(ll, center) > 1.45) return null; const q = m.project(ll); return [q.x, q.y]; };
      this.lineHits = drawLang(ctx, F.lang, pathFromProject(ctx, pr), pr, S.label.font, Math.pow(2, m.getZoom() - 1));
    }
    const placed = [], hits = this.markerHits = [];
    const pproj = ll => { if (geoDistance(ll, center) > 1.4) return null; const q = m.project(ll); return [q.x, q.y]; };
    reservePulses(pproj, placed, S.label.font);
    for (const g of this.app.pin?.marks?.length ? [...this.app.pin.marks, ...F.markers] : F.markers) {
      if (geoDistance([g.lon, g.lat], center) > 1.4) continue;
      const p = m.project([g.lon, g.lat]);
      if (g.kind && !['gov', 'art', 'langArea', 'feud', 'power', 'us', 'work'].includes(g.kind) && !(g.kind === 'cap' && (g.pin || g.big && (this.map.getContainer().clientWidth >= 600 || g.rank < 10)))) {
        if (g.kind === 'cap') { const q = m.project([g.lon, Math.min(89, g.lat + 0.5)]); if (Math.hypot(q.x - p.x, q.y - p.y) * 114.6 * (g.size || 0) < 44) continue; }
        else { const q = m.project([g.lon + 0.5, g.lat]); if (Math.hypot(q.x - p.x, q.y - p.y) < 30) continue; }
      }
      if (g.alpha != null && g.alpha < 1) { ctx.save(); ctx.globalAlpha = g.alpha; drawMarker(ctx, p.x, p.y, g, col, S, placed, hits); ctx.restore(); }   // leaving: fading out
      else drawMarker(ctx, p.x, p.y, g, col, S, placed, hits);
    }
    drawPulses(ctx, S.label.font);
    if (takeSliding()) m.triggerRepaint();
  }

  getCenter() {
    const c = this.map.getCenter();
    return { lon: c.lng, lat: c.lat, k: Math.max(1, Math.pow(2, this.map.getZoom() - fitZoom(this.container))) };
  }
  setCenter({ lon, lat, k }) { this.map?.jumpTo({ center: [lon, lat], zoom: fitZoom(this.container) + Math.log2(k || 1) }); }
  zoomBy(f) { this.map.easeTo({ zoom: this.map.getZoom() + Math.log2(f), duration: 250 }); }
  setBearing(b) { if (b != null) this.map?.easeTo({ bearing: b, duration: 600 }); }
  northUp() { this.map.easeTo({ bearing: this.app.upBearing?.() ?? 0, pitch: 0, duration: 400 }); }   // keeps the chosen "Up"
  reset() { this.map.flyTo({ center: [60, 25], zoom: fitZoom(this.container), bearing: 0, pitch: 0, duration: 800 }); }
}

function hatchImage() {
  const n = 12, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const on = (x + y) % 6 === 0 || (x + y) % 6 === 1;
    const i = (y * n + x) * 4;
    data[i] = 25; data[i + 1] = 25; data[i + 2] = 25; data[i + 3] = on ? 150 : 0;
  }
  return { width: n, height: n, data };
}
