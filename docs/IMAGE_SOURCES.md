# Finding and crediting photographs

The site uses **no illustrations**. Every image slot without a photo shows an animated CSS motion-graphic tile (big outlined place name over drifting coloured light), and the homepage hero is a motion-graphics scene. Nothing to download, nothing to credit. When you have real photos, they replace the tiles automatically.

## Turning a tile into a photo

1. Put the original in `assets/img/originals/` and run `npm run images:optimize` (or export WebP files named `<name>-480.webp`, `-960.webp`, `-1600.webp` into `assets/img/`).
2. In `content/images.json`, change that image's entry from `"kind": "motion"` to `"kind": "photo"` and fill `src` (e.g. `assets/img/ayubia-trail`), `widths`, `width`, `height`, `alt`, `source`, `licence` and `attribution`.
3. Optional: set `home.heroImage` in `content/site.json` to a photo key to put it behind the hero animation.
4. `npm run build`. The Image credits page lists every real photo automatically.

## Best options, in order

1. **Your own photos.** Take them on a recce trip or your first trip. You own them, and they show what you actually offer. Get written permission from anyone recognisable before publishing.
2. **A local photographer.** Commission or license photos of Nathiagali, Ayubia and the Galiyat. Get the licence in writing (what you may use, where, for how long, and how to credit them).
3. **Wikimedia Commons.** Many photos of northern Pakistan are under Creative Commons licences. Good starting points (open them and browse; check each file's own licence):
   - https://commons.wikimedia.org/wiki/Category:Nathia_Gali
   - https://commons.wikimedia.org/wiki/Category:Ayubia_National_Park
   - https://commons.wikimedia.org/wiki/Category:Murree
   - https://commons.wikimedia.org/wiki/Category:Swat_District
   - https://commons.wikimedia.org/wiki/Category:Lake_Saiful_Muluk
   - https://commons.wikimedia.org/wiki/Category:Hunza_Valley

   (These category pages couldn't be opened from the environment this site was built in, so specific files haven't been pre-selected. If a category name has changed, search Commons for the place name.)
4. **Free stock sites** (Unsplash, Pexels). Read each site's current licence; check the photo really shows the place it claims to, and avoid photos with recognisable people unless model releases are clear.

## Checking a licence (Wikimedia Commons)

On the file's page, scroll to **Licensing**:

| Licence | Can you use it? | What you must do |
|---|---|---|
| Public domain / CC0 | Yes | Credit is appreciated, not required |
| CC BY | Yes | Credit the author, link the licence, say if you changed it (e.g. cropped) |
| CC BY-SA | Yes | As CC BY, and if you publish a modified version of the image, it must use the same licence |
| Anything with **NC** (non-commercial) | **No** for a business website | |
| Anything with **ND** (no derivatives) | Only uncropped and unaltered; resizing is usually fine, cropping is not | |

Commons shows a ready-made credit line under **"Use this file"**. Copy it into the image's `attribution` field.

## Adding the photo

Follow docs/CONTENT_GUIDE.md → "Images". In short: original into `assets/img/originals/`, run `npm run images:optimize`, paste the entry into `content/images.json`, fill in `alt`, `source` (link to the file page), `licence` and `attribution`. The **Image credits** page (`credits.html`, linked in the footer) lists every image with its source and licence automatically, which satisfies the attribution requirement of CC licences.

## Good alt text

Describe what's in the picture as it matters to the page: "Deodar forest along the Pipeline Track near Ayubia, with a group of walkers", not "image of trees" and not a list of keywords.

## Do not

- Hotlink images from other websites (they break, and it uses their bandwidth).
- Use photos from Google Images, Instagram or other tour operators without written permission.
- Present a photo of somewhere else, or a stock photo, as a picture from your own trip.
- Create or use images of "customers" who didn't travel with you.
