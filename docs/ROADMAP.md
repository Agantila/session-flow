# Roadmap & bekannte Grenzen

Stand: v1.5.1 (2026-10-03). Reihenfolge = grobe Priorität, nichts davon ist
zugesagt.

## Geplant / Ideen

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
