# App-Nav-Zeile (Schnellstart-Icon-Buttons) im Sessions-Pane

- **Status**: Done
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: 2026-10-06
- **Betrifft**: plugin.js (`tabs`-Settings, Pane-Toolbar/Render, i18n, CSS, Tests)
- **Version**: 1.20.0

## Anforderung

> „Session Flow - Wir fügen die Icon Buttons für die Seiten die Hermes Desktop
> als erstel Sektion im Sidepanel hat wie Neue Session, Fähigkeiten, Messaging,
> Artefakte, Geplante Jobs, Kanban. Es soll sich auch dynamisch anpassen können
> als Zeile mit Icon Button die auch weitere Zeilen umfließend haben kann je
> nach anzahl der IconButtons."

## Kontext

Die Hermes-Desktop-Sidebar rendert als erste Sektion eine Icon-Nav
(`SIDEBAR_NAV` in `apps/desktop/src/app/chat/sidebar/index.tsx`): Neue Session
(`robot`), Fähigkeiten (`symbol-misc`), Messaging (`comment`), Artefakte
(`files`, tier advanced), Geplante Jobs (`watch`, tier advanced); Kanban kommt
als Plugin-Beitrag dazu (Codicon `project`, Route `/kanban`).

Das Session-Flow-Pane hat diese Schnellstart-Ziele bisher nur im Toolbar-
Menü („Öffnen") bzw. gar nicht. Diese Zeile zieht die Parität ins Pane —
anfangs als eigener Zeilenblock über der Toolbar.

## Scope

- Neue `tabs.appNav`-Option (Default **an**): Zeile mit Icon-Buttons über der
  Toolbar des Panes.
- Buttons: Neue Session, Fähigkeiten, Messaging, Artefakte, Geplante Jobs,
  Kanban — gleiche Reihenfolge/Codicons wie die App-Sidebar.
- Aktionen: `host.navigate('/capabilities'|'/messaging'|'/artifacts'|'/cron')`,
  Kanban nur mit Feature-Detect (Kanban-Plugin registriert `/kanban` — sonst
  fällt der Button weg, niemals ein toter Button), Neue Session über den
  bestehenden `startNewProjectSession()`-Pfad (respektiert Projekt-Scope).
- **Wrap-Layout**: `flex-wrap` — je nach Pane-Breite/Anzahl brechen die
  Buttons in weitere Zeilen um (Anforderung „umfließend").
- i18n-Keys in EN **und** DE.
- Render-Tests für: Zeile vorhanden (an), abwesend (aus), alle sechs Buttons,
  i18n-Labels, Navigation-Call via `host.navigate`-Spion.

## Nicht-Scope (bewusst ausgeklammert)

- Kein Sidebar-Nav-Contribution des Plugins in die App (die App hat ihre
  eigene Nav-Zeile bereits; wir spiegeln nur INSIDE des Panes).
- Kein aktiver Zustand (die App markiert die Route, in der sie ist — das Pane
  weiß nicht zuverlässig, welche App-Route offen ist; wäre Spekulation).
- Keine Tastenkürzel-Chips (die App zeigt dort Keybind-Hints — Pane-Buttons
  bleiben schlanke Icon-Buttons mit Tooltip).
- Keine eigenen Buttons für Profile/Agenten/StarMap (nicht Teil der Anfrage).

## Umsetzung

- `DEFAULT_SETTINGS.tabs.appNav = true`.
- `NAV_APPS`-Konstante (Icon + Route + i18n-Key), `navigateAppRoute()`-Helfer
  mit Route-Whitelist, `SF_NAV_ROUTES`-Set; `kanbanAvailable()` per
  `document.querySelector` (Feature-Detect, DOM-Stub-safe).
- `navAppsBar` in `SessionsPane` (vor `toolbar` im Return), CSS `.sf-navapps`
  (flex-wrap, `var(--ui-*)`-Tokens), Tooltip-Labels via `t('navApp…')`.
- Test-Exports: `NAV_APPS`, `SF_NAV_ROUTES`, `navigateAppRoute`,
  `kanbanAvailable` an die Export-Liste in `tests/render-test.mjs` anhängen.

## Verifikation

- `npm run check` — Syntax ok, i18n-Parität 467 Keys in beiden Bundles.
- `npm test` — **grün**, inkl. 18 neuer Checks (Sektion 36): Zeile an/aus,
  5-Buttons-ohne-Kanban-Reihenfolge, `data-kanban`-Spiegelung, i18n-Keys,
  Whitelist-Navigation + Ablehnung, DE-Bundle-Labels, Kanban-Detect (6
  Buttons) + Klick → `/kanban`, Neue-Session ohne Router, Toggle-Verhalten.
- `npm run test:style` — **grün** (echtes Chromium), inkl. 4 neuer Checks:
  `display:flex` + `flex-wrap:wrap`, 24-px-Buttons, Reihen-Umbruch bei
  120 px (2 Reihen, tops=[20,45]), Spacer `flex-basis:100%`.

## Follow-ups

- Aktiv-Zustand, sobald die App ihre Route plugin-sichtbar macht.
- Evtl. konfigurierbare Button-Reihenfolge (Settings) — Roadmap-Idee.

## Nachtrag (2026-10-06): Kanban-Detect gefixt

Der erste Detect (`[data-tour="sidebar-nav-kanban"]`) griff im Live-Build
nicht: Plugin-Nav-Beiträge werden als `sidebar-nav-kanban:nav` namespaced
(live per Probe verifiziert; Nebenfunde: `sidebar-nav-next-steps:nav`,
`sidebar-nav-session-flow:nav`). Fix: Präfix-Selektor
`[data-tour^="sidebar-nav-kanban"]` — deckt Built-in- und Contrib-Schema
ab; zweites Signal bleibt der offene Drawer (`.kanban-drawer-content`).
Tests: Pfad-2-Spy auf das reale Live-Schema umgestellt + negative
Sperrung (beide Signale weg → wieder 5 Buttons). Live-Verifikation:
`handleFound=true navBtns=6 barKanban=on labels=…|Kanban`.
