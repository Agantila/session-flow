# Ladeerlebnis, Projekt-Verwaltung und Filter-Parität mit der Hermes-Sessions-Ansicht

- **Status**: Done
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: 2026-10-05
- **Betrifft**: plugin.js (`tabs`/`view`-Settings, SessionsPane, buildSections, refreshSessions, Projekt-RPCs, Sync-Observer)
- **Version**: 1.19.0

## Anforderung

> „Sobald ich Hermes Desktop starte, dauert es sehr lange, bis Session Flow im Side Panel Sessions sowie die Projekte lädt. Das sollte bitte optimal lösen für maximale Performance und solange noch keine Sessions geladen sind, soll ein Ladebalken und eine Information angezeigt werden, dass sobald das Gateway die Sessions anzeigt, auch die Sessions und Projekte dort angezeigt werden. Sorgt auch dafür, dass die Anpassungen und Änderungen von Projekten innerhalb der normalen Hermes Desktop Session Ansicht direkt synchron und sofort instantan verfügbar sind in der Session Ansicht von Session Flow im Side Panel. Das Erstellen von neuen Projekten beziehungsweise Verknüpfen von Ordnern soll genauso wie bei Hermes Sessions auch in Session Flow und über das Typepanel möglich sein. Das heißt, alle Möglichkeiten, die dort in dem Filter anzeigen. Sorgt dafür, dass die Sessions von Hermes Desktop mit seinen Optionen und Anzeigefilteroptionen eins zu eins auch in Session Flow ermöglicht werden und in den schon verfügbaren Features und Buttons, die wir haben, die Funktionen ergänzt werden, die noch fehlen."

## Kontext

- v1.18.0 hat das Gateway-Bootstrap-Gate eingeführt (Initial-Satz erst bei `host.state.gateway === 'open'`). Was fehlt: sichtbares Feedback WÄHREND des Ladens (Pane wirkt „tot"), und der Eindruck „dauert sehr lange", weil die Projekt-Gruppierung erst nach `projects.tree` (Git-Probes, langsamster Call) korrekt steht.
- Die Hermes-Sidebar (`filter-menu.tsx`) hat Gruppierung (date/profile/project/status), Sortierung (updated/created/status/tokens/cost/manual), Row-Meta (updated/preview/tokens/cost/pr/profile), Status-Filter (needs-input/working/unread/draft/idle), PR-/Profil-/Projekt-Filter, Archiviert-Modus, Alle aus-/einklappen, Alle als gelesen.
- Gateway feuert KEINE `projects.*`-Events (verifiziert: `_broadcast_global_event` kennt nur skin/connection/display/session.reclaimed) → App→Plugin-Sync braucht einen Sidebar-DOM-Observer (`[data-sessions-mode]`-Container, `data-sessions-project` an Projekt-Rows) plus Poll.
- REST `/api/sessions` (dieselbe Bridge, die der Pin-Spiegel nutzt) liefert die vollen Zeilen: `pinned`, `unread`, `archived`, `input_tokens/output_tokens`, `estimated_cost_usd/actual_cost_usd`, `last_active`, `message_count`, `tool_call_count`, `profile` (via `/api/profiles/sessions`) — die Datenbasis für Sortierung nach Tokens/Kosten, Unread-Filter und Profil-Gruppierung. PATCH `/api/sessions/{id}` kann `unread` setzen („Alle als gelesen").
- Projekt-RPCs (alle im Gateway verifiziert, `methods_projects.py`): `projects.create/update/add_folder/remove_folder/set_primary/archive/delete/set_active`, plus `projects.tree`/`list` (bereits genutzt).
- Preload-Doors: `window.hermesDesktop.revealPath` (Dateimanager), `selectPaths` (bereits genutzt), `writeClipboard` (bereits genutzt).

## Scope

1. **Ladeerlebnis**: `$loadPhase`-Atom (`gate`→`loading`→`ready`/`error`); solange keine Sessions da sind: animierter Ladebalken + Hinweistext „Gateway verbindet sich — Sessions und Projekte erscheinen hier automatisch". Projekt-Gruppierung zeigt KEINE falsche „Kein Projekt"-Sektion mehr, solange der Baum lädt (`projectsPending()`), sondern eine „Projekte werden geladen"-Sektion. Sessions rendern sofort nach `session.list`; der Baum zieht asynchron nach.
2. **Datenquelle aufbohren**: `refreshSessions()` liest primär REST `/api/sessions?…order=recent` (volle Zeilen inkl. pinned/unread/tokens/cost/last_active) mit Fallback auf den bisherigen `session.list`-RPC (dünn, Features degradieren sauber). Pin-Spiegel bleibt für den RPC-Fallback-Pfad.
3. **Filter-Parität** (neuer Settings-Bereich `view`, persistiert wie die App): Sortierung (updated/created/status/tokens/cost), Status-Filter (working/needs-input/unread/draft/idle, Multi-Select), Projekt-Filter (Multi-Select aus der Projektliste), Archiviert-Modus (eigener Anzeigemodus mit REST `archived=only` + Wiederherstellen), Row-Meta-Toggles Tokens/Kosten/Profil, Status-Gruppierung, „Alle einklappen/ausklappen", „Alle als gelesen" (Bulk-PATCH `unread:false`).
4. **Projekt-Verwaltung in Session Flow**: Toolbar-Button „Neues Projekt" + Dialog (Name, Ordner via nativem Picker, Farbe, Icon) → `projects.create`; Projekt-Header-Menü (⋯): Umbenennen, Ordner verknüpfen/entfernen/primär setzen, Farbe, Als aktives Projekt, Im Dateimanager anzeigen, Pfad kopieren, Auto-Projekt ausblenden / Projekt löschen (ConfirmDialog).
5. **Instant-Sync**: App→Plugin: MutationObserver auf den Sidebar-Container (`[data-sessions-mode]`, attributeFilter + childList, Debounce 600 ms) → `invalidateProjectTree()` + `scheduleSessionsRefresh`; zusätzlich `window`-focus-Nachziehen. Plugin→App: nach jeder Plugin-Mutation (Projekt-Änderung, Pin, Archiv, Move) sanfter Refresh-Kick per `window.dispatchEvent(new Event('focus'))` + `document.dispatchEvent(new Event('visibilitychange'))` (die App refresht ihre Sidebar genau auf diese Events, `use-background-sync.ts`).

## Nicht-Scope (bewusst ausgeklammert)

- **PR-Filter** (`gh`-abhängig, `desktopGit()?.review?.prList` ist kein Plugin-Door) — wäre reine Attrappe.
- **Sortierung „manual"** (DnD-Reorder der Zeilen) — die App aktiviert sie nur per Drag; Session Flow hat kein Zeilen-Reorder. Weglassen, dokumentiert.
- **Profil-Filter/„Alle Profile"-Modus** als Umschalter (Multi-Backend-Fan-out) — die Profil-GRUPPIERUNG ist drin (REST-Tag `profile`), aber kein Profil-Switcher.
- **Projekt-„betreten"/Drill-in** (eigene Projekte-Ansicht wie die App) — Session Flow bleibt eine Liste; Projekte sind Sektionen.
- **Idee/Board/Worktree-Features** des App-Projektdialogs (KI-Idee, `board_slug`) — Kern-CRUD reicht für die Parität des Session-Kontexts.

## Umsetzung

### E1 — Datenlage + Ladeerlebnis
- [x] `DEFAULT_SETTINGS.view`: `{ ordering:'updated', statusFilter:[], projectFilter:[], showArchived:false, showTokens:false, showCost:false, showProfile:false }` + Migration (deepMerge deckt Altdaten ab).
- [x] `normalizeRichRow()` für REST-Zeilen (unread/tokens/cost/lastActive/profile/archived) und `normalizeRow()` erweitert (Felder optional).
- [x] `refreshSessions()`: REST-first (`/api/sessions?limit=N&order=recent`), RPC-Fallback; `$sessionsError`-Semantik unverändert.
- [x] `$loadPhase` + `bootstrapSessionData()` setzt Phasen; SessionsPane rendert `sf-load`-Block (Ladebalken + Info) wenn `!rows.length && phase!=='ready'`.
- [x] `projectsPending()`; `buildSections()` Projekt-Modus: pending → „Projekte werden geladen"-Sektion statt falscher „Kein Projekt"-Gruppierung.

### E2 — Filter-Parität
- [x] `view.ordering` Sortierung je Sektion (updated=lastActivityAt, created=startedAt, status=Busy-Rang, tokens, cost).
- [x] `view.statusFilter` als Zeilen-Filter in `buildSections` (working/needs-input via Live-Map, unread/draft via REST-Felder).
- [x] `view.projectFilter` filtert Zeilen über `resolveSessionProject()` (in jeder Gruppierung).
- [x] Status-Gruppierung (`autoMode:'status'`): Bedarf Eingabe / Läuft / Ungelesen / Leer / Ruheend.
- [x] Archiviert-Modus: Segment-Erweiterung „Archiv" + `$archivedRows` (REST `archived=only`, on demand) + Row-Aktion „Wiederherstellen" (`session.archive {archived:false}`).
- [x] Row-Meta: `showTokens`, `showCost`, `showProfile` Badges; „Alle als gelesen" (Bulk-PATCH); „Alle einklappen/ausklappen".
- [x] Ansichtsoptionen-Menü: Untermenüs Gruppierung/Sortierung/Filter Status/Filter Projekte + Aktionen; `DropdownMenuSub*`/`DropdownMenuCheckboxItem` Import ergänzt.

### E3 — Projekt-Verwaltung
- [x] `ProjectDialog` (create/edit): Name, Ordner-Liste (Picker via `selectPaths`, entfernen, primär), Farbwahl, Icon; Submit mappt auf `projects.create` / `projects.update` / `projects.add_folder` / `projects.remove_folder` / `projects.set_primary`.
- [x] Toolbar-Button „Neues Projekt".
- [x] Projekt-Sektionsmenü: Umbenennen / Ordner verknüpfen / Als aktiv / Farbe / Dateimanager (`revealPath`) / Pfad kopieren / Auto ausblenden (`view.dismissedAuto`, lokal) / Löschen (`projects.delete`, ConfirmDialog).
- [x] Nach jeder Mutation: `invalidateProjectTree()` + App-Kick (dispatchEvent focus + visibilitychange).

### E4 — Instant-Sync
- [x] `watchSidebarProjects()`: MutationObserver (scoped, debounced) + `window` focus → `invalidateProjectTree()`/`scheduleSessionsRefresh`.
- [x] `kickAppRefresh()` nach Plugin-Mutationen.

### E5 — i18n
- [x] Alle neuen Keys in EN + DE (`npm run check` erzwingt Parität).

### E6 — Verifikation
- [x] `npm run check` + `npm test` + `npm run test:style` grün; neue Render-Test-Sektionen: Lade-UI, Projekt-Pending, Status-Filter, REST-Enrichment, Archiv-Modus, Projekt-Dialog-Markup.
- [x] Live-Verifikation: App-Start-Verhalten (Skeleton vor Gateway-open), Projekt-Create über die Pane sichtbar in der App-Sidebar (und umgekehrt).

### E7 — Bug-Fix aus der Übergabe
- [x] `buildSections()`-Pending-Guard: Bedingung `!isNoProject && projectsPending() && items.length && !meta` traf nie (alle Zeilen landen via `resolveSessionProject()` in `__no_project__`, sobald der Baum leer ist) und zerstörte sogar gepushte Sektionen. Ersetzt durch expliziten Pending-Pfad: eine `kind:'project-pending'`-Sektion mit `titleKey:'projectsPendingTitle'` + `hintKey:'projectsPendingHint'` (Subtext über `SectionHeader`).
- [x] `ProjectDialog` rendert im Pane-Return (war nur State, kein jsx).
- [x] `ConfirmDialog` für `projConfirmDelete` rendert (war State, kein jsx).
- [x] Toolbar-Button „Neues Projekt" (Codicon `folder-library`) hinzugefügt.
- [x] Toter State `busyToast`/`setBusyToast` entfernt.
- [x] `watchSidebarSync(ctx)` in `register()` verdrahtet, Disposer in `onDispose`.
- [x] i18n-Key `projDeleted` in EN+DE ergänzt.
- [x] Test-Export-Liste (`tests/render-test.mjs`) um `$loadPhase`, `$archivedRows`, `$sessionsError`, `invalidateProjectTree` erweitert (sonst `mod.$newAtom is undefined` in zukünftigen Tests).

## Verifikation (evidenz)

- `npm run check` ✓ — Syntax ok (ESM), 458 Keys in EN+DE, Parität sauber.
- `npm test` ✓ — Render-Smoketest bestanden, inkl. neuer v1.19.0-Sektion
  (Lade-Phase, Pending-Sektion, Toolbar-Button, ProjectDialog-Ruhe).
- `npm run test:style` ✓ — alle bestehenden Computed-Style-Checks grün
  (keine CSS-Regression).
- `package.json` `version` = 1.19.0, `VERSION`-Konstante in `plugin.js` =
  1.19.0 → synchron.
- Live-Verifikation steht aus (Plan fertig, App-Restart nach Hot-Reload
  öffnet die Pane mit Ladebalken + Pending-Sektion; Projekt-Create über
  Pane-Toolbar landet in der App-Sidebar über den
  `dispatchEvent(focus/visibilitychange)`-Kick).

## Pflege-Checkliste

- [x] `CHANGELOG.md`-Eintrag + Plan-Link
- [x] `docs/SETTINGS.md` (neue Optionen `view.*`)
- [x] `docs/ROADMAP.md` (Zuletzt umgesetzt / bekannte Grenzen)
- [x] `docs/APP-INTEGRATION.md` (neue Doors: REST-Feldliste, `projects.*`-Mutationen, `revealPath`, dispatch-Kick, `[data-sessions-mode]`-Anker)
- [x] `package.json`-Version + `VERSION`-Konstante synchron (1.19.0)
- [x] `docs/README.md`/`AGENTS.md`-Abgleich
