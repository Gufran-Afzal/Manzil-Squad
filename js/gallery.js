/* ==================================================================
   gallery.js — accessible lightbox for [data-lightbox] links.

   Each image link points at the large file, so without JavaScript the
   link simply opens the image. With JavaScript, a <dialog> opens with
   previous/next buttons, arrow keys, swipe, Escape to close, and focus
   returns to the link that opened it.
   ================================================================== */
export function init() {
  const links = [...document.querySelectorAll('[data-lightbox]')];
  if (!links.length || typeof HTMLDialogElement === 'undefined') return;

  const dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.setAttribute('aria-label', 'Image viewer');
  dlg.innerHTML = `<div class="lightbox__frame">
    <div class="lightbox__bar"><p class="lightbox__count" aria-live="polite"></p><button class="lightbox__btn" type="button" data-lb-close><svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="visually-hidden">Close</span></button></div>
    <div class="lightbox__stage">
      <img class="lightbox__img" alt="">
      <button class="lightbox__btn lightbox__nav lightbox__nav--prev" type="button" data-lb-prev><svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="visually-hidden">Previous image</span></button>
      <button class="lightbox__btn lightbox__nav lightbox__nav--next" type="button" data-lb-next><svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="visually-hidden">Next image</span></button>
    </div>
    <p class="lightbox__cap"></p>
  </div>`;
  document.body.appendChild(dlg);
  const img = dlg.querySelector('.lightbox__img');
  const cap = dlg.querySelector('.lightbox__cap');
  const count = dlg.querySelector('.lightbox__count');
  let list = []; let idx = 0; let opener = null;

  function show(i) {
    idx = (i + list.length) % list.length;
    const a = list[idx];
    const thumb = a.querySelector('img');
    img.classList.remove('is-in');
    img.src = a.getAttribute('href');
    img.alt = thumb?.getAttribute('alt') || '';
    void img.offsetWidth; // restart the fade
    img.classList.add('is-in');
    cap.textContent = a.getAttribute('data-caption') || '';
    count.textContent = `${idx + 1} of ${list.length}`;
    dlg.querySelectorAll('.lightbox__nav').forEach((b) => { b.hidden = list.length < 2; });
  }
  function open(link) {
    const group = link.closest('[data-gallery]');
    list = (group ? [...group.querySelectorAll('[data-lightbox]')] : [link]).filter((l) => !l.closest('[hidden]'));
    opener = link;
    show(list.indexOf(link));
    dlg.showModal();
    dlg.querySelector('[data-lb-close]').focus();
  }

  links.forEach((a) => a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let people open in a new tab
    e.preventDefault(); open(a);
  }));
  dlg.querySelector('[data-lb-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-lb-prev]').addEventListener('click', () => show(idx - 1));
  dlg.querySelector('[data-lb-next]').addEventListener('click', () => show(idx + 1));
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('lightbox__stage')) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
  });
  dlg.addEventListener('close', () => opener?.focus());
  let x0 = null;
  dlg.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
  });
}
