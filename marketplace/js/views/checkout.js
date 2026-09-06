/* ===== GIGASAIT MARKET — Оформление заказа и страница успеха =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, BONUS_MAX_SHARE, COUNTRIES, FREE_SHIP_FROM, SHIP_COST, calcTotals, cartItems, cartSubtotal, country, countryName, esc, fmtDate, money, saveCart, state, store, summaryHTML, toast } = A;

  /* ---------- Оформление ---------- */
  function renderCheckout(app) {
    const items = cartItems();
    if (!items.length) { location.hash = '#/cart'; return; }
    document.title = `${T.checkoutTitle} — GIGASAIT Market`;
    const pr = state.profile;
    const c = country();
    const maxBonus = Math.min(state.bonus, Math.floor(cartSubtotal() * BONUS_MAX_SHARE));
    app.innerHTML = `
      <h1 class="page-title">${T.checkoutTitle}</h1>
      <form class="checkout" id="checkoutForm" novalidate>
        <div>
          <div class="form-card">
            <h3><span class="num">1</span>${T.recipient}</h3>
            <div class="form-grid">
              <div class="field"><label>${T.fullName} <span class="req">*</span></label><input name="name" required autocomplete="name" value="${esc(pr.name)}"></div>
              <div class="field"><label>${T.phone} <span class="req">*</span></label><input name="phone" required type="tel" autocomplete="tel" value="${esc(pr.phone)}" placeholder="+7 900 000-00-00"></div>
              <div class="field full"><label>${T.email}</label><input name="email" type="email" autocomplete="email" value="${esc(pr.email)}" placeholder="you@example.com"></div>
            </div>
          </div>
          <div class="form-card">
            <h3><span class="num">2</span>${T.address}</h3>
            <div class="form-grid">
              <div class="field"><label>${T.country}</label><select name="country" class="select" style="height:46px">${COUNTRIES.map(x => `<option value="${x.code}" ${x.code === c.code ? 'selected' : ''}>${x.flag} ${esc(countryName(x))}</option>`).join('')}</select></div>
              <div class="field"><label>${T.city} <span class="req">*</span></label><input name="city" required autocomplete="address-level2" value="${esc(pr.city)}"></div>
              <div class="field full"><label>${T.street} <span class="req">*</span></label><input name="street" required autocomplete="street-address" value="${esc(pr.street)}"></div>
              <div class="field"><label>${T.postal}</label><input name="postal" autocomplete="postal-code" value="${esc(pr.postal)}"></div>
              <div class="field full"><label>${T.comment} <small>(${T.optional})</small></label><textarea name="comment"></textarea></div>
            </div>
          </div>
          <div class="form-card">
            <h3><span class="num">3</span>${T.deliveryMethod}</h3>
            <div class="radio-cards">
              <label class="radio-card"><input type="radio" name="delivery" value="pickup" checked><b>🏬 ${T.pickup}</b><small>${T.pickupHint}</small></label>
              <label class="radio-card"><input type="radio" name="delivery" value="courier"><b>🚚 ${T.courier}</b><small>${T.courierHint} · ${cartSubtotal() >= FREE_SHIP_FROM ? T.free : money(SHIP_COST)}</small></label>
            </div>
            <div class="muted" style="margin-top:12px;font-size:14px">📅 ${T.estDelivery}: <b>${fmtDate(Date.now() + 2 * 86400000)} – ${fmtDate(Date.now() + 4 * 86400000)}</b></div>
          </div>
          <div class="form-card">
            <h3><span class="num">4</span>${T.payment}</h3>
            <div class="radio-cards">
              <label class="radio-card"><input type="radio" name="payment" value="now" checked><b>💳 ${T.payNow}</b><small>${T.payNowHint}</small></label>
              <label class="radio-card"><input type="radio" name="payment" value="later"><b>💵 ${T.payOnDelivery}</b><small>${T.payOnDeliveryHint}</small></label>
            </div>
            ${maxBonus > 0 ? `<label class="f-check bonus-use" style="margin-top:14px"><input type="checkbox" name="useBonus" checked>🎁 ${T.useBonuses}: <b>${maxBonus}</b> <small class="muted">(${T.bonusBalance}: ${state.bonus})</small></label>` : ''}
            <div class="card-form show" id="cardForm">
              <div class="card-chip"></div>
              <div class="form-grid">
                <div class="field full"><label>${T.cardNumber}</label><input name="cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="19"></div>
                <div class="field"><label>${T.cardExp}</label><input name="cardExp" inputmode="numeric" autocomplete="cc-exp" placeholder="12/28" maxlength="5"></div>
                <div class="field"><label>${T.cardCvc}</label><input name="cardCvc" type="password" inputmode="numeric" autocomplete="cc-csc" placeholder="•••" maxlength="3"></div>
                <div class="field"><label>${T.cardHolder}</label><input name="cardHolder" autocomplete="cc-name" placeholder="IVAN IVANOV"></div>
              </div>
              <small style="opacity:.7;display:block;margin-top:10px">${T.demoNotice}</small>
            </div>
          </div>
        </div>
        <aside class="summary">
          <div class="order-items">${items.map(({ p, qty }) => `<div class="order-item"><img src="${p.thumb}" alt=""><span data-tr="${esc(p.title)}">${esc(p.title)}</span><small>× ${qty}</small><b>${money(p.price * qty)}</b></div>`).join('')}</div>
          <div id="sumBox">${summaryHTML(calcTotals('pickup', maxBonus), false)}</div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="placeOrder">${T.placeOrder}</button>
          <small class="muted" style="text-align:center">${T.demoNotice}</small>
        </aside>
      </form>`;

    const form = $('#checkoutForm');
    const F = form.elements;
    const cardForm = $('#cardForm');
    const useBonus = () => (F.useBonus && F.useBonus.checked) ? maxBonus : 0;
    const refreshSum = () => { $('#sumBox').innerHTML = summaryHTML(calcTotals(F.delivery.value, useBonus()), false); };
    $$('input[name=payment]').forEach(r => r.onchange = () => cardForm.classList.toggle('show', F.payment.value === 'now'));
    $$('input[name=delivery]').forEach(r => r.onchange = refreshSum);
    if (F.useBonus) F.useBonus.onchange = refreshSum;
    F.cardNumber.oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); };
    F.cardExp.oninput = e => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; };
    F.cardCvc.oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); };
    $$('input[required]', form).forEach(i => i.oninput = () => i.classList.remove('error'));

    form.onsubmit = e => {
      e.preventDefault();
      let ok = true;
      $$('input[required]', form).forEach(i => { const bad = !i.value.trim(); i.classList.toggle('error', bad); if (bad) ok = false; });
      if (!ok) { toast(T.fillRequired, '⚠️'); const first = form.querySelector('.error'); $$('.error', form).forEach(i => A.shake && A.shake(i)); if (A.scrollToEl) A.scrollToEl(first, 120); first.focus({ preventScroll: true }); return; }
      const payNow = F.payment.value === 'now';
      if (payNow) {
        const num = F.cardNumber.value.replace(/\s/g, '');
        const okCard = num.length === 16 && /^\d{2}\/\d{2}$/.test(F.cardExp.value) && F.cardCvc.value.length === 3;
        if (!okCard) { toast(T.invalidCard, '💳'); if (A.shake) A.shake(F.cardNumber); F.cardNumber.focus(); return; }
      }
      state.profile = { ...state.profile, name: F.name.value, phone: F.phone.value, email: F.email.value, city: F.city.value, street: F.street.value, postal: F.postal.value };
      store.set('profile', state.profile);
      const btn = $('#placeOrder'); btn.disabled = true; btn.textContent = T.processing;
      setTimeout(() => {
        const totals = calcTotals(F.delivery.value, useBonus());
        const ts = Date.now();
        const order = {
          id: 'GM-' + ts.toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100),
          date: new Date(ts).toISOString(),
          items: items.map(({ p, qty }) => ({ id: p.id, title: p.title, price: p.price, qty, img: p.thumb })),
          totals, country: F.country.value, delivery: F.delivery.value, payment: payNow ? 'now' : 'later',
          status: payNow ? 'paid' : 'awaiting', address: `${F.city.value}, ${F.street.value}`, name: F.name.value, phone: F.phone.value, comment: F.comment.value, currency: c.code,
          track: 'GM' + String(ts).slice(-9) + 'RU', eta: new Date(ts + 3 * 86400000).toISOString()
        };
        state.orders.unshift(order); store.set('orders', state.orders);
        state.bonus = state.bonus - totals.bonusUsed + totals.bonusEarned; store.set('bonus', state.bonus);
        state.cart = {}; saveCart(); state.promo = null; store.remove('promo');
        if (payNow) toast(T.payFake, '💳');
        location.hash = '#/success/' + order.id;
      }, 900);
    };
  }

  function renderSuccess(app, params, id) {
    const o = state.orders.find(x => x.id === id) || state.orders[0];
    document.title = `${T.orderSuccess} — GIGASAIT Market`;
    app.innerHTML = `<div class="success">
      <div class="ic">✓</div>
      <h1>${T.orderSuccess}</h1>
      <div>${T.orderNumber}</div><div class="num">${o ? o.id : '—'}</div>
      <p>${T.orderSuccessHint}</p>
      ${o && o.totals.bonusEarned ? `<p class="bonus-line">🎁 +${o.totals.bonusEarned} · ${T.bonusBalance}: <b>${state.bonus}</b></p>` : ''}
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${o ? `<a class="btn btn-primary btn-lg" href="#/order/${o.id}">📦 ${T.orderDetails}</a>` : ''}
        <a class="btn btn-secondary btn-lg" href="#/catalog">${T.continueShopping}</a>
      </div></div>`;
  }

  Object.assign(A, { renderCheckout, renderSuccess });
})();
