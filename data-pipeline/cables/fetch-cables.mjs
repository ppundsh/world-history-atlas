// Download the submarine cable routes from TeleGeography's Submarine Cable Map (https://www.submarinecablemap.com,
// CC BY-NC-SA 3.0; one request, about 10 MB, cached in data-pipeline/sources/cables/) and rebuild every cable
// listed in data-pipeline/cables/cables.tsv (build-cables.mjs) — only when the routes, cables.tsv or the build code changed.
//   node data-pipeline/cables/fetch-cables.mjs [--refresh]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const DP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(DP, 'sources', 'cables'), f = path.join(dir, 'cable-geo.json');
const URL = 'https://www.submarinecablemap.com/api/v3/cable/cable-geo.json';
fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(f) || process.argv.includes('--refresh')) {
  process.stdout.write('下載 TeleGeography 海纜路線 … ');
  let ok = false;
  for (let i = 0; i < 4 && !ok; i++) {
    try {
      const r = await fetch(URL, { signal: AbortSignal.timeout(180000), headers: { 'User-Agent': 'WorldHistoryAtlas/1.0 (https://github.com/ppundsh/world-history-atlas)' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j.features?.length) throw new Error('沒有資料');
      fs.writeFileSync(f, JSON.stringify(j)); ok = true;
      console.log(`${j.features.length} 條`);
    } catch (e) { console.log(`失敗（${e.message}），${10 * (i + 1)} 秒後重試`); await new Promise(s => setTimeout(s, 10000 * (i + 1))); }
  }
  if (!ok) { console.log('無法下載，沿用原有路線。'); process.exit(1); }
}
// rebuild only when something it depends on changed: the downloaded routes, cables.tsv, or the build code
import crypto from 'node:crypto';
const stampFile = path.join(dir, 'built.json');
const h = crypto.createHash('sha1');
for (const x of [f, path.join(DP, 'cables', 'cables.tsv'), path.join(DP, 'cables', 'build-cables.mjs'), path.join(DP, 'cables', 'geo.mjs'), path.join(DP, '..', 'public', 'data', 'base50.json')])
  h.update(fs.readFileSync(x));
const stamp = h.digest('hex');
if (!process.argv.includes('--refresh') && fs.existsSync(stampFile) && JSON.parse(fs.readFileSync(stampFile, 'utf8')).stamp === stamp) {
  console.log('海纜路線與 cables.tsv 都沒有變動，略過重建。');
} else {
  execFileSync(process.execPath, [path.join(DP, 'cables', 'build-cables.mjs')], { stdio: 'inherit' });
  fs.writeFileSync(stampFile, JSON.stringify({ stamp, at: new Date().toISOString() }));
}
