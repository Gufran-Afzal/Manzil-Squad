/* ==================================================================
   pages.mjs — every page of the site, as plain template functions.
   Content comes from content/ JSON and Markdown files; this file
   only decides how it is laid out.
   ================================================================== */
import { esc, slugify, fmtDate, jsonLd, isPlaceholder } from '../lib/util.mjs';
import { markdown } from '../lib/markdown.mjs';
import { icon } from '../lib/components.mjs';
import { AVAILABILITY, ARTICLE_CATEGORIES } from '../lib/content.mjs';
import { ridgeStrip, climbChart } from './art.mjs';
import { split, arrow, ctaBand, pageHero } from './layout.mjs';

export function buildPages({ C, K, L, out, BRAND, SITE_URL, BASE_PATH }) {
  const { site, trips, destinations, faqs, team, testimonials, images, articles, policies } = C;
  const bookable = trips.filter((t) => AVAILABILITY[t.availability].bookable);
  const featured = bookable[0] || trips[0];
  const allFaqs = faqs.groups.flatMap((g) => g.items);
  const homeFaqs = allFaqs.filter((q) => q.home);
  const hasQuotes = testimonials.items.length > 0;
  const lastmod = site.policies.lastUpdated;
  const crumb = (items, root) => K.breadcrumbs(items, root);
  const brandBy = (a) => (isPlaceholder(BRAND) ? a.author : `${BRAND} ${a.author}`.trim());
  const art = (key, root, o = {}) => K.picture(key, { root, ...o });

  /* ---------- reusable cards ---------- */
  const ticket = (t, root, h = 3) => {
    const pr = K.priceText(t), dt = K.dateText(t), st = AVAILABILITY[t.availability], url = `${root}trips/${t.slug}.html`;
    return `<article class="ticket" data-r>
  <div class="ticket__main">
    <p class="ticket__route">${icon.pin}<span>Lahore to ${esc(K.andList(K.destNames(t)))}</span></p>
    <h${h} class="ticket__t"><a href="${url}">${esc(t.title)}</a></h${h}>
    <p class="ticket__sum">${esc(t.summary)}</p>
    <dl class="ticket__facts">
      <div><dt>Length</dt><dd>${K.durationText(t.duration)}</dd></div>
      <div><dt>Date</dt><dd>${esc(dt.main)}</dd></div>
      ${t.group ? `<div><dt>Group</dt><dd>${t.group.min}–${t.group.max} people</dd></div>` : ''}
    </dl>
  </div>
  <div class="ticket__stub">
    ${K.statusBadge(t.availability)}
    <p class="ticket__price">${esc(pr.main)}<small>${esc(pr.note)}</small></p>
    ${st.bookable ? `<a class="btn btn--accent" href="${url}#register">${t.availability === 'open' ? 'Book a seat' : 'Register interest'} ${arrow}<span class="vh">: ${esc(t.title)}</span></a>` : `<a class="btn btn--ghost" href="${url}">View trip</a>`}
  </div>
</article>`;
  };
  const opLabel = { 'first-trip': 'Our first proposed trip', planned: 'Trip in planning', none: 'Guide only, no trips yet' };
  const dcard = (d, root, h = 3) => `<a class="dc" href="${root}destinations/${d.slug}.html">${art(d.heroImage, root, { sizes: '(min-width: 1000px) 33vw, 80vw' })}<span class="dc__b"><span class="dc__r">${esc(d.region)} · ${esc(d.province)}</span><span class="dc__n h${h}-like">${esc(d.name)}</span><span class="dc__e">${esc(d.elevation)}</span><span class="dc__op dc__op--${d.operating}">${esc(opLabel[d.operating])}</span></span></a>`;
  const postCard = (a, root, { img = true } = {}) => `<a class="pc" href="${root}articles/${a.slug}.html">${img && a.image ? art(a.image, root, { sizes: '(min-width: 1000px) 33vw, (min-width: 640px) 50vw, 100vw', alt: '' }) : ''}<span class="pc__b"><span class="pc__c">${esc(a.category)}</span><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p><p class="pc__m">${fmtDate(a.date, site.locale)} · ${a.minutes} min read</p></span></a>`;
  const journalRow = (a, root) => `<a class="jr" href="${root}articles/${a.slug}.html"><span class="jr__c">${esc(a.category)}</span><span class="jr__t">${esc(a.title)}</span><span class="jr__a" aria-hidden="true">${arrow}</span><span class="jr__m">${a.minutes} min read · ${fmtDate(a.date, site.locale)}</span></a>`;
  const bullets = (arr, cls = '') => `<ul class="bullets ${cls}">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const faqList = (items) => `<div class="faq-list">${items.map((q) => K.faqItem(q)).join('')}</div>`;

  /* ---------- the climb: elevation chart ---------- */
  function climbSvg(t, { id = 'cl', dot = true } = {}) {
    const ch = climbChart(t.route, { W: 1000, H: 420, padX: 56, padTop: 100, padBottom: 50 });
    const stops = ch.pts.map((p, i) => {
      const last = i === ch.pts.length - 1, first = i === 0;
      const below = i > 0 && p.x - ch.pts[i - 1].x < 160 && i % 2 === 0 ? false : (i > 0 && p.x - ch.pts[i - 1].x < 160);
      const anchor = first ? 'start' : last ? 'end' : 'middle';
      const ty = below ? p.y + 54 : p.y - 40;
      return `<g class="climb__stop" data-x="${p.x.toFixed(1)}" data-name="${esc(p.name)}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="12"/><text x="${(first ? p.x - 4 : last ? p.x + 4 : p.x).toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}">${esc(p.name)}</text></g>`;
    }).join('');
    const first = ch.pts[0];
    return { ch, svg: `<svg class="climb__svg" viewBox="0 0 ${ch.W} ${ch.H}" role="img" aria-label="Elevation profile: ${t.route.map((s) => `${s.name} ${s.elevation} metres`).join(', ')}">
<defs><linearGradient id="${id}-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2a93b" stop-opacity=".34"/><stop offset="1" stop-color="#f2a93b" stop-opacity="0"/></linearGradient></defs>
<path d="${ch.area}" fill="url(#${id}-fill)"/><path class="climb__base" d="${ch.d}"/><path class="climb__line" d="${ch.d}" pathLength="1"/>${stops}${dot ? `<circle class="climb__dot" r="14" cx="${first.x.toFixed(1)}" cy="${first.y.toFixed(1)}"/>` : ''}</svg>` };
  }

  /* ================================================================ */
  /*  HOME                                                             */
  /* ================================================================ */
  {
    const t = featured;
    const heroPhoto = site.home?.heroImage || '';
    // the climb only counts stops that keep rising (Ayubia sits just below Nathiagali)
    const asc = t.route.filter((x, i, a) => a.slice(0, i).every((y) => y.elevation < x.elevation));
    const stopsJson = esc(JSON.stringify(t.route.map((s) => [s.name, s.elevation])));
    const marq = destinations.map((d) => {
      const m = d.elevation.match(/([\d,]{3,6})\s*m/);
      return `<span>${esc(d.name.toUpperCase())}${m ? ` <b>${esc(m[1])} M</b>` : ''}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1l2.6 7.4L22 11l-7.4 2.6L12 21l-2.6-7.4L2 11l7.4-2.6z"/></svg>`;
    }).join('');
    const { ch, svg } = climbSvg(t, { id: 'home-cl' });
    const orgLd = !isPlaceholder(BRAND) && SITE_URL ? jsonLd({
      '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, url: SITE_URL + '/', description: site.brand.description,
      ...(site.contact.email ? { email: site.contact.email } : {}),
      ...(Object.values(site.socials).some(Boolean) ? { sameAs: Object.values(site.socials).filter(Boolean) } : {}),
    }) : '';
    const principles = [
      ["Nothing is confirmed until it's in writing", "Proposed trips are labelled proposed. You'll get the date, price, coach company and place we stay in writing before you pay a rupee."],
      ['The price you see is the price you pay', "Each trip lists what is and isn't included. If something isn't on the written confirmation, it isn't included, and we'll say so up front."],
      ['Coordinators travel with every group', 'Headcounts at every stop, emergency contacts on paper, separate rooms for male and female participants, and a plan for bad weather.'],
      ["We'd rather postpone than push on", 'If snow, rain or road conditions make the trip unsafe, we move the date. We check advisories before every departure.'],
    ];
    const steps = [
      ['Register interest', "Fill in a short form or message us on WhatsApp. It's free and doesn't commit you to anything."],
      ['We confirm the details', 'Once enough people are interested, we book the coach and the stay, then message you the final date, price and itinerary.'],
      ['You decide and pay', 'If it suits you, pay by the method we share in writing. Your seat is confirmed when we confirm it to you in writing.'],
      ['Travel together', 'A packing list and briefing before departure, then two days in the hills with your group.'],
    ];
    const destOrder = ['nathiagali', 'ayubia', 'swat', 'naran-kaghan', 'hunza', 'murree'].map((id) => destinations.find((d) => d.id === id)).filter(Boolean);
    const [feat, ...rest] = articles;

    const main = `<main id="main">
<section class="hero${heroPhoto ? ' hero--photo' : ''}" data-hero data-stops="${stopsJson}" aria-labelledby="hero-h">
  ${heroPhoto ? `<div class="hero__photo">${K.picture(heroPhoto, { root: './', sizes: '100vw', eager: true, alt: '' })}</div>` : ''}
  <div class="hx" data-fx aria-hidden="true">
    <i class="hx__b hx__b1"></i><i class="hx__b hx__b2"></i><i class="hx__b hx__b3"></i><i class="hx__b hx__b4"></i>
    <i class="hx__g"></i><i class="hx__ring hx__ring1"></i><i class="hx__ring hx__ring2"></i><i class="hx__ring hx__ring3"></i>
    <span class="hx__dots">${Array.from({ length: 14 }, (_, i) => `<i style="--n:${i}"></i>`).join('')}</span>
    <span class="hx__word" data-fx-word>${esc(asc[asc.length - 1].name.toUpperCase())}</span>
  </div>
  <div class="hero__shade" aria-hidden="true"></div>
  <div class="wrap hero__copy">
    <a class="pill" href="./trips/${t.slug}.html"><span class="pill__dot" aria-hidden="true"></span>First trip · ${esc(AVAILABILITY[t.availability].label.toLowerCase())}</a>
    <h1 class="hero__h1" id="hero-h" aria-label="Lahore to the hills in one weekend">${['Lahore', 'to the hills', 'in one weekend'].map((ln, li) => `<span class="ln" aria-hidden="true">${ln.split(' ').map((w, wi, arr) => `<span class="wd">${[...w].map((c, ci) => `<span class="ch" style="--c:${li * 6 + wi * 3 + ci}">${c}</span>`).join('')}</span>${wi < arr.length - 1 ? ' ' : ''}`).join('')}</span>`).join('')}</h1>
    <p class="hero__lede"><span class="short">Small, carefully planned group trips for university students in Lahore.</span><span class="full">Small, carefully planned group trips to the northern hills for university students in Lahore. Our first trip, to Nathiagali and Ayubia, is being planned now.</span></p>
    <div class="hero__cta"><a class="btn btn--accent" href="./trips.html">Explore trips ${arrow}</a><a class="btn btn--ghost" href="./booking.html">Register interest</a></div>
  </div>
  <div class="hero__rail" aria-hidden="true" data-rail>
    <div class="rail__top"><span class="hero__alt-n" data-alt>${t.route[0].elevation}</span><span class="hero__alt-u">m</span><span class="hero__alt-l" data-alt-label>${esc(t.route[0].name)}</span></div>
    <div class="rail__track"><i class="rail__fill"></i>${(() => { const lo = asc[0].elevation, hi = asc[asc.length - 1].elevation; return asc.map((x) => `<span class="rail__stop" style="--x:${(((x.elevation - lo) / (hi - lo || 1)) * 100).toFixed(1)}%" data-e="${x.elevation}"><i></i><b>${esc(x.name)}</b></span>`).join(''); })()}</div>
  </div>
  <a class="hero__cue" href="#first-trip" aria-label="Scroll to the first trip"></a>
</section>

<div class="marq-wrap" aria-hidden="true"><div class="marq"><div class="marq__t"><div class="marq__i">${marq}</div><div class="marq__i">${marq}</div></div></div></div>

<section class="sec" id="first-trip" aria-labelledby="first-trip-h">
  <div class="wrap">
    <header class="sh sh--split">
      <div class="sh"><p class="eyebrow" data-r>The first trip</p><h2 class="h2" id="first-trip-h" data-split>${split('Two days in the pines')}</h2></div>
      <p class="sh__p" data-r>We are collecting interest before we book anything, so the plan can still change. <a href="./trips.html">See all trips</a></p>
    </header>
    ${t.dates.status !== 'confirmed' ? K.notice('proposed', '<strong>Proposed trip.</strong> Dates, the coach company and the place we stay are not confirmed yet. Registering interest helps us decide whether the trip goes ahead.') : ''}
    ${bookable.map((x) => ticket(x, './')).join('\n')}
  </div>
</section>

<section class="climb" data-climb data-ytop="${ch.yTop}" data-ybot="${ch.yBottom}" data-min="${ch.minE}" data-max="${ch.maxE}" aria-labelledby="climb-h">
  <div class="climb__pin"><div class="wrap climb__grid">
    <div class="climb__head"><p class="eyebrow">The route</p><h2 class="h2" id="climb-h">Two kilometres up, in a day</h2><p>North on the motorway to Islamabad, then up through Murree into the Galiyat, where the air is cooler and the hills are covered in deodar and blue pine.</p></div>
    <div class="climb__readout" aria-hidden="true"><span class="climb__n">${ch.pts[0].elevation}</span><span class="climb__u">m</span><span class="climb__where">Now passing <b>${esc(ch.pts[0].name)}</b></span></div>
    <figure class="climb__chart">${svg}</figure>
    <p class="climb__note">${esc(t.routeNote || '')} <a class="link-arrow climb__link" href="./trips/${t.slug}.html#itinerary">See the day-by-day plan ${arrow}</a></p>
  </div></div>
</section>

<section class="sec sec--alt" aria-labelledby="pr-h">
  <div class="wrap">
    <header class="sh sh--split">
      <div class="sh"><p class="eyebrow" data-r>How we run trips</p><h2 class="h2" id="pr-h" data-split>${split('Hold us to it')}</h2></div>
      <p class="sh__p" data-r>We are new, so we won't ask you to take our word for anything. Here is what you can hold us to. <a href="./our-approach.html">Read how we plan</a></p>
    </header>
    <div class="rail rail--grid rail--4">${principles.map(([h, p], i) => `<article class="pr" data-r style="--d:${i}"><span class="pr__n" aria-hidden="true">0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('')}</div>
    <p class="rail__hint" aria-hidden="true"><svg viewBox="0 0 28 12" fill="none"><path d="M1 6h24M20 1l6 5-6 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Swipe</p>
  </div>
</section>

<section class="sec" aria-labelledby="steps-h">
  <div class="wrap">
    <header class="sh"><p class="eyebrow" data-r>How booking works</p><h2 class="h2" id="steps-h" data-split>${split('Four steps, no surprises')}</h2></header>
    <ol class="steps" data-prog>${steps.map(([h, p]) => `<li class="step"><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol>
  </div>
</section>

<section class="sec sec--alt" aria-labelledby="dest-h">
  <div class="wrap">
    <header class="sh sh--split">
      <div class="sh"><p class="eyebrow" data-r>Where we're looking</p><h2 class="h2" id="dest-h" data-split>${split('The hills, and further north')}</h2></div>
      <p class="sh__p" data-r>We start close to home in the Galiyat. The guides for places further north are here to help you plan, even before we run trips there. <a href="./destinations.html">All destinations</a></p>
    </header>
    <div class="rail rail--grid rail--3" data-r>${destOrder.map((d) => dcard(d, './')).join('')}</div>
    <p class="rail__hint" aria-hidden="true"><svg viewBox="0 0 28 12" fill="none"><path d="M1 6h24M20 1l6 5-6 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Swipe</p>
  </div>
</section>

${hasQuotes ? `<section class="sec" aria-labelledby="q-h"><div class="wrap"><header class="sh"><p class="eyebrow">Stories</p><h2 class="h2" id="q-h">From people who travelled with us</h2></header><div class="quotes">${testimonials.items.slice(0, 3).map((q) => `<figure class="quote"><blockquote><p>${esc(q.quote)}</p></blockquote><figcaption>${esc(q.name)}${q.university ? `, ${esc(q.university)}` : ''}</figcaption></figure>`).join('')}</div></div></section>` : ''}

<section class="sec" aria-labelledby="j-h">
  <div class="wrap">
    <header class="sh sh--split">
      <div class="sh"><p class="eyebrow" data-r>The travel journal</p><h2 class="h2" id="j-h" data-split>${split('Read before you go')}</h2></div>
      <p class="sh__p" data-r>Budgets, packing lists, seasons and how to check a tour operator before you pay. <a href="./articles.html">Read the journal</a></p>
    </header>
    ${feat ? `<a class="jfeat" href="./articles/${feat.slug}.html" data-r>${feat.image ? art(feat.image, './', { sizes: '(min-width: 860px) 55vw, 100vw', alt: '' }) : ''}<span class="jfeat__b"><span class="eyebrow">${esc(feat.category)}</span><h3>${esc(feat.title)}</h3><p>${esc(feat.description)}</p><span class="link-arrow" style="width:max-content">Read the guide ${arrow}</span></span></a>` : ''}
    <div class="jl" data-r>${rest.slice(0, 3).map((a) => journalRow(a, './')).join('')}</div>
  </div>
</section>

<section class="sec sec--alt" aria-labelledby="hf-h">
  <div class="wrap home-faq">
    <header class="sh"><p class="eyebrow" data-r>Before you register</p><h2 class="h2" id="hf-h" data-split>${split('Quick answers')}</h2><p class="sh__p" data-r>The questions students ask us most. <a href="./faq.html">All questions</a></p></header>
    ${faqList(homeFaqs)}
  </div>
</section>

${ctaBand(K, './')}
</main>`;
    out('index.html', L.page({ file: 'index.html', nav: '', title: site.seo.defaultTitle, description: site.seo.defaultDescription, main, seoExtra: orgLd, image: 'og-default' }), { lastmod });
  }

  /* ================================================================ */
  /*  TRIPS                                                            */
  /* ================================================================ */
  out('trips.html', L.page({
    file: 'trips.html', nav: 'trips', title: 'Student group trips from Lahore',
    description: 'Upcoming and proposed group trips for university students from Lahore to Northern Pakistan, with clear status, pricing and what is included.',
    main: `<main id="main">
${pageHero({ title: 'Trips', lede: 'Every trip shows its real status. Proposed means we are still confirming details; nothing is reserved until we confirm it to you in writing.', crumbs: crumb([{ label: 'Trips', href: 'trips.html' }], './').html })}
<section class="sec sec--tight"><div class="wrap">
  <div class="grid">${trips.map((t) => ticket(t, './', 2)).join('\n')}</div>
  <section class="sec" aria-labelledby="sk-h" style="padding-bottom:0">
    <h2 class="h2" id="sk-h" style="font-size:clamp(2rem,8vw,3.2rem);margin-bottom:1.2rem">What each status means</h2>
    <dl class="logi">
      ${[['interest', 'We are measuring demand. Dates and price are not final.'], ['tentative', 'A date is pencilled in but suppliers are not confirmed.'], ['open', 'Dates, price and suppliers are confirmed. Seats are confirmed in writing after payment.'], ['full', 'No seats left. You can still join a waiting list.'], ['completed', 'The trip has taken place.'], ['cancelled', 'The trip will not run. Anyone affected is contacted directly.']].filter(([k]) => AVAILABILITY[k]).map(([k, v]) => `<div><dt>${K.statusBadge(k)}</dt><dd style="margin-top:.6rem;color:var(--muted)">${esc(v)}</dd></div>`).join('')}
    </dl>
  </section>
</div></section>
${ctaBand(K, './')}
</main>`,
  }), { lastmod: trips.map((t) => t.updated).sort().pop() });

  trips.forEach((t) => {
    const file = `trips/${t.slug}.html`, root = '../';
    const pr = K.priceText(t), dt = K.dateText(t), names = K.destNames(t), st = AVAILABILITY[t.availability];
    const cr = crumb([{ label: 'Trips', href: 'trips.html' }, { label: t.title, href: file }], root);
    const related = t.relatedArticles.map((id) => articles.find((a) => a.slug === id)).filter(Boolean).slice(0, 3);
    const tag = (s) => (s === 'confirmed' ? '<span class="tag tag--ok">Confirmed</span>' : '<span class="tag tag--pending">Not yet confirmed</span>');
    const { ch, svg } = climbSvg(t, { id: 'trip-cl', dot: false });
    const eventLd = t.dates.status === 'confirmed' && t.price.status === 'confirmed' && !isPlaceholder(BRAND) && SITE_URL ? jsonLd({
      '@context': 'https://schema.org', '@type': 'Event', name: t.title, description: t.summary,
      startDate: t.dates.start, endDate: t.dates.end, eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: t.availability === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      location: { '@type': 'Place', name: names.join(', '), address: { '@type': 'PostalAddress', addressRegion: destinations.find((d) => d.id === t.destinationIds[0]).province, addressCountry: 'PK' } },
      organizer: { '@type': 'Organization', name: BRAND, url: SITE_URL + '/' },
      image: `${SITE_URL}/${K.imageFile(t.heroImage)}`,
      offers: { '@type': 'Offer', price: t.price.amount, priceCurrency: 'PKR', availability: t.availability === 'full' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock', url: `${SITE_URL}/${file}` },
    }) : '';
    const toc = [['overview', 'Overview'], ['route', 'The route'], ['itinerary', 'Day by day'], ['included', "What's included"], ['logistics', 'Transport and stay'], ['packing', 'What to bring'], ['safety', 'Safety'], ['terms', 'Booking terms'], ['questions', 'Questions'], ...(st.bookable ? [['register', 'Register']] : [])];
    const main = `<main id="main">
<header class="ph ph--img">
  ${art(t.heroImage, root, { eager: true, sizes: '100vw', alt: '' })}
  <div class="wrap ph__in">
    ${cr.html}
    <p class="ticket__route" style="color:#d3dcd5">${icon.pin}<span>Lahore to ${esc(K.andList(names))}</span></p>
    <h1>${esc(t.title)}</h1>
    <p class="ph__lede">${esc(t.summary)}</p>
    <dl class="facts">
      <div><dt>Status</dt><dd>${K.statusBadge(t.availability)}</dd></div>
      <div><dt>Price</dt><dd>${esc(pr.main)}<small>${esc(pr.note)}</small></dd></div>
      <div><dt>Date</dt><dd>${esc(dt.main)}<small>${esc(t.dates.note || dt.note)}</small></dd></div>
      <div><dt>Length</dt><dd>${K.durationText(t.duration)}</dd></div>
      ${t.group ? `<div><dt>Group</dt><dd>${t.group.min}–${t.group.max} people<small>planned</small></dd></div>` : ''}
    </dl>
    <div class="ph__cta">${st.bookable ? `<a class="btn btn--accent" href="#register">${t.availability === 'open' ? 'Book a seat' : 'Register interest'} ${arrow}</a>` : ''}${K.waButton({ context: 'trip', trip: t, label: 'Ask on WhatsApp', cls: 'btn btn--ghost' })}</div>
  </div>
  ${ridgeStrip()}
</header>
<div class="wrap">
${t.dates.status !== 'confirmed' ? K.notice('proposed', `<strong>This trip is a proposal.</strong> Everything on this page is our current plan. Dates, the final price, the coach company and the place we stay will be confirmed in writing before we ask anyone to pay. Last updated ${fmtDate(t.updated, site.locale)}.`) : ''}
<div class="td">
  <nav class="td__nav toc" aria-label="On this page"><p class="toc__t">On this page</p><ol>${toc.map(([id, l]) => `<li><a href="#${id}">${l}</a></li>`).join('')}</ol></nav>
  <div class="td__main">
    <section class="ts" id="overview" aria-labelledby="overview-h"><h2 class="ts__t" id="overview-h">Overview</h2><div class="prose">${t.description.map((p) => `<p>${esc(p)}</p>`).join('')}</div></section>
    ${t.route?.length ? `<section class="ts" id="route" aria-labelledby="route-h"><h2 class="ts__t" id="route-h">The route</h2><figure class="climb__chart">${svg}</figure><p class="ts__note" style="margin-top:.8rem">From about ${ch.minE} m in Lahore to about ${ch.maxE.toLocaleString('en-US')} m in the hills. ${esc(t.routeNote || '')}</p></section>` : ''}
    <section class="ts" id="itinerary" aria-labelledby="itinerary-h"><h2 class="ts__t" id="itinerary-h">Day by day</h2>${t.itineraryNote ? `<p class="ts__note">${esc(t.itineraryNote)}</p>` : ''}
      <div class="it" data-prog>${t.itinerary.map((d) => `<div><h3 class="it__d"><span>Day ${d.day}</span>${esc(d.title)}</h3>${d.stops.map((s) => `<div class="it__s"><p class="it__tm">${esc(s.time)}</p><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></div>`).join('')}</div>`).join('')}</div>
    </section>
    <section class="ts" id="included" aria-labelledby="included-h"><h2 class="ts__t" id="included-h">What's included</h2>
      <div class="incl"><div><h3>${icon.check}${t.inclusions.status === 'confirmed' ? 'Included' : 'Planned to be included'}</h3>${bullets(t.inclusions.items)}</div><div class="incl__no"><h3>${icon.minus}Not included</h3>${bullets(t.exclusions, 'bullets--no')}</div></div>
    </section>
    <section class="ts" id="logistics" aria-labelledby="logistics-h"><h2 class="ts__t" id="logistics-h">Transport, stay and meals</h2>
      <div class="logi">${[['Transport', t.transport], ['Accommodation', t.accommodation], ['Meals', t.meals]].filter(([, v]) => v).map(([k, v]) => `<div><h3>${k} ${tag(v.status)}</h3><p>${esc(v.summary)}</p>${v.details ? bullets(v.details) : ''}</div>`).join('')}</div>
    </section>
    <section class="ts" id="packing" aria-labelledby="packing-h"><h2 class="ts__t" id="packing-h">What to bring</h2><ul class="check-list">${t.packing.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="ts__more">More detail in our <a href="${root}articles/northern-pakistan-packing-checklist.html">Northern Pakistan packing checklist</a>.</p></section>
    <section class="ts" id="safety" aria-labelledby="safety-h"><h2 class="ts__t" id="safety-h">Safety</h2>${bullets(t.safety)}<p class="ts__more">Read what we do and what we ask of participants on the <a href="${root}safety.html">safety page</a>.</p></section>
    <section class="ts" id="terms" aria-labelledby="terms-h"><h2 class="ts__t" id="terms-h">Booking terms</h2>${bullets(t.bookingTerms)}<p class="ts__more">Cancellations and refunds: see our <a href="${root}cancellation-policy.html">cancellation policy</a> (draft, still under review).</p></section>
    <section class="ts" id="questions" aria-labelledby="questions-h"><h2 class="ts__t" id="questions-h">Questions about this trip</h2>${faqList(t.faqs.map((q, i) => ({ id: `${t.id}-${i}`, ...q })))}<p class="ts__more">General questions are answered on the <a href="${root}faq.html">questions page</a>.</p></section>
    ${st.bookable ? `<section class="ts" aria-label="Register">${K.bookingForm({ root, preselect: t.id, idPrefix: 'trip' })}</section>` : ''}
  </div>
  <aside class="td__aside" aria-label="Trip summary"><div class="tcard">
    ${K.statusBadge(t.availability)}
    <p class="tcard__p">${esc(pr.main)}<small>${esc(pr.note)}</small></p>
    <dl><div><dt>Date</dt><dd>${esc(dt.main)}</dd></div><div><dt>Length</dt><dd>${K.durationText(t.duration)}</dd></div></dl>
    ${st.bookable ? `<a class="btn btn--accent btn--block" href="#register">${t.availability === 'open' ? 'Book a seat' : 'Register interest'}</a>` : ''}
    ${K.waButton({ context: 'trip', trip: t, label: 'Ask a question', cls: 'btn btn--ghost btn--block' })}
    <p class="tcard__n">Free to register. No payment now.</p>
  </div></aside>
</div>
</div>
${related.length ? `<section class="sec sec--alt" aria-labelledby="rel-h"><div class="wrap"><header class="sh"><h2 class="h2" id="rel-h">Read before you go</h2></header><div class="grid grid--3">${related.map((a) => postCard(a, root)).join('')}</div></div></section>` : ''}
</main>`;
    out(file, L.page({ file, nav: 'trips', title: t.seo.title, description: t.seo.description, main, image: t.heroImage, seoExtra: cr.ld + eventLd, dockHref: st.bookable ? '#register' : undefined }), { lastmod: t.updated });
  });

  /* ================================================================ */
  /*  DESTINATIONS                                                     */
  /* ================================================================ */
  out('destinations.html', L.page({
    file: 'destinations.html', nav: 'destinations', title: 'Northern Pakistan destinations for student trips',
    description: 'Honest guides to Nathiagali, Ayubia, Murree, Swat, Naran and Hunza: seasons, safety and which ones we plan trips to.',
    main: `<main id="main">
${pageHero({ title: 'Destinations', lede: 'Guides to the places students ask us about. We only run trips where it says so; the rest are here to help you plan.', crumbs: crumb([{ label: 'Destinations', href: 'destinations.html' }], './').html })}
<section class="sec sec--tight"><div class="wrap"><div class="rail rail--grid rail--3">${destinations.map((d) => dcard(d, './', 2)).join('')}</div><p class="rail__hint" aria-hidden="true">Swipe for more →</p></div></section>
${ctaBand(K, './')}
</main>`,
  }), { lastmod: destinations.map((d) => d.lastReviewed).sort().pop() });

  destinations.forEach((d) => {
    const file = `destinations/${d.slug}.html`, root = '../';
    const cr = crumb([{ label: 'Destinations', href: 'destinations.html' }, { label: d.name, href: file }], root);
    const relTrips = trips.filter((t) => t.destinationIds.includes(d.id));
    const relArts = d.relatedArticles.map((id) => articles.find((a) => a.slug === id)).filter(Boolean).slice(0, 3);
    const toc = [['about', 'About'], ...(d.attractions?.length ? [['see', 'What to see']] : []), ...(d.seasons ? [['season', 'Seasons']] : []), ['advice', 'Travel advice'], ['dsafety', 'Safety']];
    const main = `<main id="main">
<header class="ph ph--img">
  ${art(d.heroImage, root, { eager: true, sizes: '100vw', alt: '' })}
  <div class="wrap ph__in">
    ${cr.html}
    <p class="ticket__route" style="color:#d3dcd5">${icon.pin}<span>${esc(d.region)}, ${esc(d.province)}</span></p>
    <h1>${esc(d.name)}</h1>
    <p class="ph__lede">${esc(d.summary)}</p>
    <dl class="facts"><div><dt>Elevation</dt><dd>${esc(d.elevation)}</dd></div><div><dt>Our trips</dt><dd>${esc(opLabel[d.operating])}</dd></div></dl>
  </div>
  ${ridgeStrip()}
</header>
<div class="wrap"><div class="td td--dest">
  <nav class="td__nav toc" aria-label="On this page"><p class="toc__t">On this page</p><ol>${toc.map(([id, l]) => `<li><a href="#${id}">${l}</a></li>`).join('')}</ol></nav>
  <div class="td__main">
    <section class="ts" id="about"><h2 class="ts__t">About ${esc(d.name)}</h2><div class="prose">${d.description.map((p) => `<p>${esc(p)}</p>`).join('')}</div></section>
    ${d.attractions?.length ? `<section class="ts" id="see"><h2 class="ts__t">What to see</h2><dl class="att">${d.attractions.map((a) => `<div><dt>${esc(a.name)}</dt><dd>${esc(a.text)}</dd></div>`).join('')}</dl></section>` : ''}
    ${d.seasons ? `<section class="ts" id="season"><h2 class="ts__t">Seasons</h2><div class="prose"><p>${esc(d.seasons.summary)}</p>${bullets(d.seasons.notes)}</div>
      <div class="callout"><p class="callout__label">Check before you travel</p><p>Seasonal conditions change from year to year. Reviewed ${fmtDate(d.seasons.reviewed, site.locale)}.${d.seasons.source?.url ? ` Source: <a href="${esc(d.seasons.source.url)}" target="_blank" rel="noopener noreferrer">${esc(d.seasons.source.label)}<span class="vh"> (opens in a new tab)</span></a>.` : ` ${esc(d.seasons.source?.label || '')}.`}</p></div></section>` : ''}
    <section class="ts" id="advice"><h2 class="ts__t">Travel advice</h2><ul class="check-list">${d.travelAdvice.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
    <section class="ts" id="dsafety"><h2 class="ts__t">Safety</h2>${bullets(d.safety)}</section>
    <p class="reviewed">Last reviewed ${fmtDate(d.lastReviewed, site.locale)}.</p>
  </div>
</div></div>
${relTrips.length ? `<section class="sec sec--alt" aria-labelledby="dt-h"><div class="wrap"><header class="sh"><h2 class="h2" id="dt-h">Trips that visit ${esc(d.name)}</h2></header>${relTrips.map((t) => ticket(t, root)).join('')}</div></section>` : ''}
${relArts.length ? `<section class="sec" aria-labelledby="da-h"><div class="wrap"><header class="sh"><h2 class="h2" id="da-h">From the journal</h2></header><div class="grid grid--3">${relArts.map((a) => postCard(a, root)).join('')}</div></div></section>` : ''}
${ctaBand(K, root)}
</main>`;
    out(file, L.page({ file, nav: 'destinations', title: d.seo.title, description: d.seo.description, main, image: d.heroImage, seoExtra: cr.ld }), { lastmod: d.lastReviewed });
  });

  /* ================================================================ */
  /*  JOURNAL                                                          */
  /* ================================================================ */
  out('articles.html', L.page({
    file: 'articles.html', nav: 'articles', title: 'Travel journal: guides for student travellers',
    description: 'Practical, honest guides for students planning trips to Northern Pakistan: budgets, packing, seasons, safety and choosing a tour operator.',
    main: `<main id="main">
${pageHero({ title: 'Travel journal', lede: 'Practical guides for students planning their first trips north. Where facts change with the season or the year, we say so.', crumbs: crumb([{ label: 'Journal', href: 'articles.html' }], './').html })}
<section class="sec sec--tight"><div class="wrap">
${ARTICLE_CATEGORIES.filter((c) => articles.some((a) => a.category === c)).map((c) => `<section class="ts" aria-labelledby="c-${slugify(c)}"><h2 class="ts__t" id="c-${slugify(c)}">${esc(c)}</h2><div class="grid grid--3">${articles.filter((a) => a.category === c).map((a, i) => postCard(a, './', { img: i < 3 })).join('')}</div></section>`).join('\n')}
</div></section>
${ctaBand(K, './')}
</main>`,
  }), { lastmod: articles.map((a) => a.updated || a.date).sort().pop() });

  articles.forEach((a) => {
    const file = `articles/${a.slug}.html`, root = '../';
    const { html, toc } = markdown(a.body, { root });
    const cr = crumb([{ label: 'Journal', href: 'articles.html' }, { label: a.title, href: file }], root);
    const keep = articles.filter((x) => x.slug !== a.slug)
      .map((x) => ({ x, score: (x.category === a.category ? 2 : 0) + x.tags.filter((t) => a.tags.includes(t)).length }))
      .sort((p, q) => q.score - p.score || q.x.date.localeCompare(p.x.date)).slice(0, 3).map((r) => r.x);
    const relTrips = a.relatedTrips.map((id) => trips.find((t) => t.id === id)).filter(Boolean);
    const relDest = a.relatedDestinations.map((id) => destinations.find((d) => d.id === id)).filter(Boolean);
    const url = SITE_URL ? `${SITE_URL}/${file}` : '';
    const ld = jsonLd({
      '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.description,
      datePublished: a.date, dateModified: a.updated || a.date, inLanguage: site.locale,
      author: { '@type': 'Organization', name: brandBy(a) },
      ...(a.image && SITE_URL ? { image: `${SITE_URL}/${K.imageFile(a.image)}` } : {}),
      ...(url ? { mainEntityOfPage: url } : {}),
      ...(!isPlaceholder(BRAND) ? { publisher: { '@type': 'Organization', name: BRAND } } : {}),
    });
    const share = url
      ? `<div class="share"><span class="share__l">Share</span><a class="share__a" href="https://wa.me/?text=${encodeURIComponent(a.title + ' ' + url)}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a class="share__a" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener noreferrer">Facebook</a><button class="share__a" type="button" data-copy-link="${esc(url)}">Copy link</button></div>`
      : `<div class="share"><span class="share__l">Share</span><button class="share__a" type="button" data-copy-link>Copy link</button></div>`;
    const main = `<div class="read-progress" data-read-progress aria-hidden="true"></div>
<main id="main"><article>
<header class="ph">
  <div class="wrap ph__in">
    ${cr.html}
    <p class="art-cat">${esc(a.category)}</p>
    <h1 style="max-width:18ch;font-size:clamp(2.6rem,11vw,6.2rem)">${esc(a.title)}</h1>
    <p class="ph__lede">${esc(a.description)}</p>
    <p class="art-meta"><span>By ${esc(brandBy(a))}</span><span>Published <time datetime="${a.date}">${fmtDate(a.date, site.locale)}</time></span>${a.updated && a.updated !== a.date ? `<span>Updated <time datetime="${a.updated}">${fmtDate(a.updated, site.locale)}</time></span>` : ''}<span>${a.minutes} min read</span></p>
  </div>
  ${ridgeStrip()}
</header>
<div class="wrap layout-toc">
  ${toc.length > 2 ? `<nav class="toc" aria-label="Contents"><p class="toc__t">Contents</p><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : '<div></div>'}
  <div>
    ${a.reviewed ? `<div class="callout"><p class="callout__label">Check before you travel</p><p>Seasonal and practical details in this article were last reviewed on ${fmtDate(a.reviewed, site.locale)}. Prices, road conditions and rules change; confirm anything important with an official source close to your travel date.</p></div>` : ''}
    <div class="prose">${html}</div>
    ${a.tags.length ? `<ul class="tags" aria-label="Tags">${a.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${share}
    ${relTrips.length || relDest.length ? `<aside class="art-links" aria-label="Related trips and destinations">${relTrips.map((t) => `<a href="${root}trips/${t.slug}.html"><span>Trip</span>${esc(t.title)}</a>`).join('')}${relDest.map((d) => `<a href="${root}destinations/${d.slug}.html"><span>Destination</span>${esc(d.name)}</a>`).join('')}</aside>` : ''}
  </div>
</div></article>
<section class="sec sec--alt" aria-labelledby="keep-h"><div class="wrap"><header class="sh"><h2 class="h2" id="keep-h">Keep reading</h2></header><div class="grid grid--3">${keep.map((x) => postCard(x, root, { img: false })).join('')}</div></div></section>
${ctaBand(K, root)}
</main>`;
    out(file, L.page({ file, nav: 'articles', paper: true, type: 'article', image: a.image, title: a.title, description: a.description, main, seoExtra: cr.ld + ld + `\n<meta property="article:published_time" content="${a.date}">${a.updated ? `\n<meta property="article:modified_time" content="${a.updated}">` : ''}` }), { lastmod: a.updated || a.date });
  });

  /* ================================================================ */
  /*  FAQ, ABOUT, APPROACH                                             */
  /* ================================================================ */
  out('faq.html', L.page({
    file: 'faq.html', nav: 'faq', title: 'Questions about our student trips',
    description: 'How registration and booking work, what prices include, payments, cancellations, safety and what to bring on our student trips.',
    main: `<main id="main">
${pageHero({ title: 'Questions', lede: 'Straight answers. Where a policy is not final yet, we say so.', crumbs: crumb([{ label: 'Questions', href: 'faq.html' }], './').html })}
<section class="sec sec--tight"><div class="wrap--narrow wrap">
  <nav class="faq-nav" aria-label="Question topics"><ol>${faqs.groups.map((g) => `<li><a href="#${g.id}">${esc(g.title)}</a></li>`).join('')}</ol></nav>
  ${faqs.groups.map((g) => `<section class="fg" id="${g.id}" aria-labelledby="${g.id}-h"><h2 id="${g.id}-h">${esc(g.title)}</h2>${faqList(g.items)}</section>`).join('\n')}
  <div class="way"><h2>Still have a question?</h2><p>Send us a message and include the trip you're asking about.</p><div class="status-actions"><a class="btn btn--accent" href="./contact.html">Contact us</a>${K.waButton({ context: 'contact' })}</div></div>
</div></section>
</main>`,
  }), { lastmod });

  {
    const peopleHtml = team.members.map((m) => `<figure class="person"><span class="person__i" aria-hidden="true">${m.placeholder ? '?' : esc(m.name[0])}</span><p class="person__n">${esc(m.name)}</p><p class="person__r">${esc(m.role)}</p><p>${esc(m.bio)}</p>${m.placeholder ? '<p class="person__ph">Placeholder: details coming soon</p>' : ''}</figure>`).join('');
    out('about-us.html', L.page({
      file: 'about-us.html', nav: 'about', title: 'About us: why we organise student trips',
      description: 'Why we started organising carefully planned group trips to Northern Pakistan for university students in Lahore, and who is behind it.',
      main: `<main id="main">
${pageHero({ title: "Trips we'd want to go on ourselves", lede: "We're a small team in Lahore starting a travel project for university students. We haven't run our first trip yet, and this page says so plainly.", crumbs: crumb([{ label: 'About', href: 'about-us.html' }], './').html })}
<section class="sec sec--tight"><div class="wrap two">
  <div class="prose">
    <h2>Why this exists</h2>
    <p>Most students in Lahore want to see the north, and most first trips go one of two ways: a crowded, last-minute plan between friends, or a package found on social media with a price, a photo and very little else.</p>
    <p>The second kind can be fine. It can also mean a different bus from the one advertised, a room for eight when you were promised four, or a refund that never arrives. When you are 19 and paying with money you saved, those things matter.</p>
    <p>We want to run trips that are affordable for students and planned with the same care you'd want if your younger sibling were going. That means writing things down, saying what is and isn't confirmed, and being easy to reach.</p>
    <h2>Where we are now</h2>
    <p>We are pre-launch. Our first proposed trip is a weekend in Nathiagali and Ayubia. We're collecting registrations of interest to see whether there is enough demand, and we're checking transport and accommodation before we book anything.</p>
    <p>We are not claiming to be licensed or insured until we can show you the paperwork. When we have it, it will be on this site with the registration number so you can check it yourself. <a href="./our-approach.html">Read how we plan a trip</a>.</p>
  </div>
  <aside class="facts-panel" aria-label="At a glance"><dl>
    <div><dt>Based in</dt><dd>Lahore</dd></div><div><dt>For</dt><dd>University students, starting with UOL and other universities in Lahore</dd></div>
    <div><dt>First trip</dt><dd>Nathiagali and Ayubia, proposed</dd></div><div><dt>Trips completed</dt><dd>None yet</dd></div>
  </dl></aside>
</div></section>
<section class="sec sec--alt" aria-labelledby="team-h"><div class="wrap"><header class="sh"><h2 class="h2" id="team-h">Who's behind it</h2><p class="sh__p">The founders' names and photos will appear here once they've approved what's written about them.</p></header><div class="people">${peopleHtml}</div></div></section>
<section class="sec" aria-labelledby="values-h"><div class="wrap"><header class="sh"><h2 class="h2" id="values-h">What we value</h2></header>
  <dl class="vals">
    <div><dt>Honesty about what's confirmed</dt><dd>A proposal is labelled a proposal. A price range is labelled a range. We'd rather lose a booking than mislead someone into one.</dd></div>
    <div><dt>Care for the people who come</dt><dd>Coordinators who stay with the group, sensible rooming, and parents who can reach us if they need to.</dd></div>
    <div><dt>Respect for the places we visit</dt><dd>The Galiyat forests are protected areas and people's homes. We leave no litter, keep noise down and follow park rules.</dd></div>
    <div><dt>Being reachable</dt><dd>A real person answers messages, before, during and after a trip.</dd></div>
  </dl></div></section>
<section class="sec sec--alt" id="credits" aria-labelledby="credits-h"><div class="wrap"><header class="sh"><h2 class="h2" id="credits-h">Image credits</h2><p class="sh__p">Where every photograph or designed image on this site comes from, and under what licence. The animated tiles and hero are made with CSS and contain no photographs or illustrations. Fonts: Archivo, under the SIL Open Font License 1.1.</p></header>
  <div class="table-wrap" tabindex="0" role="region" aria-label="Image credits"><table class="credits"><thead><tr><th scope="col">Image</th><th scope="col">Type</th><th scope="col">Source and licence</th></tr></thead><tbody>
  ${Object.values(images).filter((im) => im.kind !== 'motion').map((im) => `<tr><th scope="row">${esc(im.alt)}</th><td>${im.kind === 'photo' ? 'Photograph' : 'Designed graphic'}</td><td>${esc(im.source)}. ${esc(im.licence)}.${im.attribution ? ` ${esc(im.attribution)}` : ''}</td></tr>`).join('\n')}
  </tbody></table></div></div></section>
${ctaBand(K, './')}
</main>`,
    }), { lastmod });
  }

  out('our-approach.html', L.page({
    file: 'our-approach.html', nav: 'about', paper: true, title: 'How we plan trips: suppliers, safety and communication',
    description: 'How we choose coaches and accommodation, what we put in writing, how we communicate with participants and how we handle safety and responsible tourism.',
    main: `<main id="main">
${pageHero({ title: 'How we plan a trip', lede: 'What happens between "we\'d like to run this trip" and the coach leaving Lahore, written down so you can check we do it.', crumbs: crumb([{ label: 'How we plan', href: 'our-approach.html' }], './').html })}
<div class="wrap layout-toc">
  <nav class="toc" aria-label="Contents"><p class="toc__t">Contents</p><ol><li><a href="#planning">Transparent planning</a></li><li><a href="#suppliers">Checking suppliers</a></li><li><a href="#communication">Keeping you informed</a></li><li><a href="#safety">Safety</a></li><li><a href="#responsible">Responsible travel</a></li></ol></nav>
  <div class="prose">
    <h2 id="planning">Transparent planning</h2>
    <p>Every trip on this site has a status. <strong>Registering interest</strong> means we're measuring demand. <strong>Tentative</strong> means a date is pencilled in. <strong>Booking open</strong> means dates, price and suppliers are confirmed. We never show countdown timers or "only 3 seats left" messages unless they're true.</p>
    <p>Before we ask for any payment, you'll receive a written confirmation with the date, the final price per person, what's included and excluded, the coach company, where we'll stay, and the cancellation terms.</p>
    <h2 id="suppliers">Checking suppliers</h2>
    <p>These are the checks we commit to making before we book a coach or accommodation. Each one is recorded so that we can show it if asked.</p>
    <ol>
      <li><strong>Transport company.</strong> We ask for the company's registration details and the vehicle's documents, check that the vehicle is suitable for hill roads, and get the driver's name and contact number in advance.</li>
      <li><strong>Accommodation.</strong> We confirm the property exists and is operating, get photos of the actual rooms, confirm room sharing and separate rooms for male and female participants, and get the booking in writing.</li>
      <li><strong>Prices in writing.</strong> We get written quotes so that the price we give you is based on real costs, not guesses.</li>
      <li><strong>A backup plan.</strong> We note an alternative coach and stay in case the first choice falls through.</li>
    </ol>
    <div class="callout"><p class="callout__label">Note</p><p>Tourism businesses in Pakistan are regulated by provincial authorities. We'll list our own registration here once we have it. You can read how to check any operator in our guide to <a href="./articles/choosing-a-safe-tour-operator.html">choosing a safe tour operator</a>.</p></div>
    <h2 id="communication">Keeping you informed</h2>
    <ul>
      <li>When a trip's status changes, everyone who registered hears from us directly.</li>
      <li>Before departure, you'll get the itinerary, packing list, pickup point and coordinator contacts.</li>
      <li>Parents or guardians can contact the coordinators. We'll share the number with participants to pass on.</li>
      <li>If plans change during the trip because of weather or roads, we explain why, on the spot.</li>
    </ul>
    <h2 id="safety">Safety</h2>
    <p>Coordinators travel with the group, keep a headcount at every stop and carry a written list of emergency contacts. We check weather and road advisories before departure and postpone if conditions are unsafe. The <a href="./safety.html">safety page</a> sets out what we do and what we ask of participants.</p>
    <h2 id="responsible">Responsible travel</h2>
    <p>Ayubia is a national park, and the Galiyat forests are under pressure from heavy visitor numbers. On our trips we carry litter out, stay on marked tracks, don't feed wildlife and keep noise down in the evenings. We prefer locally owned places to eat and stay when they meet our standards.</p>
  </div>
</div>
${ctaBand(K, './')}
</main>`,
  }), { lastmod });

  /* ================================================================ */
  /*  REGISTER, CONTACT, SUCCESS                                       */
  /* ================================================================ */
  out('booking.html', L.page({
    file: 'booking.html', nav: '', dock: false, title: 'Register interest in a trip',
    description: 'Register your interest in an upcoming student trip from Lahore. Free, no payment, and no commitment until we confirm the details in writing.',
    main: `<main id="main">
${pageHero({ title: 'Register interest', lede: "Tell us you'd like to come. It takes a minute, it's free, and it doesn't reserve a seat or commit you to paying.", crumbs: crumb([{ label: 'Register interest', href: 'booking.html' }], './').html })}
<div class="wrap two">
  <div>${K.bookingForm({ root: './', idPrefix: 'bk' })}</div>
  <aside class="aside" aria-labelledby="next-h">
    <h2 id="next-h">What happens next</h2>
    <ol class="next">
      <li><strong>You get a reference number</strong> straight away. Keep it: it helps us find your request.</li>
      <li><strong>We count the interest.</strong> The trip goes ahead only if enough people register.</li>
      <li><strong>We confirm the details</strong> and message you with the final date, price and itinerary.</li>
      <li><strong>You decide.</strong> Your seat is confirmed only after payment and our written confirmation.</li>
    </ol>
    <h2>Open for registration</h2>
    <ul class="mini">${bookable.map((t) => `<li><a href="./trips/${t.slug}.html">${esc(t.title)}</a> ${K.statusBadge(t.availability)}</li>`).join('')}</ul>
    <p class="form__privacy" style="margin-top:1.4rem">We ask only for what we need to contact you. Never send CNIC images, bank details or medical information through this form.</p>
  </aside>
</div>
</main>`,
  }), { lastmod });

  out('booking-success.html', L.page({
    file: 'booking-success.html', nav: '', dock: false, noindex: true, title: 'After you register', description: 'What happens after you register interest in a trip.',
    main: `<main id="main">
${pageHero({ title: '<span data-success-title>After you register</span>', lede: "A registration request is not a booking: no seat is reserved and you don't need to pay anything now." })}
<div class="wrap wrap--narrow" style="padding-block:2.4rem">
  <div class="ref-card" data-ref-card hidden><p>Your request was saved. Your reference:</p><strong data-ref-value></strong><p data-ref-trip></p><button class="btn btn--quiet btn--small" type="button" data-copy-ref>Copy reference</button></div>
  <div class="aside"><h2>What happens next</h2>
  <ol class="next"><li><strong>We count the interest.</strong> The trip goes ahead only if enough people register.</li><li><strong>We contact you</strong> using the method you chose, with the final date, price, itinerary and payment details.</li><li><strong>You decide.</strong> Your seat is confirmed only after payment and our written confirmation.</li></ol></div>
  <p style="margin:1.6rem 0">Haven't heard from us, or want to change something? Message us and include your reference.</p>
  <div class="status-actions">${K.waButton({ context: 'general', label: 'Message us on WhatsApp', cls: 'btn btn--accent', attrs: 'data-whatsapp-dynamic' })}<a class="btn btn--ghost" href="./trips.html">Back to trips</a></div>
</div>
</main>`,
  }), { noindex: true });

  {
    const hasWa = K.whatsappReady, mail = site.contact.email;
    out('contact.html', L.page({
      file: 'contact.html', nav: 'contact', dock: false, title: 'Contact us', description: 'Questions about a student trip from Lahore? Send us a message or start a WhatsApp chat.',
      main: `<main id="main">
${pageHero({ title: 'Contact us', lede: 'Ask about a trip, suggest a destination, or check something before you register. Parents and guardians are welcome to get in touch too.', crumbs: crumb([{ label: 'Contact', href: 'contact.html' }], './').html })}
<div class="wrap two">
  <div class="form-card">
    <div class="form-card__head"><h2 class="form-card__title">Send a message</h2>${site.forms.mode === 'test' ? '<p class="form-mode" role="note"><strong>Test mode.</strong> Messages go to a test sheet.</p>' : ''}</div>
    <form class="form" data-contact-form data-form-type="contact" novalidate ${site.forms.mode !== 'off' ? `action="${esc(site.forms.endpoint)}" method="post"` : ''}>
      <input type="hidden" name="formatHint" value="html">${site.forms.mode === 'test' ? '<input type="hidden" name="mode" value="test">' : ''}
      <div class="form__row form__row--2">
        <label class="field" for="ct-name"><span class="field__label">Your name</span><input class="field__input" id="ct-name" name="name" type="text" autocomplete="name" required minlength="2" maxlength="80" aria-describedby="ct-name-err"><span class="field__error" id="ct-name-err" data-error-for="name" hidden></span></label>
        <label class="field" for="ct-reply"><span class="field__label">Email or mobile number</span><input class="field__input" id="ct-reply" name="replyTo" type="text" autocomplete="email" required maxlength="120" aria-describedby="ct-reply-hint ct-reply-err"><span class="field__hint" id="ct-reply-hint">So we can reply to you</span><span class="field__error" id="ct-reply-err" data-error-for="replyTo" hidden></span></label>
      </div>
      <label class="field" for="ct-topic"><span class="field__label">What is it about?</span><select class="field__input" id="ct-topic" name="topic" required><option value="trip-question">A question about a trip</option><option value="group-trip">Organising a trip for my class or society</option><option value="parent">I'm a parent or guardian</option><option value="suggestion">Suggesting a destination</option><option value="other">Something else</option></select></label>
      <label class="field" for="ct-trip"><span class="field__label">Trip <span class="field__opt">(optional)</span></span><select class="field__input" id="ct-trip" name="tripId"><option value="">Not about a specific trip</option>${trips.map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select></label>
      <label class="field" for="ct-message"><span class="field__label">Message</span><textarea class="field__input" id="ct-message" name="message" rows="5" required minlength="10" maxlength="1500" aria-describedby="ct-message-hint ct-message-err"></textarea><span class="field__hint" id="ct-message-hint">Please don't include CNIC numbers, payment details or health information.</span><span class="field__error" id="ct-message-err" data-error-for="message" hidden></span></label>
      <div class="hp" aria-hidden="true"><label>Leave this field empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="form__consents"><label class="check"><input type="checkbox" name="consentPrivacy" value="yes" required> <span>I agree that my details can be used to reply to this message, as described in the <a href="./privacy-policy.html">privacy policy</a>.</span></label><span class="field__error" data-error-for="consent" hidden></span></div>
      <div class="form__actions"><button class="btn btn--accent" type="submit" data-submit><span class="btn__label">Send message</span><span class="btn__spinner" aria-hidden="true"></span></button></div>
      <div class="form__status" data-form-status role="status" aria-live="polite" tabindex="-1" hidden></div>
      <noscript><p class="form__noscript">This form needs JavaScript to send. Please use the other contact options on this page.</p></noscript>
    </form>
  </div>
  <aside class="aside" aria-label="Other ways to reach us">
    ${!hasWa && !mail ? K.notice('proposed', 'Our direct contact details are being set up. Please use the form for now.') : ''}
    ${hasWa ? `<div class="way"><h2>WhatsApp</h2><p>The quickest way to reach us. WhatsApp opens with a draft message; you press Send.</p>${K.waButton({ context: 'contact', cls: 'btn btn--accent', label: 'Start a WhatsApp chat' })}</div>` : ''}
    ${mail ? `<div class="way"><h2>Email</h2><p><a href="mailto:${esc(mail)}">${esc(mail)}</a></p></div>` : ''}
    ${site.contact.responseTime ? `<p class="reviewed">We usually reply ${esc(site.contact.responseTime)}.</p>` : ''}
    <div class="way"><h2>Your privacy</h2><p>We use your details only to reply to you. We don't add you to mailing lists or share your details. Read the <a href="./privacy-policy.html">privacy policy</a>.</p></div>
  </aside>
</div>
</main>`,
    }), { lastmod });
  }

  /* ================================================================ */
  /*  POLICIES, 404, REDIRECTS                                         */
  /* ================================================================ */
  policies.forEach((pg) => {
    const file = `${pg.slug}.html`;
    const { html, toc } = markdown(pg.body.replace(/\{\{brand\}\}/g, BRAND), { root: './' });
    const draft = !site.policies.legalReviewed;
    out(file, L.page({
      file, nav: '', paper: true, title: pg.title, description: pg.description,
      main: `<main id="main">
${pageHero({ title: esc(pg.title), lede: esc(pg.description), crumbs: crumb([{ label: pg.title, href: file }], './').html })}
<div class="wrap layout-toc">
  ${toc.length > 2 ? `<nav class="toc" aria-label="Contents"><p class="toc__t">Contents</p><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : '<div></div>'}
  <div>
    ${draft ? K.notice('draft', `<strong>Draft, not yet legally reviewed.</strong> This policy is a working draft. It will be reviewed by a qualified professional in Pakistan before we accept any payments. Last updated ${fmtDate(site.policies.lastUpdated, site.locale)}.`) : `<p class="reviewed">Last updated ${fmtDate(site.policies.lastUpdated, site.locale)}.</p>`}
    <div class="prose">${html}</div>
  </div>
</div>
</main>`,
    }), { lastmod });
  });

  out('404.html', L.page({
    file: '404.html', nav: '', dock: false, noindex: true, rootOverride: BASE_PATH, title: 'Page not found', description: 'This page could not be found.',
    main: `<main id="main">
<header class="ph ph--404"><div class="wrap ph__in"><p class="art-cat" aria-hidden="true">404</p><h1>This trail doesn't go anywhere</h1><p class="ph__lede">The page may have moved, or the link may be wrong.</p>
<div class="ph__cta"><a class="btn btn--accent" href="${BASE_PATH}">Go to the homepage</a><a class="btn btn--ghost" href="${BASE_PATH}trips.html">See trips</a></div></div>${ridgeStrip()}</header>
</main>`,
  }), { noindex: true });
}
