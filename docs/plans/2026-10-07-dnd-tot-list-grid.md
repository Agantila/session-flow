# DnD-Reparatur in TabRow (List + Grid) — Diagnose + Fix

- **Status**: Offen — Live-Diagnose läuft
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
- **Heute** (User-Report): DnD geht trotzdem nicht in List UND Grid.

## Hypothesen (gerankt)

### 🔴 H1 — `useEffect`-Capture-Listener hängt am falschen Ref/Node

Der `useEffect` bei `plugin.js:8143-8161` registriert einen nativen
`dragstart`-Listener auf `tabBodyRef.current`. Wenn der Ref beim Mount
nicht gesetzt ist (React 18 strict mode, doppelter Render) oder der
Effect gecancelled wird, läuft setData() nie und `dataTransfer.types`
ist leer im Drop-Handler → `getData('text/...')` liefert `''` → Drop
ist No-Op.

**Diagnose:** Live-Probe im Plugin meldet, ob der Effect läuft und der
Listener bei einem dragstart feuert.

### 🟡 H2 — Radix ContextMenuTrigger frißt dragstart

Die ganze TabRow ist als `body` JSX mit `draggable: true` in
`ContextMenuTrigger asChild` verpackt (`plugin.js:8543`). Radix'
ContextMenuTrigger implementiert eine Slot-Komponente; ältere Radix-
Versionen riefen intern `preventDefault()` auf `pointerdown`, was HTML5-
DnD verhindert. Mit dem v1.27.5-Fix (pointerdown-Capture raus) sollte
das behoben sein — ABER: Radix' ContextMenuTrigger reagiert auf
`onContextMenu`, NICHT auf `dragstart`. Das sollte also orthogonal sein.

**Diagnose:** Probe muss zeigen, ob `dragstart` auf dem `<div class=sf-tab>`
jemals feuert.

### 🟡 H3 — Drop-Targets haben `event.preventDefault()`-Bug

Die `sectionHandlers` (`plugin.js:9910-9940`) liefern
`onDragEnter/Over/Leave/Drop` für Project-Headers. Wenn `canDrop` falsch
ist (z.B. weil Section-Filter-Mode gesetzt ist), gibt der Handler
`return {}` zurück, kein `preventDefault()`. Browser default: kein Drop.

**Diagnose:** Probe meldet, ob onDragOver auf einem Drop-Target
`preventDefault` ruft.

### 🟢 H4 — Electron 37+ setData-in-React-Handler-Issue

Der `useEffect`-Capture-Listener umgeht das bekannte Electron-Issue, dass
`setData()` im React-Handler zu spät kommt. ABER: ist der Capture-Listener
vielleicht nicht (mehr) aktiv? Wenn das Plugin-Bundle gerade neu geladen
wurde (Hot-Reload), wurde der Effect gecancelt und beim Re-Mount nicht
neu aufgesetzt?

## Live-Diagnose (was wir beobachten müssen)

Probe-Code in plugin.js (siehe commit der Diagnose-Version v1.27.6-
probe), der bei jedem Drag-Event in console.error schreibt:

1. **Effect-Lauf-Counter** (Module-State): zählt, wie oft der
   dragstart-Capture-Listener angehängt wird.
2. **Drag-Start-Event-Counter**: zählt, wie oft `dragstart` auf einem
   `.sf-tab` feuert.
4. **Drop-Event-Log**: jeder `onDrop` loggt die getData-Werte.
5. **elementFromPoint-Probe** auf einer Tab-Mitte (GridView):
   `document.elementFromPoint(...)` zeigt, ob die Karte oben links oder
   nur unten greift.

## Nicht-Scope

- Animationen / Glow-Effekte beim Drag — bleiben unverändert.
- DnD aus dem NATIVEN Sidebar heraus (außerhalb der Plugin-Pane).
- DnD in andere Plugins.

## Verifikation (nach Fix)

1. `npm run check` ✓
2. `npm test` ✓
3. `npm run test:style` ✓
4. **Live im Desktop**: User drag-trypt drei Szenarien und bestätigt
   „geht in beiden Types". Probe-Code wird danach entfernt.