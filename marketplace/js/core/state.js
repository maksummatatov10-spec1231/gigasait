/* ===== GIGASAIT MARKET — Состояние приложения, язык, константы =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const { COUNTRIES, I18N, arr, obj, store } = A;

  const state = {
    theme: store.get('theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
    lang: 'ru', langAuto: false,
    country: store.get('country', 'RU'),
    cart: obj(store.get('cart', {})),
    fav: arr(store.get('fav', [])).map(Number),
    favAt: obj(store.get('favAt', {})),
    later: arr(store.get('later', [])).map(Number),
    compare: arr(store.get('compare', [])).map(Number),
    recent: arr(store.get('recent', [])).map(Number),
    searches: arr(store.get('searches', [])),
    orders: arr(store.get('orders', [])),
    reviews: obj(store.get('reviews', {})),
    bonus: +store.get('bonus', 0) || 0,
    memberSince: store.get('memberSince', null),
    profile: { name: '', phone: '', email: '', city: '', street: '', postal: '', notifPromo: true, notifOrders: true, ...obj(store.get('profile', {})) },
    prefs: { liveBg: true, infinite: true, autoTr: true, ...obj(store.get('prefs', {})) },
    view: store.get('view', 'grid') === 'list' ? 'list' : 'grid',
    pageSize: [12, 24, 48, 96].includes(+store.get('pageSize', 24)) ? +store.get('pageSize', 24) : 24,
    promo: store.get('promo', null),
    moveMode: false
  };
  if (state.theme !== 'light' && state.theme !== 'dark') state.theme = 'dark';
  if (!COUNTRIES.some(c => c.code === state.country)) state.country = 'RU';
  if (!state.memberSince) { state.memberSince = new Date().toISOString(); store.set('memberSince', state.memberSince); }

  // Язык: сохранённый выбор → иначе автоопределение по браузеру (первый визит)
  let firstVisitLang = false;
  {
    const saved = store.get('lang', null);
    if (typeof saved === 'string' && I18N.has(saved)) { state.lang = saved; state.langAuto = store.get('langAuto', false) === true; }
    else { state.lang = I18N.detect(); state.langAuto = true; firstVisitLang = true; store.set('lang', state.lang); store.set('langAuto', true); }
  }

  let T = I18N.get(state.lang);
  const PROMOS = { GIGA10: { pct: 10 }, GIGA20: { pct: 20 }, FREE: { freeShip: true } };
  const FREE_SHIP_FROM = 5000, SHIP_COST = 299, COMPARE_MAX = 4, BONUS_RATE = 0.03, BONUS_MAX_SHARE = 0.3;
  const LEVELS = [['levelBronze', 0, '🥉'], ['levelSilver', 50000, '🥈'], ['levelGold', 200000, '🥇']];
  const timers = []; // интервалы текущей страницы (чистятся при навигации)

  Object.assign(A, { state, firstVisitLang, T, PROMOS, FREE_SHIP_FROM, SHIP_COST, COMPARE_MAX, BONUS_RATE, BONUS_MAX_SHARE, LEVELS, timers });
})();
