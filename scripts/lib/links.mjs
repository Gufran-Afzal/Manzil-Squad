/* ==================================================================
   links.mjs — checks every internal link, image, script and stylesheet
   in the built site (repo root) actually exists, including #fragments.

   Also flags root-relative links ("/trips.html"). Those break on a
   GitHub Pages project site (https://user.github.io/repo/), so only
   404.html may use them, and only with the configured base path.
   ================================================================== */
import fs from 'node:fs';
import path from 'node:path';

function walk(dir, list = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, list); else list.push(p);
  }
  return list;
}

const ATTR = /\s(href|src|srcset|action|data-copy-link)="([^"]*)"/g;
const ID = /\sid="([^"]+)"/g;

export function checkLinks(DIST, { basePath = '/', files = null } = {}) {
  const problems = [];
  // The site is built into the repo root, so only the generated pages are scanned (never node_modules, docs/ ...).
  const html = (files || walk(DIST)).filter((f) => f.endsWith('.html'));
  const ids = new Map();
  const src = new Map();
  for (const f of html) {
    const s = fs.readFileSync(f, 'utf8');
    src.set(f, s);
    ids.set(f, new Set([...s.matchAll(ID)].map((m) => m[1])));
  }

  for (const f of html) {
    const rel = path.relative(DIST, f).split(path.sep).join('/');
    const s = src.get(f)
      .replace(/<script type="application\/(ld\+)?json"[\s\S]*?<\/script>/g, '') // JSON blocks are not links
      .replace(/<noscript>[\s\S]*?<\/noscript>/g, (m) => m); // keep
    const is404 = rel === '404.html';
    for (const m of s.matchAll(ATTR)) {
      const [, attr, value] = m;
      if (attr === 'data-copy-link') continue;
      const urls = attr === 'srcset' ? value.split(',').map((x) => x.trim().split(/\s+/)[0]) : [value];
      for (let u of urls) {
        u = u.replace(/&amp;/g, '&');
        if (!u || /^(https?:|mailto:|tel:|data:|#$)/i.test(u) || u.startsWith('//')) continue;
        if (attr === 'action') continue;
        let target;
        if (u.startsWith('/')) {
          if (!is404) { problems.push(`${rel}: root-relative link "${u}" breaks on a project site; use a relative link`); continue; }
          if (!u.startsWith(basePath)) { problems.push(`${rel}: "${u}" does not start with the base path ${basePath}`); continue; }
          target = path.join(DIST, u.slice(basePath.length));
        } else if (u.startsWith('#')) {
          if (!ids.get(f).has(decodeURIComponent(u.slice(1)))) problems.push(`${rel}: anchor "${u}" has no matching id on the page`);
          continue;
        } else {
          target = path.join(path.dirname(f), u);
        }
        const [p0, hash] = target.split('#');
        let file = p0.split('?')[0];
        if (file.endsWith(path.sep) || file === DIST || (fs.existsSync(file) && fs.statSync(file).isDirectory())) file = path.join(file, 'index.html');
        if (!fs.existsSync(file)) { problems.push(`${rel}: "${u}" → missing ${path.relative(DIST, file)}`); continue; }
        if (hash && file.endsWith('.html') && !(ids.get(file) || new Set()).has(decodeURIComponent(hash))) {
          problems.push(`${rel}: "${u}" → no element with id "${hash}"`);
        }
      }
    }
  }
  return problems;
}
