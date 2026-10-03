#!/usr/bin/env bash
# Entfernt die Session-Flow-Installation aus dem Hermes-Desktop-Plugin-Ordner.
# Das Repo selbst bleibt unangetastet.
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
TARGET="$HERMES_HOME/desktop-plugins/session-flow"
: "${TARGET:?}"

if [[ -e "$TARGET" || -L "$TARGET" ]]; then
  rm -rf "$TARGET"
  echo "Entfernt: $TARGET"
else
  echo "Nichts zu entfernen: $TARGET existiert nicht."
fi

echo "In der App ggf.  ⌘K / Ctrl+K  ->  \"Reload desktop plugins\"  ausführen."
