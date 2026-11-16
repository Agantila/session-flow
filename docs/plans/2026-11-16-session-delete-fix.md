# Session-Löschen: App-Parität interrupt → close → delete + Owner-Profil

- **Status**: Done
- **Erstellt**: 2026-11-16
- **Abgeschlossen**: 2026-11-16 (v1.29.3 interrupt/close; v1.29.4 Authority-Ursache → REST; v1.29.5 Revision-Fence)
- **Betrifft**: plugin.js (`deleteSessionRow`, i18n EN/DE), tests/render-test.mjs, docs/APP-INTEGRATION.md
- **Version**: 1.29.1

## Anforderung

> „Es gibt einen fehler beim löschen von Sessions mit session.delete kommt eine
> Fehler meldung in Hermes. Bitte prüfen unf fixxen."

## Kontext

**Update (v1.29.4, eigentliche Ursache):** Der gemeldete Toast
„Unknown method session.delete" stammt aus
`tui_gateway/contracts/registry.py::unknown_method_message`: Der Gateway des
aktuellen Hermes-Desktop läuft mit **Session-Authority** — Desktop-Sockets
werden von `AuthorityConnection` bedient (kanonisches Protokoll). Seit
`ws_legacy_fallback.py` (R2-M3) sind Legacy-Session-**Writer** über den WS
gezielt gesperrt („a legacy `session.delete` dropped a row the authority
still held live"): nur Reads (`session.most_recent`, `session.active_list`,
`session.events.stats`, `session.foreign.*`) fallen auf den Legacy-Handler
durch. Kanonischer Ersatz wäre `session.mutate operation=delete` — aber die
App selbst löscht per REST `DELETE /api/sessions/{id}` (ohne
Revision-Fence). Das Plugin stellt sich jetzt auf genau diese Parität um:
`session.interrupt` (Authority-Verb) + REST-Bridge-DELETE mit
`profile`-Routing-Feld; Archivieren ebenso per REST `PATCH {archived}`
(`session.archive` wäre -32601). RPC-Pfad bleibt als Fallback für
Bridge-lose Shells.

Live-Reproduktion-Analyse (Gateway 0.23.1, Quellen: `tui_gateway/methods_session.py`,
`hermes_state_sessions.py` #123583, Desktop `use-session-actions`):

Der Gateway verweigert `session.delete` zweistufig —

1. **Live-Check**: Runtime mit `session_key == target` im Prozess → 4023
   „cannot delete an active session".
2. **Write-Guard** (seit #123583, 2026-09-27): Zeile mit aktiver Turn-Lease /
   Compression-Lock → ebenfalls 4023 (`SessionActiveWriteGuardError`), selbst
   wenn KEINE Runtime des Callers mehr lebt (Bot-, Cron-, Kanban-, TUI-Turns).

Die Desktop-App selbst löscht deshalb in dieser Reihenfolge
(`use-session-actions/index.ts:3083 ff.`, Test
`test_interrupt_does_not_wait_for_agent.py`):

`session.interrupt` (4001/session-not-found wird toleriert) → `session.close`
(Fehler ignoriert) → DELETE **mit Owner-Profil-Scope** (`removed?.profile`,
bei Mehrprofil-Setups ohne Owner → Abbruch statt Fehl-Write).

Das Plugin machte bislang nur: `session.close` (nur wenn die Runtime schon im
30-s-`$liveMap`-Poll stand) → `session.delete` **ohne** `profile`. Folge:

- Laufender Turn (Lease) → 4023-Fehler-Toast, weil interrupt fehlt.
- Fremd laufende Runtime (Bot/Cron/Kanban/TUI, frische Session) → close wurde
  gar nicht erst geschickt (stale Map) → 4023.
- Zeile eines Nicht-Launch-Profils (Agency-Setup, 7 Profile) → Gateway schreibt
  in die Launch-DB → 4007 „session not found", obwohl die Zeile existiert
  (dieselbe Falle, die das Desktop-Routing als `pathWithRemoteOwnerScope`
  dokumentiert).

## Scope

- `deleteSessionRow` auf App-Sequenz umstellen: frische Runtime-Auflösung via
  `findLiveSessionIdByKey` (Map + `session.active_list`-Fallback), dann
  `session.interrupt` → `session.close` → `session.delete`.
  `row.profile` als `profile`-Param an alle drei RPCs mitgeben
  (`SessionParams.profile`, gateway-seitig von `_profile_db` ausgewertet).
- Einmaliger Retry auf 4023 (Guard-Freigabe kann dem close kurz nachlaufen),
  danach i18n-Fehlermeldung `deleteActiveHint` statt roher Gateway-Message.
- Neuer i18n-Key in BEIDEN Bundles (EN/DE) — `npm run check` erzwingt das.
- Test-Sektion im Render-Harness: Sequenz + profile-Param + 4023-Retry.

## Nicht-Scope (bewusst ausgeklammert)

- Kein Interrupt-Abbruch bei Nicht-Gone-Fehlern wie die App (die App rollt
  optimistic UI zurück; die Pane-Zeile bleibt ohnehin stehen — der delete
  entscheidet final, Fehler landet im Toast).
- Kein REST-DELETE-Fallback (Plugin-Door bleibt der RPC; REST-Delete braucht
  den App-Auth-Kontext, den das Plugin nicht besitzt).
- Archivieren/Restore (`session.archive`) hat dieselbe Profile-Lücke, wird
  aber NICHT mitgeändert — separater Folgeschritt, dieser Plan ist der
  gemeldete Delete-Bug.
- Keine Übernahme des Upstream-Repo-Layouts (plugin.js → desktop/, 6 Commits
  hinter origin): Die Live-Installation lädt root-/plugin.js via Symlink.

## Umsetzung

1. `deleteSessionRow` (plugin.js:8745) umbauen wie oben; Helper `rpcErrorCode`.
2. i18n-Key `deleteActiveHint` in EN+DE.
3. tests/render-test.mjs: `deleteSessionRow` in die Exportliste, Param-Log +
   überschreibbarer RPC-Handler im Stub, neue Sektion „Delete-Flow".
4. Docs: APP-INTEGRATION-Zeile „Löschen", CHANGELOG, ROADMAP, Version
   (package.json + VERSION-Konstante) → 1.29.1.

## Verifikation

- Live-Fehlerbild aus `~/.hermes/logs/desktop.log` (13:57–13:58) belegt die
  Kette: v1.29.4 geladen → `hermes:api DELETE /api/sessions/20261114_231538_9e026d`
  → 409 `client_upgrade_required: this app is out of sync (different versions)
  with the Hermes backend; update the app to edit sessions`. Gateway-Seite
  belegt: `hermes_cli/web_routers/sessions.py:586` liefert
  `GET /api/sessions/{id}/mutation-snapshot` →
  `{session_id, exists, runtime_revision, runtime_generation}`; die
  Identität-Felder nennt `apps/shared/src/session-http-mutations.ts`
  (`request_id`, `expected_revision`, `expected_generation`).
- `npm run check && npm test` grün über den KOMBINIERTEN Baum (inkl. der
  uncommitteten Settings-Subtabs-Änderungen der Parallelsession):
  - `node scripts/check.mjs`: Syntax ok, EN/DE je 517 Keys (inkl.
    `deleteActiveHint`), Hook-Audit ok.
  - `node tests/render-test.mjs`: „RENDER-SMOKETEST BESTANDEN" — Sektion 35
    (RPC-Fallback für Bridge-lose Shells) und Sektion 36 (REST-Weg) belegen:
    Snapshot vor Mutation, Fence in DELETE-Query/PATCH-Body, Profil-Routing
    (Query + Routing-Feld), interrupt als RPC ohne profile, kein
    `session.delete`/`session.close` über den WS, Busy → genau EIN Retry mit
    frischem Snapshot und neuer `request_id`, bleibendes Busy →
    `deleteActiveHint`, `client_upgrade_required` → Rohfehler statt
    Busy-Hinweis.
- Live-Deploy: Der Hot-Reload des Desktops zieht die Version erst beim
  Speichern; nach einem Symlink-Tausch hängt der Watcher (AGENTS.md) — dann
  einmal Ctrl+K → „Reload desktop plugins" in der App (kein Neustart).
  Verifikation der geladenen Version: `strings ~/.config/Hermes/Local\ Storage/leveldb/*.ldb
  | grep -A1 hermes.plugin.session-flow._meta` (Flush ~60 s).
