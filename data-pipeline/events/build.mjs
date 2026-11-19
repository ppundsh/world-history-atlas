// Event system: validate every data-pipeline/events/*.json and compile it for the site.
//   node data-pipeline/events/build.mjs           → public/data/events/index.json + <id>.json
//   node data-pipeline/events/build.mjs --check   → validate only (exit 1 on any error)
// Format and the standard process for adding an event: docs/事件系統.md. Copy _template.json to start.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import * as OpenCC from 'opencc-js';

const dir = new URL('./', import.meta.url), out = new URL('../../public/data/events/', import.meta.url);
const CATS = JSON.parse(readFileSync(new URL('categories.json', dir)));
const LANGS = ['zh-Hant', 'en', 'ja'];
const KINDS = ['battle', 'siege', 'capture', 'treaty', 'city', 'note'];
const toHans = OpenCC.Converter({ from: 'tw', to: 'cn' });
const check = process.argv.includes('--check');
const errors = [], index = [];

const isDate = s => typeof s === 'string' && /^-?\d{1,4}(-\d\d(-\d\d)?)?$/.test(s);
const num = s => { const [y, m = 1, d = 1] = s.replace(/^-/, 'N').split('-'); return (s.startsWith('-') ? -1 : 1) * +y.replace('N', '') + (m - 1) / 12 + (d - 1) / 372; };
const ll = p => Array.isArray(p) && p.length === 2 && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
// multilingual text → [en, hant, hans, ja] (LANGS.col order) (hans converted from hant by OpenCC)
function text(o, where, need = true) {
  if (o == null && !need) return null;
  for (const l of LANGS) if (!o?.[l]?.trim()) errors.push(`${where}: missing ${l}`);
  return [o?.en || '', o?.['zh-Hant'] || '', toHans(o?.['zh-Hant'] || ''), o?.ja || ''];
}

for (const file of readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_') && f !== 'categories.json').sort()) {
  let e; const at = file;
  try { e = JSON.parse(readFileSync(new URL(file, dir))); } catch (x) { errors.push(`${at}: invalid JSON (${x.message})`); continue; }
  if (e.id + '.json' !== file) errors.push(`${at}: id must equal the file name`);
  if (!CATS[e.category]) errors.push(`${at}: category "${e.category}" not in categories.json`);
  if (!isDate(e.start) || !isDate(e.end) || num(e.start) > num(e.end)) errors.push(`${at}: bad start/end`);
  if (!(e.view && ll([e.view.lon, e.view.lat]) && e.view.k > 0)) errors.push(`${at}: bad view`);
  if (!e.sources?.length || e.sources.some(s => !/^https?:\/\//.test(s.url) || !s.title)) errors.push(`${at}: every event needs sources with title and url`);
  const sides = new Map((e.sides || []).map(s => [s.id, s]));
  for (const s of e.sides || []) { text(s.name, `${at} side ${s.id}`); if (!/^#[0-9a-f]{6}$/i.test(s.color)) errors.push(`${at} side ${s.id}: colour must be #rrggbb`); }
  let prev = -Infinity;
  const kfs = (e.keyframes || []).map((k, i) => {
    const w = `${at} keyframe ${i} (${k.date})`;
    if (!isDate(k.date)) errors.push(`${w}: bad date`);
    else {
      const n = num(k.date);
      if (n < prev) errors.push(`${w}: keyframes must be in date order`);
      if (n < num(e.start) || n > num(e.end) + 1) errors.push(`${w}: outside start/end`);
      prev = n;
    }
    if (!k.src?.length || k.src.some(j => !e.sources?.[j])) errors.push(`${w}: src must list indexes into sources`);
    const side = (o, what) => { if (o.side && !sides.has(o.side)) errors.push(`${w} ${what}: unknown side ${o.side}`); };
    for (const a of k.areas || []) { side(a, 'area'); if (!a.polygon?.every(r => r.length >= 4 && r.every(ll))) errors.push(`${w}: area polygon must be rings of [lon,lat]`); }
    for (const f of k.fronts || []) if (!(f.line?.length >= 2 && f.line.every(ll))) errors.push(`${w}: front line must be ≥2 [lon,lat]`);
    for (const a of k.arrows || []) { side(a, 'arrow'); if (!(a.line?.length >= 2 && a.line.every(ll))) errors.push(`${w}: arrow must be ≥2 [lon,lat]`); }
    for (const m of k.markers || []) { if (!KINDS.includes(m.kind)) errors.push(`${w}: marker kind must be one of ${KINDS}`); if (!ll([m.lon, m.lat])) errors.push(`${w}: marker position`); }
    return {
      date: k.date, t: num(k.date), caption: text(k.caption, w), src: k.src,
      areas: (k.areas || []).map(a => ({ side: a.side, polygon: a.polygon })),
      fronts: (k.fronts || []).map(f => ({ line: f.line })),
      arrows: (k.arrows || []).map(a => ({ side: a.side, line: a.line })),
      markers: (k.markers || []).map(m => ({ kind: m.kind, lon: m.lon, lat: m.lat, name: text(m.name, `${w} marker`) })),
    };
  });
  if (!kfs.length) errors.push(`${at}: needs at least one keyframe`);
  const ev = {
    id: e.id, category: e.category, title: text(e.title, `${at} title`), summary: text(e.summary, `${at} summary`),
    start: e.start, end: e.end, view: e.view,
    sides: (e.sides || []).map(s => ({ id: s.id, color: s.color, name: text(s.name, `${at} side`) })),
    sources: e.sources, keyframes: kfs,
  };
  index.push({ id: ev.id, category: ev.category, title: ev.title, start: ev.start, end: ev.end });
  if (!check) { mkdirSync(out, { recursive: true }); writeFileSync(new URL(ev.id + '.json', out), JSON.stringify(ev)); }
}
if (errors.length) { console.error(errors.map(e => '✗ ' + e).join('\n')); process.exit(1); }
if (!check) writeFileSync(new URL('index.json', out), JSON.stringify({ categories: Object.fromEntries(Object.entries(CATS).map(([k, v]) => [k, { color: v.color, name: [v.name[2], v.name[0], v.name[1], v.name[3]] }])), events: index }));
console.log(`events: ${index.length} valid` + (check ? '' : ' → public/data/events/'));
