/* ===== GIGASAIT MARKET — Статические страницы и 404 =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, I18N, esc, state, toast } = A;

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

  Object.assign(A, { pageData, PAGE_IDS, renderPage, renderNotFound });
})();
