#!/usr/bin/env bash
# Сборка zip-релиза сайта: ./tools/build_release.sh 0.1.0
# Результат: release/gigasait-v0.1.0.zip — внутри папка gigasait/ с главным сайтом
# и вложенными разделами (marketplace/, games/, community/).
set -euo pipefail
VER="${1:?Укажи версию, например 0.1.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/release/gigasait-v$VER.zip"
TMP="$(mktemp -d)"
mkdir -p "$TMP/gigasait" "$ROOT/release"
cp -r "$ROOT/index.html" "$ROOT/assets" "$ROOT/marketplace" "$ROOT/games" "$ROOT/community" "$TMP/gigasait/"
# проставляем версию в футерах
sed -i "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$VER/g" "$TMP/gigasait/index.html" "$TMP/gigasait/marketplace/index.html"
cat > "$TMP/gigasait/README.txt" <<EOF
GIGASAIT v$VER
==============
Как открыть: распакуй архив и открой файл gigasait/index.html в браузере (двойной клик).
Разделы: index.html (главное меню) -> marketplace/ (маркетплейс), games/, community/.
Сайт работает без сервера — только HTML/CSS/JS, данные хранятся в localStorage браузера.
EOF
rm -f "$OUT"
(cd "$TMP" && zip -qr "$OUT" gigasait)
rm -rf "$TMP"
echo "OK: $OUT ($(du -h "$OUT" | cut -f1))"
