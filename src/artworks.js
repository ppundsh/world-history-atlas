// Representative works for the art-history mode. Only Wikidata ids are kept here; titles, artists, dates,
// museums and pictures are read from Wikidata and Wikimedia Commons in the visitor's browser (both allow
// cross-origin requests), so every picture is a freely licensed Commons file shown with its author and licence.
// The answer is cached for a week. Ids marked "!" have no free picture (the work is still in copyright);
// they are listed with their museum and sources but without a thumbnail.

export const ART_WORKS = {
  egypt_ok: ['Q378034', 'Q971646'], sumer: ['Q524447', 'Q656070'], minoan: ['Q3566545', 'Q1125985'], shang: ['Q10917916'],
  olmec: ['Q3062269', 'Q3063199'], amarna: ['Q582172'], assyria: ['Q616332', 'Q27920165'], greek_arch: ['Q775405', 'Q492894'],
  etruscan: ['Q2294393', 'Q2294371'], greek_cl: ['Q10288', 'Q133732'], maurya: ['Q3595955', 'Q5274083'], hellenistic: ['Q216402', 'Q465762'],
  han: ['Q15914818', 'Q2568517'], roman: ['Q667124', 'Q841762'], gandhara: ['Q484458', 'Q141445314'], moche: ['Q2595754'],
  maya: ['Q3241673', 'Q605455'], gupta: ['Q184427', 'Q543419'], byzantine: ['Q12506', 'Q721817'], dunhuang: ['Q43286'],
  islamic: ['Q172077', 'Q47476'], tang: ['Q4997694', 'Q1372026'], insular: ['Q204221', 'Q80935'], nara: ['Q2379007', 'Q460367'],
  angkor: ['Q43473', 'Q654024'], chola: ['Q23641297', 'Q916943'], goryeo: ['Q850242', 'Q138733'], song: ['Q714802', 'Q5136665'],
  romanesque: ['Q187483', 'Q217452'], ife: ['Q15409979'], zimbabwe: ['Q722475'], gothic: ['Q180274', 'Q1813497'],
  persian_min: ['Q3114572'], benin: ['Q18385381'], aztec: ['Q786806', 'Q3903548'], ren_it: ['Q151047', 'Q12418', 'Q186953'],
  ren_north: ['Q734834', 'Q220859', 'Q321303'], inca: ['Q676203'], ottoman: ['Q178643', 'Q80541'], safavid: ['Q643098', 'Q1766064'],
  mannerism: ['Q867403', 'Q3705703'], mughal: ['Q9141', 'Q1574072'], baroque: ['Q219831', 'Q1333433', 'Q208758'],
  dutch: ['Q167605', 'Q185372'], rinpa: ['Q48389324', 'Q31892412'], qing_court: ['Q28092353'], ukiyoe: ['Q252485', 'Q3565037'],
  joseon: ['Q12615728', 'Q5554841'], rococo: ['Q2629559', 'Q531329'], neoclassic: ['Q476458', 'Q636537'],
  romanticism: ['Q311243', 'Q29530', 'Q212616'], hudson: ['Q3172259', 'Q12406964'], realism: ['Q540488', 'Q1368055'],
  impressionism: ['Q328523', 'Q683274'], postimp: ['Q45585', 'Q1044742'], nouveau: ['Q461371'], secession: ['Q698487', 'Q684689'],
  fauvism: ['Q1437492', 'Q2538580'], expressionism: ['Q471379', 'Q19883652'], cubism: ['Q910199'], futurism: ['Q933665', 'Q2902629'],
  avantgarde: ['Q1170315', 'Q794007'], dada: ['Q1206847'], bauhaus: ['Q516770', 'Q2629013'], mexican: ['Q5265945', 'Q6746081'],
  surrealism: ['Q1061035', 'Q25729'], socrealism: ['Q627114'], abex: ['Q2907210', 'Q1769529'], pop: ['Q2697937', 'Q573949'],
  graffiti: ['Q22000063'],
};

import { isOffline, offlineJson, offlineFile } from './offline.js';

const WEEK = 7 * 864e5;
// sets of works fetched and cached separately: the art-history works, and the portraits of the hidden mode
const SETS = { art: { key: 'artworks.v2', ids: () => [...new Set(Object.values(ART_WORKS).flat())] } };
export function registerWorks(set, map, key) { Object.assign(ART_WORKS, map); SETS[set] = { key, ids: () => [...new Set(Object.values(map).flat())] }; }
const SPARQL = 'https://query.wikidata.org/sparql';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
let works = null;
const loading = {}, loaded = {};
const pics = new Map();
export let onPicture = null;
export function setPictureListener(fn) { onPicture = fn; }

const v = (b, k) => b[k]?.value;
const last = u => u.split('/').pop();

async function fetchAll(ids) {
  const q = `SELECT ?w ?img ?col ?colLabel ?colSite ?crLabel ?inc ?url ?en ?zht ?zh ?zhs ?ja ?zhw ?jaw ?enw WHERE {
  VALUES ?w { ${ids.map(i => 'wd:' + i).join(' ')} }
  OPTIONAL { ?w wdt:P18 ?img } OPTIONAL { ?w wdt:P195 ?col OPTIONAL { ?col wdt:P856 ?colSite } }
  OPTIONAL { ?w wdt:P170|wdt:P50|wdt:P84|wdt:P86 ?cr } OPTIONAL { ?w wdt:P571|wdt:P577 ?inc } OPTIONAL { ?w wdt:P973 ?url }
  OPTIONAL { ?w rdfs:label ?en FILTER(lang(?en) = 'en') } OPTIONAL { ?w rdfs:label ?zht FILTER(lang(?zht) = 'zh-tw') }
  OPTIONAL { ?w rdfs:label ?zh FILTER(lang(?zh) = 'zh') } OPTIONAL { ?w rdfs:label ?zhs FILTER(lang(?zhs) = 'zh-cn') }
  OPTIONAL { ?w rdfs:label ?ja FILTER(lang(?ja) = 'ja') }
  OPTIONAL { ?enw schema:about ?w; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?zhw schema:about ?w; schema:isPartOf <https://zh.wikipedia.org/> }
  OPTIONAL { ?jaw schema:about ?w; schema:isPartOf <https://ja.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-tw,zh-hant,zh,en". ?col rdfs:label ?colLabel. ?cr rdfs:label ?crLabel }
}`;
  // POST: the list of ids makes the query too long for a GET URL
  const r = await fetch(SPARQL, { method: 'POST', headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) });
  const out = {};
  for (const b of (await r.json()).results.bindings) {
    const id = last(v(b, 'w')), a = out[id] ??= { id, col: [] };
    if (v(b, 'img') && !a.file) a.file = decodeURIComponent(last(v(b, 'img'))).replace(/_/g, ' ');
    if (v(b, 'col') && !a.col.some(c => c.id === last(v(b, 'col')))) a.col.push({ id: last(v(b, 'col')), name: v(b, 'colLabel'), site: v(b, 'colSite') || '' });
    for (const [k, f] of [['by', 'crLabel'], ['url', 'url'], ['en', 'en'], ['zht', 'zht'], ['zh', 'zh'], ['zhs', 'zhs'], ['ja', 'ja'], ['enw', 'enw'], ['zhw', 'zhw'], ['jaw', 'jaw']])
      if (v(b, f) && !a[k]) a[k] = v(b, f);
    if (v(b, 'inc') && a.y == null) { const s = v(b, 'inc'), y = parseInt(s.replace(/^\+/, ''), 10); if (isFinite(y)) a.y = y; }
    if (a.by && /^(Q\d+|t\d+)$/.test(a.by)) a.by = '';         // anonymous works come back as blank-node ids
  }
  // thumbnails, author and licence of each picture
  const files = [...new Set(Object.values(out).map(a => a.file).filter(Boolean))];
  for (let i = 0; i < files.length; i += 40) {
    const u = COMMONS + '?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=240'
      + '&iiextmetadatafilter=LicenseShortName|Artist&titles=' + encodeURIComponent(files.slice(i, i + 40).map(f => 'File:' + f).join('|'));
    const j = await (await fetch(u)).json(), norm = {};
    (j.query?.normalized || []).forEach(n => norm[n.to] = n.from);
    for (const p of Object.values(j.query?.pages || {})) {
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const file = (norm[p.title] || p.title).slice(5), m = ii.extmetadata || {};
      for (const a of Object.values(out)) if (a.file === file) Object.assign(a, {
        thumb: ii.thumburl, page: ii.descriptionurl, lic: m.LicenseShortName?.value || '',
        author: (m.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 90),
      });
    }
  }
  return out;
}

export function loadWorks(set = 'art') {
  const S = SETS[set]; if (!S) return Promise.resolve(works || {});
  if (loaded[set]) return Promise.resolve(works);
  if (loading[set]) return loading[set];
  // bundled: offline/works.json holds every work's Wikidata facts; pictures come from the bundle too
  loading[set] = isOffline().then(async off => {
    if (!off) return null;
    const all = await offlineJson('works.json') || {}, w = {};
    for (const id of S.ids()) {
      const a = all[id]; if (!a) continue;
      const f = a.file && await offlineFile(a.file);
      w[id] = f ? { ...a, thumb: f.thumb, page: f.page, lic: f.lic, author: f.author } : { ...a };
    }
    works = { ...works, ...w }; loaded[set] = true; return works;
  }).then(r => r || liveWorks(set, S));
  return loading[set];
}
function liveWorks(set, S) {
  try {
    const c = JSON.parse(localStorage.getItem(S.key) || 'null');
    if (c && Date.now() - c.t < WEEK) { works = { ...works, ...c.w }; loaded[set] = true; return Promise.resolve(works); }
  } catch { /* storage unavailable */ }
  return fetchAll(S.ids()).then(w => {
    works = { ...works, ...w }; loaded[set] = true;
    try { localStorage.setItem(S.key, JSON.stringify({ t: Date.now(), w })); } catch { /* full or blocked */ }
    return works;
  }).catch(() => (works ||= {}));
}

export function worksFor(movement) {
  return works ? (ART_WORKS[movement] || []).map(id => works[id]).filter(Boolean) : [];
}

// the picture shown beside a movement's ✦ on the map: its first work that has a free picture
export function pictureFor(movement) {
  const w = worksFor(movement).find(a => a.thumb); if (!w) return null;
  let img = pics.get(w.thumb);
  if (!img) {
    img = new Image(); img.crossOrigin = 'anonymous';           // keeps the map canvas exportable
    img.onload = () => onPicture?.(); img.src = w.thumb; pics.set(w.thumb, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

export function workTitle(a, lang) {
  return lang === 'ja' ? a.ja || a.en : lang === 'zh-Hans' ? a.zhs || a.zh || a.zht || a.en : lang === 'en' ? a.en : a.zht || a.zh || a.en;
}
export function workWiki(a, lang) {
  return lang === 'ja' ? a.jaw || a.enw : lang === 'en' ? a.enw : a.zhw || a.enw;
}
