/* ===== GIGASAIT MARKET — Поиск с подсказками =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, CATEGORIES, buildQuery, catImg, catName, esc, filterProducts, money, pushSearch, readFilters, state, store, subName, translateIn } = A;
  // функции из модулей, которые загружаются позже — связываются лениво
  const parseHash = (...args) => A.parseHash(...args);

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
        (list.length ? `<div class="suggest-head">${T.products}</div>` + list.map(p => `<a class="suggest-item" href="#/product/${p.id}"><img src="${p.thumb}" alt=""><div><span data-tr="${esc(p.title)}">${esc(p.title)}</span><small>${esc(p.brand)} · ${esc(subName(p.subcategory))}</small></div><span class="price">${money(p.price)}</span></a>`).join('') : '') +
        `<a class="suggest-all" href="#/catalog?q=${encodeURIComponent(q)}">${T.searchResults}: «${esc(q)}» →</a>`;
      sug.classList.add('show');
      translateIn(sug);
    };
    input.oninput = () => { clearTimeout(timer); timer = setTimeout(showSuggest, 150); };
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

  Object.assign(A, { POPULAR_QUERIES, setupSearch });
})();
