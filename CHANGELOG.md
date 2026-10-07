# Changelog

Alle nennenswerten Änderungen an diesem Plugin. Format lose angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [1.27.7] — 2026-10-07

### Fixed
- **DnD-Drag-Start in ListView tot, in GridView nur am unteren Kartenrand
  möglich** (eigentliche Ursache hinter der seit v1.25.1 verfolgten
  DnD-Saga): `.sf-tab` trägt `draggable=true`, aber Title/Details/Meta
  sind Text-Nodes mit dem Browser-Default `user-select:text`. Chromium/
  Electron priorisiert bei `mousedown`+Bewegung über selektierbarem Text
  **immer** die Text-Selektion vor dem `dragstart` des Vorfahren-Elements
  — der Drag konnte in ListView nie starten (die Zeile ist fast
  vollständig Text) und in GridView nur dort, wo kein Text-Node unter dem
  Cursor lag (der leere Padding-Rand unterhalb der Meta-Zeile). Der
  Hit-Test-Bypass aus v1.27.6 (`pointer-events:none` während eines
  aktiven Drags) behebt ein nachgelagertes Problem (Drop wird abgelehnt),
  löste aber nie das eigentliche Drag-Start-Problem. Fix: `user-select:
  none` + `-webkit-user-select:none` + `-webkit-user-drag:element` auf
  `.sf-tab` — der Browser bevorzugt jetzt überall auf der Karte/Zeile
  `dragstart` statt Text-Selektion.
- Style-Test (`tests/style-test.mjs`, Block 19) prüft jetzt dauerhaft
  `.sf-tab` computed `user-select:none` sowie den kompletten
  Hit-Test-Bypass-Zyklus (`pointer-events` vor/während/nach einem Drag,
  inkl. `data-dragging`-Ausnahme) als Regression-Guard — beide Bugs
  wurden zuvor mehrfach unbemerkt wieder eingeführt.

Plan: `docs/plans/2026-10-07-dnd-tot-list-grid.md` (aktualisiert, Status
jetzt Done).

## [1.27.5] — 2026-10-07

### Fixed
- **Optionsmenü und Drag & Drop in Liste UND Grid tot** (Regression aus
  v1.25.1): der dort eingeführte `onPointerDownCapture` rief bei JEDEM
  Linksklick `stopImmediatePropagation()` auf der ganzen Zeile auf — der
  pointerdown erreichte den `.sf-more`-Button (Radix
  DropdownMenuTrigger, öffnet pointerdown-getrieben) nie, das
  Optionsmenü öffnete nicht; die native Drag-Kette verlor zusätzlich
  ihre pointerdown-Basis. Der Capture-Kill ist entfernt — pointerdown
  läuft wieder frei, der More-Button (mit eigenem `stopPropagation`)
  und der Radix-Context-Wrapper verhalten sich nativ; der Grid-Drag
  bleibt über den nativen dragstart-Capture-Listener (`tabBodyRef`,
  dataTransfer-Mime) abgesichert, der aus v1.25.1 bleibt. Der
  assign-Unpin-Teil aus v1.25.1 (DnD aus der Pinned-Sektion) ist
  unverändert.

### Changed
- **Zeilen-Geometrie in List- und GridView** (Karten-Zentrierung +
  Subtext-Luft): `.sf-tab` Padding von `2px 8px` auf `4px 8px` —
  Title sitzt nicht mehr zu nah an der Kartenkante. `.sf-tab-main`
  ist jetzt Flex-Column mit `justify-content: center` und `gap: 1px` —
  Title und Details sind innerhalb der Karten-Zelle vertikal mittig
  zueinander. `.sf-tab-title` line-height von `16px` auf `14px`
  (matched die Lead-Icon-Höhe `var(--sf-row-lead,14px)`), `margin: 0`
  gegen den Browser-Default. `.sf-tab-details` margin-top in ListView
  von `4px` auf `2px` (knapper Anschluss), im GridView `3px` (etwas
  Luft zum Title). GridView `.sf-tab-main` mit
  `justify-content: flex-start` überschreibt den Center-Default, damit
  die Grid-Karte oben sitzt und die Meta-Zeile über `margin-top: auto`
  ans untere Ende gedrückt wird (bestehende Logik unverändert).

## [1.27.4] — 2026-10-07

### Fixed
- **Nach dem Reset waren alle Sessions „ohne Zuweisung"**: der
  Werksdefault `groups.autoMode` war `off` — ein „Einstellungen
  zurücksetzen"/„Alles zurücksetzen" stellte damit keine
  Projektgruppierung wieder her, obwohl Hermes Desktops Sidebar
  standardmäßig nach Projekten gruppiert. Die Zuordnung selbst
  (`projects.tree`, serverseitig) war nie weg — nur die Anzeige-
  Gruppierung. Fix: Werksdefault ist jetzt `project`; beide Reset-Pfade
  ziehen den Projekt-Baum sofort frisch (`invalidateProjectTree` +
  `refreshProjectsList` + Sessions-Refresh), damit die Projekt-Sektionen
  ohne Wartezeit auf die 60-s-Poll erscheinen.

## [1.27.3] — 2026-10-07

### Changed
- **Beide Titelgrößen initial 10px**: Session-Titel (`tabs.textSize`,
  Basis 13px → **10px**, Detail-/Meta-Zeilen proportional 8px, Floor
  8px) und Projekt-/Gruppen-Kopfzeilen (`groups.nameSize`,
  **14px → 10px**). CSS-Fallbacks und i18n-Beschreibungen angepasst.
  One-Shot-Migration: gespeicherte `groups.nameSize === 14` (alter
  Default) wird beim Laden einmalig auf 10 gesetzt; explizit gewählte
  Werte bleiben unberührt. `tabs.textSize` ist basis-unabhängig
  (Prozentwert).

## [1.27.2] — 2026-10-07

### Added
- **Kopfzeilen-Titel-Typografie einstellbar** (`groups.nameSize`,
  `groups.nameCaps`): Projekt- und Gruppen-Kopfzeilen-Titel in px
  (10–24, Default **14** — initial etwas größer als die 13px der
  Session-Titel) und als Toggle für Großbuchstaben (Default **an**,
  uppercase + Letter-Spacing .04em). Gespiegelt über
  `--sf-group-name-size` + `data-sf-groupcaps`; die Kopfzeilen-Dichte
  (Kompakt/Komfortabel/Detailreich) steuert nur noch Gewicht/Höhe,
  nicht mehr die Font-Größe.

## [1.27.1] — 2026-10-07

### Added
- **Textgröße für Liste & Grid** (`tabs.textSize`, Default 100 %):
  skaliert Titel UND Detail-/Meta-Zeilen der Session-Einträge in beiden
  Ansichten über `--sf-row-label-size` / `--sf-row-detail-size`.
  Bereich 80–160 % (Step 5), Einstellung in „Session-Tabs" vor den
  Grid-Optionen. Die Info-Dichte-Stufen (Komfortabel/Detailreich)
  folgen derselben Skalierung statt fixer 13px.

### Changed
- **Collapse-Caret immer sichtbar**: der Ein-/Ausklapp-Pfeil auf
  Projekt- und Gruppen-Kopfzeilen ist nicht mehr hover-only — die
  Affordanz ist ohne Maus-Hover erkennbar, identisch für Projekte und
  manuelle Gruppen.

## [1.27.0] — 2026-10-07

### Changed
- **Zeilen-Geometrie auf die native Sidebar-Zeile abgestimmt**
  (`hermes-agent` `row-geometry.ts`): Session-Zeilen nutzen jetzt 8 px
  Padding-X (statt 4/6 px), eine 14×14-Lead-Cell (statt 16 px), ein
  13-px-Label mit weight 500 (statt 12 px) und einen 16×16-Add-Button
  (statt 20 px). Die Tokens liegen als `--sf-row-*`-Custom-Properties
  auf `:root` und werden in `applyRows()` gespiegelt — Abstände und
  Einzug gleichen damit exakt der App-Sidebar.
- **Add-Button-Hover nutzt `--ui-control-hover-background`** statt des
  Zeilen-Hovers — gleiche Hover-Optik wie der native `+`-Button.

### Added
- **„Projekt nicht verfügbar\"-Hinweiszeile**: referenziert eine manuelle
  Gruppe eine tote Projekt-ID, zeigt die Kind-Projekt-Section jetzt eine
  Hinweis-Zeile (Warn-Icon + Erklärung) mit „Aus Gruppe entfernen\"-Button
  (`removeProjectFromGroup`) statt eines leeren Bodys; der Header trägt
  kein `+` mehr.
- **Einmaliger Migrations-Toast**: beim ersten Laden nach der
  v1.25.0→v1.26.0-Migration (cwd→projectIds) erscheint pro umgestellter
  Gruppe ein Toast (Erfolg mit Ziel-Projekt bzw. „konnte nicht migriert
  werden\"). Einmal-Semantik über ein persistiertes `migrationNotified`-Flag.

## [1.26.1] — 2026-10-07

### Fixed
- **„Fertig, aber ungesehen" fehlte im Status-Indikator (Liste UND
  Grid)**: der REST-Payload trägt `unread:true` (Antwort kam an, der
  User war noch nicht drin), und Filter/Status-Gruppierung nutzten den
  Zustand bereits — aber `activityFor()` (die Engine hinter dem
  Zeilen-Indikator) las das Flag nie und ließ jede ruhige Session
  pauschal als „idle" erscheinen. Die `data-kind=unread`-CSS-Regel war
  toter Code. Jetzt: ruhige Session mit `unread` → `kind:'unread'`
  (gefüllter Punkt-Glyph, Farbe `--ui-success`, Tooltip „Fertig —
  Antwort ungesehen"). Priorität: Busy/`$activity`-Detail gewinnt vor
  unread (ein laufender Chat zeigt seine Arbeit, nicht den Staub),
  unread schlägt idle. Zusätzlich null-safe (`row:null` crashte beim
  `.id`-Zugriff).

### Added
- i18n (EN+DE): `stUnread` („Done — unread answer" / „Fertig — Antwort
  ungesehen").

## [1.26.0] — 2026-10-06

### Changed
- **Suchfeld-Komponente von der Filter-Leiste getrennt**: das
  „Sessions durchsuchen…"-Input ist nicht mehr gemeinsam mit den
  Subtabs (Alle/Aktiv/Angepinnt/Archiv) in einem `sf-filterbar`-Block
  untergebracht. Beide Komponenten sind eigene JSX-Knoten
  (`searchField` + `quickFilter`). Das Input steht in der Toolbar-Zeile
  vor der Anzahl („X / Y Sessions") — die Subtabs ziehen in eine eigene
  Zeile darunter und nutzen die volle Pane-Breite (4 gleich breite
  Spalten). UX-Konvention analog zur nativen Hermes-Sidebar
  (`apps/desktop/src/app/chat/sidebar/index.tsx:1700`):
  `<SearchField>` direkt vor der Liste, ohne dazwischenliegende
  Status-Zeile.
- **Suchfeld hat keinen Field-Schatten mehr**: das SDK-Atom `Input`
  rendert mit der Klasse `desktop-input-chrome`, die in
  `apps/desktop/src/styles.css:1438` einen `inset 0 1px 1px`-Field-
  Schatten setzt. Unsere `.sf-filter-search input`-Regel hat das
  nie neutralisiert, deshalb war im unselektierten Zustand ein
  unschöner Schatten oben sichtbar. Regel setzt jetzt explizit
  `box-shadow:none` und `border:0` (auch für `:focus` / `:focus-
  visible` / `:focus-within`), damit der Container
  (`.sf-filter-search`) die einzige Quelle für Border/Hintergrund ist.
- **Manuelle Gruppen sind Container über `ProjectTreeNode`s** statt
  Pflicht-Ordnerpfad: das in v1.25.0 eingeführte `cwd` hat sich als
  semantisch falsch herausgestellt — `session.cwd.set` lässt die neue
  Session als eigenen Projekt-Knoten im Server-Baum erscheinen, sie
  „verlässt" damit die Gruppe. v1.26.0 führt stattdessen
  `projectIds: string[]` ein. Schema-Migration läuft beim Laden:
  alte `cwd` werden best-effort auf eine `ProjectTreeNode.id` gemappt
  (Pfad-Match gegen `$projectsList`); passt nichts, fällt die Gruppe
  als leerer Container zurück und der Nutzer ordnet manuell zu.
- **Toolbar zentriert das Count-Label nicht mehr**: `.sf-toolbar-count`
  ist jetzt `flex:0 1 auto` (intrinsisch), damit das Suchfeld den
  verbleibenden Platz in der Zeile bekommt und das Count-Label
  kompakt daneben sitzt.
- `.sf-quickfilter > .sf-seg` stretcht jetzt per
  `grid-template-columns: repeat(4, minmax(0,1fr))` auf volle
  Pane-Breite (gleiche Regel defensiv auch für SDK-`SegmentedControl`-
  Marker `[data-segmented-control]`/`[role=group]`/`[data-segmented]`).

### Fixed
- **Wiederhergestellte CSS-Regel** `.sf-group-manual-no-cwd
  .sf-group-actions[data-sf-action=new]{display:none}` war beim
  Refactor verloren gegangen — manuelle Gruppen ohne CWD zeigen das
  `+`-Aktions-Icon wieder nicht.

## [1.25.0] — 2026-10-06

### Changed
- **BREAKING — Manuelle Gruppen sind jetzt Container über Projekte**:
  das v1.25.0-`cwd`-Konzept hat sich als semantisch falsch herausgestellt
  (`session.cwd.set` ließ die neue Session als eigenen Projekt-Knoten im
  Server-Baum erscheinen — sie „verließ" die Gruppe sofort). Eine Gruppe
  speichert jetzt `projectIds: string[]` — Referenzen auf
  `ProjectTreeNode`s aus `projects.tree`. Die neue Session entsteht
  weiter über das `+` am **Projekt-Header** und ist automatisch Mitglied
  ihrer Gruppe. Plan:
  `docs/plans/2026-10-06-group-as-project-container.md`.
- **Schema-Migration**: bestehende v1.25.0-Gruppen mit `cwd` werden in
  `loadGroups()` best-effort auf `projectIds` gemappt (Pfad-Match gegen
  `$projectsList`); das alte `cwd`-Feld wird verworfen. Nicht auflösbare
  Pfade werden zu leeren Containern (Edit-Dialog zum Nachpflegen).
- **Hybrid-Drag&Drop** (Frage 4): Session mit Projekt auf eine
  Gruppen-Kopfzeile gezogen → das referenzierte Projekt wird der Gruppe
  hinzugefügt (Info-Toast `groupAddProject`). Session ohne Projekt →
  Fallback auf die alte `assign`-Semantik.
- **Single-Container-Semantik** (Frage 3): ein Projekt ist in maximal
  EINER user-definierten Gruppe — `addProjectToGroup` entfernt es
  automatisch aus der anderen. Idempotent.
- **GroupDialog**: Multi-Projekt-Picker (Checkbox-Liste, alphabetisch,
  Farb-Dots) ersetzt das alte Pflicht-CWD-Feld. Save-Button braucht
  ≥ 1 gewähltes Projekt. Projekte in anderen Gruppen werden mit Badge
  markiert (Tooltip erklärt das Umhängen).
- **Sub-Sections**: jede manuelle Gruppe rendert ihre referenzierten
  Projekte als eingerückte Projekt-Sections (`sf-section-nested`,
  `margin-left:14px`) mit voller Projekt-Header-Geometrie inkl. `+`.
- **Kein `+` mehr auf dem Gruppen-Header** — nur noch Edit-Affordanz;
  die Erzeugen-Geste sitzt semantisch korrekt auf den Kind-Projekten.

### Removed
- i18n-Keys `newSessionHereGroup`, `groupPathLabel`, `groupPathPick`,
  `groupPathEmpty`, `groupMissingCwdHint`; CSS-Regel
  `.sf-group-manual-no-cwd`; `data-manual-no-cwd`-Attribut.

### Added
- i18n-Keys (EN+DE): `groupProjectsLabel`, `groupProjectsEmpty`,
  `groupNoProjectsAvailable`, `groupAddProject({group, project})`,
  `groupInOtherGroupTag({name})`, `groupProjectInOtherGroup({name})`,
  `groupEmpty`.

## [1.25.0] — 2026-10-06

### Added
- **Manuelle Gruppen: Session-Erzeugen-Button + Projekt-Header-Parität**:
  wer eine manuelle Gruppe anlegt, muss jetzt einen Ordner-Pfad wählen
  (Pflichtfeld im Dialog) und bekommt dann ein `+`-Aktions-Icon auf dem
  Header — Klick erzeugt eine neue Session direkt in diesem Ordner,
  exakt wie unter Projekten in Hermes Desktop (`session.create` +
  `session.cwd.set`-Anker, Plan
  `2026-10-05-new-session-project-anchor-v2.md`). Der Caret ist hover-only
  (identisch zu Projekt-Headern), die Edit-Affordanz bleibt für manuelle
  Gruppen erhalten.
- **Migrations-Pfad** für vor 1.25.0 angelegte Gruppen: bestehende
  Gruppen ohne `cwd` bekommen in `loadGroups()` `cwd:null` gesetzt — ihr
  Header zeigt das `+` nicht, dafür den Edit-Button mit Hinweis-Tooltip
  („Ordner setzen — Gruppe bearbeiten und Pfad wählen."). Beim ersten
  Bearbeiten kann der Pfad nachgepflegt werden.

### Changed
- `createGroup(name, color, cwd)` — dritter Parameter Pflicht; Aufrufer
  ohne `cwd` (Dialog Save) bekommen einen Fehler und der Dialog bleibt
  offen mit Hinweis.
- `updateGroup(groupId, patch)` normalisiert `cwd` über
  `normalizeGroupCwd()` (Whitespace, leere Strings → `null`).
- `GroupDialog` hat eine neue Pfad-Zeile: read-only Anzeige +
  „Ordner wählen…"-Button über `host.hermesDesktop.selectPaths`
  (derselbe Door wie der Projekt-Dialog). Der Save-Button ist deaktiviert,
  solange der Pfad leer ist.
- Section-Header: manuell-Gruppen tragen die Klassen `sf-group-manual`
  (Caret-Hover-only) und, ohne CWD, `sf-group-manual-no-cwd` +
  `data-manual-no-cwd`-Attribut. Action-Spans bekommen
  `data-sf-action="new" | "unpin" | "edit"`, damit CSS und Tests den
  Button eindeutig adressieren können.
- i18n (EN + DE): `newSessionHereGroup(name)`, `groupPathLabel`,
  `groupPathPick`, `groupPathEmpty`, `groupMissingCwdHint`.

## [1.24.1] — 2026-10-06

### Fixed
- **Bootstrap-Fehler hatte keinen Weg zurück (Pane blieb im Fehlerzustand
  hängen)**: scheiterte der ERSTE Daten-Satz beim App-Start (REST-Bridge +
  RPC), blieb `$loadPhase = 'error'` dauerhaft stehen — der Reconnect-Listener
  zog nur die Listen nach, nicht die Lade-UI, und die Pane bot keine
  Handhabe. `reconnectRefresh()` setzt die Phase jetzt bei
  `!bootstrapDoneOnce || Phase error` auf `loading`, und der Fehler-Leerzustand
  trägt einen **Retry-Button** („Erneut versuchen"), der Sessions, Projekt-Baum
  und Pin-Spiegel direkt neu lädt. Plan:
  `docs/plans/2026-10-06-analyse-verbesserungen.md` (Befunde A + C).
- **Composer-Pick blieb im „schon im Projekt"-Fall stehen**: der
  Draft-Pick-Übergang (`adoptComposerPickForNewSession`) räumte den Pick erst
  NACH dem Projekt-Lookup weg — traf der „Session liegt bereits im
  Ziel-Projekt"-No-Op zu, zeigte der Chip weiter das alte Label. Der Pick wird
  jetzt in ALLEN No-Op-Pfaden verworfen (Befund B).
- **Rehoming-Fehler war still**: schlugen `session.workspace.move` UND der
  `session.cwd.set`-Fallback fehl, bekam der User weder Toast noch Feedback
  und der Pick suggerierte weiter Gültigkeit. Jetzt error-Toast
  („Projekt konnte nicht gesetzt werden") + Pick-Verwurf (Befund E).

### Added
- **Schnellfilter „Angepinnt"**: die Filter-Leiste der Pane hat zwischen
  „Aktiv" und „Archiv" jetzt einen vierten Modus, der NUR die angepinnten
  Sessions zeigt (die feste Pinned-Sektion); die Textsuche greift darin wie
  überall (Befund H).
- **„Alles zurücksetzen" in Einstellungen → Über**: setzt ALLE Optionen zurück
  UND löscht manuelle Gruppen, Projekt-Zuordnungen (Seeds) und den
  Composer-Pick — hinter einem Bestätigungsdialog (destructive). Sessions
  selbst bleiben unberührt (Befund J).

### Changed
- `measureComposerRadius()` schreibt `--sf-arc-radius` nur noch bei
  Wertänderung — der 4-s-Takt erzeugt keinen Style-Invalidierungsschub mehr,
  wenn die Composer-Kontur sich nicht geändert hat (Befund L).

## [1.24.0] — 2026-10-06

### Fixed
- **`tabs.openIntent` „Ersetzen" stapelte unter aktivem `tabs.asTabSelector`**:
  die `:has()`-Regel blendet die native Content-Tab-Leiste nur VISUELL aus,
  das `host.openSession`-Verhalten der App bleibt davon unberührt — bei
  `intent: 'stack'/'tab'` legte die App den Klick scheinbar „daneben" an,
  der User las das als „Ersetzen ignoriert". Neuer Helper
  `effectiveOpenIntent()` ist jetzt die einzige Quelle für den Intent
  aller drei `host.openSession`-Aufrufer (`openFreshSession`,
  `wheelController.cycleNext`, `TabRow.onClick` → Wrapper `open(row,
  intent)`). Ist `tabs.asTabSelector = true`, erzwingt der Helper
  `in-place` — und die UI blendet einen erklärenden Hinweis ein, sobald
  der Segment no-oppt. Unabhängig davon whitelistet der Helper unbekannte
  persistierte Werte und fällt auf `in-place` zurück (Schutz gegen
  korrupte/alte Storage-Stände). Plan:
  `docs/plans/2026-10-06-openintent-tabs-as-selector.md`.

## [1.23.0] — 2026-10-06

### Fixed
- **„Neue Session" in der Kopfzeile: Fehler „Session owner could not be
  resolved"**: das Plugin erzeugt Sessions per `session.create` auf dem
  ambienten Socket und öffnete sie ohne Owner-Hinweis. Eine frische Session hat
  weder Zeile noch Hinweis (DB-Row lazy, `projects.tree` lässt 0-Turn-Sessions
  weg) — die App routet fail-closed und fand bei mehreren Profilen keinen
  Owner. Neuer Helper `openFreshSession()` übergibt das Socket-Profil an
  `host.openSession` (das SDK trägt daraus den Hinweis vor dem Resume ein) und
  lässt den Profil-Scope der Liste unangetastet (`keepAllProfilesScope:
  false`). Wirkt für „+" (Kopfzeile), Projekt-Header-„+", Composer-Chip und
  „Zweig erstellen" (gleiche Fehlerklasse). `session.create` trägt jetzt das
  Socket-Profil statt des fokussierten Session-Profils.
- **Composer-Chip lernte nie einen nativen Anker**: `composerDraftAnchor()` rief
  die async `resolveNewProjectSessionCwd()` ohne `await`. Jetzt ein
  synchroner Spiegel des App-Sendewegs (Home-Scope → detached, sonst
  Arbeitsordner, sonst Projekt-Scope).
- **Chip schrieb `hermes.desktop.projectScope`** — wirkungslos für den laufenden
  Draft, ließ die App aber beim nächsten Start ungefragt in das Projekt
  einsteigen. Der Write ist entfernt.

### Changed
- **Composer-Chip arbeitet mit der nativen Sessions-Seitenleiste wie mit dem
  Pane**: zeigt das Projekt des Draft-Arbeitsordners bzw. Projekt-Scopes und
  für bestehende (frische) Sessions das Projekt ihres Arbeitsordners; das Menü
  markiert das aktive Projekt und zieht die Projektliste beim Öffnen frisch.
  Ein Draft-Pick wird beim Übergang auf die von der App angelegte Session per
  `session.workspace.move` angewandt (nicht bei bekannten/bestehenden
  Sessions, nicht bei eigenen Creates des Plugins, nicht wenn die Session
  schon im Projekt liegt). Plan:
  `docs/plans/2026-10-06-neue-session-owner-und-chip-nativ.md`.

## [1.22.2] — 2026-10-06

### Fixed
- **Pane-Crash beim Umschalten der Kopfzeilen-Dichte auf „Detailreich"**: die
  Detailreich-Stufe lädt die Projekt-Ordnergröße per `useEffect` nach — dieser
  Hook lag aber **innerhalb** des `density === 'detailed'`-Zweigs von
  `SectionHeader`. Damit hing die Hook-Anzahl vom Render-Input ab: React wirft
  beim Wechsel #310 („Rendered more hooks") bzw. #300 („Rendered fewer hooks"),
  die Pane landete in der Error-Boundary und blieb auf „session-flow:pane
  failed to render" mit Retry-Button stehen. Der Effekt steht jetzt am
  Komponentenanfang (Hooks immer in gleicher Reihenfolge), die Bedingung liegt
  IM Effekt — sonst unverändert. Betraf v1.18.0–v1.22.1.
- **`npm run check` prüft jetzt die Hook-Reihenfolge**: neuer statischer Audit,
  der Hook-Aufrufe in bedingten Blöcken/Zeilen (`if`/`for`/`while`/`switch`/
  `else`/`&&`/`||`/Ternary) findet und mit Exit-Code 1 abbricht (inkl.
  Selbsttest des Scanners). Der Render-Smoketest kann diese Fehlerklasse nicht
  sehen — dort sind `useEffect`/`useState` Stubs, es gibt keinen echten
  React-Reconciler und damit keine Hook-Zählung.
  Plan: `docs/plans/2026-10-06-fix-kopfzeilen-dichte-crash.md`.

## [1.22.1] — 2026-10-06

### Fixed
- **Titel im Light-Theme**: der Titel-Stil ließ sich im Hell-Subtab einstellen,
  aber die Werte wurden nicht angewendet — Ursache war die Theme-Erkennung:
  bei transparentem Flächen-Hintergrund (`rgba(0,0,0,0)`, malt die App
  woanders) lieferte die Luminanz-Prüfung fälschlich `[0,0,0]` → „dark", sodass
  der Light-Satz nie griff. Die Erkennung prüft jetzt `color-scheme`, dann nur
  **undurchsichtige** Flächen und weicht sonst auf `prefers-color-scheme` aus.
- **Hell-Subtab wirkungslos bei ausgeschaltetem Split**: die Subtabs waren auch
  ohne `themeSplit` editierbar, die Werte landeten aber in einem nicht
  angewendeten Satz. Jetzt schaltet die Wahl von „Hell" `themeSplit`
  automatisch ein — Edits greifen sofort.

### Added
- **Titel-Stil** (`tabs.titleStyle` / `tabs.lightTheme.titleStyle`):
  `none` (App-Standard) | `solid` (eine Farbe `titleColor`) | `gradient`
  (Verlauf). Ersetzt den bisherigen reinen An/Aus-Schalter für den
  Titel-Verlauf; bestehende `titleGradOn=true`-Einstellungen werden einmalig
  auf `gradient` migriert. Die Farbfelder erscheinen nur für den gewählten Stil.
- **Titel-Einzelfarbe** (`tabs.titleColor` / `lightTheme.titleColor`): wenn der
  Titel **ohne Verlauf** gesetzt wird, ist genau EINE Farbe wirksam
  (`data-sf-titlecolor` + `--sf-title-color`), je Theme.
- **Theme-Modus** (`tabs.themeMode`): `auto` (App folgen) | `dark` | `light` —
  erzwingt einen Farb-Satz. Damit lassen sich die Hell-Farben auch in einer
  dunklen App prüfen; hilft, wenn die Erkennung den falschen Modus ermittelt.
- **Schlagschatten je Theme**: `rowShadow` und `selShadow` haben jetzt einen
  eigenen Wert im Light-Satz (`tabs.lightTheme.rowShadow` / `.selShadow`) und
  werden getrennt gespeichert und angewendet.

## [1.22.0] — 2026-10-06

### Added
- **Liste-&-Grid-Farben je Theme (Dark/Light)**: die Designfarben der
  Session-Zeilen und -Karten lassen sich jetzt getrennt fürs Dark- und
  Light-Theme einstellen. In den Einstellungen (Sektion „Sessions" →
  „Design — Liste & Grid") gibt es dafür:
  - **„Eigene Farben fürs Light-Theme"** (`tabs.themeSplit`) — aktiviert den
    getrennten Farb-Satz; aus = eine Farbmenge für beide Themes (bisheriges
    Verhalten, voll abwärtskompatibel).
  - **Subtab Dunkel/Hell** (`tabs.themeTab`) — die Farb-Controls unten
    editieren den jeweils gewählten Satz (Dark = flache `tabs`-Keys,
    Light = `tabs.lightTheme`).
  - **„Gegenfarbe automatisch ableiten"** (`tabs.themeAutoDerive`) — beim
    Setzen einer Farbe wird die passende Farbe fürs andere Theme in HSL
    abgeleitet (Farbton bleibt; Flächen in ein lesbares Helligkeitsband,
    Text/Titel invertiert) und dort vorbelegt. Frei änderbar.
  Betroffen: Zeilen-Verlauf (Start/Ende/Winkel), Titel-Verlauf (Start/Ende/
  Winkel), Auswahlfarbe.
- **Theme-Erkennung**: das Plugin erkennt das aktive App-Theme (Dark/Light)
  mehrstufig (Marker-Klasse/-Attribut an `<html>`/`<body>`, sonst Flächen-
  Helligkeit, zuletzt `prefers-color-scheme`) und schaltet die
  Zeilen-/Grid-Farben bei einem Theme-Wechsel automatisch um (MutationObserver
  + `matchMedia`). Read-only auf App-Markern; es werden nur plugin-eigene
  Custom Properties geschrieben. `data-sf-theme` markiert das erkannte Theme.

## [1.21.1] — 2026-10-06

### Fixed
- **Composer-Chip: neue Sessions landen jetzt im gewählten Projekt** (Bug
  v1.21.0). Vorher erzeugte der Draft-Pick im Composer-Chip sofort eine
  leere Session über `startNewSessionInCwd` (eager Create) — das war UX-mäßig
  falsch (User landet in einer leeren Session, bevor er tippt) und griff am
  App-Sendepfad vorbei, sobald der User den Draft einfach weiter benutzte.
  Fix: der Pick setzt nur noch den Anker in `$composerPick` (TTL 5 min) und
  schreibt `hermes.desktop.projectScope` im localStorage;
  `resolveNewProjectSessionCwd()` liest den Pick als **erste Quelle** vor
  App-Scope/active_id, sodass der App-Sendepfad (`startNewProjectSession` →
  `session.create {cwd, cwd_explicit:true}`) beim tatsächlichen Enter die
  Session garantiert im gewählten Projekt anlegt. Draft bleibt bis dahin
  offen. Re-Home bestehender Sessions via `session.workspace.move`
  unverändert.

## [1.21.0] — 2026-10-06

### Added
- **Projekt-Kontext-Chip vor dem Composer-„+“** (Plan:
  [docs/plans/2026-10-06-composer-projekt-kontext-pill.md](docs/plans/2026-10-06-composer-projekt-kontext-pill.md)):
  Minimalistischer Chip (Farb-Dot + Projektname + Caret) in der Eingabezeile
  des Composers, **direkt vor dem „+“-Add-IconButton** — der Projekt-Kontext
  ist damit vor der ersten Eingabe immer sichtbar. Klick öffnet ein Menü mit
  „Kein Projekt (Home)“ + allen Projekten (`projects.tree`). **Draft**: der
  Pick erzeugt SOFORT die verankerte Session (derselbe Pfad wie der Pane-„+“:
  `session.create` mit cwd + `cwd_explicit` → `session.cwd.set` →
  Overlay-Seed → open) — die Zuweisung steht garantiert vor der ersten
  Eingabe. **Bestehende Session**: Re-Home per `session.workspace.move`
  (persistiert per session_key; Fallback `session.cwd.set` für ältere
  Gateways), plus best-effort `projects.set_active` (dauerhafter Aktiv-Zeiger
  der App/CLI). Injektion über einen deklarativen Sync-Loop (2,5 s) am
  `.codicon-add`-Anker des fokussierten, sichtbaren Composer-Roots;
  Keep-Alive-/Pop-out-Tiles bekommen bewusst keinen Chip; Dispose entfernt
  Chip + Menü restlos. Option „Projekt-Chip im Composer“ in Einstellungen →
  Sessions (`composer.projectPill`, Default an). i18n EN+DE.

## [1.20.0] — 2026-10-06

### Added
- **App-Schnellstart-Zeile** (neue Icon-Button-Zeile über der Pane-Toolbar,
  Plan: [docs/plans/2026-10-05-app-nav-icon-row.md](docs/plans/2026-10-05-app-nav-icon-row.md)):
  Neue Session, Fähigkeiten, Messaging, Artefakte, Geplante Jobs und Kanban —
  gleiche Reihenfolge/Codicons wie die erste Sektion der App-Sidebar
  (`SIDEBAR_NAV`), Navigation über `host.navigate` mit Route-Whitelist.
  Kanban erscheint nur bei installiertem/laufendem Kanban-Plugin
  (Feature-Detect am Drawer-DOM), sonst fällt der Button weg. Die Zeile ist
  `flex-wrap` und bricht bei schmaler Pane-Breite dynamisch in weitere
  Zeilen um. Neue Session läuft über den bestehenden Projekt-Scope-Pfad.
  Option „App-Schnellstart-Zeile" in Einstellungen → Sessions
  (`tabs.appNav`, Default an). i18n EN+DE.
- **Pane-Fläche** (Hintergrund des Session-Flow-Panes einstellbar, Plan:
  [docs/plans/2026-10-06-pane-surface-option.md](docs/plans/2026-10-06-pane-surface-option.md)):
  Bis jetzt fiel das Pane auf die Chat-Farbe des `body` durch. Neu: Segment
  in Einstellungen → Individualisierung (`personal.paneSurface`) mit
  **Native Sidebar** (Default — exakt die Variable, die auch die eingebaute
  Sessions-Sidebar malt: `--ui-sidebar-surface-background`, inkl.
  Theme-/Glass-Varianten), **Chat** (bisheriger Look,
  `--ui-chat-surface-background`) und **Ohne** (kein eigener Fill,
  App-Durchblick). Umsetzung als `data-sf-panesurface`-Attribut auf
  `<html>` + deklarative CSS-Regeln; `clearPersonal()` räumt restlos auf
  (Dispose-Zustand = kein eigener Fill). i18n EN+DE.

### Tests
- Render-Smoketest: 18 neue Checks (`v1.20: …`) zur App-Nav-Zeile
  (Reihenfolge, Feature-Detect, Whitelist-Navigation, DE-Labels, Toggle)
  und 7 zur Pane-Fläche (Attribut-Spiegelung je Modus, Fallback,
  `clearPersonal`).
- Style-Test (Chromium): 4 Checks zur Nav-Zeilen-Geometrie (flex-wrap,
  24-px-Buttons, Reihen-Umbruch, Spacer) und 4 zur Pane-Fläche
  (gemessene Flächenfarben je Modus inkl. Dispose-Zustand);
  Test-Tokens `--ui-sidebar-surface-background`/`--ui-chat-surface-background`
  ergänzt.

### Fixed
- **Kanban-Schnellstart-Button erschien nicht**: Der Feature-Detect suchte
  nach `[data-tour="sidebar-nav-kanban"]` — der laufende Build namespaced
  Plugin-Beiträge aber als `sidebar-nav-kanban:nav` (live verifiziert; die
  Zeile existiert in der nativen Sessions-Sidebar). Der Detect matcht jetzt
  per Präfix `[data-tour^="sidebar-nav-kanban"]` und deckt beide Schemas ab;
  zweites Signal bleibt der offene Kanban-Drawer
  (`.kanban-drawer-content`). Live-Verifikation: `navBtns=6`,
  `data-kanban=on`, Labels `…|Kanban`.

### Added (2026-10-06, nachträglich)
- **Status-Pips auf der Schnellstart-Zeile** (Kanban + Geplante Jobs, Plan:
  [docs/plans/2026-10-06-nav-status-pips.md](docs/plans/2026-10-06-nav-status-pips.md)):
  Ein 7-px-Punkt oben rechts am Icon-Button zeigt den Aktivitäts-Zustand —
  **Kanban**: läuft (grün, `running`-Spalte), blockiert (rot), Review
  (amber), bereit (blau); **Geplante Jobs**: Fehler (rot), pausiert
  (amber), läuft/geplant (grün) — Zustandslogik 1:1 aus der App
  (`app/cron/job-state.ts` jobState) übernommen. Daten ehrlich über die
  App-Bridge (`/api/plugins/kanban/board`, `/api/cron/jobs`, 60-s-Poll,
  In-Flight-Guard); ohne Bridge/Fetch-Fehler kein Punkt (nie erfundene
  Zustände). Tooltip ergänzt die Zustands-Zeile („läuft: 2", DE/EN).

## [1.19.3] — 2026-10-05

### Added
- **Context-Window Bar-Style** (neue Darstellungs-Option neben dem
  bestehenden Donut): minimalistische horizontale Füll-Leiste in Höhe
  der Schrift, 28 × 0.8 em, ohne eingeblendete Prozent-Zahl — der
  Füllstand ist der Indikator, Tooltip + `aria-label` behalten die
  genaue Zahl für Hover und Screenreader. Einstellbar in
  Einstellungen → Sessions → Kontext-Stil (Donut | Bar), nur sichtbar
  wenn der visuelle Indicator-Toggle aktiv ist. Default bleibt Donut.
- **Einstellungs-Seite: Trennlinien + dezenter Hover** je Sektion:
  Zwischen zwei Sektionen wird ein weicher Gradient-Strich eingefügt
  (3 % Akzent → fade zu transparent an den Rändern), damit lange
  Settings-Spalten optisch die Zugehörigkeit halten. Hover auf einer
  Sektion tönt den Hintergrund mit 3 % Akzent und frischt das Icon
  des Section-Titels auf. `prefers-reduced-motion` schaltet die
  Transition ab.
- **Section-Überschriften lesbarer**: Font-size 12 px → 13 px,
  font-weight 600 → 700, Letter-spacing 0.015 em, Icon in Akzent-Farbe
  (statt gleich wie Text), Gap +1 px. Visuelle Hierarchie zwischen
  Section-Head und Content wird klarer.

### Tests
- 7 neue Checks (`v1.19.3: …`): Donut- vs. Bar-Mode-Rendering,
  `data-style`-Attribut, `aria-label`-Preservation, `--sf-ctx-pct`-
  Füll-Prozent, Prozent-Zahl in Donut vs. ausgeblendet in Bar.

## [1.19.2] — 2026-10-05

### Added
- **Pinned-Section als persistente Drop-Area** (`$dragActive`-Atom +
  `isDropPlaceholder`-Section-Flag): Sobald der User eine Session zieht,
  erscheint die „Angepinnt"-Sektion zuverlässig — auch wenn sie gerade
  leer ist. Vorher verschwand sie bei leerem Pin-Store komplett, man
  konnte nirgendwohin droppen. Jetzt zeigt die leere Sektion eine
  gestrichelte Platzhalter-Zeile mit Pin-Icon + `pinnedDropHint`-i18n-Key
  („Hier ablegen zum Anpinnen" / „Drop here to pin"). Window-globale
  `dragend`/`drop`-Fallbacks resetten `$dragActive` sicher, falls die
  Quell-Zeile zwischendurch unmountet (Rerender durch Refresh).
- **Drop-Ready-Hervorhebung während Drag** (`data-drop-ready`-Attribut
  + `sf-drop-ready-pulse` CSS-Keyframe): Alle Sektionen, die Drop
  akzeptieren (Pinned, Projekt, Gruppe, Ungrouped), bekommen während
  eines aktiven Drags einen sanft pulsierenden Akzent-Rahmen —
  Drop-Area wird visuell SICHTBAR statt im Scroll unterzugehen. Beim
  Hover schaltet das Pulsieren auf die bestehende, stärkere Hover-
  Hervorhebung um. `prefers-reduced-motion` deaktiviert die Animation.

### Fixed
- **Startup lädt alles ohne manuelles Aktualisieren** (`scheduleSettleIn`
  + Reconnect-Hook): Der erste Bootstrap läuft weiterhin an der Gateway-
  Socket-Öffnung. NEU: zwei getimte Nachläufe nach 1,8 s und 4,5 s
  ziehen jeden Teil-Satz (Sessions, Projekt-Baum, Pins, Live-Status)
  gezielt NUR dann nach, wenn er noch leer wirkt — kalte Server-Caches
  liefern beim ersten Hit gelegentlich unvollständige Antworten, der
  User musste danach manuell auf „Aktualisieren" klicken. Jetzt
  stehen alle vier Datensätze nach spätestens 5 s vollständig. Nach
  einem Reconnect (Standby-Resume, Gateway-Neustart) läuft derselbe
  Settle-In zusätzlich zu `reconnectRefresh()`.
- **`visibilitychange`-Listener für Tab-Wechsel** (zusätzlich zum
  bestehenden `window.focus`): Wird das Hermes-Fenster via Tab-Wechsel
  wieder sichtbar (ohne OS-Fokuswechsel), zieht die Pane die Listen
  gedrosselt nach — Pane bleibt nicht mehr „alt", wenn der User sie
  anklickt, ohne vorher das Fenster zu fokussieren.
- **Lifecycle-Cleanup erweitert**: Die neuen Window-Listener
  (`dragend`, `drop`, `visibilitychange`) werden im `onDispose`-Pfad
  sauber abgehängt.

### Tests
- 8 neue Checks (`v1.19.2: …`): Pinned-Placeholder (vor/während/nach
  Drag), `data-drop-ready`-Attribut, `pinnedDropHint`-i18n-Key,
  Settle-In-Refetch (Sessions + Projekt-Baum), `reconnectRefresh`.

## [1.19.1] — 2026-10-05

### Fixed
- **„+"-Button verankert die neue Session jetzt wirklich im Projekt**
  (`startNewSessionInCwd`): Der dokumentierte Fix aus v1.17.3 rief
  `session.workspace.move` auf — diese RPC existiert im Gateway nicht
  (nur `session.cwd.set`), der Call lief in ein stummes `catch{}`, und die
  Zuordnung wurde nie persistiert. Live in `~/.hermes/state.db` nachgewiesen:
  neue „+"-Sessions mit 30+ Turns ohne `cwd` und ohne `git_repo_root`.
  v1.19.1 ruft stattdessen den korrekt registrierten `session.cwd.set` mit
  der IN-MEMORY-`session_id` auf (nicht dem stored_session_key — das war
  der zweite Fehler) und schreibt cwd + Git-Repo-Root sofort über
  `_set_session_cwd` in die Row.
- **Drag&Drop auf Projekt-Header** (`moveSessionRow`): Gleicher
  RPC-Fehler, derselbe Fix. Neu: Lookup `storedSessionKey → runtime sid`
  via `$liveMap` + Fallback `session.active_list`-RPC, damit `session.cwd.set`
  die richtige In-Memory-ID bekommt. Für eine NICHT live aufgeschlagene
  Session hat der Gateway keinen Zuordnungs-RPC — hier bleibt der
  Overlay-Seed für sofortiges optisches Feedback, und ein Info-Toast
  (`moveSessionNotLive`) macht transparent, dass die Zuordnung erst beim
  nächsten Öffnen der Session dauerhaft wird.
- **Lautloser Fehlerpfad schließt sich**: Beide fehlgeschlagenen RPCs
  landen nicht mehr in `catch {}`, sondern in `console.warn('[session-flow]
  …')`. Ein künftiger Gateway-Vertragsbruch (umbenannte Methode, geänderte
  Params) wird jetzt in der DevTools-Konsole sofort sichtbar — nicht erst
  nach wochenlangem Rätselraten, warum Sessions „irgendwie Kein Projekt"
  anzeigen.
- **Sichtbarer Hinweis, wenn kein Projekt-Anker greift** (`noProjectAnchor`-
  Toast): Steht der Header-Scope auf „Alle Projekte" und ist weder ein
  `active_id` in `projects.list` noch eine zuordenbare `lastSessionCwd()`
  verfügbar, zeigte v1.19.0 nichts an — die Session landete stillschweigend
  in „Kein Projekt". v1.19.1 toastet: „Neue Session ohne Projekt-Anker —
  bitte Projekt in der Kopfzeile wählen."

### Tests
- 11 neue Checks (`v1.19.1: …`): RPC-Name + Param-Form stabilisiert,
  Overlay-Seed-Verhalten für beide Pfade, `findLiveSessionIdByKey`-
  Fallback-Chain ($liveMap → session.active_list → null). Jede der drei
  Bug-Oberflächen hat eine klare Regression-Guard-Zeile im Test-Harness.

## [1.19.0] — 2026-10-05

### Added
- **Sichtbares Ladeerlebnis** (`$loadPhase` + `.sf-load`-Block): Solange der
  erste Datensatz fehlt, zeigt die Pane einen animierten Ladebalken und einen
  Gateway-Hinweis („Sobald das Gateway die Sessions anzeigt, erscheinen
  Sessions und Projekte hier automatisch"). `loadPhase` läuft
  `gate`→`loading`→`ready`/`error` und wird vom bestehenden Bootstrap-Gate
  gespeist; der `prefers-reduced-motion`-Pfad respektiert. Vor 1.19.0 wirkte
  die Pane bis zum ersten `session.list` wie tot, jetzt liest sich die Warte-
  zeit als aktiv.
- **Projekte-laden-Pending-Sektion** (`buildSections()`-Fix): Solange der
  Projekt-Baum (`projects.tree`) noch keinen erfolgreichen Refresh
  verzeichnet (`projectsPending()`), wird nicht länger fälschlich in „Kein
  Projekt“ gruppiert (was die Wartezeit unnötig verlängert hätte). Stattdessen
  zeigt der Pane genau EINE Sektion mit dem i18n-Key `projectsPendingTitle`
  und dem Subtext-Hint `projectsPendingHint` („Sessions erscheinen sofort;
  die Projekt-Gruppierung folgt unmittelbar“). Sobald der Baum da ist,
  übernimmt die normale Projekt-Gruppierung. Sessions selbst sind von Anfang
  an sichtbar, weil der Pending-Pfad ALLE Zeilen in diese eine Sektion
  bündelt.
- **REST-First-Refresh** (`refreshSessions()`): Primärquelle ist jetzt
  `GET /api/sessions?…order=recent` über die Bridge — volle Zeilen mit
  `pinned`, `unread`, `archived`, `input_tokens/output_tokens`,
  `estimated_cost_usd/actual_cost_usd`, `last_active`, `tool_call_count`,
  `message_count`, `_lineage_root_id`. RPC-`session.list` (dünn) bleibt als
  Fallback für ältere Shells ohne die REST-Door. Sortierung nach Tokens/
  Kosten, Unread-Filter und Profil-Gruppierung funktionieren ohne weitere
  Gateway-Patches.
- **Filter-Parität mit der Hermes-Sidebar** (`view.*`-Settings): Sortierung
  (`updated`/`created`/`status`/`tokens`/`cost`), Status-Filter
  (`working`/`needs-input`/`unread`/`draft`/`idle` als Multi-Select),
  Projekt-Filter (Multi-Select aus der Projektliste), Zeilen-Meta
  (`showTokens`/`showCost`/`showProfile`-Badges), Archiviert-Modus (eigene
  Anzeige via REST `archived=only` + „Wiederherstellen“-Aktion pro Zeile,
  60-s-TTL-Cache), Status-Gruppierung (`autoMode:'status'`), „Alle ein-/
  ausklappen“ und „Alle als gelesen“ (Bulk-PATCH `unread:false`). Ansichts-
  optionen-Menü: Gruppierung + Sortierung + Status-Filter + Projekt-Filter
  + Zeilen-Meta + Bulk-Aktionen.
- **Projekt-Verwaltung in Session Flow** (Toolbar-Button „Neues Projekt“ +
  `ProjectDialog`): Erstellen/Bearbeiten mit Ordnern (nativem Picker via
  `selectPaths`), primärem Ordner, Farbe und Icon. Submit mappt auf
  `projects.create`/`update`/`add_folder`/`remove_folder`/`set_primary`.
  Löschen über `ConfirmDialog` (`projDeleteConfirmTitle`/
  `projDeleteConfirmBody`/`projDelete`/`projDeleted`).
- **Instant-Sync App↔Plugin** (`watchSidebarSync()`): MutationObserver auf
  den Sidebar-Container (`[data-sessions-mode]`, `data-sessions-project`)
  + `window`-focus ziehen Projekt-Baum und Sessions nach, mit 4-5-s-TTL-
  Guards gegen Spam. Plugin→App-Kick nach jeder Mutation: `window.focus`-
  und `document.visibilitychange`-Synthetisierung, auf die die App
  (`use-background-sync.ts`) reagiert. Verdratet in `register()` mit
  Disposer im `onDispose`-Block.

### Changed
- **`buildSections()` Projekt-Pfad umstrukturiert**: Der bisherige
  Pending-Guard (`!isNoProject && projectsPending() && items.length && !meta`)
  traf nie (alle Zeilen landen via `resolveSessionProject()` im
  `__no_project__`-Bucket, sobald der Baum leer ist) und zerstörte sogar
  gepushte Sektionen. Ersetzt durch einen expliziten
  „Projekte werden geladen“-Pfad, der die Sektion EINMAL pusht und die
  Schleife verlässt. Folge: keine fälschliche „Kein Projekt“-Sektion mehr
  während des Ladevorgangs.

### Tests
- Render-Smoketest v1.19.0: Toolbar-„Neues Projekt“-Button,
  `ProjectDialog`-Ruhezustand (kein sf-dialog im DOM bei `open:false`),
  Pending-Sektion (genau 1 Kopf, `projectsPendingTitle` + Hint im Subtext,
  echte Zeilen sichtbar, kein `noProject`-TCall), Lade-Phase-Rendering
  (`.sf-load`-Block, `data-phase=loading`, `loadingHint`-Key).
- Bootstrap-Gate-Regression: kein `session.list` vor `gateway=open`,
  Initial-Satz beim ersten `open`, Reconnect (`closed→open`) zieht nach.

### Docs
- Plan `docs/plans/2026-10-05-ladeerlebnis-projektverwaltung-filter-paritaet.md`
  (Status: Done, Verifikations-Evidenz im Block „Verifikation (evidenz)“
  ergänzt).

## [1.18.0] — 2026-10-05

### Added
- **Gateway-Bootstrap-Gate (Start-/Reconnect-Initialisierung)**: Der erste
  Daten-Satz (Sessions, Pins, Live-Status, Projekt-Baum) wird nicht mehr blind
  beim Plugin-Load gefeuert — vor dem ersten Socket-Open wirft jeder
  `host.request` ab („Hermes gateway unavailable“), wodurch beim App-Start
  Fehlerbanner + „Kein Projekt“-Gruppierung bis zum manuellen Aktualisieren
  standen. `bootstrapSessionData()`/`scheduleGatewayBootstrap()` koppeln den
  Initial-Satz an `host.state.gateway`: erstes `open` feuert den kompletten
  Satz (Session-Liste + Projekt-Zuordnung kommen gemeinsam), schon-offen beim
  Load (Hot-Reload) lädt sofort, ein 20-s-Fallback deckt ältere Builds ohne
  das Atom ab, und jeder spätere `closed→open`-Wechsel (Standby,
  Backend-Neustart) zieht Sessions + Live-Status automatisch nach — manuelles
  Aktualisieren ist damit obsolet. Tests: Gate-Sektion im Render-Smoketest
  (kein RPC vor `open`, Initial-Satz beim `open`, Reconnect-Nachziehen).
- **Fertig-Effekt (`tabs.doneFx`)**: Wenn eine Session fertig wird, glüht
  ihre Zeile einmal dezent auf und/oder wackelt kurz perspektivisch in der
  gewählten Achse (`tabs.doneFxAxis`: X/Y/Z) — Stärke über
  `tabs.doneFxStrength` (dezent/mittel/stark). Weitere Presets: Glanzstreifen
  („shine") und „pop". Auslösung in Echtzeit: `message.complete` stößt einen
  frischen Live-Poll an (Transition beschäftigt→ruhig im Poll); der Poll
  bereinigt die Aktivität fertig gewordener Sessions zugleich sofort
  (statt TTL-Latenz), sodass Statuspunkt und Effekt zusammen kommen.
- **Info-Zeile in allen Dichten**: Die animierte Aktivitäts-Zeile (aktueller
  Tool Call mit Namen bzw. Status „Denkt nach…"/„Schreibt…"/„Wartet auf
  Antwort") erscheint jetzt in JEDER Info-Dichte: `detailed` als eigene
  dritte Zeile unter der „zuletzt aktiv"-Info, `comfortable` und `compact`
  in der ZWEITEN Zeile — dort wird der Detail-Inhalt ausgeblendet, solange
  die Aktion läuft. Beim Wechsel schiebt die neue Info
  von unten hoch ein, die vorherige nach oben heraus (nur CSS). Tool-Namen
  und Status kommen jetzt in Echtzeit aus den Gateway-Events
  (`tool.generating`/`tool.start`/`tool.complete`/`reasoning.delta`/
  `message.delta`/`error`) — bisher war davon nichts verdrahtet.
- **„Aktiv"-Subtab als flache Liste**: zeigt nur noch laufende Sessions
  (oben) plus Sessions mit HEUTIGER Aktivität — ohne Gruppen-Kopfzeilen und
  ohne Sektionen. Alles andere wird ausgeblendet; Zähler („x von y") und
  Leerzustand greifen jetzt auch im Aktiv-Modus.

### Changed
- **Live-Kennzeichnung neu verteilt — Schiene auf die aktive Auswahl**:
  „Aktiv ohne Auswahl" zeigt jetzt NUR den Rahmen (Inset-Ring) und lässt
  den Hintergrund komplett unangetastet (der Verlauf aus v1.17.2 entfällt).
- **Glass: Modell-/Thinking-Pillen nur noch Text + Icon**. Hintergrund,
  Gradient, Ring und der umlaufende Glow (`sf-arc-turn`) auf den
  Pills (`[data-tour='model-pill']`, `[data-testid='reasoning-pill']`)
  sind per Default aus. Werksstandard `glass.scopes.chips = false`; für
  bestehende Installationen wird der Wert beim nächsten Start einmalig
  zurückgesetzt. Wer den Frosted-Look wieder möchte, schaltet die Option
  in den Glass-Einstellungen manuell wieder ein.
- **Hintergrund-Bild/Video wird jetzt zuverlässig angezeigt**. Der
  `.sf-bg-layer` lag mit `z-index: -1` UNTER der Hintergrund-Farbe der
  Chat-Surface (`bg-(--ui-chat-surface-background)`, in den meisten
  Themes opaque) — der Layer wurde also von der Chat-Surface übermalt
  und blieb unsichtbar. Fix: `z-index: 0` (Layer über der Parent-BG)
  und `insertBefore(target.firstChild)` (DOM-Ordnung hält den Layer
  HINTER positionierten Geschwistern = Chat-Inhalt). Auswahl + Dimmer
  bleiben unverändert.
- **Hintergrund-Bilder werden jetzt geladen (Desktop-Protokoll)**.
  `hermes-media://stream/…` lehnte Bild-Endungen mit HTTP 415 ab und
  lieferte für bekannte Endungen `application/octet-stream` (Chromium
  lädt dann nichts). Fix in `electron/media-protocol.ts` (Erlaubnis-Liste
  um `.png/.jpg/.jpeg/.webp/.gif/.avif/.apng/.bmp/.svg`) und in
  `electron/media-range.ts` (`MEDIA_MIME` um die passenden
  `image/*`-Typen). Tests in beiden Suites decken den Pfad ab.
- **Hintergrund-Videos: Autoplay robust gegen „Standbild"**. Das
  `<video>`-Element bekommt `muted/loop/autoplay/playsinline` jetzt
  sowohl als DOM-Property ALS AUCH als HTML-Attribut, und `play()`
  wird nach `loadeddata` erneut angestoßen — das erste `play()` fällt
  oft in den Lade-Puffer und zeigt sonst nur Frame 1.

### Intern
- Style-Test: Fixture-Zeile „Liste aktiv+ausgewählt" (`l5`) ergänzt; Sektion
  15 prüft Rahmen-only (Hintergrund identisch zur normalen Zeile; Schiene
  nur an der aktiven Auswahl als `::before`), Sektion 4 auf „nur Rahmen".
- Tests (Aktiv-Flat + Fertig-Effekt): Render-Sektion 23 auf die Flat-Semantik
  umgestellt (nur beschäftigt + heute, keine Sektionen), Sektion 25 prüft die
  Poll-Transition (working→idle → doneFx; kein Fehl-Feuern bei Weiterlaufen).
  Style-Test Sektion 16: Glow/Wobble-Achsen/Stärke/Shine (Fixtures l6/l7).
- Tests (Info-Zeile): Render-Sektion 26 (Zeile nur in Detailreich, Tool-Label,
  Ausblend-Knoten, Position nach der Detail-Zeile, keine Phantom-Zeile ohne
  Aktivität); Style-Test Sektion 17 (Flex-Zeile, sf-info-in/-out, Klipp-Höhe).
- Tests (Dichte-Zeile): Render-Sektion 27 (Komfortabel/Kompakt belegen die
  zweite Zeile und blenden die Detail-Zeile aus, solange die Aktion läuft;
  Detailreich behält Details + eigene Extra-Zeile).

## [1.17.2] — 2026-10-05

### Changed
- **Live-Hintergrund klar von der Auswahl abgesetzt** — aktive (arbeitende/
  wartende) Zeilen tragen mit `tabs.rowLive` jetzt einen Richtungs-Verlauf
  mit linker Live-Schiene statt einer flächigen Akzent-Tönung. Bisher lagen
  „aktiv" (Akzent 9 %, flach) und „ausgewählt" (Akzent 16 %, flach — bei
  `selTint: accent`) so dicht beieinander, dass beide auf einen Blick kaum
  zu unterscheiden waren. Die Verlaufs-Form (Schiene links, auslaufend nach
  rechts) trennt die Zustände nun deutlich, auch wenn beide denselben
  Akzent-Farbton verwenden. Wartende Zeilen (Bernstein) bekommen dieselbe
  Form; Ring, Puls und Live-Frame bleiben unverändert. Wirkt in Liste & Grid.

### Intern
- Style-Test (Sektion 15): Aktiv-Zeile (Liste + Grid) beginnt mit
  `linear-gradient(90deg …)` (Schiene + Verlauf, 2× 90deg), Auswahl-Zeile
  bleibt flach.

## [1.17.1] — 2026-10-05

### Changed
- **Schnellfilter „Aktiv" sortiert jetzt, statt herauszufiltern** — der
  Subtab zeigt weiterhin ALLE Sessions (aktive und inaktive), ordnet die
  Liste aber absteigend nach der letzten Aktivität: Live-Liste
  (`last_active`) → zuletzt gesehenes Gateway-Event → Startzeit. Aktive
  Sessions stehen dadurch automatisch oben; nichts verschwindet mehr aus
  der Liste. Die Textsuche kombiniert sich unverändert; Zähler und
  Leerzustand werten nur noch die Suche als aktiven Filter. `Alle` bleibt
  die Startzeit-Reihenfolge.

### Intern
- Render-Smoketest (Sektion 23): Aktiv-Modus zeigt alle Zeilen, hebt die
  Live-Session nach oben (frisches `last_active` schlägt alte Startzeit)
  und fällt ohne Live-/Event-Daten sauber auf die Startzeit zurück.

## [1.17.0] — 2026-10-05

### Added
- **Angepinnt als eigene Gruppen-Sektion** — gepinnte Sessions erscheinen
  jetzt IMMER als erste, einklappbare Sektion (wie „Pinned" in Hermes
  Desktops Sidebar), statt nur über den bisherigen (leeren) Schnellfilter
  erreichbar zu sein. Eine gepinnte Zeile erscheint ausschließlich dort,
  nicht zusätzlich in Datums-/Quell-/Projekt-Gruppen.
- **Drop-Area „Anpinnen"**: Beim Ziehen einer Zeile in List/Grid-View wird
  die Angepinnt-Sektion zur Drop-Zone (Highlight + „→ Anpinnen"-Hinweis);
  Loslassen pinnt die Session wirklich (`host.sessions.pin`) und zieht den
  REST-Spiegel sofort nach. Gleicher Wirksamkeits-Weg wie der
  Kontextmenü-Eintrag „Anpinnen/Loslösen".
- Pin-Datenquelle (nun wirklich funktional): `session.list` liefert kein
  `pinned` pro Zeile — die Flagge wird über den REST-Spiegel
  (`GET /api/sessions`, inkl. Backfill gepinnter Rows jenseits des
  Listen-Limits) in `refreshSessions()` gemerged; Spiegel-Refresh beim
  Laden, nach Session-Aktualisierungen (5 s Mindestabstand) und sofort
  nach jeder Pin-Aktion.
- Kontextmenü: „Anpinnen"/„Loslösen" je aktuellem Zustand der Zeile.

### Changed
- Der Schnellfilter „Angepinnt" in der Filterleiste ist ENTFERNT (die
  Sektion + Drop-Area ersetzen ihn); übrig bleiben „Alle"/„Aktiv" + Suche.
- Angepinnt-Sektionskopf: KEIN Caret-Pfeil — das Pin-Glyph übernimmt die
  Auf/Zu-Optik, ein zusätzliches Dreieck wäre doppelt (Anforderung).
  Hover-Action „Alle lösen" (clear-all-Icon) im Kopf.

### Fixed
- „Angepinnt"-Filter war leer, weil `row.pinned` aus `session.list` immer
  `false` war (Wire-Feld fehlt — gleiche Ursache wie der ehemalige
  cwd/Projekt-Gruppierungs-Bug in 1.16.2).

## [1.16.2] — 2026-10-04

### Fixed
- **1.16.1 reichte nicht — `session.list` liefert gar keine `cwd`/
  `git_repo_root` pro Session.** Grund für den Diagnose-Fehlschlag: ich
  hatte den Client-seitigen Pfad-Abgleich aus 1.16.1 auf Basis der
  `SessionInfo`/`ProjectInfo`-TS-Typen in `hermes-agent` entworfen, ohne zu
  prüfen, welche Felder die tatsächlich benutzte RPC (`session.list`)
  liefert. Direkter Blick in den Gateway-Quelltext
  (`tui_gateway/methods_session.py`, Funktion `_session_row_summary`, die
  jede `session.list`-Zeile baut) zeigt: sie gibt NUR `id`, `title`,
  `preview`, `started_at`, `message_count`, `source` zurück — `cwd` und
  `git_repo_root` fehlen komplett. `normalizeRow()`/`row.cwd` waren also
  für die Gruppierung von Anfang an leer; kein Pfad-Algorithmus, egal wie
  genau er Hermes Desktop nachbaut, kann auf leeren Daten etwas treffen.
- **Fix**: nicht mehr selbst zuordnen — direkt bei der Quelle fragen, die
  Hermes Desktops eigene Sidebar auch benutzt: `projects.tree`
  (`tui_gateway/methods_projects.py` → `project_tree.build_tree()`). Jeder
  `ProjectTreeNode` trägt bereits `sessionIds: string[]` — die vollständige,
  serverseitig autoritative Liste aller Session-IDs dieses Projekts
  (explizite Projekte UND Auto-Projekte per Git-Repo-Root, derselbe Baum,
  den die Desktop-Sidebar für ihre Projekt-Übersicht aufbaut). Session Flow
  lädt diesen Baum jetzt per `refreshProjectsList()` und schlägt pro
  Session nur noch deren ID nach (`resolveSessionProject()`) — kein
  Pfadvergleich mehr nötig.
- `$projectsList` speichert jetzt `{id, label, color, icon, isAuto,
  isNoProject, path, sessionIds:Set}` je Knoten statt `{name, folders}`.
  Die clientseitigen Helfer `pathSegments()`/`isPathUnder()`/`basenameOf()`
  aus 1.16.1 sind komplett entfernt — toter Code, seit die Zuordnung nicht
  mehr pfadbasiert ist.
- Neue Render-Tests (4 Checks, Block 21): Session ohne CWD wird über ihre
  ID gefunden; explizites Projekt mit eigenem Namen wird gefunden;
  `isNoProject`-Knoten fällt in „Kein Projekt"; eine Session-ID, die in
  KEINEM Knoten auftaucht, fällt ebenfalls in „Kein Projekt".
- Bekannter Nebenbefund (nicht in diesem Fix behoben, siehe Plan-Datei):
  `branch`/`model`/`toolCount`/`pinned` fehlen aus demselben Grund
  ebenfalls in jeder `session.list`-Zeile — diese Anzeigen zeigen aktuell
  immer ihren Default-Wert.

## [1.16.1] — 2026-10-04

### Fixed
- **Projekt-Ordner-Gruppierung zeigte fast immer nur „Kein Projekt"** — die
  Bucketing-Logik verglich bisher nur `session.cwd` wortwörtlich gegen
  `project.primary_path`. In der Praxis greift das kaum: viele Sessions
  tragen inzwischen gar keine `cwd` mehr, nur noch den vom Backend
  aufgelösten `git_repo_root` (`types/hermes.ts`: „The sidebar groups by
  this instead of probing git in the GUI."); Projekte haben oft keinen
  `primary_path`, sondern nur eine `folders[]`-Liste; und Hermes selbst
  gruppiert auch Sessions ganz ohne projects.db-Eintrag automatisch nach
  ihrem Repo-Root. Session Flow portiert jetzt denselben Algorithmus wie
  Hermes Desktops eigene Sidebar (`liveSessionProjectId` aus
  `app/chat/sidebar/projects/workspace-groups.ts`):
  - Explizites Projekt mit dem längsten passenden Ordner-Präfix gewinnt —
    geprüft werden ALLE Ordner eines Mehrordner-Projekts, gegen CWD UND
    Git-Repo-Root, nicht nur `primary_path`.
  - Archivierte Projekte werden übersprungen.
  - Ohne Treffer wird der Git-Repo-Root selbst zur Auto-Projekt-Identität
    (Name = Ordnername), genau wie bei einem nicht in projects.db
    eingetragenen Git-Checkout in Hermes Desktop.
  - Bewusste Abweichung von Hermes: eine Session, die sich über keinen der
    beiden Wege platzieren lässt, verschwindet bei uns NIE aus der Liste —
    letzter Ausweg ist die rohe CWD als eigene Gruppe (altes Verhalten).
- `normalizeRow()` liest jetzt zusätzlich `git_repo_root` ein.

## [1.16.0] — 2026-10-04

### Added
- **Projekt-Ordner-Gruppierung übernimmt jetzt Name, Farbe UND Icon** aus
  dem Hermes-Projekt-Datensatz (`projects.list`) — genau wie unter „Projekte"
  in Hermes Desktops eigener Sidebar: ein Projekt mit eigenem Icon zeigt
  dieses Icon (optional in der Projektfarbe eingefärbt) statt des
  generischen Ordner-Symbols; ein Projekt mit Farbe, aber ohne eigenes Icon,
  zeigt einen Farbpunkt wie bei manuellen Gruppen. Ohne Anpassung bleibt der
  bisherige Ordner-Auf/Zu-Icon-Wechsel bestehen.
- `projects.list`-Fallback erweitert: Projekte ohne `primary_path`
  (Mehrordner-Setups) werden jetzt über ihren ersten Ordner gefunden, statt
  aus der Zuordnung zu fallen — betrifft gerade die Projekte, die am
  ehesten eine eigene Farbe/ein Icon tragen.

## [1.15.1] — 2026-10-04

### Changed
- **Info-Dichte „Komfortabel“ rendert einspaltig** (Listen-Ansicht): Die
  rechte Meta-Spalte (Zähler · Zeit · Kontext-Indikator, ggf. Quelle) wandert
  als letzte Zeile unter den Text — Titel, Detail-Zeile und Meta laufen in
  einer Spalte. Detailreich behält die zwei Spalten; im Grid lagen die
  Meta-Infos schon immer unter dem Text (unverändert).

### Intern
- Render-Smoketest: Layout-Checks für das Einspaltig-Layout (Inline-Meta im
  Textblock bei Komfortabel, rechte Spalte bei Detailreich, Grid unverändert).
- Style-Test (Chromium): Inline-Meta-Zeile ist eine Flex-Zeile mit 3 px
  Abstand direkt unter der Detail-Zeile; das alignTop-Padding gilt dort nicht.

## [1.15.0] — 2026-10-04

### Added
- **Kopfzeilen-Dichte** (`groups.headerDensity: 'compact'|'comfortable'|
  'detailed'`, Default `comfortable`): Sektions-/Gruppen-Kopfzeilen (Datum,
  Quelle, manuelle Gruppe, Projekt-Ordner) sind jetzt größer & fetter gesetzt
  (12–13px/700 statt 11px/600) und zeigen optional eine zweite Zeile —
  Projekt-Gruppen den gekürzten Ordnerpfad als Subzeile (voller Pfad bleibt
  im Tooltip), „Detailreich" zusätzlich eine Angepinnt-/Aktiv-Kennzahl, wenn
  die Sektion tatsächlich welche enthält. Die Zeile wächst nur bei
  vorhandener Subzeile auf zwei Zeilen; `compact` behält die alte,
  einzeilige Optik bei.
- **Ansichtsoptionen-Icon** (list-filter) in der Pane-Toolbar: öffnet ein
  Menü mit Gruppierung, Kopfzeilen-Dichte und „Nicht gruppiert"-Toggle direkt
  aus der Pane — dieselben drei Optionen wie auf der Einstellungsseite, ohne
  dorthin wechseln zu müssen. Spiegelt Hermes Desktops Sidebar-Filter-Icon
  (`list-filter`, aus `filter-menu.tsx`) in Form und Platzierung.
- Neue Settings-Zeile für `groups.headerDensity` (Segment compact/
  comfortable/detailed).

### Fixed
- Das neue Ansichtsoptionen-Menü öffnete sich in der echten App gar nicht:
  `Tip` saß zwischen `DropdownMenuTrigger asChild` und dem eigentlichen
  Button — Radix kann den Ref durch einen zusätzlichen Wrapper nicht
  durchreichen (derselbe dokumentierte Pitfall wie bei Popover-Triggern).
  Der Button ist jetzt direktes Trigger-Kind, wie bei der bereits
  funktionierenden Zeilen-„⋯"-Aktionsmenü (`moreRowMenu`); die Tooltip-
  Beschriftung läuft stattdessen über `title`.

## [1.14.0] — 2026-10-04

### Added
- **Projekt-Ordner-Gruppierung** (`groups.autoMode: 'project'`): Sessions
  gruppieren sich nach ihrer CWD — Label kommt aus `projects.list` (Name)
  oder fällt auf den Ordnernamen zurück. Der Gruppen-Header übernimmt die
  Optik der Hermes-Desktop-„Projekte"-Collapsibles: Ordner-Icon statt Punkt,
  Caret erst beim Überfahren sichtbar, Hover-„+" startet eine neue Session
  direkt in diesem Projekt.
- **Drag & Drop verschiebt wirklich ins Projekt:** Ein Tab auf einen
  Projekt-Ordner-Header gezogen ruft `session.workspace.move` auf — keine
  reine Anzeige-Zuordnung, sondern dieselbe Aktion wie „In Projekt
  verschieben…". Ziel-Hervorhebung (Rahmen + Tönung auf Header **und**
  Section) und ein Inline-Zielhinweis („→ Nach „X" verschieben") zeigen
  während des Ziehens exakt, was ein Loslassen bewirkt; die gezogene Zeile
  bekommt Dashed-Outline + Skalierung + Grabbing-Cursor, ein erfolgreicher
  Drop quittiert mit einem kurzen Akzent-Flash auf der Zielzeile
  (`prefers-reduced-motion`-sicher).
- **Filter-Leiste** in der Session-Flow-Pane: Textsuche (Titel/Branch/
  Vorschau) + Schnellfilter Alle/Angepinnt/Aktiv — rein clientseitig, wie im
  Vorbild der Hermes-Sessionliste. Leere Treffermenge zeigt einen eigenen
  Hinweis statt des „keine Sessions"-Leerzustands.
- **Neue Einstellung `tabs.asTabSelector`:** Blendet die native
  Content-Tab-Leiste für Session-Tabs aus (strukturell über `:has()` — nur
  Streifen mit mindestens einem Session-Tile-Tab, Terminal/Dateien bleiben
  unberührt), wenn die Liste/das Grid dieselbe Navigation schon abdeckt.

### Changed
- **Info-Dichte klarer abgestuft.** Komfortabel zeigt jetzt einen größeren Titel
  (13 px), lockerere Abstände zum Subtext (4 px) und eine reichere Detail-Zeile:
  Modell · Nachrichten · „zuletzt aktiv“ — Modell und Recency kommen für
  laufende Sessions aus `session.active_list`; Detailreich legt zusätzlich die
  Vorschau-Zeile und (nur wenn der Kontext-Donut aus ist) eine Stats-Zeile mit
  der Kontext-Auslastung als Text an. In Detailreich brechen Detail- und
  Vorschau-Zeile außerdem auf bis zu zwei Zeilen um (Line-Clamp 2) statt
  einzeilig abzuschneiden. (Plan: `docs/plans/2026-10-04-info-dichte-abstufung.md`)
- **Datenlage-Befund:** `session.list` liefert derzeit nur
  id/title/preview/started_at/message_count/source. `git_branch`, `model` und
  `tool_call_count` erreichen das Plugin nicht — Branch und Tool-Zähler zeigen
  daher nur, falls das Gateway sie künftig mitliefert (das Modell wird für
  laufende Sessions aus der Live-Liste nachgereicht). Live verifiziert:
  Zeilen rendern `data-density`, Titel 13/18 px, Detail-Zeile z. B.
  „deepseek-flash · 152 Nachrichten · zuletzt aktiv 11m“ (App-Dichte komfortabel).

### Intern
- Render-Smoketest um Dichte-Checks erweitert (data-density je Stufe,
  Detail-/Stats-Zeilen, „zuletzt aktiv“ nur für Live-Sessions, Kontext-Stats
  nur bei Detailreich + Donut aus) sowie um v1.14.0-Checks (Projekt-Header,
  Filter-Leiste, neue Einstellungs-Zeilen). Der Computed-Style-Test (Chromium)
  sichert zusätzlich den Umbruch: Detail-/Vorschau-Zeile zweizeilig bei
  Detailreich, einzeilig bei Komfortabel.
- Neuer Store `$projectsList` (Projekt-Cache aus `projects.list`, 60-s-Poll)
  als Grundlage der Projekt-Gruppierung.
- Dokumentations-/Planungssystem eingeführt: `docs/AGENT-GUIDE.md` (Einstiegspunkt für
  Mensch & Agent), `docs/PLANNING.md` (Plan-Prozess + Template) und
  `docs/plans/` (abgeschlossene/offene Einzelpläne) — siehe dort für den
  vollständigen Plan dieser Version.


## [1.13.4] — 2026-10-04

### Fixed
- **Arbeits-Indikator in der Session-Liste war unsichtbar** (Liste **und** Grid): Der
  Aktivitäts-Glyph für „arbeitet"/„denkt" wurde mit dem Namen `sync~spin` an die
  App-Icon-Komponente übergeben. Die kennt den `~spin`-Marker NICHT (sie erwartet den
  `spinning`-Prop) — es entstand die unbekannte Klasse `codicon-sync~spin`, das Icon
  rendert mit 0×0 und war damit komplett unsichtbar. Ein Wrapper trennt jetzt den
  Marker ab, übergibt `spinning` und setzt zusätzlich die Fallback-Klasse
  `sf-icon-spin` (CSS-Drehung), damit der Indikator auch mit SDK-Builds ohne den Prop
  dreht. Live verifiziert: Icon 14×14, Klasse
  `codicon codicon-sync codicon-modifier-spin sf-icon sf-icon-spin`, Akzentfarbe +
  Glow-Ring an der arbeitenden Zeile.
- Statische Status-Glyphen (Glocke/Wartend, Haken/Erledigt, Fehler, Kreis/Leerlauf)
  waren nicht betroffen und sind unverändert.

### Intern
- Render-Smoketest prüft die Glyph-Erzeugung je Status: kein `~` im Namen,
  `spinning`-Prop gesetzt, Fallback-Klasse vorhanden — plus die neutralen Fälle
  (Leerlauf, Wartend) als Regressionsschutz.

## [1.13.3] — 2026-10-04

### Removed
- **Content-Abgrenzung komplett entfernt.** Die Option samt Rahmen, Radius, Abstand,
  Schatten, Kontur und Geltungsbereich ist raus — das Plugin fasst den Pane-Inhalt
  nicht mehr an (kein Padding, kein Overlay, keine `--sf-shell-*`-Variablen). In
  bestehenden Einstellungen gespeicherte Werte werden ignoriert.

### Changed
- **Kontext-Anzeige ist jetzt ein Donut:** Der Ring (Außenkreis = Füllstand) hat ein
  ausgespartes Loch in der Mitte, durch das die Zeilenfläche scheint; die Zahl steht
  frei im Loch (weiterhin mit mehrlagigem Text-Schatten). Technik: Ring als
  `::before` mit `z-index:-1` im eigenen Stacking-Kontext (`isolation:isolate`) plus
  radialer Maske (transparent bis 50 %, Ring ab 52 %) — so liegt der Ring über der
  Elementfläche, aber unter der Zahl.
- **Listen-Ansicht: der Kontext-Donut steht ganz rechts am Ende** (nach der Zeit).
  In der Grid-Ansicht bleibt die Reihenfolge (Donut vor der Zeit) unverändert.

### Intern
- Render-Smoketest prüft, dass die Abgrenzung wirklich weg ist (keine Rahmen im DOM,
  keine Shell-Attribute, keine `--sf-shell-*`-Wirkung); Style-Test prüft die
  Donut-Maske (Loch 50 %/Ring ab 52 %), `isolation`, die neutralisierten
  Shell-Regeln und behält die Hintergrund-Checks.

## [1.13.2] — 2026-10-04

### Fixed
- **Kontextfenster-Wert besser lesbar**: Die Prozentzahl über dem Torten-Diagramm
  bekommt einen **mehrlagigen Text-Schatten** (dunkle Kontur + weicher Glow an allen
  Seiten), etwas mehr Fläche (24 px) und kräftigere, kontrastreichere Füllfarben
  (Bernstein `#d97706`, Rot `--destructive`) — lesbar auch auf hellen Füllungen und
  im hellen Theme.
- **Chat-Hintergrund (Bild/Video) wurde nicht angezeigt**: Die Injektion zielte auf
  `[data-pane-host]` — diesen Marker tragen nur Keep-Alive-Panes (z. B. das
  Plugin-Pane selbst); die Chat-/Arbeitsbereich-Panes haben ihn nicht, also wurde nie
  ein Layer gesetzt. Zusätzlich deckte die opake Chat-Fläche
  (`--ui-chat-surface-background`) alles ab. Jetzt liegt der Layer direkt in jeder
  sichtbaren **Chat-Surface** (`[data-chat-surface]`, stabiler App-Marker) — deren
  `isolate`-Kontext lässt ein `z-index:-1`-Kind sauber über der Fläche und unter dem
  Inhalt zeichnen. Der Geltungsbereich **„alle"** setzt zusätzlich Layer in Zonen ohne
  Chat-Surface und schaltet deren Fläche transparent (Variablen-Override), damit der
  Layer sichtbar wird. Videos laufen als `<video>` im Layer (stumm, loop, autoplay,
  `object-fit` = Darstellung).
- **Content-Abgrenzung** nutzt dieselben Anker: Der Rahmen sitzt jetzt auch an
  Chat-Surfaces (bzw. Pane-Hosts und chat-losen Zonen bei „alle") und setzt den Inhalt
  per Innenabstand ein — vorher nur an Plugin-Panes.

### Intern
- **Render-Smoketest** deckt die Hintergrund-Injektion über das Mini-DOM ab (Layer an
  der Chat-Surface, Scope-Wechsel inkl. Zonen, `<video>`-Element, vollständiges
  Aufräumen) sowie die neuen Rahmen-Anker.
- **Computed-Style-Test** prüft den mehrlagigen Text-Schatten, die Pie-Größe, den
  `z-index:-1` des Layers und den Transparenz-Override am echten Chromium.

## [1.13.1] — 2026-10-04

### Fixed
- **„Content-Bereich abgrenzen" wirkte nicht**: Der Rahmen lag auf dem Pane-Host,
  dessen Box per `anchor-size` exakt der Pane-Fläche entspricht — die Kontur klebte
  dadurch am Sash/Fensterrand, der Schlagschatten wurde vom `overflow:hidden` des
  Pane-Bodys abgeschnitten, und es gab keinen Abstand. Der Rahmen ist jetzt ein
  **Overlay im Pane-Body** (Geschwister des Pane-Hosts: scrollt nicht mit, bleibt
  deckungsgleich mit dem eingesetzten Bereich, `pointer-events:none`), und der
  Inhalt wird um den neuen Abstand eingesetzt.

### Neu
- **Abstand px** (`personal.shellPad`, 0–32, Standard 8): Innenabstand des
  Content-Bereichs vom Layout-Rand — gibt zugleich dem Schlagschatten Platz
  (größerer Abstand = sichtbarerer Schatten).

### Intern
- **Render-Smoketest**: prüft die Overlay-Injektion über ein Mini-DOM — ein Overlay
  je Pane-Body, idempotent, Scope `chat` nur für Session-Tiles, vollständiges
  Aufräumen bei „aus" samt Variable.
- **Computed-Style-Test**: prüft am echten Chromium Inset, feine Kontur, Schlag-
  schatten, Radius und Klick-Durchlässigkeit des Overlays.

## [1.13.0] — 2026-10-04

### Neu
- **Text oben ausrichten** (`tabs.alignTop`, Standard an): Text-Spalte und Meta-Infos
  sitzen am Zeilenkopf statt vertikal zentriert — wie die Session-Zeilen der App.
- **Kontextfenster als Torten-Diagramm** (`tabs.ctxPie`, Standard an): Der Wert liegt
  mit Text-Schatten über einem kleinen Pie (`conic-gradient`, Farbstufen ab 70 %/90 %
  wie bisher). Aus = reines Prozent-Label.
- **Farb-Picker + Deckkraft**: Jede Design-Farbe (Zeilen-/Titel-Verlauf, Auswahl-Farbe,
  persönlicher Akzent) hat jetzt einen **nativen Farb-Picker** zusätzlich zu Swatches und
  Hex-Eingabe; die Deckkraft bleibt über den 0–100-%-Regler einstellbar und überlebt
  einen Farbwechsel.
- **App-States übernommen — glühender Rahmen & Anhebung**: `tabs.liveFrame`
  (Aus / Statischer Ring / **Glühender Ring**) zeichnet arbeitenden & wartenden Einträgen
  den umlaufenden Glow-Ring der App (gleiche Technik wie `.arc-border`; respektiert
  `prefers-reduced-motion` und die Animations-Pausierung). `tabs.hoverLift` (Standard an)
  hebt Zeilen und Karten beim Hover leicht an und vertieft den Schlagschatten.
- **„Übernehmen" im sticky Menü**: Der sticky Kopf der Einstellungsseite hat rechts einen
  Button, der Änderungen **sofort persistiert** (überspringt die 350-ms-Debounce) und alle
  Effekte neu anwendet. Ein Akzent-Punkt zeigt ungespeicherte Änderungen, der Klick
  quittiert mit „Gespeichert".

### Intern
- **Computed-Style-Test auf 40 Checks erweitert**: Text-Ausrichtung, Kontext-Pie
  (conic-gradient, Text-Schatten, Größe, Listen/Grid-Parität), Live-Glow-Ring
  (`::after` + `sf-arc-turn`) und Hover-Anhebung (`transform: …0,-1`). Neue
  `settle()`-Hilfe: die Layout-Transition (130 ms) lässt `getComputedStyle` unmittelbar
  nach einem Zustandswechsel den Start-Wert liefern — gemessen wird erst nach dem
  Auslaufen.
- **Render-Smoketest erweitert**: neue Attribute inkl. `liveFrame`-Fallback, die neuen
  Optionszeilen, 6 Farb-Picker, genau ein Save-Button und der Übernehmen-Klick
  (persistiert + wendet an, kein Crash).

## [1.12.0] — 2026-10-04

### Neu
- **Auswahl: Hover-Stufe**: Neue Option „Auswahl: Hover" (`tabs.selHover`) —
  bestimmt, wie der ausgewählte Eintrag auf Hover reagiert: **Verstärken**
  (Standard; Tönung vertieft, z. B. 16 % → 24 %), **Stark** (36 %) oder
  **Unverändert** (Auswahl bleibt exakt beim konfigurierten Design).
- **Alpha in Verläufen**: Verlaufsfarben (Zeilen-/Titel-Verlauf) und die
  Auswahl-Farbe akzeptieren jetzt 8-stelliges Hex `#RRGGBBAA` — Verläufe
  können transparent auslaufen. Die Farbzeilen erhalten dafür einen
  Alpha-Regler (0–100 %); ein Swatch-Klick behält den eingestellten Alpha-Wert.

### Fixed
- **Grid-Parität (Liste == Grid)**: Die Grid-Kartenansicht übernahm die
  Design-Optionen nicht — Karten-Flächen (Standard, Hover, Aktiv) hatten per
  Spezifität Verlauf, Auswahl-Tönung und Live-Status überschrieben. Die
  Flächen laufen jetzt über `:where()` (null-spezifisch): **alle**
  Design-Optionen wirken identisch in Liste UND Grid (im Computed-Style-Test
  zeilenweise abgesichert).
- **Auswahl-Zustand über dem Verlauf**: Die Auswahl-Tönung (Standard/Akzent/
  Eigene Farbe) liegt jetzt als Layer ÜBER dem Zeilen-Verlauf — der
  konfigurierte Verlauf bleibt auch im ausgewählten Zustand sichtbar (vorher
  ersetzte die Tönung den Verlauf). Ebenso der Live-Status (Akzent-Layer
  über Verlauf statt Ersatz).
- **Hover auf der Auswahl**: Die Verlaufs-Brightness überschreibt den
  Auswahl-Zustand nicht mehr — das Hover-Feedback folgt der neuen
  `selHover`-Stufe.

### Intern
- **Computed-Style-Test**: `tests/style-test.mjs` (optional, Playwright/
  Chromium) extrahiert die echte CSS aus `plugin.js` und prüft am echten
  Chromium die **berechneten Styles** — Liste-vs-Grid-Parität, Alpha-Werte,
  Auswahl-Layer, Hover-Stufen, „Design aus". Skip ohne Playwright
  (CI-sicher); Aufruf: `npm run test:style` bzw.
  `PLAYWRIGHT_PKG=… node tests/style-test.mjs`.
- **Render-Smoketest erweitert**: prüft zusätzlich den `selHover`-Mirror
  (`data-sf-selhover` inkl. Fallback) und Alpha-Hex in `applyRows()`.

## [1.11.0] — 2026-10-04

### Neu
- **Max. sichtbare Einträge (je Gruppe)**: Neue Option „Max. sichtbare Einträge" —
  zeigt je Gruppe höchstens N Sessions (Liste **und** Grid); der Rest
  verschwindet hinter einem **„Mehr anzeigen (n)"**-Button, der ihn einblendet
  (erneuter Klick: „Weniger anzeigen"). `0` = aus (alles anzeigen). Ohne
  Gruppen entspricht die Grenze der Gesamtliste.

### Intern
- **Render-Smoketest im Repo**: `tests/render-test.mjs` rendert Sessions-Pane
  und Einstellungsseite headless gegen SDK-Stubs (inkl. Klick-Simulation für
  „Mehr anzeigen"); Aufruf über `npm test`, läuft auch in der CI. READMEs,
  CONTRIBUTING, DEVELOPMENT, APP-INTEGRATION und PR-Template entsprechend
  aktualisiert.

## [1.10.0] — 2026-10-04

### Neu
- **Kontextfenster-Info (kompakt)**: Neue Option „Kontextfenster" — je Zeile/Karte
  einer LIVE-Session zeigt ein reduziertes Prozent-Label die Auslastung des
  Kontextfensters (read-only `session.context_breakdown`; kein Provider-Call,
  kein Prompt-Cache-Impact). Farbstufen ab 70 % (bernstein) und 90 % (rot),
  Tooltip mit `used / max`. Gilt für Liste **und** Grid, per Schalter an/aus.

### Fixed
- **Info-Dichte-Initialisierung wiederhergestellt**: Beim Aufräumen eines
  Debug-Blocks wurde versehentlich der `watchAppDensity()`-Aufruf mitentfernt —
  die Option „Wie Hermes" folgte der App-Dichte dadurch nicht mehr (und der
  Dispose-Block brach an der Stelle ab). Beides repariert.
- **`injectCss` räumt verwaiste Stylesheets früherer Instanzen auf** — nach
  einem unvollständigen Dispose konnten sich sonst Effekte stapeln.

### Intern
- Kontextabfrage adressiert Sessions über die **Runtime-ID** (`SessionParams`
  = Live-Doors; die durable Stored-ID antwortet mit `session not found`).

## [1.9.0] — 2026-10-04

### Neu
- **Design-Optionen für Liste & Grid** (Sektion „Session-Tabs"):
  - **Hintergrund-Verlauf** für Zeilen/Karten — zwei frei wählbare Farben + Winkel (0–360°).
  - **Auswählbarer Schlagschatten** unter Zeilen/Karten (Aus/Dezent/Mittel/Stark).
  - **Titel als Verlauf** — zwei Farben + Winkel, via `background-clip: text`.
  - **Auswahl-Zustand gestaltbar** — Tönung (Standard/Akzent/Eigene Farbe),
    optionale Kontur und eigene Schattenstufe.
  - **Live-Status** — „Aktiv & Wartend“-Hervorhebung: Akzent-Glow +
    pulsierendes Status-Icon, gleiche Bildsprache wie im Tab-Design.
- Alles rein deklarativ (Attribute/Variablen auf `<html>`), standardmäßig **aus**,
  live umschaltbar; `prefers-reduced-motion` und pausierte Animationen werden
  respektiert.

## [1.8.0] — 2026-10-04

### Neu
- **Mehrspaltiges Grid**: Neue Option „Grid: Spalten“ (Auto oder fest 1–4) —
  Auto füllt wie bisher nach Kartenbreite, feste Spalten teilen die Pane
  gleichmäßig auf.
- **Info-Dichte wie Hermes Desktop**: Neue Option „Info-Dichte“ (Wie Hermes /
  Kompakt / Komfortabel / Detailreich) — bildet die App-Einstellung „Dichte
  der Session-Liste“ für List- UND Grid-Ansicht ab: Komfortabel ergänzt eine
  Detail-Zeile (Branch · Modell · Nachrichten · Tool-Aufrufe), Detailreich
  zusätzlich die Vorschau-Zeile. „Wie Hermes“ folgt der App-Einstellung live
  (`host.settings.subscribe('sessionListDensity')`).
- **Pin-Toggle im More-Menü**: „Anpinnen“/„Loslösen“ je nach Server-Status
  (`pinned` aus `session.list`).

## [1.7.0] — 2026-10-04

### Neu
- **Neue Session im zuletzt gewählten Projekt**: Neuer Toolbar-Button (＋)
  startet eine Session mit dem CWD des zuletzt gewählten Projekts — Reihenfolge:
  eingescopetes Projekt (`hermes.desktop.projectScope`), sonst aktives Projekt
  (`projects.db`), sonst zuletzt bekannte Session-CWD; Home bleibt bewusst
  abgekoppelt. Nutzt dieselben Kern-Params wie die App (`session.create`) und
  öffnet die neue Session direkt.
- **More-Menü (⋯) in Listen- UND Grid-Ansicht**: Session-Aktionen wie in Hermes
  Desktop — In neuem Tab/Fenster, Im Terminal öffnen, Umbenennen (Dialog),
  Farbe (Swatches), Anpinnen, Zweig erstellen (`session.branch_stored`),
  In Projekt verschieben (`session.workspace.move` + Projekt-Auswahl),
  Archivieren (`session.archive`), Löschen (`session.delete` mit vorherigem
  Runtime-Close + Bestätigungsdialog), ID kopieren. Live verifiziert
  (create/rename/move/archive/delete); App-lokale Aktionen (gelesen/ungelesen,
  Export) haben keine Plugin-Door und sind dokumentiert ausgenommen.
- **Grid-Ansicht**: Sessions als Karten (auto-fill) — umschaltbar per
  Toolbar-Button und Einstellungen; Optionen: Kartenbreite, Abstand,
  Titel-Zeilen, Vorschautext.

### Fixed
- **Close-Button im Sidebar-Look klar erkennbar**: Das ✕ sitzt jetzt auf einem
  **deckenden Kontrast-Chip** statt gestapelter Transparenzen (Label/Fläche
  darunter schienen vorher durch); zusätzlich bekommt das Label beim Hover eine
  Fade-Maske für ALLE Tab-Varianten — die App maskiert nur
  `data-slot='pane-tab'`, gewrappte Session-Tabs blieben sonst unmaskiert.
- Toolbar: „Neue Gruppe" trägt jetzt ein Gruppen-Icon (`layers`) statt des ＋
  (das ＋ gehört der neuen Session).

## [1.6.0] — 2026-10-03

### Neu — Individualisierung (neue Einstellungs-Sektion)
- **Akzentfarben-Tönung**: eigene Akzentfarbe (Swatch oder Hex) färbt die
  elementaren UI-Elemente der App (Buttons, aktive Zustände, Hover, Fokusringe,
  Hervorhebungen). Umgesetzt als unlayered `--ui-accent`-Override, der die
  `@layer base`-Definition der App sticht — ohne `!important`.
- **Chat-Hintergrund (Bild/Video)**: eigene Datei per nativem Picker
  (`hermesDesktop.selectPaths`) oder Pfad-Eingabe; Ausgabe über das
  App-Protokoll `hermes-media://stream/…` (Range-fähig — Video live verifiziert:
  readyState 4, currentTime läuft). Optionen: Art (Bild/Video, automatische
  Erkennung nach Endung), Darstellung (Füllen/Einpassen), Abdunkeln %,
  Weichzeichnen px, Geltungsbereich (nur Chats/alle Panes). Der Hintergrund-
  Layer (`.sf-bg-layer`) wird pro Pane-Host injiziert; Videos laufen nur auf
  sichtbaren Panes (Keep-Alive bleibt ruhig).
- **Content-Bereich abgrenzen**: runde Ecken (4–24 px) + dezenter Schlagschatten
  (aus/dezent/mittel/stark) + optionale feine Kontur auf den Pane-Hosts
  (`[data-pane-host]`, Overlay-Panes ausgenommen); Geltungsbereich wählbar.

### Geändert
- Einstellungs-Navigation um Kategorie **Individuell** erweitert (sticky Leiste).
- i18n beider Bundles auf 275 Keys; `docs/SETTINGS.md`, `docs/DEVELOPMENT.md`,
  `docs/APP-INTEGRATION.md`, `docs/README.md` und beide READMEs aktualisiert.
- Version 1.6.0 (`plugin.js` + `package.json`).

## [1.5.2] — 2026-10-03

### Geändert
- **Entwickler- & Lizenzangaben**: Das Projekt ist durchgängig als Open-Source-
  Projekt von **AGANTILA — Deniz Yilmaz** (agantila.com) ausgewiesen — LICENSE-
  Copyright, `package.json` (Autor), README/README.de (Entwickler-Zeile +
  Lizenzabschnitt), Plugin-Header sowie zwei neue „Über"-Zeilen in den
  Einstellungen (Entwickler & Lizenzhinweis, EN/DE).

## [1.5.1] — 2026-10-03

### Fixed
- **UI-Tabs greifen jetzt auch auf die Session-Tabs im Content-Bereich**: Diese
  Tabs werden von der App in ein Kontextmenü gewrappt, wobei der Trigger das
  Attribut `data-slot` überschreibt (`context-menu-trigger` statt `pane-tab`) —
  der bisherige Selektor traf sie deshalb nicht (Radius 0 px, keine Chip-Optik,
  kein Close-Verhalten, kein Busy-Glow). Das Styling hängt jetzt an strukturellen
  Merkmalen (`role="tab"` + `.pane-tab-content`, JS-Marke `data-sf-ui-tab`;
  Busy über `[data-tree-tab^='session-tile:']`), die auch hinter Wrappern
  erhalten bleiben. Live verifiziert: alle 7 Tabs markiert, Session-Tabs im
  Content-Bereich mit 4 px Radius + Chip-Höhe.

### Dokumentation
- **Volle Projektstruktur für Weiterentwicklung & GitHub**: bilinguales README
  (`README.md` englisch als GitHub-Hauptansicht, `README.de.md` deutsch),
  `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `docs/README.md`
  (Doku-Index), `docs/APP-INTEGRATION.md` (App-Hooks, fragile Selektoren,
  Verifikations-Rezepte), `docs/ROADMAP.md`, GitHub-Templates für Issues & PRs
  sowie CI (`.github/workflows/check.yml`), dazu `.editorconfig` und
  `.gitattributes`.

## [1.5.0] — 2026-10-03

### Added
- **Überarbeitete Einstellungsseite**: sticky **Kategorie-Leiste** oben — ein
  Klick springt zur Sektion (Chat, Strg+Scroll, Session-Liste, Gruppen, UI-Tabs,
  Glass, Über); die aktuelle Kategorie wird beim Scrollen automatisch markiert.
- **UI-Tabs-Schnellauswahl**: Ein-Klick-Presets **„Sidebar-Look"** (empfohlen),
  **„Minimal"** und **„Hermes-Standard"** übernehmen einen kompletten Look — die
  13 Feineinstellungen darunter bleiben jederzeit justierbar.

### Changed
- UI-Tabs-Sektion ausführlicher beschrieben (Sektionstext, Preset-Zeile mit
  Subtext, Hinweise in den Docs).

## [1.4.0] — 2026-10-03

### Added
- **UI-Tabs (Content-Tab-Leiste im Sidebar-Look)**: Die Tabs des Content-Bereichs
  orientieren sich jetzt am Design der Sidebar-Sessions — leicht abgerundete
  Chips, ruhiger Hover/aktiver Zustand (gefüllt wie eine Sidebar-Zeile, App-
  Unterstrich oder beides). Verbessertes Label (Schreibweise, Größe), verbesserter
  Close-Button (Klickfläche, Hover-Chip, Sichtbarkeit bei Hover/immer/am aktiven
  Tab) und **Live-Session-Infos aus der Sidebar-Engine**: arbeitende Sessions
  (denkt/schreibt/Tools) bekommen den umlaufenden Glow-Ring auf ihrem Tab;
  der Status-Punkt aus dem Sidepanel bleibt übernehmbar/ausblendbar.
  13 Optionen + Subtexte, EN/DE.

## [1.3.1] — 2026-10-03

### Fixed
- **Glow-Ring liegt jetzt exakt auf der Composer-Kontur**: Der Ring-Radius wird
  zur Laufzeit am echten Surface gemessen (`--sf-arc-radius` = berechnetes
  `border-radius` − 1px Border, alle 4 s aktualisiert) statt aus Theme-Variablen
  gerechnet — Tailwind v4 kompiliert die Radius-Skala inline, `--radius-2xl`
  existiert zur Laufzeit nicht. Damit passt der Ring in jedem Theme exakt zur
  vorhandenen Outline (z. B. Radius-Skalar 0.2: Kontur 4.8px → Ring 3.8px).
- (intern) Backtick-Falle in CSS-Kommentaren entschärft: Backticks innerhalb des
  Stylesheet-Templates beenden das Template-Literal und brechen das Plugin.

## [1.3.0] — 2026-10-03

### Fixed
- **Eck-Lücke am Eingabefeld behoben**: Fläche und Akzent-Verlauf malt jetzt das
  Composer-Surface selbst auf der Border-Box — damit exakt derselbe Border-Radius
  wie die Outline (keine Haarlinien mehr an den Ecken). Der Input-Fill-Layer wird
  dafür transparent und erhält zusätzlich den konzentrischen Innenradius
  (`r − 1px`).

### Added
- **Umlaufender Glow** („Travelling glow"): ein dezenter, akzentgefärbter
  Lichtpunkt läuft um den Rand von Eingabefeld, Chips und Statusleiste — dieselbe
  Technik (Mask-Ring + transform-animierter Verlauf), die Hermes bei laufenden
  Session-Zeilen und im HUD-Composer verwendet. Modus „Immer" oder „Bei
  Aktivität" (nur während die aktuelle Session denkt/schreibt/Tools ausführt),
  Breite und Umlaufdauer einstellbar; respektiert `prefers-reduced-motion` und
  pausiert mit dem App-weiten `data-renderer-animations-paused`.

## [1.2.0] — 2026-10-03

### Changed
- **Alle Optionen in den Einstellungen haben jetzt einen Subtext**: jede Zeile
  (Animation, Strg+Scroll, Session-Tabs, Tab-Gruppen, Glass & Lesbarkeit sowie
  der Über-Bereich) erklärt in einem kurzen Satz, was die Option tut — in
  Englisch und Deutsch.

## [1.1.0] — 2026-10-03

### Added
- **Glass & Lesbarkeit**: optionaler Frost-Effekt für **Eingabefeld** und
  **UI-Chips** (Modell-/Reasoning-Pill, Statusleisten-Einträge) mit dezentem,
  akzentgefärbtem **Verlauf als Transparenz-Overlay** — Beschriftungen bleiben
  auch ohne eigene Fläche lesbar. Alles einzeln einstellbar: Blur, Sättigung,
  Flächen-Deckkraft, Akzent-Tönung, Verlauf (an/aus, Winkel, Stärke, Endpunkt),
  feine Kontur und Bereiche (Eingabefeld / Chips / Statusleiste).
- Palette-Command „Session Flow: Glass-Effekt umschalten".

### Notes
- Der Blur folgt dem systemweiten „Transparenz reduzieren"-Gate der App
  automatisch und setzt bewusst kein `!important` auf `backdrop-filter`.
- Zoom-Flächen (Bild-Lightbox, Editor) bleiben unberührt; die Umsetzung ist
  rein deklarativ (Attribute + Custom Properties auf `<html>`, kein CSS-Rebuild).

## [1.0.0] — 2026-10-03

### Added
- **Chat-Animation**: gestaffelte Zeilen-Kaskade beim Öffnen/Wechseln eines
  Chats; Zeile-für-Zeile-Reveal während des Streamens (Web Animations API,
  Index-Dedupe gegen Markdown-Re-Parse-Flackern, `prefers-reduced-motion`-safe).
  Konfigurierbar: Dauer, Versatz, max. Schritte, Bewegung, Easing-Presets,
  Thinking-/Code-/Listen-Optionen.
- **Strg+Scroll-Sessionzyklus** mit konfigurierbarer Zusatztaste, Schwelle,
  Sperrzeit, Invertierung, Umlauf und HUD-Overlay; Zoom-Flächen und
  benutzerdefinierte CSS-Selektoren werden ausgenommen.
- **Session-Tabs-Pane** mit Aktivitäts-Icons (denkt/schreibt/Tool/wartet/fertig/
  Fehler), optionalem Core-Status-Punkt, Zeit, Vorschau, Anzahl, Quellen-Badge.
- **Firefox-artige Tab-Gruppen**: Name, Farbe, Collapse mit Stapel-Optik
  (spine/fanned/pill), Drag & Drop, Kontextmenüs, optionale Auto-Gruppierung
  nach Datum/Quelle.
- **Einstellungsseite** (`/session-flow`) mit Sidebar-Eintrag, Palette-Commands
  und optionalen Keybinds.
- i18n: Englisch + Deutsch.
