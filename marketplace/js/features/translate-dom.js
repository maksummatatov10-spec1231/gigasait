/* ===== GIGASAIT MARKET — Машинный перевод текстов товаров в DOM (data-tr) =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js).

   Как это работает:
   • при рендере страницы элементы с data-tr="<оригинал>" (короткие строки: названия, теги, характеристики)
     переводятся пакетно, элементы с data-tr-block="<оригинал>" (описания, отзывы) — по одному;
   • пока идёт перевод, внизу экрана видна панель «Переводим… N» с индикатором; после успеха она
     показывает «Переведено» и исчезает; при ошибке — «Перевод недоступен» с кнопкой «Повторить»;
   • сам перевод (сервисы, кэш, очередь) — в js/translate.js (MARKET_TR). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] });
  const { $, $$, TR, state, trOn, fmt } = A;

  let trGen = 0;

  /* ---------- панель статуса ---------- */
  let bar = null, hideTimer = 0, lastShown = 0;
  function barEl() {
    if (bar && document.body.contains(bar)) return bar;
    bar = document.createElement('div');
    bar.className = 'tr-bar'; bar.id = 'trBar'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = '<span class="tr-spin"></span><span class="tr-bar-text"></span><button type="button" class="link-btn tr-bar-retry"></button><button type="button" class="tr-bar-close" aria-label="×">×</button>';
    bar.querySelector('.tr-bar-retry').onclick = () => { retryFailed(); };
    bar.querySelector('.tr-bar-close').onclick = () => { bar.classList.remove('show'); };
    document.body.appendChild(bar);
    return bar;
  }
  function showBar(kind, text, retry) {
    const b = barEl();
    clearTimeout(hideTimer);
    b.dataset.kind = kind;
    b.querySelector('.tr-bar-text').textContent = text;
    const r = b.querySelector('.tr-bar-retry'); r.textContent = T.trRetry; r.hidden = !retry;
    b.classList.add('show'); lastShown = Date.now();
    if (kind === 'done') hideTimer = setTimeout(() => b.classList.remove('show'), 1800);
    if (kind === 'error') hideTimer = setTimeout(() => b.classList.remove('show'), 9000);
  }
  function hideBar() { if (bar) bar.classList.remove('show'); }

  // реакция на прогресс переводчика
  let pendingSeen = false;
  window.addEventListener('tr:progress', e => {
    if (!trOn()) return;
    const s = e.detail;
    if (s.pending > 0) { pendingSeen = true; showBar('busy', fmt(T.trWorking, { n: s.pending })); return; }
    if (!pendingSeen) return;
    pendingSeen = false;
    if (s.lastError && s.done === 0) showBar('error', T.trFailed + ' — ' + T.trFailedHint, true);
    else if (s.lastError) showBar('error', T.trFailed, true);
    else showBar('done', T.trDone);
  });

  /* ---------- перевод внутри контейнера ---------- */
  function translateIn(root) {
    markLoaded(root);
    if (!root) return;
    if (!trOn()) { hideBar(); return; }
    const gen = ++trGen, lang = state.lang;
    const els = $$('[data-tr]:not([data-trd="2"])', root).filter(el => el.dataset.trd !== '1');
    if (els.length) {
      els.forEach(el => { el.dataset.trd = '1'; const c = TR.cached(el.dataset.tr, lang); if (c) { setText(el, c); el.dataset.trd = '2'; } });
      const rest = els.filter(el => el.dataset.trd === '1');
      if (rest.length) TR.list(rest.map(el => el.dataset.tr), lang).then(res => {
        rest.forEach((el, i) => {
          if (res[i] && res[i] !== el.dataset.tr) { setText(el, res[i]); el.dataset.trd = '2'; }
          else el.dataset.trd = '0'; // не получилось — можно повторить
        });
      });
    }
    $$('[data-tr-block]:not([data-trd="2"])', root).filter(el => el.dataset.trd !== '1').forEach(el => {
      el.dataset.trd = '1';
      const src = el.dataset.trBlock;
      const c = TR.cached(src, lang);
      if (c) { setText(el, c); el.dataset.trd = '2'; return; }
      el.classList.add('translating');
      TR.text(src, lang).then(res => {
        el.classList.remove('translating');
        if (gen !== trGen && !document.contains(el)) return;
        if (res && res !== src) { setText(el, res); el.dataset.trd = '2'; } else el.dataset.trd = '0';
      });
    });
  }
  function setText(el, txt) { el.textContent = txt; if (el.hasAttribute('title')) el.title = txt; }
  function retryFailed() {
    const app = $('#app'); if (!app) return;
    $$('[data-trd="0"]', app).forEach(el => { delete el.dataset.trd; });
    translateIn(app);
  }
  // Вернуть оригиналы (при переключении на русский или выключении автоперевода)
  function untranslate(root) {
    $$('[data-tr][data-trd], [data-tr-block][data-trd]', root || document).forEach(el => {
      const src = el.dataset.tr ?? el.dataset.trBlock;
      el.textContent = src; delete el.dataset.trd; el.classList.remove('translating');
    });
    hideBar();
  }
  function markLoaded(root) { if (root) $$('img', root).forEach(im => { if (im.complete && im.naturalWidth) im.classList.add('ok'); }); }

  window.addEventListener('online', () => { if (trOn()) retryFailed(); });

  Object.assign(A, { trGen, translateIn, markLoaded, retryFailed, untranslate });
})();
