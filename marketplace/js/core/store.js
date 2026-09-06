/* ===== GIGASAIT MARKET — Хранилище (localStorage) и хелперы =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;

  /* ---------- Хранилище (localStorage) ---------- */
  const store = {
    get(key, def) {
      const v = localStorage.getItem('giga.' + key);
      if (v === null) return def;
      try { return JSON.parse(v); } catch { return v; }
    },
    set(key, val) { try { localStorage.setItem('giga.' + key, typeof val === 'string' ? val : JSON.stringify(val)); } catch { /* квота */ } },
    remove(key) { localStorage.removeItem('giga.' + key); }
  };
  const arr = (v, d = []) => Array.isArray(v) ? v : d;
  const obj = (v, d = {}) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : d;

  Object.assign(A, { store, arr, obj });
})();
