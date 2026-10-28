#!/usr/bin/env node
/* ==================================================================
   build.mjs — static site generator (zero runtime dependencies)

   Usage
     node scripts/build.mjs            production build → repo root (like the Portfolio site)
     node scripts/build.mjs --dev      also shows setup warnings on the pages
     node scripts/build.mjs --strict   fails if launch placeholders remain
   Environment
     SITE_URL=https://user.github.io/repo node scripts/build.mjs
       used when content/site.json → siteUrl is empty

   Pipeline (each step is small and lives in its own file):
     content/*.json|md ──► scripts/lib/content.mjs   load + validate
                       ──► scripts/templates/*.mjs   pages (layout, art, pages)
     src/css/*.css     ──► css/site.css          concatenated + minified
     src/js/*.js       ──► js/                        copied (app.js is the only eager file)
     assets/           stays where it is (fonts, images are already served from the root)
   ================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { esc, rootFor, copyDir } from './lib/util.mjs';
import { loadContent, placeholderReport, AVAILABILITY } from './lib/content.mjs';
import { makeComponents } from './lib/components.mjs';
import { checkLinks } from './lib/links.mjs';
import { buildSitemap } from './lib/sitemap.mjs';
import { makeLayout } from './templates/layout.mjs';
import { buildPages } from './templates/pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The site is built INTO THE REPO ROOT and pushed; GitHub Pages serves the branch root (no Actions).
// Generated files are tracked in .build-manifest.json so a rebuild removes only its own output.
const DIST = ROOT;
const MANIFEST = path.join(ROOT, '.build-manifest.json');
const args = new Set(process.argv.slice(2));
const DEV = args.has('--dev');
const STRICT = args.has('--strict');

/* 1. load + validate content */
const C = loadContent(ROOT);
if (C.errors.length) {
  console.error(`\nContent has ${C.errors.length} problem(s). Nothing was built.\n`);
  C.errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
C.warnings.forEach((w) => console.warn('  ! ' + w));
const { site, trips, destinations, articles, images } = C;
const SITE_URL = (site.siteUrl || process.env.SITE_URL || '').replace(/\/$/, '');
const BASE_PATH = SITE_URL ? new URL(SITE_URL).pathname.replace(/\/?$/, '/') : process.env.BASE_PATH || '/';
const BRAND = site.brand.name;
const todo = placeholderReport(C, SITE_URL);
if (STRICT) {
  const blocking = todo.filter((t) => !/animated motion tiles|not confirmed|price is an estimate|operator/.test(t));
  if (blocking.length) {
    console.error('\n--strict: launch placeholders remain. Fix these first:\n');
    blocking.forEach((t) => console.error('  ✗ ' + t));
    process.exit(1);
  }
}
if (DEV && process.env.FORMS_ENDPOINT) site.forms = { ...site.forms, mode: process.env.FORMS_MODE || 'test', endpoint: process.env.FORMS_ENDPOINT };

/* 2. assets: css bundle, js, images, fonts */
if (fs.existsSync(MANIFEST)) {
  for (const f of JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))) {
    const abs = path.join(ROOT, f);
    if (abs.startsWith(ROOT + path.sep) && fs.existsSync(abs)) fs.rmSync(abs);
    for (let d = path.dirname(abs); d !== ROOT && d.startsWith(ROOT); d = path.dirname(d)) {
      if (fs.existsSync(d) && fs.readdirSync(d).length === 0) fs.rmdirSync(d); else break;
    }
  }
}
fs.mkdirSync(path.join(DIST, 'css'), { recursive: true });
const minCss = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{};,>])\s*/g, '$1')
  .replace(/:\s+/g, ':')
  .replace(/;}/g, '}')
  .trim();
const cssDir = path.join(ROOT, 'src/css');
const css = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css')).sort().map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
fs.writeFileSync(path.join(DIST, 'css/site.css'), DEV ? css : minCss(css));
copyDir(path.join(ROOT, 'src/js'), path.join(DIST, 'js'));
// assets/ (fonts, icons, images) are served from where they are: nothing to copy.
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
const generated = ['css/site.css', ...fs.readdirSync(path.join(ROOT, 'src/js')).map((f) => `js/${f}`)];
const hash = (rel) => crypto.createHash('sha1').update(fs.readFileSync(path.join(DIST, rel))).digest('hex').slice(0, 8);
const version = { css: hash('css/site.css'), js: hash('js/app.js') };

/* 3. pages */
const written = [];
const out = (file, html, meta = {}) => {
  const f = path.join(DIST, file);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
  written.push({ file, ...meta });
  generated.push(file);
};
const K = makeComponents({ site, images, trips, destinations, dev: DEV, SITE_URL });
const L = makeLayout({ site, images, BRAND, SITE_URL, BASE_PATH, DEV, todo, K, version });
buildPages({ C, K, L, out, BRAND, SITE_URL, BASE_PATH });

/* 4. redirects (content/redirects.json): GitHub Pages can't do server redirects */
{
  const file = path.join(ROOT, 'content/redirects.json');
  const map = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).redirects || {} : {};
  for (const [from, to] of Object.entries(map)) {
    if (!/^[a-z0-9/_-]+\.html$/.test(from) || !/^[a-z0-9/_#-]*(\.html)?(#[\w-]+)?$/.test(to)) { console.error(`  ✗ content/redirects.json: "${from}" → "${to}" must be site-relative .html paths`); process.exit(1); }
    if (fs.existsSync(path.join(DIST, from))) { console.error(`  ✗ content/redirects.json: "${from}" is an existing page`); process.exit(1); }
    const target = rootFor(from.split('/').length - 1) + to;
    out(from, `<!doctype html><html lang="${esc(site.language)}"><head><meta charset="utf-8"><title>Page moved</title><meta name="robots" content="noindex">${SITE_URL ? `<link rel="canonical" href="${esc(`${SITE_URL}/${to}`)}">` : ''}<meta http-equiv="refresh" content="0; url=${esc(target)}"></head><body><p>This page has moved to <a href="${esc(target)}">a new address</a>.</p></body></html>\n`, { noindex: true });
  }
}

/* 5. SEO files */
if (SITE_URL) {
  out('sitemap.xml', buildSitemap(SITE_URL, written));
  if (BASE_PATH === '/') out('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

/* 6. verify */
fs.writeFileSync(MANIFEST, JSON.stringify([...new Set(generated)].sort(), null, 1) + '\n');
const problems = checkLinks(DIST, { basePath: BASE_PATH, files: generated.filter((f) => f.endsWith('.html')).map((f) => path.join(DIST, f)) });
if (problems.length) {
  console.error(`\nBroken internal links or assets (${problems.length}):`);
  problems.slice(0, 50).forEach((p) => console.error('  ✗ ' + p));
  process.exit(1);
}
const pages = written.filter((w) => w.file.endsWith('.html')).length;
console.log(`Built ${pages} pages into the repo root (${trips.length} trips, ${destinations.length} destinations, ${articles.length} articles).`);
console.log(`Base path: ${BASE_PATH}${SITE_URL ? `  Site URL: ${SITE_URL}` : '  (no site URL: canonical tags and sitemap.xml skipped)'}`);
console.log(`Forms: ${site.forms.mode}   WhatsApp: ${K.whatsappReady ? 'on' : 'not configured (buttons hidden)'}   Internal links: OK`);
console.log(`Apps Script property ALLOWED_TRIPS = ${JSON.stringify(Object.fromEntries(trips.filter((t) => AVAILABILITY[t.availability].bookable).map((t) => [t.id, t.title])))}`);
if (todo.length) { console.log(`\nLaunch checklist (${todo.length}):`); todo.forEach((t) => console.log('  - ' + t)); }
