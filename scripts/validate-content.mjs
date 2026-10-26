#!/usr/bin/env node
/* Validates every content file without building. Run: npm run validate */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, placeholderReport } from './lib/content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = loadContent(ROOT);
c.warnings.forEach((w) => console.warn('  ! ' + w));
if (c.errors.length) {
  console.error(`\n${c.errors.length} problem(s):`);
  c.errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
const words = c.articles.map((a) => `${a.slug} (${a.words} words)`);
console.log(`Content OK: ${c.trips.length} trips, ${c.destinations.length} destinations, ${c.articles.length} articles, ${Object.keys(c.images).length} images, ${c.policies.length} policy pages.`);
console.log('Articles: ' + words.join(', '));
const todo = placeholderReport(c, process.env.SITE_URL || c.site.siteUrl);
if (todo.length) { console.log(`\nStill to configure (${todo.length}):`); todo.forEach((t) => console.log('  - ' + t)); }
