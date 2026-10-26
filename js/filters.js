/* ==================================================================
   filters.js — search, chips and select filters for listing pages
   (generalised from the Portfolio project's filters.js)

   Markup contract
   - items:   [data-filter-grid] > [data-item] with data-search,
              data-category and any facet data attributes
   - chips:   button[data-filter="value"] filter on data-category
   - selects: select[data-facet="name"] filter on data-name (items may
              hold several space-separated values, e.g. two destinations)
   - search:  input[data-filter-search]
   Progressive enhancement: without JS every item is visible. The state
   is mirrored in the URL (?q=…&destination=…) so views can be shared.
   ================================================================== */
export function init() {
  const grid = document.querySelector('[data-filter-grid]');
  if (!grid) return;
  const items = [...grid.querySelectorAll('[data-item]')];
  const chips = [...document.querySelectorAll('[data-filter]')];
  const selects = [...document.querySelectorAll('[data-facet]')];
  const search = document.querySelector('[data-filter-search]');
  const status = document.querySelector('[data-filter-status]');
  const empty = document.querySelector('[data-filter-empty]');
  const resets = document.querySelectorAll('[data-filter-reset]');
  const noun = status?.getAttribute('data-noun') || 'items';

  const state = { category: 'all', q: '', facets: {} };
  const validCats = new Set(chips.map((c) => c.getAttribute('data-filter')));
  const params = new URLSearchParams(location.search);
  if (validCats.has(params.get('category'))) state.category = params.get('category');
  state.q = (params.get('q') || '').trim().toLowerCase().slice(0, 80);
  if (search) search.value = params.get('q') || '';
  selects.forEach((s) => {
    const k = s.getAttribute('data-facet'); const v = params.get(k);
    if (v && [...s.options].some((o) => o.value === v)) s.value = v;
    state.facets[k] = s.value;
  });

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.category !== 'all') p.set('category', state.category);
    if (state.q) p.set('q', state.q);
    Object.entries(state.facets).forEach(([k, v]) => { if (v && v !== 'all') p.set(k, v); });
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }

  function apply(animate) {
    let shown = 0;
    const words = state.q.split(/\s+/).filter(Boolean);
    items.forEach((el) => {
      const hay = el.getAttribute('data-search') || el.textContent.toLowerCase();
      const catOk = state.category === 'all' || el.getAttribute('data-category') === state.category;
      const qOk = words.every((w) => hay.includes(w));
      const facetOk = Object.entries(state.facets).every(([k, v]) => v === 'all' || (el.getAttribute(`data-${k}`) || '').split(' ').includes(v));
      const match = catOk && qOk && facetOk;
      const wasHidden = el.hidden;
      el.hidden = !match;
      if (match) {
        shown++;
        if (animate && wasHidden) {
          el.classList.add('is-entering');
          el.addEventListener('animationend', () => el.classList.remove('is-entering'), { once: true });
        }
      }
    });
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === state.category)));
    const word = (n) => (n === 1 ? (status?.getAttribute('data-noun-one') || noun.replace(/s$/, '')) : noun);
    if (status) status.textContent = shown === items.length ? (items.length === 1 ? `Showing 1 ${word(1)}` : `Showing all ${items.length} ${noun}`) : `Showing ${shown} of ${items.length} ${word(items.length)}`;
    if (empty) empty.hidden = shown !== 0;
  }

  chips.forEach((c) => c.addEventListener('click', () => { state.category = c.getAttribute('data-filter'); apply(true); syncUrl(); }));
  selects.forEach((s) => s.addEventListener('change', () => { state.facets[s.getAttribute('data-facet')] = s.value; apply(true); syncUrl(); }));
  if (search) {
    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = search.value.trim().toLowerCase().slice(0, 80); apply(true); syncUrl(); }, 140);
    });
  }
  resets.forEach((b) => b.addEventListener('click', () => {
    state.category = 'all'; state.q = '';
    if (search) search.value = '';
    selects.forEach((s) => { s.value = 'all'; state.facets[s.getAttribute('data-facet')] = 'all'; });
    apply(true); syncUrl();
    (search || chips[0] || selects[0])?.focus();
  }));
  apply(false);
}
