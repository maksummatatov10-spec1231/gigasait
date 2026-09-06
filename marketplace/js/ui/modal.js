/* ===== GIGASAIT MARKET — Модальное окно, быстрый просмотр, горячие клавиши =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, BY_ID, countryName, countryOf, esc, inCompare, isFav, money, pct, reviewCount, reviewsWord, state, tagName, translateIn } = A;

  /* ---------- Модальное окно (быстрый просмотр, подсказки) ---------- */
  function openModal(html, cls = '') {
    closeModal();
    const m = document.createElement('div');
    m.className = 'modal-wrap'; m.id = 'modal';
    m.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true"><button class="modal-close" aria-label="${esc(T.close)}">✕</button>${html}</div>`;
    document.body.appendChild(m); document.body.classList.add('no-scroll');
    m.onclick = e => { if (e.target === m || e.target.classList.contains('modal-close')) closeModal(); };
    translateIn(m);
    return m;
  }
  function closeModal(instant) {
    const m = $('#modal'); if (!m) return;
    const after = () => { if (!$('#lightbox') && !$('#modal')) document.body.classList.remove('no-scroll'); };
    if (instant || !A.closeAnimated) { m.remove(); after(); } else { m.id = ''; A.closeAnimated(m, 'closing', 220, after); }
  }

  function quickView(id) {
    const p = BY_ID.get(id); if (!p) return;
    const c = countryOf(p.country);
    const m = openModal(`
      <div class="qv">
        <div class="qv-gal"><img src="${p.images[0]}" alt="" id="qvImg">${p.images.length > 1 ? `<div class="gallery-thumbs">${p.images.slice(0, 5).map((s, i) => `<img src="${s}" class="${i ? '' : 'active'}" data-src="${s}" alt="">`).join('')}</div>` : ''}</div>
        <div class="qv-info">
          <div class="p-meta"><span><span class="star">★</span> ${p.rating}</span><span>${reviewCount(p)} ${reviewsWord(reviewCount(p))}</span><span>${c.flag} ${esc(countryName(c))}</span></div>
          <h2 data-tr="${esc(p.title)}">${esc(p.title)}</h2>
          <div class="buy-price"><b>${money(p.price)}</b>${p.oldPrice ? `<s>${money(p.oldPrice)}</s><span class="pct">-${pct(p)}%</span>` : ''}</div>
          <p class="qv-desc" data-tr-block="${esc(p.description.slice(0, 420))}">${esc(p.description.slice(0, 420))}${p.description.length > 420 ? '…' : ''}</p>
          <div class="card-tags">${p.tags.map(t => `<a class="tag" href="#/catalog?tag=${encodeURIComponent(t)}">#${esc(tagName(t))}</a>`).join('')}</div>
          <div class="buy-row" style="margin-top:16px">
            <button class="btn btn-primary btn-lg ${state.cart[p.id] ? 'in-cart' : ''}" data-add="${p.id}">${state.cart[p.id] ? '✓ ' + T.inCart : T.addToCart}</button>
            <button class="btn btn-secondary icon-only ${isFav(p.id) ? 'active' : ''}" data-fav="${p.id}"><span class="heart">${isFav(p.id) ? '♥' : '♡'}</span></button>
            <button class="btn btn-secondary icon-only ${inCompare(p.id) ? 'active' : ''}" data-cmp="${p.id}">⚖</button>
          </div>
          <a class="link" href="#/product/${p.id}" style="display:inline-block;margin-top:14px">${T.viewAll} →</a>
        </div>
      </div>`, 'modal-qv');
    $$('.gallery-thumbs img', m).forEach(t => t.onclick = () => { $('#qvImg').src = t.dataset.src; $$('.gallery-thumbs img', m).forEach(x => x.classList.toggle('active', x === t)); });
    m.addEventListener('click', e => { if (e.target.closest('a')) closeModal(); });
  }

  function shortcutsModal() {
    const rows = [['/', T.scSearch], ['Esc', T.scClose], ['g h', T.scHome], ['g c', T.scCart], ['g f', T.scFav], ['?', T.scHelp]];
    openModal(`<h2 style="margin-bottom:16px">⌨️ ${T.shortcuts}</h2><div class="kbd-list">${rows.map(([k, d]) => `<div><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join('')}</div>`, 'modal-sm');
  }

  Object.assign(A, { openModal, closeModal, quickView, shortcutsModal });
})();
