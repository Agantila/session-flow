# Neue Session ohne „Owner nicht gefunden" + Composer-Chip auf dem nativen Sendeweg

- **Status**: Done
- **Erstellt**: 2026-10-06
- **Abgeschlossen**: 2026-10-06
- **Betrifft**: plugin.js (`startNewSessionInCwd`, `branchSessionRow`, Composer-Chip: Anker/Label/Menü/Übernahme)
- **Version**: 1.23.0

## Anforderung

> „Im Kopfbereich des Session Flow Side Panels ist die Option, eine neue
> Session zu starten, die führt aktuell zu einem Fehler, dass der Owner nicht
> gefunden werden kann. Bitte dieses Problem analysieren und ganzheitlich
> fixen. Zusätzlich kann ich die Sessions Side Panel an sich von Hermes Desktop
> nativ nutzen und der Composer Projekt Chip Optionsmenü muss dort genauso das
> Projekt ziehen und sich gleich verhalten."

## Kontext

- Fehlertext der App: `Session owner could not be resolved for "<id>"
  (session.resume)` — `store/session-owner-resolution.ts`
  (`assertSessionOwnerResolved`). Die App routet jeden session-bezogenen RPC
  über eine Owner-Leiter (Tile-Route → Owner-Hinweis → Session-Zeile →
  Profil-Probe) und bricht **fail-closed** ab, wenn kein Owner benennbar ist
  und mehr als ein Profil existiert (`ambientGatewayOwnsEverySession()`; hier
  6+ Profile).
- Das Plugin erzeugte die Session per `host.request('session.create')` (ambienter
  Socket, kein App-Create-Pfad) und öffnete sie mit `host.openSession(id,
  { intent })`. Eine frische Session hat **weder Zeile** (DB-Row entsteht lazy
  beim 1. Prompt, `projects.tree` lässt 0-Turn-Sessions weg) **noch
  Owner-Hinweis** — der SDK-`openSession` schreibt den Hinweis nur, wenn
  `profile`/`route` übergeben wird. Die App legt ihn bei ihrem eigenen Create
  selbst an (`setSessionOwnerHint(stored, capturedRoute)`,
  `use-session-actions/index.ts`). Ergebnis: der Resume der neuen Session fand
  keinen Owner → Fehler.
- Dieselbe Fehlerklasse steckt in `branchSessionRow` (`session.branch_stored`
  → `openSession` ohne Hinweis).
- Composer-Chip (v1.21): `composerDraftAnchor()` rief die **async**
  `resolveNewProjectSessionCwd()` ohne `await` → immer `undefined` → der Chip
  lernte nie einen nativen Anker. Der Draft-Pick wurde zusätzlich nur als
  Merker + localStorage-Write geführt: der App-Atom liest den Key nur beim
  Modul-Init (wirkungslos), setzte aber beim nächsten App-Start ungefragt den
  Projekt-Scope. Der native Sendeweg (`$currentCwd` → `resolveNewSessionCwd`)
  hat keine Plugin-Schreib-Tür.

## Scope

1. **Owner-Fix, zentral**: neuer Helper `openFreshSession(storedId)` — übergibt
   `profile` (= Profil des Sockets, auf dem `host.request` landet,
   `ambientOwnerProfile()`) und `keepAllProfilesScope: false` an
   `host.openSession`. Das SDK trägt daraus den Owner-Hinweis (aktive
   Verbindung + Profil) **vor** dem Resume ein. `session.create` bekommt
   dasselbe Profil (wie der App-Create); das fokussierte Session-Profil ist
   keine Create-Quelle mehr (kann vom Socket abweichen). Genutzt von „+"
   (Kopfzeile), Projekt-Header-„+", Composer-Chip und Branch.
2. **Chip zieht das Projekt aus der nativen Seitenleiste**: synchroner Spiegel
   des App-Sendewegs (`composerDraftAnchor`: Home-Scope → detached, sonst
   `host.state.cwd`, sonst Projekt-Scope-Wurzel) + `projectForCwd` (längster
   Pfad). Bestehende Sessions ohne Baum-Eintrag (frisch, 0 Turns) nutzen den
   Arbeitsordner als Fallback. `isDraft` = „kein fokussierter Stored-Id".
3. **Menü gleich**: aktives Projekt markiert (`data-active`), Projektliste wird
   beim Öffnen frisch gezogen (4-s-Guard) und das offene Menü nachgerendert —
   Projekte aus der nativen Seitenleiste erscheinen sofort.
4. **Draft-Pick wirkt auf dem nativen Sendeweg**:
   `adoptComposerPickForNewSession()` — beim Übergang „kein Fokus → neue
   Stored-Id" wird ein gültiger Pick per `session.workspace.move` auf die von
   der App angelegte Session angewandt (Pick wird verbraucht). Ausnahmen:
   ID schon bekannt (bestehende Session geöffnet), eigener Create des Plugins
   (einmaliger Guard), Session liegt bereits im Pick-Projekt.
5. **Ghost-Lever entfernt**: kein Schreiben von `hermes.desktop.projectScope`
   mehr beim Pick.

## Nicht-Scope

- Kein echtes „Draft-CWD vor dem Senden umstellen" — braucht eine App-Tür
  (`$currentCwd`/`$newChatWorkspaceTarget`). Die erste Runde nach dem Senden
  kann deshalb kurz im App-Ordner starten, bevor der Move greift
  (best-effort, siehe Follow-ups).
- `keepAllProfilesScope:false` setzt die Listen-Ansicht auf den Profil-Scope
  (App-Default). Wer bewusst „Alle Profile" nutzt, sieht nach einer
  Plugin-Create-Aktion wieder den Profil-Scope; der SDK-Default `true` würde
  umgekehrt Standardnutzer umschalten. Der Scope-Zustand ist nicht lesbar.
- Bestehende Sessions werden weiter ohne Hinweis geöffnet (Zeile + App-Liste
  liefern den Owner).

## Umsetzung

- `plugin.js`: `ambientOwnerProfile()`, `openFreshSession()`,
  `startNewSessionInCwd` (profile-Param, Eigen-Create-Guard `ownCreateUntil`),
  `branchSessionRow`; `projectForCwd()`, `composerDraftAnchor()` (sync),
  `composerDraftLabel()`, `refreshComposerPillState()` (`data-sf-cproj-id`),
  `renderComposerPillMenu(menu, isDraft, activeId)`,
  `adoptComposerPickForNewSession()` (Listener auf
  `host.state.focusedStoredSessionId`), CSS `.sf-cproj-item[data-active]`.
- `tests/render-test.mjs`: Sektion „v1.23.0" (16 Checks) + neue Exporte.
- `VERSION`/`package.json` → 1.23.0.

## Verifikation

- `npm run check` ✅ (EN/DE 500 Keys, Hook-Audit grün).
- `npm test` ✅ inkl. neuer Sektion: `session.create` und `openSession`
  tragen das Socket-Profil, `keepAllProfilesScope:false`, Branch-Pfad,
  leeres Profil → `default`; `projectForCwd` (längster Pfad, Pfadgrenze);
  Chip-Draft aus cwd / Projekt-Scope / Home-Scope; Pick-Übernahme (nativ neue
  Session → ein `session.workspace.move`, Pick verbraucht), bekannte Session,
  bereits im Projekt, eigener Create, kein Pick → kein Move.
- `npm run test:style` ✅.
- **Nicht live verifiziert**: ein Probe-Plugin (Create mit/ohne `profile`)
  wurde nicht ausgeführt (Freigabe nicht erteilt). Ursache stützt sich auf den
  App-Quelltext (`session-owner-resolution.ts`, `sdk/index.ts` openSession,
  `session-rpc-dispatcher.ts`); bitte einmal „+" in der Kopfzeile testen.

## Follow-ups

- App-PR-Idee (weiterhin offen): Plugin-Tür für `$currentCwd`/
  `$newChatWorkspaceTarget` — dann kann der Chip den Draft **vor** dem Senden
  umstellen und die Übernahme-Logik entfällt.
- Falls `activeGatewayConnectionId()` leer ist (Legacy ohne Registry) legt das
  SDK keinen Hinweis an — dann bleibt der Fehler in Multi-Profil-Setups
  möglich; bei Bedarf Route über `host.connections()` ableiten.
