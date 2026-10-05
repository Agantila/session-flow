# Gateway-Bootstrap-Gate — Start- & Reconnect-Initialisierung der Session-Daten

- **Status**: Done
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: 2026-10-05
- **Betrifft**: plugin.js (`register()`-Init-Block, neuer Abschnitt „Start-/Reconnect-Gate“), tests/render-test.mjs (Host-Stub + Gate-Sektion)
- **Version**: 1.18.0

## Anforderung

> „Beim Starten von Hermes Desktop steht zuerst im Session Flows Side Panel, dass
> das Gateway nicht verfügbar ist. Und dann nach einem kurzen Moment kommen die
> Sessions aber ohne den Projektzuweisung. Und dann muss ich manuell erstmal auf
> Aktualisieren klicken, damit überhaupt die Sessions mit den dazugehörigen
> Projekten angezeigt werden. Bitte das ganzheitlich fixen und professionell
> implementieren.“
>
> (Vorab, gleiche Session:) „…das Aktualisieren soll, soweit es geht, automatisch
> und logisch richtig umgesetzt sein, sodass eine Aktualisieren manuell gar nicht
> notwendig ist, aber wird trotzdem effektiv und effizient bleiben.“

## Kontext

Beim App-Start lädt das Plugin VOR dem Desktop-Gateway: `register()` feuerte die
vier Initial-Refreshs (`session.list`, Pins-REST, `session.active_list`,
`projects.tree`) blind beim Load. `host.request` wirft in der SDK-Implementierung
(`apps/desktop/src/sdk/index.ts`, `request`) sofort `Hermes gateway unavailable`,
wenn `$gateway` noch null ist — der komplette erste Daten-Satz verpuffte also.
Der Projekt-Baum (`projects.tree`, Grundlage der Projekt-Gruppierung) kam dann
erst mit seinem 60-s-Takt, wodurch Sessions zunächst unter „Kein Projekt“
standen, bis der Nutzer manuell auf Aktualisieren klickte.

Das SDK bietet mit `host.state.gateway` (readonly-Atom, Werte
`idle`/`connecting`/`open`/`closed`/`error`, Quelle
`apps/desktop/src/store/session.ts` → `reportGatewayState`) genau das Signal, an
das der Initial-Satz gekoppelt gehören muss — das Plugin nutzte es bisher nicht.

## Scope

- Neuer Plugin-Abschnitt „Start-/Reconnect-Gate“:
  `bootstrapSessionData()` (der komplette erste Daten-Satz) +
  `scheduleGatewayBootstrap(ctx)` (Kopplung an `host.state.gateway`).
- Init-Block in `register()`: blinde Calls entfernt, Gate + Seed-Pflege bleiben.
- Reconnect-Pfad: jeder spätere `closed→open`-Wechsel zieht Sessions
  (`scheduleSessionsRefresh(400)`) + Live-Status (`pollLiveSessions()`) nach.
- 20-s-Fallback (Builds ohne das Atom / nie-open-Routen), Sofort-Feuer wenn der
  Socket beim Load schon offen ist (Hot-Reload im laufenden Betrieb).
- Test-Infrastruktur: Host-Stub mit `state.gateway`-Atom + RPC-Call-Log,
  echtes `window.setTimeout`/`clearTimeout`-Pairing (Reconnect-Debounce),
  drei Gate-Assertions direkt nach `register()`.
- Doku: CHANGELOG, ROADMAP („Zuletzt umgesetzt“), APP-INTEGRATION
  (neue SDK-Abhängigkeit), dieser Plan.

## Nicht-Scope (bewusst ausgeklammert)

- Keine Änderung an Poll-Intervallen/Event-Triggern (`message.complete`,
  `session.info`, 30/45/60-s-Takte) — sie bleiben die logischen Auffrischungen
  nach dem Gate.
- Kein neues Setting; das Gate ist immer an (kein sinnvoller „kaputt“-Modus).
- Keine Änderung an `refreshSessions()`/`refreshProjectsList()`-Interna
  (Inflight-Guards, TTLs) — die deduplizieren weiterhin.
- Stattdessen korrigiert: der Render-Test „Stats-2 entfällt bei Sektion ohne
  Items“ prüfte einen im Projekt-Modus unerreichbaren Zustand (Buckets folgen
  immer echten Rows). Assertion auf die echte Regel umgestellt (leeres Projekt
  erzeugt keine Kopfzeile; sichtbar bleibt nur der ehrliche Modified-Wert des
  Kein-Projekt-Buckets).

## Umsetzung

- `plugin.js`: `GATEWAY_BOOTSTRAP_FALLBACK_MS = 20_000`,
  `bootstrapSessionData()`, `scheduleGatewayBootstrap(ctx)` (nach
  `scheduleSessionsRefresh`), Init-Block ruft nur noch
  `scheduleGatewayBootstrap(ctx)` + `pruneSessionProjectSeeds()`.
- Gate-Logik: `wasOpen`-Vergleich im Listener; erstes `open` → `run()`
  (einmalig, `fired`-Flag), spätere `closed→open` → Reconnect-Nachziehen.
  Feature-Detect `typeof listen !== 'function'` → altes Sofort-Verhalten.
  Listener-Cleanup über `ctx.onDispose`.
- `tests/render-test.mjs`: `rpcCalls`-Log im Request-Stub, `$gatewayStub`
  (startet `'idle'`), Gate-Sektion nach `register()` (kein RPC vor `open`,
  Initial-Satz beim `open`, Reconnect nach 400-ms-Debounce geprüft).
- Version: `package.json` + `VERSION` auf 1.18.0 synchronisiert.

## Verifikation

- `npm run check` → grün (Syntax ESM, i18n 403 Keys EN/DE).
- `npm test` → „RENDER-SMOKETEST BESTANDEN“, inkl. der drei neuen Checks:
  „kein session.list vor dem ersten Socket-Open“, „erster Socket-Open feuert
  den Initial-Satz (1× session.list)“, „Reconnect (closed→open) zieht die
  Sessions sofort nach“.
- `npm run test:style` → „STYLE-TEST BESTANDEN (Chromium Computed-Styles)“
  (Design-CSS unberührt — Regressionssicherung).
- Live im Desktop (manuell, nach Hot-Reload): App-Neustart zeigt keinen
  „Gateway“-Banner mehr; Sessions erscheinen mit korrekter Projekt-Zuordnung,
  sobald der Socket offen ist; Refresh-Button bleibt als Manöver verfügbar,
  ist aber nicht mehr nötig.

## Follow-ups

- Optional: „Aktualisieren“-Button könnte bei offenem Socket einen dezenteren
  Platz einnehmen (er ist jetzt Redundanz, kein Muss) — Roadmap-Idee, kein
  Bestandteil dieses Plans.
- Beobachten: ob App-Builds ohne `host.state.gateway` in der Wildnis existieren
  (Fallback deckt sie ab; ein Hard-Cut wäre später möglich).
