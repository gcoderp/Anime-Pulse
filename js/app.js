/* ============================================================================
   ANIPULSE — app.js
   Bootstrap: settings, header, drawer, command palette, shortcuts, router
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el, $, $$ } = U;
  const I = AP.ICONS;

  /* ======================= DEVICE / MEMORY PROFILE ======================== */
  /* Phones — especially 3 GB Android devices — cannot afford large caches,
     dozens of animated layers or global pointer listeners. We detect a
     constrained device once and let every module read AP.PERF. */
  AP.detectPerf = function detectPerf() {
    const nav = navigator;
    const dm = Number(nav.deviceMemory || 0);
    const cores = Number(nav.hardwareConcurrency || 0);
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.matchMedia('(max-width: 820px)').matches;
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Opera Mini/i.test(nav.userAgent || '');
    const mobile = coarse || uaMobile || narrow;
    const lowMem = (dm > 0 && dm <= 4) || (cores > 0 && cores <= 4) || mobile;
    AP.PERF.deviceMemory = dm;
    AP.PERF.cores = cores;
    AP.PERF.mobile = !!mobile;
    AP.PERF.lowMem = !!lowMem;
    AP.PERF.pageSize = lowMem ? 30 : 60;
    AP.PERF.railLimit = lowMem ? 10 : 14;
    document.documentElement.setAttribute('data-perf', lowMem ? 'low' : 'high');
    document.documentElement.setAttribute('data-device', mobile ? 'mobile' : 'desktop');
    return AP.PERF;
  };

  /* ======================= APPLY SETTINGS TO DOCUMENT ====================== */
  AP.applySettings = function applySettings() {
    const s = AP.State.settings;
    const root = document.documentElement;
    root.setAttribute('data-theme', s.theme || 'dark');
    root.setAttribute('data-accent', s.accent || 'orange');
    root.setAttribute('data-density', s.density || 'cozy');
    root.setAttribute('data-motion', s.motion ? 'on' : 'off');
    // cursor glow (never on low-memory or touch-first devices)
    const glow = $('#cursorGlow');
    if (glow) glow.classList.toggle('on', !!s.cursorGlow && !AP.PERF.lowMem && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    // update theme-color meta for mobile browsers
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', s.theme === 'light' ? '#f6f7fb' : s.theme === 'midnight' ? '#0a0e1a' : '#07070a');
  };

  /* ============================== HEADER ================================== */
  function initHeader() {
    const header = $('#header');
    if (!header) return;
    const onScroll = U.throttle(() => {
      header.classList.toggle('scrolled', window.scrollY > 24);
      const tt = $('#toTop');
      if (tt) tt.classList.toggle('show', window.scrollY > 700);
    }, 100);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ============================== DRAWER ================================== */
  function initDrawer() {
    const drawer = $('#drawer');
    const scrim = $('#scrim');
    if (!drawer) return;
    const open = () => { drawer.classList.add('open'); scrim && scrim.classList.add('show'); document.body.classList.add('no-scroll'); };
    const close = () => { drawer.classList.remove('open'); scrim && scrim.classList.remove('show'); document.body.classList.remove('no-scroll'); };
    $('#menuBtn') && $('#menuBtn').addEventListener('click', open);
    $('#drawerClose') && $('#drawerClose').addEventListener('click', close);
    scrim && scrim.addEventListener('click', close);
    $$('#drawer a').forEach((a) => a.addEventListener('click', close));
    AP._closeDrawer = close;
  }

  /* ============================= DROPDOWN ================================= */
  function initDropdown() {
    const btn = $('#moreBtn');
    const dd = $('#moreDropdown');
    if (!btn || !dd) return;
    const close = () => dd.classList.remove('open');
    btn.addEventListener('click', (e) => { e.stopPropagation(); dd.classList.toggle('open'); });
    document.addEventListener('click', (e) => { if (!dd.contains(e.target) && e.target !== btn) close(); });
    $$('a', dd).forEach((a) => a.addEventListener('click', close));
    document.addEventListener('ap:navigate', close);
  }

  /* ============================ BACK TO TOP =============================== */
  function initToTop() {
    const tt = $('#toTop');
    if (!tt) return;
    tt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ============================ CURSOR GLOW =============================== */
  function initCursorGlow() {
    if (AP.PERF.lowMem) return;
    const glow = $('#cursorGlow');
    if (!glow) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let raf = null, x = 0, y = 0;
    window.addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => { glow.style.transform = `translate(${x}px, ${y}px)`; raf = null; });
    }, { passive: true });
  }

  /* ============================ SEARCH ==================================== */
  function initSearch() {
    $('#searchBtn') && $('#searchBtn').addEventListener('click', () => AP.search.open());
    $('#drawerSearch') && $('#drawerSearch').addEventListener('click', (e) => { e.preventDefault(); AP._closeDrawer && AP._closeDrawer(); setTimeout(() => AP.search.open(), 120); });
    $('#bottomSearch') && $('#bottomSearch').addEventListener('click', (e) => { e.preventDefault(); AP.search.open(); });
    AP.search.init();
  }

  /* ========================= COMMAND PALETTE ============================== */
  const cmdk = { root: null, input: null, list: null, items: [], sel: 0, open: false };

  const COMMANDS = [
    { label: 'Home', hint: 'G H', icon: I.home, action: () => AP.router.go('#/') },
    { label: 'Browse all anime', hint: 'G B', icon: I.grid, action: () => AP.router.go('#/browse') },
    { label: 'Trending', icon: I.trending, action: () => AP.router.go('#/trending') },
    { label: 'Popular', icon: I.fire, action: () => AP.router.go('#/popular') },
    { label: 'Top rated', icon: I.starFill, action: () => AP.router.go('#/top-rated') },
    { label: 'This season', icon: I.calendar, action: () => AP.router.go('#/seasonal') },
    { label: 'Upcoming', icon: I.clock, action: () => AP.router.go('#/upcoming') },
    { label: 'Simulcasts', icon: I.tv, action: () => AP.router.go('#/simulcasts') },
    { label: 'Airing schedule', icon: I.calendar, action: () => AP.router.go('#/schedule') },
    { label: 'Genres', icon: I.filter, action: () => AP.router.go('#/genres') },
    { label: 'Community trending', icon: I.user, action: () => AP.router.go('#/community') },
    { label: 'Surprise me (random)', icon: I.shuffle, action: () => AP.router.go('#/random') },
    { label: 'My watchlist', hint: 'G W', icon: I.bookmark, action: () => AP.router.go('#/watchlist') },
    { label: 'Favourites', icon: I.heart, action: () => AP.router.go('#/favorites') },
    { label: 'Continue watching', icon: I.playCircle, action: () => AP.router.go('#/continue') },
    { label: 'History', icon: I.clock, action: () => AP.router.go('#/history') },
    { label: 'My ratings', icon: I.star, action: () => AP.router.go('#/ratings') },
    { label: 'For you', icon: I.sparkle, action: () => AP.router.go('#/recommendations') },
    { label: 'My stats', icon: I.chart, action: () => AP.router.go('#/stats') },
    { label: 'Settings', hint: 'G S', icon: I.settings, action: () => AP.router.go('#/settings') },
    { label: 'About & APIs', icon: I.info, action: () => AP.router.go('#/about') },
    { label: 'Toggle theme', icon: I.eye, action: () => {
        const order = AP.THEMES_UI; const i = order.indexOf(AP.State.settings.theme);
        AP.State.settings.theme = order[(i + 1) % order.length]; AP.saveSettings(); AP.applySettings();
        AP.ui.toast('Theme: ' + AP.State.settings.theme, 'success');
      } },
    { label: 'Toggle animations', icon: I.sparkle, action: () => {
        AP.State.settings.motion = !AP.State.settings.motion; AP.saveSettings(); AP.applySettings();
        AP.ui.toast('Animations ' + (AP.State.settings.motion ? 'on' : 'off'), 'success');
      } },
  ];

  function buildCmdk() {
    cmdk.root = $('#cmdk');
    if (!cmdk.root) return;
    cmdk.input = el('input', { class: 'cmdk-input', type: 'text', placeholder: 'Type a command or search anime…', autocomplete: 'off', spellcheck: 'false' });
    cmdk.list = el('div', { class: 'cmdk-list' });
    const box = el('div', { class: 'cmdk-box' }, cmdk.input, cmdk.list);
    cmdk.root.append(box);
    cmdk.root.addEventListener('click', (e) => { if (e.target === cmdk.root) closeCmdk(); });
    cmdk.input.addEventListener('input', () => renderCmdk(cmdk.input.value));
    cmdk.input.addEventListener('keydown', onCmdkKey);
    renderCmdk('');
  }

  function setCmdkItems(items) {
    cmdk.items = items;
    cmdk.sel = 0;
    cmdk.list.innerHTML = '';
    if (!items.length) { cmdk.list.append(el('div', { class: 'cmdk-item', style: { color: 'var(--text-3)' }, text: 'No matches' })); return; }
    items.forEach((it, i) => {
      const node = el('div', { class: 'cmdk-item' + (i === 0 ? ' sel' : '') },
        el('span', { html: it.icon || I.search }),
        el('span', { text: it.label }),
        it.hint ? el('span', { class: 'ck-hint', text: it.hint }) : null);
      node.addEventListener('click', () => runCmdk(it));
      node.addEventListener('mousemove', () => { cmdk.sel = i; highlight(); });
      cmdk.list.append(node);
    });
  }

  function highlight() {
    $$('.cmdk-item', cmdk.list).forEach((n, i) => n.classList.toggle('sel', i === cmdk.sel));
  }

  function renderCmdk(q) {
    q = (q || '').trim();
    if (!q) { setCmdkItems(COMMANDS.slice()); return; }
    const lower = q.toLowerCase();
    const cmds = COMMANDS.filter((c) => c.label.toLowerCase().includes(lower));
    setCmdkItems(cmds);
    // dynamic anime search
    searchCmdk(q);
  }

  const searchCmdk = U.debounce(async (q) => {
    if (!q) return;
    try {
      const res = await AP.api.search(q);
      if (cmdk.input.value.trim() !== q) return;
      const cmds = COMMANDS.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
      const results = res.items.slice(0, 8).map((a) => ({
        label: a.title + (a.year ? ' (' + a.year + ')' : ''),
        icon: I.film,
        hint: a.mediaType === 'movie' ? 'Movie' : 'TV',
        action: () => AP.router.go(`#/${a.mediaType === 'movie' ? 'movie' : 'anime'}/${a.id}`),
      }));
      setCmdkItems(cmds.concat(results));
    } catch {}
  }, 300);

  function onCmdkKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdk.sel = Math.min(cmdk.sel + 1, cmdk.items.length - 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cmdk.sel = Math.max(cmdk.sel - 1, 0); highlight(); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = cmdk.items[cmdk.sel]; if (it) runCmdk(it); }
    else if (e.key === 'Escape') { closeCmdk(); }
  }

  function runCmdk(it) {
    closeCmdk();
    try { it.action && it.action(); } catch {}
  }

  function openCmdk() {
    if (!cmdk.root) buildCmdk();
    if (!cmdk.root) return;
    cmdk.open = true;
    cmdk.root.classList.add('open');
    document.body.classList.add('no-scroll');
    cmdk.input.value = '';
    renderCmdk('');
    setTimeout(() => cmdk.input.focus(), 50);
  }
  function closeCmdk() {
    if (!cmdk.root) return;
    cmdk.open = false;
    cmdk.root.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  AP.cmdk = { open: openCmdk, close: closeCmdk, get isOpen() { return cmdk.open; } };

  /* ============================ SHORTCUTS ================================= */
  function initShortcuts() {
    let gPressed = false, gTimer = null;
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

      // Ctrl/Cmd + K → command palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); return; }

      if (typing) return;

      // "/" → focus search
      if (e.key === '/') { e.preventDefault(); AP.search.open(); return; }

      // Escape → close overlays
      if (e.key === 'Escape') { closeCmdk(); AP.search.isOpen && AP.search.close(); return; }

      // g + letter navigation
      if (e.key.toLowerCase() === 'g') { gPressed = true; clearTimeout(gTimer); gTimer = setTimeout(() => { gPressed = false; }, 900); return; }
      if (gPressed) {
        const map = { h: '#/', b: '#/browse', w: '#/watchlist', s: '#/settings', t: '#/trending', c: '#/continue', f: '#/favorites', a: '#/about' };
        const dest = map[e.key.toLowerCase()];
        if (dest) { e.preventDefault(); AP.router.go(dest); }
        gPressed = false;
      }
    });
  }

  /* ============================== FOOTER ================================== */
  function initFooter() {
    const y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
  }

  /* ============================== RIPPLE ================================== */
  function initRipple() {
    if (AP.PERF.lowMem) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const SEL = '.btn, .btn-primary, .btn-ghost, .icon-btn, .chip, .tab, .section-link, .watch-back, .nav-link, .keyword';
    document.addEventListener('pointerdown', (e) => {
      const t = e.target.closest && e.target.closest(SEL);
      if (!t || t.dataset.noRipple) return;
      const r = t.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - r.left - size / 2) + 'px';
      span.style.top = (e.clientY - r.top - size / 2) + 'px';
      if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
      t.appendChild(span);
      setTimeout(() => span.remove(), 640);
    }, { passive: true });
  }

  /* ========================= SCROLL PROGRESS ============================== */
  function initScrollProgress() {
    if (AP.PERF.lowMem) return;
    const bar = el('div', { class: 'scroll-progress', 'aria-hidden': 'true' });
    document.body.appendChild(bar);
    const update = U.throttle(() => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      bar.style.transform = `scaleX(${p})`;
    }, 16);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    document.addEventListener('ap:navigate', () => { bar.style.transform = 'scaleX(0)'; });
    update();
  }

  /* ============================ NAV ACTIVE ================================ */
  document.addEventListener('ap:navigate', () => {
    // ensure drawer links reflect active state via router's setActiveNav (data-nav)
    // nothing else needed here; kept for extensibility
  });

  /* ============================== BOOT ==================================== */
  function boot() {
    AP.detectPerf();
    AP.applySettings();
    initHeader();
    initDrawer();
    initDropdown();
    initToTop();
    initCursorGlow();
    initSearch();
    buildCmdk();
    initShortcuts();
    initFooter();
    initRipple();
    initScrollProgress();

    // Surface a friendly message if the primary API key is rejected.
    AP.router.start();

    // Warm the catalogue cache quietly (skip on constrained devices).
    if (!AP.PERF.lowMem) setTimeout(() => { AP.api.trending().catch(() => {}); }, 400);

    // Mark app ready (removes any boot splash).
    document.body.classList.add('ready');
    const splash = $('#boot');
    if (splash) { splash.classList.add('hide'); setTimeout(() => splash.remove(), 500); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
