#!/usr/bin/env node
/* ==================================================================
   tests/browser.mjs — end-to-end checks in a real Chromium browser.

   Optional (needs Playwright, ~150 MB):
     npm install --no-save playwright && npx playwright install chromium
   Then, in three terminals:
     npm run mock:forms
     FORMS_ENDPOINT=http://localhost:4174/exec npm run dev     (builds + serves on :4173)
     npm run test:browser
   Set CHROMIUM_PATH to use a Chromium you already have.
   ================================================================== */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const MOCK = process.env.MOCK_URL || 'http://localhost:4174';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: process.env.CHROMIUM_ARGS ? JSON.parse(process.env.CHROMIUM_ARGS) : [] });
let passed = 0; const failed = [];
async function test(name, fn, ctxOpts = {}) {
  const { allowNetErrors = false, ...opts } = ctxOpts;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404 \(Not Found\)/.test(m.text()) && !(allowNetErrors && /net::ERR_/.test(m.text()))) errors.push(m.text()); });
  try {
    await fn(page, ctx);
    assert.deepEqual(errors, [], 'console errors');
    passed++; console.log(`  ✓ ${name}`);
  } catch (e) {
    failed.push(name); console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}`);
  } finally { await ctx.close(); }
}
const mock = async (path) => (await fetch(MOCK + path)).text();
const rows = async () => JSON.parse(await mock('/__rows'));
const go = (page, p, opts) => page.goto(BASE + p, { waitUntil: 'networkidle', ...opts });

async function fillBooking(page, { phone = '0300 1234567' } = {}) {
  await page.fill('#trip-name', 'Ayesha Khan');
  await page.fill('#trip-phone', phone);
  await page.fill('#trip-uni', 'University of Lahore');
  await page.fill('#trip-count', '2');
  await page.check('input[name="consentPrivacy"]');
  await page.check('input[name="consentTerms"]');
  await page.waitForTimeout(2100); // the server ignores forms sent faster than a person could
}

console.log('Browser tests');

/* ---------------- navigation ---------------- */
await test('mobile menu: opens, traps focus, closes on Escape and returns focus', async (page) => {
  await go(page, '');
  const toggle = page.locator('[data-menu-toggle]');
  await toggle.click();
  await page.waitForTimeout(400);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#main').getAttribute('inert'), '');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Home');
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.querySelector('[data-mobile-menu]').contains(document.activeElement) || document.activeElement.matches('[data-menu-toggle]')), 'focus left the menu');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.ok(await page.evaluate(() => document.activeElement.matches('[data-menu-toggle]')));
  assert.equal(await page.locator('[data-mobile-menu]').isHidden(), true);
}, { viewport: { width: 390, height: 844 }, hasTouch: true });

await test('keyboard: first Tab reaches a visible skip link that jumps to main', async (page) => {
  await go(page, 'trips.html');
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  assert.ok(await skip.evaluate((el) => el === document.activeElement && el.getBoundingClientRect().top >= 0));
  await page.keyboard.press('Enter');
  assert.ok(page.url().endsWith('#main'));
});

await test('keyboard: focus indicator is visible on links and buttons', async (page) => {
  await go(page, 'faq.html');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(outline, 'none');
});

/* ---------------- filters ---------------- */
await test('trips filters: status filter, empty state, reset, URL sync', async (page) => {
  await go(page, 'trips.html');
  assert.match(await page.textContent('[data-filter-status]'), /Showing 1 trip/);
  await page.selectOption('[data-facet="status"]', 'interest');
  assert.equal(await page.locator('.ticket:visible').count(), 1);
  await page.fill('[data-filter-search]', 'hunza');
  await page.locator('[data-filter-empty]').waitFor();
  assert.equal(await page.locator('[data-filter-empty]').isVisible(), true);
  assert.match(page.url(), /q=hunza/);
  await page.click('[data-filter-reset]');
  assert.equal(await page.locator('.ticket:visible').count(), 1);
});

await test('destinations filters: region chips and search', async (page) => {
  await go(page, 'destinations.html');
  assert.equal(await page.locator('.dest-card:visible').count(), 6);
  await page.click('button[data-filter="galiyat"]');
  assert.equal(await page.locator('.dest-card:visible').count(), 2);
  assert.equal(await page.getAttribute('button[data-filter="galiyat"]', 'aria-pressed'), 'true');
  await page.click('button[data-filter="all"]');
  await page.fill('[data-filter-search]', 'kalam');
  await page.waitForFunction(() => /Showing 1 of/.test(document.querySelector('[data-filter-status]').textContent));
  assert.equal(await page.locator('.dest-card:visible').count(), 1);
});

await test('journal: topic chips and search, state restored from URL', async (page) => {
  await go(page, 'articles.html?category=safety-and-trust');
  const n = await page.locator('[data-filter-grid] .post-card:visible').count();
  assert.ok(n >= 1 && n < 9, `got ${n}`);
  await page.click('button[data-filter="all"]');
  await page.fill('[data-filter-search]', 'packing');
  await page.waitForFunction(() => /Showing 1 of/.test(document.querySelector('[data-filter-status]').textContent));
  assert.equal(await page.locator('[data-filter-grid] .post-card:visible').count(), 1);
});

/* ---------------- FAQ, gallery, itinerary ---------------- */
await test('FAQ accordion opens and closes with mouse and keyboard', async (page) => {
  await go(page, 'faq.html');
  const d = page.locator('details.faq').first();
  await d.locator('summary').click();
  await page.waitForTimeout(400);
  assert.equal(await d.evaluate((el) => el.open), true);
  await d.locator('summary').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  assert.equal(await d.evaluate((el) => el.open), false);
});

await test('gallery lightbox: open, next with arrow key, close with Escape, focus returns', async (page) => {
  await go(page, 'gallery.html');
  const first = page.locator('[data-lightbox]').first();
  await first.click();
  const dlg = page.locator('dialog.lightbox');
  assert.equal(await dlg.evaluate((el) => el.open), true);
  assert.match(await dlg.locator('.lightbox__count').textContent(), /^1 of 9$/);
  await page.keyboard.press('ArrowRight');
  assert.match(await dlg.locator('.lightbox__count').textContent(), /^2 of 9$/);
  assert.ok((await dlg.locator('.lightbox__img').getAttribute('alt')).length > 10);
  await page.keyboard.press('Escape');
  assert.equal(await dlg.evaluate((el) => el.open), false);
  assert.ok(await first.evaluate((el) => el === document.activeElement));
});

await test('itinerary progress fills and stops light up while scrolling', async (page) => {
  await go(page, 'trips/nathiagali-ayubia-weekend.html');
  await page.locator('#itinerary').scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 600); await page.waitForTimeout(500);
  const active = await page.locator('[data-itinerary-stop].is-active').count();
  assert.ok(active > 0, 'no active stops');
  const p = await page.locator('[data-itinerary-fill]').evaluate((el) => parseFloat(el.style.getPropertyValue('--progress')));
  assert.ok(p > 0);
});

/* ---------------- motion & no-JS ---------------- */
await test('reduced motion: content shows immediately, route drawn, itinerary complete', async (page) => {
  await go(page, '');
  const op = await page.locator('.hero__high').evaluate((el) => getComputedStyle(el).opacity);
  assert.equal(op, '1');
  assert.equal(await page.locator('[data-route]').evaluate((el) => el.classList.contains('is-drawn')), true);
  await go(page, 'trips/nathiagali-ayubia-weekend.html');
  assert.equal(await page.locator('[data-itinerary-stop]:not(.is-active)').count(), 0);
}, { reducedMotion: 'reduce' });

await test('without JavaScript: all content visible, filters hidden, form explains itself', async (page) => {
  await go(page, '');
  assert.equal(await page.locator('.hero__high').evaluate((el) => getComputedStyle(el).opacity), '1');
  assert.equal(await page.locator('.principle').first().evaluate((el) => getComputedStyle(el).opacity), '1');
  await go(page, 'trips.html');
  assert.equal(await page.locator('[data-filters]').isVisible(), false);
  assert.equal(await page.locator('.ticket').isVisible(), true);
  await go(page, 'booking.html');
  assert.equal(await page.locator('.form__noscript').isVisible(), true);
  await go(page, 'faq.html');
  await page.locator('details.faq summary').first().click();
  assert.equal(await page.locator('details.faq').first().evaluate((el) => el.open), true);
}, { javaScriptEnabled: false });

/* ---------------- forms (against the mock endpoint) ---------------- */
await test('booking form: client validation marks fields, focuses the first error', async (page) => {
  await go(page, 'trips/nathiagali-ayubia-weekend.html');
  await page.click('[data-submit]');
  assert.equal(await page.getAttribute('#trip-name', 'aria-invalid'), 'true');
  assert.ok(await page.locator('#trip-name').evaluate((el) => el === document.activeElement));
  assert.match(await page.textContent('#trip-phone-err'), /mobile number/);
  await page.fill('#trip-phone', '042 1234');
  await page.fill('#trip-notes', 'CNIC 35202-1234567-1');
  await page.click('[data-submit]');
  assert.match(await page.textContent('#trip-phone-err'), /valid mobile/);
  assert.match(await page.textContent('#trip-notes-err'), /CNIC/);
  assert.match(await page.textContent('[data-error-for="consent"]'), /Tick both/);
});

await test('booking form: saved request → success page with reference; one row in the test tab', async (page) => {
  await mock('/__reset'); await mock('/__behaviour/ok');
  const methods = [];
  page.on('request', (r) => { if (r.url().startsWith(MOCK)) methods.push(`${r.method()} ${r.headers()['content-type'] || ''}`); });
  await go(page, 'trips/nathiagali-ayubia-weekend.html');
  await fillBooking(page);
  await page.click('[data-submit]');
  await page.waitForURL(/booking-success\.html\?ref=REQ-/);
  await page.locator('[data-ref-card]:not([hidden])').waitFor();
  const ref = await page.textContent('[data-ref-value]');
  assert.match(ref, /^REQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.match(await page.textContent('h1'), /Request received/);
  assert.match(await page.textContent('[data-ref-trip]'), /Nathiagali and Ayubia weekend \(test submission\)/);
  const r = await rows();
  assert.equal(r['Registrations (Test)'].length, 2);
  assert.equal(r['Registrations (Test)'][1][1], ref);
  assert.ok(!methods.some((m) => m.startsWith('OPTIONS')), 'a CORS preflight was sent');
  assert.match(methods[0], /^POST text\/plain/);
});

await test('booking form: double click sends one request and saves one row', async (page) => {
  await mock('/__reset');
  let posts = 0;
  page.on('request', (r) => { if (r.url().startsWith(MOCK) && r.method() === 'POST') posts++; });
  await go(page, 'booking.html');
  await page.fill('#bk-name', 'Bilal Ahmed'); await page.fill('#bk-phone', '03111234567'); await page.fill('#bk-uni', 'UOL');
  await page.check('#register input[name="consentPrivacy"]'); await page.check('#register input[name="consentTerms"]');
  await page.waitForTimeout(2100);
  await page.locator('[data-submit]').dblclick();
  await page.waitForURL(/booking-success/);
  assert.equal(posts, 1);
  assert.equal((await rows())['Registrations (Test)'].length, 2);
});

await test('booking form: network failure → honest "couldn\'t confirm" state; retry reuses the reference', async (page) => {
  await mock('/__reset'); await mock('/__behaviour/down');
  await go(page, 'trips/nathiagali-ayubia-weekend.html');
  await fillBooking(page, { phone: '03221234567' });
  await page.click('[data-submit]');
  await page.locator('.form__status--pending h3').waitFor();
  assert.match(await page.textContent('[data-form-status]'), /couldn't confirm your request arrived/);
  assert.match(await page.textContent('[data-form-status]'), /may/);
  const ref1 = (await page.textContent('.status-ref')).replace('Reference ', '');
  assert.ok(await page.locator('[data-form-status]').evaluate((el) => el === document.activeElement), 'status not focused');
  await mock('/__behaviour/ok');
  await page.click('[data-submit]');
  await page.waitForURL(/booking-success/);
  await page.locator('[data-ref-card]:not([hidden])').waitFor();
  assert.equal(await page.textContent('[data-ref-value]'), ref1);
}, { allowNetErrors: true }); // the injected network failure is logged by the browser itself

await test('booking form: unreadable reply is not treated as success', async (page) => {
  await mock('/__reset'); await mock('/__behaviour/garbage');
  await go(page, 'booking.html');
  await page.fill('#bk-name', 'Sara Ali'); await page.fill('#bk-phone', '03331234567'); await page.fill('#bk-uni', 'UOL');
  await page.check('#register input[name="consentPrivacy"]'); await page.check('#register input[name="consentTerms"]');
  await page.waitForTimeout(2100);
  await page.click('[data-submit]');
  await page.locator('.form__status--pending h3').waitFor();
  assert.ok(!page.url().includes('booking-success'));
  await mock('/__behaviour/ok');
});

await test('booking form: server rejection for a trip not on the allowlist is shown', async (page) => {
  await mock('/__reset');
  await go(page, 'booking.html');
  await page.evaluate(() => { const o = document.querySelector('#bk-trip option'); o.value = 'not-a-real-trip'; });
  await page.fill('#bk-name', 'Hamza'); await page.fill('#bk-phone', '03451234567'); await page.fill('#bk-uni', 'UOL');
  await page.check('#register input[name="consentPrivacy"]'); await page.check('#register input[name="consentTerms"]');
  await page.waitForTimeout(2100);
  await page.click('[data-submit]');
  await page.locator('.form__status--error h3').waitFor();
  assert.match(await page.textContent('[data-form-status]'), /not open for registration/);
});

await test('contact form: validation then saved message', async (page) => {
  await mock('/__reset');
  await go(page, 'contact.html');
  await page.click('[data-submit]');
  assert.equal(await page.getAttribute('#ct-reply', 'aria-invalid'), 'true');
  await page.fill('#ct-name', 'Zainab'); await page.fill('#ct-reply', 'zainab@example.com');
  await page.fill('#ct-message', 'Can my society book a whole coach?');
  await page.check('input[name="consentPrivacy"]');
  await page.waitForTimeout(2100);
  await page.click('[data-submit]');
  await page.locator('.form__status--success').waitFor();
  assert.match(await page.textContent('[data-form-status]'), /Test message saved/);
  assert.equal((await rows())['Contact (Test)'].length, 2);
});

/* ---------------- layout ---------------- */
const PAGES = ['', 'trips.html', 'trips/nathiagali-ayubia-weekend.html', 'destinations.html', 'destinations/hunza.html', 'articles.html', 'articles/murree-vs-nathiagali.html', 'faq.html', 'gallery.html', 'booking.html', 'contact.html', 'about-us.html', 'our-approach.html', 'safety.html', 'credits.html', '404.html'];
for (const w of [320, 390, 768, 1024, 1440]) {
  await test(`no horizontal overflow at ${w}px on ${PAGES.length} pages`, async (page) => {
    const bad = [];
    for (const p of PAGES) {
      await go(page, p);
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (o > 0) bad.push(`${p || 'home'} (+${o}px)`);
    }
    assert.deepEqual(bad, []);
  }, { viewport: { width: w, height: 800 } });
}

await test('touch targets: primary buttons and nav controls are at least 44px tall', async (page) => {
  await go(page, 'trips/nathiagali-ayubia-weekend.html');
  const small = await page.evaluate(() => [...document.querySelectorAll('.btn, .chip, [data-menu-toggle], .faq__q, .choice span')]
    .filter((el) => el.offsetParent && el.getBoundingClientRect().height < 43.5).map((el) => el.className));
  assert.deepEqual(small, []);
}, { viewport: { width: 390, height: 844 } });

/* ---------------- automated accessibility scan (optional: npm install --no-save axe-core) ---------------- */
let axeSource = null;
try { const fs = await import('node:fs'); const { createRequire } = await import('node:module'); axeSource = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8'); } catch { console.log('  - axe-core not installed: accessibility scan skipped'); }
if (axeSource) {
  for (const p of PAGES.concat(['trips/nathiagali-ayubia-weekend.html#register'])) {
    await test(`accessibility (axe, WCAG 2.1 AA): ${p || 'home'}`, async (page) => {
      await go(page, p); await page.waitForTimeout(2800);
      await page.addScriptTag({ content: axeSource });
      const r = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      const bad = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
      assert.deepEqual(bad, []);
    });
  }
}

await browser.close();
console.log(`${passed} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
