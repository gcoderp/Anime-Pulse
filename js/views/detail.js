/* ============================================================================
   ANIPULSE — views/detail.js
   Deep AniList detail page: banner, tags, rankings, relations, characters +
   Japanese voice actors, staff, score/status distributions, airing schedule,
   streaming episodes and external links. No TMDB anywhere.
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el, img } = U;
  const I = AP.ICONS;

  /* ------------------------------- MODALS -------------------------------- */
  function trailerModal(trailer, title) {
    let src = '';
    if (trailer && trailer.site === 'youtube' && trailer.id) src = `https://www.youtube.com/embed/${trailer.id}?autoplay=1&rel=0`;
    else if (trailer && trailer.site === 'dailymotion' && trailer.id) src = `https://www.dailymotion.com/embed/video/${trailer.id}?autoplay=1`;
    AP.ui.modal({
      title: (title || 'Trailer'),
      wide: true,
      body: src
        ? el('div', { class: 'video-embed' }, el('iframe', {
            src, allow: 'autoplay; encrypted-media; fullscreen', allowfullscreen: 'true', title: 'Trailer',
          }))
        : el('p', { class: 'text-2', text: 'No trailer is available for this title.' }),
    });
  }

  function shareModal(anime) {
    const url = location.origin + location.pathname + '#/anime/' + anime.id;
    const body = el('div', {});
    body.append(el('p', { class: 'text-2', style: { marginBottom: '14px' }, text: 'Share "' + anime.title + '"' }));
    const row = el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } });
    const input = el('input', { class: 'input', value: url, readonly: true, style: { flex: '1 1 240px' } });
    const copy = el('button', { class: 'btn btn-primary', html: I.copy + '<span>Copy</span>' });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); AP.ui.toast('Link copied', 'success'); }
      catch { input.select(); document.execCommand('copy'); AP.ui.toast('Link copied', 'success'); }
    });
    row.append(input, copy);
    body.append(row);
    const social = el('div', { style: { display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' } });
    const enc = encodeURIComponent(url), encT = encodeURIComponent(anime.title);
    social.append(el('a', { class: 'btn btn-outline btn-sm', target: '_blank', rel: 'noopener', href: `https://twitter.com/intent/tweet?url=${enc}&text=${encT}`, text: 'X / Twitter' }));
    social.append(el('a', { class: 'btn btn-outline btn-sm', target: '_blank', rel: 'noopener', href: `https://www.reddit.com/submit?url=${enc}&title=${encT}`, text: 'Reddit' }));
    social.append(el('a', { class: 'btn btn-outline btn-sm', target: '_blank', rel: 'noopener', href: `https://t.me/share/url?url=${enc}&text=${encT}`, text: 'Telegram' }));
    social.append(el('a', { class: 'btn btn-outline btn-sm', target: '_blank', rel: 'noopener', href: `https://api.whatsapp.com/send?text=${encT}%20${enc}`, text: 'WhatsApp' }));
    if (navigator.share) {
      const b = el('button', { class: 'btn btn-primary btn-sm', html: I.share + '<span>Share…</span>' });
      b.addEventListener('click', () => navigator.share({ title: anime.title, url }).catch(() => {}));
      social.append(b);
    }
    body.append(social);
    AP.ui.modal({ title: 'Share', body });
  }

  /* ------------------------------ HELPERS -------------------------------- */
  function section(title, sub) {
    const s = el('section', { class: 'section' });
    s.append(AP.ui.sectionTitle(title, sub));
    return s;
  }

  function barChart(rows) {
    const chart = el('div', { class: 'bar-chart' });
    const max = Math.max(1, ...rows.map((r) => r.value));
    rows.forEach((r) => {
      const row = el('div', { class: 'bar-row' });
      row.append(el('span', { class: 'br-label', text: r.label }));
      const track = el('div', { class: 'bar-track' });
      const fill = el('div', { class: 'bar-fill' });
      fill.style.width = Math.max(2, Math.round((r.value / max) * 100)) + '%';
      track.append(fill);
      row.append(track, el('span', { class: 'br-val', text: U.fmtNum(r.value) }));
      chart.append(row);
    });
    return chart;
  }

  function relationCard(rel) {
    const n = rel.node;
    const card = el('a', { class: 'card relation-card', href: `#/anime/${n.id}` });
    const p = el('div', { class: 'card-poster' });
    p.append(U.poster(n.cover, n.title));
    p.append(el('div', { class: 'card-overlay' }, el('span', { class: 'badge', text: rel.label })));
    card.append(p);
    const body = el('div', { class: 'card-body' });
    body.append(el('div', { class: 'card-title clamp-2', text: n.title }));
    const bits = [];
    if (n.year) bits.push(n.year);
    if (n.formatLabel) bits.push(n.formatLabel);
    if (n.episodes) bits.push(n.episodes + ' eps');
    if (bits.length) body.append(el('div', { class: 'card-meta', text: bits.join(' · ') }));
    card.append(body);
    return card;
  }

  function personCard(p, role, extra) {
    const card = el('div', { class: 'cast-card' });
    const ci = el('div', { class: 'cc-img' });
    if (p.image) ci.append(el('img', { src: p.image, alt: p.name, loading: 'lazy', decoding: 'async' }));
    card.append(ci);
    card.append(el('b', { text: p.name }));
    card.append(el('small', { text: role || '' }));
    if (extra) card.append(el('small', { class: 'cc-extra', text: extra }));
    return card;
  }

  /* ------------------------------- ROUTE --------------------------------- */
  AP.router.register('anime', (ctx) => detailView(ctx));

  function detailView(ctx) {
    const id = U.safeInt(ctx.parts[1]);
    const page = el('div', { class: 'page' });
    if (!id) {
      page.append(AP.ui.errorState('Not found', 'No valid AniList id was provided.', () => AP.router.go('#/')));
      return page;
    }
    const holder = el('div', { style: { padding: '120px 24px', display: 'grid', placeItems: 'center' } }, el('div', { class: 'player-spinner' }));
    page.append(holder);

    AP.api.detail(id, { signal: ctx.signal }).then((a) => {
      if (ctx.signal.aborted) return;
      holder.remove();
      page.append(renderDetail(a, ctx));
      U.observeReveal(page);
    }).catch((e) => {
      if (e && e.name === 'AbortError') return;
      holder.remove();
      page.append(AP.ui.errorState('Could not load title', e.message || 'AniList did not return this title.', () => AP.router.render()));
    });
    return page;
  }

  function renderDetail(a, ctx) {
    const frag = el('div');
    const isMovie = a.format === 'MOVIE';
    const playHref = isMovie ? `#/watch/${a.id}?type=movie` : `#/watch/${a.id}/1/1`;
    AP.Lib.addRecentlyViewed(a);

    /* ------------------------------- HERO -------------------------------- */
    const hero = el('div', { class: 'detail-hero' });
    const backdrop = el('div', { class: 'detail-backdrop' });
    let bimg = null;
    const bgUrl = a.backdrop || a.cover;
    if (bgUrl) {
      bimg = el('img', { src: img(bgUrl), alt: a.title, decoding: 'async' });
      backdrop.append(bimg);
    }
    hero.append(backdrop);

    const inner = el('div', { class: 'detail-inner' });
    const poster = el('div', { class: 'detail-poster' });
    poster.append(U.poster(a.cover, a.title));
    inner.append(poster);

    const main = el('div', { class: 'detail-main' });
    main.append(AP.ui.logoOrTitle(a, 'detail-logo'));
    if (a.titleNative && a.titleNative !== a.title) main.append(el('p', { class: 'detail-tagline', text: a.titleNative }));

    const meta = el('div', { class: 'detail-meta' });
    if (a.score100) meta.append(el('span', { class: 'badge badge-score', html: I.starFill + '<span>' + U.fmtScore(a.score100) + '</span>' }));
    if (a.year) meta.append(el('span', { class: 'badge', text: a.year }));
    if (a.formatLabel) meta.append(el('span', { class: 'badge', text: a.formatLabel }));
    if (a.episodes) meta.append(el('span', { class: 'badge', text: a.episodes + ' eps' }));
    else if (a.duration) meta.append(el('span', { class: 'badge', text: a.duration + ' min' }));
    if (a.status) {
      const cls = a.rawStatus === 'RELEASING' ? ' badge-live' : a.rawStatus === 'NOT_YET_RELEASED' ? ' badge-soon' : a.rawStatus === 'HIATUS' ? ' badge-warn' : '';
      meta.append(el('span', { class: 'badge' + cls, text: a.status }));
    }
    if (a.isAdult) meta.append(el('span', { class: 'badge badge-warn', text: '18+' }));
    main.append(meta);

    /* User rating */
    const ratingWrap = el('div', { class: 'detail-rating' });
    ratingWrap.append(el('span', { class: 'text-3', style: { fontSize: '.82rem' }, text: 'Your rating:' }));
    let stars;
    const makeStars = (v) => AP.ui.ratingStars(v, (val) => {
      AP.Lib.setRating(a, val);
      AP.ui.toast('Rated ' + val + ' star' + (val > 1 ? 's' : ''), 'success');
      const fresh = makeStars(val);
      ratingWrap.replaceChild(fresh, stars);
      stars = fresh;
    });
    stars = makeStars(AP.Lib.rating(a.id));
    ratingWrap.append(stars);
    main.append(ratingWrap);

    /* Actions */
    const actions = el('div', { class: 'detail-actions' });
    actions.append(el('a', { class: 'btn btn-primary btn-lg', href: playHref, html: I.play + '<span>Play now</span>' }));
    if (a.trailer && a.trailer.id) {
      const tb = el('button', { class: 'btn btn-outline btn-lg', html: I.film + '<span>Trailer</span>' });
      tb.addEventListener('click', () => trailerModal(a.trailer, a.title));
      actions.append(tb);
    }
    const wlOn = AP.Lib.inWatchlist(a.id);
    const wl = el('button', { class: 'btn btn-outline btn-lg', html: (wlOn ? I.bookmarkFill : I.bookmark) + '<span>' + (wlOn ? 'In Watchlist' : 'Watchlist') + '</span>' });
    wl.addEventListener('click', () => {
      const on = AP.Lib.toggleWatchlist(a);
      wl.innerHTML = (on ? I.bookmarkFill : I.bookmark) + '<span>' + (on ? 'In Watchlist' : 'Watchlist') + '</span>';
      AP.ui.toast(on ? 'Added to watchlist' : 'Removed', on ? 'success' : 'info');
    });
    actions.append(wl);
    const favOn = AP.Lib.inFavorites(a.id);
    const fav = el('button', { class: 'btn btn-outline btn-lg', html: (favOn ? I.heartFill : I.heart) + '<span>' + (favOn ? 'Favorited' : 'Favorite') + '</span>' });
    fav.addEventListener('click', () => {
      const on = AP.Lib.toggleFavorite(a);
      fav.innerHTML = (on ? I.heartFill : I.heart) + '<span>' + (on ? 'Favorited' : 'Favorite') + '</span>';
      AP.ui.toast(on ? 'Added to favorites' : 'Removed', on ? 'success' : 'info');
    });
    actions.append(fav);
    const sh = el('button', { class: 'btn btn-outline btn-lg', html: I.share + '<span>Share</span>' });
    sh.addEventListener('click', () => shareModal(a));
    actions.append(sh);
    if (a.siteUrl) actions.append(el('a', { class: 'btn btn-ghost btn-lg', href: a.siteUrl, target: '_blank', rel: 'noopener', html: I.external + '<span>AniList</span>' }));
    main.append(actions);

    if (a.overview) main.append(el('p', { class: 'detail-overview', text: a.overview }));

    /* Stats */
    const stats = el('div', { class: 'detail-stats' });
    if (a.score100) stats.append(AP.shared.statBox(U.fmtScore(a.score100), 'Rating'));
    if (a.meanScore) stats.append(AP.shared.statBox(U.fmtScore(a.meanScore), 'Mean'));
    if (a.popularity) stats.append(AP.shared.statBox(U.fmtNum(a.popularity), 'Popularity'));
    if (a.favourites) stats.append(AP.shared.statBox(U.fmtNum(a.favourites), 'Favourites'));
    if (a.episodes) stats.append(AP.shared.statBox(a.episodes, 'Episodes'));
    if (a.duration) stats.append(AP.shared.statBox(a.duration + 'm', 'Duration'));
    main.append(stats);

    inner.append(main);
    hero.append(inner);
    frag.append(hero);

    /* ------------------------------- BODY -------------------------------- */
    const body = el('div', { class: 'detail-body' });
    const cols = el('div', { class: 'detail-columns' });
    const left = el('div', {});
    const right = el('div', {});

    /* Next episode countdown */
    if (a.nextEp) {
      const sec = section('Next episode');
      const box = el('div', { class: 'next-ep-box' });
      const d = new Date(a.nextEp.airingAt * 1000);
      box.append(AP.shared.statBox('EP ' + a.nextEp.episode, 'Episode'));
      box.append(AP.shared.statBox(U.countdown(a.nextEp.timeUntilAiring), 'Airs'));
      box.append(AP.shared.statBox(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), 'Date'));
      sec.append(box);
      left.append(sec);
    }

    /* Details */
    const infoSec = section('Details');
    const dl = el('dl', { class: 'info-list' });
    const row = (k, v) => { if (!v) return; dl.append(el('div', { class: 'info-row' }, el('dt', { text: k }), el('dd', { text: v }))); };
    row('Format', a.formatLabel);
    row('Status', a.status);
    row('Episodes', a.episodes ? String(a.episodes) : '');
    row('Duration', a.duration ? a.duration + ' min' : '');
    row('First aired', a.date ? U.fmtDate(a.date) : '');
    row('Last aired', a.endDate ? U.fmtDate(a.endDate) : '');
    row('Season', a.season ? U.seasonName(a.season, a.seasonYear) : '');
    row('Studio', (a.studios || []).join(', '));
    row('Source', a.source ? a.source.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '');
    row('Country', a.country || '');
    row('Genres', (a.genres || []).join(', '));
    row('Romaji', a.titleRomaji && a.titleRomaji !== a.title ? a.titleRomaji : '');
    row('English', a.titleEnglish && a.titleEnglish !== a.title ? a.titleEnglish : '');
    row('Synonyms', (a.synonyms || []).slice(0, 6).join(', '));
    row('Hashtag', a.hashtag || '');
    if (a.idMal) {
      dl.append(el('div', { class: 'info-row' }, el('dt', { text: 'MyAnimeList' }),
        el('dd', {}, el('a', { href: `https://myanimelist.net/anime/${a.idMal}`, target: '_blank', rel: 'noopener', text: String(a.idMal) }))));
    }
    infoSec.append(dl);
    left.append(infoSec);

    /* Tags (AniList community tags) */
    if (a.tags && a.tags.length) {
      const tsec = section('Tags', 'AniList community tags ranked by relevance');
      const tr = el('div', { class: 'keyword-row' });
      a.tags.slice().sort((x, y) => (y.rank || 0) - (x.rank || 0)).slice(0, 24).forEach((t) => {
        tr.append(el('a', {
          class: 'keyword', href: `#/theme/${encodeURIComponent(t.name)}`,
          title: 'Rank ' + (t.rank || 0) + '%',
          text: t.name,
        }));
      });
      tsec.append(tr);
      left.append(tsec);
    }

    /* Rankings */
    if (a.rankings && a.rankings.length) {
      const rsec = section('Rankings', 'Where this title stands on AniList');
      const rr = el('div', { class: 'keyword-row' });
      a.rankings.slice(0, 8).forEach((r) => {
        const type = r.type === 'RATED' ? 'Highest Rated' : r.type === 'FAVOURITE' ? 'Most Favourited' : 'Most Popular';
        const scope = r.allTime ? 'All Time' : [r.season ? U.seasonName(r.season, r.year) : r.year].filter(Boolean).join(' ');
        rr.append(el('span', { class: 'keyword rank-chip', text: '#' + r.rank + ' ' + type + (scope ? ' · ' + scope : '') }));
      });
      rsec.append(rr);
      left.append(rsec);
    }

    /* Relations / Series */
    if (a.relations && a.relations.length) {
      const relSec = section('Related', 'Sequels, prequels and side stories');
      const order = ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'SUMMARY', 'OTHER'];
      const sorted = a.relations.slice().sort((x, y) => order.indexOf(x.relationType) - order.indexOf(y.relationType));
      const grid = el('div', { class: 'grid grid-sm relation-grid' });
      sorted.slice(0, 12).forEach((r) => grid.append(relationCard(r)));
      relSec.append(grid);
      left.append(relSec);
    }

    /* Characters + Japanese voice actors */
    if (a.characters && a.characters.length) {
      const csec = section('Characters & Voice Actors', 'Main cast from AniList');
      const cr = el('div', { class: 'cast-row' });
      a.characters.slice(0, 12).forEach((c) => {
        cr.append(personCard({ name: c.name, image: c.image }, c.role === 'MAIN' ? 'Main' : 'Supporting', c.va ? 'VA: ' + c.va : ''));
      });
      csec.append(cr);
      left.append(csec);
    }

    /* Staff */
    if (a.staff && a.staff.length) {
      const ssec = section('Staff', 'Directors, writers and key crew');
      const sr = el('div', { class: 'cast-row' });
      a.staff.slice(0, 10).forEach((s) => sr.append(personCard(s, s.role || '')));
      ssec.append(sr);
      left.append(ssec);
    }

    /* Recommendations */
    if (a.recommendations && a.recommendations.length) {
      const recSec = section('You may also like', 'Picked by the AniList community');
      recSec.append(AP.ui.rail(a.recommendations.slice(0, 18)));
      left.append(recSec);
    }

    /* Streaming episodes */
    if (a.streamingEpisodes && a.streamingEpisodes.length) {
      const epsSec = section('Episodes online', 'Official streaming links listed on AniList');
      const list = el('div', { class: 'stream-list' });
      a.streamingEpisodes.slice(0, 20).forEach((ep) => {
        const item = el('a', { class: 'stream-item', href: ep.url, target: '_blank', rel: 'noopener' });
        const th = el('div', { class: 'stream-thumb' });
        if (ep.thumbnail) th.append(el('img', { src: ep.thumbnail, alt: ep.title || '', loading: 'lazy', decoding: 'async' }));
        item.append(th);
        item.append(el('div', { class: 'stream-body' }, el('b', { text: ep.title || 'Episode' }), el('small', { text: ep.site || '' })));
        item.append(el('span', { class: 'stream-go', html: I.external }));
        list.append(item);
      });
      epsSec.append(list);
      left.append(epsSec);
    }

    /* External links */
    if (a.externalLinks && a.externalLinks.length) {
      const lsec = section('Links');
      const lr = el('div', { class: 'keyword-row' });
      a.externalLinks.slice(0, 14).forEach((l) => lr.append(el('a', { class: 'keyword', href: l.url, target: '_blank', rel: 'noopener', text: l.site || 'Link' })));
      lsec.append(lr);
      left.append(lsec);
    }

    /* --------------------------- RIGHT COLUMN ---------------------------- */
    const watchSec = el('section', { class: 'section', style: { marginTop: '0' } });
    watchSec.append(AP.ui.sectionTitle('Where to watch'));
    const afRow = el('a', { class: 'aniframe-row', href: playHref });
    afRow.append(
      el('span', { class: 'af-badge' }, el('span', { class: 'sb-dot' }), el('span', { text: 'AniFrame' })),
      el('span', { class: 'af-text' }, el('b', { text: 'Watch on AniPulse' }), el('small', { text: 'Built-in player · AniList ids used directly' })),
      el('span', { class: 'af-go', html: I.play })
    );
    watchSec.append(afRow);
    right.append(watchSec);

    /* Score distribution */
    if (a.stats && a.stats.scoreDistribution && a.stats.scoreDistribution.length) {
      const sec = section('Score distribution', 'How the community rated it');
      sec.append(barChart(a.stats.scoreDistribution.map((s) => ({ label: s.score, value: s.amount }))));
      right.append(sec);
    }

    /* Status distribution */
    if (a.stats && a.stats.statusDistribution && a.stats.statusDistribution.length) {
      const sec = section('Status distribution', 'What viewers are doing');
      sec.append(barChart(a.stats.statusDistribution.map((s) => ({ label: AP.STATUS_LABEL[s.status] || s.status, value: s.amount }))));
      right.append(sec);
    }

    /* Upcoming airing schedule */
    if (a.airingSchedule && a.airingSchedule.length) {
      const sec = section('Airing schedule');
      const list = el('div', { class: 'air-list' });
      a.airingSchedule.slice(0, 6).forEach((n) => {
        const d = new Date(n.airingAt * 1000);
        list.append(el('div', { class: 'air-row' },
          el('span', { class: 'air-ep', text: 'EP ' + n.episode }),
          el('span', { class: 'air-time', text: d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })
        ));
      });
      sec.append(list);
      right.append(sec);
    }

    cols.append(left, right);
    body.append(cols);
    frag.append(body);

    /* --------------------------- STICKY BAR ------------------------------ */
    const sticky = el('div', { class: 'detail-sticky' });
    const dsInner = el('div', { class: 'ds-inner' });
    const dsTitle = el('div', { class: 'ds-title' });
    if (a.cover) dsTitle.append(el('img', { src: img(a.cover), alt: a.title, loading: 'lazy' }));
    dsTitle.append(el('span', { class: 'clamp-1', text: a.title }));
    dsInner.append(dsTitle);
    const dsActions = el('div', { class: 'ds-actions' });
    dsActions.append(el('a', { class: 'btn btn-primary btn-sm', href: playHref, html: I.play + '<span>Play</span>' }));
    const sWl = el('button', { class: 'btn btn-outline btn-sm', html: (AP.Lib.inWatchlist(a.id) ? I.bookmarkFill : I.bookmark) + '<span>' + (AP.Lib.inWatchlist(a.id) ? 'Saved' : 'List') + '</span>' });
    sWl.addEventListener('click', () => {
      const on = AP.Lib.toggleWatchlist(a);
      sWl.innerHTML = (on ? I.bookmarkFill : I.bookmark) + '<span>' + (on ? 'Saved' : 'List') + '</span>';
      wl.innerHTML = (on ? I.bookmarkFill : I.bookmark) + '<span>' + (on ? 'In Watchlist' : 'Watchlist') + '</span>';
      AP.ui.toast(on ? 'Added to watchlist' : 'Removed', on ? 'success' : 'info');
    });
    dsActions.append(sWl);
    dsInner.append(dsActions);
    sticky.append(dsInner);
    frag.append(sticky);

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => sticky.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0));
      }, { threshold: 0 });
      io.observe(actions);
      if (ctx.signal) ctx.signal.addEventListener('abort', () => io.disconnect());
    }

    /* Parallax backdrop (skipped on low-memory devices) */
    if (bimg && !AP.PERF.lowMem) {
      const onScroll = U.throttle(() => {
        if (!document.body.contains(bimg)) { window.removeEventListener('scroll', onScroll); return; }
        const y = Math.min(window.scrollY, 700);
        bimg.style.transform = `translateY(${(y * 0.22).toFixed(1)}px) scale(1.1)`;
      }, 24);
      window.addEventListener('scroll', onScroll, { passive: true });
      if (ctx.signal) ctx.signal.addEventListener('abort', () => window.removeEventListener('scroll', onScroll));
    }

    return frag;
  }
})();
