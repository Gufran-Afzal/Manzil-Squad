/* elevation.mjs — path data for the route's elevation-profile chart (a data graphic, not an illustration). */
const r1 = (n) => Math.round(n * 10) / 10;

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
