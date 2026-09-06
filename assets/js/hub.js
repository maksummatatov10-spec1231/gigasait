/* ===== GIGASAIT HUB — логика главного меню ===== */
(function () {
  const STORAGE_THEME = 'giga.theme';
  const STORAGE_LANG = 'giga.lang';

  const i18n = {
    ru: {
      kicker: 'Добро пожаловать в',
      subtitle: 'Один сайт — три мира. Выбери, куда отправиться.',
      market: 'Маркетплейс',
      marketDesc: 'Тысячи товаров, корзина, избранное, поиск по странам и категориям.',
      games: 'Игры',
      gamesDesc: 'Мини-игры прямо в браузере. Рекорды, таблицы лидеров и достижения.',
      community: 'Сообщество',
      communityDesc: 'Форум, чаты, профили и обсуждения. Общайся и делись идеями.',
      open: 'Открыть →',
      live: 'Доступно',
      soon: 'Скоро',
      statProducts: 'товаров',
      statLangs: 'языков',
      statCountries: 'стран',
      statOnline: 'онлайн'
    },
    en: {
      kicker: 'Welcome to',
      subtitle: 'One site — three worlds. Choose where to go.',
      market: 'Marketplace',
      marketDesc: 'Thousands of products, cart, favorites, search by country and category.',
      games: 'Games',
      gamesDesc: 'Mini-games right in your browser. Records, leaderboards and achievements.',
      community: 'Community',
      communityDesc: 'Forum, chats, profiles and discussions. Connect and share ideas.',
      open: 'Open →',
      live: 'Live',
      soon: 'Soon',
      statProducts: 'products',
      statLangs: 'languages',
      statCountries: 'countries',
      statOnline: 'online'
    }
  };

  const root = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');
  const langSel = document.getElementById('hubLang');

  // Тема
  const savedTheme = localStorage.getItem(STORAGE_THEME) ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  root.setAttribute('data-theme', savedTheme);
  themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_THEME, next);
  });

  // Язык
  function applyLang(lang) {
    const dict = i18n[lang] || i18n.ru;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });
    root.setAttribute('lang', lang);
    langSel.value = lang;
  }
  const savedLang = localStorage.getItem(STORAGE_LANG);
  applyLang(savedLang && i18n[savedLang] ? savedLang : 'ru');
  langSel.addEventListener('change', () => {
    localStorage.setItem(STORAGE_LANG, langSel.value);
    applyLang(langSel.value);
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
