/* ===== GIGASAIT MARKET — Тема / язык / оформление =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, I18N, state, store } = A;
  // функции из модулей, которые загружаются позже — связываются лениво
  const navigate = (...args) => A.navigate(...args);
  const renderCompareBar = (...args) => A.renderCompareBar(...args);
  const renderCountryUI = (...args) => A.renderCountryUI(...args);
  const renderHeaderCats = (...args) => A.renderHeaderCats(...args);
  const renderLangUI = (...args) => A.renderLangUI(...args);

  /* ---------- Тема / язык / оформление ---------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const sw = $('#themeToggle');
    if (sw) sw.setAttribute('aria-checked', state.theme === 'light');
    store.set('theme', state.theme);
  }
  function applyPrefs() {
    document.body.classList.toggle('live-bg', !!state.prefs.liveBg);
    if (state.prefs.liveBg && !$('#bgOrbs')) {
      const o = document.createElement('div'); o.id = 'bgOrbs'; o.className = 'bg-orbs'; o.setAttribute('aria-hidden', 'true');
      o.innerHTML = '<span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span>';
      document.body.prepend(o);
    }
    store.set('prefs', state.prefs);
    // мобильная версия: живой фон не нужен (экономим батарею и кадры)
    if (document.documentElement.classList.contains('is-mobile')) document.body.classList.remove('live-bg');
    // автоперевод выключили/включили — сразу отражаем на странице
    const app = $('#app');
    if (app && A.translateIn) { if (state.prefs.autoTr && state.lang !== 'ru') A.translateIn(app); else if (!state.prefs.autoTr && A.untranslate) A.untranslate(app); }
  }
  function applyLang() {
    A.T = I18N.get(state.lang);
    document.documentElement.lang = state.lang;
    document.documentElement.dir = I18N.dir(state.lang);
    document.body.classList.toggle('rtl', I18N.dir(state.lang) === 'rtl');
    $$('[data-i18n]').forEach(el => { el.textContent = T[el.dataset.i18n]; });
    $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = T[el.dataset.i18nPlaceholder]; });
    $$('[data-i18n-title]').forEach(el => { el.title = T[el.dataset.i18nTitle]; el.setAttribute('aria-label', T[el.dataset.i18nTitle]); });
    store.set('lang', state.lang);
    store.set('langAuto', state.langAuto);
    renderHeaderCats();
    renderCountryUI();
    renderLangUI();
    renderCompareBar();
  }
  function setLang(code, auto = false) {
    if (!I18N.has(code)) return;
    state.lang = code; state.langAuto = auto;
    applyLang(); navigate();
  }

  Object.assign(A, { applyTheme, applyPrefs, applyLang, setLang });
})();
