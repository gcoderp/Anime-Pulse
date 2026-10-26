# AniPulse

A fast, modern, **AniList-powered** anime streaming front-end with a single,
focused playback source: **AniFrame**.

AniPulse is a dependency-free static SPA (vanilla JS, no build step). Every
piece of catalogue data — titles, artwork, scores, tags, rankings, schedules,
characters, staff, relations and recommendations — comes from AniList's public
GraphQL API. Playback is handled by exactly one provider, AniFrame, which reads
AniList ids directly.

---

## Playback: AniFrame only

This build contains **one** embed provider. Every previous server (vidlink,
2embed, multiembed, videasy, vidsrc, vidsrcme, embedsu, autoembed, nxsha,
vidsrccc) has been removed.

```
https://aniframe-api.pages.dev/{anilistId}/{episode}
```

Because AniFrame speaks **AniList ids** and the catalogue *is* AniList, there is
**no mapping layer, no fuzzy title matching and no season guessing**. The id you
open is the id that plays. `AP.api.resolvePlayback()` simply:

1. takes `anime.id` (the AniList id),
2. clamps the episode to the known episode count when available,
3. builds `https://aniframe-api.pages.dev/{id}/{episode}`.

If an embed is blocked by the network, the watch page offers a prominent **Open
in new tab** action plus a reload/fallback panel.

---

## Deep AniList integration

AniPulse uses far more than a title list. The GraphQL layer requests and renders:

- **Catalogue rails** — trending, popularity, score, favourites, start date,
  seasonal and upcoming, all via `MediaSort`.
- **Advanced browse** — `MediaFormat`, `MediaStatus`, `MediaSeason`, year,
  genre, tag and minimum score, with cursor-free `Page` pagination driven by
  `pageInfo.hasNextPage`.
- **Search** — `SEARCH_MATCH` ranking for accurate title results.
- **Detail page** — banner + poster, native title, synonyms, hashtag, source,
  country, studio, trailer, external links, `streamingEpisodes`, tags with
  spoiler filtering, `rankings`, `stats.scoreDistribution`,
  `stats.statusDistribution`, `airingSchedule`, `relations.edges`,
  `recommendations`, `characters.edges` + Japanese `voiceActors`, and `staff`.
- **Weekly schedule** — `AiringSchedule` grouped by local calendar day.
- **Genre explorer** — `GenreCollection` plus AniList community tags (Isekai,
  Shounen, Seinen, School, Time Travel, Military, etc.).
- **Random picker** — random AniList page + entry.

All requests are key-less, POSTed to `https://graphql.anilist.co`, and cached
with TTLs (`CACHE_TTL`, `DETAIL_TTL`, `SCHEDULE_TTL`, `GENRE_TTL`).

---

## Episode lists that always render

AniList exposes `episodes` for most titles and `nextAiringEpisode.episode` for
currently airing shows. The watch page derives a complete episode list from:

1. `episodes` when present,
2. otherwise `nextAiringEpisode.episode - 1`,
3. otherwise a minimum of 1.

`streamingEpisodes` thumbnails and titles are merged in when available. Rows are
rendered in chunks (`AP.PERF.pageSize`, capped at 50) with a “Show more” button,
and each row uses `content-visibility: auto` on low-memory devices so long
series never create thousands of expensive layout nodes.

---

## Optimised for a 3 GB RAM phone

Running a rich SPA on a low-memory Android device is mostly about **not holding
too much in memory** and **not animating too many layers**. AniPulse detects the
device once at boot (`AP.detectPerf()`):

- `navigator.deviceMemory <= 4` **or** `hardwareConcurrency <= 4` **or** a
  mobile user agent sets `html[data-perf="low"]`.
- Rails are capped (`railLimit`), grids use smaller pages, and heavy effects
  (aurora, cursor glow, particles, parallax, backdrop blur, card shine) are
  disabled.
- Caches are small and capped (`CACHE_MAX`, `MEDIA_CACHE_MAX`); identical
  in-flight requests are de-duplicated.
- A token bucket (~66 req/min, burst 6, 220 ms minimum spacing) plus automatic
  backoff keeps the app inside AniList's 90 req/min limit. 429 responses are
  retried transparently.
- All fetches are abortable (14 s timeout) and aborted on navigation.
- Sections remove themselves cleanly when empty, so the home page never leaves
  large blank gaps between rails.
- Mobile layout uses safe-area insets, ≥44 px tap targets, edge-to-edge hero and
  player, and cheap paint (`content-visibility`, reduced shadows).

---

## Project structure

```
index.html
css/
  base.css        design tokens, reset, typography
  layout.css      header, nav, drawer, bottom nav, page scaffolding
  components.css  cards, rails, grids, badges, skeletons, toasts, modals
  views.css       hero, detail, watch, library, settings, charts
  animations.css  keyframes
  boot.css        first-paint splash
  responsive.css  breakpoints + low-memory + mobile polish
  premium.css     top-10 rail, ticker, side cards
js/
  config.js       endpoints, player contract, perf defaults, icons
  utils.js        DOM helpers, formatters, lazy image loader
  store.js        settings + local library (watchlist, history, progress)
  api.js          AniList GraphQL client, caches, normalisers
  components.js   reusable UI (card, rail, grid, top10, skeletons)
  router.js       hash router with abortable rendering
  views/          home, browse, detail, watch, library, extras, search,
                  settings, about, _shared
  app.js          boot, header, drawer, search overlay, command palette
```

Script order is defined at the bottom of `index.html` and must be preserved:
`config → utils → store → api → components → router → views/_shared → views → app`.

---

## Running locally

No build step and no API keys are required.

```bash
cd anipulse
python3 -m http.server 8099
# open http://localhost:8099
```

Any static host works (S3, Netlify, Cloudflare Pages, GitHub Pages). Because the
router uses `location.hash`, no server rewrites are needed.

---

## Privacy

Watchlist, favourites, ratings, history, continue-watching progress and
preferences are stored in `localStorage`. Nothing is uploaded. Settings →
Data → Export produces a JSON backup; Import restores it.

---

## Disclaimer

AniPulse does not host or store any video content. Metadata is provided by
AniList, and playback is embedded from AniFrame. This project is intended for
educational and personal use only.
