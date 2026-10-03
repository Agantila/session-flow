# Einstellungen — Referenz

Alle Einstellungen liegen unter `hermes.plugin.session-flow.settings.v1` (ctx.storage)
und sind live: Änderungen greifen sofort. Erreichbar über die Seite
`/session-flow` (Sidebar „Session Flow" oder ⌘K → „Session Flow: Einstellungen").

Die Seite hat seit v1.5.0 eine **sticky Kategorie-Leiste** oben: ein Klick springt
zur jeweiligen Sektion, die aktuelle wird beim Scrollen automatisch markiert.

## Chat-Animation

| Key | Default | Wirkung |
|---|---|---|
| `animation.enabled` | `true` | Master-Schalter. Aus = keine Zeilen-Animationen. |
| `animation.historyCascade` | `true` | Beim Öffnen/Wechseln eines Chats laufen die sichtbaren Zeilen als Kaskade (oben → unten) ein. |
| `animation.streamReveal` | `true` | Während des Streamens blendet jede Zeile einmal ein, sobald sie fertig ist (Zeile N-1 animiert, wenn Zeile N erscheint; die letzte beim Stream-Ende). |
| `animation.durationMs` | `320` | Dauer einer einzelnen Zeilen-Animation. |
| `animation.staggerMs` | `55` | Verzögerung zwischen aufeinanderfolgenden Zeilen. |
| `animation.maxStaggerSteps` | `24` | Deckel für die Staffelung (Gesamtlaufzeit) bei langen Antworten. |
| `animation.travelPx` | `10` | Vertikale Bewegung der Zeile in px. 0 = reines Fade. |
| `animation.easing` | `soft` | `smooth` (Expo), `soft` (weich), `gentle` (ruhig), `back` (leicht federnd). |
| `animation.skipReasoning` | `true` | Thinking-/Reasoning-Blöcke nicht animieren. |
| `animation.includeCode` | `true` | Code-Blöcke als Zeilen animieren. |
| `animation.includeLists` | `true` | Listenpunkte (`<li>`) einzeln animieren statt die Liste als Ganzes. |

Hinweis: `prefers-reduced-motion: reduce` (Betriebssystem) deaktiviert alle
Animationen unabhängig von diesen Schaltern.

## Strg+Scroll (Session-Zyklus)

| Key | Default | Wirkung |
|---|---|---|
| `wheel.enabled` | `true` | Master-Schalter. |
| `wheel.modifier` | `ctrl` | `ctrl`, `alt`, `ctrl+shift`, `meta`. |
| `wheel.threshold` | `40` | Nötige Mausrad-Delta bis ein Wechsel ausgelöst wird. |
| `wheel.cooldownMs` | `200` | Mindestabstand zwischen zwei Wechseln. |
| `wheel.invert` | `false` | Richtung umkehren. |
| `wheel.wrap` | `true` | Am Listenende umlaufen. |
| `wheel.hud` | `true` | HUD-Overlay mit Position/Titel anzeigen. |
| `wheel.hudMs` | `1100` | Anzeigedauer des HUD. |
| `wheel.ignoreSelector` | `''` | Zusätzliche CSS-Selektoren (kommasepariert), in denen Strg+Scroll nicht greift. Basis-Liste ist immer aktiv: `canvas`, `.monaco-editor`, Bild-Zoom (`aui_zoomable-image`). |

## Session-Tabs

| Key | Default | Wirkung |
|---|---|---|
| `tabs.density` | `compact` | `compact` (einzeilig) oder `cozy` (mit Vorschau-Zeile). |
| `tabs.view` | `list` | `list` oder `grid` (Kartenansicht) — auch per Toolbar-Button umschaltbar. |
| `tabs.gridMin` | `150` | Grid: Mindest-Kartenbreite in px (nur bei Spalten = Auto). |
| `tabs.gridCols` | `auto` | Grid-Spalten: `auto` (nach Kartenbreite) oder fest `1`–`4`. |
| `tabs.gridGap` | `6` | Grid: Abstand zwischen den Karten in px. |
| `tabs.gridLines` | `2` | Grid: max. Zeilen für den Kartentitel (1–4). |
| `tabs.gridPreview` | `true` | Grid: Vorschau der letzten Nachricht auf den Karten. |
| `tabs.infoDensity` | `auto` | Info-Dichte: `auto` (wie Hermes), `compact`, `comfortable`, `detailed`. Komfortabel = Detail-Zeile (Branch·Modell·Zähler), Detailreich = + Vorschau; gilt für Liste und Grid. |
| `tabs.rowGradOn` | `false` | Hintergrund-Verlauf für Zeilen (Liste) & Karten (Grid); Farben `rowGradFrom`/`rowGradTo`, Winkel `rowGradAngle` (0–360°). |
| `tabs.rowShadow` | `off` | Auswählbarer Schlagschatten: `off`/`subtle`/`medium`/`strong`. |
| `tabs.titleGradOn` | `false` | Titel als Verlauf (`titleGradFrom`/`titleGradTo`, Winkel `titleGradAngle`) via Background-Clip Text. |
| `tabs.selTint` | `standard` | Auswahl-Tönung: `standard` (App-Optik), `accent` (Akzentfarbe), `custom` (eigene Farbe `selColor`). |
| `tabs.selBorder` | `false` | Kontur um die ausgewählte Zeile/Karte (in der Tönungsfarbe). |
| `tabs.selShadow` | `off` | Schattenstufe für den Auswahl-Zustand: `off`/`subtle`/`medium`/`strong`. |
| `tabs.rowLive` | `false` | Aktiv & Wartend hervorheben: Akzent-Glow + pulsierendes Status-Icon (Bildsprache wie im Tab-Design). |
| `tabs.statusStyle` | `glyph` | `glyph` (Aktivitäts-Icon), `dot` (Core-Status-Punkt), `glyph+dot`. |
| `tabs.showTime` | `true` | Alter der Session anzeigen. |
| `tabs.showPreview` | `false` | Letzte Nachricht als Vorschau (cozy-Dichte). |
| `tabs.showCounts` | `false` | Nachrichtenanzahl anzeigen. |
| `tabs.showSource` | `true` | Quellen-Badge (Telegram, Discord, Cron …). |
| `tabs.openIntent` | `in-place` | `in-place` (ersetzen), `stack` (neben dran), `tab`. |
| `tabs.maxItems` | `60` | Maximal geladene Sessions. |
| `tabs.hideCron` | `true` | Cron-Sessions ausblenden. |
| `tabs.livePollSec` | `30` | Intervall der Live-Status-Abfrage (`session.active_list`). Min. 10s. |
| `tabs.refreshSec` | `45` | Intervall des Listen-Refresh (`session.list`). Min. 15s. |

### Pane-Buttons & More-Menü

- **Ansicht wechseln** (Toolbar): schaltet Liste ⇄ Grid.
- **Neue Session** (＋, Toolbar): startet eine Session mit dem CWD des **zuletzt
  gewählten Projekts** — Reihenfolge: eingescopetes Projekt (`projectScope`),
  sonst aktives Projekt (`projects.db`), sonst zuletzt bekannte Session-CWD.
  Der Home-Scope bleibt bewusst abgekoppelt (kein CWD). Danach öffnet die
  Session direkt (gemäß `tabs.openIntent`).
- **Neue Gruppe** (layers-Icon): öffnet den Gruppen-Dialog.
- **More-Menü (⋯)** auf jeder Zeile/Karte (erscheint bei Hover): In neuem Tab,
  Neues Fenster, Im Terminal öffnen, Umbenennen…, Farbe…, Anpinnen, Zweig
  erstellen, In Projekt verschieben…, Archivieren, Löschen (mit Bestätigung),
  ID kopieren. Umbenennen erfordert eine aktive/geladene Session
  (`session.title`-RPC); App-lokale Aktionen (gelesen/ungelesen, Export) stehen
  Plugins nicht zur Verfügung und fehlen daher bewusst.

## Tab-Gruppen

| Key | Default | Wirkung |
|---|---|---|
| `groups.enabled` | `true` | Manuelle Gruppen aktiv. |
| `groups.autoMode` | `off` | `off`, `date` (Heute/Gestern/Woche/Älter) oder `source`. |
| `groups.stackStyle` | `spine` | Optik eingeklappter Gruppen: `spine`, `fanned`, `pill`. |
| `groups.showUngrouped` | `true` | „Nicht gruppiert"-Bereich zeigen, wenn Auto-Modus aus ist. |

Gruppen-Daten (Name, Farbe, Zuordnung, Collapse-Zustand) liegen separat unter
`hermes.plugin.session-flow.groups.v1`.

## UI-Tabs (Content-Tab-Leiste)

Style-Verbesserungen für die Tabs des **Content-Bereichs** (alle Panes), im
Design der Sidebar-Sessions. Läuft rein über CSS-Tokens auf `<html>`
(`data-sf-ui-tabs`) + DOM-Markierung `data-sf-tab-busy` (Live-Status der
Session-Tabs aus derselben Engine wie die Sidebar).

| Key | Default | Wirkung |
|---|---|---|
| `uiTabs.enabled` | `true` | Master. Aus = App-Standard-Optik. |
| `uiTabs.radius` | `4` | Ecken-Radius der Tabs in px (0–12). |
| `uiTabs.gap` | `2` | Horizontaler Abstand zwischen Tabs in px (0–10). |
| `uiTabs.insetY` | `2` | Vertikaler Abstand zur Leistenkante in px (0–8; 0 = volle Höhe). |
| `uiTabs.separators` | `false` | Feine Trennlinien zwischen Tabs behalten. |
| `uiTabs.activeStyle` | `sidebar` | `sidebar` (gefüllt wie Sidebar-Zeile), `underline` (App) oder `both`. |
| `uiTabs.labelCase` | `normal` | `normal` (wie getippt) oder `upper` (App-Stil). |
| `uiTabs.labelSize` | `11` | Schriftgröße des Tab-Titels in px (10–13). |
| `uiTabs.showLead` | `true` | Status-Punkt (Live-State + Farbe aus der Sidebar) im Tab. |
| `uiTabs.closeMode` | `hover` | Sichtbarkeit des ✕: `hover`, `always` oder `active` (nur aktiver Tab). |
| `uiTabs.closeWidth` | `22` | Klickfläche des ✕ in px (14–32; setzt `--pane-tab-close-width`). |
| `uiTabs.closeHover` | `true` | Weicher Hover-Chip hinter dem ✕. |
| `uiTabs.arc` | `true` | Umlaufender Glow-Ring auf Tabs arbeitender Sessions (denkt/schreibt/Tools). |

Hinweise:

- **Schnellauswahl**: Die Presets **„Sidebar-Look"** (empfohlen, Default),
  **„Minimal"** (flach, ohne Status/Glow) und **„Hermes-Standard"** (App-Optik) setzen die
  Sektion in einem Klick — jede Option darunter bleibt danach feinjustierbar.
- Gilt für **alle** Tab-Leisten, einschließlich der gestapelten Session-Tabs im
  Content-Bereich (auch hinter deren Kontextmenü-Wrapper).
- Der Glow nutzt dieselben Tokens wie „Glass" (`--sf-arc-width`/-`duration`) und
  pausiert mit `prefers-reduced-motion` bzw. `data-renderer-animations-paused`.
- Die Status-Infos kommen aus der Plugin-Aktivitäts-Engine (`$activity`/`$liveMap`,
  Gateway-Events) — dieselbe Quelle wie die Icons der Session-Flow-Pane.

## Glass & Lesbarkeit

Optionaler Frost-Effekt, der Eingabefeld und Chips eine lesbare Fläche gibt
(dezenter, akzentgefärbter Verlauf als Transparenz-Overlay). Umsetzung: die
Einstellungen werden als `data-sf-glass`-Tokens + Custom Properties auf `<html>`
gespiegelt; das Plugin-CSS reagiert rein per Selektor — kein CSS-Rebuild, kein
`!important` auf `backdrop-filter` (der „Transparenz reduzieren"-Gate der App
greift weiterhin automatisch).

| Key | Default | Wirkung |
|---|---|---|
| `glass.enabled` | `true` | Master-Schalter. Aus = Tokens/Variablen werden restlos entfernt. |
| `glass.blurPx` | `10` | Blur-Stärke in px (0–40; Chips ×0.75, Statusleiste ×0.6). |
| `glass.saturate` | `115` | Sättigung in % (100–200). |
| `glass.fill` | `86` | Deckkraft der Grundfläche in % (50–94; gilt für Composer-Fill inkl. Dock-Karten). |
| `glass.tint` | `8` | Anteil Akzentfarbe in der Fläche in % (0–40). |
| `glass.gradient` | `true` | Verlaufs-Overlay aus der Akzentfarbe. |
| `glass.angle` | `165` | Verlaufs-Winkel in ° (0–360). |
| `glass.gradOpacity` | `12` | Stärke des Verlaufs in % (0–60). |
| `glass.reach` | `72` | Position (in %), ab der der Verlauf vollständig transparent ist (20–100). |
| `glass.ring` | `true` | Hauchdünne, akzentgefärbte Innenkontur um Chips (box-shadow, kein Layout-Shift). |
| `glass.arc` | `true` | Umlaufender Glow-Ring um die Ränder (wie bei laufenden Sessions in Hermes). |
| `glass.arcMode` | `always` | `always` (immer) oder `busy` (nur während die aktuelle Session arbeitet). |
| `glass.arcWidth` | `1.5` | Dicke des Lichtpunkts in px (0.5–4). |
| `glass.arcDuration` | `3.2` | Dauer eines Umlaufs in Sekunden (1–12). |
| `glass.scopes.composer` | `true` | Eingabefeld (Composer-Oberfläche + Dock-Karten) inkl. Blur. |
| `glass.scopes.chips` | `true` | Modell- und Reasoning-Pill im Composer. |
| `glass.scopes.statusbar` | `false` | Einträge der Statusleiste. |

Hinweise:

- **Performance**: Blur auf dem Eingabefeld kostet beim Scrollen/Streamen etwas
  GPU. Wenn es sich je zäh anfühlt: `glass.blurPx` senken oder
  `glass.scopes.composer` abschalten.
- **Handles**: Chips werden über stabile App-Hooks adressiert
  (`[data-tour='model-pill']`, `[data-testid='reasoning-pill']`); die
  Modell-Pill existiert nur im Primär-Chat, die Reasoning-Pill überall.
- Im **HUD-Modus** gewinnt bewusst die HUD-eigene Gestaltung (dort nullt die
  App Backdrop-Filter mit `!important`).

## Gruppe vs. Session-Farbe

- **Gruppenfarbe**: eigener Swatch-Picker im Gruppen-Dialog (Rechtsklick auf
  die Gruppen-Überschrift).
- **Session-Farbe**: Rechtsklick auf einen Tab → „Session-Farbe". Diese Farbe
  setzt `host.sessions.setColor` und erscheint damit auch auf der
  Core-Sidebar-Zeile (gleiche Quelle).

## Individualisierung

Eigene Akzentfarbe, eigener Chat-Hintergrund und die Abgrenzung des
Content-Bereichs. Alle Optionen sind standardmäßig **aus** — es ändert sich
nichts, bis du sie einschaltest.

### Akzent-Tönung (Keys `personal.accent*`)

- **Akzentfarben-Tönung** (`accentOn`): wendet deine Akzentfarbe auf elementare
  UI-Elemente an — Buttons, aktive Zustände, Hover, Fokusringe, Hervorhebungen.
  Status-Farben (Rot/Grün/Gelb) bleiben unverändert.
- **Akzentfarbe** (`accentColor`): Swatch-Reihe der Theme-Palette oder Hex-Wert
  (`#rrggbb`) — unvollständige Eingaben werden ignoriert, bis sie gültig sind.
- **Zurücksetzen** (Swatch-„Zurücksetzen"): stellt die Standard-Akzentfarbe ein.
- Deaktivieren stellt sofort die Theme-Akzentfarbe wieder her.

### Chat-Hintergrund (Keys `personal.bg*`)

- **Chat-Hintergrund** (`bgOn`): zeigt ein eigenes Bild oder Video hinter den
  Chat-Nachrichten.
- **Art des Hintergrunds** (`bgKind`): Bild oder Video (stumm, läuft in
  Schleife; der Datei-Picker erkennt die Art automatisch an der Endung).
- **Datei** (`bgPath`): absoluter Pfad zu einer lokalen Bild-/Videodatei — über
  „Datei wählen…" (nativer Dialog) oder eintippen. Die Ausgabe läuft über das
  App-Protokoll `hermes-media://stream/…` (unterstützt auch große Dateien).
- **Darstellung** (`bgFit`): Füllen (`cover`) oder Einpassen (`contain`).
- **Abdunkeln %** (`bgDim`, 0–85): dunkler Overlay für Lesbarkeit.
- **Weichzeichnen px** (`bgBlur`, 0–24): weicher Blur auf dem Hintergrund.
- **Gilt für** (`bgScope`): nur Chat-Sessions oder alle Pane-Ansichten.
- Technik: pro Pane-Host wird ein `.sf-bg-layer` unterhalb des Inhalts
  injiziert; Videos laufen nur auf sichtbaren Panes.

### Content-Bereich abgrenzen (Keys `personal.shell*`)

- **Content-Bereich abgrenzen** (`shellOn`): runde Ecken + Schlagschatten auf
  dem Ansichtsbereich der Tabs; Overlay-/schwebende Panes bleiben ausgenommen.
- **Ecken-Radius px** (`shellRadius`, 4–24): Rundung der Ecken.
- **Schatten** (`shellShadow`): aus / dezent / mittel / stark.
- **Feine Kontur** (`shellBorder`): zusätzliche Hairline um den Bereich.
- **Gilt für** (`shellScope`): alle Panes oder nur Chats.

## Über

- **Version**: die aktuell von der App geladene Plugin-Version.
- **Entwickler & Lizenzinhaber**: AGANTILA — Deniz Yilmaz (agantila.com).
- **Lizenz**: MIT (Open Source) — frei nutzbar, veränderbar und teilbar.
- **Zähler**: Sessions und manuelle Gruppen in der aktuellen Liste.
- **Zurücksetzen**: „Einstellungen zurücksetzen" und „Gruppen zurücksetzen"
  stellen den Auslieferungszustand wieder her.
