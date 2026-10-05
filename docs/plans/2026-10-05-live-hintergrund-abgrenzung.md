# Live-Hintergrund klar von der Auswahl abgesetzt

- **Status**: Done
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: 2026-10-05
- **Betrifft**: plugin.js (Row-CSS `[data-live=busy|waiting]` unter `data-sf-rowlive`; Liste & Grid)
- **Version**: 1.17.2

## Anforderung

> Der Hintergrund der Aktiven Sessions in der Darstellung soll sich
> stärker von dem Selektierten unterscheiden.

## Kontext

Mit `tabs.rowLive` trugen aktive Zeilen bisher eine flache Akzent-Tönung
(Akzent 9 %); die Auswahl-Tönung des Nutzers (`tabs.selTint: accent`) ist
ebenfalls eine flache Tönung (Akzent 16 %). Live-Messung per DOM-Probe
(2026-10-05 01:58, echte App):

- aktiv (busy):      `linear-gradient(color(srgb .35 .65 1 / .09), …)` + Inset-Ring 28 %
- selektiert:        `linear-gradient(color(srgb .35 .65 1 / .16), …)`

Beide als flache Washes praktisch nicht auseinanderzuhalten (zusätzlich per
Screenshot-Sichtprüfung bestätigt). Da aktive Sessions in der neuen
„Aktiv"-Sortierung sehr präsent sind, fällt das besonders auf.

## Scope

- Live-Hintergrund (busy + waiting) wird ein Richtungs-Verlauf mit linker
  Live-Schiene:
  `linear-gradient(90deg, akzent 70% 0 3px, transparent 3px)`,
  `linear-gradient(90deg, akzent 26% 0, akzent 7% 112px)`,
  darüber der bestehende Zeilen-Verlauf (`--sf-row-layer`).
- Wartend (Bernstein) erhält dieselbe Form.
- Inset-Ring, Puls und Live-Frame bleiben unverändert; wirkt in Liste & Grid
  (gleiche Selektoren).

## Nicht-Scope

- Keine Änderung an der Auswahl-Tönung (`selTint/selBorder/selShadow/…`).
- Kein neues Setting — `rowLive` bleibt der eine Schalter (Form ist jetzt
  fix Teil des Live-Stylings).

## Umsetzung

plugin.js: zwei CSS-Zeilen (`[data-live=busy]`, `[data-live=waiting]`) +
erklärender Kommentar; Version 1.17.2.

## Verifikation

- Style-Test Sektion 15 (Chromium): Aktiv-Zeile (Liste + Grid) beginnt mit
  `linear-gradient(90deg …)` (Schiene + Verlauf, 2× 90deg); Auswahl-Zeile
  bleibt flach.
- `npm run check` / `npm test` / `npm run test:style` — siehe Commit.
- Live im Hermes-Desktop: berechnete Hintergründe der aktiven Zeilen per
  DOM-Probe geprüft; Screenshot-Sichtprüfung „aktiv vs. selektiert".

## Follow-ups

- Falls die Schiene im Alltag zu präsent wirkt: Breite/Deckkraft als
  Feintuning-Kandidat (kein Setting geplant, erst Feedback abwarten).
