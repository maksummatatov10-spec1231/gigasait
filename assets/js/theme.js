/* ===== GIGASAIT — тема (общая для хаба, маркетплейса, игр и сообщества) =====
   Подключается в <head> ДО стилей — тема применяется до первой отрисовки, без вспышки.

   • Источник истины — localStorage «giga.theme» ('dark' | 'light'). Если ничего не сохранено —
     берём системную настройку, но дальше НИКОГДА не переопределяем выбор пользователя автоматически.
   • Ставим на <html>: data-theme, style.colorScheme и <meta name="color-scheme"> — так браузер
     (в т.ч. Chrome на Android с «затемнением сайтов») не будет принудительно перекрашивать светлую тему,
     а системные элементы (скроллбары, поля) совпадут с темой.
   • <meta name="theme-color"> обновляется — цвет адресной строки на телефоне совпадает с темой.
   • Синхронизация между вкладками через событие storage.
   • Плавное переключение: View Transitions API (круговая «волна» от кнопки), иначе — CSS-переход цветов.

   API: GIGA_THEME.get() → 'dark'|'light'; GIGA_THEME.set(theme, {x, y, animate}); GIGA_THEME.toggle(ev);
        событие 'themechange' на window { detail: { theme } } */
(function () {
  var KEY = 'giga.theme';
  var root = document.documentElement;
  var COLORS = { dark: '#0a0b10', light: '#f3f4f9' };
  var mem = null; // резерв, если localStorage недоступен (приватный режим и т.п.)

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      if (v && v[0] === '"') { try { v = JSON.parse(v); } catch (e) {} }
      if (v === 'light' || v === 'dark') return v;
    } catch (e) {}
    if (mem) return mem;
    try { return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  }
  function write(t) { mem = t; try { localStorage.setItem(KEY, t); } catch (e) {} }

  function meta(name) {
    var m = document.querySelector('meta[name="' + name + '"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', name); (document.head || root).appendChild(m); }
    return m;
  }
  function paint(t) {
    root.setAttribute('data-theme', t);
    root.style.colorScheme = t;
    try { meta('color-scheme').setAttribute('content', t === 'light' ? 'light dark' : 'dark light'); meta('theme-color').setAttribute('content', COLORS[t]); } catch (e) {}
    var sw = document.getElementById('themeToggle');
    if (sw) sw.setAttribute('aria-checked', t === 'light');
  }

  var current = read();
  paint(current);

  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function set(t, opts) {
    opts = opts || {};
    if (t !== 'light' && t !== 'dark') return current;
    if (t === current) { paint(t); return current; }
    current = t; write(t);
    var animate = opts.animate !== false && !reduce && document.body;
    var done = function () { try { window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } })); } catch (e) {} };
    if (animate && typeof document.startViewTransition === 'function') {
      // круговая волна из точки клика
      var x = opts.x != null ? opts.x : window.innerWidth / 2, y = opts.y != null ? opts.y : 0;
      var r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.classList.add('theme-vt');
      var vt = document.startViewTransition(function () { paint(t); });
      vt.ready.then(function () {
        root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(function () {});
      vt.finished.finally(function () { root.classList.remove('theme-vt'); done(); });
    } else if (animate) {
      root.classList.add('theme-anim');
      paint(t);
      clearTimeout(set._t);
      set._t = setTimeout(function () { root.classList.remove('theme-anim'); done(); }, 450);
    } else { paint(t); done(); }
    return current;
  }
  function toggle(ev) {
    var x, y;
    if (ev && ev.clientX != null && (ev.clientX || ev.clientY)) { x = ev.clientX; y = ev.clientY; }
    else if (ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect) { var b = ev.currentTarget.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; }
    return set(current === 'dark' ? 'light' : 'dark', { x: x, y: y });
  }

  // другая вкладка сменила тему
  window.addEventListener('storage', function (e) { if (e.key === KEY) { var t = read(); if (t !== current) { current = t; paint(t); try { window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } })); } catch (err) {} } } });
  // кнопка #themeToggle подхватывается автоматически на любой странице
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#themeToggle'); if (b) { e.preventDefault(); toggle(e); } });
  document.addEventListener('DOMContentLoaded', function () { paint(current); });

  window.GIGA_THEME = { get: function () { return current; }, set: set, toggle: toggle };
})();
