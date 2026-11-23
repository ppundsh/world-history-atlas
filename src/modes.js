import { pictureFor, ART_WORKS, registerWorks } from './artworks.js';
import { capitalOf } from './capitals.js';
import { pagePicture } from './pageimage.js';
// What to draw for the current mode and time. Renderers (flat.js, globe.js) only ask for a frame():
//   world    — polities of the year, coloured per polity
//   religion — same polities, coloured by their official / dominant religion
//   china    — 1911–1951 provinces month by month, coloured by the controlling faction
import { feature, mesh, merge } from 'topojson-client';
import { geoArea, geoContains, geoCentroid, geoBounds } from 'd3-geo';
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
const UNIT_FILES = { china: 'china_provinces.json', taiwan: 'taiwan_units.json', japan: 'japan_units.json', russia: 'russia_units.json', korea: 'korea_units.json', vietnam: 'vietnam_units.json', germany: 'germany_units.json', poland: 'poland_units.json', italy: 'italy_units.json', spain: 'spain_units.json', india: 'india_units.json', prc: 'prc_units.json', usa: 'usa_units.json' , france: 'france_units.json', egypt: 'egypt_units.json', iran: 'iran_units.json', turkey: 'turkey_units.json', uk: 'uk_units.json', mexico: 'mexico_units.json', morocco: 'morocco_units.json', brazil: 'brazil_units.json', argentina: 'argentina_units.json', thailand: 'thailand_units.json', philippines: 'philippines_units.json', indonesia: 'indonesia_units.json' };
// regional modes that have an administrative-division layer next to the control layer
export const LAYERED = ['china', 'taiwan', 'japan', 'russia', 'korea', 'vietnam', 'germany', 'poland', 'italy', 'spain', 'india', 'prc', 'usa', 'france', 'egypt', 'iran', 'turkey', 'uk', 'mexico', 'morocco', 'brazil', 'argentina', 'thailand', 'indonesia', 'philippines'];
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
  return [Math.floor(t / 12), (((t % 12) + 12) % 12) + 1];      // (months of years before 1 counted forward too)
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
    // a unit with no division at the time (before the country's divisions, or outside the country) shows who ruled
    // it instead, so the division layer never turns into one big "not divided" area
    const dv = layer === 'admin' && c.admin ? at(c.admin[id], m)[1] : -1;
    if (dv > 0) Object.assign(props, { p: c.divOffset + dv, s: null });
    else if (dv === 0) Object.assign(props, { p: props.ctl, s: props.ctl2, fb: true });
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
// (d3's rule: an outer ring runs clockwise. Tested on the flat lon/lat ring, which is far quicker than the
// spherical area and the same for any ring that does not cross the 180° meridian; those few take the slow test.)
function fixWinding(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const p of polys) {
    const r = p[0]; let x0 = Infinity, x1 = -Infinity; for (const c of r) { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; }
    const wrong = x1 - x0 > 180 ? geoArea({ type: 'Polygon', coordinates: p }) > 2 * Math.PI : ring(r) > 0;
    if (wrong) for (const q of p) q.reverse();
  }
  return g;
}
// world polities around a regional mode, without the coarse world-map pieces that lie on the region itself
// (they would show as a grey halo around the detailed units)
function contextFor(c, year) {
  if (c.ctxYear === year) return c.ctxFeats;
  const all = featuresFor(year) || [], units = c.units || [];
  c.ctxPieces ||= new Map();               // world feature → its pieces that do not lie on the region
  // each unit's lon/lat box, so most pieces are ruled out without the (slow) spherical point-in-polygon test
  c.unitBoxes ||= units.map(u => geoBounds(u));
  const inBox = ([[x0, y0], [x1, y1]], x, y) => y >= y0 && y <= y1 && (x0 <= x1 ? x >= x0 && x <= x1 : x >= x0 || x <= x1);
  c.ringOn ||= new WeakMap();              // polygon rings are shared between years: test each once
  const on = p => {
    const key = p.coordinates[0];
    if (c.ringOn.has(key)) return c.ringOn.get(key);
    const [x, y] = geoCentroid(p);
    const r = units.some((u, i) => inBox(c.unitBoxes[i], x, y) && geoContains(u, [x, y]));
    c.ringOn.set(key, r); return r;
  };
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
      const area = list.reduce((t, f) => t + (f.properties.area || 0), 0);   // the units' own areas (no new spherical sum)
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
    const party = !!(c.party && st.party);             // Taiwan: counties and cities coloured by the party in office
    const both = layered && st.layers?.control && st.layers?.admin && !party;
    const hide = st.mode === 'japan' && !st.overseas ? /^o_/ : null;
    const s = regionState(c, st.cm, party ? 'admin' : layered ? (both ? 'control' : st.layer) : 'control', hide);
    const adm = both ? regionState(c, st.cm, 'admin', hide) : null;
    return {
      feats: s.feats,
      context: contextFor(c, st.year),                // the rest of the world, drawn in grey
      color: party ? id => PARTY_COLOR[partyAt(c, id - c.divOffset, st.cm)] || '#e6e6e6' : id => P.color(id),
      party,
      // party view: no names on areas without a party (outside the country, not drawn)
      labelOk: party ? id => !!c.party[id - c.divOffset] : null,
      overlays: s.areas.map(a => a.feature),
      markers: [
        // administrative seats, with the division layer
        ...(st.capitals !== false && layered && (st.layer === 'admin' || both) ? (c.seats || []).filter(x => x.a <= st.cm && st.cm <= x.b)
          .map(x => ({ kind: 'seat', id: x.id, lon: x.lon, lat: x.lat, text: x.n, color: x.d >= 0 ? c.divisions[x.d].color : '#555' })) : []),
        // Taiwan: feuds (⚔) and local powers (◉), each with its own switch
        ...(c.local || []).slice().sort((x, y) => (x.kind === 'feud') - (y.kind === 'feud')).filter(x => ({ feud: st.feuds, power: st.powers, us: st.usForces }[x.kind]) && x.a <= st.cm && st.cm <= x.b)
          .map(x => ({ kind: x.kind, id: x.id, lon: x.lon, lat: x.lat, text: x.n, color: LOCAL_COLOR[x.kind] })),
        // major works with a place (dams, power plants, ports …): an icon, while in service
        ...(st.works === false ? [] : (c.works || []).filter(w => !w.path && w.a <= st.cm && st.cm <= w.b)
          .map(w => ({ kind: 'work', id: w.id, lon: w.lon, lat: w.lat, text: w.n, color: WORK_COLOR[w.kind], icon: WORK_ICON[w.kind], quiet: st.cm - w.a > 36 }))),
        // governments last, so the ★ sits on top of a seat at the same place
        ...(st.capitals === false ? [] : s.govs).map(g => ({ kind: 'gov', id: g.id, lon: g.lon, lat: g.lat, text: g.n, color: P.color(c.offset + g.f), roc: g.roc })),
      ],
      govs: s.govs, event: s.event, units: s.units, border: s.border || null,
      adminLines: adm?.inner || null, adminFeats: adm?.feats || null,
      // both layers (as on printed historical maps): divisions are the fill, control areas a coloured ribbon
      // along the inside of their borders, with the control names as the main labels
      fillFeats: adm?.feats || null, fillUnits: adm?.units || null, ribbons: adm ? s.feats : null, ribbonLines: adm ? s.border : null,
      rocOutline: c.region === 'china' ? rocOutline(c, s.feats, s.govs) : null,
      lang: { areas: [], flows: st.warFlows === false ? [] : regionFlows(c, st.cm, st.langInfo.col, st.mps, !!st.playing || st.cm === st.pausedCm), works: regionWorks(c, st.cm, st.langInfo.col, st.mps, st) },
      disputed: false,
    };
  }
  if (st.mode === 'regime' && store.regimes) return regimeFrame(st);
  if (st.mode === 'art' && store.art) return artFrame(st);
  if (THEMES.includes(st.mode) && themeOf(st.mode)) return themeFrame(st);
  const feats = featuresFor(st.year) || [];
  if (st.mode === 'religion' && store.religions) {
    return { feats, color: id => religionColor(id, st.year), overlays: [], markers: worldCapitals(st, feats), disputed: true };
  }
  return { feats, color: id => P.color(id), overlays: [], markers: worldCapitals(st, feats), disputed: true };
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

// ---- regime-type mode (V-Dem "Regimes of the World"; see data-pipeline/regime/build_regime.py) ----------
// Each V-Dem country-year is placed on the map at its capital; the polity holding that point gets its
// regime (several countries in one polity — empires and their colonies — go to the one nearest the
// polity's own label point). Polities V-Dem doesn't cover (most before 1789) are classified from their name
// as monarchy / republic-oligarchy / tribal, and marked as inferred.
export const REGIME_COLORS = { 0: '#c0392b', 1: '#ee8a3c', 2: '#86b7de', 3: '#2c5fa8', M: '#a98b74', O: '#5fb3a8', T: '#c9cfd4', U: '#e6e6e6' };
export const MONARCH_STRIPE = { 1: 'rgba(214,175,40,0.38)', 2: 'rgba(214,175,40,0.72)' };
export async function loadRegimes() {
  if (store.regimes) return store.regimes;
  store.regimes = await fetch(import.meta.env.BASE_URL + 'data/regimes.json').then(r => r.json());
  return store.regimes;
}
function bboxOf(f) {
  if (f.properties.bb) return f.properties.bb;
  let b = [180, 90, -180, -90];
  const walk = c => { if (typeof c[0] === 'number') { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; } else c.forEach(walk); };
  if (f.geometry) walk(f.geometry.coordinates);
  return (f.properties.bb = b);
}
let regimeCache = { key: null, map: null };
const OFFS = [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5], [1, 0], [-1, 0], [0, 1], [0, -1]];
export function regimeAssign(year, feats) {
  const key = year + ':' + feats.length;
  if (regimeCache.key === key) return regimeCache.map;
  const map = new Map();
  for (const c of store.regimes?.countries || []) {
    const run = c.runs.find(r => r[0] <= year && year <= r[1]); if (!run) continue;
    // capitals on the coast can fall just outside the simplified shapes: try a few nearby points too
    let f = null, x, y;
    for (const [dx, dy] of OFFS) {
      x = c.p[0] + dx; y = c.p[1] + dy;
      f = feats.find(f => { const b = bboxOf(f); return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && geoContains(f, [x, y]); });
      if (f) break;
    }
    if (!f) continue;
    const pid = f.properties.p, lp = f.properties.lp || c.p, d = (lp[0] - x) ** 2 + (lp[1] - y) ** 2;
    const old = map.get(pid);
    if (old && old.d <= d) continue;
    const [R, H, S] = run[2].split('|');
    map.set(pid, { R: +R, H: +H, S: S.replace('~', ''), approx: S.includes('~'), country: c.n, d });
  }
  regimeCache = { key, map };
  return map;
}
const RX = { O: /republic|commonwealth|confedera|league|venice|genoa|novgorod|united provinces|city[- ]state|polis|athens|carthage|swiss/i,
  T: /tribe|tribal|peoples|clans|chiefdom|confederacy|nomad|hunter|culture|horde/i,
  M: /yuan|ming|qing|song|tang|joseon|goryeo|dai viet|ayutthaya|vijayanagara|bahmani|delhi|aztec|inca|mali|songhai|ethiopia|abyssinia|muscovy|grand duchy|union|tibet|poland|hungary|bohemia|france|england|scotland|castile|aragon|portugal|navarre|denmark|sweden|norway|lithuania|kingdom|empire|sultanate|khanate|khaganate|caliphate|emirate|principality|duchy|dynasty|tsardom|shogunate|realm|raj|imamate|kingdoms|monarchy|mughal|ottoman|pharaoh|achaemenid|sasanian|parthian|maurya|gupta|seleucid|ptolemaic|abbasid|umayyad|fatimid|ayyubid|mamluk|safavid|qajar|timurid|kushan|dynastic|regency|crown|tsar|shah|king|empress|emperor/i };
export function regimeOf(id, year, feats) {
  const a = regimeAssign(year, feats).get(id);
  if (a) return a;
  const r = P.row(id), name = (r[0] || '') + ' ' + (r[6] || '');
  for (const k of ['O', 'T', 'M']) if (RX[k].test(name)) return { R: k, H: k === 'M' ? 2 : 0, S: '', inferred: true };
  return { R: 'U', H: 0, S: '', inferred: true };
}
// features with a monarchy stripe: stable wrappers (so cached paths survive), s = 'H1' / 'H2'
const wrapCache = new WeakMap();
export function regimeFrame(st) {
  const feats = featuresFor(st.year) || [];
  const out = feats.map(f => {
    const g = regimeOf(f.properties.p, st.year, feats);
    if (!g.H || g.R === 'M') return f;
    let w = wrapCache.get(f); if (!w) wrapCache.set(f, w = {});
    return w[g.H] ||= { ...f, properties: { ...f.properties, s: 'H' + g.H } };
  });
  return { feats: out, color: id => typeof id === 'string' ? MONARCH_STRIPE[id[1]] : REGIME_COLORS[regimeOf(id, st.year, feats).R], overlays: [], markers: [], disputed: true };
}
export function regimeShares(feats, year) {
  const sum = new Map(); let tot = 0;
  for (const f of feats) { const g = regimeOf(f.properties.p, year, feats); const k = String(g.R); sum.set(k, (sum.get(k) || 0) + f.properties.area); tot += f.properties.area; }
  return [...sum].map(([k, a]) => ({ k, share: a / (tot || 1) })).sort((a, b) => b.share - a.share);
}

// ---- art-history mode (data-pipeline/art/movements.tsv): the political map in pale tones, with the art
// movements, schools and centres active in the year as clickable ✦ markers coloured by tradition
export const ART_SYM = { arch: '⌂', person: '❖' };
export const ART_COLORS = { west: '#3f51b5', eastasia: '#c62828', southasia: '#ef6c00', islam: '#00897b', americas: '#558b2f', africa: '#b8860b', oceania: '#8e24aa', ancient: '#6d4c41' };
export async function loadArt() {
  if (store.art) return store.art;
  store.art = await fetch(import.meta.env.BASE_URL + 'data/art.json').then(r => r.json());
  for (const x of store.art) if (x.q) ART_WORKS[x.id] = x.q;      // buildings and figures carry their own Wikidata ids
  return store.art;
}
function pale(hex) {
  const n = parseInt(hex.slice(1), 16), m = (v) => Math.round(v + (245 - v) * 0.72);
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`;
}
export function artActive(year, st = null) { return lingering(store.art || [], year, st); }
// People and movements with a picture stay on the map at least MIN_SECONDS of playback, then fade out over
// FADE_SECONDS — short lives would otherwise flash by at full speed (decades pass in a second in antiquity).
// st.yps: years per second of playback at the current year and speed (set by main.js). Without st: exact dates.
const MIN_SECONDS = 6, FADE_SECONDS = 1.6;
function lingering(list, year, st) {
  if (!st) return list.filter(x => x.a <= year && year <= x.b);
  const yps = st.yps || 10, min = MIN_SECONDS * yps, fade = FADE_SECONDS * yps, out = [];
  for (const x of list) {
    if (year < x.a) continue;
    const end = Math.max(x.b, x.a + min);
    if (year > end + fade) continue;
    out.push(year <= end ? x : { ...x, alpha: Math.max(0, 1 - (year - end) / fade) });
  }
  return out;
}
function artFrame(st) {
  const feats = featuresFor(st.year) || [];
  return { feats, color: id => pale(P.color(id)), overlays: [], disputed: true,
    markers: artActive(st.year, st).map(x => ({ kind: 'art', alpha: x.alpha, id: x.id, lon: x.lon, lat: x.lat, text: x.n, color: ART_COLORS[x.t], sym: ART_SYM[x.k], picSize: st.picSize, pic: st.artPics !== false && st.pics !== false ? pictureFor(x.id) : null })) };
}

// major works (infra.tsv): an icon per kind; lines are drawn as they open, then stay as a faint network
export const WORK_ICON = { dam: '🌊', hydro: '💧', power: '🏭', nuclear: '☢️', wind: '🌬️', solar: '☀️', bridge: '🌉', port: '⚓', airport: '✈️', tunnel: '⛰️', space: '🚀', industry: '🏗️', metro: '🚇', water: '🚰', stadium: '🏟️', rail: '🚂', hsr: '🚄', highway: '🛣️', road: '🚌', canal: '🛳️', pipeline: '🛢️', fiber: '🌐', cable: '🔌', datacenter: '🖥️', ixp: '🔀', grid: '⚡' };
export const WORK_COLOR = { dam: '#0277bd', hydro: '#0288d1', power: '#6d4c41', nuclear: '#e6a100', wind: '#26a69a', solar: '#f9a825', bridge: '#546e7a', port: '#1565c0', airport: '#5e35b1', tunnel: '#795548', space: '#283593', industry: '#455a64', metro: '#00897b', water: '#039be5', stadium: '#8e24aa', rail: '#37474f', hsr: '#d32f2f', highway: '#ef6c00', road: '#8d6e63', canal: '#1976d2', pipeline: '#616161', fiber: '#7b1fa2', cable: '#00838f', datacenter: '#3949ab', ixp: '#7b1fa2', grid: '#f9a825' };
export const BACKBONE = new Set(['fiber', 'cable']);
export const workName = (e, col) => (e.k ? WORK_ICON[e.k] + ' ' : '') + (e.n[col] || e.n[0]);
function regionWorks(c, m, col, mps, st) {
  mps = mps || 2;
  const lines = [], net = [];
  for (const w of c.works || []) {
    if (!w.path || m < w.a || m > w.b) continue;
    // timed like the war arrows: drawn over at least 2.5 s, highlighted at least 6 s, the highlight fading over its last third
    const grow = 2.5 * mps, end = w.a + grow, linger = 6 * mps, p = Math.min(1, (m - w.a + 1) / grow);
    const hi = m <= end + linger * 0.66 ? 1 : Math.max(0, 1 - (m - end - linger * 0.66) / (linger * 0.34));
    // internet backbones (fibre lines, submarine cables) have their own switch
    const bb = BACKBONE.has(w.kind);
    if (bb ? !st.backbone : false) continue;
    if ((bb || st.works !== false) && hi > 0) lines.push({ id: w.id, kind: w.kind, path: w.path, parts: w.parts, p, alpha: hi, color: WORK_COLOR[w.kind], label: WORK_ICON[w.kind] + ' ' + (w.n[col] || w.n[0]) });
    if ((bb || st.network !== false) && p >= 1) net.push({ id: w.id, kind: w.kind, path: w.path, parts: w.parts, label: WORK_ICON[w.kind] + ' ' + (w.n[col] || w.n[0]), color: WORK_COLOR[w.kind], alpha: 1 - hi * (bb || st.works !== false ? 1 : 0) });
  }
  return { lines, net };
}

// marches, fronts and migrations of a regional mode: each advances along its path during its months,
// then stays a while and fades
function regionFlows(c, m, col, mps = 6, playing = true) {
  // timed in seconds of playback, not months, so a route stays readable at any speed: it takes at least
  // 2.5 s to draw, stays at least 6 s, and fades over the last third of that
  const out = [];
  // paused: the routes stay as playing left them (the caller passes playing); stepped or jumped to a month: only
  // what really happened around then, drawn whole —
  // the stretched playback timing would otherwise leave campaigns of years before on the map
  if (!playing) {
    for (const f of c.flows || []) {
      if (m < f.a || m > f.b + 3) continue;
      out.push({ ...f, p: 1, alpha: m <= f.b ? 1 : 1 - (m - f.b) / 4, label: f.n[col] || f.n[0] });
    }
    return out;
  }
  for (const f of c.flows || []) {
    const grow = Math.max(f.b - f.a + 1, 2.5 * mps), end = f.a + grow;
    const linger = Math.max((f.b - f.a) * 0.6, 6 * mps);
    if (m < f.a || m > end + linger) continue;
    const p = Math.min(1, (m - f.a + 1) / grow);
    const fadeFrom = end + linger * 0.66;
    out.push({ ...f, p, alpha: m <= fadeFrom ? 1 : Math.max(0, 1 - (m - fadeFrom) / (linger * 0.34)), label: f.n[col] || f.n[0] });
  }
  return out;
}

// an image supplied with the data (one the site has the right to use), loaded once
const own = new Map();
function ownPicture(url) {
  let e = own.get(url);
  if (!e) { e = { img: null }; own.set(url, e); const im = new Image(); im.onload = () => { e.img = im; ownListener?.(); }; im.src = url.startsWith('http') ? url : import.meta.env.BASE_URL + url; }
  return e.img;
}
let ownListener = null;
export function setOwnPictureListener(fn) { ownListener = fn; }
// the hidden mode's optional custom pictures (public/fgo/custom): the original's portrait and the custom picture
// side by side on one card, or the custom picture alone while the portrait is missing
const pairs = new Map();
function pairPicture(id, list) {
  const key = id + '|' + list.map(im => im.src).join('|');
  if (pairs.has(key)) return pairs.get(key);
  const S = 160, c = document.createElement('canvas'); c.width = list.length * S; c.height = S;
  const g = c.getContext('2d');
  list.forEach((im, i) => { const r = Math.max(S / im.naturalWidth, S / im.naturalHeight), w = S / r, h = S / r; g.drawImage(im, (im.naturalWidth - w) / 2, (im.naturalHeight - h) / 2, w, h, i * S, 0, S, S); });
  g.fillStyle = '#fff'; for (let i = 1; i < list.length; i++) g.fillRect(i * S - 1.5, 0, 3, S);
  pairs.set(key, c);
  return c;
}
function themePicture(p, st) {
  const base = p.img ? ownPicture(p.img.url) : pictureFor(p.id);
  const mine = p.custom && st.fgoCustom !== false ? p.custom.map(c => ownPicture(c.url)).filter(Boolean) : [];
  const list = [base, ...mine].filter(Boolean);
  if (list.length > 1) return { pic: pairPicture(p.id, list), picSize: st.picSize, picAspect: list.length };
  return { pic: list[0] || null, picSize: st.picSize };
}

// ---------------------------------------------------------------- capitals in the world modes (Wikidata, see capitals.js)
// one ★ per polity in view; the largest polities' capitals show at every zoom, the rest once zoomed in
// parties of Taiwan's county and city heads (party.tsv)
// cables of one kind share a hue; each cable gets its own shade of it (hue ±35°, lighter or darker) so that
// neighbouring cables can be told apart while the legend's colour still says what kind they are
// colour of a cable by the chosen style: shade (each cable its own shade of its kind's colour), kind (the kind's
// colour), era (by the year it entered service), steam (metal tubes, each cable its own metal; drawn by langlayer)
const PIPED = new Set(['telegraph', 'coax', 'fibre', 'land']);   // kinds drawn as pipes in the pipe style
function cableColor(mode, f, st) {
  const base = themeColor(mode, f.f), style = st?.cableStyle || 'shade';
  if (style === 'kind') return base;
  if (!PIPED.has(f.f)) return base;               // fire beacons, couriers: their kind's colour, never pipes
  if (style === 'steam') {                       // glossy tubes in the solid colours of the old 3D Pipes screensaver
    const M = ['#f0d8d8', '#22b322', '#e8641c', '#7fd8d8', '#e8c21c', '#2f6fd8', '#d83a3a', '#a04ad0'];
    let h = 0; for (const ch of String(f.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return M[h % M.length];
  }
  if (style === 'era') { const t = Math.max(0, Math.min(1, (f.a - 1850) / 176)); return `hsl(${Math.round(280 - t * 250)}, 70%, ${Math.round(38 + 10 * Math.sin(t * Math.PI))}%)`; }
  return cableShade(base, f.id);
}
function cableShade(hex, id) {
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  let H = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; H *= 60;
  const H2 = (H + ((h % 7) - 3) * 12 + 360) % 360, L2 = Math.min(0.55, Math.max(0.24, l + (((h >> 3) % 5) - 2) * 0.06));
  return `hsl(${H2.toFixed(0)}, ${Math.round(Math.min(1, s) * 100)}%, ${Math.round(L2 * 100)}%)`;
}
export const PARTY_COLOR = { us_d: '#2f5fc4', us_r: '#d42d2d', us_dr: '#3a9b5c', us_f: '#e38b2c', us_w: '#e6c229', us_nr: '#b5893a', us_gw: '#8d6e63', us_sd: '#14306b', us_third: '#8e44ad', none: '#e0e0e0', inc: '#19aaed', bjp: '#ff9933', in_janata: '#0b8f3c', in_left: '#cc0000', aitc: '#20c646', sp: '#e11d48', bsp: '#22409a', tdp: '#f6e000', ysr: '#1569c7', brs: '#e05297', dmk: '#8b0000', admk: '#2c7a3a', tvk: '#f2b705', agp: '#00bfff', bjd: '#00843d', sad: '#0f204a', ss: '#f26f21', jknc: '#cc0033', pdp: '#00965e', jmm: '#1f7a1f', mgp: '#d4145a', sdf: '#ffd400', skm: '#e4002b', aap: '#0066a4', in_other: '#9ca3af', pres: '#5b5b5b', pl_sld: '#d7191c', pl_aws: '#1b5e20', pl_popis: '#4a6fa5', pl_lpr: '#5d4037', pl_po: '#f68b1f', pl_pis: '#263a7a', pl_psl: '#2bb24c', it_dc: '#6fa8dc', it_left: '#c62828', it_csx: '#ef6c4a', it_cdx: '#1e40af', it_other: '#2e9d3b', aut: '#a16207', psoe: '#e30613', pp: '#1d84ce', ciu: '#00a5a5', erc: '#f5a623', pnv: '#2e7d32', cc: '#f2d200', cds: '#7fb800', upn: '#6a1b9a', par: '#b45309', prc: '#c2185b', fac: '#00897b', gb: '#e65100', kr_cons: '#e61e2b', kr_lib: '#1a5fb4', kr_uld: '#2e9d5b', kr_third: '#2e9d5b', cdu: '#3a3a3a', csu: '#0080c8', spd: '#e3000f', fdp: '#f5c800', grn: '#46962b', linke: '#be3075', dp: '#b08d00', sed: '#8b0000', cvp: '#6b8e23', mixed: '#bdbdbd', ldp: '#3ca324', cdp: '#1c4e9c', dpj: '#d7263d', nfp: '#6a3d9a', komei: '#f55881', jcp: '#8b0000', sdp: '#1ca9e9', dpfp: '#f5c400', kibo: '#18a06a', reiwa: '#ed008c', chudo: '#7f4fc9', sanseito: '#d85d0f', liberal: '#ff9900', sakigake: '#8fbc3f', jishin: '#b8c600', tie: '#bdbdbd', mmd: '#e4e4e4', other: '#9e9e9e', cons: '#2b5fad', prog: '#d62728', ishin: '#b8c600', opp: '#e67e22', kmt: '#1f4ea3', dpp: '#1b9e3e', tpp: '#28c8c8', pfp: '#f28c28', np: '#f2d40b', cdsp: '#8e5aa8', ycp: '#b5651d', ind: '#7d7d7d', fr_left: '#e8547d', fr_right: '#1e4fa3', fr_green: '#2e9d3b', fr_nat: '#7a5195', uk_lab: '#e4003b', uk_con: '#0087dc', uk_snp: '#f2d500', uk_pc: '#008142', uk_uup: '#48a5ee', uk_dup: '#d46a4c', uk_sf: '#326760', uk_direct: '#9e9e9e', appt: '#cfcfcf', mil: '#a89f88', tr_akp: '#f5a623', tr_chp: '#e30a17', tr_mhp: '#8b1a1a', tr_kurd: '#7b3fa0', tr_islam: '#1f8a3a', tr_anap: '#f2d400', tr_dyp: '#4a7fc1', tr_dsp: '#2b9fd9', tr_iyi: '#2fb5e6', tr_bbp: '#6d4c41', tr_other: '#c2185b', tr_trustee: '#5b5b5b', mx_pri: '#d62828', mx_pan: '#1f4fa3', mx_prd: '#f2c200', mx_morena: '#8b1e3f', mx_pvem: '#3aa040', mx_mc: '#f28c28', mx_pes: '#7b3fa0', mx_pt: '#c2185b', mx_other: '#9e9e9e', ar_pj: '#2b8fd9', ar_ucr: '#d62828', ar_pro: '#f2c200', ar_lla: '#6a1b9a', ar_prov: '#2e9d5b', ar_other: '#9e9e9e', br_pt: '#c4122f', br_mdb: '#2e9d3b', br_psdb: '#1f5fb4', br_dem: '#3b8dd9', br_pds: '#1a3a6b', br_pdt: '#e57373', br_psb: '#f28c28', br_pp: '#6aa0d8', br_psd: '#f2c200', br_pl: '#14306b', br_rep: '#00897b', br_pcdob: '#8b0000', br_other: '#9e9e9e', id_golkar: '#f5d000', id_pdip: '#d62828', id_demokrat: '#1f4fa3', id_gerindra: '#a0522d', id_pks: '#222222', id_pan: '#2b9fd9', id_pkb: '#2e9d3b', id_nasdem: '#0b4f8a', id_ppp: '#00703c', id_other: '#9e9e9e' };
export function partyAt(c, div, m) {
  let r = null;
  for (const [a, code] of c.party?.[div] || []) { if (a <= m) r = code; else break; }
  return r;
}
export const LOCAL_COLOR = { feud: '#b91c1c', power: '#6b21a8', us: '#1d4ed8' };
export function worldCapitals(st, feats) {
  if (st.capitals === false) return [];
  const area = new Map();
  for (const f of feats) area.set(f.properties.p, (area.get(f.properties.p) || 0) + (f.properties.area || 0));
  const ranked = [...area.entries()].sort((a, b) => b[1] - a[1]);
  const out = [];
  ranked.forEach(([p, ar], i) => {
    const q = P.row(p)?.[10]; if (!q) return;
    const c = capitalOf(q, st.year); if (!c) return;
    out.push({ kind: 'cap', id: p, cap: c.c, img: c.img, lon: c.ll[0], lat: c.ll[1], text: c.n, color: P.color(p), big: i < 24, rank: i, size: Math.sqrt(ar) });
  });
  return out;
}

// ---------------------------------------------------------------- thematic world modes (languages, finance)
// Areas (ellipses), points (shown once zoomed in) and flows (arrows that grow from source to destination during
// their years, then stay a while and fade). Each mode may bring its own timeline of events.
export const THEMES = ['language', 'finance', 'fgo', 'internet'];
export async function loadTheme(mode) {
  store.theme ||= {};
  if (store.theme[mode]) return store.theme[mode];
  const T = await fetch(import.meta.env.BASE_URL + 'data/' + mode + '.json').then(r => r.json());
  T.fam = Object.fromEntries(T.families.map(f => [f.id, f]));
  for (const a of T.areas) a.geometry = ellipse(a.lon, a.lat, a.rx, a.ry);
  // portraits of the points' originals (Wikidata → Commons), fetched like the art-history works
  if (T.pictures) registerWorks(mode, Object.fromEntries(T.points.filter(p => p.q).map(p => [p.id, [p.q]])), 'works.' + mode + '.v1');
  // the hidden mode's custom pictures live only on the maintainer's computer (public/fgo/custom is not committed):
  // their list, public/fgo/custom/index.json, is read when it is there and ignored otherwise
  if (mode === 'fgo') {
    const C = await fetch(import.meta.env.BASE_URL + 'fgo/custom/index.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
    // a point of two Servants (one original) can have a picture for each
    if (C) for (const p of T.points) { const list = (p.ids || [p.id]).filter(i => C[i]).map(i => ({ ...C[i], id: i, n: p.sub?.find(x => x.id === i)?.n || p.n })); if (list.length) p.custom = list; }
  }
  store.theme[mode] = T;
  return T;
}
export const themeOf = mode => store.theme?.[mode] || null;
export const themeColor = (mode, f) => themeOf(mode)?.fam[f]?.color || '#888';
export function themeActive(mode, year, st = null) {
  const T = themeOf(mode); if (!T) return { areas: [], points: [], flows: [] };
  const flows = [];
  for (const f of T.flows) {
    // cables (g: years to lay): drawn over g years, in service until retired, gone a few years later
    const linger = f.g != null ? 3 : Math.max(80, (f.b - f.a) * 1.5), grow = f.g ?? (f.b - f.a);
    if (year < f.a || year > f.b + linger) continue;
    // while the timeline plays, st.yearF is the exact (fractional) year, so a cable is laid smoothly through its
    // first year instead of appearing whole when the year changes
    const yf = f.g != null && st?.playing && st.yearF != null && Math.floor(st.yearF) === year ? st.yearF : year + (f.g != null ? 1 : 0);
    const p = grow > 0 ? Math.max(0, Math.min(1, (yf - f.a) / grow)) : 1;
    flows.push({ ...f, p, alpha: year <= f.b ? 1 : Math.max(0, 1 - (year - f.b) / linger), color: f.g != null ? cableColor(mode, f, st) : themeColor(mode, f.f), noHead: f.g != null, pipe: PIPED.has(f.f) });
  }
  return {
    // areas fade in over their first decades and out over their last ones
    areas: T.areas.filter(a => a.a <= year && year <= a.b).map(a => ({ ...a, color: themeColor(mode, a.f),
      fresh: Math.max(0, 1 - (year - a.a) / 60), fading: a.b < 2026 ? Math.max(0, 1 - (a.b - year) / 60) : 0 })),
    points: lingering(T.points, year, st),
    flows,
  };
}
function themeFrame(st) {
  const T = themeOf(st.mode);
  const feats = featuresFor(st.year) || [], act = themeActive(st.mode, st.year, st);
  if (st.thAreas === false) act.areas = [];
  if (st.thFlows === false) act.flows = [];
  if (st.thPoints === false) act.points = [];
  // small areas first, so their labels win over the large ones around them
  const areas = act.areas.slice().sort((a, b) => b.rx * b.ry - a.rx * a.ry);
  return { feats, color: () => '#ece8df', overlays: [], disputed: false, noLabels: true,
    lang: { areas, flows: act.flows.map(f => ({ ...f, name: f.n[st.langInfo.col] || f.n[0], label: f.g != null && st.year - f.a > 2 ? '' : f.n[st.langInfo.col] || f.n[0] })), cableW: st.cableW ?? 1, cableStyle: st.cableStyle || 'shade' },
    markers: [
      ...areas.slice().reverse().map(a => ({ kind: 'langArea', id: a.id, lon: a.lon, lat: a.lat, text: a.n, color: a.color, sym: '●',
        // finance: a picture of the bank, exchange or coin (Wikipedia's lead picture, Commons only)
        ...(T.areaPictures && st.artPics !== false && st.pics !== false ? { pic: pagePicture(a.w[1]), picSize: Math.min(st.picSize || 54, 60) } : {}) })),
      ...act.points.map(p => ({ kind: T.pointsAlways ? 'langArea' : 'lang', alpha: p.alpha, id: p.id, lon: p.lon, lat: p.lat, text: p.n, color: themeColor(st.mode, p.f), sym: '●',
        ...(T.pictures && st.artPics !== false && st.pics !== false ? themePicture(p, st) : {}),
        ...(p.series ? { hi: true } : {}), ...(T.pointsAlways ? { cls: p.f } : {}) })),
    ] };
}
