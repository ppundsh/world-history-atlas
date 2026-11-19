// What to draw for the current mode and time. Renderers (flat.js, globe.js) only ask for a frame():
//   world    — polities of the year, coloured per polity
//   religion — same polities, coloured by their official / dominant religion
//   china    — 1911–1951 provinces month by month, coloured by the controlling faction
import { feature, mesh, merge } from 'topojson-client';
import { geoArea, geoContains, geoCentroid } from 'd3-geo';
import polylabel from 'polylabel';
import { store, featuresFor, P } from './data.js';

const BASE = import.meta.env.BASE_URL + 'data/';
const json = p => fetch(BASE + p).then(r => r.json());

// ---------------------------------------------------------------- loading
export async function loadReligions() {
  if (store.religions) return store.religions;
  const list = await json('religions.json');
  store.religions = list;
  store.relIndex = Object.fromEntries(list.map((r, i) => [r.code, i]));
  return list;
}

// Regional modes (China 1911–1951, Taiwan 1600–2026): hand-made unit maps with month-by-month control
const UNIT_FILES = { china: 'china_provinces.json', taiwan: 'taiwan_units.json', japan: 'japan_units.json', russia: 'russia_units.json' };
// regional modes that have an administrative-division layer next to the control layer
export const LAYERED = ['taiwan', 'japan', 'russia'];
const OVERSEAS_GOVS = new Set(['taihoku', 'keijo', 'toyohara', 'ryojun', 'koror', 'shinkyo']);
export const REGIONS = Object.keys(UNIT_FILES);
export async function loadRegion(name) {
  store.regions ||= {};
  if (store.regions[name]) return store.regions[name];
  const [data, topo] = await Promise.all([json(name + '.json'), json(UNIT_FILES[name])]);
  const units = feature(topo, topo.objects[Object.keys(topo.objects)[0]]).features;
  data.topo = topo; data.topoObj = topo.objects[Object.keys(topo.objects)[0]];
  for (const f of units) {
    f.properties.area = geoArea(f);
    const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let best = polys[0], ba = 0;
    for (const p of polys) { const a = Math.abs(ring(p[0])); if (a > ba) { ba = a; best = p; } }
    f.properties.lp = polylabel(best, 0.01);
  }
  units.sort((a, b) => b.properties.area - a.properties.area);
  // factions (and administrative divisions) become extra rows of the polity table,
  // so names, colours and labels work the same way everywhere
  const add = list => { const o = store.polities.length; for (const f of list) store.polities.push([f.n[0], f.n[1], f.n[2], f.n[3], f.color, 0, '', '', '', '', '', null, null, '', 0]); return o; };
  data.offset = add(data.factions);
  if (data.divisions) data.divOffset = add(data.divisions);
  data.units = units;
  data.cache = new Map();
  for (const a of data.areas) a.feature = { type: 'Feature', properties: { name: a.n, kind: 'ccp' }, geometry: ellipse(a.lon, a.lat, a.rx, a.ry) };
  store.regions[name] = data;
  return data;
}
export const loadChina = () => loadRegion('china');

function ring(r) { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; }
function ellipse(lon, lat, rx, ry) {
  const pts = [];
  for (let i = 0; i <= 48; i++) { const t = -i / 48 * 2 * Math.PI; pts.push([lon + rx * Math.cos(t), lat + ry * Math.sin(t)]); }
  return { type: 'Polygon', coordinates: [pts] };
}

// ---------------------------------------------------------------- time helpers for regional modes
export const region = st => store.regions?.[st.mode];
export function regionYearMonth(data, m) {
  const [y0, m0] = data.start;
  const t = y0 * 12 + (m0 - 1) + m;
  return [Math.floor(t / 12), (t % 12) + 1];
}
export const monthOf = (data, y, mo = 1) => (y - data.start[0]) * 12 + (mo - data.start[1]);

const at = (list, m) => { let cur = list[0]; for (const e of list) { if (e[0] <= m) cur = e; else break; } return cur; };
// Japan: the overseas territories (units "o_…") are an optional layer
function regionState(c, m, layer, hide = null) {
  const key = layer + m + (hide ? hide.source : '');
  if (c.cache.has(key)) return c.cache.get(key);
  const feats = [];
  for (const unit of c.units) {
    const id = unit.properties.id;
    if (hide && hide.test(id)) continue;
    let [, fac, sec] = at(c.control[id], m);
    if (c.prc != null && m >= c.prc) { if (fac === c.ccp) fac = c.prcFaction; if (sec === c.ccp) sec = c.prcFaction; }
    const props = { area: unit.properties.area, lp: unit.properties.lp, prov: unit.properties, ctl: c.offset + fac, ctl2: sec >= 0 ? c.offset + sec : null };
    if (layer === 'admin' && c.admin) Object.assign(props, { p: c.divOffset + at(c.admin[id], m)[1], s: null });
    else Object.assign(props, { p: props.ctl, s: props.ctl2 });
    feats.push({ type: 'Feature', geometry: unit.geometry, properties: props });
  }
  const govs = c.governments.filter(g => g.a <= m && m <= g.b && !(hide && OVERSEAS_GOVS.has(g.id)));
  const areas = c.areas.filter(a => a.a <= m && m <= a.b);
  const events = c.events.filter(e => e.m <= m).slice(-1);
  const merged = c.merge ? mergeUnits(c, feats, layer) : null;
  const s = { feats: merged ? merged.feats : feats, units: feats, border: merged?.border, inner: merged?.inner, govs, areas, event: events[0] && m - events[0].m < (c.region === 'taiwan' ? 24 : c.region === 'japan' || c.region === 'russia' ? 36 : 6) ? events[0] : null };
  c.cache.set(key, s);
  return s;
}

// Regional modes with "merge": units with the same division (admin layer) or the same rulers (control
// layer) are drawn as one area, like a country, so a change of boundaries reads like a change of borders.
// topojson.merge can return rings in the opposite winding order; d3 then reads such a polygon as
// "the whole sphere except this area" and paints a layer over the whole world. Turn those around.
function fixWinding(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const p of polys) {
    if (geoArea({ type: 'Polygon', coordinates: p }) > 2 * Math.PI) for (const r of p) r.reverse();
  }
  return g;
}
// world polities around a regional mode, without the coarse world-map pieces that lie on the region itself
// (they would show as a grey halo around the detailed units)
function contextFor(c, year) {
  if (c.ctxYear === year) return c.ctxFeats;
  const all = featuresFor(year) || [], units = c.units || [];
  c.ctxPieces ||= new Map();               // world feature → its pieces that do not lie on the region
  const on = p => { const [x, y] = geoCentroid(p); return units.some(u => geoContains(u, [x, y])); };
  const pieces = f => {
    if (!c.ctxPieces.has(f)) {
      const g = f.geometry, polys = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
      const keep = polys.filter(p => !on({ type: 'Polygon', coordinates: p }));
      c.ctxPieces.set(f, keep.length === polys.length ? f : keep.length ? { ...f, geometry: { type: 'MultiPolygon', coordinates: keep } } : null);
    }
    return c.ctxPieces.get(f);
  };
  c.ctxYear = year; c.ctxFeats = all.map(pieces).filter(Boolean);
  return c.ctxFeats;
}
function mergeUnits(c, feats, layer) {
  const keyOf = f => layer === 'admin' ? String(f.properties.p) : f.properties.p + '/' + f.properties.s;
  const groups = new Map();
  for (const f of feats) { const k = keyOf(f); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
  c.geomById ||= new Map(c.topoObj.geometries.map(g => [g.properties.id, g]));
  c.mergeCache ||= new Map();
  const out = [];
  for (const [k, list] of groups) {
    const ids = list.map(f => f.properties.prov.id).sort();
    const ck = k + '|' + ids.join();
    if (!c.mergeCache.has(ck)) {
      const geometry = fixWinding(merge(c.topo, ids.map(id => c.geomById.get(id))));
      const big = list.reduce((a, b) => (b.properties.area > a.properties.area ? b : a));
      const f0 = { type: 'Feature', geometry, properties: {} };
      const area = geoArea(f0);
      const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
      let best = polys[0], ba = 0;
      for (const p of polys) { const a = Math.abs(ring(p[0])); if (a > ba) { ba = a; best = p; } }
      const pr = big.properties;
      c.mergeCache.set(ck, { type: 'Feature', geometry, properties: {
        p: pr.p, s: pr.s, ctl: pr.ctl, ctl2: pr.ctl2, area, lp: polylabel(best, 0.01), units: ids,
        prov: { id: 'g:' + k, unit: pr.prov } } });
    }
    out.push(c.mergeCache.get(ck));
  }
  out.sort((a, b) => b.properties.area - a.properties.area);
  // borders between different areas (and the coast), for the globe
  const owner = new Map(feats.map(f => [f.properties.prov.id, keyOf(f)]));
  const bkey = [...owner.values()].join();
  c.borderCache ||= new Map(); c.innerCache ||= new Map();
  if (!c.borderCache.has(bkey)) {
    const o = g => owner.get(g.properties.id);
    c.borderCache.set(bkey, mesh(c.topo, c.topoObj, (a, b) => (a === b ? o(a) != null : (o(a) !== o(b)))));
  }
  if (!c.innerCache.has(bkey)) {
    const o = g => owner.get(g.properties.id);
    c.innerCache.set(bkey, mesh(c.topo, c.topoObj, (a, b) => a !== b && o(a) != null && o(b) != null && o(a) !== o(b)));   // inland boundaries only
  }
  return { feats: out, border: c.borderCache.get(bkey), inner: c.innerCache.get(bkey) };
}

// outer edge of the territory of each government claiming to be the ROC (China mode): edges between a
// unit held by such a government and a unit not held by the same one, plus the coast
function rocOutline(c, feats, govs) {
  const roc = new Set(govs.filter(g => g.roc).map(g => c.offset + g.f));
  const owner = new Map(feats.map(f => [f.properties.prov.id, roc.has(f.properties.ctl) ? f.properties.ctl : null]));
  const key = [...owner.values()].join();
  c.rocCache ||= new Map();
  if (!c.rocCache.has(key)) {
    const o = g => owner.get(g.properties.id);
    c.rocCache.set(key, mesh(c.topo, c.topoObj, (a, b) => (o(a) != null || o(b) != null) && o(a) !== o(b) || (a === b && o(a) != null)));
  }
  return c.rocCache.get(key);
}

// ---------------------------------------------------------------- the frame
export function frame(st) {
  const c = region(st);
  if (c) {
    // Taiwan: control areas and/or administrative divisions. With both, control is the fill and the
    // divisions are drawn on top as dashed boundaries with smaller names.
    const layered = LAYERED.includes(st.mode);
    const both = layered && st.layers?.control && st.layers?.admin;
    const hide = st.mode === 'japan' && !st.overseas ? /^o_/ : null;
    const s = regionState(c, st.cm, layered ? (both ? 'control' : st.layer) : 'control', hide);
    const adm = both ? regionState(c, st.cm, 'admin', hide) : null;
    return {
      feats: s.feats,
      context: contextFor(c, st.year),                // the rest of the world, drawn in grey
      color: id => P.color(id),
      overlays: s.areas.map(a => a.feature),
      markers: s.govs.map(g => ({ lon: g.lon, lat: g.lat, text: g.n, color: P.color(c.offset + g.f), roc: g.roc })),
      govs: s.govs, event: s.event, units: s.units, border: s.border || null,
      adminLines: adm?.inner || null, adminFeats: adm?.feats || null,
      rocOutline: c.region === 'china' ? rocOutline(c, s.feats, s.govs) : null,
      disputed: false,
    };
  }
  const feats = featuresFor(st.year) || [];
  if (st.mode === 'religion' && store.religions) {
    return { feats, color: id => religionColor(id, st.year), overlays: [], markers: [], disputed: true };
  }
  return { feats, color: id => P.color(id), overlays: [], markers: [], disputed: true };
}

export function religionOf(id, year) {
  const spans = P.row(id)[13];
  if (!spans) return null;
  for (const s of spans.split('|')) {
    const [a, b, code] = s.split(':');
    if (+a <= year && year <= +b) return code;
  }
  return null;
}
function religionColor(id, year) {
  const code = religionOf(id, year);
  return code ? store.religions[store.relIndex[code]].color : '#e6e6e6';
}

// share of mapped land per religion for the legend
export function religionShares(feats, year) {
  const sum = new Map(); let tot = 0;
  const seen = new Set();
  for (const f of feats) {
    const key = f.properties.p + ':' + f.properties.a;
    if (seen.has(key)) continue; seen.add(key);
    const code = religionOf(f.properties.p, year) || '?';
    sum.set(code, (sum.get(code) || 0) + f.properties.area); tot += f.properties.area;
  }
  return [...sum.entries()].sort((a, b) => b[1] - a[1]).map(([code, a]) => ({ code, share: a / tot }));
}
