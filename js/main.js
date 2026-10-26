/* ==================================================================
   main.js — entry point, loaded on every page as an ES module.

   Loads the always-needed modules, then loads page-specific modules
   only when their markup is present, so each page downloads only the
   JavaScript it uses. Every module is progressive enhancement: the
   HTML works (links, content, FAQ, forms' no-JS notice) without it.
   ================================================================== */
import { initNavigation } from './navigation.js';
import { initAnimations } from './animations.js';
import { getConfig } from './config.js';

const config = getConfig();
initNavigation();
initAnimations();

const has = (sel) => document.querySelector(sel) !== null;
const load = (path, sel) => {
  if (sel && !has(sel)) return;
  import(path).then((m) => m.init && m.init(config)).catch((err) => {
    // A failed enhancement must never break the page; log it for debugging.
    console.error(`[site] could not load ${path}`, err);
  });
};

load('./filters.js', '[data-filter-grid]');
load('./faq.js', 'details.faq');
load('./gallery.js', '[data-lightbox]');
load('./booking.js', '[data-booking-form], [data-ref-card]');
load('./contact.js', '[data-contact-form]');
load('./trip-details.js', '.trip-toc, .approach .toc, .policy-layout .toc, .article-layout .toc');
load('./article.js', '[data-read-progress], [data-copy-link]');
if (config.analytics) load('./analytics.js');
