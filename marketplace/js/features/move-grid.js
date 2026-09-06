/* ===== GIGASAIT MARKET — Избранное: режим перемещения карточек (drag & drop) =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js).

   Почему плавно (v0.8.0, переписано с нуля):
   • Во время перетаскивания DOM не трогаем вообще. Позиции ячеек сетки (слоты) читаются ОДИН раз при
     подъёме карточки; дальше всё считается по кэшу — никаких getBoundingClientRect / elementsFromPoint
     на каждом движении, значит нет reflow и рывков.
   • Поднятая карточка — клон в fixed-слое, двигается только transform: translate3d (композитор, GPU).
   • Соседи сдвигаются тоже только через transform с CSS-transition, DOM-порядок фиксируется один раз
     при отпускании. Карточки никогда не накладываются: у каждой всегда свой слот.
   • Решение «в какой слот» принимается с гистерезисом: центр карточки должен явно войти во внутреннюю
     область слота, поэтому нет дрожания на границе двух ячеек.
   • Все вычисления — в одном requestAnimationFrame на кадр; автопрокрутка у края экрана — там же.
   Клавиатура: стрелки / Home / End. Указатели: мышь, палец, стилус (Pointer Events). */
(function () {
  'use strict';
  const A = window.APP;
  const { $$, state } = A;

  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  const SHIFT_MS = 220;

  function setupMoveGrid(grid, onChange) {
    let drag = null, raf = 0;
    const cards = () => $$('.card', grid).filter(c => !c.classList.contains('drag-lift'));

    /* ---------- FLIP для клавиатуры (редкая операция — можно читать layout) ---------- */
    function snapshot() { const m = new Map(); cards().forEach(c => m.set(c, c.getBoundingClientRect())); return m; }
    function flip(before, except) {
      cards().forEach(c => {
        if (c === except) return;
        const a = before.get(c), b = c.getBoundingClientRect(); if (!a) return;
        const dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 260, easing: EASE });
      });
    }
    function moveTo(src, target, after) {
      if (!target || target === src) return false;
      const before = snapshot();
      target.insertAdjacentElement(after ? 'afterend' : 'beforebegin', src);
      flip(before, src);
      return true;
    }

    /* ---------- указатель ---------- */
    grid.addEventListener('pointerdown', e => {
      if (!state.moveMode || e.button > 0 || drag) return;
      const card = e.target.closest('.card'); if (!card || !grid.contains(card)) return;
      e.preventDefault();
      drag = { card, id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, lifted: false };
      try { card.setPointerCapture(e.pointerId); } catch { /* старые браузеры */ }
    });
    grid.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.x = e.clientX; drag.y = e.clientY;
      if (!drag.lifted) { if (Math.hypot(drag.x - drag.sx, drag.y - drag.sy) < 6) return; lift(); }
      if (!raf) raf = requestAnimationFrame(tick);
    });
    const finish = e => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      const d = drag; drag = null;
      if (!d.lifted) return;
      drop(d);
    };
    grid.addEventListener('pointerup', finish);
    grid.addEventListener('pointercancel', finish);
    grid.addEventListener('lostpointercapture', e => { if (drag && drag.lifted && e.pointerId === drag.id) finish(e); });
    grid.addEventListener('click', e => { if (state.moveMode) { e.preventDefault(); e.stopPropagation(); } }, true);

    /* ---------- подъём: единственное чтение геометрии ---------- */
    function lift() {
      const d = drag;
      d.lifted = true;
      const list = cards();
      const n = list.length;
      const sy = window.scrollY, sx = window.scrollX;
      // слоты в координатах документа — не зависят от прокрутки
      d.slots = list.map(c => { const r = c.getBoundingClientRect(); return { l: r.left + sx, t: r.top + sy, w: r.width, h: r.height, cx: r.left + sx + r.width / 2, cy: r.top + sy + r.height / 2 }; });
      d.list = list;
      d.from = list.indexOf(d.card);
      d.to = d.from;
      d.pos = list.map((_, i) => i);               // текущий визуальный слот каждой карточки
      const s = d.slots[d.from];
      d.ox = d.sx + sx - s.l; d.oy = d.sy + sy - s.t; // смещение курсора внутри карточки
      // клон в fixed-слое
      const g = d.card.cloneNode(true);
      g.classList.add('drag-lift'); g.classList.remove('wiggle');
      g.style.left = (s.l - sx) + 'px'; g.style.top = (s.t - sy) + 'px'; g.style.width = s.w + 'px'; g.style.height = s.h + 'px';
      g.style.transform = 'translate3d(0,0,0) scale(1.03)';
      document.body.appendChild(g); d.ghost = g;
      d.card.classList.add('drag-hole'); d.card.setAttribute('aria-grabbed', 'true');
      grid.classList.add('dragging');
      list.forEach(c => { c.style.transition = `transform ${SHIFT_MS}ms ${EASE}`; });
      d.gx = 0; d.gy = 0;
    }

    /* ---------- кадр: позиция клона + выбор слота + автопрокрутка ---------- */
    function tick() {
      raf = 0;
      const d = drag; if (!d || !d.lifted) return;
      // автопрокрутка у краёв экрана
      const m = 70, vh = window.innerHeight;
      let scrolled = false;
      if (d.y < m) { window.scrollBy(0, -Math.ceil((m - d.y) / 4)); scrolled = true; }
      else if (d.y > vh - m) { window.scrollBy(0, Math.ceil((d.y - (vh - m)) / 4)); scrolled = true; }
      // клон движется только transform-ом
      const gx = d.x - d.sx, gy = d.y - d.sy;
      if (gx !== d.gx || gy !== d.gy) { d.gx = gx; d.gy = gy; d.ghost.style.transform = `translate3d(${gx}px,${gy}px,0) scale(1.03)`; }
      // центр перетаскиваемой карточки в координатах документа
      const s0 = d.slots[d.from];
      const cx = d.x + window.scrollX - d.ox + s0.w / 2, cy = d.y + window.scrollY - d.oy + s0.h / 2;
      const target = pickSlot(d, cx, cy);
      if (target !== d.to) { d.to = target; layout(d); }
      if (scrolled || d.y < m || d.y > vh - m) raf = requestAnimationFrame(tick);
    }
    function pickSlot(d, cx, cy) {
      const cur = d.slots[d.to];
      // гистерезис: текущий слот держим, пока центр не вышел за его расширенные границы
      const pad = 0.12;
      if (cx > cur.l - cur.w * pad && cx < cur.l + cur.w * (1 + pad) && cy > cur.t - cur.h * pad && cy < cur.t + cur.h * (1 + pad)) return d.to;
      let best = d.to, bestDist = Infinity;
      for (let i = 0; i < d.slots.length; i++) {
        const s = d.slots[i];
        // кандидат — только если центр явно внутри внутренней области слота
        if (cx < s.l + s.w * pad || cx > s.l + s.w * (1 - pad) || cy < s.t + s.h * pad || cy > s.t + s.h * (1 - pad)) continue;
        const dist = (cx - s.cx) ** 2 + (cy - s.cy) ** 2;
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
      return best;
    }
    // раскладка: карточка i занимает слот pos[i]; DOM не меняем, только transform
    function layout(d) {
      const { from, to, list, slots } = d;
      for (let i = 0; i < list.length; i++) {
        let p = i;
        if (i === from) p = to;
        else if (from < to && i > from && i <= to) p = i - 1;
        else if (to < from && i >= to && i < from) p = i + 1;
        if (p === d.pos[i]) continue;
        d.pos[i] = p;
        list[i].style.transform = p === i ? '' : `translate3d(${slots[p].l - slots[i].l}px,${slots[p].t - slots[i].t}px,0)`;
      }
    }

    /* ---------- отпускание: клон «садится» в слот, затем один раз меняем DOM ---------- */
    function drop(d) {
      const { card, ghost, list, slots, from, to } = d;
      const s = slots[to];
      const tx = s.l - window.scrollX - parseFloat(ghost.style.left), ty = s.t - window.scrollY - parseFloat(ghost.style.top);
      ghost.classList.add('settle');
      ghost.style.transform = `translate3d(${tx}px,${ty}px,0) scale(1)`;
      let done = false;
      const commit = () => {
        if (done) return; done = true;
        // фиксируем порядок в DOM без анимации
        list.forEach(c => { c.style.transition = 'none'; c.style.transform = ''; });
        if (to !== from) {
          const ref = list[to];
          ref.insertAdjacentElement(to > from ? 'afterend' : 'beforebegin', card);
        }
        card.classList.remove('drag-hole'); card.setAttribute('aria-grabbed', 'false');
        grid.classList.remove('dragging');
        ghost.remove();
        void grid.offsetWidth; // применяем без transition
        list.forEach(c => { c.style.transition = ''; });
        if (to !== from) onChange();
      };
      ghost.addEventListener('transitionend', commit, { once: true });
      setTimeout(commit, 300); // страховка, если transitionend не пришёл
    }

    /* ---------- клавиатура ---------- */
    grid.addEventListener('keydown', e => {
      if (!state.moveMode || drag) return;
      const card = e.target.closest('.card'); if (!card) return;
      const list = cards(); const i = list.indexOf(card);
      const rtl = document.body.classList.contains('rtl');
      const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft', nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
      let ok = false;
      if (e.key === prevKey && i > 0) ok = moveTo(card, list[i - 1], false);
      else if (e.key === nextKey && i < list.length - 1) ok = moveTo(card, list[i + 1], true);
      else if (e.key === 'Home' && i > 0) ok = moveTo(card, list[0], false);
      else if (e.key === 'End' && i < list.length - 1) ok = moveTo(card, list[list.length - 1], true);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const cols = Math.max(1, Math.round(grid.clientWidth / (card.offsetWidth + 16)));
        const j = e.key === 'ArrowUp' ? i - cols : i + cols;
        if (j >= 0 && j < list.length) ok = moveTo(card, list[j], e.key === 'ArrowDown');
      }
      if (ok) { e.preventDefault(); card.focus(); onChange(); }
    });
  }

  Object.assign(A, { setupMoveGrid });
})();
