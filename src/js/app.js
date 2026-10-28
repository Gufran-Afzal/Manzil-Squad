/* ==================================================================
   app.js — the whole site's behaviour in one small classic script.

   • One passive scroll listener + one rAF loop drives every scroll
     effect (hero parallax, the climb scene, progress lines, header).
   • Everything is progressive enhancement: without this file the page
     is complete, readable and fully usable.
   • "lite" mode (reduced motion, Save-Data, ≤2 GB RAM / ≤2 cores)
     removes parallax and infinite loops but keeps the intro.
   • Forms, analytics: loaded on demand (dynamic import), never upfront.
   ================================================================== */
(function () {
  'use strict';
  var d = document, w = window, root = d.documentElement;
  w.__a = 1; // tells the inline fallback timer that the script is alive

  var reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = w.navigator, conn = nav.connection || {};
  var lite = reduce || conn.saveData || (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2);
  if (lite) root.classList.add('lite');

  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var fmt = function (n) { return n.toLocaleString('en-US'); };
  var cfg = {};
  try { cfg = JSON.parse($('#site-config').textContent); } catch (e) { /* ignore */ }
  var base = d.currentScript ? d.currentScript.src.replace(/[^/]*$/, '') : '';
  var hasIO = 'IntersectionObserver' in w;

  /* ---------- scroll hub ---------- */
  var subs = [], pending = false, lastY = -1;
  function frame() {
    pending = false;
    var y = w.pageYOffset, vh = w.innerHeight;
    for (var i = 0; i < subs.length; i++) subs[i](y, vh, lastY < 0 ? 0 : y - lastY);
    lastY = y;
  }
  function kick() { if (!pending) { pending = true; w.requestAnimationFrame(frame); } }
  w.addEventListener('scroll', kick, { passive: true });
  w.addEventListener('resize', function () { measure(); kick(); });

  /* ---------- reveal on scroll ---------- */
  if (hasIO) {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('[data-r],[data-split],.step,.it__s').forEach(function (el) { rio.observe(el); });

    // looping animations only run while their element is on screen
    var oio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('on', e.isIntersecting); });
    }, { rootMargin: '80px' });
    $$('.hero,.marq,.cta,.rail__hint,.ph--img').forEach(function (el) { oio.observe(el); });
  } else {
    root.classList.add('fb');
  }

  /* ---------- header, menu ---------- */
  var hdr = $('[data-hdr]'), hero = $('[data-hero]');
  var menu = $('[data-menu]'), mbtn = $('[data-menu-btn]'), main = $('main');
  var menuOpen = false, closeT = 0;
  function setMenu(open) {
    if (open === menuOpen || !menu) return;
    menuOpen = open; clearTimeout(closeT);
    mbtn.setAttribute('aria-expanded', String(open));
    mbtn.firstElementChild.textContent = open ? 'Close' : 'Menu';
    d.body.classList.toggle('menu-open', open);
    if (main) main.inert = open;
    if (open) {
      menu.hidden = false; void menu.offsetWidth; menu.classList.add('open');
      var a = $('a', menu); if (a) a.focus({ preventScroll: true });
    } else {
      menu.classList.remove('open');
      closeT = setTimeout(function () { menu.hidden = true; }, 700);
      mbtn.focus({ preventScroll: true });
    }
  }
  if (mbtn) {
    mbtn.addEventListener('click', function () { setMenu(!menuOpen); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    w.matchMedia('(min-width:980px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });
  }
  var dock = $('[data-dock]'), docH = 0, heroH = 0, dockHidden = false;
  if (dock && hasIO && dock.getAttribute('data-hide-on')) {
    var target = $(dock.getAttribute('data-hide-on'));
    if (target) new IntersectionObserver(function (es) { dockHidden = es[0].isIntersecting; kick(); }).observe(target);
  }
  subs.push(function (y, vh, dy) {
    if (hdr) {
      hdr.classList.toggle('solid', y > 24);
      var hide = hdr.classList.contains('hide');
      if (y > 240 && dy > 6 && !menuOpen) hide = true; else if (dy < -4 || y < 240) hide = false;
      hdr.classList.toggle('hide', hide);
    }
    if (dock) dock.classList.toggle('show', y > (heroH || vh) * 0.85 && y + vh < docH - 360 && !menuOpen && !dockHidden);
  });

  /* ---------- hero: intro timeline + parallax ---------- */
  var heroVisible = true, lastS = -1;
  if (hero) {
    var route = $('#hero-route'), bus = $('#hero-bus'), nEl = $('[data-alt]'), lEl = $('[data-alt-label]');
    var stops = [];
    try { stops = JSON.parse(hero.getAttribute('data-stops')); } catch (e) { /* ignore */ }
    var asc = []; // keep stops while elevation keeps rising (Ayubia sits just below Nathiagali)
    stops.forEach(function (s) { if (!asc.length || s[1] > asc[asc.length - 1][1]) asc.push(s); });
    var A = stops.length ? stops[0][1] : 217, B = asc.length ? asc[asc.length - 1][1] : 2410;
    var len = route.getTotalLength();
    var paint = function (t) {
      route.style.strokeDashoffset = String(1 - t);
      var p = route.getPointAtLength(t * len);
      bus.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
      var v = Math.round(A + (B - A) * t);
      nEl.textContent = fmt(v);
      for (var i = asc.length - 1; i >= 0; i--) if (v >= asc[i][1] - 1) { lEl.textContent = asc[i][0]; break; }
    };
    paint(0);
    if (reduce) paint(1);
    else {
      var t0 = 0, delay = 700, dur = 4200;
      var step = function (ts) {
        if (!t0) t0 = ts;
        var k = clamp((ts - t0 - delay) / dur, 0, 1);
        paint(k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
        if (k < 1) w.requestAnimationFrame(step);
      };
      w.requestAnimationFrame(step);
    }
    if (hasIO) new IntersectionObserver(function (es) { heroVisible = es[0].isIntersecting; }).observe(hero);
    var copy = $('.hero__copy', hero);
    var par = [['.ly-back', 70], ['.ly-mid', 42], ['.ly-route', 30], ['.ly-front', 10], ['.hero__copy', -34]].map(function (a) { return [$(a[0], hero), a[1]]; }).filter(function (a) { return a[0]; });
    if (!lite) subs.push(function (y) {
      if (!heroVisible) return;
      var s = clamp(y / (heroH || 700), 0, 1);
      if (Math.abs(s - lastS) > 0.002) {
        lastS = s;
        for (var i = 0; i < par.length; i++) par[i][0].style.transform = 'translate3d(0,' + (s * par[i][1]).toFixed(1) + 'px,0)';
        copy.style.opacity = (1 - s * 1.5).toFixed(2);
      }
    });
  }

  /* ---------- the climb (scroll-driven altitude scene) ---------- */
  var cl = $('[data-climb]'), clTop = 0, clH = 0;
  if (cl) {
    var line = $('.climb__line', cl), dot = $('.climb__dot', cl), nE = $('.climb__n', cl), wE = $('.climb__where b', cl);
    var cs = $$('.climb__stop', cl), cx = cs.map(function (s) { return +s.getAttribute('data-x'); });
    var yT = +cl.getAttribute('data-ytop'), yB = +cl.getAttribute('data-ybot'), eMin = +cl.getAttribute('data-min'), eMax = +cl.getAttribute('data-max');
    var plen = line.getTotalLength(), last = -1;
    var apply = function (p) {
      if (Math.abs(p - last) < 0.001) return; last = p;
      line.style.strokeDashoffset = String(1 - p);
      var pt = line.getPointAtLength(p * plen);
      dot.setAttribute('cx', pt.x.toFixed(1)); dot.setAttribute('cy', pt.y.toFixed(1));
      nE.textContent = fmt(Math.round(eMax - (pt.y - yT) / (yB - yT) * (eMax - eMin)));
      var cur = 0;
      cs.forEach(function (s, i) { var on = pt.x >= cx[i] - 1; s.classList.toggle('on', on); if (on) cur = i; });
      wE.textContent = cs[cur].getAttribute('data-name');
    };
    if (lite) apply(1);
    else { apply(0); subs.push(function (y, vh) { if (y + vh > clTop && y < clTop + clH) apply(clamp((y - clTop) / Math.max(clH - vh, 1), 0, 1)); }); }
  }

  /* ---------- progress lines (steps, itinerary) ---------- */
  var progs = $$('[data-prog]');
  if (progs.length) subs.push(function (y, vh) {
    progs.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) return;
      el.style.setProperty('--pp', clamp((vh * 0.62 - r.top) / r.height, 0, 1).toFixed(3));
    });
  });
  var rp = $('[data-read-progress]');
  if (rp) subs.push(function (y, vh) { rp.style.setProperty('--rp', clamp(y / Math.max(docH - vh, 1), 0, 1).toFixed(3)); });

  /* ---------- small things ---------- */
  $$('[data-copy-link]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-copy-link') || w.location.href;
      (nav.clipboard ? nav.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Copy from address bar'; });
    });
  });
  $$('.toc a[href^="#"]').forEach(function (a) { a.addEventListener('click', function () { a.blur(); }); });

  /* ---------- measure + start ---------- */
  function measure() {
    docH = d.documentElement.scrollHeight; heroH = hero ? hero.offsetHeight : 0;
    if (cl) { var r = cl.getBoundingClientRect(); clTop = r.top + w.pageYOffset; clH = r.height; }
  }
  measure(); kick();
  w.addEventListener('load', function () { measure(); kick(); });
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { measure(); kick(); });

  /* ---------- on-demand modules ---------- */
  if ($('[data-booking-form],[data-contact-form],[data-ref-card]') || cfg.analytics) {
    import(base + 'forms.js').then(function (m) { if ($('[data-booking-form],[data-contact-form],[data-ref-card]')) m.init(cfg); }).catch(function (e) { console.error('[site] forms failed to load', e); });
  }
  if (cfg.analytics) import(base + 'analytics.js').then(function (m) { m.init(cfg); }).catch(function () {});
})();
