# Testing report

Tested on 26 October 2026 with Node.js 22 and headless Chromium 153 (Playwright). "Passed" below means the test was actually run and passed; anything not run is listed separately.

## Automated tests you can re-run

| Command | What it checks | Result |
|---|---|---|
| `npm run test:whatsapp` | Number normalisation (`+92…`, `0092…`, `03…`), invalid numbers rejected, message wording, URL encoding, no personal data, length limits | 12/12 passed |
| `npm run test:apps-script` | The real `Code.gs`, run in Node with fake Google services: saving, server-side trip title, phone normalisation, test vs live tabs, `ACCEPTING`/`ALLOW_TEST`, trip allowlist, unexpected fields, every field's validation, CNIC in notes, formula-injection escaping, honeypot and too-fast submissions, duplicate references (cache and sheet), per-person and global rate limits, malformed and oversized requests, contact form, no-JavaScript HTML reply, notification email without notes, status endpoint | 20/20 passed |
| `npm run validate` | All JSON and Markdown content, image files, cross-references | Passed (10 articles, 805–1,065 words each) |
| `npm run build` | Content validation, 35 pages built, every internal link, anchor, image, `srcset`, script and stylesheet resolved | Passed |
| `npm run build:release` | Refuses to build while launch placeholders remain | Correctly fails (exit code 1) while the brand name etc. are placeholders |
| `npm run test:browser` | See below | 41/41 passed, twice in a row |

### Browser tests (`tests/browser.mjs`, real Chromium)

Run against a development build with the forms pointed at `npm run mock:forms` (which runs the real `Code.gs`).

- **Navigation:** mobile menu opens, moves focus in, traps Tab, closes on Escape, returns focus, makes the page behind inert; skip link is the first Tab stop and jumps to `#main`; focus outline visible.
- **Filters:** trips (status select, search, empty state, reset, URL sync), destinations (region chips with `aria-pressed`, search), journal (category from URL, search).
- **Interactions:** FAQ accordion by mouse and keyboard; gallery lightbox (open, arrow keys, counter, alt text, Escape, focus returns); itinerary progress line and active stops while scrolling.
- **Reduced motion:** content visible immediately, route drawn, itinerary complete.
- **JavaScript disabled:** all content visible (nothing stuck invisible), filters hidden, form shows its no-JS notice, FAQ still opens.
- **Booking form:** client validation (aria-invalid, focus on first error, phone, CNIC-in-notes, consent); saved request goes to the success page with the reference, and exactly one matching row appears in the test tab; the request is `POST` with `text/plain` and **no CORS preflight**; double-click sends one request and saves one row; network failure shows the honest "couldn't confirm" state, focuses it, and a retry reuses the same reference; an unreadable reply is not treated as success; a server rejection (trip not on allowlist) is shown.
- **Contact form:** validation, saved message, one row in the Contact test tab.
- **Layout:** no horizontal overflow on 16 pages at 320, 390, 768, 1024 and 1440 px widths.
- **Touch targets:** buttons, chips, menu toggle, FAQ rows and choice pills are at least 44 px tall at 390 px width.
- **Accessibility:** axe-core WCAG 2.1 A/AA scan of 17 pages: no serious or critical violations.
- **No console errors** on any page in any test.

### Additional checks run during the build of this project

- **Base path:** built with `siteUrl` `https://example.github.io/student-travel-site` and served under `/student-travel-site/`: all 35 pages loaded every asset with no failed requests; a missing deep URL returned the styled 404 page with links under the base path.
- **SEO output:** canonical tags, `og:image` and `sitemap.xml` (`noindex` pages excluded) correct for that URL; no `robots.txt` on a project site (by design); `BreadcrumbList` and `Article` JSON-LD present.
- **WhatsApp with a number configured:** digits-only `wa.me` links with the encoded trip title and ID, `rel="noopener noreferrer"`, floating button present except on booking and contact pages.
- **Forms switched off:** no network request; offline state offers a WhatsApp draft containing the reference and trip but **not** the name or phone number, and an email link.
- **Redirects:** an entry in `content/redirects.json` produced a working redirect page that passed the link check.
- **Image optimiser:** `npm run images:optimize` produced WebP files and a manifest entry.
- **Visual review:** screenshots of every page type at 1440 px and key pages at 390 px were reviewed, and the issues found were fixed (hero line overlap, route label crowding, footer ridge gap, menu header layering, reference wrapping, related-article grid, success page wording).

## Not verified, and how to verify

| Item | Why not | How to verify |
|---|---|---|
| **Real Google Apps Script deployment, end to end** | No Google account or deployment access in the build environment. The script logic and the browser flow were tested against a faithful local mock, but Google's real redirect and CORS headers were not exercised | docs/GOOGLE_SHEETS_SETUP.md, steps 4–7: run `selfTest`, deploy, submit from the live site in test mode, confirm the row and reference match |
| GitHub Actions workflow run | No access to a GitHub repository | Push to `main` and watch the Actions tab (docs/DEPLOYMENT.md) |
| Real WhatsApp app behaviour | No phone | Tap a WhatsApp button on Android and iPhone; check the draft text and that nothing sends until you press Send |
| Safari and Firefox | Only Chromium was available | Click through the site in Safari (iPhone) and Firefox. View transitions are Chromium-only and are simply skipped elsewhere |
| Screen readers | Automated checks only | Try VoiceOver (iPhone/Mac) or NVDA (Windows) on the menu, booking form and FAQ |
| Core Web Vitals on the live site | Needs a public URL | Run [PageSpeed Insights](https://pagespeed.web.dev/) on the homepage and a trip page |
| Facts in articles | Checked against the sources cited at the time of writing | Re-check anything marked "Check before you travel" before each season |

## Running the browser tests yourself

```bash
npm install --no-save playwright axe-core
npx playwright install chromium
npm run mock:forms                                      # terminal 1
FORMS_ENDPOINT=http://localhost:4174/exec npm run dev   # terminal 2
npm run test:browser                                    # terminal 3
```
