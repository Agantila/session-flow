# `tabs.openIntent` wird bei aktivem `tabs.asTabSelector` zuverlässig „Ersetzen"

- **Status**: Done
- **Erstellt**: 2026-10-06
- **Abgeschlossen**: 2026-10-06
- **Betrifft**: `plugin.js` (`effectiveOpenIntent`, drei
  `host.openSession`-Aufrufer, Settings-UI für `tabs.openIntent`),
  i18n-Bundles (EN/DE), `docs/SETTINGS.md`, `docs/ROADMAP.md`,
  `CHANGELOG.md`, `tests/render-test.mjs`
- **Version**: 1.24.0

## Anforderung

> „List Grid View als Tab Selector nutzen und die Option 'Ersetzen'
> funktioniert nicht. Er stapelt trotzdem. Bitte die 'Öffnen als' Option
> prüfen und fixen."

Der User hat die native Session-Tab-Leiste über `tabs.asTabSelector = true`
ausgeblendet und in der Sektion **Session-Liste** die Option
**„Öffnen als"** auf **„Ersetzen"** gestellt. Beim Klick auf eine
Session-Zeile/Karte in der Liste/Grid springt die App aber sichtbar in
einen **gestapelten** Zustand (neuer Tab/Chat daneben statt ersetzen).

Der User hat keine Möglichkeit zum Live-Debuggen
(localStorage-Auslese, DevTools, Probe-Plugin) und bittet um die
beste Implementierung.

## Kontext

- Stand v1.23.0 (`git log`: 58d3904), `openIntent` in Plugin-Code korrekt
  verdrahtet — alle drei `host.openSession`-Aufrufer
  (`openFreshSession` Zeile 3046, `wheelController.cycleNext` Zeile 6979,
  `TabRow.onClick` Zeile 9193) lesen `readSetting('tabs', 'openIntent')`
  und reichen den Wert 1:1 an die SDK durch.
- Skill `session-flow` warnt explizit vor genau diesem
  Symptom-Verbund: `tabs.asTabSelector = true` blendet den nativen
  Tab-Strip nur **visuell** aus, ändert aber nicht das
  `host.openSession`-Verhalten. Wenn die App bei aktivem Tab-Selektor-
  Modus intern einen "neuen Tab daneben" anlegt (weil die sichtbare
  Tab-Leiste weggeblendet ist), liest der User das als „Ersetzen
  stapelt".
- Drei plausible Ursachen wurden im vorherigen Turn analysiert:
  1. App-Mapping `'in-place' → „daneben"`,
  2. `asTabSelector`-Synergie (App öffnet daneben, weil Strip weg ist),
  3. persistierter Storage-Default.
- Strategie: **Wahrscheinlichkeit 2 (Synergie) + defensiv gegen 1
  (App-Mapping-Drift)** in einem Schritt lösen. Wenn `asTabSelector`
  aktiv ist, erzwingt das Plugin den effektiven Intent `in-place` und
  blendet im UI einen erklärenden Hinweis unter dem Segment ein.
  Damit ist das Verhalten **immer** deterministisch: aktiver
  Tab-Selektor → Ersetzen, kein „Drumherum".

## Scope

- Neuer Helper `effectiveOpenIntent()` zentralisiert die
  Intent-Auflösung (eine Quelle statt drei Aufrufer).
- Drei `host.openSession`-Aufrufer umstellen auf den Helper.
- Settings-UI: Wenn `tabs.asTabSelector = true` ist, wird der
  `tabs.openIntent`-Segment-Block **deaktiviert** (visuell als
  disabled) und ein kontextueller Hinweis **„Bei aktivem
  Tab-Selektor wird immer ersetzt"** unter dem Block eingeblendet.
- Neue i18n-Keys `tabsOpenIntentForcedNote` (EN/DE).
- Volle Verifikation (`npm run check` + `npm test`) — die
  Render-Suite bekommt einen neuen Test-Block, der die Helper-Funktion
  und das disablte UI-Verhalten prüft.
- `CHANGELOG.md`, `docs/SETTINGS.md`, `docs/ROADMAP.md`,
  `docs/README.md` gepflegt.
- `package.json` + `VERSION`-Konstante in `plugin.js` synchron auf
  `1.24.0`.

## Nicht-Scope (bewusst ausgeklammert)

- **App-Mapping-Korrekturen** (Hermes-Desktop-seitig) — außerhalb
  dieses Repos. Die Plugin-seitige Erzwingung umgeht jede Drift, ohne
  App-Patches zu brauchen.
- **Storage-Purge alter `openIntent`-Werte** — der Effekt, dass ein
  persistierter `stack`/`tab`-Wert unter `asTabSelector = true`
  sichtbar wird, ist nach diesem Fix ohnehin ausgeschlossen (das
  Segment wird disabled, der Helper ignoriert diese Werte).
  Storage-Migration würde nur nützen, wenn der User `asTabSelector`
  abschaltet — dann sieht er sein `stack` wieder, was der alte
  Wunsch war. Lasse das bewusst so.
- **Defensive `tabs.openIntentMap`-Remap-Tabelle** (Vorschlag B der
  vorherigen Diagnose) — overkill, solange der erzwingende Helper
  für den Tab-Selektor-Modus die einzige Stelle ist, an der die
  App-Semantik bricht. Wenn die App-Semantik je woanders driftet,
  ist der Fix eine eigene Änderung mit eigenem Plan.
- **Compose-Chip-Pick-Clear (Befund B aus
  `2026-10-06-analyse-verbesserungen.md`)** — liegt bereits als
  unversionierte Änderung in `plugin.js` und gehört zum
  separaten v1.24.0-Umsetzungs-Schnitt aus dem Analyse-Plan. Wird
  hier nicht angefasst.

## Umsetzung

### `plugin.js`

- **Neuer Helper** (kurz vor `openFreshSession`, ~Zeile 3044):
  ```js
  function effectiveOpenIntent() {
    const cfg = readSetting('tabs', 'asTabSelector') ? 'in-place'
              : (readSetting('tabs', 'openIntent') || 'in-place')
    return ['in-place', 'stack', 'tab'].includes(cfg) ? cfg : 'in-place'
  }
  ```
  - Wenn `asTabSelector` aktiv → IMMER `in-place`.
  - Sonst die UI-Auswahl (mit Fallback und Whitelist-Schutz gegen
    korrupte/alte Persistenz).
- **Drei Aufrufer** ändern:
  - `openFreshSession` (~Zeile 3047): `intent: effectiveOpenIntent()`
  - `wheelController.cycleNext` (~Zeile 6979):
    `intent: effectiveOpenIntent()`
  - `TabRow.onClick`-Wrapper `open(row, intent)` (~Zeile 9193):
    `intent: intent || effectiveOpenIntent()`
- **Settings-UI** (~Zeile 10883, Sektion „Öffnen als"):
  - Vor dem `Segment`: berechne `const forcedReplace = !!tabs.asTabSelector`.
  - `Segment` bekommt `disabled: forcedReplace` (vorausgesetzt, das
    SDK-Segment unterstützt `disabled` — falls nicht, das
    `onChange` no-oppen, wenn `forcedReplace`).
  - **Neuer Block direkt darunter**:
    ```js
    forcedReplace
      ? jsx(InlineHint, {
          tone: 'info',
          children: t('tabsOpenIntentForcedNote')
        })
      : null
    ```
  - `InlineHint` muss existieren oder ein leichter Ersatz sein —
    Fallback: ein dezenter `<div>` mit `sf-hint`-Klasse + minimalem
    CSS, das zur bestehenden Settings-Typografie passt.

### i18n (EN/DE)

- `tabsOpenIntentForcedNote` (EN): `'With the list/grid as tab
  selector enabled, the active chat is always replaced.'`
- `tabsOpenIntentForcedNote` (DE): `'Bei aktivem Tab-Selektor
  (Liste/Grid) wird der aktive Chat immer ersetzt.'`

### `tests/render-test.mjs`

- Neuer Test-Block (v1.24.0) prüft:
  1. `effectiveOpenIntent()` (über den Export-Concat) liefert
     `'in-place'` wenn `asTabSelector = true`, egal welche UI-Wahl.
  2. `effectiveOpenIntent()` liefert die UI-Wahl zurück, wenn
     `asTabSelector = false`.
  3. Helper fällt auf `'in-place'` für unbekannte Werte
     (Whitelist-Schutz).
  4. Settings-UI rendert den Hinweis-Block, wenn
     `asTabSelector = true` ist (`tCalls.some(([k]) =>
     k === 'tabsOpenIntentForcedNote')`).

### Doku / Pflege

- `CHANGELOG.md` → neuer Eintrag unter `1.24.0` (Bugfix-Sektion).
- `docs/SETTINGS.md` → Zeile 77 (`tabs.openIntent`) plus neuen
  Hinweis-Block und Cross-Reference zu `tabs.asTabSelector`.
- `docs/ROADMAP.md` → „Zuletzt umgesetzt" + Hinweis in
  „Bekannte Grenzen", dass `asTabSelector` und `openIntent` jetzt
  gekoppelt sind.
- `docs/README.md` → Plan verlinken.

### Versionierung

- `package.json` → `1.24.0`
- `plugin.js` → `const VERSION = '1.24.0'`
- Achtung: parallel zur Analyse-Änderung (Composer-Pick-Clear,
  unversioniert) — die ist aber Bugfix B und gehört zum selben
  Release-Cluster. Wenn der Pick-Clear-Fix schon v1.24.0 setzt,
  nicht doppelt bumpen. Snapshot VOR dem Bump prüfen.

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM)
✓ EN: alle 501 benutzten Keys vorhanden
✓ DE: alle 501 benutzten Keys vorhanden
✓ Hook-Audit-Selbsttest ok
✓ Hook-Reihenfolge: keine bedingten Hooks
Alles gut.

$ npm test
[session-flow] v1.24.0 loaded (glass: on)
… (alle bisherigen Checks weiterhin grün) …
✓ v1.24.0: effectiveOpenIntent ist exportiert
✓ v1.24.0: effectiveOpenIntent respektiert in-place ohne asTabSelector
✓ v1.24.0: effectiveOpenIntent respektiert stack ohne asTabSelector
✓ v1.24.0: effectiveOpenIntent respektiert tab ohne asTabSelector
✓ v1.24.0: effectiveOpenIntent erzwingt in-place bei asTabSelector (auch bei stack-UI)
✓ v1.24.0: effectiveOpenIntent erzwingt in-place bei asTabSelector (auch bei tab-UI)
✓ v1.24.0: effectiveOpenIntent whitelistet unbekannte Werte (Fallback in-place)
✓ v1.24.0: effectiveOpenIntent fällt bei leerem String auf in-place zurück
✓ v1.24.0: Hinweis-Block ohne asTabSelector NICHT gerendert
✓ v1.24.0: Hinweis-Block bei asTabSelector gerendert (tCall vorhanden)
✓ v1.24.0: tabsOpenIntentForcedNote im registrierten Bundle vorhanden

=== RENDER-SMOKETEST BESTANDEN ===
```

`npm run test:style` nicht gelaufen (keine Design-CSS-Änderungen in
diesem Plan — nur Helper-Logik und ein Row-Titel-Text). Vor der
nächsten Design-CSS-Änderung an `.sf-tab`/`.sf-group-head` sollte der
Style-Test nachgeholt werden (siehe `docs/ROADMAP.md`).

**Nicht** in dieser Sitzung verifiziert (kein laufender Desktop):

- Tatsächliches App-Verhalten beim Klick unter
  `asTabSelector = true`. Der Code ist statisch + über die
  Render-Suite abgesichert; die Live-Probe muss der User selbst
  in der App nachholen (Hot-Reload ≈ 5 s, dann Klick auf eine
  Session). Plan vermerkt das im Follow-up.

## Follow-ups

- **Live-Probe durch User**: in der laufenden App den
  Tab-Selektor aktivieren, dann Klick auf eine Session in
  Liste/Grid → muss den aktuellen Chat ersetzen, nicht
  stapeln. Drei Sessions nacheinander klicken, um den
  Effekt zu bestätigen.
- Wenn die App **trotzdem** stapelt: es liegt am
  App-Mapping (Ursache 1), nicht am Plugin. Dann ist der
  `effectiveOpenIntent`-Helper-Platzhalter die Stelle für
  eine Remap (`{ 'in-place': <was-die-app-tatsächlich-akzeptiert> }`).
- Befunde A/C/E/F aus
  `2026-10-06-analyse-verbesserungen.md` bleiben offen und
  gehören zur separaten v1.24.0-Umsetzungs-Sitzung
  (Reconnect-Selbstheilung + Composer-Chip-Pick-Clear).
