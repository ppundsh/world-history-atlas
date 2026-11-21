// Event places: when the timeline passes an event, a pulsing dot marks where it happened, with its picture
// (when Wikipedia has a free one) and name, for several seconds before it fades. Pointing at the picture keeps
// it; clicking opens the event (or the country, for a capital). Drawn by both renderers.

import { placePicture, leader, slideTo } from './flat.js';
const LIFE = 11000, FADE = 3000, MAX = 4;
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
  pulses.push({ ...p, t0: clock() });
  while (pulses.length > MAX) { const i = pulses.findIndex(q => q !== held); pulses.splice(i < 0 ? 0 : i, 1); }
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
    if (p === held) { p.t0 = Math.max(p.t0, now - (LIFE - FADE) * 0.5); continue; }
    if (now - p.t0 > LIFE) pulses.splice(i, 1);
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
export function reservePulses(project, placed) {
  for (const p of pulses) {
    p.xy = project([p.lon, p.lat]); p.at = null;
    if (!p.xy || !p.img) continue;
    const [tx, ty] = placePicture(p.xy[0], p.xy[1], S, placed);
    placed.push([tx - 3, ty - 3, tx + S + 3, ty + S + 3]);
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
    const alpha = age < LIFE - FADE ? 1 : Math.max(0, (LIFE - age) / FADE);
    ctx.save(); ctx.globalAlpha = alpha;
    // ring spreading out once a second
    const f = (wall % 1200) / 1200, rgb = p.cap ? '202,138,4' : '220,38,38', solid = `rgb(${rgb})`;
    ctx.beginPath(); ctx.arc(x, y, 6 + f * 16, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb},${(1 - f) * 0.8})`; ctx.lineWidth = 2.5; ctx.stroke();
    if (!p.cap) { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = solid; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    let top = y - 12, lx = x;
    p.box = [x - 10, y - 10, x + 10, y + 10];
    if (p.img && p.at) {
      const s = S, im = p.img, [x0, y0] = slideTo('p:' + p.key, x, y, p.at[0], p.at[1]);
      leader(ctx, x, y, x0 - 3, y0 - 3, s + 6, solid);
      const r = Math.max(s / im.naturalWidth, s / im.naturalHeight), w = s / r, h = s / r;
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6; ctx.fillStyle = '#fff';
      ctx.fillRect(x0 - 3, y0 - 3, s + 6, s + 6); ctx.shadowBlur = 0;
      ctx.drawImage(im, (im.naturalWidth - w) / 2, (im.naturalHeight - h) / 2, w, h, x0, y0, s, s);
      ctx.strokeStyle = solid; ctx.lineWidth = p === held ? 3.5 : 2; ctx.strokeRect(x0 - 3, y0 - 3, s + 6, s + 6);
      if (p.credit) { ctx.font = `9px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(p.credit, x0 + s / 2, y0 + s + 5); ctx.fillStyle = '#444'; ctx.fillText(p.credit, x0 + s / 2, y0 + s + 5); }
      top = y0 - 6; lx = x0 + s / 2;
      p.box = [x0 - 3, y0 - 20, x0 + s + 3, y0 + s + 3];
    }
    ctx.font = `700 12px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    if (p.name) { ctx.strokeText(p.name, lx, top); ctx.fillStyle = p.cap ? '#713f12' : '#7f1d1d'; ctx.fillText(p.name, lx, top); }
    ctx.restore();
  }
}
