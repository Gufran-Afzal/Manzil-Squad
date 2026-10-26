/* config.js — reads the small public config the build embeds in each
   page (<script type="application/json" id="site-config">). It only
   contains public values: never put secrets in content/site.json. */
let cached = null;
export function getConfig() {
  if (cached) return cached;
  try {
    const el = document.getElementById('site-config');
    cached = el ? JSON.parse(el.textContent) : {};
  } catch {
    cached = {};
  }
  cached.forms = cached.forms || { mode: 'off', endpoint: '' };
  return cached;
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
