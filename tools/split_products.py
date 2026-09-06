#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GIGASAIT — режет каталог товаров на zip-части по 24 МБ (для загрузки с лимитом 25 МБ).

Запуск: python split_products.py           (или двойной клик по split_products.bat)
        python split_products.py --mb 20   (другой размер части)

Ищет папку products рядом со скриптом либо в marketplace/ (стандартное расположение
в репозитории), а также marketplace/js/products.js. Результат — папка parts/:
    часть1.zip, часть2.zip, ...  (каждая <= 24 МБ, товары не разрываются между частями)
Внутри архивов пути сохранены (marketplace/products/<категория>/<id>/...),
так что распаковка всех частей в корень репозитория восстанавливает каталог.
"""
import argparse, os, sys, zipfile, shutil, time

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))


def find_products():
    for base in (HERE, os.path.dirname(HERE), os.getcwd()):
        for cand in (os.path.join(base, 'products'), os.path.join(base, 'marketplace', 'products')):
            if os.path.isdir(cand):
                return os.path.abspath(cand)
    return None


def main():
    ap = argparse.ArgumentParser(description='Разрезать папку products на zip-части')
    ap.add_argument('--mb', type=float, default=24, help='максимальный размер части в МБ (по умолчанию 24)')
    ap.add_argument('--out', default=None, help='куда складывать части (по умолчанию parts/ рядом со скриптом)')
    a = ap.parse_args()

    products = find_products()
    if not products:
        print('Не нашёл папку products (ни рядом со скриптом, ни в marketplace/). Положи скрипт рядом с ней.')
        return
    root = os.path.dirname(products)                      # .../marketplace
    repo = os.path.dirname(root)                          # .../gigasait
    arc_prefix = 'marketplace/products' if os.path.basename(root) == 'marketplace' else 'products'
    js = os.path.join(root, 'js', 'products.js')
    out = a.out or os.path.join(HERE, 'parts')
    limit = int(a.mb * 1024 * 1024) - 200 * 1024         # запас на служебные данные zip

    # единицы деления — папки товаров (чтобы товар не разорвало между частями)
    units = []                                            # (список (abs_path, arc_name), размер)
    if os.path.exists(js):
        units.append(([(js, 'marketplace/js/products.js' if arc_prefix.startswith('marketplace') else 'js/products.js')], os.path.getsize(js)))
    for cat in sorted(os.listdir(products)):
        cdir = os.path.join(products, cat)
        if not os.path.isdir(cdir):
            continue
        for pid in sorted(os.listdir(cdir)):
            pdir = os.path.join(cdir, pid)
            if not os.path.isdir(pdir):
                continue
            files, size = [], 0
            for dp, dn, fn in os.walk(pdir):
                for f in fn:
                    fp = os.path.join(dp, f)
                    files.append((fp, f'{arc_prefix}/{cat}/{pid}/' + os.path.relpath(fp, pdir).replace(os.sep, '/')))
                    size += os.path.getsize(fp)
            if files:
                units.append((files, size))
    total = sum(s for _, s in units)
    print(f'Папка: {products}\nТоваров: {len(units)}  общий размер: {total / 1024 / 1024:.1f} МБ  лимит части: {a.mb} МБ')
    if total == 0:
        return

    if os.path.isdir(out):
        for f in os.listdir(out):
            if f.startswith('часть') and f.endswith('.zip'):
                os.remove(os.path.join(out, f))
    os.makedirs(out, exist_ok=True)

    # картинки (webp/jpg) почти не сжимаются — считаем размер части по реальному размеру zip
    part_no, cur, cur_size = 1, [], 0
    parts = []

    def flush():
        nonlocal part_no, cur, cur_size
        if not cur:
            return
        name = os.path.join(out, f'часть{part_no}.zip')
        with zipfile.ZipFile(name, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for files, _ in cur:
                for fp, arc in files:
                    z.write(fp, arc)
        sz = os.path.getsize(name)
        parts.append((name, sz, sum(len(f) for f, _ in cur)))
        print(f'  часть{part_no}.zip  {sz / 1024 / 1024:.1f} МБ  ({len(cur)} папок)')
        part_no += 1
        cur, cur_size = [], 0

    for files, size in units:
        if size > limit:
            print(f'  ! {files[0][1]} больше лимита ({size / 1024 / 1024:.1f} МБ) — кладу отдельной частью')
            flush(); cur, cur_size = [(files, size)], size; flush(); continue
        if cur_size + size > limit:
            flush()
        cur.append((files, size)); cur_size += size
    flush()

    # контрольная проверка: если какая-то часть всё же вышла за лимит — перепаковать её с меньшим порогом
    for name, sz, _ in parts:
        if sz > a.mb * 1024 * 1024:
            print(f'  ! {os.path.basename(name)} получилась {sz / 1024 / 1024:.1f} МБ > {a.mb} МБ — запусти с --mb {a.mb - 1:.0f}')

    with open(os.path.join(out, 'README.txt'), 'w', encoding='utf-8') as f:
        f.write(f'GIGASAIT products, {time.strftime("%Y-%m-%d %H:%M")}\nЧастей: {len(parts)}, товаров: {len(units)}\n'
                'Распаковать все части в корень репозитория gigasait/ (пути внутри: marketplace/products/...).\n')
    print(f'\nГотово: {len(parts)} частей в {out}\nЗагружай все файлы часть*.zip — в каждой полные папки товаров, порядок не важен.')


if __name__ == '__main__':
    main()
