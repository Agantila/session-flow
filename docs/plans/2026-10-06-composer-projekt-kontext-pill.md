# Composer-Eingabezeile: Projekt-Kontext-Chip vor dem „+"-Button

- **Status**: Done
- **Erstellt**: 2026-10-06
- **Abgeschlossen**: 2026-10-06
- **Betrifft**: plugin.js (`composer`-Namespace neu, i18n, CSS, Settings-UI, Sync-Loop)
- **Version**: 1.21.0

## Anforderung

> „Der Composer soll bei New Session mir die Möglichkeit des Projekt Zuweisung
> minimalistisch geben, so das ich vor der Eingabe im Eingabefeld mir sicher
> sein kann im welchem Kontext ich gerade bin."

Klärung im Gespräch (Verfeinerungen): (1) Statusstapel, (2) „Input-Feld unter
dem Chat", (3) Statusstapel erste Stelle, (4) „in die Zeile wo die Github Info
kommt und genau davor", (5) **final: „Er soll doch nicht dort hin sondern vor
die Eingabe selst vor dem + Add IconButton — Damit immer klar ist im welchen
Porjekt Kontext ich arbeite"** → der Chip sitzt in der Eingabezeile des
Composers, direkt vor dem „+"-Add-IconButton.

## Kontext

- Neue Sessions landeten je nach App-Zustand unter „Kein Projekt" (v1.17.3/
  v1.19.0/v1.19.1-Historie, siehe `2026-10-05-new-session-project-anchor*.md`).
  Der „+"-Pfad im Pane ist verankert — aber der **App-eigene** New-Session-Weg
  (Cmd+N / Tab „New Session") bleibt ein App-Draft, dessen CWD die App erst
  **beim Senden** aus `$currentCwd`/`$projectScope` auflöst
  (`use-session-actions/index.ts:813`, `store/projects.ts:159`).
- Der App-Scope-Atom (`$projectScope`, localStorage `hermes.desktop.projectScope`)
  hat **keine Plugin-Schreib-Tür**: `persistentAtom` liest localStorage nur beim
  Modul-Init; `localStorage.setItem` aktualisiert den Atom nicht. Direktes
  Setzen des Keys war daher ein ghost lever und wurde verworfen.
- Der Statusstapel (`apps/desktop/src/app/chat/composer/status-stack/index.tsx`)
  hängt als `ComposerStatusStack` im Composer-Dock
  (`data-slot="composer-dock"`, `index.tsx:1314`) und rendert **leer → null**.
  Außenrum liegt aber IMMER der Keep-Drawer `StatusDrawerContent`
  (`.status-drawer > .status-drawer-clip > .status-drawer-content`,
  `status-stack/drawer.tsx`) — auch bei leerem Stack gemounted. **Das ist der
  Injektions-Anker**: unsere Zeile als erstes Kind von `.status-drawer-content`
  ist die erste Zeile im Statusstapel-Bereich, über dem Composer, und wird vom
  Dock-Measurement (`--composer-measured-height`) mit abgedeckt.
- Gateway-Verträge (live im Checkout verifiziert):
  - `session.create` mit `cwd` + `cwd_explicit` persistiert nur explizite CWDs;
    ohne cwd bleibt ein Draft losgelöst (Server hat KEINEN Projekt-Fallback,
    `methods_session.py:_create_session`).
  - `session.cwd.set` braucht die In-Memory-ID; nur live.
  - **`session.workspace.move` existiert inzwischen wieder/im Checkout** (by
    `session_key`, persistiert Row + live re-home, ersetzt git-Metadaten) — der
    historische „Methode existiert nicht"-Fallback (v1.19.1) kann beim Re-home
    bestehender Sessions durch den echten Call ersetzt werden (Fallback bleibt).
  - `projects.set_active` = dauerhafter Aktiv-Zeiger (Ziel zukünftiger
    app-eigener Scopes/CLI); `projects.tree` liefert `sessionIds` je Projekt
    (Autorität für „in welchem Projekt ist Session X").

## Scope

- **Pill** (minimalistisch: Farb-Dot + Projektname + Chevron) **in der
  Eingabezeile des Composers, direkt vor dem „+"-Add-IconButton** (Anker:
  `.codicon-add` innerhalb `[data-slot='composer-root']`; Wrapper des Buttons
  = Ziel-Zeile, Chip als erstes Kind davor).
- Klick → Menü: „Kein Projekt (Home)" + alle Projekte aus `projects.tree`.
- **Draft (keine fokussierte Stored-Session)**: Pick erzeugt SOFORT die
  verankerte Session über den bewährten Pfad (`startNewSessionInCwd`: create
  mit cwd+cwd_explicit → `session.cwd.set` → Overlay-Seed → open). Die
  Zuordnung steht damit garantiert **vor** der ersten Eingabe.
- **Bestehende Session**: Pick re-homed per `session.workspace.move`
  (session_key; Fallback `session.cwd.set`/Seed+Toast), inkl. Tree-Refresh.
- Best-effort `projects.set_active` bei jedem Pick (dauerhafter Zeiger).
- Settings: neuer Namespace `composer.projectPill` (Default **an**), Toggle in
  der Chat-Sektion der Plugin-Einstellungen; Sync-Loop (2,5 s) injiziert/
  entfernt die Zeile, Listener auf `$projectsList` + Fokus-Atom aktualisieren
  das Label live.
- Home-Pick bei bestehender Session: Hinweis-Toast (Detach wird von
  `session.workspace.move` nicht unterstützt) + `set_active(null)`.

## Nicht-Scope (bewusst ausgeklammert)

- **Kein Umbau der App selbst** (der App-Atom `$projectScope`/`$currentCwd`
  bleibt ohne Plugin-Schreib-Tür; ein echtes „Draft-CWD vor-Umstellen" braucht
  einen App-PR — Reibrandum: unser sofortiger anchored Create ersetzt den
  leeren Draft, Restrisiko „Tippen im alten Draft vor dem Open" ist winzig und
  im Plan dokumentiert).
- Kein Umbau des „+"-Pfads im Pane (läuft bereits über denselben Pfad).
- Keine Pill in Keep-Alive-/hinten liegenden Tiles (nur fokussiert + sichtbar).
- Kein Projekt-Wechsel-UI im Composer der APP selbst (Plugin-Grenze).
- Kein eigener Settings-Block mit Position/Größe — bewusst minimalistisch.

## Umsetzung

- `plugin.js`:
  - `VERSION` → 1.21.0; `DEFAULT_SETTINGS.composer = { projectPill: true }`.
  - Atome: `$composerPick` (letzter Draft-Pick, { id, label, color, at }).
  - Sync-Loop `syncComposerProjectPills()` (2,5 s, ctx.setInterval): findet im
    fokussierten, sichtbaren Composer-Root den „+"-Button
    (`.codicon-add` → `closest('button')`) und injiziert den Chip als erstes
    Kind in dessen Wrapper-Div (Eingabezeile, direkt vor dem „+"); entfernt
    ihn bei Setting aus. Pop-out-Roots (`data-popped-out` PRESENT) und
    Overlay-/Keep-Alive-Panes bekommen bewusst keinen Chip. **Live-Falle**:
    `getAttribute` liefert `null` statt `undefined` — der erste Versuch
    verglich falsch und übersprang ALLE Roots (Probe: chips=0); Fix mit
    `hasAttribute`.
  - Label-Logik: fokussierte Stored-Session → Projekt via `projects.tree`
    (`sessionIds`), Overlay-Seed hat Vorrang; Draft → `$composerPick` bzw.
    gelernter Anker aus `resolveNewProjectSessionCwd()`.
  - `applyComposerPick(node)`: Draft → `startNewSessionInCwd(node.path,
    node.label)`; Session → `rehomeFocusedSession()` (move → cwd.set-Fallback
    → Seed+Toast); danach `setActiveProject` best-effort + Tree-Refresh.
  - Menü imperativ (fixed unter der Pill, Outside-Click/Escape schließt).
  - i18n (EN+DE): `composerProject*` (9 Keys), Settings-Labels.
- CSS: `.sf-cproj*` (nur `var(--*)`/`color-mix`, keine Backticks),
  `prefers-reduced-motion` respektiert.
- Settings-UI: Toggle in `sf-sec-sessions` („Projekt-Chip im Composer").
- Tests: Style-Test-Sektion (Chip-Geometrie am Injection-Fixture);
  Render-Test läuft unverändert grün (die Chip-Injektion ist reiner DOM-Loop,
  kein React-Render-Pfad).

## Verifikation

- `npm run check` — ✅ Syntax ok, i18n-Parität EN/DE (481 Keys je Bundle).
- `npm test` — ✅ Render-Smoketest bestanden.
- `npm run test:style` — ✅ inkl. neuer Chip-Geometrie-Sektion
  (Zeile flex, Pill 26 px, Dot 8 px mit Projekt-Farbe, Menü fixed z=60).
- **Live im laufenden Desktop** (Probe-Plugin, 6 Messungen): `chips=1`,
  `nextIsPlus=true` (Chip sitzt direkt vor dem „+"), `pill=142x26`,
  Draft-Zustand korrekt (`data-sf-cproj-draft=true`, Label „Kein Projekt
  (Home)"). Probe danach entfernt.

## Follow-ups

- App-PR-Idee (echter Draft-CWD-Hebel): Plugin-Tür für `$projectScope`/einen
  `setCurrentCwd`-Door — dann kann der Chip den App-Draft direkt umstellen,
  ohne Ersatz-Create. → ROADMAP „Geplant / Ideen".
