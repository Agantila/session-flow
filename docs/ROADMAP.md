# Roadmap & bekannte Grenzen

Stand: v1.20.0 (2026-10-06). Reihenfolge = grobe Priorität, nichts davon ist
zugesagt.

## Zuletzt umgesetzt (Referenz für Weiterentwicklung)

- **App-Schnellstart-Zeile + Pane-Fläche** (v1.20.0): Icon-Button-Zeile über
  der Toolbar (Neue Session, Fähigkeiten, Messaging, Artefakte, Geplante
  Jobs, Kanban bei laufendem Plugin) mit `host.navigate`-Whitelist und
  flex-wrap-Umbruch; Pane-Hintergrund wählbar (Einstellungen →
  Individualisierung → Pane-Fläche): **Native Sidebar** (Default, exakt die
  Variable der nativen Sessions-Sidebar), **Chat** (bisheriger Look),
  **Ohne**. Pläne: `docs/plans/2026-10-05-app-nav-icon-row.md`,
  `docs/plans/2026-10-06-pane-surface-option.md`.
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
| Tab-Selektor-Modus | `tabs.asTabSelector` blendet **jeden** Streifen mit Session-Tabs aus — auch gestapelte Tabs im Content-Bereich (`tabs.openIntent: 'stack'`/`'tab'`) verlieren damit ihre eigene Leiste; bewusster Trade-off laut Anforderung. |
| Filter-Leiste | Rein clientseitig, nicht persistiert; wirkt nur auf die bereits geladenen Sessions (`tabs.maxItems`), kein Server-Side-Search. „Aktiv" sortiert clientseitig nach letzter Aktivität (Bestand ohne Live-Signal: Startzeit). |
| `session.list`-Payload | Liefert dem Plugin nur `id/title/preview/started_at/message_count/source` — Branch/`tool_call_count` fehlen (Modell + „zuletzt aktiv“ werden für Live-Sessions aus `session.active_list` nachgereicht). |

