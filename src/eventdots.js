// Event places: when the timeline passes an event, a pulsing dot marks where it happened, with its picture
// (when Wikipedia has a free one) and name, for several seconds before it fades. Pointing at the picture keeps
// it; clicking opens the event (or the country, for a capital). Drawn by both renderers.

import { placePicture, leader, slideTo, cardDims, reserveCard, drawCard } from './flat.js';
const LIFE = 11000, FADE = 3000, MAX = 4;
// when newer events push a picture out (more than MAX at once), it still stays at least MIN_SHOW, then fades
// over OUT_FADE instead of vanishing; at most HARD pictures are on the map, fading ones included
const MIN_SHOW = 5000, OUT_FADE = 1500, HARD = 9;
let S = 56, pausedAt = performance.now();         // the timeline starts paused: pictures don't age while it is
export function setPulseSize(px) { S = Math.max(30, Math.min(140, px)); }
// pictures only age while the timeline plays; pausing freezes them where they are
export function setPulsesPaused(on) {
  const now = performance.now();
  if (on) { if (pausedAt == null) pausedAt = now; return; }
  if (pausedAt != null) { for (const p of pulses) p.t0 += now - Math.max(pausedAt, p.t0); pausedAt = null; }
}
const clock = () => pausedAt ?? performance.now();
const pulses = [];
let held = null;

export function addPulse(p) {
  const old = pulses.findIndex(q => q.key === p.key);
  if (old >= 0) pulses.splice(old, 1);
  const now = clock();
  pulses.push({ ...p, t0: now });
  // the oldest pictures beyond MAX are sent on their way: after their minimum time, they fade out
  const staying = pulses.filter(q => q.out == null && q !== held);
  for (let k = 0; k < staying.length - MAX; k++) staying[k].out = Math.max(now, staying[k].t0 + MIN_SHOW);
  while (pulses.length > HARD) { const i = pulses.findIndex(q => q !== held); pulses.splice(i < 0 ? 0 : i, 1); }
}
export function removePulse(key) { const i = pulses.findIndex(q => q.key === key); if (i >= 0) pulses.splice(i, 1); }
export function setPulseThumb(key, url, onload, credit = '') {
  const p = pulses.find(q => q.key === key); if (!p || !url) return;
  p.credit = credit;
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => { p.img = img; onload?.(); }; img.src = url;
}
// the pointer is over a picture: it stops ageing (and comes back to full strength) until the pointer leaves
export function holdPulse(p) { held = p && pulses.includes(p) ? p : null; }
export function pulsesActive(now = clock()) {
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    if (p === held) { p.t0 = Math.max(p.t0, now - (LIFE - FADE) * 0.5); p.out = null; continue; }
    if (now - p.t0 > LIFE || (p.out != null && now > p.out + OUT_FADE)) pulses.splice(i, 1);
  }
  return pulses.length > 0;
}
export function removePulses(test) { for (let i = pulses.length - 1; i >= 0; i--) if (test(pulses[i])) { if (pulses[i] === held) held = null; pulses.splice(i, 1); } }
export function clearPulses() { pulses.length = 0; held = null; }
// which picture (or dot) is under the pointer, from the last drawing
export function pulseAt(x, y) {
  for (let i = pulses.length - 1; i >= 0; i--) { const b = pulses[i].box; if (b && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return pulses[i]; }
  return null;
}

// Before the markers are drawn: the event pictures claim their places first (they are the newest), so the
// markers' own pictures move out of their way. project: [lon, lat] → [x, y] in CSS pixels, or null.
export function reservePulses(project, placed, font = 'sans-serif') {
  for (const p of pulses) {
    p.xy = project([p.lon, p.lat]); p.at = null;
    if (!p.xy || !p.img) continue;
    p.dims = cardDims(S, p.name, font);
    const [tx, ty] = placePicture(p.xy[0], p.xy[1], S, placed, p.dims[0], p.dims[1]);
    reserveCard(placed, tx, ty, p.dims);
    p.at = [tx, ty];
  }
}

export function drawPulses(ctx, font) {
  const now = clock(), wall = performance.now();
  if (!pulsesActive(now)) return;
  for (const p of pulses) {
    p.box = null;
    if (!p.xy) continue;
    const [x, y] = p.xy, age = Math.max(0, now - p.t0);
    let alpha = age < LIFE - FADE ? 1 : Math.max(0, (LIFE - age) / FADE);
    if (p.out != null && now > p.out) alpha = Math.min(alpha, Math.max(0, 1 - (now - p.out) / OUT_FADE));
    if (alpha <= 0) continue;
    ctx.save(); ctx.globalAlpha = alpha;
    // ring spreading out once a second
    const f = (wall % 1200) / 1200, rgb = p.cap ? '202,138,4' : '220,38,38', solid = `rgb(${rgb})`;
    ctx.beginPath(); ctx.arc(x, y, 6 + f * 16, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb},${(1 - f) * 0.8})`; ctx.lineWidth = 2.5; ctx.stroke();
    if (!p.cap) { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = solid; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    let top = y - 12, lx = x;
    p.box = [x - 10, y - 10, x + 10, y + 10];
    if (p.img && p.at) {
      // the name is part of the picture's card
      const s = S, d = p.dims || cardDims(s, p.name, font), [bx, by] = slideTo('p:' + p.key, x, y, p.at[0], p.at[1]);
      leader(ctx, x, y, bx, by, d[0], solid, d[1]);
      drawCard(ctx, bx, by, d, s, p.img, solid, font, p === held ? 3.5 : 2);
      if (p.credit) { ctx.font = `9px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(p.credit, bx + d[0] / 2, by + d[1] + 3); ctx.fillStyle = '#444'; ctx.fillText(p.credit, bx + d[0] / 2, by + d[1] + 3); }
      p.box = [bx, by, bx + d[0], by + d[1]];
    } else {
      ctx.font = `700 12px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      if (p.name) { ctx.strokeText(p.name, lx, top); ctx.fillStyle = p.cap ? '#713f12' : '#7f1d1d'; ctx.fillText(p.name, lx, top); }
    }
    ctx.restore();
  }
}
