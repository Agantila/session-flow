# Status-Indikatoren auf den App-Nav-Buttons (Kanban + Geplante Jobs)

- **Status**: Done
- **Erstellt**: 2026-10-06
- **Abgeschlossen**: 2026-10-06
- **Betrifft**: plugin.js (`$navStatus`-Atom, NavAppsBar, CSS, i18n, Tests)
- **Version**: 1.20.0

## Anforderung

> „Füge bitte noch eine Anpassung für das neue Icon-Button-Menü durch. Und
> zwar sollte eins wie bei Kanban gerade innerhalb dieser Sektion eine aktive
> Session laufen, wie bei Kanban, sollte das mit einem kleinen Indikator oben
> rechts über dem Iconbutton dargestellt werden. Und diese Indikator soll
> auch Zustände wie Blockt oder andere, die verfügbar sind, repräsentieren
> und vielleicht erstmal nur für Kanban und Geplante Jobs."

## Kontext

Die v1.20-Schnellstart-Zeile spiegelt die erste Sektion der App-Sidebar.
Kanban und Geplante Jobs haben dort in der App eigene Aktivitäts-Signale:
die App färbt den Sidebar-Cron-Punkt nach `jobState(job)` (STATE_DOT:
`error` → destructive, `paused` → amber, sonst primär) und der
Kanban-Statusbar-Pill nach Running+Ready-Spalten. Das Plugin kennt beide
Quellen ehrlich über die App-eigenen REST-Endpunkte.

## Scope

- Neuer `$navStatus`-Atom + Poll (60 s, `ctx.setInterval`) über zwei
  App-REST-Quellen:
  - **Kanban**: `GET /api/plugins/kanban/board` (dieselbe Route wie das
    App-Plugin selbst, `hermesDesktop.api`-Bridge) → Spalten-Counts
    (running/blocked/review).
  - **Cron**: `GET /api/cron/jobs` → `jobState()`-Replik (state-String oder
    enabled-Flag, App-Logik aus `app/cron/job-state.ts`) → error/paused/
    running.
- Anzeige: 7-px-Punkt oben rechts auf dem Button (`data-nav-status` +
  `data-tone`: running=grün/`--sf-ok`, blocked/error=rot/`--sf-bad`,
  review=amber, paused=amber, idle=None); Tooltip-Erweiterung
  (`navAppKanbanHint`, `navAppCronHint`) mit Counts in DE/EN.
- Nur Kanban + Geplante Jobs (Anforderung); beide degradieren still
  (Bridge fehlt/Fetch-Fehler → kein Punkt, nie erfundene Zustände).
- Kanban-Punkt nur bei vorhandenem Kanban-Button (Detect).

## Nicht-Scope

- Keine anderen Buttons (Fähigkeiten/Messaging/Artefakte haben keine
  plugin-erreichbare Aktivitäts-Quelle — ohne Daten kein Punkt).
- Kein Live-Socket (Kanban-Events-Stream) — Poll reicht für den Indikator;
  Socket-Anbindung wäre Follow-up.

## Umsetzung

- `NAV_STATUS_POLL_MS = 60_000`; `refreshNavStatus()` mit In-Flight-Guard,
  gespeist in `$navStatus = { kanban: {state,count}|null, cron: …|null }`.
- `NavAppsBar` liest `$navStatus` via `useValue` (Hooks-Disziplin: oben im
  Component-Body), Punkt als `::after`-Pseudo-Element via `data-nav-status`
  am Button (kein extra Kind → kein Test-Stub-Problem).

## Verifikation

- `npm run check` — Syntax ok, i18n-Parität **481 Keys** in beiden Bundles.
- `npm test` — **grün**, 12 neue Checks (Sektion 38): Kanban-Mapping
  (Priorität running>blocked>review>ready, Counts, null/{}-Degradierung),
  cronJobState-Replik (state-String > enabled-Flag, Trim), Cron-Priorität
  (error>paused>running>scheduled>idle), Tone-Mapping vollständig,
  Button-Rendering (`data-status=ok/bad`, Neue-Session bleibt `off`),
  Status-i18n-Keys benutzt, DE-Labels („läuft: 2"/„blockiert: 3"),
  idle/ohne-Daten → `off` + keine Status-Keys, `refreshNavStatus` ohne
  Bridge degradiert still.
- `npm run test:style` — **grün** (echtes Chromium), 4 neue Checks:
  Tone-Attribute am Fixture (kanban=ok, cron=bad, news=off), Punkt erzeugt
  (`::after` content, 7px, radius 50 %, Button `position:relative`),
  Farben (ok=`rgb(52,211,153)`, bad=destructive-Fallback `rgb(248,113,113)`),
  kein `::after` bei `off`. Fixture-Buttons tragen `data-status`
  (Spiegel des echten Renderings).
- Rohrezept der Quellen (App-Checkout verifiziert): Kanban zählt
  `columns[].tasks` wie die Statusbar-Pill; Cron-Zustände aus
  `STATE_DOT`/`jobState` (`app/cron/job-state.ts`).
