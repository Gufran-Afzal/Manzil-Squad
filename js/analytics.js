/* ==================================================================
   analytics.js — optional, privacy-light event tracking.

   Only loaded when analytics is enabled in content/site.json, and only
   sends event NAMES (for example "register_submitted"), never form
   contents. Update the privacy policy before enabling analytics.
   ================================================================== */
export function track(name, props = {}) {
  try {
    if (typeof window.plausible === 'function') window.plausible(name, { props });
    else if (typeof window.gtag === 'function') window.gtag('event', name, props);
  } catch { /* analytics must never break the page */ }
}

export function init(config) {
  if (config.analytics === 'ga4' && !window.gtag) {
    // GA4 bootstrap (the loader script tag is added by the build when enabled)
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', config.analyticsId, { anonymize_ip: true });
  }
  document.addEventListener('click', (e) => {
    const wa = e.target.closest('[data-whatsapp]');
    if (wa) track('whatsapp_click', { context: wa.getAttribute('data-whatsapp') });
  });
  document.addEventListener('site:form', (e) => track(e.detail.event, { form: e.detail.form }));
}
