/* ============================================================================
   ANIPULSE — components.js
   Reusable UI builders: cards, rails, grids, toasts, modals, states
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el, esc } = U;
  const I = AP.ICONS;

  /* -------------------------------- TOAST -------------------------------- */
  function toast(msg, type = 'info', ms = 2600) {
    const root = U.$('#toastRoot');
    if (!root) return;
    const icon = type === 'success' ? I.checkCircle : type === 'error' ? I.info : I.sparkle;
    const node = el('div', { class: 'toast ' + type, html: icon + '<span>' + esc(msg) + '</span>' });
    root.append(node);
    setTimeout(() => { node.classList.add('out'); setTimeout(() => node.remove(), 350); }, ms);
  }

  /* -------------------------------- MODAL -------------------------------- */
  function modal({ title, body, wide, footer, onClose }) {
    const root = U.$('#modalRoot');
    root.innerHTML = '';
    root.classList.add('open');
    const backdrop = el('div', { class: 'modal-backdrop' });
    const close = () => { root.classList.remove('open'); root.innerHTML = ''; document.body.classList.remove('no-scroll'); onClose && onClose(); };
    backdrop.addEventListener('click', close);
    const head = el('div', { class: 'modal-head' }, el('h3', { text: title || '' }), el('button', { class: 'modal-close', html: I.close, 'aria-label': 'Close', onclick: close }));
    const bodyEl = el('div', { class: 'modal-body' });
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.append(body);
    const box = el('div', { class: 'modal' + (wide ? ' modal-wide' : '') }, head, bodyEl);
    if (footer) box.append(el('div', { class: 'modal-body', style: { paddingTop: '0' } }, footer));
    root.append(backdrop, box);
    document.body.classList.add('no-scroll');
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    return { close, root };
  }

  /* ------------------------------ SECTION -------------------------------- */
  function sectionTitle(title, sub, linkHref, linkText) {
    const left = el('div', { class: 'section-title' }, el('span', { class: 'bar' }));
    const t = el('div', {}, el('span', { text: title }));
    if (sub) t.append(el('small', { text: sub }));
    left.append(t);
    const head = el('div', { class: 'section-head' }, left);
    if (linkHref) head.append(el('a', { class: 'section-link', href: linkHref, html: esc(linkText || 'View all') + I.chevR }));
    return head;
  }

  /* ------------------------------- BADGES -------------------------------- */
  function airingBadge(anime) {
    if (anime.rawStatus === 'RELEASING') {
      return el('span', { class: 'badge badge-live', text: anime.nextEp ? 'EP ' + anime.nextEp.episode + ' soon' : 'Airing' });
    }
    if (anime.rawStatus === 'NOT_YET_RELEASED') return el('span', { class: 'badge badge-soon', text: 'Upcoming' });
    if (anime.rawStatus === 'HIATUS') return el('span', { class: 'badge badge-warn', text: 'Hiatus' });
    return null;
  }

  /* -------------------------------- CARD --------------------------------- */
  function card(anime, opts = {}) {
    const { wide, rank, showProgress, progress, hideActions } = opts;
    const isMovie = anime.format === 'MOVIE';
    const cardEl = el('div', { class: 'card' + (wide ? ' card-wide' : ''), dataset: { id: anime.id, type: anime.mediaType || 'tv' } });

    const posterWrap = el('div', { class: 'card-poster' });
    posterWrap.style.setProperty('--poster-tint', anime.coverColor || 'var(--surface-3)');
    if (anime.cover) posterWrap.append(U.poster(anime.cover, anime.title));
    else posterWrap.append(el('div', { class: 'fallback', text: anime.title }));

    if (!AP.PERF.lowMem) posterWrap.append(el('span', { class: 'card-shine' }));

    const top = el('div', { class: 'card-top' });
    const badges = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    if (anime.score) badges.append(el('span', { class: 'badge badge-score', html: I.starFill.replace('width="24"', 'width="11"') + U.fmtScore(anime.score100) }));
    const ab = airingBadge(anime);
    if (ab) badges.append(ab);
    top.append(badges);
    posterWrap.append(top);

    if (!hideActions) {
      const actions = el('div', { class: 'card-actions' });
      const wlOn = AP.Lib.inWatchlist(anime.id);
      const favOn = AP.Lib.inFavorites(anime.id);
      const wlBtn = el('button', { class: 'card-act' + (wlOn ? ' on' : ''), 'aria-label': 'Watchlist', html: wlOn ? I.bookmarkFill : I.bookmark });
      wlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const on = AP.Lib.toggleWatchlist(anime);
        wlBtn.classList.toggle('on', on); wlBtn.innerHTML = on ? I.bookmarkFill : I.bookmark;
        toast(on ? 'Added to watchlist' : 'Removed from watchlist', on ? 'success' : 'info');
      });
      const favBtn = el('button', { class: 'card-act' + (favOn ? ' on' : ''), 'aria-label': 'Favourite', html: favOn ? I.heartFill : I.heart });
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const on = AP.Lib.toggleFavorite(anime);
        favBtn.classList.toggle('on', on); favBtn.innerHTML = on ? I.heartFill : I.heart;
        toast(on ? 'Added to favourites' : 'Removed from favourites', on ? 'success' : 'info');
      });
      actions.append(wlBtn, favBtn);
      posterWrap.append(actions);
    }

    posterWrap.append(el('div', { class: 'card-play', html: I.play }));

    const overlay = el('div', { class: 'card-overlay' });
    const meta = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } });
    if (anime.year) meta.append(el('span', { class: 'badge', text: anime.year }));
    if (isMovie) meta.append(el('span', { class: 'badge', text: 'Movie' }));
    else if (anime.episodes) meta.append(el('span', { class: 'badge', text: anime.episodes + ' eps' }));
    else if (anime.formatLabel) meta.append(el('span', { class: 'badge', text: anime.formatLabel }));
    overlay.append(meta);
    posterWrap.append(overlay);

    if (rank) cardEl.append(el('span', { class: 'card-rank', text: rank }));
    if (showProgress && progress) posterWrap.append(el('div', { class: 'card-progress' }, el('i', { style: { width: Math.min(100, progress) + '%' } })));

    cardEl.append(posterWrap);

    const body = el('div', { class: 'card-body' });
    body.append(el('div', { class: 'card-title clamp-2', text: anime.title }));
    const cm = el('div', { class: 'card-meta' });
    const bits = [];
    if (anime.year) bits.push(anime.year);
    if (anime.score) bits.push('★ ' + U.fmtScore(anime.score100));
    if (anime.formatLabel) bits.push(anime.formatLabel);
    bits.forEach((b, i) => { if (i) cm.append(el('span', { class: 'dot' })); cm.append(el('span', { text: b })); });
    body.append(cm);
    cardEl.append(body);

    cardEl.addEventListener('click', () => AP.router.go(`#/anime/${anime.id}`));
    return cardEl;
  }

  /* -------------------------------- RAIL --------------------------------- */
  function rail(items, opts = {}) {
    const railEl = el('div', { class: 'rail' });
    const track = el('div', { class: 'rail-track' });
    const limit = opts.all ? items.length : Math.max(4, AP.PERF.railLimit || 12);
    const list = items.length > limit ? items.slice(0, limit) : items;
    list.forEach((it, i) => track.append(card(it, Object.assign({}, opts, { rank: opts.ranked ? i + 1 : undefined }))));
    const prev = el('button', { class: 'rail-nav prev', html: I.chevL, 'aria-label': 'Scroll left' });
    const next = el('button', { class: 'rail-nav next', html: I.chevR, 'aria-label': 'Scroll right' });
    const scrollAmt = () => Math.max(track.clientWidth * 0.8, 300);
    prev.addEventListener('click', () => track.scrollBy({ left: -scrollAmt(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: scrollAmt(), behavior: 'smooth' }));
    const update = () => {
      prev.toggleAttribute('disabled', track.scrollLeft <= 4);
      next.toggleAttribute('disabled', track.scrollLeft + track.clientWidth >= track.scrollWidth - 4);
    };
    track.addEventListener('scroll', U.throttle(update, 120));
    if (!AP.PERF.lowMem && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let down = false, sx = 0, sl = 0, moved = false;
      track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; track.style.cursor = 'grabbing'; });
      track.addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; track.scrollLeft = sl - dx; });
      const stop = () => { down = false; track.style.cursor = ''; };
      track.addEventListener('pointerup', stop);
      track.addEventListener('pointercancel', stop);
      track.addEventListener('pointerleave', stop);
      track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    }
    railEl.append(prev, track, next);
    requestAnimationFrame(update);
    return railEl;
  }

  /* -------------------------------- GRID --------------------------------- */
  function grid(items, opts = {}) {
    const g = el('div', { class: 'grid' + (opts.small ? ' grid-sm' : '') });
    items.forEach((it, i) => g.append(card(it, Object.assign({}, opts, { rank: opts.ranked ? i + 1 : undefined }))));
    return g;
  }

  /* ----------------------------- SIDE CARD ------------------------------- */
  function sideCard(anime) {
    const c = el('a', { class: 'side-card', href: `#/anime/${anime.id}` });
    const thumb = el('div', { class: 'sc-thumb' });
    if (anime.cover) thumb.append(U.poster(anime.cover, anime.title));
    else thumb.append(el('div', { class: 'fallback', text: anime.title }));
    if (anime.score) thumb.append(el('span', { class: 'sc-score', html: I.starFill.replace('width="24"', 'width="10"') + U.fmtScore(anime.score100) }));
    c.append(thumb);
    const body = el('div', { class: 'sc-body' });
    body.append(el('div', { class: 'sc-title clamp-2', text: anime.title }));
    const bits = [];
    if (anime.year) bits.push(anime.year);
    if (anime.episodes) bits.push(anime.episodes + ' eps');
    else if (anime.formatLabel) bits.push(anime.formatLabel);
    if (bits.length) body.append(el('div', { class: 'sc-meta', text: bits.join(' · ') }));
    c.append(body);
    return c;
  }

  /* ------------------------------ TOP 10 RAIL ---------------------------- */
  function top10Rail(items) {
    const railEl = el('div', { class: 'rail top10-rail' });
    const track = el('div', { class: 'rail-track' });
    items.slice(0, 10).forEach((it, i) => {
      const wrap = el('div', { class: 'top10-item' });
      wrap.append(el('span', { class: 'top10-num', text: String(i + 1) }));
      wrap.append(card(it));
      track.append(wrap);
    });
    const prev = el('button', { class: 'rail-nav prev', html: I.chevL, 'aria-label': 'Scroll left' });
    const next = el('button', { class: 'rail-nav next', html: I.chevR, 'aria-label': 'Scroll right' });
    const scrollAmt = () => Math.max(track.clientWidth * 0.8, 300);
    prev.addEventListener('click', () => track.scrollBy({ left: -scrollAmt(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: scrollAmt(), behavior: 'smooth' }));
    const update = () => {
      prev.toggleAttribute('disabled', track.scrollLeft <= 4);
      next.toggleAttribute('disabled', track.scrollLeft + track.clientWidth >= track.scrollWidth - 4);
    };
    track.addEventListener('scroll', U.throttle(update, 120));
    railEl.append(prev, track, next);
    requestAnimationFrame(update);
    return railEl;
  }

  /* ------------------------------- TICKER -------------------------------- */
  function ticker(items) {
    const wrap = el('div', { class: 'ticker' });
    const track = el('div', { class: 'ticker-track' });
    const make = () => items.map((it) => el('a', { class: 'ticker-item', href: `#/anime/${it.id}` },
      el('span', { class: 'ti-dot' }),
      el('span', { class: 'ti-title', text: it.title }),
      it.score ? el('span', { class: 'ti-score', html: I.starFill.replace('width="24"', 'width="10"') + U.fmtScore(it.score100) }) : null));
    make().forEach((n) => track.append(n));
    make().forEach((n) => track.append(n));
    wrap.append(el('span', { class: 'ticker-label', html: I.bolt + '<span>Trending</span>' }), track);
    return wrap;
  }

  /* ------------------------------ SKELETONS ------------------------------ */
  function skeletonCard(wide) {
    const c = el('div', { class: 'card' + (wide ? ' card-wide' : '') });
    c.append(el('div', { class: 'skeleton card-poster' }));
    c.append(el('div', { class: 'card-body' }, el('div', { class: 'skeleton', style: { height: '14px', width: '80%', marginBottom: '8px' } }), el('div', { class: 'skeleton', style: { height: '11px', width: '50%' } })));
    return c;
  }
  function skeletonRail(n = 8) {
    const track = el('div', { class: 'rail-track' });
    for (let i = 0; i < n; i++) track.append(skeletonCard());
    return el('div', { class: 'rail' }, track);
  }
  function skeletonGrid(n = 12) {
    const g = el('div', { class: 'grid' });
    for (let i = 0; i < n; i++) g.append(skeletonCard());
    return g;
  }

  /* ------------------------------- STATES -------------------------------- */
  function emptyState(title, text, action) {
    const box = el('div', { class: 'empty-state' });
    box.append(el('div', { class: 'es-icon', html: I.sparkle }));
    box.append(el('h3', { text: title }));
    box.append(el('p', { text: text }));
    if (action) box.append(action);
    return box;
  }
  function errorState(title, text, retry) {
    const box = el('div', { class: 'empty-state' });
    box.append(el('div', { class: 'es-icon', html: I.info }));
    box.append(el('h3', { text: title }));
    box.append(el('p', { text: text }));
    if (retry) box.append(el('button', { class: 'btn btn-primary', html: I.refresh + '<span>Try again</span>', onclick: retry }));
    return box;
  }

  /* ------------------------------ RATING --------------------------------- */
  function ratingStars(value, onPick) {
    const wrap = el('div', { class: 'rating-stars', style: { display: 'flex', gap: '4px' } });
    for (let i = 1; i <= 5; i++) {
      const st = el('button', { class: 'star-btn', style: { color: i <= value ? 'var(--accent)' : 'var(--text-3)' }, html: i <= value ? I.starFill : I.star, 'aria-label': i + ' stars' });
      st.querySelector('svg').style.width = '22px';
      st.querySelector('svg').style.height = '22px';
      st.addEventListener('click', () => onPick(i));
      wrap.append(st);
    }
    return wrap;
  }

  /* --------------------------- LOGO OR TITLE ----------------------------- */
  /* AniList has no logo assets, so the title itself is the wordmark. */
  function logoOrTitle(anime, cls) {
    return el('h1', { class: cls === 'hero-logo' ? 'hero-title' : 'detail-title', text: anime.title });
  }

  AP.ui = {
    toast, modal, sectionTitle, card, rail, grid, skeletonCard, skeletonRail, skeletonGrid,
    emptyState, errorState, ratingStars, logoOrTitle, sideCard, top10Rail, ticker, airingBadge,
  };
})();
