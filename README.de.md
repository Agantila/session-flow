# Session Flow — Hermes Desktop Plugin

[English](README.md) · **Deutsch**

<p align="center">
  <img src="docs/marketing/heroes/sf-hero-a9-sidebar-kanban-files-16x9.jpg" alt="Session Flow in Hermes Desktop — Sidebar mit Projekt-Gruppen, Kanban-Pane und Datei-Explorer" width="100%">
</p>

Weiche Zeile-für-Zeile-Animation im Chat, Strg+Scroll durch die Sessions,
Firefox-artige Session-Gruppen, Glass-Lesbarkeit für den Composer und
Sidebar-Style-Tabs im Content-Bereich und volle Individualisierung — **sechs
Features in einem Plugin**, ohne
Build-Schritt, ohne Abhängigkeiten, alles live über die eingebaute
Einstellungsseite konfigurierbar.

Entwickelt und im Einsatz unter Linux (Wayland/KDE) mit Hermes Desktop und dem
Plugin-SDK (`~/.hermes/desktop-plugins/`).

Ein Projekt von **[AGANTILA — Deniz Yilmaz](https://agantila.com)** ·
Kontakt: **info@agantila.com**.

## Showcase

| | |
|---|---|
| ![Session-Pane mit Projekt-Gruppen, Anpinn-Sektion und Suchleiste](docs/marketing/heroes/sf-hero-a1-sessionpane-liste-16x9.png) | ![Composer im Glass-Look mit Projekt-Chip](docs/marketing/heroes/sf-hero-a4-composer-glass-16x9.png) |
| ![Chat, Zeile-für-Zeile-Kaskade](docs/marketing/heroes/sf-hero-a3-chat-kaskade-16x9.png) | ![Strg+Scroll-HUD](docs/marketing/heroes/sf-hero-a5-ctrlscroll-hud-16x9.png) |
| ![Sidebar-Style-Tabs mit Glow auf arbeitender Session](docs/marketing/heroes/sf-hero-a6-contenttabs-16x9.png) | ![Einstellungen — alles konfigurierbar](docs/marketing/heroes/sf-hero-a7-settings-16x9.png) |
| ![Grid-Sessions mit geöffnetem ⋯-Menü](docs/marketing/heroes/sf-hero-a2-sessionpane-grid-16x9.png) | ![Personalisierter Workspace — eigener Chat-Hintergrund, Akzent im Fokus](docs/marketing/heroes/sf-hero-a8-workspace-personal-16x9.png) |
| ![Sidebar Grid-View (echter Hermes-Desktop-Screenshot)](docs/marketing/heroes/sf-hero-a10-sidebar-grid-9x16.png) | |

### Echte App-Screenshots

Zwei zusätzliche Screenshots wurden aus einer laufenden Hermes-Desktop-Session
aufgenommen (`sf-hero-a9-sidebar-kanban-files-16x9.jpg`,
`sf-hero-a10-sidebar-grid-9x16.png`), um das Plugin im realen App-Kontext zu
zeigen — die Showcase-Aufnahmen oben sind aus HTML-Quellen reproduzierte,
pixelgenaue Kompositionen für die Marketplace-Galerie.

▶ **In Bewegung:** die 5-Sekunden-Hyperframes-Animation
([MP4](docs/marketing/animation/sf-hyperframes-1920x1080-5s.mp4) ·
[WebM](docs/marketing/animation/sf-hyperframes-1920x1080-5s.webm) ·
[GIF](docs/marketing/animation/sf-hyperframes-1920x1080-5s.gif))
zeigt Kaskade, Projekt-Chip, Strg+Scroll-HUD und Kontext-Donut in einem kurzen Loop.

**19 Komponenten-Karten (1:1)** — jedes UI-Element, das den neuen Look prägt,
eigene Karte, fertig für Doku, Folien oder den Marketplace-Eintrag:
[docs/marketing/components/](docs/marketing/components/). Vollständige Inventarliste
in [docs/marketing/INVENTORY.md](docs/marketing/INVENTORY.md).

> Alle 30 Bilder sind aus den HTML-Quellen unter
> [docs/marketing/src/](docs/marketing/src/) reproduzierbar.
> Re-Render: `docs/marketing/src/heroes/render.sh` und
> `docs/marketing/src/components/render.sh`.

## Features

1. **Chat-Animation (Zeile für Zeile)** — Antworten werden mit Easing weich
   eingeblendet. Beim Öffnen/Wechseln eines Chats laufen die sichtbaren Zeilen
   als Kaskade von oben nach unten ein; während des Streamens animiert jede
   Zeile genau einmal, sobald sie fertig geschrieben ist. Dauer, Versatz,
   Bewegung, Easing-Presets, Thinking-/Code-/Listen-Optionen — alles einstellbar.
2. **Strg + Scroll = Session-Zyklus** — Mit gedrückter Zusatztaste (Standard
   `Ctrl`) und Mausrad durch die aktiven Sessions scrollen. Ein HUD zeigt
   Position und Titel. Zoom-Flächen (Bild-Lightbox, Code-Editor) behalten ihr
   eigenes Verhalten.
3. **Session-Tabs mit Firefox-artigen Gruppen** — Eine Pane listet alle
   Sessions als kompakte Tabs mit **Aktivitäts-Icon** (denkt / schreibt /
   Tool läuft / wartet auf Antwort / fertig / Fehler). Sessions lassen sich in
   benannte, farbige **Gruppen** legen (Rechtsklick oder Drag & Drop), Gruppen
   klappen zu einem **Stapel** zusammen (spine / fanned / pill). Optional
   automatische Gruppierung nach Datum, Quelle oder **Projekt-Ordner** (im
   Look der Hermes-Desktop-„Projekte"-Baumstruktur — Ordner-Icon, Hover-Caret,
   Hover-„+" für eine neue Session genau dort; ein Tab auf einen
   Projekt-Header gezogen verschiebt ihn wirklich, mit Ziel-Hervorhebung und
   „Gelandet"-Flash). Eine **Such- & Schnellfilter-Leiste** (alle / angepinnt /
   aktiv) grenzt die Liste live ein. Jede Zeile/Karte trägt ein
   **More-Menü (⋯)** — Öffnen-Varianten, Terminal, Umbenennen, Farbe, Anpinnen,
   Zweig, In Projekt verschieben, Archivieren, Löschen, ID kopieren — und das
   Toolbar-＋ startet eine **neue Session im zuletzt gewählten Projekt**. Die
   Pane rendert als **Liste oder Grid** (Karten-Optionen in den Einstellungen)
   und kann optional die **native Tab-Leiste ersetzen** (`tabs.asTabSelector`),
   sobald sie das Umschalten zwischen Sessions schon abdeckt. Über der Toolbar
   sitzt die **App-Schnellstart-Zeile**: Icon-Buttons für Neue Session,
   Fähigkeiten, Messaging, Artefakte, Geplante Jobs und Kanban (gleiche
   Reihenfolge und Icons wie die erste Sektion der App-Sidebar), die bei
   schmaler Pane-Breite dynamisch in weitere Zeilen umbricht — mit
   **Status-Pips** auf Kanban und Geplanten Jobs (läuft / blockiert / Review /
   Fehler, gespeist aus den eigenen App-Endpunkten; Kanban erscheint nur, solange
   das Kanban-Plugin aktiv ist).
4. **Glass & Lesbarkeit** — Optionaler Frost-Effekt für **Eingabefeld** und
   **UI-Chips**: eine weiche Blur-Fläche mit dezentem, aus der Hermes-Akzent-
   farbe gefärbtem **Verlaufs-Overlay** (transparent auslaufend), damit Texte
   auch ohne eigene Hintergrundfläche gut lesbar bleiben. Blur, Sättigung,
   Deckkraft, Tönung, Verlaufswinkel/-stärke und Bereiche (Eingabefeld / Chips /
   Statusleiste) sind frei einstellbar — inklusive eines **umlaufenden
   Glow-Rings** am Rand (derselbe Effekt, den Hermes bei laufenden Sessions
   nutzt).
5. **UI-Tabs im Sidebar-Look** — Die Tabs des Content-Bereichs werden zu leicht
   abgerundeten Chips wie die Sidebar-Sessions: ruhiger Hover/aktiver Zustand,
   verbessertes Label (Schreibweise, Größe) und ein freundlicherer **Close-Button**
   (Klickfläche, Hover-Chip, Sichtbarkeit bei Hover / immer / am aktiven Tab).
   **Live-Infos aus dem Sidepanel**: arbeitende Sessions (denkt / schreibt /
   Tools) tragen den umlaufenden Glow-Ring auf ihrem Tab, der Status-Punkt
   bleibt ein-/ausblendbar.
6. **Individualisierung** — eigene **Akzentfarbe** für elementare UI-Elemente
   (Buttons, aktive Zustände, Hover, Fokusringe), eigener **Chat-Hintergrund**
   (eigene Bild- oder Videodatei, mit Darstellung / Abdunkeln / Weichzeichnen
   und Geltungsbereich), wählbarer **Pane-Fläche** für das Session-Flow-Pane
   selbst (Native Sidebar = Hermes-Default, Chat = bisheriger Look, Ohne =
   kein eigener Fill) und der **Content-Bereich der Tabs** wird mit runden
   Ecken, feiner Kontur, Abstand zum Layout-Rand und dezentem Schlagschatten
   abgesetzt (Radius, Abstand, Schattenstärke, Geltungsbereich).

Alles ist in den **Plugin-Einstellungen** anpassbar: `Session Flow`-Seite in der
Sidebar, ⌘K/Ctrl+K → „Session Flow: Einstellungen", oder das Zahnrad in der Pane.
Die Seite hat eine **sticky Kategorie-Leiste** (Chat · Strg+Scroll · Session-Liste ·
Gruppen · UI-Tabs · Glass · Individuell · Über) und Ein-Klick-Presets für die UI-Tabs.

![Feature-Überblick](docs/overview.png)

> Hinweis: `docs/overview.png` ist optional — lege dort gern einen Screenshot ab.

## Zwei Builds — Catalog (`desktop/plugin.js`) und Full (`full/plugin.js`)

Beide Builds kommen aus **einer Quelle** (`full/plugin.js`) — gleiche Strategie
wie beim kataloggelisteten `pinned-folders`:

| | Catalog-Build `desktop/plugin.js` | Full-Build `full/plugin.js` |
|---|---|---|
| Session-Pane, Gruppen, DnD, Suche, Liste/Grid | ✓ | ✓ |
| Session-Aktionen (Rename/Branch/Pin/Verschieben/Archiv/Löschen) | ✓ | ✓ |
| Projektverwaltung (`projects.*`-RPCs) | ✓ | ✓ |
| Strg+Scroll + HUD | ✓ | ✓ |
| Status-Pips (Cron; Kanban über Endpoint-Antwort) | – (wartet auf SDK-REST-Door, #116305) | ✓ (Desktop-Bridge-REST) |
| Einstellungsseite, Palette, Keybinds, DE/EN | ✓ | ✓ |
| Chat-Zeilen-Animation | – (wartet auf SDK Message-Render-Hook) | ✓ |
| Composer-Projekt-Chip | – (wartet auf SDK Composer-Accessory-Slot) | ✓ |
| Glass & Lesbarkeit (Composer/Chips/Statusleiste) | – (wartet auf SDK Theme-Door) | ✓ |
| UI-Tabs-Optik + „als Tab-Selektor" (Strip ausblenden) | – (wartet auf SDK Tab-Decoration-Slot) | ✓ |
| Chat-Hintergrund Bild/Video | – (wartet auf SDK Workspace-Background-Door) | ✓ |
| Angepinnt-/Archiv-Filter | – (wartet auf SDK-REST-Door, #116305) | ✓ (Desktop-Bridge-REST) |
| Nativer Datei-Picker, Dateimanager, Terminal | – (Menüpunkte ehrlich ausgeblendet) | ✓ (Desktop-Bridge-Doors) |

Der **Catalog-Build ist SDK-only** (Hermes-Katalog Regel 8: kein App-Markup-
Zugriff, keine `document.body`-Observer, keine Core-CSS-Overrides, keine
`window.hermesDesktop`-Doors) — genau ihn listet der Marketplace und lädt ihn
am gepinnten SHA. Der **Full-Build** behält alle Features für die Standalone-
Nutzung und disclose seine Zusatzflächen unten; die fehlenden SDK-Slots sind
upstream angefragt
([hermes-agent #116305](https://github.com/NousResearch/hermes-agent/issues/116305)),
die Features wandern mit den Slots auf das SDK um.

Catalog-Build nach Quell-Änderung neu erzeugen:
`node scripts/build-catalog.mjs` (CI schlägt bei veraltetem `desktop/plugin.js` an).

### Disclosure (Catalog-Build)

Liest den lokalen Hermes-Gateway über öffentliche RPCs (`projects.*`,
`session.*`, `session.active_list`, `session.context_breakdown`,
State-Atome); Writes nur über nutzer-initiierte öffentliche RPCs.
Einstellungen und Gruppen liegen im lokalen Plugin-Speicher der App
(`ctx.storage`). **Kein** App-Markup-Zugriff, keine DOM-Observer auf
App-Containern, keine Core-CSS-Overrides, keine
`window.hermesDesktop`-Doors, keine synthetischen focus-/visibilitychange-
Events, keine ausgehenden Netzwerk-Calls, keine Telemetrie, keine
Shell-Kommandos, keine gespeicherten Credentials, kein Self-Update.

### Disclosure (Full-Build — Zusatz gegenüber dem Catalog-Build)

Nutzt die dokumentierten Desktop-Bridge-Doors einer Standalone-Installation:
`hermesDesktop.api` (lokaler REST-Spiegel für pinned/unread/Kosten und
Ordnergrößen), `hermesDesktop.selectPaths` / `revealPath` /
`openSessionInTerminal` (nativer Picker, Dateimanager, Terminal) sowie — wie
der Catalog-Build — öffentliche Gateway-RPCs. Nach eigenen Mutationen
(Projekt geändert, Pin, Archiv) feuert er synthetische `focus`-/
`visibilitychange`-Events, damit die App-Sidebar instant nachzieht (der
Catalog-Build tut das nie). Die UI-Dekorationen oben
stylen oder markieren Kernflächen (Composer, Chips, Statusleiste,
Content-Tabs, Chat-Flächen) und injizieren ihren eigenen Hintergrund-Layer
in Chat-Panes. Kein Prototype-Patching, kein `eval`, keine dynamischen
Imports außer SDK/react, keine Telemetrie, keine gespeicherten Credentials.

## Installation

Voraussetzung: Hermes Desktop (neu genug für das Plugin-SDK,
`~/.hermes/desktop-plugins/` wird unterstützt).

```bash
# Aus dem Repo-Verzeichnis (Full-Build — alle Features):
./install.sh            # kopiert full/plugin.js nach ~/.hermes/desktop-plugins/session-flow/
./install.sh --link     # Entwicklungsmodus: Symlink auf full/ (Hot-Reload beim Speichern)
./install.sh --variant catalog   # stattdessen den SDK-only Catalog-Build
```

Danach in der App: **⌘K / Ctrl+K → „Reload desktop plugins"** — oder die App
einmal neu starten. Das Plugin lädt danach automatisch bei jedem Start.

**Manuell:** den gewünschten Build als `plugin.js` nach
`~/.hermes/desktop-plugins/session-flow/plugin.js` kopieren. Der Ordnername
**muss** `session-flow` heißen (= Plugin-id).

**Deinstallieren:** `./uninstall.sh` (entfernt nur das Installationsziel,
nicht das Repo).

### Teilen

- Repo-URL weitergeben + Installationsanleitung oben.
- Oder ein Install-Link (Hermes Deep-Link): `hermes://plugin/install?repo=<owner>/<repo>`
  — der Nutzer bekommt einen Bestätigungsdialog und wählt die Komponenten.

## Nutzung

| Aktion | Wie |
|---|---|
| Session öffnen | Klick auf einen Tab |
| Kontextmenü (Pin, Gruppe, Farbe, Öffnen als…) | Rechtsklick auf einen Tab |
| Gruppe anlegen / bearbeiten / löschen | Zahnrad-/„+"-Button im Pane-Header oder Rechtsklick/Doppelklick auf eine Gruppen-Überschrift |
| Session in Gruppe verschieben | Tab per Drag & Drop auf eine Gruppe ziehen — oder Rechtsklick → „In Gruppe verschieben" |
| Gruppe einklappen | Klick auf die Gruppen-Überschrift |
| Sessions durchscrollen | `Ctrl` + Mausrad |
| Einstellungen | Sidebar „Session Flow" oder ⌘K → „Session Flow: Einstellungen" |

## Einstellungen (Kurzüberblick)

Volle Referenz inkl. Defaults: [docs/SETTINGS.md](docs/SETTINGS.md).
Die Seite hat eine **sticky Kategorie-Leiste** (Chat · Strg+Scroll · Session-Liste ·
Gruppen · UI-Tabs · Glass · Über) — Klick springt zur Sektion, Scrollen markiert
die aktuelle. Die UI-Tabs-Sektion bietet zusätzlich Ein-Klick-Presets
(„Sidebar-Look", „Minimal", „Hermes-Standard").

- **Chat-Animation**: an/aus, Kaskade beim Öffnen, Zeile-für-Zeile beim
  Streamen, Dauer, Versatz pro Zeile, max. Staffel-Schritte, Bewegung (px),
  Easing (4 Presets), Thinking-Blöcke überspringen, Code-Blöcke, Listenpunkte.
- **Strg+Scroll**: an/aus, Zusatztaste (`Ctrl`/`Alt`/`Ctrl+Shift`/`Meta`),
  Schwelle, Sperrzeit, Richtung umkehren, Umlauf, HUD an/aus + Dauer,
  Ignorier-Selektoren (CSS).
- **Session-Tabs**: Dichte (kompakt/bequem), Ansicht (Liste/Grid — Spalten,
  Kartenbreite, Abstand, Titel-Zeilen, Vorschau, Info-Dichte wie Hermes,
  Text oben ausgerichtet, kompaktes Kontextfenster als **Donut** (Ring mit Loch) für
  Live-Sessions, max. sichtbare Einträge je Gruppe mit „Mehr anzeigen“),
  Zeilen-/Karten-Design (Hintergrund-Verlauf, Schlagschatten, Titel-Verlauf,
  Auswahl-Tönung/-Kontur/-Schatten inkl. Hover-Stufe, Live-Glow mit dem
  **glühenden Ring** der App, Hover-Anhebung — alle Farben per **Farb-Picker**,
  Swatches oder Hex, mit Alpha #RRGGBBAA),
  Status-Darstellung (Icon/Punkt/beides),
  Zeit, Vorschau, Nachrichtenanzahl, Quelle, Öffnen-als (Ersetzen/Stapeln/Tab),
  max. Sessions, Cron ausblenden, Live-Poll, Refresh.
- **Tab-Gruppen**: an/aus, Auto-Gruppierung (aus/Datum/Quelle), Stapel-Stil,
  „Nicht gruppiert"-Bereich.
- **UI-Tabs**: Sidebar-Optik, Radius/Abstände, Trennlinien, aktiver Zustand,
  Label (Schreibweise/Größe), Status-Punkt, Close-Button (Modus/Klickfläche/
  Hover-Chip), Glow an arbeitenden Tabs.
- **Glass & Lesbarkeit**: an/aus, Blur, Sättigung, Flächen-Deckkraft,
  Akzent-Tönung, Verlauf (an/aus, Winkel, Stärke, Endpunkt), feine Kontur,
  Bereiche (Eingabefeld / Chips / Statusleiste).
- **Individualisierung**: Akzent-Tönung (Swatch oder Hex), Chat-Hintergrund
  (Bild/Video über nativen Datei-Picker, Darstellung/Abdunkeln/Weichzeichnen/
  Geltungsbereich).

## Projektstruktur

```
session-flow/
├── desktop/plugin.js            # Catalog-Build (SDK-only, generiert — Marketplace-Eintrittspunkt)
├── full/plugin.js               # QUELLE DER WAHRHEIT (Full-Build, alle Features, Standalone)
├── plugin.yaml                  # Package-Manifest (name/version/requires_hermes)
├── scripts/
│   ├── build-catalog.mjs        # full/plugin.js -> desktop/plugin.js (entfernt #full-Regionen)
│   └── check.mjs                # Syntax + i18n + Hook-Audit (beide Builds) + Surface-Tripwire
├── tests/
│   ├── surface-test.mjs         # Catalog-Regel-8-Tripwire (desktop/plugin.js)
│   ├── render-test.mjs          # Headless-Render-Smoketest (beide Builds)
│   └── style-test.mjs           # Computed-Style-Test (Playwright, optional)
├── install.sh                   # Installer (Full als Default; --variant catalog; --link Dev)
├── uninstall.sh                 # Entfernt die installierte Kopie
├── package.json                 # Nur npm-Skripte — keine Abhängigkeiten
├── plugin-catalog/              # Spiegel des Upstream-Katalogeintrags (NousResearch/hermes-agent)
├── marketplace.json             # Marketplace-Listing-Manifest
├── docs/                        # Guides, Pläne, Integrations-Notizen
├── CHANGELOG.md                 # Keep-a-Changelog-Stil
└── LICENSE (MIT)
```

## Entwicklung

Alles steckt in **einer** Quelldatei: [`full/plugin.js`](full/plugin.js).
Kein JSX, kein `npm install` — Desktop-Plugins werden als reines ESM zur
Laufzeit geladen und bei jedem Speichern hot-reloaded. Full-only-Regionen
sind mit `/* #full */ … /* #end */` markiert; der Catalog-Build wird daraus
generiert.

```bash
npm run check          # Syntax + Locale-Audit + Hook-Audit (beide Builds) + Surface-Tripwire
npm test               # Render-Smoketest gegen BEIDE Builds
npm run test:full      # Render-Smoketest, nur Full-Build
npm run test:catalog   # Render-Smoketest, nur Catalog-Build
npm run build:catalog  # desktop/plugin.js aus full/plugin.js neu generieren
./install.sh --link    # ein mal einrichten (symlinkt full/), danach: speichern -> App lädt neu
```

Konventionen, die man nicht brechen darf (sonst lädt das Plugin nicht):

- **Kein JSX** — nur `jsx()`/`jsxs()` von `react/jsx-runtime` (die Datei wird
  unkompiliert geladen).
- **Nur drei Imports**: `@hermes/plugin-sdk`, `react`, `react/jsx-runtime`.
- **Keine hartkodierten Farben** — nur Theme-Variablen (`var(--ui-…)` / `var(--dt-…)`).
- **Keine Backticks im CSS-Template** — auch nicht in Kommentaren; ein einzelner
  Backtick beendet das Template und bricht das Plugin (`npm run check` fängt es).
- Timers/Listener über `ctx`, DOM-Observer + injizierte `<style>`-Tags über
  `ctx.onDispose` abräumen.
- **Catalog-Regel 8 (gilt nur für `desktop/plugin.js`):** keine App-Markup-Queries,
  keine `document.body`-Observer, keine Core-CSS-Overrides, keine
  `window.hermesDesktop`-Doors, keine synthetischen window/document-Events —
  `npm run check` schlägt bei Verstößen im
  Catalog-Build an; solchen Code nur in `#full`-Regionen oder hinter SDK-Doors.

Mehr Details zur Architektur (Controller-Design, Animations-Dedupe, Stores,
Verifikations-Rezepte): [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) ·
App-Hooks & fragile Selektoren: [docs/APP-INTEGRATION.md](docs/APP-INTEGRATION.md) ·
Ein Feature planen? Einstieg bei [docs/AGENT-GUIDE.md](docs/AGENT-GUIDE.md) —
dem Einstiegspunkt des Plan-/Dokumentationssystems unter
[docs/plans/](docs/plans/).

## Bekannte Grenzen

- **Profil-Scope:** Die Session-Liste liest das *aktive* Profil (über den
  Gateway-RPC `session.list`). Multi-Profil-Ansicht ist geplant.
- **Gruppen-Sortierung:** Manuelle Gruppen haben feste Reihenfolge (Erstellung);
  freies Umsortieren von Gruppen und Tab-Reihenfolgen ist Roadmap.
- **Animation** greift auf Assistant-Nachrichten (Markdown-Blöcke). User-
  Nachrichten und Tool-Karten bleiben bewusst unangetastet.
- `prefers-reduced-motion` **deaktiviert alle Animationen** automatisch.
- Mehr in [docs/ROADMAP.md](docs/ROADMAP.md).

## Mitwirken

Siehe [CONTRIBUTING.md](CONTRIBUTING.md) — Dev-Loop, Konventionen, PR-Checkliste
und wie das Repo auf GitHub veröffentlicht wird.

## Listing im Hermes-Plugin-Katalog

- **Status:** eingereicht — v1.28.1 wurde in
  [hermes-agent #134760](https://github.com/NousResearch/hermes-agent/pull/134760)
  reviewt und abgelehnt (Katalog-Regel 8); v1.29.0 war die Compliance-
  Resubmission und wurde einer zweiten Review-Runde unterzogen: alle vier
  Restpunkte sind in **v1.29.1** adressiert — dokumentiertes
  `desktop/plugin.js`-Layout, keine synthetischen focus-/visibilitychange-
  Events im Catalog-Build, Catalog-Beschreibung auf Ist-Stand des Catalog-
  Builds, Composer-Pill-Toggle dort verborgen. Siehe
  [docs/PLUGIN-CATALOG-PR.md](docs/PLUGIN-CATALOG-PR.md) (vollständige
  Antwort + SDK-Slot-Anfragen auf upstream #116305).
- Der Katalogeintrag liegt in
  [`plugin-catalog/session-flow.yaml`](plugin-catalog/session-flow.yaml) im
  `NousResearch/hermes-agent`-Repo (PR only — human-merged).
  `sha` muss ein exakter 40-Hex-Commit-Pin dieses Repos sein; Bump = neuer
  PR, dessen Diff neu reviewt wird.
- `requires_hermes` ist ein SemVer-Floor (`">=0.21.5"`), `version` matched
  den gepinnten Code. Kontakt zur Submission: **info@agantila.com**.

## Sicherheit

Siehe [SECURITY.md](SECURITY.md) — Plugins laufen ungesandboxed im Renderer;
Meldungen bitte über GitHub.

## Lizenz

MIT (Open Source) — © 2026 **AGANTILA — Deniz Yilmaz**
([agantila.com](https://agantila.com)) · info@agantila.com. Siehe [LICENSE](LICENSE).
