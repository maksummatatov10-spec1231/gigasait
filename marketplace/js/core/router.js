/* ===== GIGASAIT MARKET — Роутер (hash) и навигация =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const { $, $$, closeCatalog, closeLightbox, closeModal, closePopovers, renderCart, renderCatalog, renderCheckout, renderCompare, renderCompareBar, renderFavorites, renderHome, renderNotFound, renderOrderDetails, renderOrders, renderPage, renderProduct, renderSettings, renderSuccess, state, timers, translateIn } = A;

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
    '/order': renderOrderDetails,
    '/settings': renderSettings,
    '/page': renderPage
  };
  function navigate() {
    const { path, params } = parseHash();
    const seg = '/' + (path.split('/')[1] || '');
    const arg = decodeURIComponent(path.split('/')[2] || '');
    closeCatalog(); closePopovers(); closeLightbox(); closeModal();
    timers.splice(0).forEach(clearInterval);
    state.moveMode = false; document.body.classList.remove('no-scroll');
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
    translateIn(app);
  }

  Object.assign(A, { parseHash, routes, navigate });
})();
