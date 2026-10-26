/* ============================================================================
   ANIPULSE — api.js
   A deep, single-source AniList GraphQL client.

   Everything the app shows comes from AniList:
     • catalogue rails (trending / popular / top rated / seasonal / upcoming)
     • advanced browse (genre, tag, format, season, year, status, score)
     • search with SEARCH_MATCH ranking
     • full detail (relations, recommendations, characters, staff, tags,
       rankings, streaming episodes, airing schedule, score distribution)
     • weekly airing schedule (AiringSchedule)
     • playback ids for AniFrame (id is used directly — no mapping)

   Designed for a 3 GB phone: in-flight de-duplication, small LRU caches,
   request budget awareness and abortable fetches.
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;

  /* ------------------------------- CACHE --------------------------------- */
  const cache = new Map();      // query key -> { t, v }
  const mediaCache = new Map(); // id -> normalised detail
  const inflight = new Map();   // query key -> Promise (de-dupe)

  function cacheGet(k, ttl) {
    const hit = cache.get(k);
    if (!hit) return null;
    if (Date.now() - hit.t > ttl) { cache.delete(k); return null; }
    return hit.v;
  }
  function cacheSet(k, v) {
    cache.set(k, { t: Date.now(), v });
    const max = AP.CONFIG.CACHE_MAX || 60;
    while (cache.size > max) cache.delete(cache.keys().next().value);
  }
  function clearCache() { cache.clear(); mediaCache.clear(); inflight.clear(); }

  /* ------------------------------ TRANSPORT ------------------------------ */
  /* AniList allows 90 req/min. We keep a light token bucket so a fast user
     cannot trip the limit, and retry once on 429. */
  const bucket = { tokens: 6, last: Date.now(), lastStart: 0 };
  function takeToken() {
    const now = Date.now();
    const refill = ((now - bucket.last) / 1000) * 1.1; // ~66 req/min sustained
    bucket.tokens = Math.min(6, bucket.tokens + refill);
    bucket.last = now;
    // never start two requests closer than 220ms apart
    const gap = Math.max(0, 220 - (now - bucket.lastStart));
    if (bucket.tokens >= 1 && gap === 0) { bucket.tokens -= 1; bucket.lastStart = now; return 0; }
    if (bucket.tokens < 1) return Math.ceil(((1 - bucket.tokens) / 1.1) * 1000) + gap;
    return gap;
  }

  async function gql(query, variables = {}, opts = {}) {
    const key = opts.key || (query.replace(/\s+/g, ' ').slice(0, 90) + JSON.stringify(variables));
    if (!opts.noCache) {
      const hit = cacheGet(key, opts.ttl || AP.CONFIG.CACHE_TTL);
      if (hit) return hit;
    }
    if (inflight.has(key)) return inflight.get(key);

    const run = (async () => {
      const wait = takeToken();
      if (wait) await U.sleep(wait);

      const attempt = async (retry) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), opts.timeout || 14000);
        if (opts.signal) {
          if (opts.signal.aborted) { clearTimeout(timer); throw new DOMException('Aborted', 'AbortError'); }
          opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
        }
        try {
          let res;
          try {
            res = await fetch(AP.CONFIG.ANILIST, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ query, variables }),
              signal: ctrl.signal,
            });
          } catch (netErr) {
            // 429 responses from AniList omit CORS headers, so the browser
            // surfaces them as a generic network error. Retry with backoff.
            if (netErr && netErr.name === 'AbortError') throw netErr;
            if (retry < 2) { bucket.tokens = 0; await U.sleep(2200 * (retry + 1)); return attempt(retry + 1); }
            throw new Error('Could not reach AniList. Check your connection and try again.');
          }
          if (res.status === 429) {
            bucket.tokens = 0;
            if (retry >= 3) throw new Error('AniList is rate limiting. Please wait a moment.');
            await U.sleep(2600 * (retry + 1));
            return attempt(retry + 1);
          }
          if (!res.ok) throw new Error('AniList request failed (' + res.status + ').');
          const json = await res.json();
          if (json.errors && json.errors.length) {
            const msg = json.errors[0].message || 'AniList error';
            if (/not found/i.test(msg)) return null;
            throw new Error(msg);
          }
          AP.State.apiStatus.anilist = 'ok';
          AP.State.lastApi.anilist = Date.now();
          return json.data;
        } finally {
          clearTimeout(timer);
        }
      };

      try {
        const data = await attempt(false);
        if (!opts.noCache && data) cacheSet(key, data);
        return data;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, run);
    return run;
  }

  /* ------------------------------ FRAGMENTS ------------------------------ */
  const CARD = `
    id idMal type format status season seasonYear episodes duration
    title { romaji english native userPreferred }
    coverImage { extraLarge large medium color }
    bannerImage averageScore meanScore popularity favourites trending
    genres isAdult description(asHtml: false)
    startDate { year month day }
    nextAiringEpisode { episode airingAt timeUntilAiring }
    studios(isMain: true) { nodes { id name } }
  `;

  const DETAIL = `
    ${CARD}
    endDate { year month day }
    source countryOfOrigin isLicensed hashtag synonyms siteUrl
    trailer { id site thumbnail }
    streamingEpisodes { title thumbnail url site }
    externalLinks { id url site type }
    tags { id name rank isMediaSpoiler }
    rankings { rank type year season allTime context }
    stats {
      scoreDistribution { score amount }
      statusDistribution { status amount }
    }
    airingSchedule(notYetAired: true, perPage: 6) {
      nodes { episode airingAt timeUntilAiring }
    }
    relations {
      edges {
        relationType
        node { ${CARD} }
      }
    }
    recommendations(perPage: 12, sort: RATING_DESC) {
      nodes { rating mediaRecommendation { ${CARD} } }
    }
    characters(perPage: 12, sort: [ROLE, RELEVANCE, ID]) {
      edges {
        role
        node { id name { full } image { large } }
        voiceActors(language: JAPANESE) { id name { full } image { large } }
      }
    }
    staff(perPage: 8, sort: [ROLE, RELEVANCE, ID]) {
      edges { role node { id name { full } image { large } } }
    }
  `;

  /* ---------------------------- NORMALISERS ------------------------------ */
  function isoDate(d) {
    if (!d || !d.year) return '';
    return `${d.year}-${String(d.month || 1).padStart(2, '0')}-${String(d.day || 1).padStart(2, '0')}`;
  }

  function norm(m) {
    if (!m) return null;
    const t = m.title || {};
    const title = t.userPreferred || t.english || t.romaji || t.native || 'Untitled';
    const cover = (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || '';
    const year = m.seasonYear || (m.startDate && m.startDate.year) || '';
    const studios = m.studios
      ? (m.studios.nodes ? m.studios.nodes.map((n) => n.name) : (m.studios.edges || []).map((e) => e.node.name))
      : [];
    return {
      id: m.id,
      idMal: m.idMal || null,
      mediaType: m.format === 'MOVIE' ? 'movie' : 'tv',
      format: m.format || '',
      formatLabel: AP.FORMAT_LABEL[m.format] || m.format || '',
      title,
      titleRomaji: t.romaji || '',
      titleEnglish: t.english || '',
      titleNative: t.native || '',
      cover,
      coverColor: (m.coverImage && m.coverImage.color) || '',
      backdrop: m.bannerImage || '',
      year,
      season: m.season || '',
      seasonYear: m.seasonYear || year,
      date: isoDate(m.startDate),
      endDate: isoDate(m.endDate),
      score: m.averageScore ? m.averageScore / 10 : null,
      score100: m.averageScore || null,
      meanScore: m.meanScore || null,
      popularity: m.popularity || 0,
      favourites: m.favourites || 0,
      trending: m.trending || 0,
      genres: m.genres || [],
      overview: U.stripHtml(m.description),
      status: AP.STATUS_LABEL[m.status] || m.status || '',
      rawStatus: m.status || '',
      episodes: m.episodes || null,
      duration: m.duration || null,
      isAdult: !!m.isAdult,
      nextEp: m.nextAiringEpisode || null,
      studios,
      studio: studios[0] || '',
      synonyms: m.synonyms || [],
      siteUrl: m.siteUrl || '',
      source: m.source || '',
      country: m.countryOfOrigin || '',
      hashtag: m.hashtag || '',
      trailer: m.trailer || null,
      streamingEpisodes: m.streamingEpisodes || [],
      externalLinks: m.externalLinks || [],
      tags: (m.tags || []).filter((x) => !x.isMediaSpoiler),
      rankings: m.rankings || [],
      stats: m.stats || null,
      airingSchedule: (m.airingSchedule && m.airingSchedule.nodes) || [],
      relations: ((m.relations && m.relations.edges) || []).map((e) => ({
        relationType: e.relationType,
        label: AP.RELATION_LABEL[e.relationType] || 'Related',
        node: norm(e.node),
      })).filter((r) => r.node),
      recommendations: ((m.recommendations && m.recommendations.nodes) || [])
        .map((n) => n.mediaRecommendation && norm(n.mediaRecommendation))
        .filter(Boolean),
      characters: ((m.characters && m.characters.edges) || []).map((e) => ({
        role: e.role,
        name: e.node.name.full,
        image: e.node.image && e.node.image.large,
        va: e.voiceActors && e.voiceActors[0] ? e.voiceActors[0].name.full : '',
        vaImage: e.voiceActors && e.voiceActors[0] && e.voiceActors[0].image ? e.voiceActors[0].image.large : '',
      })),
      staff: ((m.staff && m.staff.edges) || []).map((e) => ({
        role: e.role,
        name: e.node.name.full,
        image: e.node.image && e.node.image.large,
      })),
    };
  }

  function pageInfo(p) {
    return {
      page: (p && p.pageInfo && p.pageInfo.currentPage) || 1,
      totalPages: (p && p.pageInfo && p.pageInfo.lastPage) || 1,
      hasNext: !!(p && p.pageInfo && p.pageInfo.hasNextPage),
      total: (p && p.pageInfo && p.pageInfo.total) || 0,
    };
  }

  /* --------------------------- LIST QUERIES ------------------------------ */
  /* AniList rejects null for some arguments (status, countryOfOrigin), so we
     build the media(...) argument list from the filters that are actually set. */
  function buildListQuery(v) {
    const defs = ['$page: Int', '$perPage: Int', '$type: MediaType', '$sort: [MediaSort]', '$isAdult: Boolean'];
    const args = ['type: $type', 'sort: $sort', 'isAdult: $isAdult'];
    if (v.format) { defs.push('$format: MediaFormat'); args.push('format: $format'); }
    if (v.season) { defs.push('$season: MediaSeason'); args.push('season: $season'); }
    if (v.seasonYear) { defs.push('$seasonYear: Int'); args.push('seasonYear: $seasonYear'); }
    if (v.status) { defs.push('$status: MediaStatus'); args.push('status: $status'); }
    if (v.genre) { defs.push('$genre: String'); args.push('genre: $genre'); }
    if (v.tag) { defs.push('$tag: String'); args.push('tag: $tag'); }
    if (v.search) { defs.push('$search: String'); args.push('search: $search'); }
    if (v.country) { defs.push('$country: CountryCode'); args.push('countryOfOrigin: $country'); }
    if (v.minScore) { defs.push('$minScore: Int'); args.push('averageScore_greater: $minScore'); }
    return `query (${defs.join(', ')}) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(${args.join(', ')}) {
          ${CARD}
        }
      }
    }`;
  }

  async function list(opts = {}) {
    const page = Math.max(1, Number(opts.page) || 1);
    const perPage = Math.min(50, Number(opts.perPage) || AP.PERF.perPage || 20);
    const vars = {
      page,
      perPage,
      sort: opts.sort ? [opts.sort] : ['POPULARITY_DESC'],
      type: 'ANIME',
      isAdult: opts.isAdult == null ? false : !!opts.isAdult,
    };
    if (opts.format) vars.format = opts.format;
    if (opts.season) vars.season = opts.season;
    if (opts.seasonYear) vars.seasonYear = Number(opts.seasonYear);
    if (opts.status) vars.status = opts.status;
    if (opts.genre) vars.genre = opts.genre;
    if (opts.tag) vars.tag = opts.tag;
    if (opts.search) vars.search = opts.search;
    if (opts.country) vars.country = opts.country;
    if (opts.minScore) vars.minScore = Number(opts.minScore) * 10;
    const query = buildListQuery(vars);
    const data = await gql(query, vars, { ttl: opts.ttl, signal: opts.signal, key: opts.key });
    const p = data && data.Page;
    return {
      items: ((p && p.media) || []).map(norm).filter(Boolean),
      ...pageInfo(p),
      season: opts.season || '',
      seasonYear: opts.seasonYear || '',
    };
  }

  /* ------------------------------ DETAIL --------------------------------- */
  async function detail(id, opts = {}) {
    const keyId = Number(id);
    if (!keyId) throw new Error('Invalid AniList id.');
    if (mediaCache.has(keyId)) return mediaCache.get(keyId);
    const q = `query ($id: Int) { Media(id: $id, type: ANIME) { ${DETAIL} } }`;
    const data = await gql(q, { id: keyId }, { ttl: AP.CONFIG.DETAIL_TTL, signal: opts.signal, key: 'detail:' + keyId });
    const m = data && data.Media;
    if (!m) throw new Error('This title could not be found on AniList.');
    const a = norm(m);
    mediaCache.set(keyId, a);
    while (mediaCache.size > (AP.CONFIG.MEDIA_CACHE_MAX || 40)) mediaCache.delete(mediaCache.keys().next().value);
    return a;
  }

  /* ---------------------------- SCHEDULE --------------------------------- */
  async function schedule(days = 7, opts = {}) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const from = Math.floor(start.getTime() / 1000);
    const to = from + days * 86400;
    const q = `query ($from: Int, $to: Int) {
      Page(page: 1, perPage: 50) {
        pageInfo { total currentPage lastPage hasNextPage }
        airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
          id airingAt episode
          media { ${CARD} }
        }
      }
    }`;
    const data = await gql(q, { from, to }, { ttl: AP.CONFIG.SCHEDULE_TTL, signal: opts.signal, key: `sched:${from}:${days}` });
    const p = data && data.Page;
    const list = ((p && p.airingSchedules) || []).map((s) => ({
      id: s.id,
      airingAt: s.airingAt,
      episode: s.episode,
      media: norm(s.media),
    })).filter((s) => s.media);
    return { items: list, ...pageInfo(p) };
  }

  /* ------------------------------ SEARCH --------------------------------- */
  async function search(query, page = 1, opts = {}) {
    const q = (query || '').trim();
    if (!q) return { items: [], page: 1, totalPages: 1, hasNext: false, total: 0 };
    return list({ search: q, sort: 'SEARCH_MATCH', page, perPage: opts.perPage || 24, isAdult: opts.isAdult, signal: opts.signal, key: `search:${q}:${page}` });
  }

  /* ------------------------------ GENRES --------------------------------- */
  async function genres() {
    const data = await gql('query { GenreCollection }', {}, { ttl: AP.CONFIG.GENRE_TTL, key: 'genres' });
    return (data && data.GenreCollection) || [];
  }

  /* ------------------------------ RANDOM --------------------------------- */
  async function random(opts = {}) {
    const page = 1 + Math.floor(Math.random() * 25);
    const res = await list({ sort: 'POPULARITY_DESC', page, perPage: 25, isAdult: false, signal: opts.signal, key: `rand:${page}` });
    if (!res.items.length) return null;
    return res.items[Math.floor(Math.random() * res.items.length)];
  }

  /* ------------------------------- API ----------------------------------- */
  const api = {
    list,
    detail,
    search,
    schedule,
    genres,
    random,

    /* Rails */
    trending: (page = 1, opts = {}) => list({ sort: 'TRENDING_DESC', page, perPage: opts.perPage || 20, signal: opts.signal, key: `trending:${page}` }),
    popular: (page = 1, opts = {}) => list({ sort: 'POPULARITY_DESC', page, signal: opts.signal, key: `popular:${page}` }),
    topRated: (page = 1, opts = {}) => list({ sort: 'SCORE_DESC', page, minScore: 6, signal: opts.signal, key: `top:${page}` }),
    favourites: (page = 1, opts = {}) => list({ sort: 'FAVOURITES_DESC', page, signal: opts.signal, key: `fav:${page}` }),
    upcoming: (page = 1, opts = {}) => list({ sort: 'POPULARITY_DESC', status: 'NOT_YET_RELEASED', page, signal: opts.signal, key: `up:${page}` }),
    airing: (page = 1, opts = {}) => list({ sort: 'TRENDING_DESC', status: 'RELEASING', page, signal: opts.signal, key: `air:${page}` }),
    movies: (page = 1, opts = {}) => list({ sort: 'POPULARITY_DESC', format: 'MOVIE', page, signal: opts.signal, key: `mov:${page}` }),
    latest: (page = 1, opts = {}) => list({ sort: 'START_DATE_DESC', page, signal: opts.signal, key: `latest:${page}` }),

    /* Current AniList season */
    seasonal(page = 1, opts = {}) {
      const cur = U.currentSeason();
      const season = opts.season || cur.season;
      const seasonYear = opts.seasonYear || cur.year;
      return list({
        sort: 'POPULARITY_DESC', season, seasonYear, page,
        signal: opts.signal,
        key: `season:${season}:${seasonYear}:${page}`,
      }).then((r) => Object.assign(r, { seasonName: U.seasonName(season, seasonYear) }));
    },

    /* Advanced browse */
    browse(opts = {}) {
      return list({
        sort: opts.sort || 'POPULARITY_DESC',
        genre: opts.genre || null,
        tag: opts.tag || null,
        format: opts.format || null,
        season: opts.season || null,
        seasonYear: opts.year ? Number(opts.year) : null,
        status: opts.status || null,
        minScore: opts.minScore || null,
        isAdult: opts.adult ? true : false,
        page: opts.page || 1,
        signal: opts.signal,
      });
    },

    byGenre(genre, opts = {}) {
      return list({ genre, sort: opts.sort || 'POPULARITY_DESC', page: opts.page || 1, signal: opts.signal, key: `genre:${genre}:${opts.page || 1}` });
    },

    byTag(tag, opts = {}) {
      return list({ tag, sort: opts.sort || 'POPULARITY_DESC', page: opts.page || 1, signal: opts.signal, key: `tag:${tag}:${opts.page || 1}` });
    },

    /* Recommendations for a title (uses the detail cache) */
    async recommendations(id, opts = {}) {
      const a = await detail(id, opts);
      return a.recommendations || [];
    },

    /* Relations grouped for the "series" block */
    async series(id, opts = {}) {
      const a = await detail(id, opts);
      const order = ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'SUMMARY', 'OTHER'];
      return (a.relations || []).slice().sort((x, y) => order.indexOf(x.relationType) - order.indexOf(y.relationType));
    },

    /* Find the next/previous entry in a franchise (used by the player) */
    async neighbours(id, opts = {}) {
      const a = await detail(id, opts);
      const rel = a.relations || [];
      const prequel = rel.filter((r) => r.relationType === 'PREQUEL').sort((x, y) => (y.node.year || 0) - (x.node.year || 0))[0];
      const sequel = rel.filter((r) => r.relationType === 'SEQUEL').sort((x, y) => (x.node.year || 0) - (y.node.year || 0))[0];
      return { prequel: prequel ? prequel.node : null, sequel: sequel ? sequel.node : null };
    },

    /* Health check */
    async ping() {
      try {
        await gql('query { Media(id: 1, type: ANIME) { id } }', {}, { noCache: true, timeout: 9000, key: 'ping' });
        AP.State.apiStatus.anilist = 'ok';
        return true;
      } catch {
        AP.State.apiStatus.anilist = 'bad';
        return false;
      }
    },
  };

  /* --------------------------- PLAYER URL BUILDER ------------------------ */
  /* AniFrame contract: https://aniframe-api.pages.dev/{anilistId}/{episode}
     AniList ids are used directly — no TMDB, no mapping, no season guessing. */
  function buildPlayerUrl({ anilistId, episode }) {
    const id = Number(anilistId);
    const ep = Math.max(1, Number(episode) || 1);
    if (!Number.isFinite(id) || id <= 0) return null;
    try {
      const u = new URL(`${AP.PLAYER.base}/${id}/${ep}`);
      return u.protocol === 'https:' ? u.toString() : null;
    } catch { return null; }
  }

  api.resolvePlayback = async function resolvePlayback(anime, epInfo = {}) {
    const id = Number(anime && anime.id);
    if (!id) throw new Error('Missing AniList id.');
    const total = Number(anime.episodes) || 0;
    let episode = Math.max(1, Number(epInfo.episode) || 1);
    const outOfRange = total > 0 && episode > total;
    if (total > 0) episode = Math.min(episode, total);
    const url = buildPlayerUrl({ anilistId: id, episode });
    if (!url) throw new Error('Could not build an AniFrame player URL.');
    return {
      anilistId: id,
      episode,
      total,
      outOfRange,
      title: anime.title || '',
      url,
      source: 'anilist',
    };
  };

  api.pingPlayer = async function pingPlayer() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${AP.PLAYER.base}/113415/1`, { method: 'HEAD', signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      AP.PLAYER.status = res.ok ? 'ok' : 'bad';
      return res.ok;
    } catch {
      AP.PLAYER.status = 'bad';
      return false;
    }
  };

  AP.api = api;
  AP.buildPlayerUrl = buildPlayerUrl;
  AP.clearCache = clearCache;
  AP.normMedia = norm;
})();
