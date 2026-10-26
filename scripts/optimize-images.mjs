#!/usr/bin/env node
/* ==================================================================
   optimize-images.mjs — turns full-size photos into small, responsive
   WebP files for the website.

   1. Put the original photo in assets/img/originals/ and give it the
      name you want to use as its key, e.g. nathiagali-ridge.jpg
      (originals are never copied to the published site).
   2. npm install            (once, installs the optional "sharp")
   3. npm run images:optimize
   4. Paste the printed entry into content/images.json, then fill in
      alt text, source, licence and attribution.

   Output: assets/img/photos/<key>-480.webp, -960, -1600, -2400
   (widths larger than the original are skipped).
   ================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/img/originals');
const OUT = path.join(ROOT, 'assets/img/photos');
const WIDTHS = [480, 960, 1600, 2400];

let sharp;
try { sharp = (await import('sharp')).default; } catch {
  console.error('This script needs the optional "sharp" package. Run `npm install` first.');
  process.exit(1);
}
if (!fs.existsSync(SRC)) { fs.mkdirSync(SRC, { recursive: true }); console.log('Created assets/img/originals/. Put your photos there and run this again.'); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f));
if (!files.length) { console.log('No photos found in assets/img/originals/.'); process.exit(0); }

const entries = {};
for (const f of files) {
  const key = f.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // .rotate() applies the camera's orientation; metadata (including GPS location) is not copied to the output
  const img = sharp(path.join(SRC, f)).rotate();
  const meta = await img.metadata();
  const w0 = meta.autoOrient?.width || meta.width; const h0 = meta.autoOrient?.height || meta.height;
  const widths = WIDTHS.filter((w) => w <= w0);
  if (!widths.length) widths.push(w0);
  for (const w of widths) {
    await sharp(path.join(SRC, f)).rotate().resize(w).webp({ quality: 76, effort: 5 }).toFile(path.join(OUT, `${key}-${w}.webp`));
  }
  entries[key] = {
    src: `assets/img/photos/${key}`, widths, width: widths[widths.length - 1], height: Math.round((h0 / w0) * widths[widths.length - 1]),
    alt: 'TODO: describe what the photo shows', kind: 'photo',
    source: 'TODO: photographer / where it came from', licence: 'TODO: e.g. CC BY-SA 4.0, or "Own photo"', attribution: 'TODO: credit line if the licence requires one',
  };
  console.log(`  ${f} → ${widths.map((w) => `${key}-${w}.webp`).join(', ')}`);
}
console.log('\nAdd these to "images" in content/images.json (then replace every TODO):\n');
console.log(JSON.stringify(entries, null, 2).slice(1, -1).trim());
