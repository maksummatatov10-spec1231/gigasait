/* ===== GIGASAIT MARKET — Утилиты: форматирование, деньги, даты, DOM =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const { BY_ID, CATEGORIES, COUNTRIES, I18N, LEVELS, arr, state } = A;

  /* ---------- Утилиты ---------- */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const country = () => COUNTRIES.find(c => c.code === state.country) || COUNTRIES[0];
  const countryOf = code => COUNTRIES.find(c => c.code === code) || COUNTRIES[0];
  const catName = c => { const n = I18N.name(state.lang, 'cats', c.id); return (state.lang === 'ru' || n === c.id) ? c.name : n; };
  const subName = s => I18N.name(state.lang, 'subs', s);
  const tagName = t => I18N.name(state.lang, 'tags', t);
  const countryName = c => { const n = I18N.name(state.lang, 'countries', c.code); return (state.lang === 'ru' || n === c.code) ? c.name : n; };
  const catById = id => CATEGORIES.find(c => c.id === id);
  const catImg = c => `img/categories/${c.id}.jpg`;
  const locale = () => I18N.locale(state.lang);
  const fmtDate = d => { try { return new Date(d).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return new Date(d).toLocaleDateString(); } };
  const fmtTime = d => { try { return new Date(d).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  const nfCache = {};
  function money(rub) {
    const c = country();
    const v = rub * c.rate;
    const k = locale() + c.code;
    let num;
    try { num = (nfCache[k] ||= new Intl.NumberFormat(locale(), { maximumFractionDigits: c.rate < 0.1 ? 2 : 0 })).format(v); }
    catch { num = Math.round(v).toLocaleString(); }
    return `${num} ${c.symbol}`;
  }
  const pct = p => p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const stars = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  const isFav = id => state.fav.includes(id);
  const inCompare = id => state.compare.includes(id);
  const cartCount = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
  const cartItems = () => Object.entries(state.cart).map(([id, qty]) => ({ p: BY_ID.get(+id), qty })).filter(x => x.p);
  const cartSubtotal = () => cartItems().reduce((s, { p, qty }) => s + p.price * qty, 0);
  const cartOldTotal = () => cartItems().reduce((s, { p, qty }) => s + (p.oldPrice || p.price) * qty, 0);
  const productsWord = n => I18N.plural(state.lang, 'products', n);
  const reviewsWord = n => I18N.plural(state.lang, 'reviews', n);
  const fmt = I18N.fmt;
  const userReviews = id => arr(state.reviews[id]);
  const reviewCount = p => p.reviews + userReviews(p.id).length;
  const dayNumber = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  const trOn = () => state.lang !== 'ru' && state.prefs.autoTr;
  const levelOf = spent => { let l = LEVELS[0]; for (const x of LEVELS) if (spent >= x[1]) l = x; return l; };
  const totalSpent = () => state.orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totals.total, 0);

  Object.assign(A, { $, $$, esc, country, countryOf, catName, subName, tagName, countryName, catById, catImg, locale, fmtDate, fmtTime, nfCache, money, pct, stars, isFav, inCompare, cartCount, cartItems, cartSubtotal, cartOldTotal, productsWord, reviewsWord, fmt, userReviews, reviewCount, dayNumber, trOn, levelOf, totalSpent });
})();
