# SEO guide

How this site is set up for search engines, what is deliberately left out, and what you need to do after launch. (Structure adapted from the Portfolio project's SEO guide.)

## 1. What the build does automatically

| Item | How |
|---|---|
| Unique `<title>` and meta description per page | From `seo` in trips/destinations, front matter in articles and policies, and the settings comment in `pages/*.html`. The build warns about descriptions over ~155–170 characters |
| Canonical URL | `<link rel="canonical">` on every indexable page, **only when `siteUrl` is known** (in `content/site.json`, or provided by GitHub Actions). A wrong canonical is worse than none |
| Open Graph / social previews | `og:title`, `og:description`, `og:url`, `og:image` (absolute URL), `og:locale` (`en_PK`), `twitter:card`. Trip, destination and article pages use their own hero image |
| Headings | One `<h1>` per page; sections use `<h2>`/`<h3>` in order |
| Landmarks | `<header>`, `<nav aria-label>`, `<main id="main">`, `<footer>`, breadcrumbs as `<nav aria-label="Breadcrumb">` |
| Descriptive URLs | `trips/nathiagali-ayubia-weekend.html`, `articles/murree-vs-nathiagali.html` |
| Internal linking | Trips ↔ destinations ↔ articles are cross-linked from content data; every page links to the main sections |
| Image alt text | From `content/images.json`; decorative images use empty `alt` |
| Sitemap | `sitemap.xml` with `lastmod` from content dates; `noindex` pages are excluded (404, booking success, redirects, the testimonials page while empty) |
| robots.txt | Written **only when the site is at the root of a domain** (custom domain). See 3 |
| 404 | Custom, `noindex`, works at any URL depth |
| Drafts | Articles with `draft: true` are not built, listed, or put in the sitemap |
| Performance | Self-hosted fonts (one preloaded), responsive WebP images with width/height (no layout shift), hero image prioritised, everything else lazy-loaded, JS split by page, CSS/JS fingerprinted |

## 2. Structured data (JSON-LD), only where it's true

| Schema | When it's added |
|---|---|
| `Article` | Every article (headline, dates, author, image, page) |
| `BreadcrumbList` | Every page with breadcrumbs, when `siteUrl` is known |
| `Organization` | Homepage, **only after** a real brand name is set (not `[Brand Name]`) and `siteUrl` is known |
| `Event` for a trip | **Only when** the trip's dates **and** price are confirmed, the brand is real and `siteUrl` is known. Google requires real dates and an offer, so proposed trips get none |
| `LocalBusiness` | **Not added.** It implies a public address and opening hours. Add it only if you have a verified, public business location |
| `FAQPage` | **Not added.** Google now shows FAQ rich results only for a small set of authoritative government and health sites, and marking up ordinary FAQs brings no benefit. The FAQ content is still fully crawlable HTML |
| Ratings / reviews | **Never** added. Self-published reviews aren't eligible, and there are no reviews yet |

Test any page with the [Rich Results Test](https://search.google.com/test/rich-results) and the [Schema Markup Validator](https://validator.schema.org/).

## 3. GitHub Pages specifics

**Project site** (`https://user.github.io/repo-name/`):

- All links are relative, so the site works in the sub-folder. Canonical tags, `og:url` and the sitemap include `/repo-name/`.
- Crawlers only read `robots.txt` at the **host root** (`https://user.github.io/robots.txt`). A file inside `/repo-name/` would be ignored, so the build doesn't write one. Without `robots.txt`, everything is crawlable, which is what you want. Submit the sitemap in Search Console instead (below).

**Custom domain** (`https://www.yourbrand.pk`): the build writes `robots.txt` with a `Sitemap:` line automatically.

## 4. After launch: Google Search Console

1. Go to [Search Console](https://search.google.com/search-console) and add a property.
   - Custom domain: use a **Domain** property and verify with a DNS TXT record at your domain provider.
   - Project site: use a **URL prefix** property with your full address including `/repo-name/`, and verify with the **HTML tag** method: add the `<meta name="google-site-verification" …>` tag to `partials/head.html`, build and push.
2. **Sitemaps** → submit `sitemap.xml`.
3. **URL Inspection** → inspect the homepage and a trip page → **Request indexing**.
4. Check back after a week: **Pages** report (what's indexed and why not), **Experience → Core Web Vitals**.

Bing Webmaster Tools can import your Search Console setup in one click.

## 5. Content SEO

- Write for students and parents asking real questions: "Nathiagali trip from Lahore for students", "is Murree safe in winter", "what to pack for Nathiagali".
- One clear topic per article; answer it early; use specific headings.
- Keep facts dated and sourced (the `reviewed` front matter field shows the date on the page). Outdated travel advice loses trust fast.
- Link new articles to the relevant trip and destination pages, and back.
- Don't create near-duplicate pages for every city ("trip from Lahore", "trip from Islamabad"…) unless the content really differs.
- Don't stuff keywords. The current articles use each place name naturally.

## 6. Pre-launch checklist

- [ ] `siteUrl` set (or confirm the GitHub Actions URL is right) and canonical tags point to the live address
- [ ] Real brand name, so `Organization` schema and `og:site_name` appear
- [ ] A 1200×630 social image (`og-default` in `content/images.json`)
- [ ] Share a trip page in WhatsApp and check the preview
- [ ] Sitemap submitted in Search Console
- [ ] PageSpeed Insights run on the homepage and a trip page (mobile)
- [ ] No placeholder text visible on indexable pages (`npm run build:release`)

## 7. When you change URLs

Add the old → new mapping to `content/redirects.json` (see docs/DEPLOYMENT.md). Update internal links, then resubmit the sitemap.
