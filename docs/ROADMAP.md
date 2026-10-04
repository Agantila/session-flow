# Roadmap & bekannte Grenzen

Stand: v1.13.4 (2026-10-04). Reihenfolge = grobe Priorität, nichts davon ist
zugesagt.

## Zuletzt umgesetzt (Referenz für Weiterentwicklung)

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

## Geplant / Ideen

- **Donut-Feinschliff**: Ringdicke/Lochgröße als Option, einstellbare
  Warnschwellen (statt fix 70/90 %) und alternatives Label (`used/max`).
- **Status-Glyphen wählbar**: Icon je Status selbst festlegen (statt fester
  Zuordnung in `ACTIVITY_GLYPHS`).
- **Presets für weitere Sektionen**: Ein-Klick-Looks auch für „Glass" und
  „Chat-Animation" (gleiche Machart wie die UI-Tabs-Presets).
- **Einstellungen exportieren/importieren**: Sektion (oder alles) als JSON —
  zum Teilen von Setups zwischen Rechnern/Profilen.
- **Multi-Profil-Ansicht**: Session-Liste über alle Profile
  (`profiles.list` + Fan-out über `session.list`).
- **Freies Umsortieren**: Gruppen und Tabs per DnD in eigene Reihenfolge
  (aktuell: Erstellungsreihenfolge).
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
