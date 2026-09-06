/* ===== GIGASAIT MARKET — машинный перевод описаний в реальном времени =====
   Описания и названия товаров хранятся по-русски. Когда интерфейс на другом языке, тексты можно
   переводить «на лету» через публичный эндпоинт Google Переводчика (тот же, что использует
   расширение Google Translate для Chrome; ключ не нужен, отдаёт CORS-заголовки, поэтому работает
   прямо из браузера даже с file://). Резерв — MyMemory (лимит 500 символов на запрос).

   Особенности:
   • кэш переводов в localStorage (giga.tr) — повторные открытия не ходят в сеть;
   • пакетный перевод списка строк одним запросом (строки склеиваются переводами строк);
   • ограничение параллельности, чтобы не ловить 429;
   • при любой ошибке возвращается исходный текст — сайт продолжает работать офлайн.

   API: MARKET_TR.text(str, lang) → Promise<string>;  MARKET_TR.list([str...], lang) → Promise<[str...]>
        MARKET_TR.cached(str, lang) → string|null (синхронно, только из кэша) */
window.MARKET_TR = (function () {
  const GOOGLE_CODES = { zh: 'zh-CN' };
  const STORE_KEY = 'giga.tr';
  const CACHE_MAX = 1500;
  const MAX_CHARS = 4500;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { cache = {}; }
  let order = Object.keys(cache);
  let saveTimer = 0;

  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); };
  const key = (s, lang) => lang + ':' + hash(s);
  function remember(k, v) {
    if (!(k in cache)) { order.push(k); if (order.length > CACHE_MAX) { const drop = order.splice(0, order.length - CACHE_MAX); drop.forEach(d => delete cache[d]); } }
    cache[k] = v;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cache)); } catch { /* квота */ } }, 400);
  }
  const cached = (s, lang) => cache[key(s, lang)] ?? null;

  // очередь с ограничением параллельности
  let active = 0; const queue = [];
  const LIMIT = 2;
  function schedule(fn) {
    return new Promise((res, rej) => {
      queue.push(() => fn().then(res, rej).finally(() => { active--; next(); }));
      next();
    });
  }
  function next() { while (active < LIMIT && queue.length) { active++; queue.shift()(); } }

  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

  async function google(text, tl) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=' + encodeURIComponent(GOOGLE_CODES[tl] || tl) + '&dt=t&q=' + encodeURIComponent(text);
    const r = await withTimeout(fetch(url), 9000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('bad response');
    return data[0].map(seg => seg[0] || '').join('');
  }
  async function mymemory(text, tl) {
    if (text.length > 500) throw new Error('too long');
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=ru|' + encodeURIComponent(GOOGLE_CODES[tl] || tl);
    const r = await withTimeout(fetch(url), 9000);
    const data = await r.json();
    const t = data && data.responseData && data.responseData.translatedText;
    if (!t || /QUERY LENGTH LIMIT|INVALID/i.test(t)) throw new Error('mymemory');
    return t;
  }
  async function request(text, tl) {
    try { return await google(text, tl); }
    catch (e) { return await mymemory(text, tl); }
  }

  const inflight = new Map();
  function text(s, lang) {
    s = String(s || '').trim();
    if (!s || !lang || lang === 'ru') return Promise.resolve(s);
    const k = key(s, lang);
    if (cache[k]) return Promise.resolve(cache[k]);
    if (inflight.has(k)) return inflight.get(k);
    const p = schedule(async () => {
      const chunks = split(s, MAX_CHARS);
      const out = [];
      for (const c of chunks) out.push(await request(c, lang));
      const res = out.join('');
      remember(k, res);
      return res;
    }).catch(() => s).finally(() => inflight.delete(k));
    inflight.set(k, p);
    return p;
  }

  // Пакет: переводим только то, чего нет в кэше, одним запросом (по строкам). Порядок сохраняется.
  async function list(arr, lang) {
    arr = arr.map(s => String(s || '').trim());
    if (!lang || lang === 'ru') return arr;
    const result = arr.map(s => cached(s, lang));
    const todo = [];
    arr.forEach((s, i) => { if (result[i] == null && s) todo.push(i); });
    if (!todo.length) return result.map((v, i) => v ?? arr[i]);
    // формируем пакеты по MAX_CHARS
    const batches = []; let cur = [], len = 0;
    for (const i of todo) {
      const s = arr[i].replace(/\n+/g, ' ');
      if (len + s.length + 1 > MAX_CHARS && cur.length) { batches.push(cur); cur = []; len = 0; }
      cur.push(i); len += s.length + 1;
    }
    if (cur.length) batches.push(cur);
    await Promise.all(batches.map(b => schedule(async () => {
      const joined = b.map(i => arr[i].replace(/\n+/g, ' ')).join('\n');
      try {
        const tr = await request(joined, lang);
        const parts = tr.split('\n');
        if (parts.length === b.length) b.forEach((i, j) => { result[i] = parts[j].trim() || arr[i]; remember(key(arr[i], lang), result[i]); });
        else await Promise.all(b.map(async i => { result[i] = await text(arr[i], lang); }));
      } catch { b.forEach(i => { result[i] = arr[i]; }); }
    })));
    return result.map((v, i) => v ?? arr[i]);
  }

  function split(s, max) {
    if (s.length <= max) return [s];
    const out = []; let buf = '';
    for (const sent of s.split(/(?<=[.!?…])\s+/)) {
      if ((buf + ' ' + sent).length > max && buf) { out.push(buf); buf = sent; } else buf = buf ? buf + ' ' + sent : sent;
    }
    if (buf) out.push(buf);
    return out;
  }

  function clear() { cache = {}; order = []; localStorage.removeItem(STORE_KEY); }
  const size = () => order.length;

  return { text, list, cached, clear, size };
})();
