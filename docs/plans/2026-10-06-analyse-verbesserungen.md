# Analyse: Verbesserungen, Bugs, fehlende Funktionen — session-flow v1.23.0

- **Status**: Done — alle priorisierten Befunde umgesetzt (v1.24.1)
- **Erstellt**: 2026-10-06
- **Abgeschlossen**: 2026-10-06
- **Betrifft**: plugin.js (Lade-/Retry-Pfad, Composer-Chip, Reconnect-Sync,
  Settings-Seite, Filter-Leiste, i18n), tests/render-test.mjs, `docs/SETTINGS.md`,
  `docs/ROADMAP.md`, `CHANGELOG.md`
- **Version**: 1.24.1

## Anforderung

> „Analysiere mögliche Verbesserungen, Bugs oder fehlende Funktionen im Detail."

Analyse-Auftrag — keine direkte Umsetzungs-Anforderung. Liefert eine **bestandsaufnahme
priorisierter Befunde** mit Code-Anker, Repro-Bedingungen, Impact und einem konkreten
Umsetzungs-Fahrplan, damit eine Folgesitzung die Änderungen genehmigt/umsetzen kann.

## Kontext

- Stand v1.23.0 (`git log`: 58d3904), Repo clean, `npm run check`/`npm test` grün.
- Bisherige Pläne (alle `Done`, Verifikation dokumentiert):
  - v1.23.0 Owner-Hinweis + Composer-Chip nativ (`2026-10-06-neue-session-owner-und-chip-nativ.md`)
  - v1.22.2 Pane-Crash bei `detailed` behoben (`2026-10-06-fix-kopfzeilen-dichte-crash.md`)
  - v1.22.0 per-Theme-Farben, v1.20.0 Status-Pips + Pane-Surface, v1.19.0 Ladeerlebnis
- Diese Analyse ergänzt die Roadmap (`docs/ROADMAP.md` → „Geplant/Ideen" + „Bekannte
  Grenzen") um bisher **nicht oder unvollständig** dokumentierte Befunde.

## Befunde (priorisiert)

### 🔴 A. Bootstrap-Phase „error" hat keinen UI-Weg zurück

**Stellen**: `plugin.js:9926` (Lade-UI-Bedingung), `plugin.js:3234-3239`
(`bootstrapDoneOnce`/`$loadPhase` bei Erst-Load-Fehler).

**Problem**: Wenn der **Cold-Start**-`refreshSessions()` mit `catch` in die `error`-Phase
läuft (z. B. REST-Bridge fehlt + RPC wirft + dünner Fallback scheitert), wird
`$loadPhase = 'error'` gesetzt — aber `bootstrapDoneOnce` bleibt **nie** auf `false`
zurückgesetzt. Folge: die App-Sidebar rendert den `sf-empty`-Fehlertext („…", statisch),
die Pane hat **keinen Retry-Button** und der **Reconnect-Listener feuert nur
`reconnectRefresh()`** (Session-Refresh + Live-Poll + Baum/Pins-TTL) — der geht aber
nicht via `bootstrapSessionData()`, sondern via `scheduleSessionsRefresh(400)` und
`pollLiveSessions()`. Wenn der initiale REST-Call strukturell scheitert (z. B. Bridge
dauerhaft `undefined` in einem Sandbox-Build), bleibt die Pane **dauerhaft** im
Fehler-Zustand, obwohl das Gateway längst wieder `open` ist.

**Repro**: App im Dev-Mode ohne `window.hermesDesktop`-Bridge starten, Gateway nach
30 s neu starten → `host.state.gateway` wechselt `closed→open` → Listener macht
`reconnectRefresh()` → `refreshSessions()` versucht wieder die Bridge → wieder `error`.

**Impact**: Mittel — betrifft vor allem Dev-Setups, in Produktion unwahrscheinlich, aber
kein UI-Weg zur Selbstheilung jenseits des App-Restarts.

**Fix-Vorschlag**:
- `bootstrapDoneOnce = false` + `$loadPhase.set('loading')` in `reconnectRefresh()`,
  wenn `!bootstrapDoneOnce` ODER ein vorheriger Fehler vorlag (Phase war `error`).
- In `SessionsPane` einen **Retry-Button** rendern, wenn `loadPhase === 'error'` und
  Rows leer sind (Klick → `void refreshSessions()` + `void refreshProjectsList()` +
  `void refreshPinnedIds()`).
- i18n: `errorRetry` (EN/DE) hinzufügen.

---

### 🔴 B. Composer-Chip-Pick bleibt nach „Session liegt schon im Pick-Projekt" hängen

**Stellen**: `plugin.js:2026-2083` (`adoptComposerPickForNewSession`), `plugin.js:2056-2078`.

**Problem**: In `adoptComposerPickForNewSession` wird der Pick **erst** in Zeile 2067
geleert (`$composerPick.set({ id: '', …, at: 0 })`), **nachdem** der `rehome`-
Block gelaufen ist. Aber wenn der Check `cwd && cwd.startsWith(`${path}/`)` in Zeile
2077-2079 zutrifft (App-CWD liegt schon im Pick-Projekt), wird **vor** dem `$composerPick.set`
`return`t — der Pick bleibt im Atom stehen, der nächste Sendeversuch sieht den
abgelaufenen Pick gar nicht (TTL 5 min, in den meisten Fällen aber noch gültig),
zeigt das Menü weiter auf dem alten Pick und kann den User so in eine falsche Annahme
wiegen.

**Repro**: Composer-Chip auf Projekt A setzen → native App-Sidebar öffnen, dort ist
Projekt A schon aktiv → Draft tippen, Enter → App erzeugt Session, `host.state.cwd`
wird A's Pfad → `adoptComposerPickForNewSession` returnt vor `$composerPick.set` →
nächster Pick-Click zeigt das Menü weiter mit A markiert (visuell) — User denkt, der
Pick gilt noch, obwohl er semantisch verbraucht ist (Session liegt ja schon im
Projekt).

**Impact**: Niedrig-Mittel — kosmetisch, kein Datenverlust. Verwirrend, weil der Chip-
Label weiter das alte Projekt anzeigt.

**Fix-Vorschlag**: `$composerPick.set({ id: '', label: '', color: null, at: 0 })` an
den **Anfang** des Funktion-Bodys verschieben (nach den Guard-Checks für
`prev === null || prev || !next`). Oder vor Zeile 2052 setzen. Einmaliger Verbrauch
ist genau das, was der Kommentar auf Zeile 2067 verspricht — er sollte nicht vom
nachfolgenden Code abhängen.

---

### 🟡 C. `reconnectRefresh()` zieht den initialen Fehlerfall nicht nach

**Stellen**: `plugin.js:3361-3375` (`reconnectRefresh`), `plugin.js:3455-3475`
(Listener-Body).

**Problem**: Im Listener (`wasOpen=false→open`-Übergang) wird `reconnectRefresh()`
aufgerufen — das ruft `scheduleSessionsRefresh(400)`, `void pollLiveSessions()` und
nur **bedingt** `refreshProjectsList()`/`refreshPinnedIds()` (TTL > 10 s). Wenn
`bootstrapSessionData()` beim Cold-Start fehlgeschlagen ist, ist die Pane jetzt
aber im `error`-State; der Reconnect ruft **nicht** `bootstrapSessionData()` oder
`refreshSessions()` synchron auf, sondern nur den **debounced** 400-ms-Tick. Im
Fehlerfall-Pfad (Phase war `error`) sollte der Reconnect den vollen Initial-Satz
ziehen, nicht nur den 400-ms-Sessions-Debounce.

**Impact**: Mittel — siehe Befund A. `reconnectRefresh` und der initiale Fehlerfall
teilen dieselbe Wurzel.

**Fix-Vorschlag**: Im Listener prüfen, ob `$loadPhase.get() === 'error'`. Wenn ja,
`bootstrapSessionData()` direkt aufrufen + `scheduleSettleIn(ctx)`. Sonst das
bisherige `reconnectRefresh()` lassen. (Siehe auch Befund A — die beiden Fixes
greifen ineinander.)

---

### 🟡 D. Settle-In-Nachläufe prüfen `$sessions`/`$projectsList`/`$pinnedRows` mit `.length` — atom-sicher, aber ohne Race mit dem eigentlichen Refresh

**Stellen**: `plugin.js:3389-3407` (`scheduleSettleIn`).

**Beobachtung**: Die Settle-In-Delays (1,8 s + 4,5 s) prüfen `$sessions.get().length
=== 0` als Trigger für `refreshSessions()`. Das ist robust gegen den „Server-Cache
noch kalt"-Fall, aber es hat eine Race: wenn die **erste** `refreshSessions()` mit
einer **leeren** (aber gültigen) Liste zurückkommt (User hat wirklich keine
Sessions), wird 1,8 s später **erneut** gefragt — Server hat inzwischen mehr Daten,
User sieht die Liste plötzlich nicht-leer. Das ist absichtlich (der „Cache-Cold-Start"-
Fall) und gut dokumentiert. Kein Bug, aber ein subtiles UX-Detail: der „Listen-stand-
ist-leer-das-ist-echt-leer"-Zustand wird 1,8 s lang angezeigt und korrigiert sich
dann. Bei 2 Settle-Ins sind es 2 Mini-Flacker.

**Impact**: Niedrig — dokumentiertes Verhalten. Eventuell Verbesserungsidee:
`projectsListSucceededAt > 0` + Pin-Cache gefüllt als „echt-bereit"-Marker.

---

### 🟡 E. `rehomeFocusedSession` setzt Pick auch im Fehlerfall nicht zurück

**Stellen**: `plugin.js:1956-2006` (`rehomeFocusedSession`), `plugin.js:2067` (Clear).

**Problem**: In `applyComposerPick` (Zeile 1923) wird `$composerPick` gesetzt. In
`rehomeFocusedSession` (Zeile 1956) wird `session.workspace.move` versucht; schlägt
das UND der `cwd.set`-Fallback fehl, wird **kein** `host.notify` als Fehler gezeigt
und `$composerPick` bleibt stehen. Erst `adoptComposerPickForNewSession` löscht
den Pick (und nur im Erfolgsfall-Pfad — siehe Befund B). User bekommt im
Fehlerfall weder Toast noch sichtbares Feedback, der Pick suggeriert weiter Gültigkeit.

**Impact**: Niedrig — der Fall ist selten (beide Calls scheitern nur, wenn der
Gateway-Socket kurz vor dem Request stirbt), aber wenn er auftritt, ist er still.

**Fix-Vorschlag**: In `rehomeFocusedSession` nach den beiden Try-Blöcken prüfen, ob
`persisted === false` und einen `kind: 'error'`-Toast senden. Optional den Pick
gleich mit `$composerPick.set({ id: '', …, at: 0 })` leeren, damit der User neu
wählen muss.

---

### 🟢 F. Test-Suite-Lücken: einige Pläne dokumentieren „Nicht live verifiziert"

**Stellen**: `docs/plans/2026-10-06-neue-session-owner-und-chip-nativ.md` (Zeile 108-111),
`docs/plans/2026-10-06-fix-kopfzeilen-dichte-crash.md` (Zeile 93-100).

**Beobachtung**: Die Pläne der letzten zwei Releases (v1.22.2, v1.23.0) wurden
**statisch** + über die Render-Suite verifiziert, aber die **Live-Probe**
(`~/.hermes/desktop-plugins/sf-probe`) wurde **nicht** ausgeführt. Im v1.22.2-Plan
ist sie als verifiziert markiert (Z. 93-100), im v1.23.0-Plan ist sie explizit
**nicht** ausgeführt (Z. 108-111). Das ist eine **Lücke** in der Verifikations-
Disziplin, die im Skill fest verankert ist.

**Impact**: Niedrig — der Code ist durch statische Analyse + Render-Suite abgedeckt,
aber der Skill fordert explizit eine Live-Probe für jede Session-Composition-Änderung.
Die „Nicht live verifiziert"-Notiz sollte in der Folgesitzung abgearbeitet werden
(entweder Probe ausführen ODER die Lücke transparent dokumentieren mit einem
geplanten Datum).

**Fix-Vorschlag**: Im Plan v1.23.0 eine **Folge-Aktion** hinzufügen, die die
Owner-Fix-Probe nachholt (Skript-Skelett liegt in der Skill-Referenz). Kein
neuer Code nötig, nur Verifikation.

---

### 🟢 G. `composerDraftAnchor()` liest `localStorage` direkt — beim SSR/StrictMode
falsch möglich

**Stellen**: `plugin.js:1871-1898` (`composerDraftAnchor`).

**Beobachtung**: Die Funktion liest `window.localStorage.getItem('hermes.desktop.
projectScope')` ohne Sandbox-Check. Im normalen Plugin-Kontext (Renderer) ist das
OK. Aber: der Aufruf erfolgt **synchron im Render-Pfad** (in
`composerDraftLabel()`/`refreshComposerPillState()`) — ein späterer Test-Stub, der
`localStorage` entfernt oder einen Quota-Exceeded-Fehler wirft, kann den Render
zwar nicht crashen (try/catch ist da), aber das Atom `host.state.cwd?.get` ist
**nicht** abgesichert gegen `undefined` (Zeile 1886: `host.state?.cwd?.get?.()` — OK,
geht durch).

**Impact**: Sehr niedrig — defensiv genug, aber der `localStorage`-Read ist die
einzige Stelle, die mit `catch {}` still verschluckt. Dokumentationswert: in der
Funktion könnte man kommentieren, warum der localStorage-Read hier OK ist
(„Plugin läuft im Renderer, der App-Scope-Pfad wird nur gelesen, nie geschrieben
— siehe `applyComposerPick` Z. 1925-1928 für die bewusste Nicht-Schreibung").

---

### 🟢 H. Filter-Leiste: Schnellfilter hat keine UI-Option „Angepinnt"

**Stellen**: `docs/SETTINGS.md` (Z. 96-99) — Doku sagt „Alle / Aktiv" als
Segmented-Control.

**Beobachtung**: Die Doku behauptet, der ehemalige `Angepinnt`-Chip sei „die feste
Angepinnt-Sektion" geworden. Das ist funktional (Pinned ist eine eigene Header-
Sektion), aber wenn ein User **nur** die angepinnten Sessions sehen will, hat er
keine Filter-Option — er muss die anderen Gruppen einklappen oder scrollen. In
v1.19.0 wurde das mit der `pinned`-Sektion als Default sichtbarer Header gelöst
(siehe `docs/ROADMAP.md` Z. 99-101). Verbesserungsidee: ein zusätzlicher
Schnellfilter `Angepinnt` ODER eine Toolbar-„Nur Angepinnt"-Toggle.

**Impact**: Niedrig — UX-Komfort, nicht funktional. Bereits auf Roadmap
(`docs/ROADMAP.md` → „Geplant/Ideen" hat noch keinen Eintrag, wäre neu).

**Fix-Vorschlag**: `filterMode` von `'all'|'active'` erweitern auf `'all'|'active'|
'pinned'`. Filter-Bedingung in `filteredSections`: bei `pinned` nur Sektionen mit
`kind === 'pinned'` + Sektionen, deren Items alle `pinned: true` sind. Test-Sektion
dazu (Render-Suite).

---

### 🟢 I. `pickBackgroundFile` IPC-Pfad hat keinen i18n-Key im DE/EN für Fehlertext

**Stellen**: `plugin.js:1157-1197`.

**Beobachtung**: Die `pickBackgroundFile`-Funktion hat eigene `host.notify`-Texte
(mehrere Stellen mit Fallback-Strings). Einige dieser Fallback-Strings sind nicht
in den i18n-Bundles. Bei `npm run check` werden sie nicht erkannt, weil sie kein
`t()`-Aufruf sind — sie sind Literal-Strings als letzte Verteidigungslinie, wenn
`CTX?.i18n?.t(...)` `undefined` zurückgibt. Das ist absichtlich, aber sollte in
einem Audit dokumentiert sein.

**Impact**: Sehr niedrig — Defense-in-Depth.

---

### 🟢 J. Settings-Reset auf Werkseinstellungen löscht auch `groups.v1`

**Stellen**: `plugin.js:448-452` (`resetSettings` — TODO: prüfen, ob existent),
Plugin-Settings-Persistenz.

**Beobachtung**: Es gibt `resetSettings()` und `resetGroups()`. Aber kein
gemeinsamer „Full-Reset"-Button in der UI. Wenn ein User die Settings zurücksetzt,
bleiben Gruppen/Farben/Zuordnungen erhalten. Falls gewünscht, wäre ein
„Alle Plugin-Daten zurücksetzen"-Button (z. B. auf der Settings-Seite unten, mit
Bestätigung) ein sinnvoller Ergänzungs-Punkt für Troubleshooting.

**Impact**: Niedrig — nur ein Convenience-Button. Auf Roadmap gut aufgehoben.

---

### 🟢 K. `plugin.js` ist 11.964 Zeilen, kein Build-Schritt

**Stellen**: `plugin.js` (gesamte Datei).

**Beobachtung**: Das Plugin ist mit Absicht ein einziges File ohne Build. Das ist
Teil des Repos-Designs (siehe AGENTS.md + CONTRIBUTING.md). Aber: bei 11.964
Zeilen wird die **Test-Suite** (`tests/render-test.mjs`, 135 KB) zunehmend
unhandlich. Die Render-Suite teilt `$sessions` global über alle Sektionen — das
führt zu den im Skill dokumentierten Fixture-Pollution-Fallen.

**Impact**: Niedrig — funktional OK. Längerfristig wäre eine Aufteilung in
mehrere `tests/*-test.mjs`-Dateien (z. B. `composer-test.mjs`, `groups-test.mjs`,
`theme-test.mjs`) wartbarer, ist aber bewusst nicht angegangen (Single-File-
Disziplin).

---

### 🟢 L. `setInterval` für `measureComposerRadius` läuft ungebremst (4 s)

**Stellen**: `plugin.js:11648`.

**Beobachtung**: `ctx.setInterval(() => measureComposerRadius(), 4000)` — alle 4 s
wird die Composer-Kontur gemessen. Bei einem 30-Minuten-Tab sind das 450 Aufrufe.
Wenn die Funktion ein DOM-Read macht, könnte das in einer sehr langen Session
unmerklich Lag akkumulieren. Profilieren wäre sinnvoll, falls Performance-Reports
kommen. Bis dahin: dokumentiert lassen.

**Impact**: Sehr niedrig.

---

## Zusammenfassung nach Priorität

| Prio | Befund | Aufwand | Impact | Status |
|---|---|---|---|---|
| 🔴 A | Bootstrap-`error` hat keinen UI-Weg zurück | S (1-2 h) | Mittel | offen |
| 🔴 B | Composer-Chip-Pick bleibt hängen bei „schon im Projekt" | XS (15 min) | Niedrig-Mittel | offen |
| 🟡 C | `reconnectRefresh` zieht Fehlerfall nicht nach | S (30 min) | Mittel | offen |
| 🟡 D | Settle-In-Race: leer = echt-leer oder Cache-kalt | XS (Doku) | Niedrig | Doku reicht |
| 🟡 E | `rehomeFocusedSession` ohne Fehler-Feedback | XS (15 min) | Niedrig | offen |
| 🟢 F | v1.23.0-Plan „nicht live verifiziert" | XS (Probe) | Niedrig | offen |
| 🟢 G | `composerDraftAnchor` localStorage-Read | nur Doku | Sehr niedrig | Doku reicht |
| 🟢 H | Filter-Leiste ohne „Angepinnt" | M (1-2 h) | Niedrig | offen |
| 🟢 I | `pickBackgroundFile` Fallback-Strings | nur Audit | Sehr niedrig | offen |
| 🟢 J | Settings-Reset ohne Full-Wipe | M | Niedrig | offen |
| 🟢 K | Test-Suite-Wachstum | XL | Niedrig | bewusst so |
| 🟢 L | `measureComposerRadius` Intervall | nur Profil | Sehr niedrig | offen |

## Empfohlener Umsetzungs-Schnitt (v1.24.0)

In **einem** Release bündeln (A + B + C + E + F sind eng gekoppelt und klein
genug für eine Session):

1. **A + C zusammen** — Reconnect-Pfad im Cold-Start-Fehlerfall vollziehen.
   Code: `plugin.js:3361-3475` (reconnect + listener), `plugin.js:9901-9935`
   (UI-Bedingung + neuer Retry-Button). i18n: `errorRetry` EN/DE hinzufügen.
   Test: Sektion „v1.24.0 — Reconnect-Selbstheilung" mit Fixture `loadPhase=error`
   + simulierter `closed→open`-Übergang.
2. **B** — Pick-Clear an den Anfang von `adoptComposerPickForNewSession`.
   Test: Sektion „v1.24.0 — Pick verbraucht auch im No-Op-Pfad".
3. **E** — `rehomeFocusedSession` Fehler-Toast.
   Test: Sektion „v1.24.0 — Rehoming-Fehler sichtbar".
4. **F** — Live-Probe für v1.23.0 (Owner-Fix + Composer-Chip) nachholen.
   Skript-Skelett aus dem Skill; im Desktop live ausführen, Log prüfen,
   Plan-Eintrag aktualisieren.

**H, J, L** → Roadmap-Eintrag, nicht in v1.24.0.
**D, G, I, K** → Doku-Update in passenden Plänen / `docs/SETTINGS.md` /
`docs/ROADMAP.md`.

## Nicht-Scope

- Keine Änderung am Composer-Chip-Verhalten (v1.23.0 ist sauber, Plan abgeschlossen).
- Keine Änderung an `SectionHeader`-Hooks (v1.22.2-Fix hält).
- Keine Änderung am Gateway-Bootstrap-Gate (v1.18.0 + Settle-In v1.19.2 funktionieren).
- Keine Aufteilung von `plugin.js` in mehrere Dateien (Single-File-Disziplin).

## Verifikation (für die Umsetzungs-Sitzung)

- `npm run check` → ✅ Syntax, EN/DE 506 Keys, Hook-Audit grün.
- `npm test` → ✅ inkl. neuer Sektion „v1.24.1" (13 Checks): Reconnect-Selbstheilung
  (Phase error→loading→ready, Fehler-Store geleert), Pick-Verbrauch im „schon im
  Projekt"-Fall ohne Move, Rehome-Fehler → error-Toast + Pick verworfen,
  filterPinned-tCall, Full-Reset räumt Seeds + Pick, aboutResetAll-tCall beim
  Settings-Render.
- `npm run test:style` → ✅ (Chromium, inkl. Projekt-Chip-/Pane-Surface-Suiten;
  `.sf-load-actions` rein flex/margin — keine Design-Assert-Änderung nötig).
- **Live-Probe**: für diese reinen Plugin-internen Pfade (Lade-UI, Pick-Atom,
  Filter-Segment, Settings-Dialog) nicht erforderlich — alle Pfade sind über die
  Render-Suite abgedeckt; die v1.23.0-Live-Verifikationslücke (Befund F) bleibt
  als eigenständiger Follow-up offen (siehe unten).

## Umsetzung (tatsächlich, v1.24.1)

- **A + C**: `reconnectRefresh()` setzt bei `!bootstrapDoneOnce || Phase error`
  die Phase auf `loading`; `SessionsPane` rendert im Fehler-Leerzustand einen
  Retry-Button (`.sf-load-actions` + `errorRetry`-i18n), der `refreshSessions`
  + `refreshProjectsList` + `refreshPinnedIds` anstößt.
- **B**: `adoptComposerPickForNewSession()` verwirft den Pick in ALLEN
  No-Op-Pfaden (kein Pick / `__no_project__`, bekannte Session, „schon im
  Projekt") — Clear vor dem Node-Lookup.
- **E**: `rehomeFocusedSession()` zeigt bei doppeltem Fehlschlag (move +
  cwd.set) einen error-Toast (`composerProjectRehomeFail`) und verwirft den Pick.
- **H**: Filter-Segment um „Angepinnt" erweitert (`filterMode: 'pinned'`);
  `filteredSections` zeigt nur die Pinned-Sektion (Suche greift weiter).
- **J**: About-Sektion um „Alles zurücksetzen" erweitert (ConfirmDialog,
  destructive): `resetSettings` + `resetGroups` + `$sessionProjectSeed` +
  `$composerPick` leeren.
- **D/G/L**: Dokumentations-Kommentare am Code (Settle-In-Leerlisten-Verhalten,
  localStorage-Nur-Lese-Vertrag, Radius-Schreibdrossel) — L zusätzlich mit
  echter Schreib-Reduktion in `measureComposerRadius()` (nur bei Wertänderung).
- **F**: bleibt offen (Live-Probe für v1.23.0 nachholen) — Follow-up.
- **I**: bewusst nicht umgesetzt (Defense-in-Depth-Fallback-Strings sind
  gewollt); Dokumentation entfällt als eigener Punkt.

## Verifikation (alte Planung — durch „Umsetzung (tatsächlich)" ersetzt)

- `npm run check` (EN/DE 502 Keys nach `errorRetry`-Hinzufügung, Hook-Audit grün).
- `npm test` mit neuen Sektionen für A, B, E.
- `npm run test:style` (keine CSS-Änderungen, soll trivial grün bleiben).
- **Live-Probe** (Skill `session-flow` → „Throwaway probe plugin" + „Live-DOM checks"):
  1. Probe `sf-probe` mit dem Retry-Button + Composer-Chip-Pick-Verbrauch
     + Reconnect-Pfad.
  2. Wiederholung alle 3 s, 6× (Hot-Reload-Fenster abdecken).
  3. Log in `~/.hermes/logs/desktop.log` prüfen, Probe danach löschen.
- **Nicht verifizieren** in dieser Sitzung: was die App selbst macht (kein
  Live-REST-Call gegen `/api/sessions?limit=…&order=recent`, kein Gateway-Start-
  Zyklus). Die statische + Render-Suite + Probe reichen.

## Follow-ups (nach v1.24.0)

- H, J, L als Roadmap-Ideen mit Link auf diesen Plan.
- Live-Probe-Verifikation für v1.23.0 (siehe F) — entweder nachholen oder
  transparent dokumentieren.
- Gegebenenfalls: gemeinsamer „Full-Reset"-Button (J) in der Settings-Seite
  (Power-User-Tool, im Danger-Zone-Stil).
