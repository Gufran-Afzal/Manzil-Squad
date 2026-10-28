# Deploying to GitHub Pages (build locally, deploy from the branch)

Same workflow as the Portfolio site. There are no GitHub Actions: you build on your computer, commit the generated pages, push, and GitHub Pages serves the branch as it is.

## One-time setup

1. Create a GitHub repository and push this project to `main` (`git init`, `git add .`, `git commit`, `git remote add origin ...`, `git push -u origin main`).
2. Set `"siteUrl"` in `content/site.json` to the live address (e.g. `https://<user>.github.io/<repo>` or your custom domain). It fixes canonical tags, `sitemap.xml` and the styled 404 page.
3. **Settings -> Pages -> Build and deployment**: Source **Deploy from a branch**, Branch **`main`**, Folder **`/ (root)`**. Save.
4. The site is live about a minute after each push.

## Every update

```bash
npm run build        # regenerates the pages in the repo root + checks every internal link
git add -A && git commit -m "Update site" && git push
```

**Always run the build before committing.** The generated files (`index.html`, `trips.html`, `articles/`, `destinations/`, `trips/`, `css/site.css`, `js/`, `sitemap.xml`, `.build-manifest.json`) are committed; the build tracks them in `.build-manifest.json` so a rebuild only replaces its own output and removes pages you deleted. `assets/` (fonts, images) is used in place. Source folders (`content/`, `src/`, `scripts/`, `docs/`) are excluded from Jekyll by `_config.yml`, and `.nojekyll` stops Jekyll running at all.

## The base path (project sites)

A project site lives in a sub-folder: `https://user.github.io/student-travel-site/`. The site handles this automatically:

- Every link, image, stylesheet and script is **relative** (`./trips.html`, `../css/main.css`), so it works in any folder.
- `404.html` is the one exception (GitHub serves it at whatever address was requested), so its links use the base path taken from the site URL.
- The build refuses root-relative links like `/trips.html` elsewhere, because they'd break on a project site.

To check locally: `npm run build` then `npm run preview:base` and open http://localhost:4173/student-travel-site/. (For a repository with a different name, run `node scripts/serve.mjs --base /<repo-name>/`.)

## Custom domain

1. Buy a domain (e.g. from a `.pk` registrar or an international one).
2. In **Settings → Pages → Custom domain**, enter it (e.g. `www.yourbrand.pk`) and save.
3. At your domain provider, add the DNS records GitHub shows you: a `CNAME` record for `www` pointing to `<your-username>.github.io`, and for the bare domain the `A`/`AAAA` records listed in [GitHub's custom domain guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
4. Set `siteUrl` in `content/site.json` to `https://www.yourbrand.pk` and push.
5. With a custom domain the site is at the root, so the build also writes `robots.txt` pointing to the sitemap.

For a branch deploy, GitHub (or you) keeps a file named `CNAME` in the repository root containing just your domain (e.g. `www.yourbrand.pk`). The build never touches it.

## HTTPS

GitHub provides a free certificate. After DNS is working (can take up to a day), tick **Enforce HTTPS** in **Settings → Pages**. Always use `https://` in `siteUrl`.

## After each deployment: check it

1. Open the live site in a private window.
2. Click through the homepage, a trip page, the journal and the contact page.
3. Open a made-up address like `/student-travel-site/nothing-here` and check the styled 404 page appears.
4. View the page source of a trip page and check the `<link rel="canonical">` points to the live address.
5. Open `/sitemap.xml`.
6. If forms are in test or live mode, send a test registration (docs/GOOGLE_SHEETS_SETUP.md, step 7).

## Updating content

Edit the files, run `npm run build` locally to catch mistakes, commit and push. The site updates in about a minute. GitHub Pages caches pages for up to 10 minutes, so refresh with Ctrl+F5 (Cmd+Shift+R on a Mac) if you don't see the change. CSS and JavaScript files get a new `?v=` fingerprint on every change, so browsers never use an old version with new pages.

## If you rename pages

Old links would 404, and GitHub Pages can't do server redirects. Add the old and new addresses to `content/redirects.json`:

```json
"redirects": {
  "trips/old-trip-name.html": "trips/new-trip-name.html"
}
```

The build writes a small page at the old address that immediately sends visitors on, with a canonical link telling search engines about the new address. Also update internal links and resubmit the sitemap in Search Console.

## Troubleshooting

| Problem | Fix |
|---|---|
| Action fails at "Build" | Read the log: it names the file and field. Run `npm run build` locally to see the same message |
| Pages says "no index.html" or shows the README | **Folder** must be `/ (root)`, and the built pages must be committed (run `npm run build`) |
| Site has no styling, or images are missing | Pages is serving the repository root instead of the root, or `siteUrl` points to a different address than the one you're visiting |
| Changes don't appear | Wait a minute, check you committed and pushed the rebuilt pages, hard-refresh |
| Custom domain shows a certificate warning | Wait for the certificate (up to a day), then enable **Enforce HTTPS** |
| 404 page appears unstyled | `siteUrl` doesn't match the real address (its path is used as the base path) |
