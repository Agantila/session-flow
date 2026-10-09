# Planung — Prozess, Template & Lebenszyklus

Dieses Dokument ist die **Anleitung** für das Plan-System unter `plans/`. Es
beantwortet: wann wird ein Plan angelegt, was muss drinstehen, wie wird er
geschlossen, und wie hält er sich auf Dauer nützlich (statt zu verstauben).

Der Kurz-Verweis dazu lebt in `AGENT-GUIDE.md` (Abschnitt 2) — dort beginnt
jede Sitzung; hier stehen die Details.

## Warum ein Plan-Ordner (und nicht nur Commits/CHANGELOG)?

- **Commits** zeigen *was* geändert wurde, selten *warum* — und nie die
  Alternativen, die verworfen wurden.
- **CHANGELOG.md** ist eine Nutzer-/Release-Perspektive: knapp, versioniert,
  ohne Implementierungs-Abwägungen.
- **ROADMAP.md** ist der aktuelle Zustand (was gilt jetzt), kein Verlauf.
- **Ein Plan** hält den Kontext einer einzelnen Arbeitssitzung zusammen:
  Anforderung (so wörtlich wie möglich), Scope-Entscheidungen, was
  bewusst NICHT gemacht wurde und warum, Verifikations-Belege. Das ist genau
  das, was eine neue Sitzung (menschlich oder Agent) braucht, um dort
  weiterzumachen, wo die letzte aufgehört hat — ohne Diffs archäologisch
  auszugraben.

## Wann einen Plan anlegen

**Ja:**
- Neues Feature oder neue Einstellung.
- Verhaltensänderung, die mehr als eine Zeile betrifft oder mehrere Dateien
  berührt (Code + Doku + Tests).
- Jede Arbeit, die wahrscheinlich über eine Sitzung/einen Kontext hinausgeht.
- Jede Anfrage, die explizit nach „Dokumentation"/„Plan" fragt.

**Nein (direkt umsetzen, kein Plan-Overhead):**
- Typos, Formatierung, einzelne Zahlenwerte in `docs/SETTINGS.md` korrigieren.
- Ein-Zeilen-Bugfixes ohne Verhaltensänderung.
- Reine Rückfragen/Diskussion ohne Code-Änderung.

Im Zweifel: lieber einen kurzen Plan als keinen — er kostet wenig und zahlt
sich beim nächsten Anfassen der Datei aus.

## Lebenszyklus

```
Offen  →  In Arbeit  →  Done
              ↓
         Blockiert  →  (zurück zu „In Arbeit“, wenn das Hindernis fällt)
              ↓
         Verworfen  (mit Begründung — nie einfach löschen)
```

- **Offen**: Plan existiert, Umsetzung hat noch nicht begonnen.
- **In Arbeit**: wird aktiv bearbeitet (auch über mehrere Sitzungen).
- **Blockiert**: wartet auf etwas Externes (App-Update, Rückfrage an den
  Nutzer, fehlendes Gateway-Feature) — Begründung im Plan vermerken.
- **Done**: umgesetzt, verifiziert (siehe unten), in CHANGELOG/SETTINGS/
  ROADMAP nachgezogen.
- **Verworfen**: bewusst nicht umgesetzt — Begründung bleibt als Lektion
  erhalten (spart der nächsten Sitzung, dieselbe Idee erneut zu prüfen).

Pläne werden **nicht gelöscht**, wenn sie `Done`/`Verworfen` sind — sie bleiben
als durchsuchbares Archiv liegen. Bei sehr vielen Plänen kann ein
`plans/archive/`-Unterordner für Pläne vor >1 Jahr sinnvoll werden; aktuell
reicht die flache Struktur.

## Dateiname & Ablage

`plans/<YYYY-MM-DD>-<kurzer-slug>.md` — Datum = Tag der Plan-Erstellung
(nicht des Abschlusses), Slug = 3–6 Wörter, kebab-case, auf Englisch oder
Deutsch (konsistent mit dem Rest des Repos — hier Deutsch).

Beispiel: `plans/2026-10-04-grouping-filter-dnd-tab-selector.md`

## Template

Siehe `plans/TEMPLATE.md` für die kopierfertige Vorlage. Pflichtfelder:

| Feld | Inhalt |
|---|---|
| Status | Offen / In Arbeit / Blockiert / Done / Verworfen |
| Anforderung | So nah am Original-Wortlaut des Auftrags wie sinnvoll — das ist die Quelle der Wahrheit für „was wurde eigentlich verlangt". |
| Kontext | Was existierte vorher, was hat das motiviert (z. B. Verweis auf ein Vorbild wie die Hermes-Sidebar). |
| Scope / Nicht-Scope | Was gehört dazu, was explizit nicht (verhindert Scope-Creep UND verhindert, dass später jemand denkt, etwas sei vergessen worden). |
| Umsetzung | Kurze technische Zusammenfassung — Dateien, neue Stores/Funktionen, Settings-Keys. Kein Vollzitat des Diffs. |
| Verifikation | Welche Befehle liefen, mit welchem Ergebnis; manuell geprüfte Punkte. |
| Follow-ups | Was bewusst für später/Roadmap zurückgestellt wurde, mit Link auf den ROADMAP-Eintrag. |

## Pflege-Checkliste beim Abschließen eines Plans

1. Status → `Done`, Datum ergänzen.
2. `npm run check && npm test` grün — Ausgabe (oder Kurzfassung) im Plan
   unter „Verifikation" vermerken.
3. `../CHANGELOG.md`: Eintrag unter der betroffenen Version, Verweis auf den
   Plan-Dateinamen.
4. `SETTINGS.md`: neue/geänderte Keys eingetragen.
5. `ROADMAP.md`: „Zuletzt umgesetzt" ergänzt; erledigte „Geplant/Ideen"- oder
   „Bekannte Grenzen"-Einträge angepasst/entfernt.
6. `APP-INTEGRATION.md`: neue DOM-Anker/Theme-Tokens/Doors eingetragen, falls
   zutreffend.
7. `../package.json`-Version + `VERSION`-Konstante in `../full/plugin.js`
   synchron.
8. `README.md` (dieser Ordner) verlinkt neue Dateien, falls welche entstanden
   sind.

Diese Liste deckt sich mit der „Wartungs-Checkliste" in `APP-INTEGRATION.md`
(Punkt 5 dort verweist hierher) — beide Dokumente bewusst redundant, damit man
sie unabhängig vom Einstiegspunkt findet.
