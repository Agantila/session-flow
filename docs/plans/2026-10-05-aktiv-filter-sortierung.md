# Aktiv-Subtab: alle Sessions, sortiert nach letzter Aktivität

- **Status**: Done
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: 2026-10-05
- **Betrifft**: plugin.js (`SessionsPane` — Filter-Leiste/`filteredSections`, neuer Helfer `lastActivityAt`)
- **Version**: 1.17.1

## Anforderung

> Der Subtab Aktiv soll Aktive Sessions anzeigen und auch nicht aktive nach
> aber geordnet nach der zweit absteigend der letzten aktivität

(Original-Wortlaut, 2026-10-05 — „geordnet nach der Zeit absteigend der
letzten Aktivität", Tippfehler im Original.)

## Kontext

Seit v1.14.0 gibt es die Filter-Leiste; ihr Schnellfilter „Aktiv" blendete
bislang alle Sessions mit Aktivitäts-Status `idle` aus (nur
busy/waiting/streaming/working blieben sichtbar). Damit verschwanden
abgeschlossene Sessions komplett aus dieser Ansicht, und „Aktiv" war in der
Praxis eher ein Vier-Augen-Blick als eine Nutzungs-Perspektive. Gewünscht
ist stattdessen eine **Reihenfolge**: alles anzeigen, das Zuletzt-Aktive
zuerst.

Datenlage: `session.list` liefert kein `last_active` (nur
`id/title/preview/started_at/message_count/source`); Live-Sessions reichert
das Plugin aus `session.active_list` an (`$liveMap[x].lastActive`, aus
`last_active` × 1000). Für Bestands-Sessions ohne Live-Signal dienen die
zuletzt gesehenen Gateway-Events (`$activity[id].at`) als Zwischenstufe,
sonst die Startzeit.

## Scope

- Schnellfilter „Aktiv": keine Ausblendung mehr; stattdessen Sortierung der
  Zeilen je Sektion nach `lastActivityAt` absteigend.
- `lastActivityAt(row, live, activity) = max(live.lastActive, event.at, startedAt)`.
- Pane-Abo auf `$liveMap` (30-s-Poll) → Reihenfolge bleibt aktuell.
- Zähler & Leerzustand: nur noch die Textsuche gilt als aktiver Filter
  (`filterActive = Boolean(needle)`); `Alle` unverändert.
- Render-Smoketest Sektion 23 (alle Zeilen sichtbar, Live-Zeile zuerst,
  Fallback Startzeit).

## Nicht-Scope

- Keine Persistierung des Filters (bewusst ephemeral, wie App-Vorbild —
  siehe ROADMAP „Filter-Leiste persistieren (optional)").
- Keine Änderung an `Alle` (Startzeit-Reihenfolge) oder am Grid-Layout.
- Kein Server-Side-Sort — `session.list`-Payload-Grenze bleibt (ROADMAP).

## Umsetzung

plugin.js, `SessionsPane`: `liveForSort = useValue($liveMap)`;
`matchesFilter` ohne Aktiv-Zweig; `filteredSections` sortiert bei
`filterMode === 'active'` eine Array-Kopie je Sektion mit
`lastActivityAt`. Helfer neben `activityFor`. Version 1.17.1.

## Verifikation

- `npm run check`, `npm test` (u. a. Sektion 23: alle Zeilen sichtbar;
  Live-Zeile wandert nach oben; Fallback Startzeit), `npm run test:style`
  — Ergebnis siehe Commit-Nachricht (2026-10-05).
- Live im Hermes-Desktop: „Aktiv" über die echte Filter-Leiste umgeschaltet
  und Zeilenanzahl/-reihenfolge per DOM-Probe geprüft; danach zurück auf
  „Alle" gestellt (selbstheilend, kein Zustand bleibt zurück).

## Follow-ups

- Serverseitiges `last_active` für Bestands-Sessions (über `session.list`
  hinaus) bleibt offen — dann könnte die Sortierung exakt statt
  Fallback-Kette sein. Siehe ROADMAP „`session.list`-Payload".
