# Content guide

Everything you normally change is in `content/` (data and text) or `pages/` (hand-written pages). After any change, run `npm run build`. If something is wrong, the build stops and tells you the file, the item and the field.

## Trips (`content/trips.json`)

Each trip is one object in the list. Copy the existing trip to start a new one and change:

| Field | Meaning |
|---|---|
| `id` | Permanent ID, lowercase with hyphens, e.g. `swat-long-weekend-01`. Used by the form and the Google Sheet. Never reuse an old ID |
| `slug` | Page address: `trips/<slug>.html` |
| `destinationIds` | IDs from `destinations.json` |
| `heroImage`, `gallery` | Image keys from `images.json` |
| `duration` | `{ "days": 2, "nights": 1 }` |
| `price` | Either `"amount": 12500` or `"estimateMin"`/`"estimateMax"` with `"amount": null`. `"status"`: `estimate` or `confirmed` |
| `dates` | `"status": "proposed"` with `start`/`end` `null`, or `"confirmed"` with `YYYY-MM-DD` dates |
| `availability` | `interest`, `tentative`, `open`, `full`, `completed` or `cancelled` |
| `group` | Planned minimum and maximum group size |
| `inclusions` | `"status": "planned"` or `"confirmed"`, and the list |
| `itinerary` | Days, each with `stops` (`time`, `title`, `text`) |
| `route` | Stops for the elevation graphic: `name`, `km` from Lahore, `elevation` in metres |
| `transport`, `accommodation`, `meals` | `status` (`unconfirmed`/`confirmed`), `summary`, optional `details` |
| `packing`, `safety`, `bookingTerms`, `faqs` | Lists shown on the trip page |
| `relatedArticles` | Article slugs |
| `seo.title`, `seo.description` | Search result text (keep the description under about 155 characters) |
| `updated` | `YYYY-MM-DD` of your last change |

What each status shows to visitors:

| `availability` | Badge | Registration form |
|---|---|---|
| `interest` | Registering interest (outlined circle) | Shown |
| `tentative` | Tentative (dashed circle) | Shown |
| `open` | Booking open (filled circle). Requires confirmed dates and price | Shown, button says "Book a seat" |
| `full` | Fully booked (square) | Hidden |
| `completed` | Completed (tick) | Hidden |
| `cancelled` | Cancelled (cross) | Hidden |

After adding or closing a trip, copy the new `ALLOWED_TRIPS` line printed by `npm run build` into the Apps Script properties.

## Destinations (`content/destinations.json`)

Similar to trips. `operating` is `first-trip`, `planned` or `none` ("Guide only, no trips yet"); never mark a place as operated unless a trip is actually planned. `seasons.reviewed` is required: seasonal advice must show when it was last checked. Add `seasons.source` with a link where possible.

## Articles (`content/articles/<slug>.md`)

```markdown
---
title: How to plan a weekend in Swat
description: One or two sentences for cards and search results (under ~155 characters).
date: 2026-11-02
updated: 2026-11-10
reviewed: 2026-11-10
category: Destination guides
tags: Swat, Planning
author: editorial team
image: swat-valley
relatedTrips: galiyat-weekend-01
relatedDestinations: swat
featured: false
draft: false
---
Your article in Markdown.
```

- **Categories:** `Destination guides`, `Planning and budget`, `Safety and trust`, `Group travel`. To add one, edit `ARTICLE_CATEGORIES` in `scripts/lib/content.mjs`.
- `reviewed` adds a "Check before you travel… last reviewed" box at the top. Use it for anything seasonal or practical.
- `featured: true` puts the article at the top of the journal and homepage (only one at a time).
- `draft: true` hides it.
- **Reading time** is calculated automatically; the table of contents is built from `##` headings.

Markdown you can use:

| Write | Get |
|---|---|
| `## Heading` / `### Subheading` | Headings (with automatic contents list) |
| `**bold**`, `*italic*` | Bold, italic |
| `[text](https://example.com)` | External link (opens in a new tab) |
| `[text](/trips.html)` | Link to a page on this site. Start with `/`; the build makes it work on any address |
| `- item` / `1. item` | Lists |
| `- [ ] item` | Checklist |
| `> **Verify:** text` | "Check before you travel" box. Also `**Safety:**`, `**Note:**`, `**Tip:**` |
| `\| a \| b \|` rows | Table |

Raw HTML is not allowed in Markdown (it's shown as text). That's deliberate: it keeps pages safe.

**Accuracy rules for articles:** don't state current prices, journey times, road conditions, hotel availability or official rules as fact. Say they change, flag them with `> **Verify:**`, and link a source.

## Policy pages (`content/pages/*.md`)

Privacy, terms, cancellation and safety. Same Markdown, front matter needs only `title` and `description`. `{{brand}}` is replaced with your brand name. The site labels them as drafts until `policies.legalReviewed` is `true` in `site.json`.

## FAQs (`content/faqs.json`)

Groups of questions. `"home": true` also shows the question on the homepage. `"pending": true` labels the answer "Policy not final yet".

## Team, testimonials, gallery

- `content/team.json`: set `placeholder: false` once a member's details are real and approved.
- `content/testimonials.json`: real quotes only, from a trip marked `completed`, with a `consentRecord`. The build refuses testimonials without one. The testimonials page is hidden from search engines until there is at least one.
- `content/gallery.json`: image keys and captions.

## Images (`content/images.json`)

Every image used anywhere is listed here once, with its alt text, source and licence. The image credits page is generated from it.

### Replacing placeholder artwork with a photo

1. Put the original photo (at least 2400 px wide, ideally) in `assets/img/originals/`, named after its key, e.g. `nathiagali-ridge.jpg`.
2. `npm install` (once), then `npm run images:optimize`.
3. Paste the printed entry into `images.json` and replace every `TODO`: a real description as `alt`, the photographer or site as `source`, the licence (e.g. `CC BY-SA 4.0`, `Own photo`), and the credit line as `attribution` if the licence requires one.
4. Point the trip, destination, article or gallery item at the new key (or give the photo the old key and delete the old entry).
5. Build. The build stops if a photo is missing a source or licence, or still has `TODO` in it.

To use a photo in the homepage hero instead of the illustrated ridges, set `home.heroImage` in `site.json` to its key.

See docs/IMAGE_SOURCES.md for where to find licensed photos.

## Hand-written pages (`pages/*.html`)

The homepage, About, How we plan, Booking, Booking success and Contact. Each starts with a settings comment:

```html
<!--
title: About us
description: Search result description
nav: about
css: content
-->
```

Edit the HTML below it freely. Words in `{{double-braces}}` are filled in by the build (for example `{{root}}` for links, `{{upcoming-trips}}` for trip cards). Don't remove them unless you mean to remove that part of the page; an unknown one stops the build.

## Changing the theme

All colours, fonts, sizes and spacing are CSS variables in `css/design-tokens.css`. For example, to change the accent colour, change `--c-accent` (and `--c-accent-2`, its hover shade). Check new colour pairs for contrast (e.g. with the WebAIM contrast checker) and aim for at least 4.5:1 for text.

| Token | Used for |
|---|---|
| `--c-deodar` | Dark green sections, footer |
| `--c-pine` | Text and the darkest surfaces |
| `--c-limestone` / `--c-paper` | Page background / cards and forms |
| `--c-accent` | Buttons, highlights, focus outlines |
| `--f-sans`, `--f-serif` | Archivo (headings and interface), Newsreader (article text) |
| `--stretch-display` | How condensed headlines are (Archivo's width axis) |
| `--fs-*`, `--s-*` | Type sizes, spacing |

To change fonts, put the new `.woff2` files in `assets/fonts/`, update the `@font-face` rules at the top of `design-tokens.css`, and update `--f-sans`/`--f-serif` and the preload in `partials/head.html`.

## Motion

Animations live in `css/animations.css` and `js/animations.js`. Everything respects "reduce motion" settings, and content is never hidden if JavaScript fails (a fail-safe reveals it after 2.5 s). To add a reveal to a group of elements, put `data-reveal-group` on the container and `data-animate="rise"` on the children.
