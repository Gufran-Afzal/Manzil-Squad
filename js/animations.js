/* ==================================================================
   animations.js — scroll-linked motion (all optional enhancements)

   - Reveal groups: [data-reveal-group] children with [data-animate]
     fade/rise in when the group enters the viewport (wave stagger via
     the --d custom property, as in the Portfolio's reveal engine).
   - Hero parallax: hero artwork layers drift at different speeds.
   - Route: the elevation line draws when it scrolls into view.
   - Itinerary: a progress line fills and stops light up as you read.

   Nothing here hijacks scrolling, and everything is skipped when the
   visitor prefers reduced motion (CSS then shows the final state).
   ================================================================== */
import { prefersReducedMotion } from './config.js';

export function initAnimations() {
  const reduce = prefersReducedMotion();
  const io = 'IntersectionObserver' in window;

  /* ---- reveal groups ---- */
  const groups = document.querySelectorAll('[data-reveal-group]');
  const revealAll = (g) => g.querySelectorAll('[data-animate]').forEach((el) => el.classList.add('is-visible'));
  if (reduce || !io) groups.forEach(revealAll);
  else {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { revealAll(en.target); obs.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    groups.forEach((g) => {
      // stagger children automatically unless they set --d themselves
      g.querySelectorAll(':scope > [data-animate], :scope > * > [data-animate]').forEach((el, i) => { if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', String(i)); });
      g.querySelectorAll(':scope > .dest-card, :scope > .ticket').forEach((el, i) => { el.setAttribute('data-animate', 'rise'); el.style.setProperty('--d', String(i)); });
      obs.observe(g);
    });
  }

  /* ---- route line ---- */
  const routes = document.querySelectorAll('[data-route]');
  if (reduce || !io) routes.forEach((r) => r.classList.add('is-drawn'));
  else {
    const robs = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-drawn'); robs.unobserve(en.target); } });
    }, { threshold: 0.35 });
    routes.forEach((r) => robs.observe(r));
  }

  if (reduce) {
    document.querySelectorAll('[data-itinerary-stop]').forEach((s) => s.classList.add('is-active'));
    document.querySelectorAll('[data-itinerary-fill]').forEach((f) => f.style.setProperty('--progress', '100%'));
    return;
  }

  /* ---- hero parallax (transform only; paused when the hero is off-screen) ---- */
  const art = document.querySelector('[data-parallax]');
  if (art) {
    const layers = [...art.querySelectorAll('.hero-art__layer')];
    const n = layers.length;
    let visible = true; let raf = 0;
    const paint = () => {
      raf = 0;
      const y = Math.min(window.scrollY, window.innerHeight * 1.2);
      layers.forEach((l, i) => {
        // Layer 0 is the farthest ridge. Shifting it down by a larger share of the
        // scroll makes it lag behind, so distant ridges seem to move slowest.
        const depth = (n - 1 - i) / Math.max(n - 1, 1); // 1 = far, 0 = near
        l.style.transform = `translate3d(0, ${(y * (0.04 + depth * 0.26)).toFixed(1)}px, 0)`;
      });
    };
    if (io) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(art);
    window.addEventListener('scroll', () => { if (visible && !raf) raf = requestAnimationFrame(paint); }, { passive: true });
  }

  /* ---- itinerary progress ---- */
  const it = document.querySelector('[data-itinerary]');
  if (it) {
    const fill = it.querySelector('[data-itinerary-fill]');
    const stops = [...it.querySelectorAll('[data-itinerary-stop]')];
    let raf = 0;
    const paint = () => {
      raf = 0;
      const r = it.getBoundingClientRect();
      const trigger = window.innerHeight * 0.6;
      const p = Math.min(Math.max((trigger - r.top) / r.height, 0), 1);
      fill.style.setProperty('--progress', `${(p * 100).toFixed(1)}%`);
      stops.forEach((s) => s.classList.toggle('is-active', s.getBoundingClientRect().top + 8 < trigger));
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  }
}
