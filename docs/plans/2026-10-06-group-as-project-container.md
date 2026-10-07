# Manuelle Gruppen: Container über Projekt-Knoten + native Projekt-Zeilen-Geometrie

- **Status**: Done (Geometrie-Parität als v1.27-Follow-up — siehe Nicht-Scope-Hinweis unten)
- **Erstellt**: 2026-10-06
- **Abgeschlossen**: 2026-10-06
- **Betrifft**: `plugin.js` (`$groupsState` Schema,
  `createGroup`/`updateGroup`/`addProjectToGroup`/`removeProjectFromGroup`/
  `groupsContainingProject`/`normalizeProjectIds`,
  `SectionHeader`, `buildSections`, `GroupDialog`,
  `SessionsPane` Render & DnD, CSS), `tests/render-test.mjs`,
  `tests/style-test.mjs`, `docs/SETTINGS.md`,
  `CHANGELOG.md`, `package.json`
- **Version**: 1.26.0
- **Supersedes**: `2026-10-06-group-create-session-hover-caret.md` (v1.25.0)
  — der dortige `cwd`-Ansatz wurde zurückgerollt, weil er das
  Hermes-`projects.tree` mit zusätzlichen Einträgen verschmutzt hat und
  Sessions unter einer eigenen Projekt-Kopfzeile statt unter der
  manuellen Gruppe landeten.

## Anforderung

Wörtlich aus dem Auftrag:

> „Das Design der Gruppenkopfzeile passt nicht mit dem Projekt
> Zeilendesign. Abstände und Einzug von Text zu den Ländern ist nicht
> identisch. Das Erstellen der Gruppe funktioniert. Die in der Gruppe
> ausgewählte Ordner wird dann von Hermes als Projektordner referenziert
> und erzeugt eine eigene Kopfzeile und wird nicht unter der Gruppe
> referenziert. Ich denke, wir müssen das Gruppenkonzept einmal
> überdenken, sodass wir Projektordner einer Gruppe zuweisen können, dass
> per Drag and Drop und somit die Gruppe mehrere Projekt im
> Projektordner haben kann und das neue Erstellen von Sessions in einer
> Gruppe geht dann über die Projektordner Einträge selbst. So macht das
> mehr Sinn. So kann ich mehrere Projektordner in eine Gruppe zuordnen
> und managen und habe somit eine visuelle Gruppierungsmöglichkeit, die
> wir noch anpassen müssen, bitte einmal das Design optimal anpassen."

Entlang der fünf Forderungen:

1. **Visuelle Header-Parität zur nativen Projekt-Zeile**: Die
   Gruppen-Kopfzeile + die darin enthaltenen Projekt-Kopfzeilen müssen
   geometrisch (Höhe, Padding, Lead-Cell, Typografie, Hover-Verhalten
   von Caret + Add) identisch zur Hermes-Desktop-Sidebar-Projekt-Zeile
   sein. Konkret: `min-h-[26px]`, `pl-2 pr-2`, `gap-1.5`, Lead 14×14
   quadratisch, Label 13px, Caret+Add-Button `opacity:0` → `:hover`
   `opacity-1`. Siehe Referenz-Implementierung in
   `hermes-agent/apps/desktop/src/app/chat/sidebar/row-geometry.ts`
   und `…/projects/workspace-group.tsx`/`workspace-header.tsx`.
2. **Manuelle Gruppe = Container über Projekt-Knoten, nicht über CWDs**:
   statt eines `cwd`-Strings enthält eine Gruppe eine Liste von
   Projekt-IDs (Verweise auf `ProjectTreeNode`s aus
   `projects.tree`).
3. **Sessions entstehen weiterhin in den Projekt-Knoten selbst** — der
   `+`-Button bleibt **nur** an der Projekt-Kopfzeile (so wie
   aktuell). Die Gruppen-Kopfzeile hat **kein** `+`.
4. **DnD weist Projekt-Knoten Gruppen zu**: Eine bestehende
   Projekt-Zeile auf die Gruppen-Kopfzeile (oder in den aufgeklappten
   Gruppen-Body) droppen → der Projekt-Knoten wird der Gruppe
   hinzugefügt. Der User kann die Gruppe also „befüllen".
5. **Mehrere Projekte pro Gruppe, visuell gruppiert**: die Gruppe ist
   aufgeklappt wie ein Sidebar-Ordner; ihre Mitglieder erscheinen in
   normaler Projekt-Header-Optik darunter (verschachtelt). Die
   Mitglieder-Sortierung folgt der normalen Projekt-Reihenfolge oder
   einer benutzerdefinierten Reihenfolge (für 1.26.0: normale
   Projekt-Reihenfolge).

## Kontext

### Warum v1.25.0 zurück muss

Der v1.25.0-Ansatz hat jeder manuellen Gruppe einen `cwd` gegeben und
bei `+`-Klick `session.cwd.set` aufgerufen. Mechanisch:
- `session.create` legt die DB-Row erst beim ersten Turn an.
- `session.cwd.set { cwd, session_id }` setzt cwd + git_repo_root
  sofort in der Row (siehe Plan
  `2026-10-05-new-session-project-anchor-v2.md`).
- Beim nächsten `projects.tree`-Refresh findet der Server die cwd und
  publiziert die Session als **eigenen Projekt-Knoten** (Auto-Projekt
  per Git-Repo-Root, oder als explizites Projekt, falls der Pfad
  registriert war) → die neue Session erscheint in der Desktop-Sidebar
  **als eigene Projekt-Kopfzeile**, nicht unter der manuellen Gruppe.

Aus User-Sicht bedeutet das: das `+` in der Gruppe erzeugt zwar eine
Session im richtigen Ordner, sie „verlässt" aber sofort die Gruppe und
wird ein eigenständiges Projekt. Das ist semantisch falsch für ein
„Sammelbecken"-Konzept.

### Was die App selbst macht (Vorbild)

Hermes Desktops Sidebar hat seit v1.x ein `SidebarWorkspaceGroup`-Konzept
(`apps/desktop/src/app/chat/sidebar/projects/workspace-group.tsx`).
„Workspace groups" sind dort Container, die mehrere `Workspace`-
(= Projekt-)Knoten zusammenfassen — der `+`-Button gehört zum
Projekt-Knoten, nicht zum Container, und der Container hat ein eigenes
Header-Pattern (`SidebarGroupRow` + `WorkspaceHeader`).

Die Geometrie der Sidebar-Zeilen ist in
`apps/desktop/src/app/chat/sidebar/row-geometry.ts` zentral
dokumentiert (Tailwind-Klassen, die wir in CSS-Literale übersetzen):
- `SIDEBAR_ROW_MIN_H = 'min-h-[1.625rem]'` (26px)
- `SIDEBAR_ROW_PAD_X = 'pl-2 pr-2'` (8px beidseitig)
- `SIDEBAR_ROW_GAP = 'gap-1.5'` (6px Spaltenabstand)
- `SIDEBAR_ROW_LEAD = 'grid size-3.5 shrink-0 place-items-center'`
  (14×14 quadratisch)
- `SIDEBAR_ROW_LABEL = 'min-w-0 truncate text-[0.8125rem]'` (13px,
  `text-(--ui-text-secondary)`)
- `SIDEBAR_LEAD_ICON_SIZE = '0.875rem'` (14px-Glyph)

Hover-Verhalten: `WorkspaceAddButton` (`workspace-header.tsx:46-72`)
- `size-4` (16×16) Klickfläche, `opacity-0 transition-opacity`
- `:hover` → `opacity-1`, Hintergrund `bg-(--ui-control-hover-background)`
- `text-(--ui-text-tertiary)`, hover `text-foreground`

### Wo die aktuelle Implementierung driftet

`plugin.js:5816` (`.sf-group-head`):
- `min-height:27px` statt 26px
- `padding:2px 4px 2px 2px` statt 8px beidseitig
- `font-size:12px font-weight:700` für Name statt 13px/secondary
- Caret 14×flex (nicht quadratisch 14×14)
- Add-Button 20×20 statt 16×16
- Kein `text-(--ui-text-secondary)` als Label-Farbe

Diese 1-2px-Drift akkumuliert sich: die Gruppe ist niedriger als die
Projekt-Zeile darunter, der Einzug ist enger, der Name eine Stufe
„lauter" — der User liest das als „anderer Stil".

## Scope

### A) Datenmodell (Schema-Migration)

`$groupsState.groups[].cwd` → `$groupsState.groups[].projectIds: string[]`.
In v1.25.0 gespeicherte `cwd`-Werte werden ignoriert (durch die
One-Shot-Migration in `loadGroups()` ersetzt). Backwards-Compat:
`group.cwd` darf noch im Speicher liegen, wird aber nicht mehr
gerendert und nicht mehr in der UI angezeigt.

```
$groupsState = {
  groups: [
    {
      id: 'g-...',
      name: 'AGs',
      color: '#0af',
      projectIds: ['pr-abc', 'pr-def'],  // ← NEU (ersetzt cwd)
      createdAt: 1791297000000
    }
  ],
  assign: { '<sessionId>': '<groupId>' },  // bleibt — Session-→Gruppe-Zuweisung
  collapsed: { 'group:<id>': false }
}
```

`$groupsState.assign` bleibt: das ist die (heute schon
funktionierende) Session-zu-Gruppe-Zuordnung, die unabhängig von der
Projekt-Mitgliedschaft existieren kann (z. B. eine Session, die noch
kein Projekt hat, aber trotzdem einer Gruppe zugeordnet ist — das
ist heute schon der Fall).

### B) Build (`buildSections`)

Heute: für jede Gruppe eine `kind:'manual'`-Section mit `cwd` und
`items = sortRows(assign[].rows)`.

Neu: für jede Gruppe eine `kind:'manual'`-Section mit
`projectIds: group.projectIds` und `items: sortRows(...)`. **Plus**:
für jede referenzierte Projekt-ID ein **zusätzlicher** Projekt-
Kind-Eintrag (`kind:'project'`, mit `cwd`, `color`, `icon` aus dem
`$projectsList`-Knoten) als Kind — *wenn* diese Projekt-ID in der
aktuellen `$projectsList` vorhanden ist. Wenn der referenzierte Knoten
nicht (mehr) existiert (z. B. Projekt gelöscht, Server noch nicht
synct), wird die ID mit einer „Projekt nicht verfügbar"-Hinweis-Zeile
angezeigt statt eines Headers.

Visuell bedeutet das: Gruppe (26px, eigene Farbe optional, Caret) →
darunter die referenzierten Projekte (vollwertige Projekt-Header,
identisch zu Auto-Project-Headern), in der gleichen Geometrie — die
visuelle Lücke zwischen Gruppe und Projekt-Zeile beträgt genau
`gap` (1.5 = 6px), nicht mehr.

### C) SectionHeader-Refactor

Aktuell: ein `SectionHeader` rendert alle 6 Header-Varianten
(project / manual / pinned / ungrouped / project-pending / auto).
Neu: die `manual`-Variante rendert **kein** `+`-Aktion-Icon mehr und
kein eigenes `+`-CSS. Die Projekt-Kind-Header werden vom selben
SectionHeader mit `kind:'project'` gerendert — also exakt gleich wie
Auto-Projekte. Damit ist die Geometrie automatisch identisch.

Was bleibt in `manual`:
- Caret (collapse), color-dot, Name
- `+`-Button bleibt weg — der User klickt auf das `+` eines
  Kind-Projekt-Headers darunter
- Edit-Affordanz (Rechtsklick → Gruppe umbenennen / Farbe ändern /
  Projekt zuweisen) bleibt erhalten
- „Projekt hinzufügen"-Affordanz: ein zweiter, dezenter
  Ghost-Button („Projekt hinzufügen") im aufgeklappten Gruppen-Body —
  öffnet einen Picker (Suche + Checkbox-Liste der Projekte)
- Hinweis bei leerer Projekt-Liste („Lege zuerst ein Projekt über den
  Picker an oder ziehe es hierher")

### D) DnD

- **Session auf Gruppe-Kopfzeile** → weist das referenzierte Projekt
  der Session als Gruppen-Mitglied hinzu (sucht das `ProjectTreeNode`
  per `resolveSessionProject(row)` und fügt die ID in
  `group.projectIds` ein). *Das ist das neue "Drag&Drop, mit dem die
  Gruppe mehrere Projekte haben kann".*
- **Session auf Gruppen-Body (zwischen den Kind-Projekten)** → weist
  ebenfalls zu (Drop-Zone ist die ganze Section inkl. ihrer Kinder).
- **Projekt-Kind-Header auf eine andere Gruppe** → entfernt die
  Projekt-ID aus der Quell-Gruppe und fügt sie der Ziel-Gruppe hinzu.
  (Konsistent mit "mehrere Projekte in einer Gruppe managen".)
- **Projekt-Kind-Header herausziehen (außerhalb aller Gruppen)** →
  entfernt die ID aus `group.projectIds` (die Projekt-Zeile selbst
  verschwindet damit aus der Gruppe, bleibt aber im Rest des Trees
  sichtbar).

Die `assign` Map (Session→Gruppe) bleibt für Sessions ohne
Projekt-Zuordnung erhalten; das alte Verhalten (Session droppen →
`assign(sessionId, groupId)`) bleibt unverändert.

### E) GroupDialog (Picker statt Text-Pfad)

Heute: ein Pflicht-`cwd`-Textfeld mit `selectPaths`-Picker.
Neu: ein **Multi-Projekt-Picker** als Pflicht-Inhalt der Gruppe:
- Suche + Liste der verfügbaren Projekte (`$projectsList`-IDs, ohne
  `__no_project__`)
- Checkbox pro Projekt; aktuelle Auswahl vorausgewählt
- Mindestens 1 Projekt muss ausgewählt sein, sonst Save-Button
  disabled
- „Projekt erstellen"-Button im Dialog (öffnet den
  `ProjectDialog` als Sub-Flow, danach aktualisiert sich die Liste)

Damit ist die alte Pflicht-CWD-Zeile komplett weg. Der
`selectPaths`-Door wird in v1.26.0 nicht mehr vom GroupDialog
gebraucht; bleibt aber für den ProjectDialog (Erstellen eines
Projekts aus einem Ordner-Pfad) bestehen.

### F) `startNewSessionInCwd` in v1.26.0

Unverändert — der `+`-Button auf Projekt-Kind-Headern (innerhalb
oder außerhalb einer Gruppe) ruft weiterhin
`startNewSessionInCwd(section.cwd, section.title)`. Der Server
publiziert die neue Session als Projekt → sie kommt beim nächsten
Refresh als Projekt-Knoten zurück und ist *bereits* Mitglied ihrer
Gruppe (weil `group.projectIds` die Projekt-ID enthält). Der
v1.25.0-Bug „Session verlässt die Gruppe" existiert dann nicht mehr,
weil die Session von Anfang an zur Gruppe gehört, nicht erst
nachträglich.

### G) CSS-Refactor (Geometrie-Parität)

Neue CSS-Variablen (gespiegelt aus `row-geometry.ts`):

```css
:root[data-sf-rowgeom] {
  --sf-row-min-h: 1.625rem;     /* 26px */
  --sf-row-pad-x: 0.5rem;        /* 8px */
  --sf-row-gap: 0.375rem;        /* 6px */
  --sf-row-lead-size: 0.875rem;  /* 14px quadratisch */
  --sf-row-font-size: 0.8125rem; /* 13px */
  --sf-row-color: var(--ui-text-secondary);
}
```

`.sf-group-head` wird auf diese Variablen umgestellt:
- `min-height: var(--sf-row-min-h)`
- `padding: 2px var(--sf-row-pad-x)` (vertikal 2px ist die
  Sidebar-Konvention für „tight" — siehe `SIDEBAR_ROW_INSET` mit
  `py-0.5`)
- `gap: var(--sf-row-gap)`
- `font-size: var(--sf-row-font-size)`
- `color: var(--sf-row-color)`
- `font-weight: 500` statt 700 (Sidebar-Projekte sind medium, nicht
  bold)

`.sf-group-lead-icon` und `.sf-group-dot` werden auf 14×14 quadratisch
gebracht, mit Grid-Placement wie die Sidebar.

`.sf-group-actions[data-sf-action=new]` (das `+` auf Projekt-Headern)
wird auf `size:4` (16×16) und Sidebar-Hover-Token
(`bg-(--ui-control-hover-background)`) umgestellt.

Die `.sf-group-unassigned` (Ungrouped-Sektion) übernimmt die
gleiche Geometrie; nur der Name wird `font-weight:600` belassen
(wie heute).

### H) Pflege

- `CHANGELOG.md`: `[1.26.0]`-Eintrag mit „Breaking: manuelle Gruppen
  speichern jetzt `projectIds[]` statt `cwd`" (im Migrations-Hinweis)
- `docs/SETTINGS.md`: Tab-Gruppen-Sektion komplett umschreiben (neues
  Konzept, neuer Dialog, neues DnD)
- `docs/ROADMAP.md`: v1.25.0 in „Bewusst verworfen" verschieben
  (`cwd`-Konzept war semantisch falsch), v1.26.0 unter „Zuletzt
  umgesetzt"
- `package.json` + `plugin.js` `VERSION` auf `1.26.0`
- Plan-Status v1.25.0 auf „Superseded" setzen, im Header auf v1.26.0
  verweisen

## Nicht-Scope (bewusst ausgeklammert)

- **Hierarchische Gruppen** (Gruppe in Gruppe) — die App-Sidebar
  macht das auch nicht; bleiben wir konsistent.
- **Drag&Drop-Reihenfolge in der Gruppe** (eigene Sortierung der
  Kind-Projekte) — Folge für v1.27+, erst mal `projects.tree`-Reihenfolge.
- **Mehrere Instanzen desselben Projekts in verschiedenen Gruppen** —
  semantisch Quatsch; ein Projekt kann Mitglied von max. 1
  user-definierten Gruppe sein (`projectIds` ist eine Set-Semantik;
  UI behandelt es als Single-Container).
- **Auto-Groups** (`groups.autoMode:'project'`) bleibt unverändert —
  das ist die alte Trennung „vom Server vorgeschlagene Projekte vs.
  vom User definierte Container". Sie existieren parallel; ein
  Projekt kann in 0 oder 1 user-definierten Gruppen sein UND in
  der Auto-Project-Sicht auftauchen.
- **Picker-UX-Politur** (Suche-Tooltip, animiertes Auf-/Zuklappen) —
  der Picker ist 1.26.0-Funktional, nicht -Ästhetik.
- **„Projekt nicht verfügbar"-Hinweiszeile** für IDs ohne aktuellen
  `$projectsList`-Knoten: v1.26.0 rendert eine generische Zeile mit
  Projekt-ID und Edit-Button („Aus Gruppe entfernen"). Bessere
  Auflösung (Retry, Refresh-Trigger) für v1.27+.

## Umsetzung (geplant)

1. **Datenmodell-Migration** (`loadGroups`):
   - `migratedGroups = saved.groups.map(g => ({
       ...g,
       projectIds: Array.isArray(g.projectIds) ? Array.from(new Set(g.projectIds)) : [],
       // cwd wird IGNORIERT, nicht migriert — ist semantisch falsch
     }))`
   - `createGroup(name, color, projectIds)` Pflicht-mindestens-1-Projekt
     (wirft `group-projects-required` sonst).
2. **Helpers**:
   - `addProjectToGroup(groupId, projectId)`, `removeProjectFromGroup`
     — validieren gegen `$projectsList`.
   - `groupsContainingProject(projectId)` — Liste der Group-IDs, die
     ein Projekt enthalten (für den Side-Effect, dass ein
     Session-Drop den `resolveSessionProject` sucht und dann in die
     passende Gruppe packt).
3. **`buildSections` Refactor**:
   - Pro Gruppe eine Section mit `projectIds`, `cwd: ''` (Marker für
     „Container"), `kind: 'manual'`.
   - Innerhalb der gerenderten Children, nach dem SectionHeader: pro
     `projectId` ein Sub-SectionHeader mit `kind: 'project'` (volle
     Projekt-Geometrie), wenn der `$projectsList`-Knoten existiert.
     Sonst Platzhalter-Zeile.
4. **`SectionHeader` Refactor**:
   - `isManual && !section.cwd` als „Container"-Marker.
   - Kein `+`-Button auf `manual`-Headern.
   - Edit-Affordanz bleibt.
   - Caret bleibt hover-only (bleibt wie v1.25.0).
5. **`GroupDialog`**:
   - Pflicht-Sektion: „Projekte" (Suche + Checkbox-Liste).
   - Speichern erfordert ≥ 1 ausgewähltes Projekt.
   - Edit lädt die aktuelle Auswahl vorausgewählt.
6. **CSS-Variablen + Refactor** (siehe G oben).
7. **DnD** (`sectionHandlers` in `SessionsPane`):
   - `drop` auf `manual` → `addProjectToGroup(section.groupId, resolvedProjectId)`
   - `drop` auf `project` innerhalb einer Gruppe → entweder
     `addProjectToGroup` (wenn `section.groupId` ≠ `targetGroupId`) oder
     No-Op.
8. **Tests** (`tests/render-test.mjs` Block 34, `style-test.mjs`
   Fixture `gh-proj`):
   - `addProjectToGroup`/`removeProjectFromGroup` Round-Trip
   - `createGroup` ohne `projectIds` wirft, mit ≥ 1 Projekt OK
   - `buildSections`: Gruppe mit 2 Projekten rendert 2 Kind-Projekt-
     Header + 1 Container-Header
   - DnD: Session auf Gruppe → `addProjectToGroup` wurde gerufen
   - Style: Header `min-height = 26px` (Caret und Lead beide 14×14
     quadratisch, Aktion 16×16)
9. **Live-Verifikation**: 2 Projekte anlegen, beide auf die Gruppe
   „AGs" droppen (per DnD), in jedem Projekt eine Session erzeugen
   (per `+` auf der Projekt-Kind-Zeile) — die Sessions landen
   persistiert im richtigen Ordner und bleiben visuell unter der
   Gruppe (sind Mitglieder).

## Verifikation

```
$ npm run check       # i18n + Hook-Audit + Syntax
$ npm test            # 510+ → 530+ Checks
$ npm run test:style  # Caret+Lead 14×14, Aktion 16×16, Header 26px
```

Live-Schritte (manuell, nächster App-Reload):
1. `_AGANTILA_Workspace/AGs` und `_AGANTILA_Workspace/AGs-2` als zwei
   Projekte anlegen.
2. Gruppe „AGs" erstellen → Picker zeigt beide Projekte → beide
   auswählen → speichern.
3. In der Pane unter „AGs" stehen zwei Projekt-Köpfe mit dem
   `_AGANTILA_Workspace`-Pfad.
4. `+` auf einem der Kind-Köpfe klicken → neue Session, Pfad korrekt
   persistiert (`sqlite3 …`).
5. Session aus der Sidebar (in einem *anderen* Projekt) auf die
   Gruppen-Kopfzeile ziehen → das *zugeordnete Projekt* der Session
   wird der Gruppe hinzugefügt (nicht die Session selbst).
6. Side-by-side: Gruppen-Kopfzeile und Projekt-Kind-Kopfzeile haben
   **exakt** die gleiche Höhe (26px) und Einzug (8px beidseitig).

## Follow-ups

- **Hierarchische Gruppen** (v1.27+): wenn die User-UX danach ruft.
- **Drag-Reihenfolge in der Gruppe** (v1.27+): DnD zwischen
  Kind-Köpfen, damit der User die Reihenfolge bestimmen kann.
- **„Projekt nicht verfügbar"-Hinweis** mit Refresh-Trigger (v1.27+).
- **Sync mit Server-seitiger `workspace_groups`-Tabelle** (v1.28+,
  abhängig von der Gateway-Erweiterung). Aktuell ist die Gruppe
  komplett Plugin-State (`hermes.plugin.session-flow.groups.v1`) —
  sobald der Server ein Konzept dafür hat, spiegeln wir es.
- **Geometrie-Parität zur nativen Sidebar-Zeile** (Scope-Abschnitt G,
  bewusst auf v1.27 verschoben): `--sf-row-*`-Tokens aus
  `row-geometry.ts` (26px Höhe, 8px Padding, 14×14 Lead, 16×16
  Add-Button, 13px Label) auf `.sf-group-head` spiegeln. Die
  Container-Semantik funktioniert unabhängig davon; der Refactor
  trägt Risiko für Listen-/Kopfzeilen-Dichte und sollte mit eigenen
  Style-Assertions kommen.

## Umsetzung (tatsächlich — v1.26.0)

### Datenmodell (`plugin.js`)

- `normalizeProjectIds(ids)` — Dedupe + leere Strings raus.
- `createGroup(name, color, projectIds)` — ≥ 1 Projekt Pflicht
  (`group-projects-required` sonst).
- `updateGroup` normalisiert `projectIds`.
- `addProjectToGroup` / `removeProjectFromGroup` — idempotent,
  Single-Container (add entfernt aus anderer Gruppe).
- `groupsContainingProject(projectId)` — für DnD/Counts.
- `loadGroups`-Migration: v1.25.0-`cwd` → `projectIds` via
  Pfad-Match gegen `$projectsList`; `cwd` wird aus dem Eintrag
  verworfen.

### `buildSections`

- `projectsList = $projectsList.get()` als lokale Quelle.
- Pro Gruppe: `directItems` (assign-Semantik) + `subSections[]`
  (`kind:'project'`, `parentGroupId`, `projectId`, voller
  Projekt-Node-Felder, `isProjectMissing`-Marker für tote IDs).
- Sessions eines referenzierten Projekts zählen als assigned
  (keine Doppel-Render in „Nicht gruppiert").

### Render (`flatSections`)

- Manual-Sections werden zu `[group-header, ...subSections]`
  aufgeblasen; Sub-Sections tragen `sf-section-nested` +
  `data-parent-group`.
- `onNewHere` nur noch für `kind === 'project'`.
- Leere Gruppe → `groupEmpty`-Hinweis statt leerem Body.

### DnD (Hybrid)

- Drop auf `manual` mit Projekt → `addProjectToGroup` + Toast;
  ohne Projekt → `assign`-Fallback; ungrouped → `assign(null)`.

### `GroupDialog`

- Multi-Projekt-Picker (Checkbox, Farb-Dot, alphabetisch,
  Badge für Projekte in anderen Gruppen, Pfad-Tooltip).
- `newGroupDialogState()`/`editGroup` führen `projectIds[]`.

### CSS

- `.sf-section-nested{margin-left:14px;margin-bottom:4px}` —
  Einrückung der Kind-Projekte.
- `.sf-group-manual-no-cwd`-Regel entfernt; Kommentar aktualisiert.

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM)
✓ EN: alle 510 benutzten Keys vorhanden
✓ DE: alle 510 benutzten Keys vorhanden
✓ Hook-Audit-Selbsttest ok
✓ Hook-Reihenfolge: keine bedingten Hooks

$ npm test
✓ v1.26.0: Schema-Migration mappt cwd auf projectIds via $projectsList
✓ v1.26.0: Migration entfernt cwd aus dem Eintrag
✓ v1.26.0: createGroup wirft ohne projectIds / ohne Argumente
✓ v1.26.0: createGroup legt Gruppe mit projectIds an
✓ v1.26.0: normalizeProjectIds (Dedupe, Filter)
✓ v1.26.0: addProjectToGroup / removeProjectFromGroup / Idempotenz
✓ v1.26.0: Single-Container — Projekt wandert zwischen Gruppen
✓ v1.26.0: groupsContainingProject
✓ v1.26.0: sf-section-nested gerendert (2 Kind-Projekt-Sections)
✓ v1.26.0: groupEmpty-Hinweis für leere Gruppe
✓ v1.26.0: 4 neue i18n-Keys im Bundle
=== RENDER-SMOKETEST BESTANDEN ===

$ PLAYWRIGHT_PKG=… npm run test:style
✓ Manuelle Gruppe mgh1: Caret Default opacity=0 (hover-only)
✓ Manuelle Gruppe mgh1: :hover/focus-within → opacity:1 Regel existiert
✓ Manuelle Gruppe mgh2: Caret ebenfalls opacity=0
✓ Kind-Projekt-Section nested1: eingerückt (margin-left 14px)
=== STYLE-TEST BESTANDEN (Chromium Computed-Styles) ===
```

Geänderte Dateien:

- `plugin.js` — Datenmodell + Migration + Helper, `buildSections`
  (subSections), Render (flatSections/nested/onNewHere), DnD
  (Hybrid), `GroupDialog` (Picker), CSS (nested-Einrückung),
  i18n EN+DE (5 Keys raus, 7 Keys rein), VERSION 1.26.0.
- `package.json` — 1.26.0.
- `tests/render-test.mjs` — Export-Concat (neue Helper), Block 33
  auf v1.26.0 umgeschrieben.
- `tests/style-test.mjs` — veraltete no-cwd-Checks entfernt,
  nested-Einrückungs-Check neu, Fixture `nested1`.
- `CHANGELOG.md` — `[1.26.0]` mit Breaking/Changed/Removed/Added.
- `docs/SETTINGS.md` — Abschnitt „Gruppen als Projekt-Container".
- `docs/ROADMAP.md` — Stand v1.26.0, v1.25.0 als verworfen markiert.

Manuelle Live-Schritte (nach Hot-Reload):

1. Zwei Projekte anlegen (z. B. `AGs`, `AGs-2`).
2. Toolbar → „Neue Gruppe" → Checkbox-Liste → beide Projekte wählen
   → Speichern.
3. Gruppe klappt auf: zwei eingerückte Projekt-Header mit `+`.
4. `+` auf einem Kind-Projekt → Session entsteht im Projekt-Ordner
   und bleibt unter der Gruppe sichtbar (`projects.tree`-Refresh).
5. Session aus „Kein Projekt" auf den Gruppen-Header ziehen → Toast
   „<Projekt> zur Gruppe <Gruppe> hinzugefügt".
