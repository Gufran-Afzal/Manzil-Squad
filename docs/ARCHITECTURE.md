# Architecture

## 1. What the Portfolio project looked like (inspection, phase 1)

The uploaded `Portfolio.rar` was extracted and inspected before any work started. Its architecture:

| Part | What it did |
|---|---|
| `build.mjs` (500 lines, no dependencies) | Synced `partials/head.html`, `header.html` and `footer.html` into every page; generated `projects.html`, `projects/<slug>.html`, `articles.html`, `articles/<slug>.html`, `404.html` and `sitemap.xml`; printed a release checklist |
| `content/site.json` | Name, `siteUrl`, email, social links, Open Graph image |
| `content/projects.json`, `content/articles/*.md` | Project data and Markdown articles with `key: value` front matter |
| Hand-written pages | `index.html`, `about-us.html`, `contact.html` with `<!-- @header -->…<!-- @/header -->` markers the build replaced in place |
| Paths | `{{root}}` in partials became `./` or `../` depending on page depth, so links worked on the GitHub Pages project URL `/Portfolio/` |
| Markdown | A small built-in parser that HTML-escaped all text (no raw HTML), produced heading ids and a table of contents |
| CSS | `main.css` plus one file per page area; `.js` class on `<html>` gated scroll-reveal animations |
| JavaScript | `main.js` (sticky header, mobile menu with focus trap, wave-stagger reveal engine, scroll-linked timeline), `filters.js` (chips + search with URL sync), `article.js` (reading progress), `contact.js` (Formspree) |
| SEO | Unique titles/descriptions, canonical tags and sitemap only when `siteUrl` is set, `noindex` on 404, deliberately no `robots.txt` on a project site; documented in `SEO_GUIDE.md` |
| Deployment | GitHub Pages serving the repository root, `.nojekyll`, `_config.yml` excludes |

Two small issues were found and are not repeated here: the generated pages were written next to their sources (so source and output were mixed in the repository), and the homepage `og:image` URL contained the site URL twice.

The Portfolio project itself was **not modified**. This travel site is a separate project.

## 2. What was kept

- **Zero-dependency Node build** with the same structure: load content → shared partials → generated pages → SEO files → release checklist.
- **`{{root}}` relative links**, computed from page depth. This is what makes the site work at `https://user.github.io/repo-name/` and on a custom domain without changes.
- **Safe built-in Markdown parser** (now in `scripts/lib/markdown.mjs`), extended with tables, checklists and "Check before you travel" callouts.
- **Canonical/sitemap only when `siteUrl` is known**, `noindex` for pages that shouldn't be indexed, no `robots.txt` on project sites.
- **Progressive enhancement**: every page is complete static HTML; JavaScript only adds filtering, animation and form sending.
- **The `.js` class gate** for animations, the **rAF-throttled header**, the **focus-trapped mobile menu**, the **wave-stagger reveal** idea, the **scroll-linked timeline** (now the itinerary), **filters with URL sync**, and the **reading progress bar**, all rewritten as ES modules.
- **Release checklist** printed by the build, now much more detailed.

## 3. What changed, and why

| Change | Reason |
|---|---|
| Output goes to `dist/` | Almost every page is now generated; keeping output out of the source tree avoids accidental edits to generated files and lets GitHub Actions publish a clean folder |
| Hand-written pages moved to `pages/*.html` with a settings comment and `{{slots}}` | Same idea as the Portfolio's `@markers`, but the build wraps them in the page shell instead of editing them in place |
| Content validation before building | The build stops with a precise message (file, item, field) for missing fields, duplicate IDs or slugs, bad prices, missing images and broken references |
| Link and asset check after building | Every internal `href`/`src`/`srcset` and `#anchor` in `dist/` must exist; root-relative links are rejected because they break on project sites |
| Trip and destination pages are generated per item (`trips/<slug>.html`, `destinations/<slug>.html`) | Static pages per trip are better for search engines and sharing than one `trip.html` filled in by JavaScript |
| Policy pages are Markdown (`content/pages/*.md`) | Easier for a beginner to edit than HTML |
| Image manifest (`content/images.json`) | Records source, licence and attribution for every image, generates `srcset`, intrinsic sizes and the public credits page |
| Fonts self-hosted | No request to Google Fonts; better privacy and performance |
| Formspree replaced by Google Apps Script | Free, writes to a Google Sheet the owner controls |

## 4. How a build works

```
content/*.json, content/articles/*.md, content/pages/*.md, content/images.json
        │  scripts/lib/content.mjs  → validate (stop on errors)
        ▼
build.mjs ── partials/*.html + pages/*.html + scripts/lib/components.mjs
        │   copies css/, js/, assets/ (fingerprints CSS/JS with ?v=hash)
        │   writes every page with {{root}}-relative links
        │   writes sitemap.xml (and robots.txt only on a root domain)
        ▼
dist/  ── scripts/lib/links.mjs checks every internal link and asset (stop on errors)
        ▼
GitHub Actions uploads dist/ to GitHub Pages
```

Builds are deterministic: the same content always produces the same files (dates come from content, not the clock; artwork uses fixed seeds).

## 5. Browser-side code

`js/main.js` is the only script tag. It always loads `navigation.js` and `animations.js`, then loads other modules only when their markup is on the page (`filters.js`, `faq.js`, `gallery.js`, `booking.js`, `contact.js`, `trip-details.js`, `article.js`, and `analytics.js` only when enabled). `whatsapp.js` is shared by the build (static links) and the browser (links that include the visitor's reference number). `booking-service.js` is the only code that talks to the Google Apps Script endpoint.

## 6. Design system

See `css/design-tokens.css` and docs/CONTENT_GUIDE.md → "Changing the theme". The signature element is the elevation profile ("the climb"): from about 217 m in Lahore to about 2,410 m in Nathiagali, drawn when it scrolls into view, echoed in the hero typography and the layered ridgeline artwork. Trip cards are styled as coach tickets with a tear-off stub for price and status. Statuses always combine text with a distinct shape, never colour alone.
