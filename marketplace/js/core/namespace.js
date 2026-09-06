/* ===== GIGASAIT MARKET — общее пространство имён модулей =====
   Сайт — статические файлы без сборщика, поэтому модули подключаются обычными <script> в порядке
   зависимостей (см. index.html) и обмениваются функциями через window.APP.
   Каждый модуль: (function(){ const A = window.APP; const {…} = A; …; Object.assign(A, {…}); })(); */
window.APP = window.APP || {};
