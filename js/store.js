/* ============================================================================
   ANIPULSE — store.js
   Persistent state (localStorage) + settings + library + analytics
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});

  const PREFIX = 'anipulse:';

  const Store = {
    available: (() => {
      try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
      catch { return false; }
    })(),
    get(key, fallback) {
      if (!this.available) return fallback;
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, val) {
      if (!this.available) return;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch {}
    },
    del(key) { if (this.available) try { localStorage.removeItem(PREFIX + key); } catch {} },
    clearAll() {
      if (!this.available) return;
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
    },
  };

  /* ------------------------------ SETTINGS ------------------------------- */
  const DEFAULTS = {
    theme: 'dark',
    accent: 'orange',
    density: 'cozy',
    motion: 'on',
    autoplayNext: false,
    epNav: true,
    autoNextDelay: 8,
    adultFilter: true,
    useExtras: true,
    cursorGlow: true,
    heroAutoplay: true,
    reduceData: false,
    defaultSort: 'POPULARITY_DESC',
  };

  const settings = Object.assign({}, DEFAULTS, Store.get('settings', {}));
  function saveSettings() { Store.set('settings', settings); }

  /* -------------------------------- STATE -------------------------------- */
  const State = {
    settings,
    watchlist: Store.get('watchlist', []),
    favorites: Store.get('favorites', []),
    ratings: Store.get('ratings', {}),
    continueWatching: Store.get('continueWatching', []),
    history: Store.get('history', []),
    watchedEpisodes: Store.get('watchedEpisodes', {}),
    recentlyViewed: Store.get('recentlyViewed', []),
    searchHistory: Store.get('searchHistory', []),
    epProgress: Store.get('epProgress', {}),
    analytics: Store.get('analytics', { detailViews: 0, watched: 0, wlAdd: 0, wlRemove: 0, favAdd: 0, favRemove: 0, searches: 0, plays: 0, startedAt: Date.now() }),
    apiStatus: { anilist: 'unknown', extras: 'unknown' },
    lastApi: { anilist: null, extras: null },
  };

  const PERSIST_MAP = {
    watchlist: 'watchlist', favorites: 'favorites', ratings: 'ratings',
    continueWatching: 'continueWatching', history: 'history', watchedEpisodes: 'watchedEpisodes',
    recentlyViewed: 'recentlyViewed', searchHistory: 'searchHistory', epProgress: 'epProgress', analytics: 'analytics',
  };

  function persist(key) {
    if (PERSIST_MAP[key]) Store.set(PERSIST_MAP[key], State[key]);
  }
  function persistAll() { Object.keys(PERSIST_MAP).forEach((k) => Store.set(PERSIST_MAP[k], State[k])); }

  /* ------------------------------ ANALYTICS ------------------------------ */
  const Analytics = {
    track(evt) {
      const a = State.analytics;
      const map = {
        detailView: 'detailViews', watched: 'watched', wlAdd: 'wlAdd', wlRemove: 'wlRemove',
        favAdd: 'favAdd', favRemove: 'favRemove', search: 'searches', play: 'plays',
      };
      if (map[evt]) a[map[evt]] = (a[map[evt]] || 0) + 1;
      persist('analytics');
    },
  };

  /* --------------------------- LIBRARY HELPERS --------------------------- */
  function slim(a) {
    return {
      id: a.id,
      mediaType: a.mediaType || 'tv',
      title: a.title,
      cover: a.cover,
      backdrop: a.backdrop || '',
      year: a.year || '',
      score: a.score || null,
      genres: (a.genres || []).slice(0, 3),
      episodes: a.episodes || null,
      duration: a.duration || null,
      format: a.format || '',
      overview: (a.overview || '').slice(0, 400),
      status: a.status || '',
      addedAt: a.addedAt || AP.utils.now(),
    };
  }

  const Lib = {
    inWatchlist(id) { return State.watchlist.some((x) => x.id === id); },
    inFavorites(id) { return State.favorites.some((x) => x.id === id); },
    rating(id) { return State.ratings[id] ? State.ratings[id].value : 0; },

    toggleWatchlist(anime) {
      const i = State.watchlist.findIndex((x) => x.id === anime.id);
      if (i >= 0) { State.watchlist.splice(i, 1); Analytics.track('wlRemove'); persist('watchlist'); return false; }
      State.watchlist.unshift(slim(anime)); Analytics.track('wlAdd'); persist('watchlist'); return true;
    },
    toggleFavorite(anime) {
      const i = State.favorites.findIndex((x) => x.id === anime.id);
      if (i >= 0) { State.favorites.splice(i, 1); Analytics.track('favRemove'); persist('favorites'); return false; }
      State.favorites.unshift(slim(anime)); Analytics.track('favAdd'); persist('favorites'); return true;
    },
    setRating(anime, val) {
      if (val > 0) State.ratings[anime.id] = { value: val, title: anime.title, cover: anime.cover, year: anime.year, at: AP.utils.now() };
      else delete State.ratings[anime.id];
      persist('ratings');
    },
    addHistory(anime, epInfo) {
      State.history = State.history.filter((x) => x.id !== anime.id);
      State.history.unshift(Object.assign(slim(anime), { watchedAt: AP.utils.now(), ep: epInfo || null }));
      if (State.history.length > 120) State.history.length = 120;
      Analytics.track('detailView');
      persist('history');
    },
    addRecentlyViewed(anime) {
      State.recentlyViewed = State.recentlyViewed.filter((x) => x.id !== anime.id);
      State.recentlyViewed.unshift(slim(anime));
      if (State.recentlyViewed.length > 30) State.recentlyViewed.length = 30;
      persist('recentlyViewed');
    },
    addContinue(anime, epInfo) {
      State.continueWatching = State.continueWatching.filter((x) => x.id !== anime.id);
      State.continueWatching.unshift(Object.assign(slim(anime), { ep: epInfo || null, at: AP.utils.now() }));
      if (State.continueWatching.length > 24) State.continueWatching.length = 24;
      persist('continueWatching');
    },
    removeContinue(id) { State.continueWatching = State.continueWatching.filter((x) => x.id !== id); persist('continueWatching'); },

    /* AniList has one episode list per entry, so the key is simply id:ep. */
    markWatched(anime, episode) {
      const key = anime.id;
      if (!State.watchedEpisodes[key]) State.watchedEpisodes[key] = [];
      const ep = Number(episode) || 1;
      if (!State.watchedEpisodes[key].includes(ep)) State.watchedEpisodes[key].push(ep);
      Analytics.track('watched');
      persist('watchedEpisodes');
    },
    isWatched(animeId, episode) {
      const arr = State.watchedEpisodes[animeId];
      return arr ? arr.includes(Number(episode) || 1) : false;
    },
    watchedCount(animeId) { return (State.watchedEpisodes[animeId] || []).length; },

    setProgress(id, episode, seconds) { State.epProgress[`${id}:${episode}`] = seconds; persist('epProgress'); },
    getProgress(id, episode) { return State.epProgress[`${id}:${episode}`] || 0; },

    addSearch(q) {
      q = (q || '').trim();
      if (!q) return;
      State.searchHistory = State.searchHistory.filter((x) => x.toLowerCase() !== q.toLowerCase());
      State.searchHistory.unshift(q);
      if (State.searchHistory.length > 10) State.searchHistory.length = 10;
      persist('searchHistory');
    },
    clearSearch() { State.searchHistory = []; persist('searchHistory'); },

    exportData() {
      return JSON.stringify({
        exportedAt: new Date().toISOString(), version: 3, source: 'anilist',
        settings: State.settings, watchlist: State.watchlist, favorites: State.favorites, ratings: State.ratings,
        continueWatching: State.continueWatching, history: State.history, watchedEpisodes: State.watchedEpisodes,
        recentlyViewed: State.recentlyViewed, searchHistory: State.searchHistory, epProgress: State.epProgress, analytics: State.analytics,
      }, null, 2);
    },
    importData(json) {
      const d = typeof json === 'string' ? JSON.parse(json) : json;
      const keys = ['watchlist', 'favorites', 'ratings', 'continueWatching', 'history', 'watchedEpisodes', 'recentlyViewed', 'searchHistory', 'epProgress'];
      keys.forEach((k) => { if (d[k] != null) { State[k] = d[k]; persist(k); } });
      if (d.settings) { Object.assign(State.settings, d.settings); saveSettings(); }
      return true;
    },
  };

  AP.Store = Store;
  AP.State = State;
  AP.Lib = Lib;
  AP.Analytics = Analytics;
  AP.saveSettings = saveSettings;
  AP.persist = persist;
  AP.persistAll = persistAll;
  AP.slim = slim;
  AP.DEFAULTS = DEFAULTS;
})();
