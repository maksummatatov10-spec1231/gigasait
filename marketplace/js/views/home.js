/* ===== GIGASAIT MARKET — Главная страница =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, BY_ID, CATEGORIES, I18N, PRODUCTS, cardHTML, catImg, catName, dayNumber, esc, money, pct, productsWord, state, timers } = A;

  /* ---------- Главная ---------- */
  function dealOfDay() {
    const list = PRODUCTS.filter(p => pct(p) >= 20 && p.stock > 0).sort((a, b) => a.id - b.id);
    return list.length ? list[dayNumber() % list.length] : null;
  }
  function renderHome(app) {
    const hits = [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 12);
    const news = [...PRODUCTS].sort((a, b) => (b.isNew - a.isNew) || (b.createdAt - a.createdAt)).slice(0, 12);
    const deals = PRODUCTS.filter(p => p.oldPrice).sort((a, b) => pct(b) - pct(a)).slice(0, 12);
    const recent = state.recent.map(id => BY_ID.get(id)).filter(Boolean).slice(0, 6);
    const recCats = [...new Set(recent.map(p => p.category))];
    const recommended = recCats.length ? PRODUCTS.filter(p => recCats.includes(p.category) && !state.recent.includes(p.id)).sort((a, b) => b.rating - a.rating || b.reviews - a.reviews).slice(0, 6) : [];
    const deal = dealOfDay();
    app.innerHTML = `
      <section class="promo">
        <span class="shape s1"></span><span class="shape s2"></span><span class="shape s3"></span>
        <div class="promo-text">
          <h1>${T.promoTitle}</h1>
          <p>${T.promoSub}</p>
          <a class="btn btn-lg" href="#/catalog?discount=1&sort=discount">${T.promoBtn}</a>
        </div>
        <div class="promo-stats">
          <div><b>${PRODUCTS.length}</b><span>${productsWord(PRODUCTS.length)}</span></div>
          <div><b>${CATEGORIES.length}</b><span>${T.categoriesTitle.toLowerCase()}</span></div>
          <div><b>${I18N.LANGS.length}</b><span>🌐</span></div>
        </div>
      </section>
      <section class="features">
        <div><span>🚚</span><div><b>${T.featFast}</b><small>${T.featFastHint}</small></div></div>
        <div><span>🛡️</span><div><b>${T.featSecure}</b><small>${T.featSecureHint}</small></div></div>
        <div><span>↩️</span><div><b>${T.featReturns}</b><small>${T.featReturnsHint}</small></div></div>
        <div><span>💬</span><div><b>${T.featSupport}</b><small>${T.featSupportHint}</small></div></div>
      </section>
      ${deal ? `<section class="section deal">
        <a class="deal-img" href="#/product/${deal.id}"><img src="${deal.images[0]}" alt=""><span class="label label-discount">-${pct(deal)}%</span></a>
        <div class="deal-body">
          <div class="deal-kicker">⚡ ${T.dealOfDay}</div>
          <a class="deal-title" href="#/product/${deal.id}" data-tr="${esc(deal.title)}">${esc(deal.title)}</a>
          <div class="buy-price"><b>${money(deal.price)}</b><s>${money(deal.oldPrice)}</s></div>
          <div class="deal-timer">${T.endsIn}: <b id="dealTimer">--:--:--</b></div>
          <div class="buy-row"><button class="btn btn-primary btn-lg" data-add="${deal.id}">${state.cart[deal.id] ? '✓ ' + T.inCart : T.addToCart}</button><a class="btn btn-secondary btn-lg" href="#/product/${deal.id}">${T.description}</a></div>
        </div>
      </section>` : ''}
      <section class="section">
        <div class="section-head"><h2>${T.popularCats}</h2><a href="#/catalog">${T.viewAll} →</a></div>
        <div class="cat-grid">${CATEGORIES.map(c => `<a class="cat-tile" href="#/catalog?cat=${c.id}"><img src="${catImg(c)}" alt="" loading="lazy"><span class="cat-tile-name">${c.icon} ${esc(catName(c))}</span></a>`).join('')}</div>
      </section>
      ${recommended.length ? `<section class="section"><div class="section-head"><h2>💜 ${T.recommended}</h2></div><div class="grid grid-6">${recommended.map(cardHTML).join('')}</div></section>` : ''}
      ${recent.length ? `<section class="section"><div class="section-head"><h2>🕘 ${T.recentlyViewed}</h2></div><div class="grid grid-6">${recent.map(cardHTML).join('')}</div></section>` : ''}
      <section class="section">
        <div class="section-head"><h2>🔥 ${T.bestsellers}</h2><a href="#/catalog?sort=popular">${T.viewAll} →</a></div>
        <div class="grid">${hits.map(cardHTML).join('')}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>✨ ${T.newArrivals}</h2><a href="#/catalog?sort=new">${T.viewAll} →</a></div>
        <div class="grid">${news.map(cardHTML).join('')}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>💥 ${T.sortDiscount}</h2><a href="#/catalog?discount=1&sort=discount">${T.viewAll} →</a></div>
        <div class="grid">${deals.map(cardHTML).join('')}</div>
      </section>`;
    if (deal) {
      const tick = () => {
        const el = $('#dealTimer'); if (!el) return;
        const end = new Date(); end.setHours(24, 0, 0, 0);
        const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
        el.textContent = [s / 3600, s % 3600 / 60, s % 60].map(x => String(Math.floor(x)).padStart(2, '0')).join(':');
      };
      tick(); timers.push(setInterval(tick, 1000));
    }
  }

  Object.assign(A, { dealOfDay, renderHome });
})();
