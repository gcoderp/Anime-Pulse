/* ============================================================================
   ANIPULSE — utils.js
   DOM helpers, formatting, AniList image handling, season maths
   ========================================================================== */
(function () {
  'use strict';
  const AP = (window.AP = window.AP || {});

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const now = () => Date.now();

  /* Create an element with props + children */
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
    for (const ch of children.flat(Infinity)) {
      if (ch == null || ch === false) continue;
      node.append(ch.nodeType ? ch : document.createTextNode(String(ch)));
    }
    return node;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* AniList descriptions are HTML-ish (<br>, <i>, <b>). Strip safely. */
  function stripHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.innerHTML = String(s).replace(/<br\s*\/?>/gi, '\n');
    return (d.textContent || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
  }

  function debounce(fn, ms) {
    let t;
    return function (...a) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), ms);
    };
  }

  function throttle(fn, ms) {
    let last = 0, timer;
    return function (...a) {
      const t = now();
      if (t - last >= ms) { last = t; fn.apply(this, a); }
      else { clearTimeout(timer); timer = setTimeout(() => { last = now(); fn.apply(this, a); }, ms - (t - last)); }
    };
  }

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function fmtNum(n) {
    if (n == null || isNaN(n)) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  /* AniList scores are 0–100; the UI shows 0–10 with one decimal. */
  function fmtScore(v) {
    if (v == null || isNaN(v) || v === 0) return null;
    return (Number(v) / 10).toFixed(1);
  }

  function timeAgo(ts) {
    const d = Math.floor((now() - ts) / 1000);
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    if (d < 604800) return Math.floor(d / 86400) + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  function fmtDate(str) {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtRuntime(min) {
    if (!min) return '';
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  function fmtDuration(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h > 0 ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  /* "in 3d 4h" / "in 12m" for next-episode countdowns. */
  function countdown(seconds) {
    if (seconds == null || seconds <= 0) return 'airing now';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `in ${d}d ${h}h`;
    if (h > 0) return `in ${h}h ${m}m`;
    return `in ${m}m`;
  }

  function safeInt(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }

  function isValidHttpUrl(u) {
    try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; }
    catch { return false; }
  }

  /* AniList already returns absolute CDN URLs. Keep this helper so every
     view can request a size without caring where the image lives. */
  function img(url, size = 'large') {
    if (!url) return '';
    if (!/^https?:/.test(url)) return url;
    return url;
  }

  /* Poster with graceful fallback + lazy loading + fade-in. */
  function poster(url, title, size = 'large') {
    const wrap = el('div', { class: 'fallback', style: { position: 'absolute', inset: '0' } });
    wrap.textContent = title || 'No artwork';
    if (!url) return wrap;
    const image = el('img', {
      src: img(url, size),
      alt: title || '',
      loading: 'lazy',
      decoding: 'async',
      style: { opacity: '0', transition: 'opacity .45s' },
    });
    image.addEventListener('load', () => { image.style.opacity = '1'; wrap.style.display = 'none'; });
    image.addEventListener('error', () => { image.remove(); });
    const frag = document.createDocumentFragment();
    frag.append(wrap, image);
    return frag;
  }

  /* ---------------------------- SEASON MATHS ----------------------------- */
  /* AniList seasons: WINTER (Jan–Mar), SPRING (Apr–Jun), SUMMER (Jul–Sep),
     FALL (Oct–Dec). */
  function currentSeason(date = new Date()) {
    const m = date.getMonth() + 1;
    const season = m <= 3 ? 'WINTER' : m <= 6 ? 'SPRING' : m <= 9 ? 'SUMMER' : 'FALL';
    return { season, year: date.getFullYear(), name: `${season[0]}${season.slice(1).toLowerCase()} ${date.getFullYear()}` };
  }

  function seasonName(season, year) {
    if (!season) return year ? String(year) : '';
    const nice = season[0] + season.slice(1).toLowerCase();
    return year ? `${nice} ${year}` : nice;
  }

  function plural(n, s, p) { return `${n} ${n === 1 ? s : (p || s + 's')}`; }

  /* Intersection-observer reveal */
  let revealObserver = null;
  function observeReveal(root = document) {
    if (!('IntersectionObserver' in window)) { $$('.reveal, .reveal-l', root).forEach((n) => n.classList.add('in')); return; }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    }
    $$('.reveal, .reveal-l', root).forEach((n) => { if (!n.classList.contains('in')) revealObserver.observe(n); });
  }

  /* Simple concurrency-limited map */
  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let i = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
      while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
    });
    await Promise.all(workers);
    return out;
  }

  AP.utils = {
    $, $$, now, el, esc, stripHtml, debounce, throttle, clamp, sleep,
    fmtNum, fmtScore, timeAgo, fmtDate, fmtRuntime, fmtDuration, countdown,
    safeInt, isValidHttpUrl, img, poster, plural, observeReveal, mapLimit,
    currentSeason, seasonName,
  };
})();
