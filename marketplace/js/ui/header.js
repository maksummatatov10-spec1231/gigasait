/* ===== GIGASAIT MARKET — Шапка: страна, язык, поповеры, категории, каталог =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, CATEGORIES, COUNTRIES, I18N, PRODUCTS, catImg, catName, country, countryName, esc, productsWord, setLang, state, store, subName, tagName } = A;
  // функции из модулей, которые загружаются позже — связываются лениво
  const navigate = (...args) => A.navigate(...args);

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
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - 270)) + 'px';
    pop.classList.add('show');
  }

  /* ---------- Шапка: категории и каталог ---------- */
  function renderHeaderCats() {
    $('#headerCats').innerHTML = `<a href="#/catalog?discount=1&sort=discount">🔥 ${T.sortDiscount}</a>` + CATEGORIES.map(c => `<a href="#/catalog?cat=${c.id}" data-cat="${c.id}">${c.icon} ${esc(catName(c))}</a>`).join('');
    $('#catalogDropList').innerHTML = CATEGORIES.map((c, i) => `<button data-ci="${i}" class="${i === 0 ? 'active' : ''}" style="--i:${i}"><img class="ic-img" src="${catImg(c)}" alt="" loading="lazy">${esc(catName(c))}</button>`).join('');
    $$('#catalogDropList button').forEach(b => { b.onmouseenter = b.onclick = () => showCatSubs(+b.dataset.ci); });
    showCatSubs(0);
  }
  function showCatSubs(i) {
    const c = CATEGORIES[i];
    $$('#catalogDropList button').forEach((b, j) => b.classList.toggle('active', i === j));
    const count = PRODUCTS.filter(p => p.category === c.id).length;
    const subs = $('#catalogDropSubs'); subs.classList.remove('swap'); void subs.offsetWidth; subs.classList.add('swap');
    subs.innerHTML = `<a class="cat-banner" href="#/catalog?cat=${c.id}" style="background-image:url('${catImg(c)}')"><span>${c.icon} ${esc(catName(c))}</span></a>
      <h3>${esc(catName(c))} <small class="muted">${count} ${productsWord(count)}</small> <a class="btn btn-secondary btn-sm" href="#/catalog?cat=${c.id}">${T.seeAllProducts}</a></h3>
      <div class="subs-grid">${c.subs.map(s => `<a href="#/catalog?cat=${c.id}&sub=${encodeURIComponent(s)}">${esc(subName(s))}</a>`).join('')}</div>
      <div class="tags-row">${c.tags.map(t => `<a class="tag" href="#/catalog?cat=${c.id}&tag=${encodeURIComponent(t)}">#${esc(tagName(t))}</a>`).join('')}</div>`;
  }
  function openCatalog() { $('#catalogDrop').classList.add('open'); $('#catalogBtn').classList.add('active'); document.body.classList.add('no-scroll'); }
  function closeCatalog() { $('#catalogDrop').classList.remove('open'); $('#catalogBtn').classList.remove('active'); document.body.classList.remove('no-scroll'); }
  function toggleCatalog() { $('#catalogDrop').classList.contains('open') ? closeCatalog() : openCatalog(); }

  Object.assign(A, { setCountry, renderCountryUI, renderLangUI, closePopovers, togglePopover, renderHeaderCats, showCatSubs, openCatalog, closeCatalog, toggleCatalog });
})();
