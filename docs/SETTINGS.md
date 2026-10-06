# Einstellungen — Referenz

Alle Einstellungen liegen unter `hermes.plugin.session-flow.settings.v1` (ctx.storage)
und sind live: Änderungen greifen sofort. Erreichbar über die Seite
`/session-flow` (Sidebar „Session Flow" oder ⌘K → „Session Flow: Einstellungen").

Die Seite hat seit v1.5.0 eine **sticky Kategorie-Leiste** oben: ein Klick springt
zur jeweiligen Sektion, die aktuelle wird beim Scrollen automatisch markiert.

## Chat-Animation

| Key | Default | Wirkung |
|---|---|---|
| `animation.enabled` | `true` | Master-Schalter. Aus = keine Zeilen-Animationen. |
| `animation.historyCascade` | `true` | Beim Öffnen/Wechseln eines Chats laufen die sichtbaren Zeilen als Kaskade (oben → unten) ein. |
| `animation.streamReveal` | `true` | Während des Streamens blendet jede Zeile einmal ein, sobald sie fertig ist (Zeile N-1 animiert, wenn Zeile N erscheint; die letzte beim Stream-Ende). |
| `animation.durationMs` | `320` | Dauer einer einzelnen Zeilen-Animation. |
| `animation.staggerMs` | `55` | Verzögerung zwischen aufeinanderfolgenden Zeilen. |
| `animation.maxStaggerSteps` | `24` | Deckel für die Staffelung (Gesamtlaufzeit) bei langen Antworten. |
| `animation.travelPx` | `10` | Vertikale Bewegung der Zeile in px. 0 = reines Fade. |
| `animation.easing` | `soft` | `smooth` (Expo), `soft` (weich), `gentle` (ruhig), `back` (leicht federnd). |
| `animation.skipReasoning` | `true` | Thinking-/Reasoning-Blöcke nicht animieren. |
| `animation.includeCode` | `true` | Code-Blöcke als Zeilen animieren. |
| `animation.includeLists` | `true` | Listenpunkte (`<li>`) einzeln animieren statt die Liste als Ganzes. |

Hinweis: `prefers-reduced-motion: reduce` (Betriebssystem) deaktiviert alle
Animationen unabhängig von diesen Schaltern.

## Strg+Scroll (Session-Zyklus)

| Key | Default | Wirkung |
|---|---|---|
| `wheel.enabled` | `true` | Master-Schalter. |
| `wheel.modifier` | `ctrl` | `ctrl`, `alt`, `ctrl+shift`, `meta`. |
| `wheel.threshold` | `40` | Nötige Mausrad-Delta bis ein Wechsel ausgelöst wird. |
| `wheel.cooldownMs` | `200` | Mindestabstand zwischen zwei Wechseln. |
| `wheel.invert` | `false` | Richtung umkehren. |
| `wheel.wrap` | `true` | Am Listenende umlaufen. |
| `wheel.hud` | `true` | HUD-Overlay mit Position/Titel anzeigen. |
| `wheel.hudMs` | `1100` | Anzeigedauer des HUD. |
| `wheel.ignoreSelector` | `''` | Zusätzliche CSS-Selektoren (kommasepariert), in denen Strg+Scroll nicht greift. Basis-Liste ist immer aktiv: `canvas`, `.monaco-editor`, Bild-Zoom (`aui_zoomable-image`). |

## Session-Tabs

| Key | Default | Wirkung |
|---|---|---|
| `tabs.density` | `compact` | `compact` (einzeilig) oder `cozy` (mit Vorschau-Zeile). |
| `tabs.view` | `list` | `list` oder `grid` (Kartenansicht) — auch per Toolbar-Button umschaltbar. |
| `tabs.gridMin` | `150` | Grid: Mindest-Kartenbreite in px (nur bei Spalten = Auto). |
| `tabs.gridCols` | `auto` | Grid-Spalten: `auto` (nach Kartenbreite) oder fest `1`–`4`. |
| `tabs.gridGap` | `6` | Grid: Abstand zwischen den Karten in px. |
| `tabs.gridLines` | `2` | Grid: max. Zeilen für den Kartentitel (1–4). |
| `tabs.gridPreview` | `true` | Grid: Vorschau der letzten Nachricht auf den Karten. |
| `tabs.infoDensity` | `auto` | Info-Dichte: `auto` (wie Hermes), `compact`, `comfortable`, `detailed`. Komfortabel = größerer Titel (13 px), lockerere Abstände, Detail-Zeile (Modell · Nachrichten · zuletzt aktiv) und einspaltig in der Liste (Zähler/Zeit/Kontext als Fußzeile unter dem Text), Detailreich = zusätzlich Vorschau + Kontext-Auslastung als Text (wenn der Donut aus ist), zweizeilige Detail-/Vorschau-Zeilen und eine animierte Aktivitäts-Zeile (aktueller Tool Call / Status, Wechsel mit Slide-up) — in `comfortable`/`compact` belegt sie die ZWEITE Zeile und blendet die Detail-Zeile aus, solange die Aktion läuft, in `detailed` erscheint sie als eigene dritte Zeile; gilt für Liste und Grid. |
| `tabs.alignTop` | `true` | Text oben ausrichten: Text-Spalte und Meta-Infos sitzen am Zeilenkopf statt vertikal zentriert (Liste; im Grid stehen die Texte baulich oben). |
| `tabs.rowGradOn` | `false` | Hintergrund-Verlauf für Zeilen (Liste) & Karten (Grid); Farben `rowGradFrom`/`rowGradTo` (optional mit Alpha `#RRGGBBAA`), Winkel `rowGradAngle` (0–360°). |
| `tabs.rowShadow` | `off` | Auswählbarer Schlagschatten: `off`/`subtle`/`medium`/`strong`. |
| `tabs.hoverLift` | `true` | Hover-Anhebung (App-Kachel-Optik): Zeilen/Karten heben sich beim Überfahren leicht an, der Schlagschatten wird tiefer. |
| `tabs.titleGradOn` | `false` | Titel als Verlauf (`titleGradFrom`/`titleGradTo`, optional mit Alpha `#RRGGBBAA`; Winkel `titleGradAngle`) via Background-Clip Text. |
| `tabs.selTint` | `standard` | Auswahl-Tönung: `standard` (App-Optik), `accent` (Akzentfarbe), `custom` (eigene Farbe `selColor`, optional mit Alpha `#RRGGBBAA`). Die Tönung liegt als Layer **über** dem Zeilen-Verlauf — der Verlauf bleibt sichtbar. |
| `tabs.selBorder` | `false` | Kontur um die ausgewählte Zeile/Karte (in der Tönungsfarbe). |
| `tabs.selShadow` | `off` | Schattenstufe für den Auswahl-Zustand: `off`/`subtle`/`medium`/`strong`. |
| `tabs.selHover` | `soft` | Hover-Verhalten des ausgewählten Eintrags (Liste & Grid): `soft` (Tönung vertiefen), `strong` (stärker), `off` (unverändert). |
| `tabs.rowLive` | `false` | Aktiv & Wartend hervorheben: Inset-Ring um aktive Zeilen (kein Hintergrund-Eingriff) + pulsierendes Status-Icon + Live-Rahmen; die aktive AUSWAHL (aktiv + selektiert) trägt zusätzlich die linke Live-Schiene (Bildsprache wie im Tab-Design). |
| `tabs.liveFrame` | `glow` | Rahmen für arbeitende/wartende Einträge: `off`/`ring` (statisch)/`glow` (glühender, umlaufender Ring — App-Technik). Nur sichtbar mit `rowLive`. |
| `tabs.doneFx` | `glow-wobble` | Einmaliger „Fertig"-Effekt, wenn eine Session fertig wird: `off` / `glow` (aufglühen) / `wobble` (Achsen-Wackeln) / `glow-wobble` / `shine` (Glanzstreifen) / `pop`. |
| `tabs.doneFxAxis` | `x` | Wackel-Achse des Fertig-Effekts: `x` (kippen) / `y` (drehen) / `z` (rütteln). |
| `tabs.doneFxStrength` | `subtle` | Stärke des Wackel-Effekts: `subtle` (dezent) / `medium` / `strong`. |
| `tabs.showContext` | `false` | Kontextfenster (kompakt): Prozent-Label je Zeile/Karte für **Live-Sessions** (read-only `session.context_breakdown`, kein Provider-Call). Ab 70 % bernstein, ab 90 % rot; Tooltip zeigt used/max. |
| `tabs.ctxPie` | `true` | Kontextfenster als **Donut**: Außenring = Füllstand, Innenkreis ausgespart (die Zeilenfläche scheint durch). Der Wert steht im Loch — weiß mit mehrlagigem Text-Schatten (Kontur + Glow); Farbstufen ab 70 %/90 %. Aus = reines Prozent-Label. **Listen-Ansicht:** Donut ganz rechts am Ende (nach der Zeit); **Grid:** vor der Zeit. |
| `tabs.statusStyle` | `glyph` | `glyph` (Aktivitäts-Icon), `dot` (Core-Status-Punkt), `glyph+dot`. |
| `tabs.showTime` | `true` | Alter der Session anzeigen. |
| `tabs.showPreview` | `false` | Letzte Nachricht als Vorschau (cozy-Dichte). |
| `tabs.showCounts` | `false` | Nachrichtenanzahl anzeigen. |
| `tabs.showSource` | `true` | Quellen-Badge (Telegram, Discord, Cron …). |
| `tabs.openIntent` | `in-place` | `in-place` (ersetzen), `stack` (neben dran), `tab`. |
| `tabs.asTabSelector` | `false` | Blendet die native Content-Tab-Leiste für Session-Tabs aus (strukturell über `:has()` — nur Streifen mit mindestens einem Session-Tile-Tab; Terminal/Dateien/sonstige Pane-Tabs bleiben unberührt). Sinnvoll, sobald Liste/Grid als alleiniger Tab-Selektor dienen soll. |
| `tabs.maxItems` | `60` | Maximal geladene Sessions. |
| `tabs.appNav` | `true` | **App-Schnellstart-Zeile**: Icon-Buttons für Neue Session, Fähigkeiten, Messaging, Artefakte, Geplante Jobs und Kanban über der Toolbar (gleiche Reihenfolge/Codicons wie die erste Sektion der App-Sidebar). Kanban erscheint nur bei laufendem Kanban-Plugin. Die Zeile bricht bei schmaler Pane-Breite dynamisch in weitere Zeilen um. **Status-Pips** (Kanban + Geplante Jobs): 7-px-Punkt oben rechts zeigt den Aktivitäts-Zustand — Kanban: läuft (grün)/blockiert (rot)/Review (amber)/bereit (blau); Geplante Jobs: Fehler (rot)/pausiert (amber)/läuft-geplant (grün). Daten über die App-Bridge (60-s-Poll); ohne Daten kein Punkt. Tooltip trägt die Zustands-Zeile. |
| `tabs.themeSplit` | `false` | **Eigene Farben fürs Light-Theme** (Liste & Grid). Aus = ein Farb-Satz für beide Themes (bisheriges Verhalten). An = der Light-Satz (`tabs.lightTheme`) gilt im Light-Theme, die flachen `tabs`-Keys (`rowGrad*`, `titleGrad*`, `selColor`) nur im Dark-Theme. Umschalten passiert automatisch über die erkannte Theme-Lage. |
| `tabs.themeTab` | `dark` | Nur UI-Zustand: welcher Subtab in den Einstellungen (Dunkel/Hell) gerade editiert wird. Kein Theme-Schalter. |
| `tabs.themeAutoDerive` | `true` | **Gegenfarbe automatisch ableiten**: beim Setzen einer Farbe (Verlauf/Titel/Auswahl, inkl. Alpha) wird die passende Farbe fürs andere Theme in HSL abgeleitet (Farbton bleibt; Flächen in ein lesbares Helligkeitsband 0.36–0.58 hell / 0.46–0.72 dunkel, Text/Titel invertiert) und dort vorbelegt — danach frei änderbar. |
| `tabs.lightTheme.*` | abgeleitet | Farb-Satz des Light-Themes (nur mit `themeSplit`): `rowGradOn/From/To/Angle`, `titleGradOn/From/To/Angle`, `selColor` — gleiche Semantik wie die flachen Keys. |
| `composer.projectPill` | `true` | **Projekt-Kontext-Chip**: minimalistischer Chip (Farb-Dot + Projektname + Caret) in der Eingabezeile des Composers, direkt vor dem „+“-Add-IconButton. Klick öffnet ein Projekt-Menü: Draft → setzt den Anker (`$composerPick`, TTL 5 min) + `hermes.desktop.projectScope`; der App-Sendepfad liest den Chip als erste Quelle, die neue Session landet also beim Enter im gewählten Projekt (kein eager Create mehr, v1.21.1); bestehende Session → Re-Home per `session.workspace.move` (Fallback `session.cwd.set`); zusätzlich best-effort `projects.set_active`. |
| `tabs.maxVisible` | `0` | Max. sichtbare Einträge je Gruppe in Liste & Grid; der Rest erscheint hinter „Mehr anzeigen (n)" — erneuter Klick klappt wieder ein („Weniger anzeigen"). `0` = aus. |
| `tabs.hideCron` | `true` | Cron-Sessions ausblenden. |
| `tabs.livePollSec` | `30` | Intervall der Live-Status-Abfrage (`session.active_list`). Min. 10s. |
| `tabs.refreshSec` | `45` | Intervall des Listen-Refresh (`session.list`). Min. 15s. |

### Filter-Leiste

Unter der Toolbar sitzt seit v1.14.0 eine Filter-Leiste wie bei der
Hermes-Sessionliste — rein clientseitig, nichts wird persistiert (ein
Pane-Besuch startet die Filter immer frisch):

- **Suche**: Textfeld, durchsucht Titel, Branch und Vorschau (klein-/
  großschreibungsunabhängig). Ein ✕ im Feld leert die Suche.
- **Schnellfilter**: `Alle` / `Aktiv` als Segmented-Control (der frühere
  `Angepinnt`-Chip ist die feste Angepinnt-Sektion). `Alle` zeigt die
  Startzeit-Reihenfolge mit Gruppen; `Aktiv` zeigt eine **flache Liste ohne
  Kopfzeilen**: laufende Sessions oben, darunter nur Sessions, die **heute**
  aktiv waren (lokale Mitternacht als Grenze) — je absteigend nach letzter
  Aktivität. Alles andere wird ausgeblendet.
- Wird die Liste durch Suche bzw. den Aktiv-Modus leer, erscheint ein eigener
  Leerzustand („Keine Sessions passen zu diesem Filter") statt des
  generischen „keine Sessions"-Hinweises.
- Gruppen, deren gesamter Inhalt durch Suche/Filter fällt, verschwinden
  aus der Liste (keine leeren Header).

### Pane-Buttons & More-Menü

- **Ansicht wechseln** (Toolbar): schaltet Liste ⇄ Grid.
- **Neue Session** (＋, Toolbar): startet eine Session mit dem CWD des **zuletzt
  gewählten Projekts** — Reihenfolge: eingescopetes Projekt (`projectScope`),
  sonst aktives Projekt (`projects.db`), sonst zuletzt bekannte Session-CWD.
  Der Home-Scope bleibt bewusst abgekoppelt (kein CWD). Danach öffnet die
  Session direkt (gemäß `tabs.openIntent`).
- **Neue Gruppe** (layers-Icon): öffnet den Gruppen-Dialog.
- **More-Menü (⋯)** auf jeder Zeile/Karte (erscheint bei Hover): In neuem Tab,
  Neues Fenster, Im Terminal öffnen, Umbenennen…, Farbe…, Anpinnen, Zweig
  erstellen, In Projekt verschieben…, Archivieren, Löschen (mit Bestätigung),
  ID kopieren. Umbenennen erfordert eine aktive/geladene Session
  (`session.title`-RPC); App-lokale Aktionen (gelesen/ungelesen, Export) stehen
  Plugins nicht zur Verfügung und fehlen daher bewusst.

## Tab-Gruppen

| Key | Default | Wirkung |
|---|---|---|
| `groups.enabled` | `true` | Manuelle Gruppen aktiv. |
| `groups.autoMode` | `off` | `off`, `date` (Heute/Gestern/Woche/Älter), `source` oder `project` (Projekt-Ordner — siehe unten). |
| `groups.headerDensity` | `comfortable` | Typografie & Infotiefe der Kopfzeilen — siehe unten. |
| `groups.stackStyle` | `spine` | Optik eingeklappter Gruppen: `spine`, `fanned`, `pill`. |
| `groups.showUngrouped` | `true` | „Nicht gruppiert"-Bereich zeigen, wenn Auto-Modus aus ist. |

Gruppen-Daten (Name, Farbe, Zuordnung, Collapse-Zustand) liegen separat unter
`hermes.plugin.session-flow.groups.v1`.

### Kopfzeilen-Dichte (`groups.headerDensity`)

Steuert, wie groß/kräftig eine einklappbare Sektions-Kopfzeile (Datum, Quelle,
manuelle Gruppe, Projekt-Ordner) ist und ob sie eine zweite Zeile zeigt —
analog zur Info-Dichte der Zeilen selbst (`tabs.infoDensity`), nur für die
Kopfzeile:

- **`compact`**: alte, einzeilige Optik (11px/600) — keine Subzeile.
- **`comfortable`** (Default): größere, fettere Schrift (12px/700); Projekt-
  Gruppen zeigen zusätzlich den gekürzten Ordnerpfad als Subzeile (z. B.
  „…/ARBEIT_2026/_AGANTILA_Workspace"), der volle Pfad bleibt im Tooltip.
- **`detailed`**: wie Komfortabel (13px), plus eine Kennzahl-Subzeile mit
  Angepinnt-/Aktiv-Anzahl, wenn die Sektion tatsächlich welche enthält (nie
  erfunden — ohne Treffer bleibt die Zeile weg).

Die Kopfzeile wächst nur bei vorhandener Subzeile auf zwei Zeilen
(`.sf-group-twoline`); ohne Subzeile bleibt sie einzeilig, nur größer gesetzt.

### Ansichtsoptionen-Icon (Toolbar)

Das Filter-Symbol (list-filter) in der Pane-Toolbar öffnet ein Menü mit
Gruppierung (`groups.autoMode`), Kopfzeilen-Dichte (`groups.headerDensity`)
und „Nicht gruppiert"-Bereich (`groups.showUngrouped`) — dieselben drei
Optionen wie auf der Einstellungsseite, nur ohne dorthin wechseln zu müssen.
Spiegelt Hermes Desktops Sidebar-Filter-Icon in Form und Platzierung.

### Filter-Parität (`view.*`)

Seit v1.19.0 spiegelt die `view.*`-Settings-Gruppe 1:1 die Filter-/Sortier-
Möglichkeiten der Hermes-Sidebar. Alle Werte werden in `$settings.view`
persistiert; die Toolbar-„Ansichtsoptionen"-Verweise sind Verweise auf
dieselben Keys, also reicht ein Setzen in der Einstellungsseite.

| Key | Typ | Default | Effekt |
|---|---|---|---|
| `view.ordering` | `'updated'\|'created'\|'status'\|'tokens'\|'cost'` | `'updated'` | Sortierung der Zeilen je Sektion. `updated` = letzte Aktivität, `created` = Startzeit, `status` = Busy-Rang, `tokens`/`cost` = REST-Aggregat (degradiert sauber, wenn REST-Door fehlt). |
| `view.statusFilter` | `string[]` | `[]` | Multi-Select: `working`/`needs-input`/`unread`/`draft`/`idle`. Leer = alle Status. `working`+`needs-input` lesen aus dem Live-Map, `unread`/`draft` aus dem REST-Payload. |
| `view.projectFilter` | `string[]` | `[]` | Multi-Select aus der Projektliste (echte Projekt-IDs + `__no_project__`). Leer = alle Projekte. |
| `view.showArchived` | `bool` | `false` | Blendet den Archiv-Filter-Slot in der Toolbar ein (eigene Liste via REST `archived=only`, 60-s-TTL). |
| `view.showTokens` | `bool` | `false` | Token-Badge (`Σ input+output`) pro Zeile. |
| `view.showCost` | `bool` | `false` | Kosten-Badge (`estimated_cost_usd` / `actual_cost_usd`) pro Zeile. |
| `view.showProfile` | `bool` | `false` | Profil-Badge (Hermes-Profile-Tag aus `/api/profiles/sessions`) pro Zeile. |

Zusätzlich: „Alle einklappen/ausklappen" + „Alle als gelesen" (Bulk-PATCH
`unread:false` via REST). Reihenfolge: zuerst `statusFilter`, dann
`projectFilter`, dann `ordering`. Wird ein Filter aktiv und das Ergebnis ist
leer, zeigt die Pane einen eigenen Leerzustand (`filterEmpty`/`filterEmptyHint`),
nicht das allgemeine `empty`.

### Projekt-Ordner-Gruppierung (`groups.autoMode: 'project'`)

Gruppiert alle (nicht manuell zugewiesenen) Sessions nach **derselben
Backend-Quelle wie Hermes Desktops eigene Sidebar**: dem Projekt-Baum aus
`projects.tree` (`tui_gateway/methods_projects.py` →
`project_tree.build_tree()`). Der Baum enthält pro Projekt-Knoten
(`ProjectTreeNode`) bereits die vollständige, serverseitig berechnete
Liste aller Session-IDs (`sessionIds`) — Session Flow bildet die Zuordnung
also NICHT selbst per Pfad-Abgleich nach, sondern schlägt jede Session-ID
direkt im Baum nach. Das ist bewusst so: `session.list` liefert keine
`cwd`/`git_repo_root` pro Zeile, ein Client-seitiger Pfadvergleich lief
deshalb historisch immer ins Leere („Kein Projekt" für alles).

- **Zuordnung**: Session-ID ∈ `ProjectTreeNode.sessionIds` → dieses
  Projekt (Name, Farbe, Icon, Pfad kommen aus demselben Knoten). Der
  synthetische Home/„Kein Projekt"-Knoten (`isNoProject`) zählt als „nicht
  zugeordnet"; eine ID, die in keinem Knoten auftaucht (z. B. neuer als der
  Baum oder jenseits von `session_limit: 2000`), ebenfalls.
- **Identität (Icon/Farbe)**: Trägt das zugeordnete Hermes-Projekt ein
  eigenes Icon (`node.icon`), zeigt der Header genau dieses Icon —
  optional in der Projektfarbe (`node.color`) eingefärbt. Nur eine Farbe
  ohne eigenes Icon ergibt einen Farbpunkt wie bei manuellen Gruppen. Ohne
  beides (auch bei Auto-Projekten per Git-Root) bleibt es beim Ordner-Icon
  (offen/geschlossen je Collapse-Zustand).
- **Header-Optik**: der Ein-/Ausklapp-Caret ist wie unter „Projekte" erst
  beim Überfahren sichtbar. Ein Hover-„+" startet eine neue Session direkt
  mit diesem Projektpfad (`session.create` + `cwd_explicit`).
- **Drag & Drop**: Einen Tab auf einen Projekt-Header gezogen verschiebt die
  Session wirklich dorthin (`session.workspace.move`) — keine reine
  Listen-Umsortierung. Während des Ziehens markiert sich Header **und**
  Section als Zielzone, ein Inline-Hinweis nennt das Ziel; nach dem Loslassen
  blitzt die Zeile kurz in der Akzentfarbe auf.
- **Projekt-Cache**: `$projectsList` pollt `projects.tree` alle 60 s
  (zusätzlich einmal beim Laden und 1,2 s nach jeder Session-Aktualisierung
  via `scheduleSessionsRefresh`) — hält den Baum nah genug an der Liste,
  ohne ihn ständig anzufragen.

## UI-Tabs (Content-Tab-Leiste)

Style-Verbesserungen für die Tabs des **Content-Bereichs** (alle Panes), im
Design der Sidebar-Sessions. Läuft rein über CSS-Tokens auf `<html>`
(`data-sf-ui-tabs`) + DOM-Markierung `data-sf-tab-busy` (Live-Status der
Session-Tabs aus derselben Engine wie die Sidebar).

| Key | Default | Wirkung |
|---|---|---|
| `uiTabs.enabled` | `true` | Master. Aus = App-Standard-Optik. |
| `uiTabs.radius` | `4` | Ecken-Radius der Tabs in px (0–12). |
| `uiTabs.gap` | `2` | Horizontaler Abstand zwischen Tabs in px (0–10). |
| `uiTabs.insetY` | `2` | Vertikaler Abstand zur Leistenkante in px (0–8; 0 = volle Höhe). |
| `uiTabs.separators` | `false` | Feine Trennlinien zwischen Tabs behalten. |
| `uiTabs.activeStyle` | `sidebar` | `sidebar` (gefüllt wie Sidebar-Zeile), `underline` (App) oder `both`. |
| `uiTabs.labelCase` | `normal` | `normal` (wie getippt) oder `upper` (App-Stil). |
| `uiTabs.labelSize` | `11` | Schriftgröße des Tab-Titels in px (10–13). |
| `uiTabs.showLead` | `true` | Status-Punkt (Live-State + Farbe aus der Sidebar) im Tab. |
| `uiTabs.closeMode` | `hover` | Sichtbarkeit des ✕: `hover`, `always` oder `active` (nur aktiver Tab). |
| `uiTabs.closeWidth` | `22` | Klickfläche des ✕ in px (14–32; setzt `--pane-tab-close-width`). |
| `uiTabs.closeHover` | `true` | Weicher Hover-Chip hinter dem ✕. |
| `uiTabs.arc` | `true` | Umlaufender Glow-Ring auf Tabs arbeitender Sessions (denkt/schreibt/Tools). |

Hinweise:

- **Schnellauswahl**: Die Presets **„Sidebar-Look"** (empfohlen, Default),
  **„Minimal"** (flach, ohne Status/Glow) und **„Hermes-Standard"** (App-Optik) setzen die
  Sektion in einem Klick — jede Option darunter bleibt danach feinjustierbar.
- Gilt für **alle** Tab-Leisten, einschließlich der gestapelten Session-Tabs im
  Content-Bereich (auch hinter deren Kontextmenü-Wrapper).
- Der Glow nutzt dieselben Tokens wie „Glass" (`--sf-arc-width`/-`duration`) und
  pausiert mit `prefers-reduced-motion` bzw. `data-renderer-animations-paused`.
- Die Status-Infos kommen aus der Plugin-Aktivitäts-Engine (`$activity`/`$liveMap`,
  Gateway-Events) — dieselbe Quelle wie die Icons der Session-Flow-Pane.

## Glass & Lesbarkeit

Optionaler Frost-Effekt, der Eingabefeld und Chips eine lesbare Fläche gibt
(dezenter, akzentgefärbter Verlauf als Transparenz-Overlay). Umsetzung: die
Einstellungen werden als `data-sf-glass`-Tokens + Custom Properties auf `<html>`
gespiegelt; das Plugin-CSS reagiert rein per Selektor — kein CSS-Rebuild, kein
`!important` auf `backdrop-filter` (der „Transparenz reduzieren"-Gate der App
greift weiterhin automatisch).

| Key | Default | Wirkung |
|---|---|---|
| `glass.enabled` | `true` | Master-Schalter. Aus = Tokens/Variablen werden restlos entfernt. |
| `glass.blurPx` | `10` | Blur-Stärke in px (0–40; Chips ×0.75, Statusleiste ×0.6). |
| `glass.saturate` | `115` | Sättigung in % (100–200). |
| `glass.fill` | `86` | Deckkraft der Grundfläche in % (50–94; gilt für Composer-Fill inkl. Dock-Karten). |
| `glass.tint` | `8` | Anteil Akzentfarbe in der Fläche in % (0–40). |
| `glass.gradient` | `true` | Verlaufs-Overlay aus der Akzentfarbe. |
| `glass.angle` | `165` | Verlaufs-Winkel in ° (0–360). |
| `glass.gradOpacity` | `12` | Stärke des Verlaufs in % (0–60). |
| `glass.reach` | `72` | Position (in %), ab der der Verlauf vollständig transparent ist (20–100). |
| `glass.ring` | `true` | Hauchdünne, akzentgefärbte Innenkontur um Chips (box-shadow, kein Layout-Shift). |
| `glass.arc` | `true` | Umlaufender Glow-Ring um die Ränder (wie bei laufenden Sessions in Hermes). |
| `glass.arcMode` | `always` | `always` (immer) oder `busy` (nur während die aktuelle Session arbeitet). |
| `glass.arcWidth` | `1.5` | Dicke des Lichtpunkts in px (0.5–4). |
| `glass.arcDuration` | `3.2` | Dauer eines Umlaufs in Sekunden (1–12). |
| `glass.scopes.composer` | `true` | Eingabefeld (Composer-Oberfläche + Dock-Karten) inkl. Blur. |
| `glass.scopes.chips` | `true` | Modell- und Reasoning-Pill im Composer. |
| `glass.scopes.statusbar` | `false` | Einträge der Statusleiste. |

Hinweise:

- **Performance**: Blur auf dem Eingabefeld kostet beim Scrollen/Streamen etwas
  GPU. Wenn es sich je zäh anfühlt: `glass.blurPx` senken oder
  `glass.scopes.composer` abschalten.
- **Handles**: Chips werden über stabile App-Hooks adressiert
  (`[data-tour='model-pill']`, `[data-testid='reasoning-pill']`); die
  Modell-Pill existiert nur im Primär-Chat, die Reasoning-Pill überall.
- Im **HUD-Modus** gewinnt bewusst die HUD-eigene Gestaltung (dort nullt die
  App Backdrop-Filter mit `!important`).

## Gruppe vs. Session-Farbe

- **Gruppenfarbe**: eigener Swatch-Picker im Gruppen-Dialog (Rechtsklick auf
  die Gruppen-Überschrift).
- **Session-Farbe**: Rechtsklick auf einen Tab → „Session-Farbe". Diese Farbe
  setzt `host.sessions.setColor` und erscheint damit auch auf der
  Core-Sidebar-Zeile (gleiche Quelle).

## Individualisierung

Eigene Akzentfarbe und eigener Chat-Hintergrund. Alle Optionen sind standardmäßig
**aus** — es ändert sich nichts, bis du sie einschaltest. Einzige Ausnahme:
die **Pane-Fläche** steht seit v1.20.0 auf `native` und macht das Session-Flow-
Pane farbgleich mit der nativen Sessions-Sidebar.

### Pane-Fläche (Key `personal.paneSurface`)

- Hintergrund des gesamten Session-Flow-Panes (Content-Bereich). Bis v1.19
  fiel die Fläche auf die Chat-Farbe des Fensters durch — jetzt wählbar:
  - **Native Sidebar** (`native`, Default): exakt dieselbe Variable, die auch
    die eingebaute Hermes-Sessions-Sidebar malt
    (`--ui-sidebar-surface-background`) — folgt Theme- und Glass-Varianten
    automatisch.
  - **Chat** (`chat`): die Chat-Surface-Farbe (`--ui-chat-surface-background`),
    der bisherige Look.
  - **Ohne** (`none`): kein eigener Fill — der App-Untergrund scheint durch.
- Technik: `data-sf-panesurface`-Attribut auf `<html>`, deklarative CSS-Regeln
  auf `.sf-pane`; beim Plugin-Dispose wird der Fill restlos entfernt.

### Akzent-Tönung (Keys `personal.accent*`)

- **Akzentfarben-Tönung** (`accentOn`): wendet deine Akzentfarbe auf elementare
  UI-Elemente an — Buttons, aktive Zustände, Hover, Fokusringe, Hervorhebungen.
  Status-Farben (Rot/Grün/Gelb) bleiben unverändert.
- **Akzentfarbe** (`accentColor`): Swatch-Reihe der Theme-Palette oder Hex-Wert
  (`#rrggbb`) — unvollständige Eingaben werden ignoriert, bis sie gültig sind.
- **Zurücksetzen** (Swatch-„Zurücksetzen"): stellt die Standard-Akzentfarbe ein.
- Deaktivieren stellt sofort die Theme-Akzentfarbe wieder her.

### Chat-Hintergrund (Keys `personal.bg*`)

- **Chat-Hintergrund** (`bgOn`): zeigt ein eigenes Bild oder Video hinter den
  Chat-Nachrichten.
- **Art des Hintergrunds** (`bgKind`): Bild oder Video (stumm, läuft in
  Schleife; der Datei-Picker erkennt die Art automatisch an der Endung).
- **Datei** (`bgPath`): absoluter Pfad zu einer lokalen Bild-/Videodatei — über
  „Datei wählen…" (nativer Dialog) oder eintippen. Die Ausgabe läuft über das
  App-Protokoll `hermes-media://stream/…` (unterstützt auch große Dateien).
- **Darstellung** (`bgFit`): Füllen (`cover`) oder Einpassen (`contain`).
- **Abdunkeln %** (`bgDim`, 0–85): dunkler Overlay für Lesbarkeit.
- **Weichzeichnen px** (`bgBlur`, 0–24): weicher Blur auf dem Hintergrund.
- **Gilt für** (`bgScope`): nur Chat-Sessions oder alle Pane-Ansichten.
- Technik: Der Layer liegt direkt in der Chat-Surface (`[data-chat-surface]`, stabiler
  App-Marker); deren `isolate`-Kontext lässt ein `z-index:-1`-Kind über der Fläche und
  unter dem Inhalt zeichnen. Bei „alle" kommen Zonen ohne Chat-Surface dazu (deren
  Fläche wird dafür per Variablen-Override transparent). Videos laufen nur auf
  sichtbaren Panes.

### Kontext-Anzeige

- Ist `tabs.ctxPie` aktiv, zeichnet die Zeile einen Donut (Ring außen, Loch innen);
  die Prozentzahl sitzt im Loch und bleibt durch den Text-Schatten lesbar.
  Details siehe Sektion **Session-Tabs** (`tabs.ctxPie`).

## Über

- **Version**: die aktuell von der App geladene Plugin-Version.
- **Entwickler & Lizenzinhaber**: AGANTILA — Deniz Yilmaz (agantila.com).
- **Lizenz**: MIT (Open Source) — frei nutzbar, veränderbar und teilbar.
- **Zähler**: Sessions und manuelle Gruppen in der aktuellen Liste.
- **Zurücksetzen**: „Einstellungen zurücksetzen" und „Gruppen zurücksetzen"
  stellen den Auslieferungszustand wieder her.
