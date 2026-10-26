/* ==================================================================
   faq.js — smooth open/close for <details class="faq"> accordions.
   The native <details> element already works with keyboard and screen
   readers and without JavaScript; this only animates the height.
   ================================================================== */
import { prefersReducedMotion } from './config.js';

export function init() {
  if (prefersReducedMotion()) return;
  document.querySelectorAll('details.faq').forEach((d) => {
    const summary = d.querySelector('summary');
    const body = d.querySelector('.faq__a');
    if (!summary || !body) return;
    let anim = null;
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (anim) anim.cancel();
      if (d.open) {
        const h = body.offsetHeight;
        anim = body.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.65,0,.35,1)' });
        anim.onfinish = () => { d.open = false; anim = null; };
      } else {
        d.open = true;
        const h = body.offsetHeight;
        anim = body.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
        anim.onfinish = () => { anim = null; };
      }
    });
  });
  // Open a question linked directly, e.g. faq.html#faq-payment-methods
  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target && target.matches('details.faq')) target.open = true;
}
