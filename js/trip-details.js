/* ==================================================================
   trip-details.js — highlights the current section in on-page
   contents lists (trip pages, articles, policies) as you scroll.
   ================================================================== */
export function init() {
  if (!('IntersectionObserver' in window)) return;
  document.querySelectorAll('.trip-toc, .approach .toc, .policy-layout .toc, .article-layout .toc').forEach((toc) => {
    const links = [...toc.querySelectorAll('a[href^="#"]')];
    const sections = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
    if (!sections.length) return;
    const visible = new Map();
    const pick = () => {
      let current = null;
      for (const s of sections) if (visible.get(s)) { current = s; break; }
      if (!current) return;
      links.forEach((a) => {
        const on = a.hash.slice(1) === current.id;
        a.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    };
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => visible.set(e.target, e.isIntersecting));
      pick();
    }, { rootMargin: '-20% 0px -60% 0px' });
    sections.forEach((s) => obs.observe(s));
  });
}
