// Event system (off by default; turned on with ?events in the URL).
// An event is a sequence of dated keyframes drawn over the normal map: control areas, front lines, arrows, markers.
// Data: public/data/events/*.json, compiled and validated by data-pipeline/events/build.mjs.
const BASE = import.meta.env.BASE_URL + 'data/events/';
const ICON = { battle: '⚔', siege: '◎', capture: '⚑', treaty: '✎', city: '●', note: '•' };

export const eventsEnabled = () => new URLSearchParams(location.search).has('events');

export class EventLayer {
  constructor(app) { this.app = app; this.index = null; this.ev = null; this.i = 0; }
  async loadIndex() { this.index ??= await fetch(BASE + 'index.json').then(r => r.json()); return this.index; }
  async open(id) {
    this.ev = await fetch(BASE + id + '.json').then(r => r.json());
    this.i = 0; return this.ev;
  }
  close() { this.ev = null; }
  get frame() { return this.ev?.keyframes[this.i]; }
  step(d) { if (!this.ev) return; this.i = Math.max(0, Math.min(this.ev.keyframes.length - 1, this.i + d)); }

  // draw the current keyframe on the flat map (screen coordinates through proj)
  draw(ctx, proj, col) {
    const k = this.frame; if (!k) return;
    const side = id => this.ev.sides.find(s => s.id === id)?.color || '#444';
    const path = (line, close) => { let ok = false; ctx.beginPath(); for (const p of line) { const q = proj(p); if (!q) continue; ok ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); ok = true; } if (close) ctx.closePath(); return ok; };
    ctx.save();
    for (const a of k.areas) { ctx.fillStyle = side(a.side) + '55'; ctx.strokeStyle = side(a.side); ctx.lineWidth = 1.5; for (const r of a.polygon) if (path(r, true)) { ctx.fill(); ctx.stroke(); } }
    ctx.setLineDash([7, 4]);
    for (const f of k.fronts) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; if (path(f.line)) ctx.stroke(); ctx.strokeStyle = '#d0021b'; ctx.lineWidth = 2.5; ctx.stroke(); }
    ctx.setLineDash([]);
    for (const a of k.arrows) {
      const pts = a.line.map(p => proj(p)).filter(Boolean); if (pts.length < 2) continue;
      ctx.strokeStyle = side(a.side); ctx.fillStyle = side(a.side); ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); pts.forEach((q, j) => j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
      const [x0, y0] = pts.at(-2), [x1, y1] = pts.at(-1), t = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath(); ctx.moveTo(x1 + 4 * Math.cos(t), y1 + 4 * Math.sin(t));
      ctx.lineTo(x1 - 14 * Math.cos(t - 0.5), y1 - 14 * Math.sin(t - 0.5)); ctx.lineTo(x1 - 14 * Math.cos(t + 0.5), y1 - 14 * Math.sin(t + 0.5)); ctx.fill();
    }
    ctx.font = '600 13px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    for (const m of k.markers) {
      const q = proj([m.lon, m.lat]); if (!q) continue;
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#7a0000';
      const s = ICON[m.kind] + ' ' + (m.name[col] || m.name[0]);
      ctx.textAlign = 'left'; ctx.strokeText(s, q[0] - 6, q[1]); ctx.fillText(s, q[0] - 6, q[1]);
    }
    ctx.restore();
  }
}
