/* art.mjs — build-time chart + divider helpers (the elevation profile and the angled section divider).
   No illustrations: all imagery is real photos (when added) or CSS motion tiles. */

const f = (n) => (Math.round(n * 10) / 10).toString();

/** Slanted divider at the bottom of page heroes and in the footer (a clean angled cut, no scenery). */
export function ridgeStrip(cls = '') {
  return `<svg class="ridge ${cls}" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 120L1000 28V120Z" fill="currentColor"/></svg>`;
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
