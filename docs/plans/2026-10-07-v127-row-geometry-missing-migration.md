# v1.27.0 — Zeilen-Geometrie-Parität, „Projekt nicht verfügbar"-Hinweis, Migrations-Toast

- **Status**: Done
- **Erstellt**: 2026-10-07
- **Abgeschlossen**: 2026-10-07
- **Betrifft**: plugin.js (`groups.*`, CSS-Zeilen-Geometrie, `loadGroups`)
- **Version**: 1.27.0

## Anforderung

Aus der Übergabe `SESSION-FLOW-v1.26.0-NEXT-STEPS.md` (priorisierte
Offenliste). Wörtlich:

> 🟡 Geometrie-Parität + „Projekt nicht verfügbar"-UI für v1.27,
> 🟢 Migrations-Toast/Sync

Konkret:

1. **🟡 Geometrie-Parität zur nativen Sidebar-Zeile** — „Abstände und
   Einzug nicht identisch". Referenz aus
   `hermes-agent/apps/desktop/src/app/chat/sidebar/row-geometry.ts`:
   26px Row-Höhe, 8px Padding-X, 6px Gap, 14×14 Lead-Cell, 13px/500
   Label, 16×16 Add-Button.
2. **🟡 „Projekt nicht verfügbar"-Hinweiszeile** — `buildSections` markiert
   tote Projekt-IDs bereits mit `isProjectMissing:true`, aber es gab kein
   gerendertes Fallback-UI.
3. **🟢 Migrations-Toast** — einmaliger Hinweis bei der
   v1.25.0→v1.26.0-Migration (cwd→projectIds).

## Kontext

v1.26.0 stellte manuelle Gruppen auf `projectIds[]` um und migrierte alte
`cwd`-Gruppen best-effort. Zwei Restlücken blieben bewusst offen: die
Zeilen-Geometrie driftete 1–2px vom nativen Vorbild ab (und der
Add-Button war 20px statt 16px), und eine Gruppe konnte eine Projekt-ID
referenzieren, die im Baum nicht mehr existiert — der User sah dann nur
einen leeren Count statt eines Hinweises. Die Migration lief zudem
stillschweigend.

## Scope

- `--sf-row-*`-Custom-Properties (`--sf-row-min-h`, `--sf-row-pad-x`,
  `--sf-row-gap`, `--sf-row-lead`, `--sf-row-label-size`,
  `--sf-row-add-size`) auf `:root`, gespiegelt in `applyRows()`.
- `.sf-tab`/`.sf-tab-lead`/`.sf-tab-title`/`.sf-group-actions` auf diese
  Tokens umgestellt; Add-Button-Hover auf
  `--ui-control-hover-background`.
- `isProjectMissing`-Fallback-UI: Hinweis-Zeile mit Warn-Icon + „Aus
  Gruppe entfernen"-Button (`removeProjectFromGroup`); Header ohne `+`.
- `loadGroups`: Migrationsreport + einmaliger Toast
  (`migrationNotified`-Flag im persistierten `$groupsState`).

## Nicht-Scope (bewusst ausgeklammert)

- Drag-Reihenfolge der Kind-Projekte innerhalb einer Gruppe.
- Server-seitige `workspace_groups`-Tabelle (Gateway-Erweiterung).
- Hierarchische Gruppen.
- `groups.autoMode: 'project'` (Auto-Gruppierung) bleibt unverändert.

## Umsetzung (tatsächlich)

### `plugin.js`

- **CSS**: `:root`-Block mit den sechs `--sf-row-*`-Defaults; `.sf-tab`
  (gap/min-height/padding), `.sf-tab-lead` (width), `.sf-tab-title`
  (font-size + `font-weight:500`) und `.sf-group-actions`
  (min-width/min-height + hover-BG) referenzieren die Variablen.
  Neues `.sf-group-missing`-Stil-Set (Zeile + Entfernen-Button).
- **`applyRows()`**: setzt die sechs `--sf-row-*`-Tokens explizit auf
  `document.documentElement` (Mirror des CSS-Defaults).
- **`buildSections()`**: `title`/`titleKey` für fehlende Projekte →
  `titleKey:'groupProjectMissing'` statt hartkodiertem String.
- **`SectionHeader`**: `canNewHere` berücksichtigt `isProjectMissing`
  (kein `+` auf toten Projekt-Headern).
- **Render**: `section.isProjectMissing` rendert `.sf-group-missing` mit
  Warn-Icon, Hinweistext und `removeProjectFromGroup`-Button.
- **`loadGroups()`**: baut `migrationReport` (pro `cwd`-Gruppe: ok +
  Ziel-Projekt-Label) und setzt `migrationNotified` in den State;
  `showMigrationToasts()` toastet einmalig pro Gruppe. `register()`
  registriert i18n nun VOR `loadGroups()`, damit die Bundles für den
  Toast verfügbar sind.
- **i18n EN/DE**: `groupProjectMissing`, `groupProjectMissingHint`,
  `groupProjectMissingRemove`, `groupMigrated`, `groupMigrateFailed`.

### Version

`package.json` 1.26.1 → **1.27.0**, `VERSION`-Konstante, `marketplace.json`
(inkl. aktualisierter `size.pluginJs`).

## Verifikation

- `npm run check` — grün (513/513 Keys EN+DE, Hook-Audit ok).
- `npm test` — grün (neuer Block 35: Geometrie-Mirror, Migration +
  Einmal-Semantik, „Projekt nicht verfügbar" + Entfernen, Bundle-Keys).
- `npm run test:style` — grün (Section 18: 26px/8px/6px/14px/13px/500/
  16px/control-hover gemessen im echten Chromium).

## Follow-ups

- Drag-Reihenfolge der Kind-Projekte, Server-Sync (`workspace_groups`),
  hierarchische Gruppen → `docs/ROADMAP.md`.
- 🔴 Live-Verifikation im echten Desktop bleibt eine User-Aufgabe (zwei
  Projekte anlegen, Gruppe bilden, `+` am Kind-Projekt, DB-Check).
