#!/usr/bin/env python3
"""Миниатюры для карточек каталога.

Для каждого товара из marketplace/products/<cat>/<id>/ берётся первая картинка и сохраняется
уменьшенная копия thumb.webp (не больше 420px, качество 78). В карточках сетки грузится именно она —
это в 4–6 раз меньше трафика, чем полноразмерные фото (до 1000px). Полные фото остаются для страницы товара.

Затем в marketplace/js/products.js каждому товару дописывается поле "thumb".
Запуск: python3 tools/make_thumbs.py   (нужен Pillow: pip install pillow)
"""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MP = os.path.join(ROOT, 'marketplace')
PRODUCTS_JS = os.path.join(MP, 'js', 'products.js')
MAX = 420

try:
    from PIL import Image
except ImportError:
    sys.exit('Нужен Pillow: pip install pillow')


def make_thumb(src, dst):
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return False
    im = Image.open(src)
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGB')
    im.thumbnail((MAX, MAX))
    im.save(dst, 'WEBP', quality=78, method=6)
    return True


def main():
    src = open(PRODUCTS_JS, encoding='utf-8').read()
    m = re.search(r'window\.MARKET_PRODUCTS\s*=\s*(\[.*\]);?\s*$', src, re.S)
    if not m:
        sys.exit('Не нашёл массив товаров в products.js')
    products = json.loads(m.group(1))
    made = total = 0
    for p in products:
        if not p.get('images'):
            continue
        first = os.path.join(MP, p['images'][0])
        if not os.path.exists(first):
            continue
        dst = os.path.join(os.path.dirname(first), 'thumb.webp')
        try:
            if make_thumb(first, dst):
                made += 1
        except Exception as e:  # noqa
            print('skip', first, e)
            continue
        p['thumb'] = os.path.relpath(dst, MP).replace(os.sep, '/')
        total += 1
    head = src[:m.start(1)]
    body = json.dumps(products, ensure_ascii=False, separators=(',', ':'))
    open(PRODUCTS_JS, 'w', encoding='utf-8').write(head + body + ';\n')
    size = sum(os.path.getsize(f) for f in glob.glob(os.path.join(MP, 'products', '*', '*', 'thumb.webp')))
    print(f'thumbs: {total} (новых {made}), суммарно {size/1024/1024:.1f} МБ')


if __name__ == '__main__':
    main()
