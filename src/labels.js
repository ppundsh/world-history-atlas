// Label text and placement shared by the flat map and the globe overlay.
import { P, store } from './data.js';
import { religionOf, REGIONS } from './modes.js';

// Text for every polity drawn this year. When two polities that share a 國號 are on screen in the same
// year (e.g. 大明 and 南明's 大明, 大遼 and 西遼's 大遼), append the historiographic name: 大明（南明）.
export function labelTexts(features, lang, short = false) {
  const out = new Map();
  const seen = new Map();
  for (const f of features) {
    const id = f.properties.p;
    if (out.has(id)) continue;
    let name = P.name(id, lang.col);
    if (short) name = name.split(/[（(]/)[0].trim() || name;      // China mode: 直系（馮國璋…） → 直系
    out.set(id, name);
    if (!seen.has(name)) seen.set(name, []);
    seen.get(name).push(id);
  }
  for (const [name, ids] of seen) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      const alt = P.alt(id, lang.altCol);
      if (alt && alt !== name) out.set(id, `${name}（${alt}）`);
    }
  }
  return out;
}

// Label items for the polities on screen, biggest first. project(lp) → [x, y] or null.
// In religion mode the label can be the religion, the polity, or both (religion large, polity small).
export function labelItems(feats, st, scale, maxPx, project, minor = null) {
  const regional = REGIONS.includes(st.mode);
  const texts = labelTexts(feats, st.langInfo, regional);
  const relMode = st.mode === 'religion' && store.religions ? st.relLabels || 'religion' : 'country';
  const col = st.langInfo.col;
  const items = [], done = new Set();
  for (const f of feats) {
    const id = f.properties.p;
    if (done.has(id) || !f.properties.lp) continue;
    const size = labelSize(f.properties.area, scale, 9, maxPx, st.minFont);
    if (!size) continue;
    const pt = project(f.properties.lp);
    if (!pt) continue;
    done.add(id);
    let text = texts.get(id), sub = null, key = null;
    if (relMode !== 'country') {
      const code = religionOf(id, st.year), r = code && store.religions[store.relIndex[code]];
      const rel = r ? (r.n[col] || r.n[0]) : null;
      if (relMode === 'religion') { if (!rel) continue; text = rel; key = code; }
      else if (rel) { sub = text; text = rel; }
    }
    items.push({ x: pt[0], y: pt[1], size, text, sub, key });
  }
  // secondary names (Taiwan: administrative divisions over the control areas), smaller and placed after
  if (minor) {
    const mt = labelTexts(minor, st.langInfo, true), seen = new Set();
    for (const f of minor) {
      const id = f.properties.p;
      if (seen.has(id) || !f.properties.lp) continue;
      const size = labelSize(f.properties.area, scale, 9, Math.min(15, maxPx * 0.5), st.minFont);
      if (!size) continue;
      const pt = project(f.properties.lp); if (!pt) continue;
      seen.add(id);
      items.push({ x: pt[0], y: pt[1], size: Math.max(9, Math.round(size)), text: mt.get(id), minor: true });
    }
  }
  return items;
}

// Greedy collision-avoiding placement. items: [{x, y, size, text, sub?, key?}] sorted by importance.
// Items sharing a `key` (same religion) are not repeated within ~6 label heights of each other.
export function placeLabels(ctx, items, W, H, style) {
  const placed = [], keyed = [];
  const fontFamily = style.font;
  ctx.lineJoin = 'round';
  for (const it of items) {
    if (it.x < -50 || it.y < -20 || it.x > W + 50 || it.y > H + 20) continue;
    if (it.key) { const R = Math.max(160, it.size * 9); if (keyed.some(k => k.key === it.key && Math.hypot(k.x - it.x, k.y - it.y) < R)) continue; }
    const subSize = it.sub ? Math.max(9, Math.round(it.size * 0.55)) : 0;
    ctx.font = `${it.minor ? 500 : style.weight} ${it.size}px ${fontFamily}`;
    let w = ctx.measureText(it.text).width;
    let sw = 0;
    if (it.sub) { ctx.font = `500 ${subSize}px ${fontFamily}`; sw = ctx.measureText(it.sub).width; }
    const half = Math.max(w, sw) / 2, top = it.y - it.size / 2 - (it.sub ? subSize / 2 : 0), bot = top + it.size + subSize + (it.sub ? 2 : 0);
    const box = [it.x - half - 2, top - 1, it.x + half + 2, bot + 1];
    if (placed.some(b => b[0] < box[2] && b[2] > box[0] && b[1] < box[3] && b[3] > box[1])) continue;
    placed.push(box);
    if (it.key) keyed.push(it);
    const y1 = it.sub ? top + it.size / 2 : it.y;
    ctx.font = `${it.minor ? 500 : style.weight} ${it.size}px ${fontFamily}`;
    ctx.lineWidth = Math.max(2, it.size / 5);
    ctx.strokeStyle = style.halo; ctx.strokeText(it.text, it.x, y1);
    ctx.fillStyle = it.minor ? '#3a3f55' : style.text; ctx.fillText(it.text, it.x, y1);
    if (it.sub) {
      const y2 = y1 + it.size / 2 + subSize / 2 + 2;
      ctx.font = `500 ${subSize}px ${fontFamily}`;
      ctx.lineWidth = Math.max(2, subSize / 4);
      ctx.strokeText(it.sub, it.x, y2); ctx.fillText(it.sub, it.x, y2);
    }
  }
}

export const MIN_LOCK_PX = 11;
export function labelSize(areaSr, scale, minPx = 9, maxPx = 34, lock = false) {
  // sqrt(area in steradians) * projection scale ≈ the polity's width in pixels
  const px = Math.sqrt(areaSr) * scale;
  if (px < 28) return lock ? MIN_LOCK_PX : 0;   // too small on screen to carry a name (unless locked)
  return Math.min(maxPx, Math.max(lock ? MIN_LOCK_PX : minPx + 1, px * 0.2));
}

export function hatchPattern(ctx, color = 'rgba(30,30,30,0.55)', gap = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = gap * 2;
  const g = c.getContext('2d');
  g.strokeStyle = color;
  g.lineWidth = 1.4;
  g.beginPath();
  for (let i = -2; i <= 2; i++) { g.moveTo(i * gap, gap * 2); g.lineTo(i * gap + gap * 2, 0); }
  g.stroke();
  return ctx.createPattern(c, 'repeat');
}
