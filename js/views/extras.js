/* ============================================================================
   ANIPULSE — views/extras.js
   Airing schedule (AniList AiringSchedule), random picker, community trending.
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el } = U;
  const I = AP.ICONS;
  const S = AP.shared;

  /* ------------------------------ SCHEDULE ------------------------------- */
  AP.router.register('schedule', () => {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);
    container.append(S.pageHead('Airing Schedule', 'Anime releasing new episodes over the next 7 days. Times are shown in your local timezone.'));

    const holder = el('div', {});
    holder.append(AP.ui.skeletonGrid(12));
    container.append(holder);

    (async () => {
      try {
        const res = await AP.api.schedule(7);
        holder.innerHTML = '';
        if (!res.items.length) {
          holder.append(AP.ui.emptyState('No schedule data', 'Nothing is airing in the next 7 days.'));
          return;
        }
        // Group by local calendar day.
        const groups = {};
        res.items.forEach((it) => {
          const d = new Date(it.airingAt * 1000);
          const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          (groups[key] = groups[key] || []).push(it);
        });
        const today = new Date(); today.setHours(0, 0, 0, 0);
        Object.keys(groups).sort().forEach((key) => {
          const d = new Date(key + 'T00:00:00');
          const isToday = d.getTime() === today.getTime();
          const sec = el('div', { class: 'schedule-day' });
          sec.append(el('h3', {},
            el('span', { text: d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) }),
            isToday ? el('span', { class: 'badge badge-live', text: 'Today' }) : null
          ));
          groups[key].sort((a, b) => a.airingAt - b.airingAt).forEach((it) => {
            const m = it.media;
            const time = new Date(it.airingAt * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const item = el('a', { class: 'schedule-item', href: `#/watch/${m.id}/${it.episode || 1}` });
            const poster = el('div', { class: 'si-poster' });
            poster.append(U.poster(m.cover, m.title));
            item.append(poster);
            item.append(el('div', { class: 'si-body' },
              el('div', { class: 'si-title', text: m.title }),
              el('div', { class: 'si-sub', text: 'Episode ' + (it.episode || '?') + (m.formatLabel ? ' · ' + m.formatLabel : '') })
            ));
            item.append(el('span', { class: 'si-time', text: time }));
            sec.append(item);
          });
          holder.append(sec);
        });
        U.observeReveal(holder);
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        holder.innerHTML = '';
        holder.append(AP.ui.errorState('Could not load schedule', e.message || 'Please try again.', () => AP.router.render()));
      }
    })();

    return page;
  });

  /* ------------------------------- RANDOM -------------------------------- */
  AP.router.register('random', () => {
    const page = el('div', { class: 'page' });
    page.append(el('div', { style: { padding: '120px 24px', display: 'grid', placeItems: 'center', gap: '18px' } },
      el('div', { class: 'player-spinner' }),
      el('p', { class: 'text-2', text: 'Finding something great…' })
    ));
    (async () => {
      try {
        const pick = await AP.api.random();
        if (pick) AP.router.go(`#/anime/${pick.id}`);
        else AP.router.go('#/');
      } catch { AP.router.go('#/'); }
    })();
    return page;
  });

  /* ----------------------------- COMMUNITY ------------------------------- */
  AP.router.register('community', () => {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);
    container.append(S.pageHead('Community Trending', 'What the global anime community is watching right now.', [el('span', { class: 'badge badge-accent', text: 'Powered by AniList' })]));
    const holder = el('div', {});
    holder.append(AP.ui.skeletonGrid(12));
    container.append(holder);
    (async () => {
      try {
        const res = await AP.api.trending(1, { perPage: 30 });
        holder.innerHTML = '';
        if (!res.items.length) { holder.append(AP.ui.emptyState('No data', 'Community data is unavailable right now.')); return; }
        const grid = AP.ui.grid(res.items);
        holder.append(grid);
        U.observeReveal(holder);
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        holder.innerHTML = '';
        holder.append(AP.ui.errorState('Could not load', e.message || 'Please try again.', () => AP.router.render()));
      }
    })();
    return page;
  });
})();
