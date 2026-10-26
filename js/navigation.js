/* ==================================================================
   navigation.js — header behaviour, mobile menu, back-to-top,
   floating actions. (Adapted from the Portfolio project's main.js:
   same rAF-throttled scroll handling, focus trap and Escape handling.)
   ================================================================== */
import { prefersReducedMotion } from './config.js';

export function initNavigation() {
  const header = document.querySelector('[data-site-header]');
  const menu = document.querySelector('[data-mobile-menu]');
  const toggle = document.querySelector('[data-menu-toggle]');
  const toTop = document.querySelector('[data-to-top]');
  const floatBox = document.querySelector('[data-float-actions]');
  const footer = document.querySelector('.site-footer');
  if (!header) return;

  /* ---- header: solid after scrolling; hides on scroll down, returns on scroll up ---- */
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 24);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (goingDown && y > 320 && !document.body.classList.contains('menu-open') && !header.contains(document.activeElement)) header.classList.add('is-hidden');
    else if (goingUp || y < 120) header.classList.remove('is-hidden');
    lastY = y;
    if (toTop) {
      const show = y > window.innerHeight * 1.2;
      toTop.hidden = false;
      toTop.classList.toggle('is-shown', show);
      toTop.tabIndex = show ? 0 : -1;
      toTop.setAttribute('aria-hidden', String(!show));
    }
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  update();

  /* ---- back to top ---- */
  toTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    const target = document.querySelector('.skip-link') || document.body;
    target.focus({ preventScroll: true });
  });

  /* ---- floating buttons step aside over the footer and while typing ---- */
  if (floatBox && 'IntersectionObserver' in window && footer) {
    let overFooter = false; let typing = false;
    const sync = () => floatBox.classList.toggle('is-tucked', overFooter || typing);
    new IntersectionObserver(([e]) => { overFooter = e.isIntersecting; sync(); }, { rootMargin: '0px 0px -40px 0px' }).observe(footer);
    document.addEventListener('focusin', (e) => { typing = e.target.matches('input, textarea, select'); sync(); });
    document.addEventListener('focusout', () => { typing = false; sync(); });
  }

  /* ---- mobile menu ---- */
  if (!menu || !toggle) return;
  const focusables = () => [toggle, ...menu.querySelectorAll('a[href], button:not([disabled])')];
  const outside = [document.getElementById('main'), document.querySelector('.site-footer'), floatBox].filter(Boolean);
  let open = false; let closeTimer;

  function openMenu() {
    open = true;
    clearTimeout(closeTimer);
    menu.hidden = false;
    document.body.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.querySelector('.menu-toggle__label').textContent = 'Close';
    outside.forEach((el) => el.setAttribute('inert', ''));
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      menu.classList.add('is-open');
      menu.querySelector('.mobile-menu__link')?.focus();
    });
  }
  function closeMenu({ restoreFocus = true } = {}) {
    if (!open) return;
    open = false;
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.menu-toggle__label').textContent = 'Menu';
    outside.forEach((el) => el.removeAttribute('inert'));
    document.documentElement.style.overflow = '';
    closeTimer = setTimeout(() => { menu.hidden = true; }, prefersReducedMotion() ? 0 : 320);
    if (restoreFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => (open ? closeMenu() : openMenu()));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu({ restoreFocus: false }); });
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key === 'Tab') {
      const f = focusables();
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.matchMedia('(min-width: 1060px)').addEventListener('change', (mq) => { if (mq.matches) closeMenu({ restoreFocus: false }); });
}
