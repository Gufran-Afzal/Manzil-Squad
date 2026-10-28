/* ==================================================================
   art.mjs — the animated hero scene, generated at build time.

   One small inline SVG (≈8 KB, no image request) built from:
     sun + halo, 3 cloud banks, 5 ridge layers, 3 rows of pines,
     mist gradients, and the Lahore → Nathiagali route with a "bus".

   Everything that moves does so with transform/opacity only, and the
   route + counter are driven by one tiny timeline in js/app.js.
   Layers are <g class="l1..l5"> so scroll parallax is five transforms.
   ================================================================== */

// Small seeded PRNG so the artwork is identical on every build.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => (Math.round(n * 10) / 10).toString();

/** A jagged ridge line that is smoothed with quadratic curves, closed to the bottom edge. */
function ridge({ seed, base, amp, steps = 15, peaks = [], W = 1000, H = 640 }) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = (W / steps) * i;
    let y = base - amp * (0.25 + r() * 0.75) * (i % 2 ? 0.55 : 1);
    for (const p of peaks) y = Math.min(y, p.y + Math.abs(x - p.x) * (p.slope ?? 0.55));
    pts.push([x, y]);
  }
  let d = `M0 ${H}L${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    d += `Q${f(x0 + (x1 - x0) * 0.5)} ${f(Math.min(y0, y1) - 6)} ${f(x1)} ${f(y1)}`;
  }
  return d + `L${W} ${H}Z`;
}

/** Row of pine silhouettes (two stacked triangles each). */
function pines({ seed, y, count, size, jitter = 10, from = 0, to = 1000 }) {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = from + ((to - from) / count) * (i + r() * 0.9);
    const h = size * (0.7 + r() * 0.6);
    const w = h * 0.42;
    const yy = y + (r() - 0.5) * jitter;
    d += `M${f(x)} ${f(yy - h)}l${f(w / 2)} ${f(h * 0.62)}h${f(-w)}z`;
    d += `M${f(x)} ${f(yy - h * 0.7)}l${f(w * 0.75)} ${f(h * 0.7)}h${f(-w * 1.5)}z`;
  }
  return d;
}

const cloud = (cx, cy, s = 1) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${f(90 * s)}" ry="${f(16 * s)}"/><ellipse cx="${f(cx - 40 * s)}" cy="${f(cy + 8 * s)}" rx="${f(60 * s)}" ry="${f(14 * s)}"/><ellipse cx="${f(cx + 50 * s)}" cy="${f(cy + 10 * s)}" rx="${f(70 * s)}" ry="${f(13 * s)}"/>`;

/** The route the "bus" follows: Lahore (front, left) to the summit (back, right). */
export const HERO_ROUTE =
  'M300 616C330 596 372 606 398 580S452 548 470 520S520 478 548 452S604 408 628 374S662 332 668 304';

export function heroSvg() {
  const W = 1000, H = 640;
  // Four stacked SVGs instead of one: each is its own compositor layer, so scroll
  // parallax is pure GPU transforms and never re-rasterises the vector art.
  const svg = (cls, inner) => `<svg class="ly ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${inner}</svg>`;
  const defs = `<defs>
<radialGradient id="hg-sun"><stop offset="0" stop-color="#ffe3a8"/><stop offset=".55" stop-color="#ffc36a"/><stop offset="1" stop-color="#f2a93b"/></radialGradient>
<radialGradient id="hg-halo"><stop offset="0" stop-color="#ffcf86" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf86" stop-opacity="0"/></radialGradient>
<linearGradient id="hg-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f8d97"/><stop offset="1" stop-color="#4c6b73"/></linearGradient>
<linearGradient id="hg-m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46695f"/><stop offset="1" stop-color="#2f5147"/></linearGradient>
<linearGradient id="hg-m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c4e42"/><stop offset="1" stop-color="#1d382e"/></linearGradient>
<linearGradient id="hg-m3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a3329"/><stop offset="1" stop-color="#10241c"/></linearGradient>
<linearGradient id="hg-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0e4" stop-opacity="0"/><stop offset="1" stop-color="#cfe0e4" stop-opacity=".34"/></linearGradient>
</defs>`;
  const mist = (y, h) => `<rect y="${y}" width="${W}" height="${h}" fill="url(#hg-mist)"/>`;
  const back = defs
    + `<g class="sun"><circle cx="668" cy="250" r="190" fill="url(#hg-halo)"/><circle cx="668" cy="250" r="54" fill="url(#hg-sun)"/></g>`
    + `<g class="clouds" fill="#fff6e6"><g class="cloud c1" opacity=".16">${cloud(180, 120, 1.1)}</g><g class="cloud c2" opacity=".12">${cloud(760, 80, 0.9)}</g><g class="cloud c3" opacity=".14">${cloud(520, 175, 0.7)}</g></g>`
    + `<path d="${ridge({ seed: 11, base: 330, amp: 70, steps: 14, peaks: [{ x: 668, y: 296, slope: 0.62 }] })}" fill="url(#hg-far)"/>${mist(300, 80)}`;
  const mid = `<path d="${ridge({ seed: 23, base: 400, amp: 80, steps: 13 })}" fill="url(#hg-m1)"/><path d="${pines({ seed: 5, y: 420, count: 36, size: 22, jitter: 40 })}" fill="#2a4a3f" opacity=".7"/>${mist(372, 80)}`
    + `<path d="${ridge({ seed: 37, base: 470, amp: 80, steps: 12 })}" fill="url(#hg-m2)"/><path d="${pines({ seed: 9, y: 490, count: 44, size: 30, jitter: 36 })}" fill="#1c372c"/>${mist(440, 90)}`;
  const route = `<path class="route__base" d="${HERO_ROUTE}"/><path class="route__line" id="hero-route" d="${HERO_ROUTE}" pathLength="1"/><g class="pin" transform="translate(668 304)"><circle class="pin__ring" r="9"/><circle r="4.5" fill="#fff6e6"/></g><g class="bus" id="hero-bus" transform="translate(300 616)"><circle class="bus__ring" r="10"/><circle r="6" fill="#f2a93b" stroke="#fff6e6" stroke-width="2.5"/></g>`;
  const front = `<path d="${ridge({ seed: 51, base: 535, amp: 70, steps: 11 })}" fill="url(#hg-m3)"/><path d="${pines({ seed: 13, y: 560, count: 40, size: 42, jitter: 30 })}" fill="#10231b"/>`
    + `<path d="${ridge({ seed: 77, base: 605, amp: 40, steps: 10 })}" fill="#0a1812"/><path d="${pines({ seed: 21, y: 626, count: 34, size: 62, jitter: 20 })}" fill="#0a1812"/>`;
  return `<div class="hero__scene" aria-hidden="true">${svg('ly-back', back)}${svg('ly-mid', mid)}${svg('ly-front', front)}${svg('ly-route', route)}</div>`;
}

/** Tiny decorative ridge strip used at the bottom of page heroes and in the footer. */
export function ridgeStrip(cls = '') {
  // straight segments (not curves) so the strip reads as mountains rather than clouds
  const r = rng(3);
  let d = 'M0 120';
  for (let i = 0; i <= 22; i++) d += `L${f((1000 / 22) * i)} ${f(110 - (i % 2 ? 22 + r() * 22 : 52 + r() * 40))}`;
  return `<svg class="ridge ${cls}" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${d}L1000 120Z" fill="currentColor"/></svg>`;
}

/** Smooth elevation profile (Catmull-Rom → cubic Bézier) with a known y-scale for the scroll scene. */
export function climbChart(route, { W = 1000, H = 360, padX = 40, padTop = 60, padBottom = 40 } = {}) {
  const minE = Math.min(...route.map((s) => s.elevation));
  const maxE = Math.max(...route.map((s) => s.elevation));
  const maxKm = Math.max(...route.map((s) => s.km)) || 1;
  // x by distance, but keep the last stops from piling up: blend distance with equal spacing.
  const pts = route.map((s, i) => {
    const eq = i / (route.length - 1);
    const t = 0.55 * (s.km / maxKm) + 0.45 * eq;
    return { ...s, x: padX + t * (W - padX * 2), y: padTop + (1 - (s.elevation - minE) / (maxE - minE || 1)) * (H - padTop - padBottom) };
  });
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  const last = pts[pts.length - 1];
  const area = `${d}L${f(last.x)} ${H}L${f(pts[0].x)} ${H}Z`;
  return { d, area, pts, W, H, minE, maxE, yTop: padTop, yBottom: H - padBottom };
}
