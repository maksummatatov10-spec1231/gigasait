/* ===== GIGASAIT MARKET — Каталог: поиск, фильтры, сортировка, список =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, CATEGORIES, COUNTRIES, I18N, PRODUCTS, cardHTML, catById, catImg, catName, country, countryName, countryOf, esc, pct, productsWord, state, store, subName, tagName, translateIn } = A;

  /* ---------- Каталог ---------- */
  const hayCache = new Map(); let hayLang = '';
  function searchHay(p) {
    if (hayLang !== state.lang) { hayCache.clear(); hayLang = state.lang; }
    let h = hayCache.get(p.id);
    if (h) return h;
    const cat = catById(p.category);
    const en = (k, v) => I18N.name('en', k, v);
    h = [p.title, p.brand, p.subcategory, subName(p.subcategory), en('subs', p.subcategory),
      cat ? cat.name + ' ' + catName(cat) + ' ' + en('cats', cat.id) : '',
      p.tags.join(' '), p.tags.map(tagName).join(' '), p.tags.map(t => en('tags', t)).join(' '), p.id].join(' ').toLowerCase();
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
    // на телефоне страницы короче: меньше DOM — быстрее прокрутка (дальше подгружается автоматически)
    const pageSize = document.documentElement.classList.contains('is-mobile') && !document.documentElement.classList.contains('is-tablet') ? Math.min(state.pageSize, 12) : state.pageSize;
    const shown = list.slice(0, f.page * pageSize);
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
      ${cat && !f.q ? `<a class="cat-banner cat-banner-top" href="#/catalog?cat=${cat.id}" style="background-image:url('${catImg(cat)}')"><span>${cat.icon} ${esc(catName(cat))}</span></a>` : ''}
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
              <div class="view-toggle" role="group">
                <button class="${state.view === 'grid' ? 'active' : ''}" data-view="grid" title="${esc(T.viewGrid)}" aria-label="${esc(T.viewGrid)}">▦</button>
                <button class="${state.view === 'list' ? 'active' : ''}" data-view="list" title="${esc(T.viewList)}" aria-label="${esc(T.viewList)}">☰</button>
              </div>
              <select class="select" id="perPage" aria-label="${esc(T.perPage)}">${[24, 48, 96].map(n => `<option value="${n}" ${state.pageSize === n ? 'selected' : ''}>${n} / ${T.perPage.toLowerCase()}</option>`).join('')}</select>
              <select class="select" id="sort" aria-label="${esc(T.sort)}">
                ${[['popular', T.sortPopular], ['new', T.sortNew], ['priceAsc', T.sortPriceAsc], ['priceDesc', T.sortPriceDesc], ['rating', T.sortRating], ['discount', T.sortDiscount]].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
          </div>
          ${chips.length ? `<div class="active-filters">${chips.map(c => `<span class="chip">${esc(c.l)}<button data-chip="${esc(c.k)}" aria-label="${esc(T.remove)}">×</button></span>`).join('')}<button class="btn btn-ghost btn-sm" id="fReset2">${T.resetFilters}</button></div>` : ''}
          ${shown.length ? `<div class="grid ${state.view === 'list' ? 'list' : ''}" id="grid">${shown.map(cardHTML).join('')}</div>` : `
            <div class="empty"><div class="ic">🔍</div><h2>${T.noResults}</h2><p>${T.noResultsHint}</p><a class="btn btn-primary" href="#/catalog">${T.resetFilters}</a></div>`}
          ${shown.length < list.length ? `<div class="load-more"><button class="btn btn-secondary btn-lg" id="loadMore">${T.showMore} (${list.length - shown.length})</button><div class="count" style="margin-top:8px">${shown.length} ${T.ofTotal} ${list.length}</div></div>` : ''}
        </section>
      </div>`;

    $('#fCat').onchange = e => goFilters({ ...f, cat: e.target.value, sub: '', brands: [] });
    $('#fCountry').onchange = e => goFilters({ ...f, country: e.target.value });
    $('#sort').onchange = e => goFilters({ ...f, sort: e.target.value }, false);
    $('#perPage').onchange = e => { state.pageSize = +e.target.value; store.set('pageSize', state.pageSize); goFilters({ ...f }); };
    $$('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; store.set('view', state.view); $('#grid') && $('#grid').classList.toggle('list', state.view === 'list'); $$('[data-view]').forEach(x => x.classList.toggle('active', x === b)); });
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
    if (lm) {
      const more = () => {
        const next = list.slice(shown.length, shown.length + pageSize);
        if (!next.length) return;
        const frag = document.createElement('template'); frag.innerHTML = next.map((p, i) => cardHTML(p, i)).join('');
        $('#grid').appendChild(frag.content); // у новых карточек — свой каскад появления (animation-delay в cardHTML)
        f.page++; history.replaceState(null, '', buildQuery(f));
        shown.push(...next);
        translateIn($('#grid'));
        const rest = list.length - shown.length;
        if (rest <= 0) lm.parentElement.remove(); else { lm.textContent = `${T.showMore} (${rest})`; lm.nextElementSibling.textContent = `${shown.length} ${T.ofTotal} ${list.length}`; }
      };
      lm.onclick = more;
      if (state.prefs.infinite && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(en => { if (en[0].isIntersecting && document.contains(lm)) more(); else if (!document.contains(lm)) io.disconnect(); }, { rootMargin: '600px' });
        io.observe(lm);
      }
    }
    const filters = $('#filters');
    const openF = () => { filters.classList.add('open'); $('#overlay').classList.add('show'); document.body.classList.add('no-scroll'); };
    const closeF = () => { filters.classList.remove('open'); $('#overlay').classList.remove('show'); document.body.classList.remove('no-scroll'); };
    $('#filtersToggle').onclick = openF; $('#filtersClose').onclick = closeF;
    $('#overlay').onclick = closeF;
  }

  Object.assign(A, { hayCache, searchHay, filterProducts, readFilters, buildQuery, goFilters, renderCatalog });
})();
