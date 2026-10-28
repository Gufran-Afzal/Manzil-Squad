# Deploying to GitHub Pages

The site is built by GitHub Actions (`.github/workflows/deploy.yml`) every time you push to `main`, and published from the build output (`dist/`). GitHub Pages is free for public repositories.

## One-time setup

1. **Create a repository** on GitHub, e.g. `student-travel-site`. Public repositories get free Pages hosting.
2. **Push this project** to its `main` branch:

   ```bash
   git init
   git add .
   git commit -m "First version of the travel site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/student-travel-site.git
   git push -u origin main
   ```

3. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. (Not "Deploy from a branch": that would publish the source files instead of the built site.)
4. Open the **Actions** tab. The "Build and deploy to GitHub Pages" run should start (if it didn't, click **Run workflow**). It takes about a minute.
5. When it's green, your site is at `https://<your-username>.github.io/student-travel-site/`. The link also appears in **Settings → Pages**.

## What the workflow does

| Step | Detail |
|---|---|
| Node.js | Version 22 (the site needs 20 or newer) |
| Dependencies | None to install: the website has no runtime dependencies |
| Tests | WhatsApp link tests and Apps Script logic tests |
| Build | `node scripts/build.mjs`: validates content, builds `dist/`, checks every internal link and asset. Any problem fails the run and nothing is published |
| Site URL | If `siteUrl` in `content/site.json` is empty, GitHub's Pages URL is used, so canonical tags and `sitemap.xml` are always correct |
| Publish | Uploads `dist/` and deploys it |

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

GitHub Actions deployments don't need a `CNAME` file in the repository; the setting in **Settings → Pages** is enough.

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
| "Get Pages site failed" in configure-pages | **Settings → Pages → Source** must be **GitHub Actions** |
| Deploy step says permissions are missing | Don't remove the `permissions:` block in the workflow; check **Settings → Actions → General → Workflow permissions** allows the workflow to run |
| Site has no styling, or images are missing | You're viewing the source files (Source set to "Deploy from a branch"), or `siteUrl` points to a different address than the one you're visiting |
| Changes don't appear | Wait a minute, check the Actions run is green, hard-refresh |
| Custom domain shows a certificate warning | Wait for the certificate (up to a day), then enable **Enforce HTTPS** |
| 404 page appears unstyled | `siteUrl` doesn't match the real address (its path is used as the base path) |
