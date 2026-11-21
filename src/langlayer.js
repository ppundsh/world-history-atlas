// Drawing for the "development of languages" mode, shared by the flat map and the globe:
// language areas (tinted ellipses) and migrations (great-circle arrows that grow while they happen).
import { geoInterpolate, geoDistance } from 'd3-geo';

// a position along a path of [lon, lat] points (straight great-circle legs), t from 0 to 1
function along(path) {
  const legs = [], len = [];
  for (let i = 1; i < path.length; i++) { legs.push(geoInterpolate(path[i - 1], path[i])); len.push(geoDistance(path[i - 1], path[i])); }
  const total = len.reduce((a, b) => a + b, 0) || 1;
  return t => { let d = t * total; for (let i = 0; i < legs.length; i++) { if (d <= len[i] || i === legs.length - 1) return legs[i](len[i] ? Math.min(1, d / len[i]) : 1); d -= len[i]; } return path[path.length - 1]; };
}

// path(geometry) adds the geometry to the context's current path; project([lon, lat]) → [x, y] or null
export function drawLang(ctx, L, path, project, font, zoom = 1) {
  if (!L) return;
  ctx.save();
  for (const a of L.areas) {
    ctx.beginPath(); path(a.geometry);
    const fade = 1 - 0.75 * (a.fading || 0);
    ctx.globalAlpha = (0.26 + 0.25 * a.fresh) * fade; ctx.fillStyle = a.color; ctx.fill();
    ctx.globalAlpha = 0.9 * fade; ctx.lineWidth = 1.4 + 1.6 * a.fresh; ctx.strokeStyle = a.color; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
  if (L.works) drawWorks(ctx, L.works, path, project, font);
  for (const f of L.flows) {
    if (f.p <= 0) continue;
    const interp = f.path ? along(f.path) : geoInterpolate(f.from, f.to), n = f.path ? 20 * f.path.length : 40, pts = [];
    for (let i = 0; i <= n; i++) pts.push(interp(f.p * i / n));
    const w = 1.6 + f.wt * 1.1;
    ctx.globalAlpha = f.alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); path({ type: 'LineString', coordinates: pts });
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = w + 3; ctx.stroke();
    ctx.strokeStyle = f.color; ctx.lineWidth = w; ctx.stroke();
    // arrowhead at the moving tip
    const tip = project(pts[n]), back = project(interp(Math.max(0, f.p - Math.max(0.04, 0.6 / Math.max(1, zoom)) * 0.25)));
    if (tip && back && !f.noHead) {
      let dx = tip[0] - back[0], dy = tip[1] - back[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const s = 6 + w * 1.6;
      ctx.beginPath();
      ctx.moveTo(tip[0] + dx * s * 0.5, tip[1] + dy * s * 0.5);
      ctx.lineTo(tip[0] - dx * s + dy * s * 0.6, tip[1] - dy * s - dx * s * 0.6);
      ctx.lineTo(tip[0] - dx * s - dy * s * 0.6, tip[1] - dy * s + dx * s * 0.6);
      ctx.closePath(); ctx.fillStyle = f.color; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    // name beside the middle of the drawn part
    const mid = project(interp(f.p / 2));
    if (mid && f.p > 0.25 && f.label) {
      ctx.font = `600 11px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.strokeText(f.label, mid[0], mid[1] - 4);
      ctx.fillStyle = f.color; ctx.fillText(f.label, mid[0], mid[1] - 4);
    }
  }
  ctx.restore();
}

// a minimal path drawer from a point projection (for the globe overlay): breaks lines where a point is hidden
export function pathFromProject(ctx, project) {
  const line = coords => { let pen = false; for (const c of coords) { const p = project(c); if (!p) { pen = false; continue; } pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); pen = true; } };
  return g => {
    if (g.type === 'LineString') line(g.coordinates);
    else if (g.type === 'Polygon') for (const r of g.coordinates) { line(r); ctx.closePath(); }
  };
}

// major works (railways, motorways, canals …): the network built so far, faint, and each new section drawn
// along its route as it opens, highlighted for a while with its name
const WORK_STYLE = { rail: { w: 2.2, dash: [5, 4] }, hsr: { w: 2.6, dash: [7, 4] }, highway: { w: 2.6 }, road: { w: 1.8 }, canal: { w: 2.2, dash: [2, 3] }, pipeline: { w: 1.6, dash: [6, 3] }, fiber: { w: 1.8, dash: [2, 2] }, cable: { w: 1.8, dash: [8, 3] }, grid: { w: 1.6, dash: [10, 2, 2, 2] } };
function drawWorks(ctx, W, path, project, font) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const n of W.net) {
    if (n.alpha <= 0.02) continue;
    const st = WORK_STYLE[n.kind] || { w: 1.6 };
    ctx.globalAlpha = 0.55 * n.alpha;
    ctx.beginPath(); path({ type: 'LineString', coordinates: n.path });
    ctx.strokeStyle = n.color; ctx.lineWidth = Math.max(1, st.w * 0.55); ctx.stroke();
  }
  for (const l of W.lines) {
    if (l.p <= 0) continue;
    const st = WORK_STYLE[l.kind] || { w: 2 }, interp = along(l.path), n = 20 * l.path.length, pts = [];
    for (let i = 0; i <= n; i++) pts.push(interp(l.p * i / n));
    ctx.globalAlpha = l.alpha;
    ctx.beginPath(); path({ type: 'LineString', coordinates: pts });
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = st.w + 4; ctx.stroke();
    ctx.strokeStyle = l.color; ctx.lineWidth = st.w + 1.2; ctx.stroke();
    if (st.dash) { ctx.setLineDash(st.dash); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, st.w * 0.45); ctx.stroke(); ctx.setLineDash([]); }
    const mid = project(interp(l.p / 2));
    if (mid && l.p > 0.25 && l.label) {
      ctx.font = `600 11px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.strokeText(l.label, mid[0], mid[1] - 4);
      ctx.fillStyle = l.color; ctx.fillText(l.label, mid[0], mid[1] - 4);
    }
  }
  ctx.globalAlpha = 1;
}
