/* ==================================================================
   article.js — reading progress bar and "Copy link" buttons
   (adapted from the Portfolio project's article.js)
   ================================================================== */
export function init() {
  const bar = document.querySelector('[data-read-progress]');
  const body = document.querySelector('.prose--article');
  if (bar && body) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = body.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.5;
      const done = Math.min(Math.max(-r.top + window.innerHeight * 0.25, 0), Math.max(total, 1));
      bar.style.transform = `scaleX(${total > 0 ? (done / total).toFixed(3) : 1})`;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  document.querySelectorAll('[data-copy-link]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-copy-link') || location.href.split('#')[0];
      const original = btn.textContent;
      let ok = false;
      try { await navigator.clipboard.writeText(url); ok = true; } catch { ok = false; }
      btn.textContent = ok ? 'Link copied' : 'Copy failed: use the address bar';
      setTimeout(() => { btn.textContent = original; }, 2000);
    });
  });
}
