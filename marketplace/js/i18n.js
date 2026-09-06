/* ===== GIGASAIT MARKET — ядро локализации =====
   Словари лежат в js/lang/<код>.js (по одному файлу на язык) и регистрируются в window.MARKET_LANG.
   Здесь: список языков, автоопределение по браузеру, доступ к строкам с фолбэком (язык → en → ru),
   множественное число через Intl.PluralRules, переводы категорий/подкатегорий/тегов/стран.

   Как добавить язык: скопировать js/lang/en.js → js/lang/xx.js, перевести, подключить в index.html
   и добавить код в ORDER ниже. */
window.MARKET_I18N = (function () {
  const L = window.MARKET_LANG || {};
  const ORDER = ['ru', 'en', 'uk', 'be', 'kk', 'ky', 'uz', 'pl', 'de', 'fr', 'es', 'it', 'tr', 'zh', 'ar'];
  const LANGS = ORDER.filter(c => L[c]).map(c => ({ code: c, ...L[c].meta }));
  const has = c => !!L[c];

  // Автоопределение: navigator.languages → первый поддерживаемый язык, иначе английский
  function detect() {
    const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    for (const tag of list) {
      const p = String(tag).toLowerCase().split(/[-_]/)[0];
      if (has(p)) return p;
    }
    return 'en';
  }

  // Строки интерфейса: T.key (с фолбэком на английский, затем на русский, затем сам ключ)
  function get(lang) {
    const d = (L[lang] || L.en || L.ru).ui, en = (L.en || L.ru).ui, ru = (L.ru || L.en).ui;
    return new Proxy({}, { get: (_, k) => d[k] ?? en[k] ?? ru[k] ?? String(k) });
  }

  // Подстановка переменных: fmt('Осталось {n} шт.', {n: 3})
  const fmt = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

  // Множественное число: plural('ru', 'products', 5) → 'товаров'
  const prCache = {};
  function plural(lang, key, n) {
    const forms = ((L[lang] || L.en).plural || {})[key] || ((L.en || {}).plural || {})[key];
    if (!forms) return '';
    const locale = (L[lang] && L[lang].meta.locale) || lang;
    let cat = 'other';
    try { cat = (prCache[locale] ||= new Intl.PluralRules(locale)).select(n); } catch { /* старый браузер */ }
    return forms[cat] ?? forms.other ?? forms.many ?? Object.values(forms)[0];
  }

  // Переводы названий из данных (категории, подкатегории, теги, страны). Ключ — русское название/id.
  function name(lang, kind, key) {
    const own = (L[lang] || {})[kind] || {};
    if (own[key] != null) return own[key];
    if (lang !== 'ru' && lang !== 'en') { const en = (L.en || {})[kind] || {}; if (en[key] != null) return en[key]; }
    return key;
  }

  const meta = c => (L[c] || L.en).meta;
  const locale = c => meta(c).locale;
  const dir = c => meta(c).dir || 'ltr';

  return { LANGS, ORDER, has, detect, get, fmt, plural, name, meta, locale, dir, raw: L };
})();
