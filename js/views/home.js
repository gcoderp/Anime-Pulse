/* ============================================================================
   ANIPULSE — views/home.js
   Cinematic hero + trending ticker + progressive AniList rails.
   Every rail is driven by AniList and removes itself cleanly when empty so the
   home page never shows the large empty gaps seen in earlier builds.
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el, img } = U;
  const I = AP.ICONS;
  const S = AP.shared;

  function buildHero(items) {
    const hero = el('section', { class: 'hero' });
    const bg = el('div', { class: 'hero-bg' });
    hero.append(bg);

    // floating particles (skipped on constrained devices)
    if (!AP.PERF.lowMem) {
      const particles = el('div', { class: 'hero-particles' });
      for (let i = 0; i < 14; i++) {
        particles.append(el('i', { style: {
          left: (Math.random() * 100).toFixed(1) + '%',
          '--sz': (2 + Math.random() * 5).toFixed(1) + 'px',
          '--dur': (9 + Math.random() * 11).toFixed(1) + 's',
          '--delay': (-Math.random() * 14).toFixed(1) + 's',
          opacity: (0.15 + Math.random() * 0.5).toFixed(2),
        } }));
      }
      hero.append(particles);
    }

    const inner = el('div', { class: 'hero-inner' });
    const content = el('div', { class: 'hero-content' });
    inner.append(content);
    hero.append(inner);

    const thumbs = el('div', { class: 'hero-thumbs' });
    const prev = el('button', { class: 'hero-arrow prev', html: I.chevL, 'aria-label': 'Previous' });
    const next = el('button', { class: 'hero-arrow next', html: I.chevR, 'aria-label': 'Next' });
    const progress = el('div', { class: 'hero-progress' }, el('i'));
    hero.append(prev, next, thumbs, progress);

    let idx = 0, timer = null;
    const slides = items.slice(0, 6);
    const autoplay = AP.State.settings.heroAutoplay !== false && slides.length > 1;

    function paint(i) {
      idx = (i + slides.length) % slides.length;
      const a = slides[idx];
      bg.innerHTML = '';
      const art = a.backdrop || a.cover;
      if (art) {
        const image = el('img', { src: img(art), alt: a.title });
        image.addEventListener('error', () => { if (a.cover) image.src = img(a.cover); });
        bg.append(image);
      }
      content.innerHTML = '';
      content.append(el('div', { class: 'hero-eyebrow', html: I.sparkles + '<span>Featured · #' + (idx + 1) + ' Trending</span>' }));
      content.append(AP.ui.logoOrTitle(a, 'hero-logo'));

      const badges = el('div', { class: 'hero-badges' });
      if (a.score100) badges.append(el('span', { class: 'badge badge-score', text: '★ ' + U.fmtScore(a.score100) }));
      if (a.rawStatus === 'RELEASING') badges.append(el('span', { class: 'badge badge-live', text: a.nextEp ? 'EP ' + a.nextEp.episode + ' soon' : 'Airing' }));
      if (a.rawStatus === 'NOT_YET_RELEASED') badges.append(el('span', { class: 'badge badge-soon', text: 'Upcoming' }));
      if (a.formatLabel) badges.append(el('span', { class: 'badge', text: a.formatLabel }));
      (a.genres || []).slice(0, 2).forEach((g) => badges.append(el('span', { class: 'badge badge-accent', text: g })));
      content.append(badges);

      const meta = el('div', { class: 'hero-meta' });
      S.metaLine(a).forEach((b, i) => { if (i) meta.append(el('span', { class: 'dot' })); meta.append(el('span', { text: b })); });
      content.append(meta);

      if (a.overview) content.append(el('p', { class: 'hero-overview clamp-3', text: a.overview }));

      const actions = el('div', { class: 'hero-actions' });
      const playHref = a.mediaType === 'movie' ? `#/watch/${a.id}?type=movie` : `#/watch/${a.id}/1/1`;
      actions.append(el('a', { class: 'btn btn-primary btn-lg', href: playHref, html: I.play + '<span>Play now</span>' }));
      const wl = el('button', { class: 'btn btn-outline btn-lg', html: (AP.Lib.inWatchlist(a.id) ? I.bookmarkFill : I.bookmark) + '<span>' + (AP.Lib.inWatchlist(a.id) ? 'Saved' : 'Add to list') + '</span>' });
      wl.addEventListener('click', () => {
        const on = AP.Lib.toggleWatchlist(a);
        wl.innerHTML = (on ? I.bookmarkFill : I.bookmark) + '<span>' + (on ? 'Saved' : 'Add to list') + '</span>';
        AP.ui.toast(on ? 'Added to watchlist' : 'Removed', on ? 'success' : 'info');
      });
      actions.append(wl);
      actions.append(el('a', { class: 'btn btn-outline btn-lg', href: `#/anime/${a.id}`, html: I.info + '<span>More info</span>' }));
      content.append(actions);

      // thumbnail strip
      thumbs.innerHTML = '';
      slides.forEach((s, di) => {
        const t = el('button', { class: 'hero-thumb' + (di === idx ? ' active' : ''), 'aria-label': s.title });
        if (s.cover) t.append(el('img', { src: img(s.cover), alt: s.title, loading: 'lazy' }));
        t.append(el('span', { class: 'ht-fill' }, el('i')));
        t.addEventListener('click', () => { paint(di); restart(); });
        thumbs.append(t);
      });

      progress.classList.remove('run');
      void progress.offsetWidth;
      if (autoplay) progress.classList.add('run');
    }

    function restart() {
      if (timer) clearInterval(timer);
      if (autoplay) timer = setInterval(() => paint(idx + 1), 8000);
    }
    prev.addEventListener('click', () => { paint(idx - 1); restart(); });
    next.addEventListener('click', () => { paint(idx + 1); restart(); });
    hero.addEventListener('mouseenter', () => timer && clearInterval(timer));
    hero.addEventListener('mouseleave', restart);

    paint(0);
    restart();
    return hero;
  }

  AP.router.register('home', async (ctx) => {
    const page = el('div', { class: 'page home-page' });

    // Hero (loads first)
    const heroHolder = el('div', { class: 'home-hero' });
    heroHolder.append(el('div', { class: 'hero', style: { minHeight: '60vh', display: 'grid', placeItems: 'center' } }, el('div', { class: 'player-spinner' })));
    page.append(heroHolder);

    // Trending ticker (full-bleed, below hero)
    const tickerHolder = el('div', { class: 'home-ticker' });
    page.append(tickerHolder);

    AP.api.trending(1).then((res) => {
      if (ctx.signal.aborted) return;
      const items = res.items.filter((a) => a.backdrop || a.cover).slice(0, 6);
      if (!items.length) { heroHolder.remove(); }
      else {
        heroHolder.innerHTML = '';
        heroHolder.append(buildHero(items));
      }
      const tickItems = res.items.filter((a) => a.title).slice(0, 14);
      if (tickItems.length) tickerHolder.append(AP.ui.ticker(tickItems));
      U.observeReveal(page);
    }).catch(() => { heroHolder.remove(); });

    const wrap = el('div', { class: 'container home-sections' });
    page.append(wrap);

    // Continue watching (local, instant)
    if (AP.State.continueWatching.length) {
      const sec = el('section', { class: 'section reveal' });
      sec.append(AP.ui.sectionTitle('Continue Watching', 'Pick up where you left off', '#/continue'));
      const track = el('div', { class: 'rail-track' });
      AP.State.continueWatching.slice(0, 12).forEach((it) => {
        const total = it.episodes || 0;
        const epNum = (it.ep && it.ep.episode) || 0;
        const progress = total ? Math.round((epNum / total) * 100) : 8;
        const c = AP.ui.card(it, { wide: true, showProgress: true, progress });
        c.addEventListener('click', () => {
          const ep = (it.ep && it.ep.episode) || 1;
          AP.router.go(it.mediaType === 'movie' ? `#/watch/${it.id}?type=movie` : `#/watch/${it.id}/1/${ep}`);
        }, true);
        track.append(c);
      });
      sec.append(el('div', { class: 'rail' }, track));
      wrap.append(sec);
    }

    // Because you watched
    S.becauseYouWatched(2).forEach((s) => wrap.append(s));

    // Top 10 (ranked) — trending is the best AniList signal for "right now"
    wrap.append(S.lazySection({
      title: 'Top 10 This Week', sub: 'The most-watched anime right now', href: '#/trending',
      loader: () => AP.api.trending().then((r) => r.items),
      render: (items) => AP.ui.top10Rail(items),
      skeleton: 6,
    }));

    // Rails
    wrap.append(S.lazySection({ title: 'Trending Now', sub: 'What everyone is watching', href: '#/trending', loader: () => AP.api.trending().then((r) => r.items) }));
    wrap.append(S.lazySection({ title: 'Airing This Week', sub: 'Fresh episodes on the way', href: '#/simulcasts', loader: () => AP.api.airing().then((r) => r.items) }));
    wrap.append(S.lazySection({ title: 'Top Rated', sub: 'The highest-rated anime of all time', href: '#/top-rated', loader: () => AP.api.topRated().then((r) => r.items) }));
    wrap.append(S.lazySection({ title: 'Most Popular', sub: 'Fan favourites right now', href: '#/popular', loader: () => AP.api.popular().then((r) => r.items) }));

    // Seasonal
    wrap.append(S.lazySection({ title: 'This Season', sub: 'Currently airing simulcasts', href: '#/seasonal', loader: () => AP.api.seasonal().then((r) => r.items) }));

    wrap.append(S.lazySection({ title: 'Upcoming', sub: 'Coming soon to the lineup', href: '#/upcoming', loader: () => AP.api.upcoming().then((r) => r.items) }));

    wrap.append(S.lazySection({ title: 'Most Favourited', sub: 'Loved by the AniList community', href: '#/favourites', loader: () => AP.api.favourites().then((r) => r.items) }));

    // Genres quick access
    const gsec = el('section', { class: 'section reveal' });
    gsec.append(AP.ui.sectionTitle('Browse by Genre', 'Find your next obsession', '#/genres'));
    const chips = el('div', { class: 'chip-row', style: { flexWrap: 'wrap' } });
    AP.GENRES.forEach((g) => chips.append(el('a', { class: 'chip', href: `#/genre/${encodeURIComponent(g.id)}`, text: g.name })));
    gsec.append(chips);
    wrap.append(gsec);

    return page;
  });
})();
