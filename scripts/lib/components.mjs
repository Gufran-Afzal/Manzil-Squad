/* ==================================================================
   components.mjs — reusable HTML building blocks for the build.

   Every function returns a string of static HTML. They are created by
   makeComponents(ctx) so they can read the site config, image manifest
   and WhatsApp settings without passing them around everywhere.

   (The Portfolio project kept these inside build.mjs. They live here
   now because the travel site has many more of them.)
   ================================================================== */
import { esc, fmtDate, fmtMoney, slugify, jsonLd, isPlaceholder } from './util.mjs';
import { elevationProfile } from './artwork.mjs';
import { AVAILABILITY } from './content.mjs';
import { buildLink, buildMessage } from '../../src/js/whatsapp.js';

export const icon = {
  arrow: '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  whatsapp: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.3 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z"/></svg>',
  mail: '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.6"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  minus: '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  search: '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  pin: '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.3" stroke="currentColor" stroke-width="1.6"/></svg>',
  mark: '<svg class="brand-mark" viewBox="0 0 40 28" aria-hidden="true" focusable="false"><path d="M1 27 13 9l6 8 6-11 14 21Z" fill="currentColor"/><circle cx="31" cy="6" r="3.2" fill="var(--c-accent)"/></svg>',
};

/** Status badges: text + a distinct shape, so status never relies on colour. */
const STATUS_SHAPE = {
  interest: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  tentative: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.2 1.6"/></svg>',
  open: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="currentColor"/></svg>',
  full: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" fill="currentColor"/></svg>',
  completed: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 6.5 2.5 2.5L10 3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  cancelled: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.8"/></svg>',
};

export function makeComponents(ctx) {
  const { site, images, trips, destinations, dev } = ctx;
  const brand = site.brand.name;
  const whatsappReady = !!buildLink(site.contact.whatsapp);

  /* ---------- images ---------- */
  function picture(key, { root, sizes = '100vw', eager = false, cls = '', alt } = {}) {
    const im = images[key];
    if (!im) throw new Error(`Unknown image key "${key}"`);
    const srcset = im.widths.map((w) => `${root}${im.src}-${w}.webp ${w}w`).join(', ');
    const fallback = `${root}${im.src}-${im.widths[Math.min(1, im.widths.length - 1)]}.webp`;
    const a = alt !== undefined ? alt : im.alt;
    return `<img class="${esc(cls)}" src="${fallback}" srcset="${srcset}" sizes="${esc(sizes)}" width="${im.width}" height="${im.height}" alt="${esc(a)}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async"${im.kind === 'illustration-placeholder' ? ' data-placeholder-art' : ''}>`;
  }

  /* ---------- trip facts ---------- */
  const durationText = (d) => `${d.days} ${d.days === 1 ? 'day' : 'days'}${d.nights ? `, ${d.nights} ${d.nights === 1 ? 'night' : 'nights'}` : ''}`;
  function priceText(t) {
    const p = t.price;
    if (p.amount != null && p.status === 'confirmed') return { main: fmtMoney(p.amount, p.currency, site.locale), note: 'per person', confirmed: true };
    if (p.amount != null) return { main: fmtMoney(p.amount, p.currency, site.locale), note: 'per person, not yet confirmed', confirmed: false };
    return { main: `${fmtMoney(p.estimateMin, p.currency, site.locale)}–${Number(p.estimateMax).toLocaleString(site.locale)}`, note: 'expected range per person', confirmed: false };
  }
  function dateText(t) {
    if (t.dates.status !== 'confirmed') return { main: 'To be announced', note: 'proposed trip', confirmed: false };
    const s = fmtDate(t.dates.start, site.locale); const e = fmtDate(t.dates.end, site.locale);
    return { main: s === e ? s : `${s} to ${e}`, note: 'confirmed', confirmed: true };
  }
  const statusBadge = (key, extra = '') => {
    const s = AVAILABILITY[key];
    return `<span class="status status--${key}${extra}">${STATUS_SHAPE[key]}<span>${esc(s.label)}</span></span>`;
  };
  const destNames = (t) => t.destinationIds.map((id) => destinations.find((d) => d.id === id)?.name).filter(Boolean);
  const andList = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
  const budgetBand = (t) => { const v = t.price.amount ?? t.price.estimateMax; return v <= 15000 ? 'under-15k' : v <= 30000 ? '15k-30k' : 'over-30k'; };
  const lengthBand = (t) => (t.duration.nights <= 1 ? 'weekend' : t.duration.nights <= 4 ? 'short' : 'long');

  /* ---------- WhatsApp ---------- */
  function waHref(context, trip) { return buildLink(site.contact.whatsapp, buildMessage({ context, brand, trip })); }
  function waButton({ context = 'general', trip = null, label = 'Chat on WhatsApp', cls = 'btn btn--ghost', attrs = '' } = {}) {
    const href = waHref(context, trip);
    if (!href) {
      return dev ? `<span class="dev-note" role="note">WhatsApp button hidden: set contact.whatsapp in content/site.json</span>` : '';
    }
    return `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-whatsapp="${context}"${trip ? ` data-trip-id="${esc(trip.id)}"` : ''} ${attrs}>${icon.whatsapp}<span>${esc(label)}</span><span class="visually-hidden"> (opens WhatsApp; you'll need to press Send)</span></a>`;
  }

  /* ---------- cards ---------- */
  function tripCard(t, root, { level = 3 } = {}) {
    const pr = priceText(t); const dt = dateText(t); const names = destNames(t);
    const st = AVAILABILITY[t.availability];
    const url = `${root}trips/${t.slug}.html`;
    const search = [t.title, t.summary, names.join(' '), st.label].join(' ').toLowerCase();
    return `<article class="ticket" data-item data-destination="${esc(t.destinationIds.join(' '))}" data-budget="${budgetBand(t)}" data-length="${lengthBand(t)}" data-status="${t.availability}" data-search="${esc(search)}">
  <div class="ticket__media">${picture(t.heroImage, { root, sizes: '(min-width: 960px) 34vw, 100vw' })}</div>
  <div class="ticket__body">
    <p class="ticket__route">${icon.pin}<span>Lahore to ${esc(andList(names))}</span></p>
    <h${level} class="ticket__title"><a href="${url}" class="ticket__link">${esc(t.title)}</a></h${level}>
    <p class="ticket__summary">${esc(t.summary)}</p>
    <dl class="ticket__facts">
      <div><dt>Length</dt><dd>${durationText(t.duration)}</dd></div>
      <div><dt>Date</dt><dd>${esc(dt.main)}</dd></div>
      ${t.group ? `<div><dt>Group</dt><dd>${t.group.min}–${t.group.max} people</dd></div>` : ''}
    </dl>
    ${t.inclusions?.items?.length ? `<p class="ticket__incl"><span class="ticket__incl-label">${t.inclusions.status === 'confirmed' ? 'Includes' : 'Planned to include'}</span> ${esc(t.inclusions.items.slice(0, 3).map((x) => x.split(',')[0].replace(/\.$/, '')).join('; '))}</p>` : ''}
  </div>
  <div class="ticket__stub">
    ${statusBadge(t.availability)}
    <p class="ticket__price"><span class="ticket__price-main">${esc(pr.main)}</span><span class="ticket__price-note">${esc(pr.note)}</span></p>
    ${st.bookable ? `<a class="btn btn--accent btn--small" href="${url}#register">${t.availability === 'open' ? 'Book a seat' : 'Register interest'}<span class="visually-hidden">: ${esc(t.title)}</span></a>` : `<a class="btn btn--quiet btn--small" href="${url}">View trip<span class="visually-hidden">: ${esc(t.title)}</span></a>`}
  </div>
</article>`;
  }

  function destinationCard(d, root, { size = '', level = 3 } = {}) {
    const op = { 'first-trip': 'Our first proposed trip', planned: 'Trip in planning', none: 'Guide only, no trips yet' }[d.operating];
    return `<article class="dest-card${size ? ' dest-card--' + size : ''}" data-item data-category="${slugify(d.region)}" data-search="${esc([d.name, d.region, d.province, d.summary].join(' ').toLowerCase())}">
  <div class="dest-card__media">${picture(d.heroImage, { root, sizes: size === 'large' ? '(min-width: 960px) 58vw, 100vw' : '(min-width: 960px) 30vw, 100vw' })}</div>
  <div class="dest-card__body">
    <p class="dest-card__region">${esc(d.region)}, ${esc(d.province)}</p>
    <h${level} class="dest-card__title"><a href="${root}destinations/${d.slug}.html" class="dest-card__link">${esc(d.name)}</a></h${level}>
    <p class="dest-card__text">${esc(d.summary)}</p>
    <p class="dest-card__op dest-card__op--${d.operating}">${esc(op)}</p>
  </div>
</article>`;
  }

  function articleCard(a, root, { featured = false, level = 3 } = {}) {
    const img = a.image ? picture(a.image, { root, sizes: featured ? '(min-width: 960px) 50vw, 100vw' : '(min-width: 960px) 30vw, 100vw', alt: '' }) : '';
    return `<article class="post-card${featured ? ' post-card--featured' : ''}" data-item data-category="${slugify(a.category)}" data-search="${esc([a.title, a.description, a.tags.join(' '), a.category].join(' ').toLowerCase())}">
  ${img ? `<div class="post-card__media">${img}</div>` : ''}
  <div class="post-card__body">
    <p class="post-card__cat">${esc(a.category)}</p>
    <h${level} class="post-card__title"><a class="post-card__link" href="${root}articles/${a.slug}.html">${esc(a.title)}</a></h${level}>
    <p class="post-card__text">${esc(a.description)}</p>
    <p class="post-card__meta"><time datetime="${a.date}">${fmtDate(a.date, site.locale)}</time><span>${a.minutes} min read</span></p>
  </div>
</article>`;
  }

  /* ---------- FAQ ---------- */
  const faqItem = (q, level = 3) => `<details class="faq" id="faq-${esc(q.id)}">
  <summary class="faq__q"><h${level} class="faq__q-text">${esc(q.q)}</h${level}><span class="faq__icon" aria-hidden="true"></span></summary>
  <div class="faq__a"><div class="faq__a-inner">${q.pending ? '<p class="faq__pending">Policy not final yet</p>' : ''}<p>${esc(q.a)}</p></div></div>
</details>`;

  /* ---------- breadcrumbs (+ BreadcrumbList when the site URL is known) ---------- */
  function breadcrumbs(items, root, { light = false } = {}) {
    const all = [{ label: 'Home', href: '' }, ...items];
    const html = `<nav class="crumbs${light ? ' crumbs--light' : ''}" aria-label="Breadcrumb"><ol>${all.map((it, i) => (i === all.length - 1
      ? `<li><span aria-current="page">${esc(it.label)}</span></li>`
      : `<li><a href="${root}${it.href}">${esc(it.label)}</a></li>`)).join('')}</ol></nav>`;
    const ld = ctx.SITE_URL ? jsonLd({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: all.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.label, ...(i < all.length - 1 || it.href !== undefined ? { item: `${ctx.SITE_URL}/${it.href || ''}` } : {}) })),
    }) : '';
    return { html, ld };
  }

  /* ---------- route: elevation profile (the site's signature graphic) ---------- */
  function routeProfile(t, { id = 'route' } = {}) {
    if (!t.route?.length) return '';
    const W = 1000, H = 300;
    const pr = elevationProfile(t.route, { W, H, pad: 36 });
    const max = Math.max(...t.route.map((s) => s.elevation));
    const pts = pr.points;
    // Stops that sit close together get alternating label rows to avoid overlap.
    const labels = pts.map((p, i) => {
      const close = i > 0 && p.x - pts[i - 1].x < 90;
      const dy = close && i % 2 ? -46 : -20;
      return `<g class="route__stop" style="--i:${i}"><circle cx="${p.x}" cy="${p.y}" r="6"/><text x="${p.x}" y="${p.y + dy}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${esc(p.name)}</text></g>`;
    }).join('');
    return `<figure class="route" data-route>
  <div class="route__chart">
    <svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false" class="route__svg">
      <defs><linearGradient id="${id}-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
      <path class="route__area" d="${pr.area}" fill="url(#${id}-fill)"/>
      <path class="route__line" d="${pr.d}" pathLength="1"/>
    </svg>
    <svg viewBox="0 0 ${W} ${H}" class="route__labels" aria-hidden="true" focusable="false">${labels}</svg>
  </div>
  <ol class="route__list">${t.route.map((s) => `<li><span class="route__name">${esc(s.name)}</span><span class="route__el">about ${s.elevation.toLocaleString('en-PK')} m</span><span class="route__km">${s.km ? `≈ ${s.km} km from Lahore` : 'Start'}</span></li>`).join('')}</ol>
  <figcaption class="route__cap">The climb: from about ${t.route[0].elevation} m in Lahore to about ${max.toLocaleString('en-PK')} m in the hills. Heights are to scale; distances along the line are not. ${esc(t.routeNote || '')}</figcaption>
</figure>`;
  }

  /* ---------- itinerary ---------- */
  function itinerary(t) {
    return `<div class="itinerary" data-itinerary>
  <div class="itinerary__track" aria-hidden="true"><span class="itinerary__fill" data-itinerary-fill></span></div>
  ${t.itinerary.map((d) => `<section class="itinerary__day" aria-labelledby="day-${d.day}">
    <h3 class="itinerary__day-title" id="day-${d.day}"><span class="itinerary__day-num">Day ${d.day}</span> ${esc(d.title)}</h3>
    <ol class="itinerary__stops">
      ${d.stops.map((s) => `<li class="itinerary__stop" data-itinerary-stop><p class="itinerary__time">${esc(s.time)}</p><h4 class="itinerary__stop-title">${esc(s.title)}</h4><p>${esc(s.text)}</p></li>`).join('\n      ')}
    </ol>
  </section>`).join('\n  ')}
</div>`;
  }

  /* ---------- booking / registration form ---------- */
  function bookingForm({ root, preselect = null, idPrefix = 'bk', heading = 'Register your interest' }) {
    const bookable = trips.filter((t) => AVAILABILITY[t.availability].bookable);
    const mode = site.forms.mode;
    const p = (s) => `${idPrefix}-${s}`;
    if (!bookable.length) return `<div class="form-card"><h2>${esc(heading)}</h2><p>There are no trips open for registration right now. Follow us or check back soon.</p></div>`;
    return `<div class="form-card" id="register">
  <div class="form-card__head">
    <h2 class="form-card__title">${esc(heading)}</h2>
    <p class="form-card__lede">This is a request, not a booking. Registering does not reserve a seat or commit you to pay. We'll contact you with the confirmed details and next steps.</p>
    ${mode === 'test' ? '<p class="form-mode form-mode--test" role="note"><strong>Test mode.</strong> Submissions go to a test sheet and are not treated as real registrations.</p>' : ''}
  </div>
  <form class="form" data-booking-form novalidate ${mode !== 'off' ? `action="${esc(site.forms.endpoint)}" method="post"` : ''} data-form-type="booking" aria-describedby="${p('privacy')}">
    <input type="hidden" name="formatHint" value="html">${mode === 'test' ? '<input type="hidden" name="mode" value="test">' : ''}
    <div class="form__row">
      <label class="field" for="${p('trip')}">
        <span class="field__label">Trip</span>
        <select class="field__input" id="${p('trip')}" name="tripId" required data-trip-select>
          ${bookable.map((t) => `<option value="${esc(t.id)}" data-title="${esc(t.title)}"${(preselect ? t.id === preselect : t === bookable[0]) ? ' selected' : ''}>${esc(t.title)} (${esc(AVAILABILITY[t.availability].label.toLowerCase())})</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="form__row form__row--2">
      <label class="field" for="${p('name')}">
        <span class="field__label">Full name</span>
        <input class="field__input" id="${p('name')}" name="name" type="text" autocomplete="name" required minlength="2" maxlength="80" aria-describedby="${p('name')}-err">
        <span class="field__error" id="${p('name')}-err" data-error-for="name" hidden></span>
      </label>
      <label class="field" for="${p('phone')}">
        <span class="field__label">Mobile number</span>
        <input class="field__input" id="${p('phone')}" name="phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="20" placeholder="03XX XXXXXXX" aria-describedby="${p('phone')}-hint ${p('phone')}-err">
        <span class="field__hint" id="${p('phone')}-hint">Pakistani mobile or international format</span>
        <span class="field__error" id="${p('phone')}-err" data-error-for="phone" hidden></span>
      </label>
    </div>
    <div class="form__row form__row--2">
      <label class="field" for="${p('email')}">
        <span class="field__label">Email <span class="field__opt">(optional)</span></span>
        <input class="field__input" id="${p('email')}" name="email" type="email" autocomplete="email" maxlength="120" aria-describedby="${p('email')}-err">
        <span class="field__error" id="${p('email')}-err" data-error-for="email" hidden></span>
      </label>
      <label class="field" for="${p('uni')}">
        <span class="field__label">University</span>
        <input class="field__input" id="${p('uni')}" name="university" type="text" required maxlength="100" list="${p('uni-list')}" autocomplete="organization" aria-describedby="${p('uni')}-err">
        <datalist id="${p('uni-list')}"><option value="University of Lahore (UOL)"></option><option value="Other university in Lahore"></option></datalist>
        <span class="field__error" id="${p('uni')}-err" data-error-for="university" hidden></span>
      </label>
    </div>
    <div class="form__row form__row--2">
      <label class="field" for="${p('count')}">
        <span class="field__label">Number of people</span>
        <input class="field__input" id="${p('count')}" name="participants" type="number" inputmode="numeric" min="1" max="10" value="1" required aria-describedby="${p('count')}-hint ${p('count')}-err">
        <span class="field__hint" id="${p('count')}-hint">Including you. Up to 10 per request.</span>
        <span class="field__error" id="${p('count')}-err" data-error-for="participants" hidden></span>
      </label>
      <fieldset class="field field--choices">
        <legend class="field__label">Best way to reach you</legend>
        <div class="choices">
          <label class="choice"><input type="radio" name="contactPreference" value="whatsapp" checked> <span>WhatsApp</span></label>
          <label class="choice"><input type="radio" name="contactPreference" value="call"> <span>Phone call</span></label>
          <label class="choice"><input type="radio" name="contactPreference" value="email"> <span>Email</span></label>
        </div>
        <span class="field__error" data-error-for="contactPreference" hidden></span>
      </fieldset>
    </div>
    <label class="field" for="${p('notes')}">
      <span class="field__label">Anything we should know? <span class="field__opt">(optional)</span></span>
      <textarea class="field__input" id="${p('notes')}" name="notes" rows="3" maxlength="500" aria-describedby="${p('notes')}-hint ${p('notes')}-err"></textarea>
      <span class="field__hint" id="${p('notes')}-hint">For example: travelling with friends, or a question about the trip. Please don't include CNIC numbers, health details or payment information here; we'll ask privately if anything is needed.</span>
      <span class="field__error" id="${p('notes')}-err" data-error-for="notes" hidden></span>
    </label>
    <div class="hp" aria-hidden="true"><label>Leave this field empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
    <div class="form__consents">
      <label class="check"><input type="checkbox" name="consentPrivacy" value="yes" required aria-describedby="${p('privacy')}"> <span>I agree that my details can be used to contact me about this trip, as described in the <a href="${root}privacy-policy.html">privacy policy</a>.</span></label>
      <label class="check"><input type="checkbox" name="consentTerms" value="yes" required> <span>I understand this is a registration request, not a confirmed booking, and I have read the <a href="${root}terms.html">booking terms</a>.</span></label>
      <span class="field__error" data-error-for="consent" hidden></span>
    </div>
    <p class="form__privacy" id="${p('privacy')}">We only use these details to organise the trip. We don't sell or share them, and we never ask for card details or passwords.</p>
    <div class="form__actions">
      <button class="btn btn--accent btn--submit" type="submit" data-submit><span class="btn__label">Send registration request</span><span class="btn__spinner" aria-hidden="true"></span></button>
      ${waButton({ context: 'booking', trip: preselect ? trips.find((t) => t.id === preselect) : bookable[0], label: 'Or register on WhatsApp', cls: 'btn btn--ghost', attrs: 'data-whatsapp-dynamic' })}
    </div>
    <div class="form__status" data-form-status role="status" aria-live="polite" tabindex="-1" hidden></div>
    <noscript><p class="form__noscript">This form needs JavaScript to send your request. You can ${whatsappReady ? 'use the WhatsApp button above' : ''}${whatsappReady && site.contact.email ? ' or ' : ''}${site.contact.email ? `email <a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a>` : ''}${!whatsappReady && !site.contact.email ? 'contact us using the details on the contact page' : ''} instead.</p></noscript>
  </form>
</div>`;
  }

  /* ---------- misc ---------- */
  const notice = (kind, html) => `<div class="notice notice--${kind}" role="note">${html}</div>`;
  function ctaBand(root, { heading = 'Want a seat when the first trip is confirmed?', text = 'Register interest now. It is free and does not commit you to anything. We will message you when dates and the final price are set.' } = {}) {
    return `<section class="cta-band" aria-labelledby="cta-band-h">
  <div class="container cta-band__inner">
    <h2 class="cta-band__heading" id="cta-band-h">${esc(heading)}</h2>
    <p class="cta-band__text">${esc(text)}</p>
    <div class="cta-band__actions"><a class="btn btn--accent" href="${root}booking.html">Register interest</a>${waButton({ context: 'general', cls: 'btn btn--ghost-light' })}</div>
  </div>
</section>`;
  }

  return { picture, priceText, dateText, durationText, statusBadge, destNames, andList, tripCard, destinationCard, articleCard, faqItem, breadcrumbs, routeProfile, itinerary, bookingForm, notice, ctaBand, waButton, waHref, whatsappReady, isPlaceholderBrand: isPlaceholder(brand) };
}
