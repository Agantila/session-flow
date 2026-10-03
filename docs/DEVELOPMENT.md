# Entwicklung — Architektur & Workflow

## Dev-Loop

```bash
./install.sh --link   # einmal: Symlink ~/.hermes/desktop-plugins/session-flow -> Repo
npm run check         # Syntaxcheck + i18n-Audit (Node, keine Dependencies)
```

Danach: `plugin.js` speichern → die App hot-reloaded das Plugin (keine
Neustarts). Falls es klemmt: ⌘K/Ctrl+K → „Reload desktop plugins".
Beim ersten Laden eines fehlerhaften Stands zeigt die App einen Toast mit der
Fehlermeldung; `hermes logs gui -f` tailt das Desktop-Log.

## Datei-Layout (plugin.js)

Die Datei ist bewusst in kommentierte Sektionen geteilt:

| Sektion | Inhalt |
|---|---|
| SDK-Deskriptoren | Namespace-Import + Destrukturierung (robust gegen ältere Builds) |
| Einstellungen | `DEFAULT_SETTINGS`, `$settings`-Atom, Laden/Persistieren (debounced) |
| Gruppen-Store | `$groupsState`, CRUD (create/update/delete/assign/collapse) |
| Sessions-Store | `$sessions` (session.list), `$liveMap` (session.active_list), `$activity` (Gateway-Events), `buildSections()`, `orderedRows()` |
| Lokalisierung | `EN`/`DE`-Bundles (Keys müssen in BEIDEN vorhanden sein — `npm run check`) |
| CSS | injizierte `sf-*`-Klassen, nur Theme-Variablen |
| Animation-Controller | Kaskade + Stream-Reveal (Web Animations API) |
| Wheel-Controller | Strg+Scroll-Zyklus + HUD |
| UI | Pane, TabRow, SectionHeader, StackLayers, GroupDialog, SettingsPage |
| Plugin-Export | `register(ctx)`: Contributions + Controller-Wiring + Dispose |

## Design-Entscheidungen (wichtig fürs Weiterentwickeln)

### Warum Web Animations API statt CSS-Keyframes?

Der Chat rendert Markdown über einen Streaming-Parser (Streamdown) und ist
virtualisiert. CSS-`animation` auf Parser-erzeugten Kind-Elementen feuert bei
jedem Re-Parse erneut → Flackern. `el.animate(...)` läuft direkt am Element,
spielt einmal und ist unabhängig von Style-Engine-Churn.

Dedupe: pro `.aui-md`-Element (stabiler Container) liegt ein `WeakMap`-Zustand
(`done: Set<lineIndex>`). Jeder Zeilen-Index animiert höchstens einmal — auch
wenn der Parser Elemente neu erzeugt. Während des Streamens gilt:

- Zeile `i < last` wird animiert, sobald sie "gesettled" ist (= die nächste
  Zeile existiert).
- Die letzte Zeile bekommt ihre Animation beim Settle (keine Mutationen mehr
  innerhalb des `HOT_WINDOW_MS` von 2,6 s) — geprüft von einem Timer-Sweep.

Kaskade beim Session-Wechsel hängt am offiziellen Hook
`data-session-switching` auf `[data-chat-surface]` (Contract laut SDK-Doku);
als Fallback läuft ein debounced Fokuswechsel-Listener.

`prefers-reduced-motion: reduce` schaltet alles ab. Animationen werden nur auf
Elementen im Viewport (± Puffer) gestartet, damit lange Transkripte nicht
hunderte Animationen auf einmal erzeugen.

### Wheel-Controller

Ein einziger `wheel`-Listener auf `window` (bubble, `passive: false`):

1. Zusatztaste laut Settings? sonst return.
2. `event.defaultPrevented`? Zoom-Flächen (Bild-Lightbox, `useZoomPan`,
   Monaco) haben bereits `preventDefault` gerufen → wir halten uns raus.
3. Ignorier-Selektor (Basis + `wheel.ignoreSelector`) → return.
4. Ab hier: `preventDefault()` (unterdrückt Browser-Zoom) und Delta-Akkumulator
   mit Schwelle + Cooldown pro Richtung.
5. `cycle(richtung)`: Liste aus `orderedRows()` (exakt die Anzeige-Reihenfolge
   der Pane, inkl. Gruppenzuordnung), aktueller Index über
   `host.state.focusedStoredSessionId`, dann `host.openSession(id, { intent })`.
   HUD zeigt `i / n · Titel · Gruppe`.

Wichtig (SDK-Regel): State immer imperativ lesen (`$settings.get()` im Handler),
nie aus Render-Closures.

### Glass & Lesbarkeit (deklarativ)

`applyGlass()` spiegelt die Glass-Settings als **Attribute + Custom Properties
auf `<html>`** (`data-sf-glass="composer chips nograd …"`, `--sf-glass-*`). Das
Stylesheet reagiert ausschließlich per Selektor auf diese Tokens — es wird nie
CSS neu gebaut, nur Variablen gesetzt (`$settings.listen(applyGlass)`).

- **Eingabefeld**: Fläche + Verlauf malt das **Surface selbst** (Border-Box →
  exakt der Outline-Radius, keine Eck-Lücke). Der Input-Fill-Layer wird dafür
  transparent + konzentrischer Innenradius (`calc(var(--radius-2xl) - 1px)`) und
  trägt den **Glow-Ring** (Mask-Ring + transform-animierter Verlauf, Technik wie
  `.arc-border` der App). Blur sitzt auf der stabilen Surface-Box, nicht auf dem
  editierbaren Kind.
- **Glow-Ring (arc)**: Modus `always`/`busy`; `busy` nutzt `currentSessionBusy()`
  ($activity + $liveMap + `host.state.focusedStoredSessionId`, Subscriptions in
  register). Chips/Statusleiste nutzen einen Conic-Highlight via
  `@property --sf-arc-turn`; reduced-motion stoppt, `data-renderer-animations-paused`
  pausiert.
- **Chips**: stabile App-Handles `[data-tour='model-pill']` (nur Primär-Chat)
  und `[data-testid='reasoning-pill']` (überall).
- **Reduced transparency**: bewusst **kein `!important`** auf `backdrop-filter` —
  der app-weite Gate (styles.css) nullt dann global; die Flächen/Fills bleiben.
- **Dispose**: `clearGlass()` entfernt Attribut + Variablen restlos.

### Session-Liste & Aktivität

- `session.list` (Gateway-RPC) liefert die gespeicherten Sessions des aktiven
  Profils (most recent first; interne Quellen wie kanban/tool/oneshot werden
  serverseitig gefiltert).
- `session.active_list` (Poll alle `tabs.livePollSec`) mappt Runtime-IDs auf
  gespeicherte IDs (`session_key`) und liefert Live-Status
  (`working`/`streaming`/`waiting`/…).
- Gateway-Events (`message.start`, `message.delta`, `tool.start`,
  `tool.complete`, `message.complete`, `error`, `clarify.request`) verfeinern
  die Anzeige (z. B. Tool-Name). Events tragen Runtime-IDs → Auflösung über die
  `$liveMap`.
- Der Status-Punkt im Modus `dot` ist das Core-Primitive `SessionStatusDot`
  (eine Quelle der Wahrheit für alle Status-Vokabeln).

### i18n

Eigene Bundles via `ctx.i18n.register({ en, de })`, gelesen mit
`usePluginI18n(ID)`. Werte sind Strings oder Interpolator-Funktionen
(`paneCount: n => …`). Neue Keys: **immer in BEIDEN Bundles** anlegen, sonst
schlägt `npm run check` an.

## Konventionen (sonst lädt das Plugin nicht / bricht)

- Kein JSX — `jsx()`/`jsxs()` von `react/jsx-runtime`.
- Nur `@hermes/plugin-sdk`, `react`, `react/jsx-runtime` importieren.
- Keine hardcodierten Farben; nur `var(--ui-*)` / `var(--chrome-*)`.
- Timer/Listener via `ctx.setTimeout`/`ctx.setInterval`/`ctx.addEventListener`
  oder manuell in `ctx.onDispose` abräumen (DOM-Observer, `<style>`-Tags, HUD).
- Im `register()` nur registrieren; Waiting/Fetching asynchron anstoßen.

## Troubleshooting

| Symptom | Ursache / Fix |
|---|---|
| Toast „Plugin session-flow failed to load" | Syntaxfehler im letzten Save → `npm run check`, dann speichern |
| Plugin taucht nicht auf | Ordnername ≠ `session-flow`? Datei unter `~/.hermes/desktop-plugins/session-flow/plugin.js`? ⌘K → Reload |
| Hot-Reload belegen (Erfolg ist still) | Temporär `console.error(...)` in `register()` setzen + speichern → erscheint als `[renderer console:main] [session-flow] …` in `~/.hermes/logs/desktop.log` (nur Fehler-Level wird geloggt). Alternativ: `_meta`-Stempel im Plugin-Storage (`hermes.plugin.session-flow._meta`) — nach ~1 min im leveldb sichtbar: `strings *.ldb *.log \| grep hermes.plugin` |
| Glass-Effekt fehlt | `glass.enabled`? Bereichs-Toggles? System-„Transparenz reduzieren" aktiv (Blur wird dann global genullt)? Modell-Pill gibt es nur im Primär-Chat |
| Animation passiert nichts | `prefers-reduced-motion` aktiv? Animation in den Einstellungen aus? Nur Assistant-Nachrichten werden animiert |
| Strg+Scroll reagiert nicht | Fokus in Zoom-Fläche (Bild/Editor)? Andere App-Sektion? `wheel.enabled`? |
| Rahmen: „duplicate id" | Zweite Kopie unter anderem Ordner mit gleicher id (z.B. Unified-Package) — nur eine Installation behalten |

## Roadmap-Ideen

- Multi-Profil-Ansicht (profiles.list + per-Profil-Fetch).
- Freies Umsortieren von Gruppen und Tabs; Ordnen per DnD innerhalb der Liste.
- Pro-Gruppe eigene Theme-Akzente via `setAccentOverride`.
- Animation-Presets pro Elementtyp (Headings anders als Code etc.).
