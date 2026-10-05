# Kopfzeilen-Dichte „Detailreich": zweite Kennzahl-Zeile

- **Status**: In Arbeit (Hybrid-Pfad freigegeben durch Benutzer 2026-10-05)
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: —
- **Betrifft**: `plugin.js` (`SectionHeader`, `buildSections`, neuer Atom
  `$folderSizes`, Settings, CSS, Render-Smoketest), `docs/SETTINGS.md`,
  `CHANGELOG.md`, `package.json`. **Kein** Gateway-Patch nötig — der
  Hybrid-Pfad nutzt nur vorhandene RPCs (`session.list`,
  `session.active_list`, `session.context_breakdown`) und einen neuen
  App-IPC `hermes:getFolderSize` (lokales Dateisystem, kein
  Gateway-Reich).
- **Version**: 1.18.0 (geplant)

## Anforderung

Wörtlich aus dem Auftrag:

> „Kopfzeilendichte unter den Ansichtsoptionen soll bei 'Detailreich' eine
> Weitere Zeile mit infos wie Datum der letzten änderung und größe in MB des
> Ordners sowie token verbrauch der gesamten Sessions mit anzeigen kompakt in
> der neuen Zeile."

Konkretisierung (Mnemosyne-Kontext + Vorgeschichte):

- **Geltungsbereich**: nur `groups.headerDensity === 'detailed'` in den
  Sektions-Kopfzeilen — KEINE Ausweitung auf `tabs.infoDensity` (Detail-Zeile
  der Zeilen). Diese Trennung ist im Plugin seit v1.15.0 bewusst.
- **Neue Zeile** liegt UNTER der bestehenden Subzeile (Ordner-Pfad /
  Angepinnt-Aktiv-Kennzahl), wird kompakt mit kleinen `·`-Separatoren
  dargestellt — wie die jetzige Subzeile.
- **Drei Kennzahlen**:
  1. **Datum der letzten Änderung** der Sektion (= `max(started_at)` über
     alle enthaltenen Sessions, bis ein echtes `updated_at` verfügbar ist).
  2. **Größe des Projekt-Ordners in MB** (nur Projekt-Gruppen — siehe
     Nicht-Scope).
  3. **Token-Verbrauch der gesamten Sessions** in der Sektion (Summe über
     alle enthaltenen Sessions).

## Kontext

- `groups.headerDensity` (v1.15.0) hat drei Stufen: `compact`,
  `comfortable`, `detailed`. `detailed` zeigt heute eine Kennzahl-Subzeile
  mit Angepinnt-/Aktiv-Anzahl, „nie erfunden — ohne Treffer bleibt die Zeile
  weg" (Plan `2026-10-04-header-density-view-options-menu.md`).
- Der vorherige Plan schrieb explizit **NICHT** rein: „Tokens/Kosten in der
  Kennzahl-Subzeile — das Plugin trackt keine Token-/Kosten-Daten für
  Sessions." Diese Lücke ist der Ausgangspunkt für diesen Plan.
- `normalizeRow()` (plugin.js Z. 1370) liest heute nur:
  `id/title/preview/cwd/git_branch/model/tool_call_count/pinned/source/
  started_at/message_count/live_message_count`. `cwd` ist im Payload von
  `session.list` zu 99 % leer (Kommentar im Plugin: `tui_gateway` liefert
  nur `id/title/preview/started_at/message_count/source` — siehe
  Skill-Trap-Notiz in `hermes-desktop-plugins`).
- Token-Verbrauch: Es gibt im Plugin **keinen** Token-Counter pro Session.
  `session.context_breakdown` liefert nur `used/max` für die aktuelle
  Runtime (live only, keine Summen), `session.usage` ist nicht abrufbar.

## Scope

- Neuer App-IPC `hermes:getFolderSize({ path })` (Hauptserver-Helper, kein
  Gateway-Patch). Falls die App den Door noch nicht hat, fällt der Plan
  auf „nur Folder-Cache nach erstem User-Hover über den Header" zurück
  und die Folder-Size-Kennzahl wird (vorerst) weggelassen — sie kommt
  nach, sobald der Door live ist.
- Neuer Atom `$folderSizes` — keyed by `meta.anchor`, TTL 60 s, lazy
  fetch, max. 20 parallele Stale-Trie-Refreshs (Race-Schutz über
  Generation-Counter, damit alte Antworten verworfen werden).
- `SectionHeader` bekommt `density === 'detailed'` einen zweiten
  `<span class="sf-group-stats-2">` UNTER `.sf-group-sub`, mit komma-
  separierten Tokens (Datum · Ordnergröße · Σ Tokens/%); alle drei werden
  weggelassen, wenn leer (kein Phantom-Container).
- `useValue($liveMap)` und `useValue($ctxInfo)` in `SectionHeader` ziehen
  — die Live-Summen aktualisieren sich automatisch, wenn der Kontext-Poller
  neue Werte liefert (bestehende `refreshContextInfo`/`pollLiveSessions`
  reichen).
- Drei neue i18n-Keys (`groupStat2Modified`, `groupStat2FolderSize`,
  `groupStat2Tokens`) in EN+DE als Interpolator-Funktionen.
- Render-Smoketest-Sektion + neue `.sf-group-stats-2`/`.sf-group-threeline`-
  CSS-Regeln.
- `docs/SETTINGS.md` / `CHANGELOG.md` / `package.json` / `VERSION`-
  Konstante in `plugin.js` — Pflege-Checkliste.

## Nicht-Scope (bewusst ausgeklammert)

- **Ordner-Größe bei nicht-Projekt-Gruppen** (manuell, Datum, Quelle,
  Pinned, Ungrouped): Diese Sektionen haben keinen gemeinsamen
  Wurzel-Pfad. Ohne Pfad keine sinnvolle Größe — wir zeigen dort
  weiterhin nichts (Zeile wird weggelassen, wie bisher). Eine „Größe der
  ganzen Sektion" als Summe über alle Storage-Pfade der Sessions wäre
  erfunden, da `cwd` in der Praxis leer ist.
- **Live-Token-Counter** (`session.context_breakdown`): liefert nur
  Runtime-/Live-Daten, nicht für archivierte Sessions; ein Mischen mit
  historischen Summen wäre inkonsistent.
- **Anwendung auf `tabs.infoDensity` (Zeilen-Detail)**: ausdrücklich nicht
  angefragt und außerhalb der Verantwortung dieses Plans — würde das
  Token-Zähler-Feld je Zeile verlangen und die Zeilen-Höhe spürbar
  verändern.
- **Kosten in USD** (`cost_usd`): optional; nur falls die
  Storage-Schicht die Spalte hergibt. Nicht-blockierend.

## Datenlage — und der Hybrid-Pfad (gewählt 2026-10-05)

Vom Benutzer am 2026-10-05 freigegebener Ansatz: **Hybrid mit Live-Daten**.

Was das heißt:
- **Letzte Änderung**: aus `max(started_at)` über die enthaltenen Sessions
  (die ehrlichste Annäherung, die `session.list` heute hergibt — kein
  erfundenes `updated_at`). Bei Live-Sessions zusätzlich `last_active`
  aus `session.active_list` (Atom `$liveMap`), falls neuer als `started_at`.
- **Ordner-Größe**: nur bei Projekt-Gruppen, dort wird der
  `meta.anchor`-Pfad per Node-Helper aus dem Plugin-Hauptserver rekursiv
  vermessen (Plattform `cmdGetFolderSize` auf `window.hermesDesktop.api`,
  App-IPC `hermes:getFolderSize` — analog zum bestehenden
  `hermes-media://stream`-Door). Gecachte Werte in `$folderSizes`-Atom
  (keyed by Pfad, 60 s TTL, max. 20 Einträge parallel) — kein Blockieren
  nach First-Paint, der Header zeigt den Pfad-Subtext sofort und die
  Größe „lädt nach".
- **Token-Verbrauch**: nur Live-Sessions. Atom `$ctxInfo` (existiert
  bereits für `context_breakdown`) wird über alle in der Sektion laufenden
  Sessions summiert: `Σ context_used` (Tokens) und `Σ context_max`
  (max. Kontext). Zeile zeigt `Σ used / max · %`. Wenn keine Live-
  Sessions in der Sektion, wird der Wert weggelassen — keine erfundene
  Zahl.

| Kennzahl | Hybrid-Quelle | Reichweite |
|---|---|---|
| Letzte Änderung | `max(started_at, last_active)` | alle Sektionen |
| Ordner-Größe | `cmdGetFolderSize(meta.anchor)` | nur Projekt-Gruppen |
| Token-Verbrauch | `Σ $ctxInfo[storedId].used/max` | nur Sektionen mit Live-Sessions |

Drei klare „weglassen"-Pfade: kein Live → keine Tokens, kein Projekt →
keine Größe, alles leer → Zeile fehlt komplett (das `sf-group-twoline`/
`-threeline`-Gating in der Subzeile sorgt für die Höhe).

**Caveats / bewusste Grenzen**:

- Token-Summen zeigen nur einen Ausschnitt — Sessions ohne
  `context_breakdown`-Antwort (z. B. gerade pausiert, dann wieder
  aufgenommen) erscheinen NICHT in der Summe. Das wird im Tooltip der
  Kennzahl offengelegt.
- Folder-Size ist nur eine Momentaufnahme (60-s-TTL). Bei großen
  Projekten mit `.git`-Cache kann der erste Aufruf mehrere hundert ms
  dauern; das cachen wir serverseitig im Hauptserver-Kontext.

## Umsetzung

Plugin-Seite (alle Änderungen in `plugin.js`, sofern nicht anders
angegeben):

1. **Neuer Atom `$folderSizes`** neben den bestehenden Stores
   (`atom({})` keyed by absoluter Pfad, Wert:
   `{ bytes, fetchedAt, inflight }`).
2. **`fn ensureFolderSize(path)`**: liest den Cache, ruft bei Ablauf (>60 s)
   oder leerem Wert `window.hermesDesktop.api({ path: '/api/getFolderSize',
   body: { path } })` auf und legt das Ergebnis ab. Bei `inflight`-Race
   warten alle Aufrufer auf dieselbe Promise. Bei Fehler (App-Door fehlt)
   wird `null` gespeichert und der Wert weggelassen — kein Wurf.
3. **`fn computeSectionStats(section, liveMap, ctxInfo)`**: pure
   Funktion, gibt
   `{ modifiedAt: number|null, folderBytes: number|null,
   tokensUsed: number|null, tokensMax: number|null }` zurück.
   - `modifiedAt = max(item.startedAt, ...liveMap.lastActive)` über alle
     Items der Sektion, deren `storedId` in `$liveMap` liegt.
   - `folderBytes` nur, wenn `section.kind === 'project'` und `section.cwd`
     gesetzt — via `ensureFolderSize(section.cwd)`.
   - `tokensUsed`/`tokensMax` = `Σ` über `ctxInfo[item.id]`, gefiltert auf
     Items der Sektion.
4. **`SectionHeader`** zieht `useValue($liveMap)` und `useValue($ctxInfo)`
   und ruft `computeSectionStats(section, liveMap, ctxInfo)`. Bei
   `density === 'detailed'` und `stats` mit ≥1 vorhandener Kennzahl wird
   ein zweites `<span class="sf-group-stats-2">` unter `.sf-group-sub`
   gerendert. Komponenten der Zeile:
   - Datum: `t('groupStat2Modified', fmtRelativeDate(modifiedAt))` —
     eigenes kleines `fmtRelativeDate`-Helper-Modul, das im Vergleich zu
     `fmtAge` (für „vor 3 Min") echte Kalender-Daten liefert, sobald
     älter als ein Tag („Heute X:XX", „Gestern", „15. Sep").
   - Foldergröße: `t('groupStat2FolderSize', fmtBytes(folderBytes))`
     (eigenes `fmtBytes`-Helper-Modul: KB/MB, eine Nachkommastelle).
   - Tokens: `t('groupStat2Tokens', { used: fmtNumber(used), max:
     fmtNumber(max), pct: Math.round(used/max*100) })` — wenn `used` UND
     `max` da sind.
5. **i18n** (EN+DE): drei neue Interpolator-Keys (siehe Scope).
6. **CSS**:
   ```
   .sf-group-stats-2{ display:flex; flex-wrap:wrap; gap:0 6px;
     font-size:9.5px; font-weight:500; line-height:1.25;
     color:var(--ui-text-quaternary); min-width:0; overflow:hidden }
   .sf-group-stats-2 > span{ white-space:nowrap; overflow:hidden;
     text-overflow:ellipsis }
   .sf-group-head.sf-group-threeline{ min-height:50px;
     padding-top:3px; padding-bottom:3px }
   ```
   Damit bei zweiseitiger Subzeile + Stats-2 die Höhe sauber wächst und
   nichts überläuft.
7. **Render-Smoketest** (`tests/render-test.mjs`): neue Sektion, die
   a) bei `detailed` und gefüllten Stats das `<span class=
   "sf-group-stats-2">` mit korrekten Komponenten zeigt; b) bei leeren
   Stats das Element vollständig fehlt (kein leerer Container).
8. **Pflege-Checkliste**: SETTINGS.md-Block zu `groups.headerDensity`
   aktualisieren, CHANGELOG-Eintrag unter 1.18.0, `package.json` +
   `VERSION`-Konstante in `plugin.js` bump.

## Verifikation

- `npm run check` (Syntax + i18n-Parität EN/DE — neue Keys in BEIDEN
  Bundles).
- `npm test` (Render-Smoketest — neue Sektion für die zweite Kennzahl-Zeile
  belegt Präsenz bei Daten + Wegfall bei leeren Werten).
- `npm run test:style` (Computed-Style-Parität — neue `.sf-group-stats-2`-
  Regel darf bestehende Zeile-Höhen nicht verschieben, wenn die Zeile
  fehlt).
- Manuelle Live-Verifikation mit echten Daten aus dem neuen RPC.

## Follow-ups

- **Style-Test erweitern**, falls die zweite Zeile in bestimmten Themes
  (heller Hintergrund, Dark-Mode) Kontrast-Probleme zeigt.
- **Performance-Audit** für `$folderSizes`: ein 60-s-TTL pro Pfad ist
  okay; bei vielen Projekten (>20) den Race-Schutz (Generation-Counter)
  live im App-Performance-Log nachmessen.
- **Folder-Size-Door `hermes:getFolderSize`** im Hauptserver beauftragen,
  falls noch nicht vorhanden — der Plan fällt sonst auf „Größe
  weggelassen" zurück, ist aber ansonsten vollständig.
- **Gateway-Patch bleibt im ROAD-Block** — sobald `session.list`/`session.
  usage` echte Token-Summen UND `updated_at` liefern, kann die Hybrid-
  Zeile durch eine ehrliche Gesamt-Zeile ersetzt werden (heutiger
  Hybrid zeigt nur Live-Ausschnitte).