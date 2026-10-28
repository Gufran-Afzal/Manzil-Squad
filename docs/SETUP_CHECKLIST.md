# Setup checklist: every placeholder to replace

`npm run validate` (or any build) prints what is still unfinished. `npm run build:release` refuses to build while the essential items below remain. Development builds (`npm run dev`) also show a "Setup" panel on every page.

Nothing below should be filled in with a guess. If you don't have the real value yet, leave the placeholder: the site hides or labels unfinished items instead of inventing them.

## Required before launch

| # | Where | What | Notes |
|---|---|---|---|
| 1 | `content/site.json` → `brand.name`, `brand.shortName` | Your brand name | Currently `[Brand Name]`. Used in the header, footer, titles, policies and structured data |
| 2 | `content/site.json` → `brand.tagline`, `brand.description` | Your own wording | The current text is a neutral suggestion |
| 3 | `content/site.json` → `siteUrl` | e.g. `https://yourname.github.io/student-travel-site` or `https://www.yourdomain.pk` | No trailing slash. Needed for canonical tags, social previews and `sitemap.xml`. GitHub Actions fills it in automatically if left empty |
| 4 | `content/site.json` → `contact.whatsapp`, `contact.phoneDisplay` | WhatsApp Business number, digits only (`923001234567`) | See docs/WHATSAPP_SETUP.md |
| 5 | `content/site.json` → `contact.email` | A business email address | Shown in the footer and contact page; used as a fallback in forms |
| 6 | `content/site.json` → `socials.instagram` / `facebook` / `tiktok` | Full profile URLs | Leave empty to hide |
| 7 | `content/site.json` → `forms` | Apps Script URL; `mode` `test` → `live` | See docs/GOOGLE_SHEETS_SETUP.md |
| 8 | `content/pages/*.md` | Everything in `[square brackets]` in the privacy policy, terms, cancellation policy and safety page | Then get the policies **reviewed by a qualified professional in Pakistan** before accepting any payment, and set `policies.legalReviewed` to `true` and `policies.lastUpdated` |
| 9 | `content/team.json` | Founders' names, roles, short bios and photos | Only details each person has approved. Set `placeholder: false` |
| 10 | `pages/index.html`, `pages/our-approach.html`, `content/pages/safety.md` | The commitments ("coordinators travel with every group", "separate rooms", supplier checks) | Delete or reword any commitment you can't keep. Visitors will hold you to them |

## Before the first trip is confirmed

| # | Where | What |
|---|---|---|
| 11 | `content/trips.json` → `dates` | Real dates, then `"status": "confirmed"` |
| 12 | `content/trips.json` → `price` | Final price: `"amount": 12500, "status": "confirmed"` |
| 13 | `content/trips.json` → `transport`, `accommodation`, `meals` | Named suppliers and details, then `"status": "confirmed"` |
| 14 | `content/trips.json` → `availability` | `interest` → `tentative` → `open` (the build only allows `open` when dates and price are confirmed) |
| 15 | `content/trips.json` → `itinerary` | Real timings and stops |
| 16 | `content/faqs.json` | Answers marked `"pending": true` (payment methods, cancellations, postponement) once decided |
| 17 | `content/site.json` → `contact.responseTime` | Only if you can keep it, e.g. "within a day" |

## When you have them

| # | Where | What |
|---|---|---|
| 18 | `content/site.json` → `operator` | Registration authority and number (and insurance, if any). Set `verified: true` only when you can show the certificate. Until then nothing is claimed |
| 19 | `content/images.json` | Optional: swap animated tiles for licensed photos (docs/IMAGE_SOURCES.md) |
| 20 | `content/images.json` → `og-default` | A 1200×630 social-sharing image with your logo |
| 21 | `assets/icons/favicon.svg`, the mark in `scripts/lib/components.mjs` (`icon.mark`) | Your logo, once designed. The current ridge mark is a neutral placeholder |
| 22 | `content/testimonials.json` | Real participant quotes with written consent, after a completed trip |
| 23 | `content/gallery.json` | Photos from real trips (with participants' permission) |
| 24 | `content/site.json` → `analytics` | Optional. Update the privacy policy first |

## Apps Script properties (in Google, not in this project)

`ALLOWED_TRIPS`, `ACCEPTING`, `ALLOW_TEST`, `SITE_URL`, optional `NOTIFY_EMAIL`. See docs/GOOGLE_SHEETS_SETUP.md, step 3.
