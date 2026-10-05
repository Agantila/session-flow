# Pane-Oberfläche (Hintergrund) einstellbar — Sidebar-Parität

- **Status**: Done
- **Erstellt**: 2026-10-06
- **Abgeschlossen**: 2026-10-06
- **Betrifft**: plugin.js (`personal`-Settings, applyPersonal, CSS, Settings-Seite, Tests)
- **Version**: 1.20.0

## Anforderung

> „Die Sidepanel Hintergrundfarbe des gesamten session-flow content bereichs
> ist in der farbe wie der chat - ich möchte das anpassen und auch ohne
> hintergrund farbe so wie die native Sessions Sidepanel von Hermes Desktop
> einstellen können. Default so so wie hermes default auch den Hintergrund
> des Sidepanels hat."

## Kontext

Das App-Farb-Vokabular (styles.css des Desktops):
`--ui-sidebar-surface-background` (= `var(--ui-bg-sidebar)`) malt die native
Sessions-Sidebar; `--ui-chat-surface-background` (= `var(--ui-bg-chrome)`)
malt den Chat UND ist zugleich der `body`-Hintergrund. Das `.sf-pane` des
Plugins hat bisher keinen eigenen Fill — es fällt auf die body-Farbe (Chat)
durch. Genau das nahm der Nutzer als „Pane hat Chat-Farbe" wahr.

## Scope

- Neue Option `personal.paneSurface`: `native` (Default — genau die Variable,
  die auch die native Sessions-Sidebar malt, inkl. Theme-/Glass-Varianten),
  `chat` (bisheriger Look, explizit), `none` (kein eigener Fill).
- Umsetzung als `data-sf-panesurface`-Attribut auf `<html>` + deklarative
  CSS-Regeln auf `.sf-pane` (Plugin-Regeln sind unlayered und gewinnen).
- Settings-Zeile (Segment) in der Individualisierungs-Sektion; i18n EN+DE.

## Nicht-Scope

- Kein Umbau der Einstellungs-Seite-Fläche (nur das Sessions-Pane).
- Keine freie Farbwahl fürs Pane (native/chat/none deckt die Anfrage; freie
  Farbe wäre Folge-Feature).

## Umsetzung

- `DEFAULT_SETTINGS.personal.paneSurface = 'native'`.
- `applyPersonal()` setzt `data-sf-panesurface` immer; `clearPersonal()`
  entfernt es. CSS: drei Regeln auf `.sf-pane`.
- Settings: Segment native/chat/none (`personalPaneSurface`-Keys).

## Verifikation

- `npm run check` — Syntax ok, i18n-Parität 472 Keys in beiden Bundles.
- `npm test` — **grün**, inkl. 7 neuer Checks (Sektion 37): Attribut-
  Spiegelung für native/chat/none, ungültiger Wert → Fallback native,
  `clearPersonal` entfernt das Attribut, Re-Apply stellt wieder her.
- `npm run test:style` — **grün** (echtes Chromium), inkl. 4 neuer Checks:
  gemessene `.sf-pane`-Flächenfarbe — ohne Attribut (Dispose-Zustand) kein
  eigener Fill, `chat` löst `rgb(35, 37, 41)` auf, `none` transparent,
  `native` löst `rgb(26, 28, 32)` (= Test-Wert von
  `--ui-sidebar-surface-background`) auf. Test-Tokens
  `--ui-sidebar-surface-background`/`--ui-chat-surface-background` ergänzt.
- Design-Entscheidung: **ohne Attribut wird bewusst nichts gemalt** —
  Dispose (Plugin deaktiviert) muss das Pane restlos in den App-Zustand
  zurückgeben; der native Fill kommt erst mit dem ersten `applyPersonal()`
  nach dem Register (was in der laufenden App sofort passiert).
