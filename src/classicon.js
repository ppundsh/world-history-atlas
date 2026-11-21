// Small pictograms for the hidden mode's classes, drawn for this project (simple generic symbols: a sword,
// a bow, a spear, a horseshoe, a staff with a star, a dagger, a lightning bolt and a crown).
// Each is a 24 × 24 path; "stroke" ones are drawn as lines, the rest filled.
export const CLASS_ICONS = {
  saber: { d: 'M12 2 14 4 14 15 17 15 17 17 13 17 13 21 11 21 11 17 7 17 7 15 10 15 10 4Z' },
  archer: { d: 'M7 3Q19 12 7 21M4 12H20M16 8.5 20 12 16 15.5', stroke: true },
  lancer: { d: 'M12 1.5 15.5 7.5H13V22.5H11V7.5H8.5Z' },
  rider: { d: 'M6.5 4A7.5 7.5 0 1 0 17.5 4', stroke: true },
  caster: { d: 'M12 1.5 13.6 6.2H18.5L14.5 9 16 13.6 12 10.8 8 13.6 9.5 9 5.5 6.2H10.4ZM11.1 12H12.9V22.5H11.1Z' },
  assassin: { d: 'M18 2.5 21.5 6 10.5 17 7 13.5ZM5.5 14.5 9.5 18.5 7.5 20.5 3.5 16.5Z' },
  berserker: { d: 'M13.5 1.5 5 13H11L9 22.5 19 9.5H13Z' },
  extra: { d: 'M3 18 5 6.5 9 12 12 4.5 15 12 19 6.5 21 18ZM3 19.5H21V21.5H3Z' },
};
const paths = {};
// a round badge of the class colour with the white pictogram, centred on (x, y)
export function drawClassIcon(ctx, cls, x, y, size, color) {
  const ic = CLASS_ICONS[cls]; if (!ic) return;
  const p = paths[cls] ||= new Path2D(ic.d), r = size / 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  const k = (size * 0.66) / 24;
  ctx.translate(x - 12 * k, y - 12 * k); ctx.scale(k, k);
  if (ic.stroke) { ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.stroke(p); }
  else { ctx.fillStyle = '#fff'; ctx.fill(p); }
  ctx.restore();
}
// the same pictogram as an inline SVG, for the legend and the info panel
export function classIconSvg(cls, color, size = 16) {
  const ic = CLASS_ICONS[cls]; if (!ic) return '';
  const shape = ic.stroke ? `fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"` : 'fill="#fff"';
  return `<svg class="clsicon" width="${size}" height="${size}" viewBox="-4 -4 32 32" aria-hidden="true"><circle cx="12" cy="12" r="15" fill="${color}"/><path d="${ic.d}" ${shape}/></svg>`;
}
