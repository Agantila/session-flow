# DnD-Reparatur in TabRow (List + Grid) — Diagnose + Fix

- **Status**: Offen — Diagnose abgeschlossen, Fix in plugin.js eingebaut, Verifikation ausstehend
- **Erstellt**: 2026-10-07
- **Betrifft**: `plugin.js` TabRow DnD-Pfad
- **Version**: 1.27.6 (geplant)

## Anforderung

> „Ich weiß nicht, was du gemacht hast, aber das Drag and Drop für List und
> Grid View der Session-Tab funktioniert nicht mehr." — Deniz, 2026-10-07

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
</content>
</invoke>