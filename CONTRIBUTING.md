# Mitwirken — Session Flow

Danke für dein Interesse! Dieses Repo ist bewusst einfach gehalten: **eine
Datei** (`plugin.js`), keine Abhängigkeiten, kein Build. Beiträge sind als
Issues und Pull Requests willkommen.

## Schnellstart für Entwickler

```bash
git clone <repo-url> session-flow
cd session-flow

# Dev-Loop einrichten (Symlink ins Plugin-Verzeichnis):
./install.sh --link

# Nach jeder Änderung prüfen (Syntax + i18n-Parität):
npm run check
```

Mit `--link` lädt die App das Plugin bei jedem Speichern neu (Hot-Reload).
Ein erfolgreicher Reload ist **still** — Details und Verifikations-Rezepte
stehen in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) und
[docs/APP-INTEGRATION.md](docs/APP-INTEGRATION.md).

## Die Hausregeln (sonst lädt das Plugin nicht)

1. **Kein JSX.** Nur `jsx()` / `jsxs()` aus `react/jsx-runtime` — die Datei wird
   unkompiliert als ESM geladen.
2. **Nur drei Imports:** `@hermes/plugin-sdk`, `react`, `react/jsx-runtime`.
3. **Keine hartkodierten Farben.** Ausschließlich Theme-Variablen
   (`var(--ui-…)`, `var(--dt-…)`, `color-mix(...)`).
4. **Keine Backticks im CSS-Template-Literal** — auch nicht in Kommentaren.
   Ein einzelner Backtick beendet das Template und bricht das Plugin
   (`npm run check` erkennt das vor dem Install).
5. **Aufräumen:** Timer/Listener über `ctx.setInterval`/`ctx.addEventListener`;
   eigene Observer, `<style>`-Tags und DOM-Markierungen in `ctx.onDispose`
   zurückbauen.
6. **i18n:** Neue Keys **immer in beiden Bundles** (`EN` und `DE`) anlegen —
   der Audit in `npm run check` erzwingt Parität.
7. **Alle Einstellungen mit Subtext.** Jede Option in der Einstellungsseite
   bekommt eine kurze `…Desc`-Erklärung (beide Sprachen).

## Änderungen einreichen

1. Fork bzw. Branch anlegen: `feat/…`, `fix/…`, `docs/…`.
2. `npm run check` muss grün sein.
3. Wenn möglich: live verifizieren (Dev-Loop + Log-Check, siehe unten) und das
   Ergebnis in der PR-Beschreibung nennen.
4. PR öffnen; das Template führt durch die Checkliste.
5. **CHANGELOG.md** aktualisieren (Keep-a-Changelog-Stil, Version + Datum).
6. Version in `package.json` und `const VERSION` in `plugin.js` angleichen.

## Live verifizieren (Kurzfassung)

- **Nur Fehler landen im Log:** `~/.hermes/logs/desktop.log` bekommt
  Renderer-`console.error` — `console.info`/`console.warn` nicht. Für einen
  positiven Ladebeweis temporär `console.error(...)` in `register()` setzen.
- **Versions-Stempel:** Das Plugin schreibt `_meta` in seinen Storage
  (`hermes.plugin.session-flow._meta`); nach ~1 Minute im LevelDB sichtbar:
  `strings ~/.config/Hermes/Local\ Storage/leveldb/*.ldb | grep hermes.plugin`.
- **Hot-Reload** feuert auch beim einfachen Überschreiben der Datei (`cp`).

## Veröffentlichen auf GitHub

```bash
# Im Repo-Ordner:
git remote add origin git@github.com:<owner>/session-flow.git
git push -u origin main
```

Empfehlungen für das Repo:

- Name: `session-flow` (muss NICHT dem Plugin-Ordner entsprechen, aber passt).
- Topics: `hermes`, `hermes-desktop`, `plugin`, `desktop-plugin`, `ui`.
- `main` als Default-Branch ist bereits gesetzt; die CI (`.github/workflows/check.yml`)
  läuft automatisch bei Push/PR.

## Projektstruktur (wo was hingehört)

| Pfad | Inhalt |
|---|---|
| `plugin.js` | Der gesamte Plugin-Code. |
| `docs/SETTINGS.md` | Optionen-Referenz (bei neuen Optionen pflegen!). |
| `docs/DEVELOPMENT.md` | Architektur, Dev-Workflow, Troubleshooting. |
| `docs/APP-INTEGRATION.md` | App-Hooks & fragile Selektoren + Verifikation. |
| `docs/ROADMAP.md` | Ideen & bekannte Grenzen. |
| `scripts/check.mjs` | Pre-Flight-Check (Syntax + i18n). |

## Lizenz

Mit dem Einreichen eines Beitrags stimmst du zu, dass dein Beitrag unter der
[MIT-Lizenz](LICENSE) des Projekts veröffentlicht wird.
