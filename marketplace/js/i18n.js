/* ===== GIGASAIT MARKET — локализация =====
   Этап 1: русский и английский. Остальные языки добавим на этапе полировки —
   для этого достаточно добавить объект в D и запись в LANGS. */
window.MARKET_I18N = (function () {
  const LANGS = [
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', flag: '🇬🇧' }
  ];

  const D = {};

  D.ru = {
    searchPlaceholder: 'Искать товары, бренды, категории…', search: 'Найти', catalog: 'Каталог', favorites: 'Избранное',
    cart: 'Корзина', orders: 'Заказы', settings: 'Настройки', logout: 'Выйти', theme: 'Тема', allCategories: 'Все категории',
    allCountries: 'Все страны', country: 'Страна', deliverTo: 'Доставка в', sort: 'Сортировка', sortPopular: 'Популярные',
    sortNew: 'Новинки', sortPriceAsc: 'Сначала дешёвые', sortPriceDesc: 'Сначала дорогие', sortRating: 'По рейтингу',
    sortDiscount: 'По размеру скидки', price: 'Цена', from: 'от', to: 'до', tags: 'Теги', rating: 'Рейтинг', reviews: 'отзывов',
    addToCart: 'В корзину', inCart: 'В корзине', buyNow: 'Купить сейчас', remove: 'Удалить', found: 'Найдено',
    products: 'товаров', noResults: 'Ничего не найдено', noResultsHint: 'Попробуйте изменить запрос или сбросить фильтры',
    resetFilters: 'Сбросить фильтры', apply: 'Применить', cartTitle: 'Корзина', cartEmpty: 'Корзина пуста',
    cartEmptyHint: 'Добавьте товары из каталога', total: 'Итого', subtotal: 'Товары', delivery: 'Доставка', discount: 'Скидка',
    free: 'Бесплатно', checkout: 'Оформить заказ', clearCart: 'Очистить корзину', favTitle: 'Избранное',
    favEmpty: 'В избранном пока ничего нет', favEmptyHint: 'Нажмите ♥ на товаре, чтобы сохранить его', checkoutTitle: 'Оформление заказа',
    recipient: 'Получатель', fullName: 'Имя и фамилия', phone: 'Телефон', email: 'Email', address: 'Адрес доставки', city: 'Город',
    street: 'Улица, дом, квартира', postal: 'Индекс', deliveryMethod: 'Способ получения', pickup: 'Пункт выдачи', pickupHint: 'Бесплатно, 2–4 дня',
    courier: 'Курьером', courierHint: 'До двери, 1–3 дня', payment: 'Оплата', payNow: 'Оплатить сейчас', payNowHint: 'Картой онлайн',
    payOnDelivery: 'Оплата при получении', payOnDeliveryHint: 'Наличными или картой', cardNumber: 'Номер карты', cardExp: 'ММ/ГГ', cardCvc: 'CVC',
    cardHolder: 'Имя на карте', placeOrder: 'Подтвердить заказ', orderSuccess: 'Заказ оформлен!', orderNumber: 'Номер заказа',
    orderSuccessHint: 'Мы отправили подтверждение на вашу почту. Отследить заказ можно в разделе «Заказы».', continueShopping: 'Продолжить покупки',
    goToOrders: 'Мои заказы', ordersTitle: 'Мои заказы', ordersEmpty: 'Заказов пока нет', ordersEmptyHint: 'Оформите первый заказ — он появится здесь',
    status: 'Статус', statusProcessing: 'В обработке', statusPaid: 'Оплачен', statusAwaiting: 'Оплата при получении',
    statusShipped: 'В пути', statusDelivered: 'Доставлен', settingsTitle: 'Настройки', language: 'Язык сайта', currency: 'Валюта',
    profile: 'Профиль', save: 'Сохранить', saved: 'Сохранено', notifications: 'Уведомления', notifPromo: 'Акции и скидки',
    notifPromoHint: 'Получать письма о распродажах', notifOrders: 'Статус заказов', notifOrdersHint: 'Push-уведомления о доставке',
    dangerZone: 'Данные', clearData: 'Очистить все данные сайта', description: 'Описание', specs: 'Характеристики',
    customerReviews: 'Отзывы покупателей', similar: 'Похожие товары', inStock: 'В наличии', left: 'осталось', pcs: 'шт.',
    share: 'Поделиться', copied: 'Ссылка скопирована', addedToCart: 'Добавлено в корзину', addedToFav: 'Добавлено в избранное',
    removedFromFav: 'Удалено из избранного', backToHub: 'На главную GIGASAIT', home: 'Главная', new: 'Новинка', hit: 'Хит',
    promoTitle: 'Скидки до 50% каждый день', promoSub: 'Тысячи товаров из 5 стран с быстрой доставкой', promoBtn: 'Смотреть акции',
    popularCats: 'Популярные категории', bestsellers: 'Хиты продаж', newArrivals: 'Новинки', viewAll: 'Смотреть все',
    filters: 'Фильтры', qty: 'Кол-во', fillRequired: 'Заполните обязательные поля', invalidCard: 'Проверьте данные карты',
    promoCode: 'Промокод', promoApply: 'Применить', promoOk: 'Промокод применён', promoBad: 'Промокод не найден', showMore: 'Показать ещё',
    onlyDiscount: 'Только со скидкой', onlyNew: 'Только новинки', minRating: 'Рейтинг от', footerAbout: 'GIGASAIT Market — учебный проект маркетплейса.',
    footerHelp: 'Помощь', footerDelivery: 'Доставка и оплата', footerReturns: 'Возврат', footerContacts: 'Контакты',
    demoNotice: 'Демо-режим: оплата и доставка имитируются, реальные деньги не списываются.',
    confirmClear: 'Очистить все данные (корзина, избранное, заказы, настройки)?', payFake: 'Оплата прошла успешно (демо)',
    all: 'Все', categoriesTitle: 'Категории', selected: 'выбрано', searchResults: 'Результаты поиска', shipFrom: 'Склад',
    deliveryTime: 'Доставка 1–4 дня', returns: 'Возврат 14 дней', warranty: 'Официальная гарантия', dark: 'Тёмная', light: 'Светлая',
    themeTitle: 'Оформление', addressSaved: 'Адрес сохранён', defaultAddress: 'Адрес по умолчанию', deliveryCountry: 'Страна доставки',
    processing: 'Обработка…', brand: 'Бренд', inFav: 'В избранном', seeAllProducts: 'Все товары', paidNow: 'Оплачено онлайн',
    payLater: 'К оплате при получении', comment: 'Комментарий к заказу', optional: 'необязательно', shortName: 'Имя',
    promoHint: 'Попробуйте GIGA10, GIGA20 или FREE', source: 'Источник', featured: 'Витрина: реальные товары', noReviews: 'Отзывов пока нет — станьте первым!', currencyHint: 'Цены пересчитываются автоматически по выбранной стране'
  };

  D.en = {
    searchPlaceholder: 'Search products, brands, categories…', search: 'Search', catalog: 'Catalog', favorites: 'Favorites',
    cart: 'Cart', orders: 'Orders', settings: 'Settings', logout: 'Log out', theme: 'Theme', allCategories: 'All categories',
    allCountries: 'All countries', country: 'Country', deliverTo: 'Deliver to', sort: 'Sort', sortPopular: 'Popular',
    sortNew: 'Newest', sortPriceAsc: 'Price: low to high', sortPriceDesc: 'Price: high to low', sortRating: 'Top rated',
    sortDiscount: 'Biggest discount', price: 'Price', from: 'from', to: 'to', tags: 'Tags', rating: 'Rating', reviews: 'reviews',
    addToCart: 'Add to cart', inCart: 'In cart', buyNow: 'Buy now', remove: 'Remove', found: 'Found',
    products: 'products', noResults: 'Nothing found', noResultsHint: 'Try another query or reset the filters',
    resetFilters: 'Reset filters', apply: 'Apply', cartTitle: 'Cart', cartEmpty: 'Your cart is empty',
    cartEmptyHint: 'Add products from the catalog', total: 'Total', subtotal: 'Items', delivery: 'Delivery', discount: 'Discount',
    free: 'Free', checkout: 'Checkout', clearCart: 'Clear cart', favTitle: 'Favorites',
    favEmpty: 'No favorites yet', favEmptyHint: 'Tap ♥ on a product to save it', checkoutTitle: 'Checkout',
    recipient: 'Recipient', fullName: 'Full name', phone: 'Phone', email: 'Email', address: 'Delivery address', city: 'City',
    street: 'Street, building, apt.', postal: 'Postal code', deliveryMethod: 'Delivery method', pickup: 'Pickup point', pickupHint: 'Free, 2–4 days',
    courier: 'Courier', courierHint: 'To your door, 1–3 days', payment: 'Payment', payNow: 'Pay now', payNowHint: 'Card online',
    payOnDelivery: 'Pay on delivery', payOnDeliveryHint: 'Cash or card', cardNumber: 'Card number', cardExp: 'MM/YY', cardCvc: 'CVC',
    cardHolder: 'Name on card', placeOrder: 'Place order', orderSuccess: 'Order placed!', orderNumber: 'Order number',
    orderSuccessHint: 'We sent a confirmation to your email. Track it in the Orders section.', continueShopping: 'Continue shopping',
    goToOrders: 'My orders', ordersTitle: 'My orders', ordersEmpty: 'No orders yet', ordersEmptyHint: 'Place your first order — it will appear here',
    status: 'Status', statusProcessing: 'Processing', statusPaid: 'Paid', statusAwaiting: 'Pay on delivery',
    statusShipped: 'Shipped', statusDelivered: 'Delivered', settingsTitle: 'Settings', language: 'Site language', currency: 'Currency',
    profile: 'Profile', save: 'Save', saved: 'Saved', notifications: 'Notifications', notifPromo: 'Deals & discounts',
    notifPromoHint: 'Receive emails about sales', notifOrders: 'Order status', notifOrdersHint: 'Push notifications about delivery',
    dangerZone: 'Data', clearData: 'Clear all site data', description: 'Description', specs: 'Specifications',
    customerReviews: 'Customer reviews', similar: 'Similar products', inStock: 'In stock', left: 'left', pcs: 'pcs',
    share: 'Share', copied: 'Link copied', addedToCart: 'Added to cart', addedToFav: 'Added to favorites',
    removedFromFav: 'Removed from favorites', backToHub: 'Back to GIGASAIT', home: 'Home', new: 'New', hit: 'Hit',
    promoTitle: 'Up to 50% off every day', promoSub: 'Thousands of products from 5 countries with fast delivery', promoBtn: 'See deals',
    popularCats: 'Popular categories', bestsellers: 'Bestsellers', newArrivals: 'New arrivals', viewAll: 'View all',
    filters: 'Filters', qty: 'Qty', fillRequired: 'Please fill in the required fields', invalidCard: 'Check your card details',
    promoCode: 'Promo code', promoApply: 'Apply', promoOk: 'Promo code applied', promoBad: 'Promo code not found', showMore: 'Show more',
    onlyDiscount: 'Discounted only', onlyNew: 'New only', minRating: 'Rating from', footerAbout: 'GIGASAIT Market — an educational marketplace project.',
    footerHelp: 'Help', footerDelivery: 'Delivery & payment', footerReturns: 'Returns', footerContacts: 'Contacts',
    demoNotice: 'Demo mode: payment and delivery are simulated, no real money is charged.',
    confirmClear: 'Clear all data (cart, favorites, orders, settings)?', payFake: 'Payment successful (demo)',
    all: 'All', categoriesTitle: 'Categories', selected: 'selected', searchResults: 'Search results', shipFrom: 'Warehouse',
    deliveryTime: 'Delivery 1–4 days', returns: '14-day returns', warranty: 'Official warranty', dark: 'Dark', light: 'Light',
    themeTitle: 'Appearance', addressSaved: 'Address saved', defaultAddress: 'Default address', deliveryCountry: 'Delivery country',
    processing: 'Processing…', brand: 'Brand', inFav: 'In favorites', seeAllProducts: 'All products', paidNow: 'Paid online',
    payLater: 'Due on delivery', comment: 'Order comment', optional: 'optional', shortName: 'Name',
    promoHint: 'Try GIGA10, GIGA20 or FREE', source: 'Source', featured: 'Showcase: real products', noReviews: 'No reviews yet — be the first!', currencyHint: 'Prices are converted automatically based on the selected country'
  };

  // Названия категорий и стран на английском (для переключения языка)
  const CATS_EN = {
    electronics: 'Electronics', appliances: 'Appliances', 'fashion-women': 'Women', 'fashion-men': 'Men', kids: 'Kids',
    home: 'Home & Garden', beauty: 'Beauty', health: 'Health', sport: 'Sport', auto: 'Auto', books: 'Books', food: 'Grocery',
    pets: 'Pets', furniture: 'Furniture', garden: 'DIY & Repair', office: 'Stationery', gaming: 'Games & Consoles',
    jewelry: 'Jewelry', bags: 'Bags & Accessories', digital: 'Digital goods'
  };
  const COUNTRIES_EN = { RU: 'Russia', KZ: 'Kazakhstan', BY: 'Belarus', UZ: 'Uzbekistan', KG: 'Kyrgyzstan' };

  function get(lang) {
    const dict = D[lang] || D.ru;
    return new Proxy({}, { get: (_, key) => dict[key] ?? D.ru[key] ?? String(key) });
  }

  return { LANGS, get, dict: D, CATS_EN, COUNTRIES_EN };
})();
