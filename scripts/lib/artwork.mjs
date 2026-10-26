/* ==================================================================
   artwork.mjs — deterministic landscape artwork (pure JS, no deps)

   Produces layered ridgeline SVGs that stand in for photography until
   real, licensed photos are added (see content/images.json). The same
   seed always produces the same picture, so builds are repeatable.

   Used by:
   - build.mjs              → the inline, parallax-layered home hero
   - scripts/generate-artwork.mjs → raster WebP placeholders (needs sharp)
   ================================================================== */

export function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n) => Math.round(n * 10) / 10;

function mix(a, b, t) {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** 1-D midpoint displacement: returns `n+1` heights (0..1 range-ish). */
function ridge(rand, n, roughness, amp) {
  const h = new Array(n + 1).fill(0);
  h[0] = rand(); h[n] = rand();
  let step = n, a = amp;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < n; i += step) h[i] = (h[i - half] + h[i + half]) / 2 + (rand() - 0.5) * a;
    a *= roughness; step = half;
  }
  return h;
}

/** Ridge as an array of [x,y] points across the full width. */
function ridgePoints({ rand, W, base, height, roughness = 0.55, n = 128, peak = null }) {
  const h = ridge(rand, n, roughness, 1);
  const min = Math.min(...h), max = Math.max(...h);
  return h.map((v, i) => {
    let t = (v - min) / (max - min || 1);
    const x = (i / n) * W;
    if (peak) { // lift the ridge around a chosen peak position
      const d = (x / W - peak.at) / peak.spread;
      t = t * 0.65 + Math.exp(-d * d) * 0.6;
    }
    return [x, base - t * height];
  });
}

const toPath = (pts, W, H) => `M0 ${H} L${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L')} L${W} ${H} Z`;

/** Pine silhouettes standing on a ridge (Galiyat's deodar/blue-pine forest). */
function pines(rand, pts, { density = 0.5, size = 26, W }) {
  let d = '';
  const step = W / pts.length;
  for (let i = 0; i < pts.length - 1; i++) {
    if (rand() > density) continue;
    const [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1];
    const t = rand(); const x = x0 + (x1 - x0) * t; const y = y0 + (y1 - y0) * t + 4;
    const h = size * (0.6 + rand() * 0.8); const w = h * 0.34;
    // three stacked tiers + trunk, as one polygon
    d += `M${r1(x)} ${r1(y - h)}L${r1(x + w * 0.55)} ${r1(y - h * 0.62)}L${r1(x + w * 0.3)} ${r1(y - h * 0.62)}L${r1(x + w * 0.8)} ${r1(y - h * 0.3)}L${r1(x + w * 0.4)} ${r1(y - h * 0.3)}L${r1(x + w)} ${r1(y)}L${r1(x - w)} ${r1(y)}L${r1(x - w * 0.4)} ${r1(y - h * 0.3)}L${r1(x - w * 0.8)} ${r1(y - h * 0.3)}L${r1(x - w * 0.3)} ${r1(y - h * 0.62)}L${r1(x - w * 0.55)} ${r1(y - h * 0.62)}Z`;
    if (step < 2) i++;
  }
  return d;
}

/** Thin vertical poplars (Hunza / Swat valley floors). */
function poplars(rand, pts, { density = 0.3, size = 40 }) {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    if (rand() > density) continue;
    const [x, y] = pts[i]; const h = size * (0.6 + rand() * 0.7); const w = h * 0.12;
    d += `M${r1(x)} ${r1(y - h)}Q${r1(x + w)} ${r1(y - h * 0.5)} ${r1(x + w * 0.4)} ${r1(y)}L${r1(x - w * 0.4)} ${r1(y)}Q${r1(x - w)} ${r1(y - h * 0.5)} ${r1(x)} ${r1(y - h)}Z`;
  }
  return d;
}

/* ---------------- palettes ("scenes") ---------------- */
export const SCENES = {
  galiyat:  { sky: ['#d9e1dd', '#9fb2b6'], sun: '#f3d7a1', haze: '#a9b9ba', far: '#7f97a0', near: '#18301f', layers: 6, pines: [4, 5], seed: 7 },
  ayubia:   { sky: ['#cfdad3', '#8ea79f'], sun: '#efe1bb', haze: '#9fb3a8', far: '#6f8c86', near: '#132a1c', layers: 6, pines: [3, 4, 5], seed: 31 },
  murree:   { sky: ['#f0c98f', '#9d8a8f'], sun: '#ffe2a8', haze: '#c4a596', far: '#8a7680', near: '#1d1f24', layers: 5, pines: [3, 4], seed: 12 },
  swat:     { sky: ['#dce6e3', '#a8c0c2'], sun: '#f5e6be', haze: '#a4bcb3', far: '#76968f', near: '#1c3527', layers: 5, river: true, poplars: [4], seed: 44 },
  naran:    { sky: ['#e6eef2', '#9fb7c6'], sun: '#ffffff', haze: '#b6c8d2', far: '#7d93a4', near: '#22343b', layers: 4, snow: [0, 1], lake: true, pines: [3], seed: 58 },
  hunza:    { sky: ['#f1e2c6', '#a8b8c4'], sun: '#fff1d0', haze: '#c9c0b0', far: '#8b8a8c', near: '#3b3127', layers: 4, snow: [0, 1], jagged: true, poplars: [3], seed: 73 },
  winter:   { sky: ['#e9eef0', '#b8c6cc'], sun: '#ffffff', haze: '#c9d4d8', far: '#9aabb3', near: '#2c3a3c', layers: 5, snow: [0, 1, 2, 3], pines: [3, 4], seed: 91 },
  monsoon:  { sky: ['#b9c4c2', '#6f8582'], sun: '#dfe5dc', haze: '#93a5a1', far: '#5f7772', near: '#10251a', layers: 6, pines: [3, 4, 5], fog: true, seed: 103 },
  dusk:     { sky: ['#f2b97a', '#5b5f78'], sun: '#ffd9a0', haze: '#b28f8a', far: '#6d6577', near: '#141820', layers: 5, pines: [3, 4], seed: 121 },
};

/**
 * Build a full scene SVG string.
 * opts.layered → wrap each ridge in <g data-depth="n"> for parallax (hero use).
 */
export function sceneSvg(name, { W = 1600, H = 900, seed, layered = false, title = '' } = {}) {
  const sc = SCENES[name];
  if (!sc) throw new Error(`Unknown scene "${name}"`);
  const rand = rng(seed ?? sc.seed);
  const id = `s${name}${seed ?? sc.seed}`;
  const parts = [];
  const n = sc.layers;
  const sunX = W * (0.62 + rand() * 0.2), sunY = H * 0.28;

  parts.push(`<defs>
<linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.sky[1]}"/><stop offset=".75" stop-color="${sc.sky[0]}"/></linearGradient>
<radialGradient id="${id}sun" cx="${r1(sunX / W)}" cy="${r1(sunY / H)}" r=".45"><stop offset="0" stop-color="${sc.sun}" stop-opacity=".9"/><stop offset="1" stop-color="${sc.sun}" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.haze}" stop-opacity="0"/><stop offset="1" stop-color="${sc.haze}" stop-opacity=".55"/></linearGradient>
</defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#${id}sky)"/><rect width="${W}" height="${H}" fill="url(#${id}sun)"/>`);

  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);              // 0 = farthest, 1 = nearest
    const color = mix(sc.far, sc.near, Math.pow(t, 1.35));
    const base = H * (0.46 + t * 0.5);
    const height = H * (sc.jagged && i < 2 ? 0.42 : 0.2 + (1 - t) * 0.16);
    const pts = ridgePoints({
      rand, W, base, height,
      roughness: sc.jagged && i < 2 ? 0.62 : 0.5 + t * 0.06,
      n: 128,
      peak: i === 0 ? { at: 0.25 + rand() * 0.5, spread: 0.18 } : null,
    });
    let g = `<path d="${toPath(pts, W, H)}" fill="${color}"/>`;

    if (sc.snow && sc.snow.includes(i)) {
      const cid = `${id}c${i}`;
      const top = Math.min(...pts.map((q) => q[1]));
      const sl = ridgePoints({ rand, W, base: top + height * 0.42, height: height * 0.22, roughness: 0.75, n: 64 });
      g += `<clipPath id="${cid}"><path d="${toPath(pts, W, H)}"/></clipPath><path clip-path="url(#${cid})" d="M0 0 L${sl.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L')} L${W} 0 Z" fill="${mix('#ffffff', color, 0.12 + t * 0.2)}"/>`;
    }
    if (sc.pines && sc.pines.includes(i)) {
      g += `<path d="${pines(rand, pts, { W, density: 0.35 + t * 0.4, size: 12 + t * 46 })}" fill="${color}"/>`;
    }
    if (sc.poplars && sc.poplars.includes(i)) {
      g += `<path d="${poplars(rand, pts, { density: 0.25, size: 30 + t * 40 })}" fill="${mix(color, '#000000', 0.15)}"/>`;
    }
    // mist between layers: atmospheric perspective
    if (i < n - 1) g += `<rect y="${r1(base - height * 1.1)}" width="${W}" height="${r1(height * 1.4)}" fill="url(#${id}mist)" opacity="${sc.fog ? 0.95 : 0.6}"/>`;

    if (i === n - 2 && sc.lake) {
      const ly = H * 0.8;
      g += `<rect y="${r1(ly)}" width="${W}" height="${r1(H - ly)}" fill="${mix(sc.sky[0], sc.far, 0.55)}"/>`
        + `<g transform="translate(0 ${r1(ly * 2)}) scale(1 -1)" opacity=".18"><path d="${toPath(pts, W, H)}" fill="${color}"/></g>`
        + `<path d="M0 ${r1(ly + 2)}H${W}" stroke="#ffffff" stroke-opacity=".5" stroke-width="2"/>`;
    }
    if (i === n - 2 && sc.river) {
      const ry = H * 0.86; let d = `M${-20} ${r1(ry)}`;
      for (let k = 1; k <= 8; k++) d += ` Q${r1(W * (k - 0.5) / 8)} ${r1(ry + (rand() - 0.5) * 50)} ${r1(W * k / 8)} ${r1(ry + (rand() - 0.5) * 20)}`;
      g += `<path d="${d}" fill="none" stroke="${mix(sc.sky[0], '#ffffff', 0.4)}" stroke-width="${r1(H * 0.018)}" stroke-linecap="round" opacity=".85"/>`;
    }
    parts.push(layered ? `<g class="hero-art__layer" data-depth="${i}">${g}</g>` : g);
  }

  const label = title ? `<title>${title.replace(/[<&]/g, '')}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"${title ? ' role="img"' : ' aria-hidden="true" focusable="false"'}>${label}${parts.join('')}</svg>`;
}

/**
 * Elevation-profile path for the route graphic. stops: [{name, km, elevation}]
 * Returns path data + stop coordinates inside a W×H box.
 */
export function elevationProfile(stops, { W = 1000, H = 260, pad = 30 } = {}) {
  const maxKm = Math.max(...stops.map((s) => s.km));
  const maxEl = Math.max(...stops.map((s) => s.elevation)) * 1.12;
  // x blends real distance with even spacing: the climb happens in the last
  // few dozen kilometres, and pure distance would pile the hill stops on top
  // of each other. The caption says the horizontal axis is not to scale.
  const pt = (s, i) => {
    const t = 0.45 * (s.km / maxKm) + 0.55 * (i / (stops.length - 1));
    return [pad + t * (W - pad * 2), H - pad - (s.elevation / maxEl) * (H - pad * 2)];
  };
  const pts = stops.map(pt);
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${r1(cx)} ${r1(y0)} ${r1(cx)} ${r1(y1)} ${r1(x1)} ${r1(y1)}`;
  }
  const area = `${d} L${r1(pts[pts.length - 1][0])} ${H - pad} L${r1(pts[0][0])} ${H - pad} Z`;
  return { d, area, points: pts.map(([x, y], i) => ({ x: r1(x), y: r1(y), ...stops[i] })) };
}
