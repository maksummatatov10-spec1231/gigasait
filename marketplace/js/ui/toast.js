/* ===== GIGASAIT MARKET — Тосты с действием «Отменить» =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const { $, esc } = A;

  /* ---------- Тосты (с действием «Отменить») ---------- */
  function toast(msg, icon = '✓', action) {
    const wrap = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>${action ? `<button class="toast-act">${esc(action.label)}</button>` : ''}`;
    if (action) { el.style.pointerEvents = 'auto'; $('.toast-act', el).onclick = () => { action.fn(); el.remove(); }; }
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, action ? 5000 : 2400);
  }

  Object.assign(A, { toast });
})();
