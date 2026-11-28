// Railways and roads of the regional modes from OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0).
//
// For every line work in data-pipeline/<region>/infra.tsv (kinds rail, hsr, highway, road):
//  1. its Wikipedia title (columns 12–13) → Wikidata item (Wikipedia API, 50 titles per request);
//     data-pipeline/osm/manual.tsv can give an item or OSM relation by hand (region, id, Q… or r123);
//  2. the OSM route relation tagged with that item (and its child routes) → the ways, from the Overpass API,
//     one request at a time, several items per request; answers are cached in data-pipeline/sources/osm/ (not committed);
//  3. on those ways, the shortest path through the towns listed in infra.tsv: the line is cut to the stretch
//     the work is about (a relation is often the whole line, a work only its first section). A stretch that
//     cannot be found on the ways keeps the earlier route (Natural Earth or sketch).
// Writes data-pipeline/<region>/routes_osm.json (ODbL: a derived database of OpenStreetMap) and puts the routes
// into public/data/<region>.json, so no other build step is needed.
//   node data-pipeline/osm/fetch-routes.mjs [--refresh] [--corridor] [region …]
//   OSM_DELAY = ms between requests (default 1000), OSM_BATCH = items per Overpass request (default 8)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { line } from '../lib/progress.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DP = path.join(ROOT, 'data-pipeline');
const CACHE = path.join(DP, 'sources', 'osm');
const args = process.argv.slice(2), REFRESH = args.includes('--refresh'), CORRIDOR_ON = args.includes('--corridor');
const REGIONS = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--'))
  : fs.readdirSync(DP).filter(d => fs.existsSync(path.join(DP, d, 'infra.tsv'))).sort();
const DELAY = Math.max(500, +(process.env.OSM_DELAY || 1000));
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; route geometry build)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const LINES = ['rail', 'hsr', 'highway', 'road'];
const SNAP_KM = 15;
fs.mkdirSync(CACHE, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let last = 0;
async function polite() { const w = last + DELAY - Date.now(); if (w > 0) await sleep(w); last = Date.now(); }
// every request gives up after TIMEOUT s (a busy Overpass server can otherwise keep the connection open for ages)
const TIMEOUT = Math.max(30, +(process.env.OSM_TIMEOUT || 150));
const note = m => process.stdout.write(`\n  ${m}`);
async function get(url, init = {}, tries = 4) {
  if (process.env.OSM_OFFLINE) return null;                     // cache only (testing)
  const host = new URL(url).host;
  for (let i = 0; i < tries; i++) {
    await polite();
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT * 1000), headers: { 'User-Agent': UA, ...(init.headers || {}) } });
      if (r.status === 429 || r.status === 504 || r.status >= 500) { const w = 15 * (i + 1); note(`${host} 忙碌（${r.status}），${w} 秒後重試`); await sleep(w * 1000); continue; }
      if (!r.ok) { note(`${host} 回應 ${r.status}`); return null; }
      return await r.json();
    } catch (e) { note(`${host} ${e.name === 'TimeoutError' ? `${TIMEOUT} 秒沒有回應` : '連線失敗'}，重試`); await sleep(5000 * (i + 1)); }
  }
  return null;
}

// ---- geometry
const R = 6371;
const rad = Math.PI / 180;
function km(a, b) {
  const d = Math.sin((b[1] - a[1]) * rad / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(d)));
}
function segDev(p, a, b) {
  const c = Math.cos((a[1] + b[1]) / 2 * rad), X = q => [(q[0] - a[0]) * c * 111.32, (q[1] - a[1]) * 110.57];
  const [bx, by] = X(b), [px, py] = X(p), L = bx * bx + by * by;
  const t = L ? Math.max(0, Math.min(1, (px * bx + py * by) / L)) : 0;
  return Math.hypot(px - t * bx, py - t * by);
}
function simplify(pts, tol = 0.0008) {             // Douglas–Peucker, ~80 m: plenty for a country map
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [i, j] = st.pop(); let md = 0, mi = -1;
    const [ax, ay] = pts[i], [bx, by] = pts[j], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    for (let k = i + 1; k < j; k++) {
      const [px, py] = pts[k];
      const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d > md) { md = d; mi = k; }
    }
    if (md > tol) { keep[mi] = 1; st.push([i, mi], [mi, j]); }
  }
  return pts.filter((_, k) => keep[k]).map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
}

// ---- a graph of the relation's ways
class Graph {
  constructor(ways, cost = () => 1) {
    this.pts = []; this.adj = []; this.idx = new Map();
    for (const w of ways) {
      let prev = -1; const c = cost(w.t || {});
      if (c == null) continue;
      for (const g of w.geometry || []) {
        const v = this.vertex([g.lon, g.lat]);
        if (prev >= 0 && prev !== v) { const d = km(this.pts[prev], this.pts[v]) * c; this.adj[prev].push([v, d]); this.adj[v].push([prev, d]); }
        prev = v;
      }
    }
  }
  vertex(p) {
    const k = p[0].toFixed(6) + ',' + p[1].toFixed(6);
    let v = this.idx.get(k);
    if (v === undefined) { v = this.pts.length; this.idx.set(k, v); this.pts.push(p); this.adj.push([]); }
    return v;
  }
  near(p) {
    const out = [];
    for (let v = 0; v < this.pts.length; v++) { const d = km(p, this.pts[v]); if (d <= SNAP_KM) out.push([d, v]); }
    return out.sort((a, b) => a[0] - b[0]).slice(0, 40);
  }
  path(a, b) {
    const A = this.near(a), B = new Set(this.near(b).map(x => x[1]));
    if (!A.length || !B.size) return null;
    const dist = new Map(), prev = new Map(), heap = [];
    const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], end = heap.pop(); if (heap.length) { heap[0] = end; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    for (const [d, v] of A) { dist.set(v, d); push(d, v); }
    let end = -1;
    while (heap.length) {
      const [d, v] = pop();
      if (d > (dist.get(v) ?? Infinity)) continue;
      if (B.has(v)) { end = v; break; }
      for (const [w, c] of this.adj[v]) { const nd = d + c; if (nd < (dist.get(w) ?? Infinity)) { dist.set(w, nd); prev.set(w, v); push(nd, w); } }
    }
    if (end < 0) return null;
    const out = [end]; while (prev.has(out.at(-1))) out.push(prev.get(out.at(-1)));
    return out.reverse().map(v => this.pts[v]);
  }
}
// one stretch between two towns, if the ways really join them along the expected corridor
function stretch(G, a, b) {
  const gc = km(a, b); if (gc < 0.5) return null;
  const p = G.path(a, b); if (!p || p.length < 2) return null;
  let L = 0; for (let i = 1; i < p.length; i++) L += km(p[i - 1], p[i]);
  if (L < 0.3 * gc || L > Math.max(1.8 * gc, gc + 40)) return null;
  for (let i = 0; i < p.length; i += Math.max(1, p.length >> 9)) if (segDev(p[i], a, b) > Math.max(30, 0.35 * gc)) return null;
  return p;
}

// ---- inputs
const rowsOf = f => fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => l.replace(/\r$/, '').split('\t'));
const manual = new Map();
const mf = path.join(DP, 'osm', 'manual.tsv');
if (fs.existsSync(mf)) for (const [r, id, ref] of rowsOf(mf)) if (ref) manual.set(r + '/' + id, ref.trim());
const works = [];
for (const r of REGIONS) for (const c of rowsOf(path.join(DP, r, 'infra.tsv'))) {
  if (!LINES.includes(c[0])) continue;
  works.push({ region: r, kind: c[0], id: c[1], parts: c[4].split(';').map(s => s.trim().split(/\s+/).map(q => q.split(',').map(Number))), wzh: c[11] || '', wen: c[12] || '', ref: manual.get(r + '/' + c[1]) });
}

// Wikipedia titles → Wikidata items (cached)
const qfile = path.join(CACHE, 'wikidata.json');
const qids = fs.existsSync(qfile) && !REFRESH ? JSON.parse(fs.readFileSync(qfile, 'utf8')) : {};
for (const [lang, col] of [['en', 'wen'], ['zh', 'wzh']]) {
  const need = [...new Set(works.filter(w => !w.ref && w[col] && !((lang + ':' + w[col]) in qids)).map(w => w[col]))];
  for (let i = 0; i < need.length; i += 50) {
    const batch = need.slice(i, i + 50);
    const j = await get(`https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ action: 'query', format: 'json', redirects: '1', maxlag: '5', prop: 'pageprops', ppprop: 'wikibase_item', titles: batch.join('|') }));
    if (!j) continue;
    const to = new Map(batch.map(t => [t, t]));
    for (const x of j.query?.normalized || []) for (const [k, v] of to) if (v === x.from) to.set(k, x.to);
    for (const x of j.query?.redirects || []) for (const [k, v] of to) if (v === x.from) to.set(k, x.to);
    const byTitle = new Map(Object.values(j.query?.pages || {}).map(p => [p.title, p.pageprops?.wikibase_item || null]));
    for (const [t, final] of to) qids[lang + ':' + t] = byTitle.get(final) ?? null;
    fs.writeFileSync(qfile, JSON.stringify(qids));
  }
}

// Overpass: the ways of the relation(s) for an item, cached per item. Several items go in one request
// (a "sep" marker before each item's answer tells them apart); a batch that fails is retried item by item.
const cacheFile = ref => path.join(CACHE, ref.replace(/[^\w]/g, '_') + '.json');
const BATCH = Math.max(1, +(process.env.OSM_BATCH || 4));
function itemQuery(ref) {
  const sel = ref.startsWith('r') ? `rel(${ref.slice(1)})` : `rel["wikidata"="${ref}"]`;
  return `make sep ref="${ref}";out;${sel}->.a;rel(r.a)->.b;rel(r.b)->.c;(way(r.a);way(r.b);way(r.c);)->.w;.a out ids;.w out geom;`;
}
async function overpass(refs) {
  const q = `[out:json][timeout:${TIMEOUT - 20}][maxsize:536870912];` + refs.map(itemQuery).join('');
  for (const ep of OVERPASS) {
    const j = await get(ep, { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 2);
    if (!j?.elements || j.remark?.includes('runtime error')) continue;
    const out = {}; let cur = null;
    for (const e of j.elements) {
      if (e.type === 'sep') { cur = out[e.tags.ref] = { rels: [], ways: [] }; continue; }
      if (!cur) continue;
      if (e.type === 'relation') cur.rels.push(e.id);
      else if (e.type === 'way') cur.ways.push({ t: e.tags || {}, geometry: e.geometry });
    }
    if (refs.every(r => out[r])) return out;
  }
  return null;
}
async function fetchAll(refs) {
  if (process.env.OSM_OFFLINE) return;
  const need = [...new Set(refs)].filter(r => REFRESH || !fs.existsSync(cacheFile(r)));
  for (let i = 0; i < need.length; i += BATCH) {
    const batch = need.slice(i, i + BATCH);
    line(`Overpass 路線關係 ${Math.min(i + BATCH, need.length)}/${need.length}（${batch.join(' ')}）…`);
    let res = await overpass(batch);
    if (!res) { note('合併查詢沒有結果，改逐條查詢'); res = {}; for (const r of batch) Object.assign(res, await overpass([r]) || {}); }   // one by one
    // an item the server cannot answer is remembered as failed (its line then uses the corridor network); --refresh retries it
    for (const r of batch) fs.writeFileSync(cacheFile(r), JSON.stringify(res[r] || { rels: [], ways: [], failed: true }));
  }
  if (need.length) console.log();
}
const waysFor = ref => (f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null)(cacheFile(ref));
const RAIL_OK = new Set(['rail', 'narrow_gauge', 'light_rail', 'preserved', 'disused', 'abandoned', 'razed', 'subway', 'monorail']);
const usable = (kind, t) => (kind === 'rail' || kind === 'hsr') ? RAIL_OK.has(t.railway) : !!t.highway && !['platform', 'bus_stop', 'elevator', 'steps'].includes(t.highway);

// the Natural Earth route (routes.json) between two towns, for the stretches OSM cannot give
const neCache = {};
const neRoutes = r => neCache[r] ||= (f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {})(path.join(DP, r, 'routes.json'));
function neStretch(ne, a, b) {
  if (!ne || ne.src === 'sketch') return null;
  for (const part of ne.parts) {
    let ia = -1, ib = -1, da = 5, db = 5;
    part.forEach((q, i) => { const x = km(q, a), y = km(q, b); if (x < da) { da = x; ia = i; } if (y < db) { db = y; ib = i; } });
    if (ia >= 0 && ib >= 0 && ia !== ib) { const s = ia < ib ? part.slice(ia + 1, ib + 1) : part.slice(ib, ia).reverse(); return [...s, b]; }
  }
  return null;
}

// the network around a line (OSM ways within CORRIDOR m of the listed towns), for lines whose route relation is
// missing or does not reach every town: the path is then found on the real tracks / roads
const CORRIDOR = 12000;
const corKey = w => 'cor_' + w.region + '_' + w.id + '_' + (h => { let x = 0; for (const ch of h) x = (x * 31 + ch.charCodeAt(0)) | 0; return (x >>> 0).toString(36); })(w.kind + JSON.stringify(w.parts));
const corFilter = kind => kind === 'rail' || kind === 'hsr'
  ? 'way[railway~"^(rail|narrow_gauge|preserved|disused|abandoned)$"][!service][usage!~"^(industrial|military|tourism)$"]'
  : 'way[highway~"^(motorway|trunk|primary|motorway_link|trunk_link)$"]';
// the corridor as a chain of small boxes along the line (box queries are cheap for Overpass; "around" a long
// line is not): points every ~25 km, three at a time in one box, padded by ~CORRIDOR
function corBoxes(w) {
  const boxes = [];
  for (const pts of w.parts) {
    const dense = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]], n = Math.max(1, Math.ceil(km(a, b) / 25));
      for (let k = 1; k <= n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    for (let i = 0; i < dense.length - 1; i += 2) {
      const run = dense.slice(i, i + 3), py = CORRIDOR / 111000, mid = run[0][1] * rad;
      const px = py / Math.max(0.2, Math.cos(mid));
      const r = v => +v.toFixed(3);
      boxes.push([r(Math.min(...run.map(q => q[1])) - py), r(Math.min(...run.map(q => q[0])) - px), r(Math.max(...run.map(q => q[1])) + py), r(Math.max(...run.map(q => q[0])) + px)]);
    }
  }
  return boxes;
}
const corQuery = w => `make sep ref="${corKey(w)}";out;(` + corBoxes(w).map(b => `${corFilter(w.kind)}(${b.join(',')});`).join('') + ');out geom;';
const COST = {
  rail: t => (/^(disused|abandoned)$/.test(t.railway) ? 1.8 : 1),
  hsr: t => (/^(disused|abandoned)$/.test(t.railway) ? 2 : t.highspeed === 'yes' ? 0.8 : 1.3),
  highway: t => ({ motorway: 0.8, motorway_link: 0.9, trunk: 1, trunk_link: 1, primary: 1.3, primary_link: 1.3 }[t.highway] ?? 1.6),
  road: t => ({ motorway: 1.3, motorway_link: 1.3, trunk: 1, primary: 1, secondary: 1.1 }[t.highway] ?? 1.2),
};
async function fetchCorridors(list) {
  if (process.env.OSM_OFFLINE) return;
  const need = list.filter(w => REFRESH || !fs.existsSync(cacheFile(corKey(w))));
  const B = 1;                                      // one line per request: corridor answers are large
  for (let i = 0; i < need.length; i += B) {
    const batch = need.slice(i, i + B);
    line(`Overpass 沿線路網 ${Math.min(i + B, need.length)}/${need.length}（${batch.map(w => w.id).join(' ')}）…`);
    const run = async ws => {
      const q = `[out:json][timeout:${TIMEOUT - 20}][maxsize:536870912];` + ws.map(corQuery).join('');
      for (const ep of OVERPASS) {
        const j = await get(ep, { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 2);
        if (!j?.elements || j.remark?.includes('runtime error')) continue;
        const out = {}; let cur = null;
        for (const e of j.elements) {
          if (e.type === 'sep') { cur = out[e.tags.ref] = { rels: [], ways: [] }; continue; }
          if (cur && e.type === 'way') cur.ways.push({ t: e.tags || {}, geometry: e.geometry });
        }
        if (ws.every(w => out[corKey(w)])) return out;
      }
      return null;
    };
    let res = await run(batch);
    for (const w of batch) fs.writeFileSync(cacheFile(corKey(w)), JSON.stringify(res[corKey(w)] || { rels: [], ways: [], failed: true }));
  }
  if (need.length) console.log();
}

// ---- match every work: its route relation first, then the corridor network, then Natural Earth, then a straight line
const result = Object.fromEntries(REGIONS.map(r => [r, {}]));
const stat = { osm: 0, part: 0, none: 0 };
const refOf = w => w.ref || (w.wen && qids['en:' + w.wen]) || (w.wzh && qids['zh:' + w.wzh]);
await fetchAll(works.map(refOf).filter(Boolean));
// pass 1: on the route relation
for (const w of works) {
  const ref = refOf(w), data = ref ? waysFor(ref) : null;
  const ways = (data?.ways || []).filter(x => usable(w.kind, x.t));
  const G = ways.length ? new Graph(ways) : null;
  w.rels = data?.rels || [];
  w.segs = w.parts.map(pts => pts.slice(1).map((b, i) => (G && stretch(G, pts[i], b)) || null));
}
// pass 2: the corridor network for the stretches still missing
// (off unless --corridor: it downloads every main road / track near the line, heavy for Overpass; without it
// those stretches keep Natural Earth, which is itself a map of the main roads and railways)
if (CORRIDOR_ON) await fetchCorridors(works.filter(w => w.segs.some(ss => ss.some(x => !x))));
for (const w of works) {
  if (!w.segs.some(ss => ss.some(x => !x))) continue;
  const data = waysFor(corKey(w)); if (!data?.ways?.length) continue;
  const G = new Graph(data.ways, COST[w.kind]);
  w.segs = w.segs.map((ss, k) => ss.map((x, i) => x || stretch(G, w.parts[k][i], w.parts[k][i + 1]) || null));
}
for (const w of works) {
  const ne = neRoutes(w.region)[w.id];
  let ok = 0, bad = 0;
  const parts = w.parts.map((pts, k) => {
    const out = [pts[0]];
    w.segs[k].forEach((p, i) => {
      if (p) { if (out.length === 1 && km(out[0], p[0]) > 3) out[0] = p[0]; out.push(...p.slice(1)); ok++; }
      else { out.push(...(neStretch(ne, pts[i], pts[i + 1]) || [pts[i + 1]])); bad++; }   // the earlier (Natural Earth) route there
    });
    return simplify(out);
  });
  if (!ok) { stat.none++; continue; }
  stat[bad ? 'part' : 'osm']++;
  const ref = refOf(w);
  result[w.region][w.id] = { parts, src: bad ? 'osm-mixed' : 'osm', net: w.kind === 'rail' || w.kind === 'hsr' ? 'rail' : 'road', osm: w.rels.slice(0, 4), ...(ref?.startsWith('Q') ? { wd: ref } : {}) };
}
console.log(`OSM: ${stat.osm} whole, ${stat.part} partly, ${stat.none} not found (kept Natural Earth). Lines can be pinned to an OSM relation in data-pipeline/osm/manual.tsv`);

// ---- write routes_osm.json and patch the built region data
// On Windows a file another program holds open (an editor, a virus scan, a sync client, git) cannot be replaced
// for a moment (EPERM / EBUSY): write a temporary file, then swap it in, trying again for about half a minute;
// if it still fails, say so and go on with the other regions instead of stopping the whole run.
async function save(f, text) {
  const tmp = f + '.tmp';
  for (let i = 0; i < 8; i++) {
    try { fs.writeFileSync(tmp, text); fs.renameSync(tmp, f); return true; }
    catch (e) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      if (i === 0) note(`${path.relative(ROOT, f)} 被其他程式占用（${e.code}），稍候重試…`);
      await sleep(4000);
    }
  }
  try { fs.unlinkSync(tmp); } catch { /* gone already */ }
  note(`無法寫入 ${path.relative(ROOT, f)}：請關閉開著它的程式（編輯器、防毒、雲端同步），或檢查是否被設為唯讀，再執行一次。`);
  console.log();
  return false;
}
const failed = [];
for (const r of REGIONS) {
  const res = result[r];
  if (!await save(path.join(DP, r, 'routes_osm.json'), JSON.stringify(res))) { failed.push(r); continue; }
  const f = path.join(ROOT, 'public', 'data', r + '.json');
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let n = 0;
  for (const x of d.works || []) {
    const o = res[x.id]; if (!o) continue;
    x.path = o.parts.reduce((a, b) => (b.length > a.length ? b : a));
    if (o.parts.length > 1) x.parts = o.parts; else delete x.parts;
    x.src = o.src; x.net = o.net; x.osm = o.osm; n++;
  }
  if (!await save(f, JSON.stringify(d))) { failed.push(r); continue; }
  const lines = works.filter(w => w.region === r).length;
  console.log(`${r}: ${n} routes from OpenStreetMap` + (n < lines ? `（其餘 ${lines - n} 條在 OSM 找不到對應的路線關係，沿用 Natural Earth）` : ''));
}
if (failed.length) { console.log(`未能寫入：${failed.join(', ')}`); process.exitCode = 1; }
