#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GIGASAIT — импортёр товаров с Wildberries (v2).

Что делает:
  1. По каждой категории/подкатегории из tools/import_config.json ищет популярные товары
     через публичный API WB (search.wb.ru).
  2. Для каждого товара скачивает карточку (card.json: описание + характеристики)
     и N картинок с CDN (basket-NN.wbbasket.ru).
  3. Складывает всё в папки  marketplace/products/<category>/<nm_id>/
        ├─ 1.webp, 2.webp, 3.webp   картинки
        ├─ product.json             все данные
        └─ описание.txt             то же самое читаемым текстом
  4. Собирает единый каталог marketplace/js/products.js для сайта.

Запуск (из любой папки):
  python import_wb.py                 # полный импорт (500 товаров)
  python import_wb.py --cat food      # только одна категория
  python import_wb.py --limit 2       # по 2 товара на подкатегорию (быстрая проверка)
  python import_wb.py --build-only    # только пересобрать products.js из уже скачанных папок

Импорт идемпотентный: скачанное пропускается, скрипт можно прерывать и запускать заново.
Он сам добирает недостающие товары, пока не наберёт нужное количество.
Нужен только Python 3.8+ (стандартная библиотека).
"""
import argparse, json, os, re, sys, time, random, threading, shutil
import urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

# Корректный вывод кириллицы в консоли Windows
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG_PATH = os.path.join(ROOT, 'tools', 'import_config.json')
OUT_DIR = os.path.join(ROOT, 'marketplace', 'products')
JS_OUT = os.path.join(ROOT, 'marketplace', 'js', 'products.js')
BASKET_CACHE = os.path.join(ROOT, 'tools', '.basket_cache.json')
COUNTRIES = ['RU', 'KZ', 'BY', 'UZ', 'KG']

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
SEARCH_URL = ('https://search.wb.ru/exactmatch/ru/common/v5/search?appType=1&curr=rub&dest=-1257786'
              '&resultset=catalog&sort=popular&spp=30&limit={limit}&page={page}&query={q}')

# ---------- Настройки скорости (чтобы не ловить 429 Too Many Requests) ----------
SEARCH_MIN_INTERVAL = 2.5   # секунд между запросами к поиску
SEARCH_MAX_RETRIES = 6      # повторов при 429 с нарастающей паузой
CDN_WORKERS = 4             # параллельных потоков для карточек/картинок (CDN лимитов почти не имеет)

_print_lock = threading.Lock()


def log(*a):
    with _print_lock:
        print(*a, flush=True)


class HttpError(Exception):
    def __init__(self, code, url, retry_after=None):
        super().__init__(f'HTTP {code}: {url}')
        self.code = code
        self.retry_after = retry_after


def http_get(url, timeout=20, binary=False):
    """Один запрос. 404 -> None. Остальные ошибки -> исключение."""
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'ru-RU,ru;q=0.9',
        'Origin': 'https://www.wildberries.ru', 'Referer': 'https://www.wildberries.ru/'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read()
            return data if binary else data.decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        ra = None
        try:
            ra = float(e.headers.get('Retry-After') or 0) or None
        except Exception:
            pass
        raise HttpError(e.code, url, ra)


def http_get_retry(url, retries=3, timeout=20, binary=False):
    last = None
    for i in range(retries):
        try:
            return http_get(url, timeout=timeout, binary=binary)
        except HttpError as e:
            last = e
            if e.code == 429:
                time.sleep(3 * (i + 1))
            else:
                time.sleep(0.8 * (i + 1))
        except Exception as e:
            last = e
            time.sleep(0.8 * (i + 1) + random.random() * 0.5)
    raise RuntimeError(f'GET failed {url}: {last}')


# ---------- Троттлер для поиска ----------
class Throttle:
    def __init__(self, interval):
        self.interval = interval
        self.last = 0.0
        self.lock = threading.Lock()

    def wait(self):
        with self.lock:
            now = time.time()
            delta = self.last + self.interval - now
            if delta > 0:
                time.sleep(delta)
            self.last = time.time()


search_throttle = Throttle(SEARCH_MIN_INTERVAL)


def search(query, limit=30, page=1):
    """Поиск товаров. При 429 ждём всё дольше и повторяем."""
    url = SEARCH_URL.format(limit=limit, page=page, q=urllib.parse.quote(query))
    for attempt in range(SEARCH_MAX_RETRIES):
        search_throttle.wait()
        try:
            txt = http_get(url, timeout=25)
            break
        except HttpError as e:
            if e.code == 429:
                pause = max(e.retry_after or 0, 5 * (attempt + 1)) + random.random() * 2
                log(f'     ⏳ лимит запросов (429) — пауза {pause:.0f} c')
                time.sleep(pause)
                continue
            raise
        except Exception as e:
            time.sleep(2)
            if attempt == SEARCH_MAX_RETRIES - 1:
                raise
    else:
        raise RuntimeError('поиск: не удалось обойти лимит 429')
    if not txt:
        return []
    data = json.loads(txt)
    prods = data.get('products') or (data.get('data') or {}).get('products') or []
    out = []
    for p in prods:
        price = old = None
        for s in p.get('sizes') or []:
            pr = s.get('price') or {}
            if pr.get('product'):
                price = pr['product'] / 100
                old = (pr.get('basic') or 0) / 100
                break
        if not price or not p.get('pics'):
            continue
        out.append({
            'id': p['id'], 'root': p.get('root'), 'name': (p.get('name') or '').strip(), 'brand': (p.get('brand') or '').strip(),
            'price': round(price), 'oldPrice': round(old) if old and old > price * 1.02 else None,
            'rating': p.get('reviewRating') or p.get('rating') or 0, 'feedbacks': p.get('feedbacks') or 0,
            'pics': p.get('pics') or 0, 'supplier': p.get('supplier') or '',
            'colors': [c.get('name') for c in (p.get('colors') or []) if c.get('name')],
            'stock': p.get('totalQuantity') or 0, 'isNew': bool(p.get('isNew')),
        })
    return out


# ---------- CDN Wildberries: номер корзины по vol ----------
# Проверенные границы (vol = nm_id // 100000). Для новых диапазонов корзина ищется автоматически.
BASKET_RANGES = [
    (143, 1), (287, 2), (431, 3), (719, 4), (1007, 5), (1061, 6), (1115, 7), (1169, 8), (1313, 9), (1601, 10),
    (1655, 11), (1919, 12), (2045, 13), (2189, 14), (2405, 15), (2621, 16), (2837, 17), (3053, 18), (3269, 19),
    (3485, 20), (3701, 21), (3917, 22), (4133, 23), (4349, 24), (4565, 25), (4877, 26), (5189, 27), (5501, 28),
    (5813, 29), (6125, 30), (6437, 31), (6749, 32), (7061, 33), (7373, 34), (7685, 35), (7997, 36), (8309, 37),
    (8700, 38), (9200, 39), (9500, 40), (9900, 41), (10700, 42), (11500, 43), (12800, 44), (13600, 45),
    (14600, 46), (15600, 47), (16600, 48), (17600, 49), (18600, 50), (19600, 51), (20600, 52),
]
MAX_BASKET = 80

_basket_cache = {}
_basket_lock = threading.Lock()
try:
    with open(BASKET_CACHE, encoding='utf-8') as _f:
        _basket_cache = {int(k): int(v) for k, v in json.load(_f).items()}
except Exception:
    _basket_cache = {}


def _save_basket_cache():
    try:
        with open(BASKET_CACHE, 'w', encoding='utf-8') as f:
            json.dump(_basket_cache, f)
    except Exception:
        pass


def guess_basket(vol):
    for upto, n in BASKET_RANGES:
        if vol <= upto:
            return n
    return BASKET_RANGES[-1][1] + 1


def card_base(nm_id, basket):
    return f'https://basket-{basket:02d}.wbbasket.ru/vol{nm_id // 100000}/part{nm_id // 1000}/{nm_id}'


def fetch_card(nm_id):
    """card.json + номер корзины. Корзина: кеш -> догадка -> соседние -> расширяющийся поиск."""
    vol = nm_id // 100000
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
            txt = http_get(card_base(nm_id, b) + '/info/ru/card.json', timeout=12)
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
                    _save_basket_cache()
            return card, b
    return None, None


# ---------- Сохранение одного товара ----------
def make_tags(item, cat_tags):
    tags = []
    if item['oldPrice'] and item['oldPrice'] > item['price'] * 1.25:
        tags.append('скидка')
    if item['feedbacks'] > 1000:
        tags.append('хит')
    if item['isNew']:
        tags.append('новинка')
    if item['rating'] and float(item['rating']) >= 4.8:
        tags.append('топ рейтинг')
    for t in cat_tags:
        if len(tags) >= 4:
            break
        if t not in tags:
            tags.append(t)
    return tags[:4]


def save_product(item, cat_id, sub_name, tags, max_images, img_size):
    nm = item['id']
    d = os.path.join(OUT_DIR, cat_id, str(nm))
    pj = os.path.join(d, 'product.json')
    if os.path.exists(pj):
        with open(pj, encoding='utf-8') as f:
            return json.load(f), 'skip'

    card, basket = fetch_card(nm)
    if not card:
        return None, 'nocard'
    base = card_base(nm, basket)

    os.makedirs(d, exist_ok=True)
    images = []
    for i in range(1, min(max_images, item['pics'] or 1) + 1):
        data = None
        for size in (img_size, 'c246x328', 'big'):
            try:
                data = http_get_retry(f'{base}/images/{size}/{i}.webp', retries=2, timeout=20, binary=True)
            except Exception:
                data = None
            if data and len(data) > 1000:
                break
        if data and len(data) > 1000:
            with open(os.path.join(d, f'{i}.webp'), 'wb') as f:
                f.write(data)
            images.append(f'{i}.webp')
    if not images:
        try:
            os.rmdir(d)
        except OSError:
            pass
        return None, 'noimg'

    specs = {}
    for o in card.get('options') or []:
        n, v = o.get('name'), o.get('value')
        if n and v and n not in ('Ширина упаковки', 'Длина упаковки', 'Высота упаковки'):
            specs[n] = v
    desc = (card.get('description') or '').strip()
    title = (card.get('imt_name') or item['name']).strip()
    brand = item['brand'] or (card.get('selling') or {}).get('brand_name') or 'No name'

    product = {
        'id': nm, 'title': title, 'brand': brand, 'category': cat_id, 'subcategory': sub_name, 'tags': tags,
        'price': item['price'], 'oldPrice': item['oldPrice'],
        'rating': round(float(item['rating']), 1) if item['rating'] else 4.5, 'reviews': item['feedbacks'],
        'country': 'RU', 'stock': item['stock'] or random.randint(5, 80), 'isNew': item['isNew'],
        'colors': item['colors'], 'supplier': item['supplier'], 'description': desc, 'specs': specs, 'images': images,
        'source': {'site': 'wildberries', 'url': f'https://www.wildberries.ru/catalog/{nm}/detail.aspx', 'imported': time.strftime('%Y-%m-%d')},
    }
    with open(pj, 'w', encoding='utf-8') as f:
        json.dump(product, f, ensure_ascii=False, indent=2)
    with open(os.path.join(d, 'описание.txt'), 'w', encoding='utf-8') as f:
        f.write(f"{title}\nБренд: {brand}\nЦена: {item['price']} ₽" + (f" (старая {item['oldPrice']} ₽)" if item['oldPrice'] else '') +
                f"\nРейтинг: {product['rating']} ({product['reviews']} отзывов)\nИсточник: {product['source']['url']}\n\nОПИСАНИЕ\n{desc}\n\nХАРАКТЕРИСТИКИ\n" +
                '\n'.join(f'{k}: {v}' for k, v in specs.items()))
    return product, 'ok'


CAT_TAGS = {
    'electronics': ['гарантия', '5G', 'быстрая зарядка'], 'appliances': ['экономия энергии', 'тихая работа', 'гарантия 2 года'],
    'fashion-women': ['хлопок', 'oversize', 'тренд'], 'fashion-men': ['спорт', 'классика', 'хлопок'], 'kids': ['безопасно', 'развитие', '3+'],
    'home': ['уют', 'эко', 'ручная работа'], 'beauty': ['натуральный', 'без парабенов', 'веган'], 'health': ['сертифицировано', 'для всей семьи'],
    'sport': ['профи', 'для дома', 'лёгкий'], 'auto': ['зима', 'универсальный', 'премиум'], 'books': ['бестселлер', 'твёрдый переплёт', 'подарок'],
    'food': ['без сахара', 'органик', 'халяль'], 'pets': ['премиум', 'для котят', 'гипоаллергенно'], 'furniture': ['лофт', 'скандинавский', 'массив'],
    'garden': ['профи', 'для дома', 'аккумуляторный'], 'office': ['школа', 'офис', 'набор'], 'gaming': ['RGB', 'беспроводной', 'профи'],
    'jewelry': ['серебро', 'подарок', 'фианит'], 'bags': ['кожа', 'городской', 'водонепроницаемый'], 'digital': ['моментально', 'официально'],
}


def existing_in_sub(cat_id, sub_name):
    """Уже скачанные товары этой подкатегории (для докачки после перезапуска)."""
    out = []
    cdir = os.path.join(OUT_DIR, cat_id)
    if not os.path.isdir(cdir):
        return out
    for nm in os.listdir(cdir):
        pj = os.path.join(cdir, nm, 'product.json')
        if os.path.exists(pj):
            try:
                with open(pj, encoding='utf-8') as f:
                    p = json.load(f)
                if p.get('subcategory') == sub_name:
                    out.append(p)
            except Exception:
                pass
    return out


# ---------- Импорт одной категории ----------
def import_category(cat_id, subs, per_category, max_images, img_size, limit_per_sub=None):
    per_sub = limit_per_sub or max(1, round(per_category / len(subs)))
    results = []
    stats = {'ok': 0, 'skip': 0, 'nocard': 0, 'noimg': 0}
    for sub_name, query in subs.items():
        have = existing_in_sub(cat_id, sub_name)
        got = len(have)
        results.extend(have)
        stats['skip'] += got
        seen = {p['id'] for p in have}
        page = 1
        while got < per_sub and page <= 5:
            try:
                found = search(query, limit=30, page=page)
            except Exception as e:
                log(f'   ! поиск «{query}» стр.{page}: {e}')
                break
            if not found:
                break
            todo = []
            for it in found:
                if it['id'] in seen or it['root'] in seen:
                    continue
                seen.add(it['id']); seen.add(it['root'])
                todo.append(it)
            # качаем небольшими партиями (нужное количество + 1 запасной), пока не наберём
            while todo and got < per_sub:
                batch, todo = todo[: per_sub - got + 1], todo[per_sub - got + 1:]
                with ThreadPoolExecutor(max_workers=CDN_WORKERS) as ex:
                    futs = {ex.submit(save_product, it, cat_id, sub_name, make_tags(it, CAT_TAGS.get(cat_id, [])), max_images, img_size): it for it in batch}
                    for fu in as_completed(futs):
                        try:
                            prod, st = fu.result()
                        except Exception as e:
                            log(f'   ! {futs[fu]["id"]}: {e}')
                            continue
                        if prod and got >= per_sub:
                            # лишний запасной — убираем, чтобы не раздувать каталог
                            shutil.rmtree(os.path.join(OUT_DIR, cat_id, str(prod['id'])), ignore_errors=True)
                            continue
                        stats[st] = stats.get(st, 0) + 1
                        if prod:
                            results.append(prod); got += 1
            page += 1
        mark = '✓' if got >= per_sub else '…'
        log(f'   {mark} {sub_name:<22} {got}/{per_sub}  («{query}»)')
    log(f'   итог {cat_id}: {len(results)} товаров  {stats}')
    return results


# ---------- Сборка products.js ----------
def build_js():
    products = []
    if not os.path.isdir(OUT_DIR):
        log('нет папки products'); return 0
    for cat in sorted(os.listdir(OUT_DIR)):
        cdir = os.path.join(OUT_DIR, cat)
        if not os.path.isdir(cdir):
            continue
        for nm in sorted(os.listdir(cdir)):
            pj = os.path.join(cdir, nm, 'product.json')
            if os.path.exists(pj):
                try:
                    with open(pj, encoding='utf-8') as f:
                        p = json.load(f)
                except Exception:
                    continue
                imgs = [img for img in p.get('images', []) if os.path.exists(os.path.join(cdir, nm, img))]
                if not imgs:
                    continue
                p['images'] = [f'products/{cat}/{nm}/{img}' for img in imgs]
                products.append(p)
    products.sort(key=lambda p: (p['category'], p['subcategory'], p['id']))
    for i, p in enumerate(products):           # равномерно по 5 странам
        p['country'] = COUNTRIES[i % len(COUNTRIES)]
    os.makedirs(os.path.dirname(JS_OUT), exist_ok=True)
    with open(JS_OUT, 'w', encoding='utf-8') as f:
        f.write('/* Сгенерировано tools/import_wb.py — не редактировать вручную. Товары: %d, дата: %s */\n' % (len(products), time.strftime('%Y-%m-%d %H:%M')))
        f.write('window.MARKET_PRODUCTS = ')
        json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    by_cat = {}
    for p in products:
        by_cat[p['category']] = by_cat.get(p['category'], 0) + 1
    log(f'\nproducts.js: {len(products)} товаров, {os.path.getsize(JS_OUT) // 1024} КБ')
    log('по категориям: ' + ', '.join(f'{k}={v}' for k, v in sorted(by_cat.items())))
    return len(products)


def main():
    ap = argparse.ArgumentParser(description='Импорт товаров Wildberries в GIGASAIT Market')
    ap.add_argument('--cat', help='импортировать только эту категорию (id из import_config.json)')
    ap.add_argument('--limit', type=int, help='товаров на подкатегорию (для быстрой проверки)')
    ap.add_argument('--build-only', action='store_true', help='только пересобрать products.js')
    a = ap.parse_args()

    with open(CFG_PATH, encoding='utf-8') as f:
        cfg = json.load(f)
    if not a.build_only:
        cats = cfg['categories']
        if a.cat:
            if a.cat not in cats:
                log(f'Нет категории {a.cat}. Доступны: {", ".join(cats)}'); return
            cats = {a.cat: cats[a.cat]}
        total = 0
        t0 = time.time()
        log(f'Импорт: {len(cats)} категорий, ~{cfg["per_category"]} товаров на категорию. Можно прерывать Ctrl+C и запускать снова.\n')
        try:
            for i, (cat_id, subs) in enumerate(cats.items(), 1):
                log(f'▶ [{i}/{len(cats)}] {cat_id}')
                total += len(import_category(cat_id, subs, cfg['per_category'], cfg['max_images'], cfg['image_size'], a.limit))
        except KeyboardInterrupt:
            log('\nПрервано. Скачанное сохранено — запусти ещё раз, чтобы продолжить.')
        log(f'\nГотово: {total} товаров за {time.time() - t0:.0f} c')
    build_js()


if __name__ == '__main__':
    main()
