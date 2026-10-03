# App-Integration — Hooks, Tokens, Techniken & Verifikation

Dieses Dokument listet **alles**, worauf sich das Plugin in der Hermes-Desktop-
Oberfläche stützt: DOM-Anker, Theme-Tokens, Animations-Techniken — inklusive
Risiko-Einschätzung und der Rezepte, mit denen man live verifiziert, dass ein
Feature wirklich lädt und greift. **Bei App-Updates zuerst hier nachsehen.**

> Faustregel: Anker mit `data-slot` sind die stabilste Ebene, Tailwind-Klassen
> die fragilste. Wo wir Klassen matchen, steht hier WARUM und was die Alternative ist.

## DOM-Anker (Selektoren)

| Selektor | Wofür | Risiko / Hinweise |
|---|---|---|
| `[data-slot='composer-root']` | Glass-Fill-Variable (`--composer-fill`) + Radius-Quelle (`rounded-2xl`) | stabil; Wert des Radius hängt am Theme-Skalar |
| `[data-slot='composer-surface']` | Composer-Box: Fläche/Verlauf/Blur + Radius-Messung | stabil; `relative z-4 isolate`, 1px Border |
| `[data-slot='composer-surface'] > [class~='-z-10']` | Fill-Layer → **Glow-Ring-Host** (transparent gemacht, Maske + `::before`) | Klasse `-z-10` = Tailwind-Konvention; wenn sie wandert, verliert nur der Ringhalt (Regeln greifen nicht mehr), kein Bruch |
| `[data-tour='model-pill']` | Chips-Scope (nur Primär-Chat) | stabil; Tiles haben den Marker nicht |
| `[data-testid='reasoning-pill']` | Chips-Scope (überall) | stabil |
| `[data-slot='statusbar']` | Statusleisten-Scope | stabil |
| `[role='tab']` + `.pane-tab-content` | **UI-Tabs** (alle Tab-Varianten) — JS-Marke `data-sf-ui-tab` | **Wichtig:** Session-Tabs im Content-Bereich sind in ein Kontextmenü gewrappt; der Trigger ÜBERSCHREIBT `data-slot` (`context-menu-trigger`). Nie auf `data-slot='pane-tab'` selektieren! |
| `[data-tree-tab^='session-tile:']` | Session-Zuordnung der Tabs (`session-tile:<storedSessionId>`) für den Busy-Glow | stabil (Pane-ID-Schema der App) |
| `> [class~='inset-y-0']` (in `[data-closeable]`-Tabs) | Close-Wrapper (Sichtbarkeit/Fade) | Klasse = Tailwind; Alternative: `:has(> button[aria-label])` |
| `.pane-tab-content [class~='truncate']` | Tab-Label (Größe/Schreibweise) | Klasse = Tailwind-Utility |
| `[data-renderer-animations-paused]` (auf `:root`) | unsere Arcs pausieren wie die App | stabil (App-eigenes Attribut) |
| `[data-hud-shell]` | HUD-Modus: dort bewusst keine eigenen Filter (App nullt global mit `!important`) | stabil |

## Theme-Tokens (CSS-Variablen)

| Token | Verwendung |
|---|---|
| `--ui-accent` | Akzentfarbe: Tönung, Verläufe, Glow |
| `--dt-card` | Basisfläche des Glass-Fills |
| `--ui-row-hover-background` / `--ui-row-active-background` | Hover/aktiv von Nav-Chips & UI-Tabs (Sidebar-Vokabular) |
| `--ui-control-active-background` | Hover-Chip des Close-Buttons |
| `--ui-editor-surface-background` | Hintergrund der sticky Settings-Nav |
| `--ui-sidebar-surface-background` | (App) Tab-Strip-Hintergrund |
| `--pane-tab-close-width` | Breite der Close-Klickfläche (App-Variable, wir überschreiben sie) |
| `--radius-scalar` | Theme-Radius-Skalar (echte Variable); `--radius-2xl` existiert NICHT zur Laufzeit (Tailwind inlined) |
| `--ui-text-*`, `--ui-stroke-*` | Text/Rahmen überall |

**Regel:** Keine hartkodierten Farben. Alles über Tokens + `color-mix(...)`.

## Übernommene Techniken der App

- **`.arc-border`** (App): Mask-Ring + `transform`-animierter 240 %-Verlauf
  (`repeating-linear-gradient`), rein auf dem Compositor. Von uns 1:1
  nachgebaut (`@keyframes sf-arc-ring` auf dem Composer) und als
  **Conic-Variante** (`@property --sf-arc-turn` + Maske) für kleine Flächen
  (Chips, Statusleiste, UI-Tabs) umgesetzt.
- **`prefers-reduced-transparency`**: Die App nullt global alle
  `backdrop-filter` mit `!important` — wir setzen deshalb NIE `!important`
  auf `backdrop-filter`, damit der Gate weiter gewinnt.
- **`prefers-reduced-motion`**: alle unsere Animationen gehen auf `none`.
- **Pane-Tab-Geometrie**: Chip-Optik über `height:auto` + `margin-block`;
  Label-Fade via `mask-image` (wie die App beim Hover-Schließen).
- **Radius-Konzentrizität**: Innen liegende Ringe brauchen `r − 1px`
  (Border-Breite); wir **messen** den echten Surface-Radius zur Laufzeit
  (`getComputedStyle(...).borderTopLeftRadius` → `--sf-arc-radius`, 4-s-Refresh),
  weil Theme-Variablen wie `--radius-2xl` inline kompiliert und zur Laufzeit
  leer sind.

## Verifikations-Rezepte (Linux, Wayland/KDE)

| Ziel | Weg |
|---|---|
| **Ladefehler sehen** | `~/.hermes/logs/desktop.log`: `[renderer console:main] [plugins] runtime load failed (session-flow) …`. Fehler → Toast + Logzeile. |
| **Positiver Ladebeweis** | Nur `console.error` erreicht das Log — temporär eine `console.error`-Marke in `register()` setzen, speichern/kopieren, ~10 s warten, Log prüfen. |
| **Version live prüfen** | `strings ~/.config/Hermes/Local\ Storage/leveldb/*.ldb | grep -A1 'hermes.plugin.session-flow._meta'` → `{"loadedAt":…,"version":"x.y.z"}` (Flush ~1 min). |
| **Hot-Reload** | Feuert auf Datei-Überschreiben (`cp`) im Plugin-Ordner; erfolgreicher Load ist still. Die LevelDB schreibt zudem **alle ~60 s periodisch** — ein mtime-Bump allein ist KEIN Reload-Beweis. |
| **DOM-Zustand messen** | Temporären Debug per `console.error` + `getComputedStyle`/`querySelectorAll` in ein Intervall hängen; Ausgabe im Log lesen (Screenshot geht unter Wayland nicht). |

## Wartungs-Checkliste bei App-Updates

1. `npm run check` (Syntax + i18n) — fängt lokale Regressions sofort.
2. Ladefehler-Log prüfen (oben).
3. Kurz gegengoogeln: `[data-slot='composer-surface']`, `role=tab`-Struktur,
   `--pane-tab-close-width`, `.arc-border` — falls die App sie umbenannt hat,
   greifen die entsprechenden Dok-Abschnitte (Risiko-Spalte).
4. `docs/DEVELOPMENT.md` → Troubleshooting-Tabelle; `docs/SETTINGS.md` bei
   neuen/geänderten Optionen aktualisieren.
