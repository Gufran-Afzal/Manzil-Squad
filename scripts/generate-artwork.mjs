#!/usr/bin/env node
/* ==================================================================
   generate-artwork.mjs — writes the placeholder landscape artwork
   (assets/img/art/*.webp) listed in content/images.json.

   Usage:  npm install   (once, installs the optional `sharp` dev dependency)
           npm run images:art

   The generated pictures are ORIGINAL ILLUSTRATIONS, not photographs of
   real places. Replace them with licensed photography when you have it
   (see docs/CONTENT_GUIDE.md → "Replacing placeholder artwork").
   ================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneSvg } from './lib/artwork.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let sharp;
try { sharp = (await import('sharp')).default; } catch {
  console.error('This script needs the optional "sharp" package. Run `npm install` first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/images.json'), 'utf8'));
const jobs = Object.entries(manifest.images).filter(([, im]) => im.generator);
let count = 0;
for (const [key, im] of jobs) {
  const { scene, seed, ratio = '16:9' } = im.generator;
  const [rw, rh] = ratio.split(':').map(Number);
  const W = 2400; const H = Math.round((W * rh) / rw);
  const svg = Buffer.from(sceneSvg(scene, { W, H, seed }));
  const base = path.join(ROOT, im.src);
  fs.mkdirSync(path.dirname(base), { recursive: true });
  for (const w of im.widths) {
    await sharp(svg, { density: 72 }).resize(w).webp({ quality: 78, effort: 5 }).toFile(`${base}-${w}.webp`);
    count++;
  }
  if (im.jpegFallback) {
    await sharp(svg).resize(im.jpegFallback).jpeg({ quality: 82, mozjpeg: true }).toFile(`${base}.jpg`);
    count++;
  }
  process.stdout.write(`  ${key} `);
}
console.log(`\nWrote ${count} files.`);
