/* ===== GIGASAIT MARKET — Избранное =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, BY_ID, cardHTML, fmt, isFav, persistFav, saveCart, setupMoveGrid, state, toast, translateIn } = A;

  /* ---------- Избранное (с режимом перемещения) ---------- */
  function renderFavorites(app, params) {
    document.title = `${T.favTitle} — GIGASAIT Market`;
    // импорт списка из ссылки #/favorites?ids=1,2,3
    const ids = (params.get('ids') || '').split(',').map(Number).filter(id => BY_ID.has(id));
    if (ids.length) {
      let n = 0; ids.forEach(id => { if (!isFav(id)) { state.fav.push(id); state.favAt[id] = Date.now(); n++; } });
      persistFav(); history.replaceState(null, '', '#/favorites'); if (n) toast(fmt(T.importedFromLink, { n }), '🔗');
    }
    const list = state.fav.map(id => BY_ID.get(id)).filter(Boolean);
    app.innerHTML = `
      <div class="page-head">
        <h1 class="page-title">${T.favTitle} <small>${list.length}</small></h1>
        ${list.length ? `<div class="page-tools">
          <button class="btn btn-secondary" id="moveBtn" aria-pressed="false">✥ ${T.moveMode}</button>
          <button class="btn btn-ghost" id="favShare">🔗 ${T.shareList}</button>
          <button class="btn btn-ghost" id="favAll">🛒 ${T.addAllToCart}</button>
        </div>` : ''}
      </div>
      ${list.length ? `<div class="move-hint" id="moveHint" hidden>✥ ${T.moveHint} <button class="btn btn-ghost btn-sm" id="favReset">${T.resetOrder}</button></div>
        <div class="grid fav-grid" id="favGrid">${list.map(cardHTML).join('')}</div>` :
        `<div class="empty"><div class="ic">💜</div><h2>${T.favEmpty}</h2><p>${T.favEmptyHint}</p><a class="btn btn-primary btn-lg" href="#/catalog">${T.catalog}</a></div>`}`;
    if (!list.length) return;
    $('#favShare').onclick = async () => {
      const url = location.href.split('#')[0] + '#/favorites?ids=' + state.fav.join(',');
      try { await navigator.clipboard.writeText(url); toast(T.linkCopied, '🔗'); } catch { prompt('URL', url); }
    };
    $('#favAll').onclick = () => { state.fav.forEach(id => { state.cart[id] = Math.min((state.cart[id] || 0) + 1, 99); }); saveCart(); toast(T.addedItems, '🛒', { label: T.goToCart, fn: () => { location.hash = '#/cart'; } }); $$('[data-add]', app).forEach(b => { b.classList.add('in-cart'); b.textContent = '✓ ' + T.inCart; }); };
    $('#favReset').onclick = () => { state.fav.sort((a, b) => (state.favAt[b] || 0) - (state.favAt[a] || 0)); persistFav(); renderFavorites(app, new URLSearchParams()); translateIn(app); setMoveMode(true); };
    const grid = $('#favGrid');
    const setMoveMode = on => {
      state.moveMode = on;
      grid.classList.toggle('moving', on);
      $('#moveHint').hidden = !on;
      const b = $('#moveBtn'); b.setAttribute('aria-pressed', on); b.classList.toggle('btn-primary', on); b.classList.toggle('btn-secondary', !on);
      b.innerHTML = on ? `✓ ${T.done}` : `✥ ${T.moveMode}`;
      // лёгкое покачивание — только на ПК и только если пользователь не просил меньше анимаций
      const wiggle = on && !document.documentElement.classList.contains('is-mobile') && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      $$('.card', grid).forEach(c => { c.tabIndex = on ? 0 : -1; c.setAttribute('aria-grabbed', 'false'); c.classList.toggle('wiggle', wiggle); });
    };
    $('#moveBtn').onclick = () => setMoveMode(!state.moveMode);
    setupMoveGrid(grid, () => {
      state.fav = $$('.card', grid).map(c => +c.dataset.id);
      persistFav(); toast(T.orderSaved, '✥');
    });
  }

  Object.assign(A, { renderFavorites });
})();
