#!/usr/bin/env bash
# Reproduziert die 8 Heroes (16:9, 3200x1800) und 3 4:5-Crops (2000x2500)
# aus den HTML-Quellen dieses Ordners. Ergebnis:
#   ../../heroes/*.png   ../../crops/*.png
# Nutzung:  ./render.sh            (alle Motive)
#           ./render.sh a4-composer-glass   (einzelnes Motiv)
set -euo pipefail
cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
node render_heroes.mjs "$@"
python3 add_srgb_heroes.py
echo "--- Kontrolle ---"
python3 - <<'PY'
import pathlib
from PIL import Image
h = sorted(pathlib.Path('../../heroes').glob('sf-hero-*.png'))
c = sorted(pathlib.Path('../../crops').glob('sf-hero-*.png'))
assert len(h) == 8 and len(c) == 3, (len(h), len(c))
for f in h:
    assert Image.open(f).size == (3200, 1800), (f.name, Image.open(f).size)
for f in c:
    assert Image.open(f).size == (2000, 2500), (f.name, Image.open(f).size)
print(f'OK: {len(h)} Heroes 3200x1800, {len(c)} Crops 2000x2500')
PY
