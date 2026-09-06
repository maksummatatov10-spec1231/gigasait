/* ===== GIGASAIT MARKET — HTML карточки товара =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, countryName, countryOf, esc, inCompare, isFav, money, pct, reviewCount, reviewsWord, state, tagName } = A;

  /* ---------- Карточка товара ---------- */
  function cardHTML(p, i = 0) {
    const inCart = !!state.cart[p.id];
    const c = countryOf(p.country);
    const rc = reviewCount(p);
    return `
      <article class="card" style="animation-delay:${Math.min(i, 12) * 30}ms" data-id="${p.id}">
        <a class="card-img" href="#/product/${p.id}">
          <img src="${p.thumb}" alt="${esc(p.title)}" loading="lazy" decoding="async" width="420" height="420">
          <div class="card-labels">
            ${p.oldPrice ? `<span class="label label-discount">-${pct(p)}%</span>` : ''}
            ${p.isNew ? `<span class="label label-new">${T.new}</span>` : ''}
            ${p.reviews > 1500 ? `<span class="label label-hit">${T.hit}</span>` : ''}
            ${p.stock < 5 ? `<span class="label label-low">${T.lowStock}</span>` : ''}
          </div>
          <button class="qv-btn" data-qv="${p.id}" type="button">👁 ${T.quickView}</button>
        </a>
        <div class="card-actions">
          <button class="fav-btn ${isFav(p.id) ? 'active' : ''}" data-fav="${p.id}" aria-label="${esc(T.favorites)}" title="${esc(T.favorites)}"><span class="heart">${isFav(p.id) ? '♥' : '♡'}</span></button>
          <button class="cmp-btn ${inCompare(p.id) ? 'active' : ''}" data-cmp="${p.id}" aria-label="${esc(T.compare)}" title="${esc(T.compare)}">⚖</button>
        </div>
        <div class="card-body">
          <div class="card-price">
            <b>${money(p.price)}</b>
            ${p.oldPrice ? `<s>${money(p.oldPrice)}</s><span class="pct">-${pct(p)}%</span>` : ''}
          </div>
          <a class="card-title" href="#/product/${p.id}" title="${esc(p.title)}" data-tr="${esc(p.title)}">${esc(p.title)}</a>
          <div class="card-meta">
            <span class="star">★</span><span>${p.rating}</span>
            <span>· ${rc} ${reviewsWord(rc)}</span>
            <span class="flag" title="${esc(countryName(c))}">${c.flag}</span>
          </div>
          <div class="card-desc" data-tr="${esc(p.description.slice(0, 160))}">${esc(p.description.slice(0, 160))}</div>
          <div class="card-tags">${p.tags.slice(0, 2).map(t => `<a class="tag" href="#/catalog?tag=${encodeURIComponent(t)}">${esc(tagName(t))}</a>`).join('')}</div>
          <button class="btn ${inCart ? 'btn-primary in-cart' : 'btn-primary'}" data-add="${p.id}">${inCart ? '✓ ' + T.inCart : T.addToCart}</button>
        </div>
      </article>`;
  }

  Object.assign(A, { cardHTML });
})();
