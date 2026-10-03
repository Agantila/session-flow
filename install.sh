#!/usr/bin/env bash
# Installiert Session Flow als Hermes-Desktop-Plugin.
#
#   ./install.sh          Kopie nach $HERMES_HOME/desktop-plugins/session-flow/
#   ./install.sh --link   Entwicklungsmodus: Symlink des Repos (Hot-Reload beim Speichern)
#
# HERMES_HOME ist standardmäßig ~/.hermes (oder $HERMES_HOME, wenn gesetzt).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
TARGET="$HERMES_HOME/desktop-plugins/session-flow"
: "${TARGET:?}"

MODE="copy"
if [[ "${1:-}" == "--link" ]]; then
  MODE="link"
fi

if [[ ! -f "$REPO_DIR/plugin.js" ]]; then
  echo "Fehler: $REPO_DIR/plugin.js nicht gefunden — bitte aus dem Repo-Verzeichnis starten." >&2
  exit 1
fi

mkdir -p "$HERMES_HOME/desktop-plugins"

if [[ "$MODE" == "link" ]]; then
  if [[ -e "$TARGET" && ! -L "$TARGET" ]]; then
    rm -rf "$TARGET"
  fi
  rm -f "$TARGET"
  ln -s "$REPO_DIR" "$TARGET"
  echo "Verknüpft (Entwicklungsmodus): $TARGET -> $REPO_DIR"
else
  mkdir -p "$TARGET"
  cp "$REPO_DIR/plugin.js" "$TARGET/plugin.js"
  echo "Installiert: $TARGET/plugin.js"
fi

echo
echo "Weiter in der App:  ⌘K / Ctrl+K  ->  \"Reload desktop plugins\""
echo "(oder die App einmal neu starten — das Plugin lädt danach automatisch.)"
