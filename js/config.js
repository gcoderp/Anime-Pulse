/* ============================================================================
   ANIPULSE — config.js
   AniList is the SINGLE source of truth: catalogue, metadata, episodes,
   schedule, characters, staff, relations, recommendations and playback ids.
   No TMDB, no API keys, no third-party metadata services.
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});

  /* ------------------------------- CONFIG -------------------------------- */
  AP.CONFIG = {
    /* AniList public GraphQL endpoint. Key-less, CORS enabled, 90 req/min. */
    ANILIST: 'https://graphql.anilist.co',
    ANILIST_SITE: 'https://anilist.co',

    /* Cache TTLs (ms) */
    CACHE_TTL: 5 * 60 * 1000,
    DETAIL_TTL: 30 * 60 * 1000,
    SCHEDULE_TTL: 10 * 60 * 1000,
    GENRE_TTL: 24 * 60 * 60 * 1000,

    /* Hard memory caps — a 3 GB phone must never hold hundreds of payloads. */
    CACHE_MAX: 60,
    MEDIA_CACHE_MAX: 40,

    /* AniList rate limit is 90 requests / minute. We stay well below it. */
    REQ_BUDGET: 60,
  };

  /* ----------------------------- PLAYER ---------------------------------- */
  /* ONE player only: AniFrame.
     URL contract: https://aniframe-api.pages.dev/{anilistId}/{episode}
     Because the catalogue is now AniList, the id is used directly — no
     mapping layer, no guessing, no broken seasons. */
  AP.PLAYER = {
    id: 'aniframe',
    name: 'AniFrame',
    short: 'AniFrame',
    base: 'https://aniframe-api.pages.dev',
    url: 'https://aniframe-api.pages.dev/{anilistId}/{episode}',
    note: 'AniFrame is the only playback source and reads AniList ids directly.',
    status: 'unknown',
  };

  AP.PROVIDERS = [{ id: 'aniframe', name: 'AniFrame' }];

  /* --------------------------- PERFORMANCE ------------------------------- */
  AP.PERF = {
    lowMem: false,
    deviceMemory: 0,
    cores: 0,
    mobile: false,
    pageSize: 50,      // episodes rendered per chunk
    railLimit: 12,     // max cards per rail
    perPage: 20,       // AniList page size
  };

  /* ------------------------------- GENRES -------------------------------- */
  /* Exactly the AniList GenreCollection values. */
  AP.GENRES = [
    { id: 'Action', name: 'Action' },
    { id: 'Adventure', name: 'Adventure' },
    { id: 'Comedy', name: 'Comedy' },
    { id: 'Drama', name: 'Drama' },
    { id: 'Ecchi', name: 'Ecchi' },
    { id: 'Fantasy', name: 'Fantasy' },
    { id: 'Horror', name: 'Horror' },
    { id: 'Mahou Shoujo', name: 'Mahou Shoujo' },
    { id: 'Mecha', name: 'Mecha' },
    { id: 'Music', name: 'Music' },
    { id: 'Mystery', name: 'Mystery' },
    { id: 'Psychological', name: 'Psychological' },
    { id: 'Romance', name: 'Romance' },
    { id: 'Sci-Fi', name: 'Sci-Fi' },
    { id: 'Slice of Life', name: 'Slice of Life' },
    { id: 'Sports', name: 'Sports' },
    { id: 'Supernatural', name: 'Supernatural' },
    { id: 'Thriller', name: 'Thriller' },
  ];

  /* AniList tags — far richer than genres and the reason AniList is used. */
  AP.THEMES = [
    { id: 'Isekai', name: 'Isekai' },
    { id: 'Shounen', name: 'Shounen' },
    { id: 'Seinen', name: 'Seinen' },
    { id: 'Josei', name: 'Josei' },
    { id: 'School', name: 'School' },
    { id: 'Harem', name: 'Harem' },
    { id: 'Time Travel', name: 'Time Travel' },
    { id: 'Historical', name: 'Historical' },
    { id: 'Military', name: 'Military' },
    { id: 'Super Power', name: 'Super Power' },
    { id: 'Martial Arts', name: 'Martial Arts' },
    { id: 'Idol', name: 'Idol' },
    { id: 'Vampire', name: 'Vampire' },
    { id: 'Demons', name: 'Demons' },
    { id: 'Magic', name: 'Magic' },
    { id: 'Survival', name: 'Survival' },
  ];

  /* ------------------------------ CONSTANTS ------------------------------ */
  AP.SORTS = [
    { id: 'TRENDING_DESC', name: 'Trending' },
    { id: 'POPULARITY_DESC', name: 'Most Popular' },
    { id: 'SCORE_DESC', name: 'Top Rated' },
    { id: 'FAVOURITES_DESC', name: 'Most Favourited' },
    { id: 'START_DATE_DESC', name: 'Newest' },
    { id: 'START_DATE_ASC', name: 'Oldest' },
    { id: 'TITLE_ROMAJI', name: 'A → Z' },
  ];

  AP.FORMATS = [
    { id: '', name: 'All formats' },
    { id: 'TV', name: 'TV Series' },
    { id: 'TV_SHORT', name: 'TV Short' },
    { id: 'MOVIE', name: 'Movie' },
    { id: 'OVA', name: 'OVA' },
    { id: 'ONA', name: 'ONA' },
    { id: 'SPECIAL', name: 'Special' },
  ];

  AP.STATUSES = [
    { id: '', name: 'Any status' },
    { id: 'RELEASING', name: 'Airing' },
    { id: 'FINISHED', name: 'Finished' },
    { id: 'NOT_YET_RELEASED', name: 'Upcoming' },
    { id: 'HIATUS', name: 'Hiatus' },
    { id: 'CANCELLED', name: 'Cancelled' },
  ];

  AP.SEASONS = [
    { id: 'WINTER', name: 'Winter' },
    { id: 'SPRING', name: 'Spring' },
    { id: 'SUMMER', name: 'Summer' },
    { id: 'FALL', name: 'Fall' },
  ];

  AP.ACCENTS = ['orange', 'sunset', 'purple', 'blue', 'green', 'red', 'pink', 'cyan'];
  AP.THEMES_UI = ['dark', 'amoled', 'midnight', 'light'];
  AP.DENSITIES = ['compact', 'cozy', 'comfy'];

  /* -------------------------------- ICONS -------------------------------- */
  const s = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
  AP.ICONS = {
    play: s('<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>'),
    playCircle: s('<circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z" fill="currentColor" stroke="none"/>'),
    bookmark: s('<path d="M6 3h12v18l-6-4-6 4z"/>'),
    bookmarkFill: s('<path d="M6 3h12v18l-6-4-6 4z" fill="currentColor"/>'),
    heart: s('<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 9.5 7c-2.5 4.5-9.5 9-9.5 9z"/>'),
    heartFill: s('<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 9.5 7c-2.5 4.5-9.5 9-9.5 9z" fill="currentColor"/>'),
    star: s('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
    starFill: s('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" stroke="none"/>'),
    search: s('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
    menu: s('<path d="M3 6h18M3 12h18M3 18h18"/>'),
    chevL: s('<path d="M15 6l-6 6 6 6"/>'),
    chevR: s('<path d="M9 6l6 6-6 6"/>'),
    chevD: s('<path d="M6 9l6 6 6-6"/>'),
    arrowUp: s('<path d="M12 19V5M5 12l7-7 7 7"/>'),
    home: s('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    grid: s('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    calendar: s('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
    fire: s('<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>'),
    trending: s('<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>'),
    tv: s('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'),
    film: s('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/>'),
    info: s('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'),
    settings: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.8 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.4a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.9-2.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10.6 3a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.6 1.9l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 10.6a2 2 0 1 1 0 4 1.6 1.6 0 0 0-1.6 1.4z"/>'),
    check: s('<path d="M20 6L9 17l-5-5"/>'),
    checkCircle: s('<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>'),
    share: s('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
    download: s('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
    external: s('<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 13v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/>'),
    expand: s('<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    shuffle: s('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
    refresh: s('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
    volume: s('<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/>'),
    user: s('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    command: s('<path d="M6 3a3 3 0 0 1 3 3v12a3 3 0 1 1-3-3h12a3 3 0 1 1-3 3V6a3 3 0 1 1 3 3H6"/>'),
    eye: s('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'),
    filter: s('<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
    chart: s('<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="12" y="6" width="3" height="11"/><rect x="17" y="13" width="3" height="4"/>'),
    trash: s('<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>'),
    copy: s('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
    random: s('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
    bell: s('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
    list: s('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    sparkle: s('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
    arrowLeft: s('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
    arrowRight: s('<path d="M5 12h14M12 5l7 7-7 7"/>'),
    plus: s('<path d="M12 5v14M5 12h14"/>'),
    subtitle: s('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 15h4M12 15h6M6 11h2M10 11h8"/>'),
    sparkles: s('<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'),
    bolt: s('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    dub: s('<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/>'),
    layers: s('<path d="M12 2l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5M3 17l9 5 9-5"/>'),
  };

  /* --------------------------- LABELS / HELPERS -------------------------- */
  AP.STATUS_LABEL = {
    FINISHED: 'Finished',
    RELEASING: 'Airing',
    NOT_YET_RELEASED: 'Upcoming',
    CANCELLED: 'Cancelled',
    HIATUS: 'Hiatus',
  };

  AP.FORMAT_LABEL = {
    TV: 'TV',
    TV_SHORT: 'TV Short',
    MOVIE: 'Movie',
    SPECIAL: 'Special',
    OVA: 'OVA',
    ONA: 'ONA',
    MUSIC: 'Music',
  };

  AP.RELATION_LABEL = {
    PREQUEL: 'Prequel',
    SEQUEL: 'Sequel',
    SIDE_STORY: 'Side story',
    ALTERNATIVE: 'Alternative',
    SPIN_OFF: 'Spin-off',
    PARENT: 'Parent story',
    ADAPTATION: 'Adaptation',
    CHARACTER: 'Character',
    SUMMARY: 'Summary',
    OTHER: 'Related',
  };

  AP.fmt = {
    year: (d) => (d ? String(d).slice(0, 4) : ''),
    runtime: (m) => (m ? `${m}m` : ''),
  };
})();
