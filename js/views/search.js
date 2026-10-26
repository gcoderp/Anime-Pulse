/* ============================================================================
   ANIPULSE — views/search.js
   Search results page + instant search overlay
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el } = U;
  const I = AP.ICONS;
  const S = AP.shared;

  /* --------------------------- RESULTS PAGE ------------------------------ */
  AP.router.register('search', (ctx) => {
    const q = ctx.params.get('q') || '';
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);
    container.append(S.pageHead(q ? `Results for “${q}”` : 'Search', 'Find any anime by title.'));

    if (!q) {
      container.append(AP.ui.emptyState('Search anime', 'Type a title to get started.', el('button', { class: 'btn btn-primary', html: I.search + '<span>Open search</span>', onclick: () => AP.search.open() })));
      return page;
    }

    const holder = el('div', {});
    holder.append(AP.ui.skeletonGrid(18));
    container.append(holder);

    AP.api.search(q).then((res) => {
      if (ctx.signal.aborted) return;
      holder.innerHTML = '';
      if (!res.items.length) { holder.append(AP.ui.emptyState('No results', `We could not find any anime matching “${q}”. Try a different spelling.`)); return; }
      holder.append(AP.ui.grid(res.items));
      U.observeReveal(holder);
    }).catch((e) => { if (e.name === 'AbortError') return; holder.innerHTML = ''; holder.append(AP.ui.errorState('Search failed', e.message)); });

    return page;
  });

  /* ------------------------------ OVERLAY -------------------------------- */
  const overlay = { root: null, input: null, results: null, open: false };

  function init() {
    overlay.root = U.$('#searchOverlay');
    overlay.input = U.$('#searchInput');
    overlay.results = U.$('#searchResults');
    if (!overlay.root) return;

    U.$('#searchClose').addEventListener('click', close);
    overlay.root.addEventListener('click', (e) => { if (e.target === overlay.root) close(); });

    const run = U.debounce(async () => {
      const q = overlay.input.value.trim();
      if (!q) { renderIdle(); return; }
      overlay.results.innerHTML = '';
      const sk = el('div', { class: 'grid' }); for (let i = 0; i < 6; i++) sk.append(AP.ui.skeletonCard());
      overlay.results.append(sk);
      try {
        const res = await AP.api.search(q);
        if (overlay.input.value.trim() !== q) return;
        overlay.results.innerHTML = '';
        if (!res.items.length) { overlay.results.append(el('p', { class: 'search-hint', text: 'No results for “' + q + '”' })); return; }
        const grid = el('div', { class: 'grid' });
        res.items.slice(0, 18).forEach((it) => {
          const c = AP.ui.card(it, {});
          c.addEventListener('click', () => { AP.Lib.addSearch(q); close(); }, true);
          grid.append(c);
        });
        overlay.results.append(grid);
        const more = el('div', { style: { textAlign: 'center', marginTop: '18px' } });
        const b = el('a', { class: 'btn btn-outline', href: `#/search?q=${encodeURIComponent(q)}`, html: I.search + '<span>See all results</span>' });
        b.addEventListener('click', () => { AP.Lib.addSearch(q); close(); });
        more.append(b);
        overlay.results.append(more);
      } catch (e) {
        overlay.results.innerHTML = '';
        overlay.results.append(el('p', { class: 'search-hint', text: e.message }));
      }
    }, 320);

    overlay.input.addEventListener('input', () => { run(); });
    overlay.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const q = overlay.input.value.trim(); if (q) { AP.Lib.addSearch(q); close(); AP.router.go(`#/search?q=${encodeURIComponent(q)}`); } }
      if (e.key === 'Escape') close();
    });
  }

  function renderIdle() {
    overlay.results.innerHTML = '';
    const recent = AP.State.searchHistory;
    if (recent.length) {
      const wrap = el('div', {});
      wrap.append(el('p', { class: 'search-hint', style: { textAlign: 'left', padding: '0 4px 8px' }, text: 'Recent searches' }));
      const row = el('div', { class: 'recent-searches' });
      recent.forEach((q) => {
        const chip = el('button', { class: 'chip', html: I.clock + '<span>' + U.esc(q) + '</span>' });
        chip.addEventListener('click', () => { overlay.input.value = q; overlay.input.dispatchEvent(new Event('input')); });
        row.append(chip);
      });
      const clr = el('button', { class: 'chip', html: I.trash + '<span>Clear</span>' });
      clr.addEventListener('click', () => { AP.Lib.clearSearch(); renderIdle(); });
      row.append(clr);
      wrap.append(row);
      overlay.results.append(wrap);
    }
    const suggestions = el('div', { style: { marginTop: '22px' } });
    suggestions.append(el('p', { class: 'search-hint', style: { textAlign: 'left', padding: '0 4px 8px' }, text: 'Popular right now' }));
    const grid = el('div', { class: 'grid' }); for (let i = 0; i < 6; i++) grid.append(AP.ui.skeletonCard());
    suggestions.append(grid);
    overlay.results.append(suggestions);
    AP.api.trending().then((res) => {
      if (overlay.input.value.trim()) return;
      grid.innerHTML = '';
      res.items.slice(0, 6).forEach((it) => grid.append(AP.ui.card(it, {})));
    }).catch(() => grid.remove());
  }

  function open() {
    if (!overlay.root) init();
    overlay.open = true;
    overlay.root.classList.add('open');
    document.body.classList.add('no-scroll');
    renderIdle();
    setTimeout(() => overlay.input.focus(), 60);
  }
  function close() {
    overlay.open = false;
    overlay.root.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  AP.search = { init, open, close, get isOpen() { return overlay.open; } };
})();
