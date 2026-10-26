/* ============================================================================
   ANIPULSE — views/watch.js
   AniFrame-only player. AniList ids are used directly:
     https://aniframe-api.pages.dev/{anilistId}/{episode}
   Episodes are generated from the AniList entry itself (episodes / next
   airing episode), so there is no season resolution and no mapping layer.
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el } = U;
  const I = AP.ICONS;

  AP.router.register('watch', (ctx) => {
    const page = el('div', { class: 'page watch-page' });
    const type = ctx.params.get('type') === 'movie' ? 'movie' : 'tv';
    const id = U.safeInt(ctx.parts[1]);
    // Accept both #/watch/id/ep and #/watch/id/1/ep (legacy links).
    const p2 = U.safeInt(ctx.parts[2]);
    const p3 = U.safeInt(ctx.parts[3]);
    const episode = Math.max(1, p3 || p2 || 1);

    if (!id) {
      page.append(AP.ui.errorState('Invalid link', 'No valid AniList id was provided.', () => AP.router.go('#/')));
      return page;
    }

    const loader = el('div', { class: 'watch-boot' }, el('div', { class: 'player-spinner' }), el('span', { text: 'Loading title…' }));
    page.append(loader);

    AP.api.detail(id, { signal: ctx.signal }).then((a) => {
      if (ctx.signal.aborted) return;
      loader.remove();
      page.append(renderWatch(a, { episode }, ctx));
      U.observeReveal(page);
    }).catch((e) => {
      if (e && e.name === 'AbortError') return;
      loader.remove();
      page.append(AP.ui.errorState('Could not load player', e.message || 'Please try again.', () => AP.router.render()));
    });
    return page;
  });

  function renderWatch(a, ep, ctx) {
    const frag = el('div');
    const isMovie = a.format === 'MOVIE';
    const detailHref = `#/anime/${a.id}`;
    const playHref = isMovie ? `#/watch/${a.id}?type=movie` : `#/watch/${a.id}/${ep.episode}`;
    const goEp = (n) => AP.router.go(`#/watch/${a.id}/${n}`);

    /* ------------------------------- BACK -------------------------------- */
    const top = el('div', { class: 'watch-top' });
    const back = el('a', { class: 'watch-back', href: detailHref });
    back.append(el('span', { class: 'wb-ico', html: I.arrowLeft }));
    back.append(el('span', { class: 'wb-text' }, el('b', { text: 'Back to details' }), el('small', { text: a.title })));
    top.append(back);
    frag.append(top);

    /* ------------------------------ PLAYER ------------------------------- */
    const shell = el('div', { class: 'player-shell' });
    const frame = el('div', { class: 'player-frame', id: 'playerFrame' });
    shell.append(frame);

    const sourceBar = el('div', { class: 'source-bar' });
    const sourceLeft = el('div', { class: 'source-left' });
    const sourceBadge = el('span', { class: 'source-badge' }, el('span', { class: 'sb-dot' }), el('span', { text: 'AniFrame' }));
    const sourceStatus = el('span', { class: 'source-status', text: 'Preparing player…' });
    sourceLeft.append(sourceBadge, sourceStatus);
    const sourceActions = el('div', { class: 'source-actions' });

    const retryBtn = el('button', { class: 'btn btn-outline btn-sm', html: I.refresh + '<span>Reload</span>' });
    retryBtn.addEventListener('click', () => loadPlayer(true));

    const openTab = el('a', { class: 'btn btn-primary btn-sm', target: '_blank', rel: 'noopener noreferrer', html: I.external + '<span>Open in new tab</span>' });
    sourceActions.append(retryBtn, openTab);
    sourceBar.append(sourceLeft, sourceActions);
    shell.append(sourceBar);

    const pnote = el('p', { class: 'player-note' });
    pnote.textContent = 'AniFrame is the only playback source. If the embed is blocked on your network, use “Open in new tab”.';
    shell.append(pnote);
    frag.append(shell);

    /* -------------------------- INFO + CONTROLS -------------------------- */
    const info = el('div', { class: 'watch-info' });
    info.append(el('h1', { text: a.title }));
    const sub = el('p', { class: 'ep-sub' });
    info.append(sub);

    const controls = el('div', { class: 'watch-controls' });

    const wlOn = AP.Lib.inWatchlist(a.id);
    const wlBtn = el('button', { class: 'btn btn-outline btn-sm', html: (wlOn ? I.bookmarkFill : I.bookmark) + '<span>' + (wlOn ? 'In Watchlist' : 'Watchlist') + '</span>' });
    wlBtn.addEventListener('click', () => {
      const on = AP.Lib.toggleWatchlist(a);
      wlBtn.innerHTML = (on ? I.bookmarkFill : I.bookmark) + '<span>' + (on ? 'In Watchlist' : 'Watchlist') + '</span>';
      AP.ui.toast(on ? 'Added to watchlist' : 'Removed', on ? 'success' : 'info');
    });
    controls.append(wlBtn);

    const watchedBtn = el('button', { class: 'btn btn-outline btn-sm', html: I.check + '<span>Mark watched</span>' });
    watchedBtn.addEventListener('click', () => {
      AP.Lib.markWatched(a, ep.episode);
      AP.ui.toast('Marked episode ' + ep.episode + ' as watched', 'success');
      updateWatchedDots();
    });
    if (!isMovie) controls.append(watchedBtn);

    const theaterBtn = el('button', { class: 'btn btn-outline btn-sm', html: I.expand + '<span>Theater</span>' });
    theaterBtn.addEventListener('click', () => {
      const on = frame.classList.toggle('theater');
      if (on) {
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen && document.exitFullscreen().catch(() => {});
      }
    });
    controls.append(theaterBtn);

    const shareBtn = el('button', { class: 'btn btn-outline btn-sm', html: I.share + '<span>Share</span>' });
    shareBtn.addEventListener('click', async () => {
      const url = location.href;
      if (navigator.share) { try { await navigator.share({ title: a.title, url }); return; } catch {} }
      try { await navigator.clipboard.writeText(url); AP.ui.toast('Link copied', 'success'); }
      catch { AP.ui.toast('Could not copy link', 'error'); }
    });
    controls.append(shareBtn);
    info.append(controls);
    frag.append(info);

    /* ------------------------------- LAYOUT ------------------------------ */
    const layout = el('div', { class: 'watch-layout' });
    const mainCol = el('div', { class: 'watch-main' });
    const sideCol = el('div', { class: 'watch-side' });
    layout.append(mainCol, sideCol);
    frag.append(layout);

    /* ---------------------------- EPISODE DATA --------------------------- */
    const totalEpisodes = a.episodes || (a.nextEp ? Math.max(1, a.nextEp.episode - 1) : 1);
    const streaming = a.streamingEpisodes || [];
    const maxEp = isMovie ? 1 : Math.max(1, totalEpisodes);

    function buildEpisodes() {
      const out = [];
      for (let n = 1; n <= maxEp; n++) {
        const s = streaming[n - 1] || null;
        out.push({
          episode: n,
          title: (s && s.title) || ('Episode ' + n),
          thumb: (s && s.thumbnail) || '',
          site: (s && s.site) || '',
          url: (s && s.url) || '',
        });
      }
      return out;
    }

    /* ------------------------------ PLAYER ------------------------------- */
    let reqSeq = 0;
    let playerTimer = null;
    let currentUrl = null;

    function clearTimer() { if (playerTimer) { clearTimeout(playerTimer); playerTimer = null; } }

    function showLoading(msg) {
      frame.innerHTML = '';
      frame.append(el('div', { class: 'player-loading' },
        el('div', { class: 'player-spinner' }),
        el('span', { text: msg || 'Preparing player…' })));
    }

    function showError(title, message, retry) {
      clearTimer();
      frame.innerHTML = '';
      const box = el('div', { class: 'player-unavailable' });
      box.append(el('div', { class: 'pu-icon', html: I.info }));
      box.append(el('h3', { text: title }));
      box.append(el('p', { text: message }));
      const row = el('div', { class: 'pf-row' });
      if (retry) {
        const b = el('button', { class: 'btn btn-primary', html: I.refresh + '<span>Try again</span>' });
        b.addEventListener('click', retry);
        row.append(b);
      }
      if (currentUrl) row.append(el('a', { class: 'btn btn-outline', href: currentUrl, target: '_blank', rel: 'noopener noreferrer', html: I.external + '<span>Open in new tab</span>' }));
      box.append(row);
      frame.append(box);
    }

    function mountIframe(url) {
      clearTimer();
      frame.innerHTML = '';
      const loading = el('div', { class: 'player-loading' }, el('div', { class: 'player-spinner' }), el('span', { text: 'Starting AniFrame…' }));
      frame.append(loading);

      const iframe = el('iframe', {
        src: url,
        title: a.title + ' — AniFrame player',
        allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write',
        allowfullscreen: 'true',
        referrerpolicy: 'origin',
        loading: 'eager',
        class: 'aniframe',
      });

      let loaded = false;
      iframe.addEventListener('load', () => {
        loaded = true;
        loading.classList.add('hide');
        setTimeout(() => loading.remove(), 450);
      });
      frame.append(iframe);

      playerTimer = setTimeout(() => {
        if (loaded || !document.body.contains(loading)) return;
        loading.innerHTML = '';
        const panel = el('div', { class: 'player-fallback' });
        panel.append(el('h3', { text: 'AniFrame is taking too long' }));
        panel.append(el('p', { text: 'The embed may be blocked in your region or temporarily unavailable. Reload it, or open it in a new tab.' }));
        const row = el('div', { class: 'pf-row' });
        const again = el('button', { class: 'btn btn-primary', html: I.refresh + '<span>Reload player</span>' });
        again.addEventListener('click', () => loadPlayer(true));
        row.append(again, el('a', { class: 'btn btn-outline', href: url, target: '_blank', rel: 'noopener noreferrer', html: I.external + '<span>Open in new tab</span>' }));
        panel.append(row);
        loading.append(panel);
      }, 14000);
    }

    async function loadPlayer(force) {
      const my = ++reqSeq;
      clearTimer();
      if (force) currentUrl = null;
      showLoading('Preparing AniFrame…');
      sourceStatus.textContent = 'Preparing AniFrame…';
      sourceBar.classList.remove('error', 'ready');

      try {
        const r = await AP.api.resolvePlayback(a, { episode: ep.episode });
        if (my !== reqSeq || ctx.signal.aborted) return;
        currentUrl = r.url;
        openTab.href = r.url;
        sourceBar.classList.add('ready');
        const bits = ['AniList #' + r.anilistId, 'EP ' + r.episode];
        if (r.outOfRange) bits.push('closest available');
        sourceStatus.textContent = bits.join(' · ');
        mountIframe(r.url);
        if (r.outOfRange) {
          AP.ui.toast('That episode is beyond this title’s catalogue. Showing the closest available episode.', 'info', 4200);
        }
      } catch (e) {
        if (my !== reqSeq || (e && e.name === 'AbortError') || ctx.signal.aborted) return;
        sourceBar.classList.add('error');
        sourceStatus.textContent = 'Could not prepare the player';
        currentUrl = null;
        showError('Playback unavailable', e.message || 'AniFrame could not be prepared for this title.', () => loadPlayer(true));
      }
    }

    /* --------------------------- EPISODE LIST ---------------------------- */
    function updateWatchedDots() {
      U.$$('.ep-item', mainCol).forEach((item) => {
        const n = U.safeInt(item.dataset.ep);
        const dot = item.querySelector('.ep-watched-dot');
        if (AP.Lib.isWatched(a.id, n)) {
          if (!dot) item.append(el('span', { class: 'ep-watched-dot' }));
        } else if (dot) dot.remove();
      });
    }

    function epItem(e) {
      const item = el('div', { class: 'ep-item' + (e.episode === ep.episode ? ' active' : ''), dataset: { ep: e.episode } });
      const thumb = el('div', { class: 'ep-thumb' });
      if (e.thumb) thumb.append(el('img', { src: e.thumb, alt: e.title, loading: 'lazy', decoding: 'async' }));
      else thumb.append(el('div', { class: 'ep-thumb-fallback', html: I.film }));
      thumb.append(el('span', { class: 'ep-num', text: 'EP ' + e.episode }));
      item.append(thumb);

      const ei = el('div', { class: 'ep-info' });
      ei.append(el('b', { text: e.title }));
      const metaBits = [];
      if (e.site) metaBits.push(e.site);
      if (e.episode === ep.episode) metaBits.push('Now playing');
      if (metaBits.length) ei.append(el('small', { class: 'ep-meta', text: metaBits.join(' · ') }));
      item.append(ei);

      if (AP.Lib.isWatched(a.id, e.episode)) item.append(el('span', { class: 'ep-watched-dot' }));
      item.append(el('span', { class: 'ep-play', html: I.play }));
      item.addEventListener('click', () => goEp(e.episode));
      return item;
    }

    function renderEpisodes() {
      mainCol.innerHTML = '';
      if (isMovie) {
        const sec = el('section', { class: 'section watch-episodes' });
        sec.append(AP.ui.sectionTitle('Movie', 'Use the AniFrame player above to watch.'));
        sec.append(el('p', { class: 'watch-movie-note', text: 'This is a feature film, so there is a single playback entry on AniFrame.' }));
        mainCol.append(sec);
        return;
      }

      const sec = el('section', { class: 'section watch-episodes' });
      sec.append(AP.ui.sectionTitle('Episodes', U.plural(maxEp, 'episode')));
      const list = el('div', { class: 'ep-list' });
      sec.append(list);
      mainCol.append(sec);

      const eps = buildEpisodes();
      const PAGE = Math.max(12, Math.min(AP.PERF.pageSize || 50, 50));
      let shown = 0;
      const more = el('button', { class: 'btn btn-outline btn-block ep-more' });

      function chunk() {
        const end = Math.min(eps.length, shown + PAGE);
        for (let i = shown; i < end; i++) list.append(epItem(eps[i]));
        shown = end;
        if (shown < eps.length) {
          more.innerHTML = I.chevD + '<span>Show ' + Math.min(PAGE, eps.length - shown) + ' more episodes</span>';
          if (!more.isConnected) list.append(more);
        } else if (more.isConnected) {
          more.remove();
        }
      }
      more.addEventListener('click', chunk);
      chunk();

      // Keep the active episode in view.
      requestAnimationFrame(() => {
        const active = list.querySelector('.ep-item.active');
        if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
      });
    }

    /* --------------------------- PREV / NEXT ----------------------------- */
    if (!isMovie && AP.State.settings.epNav !== false) {
      const nav = el('div', { class: 'watch-nav' });
      if (ep.episode > 1) {
        const prev = el('button', { class: 'btn btn-outline btn-sm', html: I.chevL + '<span>Previous</span>' });
        prev.addEventListener('click', () => goEp(ep.episode - 1));
        nav.append(prev);
      }
      if (ep.episode < maxEp) {
        const next = el('button', { class: 'btn btn-primary btn-sm', html: '<span>Next episode</span>' + I.chevR });
        next.addEventListener('click', () => goEp(ep.episode + 1));
        nav.append(next);
      }
      if (nav.childNodes.length) info.append(nav);
    }

    /* ----------------------------- SIDEBAR ------------------------------- */
    function renderSide() {
      sideCol.innerHTML = '';

      const recs = (a.recommendations || []).filter((r) => r.cover).slice(0, AP.PERF.lowMem ? 6 : 8);
      if (recs.length) {
        const sec = el('section', { class: 'section watch-side-sec' });
        sec.append(AP.ui.sectionTitle('Up next for you', 'More anime you might enjoy'));
        const list = el('div', { class: 'side-list' });
        recs.forEach((r) => list.append(AP.ui.sideCard(r)));
        sec.append(list);
        sideCol.append(sec);
      }

      const facts = el('section', { class: 'section watch-side-sec' });
      facts.append(AP.ui.sectionTitle('About this anime'));
      const panel = el('div', { class: 'side-panel' });
      if (a.overview) panel.append(el('p', { class: 'sp-overview clamp-4', text: a.overview }));
      const chips = el('div', { class: 'sp-chips' });
      (a.genres || []).slice(0, 4).forEach((g) => chips.append(el('span', { class: 'keyword', text: g })));
      if (a.status) chips.append(el('span', { class: 'keyword', text: a.status }));
      if (a.episodes) chips.append(el('span', { class: 'keyword', text: a.episodes + ' eps' }));
      if (chips.childNodes.length) panel.append(chips);
      panel.append(el('a', { class: 'btn btn-outline btn-sm btn-block', href: detailHref, html: I.info + '<span>View full details</span>' }));
      facts.append(panel);
      sideCol.append(facts);

      // Franchise neighbours: next season / sequel.
      AP.api.neighbours(a.id, { signal: ctx.signal }).then((nb) => {
        if (ctx.signal.aborted) return;
        const seq = nb && nb.sequel;
        if (!seq) return;
        const sec = el('section', { class: 'section watch-side-sec' });
        sec.append(AP.ui.sectionTitle('Continues in', 'Next entry in the series'));
        const card = AP.ui.sideCard(seq);
        sec.append(card);
        sideCol.append(sec);
      }).catch(() => {});
    }

    /* ------------------------------ INIT --------------------------------- */
    sub.textContent = isMovie ? 'Movie' : `Episode ${ep.episode} of ${maxEp}`;
    loadPlayer(false);
    renderEpisodes();
    renderSide();

    AP.Lib.addContinue(a, { episode: ep.episode });
    AP.Lib.addHistory(a, { episode: ep.episode });
    AP.Analytics.track('play');

    /* --------------------------- AUTOPLAY NEXT --------------------------- */
    if (!isMovie && AP.State.settings.autoplayNext && ep.episode < maxEp) {
      const delay = Math.max(3, Number(AP.State.settings.autoNextDelay) || 8);
      const startAt = 45;
      let cancelled = false;
      const timer = setTimeout(() => {
        if (cancelled || ctx.signal.aborted || !document.body.contains(frag)) return;
        let left = delay;
        const bar = el('div', { class: 'autonext-bar' });
        const label = el('span', { class: 'an-label', text: `Up next: Episode ${ep.episode + 1} in ${left}s` });
        const cancel = el('button', { class: 'btn btn-ghost btn-sm', text: 'Cancel' });
        const goNow = el('button', { class: 'btn btn-primary btn-sm', text: 'Play now' });
        cancel.addEventListener('click', () => { cancelled = true; bar.remove(); });
        goNow.addEventListener('click', () => goEp(ep.episode + 1));
        bar.append(label, el('div', { class: 'an-actions' }, cancel, goNow));
        info.append(bar);
        const tick = setInterval(() => {
          if (cancelled || ctx.signal.aborted) { clearInterval(tick); return; }
          left--;
          label.textContent = `Up next: Episode ${ep.episode + 1} in ${left}s`;
          if (left <= 0) { clearInterval(tick); goEp(ep.episode + 1); }
        }, 1000);
      }, startAt * 1000);
      ctx.signal.addEventListener('abort', () => { cancelled = true; clearTimeout(timer); }, { once: true });
    }

    return frag;
  }
})();
