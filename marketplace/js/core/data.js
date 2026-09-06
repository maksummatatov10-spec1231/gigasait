/* ===== GIGASAIT MARKET — Данные каталога: товары, категории, страны =====
   Модуль приложения. Общее пространство имён: window.APP (см. js/core/namespace.js). */
(function () {
  'use strict';
  const A = window.APP;

  const { COUNTRIES, CATEGORIES, generateProducts, placeholderImage } = window.MARKET_DATA;
  const I18N = window.MARKET_I18N;
  const TR = window.MARKET_TR || { text: s => Promise.resolve(s), list: a => Promise.resolve(a), cached: () => null, clear() {}, size: () => 0 };
  const FEATURED = (window.MARKET_FEATURED || []).map(p => normalizeProduct({ ...p, source: { site: 'featured', url: '' }, createdAt: Date.now() - (p.id % 20) * 86400000 }));
  const PRODUCTS = (window.MARKET_PRODUCTS && window.MARKET_PRODUCTS.length)
    ? window.MARKET_PRODUCTS.map(normalizeProduct)
    : [...FEATURED, ...generateProducts()];

  function normalizeProduct(p) {
    const images = (p.images && p.images.length) ? p.images : [placeholderImage(p.title || '', '🛍️', ['#7c5cff', '#ff5c8a'], p.id)];
    return {
      ...p,
      rating: p.rating || 4.5,
      reviews: p.reviews || 0,
      stock: p.stock || 10,
      tags: p.tags || [],
      colors: p.colors || [],
      specs: p.specs || {},
      images,
      thumb: p.thumb || images[0],
      description: p.description || '',
      reviewsList: p.reviewsList || [],
      createdAt: p.createdAt || (Date.now() - (p.id % 90) * 86400000),
      source: p.source || { site: 'placeholder', url: '' }
    };
  }
  const BY_ID = new Map(PRODUCTS.map(p => [p.id, p]));

  Object.assign(A, { COUNTRIES, CATEGORIES, generateProducts, placeholderImage, I18N, TR, FEATURED, PRODUCTS, normalizeProduct, BY_ID });
})();
