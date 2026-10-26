/* ============================================================================
   ANIPULSE — views/_shared.js
   Helpers shared across views. Everything here reads AniList-normalised media
   objects (AP.api.norm) — there is no TMDB shape anywhere in this build.
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el } = U;

  /* A section whose content is loaded lazily and swapped in.
     If the loader returns nothing the whole section is removed, so it never
     leaves an empty gap behind. */
  function lazySection({ title, sub, href, hrefText, loader, opts = {}, skeleton = 8, ranked = false, render }) {
    const section = el('section', { class: 'section reveal' });
    section.append(AP.ui.sectionTitle(title, sub, href, hrefText));
    const holder = el('div', { class: 'section-body' });
    holder.append(AP.ui.skeletonRail(skeleton));
    section.append(holder);

    (async () => {
      try {
        const items = await loader();
        if (!section.isConnected && section.parentNode == null && !document.contains(section)) {
          /* still fine to render; the caller may append later */
        }
        holder.innerHTML = '';
        if (!items || !items.length) { section.remove(); return; }
        holder.append(render ? render(items) : AP.ui.rail(items, Object.assign({ ranked }, opts)));
        U.observeReveal(section);
      } catch (e) {
        if (e && e.name === 'AbortError') { section.remove(); return; }
        holder.innerHTML = '';
        holder.append(el('p', { class: 'text-3', style: { fontSize: '.86rem' }, text: 'Could not load this section right now.' }));
      }
    })();

    return section;
  }

  /* A page heading block */
  function pageHead(title, sub, actions) {
    const head = el('div', { class: 'page-head reveal' });
    head.append(el('h1', { text: title }));
    if (sub) head.append(el('p', { text: sub }));
    if (actions) head.append(el('div', { class: 'page-head-actions' }, actions));
    return head;
  }

  /* A grid section that loads lazily */
  function lazyGrid({ title, sub, loader, opts = {}, skeleton = 12, ranked = false }) {
    const section = el('section', { class: 'section' });
    if (title) section.append(AP.ui.sectionTitle(title, sub));
    const holder = el('div', { class: 'section-body' });
    holder.append(AP.ui.skeletonGrid(skeleton));
    section.append(holder);
    (async () => {
      try {
        const items = await loader();
        holder.innerHTML = '';
        if (!items || !items.length) { holder.append(AP.ui.emptyState('Nothing here yet', 'No titles matched this section.')); return; }
        holder.append(AP.ui.grid(items, Object.assign({ ranked }, opts)));
        U.observeReveal(section);
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        holder.innerHTML = '';
        holder.append(AP.ui.errorState('Could not load', e.message || 'Please try again.'));
      }
    })();
    return section;
  }

  /* Build a "Because you watched" rail straight from AniList recommendations. */
  function becauseYouWatched(limit = 1) {
    const hist = AP.State.history.slice(0, limit);
    if (!hist.length) return [];
    return hist.map((h) => {
      const section = el('section', { class: 'section reveal' });
      section.append(AP.ui.sectionTitle('Because you watched ' + h.title, 'More anime picked for you'));
      const holder = el('div', { class: 'section-body' });
      holder.append(AP.ui.skeletonRail(8));
      section.append(holder);
      (async () => {
        try {
          const d = await AP.api.detail(h.id);
          const seen = new Set([h.id]);
          const recs = (d.recommendations || []).filter((r) => {
            if (!r || !r.id || seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });
          holder.innerHTML = '';
          if (!recs.length) { section.remove(); return; }
          holder.append(AP.ui.rail(recs.slice(0, 18)));
          U.observeReveal(section);
        } catch { section.remove(); }
      })();
      return section;
    });
  }

  /* Format a "meta line" string from AniList fields. */
  function metaLine(anime) {
    const bits = [];
    if (anime.year) bits.push(String(anime.year));
    if (anime.formatLabel) bits.push(anime.formatLabel);
    if (anime.episodes) bits.push(U.plural(anime.episodes, 'episode'));
    else if (anime.duration) bits.push(anime.duration + ' min');
    if (anime.score100) bits.push('★ ' + U.fmtScore(anime.score100));
    return bits;
  }

  /* Small inline stat box used by detail + watch sidebars. */
  function statBox(value, key) {
    return el('div', { class: 'stat-box' }, el('div', { class: 'sb-val', text: value }), el('div', { class: 'sb-key', text: key }));
  }

  AP.shared = { lazySection, lazyGrid, pageHead, becauseYouWatched, metaLine, statBox };
})();
