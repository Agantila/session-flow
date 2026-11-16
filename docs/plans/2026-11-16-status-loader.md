# Status-Loader ersetzt den Core-Status-Punkt (Donut-Ring pro Zustand)

- **Status**: Done
- **Erstellt**: 2026-11-16
- **Abgeschlossen**: 2026-11-16 (v1.30.0)
- **Betrifft**: plugin.js (`tabs.statusStyle`, `StatusLead`, CSS-Block, i18n-Bundles EN/DE)
- **Version**: 1.30.0

## Anforderung

> Die Status-Darstellung für die Session-Einträge müssen wir überarbeiten. Die
> Option Icon plus Punkt soll Icon plus Loader sein. Und der Loader ist ist ein
> äußerer Kreis der wie ein Loader sich dreht mit einem ganz dezenten
> Glow-Effekt wenn etwas passiert und der alle Zustände visuell und farblich
> darstellt. Quasi dreht sich der Loader wie ein Ladebalken in einem Kreis wie
> ein Donut und dieser Donut-Animation spiegelt die Interaktion bzw. den Zustand
> wieder. Das ersetzt den Punkt, den wir jetzt haben.

> Die Optoin Icon+Loader soll übereinander liegen also das sie gemeinsam ein
> Icon Darstellen und nicht nebeneinander.

## Kontext

`tabs.statusStyle` kennt heute drei Modi: `glyph` (Aktivitäts-Icon),
`dot` (Core-Primitive `SessionStatusDot`) und `glyph+dot` (beides). Der Punkt
stammt aus dem Hermes-Core und malt nur einen statischen Status-Fleck ohne
eigenes Verhalten — die Interaktion (läuft, denkt, wartet, fertig, Fehler)
war nur über das Icon ablesbar.

Bis v1.29.3 galt im Repo ausdrücklich: „Kein eigener Status-Punkt. Der
Core-`SessionStatusDot` bleibt die einzige Statusquelle im Tab" (ROADMAP,
„Bewusst so gelassen") — Begründung war die Farb-Vokabel der App. Der Nutzer
widerruft diese Entscheidung ausdrücklich und verlangt einen eigenen Loader,
der ALLE Zustände abbildet. Der Loader übernimmt die Farb-Vokabel der App
(gleiche Token-Werte wie das Icon), damit die Entscheidung nicht farblich
bricht, sondern nur strukturell.

## Scope

- Neuer Modus-Wert `loader` (Ring statt Punkt) und `glyph+loader`
  (Icon + Loader). `dot` und `glyph+dot` bleiben als gespeicherte Werte
  gültig und werden per One-Shot-Migration auf die neuen Werte umgestellt.
- `StatusLoader`-Komponente: äußerer Ring (Donut), der sich wie ein Loader
  dreht — ein heller Kopf mit auslaufendem Schweif, der als „Ladebalken im
  Kreis" über den Ring läuft.
- Zustandsabbildung über den bestehenden Aktivitäts-Kindern
  (`thinking`/`streaming`/`tool`/`working`/`waiting`/`done`/`unread`/`error`/
  `idle`): Farbe + Rotation + Glow je Zustand.
- Dezenter Glow-Impuls, wenn der Zustand wechselt (Element wird per `key`
  neu aufgebaut → CSS-Animation startet neu).
- Einstellungen-UI, i18n (EN + DE), Settings-Migration, Tests, Doku.

## Nicht-Scope (bewusst ausgeklammert)

- **Der UI-Tab-Status (`uiTabs.showLead`)** bleibt unangetastet — das ist die
  Content-Tab-Leiste der App, nicht die Session-Einträge.
- **Keine Änderung am Aktivitäts-Icon** — Icon-Modus bleibt exakt wie vorher.
- **Keine Änderung an `SessionStatusDot` im Core** — der Core bleibt unberührt;
  der Loader ist Plugin-Code.
- **Keine neue Einstellung** für Loader-Drehzahl/Stärke — der Nutzer hat eine
  feste Optik beschrieben; Feintuning bleibt Roadmap.

## Umsetzung

- `plugin.js`
  - `StatusLoader({ kind })`: rendert `<span class="sf-loader" data-kind=…>`.
    Der `key` hängt am Zustand (`loader-<kind>`), damit der Glow-Impuls bei
    jedem Zustandswechsel neu läuft.
  - `StatusLead`: rendert jetzt Icon **oder** Loader **oder** beides; der
    Core-`SessionStatusDot` und der Helper `renderDot` entfallen. Das Lead
    meldet den Modus als `data-mode` (`glyph` | `loader` | `glyph+loader`).
  - `normalizeStatusStyle(value)`: `dot → loader`, `glyph+dot →
    glyph+loader`, sonst `glyph`. Genutzt von Lead und Settings-Segment.
  - `loadSettings()`: One-Shot-Migration der gespeicherten Altwerte.
  - CSS: `.sf-loader` (Ring via `radial-gradient`-Mask auf `conic-gradient`),
    `sf-loader-spin`, `sf-loader-glow`, Zustandsfarben identisch zu
    `.sf-tab-lead[data-kind=…]`, `prefers-reduced-motion` +
    `[data-renderer-animations-paused]` respektiert.
  - **Modus „Icon + Loader" = ein Icon**: der Loader legt sich als äußerer Ring
    **konzentrisch um** das Icon (nicht daneben). Umsetzung: der Loader wird
    im Lead absolut positioniert (`left/top:50%` + `margin:-9px`), der Ring
    wächst auf 18 px, sein Loch auf 72 % (Icon 13 px sitzt frei im Ring,
    Ringstärke ~2,5 px wie beim Solo-Loader). `min-width:18px` auf dem Lead,
    damit der Ring in Liste und Grid seinen Platz bekommt.
  - i18n: `tabsStatusDot` → `tabsStatusLoader` („Loader"), `tabsStatusBoth` →
    „Icon + Loader"; Beschreibungen in beiden Bundles angepasst.

## Verifikation

- `npm run check` — Syntax + i18n-Audit (EN/DE, 517 Keys) + Hook-Audit: grün.
- `npm test` — Render-Smoketest inkl. neuer Loader-Abschnitte (Modus
  Loader/Icon+Loader, Altwert-Migration, `data-kind`, Key-Remount, Bundles,
  Settings-Seite): grün.
- `npm run test:style` (Chromium via Playwright) — Computed-Style-Asserts:
  Ring-Geometrie 11×11 px, radiale Loch-Maske, `conic-gradient`-Bogen,
  `sf-loader-spin` (1,4 s) / Wartend 2,8 s, Akzent-/Bernstein-Farbe, Idle ruht
  (Spin aus, Bogen unsichtbar), fertig/Fehler = ruhender Vollring + Glow-
  Keyframe, „Icon + Loader" konzentrisch (Mittelpunkt Icon == Mittelpunkt
  Ring, Δ ≤ 0,6 px) und Lead-Cell ≥ 18 px: grün.
- Sichtprüfung: Renderer-Preview aller neun Zustände (Solo + Icon+Loader)
  im echten Chromium — Ring, Bogen, Vollring und Glow-Impuls wie gewünscht.


## Follow-ups

- Feintuning (Drehzahl je Zustand, Glow-Stärke, Track-Dicke) bleibt in
  `docs/ROADMAP.md` unter „Animation-Feinschliff".
