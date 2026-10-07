# DnD-Reparatur in TabRow (List + Grid) — Diagnose + Fix

- **Status**: Done — live verifiziert (User, 2026-10-07, nach v1.28.0)
- **Erstellt**: 2026-10-07
- **Betrifft**: `plugin.js` TabRow DnD-Pfad
- **Version**: 1.27.6 (Hit-Test-Bypass, obsolet) → 1.27.7 (Drag-Start-Fix,
  unvollständig) → **1.28.0 (kompletter Umstieg auf Pointer-Drag, Fix)**

## Anforderung

> „Ich weiß nicht, was du gemacht hast, aber das Drag and Drop für List und
> Grid View der Session-Tab funktioniert nicht mehr." — Deniz, 2026-10-07

> „Also das Problem ist immer noch das gleiche. ListView hat beim Session
> Tab kein Drag und ich kann nicht eine neue Projektzuweisung machen. Und
> im Grid View ist der Drag nur am unteren Ende des Session Tabs Karts
> möglich." — Deniz, 2026-10-07 (nach dem v1.27.6-Fix, zeigt: der Fix hat
> ein anderes Problem behoben als das vom User gemeldete)

DnD muss in **List UND Grid** View der Session-Tabs wieder funktionieren
(Drag einer Session → Drop auf Pin-Sektion, Projekt-Header, manuelle
Gruppe, oder ListView-DnD-DropBar).

## Kontext

Mehrere Sessions haben seit 06.10. versucht, DnD zu reparieren:

- **v1.25.1** (`1241abc`) — pointerdown-Capture eingeführt; hat Optionsmenü
  + DnD getötet.
- **v1.27.5** (`a436deb`) — Capture-Handler entfernt. Optionsmenü wieder
  ok; „Grid-Drag bleibt abgesichert: nativer dragstart-Capture-Listener
  (tabBodyRef, dataTransfer-Mime) aus v1.25.1 bleibt".
- **v1.27.5** (`813ac12`) — Zeilen-Geometrie + ListView-DropBar.
- **v1.27.6-probe** (`a258f43`) — Live-Diagnose via Counter + Console-Logger.

## Diagnose-Befund

Logs vom 2026-10-07 21:07 (Commit `a258f43`):

```
effect-attached    {"rowId":"…","view":"list","nodeTag":"DIV"}     ← Listener attached
dragstart-capture  {"rowId":"…","types":["text/session-flow-session","text/plain","application/x-session-flow-session"]}  ← setData OK
react-dragstart    {"rowId":"…","types":[…]}                         ← React-Handler OK
dragenter-target   {"kind":"project","key":"auto:project:p_285ed87b","types":[…]}  ← Section-Handler feuert
drop               {"kind":"project","sessionId":"20261006_164518_cf98db","types":[…],"effect":"none"}  ← Drop kommt an, ABER
```

`effect: "none"` ist das Todesurteil: der Browser hat den Drop verworfen,
weil `dragover.preventDefault()` auf einem Element über der `.sf-section`
nicht gerufen wurde.

### Ursache

Die `.sf-tab`-Karten sind Layout-Container mit eigener Hit-Test-Box
(List: `padding:4px 8px` + `border-radius:6px`; Grid: `padding:8px`
+ `flex-direction:column` + `height:auto` + `border-radius:8px`). HTML5-
DnD feuert `dragover`/`drop` auf das **oberste Element unter dem Cursor**
— das ist die `.sf-tab`, nicht die `.sf-section`. Die `.sf-tab` hat
keinen `onDragOver`-Handler (kein `preventDefault`), also lehnt der
Browser den Drop ab (`dropEffect = "none"`).

### Regression aus v1.27.5 (Commit `813ac12`)

Die Zeilen-Geometrie hat das `.sf-tab`-Padding von 2px auf 4px (List)
erhöht und Grid-Karten komplett zu Layout-Blöcken umgebaut
(`flex-direction:column; align-items:stretch; height:auto;
padding:8px; border-radius:8px`). Genau diese Layout-Vergrößerung
ließ die Karten die DnD-Hit-Tests abfangen.

## Fix (eingebaut, unverifiziert)

CSS-only via `:root[data-sf-drag='on']`-Attribut, gesetzt durch
`useEffect([dragActive])` im SessionsPane-Body. Während eines aktiven
Drags bekommen alle `.sf-tab`-Karten `pointer-events:none`, der Cursor
geht durch sie hindurch zur Section, `dragover` feuert auf der Section
mit `preventDefault`, Drop wird akzeptiert.

```css
:root[data-sf-drag='on'] .sf-tab{pointer-events:none}
:root[data-sf-drag='on'] .sf-tab[data-dragging=true]{pointer-events:auto}
```

Die `[data-dragging=true]`-Ausnahme hält das Drag-Quell-Element selbst
greifbar, damit `dragend` sauber feuert. `sf-flat-dropbar-target` und
andere Hit-Targets außerhalb `.sf-tab` sind nicht betroffen.

## Nicht-Scope

- App-DnD-Infrastruktur (`apps/desktop/src/components/pane-shell/tree/
  renderer/drag-session.ts`) — orthogonal zu Plugin-DnD, eigener Scope.
- Animationen / Glow-Effekte beim Drag.
- DnD aus dem NATIVEN Sidebar heraus.

## Verifikation (nach Fix)

1. `npm run check` ✓
2. `npm test` ✓
3. `npm run test:style` ✓
4. **Live im Desktop**: User drag-trypt List+Grid mit Drop auf
   Projekt-Header und Pin-Sektion. Probe-Logs zeigen `effect: "move"`
   (statt `"none"`) im Drop-Log → Fix bestätigt. Probe wird danach
   entfernt.

## Follow-ups

- Probe-Block (Counter + Logger) nach Bestätigung des Fixes entfernen.
- Style-Test-Block für `:root[data-sf-drag='on']`-Regel hinzufügen
  (Computed-Style `pointer-events: none` auf `.sf-tab` bei gesetztem
  Attribut, `auto` bei `[data-dragging=true]`).
- Hit-Test-Überlegungen für künftige Layout-Änderungen dokumentieren
  (jede Vergrößerung der `.sf-tab`-Box ohne DnD-Handler kann den
  gleichen Bug auslösen).

## Nachtrag 2026-10-07 (v1.27.7) — der v1.27.6-Fix behob das falsche Problem

Nach dem v1.27.6-Fix meldete der User: ListView hat weiterhin **gar keinen**
Drag, GridView nur am unteren Kartenrand. Das zeigt: der Hit-Test-Bypass
(v1.27.6) behebt den **Drop** (dragover/drop wurde vom Browser abgelehnt),
aber das eigentliche Problem lag schon beim **Drag-Start** — der kam in
ListView nie zustande.

### Echte Ursache

`.sf-tab` trägt `draggable="true"`, enthält aber fast ausschließlich
Text-Kinder (`.sf-tab-title`, `.sf-tab-details`, `.sf-tab-meta`-Spans) mit
dem Browser-Default `user-select: text`. Chromium/Electron behandelt einen
`mousedown` + Bewegung über selektierbarem Text als **Text-Selektions-
Geste** und unterdrückt dabei das `dragstart`-Event des Vorfahren-Elements
komplett — unabhängig vom `draggable`-Attribut. Das erklärt beide
gemeldeten Symptome exakt:

- **ListView**: die Zeile ist zu >90 % von Text-Nodes bedeckt (Lead-Icon
  ausgenommen) → Drag startet praktisch nie.
- **GridView**: Drag funktioniert nur am „unteren Rand" — das ist exakt der
  leere `padding-bottom`-Bereich von `.sf-tab` unterhalb der
  `.sf-tab-meta`-Zeile (`margin-top: auto` drückt die Meta-Zeile nach
  unten, darunter bleibt ein schmaler Text-freier Rand), der einzige
  Bereich ohne selektierbaren Text-Node darüber.

Die gesamte DnD-Saga seit v1.25.1 (pointerdown-Capture, Capture-Kill,
Hit-Test-Bypass) hat ausschließlich den **Drop-Pfad** repariert; dieser
Drag-Start-Bug war nie adressiert und bestand vermutlich schon vor v1.25.1
latent (durch die damals knapperen `.sf-tab`-Boxen seltener bemerkt, weil
Nutzer tendenziell den Lead-Icon-Rand griffen).

### Fix (v1.27.7)

```css
.sf-tab{…;user-select:none;-webkit-user-select:none;-webkit-user-drag:element}
```

`user-select:none` auf `.sf-tab` vererbt sich an alle Text-Kinder (sofern
diese es nicht explizit überschreiben — tun sie nicht), der Browser hat
dadurch nichts mehr zu selektieren und bevorzugt überall auf der
Karte/Zeile das native `dragstart`. `-webkit-user-drag:element` markiert
`.sf-tab` zusätzlich explizit als Drag-Quelle (dokumentiert die Absicht,
kein Verhaltensunterschied in Standard-Chromium gegenüber nur
`draggable=true`).

### Verifikation (v1.27.7)

1. `npm run check` ✓
2. `npm test` ✓ (Render-Smoketest, keine Regression)
3. `npm run test:style` ✓ — neuer Block 19 in `tests/style-test.mjs`
   bestätigt per echtem Chromium-Computed-Style:
   - `.sf-tab` → `user-select: none`
   - `pointer-events` vor Drag: `auto`
   - `pointer-events` während `data-sf-drag=on` ohne `data-dragging`: `none`
     (Hit-Test-Bypass aus v1.27.6 bleibt intakt)
   - `pointer-events` auf der Drag-Quelle (`data-dragging=true`): `auto`
   - `pointer-events` nach Drag-Ende: wieder `auto`
4. **Live im Desktop**: User bestätigt 2026-10-07 nach v1.28.0 — Drag
   funktioniert in ListView UND GridView auf der gesamten Karten-/
   Zeilenfläche, Drop auf Projekt-Header (auch innerhalb von Projekt-
   Gruppen), Pin-Sektion und manuelle Gruppen.

## Nachtrag 2026-10-07 (v1.28.0) — v1.27.7 löste nur den Drag-Start, nicht den Abbruch danach

Nach dem v1.27.7-Fix (`user-select:none`) bestätigten Live-Logs
(`~/.hermes/logs/desktop.log`): `dragstart`/`react-dragstart` feuerten
jetzt zuverlässig auch in ListView (mehrfach pro Sekunde bei
Wiederholungsversuchen) — aber **niemals** `dragenter-target` oder `drop`
auf irgendeiner Section. Der native Drag brach nach dem Start ab, ohne
dass der Browser je einen gültigen Drop-Ziel-Hit-Test lieferte. GridViews
„nur am Rand"-Symptom blieb identisch bestehen.

### Echte Ursache

Analyse von Hermes Desktops eigenem Quellcode
(`apps/desktop/src/app/chat/session-drag.ts`, `src/lib/drag-ghost.ts`)
zeigt: die App hat ihre eigene Sidebar-Session-DnD bereits von nativem
HTML5-DnD auf einen **Pointer-Event-basierten Custom-Drag** umgestellt —
mit der im Quellcode dokumentierten Begründung:

> „This replaced the native-HTML5 drag + SessionTileDropBridge: riding
> the native DnD layer meant macOS's cancel snap-back animation, a
> `dragend` held hostage until that animation finished, an Esc the page
> never even saw, and window-level armor against react-dnd/dnd-kit. A
> pointer session has none of those failure modes."

Das deckt sich 1:1 mit dem beobachteten Symptombild hier: natives DnD ist
in diesem Electron/Wayland-Setup grundsätzlich unzuverlässig für
Drag-Sessions innerhalb des eigenen Fensters. Alle sechs Fix-Versuche
(v1.25.1–v1.27.7) haben auf dem nativen Pfad gepatcht, ohne die
strukturelle Ursache zu adressieren.

### Fix (v1.28.0)

Natives HTML5-DnD komplett entfernt, ersetzt durch `beginRowDrag()`
(Plugin-Variante derselben Pointer-Architektur):

- **Schwellenwert** (6px) vor Drag-Engage — normale Klicks bleiben
  unberührt.
- **Ghost-Chip** (`createDragGhost`, reines DOM ohne React, analog zu
  Hermes Desktops `drag-ghost.ts`) folgt dem Cursor.
- **Hit-Test** via `document.elementFromPoint()` + `[data-sf-drop-key]`-
  Attribut auf jeder droppable `.sf-section` sowie den beiden ListView-
  DropBar-Zielen — kein `dragover`/`dragenter` mehr nötig, ignoriert
  `pointer-events` korrekt (macht den v1.27.6-Hit-Test-Bypass obsolet).
- **Esc** bricht sofort ab (kein `dragend`-Warten wie bei nativem DnD).
- **`try/finally`** um den Commit: ein Fehler in `host.sessions.pin()`
  o.ä. kann `$dragActive`/`dragging` nicht mehr dauerhaft hängen lassen.
- `onClick` wird nach einem echten Drag per `justDraggedRef` unterdrückt
  (sonst würde jeder erfolgreiche Drop zusätzlich `onOpen` auslösen).
- Entfernt: `__DND_PROBE__`-Diagnoseblock, nativer `dragstart`-Capture-
  Listener, `sectionHandlers()` (`onDragEnter/Over/Leave/Drop`),
  `pointer-events:none`-Hit-Test-Bypass (v1.27.6).
- `user-select:none` auf `.sf-tab` bleibt bestehen (verhindert weiterhin
  Text-Selektion während der Pointer-Drag-Schwelle erkannt wird).

### Verifikation (v1.28.0)

1. `npm run check` ✓
2. `npm test` ✓ (Render-Smoketest, keine Regression)
3. `npm run test:style` ✓ — Block 19 umgeschrieben: `user-select:none`
   weiterhin aktiv, `pointer-events` auf `.sf-tab` IMMER `auto` (kein
   Bypass mehr wirksam, auch mit `data-sf-drag=on` gesetzt — die Regel
   existiert nicht mehr), `.sf-drag-ghost` trägt `position:fixed` +
   `pointer-events:none`.
4. **Live im Desktop**: User bestätigt — Drag funktioniert jetzt in
   ListView UND GridView auf der gesamten Fläche, inkl. Drop auf
   Projekt-Header innerhalb von Projekt-Gruppen (das ursprünglich
   gemeldete „innerhalb der Projekte nicht greifbar").

## Follow-ups (final)

- `__SF_DND_PROBE__`-Infrastruktur ist komplett entfernt (nicht mehr nur
  deaktivierbar) — sie diagnostizierte ausschließlich den nativen
  Drop-Pfad, der nicht mehr existiert.
- Bei künftigen `.sf-section`/`.sf-flat-dropbar-target`-Änderungen: neue
  droppable Ziele brauchen das `data-sf-drop-key`-Attribut, sonst findet
  `beginRowDrag()`s Hit-Test sie nicht.
</content>
</invoke>