# Info-Dichte: Komfortabel/Detailreich klar abgestuft (Titel, Abstände, Zusatzinfos, Zweizeiler)

- **Status**: Done
- **Erstellt**: 2026-10-04
- **Abgeschlossen**: 2026-10-04
- **Betrifft**: `plugin.js` (`tabs.infoDensity`, `TabRow`, `rowDetailsLine`,
  `$liveMap`/`session.active_list`-Auswertung, Kontext-Fetch-Gate,
  CSS `.sf-tab[data-density=…]`/`.sf-tab-stats`, i18n), `tests/render-test.mjs`,
  `tests/style-test.mjs`, `docs/SETTINGS.md`, `docs/DEVELOPMENT.md`,
  `docs/APP-INTEGRATION.md`, `docs/ROADMAP.md`, `CHANGELOG.md`
- **Version**: 1.14.0 (Haupt-Commit `1f5ce45`; dieser Plan ist der
  Doku-Nachlauf dazu)

## Anforderung

Wörtlich aus dem Auftrag (Sitzung 2026-10-04, Runde 1):

> „Die Einstellungen für die Info Dichte komfortabel und detailreich müssen
> angepasst werden, da sich diese beiden Optionen nicht von den anderen
> beiden groß unterscheiden. Für komfortabel möchte ich, dass die Überschrift
> etwas größer ist und der Abstand zum Subtext etwas lockerer ist und größer.
> Und dass wir dort noch eine weitere Informationen hinzufügen, die relevant
> ist. Detailreich sollen noch mehr Informationen, die für die
> Anwendungsperspektive der Listendarstellung von den Sessions relevant und
> wichtig sind.“

Anschlussauftrag (Runde 2):

> „Detailiert soll die einzeiligen beschreibungen zweizeilig machen“

Abschlussauftrag der Sitzung:

> „… Dokumentiere auch in dem Projekt, was du getan hast, für die perfekte
> Weiterentwicklung nach den Vorgaben.“

## Kontext

- v1.8.0 hatte die „Info-Dichte“ eingeführt (`tabs.infoDensity`:
  auto/compact/comfortable/detailed, „auto“ folgt der App-Einstellung
  `sessionListDensity`). Die Stufen unterschieden sich in der Praxis kaum:
  **`session.list` liefert dem Plugin nur `id/title/preview/started_at/
  message_count/source`** — `git_branch`, `model` und `tool_call_count`, die
  die Detail-Zeile eigentlich zeigen sollte, erreichen das Plugin nicht.
  „Komfortabel“ zeigte dadurch faktisch nur „N Nachrichten“, „Detailreich“
  zusätzlich die Vorschau-Zeile — kaum Abgrenzung zu „Kompakt“.
- Datenlage-Ermittlung per temporärem Wegwerf-Probe-Plugin (live im
  laufenden Hermes-Desktop, danach wieder entfernt):
  - `session.active_list`-Items liefern pro **Live**-Session zusätzlich
    `model` und `last_active` (Epoch-Sekunden) — Daten, die der
    Live-Poll (`$liveMap`) ohnehin schon abruft (kein Extra-Call).
  - `session.context_breakdown` liefert `context_percent`/`model`
    (nur Runtime-ID/live) — wird bereits für den Kontext-Donut genutzt.
  - `session.usage`-Zähler sind unzuverlässig (0 bei idle) — bewusst
    **nicht** verwendet (siehe Nicht-Scope/Follow-ups).

## Scope

- **Komfortabel**: Titel größer (13 px/18 px), Abstand Titel→Subtext
  lockerer (4 px), Detail-Zeile reicher: **Modell · Nachrichten ·
  „zuletzt aktiv“** (Modell und Recency für laufende Sessions aus der
  Live-Liste; Branch/Tool-Zähler bleiben im Code-Pfad, erscheinen aber nur,
  wenn das Gateway sie künftig liefert).
- **Detailreich**: alles aus Komfortabel **plus** Vorschau-Zeile (wie
  bisher) **plus** Stats-Zeile „Kontext P%“ — nur wenn der Kontext-Donut
  aus ist (kein Doppel); der Kontext-Fetch läuft dafür seit dieser Version
  auch ohne `showContext`, wenn die effektive Dichte `detailed` ist
  (Gate: `contextInfoNeeded()`).
- **Zweizeilige Beschreibungen (Runde 2)**: In Detailreich brechen Detail-
  und Vorschau-Zeile auf bis zu zwei Zeilen um (`-webkit-line-clamp: 2`)
  statt einzeilig mit Ellipse abzuschneiden. Gilt in Liste **und** Grid.
  Komfortabel bleibt einzeilig; die Stats-Zeile bleibt immer einzeilig.
- Neue i18n-Keys EN/DE (`metaLastActive`, `metaContextShort`),
  Beschreibungstext der Option aktualisiert; Tests + Doku.

## Nicht-Scope (bewusst ausgeklammert)

- **Tokens/Kosten je Session in der Dichte-Zeile**: über die
  Plugin-Doors derzeit nicht zuverlässig verfügbar (`session.usage`-Zähler
  liefern für idle Sessions 0; die reichhaltige App-REST-Liste ist für
  Plugins nicht erreichbar). Wäre nur mit einem Plugin-eigenen Backend
  (`plugin_api.py`) sauber — siehe Follow-ups/ROADMAP.
- **Branch-/Tool-Zähler „erzwingen“**: es gibt keinen Door, der sie je
  Session liefert; der Anzeige-Pfad bleibt vorbereitet, mehr nicht.
- **Zweizeilig auch für Komfortabel** — bewusst nicht: die Abstufung soll
  gerade den Unterschied zwischen Komfortabel (einzeilig) und Detailreich
  (zweizeilig) tragen.
- **Dichte-stufen-lokale Textkürzung** (z. B. „Nachrichten“ abkürzen) —
  nicht nötig, seit die Zeile dank Clamp/Umbrauch genug Platz hat.

## Umsetzung

- `plugin.js`:
  - `$liveMap`: Einträge um `model` und `lastActive` erweitert (aus
    `session.active_list`-Items; `last_active` Sekunden → ms). Kein
    zusätzlicher RPC.
  - `rowDetailsLine(row, t, liveEntry)`: Modell-Fallback auf Live-Daten;
    neuer Zeilen-Teil `t('metaLastActive', fmtAge(lastActive))` (nur wenn
    Live-Eintrag vorhanden).
  - `TabRow`: `liveEntry`-Lookup; `data-density={infoDensity}` am
    Zeilenkörper; `statsLine` bei `detailed && !showContext && ctxInfo`
    → neue Zeile `.sf-tab-stats`.
  - Kontext-Fetch: `effectiveInfoDensity()` + `contextInfoNeeded()`
    (Donut **oder** Dichte=detailed) an allen vier Gates (Refresh-Guard,
    Settings-Watch, Startup-Schedule, `patchSettings`-Hook bei
    Dichte-Wechsel) + Refresh-Anstoß bei App-Dichte-Wechsel
    (`watchAppDensity`-Subscription).
  - CSS (rein deklarativ über `data-density`):
    `.sf-tab[data-density=comfortable|detailed] .sf-tab-title`
    (13 px/18 px); List-Abstände (`.sf-tab-details` 4 px,
    `.sf-tab-preview`/`.sf-tab-stats` 3 px, nur Liste — Grid behält sein
    Gap); `.sf-tab-stats` (10 px, quarternär);
    Zweizeilen-Regel `.sf-tab[data-density=detailed] .sf-tab-details,
    … .sf-tab-preview { -webkit-line-clamp:2; white-space:normal }`.
  - i18n: `metaLastActive`/`metaContextShort` (EN+DE), `tabsInfoDensityDesc`
    beider Bundles neu formuliert.
- `tests/render-test.mjs`: Exporte um `pollLiveSessions`, `$liveMap`,
  `$ctxInfo` erweitert; Sektion 17 mit 11 Dichte-Checks (data-density je
  Stufe, Detail-/Stats-Zeilen, „zuletzt aktiv“ nur für Live-Sessions,
  Kontext-Stats nur bei Detailreich + Donut aus).
- `tests/style-test.mjs`: Dichte-Zeilen in die Chromium-Testseite
  (div-Struktur wie die echte Pane) + Sektion 13 mit 6 Checks
  (einzeilig vs. Line-Clamp 2, Höhen 14 px vs. 28 px, Stats einzeilig,
  Grid-Parität).
- Doku: `docs/SETTINGS.md` (Optionenbeschreibung), `docs/DEVELOPMENT.md`
  (Architektur-Absatz + Datenlage-Befund), `CHANGELOG.md` (v1.14.0),
  `docs/ROADMAP.md` („Zuletzt umgesetzt“ + neue Idee + bekannte Grenze),
  `docs/APP-INTEGRATION.md` (Live-Kennzahlen-Door + Kontext-Gate).

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM)
✓ EN: alle 376 benutzten Keys vorhanden
✓ DE: alle 376 benutzten Keys vorhanden
Alles gut.

$ npm test
… u. a. die 11 Dichte-Checks (Sektion 17):
✓ Dichte: data-density=compact/comfortable/detailed an allen Zeilen
✓ Dichte komfortabel: Detail-Zeile vorhanden, keine Stats
✓ Dichte komfortabel: „zuletzt aktiv“ nur für die Live-Session — [["metaLastActive","5m"]]
✓ Dichte detailreich: genau eine Stats-Zeile (Kontext %) / Kontext-Prozent / Vorschau
✓ Dichte detailreich + Donut an: Stats-Zeile entfällt (kein Doppel)
=== RENDER-SMOKETEST BESTANDEN ===

$ npm run test:style
✓ Dichte komfortabel: Detail-Zeile einzeilig (nowrap, kein Clamp) — {"whiteSpace":"nowrap","clamp":"none","height":14}
✓ Dichte detailreich: Detail-Zeile zweizeilig (Line-Clamp 2, Wrap erlaubt) — {"clamp":"2","height":28}
✓ Dichte detailreich: Detail-Zeile rendert zwei Zeilen (Höhe 28 px) — detailreich=28px komfortabel=14px
✓ Dichte detailreich: Vorschau-Zeile zweizeilig (Clamp 2)
✓ Dichte detailreich: Stats-Zeile bleibt einzeilig
✓ Dichte Grid: Detail-Zeile bei Detailreich ebenfalls zweizeilig
=== STYLE-TEST BESTANDEN (Chromium Computed-Styles) ===
```

Live im laufenden Hermes-Desktop (DOM-Messung über das temporäre
Probe-Plugin, danach entfernt): Zeilen rendern `data-density="comfortable"`,
Titel `13px/18px`, Detail-Zeile z. B.
„deepseek-flash · 152 Nachrichten · zuletzt aktiv 11m“ — die App-Dichte stand
zu diesem Zeitpunkt auf `comfortable`. Nach der Zweizeilen-Änderung:
Hot-Reload ohne Ladefehler (`~/.hermes/logs/desktop.log` leer bzgl.
`session-flow`-Fehlern seit dem Schreibzeitpunkt).

Haupt-Commit inklusive beider Runden: `1f5ce45` (v1.14.0).

## Follow-ups

- **Tokens/Kosten in der Dichte-Zeile** — braucht ein Plugin-Backend
  (`plugin_api.py`) oder erweiterte Gateway-Doors; als Idee in
  `docs/ROADMAP.md` → „Geplant/Ideen“ eingetragen („Session-Kennzahlen in
  der Info-Dichte“).
- **Branch-/Tool-Zähler** erscheinen automatisch, sobald `session.list`
  diese Felder mitliefert — Anzeige-Pfad bleibt bestehen; als bekannte
  Grenze in `docs/ROADMAP.md` dokumentiert („`session.list`-Payload“).
- **Visuelle Abnahme durch den Nutzer** (Sichtprüfung in der App):
  Info-Dichte auf „Detailreich“ stellen und Zweizeiler + „Kontext %“
  ansehen — steht beim Nutzer noch aus (Stand dieses Plans).
