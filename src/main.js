import './style.css';
import { loadCore, loadChunk, chunkFor, countFor, store, P, loadPhysical, featuresFor, loadModern, loadDetail } from './data.js';
import { PROJ_INFO } from './projinfo.gen.js';
import { PROJ_METRICS } from './projmetrics.gen.js';
import { EventLayer, eventsEnabled } from './eventlayer.js';
import { Relief, availableRelief } from './relief.js';
import { TaiwanCompare } from './compare.js';
import { CREDITS } from './credits.gen.js';
import { BASEMAPS } from './styles.js';
import { WORLD_EVENTS } from './worldEvents.gen.js';
import { LANGS, t, formatYear, detectLang, safeGet, safeSet } from './i18n.js';
import { FlatMap } from './flat.js';
import { Music } from './audio.js';
import { PROJ, grouped } from './projections.js';
import { frame, loadRegion, REGIONS, LAYERED, regionYearMonth, monthOf, loadReligions, religionOf, religionShares, loadRegimes, regimeOf, regimeShares, REGIME_COLORS, loadArt, artActive, ART_COLORS } from './modes.js';

const $ = s => document.querySelector(s);
const PROJECTIONS = Object.keys(PROJ);
const BASES = ['plain', 'physical', 'antique', 'satellite'];
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

// Piecewise time scale for the slider: later centuries get more room (and more playing time),
// so recent history is easier to follow. A full run takes FULL_RUN seconds at 1×.
const SEG = [[-3400, 0], [-1000, 0.2], [0, 0.32], [1000, 0.5], [1500, 0.63], [1800, 0.77], [1900, 0.86], [2026, 1]];
const FULL_RUN = 240;
const yearToPos = y => { for (let i = 1; i < SEG.length; i++) if (y <= SEG[i][0]) { const [y0, p0] = SEG[i - 1], [y1, p1] = SEG[i]; return p0 + (y - y0) / (y1 - y0) * (p1 - p0); } return 1; };
// the regime mode ends with V-Dem's last year; the other world modes run to the map data's last year
const REGIME_LAST = 2025;
function maxYear() { return st.mode === 'regime' ? REGIME_LAST : store.meta.to; }
const posToYear = p => { for (let i = 1; i < SEG.length; i++) if (p <= SEG[i][1]) { const [y0, p0] = SEG[i - 1], [y1, p1] = SEG[i]; return Math.round(y0 + (p - p0) / (p1 - p0) * (y1 - y0)); } return SEG.at(-1)[0]; };
const TICKS = [-3000, -2000, -1000, 0, 500, 1000, 1500, 1700, 1800, 1900, 1950, 2000];
const REGION_TICKS = {
  china: [1912, 1916, 1920, 1924, 1928, 1931, 1937, 1941, 1945, 1949],
  taiwan: [1624, 1662, 1683, 1723, 1787, 1812, 1875, 1895, 1920, 1945, 1987, 2010],
  japan: [701, 794, 1185, 1336, 1467, 1603, 1868, 1945],
  russia: [862, 1132, 1240, 1480, 1547, 1721, 1917, 1991],
  korea: [313, 668, 936, 1392, 1592, 1910, 1953],
  vietnam: [544, 939, 1009, 1407, 1527, 1600, 1802, 1884, 1954],
  germany: [1648, 1742, 1806, 1815, 1871, 1918, 1945, 1990],
};
const REGION_RUN = { china: 300, taiwan: 420, japan: 900, russia: 900, korea: 900, vietnam: 900, germany: 600 };        // seconds for a full run at 1×
const REGION_VIEW = { china: { lon: 106, lat: 36, k: 3.2 }, taiwan: { lon: 120.6, lat: 23.75, k: 36 }, japan: { lon: 137.5, lat: 37.5, k: 6.5 }, russia: { lon: 80, lat: 58, k: 1.9 }, korea: { lon: 127.6, lat: 39.5, k: 9 }, vietnam: { lon: 106.5, lat: 16, k: 7 }, germany: { lon: 13, lat: 51.5, k: 8 } };
const REGION_FIRST = { china: '1911-10', taiwan: '1600-01' };
const MODES = ['world', 'religion', 'regime', 'art', 'china', 'taiwan', 'japan', 'russia', 'korea', 'vietnam', 'germany'];
const BEARINGS = { n: 0, e: 90, s: 180, w: -90 };          // MapLibre bearing that puts that direction on top
const EVENTS = WORLD_EVENTS.map(e => ({ ...e, n: [e.n[2], e.n[0], e.n[1], e.n[3]], d: [e.d[2], e.d[0], e.d[1], e.d[3]] }));   // → polity column order

let evRows = [];               // history event table rows (declared early: renderYear can run before buildEvTable's section)
const WIKI = { 'zh-Hant': ['zhwiki', 'zh', '&variant=zh-tw'], 'zh-Hans': ['zhwiki', 'zh', '&variant=zh-cn'], en: ['enwiki', 'en', ''], ja: ['jawiki', 'ja', ''] };
const R2 = 6371.0088 ** 2;                       // steradians → km²
const app = {
  state: {
    year: -3400, pos: 0, playing: false, speed: 1,
    lang: detectLang(), projection: 'equirect', basemap: 'plain', pov: 'defacto',
    labels: true, borders: true, rivers: false, graticule: false, selected: null,
    projBy: safeGet('projBy') || 'surface', density: +(safeGet('density') || 0.85),
    mode: 'world', cm: 1, layer: 'control', layers: { control: true, admin: false }, overseas: false, cmBy: {},
    animate: safeGet('animate') !== '0', transition: 'grow', relLabels: safeGet('relLabels') || 'religion',
    minFont: safeGet('minFont') === '1', relief: safeGet('relief') === '1', evTable: safeGet('evTable') === '1', feuds: safeGet('feuds') === '1', powers: safeGet('powers') === '1', distort: false /* mask disabled for now */,
    labelsIn: safeGet('labelsIn') !== '0', capitals: safeGet('capitals') !== '0', modern: safeGet('modern') === '1', events: safeGet('events') !== '0', bearing: 'n',
  },
  flat: null, globe: null, satTiles: null, satImage: null,
  legendCollapsed: window.innerWidth < 700,          // keep the map visible on phones
};
const st = app.state;
if (new URLSearchParams(location.search).has('debug')) { window.__app = app; window.__store = store; }     // for automated tests
st.langInfo = LANGS.find(l => l.id === st.lang);
const music = new Music();
let hashT = 0, lastT = 0, rafId = 0, busy = false;   // declared before the top-level awaits below

// ---------------------------------------------------------------- bootstrap
readHash();
await loadCore();
SEG[0][0] = store.meta.from;
SEG[SEG.length - 1][0] = maxYear();
st.year = Math.max(store.meta.from, Math.min(maxYear(), st.year));
st.pos = yearToPos(st.year);
await loadChunk(chunkFor(st.year));
if (st.basemap === 'physical') await loadPhysical();
if (st.modern) await loadModern();
await detectSatellite();
if (st.mode === 'religion') await loadReligions();
if (st.mode === 'regime') await loadRegimes();
if (st.mode === 'art') await loadArt();
if (REGIONS.includes(st.mode) && !app.initialView) { const v = { ...REGION_VIEW[st.mode] }; if (st.projection === 'globe') v.k *= st.mode === 'taiwan' ? 0.5 : 0.7; app.initialView = v; }
if (REGIONS.includes(st.mode)) { await loadRegion(st.mode); st.year = regionYearMonth(reg(), st.cm)[0]; await loadChunk(chunkFor(st.year)); st.pos = st.cm / (reg().months - 1); }

app.flat = new FlatMap($('#flat'), app);
// regional terrain shading on the physical base map (Japan: GSI tiles; Taiwan: tiles from the MOI DTM, when built)
app.reliefRegions = await availableRelief();
app.flat.setRelief(new Relief(app.reliefRegions, () => app.flat.reliefChanged()));
app.updateReliefCredit = ids => { app.reliefIds = ids; projTags(); };
// distortion mask strength, kept per projection (each projection's mask measures something different)
app.compare = new TaiwanCompare(app);
// floating Taiwan: what is under it (cached per position and date), then drawn by compare.js
app.drawCompare = (ctx, project, invert) => {
  const cmp = app.compare; if (!cmp.shape || !cmp.center) return;
  const v = currentView();
  const key = [cmp.center.join(), st.mode, st.year, st.cm, st.projection, v.k.toFixed(2), v.lon.toFixed(1), v.lat.toFixed(1)].join('|');
  if (cmp.infoKey !== key) {
    cmp.infoKey = key;
    cmp.info = cmp.summary(ll => app.flat.featureAt(ll), project, invert);
    if (cmp.info.kind === 'area') cmp.info.name = P.name(cmp.info.id, st.langInfo.col);
  }
  const s = t(st.lang);
  cmp.draw(ctx, project, cmp.info, st.lang, { ...s, font: BASEMAPS[st.basemap].label.font });
};
app.distortStrength = name => { const v = +safeGet('distort:' + name); return v > 0 ? v : 0.55; };
buildUI();
applyLang();
await setProjection(st.projection);
music.load().then(ok => { $('#music').hidden = !ok; refreshMusic(); });
drawSpark();
renderYear();
$('#loading').remove();

// ---------------------------------------------------------------- satellite availability
async function detectSatellite() {
  const base = import.meta.env.BASE_URL + 'basemap/';
  const ok = async p => { try { const r = await fetch(base + p, { method: 'HEAD' }); return r.ok && (r.headers.get('content-type') || '').startsWith('image'); } catch { return false; } };
  try {
    const r = await fetch(base + 'sat/meta.json');
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      const meta = await r.json();
      app.satMaxZoom = meta.maxzoom;
      app.satTiles = new URL(base, location.href).href + 'sat/{z}/{x}/{y}.jpg';
      // sharper regional layers (East Asia, Taiwan): tiles for the globe, equirectangular images for flat maps
      app.satRegions = (meta.regions || []).map(g => ({ ...g, tiles: new URL(base, location.href).href + g.id + '/{z}/{x}/{y}.webp', url: base + g.image }));
    }
  } catch { /* no satellite tiles */ }
  if (await ok('bluemarble.jpg')) app.satImageUrl = base + 'bluemarble.jpg';
}
function satAvailable() { return !!(app.satTiles || app.satImageUrl); }
// regional images are only fetched once the flat map is zoomed in far enough to use them
async function loadSatRegions() {
  if (app.satRegionImgs || !app.satRegions?.length) return app.satRegionImgs;
  const load = g => new Promise(res => { const im = new Image(); im.onload = () => res({ ...g, img: im }); im.onerror = () => res(null); im.src = g.url; });
  app.satRegionImgs = (await Promise.all(app.satRegions.map(load))).filter(Boolean);
  app.flat?.setHires(app.satRegionImgs);
  return app.satRegionImgs;
}
function loadSatImage() {
  if (app.satImage || !app.satImageUrl) return Promise.resolve(app.satImage);
  return new Promise(res => { const im = new Image(); im.onload = () => { app.satImage = im; res(im); }; im.onerror = () => res(null); im.src = app.satImageUrl; });
}

// ---------------------------------------------------------------- views
async function setProjection(name) {
  const prev = currentView();
  st.projection = name;
  const isGlobe = name === 'globe';
  $('#flat').hidden = isGlobe;
  $('#globe').hidden = !isGlobe; $('#globe-labels').hidden = !isGlobe;
  $('#north').hidden = !(isGlobe || app.flat?.rotating);
  $('#lockBtn').hidden = true;
  $('#bearingBox').hidden = !isGlobe;
  if ($('#distortBox')) syncDistort();
  if (isGlobe) {
    if (!app.globe) {
      const { GlobeMap } = await import('./globe.js');     // MapLibre is only downloaded when the globe is opened
      app.globe = new GlobeMap($('#globe'), $('#globe-labels'), app);
      await app.globe.init(prev); app.initialView = null;
    } else { app.globe.setCenter(prev); app.globe.resizeOverlay(); }
    app.globe.applyBasemap(); app.globe.update(true);
  } else {
    app.flat.free = !!st.free; app.flat.setProjection(name);
    syncLock();
    app.flat.setCenter(app.initialView || prev); app.initialView = null;
    if (st.basemap === 'satellite') { app.flat.setRaster(await loadSatImage()); if (app.flat.view.k >= 2.5) loadSatRegions(); }
  }
  projTags();
  writeHash();
}
function syncBearing() {
  const b = ((app.globe?.map?.getBearing() ?? 0) + 540) % 360 - 180;
  const k = Object.keys(BEARINGS).find(k => Math.abs(((BEARINGS[k] - b + 540) % 360) - 180) < 0.5) || 'free';
  if (k !== st.bearing) { st.bearing = k; $('#bearing').value = k; }
}
function currentView() {
  if (st.projection === 'globe' && app.globe?.map) return app.globe.getCenter();
  return app.flat?.proj ? app.flat.getCenter() : (app.initialView || { lon: 60, lat: 25, k: 1 });
}
function redraw() {
  if (st.projection === 'globe') app.globe?.update();
  else app.flat.request();
}
app.onViewChange = () => {
  writeHashSoon();
  const k = currentView().k;
  if (k >= 4 && !store.detail) loadDetail().then(() => redraw());
  if (k >= 2.5 && st.basemap === 'satellite' && st.projection !== 'globe') loadSatRegions();
  if (st.projection === 'globe') syncBearing();
};

// ---------------------------------------------------------------- time
async function setYear(y, fromSlider = false) {
  y = Math.max(store.meta.from, Math.min(maxYear(), Math.round(y)));
  const c = chunkFor(y);
  if (!store.chunks.has(c.id)) { $('#busy').hidden = false; await loadChunk(c); $('#busy').hidden = true; }
  st.year = y;
  if (!fromSlider) st.pos = yearToPos(y);
  // prefetch the next era
  const nc = store.meta.chunks[store.meta.chunks.indexOf(c) + 1];
  if (nc && y > c.to - 40) loadChunk(nc);
  renderYear();
}
async function setMonth(m, fromSlider = false) {
  const c = reg();
  m = Math.max(0, Math.min(c.months - 1, Math.round(m)));
  const [y] = regionYearMonth(reg(), m);
  const ch = chunkFor(y);
  if (!store.chunks.has(ch.id)) { $('#busy').hidden = false; await loadChunk(ch); $('#busy').hidden = true; }
  st.cm = m; st.year = y;
  if (!fromSlider) st.pos = m / (c.months - 1);
  renderYear();
}
function isChina() { return REGIONS.includes(st.mode); }    // any month-based regional mode
function reg() { return store.regions?.[st.mode]; }
function setPos(pos) {
  st.pos = Math.max(0, Math.min(1, pos));
  return isChina() ? setMonth(st.pos * (reg().months - 1), true) : setYear(posToYear(st.pos), true);
}
function step(d) { pause(); st.transition = 'grow'; return isChina() ? setMonth(st.cm + d) : setYear(st.year + d); }

function renderYear() {
  syncEvTable();
  const s = t(st.lang);
  const F = frame(st);
  if (isChina()) {
    const [y, mo] = regionYearMonth(reg(), st.cm);
    $('#yearBig').textContent = s.ym(y, mo);
    if (st.mode === 'china') {
      $('#countLabel').textContent = s.rocGovs;
      $('#countNum').textContent = F.govs.filter(g => g.roc).length;
    } else {
      $('#countLabel').textContent = s.regimes;
      $('#countNum').textContent = new Set(F.feats.map(f => f.properties.ctl)).size;
    }
    $('#ticker').textContent = F.event && st.events ? (F.event.n[st.langInfo.col] || F.event.n[0]) : '';
    $('#ticker').hidden = !(F.event && st.events);
  } else {
    $('#yearBig').textContent = formatYear(st.lang, st.year);
    $('#countLabel').textContent = s.countries;
    $('#countNum').textContent = countFor(st.year);
    const ev = st.events ? EVENTS.filter(e => e.y <= st.year && st.year <= Math.max(e.e ?? e.y, e.y + (st.year > 1800 ? 1 : 5))).at(-1) : null;
    $('#ticker').textContent = ev ? (ev.n[st.langInfo.col] || ev.n[0]) : '';
    $('#ticker').hidden = !ev;
  }
  $('#slider').value = Math.round(st.pos * 10000);
  $('#yearInput').value = st.year;
  renderLegend(F);
  if (st.selected != null && !F.feats.some(f => f.properties.p === st.selected)) st.selected = null;
  if (st.selected != null && app.selectedProv) showProvince(app.selectedProv);
  else if (st.selected != null) showPolity(st.selected); else if (!$('#info').dataset.disputed && !$('#info').dataset.sticky) hideInfo();
  redraw();
  writeHashSoon();
}

// regime mode: short text (tooltip) and the info-panel rows
function regimeText(id) {
  const s = t(st.lang), g = regimeOf(id, st.year, frame(st).feats);
  return s.regimeNames[g.R] + (g.H && g.R !== 'M' ? '・' + s.monarch[g.H] : '') + (g.S ? '・' + s.regimeSub[g.S] : '');
}
function regimeRows(id) {
  const s = t(st.lang), g = regimeOf(id, st.year, frame(st).feats);
  const src = g.inferred ? s.regimeInferred : `${s.regimeVdem}（${esc(g.country)}${g.approx ? '，' + s.regimeApprox : ''}）`;
  return `<tr><th>${s.regimeRow}</th><td><i class="sw" style="background:${REGIME_COLORS[g.R]}"></i> ${s.regimeNames[g.R]}${g.S ? '・' + s.regimeSub[g.S] : ''}</td></tr>
    <tr><th>${s.headRow}</th><td>${g.R === 'M' ? s.monarch[2] : g.H ? s.monarch[g.H] : s.monarch[0]}</td></tr>
    <tr><th>${s.regimeSrc}</th><td><small>${src}</small></td></tr>`;
}
function renderLegend(F) {
  const s = t(st.lang), box = $('#legend'), col = st.langInfo.col;
  if (st.mode === 'religion' && store.religions) {
    const shares = religionShares(F.feats, st.year).slice(0, 14);
    box.innerHTML = `<h3>${s.religionLegend}</h3><ul>` + shares.map(({ code, share }) => {
      const r = store.religions[store.relIndex[code]];
      return `<li ${r ? `data-rel="${code}" title="${esc(s.clickInfo)}"` : ''}><i style="background:${r ? r.color : '#e6e6e6'}"></i>${r ? (r.n[col] || r.n[0]) : s.unknownRel}<b>${(share * 100).toFixed(share < 0.01 ? 1 : 0)}%</b></li>`;
    }).join('') + `</ul><p>${s.relNote}</p>`;
    box.hidden = false;
    bindLegendToggle(box);
    box.querySelectorAll('li[data-rel]').forEach(li => li.onclick = () => showReligion(li.dataset.rel));
  } else if (st.mode === 'art' && store.art) {
    const act = artActive(st.year).sort((a, b) => a.t.localeCompare(b.t) || a.a - b.a);
    box.innerHTML = `<h3>${s.artLegend}</h3><ul class="govs">` + (act.length ? act.map(x =>
      `<li data-art="${x.id}" title="${esc(s.clickInfo)}"><span style="color:${ART_COLORS[x.t]}">✦</span> ${esc(x.n[col] || x.n[0])}</li>`).join('') : `<li>${s.artNone}</li>`) +
      `</ul><ul>` + Object.entries(ART_COLORS).map(([k, c]) => `<li><i style="background:${c}"></i>${s.artTrad[k]}</li>`).join('') + `</ul><p>${s.artNote}</p>`;
    box.hidden = false;
    bindLegendToggle(box);
    box.querySelectorAll('li[data-art]').forEach(li => li.onclick = () => showArt(li.dataset.art));
  } else if (st.mode === 'regime' && store.regimes) {
    const shares = regimeShares(F.feats, st.year);
    box.innerHTML = `<h3>${s.regimeLegend}</h3><ul>` + shares.map(({ k, share }) =>
      `<li><i style="background:${REGIME_COLORS[k]}"></i>${s.regimeNames[k]}<b>${(share * 100).toFixed(share < 0.01 ? 1 : 0)}%</b></li>`).join('') +
      `</ul><ul><li><i class="mstripe h2"></i>${s.monarch[2]}</li><li><i class="mstripe h1"></i>${s.monarch[1]}</li></ul><p>${s.regimeNote}</p>`;
    box.hidden = false;
    bindLegendToggle(box);
  } else if (isChina()) {
    const area = new Map();
    for (const f of F.feats) {
      area.set(f.properties.p, (area.get(f.properties.p) || 0) + f.properties.area);
      if (f.properties.s != null) area.set(f.properties.s, (area.get(f.properties.s) || 0) + f.properties.area * 0.3);
    }
    const facs = [...area.entries()].sort((a, b) => b[1] - a[1]);
    const govs = F.govs.slice().sort((a, b) => b.roc - a.roc);
    const title = LAYERED.includes(st.mode) && st.layer === 'admin' ? s.adminNow : s.factionsNow;
    box.innerHTML = `<h3>${title}</h3><ul>` + facs.map(([id]) => `<li><i style="background:${P.color(id)}"></i>${P.name(id, col)}</li>`).join('') +
      `</ul><h3>${s.govs}</h3>` + (st.mode === 'china' ? `<p class="rockey"><i></i>${s.rocKey}</p>` : '') +
      `<ul class="govs">` + govs.map(g => `<li class="${g.roc ? 'roc' : ''}" data-gid="${g.id}" title="${esc(s.clickInfo)}">★ ${g.n[col] || g.n[0]}</li>`).join('') + `</ul>`;
    box.hidden = false;
    bindLegendToggle(box);
    box.querySelectorAll('li[data-gid]').forEach(li => li.onclick = () => showGov(li.dataset.gid));
  } else box.hidden = true;
}

function bindLegendToggle(box) {
  box.classList.toggle('collapsed', !!app.legendCollapsed);
  box.querySelectorAll('h3').forEach(h => { h.onclick = () => { app.legendCollapsed = !app.legendCollapsed; box.classList.toggle('collapsed', app.legendCollapsed); }; });
}

async function setMode(mode) {
  pause();
  const prev = st.mode;
  if (isChina()) st.cmBy[prev] = st.cm;
  st.mode = mode;
  st.transition = 'jump';
  st.selected = null; app.selectedProv = null; hideInfo();
  $('#relLabelsBox').hidden = mode !== 'religion';
  $('#l-labels').textContent = mode === 'religion' ? t(st.lang).labelsRel : t(st.lang).labels;
  if (mode === 'religion') await loadReligions();
  if (mode === 'regime') await loadRegimes();
  if (mode === 'art') await loadArt();
  $('#layerBox').hidden = !LAYERED.includes(mode); $('#overseasBox').hidden = mode !== 'japan'; $('#localBox').hidden = mode !== 'taiwan'; $('#toWorld').hidden = !REGIONS.includes(mode);
  if (REGIONS.includes(mode)) {
    $('#busy').hidden = false; await loadRegion(mode); $('#busy').hidden = true;
    st.cm = st.cmBy[mode] ?? (REGION_FIRST[mode] ? monthOf(reg(), ...REGION_FIRST[mode].split('-').map(Number)) : 0);
    if (prev !== mode) {
      const v = { ...REGION_VIEW[mode] };
      if (st.projection === 'globe') { v.k *= mode === 'taiwan' ? 0.5 : 0.7; app.globe?.setCenter(v); } else app.flat.setCenter(v);
    }
    $('#pov').closest('label').hidden = true;
    buildTicks(); drawSpark();
    await setMonth(st.cm);
  } else {
    $('#pov').closest('label').hidden = false;
    if (REGIONS.includes(prev)) {
      st.year = Math.min(store.meta.to, regionYearMonth(store.regions[prev], st.cmBy[prev] ?? 0)[0]);
      const v = { lon: 60, lat: 25, k: 1 };
      if (st.projection === 'globe') app.globe?.setCenter(v); else app.flat.setCenter(v);
    }
    SEG[SEG.length - 1][0] = maxYear();
    st.year = Math.min(st.year, maxYear());
    buildTicks(); drawSpark();
    await setYear(st.year);
  }
  if (st.relief) app.globe?.applyBasemap();
  buildEvTable();
  app.globe?.update(true);
  writeHash();
}

function buildTicks() {
  const ticks = isChina()
    ? REGION_TICKS[st.mode].map(y => ({ y, pos: monthOf(reg(), y) / (reg().months - 1) }))
    : TICKS.map(y => ({ y, pos: yearToPos(y) }));
  $('#ticks').innerHTML = ticks.map(k => `<span style="left:${k.pos * 100}%" data-y="${k.y}" data-pos="${k.pos}"></span>`).join('');
  buildEventMarks();
}
// key events on the timeline: a thin mark (or a band for long events); hover for the name, click to jump
function buildEventMarks() {
  const box = $('#evmarks');
  box.hidden = !st.events;
  app.eventMarks = [];
  if (!st.events) { box.innerHTML = ''; return; }
  const col = st.langInfo.col;
  let marks;
  if (isChina()) {
    const c = reg();
    marks = c.events.map(e => { const [y, mo] = regionYearMonth(c, e.m); return { a: e.m / (c.months - 1), b: e.m / (c.months - 1), n: e.n, when: t(st.lang).ym(y, mo) }; });
  } else {
    marks = EVENTS.map(e => ({ ...e, a: yearToPos(e.y), b: yearToPos(e.e ?? e.y),
      when: formatYear(st.lang, e.y) + (e.e ? ' – ' + formatYear(st.lang, e.e) : '') }));
  }
  app.eventMarks = marks;
  box.innerHTML = marks.map((m, i) => `<i class="${m.big ? 'big' : ''}" style="left:${m.a * 100}%;width:calc(${(m.b - m.a) * 100}% + 3px)" data-ev="${i}" title="${esc(m.when + '　' + (m.n[col] || m.n[0]))}"></i>`).join('');
}

function play() {
  if (st.playing) return;
  if (st.pos >= 1) setPos(0);
  st.playing = true; lastT = performance.now();
  $('#play').classList.add('on'); $('#play').title = t(st.lang).pause;
  music.play();
  rafId = requestAnimationFrame(tick);
}
function syncDistort() {
  const box = $('#distortBox');
  box.hidden = !st.distort || st.projection === 'globe';
  $('#distortStr').value = String(app.distortStrength(st.projection));
  $('#t-distort').closest('label').title = t(st.lang).distortTip;
}
// free-movement lock for maps that can be turned in every direction
function syncLayers() { $('#ly-control').checked = st.layers.control; $('#ly-admin').checked = st.layers.admin; $('#ov-japan').checked = !!st.overseas; }
function syncLock() {
  const f = app.flat, s = t(st.lang);
  $('#lockBtn').hidden = !f.freeCapable;
  $('#lockBtn').textContent = st.free ? '🔓' : '🔒';
  $('#lockBtn').classList.toggle('on', !!st.free);
  $('#lockBtn').title = st.free ? s.lockOn : s.lockOff;
  $('#north').hidden = !f.rotating;
}
function pause() {
  st.playing = false; cancelAnimationFrame(rafId);
  $('#play').classList.remove('on'); $('#play').title = t(st.lang).play;
  music.pause();                               // music follows the timeline
}
async function tick(now) {
  if (!st.playing) return;
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (!busy) {
    st.transition = 'grow';
    st.pos = Math.min(1, st.pos + dt / (isChina() ? REGION_RUN[st.mode] : FULL_RUN) * st.speed);
    if (isChina()) {
      const m = Math.round(st.pos * (reg().months - 1));
      if (m !== st.cm) { busy = true; await setMonth(m, true); busy = false; }
    } else {
      const y = posToYear(st.pos);
      if (y !== st.year) { busy = true; await setYear(y, true); busy = false; }
    }
    if (st.pos >= 1) { pause(); return; }
  }
  rafId = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- UI
function buildUI() {
  $('#lang').innerHTML = LANGS.map(l => `<option value="${l.id}">${l.label}</option>`).join('');
  $('#lang').value = st.lang;
  $('#lang').onchange = e => { st.lang = e.target.value; st.langInfo = LANGS.find(l => l.id === st.lang); safeSet('lang', st.lang); applyLang(); renderYear(); };
  $('#projBtn').onclick = e => { e.stopPropagation(); toggleProjMenu(); };
  $('#showBtn').onclick = e => { e.stopPropagation(); $('#showMenu').hidden = !$('#showMenu').hidden; $('#projMenu').hidden = true; };
  $('#showMenu').onclick = e => e.stopPropagation();
  $('#projMenu').onclick = e => e.stopPropagation();
  document.addEventListener('click', () => { $('#projMenu').hidden = true; $('#showMenu').hidden = true; });
  $('#relLabels').onchange = e => { st.relLabels = e.target.value; safeSet('relLabels', st.relLabels); redraw(); app.globe?.map?.triggerRepaint(); };
  $('#bearing').onchange = e => { st.bearing = e.target.value; app.globe?.setBearing(BEARINGS[st.bearing] ?? null); };
  $('#projBy').onchange = e => { st.projBy = e.target.value; safeSet('projBy', st.projBy); fillProjections(); };
  $('#density').value = st.density;
  $('#density').oninput = e => { st.density = +e.target.value; safeSet('density', e.target.value); app.globe?.applyBasemap(); redraw(); };
  $('#base').onchange = async e => {
    st.basemap = e.target.value;
    if (st.basemap === 'physical') await loadPhysical();
    if (st.basemap === 'satellite' && st.projection !== 'globe') { app.flat.setRaster(await loadSatImage()); if (app.flat.view.k >= 2.5) loadSatRegions(); }
    document.body.dataset.base = st.basemap;
    app.globe?.applyBasemap();
    projTags(); redraw(); writeHash();
  };
  $('#pov').onchange = e => { st.pov = e.target.value; redraw(); writeHash(); };
  for (const k of ['labels', 'labelsIn', 'capitals', 'borders', 'rivers', 'graticule', 'modern', 'distort', 'relief', 'twCompare', 'evTable', 'minFont', 'animate', 'events']) {
    const el = $('#t-' + k); el.checked = st[k];
    el.onchange = async () => {
      st[k] = el.checked;
      if (['modern', 'minFont', 'animate', 'events', 'relief', 'labelsIn', 'distort', 'evTable', 'capitals'].includes(k)) safeSet(k, el.checked ? '1' : '0');
      if (k === 'distort') syncDistort();
      if (k === 'evTable') buildEvTable();
      if (k === 'twCompare') {
        await app.compare.load(); app.compare.on = st.twCompare;
        if (st.twCompare) { const v = currentView(); app.compare.center = [v.lon, Math.max(-60, Math.min(60, v.lat))]; app.compare.infoKey = null; }
      }
      if (k === 'relief') { app.flat.reliefChanged(); await app.globe?.applyBasemap(); }
      if (k === 'modern' && st.modern) await loadModern();
      if (k === 'rivers' && st.rivers && currentView().k >= 4) await loadDetail();
      if (k === 'events') { buildEventMarks(); renderYear(); }
      app.globe?.update(true); app.globe?.map?.triggerRepaint();
      redraw();
    };
  }
  $('#distortStr').oninput = e => { safeSet('distort:' + st.projection, e.target.value); redraw(); };
  syncDistort();
  $('#t-distort').closest('label').hidden = true;
  $('#speed').innerHTML = SPEEDS.map(s => `<option value="${s}">${s}×</option>`).join('');
  $('#speed').value = String(st.speed);
  $('#speed').onchange = e => { st.speed = +e.target.value; safeSet('speed', e.target.value); };
  $('#play').onclick = () => (st.playing ? pause() : play());
  $('#back').onclick = () => step(-1);
  $('#fwd').onclick = () => step(1);
  $('#start').onclick = () => { pause(); st.transition = 'jump'; setPos(0); };
  $('#slider').oninput = e => { st.transition = 'grow'; setPos(e.target.value / 10000); };
  $('#yearInput').onchange = e => { pause(); st.transition = 'jump'; isChina() ? setMonth(monthOf(reg(), +e.target.value)) : setYear(+e.target.value); };
  $('#mode').onchange = e => setMode(e.target.value);
  // regional modes: one click back to world history at the same year
  $('#toWorld').onclick = () => { $('#mode').value = 'world'; setMode('world'); };
  // Japan: overseas territories on / off
  $('#ov-japan').onchange = e => { st.overseas = e.target.checked; st.transition = 'jump'; st.selected = null; hideInfo(); app.globe?.update(true); renderYear(); writeHash(); };
  for (const [el, k] of [['#lc-feud', 'feuds'], ['#lc-power', 'powers']]) {
    $(el).checked = !!st[k];
    $(el).onchange = e => { st[k] = e.target.checked; safeSet(k, st[k] ? '1' : '0'); app.globe?.update(true); redraw(); };
  }
  // Taiwan layers: control areas and/or administrative divisions (at least one stays on)
  for (const k of ['control', 'admin']) $('#ly-' + k).onchange = e => {
    st.layers[k] = e.target.checked;
    if (!st.layers.control && !st.layers.admin) st.layers[k === 'control' ? 'admin' : 'control'] = true;
    st.layer = st.layers.control ? 'control' : 'admin';
    syncLayers(); st.transition = 'jump'; st.selected = null; app.selectedProv = null; hideInfo(); app.globe?.update(true); renderYear(); writeHash();
  };
  $('#zin').onclick = () => (st.projection === 'globe' ? app.globe.zoomBy(2) : app.flat.animateZoom(2));
  $('#zout').onclick = () => (st.projection === 'globe' ? app.globe.zoomBy(0.5) : app.flat.animateZoom(0.5));
  $('#reset').onclick = () => (st.projection === 'globe' ? app.globe.reset() : app.flat.reset());
  $('#lockBtn').onclick = () => { st.free = !st.free; app.flat.setFree(st.free); syncLock(); };
  $('#north').onclick = () => (st.projection === 'globe' ? app.globe?.northUp() : app.flat.northUp());
  $('#full').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  $('#menuBtn').onclick = () => document.body.classList.toggle('menu-open');
  $('#aboutBtn').onclick = () => { $('#about').hidden = false; };
  // About: close with the × (always visible), the button at the end, a click outside the card, or Esc
  const closeAbout = () => { $('#about').hidden = true; };
  $('#aboutClose').onclick = closeAbout; $('#aboutX').onclick = closeAbout;
  $('#about').onclick = e => { if (e.target === $('#about')) closeAbout(); };
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#about').hidden) closeAbout(); });
  $('#musicBtn').onclick = () => { music.setEnabled(!music.enabled); if (!st.playing) music.pause(); refreshMusic(); };
  $('#trackSel').onchange = e => { music.select(+e.target.value); refreshMusic(); };
  $('#nextTrack').onclick = () => { music.next(); refreshMusic(); };
  music.onchange = () => refreshMusic();
  $('#volume').value = music.el.volume;
  $('#volume').oninput = e => music.setVolume(+e.target.value);
  // ticks under the slider
  buildTicks();
  $('#ticks').onclick = e => { const p = e.target.dataset?.pos; if (p != null) { pause(); st.transition = 'jump'; setPos(+p); } };
  // a key event: jump there and show what it was
  $('#evmarks').onclick = e => {
    const ev = app.eventMarks?.[+e.target.dataset?.ev];
    if (!ev) return;
    pause(); st.transition = 'jump'; setPos(ev.a); showEvent(ev);
  };
  document.addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
    if (e.code === 'Space') { e.preventDefault(); st.playing ? pause() : play(); }
    if (e.key === ',' || e.key === '<') step(-1);
    if (e.key === '.' || e.key === '>') step(1);
    if (e.key === 'Escape') { st.selected = null; hideInfo(); redraw(); }
  });
  app.onSelect = hit => {
    if (hit?.marker) { hit.marker.kind === 'gov' ? showGov(hit.marker.id) : hit.marker.kind === 'art' ? showArt(hit.marker.id) : showSeat(hit.marker.id, hit.marker.kind); return; }
    app.selectedProv = null;
    if (!hit) { st.selected = null; hideInfo(); redraw(); return; }
    if (hit.prov) { st.selected = hit.polity; app.selectedProv = hit.prov; showProvince(hit.prov); }
    else if (hit.disputed) { st.selected = hit.polity; showDisputed(hit.disputed, hit.polity); }
    else { st.selected = hit.polity; showPolity(hit.polity); }
    redraw();
  };
  let hoverT = 0;
  app.onHover = (hit, e) => {
    const now = performance.now(); if (now - hoverT < 60) return; hoverT = now;
    const tip = $('#tooltip');
    $('#stage').style.cursor = hit?.marker ? 'pointer' : '';
    if (hit?.marker) {
      tip.textContent = (hit.marker.text[st.langInfo.col] || hit.marker.text[0]) + ' · ' + t(st.lang).clickInfo;
      tip.hidden = false;
      const r = $('#stage').getBoundingClientRect();
      tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
      return;
    }
    if (!hit || hit.polity == null) { tip.hidden = true; return; }
    const col = st.langInfo.col;
    let text = P.name(hit.polity, col);
    const pn = hit.prov && (hit.prov[st.lang] || hit.prov.en);      // merged areas have no single unit name
    if (pn) text = `${pn}：${text}` + (hit.sec != null ? ` ／ ${P.name(hit.sec, col)}` : '');
    if (st.mode === 'regime') text += ' · ' + regimeText(hit.polity);
    if (st.mode === 'religion') { const r = religionOf(hit.polity, st.year); text += ' · ' + (r ? store.religions[store.relIndex[r]].n[col] : t(st.lang).unknownRel); }
    if (hit.disputed) text += ' · ' + t(st.lang).disputed;
    tip.textContent = text;
    tip.hidden = false;
    const r = $('#stage').getBoundingClientRect();
    tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
  };
  $('#stage').addEventListener('pointerleave', () => { $('#tooltip').hidden = true; });
  window.addEventListener('resize', drawSpark);
}

function applyLang() {
  const s = t(st.lang);
  document.documentElement.lang = st.lang;
  document.title = s.title + ' — ' + s.subtitle;
  $('#title').textContent = s.title;
  $('#subtitle').textContent = s.subtitle;
  for (const [id, key] of [['#l-lang', 'language'], ['#l-proj', 'projection'], ['#l-base', 'basemap'], ['#l-pov', 'pov'], ['#l-labels', 'labels'], ['#l-borders', 'borders'], ['#l-rivers', 'rivers'], ['#l-graticule', 'graticule'], ['#l-speed', 'speed'],
    ['#l-modern', 'modern'], ['#l-relief', 'reliefOpt'], ['#l-distort', 'distort'], ['#l-twCompare', 'twCompare'], ['#l-evTable', 'evTable'], ['#l-distortStr', 'distortStr'], ['#l-labelsIn', 'labelsIn'], ['#l-capitals', 'capitals'], ['#l-minFont', 'minFont'], ['#l-animate', 'animate'], ['#l-events', 'events'], ['#l-bearing', 'bearing'], ['#l-relLabels', 'relLabels'], ['#showBtn', 'show']]) $(id).textContent = s[key];
  $('#showBtn').textContent = s.show + ' ▾';
  $('#relLabels').innerHTML = ['religion', 'both', 'country'].map(k => `<option value="${k}">${s.relLabelOpts[k]}</option>`).join('');
  $('#relLabels').value = st.relLabels;
  $('#relLabelsBox').hidden = st.mode !== 'religion';
  $('#l-labels').textContent = st.mode === 'religion' ? s.labelsRel : s.labels;
  $('#bearing').innerHTML = ['n', 'e', 's', 'w', 'free'].map(k => `<option value="${k}" ${k === 'free' ? 'hidden' : ''}>${s.bearings[k]}</option>`).join('');
  $('#bearing').value = st.bearing;
  buildEventMarks();
  $('#mode').innerHTML = MODES.map(m => `<option value="${m}">${s.modes[m]}</option>`).join('');
  $('#mode').value = st.mode;
  $('#l-mode').textContent = s.mode;
  $('#pov').closest('label').hidden = isChina();
  $('#l-ly-control').textContent = s.layers.control; $('#l-ly-admin').textContent = s.layers.admin;
  $('#l-layer').textContent = s.layer;
  $('#layerBox').hidden = !LAYERED.includes(st.mode); $('#overseasBox').hidden = st.mode !== 'japan'; $('#localBox').hidden = st.mode !== 'taiwan'; $('#l-lc-feud').textContent = s.local.feud; $('#l-lc-power').textContent = s.local.power; $('#toWorld').hidden = !REGIONS.includes(st.mode); $('#toWorld').textContent = s.toWorld; $('#toWorld').title = s.toWorldTip;
  $('#l-overseas').textContent = s.overseas;
  syncLayers();
  $('#projBy').innerHTML = ['surface', 'prop', 'light'].map(k => `<option value="${k}">${s.cls[k]}</option>`).join('');
  $('#projBy').value = st.projBy;
  $('#l-projBy').textContent = s.cls.by;
  $('#l-density').textContent = s.density;
  fillProjections();
  $('#base').innerHTML = BASES.map(b => `<option value="${b}" ${b === 'satellite' && !satAvailable() ? `disabled title="${s.satMissing}"` : ''}>${s.base[b]}${b === 'satellite' && !satAvailable() ? ' ⓘ' : ''}</option>`).join('');
  $('#base').value = st.basemap;
  $('#pov').innerHTML = ['defacto', ...store.meta.povs].map(p => `<option value="${p}">${s.povs[p]}</option>`).join('');
  $('#pov').value = st.pov;
  $('#play').title = st.playing ? s.pause : s.play;
  $('#back').title = s.stepBack; $('#fwd').title = s.stepFwd; $('#start').title = s.toStart;
  $('#zin').title = s.zoomIn; $('#zout').title = s.zoomOut; $('#reset').title = s.reset; $('#north').title = s.north; if (st.projection !== 'globe') syncLock(); $('#full').title = s.fullscreen;
  $('#aboutBtn').textContent = s.about; $('#aboutClose').textContent = s.close;
  // About: every data source, project, music and software with its licence (data-pipeline/credits.mjs)
  { const c = st.langInfo.col;
    $('#credits').innerHTML = CREDITS.map(sec => `<h3>${esc(sec.t[c])}</h3><table class="credits">` + sec.items.map(i =>
      `<tr><td><a href="${i.url}" target="_blank" rel="noopener">${esc(i.n[c])}</a>${i.u[c] ? `<br><small>${esc(i.u[c])}</small>` : ''}</td>` +
      `<td>${i.licUrl ? `<a href="${i.licUrl}" target="_blank" rel="noopener">${esc(i.lic[c])}</a>` : esc(i.lic[c])}</td></tr>`).join('') + '</table>').join(''); }
  $('#aboutText').textContent = s.aboutText;
  $('#countNote').textContent = s.countNote;
  $('#countBox').title = s.countNote;
  $('#trackInfo').textContent = music.current() ? `♪ ${music.current().title}` : '';
  refreshMusic();
  document.body.dataset.base = st.basemap;
}

function fillProjections() {
  const s = t(st.lang);
  const star = id => (PROJ_INFO[id]?.star ? '★ ' : '');
  const groups = [{ key: null, ids: ['globe'] }, ...grouped(st.projBy).map(g => ({ key: g.key, ids: g.ids.filter(i => i !== 'globe') }))];
  $('#projMenu .plist').innerHTML = groups.map(g => (g.key ? `<h4>${s.cls[g.key]}</h4>` : '') +
    g.ids.map(i => `<button type="button" role="option" data-p="${i}" class="${i === st.projection ? 'cur' : ''}">${star(i)}${s.proj[i]}</button>`).join('')).join('');
  $('#projBtn').textContent = star(st.projection) + s.proj[st.projection];
  $('#projMenu .plist').querySelectorAll('button').forEach(b => {
    b.onmouseenter = b.onfocus = () => projDetail(b.dataset.p);
    b.onclick = () => setProjection(b.dataset.p).then(fillProjections);       // the menu stays open to compare
  });
  projDetail(st.projection);
  projTags();
}
function toggleProjMenu() {
  const m = $('#projMenu');
  m.hidden = !m.hidden; $('#showMenu').hidden = true;
  if (!m.hidden) { projDetail(st.projection); m.querySelector('.cur')?.scrollIntoView({ block: 'nearest' }); }
}
// strengths, weaknesses, purpose and construction of a projection (hover in the menu)
function projDetail(id) {
  const s = t(st.lang), p = PROJ[id], info = PROJ_INFO[id], d = info?.[st.lang] || info?.en;
  const tags = [s.cls[p.prop], p.light ? s.cls[p.light] : null, s.cls[p.surface]].filter(Boolean).join(' · ');
  $('#projMenu .pdetail').innerHTML = `<h3>${s.proj[id]}</h3><div class="tags">${tags}${info?.star ? ' ｜ ' + s.pinfo.star : ''}</div>` +
    (d ? `<dl><dt>${s.pinfo.use}</dt><dd>${esc(d.use)}</dd><dt>${s.pinfo.pros}</dt><dd>${esc(d.pros)}</dd><dt>${s.pinfo.cons}</dt><dd>${esc(d.cons)}</dd><dt>${s.pinfo.design}</dt><dd>${esc(d.design)}</dd></dl>` : '') +
    radarSvg(id);
}
// hexagon chart: this projection's distortion scores against all the others (grey)
function radarSvg(id) {
  const AXES = ['area', 'shape', 'distance', 'coverage', 'edges', 'balance'];
  const s = t(st.lang), W = 300, H = 250, cx = 150, cy = 128, R = 88;
  const pt = (k, v) => { const a = -Math.PI / 2 + k * Math.PI / 3; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  const poly = m => AXES.map((ax, k) => pt(k, Math.max(0.04, m[ax])).map(v => v.toFixed(1)).join(',')).join(' ');
  const grid = [0.25, 0.5, 0.75, 1].map(v => `<polygon points="${AXES.map((_, k) => pt(k, v).join(',')).join(' ')}" fill="none" stroke="rgba(255,255,255,.15)"/>`).join('');
  const spokes = AXES.map((_, k) => `<line x1="${cx}" y1="${cy}" x2="${pt(k, 1)[0]}" y2="${pt(k, 1)[1]}" stroke="rgba(255,255,255,.15)"/>`).join('');
  const others = Object.entries(PROJ_METRICS).filter(([k]) => k !== id).map(([, m]) => `<polygon points="${poly(m)}" fill="none" stroke="rgba(200,210,230,.18)"/>`).join('');
  const m = PROJ_METRICS[id];
  const labels = AXES.map((ax, k) => { const [x, y] = pt(k, 1.2); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${s.metric[ax]}${m ? ' ' + Math.round(m[ax] * 100) : ''}</text>`; }).join('');
  return `<div class="radar"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(s.metricTitle)}">${grid}${spokes}${others}` +
    (m ? `<polygon points="${poly(m)}" fill="rgba(242,193,78,.35)" stroke="#f2c14e" stroke-width="2"/>` : '') + labels +
    `</svg><p>${s.metricNote}</p></div>`;
}
function projTags() {
  const s = t(st.lang), p = PROJ[st.projection];
  const tags = [s.cls[p.prop], p.light ? s.cls[p.light].replace(/（.*/, '') : null, s.cls[p.surface]].filter(Boolean);
  $('#projTags').textContent = `${s.proj[st.projection]}：${tags.join(' · ')}` + (st.basemap === 'satellite' ? ` ｜ ${s.satCredit}` : '') + reliefCredit();
}
function reliefCredit() {
  const on = st.basemap === 'physical' ? (app.reliefRegions || []).filter(r => (app.reliefIds || []).includes(r.id)) : [];
  return on.map(r => ' ｜ ' + (r.credit[st.lang] || r.credit.en)).join('');
}

function refreshMusic() {
  const s = t(st.lang);
  $('#musicBtn').classList.toggle('on', music.enabled);
  $('#musicBtn').title = s.music;
  $('#trackInfo').textContent = music.current() ? `♪ ${music.current().title} — ${music.current().credit}` : '';
  $('#trackSel').innerHTML = music.tracks.map((tr, i) => `<option value="${i}">${esc(tr.title)}</option>`).join('');
  $('#trackSel').value = String(music.i);
  $('#trackSel').title = $('#nextTrack').title = s.track;
}

// ---------------------------------------------------------------- info panel
function spanText(id) {
  const r = P.row(id);
  return `${formatYear(st.lang, r[11])} – ${r[12] >= store.meta.to ? '' : formatYear(st.lang, r[12])}`;
}
// Wikipedia in the reader's language: through Wikidata when the polity has an item, else a title search
// (which opens the article directly when the title matches)
function wikiLink(qid, title, lang = st.lang) {
  const [site, host, variant] = WIKI[lang];
  return qid ? `https://www.wikidata.org/wiki/Special:GoToLinkedPage/${site}/${qid}`
    : `https://${host}.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}${variant}`;
}
function fmtKm2(n) {
  const L = st.lang, s = t(L);
  let v;
  if (L === 'en') v = n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + ' million' : (Math.round(n / 1000) * 1000 || Math.round(n)).toLocaleString('en');
  else v = n >= 1e4 ? Math.round(n / 1e4).toLocaleString('en') + (L === 'zh-Hant' ? ' 萬' : ' 万') : Math.round(n).toLocaleString('en');
  return s.km2(v);
}
function polityChip(id, year) {
  return `<a href="#" class="chip" data-jump="${id}" data-year="${year}"><i style="background:${P.color(id)}"></i>${esc(P.name(id, st.langInfo.col))}</a>`;
}
function polityHtml(id) {
  const s = t(st.lang), r = P.row(id), f = r[5], col = st.langInfo.col;
  const name = P.name(id, col), alt = P.alt(id, st.langInfo.altCol);
  const others = LANGS.filter(l => l.id !== st.lang).map(l => `<li><b>${l.label}</b> ${esc(P.name(id, l.col))}</li>`).join('');
  const now = (frame(st).feats || []).filter(x => x.properties.p === id).reduce((a, x) => a + x.properties.area, 0) * R2;
  const [y0, y1] = [r[11], r[12]];
  const dur = y1 >= store.meta.to ? null : y1 - y0 + 1;
  const pred = (r[17] || []).map(p => polityChip(p, y0 - 1)).join(' ');
  const succ = (r[18] || []).map(p => polityChip(p, y1 + 1)).join(' ');
  const src = r[10] ? `<a href="https://www.wikidata.org/wiki/${r[10]}" target="_blank" rel="noopener">Wikidata ${r[10]}</a> · ` : '';
  return `<h2><i style="background:${r[4]}"></i>${esc(name)}</h2>
    ${alt && alt !== name ? `<p>${s.alsoKnown}：${esc(alt)}</p>` : ''}
    <table class="facts">
      <tr><th>${s.span}</th><td>${spanText(id)}${dur ? `（${s.yrs(dur)}）` : ''}</td></tr>
      ${now ? `<tr><th>${s.area}</th><td>${fmtKm2(now)}</td></tr>` : ''}
      ${r[15] ? `<tr><th>${s.peak}</th><td>${fmtKm2(r[15])}（${formatYear(st.lang, r[16])}）</td></tr>` : ''}
      ${st.mode === 'regime' ? regimeRows(id) : ''}
      ${st.mode === 'religion' ? (() => { const c = religionOf(id, st.year); const rr = c && store.religions[store.relIndex[c]];
        return `<tr><th>${s.religion}</th><td>${rr ? `<a href="#" class="rel" data-rel="${c}">${esc(rr.n[col] || rr.n[0])}</a>` : s.unknownRel}${rr && r[14] ? `（${s.inferred}）` : ''}</td></tr>`; })() : ''}
      ${pred ? `<tr><th>${s.pred}</th><td>${pred}</td></tr>` : ''}
      ${succ ? `<tr><th>${s.succ}</th><td>${succ}</td></tr>` : ''}
    </table>
    ${f & 1 ? `<p class="note">${s.nonstate}</p>` : ''}${f & 2 ? `<p class="note">${s.unrecognized}</p>` : ''}${f & 4 ? `<p class="note">${s.review}</p>` : ''}
    <p class="links">${s.links}：<a href="${wikiLink(r[10], name)}" target="_blank" rel="noopener">${s.wiki}</a>${r[10] ? '' : ` <small>(${s.wikiSearch})</small>`}</p>
    <details><summary>${s.otherNames}</summary><ul>${others}</ul></details>
    <p class="src">${s.source}：${src}<a href="https://github.com/Seshat-Global-History-Databank/cliopatria" target="_blank" rel="noopener">Seshat Cliopatria</a> (CC BY 4.0)${String(store.polities[id][0]).startsWith('NE:') ? ' · Natural Earth' : ''}<br><small>${s.extentNote}</small></p>`;
}
// clicking a predecessor / successor jumps to the year it existed and selects it
// a religion: what it is, with a Wikipedia article
function religionHtml(code) {
  const s = t(st.lang), col = st.langInfo.col, r = store.religions?.[store.relIndex[code]];
  if (!r) return '';
  const li = { 'zh-Hant': 0, 'zh-Hans': 0, en: 1, ja: 2 }[st.lang];
  const title = r.info ? (r.info.w[li] || r.info.w[1]) : (r.n[col] || r.n[0]);
  return `<h2><i style="background:${r.color}"></i>${esc(r.n[col] || r.n[0])}</h2>
    ${r.info ? `<p class="desc">${esc(r.info.d[col] || r.info.d[0])}</p>` : ''}
    <p class="links">${s.links}：<a href="${wikiLink(null, title)}" target="_blank" rel="noopener">${s.wiki}「${esc(title)}」</a></p>
    <p class="src">${s.relSrc}</p>`;
}
function showReligion(code) {
  const box = $('#info');
  delete box.dataset.disputed; box.dataset.sticky = '1';
  box.innerHTML = `<button class="x" aria-label="close">×</button>` + religionHtml(code);
  box.hidden = false;
  box.querySelector('.x').onclick = () => hideInfo();
}
// a key event on the timeline: when, what, and where to read more
// history event table (Show menu): the events of the current mode, the latest one so far highlighted;
// clicking a row jumps there. Built on mode / language change, highlighted on every frame (cheap).
function buildEvTable() {
  const box = $('#evTable'); if (!box) return;
  box.hidden = !st.evTable;
  if (!st.evTable) return;
  const s = t(st.lang), col = st.langInfo.col;
  if (isChina() && !reg()) return;
  box.dataset.mode = st.mode + st.lang;
  if (isChina()) {
    const c = reg();
    evRows = (c.events || []).map(e => { const [y, mo] = regionYearMonth(c, e.m); return { key: e.m, when: s.ym(y, mo), name: e.n[col] || e.n[0], go: () => { pause(); st.transition = 'jump'; setMonth(e.m); showEvent({ n: e.n, when: s.ym(y, mo), regional: true }); } }; });
  } else {
    evRows = EVENTS.map(e => ({ key: e.y, when: formatYear(st.lang, e.y), name: e.n[col] || e.n[0],
      go: () => { pause(); st.transition = 'jump'; setYear(e.y); showEvent({ ...e, when: formatYear(st.lang, e.y) + (e.e ? ' – ' + formatYear(st.lang, e.e) : '') }); } }));
  }
  box.innerHTML = `<div class="evhead"><b>${s.evTable}</b><button class="x" aria-label="close">×</button></div><ol>${evRows.map((r, i) =>
    `<li data-i="${i}"><span class="w">${esc(r.when)}</span><span class="n">${esc(r.name)}</span></li>`).join('')}</ol>`;
  box.querySelector('.x').onclick = () => { st.evTable = false; $('#t-evTable').checked = false; safeSet('evTable', '0'); box.hidden = true; };
  box.querySelector('ol').onclick = e => { const li = e.target.closest('li'); if (li) evRows[+li.dataset.i].go(); };
  box.dataset.cur = '';
  syncEvTable();
}
function syncEvTable() {
  const box = $('#evTable'); if (!box || !st.evTable) return;
  if (box.dataset.mode !== st.mode + st.lang) return buildEvTable();
  if (!evRows.length) return;
  const now = isChina() ? st.cm : st.year;
  let cur = -1; for (let i = 0; i < evRows.length; i++) if (evRows[i].key <= now) cur = i;
  if (box.dataset.cur === String(cur)) return;
  box.dataset.cur = String(cur);
  box.querySelectorAll('li.cur, li.past').forEach(li => li.classList.remove('cur', 'past'));
  const lis = box.querySelectorAll('li');
  for (let i = 0; i < cur; i++) lis[i].classList.add('past');
  if (cur >= 0) { lis[cur].classList.add('cur'); lis[cur].scrollIntoView({ block: 'nearest' }); }
}
function showEvent(ev) {
  const s = t(st.lang), col = st.langInfo.col, box = $('#info');
  const li = { 'zh-Hant': 0, 'zh-Hans': 0, en: 1, ja: 2 }[st.lang];
  const name = ev.n[col] || ev.n[0];
  const title = ev.w ? (ev.w[li] || ev.w[1]) : name.split(/[（(；]/)[0];
  delete box.dataset.disputed; delete box.dataset.sticky;
  box.dataset.sticky = '1';               // stays open while the timeline jumps to the event
  box.innerHTML = `<button class="x" aria-label="close">×</button>
    <h2>${esc(name)}</h2><p class="when">${esc(ev.when)}</p>
    ${ev.d ? `<p class="desc">${esc(ev.d[col] || ev.d[0])}</p>` : ''}
    <p class="links">${s.links}：<a href="${wikiLink(null, title)}" target="_blank" rel="noopener">${s.wiki}「${esc(title)}」</a></p>
    <p class="src">${ev.d ? s.eventSrc : ev.regional ? s.regionEventSrc : ''}</p>`;
  box.hidden = false;
  box.querySelector('.x').onclick = () => hideInfo();
}
function bindChips(box) {
  box.querySelectorAll('a.rel').forEach(a => a.onclick = e => { e.preventDefault(); showReligion(a.dataset.rel); });
  box.querySelectorAll('a.chip').forEach(a => a.onclick = async e => {
    e.preventDefault();
    if (isChina()) return;
    pause(); st.transition = 'jump';
    await setYear(+a.dataset.year);
    st.selected = +a.dataset.jump; showPolity(st.selected); redraw();
  });
}
function showPolity(id) {
  const box = $('#info');
  delete box.dataset.disputed; delete box.dataset.sticky;
  box.innerHTML = `<button class="x" aria-label="close">×</button>` + polityHtml(id);
  bindChips(box);
  box.hidden = false;
  box.querySelector('.x').onclick = () => { st.selected = null; hideInfo(); redraw(); };
}
function showDisputed(d, under) {
  const s = t(st.lang), q = d.properties;
  const nm = q.names?.[st.lang] || q.names?.en || q.name;
  const note = q.note || '';
  const m = note.match(/Admin\.? by ([^;]+);? ?(?:Claimed by (.+))?/i);
  const povOwner = st.pov !== 'defacto' ? q.pov?.[st.pov] : null;
  const box = $('#info');
  box.dataset.disputed = '1';
  box.innerHTML = `<button class="x" aria-label="close">×</button>
    <h2><i class="hatch"></i>${esc(nm)}</h2>
    <p class="note">${s.disputed}</p>
    ${under != null ? `<p>${s.administeredBy}：${esc(P.name(under, st.langInfo.col))}</p>` : ''}
    ${m?.[2] ? `<p>${s.claimedBy}：${esc(m[2])}</p>` : ''}
    ${povOwner != null ? `<p>${s.viewOf}「${s.povs[st.pov]}」：${esc(P.name(povOwner, st.langInfo.col))}</p>` : ''}
    <p class="src">${esc(note)} · Natural Earth</p>
    ${under != null ? '<hr>' + polityHtml(under) : ''}`;
  bindChips(box);
  box.hidden = false;
  box.querySelector('.x').onclick = () => { st.selected = null; hideInfo(); redraw(); };
}
// regional modes: what a faction / division was, with a Wikipedia article for further reading
function factionHtml(id) {
  const c = reg(), s = t(st.lang), col = st.langInfo.col;
  const fac = c.factions[id - c.offset];
  const name = P.name(id, col);
  if (!fac) {                                        // an administrative division (Taiwan admin layer)
    return `<p class="links"><a href="${wikiLink(null, name.split(/[（(]/)[0])}" target="_blank" rel="noopener">${s.wiki}：${esc(name.split(/[（(]/)[0])}</a></p>`;
  }
  const info = fac.info, li = { 'zh-Hant': 0, 'zh-Hans': 0, en: 1, ja: 2 }[st.lang];
  const desc = info ? (info.d[col] || info.d[0]) : '';
  const title = info ? (info.w[li] || info.w[0]) : name;
  return `${desc ? `<p class="desc">${esc(desc)}</p>` : ''}<p class="links">${s.links}：<a href="${wikiLink(null, title)}" target="_blank" rel="noopener">${s.wiki}「${esc(title)}」</a></p>`;
}
// a government (★) of the regional modes: when, where, who, whether it claimed to be the ROC, sources
function showGov(id) {
  const c = reg(), s = t(st.lang), col = st.langInfo.col;
  const g = c.governments.find(x => x.id === id); if (!g) return;
  const [y0, m0] = regionYearMonth(c, g.a), [y1, m1] = regionYearMonth(c, g.b);
  const end = g.b >= c.months - 1 ? '' : s.ym(y1, m1);
  const name = g.n[col] || g.n[0], fid = c.offset + g.f;
  const box = $('#info');
  delete box.dataset.disputed; delete box.dataset.sticky;
  box.innerHTML = `<button class="x" aria-label="close">×</button>
    <h2><span class="star" style="color:${g.roc ? '#1e40af' : P.color(fid)}">★</span>${esc(name)}</h2>
    ${g.roc ? `<p class="rocflag">${s.rocGovs}</p>` : ''}
    <table class="facts"><tr><th>${s.span}</th><td>${s.ym(y0, m0)} – ${end}</td></tr>
      <tr><th>${s.controller}</th><td><i class="sw" style="background:${P.color(fid)}"></i> ${esc(P.name(fid, col))}</td></tr></table>
    ${factionHtml(fid)}
    <p class="links"><a href="${wikiLink(null, name.split(/[（(]/)[0])}" target="_blank" rel="noopener">${s.wiki}：${esc(name.split(/[（(]/)[0])}</a></p>`;
  box.hidden = false;
  box.querySelector('.x').onclick = () => hideInfo();
}
// an administrative seat (◆): period, division, note, Wikipedia articles in all three languages
function showArt(id) {
  const s = t(st.lang), col = st.langInfo.col, x = (store.art || []).find(q => q.id === id); if (!x) return;
  const L = [['zh', 'zh-Hant'], ['en', 'en'], ['ja', 'ja']];
  const links = L.map(([, lang], i) => x.w[i] ? `<a href="${wikiLink(null, x.w[i], lang)}" target="_blank" rel="noopener">${esc(x.w[i])}</a>` : '').filter(Boolean).join(' · ');
  const box = $('#info');
  delete box.dataset.disputed; box.dataset.sticky = '1';
  box.innerHTML = `<button class="x" aria-label="close">×</button>
    <h2><span class="star" style="color:${ART_COLORS[x.t]}">✦</span>${esc(x.n[col] || x.n[0])}</h2>
    <table class="facts"><tr><th>${s.span}</th><td>${formatYear(st.lang, x.a)} – ${x.b >= 2026 ? '' : formatYear(st.lang, x.b)}</td></tr>
      <tr><th>${s.artTradRow}</th><td><i class="sw" style="background:${ART_COLORS[x.t]}"></i> ${s.artTrad[x.t]}</td></tr></table>
    <p class="desc">${esc(x.d[col] || x.d[0])}</p>
    <p class="links">${s.links}：${links}</p>
    <p class="src">${s.artSrc}</p>`;
  box.hidden = false;
  box.querySelector('.x').onclick = () => hideInfo();
}
function showSeat(id, kind = 'seat') {
  const c = reg(), s = t(st.lang), col = st.langInfo.col;
  const x = (kind === 'seat' ? c.seats || [] : c.local || []).find(q => q.id === id); if (!x) return;
  if (kind !== 'seat') x.d ??= -1;
  const [y0, m0] = regionYearMonth(c, x.a), [y1, m1] = regionYearMonth(c, x.b);
  const end = x.b >= c.months - 1 ? '' : s.ym(y1, m1);
  const name = x.n[col] || x.n[0], note = x.note[col] || x.note[0];
  const div = x.d >= 0 ? c.divisions[x.d] : null;
  const L = [['zh', 'zh-Hant'], ['en', 'en'], ['ja', 'ja']];
  const links = L.map(([k, lang], i) => x.w[i] ? `<a href="${wikiLink(null, x.w[i], lang)}" target="_blank" rel="noopener">${esc(x.w[i])}</a>` : '').filter(Boolean).join(' · ');
  const box = $('#info');
  delete box.dataset.disputed; box.dataset.sticky = '1';
  box.innerHTML = `<button class="x" aria-label="close">×</button>
    <h2><span class="star" style="color:${kind === 'feud' ? '#b91c1c' : kind === 'power' ? '#6b21a8' : div ? div.color : '#555'}">${{ seat: '◆', feud: '⚔', power: '◉' }[kind]}</span>${esc(name)}</h2>
    ${kind !== 'seat' ? `<p class="kind">${s.local[kind]}</p>` : ''}
    <table class="facts"><tr><th>${s.span}</th><td>${s.ym(y0, m0)} – ${end}</td></tr>
      ${div ? `<tr><th>${s.seatOf}</th><td><i class="sw" style="background:${div.color}"></i> ${esc(div.n?.[col] || div.name?.[col] || div.n?.[0] || '')}</td></tr>` : ''}</table>
    ${note ? `<p class="desc">${esc(note)}</p>` : ''}
    <p class="links">${s.links}：${links}</p>
    <p class="src">${kind === 'seat' ? s.seatSrc : s.localSrc}</p>`;
  box.hidden = false;
  box.querySelector('.x').onclick = () => hideInfo();
}
function showProvince(prov) {
  const s = t(st.lang), col = st.langInfo.col;
  const f = frame(st).feats.find(x => x.properties.prov?.id === prov.id);
  if (!f) { hideInfo(); return; }
  const { p, ctl, ctl2 } = f.properties;
  const admin = LAYERED.includes(st.mode) && st.layer === 'admin';
  const c = reg();
  const govs = frame(st).govs.filter(g => c.offset + g.f === ctl);
  const box = $('#info');
  delete box.dataset.disputed; delete box.dataset.sticky;
  box.innerHTML = `<button class="x" aria-label="close">×</button>
    <h2><i style="background:${P.color(p)}"></i>${esc(prov[st.lang] || prov.en || P.name(admin ? p : ctl, col))}</h2>
    ${admin ? `<h3>${s.division}：${esc(P.name(p, col))}</h3>${factionHtml(p)}` : ''}
    <h3><i class="sw" style="background:${P.color(ctl)}"></i>${s.controller}：${esc(P.name(ctl, col))}</h3>
    ${factionHtml(ctl)}
    ${govs.length ? `<p>${s.gov}：${govs.map(g => esc(g.n[col] || g.n[0])).join('、')}</p>` : ''}
    ${ctl2 != null ? `<h3><i class="sw" style="background:${P.color(ctl2)}"></i>${s.partly}：${esc(P.name(ctl2, col))}</h3>${factionHtml(ctl2)}` : ''}
`;
  box.hidden = false;
  box.querySelector('.x').onclick = () => { st.selected = null; app.selectedProv = null; hideInfo(); redraw(); };
}
function hideInfo() { const b = $('#info'); b.hidden = true; delete b.dataset.disputed; delete b.dataset.sticky; }
function esc(x) { return String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------------------------------------------------------------- country-count sparkline
function drawSpark() {
  const c = $('#spark'), r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (!r.width) return;
  c.width = r.width * dpr; c.height = r.height * dpr;
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, r.width, r.height);
  g.beginPath(); g.moveTo(0, r.height);
  if (isChina()) {
    // number of governments claiming to be the ROC, month by month
    const c = reg();
    const n = st.mode === 'china'
      ? m => c.governments.filter(x => x.roc && x.a <= m && m <= x.b).length / 5
      : m => new Set(Object.values(c.control).map(l => { let cur = l[0]; for (const e of l) { if (e[0] <= m) cur = e; else break; } return cur[1]; })).size / 8;
    for (let x = 0; x <= r.width; x++) g.lineTo(x, r.height - Math.min(1, n(Math.round(x / r.width * (c.months - 1)))) * (r.height - 2));
  } else {
    const counts = store.meta.counts, max = Math.max(...counts);
    for (let x = 0; x <= r.width; x++) g.lineTo(x, r.height - countFor(posToYear(x / r.width)) / max * (r.height - 2));
  }
  g.lineTo(r.width, r.height); g.closePath();
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill();
  app.sparkImg = g.getImageData(0, 0, c.width, c.height);
  drawSparkCursor();
}
function drawSparkCursor() {
  const c = $('#spark'); if (!app.sparkImg) return;
  const g = c.getContext('2d'); g.putImageData(app.sparkImg, 0, 0);
}

// ---------------------------------------------------------------- shareable URL (#y=1400&p=robinson…)
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has('y')) st.year = +h.get('y');
  if (PROJECTIONS.includes(h.get('p'))) st.projection = h.get('p');
  if (BASES.includes(h.get('b'))) st.basemap = h.get('b');
  if (h.has('v')) st.pov = h.get('v');
  if (MODES.includes(h.get('m'))) st.mode = h.get('m');
  if (h.has('t')) st.cm = +h.get('t') || 0;
  st.layers = { control: h.get('L') !== 'admin', admin: ['admin', 'both'].includes(h.get('L')) };
  st.layer = st.layers.control ? 'control' : 'admin';
  st.overseas = h.get('o') === '1';
  if (h.has('l') && LANGS.some(l => l.id === h.get('l'))) { st.lang = h.get('l'); st.langInfo = LANGS.find(l => l.id === st.lang); }
  const sp = +safeGet('speed'); if (SPEEDS.includes(sp)) st.speed = sp;
  const c = (h.get('c') || '').split(',').map(Number);
  if (c.length === 3 && c.every(isFinite)) app.initialView = { lon: c[0], lat: c[1], k: c[2] };
}
function writeHashSoon() { clearTimeout(hashT); hashT = setTimeout(writeHash, 400); }
function writeHash() {
  const v = currentView();
  const h = new URLSearchParams({ m: st.mode, t: st.cm, o: st.overseas ? 1 : 0, L: st.layers.control && st.layers.admin ? 'both' : st.layer, y: st.year, p: st.projection, b: st.basemap, v: st.pov, l: st.lang, c: [v.lon.toFixed(2), v.lat.toFixed(2), v.k.toFixed(2)].join(',') });
  history.replaceState(null, '', '#' + h.toString());
}

// ---- event system (hidden until ?events is in the URL) ----
if (eventsEnabled()) setupEvents();
async function setupEvents() {
  const L = app.eventLayer = new EventLayer(app);
  const idx = await L.loadIndex().catch(() => null); if (!idx) return;
  const box = document.createElement('label'); box.className = 'sel';
  box.innerHTML = '<span>Event</span><select id="evSel"><option value="">—</option></select>';
  $('#showMenu').append(box);
  const col = () => st.langInfo.col;
  const fill = () => { $('#evSel').innerHTML = '<option value="">—</option>' + Object.entries(idx.categories).map(([c, v]) =>
    `<optgroup label="${esc(v.name[col()] || v.name[0])}">` + idx.events.filter(e => e.category === c).map(e => `<option value="${e.id}">${esc(e.title[col()] || e.title[0])} (${e.start.slice(0, 4)})</option>`).join('') + '</optgroup>').join(''); };
  fill();
  const panel = document.createElement('div'); panel.id = 'evPlayer'; panel.hidden = true; document.body.append(panel);
  const show = () => {
    const ev = L.ev; if (!ev) { panel.hidden = true; redraw(); return; }
    const k = L.frame, c = col(), cat = idx.categories[ev.category];
    panel.hidden = false;
    panel.innerHTML = `<div class="evcat" style="background:${cat.color}">${esc(cat.name[c] || cat.name[0])}</div>
      <h3>${esc(ev.title[c] || ev.title[0])}</h3>
      <div class="evdate">${k.date} <span>(${L.i + 1}/${ev.keyframes.length})</span></div>
      <p>${esc(k.caption[c] || k.caption[0])}</p>
      <div class="evsides">${ev.sides.map(sd => `<span><i style="background:${sd.color}"></i>${esc(sd.name[c] || sd.name[0])}</span>`).join('')}</div>
      <div class="evnav"><button data-d="-1">◀</button><button data-d="1">▶</button><button data-d="x">✕</button></div>
      <div class="evsrc">${k.src.map(j => `<a href="${esc(ev.sources[j].url)}" target="_blank" rel="noopener">${esc(ev.sources[j].title)}</a>`).join('<br>')}</div>`;
    const y = +k.date.slice(0, k.date.indexOf('-', 1) > 0 ? k.date.indexOf('-', 1) : undefined);
    if (st.year !== y) setYear(y); else redraw();
  };
  panel.addEventListener('click', e => {
    const d = e.target.dataset?.d; if (!d) return;
    if (d === 'x') { L.close(); $('#evSel').value = ''; } else L.step(+d);
    show();
  });
  $('#evSel').addEventListener('change', async e => {
    if (!e.target.value) { L.close(); show(); return; }
    const ev = await L.open(e.target.value);
    if (st.mode !== 'world') await setMode('world');
    if (st.projection === 'globe') app.globe?.setCenter({ ...ev.view, k: ev.view.k * 0.7 }); else app.flat.setCenter(ev.view);
    show();
  });
}
