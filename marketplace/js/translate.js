/* ===== GIGASAIT MARKET — машинный перевод текстов товаров в реальном времени =====
   Названия, описания и отзывы хранятся по-русски. Когда интерфейс на другом языке, тексты
   переводятся «на лету» прямо из браузера — без сервера и ключей API.

   Транспорты (пробуются по очереди, рабочий запоминается):
   1. Google Translate «gtx»  — translate.googleapis.com/translate_a/single (JSON, CORS есть);
   2. Google Translate «dict-chrome-ex» — clients5.google.com/translate_a/t (простой массив строк);
   3. MyMemory — api.mymemory.translated.net (CORS есть, лимит ~500 симв./запрос, ~5000 симв./день анонимно).
   Если сеть недоступна или всё заблокировано — возвращается оригинал, а причина сохраняется в
   MARKET_TR.status() (её показывает панель статуса и раздел «Диагностика перевода» в настройках).

   Особенности: кэш в localStorage (giga.tr), пакетный перевод списков, ограничение параллельности,
   события 'tr:progress' на window (для индикатора «Переводим…»).

   API: MARKET_TR.text(str, lang) → Promise<string>
        MARKET_TR.list([str...], lang) → Promise<[str...]>
        MARKET_TR.cached(str, lang) → string|null (синхронно)
        MARKET_TR.status() → { ok, provider, lastError, done, failed, pending, online }
        MARKET_TR.test(lang) → Promise<{ok, provider, sample, error}> — принудительная проверка
        MARKET_TR.clear(), MARKET_TR.size() */
window.MARKET_TR = (function () {
  const CODES = { zh: 'zh-CN' };
  const STORE_KEY = 'giga.tr';
  const CACHE_MAX = 2000;
  const MAX_CHARS = 1800;      // короткие пакеты — быстрее отклик и меньше шанс отказа
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

  /* ---------- статус / диагностика ---------- */
  const st = { provider: null, lastError: null, lastErrorAt: 0, done: 0, failed: 0, pending: 0, lastOkAt: 0 };
  function emit() { try { window.dispatchEvent(new CustomEvent('tr:progress', { detail: status() })); } catch { /* нет CustomEvent */ } }
  function status() {
    return { ok: !!st.provider && !st.lastError, provider: st.provider, lastError: st.lastError, lastErrorAt: st.lastErrorAt, done: st.done, failed: st.failed, pending: st.pending, online: typeof navigator === 'undefined' ? true : navigator.onLine !== false, cache: order.length };
  }

  /* ---------- очередь с ограничением параллельности ---------- */
  let active = 0; const queue = []; const LIMIT = 3;
  function schedule(fn) {
    return new Promise((res, rej) => {
      st.pending++; emit();
      queue.push(() => fn().then(res, rej).finally(() => { active--; st.pending--; emit(); next(); }));
      next();
    });
  }
  function next() { while (active < LIMIT && queue.length) { active++; queue.shift()(); } }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
  const tl = lang => encodeURIComponent(CODES[lang] || lang);

  /* ---------- транспорты ---------- */
  async function gtx(text, lang) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=' + tl(lang) + '&dt=t&dj=1&q=' + encodeURIComponent(text);
    const r = await withTimeout(fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }), 10000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (data && Array.isArray(data.sentences)) return data.sentences.map(s => s.trans || '').join('');
    if (Array.isArray(data) && Array.isArray(data[0])) return data[0].map(seg => seg[0] || '').join('');
    throw new Error('bad response');
  }
  async function chromeEx(text, lang) {
    const url = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=ru&tl=' + tl(lang) + '&q=' + encodeURIComponent(text);
    const r = await withTimeout(fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }), 10000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    // формат: ["перевод"] либо [["перевод","ru"]] либо {sentences:[...]}
    if (Array.isArray(data)) { const x = data[0]; if (typeof x === 'string') return x; if (Array.isArray(x) && typeof x[0] === 'string') return x[0]; }
    if (data && Array.isArray(data.sentences)) return data.sentences.map(s => s.trans || '').join('');
    throw new Error('bad response');
  }
  async function mymemory(text, lang) {
    // лимит 500 символов на запрос — длинные пакеты режем по строкам/предложениям и переводим по очереди
    if (text.length > 480) {
      const parts = [];
      for (const line of text.split('\n')) {
        let buf = '';
        for (const piece of (line.length > 480 ? split(line, 480) : [line])) {
          if ((buf + ' ' + piece).length > 480 && buf) { parts.push(buf); buf = piece; } else buf = buf ? buf + ' ' + piece : piece;
        }
        parts.push(buf); parts.push('\n');
      }
      parts.pop();
      let out = '';
      for (const p of parts) out += p === '\n' ? '\n' : await mymemory(p, lang);
      return out;
    }
    if (!text.trim()) return text;
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=ru|' + tl(lang);
    const r = await withTimeout(fetch(url, { mode: 'cors', credentials: 'omit' }), 10000);
    const data = await r.json();
    const t = data && data.responseData && data.responseData.translatedText;
    if (!t || /QUERY LENGTH LIMIT|INVALID|MYMEMORY WARNING/i.test(t)) throw new Error('mymemory: ' + (t || 'empty'));
    return t;
  }
  const PROVIDERS = [['google', gtx], ['google-ex', chromeEx], ['mymemory', mymemory]];
  let preferred = 0;

  async function request(text, lang) {
    const errors = [];
    for (let k = 0; k < PROVIDERS.length; k++) {
      const i = (preferred + k) % PROVIDERS.length;
      const [name, fn] = PROVIDERS[i];
      try {
        const out = await fn(text, lang);
        if (!out || !out.trim()) throw new Error('empty');
        preferred = i; st.provider = name; st.lastError = null; st.lastOkAt = Date.now(); st.done++;
        return out;
      } catch (e) {
        errors.push(name + ': ' + ((e && e.message) || e));
      }
    }
    st.failed++;
    st.lastError = errors.join(' | '); st.lastErrorAt = Date.now();
    throw new Error(st.lastError);
  }

  /* ---------- публичные функции ---------- */
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
      const res = out.join(' ').trim();
      if (!res) throw new Error('empty');
      remember(k, res);
      return res;
    }).catch(() => s).finally(() => inflight.delete(k));
    inflight.set(k, p);
    return p;
  }

  // Пакет: переводим только то, чего нет в кэше, склеивая строки переводом строки. Порядок сохраняется.
  const SEP = '\n';
  async function list(arr, lang) {
    arr = arr.map(s => String(s || '').trim());
    if (!lang || lang === 'ru') return arr;
    const result = arr.map(s => cached(s, lang));
    const todo = [];
    arr.forEach((s, i) => { if (result[i] == null && s) todo.push(i); });
    if (!todo.length) return result.map((v, i) => v ?? arr[i]);
    const batches = []; let cur = [], len = 0;
    for (const i of todo) {
      const s = arr[i].replace(/\s*\n+\s*/g, ' ');
      if ((len + s.length + 1 > MAX_CHARS || cur.length >= 25) && cur.length) { batches.push(cur); cur = []; len = 0; }
      cur.push(i); len += s.length + 1;
    }
    if (cur.length) batches.push(cur);
    await Promise.all(batches.map(b => schedule(async () => {
      const joined = b.map(i => arr[i].replace(/\s*\n+\s*/g, ' ')).join(SEP);
      try {
        const tr = await request(joined, lang);
        const parts = tr.trim().split(/\s*\n\s*/);
        if (parts.length === b.length) b.forEach((i, j) => { result[i] = parts[j].trim() || arr[i]; remember(key(arr[i], lang), result[i]); });
        else {
          // сервис склеил/разбил строки иначе — переводим элементы этого пакета по одному.
          // ВАЖНО: напрямую через request, а не через schedule(): мы уже занимаем слот очереди,
          // и постановка новых задач в ту же очередь привела бы к взаимной блокировке.
          for (const i of b) {
            const c = cached(arr[i], lang); if (c) { result[i] = c; continue; }
            try { const one = (await request(arr[i], lang)).trim(); result[i] = one || arr[i]; if (one) remember(key(arr[i], lang), one); }
            catch { result[i] = arr[i]; }
          }
        }
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

  // Принудительная проверка связи с переводчиком (кнопка «Проверить» в настройках)
  async function test(lang) {
    const sample = 'Проверка перевода: смартфон с отличной камерой.';
    try { const out = await request(sample, lang === 'ru' ? 'en' : lang); return { ok: true, provider: st.provider, sample: out }; }
    catch (e) { return { ok: false, provider: null, error: (e && e.message) || String(e) }; }
  }

  function clear() { cache = {}; order = []; localStorage.removeItem(STORE_KEY); st.done = 0; st.failed = 0; st.lastError = null; emit(); }
  const size = () => order.length;

  return { text, list, cached, clear, size, status, test };
})();
