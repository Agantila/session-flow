# Context Window Bar-Style + Einstellungs-Seite Hierarchie (v1.19.3)

- **Status**: Done
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: 2026-10-05
- **Betrifft**: `plugin.js` (DEFAULT_SETTINGS, `applyRows`/`clearRows`,
  TabRow Context-Node, SettingsPage Segment-Row, i18n EN/DE, CSS
  `data-sf-ctxstyle=bar`, Settings-Sektions-Hover + Trennlinien),
  `tests/render-test.mjs` (7 neue Checks)
- **Version**: 1.19.3

## Anforderung

Drei UI-Verbesserungen aus einem Guss:

> „Der Context Window Indicator soll einen weiteren Darstellungs-Option
> als Bar Style haben, sodass eine kleine Bar in der Höhe der Schrift
> sich auflädt — minimalistisch und über die Einstellungen anpassbar.
> Füge für die Einstellungs-Seite auch je Sektion eine Trennlinie und
> einen dezenten Hover-Effekt ein, damit man in der Breite der
> Einstellungs-Seite den Bezug nicht verliert. Verbessere auch die
> Sektions-Überschriften in der Einstellungs-Seite für bessere
> Lesbarkeit."

## Umsetzung

### 1. Context-Window Bar-Style
- Neuer Settings-Key `tabs.ctxStyle: 'donut' | 'bar'` (Default `donut`).
- `applyRows` setzt `data-sf-ctxstyle` auf dem `<html>`-Root; `clearRows`
  räumt es im Lifecycle-End sauber ab.
- CSS: `html[data-sf-ctxpie~=on][data-sf-ctxstyle=bar] .sf-tab-ctx`
  überschreibt die Donut-Styles mit horizontaler Mini-Bar (`width: 28px;
  height: 0.8em; min-height: 9px`), Innenfüllung per `::before` mit
  `width: var(--sf-ctx-pct)`. `transition: width .22s ease-out` für
  weiches „Auffüllen" bei Änderung; `prefers-reduced-motion` deaktiviert.
- Level-Farben (`warn` bernstein, `high` destructive-rot) greifen in
  beiden Styles.
- TabRow: `barStyle = tabsCfg.ctxStyle === 'bar'` steuert `data-style`-
  Attribut + leeren `children` (statt `${pct}%`). `aria-label` + `title`
  behalten den vollständigen Tooltip (used / max / Prozent), damit
  Hover-Info und Screenreader nichts verlieren.
- Settings-UI: Segment `Donut | Bar` unterhalb des bestehenden
  „visuelle Darstellung"-Toggles. Row ist nur sichtbar, wenn `ctxPie=true` —
  bei deaktiviertem Indicator gibt's keinen Stil zu wählen.

### 2. Einstellungs-Seite: Trennlinien + Hover
- Jede Settings-Sektion (`section[id^=sf-sec-]`) wird zum Hover-Target:
  Padding + negativer Außen-Rand (`padding: 4px 10px 10px; margin: 0 -10px`),
  `border-radius: 10px`, `transition: background-color .18s ease`.
- Hover: `background: color-mix(in srgb, var(--ui-accent) 3%, transparent)` —
  sanft, bricht den Lesefluss nicht.
- Trennlinie zwischen Sektionen über CSS-Adjacent-Sibling:
  `section + section::before` ist ein 1 px hoher horizontaler Gradient
  (14 % Foreground an den Enden, voll im Mittelteil 20 %–80 %), der
  weder hart noch unsichtbar aussieht.

### 3. Section-Überschriften lesbarer
- `.sf-section-title`: `font-size 13px` (statt 12), `font-weight 700`
  (statt 600), `letter-spacing: .015em`, Gap zum Icon +1 px.
- Icon im Section-Title bekommt `color: var(--ui-accent)` → visuelle
  Hierarchie zwischen Section-Head (dominanter) und Row-Items.
- Beim Hover schaltet das Icon leicht in Richtung Foreground
  (`color-mix(in srgb, var(--ui-accent) 85%, var(--foreground))`) —
  deutet an „aktive Sektion", bleibt dezent.

### 4. i18n (EN + DE)
- Neue Keys: `tabsCtxStyle`, `tabsCtxStyleDesc`, `tabsCtxStyleDonut`,
  `tabsCtxStyleBar`.

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM) · EN/DE: alle 465 Keys vorhanden
✓ Alles gut.

$ npm test
… 165 Checks grün, 0 Fehler …
✓ v1.19.3: Donut-Mode setzt data-style=donut
✓ v1.19.3: Donut-Mode zeigt Prozent-Zahl im Children
✓ v1.19.3: Bar-Mode setzt data-style=bar
✓ v1.19.3: Bar-Mode hat keine Prozent-Zahl im Children
✓ v1.19.3: Bar-Mode behält aria-label für Screenreader
✓ v1.19.3: Bar-Mode setzt --sf-ctx-pct als Füll-Prozent
✓ v1.19.3: ctxStyle ist persistent im tabs-Store verfügbar
```

## Live-Verifikation

1. In Session-Flow → Einstellungen → Sessions den „Kontext als
   Pie-Chart"-Toggle aktivieren → eine neue Zeile „Kontext-Stil"
   erscheint mit Segment Donut | Bar. Bar wählen.
2. Zur Sessions-Pane zurück: der Kontext-Indicator zeigt jetzt eine
   minimalistische horizontale Füll-Leiste in Schrifthöhe statt des
   Donuts. Hover zeigt weiterhin den Tooltip mit `used / max (pct %)`.
3. In den Einstellungen hoch- und runterscrollen: beim Mouse-Hover
   leuchtet die aktive Sektion sanft, zwischen zwei Sektionen sitzt
   ein weicher Trenn-Strich. Die Section-Überschriften sind spürbar
   kräftiger, der Icon-Akzent zieht das Auge zur Sektion.

## Follow-ups

- Falls künftig weitere Context-Styles gewünscht sind (z. B. „Dots",
  „Compact Number only"), `ctxStyle`-Setting erweitern und das
  Segment um weitere Optionen ergänzen.
- Die Trennlinie zwischen Settings-Sektionen könnte optional als
  komplette horizontale Linie konfigurierbar werden (Hover-Effekt
  reicht in der Praxis aber meist).
