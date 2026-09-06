/* ===== GIGASAIT MARKET — данные: страны, категории, товары-заглушки =====
   Схема товара (под будущий импорт с Ozon / Wildberries / Яндекс Маркет):
   {
     id, title, brand, category, subcategory, tags[], price (в RUB), oldPrice,
     rating, reviews, country, description, images[], specs{}, source{site,url}
   }
*/
window.MARKET_DATA = (function () {

  const COUNTRIES = [
    { code: 'RU', name: 'Россия',     flag: '🇷🇺', currency: 'RUB', symbol: '₽',   rate: 1 },
    { code: 'KZ', name: 'Казахстан',  flag: '🇰🇿', currency: 'KZT', symbol: '₸',   rate: 5.4 },
    { code: 'BY', name: 'Беларусь',   flag: '🇧🇾', currency: 'BYN', symbol: 'Br',  rate: 0.035 },
    { code: 'UZ', name: 'Узбекистан', flag: '🇺🇿', currency: 'UZS', symbol: 'сум', rate: 135 },
    { code: 'KG', name: 'Кыргызстан', flag: '🇰🇬', currency: 'KGS', symbol: 'с',   rate: 0.95 }
  ];

  // Категории: id, название, иконка, подкатегории, теги, ценовой диапазон (RUB)
  const CATEGORIES = [
    { id: 'electronics', name: 'Электроника', icon: '📱', subs: ['Смартфоны', 'Ноутбуки', 'Наушники', 'Планшеты', 'Смарт-часы'], tags: ['хит', 'новинка', 'гарантия', '5G', 'быстрая зарядка'], price: [1500, 150000], brands: ['Samsung', 'Xiaomi', 'Apple', 'Honor', 'Realme', 'HUAWEI'] },
    { id: 'appliances', name: 'Бытовая техника', icon: '🔌', subs: ['Пылесосы', 'Кофемашины', 'Чайники', 'Микроволновки', 'Холодильники'], tags: ['экономия энергии', 'тихая работа', 'хит', 'гарантия 2 года'], price: [900, 90000], brands: ['Bosch', 'Polaris', 'Redmond', 'Dyson', 'Kitfort', 'LG'] },
    { id: 'fashion-women', name: 'Женщинам', icon: '👗', subs: ['Платья', 'Блузки', 'Джинсы', 'Верхняя одежда', 'Обувь'], tags: ['новинка', 'скидка', 'хлопок', 'oversize', 'тренд'], price: [500, 15000], brands: ['ZARINA', 'Befree', 'Sela', 'Gloria Jeans', 'Mango', 'Lime'] },
    { id: 'fashion-men', name: 'Мужчинам', icon: '👔', subs: ['Футболки', 'Рубашки', 'Брюки', 'Куртки', 'Кроссовки'], tags: ['хит', 'спорт', 'классика', 'хлопок', 'скидка'], price: [400, 18000], brands: ['Henderson', 'Finn Flare', 'Nike', 'Adidas', 'Ostin', 'Puma'] },
    { id: 'kids', name: 'Детям', icon: '🧸', subs: ['Игрушки', 'Одежда', 'Коляски', 'Конструкторы', 'Школа'], tags: ['безопасно', 'развитие', 'хит', '0+', '3+'], price: [200, 40000], brands: ['LEGO', 'Hasbro', 'Chicco', 'Happy Baby', 'Играем вместе', 'Barbie'] },
    { id: 'home', name: 'Дом и сад', icon: '🏡', subs: ['Постельное бельё', 'Посуда', 'Декор', 'Освещение', 'Инструменты'], tags: ['уют', 'эко', 'хит', 'ручная работа', 'скидка'], price: [150, 25000], brands: ['IKEA', 'Tefal', 'Luminarc', 'Bork', 'Домовой', 'Bombus'] },
    { id: 'beauty', name: 'Красота', icon: '💄', subs: ['Уход за лицом', 'Макияж', 'Парфюмерия', 'Уход за волосами', 'Маникюр'], tags: ['натуральный', 'без парабенов', 'хит', 'веган', 'новинка'], price: [150, 12000], brands: ["L'Oréal", 'Maybelline', 'Garnier', 'NIVEA', 'Vichy', 'Чистая линия'] },
    { id: 'health', name: 'Здоровье', icon: '💊', subs: ['Витамины', 'Массажёры', 'Тонометры', 'Ортопедия', 'Гигиена'], tags: ['сертифицировано', 'хит', 'для всей семьи', 'без сахара'], price: [100, 20000], brands: ['Solgar', 'Omron', 'Evalar', 'B.Well', 'Now Foods', 'Beurer'] },
    { id: 'sport', name: 'Спорт', icon: '🏋️', subs: ['Тренажёры', 'Фитнес', 'Велосипеды', 'Туризм', 'Спортивное питание'], tags: ['хит', 'профи', 'для дома', 'лёгкий', 'скидка'], price: [300, 80000], brands: ['Demix', 'Stels', 'Torneo', 'Nordway', 'Decathlon', 'Kettler'] },
    { id: 'auto', name: 'Автотовары', icon: '🚗', subs: ['Видеорегистраторы', 'Масла', 'Аксессуары', 'Шины', 'Автохимия'], tags: ['зима', 'лето', 'хит', 'универсальный', 'премиум'], price: [200, 45000], brands: ['Bosch', 'Mobil', '70mai', 'Nokian', 'Liqui Moly', 'Kenwood'] },
    { id: 'books', name: 'Книги', icon: '📚', subs: ['Художественная', 'Бизнес', 'Детские', 'Учебная', 'Комиксы'], tags: ['бестселлер', 'новинка', 'твёрдый переплёт', 'подарок'], price: [150, 4000], brands: ['Эксмо', 'АСТ', 'МИФ', 'Альпина', 'Росмэн', 'Азбука'] },
    { id: 'food', name: 'Продукты', icon: '🍫', subs: ['Сладости', 'Кофе и чай', 'Снеки', 'Крупы', 'Напитки'], tags: ['без сахара', 'органик', 'хит', 'халяль', 'веган'], price: [50, 5000], brands: ['Jacobs', 'Alpen Gold', 'Greenfield', 'Lay\'s', 'Мистраль', 'Milka'] },
    { id: 'pets', name: 'Зоотовары', icon: '🐾', subs: ['Корм для кошек', 'Корм для собак', 'Игрушки', 'Лежанки', 'Аквариумистика'], tags: ['премиум', 'хит', 'для котят', 'для щенков', 'гипоаллергенно'], price: [100, 15000], brands: ['Royal Canin', 'Purina', 'Whiskas', 'Pedigree', 'Brit', 'Trixie'] },
    { id: 'furniture', name: 'Мебель', icon: '🛋️', subs: ['Диваны', 'Столы', 'Стулья', 'Шкафы', 'Кровати'], tags: ['лофт', 'скандинавский', 'хит', 'массив', 'сборка включена'], price: [1500, 120000], brands: ['Hoff', 'Шатура', 'Askona', 'Divan.ru', 'Много Мебели', 'Столплит'] },
    { id: 'garden', name: 'Дача и ремонт', icon: '🛠️', subs: ['Электроинструмент', 'Сантехника', 'Краски', 'Садовая техника', 'Освещение'], tags: ['профи', 'хит', 'для дома', 'аккумуляторный', 'скидка'], price: [200, 60000], brands: ['Makita', 'Bosch', 'Интерскол', 'Gardena', 'Зубр', 'Tikkurila'] },
    { id: 'office', name: 'Канцелярия', icon: '✏️', subs: ['Ручки', 'Тетради', 'Органайзеры', 'Бумага', 'Рисование'], tags: ['школа', 'офис', 'хит', 'набор', 'эко'], price: [30, 6000], brands: ['Erich Krause', 'Brauberg', 'Pilot', 'Faber-Castell', 'Hatber', 'Parker'] },
    { id: 'gaming', name: 'Игры и консоли', icon: '🎮', subs: ['Консоли', 'Геймпады', 'Игры', 'Игровые кресла', 'Клавиатуры'], tags: ['хит', 'RGB', 'новинка', 'беспроводной', 'профи'], price: [500, 90000], brands: ['Sony', 'Microsoft', 'Logitech', 'Razer', 'HyperX', 'Nintendo'] },
    { id: 'jewelry', name: 'Украшения', icon: '💍', subs: ['Кольца', 'Серьги', 'Цепочки', 'Браслеты', 'Часы'], tags: ['серебро', 'золото', 'подарок', 'хит', 'фианит'], price: [300, 80000], brands: ['SOKOLOV', 'SUNLIGHT', 'Pandora', 'Casio', 'Swarovski', 'Якутские бриллианты'] },
    { id: 'bags', name: 'Сумки и аксессуары', icon: '👜', subs: ['Рюкзаки', 'Сумки', 'Кошельки', 'Ремни', 'Очки'], tags: ['кожа', 'хит', 'городской', 'водонепроницаемый', 'скидка'], price: [300, 30000], brands: ['Xiaomi', 'Samsonite', 'Guess', 'Wenger', 'Polar', 'Ray-Ban'] },
    { id: 'digital', name: 'Цифровые товары', icon: '💾', subs: ['Подписки', 'Игровые ключи', 'Программы', 'Курсы', 'Подарочные карты'], tags: ['моментально', 'хит', 'официально', 'скидка'], price: [100, 15000], brands: ['Steam', 'Microsoft', 'Adobe', 'Яндекс Плюс', 'Kaspersky', 'Skillbox'] }
  ];

  // Палитры для картинок-заглушек
  const PALETTES = [
    ['#7c5cff', '#ff5c8a'], ['#2dd4bf', '#7c5cff'], ['#ff9f43', '#ff5c8a'], ['#22c1c3', '#fdbb2d'],
    ['#4776e6', '#8e54e9'], ['#f857a6', '#ff5858'], ['#11998e', '#38ef7d'], ['#fc466b', '#3f5efb'],
    ['#00c6ff', '#0072ff'], ['#f7971e', '#ffd200'], ['#c471ed', '#f64f59'], ['#0f2027', '#2c5364']
  ];

  const ADJ = ['Премиум', 'Компактный', 'Классический', 'Профессиональный', 'Умный', 'Стильный', 'Базовый', 'Эргономичный', 'Ультра', 'Мини', 'Домашний', 'Универсальный'];
  const REVIEW_TEXTS = [
    'Отличное качество, полностью соответствует описанию. Рекомендую!',
    'Доставили быстро, упаковка целая. Пользуюсь неделю — всё нравится.',
    'Хорошее соотношение цены и качества. Брал уже второй раз.',
    'В целом неплохо, но ожидал большего за эти деньги.',
    'Супер! Подарок понравился, всё работает как надо.',
    'Есть небольшие недочёты, но за такую цену — отлично.',
    'Заказывал в другую страну — пришло за 5 дней. Доволен.',
    'Качество на высоте, буду заказывать ещё.'
  ];
  const REVIEW_NAMES = ['Алексей', 'Мария', 'Дмитрий', 'Айгерим', 'Ольга', 'Тимур', 'Анна', 'Нурлан', 'Иван', 'Дарья', 'Азиз', 'Екатерина'];

  // Детерминированный "рандом", чтобы товары были одинаковыми при каждой загрузке
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function placeholderImage(text, icon, palette, seed) {
    const [c1, c2] = palette;
    const angle = (seed * 37) % 360;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">` +
      `<defs><linearGradient id="g" gradientTransform="rotate(${angle})"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
      `<rect width="600" height="600" rx="40" fill="url(#g)"/>` +
      `<circle cx="${120 + (seed * 53) % 360}" cy="${100 + (seed * 71) % 300}" r="${140 + (seed * 13) % 80}" fill="rgba(255,255,255,.12)"/>` +
      `<text x="300" y="330" font-size="200" text-anchor="middle" dominant-baseline="middle">${icon}</text>` +
      `<text x="300" y="530" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="rgba(255,255,255,.9)" text-anchor="middle">${escapeXml(text)}</text>` +
      `</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function escapeXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Генерация товаров-заглушек: 20 категорий × 5 подкатегорий × 3 = 300 товаров, равномерно по 5 странам
  function generateProducts() {
    const rnd = mulberry32(20260905);
    const products = [];
    let id = 1;
    CATEGORIES.forEach((cat, ci) => {
      cat.subs.forEach((sub, si) => {
        for (let k = 0; k < 3; k++) {
          const brand = cat.brands[Math.floor(rnd() * cat.brands.length)];
          const adj = ADJ[Math.floor(rnd() * ADJ.length)];
          const model = String.fromCharCode(65 + Math.floor(rnd() * 26)) + Math.floor(100 + rnd() * 900);
          const [minP, maxP] = cat.price;
          const price = Math.round((minP + rnd() * (maxP - minP)) / 10) * 10;
          const hasDiscount = rnd() < 0.55;
          const oldPrice = hasDiscount ? Math.round(price * (1.1 + rnd() * 0.5) / 10) * 10 : null;
          const rating = Math.round((3.6 + rnd() * 1.4) * 10) / 10;
          const reviews = Math.floor(rnd() * 2400) + 3;
          const country = COUNTRIES[(id - 1) % COUNTRIES.length].code;
          const tagsCount = 1 + Math.floor(rnd() * 3);
          const tags = [...cat.tags].sort(() => rnd() - 0.5).slice(0, tagsCount);
          const palette = PALETTES[(ci * 7 + si * 3 + k) % PALETTES.length];
          const title = `${adj} ${sub.toLowerCase().replace(/ы$|и$/, '')} ${brand} ${model}`;
          const images = [0, 1, 2].map(n => placeholderImage(`${sub} • ${n + 1}`, cat.icon, palette, id * 3 + n));
          const revs = Array.from({ length: 3 }, (_, i) => ({
            name: REVIEW_NAMES[Math.floor(rnd() * REVIEW_NAMES.length)],
            rating: Math.min(5, Math.max(3, Math.round(rating + (rnd() - 0.5) * 2))),
            text: REVIEW_TEXTS[Math.floor(rnd() * REVIEW_TEXTS.length)],
            date: `2026-0${1 + Math.floor(rnd() * 8)}-${String(1 + Math.floor(rnd() * 27)).padStart(2, '0')}`
          }));
          products.push({
            id: id++,
            title,
            brand,
            category: cat.id,
            subcategory: sub,
            tags,
            price,
            oldPrice,
            rating,
            reviews,
            country,
            stock: 3 + Math.floor(rnd() * 200),
            isNew: rnd() < 0.2,
            description: `${title} — ${sub.toLowerCase()} от бренда ${brand} в категории «${cat.name}». Товар-заглушка: описание будет заменено на реальное при импорте каталога с Ozon, Wildberries и Яндекс Маркета. Надёжная сборка, современный дизайн и официальная гарантия производителя.`,
            specs: {
              'Бренд': brand,
              'Модель': model,
              'Категория': cat.name,
              'Подкатегория': sub,
              'Страна склада': COUNTRIES.find(c => c.code === country).name,
              'Гарантия': `${6 + 6 * Math.floor(rnd() * 4)} мес.`
            },
            images,
            reviewsList: revs,
            source: { site: 'placeholder', url: '' },
            createdAt: Date.now() - Math.floor(rnd() * 90) * 86400000
          });
        }
      });
    });
    return products;
  }

  return { COUNTRIES, CATEGORIES, generateProducts, placeholderImage };
})();
