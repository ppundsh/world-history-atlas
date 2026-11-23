import fs from 'node:fs';
import { onLand, distDeg } from '/home/claude/proj/data-pipeline/cables/geo.mjs';
import { geoInterpolate } from 'd3-geo';
const R = ['taiwan','china','prc','japan','korea','vietnam','thailand','indonesia','philippines','india','iran','turkey','egypt','morocco','russia','poland','germany','france','uk','spain','italy','usa','mexico','brazil','argentina'];
const SEA = /艦|海戰|航|船|渡海|海路|登陸|艦隊|fleet|voyage|sail|naval|移民|移居|奴隸|使節|遠征|撤退|空襲|飛/;
for (const r of R) {
  const d = JSON.parse(fs.readFileSync(`/home/claude/proj/public/data/${r}.json`));
  for (const f of d.flows || []) for (const p of f.parts || [f.path]) for (let k = 1; k < p.length; k++) {
    const a = p[k - 1], b = p[k], L = distDeg(a, b); if (L < 2) continue;
    const n = Math.ceil(L / 0.05), g = geoInterpolate(a, b); let land = 0, cur = 0, maxRun = 0;
    for (let i = 0; i <= n; i++) { const q = g(i / n); if (onLand(q[0], q[1])) { land++; cur++; maxRun = Math.max(maxRun, cur); } else cur = 0; }
    const fr = land / (n + 1), endsSea = !onLand(...a) || !onLand(...b);
    if (endsSea && fr > 0.03 && maxRun * 0.05 > 0.6) console.log(r, f.id, f.n[1].slice(0, 26), `${a.join(',')}→${b.join(',')}`, Math.round(fr * 100) + '%', 'run ' + (maxRun * 0.05).toFixed(1) + '°');
  }
}
