/* ===== GIGASAIT MARKET — Сравнение товаров =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, BY_ID, COMPARE_MAX, countryName, countryOf, esc, money, renderCompareBar, reviewCount, reviewsWord, state, store, subName, toggleCompare, translateIn } = A;

  /* ---------- Сравнение ---------- */
  function renderCompare(app) {
    document.title = `${T.compareTitle} — GIGASAIT Market`;
    const list = state.compare.map(id => BY_ID.get(id)).filter(Boolean);
    if (!list.length) {
      app.innerHTML = `<h1 class="page-title">${T.compareTitle}</h1><div class="empty"><div class="ic">⚖</div><h2>${T.compareEmpty}</h2><p>${T.compareEmptyHint}</p><a class="btn btn-primary btn-lg" href="#/catalog">${T.catalog}</a></div>`;
      return;
    }
    const specKeys = [...new Set(list.flatMap(p => Object.keys(p.specs)))];
    const row = (label, cells, cls = '') => `<tr class="${cls}"><th>${label}</th>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    const best = (vals, hi = true) => { const nums = vals.map(Number); const b = hi ? Math.max(...nums) : Math.min(...nums); return nums.map(n => n === b && nums.filter(x => x === b).length < nums.length); };
    const bp = best(list.map(p => p.price), false), br = best(list.map(p => p.rating));
    app.innerHTML = `
      <h1 class="page-title">${T.compareTitle} <small>${list.length}/${COMPARE_MAX}</small></h1>
      <div class="compare-wrap"><table class="compare">
        <thead><tr><th></th>${list.map(p => `<td class="cmp-head">
          <button class="cmp-remove" data-cmp-rm="${p.id}" aria-label="${esc(T.remove)}">✕</button>
          <a href="#/product/${p.id}"><img src="${p.thumb}" alt=""></a>
          <a class="cmp-title" href="#/product/${p.id}" data-tr="${esc(p.title)}">${esc(p.title)}</a>
          <button class="btn btn-primary btn-sm ${state.cart[p.id] ? 'in-cart' : ''}" data-add="${p.id}">${state.cart[p.id] ? '✓ ' + T.inCart : T.addToCart}</button>
        </td>`).join('')}</tr></thead>
        <tbody>
          ${row(T.price, list.map((p, i) => `<b class="${bp[i] ? 'green' : ''}">${money(p.price)}</b>${p.oldPrice ? ` <s class="muted">${money(p.oldPrice)}</s>` : ''}`))}
          ${row(T.rating, list.map((p, i) => `<span class="${br[i] ? 'green' : ''}"><span class="star">★</span> ${p.rating}</span> <small class="muted">(${reviewCount(p)} ${reviewsWord(reviewCount(p))})</small>`))}
          ${row(T.brand, list.map(p => esc(p.brand)))}
          ${row(T.categoriesTitle, list.map(p => esc(subName(p.subcategory))))}
          ${row(T.country, list.map(p => `${countryOf(p.country).flag} ${esc(countryName(countryOf(p.country)))}`))}
          ${row(T.inStock, list.map(p => p.stock < 10 ? `<span class="stock-low">${T.left} ${p.stock}</span>` : `<span class="stock-ok">✓</span>`))}
          ${specKeys.map(k => row(`<span data-tr="${esc(k)}">${esc(k)}</span>`, list.map(p => p.specs[k] != null ? `<span data-tr="${esc(p.specs[k])}">${esc(p.specs[k])}</span>` : '—'))).join('')}
        </tbody>
      </table></div>
      <div style="margin-top:16px"><button class="btn btn-ghost btn-danger" id="clearCompare">🗑 ${T.clearCompare}</button></div>`;
    $$('[data-cmp-rm]').forEach(b => b.onclick = () => { toggleCompare(+b.dataset.cmpRm); renderCompare(app); translateIn(app); });
    $('#clearCompare').onclick = () => { state.compare = []; store.set('compare', []); renderCompareBar(); renderCompare(app); };
  }

  Object.assign(A, { renderCompare });
})();
