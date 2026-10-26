/* ============================================================================
   ANIPULSE — router.js
   Hash router with abortable view rendering and nav highlighting
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;

  const views = {};
  let currentAbort = null;

  function parseHash() {
    const raw = (location.hash || '').replace(/^#/, '') || '/';
    const [path, query] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    return { raw, path, parts, params: new URLSearchParams(query || ''), view: parts[0] || 'home' };
  }

  function go(hash) {
    if (location.hash === hash) { render(); return; }
    location.hash = hash;
  }

  function setActiveNav(view) {
    const map = {
      '': 'home', home: 'home', anime: 'home',
      browse: 'browse', genres: 'genres', genre: 'genres', theme: 'genres',
      schedule: 'simulcasts', simulcasts: 'simulcasts', seasonal: 'seasonal',
      watchlist: 'watchlist', favorites: 'favorites', favourites: 'favorites',
      continue: 'continue', history: 'history', ratings: 'ratings',
      recommendations: 'recommendations', stats: 'stats',
      settings: 'settings', about: 'about', search: 'search', community: 'community', random: 'random',
      trending: 'trending', popular: 'popular', 'top-rated': 'top-rated', upcoming: 'upcoming',
    };
    const active = map[view] || view;
    U.$$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === active));
  }

  function showProgress() {
    const bar = U.$('#topProgress');
    if (!bar) return;
    bar.style.transition = 'none'; bar.style.width = '0%'; bar.style.opacity = '1';
    requestAnimationFrame(() => { bar.style.transition = 'width .5s ease'; bar.style.width = '70%'; });
  }
  function endProgress() {
    const bar = U.$('#topProgress');
    if (!bar) return;
    bar.style.width = '100%';
    setTimeout(() => { bar.style.opacity = '0'; setTimeout(() => { bar.style.width = '0%'; }, 300); }, 250);
  }

  async function render() {
    const ctx = parseHash();
    const app = U.$('#app');
    if (!app) return;

    // abort previous
    if (currentAbort) currentAbort.abort();
    currentAbort = new AbortController();
    ctx.signal = currentAbort.signal;

    setActiveNav(ctx.view);
    showProgress();

    const fn = views[ctx.view] || views.home;
    let node;
    try {
      node = await fn(ctx);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      node = AP.ui.errorState('Something went wrong', e && e.message ? e.message : 'Unknown error', () => render());
    }
    if (ctx.signal.aborted) return;

    app.innerHTML = '';
    if (node) app.append(node);

    // scroll behaviour
    const keepScroll = ctx.params.get('keepScroll');
    if (!keepScroll) window.scrollTo({ top: 0, behavior: 'auto' });

    U.observeReveal(app);
    endProgress();
    document.dispatchEvent(new CustomEvent('ap:navigate', { detail: ctx }));
  }

  function register(name, fn) { views[name] = fn; }

  function start() {
    window.addEventListener('hashchange', render);
    if (!location.hash) location.hash = '#/';
    render();
  }

  AP.router = { go, render, register, start, parseHash, views, get ctx() { return parseHash(); } };
})();
