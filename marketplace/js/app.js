/* ===== GIGASAIT MARKET — приложение (SPA на hash-роутинге) =====
   v0.6.0: 15 языков с автоопределением, страницы «Доставка / Возврат / Контакты / О проекте / FAQ»,
   сравнение товаров, недавно просмотренные, история поиска, лайтбокс галереи, отмена/повтор заказа,
   кнопка «наверх», 404, исправления багов (тема и язык не сохранялись, стоимость доставки не зависела от способа). */
(function () {
  'use strict';

  const { COUNTRIES, CATEGORIES, generateProducts, placeholderImage } = window.MARKET_DATA;
  const I18N = window.MARKET_I18N;
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
      colors: p.colors || [],
      specs: p.specs || {},
      images: (p.images && p.images.length) ? p.images : [placeholderImage(p.title || '', '🛍️', ['#7c5cff', '#ff5c8a'], p.id)],
      description: p.description || '',
      reviewsList: p.reviewsList || [],
      createdAt: p.createdAt || (Date.now() - (p.id % 90) * 86400000),
      source: p.source || { site: 'placeholder', url: '' }
    };
  }
  const BY_ID = new Map(PRODUCTS.map(p => [p.id, p]));

  /* ---------- Хранилище (localStorage) ----------
     Строки хранятся как есть (их читает и хаб), объекты — в JSON. Раньше тема и язык писались как строка,
     а читались через JSON.parse — из-за этого настройки сбрасывались при перезагрузке. Исправлено. */
  const store = {
    get(key, def) {
      const v = localStorage.getItem('giga.' + key);
      if (v === null) return def;
      try { return JSON.parse(v); } catch { return v; }
    },
    set(key, val) { localStorage.setItem('giga.' + key, typeof val === 'string' ? val : JSON.stringify(val)); },
    remove(key) { localStorage.removeItem('giga.' + key); }
  };

  const state = {
    theme: store.get('theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
    lang: 'ru', langAuto: false,
    country: store.get('country', 'RU'),
    cart: store.get('cart', {}),
    fav: store.get('fav', []),
    compare: store.get('compare', []),
    recent: store.get('recent', []),
    searches: store.get('searches', []),
    orders: store.get('orders', []),
    profile: store.get('profile', { name: '', phone: '', email: '', city: '', street: '', postal: '', notifPromo: true, notifOrders: true }),
    promo: store.get('promo', null),
    pageSize: 24
  };
  if (state.theme !== 'light' && state.theme !== 'dark') state.theme = 'dark';
  if (!COUNTRIES.some(c => c.code === state.country)) state.country = 'RU';
  if (!Array.isArray(state.fav)) state.fav = [];
  if (!Array.isArray(state.compare)) state.compare = [];
  if (!Array.isArray(state.recent)) state.recent = [];
  if (!Array.isArray(state.searches)) state.searches = [];
  if (!Array.isArray(state.orders)) state.orders = [];
  if (!state.cart || typeof state.cart !== 'object') state.cart = {};

  // Язык: сохранённый выбор → иначе автоопределение по браузеру (первый визит)
  let firstVisitLang = false;
  {
    const saved = store.get('lang', null);
    if (typeof saved === 'string' && I18N.has(saved)) { state.lang = saved; state.langAuto = store.get('langAuto', false) === true; }
    else { state.lang = I18N.detect(); state.langAuto = true; firstVisitLang = true; store.set('lang', state.lang); store.set('langAuto', true); }
  }

  let T = I18N.get(state.lang);
  const PROMOS = { GIGA10: { pct: 10 }, GIGA20: { pct: 20 }, FREE: { freeShip: true } };
  const FREE_SHIP_FROM = 5000, SHIP_COST = 299, COMPARE_MAX = 4;

  /* ---------- Утилиты ---------- */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const country = () => COUNTRIES.find(c => c.code === state.country) || COUNTRIES[0];
  const countryOf = code => COUNTRIES.find(c => c.code === code) || COUNTRIES[0];
  const catName = c => state.lang === 'ru' ? c.name : I18N.name(state.lang, 'cats', c.id) === c.id ? c.name : I18N.name(state.lang, 'cats', c.id);
  const subName = s => I18N.name(state.lang, 'subs', s);
  const tagName = t => I18N.name(state.lang, 'tags', t);
  const countryName = c => state.lang === 'ru' ? c.name : (I18N.name(state.lang, 'countries', c.code) === c.code ? c.name : I18N.name(state.lang, 'countries', c.code));
  const catById = id => CATEGORIES.find(c => c.id === id);
  const catImg = c => `img/categories/${c.id}.jpg`;
  const locale = () => I18N.locale(state.lang);
  const fmtDate = d => { try { return new Date(d).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return new Date(d).toLocaleDateString(); } };
  const fmtTime = d => { try { return new Date(d).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

  function money(rub) {
    const c = country();
    const v = rub * c.rate;
    let num;
    try { num = new Intl.NumberFormat(locale(), { maximumFractionDigits: c.rate < 0.1 ? 2 : 0 }).format(v); }
    catch { num = Math.round(v).toLocaleString(); }
    return `${num} ${c.symbol}`;
  }
  const pct = p => p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const stars = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  const isFav = id => state.fav.includes(id);
  const inCompare = id => state.compare.includes(id);
  const cartCount = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
  const cartItems = () => Object.entries(state.cart).map(([id, qty]) => ({ p: BY_ID.get(+id), qty })).filter(x => x.p);
  const cartSubtotal = () => cartItems().reduce((s, { p, qty }) => s + p.price * qty, 0);
  const cartOldTotal = () => cartItems().reduce((s, { p, qty }) => s + (p.oldPrice || p.price) * qty, 0);
  const productsWord = n => I18N.plural(state.lang, 'products', n);
  const reviewsWord = n => I18N.plural(state.lang, 'reviews', n);
  const fmt = I18N.fmt;

  function toast(msg, icon = '✓') {
    const wrap = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2400);
  }

  /* ---------- Тема / язык ---------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    $('.theme-icon').textContent = state.theme === 'dark' ? '🌙' : '☀️';
    store.set('theme', state.theme);
  }
  function applyLang() {
    T = I18N.get(state.lang);
    document.documentElement.lang = state.lang;
    document.documentElement.dir = I18N.dir(state.lang);
    document.body.classList.toggle('rtl', I18N.dir(state.lang) === 'rtl');
    $$('[data-i18n]').forEach(el => { el.textContent = T[el.dataset.i18n]; });
    $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = T[el.dataset.i18nPlaceholder]; });
    $$('[data-i18n-title]').forEach(el => { el.title = T[el.dataset.i18nTitle]; });
    store.set('lang', state.lang);
    store.set('langAuto', state.langAuto);
    renderHeaderCats();
    renderCountryUI();
    renderLangUI();
    renderCompareBar();
  }
  function setLang(code, auto = false) {
    if (!I18N.has(code)) return;
    state.lang = code; state.langAuto = auto;
    applyLang(); navigate();
  }

  /* ---------- Корзина / избранное / сравнение ---------- */
  function saveCart() { store.set('cart', state.cart); updateBadges(); }
  function addToCart(id, qty = 1) {
    state.cart[id] = Math.min((state.cart[id] || 0) + qty, 99);
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
  function toggleCompare(id) {
    if (inCompare(id)) { state.compare = state.compare.filter(x => x !== id); toast(T.removedFromCompare, '⚖'); }
    else if (state.compare.length >= COMPARE_MAX) { toast(T.compareLimit, '⚠️'); return false; }
    else { state.compare.push(id); toast(T.addedToCompare, '⚖'); }
    store.set('compare', state.compare); renderCompareBar();
    return true;
  }
  function pushRecent(id) {
    state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0, 12);
    store.set('recent', state.recent);
  }
  function pushSearch(q) {
    q = q.trim(); if (!q) return;
    state.searches = [q, ...state.searches.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    store.set('searches', state.searches);
  }
  function updateBadges() {
    const c = cartCount(), f = state.fav.length;
    const cb = $('#cartBadge'), fb = $('#favBadge');
    cb.textContent = c; cb.classList.toggle('show', c > 0);
    fb.textContent = f; fb.classList.toggle('show', f > 0);
  }
  function renderCompareBar() {
    let bar = $('#compareBar');
    if (!bar) { bar = document.createElement('a'); bar.id = 'compareBar'; bar.className = 'compare-bar'; bar.href = '#/compare'; document.body.appendChild(bar); }
    const n = state.compare.length;
    bar.innerHTML = `⚖ ${esc(T.compare)} <b>${n}</b>`;
    bar.classList.toggle('show', n > 0 && !location.hash.startsWith('#/compare'));
  }

  /* ---------- Карточка товара ---------- */
  function cardHTML(p, i = 0) {
    const inCart = !!state.cart[p.id];
    const c = countryOf(p.country);
    return `
      <article class="card" style="animation-delay:${Math.min(i, 12) * 30}ms" data-id="${p.id}">
        <a class="card-img" href="#/product/${p.id}">
          <img src="${p.images[0]}" alt="${esc(p.title)}" loading="lazy" decoding="async">
          <div class="card-labels">
            ${p.oldPrice ? `<span class="label label-discount">-${pct(p)}%</span>` : ''}
            ${p.isNew ? `<span class="label label-new">${T.new}</span>` : ''}
            ${p.reviews > 1500 ? `<span class="label label-hit">${T.hit}</span>` : ''}
          </div>
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
          <a class="card-title" href="#/product/${p.id}" title="${esc(p.title)}">${esc(p.title)}</a>
          <div class="card-meta">
            <span class="star">★</span><span>${p.rating}</span>
            <span>· ${p.reviews} ${reviewsWord(p.reviews)}</span>
            <span class="flag" title="${esc(countryName(c))}">${c.flag}</span>
          </div>
          <div class="card-tags">${p.tags.slice(0, 2).map(t => `<a class="tag" href="#/catalog?tag=${encodeURIComponent(t)}">${esc(tagName(t))}</a>`).join('')}</div>
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
    '/compare': renderCompare,
    '/checkout': renderCheckout,
    '/success': renderSuccess,
    '/orders': renderOrders,
    '/settings': renderSettings,
    '/page': renderPage
  };
  function navigate() {
    const { path, params } = parseHash();
    const seg = '/' + (path.split('/')[1] || '');
    const arg = decodeURIComponent(path.split('/')[2] || '');
    closeCatalog(); closePopovers(); closeLightbox();
    const app = $('#app');
    app.innerHTML = '';
    window.scrollTo({ top: 0 });
    document.title = 'GIGASAIT Market';
    (routes[seg] || renderNotFound)(app, params, arg);
    $$('.header-nav .nav-item, .bottom-nav a').forEach(a => {
      const href = a.getAttribute('href') || '';
      a.classList.toggle('active', href === '#' + seg || (seg === '/' && href === '#/'));
    });
    $$('.header-cats a').forEach(a => a.classList.toggle('active', seg === '/catalog' && a.dataset.cat === params.get('cat')));
    renderCompareBar();
  }

  /* ---------- Главная ---------- */
  function renderHome(app) {
    const hits = [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 12);
    const news = [...PRODUCTS].sort((a, b) => (b.isNew - a.isNew) || (b.createdAt - a.createdAt)).slice(0, 12);
    const deals = PRODUCTS.filter(p => p.oldPrice).sort((a, b) => pct(b) - pct(a)).slice(0, 12);
    const recent = state.recent.map(id => BY_ID.get(id)).filter(Boolean).slice(0, 6);
    app.innerHTML = `
      <section class="promo">
        <div class="promo-text">
          <h1>${T.promoTitle}</h1>
          <p>${T.promoSub}</p>
          <a class="btn btn-lg" href="#/catalog?discount=1&sort=discount">${T.promoBtn}</a>
        </div>
        <div class="promo-stats">
          <div><b>${PRODUCTS.length}</b><span>${productsWord(PRODUCTS.length)}</span></div>
          <div><b>${CATEGORIES.length}</b><span>${T.categoriesTitle.toLowerCase()}</span></div>
          <div><b>${COUNTRIES.length}</b><span>${T.country.toLowerCase()}</span></div>
        </div>
      </section>
      <section class="features">
        <div><span>🚚</span><div><b>${T.featFast}</b><small>${T.featFastHint}</small></div></div>
        <div><span>🛡️</span><div><b>${T.featSecure}</b><small>${T.featSecureHint}</small></div></div>
        <div><span>↩️</span><div><b>${T.featReturns}</b><small>${T.featReturnsHint}</small></div></div>
        <div><span>💬</span><div><b>${T.featSupport}</b><small>${T.featSupportHint}</small></div></div>
      </section>
      <section class="section">
        <div class="section-head"><h2>${T.popularCats}</h2><a href="#/catalog">${T.viewAll} →</a></div>
        <div class="cat-grid">${CATEGORIES.map(c => `<a class="cat-tile" href="#/catalog?cat=${c.id}"><img src="${catImg(c)}" alt="" loading="lazy"><span class="cat-tile-name">${c.icon} ${esc(catName(c))}</span></a>`).join('')}</div>
      </section>
      ${recent.length ? `<section class="section">
        <div class="section-head"><h2>🕘 ${T.recentlyViewed}</h2></div>
        <div class="grid grid-6">${recent.map(cardHTML).join('')}</div>
      </section>` : ''}
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
  }

  /* ---------- Каталог ---------- */
  // Поиск понимает русский, английский и текущий язык интерфейса (названия категорий/подкатегорий/тегов)
  const hayCache = new Map(); let hayLang = '';
  function searchHay(p) {
    if (hayLang !== state.lang) { hayCache.clear(); hayLang = state.lang; }
    let h = hayCache.get(p.id);
    if (h) return h;
    const cat = catById(p.category);
    const en = k => I18N.name('en', k[0], k[1]);
    h = [p.title, p.brand, p.subcategory, subName(p.subcategory), en(['subs', p.subcategory]),
      cat ? cat.name + ' ' + catName(cat) + ' ' + en(['cats', cat.id]) : '',
      p.tags.join(' '), p.tags.map(tagName).join(' '), p.tags.map(t => en(['tags', t])).join(' '), p.id].join(' ').toLowerCase();
    hayCache.set(p.id, h);
    return h;
  }
  function filterProducts(f) {
    let list = PRODUCTS;
    if (f.q) {
      const q = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(p => { const hay = searchHay(p); return q.every(w => hay.includes(w)); });
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
    if (f.rating) list = list.filter(p => p.rating >= f.rating);
    const sorters = {
      popular: (a, b) => b.reviews - a.reviews || b.rating - a.rating,
      new: (a, b) => (b.isNew - a.isNew) || b.createdAt - a.createdAt,
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
      discount: params.get('discount') === '1', isNew: params.get('new') === '1', rating: params.get('rating') ? +params.get('rating') : 0,
      sort: params.get('sort') || 'popular', page: Math.max(1, +(params.get('page') || 1))
    };
  }
  function buildQuery(f) {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q); if (f.cat) p.set('cat', f.cat); if (f.sub) p.set('sub', f.sub); if (f.tag) p.set('tag', f.tag);
    if (f.country) p.set('country', f.country); if (f.brands.length) p.set('brands', f.brands.join(','));
    if (f.min != null) p.set('min', f.min); if (f.max != null) p.set('max', f.max);
    if (f.discount) p.set('discount', '1'); if (f.isNew) p.set('new', '1'); if (f.rating) p.set('rating', f.rating);
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
    const brandCount = {};
    base.forEach(p => { brandCount[p.brand] = (brandCount[p.brand] || 0) + 1; });
    const brands = Object.keys(brandCount).sort((a, b) => brandCount[b] - brandCount[a] || a.localeCompare(b));
    const tags = [...new Set(base.flatMap(p => p.tags))].sort((a, b) => tagName(a).localeCompare(tagName(b)));
    const rate = country().rate;
    const maxPrice = base.length ? Math.ceil(Math.max(...base.map(p => p.price)) * rate) : 0;

    let title = T.catalog;
    if (f.q) title = `${T.searchResults}: «${esc(f.q)}»`;
    else if (f.sub) title = esc(subName(f.sub));
    else if (cat) title = esc(catName(cat));
    else if (f.tag) title = `#${esc(tagName(f.tag))}`;
    else if (f.discount) title = T.sortDiscount;
    document.title = `${title.replace(/<[^>]+>/g, '')} — GIGASAIT Market`;

    const chips = [];
    if (f.q) chips.push({ l: `🔎 ${f.q}`, k: 'q' });
    if (f.sub) chips.push({ l: subName(f.sub), k: 'sub' });
    if (f.tag) chips.push({ l: '#' + tagName(f.tag), k: 'tag' });
    if (f.country) chips.push({ l: countryOf(f.country).flag + ' ' + countryName(countryOf(f.country)), k: 'country' });
    f.brands.forEach(b => chips.push({ l: b, k: 'brand:' + b }));
    if (f.min != null || f.max != null) chips.push({ l: `${T.price}: ${f.min ?? 0}–${f.max ?? '∞'} ${country().symbol}`, k: 'price' });
    if (f.discount) chips.push({ l: T.onlyDiscount, k: 'discount' });
    if (f.isNew) chips.push({ l: T.onlyNew, k: 'new' });
    if (f.rating) chips.push({ l: `★ ${f.rating}+`, k: 'rating' });

    app.innerHTML = `
      <div class="breadcrumbs"><a href="#/">${T.home}</a><span><a href="#/catalog">${T.catalog}</a></span>${cat ? `<span><a href="#/catalog?cat=${cat.id}">${esc(catName(cat))}</a></span>` : ''}${f.sub ? `<span>${esc(subName(f.sub))}</span>` : ''}</div>
      <div class="catalog">
        <aside class="filters" id="filters">
          <div class="filters-head"><b>${T.filters}</b><button class="btn btn-ghost btn-sm filters-close" id="filtersClose" aria-label="${esc(T.close)}">✕</button></div>
          <div>
            <h3>${T.categoriesTitle}</h3>
            <select class="select" id="fCat" style="width:100%">
              <option value="">${T.allCategories}</option>
              ${CATEGORIES.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${c.icon} ${esc(catName(c))}</option>`).join('')}
            </select>
            ${cat ? `<div class="f-tags" style="margin-top:10px">${cat.subs.map(s => `<a class="tag ${f.sub === s ? 'active' : ''}" href="${buildQuery({ ...f, sub: f.sub === s ? '' : s, page: 1 })}">${esc(subName(s))}</a>`).join('')}</div>` : ''}
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
            ${brands.length > 10 ? `<input class="f-search" id="fBrandSearch" placeholder="${esc(T.search)}…">` : ''}
            <div class="f-scroll" id="fBrands">
              ${brands.map(b => `<label class="f-check" data-name="${esc(b.toLowerCase())}"><input type="checkbox" data-brand="${esc(b)}" ${f.brands.includes(b) ? 'checked' : ''}>${esc(b)}<small>${brandCount[b]}</small></label>`).join('')}
            </div>
          </div>
          <div>
            <h3>${T.tags}</h3>
            <div class="f-tags">${tags.map(t => `<a class="tag ${f.tag === t ? 'active' : ''}" href="${buildQuery({ ...f, tag: f.tag === t ? '' : t, page: 1 })}">${esc(tagName(t))}</a>`).join('')}</div>
          </div>
          <button class="btn btn-secondary btn-block" id="fReset">${T.resetFilters}</button>
        </aside>
        <section class="catalog-main">
          <div class="catalog-top">
            <div><h1>${title}</h1><div class="count">${T.found}: ${list.length} ${productsWord(list.length)}</div></div>
            <div class="catalog-controls">
              <button class="btn btn-secondary filters-toggle" id="filtersToggle">⚙ ${T.filters}${chips.length ? ` (${chips.length})` : ''}</button>
              <select class="select" id="sort" aria-label="${esc(T.sort)}">
                ${[['popular', T.sortPopular], ['new', T.sortNew], ['priceAsc', T.sortPriceAsc], ['priceDesc', T.sortPriceDesc], ['rating', T.sortRating], ['discount', T.sortDiscount]].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
          </div>
          ${chips.length ? `<div class="active-filters">${chips.map(c => `<span class="chip">${esc(c.l)}<button data-chip="${esc(c.k)}" aria-label="${esc(T.remove)}">×</button></span>`).join('')}<button class="btn btn-ghost btn-sm" id="fReset2">${T.resetFilters}</button></div>` : ''}
          ${shown.length ? `<div class="grid" id="grid">${shown.map(cardHTML).join('')}</div>` : `
            <div class="empty"><div class="ic">🔍</div><h2>${T.noResults}</h2><p>${T.noResultsHint}</p><a class="btn btn-primary" href="#/catalog">${T.resetFilters}</a></div>`}
          ${shown.length < list.length ? `<div class="load-more"><button class="btn btn-secondary btn-lg" id="loadMore">${T.showMore} (${list.length - shown.length})</button></div>` : ''}
        </section>
      </div>`;

    $('#fCat').onchange = e => goFilters({ ...f, cat: e.target.value, sub: '', brands: [] });
    $('#fCountry').onchange = e => goFilters({ ...f, country: e.target.value });
    $('#sort').onchange = e => goFilters({ ...f, sort: e.target.value }, false);
    $('#fDiscount').onchange = e => goFilters({ ...f, discount: e.target.checked });
    $('#fNew').onchange = e => goFilters({ ...f, isNew: e.target.checked });
    $$('[data-rating]').forEach(b => b.onclick = () => goFilters({ ...f, rating: +b.dataset.rating }));
    $$('[data-brand]').forEach(cb => cb.onchange = () => goFilters({ ...f, brands: $$('[data-brand]:checked').map(x => x.dataset.brand) }));
    const bs = $('#fBrandSearch');
    if (bs) bs.oninput = () => { const q = bs.value.trim().toLowerCase(); $$('#fBrands label').forEach(l => l.hidden = q && !l.dataset.name.includes(q)); };
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
      shown.push(...next);
      const rest = list.length - shown.length;
      if (rest <= 0) lm.parentElement.remove(); else lm.textContent = `${T.showMore} (${rest})`;
    };
    const filters = $('#filters');
    const openF = () => { filters.classList.add('open'); $('#overlay').classList.add('show'); document.body.classList.add('no-scroll'); };
    const closeF = () => { filters.classList.remove('open'); $('#overlay').classList.remove('show'); document.body.classList.remove('no-scroll'); };
    $('#filtersToggle').onclick = openF; $('#filtersClose').onclick = closeF;
    $('#overlay').onclick = closeF;
  }

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
    const recent = state.recent.filter(x => x !== p.id).map(x => BY_ID.get(x)).filter(Boolean).slice(0, 6);
    const qty = state.cart[p.id] || 0;
    document.title = `${p.title} — GIGASAIT Market`;
    app.innerHTML = `
      <div class="breadcrumbs"><a href="#/">${T.home}</a><span><a href="#/catalog">${T.catalog}</a></span>${cat ? `<span><a href="#/catalog?cat=${cat.id}">${esc(catName(cat))}</a></span>` : ''}<span><a href="#/catalog?cat=${p.category}&sub=${encodeURIComponent(p.subcategory)}">${esc(subName(p.subcategory))}</a></span></div>
      <div class="product">
        <div class="gallery">
          <div class="gallery-main" id="galMainWrap" title="${esc(T.zoom)}"><img id="galMain" src="${p.images[0]}" alt="${esc(p.title)}">
            <div class="card-labels">${p.oldPrice ? `<span class="label label-discount">-${pct(p)}%</span>` : ''}${p.isNew ? `<span class="label label-new">${T.new}</span>` : ''}</div>
            <span class="zoom-hint">🔍</span>
          </div>
          ${p.images.length > 1 ? `<div class="gallery-thumbs">${p.images.map((src, i) => `<img src="${src}" class="${i === 0 ? 'active' : ''}" data-i="${i}" alt="" loading="lazy">`).join('')}</div>` : ''}
        </div>
        <div class="p-info">
          <h1>${esc(p.title)}</h1>
          <div class="p-meta">
            <span><span class="star">${stars(p.rating)}</span> ${p.rating}</span>
            <span>${p.reviews} ${reviewsWord(p.reviews)}</span>
            <a class="brand" href="#/catalog?brands=${encodeURIComponent(p.brand)}">${esc(p.brand)}</a>
            <span title="${esc(T.shipFrom)}">${c.flag} ${esc(countryName(c))}</span>
            <span class="muted">${T.sku}: ${p.id}</span>
          </div>
          <div class="card-tags" style="margin-bottom:22px">${p.tags.map(t => `<a class="tag" href="#/catalog?tag=${encodeURIComponent(t)}">#${esc(tagName(t))}</a>`).join('')}</div>
          ${p.colors.length ? `<div class="p-block"><h3>${T.colors}</h3><div class="card-tags">${p.colors.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div></div>` : ''}
          <div class="p-block"><h3>${T.description}</h3><p style="white-space:pre-line">${esc(p.description || '—')}</p></div>
          ${Object.keys(p.specs).length ? `<div class="p-block"><h3>${T.specs}</h3><div class="specs">${Object.entries(p.specs).map(([k, v]) => `<div class="spec"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div></div>` : ''}
          ${p.source && p.source.url && p.source.site !== 'featured' ? `<div class="p-block"><h3>${T.source}</h3><p>${p.supplier ? esc(p.supplier) + ' · ' : ''}<a href="${esc(p.source.url)}" target="_blank" rel="noopener" class="link">${SOURCE_NAMES[p.source.site] || esc(p.source.site)} ↗</a></p></div>` : ''}
          <div class="p-block"><h3>${T.customerReviews}</h3>
            ${p.reviewsList.length ? '' : `<p>${T.noReviews}</p>`}
            ${p.reviewsList.map(r => `<div class="review"><div class="review-head"><b>${esc(r.name)}</b><span class="star">${stars(r.rating)}</span><small>${fmtDate(r.date)}</small></div><p>${esc(r.text)}</p></div>`).join('')}
          </div>
        </div>
        <aside class="buy-box">
          <div class="buy-price"><b>${money(p.price)}</b>${p.oldPrice ? `<s>${money(p.oldPrice)}</s><span class="pct">-${pct(p)}%</span>` : ''}</div>
          <div class="${p.stock < 10 ? 'stock-low' : 'stock-ok'}">${p.stock < 10 ? `${T.left} ${p.stock} ${T.pcs}` : T.inStock}</div>
          <div class="buy-row">
            <div class="qty" id="qtyBox" ${qty ? '' : 'hidden'}><button data-q="-1" aria-label="−">−</button><span id="qtyVal">${qty}</span><button data-q="1" aria-label="+">+</button></div>
            <button class="btn btn-primary btn-lg ${qty ? 'in-cart' : ''}" id="addBtn">${qty ? '✓ ' + T.inCart : T.addToCart}</button>
          </div>
          <div class="buy-row">
            <button class="btn btn-secondary" id="buyNow">⚡ ${T.buyNow}</button>
            <button class="btn btn-secondary icon-only ${isFav(p.id) ? 'active' : ''}" id="favBtn" title="${esc(T.favorites)}">${isFav(p.id) ? '♥' : '♡'}</button>
            <button class="btn btn-secondary icon-only ${inCompare(p.id) ? 'active' : ''}" id="cmpBtn" title="${esc(T.compare)}">⚖</button>
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
    $('#addBtn').onclick = () => { if (state.cart[p.id]) location.hash = '#/cart'; else { addToCart(p.id); syncQty(); } };
    $$('.buy-box [data-q]').forEach(b => b.onclick = () => { setQty(p.id, (state.cart[p.id] || 0) + +b.dataset.q); syncQty(); });
    $('#buyNow').onclick = () => { if (!state.cart[p.id]) { state.cart[p.id] = 1; saveCart(); } location.hash = '#/checkout'; };
    $('#favBtn').onclick = () => { toggleFav(p.id); $('#favBtn').textContent = isFav(p.id) ? '♥' : '♡'; $('#favBtn').classList.toggle('active', isFav(p.id)); };
    $('#cmpBtn').onclick = () => { toggleCompare(p.id); $('#cmpBtn').classList.toggle('active', inCompare(p.id)); };
    $('#shareBtn').onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast(T.copied, '🔗'); } catch { prompt('URL', location.href); } };
  }

  /* ---------- Лайтбокс ---------- */
  function openLightbox(images, i = 0) {
    closeLightbox();
    const lb = document.createElement('div');
    lb.className = 'lightbox'; lb.id = 'lightbox';
    let cur = i;
    lb.innerHTML = `<button class="lb-close" aria-label="${esc(T.close)}">✕</button>
      ${images.length > 1 ? `<button class="lb-prev" aria-label="‹">‹</button><button class="lb-next" aria-label="›">›</button>` : ''}
      <img src="${images[cur]}" alt=""><div class="lb-count">${cur + 1} / ${images.length}</div>`;
    document.body.appendChild(lb); document.body.classList.add('no-scroll');
    const show = n => { cur = (n + images.length) % images.length; $('img', lb).src = images[cur]; $('.lb-count', lb).textContent = `${cur + 1} / ${images.length}`; };
    lb.onclick = e => { if (e.target === lb || e.target.classList.contains('lb-close')) closeLightbox(); };
    if (images.length > 1) { $('.lb-prev', lb).onclick = () => show(cur - 1); $('.lb-next', lb).onclick = () => show(cur + 1); }
    lb._key = e => { if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1); };
    document.addEventListener('keydown', lb._key);
  }
  function closeLightbox() {
    const lb = $('#lightbox'); if (!lb) return;
    document.removeEventListener('keydown', lb._key); lb.remove(); document.body.classList.remove('no-scroll');
  }

  /* ---------- Корзина ---------- */
  function calcTotals(delivery = 'courier') {
    const sub = cartSubtotal();
    const old = cartOldTotal();
    let promoDisc = 0, freeShip = false;
    const promo = state.promo && PROMOS[state.promo];
    if (promo) { if (promo.pct) promoDisc = Math.round(sub * promo.pct / 100); if (promo.freeShip) freeShip = true; }
    const shipping = (delivery === 'pickup' || freeShip || sub >= FREE_SHIP_FROM || sub === 0) ? 0 : SHIP_COST;
    return { sub, old, promoDisc, shipping, total: sub - promoDisc + shipping, saved: old - sub };
  }
  function summaryHTML(t, withBtn = true) {
    const left = FREE_SHIP_FROM - t.sub;
    return `
      <h3>${T.total}</h3>
      <div class="sum-row"><span>${T.subtotal} (${cartCount()})</span><span>${money(t.old)}</span></div>
      ${t.saved ? `<div class="sum-row"><span>${T.discount}</span><span class="green">−${money(t.saved)}</span></div>` : ''}
      ${t.promoDisc ? `<div class="sum-row"><span>${T.promoCode} ${state.promo}</span><span class="green">−${money(t.promoDisc)}</span></div>` : ''}
      <div class="sum-row"><span>${T.delivery}</span><span class="${t.shipping ? '' : 'green'}">${t.shipping ? money(t.shipping) : T.free}</span></div>
      <div class="sum-row total"><span>${T.total}</span><span>${money(t.total)}</span></div>
      ${withBtn ? `<div class="ship-progress"><div class="bar"><i style="width:${Math.min(100, t.sub / FREE_SHIP_FROM * 100)}%"></i></div><small>${left > 0 ? fmt(T.shipMore, { sum: money(left) }) : fmt(T.freeShipFrom, { sum: money(FREE_SHIP_FROM) }) + ' ✓'}</small></div>
      <a class="btn btn-primary btn-lg btn-block" href="#/checkout">${T.checkout} →</a>` : ''}`;
  }
  function renderCart(app) {
    document.title = `${T.cartTitle} — GIGASAIT Market`;
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
      if (b.dataset.rm) setQty(id, 0);
      if (state.cart[id]) row.outerHTML = cartItemHTML(BY_ID.get(id), state.cart[id]); else row.remove();
      refresh();
    });
    $('#clearCart').onclick = () => { if (confirm(T.clearCart + '?')) { state.cart = {}; saveCart(); renderCart(app); } };
    const applyPromo = () => {
      const code = $('#promoInput').value.trim().toUpperCase();
      if (!code) { state.promo = null; store.remove('promo'); refresh(); return; }
      if (PROMOS[code]) { state.promo = code; store.set('promo', code); toast(T.promoOk, '🎉'); } else toast(T.promoBad, '⚠️');
      refresh();
    };
    $('#promoBtn').onclick = applyPromo;
    $('#promoInput').onkeydown = e => { if (e.key === 'Enter') applyPromo(); };
  }
  function cartItemHTML(p, qty) {
    return `<div class="cart-item" data-id="${p.id}">
      <a href="#/product/${p.id}"><img src="${p.images[0]}" alt="" loading="lazy"></a>
      <div>
        <a class="ci-title" href="#/product/${p.id}">${esc(p.title)}</a>
        <div class="ci-sub">${esc(p.brand)} · ${countryOf(p.country).flag} · ${money(p.price)} / ${T.pcs}</div>
        <div class="ci-actions">
          <div class="qty sm"><button data-q="-1" aria-label="−">−</button><span>${qty}</span><button data-q="1" aria-label="+">+</button></div>
          <button class="btn btn-ghost btn-sm" data-fav-cart="${p.id}" title="${esc(T.favorites)}">${isFav(p.id) ? '♥' : '♡'}</button>
          <button class="btn btn-ghost btn-sm btn-danger" data-rm="1">🗑 ${T.remove}</button>
        </div>
      </div>
      <div class="ci-right"><b>${money(p.price * qty)}</b>${p.oldPrice ? `<s>${money(p.oldPrice * qty)}</s>` : ''}</div>
    </div>`;
  }

  /* ---------- Избранное / сравнение ---------- */
  function renderFavorites(app) {
    document.title = `${T.favTitle} — GIGASAIT Market`;
    const list = state.fav.map(id => BY_ID.get(id)).filter(Boolean);
    app.innerHTML = `<h1 class="page-title">${T.favTitle} <small>${list.length}</small></h1>` +
      (list.length ? `<div class="grid">${list.map(cardHTML).join('')}</div>` :
        `<div class="empty"><div class="ic">💜</div><h2>${T.favEmpty}</h2><p>${T.favEmptyHint}</p><a class="btn btn-primary btn-lg" href="#/catalog">${T.catalog}</a></div>`);
  }
  function renderCompare(app) {
    document.title = `${T.compareTitle} — GIGASAIT Market`;
    const list = state.compare.map(id => BY_ID.get(id)).filter(Boolean);
    if (!list.length) {
      app.innerHTML = `<h1 class="page-title">${T.compareTitle}</h1><div class="empty"><div class="ic">⚖</div><h2>${T.compareEmpty}</h2><p>${T.compareEmptyHint}</p><a class="btn btn-primary btn-lg" href="#/catalog">${T.catalog}</a></div>`;
      return;
    }
    const specKeys = [...new Set(list.flatMap(p => Object.keys(p.specs)))];
    const row = (label, cells) => `<tr><th>${label}</th>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    app.innerHTML = `
      <h1 class="page-title">${T.compareTitle} <small>${list.length}/${COMPARE_MAX}</small></h1>
      <div class="compare-wrap"><table class="compare">
        <thead><tr><th></th>${list.map(p => `<td class="cmp-head">
          <button class="cmp-remove" data-cmp-rm="${p.id}" aria-label="${esc(T.remove)}">✕</button>
          <a href="#/product/${p.id}"><img src="${p.images[0]}" alt=""></a>
          <a class="cmp-title" href="#/product/${p.id}">${esc(p.title)}</a>
          <button class="btn btn-primary btn-sm ${state.cart[p.id] ? 'in-cart' : ''}" data-add="${p.id}">${state.cart[p.id] ? '✓ ' + T.inCart : T.addToCart}</button>
        </td>`).join('')}</tr></thead>
        <tbody>
          ${row(T.price, list.map(p => `<b>${money(p.price)}</b>${p.oldPrice ? ` <s class="muted">${money(p.oldPrice)}</s>` : ''}`))}
          ${row(T.rating, list.map(p => `<span class="star">★</span> ${p.rating} <small class="muted">(${p.reviews} ${reviewsWord(p.reviews)})</small>`))}
          ${row(T.brand, list.map(p => esc(p.brand)))}
          ${row(T.categoriesTitle, list.map(p => esc(subName(p.subcategory))))}
          ${row(T.country, list.map(p => `${countryOf(p.country).flag} ${esc(countryName(countryOf(p.country)))}`))}
          ${row(T.inStock, list.map(p => p.stock < 10 ? `<span class="stock-low">${T.left} ${p.stock}</span>` : `<span class="stock-ok">✓</span>`))}
          ${specKeys.map(k => row(esc(k), list.map(p => esc(p.specs[k] ?? '—')))).join('')}
        </tbody>
      </table></div>
      <div style="margin-top:16px"><button class="btn btn-ghost btn-danger" id="clearCompare">🗑 ${T.clearCompare}</button></div>`;
    $$('[data-cmp-rm]').forEach(b => b.onclick = () => { toggleCompare(+b.dataset.cmpRm); renderCompare(app); });
    $('#clearCompare').onclick = () => { state.compare = []; store.set('compare', []); renderCompareBar(); renderCompare(app); };
  }

  /* ---------- Оформление ---------- */
  function renderCheckout(app) {
    const items = cartItems();
    if (!items.length) { location.hash = '#/cart'; return; }
    document.title = `${T.checkoutTitle} — GIGASAIT Market`;
    const pr = state.profile;
    const c = country();
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
              <label class="radio-card"><input type="radio" name="delivery" value="courier"><b>🚚 ${T.courier}</b><small>${T.courierHint} · ${money(SHIP_COST)}</small></label>
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
          <div class="order-items">${items.map(({ p, qty }) => `<div class="order-item"><img src="${p.images[0]}" alt=""><span>${esc(p.title)} × ${qty}</span><b>${money(p.price * qty)}</b></div>`).join('')}</div>
          <div id="sumBox">${summaryHTML(calcTotals('pickup'), false)}</div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="placeOrder">${T.placeOrder}</button>
          <small class="muted" style="text-align:center">${T.demoNotice}</small>
        </aside>
      </form>`;

    const form = $('#checkoutForm');
    const F = form.elements;
    const cardForm = $('#cardForm');
    $$('input[name=payment]').forEach(r => r.onchange = () => cardForm.classList.toggle('show', F.payment.value === 'now'));
    $$('input[name=delivery]').forEach(r => r.onchange = () => { $('#sumBox').innerHTML = summaryHTML(calcTotals(F.delivery.value), false); });
    F.cardNumber.oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); };
    F.cardExp.oninput = e => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; };
    F.cardCvc.oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); };
    $$('input[required]', form).forEach(i => i.oninput = () => i.classList.remove('error'));

    form.onsubmit = e => {
      e.preventDefault();
      let ok = true;
      $$('input[required]', form).forEach(i => { const bad = !i.value.trim(); i.classList.toggle('error', bad); if (bad) ok = false; });
      if (!ok) { toast(T.fillRequired, '⚠️'); form.querySelector('.error').focus(); return; }
      const payNow = F.payment.value === 'now';
      if (payNow) {
        const num = F.cardNumber.value.replace(/\s/g, '');
        const okCard = num.length === 16 && /^\d{2}\/\d{2}$/.test(F.cardExp.value) && F.cardCvc.value.length === 3;
        if (!okCard) { toast(T.invalidCard, '💳'); F.cardNumber.focus(); return; }
      }
      state.profile = { ...state.profile, name: F.name.value, phone: F.phone.value, email: F.email.value, city: F.city.value, street: F.street.value, postal: F.postal.value };
      store.set('profile', state.profile);
      const btn = $('#placeOrder'); btn.disabled = true; btn.textContent = T.processing;
      setTimeout(() => {
        const totals = calcTotals(F.delivery.value);
        const order = {
          id: 'GM-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100),
          date: new Date().toISOString(),
          items: items.map(({ p, qty }) => ({ id: p.id, title: p.title, price: p.price, qty, img: p.images[0] })),
          totals, country: F.country.value, delivery: F.delivery.value, payment: payNow ? 'now' : 'later',
          status: payNow ? 'paid' : 'awaiting', address: `${F.city.value}, ${F.street.value}`, name: F.name.value, comment: F.comment.value, currency: c.code
        };
        state.orders.unshift(order); store.set('orders', state.orders);
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
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn-primary btn-lg" href="#/orders">📦 ${T.goToOrders}</a>
        <a class="btn btn-secondary btn-lg" href="#/catalog">${T.continueShopping}</a>
      </div></div>`;
  }

  /* ---------- Заказы ---------- */
  function renderOrders(app) {
    document.title = `${T.ordersTitle} — GIGASAIT Market`;
    const st = { processing: T.statusProcessing, paid: T.statusPaid, awaiting: T.statusAwaiting, shipped: T.statusShipped, delivered: T.statusDelivered, cancelled: T.statusCancelled };
    app.innerHTML = `<h1 class="page-title">${T.ordersTitle} <small>${state.orders.length}</small></h1>` +
      (state.orders.length ? state.orders.map(o => {
        const oc = countryOf(o.country);
        const cancellable = ['processing', 'paid', 'awaiting'].includes(o.status);
        return `<div class="order-card" data-order="${o.id}">
          <div class="order-head"><div><b>${o.id}</b> <small>· ${fmtDate(o.date)} ${fmtTime(o.date)}</small></div><span class="status status-${o.status}">${st[o.status] || o.status}</span></div>
          <div class="order-thumbs">${o.items.map(i => `<a href="#/product/${i.id}" title="${esc(i.title)}"><img src="${i.img}" alt="" loading="lazy"></a>`).join('')}</div>
          <div class="order-foot">
            <span>${oc.flag} ${esc(o.address)} · ${o.delivery === 'pickup' ? T.pickup : T.courier} · ${o.payment === 'now' ? T.paidNow : T.payLater}</span>
            <b>${money(o.totals.total)}</b>
          </div>
          <div class="order-actions">
            <button class="btn btn-secondary btn-sm" data-repeat="${o.id}">🔁 ${T.repeatOrder}</button>
            ${cancellable ? `<button class="btn btn-ghost btn-sm btn-danger" data-cancel="${o.id}">✕ ${T.cancelOrder}</button>` : ''}
          </div>
        </div>`;
      }).join('') : `<div class="empty"><div class="ic">📦</div><h2>${T.ordersEmpty}</h2><p>${T.ordersEmptyHint}</p><a class="btn btn-primary btn-lg" href="#/catalog">${T.catalog}</a></div>`);
    $$('[data-cancel]').forEach(b => b.onclick = () => {
      if (!confirm(T.confirmCancel)) return;
      const o = state.orders.find(x => x.id === b.dataset.cancel); if (!o) return;
      o.status = 'cancelled'; store.set('orders', state.orders); toast(T.orderCancelled, '✕'); renderOrders(app);
    });
    $$('[data-repeat]').forEach(b => b.onclick = () => {
      const o = state.orders.find(x => x.id === b.dataset.repeat); if (!o) return;
      let n = 0;
      o.items.forEach(i => { if (BY_ID.has(i.id)) { state.cart[i.id] = Math.min((state.cart[i.id] || 0) + i.qty, 99); n++; } });
      saveCart(); toast(n ? T.addedItems : T.noResults, '🛒'); if (n) location.hash = '#/cart';
    });
  }

  /* ---------- Настройки ---------- */
  function renderSettings(app) {
    document.title = `${T.settingsTitle} — GIGASAIT Market`;
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
          <div class="lang-grid">
            <button class="lang-btn ${state.langAuto ? 'active' : ''}" data-lang="auto">🌍 ${T.autoLang}<br><small style="opacity:.7">${I18N.meta(I18N.detect()).flag} ${esc(I18N.meta(I18N.detect()).name)}</small></button>
            ${I18N.LANGS.map(l => `<button class="lang-btn ${state.lang === l.code && !state.langAuto ? 'active' : ''}" data-lang="${l.code}" lang="${l.code}">${l.flag} ${esc(l.name)}</button>`).join('')}
          </div>
          <small class="muted" style="display:block;margin-top:10px">${T.langHint}</small>
        </div>
        <div class="form-card">
          <h3>📍 ${T.deliveryCountry} / ${T.currency}</h3>
          <div class="lang-grid">${COUNTRIES.map(c => `<button class="lang-btn ${state.country === c.code ? 'active' : ''}" data-country="${c.code}">${c.flag} ${esc(countryName(c))}<br><small style="opacity:.7">${c.currency} (${c.symbol})</small></button>`).join('')}</div>
          <small class="muted" style="display:block;margin-top:10px">${T.currencyHint}</small>
        </div>
        <div class="form-card">
          <h3>👤 ${T.profile} / ${T.defaultAddress}</h3>
          <form id="profileForm" class="form-grid">
            <div class="field"><label>${T.fullName}</label><input name="name" autocomplete="name" value="${esc(pr.name)}"></div>
            <div class="field"><label>${T.phone}</label><input name="phone" autocomplete="tel" value="${esc(pr.phone)}"></div>
            <div class="field full"><label>${T.email}</label><input name="email" type="email" autocomplete="email" value="${esc(pr.email)}"></div>
            <div class="field"><label>${T.city}</label><input name="city" value="${esc(pr.city)}"></div>
            <div class="field"><label>${T.postal}</label><input name="postal" value="${esc(pr.postal)}"></div>
            <div class="field full"><label>${T.street}</label><input name="street" value="${esc(pr.street)}"></div>
            <div class="full"><button class="btn btn-primary" type="submit">${T.save}</button></div>
          </form>
        </div>
        <div class="form-card">
          <h3>🔔 ${T.notifications}</h3>
          <div class="setting-row"><div><b>${T.notifPromo}</b><small>${T.notifPromoHint}</small></div><button class="switch ${pr.notifPromo ? 'on' : ''}" data-sw="notifPromo" role="switch" aria-checked="${!!pr.notifPromo}"></button></div>
          <div class="setting-row"><div><b>${T.notifOrders}</b><small>${T.notifOrdersHint}</small></div><button class="switch ${pr.notifOrders ? 'on' : ''}" data-sw="notifOrders" role="switch" aria-checked="${!!pr.notifOrders}"></button></div>
        </div>
        <div class="form-card">
          <h3>🗄 ${T.dangerZone}</h3>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-secondary" id="clearRecent">🕘 ${T.recentlyViewed}: ${T.clear}</button>
            <button class="btn btn-secondary btn-danger" id="clearAll">🗑 ${T.clearData}</button>
          </div>
        </div>
        <a class="btn btn-secondary" href="../index.html">⏏ ${T.backToHub}</a>
      </div>`;
    $$('[data-theme-pick]').forEach(b => b.onclick = () => { state.theme = b.dataset.themePick; applyTheme(); renderSettings(app); });
    $$('[data-lang]').forEach(b => b.onclick = () => { if (b.dataset.lang === 'auto') setLang(I18N.detect(), true); else setLang(b.dataset.lang, false); });
    $$('[data-country]').forEach(b => b.onclick = () => { setCountry(b.dataset.country); renderSettings(app); });
    $('#profileForm').onsubmit = e => {
      e.preventDefault(); const f = e.target.elements;
      state.profile = { ...state.profile, name: f.name.value, phone: f.phone.value, email: f.email.value, city: f.city.value, postal: f.postal.value, street: f.street.value };
      store.set('profile', state.profile); toast(T.saved);
    };
    $$('[data-sw]').forEach(b => b.onclick = () => { state.profile[b.dataset.sw] = !state.profile[b.dataset.sw]; store.set('profile', state.profile); b.classList.toggle('on'); b.setAttribute('aria-checked', b.classList.contains('on')); });
    $('#clearRecent').onclick = () => { state.recent = []; store.set('recent', []); state.searches = []; store.set('searches', []); toast(T.saved); };
    $('#clearAll').onclick = () => { if (confirm(T.confirmClear)) { Object.keys(localStorage).filter(k => k.startsWith('giga.')).forEach(k => localStorage.removeItem(k)); location.reload(); } };
  }

  /* ---------- Статические страницы и 404 ---------- */
  function pageData(id) {
    const own = I18N.raw[state.lang] && I18N.raw[state.lang].pages;
    return (own && own[id]) || (I18N.raw.en.pages[id]) || null;
  }
  const PAGE_IDS = ['delivery', 'returns', 'contacts', 'about', 'faq'];
  function renderPage(app, params, id) {
    const pg = pageData(id);
    if (!pg) return renderNotFound(app);
    document.title = `${pg.title} — GIGASAIT Market`;
    const nav = PAGE_IDS.map(k => { const d = pageData(k); return `<a class="tag ${k === id ? 'active' : ''}" href="#/page/${k}">${d.icon} ${esc(d.title)}</a>`; }).join('');
    app.innerHTML = `
      <div class="breadcrumbs"><a href="#/">${T.home}</a><span>${esc(pg.title)}</span></div>
      <div class="static-page">
        <h1 class="page-title">${pg.icon} ${esc(pg.title)}</h1>
        <div class="card-tags page-nav">${nav}</div>
        ${pg.sections ? `<div class="info-grid">${pg.sections.map(([h, t]) => `<div class="form-card"><h3>${esc(h)}</h3><p>${esc(t)}</p></div>`).join('')}</div>` : ''}
        ${pg.items ? `<div class="faq">${pg.items.map(([q, a]) => `<details class="form-card"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>` : ''}
        ${id === 'contacts' ? `<div class="form-card contact-form"><h3>✉️ ${T.comment}</h3><form id="contactForm" class="form-grid"><div class="field"><label>${T.shortName}</label><input name="n" required></div><div class="field"><label>${T.email}</label><input name="e" type="email" required></div><div class="field full"><label>${T.comment}</label><textarea name="m" required></textarea></div><div class="full"><button class="btn btn-primary">${T.apply}</button></div></form></div>` : ''}
        <p class="muted" style="margin-top:20px">${T.demoNotice}</p>
      </div>`;
    const cf = $('#contactForm');
    if (cf) cf.onsubmit = e => { e.preventDefault(); toast(T.saved, '✉️'); cf.reset(); };
  }
  function renderNotFound(app) {
    document.title = `404 — GIGASAIT Market`;
    app.innerHTML = `<div class="empty"><div class="ic">🧭</div><h2>404 · ${T.notFound}</h2><p>${T.notFoundHint}</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn-primary" href="#/">${T.backHome}</a><a class="btn btn-secondary" href="#/catalog">${T.catalog}</a></div></div>`;
  }

  /* ---------- Страна / язык в шапке ---------- */
  function setCountry(code) { state.country = code; store.set('country', code); renderCountryUI(); navigate(); }
  function renderCountryUI() {
    const c = country();
    $('#countryFlag').textContent = c.flag; $('#countryName').textContent = countryName(c);
    $('#countryList').innerHTML = COUNTRIES.map(x => `<button class="${x.code === c.code ? 'active' : ''}" data-cc="${x.code}"><span class="flag">${x.flag}</span>${esc(countryName(x))}<small>${x.currency}</small></button>`).join('');
    $$('#countryList button').forEach(b => b.onclick = () => { setCountry(b.dataset.cc); closePopovers(); });
  }
  function renderLangUI() {
    const m = I18N.meta(state.lang);
    $('#langFlag').textContent = m.flag; $('#langCode').textContent = state.lang.toUpperCase();
    $('#langList').innerHTML = I18N.LANGS.map(l => `<button class="${l.code === state.lang ? 'active' : ''}" data-lc="${l.code}" lang="${l.code}"><span class="flag">${l.flag}</span>${esc(l.name)}<small>${l.code}</small></button>`).join('');
    $$('#langList button').forEach(b => b.onclick = () => { setLang(b.dataset.lc, false); closePopovers(); });
  }
  function closePopovers() { $$('.popover').forEach(p => p.classList.remove('show')); }
  function togglePopover(pop, btn) {
    const open = pop.classList.contains('show');
    closePopovers();
    if (open) return;
    const r = btn.getBoundingClientRect();
    pop.style.top = r.bottom + 8 + 'px';
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - 260)) + 'px';
    pop.classList.add('show');
  }

  /* ---------- Шапка: категории и каталог ---------- */
  function renderHeaderCats() {
    $('#headerCats').innerHTML = `<a href="#/catalog?discount=1&sort=discount">🔥 ${T.sortDiscount}</a>` + CATEGORIES.map(c => `<a href="#/catalog?cat=${c.id}" data-cat="${c.id}">${c.icon} ${esc(catName(c))}</a>`).join('');
    $('#catalogDropList').innerHTML = CATEGORIES.map((c, i) => `<button data-ci="${i}" class="${i === 0 ? 'active' : ''}"><img class="ic-img" src="${catImg(c)}" alt="" loading="lazy">${esc(catName(c))}</button>`).join('');
    $$('#catalogDropList button').forEach(b => { b.onmouseenter = b.onclick = () => showCatSubs(+b.dataset.ci); });
    showCatSubs(0);
  }
  function showCatSubs(i) {
    const c = CATEGORIES[i];
    $$('#catalogDropList button').forEach((b, j) => b.classList.toggle('active', i === j));
    const count = PRODUCTS.filter(p => p.category === c.id).length;
    $('#catalogDropSubs').innerHTML = `<a class="cat-banner" href="#/catalog?cat=${c.id}" style="background-image:url('${catImg(c)}')"><span>${c.icon} ${esc(catName(c))}</span></a>
      <h3>${esc(catName(c))} <small class="muted">${count} ${productsWord(count)}</small> <a class="btn btn-secondary btn-sm" href="#/catalog?cat=${c.id}">${T.seeAllProducts}</a></h3>
      <div class="subs-grid">${c.subs.map(s => `<a href="#/catalog?cat=${c.id}&sub=${encodeURIComponent(s)}">${esc(subName(s))}</a>`).join('')}</div>
      <div class="tags-row">${c.tags.map(t => `<a class="tag" href="#/catalog?cat=${c.id}&tag=${encodeURIComponent(t)}">#${esc(tagName(t))}</a>`).join('')}</div>`;
  }
  function openCatalog() { $('#catalogDrop').classList.add('open'); $('#catalogBtn').classList.add('active'); document.body.classList.add('no-scroll'); }
  function closeCatalog() { $('#catalogDrop').classList.remove('open'); $('#catalogBtn').classList.remove('active'); document.body.classList.remove('no-scroll'); }
  function toggleCatalog() { $('#catalogDrop').classList.contains('open') ? closeCatalog() : openCatalog(); }

  /* ---------- Поиск с подсказками ---------- */
  const POPULAR_QUERIES = ['Смартфоны', 'Наушники', 'Кроссовки', 'Кофемашины', 'Пылесосы', 'Игрушки'];
  function setupSearch() {
    const input = $('#searchInput'), sug = $('#searchSuggest');
    let timer;
    const showHistory = () => {
      const rec = state.searches;
      sug.innerHTML = (rec.length ? `<div class="suggest-head">${T.recentSearches} <button class="link-btn" id="clearSearches">${T.clear}</button></div>` +
        rec.map(q => `<a class="suggest-item" href="#/catalog?q=${encodeURIComponent(q)}"><span class="sg-ic">🕘</span><div>${esc(q)}</div></a>`).join('') : '') +
        `<div class="suggest-head">${T.popularQueries}</div><div class="suggest-chips">${POPULAR_QUERIES.map(s => `<a class="tag" href="#/catalog?q=${encodeURIComponent(subName(s))}">${esc(subName(s))}</a>`).join('')}</div>`;
      sug.classList.add('show');
      const cb = $('#clearSearches'); if (cb) cb.onclick = e => { e.preventDefault(); e.stopPropagation(); state.searches = []; store.set('searches', []); showHistory(); };
    };
    const showSuggest = () => {
      const q = input.value.trim();
      if (q.length < 2) { showHistory(); return; }
      const list = filterProducts({ ...readFilters(new URLSearchParams()), q }).slice(0, 6);
      const ql = q.toLowerCase();
      const cats = CATEGORIES.filter(c => catName(c).toLowerCase().includes(ql) || c.name.toLowerCase().includes(ql) || c.subs.some(s => s.toLowerCase().includes(ql) || subName(s).toLowerCase().includes(ql))).slice(0, 3);
      if (!list.length && !cats.length) { sug.innerHTML = `<div class="suggest-head">${T.noResults}</div>`; sug.classList.add('show'); return; }
      sug.innerHTML = (cats.length ? `<div class="suggest-head">${T.categoriesTitle}</div>` + cats.map(c => `<a class="suggest-item" href="#/catalog?cat=${c.id}"><img src="${catImg(c)}" alt=""><div>${esc(catName(c))}<small>${c.subs.slice(0, 3).map(subName).join(', ')}</small></div></a>`).join('') : '') +
        (list.length ? `<div class="suggest-head">${T.products}</div>` + list.map(p => `<a class="suggest-item" href="#/product/${p.id}"><img src="${p.images[0]}" alt=""><div>${esc(p.title)}<small>${esc(p.brand)} · ${esc(subName(p.subcategory))}</small></div><span class="price">${money(p.price)}</span></a>`).join('') : '') +
        `<a class="suggest-all" href="#/catalog?q=${encodeURIComponent(q)}">${T.searchResults}: «${esc(q)}» →</a>`;
      sug.classList.add('show');
    };
    input.oninput = () => { clearTimeout(timer); timer = setTimeout(showSuggest, 120); };
    input.onfocus = () => { if (!input.value.trim()) showHistory(); else showSuggest(); };
    $('#searchForm').onsubmit = e => {
      e.preventDefault(); sug.classList.remove('show');
      const q = input.value.trim();
      pushSearch(q);
      const { params } = parseHash();
      const f = readFilters(params); f.q = q; f.page = 1;
      location.hash = buildQuery(f);
      input.blur();
    };
    document.addEventListener('click', e => { if (!e.target.closest('.search')) sug.classList.remove('show'); });
    sug.addEventListener('click', e => { if (e.target.closest('a')) { const a = e.target.closest('a'); const m = /[?&]q=([^&]+)/.exec(a.getAttribute('href') || ''); if (m) pushSearch(decodeURIComponent(m[1])); sug.classList.remove('show'); } });
  }

  /* ---------- Глобальные делегированные клики ---------- */
  document.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault(); const id = +fav.dataset.fav; toggleFav(id);
      fav.classList.toggle('active', isFav(id)); fav.querySelector('.heart').textContent = isFav(id) ? '♥' : '♡';
      if (location.hash.startsWith('#/favorites') && !isFav(id)) { fav.closest('.card').remove(); const s = $('.page-title small'); if (s) s.textContent = state.fav.length; }
      return;
    }
    const cmp = e.target.closest('[data-cmp]');
    if (cmp) { e.preventDefault(); const id = +cmp.dataset.cmp; toggleCompare(id); cmp.classList.toggle('active', inCompare(id)); return; }
    const add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault(); const id = +add.dataset.add;
      if (state.cart[id]) { location.hash = '#/cart'; return; }
      addToCart(id); add.classList.add('in-cart'); add.textContent = '✓ ' + T.inCart; return;
    }
    const favCart = e.target.closest('[data-fav-cart]');
    if (favCart) { const id = +favCart.dataset.favCart; toggleFav(id); favCart.textContent = isFav(id) ? '♥' : '♡'; return; }
  });
  // Битые картинки → заглушка
  document.addEventListener('error', e => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && !img.dataset.fb) { img.dataset.fb = '1'; img.src = placeholderImage('', '🛍️', ['#7c5cff', '#ff5c8a'], img.src.length); }
  }, true);

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
    $('#countryBtn').onclick = e => { e.stopPropagation(); togglePopover($('#countryPop'), e.currentTarget); };
    $('#langBtn').onclick = e => { e.stopPropagation(); togglePopover($('#langPop'), e.currentTarget); };
    document.addEventListener('click', e => { if (!e.target.closest('.popover') && !e.target.closest('#countryBtn') && !e.target.closest('#langBtn')) closePopovers(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeCatalog(); closePopovers(); closeLightbox(); $('#searchSuggest').classList.remove('show'); }
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#searchInput').focus(); }
    });
    $('#year').textContent = new Date().getFullYear();
    // кнопка «наверх»
    const top = document.createElement('button');
    top.className = 'to-top'; top.id = 'toTop'; top.innerHTML = '↑'; top.title = T.toTop; top.setAttribute('aria-label', T.toTop);
    top.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(top);
    window.addEventListener('scroll', () => top.classList.toggle('show', scrollY > 600), { passive: true });
    window.addEventListener('hashchange', navigate);
    navigate();
    window.addEventListener('storage', () => { state.cart = store.get('cart', {}); state.fav = store.get('fav', []); updateBadges(); });
    if (firstVisitLang && state.lang !== 'ru') setTimeout(() => toast(fmt(T.langDetected, { lang: I18N.meta(state.lang).name }), '🌐'), 600);
  }
  init();

  window.GIGA = { state, PRODUCTS, CATEGORIES, COUNTRIES, I18N };
})();
