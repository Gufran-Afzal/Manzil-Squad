/* Small shared helpers for the build scripts (no dependencies). */
import fs from 'node:fs';
import path from 'node:path';

/** HTML-escape. "{" is emitted as &#123; so nothing can ever be read as a
 *  Liquid/Jekyll tag if GitHub Pages is accidentally set to run Jekyll. */
export const esc = (s = '') => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\{/g, '&#123;');

export const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const fmtDate = (iso, locale = 'en-PK') => (iso
  ? new Date(iso + 'T00:00:00Z').toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  : '');

export const fmtMoney = (n, currency = 'PKR', locale = 'en-PK') =>
  `${currency} ${Number(n).toLocaleString(locale, { maximumFractionDigits: 0 })}`;

/** Relative prefix that points from a page at `depth` back to the site root.
 *  Using relative links everywhere is what makes the site work unchanged on
 *  a GitHub Pages project URL (/repo-name/) or a custom domain. */
export const rootFor = (depth) => (depth === 0 ? './' : '../'.repeat(depth));

export const readJson = (root, f) => {
  const file = path.join(root, f);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    throw new Error(`${f}: ${e.code === 'ENOENT' ? 'file not found' : 'invalid JSON (' + e.message + ')'}`);
  }
};

/** Only allow safe URL schemes in generated links. */
export function safeUrl(u = '') {
  const s = String(u).trim();
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return ''; // javascript:, data:, etc.
  return s; // relative URL or #anchor
}

/** Placeholder convention: values like "[Brand Name]" are unfinished. */
export const isPlaceholder = (v) => typeof v === 'string' && /^\s*\[.*\]\s*$/.test(v);

export function copyDir(src, dest, filter = () => true) {
  if (!fs.existsSync(src)) return 0;
  let n = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name); const d = path.join(dest, entry.name);
    if (!filter(s, entry)) continue;
    if (entry.isDirectory()) n += copyDir(s, d, filter);
    else { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); n++; }
  }
  return n;
}

export const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
