/* ==================================================================
   content.mjs — loads every content file and validates it.

   loadContent(ROOT) returns { site, trips, destinations, faqs, team,
   testimonials, gallery, images, articles, policies, errors, warnings }.
   The build refuses to continue while `errors` is non-empty, and prints
   each problem with the file and field so it can be fixed quickly.
   ================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { readJson, isPlaceholder } from './util.mjs';
import { markdown, frontMatter, plainText } from './markdown.mjs';

export const ARTICLE_CATEGORIES = ['Destination guides', 'Planning and budget', 'Safety and trust', 'Group travel'];
export const AVAILABILITY = {
  interest: { label: 'Registering interest', short: 'Interest', bookable: true },
  tentative: { label: 'Tentative', short: 'Tentative', bookable: true },
  open: { label: 'Booking open', short: 'Open', bookable: true },
  full: { label: 'Fully booked', short: 'Full', bookable: false },
  completed: { label: 'Completed', short: 'Completed', bookable: false },
  cancelled: { label: 'Cancelled', short: 'Cancelled', bookable: false },
};
const OPERATING = ['first-trip', 'planned', 'none'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function loadContent(ROOT) {
  const errors = []; const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
  const validDate = (d) => ISO.test(d || '') && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));

  let site, trips, destinations, faqs, team, testimonials, gallery, images;
  try { site = readJson(ROOT, 'content/site.json'); } catch (e) { err('content/site.json', e.message); }
  try { trips = readJson(ROOT, 'content/trips.json'); } catch (e) { err('content/trips.json', e.message); }
  try { destinations = readJson(ROOT, 'content/destinations.json'); } catch (e) { err('content/destinations.json', e.message); }
  try { faqs = readJson(ROOT, 'content/faqs.json'); } catch (e) { err('content/faqs.json', e.message); }
  try { team = readJson(ROOT, 'content/team.json'); } catch (e) { err('content/team.json', e.message); }
  try { testimonials = readJson(ROOT, 'content/testimonials.json'); } catch (e) { err('content/testimonials.json', e.message); }
  try { gallery = readJson(ROOT, 'content/gallery.json'); } catch (e) { err('content/gallery.json', e.message); }
  try { images = readJson(ROOT, 'content/images.json').images; } catch (e) { err('content/images.json', e.message); }
  if (errors.length) return { errors, warnings };

  /* ---------- images ---------- */
  for (const [key, im] of Object.entries(images)) {
    const w = `content/images.json → ${key}`;
    if (!['photo', 'motion', 'graphic'].includes(im.kind)) { err(w, `unknown kind "${im.kind}" (use photo, motion or graphic)`); continue; }
    for (const f of ['alt', 'kind', 'source', 'licence']) if (!im[f]) err(w, `missing "${f}"`);
    if (!im.width || !im.height) err(w, 'missing intrinsic "width"/"height" (sets the tile/photo shape, prevents layout shift)');
    if (im.kind === 'motion') { if (!im.label) err(w, 'motion tiles need a "label" (the big word) and a "hue" 0-360'); continue; }
    if (!im.src) err(w, 'missing "src"');
    if (im.kind === 'photo') {
      if (!Array.isArray(im.widths) || !im.widths.length) err(w, 'missing "widths"');
      if (/TODO|unknown/i.test(`${im.source} ${im.licence}`)) err(w, 'photo is missing a real source/licence');
    }
    if (/TODO/.test(`${im.alt} ${im.attribution || ''}`)) err(w, 'replace the TODO in the alt text / attribution');
    if (im.jpegFallback) { if (!fs.existsSync(path.join(ROOT, `${im.src}.jpg`))) err(w, `file not found: ${im.src}.jpg`); }
    else (im.widths || []).forEach((px) => {
      if (!fs.existsSync(path.join(ROOT, `${im.src}-${px}.webp`))) err(w, `file not found: ${im.src}-${px}.webp`);
    });
  }
  const imageRef = (where, key) => { if (key && !images[key]) err(where, `image "${key}" is not in content/images.json`); };

  /* ---------- site ---------- */
  {
    const w = 'content/site.json';
    if (!site.brand?.name) err(w, 'brand.name is required (use "[Brand Name]" until you have one)');
    if (site.currency !== 'PKR') warn(w, `currency is "${site.currency}", expected "PKR"`);
    if (site.siteUrl && !/^https:\/\/[^\s]+[^/]$/.test(site.siteUrl)) err(w, 'siteUrl must start with https:// and must not end with "/"');
    if (site.contact?.whatsapp && !/^\d{10,15}$/.test(site.contact.whatsapp)) err(w, 'contact.whatsapp must be digits only in international format, e.g. 923001234567');
    if (site.contact?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.contact.email)) err(w, 'contact.email is not a valid address');
    if (!['off', 'test', 'live'].includes(site.forms?.mode)) err(w, 'forms.mode must be "off", "test" or "live"');
    if (site.forms?.mode !== 'off' && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(site.forms?.endpoint || '')) {
      err(w, 'forms.endpoint must be a Google Apps Script web app URL ending in /exec when forms.mode is "test" or "live"');
    }
    if (site.operator?.verified && !(site.operator.registrationAuthority && site.operator.registrationNumber)) {
      err(w, 'operator.verified is true but registrationAuthority / registrationNumber are empty');
    }
    if (site.analytics?.enabled && !['plausible', 'ga4'].includes(site.analytics.provider)) err(w, 'analytics.provider must be "plausible" or "ga4" when analytics is enabled');
    if (site.home?.heroImage) imageRef(w + ' → home.heroImage', site.home.heroImage);
    if (!validDate(site.policies?.lastUpdated)) err(w, 'policies.lastUpdated must be YYYY-MM-DD');
  }

  /* ---------- articles ---------- */
  const artDir = path.join(ROOT, 'content/articles');
  const articles = fs.readdirSync(artDir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const where = `content/articles/${f}`;
    let parsed;
    try { parsed = frontMatter(fs.readFileSync(path.join(artDir, f), 'utf8'), where); } catch (e) { err(where, e.message); return null; }
    const { meta, body } = parsed;
    const slug = f.replace(/\.md$/, '');
    if (!SLUG.test(slug)) err(where, 'file name must be lowercase-words-with-hyphens.md');
    for (const k of ['title', 'description', 'date', 'category', 'author']) if (!meta[k]) err(where, `front matter is missing "${k}"`);
    if (meta.date && !validDate(meta.date)) err(where, `date "${meta.date}" must be YYYY-MM-DD`);
    if (meta.updated && !validDate(meta.updated)) err(where, `updated "${meta.updated}" must be YYYY-MM-DD`);
    if (meta.reviewed && !validDate(meta.reviewed)) err(where, `reviewed "${meta.reviewed}" must be YYYY-MM-DD`);
    if (meta.category && !ARTICLE_CATEGORIES.includes(meta.category)) err(where, `category "${meta.category}" must be one of: ${ARTICLE_CATEGORIES.join(', ')}`);
    if (meta.description && meta.description.length > 170) warn(where, `description is ${meta.description.length} characters; search results show about 155`);
    imageRef(where, meta.image);
    const list = (v) => (v || '').split(',').map((t) => t.trim()).filter(Boolean);
    const words = plainText(body).split(/\s+/).filter(Boolean).length;
    return {
      slug, ...meta, body,
      tags: list(meta.tags), relatedTrips: list(meta.relatedTrips), relatedDestinations: list(meta.relatedDestinations),
      words, minutes: Math.max(1, Math.round(words / 220)),
      featured: meta.featured === 'true', draft: meta.draft === 'true', _where: where,
    };
  }).filter(Boolean);
  const slugs = new Set();
  articles.forEach((a) => { if (slugs.has(a.slug)) err(a._where, 'duplicate slug'); slugs.add(a.slug); });
  const published = articles.filter((a) => !a.draft).sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const articleIds = new Set(published.map((a) => a.slug));
  if (published.filter((a) => a.featured).length > 1) warn('content/articles', 'more than one article has "featured: true"; the newest one is used');

  /* ---------- destinations ---------- */
  const destIds = new Set(); const destSlugs = new Set();
  destinations.forEach((d, i) => {
    const w = `content/destinations.json → ${d.id || '#' + i}`;
    for (const k of ['id', 'slug', 'name', 'region', 'summary', 'heroImage', 'seo', 'lastReviewed']) if (!d[k]) err(w, `missing "${k}"`);
    if (!Array.isArray(d.description) || !d.description.length) err(w, '"description" must be a list of paragraphs');
    if (d.slug && !SLUG.test(d.slug)) err(w, `slug "${d.slug}" must be lowercase-with-hyphens`);
    if (destIds.has(d.id)) err(w, `duplicate id "${d.id}"`); destIds.add(d.id);
    if (destSlugs.has(d.slug)) err(w, `duplicate slug "${d.slug}"`); destSlugs.add(d.slug);
    if (!OPERATING.includes(d.operating)) err(w, `"operating" must be one of ${OPERATING.join(', ')}`);
    if (d.lastReviewed && !validDate(d.lastReviewed)) err(w, 'lastReviewed must be YYYY-MM-DD');
    if (d.seasons && !d.seasons.reviewed) err(w, 'seasons.reviewed date is required for seasonal information');
    imageRef(w, d.heroImage); (d.gallery || []).forEach((g) => imageRef(w + ' → gallery', g));
    (d.relatedArticles || []).forEach((a) => { if (!articleIds.has(a)) err(w, `relatedArticles: no published article "${a}"`); });
  });

  /* ---------- trips ---------- */
  const tripIds = new Set(); const tripSlugs = new Set();
  trips.forEach((t, i) => {
    const w = `content/trips.json → ${t.id || '#' + i}`;
    for (const k of ['id', 'slug', 'title', 'summary', 'heroImage', 'duration', 'price', 'dates', 'availability', 'itinerary', 'seo', 'updated']) {
      if (t[k] === undefined || t[k] === '') err(w, `missing "${k}"`);
    }
    if (tripIds.has(t.id)) err(w, `duplicate id "${t.id}"`); tripIds.add(t.id);
    if (tripSlugs.has(t.slug)) err(w, `duplicate slug "${t.slug}"`); tripSlugs.add(t.slug);
    if (t.slug && !SLUG.test(t.slug)) err(w, `slug "${t.slug}" must be lowercase-with-hyphens`);
    if (t.id && !/^[a-z0-9-]{3,40}$/.test(t.id)) err(w, 'id must be 3–40 lowercase letters, numbers or hyphens (the Apps Script allowlist uses it)');
    if (!Array.isArray(t.destinationIds) || !t.destinationIds.length) err(w, '"destinationIds" must list at least one destination');
    (t.destinationIds || []).forEach((d) => { if (!destIds.has(d)) err(w, `destinationIds: no destination "${d}"`); });
    if (!AVAILABILITY[t.availability]) err(w, `availability "${t.availability}" must be one of ${Object.keys(AVAILABILITY).join(', ')}`);
    const p = t.price || {};
    if (p.currency !== 'PKR') err(w, 'price.currency must be "PKR"');
    if (p.amount !== null && p.amount !== undefined && !(Number.isFinite(p.amount) && p.amount > 0)) err(w, 'price.amount must be a positive number or null');
    if (p.amount == null && !(p.estimateMin > 0 && p.estimateMax >= p.estimateMin)) err(w, 'price needs either "amount" or a valid "estimateMin" ≤ "estimateMax"');
    if (p.status === 'confirmed' && p.amount == null) err(w, 'price.status is "confirmed" but price.amount is empty');
    if (!['proposed', 'confirmed'].includes(t.dates?.status)) err(w, 'dates.status must be "proposed" or "confirmed"');
    if (t.dates?.status === 'confirmed' && !(validDate(t.dates.start) && validDate(t.dates.end))) err(w, 'confirmed dates need valid "start" and "end" (YYYY-MM-DD)');
    if (t.dates?.status === 'confirmed' && t.dates.end < t.dates.start) err(w, 'dates.end is before dates.start');
    if (t.availability === 'open' && t.dates?.status !== 'confirmed') err(w, 'availability "open" requires confirmed dates');
    if (t.availability === 'open' && p.status !== 'confirmed') err(w, 'availability "open" requires a confirmed price');
    if (t.group && t.group.min > t.group.max) err(w, 'group.min is larger than group.max');
    if (!(t.duration?.days > 0)) err(w, 'duration.days must be a positive number');
    if (!validDate(t.updated)) err(w, 'updated must be YYYY-MM-DD');
    imageRef(w, t.heroImage); (t.gallery || []).forEach((g) => imageRef(w + ' → gallery', g));
    (t.relatedArticles || []).forEach((a) => { if (!articleIds.has(a)) err(w, `relatedArticles: no published article "${a}"`); });
    (t.itinerary || []).forEach((d, di) => { if (!d.title || !Array.isArray(d.stops)) err(w, `itinerary[${di}] needs "title" and "stops"`); });
    if (t.seo && t.seo.description && t.seo.description.length > 170) warn(w, 'seo.description is longer than ~155 characters');
  });

  // article → trip/destination references (checked after both are loaded)
  published.forEach((a) => {
    a.relatedTrips.forEach((id) => { if (!tripIds.has(id)) err(a._where, `relatedTrips: no trip "${id}"`); });
    a.relatedDestinations.forEach((id) => { if (!destIds.has(id)) err(a._where, `relatedDestinations: no destination "${id}"`); });
  });

  /* ---------- faqs, gallery, team, testimonials ---------- */
  const faqIds = new Set();
  (faqs.groups || []).forEach((g) => (g.items || []).forEach((q) => {
    const w = `content/faqs.json → ${q.id || q.q}`;
    if (!q.id || !q.q || !q.a) err(w, 'each FAQ needs "id", "q" and "a"');
    if (faqIds.has(q.id)) err(w, 'duplicate id'); faqIds.add(q.id);
  }));
  (gallery.items || []).forEach((g, i) => imageRef(`content/gallery.json → item ${i + 1}`, g.image));
  (team.members || []).forEach((m, i) => {
    if (!m.placeholder && isPlaceholder(m.name)) err(`content/team.json → member ${i + 1}`, 'placeholder is false but the name is still a placeholder');
    if (m.photo && !fs.existsSync(path.join(ROOT, m.photo))) err(`content/team.json → member ${i + 1}`, `photo not found: ${m.photo}`);
  });
  (testimonials.items || []).forEach((t, i) => {
    const w = `content/testimonials.json → item ${i + 1}`;
    for (const k of ['quote', 'name', 'tripId', 'date', 'consentRecord']) if (!t[k]) err(w, `missing "${k}" (testimonials need a consent record)`);
    if (t.tripId && !tripIds.has(t.tripId)) err(w, `no trip "${t.tripId}"`);
    const trip = trips.find((x) => x.id === t.tripId);
    if (trip && trip.availability !== 'completed') err(w, `trip "${t.tripId}" is not marked completed; testimonials must come from trips that happened`);
  });

  /* ---------- policy pages (Markdown) ---------- */
  const polDir = path.join(ROOT, 'content/pages');
  const policies = fs.existsSync(polDir) ? fs.readdirSync(polDir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const where = `content/pages/${f}`;
    try {
      const { meta, body } = frontMatter(fs.readFileSync(path.join(polDir, f), 'utf8'), where);
      for (const k of ['title', 'description']) if (!meta[k]) err(where, `front matter is missing "${k}"`);
      return { slug: f.replace(/\.md$/, ''), ...meta, body };
    } catch (e) { err(where, e.message); return null; }
  }).filter(Boolean) : [];

  return {
    site, trips, destinations, faqs, team, testimonials, gallery, images,
    articles: published, policies, errors, warnings, markdown,
  };
}

/** Everything that still needs the owner's input before launch. */
export function placeholderReport(c, siteUrl) {
  const t = [];
  if (isPlaceholder(c.site.brand.name)) t.push('content/site.json → brand.name / brand.shortName: replace "[Brand Name]" with your brand');
  if (!siteUrl) t.push('content/site.json → siteUrl: set your public URL (needed for canonical tags, Open Graph and sitemap.xml)');
  if (!c.site.contact.whatsapp) t.push('content/site.json → contact.whatsapp: add your WhatsApp Business number (digits only, e.g. 923001234567); WhatsApp buttons are hidden until then');
  if (!c.site.contact.email) t.push('content/site.json → contact.email: add a business email address');
  if (!Object.values(c.site.socials).some(Boolean)) t.push('content/site.json → socials: add at least one social profile URL');
  if (c.site.forms.mode === 'off') t.push('content/site.json → forms: online registration is OFF. Deploy the Apps Script (docs/GOOGLE_SHEETS_SETUP.md), then set mode "test", verify, then "live"');
  if (c.site.forms.mode === 'test') t.push('content/site.json → forms.mode is "test": switch to "live" only after a verified test submission');
  if (!c.site.policies.legalReviewed) t.push('content/pages/*.md: policy drafts need local legal review before accepting payments (then set policies.legalReviewed to true)');
  if (!c.site.operator.verified) t.push('content/site.json → operator: registration/licence details not provided (nothing is claimed on the site)');
  c.team.members.filter((m) => m.placeholder).forEach((m, i) => t.push(`content/team.json → member ${i + 1}: replace placeholder name, bio and photo`));
  const ph = Object.values(c.images).filter((im) => im.kind === 'motion').length;
  if (ph) t.push(`content/images.json: ${ph} image slots use animated motion tiles; add licensed photos when you have them (docs/IMAGE_SOURCES.md)`);
  c.trips.forEach((tr) => {
    if (tr.dates.status !== 'confirmed') t.push(`content/trips.json → ${tr.id}: dates not confirmed`);
    if (tr.price.status !== 'confirmed') t.push(`content/trips.json → ${tr.id}: price is an estimate`);
    ['transport', 'accommodation', 'meals'].forEach((k) => { if (tr[k]?.status !== 'confirmed') t.push(`content/trips.json → ${tr.id}: ${k} not confirmed`); });
  });
  return t;
}
