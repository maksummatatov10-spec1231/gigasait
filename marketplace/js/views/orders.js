/* ===== GIGASAIT MARKET — Заказы и детали заказа =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, BY_ID, countryOf, esc, fmtDate, fmtTime, money, saveCart, state, store, toast } = A;
  // функции из модулей, которые загружаются позже — связываются лениво
  const renderNotFound = (...args) => A.renderNotFound(...args);

  /* ---------- Заказы ---------- */
  const STATUS_FLOW = ['processing', 'paid', 'shipped', 'delivered'];
  function statusLabel(s) { return { processing: T.statusProcessing, paid: T.statusPaid, awaiting: T.statusAwaiting, shipped: T.statusShipped, delivered: T.statusDelivered, cancelled: T.statusCancelled }[s] || s; }
  // Демо-логистика: заказ «едет» сам — через 3 минуты отправлен, через 10 доставлен
  function liveStatus(o) {
    if (o.status === 'cancelled' || o.status === 'delivered') return o.status;
    const min = (Date.now() - new Date(o.date)) / 60000;
    const s = min > 10 ? 'delivered' : min > 3 ? 'shipped' : o.status;
    if (s !== o.status) { o.status = s; store.set('orders', state.orders); }
    return s;
  }
  function renderOrders(app) {
    document.title = `${T.ordersTitle} — GIGASAIT Market`;
    app.innerHTML = `<h1 class="page-title">${T.ordersTitle} <small>${state.orders.length}</small></h1>` +
      (state.orders.length ? state.orders.map(o => {
        const oc = countryOf(o.country);
        const s = liveStatus(o);
        const cancellable = ['processing', 'paid', 'awaiting'].includes(s);
        return `<div class="order-card" data-order="${o.id}">
          <div class="order-head"><div><a href="#/order/${o.id}"><b>${o.id}</b></a> <small>· ${fmtDate(o.date)} ${fmtTime(o.date)}</small></div><span class="status status-${s}">${statusLabel(s)}</span></div>
          <a class="order-thumbs" href="#/order/${o.id}">${o.items.map(i => `<img src="${i.img}" alt="" title="${esc(i.title)}" loading="lazy">`).join('')}</a>
          <div class="order-foot">
            <span>${oc.flag} ${esc(o.address)} · ${o.delivery === 'pickup' ? T.pickup : T.courier} · ${o.payment === 'now' ? T.paidNow : T.payLater}</span>
            <b>${money(o.totals.total)}</b>
          </div>
          <div class="order-actions">
            <a class="btn btn-secondary btn-sm" href="#/order/${o.id}">📄 ${T.orderDetails}</a>
            <button class="btn btn-secondary btn-sm" data-repeat="${o.id}">🔁 ${T.repeatOrder}</button>
            ${cancellable ? `<button class="btn btn-ghost btn-sm btn-danger" data-cancel="${o.id}">✕ ${T.cancelOrder}</button>` : ''}
          </div>
        </div>`;
      }).join('') : `<div class="empty"><div class="ic">📦</div><h2>${T.ordersEmpty}</h2><p>${T.ordersEmptyHint}</p><a class="btn btn-primary btn-lg" href="#/catalog">${T.catalog}</a></div>`);
    bindOrderActions(app, () => renderOrders(app));
  }
  function bindOrderActions(app, rerender) {
    $$('[data-cancel]', app).forEach(b => b.onclick = () => {
      if (!confirm(T.confirmCancel)) return;
      const o = state.orders.find(x => x.id === b.dataset.cancel); if (!o) return;
      o.status = 'cancelled'; state.bonus = Math.max(0, state.bonus - (o.totals.bonusEarned || 0) + (o.totals.bonusUsed || 0)); store.set('bonus', state.bonus);
      store.set('orders', state.orders); toast(T.orderCancelled, '✕'); rerender();
    });
    $$('[data-repeat]', app).forEach(b => b.onclick = () => {
      const o = state.orders.find(x => x.id === b.dataset.repeat); if (!o) return;
      let n = 0;
      o.items.forEach(i => { if (BY_ID.has(i.id)) { state.cart[i.id] = Math.min((state.cart[i.id] || 0) + i.qty, 99); n++; } });
      saveCart(); toast(n ? T.addedItems : T.noResults, '🛒'); if (n) location.hash = '#/cart';
    });
  }
  function renderOrderDetails(app, params, id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return renderNotFound(app);
    document.title = `${o.id} — GIGASAIT Market`;
    const s = liveStatus(o);
    const oc = countryOf(o.country);
    const flow = o.payment === 'now' ? STATUS_FLOW : ['processing', 'awaiting', 'shipped', 'delivered'];
    const idx = s === 'cancelled' ? -1 : Math.max(flow.indexOf(s), s === 'paid' || s === 'awaiting' ? 1 : 0);
    const t = o.totals;
    app.innerHTML = `
      <div class="breadcrumbs"><a href="#/">${T.home}</a><span><a href="#/orders">${T.ordersTitle}</a></span><span>${o.id}</span></div>
      <div class="page-head"><h1 class="page-title">${T.orderDetails} <small>${o.id}</small></h1>
        <div class="page-tools no-print"><button class="btn btn-secondary" id="printBtn">🖨 ${T.printReceipt}</button><a class="btn btn-ghost" href="#/orders">← ${T.backToOrders}</a></div></div>
      <div class="order-details">
        <div>
          <div class="form-card">
            <h3>${T.deliveryStatus} <span class="status status-${s}" style="margin-inline-start:auto">${statusLabel(s)}</span></h3>
            ${s === 'cancelled' ? '' : `<div class="timeline">${flow.map((st, i) => `<div class="tl-step ${i <= idx ? 'done' : ''} ${i === idx ? 'cur' : ''}"><i></i><span>${statusLabel(st)}</span></div>`).join('')}</div>`}
            <div class="kv"><span>${T.trackNumber}</span><b>${o.track || '—'}</b></div>
            <div class="kv"><span>${T.estDelivery}</span><b>${fmtDate(o.eta || new Date(o.date).getTime() + 3 * 86400000)}</b></div>
            <div class="kv"><span>${T.deliveryMethod}</span><b>${o.delivery === 'pickup' ? T.pickup : T.courier}</b></div>
            <div class="kv"><span>${T.address}</span><b>${oc.flag} ${esc(o.address)}</b></div>
            <div class="kv"><span>${T.recipient}</span><b>${esc(o.name)}${o.phone ? ' · ' + esc(o.phone) : ''}</b></div>
            ${o.comment ? `<div class="kv"><span>${T.comment}</span><b>${esc(o.comment)}</b></div>` : ''}
          </div>
          <div class="form-card">
            <h3>${T.products} <small class="muted">${o.items.length}</small></h3>
            <div class="cart-list">${o.items.map(i => `<div class="cart-item"><a href="#/product/${i.id}"><img src="${i.img}" alt=""></a><div><a class="ci-title" href="#/product/${i.id}" data-tr="${esc(i.title)}">${esc(i.title)}</a><div class="ci-sub">${money(i.price)} × ${i.qty}</div></div><div class="ci-right"><b>${money(i.price * i.qty)}</b></div></div>`).join('')}</div>
          </div>
        </div>
        <aside class="summary">
          <h3>${T.total}</h3>
          <div class="sum-row"><span>${T.subtotal}</span><span>${money(t.old)}</span></div>
          ${t.saved ? `<div class="sum-row"><span>${T.discount}</span><span class="green">−${money(t.saved)}</span></div>` : ''}
          ${t.promoDisc ? `<div class="sum-row"><span>${T.promoCode}</span><span class="green">−${money(t.promoDisc)}</span></div>` : ''}
          ${t.bonusUsed ? `<div class="sum-row"><span>${T.bonusSpent}</span><span class="green">−${money(t.bonusUsed)}</span></div>` : ''}
          <div class="sum-row"><span>${T.delivery}</span><span>${t.shipping ? money(t.shipping) : T.free}</span></div>
          <div class="sum-row total"><span>${T.total}</span><span>${money(t.total)}</span></div>
          ${t.bonusEarned ? `<div class="sum-row bonus"><span>🎁 ${T.bonusEarned}</span><span>+${t.bonusEarned}</span></div>` : ''}
          <div class="kv"><span>${T.payment}</span><b>${o.payment === 'now' ? T.paidNow : T.payLater}</b></div>
          <div class="kv"><span>${T.status}</span><b>${fmtDate(o.date)} ${fmtTime(o.date)}</b></div>
          <div class="order-actions no-print">
            <button class="btn btn-secondary btn-sm" data-repeat="${o.id}">🔁 ${T.repeatOrder}</button>
            ${['processing', 'paid', 'awaiting'].includes(s) ? `<button class="btn btn-ghost btn-sm btn-danger" data-cancel="${o.id}">✕ ${T.cancelOrder}</button>` : ''}
          </div>
        </aside>
      </div>`;
    $('#printBtn').onclick = () => window.print();
    bindOrderActions(app, () => renderOrderDetails(app, params, id));
  }

  Object.assign(A, { STATUS_FLOW, statusLabel, liveStatus, renderOrders, bindOrderActions, renderOrderDetails });
})();
