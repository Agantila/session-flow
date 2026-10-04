# Changelog

Alle nennenswerten Änderungen an diesem Plugin. Format lose angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [1.13.0] — 2026-10-04

### Neu
- **Text oben ausrichten** (`tabs.alignTop`, Standard an): Text-Spalte und Meta-Infos
  sitzen am Zeilenkopf statt vertikal zentriert — wie die Session-Zeilen der App.
- **Kontextfenster als Torten-Diagramm** (`tabs.ctxPie`, Standard an): Der Wert liegt
  mit Text-Schatten über einem kleinen Pie (`conic-gradient`, Farbstufen ab 70 %/90 %
  wie bisher). Aus = reines Prozent-Label.
- **Farb-Picker + Deckkraft**: Jede Design-Farbe (Zeilen-/Titel-Verlauf, Auswahl-Farbe,
  persönlicher Akzent) hat jetzt einen **nativen Farb-Picker** zusätzlich zu Swatches und
  Hex-Eingabe; die Deckkraft bleibt über den 0–100-%-Regler einstellbar und überlebt
  einen Farbwechsel.
- **App-States übernommen — glühender Rahmen & Anhebung**: `tabs.liveFrame`
  (Aus / Statischer Ring / **Glühender Ring**) zeichnet arbeitenden & wartenden Einträgen
  den umlaufenden Glow-Ring der App (gleiche Technik wie `.arc-border`; respektiert
  `prefers-reduced-motion` und die Animations-Pausierung). `tabs.hoverLift` (Standard an)
  hebt Zeilen und Karten beim Hover leicht an und vertieft den Schlagschatten.
- **„Übernehmen" im sticky Menü**: Der sticky Kopf der Einstellungsseite hat rechts einen
  Button, der Änderungen **sofort persistiert** (überspringt die 350-ms-Debounce) und alle
  Effekte neu anwendet. Ein Akzent-Punkt zeigt ungespeicherte Änderungen, der Klick
  quittiert mit „Gespeichert".

### Intern
- **Computed-Style-Test auf 40 Checks erweitert**: Text-Ausrichtung, Kontext-Pie
  (conic-gradient, Text-Schatten, Größe, Listen/Grid-Parität), Live-Glow-Ring
  (`::after` + `sf-arc-turn`) und Hover-Anhebung (`transform: …0,-1`). Neue
  `settle()`-Hilfe: die Layout-Transition (130 ms) lässt `getComputedStyle` unmittelbar
  nach einem Zustandswechsel den Start-Wert liefern — gemessen wird erst nach dem
  Auslaufen.
- **Render-Smoketest erweitert**: neue Attribute inkl. `liveFrame`-Fallback, die neuen
  Optionszeilen, 6 Farb-Picker, genau ein Save-Button und der Übernehmen-Klick
  (persistiert + wendet an, kein Crash).

## [1.12.0] — 2026-10-04

### Neu
- **Auswahl: Hover-Stufe**: Neue Option „Auswahl: Hover" (`tabs.selHover`) —
  bestimmt, wie der ausgewählte Eintrag auf Hover reagiert: **Verstärken**
  (Standard; Tönung vertieft, z. B. 16 % → 24 %), **Stark** (36 %) oder
  **Unverändert** (Auswahl bleibt exakt beim konfigurierten Design).
- **Alpha in Verläufen**: Verlaufsfarben (Zeilen-/Titel-Verlauf) und die
  Auswahl-Farbe akzeptieren jetzt 8-stelliges Hex `#RRGGBBAA` — Verläufe
  können transparent auslaufen. Die Farbzeilen erhalten dafür einen
  Alpha-Regler (0–100 %); ein Swatch-Klick behält den eingestellten Alpha-Wert.

### Fixed
- **Grid-Parität (Liste == Grid)**: Die Grid-Kartenansicht übernahm die
  Design-Optionen nicht — Karten-Flächen (Standard, Hover, Aktiv) hatten per
  Spezifität Verlauf, Auswahl-Tönung und Live-Status überschrieben. Die
  Flächen laufen jetzt über `:where()` (null-spezifisch): **alle**
  Design-Optionen wirken identisch in Liste UND Grid (im Computed-Style-Test
  zeilenweise abgesichert).
- **Auswahl-Zustand über dem Verlauf**: Die Auswahl-Tönung (Standard/Akzent/
  Eigene Farbe) liegt jetzt als Layer ÜBER dem Zeilen-Verlauf — der
  konfigurierte Verlauf bleibt auch im ausgewählten Zustand sichtbar (vorher
  ersetzte die Tönung den Verlauf). Ebenso der Live-Status (Akzent-Layer
  über Verlauf statt Ersatz).
- **Hover auf der Auswahl**: Die Verlaufs-Brightness überschreibt den
  Auswahl-Zustand nicht mehr — das Hover-Feedback folgt der neuen
  `selHover`-Stufe.

### Intern
- **Computed-Style-Test**: `tests/style-test.mjs` (optional, Playwright/
  Chromium) extrahiert die echte CSS aus `plugin.js` und prüft am echten
  Chromium die **berechneten Styles** — Liste-vs-Grid-Parität, Alpha-Werte,
  Auswahl-Layer, Hover-Stufen, „Design aus". Skip ohne Playwright
  (CI-sicher); Aufruf: `npm run test:style` bzw.
  `PLAYWRIGHT_PKG=… node tests/style-test.mjs`.
- **Render-Smoketest erweitert**: prüft zusätzlich den `selHover`-Mirror
  (`data-sf-selhover` inkl. Fallback) und Alpha-Hex in `applyRows()`.

## [1.11.0] — 2026-10-04

### Neu
- **Max. sichtbare Einträge (je Gruppe)**: Neue Option „Max. sichtbare Einträge" —
  zeigt je Gruppe höchstens N Sessions (Liste **und** Grid); der Rest
  verschwindet hinter einem **„Mehr anzeigen (n)"**-Button, der ihn einblendet
  (erneuter Klick: „Weniger anzeigen"). `0` = aus (alles anzeigen). Ohne
  Gruppen entspricht die Grenze der Gesamtliste.

### Intern
- **Render-Smoketest im Repo**: `tests/render-test.mjs` rendert Sessions-Pane
  und Einstellungsseite headless gegen SDK-Stubs (inkl. Klick-Simulation für
  „Mehr anzeigen"); Aufruf über `npm test`, läuft auch in der CI. READMEs,
  CONTRIBUTING, DEVELOPMENT, APP-INTEGRATION und PR-Template entsprechend
  aktualisiert.

## [1.10.0] — 2026-10-04

### Neu
- **Kontextfenster-Info (kompakt)**: Neue Option „Kontextfenster" — je Zeile/Karte
  einer LIVE-Session zeigt ein reduziertes Prozent-Label die Auslastung des
  Kontextfensters (read-only `session.context_breakdown`; kein Provider-Call,
  kein Prompt-Cache-Impact). Farbstufen ab 70 % (bernstein) und 90 % (rot),
  Tooltip mit `used / max`. Gilt für Liste **und** Grid, per Schalter an/aus.

### Fixed
- **Info-Dichte-Initialisierung wiederhergestellt**: Beim Aufräumen eines
  Debug-Blocks wurde versehentlich der `watchAppDensity()`-Aufruf mitentfernt —
  die Option „Wie Hermes" folgte der App-Dichte dadurch nicht mehr (und der
  Dispose-Block brach an der Stelle ab). Beides repariert.
- **`injectCss` räumt verwaiste Stylesheets früherer Instanzen auf** — nach
  einem unvollständigen Dispose konnten sich sonst Effekte stapeln.

### Intern
- Kontextabfrage adressiert Sessions über die **Runtime-ID** (`SessionParams`
  = Live-Doors; die durable Stored-ID antwortet mit `session not found`).

## [1.9.0] — 2026-10-04

### Neu
- **Design-Optionen für Liste & Grid** (Sektion „Session-Tabs"):
  - **Hintergrund-Verlauf** für Zeilen/Karten — zwei frei wählbare Farben + Winkel (0–360°).
  - **Auswählbarer Schlagschatten** unter Zeilen/Karten (Aus/Dezent/Mittel/Stark).
  - **Titel als Verlauf** — zwei Farben + Winkel, via `background-clip: text`.
  - **Auswahl-Zustand gestaltbar** — Tönung (Standard/Akzent/Eigene Farbe),
    optionale Kontur und eigene Schattenstufe.
  - **Live-Status** — „Aktiv & Wartend“-Hervorhebung: Akzent-Glow +
    pulsierendes Status-Icon, gleiche Bildsprache wie im Tab-Design.
- Alles rein deklarativ (Attribute/Variablen auf `<html>`), standardmäßig **aus**,
  live umschaltbar; `prefers-reduced-motion` und pausierte Animationen werden
  respektiert.

## [1.8.0] — 2026-10-04

### Neu
- **Mehrspaltiges Grid**: Neue Option „Grid: Spalten“ (Auto oder fest 1–4) —
  Auto füllt wie bisher nach Kartenbreite, feste Spalten teilen die Pane
  gleichmäßig auf.
- **Info-Dichte wie Hermes Desktop**: Neue Option „Info-Dichte“ (Wie Hermes /
  Kompakt / Komfortabel / Detailreich) — bildet die App-Einstellung „Dichte
  der Session-Liste“ für List- UND Grid-Ansicht ab: Komfortabel ergänzt eine
  Detail-Zeile (Branch · Modell · Nachrichten · Tool-Aufrufe), Detailreich
  zusätzlich die Vorschau-Zeile. „Wie Hermes“ folgt der App-Einstellung live
  (`host.settings.subscribe('sessionListDensity')`).
- **Pin-Toggle im More-Menü**: „Anpinnen“/„Loslösen“ je nach Server-Status
  (`pinned` aus `session.list`).

## [1.7.0] — 2026-10-04

### Neu
- **Neue Session im zuletzt gewählten Projekt**: Neuer Toolbar-Button (＋)
  startet eine Session mit dem CWD des zuletzt gewählten Projekts — Reihenfolge:
  eingescopetes Projekt (`hermes.desktop.projectScope`), sonst aktives Projekt
  (`projects.db`), sonst zuletzt bekannte Session-CWD; Home bleibt bewusst
  abgekoppelt. Nutzt dieselben Kern-Params wie die App (`session.create`) und
  öffnet die neue Session direkt.
- **More-Menü (⋯) in Listen- UND Grid-Ansicht**: Session-Aktionen wie in Hermes
  Desktop — In neuem Tab/Fenster, Im Terminal öffnen, Umbenennen (Dialog),
  Farbe (Swatches), Anpinnen, Zweig erstellen (`session.branch_stored`),
  In Projekt verschieben (`session.workspace.move` + Projekt-Auswahl),
  Archivieren (`session.archive`), Löschen (`session.delete` mit vorherigem
  Runtime-Close + Bestätigungsdialog), ID kopieren. Live verifiziert
  (create/rename/move/archive/delete); App-lokale Aktionen (gelesen/ungelesen,
  Export) haben keine Plugin-Door und sind dokumentiert ausgenommen.
- **Grid-Ansicht**: Sessions als Karten (auto-fill) — umschaltbar per
  Toolbar-Button und Einstellungen; Optionen: Kartenbreite, Abstand,
  Titel-Zeilen, Vorschautext.

### Fixed
- **Close-Button im Sidebar-Look klar erkennbar**: Das ✕ sitzt jetzt auf einem
  **deckenden Kontrast-Chip** statt gestapelter Transparenzen (Label/Fläche
  darunter schienen vorher durch); zusätzlich bekommt das Label beim Hover eine
  Fade-Maske für ALLE Tab-Varianten — die App maskiert nur
  `data-slot='pane-tab'`, gewrappte Session-Tabs blieben sonst unmaskiert.
- Toolbar: „Neue Gruppe" trägt jetzt ein Gruppen-Icon (`layers`) statt des ＋
  (das ＋ gehört der neuen Session).

## [1.6.0] — 2026-10-03

### Neu — Individualisierung (neue Einstellungs-Sektion)
- **Akzentfarben-Tönung**: eigene Akzentfarbe (Swatch oder Hex) färbt die
  elementaren UI-Elemente der App (Buttons, aktive Zustände, Hover, Fokusringe,
  Hervorhebungen). Umgesetzt als unlayered `--ui-accent`-Override, der die
  `@layer base`-Definition der App sticht — ohne `!important`.
- **Chat-Hintergrund (Bild/Video)**: eigene Datei per nativem Picker
  (`hermesDesktop.selectPaths`) oder Pfad-Eingabe; Ausgabe über das
  App-Protokoll `hermes-media://stream/…` (Range-fähig — Video live verifiziert:
  readyState 4, currentTime läuft). Optionen: Art (Bild/Video, automatische
  Erkennung nach Endung), Darstellung (Füllen/Einpassen), Abdunkeln %,
  Weichzeichnen px, Geltungsbereich (nur Chats/alle Panes). Der Hintergrund-
  Layer (`.sf-bg-layer`) wird pro Pane-Host injiziert; Videos laufen nur auf
  sichtbaren Panes (Keep-Alive bleibt ruhig).
- **Content-Bereich abgrenzen**: runde Ecken (4–24 px) + dezenter Schlagschatten
  (aus/dezent/mittel/stark) + optionale feine Kontur auf den Pane-Hosts
  (`[data-pane-host]`, Overlay-Panes ausgenommen); Geltungsbereich wählbar.

### Geändert
- Einstellungs-Navigation um Kategorie **Individuell** erweitert (sticky Leiste).
- i18n beider Bundles auf 275 Keys; `docs/SETTINGS.md`, `docs/DEVELOPMENT.md`,
  `docs/APP-INTEGRATION.md`, `docs/README.md` und beide READMEs aktualisiert.
- Version 1.6.0 (`plugin.js` + `package.json`).

## [1.5.2] — 2026-10-03

### Geändert
- **Entwickler- & Lizenzangaben**: Das Projekt ist durchgängig als Open-Source-
  Projekt von **AGANTILA — Deniz Yilmaz** (agantila.com) ausgewiesen — LICENSE-
  Copyright, `package.json` (Autor), README/README.de (Entwickler-Zeile +
  Lizenzabschnitt), Plugin-Header sowie zwei neue „Über"-Zeilen in den
  Einstellungen (Entwickler & Lizenzhinweis, EN/DE).

## [1.5.1] — 2026-10-03

### Fixed
- **UI-Tabs greifen jetzt auch auf die Session-Tabs im Content-Bereich**: Diese
  Tabs werden von der App in ein Kontextmenü gewrappt, wobei der Trigger das
  Attribut `data-slot` überschreibt (`context-menu-trigger` statt `pane-tab`) —
  der bisherige Selektor traf sie deshalb nicht (Radius 0 px, keine Chip-Optik,
  kein Close-Verhalten, kein Busy-Glow). Das Styling hängt jetzt an strukturellen
  Merkmalen (`role="tab"` + `.pane-tab-content`, JS-Marke `data-sf-ui-tab`;
  Busy über `[data-tree-tab^='session-tile:']`), die auch hinter Wrappern
  erhalten bleiben. Live verifiziert: alle 7 Tabs markiert, Session-Tabs im
  Content-Bereich mit 4 px Radius + Chip-Höhe.

### Dokumentation
- **Volle Projektstruktur für Weiterentwicklung & GitHub**: bilinguales README
  (`README.md` englisch als GitHub-Hauptansicht, `README.de.md` deutsch),
  `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `docs/README.md`
  (Doku-Index), `docs/APP-INTEGRATION.md` (App-Hooks, fragile Selektoren,
  Verifikations-Rezepte), `docs/ROADMAP.md`, GitHub-Templates für Issues & PRs
  sowie CI (`.github/workflows/check.yml`), dazu `.editorconfig` und
  `.gitattributes`.

## [1.5.0] — 2026-10-03

### Added
- **Überarbeitete Einstellungsseite**: sticky **Kategorie-Leiste** oben — ein
  Klick springt zur Sektion (Chat, Strg+Scroll, Session-Liste, Gruppen, UI-Tabs,
  Glass, Über); die aktuelle Kategorie wird beim Scrollen automatisch markiert.
- **UI-Tabs-Schnellauswahl**: Ein-Klick-Presets **„Sidebar-Look"** (empfohlen),
  **„Minimal"** und **„Hermes-Standard"** übernehmen einen kompletten Look — die
  13 Feineinstellungen darunter bleiben jederzeit justierbar.

### Changed
- UI-Tabs-Sektion ausführlicher beschrieben (Sektionstext, Preset-Zeile mit
  Subtext, Hinweise in den Docs).

## [1.4.0] — 2026-10-03

### Added
- **UI-Tabs (Content-Tab-Leiste im Sidebar-Look)**: Die Tabs des Content-Bereichs
  orientieren sich jetzt am Design der Sidebar-Sessions — leicht abgerundete
  Chips, ruhiger Hover/aktiver Zustand (gefüllt wie eine Sidebar-Zeile, App-
  Unterstrich oder beides). Verbessertes Label (Schreibweise, Größe), verbesserter
  Close-Button (Klickfläche, Hover-Chip, Sichtbarkeit bei Hover/immer/am aktiven
  Tab) und **Live-Session-Infos aus der Sidebar-Engine**: arbeitende Sessions
  (denkt/schreibt/Tools) bekommen den umlaufenden Glow-Ring auf ihrem Tab;
  der Status-Punkt aus dem Sidepanel bleibt übernehmbar/ausblendbar.
  13 Optionen + Subtexte, EN/DE.

## [1.3.1] — 2026-10-03

### Fixed
- **Glow-Ring liegt jetzt exakt auf der Composer-Kontur**: Der Ring-Radius wird
  zur Laufzeit am echten Surface gemessen (`--sf-arc-radius` = berechnetes
  `border-radius` − 1px Border, alle 4 s aktualisiert) statt aus Theme-Variablen
  gerechnet — Tailwind v4 kompiliert die Radius-Skala inline, `--radius-2xl`
  existiert zur Laufzeit nicht. Damit passt der Ring in jedem Theme exakt zur
  vorhandenen Outline (z. B. Radius-Skalar 0.2: Kontur 4.8px → Ring 3.8px).
- (intern) Backtick-Falle in CSS-Kommentaren entschärft: Backticks innerhalb des
  Stylesheet-Templates beenden das Template-Literal und brechen das Plugin.

## [1.3.0] — 2026-10-03

### Fixed
- **Eck-Lücke am Eingabefeld behoben**: Fläche und Akzent-Verlauf malt jetzt das
  Composer-Surface selbst auf der Border-Box — damit exakt derselbe Border-Radius
  wie die Outline (keine Haarlinien mehr an den Ecken). Der Input-Fill-Layer wird
  dafür transparent und erhält zusätzlich den konzentrischen Innenradius
  (`r − 1px`).

### Added
- **Umlaufender Glow** („Travelling glow"): ein dezenter, akzentgefärbter
  Lichtpunkt läuft um den Rand von Eingabefeld, Chips und Statusleiste — dieselbe
  Technik (Mask-Ring + transform-animierter Verlauf), die Hermes bei laufenden
  Session-Zeilen und im HUD-Composer verwendet. Modus „Immer" oder „Bei
  Aktivität" (nur während die aktuelle Session denkt/schreibt/Tools ausführt),
  Breite und Umlaufdauer einstellbar; respektiert `prefers-reduced-motion` und
  pausiert mit dem App-weiten `data-renderer-animations-paused`.

## [1.2.0] — 2026-10-03

### Changed
- **Alle Optionen in den Einstellungen haben jetzt einen Subtext**: jede Zeile
  (Animation, Strg+Scroll, Session-Tabs, Tab-Gruppen, Glass & Lesbarkeit sowie
  der Über-Bereich) erklärt in einem kurzen Satz, was die Option tut — in
  Englisch und Deutsch.

## [1.1.0] — 2026-10-03

### Added
- **Glass & Lesbarkeit**: optionaler Frost-Effekt für **Eingabefeld** und
  **UI-Chips** (Modell-/Reasoning-Pill, Statusleisten-Einträge) mit dezentem,
  akzentgefärbtem **Verlauf als Transparenz-Overlay** — Beschriftungen bleiben
  auch ohne eigene Fläche lesbar. Alles einzeln einstellbar: Blur, Sättigung,
  Flächen-Deckkraft, Akzent-Tönung, Verlauf (an/aus, Winkel, Stärke, Endpunkt),
  feine Kontur und Bereiche (Eingabefeld / Chips / Statusleiste).
- Palette-Command „Session Flow: Glass-Effekt umschalten".

### Notes
- Der Blur folgt dem systemweiten „Transparenz reduzieren"-Gate der App
  automatisch und setzt bewusst kein `!important` auf `backdrop-filter`.
- Zoom-Flächen (Bild-Lightbox, Editor) bleiben unberührt; die Umsetzung ist
  rein deklarativ (Attribute + Custom Properties auf `<html>`, kein CSS-Rebuild).

## [1.0.0] — 2026-10-03

### Added
- **Chat-Animation**: gestaffelte Zeilen-Kaskade beim Öffnen/Wechseln eines
  Chats; Zeile-für-Zeile-Reveal während des Streamens (Web Animations API,
  Index-Dedupe gegen Markdown-Re-Parse-Flackern, `prefers-reduced-motion`-safe).
  Konfigurierbar: Dauer, Versatz, max. Schritte, Bewegung, Easing-Presets,
  Thinking-/Code-/Listen-Optionen.
- **Strg+Scroll-Sessionzyklus** mit konfigurierbarer Zusatztaste, Schwelle,
  Sperrzeit, Invertierung, Umlauf und HUD-Overlay; Zoom-Flächen und
  benutzerdefinierte CSS-Selektoren werden ausgenommen.
- **Session-Tabs-Pane** mit Aktivitäts-Icons (denkt/schreibt/Tool/wartet/fertig/
  Fehler), optionalem Core-Status-Punkt, Zeit, Vorschau, Anzahl, Quellen-Badge.
- **Firefox-artige Tab-Gruppen**: Name, Farbe, Collapse mit Stapel-Optik
  (spine/fanned/pill), Drag & Drop, Kontextmenüs, optionale Auto-Gruppierung
  nach Datum/Quelle.
- **Einstellungsseite** (`/session-flow`) mit Sidebar-Eintrag, Palette-Commands
  und optionalen Keybinds.
- i18n: Englisch + Deutsch.
