#!/usr/bin/env bash
# Vollstaendige, reproduzierbare Pipeline der Komponenten-Showcase-Karten:
#   HTML-Quellen bauen -> mit Playwright (1000x1000 @2x) rendern -> sRGB taggen.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/build_cards.py
python3 tools/render_cards.py "$@"
echo "--- Kontrolle ---"
python3 - <<'PY'
import pathlib
from PIL import Image
files = sorted(pathlib.Path('../../components').glob('sf-comp-*.png'))
assert len(files) == 19, len(files)
for f in files:
    im = Image.open(f); im.load()
    assert im.size == (2000, 2000), (f.name, im.size)
print(f'OK: {len(files)} Karten, alle 2000x2000')
PY
