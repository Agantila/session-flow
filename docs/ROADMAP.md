# Roadmap & bekannte Grenzen

Stand: v1.29.0 (2026-10-08). Reihenfolge = grobe Priorität, nichts davon ist
zugesagt.

## Zuletzt umgesetzt (Referenz für Weiterentwicklung)

- **Marketplace-Compliance + Zwei-Build-Modell** (v1.29.0): Resubmission nach
  der Catalog-Ablehnung #134760 (Regel 8 + Disclosure). `full/plugin.js` =
  Quelle der Wahrheit (alle Features), Root-`plugin.js` = generierter
  SDK-only Catalog-Build (`scripts/build-catalog.mjs`, `#full`-Regionen),
  `plugin.yaml` am Root, Surface-Tripwire (`tests/surface-test.mjs` in
  `npm run check`), Disclosure vollständig korrigiert (Kontakt
  info@agantila.com). Siehe
  [`docs/plans/2026-10-08-marketplace-catalog-compliance.md`](plans/2026-10-08-marketplace-catalog-compliance.md).

- **DnD komplett auf Pointer-Events umgestellt** (v1.28.0, live
  verifiziert): natives HTML5-DnD (`draggable`/`dragstart`/`dragover`/
  `drop`) restlos entfernt — Hermes Desktop selbst ist aus denselben
  Gründen (unzuverlässiges Verhalten je nach Plattform, u.a. Wayland) auf
  Pointer-Events umgestiegen. `beginRowDrag()` in SessionsPane: 6px-
  Schwelle, Ghost-Chip, Hit-Test via `elementFromPoint` +
  `[data-sf-drop-key]`, Esc bricht sofort ab. Funktioniert jetzt auf der
  GESAMTEN Karten-/Zeilenfläche in List UND Grid (nicht mehr nur am
  Kartenrand). Ersetzt v1.27.7 (user-select-Fix, löste nur den Drag-
  Start, nicht den Drop-Abbruch danach).

- **DnD-Drag-Start-Fix (echte Ursache)** (v1.27.7): `.sf-tab` fehlte
  `user-select:none` — Chromium priorisiert bei `mousedown`+Bewegung über
  Text-Kindern (Title/Details/Meta) die Text-Selektion vor `dragstart`.
  ListView konnte den Drag dadurch nie starten, GridView nur am leeren
  Padding-Rand ohne Text darunter. Die vorherigen v1.25.1–v1.27.6-Fixes
  adressierten nur den Drop (Hit-Test/pointerdown), nicht den Start.
  Style-Test-Regression-Guard ergänzt (user-select + voller
  Hit-Test-Bypass-Zyklus).

- **Optionsmenü + DnD-Repair** (v1.27.5): der v1.25.1-`onPointerDownCapture`
  (stopImmediatePropagation bei Linksklick) killte das More-Menü und die
  Drag-Kette in Liste UND Grid — Handler entfernt, pointerdown läuft
  wieder nativ; der dragstart-Capture-Listener (dataTransfer-Mime) bleibt
  als Grid-Drag-Absicherung.

- **ListView-DnD-DropBar + Pinned-Unpin** (v1.25.1/v1.27.5): im
  Flat-List-Modus fehlte jede Drop-Area, weil die Sektion-Header
  weggelassen werden — eine schmale Leiste mit „Pin" und „Ungrouped"
  erscheint jetzt am Listenanfang, sobald ein Drag aktiv ist. Das
  Verschieben einer gepinnten Session aus der Pinned-Sektion in eine
  andere Sektion löst das `pinned`-Flag automatisch (assign-Unpin).

- **Zeilen-Geometrie List/Grid zentriert** (v1.27.5): `.sf-tab` Padding
  2→4px, Title line-height 16→14px, sf-tab-main als Flex-Column mit
  `justify-content: center` — Title und Details sind in der Karte
  vertikal mittig zueinander und nicht mehr zu nahe an der Kartenkante.
  GridView behält oben bündig + Meta am Boden (`justify-content:
  flex-start` + `margin-top: auto`).

- **Reset stellt die Hermes-Default-Projektgruppierung wieder her**
  (v1.27.4): `groups.autoMode`-Werksdefault ist jetzt `project` (statt
  `off`) — nach „Einstellungen zurücksetzen" gruppiert die Pane wieder
  nach Projekten wie die native Sidebar; beide Reset-Pfade ziehen den
  Projekt-Baum sofort frisch, statt auf den 60-s-Poll zu warten.

- **Beide Titelbasen auf 10px** (v1.27.3): Session-Titel skaliert
  `tabs.textSize` jetzt von einer 10px-Basis (statt 13px), Detail-/Meta-
  Zeilen von 8px; Kopfzeilen-Titel defaulten auf 10px (statt 14px).
  Migration hebt alte gespeicherte 14px-Defaults einmalig auf 10px.

- **Kopfzeilen-Titel-Typografie einstellbar** (v1.27.2):
  `groups.nameSize` (10–24px, Default 14 — initial größer als die
  13px-Session-Titel) und `groups.nameCaps` (Großbuchstaben, Default
  an) steuern Projekt-/Gruppen-Kopfzeilen über
  `--sf-group-name-size`/`data-sf-groupcaps`; die Density-Stufen
  regeln nur noch Gewicht/Höhe.

- **Textgröße einstellbar + Caret immer sichtbar** (v1.27.1):
  `tabs.textSize` (80–160 %, Default 100) skaliert Titel und
  Detail-/Meta-Zeilen in Liste UND Grid über
  `--sf-row-label-size`/`--sf-row-detail-size`; die Density-Stufen
  folgen derselben Skalierung. Der Collapse-Caret auf Projekt- und
  Gruppen-Kopfzeilen ist nicht mehr hover-only, sondern dauerhaft
  sichtbar (v1.27.0 hat die Geometrie bereits auf die nativen
  Sidebar-Tokens gehoben — die Affordanz war dadurch ohne Hover nicht
  mehr erkennbar).

- **Zeilen-Geometrie-Parität + „Projekt nicht verfügbar" + Migrations-Toast**
  (v1.27.0): Session-Zeilen (Liste) nutzen jetzt die exakten
  `row-geometry.ts`-Tokens — 8 px Padding-X, 14×14-Lead-Cell,
  13-px-Label/500, 16×16-Add-Button — als `--sf-row-*`-Custom-Properties auf
  `:root`, gespiegelt in `applyRows()`; Add-Button-Hover auf
  `--ui-control-hover-background`. Referenziert eine manuelle Gruppe eine tote
  Projekt-ID, erscheint eine „Projekt nicht verfügbar"-Hinweiszeile mit
  „Aus Gruppe entfernen" statt eines leeren Bodys (Header ohne `+`). Nach der
  cwd→projectIds-Migration toastet das Plugin einmalig pro Gruppe (Erfolg bzw.
  Fehlschlag) über ein persistiertes `migrationNotified`-Flag.

- **„Fertig, aber ungesehen" im Status-Indikator** (v1.26.1):
  `activityFor()` wertet jetzt `row.unread` aus — ruhige Sessions mit
  ungesehener Antwort zeigen in Liste UND Grid den `unread`-Indikator
  (gefüllter Punkt, `--ui-success`, Tooltip „Fertig — Antwort
  ungesehen"), statt pauschal idle zu erscheinen. Busy-Zustände
  gewinnen weiterhin. Zusätzlich: `activityFor` ist null-safe.

- **Manuelle Gruppen als Projekt-Container** (v1.26.0, Plan
  `docs/plans/2026-10-06-group-as-project-container.md`): manuelle
  Gruppen speichern jetzt `projectIds[]` (Referenzen auf
  `ProjectTreeNode`s) statt eines CWDs — das v1.25.0-`cwd`-Konzept
  „verlor" neue Sessions an den Server-Baum und war semantisch falsch.
  Gruppen-Dialog = Multi-Projekt-Picker; Sub-Sections mit voller
  Projekt-Header-Optik (inkl. `+`) unter dem Gruppen-Header;
  Hybrid-DnD (Session mit Projekt → Projekt der Gruppe zuweisen);
  Single-Container-Semantik; best-effort Migration alter Gruppen.
- **Manuelle Gruppen mit Session-Erzeugen-Button und Projekt-Header-Parität**
  (v1.25.0, Plan
  `docs/plans/2026-10-06-group-create-session-hover-caret.md`) —
  **in v1.26.0 durch das Container-Konzept ersetzt**; der Pfad-Ansatz
  wurde verworfen.
- **Analyse-Befunde umgesetzt** (v1.24.1, Plan
  `docs/plans/2026-10-06-analyse-verbesserungen.md`): Bootstrap-Fehler
  selbstheilend (Reconnect setzt Lade-UI zurück, Retry-Button im
  Fehler-Leerzustand), Composer-Pick wird in allen No-Op-Pfaden verbraucht,
  Rehoming-Fehler sichtbar (error-Toast + Pick-Verwurf), Schnellfilter
  „Angepinnt" in der Filter-Leiste, „Alles zurücksetzen" (Settings + Gruppen +
  Seeds + Pick) in Einstellungen → Über, Radius-Messung schreibt nur bei
  Wertänderung.
- **`tabs.openIntent` zwingt bei aktivem `tabs.asTabSelector` „Ersetzen"**
  (v1.24.0): drei `host.openSession`-Aufrufer (`openFreshSession`,
  `wheelController.cycleNext`, `TabRow.onClick` → Wrapper `open(row,
  intent)`) lesen den Intent jetzt über den zentralen Helper
  `effectiveOpenIntent()`. Ist `tabs.asTabSelector = true`, erzwingt der
  Helper `in-place` (vorher öffnete die App den Klick scheinbar „daneben"
  und der User las das als „Ersetzen ignoriert"). Die UI rendert
  passend einen erklärenden Hinweis-Block und no-oppt das Segment, damit
  der ausgewählte Punkt nicht versehentlich auf `stack`/`tab` hängen
  bleibt. Whitelist-Fallback für unbekannte/korrupte persistierte
  Werte. Plan: `docs/plans/2026-10-06-openintent-tabs-as-selector.md`.
- **„Neue Session" ohne Owner-Fehler + Composer-Chip auf dem nativen Sendeweg**
  (v1.23.0): frische Plugin-Sessions werden über `openFreshSession()` mit
  Owner-Hinweis geöffnet (SDK `openSession` mit `profile`), der Chip spiegelt
  den App-Sendeweg synchron und übernimmt einen Draft-Pick beim Übergang auf
  die native Session. Offen: echte Draft-CWD-Tür der App (dann entfällt die
  Nachträglich-Übernahme). Plan:
  `docs/plans/2026-10-06-neue-session-owner-und-chip-nativ.md`.
- **Pane-Crash beim Umschalten auf Kopfzeilen-Dichte „Detailreich" behoben**
  (v1.22.2): der `useEffect` für die Projekt-Ordnergröße lag innerhalb des
  `density === 'detailed'`-Zweigs von `SectionHeader`, damit hing die
  Hook-Anzahl vom Render-Input ab → React #300/#310 → Pane in der
  Error-Boundary. Hook steht jetzt am Komponentenanfang, Bedingung IM Effekt.
  Zusätzlich prüft `npm run check` die Hook-Reihenfolge statisch (findet Hooks
  in bedingten Blöcken und bricht mit Exit-Code 1 ab) — der Render-Smoketest
  kann diese Fehlerklasse prinzipiell nicht sehen, weil dort `useEffect`
  ein No-op ist. Plan:
  `docs/plans/2026-10-06-fix-kopfzeilen-dichte-crash.md`.
- **Titel-Stil + per-Theme-Shadows + robuste Theme-Erkennung** (v1.22.1):
  Titel hat jetzt einen Stil `none`/`solid`/`gradient` mit EINER Einzelfarbe
  (`titleColor`) für den Nicht-Verlauf-Fall, je Theme; die Schlagschatten
  (`rowShadow`, `selShadow`) sind je Theme getrennt und werden getrennt
  gespeichert. Die Theme-Erkennung prüft `color-scheme` → nur **undurchsichtige**
  Flächen → `prefers-color-scheme` (transparente Flächen hatten vorher
  fälschlich „dark" ergeben, dadurch griffen die Light-Farben nie) und lässt
  sich per `themeMode` (auto/dark/light) übersteuern. Die Hell-Wahl schaltet
  `themeSplit` automatisch ein (Edits im Hell-Subtab waren sonst wirkungslos).
- **Liste-&-Grid-Farben je Theme + Auto-Ableitung** (v1.22.0): die
  Designfarben (Zeilen-Verlauf, Titel-Verlauf, Auswahlfarbe) haben jetzt
  getrennte Sätze fürs Dark- und Light-Theme. Einstellungen → „Design —
  Liste & Grid": `tabs.themeSplit` (eigener Light-Satz), Subtab Dunkel/Hell
  (`tabs.themeTab`), `tabs.themeAutoDerive` (beim Setzen einer Farbe wird die
  Gegenfarbe in HSL abgeleitet — Farbton bleibt, Flächen in ein lesbares
  Helligkeitsband, Text/Titel invertiert). Theme-Erkennung mehrstufig
  (Marker-Klasse/-Attribut an `<html>`/`<body>` → Flächen-Helligkeit →
  `prefers-color-scheme`), Live-Umschaltung per MutationObserver +
  `matchMedia`; `data-sf-theme` markiert das erkannte Theme. Nur plugin-eigene
  Custom Properties werden geschrieben (kein Eingriff in App-Markup).
- **Composer-Chip sendet im richtigen Projekt** (v1.21.1): der Draft-Pick im
  Composer-Chip setzt nur noch den Anker (`$composerPick`, TTL 5 min) +
  `hermes.desktop.projectScope`; der App-Sendepfad liest den Chip als erste
  Quelle — kein eager Create mehr, die neue Session landet beim Enter im
  gewählten Projekt.
- **Projekt-Kontext-Chip vor dem Composer-„+“** (v1.21.0): Chip
  (Farb-Dot + Name + Caret) in der Eingabezeile des Composers, direkt vor dem
  „+“-Add-IconButton — Projekt-Kontext immer sichtbar vor der ersten Eingabe.
  Session-Pick = Re-Home per `session.workspace.move` (Fallback
  `session.cwd.set`), plus best-effort `projects.set_active`. Injektion per
  Sync-Loop am `.codicon-add`-Anker des fokussierten/sichtbaren
  Composer-Roots. Plan:
  `docs/plans/2026-10-06-composer-projekt-kontext-pill.md`.
  **Bekannte Grenze (bewusst)**: die App löst den CWD eines App-Drafts erst
  beim Senden aus `$projectScope`/`$currentCwd` — der Chip setzt seit v1.21.1
  `projectScope` und den Anker, den der App-Sendepfad zuerst liest; ein
  echtes „Draft-CWD vor-Umstellen“ direkt im App-Atom bräuchte weiterhin eine
  Plugin-Tür in der App (Idee, siehe unten).
- **App-Schnellstart-Zeile + Pane-Fläche** (v1.20.0): Icon-Button-Zeile über
  der Toolbar (Neue Session, Fähigkeiten, Messaging, Artefakte, Geplante
  Jobs, Kanban bei laufendem Plugin) mit `host.navigate`-Whitelist und
  flex-wrap-Umbruch; Pane-Hintergrund wählbar (Einstellungen →
  Individualisierung → Pane-Fläche): **Native Sidebar** (Default, exakt die
  Variable der nativen Sessions-Sidebar), **Chat** (bisheriger Look),
  **Ohne**. Pläne: `docs/plans/2026-10-05-app-nav-icon-row.md`,
  `docs/plans/2026-10-06-pane-surface-option.md`. Kanban-Detect über
  `[data-tour^="sidebar-nav-kanban"]` (Plugin-Beiträge tragen das
  Namensraum-Suffix `:nav`, live verifiziert) oder den offenen Drawer.
  **Status-Pips** auf Kanban + Geplante Jobs (7-px-Punkt oben rechts):
  Kanban-Counts aus `/api/plugins/kanban/board`, Cron-Zustände (jobState-
  Replik) aus `/api/cron/jobs`, 60-s-Poll, ohne Daten kein Punkt. Plan:
  `docs/plans/2026-10-06-nav-status-pips.md`.
- **Context-Bar + Settings-Hierarchie** (v1.19.3): Kontext-Stil Donut/Bar,
  Trennlinien + Hover je Settings-Sektion. Plan:
  `docs/plans/2026-10-05-context-bar-style-settings-hierarchie.md`.
- **Ladeerlebnis, Projekt-Verwaltung & Filter-Parität** (v1.19.0): Sichtbares
  Loading (`$loadPhase` + `.sf-load`-Block mit Gateway-Hinweis),
  Projekte-laden-Pending-Sektion (statt falscher „Kein Projekt“-Gruppierung
  während der Wartezeit), REST-First-Refresh (`/api/sessions?order=recent`
  mit Fallback auf `session.list`), Filter-Parität mit der Hermes-Sidebar
  (Sortierung/Status/Projekt/Archiviert + Token-/Kosten-/Profil-Badges),
  Toolbar-„Neues Projekt" + `ProjectDialog` (Erstellen/Bearbeiten/Löschen)
  und Instant-Sync App↔Plugin (Sidebar-MutationObserver +
  `dispatchEvent(focus/visibilitychange)`-Kick). Plan:
  `docs/plans/2026-10-05-ladeerlebnis-projektverwaltung-filter-paritaet.md`.
- **Gateway-Bootstrap-Gate** (v1.18.0): Start-/Reconnect-Initialisierung — der
  erste Daten-Satz (Sessions, Pins, Live, Projekt-Baum) feuert erst beim
  ersten `host.state.gateway === 'open'` (vorher wirft `host.request` ab);
  Reconnects (`closed→open`) ziehen automatisch nach, 20-s-Fallback inklusive.
  Behebt „Gateway nicht verfügbar“-Banner + „Kein Projekt“-Gruppierung beim
  App-Start; manuelles Aktualisieren entfällt. Plan:
  `docs/plans/2026-10-05-gateway-bootstrap-gate.md`.
- **Projekt-Ordner-Gruppierung + Drag&Drop-Verschieben** (v1.14.0):
  `groups.autoMode: 'project'` gruppiert nach CWD, Header im
  Hermes-„Projekte"-Look (Ordner-Icon, Hover-Caret, Hover-„+"). Ziehen eines
  Tabs auf einen Projekt-Header ruft `session.workspace.move` auf — echte
  Verschiebung, nicht nur Anzeige. Hover-Hervorhebung + Inline-Zielhinweis +
  „Gelandet"-Flash machen den DnD-Ausgang vorab und danach sichtbar.
- **Filter-Leiste** (v1.14.0): Textsuche + Schnellfilter (Alle/Aktiv) über
  der Liste, clientseitig, eigener Leerzustand bei 0 Treffern; `Aktiv` zeigt
  seit dem Aktiv-Flat-Umbau nur laufende + heutige Sessions als flache Liste
  (keine Kopfzeilen), `Alle` bleibt die Startzeit-Reihenfolge mit Gruppen.
- **Info-Zeile (alle Dichten)** (2026-10-05): aktuelle Aktivität (Tool Call /
  Gedanke) mit Slide-up-Wechsel — Detailreich als eigene dritte Zeile,
  Komfortabel/Kompakt in Zeile 2 (Detail-Inhalt währenddessen ausgeblendet);
  Status/Events in Echtzeit verdrahtet (Gateway-Events statt Poll-Latenz).
- **Tab-Selektor-Modus** (v1.14.0): `tabs.asTabSelector` blendet die native
  Content-Tab-Leiste für Session-Tabs aus (`:has()`-Selektor), wenn
  Liste/Grid dieselbe Navigation schon abdecken.
- **Info-Dichte klarer abgestuft** (v1.14.0): größerer Titel, lockerere
  Abstände und reichere Detail-/Stats-Zeile in Komfortabel/Detailreich
  (Modell/„zuletzt aktiv“ live, Kontext-Stats); Beschreibungen in
  Detailreich zweizeilig. Plan: `docs/plans/2026-10-04-info-dichte-abstufung.md`.
- **Liste/Grid-Parität** (v1.12.0): Ein Design-Satz trifft beide Ansichten
  (Flächen via `:where()` null-spezifisch); Auswahl-Tönung und Live-Zustand
  liegen als **Layer über** dem Zeilen-Verlauf.
- **Kontext-Donut** (v1.13.3): Füllstand als Ring mit ausgespartem Loch
  (`::before` + radiale Maske, `isolation:isolate`), mehrlagiger Text-Schatten,
  in der Listen-Ansicht ganz rechts am Ende.
- **Chat-Hintergrund wirklich sichtbar** (v1.13.2): Layer liegt an der
  Chat-Surface (`[data-chat-surface]`, hat `isolate`), nicht mehr am Pane-Host;
  Geltungsbereich „alle" inkl. Zonen ohne Chat-Surface.
- **Arbeits-Indikator repariert** (v1.13.4): Codicon-Namen ohne `~spin`-Marker
  (die App erwartet den `spinning`-Prop) — das Icon rendert sonst 0×0 und ist
  unsichtbar.

Vollständige Pläne zu v1.14.0: `docs/plans/2026-10-04-grouping-filter-dnd-tab-selector.md`
und docs/plans/2026-10-04-info-dichte-abstufung.md.

## Geplant / Ideen

- **Catalog-Build-Parität nach SDK-Doors (v1.29.0-Follow-up)**: sobald die
  auf [hermes-agent #116305](https://github.com/NousResearch/hermes-agent/issues/116305)
  angefragten SDK-Slots landen (Composer-Accessory, Tab-Decoration,
  Message-Render-Hook, Theme-Door, Gateway-Change-Events, REST-Mirror-Door,
  Picker/Terminal-Doors), wandern die `#full`-Regionen schrittweise auf
  SDK-Pfade um — jeder Schritt als eigener Mini-Plan + SHA-Bump-PR.

- **Echter Draft-CWD-Hebel (App-PR)**: Plugin-Tür für `$projectScope`/einen
  `setCurrentCwd`-Door, damit der Projekt-Chip den offenen App-Draft direkt
  umstellt — statt des jetzigen Ersatz-Creates (der App-Draft bleibt dann
  unberührt liegen statt geschlossen zu werden).

- **Donut-Feinschliff**: Ringdicke/Lochgröße als Option, einstellbare
  Warnschwellen (statt fix 70/90 %) und alternatives Label (`used/max`).
- **Session-Kennzahlen in der Info-Dichte (Tokens/Kosten)**: Der Gateway
  liefert sie dem Plugin derzeit nicht (`session.usage`-Zähler unzuverlässig,
  App-REST nicht für Plugins erreichbar) — bräuchte ein Plugin-Backend
  (`plugin_api.py`) oder erweiterte Doors (Plan: `docs/plans/2026-10-04-info-dichte-abstufung.md`).
- **Status-Glyphen wählbar**: Icon je Status selbst festlegen (statt fester
  Zuordnung in `ACTIVITY_GLYPHS`).
- **Presets für weitere Sektionen**: Ein-Klick-Looks auch für „Glass" und
  „Chat-Animation" (gleiche Machart wie die UI-Tabs-Presets).
- **Einstellungen exportieren/importieren**: Sektion (oder alles) als JSON —
  zum Teilen von Setups zwischen Rechnern/Profilen.
- **Multi-Profil-Ansicht**: Session-Liste über alle Profile
  (`profiles.list` + Fan-out über `session.list`).
- **Freies Umsortieren innerhalb einer Gruppe**: Tabs per DnD in eigene
  Reihenfolge bringen (aktuell: Erstellungsreihenfolge). DnD AUF einen
  Projekt-Header verschiebt bereits ins Projekt (v1.14.0) — das hier ist die
  Fein-Sortierung *innerhalb* einer Gruppe/eines Projekts.
- **Filter-Leiste persistieren (optional)**: aktuell bewusst ephemeral wie im
  Hermes-Vorbild; ggf. ein Setting für „letzten Filter merken" anbieten.
- **Animation-Feinschliff**: Presets pro Elementtyp (Überschriften anders als
  Code-Blöcke), Kaskade auch für Tool-Karten (opt-in).
- **Glow-Feintuning**: optionaler Halo/Weichzeichner am Ring, Preset-Farben
  (z. B. „Erfolg/Fehler"-Glow bei fertig/Fehler).

## Bewusst so gelassen (Design-Entscheidungen)

- **Keine Content-Abgrenzung** (in v1.13.3 auf Nutzerwunsch entfernt): Option,
  Schema-Keys, Variablen, Injektion, CSS und i18n sind vollständig raus; die
  Tests sichern, dass die Altwerte inert bleiben. Nicht wieder einbauen, ohne
  dass es ausdrücklich gewünscht ist.
- **Animation nur auf Assistant-Markdown.** User-Nachrichten und Tool-Karten
  bleiben unangetastet — weniger Flackern, klare Lesbarkeit.
- **Kein eigener Status-Punkt.** Der Core-`SessionStatusDot` bleibt die einzige
  Statusquelle im Tab (SDK-Regel: Plugins, die daneben einen eigenen Punkt
  malen, brechen die Farb-Vokabel der App). Wir erweitern ihn nur um den
  Live-Glow (gleiche Engine wie die Sidebar).
- **Kein `!important` auf `backdrop-filter`.** Der systemweite
  „Transparenz reduzieren"-Gate der App muss gewinnen.
- **Filter-Leiste ephemeral.** Bewusst nicht persistiert (siehe Hermes-Vorbild)
  — ein Pane-Besuch startet immer ungefiltert.
- **Ein Datei-Plugin.** Kein Build, keine Abhängigkeiten — dafür bewusst alles
  in `plugin.js`.

## Bekannte Grenzen (Ist-Zustand)

| Grenze | Detail |
|---|---|
| Profil-Scope | Session-Liste liest das aktive Profil. |
| Gruppen-Reihenfolge | Fix (Erstellung); Umsortieren ist Roadmap. |
| Modell-Pill-Chips | Der Chips-Scope trifft nur den Primär-Chat (Marker fehlt in Tiles). |
| HUD-Modus | Dort gewinnt die app-eigene Gestaltung (Filter-Gate). |
| Glow an Tabs | Busy-Erkennung basiert auf Gateway-Events + Poll (bis ~2 s Verzögerung). |
| Status-Icons | Namen/Farben sind an die Status-Vokabel der App gekoppelt (`--ui-accent`, `--destructive`, `--ui-success`). |
| Pane-Anker | `[data-pane-host]` tragen nur Keep-Alive-Panes (u. a. Plugin-Panes). Chat/Arbeitsbereich hängen an `[data-chat-surface]` bzw. `[data-tree-group]` — pane-weite Regeln dort verankern. |
| Kontext-Donut | Der Wert sitzt im Loch; bei drei Stellen (100 %) berührt er den Ring (Text-Schatten hält ihn lesbar). |
| Projekt-Label | Kommt aus `projects.list` (60-s-Cache) — ein frisch angelegtes Projekt kann bis zu 60 s als Ordnername statt Projektname erscheinen. |
| Tab-Selektor-Modus | `tabs.asTabSelector` blendet **jeden** Streifen mit Session-Tabs aus — auch gestapelte Tabs im Content-Bereich verlieren damit ihre eigene Leiste; bewusster Trade-off laut Anforderung. `tabs.openIntent` wird unter aktivem `tabs.asTabSelector` zentral auf `in-place` gezwungen (`effectiveOpenIntent()`, v1.24.0), die UI zeigt einen Hinweis und no-oppt das Segment. |
| Filter-Leiste | Rein clientseitig, nicht persistiert; wirkt nur auf die bereits geladenen Sessions (`tabs.maxItems`), kein Server-Side-Search. „Aktiv" sortiert clientseitig nach letzter Aktivität (Bestand ohne Live-Signal: Startzeit). |
| `session.list`-Payload | Liefert dem Plugin nur `id/title/preview/started_at/message_count/source` — Branch/`tool_call_count` fehlen (Modell + „zuletzt aktiv“ werden für Live-Sessions aus `session.active_list` nachgereicht). |

