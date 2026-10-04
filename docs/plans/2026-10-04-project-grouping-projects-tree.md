# Projekt-Gruppierung: zuordnung über projects.tree statt Pfad-Abgleich (Bugfix 2. Versuch)

- **Status**: Done
- **Erstellt**: 2026-10-04
- **Abgeschlossen**: 2026-10-04
- **Betrifft**: `plugin.js` (`refreshProjectsList`, `resolveSessionProject`,
  `scheduleSessionsRefresh`), `tests/render-test.mjs` (Blöcke 18/20/21),
  `docs/SETTINGS.md`, `CHANGELOG.md`, `package.json`
- **Version**: 1.16.2
- **Vorgänger**: `2026-10-04-project-grouping-real-matching.md` (1.16.1 —
  reichte live nicht aus, siehe Kontext)

## Anforderung

Wörtlich aus dem Auftrag:

> „Die Gruppierung wird immer noch nicht übernommen, so wie es auch schon
> in Sessions Tab von Hermes Desktop verfügbar ist. Meine Projekte werden
> dort nicht angezeigt. Es ist immer nur kein Projekt mit den Sessions
> darunter."

## Kontext

1.16.1 portierte den Desktop-Zuordnungs-Algorithmus
(`liveSessionProjectId`) client-seitig — aber auf Annahmen über die
Datenlage, die nie live verifiziert wurden. Die echte Diagnose (diese
Sitzung) mit drei harten Fakten:

1. **`session.list` liefert KEINE Pfade.** Die Funktion, die jede Zeile
   baut (`_session_row_summary` in `tui_gateway/methods_session.py`), gibt
   nur `id/title/preview/started_at/message_count/source` (+ optional
   `resolved_id`/`live_message_count`) zurück. `cwd` und `git_repo_root`
   existieren in der DB-Spalten (`sessions`-Tabelle geprüft: 33/89 Sessions
   mit `cwd`, 16/89 mit `git_repo_root` — die Daten sind da), kommen aber
   auf dem Wire nie beim Plugin an. Jede pfadbasierte Zuordnung im Plugin
   lief damit strukturell ins Leere — unabhängig vom Algorithmus.
2. **Die Desktop-Sidebar nutzt einen anderen Weg**: Sie fragt NICHT
   `session.list` + Client-Abgleich, sondern `projects.tree`
   (`tui_gateway/methods_projects.py` → `project_tree.build_tree()`).
   Dessen `ProjectTreeNode` trägt `sessionIds: string[]` — die vom Server
   berechnete, vollständige Zuordnung (explizite Projekte + Auto-Projekte
   per Git-Repo-Root + Home-Bucket `__no_project__` mit `isNoProject`).
   Bestätigt gegen `tui_gateway/contracts/projects_pets.py` und die
   Nutzer-Daten (`hermes project list`: agantila-workspace,
   colabonate-vault, session-flow aktiv).
3. **Lesart des Bugs**: zwei Versionen lang wurde auf Feldern gruppiert,
   die das RPC-Interface gar nicht hergibt. Der Fehler lag nicht im
   Algorithmus, sondern in der Schnittstellen-Annahme.

## Scope

- `refreshProjectsList()` fragt jetzt `projects.tree` (mit
  `session_limit: 2000`) statt `projects.list`; `$projectsList` speichert
  `{id, label, color, icon, isAuto, isNoProject, path, sessionIds:Set}`.
- `resolveSessionProject(row)` = reine ID-Abfrage in `sessionIds` (Home-
  Knoten übersprungen). Namen/Farbe/Icon/Pfad kommen aus demselben Knoten.
- Client-Pfad-Helfer (`pathSegments`/`isPathUnder`/`basenameOf`) und das
  `repoRoot`-Feld in `normalizeRow()` entfernt — toter Code.
- `scheduleSessionsRefresh()` zieht den Projekt-Baum nach (Mindestabstand
  15 s, Inflight-Guard in `refreshProjectsList`), damit neue Sessions nicht
  bis zum 60-s-Takt in „Kein Projekt" parken.
- Tests: Blöcke 18/20/21 auf das `sessionIds`-Schema umgestellt; Block 21
  neu als 4 Szenarien (Auto-Projekt-Treffer über ID, explizites Projekt,
  `isNoProject` → Kein Projekt, unbekannte ID → Kein Projekt).
- `docs/SETTINGS.md`: Abschnitt auf die neue Datenquelle umgeschrieben.

## Nicht-Scope (bewusst ausgeklammert)

- **Kanban-Lanes / Repo-Zweig-Ebene** (`repos[]`/`groups[]` im Baum) —
  Session Flow gruppiert auf Projektebene; eine Lane-Untergruppierung wäre
  ein eigenes Feature.
- **`branch`/`model`/`toolCount`/`pinned` in `session.list`** — fehlen auf
  dem Wire aus demselben Grund wie `cwd` (Nebenbefund der Diagnose). Die
  Zeilen-Anzeigen zeigen dafür derzeit Defaults. Fix bräuchte entweder
  Gateway-Änderung oder ein zusätzliches RPC — separater Auftrag.
- **`projects.project_sessions`-Drill-in** (Pagination pro Projekt) —
  `sessionIds` deckt die Gruppierung ab; das Drill-in-RPC wäre nur für
  per-Projekt-Lazy-Loading interessant.

## Umsetzung

Kern: Zuordnung nicht mehr nachbauen, sondern die autoritative Quelle
abfragen, die die Desktop-Sidebar selbst benutzt. Siehe
`refreshProjectsList()`/`resolveSessionProject()`-Kommentare in
`plugin.js` und `CHANGELOG.md` → `[1.16.2]`.

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM)
✓ EN/DE: alle 384 Keys vorhanden

$ npm test
… (85 Checks grün) …
✓ v1.16.2: Session ohne CWD wird trotzdem über projects.tree gefunden (NICHT „Kein Projekt")
✓ v1.16.2: Explizites Projekt wird über seine Session-ID-Liste gefunden
✓ v1.16.2: isNoProject-Knoten landet in „Kein Projekt"
✓ v1.16.2: Unbekannte Session-ID (in keinem Knoten) landet in „Kein Projekt"

$ npm run test:style
=== STYLE-TEST BESTANDEN (Chromium Computed-Styles) ===
```

Zusätzlich gegen die echten Nutzer-Daten validiert (nicht nur Fixtures):
`hermes project list` zeigt die 3 Projekte; `sqlite3 state.db` bestätigt
die `cwd`-Spalte — die Zuordnung passiert jetzt serverseitig im Baum, wo
diese Daten verfügbar sind, statt im Renderer, wo sie fehlen.

## Follow-ups

- **Live-Verifikation**: Reload der Desktop-Plugins, „Nach Projekt-Ordner"
  aktivieren — die 3 realen Projekte (session-flow, agantila-workspace,
  colabonate-vault) müssten jetzt mit ihren Sessions erscheinen.
- Falls einzelne Sessions fehlen: `session_limit: 2000` prüfen (bei >2000
  Sessions müsste der Baum paginiert werden).
- Lektion in `hermes-desktop-plugins`-Skill ergänzt: nie TS-Typen als
  Beleg für Wire-Felder nehmen — immer die RPC-Handler-Quelle lesen.
