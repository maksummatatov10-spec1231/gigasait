/* ===== GIGASAIT HUB — логика главного меню =====
   v0.6.0: 15 языков с автоопределением по браузеру; язык и тема хранятся в localStorage
   (giga.lang / giga.theme, строкой) и общие для хаба, маркетплейса, игр и сообщества. */
(function () {
  const STORAGE_THEME = 'giga.theme';
  const STORAGE_LANG = 'giga.lang';
  const STORAGE_AUTO = 'giga.langAuto';

  const LANGS = [
    ['ru', '🇷🇺', 'Русский'], ['en', '🇬🇧', 'English'], ['uk', '🇺🇦', 'Українська'], ['be', '🇧🇾', 'Беларуская'],
    ['kk', '🇰🇿', 'Қазақша'], ['ky', '🇰🇬', 'Кыргызча'], ['uz', '🇺🇿', 'Oʻzbekcha'], ['pl', '🇵🇱', 'Polski'],
    ['de', '🇩🇪', 'Deutsch'], ['fr', '🇫🇷', 'Français'], ['es', '🇪🇸', 'Español'], ['it', '🇮🇹', 'Italiano'],
    ['tr', '🇹🇷', 'Türkçe'], ['zh', '🇨🇳', '中文'], ['ar', '🇸🇦', 'العربية']
  ];
  const RTL = ['ar'];

  // kicker, subtitle, market, marketDesc, games, gamesDesc, community, communityDesc, open, live, soon, statProducts, statLangs, statCountries, statOnline, auto, theme
  const i18n = {
    ru: ['Добро пожаловать в', 'Один сайт — три мира. Выбери, куда отправиться.', 'Маркетплейс', 'Сотни реальных товаров, корзина, избранное, сравнение, поиск по странам и категориям.', 'Игры', 'Мини-игры прямо в браузере. Рекорды, таблицы лидеров и достижения.', 'Сообщество', 'Форум, чаты, профили и обсуждения. Общайся и делись идеями.', 'Открыть →', 'Доступно', 'Скоро', 'товаров', 'языков', 'стран', 'онлайн', 'Авто', 'Сменить тему'],
    en: ['Welcome to', 'One site — three worlds. Choose where to go.', 'Marketplace', 'Hundreds of real products, cart, favorites, comparison, search by country and category.', 'Games', 'Mini-games right in your browser. Records, leaderboards and achievements.', 'Community', 'Forum, chats, profiles and discussions. Connect and share ideas.', 'Open →', 'Live', 'Soon', 'products', 'languages', 'countries', 'online', 'Auto', 'Toggle theme'],
    uk: ['Ласкаво просимо до', 'Один сайт — три світи. Обери, куди вирушити.', 'Маркетплейс', 'Сотні реальних товарів, кошик, обране, порівняння, пошук за країнами та категоріями.', 'Ігри', 'Міні-ігри просто в браузері. Рекорди, таблиці лідерів і досягнення.', 'Спільнота', 'Форум, чати, профілі та обговорення. Спілкуйся та ділись ідеями.', 'Відкрити →', 'Доступно', 'Незабаром', 'товарів', 'мов', 'країн', 'онлайн', 'Авто', 'Змінити тему'],
    be: ['Сардэчна запрашаем у', 'Адзін сайт — тры светы. Абяры, куды адправіцца.', 'Маркетплэйс', 'Сотні рэальных тавараў, кошык, абранае, параўнанне, пошук па краінах і катэгорыях.', 'Гульні', 'Міні-гульні прама ў браўзеры. Рэкорды, табліцы лідараў і дасягненні.', 'Супольнасць', 'Форум, чаты, профілі і абмеркаванні. Размаўляй і дзяліся ідэямі.', 'Адкрыць →', 'Даступна', 'Хутка', 'тавараў', 'моў', 'краін', 'анлайн', 'Аўта', 'Змяніць тэму'],
    kk: ['Қош келдіңіз:', 'Бір сайт — үш әлем. Қайда баратыныңызды таңдаңыз.', 'Маркетплейс', 'Жүздеген нақты тауар, себет, таңдаулылар, салыстыру, ел мен санат бойынша іздеу.', 'Ойындар', 'Браузердегі шағын ойындар. Рекордтар, көшбасшылар кестесі және жетістіктер.', 'Қауымдастық', 'Форум, чаттар, профильдер және талқылаулар. Пікірлесіңіз және идеялармен бөлісіңіз.', 'Ашу →', 'Қолжетімді', 'Жақында', 'тауар', 'тіл', 'ел', 'онлайн', 'Авто', 'Тақырыпты ауыстыру'],
    ky: ['Кош келиңиз:', 'Бир сайт — үч дүйнө. Кайда барарыңызды тандаңыз.', 'Маркетплейс', 'Жүздөгөн чыныгы товар, себет, тандалмалар, салыштыруу, өлкө жана категория боюнча издөө.', 'Оюндар', 'Браузердеги мини-оюндар. Рекорддор, лидерлер таблицасы жана жетишкендиктер.', 'Коомчулук', 'Форум, чаттар, профилдер жана талкуулар. Баарлашып, идеялар менен бөлүшүңүз.', 'Ачуу →', 'Жеткиликтүү', 'Жакында', 'товар', 'тил', 'өлкө', 'онлайн', 'Авто', 'Теманы алмаштыруу'],
    uz: ['Xush kelibsiz:', 'Bitta sayt — uchta olam. Qayerga borishni tanlang.', 'Marketpleys', 'Yuzlab haqiqiy mahsulotlar, savat, sevimlilar, taqqoslash, mamlakat va toifa boʻyicha qidiruv.', 'Oʻyinlar', 'Brauzerdagi mini-oʻyinlar. Rekordlar, yetakchilar jadvali va yutuqlar.', 'Hamjamiyat', 'Forum, chatlar, profillar va muhokamalar. Muloqot qiling va gʻoyalar bilan boʻlishing.', 'Ochish →', 'Mavjud', 'Tez orada', 'mahsulot', 'til', 'mamlakat', 'onlayn', 'Avto', 'Mavzuni almashtirish'],
    pl: ['Witaj w', 'Jedna strona — trzy światy. Wybierz, dokąd chcesz się udać.', 'Marketplace', 'Setki prawdziwych produktów, koszyk, ulubione, porównanie, wyszukiwanie według krajów i kategorii.', 'Gry', 'Mini-gry prosto w przeglądarce. Rekordy, rankingi i osiągnięcia.', 'Społeczność', 'Forum, czaty, profile i dyskusje. Rozmawiaj i dziel się pomysłami.', 'Otwórz →', 'Dostępne', 'Wkrótce', 'produktów', 'języków', 'krajów', 'online', 'Auto', 'Zmień motyw'],
    de: ['Willkommen bei', 'Eine Seite — drei Welten. Wähle, wohin du gehen möchtest.', 'Marktplatz', 'Hunderte echte Produkte, Warenkorb, Favoriten, Vergleich, Suche nach Ländern und Kategorien.', 'Spiele', 'Minispiele direkt im Browser. Rekorde, Bestenlisten und Erfolge.', 'Community', 'Forum, Chats, Profile und Diskussionen. Vernetze dich und teile Ideen.', 'Öffnen →', 'Verfügbar', 'Bald', 'Produkte', 'Sprachen', 'Länder', 'online', 'Auto', 'Design wechseln'],
    fr: ['Bienvenue sur', 'Un site — trois mondes. Choisissez votre destination.', 'Marketplace', 'Des centaines de vrais produits, panier, favoris, comparaison, recherche par pays et catégorie.', 'Jeux', 'Mini-jeux directement dans le navigateur. Records, classements et succès.', 'Communauté', 'Forum, chats, profils et discussions. Échangez et partagez vos idées.', 'Ouvrir →', 'Disponible', 'Bientôt', 'produits', 'langues', 'pays', 'en ligne', 'Auto', 'Changer de thème'],
    es: ['Bienvenido a', 'Un sitio — tres mundos. Elige adónde ir.', 'Marketplace', 'Cientos de productos reales, carrito, favoritos, comparación, búsqueda por país y categoría.', 'Juegos', 'Minijuegos directamente en el navegador. Récords, clasificaciones y logros.', 'Comunidad', 'Foro, chats, perfiles y debates. Conecta y comparte ideas.', 'Abrir →', 'Disponible', 'Pronto', 'productos', 'idiomas', 'países', 'en línea', 'Auto', 'Cambiar tema'],
    it: ['Benvenuto su', 'Un sito — tre mondi. Scegli dove andare.', 'Marketplace', 'Centinaia di prodotti reali, carrello, preferiti, confronto, ricerca per paese e categoria.', 'Giochi', 'Mini-giochi direttamente nel browser. Record, classifiche e obiettivi.', 'Community', 'Forum, chat, profili e discussioni. Connettiti e condividi idee.', 'Apri →', 'Disponibile', 'Presto', 'prodotti', 'lingue', 'paesi', 'online', 'Auto', 'Cambia tema'],
    tr: ['Hoş geldiniz:', 'Tek site — üç dünya. Nereye gideceğini seç.', 'Pazar yeri', 'Yüzlerce gerçek ürün, sepet, favoriler, karşılaştırma, ülke ve kategoriye göre arama.', 'Oyunlar', 'Tarayıcıda mini oyunlar. Rekorlar, liderlik tabloları ve başarılar.', 'Topluluk', 'Forum, sohbetler, profiller ve tartışmalar. İletişim kur ve fikirlerini paylaş.', 'Aç →', 'Kullanılabilir', 'Yakında', 'ürün', 'dil', 'ülke', 'çevrimiçi', 'Otomatik', 'Temayı değiştir'],
    zh: ['欢迎来到', '一个网站，三个世界。选择你的目的地。', '商城', '数百款真实商品、购物车、收藏、对比、按国家和分类搜索。', '游戏', '浏览器里的小游戏。纪录、排行榜和成就。', '社区', '论坛、聊天、个人资料和讨论。交流并分享想法。', '打开 →', '可用', '即将推出', '件商品', '种语言', '个国家', '在线', '自动', '切换主题'],
    ar: ['مرحبًا بك في', 'موقع واحد — ثلاثة عوالم. اختر وجهتك.', 'المتجر', 'مئات المنتجات الحقيقية، سلة، مفضلة، مقارنة، بحث حسب الدولة والفئة.', 'الألعاب', 'ألعاب مصغّرة داخل المتصفح. أرقام قياسية ولوحات صدارة وإنجازات.', 'المجتمع', 'منتدى ودردشات وملفات شخصية ونقاشات. تواصل وشارك أفكارك.', 'فتح →', 'متاح', 'قريبًا', 'منتج', 'لغة', 'دول', 'متصل', 'تلقائي', 'تبديل السمة']
  };
  const KEYS = ['kicker', 'subtitle', 'market', 'marketDesc', 'games', 'gamesDesc', 'community', 'communityDesc', 'open', 'live', 'soon', 'statProducts', 'statLangs', 'statCountries', 'statOnline', 'auto', 'theme'];
  const dict = code => Object.fromEntries(KEYS.map((k, i) => [k, i18n[code][i]]));

  function readStr(key) {
    let v = localStorage.getItem(key);
    if (v && v[0] === '"') { try { v = JSON.parse(v); } catch (e) { /* ignore */ } }
    return v;
  }
  function detect() {
    const cands = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ru']).map(s => String(s).toLowerCase());
    for (const c of cands) { const base = c.split(/[-_]/)[0]; if (i18n[base]) return base; }
    return 'ru';
  }

  const root = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');
  const langSel = document.getElementById('hubLang');

  // Тема
  let savedTheme = readStr(STORAGE_THEME);
  if (savedTheme !== 'light' && savedTheme !== 'dark') savedTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.setAttribute('data-theme', savedTheme);
  themeBtn.setAttribute('aria-checked', savedTheme === 'light');
  themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    themeBtn.setAttribute('aria-checked', next === 'light');
    localStorage.setItem(STORAGE_THEME, next);
  });

  // Язык
  function applyLang(lang, auto) {
    const d = dict(i18n[lang] ? lang : 'ru');
    document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (d[k]) el.textContent = d[k]; });
    root.setAttribute('lang', lang);
    root.setAttribute('dir', RTL.includes(lang) ? 'rtl' : 'ltr');
    themeBtn.title = d.theme; themeBtn.setAttribute('aria-label', d.theme);
    langSel.querySelector('option[value=auto]').textContent = '🌍 ' + d.auto + ' (' + detect().toUpperCase() + ')';
    langSel.value = auto ? 'auto' : lang;
    document.getElementById('langCount').textContent = LANGS.length;
  }
  langSel.innerHTML = '<option value="auto"></option>' + LANGS.map(([c, f, n]) => `<option value="${c}">${f} ${n}</option>`).join('');
  let lang = readStr(STORAGE_LANG), auto = readStr(STORAGE_AUTO) === 'true';
  if (!lang || !i18n[lang]) { lang = detect(); auto = true; localStorage.setItem(STORAGE_LANG, lang); localStorage.setItem(STORAGE_AUTO, 'true'); }
  applyLang(lang, auto);
  langSel.addEventListener('change', () => {
    const v = langSel.value;
    const isAuto = v === 'auto';
    const code = isAuto ? detect() : v;
    localStorage.setItem(STORAGE_LANG, code);
    localStorage.setItem(STORAGE_AUTO, isAuto ? 'true' : 'false');
    applyLang(code, isAuto);
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
