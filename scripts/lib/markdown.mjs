/* ==================================================================
   markdown.mjs — small, safe, dependency-free Markdown → HTML
   (adapted from the Portfolio project's build.mjs parser)

   Safety: ALL text is HTML-escaped first, raw HTML in Markdown is never
   passed through, and link URLs are limited to http(s), mailto, tel and
   relative paths. That is why no sanitiser dependency is needed.

   Supported: ## / ### headings (with ids + table of contents), paragraphs,
   **bold**, *italic*, `code`, [links](url), - lists, 1. lists, > quotes,
   > **Verify:** callouts, pipe tables, --- rules, ``` code fences.
   ================================================================== */
import { esc, slugify, safeUrl } from './util.mjs';

let ROOT = './';
function inline(raw) {
  const codes = [];
  let s = raw.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  // pull links out before escaping so URLs aren't double-escaped
  const links = [];
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => { links.push([t, u]); return `\u0001${links.length - 1}\u0001`; });
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/\u0001(\d+)\u0001/g, (m, i) => {
    const [t, u] = links[i];
    let url = safeUrl(u);
    // "/trips.html" in Markdown means "trips.html at the site root": rewrite it
    // to a relative path so it works under a GitHub Pages project base path.
    if (/^\/(?!\/)/.test(url)) url = ROOT + url.slice(1);
    const text = esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    if (!url) return text;
    const ext = /^https?:/i.test(url);
    return `<a href="${esc(url)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}${ext ? '<span class="visually-hidden"> (opens in a new tab)</span>' : ''}</a>`;
  });
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${esc(codes[i])}</code>`);
}

export function plainText(md) {
  return md.replace(/```[\s\S]*?```/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*`|_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function markdown(src, { root = './' } = {}) {
  ROOT = root;
  const lines = src.replace(/\r/g, '').split('\n');
  const out = []; const toc = []; const used = new Set();
  const uid = (text) => { let id = slugify(text) || 'section'; let k = 2; while (used.has(id)) id = `${slugify(text)}-${k++}`; used.add(id); return id; };
  let i = 0;
  const isBlockStart = (l) => /^(```|#{2,4}\s|>\s?|\s*[-*]\s+|\s*\d+\.\s+|\|.*\||---\s*$)/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      out.push(`<pre class="code"><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^---\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    const h = line.match(/^(#{2,4})\s+(.*)/);
    if (h) {
      const level = h[1].length; const text = h[2].trim(); const id = uid(text);
      if (level === 2) toc.push({ id, text: text.replace(/[*`]/g, '') });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`); i++; continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      const text = buf.join(' ').trim();
      const call = text.match(/^\*\*(Verify|Note|Safety|Tip):\*\*\s*(.*)$/i);
      if (call) {
        const kind = call[1].toLowerCase();
        const label = { verify: 'Check before you travel', note: 'Note', safety: 'Safety', tip: 'Tip' }[kind];
        out.push(`<aside class="callout callout--${kind}"><p class="callout__label">${label}</p><p>${inline(call[2])}</p></aside>`);
      } else out.push(`<blockquote><p>${inline(text)}</p></blockquote>`);
      continue;
    }

    if (/^\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(/^\|[\s:-]+\|/.test(rows[1] || '') ? 2 : 1).map(cells);
      out.push(`<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(head.join(', '))}"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c, ci) => (ci === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const item = lines[i++].replace(/^\s*[-*]\s+/, '');
        const task = item.match(/^\[( |x)\]\s+(.*)/i);
        buf.push(task ? `<li class="task">${inline(task[2])}</li>` : `<li>${inline(item)}</li>`);
      }
      out.push(`<ul${buf.some((b) => b.startsWith('<li class="task"')) ? ' class="checklist"' : ''}>${buf.join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(`<li>${inline(lines[i++].replace(/^\s*\d+\.\s+/, ''))}</li>`);
      out.push(`<ol>${buf.join('')}</ol>`); continue;
    }

    const buf = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return { html: out.join('\n'), toc };
}

/** Simple "key: value" front matter between --- lines. */
export function frontMatter(raw, file = '') {
  const m = raw.replace(/\r/g, '').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter (--- block at the top)`);
  const meta = {};
  m[1].split('\n').forEach((l) => {
    const k = l.indexOf(':');
    if (k > 0) meta[l.slice(0, k).trim()] = l.slice(k + 1).trim().replace(/^"(.*)"$/, '$1');
  });
  return { meta, body: m[2] };
}
