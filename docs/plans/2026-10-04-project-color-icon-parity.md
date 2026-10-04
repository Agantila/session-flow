# Projekt-Ordner-Gruppierung: Name/Farbe/Icon aus Hermes-Projekten übernehmen

- **Status**: Done
- **Erstellt**: 2026-10-04
- **Abgeschlossen**: 2026-10-04
- **Betrifft**: `plugin.js` (`$projectsList`, `matchProjectForCwd`,
  `buildSections()`, `SectionHeader`), `tests/render-test.mjs`,
  `docs/SETTINGS.md`, `CHANGELOG.md`, `package.json`
- **Version**: 1.16.0

## Anforderung

Wörtlich aus dem Auftrag:

> „Die Option 'Nach Projekte-Ordner' Gruppiert nicht wie in Hermes
> Sidepanel 'Sessions' mit dem Namen und den einstellungen wie Farbe und
> Icon für das Projekt. Das soll mit unterstützt werden."

## Kontext

Die Projekt-Ordner-Gruppierung (`groups.autoMode: 'project'`, seit v1.14.0)
übernahm bisher nur den **Namen** aus `projects.list` (bzw. den Ordnernamen
als Fallback) und zeigte immer ein generisches Ordner-Icon mit Auf/Zu-
Wechsel. Hermes Desktops eigene Projekte-Sidebar (`projects/overview-row.tsx`
→ `projectIcon()`) berücksichtigt zusätzlich die vom Nutzer gesetzte
**Farbe** (`project.color`) und ein optionales **eigenes Icon**
(`project.icon`): ein Projekt mit Icon zeigt dieses (optional eingefärbt),
eins mit nur Farbe einen Farbpunkt, eins ohne beides den generischen
Ordner-Icon-Fallback (`folder-library`/`repo`/`home`). Das fehlte in Session
Flow komplett — `$projectsList` cachte nur `{id, name, path}`.

## Scope

- `$projectsList`-Cache um `color`/`icon` aus der `projects.list`-Antwort
  erweitert (`project.color`/`project.icon`, Wire-Felder laut
  `hermes-agent`-Checkout bestätigt).
- `projects.list`-Fallback-Pfad erweitert: Projekte ohne `primary_path`
  (Mehrordner-Setups) werden über `folders[0].path` gefunden statt aus der
  Zuordnung zu fallen.
- Neue Helfer `matchProjectForCwd()`/`basenameOf()` — `projectLabelForCwd()`
  darauf umgebaut (keine Logik-Verdopplung mehr).
- `buildSections()`: Projekt-Sektionen tragen jetzt `color`/`icon` aus dem
  Hermes-Projekt-Datensatz.
- `SectionHeader`: `lead`-Berechnung für Projekt-Kind erweitert — Priorität
  eigenes Icon (optional eingefärbt) > Farbpunkt (nur Farbe) > Ordner-Icon-
  Fallback (unverändert, unsere eigene Auf/Zu-Optik, wenn nichts gesetzt
  ist).

## Nicht-Scope (bewusst ausgeklammert)

- **Eigene Icon-/Farb-Auswahl FÜR Session-Flow-Gruppen aus dem Plugin
  heraus** — die Daten kommen nur LESEND aus Hermes' `projects.list`; ein
  Schreibpfad (Projekt-Icon/Farbe aus der Pane heraus ändern) ist nicht
  Teil dieser Anforderung und bliebe ohnehin an `ProjectMenu`/den
  Projekt-Dialog in Hermes Desktop selbst gebunden.
- **Auto-discovered Repos ohne projects.db-Eintrag** (`isAuto` in Hermes)
  bekommen in unserer Umsetzung keinen speziellen `repo`-Icon-Fallback wie
  in Hermes — unser Ordner-Auf/Zu-Icon deckt diesen Fall ausreichend ab;
  eine 1:1-Unterscheidung bräuchte zusätzliche Wire-Felder, die
  `projects.list` laut Recherche nicht zuverlässig liefert.

## Umsetzung

Siehe `CHANGELOG.md` → `[1.16.0]` für die Nutzer-Perspektive. Kernänderungen
in `plugin.js`: `refreshProjectsList()`-Mapping erweitert,
`matchProjectForCwd()`/`basenameOf()` neu, `buildSections()`-Projekt-Zweig
und `SectionHeader`-`lead`-Berechnung angepasst (siehe Diffs).

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM)
✓ EN: alle 384 benutzten Keys vorhanden
✓ DE: alle 384 benutzten Keys vorhanden

$ npm test
… (81 Checks grün) …
✓ v1.16.0: Projekt mit Farbe (ohne Icon) zeigt einen Farbpunkt im Kopf
✓ v1.16.0: Farbpunkt-Fall — Kopf trägt kein zusätzliches Lead-Icon
✓ v1.16.0: Projekt mit eigenem Icon zeigt das Lead-Icon statt Farbpunkt
✓ v1.16.0: Icon-Fall — Kopf trägt keinen Farbpunkt
✓ v1.16.0: Projekt ohne Icon/Farbe behält das Ordner-Icon (kein Punkt, keine Einfärbung)

$ npm run test:style
=== STYLE-TEST BESTANDEN (Chromium Computed-Styles) ===
```

Test-Falle unterwegs: die erste Testfassung suchte `.sf-group-dot`/
`.sf-group-lead-icon` GLOBAL über die ganze Pane — das Zeilen-Kontextmenü
(„Farbe setzen", `PROFILE_SWATCHES`) baut im Render-Walker IMMER mit, egal
ob sichtbar, und enthält selbst `.sf-group-dot`-Elemente. Fix: Prüfung auf
die direkten Kinder des Kopf-`<div>` selbst beschränkt (`rawKids`/`rawHas`,
wie schon in Testsektion 19 etabliert).

Nicht live im laufenden Hermes-Desktop getestet (kein laufender App-Prozess
in dieser Sitzung) — Empfehlung siehe Follow-ups.

## Follow-ups

- **Manuelle Live-Verifikation**: ein Hermes-Projekt mit gesetzter Farbe
  und/oder eigenem Icon anlegen (Projekt-Dialog in Hermes Desktop), Session
  Flow auf „Nach Projekt-Ordner" stellen und prüfen, dass der Gruppen-Kopf
  exakt diese Identität zeigt.
