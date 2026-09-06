#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GIGASAIT — импортёр товаров с Wildberries.

Что делает:
  1. По каждой категории/подкатегории из tools/import_config.json делает поиск в публичном API WB
     (search.wb.ru) и берёт самые популярные товары.
  2. Для каждого товара качает карточку (card.json) с описанием и характеристиками
     и N картинок с CDN (basket-XX.wbbasket.ru).
  3. Складывает всё в папки:  marketplace/products/<category>/<nm_id>/
        ├─ 1.webp, 2.webp, 3.webp      картинки
        └─ product.json                 название, бренд, цена, описание, характеристики, источник
  4. Собирает единый каталог  marketplace/js/products.js  (window.MARKET_PRODUCTS = [...]),
     который подхватывает сайт.

Запуск:
  python3 tools/import_wb.py                # полный импорт (500 товаров)
  python3 tools/import_wb.py --cat food     # только одна категория
  python3 tools/import_wb.py --build-only   # только пересобрать products.js из уже скачанных папок
  python3 tools/import_wb.py --limit 3      # по 3 товара на подкатегорию (быстрая проверка)

Импорт идемпотентный: уже скачанные товары пропускаются, можно перезапускать сколько угодно.
Требуется только Python 3 (стандартная библиотека), без внешних пакетов.
"""
import argparse, json, os, re, sys, time, random, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG_PATH = os.path.join(ROOT, 'tools', 'import_config.json')
OUT_DIR = os.path.join(ROOT, 'marketplace', 'products')
JS_OUT = os.path.join(ROOT, 'marketplace', 'js', 'products.js')
COUNTRIES = ['RU', 'KZ', 'BY', 'UZ', 'KG']

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
SEARCH_URL = ('https://search.wb.ru/exactmatch/ru/common/v5/search?appType=1&curr=rub&dest=-1257786'
              '&resultset=catalog&sort=popular&spp=30&limit={limit}&page={page}&query={q}')


def log(*a):
    print(*a, flush=True)


def http_get(url, retries=3, timeout=20, binary=False):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'ru-RU,ru;q=0.9'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
                return data if binary else data.decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            last = e
        except Exception as e:
            last = e
        time.sleep(0.6 * (i + 1) + random.random() * 0.4)
    raise RuntimeError(f'GET failed {url}: {last}')


# ---------- адреса CDN Wildberries ----------
def basket_host(nm_id):
    """Номер корзины (basket-NN) вычисляется из id товара — так устроен CDN WB."""
    vol = nm_id // 100000
    ranges = [(143, 1), (287, 2), (431, 3), (719, 4), (1007, 5), (1061, 6), (1115, 7), (1169, 8), (1313, 9), (1601, 10),
              (1655, 11), (1919, 12), (2045, 13), (2189, 14), (2405, 15), (2621, 16), (2837, 17), (3053, 18), (3269, 19),
              (3485, 20), (3701, 21), (3917, 22), (4133, 23), (4349, 24), (4565, 25), (4877, 26), (5189, 27), (5501, 28),
              (5813, 29), (6125, 30), (6437, 31)]
    for upto, n in ranges:
        if vol <= upto:
            return f'basket-{n:02d}.wbbasket.ru'
    return 'basket-32.wbbasket.ru'


def card_base(nm_id, host=None):
    host = host or basket_host(nm_id)
    return f'https://{host}/vol{nm_id // 100000}/part{nm_id // 1000}/{nm_id}'


def fetch_card(nm_id):
    """card.json с описанием и характеристиками. Если корзина угадана неверно — перебираем соседние."""
    hosts = [basket_host(nm_id)]
    n = int(hosts[0].split('-')[1].split('.')[0])
    for d in (1, -1, 2, -2, 3, -3):
        if 1 <= n + d <= 40:
            hosts.append(f'basket-{n + d:02d}.wbbasket.ru')
    for h in hosts:
        try:
            txt = http_get(card_base(nm_id, h) + '/info/ru/card.json', retries=1, timeout=12)
        except Exception:
            txt = None
        if txt:
            try:
                return json.loads(txt), h
            except Exception:
                pass
    return None, None


# ---------- поиск ----------
def search(query, limit=30, page=1):
    url = SEARCH_URL.format(limit=limit, page=page, q=urllib.parse.quote(query))
    data = json.loads(http_get(url))
    prods = data.get('products') or (data.get('data') or {}).get('products') or []
    out = []
    for p in prods:
        sizes = p.get('sizes') or []
        price = None
        old = None
        for s in sizes:
            pr = s.get('price') or {}
            if pr.get('product'):
                price = pr['product'] / 100
                old = (pr.get('basic') or 0) / 100
                break
        if not price or not p.get('pics'):
            continue
        out.append({
            'id': p['id'], 'root': p.get('root'), 'name': p.get('name', '').strip(), 'brand': (p.get('brand') or '').strip(),
            'price': round(price), 'oldPrice': round(old) if old and old > price * 1.02 else None,
            'rating': p.get('reviewRating') or p.get('rating') or 0, 'feedbacks': p.get('feedbacks') or 0,
            'pics': p.get('pics') or 0, 'supplier': p.get('supplier') or '', 'colors': [c.get('name') for c in (p.get('colors') or []) if c.get('name')],
            'stock': p.get('totalQuantity') or 0, 'isNew': bool(p.get('isNew')),
        })
    return out


# ---------- сохранение одного товара ----------
def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def save_product(item, cat_id, sub_name, tags, max_images, img_size, idx):
    nm = item['id']
    d = os.path.join(OUT_DIR, cat_id, str(nm))
    pj = os.path.join(d, 'product.json')
    if os.path.exists(pj):
        with open(pj, encoding='utf-8') as f:
            return json.load(f), 'skip'

    card, host = fetch_card(nm)
    if not card:
        return None, 'nocard'
    base = card_base(nm, host)

    os.makedirs(d, exist_ok=True)
    images = []
    for i in range(1, min(max_images, item['pics'] or 1) + 1):
        try:
            data = http_get(f'{base}/images/{img_size}/{i}.webp', retries=2, timeout=20, binary=True)
        except Exception:
            data = None
        if data and len(data) > 1000:
            with open(os.path.join(d, f'{i}.webp'), 'wb') as f:
                f.write(data)
            images.append(f'{i}.webp')
    if not images:
        # без картинок товар не нужен
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
        'id': nm,
        'title': title,
        'brand': brand,
        'category': cat_id,
        'subcategory': sub_name,
        'tags': tags,
        'price': item['price'],
        'oldPrice': item['oldPrice'],
        'rating': round(float(item['rating']), 1) if item['rating'] else 4.5,
        'reviews': item['feedbacks'],
        'country': COUNTRIES[idx % len(COUNTRIES)],
        'stock': item['stock'] or random.randint(5, 80),
        'isNew': item['isNew'],
        'colors': item['colors'],
        'supplier': item['supplier'],
        'description': desc,
        'specs': specs,
        'images': images,
        'source': {'site': 'wildberries', 'url': f'https://www.wildberries.ru/catalog/{nm}/detail.aspx', 'imported': time.strftime('%Y-%m-%d')},
    }
    with open(pj, 'w', encoding='utf-8') as f:
        json.dump(product, f, ensure_ascii=False, indent=2)
    with open(os.path.join(d, 'описание.txt'), 'w', encoding='utf-8') as f:
        f.write(f"{title}\nБренд: {brand}\nЦена: {item['price']} ₽" + (f" (старая {item['oldPrice']} ₽)" if item['oldPrice'] else '') +
                f"\nРейтинг: {product['rating']} ({product['reviews']} отзывов)\nИсточник: {product['source']['url']}\n\nОПИСАНИЕ\n{desc}\n\nХАРАКТЕРИСТИКИ\n" +
                '\n'.join(f'{k}: {v}' for k, v in specs.items()))
    return product, 'ok'


# ---------- теги ----------
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


CAT_TAGS = {
    'electronics': ['гарантия', '5G', 'быстрая зарядка'], 'appliances': ['экономия энергии', 'тихая работа', 'гарантия 2 года'],
    'fashion-women': ['хлопок', 'oversize', 'тренд'], 'fashion-men': ['спорт', 'классика', 'хлопок'], 'kids': ['безопасно', 'развитие', '3+'],
    'home': ['уют', 'эко', 'ручная работа'], 'beauty': ['натуральный', 'без парабенов', 'веган'], 'health': ['сертифицировано', 'для всей семьи'],
    'sport': ['профи', 'для дома', 'лёгкий'], 'auto': ['зима', 'универсальный', 'премиум'], 'books': ['бестселлер', 'твёрдый переплёт', 'подарок'],
    'food': ['без сахара', 'органик', 'халяль'], 'pets': ['премиум', 'для котят', 'гипоаллергенно'], 'furniture': ['лофт', 'скандинавский', 'массив'],
    'garden': ['профи', 'для дома', 'аккумуляторный'], 'office': ['школа', 'офис', 'набор'], 'gaming': ['RGB', 'беспроводной', 'профи'],
    'jewelry': ['серебро', 'подарок', 'фианит'], 'bags': ['кожа', 'городской', 'водонепроницаемый'], 'digital': ['моментально', 'официально'],
}


# ---------- импорт категории ----------
def import_category(cat_id, subs, per_category, max_images, img_size, limit_per_sub=None):
    per_sub = limit_per_sub or max(1, per_category // len(subs))
    results = []
    seen = set()
    stats = {'ok': 0, 'skip': 0, 'nocard': 0, 'noimg': 0}
    for sub_name, query in subs.items():
        got = 0
        page = 1
        while got < per_sub and page <= 3:
            try:
                found = search(query, limit=per_sub * 3, page=page)
            except Exception as e:
                log(f'   ! поиск "{query}" стр.{page}: {e}')
                break
            if not found:
                break
            # параллельно качаем карточки и картинки
            todo = [it for it in found if it['id'] not in seen and it['root'] not in seen][: per_sub - got]
            for it in todo:
                seen.add(it['id']); seen.add(it['root'])
            with ThreadPoolExecutor(max_workers=6) as ex:
                futs = {ex.submit(save_product, it, cat_id, sub_name, make_tags(it, CAT_TAGS.get(cat_id, [])), max_images, img_size, len(results) + i): it
                        for i, it in enumerate(todo)}
                for fu in as_completed(futs):
                    try:
                        prod, st = fu.result()
                    except Exception as e:
                        log(f'   ! {futs[fu]["id"]}: {e}'); continue
                    stats[st] = stats.get(st, 0) + 1
                    if prod and got < per_sub:
                        results.append(prod); got += 1
            page += 1
        log(f'   {sub_name:<22} {got}/{per_sub}  («{query}»)')
    log(f'   итог {cat_id}: {len(results)} товаров, {stats}')
    return results


# ---------- сборка products.js ----------
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
                with open(pj, encoding='utf-8') as f:
                    p = json.load(f)
                p['images'] = [f'products/{cat}/{nm}/{img}' for img in p['images']]
                products.append(p)
    # равномерно распределяем страны (по 100 на 5 стран при 500 товарах) — перезаписываем детерминированно
    products.sort(key=lambda p: (p['category'], p['subcategory'], p['id']))
    for i, p in enumerate(products):
        p['country'] = COUNTRIES[i % len(COUNTRIES)]
    with open(JS_OUT, 'w', encoding='utf-8') as f:
        f.write('/* Сгенерировано tools/import_wb.py — не редактировать вручную. Товары: %d, дата: %s */\n' % (len(products), time.strftime('%Y-%m-%d %H:%M')))
        f.write('window.MARKET_PRODUCTS = ')
        json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    log(f'products.js: {len(products)} товаров, {os.path.getsize(JS_OUT) // 1024} КБ')
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
            cats = {a.cat: cats[a.cat]}
        total = 0
        t0 = time.time()
        for cat_id, subs in cats.items():
            log(f'\n▶ {cat_id}')
            total += len(import_category(cat_id, subs, cfg['per_category'], cfg['max_images'], cfg['image_size'], a.limit))
        log(f'\nСкачано/найдено: {total} товаров за {time.time() - t0:.0f} c')
    build_js()


if __name__ == '__main__':
    main()
