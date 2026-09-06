#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GIGASAIT — универсальный импортёр товаров (v3): Wildberries + Яндекс Маркет + Ozon.

Идея: у каждого магазина несколько независимых способов получить список товаров.
Скрипт перебирает их по очереди и переключается на следующий, как только один
начинает отвечать 429 / капчей / пустой страницей. Поэтому «бесконечный 429» одного
адреса больше не останавливает импорт.

  WILDBERRIES (5 способов)
    wb.recom    recom.wb.ru/personal/.../search    — «личный» поиск, почти не лимитируется
    wb.cards    card.wb.ru/cards/v4/detail          — карточки по списку артикулов (seed-ids из конфига / ids.txt)
    wb.seller   catalog.wb.ru/sellers/v4/catalog    — весь ассортимент проверенных продавцов
    wb.catalog  catalog.wb.ru/catalog/<shard>/v4    — каталог по subject-id (id берётся из меню WB автоматически)
    wb.search   search.wb.ru/.../v4|v5              — обычный поиск (самый лимитируемый, идёт последним)
    описание/характеристики/фото — CDN basket-NN.wbbasket.ru (лимитов нет)

  ЯНДЕКС МАРКЕТ (2 способа)
    ym.search   market.yandex.ru/search?text=…      — HTML страницы выдачи, внутри JSON SearchSchemaOrg
    ym.category market.yandex.ru/category/<slug>    — то же по слагу категории (если задан в конфиге)

  OZON (1 способ, работает только с cookies браузера — у Ozon жёсткий антибот)
    oz.search   ozon.ru/api/composer-api.bx/page/json/v2?url=/search/?text=…

Результат ОДИНАКОВЫЙ для всех источников:
  marketplace/products/<категория>/<id>/
      1.webp|jpg, 2.…      картинки
      product.json         все данные
      описание.txt         то же читаемым текстом
  marketplace/js/products.js — единый каталог для сайта (собирается в конце).

Запуск (Windows: двойной клик по import_all.bat, либо в консоли):
  python import_all.py                        # всё: 20 категорий × 25 товаров = 500
  python import_all.py --source ym            # только Яндекс Маркет
  python import_all.py --source wb,ym         # порядок источников
  python import_all.py --cat food --limit 2   # быстрая проверка
  python import_all.py --delay 15             # медленнее (если провайдер/ IP уже «под колпаком»)
  python import_all.py --cookies cookies.txt  # cookies из браузера (нужно для Ozon, помогает WB/ЯМ)
  python import_all.py --proxy http://user:pass@host:port
  python import_all.py --build-only           # только пересобрать products.js

Скрипт идемпотентный: скачанное пропускается, можно прерывать (Ctrl+C) и запускать снова —
он добирает недостающее. Нужен только Python 3.8+ (стандартная библиотека).
"""
import argparse, json, os, re, sys, time, random, threading, shutil, http.cookiejar
import urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

VERSION = '3.1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG_PATH = os.path.join(ROOT, 'tools', 'import_config.json')
IDS_PATH = os.path.join(ROOT, 'tools', 'ids.txt')
OUT_DIR = os.path.join(ROOT, 'marketplace', 'products')
JS_OUT = os.path.join(ROOT, 'marketplace', 'js', 'products.js')
BASKET_CACHE = os.path.join(ROOT, 'tools', '.basket_cache.json')
MENU_CACHE = os.path.join(ROOT, 'tools', '.wb_menu.json')
STATE_PATH = os.path.join(ROOT, 'tools', '.import_state.json')
COUNTRIES = ['RU', 'KZ', 'BY', 'UZ', 'KG']

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
WB_Q = 'appType=1&curr=rub&dest=-1257786&spp=30'
CDN_WORKERS = 6

_print_lock = threading.Lock()


def log(*a):
    with _print_lock:
        print(*a, flush=True)


# =====================================================================================
#  HTTP: один общий слой (прокси, cookies, определение блокировок)
# =====================================================================================
class Blocked(Exception):
    """429 / капча / пустой html вместо JSON — источник надо охладить."""
    def __init__(self, why, url='', retry_after=None):
        super().__init__(f'{why}: {url}')
        self.why, self.retry_after = why, retry_after


class HttpError(Exception):
    def __init__(self, code, url):
        super().__init__(f'HTTP {code}: {url}')
        self.code = code


OPTS = {'proxy': None, 'cookies': {}}   # cookies: {'wb': 'a=b; c=d', 'ym': ..., 'oz': ...}
_opener = None


def opener():
    global _opener
    if _opener is None:
        handlers = [urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())]
        if OPTS['proxy']:
            handlers.append(urllib.request.ProxyHandler({'http': OPTS['proxy'], 'https': OPTS['proxy']}))
        _opener = urllib.request.build_opener(*handlers)
    return _opener


def site_of(url):
    h = urllib.parse.urlsplit(url).netloc
    if 'wb.ru' in h or 'wildberries' in h or 'wbbasket' in h:
        return 'wb'
    if 'yandex' in h:
        return 'ym'
    if 'ozon' in h:
        return 'oz'
    return ''


def http_get(url, timeout=25, binary=False, html=False, extra=None):
    """GET. 404 -> None. 429/403-капча -> Blocked. Прочие коды -> HttpError."""
    site = site_of(url)
    h = {'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.7',
         'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8' if html else 'application/json, text/plain, */*'}
    if site == 'wb':
        h.update({'Origin': 'https://www.wildberries.ru', 'Referer': 'https://www.wildberries.ru/'})
    elif site == 'ym':
        h.update({'Referer': 'https://market.yandex.ru/', 'Upgrade-Insecure-Requests': '1'})
    elif site == 'oz':
        h.update({'Referer': 'https://www.ozon.ru/', 'x-o3-app-name': 'dweb_client', 'x-o3-app-version': 'release'})
    if OPTS['cookies'].get(site):
        h['Cookie'] = OPTS['cookies'][site]
    if extra:
        h.update(extra)
    req = urllib.request.Request(url, headers=h)
    try:
        with opener().open(req, timeout=timeout) as r:
            data = r.read()
            final = r.geturl() or url
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        if e.code in (429, 403, 401, 412, 418, 503):
            ra = None
            try:
                ra = float(e.headers.get('Retry-After') or 0) or None
            except Exception:
                pass
            raise Blocked(f'HTTP {e.code}', url, ra)
        raise HttpError(e.code, url)
    if binary:
        return data
    txt = data.decode('utf-8', 'replace')
    if 'showcaptcha' in final or 'captcha' in final:
        raise Blocked('captcha', url)
    if not html:
        s = txt.lstrip()[:200].lower()
        if s.startswith('<!doctype') or s.startswith('<html'):
            raise Blocked('html-instead-of-json', url)
        if '"incidentid"' in s or 'challenge' in s[:120] and 'ozon' in url:
            raise Blocked('antibot', url)
    return txt


def http_get_retry(url, retries=3, timeout=25, binary=False):
    last = None
    for i in range(retries):
        try:
            return http_get(url, timeout=timeout, binary=binary)
        except Blocked as e:
            last = e
            time.sleep(min(e.retry_after or 0, 30) or 3 * (i + 1))
        except Exception as e:
            last = e
            time.sleep(0.8 * (i + 1) + random.random() * 0.5)
    raise RuntimeError(f'GET failed {url}: {last}')


# =====================================================================================
#  Endpoint: троттлинг + «предохранитель» (cooldown после блокировок)
# =====================================================================================
class Endpoint:
    def __init__(self, name, interval, cool=90, max_cool=600):
        self.name, self.interval, self.cool, self.max_cool = name, interval, cool, max_cool
        self.last = 0.0
        self.until = 0.0          # охлаждён до этого времени
        self.fails = 0
        self.ok = 0
        self.lock = threading.Lock()

    def available(self):
        return time.time() >= self.until

    def wait(self):
        with self.lock:
            delta = self.last + self.interval * OPTS.get('delay_mult', 1.0) - time.time()
            if delta > 0:
                time.sleep(delta + random.random() * 0.5)
            self.last = time.time()

    def blocked(self, e):
        self.fails += 1
        pause = min(self.max_cool, max(e.retry_after or 0, self.cool * self.fails))
        self.until = time.time() + pause
        log(f'     ⏸ {self.name}: {e.why} — отдыхает {pause:.0f} c')

    def success(self):
        self.ok += 1
        self.fails = max(0, self.fails - 1) if self.ok % 5 == 0 else self.fails


EP = {
    'wb.recom':   Endpoint('wb.recom', 2, cool=60),
    'wb.cards':   Endpoint('wb.cards', 1.5, cool=60),
    'wb.seller':  Endpoint('wb.seller', 3, cool=60),
    'wb.catalog': Endpoint('wb.catalog', 5, cool=120),
    'wb.search':  Endpoint('wb.search', 6, cool=150),
    'ym':         Endpoint('ym', 2.5, cool=180),
    'oz':         Endpoint('oz', 4, cool=240),
}


def call(ep_name, url, **kw):
    """Запрос через endpoint с троттлингом; Blocked -> охлаждение и проброс."""
    ep = EP[ep_name]
    if not ep.available():
        raise Blocked('cooldown', url)
    ep.wait()
    try:
        r = http_get(url, **kw)
    except Blocked as e:
        ep.blocked(e)
        raise
    ep.success()
    return r


# =====================================================================================
#  Общий формат «найденного товара» (до скачивания карточки)
#  {src, id, root, name, brand, price, oldPrice, rating, feedbacks, pics, supplier,
#   colors, stock, isNew, image(s) (для ym/oz), description (ym/oz), url}
# =====================================================================================
def wb_items(prods):
    out = []
    for p in prods or []:
        price = old = None
        for s in p.get('sizes') or []:
            pr = s.get('price') or {}
            if pr.get('product'):
                price, old = pr['product'] / 100, (pr.get('basic') or 0) / 100
                break
        if not price and p.get('salePriceU'):
            price, old = p['salePriceU'] / 100, (p.get('priceU') or 0) / 100
        if not price or not p.get('id'):
            continue
        out.append({
            'src': 'wb', 'id': int(p['id']), 'root': p.get('root'), 'name': (p.get('name') or '').strip(),
            'brand': (p.get('brand') or '').strip(), 'price': round(price),
            'oldPrice': round(old) if old and old > price * 1.02 else None,
            'rating': p.get('reviewRating') or p.get('rating') or 0, 'feedbacks': p.get('feedbacks') or 0,
            'pics': p.get('pics') or 1, 'supplier': p.get('supplier') or '',
            'colors': [c.get('name') for c in (p.get('colors') or []) if c.get('name')],
            'stock': p.get('totalQuantity') or 0, 'isNew': bool(p.get('isNew')),
            'subjectId': p.get('subjectId'),
        })
    return out


def wb_json_products(txt):
    if not txt:
        return []
    try:
        data = json.loads(txt)
    except Exception:
        raise Blocked('bad-json')
    if isinstance(data, dict):
        return data.get('products') or (data.get('data') or {}).get('products') or []
    return []


# ---------- WB: меню категорий -> subject id / shard (для recom и catalog) ----------
_menu_leafs = None
STOP = {'для', 'и', 'в', 'на', 'с', 'из', 'по', 'набор', 'комплект'}


def stems(s):
    return {w[:5] for w in re.findall(r'[a-zа-яё0-9]+', (s or '').lower()) if w not in STOP and len(w) > 1}


def wb_menu():
    global _menu_leafs
    if _menu_leafs is not None:
        return _menu_leafs
    tree = None
    try:
        with open(MENU_CACHE, encoding='utf-8') as f:
            tree = json.load(f)
    except Exception:
        pass
    if not tree:
        try:
            txt = http_get('https://static-basket-01.wbbasket.ru/vol0/data/main-menu-ru-ru-v3.json', timeout=30)
            tree = json.loads(txt)
            with open(MENU_CACHE, 'w', encoding='utf-8') as f:
                json.dump(tree, f, ensure_ascii=False)
        except Exception as e:
            log(f'   ! меню WB недоступно ({e}) — способы recom/catalog будут без subject')
            tree = []
    leafs = []

    def walk(nodes, path, shard):
        for n in nodes or []:
            sh = n.get('shard') or shard
            q = n.get('query') or ''
            m = re.search(r'subject=(\d+)', q)
            childs = n.get('childs') or []
            if m and not childs:
                leafs.append({'name': n.get('name', ''), 'path': path, 'subject': int(m.group(1)), 'shard': sh,
                              'cat': re.search(r'cat=(\d+)', q).group(1) if 'cat=' in q else None})
            walk(childs, path + [n.get('name', '')], sh)
    walk(tree, [], None)
    _menu_leafs = leafs
    return leafs


def wb_subject_for(query, hint=''):
    """Подбираем subject WB по словам запроса ('пылесос' -> Пылесосы, subject 710, shard ...)."""
    qs = stems(query)
    if not qs:
        return None
    best, best_score = None, 0
    for lf in wb_menu():
        ns = stems(lf['name'])
        hit = len(qs & ns)
        if not hit:
            continue
        score = hit * 10 + len(qs & stems(' '.join(lf['path']))) * 2 + len(stems(hint) & ns) - abs(len(ns) - len(qs))
        if score > best_score:
            best, best_score = lf, score
    return best


# =====================================================================================
#  WB — способы поиска
# =====================================================================================
def wb_recom(query, page=1):
    lf = wb_subject_for(query)
    base = f'https://recom.wb.ru/personal/ru/common/v5/search?{WB_Q}&query={urllib.parse.quote(query)}&resultset=catalog&sort=popular&page={page}'
    urls = [base + f'&subject={lf["subject"]}', base] if lf else [base]
    for u in urls:
        items = wb_items(wb_json_products(call('wb.recom', u)))
        if items:
            return items
    return []


def wb_catalog(query, page=1):
    lf = wb_subject_for(query)
    if not lf or not lf.get('shard'):
        return []
    u = f'https://catalog.wb.ru/catalog/{lf["shard"]}/v4/catalog?{WB_Q}&sort=popular&subject={lf["subject"]}&page={page}'
    if lf.get('cat'):
        u += f'&cat={lf["cat"]}'
    return wb_items(wb_json_products(call('wb.catalog', u)))


_search_ver = [0]


def wb_search(query, page=1):
    vers = ['https://search.wb.ru/exactmatch/ru/common/v5/search', 'https://search.wb.ru/exactmatch/ru/common/v4/search',
            'https://search.wb.ru/exactmatch/sng/common/v5/search']
    v = vers[_search_ver[0] % len(vers)]
    _search_ver[0] += 1
    u = f'{v}?{WB_Q}&resultset=catalog&sort=popular&limit=60&page={page}&query={urllib.parse.quote(query)}'
    return wb_items(wb_json_products(call('wb.search', u)))


def wb_cards(ids):
    out = []
    for i in range(0, len(ids), 40):
        chunk = ids[i:i + 40]
        u = f'https://card.wb.ru/cards/v4/detail?{WB_Q}&nm={";".join(str(x) for x in chunk)}'
        out += wb_items(wb_json_products(call('wb.cards', u)))
    return out


def wb_seller(supplier, page=1):
    u = f'https://catalog.wb.ru/sellers/v4/catalog?{WB_Q}&sort=popular&supplier={supplier}&page={page}'
    return wb_items(wb_json_products(call('wb.seller', u)))


# ---------- WB CDN: карточка + картинки ----------
BASKET_RANGES = [
    (143, 1), (287, 2), (431, 3), (719, 4), (1007, 5), (1061, 6), (1115, 7), (1169, 8), (1313, 9), (1601, 10),
    (1655, 11), (1919, 12), (2045, 13), (2189, 14), (2405, 15), (2621, 16), (2837, 17), (3053, 18), (3269, 19),
    (3485, 20), (3701, 21), (3917, 22), (4133, 23), (4349, 24), (4565, 25), (4877, 26), (5189, 27), (5501, 28),
    (5813, 29), (6125, 30), (6437, 31), (6749, 32), (7061, 33), (7373, 34), (7685, 35), (7997, 36), (8309, 37),
    (8700, 38), (9200, 39), (9500, 40), (9900, 41), (10700, 42), (11500, 43), (12800, 44), (13600, 45),
    (14600, 46), (15600, 47), (16600, 48), (17600, 49), (18600, 50), (19600, 51), (20600, 52),
]
MAX_BASKET = 80
_basket_cache, _basket_lock = {}, threading.Lock()
try:
    with open(BASKET_CACHE, encoding='utf-8') as _f:
        _basket_cache = {int(k): int(v) for k, v in json.load(_f).items()}
except Exception:
    pass


def guess_basket(vol):
    for upto, n in BASKET_RANGES:
        if vol <= upto:
            return n
    return BASKET_RANGES[-1][1] + 1


def card_base(nm, basket):
    return f'https://basket-{basket:02d}.wbbasket.ru/vol{nm // 100000}/part{nm // 1000}/{nm}'


def wb_fetch_card(nm):
    vol = nm // 100000
    with _basket_lock:
        cached = _basket_cache.get(vol)
    guess = cached or guess_basket(vol)
    order = [guess]
    for d in (1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 8, -8, 10, -10, 12, 15, 18):
        n = guess + d
        if 1 <= n <= MAX_BASKET and n not in order:
            order.append(n)
    for b in order:
        try:
            txt = http_get(card_base(nm, b) + '/info/ru/card.json', timeout=12)
        except Exception:
            txt = None
        if txt:
            try:
                card = json.loads(txt)
            except Exception:
                continue
            with _basket_lock:
                if _basket_cache.get(vol) != b:
                    _basket_cache[vol] = b
                    try:
                        with open(BASKET_CACHE, 'w', encoding='utf-8') as f:
                            json.dump(_basket_cache, f)
                    except Exception:
                        pass
            return card, b
    return None, None


# =====================================================================================
#  ЯНДЕКС МАРКЕТ
# =====================================================================================
def ym_parse(html):
    """Достаём items из виджета SearchSchemaOrg (обычный JSON внутри HTML)."""
    out = []
    pos = 0
    dec = json.JSONDecoder()
    while True:
        i = html.find('"@marketfront/SearchSchemaOrg"', pos)
        if i < 0:
            break
        j = html.find('"items":', i)
        if j < 0:
            break
        k = html.find('[', j)
        try:
            items, end = dec.raw_decode(html, k)
        except Exception:
            pos = j + 8
            continue
        pos = end
        for it in items if isinstance(items, list) else []:
            if not isinstance(it, dict):
                continue
            sku = str(it.get('sku') or '')
            m = re.search(r'/(\d{6,})', it.get('url') or '')
            if not sku.isdigit() and m:
                sku = m.group(1)
            if not sku.isdigit() or not it.get('name'):
                continue
            try:
                price = round(float(str(it.get('price') or 0).replace(' ', '').replace(',', '.')))
            except Exception:
                price = 0
            if not price:
                continue
            img = it.get('image') or ''
            if isinstance(img, list):
                img = img[0] if img else ''
            url = it.get('url') or ''
            if url.startswith('/'):
                url = 'https://market.yandex.ru' + url
            out.append({
                'src': 'ym', 'id': int(sku), 'root': None, 'name': it['name'].strip(), 'brand': (it.get('brand') or {}).get('name', '') if isinstance(it.get('brand'), dict) else (it.get('brand') or ''),
                'price': price, 'oldPrice': None, 'rating': float(it.get('rating') or 0) or 0, 'feedbacks': int(it.get('ratingCount') or 0),
                'pics': 1, 'supplier': 'Яндекс Маркет', 'colors': [], 'stock': 0, 'isNew': False,
                'images': [img] if img else [], 'description': (it.get('description') or '').strip(), 'url': url,
            })
    if not out:
        # запасной разбор: ищем объекты с "sku" где угодно в HTML (если разметка виджета изменится)
        for m in re.finditer(r'"sku"\s*:\s*"?\d{6,}', html):
            start = m.start()
            for _ in range(6):
                start = html.rfind('{', 0, start)
                if start < 0 or m.start() - start > 4000:
                    break
                try:
                    obj, _end = dec.raw_decode(html, start)
                except Exception:
                    continue
                if isinstance(obj, dict) and obj.get('name') and obj.get('price') and obj.get('sku'):
                    try:
                        price = round(float(str(obj['price']).replace(' ', '').replace(',', '.')))
                    except Exception:
                        break
                    img = obj.get('image') or ''
                    img = img[0] if isinstance(img, list) and img else img if isinstance(img, str) else ''
                    url = obj.get('url') or ''
                    if url.startswith('/'):
                        url = 'https://market.yandex.ru' + url
                    sku = int(re.sub(r'\D', '', str(obj['sku'])) or 0)
                    if sku and price and all(o['id'] != sku for o in out):
                        out.append({'src': 'ym', 'id': sku, 'root': None, 'name': str(obj['name']).strip(), 'brand': '', 'price': price, 'oldPrice': None,
                                    'rating': float(obj.get('rating') or 0) or 0, 'feedbacks': int(obj.get('ratingCount') or 0), 'pics': 1,
                                    'supplier': 'Яндекс Маркет', 'colors': [], 'stock': 0, 'isNew': False, 'images': [img] if img else [],
                                    'description': (obj.get('description') or '').strip(), 'url': url})
                break
    if not out and ('SmartCaptcha' in html or 'showcaptcha' in html):
        raise Blocked('captcha')
    return out


def ym_search(query, page=1, slug=None):
    if slug:
        u = (slug if slug.startswith('http') else f'https://market.yandex.ru/category/{slug}') + f'?how=dpop&page={page}'
    else:
        u = f'https://market.yandex.ru/search?text={urllib.parse.quote(query)}&how=dpop&page={page}'
    html = call('ym', u, html=True, timeout=40)
    return ym_parse(html or '')


def ym_image_url(u):
    # /orig -> оригинал (бывает огромный). Пробуем разумный размер, потом orig.
    return [re.sub(r'/[^/]+$', '/900x1200', u), u] if '/get-mpic/' in u else [u]


# =====================================================================================
#  OZON (best effort)
# =====================================================================================
def _walk(obj, fn):
    if isinstance(obj, dict):
        fn(obj)
        for v in obj.values():
            _walk(v, fn)
    elif isinstance(obj, list):
        for v in obj:
            _walk(v, fn)


def oz_search(query, page=1):
    path = f'/search/?text={urllib.parse.quote(query)}&from_global=true&sorting=rating&page={page}'
    u = 'https://www.ozon.ru/api/composer-api.bx/page/json/v2?url=' + urllib.parse.quote(path, safe='')
    txt = call('oz', u, timeout=40)
    try:
        data = json.loads(txt)
    except Exception:
        raise Blocked('bad-json')
    ws = data.get('widgetStates') or {}
    out = []
    for key, val in ws.items():
        if not key.startswith('searchResultsV2') and not key.startswith('tileGridDesktop'):
            continue
        try:
            st = json.loads(val)
        except Exception:
            continue
        for it in st.get('items') or []:
            link = ((it.get('action') or {}).get('link')) or ''
            m = re.search(r'-(\d{6,})/?', link)
            if not m:
                continue
            pid = int(m.group(1))
            texts, prices, imgs = [], [], []

            def grab(d):
                if 'textAtom' in d and isinstance(d['textAtom'], dict) and d['textAtom'].get('text'):
                    texts.append(re.sub(r'<[^>]+>', '', d['textAtom']['text']))
                if 'priceV2' in d and isinstance(d['priceV2'], dict):
                    for p in d['priceV2'].get('price') or []:
                        prices.append((p.get('textStyle'), p.get('text')))
                if 'image' in d and isinstance(d['image'], dict) and d['image'].get('link'):
                    imgs.append(d['image']['link'])
                if 'images' in d and isinstance(d['images'], list):
                    imgs.extend([x for x in d['images'] if isinstance(x, str)])
            _walk(it, grab)
            name = max(texts, key=len) if texts else ''

            def num(t):
                t = re.sub(r'[^\d]', '', t or '')
                return int(t) if t else 0
            price = 0
            old = None
            for style, t in prices:
                if style == 'PRICE' and not price:
                    price = num(t)
                elif style == 'ORIGINAL_PRICE':
                    old = num(t) or None
            if not price and prices:
                price = num(prices[0][1])
            if not name or not price:
                continue
            rating = feedbacks = 0
            for t in texts:
                m2 = re.match(r'^\s*([0-5][.,]\d)\s*$', t)
                if m2:
                    rating = float(m2.group(1).replace(',', '.'))
                m3 = re.match(r'^\s*([\d\s]+)\s*(отзыв|оцен)', t)
                if m3:
                    feedbacks = num(m3.group(1))
            out.append({'src': 'oz', 'id': pid, 'root': None, 'name': name, 'brand': '', 'price': price, 'oldPrice': old if old and old > price else None,
                        'rating': rating, 'feedbacks': feedbacks, 'pics': len(imgs) or 1, 'supplier': 'Ozon', 'colors': [], 'stock': 0, 'isNew': False,
                        'images': [x for x in dict.fromkeys(imgs)], 'description': '', 'url': 'https://www.ozon.ru' + link.split('?')[0]})
    if not out and (data.get('incidentId') or 'challenge' in txt[:300].lower()):
        raise Blocked('antibot')
    return out


def oz_details(pid):
    """Описание и характеристики со страницы товара (тоже best effort)."""
    u = 'https://www.ozon.ru/api/composer-api.bx/page/json/v2?url=' + urllib.parse.quote(f'/product/{pid}/', safe='')
    try:
        txt = call('oz', u, timeout=40)
        data = json.loads(txt)
    except Exception:
        return '', {}, ''
    desc, specs, brand = '', {}, ''
    for key, val in (data.get('widgetStates') or {}).items():
        try:
            st = json.loads(val)
        except Exception:
            continue
        if key.startswith('webDescription'):
            desc = re.sub(r'<[^>]+>', '\n', st.get('richAnnotation') or st.get('description') or '').strip() or desc
        if key.startswith('webCharacteristics') or key.startswith('webShortCharacteristics'):
            def grab(d):
                nonlocal brand
                if 'title' in d and isinstance(d.get('values'), list):
                    t = (d['title'].get('textRs') or [{}])[0].get('content') if isinstance(d['title'], dict) else str(d['title'])
                    v = ', '.join(str(x.get('text') or '') for x in d['values'] if isinstance(x, dict))
                    if t and v:
                        specs[t] = v
                        if t.lower().strip() == 'бренд':
                            brand = v
            _walk(st, grab)
    return desc, specs, brand


# =====================================================================================
#  Сохранение товара (общее для всех источников)
# =====================================================================================
def sniff_ext(data):
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'webp'
    if data[:3] == b'\xff\xd8\xff':
        return 'jpg'
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png'
    if data[:4] == b'\x00\x00\x00\x1c' or data[4:8] == b'ftyp':
        return 'avif'
    return 'jpg'


def download_image(urls):
    for u in urls:
        try:
            data = http_get_retry(u, retries=2, timeout=30, binary=True)
        except Exception:
            data = None
        if data and len(data) > 1500:
            return data
    return None


CAT_TAGS = {
    'electronics': ['гарантия', '5G', 'быстрая зарядка'], 'appliances': ['экономия энергии', 'тихая работа', 'гарантия 2 года'],
    'fashion-women': ['хлопок', 'oversize', 'тренд'], 'fashion-men': ['спорт', 'классика', 'хлопок'], 'kids': ['безопасно', 'развитие', '3+'],
    'home': ['уют', 'эко', 'ручная работа'], 'beauty': ['натуральный', 'без парабенов', 'веган'], 'health': ['сертифицировано', 'для всей семьи'],
    'sport': ['профи', 'для дома', 'лёгкий'], 'auto': ['зима', 'универсальный', 'премиум'], 'books': ['бестселлер', 'твёрдый переплёт', 'подарок'],
    'food': ['без сахара', 'органик', 'халяль'], 'pets': ['премиум', 'для котят', 'гипоаллергенно'], 'furniture': ['лофт', 'скандинавский', 'массив'],
    'garden': ['профи', 'для дома', 'аккумуляторный'], 'office': ['школа', 'офис', 'набор'], 'gaming': ['RGB', 'беспроводной', 'профи'],
    'jewelry': ['серебро', 'подарок', 'фианит'], 'bags': ['кожа', 'городской', 'водонепроницаемый'], 'digital': ['моментально', 'официально'],
}
SITE_NAME = {'wb': 'wildberries', 'ym': 'yandex', 'oz': 'ozon'}


def make_tags(item, cat_id):
    tags = []
    if item.get('oldPrice') and item['oldPrice'] > item['price'] * 1.25:
        tags.append('скидка')
    if item.get('feedbacks', 0) > 1000:
        tags.append('хит')
    if item.get('isNew'):
        tags.append('новинка')
    if item.get('rating') and float(item['rating']) >= 4.8:
        tags.append('топ рейтинг')
    for t in CAT_TAGS.get(cat_id, []):
        if len(tags) >= 4:
            break
        if t not in tags:
            tags.append(t)
    return tags[:4]


def folder_name(item):
    return str(item['id']) if item['src'] == 'wb' else f"{item['src']}{item['id']}"


def save_product(item, cat_id, sub_name, max_images, img_size):
    d = os.path.join(OUT_DIR, cat_id, folder_name(item))
    pj = os.path.join(d, 'product.json')
    if os.path.exists(pj):
        with open(pj, encoding='utf-8') as f:
            return json.load(f), 'skip'

    desc, specs, title, brand, image_sets, url = '', {}, item['name'], item.get('brand') or '', [], item.get('url') or ''
    if item['src'] == 'wb':
        card, basket = wb_fetch_card(item['id'])
        if not card:
            return None, 'nocard'
        base = card_base(item['id'], basket)
        for i in range(1, min(max_images, item.get('pics') or 1) + 1):
            image_sets.append([f'{base}/images/{s}/{i}.webp' for s in (img_size, 'c246x328', 'big')])
        for o in card.get('options') or []:
            n, v = o.get('name'), o.get('value')
            if n and v and n not in ('Ширина упаковки', 'Длина упаковки', 'Высота упаковки'):
                specs[n] = v
        desc = (card.get('description') or '').strip()
        title = (card.get('imt_name') or item['name']).strip()
        brand = brand or (card.get('selling') or {}).get('brand_name') or ''
        url = f'https://www.wildberries.ru/catalog/{item["id"]}/detail.aspx'
    elif item['src'] == 'ym':
        desc = item.get('description') or ''
        for u in (item.get('images') or [])[:max_images]:
            image_sets.append(ym_image_url(u))
    elif item['src'] == 'oz':
        desc, specs, b2 = oz_details(item['id'])
        brand = brand or b2
        for u in (item.get('images') or [])[:max_images]:
            image_sets.append([u])
    if not image_sets:
        return None, 'noimg'
    if not brand:
        m = re.match(r'^([A-Za-z][A-Za-z0-9&\-]{1,20})\b', title)
        brand = m.group(1) if m else 'No name'

    os.makedirs(d, exist_ok=True)
    images = []
    for i, urls in enumerate(image_sets, 1):
        data = download_image(urls)
        if data:
            fn = f'{i}.{sniff_ext(data)}'
            with open(os.path.join(d, fn), 'wb') as f:
                f.write(data)
            images.append(fn)
    if not images:
        shutil.rmtree(d, ignore_errors=True)
        return None, 'noimg'

    rating = round(float(item.get('rating') or 0), 1)
    product = {
        'id': item['id'], 'title': title, 'brand': brand, 'category': cat_id, 'subcategory': sub_name, 'tags': make_tags(item, cat_id),
        'price': item['price'], 'oldPrice': item.get('oldPrice'),
        'rating': rating if rating else round(random.uniform(4.3, 4.9), 1), 'reviews': item.get('feedbacks') or 0,
        'country': 'RU', 'stock': item.get('stock') or random.randint(5, 80), 'isNew': bool(item.get('isNew')),
        'colors': item.get('colors') or [], 'supplier': item.get('supplier') or '', 'description': desc, 'specs': specs, 'images': images,
        'source': {'site': SITE_NAME[item['src']], 'url': url, 'imported': time.strftime('%Y-%m-%d')},
    }
    if item.get('root'):
        product['root'] = item['root']
    with open(pj, 'w', encoding='utf-8') as f:
        json.dump(product, f, ensure_ascii=False, indent=2)
    with open(os.path.join(d, 'описание.txt'), 'w', encoding='utf-8') as f:
        f.write(f"{title}\nБренд: {brand}\nЦена: {item['price']} ₽" + (f" (старая {item['oldPrice']} ₽)" if item.get('oldPrice') else '') +
                f"\nРейтинг: {product['rating']} ({product['reviews']} отзывов)\nИсточник: {url}\n\nОПИСАНИЕ\n{desc}\n\nХАРАКТЕРИСТИКИ\n" +
                '\n'.join(f'{k}: {v}' for k, v in specs.items()))
    return product, 'ok'


# =====================================================================================
#  Состояние (плохие id, чтобы не пробовать их снова) и уже скачанное
# =====================================================================================
STATE = {'bad': {}}
try:
    with open(STATE_PATH, encoding='utf-8') as _f:
        STATE.update(json.load(_f))
except Exception:
    pass


def save_state():
    try:
        with open(STATE_PATH, 'w', encoding='utf-8') as f:
            json.dump(STATE, f)
    except Exception:
        pass


def all_products():
    """[(cat, folder, product)] по всем категориям."""
    out = []
    if not os.path.isdir(OUT_DIR):
        return out
    for cat in sorted(os.listdir(OUT_DIR)):
        cdir = os.path.join(OUT_DIR, cat)
        if not os.path.isdir(cdir):
            continue
        for fn in os.listdir(cdir):
            pj = os.path.join(cdir, fn, 'product.json')
            if os.path.exists(pj):
                try:
                    with open(pj, encoding='utf-8') as f:
                        out.append((cat, fn, json.load(f)))
                except Exception:
                    pass
    return out


def relevance(name, query):
    return len(stems(query) & stems(name))


def dedupe_folders(cfg):
    """Один и тот же товар не должен лежать в двух категориях/подкатегориях.
    Оставляем копию, чьё название лучше подходит к запросу подкатегории; остальные удаляем."""
    groups = {}
    for cat, fn, p in all_products():
        groups.setdefault(p.get('id'), []).append((cat, fn, p))
    removed = 0
    for pid, lst in groups.items():
        if len(lst) < 2:
            continue

        def score(x):
            cat, fn, p = x
            q = (cfg['categories'].get(cat) or {}).get(p.get('subcategory') or '', '')
            return (relevance(p.get('title', ''), q), len(p.get('images') or []))
        lst.sort(key=score, reverse=True)
        for cat, fn, p in lst[1:]:
            shutil.rmtree(os.path.join(OUT_DIR, cat, fn), ignore_errors=True)
            removed += 1
    if removed:
        log(f'ℹ убрано дублей товаров (один товар лежал в нескольких категориях): {removed}')
    return removed


def existing(cat_id):
    """{subcategory: [product,...]} уже скачанных товаров категории."""
    out = {}
    cdir = os.path.join(OUT_DIR, cat_id)
    if not os.path.isdir(cdir):
        return out
    for fn in os.listdir(cdir):
        pj = os.path.join(cdir, fn, 'product.json')
        if os.path.exists(pj):
            try:
                with open(pj, encoding='utf-8') as f:
                    p = json.load(f)
                out.setdefault(p.get('subcategory'), []).append(p)
            except Exception:
                pass
    return out


# =====================================================================================
#  Планировщик: категория -> подкатегории -> источники/способы
# =====================================================================================
def read_ids_txt():
    """tools/ids.txt: строки вида  'electronics 925785985 705048270 ...'  (артикулы WB, можно ссылками)."""
    out = {}
    if not os.path.exists(IDS_PATH):
        return out
    with open(IDS_PATH, encoding='utf-8') as f:
        for line in f:
            line = line.split('#')[0].strip()
            if not line:
                continue
            parts = line.replace(':', ' ').split()
            cat, ids = parts[0], []
            for p in parts[1:]:
                m = re.search(r'catalog/(\d+)', p) or re.search(r'^(\d{5,})$', p)
                if m:
                    ids.append(int(m.group(1)))
            if ids:
                out.setdefault(cat, []).extend(ids)
    return out


def assign_sub(name, subs):
    """К какой подкатегории отнести товар по названию (по совпадению основ слов запроса)."""
    ns = stems(name)
    best, best_hit = None, 0
    for sub, q in subs.items():
        hit = len(stems(q) & ns)
        if hit > best_hit:
            best, best_hit = sub, hit
    return best


class Importer:
    def __init__(self, cfg, sources, max_images, img_size):
        self.cfg, self.sources, self.max_images, self.img_size = cfg, sources, max_images, img_size
        self.seed_ids = {k: list(v) for k, v in (cfg.get('wb_seed_ids') or {}).items()}
        for k, v in read_ids_txt().items():
            self.seed_ids.setdefault(k, []).extend(v)
        self.sellers = cfg.get('wb_sellers') or {}
        self.ym_slugs = cfg.get('ym_slugs') or {}
        self.stats = {}
        self._cards_cache = {}
        self.known = set()       # id всех уже скачанных товаров (во всех категориях)
        self.known_roots = set()
        for cat, fn, p in all_products():
            self.known.add(p.get('id'))
            if p.get('root'):
                self.known_roots.add(p['root'])

    # ---- один «способ» = генератор списков найденных товаров для (cat, sub) ----
    def methods(self, cat_id, subs, sub, query):
        order = []
        for s in self.sources:
            if s == 'wb':
                order += ['wb.cards', 'wb.recom', 'wb.seller', 'wb.catalog', 'wb.search']
            elif s == 'ym':
                order += ['ym']
            elif s == 'oz':
                order += ['oz']
        return order

    def run_method(self, m, cat_id, subs, sub, query, page):
        if m == 'wb.cards':
            if page > 1:
                return []
            ids = self.seed_ids.get(cat_id) or []
            if not ids:
                return []
            if cat_id not in self._cards_cache:
                self._cards_cache[cat_id] = wb_cards(ids)
            found = self._cards_cache[cat_id]
            return [it for it in found if assign_sub(it['name'], subs) == sub]
        if m == 'wb.seller':
            sellers = self.sellers.get(cat_id) or []
            if not sellers or page > len(sellers):
                return []
            found = wb_seller(sellers[page - 1], 1)
            return [it for it in found if assign_sub(it['name'], subs) == sub]
        if m == 'wb.recom':
            return wb_recom(query, page)
        if m == 'wb.catalog':
            return wb_catalog(query, page)
        if m == 'wb.search':
            return wb_search(query, page)
        if m == 'ym':
            return ym_search(query, page, slug=self.ym_slugs.get(sub))
        if m == 'oz':
            return oz_search(query, page)
        return []

    def fill_sub(self, cat_id, subs, sub, query, need, have):
        got = list(have)
        bad = set(STATE['bad'].get(cat_id, []))
        tried = set()
        for m in self.methods(cat_id, subs, sub, query):
            if len(got) >= need:
                break
            if not EP[m].available():
                continue
            pages = 3 if m in ('wb.recom', 'wb.catalog', 'wb.search', 'ym', 'oz') else (len(self.sellers.get(cat_id) or []) if m == 'wb.seller' else 1)
            empty_pages = 0
            for page in range(1, pages + 1):
                if len(got) >= need:
                    break
                try:
                    found = self.run_method(m, cat_id, subs, sub, query, page)
                except Blocked:
                    break
                except Exception as e:
                    log(f'     ! {m} «{query}» стр.{page}: {e}')
                    break
                todo = []
                for it in found:
                    key = it['id']
                    # уже скачан (в любой категории/подкатегории), уже пробовали или это цвет-вариант скачанного
                    if key in self.known or key in tried or key in bad or (it.get('root') and it['root'] in self.known_roots):
                        continue
                    tried.add(key)
                    todo.append(it)
                # сначала те, у кого в названии есть слова запроса (у «личного» поиска WB бывает мусор)
                todo.sort(key=lambda it: -relevance(it['name'], query))
                if not todo:
                    empty_pages += 1
                    if empty_pages >= 2 or not found:
                        break
                    continue
                self.stats.setdefault(m, 0)
                while todo and len(got) < need:
                    batch, todo = todo[: need - len(got)], todo[need - len(got):]
                    for it in batch:                      # бронируем id, чтобы другая подкатегория не взяла его же
                        self.known.add(it['id'])
                        if it.get('root'):
                            self.known_roots.add(it['root'])
                    with ThreadPoolExecutor(max_workers=CDN_WORKERS if m != 'oz' else 1) as ex:
                        futs = {ex.submit(save_product, it, cat_id, sub, self.max_images, self.img_size): it for it in batch}
                        for fu in as_completed(futs):
                            it = futs[fu]
                            try:
                                prod, st = fu.result()
                            except Exception as e:
                                log(f'     ! {it["id"]}: {e}')
                                prod, st = None, 'err'
                            if prod:
                                got.append(prod)
                                if st == 'ok':
                                    self.stats[m] += 1
                            else:
                                self.known.discard(it['id'])
                                if st != 'err':
                                    STATE['bad'].setdefault(cat_id, []).append(it['id'])
                if len(got) >= need:
                    log(f'       ← {m}: набрано {len(got)}/{need}')
        save_state()
        return got

    def import_category(self, cat_id, subs, per_category, limit_per_sub=None):
        per_sub = limit_per_sub or max(1, round(per_category / len(subs)))
        have = existing(cat_id)
        results = []
        for sub, query in subs.items():
            got = self.fill_sub(cat_id, subs, sub, query, per_sub, have.get(sub, []))
            results.extend(got)
            mark = '✓' if len(got) >= per_sub else '…'
            src = {}
            for p in got:
                s = (p.get('source') or {}).get('site', '?')
                src[s] = src.get(s, 0) + 1
            log(f'   {mark} {sub:<22} {len(got)}/{per_sub}  («{query}»)  {src}')
        log(f'   итог {cat_id}: {len(results)} товаров')
        return results


# =====================================================================================
#  Сборка products.js
# =====================================================================================
def build_js():
    products, ids = [], set()
    if not os.path.isdir(OUT_DIR):
        log('нет папки products'); return 0
    for cat in sorted(os.listdir(OUT_DIR)):
        cdir = os.path.join(OUT_DIR, cat)
        if not os.path.isdir(cdir):
            continue
        for fn in sorted(os.listdir(cdir)):
            pj = os.path.join(cdir, fn, 'product.json')
            if not os.path.exists(pj):
                continue
            try:
                with open(pj, encoding='utf-8') as f:
                    p = json.load(f)
            except Exception:
                continue
            imgs = [img for img in p.get('images', []) if os.path.exists(os.path.join(cdir, fn, img))]
            if not imgs or p.get('id') in ids:
                continue
            ids.add(p['id'])
            p['images'] = [f'products/{cat}/{fn}/{img}' for img in imgs]
            p.setdefault('category', cat)
            products.append(p)
    products.sort(key=lambda p: (p['category'], p.get('subcategory') or '', p['id']))
    for i, p in enumerate(products):
        p['country'] = COUNTRIES[i % len(COUNTRIES)]
    os.makedirs(os.path.dirname(JS_OUT), exist_ok=True)
    with open(JS_OUT, 'w', encoding='utf-8') as f:
        f.write('/* Сгенерировано tools/import_all.py — не редактировать вручную. Товары: %d, дата: %s */\n' % (len(products), time.strftime('%Y-%m-%d %H:%M')))
        f.write('window.MARKET_PRODUCTS = ')
        json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    by_cat, by_src = {}, {}
    for p in products:
        by_cat[p['category']] = by_cat.get(p['category'], 0) + 1
        s = (p.get('source') or {}).get('site', '?')
        by_src[s] = by_src.get(s, 0) + 1
    report = os.path.join(ROOT, 'tools', 'report.txt')
    with open(report, 'w', encoding='utf-8') as f:
        f.write(f'GIGASAIT import v{VERSION} — {time.strftime("%Y-%m-%d %H:%M")} — товаров: {len(products)}\n')
        f.write('категории: ' + ', '.join(f'{k}={v}' for k, v in sorted(by_cat.items())) + '\n')
        f.write('источники: ' + ', '.join(f'{k}={v}' for k, v in sorted(by_src.items())) + '\n\n')
        for p in products:
            f.write(f"{p['category']:<14}| {p.get('subcategory', ''):<20}| {(p.get('source') or {}).get('site', '?'):<11}| {str(p['id']):<12}| {p['price']:>8} | {len(p['images'])} фото | {p['brand'][:18]:<18}| {p['title'][:80]}\n")
    log(f'\nproducts.js: {len(products)} товаров, {os.path.getsize(JS_OUT) // 1024} КБ  (сводка: tools/report.txt)')
    log('по категориям: ' + ', '.join(f'{k}={v}' for k, v in sorted(by_cat.items())))
    log('по источникам: ' + ', '.join(f'{k}={v}' for k, v in sorted(by_src.items())))
    return len(products)


# =====================================================================================
#  cookies из файла (Netscape cookies.txt из расширения браузера, либо строка "a=b; c=d")
# =====================================================================================
def load_cookies(path):
    out = {'wb': [], 'ym': [], 'oz': []}
    with open(path, encoding='utf-8', errors='replace') as f:
        txt = f.read()
    lines = [l for l in txt.splitlines() if l.strip() and not l.startswith('#')]
    netscape = any(l.count('\t') >= 6 for l in lines)
    if netscape:
        for l in lines:
            p = l.split('\t')
            if len(p) < 7:
                continue
            dom, name, val = p[0].lower(), p[5], p[6]
            s = 'wb' if ('wildberries' in dom or 'wb.ru' in dom) else 'ym' if 'yandex' in dom else 'oz' if 'ozon' in dom else None
            if s:
                out[s].append(f'{name}={val}')
    else:
        # простая строка cookie — отдаём всем сайтам (можно префиксом: "ozon: a=b; c=d")
        for l in lines:
            m = re.match(r'^\s*(wb|ym|oz|ozon|yandex|wildberries)\s*:\s*(.+)$', l, re.I)
            if m:
                k = m.group(1).lower()[:2]
                out[k].append(m.group(2).strip())
            else:
                for k in out:
                    out[k].append(l.strip())
    return {k: '; '.join(v) for k, v in out.items() if v}


def main():
    ap = argparse.ArgumentParser(description='GIGASAIT: импорт товаров с Wildberries / Яндекс Маркет / Ozon')
    ap.add_argument('--source', default='wb,ym,oz', help='источники и их порядок: wb, ym, oz (через запятую). По умолчанию wb,ym,oz')
    ap.add_argument('--cat', help='только эта категория (id из import_config.json)')
    ap.add_argument('--limit', type=int, help='товаров на подкатегорию (для быстрой проверки)')
    ap.add_argument('--per-category', type=int, help='товаров на категорию (по умолчанию из конфига, 25)')
    ap.add_argument('--delay', type=float, default=1.0, help='множитель пауз между запросами (2 = вдвое медленнее)')
    ap.add_argument('--passes', type=int, default=2, help='сколько раз пройти по категориям, добирая недостающее')
    ap.add_argument('--cookies', help='файл cookies (cookies.txt из браузера)')
    ap.add_argument('--proxy', help='прокси, например http://user:pass@host:port')
    ap.add_argument('--build-only', action='store_true', help='только пересобрать products.js')
    a = ap.parse_args()

    with open(CFG_PATH, encoding='utf-8') as f:
        cfg = json.load(f)
    if a.build_only:
        dedupe_folders(cfg); build_js(); return

    OPTS['delay_mult'] = max(0.2, a.delay)
    OPTS['proxy'] = a.proxy
    if a.cookies:
        try:
            OPTS['cookies'] = load_cookies(a.cookies)
            log('cookies загружены для: ' + ', '.join(OPTS['cookies']))
        except Exception as e:
            log(f'! не удалось прочитать cookies: {e}')
    sources = [s.strip() for s in a.source.split(',') if s.strip() in ('wb', 'ym', 'oz')]
    if not sources:
        log('Укажи --source из: wb, ym, oz'); return
    if 'oz' in sources and not OPTS['cookies'].get('oz'):
        log('ℹ Ozon без cookies почти всегда отдаёт антибот — он будет использован только как последний резерв.')

    cats = cfg['categories']
    if a.cat:
        if a.cat not in cats:
            log(f'Нет категории {a.cat}. Доступны: {", ".join(cats)}'); return
        cats = {a.cat: cats[a.cat]}
    per_category = a.per_category or cfg['per_category']
    dedupe_folders(cfg)
    imp = Importer(cfg, sources, cfg.get('max_images', 3), cfg.get('image_size', 'c516x688'))
    total = 0
    t0 = time.time()
    log(f'GIGASAIT import v{VERSION}: {len(cats)} категорий × {per_category} товаров, источники: {" → ".join(sources)}, задержка ×{a.delay}')
    log('Можно прерывать Ctrl+C и запускать снова — докачает.\n')
    try:
        for ps in range(1, a.passes + 1):
            if ps > 1:
                short = [c for c in cats if sum(len(v) for v in existing(c).values()) < (a.limit * len(cats[c]) if a.limit else per_category)]
                if not short:
                    break
                log(f'\n▶▶ Проход {ps}: добираем {len(short)} категорий: {", ".join(short)}')
                # перед повторным проходом даём лимитам остыть
                waits = [ep.until - time.time() for ep in EP.values() if not ep.available()]
                if waits and len(waits) == len(EP):
                    w = min(min(waits), 300)
                    log(f'   все источники охлаждаются — ждём {w:.0f} c'); time.sleep(max(0, w))
                cats_run = {c: cats[c] for c in short}
            else:
                cats_run = cats
            total = 0
            for i, (cat_id, subs) in enumerate(cats_run.items(), 1):
                log(f'▶ [{i}/{len(cats_run)}] {cat_id}')
                total += len(imp.import_category(cat_id, subs, per_category, a.limit))
    except KeyboardInterrupt:
        log('\nПрервано. Скачанное сохранено — запусти ещё раз, чтобы продолжить.')
    save_state()
    log(f'\nСпособы, которые принесли товары: {imp.stats}')
    log(f'Готово за {time.time() - t0:.0f} c')
    build_js()


if __name__ == '__main__':
    main()
