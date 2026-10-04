# Projekt-Ordner-Gruppierung: Hermes' eigene Zuordnungslogik portieren (Bugfix)

- **Status**: Done
- **Erstellt**: 2026-10-04
- **Abgeschlossen**: 2026-10-04
- **Betrifft**: `plugin.js` (`$projectsList`, `resolveSessionProject`,
  `pathSegments`/`isPathUnder`, `normalizeRow`, `buildSections()`),
  `tests/render-test.mjs`, `docs/SETTINGS.md`, `CHANGELOG.md`,
  `package.json`
- **Version**: 1.16.1

## Anforderung

Wörtlich aus dem Auftrag:

> „Die Gruppierung nach Projekt-Orldner wird nicht richtig umgesetzt. Die
> Darstellung zeigt nur 'kein Projekt', obwohl ich Projekte habe, die ich
> in dem Sessions Tab von Hermes Desktop sehe. Bitte Fixxe Das und nutze
> die von Hermes Dekstop schon verfügbare logik und transferiere sie in
> unsere umsetzung."

## Kontext

Seit v1.14.0 bucketete `buildSections()`'s Projekt-Zweig Sessions schlicht
nach dem ROHEN `row.cwd`-String und verglich den gegen `project.primary_path`
(exakte Gleichheit oder Prefix). Das greift in der Praxis kaum:

- Viele Sessions tragen **gar keine `cwd` mehr**, nur noch den
  backend-seitig aufgelösten `git_repo_root` — unser `normalizeRow()` las
  dieses Feld nie ein.
- Hermes-Projekte haben oft **keinen `primary_path`**, nur eine
  `folders[]`-Liste (Mehrordner-Projekte); unser Cache übernahm bisher nur
  einen einzigen Pfad.
- Hermes gruppiert auch Sessions **ganz ohne projects.db-Eintrag**
  automatisch nach ihrem Git-Repo-Root (Auto-Projekt) — das kannten wir gar
  nicht.

Ergebnis: praktisch jede Session fiel in „Kein Projekt", obwohl Hermes
Desktops eigene Sessions-Sidebar sie sichtbar einem Projekt zuordnet.

Recherche im `hermes-agent`-Checkout lieferte die Original-Implementierung:
`app/chat/sidebar/projects/workspace-groups.ts` →
`liveSessionProjectId()`/`sessionBucketId()`, plus die Wire-Schemas in
`types/hermes.ts` (`SessionInfo.git_repo_root`, `ProjectInfo.folders`/
`ProjectFolder.path`).

## Scope

- `$projectsList`-Cache speichert jetzt die volle `folders[]`-Liste plus
  `archived`-Flag je Projekt (statt eines einzelnen `path`-Strings).
- `normalizeRow()` liest zusätzlich `git_repo_root` ein (`row.repoRoot`).
- Neue Funktion `resolveSessionProject(row)` — 1:1-Port von
  `liveSessionProjectId`: explizites Projekt per längstem Ordner-Präfix
  (CWD ODER Repo-Root, über alle Ordner), archivierte Projekte
  übersprungen, sonst Repo-Root selbst als Auto-Projekt-Identität.
- Hilfsfunktionen `pathSegments()`/`isPathUnder()` (segmentweiser
  Pfad-Vergleich, Trennzeichen-/Trailing-Slash-unabhängig).
- `buildSections()`'s Projekt-Zweig bucketet jetzt über
  `resolveSessionProject()` statt über den rohen `cwd`-String; Sortierung,
  Titel, Farbe, Icon und Anker-Pfad (`section.cwd` für DnD/„+") kommen aus
  demselben Resolve-Ergebnis.
- Neue Tests (Sektion 21): Session ohne CWD nur mit Repo-Root, Treffer über
  den zweiten (nicht-primären) Ordner eines Mehrordner-Projekts,
  archiviertes Projekt wird übersprungen.

## Nicht-Scope (bewusst ausgeklammert)

- **Backend-`owners`-Map** (`projectOwnerBySessionId` in Hermes — wenn der
  Backend-Baum eine Session bereits explizit einem Projekt zugeordnet hat,
  gewinnt das vor dem CWD-Walk). Unser Plugin hat keinen Zugriff auf diese
  interne Baum-Struktur über die Gateway-RPCs hinaus — der CWD/Repo-Root-
  Walk allein deckt die weit überwiegende Mehrheit der Fälle ab.
- **Kanban-Worktree-Erkennung** (`kanbanWorktreeDir` — task-Worktrees
  sollen in einen eigenen Kanban-Bucket falten) — nicht Teil der
  Session-Flow-Feature-Oberfläche; eine Kanban-Sektion existiert hier nicht.
- **„Verschwindet nie"-Abweichung von Hermes**: siehe Umsetzung — bewusst
  anders als das Original, weil ein Session-Flow-Nutzer eine Session nie
  einfach aus der Liste fallen sehen soll, selbst wenn sie sich über keinen
  der beiden Hermes-Wege platzieren lässt.

## Umsetzung

Siehe `CHANGELOG.md` → `[1.16.1]` für die Nutzer-Perspektive;
`resolveSessionProject()`-Doc-Kommentar in `plugin.js` für die technische
Begründung jedes Zweigs.

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM)
✓ EN/DE: alle 384 Keys vorhanden

$ npm test
… (85 Checks grün) …
✓ v1.16.1: Session ohne CWD (nur Repo-Root) landet NICHT in „Kein Projekt"
✓ v1.16.1: Auto-Projekt heißt wie der Repo-Root-Ordner
✓ v1.16.1: Mehrordner-Projekt greift über den zweiten (nicht primären) Ordner
✓ v1.16.1: Archiviertes Projekt wird übersprungen (Rückfall auf Ordnernamen)

$ npm run test:style
=== STYLE-TEST BESTANDEN (Chromium Computed-Styles) ===
```

Nicht live im laufenden Hermes-Desktop getestet (kein laufender App-Prozess
in dieser Sitzung) — die drei neuen Testfälle decken genau die drei
identifizierten Lücken ab (fehlende CWD, Mehrordner-Projekt, archiviertes
Projekt), aber ob die reale `projects.list`-Antwort exakt das erwartete
Wire-Schema (`folders[].path`, `git_repo_root` auf der Session) liefert,
bleibt eine Annahme aus dem `hermes-agent`-Quelltext — siehe Follow-ups.

## Follow-ups

- **Manuelle Live-Verifikation** (nächste Sitzung mit laufender App):
  Session Flow auf „Nach Projekt-Ordner" stellen und prüfen, dass die
  Projekte erscheinen, die auch in Hermes Desktops eigenem Sessions-Tab
  sichtbar sind — inklusive Name, Farbe und Icon, falls gesetzt.
- Falls die reale `projects.list`-Antwort von der hier angenommenen
  Wire-Form abweicht (z. B. andere Feldnamen), `refreshProjectsList()`
  entsprechend nachziehen — ein kurzer `console.warn` mit dem rohen
  `payload` beim ersten Live-Test deckt das schnell auf.
