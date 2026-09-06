/* ===== GIGASAIT MARKET — Корзина / избранное / сравнение / недавние / бейджи =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, COMPARE_MAX, cartCount, esc, inCompare, isFav, state, store, toast } = A;
  // функции из модулей, которые загружаются позже — связываются лениво
  const navigate = (...args) => A.navigate(...args);

  /* ---------- Корзина / избранное / сравнение / отложенные ---------- */
  function saveCart() { store.set('cart', state.cart); updateBadges(); }
  function addToCart(id, qty = 1, silent = false) {
    state.cart[id] = Math.min((state.cart[id] || 0) + qty, 99);
    saveCart(); if (!silent) toast(T.addedToCart, '🛒', { label: T.goToCart, fn: () => { location.hash = '#/cart'; } });
  }
  function setQty(id, qty) {
    if (qty <= 0) delete state.cart[id]; else state.cart[id] = Math.min(qty, 99);
    saveCart();
  }
  function toggleFav(id) {
    if (isFav(id)) { state.fav = state.fav.filter(x => x !== id); delete state.favAt[id]; toast(T.removedFromFav, '💔', { label: T.undo, fn: () => { state.fav.unshift(id); state.favAt[id] = Date.now(); persistFav(); if (location.hash.startsWith('#/favorites')) navigate(); } }); }
    else { state.fav.unshift(id); state.favAt[id] = Date.now(); toast(T.addedToFav, '❤️'); }
    persistFav();
  }
  function persistFav() { store.set('fav', state.fav); store.set('favAt', state.favAt); updateBadges(); }
  function toggleCompare(id) {
    if (inCompare(id)) { state.compare = state.compare.filter(x => x !== id); toast(T.removedFromCompare, '⚖'); }
    else if (state.compare.length >= COMPARE_MAX) { toast(T.compareLimit, '⚠️'); return false; }
    else { state.compare.push(id); toast(T.addedToCompare, '⚖'); }
    store.set('compare', state.compare); renderCompareBar();
    return true;
  }
  function pushRecent(id) {
    state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0, 12);
    store.set('recent', state.recent);
  }
  function pushSearch(q) {
    q = q.trim(); if (!q) return;
    state.searches = [q, ...state.searches.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    store.set('searches', state.searches);
  }
  function updateBadges() {
    const c = cartCount(), f = state.fav.length;
    const cb = $('#cartBadge'), fb = $('#favBadge');
    cb.textContent = c; cb.classList.toggle('show', c > 0);
    fb.textContent = f; fb.classList.toggle('show', f > 0);
  }
  function renderCompareBar() {
    let bar = $('#compareBar');
    if (!bar) { bar = document.createElement('a'); bar.id = 'compareBar'; bar.className = 'compare-bar'; bar.href = '#/compare'; document.body.appendChild(bar); }
    const n = state.compare.length;
    bar.innerHTML = `⚖ ${esc(T.compare)} <b>${n}</b>`;
    bar.classList.toggle('show', n > 0 && !location.hash.startsWith('#/compare'));
  }

  Object.assign(A, { saveCart, addToCart, setQty, toggleFav, persistFav, toggleCompare, pushRecent, pushSearch, updateBadges, renderCompareBar });
})();
