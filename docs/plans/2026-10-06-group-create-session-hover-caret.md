# Manuelle Gruppen: Session-Erzeugen-Button, Hover-Caret und Projekt-Header-Parität

- **Status**: Done
- **Erstellt**: 2026-10-06
- **Abgeschlossen**: 2026-10-06
- **Betrifft**: `plugin.js` (`$groupsState`, `createGroup`, `updateGroup`,
  `normalizeGroupCwd`, `SectionHeader`, `buildSections`, `GroupDialog`,
  `newSessionHere`, `loadGroups`-Migration, i18n EN+DE),
  `tests/render-test.mjs` (Block 33), `tests/style-test.mjs`
  (mgh1/mgh2-Fixture), `docs/SETTINGS.md`, `docs/ROADMAP.md`,
  `CHANGELOG.md`, `package.json`
- **Version**: 1.25.0

## Anforderung

Wörtlich aus dem Auftrag:

> „Das Erzeugen von Sessions innerhalb von Gruppen in Session Flow soll
> ermöglicht werden und die Kopfzeile soll sich dementsprechend auch
> anpassen, so wie wir es auch bei Projekten haben. Das Layout soll auch
> genauso wie bei Projekten sein und die sichtbare Iconbutton für den
> Collapse und die Collapse soll genauso auch für die anderen Projekte
> identisch sein. Also es soll bei Hover nur sichtbar sein, bei den
> Gruppen, die ich erstelle. Ihr möchten in der Lage sein, in einer Gruppe
> Sessions zu erzeugen, wie auch unter Projekten. Und diese Gruppen sind
> dann unterhalb von nicht Projekt zugewiesenen Sessions, die aber in
> Gruppen referenziert werden können."

Auf Deutsch, entlang der fünf konkreten Forderungen:

1. **In manuell erstellten Gruppen sollen Sessions erzeugt werden können** —
   so wie heute schon in Projekt-Headern (Hover-`+` → `startNewSessionInCwd`
   mit dem Projekt-Pfad).
2. **Kopfzeile der manuellen Gruppe** verhält sich **exakt wie die
   Projekt-Kopfzeile**: gleiche Typografie, gleiches Layout, gleicher
   Auf/Zu-Caret (hover-only).
3. **Collapse-Caret und das Aktions-Icon** sind auch bei Projekten
   **nur beim Hover sichtbar** (in der heutigen Implementierung ist der
   Caret bei Projekten schon hover-only, das `+`-Aktions-Icon ebenfalls).
4. **Identische Optik** zwischen manuellen Gruppen und Projekt-Headern.
5. **Position der manuellen Gruppen**: unterhalb der „nicht-projekt-
   zugewiesenen" Sessions, die aber in Gruppen referenziert werden können.

## Kontext

Aktueller Stand der Header-Implementierung (siehe
[`docs/DEVELOPMENT.md`](../../DEVELOPMENT.md) — Sektion „UI — Sessions-Pane",
`buildSections()`-Block ab Zeile 4184):

| Header-Typ | `kind` | Caret-Sichtbarkeit (CSS) | Aktions-Button | `startNewSession`-Aufruf |
|---|---|---|---|---|
| Projekt | `project` | `opacity:0`, `:hover` → `1` (`.sf-group-project .sf-group-caret`) | `+`-Icon (Hover-only) | `startNewSessionInCwd(section.cwd, section.title)` über `newSessionHere` |
| Manuell | `manual` | **immer sichtbar** (Default `.sf-group-caret`) | **nur Edit-Icon** (kein `+`) | — kein Pfad |
| Pinned | `pinned` | **kein Caret** (Pin-Icon übernimmt Auf/Zu) | „Alle lösen" | — |
| Ungrouped | `ungrouped` | **kein Caret** (`section.kind !== 'ungrouped'` schaltet `collapsible` aus) | — | — |

**Lücken heute**:

- `SectionHeader` rendert den `+`-Aktions-Button nur, wenn
  `isProject && onNewHere` (Zeile 7598 in `plugin.js`). Manuelle Gruppen
  bekommen stattdessen das Edit-Icon (Zeile 7618 ff.). Es gibt also
  **keinen Pfad, um aus einer manuellen Gruppe heraus eine Session zu
  erzeugen**.
- `onNewHere` wird im `SessionsPane`-Render nur für `section.kind === 'project'`
  gesetzt (Zeile 9524). Manuell-Gruppen-Aufrufer fehlen.
- `.sf-group-caret` ist im CSS per `.sf-group-project { opacity:0 }` versteckt;
  manuelle Gruppen fallen auf den Default zurück (immer sichtbar) — also
  **nicht hover-only** wie bei Projekten.
- Eine manuelle Gruppe hat heute **keinen eigenen `cwd`** — sie ist ein
  reines Anzeige-Konstrukt (`$groupsState.groups[].name/color/createdAt`).
  Damit ein `+`-Button in einer Gruppe sinnvoll eine Session erzeugen
  kann, braucht die Gruppe **einen Anker-Pfad** — sonst entstehen
  „Kein-Projekt"-Sessions, genau die Hauptbeschwerde aus v1.17.3 / v1.19.0
  (Plan [`2026-10-05-new-session-project-anchor-v2.md`](2026-10-05-new-session-project-anchor-v2.md)).

**Datenfluss heute für „neue Session in Projekt"** (siehe `plugin.js:3122`
`startNewSessionInCwd`):

1. `params.cwd` + `params.cwd_explicit = true` setzen
2. `session.create` → frische Runtime-ID
3. `session.cwd.set { cwd, session_id: runtimeId }` (In-Memory-sid, nicht
   stored_session_id!) — sonst bleibt der CWD leer
4. `openFreshSession(createdId)` mit Owner-Hinweis
   (Plan [`2026-10-06-neue-session-owner-und-chip-nativ.md`](2026-10-06-neue-session-owner-und-chip-nativ.md))

Für manuelle Gruppen muss der `cwd` also aus dem
**Composer-Chip-Pick** (`$composerPick`, TTL 5 min) oder dem **App-Scope**
(`hermes.desktop.projectScope`) oder `projects.db.active_id` kommen — derselbe
Fallback wie der Header-`+` (siehe `resolveNewProjectSessionCwd()` ab Zeile
2973). Wenn gar nichts greift: `noProjectAnchor`-Toast (seit v1.19.1).

## Scope

1. **Manuellen Gruppen einen `cwd` mitgeben** — Anker-Editor im
   Gruppen-Dialog (Rechtsklick auf Header → „Bearbeiten…" → Pfad-Auswahl):
   - Pflichtfeld für neue Gruppen (Dialog fordert Pfad-Auswahl; ohne Pfad
     ist der `+`-Button später disabled).
   - Optional für existierende Gruppen (Pfad kann gesetzt/geändert werden).
   - Persistiert in `$groupsState.groups[].cwd` (String, abs. Pfad).
   - UI: wie der Projekt-Ordner-Picker — `host.hermesDesktop.selectPaths({ directories: true, multiple: false })` (siehe [`DEVELOPMENT.md`](../../DEVELOPMENT.md) →
     „Datei-Picker").
2. **`+`-Aktions-Icon auf manuellen Gruppen rendern**, wenn `cwd` gesetzt:
   - Ruft `startNewSessionInCwd(group.cwd, group.name)` auf.
   - Reihenfolge im Header: `caret → lead (color-dot) → name → drophint → +  → count` — exakt wie bei Projekten (heute ist es
     `caret → lead → name → drophint → edit → count`).
3. **Caret bei manuellen Gruppen hover-only** (CSS analog zu
   `.sf-group-project`):
   - Selector erweitern: `.sf-group-project, .sf-group-manual`.
   - `.sf-group-head[data-manual-no-cwd=true]` schaltet den `+`-Button
     weg und zeigt stattdessen einen Hinweis-Tooltip („Erst Pfad setzen
     — Gruppe bearbeiten").
4. **Layout / Typografie** unverändert (manuell und Projekt teilen
   bereits jetzt die `sf-group-text`/`sf-group-name`/`sf-group-sub`-Klassen).
5. **Anordnung**: manuelle Gruppen erscheinen in der bestehenden Reihenfolge
   **vor** dem „Nicht zugewiesen"-Rest (heute ist es so — siehe
   `buildSections()`: Pinned → Manual → Rest). Die User-Aussage „unterhalb
   von nicht Projekt zugewiesenen Sessions" lese ich als **Reihenfolge der
   Daten**: nicht-projekt-zugewiesene Sessions sind die im `rest`; sie
   landen erst NACH den manuellen Gruppen. Das passt zur heutigen
   Implementierung — keine Änderung an der Reihenfolge nötig.
6. **Sichtbarkeit bestehender Gruppen**: alle bereits angelegten Gruppen
   ohne `cwd` bekommen `cwd: null` per **One-Shot-Migration** in
   `loadGroups()` (Pattern siehe Skill
   `hermes:session-flow` → „Flipping a default that affects already-saved
   user settings"). Ihr `+`-Button ist disabled (Tooltip zeigt „Erst
   Pfad setzen").
7. **Drag&Drop-Bestand**: das bestehende `onDrop` für `section.kind === 'manual'`
   (Zeile 9434) weist die Session weiterhin der Gruppe zu. Das bleibt
   unverändert — kein Konflikt mit dem neuen `+`-Button (separater Click-Handler).
8. **i18n** (EN + DE):
   - `groupPathLabel`: „Ordnerpfad" / „Folder path"
   - `groupPathPick`: „Ordner wählen…" / „Pick folder…"
   - `groupPathEmpty`: „Kein Ordner — bitte Pfad setzen, um Sessions zu erzeugen"
   - `newSessionHereGroup`: „Neue Session in dieser Gruppe" (Erweiterung von
     `newSessionHere`, der heute für Projekte gilt)
   - `groupMissingCwdHint`: „Pfad setzen" / „Set folder"
9. **Tests** (`tests/render-test.mjs`):
   - Manuell-Gruppe mit `cwd` → `+`-Icon vorhanden, ruft
     `startNewSessionInCwd(group.cwd, group.name)`.
   - Manuell-Gruppe ohne `cwd` → KEIN `+`-Icon, Tooltip `groupMissingCwdHint`.
   - Caret-Visibility-Check: `.sf-group-manual` rendert mit
     `opacity:0`-Klasse (Style-Suite).
   - Bestehende Tests für Projekt-Header (`+` sichtbar) bleiben grün.
10. **`docs/SETTINGS.md`**: Tab-Gruppen-Sektion um `cwd`-Feld und
    `+`-Button-Semantik erweitern.
11. **Live-Verifikation** (im echten Hermes-Desktop): manuell angelegte
    Gruppe mit gesetztem Pfad → `+` auf Header → neue Session entsteht
    in genau diesem Ordner; `projects.tree` zeigt sie nach erstem Prompt
    dort; `sqlite3 ~/.hermes/state.db` bestätigt `cwd` (Pattern aus
    Plan [`2026-10-05-new-session-project-anchor-v2.md`](2026-10-05-new-session-project-anchor-v2.md)).

## Nicht-Scope (bewusst ausgeklammert)

- **Mehrere Pfade pro Gruppe** (Multi-Root, vergleichbar mit
  `projects.list.folders[]`) — braucht eine andere UX (Tabelle) und ist
  nicht angefragt. Wenn überhaupt später, dann als v1.26+.
- **„In Gruppe kopieren / duplizieren"** — keine Anforderung.
- **Live-CWD-Änderung einer bestehenden Session aus der Gruppe heraus** —
  heute geht das via `session.workspace.move` / `session.cwd.set`
  (Drag&Drop), nicht über die Gruppe selbst. Nicht angefragt.
- **Anker-Auflösung über den Composer-Pick für Gruppen-`+`**: Wenn der
  User in der Kopfzeile per Composer-Chip ein Projekt wählt und DANN
  in einer Gruppe `+` klickt, gewinnt der Gruppen-CWD (sonst wäre die
  Gruppen-Zuordnung wertlos). Wer bewusst „in dieser Gruppe, aber im
  Composer-Projekt" will, nutzt weiter den Header-`+` / Composer selbst.
  Wird im Kommentar dokumentiert, nicht per UX-Toggle umschaltbar.
- **Layout-Anpassung an die User-Aussage „unterhalb von nicht-projekt-
  zugewiesenen Sessions"**: Das ist die heutige Reihenfolge schon
  (Pinned → Manual → Rest). Der Plan nennt sie explizit, ändert sie
  aber nicht — wer sie umdrehen will, sagt es im Folge-Auftrag.

## Umsetzung (geplant)

1. **Datenmodell** (`plugin.js`):
   - `createGroup(name, color, cwd)` — dritter Parameter, Pflicht
     (Dialog fordert ihn).
   - `updateGroup(groupId, patch)` — `cwd` patchbar.
   - One-Shot-Migration in `loadGroups()`:
     `if (group.cwd === undefined) group.cwd = null` (nur wenn
     nicht gesetzt — bestehendes `null` bleibt).
2. **Dialog** (`GroupDialog`): drittes Eingabefeld unter Name/Farbe:
   - Read-only-Input + Button „Ordner wählen…" →
     `host.hermesDesktop.selectPaths({ directories: true, multiple: false })`.
   - Beim Erstellen: ohne Pfad → Save-Button disabled + Hinweis.
   - Beim Bearbeiten: Pfad optional, leer lassen = `cwd: null`.
3. **`buildSections()`** (Zeile 4320 ff.):
   - `cwd: group.cwd || ''` an die Section hängen — exakt das gleiche
     Feld wie bei Projekten.
4. **`SectionHeader`** (Zeile 7598 ff.):
   - `isManual = section.kind === 'manual'`
   - Aktions-Block: `isProject && onNewHere` ODER
     `(isManual && section.cwd && onNewHere)` → `+`-Icon, ansonsten
     bestehender Edit-Fallback (für manuelle Gruppen ohne CWD).
   - Reihenfolge: bei manuellen Gruppen den Edit-Button behalten, aber
     VOR den `+`-Button setzen (oder dahinter — UX-Entscheidung im
     Test-Sweep; wahrscheinlich dahinter, weil `+` die häufigere
     Aktion ist).
5. **`newSessionHere`** (Zeile 9348): Aufruf anpassen —
   `startNewSessionInCwd(section.cwd, section.title || section.label || '')` —
   funktioniert für `project` UND `manual` (cwd ist immer gesetzt, sonst
   wird der Button gar nicht gerendert).
6. **`SessionsPane` Render** (Zeile 9524):
   - `onNewHere: (section.kind === 'project' || section.kind === 'manual') ? newSessionHere : undefined`
7. **CSS** (`plugin.js` Zeile 5837 ff.):
   - `.sf-group-project .sf-group-caret` erweitern zu
     `.sf-group-project .sf-group-caret, .sf-group-manual .sf-group-caret`.
   - `.sf-group-head[data-manual-no-cwd=true] .sf-group-actions[data-sf-action='new']` —
     eigenes Attribut am Actions-Span, damit Edit-Button sichtbar
     bleibt (der User soll den Pfad ja nachträglich setzen können).
8. **Style-Suite** (`tests/style-test.mjs`): Fixture um
   `data-manual-no-cwd=true` und einen Vergleichsfall mit gesetztem
   `cwd` erweitern. Pin `getComputedStyle(.sf-group-caret).opacity` auf
   `0` und `1` über `:hover`.
9. **i18n** (EN + DE, `npm run check` prüft Parität).
10. **Pflege-Checkliste**: CHANGELOG, SETTINGS.md, ROADMAP.md, package.json
    (`1.25.0`), `plugin.js:VERSION` (`'1.25.0'`), `git push origin main`.

## Verifikation

```
$ npm run check       # Syntax + i18n-Parität (EN/DE)
$ npm test            # Render-Smoketest: Gruppen mit/ohne cwd, + sichtbar/versteckt
$ npm run test:style  # Computed-Styles: Caret opacity 0/1 über :hover
```

Manuelle Live-Schritte nach dem Hot-Reload:

1. In den Einstellungen unter „Tab-Gruppen" (oder per
   Toolbar-layers-Icon → „Neue Gruppe"): Gruppe „AGs" anlegen, Pfad auf
   `_AGANTILA_Workspace/AGs` setzen.
2. In der Pane auf der Gruppe „AGs" hovern: Caret erscheint, `+` erscheint.
3. Klick auf `+` → neue Session öffnet im gewählten Ordner.
4. `sqlite3 ~/.hermes/state.db "SELECT cwd FROM sessions ORDER BY started_at DESC LIMIT 1"`
   zeigt den Pfad, nicht leer.
5. Gruppe ohne Pfad: `+` fehlt, Edit-Button zeigt Tooltip „Pfad setzen".

## Follow-ups

- **Multi-Root pro Gruppe** (siehe Nicht-Scope): v1.26+.
- **Anker-Validierung beim Save** (existiert der Pfad noch?): später
  per `host.hermesDesktop.stat(path)`, sobald das Türchen im SDK ist.
- **Composer-Pick für Gruppen-`+`**: sobald eine UI-Variante
  (z. B. Shift-Klick) angefragt wird, die das aktuelle Verhalten
  (Gruppen-CWD gewinnt) überschreiben soll.

## Umsetzung (tatsächlich — v1.25.0)

### Datenmodell (`plugin.js`)

- `createGroup(name, color, cwd)` — dritter Parameter Pflicht; wirft
  `group-cwd-required` ohne Pfad.
- `updateGroup(groupId, patch)` — normalisiert `cwd` über
  `normalizeGroupCwd()`.
- `normalizeGroupCwd(cwd)` — Whitespace trimmen, leere Strings → `null`.
- `loadGroups()` — One-Shot-Migration: bestehende Gruppen ohne
  `cwd`-Feld bekommen `cwd: null` gesetzt, damit der Render-Code
  sauber zwischen „Pfad gesetzt" und „noch leer" unterscheiden kann.

### `buildSections()` (Zeile ~4353)

Manuell-Gruppen-Section trägt jetzt `cwd: group.cwd || ''` (analog zu
Projekt-Sections).

### `SectionHeader` (Zeile ~7455)

- Neue Variable `canNewHere` (Projekt ODER Manual-mit-cwd).
- Action-Spans tragen `data-sf-action='new' | 'unpin' | 'edit'`.
- Manuelle Gruppe ohne CWD: `data-manual-no-cwd='true'` +
  Klasse `sf-group-manual-no-cwd`; Tooltip `groupMissingCwdHint`.
- Tooltip-Reihenfolge: Projekt-Pfad → Pinned-Tip →
  `groupMissingCwdHint` (Manual ohne CWD) → `editGroup` (Manual mit CWD) →
  `collapse/expand`.

### `SessionsPane` Render (Zeile ~9624)

`onNewHere: (section.kind === 'project' || (section.kind === 'manual' && section.cwd)) ? newSessionHere : undefined` — manuelle Gruppen mit CWD bekommen jetzt den `+`-Handler.

### `GroupDialog` (Zeile ~8767)

- Neue Pfad-Zeile zwischen Name und Farbe: read-only Anzeige des
  aktuellen Pfads + „Ordner wählen…"-Button.
- `pickFolder()` Helper ruft `pickProjectFolder()` (= derselbe
  `host.hermesDesktop.selectPaths`-Door wie der Projekt-Dialog).
- `canSubmit = !!effectiveCwd.trim()` — Save-Button deaktiviert ohne Pfad.
- Beim `commit()` ruft `createGroup(..., cwd)` mit Try/Catch: bei
  `group-cwd-required` bleibt der Dialog offen mit Fehler-Hinweis.
- Beim Wechsel in den Edit-Modus fällt der Pfad auf den gespeicherten
  Wert zurück, solange der User keinen neuen gewählt hat.

### CSS (Zeile ~5862)

- Caret-Hover-only auf `.sf-group-manual` ausgedehnt (analog zu
  `.sf-group-project`): Default `opacity:0`, `:hover` /
  `:focus-within` → `1`.
- `.sf-group-manual-no-cwd .sf-group-actions[data-sf-action=new]{display:none}`
  — versteckt nur das `+`, nicht den Edit-Button.

### i18n (EN + DE)

Neue Keys in beiden Bundles: `newSessionHereGroup(name)`,
`groupPathLabel`, `groupPathPick`, `groupPathEmpty`,
`groupMissingCwdHint`. `npm run check` ist grün: 510/510 Keys in beiden
Bundles, Hook-Audit ok.

### Tests

- `tests/render-test.mjs` Block 33: Fixture mit zwei manuellen Gruppen
  (eine MIT cwd, eine OHNE). Stellt `patchSettings('groups', { enabled:
  true, autoMode: 'off', showUngrouped: true })` sicher, weil ein
  vorangegangener Block `groups.enabled=false` setzt. Prüft:
  Section-Render, `+`-Tooltip nur für Gruppe mit cwd,
  `groupMissingCwdHint` für Backlog, `createGroup` wirft ohne CWD,
  `updateGroup` setzt CWD nachträglich, `normalizeGroupCwd` trimmt, alle
  5 i18n-Keys in den registrierten Bundles.
- `tests/style-test.mjs` Fixture `mgh1` (mit CWD) und `mgh2` (ohne
  CWD + zusätzliche `+`-Action für die display:none-Prüfung). Stellt
  sicher: Caret Default `opacity:0`, `:hover`-Regel existiert,
  `+`-Aktions-Icon `display:none` bei `data-manual-no-cwd`,
  Edit-Button bleibt `display:flex`.

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM)
✓ EN: alle 510 benutzten Keys vorhanden
✓ DE: alle 510 benutzten Keys vorhanden
✓ Hook-Audit-Selbsttest ok
✓ Hook-Reihenfolge: keine bedingten Hooks
Alles gut.

$ npm test
… (510+ Checks grün) …
=== RENDER-SMOKETEST BESTANDEN ===

$ PLAYWRIGHT_PKG=/home/deniz/_Linux_VS_Code_Workspace/Colabonate-App/node_modules/.pnpm/playwright@1.62.0/node_modules/playwright npm run test:style
…
=== STYLE-TEST BESTANDEN (Chromium Computed-Styles) ===
```

Geänderte Dateien (Plan-Sicht):

- `plugin.js` — `$groupsState`/`createGroup`/`updateGroup`/
  `normalizeGroupCwd` (Datenmodell), `loadGroups` (Migration),
  `buildSections` (cwd mitschleppen), `SectionHeader`
  (canNewHere, isManual, data-sf-action, data-manual-no-cwd),
  `GroupDialog` (Pfad-Zeile + Save-Gate), `SessionsPane` Render
  (`onNewHere` für manual), CSS (`.sf-group-manual`-Caret-Hover,
  `.sf-group-manual-no-cwd .sf-group-actions[data-sf-action=new]`),
  i18n EN+DE (5 neue Keys).
- `tests/render-test.mjs` — Export-Concat um
  `createGroup, updateGroup, deleteGroup, normalizeGroupCwd, $groupsState`,
  Block 33 (manuell-Gruppe mit/ohne cwd).
- `tests/style-test.mjs` — Fixture `mgh1`/`mgh2` + Helper
  `manualHeadInfo` + 5 neue Style-Assertions.
- `CHANGELOG.md` — neuer Eintrag `[1.25.0] — 2026-10-06` mit Added +
  Changed.
- `docs/SETTINGS.md` — neuer Abschnitt „Gruppen-Pfad und
  Session-Erzeugen-Button (v1.25.0)".
- `docs/ROADMAP.md` — Stand auf v1.25.0, neuer Eintrag unter
  „Zuletzt umgesetzt".
- `package.json` + `plugin.js` `VERSION` — beide auf `1.25.0`.
- `docs/plans/2026-10-06-group-create-session-hover-caret.md` — Status
  auf Done, Verifikations-Block angehängt.

Manuelle Live-Schritte nach dem Hot-Reload (zu erledigen):

1. Toolbar → „Neue Gruppe" (layers-Icon) → Name + Farbe eingeben,
   „Ordner wählen…" klicken → z. B. `_AGANTILA_Workspace/AGs` wählen
   → Speichern.
2. In der Pane auf der Gruppe „AGs" hovern: Caret erscheint, `+` erscheint.
3. Klick auf `+` → neue Session öffnet im gewählten Ordner.
4. `sqlite3 ~/.hermes/state.db "SELECT cwd FROM sessions ORDER BY
   started_at DESC LIMIT 1"` zeigt den Pfad, nicht leer.
5. Bestehende Gruppe (vor v1.25.0) ohne CWD: `+` fehlt, Edit-Button
   zeigt Tooltip „Ordner setzen"; Klick → Dialog → Pfad nachpflegen.
