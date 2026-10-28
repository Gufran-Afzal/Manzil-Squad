#!/usr/bin/env node
/* Checks links and asset references in the built pages. Run `npm run build` first. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLinks } from './lib/links.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = ROOT;
const MANIFEST = path.join(ROOT, '.build-manifest.json');
if (!fs.existsSync(MANIFEST)) { console.error('Nothing built yet. Run `npm run build` first.'); process.exit(1); }
const pages = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).filter((f) => f.endsWith('.html')).map((f) => path.join(ROOT, f));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const url = (site.siteUrl || process.env.SITE_URL || '').replace(/\/$/, '');
const basePath = url ? new URL(url).pathname.replace(/\/?$/, '/') : (process.env.BASE_PATH || '/');
const problems = checkLinks(DIST, { basePath, files: pages });
const n = pages.length;
if (problems.length) { problems.forEach((p) => console.error('  ✗ ' + p)); console.error(`${problems.length} problem(s) in ${n} pages.`); process.exit(1); }
console.log(`Links OK: checked every internal link, image, script and stylesheet in ${n} pages.`);
