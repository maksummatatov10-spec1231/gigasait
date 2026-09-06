/* ===== GIGASAIT MARKET — Инициализация =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, CATEGORIES, COUNTRIES, I18N, PRODUCTS, TR, applyLang, applyPrefs, applyTheme, arr, closeCatalog, closeLightbox, closeModal, closePopovers, firstVisitLang, fmt, navigate, obj, setupSearch, shortcutsModal, state, store, toast, toggleCatalog, togglePopover, trOn, translateIn, updateBadges } = A;

  /* ---------- Инициализация ---------- */
  function init() {
    applyTheme();
    applyPrefs();
    applyLang();
    updateBadges();
    setupSearch();
    $('#themeToggle').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); };
    $('#catalogBtn').onclick = toggleCatalog;
    $('#mCatalogBtn').onclick = toggleCatalog;
    $('#catalogDrop').addEventListener('click', e => { if (e.target.closest('a')) closeCatalog(); });
    $('#countryBtn').onclick = e => { e.stopPropagation(); togglePopover($('#countryPop'), e.currentTarget); };
    $('#langBtn').onclick = e => { e.stopPropagation(); togglePopover($('#langPop'), e.currentTarget); };
    document.addEventListener('click', e => { if (!e.target.closest('.popover') && !e.target.closest('#countryBtn') && !e.target.closest('#langBtn')) closePopovers(); });
    let chord = '';
    document.addEventListener('keydown', e => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (e.key === 'Escape') { closeCatalog(); closePopovers(); closeLightbox(); closeModal(); $('#searchSuggest').classList.remove('show'); if (state.moveMode && $('#moveBtn')) $('#moveBtn').click(); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); $('#searchInput').focus(); return; }
      if (e.key === '?') { e.preventDefault(); shortcutsModal(); return; }
      if (chord === 'g') { chord = ''; const map = { h: '#/', c: '#/cart', f: '#/favorites', o: '#/orders', s: '#/settings' }; if (map[e.key]) { e.preventDefault(); location.hash = map[e.key]; } return; }
      if (e.key === 'g') { chord = 'g'; setTimeout(() => { chord = ''; }, 800); }
    });
    $('#year').textContent = new Date().getFullYear();
    // кнопка «наверх»
    const top = document.createElement('button');
    top.className = 'to-top'; top.id = 'toTop'; top.innerHTML = '↑'; top.title = T.toTop; top.setAttribute('aria-label', T.toTop);
    top.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(top);
    let ticking = false;
    window.addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { top.classList.toggle('show', scrollY > 600); document.body.classList.toggle('scrolled', scrollY > 10); ticking = false; }); }, { passive: true });
    window.addEventListener('hashchange', navigate);
    navigate();
    window.addEventListener('storage', () => { state.cart = obj(store.get('cart', {})); state.fav = arr(store.get('fav', [])); updateBadges(); });
    // смена типа устройства (ручной выбор в настройках или поворот планшета) — применяем настройки и перерисовываем страницу
    window.addEventListener('devicechange', e => { applyPrefs(); if (e.detail && e.detail.changed !== false) navigate(); });
    if (firstVisitLang && state.lang !== 'ru') setTimeout(() => toast(fmt(T.langDetected, { lang: I18N.meta(state.lang).name }), '🌐'), 600);
  }
  init();

  window.GIGA = { state, PRODUCTS, CATEGORIES, COUNTRIES, I18N, TR };

  Object.assign(A, { init });
})();
