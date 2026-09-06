/* ===== GIGASAIT MARKET — Страница товара =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, BONUS_RATE, BY_ID, FREE_SHIP_FROM, PRODUCTS, SHIP_COST, addToCart, cardHTML, cartSubtotal, catById, catName, country, countryName, countryOf, esc, fmt, fmtDate, inCompare, isFav, money, openLightbox, pct, pushRecent, reviewCount, reviewsWord, saveCart, setQty, stars, state, store, subName, tagName, toast, toggleCompare, toggleFav, trOn, translateIn, userReviews } = A;
  // функции из модулей, которые загружаются позже — связываются лениво
  const renderNotFound = (...args) => A.renderNotFound(...args);

  /* ---------- Страница товара ---------- */
  const SOURCE_NAMES = { wildberries: 'Wildberries', yandex: 'Яндекс Маркет', ozon: 'Ozon' };
  function renderProduct(app, params, id) {
    const p = BY_ID.get(+id);
    if (!p) return renderNotFound(app);
    const cat = catById(p.category);
    const c = countryOf(p.country);
    pushRecent(p.id);
    const similar = PRODUCTS.filter(x => x.category === p.category && x.id !== p.id)
      .sort((a, b) => ((b.subcategory === p.subcategory) - (a.subcategory === p.subcategory)) || b.reviews - a.reviews).slice(0, 6);
    const together = PRODUCTS.filter(x => x.category === p.category && x.subcategory !== p.subcategory && x.id !== p.id).sort((a, b) => ((a.id * 7 + p.id) % 97) - ((b.id * 7 + p.id) % 97)).slice(0, 2);
    const recent = state.recent.filter(x => x !== p.id).map(x => BY_ID.get(x)).filter(Boolean).slice(0, 6);
    const qty = state.cart[p.id] || 0;
    const mine = userReviews(p.id);
    const allReviews = [...mine, ...p.reviewsList];
    const rc = reviewCount(p);
    document.title = `${p.title} — GIGASAIT Market`;
    const tr = trOn();
    const buyInfo = `<div class="buy-info">
            <div>🚚 ${T.estDelivery}: <b>${fmtDate(Date.now() + 2 * 86400000)} – ${fmtDate(Date.now() + 4 * 86400000)}</b></div>
            <div>📦 ${c.flag} → ${country().flag} · ${cartSubtotal() + p.price >= FREE_SHIP_FROM ? T.free : money(SHIP_COST)}</div>
            <div>↩️ ${T.returns}</div>
            <div>🛡️ ${T.warranty}</div>
            <div><button class="btn btn-ghost btn-sm" id="shareBtn" style="padding:0">🔗 ${T.share}</button></div>
          </div>`;
    app.innerHTML = `
      <div class="breadcrumbs"><a href="#/">${T.home}</a><span><a href="#/catalog">${T.catalog}</a></span>${cat ? `<span><a href="#/catalog?cat=${cat.id}">${esc(catName(cat))}</a></span>` : ''}<span><a href="#/catalog?cat=${p.category}&sub=${encodeURIComponent(p.subcategory)}">${esc(subName(p.subcategory))}</a></span></div>
      <div class="product" id="productRoot">
        <div class="gallery">
          <div class="gallery-main" id="galMainWrap" title="${esc(T.zoom)}"><img id="galMain" src="${p.images[0]}" alt="${esc(p.title)}">
            <div class="card-labels">${p.oldPrice ? `<span class="label label-discount">-${pct(p)}%</span>` : ''}${p.isNew ? `<span class="label label-new">${T.new}</span>` : ''}</div>
            <span class="zoom-hint">🔍</span>
          </div>
          ${p.images.length > 1 ? `<div class="gallery-thumbs">${p.images.map((src, i) => `<img src="${src}" class="${i === 0 ? 'active' : ''}" data-i="${i}" alt="" loading="lazy">`).join('')}</div>` : ''}
        </div>
        <div class="p-info">
          <h1 data-tr="${esc(p.title)}">${esc(p.title)}</h1>
          <div class="p-meta">
            <span><span class="star">${stars(p.rating)}</span> ${p.rating}</span>
            <a href="#reviews">${rc} ${reviewsWord(rc)}</a>
            <a class="brand" href="#/catalog?brands=${encodeURIComponent(p.brand)}">${esc(p.brand)}</a>
            <span title="${esc(T.shipFrom)}">${c.flag} ${esc(countryName(c))}</span>
            <button class="muted sku-btn" id="skuBtn" title="${esc(T.skuCopied)}">${T.sku}: ${p.id} ⧉</button>
          </div>
          ${tr ? `<div class="tr-note" id="trNote"><span>🌐 ${T.translatedBy}</span><button class="link-btn" id="trToggle">${T.showOriginal}</button></div>` : ''}
          <div class="card-tags" style="margin-bottom:22px">${p.tags.map(t => `<a class="tag" href="#/catalog?tag=${encodeURIComponent(t)}">#${esc(tagName(t))}</a>`).join('')}</div>
          ${p.colors.length ? `<div class="p-block"><h3>${T.colors}</h3><div class="card-tags">${p.colors.map(x => `<span class="tag" data-tr="${esc(x)}">${esc(x)}</span>`).join('')}</div></div>` : ''}
          <div class="p-block"><h3>${T.description}</h3><p style="white-space:pre-line" data-tr-block="${esc(p.description || '—')}">${esc(p.description || '—')}</p></div>
          ${Object.keys(p.specs).length ? `<div class="p-block"><h3>${T.specs}</h3><div class="specs">${Object.entries(p.specs).map(([k, v]) => `<div class="spec"><span data-tr="${esc(k)}">${esc(k)}</span><span data-tr="${esc(v)}">${esc(v)}</span></div>`).join('')}</div></div>` : ''}
          ${together.length ? `<div class="p-block together"><h3>🧩 ${T.boughtTogether}</h3>
            <div class="together-row">
              ${[p, ...together].map((x, i) => `${i ? '<span class="plus">+</span>' : ''}<a class="together-item" href="#/product/${x.id}"><img src="${x.thumb}" alt=""><span data-tr="${esc(x.title)}">${esc(x.title)}</span><b>${money(x.price)}</b></a>`).join('')}
            </div>
            <button class="btn btn-secondary" id="addTogether">${fmt(T.addAllFor, { sum: money([p, ...together].reduce((s, x) => s + x.price, 0)) })}</button>
          </div>` : ''}
          ${p.source && p.source.url && p.source.site !== 'featured' ? `<div class="p-block"><h3>${T.source}</h3><p>${p.supplier ? esc(p.supplier) + ' · ' : ''}<a href="${esc(p.source.url)}" target="_blank" rel="noopener" class="link">${SOURCE_NAMES[p.source.site] || esc(p.source.site)} ↗</a></p></div>` : ''}
          <div class="p-block" id="reviews"><h3>${T.customerReviews} <small class="muted">${rc}</small></h3>
            ${allReviews.length ? '' : `<p>${T.noReviews}</p>`}
            ${allReviews.map(r => `<div class="review"><div class="review-head"><b>${esc(r.name)}</b><span class="star">${stars(r.rating)}</span><small>${fmtDate(r.date)}</small></div><p data-tr-block="${esc(r.text)}">${esc(r.text)}</p></div>`).join('')}
            <form class="review-form" id="reviewForm">
              <h4>✍️ ${T.writeReview}</h4>
              <div class="form-grid">
                <div class="field"><label>${T.yourName}</label><input name="name" required value="${esc(state.profile.name)}"></div>
                <div class="field"><label>${T.yourRating}</label><div class="rate-pick" id="ratePick">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-r="${n}" class="${n <= 5 ? 'on' : ''}">★</button>`).join('')}</div></div>
                <div class="field full"><label>${T.reviewText}</label><textarea name="text" required minlength="5"></textarea></div>
                <div class="full"><button class="btn btn-primary">${T.writeReview}</button></div>
              </div>
            </form>
          </div>
        </div>
        <aside class="buy-box">
          <div class="buy-price"><b>${money(p.price)}</b>${p.oldPrice ? `<s>${money(p.oldPrice)}</s><span class="pct">-${pct(p)}%</span>` : ''}</div>
          <div class="${p.stock < 10 ? 'stock-low' : 'stock-ok'}">${p.stock < 10 ? `${T.left} ${p.stock} ${T.pcs}` : T.inStock}</div>
          <div class="bonus-line">🎁 ${fmt(T.bonusEarn, { n: Math.round(p.price * BONUS_RATE) })}</div>
          <div class="buy-row">
            <div class="qty" id="qtyBox" ${qty ? '' : 'hidden'}><button data-q="-1" aria-label="−">−</button><span id="qtyVal">${qty}</span><button data-q="1" aria-label="+">+</button></div>
            <button class="btn btn-primary btn-lg ${qty ? 'in-cart' : ''}" id="addBtn">${qty ? '✓ ' + T.inCart : T.addToCart}</button>
          </div>
          <div class="buy-row">
            <button class="btn btn-secondary" id="buyNow">⚡ ${T.buyNow}</button>
            <button class="btn btn-secondary icon-only ${isFav(p.id) ? 'active' : ''}" id="favBtn" title="${esc(T.favorites)}">${isFav(p.id) ? '♥' : '♡'}</button>
            <button class="btn btn-secondary icon-only ${inCompare(p.id) ? 'active' : ''}" id="cmpBtn" title="${esc(T.compare)}">⚖</button>
          </div>
          ${buyInfo}
        </aside>
        <!-- на телефоне панель покупки прилипает к низу экрана, а сведения о доставке показываются здесь -->
        <div class="buy-info-mobile">${buyInfo.replace('id="shareBtn"', 'id="shareBtnM"')}</div>
      </div>
      <section class="section" style="margin-top:40px">
        <div class="section-head"><h2>${T.similar}</h2>${cat ? `<a href="#/catalog?cat=${cat.id}">${T.viewAll} →</a>` : ''}</div>
        <div class="grid grid-6">${similar.map(cardHTML).join('')}</div>
      </section>
      ${recent.length ? `<section class="section"><div class="section-head"><h2>🕘 ${T.recentlyViewed}</h2></div><div class="grid grid-6">${recent.map(cardHTML).join('')}</div></section>` : ''}`;

    let cur = 0;
    const setImg = i => { cur = (i + p.images.length) % p.images.length; $('#galMain').src = p.images[cur]; $$('.gallery-thumbs img').forEach((x, j) => x.classList.toggle('active', j === cur)); };
    $$('.gallery-thumbs img').forEach(im => im.onclick = () => setImg(+im.dataset.i));
    $('#galMainWrap').onclick = () => openLightbox(p.images, cur);
    const syncQty = () => {
      const q = state.cart[p.id] || 0;
      $('#qtyVal').textContent = q; $('#qtyBox').hidden = !q;
      $('#addBtn').className = 'btn btn-primary btn-lg' + (q ? ' in-cart' : '');
      $('#addBtn').textContent = q ? '✓ ' + T.inCart : T.addToCart;
    };
    $('#addBtn').onclick = e => { if (state.cart[p.id]) location.hash = '#/cart'; else { addToCart(p.id); syncQty(); if (A.flyToCart) A.flyToCart($('.gallery-main', app) || e.currentTarget, '#navCart'); } };
    $$('.buy-box [data-q]').forEach(b => b.onclick = () => { setQty(p.id, (state.cart[p.id] || 0) + +b.dataset.q); syncQty(); });
    $('#buyNow').onclick = () => { if (!state.cart[p.id]) { state.cart[p.id] = 1; saveCart(); } location.hash = '#/checkout'; };
    $('#favBtn').onclick = () => { toggleFav(p.id); $('#favBtn').textContent = isFav(p.id) ? '♥' : '♡'; $('#favBtn').classList.toggle('active', isFav(p.id)); };
    $('#cmpBtn').onclick = () => { toggleCompare(p.id); $('#cmpBtn').classList.toggle('active', inCompare(p.id)); };
    $('#shareBtn').onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast(T.copied, '🔗'); } catch { prompt('URL', location.href); } };
    if ($('#shareBtnM')) $('#shareBtnM').onclick = $('#shareBtn').onclick;
    $('#skuBtn').onclick = async () => { try { await navigator.clipboard.writeText(String(p.id)); toast(T.skuCopied, '⧉'); } catch { /* нет доступа к буферу */ } };
    const at = $('#addTogether');
    if (at) at.onclick = () => { [p, ...together].forEach(x => { state.cart[x.id] = Math.min((state.cart[x.id] || 0) + 1, 99); }); saveCart(); syncQty(); toast(T.addedItems, '🛒', { label: T.goToCart, fn: () => { location.hash = '#/cart'; } }); };
    // отзыв
    let rating = 5;
    $$('#ratePick button').forEach(b => b.onclick = () => { rating = +b.dataset.r; $$('#ratePick button').forEach(x => x.classList.toggle('on', +x.dataset.r <= rating)); });
    $('#reviewForm').onsubmit = e => {
      e.preventDefault(); const f = e.target.elements;
      if (!f.name.value.trim() || f.text.value.trim().length < 5) { toast(T.fillRequired, '⚠️'); return; }
      const list = userReviews(p.id); list.unshift({ name: f.name.value.trim(), rating, text: f.text.value.trim(), date: new Date().toISOString() });
      state.reviews[p.id] = list; store.set('reviews', state.reviews);
      if (!state.profile.name) { state.profile.name = f.name.value.trim(); store.set('profile', state.profile); }
      toast(T.reviewSent, '✍️'); renderProduct(app, params, id); translateIn(app); const rv = $('#reviews'); if (rv && rv.scrollIntoView) rv.scrollIntoView({ behavior: 'smooth' });
    };
    // переключатель оригинал/перевод
    const tt = $('#trToggle');
    if (tt) {
      let showingOrig = false;
      tt.onclick = () => {
        showingOrig = !showingOrig;
        const root = $('#productRoot');
        $$('[data-tr], [data-tr-block]', root).forEach(el => {
          const src = el.dataset.tr ?? el.dataset.trBlock;
          if (showingOrig) { el.dataset.orig = el.textContent; el.textContent = src; }
          else if (el.dataset.orig != null) { el.textContent = el.dataset.orig; }
        });
        tt.textContent = showingOrig ? T.translate : T.showOriginal;
        $('#trNote span').textContent = showingOrig ? '🌐 ' + T.originalText : '🌐 ' + T.translatedBy;
      };
    }
  }

  Object.assign(A, { SOURCE_NAMES, renderProduct });
})();
