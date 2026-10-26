#!/usr/bin/env node
/* ==================================================================
   build.mjs — zero-dependency static site generator

   Evolved from the Portfolio project's build.mjs. Same ideas:
   shared partials, relative {{root}} links, pages generated from JSON
   and Markdown, a release checklist. New here: output goes to dist/,
   content is validated first, internal links are checked last.

   Usage
     node build.mjs            production build → dist/
     node build.mjs --dev      also shows setup warnings on the pages
     node build.mjs --strict   fails if launch placeholders remain
   Environment
     SITE_URL=https://user.github.io/repo node build.mjs
       used when content/site.json → siteUrl is empty (the GitHub
       Actions workflow passes the Pages URL this way automatically)
   ================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { esc, slugify, fmtDate, rootFor, copyDir, jsonLd, isPlaceholder } from './scripts/lib/util.mjs';
import { loadContent, placeholderReport, AVAILABILITY, ARTICLE_CATEGORIES } from './scripts/lib/content.mjs';
import { markdown } from './scripts/lib/markdown.mjs';
import { makeComponents, icon } from './scripts/lib/components.mjs';
import { sceneSvg } from './scripts/lib/artwork.mjs';
import { checkLinks } from './scripts/lib/links.mjs';
import { buildSitemap } from './scripts/lib/sitemap.mjs';
import { buildLink, buildMessage } from './js/whatsapp.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const args = new Set(process.argv.slice(2));
const DEV = args.has('--dev');
const STRICT = args.has('--strict');

/* ---------------- 1. load + validate ---------------- */
const C = loadContent(ROOT);
if (C.errors.length) {
  console.error(`\nContent has ${C.errors.length} problem(s). Nothing was built.\n`);
  C.errors.forEach((e) => console.error('  ✗ ' + e));
  console.error('');
  process.exit(1);
}
C.warnings.forEach((w) => console.warn('  ! ' + w));
const { site, trips, destinations, faqs, team, testimonials, gallery, images, articles, policies } = C;

const SITE_URL = (site.siteUrl || process.env.SITE_URL || '').replace(/\/$/, '');
// Base path for the few places that need absolute links (404.html is served at any URL depth).
const BASE_PATH = SITE_URL ? (new URL(SITE_URL).pathname.replace(/\/?$/, '/')) : (process.env.BASE_PATH || '/');
const BRAND = site.brand.name;
const YEAR = [site.policies.lastUpdated, ...trips.map((t) => t.updated), ...articles.map((a) => a.updated || a.date)].sort().pop().slice(0, 4);
const todo = placeholderReport(C, SITE_URL);

if (STRICT) {
  const blocking = todo.filter((t) => !/placeholder illustrations|not confirmed|price is an estimate|operator/.test(t));
  if (blocking.length) {
    console.error('\n--strict: launch placeholders remain. Fix these first:\n');
    blocking.forEach((t) => console.error('  ✗ ' + t));
    process.exit(1);
  }
}

// Development only: point the forms at a local mock (npm run mock:forms) to try every form state.
if (DEV && process.env.FORMS_ENDPOINT) {
  site.forms = { ...site.forms, mode: process.env.FORMS_MODE || 'test', endpoint: process.env.FORMS_ENDPOINT };
  console.log(`  (dev) forms → ${site.forms.endpoint} in ${site.forms.mode} mode`);
}
const ctx = { site, images, trips, destinations, dev: DEV, SITE_URL };
const K = makeComponents(ctx);

/* ---------------- output helpers ---------------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const written = []; // { file, lastmod, noindex }
function out(file, html, meta = {}) {
  const f = path.join(DIST, file);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
  written.push({ file, ...meta });
}

/* ---------------- 2. static assets (copied first so they can be fingerprinted) ---------------- */
copyDir(path.join(ROOT, 'css'), path.join(DIST, 'css'));
copyDir(path.join(ROOT, 'js'), path.join(DIST, 'js'));
const usedImageFiles = new Set(Object.values(images).flatMap((im) => [...im.widths.map((w) => `${im.src}-${w}.webp`), ...(im.jpegFallback ? [`${im.src}.jpg`] : [])]));
copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), (p, entry) => {
  if (entry.isDirectory()) return true;
  const rel = path.relative(ROOT, p).split(path.sep).join('/');
  if (rel.startsWith('assets/img/art/')) return usedImageFiles.has(rel); // skip stale generated art
  if (rel.startsWith('assets/img/originals/')) return false;             // full-size sources stay out of dist
  return true;
});
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
const hashes = {};
const v = (rel) => {
  if (!hashes[rel]) hashes[rel] = crypto.createHash('sha1').update(fs.readFileSync(path.join(DIST, rel))).digest('hex').slice(0, 8);
  return `${rel}?v=${hashes[rel]}`;
};

/* ---------------- partials ---------------- */
const readPartial = (name) => fs.readFileSync(path.join(ROOT, 'partials', `${name}.html`), 'utf8').trimEnd();
const P = { head: readPartial('head'), header: readPartial('header'), footer: readPartial('footer'), wa: readPartial('whatsapp-button') };

function fill(tpl, root, nav, extra = {}) {
  const map = {
    root, brand: esc(BRAND), mark: icon.mark, year: YEAR, tagline: esc(site.brand.tagline), region: esc(site.operatingRegion),
    'whatsapp-menu': K.waButton({ context: 'general', cls: 'btn btn--ghost-light' }),
    'footer-columns': site.footer.columns.map((c) => `<nav class="site-footer__col" aria-label="${esc(c.heading)}"><p class="site-footer__heading">${esc(c.heading)}</p><ul>${c.links.map((l) => `<li><a href="${root}${esc(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul></nav>`).join('')
      + (Object.values(site.socials).some(Boolean) ? `<nav class="site-footer__col" aria-label="Social"><p class="site-footer__heading">Follow</p><ul>${Object.entries(site.socials).filter(([, u]) => u).map(([k, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(k[0].toUpperCase() + k.slice(1))}</a></li>`).join('')}</ul></nav>` : ''),
    'footer-contact': [
      site.contact.email ? `<a class="site-footer__contact" href="mailto:${esc(site.contact.email)}">${icon.mail}<span>${esc(site.contact.email)}</span></a>` : '',
      K.whatsappReady ? `<a class="site-footer__contact" href="${esc(K.waHref('general'))}" target="_blank" rel="noopener noreferrer">${icon.whatsapp}<span>${esc(site.contact.phoneDisplay || 'WhatsApp')}</span></a>` : '',
    ].join(''),
    'operator-line': site.operator.verified ? `<p>Registered with ${esc(site.operator.registrationAuthority)}, registration number ${esc(site.operator.registrationNumber)}.${site.operator.insurance ? ' ' + esc(site.operator.insurance) : ''}</p>` : '',
    floating: `<div class="float-actions" data-float-actions>${K.whatsappReady && !extra.hideFloatingWa ? P.wa.replace('{{href}}', esc(K.waHref('general'))).replace('{{icon}}', icon.whatsapp) : ''}<button class="to-top" type="button" data-to-top hidden><svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="visually-hidden">Back to top</span></button></div>`,
    ...extra,
  };
  let html = tpl.replace(/\{\{([a-z-]+)\}\}/g, (m, k) => (k in map ? map[k] : m));
  html = html.replace(/<a ([^>]*?)data-nav="([a-z]+)"/g, (m, pre, key) => (key === nav ? `<a ${pre}aria-current="page"` : `<a ${pre.trimEnd()}`));
  return html;
}

/* ---------------- SEO ---------------- */
function seo({ title, description, file, type = 'website', image, noindex = false, extra = '' }) {
  const brandOk = !isPlaceholder(BRAND);
  const full = title === BRAND || !brandOk ? title : `${title} | ${BRAND}`;
  const pathPart = file === 'index.html' ? '' : file;
  const url = SITE_URL && !noindex ? `${SITE_URL}/${pathPart}` : '';
  const im = images[image || 'og-default'];
  const ogImg = SITE_URL && im ? `${SITE_URL}/${im.jpegFallback ? im.src + '.jpg' : `${im.src}-${im.widths[im.widths.length - 1]}.webp`}` : '';
  return [
    `<title>${esc(full)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    url ? `<link rel="canonical" href="${esc(url)}">` : '',
    noindex ? '<meta name="robots" content="noindex">' : '',
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${esc(full)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    brandOk ? `<meta property="og:site_name" content="${esc(BRAND)}">` : '',
    `<meta property="og:locale" content="${esc(site.locale.replace('-', '_'))}">`,
    url ? `<meta property="og:url" content="${esc(url)}">` : '',
    ogImg ? `<meta property="og:image" content="${esc(ogImg)}">\n<meta property="og:image:alt" content="${esc(im.alt)}">` : '',
    `<meta name="twitter:card" content="${ogImg ? 'summary_large_image' : 'summary'}">`,
    site.seo.twitterHandle ? `<meta name="twitter:site" content="${esc(site.seo.twitterHandle)}">` : '',
    extra,
  ].filter(Boolean).join('\n');
}

function analyticsTag() {
  const a = site.analytics;
  if (!a.enabled || DEV) return '';
  if (a.provider === 'plausible' && a.plausibleDomain) return `<script defer data-domain="${esc(a.plausibleDomain)}" src="https://plausible.io/js/script.js"></script>`;
  if (a.provider === 'ga4' && /^G-[A-Z0-9]+$/.test(a.ga4MeasurementId)) return `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(a.ga4MeasurementId)}"></script>`;
  return '';
}

/* ---------------- page shell ---------------- */
const BASE_CSS = ['design-tokens', 'main', 'animations'];
function page({ file, nav = '', title, description, css = [], main, type, image, noindex = false, seoExtra = '', bodyClass = '', headerTheme = 'solid', rootOverride, hideFloatingWa = false }) {
  const depth = file.split('/').length - 1;
  const root = rootOverride || rootFor(depth);
  const config = {
    root, brand: BRAND, whatsapp: buildLink(site.contact.whatsapp) ? site.contact.whatsapp : '',
    forms: { mode: site.forms.mode, endpoint: site.forms.mode === 'off' ? '' : site.forms.endpoint },
    email: site.contact.email, dev: DEV,
    analytics: site.analytics.enabled && !DEV ? site.analytics.provider : '',
    analyticsId: site.analytics.enabled && site.analytics.provider === 'ga4' ? site.analytics.ga4MeasurementId : '',
  };
  const devBanner = DEV && todo.length ? `<details class="dev-panel"><summary>Setup: ${todo.length} item${todo.length === 1 ? '' : 's'} to finish</summary><ul>${todo.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p>This panel only appears in development builds (npm run dev).</p></details>` : '';
  return `<!DOCTYPE html>
<html lang="${esc(site.language)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${seo({ title, description, file, type, image, noindex, extra: seoExtra })}
${fill(P.head, root, nav)}
${[...BASE_CSS, ...css].map((c) => `<link rel="stylesheet" href="${root}${v(`css/${c}.css`)}">`).join('\n')}
<script type="application/json" id="site-config">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>
<script type="module" src="${root}${v('js/main.js')}"></script>
${analyticsTag()}
</head>
<body class="${esc(bodyClass)}" data-header="${headerTheme}">
${fill(P.header, root, nav)}
${main}
${fill(P.footer, root, nav, { hideFloatingWa })}
${devBanner}
</body>
</html>
`;
}

/* ---------------- hand-authored page templates (pages/*.html) ---------------- */
function template(name) {
  const raw = fs.readFileSync(path.join(ROOT, 'pages', name), 'utf8').replace(/\r/g, '');
  const m = raw.match(/^<!--\n([\s\S]*?)\n-->\n?([\s\S]*)$/);
  if (!m) throw new Error(`pages/${name}: missing the settings comment at the top`);
  const meta = {};
  m[1].split('\n').forEach((l) => { const k = l.indexOf(':'); if (k > 0) meta[l.slice(0, k).trim()] = l.slice(k + 1).trim(); });
  return { meta, body: m[2] };
}
function renderTemplate(name, slots, overrides = {}) {
  const { meta, body } = template(name);
  const file = name;
  const root = rootFor(0);
  const missing = [];
  const html = body.replace(/\{\{([a-z0-9-]+)\}\}/g, (mm, k) => {
    if (k === 'root') return root;
    if (k === 'brand') return esc(BRAND);
    if (k in slots) return typeof slots[k] === 'function' ? slots[k]() : slots[k];
    missing.push(k); return mm;
  });
  if (missing.length) throw new Error(`pages/${name}: unknown slot(s) ${missing.map((k) => `{{${k}}}`).join(', ')}`);
  out(file, page({
    file, nav: meta.nav, title: meta.title, description: meta.description,
    css: (meta.css || '').split(',').map((s) => s.trim()).filter(Boolean),
    bodyClass: meta.bodyClass || '', headerTheme: meta.header || 'solid', noindex: meta.noindex === 'true',
    hideFloatingWa: meta.hideFloatingWa === 'true', main: html, ...overrides,
  }), { noindex: meta.noindex === 'true', lastmod: site.policies.lastUpdated });
}

/* shared sections */
const bookableTrips = trips.filter((t) => AVAILABILITY[t.availability].bookable);
const featuredTrip = bookableTrips[0] || trips[0];
const homeFaqs = faqs.groups.flatMap((g) => g.items).filter((q) => q.home);
const allFaqs = faqs.groups.flatMap((g) => g.items);
const latestArticles = articles.slice(0, 3);
const featuredArticle = articles.find((a) => a.featured) || articles[0];
const hasTestimonials = testimonials.items.length > 0;
const pageHero = ({ title, lede, crumbs, extra = '' }) => `<section class="page-hero">
  <div class="container page-hero__inner">
    ${crumbs ? crumbs.html : ''}
    <h1 class="page-hero__title" data-animate="rise">${title}</h1>
    ${lede ? `<p class="page-hero__lede" data-animate="rise" style="--d:1">${lede}</p>` : ''}
    ${extra}
  </div>
</section>`;

/* ================================================================== */
/*  3. PAGES                                                           */
/* ================================================================== */

/* ---- home ---- */
{
  const heroArt = site.home.heroImage
    ? `<div class="hero__art hero__art--photo">${K.picture(site.home.heroImage, { root: './', eager: true, cls: 'hero__photo' })}</div>`
    : `<div class="hero__art" data-parallax>${sceneSvg('galiyat', { W: 1600, H: 1000, seed: 7, layered: true })}</div>`;
  const orgLd = !isPlaceholder(BRAND) && SITE_URL ? jsonLd({
    '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, url: SITE_URL + '/', description: site.brand.description,
    ...(site.contact.email ? { email: site.contact.email } : {}),
    ...(Object.values(site.socials).some(Boolean) ? { sameAs: Object.values(site.socials).filter(Boolean) } : {}),
  }) : '';
  const destOrder = ['nathiagali', 'ayubia', 'swat', 'naran-kaghan'].map((id) => destinations.find((d) => d.id === id)).filter(Boolean);
  renderTemplate('index.html', {
    'hero-art': heroArt,
    'hero-trip': featuredTrip ? `<a class="hero-ticket" href="./trips/${featuredTrip.slug}.html">
        <span class="hero-ticket__label">First trip</span>
        <span class="hero-ticket__title">${esc(featuredTrip.title)}</span>
        <span class="hero-ticket__meta">${K.durationText(featuredTrip.duration)}, ${esc(K.priceText(featuredTrip).main)}</span>
        ${K.statusBadge(featuredTrip.availability, ' status--on-dark')}
      </a>` : '',
    'upcoming-trips': bookableTrips.length ? bookableTrips.map((t) => K.tripCard(t, './')).join('\n') : '<p>No trips are open right now.</p>',
    'trip-proposed-note': featuredTrip && featuredTrip.dates.status !== 'confirmed' ? K.notice('proposed', `<strong>Proposed trip.</strong> Dates, the coach company and the place we stay are not confirmed yet. Registering interest helps us decide whether the trip goes ahead.`) : '',
    'featured-destinations': destOrder.map((d, i) => K.destinationCard(d, './', { size: i === 0 ? 'large' : '' })).join('\n'),
    route: featuredTrip ? K.routeProfile(featuredTrip, { id: 'home-route' }) : '',
    'route-trip-link': featuredTrip ? `./trips/${featuredTrip.slug}.html` : './trips.html',
    testimonials: hasTestimonials ? `<section class="section"><div class="container"><h2 class="section__title">From people who travelled with us</h2><div class="quotes">${testimonials.items.slice(0, 3).map((q) => `<figure class="quote"><blockquote><p>${esc(q.quote)}</p></blockquote><figcaption>${esc(q.name)}${q.university ? `, ${esc(q.university)}` : ''}</figcaption></figure>`).join('')}</div></div></section>` : '',
    journal: `${featuredArticle ? K.articleCard(featuredArticle, './', { featured: true }) : ''}${articles.filter((a) => a !== featuredArticle).slice(0, 3).map((a) => K.articleCard(a, './')).join('')}`,
    'home-faqs': homeFaqs.map((q) => K.faqItem(q)).join('\n'),
    'cta-band': K.ctaBand('./'),
  }, { seoExtra: orgLd, title: site.seo.defaultTitle, description: site.seo.defaultDescription });
}

/* ---- trips listing ---- */
{
  const destOpts = destinations.filter((d) => trips.some((t) => t.destinationIds.includes(d.id)));
  const statuses = Object.keys(AVAILABILITY).filter((s) => trips.some((t) => t.availability === s));
  const select = (facet, label, opts) => `<label class="facet"><span class="facet__label">${label}</span><select class="facet__select" data-facet="${facet}"><option value="all">Any</option>${opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>`;
  out('trips.html', page({
    file: 'trips.html', nav: 'trips', css: ['trips'],
    title: 'Student group trips from Lahore',
    description: 'Upcoming and proposed group trips for university students from Lahore to Northern Pakistan, with clear status, pricing and what is included.',
    main: `<main id="main">
${pageHero({ title: 'Trips', lede: 'Every trip shows its real status. Proposed means we are still confirming details; nothing is reserved until we confirm it to you in writing.', crumbs: K.breadcrumbs([{ label: 'Trips', href: 'trips.html' }], './') })}
<section class="section section--tight">
  <div class="container">
    <div class="filters" data-filters>
      <label class="filter-search">${icon.search}<span class="visually-hidden">Search trips</span><input type="search" placeholder="Search trips" data-filter-search autocomplete="off"></label>
      ${select('destination', 'Destination', destOpts.map((d) => [d.id, d.name]))}
      ${select('budget', 'Budget', [['under-15k', 'Up to PKR 15,000'], ['15k-30k', 'PKR 15,000–30,000'], ['over-30k', 'Over PKR 30,000']])}
      ${select('length', 'Length', [['weekend', 'Weekend (1 night)'], ['short', '2–4 nights'], ['long', '5+ nights']])}
      ${select('status', 'Status', statuses.map((s) => [s, AVAILABILITY[s].label]))}
    </div>
    <p class="filter-status" data-filter-status data-noun="trips" role="status" aria-live="polite"></p>
    <div class="ticket-list" data-filter-grid>
      ${trips.map((t) => K.tripCard(t, './', { level: 2 })).join('\n')}
    </div>
    <div class="empty" data-filter-empty hidden>
      <h2 class="empty__title">No trips match those filters</h2>
      <p>We only list trips we are actively planning. Clear the filters, or tell us where you would like to go next.</p>
      <div class="empty__actions"><button type="button" class="btn btn--quiet" data-filter-reset>Clear filters</button><a class="btn btn--ghost" href="./contact.html">Suggest a destination</a></div>
    </div>
    <section class="status-key" aria-labelledby="status-key-h">
      <h2 class="status-key__title" id="status-key-h">What each status means</h2>
      <dl class="status-key__list">
        <div><dt>${K.statusBadge('interest')}</dt><dd>We are measuring demand. Dates and price are not final.</dd></div>
        <div><dt>${K.statusBadge('tentative')}</dt><dd>A date is pencilled in but suppliers are not confirmed.</dd></div>
        <div><dt>${K.statusBadge('open')}</dt><dd>Dates, price and suppliers are confirmed. Seats are confirmed in writing after payment.</dd></div>
        <div><dt>${K.statusBadge('full')}</dt><dd>No seats left. You can still join a waiting list.</dd></div>
        <div><dt>${K.statusBadge('completed')}</dt><dd>The trip has taken place.</dd></div>
        <div><dt>${K.statusBadge('cancelled')}</dt><dd>The trip will not run. Anyone affected is contacted directly.</dd></div>
      </dl>
    </section>
  </div>
</section>
${K.ctaBand('./')}
</main>`,
  }), { lastmod: trips.map((t) => t.updated).sort().pop() });
}

/* ---- trip detail pages ---- */
trips.forEach((t) => {
  const file = `trips/${t.slug}.html`; const root = '../';
  const pr = K.priceText(t); const dt = K.dateText(t); const names = K.destNames(t);
  const st = AVAILABILITY[t.availability];
  const crumbs = K.breadcrumbs([{ label: 'Trips', href: 'trips.html' }, { label: t.title, href: file }], root, { light: true });
  const related = t.relatedArticles.map((id) => articles.find((a) => a.slug === id)).filter(Boolean).slice(0, 3);
  const unconf = (s) => (s === 'confirmed' ? '<span class="tag tag--ok">Confirmed</span>' : '<span class="tag tag--pending">Not yet confirmed</span>');
  const list = (arr, cls = '') => `<ul${cls ? ` class="${cls}"` : ''}>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  // Event structured data only when the facts Google requires are real and confirmed.
  const eventLd = t.dates.status === 'confirmed' && t.price.status === 'confirmed' && !isPlaceholder(BRAND) && SITE_URL ? jsonLd({
    '@context': 'https://schema.org', '@type': 'Event', name: t.title, description: t.summary,
    startDate: t.dates.start, endDate: t.dates.end, eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: t.availability === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: names.join(', '), address: { '@type': 'PostalAddress', addressRegion: destinations.find((d) => d.id === t.destinationIds[0]).province, addressCountry: 'PK' } },
    organizer: { '@type': 'Organization', name: BRAND, url: SITE_URL + '/' },
    image: `${SITE_URL}/${images[t.heroImage].src}-${images[t.heroImage].widths.slice(-1)[0]}.webp`,
    offers: { '@type': 'Offer', price: t.price.amount, priceCurrency: 'PKR', availability: t.availability === 'full' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock', url: `${SITE_URL}/${file}` },
  }) : '';
  out(file, page({
    file, nav: 'trips', css: ['trips', 'content', 'booking'], type: 'website', image: t.heroImage, headerTheme: 'over-hero',
    title: t.seo.title, description: t.seo.description, seoExtra: crumbs.ld + eventLd, bodyClass: 'page-trip',
    main: `<main id="main">
<section class="trip-hero">
  <div class="trip-hero__media">${K.picture(t.heroImage, { root, eager: true, cls: 'trip-hero__img' })}</div>
  <div class="container trip-hero__inner">
    ${crumbs.html}
    <p class="trip-hero__route" data-animate="rise">${icon.pin}<span>Lahore to ${esc(K.andList(names))}</span></p>
    <h1 class="trip-hero__title" data-animate="rise" style="--d:1">${esc(t.title)}</h1>
    <p class="trip-hero__summary" data-animate="rise" style="--d:2">${esc(t.summary)}</p>
    <dl class="trip-facts" data-animate="rise" style="--d:3">
      <div><dt>Status</dt><dd>${K.statusBadge(t.availability, ' status--on-dark')}</dd></div>
      <div><dt>Price</dt><dd>${esc(pr.main)}<span>${esc(pr.note)}</span></dd></div>
      <div><dt>Date</dt><dd>${esc(dt.main)}<span>${esc(t.dates.note || dt.note)}</span></dd></div>
      <div><dt>Length</dt><dd>${K.durationText(t.duration)}</dd></div>
      ${t.group ? `<div><dt>Group</dt><dd>${t.group.min}–${t.group.max} people<span>planned</span></dd></div>` : ''}
    </dl>
    <div class="trip-hero__actions" data-animate="rise" style="--d:4">
      ${st.bookable ? `<a class="btn btn--accent" href="#register">${t.availability === 'open' ? 'Book a seat' : 'Register interest'}</a>` : ''}
      ${K.waButton({ context: 'trip', trip: t, label: 'Ask on WhatsApp', cls: 'btn btn--ghost-light' })}
    </div>
  </div>
</section>
${t.dates.status !== 'confirmed' ? `<div class="container">${K.notice('proposed', `<strong>This trip is a proposal.</strong> Everything on this page is our current plan. Dates, the final price, the coach company and the place we stay will be confirmed in writing before we ask anyone to pay. Last updated ${fmtDate(t.updated, site.locale)}.`)}</div>` : ''}
<div class="container trip-layout">
  <nav class="trip-toc" aria-label="On this page">
    <p class="trip-toc__title">On this page</p>
    <ol>
      <li><a href="#overview">Overview</a></li>
      ${t.route?.length ? '<li><a href="#route">The route</a></li>' : ''}
      <li><a href="#itinerary">Day by day</a></li>
      <li><a href="#included">What's included</a></li>
      <li><a href="#logistics">Transport and stay</a></li>
      <li><a href="#packing">What to bring</a></li>
      <li><a href="#safety">Safety</a></li>
      <li><a href="#terms">Booking terms</a></li>
      <li><a href="#questions">Questions</a></li>
      ${st.bookable ? '<li><a href="#register">Register</a></li>' : ''}
    </ol>
  </nav>
  <div class="trip-main">
    <section class="trip-section" id="overview" aria-labelledby="overview-h">
      <h2 id="overview-h" class="trip-section__title">Overview</h2>
      <div class="prose">${t.description.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    </section>
    ${t.route?.length ? `<section class="trip-section trip-section--wide" id="route" aria-labelledby="route-h"><h2 id="route-h" class="trip-section__title">The route</h2>${K.routeProfile(t, { id: 'trip-route' })}</section>` : ''}
    <section class="trip-section" id="itinerary" aria-labelledby="itinerary-h">
      <h2 id="itinerary-h" class="trip-section__title">Day by day</h2>
      ${t.itineraryNote ? `<p class="trip-section__note">${esc(t.itineraryNote)}</p>` : ''}
      ${K.itinerary(t)}
    </section>
    <section class="trip-section" id="included" aria-labelledby="included-h">
      <h2 id="included-h" class="trip-section__title">What's included</h2>
      <div class="incl">
        <div class="incl__col"><h3 class="incl__title">${icon.check}${t.inclusions.status === 'confirmed' ? 'Included' : 'Planned to be included'}</h3>${list(t.inclusions.items, 'incl__list')}</div>
        <div class="incl__col incl__col--no"><h3 class="incl__title">${icon.minus}Not included</h3>${list(t.exclusions, 'incl__list')}</div>
      </div>
    </section>
    <section class="trip-section" id="logistics" aria-labelledby="logistics-h">
      <h2 id="logistics-h" class="trip-section__title">Transport, stay and meals</h2>
      <div class="logistics">
        ${[['Transport', t.transport], ['Accommodation', t.accommodation], ['Meals', t.meals]].filter(([, v]) => v).map(([k, v]) => `<div class="logistics__item"><h3 class="logistics__title">${k} ${unconf(v.status)}</h3><p>${esc(v.summary)}</p>${v.details ? list(v.details) : ''}</div>`).join('')}
      </div>
    </section>
    <section class="trip-section" id="packing" aria-labelledby="packing-h">
      <h2 id="packing-h" class="trip-section__title">What to bring</h2>
      ${list(t.packing, 'checklist')}
      <p class="trip-section__more">More detail in our <a href="${root}articles/northern-pakistan-packing-checklist.html">Northern Pakistan packing checklist</a>.</p>
    </section>
    <section class="trip-section" id="safety" aria-labelledby="safety-h">
      <h2 id="safety-h" class="trip-section__title">Safety</h2>
      ${list(t.safety, 'safety-list')}
      <p class="trip-section__more">Read what we do and what we ask of participants on the <a href="${root}safety.html">safety page</a>.</p>
    </section>
    <section class="trip-section" id="terms" aria-labelledby="terms-h">
      <h2 id="terms-h" class="trip-section__title">Booking terms</h2>
      ${list(t.bookingTerms)}
      <p class="trip-section__more">Cancellations and refunds: see our <a href="${root}cancellation-policy.html">cancellation policy</a> (draft, still under review).</p>
    </section>
    <section class="trip-section" id="questions" aria-labelledby="questions-h">
      <h2 id="questions-h" class="trip-section__title">Questions about this trip</h2>
      <div class="faq-list">${t.faqs.map((q, i) => K.faqItem({ id: `${t.id}-${i}`, ...q })).join('')}</div>
      <p class="trip-section__more">General questions are answered on the <a href="${root}faq.html">questions page</a>.</p>
    </section>
    ${t.gallery?.length ? `<section class="trip-section trip-section--wide" aria-labelledby="gallery-h"><h2 id="gallery-h" class="trip-section__title">Gallery</h2><p class="trip-section__note">Placeholder artwork until we have photographs from this trip.</p><div class="mini-gallery" data-gallery>${t.gallery.map((g) => `<a class="mini-gallery__item" href="${root}${images[g].src}-1600.webp" data-lightbox data-caption="${esc(images[g].alt)}">${K.picture(g, { root, sizes: '(min-width: 960px) 22vw, 50vw' })}</a>`).join('')}</div></section>` : ''}
    ${st.bookable ? `<section class="trip-section trip-section--wide" aria-label="Register">${K.bookingForm({ root, preselect: t.id, idPrefix: 'trip' })}</section>` : ''}
  </div>
  <aside class="trip-aside" aria-label="Trip summary">
    <div class="trip-card">
      ${K.statusBadge(t.availability)}
      <p class="trip-card__price">${esc(pr.main)}<span>${esc(pr.note)}</span></p>
      <dl class="trip-card__facts"><div><dt>Date</dt><dd>${esc(dt.main)}</dd></div><div><dt>Length</dt><dd>${K.durationText(t.duration)}</dd></div></dl>
      ${st.bookable ? `<a class="btn btn--accent btn--block" href="#register">${t.availability === 'open' ? 'Book a seat' : 'Register interest'}</a>` : ''}
      ${K.waButton({ context: 'trip', trip: t, label: 'Ask a question', cls: 'btn btn--ghost btn--block' })}
      <p class="trip-card__note">Free to register. No payment now.</p>
    </div>
  </aside>
</div>
${related.length ? `<section class="section section--alt" aria-labelledby="related-h"><div class="container"><h2 class="section__title" id="related-h">Read before you go</h2><div class="post-grid">${related.map((a) => K.articleCard(a, root)).join('')}</div></div></section>` : ''}
</main>`,
  }), { lastmod: t.updated });
});

/* ---- destinations listing ---- */
{
  const regions = [...new Set(destinations.map((d) => d.region))];
  out('destinations.html', page({
    file: 'destinations.html', nav: 'destinations', css: ['destinations'],
    title: 'Northern Pakistan destinations for student trips',
    description: 'Honest guides to Nathiagali, Ayubia, Murree, Swat, Naran and Hunza: seasons, safety and which ones we plan trips to.',
    main: `<main id="main">
${pageHero({ title: 'Destinations', lede: 'Guides to the places students ask us about. We only run trips where it says so; the rest are here to help you plan.', crumbs: K.breadcrumbs([{ label: 'Destinations', href: 'destinations.html' }], './') })}
<section class="section section--tight">
  <div class="container">
    <div class="filters" data-filters>
      <label class="filter-search">${icon.search}<span class="visually-hidden">Search destinations</span><input type="search" placeholder="Search destinations" data-filter-search autocomplete="off"></label>
      <div class="chips" role="group" aria-label="Filter by region">
        <button type="button" class="chip" data-filter="all" aria-pressed="true">All</button>
        ${regions.map((r) => `<button type="button" class="chip" data-filter="${slugify(r)}" aria-pressed="false">${esc(r)}</button>`).join('')}
      </div>
    </div>
    <p class="filter-status" data-filter-status data-noun="destinations" data-noun-one="destination" role="status" aria-live="polite"></p>
    <div class="dest-grid" data-filter-grid>${destinations.map((d) => K.destinationCard(d, './', { level: 2 })).join('\n')}</div>
    <div class="empty" data-filter-empty hidden><h2 class="empty__title">No destinations match</h2><p>Try a different search, or clear the filters.</p><div class="empty__actions"><button type="button" class="btn btn--quiet" data-filter-reset>Clear filters</button></div></div>
  </div>
</section>
${K.ctaBand('./')}
</main>`,
  }), { lastmod: destinations.map((d) => d.lastReviewed).sort().pop() });
}

/* ---- destination detail pages ---- */
destinations.forEach((d) => {
  const file = `destinations/${d.slug}.html`; const root = '../';
  const crumbs = K.breadcrumbs([{ label: 'Destinations', href: 'destinations.html' }, { label: d.name, href: file }], root, { light: true });
  const relTrips = trips.filter((t) => t.destinationIds.includes(d.id));
  const relArts = d.relatedArticles.map((id) => articles.find((a) => a.slug === id)).filter(Boolean).slice(0, 3);
  const opNote = { 'first-trip': 'Our first proposed trip includes this destination.', planned: 'We are planning a trip here.', none: "We don't run trips here yet. This guide is for planning." }[d.operating];
  out(file, page({
    file, nav: 'destinations', css: ['destinations', 'trips', 'content'], image: d.heroImage, headerTheme: 'over-hero',
    title: d.seo.title, description: d.seo.description, seoExtra: crumbs.ld,
    main: `<main id="main">
<section class="trip-hero trip-hero--dest">
  <div class="trip-hero__media">${K.picture(d.heroImage, { root, eager: true, cls: 'trip-hero__img' })}</div>
  <div class="container trip-hero__inner">
    ${crumbs.html}
    <p class="trip-hero__route" data-animate="rise">${icon.pin}<span>${esc(d.region)}, ${esc(d.province)}</span></p>
    <h1 class="trip-hero__title" data-animate="rise" style="--d:1">${esc(d.name)}</h1>
    <p class="trip-hero__summary" data-animate="rise" style="--d:2">${esc(d.summary)}</p>
    <dl class="trip-facts" data-animate="rise" style="--d:3"><div><dt>Elevation</dt><dd>${esc(d.elevation)}</dd></div><div><dt>Our trips</dt><dd>${esc(opNote)}</dd></div></dl>
  </div>
</section>
<div class="container dest-layout">
  <div class="dest-main">
    <section class="trip-section" aria-labelledby="about-h"><h2 class="trip-section__title" id="about-h">About ${esc(d.name)}</h2><div class="prose">${d.description.map((p) => `<p>${esc(p)}</p>`).join('')}</div></section>
    ${d.attractions?.length ? `<section class="trip-section" aria-labelledby="see-h"><h2 class="trip-section__title" id="see-h">What to see</h2><dl class="attractions">${d.attractions.map((a) => `<div><dt>${esc(a.name)}</dt><dd>${esc(a.text)}</dd></div>`).join('')}</dl></section>` : ''}
    ${d.seasons ? `<section class="trip-section" aria-labelledby="season-h"><h2 class="trip-section__title" id="season-h">Seasons</h2><p class="lead">${esc(d.seasons.summary)}</p><ul>${d.seasons.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <aside class="callout callout--verify"><p class="callout__label">Check before you travel</p><p>Seasonal conditions change from year to year. Reviewed ${fmtDate(d.seasons.reviewed, site.locale)}.${d.seasons.source?.url ? ` Source: <a href="${esc(d.seasons.source.url)}" target="_blank" rel="noopener noreferrer">${esc(d.seasons.source.label)}<span class="visually-hidden"> (opens in a new tab)</span></a>.` : ` ${esc(d.seasons.source?.label || '')}.`}</p></aside></section>` : ''}
    <section class="trip-section" aria-labelledby="advice-h"><h2 class="trip-section__title" id="advice-h">Travel advice</h2><ul class="checklist">${d.travelAdvice.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
    <section class="trip-section" aria-labelledby="dsafety-h"><h2 class="trip-section__title" id="dsafety-h">Safety</h2><ul class="safety-list">${d.safety.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
    ${d.gallery?.length ? `<section class="trip-section" aria-labelledby="dgal-h"><h2 class="trip-section__title" id="dgal-h">Gallery</h2><p class="trip-section__note">Placeholder artwork until licensed photographs are added.</p><div class="mini-gallery" data-gallery>${d.gallery.map((g) => `<a class="mini-gallery__item" href="${root}${images[g].src}-1600.webp" data-lightbox data-caption="${esc(images[g].alt)}">${K.picture(g, { root, sizes: '(min-width: 960px) 22vw, 50vw' })}</a>`).join('')}</div></section>` : ''}
    <p class="reviewed">Last reviewed ${fmtDate(d.lastReviewed, site.locale)}.</p>
  </div>
</div>
${relTrips.length ? `<section class="section" aria-labelledby="dtrips-h"><div class="container"><h2 class="section__title" id="dtrips-h">Trips that visit ${esc(d.name)}</h2><div class="ticket-list">${relTrips.map((t) => K.tripCard(t, root)).join('')}</div></div></section>` : ''}
${relArts.length ? `<section class="section section--alt" aria-labelledby="darts-h"><div class="container"><h2 class="section__title" id="darts-h">From the journal</h2><div class="post-grid">${relArts.map((a) => K.articleCard(a, root)).join('')}</div></div></section>` : ''}
${K.ctaBand(root)}
</main>`,
  }), { lastmod: d.lastReviewed });
});

/* ---- articles listing ---- */
{
  const cats = ARTICLE_CATEGORIES.filter((c) => articles.some((a) => a.category === c));
  const rest = articles.filter((a) => a !== featuredArticle);
  out('articles.html', page({
    file: 'articles.html', nav: 'articles', css: ['articles'],
    title: 'Travel journal: guides for student travellers',
    description: 'Practical, honest guides for students planning trips to Northern Pakistan: budgets, packing, seasons, safety and choosing a tour operator.',
    main: `<main id="main">
${pageHero({ title: 'Travel journal', lede: 'Practical guides for students planning their first trips north. Where facts change with the season or the year, we say so.', crumbs: K.breadcrumbs([{ label: 'Journal', href: 'articles.html' }], './') })}
<section class="section section--tight">
  <div class="container">
    ${featuredArticle ? `<div class="featured-post">${K.articleCard(featuredArticle, './', { featured: true, level: 2 })}</div>` : ''}
    <div class="filters" data-filters>
      <label class="filter-search">${icon.search}<span class="visually-hidden">Search articles</span><input type="search" placeholder="Search articles" data-filter-search autocomplete="off"></label>
      <div class="chips" role="group" aria-label="Filter by topic">
        <button type="button" class="chip" data-filter="all" aria-pressed="true">All</button>
        ${cats.map((c) => `<button type="button" class="chip" data-filter="${slugify(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}
      </div>
    </div>
    <p class="filter-status" data-filter-status data-noun="articles" role="status" aria-live="polite"></p>
    <div class="post-grid" data-filter-grid>${rest.map((a) => K.articleCard(a, './', { level: 2 })).join('\n')}</div>
    <div class="empty" data-filter-empty hidden><h2 class="empty__title">No articles match</h2><p>Try another word, or clear the filters.</p><div class="empty__actions"><button type="button" class="btn btn--quiet" data-filter-reset>Clear filters</button></div></div>
  </div>
</section>
</main>`,
  }), { lastmod: articles.map((a) => a.updated || a.date).sort().pop() });
}

/* ---- article pages ---- */
articles.forEach((a) => {
  const file = `articles/${a.slug}.html`; const root = '../';
  const { html, toc } = markdown(a.body, { root });
  const crumbs = K.breadcrumbs([{ label: 'Journal', href: 'articles.html' }, { label: a.title, href: file }], root);
  const related = articles.filter((x) => x.slug !== a.slug)
    .map((x) => ({ x, score: (x.category === a.category ? 2 : 0) + x.tags.filter((t) => a.tags.includes(t)).length }))
    .sort((p, q) => q.score - p.score || q.x.date.localeCompare(p.x.date)).slice(0, 3).map((r) => r.x);
  const relTrips = a.relatedTrips.map((id) => trips.find((t) => t.id === id)).filter(Boolean);
  const relDest = a.relatedDestinations.map((id) => destinations.find((d) => d.id === id)).filter(Boolean);
  const url = SITE_URL ? `${SITE_URL}/${file}` : '';
  const ld = jsonLd({
    '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.description,
    datePublished: a.date, dateModified: a.updated || a.date, inLanguage: site.locale,
    author: { '@type': 'Organization', name: isPlaceholder(BRAND) ? a.author : `${BRAND} ${a.author}`.trim() },
    ...(a.image && SITE_URL ? { image: `${SITE_URL}/${images[a.image].src}-${images[a.image].widths.slice(-1)[0]}.webp` } : {}),
    ...(url ? { mainEntityOfPage: url } : {}),
    ...(!isPlaceholder(BRAND) ? { publisher: { '@type': 'Organization', name: BRAND } } : {}),
  });
  const share = url ? `<div class="share"><p class="share__label">Share</p><a class="share__link" href="https://wa.me/?text=${encodeURIComponent(a.title + ' ' + url)}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a class="share__link" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener noreferrer">Facebook</a><a class="share__link" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&amp;text=${encodeURIComponent(a.title)}" target="_blank" rel="noopener noreferrer">X</a><button class="share__link" type="button" data-copy-link="${esc(url)}">Copy link</button></div>`
    : `<div class="share"><p class="share__label">Share</p><button class="share__link" type="button" data-copy-link>Copy link</button></div>`;
  out(file, page({
    file, nav: 'articles', css: ['articles', 'content'], type: 'article', image: a.image,
    title: a.title, description: a.description, seoExtra: crumbs.ld + ld + `\n<meta property="article:published_time" content="${a.date}">${a.updated ? `\n<meta property="article:modified_time" content="${a.updated}">` : ''}`,
    main: `<div class="read-progress" data-read-progress aria-hidden="true"></div>
<main id="main">
<article class="article">
  <header class="article-head">
    <div class="container container--article">
      ${crumbs.html}
      <p class="article-head__cat">${esc(a.category)}</p>
      <h1 class="article-head__title" data-animate="rise">${esc(a.title)}</h1>
      <p class="article-head__lede" data-animate="rise" style="--d:1">${esc(a.description)}</p>
      <p class="article-head__meta"><span>By ${esc(isPlaceholder(BRAND) ? a.author : `${BRAND} ${a.author}`)}</span><span>Published <time datetime="${a.date}">${fmtDate(a.date, site.locale)}</time></span>${a.updated && a.updated !== a.date ? `<span>Updated <time datetime="${a.updated}">${fmtDate(a.updated, site.locale)}</time></span>` : ''}<span>${a.minutes} min read</span></p>
    </div>
    ${a.image ? `<div class="article-head__media">${K.picture(a.image, { root, eager: true, sizes: '100vw' })}</div>` : ''}
  </header>
  <div class="container article-layout">
    ${toc.length > 2 ? `<nav class="toc" aria-label="Contents"><p class="toc__title">Contents</p><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : ''}
    <div class="article-body">
      ${a.reviewed ? `<aside class="callout callout--verify"><p class="callout__label">Check before you travel</p><p>Seasonal and practical details in this article were last reviewed on ${fmtDate(a.reviewed, site.locale)}. Prices, road conditions and rules change; confirm anything important with an official source close to your travel date.</p></aside>` : ''}
      <div class="prose prose--article">
${html}
      </div>
      ${a.tags.length ? `<ul class="tags" aria-label="Tags">${a.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${share}
      ${relTrips.length || relDest.length ? `<aside class="article-links" aria-label="Related trips and destinations">${relTrips.map((t) => `<a class="article-links__item" href="${root}trips/${t.slug}.html"><span>Trip</span>${esc(t.title)}</a>`).join('')}${relDest.map((d) => `<a class="article-links__item" href="${root}destinations/${d.slug}.html"><span>Destination</span>${esc(d.name)}</a>`).join('')}</aside>` : ''}
    </div>
  </div>
</article>
<section class="section section--alt" aria-labelledby="keep-h"><div class="container"><h2 class="section__title" id="keep-h">Keep reading</h2><div class="post-grid">${related.map((x) => K.articleCard(x, root)).join('')}</div></div></section>
${K.ctaBand(root)}
</main>`,
  }), { lastmod: a.updated || a.date });
});

/* ---- FAQ ---- */
out('faq.html', page({
  file: 'faq.html', nav: 'faq', css: ['content'],
  title: 'Questions about our student trips',
  description: 'How registration and booking work, what prices include, payments, cancellations, safety and what to bring on our student trips.',
  main: `<main id="main">
${pageHero({ title: 'Questions', lede: 'Straight answers. Where a policy is not final yet, we say so.', crumbs: K.breadcrumbs([{ label: 'Questions', href: 'faq.html' }], './') })}
<section class="section section--tight">
  <div class="container faq-page">
    <nav class="faq-page__nav" aria-label="Question topics"><ol>${faqs.groups.map((g) => `<li><a href="#${g.id}">${esc(g.title)}</a></li>`).join('')}</ol></nav>
    <div class="faq-page__groups">
      ${faqs.groups.map((g) => `<section class="faq-group" id="${g.id}" aria-labelledby="${g.id}-h"><h2 class="faq-group__title" id="${g.id}-h">${esc(g.title)}</h2><div class="faq-list">${g.items.map((q) => K.faqItem(q)).join('')}</div></section>`).join('\n')}
      <div class="faq-more"><h2 class="faq-more__title">Still have a question?</h2><p>Send us a message and include the trip you're asking about.</p><div class="faq-more__actions"><a class="btn btn--accent" href="./contact.html">Contact us</a>${K.waButton({ context: 'contact' })}</div></div>
    </div>
  </div>
</section>
</main>`,
}), { lastmod: site.policies.lastUpdated });

/* ---- gallery ---- */
{
  const allPlaceholder = gallery.items.every((g) => images[g.image].kind === 'illustration-placeholder');
  const cats = [...new Set(gallery.items.map((g) => g.category))];
  out('gallery.html', page({
    file: 'gallery.html', nav: '', css: ['content'],
    title: 'Gallery', description: 'Pictures from the hills of Northern Pakistan. Photographs from our own trips will be added after they take place.',
    main: `<main id="main">
${pageHero({ title: 'Gallery', lede: allPlaceholder ? 'Our first trip has not happened yet, so there are no trip photos here. The pictures below are illustrations, not photographs.' : 'Pictures from our trips and the places we visit.', crumbs: K.breadcrumbs([{ label: 'Gallery', href: 'gallery.html' }], './') })}
<section class="section section--tight">
  <div class="container">
    ${allPlaceholder ? K.notice('proposed', '<strong>Placeholder artwork.</strong> These are original illustrations used until we have real photographs. We will only publish photos of participants with their permission.') : ''}
    <div class="chips" role="group" aria-label="Filter pictures">
      <button type="button" class="chip" data-filter="all" aria-pressed="true">All</button>
      ${cats.map((c) => `<button type="button" class="chip" data-filter="${slugify(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}
    </div>
    <p class="filter-status" data-filter-status data-noun="pictures" data-noun-one="picture" role="status" aria-live="polite"></p>
    <ul class="gallery" data-filter-grid data-gallery>
      ${gallery.items.map((g) => `<li class="gallery__item" data-item data-category="${slugify(g.category)}"><a class="gallery__link" href="./${images[g.image].src}-1600.webp" data-lightbox data-caption="${esc(g.caption)}">${K.picture(g.image, { root: './', sizes: '(min-width: 960px) 33vw, (min-width: 600px) 50vw, 100vw' })}<span class="gallery__cap">${esc(g.caption)}</span></a></li>`).join('\n      ')}
    </ul>
  </div>
</section>
</main>`,
  }), { lastmod: site.policies.lastUpdated });
}

/* ---- testimonials ---- */
out('testimonials.html', page({
  file: 'testimonials.html', nav: '', css: ['content'],
  title: 'Traveller stories', description: 'What participants say about our trips, published only with their permission.',
  noindex: !hasTestimonials,
  main: `<main id="main">
${pageHero({ title: 'Traveller stories', lede: hasTestimonials ? 'In their own words, published with their permission.' : 'There are no stories here yet, because our first trip has not happened yet.', crumbs: K.breadcrumbs([{ label: 'Traveller stories', href: 'testimonials.html' }], './') })}
<section class="section section--tight"><div class="container container--narrow">
  ${hasTestimonials ? `<div class="quotes quotes--page">${testimonials.items.map((q) => `<figure class="quote"><blockquote><p>${esc(q.quote)}</p></blockquote><figcaption>${esc(q.name)}${q.university ? `, ${esc(q.university)}` : ''}<span>${esc(trips.find((t) => t.id === q.tripId)?.title || '')}, ${fmtDate(q.date, site.locale)}</span></figcaption></figure>`).join('')}</div>`
    : `<div class="prose"><h2>How we will collect stories</h2><p>After each trip we will ask participants for feedback. If someone is happy for their words to appear here, we will ask for written permission first and publish what they said without rewriting it.</p><p>We will not publish star ratings, invented reviews or reviews we cannot trace back to a real participant.</p><p>Until then, the best way to judge us is to <a href="./our-approach.html">read how we plan trips</a> and <a href="./contact.html">ask us anything</a>.</p></div>`}
</div></section>
</main>`,
}), { noindex: !hasTestimonials });

/* ---- policy pages (content/pages/*.md) ---- */
policies.forEach((pg) => {
  const file = `${pg.slug}.html`;
  const { html, toc } = markdown(pg.body.replace(/\{\{brand\}\}/g, BRAND), { root: './' });
  const draft = !site.policies.legalReviewed;
  out(file, page({
    file, nav: '', css: ['content'], title: pg.title, description: pg.description,
    main: `<main id="main">
${pageHero({ title: esc(pg.title), lede: esc(pg.description), crumbs: K.breadcrumbs([{ label: pg.title, href: file }], './') })}
<section class="section section--tight"><div class="container policy-layout">
  ${toc.length > 2 ? `<nav class="toc" aria-label="Contents"><p class="toc__title">Contents</p><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : ''}
  <div class="policy-body">
    ${draft ? K.notice('draft', `<strong>Draft, not yet legally reviewed.</strong> This policy is a working draft. It will be reviewed by a qualified professional in Pakistan before we accept any payments. Last updated ${fmtDate(site.policies.lastUpdated, site.locale)}.`) : `<p class="reviewed">Last updated ${fmtDate(site.policies.lastUpdated, site.locale)}.</p>`}
    <div class="prose">${html}</div>
  </div>
</div></section>
</main>`,
  }), { lastmod: site.policies.lastUpdated });
});

/* ---- image credits (from the manifest) ---- */
out('credits.html', page({
  file: 'credits.html', nav: '', css: ['content'], title: 'Image credits', description: 'Sources, licences and attribution for every image on this website.',
  main: `<main id="main">
${pageHero({ title: 'Image credits', lede: 'Where every image on this site comes from, and under what licence.', crumbs: K.breadcrumbs([{ label: 'Image credits', href: 'credits.html' }], './') })}
<section class="section section--tight"><div class="container container--narrow">
  <div class="table-wrap" tabindex="0" role="region" aria-label="Image credits"><table class="credits"><thead><tr><th scope="col">Image</th><th scope="col">Type</th><th scope="col">Source and licence</th></tr></thead><tbody>
  ${Object.entries(images).map(([, im]) => `<tr><th scope="row">${esc(im.alt)}</th><td>${im.kind === 'photo' ? 'Photograph' : 'Illustration (placeholder)'}</td><td>${esc(im.source)}. ${esc(im.licence)}.${im.attribution ? ` ${esc(im.attribution)}` : ''}</td></tr>`).join('\n  ')}
  </tbody></table></div>
  <p class="reviewed">Fonts: Archivo and Newsreader, both under the SIL Open Font License 1.1.</p>
</div></section>
</main>`,
}), { lastmod: site.policies.lastUpdated });

/* ---- about, approach, booking, booking-success, contact ---- */
const teamHtml = team.members.map((m) => `<figure class="person${m.placeholder ? ' person--placeholder' : ''}">
  <div class="person__photo">${m.photo ? `<img src="./${esc(m.photo)}" alt="" width="300" height="300" loading="lazy" decoding="async">` : `<span class="person__initial" aria-hidden="true">${m.placeholder ? '?' : esc(m.name[0])}</span>`}</div>
  <figcaption><p class="person__name">${esc(m.name)}</p><p class="person__role">${esc(m.role)}</p><p class="person__bio">${esc(m.bio)}</p>${m.placeholder ? '<p class="person__ph">Placeholder: details coming soon</p>' : ''}</figcaption>
</figure>`).join('\n');
renderTemplate('about-us.html', { team: teamHtml, 'cta-band': K.ctaBand('./'), crumbs: K.breadcrumbs([{ label: 'About', href: 'about-us.html' }], './').html });
renderTemplate('our-approach.html', { 'cta-band': K.ctaBand('./'), crumbs: K.breadcrumbs([{ label: 'How we plan', href: 'our-approach.html' }], './').html });
renderTemplate('booking.html', {
  form: K.bookingForm({ root: './', idPrefix: 'bk' }),
  crumbs: K.breadcrumbs([{ label: 'Register interest', href: 'booking.html' }], './').html,
  'trip-summaries': bookableTrips.map((t) => `<li><a href="./trips/${t.slug}.html">${esc(t.title)}</a> ${K.statusBadge(t.availability)}</li>`).join(''),
});
renderTemplate('booking-success.html', {
  'whatsapp-followup': K.waButton({ context: 'general', label: 'Message us on WhatsApp', cls: 'btn btn--ghost', attrs: 'data-whatsapp-dynamic' }),
});
renderTemplate('contact.html', {
  crumbs: K.breadcrumbs([{ label: 'Contact', href: 'contact.html' }], './').html,
  'contact-whatsapp': K.whatsappReady ? `<div class="contact-way"><h2 class="contact-way__title">WhatsApp</h2><p>The quickest way to reach us. WhatsApp opens with a draft message; you press Send.</p>${K.waButton({ context: 'contact', cls: 'btn btn--accent', label: 'Start a WhatsApp chat' })}</div>` : (DEV ? '<div class="contact-way"><span class="dev-note">WhatsApp hidden: set contact.whatsapp in content/site.json</span></div>' : ''),
  'contact-email': site.contact.email ? `<div class="contact-way"><h2 class="contact-way__title">Email</h2><p><a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a></p></div>` : (DEV ? '<div class="contact-way"><span class="dev-note">Email hidden: set contact.email in content/site.json</span></div>' : ''),
  'contact-socials': Object.values(site.socials).some(Boolean) ? `<div class="contact-way"><h2 class="contact-way__title">Social</h2><ul class="contact-socials">${Object.entries(site.socials).filter(([, u]) => u).map(([k, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(k[0].toUpperCase() + k.slice(1))}<span class="visually-hidden"> (opens in a new tab)</span></a></li>`).join('')}</ul></div>` : '',
  'response-time': site.contact.responseTime ? `<p class="contact-response">We usually reply ${esc(site.contact.responseTime)}.</p>` : '',
  'contact-none': !K.whatsappReady && !site.contact.email ? K.notice('proposed', 'Our direct contact details are being set up. Please use the form for now.') : '',
  'trip-options': trips.map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join(''),
  'forms-test-note': site.forms.mode === 'test' ? '<p class="form-mode form-mode--test" role="note"><strong>Test mode.</strong> Messages go to a test sheet.</p>' : '',
  'form-mode-input': site.forms.mode === 'test' ? '<input type="hidden" name="mode" value="test">' : '',
  'form-action': site.forms.mode !== 'off' ? `action="${esc(site.forms.endpoint)}" method="post"` : '',
});

/* ---- 404 (absolute links: GitHub Pages serves it at whatever URL was requested) ---- */
out('404.html', page({
  file: '404.html', nav: '', css: ['content'], noindex: true, rootOverride: BASE_PATH,
  title: 'Page not found', description: 'This page could not be found.',
  main: `<main id="main">
<section class="page-hero page-hero--404">
  <div class="container page-hero__inner">
    <p class="page-hero__code" aria-hidden="true">404</p>
    <h1 class="page-hero__title">This trail doesn't go anywhere</h1>
    <p class="page-hero__lede">The page may have moved, or the link may be wrong.</p>
    <div class="page-hero__actions"><a class="btn btn--accent" href="${BASE_PATH}">Go to the homepage</a><a class="btn btn--ghost" href="${BASE_PATH}trips.html">See trips</a></div>
  </div>
</section>
</main>`,
}), { noindex: true });

/* ---- redirects (content/redirects.json): old address → new address ---- */
{
  const file = path.join(ROOT, 'content/redirects.json');
  const map = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).redirects || {} : {};
  for (const [from, to] of Object.entries(map)) {
    if (!/^[a-z0-9/_-]+\.html$/.test(from) || !/^[a-z0-9/_#-]*(\.html)?(#[\w-]+)?$/.test(to)) { console.error(`  ✗ content/redirects.json: "${from}" → "${to}" must be site-relative .html paths`); process.exit(1); }
    if (fs.existsSync(path.join(DIST, from))) { console.error(`  ✗ content/redirects.json: "${from}" is an existing page; remove the redirect or the page`); process.exit(1); }
    const target = rootFor(from.split('/').length - 1) + to;
    out(from, `<!doctype html><html lang="${esc(site.language)}"><head><meta charset="utf-8"><title>Page moved</title><meta name="robots" content="noindex">${SITE_URL ? `<link rel="canonical" href="${esc(`${SITE_URL}/${to}`)}">` : ''}<meta http-equiv="refresh" content="0; url=${esc(target)}"></head><body><p>This page has moved to <a href="${esc(target)}">a new address</a>.</p></body></html>\n`, { noindex: true });
  }
}

/* ================================================================== */
/*  4. SEO files                                                       */
/* ================================================================== */
if (SITE_URL) {
  out('sitemap.xml', buildSitemap(SITE_URL, written));
  if (BASE_PATH === '/') {
    out('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  }
}

/* ================================================================== */
/*  5. verify internal links and assets in the output                  */
/* ================================================================== */
const linkProblems = checkLinks(DIST, { basePath: BASE_PATH });
if (linkProblems.length) {
  console.error(`\nBroken internal links or assets (${linkProblems.length}):`);
  linkProblems.slice(0, 50).forEach((p) => console.error('  ✗ ' + p));
  process.exit(1);
}

const pages = written.filter((w) => w.file.endsWith('.html')).length;
console.log(`Built ${pages} pages into dist/ (${trips.length} trips, ${destinations.length} destinations, ${articles.length} articles).`);
console.log(`Base path: ${BASE_PATH}${SITE_URL ? `  Site URL: ${SITE_URL}` : '  (no site URL: canonical tags and sitemap.xml skipped)'}`);
console.log(`Forms: ${site.forms.mode}   WhatsApp: ${K.whatsappReady ? 'on' : 'not configured (buttons hidden)'}   Internal links: OK`);
const allowed = Object.fromEntries(trips.filter((t) => AVAILABILITY[t.availability].bookable).map((t) => [t.id, t.title]));
console.log(`Apps Script property ALLOWED_TRIPS = ${JSON.stringify(allowed)}`);
if (todo.length) { console.log(`\nLaunch checklist (${todo.length}):`); todo.forEach((t) => console.log('  - ' + t)); }
