# Kopfzeilen-Dichte „Detailreich": Pane-Crash beim Umschalten behoben

- **Status**: Done
- **Erstellt**: 2026-10-06
- **Abgeschlossen**: 2026-10-06
- **Betrifft**: `plugin.js` (`SectionHeader`), `scripts/check.mjs` (neuer
  Hook-Audit), `docs/ROADMAP.md`, `CHANGELOG.md`, `package.json`
- **Version**: 1.22.2

## Anforderung

Wörtlich aus dem Auftrag:

> „Der Wechsel auf Kopfzeilen Detailreich in den Einstellungen führt zu einem
> Crash des Sidepanels."

## Kontext

- Die Kopfzeilen-Dichte (`groups.headerDensity`) hat drei Stufen:
  `compact` | `comfortable` | `detailed` („Detailreich"). Seit v1.18.0 zeigt
  die `detailed`-Stufe eine zweite Kennzahl-Zeile (Datum · Ordnergröße ·
  Σ-Tokens, Plan `2026-10-05-header-density-detailreich-extra-row.md`).
- Für die Ordnergröße lädt `SectionHeader` sie lazy nach
  (`ensureFolderSize(section.cwd)`) — der `useEffect` dafür lag **innerhalb**
  des `density === 'detailed'`-Zweigs.
- Folge: die Anzahl der Hook-Aufrufe des Components hing vom gerenderten
  Render-Input ab. Beim Umschalten auf „Detailreich" kam ein Hook dazu, beim
  Zurückschalten fiel einer weg.
- React verbietet das hart: **#310** („Rendered more hooks than during the
  previous render") bzw. **#300** („Rendered fewer hooks"). Beide warfen die
  Pane in die Error-Boundary → dauerhaft „session-flow:pane failed to render"
  mit Retry-Button.
- Belege aus `~/.hermes/logs/desktop.log` (2026-10-06):
  `14:06:15,698 React error #300` und `14:06:21,721 React error #310`, jeweils
  `[error-boundary:contrib:session-flow:pane]` + `[renderer crash:main]` —
  genau ein Umschalt-Paar.
- Warum es so lange unbemerkt blieb: der Render-Smoketest kann diese Fehler
  prinzipiell nicht sehen — dort sind `useEffect`/`useState` Stubs bzw.
  No-ops und es gibt keinen echten React-Reconciler, also auch keine
  Hook-Zählung. `npm run check` war ebenfalls rein syntaktisch + i18n.

## Scope

- `useEffect` in `SectionHeader` an den Komponentenanfang verlegen; die
  Bedingung (`density === 'detailed'` && Projekt-Gruppe && cwd && Items
  vorhanden) wandert **in** den Effekt, nicht um ihn herum.
- Statischer Regressions-Guard in `scripts/check.mjs`: findet Hook-Aufrufe
  innerhalb bedingter Blöcke/Zeilen (`if`/`for`/`while`/`switch`/`else`/
  `&&`/`||`/Ternary) und lässt `npm run check` fehlschlagen — inklusive
  Selbsttest, damit der Scanner nicht still zum No-op verkommt.
- Version-Bump 1.22.1 → 1.22.2.

## Nicht-Scope (bewusst ausgeklammert)

- **Keine Verhaltensänderung an der Detailreich-Zeile selbst** — Inhalt,
  Datenquellen und „nie erfunden"-Regel bleiben unverändert; nur der
  Hook-Ort wandert.
- **Kein vollwertiger ESLint-Hook-Lint** (`react-hooks/rules-of-hooks`):
  Das Repo hat für `plugin.js` (eine große Datei, kein Build) keine
  ESLint-Kette im Check-Pfad; der Guard deckt den real vorgekommenen Fall ab
  und ist im Selbsttest abgesichert.
- **Kein Erkennen von Hooks nach einem frühzeitigen `return`** in einem
  bedingten Zweig — diese Variante ist im Scanner bewusst nicht enthalten
  (im Plugin gibt es sie nicht) und als Grenze im Check kommentiert.

## Umsetzung

1. `plugin.js` / `SectionHeader`: neuer `useEffect` direkt nach
   `useValue($ctxInfo)`, mit der bisherigen Bedingung als Guard im Rumpf und
   `[density, section.kind, section.cwd, section.items.length]` als Deps. Der
   alte, bedingte Effekt im `detailed`-Zweig ist entfernt (dort nur noch ein
   Kommentar, der auf den Hook-Block verweist).
2. `scripts/check.mjs`: neuer Abschnitt 3 „Hook-Reihenfolge-Audit" —
   `maskNonCode()` (Tokenizer: Kommentare/Strings/Template-Literale werden
   durch Leerzeichen ersetzt, Zeilennummern bleiben stabil) +
   `findConditionalHooks()` (Brace-Stack, je geöffnete Klammer ein
   Bedingt-Flag) + Selbsttest-Fixture. Verstöße → Exit-Code 1.
   Die Maskierung ist nötig: das Plugin enthält ein mehrere hundert Zeilen
   großes CSS-Template-Literal und `//` **innerhalb** von Strings/Snippets —
   naives Kommentar- oder Zeilen-Stripping kippt die Klammer-/Backtick-Zählung
   und macht den Scanner still blind (genau das passierte beim ersten
   Prototyp).

## Verifikation

- `npm run check` → `✓ Hook-Audit-Selbsttest ok`, `✓ Hook-Reihenfolge: keine
  bedingten Hooks`, i18n EN/DE grün.
- Gegenprobe: derselbe Audit gegen den Stand `HEAD~1` (`git show
  HEAD:plugin.js`) meldet `HIT 7213: useEffect(() => {` — der Guard greift
  also wirklich und war nicht schon immer grün.
- `npm test` → Render-Smoketest bestanden.
- `npm run test:style` → Style-Test bestanden (Chromium Computed-Styles).
- **Live im laufenden Hermes-Desktop** (Probe-Plugin, danach entfernt):
  Dichte-Umschaltung im Settings-Segment selbst gefahren —
  `Komfortabel` → `grp:"comfortable"`, danach `Detailreich` →
  `grp:"detailed"`, durchgehend `pane:true`, `tabsInPane:18`,
  `groups:5`, `retryBtn:false`; nach dem Wechsel sind die
  `sf-group-stats-2`-Zeilen (5) wieder da. Kein Error-Boundary-Eintrag,
  und die Log-Suche nach `React error #300|#310` liefert für den
  Verifikationszeitraum **keine** neuen Treffer (die letzten stammen von
  14:06, vor dem Fix).

## Follow-ups

- Der Guard erfasst den bedingten Hook-Fall, nicht Hooks nach Early-Return
  (siehe Nicht-Scope). Falls im Plugin je ein Early-Return-Muster einzieht,
  den Scanner um einen Early-Return-Zweig erweitern.
- Verwandt und weiter offen: die restlichen Detailreich-Punkte aus
  `docs/plans/2026-10-05-detailreich-info-zeile.md` (animierte
  Aktivitäts-Zeile je Info-Wechsel) — unabhängig von diesem Fix.
