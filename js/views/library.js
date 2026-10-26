/* ============================================================================
   ANIPULSE — views/library.js
   Watchlist, favorites, continue watching, history, ratings, for-you, stats.
   All personal data is local; catalogue data comes from AniList only.
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el } = U;
  const I = AP.ICONS;
  const S = AP.shared;

  function watchHref(it) {
    if (!it) return '#/browse';
    if (it.mediaType === 'movie' || it.format === 'MOVIE') return `#/watch/${it.id}?type=movie`;
    const ep = (it.ep && it.ep.episode) || 1;
    return `#/watch/${it.id}/${ep}`;
  }

  function libraryView({ title, sub, items, emptyTitle, emptyText, wide, showProgress, progressFor, onOpen }) {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);
    container.append(S.pageHead(title, sub, items.length ? [el('span', { class: 'badge badge-accent', text: items.length + ' titles' })] : null));

    if (!items.length) {
      const cta = el('a', { class: 'btn btn-primary', href: '#/browse', html: I.grid + '<span>Browse anime</span>' });
      container.append(AP.ui.emptyState(emptyTitle, emptyText, cta));
      return page;
    }

    const grid = el('div', { class: 'grid' });
    items.forEach((it) => {
      const opts = { wide, showProgress, progress: progressFor ? progressFor(it) : 0 };
      const c = AP.ui.card(it, opts);
      if (onOpen) c.addEventListener('click', (e) => { e.stopPropagation(); onOpen(it); }, true);
      grid.append(c);
    });
    container.append(grid);
    U.observeReveal(page);
    return page;
  }

  AP.router.register('watchlist', () => libraryView({
    title: 'My Watchlist', sub: 'Anime you have saved to watch later.', items: AP.State.watchlist,
    emptyTitle: 'Your watchlist is empty', emptyText: 'Browse anime and tap the bookmark icon to save titles here.',
  }));

  AP.router.register('favorites', () => libraryView({
    title: 'Favorites', sub: 'Your all-time favourite anime.', items: AP.State.favorites,
    emptyTitle: 'No favorites yet', emptyText: 'Tap the heart icon on any anime to add it here.',
  }));

  AP.router.register('continue', () => libraryView({
    title: 'Continue Watching', sub: 'Pick up right where you left off.', items: AP.State.continueWatching, wide: true, showProgress: true,
    progressFor: (it) => {
      const total = it.episodes || 0;
      const cur = (it.ep && it.ep.episode) || 0;
      return total ? Math.round((cur / total) * 100) : 8;
    },
    emptyTitle: 'Nothing to continue', emptyText: 'Open any episode to start building your continue-watching list.',
    onOpen: (it) => AP.router.go(watchHref(it)),
  }));

  AP.router.register('history', () => {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);
    const head = S.pageHead('Watch History', 'Everything you have opened, most recent first.');
    if (AP.State.history.length) {
      const clear = el('button', { class: 'btn btn-outline btn-sm', html: I.trash + '<span>Clear history</span>' });
      clear.addEventListener('click', () => {
        AP.ui.modal({
          title: 'Clear watch history?',
          body: el('p', { class: 'text-2', text: 'This will remove all items from your watch history. This cannot be undone.' }),
          footer: (() => {
            const f = el('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' } });
            const c = el('button', { class: 'btn btn-ghost', text: 'Cancel' });
            const ok = el('button', { class: 'btn btn-danger', text: 'Clear' });
            c.addEventListener('click', () => document.querySelector('#modalRoot').classList.remove('open'));
            ok.addEventListener('click', () => { AP.State.history = []; AP.persist('history'); AP.router.render(); AP.ui.toast('History cleared', 'success'); });
            f.append(c, ok);
            return f;
          })(),
        });
      });
      head.append(el('div', { style: { marginTop: '16px' } }, clear));
    }
    container.append(head);
    if (!AP.State.history.length) {
      container.append(AP.ui.emptyState('No history yet', 'Anime you view will appear here.', el('a', { class: 'btn btn-primary', href: '#/browse', text: 'Browse anime' })));
      return page;
    }
    const grid = el('div', { class: 'grid' });
    AP.State.history.forEach((it) => {
      const c = AP.ui.card(it, {});
      c.addEventListener('click', () => AP.router.go(watchHref(it)), true);
      grid.append(c);
    });
    container.append(grid);
    return page;
  });

  AP.router.register('ratings', () => {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);
    const entries = Object.entries(AP.State.ratings).map(([id, v]) => Object.assign({ id: Number(id) }, v)).sort((a, b) => b.value - a.value);
    container.append(S.pageHead('My Ratings', 'Anime you have rated, highest first.'));
    if (!entries.length) {
      container.append(AP.ui.emptyState('No ratings yet', 'Rate anime from their detail page to see them here.', el('a', { class: 'btn btn-primary', href: '#/browse', text: 'Browse anime' })));
      return page;
    }
    const grid = el('div', { class: 'grid' });
    entries.forEach((it) => {
      const c = AP.ui.card(it, {});
      const badge = el('span', { class: 'badge badge-accent', style: { position: 'absolute', top: '10px', left: '10px', zIndex: '3' }, text: '★ ' + it.value });
      c.querySelector('.card-poster').append(badge);
      grid.append(c);
    });
    container.append(grid);
    return page;
  });

  AP.router.register('recommendations', () => {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);
    container.append(S.pageHead('For You', 'Personalised picks based on your watch history and favorites.'));

    // Genres are AniList strings now.
    const genreCount = {};
    const seed = AP.State.history.concat(AP.State.favorites, AP.State.watchlist).slice(0, 40);
    seed.forEach((it) => (it.genres || []).forEach((g) => { genreCount[g] = (genreCount[g] || 0) + 1; }));
    const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);

    if (!seed.length) {
      container.append(AP.ui.emptyState('Not enough data yet', 'Watch or save a few anime and we will tailor recommendations for you.', el('a', { class: 'btn btn-primary', href: '#/browse', text: 'Start browsing' })));
    }

    const holders = el('div', {});
    container.append(holders);

    topGenres.forEach((name) => {
      holders.append(S.lazySection({
        title: 'Because you like ' + name,
        sub: 'Top-rated picks in this genre',
        loader: () => AP.api.byGenre(name, { sort: 'SCORE_DESC' }).then((r) => r.items),
      }));
    });

    holders.append(S.lazySection({
      title: 'Critically Acclaimed',
      sub: 'Highest rated anime on AniList',
      loader: () => AP.api.topRated().then((r) => r.items),
    }));

    holders.append(S.lazySection({
      title: 'Hidden Gems',
      sub: 'High-scoring anime you might have missed',
      loader: () => AP.api.browse({ sort: 'SCORE_DESC', minScore: 7.5, page: 2 }).then((r) => r.items),
    }));

    return page;
  });

  AP.router.register('stats', () => {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);
    container.append(S.pageHead('Your Stats', 'A snapshot of your anime journey.'));

    const a = AP.State.analytics;
    const watchedTotal = Object.values(AP.State.watchedEpisodes).reduce((s, arr) => s + arr.length, 0);
    const grid = el('div', { class: 'lib-stat-grid' });
    const stat = (v, k) => el('div', { class: 'lib-stat' }, el('div', { class: 'ls-val', text: v }), el('div', { class: 'ls-key', text: k }));
    grid.append(stat(AP.State.watchlist.length, 'In Watchlist'));
    grid.append(stat(AP.State.favorites.length, 'Favorites'));
    grid.append(stat(watchedTotal, 'Episodes Watched'));
    grid.append(stat(AP.State.history.length, 'Titles Viewed'));
    grid.append(stat(Object.keys(AP.State.ratings).length, 'Rated'));
    grid.append(stat(a.plays || 0, 'Playbacks'));
    container.append(grid);

    // Genre breakdown from history
    const genreCount = {};
    AP.State.history.concat(AP.State.favorites).forEach((it) => (it.genres || []).forEach((g) => { genreCount[g] = (genreCount[g] || 0) + 1; }));
    const entries = Object.entries(genreCount).sort((x, y) => y[1] - x[1]).slice(0, 8);
    if (entries.length) {
      const sec = el('section', { class: 'section' });
      sec.append(AP.ui.sectionTitle('Top Genres', 'Based on your library'));
      const chart = el('div', { class: 'bar-chart' });
      const max = entries[0][1];
      entries.forEach(([name, count]) => {
        const row = el('div', { class: 'bar-row' });
        row.append(el('span', { text: name }));
        const track = el('div', { class: 'bar-track' });
        track.append(el('div', { class: 'bar-fill', style: { width: Math.round((count / max) * 100) + '%' } }));
        row.append(track, el('span', { class: 'text-3', style: { textAlign: 'right' }, text: String(count) }));
        chart.append(row);
      });
      sec.append(chart);
      container.append(sec);
    }

    if (AP.State.recentlyViewed.length) {
      container.append(S.lazySection({ title: 'Recently Viewed', loader: async () => AP.State.recentlyViewed.slice(0, 20) }));
    }

    // Data management
    const dataSec = el('section', { class: 'section' });
    dataSec.append(AP.ui.sectionTitle('Your Data', 'Export or import your library'));
    const row = el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } });
    const exp = el('button', { class: 'btn btn-outline', html: I.download + '<span>Export JSON</span>' });
    exp.addEventListener('click', () => {
      const blob = new Blob([AP.Lib.exportData()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = el('a', { href: url, download: 'anipulse-backup.json' });
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      AP.ui.toast('Exported your library', 'success');
    });
    const imp = el('button', { class: 'btn btn-outline', html: I.download + '<span>Import JSON</span>' });
    imp.addEventListener('click', () => {
      const input = el('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
      input.addEventListener('change', () => {
        const f = input.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => { try { AP.Lib.importData(reader.result); AP.ui.toast('Library imported', 'success'); AP.router.render(); } catch { AP.ui.toast('Invalid file', 'error'); } };
        reader.readAsText(f);
      });
      document.body.append(input); input.click(); input.remove();
    });
    const reset = el('button', { class: 'btn btn-danger', html: I.trash + '<span>Reset all data</span>' });
    reset.addEventListener('click', () => {
      AP.ui.modal({
        title: 'Reset all data?',
        body: el('p', { class: 'text-2', text: 'This permanently deletes your watchlist, favorites, history, ratings and settings from this browser.' }),
        footer: (() => {
          const f = el('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' } });
          const c = el('button', { class: 'btn btn-ghost', text: 'Cancel', onclick: () => document.querySelector('#modalRoot').classList.remove('open') });
          const ok = el('button', { class: 'btn btn-danger', text: 'Delete everything', onclick: () => { AP.Store.clearAll(); location.reload(); } });
          f.append(c, ok);
          return f;
        })(),
      });
    });
    row.append(exp, imp, reset);
    dataSec.append(row);
    container.append(dataSec);

    return page;
  });
})();
