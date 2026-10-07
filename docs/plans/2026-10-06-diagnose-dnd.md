## diagnose-DnD.md

# Diagnose: Drag&Drop in List und Grid geht nicht (Plugin-Streifen)

- **Status**: Offen — Live-Diagnose ausstehend
- **Erstellt**: 2026-10-06
- **Symptom**: In der GridView kann der User nur den unteren Teil einer
  Karte greifen (oberer Teil geht nicht). In ListView geht es komplett nicht.

## Was ich verifiziert habe

1. `git log` auf HEAD: **`31058b3` = v1.24.1** (`fix(pane): Analyse-Befunde
   umgesetzt`). **v1.24.1 hat KEIN DnD angefasst.**
   - `git show 31058b3 -- plugin.js | grep -E 'drag|dnd'` → 0 Treffer
     auf Drag-Logik (nur Retry-Button, Pin-Filter, ResetAll).
2. `v1.24.0` (`8161f9d`) hat nur die drei Click-`openSession`-Aufrufer auf
   `effectiveOpenIntent` umgestellt + Settings-Hinweis + Pick-Clear im
   No-Op-Pfad. Keine DnD-Code-Änderung.
3. `v1.23.0` (`58d3904`) hat nur Composer-Pick-Pfad + Owner-Hinweis
   angefasst. Keine DnD-Code-Änderung.
4. **DnD-Code seit v1.17.3 unverändert**: `draggable: true` (Zeile 8032),
   `onDragStart`-Handler setzt `$dragActive=true` (8036), `sectionHandlers`
   liefert `onDragEnter/Over/Leave/Drop` für `pinned | manual | ungrouped |
   project-mit-cwd` (Zeile 9293+).
5. App-seitig nutzt Hermes-Desktop ein eigenes Pointer-Capture-basiertes
   DnD-System (`apps/desktop/src/components/pane-shell/tree/renderer/
   drag-session.ts`, `startDragSession`), das HTML5-DnD komplett meidet —
   die App-seitige DnD-Infrastruktur kollidiert NICHT mit Plugin-DnD,
   weil sie auf `data-tree-tab="session-tile:..."` und Sidebar-Rows
   beschränkt ist.

## Was ich vermute sehe

Die Ursache ist eine **CSS-Hit-Test-Regression**. Wenn der User die
untere Hälfte der Grid-Karte greifen kann, dann ist der obere Teil von
einem Element mit `pointer-events:auto` (oder ohne `none`) überlagert.

Die wahrscheinlichsten Kandidaten, die ich noch nicht zu 100% ausschließen
konnte:

1. `.sf-more` (More-Menü) im Grid ist `position:absolute;top:6px;right:6px`
   (Zeile 5966) — klein (18x18), würde aber nur eine Ecke blocken, nicht
   die ganze obere Hälfte.
2. Die App-Seite hat ein **transparentes Overlay** über der Plugin-Pane,
   das wir nicht sehen — typisch wäre ein Drag-Layer der App, der aktiv
   wird, wenn die Plugin-Pane im selben Container wie Session-Tiles ist.
3. Ein Theme-Setting (`tabs.themeTab: 'light'` + `tabs.themeSplit: true`)
   hat eine `color-mix`-Konfiguration, die `pointer-events` per Zufall
   blockiert — eher unwahrscheinlich.

## Live-Diagnose (DevTools-Snippet)

Den User bitte Folgendes in DevTools ausführen (oder via das Element
`[data-tour="devtools:devtools"]` öffnen):

```js
// 1) Welche .sf-tab Elemente haben draggable=true?
const tabs = Array.from(document.querySelectorAll('.sf-tab'));
console.log('tabs:', tabs.length, 'draggable:', tabs.filter(t => t.draggable).length);

// 2) Welches Element liegt unter dem Mittelpunkt der etzten Karte?
const lastTab = tabs[tabs.length - 1];
const r = lastTab.getBoundingClientRect();
const cx = r.left + r.width / 2;
const cy = r.top + r.height / 2;
const under = document.elementFromPoint(cx, cy);
console.log('center:', { cx, cy, tag: under.tagName, cls: under.className });

// 3) Oben-links auf Karte — gefangen wir, ist da was anderes?
const topX = r.left + 30;
const topY = r.top + 10;
const top = document.elementFromPoint(topX, topY);
console.log('top:', { x: topX, y: topY, tag: top.tagName, cls: top.className });

// 4) Unten auf Karte — funktioniert das (User sagt ja)?
const btmX = r.left + 30;
const btmY = r.bottom - 10;
const btm = document.elementFromPoint(btmX, btmY);
console.log('bottom:', { x: btmX, y: btmY, tag: btm.tagName, cls: btm.className });

// 5) Welche Element chain ueberlagert die ganze Karte?
let el = under;
const chain = [];
while (el && chain.length < 10) {
  chain.push({
    tag: el.tagName,
    cls: el.className,
    zIndex: getComputedStyle(el).zIndex,
    position: getComputedStyle(el).position,
    pointerEvents: getComputedStyle(el).pointerEvents
  });
  el = el.parentElement;
}
console.log('chain:', chain);

// 6) Ist ein data-tree-tab Element ueberlagert? (App-DnD)
const overlay = document.elementsFromPoint(cx, cy).slice(0, 5)
  .map(e => ({ tag: e.tagName, cls: e.className, id: e.id, attrs: e.getAttributeNames().filter(a => a.startsWith('data-')) }));
console.log('overlay:', overlay);
```

## Plan fuer den Fix

Sobald wir die Diagnose haben:
1. Wenn ein App-Overlay überlagert → Live-Probe schreiben, App-Shape-Hint
   anpassen (siehe Skill).
2. Wenn ein CSS-Konflikt blocken tut → `pointer-events:none` für die
   blockierende Schicht hinzufügen.
3. Wenn ein Pseudo-Element blockt → Pseudo-Element auf `pointer-events:none`
   setzen.

Fix in v1.24.2 als Hotfix.