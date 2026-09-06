/* ===== GIGASAIT MARKET — приложение (SPA на hash-роутинге) ===== */
(function () {
  'use strict';

  const { COUNTRIES, CATEGORIES, generateProducts } = window.MARKET_DATA;
  const I18N = window.MARKET_I18N;
  // Реальные товары (marketplace/js/products.js, создаётся tools/import_wb.py); если файла нет — заглушки
  // Полный импортированный каталог (products.js) — приоритет. Иначе: витринные товары с реальными фото + заглушки.
  const FEATURED = (window.MARKET_FEATURED || []).map(p => normalizeProduct({ ...p, source: { site: 'featured', url: '' }, createdAt: Date.now() - (p.id % 20) * 86400000 }));
  const PRODUCTS = (window.MARKET_PRODUCTS && window.MARKET_PRODUCTS.length)
    ? window.MARKET_PRODUCTS.map(normalizeProduct)
    : [...FEATURED, ...generateProducts()];

  function normalizeProduct(p) {
    return {
      ...p,
      rating: p.rating || 4.5,
      reviews: p.reviews || 0,
      stock: p.stock || 10,
      tags: p.tags || [],
      specs: p.specs || {},
      description: p.description || '',
      reviewsList: p.reviewsList || [],
      createdAt: p.createdAt || (Date.now() - (p.id % 90) * 86400000),
      source: p.source || { site: 'placeholder', url: '' }
    };
  }
  const BY_ID = new Map(PRODUCTS.map(p => [p.id, p]));

  /* ---------- Хранилище (localStorage) ---------- */
  const store = {
    get(key, def) { try { const v = localStorage.getItem('giga.' + key); return v === null ? def : JSON.parse(v); } catch { return def; } },
    set(key, val) { localStorage.setItem('giga.' + key, JSON.stringify(val)); },
    remove(key) { localStorage.removeItem('giga.' + key); }
  };

  const state = {
    theme: store.get('theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
    lang: store.get('lang', 'ru'),
    country: store.get('country', 'RU'),          // страна доставки (и валюта)
    cart: store.get('cart', {}),                  // {productId: qty}
    fav: store.get('fav', []),                    // [productId]
    orders: store.get('orders', []),
    profile: store.get('profile', { name: '', phone: '', email: '', city: '', street: '', postal: '', notifPromo: true, notifOrders: true }),
    promo: store.get('promo', null),
    pageSize: 24
  };
  // localStorage хранит theme/lang в JSON — совместимость с хабом, который хранит строки
  if (typeof state.theme !== 'string') state.theme = 'dark';
  if (typeof state.lang !== 'string' || !I18N.dict[state.lang]) state.lang = 'ru';

  let T = I18N.get(state.lang);
  const PROMOS = { GIGA10: { pct: 10 }, GIGA20: { pct: 20 }, FREE: { freeShip: true } };

  /* ---------- Утилиты ---------- */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const country = () => COUNTRIES.find(c => c.code === state.country) || COUNTRIES[0];
  const catName = c => state.lang === 'en' ? (I18N.CATS_EN[c.id] || c.name) : c.name;
  const countryName = c => state.lang === 'en' ? (I18N.COUNTRIES_EN[c.code] || c.name) : c.name;
  const catById = id => CATEGORIES.find(c => c.id === id);
  const catImg = c => `img/categories/${c.id}.jpg`;

  function money(rub) {
    const c = country();
    const v = rub * c.rate;
    const num = new Intl.NumberFormat(state.lang === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: c.rate < 0.1 ? 2 : 0 }).format(v);
    return `${num} ${c.symbol}`;
  }
  const pct = p => p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const stars = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  const isFav = id => state.fav.includes(id);
  const cartCount = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
  const cartItems = () => Object.entries(state.cart).map(([id, qty]) => ({ p: BY_ID.get(+id), qty })).filter(x => x.p);
  const cartSubtotal = () => cartItems().reduce((s, { p, qty }) => s + p.price * qty, 0);
  const cartOldTotal = () => cartItems().reduce((s, { p, qty }) => s + (p.oldPrice || p.price) * qty, 0);

  function toast(msg, icon = '✓') {
    const wrap = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2200);
  }

  function pluralRu(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  const productsWord = n => state.lang === 'en' ? (n === 1 ? 'product' : 'products') : pluralRu(n, 'товар', 'товара', 'товаров');
  const reviewsWord = n => state.lang === 'en' ? (n === 1 ? 'review' : 'reviews') : pluralRu(n, 'отзыв', 'отзыва', 'отзывов');

  /* ---------- Тема / язык ---------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    $('.theme-icon').textContent = state.theme === 'dark' ? '🌙' : '☀️';
    store.set('theme', state.theme);
    localStorage.setItem('giga.theme', state.theme); // хаб читает как строку
  }
  function applyLang() {
    T = I18N.get(state.lang);
    document.documentElement.lang = state.lang;
    $$('[data-i18n]').forEach(el => { el.textContent = T[el.dataset.i18n]; });
    $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = T[el.dataset.i18nPlaceholder]; });
    localStorage.setItem('giga.lang', state.lang);
    renderHeaderCats();
    renderCountryUI();
  }

  /* ---------- Корзина / избранное ---------- */
  function saveCart() { store.set('cart', state.cart); updateBadges(); }
  function addToCart(id, qty = 1) {
    state.cart[id] = (state.cart[id] || 0) + qty;
    saveCart(); toast(T.addedToCart, '🛒');
  }
  function setQty(id, qty) {
    if (qty <= 0) delete state.cart[id]; else state.cart[id] = Math.min(qty, 99);
    saveCart();
  }
  function toggleFav(id) {
    if (isFav(id)) { state.fav = state.fav.filter(x => x !== id); toast(T.removedFromFav, '💔'); }
    else { state.fav.push(id); toast(T.addedToFav, '❤️'); }
    store.set('fav', state.fav); updateBadges();
  }
  function updateBadges() {
    const c = cartCount(), f = state.fav.length;
    const cb = $('#cartBadge'), fb = $('#favBadge');
    cb.textContent = c; cb.classList.toggle('show', c > 0);
    fb.textContent = f; fb.classList.toggle('show', f > 0);
  }

  /* ---------- Карточка товара ---------- */
  function cardHTML(p, i = 0) {
    const c = catById(p.category);
    const inCart = !!state.cart[p.id];
    const flag = COUNTRIES.find(x => x.code === p.country).flag;
    return `
      <article class="card" style="animation-delay:${Math.min(i, 12) * 30}ms" data-id="${p.id}">
        <a class="card-img" href="#/product/${p.id}">
          <img src="${p.images[0]}" alt="${esc(p.title)}" loading="lazy">
          <div class="card-labels">
            ${p.oldPrice ? `<span class="label label-discount">-${pct(p)}%</span>` : ''}
            ${p.isNew ? `<span class="label label-new">${T.new}</span>` : ''}
            ${p.reviews > 1500 ? `<span class="label label-hit">${T.hit}</span>` : ''}
          </div>
        </a>
        <button class="fav-btn ${isFav(p.id) ? 'active' : ''}" data-fav="${p.id}" aria-label="favorite"><span class="heart">${isFav(p.id) ? '♥' : '♡'}</span></button>
        <div class="card-body">
          <div class="card-price">
            <b>${money(p.price)}</b>
            ${p.oldPrice ? `<s>${money(p.oldPrice)}</s><span class="pct">-${pct(p)}%</span>` : ''}
          </div>
          <a class="card-title" href="#/product/${p.id}">${esc(p.title)}</a>
          <div class="card-meta">
            <span class="star">★</span><span>${p.rating}</span>
            <span>· ${p.reviews} ${reviewsWord(p.reviews)}</span>
            <span class="flag" title="${esc(countryName(COUNTRIES.find(x => x.code === p.country)))}">${flag}</span>
          </div>
          <div class="card-tags">${p.tags.slice(0, 2).map(t => `<a class="tag" href="#/catalog?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>
          <button class="btn ${inCart ? 'btn-primary in-cart' : 'btn-primary'}" data-add="${p.id}">${inCart ? '✓ ' + T.inCart : T.addToCart}</button>
        </div>
      </article>`;
  }

  /* ---------- Роутер ---------- */
  function parseHash() {
    const h = location.hash.slice(1) || '/';
    const [path, qs] = h.split('?');
    const params = new URLSearchParams(qs || '');
    return { path, params };
  }
  const routes = {
    '/': renderHome,
    '/catalog': renderCatalog,
    '/product': renderProduct,
    '/cart': renderCart,
    '/favorites': renderFavorites,
    '/checkout': renderCheckout,
    '/success': renderSuccess,
    '/orders': renderOrders,
    '/settings': renderSettings
  };
  function navigate() {
    const { path, params } = parseHash();
    const seg = '/' + (path.split('/')[1] || '');
    const arg = path.split('/')[2];
    closeCatalog(); closePopovers();
    const app = $('#app');
    app.innerHTML = '';
    window.scrollTo({ top: 0 });
    (routes[seg] || renderHome)(app, params, arg);
    $$('.header-nav .nav-item, .bottom-nav a').forEach(a => {
      const href = a.getAttribute('href') || '';
      a.classList.toggle('active', href === '#' + seg || (seg === '/' && href === '#/'));
    });
    $$('.header-cats a').forEach(a => a.classList.toggle('active', seg === '/catalog' && a.dataset.cat === params.get('cat')));
  }

  /* ---------- Главная ---------- */
  function renderHome(app) {
    const hits = [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 12);
    const news = PRODUCTS.filter(p => p.isNew).sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
    const deals = PRODUCTS.filter(p => p.oldPrice).sort((a, b) => pct(b) - pct(a)).slice(0, 12);
    app.innerHTML = `
      <section class="promo">
        <h1>${T.promoTitle}</h1>
        <p>${T.promoSub}</p>
        <a class="btn btn-lg" href="#/catalog?discount=1&sort=discount">${T.promoBtn}</a>
      </section>
      <section class="section">
        <div class="section-head"><h2>${T.popularCats}</h2><a href="#/catalog">${T.viewAll} →</a></div>
        <div class="cat-grid">${CATEGORIES.map(c => `<a class="cat-tile" href="#/catalog?cat=${c.id}"><img src="${catImg(c)}" alt="" loading="lazy"><span class="cat-tile-name">${esc(catName(c))}</span></a>`).join('')}</div>
      </section>
      ${FEATURED.length && !window.MARKET_PRODUCTS?.length ? `<section class="section">
        <div class="section-head"><h2>⭐ ${T.featured}</h2><a href="#/catalog?featured=1">${T.viewAll} →</a></div>
        <div class="grid">${FEATURED.slice(0, 12).map(cardHTML).join('')}</div>
      </section>` : ''}
      <section class="section">
        <div class="section-head"><h2>🔥 ${T.bestsellers}</h2><a href="#/catalog?sort=popular">${T.viewAll} →</a></div>
        <div class="grid">${hits.map(cardHTML).join('')}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>✨ ${T.newArrivals}</h2><a href="#/catalog?new=1&sort=new">${T.viewAll} →</a></div>
        <div class="grid">${news.map(cardHTML).join('')}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>💥 ${T.sortDiscount}</h2><a href="#/catalog?discount=1&sort=discount">${T.viewAll} →</a></div>
        <div class="grid">${deals.map(cardHTML).join('')}</div>
      </section>`;
  }

  /* ---------- Каталог ---------- */
  function filterProducts(f) {
    let list = PRODUCTS;
    if (f.q) {
      const q = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(p => {
        const hay = `${p.title} ${p.brand} ${p.subcategory} ${catById(p.category).name} ${I18N.CATS_EN[p.category]} ${p.tags.join(' ')}`.toLowerCase();
        return q.every(w => hay.includes(w));
      });
    }
    if (f.cat) list = list.filter(p => p.category === f.cat);
    if (f.sub) list = list.filter(p => p.subcategory === f.sub);
    if (f.tag) list = list.filter(p => p.tags.includes(f.tag));
    if (f.country) list = list.filter(p => p.country === f.country);
    if (f.brands.length) list = list.filter(p => f.brands.includes(p.brand));
    if (f.min != null) list = list.filter(p => p.price * country().rate >= f.min);
    if (f.max != null) list = list.filter(p => p.price * country().rate <= f.max);
    if (f.discount) list = list.filter(p => p.oldPrice);
    if (f.isNew) list = list.filter(p => p.isNew);
    if (f.featured) list = list.filter(p => p.source && p.source.site === 'featured');
    if (f.rating) list = list.filter(p => p.rating >= f.rating);
    const sorters = {
      popular: (a, b) => b.reviews - a.reviews,
      new: (a, b) => b.createdAt - a.createdAt,
      priceAsc: (a, b) => a.price - b.price,
      priceDesc: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
      discount: (a, b) => pct(b) - pct(a)
    };
    return [...list].sort(sorters[f.sort] || sorters.popular);
  }
  function readFilters(params) {
    return {
      q: params.get('q') || '', cat: params.get('cat') || '', sub: params.get('sub') || '', tag: params.get('tag') || '',
      country: params.get('country') || '', brands: (params.get('brands') || '').split(',').filter(Boolean),
      min: params.get('min') ? +params.get('min') : null, max: params.get('max') ? +params.get('max') : null,
      discount: params.get('discount') === '1', isNew: params.get('new') === '1', featured: params.get('featured') === '1', rating: params.get('rating') ? +params.get('rating') : 0,
      sort: params.get('sort') || 'popular', page: +(params.get('page') || 1)
    };
  }
  function buildQuery(f) {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q); if (f.cat) p.set('cat', f.cat); if (f.sub) p.set('sub', f.sub); if (f.tag) p.set('tag', f.tag);
    if (f.country) p.set('country', f.country); if (f.brands.length) p.set('brands', f.brands.join(','));
    if (f.min != null) p.set('min', f.min); if (f.max != null) p.set('max', f.max);
    if (f.discount) p.set('discount', '1'); if (f.isNew) p.set('new', '1'); if (f.featured) p.set('featured', '1'); if (f.rating) p.set('rating', f.rating);
    if (f.sort && f.sort !== 'popular') p.set('sort', f.sort); if (f.page > 1) p.set('page', f.page);
    const s = p.toString();
    return '#/catalog' + (s ? '?' + s : '');
  }
  function goFilters(f, resetPage = true) { if (resetPage) f.page = 1; location.hash = buildQuery(f); }

  function renderCatalog(app, params) {
    const f = readFilters(params);
    const list = filterProducts(f);
    const shown = list.slice(0, f.page * state.pageSize);
    const cat = f.cat ? catById(f.cat) : null;
    const base = f.cat ? PRODUCTS.filter(p => p.category === f.cat) : PRODUCTS;
    const brands = [...new Set(base.map(p => p.brand))].sort();
    const tags = [...new Set(base.flatMap(p => p.tags))].sort();
    const rate = country().rate;
    const maxPrice = Math.ceil(Math.max(...base.map(p => p.price)) * rate);

    let title = T.catalog;
    if (f.q) title = `${T.searchResults}: «${esc(f.q)}»`;
    else if (f.sub) title = esc(f.sub);
    else if (cat) title = esc(catName(cat));
    else if (f.tag) title = `#${esc(f.tag)}`;
    else if (f.featured) title = T.featured;

    const chips = [];
    if (f.q) chips.push({ l: `🔎 ${f.q}`, k: 'q' });
    if (f.sub) chips.push({ l: f.sub, k: 'sub' });
    if (f.tag) chips.push({ l: '#' + f.tag, k: 'tag' });
    if (f.country) chips.push({ l: COUNTRIES.find(c => c.code === f.country).flag + ' ' + countryName(COUNTRIES.find(c => c.code === f.country)), k: 'country' });
    f.brands.forEach(b => chips.push({ l: b, k: 'brand:' + b }));
    if (f.min != null || f.max != null) chips.push({ l: `${T.price}: ${f.min ?? 0}–${f.max ?? '∞'}`, k: 'price' });
    if (f.discount) chips.push({ l: T.onlyDiscount, k: 'discount' });
    if (f.isNew) chips.push({ l: T.onlyNew, k: 'new' });
    if (f.rating) chips.push({ l: `★ ${f.rating}+`, k: 'rating' });

    app.innerHTML = `
      <div class="breadcrumbs"><a href="#/">${T.home}</a><span><a href="#/catalog">${T.catalog}</a></span>${cat ? `<span><a href="#/catalog?cat=${cat.id}">${esc(catName(cat))}</a></span>` : ''}${f.sub ? `<span>${esc(f.sub)}</span>` : ''}</div>
      <div class="catalog">
        <aside class="filters" id="filters">
          <div class="filters-head"><b>${T.filters}</b><button class="btn btn-ghost btn-sm filters-close" id="filtersClose">✕</button></div>
          <div>
            <h3>${T.categoriesTitle}</h3>
            <select class="select" id="fCat" style="width:100%">
              <option value="">${T.allCategories}</option>
              ${CATEGORIES.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${c.icon} ${esc(catName(c))}</option>`).join('')}
            </select>
            ${cat ? `<div class="f-tags" style="margin-top:10px">${cat.subs.map(s => `<a class="tag ${f.sub === s ? 'active' : ''}" href="${buildQuery({ ...f, sub: f.sub === s ? '' : s, page: 1 })}">${esc(s)}</a>`).join('')}</div>` : ''}
          </div>
          <div>
            <h3>${T.country}</h3>
            <select class="select" id="fCountry" style="width:100%">
              <option value="">${T.allCountries}</option>
              ${COUNTRIES.map(c => `<option value="${c.code}" ${f.country === c.code ? 'selected' : ''}>${c.flag} ${esc(countryName(c))}</option>`).join('')}
            </select>
          </div>
          <div>
            <h3>${T.price}, ${country().symbol}</h3>
            <div class="f-price">
              <input type="number" id="fMin" placeholder="${T.from}" value="${f.min ?? ''}" min="0">
              <span>—</span>
              <input type="number" id="fMax" placeholder="${T.to}" value="${f.max ?? ''}" min="0">
            </div>
            <input type="range" class="f-range" id="fRange" min="0" max="${maxPrice}" value="${f.max ?? maxPrice}">
          </div>
          <div>
            <h3>${T.rating}</h3>
            <div class="f-rating">${[0, 4, 4.5, 4.8].map(r => `<button data-rating="${r}" class="${f.rating === r ? 'active' : ''}">${r ? '★' + r + '+' : T.all}</button>`).join('')}</div>
          </div>
          <div>
            <label class="f-check"><input type="checkbox" id="fDiscount" ${f.discount ? 'checked' : ''}>${T.onlyDiscount}</label>
            <label class="f-check"><input type="checkbox" id="fNew" ${f.isNew ? 'checked' : ''}>${T.onlyNew}</label>
          </div>
          <div>
            <h3>${T.brand}</h3>
            <div style="max-height:220px;overflow:auto">
              ${brands.map(b => `<label class="f-check"><input type="checkbox" data-brand="${esc(b)}" ${f.brands.includes(b) ? 'checked' : ''}>${esc(b)}<small>${base.filter(p => p.brand === b).length}</small></label>`).join('')}
            </div>
          </div>
          <div>
            <h3>${T.tags}</h3>
            <div class="f-tags">${tags.map(t => `<a class="tag ${f.tag === t ? 'active' : ''}" href="${buildQuery({ ...f, tag: f.tag === t ? '' : t, page: 1 })}">${esc(t)}</a>`).join('')}</div>
          </div>
          <button class="btn btn-secondary btn-block" id="fReset">${T.resetFilters}</button>
        </aside>
        <section class="catalog-main">
          <div class="catalog-top">
            <div><h1>${title}</h1><div class="count">${T.found}: ${list.length} ${productsWord(list.length)}</div></div>
            <div class="catalog-controls">
              <button class="btn btn-secondary filters-toggle" id="filtersToggle">⚙ ${T.filters}${chips.length ? ` (${chips.length})` : ''}</button>
              <select class="select" id="sort">
                ${[['popular', T.sortPopular], ['new', T.sortNew], ['priceAsc', T.sortPriceAsc], ['priceDesc', T.sortPriceDesc], ['rating', T.sortRating], ['discount', T.sortDiscount]].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
          </div>
          ${chips.length ? `<div class="active-filters">${chips.map(c => `<span class="chip">${esc(c.l)}<button data-chip="${esc(c.k)}">×</button></span>`).join('')}<button class="btn btn-ghost btn-sm" id="fReset2">${T.resetFilters}</button></div>` : ''}
          ${shown.length ? `<div class="grid" id="grid">${shown.map(cardHTML).join('')}</div>` : `
            <div class="empty"><div class="ic">🔍</div><h2>${T.noResults}</h2><p>${T.noResultsHint}</p><a class="btn btn-primary" href="#/catalog">${T.resetFilters}</a></div>`}
          ${shown.length < list.length ? `<div class="load-more"><button class="btn btn-secondary btn-lg" id="loadMore">${T.showMore} (${list.length - shown.length})</button></div>` : ''}
        </section>
      </div>`;

    // обработчики фильтров
    $('#fCat').onchange = e => goFilters({ ...f, cat: e.target.value, sub: '', brands: [] });
    $('#fCountry').onchange = e => goFilters({ ...f, country: e.target.value });
    $('#sort').onchange = e => goFilters({ ...f, sort: e.target.value }, false);
    $('#fDiscount').onchange = e => goFilters({ ...f, discount: e.target.checked });
    $('#fNew').onchange = e => goFilters({ ...f, isNew: e.target.checked });
    $$('[data-rating]').forEach(b => b.onclick = () => goFilters({ ...f, rating: +b.dataset.rating }));
    $$('[data-brand]').forEach(cb => cb.onchange = () => {
      const brands = $$('[data-brand]:checked').map(x => x.dataset.brand);
      goFilters({ ...f, brands });
    });
    const applyPrice = () => {
      const min = $('#fMin').value, max = $('#fMax').value;
      goFilters({ ...f, min: min ? +min : null, max: max ? +max : null });
    };
    $('#fMin').onchange = applyPrice; $('#fMax').onchange = applyPrice;
    $('#fRange').oninput = e => { $('#fMax').value = e.target.value; };
    $('#fRange').onchange = applyPrice;
    const reset = () => { location.hash = '#/catalog' + (f.cat ? '?cat=' + f.cat : ''); };
    $('#fReset').onclick = reset; if ($('#fReset2')) $('#fReset2').onclick = reset;
    $$('[data-chip]').forEach(b => b.onclick = () => {
      const k = b.dataset.chip; const n = { ...f };
      if (k.startsWith('brand:')) n.brands = n.brands.filter(x => x !== k.slice(6));
      else if (k === 'price') { n.min = null; n.max = null; }
      else if (k === 'new') n.isNew = false;
      else if (k === 'rating') n.rating = 0;
      else if (k === 'discount') n.discount = false;
      else n[k] = '';
      goFilters(n);
    });
    const lm = $('#loadMore');
    if (lm) lm.onclick = () => {
      const next = list.slice(shown.length, shown.length + state.pageSize);
      $('#grid').insertAdjacentHTML('beforeend', next.map(cardHTML).join(''));
      f.page++; history.replaceState(null, '', buildQuery(f));
      const rest = list.length - shown.length - next.length;
      shown.push(...next);
      if (rest <= 0) lm.parentElement.remove(); else lm.textContent = `${T.showMore} (${rest})`;
    };
    const filters = $('#filters');
    const openF = () => { filters.classList.add('open'); $('#overlay').classList.add('show'); document.body.classList.add('no-scroll'); };
    const closeF = () => { filters.classList.remove('open'); $('#overlay').classList.remove('show'); document.body.classList.remove('no-scroll'); };
    $('#filtersToggle').onclick = openF; $('#filtersClose').onclick = closeF;
    $('#overlay').onclick = closeF;
  }

  /* ---------- Страница товара ---------- */
  function renderProduct(app, params, id) {
    const p = BY_ID.get(+id);
    if (!p) { app.innerHTML = `<div class="empty"><div class="ic">🤷</div><h2>${T.noResults}</h2><a class="btn btn-primary" href="#/catalog">${T.catalog}</a></div>`; return; }
    const cat = catById(p.category);
    const c = COUNTRIES.find(x => x.code === p.country);
    const similar = PRODUCTS.filter(x => x.category === p.category && x.id !== p.id).sort((a, b) => (a.subcategory === p.subcategory ? -1 : 1) - (b.subcategory === p.subcategory ? -1 : 1)).slice(0, 6);
    const qty = state.cart[p.id] || 0;
    document.title = `${p.title} — GIGASAIT Market`;
    app.innerHTML = `
      <div class="breadcrumbs"><a href="#/">${T.home}</a><span><a href="#/catalog">${T.catalog}</a></span><span><a href="#/catalog?cat=${cat.id}">${esc(catName(cat))}</a></span><span><a href="#/catalog?cat=${cat.id}&sub=${encodeURIComponent(p.subcategory)}">${esc(p.subcategory)}</a></span></div>
      <div class="product">
        <div class="gallery">
          <div class="gallery-main"><img id="galMain" src="${p.images[0]}" alt="${esc(p.title)}">
            <div class="card-labels">${p.oldPrice ? `<span class="label label-discount">-${pct(p)}%</span>` : ''}${p.isNew ? `<span class="label label-new">${T.new}</span>` : ''}</div>
          </div>
          <div class="gallery-thumbs">${p.images.map((src, i) => `<img src="${src}" class="${i === 0 ? 'active' : ''}" data-i="${i}" alt="">`).join('')}</div>
        </div>
        <div class="p-info">
          <h1>${esc(p.title)}</h1>
          <div class="p-meta">
            <span><span class="star">${stars(p.rating)}</span> ${p.rating}</span>
            <span>${p.reviews} ${reviewsWord(p.reviews)}</span>
            <a class="brand" href="#/catalog?brands=${encodeURIComponent(p.brand)}">${esc(p.brand)}</a>
            <span>${c.flag} ${esc(countryName(c))}</span>
          </div>
          <div class="card-tags" style="margin-bottom:22px">${p.tags.map(t => `<a class="tag" href="#/catalog?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')}</div>
          <div class="p-block"><h3>${T.description}</h3><p style="white-space:pre-line">${esc(p.description || '—')}</p></div>
          <div class="p-block"><h3>${T.specs}</h3><div class="specs">${Object.entries(p.specs).map(([k, v]) => `<div class="spec"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div></div>
          ${p.source && p.source.url && p.source.site !== 'featured' ? `<div class="p-block"><h3>${T.source}</h3><p>${p.supplier ? esc(p.supplier) + ' · ' : ''}<a href="${esc(p.source.url)}" target="_blank" rel="noopener" style="color:var(--accent)">${p.source.site === 'wildberries' ? 'Wildberries' : esc(p.source.site)} ↗</a></p></div>` : ''}
          <div class="p-block"><h3>${T.customerReviews}</h3>
            ${p.reviewsList.length ? '' : `<p>${T.noReviews}</p>`}
            ${p.reviewsList.map(r => `<div class="review"><div class="review-head"><b>${esc(r.name)}</b><span class="star">${stars(r.rating)}</span><small>${r.date}</small></div><p>${esc(r.text)}</p></div>`).join('')}
          </div>
        </div>
        <aside class="buy-box">
          <div class="buy-price"><b>${money(p.price)}</b>${p.oldPrice ? `<s>${money(p.oldPrice)}</s><span class="pct">-${pct(p)}%</span>` : ''}</div>
          <div class="${p.stock < 10 ? 'stock-low' : 'stock-ok'}">${p.stock < 10 ? `${T.left} ${p.stock} ${T.pcs}` : T.inStock}</div>
          <div class="buy-row">
            <div class="qty" id="qtyBox" ${qty ? '' : 'hidden'}><button data-q="-1">−</button><span id="qtyVal">${qty}</span><button data-q="1">+</button></div>
            <button class="btn btn-primary btn-lg ${qty ? 'in-cart' : ''}" id="addBtn">${qty ? '✓ ' + T.inCart : T.addToCart}</button>
          </div>
          <div class="buy-row">
            <button class="btn btn-secondary" id="buyNow">⚡ ${T.buyNow}</button>
            <button class="btn btn-secondary ${isFav(p.id) ? 'active' : ''}" id="favBtn" style="flex:0 0 52px">${isFav(p.id) ? '♥' : '♡'}</button>
          </div>
          <div class="buy-info">
            <div>🚚 ${T.deliveryTime} · ${c.flag} → ${country().flag}</div>
            <div>↩️ ${T.returns}</div>
            <div>🛡️ ${T.warranty}</div>
            <div><button class="btn btn-ghost btn-sm" id="shareBtn" style="padding:0">🔗 ${T.share}</button></div>
          </div>
        </aside>
      </div>
      <section class="section" style="margin-top:40px">
        <div class="section-head"><h2>${T.similar}</h2><a href="#/catalog?cat=${cat.id}">${T.viewAll} →</a></div>
        <div class="grid">${similar.map(cardHTML).join('')}</div>
      </section>`;

    $$('.gallery-thumbs img').forEach(im => im.onclick = () => { $('#galMain').src = im.src; $$('.gallery-thumbs img').forEach(x => x.classList.remove('active')); im.classList.add('active'); });
    const syncQty = () => {
      const q = state.cart[p.id] || 0;
      $('#qtyVal').textContent = q; $('#qtyBox').hidden = !q;
      $('#addBtn').className = 'btn btn-primary btn-lg' + (q ? ' in-cart' : '');
      $('#addBtn').textContent = q ? '✓ ' + T.inCart : T.addToCart;
    };
    $('#addBtn').onclick = () => { if (state.cart[p.id]) location.hash = '#/cart'; else { addToCart(p.id); syncQty(); } };
    $$('[data-q]').forEach(b => b.onclick = () => { setQty(p.id, (state.cart[p.id] || 0) + +b.dataset.q); syncQty(); });
    $('#buyNow').onclick = () => { if (!state.cart[p.id]) { state.cart[p.id] = 1; saveCart(); } location.hash = '#/checkout'; };
    $('#favBtn').onclick = () => { toggleFav(p.id); $('#favBtn').textContent = isFav(p.id) ? '♥' : '♡'; $('#favBtn').style.color = isFav(p.id) ? 'var(--pink)' : ''; };
    if (isFav(p.id)) $('#favBtn').style.color = 'var(--pink)';
    $('#shareBtn').onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast(T.copied, '🔗'); } catch { prompt('URL', location.href); } };
  }

  /* ---------- Корзина ---------- */
  function calcTotals() {
    const sub = cartSubtotal();
    const old = cartOldTotal();
    let promoDisc = 0, freeShip = false;
    const promo = state.promo && PROMOS[state.promo];
    if (promo) { if (promo.pct) promoDisc = Math.round(sub * promo.pct / 100); if (promo.freeShip) freeShip = true; }
    const shipping = (freeShip || sub >= 5000 || sub === 0) ? 0 : 299;
    return { sub, old, promoDisc, shipping, total: sub - promoDisc + shipping, saved: old - sub };
  }
  function summaryHTML(t, withBtn = true) {
    return `
      <h3>${T.total}</h3>
      <div class="sum-row"><span>${T.subtotal} (${cartCount()})</span><span>${money(t.old)}</span></div>
      ${t.saved ? `<div class="sum-row"><span>${T.discount}</span><span class="green">−${money(t.saved)}</span></div>` : ''}
      ${t.promoDisc ? `<div class="sum-row"><span>${T.promoCode} ${state.promo}</span><span class="green">−${money(t.promoDisc)}</span></div>` : ''}
      <div class="sum-row"><span>${T.delivery}</span><span class="${t.shipping ? '' : 'green'}">${t.shipping ? money(t.shipping) : T.free}</span></div>
      <div class="sum-row total"><span>${T.total}</span><span>${money(t.total)}</span></div>
      ${withBtn ? `<a class="btn btn-primary btn-lg btn-block" href="#/checkout">${T.checkout} →</a>` : ''}`;
  }
  function renderCart(app) {
    const items = cartItems();
    if (!items.length) {
      app.innerHTML = `<h1 class="page-title">${T.cartTitle}</h1><div class="empty"><div class="ic">🛒</div><h2>${T.cartEmpty}</h2><p>${T.cartEmptyHint}</p><a class="btn btn-primary btn-lg" href="#/catalog">${T.catalog}</a></div>`;
      return;
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
        </div>
        <aside class="summary" id="summary">
          <div class="promo-row"><input id="promoInput" placeholder="${T.promoCode}" value="${state.promo || ''}"><button class="btn btn-secondary" id="promoBtn">${T.promoApply}</button></div>
          <small style="color:var(--text-3)">${T.promoHint}</small>
          <div id="sumBox">${summaryHTML(t)}</div>
        </aside>
      </div>`;
    const refresh = () => {
      if (!cartCount()) return renderCart(app);
      $('#sumBox').innerHTML = summaryHTML(calcTotals());
      $('.page-title small').textContent = `${cartCount()} ${productsWord(cartCount())}`;
    };
    $('#cartList').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const id = +b.closest('.cart-item').dataset.id;
      if (b.dataset.q) { setQty(id, (state.cart[id] || 0) + +b.dataset.q); }
      if (b.dataset.rm) { setQty(id, 0); }
      const row = b.closest('.cart-item');
      if (state.cart[id]) row.outerHTML = cartItemHTML(BY_ID.get(id), state.cart[id]); else row.remove();
      refresh();
    });
    $('#clearCart').onclick = () => { state.cart = {}; saveCart(); renderCart(app); };
    $('#promoBtn').onclick = () => {
      const code = $('#promoInput').value.trim().toUpperCase();
      if (!code) { state.promo = null; store.set('promo', null); refresh(); return; }
      if (PROMOS[code]) { state.promo = code; store.set('promo', code); toast(T.promoOk, '🎉'); } else toast(T.promoBad, '⚠️');
      refresh();
    };
  }
  function cartItemHTML(p, qty) {
    return `<div class="cart-item" data-id="${p.id}">
      <a href="#/product/${p.id}"><img src="${p.images[0]}" alt=""></a>
      <div>
        <a class="ci-title" href="#/product/${p.id}">${esc(p.title)}</a>
        <div class="ci-sub">${esc(p.brand)} · ${COUNTRIES.find(c => c.code === p.country).flag} · ${money(p.price)} / ${T.pcs}</div>
        <div class="ci-actions">
          <div class="qty sm"><button data-q="-1">−</button><span>${qty}</span><button data-q="1">+</button></div>
          <button class="btn btn-ghost btn-sm" data-fav-cart="${p.id}">${isFav(p.id) ? '♥' : '♡'}</button>
          <button class="btn btn-ghost btn-sm btn-danger" data-rm="1">🗑 ${T.remove}</button>
        </div>
      </div>
      <div class="ci-right"><b>${money(p.price * qty)}</b>${p.oldPrice ? `<s>${money(p.oldPrice * qty)}</s>` : ''}</div>
    </div>`;
  }

  /* ---------- Избранное ---------- */
  function renderFavorites(app) {
    const list = state.fav.map(id => BY_ID.get(id)).filter(Boolean);
    app.innerHTML = `<h1 class="page-title">${T.favTitle} <small>${list.length}</small></h1>` +
      (list.length ? `<div class="grid">${list.map(cardHTML).join('')}</div>` :
        `<div class="empty"><div class="ic">💜</div><h2>${T.favEmpty}</h2><p>${T.favEmptyHint}</p><a class="btn btn-primary btn-lg" href="#/catalog">${T.catalog}</a></div>`);
  }

  /* ---------- Оформление ---------- */
  function renderCheckout(app) {
    const items = cartItems();
    if (!items.length) { location.hash = '#/cart'; return; }
    const t = calcTotals();
    const pr = state.profile;
    const c = country();
    app.innerHTML = `
      <h1 class="page-title">${T.checkoutTitle}</h1>
      <form class="checkout" id="checkoutForm" novalidate>
        <div>
          <div class="form-card">
            <h3><span class="num">1</span>${T.recipient}</h3>
            <div class="form-grid">
              <div class="field"><label>${T.fullName} <span class="req">*</span></label><input name="name" required value="${esc(pr.name)}" placeholder="Иван Иванов"></div>
              <div class="field"><label>${T.phone} <span class="req">*</span></label><input name="phone" required type="tel" value="${esc(pr.phone)}" placeholder="+7 900 000-00-00"></div>
              <div class="field full"><label>${T.email}</label><input name="email" type="email" value="${esc(pr.email)}" placeholder="you@example.com"></div>
            </div>
          </div>
          <div class="form-card">
            <h3><span class="num">2</span>${T.address}</h3>
            <div class="form-grid">
              <div class="field"><label>${T.country}</label><select name="country" class="select" style="height:46px">${COUNTRIES.map(x => `<option value="${x.code}" ${x.code === c.code ? 'selected' : ''}>${x.flag} ${esc(countryName(x))}</option>`).join('')}</select></div>
              <div class="field"><label>${T.city} <span class="req">*</span></label><input name="city" required value="${esc(pr.city)}"></div>
              <div class="field full"><label>${T.street} <span class="req">*</span></label><input name="street" required value="${esc(pr.street)}"></div>
              <div class="field"><label>${T.postal}</label><input name="postal" value="${esc(pr.postal)}"></div>
              <div class="field full"><label>${T.comment} <small>(${T.optional})</small></label><textarea name="comment"></textarea></div>
            </div>
          </div>
          <div class="form-card">
            <h3><span class="num">3</span>${T.deliveryMethod}</h3>
            <div class="radio-cards">
              <label class="radio-card"><input type="radio" name="delivery" value="pickup" checked><b>🏬 ${T.pickup}</b><small>${T.pickupHint}</small></label>
              <label class="radio-card"><input type="radio" name="delivery" value="courier"><b>🚚 ${T.courier}</b><small>${T.courierHint}</small></label>
            </div>
          </div>
          <div class="form-card">
            <h3><span class="num">4</span>${T.payment}</h3>
            <div class="radio-cards">
              <label class="radio-card"><input type="radio" name="payment" value="now" checked><b>💳 ${T.payNow}</b><small>${T.payNowHint}</small></label>
              <label class="radio-card"><input type="radio" name="payment" value="later"><b>💵 ${T.payOnDelivery}</b><small>${T.payOnDeliveryHint}</small></label>
            </div>
            <div class="card-form show" id="cardForm">
              <div class="card-chip"></div>
              <div class="form-grid">
                <div class="field full"><label>${T.cardNumber}</label><input name="cardNumber" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="19"></div>
                <div class="field"><label>${T.cardExp}</label><input name="cardExp" placeholder="12/28" maxlength="5"></div>
                <div class="field"><label>${T.cardCvc}</label><input name="cardCvc" type="password" placeholder="•••" maxlength="3"></div>
                <div class="field"><label>${T.cardHolder}</label><input name="cardHolder" placeholder="IVAN IVANOV"></div>
              </div>
              <small style="opacity:.7;display:block;margin-top:10px">${T.demoNotice}</small>
            </div>
          </div>
        </div>
        <aside class="summary">
          <div class="order-items">${items.map(({ p, qty }) => `<div class="order-item"><img src="${p.images[0]}" alt=""><span>${esc(p.title)} × ${qty}</span><b>${money(p.price * qty)}</b></div>`).join('')}</div>
          <div id="sumBox">${summaryHTML(t, false)}</div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="placeOrder">${T.placeOrder}</button>
          <small style="color:var(--text-3);text-align:center">${T.demoNotice}</small>
        </aside>
      </form>`;

    const form = $('#checkoutForm');
    const F = form.elements;
    const cardForm = $('#cardForm');
    $$('input[name=payment]').forEach(r => r.onchange = () => cardForm.classList.toggle('show', r.value === 'now' && r.checked));
    $$('input[name=delivery]').forEach(r => r.onchange = () => { $('#sumBox').innerHTML = summaryHTML(calcTotals(), false); });
    // форматирование карты
    F.cardNumber.oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); };
    F.cardExp.oninput = e => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; };
    F.cardCvc.oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); };

    form.onsubmit = e => {
      e.preventDefault();
      let ok = true;
      $$('input[required]', form).forEach(i => { const bad = !i.value.trim(); i.classList.toggle('error', bad); if (bad) ok = false; });
      if (!ok) { toast(T.fillRequired, '⚠️'); form.querySelector('.error').focus(); return; }
      const payNow = F.payment.value === 'now';
      if (payNow) {
        const num = F.cardNumber.value.replace(/\s/g, '');
        const okCard = num.length === 16 && /^\d{2}\/\d{2}$/.test(F.cardExp.value) && F.cardCvc.value.length === 3;
        if (!okCard) { toast(T.invalidCard, '💳'); return; }
      }
      // сохранить профиль
      state.profile = { ...state.profile, name: F.name.value, phone: F.phone.value, email: F.email.value, city: F.city.value, street: F.street.value, postal: F.postal.value };
      store.set('profile', state.profile);
      const btn = $('#placeOrder'); btn.disabled = true; btn.textContent = T.processing;
      setTimeout(() => {
        const totals = calcTotals();
        const order = {
          id: 'GM-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100),
          date: new Date().toISOString(),
          items: items.map(({ p, qty }) => ({ id: p.id, title: p.title, price: p.price, qty, img: p.images[0] })),
          totals, country: F.country.value, delivery: F.delivery.value, payment: payNow ? 'now' : 'later',
          status: payNow ? 'paid' : 'awaiting', address: `${F.city.value}, ${F.street.value}`, name: F.name.value, currency: c.code
        };
        state.orders.unshift(order); store.set('orders', state.orders);
        state.cart = {}; saveCart(); state.promo = null; store.set('promo', null);
        if (payNow) toast(T.payFake, '💳');
        location.hash = '#/success/' + order.id;
      }, 900);
    };
  }

  function renderSuccess(app, params, id) {
    const o = state.orders.find(x => x.id === id) || state.orders[0];
    app.innerHTML = `<div class="success">
      <div class="ic">✓</div>
      <h1>${T.orderSuccess}</h1>
      <div>${T.orderNumber}</div><div class="num">${o ? o.id : '—'}</div>
      <p>${T.orderSuccessHint}</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn-primary btn-lg" href="#/orders">📦 ${T.goToOrders}</a>
        <a class="btn btn-secondary btn-lg" href="#/catalog">${T.continueShopping}</a>
      </div></div>`;
  }

  /* ---------- Заказы ---------- */
  function renderOrders(app) {
    const st = { processing: T.statusProcessing, paid: T.statusPaid, awaiting: T.statusAwaiting, shipped: T.statusShipped, delivered: T.statusDelivered };
    app.innerHTML = `<h1 class="page-title">${T.ordersTitle} <small>${state.orders.length}</small></h1>` +
      (state.orders.length ? state.orders.map(o => {
        const oc = COUNTRIES.find(x => x.code === o.country) || country();
        const d = new Date(o.date);
        return `<div class="order-card">
          <div class="order-head"><div><b>${o.id}</b> <small>· ${d.toLocaleDateString(state.lang === 'en' ? 'en-GB' : 'ru-RU')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div><span class="status status-${o.status}">${st[o.status]}</span></div>
          <div class="order-thumbs">${o.items.map(i => `<a href="#/product/${i.id}" title="${esc(i.title)}"><img src="${i.img}" alt=""></a>`).join('')}</div>
          <div class="order-foot"><span>${oc.flag} ${esc(o.address)} · ${o.delivery === 'pickup' ? T.pickup : T.courier} · ${o.payment === 'now' ? T.paidNow : T.payLater}</span><b>${money(o.totals.total)}</b></div>
        </div>`;
      }).join('') : `<div class="empty"><div class="ic">📦</div><h2>${T.ordersEmpty}</h2><p>${T.ordersEmptyHint}</p><a class="btn btn-primary btn-lg" href="#/catalog">${T.catalog}</a></div>`);
  }

  /* ---------- Настройки ---------- */
  function renderSettings(app) {
    const pr = state.profile;
    app.innerHTML = `
      <h1 class="page-title">${T.settingsTitle}</h1>
      <div class="settings">
        <div class="form-card">
          <h3>🎨 ${T.themeTitle}</h3>
          <div class="theme-cards">
            <div class="theme-card ${state.theme === 'dark' ? 'active' : ''}" data-theme-pick="dark"><span class="sw" style="background:#0a0b10"></span>🌙 ${T.dark}</div>
            <div class="theme-card ${state.theme === 'light' ? 'active' : ''}" data-theme-pick="light"><span class="sw" style="background:#f3f4f9"></span>☀️ ${T.light}</div>
          </div>
        </div>
        <div class="form-card">
          <h3>🌐 ${T.language}</h3>
          <div class="lang-grid">${I18N.LANGS.map(l => `<button class="lang-btn ${state.lang === l.code ? 'active' : ''}" data-lang="${l.code}">${l.flag} ${l.name}</button>`).join('')}</div>
        </div>
        <div class="form-card">
          <h3>📍 ${T.deliveryCountry} / ${T.currency}</h3>
          <div class="lang-grid">${COUNTRIES.map(c => `<button class="lang-btn ${state.country === c.code ? 'active' : ''}" data-country="${c.code}">${c.flag} ${esc(countryName(c))}<br><small style="opacity:.7">${c.currency} (${c.symbol})</small></button>`).join('')}</div>
          <small style="color:var(--text-3);display:block;margin-top:10px">${T.currencyHint}</small>
        </div>
        <div class="form-card">
          <h3>👤 ${T.profile} / ${T.defaultAddress}</h3>
          <form id="profileForm" class="form-grid">
            <div class="field"><label>${T.fullName}</label><input name="name" value="${esc(pr.name)}"></div>
            <div class="field"><label>${T.phone}</label><input name="phone" value="${esc(pr.phone)}"></div>
            <div class="field full"><label>${T.email}</label><input name="email" type="email" value="${esc(pr.email)}"></div>
            <div class="field"><label>${T.city}</label><input name="city" value="${esc(pr.city)}"></div>
            <div class="field"><label>${T.postal}</label><input name="postal" value="${esc(pr.postal)}"></div>
            <div class="field full"><label>${T.street}</label><input name="street" value="${esc(pr.street)}"></div>
            <div class="full"><button class="btn btn-primary" type="submit">${T.save}</button></div>
          </form>
        </div>
        <div class="form-card">
          <h3>🔔 ${T.notifications}</h3>
          <div class="setting-row"><div><b>${T.notifPromo}</b><small>${T.notifPromoHint}</small></div><button class="switch ${pr.notifPromo ? 'on' : ''}" data-sw="notifPromo"></button></div>
          <div class="setting-row"><div><b>${T.notifOrders}</b><small>${T.notifOrdersHint}</small></div><button class="switch ${pr.notifOrders ? 'on' : ''}" data-sw="notifOrders"></button></div>
        </div>
        <div class="form-card">
          <h3>🗄 ${T.dangerZone}</h3>
          <button class="btn btn-secondary btn-danger" id="clearAll">🗑 ${T.clearData}</button>
        </div>
        <a class="btn btn-secondary" href="../index.html">⏏ ${T.backToHub}</a>
      </div>`;
    $$('[data-theme-pick]').forEach(b => b.onclick = () => { state.theme = b.dataset.themePick; applyTheme(); renderSettings(app); });
    $$('[data-lang]').forEach(b => b.onclick = () => { state.lang = b.dataset.lang; applyLang(); renderSettings(app); });
    $$('[data-country]').forEach(b => b.onclick = () => { setCountry(b.dataset.country); renderSettings(app); });
    $('#profileForm').onsubmit = e => {
      e.preventDefault(); const f = e.target.elements;
      state.profile = { ...state.profile, name: f.name.value, phone: f.phone.value, email: f.email.value, city: f.city.value, postal: f.postal.value, street: f.street.value };
      store.set('profile', state.profile); toast(T.saved);
    };
    $$('[data-sw]').forEach(b => b.onclick = () => { state.profile[b.dataset.sw] = !state.profile[b.dataset.sw]; store.set('profile', state.profile); b.classList.toggle('on'); });
    $('#clearAll').onclick = () => { if (confirm(T.confirmClear)) { Object.keys(localStorage).filter(k => k.startsWith('giga.')).forEach(k => localStorage.removeItem(k)); location.reload(); } };
  }

  /* ---------- Страна ---------- */
  function setCountry(code) { state.country = code; store.set('country', code); renderCountryUI(); navigate(); }
  function renderCountryUI() {
    const c = country();
    $('#countryFlag').textContent = c.flag; $('#countryName').textContent = countryName(c);
    $('#countryList').innerHTML = COUNTRIES.map(x => `<button class="${x.code === c.code ? 'active' : ''}" data-cc="${x.code}"><span class="flag">${x.flag}</span>${esc(countryName(x))}<small>${x.currency}</small></button>`).join('');
    $$('#countryList button').forEach(b => b.onclick = () => { setCountry(b.dataset.cc); closePopovers(); });
  }
  function closePopovers() { $$('.popover').forEach(p => p.classList.remove('show')); }

  /* ---------- Шапка: категории и каталог ---------- */
  function renderHeaderCats() {
    $('#headerCats').innerHTML = `<a href="#/catalog?discount=1&sort=discount">🔥 ${T.sortDiscount}</a>` + CATEGORIES.map(c => `<a href="#/catalog?cat=${c.id}" data-cat="${c.id}">${c.icon} ${esc(catName(c))}</a>`).join('');
    $('#catalogDropList').innerHTML = CATEGORIES.map((c, i) => `<button data-ci="${i}" class="${i === 0 ? 'active' : ''}"><img class="ic-img" src="${catImg(c)}" alt="">${esc(catName(c))}</button>`).join('');
    $$('#catalogDropList button').forEach(b => { b.onmouseenter = b.onclick = () => showCatSubs(+b.dataset.ci); });
    showCatSubs(0);
  }
  function showCatSubs(i) {
    const c = CATEGORIES[i];
    $$('#catalogDropList button').forEach((b, j) => b.classList.toggle('active', i === j));
    $('#catalogDropSubs').innerHTML = `<a class="cat-banner" href="#/catalog?cat=${c.id}" style="background-image:url('${catImg(c)}')"><span>${esc(catName(c))}</span></a>
      <h3>${esc(catName(c))} <a class="btn btn-secondary btn-sm" href="#/catalog?cat=${c.id}">${T.seeAllProducts}</a></h3>
      <div class="subs-grid">${c.subs.map(s => `<a href="#/catalog?cat=${c.id}&sub=${encodeURIComponent(s)}">${esc(s)}</a>`).join('')}</div>
      <div class="tags-row">${c.tags.map(t => `<a class="tag" href="#/catalog?cat=${c.id}&tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')}</div>`;
  }
  function openCatalog() { $('#catalogDrop').classList.add('open'); $('#catalogBtn').classList.add('active'); document.body.classList.add('no-scroll'); }
  function closeCatalog() { $('#catalogDrop').classList.remove('open'); $('#catalogBtn').classList.remove('active'); document.body.classList.remove('no-scroll'); }
  function toggleCatalog() { $('#catalogDrop').classList.contains('open') ? closeCatalog() : openCatalog(); }

  /* ---------- Поиск с подсказками ---------- */
  function setupSearch() {
    const input = $('#searchInput'), sug = $('#searchSuggest');
    let timer;
    input.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = input.value.trim();
        if (q.length < 2) { sug.classList.remove('show'); return; }
        const list = filterProducts({ ...readFilters(new URLSearchParams()), q }).slice(0, 6);
        const cats = CATEGORIES.filter(c => catName(c).toLowerCase().includes(q.toLowerCase()) || c.subs.some(s => s.toLowerCase().includes(q.toLowerCase()))).slice(0, 3);
        if (!list.length && !cats.length) { sug.classList.remove('show'); return; }
        sug.innerHTML = (cats.length ? `<div class="suggest-head">${T.categoriesTitle}</div>` + cats.map(c => `<a class="suggest-item" href="#/catalog?cat=${c.id}"><img src="${catImg(c)}" alt=""><div>${esc(catName(c))}<small>${c.subs.slice(0, 3).join(', ')}</small></div></a>`).join('') : '') +
          (list.length ? `<div class="suggest-head">${T.products}</div>` + list.map(p => `<a class="suggest-item" href="#/product/${p.id}"><img src="${p.images[0]}" alt=""><div>${esc(p.title)}<small>${esc(p.brand)} · ${esc(p.subcategory)}</small></div><span class="price">${money(p.price)}</span></a>`).join('') : '');
        sug.classList.add('show');
      }, 120);
    };
    $('#searchForm').onsubmit = e => {
      e.preventDefault(); sug.classList.remove('show');
      const q = input.value.trim();
      const { params } = parseHash();
      const f = readFilters(params); f.q = q; f.page = 1;
      location.hash = buildQuery(f);
      input.blur();
    };
    document.addEventListener('click', e => { if (!e.target.closest('.search')) sug.classList.remove('show'); });
    sug.addEventListener('click', () => sug.classList.remove('show'));
  }

  /* ---------- Глобальные делегированные клики ---------- */
  document.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault(); const id = +fav.dataset.fav; toggleFav(id);
      fav.classList.toggle('active', isFav(id)); fav.querySelector('.heart').textContent = isFav(id) ? '♥' : '♡';
      if (location.hash.startsWith('#/favorites') && !isFav(id)) fav.closest('.card').remove();
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault(); const id = +add.dataset.add;
      if (state.cart[id]) { location.hash = '#/cart'; return; }
      addToCart(id); add.classList.add('in-cart'); add.textContent = '✓ ' + T.inCart; return;
    }
    const favCart = e.target.closest('[data-fav-cart]');
    if (favCart) { const id = +favCart.dataset.favCart; toggleFav(id); favCart.textContent = isFav(id) ? '♥' : '♡'; return; }
  });

  /* ---------- Инициализация ---------- */
  function init() {
    applyTheme();
    applyLang();
    updateBadges();
    setupSearch();
    $('#themeToggle').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); };
    $('#catalogBtn').onclick = toggleCatalog;
    $('#mCatalogBtn').onclick = toggleCatalog;
    $('#catalogDrop').addEventListener('click', e => { if (e.target.closest('a')) closeCatalog(); });
    $('#countryBtn').onclick = e => {
      e.stopPropagation();
      const pop = $('#countryPop'); const r = e.currentTarget.getBoundingClientRect();
      pop.style.top = r.bottom + 8 + 'px'; pop.style.left = Math.min(r.left, innerWidth - 250) + 'px';
      pop.classList.toggle('show');
    };
    document.addEventListener('click', e => { if (!e.target.closest('.popover') && !e.target.closest('#countryBtn')) closePopovers(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCatalog(); closePopovers(); } });
    $('#logoutBtn').onclick = () => { /* переход на главный сайт GIGASAIT (ссылка) */ };
    $('#year').textContent = new Date().getFullYear();
    window.addEventListener('hashchange', navigate);
    navigate();
    // синхронизация вкладок
    window.addEventListener('storage', () => { state.cart = store.get('cart', {}); state.fav = store.get('fav', []); updateBadges(); });
  }
  init();

  // для отладки в консоли
  window.GIGA = { state, PRODUCTS, CATEGORIES, COUNTRIES };
})();
