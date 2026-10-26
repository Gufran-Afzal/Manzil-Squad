#!/usr/bin/env node
/* Regenerates dist/sitemap.xml from the HTML files in dist/ (normally the
   build does this for you). Pages with <meta name="robots" content="noindex">
   are skipped. Needs siteUrl in content/site.json or SITE_URL in the env. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSitemap } from './lib/sitemap.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const url = (site.siteUrl || process.env.SITE_URL || '').replace(/\/$/, '');
if (!url) { console.error('Set "siteUrl" in content/site.json (or SITE_URL=...) first.'); process.exit(1); }
if (!fs.existsSync(DIST)) { console.error('dist/ not found. Run `npm run build` first.'); process.exit(1); }
const pages = fs.readdirSync(DIST, { recursive: true }).map(String).filter((f) => f.endsWith('.html')).map((f) => {
  const s = fs.readFileSync(path.join(DIST, f), 'utf8');
  return { file: f.split(path.sep).join('/'), noindex: /<meta name="robots" content="noindex">/.test(s) };
});
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(url, pages));
console.log(`Wrote dist/sitemap.xml with ${pages.filter((p) => !p.noindex).length} URLs.`);
