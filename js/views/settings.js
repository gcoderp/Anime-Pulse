/* ============================================================================
   ANIPULSE — views/settings.js
   Appearance, playback, content, data & AniList/AniFrame status.
   No TMDB keys, no region/language — AniList needs none of that.
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});
  const U = AP.utils;
  const { el } = U;
  const I = AP.ICONS;
  const S = AP.shared;

  function settingRow(title, desc, control) {
    return el('div', { class: 'setting-row' },
      el('div', { class: 'sr-text' }, el('b', { text: title }), desc ? el('small', { text: desc }) : null),
      el('div', { class: 'sr-ctrl' }, control));
  }

  function toggle(key, onChange) {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!AP.State.settings[key];
    input.addEventListener('change', () => { AP.State.settings[key] = input.checked; AP.saveSettings(); onChange && onChange(input.checked); });
    return el('label', { class: 'switch' }, input, el('span'));
  }

  function select(key, options, onChange) {
    const sel = el('select', { class: 'select' });
    options.forEach((o) => sel.append(el('option', { value: o.value, text: o.label })));
    sel.value = AP.State.settings[key];
    sel.addEventListener('change', () => { AP.State.settings[key] = sel.value; AP.saveSettings(); onChange && onChange(sel.value); });
    return sel;
  }

  AP.router.register('settings', () => {
    const page = el('div', { class: 'page' });
    const container = el('div', { class: 'container settings-wrap' });
    page.append(container);
    container.append(S.pageHead('Settings', 'Personalise your AniPulse experience.'));

    /* Appearance */
    container.append(el('div', { class: 'settings-group-title', text: 'Appearance' }));
    const appearance = el('div', { class: 'settings-panel' });

    const themeSel = select('theme', AP.THEMES_UI.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })), () => AP.applySettings());
    appearance.append(settingRow('Theme', 'Choose the overall colour scheme.', themeSel));

    const swatches = el('div', { class: 'swatches' });
    AP.ACCENTS.forEach((acc) => {
      const sw = el('button', { class: 'swatch' + (AP.State.settings.accent === acc ? ' active' : ''), 'aria-label': acc, style: { background: accentColor(acc) } });
      sw.addEventListener('click', () => {
        AP.State.settings.accent = acc; AP.saveSettings(); AP.applySettings();
        U.$$('.swatch', swatches).forEach((s) => s.classList.remove('active')); sw.classList.add('active');
      });
      swatches.append(sw);
    });
    appearance.append(settingRow('Accent colour', 'Used for highlights, buttons and glows.', swatches));

    appearance.append(settingRow('Density', 'Adjust spacing and card sizes.', select('density', AP.DENSITIES.map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) })), () => AP.applySettings())));
    appearance.append(settingRow('Animations', 'Enable smooth motion and transitions.', toggle('motion', () => AP.applySettings())));
    appearance.append(settingRow('Cursor glow', 'Ambient glow that follows your cursor (desktop).', toggle('cursorGlow', () => AP.applySettings())));
    appearance.append(settingRow('Hero auto-rotate', 'Automatically cycle the featured titles.', toggle('heroAutoplay')));
    container.append(appearance);

    /* Playback */
    container.append(el('div', { class: 'settings-group-title', text: 'Playback' }));
    const playback = el('div', { class: 'settings-panel' });

    const playerInfo = el('div', { class: 'player-source-card' });
    playerInfo.append(
      el('div', { class: 'psc-badge' }, el('span', { class: 'sb-dot' }), el('span', { text: 'AniFrame' })),
      el('div', { class: 'psc-text' },
        el('b', { text: 'Single playback source' }),
        el('small', { text: 'AniFrame reads AniList ids directly, so every title plays from https://aniframe-api.pages.dev/{anilistId}/{episode}. No other servers are used.' }))
    );
    const testPlayer = el('button', { class: 'btn btn-outline btn-sm', html: I.refresh + '<span>Test AniFrame</span>' });
    testPlayer.addEventListener('click', async () => {
      const old = testPlayer.innerHTML;
      testPlayer.innerHTML = '<span class="spinner"></span><span>Testing…</span>';
      const ok = await AP.api.pingPlayer();
      testPlayer.innerHTML = old;
      AP.ui.toast(ok ? 'AniFrame is reachable' : 'AniFrame could not be reached', ok ? 'success' : 'error');
    });
    playerInfo.append(el('div', { class: 'psc-actions' }, testPlayer));
    playback.append(el('div', { class: 'setting-row setting-row-stack' }, playerInfo));

    playback.append(settingRow('Autoplay next episode', 'Show an auto-advance prompt while watching.', toggle('autoplayNext')));
    playback.append(settingRow('Episode navigation', 'Show previous / next episode controls.', toggle('epNav')));
    playback.append(settingRow('Auto-advance delay', 'Seconds before automatically playing the next episode.', rangeControl('autoNextDelay', 3, 20, 1, 's')));
    container.append(playback);

    /* Content */
    container.append(el('div', { class: 'settings-group-title', text: 'Content' }));
    const content = el('div', { class: 'settings-panel' });
    content.append(settingRow('Hide adult content', 'Filter adult results from all listings.', toggle('adultFilter')));
    content.append(settingRow('Characters & staff', 'Show characters, voice actors and staff from AniList.', toggle('useExtras')));
    content.append(settingRow('Reduce data usage', 'Load fewer rails and lighter images on slow devices.', toggle('reduceData')));
    container.append(content);

    /* API */
    container.append(el('div', { class: 'settings-group-title', text: 'Data source' }));
    const apiPanel = el('div', { class: 'settings-panel' });
    const testBtn = el('button', { class: 'btn btn-outline btn-sm', html: I.refresh + '<span>Test AniList</span>' });
    testBtn.addEventListener('click', async () => {
      testBtn.innerHTML = '<div class="spinner"></div>';
      const ok = await AP.api.ping();
      testBtn.innerHTML = I.refresh + '<span>Test AniList</span>';
      AP.ui.toast(ok ? 'AniList connection OK' : 'AniList connection failed', ok ? 'success' : 'error');
    });
    apiPanel.append(settingRow('AniList GraphQL', 'Key-less public API at graphql.anilist.co. All catalogue, metadata, episodes and schedule data comes from here.', testBtn));
    container.append(apiPanel);

    /* Data */
    container.append(el('div', { class: 'settings-group-title', text: 'Data' }));
    const dataPanel = el('div', { class: 'settings-panel' });
    const exportBtn = el('button', { class: 'btn btn-outline btn-sm', html: I.download + '<span>Export</span>' });
    exportBtn.addEventListener('click', () => {
      const blob = new Blob([AP.Lib.exportData()], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = el('a', { href: url, download: 'anipulse-backup.json' });
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url); AP.ui.toast('Exported', 'success');
    });
    const importBtn = el('button', { class: 'btn btn-outline btn-sm', html: I.download + '<span>Import</span>' });
    importBtn.addEventListener('click', () => {
      const input = el('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
      input.addEventListener('change', () => {
        const f = input.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => { try { AP.Lib.importData(r.result); AP.ui.toast('Imported', 'success'); AP.router.render(); } catch { AP.ui.toast('Invalid file', 'error'); } };
        r.readAsText(f);
      });
      document.body.append(input); input.click(); input.remove();
    });
    dataPanel.append(settingRow('Backup & restore', 'Export or import your library as JSON.', el('div', { style: { display: 'flex', gap: '8px' } }, exportBtn, importBtn)));
    const clearCacheBtn = el('button', { class: 'btn btn-outline btn-sm', html: I.trash + '<span>Clear cache</span>' });
    clearCacheBtn.addEventListener('click', () => { AP.clearCache(); AP.ui.toast('Cache cleared', 'success'); });
    dataPanel.append(settingRow('Cached data', 'Clear cached AniList responses to force a refresh.', clearCacheBtn));
    container.append(dataPanel);

    container.append(el('div', { style: { textAlign: 'center', margin: '30px 0' } }, el('a', { class: 'btn btn-outline', href: '#/stats', html: I.chart + '<span>View your stats</span>' })));

    return page;
  });

  function rangeControl(key, min, max, step, suffix) {
    const wrap = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } });
    const input = el('input', { type: 'range', class: 'input-range', min, max, step, value: AP.State.settings[key], style: { width: '160px' } });
    const out = el('span', { class: 'text-2', style: { minWidth: '34px' }, text: AP.State.settings[key] + (suffix || '') });
    input.addEventListener('input', () => { out.textContent = input.value + (suffix || ''); AP.State.settings[key] = Number(input.value); AP.saveSettings(); });
    wrap.append(input, out);
    return wrap;
  }

  function accentColor(acc) {
    const map = { orange: '#f47521', sunset: '#ff6a00', purple: '#8b5cf6', blue: '#3b82f6', green: '#22c55e', red: '#ef4444', pink: '#ec4899', cyan: '#06b6d4' };
    return map[acc] || '#f47521';
  }
})();
