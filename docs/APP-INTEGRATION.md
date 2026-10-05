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
| `[data-slot='composer-root'] .codicon-add` (nächster `button`-Vorfahre) | **Projekt-Kontext-Chip (v1.21)**: Wrapper-Button = Injektionsanker, Chip als erstes Kind davor (Eingabezeile, vor dem „+“) | stabil (Codicon-Name `add` nur am Composer-Add-Button); bei Umbau der Composer-Controls verliert nur der Chip seinen Halt |
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
| `[data-pane-host]` | Pane-Container für Content-Shell (Radius/Schatten) + Hintergrund-Layer | **Anchor-positioniert mit Inline-Styles** — CSS darf hier NIE Geometrie/overflow ändern, nur additiv färben/runden; Overlays über `[data-pane-overlay]` ausnehmen |
| `[data-pane-hidden]` | inaktiver Keep-Alive-Tab (gleiche Rect wie der sichtbare!) | Video-Gating: nur sichtbare Panes dekodieren lassen |
| `div:has(> [role='tablist'] [data-tree-tab^='session-tile:'])` | **Tab-Selektor-Modus** (`tabs.asTabSelector`): blendet NUR Streifen mit mind. einem Session-Tile-Tab aus | `:has()` ist bereits anderswo im Plugin in Gebrauch (siehe `nolead`-Regel); trifft **jede** Pane mit Session-Tabs (auch gestapelte im Content-Bereich) — Terminal/Dateien ohne Session-Tabs bleiben unberührt. Risiko: strukturelle Regel, kein `data-slot` — bei App-Refactor hier zuerst nachsehen. |
| `[data-sessions-mode]` + `[data-sessions-project]` | **Sidebar-Sync-Anker** (v1.19.0): MutationObserver im Plugin überwacht den Sidebar-Container und die Projekt-Rows, um App→Plugin-Sessions-/Projekt-Updates nachzuziehen (Gateway feuert dafür keine Events). | strukturelle Regel (kein `data-slot`); Container/Row-Attribut muss bei App-Refactor erhalten bleiben, sonst verpasst der Observer Mutationen. Verifikation: ein `pane.dispatchEvent(new Event('focus'))` + `document.dispatchEvent(new Event('visibilitychange'))` reicht als Plugin→App-Kick. |
| `[data-tour^='sidebar-nav-kanban']` | **Kanban-Feature-Detect** (v1.20): die App markiert jede SIDEBAR_NAV-Zeile mit `data-tour='sidebar-nav-<id>'`; Plugin-Beiträge tragen das Namensraum-Suffix `:nav` (live verifiziert: `sidebar-nav-kanban:nav`) — daher Präfix-Match. Zweites Signal: offener Kanban-Drawer `.kanban-drawer-content`. | Tour-Handles sind app-stabil (gleiche Kategorie wie `data-tour='model-pill'`); falls die App das Schema ändert, fällt nur der Kanban-Button in der Schnellstart-Zeile weg (niemals ein toter Button). |
| `window.hermesDesktop.selectPaths` | nativer Datei-Picker (IPC `hermes:selectPaths`, Optionen `{ title, filters, multiple }`) → absolute Pfade | vor Nutzung auf Existenz prüfen; App-APIs können sich ändern |
| `window.hermesDesktop.revealPath` | OS-Dateimanager an Pfad öffnen (IPC `hermes:revealPath`) | Remote-safe; Plugin prüft Existenz und zeigt Hinweis-Toast, falls die Door im aktuellen Build fehlt |

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
| `--ui-accent` | Akzent der Kern-UI (Basis aller Fills/Strokes/Hover/Aktiv-Zustände via `color-mix`); Quelle: `--theme-midground` | 
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

- **App-CSS ist gelayert** (`@layer base/utilities/components`) — Plugin-`<style>`
  ist **unlayered** und sticht jede Layer-Deklaration **ohne `!important`**.
  Darauf baut der Akzent-Override (`html[data-sf-accent] → --ui-accent`); die
  App-Definition `--ui-accent: var(--theme-midground)` liegt in `@layer base`.
- **`hermes-media://stream/<encodeURIComponent(pfad)>`**: App-Protokoll für
  lokale Dateien (Range-fähig, Video-Seeking, umgeht den Data-URL-Größen-Cap).
  Der Renderer baut es in `src/lib/media.ts` (`mediaStreamUrl`); das Plugin
  repliziert die Form. Live verifiziert: Bild-Layer + laufendes Video
  (readyState 4, `currentTime` läuft) über `hermes-media://stream/…`.

## Plugin-Doors für Session-Aktionen (Hermes-Optionsübernahme, v1.7)

| Aktion | Door | Hinweise |
|---|---|---|
| Neue Session in Projekt | `projects.list` (→ `active_id`, `primary_path`) + `localStorage['hermes.desktop.projectScope']` + `session.create` | Params wie die App: `{cols:96, source:'desktop', cwd?, cwd_explicit?, profile?}`; Scope-Werte: `__all_projects__` = Übersicht, `__no_project__` = Home (abgekoppelt) |
| Umbenennen | `session.title {session_id, title}` | **Nur live/geladen** (Runtime-ID aus `$liveMap` bevorzugen; stored-ID ⇒ „session not found“). Die App nutzt für persistierte Zeilen REST — kein Plugin-Door |
| Zweig erstellen | `session.branch_stored {parent_session_id, cols, source, cwd?, idempotency_key}` | Lehnt leere Sessions ab („nothing to branch — send a message first“); Antwort: `stored_session_id` |
| In Projekt verschieben | `session.workspace.move {session_key, cwd}` | cwd = `primary_path` des Zielprojekts; seit v1.14.0 auch per Drag & Drop auf einen Projekt-Ordner-Header (Projekt-Gruppierung) |
| Archivieren | `session.archive {session_id, archived}` | akzeptiert stored-id/-key/-title; Runtime-ID first |
| Löschen | `session.delete {session_id}` | **verweigert laufende Sessions (4023)** → vorher `session.close {session_id: runtimeId}` |
| Im Terminal öffnen | `window.hermesDesktop.openSessionInTerminal(id)` (IPC) | stored-id ok (tui resume); Rückgabe `{ok}` prüfen |
| ID kopieren | `window.hermesDesktop.writeClipboard(text)` (IPC) | Feature-Detect |
| Info-Dichte folgen | SDK `host.settings.get/subscribe('sessionListDensity')` | Werte `compact`/`comfortable`/`detailed`; App-persistiert unter localStorage `hermes.desktop.sessionListDensity` (Fallback-Lesepfad) |
| Live-Kennzahlen für die Dichte | RPC `session.active_list` (ohnehin gepollt) | Items liefern zusätzlich `model` und `last_active` (Epoch-Sekunden) — seit v1.14.0 für „zuletzt aktiv“/Modell in der Komfortabel-Detail-Zeile genutzt, kein Extra-Call |
| Start-/Reconnect-Gate | SDK `host.state.gateway` (readonly-Atom, Werte `idle`/`connecting`/`open`/`closed`/`error`) | Seit v1.18.0: Initial-Daten-Satz + Reconnect-Nachziehen hängen am Socket-Status (`scheduleGatewayBootstrap()`). Vor dem ersten `open` wirft `host.request` ab („Hermes gateway unavailable“) — niemals blind beim Load laden. Fällt das Atom in einem älteren Build weg (`typeof listen !== 'function'`), fällt das Gate auf sofortiges Laden + 20-s-Fallback zurück |
| Kontextfenster lesen | RPC `session.context_breakdown {session_id: runtimeId}` | **Nur LIVE — Runtime-ID Pflicht** (stored-ID ⇒ „session not found“); read-only (chars/4, kein Provider-Call, kein Cache-Impact); Ergebnis `{context_used, context_max, context_percent, context_estimated}`; `context_max: 0` = Agent nicht gebaut → überspringen (v1.10); seit v1.14.0 läuft der Fetch auch ohne `showContext` bei Dichte `detailed` (Stats-Zeile „Kontext %“, Gate `contextInfoNeeded()`) |
| Nicht verfügbar | gelesen/ungelesen, Export | App-lokale Stores bzw. Renderer-Bibliothek ohne Plugin-Door |

Hinweis: `host.setPersistedSessionHidden` ist ein **REST**-Door und 404t für
runtime-only (noch nicht persistierte) Sessions — für die Runtime-Stufe
`session.set_hidden`/`session.close` (Gateway-RPC) verwenden.

Hinweis (IDs): Die Live-Map (Poll über `session.active_list`) liefert beide
IDs — **Schlüssel = Runtime-ID, `session_key` = durable Stored-ID**. Alle
Live-Doors (`SessionParams`: `session.title`, `session.usage`,
`session.context_breakdown`, …) adressieren über die **Runtime-ID**.

## Verifikations-Rezepte (Linux, Wayland/KDE)

| Ziel | Weg |
|---|---|
| **Ladefehler sehen** | `~/.hermes/logs/desktop.log`: `[renderer console:main] [plugins] runtime load failed (session-flow) …`. Fehler → Toast + Logzeile. |
| **Positiver Ladebeweis** | Nur `console.error` erreicht das Log — temporär eine `console.error`-Marke in `register()` setzen, speichern/kopieren, ~10 s warten, Log prüfen. |
| **Version live prüfen** | `strings ~/.config/Hermes/Local\ Storage/leveldb/*.ldb | grep -A1 'hermes.plugin.session-flow._meta'` → `{"loadedAt":…,"version":"x.y.z"}` (Flush ~1 min). |
| **Hot-Reload** | Feuert auf Datei-Überschreiben (`cp`/Speichern) im Plugin-Ordner — auch bei **Symlink-Install** (`install.sh --link`; die Watch folgt dem Symlink, verifiziert 2026-10-04). Nach einem **Ordner-Tausch** (Kopie ⇄ Symlink, Ordner-Ersetzen) hängt die alte Watch: einmal ⌘K → „Reload desktop plugins". Erfolgreicher Load ist still; die LevelDB schreibt zudem **alle ~60 s periodisch** — ein mtime-Bump allein ist KEIN Reload-Beweis. |
| **DOM-Zustand messen** | Temporären Debug per `console.error` + `getComputedStyle`/`querySelectorAll` in ein Intervall hängen; Ausgabe im Log lesen (Screenshot geht unter Wayland nicht). |

## Wartungs-Checkliste bei App-Updates

1. `npm run check` (Syntax + i18n) und `npm test` (Render-Smoketest) — fangen
   lokale Regressionen sofort.
2. Ladefehler-Log prüfen (oben).
3. Kurz gegengoogeln: `[data-slot='composer-surface']`, `role=tab`-Struktur,
   `--pane-tab-close-width`, `.arc-border` — falls die App sie umbenannt hat,
   greifen die entsprechenden Dok-Abschnitte (Risiko-Spalte).
4. `docs/DEVELOPMENT.md` → Troubleshooting-Tabelle; `docs/SETTINGS.md` bei
   neuen/geänderten Optionen aktualisieren.
5. Neues Feature? Erst einen Plan unter `docs/plans/` anlegen (Template in
   `docs/PLANNING.md`), danach umsetzen, Plan als „Done" abschließen und in
   `CHANGELOG.md`/`docs/ROADMAP.md` verlinken — siehe `docs/AGENT-GUIDE.md` für den
   vollständigen Ablauf.
