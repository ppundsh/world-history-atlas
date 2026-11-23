// Emphasis: what is under the pointer, and what was clicked, is drawn with a thicker outline. The clicked one
// stays thick until a click on empty map or on something else. Keys: 'm:<kind>:<id>' markers, 'p:<key>' event
// dots, 'e:p:<name>' / 'e:z:<id>' plants and zones, 'f:<polity>' a whole territory, 'u:<polity>:<unit>' one
// administrative unit.
export const EMPH = { hover: null, pick: null };
export const isEmph = k => k != null && (EMPH.hover === k || EMPH.pick === k);
export function setHover(k) { k ??= null; const ch = k !== EMPH.hover; EMPH.hover = k; return ch; }
export function setPick(k) { EMPH.pick = k ?? null; }
// the key of whatever a hit names
export function hitKey(h) {
  if (!h) return null;
  if (h.marker) return 'm:' + (h.marker.kind || 'gov') + ':' + h.marker.id;
  if (h.pulse) return 'p:' + h.pulse.key;
  if (h.econ) return h.econ.plant ? 'e:p:' + h.econ.plant.n + ':' + h.econ.plant.x : 'e:z:' + h.econ.zone.id;
  if (h.polity != null) return h.unit != null ? 'u:' + h.polity + ':' + h.unit : 'f:' + h.polity;
  return null;
}
// a thick ring around a point symbol
export function ring(ctx, x, y, r, color) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = 5.5; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke(); ctx.restore();
}
