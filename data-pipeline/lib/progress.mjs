// One progress line rewritten in place. A line wider than the console wraps, and then every
// '\r' only returns to the start of the wrapped part, so each update looks like a new line.
// Cut the text to the console width (CJK characters count as two columns) and pad the rest.
const wide = c => c > 0x2e7f || (c >= 0x2500 && c <= 0x25ff);   // CJK, full-width forms, box and block glyphs
let last = 0;
export function line(text) {
  if (!process.stdout.isTTY) {                    // piped or redirected: an occasional plain line
    if (Date.now() - last > 5000) { last = Date.now(); process.stdout.write(text.trim() + '\n'); }
    return;
  }
  const cols = Math.max(20, (process.stdout.columns || 100) - 1);
  let out = '', w = 0;
  for (const ch of text) { const cw = wide(ch.codePointAt(0)) ? 2 : 1; if (w + cw > cols) break; out += ch; w += cw; }
  process.stdout.write('\r' + out + ' '.repeat(cols - w));
}
