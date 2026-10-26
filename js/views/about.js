/* ============================================================================
   ANIPULSE — views/about.js
   About page + live API status + feature overview (AniList-only build)
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el } = U;
  const I = AP.ICONS;
  const S = AP.shared;

  function statusDot(state) {
    const cls = state === 'ok' ? 'ok' : state === 'bad' ? 'bad' : 'unknown';
    return el('span', { class: 'status-dot ' + cls, title: state });
  }

  function aboutCard(icon, title, body, tag) {
    const c = el('div', { class: 'about-card' });
    c.append(el('h3', {}, el('span', { html: icon }), el('span', { text: title })));
    c.append(el('p', { text: body }));
    if (tag) c.append(el('span', { class: 'ac-tag', text: tag }));
    return c;
  }

  AP.router.register('about', () => {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container' });
    page.append(container);

    container.append(S.pageHead('About AniPulse', 'A fast, modern, AniList-powered anime streaming experience — rebuilt from the ground up.'));

    /* Intro */
    const intro = el('section', { class: 'section reveal', style: { marginTop: '10px' } });
    intro.append(el('p', {
      class: 'text-2',
      style: { maxWidth: '760px', fontSize: '1rem', lineHeight: '1.8' },
      text: 'AniPulse is a single-page streaming front-end that pulls its entire catalogue from AniList — one consistent, key-less GraphQL source of truth. Every title, poster, banner, score, tag, ranking, airing schedule, character, voice actor, studio, relation and recommendation comes from AniList, so metadata is always deep, consistent and complete. Playback is handled by a single focused provider, AniFrame, which reads AniList ids directly: https://aniframe-api.pages.dev/{anilistId}/{episode}. Because both sides speak the same id space, there is no mapping layer, no fuzzy title matching and no season guessing — the player always opens the exact entry you are looking at.',
    }));
    container.append(intro);

    /* API status */
    const statusSec = el('section', { class: 'section reveal' });
    statusSec.append(AP.ui.sectionTitle('Live API Status', 'Services powering AniPulse'));
    const statusPanel = el('div', { class: 'settings-panel' });

    const anilistRow = el('div', { class: 'setting-row' },
      el('div', { class: 'sr-text' },
        el('b', { text: 'AniList GraphQL' }),
        el('small', { text: 'Catalogue, metadata, rankings, schedules, characters, relations & recommendations.' })),
      el('div', { class: 'sr-ctrl', style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        statusDot(AP.State.apiStatus.anilist), el('span', { class: 'text-3', text: 'Checking…' })));

    const playerRow = el('div', { class: 'setting-row' },
      el('div', { class: 'sr-text' },
        el('b', { text: 'AniFrame' }),
        el('small', { text: 'The only playback source. Embeds https://aniframe-api.pages.dev/{anilistId}/{episode}.' })),
      el('div', { class: 'sr-ctrl', style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        statusDot(AP.PLAYER.status === 'ok' ? 'ok' : AP.PLAYER.status === 'bad' ? 'bad' : 'unknown'),
        el('span', { class: 'text-3', text: 'Checking…' })));

    statusPanel.append(anilistRow, playerRow);

    const testBtn = el('button', { class: 'btn btn-primary btn-sm', html: I.refresh + '<span>Run connection test</span>' });
    testBtn.addEventListener('click', async () => {
      testBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span><span>Testing…</span>';
      const [ok, playerOk] = await Promise.all([AP.api.ping(), AP.api.pingPlayer()]);
      testBtn.innerHTML = I.refresh + '<span>Run connection test</span>';
      const label = anilistRow.querySelector('.sr-ctrl span:last-child');
      const dot = anilistRow.querySelector('.status-dot');
      dot.className = 'status-dot ' + (ok ? 'ok' : 'bad');
      label.textContent = ok ? 'Connected' : 'Unreachable';
      const pdot = playerRow.querySelector('.status-dot');
      const plabel = playerRow.querySelector('.sr-ctrl span:last-child');
      pdot.className = 'status-dot ' + (playerOk ? 'ok' : 'bad');
      plabel.textContent = playerOk ? 'Reachable' : 'Unreachable';
      AP.ui.toast(ok && playerOk ? 'All services reachable' : 'One or more services are unreachable', ok && playerOk ? 'success' : 'error');
    });
    statusPanel.append(el('div', { class: 'setting-row' },
      el('div', { class: 'sr-text' }, el('b', { text: 'Connection test' }), el('small', { text: 'Verify AniList and AniFrame are reachable from your network.' })),
      el('div', { class: 'sr-ctrl' }, testBtn)));
    statusSec.append(statusPanel);
    container.append(statusSec);

    /* Data sources */
    const srcSec = el('section', { class: 'section reveal' });
    srcSec.append(AP.ui.sectionTitle('Data Sources', 'What powers each part of the site'));
    const grid = el('div', { class: 'about-grid' });
    grid.append(aboutCard(I.sparkle, 'AniList GraphQL', 'The single source of truth. Catalogue, titles, posters, banners, scores, popularity, favourites, tags, rankings, score/status distributions, airing schedules, relations, characters & voice actors, staff, streaming episodes and recommendations — all fetched key-lessly from graphql.anilist.co and cached aggressively.', 'Primary · key-less'));
    grid.append(aboutCard(I.play, 'AniFrame', 'The single playback source. AniFrame embeds via https://aniframe-api.pages.dev/{anilistId}/{episode}. Because it reads AniList ids directly, the exact entry you open is the exact entry that plays — no mapping, no season guessing, no overflow.', 'Only source'));
    grid.append(aboutCard(I.bolt, 'Browser Storage', 'Your watchlist, favourites, ratings, history, continue-watching progress and preferences are stored locally in your browser. Nothing is uploaded, and you can export or import a JSON backup at any time.', 'Local · private'));
    grid.append(aboutCard(I.layers, 'Memory-Aware Rendering', 'Caches are capped, requests are de-duplicated and rate-limited, rails are virtualised on low-memory devices, and heavy effects are disabled when the device reports limited RAM — so the app stays smooth on 3 GB phones.', 'Performance'));
    srcSec.append(grid);
    container.append(srcSec);

    /* Features */
    const featSec = el('section', { class: 'section reveal' });
    featSec.append(AP.ui.sectionTitle('Features', 'Everything built into AniPulse'));
    const feats = [
      'Deep AniList metadata: tags, rankings, score & status distributions, relations, characters, staff and recommendations.',
      'Robust episode lists that always render, with chunked loading and AniFrame thumbnails when available.',
      'One playback source — AniFrame — using AniList ids directly.',
      'Watchlist, favourites, ratings, history and continue-watching — stored locally.',
      'Personalised "Because you watched" and "For You" recommendation rails powered by AniList recommendations.',
      'Airing schedule, seasonal simulcasts and a random picker.',
      'Full-text search with SEARCH_MATCH, instant results and recent-search history.',
      'A command palette (Ctrl/⌘ + K) for keyboard-first navigation.',
      'Four themes, eight accent colours, three density modes and a motion toggle.',
      'Fully responsive layout tuned for phones, tablets and desktops.',
      'Memory-aware rendering that stays smooth on 3 GB RAM phones.',
      'Exportable / importable library backup as JSON.',
    ];
    const featList = el('div', { class: 'about-grid' });
    feats.forEach((f) => {
      const card = el('div', { class: 'about-card' });
      card.append(el('p', {}, el('span', { html: I.check, style: { color: 'var(--accent)', marginRight: '8px' } }), el('span', { text: f })));
      featList.append(card);
    });
    featSec.append(featList);
    container.append(featSec);

    /* Keyboard shortcuts */
    const kbSec = el('section', { class: 'section reveal' });
    kbSec.append(AP.ui.sectionTitle('Keyboard Shortcuts', 'Get around faster'));
    const kbPanel = el('div', { class: 'settings-panel' });
    const shortcuts = [
      ['Ctrl / ⌘ + K', 'Open the command palette'],
      ['/', 'Focus search'],
      ['G then H', 'Go home'],
      ['G then B', 'Go to browse'],
      ['G then W', 'Go to watchlist'],
      ['G then S', 'Go to settings'],
      ['Esc', 'Close overlays'],
    ];
    shortcuts.forEach(([k, d]) => kbPanel.append(el('div', { class: 'setting-row' },
      el('div', { class: 'sr-text' }, el('b', { text: d })),
      el('div', { class: 'sr-ctrl' }, el('kbd', { class: 'badge', style: { fontFamily: 'monospace', fontSize: '.8rem' }, text: k })))));
    kbSec.append(kbPanel);
    container.append(kbSec);

    /* Disclaimer */
    const disc = el('section', { class: 'section reveal' });
    disc.append(el('p', { class: 'text-3', style: { fontSize: '.82rem', lineHeight: '1.7', maxWidth: '760px' },
      text: 'AniPulse does not host or store any video content. All metadata is provided by AniList, and playback is embedded from AniFrame. This project is intended for educational and personal use only.' }));
    container.append(disc);

    const cta = el('div', { style: { textAlign: 'center', margin: '30px 0' } },
      el('a', { class: 'btn btn-primary', href: '#/', html: I.home + '<span>Back to home</span>' }));
    container.append(cta);

    /* Kick off a live status check */
    AP.api.ping().then((ok) => {
      AP.State.apiStatus.anilist = ok ? 'ok' : 'bad';
      const dot = anilistRow.querySelector('.status-dot');
      const label = anilistRow.querySelector('.sr-ctrl span:last-child');
      dot.className = 'status-dot ' + (ok ? 'ok' : 'bad');
      label.textContent = ok ? 'Connected' : 'Unreachable';
    }).catch(() => {});
    AP.api.pingPlayer().then((ok) => {
      const dot = playerRow.querySelector('.status-dot');
      const label = playerRow.querySelector('.sr-ctrl span:last-child');
      dot.className = 'status-dot ' + (ok ? 'ok' : 'bad');
      label.textContent = ok ? 'Reachable' : 'Unreachable';
    }).catch(() => {});

    return page;
  });
})();
