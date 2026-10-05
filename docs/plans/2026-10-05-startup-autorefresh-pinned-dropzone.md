# Startup-Autorefresh härten + Pinned als persistente Drop-Area (v1.19.2)

- **Status**: Done
- **Erstellt**: 2026-10-05
- **Abgeschlossen**: 2026-10-05
- **Betrifft**: `plugin.js` (`$dragActive` Atom + Settle-In-Nachläufe,
  `reconnectRefresh`, `scheduleSettleIn`, `visibilitychange`-Listener,
  Pinned-Placeholder-Section, Window-Fallbacks für drag-end/drop,
  CSS-Keyframe `sf-drop-ready-pulse`, Lifecycle-Cleanup),
  `tests/render-test.mjs` (8 neue Checks)
- **Version**: 1.19.2

## Anforderung

Zwei langstehende Punkte aus der Nutzer-Session:

1. „Beim Start des Desktops wird der Session Flow Side Panel nicht
   aktualisiert final. … das Aktualisieren soll, soweit es geht,
   automatisch und logisch richtig umgesetzt sein, sodass eine
   Aktualisieren manuell gar nicht notwendig ist, aber wird trotzdem
   effektiv und effizient bleiben."
2. „Sorge dafür, dass der Angepinnt Option als Drop Area erscheint, wenn
   ich Start Drag in der List- oder Grid-View mache … die Gruppen-Sektion
   soll auch kein Arrow-Icon haben, weil wir schon das Order-Symbol dafür
   haben."

## Diagnose vor dem Fix

### Startup
- `scheduleGatewayBootstrap` koppelt den Initial-Load an `host.state.gateway==='open'`
  und zieht Sessions + Pins + Live + Projekt-Baum nach dem Socket-Open.
- ABER: kalte Server-Caches (`projects.tree`, `GET /api/sessions`) liefern
  beim ersten Hit nach einem Kaltstart gelegentlich noch unvollständige
  Antworten (Projekt-Baum leer, Pins fehlen, Live-Status zählt 0).
- Weiterer Takt startet nach 30/45/60 s — der User klickte in der Zwischen-
  zeit auf „Aktualisieren", um die Daten jetzt zu bekommen.
- Zusätzlich: nur `window.focus`-Listener, kein `visibilitychange` →
  Tab-Wechsel ohne OS-Fokus wärmt die Pane nicht nach.

### Pinned-Drop-Area
- Die Pinned-Section war schon da (Section-Kind `pinned`, Caret
  ausgeblendet via `isPinned ? null : …`), `onDrop` ruft korrekt
  `host.sessions.pin(id, true)`.
- ABER: `buildSections` fügte die Section nur ein, wenn `pinnedItems.length > 0`.
  Nach `filteredSections.filter(section => section.items.length > 0)`
  verschwand sie, bevor der User seinen Drag auch nur starten konnte.
- Keine visuelle Rückmeldung „diese Sektion akzeptiert einen Drop" während
  des Drags — nur beim Hover.

## Umsetzung

### Startup-Härtung
- **`scheduleSettleIn(ctx)`** feuert nach 1,8 s und 4,5 s je einen
  gezielten Nachlauf — ABER nur für die Teil-Sätze, die noch leer wirken
  (`$sessions`, `$projectsList`, `$pinnedRows`, `$liveMap`). Die bestehenden
  Inflight-/TTL-Guards in `refreshSessions`/`refreshProjectsList`/
  `refreshPinnedIds` verhindern Doppel-Requests, auch wenn der Server
  parallel schon antwortet.
- Settle-In hängt an BEIDEN Bootstrap-Pfaden: initial beim ersten
  Gateway-Open UND bei jedem Reconnect (Standby-Resume, Backend-Neustart).
  Reconnect benutzt zusätzlich `reconnectRefresh()`, das direkt nachzieht
  (Live-Status) + den Rest TTL-gated.
- **`visibilitychange`-Listener** auf `document` in `watchSidebarSync`
  (gedrosselt wie der bestehende `window.focus`-Pfad). Lifecycle-Cleanup
  im onDispose.

### Pinned als persistente Drop-Area
- **`$dragActive`-Atom** signalisiert einen aktiven Drag:
  `TabRow onDragStart = $dragActive.set(true)`,
  `onDragEnd = $dragActive.set(false)`.
- Window-globale `dragend`/`drop`-Hooks resetten den Atom defensiv —
  wenn die Quell-Row zwischendurch unmountet, läuft der lokale onDragEnd
  nicht mehr und `$dragActive` wäre stuck.
- **`buildSections`**: wenn `pinnedItems.length === 0 && $dragActive.get()`,
  wird eine Pinned-Section mit `items: []` + `isDropPlaceholder: true`
  eingefügt. `filteredSections.filter`-Durchgang lässt Platzhalter-
  Sektionen (`isDropPlaceholder: true`) auch mit 0 Items durchrutschen.
- **Rendering**: wenn `section.isDropPlaceholder && items.length === 0`,
  wird eine `sf-pin-placeholder`-Zeile gerendert — Pin-Icon + Hinweistext
  („Hier ablegen zum Anpinnen"), in einer gestrichelten Akzent-Umrandung.
- **CSS**: alle potentiellen Drop-Ziele bekommen `data-drop-ready="true"`
  während eines aktiven Drags → sanft pulsierender Akzent-Rand
  (`sf-drop-ready-pulse` 2,1 s ease-in-out). Beim Hover (`data-drop=true`)
  schaltet das Pulsieren auf die vorhandene stärkere Hover-Hervorhebung
  um. `@media (prefers-reduced-motion:reduce)` deaktiviert die Animation.
- `onPinToggle` am Section-Header nur bei `section.items.length > 0`
  (sonst gibt es nichts zum Lösen; der Toggle wäre missverständlich).

### i18n (EN + DE)
- `pinnedDropHint`: „Drop here to pin" / „Hier ablegen zum Anpinnen".

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM) · EN/DE: alle 462 Keys vorhanden
✓ Alles gut.

$ npm test
… 130 Checks grün, 0 Fehler …
✓ v1.19.2: ohne Drag keine Pinned-Placeholder-Sektion
✓ v1.19.2: während Drag erscheint Pinned-Placeholder-Sektion
✓ v1.19.2: während Drag mindestens eine Section mit data-drop-ready
✓ v1.19.2: Pinned-Placeholder nutzt pinnedDropHint-Key
✓ v1.19.2: nach Drag-End verschwindet Pinned-Placeholder
✓ v1.19.2: Settle-In zieht leeren Session-Cache nach
✓ v1.19.2: Settle-In zieht leeren Projekt-Baum nach
✓ v1.19.2: reconnectRefresh ruft session.active_list direkt
=== RENDER-SMOKETEST BESTANDEN ===
```

## Live-Verifikation

1. Hermes-Desktop neu starten. In den ersten 5 s sollten Sessions,
   Projekt-Baum, Pin-Status, Live-Icons vollständig stehen — kein
   manueller „Aktualisieren"-Klick mehr nötig.
2. Mindestens eine Session in die Pane öffnen, Drag starten. Die
   „Angepinnt"-Sektion erscheint sofort als pulsierendes Drop-Ziel,
   auch wenn vorher nichts angepinnt war. Platzhalter-Zeile mit
   Pin-Icon + Hinweistext wird sichtbar.
3. Session auf die Platzhalter-Zeile droppen → `host.sessions.pin()`
   feuert, flashJustMoved animiert, Zeile landet in der jetzt gefüllten
   Pinned-Section.
4. Drag abbrechen (Escape / woanders droppen) → Pinned-Placeholder
   verschwindet wieder.

## Follow-ups

- Die drei bestehenden Intervalle (30/45/60 s) könnten in den ersten
  zwei Minuten nach einem Kaltstart engmaschiger laufen (adaptives
  Polling); Settle-In deckt die akuten Fälle, der Rest ist Komfort.
- „Erfolgs-Animation" beim Pin-Drop ist derzeit `flashJustMoved` — ein
  echter Flug-Effekt (Row rutscht sichtbar in die Pin-Sektion) wäre
  Komfort, aber UX-Perfektionismus; die User-Beschwerde ist mit dem
  dauerhaften Drop-Target abgedeckt.
