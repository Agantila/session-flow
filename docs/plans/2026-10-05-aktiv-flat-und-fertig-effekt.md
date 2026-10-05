# Aktiv-Flat + Fertig-Effekt

- **Status**: Done
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: 2026-10-05
- **Betrifft**: plugin.js (`SessionsPane` Aktiv-Modus, `$doneFx`/`noteSessionDone`, `pollLiveSessions`, Row-CSS, Settings)
- **Version**: mit dem nächsten Release (parallel hält v1.18.0)

## Anforderung

> Der Subtab "Aktiv" Soll nur Sessions die Aktiv sind oben und heute aktiv
> waren anzeigen. Keine Kopfzeilen sondern nur eine Liste der Sessions. Wenn
> eine Session fertig geworden ist soll sie einmal dezent aufglühen und auch
> kurz dezent animiert in der x Achse perspektivisch wackeln was ich auch
> einstellen kann welche Achse und wie stark der Effekt. Füge auch noch andere
> passende Effekte mit animation hinzu.

## Kontext

Der Aktiv-Modus sortierte zuletzt (v1.17.1/v1.17.3) alle Sessions nur neu;
gewünscht ist jetzt eine echte Fokus-Ansicht (nur Laufendes + Heute) ohne
Gruppen-Kopfzeilen. Für den „Fertig"-Moment gab es bisher keinen Effekt; die
Event-Sonde zeigte, dass `message.complete` die Session-ID liefert.

## Scope

- Aktiv-Modus: flache Liste (`.sf-list-flat`), busy-Sessions oben, darunter
  nur Sessions mit heutiger Aktivität (lokale Mitternacht), je nach letzter
  Aktivität; Suche kombiniert; Zähler/Leerzustand inklusive.
- Fertig-Effekt `tabs.doneFx` (glow/wobble/glow-wobble/shine/pop, Default
  glow-wobble) mit `tabs.doneFxAxis` (x/y/z) und `tabs.doneFxStrength`
  (subtle/medium/strong); Trigger: message.complete → frischer Poll →
  Transition beschäftigt→ruhig; Poll bereinigt die Aktivität sofort.

## Nicht-Scope

- Keine Persistenz des Filters; kein Server-Kontakt (weiterhin clientseitig).
- Kein Effekt-Sound, keine Effekte in anderen Panes (nur Session-Zeilen).

## Umsetzung

Siehe Commit `Aktiv-Flat` (vollständige Transform-Liste im Session-Verlauf);
Kern: `activeFlatRows`-Memo + `flatList` + Body-Verzweigung; `$doneFx`,
`noteSessionDone`, Poll-Transition + Message-Complete-Forcing; CSS-Keyframes
sf-done-glow/-wob-x/y/z/-pop/-sweep; Settings-Rows + i18n (EN/DE).

## Verifikation

- `npm run check` / `npm test` (Sektion 23 umgestellt, 25 neu) /
  `npm run test:style` (Sektion 16) — grün im isolierten Commit-Stand.
- Live im Desktop: Aktiv-Modus + Effekt-Trigger per DOM-Probe geprüft.

## Follow-ups

- „Fertig"-Definition: aktuell busy→ruhig; ein früherer Doppel-Poll kann bei
  sehr kurzen Läufen den busy-Zwischenstand verpassen (dann kein Effekt).
- Sound/Haptik für den Fertig-Moment als Idee für die Roadmap.
