# Session Flow — Hermes Desktop Plugin

Fünf Features in einem Plugin, alle live konfigurierbar:

1. **Chat-Animation (Zeile für Zeile)** — Antworten werden mit Easing weich
   eingeblendet. Beim Öffnen/Wechseln eines Chats laufen die sichtbaren Zeilen
   als Kaskade von oben nach unten ein; während des Streamens animiert jede
   Zeile genau einmal, sobald sie fertig geschrieben ist.
2. **Strg + Scroll = Session-Zyklus** — Mit gedrückter Zusatztaste (Standard
   `Ctrl`) und Mausrad durch die aktiven Sessions scrollen. Ein HUD zeigt
   Position und Titel. Zoom-Flächen (Bild-Lightbox, Code-Editor) behalten ihr
   eigenes Verhalten.
3. **Session-Tabs mit Firefox-artigen Gruppen** — Eine Pane listet alle
   Sessions als kompakte Tabs mit **Aktivitäts-Icon** (denkt / schreibt /
   Tool läuft / wartet auf Antwort / fertig / Fehler). Sessions lassen sich in
   benannte, farbige **Gruppen** legen (Rechtsklick oder Drag & Drop), Gruppen
   klappen zu einem **Stapel** zusammen (spine / fanned / pill). Optional
   automatische Gruppierung nach Datum oder Quelle.
4. **Glass & Lesbarkeit** — Optionaler Frost-Effekt für **Eingabefeld** und
   **UI-Chips**: eine weiche Blur-Fläche mit dezentem, aus der Hermes-Akzent-
   farbe gefärbtem **Verlaufs-Overlay** (transparent auslaufend), damit Texte
   auch ohne eigene Hintergrundfläche gut lesbar bleiben. Bereiche und Optik
   (Blur, Sättigung, Deckkraft, Winkel, Stärke) sind frei einstellbar.
5. **UI-Tabs im Sidebar-Look** — Die Tabs des Content-Bereichs werden zu leicht
   abgerundeten Chips wie die Sidebar-Sessions: ruhiger Hover/aktiver Zustand,
   verbessertes Label (Schreibweise, Größe) und ein freundlicherer **Close-Button**
   (Klickfläche, Hover-Chip, Sichtbarkeit bei Hover / immer / am aktiven Tab).
   **Live-Infos aus dem Sidepanel**: arbeitende Sessions (denkt / schreibt /
   Tools) tragen den umlaufenden Glow-Ring auf ihrem Tab, der Status-Punkt
   bleibt ein-/ausblendbar.

Alles ist in den **Plugin-Einstellungen** anpassbar: `Session Flow`-Seite in der
Sidebar, ⌘K/Ctrl+K → „Session Flow: Einstellungen", oder das Zahnrad in der Pane.

![Feature-Überblick](docs/overview.png)

> Hinweis: `docs/overview.png` ist optional — lege dort gern einen Screenshot ab.

---

## Installation

Voraussetzung: Hermes Desktop (neu genug für das Plugin-SDK,
`~/.hermes/desktop-plugins/` wird unterstützt).

```bash
# Aus dem Repo-Verzeichnis:
./install.sh            # kopiert plugin.js nach ~/.hermes/desktop-plugins/session-flow/
./install.sh --link     # Entwicklungsmodus: Symlink statt Kopie (Hot-Reload beim Speichern)
```

Danach in der App: **⌘K / Ctrl+K → „Reload desktop plugins"** — oder die App
einmal neu starten. Das Plugin lädt danach automatisch bei jedem Start.

**Manuell:** die Datei `plugin.js` nach
`~/.hermes/desktop-plugins/session-flow/plugin.js` kopieren. Der Ordnername
**muss** `session-flow` heißen (= Plugin-id).

**Deinstallieren:** `./uninstall.sh` (entfernt nur das Installationsziel,
nicht das Repo).

### Teilen

- Repo-URL weitergeben + Installationsanleitung oben.
- Oder ein Install-Link (Hermes Deep-Link): `hermes://plugin/install?repo=<owner>/<repo>`
  — der Nutzer bekommt einen Bestätigungsdialog und wählt die Komponenten.

---

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

---

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
- **Session-Tabs**: Dichte (kompakt/bequem), Status-Darstellung
  (Icon/Punkt/beides), Zeit, Vorschau, Nachrichtenanzahl, Quelle, Öffnen-als
  (Ersetzen/Stapeln/Tab), max. Sessions, Cron ausblenden, Live-Poll, Refresh.
- **Tab-Gruppen**: an/aus, Auto-Gruppierung (aus/Datum/Quelle), Stapel-Stil,
  „Nicht gruppiert"-Bereich.
- **UI-Tabs**: Sidebar-Optik, Radius/Abstände, Trennlinien, aktiver Zustand,
  Label (Schreibweise/Größe), Status-Punkt, Close-Button (Modus/Klickfläche/
  Hover-Chip), Glow an arbeitenden Tabs.
- **Glass & Lesbarkeit**: an/aus, Blur, Sättigung, Flächen-Deckkraft,
  Akzent-Tönung, Verlauf (an/aus, Winkel, Stärke, Endpunkt), feine Kontur,
  Bereiche (Eingabefeld / Chips / Statusleiste).

---

## Entwicklung

Alles steckt in **einer** Datei: [`plugin.js`](plugin.js). Kein Build, kein
`npm install` — Desktop-Plugins werden als reines ESM zur Laufzeit geladen und
bei jedem Speichern hot-reloaded.

```bash
npm run check          # Syntaxcheck + Locale-Key-Audit (nur Node nötig)
./install.sh --link    # ein mal einrichten, danach: speichern -> App lädt neu
```

Konventionen, die man nicht brechen darf (sonst lädt das Plugin nicht):

- **Kein JSX** — nur `jsx()`/`jsxs()` von `react/jsx-runtime` (die Datei wird
  unkompiliert geladen).
- **Nur drei Imports**: `@hermes/plugin-sdk`, `react`, `react/jsx-runtime`.
- **Keine hartkodierten Farben** — nur Theme-Variablen (`var(--ui-…)`).
- Timers/Listener über `ctx`, DOM-Observer + injizierte `<style>`-Tags über
  `ctx.onDispose` abräumen.

Mehr Details zur Architektur (Controller-Design, Animations-Dedupe, Stores,
Troubleshooting): [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

### Dateistruktur des Repos

```
session-flow/
├── plugin.js            # Das Plugin (wird installiert)
├── install.sh           # Installer (Kopie oder --link für Dev)
├── uninstall.sh
├── scripts/check.mjs    # Syntaxcheck + i18n-Audit
├── docs/
│   ├── SETTINGS.md      # Alle Optionen erklärt
│   └── DEVELOPMENT.md   # Architektur & Dev-Workflow
├── CHANGELOG.md
└── LICENSE (MIT)
```

---

## Bekannte Grenzen / Roadmap

- **Profil-Scope:** Die Session-Liste liest das *aktive* Profil (über den
  Gateway-RPC `session.list`). Multi-Profil-Ansicht ist als Option geplant.
- **Gruppen-Sortierung:** Manuelle Gruppen haben feste Reihenfolge (Erstellung);
  freies Umsortieren von Gruppen und Tab-Reihenfolgen ist Roadmap.
- **Animation** greift auf Assistant-Nachrichten (Markdown-Blöcke). User-
  Nachrichten und Tool-Karten bleiben bewusst unangetastet.
- `prefers-reduced-motion` **deaktiviert alle Animationen** automatisch.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
