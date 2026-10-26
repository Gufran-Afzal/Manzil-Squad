/* sitemap.mjs — builds sitemap.xml from the list of written pages.
   Pages marked noindex (404, empty testimonials page) are left out. */
export function buildSitemap(siteUrl, pages) {
  const rows = pages
    .filter((p) => p.file.endsWith('.html') && !p.noindex)
    .sort((a, b) => (a.file === 'index.html' ? -1 : b.file === 'index.html' ? 1 : a.file.localeCompare(b.file)))
    .map((p) => {
      const loc = `${siteUrl}/${p.file === 'index.html' ? '' : p.file}`;
      return `  <url><loc>${loc.replace(/&/g, '&amp;')}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}
