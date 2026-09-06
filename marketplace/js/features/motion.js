/* ===== GIGASAIT MARKET — Плавность и анимации (v0.9.0) =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js).

   • pageTransition(fn) — переход между страницами: полоса загрузки сверху, старая страница тает,
     новая появляется (без «мигания»);
   • ripple — рябь от точки клика на кнопках;
   • flyToCart(fromEl, target) — миниатюра товара «летит» в корзину/избранное, бейдж подпрыгивает;
   • countUp(el, to) — числа пробегают до значения;
   • reveal(root) — блоки появляются при прокрутке (IntersectionObserver);
   • closeAnimated(el, cls, ms) — закрытие модалок/лайтбокса с анимацией.
   Всё уважает prefers-reduced-motion. */
(function () {
  'use strict';
  const A = window.APP;
  const { $, $$ } = A;

  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const isMobile = () => document.documentElement.classList.contains('is-mobile');

  /* ---------- полоса загрузки ---------- */
  let bar = null, barTimer = 0;
  function progressStart() {
    if (!bar) { bar = document.createElement('div'); bar.className = 'nprogress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar); }
    clearTimeout(barTimer);
    bar.style.transition = 'none'; bar.style.width = '0'; bar.classList.add('on');
    void bar.offsetWidth; bar.style.transition = '';
    bar.style.width = '70%';
  }
  function progressDone() {
    if (!bar) return;
    bar.style.width = '100%';
    barTimer = setTimeout(() => { bar.classList.remove('on'); barTimer = setTimeout(() => { bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth; bar.style.transition = ''; }, 300); }, 120);
  }

  /* ---------- переход между страницами ---------- */
  let navToken = 0;
  function pageTransition(render) {
    const app = $('#app');
    const token = ++navToken;
    if (reduce() || !app.childElementCount) { render(); return; }
    progressStart();
    app.classList.remove('entering'); app.classList.add('leaving');
    const go = () => {
      if (token !== navToken) return;
      app.classList.remove('leaving');
      render();
      app.classList.add('entering');
      progressDone();
      app.addEventListener('animationend', () => app.classList.remove('entering'), { once: true });
    };
    // ждём конца fade-out, но не дольше 200 мс
    let fired = false;
    const once = () => { if (fired) return; fired = true; go(); };
    app.addEventListener('transitionend', once, { once: true });
    setTimeout(once, 200);
  }

  /* ---------- рябь на кнопках ---------- */
  document.addEventListener('pointerdown', e => {
    if (reduce() || e.button > 0) return;
    const el = e.target.closest('.btn, .nav-item, .tag, .theme-card, .lang-btn, .country-btn, .filters-toggle, .qty button, .bottom-nav a, .bottom-nav button, .site-mode button, .popover button, .catalog-drop-list button');
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 1.2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    el.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
    setTimeout(() => s.remove(), 700);
  }, { passive: true });

  /* ---------- «полёт» товара в корзину / избранное ---------- */
  function flyToCart(fromEl, targetSel = '#navCart') {
    const card = fromEl && fromEl.closest ? fromEl.closest('.card, .product, .qv, .deal, .cart-item, .together-item') : null;
    const img = card ? card.querySelector('img') : null;
    // на телефоне летим в нижнюю панель
    let target = null;
    if (isMobile()) target = $(`.bottom-nav a[href="${targetSel === '#navFav' ? '#/favorites' : '#/cart'}"]`);
    if (!target || !target.offsetParent) target = $(targetSel);
    if (!target || !target.offsetParent) target = null;
    const bumpTarget = () => { if (target) { target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump'); } };
    if (reduce() || !img || !target) { bumpTarget(); return; }
    const a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (!a.width || !b.width) { bumpTarget(); return; }
    const fly = img.cloneNode(false);
    fly.className = 'fly'; fly.removeAttribute('loading'); fly.removeAttribute('width'); fly.removeAttribute('height');
    fly.style.left = (a.left + a.width / 2 - 32) + 'px'; fly.style.top = (a.top + a.height / 2 - 32) + 'px';
    document.body.appendChild(fly);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = fly.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
      { transform: `translate(${dx * .5}px, ${dy * .5 - 80}px) scale(.7)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.15)`, opacity: .2, offset: 1 }
    ], { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' });
    const end = () => { fly.remove(); bumpTarget(); };
    anim.onfinish = end; setTimeout(end, 800);
  }

  /* ---------- числа с пробегом ---------- */
  function countUp(el, to, { duration = 700, format = v => Math.round(v).toLocaleString() } = {}) {
    if (!el) return;
    const from = parseFloat(String(el.dataset.countCur ?? el.textContent).replace(/[^\d.-]/g, '')) || 0;
    el.dataset.countCur = to;
    if (reduce() || from === to || !isFinite(from)) { el.textContent = format(to); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / duration), e = 1 - Math.pow(1 - k, 3);
      el.textContent = format(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- появление блоков при прокрутке ---------- */
  let io = null;
  function reveal(root) {
    if (!('IntersectionObserver' in window) || reduce()) { $$('.reveal', root).forEach(el => el.classList.add('in')); return; }
    if (!io) io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .05 });
    $$('.reveal:not(.in)', root).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('in'); else io.observe(el);
    });
  }

  /* ---------- закрытие с анимацией ---------- */
  function closeAnimated(el, cls = 'closing', ms = 200, after) {
    if (!el) return;
    if (reduce()) { el.remove(); if (after) after(); return; }
    el.classList.add(cls);
    let done = false;
    const fin = () => { if (done) return; done = true; el.remove(); if (after) after(); };
    el.addEventListener('animationend', fin, { once: true }); el.addEventListener('transitionend', fin, { once: true });
    setTimeout(fin, ms + 50);
  }

  /* ---------- «встряска» поля с ошибкой ---------- */
  function shake(el) { const f = el && (el.closest('.field') || el); if (!f) return; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); f.addEventListener('animationend', () => f.classList.remove('shake'), { once: true }); }

  /* ---------- плавная прокрутка к элементу ---------- */
  function scrollToEl(el, offset = 80) { if (!el) return; const y = el.getBoundingClientRect().top + window.scrollY - offset; window.scrollTo({ top: y, behavior: reduce() ? 'auto' : 'smooth' }); }

  Object.assign(A, { pageTransition, progressStart, progressDone, flyToCart, countUp, reveal, closeAnimated, shake, scrollToEl });
})();
