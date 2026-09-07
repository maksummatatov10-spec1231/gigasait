/* ===== GIGASAIT MARKET — Глобальные делегированные события =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, addToCart, inCompare, isFav, placeholderImage, quickView, state, toggleCompare, toggleFav } = A;

  /* ---------- Глобальные делегированные клики ---------- */
  document.addEventListener('click', e => {
    if (state.moveMode && e.target.closest('#favGrid')) return;
    const qv = e.target.closest('[data-qv]');
    if (qv) { e.preventDefault(); quickView(+qv.dataset.qv); return; }
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault(); const id = +fav.dataset.fav; toggleFav(id);
      fav.classList.toggle('active', isFav(id)); const h = fav.querySelector('.heart'); if (h) h.textContent = isFav(id) ? '♥' : '♡';
      if (isFav(id) && A.flyToCart) A.flyToCart(fav, '#navFav');
      if (location.hash.startsWith('#/favorites') && !isFav(id)) { const card = fav.closest('.card'); if (card) card.remove(); const s = $('.page-title small'); if (s) s.textContent = state.fav.length; }
      return;
    }
    const cmp = e.target.closest('[data-cmp]');
    if (cmp) { e.preventDefault(); const id = +cmp.dataset.cmp; toggleCompare(id); cmp.classList.toggle('active', inCompare(id)); return; }
    const add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault(); const id = +add.dataset.add;
      if (state.cart[id]) { location.hash = '#/cart'; return; }
      addToCart(id); add.classList.add('in-cart'); add.textContent = '✓ ' + T.inCart;
      if (A.flyToCart) A.flyToCart(add, '#navCart'); return;
    }
    const favCart = e.target.closest('[data-fav-cart]');
    if (favCart) { const id = +favCart.dataset.favCart; toggleFav(id); favCart.textContent = isFav(id) ? '♥' : '♡'; return; }
  });
  // Битые картинки → заглушка; загруженные → плавное появление
  document.addEventListener('error', e => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && !img.dataset.fb) { img.dataset.fb = '1'; img.src = placeholderImage('', '🛍️', ['#7c5cff', '#ff5c8a'], img.src.length); }
  }, true);
  document.addEventListener('load', e => { if (e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);


})();
