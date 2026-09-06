/* ===== GIGASAIT — определение устройства (телефон / планшет / компьютер) =====
   Подключается в <head> ДО стилей-зависимых отрисовок, чтобы мобильная вёрстка применилась без «прыжка».
   Ставит на <html> классы: is-mobile (телефон или планшет), is-tablet (планшет), is-desktop, is-touch,
   и атрибут data-device="phone|tablet|desktop".

   Логика: ручной выбор пользователя (localStorage giga.device = auto|phone|desktop) → иначе авто:
   • User-Agent / userAgentData.mobile;
   • грубый указатель (pointer: coarse) + отсутствие hover — тач-экран;
   • ширина экрана: ≤ 820px — телефон, ≤ 1180px с тачем — планшет.
   Пересчитывается при повороте/изменении размера. API: window.GIGA_DEVICE.{type, isMobile, mode, setMode(m), refresh()} */
(function () {
  var KEY = 'giga.device';
  var root = document.documentElement;
  function stored() { try { var v = localStorage.getItem(KEY); if (v && v[0] === '"') v = JSON.parse(v); return v === 'phone' || v === 'desktop' ? v : 'auto'; } catch (e) { return 'auto'; } }
  function detect() {
    var ua = navigator.userAgent || '';
    var uaMobile = (navigator.userAgentData && navigator.userAgentData.mobile) || /Android|iPhone|iPod|Windows Phone|IEMobile|Mobile Safari|Opera Mini/i.test(ua);
    var isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    var uaTablet = isIPad || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || /Tablet|PlayBook|Silk/i.test(ua);
    var coarse = false, noHover = false;
    try { coarse = matchMedia('(pointer: coarse)').matches; noHover = matchMedia('(hover: none)').matches; } catch (e) {}
    var touch = coarse || noHover || navigator.maxTouchPoints > 0;
    var w = Math.min(screen.width || 1e4, window.innerWidth || 1e4);
    var type = 'desktop';
    if (uaTablet && !uaMobile) type = 'tablet';
    else if (uaMobile || (touch && w <= 820)) type = w <= 820 ? 'phone' : 'tablet';
    else if (touch && coarse && w <= 1180) type = 'tablet';
    else if (w <= 640) type = 'phone';
    return { type: type, touch: touch };
  }
  var mode = stored();
  var current = null;
  function apply() {
    var d = detect();
    var type = mode === 'phone' ? 'phone' : mode === 'desktop' ? 'desktop' : d.type;
    current = type;
    var isMobile = type !== 'desktop';
    root.classList.toggle('is-mobile', isMobile);
    root.classList.toggle('is-tablet', type === 'tablet');
    root.classList.toggle('is-desktop', !isMobile);
    root.classList.toggle('is-touch', d.touch);
    root.setAttribute('data-device', type);
    root.setAttribute('data-device-mode', mode);
    return type;
  }
  apply();
  var t;
  window.addEventListener('resize', function () { if (mode !== 'auto') return; clearTimeout(t); t = setTimeout(function () { var was = current; if (apply() !== was) window.dispatchEvent(new CustomEvent('devicechange', { detail: { type: current } })); }, 150); });
  window.addEventListener('orientationchange', function () { setTimeout(apply, 50); });
  window.GIGA_DEVICE = {
    get type() { return current; },
    get isMobile() { return current !== 'desktop'; },
    get mode() { return mode; },
    detected: function () { return detect().type; },
    setMode: function (m) {
      mode = (m === 'phone' || m === 'desktop') ? m : 'auto';
      try { if (mode === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch (e) {}
      var was = current; apply();
      window.dispatchEvent(new CustomEvent('devicechange', { detail: { type: current, changed: was !== current } }));
      return current;
    },
    refresh: apply
  };
})();
