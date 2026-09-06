/* ===== GIGASAIT MARKET — Лайтбокс галереи =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;
  const T = new Proxy({}, { get: (_, k) => A.T[k] }); // живая ссылка на словарь текущего языка
  const { $, esc } = A;

  /* ---------- Лайтбокс ---------- */
  function openLightbox(images, i = 0) {
    closeLightbox();
    const lb = document.createElement('div');
    lb.className = 'lightbox'; lb.id = 'lightbox';
    let cur = i;
    lb.innerHTML = `<button class="lb-close" aria-label="${esc(T.close)}">✕</button>
      ${images.length > 1 ? `<button class="lb-prev" aria-label="‹">‹</button><button class="lb-next" aria-label="›">›</button>` : ''}
      <img src="${images[cur]}" alt=""><div class="lb-count">${cur + 1} / ${images.length}</div>`;
    document.body.appendChild(lb); document.body.classList.add('no-scroll');
    const show = n => { cur = (n + images.length) % images.length; $('img', lb).src = images[cur]; $('.lb-count', lb).textContent = `${cur + 1} / ${images.length}`; };
    lb.onclick = e => { if (e.target === lb || e.target.classList.contains('lb-close')) closeLightbox(); };
    if (images.length > 1) { $('.lb-prev', lb).onclick = () => show(cur - 1); $('.lb-next', lb).onclick = () => show(cur + 1); }
    lb._key = e => { if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1); };
    document.addEventListener('keydown', lb._key);
    // свайп
    let sx = 0; lb.addEventListener('pointerdown', e => { sx = e.clientX; }); lb.addEventListener('pointerup', e => { const dx = e.clientX - sx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); });
  }
  function closeLightbox() {
    const lb = $('#lightbox'); if (!lb) return;
    document.removeEventListener('keydown', lb._key); lb.remove(); if (!$('#modal')) document.body.classList.remove('no-scroll');
  }

  Object.assign(A, { openLightbox, closeLightbox });
})();
