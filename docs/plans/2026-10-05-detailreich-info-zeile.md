# Detailreich-Info-Zeile (aktueller Tool Call / Gedanke)

- **Status**: Done
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: 2026-10-05
- **Betrifft**: plugin.js (`ActivityTicker`, `$activityPrev`, `pollLiveSessions`, Gateway-Events, Row-CSS)
- **Version**: mit dem nächsten Release

## Anforderung

> Detailreich als Info-Dichte soll auch den aktuellen Tool Call oder die info
> "nachgedacht" oder "Gedanke - Info" animiert immer als eigene Info nach dem
> "aktiv" Zeit in Minuten in der dritten Zeile dannach mit darstellen. Die
> wechsel von Info zu Info soll mit einer Animation die die nächste info von
> unten nach oben hochschiebend einblendet und die vorherige nach oben raus
> schiebend ausblendet.

## Kontext

Die Detailreich-Dichte zeigte bisher nur Titel/Detail/Vorschau/Statistik.
Der „aktuelle Tool Call" war gar nicht verfügbar: die Aktivitäts-Engine
kannte nur Poll-Status (working/streaming/waiting) — die Gateway-Events
(`tool.start` mit `payload.name` u. a.) waren im Plugin **nicht verdrahtet**
(Event-Sonde + Desktop-Quelle `use-message-stream/gateway-event/` belegen sie).

## Scope

- Info-Zeile nur bei `tabs.infoDensity: detailed`: Icon + Label der aktuellen
  Aktivität (Tool Call mit Namen, „Denkt nach…", „Schreibt…", …), Position
  direkt unter der Detail-Zeile („zuletzt aktiv Xm"); ohne Aktivität keine
  Zeile (keine Phantom-Info).
- Wechsel-Animation per CSS: neue Info `sf-info-in` (von unten hoch), vorherige
  `sf-info-out` (nach oben raus); Vorwert aus `$activityPrev` (kein
  Komponenten-State nötig), Klipp-Container 14 px.
- Echtzeit-Events: `reasoning.delta`/`thinking.delta` → thinking,
  `message.delta` → streaming, `tool.generating`/`tool.start` → tool (+Name),
  `tool.complete` → thinking, `error` → error. Delta-Events setzen nur bei
  echter Änderung (kein Atom-Churn). `resolveStoredId` merkt sich die
  Runtime→Stored-Zuordnung.
- DE-Wortlaut `stThinking` → „Denkt nach…".

## Nicht-Scope

- Kein Reasoning-TEXT (die App liefert dem Plugin keinen Gedankeninhalt — nur
  Status/Tool-Namen).
- Keine Sound-/Haptik-Kopplung; keine Änderung an Komfortabel/Kompakt.

## Umsetzung

Siehe Commit (Transform-Liste P1–P11); Kern: `ActivityTicker` (stateless),
`stampActivityPrev` in `noteEvent` + Poll, `wireActivityEvent`-Block,
CSS-Keyframes `sf-info-in`/`sf-info-out`.

## Verifikation

- Render-Sektion 26 + Style-Test Sektion 17; `npm run check`/`test`/`test:style`
  im isolierten Commit-Stand grün.
- Live: Aktivitäts-Zeile der eigenen Session über DOM-Proben (Tool-Name/Status
  wechseln in Echtzeit) + Screenshot.

## Follow-ups

- Reasoning-Text in der Zeile, falls die Runtime ihn je im Event-Payload
  mitliefert (aktuell nicht der Fall).
- Optional: Info-Zeile auch für Komfortabel (Wunsch bisher nur Detailreich).

## Nachtrag — Zeile 2 in Komfortabel/Kompakt (2026-10-05)

> Diese dynamische Anzeige was in der Session passiert soll auch in den
> anderen Optionen "Komfortabel" und "Kompakt" in der zweiten Zeile angewendet
> werden und den inhalt der zweiten Zeile für die Darstellung ausblenden
> solange die Aktion läuft.

- `comfortable`: Die Aktivitäts-Zeile belegt die ZWEITE Zeile; die Detail-Zeile
  („Modell · Nachrichten · zuletzt aktiv …") wird ausgeblendet, solange die
  Aktion läuft, und kommt danach zurück.
- `compact`: hat regulär keine zweite Zeile — die Aktivitäts-Zeile erscheint
  dort nur während der Aktion.
- `detailed`: unverändert eigene dritte Zeile (Details bleiben sichtbar).
- Aktivitätszeile trägt jetzt `data-line: inline|extra` (Test-/Stil-Anker);
  Render-Sektion 27 prüft alle vier Kombinationen.
