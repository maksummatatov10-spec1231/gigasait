/* ===== GIGASAIT MARKET — Корзина и отложенные =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, BONUS_MAX_SHARE, BONUS_RATE, BY_ID, FREE_SHIP_FROM, PROMOS, SHIP_COST, addToCart, cartCount, cartItems, cartOldTotal, cartSubtotal, countryOf, esc, fmt, isFav, money, productsWord, saveCart, setQty, state, store, toast, translateIn } = A;

  /* ---------- Корзина ---------- */
  function calcTotals(delivery = 'courier', useBonus = 0) {
    const sub = cartSubtotal();
    const old = cartOldTotal();
    let promoDisc = 0, freeShip = false;
    const promo = state.promo && PROMOS[state.promo];
    if (promo) { if (promo.pct) promoDisc = Math.round(sub * promo.pct / 100); if (promo.freeShip) freeShip = true; }
    const shipping = (delivery === 'pickup' || freeShip || sub >= FREE_SHIP_FROM || sub === 0) ? 0 : SHIP_COST;
    const bonusUsed = Math.min(useBonus, state.bonus, Math.floor((sub - promoDisc) * BONUS_MAX_SHARE));
    const total = sub - promoDisc + shipping - bonusUsed;
    return { sub, old, promoDisc, shipping, bonusUsed, total, saved: old - sub, bonusEarned: Math.round((sub - promoDisc - bonusUsed) * BONUS_RATE) };
  }
  function summaryHTML(t, withBtn = true) {
    const left = FREE_SHIP_FROM - t.sub;
    return `
      <h3>${T.total}</h3>
      <div class="sum-row"><span>${T.subtotal} (${cartCount()})</span><span>${money(t.old)}</span></div>
      ${t.saved ? `<div class="sum-row"><span>${T.discount}</span><span class="green">−${money(t.saved)}</span></div>` : ''}
      ${t.promoDisc ? `<div class="sum-row"><span>${T.promoCode} ${state.promo}</span><span class="green">−${money(t.promoDisc)}</span></div>` : ''}
      ${t.bonusUsed ? `<div class="sum-row"><span>${T.bonusSpent}</span><span class="green">−${money(t.bonusUsed)}</span></div>` : ''}
      <div class="sum-row"><span>${T.delivery}</span><span class="${t.shipping ? '' : 'green'}">${t.shipping ? money(t.shipping) : T.free}</span></div>
      <div class="sum-row total"><span>${T.total}</span><span>${money(t.total)}</span></div>
      <div class="sum-row bonus"><span>🎁 ${T.bonusEarned}</span><span>+${t.bonusEarned}</span></div>
      ${withBtn ? `<div class="ship-progress"><div class="bar"><i style="width:${Math.min(100, t.sub / FREE_SHIP_FROM * 100)}%"></i></div><small>${left > 0 ? fmt(T.shipMore, { sum: money(left) }) : fmt(T.freeShipFrom, { sum: money(FREE_SHIP_FROM) }) + ' ✓'}</small></div>
      <a class="btn btn-primary btn-lg btn-block" href="#/checkout">${T.checkout} →</a>` : ''}`;
  }
  function laterHTML() {
    const list = state.later.map(id => BY_ID.get(id)).filter(Boolean);
    if (!list.length) return '';
    return `<section class="section later" id="laterBox" style="margin-top:30px"><div class="section-head"><h2>🕓 ${T.savedItems} <small class="muted">${list.length}</small></h2></div>
      <div class="cart-list">${list.map(p => `<div class="cart-item" data-later="${p.id}">
        <a href="#/product/${p.id}"><img src="${p.thumb}" alt="" loading="lazy"></a>
        <div><a class="ci-title" href="#/product/${p.id}" data-tr="${esc(p.title)}">${esc(p.title)}</a><div class="ci-sub">${esc(p.brand)} · ${money(p.price)}</div>
          <div class="ci-actions"><button class="btn btn-primary btn-sm" data-later-cart="${p.id}">🛒 ${T.moveToCart}</button><button class="btn btn-ghost btn-sm btn-danger" data-later-rm="${p.id}">🗑 ${T.remove}</button></div></div>
        <div class="ci-right"><b>${money(p.price)}</b></div></div>`).join('')}</div></section>`;
  }
  function renderCart(app) {
    document.title = `${T.cartTitle} — GIGASAIT Market`;
    const items = cartItems();
    if (!items.length) {
      app.innerHTML = `<h1 class="page-title">${T.cartTitle}</h1><div class="empty"><div class="ic">🛒</div><h2>${T.cartEmpty}</h2><p>${T.cartEmptyHint}</p><a class="btn btn-primary btn-lg" href="#/catalog">${T.catalog}</a></div>${laterHTML()}`;
      bindLater(app); return;
    }
    const t = calcTotals();
    app.innerHTML = `
      <h1 class="page-title">${T.cartTitle} <small>${cartCount()} ${productsWord(cartCount())}</small></h1>
      <div class="cart-layout">
        <div>
          <div class="cart-list" id="cartList">${items.map(({ p, qty }) => cartItemHTML(p, qty)).join('')}</div>
          <div style="margin-top:14px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <a class="btn btn-ghost" href="#/catalog">← ${T.continueShopping}</a>
            <button class="btn btn-ghost btn-danger" id="clearCart">🗑 ${T.clearCart}</button>
          </div>
          ${laterHTML()}
        </div>
        <aside class="summary" id="summary">
          <div class="promo-row"><input id="promoInput" placeholder="${T.promoCode}" value="${esc(state.promo || '')}"><button class="btn btn-secondary" id="promoBtn">${T.promoApply}</button></div>
          <small class="muted">${T.promoHint}</small>
          <div id="sumBox">${summaryHTML(t)}</div>
        </aside>
      </div>`;
    const refresh = () => {
      if (!cartCount()) return renderCart(app);
      $('#sumBox').innerHTML = summaryHTML(calcTotals());
      $('.page-title small').textContent = `${cartCount()} ${productsWord(cartCount())}`;
    };
    $('#cartList').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.dataset.favCart) return;
      const row = b.closest('.cart-item'); const id = +row.dataset.id;
      if (b.dataset.q) setQty(id, (state.cart[id] || 0) + +b.dataset.q);
      if (b.dataset.rm || b.dataset.later) {
        const prevQty = state.cart[id]; setQty(id, 0);
        if (b.dataset.later) { if (!state.later.includes(id)) state.later.unshift(id); store.set('later', state.later); renderCart(app); translateIn(app); return; }
        toast(T.remove + ' ✓', '🗑', { label: T.undo, fn: () => { state.cart[id] = prevQty; saveCart(); renderCart(app); translateIn(app); } });
      }
      if (state.cart[id]) row.outerHTML = cartItemHTML(BY_ID.get(id), state.cart[id]); else row.remove();
      refresh();
    });
    $('#clearCart').onclick = () => { if (confirm(T.clearCart + '?')) { const backup = { ...state.cart }; state.cart = {}; saveCart(); renderCart(app); toast(T.clearCart + ' ✓', '🗑', { label: T.undo, fn: () => { state.cart = backup; saveCart(); renderCart(app); translateIn(app); } }); } };
    const applyPromo = () => {
      const code = $('#promoInput').value.trim().toUpperCase();
      if (!code) { state.promo = null; store.remove('promo'); refresh(); return; }
      if (PROMOS[code]) { state.promo = code; store.set('promo', code); toast(T.promoOk, '🎉'); } else toast(T.promoBad, '⚠️');
      refresh();
    };
    $('#promoBtn').onclick = applyPromo;
    $('#promoInput').onkeydown = e => { if (e.key === 'Enter') applyPromo(); };
    bindLater(app);
  }
  function bindLater(app) {
    $$('[data-later-cart]', app).forEach(b => b.onclick = () => { const id = +b.dataset.laterCart; state.later = state.later.filter(x => x !== id); store.set('later', state.later); addToCart(id, 1, true); renderCart(app); translateIn(app); });
    $$('[data-later-rm]', app).forEach(b => b.onclick = () => { const id = +b.dataset.laterRm; state.later = state.later.filter(x => x !== id); store.set('later', state.later); renderCart(app); translateIn(app); });
  }
  function cartItemHTML(p, qty) {
    return `<div class="cart-item" data-id="${p.id}">
      <a href="#/product/${p.id}"><img src="${p.thumb}" alt="" loading="lazy"></a>
      <div>
        <a class="ci-title" href="#/product/${p.id}" data-tr="${esc(p.title)}">${esc(p.title)}</a>
        <div class="ci-sub">${esc(p.brand)} · ${countryOf(p.country).flag} · ${money(p.price)} / ${T.pcs}${p.stock < 5 ? ` · <span class="stock-low">${T.left} ${p.stock}</span>` : ''}</div>
        <div class="ci-actions">
          <div class="qty sm"><button data-q="-1" aria-label="−">−</button><span>${qty}</span><button data-q="1" aria-label="+" ${qty >= p.stock ? 'disabled' : ''}>+</button></div>
          <button class="btn btn-ghost btn-sm" data-fav-cart="${p.id}" title="${esc(T.favorites)}">${isFav(p.id) ? '♥' : '♡'}</button>
          <button class="btn btn-ghost btn-sm" data-later="1">🕓 ${T.saveForLater}</button>
          <button class="btn btn-ghost btn-sm btn-danger" data-rm="1">🗑 ${T.remove}</button>
        </div>
      </div>
      <div class="ci-right"><b>${money(p.price * qty)}</b>${p.oldPrice ? `<s>${money(p.oldPrice * qty)}</s>` : ''}</div>
    </div>`;
  }

  Object.assign(A, { calcTotals, summaryHTML, laterHTML, renderCart, bindLater, cartItemHTML });
})();
