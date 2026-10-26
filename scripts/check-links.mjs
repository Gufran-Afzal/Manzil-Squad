#!/usr/bin/env node
/* Checks links and asset references in dist/. Run `npm run build` first. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLinks } from './lib/links.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
if (!fs.existsSync(DIST)) { console.error('dist/ not found. Run `npm run build` first.'); process.exit(1); }
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const url = (site.siteUrl || process.env.SITE_URL || '').replace(/\/$/, '');
const basePath = url ? new URL(url).pathname.replace(/\/?$/, '/') : (process.env.BASE_PATH || '/');
const problems = checkLinks(DIST, { basePath });
const n = fs.readdirSync(DIST, { recursive: true }).filter((f) => String(f).endsWith('.html')).length;
if (problems.length) { problems.forEach((p) => console.error('  ✗ ' + p)); console.error(`${problems.length} problem(s) in ${n} pages.`); process.exit(1); }
console.log(`Links OK: checked every internal link, image, script and stylesheet in ${n} pages.`);
