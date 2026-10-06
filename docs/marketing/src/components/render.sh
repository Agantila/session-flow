#!/usr/bin/env bash
# Reproduziert die 19 Komponenten-Showcase-Karten (1:1, 2000x2000) aus den
# HTML-Quellen dieses Ordners. Ergebnis: ../../components/*.png
# Nutzung:  ./render.sh                      (alle Karten)
#           ./render.sh b9-composer-chip     (nur einzelne Karten)
set -euo pipefail
cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
exec bash tools/build_all.sh "$@"
