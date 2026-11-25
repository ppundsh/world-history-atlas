// Search-engine files for the deployed site (https://ppundsh.github.io/world-history-atlas/):
//   public/sitemap.xml   the home page and one address per mode (?m=taiwan), each in the four languages (?lang=en),
//                        linked to one another as language versions (hreflang)
//   index.html           between <!-- seo:start --> and <!-- seo:end -->: a short description and a link to every
//                        mode inside <noscript>, read by search engines and shown by browsers without JavaScript
// The app reads ?m= and ?lang= (main.js readHash) and sets the title, description and canonical address to match.
//   node data-pipeline/seo/build-seo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { t } from '../../src/i18n.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = 'https://ppundsh.github.io/world-history-atlas/';
const LANGS = ['zh-Hant', 'zh-Hans', 'en', 'ja'];
const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
const MODES = JSON.parse(main.match(/^const MODES = (\[[^\]]*\]);/m)[1].replace(/'/g, '"')).filter(m => m !== 'fgo');   // the hidden mode stays hidden
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = (m, l) => { const q = new URLSearchParams(); if (m !== 'world') q.set('m', m); if (l) q.set('lang', l); const s = q.toString(); return SITE + (s ? '?' + s : ''); };

// ---- sitemap.xml
const today = new Date().toISOString().slice(0, 10);
const entries = [];
for (const m of MODES) {
  const alts = LANGS.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(url(m, l))}"/>`).concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(url(m))}"/>`).join('\n');
  for (const l of [null, ...LANGS]) entries.push(`  <url>\n    <loc>${esc(url(m, l))}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${m === 'world' && !l ? '1.0' : l ? '0.5' : '0.7'}</priority>\n${alts}\n  </url>`);
}
fs.writeFileSync(path.join(ROOT, 'public', 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`);

// ---- the <noscript> block of index.html
const s = t('zh-Hant'), e = t('en');
const list = (S, l) => MODES.map(m => `<li><a href="${esc(url(m, l))}">${esc(S.modes[m])}</a></li>`).join('');
const block = `  <noscript>
    <div class="seo">
      <h1>${esc(s.title)} — ${esc(s.subtitle)}</h1>
      <p>${esc(s.seoDesc)}</p>
      <p>${esc(s.noJs || '這個網站需要開啟 JavaScript 才能顯示互動地圖。')}</p>
      <ul lang="zh-Hant">${list(s, null)}</ul>
      <h2 lang="en">${esc(e.title)} — ${esc(e.subtitle)}</h2>
      <p lang="en">${esc(e.seoDesc)}</p>
      <ul lang="en">${list(e, 'en')}</ul>
    </div>
  </noscript>`;
const f = path.join(ROOT, 'index.html');
const html = fs.readFileSync(f, 'utf8');
const a = html.indexOf('<!-- seo:start'), b = html.indexOf('<!-- seo:end -->');
if (a < 0 || b < 0) throw new Error('index.html: seo markers missing');
const head = html.slice(0, html.indexOf('-->', a) + 3);
fs.writeFileSync(f, head + '\n' + block + '\n  ' + html.slice(b));
console.log(`sitemap.xml: ${entries.length} addresses (${MODES.length} modes × 5); index.html: noscript block with ${MODES.length} mode links`);
