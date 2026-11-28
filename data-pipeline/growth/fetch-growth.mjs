// World-mode growth counts: how many airports, ports and submarine cables there were in each year.
//   airports, ports — Wikidata (CC0): items that are an airport (Q1248784) or a port (Q44782), or a subclass of
//                     one, with a date of official opening (P1619) or inception (P571), and a closing date
//                     (P3999 date of official closure, or P576 dissolved) when there is one. Two SPARQL requests.
//   cables          — TeleGeography Submarine Cable Map (CC BY-NC-SA 3.0): the ready-for-service year of each
//                     cable listed in data-pipeline/sources/cables/cable-geo.json (fetch-cables.mjs), one small
//                     request per cable, one at a time with a pause between them, cached in
//                     data-pipeline/sources/growth/cables/ so that later runs fetch only new cables.
// Writes data-pipeline/growth/airports.tsv, ports.tsv and cables.tsv, then runs build-growth.mjs.
//   node data-pipeline/growth/fetch-growth.mjs [--refresh] [--delay 1000] [--no-cables]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { line } from '../lib/progress.mjs';
const DP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(DP, 'growth'), CACHE = path.join(DP, 'sources', 'growth'), CCACHE = path.join(CACHE, 'cables');
const args = process.argv.slice(2), REFRESH = args.includes('--refresh');
const DELAY = Math.max(500, +(args[args.indexOf('--delay') + 1] || 1000) || 1000);
const UA = 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas; growth counts build)';
fs.mkdirSync(CCACHE, { recursive: true });
const sleep = ms => new Promise(s => setTimeout(s, ms));

const query = cls => `SELECT ?a (MIN(YEAR(?open)) AS ?o) (MIN(YEAR(?close)) AS ?c) WHERE {
  ?a wdt:P31/wdt:P279* wd:${cls} .
  { ?a wdt:P1619 ?open } UNION { ?a wdt:P571 ?open }
  OPTIONAL { { ?a wdt:P3999 ?close } UNION { ?a wdt:P576 ?close } }
} GROUP BY ?a`;

async function sparql(name, cls) {
  const f = path.join(CACHE, name + '.json');
  if (fs.existsSync(f) && !REFRESH) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', signal: AbortSignal.timeout(180000),
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query: query(cls) }) });
      if (r.status === 429 || r.status >= 500) { console.log(`  Wikidata ${r.status}，稍後重試`); await sleep(30000 * (i + 1)); continue; }
      if (!r.ok) { console.log(`  Wikidata ${r.status}`); return null; }
      const j = await r.json();
      fs.writeFileSync(f, JSON.stringify(j));
      return j;
    } catch (e) { console.log(`  ${e.name === 'TimeoutError' ? '沒有回應' : '連線失敗'}，重試`); await sleep(15000); }
  }
  return null;
}

const NOW = new Date().getFullYear();
for (const [name, cls, label, src] of [['airports', 'Q1248784', '機場', 'airport (Q1248784)'], ['ports', 'Q44782', '港口', 'port (Q44782)']]) {
  process.stdout.write(`${label}（Wikidata）… `);
  const j = await sparql(name, cls);
  if (!j) { console.log('失敗，沿用原有資料。'); continue; }
  const rows = [];
  for (const b of j.results.bindings) {
    const o = +b.o?.value, c = b.c ? +b.c.value : null;
    if (!(o >= 1800 && o <= NOW)) continue;           // undated, or a date that is clearly not an opening
    rows.push([b.a.value.split('/').pop(), o, c && c >= o && c <= NOW ? c : '']);
  }
  rows.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  fs.writeFileSync(path.join(OUT, name + '.tsv'), `# Wikidata (CC0), read ${new Date().toISOString().slice(0, 10)}: items that are an ${src} or a subclass of one, with a date of official opening (P1619) or inception (P571), from 1800 on; closing year from P3999 or P576.\n# qid\topened\tclosed\n` + rows.map(r => r.join('\t')).join('\n') + '\n');
  console.log(`${rows.length} 處有年份`);
  await sleep(5000);
}

if (!args.includes('--no-cables')) {
  const geo = path.join(DP, 'sources', 'cables', 'cable-geo.json');
  if (!fs.existsSync(geo)) console.log('沒有 cable-geo.json；請先執行 .\\fetch-offline.ps1 -CablesOnly。');
  else {
    const ids = [...new Set(JSON.parse(fs.readFileSync(geo, 'utf8')).features.map(f => f.properties.id))].sort();
    const todo = ids.filter(id => REFRESH || !fs.existsSync(path.join(CCACHE, id + '.json')));
    console.log(`海纜啟用年（TeleGeography）：共 ${ids.length} 條，需下載 ${todo.length} 條（每條間隔 ${DELAY} 毫秒，約 ${Math.ceil(todo.length * (DELAY + 300) / 60000)} 分鐘）`);
    let n = 0, fail = 0;
    for (const id of todo) {
      try {
        const r = await fetch(`https://www.submarinecablemap.com/api/v3/cable/${encodeURIComponent(id)}.json`, { signal: AbortSignal.timeout(60000), headers: { 'User-Agent': UA } });
        if (r.status === 429 || r.status >= 500) { console.log(`\n  TeleGeography ${r.status}，暫停一分鐘`); await sleep(60000); fail++; }
        else if (r.ok) { const j = await r.json(); fs.writeFileSync(path.join(CCACHE, id + '.json'), JSON.stringify({ id, rfs: j.rfs ?? null, rfs_year: j.rfs_year ?? null, is_planned: j.is_planned ?? null, length: j.length ?? null })); }
        else fail++;
      } catch { fail++; }
      if (++n % 25 === 0) line(`  ${n}/${todo.length}`);
      if (fail > 20) { console.log('\n  失敗太多次，先停止；稍後再執行會從中斷處繼續。'); break; }
      await sleep(DELAY);
    }
    const rows = [];
    for (const id of ids) {
      const f = path.join(CCACHE, id + '.json'); if (!fs.existsSync(f)) continue;
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      const y = +j.rfs_year || +(String(j.rfs || '').match(/(1[89]\d\d|20\d\d)/) || [])[1];
      if (y) rows.push([id, y, j.is_planned ? 'P' : '']);
    }
    fs.writeFileSync(path.join(OUT, 'cables.tsv'), `# TeleGeography Submarine Cable Map (CC BY-NC-SA 3.0, https://www.submarinecablemap.com), read ${new Date().toISOString().slice(0, 10)}: ready-for-service year of each cable on the map (cables in service or planned; retired cables are not on the map). P = planned.\n# id\trfs\tplanned\n` + rows.map(r => r.join('\t')).join('\n') + '\n');
    console.log(`\n海纜：${rows.length} 條有啟用年`);
  }
}

execFileSync(process.execPath, [path.join(OUT, 'build-growth.mjs')], { stdio: 'inherit' });
