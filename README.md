# Manzil-Squad v2 — motion-graphics travel site

Static site, zero runtime dependencies. Same workflow as the Portfolio site: **build locally, commit the generated pages, push; GitHub Pages serves the branch** (Settings → Pages → Deploy from a branch → `main` → `/ (root)`). No GitHub Actions.

```
npm run build      # content -> generated pages in the repo root (commit them)
npm run dev        # dev build + local preview
npm test           # unit tests + build + internal link check
npm run validate   # content checks / launch checklist
```

## Structure
- `docs/` — setup and content guides (not part of the site).
- `content/` — all copy and data (JSON + markdown). Edit here, never in HTML.
- `scripts/build.mjs` — orchestrator. `scripts/templates/` — `layout.mjs` (shell), `pages.mjs` (every page), `art.mjs` (hero SVG, elevation chart). `scripts/lib/` — content loading, markdown, components, link checker, sitemap.
- `src/css/` — 3 files, concatenated + minified into one `site.css`.
- `src/js/app.js` — one deferred script (scroll hub, hero timeline, climb scene, menu). `forms.js` and its modules load on demand, only on pages with forms.
- `assets/` — one variable font (60 KB), icons, images.

## Motion rules (why it stays fast on phones)
- Only `transform` / `opacity` animate (plus `stroke-dashoffset` on two paths).
- One passive scroll listener + one rAF loop for everything.
- Infinite loops only run while on screen (IntersectionObserver).
- `lite` mode (reduced-motion, Save-Data, <=2 cores or <=2 GB RAM) turns off parallax and loops.
- Without JS the page is fully readable; a 4.5 s failsafe reveals content if the script never runs.

Setup items still to fill in are printed by `npm run build` (brand name, contact details, real photos, legal review).
