#!/usr/bin/env node
/* ==================================================================
   serve.mjs — tiny local preview server for dist/ (no dependencies)

     npm run preview                → http://localhost:4173/
     npm run preview:base           → http://localhost:4173/student-travel-site/
                                      (simulates a GitHub Pages project site)
     node scripts/serve.mjs --port 8080 --base /my-repo/
   Unknown paths get dist/404.html with status 404, like GitHub Pages.
   ================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : d; };
const PORT = Number(arg('--port', process.env.PORT || 4173));
const BASE = arg('--base', '/').replace(/\/?$/, '/');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

if (!fs.existsSync(DIST)) { console.error('dist/ not found. Run `npm run build` first.'); process.exit(1); }

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const send404 = () => { res.writeHead(404, { 'Content-Type': TYPES['.html'] }); fs.createReadStream(path.join(DIST, '404.html')).pipe(res); };
  if (!url.startsWith(BASE)) {
    if (url === '/' && BASE !== '/') { res.writeHead(302, { Location: BASE }); return res.end(); }
    return send404();
  }
  let file = path.normalize(path.join(DIST, url.slice(BASE.length)));
  if (!file.startsWith(DIST)) return send404();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return send404();
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Previewing dist/ at http://localhost:${PORT}${BASE}  (Ctrl+C to stop)`));
