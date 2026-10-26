/* ============================================================================
   ANIPULSE — views/browse.js
   Browse, listing pages, genres, tags. Everything is AniList-native:
   MediaFormat / MediaStatus / MediaSeason / MediaSort / genre strings / tags.
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el } = U;
  const I = AP.ICONS;
  const S = AP.shared;

  const THIS_YEAR = new Date().getFullYear();

  /* Generic listing view with AniList filters + hasNext pagination */
  function listing({ title, sub, fetchPage, fixed = {}, showFilters = true }) {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);
    container.append(S.pageHead(title, sub));

    const state = Object.assign({
      sort: 'POPULARITY_DESC',
      format: '',
      status: '',
      season: '',
      year: '',
      minScore: '',
      genre: '',
      tag: '',
    }, fixed);

    const gridHolder = el('div', {});
    let pageNum = 1;
    let hasNext = false;
    let loading = false;

    const filterBar = el('div', { class: 'filter-bar' });
    function mkGroup(labelText, control) {
      return el('div', { class: 'fgroup' }, el('label', { text: labelText }), control);
    }
    function select(options, value, onChange) {
      const sel = el('select', { class: 'select' });
      options.forEach((o) => sel.append(el('option', { value: o.id, text: o.name })));
      sel.value = value;
      sel.addEventListener('change', () => { onChange(sel.value); reload(); });
      return sel;
    }

    if (showFilters) {
      const sortSel = select(AP.SORTS, state.sort, (v) => { state.sort = v; });

      const formatSel = select(AP.FORMATS, state.format, (v) => { state.format = v; });

      const statusSel = select(AP.STATUSES, state.status, (v) => { state.status = v; });

      const yearSel = select(
        [{ id: '', name: 'Any year' }].concat(
          Array.from({ length: THIS_YEAR + 1 - 1960 }, (_, i) => {
            const y = THIS_YEAR + 1 - i;
            return { id: String(y), name: String(y) };
          })
        ),
        state.year,
        (v) => { state.year = v; }
      );

      const scoreSel = select([
        { id: '', name: 'Any rating' },
        { id: '6', name: '6.0+' },
        { id: '7', name: '7.0+' },
        { id: '8', name: '8.0+' },
        { id: '9', name: '9.0+' },
      ], state.minScore, (v) => { state.minScore = v; });

      const seasonSel = select(
        [{ id: '', name: 'Any season' }].concat(AP.SEASONS),
        state.season,
        (v) => { state.season = v; }
      );

      if (!fixed.genre && !fixed.tag) {
        const genreSel = select(
          [{ id: '', name: 'All genres' }].concat(AP.GENRES),
          state.genre,
          (v) => { state.genre = v; }
        );
        filterBar.append(mkGroup('Genre', genreSel));
      }

      filterBar.append(
        mkGroup('Sort', sortSel),
        mkGroup('Format', formatSel),
        mkGroup('Status', statusSel),
        mkGroup('Season', seasonSel),
        mkGroup('Year', yearSel),
        mkGroup('Rating', scoreSel)
      );
      filterBar.append(el('div', { class: 'fspacer' }));

      const reset = el('button', { class: 'btn btn-ghost btn-sm', html: I.refresh + '<span>Reset</span>' });
      reset.addEventListener('click', () => {
        Object.assign(state, {
          sort: 'POPULARITY_DESC', format: '', status: '', season: '', year: '',
          minScore: '', genre: fixed.genre || '', tag: fixed.tag || '',
        });
        sortSel.value = 'POPULARITY_DESC';
        formatSel.value = '';
        statusSel.value = '';
        seasonSel.value = '';
        yearSel.value = '';
        scoreSel.value = '';
        reload();
      });
      filterBar.append(reset);
      container.append(filterBar);
    }

    container.append(gridHolder);
    const loadMoreWrap = el('div', { class: 'load-more' });
    container.append(loadMoreWrap);

    async function loadPage(reset) {
      if (loading) return;
      loading = true;
      if (reset) {
        pageNum = 1;
        hasNext = false;
        gridHolder.innerHTML = '';
        gridHolder.append(AP.ui.skeletonGrid(18));
        loadMoreWrap.innerHTML = '';
      } else {
        loadMoreWrap.innerHTML = '<div class="spinner"></div>';
      }
      try {
        const res = await fetchPage(pageNum, state);
        hasNext = !!res.hasNext;
        if (reset) gridHolder.innerHTML = '';
        if (!res.items.length && pageNum === 1) {
          gridHolder.append(AP.ui.emptyState('No results', 'Try changing the filters or search for something else.'));
        } else {
          const g = AP.ui.grid(res.items);
          gridHolder.append(g);
          U.observeReveal(g);
        }
        loadMoreWrap.innerHTML = '';
        if (hasNext) {
          const btn = el('button', { class: 'btn btn-outline', html: I.chevD + '<span>Load more</span>' });
          btn.addEventListener('click', () => { pageNum++; loadPage(false); });
          loadMoreWrap.append(btn);
        } else if (res.items.length) {
          loadMoreWrap.append(el('p', { class: 'text-3', style: { fontSize: '.82rem' }, text: 'You have reached the end.' }));
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
        gridHolder.innerHTML = '';
        gridHolder.append(AP.ui.errorState('Could not load', e.message, () => loadPage(true)));
      } finally {
        loading = false;
      }
    }
    function reload() { loadPage(true); }

    loadPage(true);

    // Auto load-more on scroll
    const sentinel = el('div', { style: { height: '1px' } });
    container.append(sentinel);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !loading && hasNext) {
          const btn = loadMoreWrap.querySelector('button');
          if (btn) { pageNum++; loadPage(false); }
        }
      }, { rootMargin: '600px' });
      io.observe(sentinel);
      page.addEventListener('ap:destroy', () => io.disconnect());
    }

    return page;
  }

  /* ------------------------------ ROUTES --------------------------------- */
  AP.router.register('browse', () => listing({
    title: 'Browse Anime',
    sub: 'Explore the full AniList catalogue with deep filters.',
    fetchPage: (p, s) => AP.api.browse({
      page: p,
      sort: s.sort,
      format: s.format || null,
      status: s.status || null,
      season: s.season || null,
      year: s.year || null,
      minScore: s.minScore || null,
      genre: s.genre || null,
      tag: s.tag || null,
    }),
  }));

  AP.router.register('trending', () => listing({ title: 'Trending', sub: 'The most popular anime right now.', showFilters: false, fetchPage: (p) => AP.api.trending(p) }));
  AP.router.register('popular', () => listing({ title: 'Popular', sub: 'All-time fan favourites.', showFilters: false, fetchPage: (p) => AP.api.popular(p) }));
  AP.router.register('top-rated', () => listing({ title: 'Top Rated', sub: 'Critically acclaimed masterpieces.', showFilters: false, fetchPage: (p) => AP.api.topRated(p) }));
  AP.router.register('upcoming', () => listing({ title: 'Upcoming', sub: 'New and upcoming anime releases.', showFilters: false, fetchPage: (p) => AP.api.upcoming(p) }));
  AP.router.register('seasonal', () => listing({ title: 'This Season', sub: 'Currently airing seasonal anime.', showFilters: false, fetchPage: (p) => AP.api.seasonal(p) }));
  AP.router.register('simulcasts', () => listing({ title: 'Simulcasts', sub: 'Anime airing new episodes right now.', showFilters: false, fetchPage: (p) => AP.api.airing(p) }));
  AP.router.register('movies', () => listing({ title: 'Anime Movies', sub: 'Feature-length anime films.', showFilters: false, fetchPage: (p) => AP.api.movies(p) }));

  AP.router.register('genre', (ctx) => {
    const name = decodeURIComponent(ctx.parts[1] || '');
    const g = AP.GENRES.find((x) => x.id === name);
    if (!g) return AP.ui.errorState('Genre not found', 'That genre does not exist.', () => AP.router.go('#/genres'));
    return listing({
      title: g.name,
      sub: 'Anime in the ' + g.name + ' genre.',
      fixed: { genre: g.id },
      fetchPage: (p, s) => AP.api.browse({
        page: p, genre: g.id, sort: s.sort, format: s.format || null,
        status: s.status || null, season: s.season || null,
        year: s.year || null, minScore: s.minScore || null,
      }),
    });
  });

  AP.router.register('theme', (ctx) => {
    const name = decodeURIComponent(ctx.parts[1] || '');
    const t = AP.THEMES.find((x) => x.id === name);
    if (!t) return AP.ui.errorState('Theme not found', 'That theme does not exist.', () => AP.router.go('#/genres'));
    return listing({
      title: t.name,
      sub: 'Anime tagged with the ' + t.name + ' theme.',
      fixed: { tag: t.id },
      showFilters: false,
      fetchPage: (p, s) => AP.api.browse({ page: p, tag: t.id, sort: s.sort }),
    });
  });

  /* Genres & themes explorer */
  AP.router.register('genres', () => {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);
    container.append(S.pageHead('Genres & Themes', 'Jump into a category and start exploring.'));

    const gsec = el('section', { class: 'section' });
    gsec.append(AP.ui.sectionTitle('Genres', 'Straight from the AniList GenreCollection'));
    const ggrid = el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' } });
    AP.GENRES.forEach((g) => {
      const c = el('a', { class: 'about-card hover-lift', href: `#/genre/${encodeURIComponent(g.id)}`, style: { display: 'block', textAlign: 'center' } });
      c.append(el('h3', { style: { justifyContent: 'center' }, text: g.name }));
      c.append(el('p', { text: 'Explore ' + g.name + ' anime' }));
      ggrid.append(c);
    });
    gsec.append(ggrid);
    container.append(gsec);

    const tsec = el('section', { class: 'section' });
    tsec.append(AP.ui.sectionTitle('Themes & Tags', 'AniList community tags — richer than plain genres'));
    const chips = el('div', { class: 'chip-row', style: { flexWrap: 'wrap' } });
    AP.THEMES.forEach((t) => chips.append(el('a', { class: 'chip', href: `#/theme/${encodeURIComponent(t.id)}`, text: t.name })));
    tsec.append(chips);
    container.append(tsec);
    return page;
  });
})();
