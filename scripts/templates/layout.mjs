/* ==================================================================
   layout.mjs — the page shell (head, header, menu, footer, dock) and
   the small fragments every page shares.
   ================================================================== */
import { esc, rootFor, isPlaceholder } from '../lib/util.mjs';
import { icon } from '../lib/components.mjs';
import { ridgeStrip } from './art.mjs';

/** Split a heading into masked words that rise one after another (done at build time: no layout shift). */
export const split = (text) => text.split(' ').map((w, i) => `<span class="w"><i style="--k:${i}">${esc(w)}</i></span>`).join(' ');

export const NAV = [
  ['trips.html', 'Trips', 'trips'],
  ['destinations.html', 'Destinations', 'destinations'],
  ['articles.html', 'Journal', 'articles'],
  ['about-us.html', 'About', 'about'],
  ['faq.html', 'Questions', 'faq'],
  ['contact.html', 'Contact', 'contact'],
];

export function makeLayout({ site, images, BRAND, SITE_URL, BASE_PATH, DEV, todo, K, version }) {
  const YEAR = String(site.policies.lastUpdated).slice(0, 4);
  const brandOk = !isPlaceholder(BRAND);

  /* ---------- SEO tags ---------- */
  function seo({ title, description, file, type = 'website', image, noindex = false, extra = '' }) {
    const full = title === BRAND || !brandOk ? title : `${title} | ${BRAND}`;
    const url = SITE_URL && !noindex ? `${SITE_URL}/${file === 'index.html' ? '' : file}` : '';
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

  const analyticsTag = () => {
    const a = site.analytics;
    if (!a.enabled || DEV) return '';
    if (a.provider === 'plausible' && a.plausibleDomain) return `<script defer data-domain="${esc(a.plausibleDomain)}" src="https://plausible.io/js/script.js"></script>`;
    if (a.provider === 'ga4' && /^G-[A-Z0-9]+$/.test(a.ga4MeasurementId)) return `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(a.ga4MeasurementId)}"></script>`;
    return '';
  };

  /* ---------- header + menu ---------- */
  const header = (root, nav) => `<a class="skip" href="#main">Skip to content</a>
<header class="hdr" data-hdr>
  <div class="hdr__in">
    <a class="brand" href="${root}" aria-label="${esc(BRAND)}: home">${icon.mark}<span>${esc(BRAND)}</span></a>
    <nav class="nav" aria-label="Main"><ul>${NAV.map(([h, l, k]) => `<li><a href="${root}${h}"${k === nav ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></nav>
    <a class="btn btn--accent btn--small hdr__cta" href="${root}booking.html">Register interest</a>
    <button class="menu-btn" type="button" data-menu-btn aria-expanded="false" aria-controls="menu"><span>Menu</span><span class="menu-btn__i" aria-hidden="true"><i></i><i></i></span></button>
  </div>
</header>
<div class="menu" id="menu" data-menu role="dialog" aria-modal="true" aria-label="Menu" hidden>
  <nav aria-label="Main (mobile)"><ol class="menu__list">
    <li style="--i:0"><a href="${root}"><small>00</small>Home</a></li>
    ${NAV.map(([h, l], i) => `<li style="--i:${i + 1}"><a href="${root}${h}"><small>0${i + 1}</small>${l}</a></li>`).join('\n    ')}
  </ol></nav>
  <div class="menu__foot"><a class="btn btn--accent" href="${root}booking.html">Register interest</a>${K.waButton({ context: 'general', cls: 'btn btn--ghost' })}</div>
</div>`;

  /* ---------- footer ---------- */
  const footer = (root) => `<footer class="ftr">
  ${ridgeStrip()}
  <div class="wrap">
    <div class="ftr__top">
      <p class="ftr__big h2">${esc(site.brand.tagline.replace(/\.$/, ''))}<em>.</em></p>
      <div class="ftr__cols">
        ${site.footer.columns.map((c) => `<nav aria-label="${esc(c.heading)}"><p class="ftr__h">${esc(c.heading)}</p><ul>${c.links.map((l) => `<li><a href="${root}${esc(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul></nav>`).join('')}
        ${Object.values(site.socials).some(Boolean) ? `<nav aria-label="Social"><p class="ftr__h">Follow</p><ul>${Object.entries(site.socials).filter(([, u]) => u).map(([k, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(k[0].toUpperCase() + k.slice(1))}</a></li>`).join('')}</ul></nav>` : ''}
      </div>
    </div>
    <div class="ftr__contacts">
      ${site.contact.email ? `<a class="ftr__contact" href="mailto:${esc(site.contact.email)}">${icon.mail}<span>${esc(site.contact.email)}</span></a>` : ''}
      ${K.whatsappReady ? `<a class="ftr__contact" href="${esc(K.waHref('general'))}" target="_blank" rel="noopener noreferrer">${icon.whatsapp}<span>${esc(site.contact.phoneDisplay || 'WhatsApp')}</span></a>` : ''}
    </div>
    <div class="ftr__fine">
      <p>© ${YEAR} ${esc(BRAND)} · ${esc(site.operatingRegion)}</p>
      ${site.operator.verified ? `<p>Registered with ${esc(site.operator.registrationAuthority)}, no. ${esc(site.operator.registrationNumber)}.</p>` : '<p>Pre-launch: nothing here is a confirmed booking until we confirm it in writing.</p>'}
    </div>
  </div>
</footer>`;

  /* ---------- the page ---------- */
  function page({ file, nav = '', title, description, main, paper = false, noindex = false, type, image, seoExtra = '', rootOverride, dock = true, dockHref, bodyClass = '' }) {
    const depth = file.split('/').length - 1;
    const root = rootOverride || rootFor(depth);
    const config = {
      root, brand: BRAND, whatsapp: K.whatsappReady ? site.contact.whatsapp : '',
      forms: { mode: site.forms.mode, endpoint: site.forms.mode === 'off' ? '' : site.forms.endpoint },
      email: site.contact.email, dev: DEV,
      analytics: site.analytics.enabled && !DEV ? site.analytics.provider : '',
      analyticsId: site.analytics.enabled && site.analytics.provider === 'ga4' ? site.analytics.ga4MeasurementId : '',
    };
    const devBanner = DEV && todo.length ? `<details class="dev-panel"><summary>Setup: ${todo.length} item${todo.length === 1 ? '' : 's'} to finish</summary><ul>${todo.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>` : '';
    return `<!DOCTYPE html>
<html lang="${esc(site.language)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a1510">
${seo({ title, description, file, type, image, noindex, extra: seoExtra })}
<link rel="icon" type="image/svg+xml" href="${root}assets/icons/favicon.svg">
<link rel="preload" href="${root}assets/fonts/archivo-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}css/site.css?v=${version.css}">
<script>document.documentElement.className+=' js';setTimeout(function(){window.__a||(document.documentElement.className+=' fb')},4500)</script>
<script type="application/json" id="site-config">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>
<script defer src="${root}js/app.js?v=${version.js}"></script>
${analyticsTag()}
</head>
<body class="${[paper ? 'paper' : '', bodyClass].filter(Boolean).join(' ')}">
${header(root, nav)}
${main}
${footer(root)}
${dock ? `<div class="dock" data-dock${dockHref ? ` data-hide-on="${dockHref}"` : ''}><a class="btn btn--accent" href="${dockHref || `${root}booking.html`}">Register interest<svg class="icon arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>${K.whatsappReady ? `<a class="btn btn--wa" href="${esc(K.waHref('general'))}" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp (opens WhatsApp)">${icon.whatsapp}</a>` : ''}</div>` : ''}
${devBanner}
</body>
</html>
`;
  }

  return { page, seo, YEAR };
}

/* ---------- shared fragments ---------- */
export const arrow = '<svg class="icon arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const ctaBand = (K, root) => `<section class="cta" data-cta aria-labelledby="cta-h">
  <div class="wrap">
    <h2 id="cta-h" data-split>${split('Be on the')} <em>${split('first bus.')}</em></h2>
    <p data-r>Register interest now. It is free and does not commit you to anything. We will message you when dates and the final price are set.</p>
    <div class="cta__a" data-r style="--d:2"><a class="btn btn--accent" href="${root}booking.html">Register interest ${arrow}</a>${K.waButton({ context: 'general', cls: 'btn btn--ghost' })}</div>
  </div>
</section>`;

/** Inner-page hero. */
export const pageHero = ({ title, lede = '', crumbs = '', extra = '', cls = '' }) => `<header class="ph ${cls}">
  <div class="wrap ph__in">
    ${crumbs}
    <h1>${title}</h1>
    ${lede ? `<p class="ph__lede">${lede}</p>` : ''}
    ${extra}
  </div>
  ${ridgeStrip()}
</header>`;
