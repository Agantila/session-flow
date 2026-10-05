# „+"-Sessions landen im Projekt; DnD-Verschiebungen aktualisieren sofort

- **Status**: Superseded by `2026-10-05-new-session-project-anchor-v2.md`
  (dieser Plan rief `session.workspace.move` auf — diese Gateway-RPC
  existiert nicht; der Fix persistierte deshalb nie und wurde in v1.19.1
  durch den Aufruf von `session.cwd.set` ersetzt).
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: 2026-10-05
- **Betrifft**: `plugin.js` (`startNewSessionInCwd`, `moveSessionRow`,
  `resolveSessionProject`, neuer `invalidateProjectTree()` +
  `$sessionProjectSeed`-Live-Overlay, Lifecycle-Pruning)
- **Version**: 1.17.3 (Patch auf 1.17.x; Versionskonstante bewusst NICHT
  gebumpt — ein Parallel-Agent hält die Working Tree mit v1.18.0-WIP,
  siehe Parallel-Koordination unten)
- **Commit**: 9464ef8 (synthetisch aus HEAD + nur diesem Fix)

## Anforderung

Wörtlich aus dem Auftrag:

> „Wenn ich eine Neue Session erstelle über das '+' Icon in der Kopfzeile
> der Sessions wird diese neue Session nicht in dem Projekt unter der
> Kopfzeile angelegt sondern ohne Projekt zuweisung. Veränderungen der
> Session zuweisung via Drag and Drop werden nicht gleich aktualisiert in
> der Sessions Sidebar."

## Kontext — zwei Ursachen, live an der echten DB diagnostiziert

1. **Leere cwd in der Create-Row**: `sqlite3 state.db` zeigte die per „+"
   erzeugte Session (`20261005_014658_8abb9b`) mit `cwd=''` trotz
   `cwd_explicit`-Create-Param — `session.create` persistiert die Row lazy,
   und der Create-cwd landet dort nicht verlässlich. Ohne cwd kann
   `projects.tree` (`_project_for_session`: Kandidaten aus cwd/repo_root)
   die Session keinem Projekt zuordnen → „Kein Projekt".
2. **0-Turn-Sessions fehlen im Baum komplett**: `_project_tree_inputs`
   filtert `min_message_count=1` — eine frische Session erscheint erst nach
   dem ersten persistierten Turn im Baum. Hermes Desktops eigene Sidebar
   löst das mit einem client-seitigen **Live-Overlay**
   (`liveSessionProjectId`): die laufende Session wird per bekanntem cwd
   vorab platziert, bis der Baum übernimmt.
3. **60-s-Takt des Baum-Caches**: Drag&Drop (`session.workspace.move`)
   refreshte nur `session.list`; die Zuordnungs-Grundlage `$projectsList`
   lief ihrem eigenen Takt hinterher (15-s-Gate in
   `scheduleSessionsRefresh`), die Zeile blieb bis zur nächsten Minute in
   der alten Sektion.

## Umsetzung

- **Create-Anker**: nach `session.create` explizit
  `session.workspace.move` auf dasselbe Ziel (derselbe RPC wie der
  Drag&Drop-Pfad; bei schon korrektem Pfad ein reines No-op-Update) —
  schreibt cwd/Git-Root persistent in die Row. Best-effort mit try/catch.
- **Live-Overlay-Seed** (`$sessionProjectSeed`): merkt sich
  (storedId → Zielprojekt) beim Erstellen und beim Drag&Drop auf einen
  Projekt-Header; `resolveSessionProject()` nutzt den Seed, wenn der Baum
  die ID (noch) nicht führt. TTL 15 min, Pruning beim Laden. Genau das
  Overlay-Prinzip der Desktop-Sidebar, auf unsere Datenlage übertragen.
- **Sofort-Aktualisierung**: neuer `invalidateProjectTree()` (setzt das
  Erfolgs-Zeitstempel zurück + sofortiger `refreshProjectsList()`-Lauf)
  nach Create und nach jedem Drag&Drop-Move; Session-Refresh verkürzt auf
  400–600 ms.

## Parallel-Sessions-Koordination (wichtig für die Weiterentwicklung)

Während dieser Arbeit lief eine zweite Hermes-Session
(`20261005_015200_80c49d`, MiniMax) an derselben Working Tree: ihr
v1.18.0-WIP („Stats-2-Zeile in Gruppenköpfen", `groupStat2*`/
`sf-group-threeline`) ist uncommittet stehen geblieben (Iterations-Cap,
1 eigener Test rot). Nach dem `parallel-session-coordination`-Skill wurde
dieser Commit **synthetisch aus HEAD + nur diesem Fix** gebaut
(`git hash-object` + `update-index --cacheinfo`), die Working Tree behält
beide Änderungssätze. Isoliert verifiziert (`git archive` + check/test in
/tmp): 94 Checks grün, 0 Fehler, keine Sibling-Symbole im Commit.
Der v1.18.0-WIP muss von der anderen Session (oder einem Folgelauf)
fertiggestellt und separat committet werden.

## Verifikation

```
$ npm run check           (isoliert auf HEAD+Fix)
✓ Syntax ok (ESM) · EN/DE: alle 385 Keys vorhanden

$ npm test                (isoliert)
94 Checks grün, 0 Fehler

Working Tree (beide Änderungssätze): check grün;
npm test: 105 ✓, 1 ✗ — der rote ist der Sibling-WIP-Test
(„Stats-2 entfällt bei Sektion ohne Items"), nicht dieser Fix.
```

## Follow-ups

- **Live-Verifikation**: „+" in einer Projekt-Sektion klicken → Session
  erscheint sofort in derselben Sektion (Move + Seed); Drag auf anderen
  Projekt-Header → Wechsel innerhalb ~0,5 s.
- Ersten Turn in einer frischen Session senden und prüfen, dass der Baum
  die Session übernimmt (Seed wird dann irrelevant).
- Sibling-WIP v1.18.0 abschließen (siehe Koordination oben).
