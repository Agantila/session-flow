# List/Grid-Gruppierung, Projekt-Ordner, Drag&Drop-Feedback, Filter & Tab-Selektor

- **Status**: Done
- **Erstellt**: 2026-10-04
- **Abgeschlossen**: 2026-10-04
- **Betrifft**: `plugin.js` (`groups.*`, `tabs.*`, `SectionHeader`, `TabRow`,
  `SessionsPane`, CSS), `tests/render-test.mjs`, `docs/SETTINGS.md`,
  `docs/ROADMAP.md`, `docs/APP-INTEGRATION.md`, `CHANGELOG.md`, `README.md`,
  `README.de.md`
- **Version**: 1.14.0

## Anforderung

Wörtlich aus dem Auftrag:

> „Wir optimieren die List und GridView Gruppenfunktionen und die
> Gruppierung der Einträge soll einstellbar sein, so wie bei der Sessions
> Liste von Hermes Desktop selbst. Übernehme die Filter und
> Einstellungsmöglichkeiten für die Session-Darstellungen für unser Session
> Flow List und Grid View mit allen Optionen und passe es optimal an unsere
> Feature an, sodass auch die Collapsibles mit den Namen der Session
> Projektordner genauso dargestellt werden wie unter Projekte von Hermes
> Desktop.
>
> Das Drag und Drop-Verhalten soll auch maximal intuitiv und animiert
> unterstützt, so wie mit Hover States und die Zuordnung erleichtern und
> zeigen, was passiert, wenn ich loslasse. Ich möchte in der Session Flow
> Einstellungen auch die Option haben, die Grid und ListView als Tab
> Selektoren zu nutzen, sodass wir die Tabs von Hermes Desktop ausblenden
> können, weil wir damit schon die Funktionalität abgebildet haben."

Danach, im selben Auftrag, die Anschlussanforderung:

> „Dokumentiere alles im Projekt und lege eine Memory und Planungs sowie
> Dokumentations Logik mit System und Anweisung im Projekt an für
> Professionelle Weiterentwicklung — Schließe danach den Auftrag ab und
> dokumentiere ihn in dem Projekt als Plan, nachdem die Struktur dafür
> steht."

Dieser Plan deckt beide Teile ab: die Feature-Umsetzung UND (als eigener
Abschnitt in `docs/PLANNING.md`/`docs/AGENT-GUIDE.md`) die Dokumentations-/
Planungs-Infrastruktur, die diese Datei selbst erst ermöglicht.

## Kontext

Die Session-Flow-Pane hatte bereits manuelle Firefox-artige Gruppen plus
automatische Gruppierung nach Datum/Quelle (`groups.autoMode: off|date|
source`), aber kein Äquivalent zur **Projekt-Baumstruktur**, die Hermes
Desktop in seiner eigenen Sidebar unter „Projekte" zeigt (Ordner-Header mit
Hover-Caret, Hover-„+", echte Projekt-Zuordnung). Drag & Drop existierte nur
als native HTML5-DnD ohne visuelles Feedback (ein CSS-Selektor für
`[data-drop=true]` lag bereits vorbereitet im Stylesheet, aber ungenutzt).
Es gab weder eine Such-/Filterleiste in der Pane noch eine Möglichkeit, die
native Hermes-Tab-Leiste abzuschalten, wenn die Pane dieselbe Navigation
bereits abdeckt.

Referenz-Recherche im parallelen `hermes-agent`-Checkout
(`apps/desktop/src/app/chat/sidebar/`) lieferte die Vorbilder:
`sessions-section.tsx` (Gruppierungs-/Grouping-Modi `date`/`status`/`none`),
`chrome.tsx`/`workspace-header.tsx` (Projekt-/Repo-Header-Chrome: Lead-Icon,
hover-reveal Caret via `DisclosureCaret`, hover-reveal „+"), `reorderable-
list.tsx` (dnd-kit-basiertes Reordering — als Architektur-Vorbild, nicht
1:1 übernehmbar, siehe Nicht-Scope).

## Scope

- Neuer Gruppierungs-Modus `groups.autoMode: 'project'`: Sessions nach `cwd`
  gruppiert, Label aus `projects.list` (Fallback: Ordnername).
- `SectionHeader` erweitert: Projekt-Kind zeigt Ordner-Icon, Hover-Only-Caret,
  Hover-„+" (startet Session mit dieser CWD), Tooltip = voller Pfad.
- Drag & Drop: Ziehen eines Tabs auf einen Projekt-Header löst
  `session.workspace.move` aus (echte Verschiebung). Hover-Tracking
  (dragenter/dragleave mit Containment-Check) treibt `data-drop`-Highlight
  auf Header **und** Section plus einen Inline-Zielhinweis. Gezogene Zeile:
  Skalierung, gestrichelter Outline, Grabbing-Cursor. Erfolgreicher Drop:
  kurzer Akzent-Flash auf der Zielzeile (`data-just-moved`,
  `prefers-reduced-motion`-sicher).
- Filter-Leiste in der Pane: Textsuche (Titel/Branch/Vorschau) + Schnellfilter
  Alle/Angepinnt/Aktiv, rein clientseitig, eigener Leerzustand.
- Neue Einstellung `tabs.asTabSelector`: blendet die native
  Content-Tab-Leiste für Session-Tabs aus (`:has()`-Selektor, nur Streifen
  mit Session-Tile-Tabs).
- Vollständige i18n (EN/DE), Render-Smoketest-Abdeckung, Doku-Updates
  (SETTINGS/ROADMAP/APP-INTEGRATION/CHANGELOG/README+README.de).
- Dokumentations-/Planungssystem: `docs/AGENT-GUIDE.md`, `docs/PLANNING.md`,
  `docs/plans/TEMPLATE.md` + dieser Plan als erstes gefülltes Beispiel.

## Nicht-Scope (bewusst ausgeklammert)

- **Freies Umsortieren per DnD innerhalb einer Gruppe** (Reihenfolge der
  Zeilen selbst) — das Vorbild (`reorderable-list.tsx`) nutzt `@dnd-kit/
  core`, das Plugins laut SDK-Regelwerk nicht importieren dürfen
  (`@hermes/plugin-sdk`/`react`/`react/jsx-runtime` sind die einzigen
  erlaubten Importe). Bleibt Roadmap-Idee „Freies Umsortieren innerhalb
  einer Gruppe".
- **Persistenz der Filter-Leiste** — bewusst ephemeral wie im Hermes-Vorbild
  (Suchfeld der Sidebar ist auch Komponenten-State, kein Store).
- **Pixel-genaue 1:1-Portierung der gesamten Hermes-Sidebar-Architektur**
  (Virtualisierung, dnd-kit, React-Query) — nicht möglich ohne Build-Schritt/
  zusätzliche Dependencies, die das Ein-Datei-Plugin-Prinzip verletzen würden.
  Übernommen wurde die **Optik und das Interaktionsmuster** (Ordner-Header,
  Hover-Reveal, Ziel-Highlight), nicht die Implementierung.
- **`tabs.asTabSelector` scope-begrenzen auf nur eine Pane-Art** — die
  einfache, robuste `:has()`-Regel blendet jeden Streifen mit
  Session-Tile-Tabs aus, auch gestapelte Tabs im Content-Bereich. Dokumentiert
  als bewusster Trade-off in `docs/ROADMAP.md` („Bekannte Grenzen").

## Umsetzung

- `plugin.js`:
  - `DEFAULT_SETTINGS.tabs.asTabSelector = false` (neuer Key).
  - Neuer Store `$projectsList` + `refreshProjectsList()` + `projectLabelForCwd()`
    (Cache aus `projects.list`, 60-s-Poll + Initial-Load in `register()`).
  - `buildSections()`: neuer `else if`-Zweig für `autoMode === 'project'`
    (Bucket nach `cwd`, Sortierung alphabetisch nach Label, „Kein Projekt"
    zuletzt).
  - `startNewSessionInCwd(cwd, label)` extrahiert aus `startNewProjectSession()`
    — wiederverwendet vom Projekt-Header-„+"-Button.
  - `SectionHeader`: neue Props `onNewHere`, `dropActive`; Projekt-Kind-Zweig
    (Ordner-Icon via `Codicon`, Hover-Caret-CSS-Klasse `sf-group-project`,
    Hover-„+", Inline-Zielhinweis `sf-group-drophint`).
  - `SessionsPane`: neue State-Hooks `dragOverKey`, `justMovedId`,
    `filterText`, `filterMode`; `sectionHandlers()` erweitert um
    dragenter/dragleave-Tracking + `session.workspace.move`-Aufruf für
    Projekt-Sections; `filteredSections`-Memo wendet Textsuche + Schnellfilter
    an; neue `filterBar`-UI zwischen Toolbar und Liste.
  - `TabRow`: neues `justMoved`-Prop → `data-just-moved`-Attribut.
  - CSS: `.sf-group-project` (Hover-Caret), `.sf-group-lead-icon`,
    `.sf-group-drophint`, `.sf-section[data-drop=true]`,
    `.sf-group-head[data-drop=true]`, erweiterte `.sf-tab[data-dragging=true]`
    (Skalierung/Outline/Grabbing), `@keyframes sf-just-moved`, `.sf-filterbar`
    + Kinder, sowie die `:has()`-Regel für `tabs.asTabSelector`
    (`html[data-sf-hide-tabstrip='on'] div:has(> [role='tablist']
    [data-tree-tab^='session-tile:'])`).
  - `applyTabSelectorMode()`/`clearTabSelectorMode()` + Verdrahtung in
    `register()`/`onDispose()`.
  - `VERSION` → `1.14.0`.
- `tests/render-test.mjs`: Export-Liste um `$sessions` ergänzt; neuer
  Testblock (17) prüft Projekt-Header-Rendering, Filter-Leiste und die zwei
  neuen Settings-Zeilen.
- `package.json`: `version` → `1.14.0`.
- Doku: siehe Dateiliste oben unter „Betrifft".

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM)
✓ EN: alle 376 benutzten Keys vorhanden
✓ DE: alle 376 benutzten Keys vorhanden
Alles gut.

$ npm test
[session-flow] v1.14.0 loaded (glass: on)
… (alle bisherigen Checks weiterhin grün, inkl. der bereits vorhandenen
   Info-Dichte-Tests) …
✓ v1.14.0: Projekt-Gruppierung rendert einen Projekt-Header — heads=1
✓ v1.14.0: Pane zeigt die Filter-Leiste
✓ v1.14.0: Filter-Suchfeld vorhanden
✓ v1.14.0: Einstellungen enthalten groupsAutoProject-Option
✓ v1.14.0: Einstellungen enthalten tabsAsTabSelector-Zeile

=== RENDER-SMOKETEST BESTANDEN ===
```

`npm run test:style` nicht gelaufen (optional, benötigt Playwright + lokalen
Hermes-Desktop-Checkout) — die Design-CSS-Änderungen dieser Version sind
additiv (neue Selektoren, keine Änderung bestehender Liste/Grid-Paritäts-
Regeln); Risiko gering, aber **vor der nächsten Design-CSS-Änderung an
`.sf-tab`/`.sf-group-head` sollte der Style-Test nachträglich einmal gegen
diese Version laufen**, siehe Follow-ups.

Nicht live im laufenden Hermes-Desktop getestet (kein laufender App-Prozess
in dieser Sitzung verfügbar) — der Render-Smoketest deckt Rendering/
Zustandslogik ab, nicht die echte Browser-Darstellung (Hover-Timing,
`:has()`-Browserunterstützung in der gebündelten Electron-Chromium-Version).
Empfehlung: nach dem nächsten Plugin-Reload in der App kurz manuell prüfen
(Checkliste siehe Follow-ups).

## Follow-ups

- **Manuelle Live-Verifikation** (nächste Sitzung mit laufender App):
  Projekt-Gruppierung einschalten, einen Tab auf einen Projekt-Header ziehen
  und prüfen, dass die Session wirklich umzieht; `tabs.asTabSelector`
  einschalten und prüfen, dass nur Streifen mit Session-Tabs verschwinden
  (Terminal-/Dateien-Tabs bleiben).
- **`npm run test:style` nachziehen**, sobald als nächstes an `.sf-tab`/
  `.sf-group-head` gearbeitet wird — siehe `docs/ROADMAP.md` für den
  generellen Hinweis, Design-CSS-Änderungen mit dem Style-Test abzusichern.
- **Freies Umsortieren innerhalb einer Gruppe** — siehe
  `docs/ROADMAP.md` → „Geplant/Ideen".
- **Filter-Leiste persistieren (optional)** — siehe
  `docs/ROADMAP.md` → „Geplant/Ideen".
