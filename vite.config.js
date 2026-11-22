import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// The Heroic Spirits mode's custom pictures: whatever image files are in public/fgo/custom (kept out of git, so
// they exist only on the maintainer's computer) are listed in fgo/custom/index.json — live by the dev server,
// and written into dist by a build — so the site shows them without any extra step. A build without the
// folder's pictures (the public deployment) gets an empty list.
const CUSTOM = path.resolve('public/fgo/custom');
function customList() {
  const out = {};
  if (!fs.existsSync(CUSTOM)) return out;
  const files = fs.readdirSync(CUSTOM), credits = {};
  if (files.includes('credits.tsv')) for (const l of fs.readFileSync(path.join(CUSTOM, 'credits.tsv'), 'utf8').split(/\r?\n/)) {
    const [id, c] = l.split('\t'); if (id && c && !id.startsWith('#')) credits[id.trim()] = c.trim();
  }
  for (const f of files) {
    const m = f.match(/^(.+)\.(webp|png|jpe?g)$/i); if (!m) continue;
    const mtime = Math.round(fs.statSync(path.join(CUSTOM, f)).mtimeMs);
    out[m[1]] ||= { url: 'fgo/custom/' + encodeURIComponent(f) + '?v=' + mtime, credit: credits[m[1]] || '' };
  }
  return out;
}
const fgoCustom = () => ({
  name: 'fgo-custom-pictures',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.split('?')[0].endsWith('/fgo/custom/index.json')) return next();
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(customList()));
    });
  },
  writeBundle(opts) {
    const dir = path.join(opts.dir || 'dist', 'fgo', 'custom');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(customList()));
  },
});

// base './' so the site works from any GitHub Pages sub-path (https://<user>.github.io/<repo>/)
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  plugins: [fgoCustom()],
});
