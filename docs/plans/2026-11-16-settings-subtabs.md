# Settings-Sektionen mit Subtabs gruppieren

- **Status**: Erledigt
- **Erstellt**: 2026-11-16
- **Abgeschlossen**: 2026-11-16
- **Betrifft**: plugin.js (SettingsPage, SettingsSection-Umfeld, i18n EN/DE, CSS), tests/render-test.mjs, docs/SETTINGS.md, CHANGELOG.md
- **Version**: 1.29.0 (erreicht)

## Anforderung

> „Ich möchte die Einstellungen des Plugins in den Sektionen noch weiter mit
> subtabs organisiert Gruppiert haben. Bitte erstelle einen Plan dafür der
> effektiv und mit wenig aufwand das realisert"

## Kontext

Die Settings-Seite ist eine lange Scroll-Page: 8 Sektionen (`sf-sec-*`),
verdrahtet über `SETTINGS_CATEGORIES` + `SettingsNav` (sticky Chip-Leiste mit
IntersectionObserver, plugin.js:10897 ff.). Innerhalb der Sektionen wird nur
mit `sf-subhead`-Zwischenüberschriften (plugin.js:6745) gegliedert; ein
einziges Subtab-Muster existiert schon: der Dark/Light-`Segment` der
Theme-Farben (`tabs.themeTab`, persisted, plugin.js:11515 ff.) und die
kontextuellen Preset-Segmente.

Die Sektion **Sessions** ist mit ~530 Zeilen / ~40 Rows (plugin.js:11322–11856)
ausgewachsen; auch **UI-Tabs** (~165 Z.), **Glass** (~170 Z.) und **Personal**
(~145 Z.) sind lang. Genau dort brechen Subtabs die Scroll-Länge auf — ohne die
Navigation (`SETTINGS_CATEGORIES`, Anchor-IDs, IntersectionObserver) anzufassen.

## Scope

1. **Eine generische Komponente `SettingsSubtabs`** (~30 Zeilen, plugin.js bei
   SettingsSection ~10882):
   - Props: `tabs: [{ id, labelKey, rows }]` (rows = JSX-Array).
   - Rendert eine Tab-Leiste per bestehendem `Segment` (plugin.js:7703, CSS
     `.sf-seg` existiert) und darunter **alle** Panes; inaktive Panes erhalten
     `hidden={true}`. Aktiver Tab = `useState` lokal pro Instanz — **nicht**
     persisted (reiner UI-Zustand wie jede Segment-Auswahl; Ausnahme bleibt
     der bestehende `themeTab`, der weiter über Settings läuft).
   - Kein Conditional-Mount: alle Rows werden immer gerendert, inaktive nur
     visuell versteckt (Default-UA-Style `hidden` → `display:none`).
     Sicherheits-CSS: `.sf-subtab-pane[hidden]{display:none}` (1 Zeile) plus
     `.sf-subtabs{margin:8px 0 2px}`.
   - Subheads innerhalb grupplierter Rows entfallen (das Subtab-Label ersetzt
     sie); die `sf-subhead`-Regel bleibt für künftige Nutzung.
2. **Sektion Sessions** in 4 Subtabs (Schnittstellen an den heutigen
   `sf-subhead`-Grenzen, Rows werden unverändert verschoben):
   - `Ansicht` — density, view, appNav, composerProjectPill, grid*, textSize,
     infoDensity, alignTop, hoverLift, showTime/Preview/Counts/Source,
     openIntent, asTabSelector, maxItems.
   - `Design` — themeMode/themeSplit/themeAutoDerive/themeEditing + Dark/Light-
     Segment, rowGrad*, rowShadow, titleStyle + davon abhängige Farbzeilen
     (ersetzt Subhead `tabsDesignHead`).
   - `Auswahl` — selTint/selColor/selBorder/selShadow/selHover (ersetzt
     `tabsSelHead`).
   - `Effekte` — rowLive, liveFrame, doneFx* (ersetzt `tabsLiveHead`).
3. **Sektion UI-Tabs** in 2 Subtabs: `Optik` (radius, gap, insetY, separators,
   activeStyle, labelCase, labelSize, showLead, arc) / `Verhalten` (closeMode,
   closeWidth, closeHoverBg). `uiTabsEnabled` und Preset-Zeile bleiben außerhalb
   (immer sichtbar).
4. **Sektion Glass** in 2 Subtabs: `Fläche` (blur, saturate, fill, tint,
   gradient, angle, gradOpacity, reach) / `Rahmen & Geltung` (ring, arc*,
   scope*). `glassEnabled` bleibt außerhalb.
5. **Sektion Personal** in 3 Subtabs: `Akzent` (accentOn, accentColor,
   paneSurface) / `Hintergrund` (bgOn, bgKind, bgPath, bgFit, bgDim, bgBlur,
   bgScope) / `Shell` (shellOn, shellScope, shellPad, shellShadow …).
6. **i18n**: neue Label-Keys in **beiden** Bundles (EN ab ~5262, DE ab ~5892):
   `subView`, `subDesign`, `subSelection`, `subEffects`, `subLook`,
   `subBehavior`, `subSurface`, `subFrame`, `subAccent`, `subBackground`,
   `subShell` (~11 Keys × 2). `npm run check` erzwingt Vollständigkeit.
7. **Tests** (tests/render-test.mjs, neuer Abschnitt nach den bestehenden
   Settings-Blöcken, eigenes Fixture + Restore wie gehabt):
   - Settings-Page rendert; `.sf-subtabs`-Segment-Buttons vorhanden.
   - Erste Pane sichtbar, weitere `hidden`; Button-`onClick` eines Tabs
     klappt die Sichtbarkeit um (Assert auf `hidden`-Attribut der Panes).
   - Alle bisherigen Key-Assertions bleiben unangetastet grün, weil weiter
     alles gemountet bleibt und `t()` überall feuert.
8. **Docs/Version**: CHANGELOG 1.29.0; docs/SETTINGS.md (Subtab-Struktur je
   Sektion beschreiben); docs/ROADMAP.md; `package.json` + `VERSION` sync.

## Nicht-Scope (bewusst ausgeklammert)

- **Chat, Strg+Scroll, Gruppen, About**: kurz (≤12 Rows), keine Subtabs —
  dort wäre ein Tab-Wechsel teurer als Scrollen.
- **Keine Änderung an `SettingsNav`/`SETTINGS_CATEGORIES`/IntersectionObserver**:
  Sektionen behalten IDs und Reihenfolge; nur ihre Höhe schrumpft.
- **Kein Persistieren des aktiven Subtabs** (keine Settings-Schema-Migration);
  Ausnahme `themeTab` bleibt unverändert persistiert, weil er steuert, welchem
  Theme-Satz Farb-Edits gelten.
- **Kein Conditional-Mount der Panes** — würde ~20 `t()`-Log-Assertions im
  Render-Smoke-Test brechen und bringt keinen sichtbaren Mehrwert.
- Keine mehrstufigen Tabs (Subtabs in Subtabs); der Dark/Light-Segment bleibt
  eine Row-Action innerhalb des Design-Tabs.

## Umsetzung

- **Betroffene Dateien**: `plugin.js` (Komponente + 4 Sektionen + i18n + CSS +
  `VERSION`), `tests/render-test.mjs`, `docs/SETTINGS.md`, `CHANGELOG.md`,
  `docs/ROADMAP.md`, `package.json`.
- **Designentscheidung „mount alles, verstecke via `hidden`“**: Der Render-Smoke
  asserting auf dem `t()`-Call-Log einer einzigen `settingsPage.render()`-
  Passage; versteckte Panes bleiben im Walk-Baum, alle Keys bleiben geloggt.
  `hidden={true}` / `undefined` (nicht `false`-String!) setzen.
- **`SettingsSubtabs`-Sketch**:
  ```js
  function SettingsSubtabs({ tabs }) {
    const t = usePluginI18n(ID)
    const [active, setActive] = useState(tabs[0].id)
    return jsxs('div', { className: 'sf-subtabs', children: [
      jsx(Segment, {
        options: tabs.map(tab => ({ id: tab.id, label: t(tab.labelKey) })),
        value: active, onChange: setActive
      }),
      ...tabs.map(tab => jsx('div', {
        className: 'sf-subtab-pane', key: tab.id,
        hidden: active === tab.id ? undefined : true,
        children: tab.rows
      }))
    ] })
  }
  ```
- **Einbau**: In `SettingsPage` je Sektion die bestehende `children`-Liste in
  Row-Arrays aufteilen und als `tabs={[{ id: 'view', labelKey: 'subView', rows: [...] }, …]}`
  übergeben. Rows werden 1:1 verschoben (keine Logik-Änderung an `patch`/
  `colorFor`/`setThemeColor`-Handlern).
- **CSS** (2 Zeilen ins Template-Literal, keine Backticks): `.sf-subtabs{…}`,
  `.sf-subtab-pane[hidden]{display:none}` — nur `var(--ui-*)`-Farben, keine
  Hardcodes (Segment-Styles kommen aus `.sf-seg`).

### Abweichungen vom Plan (bei der Umsetzung eingetreten)

- **Glass bekam 3 Subtabs** (Fläche / Rahmen / Bereiche) statt 2 — die
  Geltungs-Toggles (composer/chips/statusbar) sind semantisch eigener als
  „Rahmen"; neuer i18n-Key `subScope` statt Kombigruppe.
- **Individualisierung bekam 2 Subtabs** (Akzent / Hintergrund) statt 3 — die
  im Plan genannten Shell-Rows (`shellOn`/`shellScope`/…) existieren in der
  aktuellen Sektion nicht mehr; `subShell`-Key entfiel dafür.
- **Zusatz-Guard in `SettingsSubtabs`**: `active` fällt auf `tabs[0].id`
  zurück, wenn der gespeicherte State keine bekannte Tab-ID ist — der
  useState-Stub des Render-Smoke teilt Slots zwischen verschiedenen Bäumen,
  was ohne Guard alle Panes verstecken würde.
- **alignTop/hoverLift** wanderten wie geplant von Design nach Ansicht
  (physische Zeilenbewegung im JSX).

## Verifikation

- `npm run check` — **grün**: „Syntax ok (ESM)", „EN: alle 516 benutzten Keys
  vorhanden", „DE: alle 516 benutzten Keys vorhanden", Hook-Audit ok.
- `npm test` — **grün**: „=== RENDER-SMOKETEST BESTANDEN ===", 341 Checks,
  0 Fehler. Neuer Block 11c bestätigt: alle 11 Subtab-Keys im t()-Log,
  11 Panes, je Gruppe genau 1 sichtbar (4), 7 hidden, versteckte Panes
  rendern weiter (tabsThemeSplit/tabsSelTint/tabsDoneFx/glassArcWidth/
  personalBgFit/uiTabsCloseMode). Alle bestehenden Settings-Assertions
  (tabsMaxVisible, tabsSelHover, Theme-Keys, v1.13-Zeilen, Save-Button)
  blieben unangetastet grün.
- `npm run test:style` (Playwright aus OpenActory-Checkout,
  `PLAYWRIGHT_PKG=…`) — **grün**: „=== STYLE-TEST BESTANDEN (Chromium
  Computed-Styles) ===" inkl. v1.28-Drag-Regression-Guards.
- `node --check plugin.js` — Syntax ok nach der Restrukturierung.
- Manuell im laufenden Hermes-Desktop: ausständig (Symlink-Deploy vorhanden —
  beim nächsten App-Look selbst verifizieren: Subtab-Wechsel in allen 4
  Sektionen, Sticky-Navigation springt weiter zu allen 8 Sektionen,
  Dark/Light-Theme-Segment wirkt im Design-Tab, „Übernehmen" bleibt sticky).

## Follow-ups

- Falls Sessions-`Effekte`-Tab zu lang bleibt: doneFx-Feinparameter (Achse,
  Stärke) hinter „Erweitert"-Disclosure einklappen (Roadmap-Notiz).
- Optional Persistenz des aktiven Subtabs je Sektion, falls Nutzerfeedback
  danach verlangt (dann Settings-Schema-Version mitnehmen).
