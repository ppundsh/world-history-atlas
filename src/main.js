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
import { geoPath, geoGraticule, geoCircle, geoDistance } from 'd3-geo';
import { Capture } from './capture.js';
import { eventInfo, eventKey, wikidataPlace } from './eventinfo.js';
import { addPulse, setPulseThumb, pulsesActive, clearPulses, removePulse, holdPulse, removePulses, setPulseSize, setPulsesPaused } from './eventdots.js';
import { loadCapitals, capitalsReady, cityThumb, capitalOf } from './capitals.js';
import { pageImage, pagePicture, figureHtml, setPageImageListener } from './pageimage.js';
import { classIconSvg } from './classicon.js';
import { loadWorks, worksFor, workTitle, workWiki, setPictureListener } from './artworks.js';
import { frame, loadRegion, REGIONS, LAYERED, regionYearMonth, monthOf, loadReligions, religionOf, religionShares, loadRegimes, regimeOf, regimeShares, REGIME_COLORS, loadArt, artActive, ART_COLORS, ART_SYM, THEMES, loadTheme, themeOf, themeActive, themeColor, setOwnPictureListener, LOCAL_COLOR, WORK_ICON, WORK_COLOR, workName, PARTY_COLOR, partyAt } from './modes.js';

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
  india: [-261, 30, 320, 606, 1206, 1526, 1707, 1858, 1947, 1971],
  spain: [722, 1031, 1212, 1492, 1580, 1714, 1808, 1936, 1975],
  italy: [1494, 1559, 1713, 1797, 1815, 1861, 1918, 1946],
  poland: [1138, 1320, 1569, 1655, 1795, 1918, 1945, 1989],
  prc: [1950, 1958, 1966, 1978, 1989, 1997, 2008, 2020],
  usa: [1664, 1763, 1776, 1803, 1848, 1861, 1898, 1941, 1969, 2001],
};
const REGION_RUN = { china: 300, taiwan: 420, japan: 900, russia: 900, korea: 900, vietnam: 900, germany: 600, india: 900, spain: 900, italy: 900, poland: 900, prc: 420, usa: 900 };        // seconds for a full run at 1×
const REGION_VIEW = { prc: { lon: 104, lat: 35.5, k: 3.2 }, usa: { lon: -97, lat: 39, k: 3.3 }, china: { lon: 106, lat: 36, k: 3.2 }, taiwan: { lon: 120.6, lat: 23.75, k: 36 }, japan: { lon: 137.5, lat: 37.5, k: 6.5 }, russia: { lon: 80, lat: 58, k: 1.9 }, korea: { lon: 127.6, lat: 39.5, k: 9 }, vietnam: { lon: 106.5, lat: 16, k: 7 }, germany: { lon: 13, lat: 51.5, k: 8 }, india: { lon: 79, lat: 22, k: 4 }, spain: { lon: -3.8, lat: 40.2, k: 6.5 }, italy: { lon: 12.5, lat: 42.3, k: 6.5 }, poland: { lon: 23, lat: 52, k: 6 } };
const REGION_FIRST = { china: '1911-10', taiwan: '1600-01' };
const MODES = ['world', 'religion', 'regime', 'art', 'language', 'finance', 'internet', 'fgo', 'china', 'prc', 'taiwan', 'japan', 'russia', 'korea', 'vietnam', 'germany', 'poland', 'italy', 'spain', 'india', 'usa'];
const BEARINGS = { n: 0, e: 90, s: 180, w: -90 };          // MapLibre bearing that puts that direction on top
// the timeline's events: the mode's own list (thematic modes that have one), otherwise the world events
function evList() {
  const T = themeOf(st.mode); if (!T?.events) return EVENTS;
  // the hidden mode keeps the world events and adds each Servant's original
  if (T.pointsAlways) return (app.evMerged?.T === T ? app.evMerged : (app.evMerged = Object.assign([...EVENTS, ...T.events.map(e => ({ ...e, servant: true }))].sort((a, b) => a.y - b.y), { T }))).slice();
  return T.events;
}
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
    minFont: safeGet('minFont') === '1', relief: safeGet('relief') === '1', evTable: safeGet('evTable') === '1', feuds: safeGet('feuds') === '1', party: false, usForces: safeGet('usForces') === '1', works: safeGet('works') === '1', network: safeGet('network') === '1', evDots: safeGet('evDots') === '1', powers: safeGet('powers') === '1', distort: false /* mask disabled for now */,
    labelsIn: safeGet('labelsIn') !== '0', capitals: safeGet('capitals') === '1', thAreas: safeGet('thAreas') !== '0', warFlows: safeGet('warFlows') === '1', thFlows: safeGet('thFlows') !== '0', thPoints: safeGet('thPoints') !== '0', artPics: safeGet('artPics') !== '0', pics: safeGet('pics') !== '0', picSize: +(safeGet('picSize') || 54), modern: safeGet('modern') === '1', events: safeGet('events') !== '0', bearing: 'n',
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
// the loading screen (styled inline in index.html): a progress bar and what is being loaded
const BOOT_MSG = { 'zh-Hant': ['讀取國家資料', '讀取這個年代的疆域', '讀取地圖底圖', '讀取模式資料', '準備地圖'], 'zh-Hans': ['读取国家资料', '读取这个年代的疆域', '读取地图底图', '读取模式资料', '准备地图'], en: ['Loading countries', 'Loading borders for this period', 'Loading the base map', 'Loading this mode', 'Preparing the map'], ja: ['国のデータを読み込み中', 'この時代の国境を読み込み中', '基図を読み込み中', 'モードのデータを読み込み中', '地図を準備中'] };
const boot = (i, frac) => {
  const m = BOOT_MSG[st.lang] || BOOT_MSG.en, el = document.getElementById('loadMsg'), bar = document.getElementById('loadBar');
  if (el) el.textContent = m[i] + '…';
  if (bar) bar.style.width = Math.round(frac * 100) + '%';
};
readHash();
boot(0, 0.08);
await loadCore();
boot(1, 0.3);
SEG[0][0] = store.meta.from;
SEG[SEG.length - 1][0] = maxYear();
st.year = Math.max(store.meta.from, Math.min(maxYear(), st.year));
st.pos = yearToPos(st.year);
await loadChunk(chunkFor(st.year));
boot(2, 0.5);
if (st.basemap === 'physical') await loadPhysical();
if (st.modern) await loadModern();
await detectSatellite();
boot(3, 0.62);
if (st.mode === 'religion') await loadReligions();
if (st.mode === 'regime') await loadRegimes();
if (st.mode === 'art') { await loadArt(); loadWorks().then(() => redraw()); }
if (THEMES.includes(st.mode)) { await loadTheme(st.mode); if (themeOf(st.mode).pictures) loadWorks(st.mode).then(() => redraw()); }
ensureCapitals();
if (REGIONS.includes(st.mode) && !app.initialView) { const v = { ...REGION_VIEW[st.mode] }; if (st.projection === 'globe') v.k *= st.mode === 'taiwan' ? 0.5 : 0.7; app.initialView = v; }
if (REGIONS.includes(st.mode)) { await loadRegion(st.mode); st.year = regionYearMonth(reg(), st.cm)[0]; await loadChunk(chunkFor(st.year)); st.pos = st.cm / (reg().months - 1); }

boot(4, 0.8);
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
boot(4, 1);
document.documentElement.classList.add('ready');
$('#loading').classList.add('done');
setTimeout(() => $('#loading')?.remove(), 500);

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
  // which way is up: the globe, and every flat map except the latitude-limited cylinders (Mercator and kin),
  // whose drawing relies on a horizontal world strip
  const turnable = isGlobe || !PROJ[st.projection]?.lat;
  $('#bearingBox').hidden = !turnable;
  if (!isGlobe) app.flat.setAngle(turnable ? BEARINGS[st.bearing] ?? 0 : 0);
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
let picT = 0;
setPictureListener(() => { clearTimeout(picT); picT = setTimeout(redraw, 120); });
setPageImageListener(() => { clearTimeout(picT); picT = setTimeout(redraw, 120); });
setOwnPictureListener(() => { clearTimeout(picT); picT = setTimeout(redraw, 120); });
app.yearTicket = 0;
app.upBearing = () => BEARINGS[st.bearing] ?? 0;
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
  const c = chunkFor(y), ticket = ++app.yearTicket;
  if (!fromSlider) st.pos = yearToPos(y);           // set first, so playback carries on from the new place
  if (!store.chunks.has(c.id)) { $('#busy').hidden = false; await loadChunk(c); $('#busy').hidden = true; }
  if (ticket !== app.yearTicket) return;            // a later position (fast dragging) has already been asked for
  st.year = y;
  // prefetch the next era
  const nc = store.meta.chunks[store.meta.chunks.indexOf(c) + 1];
  if (nc && y > c.to - 40) loadChunk(nc);
  renderYear();
}
async function setMonth(m, fromSlider = false) {
  const c = reg();
  m = Math.max(0, Math.min(c.months - 1, Math.round(m)));
  const [y] = regionYearMonth(reg(), m);
  const ch = chunkFor(y), ticket = ++app.yearTicket;
  if (!fromSlider) st.pos = m / (c.months - 1);
  if (!store.chunks.has(ch.id)) { $('#busy').hidden = false; await loadChunk(ch); $('#busy').hidden = true; }
  if (ticket !== app.yearTicket) return;
  st.cm = m; st.year = y;
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
    const ev = st.events ? evList().filter(e => e.y <= st.year && st.year <= Math.max(e.e ?? e.y, e.y + (st.year > 1800 ? 1 : 5))).at(-1) : null;
    $('#ticker').textContent = ev ? (ev.n[st.langInfo.col] || ev.n[0]) : '';
    $('#ticker').hidden = !ev;
  }
  eventPlaces();
  capitalPictures(F);
  // event pictures while playing
  const cur = currentEvent(F), ck = cur ? st.mode + cur.key : null;
  if (ck !== app.evNow) {
    const first = app.evNow === undefined; app.evNow = ck;
    if (cur && !first) popEvent(cur);                  // playing, stepping or dragging the timeline onto or just past an event
    if (st.playing) { const nx = nextEvent(); if (nx) eventInfo(nx, st.lang, st.langInfo.col).then(i => { if (i?.thumb) new Image().src = i.thumb; }); }
  }
  $('#slider').value = Math.round(st.pos * 10000);
  placeEvPop();
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
  // while the pointer is over the legend (or one of its menus is open) it is left alone, so its buttons and
  // menus can be clicked during playback; it catches up as soon as the pointer leaves
  if (!box.dataset.hoverBound) {
    box.dataset.hoverBound = '1';
    box.addEventListener('pointerenter', () => { app.legendHold = st.mode; });
    box.addEventListener('pointerleave', () => { app.legendHold = null; if (!box.querySelector('.focusmenu:not([hidden])')) renderLegend(frame(st)); });
  }
  if (app.legendHold === st.mode && !box.hidden) return;
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
      `<li data-art="${x.id}" title="${esc(s.clickInfo)}"><span style="color:${ART_COLORS[x.t]}">${ART_SYM[x.k] || '✦'}</span> ${esc(x.n[col] || x.n[0])}</li>`).join('') : `<li>${s.artNone}</li>`) +
      `</ul><p class="kinds">✦ ${s.artKinds.art}　⌂ ${s.artKinds.arch}　❖ ${s.artKinds.person}</p><ul>` + Object.entries(ART_COLORS).map(([k, c]) => `<li><i style="background:${c}"></i>${s.artTrad[k]}</li>`).join('') + `</ul><p>${s.artNote}</p>`;
    box.hidden = false;
    bindLegendToggle(box);
    box.querySelectorAll('li[data-art]').forEach(li => li.onclick = () => showArt(li.dataset.art));
  } else if (THEMES.includes(st.mode) && themeOf(st.mode)) {
    const T = themeOf(st.mode), act = themeActive(st.mode, st.year), fams = [...new Set(act.areas.map(a => a.f).concat(act.flows.map(f => f.f), act.points.map(p => p.f)))];
    const order = T.families.map(f => f.id), L = s.theme[st.mode];
    const rows = (T.pointsAlways ? act.points : act.areas).slice().sort((a, b) => order.indexOf(a.f) - order.indexOf(b.f) || a.a - b.a);
    const fx = T.focus || [];
    // the hidden mode: this year's Servants grouped directly by class, each with the works they appear in
    if (T.pointsAlways) {
      const by = order.map(f => [f, act.points.filter(p => p.f === f)]).filter(([, l]) => l.length);
      box.innerHTML = `<h3>${L.legend}</h3>` + by.map(([f, l]) => `<h4 class="clshead">${classIconSvg(f, themeColor(st.mode, f), 16)} ${esc(T.fam[f].n[col] || T.fam[f].n[0])} <small>${l.length}</small></h4><ul class="govs">`
        + l.map(p => `<li data-lang="${p.id}" title="${esc(s.clickInfo)}">${p.series ? '<span style="color:#f5b301">◎</span> ' : ''}${esc(p.n[col] || p.n[0])}${p.series ? ` <small class="works">${p.series.map(w => L.works[w]).join(' · ')}</small>` : ''}</li>`).join('') + '</ul>').join('')
        + (by.length ? '' : `<p>${s.artNone}</p>`) + `<p>${L.note}</p>`;
      box.hidden = false;
      bindLegendToggle(box);
      box.querySelectorAll('li[data-lang]').forEach(li => li.onclick = () => showLang(li.dataset.lang));
      return;
    }
    box.innerHTML = `<div class="lghead"><h3>${L.legend}</h3>${fx.length ? `<div class="focuspick"><button class="langfocus" type="button">${L.focus} ▾</button><ul class="focusmenu" hidden>${fx.map((f, i) =>
      `<li data-f="${i}">${esc(f.n[col] || f.n[0])}</li>`).join('')}</ul></div>` : ''}</div><ul class="govs">` + rows.map(a =>
      `<li data-lang="${a.id}" title="${esc(s.clickInfo)}"><span style="color:${a.color || themeColor(st.mode, a.f)}">●</span> ${esc(a.n[col] || a.n[0])}</li>`).join('') +
      `</ul>` + (T.points.some(p => p.series) ? `<h3>${L.series}</h3><ul class="govs series">` + T.points.filter(p => p.series).map(p =>
        `<li data-lang="${p.id}" title="${esc(s.clickInfo)}"><span style="color:#f5b301">◎</span> ${esc(p.n[col] || p.n[0])} <small>${p.series.map(w => L.works[w]).join(' · ')}</small></li>`).join('') + '</ul>' : '') +
      `<h3>${L.families}</h3><ul>` + order.filter(f => fams.includes(f)).map(f => `<li><i style="background:${themeColor(st.mode, f)}"></i>${esc(T.fam[f].n[col] || T.fam[f].n[0])}</li>`).join('') +
      `</ul><p>${L.note}</p>`;
    box.hidden = false;
    bindLegendToggle(box);
    box.querySelectorAll('li[data-lang]').forEach(li => li.onclick = () => showLang(li.dataset.lang));
    // quick views: move the map there and go to the year that shows it best
    const fb = box.querySelector('.langfocus'), fm = box.querySelector('.focusmenu');
    if (fb) {
      fb.onclick = e => { e.stopPropagation(); fm.hidden = !fm.hidden; };
      fm.onclick = e => {
        const li = e.target.closest('li[data-f]'); if (!li) return;
        const f = fx[+li.dataset.f]; fm.hidden = true; app.legendHold = null;
        const v = { lon: f.lon, lat: f.lat, k: f.k };
        st.projection === 'globe' ? app.globe.setCenter(v) : app.flat.setCenter(v);
        st.transition = 'jump'; setYear(f.y);
      };
    }
  } else if (st.mode === 'regime' && store.regimes) {
    const shares = regimeShares(F.feats, st.year);
    box.innerHTML = `<h3>${s.regimeLegend}</h3><ul>` + shares.map(({ k, share }) =>
      `<li><i style="background:${REGIME_COLORS[k]}"></i>${s.regimeNames[k]}<b>${(share * 100).toFixed(share < 0.01 ? 1 : 0)}%</b></li>`).join('') +
      `</ul><ul><li><i class="mstripe h2"></i>${s.monarch[2]}</li><li><i class="mstripe h1"></i>${s.monarch[1]}</li></ul><p>${s.regimeNote}</p>`;
    box.hidden = false;
    bindLegendToggle(box);
  } else if (isChina() && F.party) {
    // Taiwan's party view: how many counties / cities each party governs this month
    const c = reg(), n = new Map();
    for (const f of F.feats) { const d = f.properties.p - c.divOffset; if (!n.has(d)) n.set(d, partyAt(c, d, st.cm)); }
    const cnt = new Map(); for (const code of n.values()) if (code) cnt.set(code, (cnt.get(code) || 0) + 1);
    const pb = s.partyBy?.[st.mode] || {};
    box.innerHTML = `<h3>${pb.now || s.partyNow}</h3><ul>` + [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(([code, k]) =>
      `<li><i style="background:${PARTY_COLOR[code]}"></i>${s.parties[code]}<b>${k}</b></li>`).join('') + `</ul><p>${pb.note || s.partyNote}</p>`;
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
    const adminView = LAYERED.includes(st.mode) && st.layer === 'admin' && !F.party;
    const title = adminView ? s.adminNow : s.factionsNow;
    // divisions first; areas without a division at the time are shown by who ruled them, listed apart
    const rc = reg(), isFb = id => adminView && (id < rc.divOffset || id >= rc.divOffset + rc.divisions.length);
    const divs = facs.filter(([id]) => !isFb(id)), fbs = facs.filter(([id]) => isFb(id));
    const li = ([id]) => `<li><i style="background:${P.color(id)}"></i>${P.name(id, col)}</li>`;
    box.innerHTML = `<h3>${title}</h3>` + (divs.length ? `<ul>` + divs.map(li).join('') + `</ul>` : '') +
      (fbs.length ? `<p class="fbnote">${s.adminFallback}</p><ul class="fb">` + fbs.map(li).join('') + `</ul>` : '') + `<h3>${s.govs}</h3>` + (st.mode === 'china' ? `<p class="rockey"><i></i>${s.rocKey}</p>` : '') +
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
  // the timeline stops while the new mode loads, then carries on if it was playing (the music never stops)
  const wasPlaying = st.playing;
  if (wasPlaying) { st.playing = false; cancelAnimationFrame(rafId); }
  const prev = st.mode;
  if (isChina()) st.cmBy[prev] = st.cm;
  st.mode = mode;
  st.transition = 'jump';
  st.selected = null; app.selectedProv = null; hideInfo();
  if (app.pin && (REGIONS.includes(mode) || REGIONS.includes(prev))) unpin();   // regional maps don't share borders
  $('#relLabelsBox').hidden = mode !== 'religion';
  $('#l-labels').textContent = mode === 'religion' ? t(st.lang).labelsRel : t(st.lang).labels;
  if (mode === 'religion') await loadReligions();
  if (mode === 'regime') await loadRegimes();
  if (mode === 'art') { await loadArt(); loadWorks().then(() => redraw()); }
  modeMusic(mode, prev);
  if (THEMES.includes(mode)) { await loadTheme(mode); if (themeOf(mode).pictures) loadWorks(mode).then(() => redraw()); }
  ensureCapitals();
  $('#layerBox').hidden = !LAYERED.includes(mode); $('#overseasBox').hidden = mode !== 'japan'; $('#toWorld').hidden = !REGIONS.includes(mode); syncMarkMenu();
  if (REGIONS.includes(mode)) {
    $('#busy').hidden = false; await loadRegion(mode); $('#busy').hidden = true; syncMarkMenu();
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
    if (mode === 'internet' && st.year < 1837) st.year = 1990;      // nothing to see before the telegraph
    buildTicks(); drawSpark();
    await setYear(st.year);
  }
  if (st.relief) app.globe?.applyBasemap();
  buildEvTable();
  app.globe?.update(true);
  writeHash();
  if (wasPlaying && !st.playing) { st.playing = true; lastT = performance.now(); rafId = requestAnimationFrame(tick); }
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
    marks = c.events.map(e => { const [y, mo] = regionYearMonth(c, e.m); return { ...e, regional: true, a: e.m / (c.months - 1), b: e.m / (c.months - 1), n: e.n, when: t(st.lang).ym(y, mo) }; });
  } else {
    marks = evList().map(e => ({ ...e, a: yearToPos(e.y), b: yearToPos(e.e ?? e.y),
      when: formatYear(st.lang, e.y) + (e.e ? ' – ' + formatYear(st.lang, e.e) : '') }));
  }
  app.eventMarks = marks;
  box.innerHTML = marks.map((m, i) => `<i class="${m.big ? 'big' : ''}${m.k ? ' work' : ''}" style="left:${m.a * 100}%;width:calc(${(m.b - m.a) * 100}% + 3px)${m.k ? ';background:' + WORK_COLOR[m.k] : ''}" data-ev="${i}"></i>`).join('');
  // hovering the timeline previews the nearest event (within a few pixels) with its picture
  // the whole track (slider and marks) previews; the marks themselves are thin
  const track = box.parentElement;
  track.onpointermove = e => {
    if (e.pointerType !== 'mouse' || e.buttons) return hoverEvent(null);
    const r = box.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, tol = 14 / r.width;
    let best = null, bd = tol;
    for (const m of app.eventMarks) { const d = x < m.a ? m.a - x : x > m.b ? x - m.b : 0; if (d <= bd) { bd = d; best = m; } }
    hoverEvent(best, best?.when, e, true);
  };
  track.onpointerleave = () => hoverEvent(null);
}
// a small card with the event's name and picture that follows the mouse
function hoverEvent(ev, when, e, above) {
  const card = $('#evHover');
  if (!ev) { card.hidden = true; app.hoverKey = null; return; }
  const col = st.langInfo.col, key = eventKey(ev, st.lang);
  if (key !== app.hoverKey) {
    app.hoverKey = key;
    card.innerHTML = `<div class="pic"></div><div class="cap"><small>${esc(when || '')}</small>${esc(workName(ev, col))}</div>`;
    card.classList.remove('haspic');
    eventInfo(ev, st.lang, col).then(info => {
      if (app.hoverKey !== key || !info?.thumb || !st.pics) return;
      const img = new Image(); img.alt = '';
      img.onload = () => { if (app.hoverKey !== key) return; card.querySelector('.pic').append(img); card.classList.add('haspic'); place(); };
      img.src = info.thumb;
    });
  }
  card.hidden = false;
  app.hoverXY = [e.clientX, e.clientY, above];
  const place = () => {
    const [x, y, up] = app.hoverXY, w = card.offsetWidth, h = card.offsetHeight;
    const left = Math.max(6, Math.min(innerWidth - w - 6, x + (up ? -w / 2 : 16)));
    const top = up ? Math.max(6, y - h - 16) : Math.max(6, Math.min(innerHeight - h - 6, y + 16));
    card.style.left = left + 'px'; card.style.top = top + 'px';
  };
  place();
}

function play() {
  if (st.playing) return;
  if (st.pos >= 1) setPos(0);
  st.playing = true; lastT = performance.now();
  setPulsesPaused(false);
  if (!$('#evPop').hidden && !$('#evPop').classList.contains('fade')) { clearTimeout(app.popT); app.popT = setTimeout(() => $('#evPop').classList.add('fade'), 4500); }
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
// the 標記 menu: general markers, then the switches that belong to the current mode (hidden elsewhere)
// world capitals come from Wikidata the first time a world map with capitals is shown
function ensureCapitals() {
  if (capitalsReady() || REGIONS.includes(st.mode) || !store.polities) return;   // a small bundled file; also used by pinned cards
  loadCapitals(store.polities.map(r => r[10]).filter(Boolean)).then(() => redraw());
}
// a capital that appears while the timeline moves shows a picture of the city for a few seconds; when the
// capital goes, its picture goes with it at once
function capitalPictures(F) {
  const now = new Map();
  for (const m of F.markers || []) if (m.kind === 'cap' || m.kind === 'gov') now.set(m.kind + ':' + m.id + ':' + (m.cap || m.lon + ',' + m.lat), m);
  const prev = app.capPrev, mode = app.capMode; app.capPrev = now; app.capMode = st.mode;
  if (!prev || mode !== st.mode) return;
  for (const k of prev.keys()) if (!now.has(k)) removePulse('cap:' + k);
  if (!st.capitals || !st.evDots || !st.pics) return;
  // only capital cities get a picture: a seat of government (★ in the regional modes) is named after the
  // government, whose Wikipedia picture is an emblem or flag rather than the place
  const fresh = [...now.entries()].filter(([k, m]) => !prev.has(k) && m.kind === 'cap');
  if (!fresh.length || fresh.length > 8) return;              // a big jump: no flood of pictures
  const col = st.langInfo.col;
  for (const [k, m] of fresh.slice(0, 3)) {
    const key = 'cap:' + k, name = (m.text[col] || m.text[0] || '').split(/[（(]/)[0];
    addPulse({ key, cap: true, lon: m.lon, lat: m.lat, name: '', polity: m.id }); dotLoop();
    if (!st.pics) { /* pictures off */ }
    else if (m.img) cityThumb(m.img).then(t => t && st.pics && setPulseThumb(key, t.url, redraw, t.credit));
    else eventInfo({ n: [name, name, name, name] }, st.lang, col).then(i => i?.thumb && st.pics && setPulseThumb(key, i.thumb, redraw, [i.author, i.lic].filter(Boolean).join(' · ')));
  }
}
function syncMarkMenu() {
  const s = t(st.lang); let any = false;
  for (const el of $('#modeMarks').querySelectorAll('[data-modes]')) { const on = el.dataset.modes.split(' ').includes(st.mode); el.hidden = !on; any ||= on; }
  $('#modeMarks').hidden = !any;
  $('#l-markMode').textContent = s.markMode(s.modes[st.mode] || '');
  const th = s.theme[st.mode];
  if (th) { $('#l-thAreas').textContent = th.areas; $('#l-thFlows').textContent = th.flows; $('#l-thPoints').textContent = th.points; }
  syncLocalLabels();
}
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
  setPulsesPaused(true); clearTimeout(app.popT);              // pictures stay while the timeline is paused
  $('#play').classList.remove('on'); $('#play').title = t(st.lang).play;
  music.pause();                               // music follows the timeline
}
async function tick(now) {
  if (!st.playing) return;
  if (isChina()) st.mps = Math.max(0.5, reg().months / REGION_RUN[st.mode] * (st.speed || 1));   // months per second, for the arrows' timing
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
    // at the end the player stays in its playing state (and the music keeps going) until paused or moved back
  }
  rafId = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- UI
function buildUI() {
  $('#lang').innerHTML = LANGS.map(l => `<option value="${l.id}">${l.label}</option>`).join('');
  $('#lang').value = st.lang;
  $('#lang').onchange = e => { st.lang = e.target.value; st.langInfo = LANGS.find(l => l.id === st.lang); safeSet('lang', st.lang); applyLang(); renderYear(); };
  $('#projBtn').onclick = e => { e.stopPropagation(); toggleProjMenu(); };
  $('#showBtn').onclick = e => { e.stopPropagation(); $('#showMenu').hidden = !$('#showMenu').hidden; $('#projMenu').hidden = true; $('#markMenu').hidden = true; };
  $('#showMenu').onclick = e => e.stopPropagation();
  $('#markBtn').onclick = e => {
    e.stopPropagation(); const m = $('#markMenu'); m.hidden = !m.hidden; $('#projMenu').hidden = true; $('#showMenu').hidden = true;
    // keep the menu on screen: open to the left when it would run past the right edge
    m.style.left = '0'; m.style.right = 'auto';
    if (!m.hidden && m.getBoundingClientRect().right > innerWidth - 4) { m.style.left = 'auto'; m.style.right = '0'; }
  };
  $('#markMenu').onclick = e => e.stopPropagation();
  $('#projMenu').onclick = e => e.stopPropagation();
  document.addEventListener('click', () => { $('#projMenu').hidden = true; $('#showMenu').hidden = true; $('#markMenu').hidden = true; });
  $('#relLabels').onchange = e => { st.relLabels = e.target.value; safeSet('relLabels', st.relLabels); redraw(); app.globe?.map?.triggerRepaint(); };
  $('#bearing').onchange = e => {
    st.bearing = e.target.value;
    if (st.projection === 'globe') app.globe?.setBearing(BEARINGS[st.bearing] ?? null); else app.flat.setAngle(BEARINGS[st.bearing] ?? 0);
    writeHashSoon();
  };
  app.onAngle = a => { st.bearing = a ? st.bearing : 'n'; $('#bearing').value = st.bearing; };
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
  for (const k of ['labels', 'labelsIn', 'capitals', 'artPics', 'evDots', 'warFlows', 'thAreas', 'thFlows', 'thPoints', 'borders', 'rivers', 'graticule', 'modern', 'distort', 'relief', 'twCompare', 'evTable', 'minFont', 'animate', 'events']) {
    const el = $('#t-' + k); el.checked = st[k];
    el.onchange = async () => {
      st[k] = el.checked;
      if (['modern', 'minFont', 'animate', 'events', 'relief', 'labelsIn', 'distort', 'evTable', 'capitals', 'artPics', 'evDots', 'warFlows', 'thAreas', 'thFlows', 'thPoints'].includes(k)) safeSet(k, el.checked ? '1' : '0');
      if (k === 'distort') syncDistort();
      if (k === 'capitals') ensureCapitals();
      // switching event places (or capitals) off removes the pictures already on the map at once
      if (k === 'evDots' && !el.checked) { clearPulses(); holdPulse(null); $('#evPop').hidden = true; $('#evPop').classList.remove('show'); app.popKey = null; }
      if (k === 'capitals' && !el.checked) removeCapitalPulses();
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
  // phones: the music controls move into the menu (the player keeps only transport, year and speed)
  { const mq = matchMedia('(max-width: 860px)');
    // phones: the music player folds into one line of the menu, and the year and speed join the transport bar
    const place = () => {
      const m = $('#music'), side = $('#timeline .side'), bar = $('#timeline .buttons');
      $('#musicFold').hidden = !mq.matches;
      (mq.matches ? $('#musicSlot') : side).appendChild(m);
      const ys = [$('#yearInput'), $('#speed').closest('label')];
      if (mq.matches) bar.append(...ys); else side.prepend(...ys);
    };
    $('#musicToggle').onclick = () => { const slot = $('#musicSlot'); slot.hidden = !slot.hidden; $('#musicToggle').classList.toggle('open', !slot.hidden); };
    place(); mq.addEventListener('change', place); }
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
  for (const [el, k] of [['#lc-feud', 'feuds'], ['#lc-power', 'powers'], ['#lc-us', 'usForces'], ['#lc-works', 'works'], ['#lc-network', 'network']]) {
    $(el).checked = !!st[k];
    $(el).onchange = e => { st[k] = e.target.checked; safeSet(k, st[k] ? '1' : '0'); app.globe?.update(true); redraw(); };
  }
  // Taiwan: counties and cities coloured by the party of their head
  $('#ly-party').onchange = e => { st.party = e.target.checked; st.transition = 'jump'; st.selected = null; app.selectedProv = null; hideInfo(); app.globe?.update(true); renderYear(); writeHash(); };
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
  $('#picSize').value = st.picSize;
  $('#picSize').oninput = e => { st.picSize = +e.target.value; safeSet('picSize', e.target.value); setPulseSize(st.picSize); syncPicSize(); redraw(); };
  setPulseSize(st.picSize); syncPicSize();
  // one switch for every picture: on the map, above the timeline, in the previews and in the cards
  $('#t-pics').checked = st.pics;
  document.documentElement.classList.toggle('nopics', !st.pics);
  $('#t-pics').onchange = e => {
    st.pics = e.target.checked; safeSet('pics', st.pics ? '1' : '0');
    document.documentElement.classList.toggle('nopics', !st.pics);
    $('#picSize').closest('label').hidden = !st.pics;
    if (!st.pics) { clearPulses(); holdPulse(null); $('#evPop').hidden = true; $('#evPop').classList.remove('show'); app.popKey = null; hoverEvent(null); }
    app.globe?.update(true); redraw();
  };
  $('#picSize').closest('label').hidden = !st.pics;
  // screenshot and recording (with the music)
  app.capture = new Capture({ stage: $('#stage'), music, info: () => {
    const s = t(st.lang);
    return { title: s.title, mode: $('#mode').selectedOptions[0]?.textContent || '', year: $('#yearBig').textContent, credit: s.capCredit + ' · ' + location.host + location.pathname };
  } });
  const capName = () => `atlas-${st.mode}-${($('#yearBig').textContent || '').replace(/[^\w\u3000-\u9fff-]+/g, '')}`;
  $('#shotBtn').onclick = () => app.capture.screenshot(capName()).catch(() => alert(t(st.lang).capFail));
  const recStop = () => { app.capture.stop(); $('#recBar').hidden = true; $('#recBtn').classList.remove('on'); };
  // ⏺ opens a small menu: include the music or not, then start
  $('#recMusic').checked = safeGet('recMusic') !== '0';
  $('#recMusic').onchange = e => safeSet('recMusic', e.target.checked ? '1' : '0');
  $('#recBtn').onclick = () => {
    if (app.capture.recording) return recStop();
    if (!app.capture.supported()) return alert(t(st.lang).capNoRec);
    const b = $('#recBtn'), z = $('#zoomCtl'), row = getComputedStyle(z).flexDirection === 'row';
    $('#recMenu').style.top = row ? '' : (z.offsetTop + b.offsetTop - 8) + 'px';
    $('#recMenu').hidden = !$('#recMenu').hidden;
  };
  $('#recGo').onclick = () => {
    $('#recMenu').hidden = true;
    try { app.capture.start(capName(), sec => { $('#recTime').textContent = `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`; }, $('#recMusic').checked && music.tracks.length > 0); }
    catch { return alert(t(st.lang).capFail); }
    $('#recBar').hidden = false; $('#recBtn').classList.add('on');
  };
  $('#recStop').onclick = recStop;
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
  $('#nextTrack').onclick = () => { music.next(st.mode); refreshMusic(); };
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
    st.transition = 'jump'; setPos(ev.a); showEvent(ev); pulseEvent(ev);      // jumping keeps playing or paused as it was
  };
  document.addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
    if (e.code === 'Space') { e.preventDefault(); st.playing ? pause() : play(); }
    if (e.key === ',' || e.key === '<') step(-1);
    if (e.key === '.' || e.key === '>') step(1);
    if (e.key === 'Escape') { st.selected = null; hideInfo(); redraw(); }
  });
  app.onSelect = hit => {
    if (hit?.pulse) { openPulse(hit.pulse); return; }
    if (hit?.line) { hit.line.kind === 'work' ? showWork(hit.line.id) : showCable(hit.line.id); return; }
    if (hit?.marker) { hit.marker.kind === 'gov' ? showGov(hit.marker.id) : hit.marker.kind === 'art' ? showArt(hit.marker.id) : hit.marker.kind === 'lang' || hit.marker.kind === 'langArea' ? showLang(hit.marker.id) : hit.marker.kind === 'cap' ? (st.selected = hit.marker.id, showPolity(hit.marker.id), redraw()) : hit.marker.kind === 'work' ? showWork(hit.marker.id) : showSeat(hit.marker.id, hit.marker.kind); return; }
    app.selectedProv = null;
    if (!hit) { st.selected = null; hideInfo(); redraw(); return; }
    if (hit.prov) { st.selected = hit.polity; app.selectedProv = hit.prov; showProvince(hit.prov); }
    else if (hit.disputed) { st.selected = hit.polity; showDisputed(hit.disputed, hit.polity); }
    else { st.selected = hit.polity; showPolity(hit.polity); }
    addPinButton();
    redraw();
  };
  let hoverT = 0;
  app.onHover = (hit, e) => {
    holdPulse(hit?.pulse || null);
    const now = performance.now(); if (now - hoverT < 60) return; hoverT = now;
    const tip = $('#tooltip');
    $('#stage').style.cursor = hit?.marker || hit?.pulse || hit?.line ? 'pointer' : '';
    if (hit?.marker || hit?.pulse || hit?.line) {
      tip.textContent = (hit.pulse ? hit.pulse.name || hit.pulse.title || '' : hit.line ? hit.line.name || '' : hit.marker.text[st.langInfo.col] || hit.marker.text[0]) + ' · ' + t(st.lang).clickInfo;
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
    ['#l-modern', 'modern'], ['#l-relief', 'reliefOpt'], ['#l-distort', 'distort'], ['#l-twCompare', 'twCompare'], ['#l-evTable', 'evTable'], ['#l-distortStr', 'distortStr'], ['#l-labelsIn', 'labelsIn'], ['#l-capitals', 'capitals'], ['#l-artPics', 'artPics'], ['#l-evDots', 'evDots'], ['#l-warFlows', 'warFlows'], ['#recStop', 'capStop'], ['#l-recMusic', 'capMusic'], ['#recGo', 'capGo'], ['#l-minFont', 'minFont'], ['#l-animate', 'animate'], ['#l-events', 'events'], ['#l-bearing', 'bearing'], ['#l-relLabels', 'relLabels'], ['#showBtn', 'show']]) $(id).textContent = s[key];
  $('#showBtn').textContent = s.show + ' ▾';
  $('#relLabels').innerHTML = ['religion', 'both', 'country'].map(k => `<option value="${k}">${s.relLabelOpts[k]}</option>`).join('');
  $('#relLabels').value = st.relLabels;
  $('#relLabelsBox').hidden = st.mode !== 'religion';
  $('#l-labels').textContent = st.mode === 'religion' ? s.labelsRel : s.labels;
  $('#bearing').innerHTML = ['n', 'e', 's', 'w', 'free'].map(k => `<option value="${k}" ${k === 'free' ? 'hidden' : ''}>${s.bearings[k]}</option>`).join('');
  $('#bearing').value = st.bearing;
  buildEventMarks();
  // world-wide modes, then the regional ones, in two labelled groups
  const opt = m => `<option value="${m}">${s.modes[m]}</option>`;
  const hidden = m => m === 'fgo' && !app.fgoOn && st.mode !== 'fgo';     // the hidden mode is listed once unlocked
  $('#mode').innerHTML = `<optgroup label="${s.modeGroups[0]}">${MODES.filter(m => !REGIONS.includes(m) && !hidden(m)).map(opt).join('')}</optgroup>`
    + `<optgroup label="${s.modeGroups[1]}">${MODES.filter(m => REGIONS.includes(m)).map(opt).join('')}</optgroup>`;
  $('#mode').value = st.mode;
  $('#l-mode').textContent = s.mode;
  $('#pov').closest('label').hidden = isChina();
  $('#l-ly-control').textContent = s.layers.control; $('#l-ly-admin').textContent = s.layers.admin;
  $('#l-layer').textContent = s.layer;
  $('#layerBox').hidden = !LAYERED.includes(st.mode); $('#overseasBox').hidden = st.mode !== 'japan'; syncMarkMenu(); $('#toWorld').hidden = !REGIONS.includes(st.mode); $('#toWorld').textContent = s.toWorld; $('#toWorld').title = s.toWorldTip;
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
  $('#t-twCompare').closest('label').title = s.twInspired;
  $('#capSwitch').title = s.capitalsTip; $('#t-artPics').closest('label').title = s.artPicsTip;
  $('#markBtn').textContent = s.marks + ' ▾'; $('#l-markGeneral').textContent = s.markGeneral; $('#l-picSize').textContent = s.picSize; $('#l-pics').textContent = s.picsL;
  syncMarkMenu();
  $('#dotSwitch').title = s.evDotsTip; $('#shotBtn').title = s.capShot; $('#recBtn').title = s.capRec;
  if (app.pin) renderPin();
  $('#aboutBtn').textContent = s.about; $('#aboutClose').textContent = s.close; $('#aboutTitle').textContent = s.about;
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
  $('#projMenu .pdetail').innerHTML = `<h3>${s.proj[id]}</h3><div class="tags">${tags}${info?.star ? ' ｜ ' + s.pinfo.star : ''}</div>` + projThumb(id) +
    (d ? `<dl><dt>${s.pinfo.use}</dt><dd>${esc(d.use)}</dd><dt>${s.pinfo.pros}</dt><dd>${esc(d.pros)}</dd><dt>${s.pinfo.cons}</dt><dd>${esc(d.cons)}</dd><dt>${s.pinfo.design}</dt><dd>${esc(d.design)}</dd></dl>` : '') +
    radarSvg(id);
}
// a small vector drawing of the whole map in this projection: sea, graticule every 30° and land (1:110m)
function projThumb(id) {
  const thumbCache = (projThumb.cache ||= new Map());      // created on first use (called while the UI is built)
  if (thumbCache.has(id)) return thumbCache.get(id);
  const p = PROJ[id], W = 240, H = 140;
  let svg = '';
  try {
    const proj = p.globe ? (PROJ.orthographic.make)().rotate([-100, -25]) : p.make();
    let outline = { type: 'Sphere' };
    if (p.lat) outline = geoGraticule().extentMajor([[-180, p.lat[0]], [180, p.lat[1]]]).outline();
    if (p.clip || p.globe) { proj.rotate([-100, -25]).clipAngle(p.clip || 90); outline = geoCircle().center([100, 25]).radius(p.clip || 90)(); }
    proj.precision(0.5).fitExtent([[4, 4], [W - 4, H - 4]], outline);
    if (p.lat) proj.clipExtent([[4, 4], [W - 4, H - 4]]);
    const path = geoPath(proj).digits(1);
    const land = store.coarse?.land;
    svg = `<svg class="pthumb" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t(st.lang).proj[id] || id)}">
      <path d="${path(outline)}" fill="#cfe3f3" stroke="#6b8fb3" stroke-width="1"/>
      <path d="${path(geoGraticule().step([30, 30])())}" fill="none" stroke="#9db8d1" stroke-width="0.5"/>
      ${land ? `<path d="${path(land)}" fill="#e8dcc0" stroke="#a08b5c" stroke-width="0.4"/>` : ''}
      <path d="${path(outline)}" fill="none" stroke="#33506e" stroke-width="1.2"/></svg>`;
  } catch { svg = ''; }
  if (store.coarse?.land) thumbCache.set(id, svg);
  return svg;
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

// a mode with its own track (tracks.json "mode") switches to it; leaving it goes back to the earlier track
function modeMusic(mode, prev) {
  if (!music.tracks.length) return;
  const own = music.tracks.findIndex(t => t.mode === mode);
  if (own >= 0 && music.i !== own) { app.trackBefore = music.i; music.select(own); }
  else if (own < 0 && music.tracks[music.i]?.mode) music.select(app.trackBefore ?? music.usable(mode)[0]);
  refreshMusic();
}
function refreshMusic() {
  const s = t(st.lang);
  $('#musicBtn').classList.toggle('on', music.enabled);
  $('#musicBtn').title = s.music; $('#musicToggle').textContent = '♫ ' + s.music;
  $('#trackInfo').textContent = music.current() ? `♪ ${music.current().title} — ${music.current().credit}` : '';
  $('#trackSel').innerHTML = music.usable(st.mode).map(i => `<option value="${i}">${esc(music.tracks[i].title)}</option>`).join('');
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
    evRows = (c.events || []).map(e => { const [y, mo] = regionYearMonth(c, e.m); return { key: e.m, when: s.ym(y, mo), name: workName(e, col), ev: { ...e, regional: true }, go: () => { st.transition = 'jump'; setMonth(e.m, false); showEvent({ ...e, when: s.ym(y, mo), regional: true }); pulseEvent({ ...e, regional: true }); } }; });
  } else {
    evRows = evList().map(e => ({ key: e.y, when: formatYear(st.lang, e.y), name: e.n[col] || e.n[0], ev: e,
      go: () => { st.transition = 'jump'; setYear(e.y); pulseEvent(e); showEvent({ ...e, when: formatYear(st.lang, e.y) + (e.e ? ' – ' + formatYear(st.lang, e.e) : '') }); } }));
  }
  box.innerHTML = `<div class="evhead"><b>${s.evTable}</b><input class="evfilter" type="search" placeholder="${esc(s.evFilter)}" value="${esc(app.evFilter || '')}"><button class="x" aria-label="close">×</button></div><ol>${evRows.map((r, i) =>
    `<li data-i="${i}"><span class="w">${esc(r.when)}</span><span class="n">${esc(r.name)}</span></li>`).join('')}</ol>`;
  box.querySelector('.x').onclick = () => { st.evTable = false; $('#t-evTable').checked = false; safeSet('evTable', '0'); box.hidden = true; };
  // filter as you type; "fgo" + Enter opens the hidden mode
  const fi = box.querySelector('.evfilter');
  const filter = () => {
    const q = fi.value.trim().toLowerCase(); app.evFilter = fi.value;
    box.querySelectorAll('ol li').forEach((li, i) => { const r = evRows[i]; li.hidden = !!q && !(r.name + ' ' + r.when).toLowerCase().includes(q); });
  };
  fi.oninput = filter;
  fi.onkeydown = e => {
    e.stopPropagation();
    if (e.key === 'Enter' && fi.value.trim().toLowerCase() === 'fgo') {
      fi.value = ''; app.evFilter = ''; app.fgoOn = true; applyLang(); $('#mode').value = 'fgo'; setMode('fgo');
    }
  };
  fi.onpointerdown = e => e.stopPropagation();          // typing in the box does not drag the panel
  if (app.evFilter) filter();
  box.insertAdjacentHTML('beforeend', '<div class="evgrip" aria-hidden="true"></div>');
  movableBox(box, box.querySelector('.evhead'), box.querySelector('.evgrip'), 'evBox');
  box.querySelector('ol').onclick = e => { const li = e.target.closest('li'); if (li) evRows[+li.dataset.i].go(); };
  const ol = box.querySelector('ol');
  ol.onpointermove = e => { const li = e.target.closest('li'); if (e.pointerType !== 'mouse' || !li) return hoverEvent(null); const r = evRows[+li.dataset.i]; hoverEvent(r.ev, r.when, e); };
  ol.onpointerleave = () => hoverEvent(null);
  box.dataset.cur = '';
  syncEvTable();
}
// a floating panel that can be dragged by its header and resized from its corner (mouse or touch);
// the place and size are remembered and kept inside the map area
function movableBox(box, handle, grip, store) {
  const stage = $('#stage');
  const apply = g => {
    if (!g) return;
    const W = stage.clientWidth, H = stage.clientHeight;
    const w = Math.max(200, Math.min(W - 8, g.w)), h = Math.max(140, Math.min(H - 8, g.h));
    Object.assign(box.style, { width: w + 'px', height: h + 'px', maxHeight: 'none', right: 'auto', bottom: 'auto',
      left: Math.max(4, Math.min(W - w - 4, g.l)) + 'px', top: Math.max(4, Math.min(H - h - 4, g.t)) + 'px' });
  };
  let saved = null; try { saved = JSON.parse(safeGet(store) || 'null'); } catch { /* ignore */ }
  apply(saved);
  const geom = () => ({ l: box.offsetLeft, t: box.offsetTop, w: box.offsetWidth, h: box.offsetHeight });
  const drag = (el, move) => el.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    const g0 = geom(), x0 = e.clientX, y0 = e.clientY;
    const mv = ev => apply(move(g0, ev.clientX - x0, ev.clientY - y0));
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); safeSet(store, JSON.stringify(geom())); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
  drag(handle, (g, dx, dy) => ({ ...g, l: g.l + dx, t: g.t + dy }));
  drag(grip, (g, dx, dy) => ({ ...g, w: g.w + dx, h: g.h + dy }));
  if (!box.dataset.fit) { box.dataset.fit = '1'; addEventListener('resize', () => { try { apply(JSON.parse(safeGet(store) || 'null')); } catch { /* ignore */ } }); }
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
    <h2>${ev.k ? `<span class="star" style="color:${WORK_COLOR[ev.k]}">${WORK_ICON[ev.k]}</span>` : ''}${esc(name)}</h2><p class="when">${esc(ev.when)}</p>
    ${ev.d ? `<p class="desc">${esc(ev.d[col] || ev.d[0])}</p>` : ''}
    <p class="links">${s.links}：<a href="${wikiLink(null, title)}" target="_blank" rel="noopener">${s.wiki}「${esc(title)}」</a></p>
    <div class="evinfo"></div>
    <p class="src">${ev.d ? s.eventSrc : ev.regional ? s.regionEventSrc : ''}</p>`;
  box.hidden = false;
  box.querySelector('.x').onclick = () => hideInfo();
  const key = eventKey(ev, st.lang); box.dataset.ev = key;
  eventInfo(ev, st.lang, col).then(info => {
    const slot = box.querySelector('.evinfo'); if (!info || !slot || box.dataset.ev !== key) return;
    const a = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`;
    slot.innerHTML = (info.thumb && st.pics ? `<figure class="evpic"><a href="${esc(info.page)}" target="_blank" rel="noopener"><img src="${esc(info.thumb)}" alt=""></a>
        <figcaption>${s.artPhoto}：${esc(info.author || '—')} · ${esc(info.lic || '')} · ${a(info.page, 'Wikimedia Commons')}</figcaption></figure>` : '')
      + (!ev.d && info.extract ? `<p class="desc">${esc(info.extract)}</p><p class="src">${s.wikiExcerpt(a(info.url, info.title))}</p>` : '');
  });
}
// when the timeline reaches an event (playing, stepping or dragging) that has a picture, show it for a while, then fade it out;
// the next event's picture replaces it at once
function popEvent(ev) {
  const key = eventKey(ev, st.lang), col = st.langInfo.col, box = $('#evPop');
  app.popKey = key;
  eventInfo(ev, st.lang, col).then(info => {
    if (app.popKey !== key || !info?.thumb || !st.pics) return;
    const img = new Image();
    img.onload = () => {
      if (app.popKey !== key) return;
      box.innerHTML = `<img src="${esc(info.thumb)}" alt=""><div class="cap">${esc(ev.n[col] || ev.n[0])}<small>${esc(info.author || '')}${info.lic ? ' · ' + esc(info.lic) : ''} · Wikimedia Commons</small></div>`;
      box.hidden = false; placeEvPop(); box.classList.remove('fade'); void box.offsetWidth; box.classList.add('show');
      clearTimeout(app.popT); if (st.playing) app.popT = setTimeout(() => box.classList.add('fade'), 4500);
      box.onclick = () => showEvent({ ...ev, when: $('#yearBig').textContent });
    };
    img.src = info.thumb;
  });
}
// the event picture sits right above the timeline's current position
function placeEvPop() {
  const box = $('#evPop'); if (box.hidden) return;
  const sl = $('#slider').getBoundingClientRect(), sr = $('#stage').getBoundingClientRect(), w = box.offsetWidth;
  const x = sl.left - sr.left + st.pos * sl.width;
  const left = Math.max(6, Math.min(sr.width - w - 6, x - w / 2));
  box.style.left = left + 'px';
  box.style.setProperty('--arrow', Math.max(10, Math.min(w - 10, x - left)) + 'px');
}
// ---------------------------------------------------------------- event places
// Moving forward along the timeline (playing, stepping or dragging) past events marks where they happened.
// Places come from the event list (regional modes, Taiwan's feuds) or from Wikipedia / Wikidata.
function eventPlaces() {
  const now = isChina() ? st.cm : st.year, prev = app.dotPrev, mode = app.dotMode;
  // pictures of events the timeline has left behind (jumped back, or far ahead) go at once, even while paused
  removePulses(p => p.when != null && (p.when > now || now - p.when > (isChina() ? 36 : 12)));
  app.dotPrev = now; app.dotMode = st.mode;
  if (mode !== st.mode) { clearPulses(); return; }
  if (!st.evDots || prev == null || now <= prev) return;
  let list;
  if (isChina()) {
    const c = reg(); if (!c) return;
    list = (c.events || []).map(e => ({ ...e, t: e.m, regional: true }));
    if (st.mode === 'taiwan' && st.feuds) list = list.concat((c.local || []).filter(x => x.kind === 'feud').map(x => ({ n: x.n, t: x.a, m: x.a, lon: x.lon, lat: x.lat, feud: true })));
  } else list = evList().map(e => ({ ...e, t: e.y }));
  const crossed = list.filter(e => e.t > prev && e.t <= now).sort((a, b) => a.t - b.t).slice(-3);
  for (const e of crossed) pulseEvent(e);
}
// mark one event's place (from its own coordinates, else Wikipedia / Wikidata), with its picture when there is one
function pulseEvent(e) {
  if (!st.evDots || e.servant) return;              // a Servant is already on the map with its portrait
  const col = st.langInfo.col, view = REGION_VIEW[st.mode];
  const t0 = e.t ?? e.m ?? e.y, key = st.mode + ':' + t0 + ':' + e.n[0], name = (e.k ? WORK_ICON[e.k] + ' ' : '') + (e.n[col] || e.n[0]).split(/[，,；;（(]/)[0];
  const near = ll => !view || geoDistance(ll, [view.lon, view.lat]) < Math.min(1.2, 2.2 / view.k);
  const place = ll => { if (!ll || !near(ll) || !st.evDots) return false; addPulse({ key, lon: ll[0], lat: ll[1], name, ev: e, when: t0 }); dotLoop(); return true; };
  if (e.lon != null) place([e.lon, e.lat]);
  if (e.feud) return;
  eventInfo(e, st.lang, col).then(async info => {
    if (!info) return;
    if (e.lon == null) {
      const ll = info.ll || (info.qid ? await wikidataPlace(info.qid) : null);
      if (!place(ll)) return;
    }
    if (st.pics) setPulseThumb(key, info.thumb, redraw);
  });
}
function removeCapitalPulses() { removePulses(p => p.cap); }
// the regional layers' names differ by country (Taiwan's feuds are Japan's uprisings…)
function localLabel(kind) { const s = t(st.lang); return s.localBy?.[st.mode]?.[kind] || s.local[kind]; }
function syncLocalLabels() {
  const s = t(st.lang), c = REGIONS.includes(st.mode) ? store.regions?.[st.mode] : null;
  for (const k of ['feud', 'power', 'us']) { $('#l-lc-' + k).textContent = localLabel(k); $('#lc-' + k).closest('label').hidden = !(c?.local || []).some(x => x.kind === k); }
  $('#l-lc-works').textContent = t(st.lang).worksL; $('#lc-works').closest('label').hidden = !(c?.works || []).length;
  $('#l-lc-network').textContent = t(st.lang).networkL; $('#lc-network').closest('label').hidden = !(c?.works || []).some(w => w.path);
  $('#l-ly-party').textContent = s.partyBy?.[st.mode]?.layer || s.partyLayer;
  $('#partyBox').hidden = !c?.party;
}
// one size for every picture: on the map, above the timeline and in the event preview
function syncPicSize() {
  const k = st.picSize / 54;
  document.documentElement.style.setProperty('--picscale', k.toFixed(2));
}
// a picture that popped up on the map: its event, or the country whose capital it is
function openPulse(p) {
  if (p.polity != null) { st.selected = p.polity; showPolity(p.polity); addPinButton(); redraw(); return; }
  const e = p.ev; if (!e) return;
  const s = t(st.lang);
  const when = e.regional ? (() => { const [y, mo] = regionYearMonth(reg(), e.m); return s.ym(y, mo); })() : formatYear(st.lang, e.y) + (e.e ? ' – ' + formatYear(st.lang, e.e) : '');
  showEvent({ ...e, when });
}
// redraw while dots are on the map, so they pulse and fade
function dotLoop() {
  if (app.dotTimer) return;
  app.dotTimer = setInterval(() => { redraw(); if (!pulsesActive()) { clearInterval(app.dotTimer); app.dotTimer = 0; redraw(); } }, 80);
}
function currentEvent(F) {
  if (!st.events) return null;
  if (isChina()) { const e = F.event; if (!e) return null; const [y, mo] = regionYearMonth(reg(), e.m); return { ...e, regional: true, key: 'm' + e.m, when: t(st.lang).ym(y, mo) }; }
  const ev = evList().filter(e => e.y <= st.year && st.year <= Math.max(e.e ?? e.y, e.y + (st.year > 1800 ? 1 : 5))).at(-1);
  return ev ? { ...ev, key: 'y' + ev.y } : null;
}
function nextEvent() {
  if (isChina()) { const c = reg(), e = (c?.events || []).find(e => e.m > st.cm); return e ? { ...e, regional: true } : null; }
  return evList().find(e => e.y > st.year) || null;
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
// ---------------------------------------------------------------- pin a country
// Pinning keeps the country's card on screen (cards opened later appear below it) and keeps its borders and
// capital of the pinned year on the map while the years go on, to compare a historical state with what came
// after. The map itself stays free to move.
const PIN_SVG = on => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9.5 3h5l-.8 5.6 3.8 3.9V14H13v6.2L12 22l-1-1.8V14H6.5v-1.5l3.8-3.9z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
const whenNow = () => REGIONS.includes(st.mode) ? st.cm : st.year;
function addPinButton() {
  const box = $('#info'), id = st.selected; if (box.hidden || id == null) return;
  box.querySelector('.pinbtn')?.remove();
  const s = t(st.lang), b = document.createElement('button');
  b.className = 'pinbtn'; b.title = s.pinOn; b.setAttribute('aria-label', s.pinOn); b.innerHTML = PIN_SVG(false);
  b.onclick = () => pinCurrent();
  box.prepend(b);
}
function pinCurrent() {
  const id = st.selected, box = $('#info'); if (id == null || box.hidden) return;
  const F = frame(st), s = t(st.lang);
  const feats = (F.feats || []).filter(f => f.properties.p === id);
  const q = !REGIONS.includes(st.mode) && P.row(id)?.[10], c = q && capitalOf(q, st.year);
  const color = feats.length ? F.color(id) : '#c2185b';
  app.pin = { id, mode: st.mode, when: whenNow(), yearText: $('#yearBig').textContent, key: [id, st.mode, whenNow()].join(':'), feats,
    marks: c ? [{ kind: 'cap', id, cap: c.c, img: c.img, lon: c.ll[0], lat: c.ll[1], text: c.n, color, big: true, pin: true, hi: true }] : [],
    html: box.innerHTML };
  st.selected = null; app.selectedProv = null; hideInfo();
  renderPin(); redraw();
}
function renderPin() {
  const pin = app.pin, card = $('#pinInfo'), s = t(st.lang);
  if (!pin) { card.hidden = true; card.innerHTML = ''; placeInfo(); return; }
  card.innerHTML = pin.html;
  card.querySelector('.pinbtn')?.remove(); card.querySelector('.fitbtn')?.remove();
  const b = document.createElement('button'); b.className = 'pinbtn on'; b.title = s.pinOff; b.setAttribute('aria-label', s.pinOff); b.innerHTML = PIN_SVG(true);
  b.onclick = unpin; card.prepend(b);
  card.querySelector('.x')?.addEventListener('click', e => { e.stopImmediatePropagation(); unpin(); }, { capture: true });
  const note = document.createElement('p'); note.className = 'pinwhen'; note.textContent = s.pinnedAt(pin.yearText);
  card.querySelector('h2')?.after(note);
  bindChips(card);
  card.hidden = false; placeInfo();
}
function unpin() { app.pin = null; renderPin(); redraw(); }
// the current card goes below the pinned one (desktop); on phones the pinned card is a strip at the top
function placeInfo() {
  const card = $('#pinInfo'), box = $('#info');
  if (card.hidden || matchMedia('(max-width: 860px)').matches) { box.style.top = ''; box.style.maxHeight = ''; return; }
  const top = card.offsetTop + card.offsetHeight + 10;
  box.style.top = top + 'px'; box.style.maxHeight = `calc(100% - ${top + 14}px)`;
}
new ResizeObserver(() => placeInfo()).observe($('#pinInfo'));

// ---------------------------------------------------------------- people named in a card
// Any card (events, governments, factions, countries…) gets a row of portraits of the people its text names,
// from a list of historical figures (data-pipeline/people) and their Wikipedia lead pictures (Commons only).
let peopleList = null, peopleRe = null;
function loadPeople() {
  if (peopleList) return Promise.resolve(peopleList);
  return (loadPeople.p ||= fetch(import.meta.env.BASE_URL + 'data/people.json').then(r => r.json()).then(list => {
    peopleList = list;
    const names = [];
    list.forEach((p, i) => p.m.forEach(n => names.push([n, i])));
    names.sort((a, b) => b[0].length - a[0].length);              // longest first: 英迪拉·甘地 before 甘地
    loadPeople.who = new Map(names.map(([n, i]) => [n, i]));
    const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    peopleRe = new RegExp(names.map(([n]) => /^[\x00-\x7f]+$/.test(n) ? `\\b${escRe(n)}\\b` : escRe(n)).join('|'), 'g');
    return list;
  }).catch(() => (peopleList = [])));
}
function peopleIn(text) {
  if (!peopleRe || !text) return [];
  const seen = new Set(), out = [];
  for (const m of text.matchAll(peopleRe)) { const i = loadPeople.who.get(m[0]); if (i != null && !seen.has(i)) { seen.add(i); out.push(peopleList[i]); } }
  return out.slice(0, 8);
}
async function addPeople(box) {
  if (!st.pics) { box.querySelector(':scope > .people')?.remove(); return; }
  await loadPeople();
  const text = [...box.childNodes].filter(n => !(n.classList?.contains('people'))).map(n => n.textContent).join(' ');
  const who = peopleIn(text), key = who.map(p => p.w).join('|');
  const old = box.querySelector(':scope > .people');
  if (old?.dataset.key === key) return;
  old?.remove();
  if (!who.length) return;
  const s = t(st.lang), col = st.langInfo.col, wl = wikiLang();
  const d = document.createElement('div'); d.className = 'people'; d.dataset.key = key;
  d.innerHTML = `<h3>${esc(s.peopleH)}</h3><div class="row">${who.map((p, i) => `<a class="who" data-i="${i}" href="${esc(wl === 'en' ? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(p.w.replace(/ /g, '_')) : wikiLink(null, (p.n[col] || p.n[0])))}" target="_blank" rel="noopener"><span class="ph"></span><span class="nm">${esc(p.n[col] || p.n[0])}</span></a>`).join('')}</div><p class="src">${esc(s.peopleSrc)}</p>`;
  const src = box.querySelector(':scope > p.src:last-of-type');
  src ? src.before(d) : box.append(d);
  who.forEach((p, i) => pageImage(p.w, 'en').then(im => im || pageImage(p.n[1], 'zh')).then(im => {   // Chinese article when the English one has no picture
    const a = d.querySelector(`.who[data-i="${i}"]`); if (!a || !im) return;
    a.querySelector('.ph').innerHTML = `<img src="${esc(im.thumb)}" alt="">`;
    a.title = `${p.n[col] || p.n[0]} — ${s.artPhoto}：${im.credit || '—'} · Wikimedia Commons`;
  }));
}
for (const id of ['#info', '#pinInfo']) {
  const box = $(id); let tm = 0;
  new MutationObserver(muts => {
    if (muts.every(m => [...m.addedNodes, ...m.removedNodes].every(n => n.classList?.contains('people') || n.closest?.('.people')))) return;
    clearTimeout(tm); tm = setTimeout(() => { if (!box.hidden) addPeople(box); }, 60);
  }).observe(box, { childList: true, subtree: true });
}

// a picture of the place, building, bank or currency an info panel is about (Wikipedia's lead picture, Commons only)
function addPlacePic(box, title, wl, label) {
  if (!st.pics) return;
  const tag = box.dataset.pic = Math.random().toString(36).slice(2);
  pageImage(title, wl).then(i => {
    if (!i || box.dataset.pic !== tag || box.hidden) return;
    box.querySelector('.placepic')?.remove();
    const d = document.createElement('div'); d.className = 'placepic'; d.innerHTML = figureHtml(i, label || t(st.lang).artPhoto, esc);
    (box.querySelector('table.facts') || box.querySelector('h2')).after(d);
  });
}
const wikiLang = () => ({ 'zh-Hant': 'zh', 'zh-Hans': 'zh', en: 'en', ja: 'ja' }[st.lang] || 'en');

function showPolity(id) {
  const box = $('#info');
  delete box.dataset.disputed; delete box.dataset.sticky;
  box.innerHTML = `<button class="x" aria-label="close">×</button>` + polityHtml(id);
  bindChips(box);
  box.hidden = false;
  const cap = P.row(id)?.[10] && capitalOf(P.row(id)[10], st.year);       // the capital in this year, pictured
  if (cap?.img && st.pics) { const tag = box.dataset.pic = id + ':' + cap.c; cityThumb(cap.img).then(tn => {
    if (!tn || box.dataset.pic !== tag || box.hidden) return;
    const name = cap.n[st.langInfo.col] || cap.n[0];
    box.querySelector('.placepic')?.remove();
    const d = document.createElement('div'); d.className = 'placepic';
    d.innerHTML = figureHtml({ thumb: tn.url, page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(cap.img), credit: tn.credit }, `★ ${esc(name)}`, esc);
    (box.querySelector('table.facts') || box.querySelector('h2')).after(d);
  }); }
  box.querySelector('.x').onclick = () => { st.selected = null; hideInfo(); redraw(); };
  addPinButton();
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
  addPlacePic(box, name.split(/[（(、,]/)[0], wikiLang());
}
// an administrative seat (◆): period, division, note, Wikipedia articles in all three languages
function showArt(id) {
  const s = t(st.lang), col = st.langInfo.col, x = (store.art || []).find(q => q.id === id); if (!x) return;
  const L = [['zh', 'zh-Hant'], ['en', 'en'], ['ja', 'ja']];
  const links = L.map(([, lang], i) => x.w[i] ? `<a href="${wikiLink(null, x.w[i], lang)}" target="_blank" rel="noopener">${esc(x.w[i])}</a>` : '').filter(Boolean).join(' · ');
  const box = $('#info');
  delete box.dataset.disputed; box.dataset.sticky = '1';
  box.innerHTML = `<button class="x" aria-label="close">×</button>
    <h2><span class="star" style="color:${ART_COLORS[x.t]}">${ART_SYM[x.k] || '✦'}</span>${esc(x.n[col] || x.n[0])}</h2>
    <table class="facts"><tr><th>${s.span}</th><td>${formatYear(st.lang, x.a)} – ${x.b >= 2026 ? '' : formatYear(st.lang, x.b)}</td></tr>
      <tr><th>${s.artTradRow}</th><td><i class="sw" style="background:${ART_COLORS[x.t]}"></i> ${s.artTrad[x.t]}</td></tr></table>
    <p class="desc">${esc(x.d[col] || x.d[0])}</p>
    <p class="links">${s.links}：${links}</p>
    <h3 class="worksH">${x.k === 'person' ? s.artPersonWorks : x.k === 'arch' ? s.artBuildings : s.artWorks}</h3><div class="works">${worksHtml(id)}</div>
    <p class="src">${s.artSrc}<br>${s.artWorksSrc}</p>`;
  box.hidden = false;
  box.querySelector('.x').onclick = () => hideInfo();
  if (!worksFor(id).length) loadWorks().then(() => { const w = box.querySelector('.works'); if (w && box.dataset.art === id) w.innerHTML = worksHtml(id); });
  box.dataset.art = id;
}
// cards for a movement's representative works: picture (Commons), title (Wikipedia), artist, date, museum, sources
function worksHtml(id) {
  const s = t(st.lang), list = worksFor(id), wl = { 'zh-Hant': 'zh', 'zh-Hans': 'zh', en: 'en', ja: 'ja' }[st.lang] || 'en';
  if (!list.length) return `<p class="muted">${s.artWorksNone}</p>`;
  const a = (href, text) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text);
  return list.map(w => {
    const title = workTitle(w, st.lang), wiki = workWiki(w, st.lang);
    const col = w.col[0], year = w.y != null ? formatYear(st.lang, w.y) : '';
    const museum = col ? a(col.site, col.name) + (w.url ? ` · ${a(w.url, s.artItemPage)}` : '') : w.url ? a(w.url, s.artItemPage) : '';
    const pic = w.thumb ? `<a class="pic" href="${esc(w.page)}" target="_blank" rel="noopener"><img src="${esc(w.thumb)}" alt="${esc(title)}" loading="lazy"></a>`
      : `<div class="pic none">${s.artNoPic}</div>`;
    return `<figure class="work">${pic}<figcaption><b>${a(wiki, title)}</b>
      ${[w.by, year].filter(Boolean).map(esc).join('，')}
      ${museum ? `<br>${s.artMuseum}：${museum}` : ''}
      <br><small>${w.thumb ? `${s.artPhoto}：${esc(w.author || '—')} · ${esc(w.lic)} · ${a(w.page, 'Commons')} · ` : ''}${a('https://www.wikidata.org/wiki/' + w.id, 'Wikidata')}</small></figcaption></figure>`;
  }).join('');
}
function showLang(id) {
  const s = t(st.lang), col = st.langInfo.col, L = themeOf(st.mode); if (!L) return;
  const x = L.areas.find(q => q.id === id) || L.points.find(q => q.id === id); if (!x) return;
  const fam = L.fam[x.f], links = [['zh', 'zh-Hant', 0], ['en', 'en', 1]].map(([, lang, i]) => x.w[i] ? `<a href="${wikiLink(null, x.w[i], lang)}" target="_blank" rel="noopener">${esc(x.w[i])}</a>` : '').filter(Boolean).join(' · ');
  const box = $('#info');
  delete box.dataset.disputed; box.dataset.sticky = '1';
  box.innerHTML = `<button class="x" aria-label="close">×</button>
    <h2><span class="star" style="color:${fam.color}">●</span>${esc(x.n[col] || x.n[0])}</h2>
    <table class="facts"><tr><th>${s.span}</th><td>${formatYear(st.lang, x.a)} – ${x.b >= 2026 ? '' : formatYear(st.lang, x.b)}</td></tr>
      <tr><th>${s.theme[st.mode].families}</th><td>${L.pointsAlways ? classIconSvg(x.f, fam.color, 18) : `<i class="sw" style="background:${fam.color}"></i>`} ${esc(fam.n[col] || fam.n[0])}</td></tr></table>
    <p class="desc">${esc(x.d[col] || x.d[0])}</p>
    ${x.series ? `<p class="series">◎ ${x.series.map(w => s.theme[st.mode].works[w]).join(' · ')}</p>` : ''}
    ${x.img ? `<figure class="evpic"><img src="${esc(x.img.url.startsWith('http') ? x.img.url : import.meta.env.BASE_URL + x.img.url)}" alt=""><figcaption>${s.imgSource}：${esc(x.img.credit)}</figcaption></figure>` : ''}
    ${L.pictures ? `<div class="works">${worksHtml(id)}</div><p class="src">${s.imgSource}：${x.img ? esc(x.img.credit) + '；' : ''}${s.theme[st.mode].imgNote}</p>` : ''}
    <p class="links">${s.links}：${links}</p>
    <p class="src">${s.theme[st.mode].src}</p>`;
  box.hidden = false;
  box.querySelector('.x').onclick = () => hideInfo();
  if (!L.pictures && (x.w[1] || x.w[0])) addPlacePic(box, x.w[1] || x.w[0], x.w[1] ? 'en' : 'zh');
}
// a cable of the Internet mode: years, length, operators and landing points (TeleGeography), or a terrestrial line
function showCable(id) {
  const s = t(st.lang), col = st.langInfo.col, L = themeOf(st.mode); if (!L) return;
  const x = (L.flows || []).find(q => q.id === id); if (!x) return;
  const fam = L.fam[x.f], I = x.info || {}, T = s.theme[st.mode] || {};
  const sep = st.lang === 'en' ? ', ' : '、', more = (list, n) => list.join(sep) + (list.length >= n ? s.cableMore : '');
  const box = $('#info');
  delete box.dataset.disputed; box.dataset.sticky = '1';
  box.innerHTML = `<button class="x" aria-label="close">×</button>
    <h2><span class="star" style="color:${fam.color}">━</span>${esc(x.n[col] || x.n[0])}</h2>
    <table class="facts"><tr><th>${s.span}</th><td>${formatYear(st.lang, x.a)} – ${x.b >= 2026 ? s.cableInUse : formatYear(st.lang, x.b)}</td></tr>
      <tr><th>${T.families || ''}</th><td><i class="sw" style="background:${fam.color}"></i> ${esc(fam.n[col] || fam.n[0])}</td></tr>
      ${I.len ? `<tr><th>${s.cableLen}</th><td>${esc(I.len)}</td></tr>` : ''}
      ${I.own?.length ? `<tr><th>${s.cableOwn}</th><td>${esc(more(I.own, 5))}</td></tr>` : ''}
      ${I.land?.length ? `<tr><th>${s.cableLand}</th><td>${esc(more(I.land, 8))}</td></tr>` : ''}</table>
    <p class="src">${I.len || I.own?.length ? s.cableSrcTG : T.src || ''}</p>`;
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
    <h2><span class="star" style="color:${LOCAL_COLOR[kind] || (div ? div.color : '#555')}">${{ seat: '◆', feud: '⚔', power: '◉', us: '✪' }[kind]}</span>${esc(name)}</h2>
    ${kind !== 'seat' ? `<p class="kind">${localLabel(kind)}</p>` : ''}
    <table class="facts"><tr><th>${s.span}</th><td>${s.ym(y0, m0)} – ${end}</td></tr>
      ${div ? `<tr><th>${s.seatOf}</th><td><i class="sw" style="background:${div.color}"></i> ${esc(div.n?.[col] || div.name?.[col] || div.n?.[0] || '')}</td></tr>` : ''}</table>
    ${note ? `<p class="desc">${esc(note)}</p>` : ''}
    <p class="links">${s.links}：${links}</p>
    <p class="src">${kind === 'seat' ? s.seatSrc : s.localSrc}</p>`;
  box.hidden = false;
  box.querySelector('.x').onclick = () => hideInfo();
  addPlacePic(box, x.w[0] || name.split(/[（(、,]/)[0], x.w[0] ? 'zh' : wikiLang());
}
function showWork(id) {
  const c = reg(), s = t(st.lang), col = st.langInfo.col;
  const x = (c.works || []).find(q => q.id === id); if (!x) return;
  const [y0, m0] = regionYearMonth(c, x.a), [y1, m1] = regionYearMonth(c, x.b);
  const end = x.b >= c.months - 1 ? '' : s.ym(y1, m1);
  const name = x.n[col] || x.n[0], note = x.note[col] || x.note[0];
  const L = [['zh', 'zh-Hant'], ['en', 'en'], ['ja', 'ja']];
  const links = L.map(([k, lang], i) => x.w[i] ? `<a href="${wikiLink(null, x.w[i], lang)}" target="_blank" rel="noopener">${esc(x.w[i])}</a>` : '').filter(Boolean).join(' · ');
  const box = $('#info');
  delete box.dataset.disputed; box.dataset.sticky = '1';
  box.innerHTML = `<button class="x" aria-label="close">×</button>
    <h2><span class="star" style="color:${WORK_COLOR[x.kind]}">${WORK_ICON[x.kind]}</span>${esc(name)}</h2>
    <p class="kind">${s.workKinds[x.kind] || ''}</p>
    <table class="facts"><tr><th>${s.workSpan}</th><td>${s.ym(y0, m0)} – ${end}</td></tr></table>
    ${note ? `<p class="desc">${esc(note)}</p>` : ''}
    ${links ? `<p class="links">${s.links}：${links}</p>` : ''}
    <p class="src">${s.workSrc}${x.kind === 'cable' && st.mode === 'taiwan' && x.id !== 'cb_tpc5' && x.id !== 'cb_tpkm' ? '<br>' + s.cableSrcSMC : ''}</p>`;
  box.hidden = false;
  box.querySelector('.x').onclick = () => hideInfo();
  addPlacePic(box, x.w[0] || name.split(/[（(、,]/)[0], x.w[0] ? 'zh' : wikiLang());
}
function showProvince(prov) {
  const s = t(st.lang), col = st.langInfo.col;
  const f = frame(st).feats.find(x => x.properties.prov?.id === prov.id);
  if (!f) { hideInfo(); return; }
  const { p, ctl, ctl2, fb } = f.properties;
  const admin = LAYERED.includes(st.mode) && st.layer === 'admin' && !fb;
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
function hideInfo() { const b = $('#info'); b.hidden = true; delete b.dataset.disputed; delete b.dataset.sticky; delete b.dataset.art; }
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
  if (BEARINGS[h.get('u')] != null) st.bearing = h.get('u');
  if (h.has('l') && LANGS.some(l => l.id === h.get('l'))) { st.lang = h.get('l'); st.langInfo = LANGS.find(l => l.id === st.lang); }
  const sp = +safeGet('speed'); if (SPEEDS.includes(sp)) st.speed = sp;
  const c = (h.get('c') || '').split(',').map(Number);
  if (c.length === 3 && c.every(isFinite)) app.initialView = { lon: c[0], lat: c[1], k: c[2] };
}
function writeHashSoon() { clearTimeout(hashT); hashT = setTimeout(writeHash, 400); }
function writeHash() {
  const v = currentView();
  const h = new URLSearchParams({ m: st.mode, t: st.cm, o: st.overseas ? 1 : 0, L: st.layers.control && st.layers.admin ? 'both' : st.layer, y: st.year, p: st.projection, b: st.basemap, v: st.pov, l: st.lang, c: [v.lon, v.lat, v.k].map(x => (isFinite(x) ? x : 0).toFixed(2)).join(',') });
  if (st.bearing && st.bearing !== 'n' && st.bearing !== 'free') h.set('u', st.bearing);
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
