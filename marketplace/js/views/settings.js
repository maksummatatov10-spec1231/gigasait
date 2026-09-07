/* ===== GIGASAIT MARKET — Настройки =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, $$, COUNTRIES, I18N, LEVELS, TR, applyPrefs, applyTheme, country, countryName, esc, fmt, fmtDate, levelOf, money, setLang, state, store, toast, totalSpent, translateIn } = A;
  // функции из модулей, которые загружаются позже — связываются лениво
  const setCountry = (...args) => A.setCountry(...args);

  /* ---------- Настройки ---------- */
  function trDiagHTML() {
    if (state.lang === 'ru') return `<div>${T.trOnlyNonRu}</div>`;
    if (!state.prefs.autoTr) return `<div>${T.trOff}</div>`;
    const s = TR.status();
    return `
      <div class="row"><b>${T.trProvider}:</b> <span class="${s.provider ? 'ok' : ''}">${s.provider ? esc(s.provider) : T.trProviderNone}</span></div>
      <div class="row"><b>${T.trLastError}:</b> ${s.lastError ? `<span class="bad">${esc(s.lastError)}</span>` : `<span class="ok">${T.trNoErrors}</span>`}</div>
      <div>${fmt(T.trStats, { ok: s.done, fail: s.failed, cache: s.cache })}</div>
      <div class="row"><button type="button" class="btn btn-secondary btn-sm" id="trTestBtn">🔎 ${T.trTest}</button><span class="tr-test-out" id="trTestOut"></span></div>`;
  }
  function bindTrTest(app) {
    const b = $('#trTestBtn', app); if (!b) return;
    b.onclick = async () => {
      const out = $('#trTestOut', app); out.textContent = T.trTesting; out.className = 'tr-test-out'; b.disabled = true;
      const r = await TR.test(state.lang);
      b.disabled = false;
      out.className = 'tr-test-out ' + (r.ok ? 'ok' : 'bad');
      out.textContent = r.ok ? fmt(T.trTestOk, { provider: r.provider, sample: r.sample }) : fmt(T.trTestFail, { error: r.error });
      const d = $('#trDiag', app); if (d) { const keep = out.outerHTML; d.innerHTML = trDiagHTML(); const o = $('#trTestOut', d); if (o) o.outerHTML = keep; bindTrTest(app); }
      if (r.ok) translateIn($('#app'));
    };
  }
  function renderSettings(app) {
    document.title = `${T.settingsTitle} — GIGASAIT Market`;
    const pr = state.profile;
    const spent = totalSpent(); const lvl = levelOf(spent);
    const nextLvl = LEVELS[LEVELS.indexOf(lvl) + 1];
    const orders = state.orders.filter(o => o.status !== 'cancelled').length;
    const sw = (key, label, hint) => `<div class="setting-row"><div><b>${label}</b><small>${hint}</small></div><button class="switch ${state.prefs[key] ? 'on' : ''}" data-pref="${key}" role="switch" aria-checked="${!!state.prefs[key]}"></button></div>`;
    app.innerHTML = `
      <h1 class="page-title">${T.settingsTitle}</h1>
      <div class="settings">
        <div class="form-card profile-card">
          <div class="avatar">${(pr.name || '?').trim().charAt(0).toUpperCase()}</div>
          <div class="profile-info">
            <b>${esc(pr.name) || T.profile}</b>
            <div class="level">${lvl[2]} ${T.level}: ${T[lvl[0]]}${nextLvl ? ` <small class="muted">→ ${T[nextLvl[0]]} ${money(nextLvl[1])}</small>` : ''}</div>
            ${nextLvl ? `<div class="bar"><i style="width:${Math.min(100, spent / nextLvl[1] * 100)}%"></i></div>` : ''}
            <div class="profile-stats">
              <div><b>${orders}</b><span>${T.ordersCount}</span></div>
              <div><b>${money(spent)}</b><span>${T.spent}</span></div>
              <div><b>🎁 ${state.bonus}</b><span>${T.bonuses}</span></div>
              <div><b>${fmtDate(state.memberSince)}</b><span>${T.memberSince}</span></div>
            </div>
            <small class="muted">${T.bonusHint}</small>
          </div>
        </div>
        <div class="form-card">
          <h3>🎨 ${T.themeTitle}</h3>
          <div class="theme-cards">
            <div class="theme-card ${state.theme === 'dark' ? 'active' : ''}" data-theme-pick="dark"><span class="sw" style="background:#0a0b10"></span>🌙 ${T.dark}</div>
            <div class="theme-card ${state.theme === 'light' ? 'active' : ''}" data-theme-pick="light"><span class="sw" style="background:#f3f4f9"></span>☀️ ${T.light}</div>
          </div>
          <div class="auto-dark-note" id="autoDarkNote">⚠️ ${T.autoDarkNote}</div>
          <div style="margin-top:14px">${sw('liveBg', T.liveBackground, T.liveBackgroundHint)}</div>
        </div>
        <div class="form-card">
          <h3>🌐 ${T.language}</h3>
          <div class="lang-grid">
            <button class="lang-btn ${state.langAuto ? 'active' : ''}" data-lang="auto">🌍 ${T.autoLang}<br><small style="opacity:.7">${I18N.meta(I18N.detect()).flag} ${esc(I18N.meta(I18N.detect()).name)}</small></button>
            ${I18N.LANGS.map(l => `<button class="lang-btn ${state.lang === l.code && !state.langAuto ? 'active' : ''}" data-lang="${l.code}" lang="${l.code}">${l.flag} ${esc(l.name)}</button>`).join('')}
          </div>
          <small class="muted" style="display:block;margin-top:10px">${T.langHint}</small>
          <div style="margin-top:14px">${sw('autoTr', T.autoTranslate, T.autoTranslateHint)}</div>
          <div class="tr-diag" id="trDiag">${trDiagHTML()}</div>
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
          ${sw('infinite', T.infiniteScroll, T.infiniteScrollHint)}
        </div>
        <div class="form-card">
          <h3>⌨️ ${T.shortcuts}</h3>
          <div class="kbd-list">${[['/', T.scSearch], ['Esc', T.scClose], ['g h', T.scHome], ['g c', T.scCart], ['g f', T.scFav], ['?', T.scHelp]].map(([k, d]) => `<div><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join('')}</div>
        </div>
        <div class="form-card">
          <h3>🗄 ${T.dangerZone}</h3>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-secondary" id="clearRecent">🕘 ${T.recentlyViewed}: ${T.clear}</button>
            <button class="btn btn-secondary" id="clearTr">🌐 ${T.translate}: ${T.clear} (${TR.size()})</button>
            <button class="btn btn-secondary btn-danger" id="clearAll">🗑 ${T.clearData}</button>
          </div>
        </div>
        <a class="btn btn-secondary" href="../index.html">⏏ ${T.backToHub}</a>
      </div>`;
    $$('[data-theme-pick]').forEach(b => b.onclick = e => { state.theme = b.dataset.themePick; applyTheme(e); $$('[data-theme-pick]').forEach(x => x.classList.toggle('active', x === b)); });
    $$('[data-lang]').forEach(b => b.onclick = () => { if (b.dataset.lang === 'auto') setLang(I18N.detect(), true); else setLang(b.dataset.lang, false); });
    $$('[data-country]').forEach(b => b.onclick = () => { setCountry(b.dataset.country); renderSettings(app); });
    $('#profileForm').onsubmit = e => {
      e.preventDefault(); const f = e.target.elements;
      state.profile = { ...state.profile, name: f.name.value, phone: f.phone.value, email: f.email.value, city: f.city.value, postal: f.postal.value, street: f.street.value };
      store.set('profile', state.profile); toast(T.saved); renderSettings(app);
    };
    $$('[data-sw]').forEach(b => b.onclick = () => { state.profile[b.dataset.sw] = !state.profile[b.dataset.sw]; store.set('profile', state.profile); b.classList.toggle('on'); b.setAttribute('aria-checked', b.classList.contains('on')); });
    $$('[data-pref]').forEach(b => b.onclick = () => {
      state.prefs[b.dataset.pref] = !state.prefs[b.dataset.pref]; applyPrefs(); b.classList.toggle('on'); b.setAttribute('aria-checked', b.classList.contains('on'));
      if (b.dataset.pref === 'autoTr') { const d = $('#trDiag'); if (d) d.innerHTML = trDiagHTML(); bindTrTest(app); }
    });
    bindTrTest(app);

    $('#clearRecent').onclick = () => { state.recent = []; store.set('recent', []); state.searches = []; store.set('searches', []); toast(T.saved); };
    $('#clearTr').onclick = () => { TR.clear(); toast(T.saved); renderSettings(app); };
    $('#clearAll').onclick = () => { if (confirm(T.confirmClear)) { Object.keys(localStorage).filter(k => k.startsWith('giga.')).forEach(k => localStorage.removeItem(k)); location.reload(); } };
  }

  Object.assign(A, { renderSettings });
})();
