// The man-made disasters mode: data-pipeline/disaster/disasters.json (from make_json.py), families.tsv, focus.tsv,
// timeline.tsv → public/data/disaster.json, in the shape of the other thematic modes (families, areas, points,
// flows, events, focus, seg) plus what this mode adds:
//   areas[].poly   the range of each disaster as a polygon (circles, ellipses and plumes worked out here)
//   areas[].grow   years the range takes to spread from the site (it grows from there while the timeline plays)
//   areas[].keep   year until which a faded range stays (exclusion zones, long-term contamination)
//   areas[].k      the card's facts: date, deaths, scale, what the range is based on
//   flows[].grow   years a downstream or drift route takes to run its length
//   fade           years over which a range fades after its acute phase
//   node data-pipeline/disaster/build_disaster.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';
import { geoArea } from 'd3-geo';

const here = path.dirname(fileURLToPath(import.meta.url));
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });
const rows = (f, n) => fs.readFileSync(path.join(here, f), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map((l, i) => {
  const c = l.split('\t'); if (c.length !== n) throw new Error(`${f} line ${i}: ${c.length} columns, expected ${n}`); return c;
});
const fam = rows('families.tsv', 6).map(([id, color, sym, hant, en, ja]) => ({ id, color, sym, n: [en, hant, toHans(hant), ja] }));
const D = JSON.parse(fs.readFileSync(path.join(here, 'disasters.json'), 'utf8'));
const r4 = v => Math.round(v * 1e4) / 1e4;

// date → fractional year (the middle of the month or the day)
function yearOf(dt) {
  const [y, m, d] = dt.split('-').map(Number);
  if (!m) return y;
  return y + (m - 1) / 12 + ((d || 15) - 1) / 365;
}
// a closed ring around (lon, lat): semi-axes a, b km, the a axis pointing to azimuth az (degrees clockwise from north)
function ellipse(lon, lat, a, b, az = 0, n = 72) {
  const t = az * Math.PI / 180, ky = 1 / 111.2, kx = 1 / (111.2 * Math.cos(lat * Math.PI / 180)), out = [];
  for (let i = 0; i <= n; i++) {
    const u = (i % n) / n * 2 * Math.PI, along = a * Math.cos(u), across = b * Math.sin(u);
    const east = along * Math.sin(t) + across * Math.cos(t), north = along * Math.cos(t) - across * Math.sin(t);
    out.push([r4(lon + east * kx), r4(lat + north * ky)]);
  }
  return out;
}
const pts = s => s.trim().split(/\s+/).map(p => { const q = p.split(',').map(Number); if (q.length !== 2 || q.some(v => !isFinite(v))) throw new Error('bad point ' + p); return q; });
function shape(e) {
  const [kind, body] = [e.sh[0], e.sh.slice(2)];
  const v = body.split(',').map(Number);
  if (kind === 'c') return ellipse(e.lon, e.lat, v[0], v[0]);
  if (kind === 'e') return ellipse(e.lon, e.lat, v[0], v[1], v[2] || 0);
  if (kind === 'p') {                        // a plume: from the site, len km long toward az
    const t = (v[2] || 0) * Math.PI / 180, h = v[0] / 2;
    const lon = e.lon + h * Math.sin(t) / (111.2 * Math.cos(e.lat * Math.PI / 180)), lat = e.lat + h * Math.cos(t) / 111.2;
    return ellipse(lon, lat, h, v[1] / 2, v[2] || 0);
  }
  const ring = pts(body); ring.push(ring[0]); return ring;
}
const facts = e => ({ date: e.dt, dead: e.dead || '', m: [e.men || '', e.mzh || '', toHans(e.mzh || ''), e.men || ''], r: [e.ren || '', e.rzh || '', toHans(e.rzh || ''), e.ren || ''] });
const names = e => [e.en, e.zh, toHans(e.zh), e.ja];
const descs = e => [e.den, e.dzh, toHans(e.dzh), e.den];
const wiki = e => [e.wzh || '', e.wen || '', e.wja || ''];

const areas = [], points = [], flows = [], events = [];
for (const e of D) {
  const a = yearOf(e.dt), y = Math.floor(a), b = e.b ?? y, kind = e.nolabel ? 'zone' : e.det ? 'detail' : 'main';
  const base = { id: e.id, f: e.c, a: r4(a), b, lon: e.lon, lat: e.lat, n: names(e), d: descs(e), w: wiki(e), k: facts(e), sz: e.sz || 1 };
  if (e.sh) {
    let poly = shape(e);
    // d3 fills the side of a ring on its right: a ring wound the other way would cover the rest of the globe
    if (geoArea({ type: 'Polygon', coordinates: [poly] }) > 2 * Math.PI) poly = poly.slice().reverse();
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    areas.push({ ...base, ...(e.k ? { keep: e.k } : {}), poly, rx: r4((Math.max(...xs) - Math.min(...xs)) / 2), ry: r4((Math.max(...ys) - Math.min(...ys)) / 2),
      ...(e.gd ? { grow: r4(e.gd / 365) } : {}), ...(kind !== 'main' ? { nolabel: 1 } : {}) });
  }
  if (e.rt) {
    const path = pts(e.rt);
    flows.push({ id: e.id, f: e.c, a: r4(a), b, from: path[0], to: path.at(-1), wt: Math.min(3, e.sz || 1), n: names(e), path, grow: r4((e.rd || 1) / 365) });
  }
  // the smaller events are points (shown once the map is zoomed in); a main event without a range gets its marker
  // from a point as well
  if (kind === 'detail' || (kind === 'main' && !e.sh)) points.push({ ...base, a: y, b: e.k ?? b + 3, ...(kind === 'main' ? { always: 1 } : {}) });
  if (kind !== 'zone') events.push({ y, lon: e.lon, lat: e.lat, n: names(e), d: descs(e), w: wiki(e), id: e.id });
}
events.sort((p, q) => p.y - q.y);
const focus = rows('focus.tsv', 8).map(([id, lon, lat, k, y, hant, en, ja]) => ({ id, lon: +lon, lat: +lat, k: +k, y: +y, n: [en, hant, toHans(hant), ja] }));
const seg = rows('timeline.tsv', 2).map(([y, p]) => [+y, +p]);
const out = { families: fam, areas, points, flows, events, focus, seg, fade: 4 };
fs.writeFileSync(path.join(here, '..', '..', 'public', 'data', 'disaster.json'), JSON.stringify(out));
console.log(`disaster.json: ${areas.length} ranges, ${points.length} points, ${flows.length} routes, ${events.length} events`);
