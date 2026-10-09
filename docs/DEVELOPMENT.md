# Entwicklung — Architektur & Workflow

## Zwei Builds (seit v1.29.0)

**Quelle der Wahrheit ist `full/plugin.js`** (alle Features, Standalone).
Der committete `desktop/plugin.js` ist der **generierte SDK-only
Catalog-Build** (`node scripts/build-catalog.mjs` entfernt alle
`/* #full */ … /* #end */`-Regionen) — er ist der Eintrittspunkt, den der
Hermes Plugin Catalog am gepinnten SHA lädt (Katalog-Regel 8; dokumentiertes
Layout seit v1.29.1: `plugin.yaml` am Repo-Root, `full/` außerhalb von
`desktop/`). CI schlägt an, wenn `desktop/plugin.js` nicht dem Stand von
`full/plugin.js` entspricht; BEIDE Dateien immer zusammen committen.

Full-only-Features (Chat-Animation, Composer-Chip, Glass, UI-Tabs-Optik,
Chat-Hintergrund, Sidebar-DOM-Sync, Desktop-Bridge-Doors) gehören ausschließlich
in `#full`-Regionen; `tests/surface-test.mjs` (Teil von `npm run check`)
schlägt bei Regel-8-Verstößen im Catalog-Build an. SDK-Slot-Anfragen laufen
über upstream hermes-agent #116305 — landen die Slots, wandeln die Regionen
sich in SDK-Pfade um.

## Dev-Loop

```bash
./install.sh --link   # einmal: Symlink ~/.hermes/desktop-plugins/session-flow -> <repo>/full
npm run check         # Syntax + i18n + Hook-Audit (beide Builds) + Surface-Tripwire
npm test              # Render-Smoketest gegen BEIDE Builds (Stub-basiert, ohne App)
npm run test:style    # optional: Computed-Style-Test am echten Chromium (skip ohne Playwright)
```

Danach: `full/plugin.js` speichern → die App hot-reloaded das Plugin (keine
Neustarts). Das gilt auch im `--link`-Modus — der File-Watch folgt dem
Symlink. Falls es klemmt: ⌘K/Ctrl+K → „Reload desktop plugins".
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
  transparent und trägt den **Glow-Ring** (Mask-Ring + transform-animierter
  Verlauf, Technik wie `.arc-border` der App). Sein Radius ist **konzentrisch
  gemessen**: `measureComposerRadius()` liest alle 4 s das berechnete
  `border-radius` des Surfaces und setzt `--sf-arc-radius` = r − 1px (Border).
  Warum messen? Tailwind v4 inlined die Theme-Radius-Skala — `--radius-2xl`
  existiert zur Laufzeit nicht (belegt: `getPropertyValue('--radius-2xl')` = ""),
  der Radius folgt `--radius-scalar` (hier 0.2 → 4.8px Kontur). Blur sitzt auf
  der stabilen Surface-Box, nicht auf dem editierbaren Kind.
- **Glow-Ring (arc)**: Modus `always`/`busy`; `busy` nutzt `currentSessionBusy()`
  ($activity + $liveMap + `host.state.focusedStoredSessionId`, Subscriptions in
  register). Chips/Statusleiste nutzen einen Conic-Highlight via
  `@property --sf-arc-turn`; reduced-motion stoppt, `data-renderer-animations-paused`
  pausiert.
- **UI-Tabs**: `applyUiTabs()` spiegelt die Sektion als `data-sf-ui-tabs`-Tokens
  (+ `--sf-ui-tab-*`-Variablen) auf `<html>`; CSS stylt die Tabs über
  `:is([class~='group/tab'],[data-sf-ui-tab='true'])`
  (Chip-Geometrie via `height:auto` + Margins, Close über `--pane-tab-close-width`,
  Label über `[class~='truncate']`).
  **Wichtig:** Session-Tabs im Content-Bereich werden von der App in ein
  Kontextmenü gewrappt — der Trigger ÜBERSCHREIBT `data-slot`
  (`context-menu-trigger` statt `pane-tab`)! Nie auf `data-slot='pane-tab'`
  selektieren; strukturell arbeiten: `role="tab"` + `.pane-tab-content`
  (JS-Marke `data-sf-ui-tab`, alle 2 s) bzw. `[data-tree-tab^='session-tile:']`
  für den Busy-Status. Die Marken überleben Re-Renders (React lässt fremde
  Attribute in Ruhe) und werden bei Remounts neu gesetzt.
- **Einstellungs-Navigation**: `SettingsNav` rendert sticky Kategorie-Chips über
  die Sektionen (`sf-sec-*`-IDs); Klick = `scrollIntoView({behavior:'smooth'})`,
  Scroll-Spy via `IntersectionObserver` (rootMargin `-6%/-78%` → nur die oberste
  sichtbare Sektion zählt); `scroll-margin-top: 46px` hält Titel unter der Leiste
  frei. Presets (`UI_TABS_PRESETS` + `applyUiTabsPreset`) patchen die Sektion in
  einem `patchSettings`-Call.
- **Chips**: stabile App-Handles `[data-tour='model-pill']` (nur Primär-Chat)
  und `[data-testid='reasoning-pill']` (überall).
- **Reduced transparency**: bewusst **kein `!important`** auf `backdrop-filter` —
  der app-weite Gate (styles.css) nullt dann global; die Flächen/Fills bleiben.
- **Dispose**: `clearGlass()` entfernt Attribut + Variablen restlos.
- **Individualisierung (Personal)**: `applyPersonal()` spiegelt die Sektion als
  Attribute + Variablen (`data-sf-accent/bg/shell*`, `--sf-accent-color`,
  `--sf-bg-*`, `--sf-shell-*`). Akzent = **unlayered `--ui-accent`-Override**
  (sticht `@layer base` der App — kein `!important`). Hintergrund = pro
  Pane-Host injizierter `.sf-bg-layer` (`z-index:-1`, unter dem Inhalt; Video
  als `<video>`-Kind, **nur auf sichtbaren Panes** — `[data-pane-hidden]`-Gate,
  damit Keep-Alive-Tabs nichts dekodieren). Dateien laufen über
  `hermes-media://stream/<encodeURIComponent(pfad)>` (App-Protokoll, Range-
  fähig — live verifiziert inkl. laufendem Video). Shell = Radius + Schatten +
  Kontur auf `[data-pane-host]:not([data-pane-overlay])` — **nie** Geometrie
  oder overflow der Panes anfassen (Anchor-Inline-Styles!). `syncPaneBackgrounds()`
  läuft im 2,5-s-Takt für neu gemountete Panes; Dispose über `clearPersonal()`.
- **Datei-Picker**: `window.hermesDesktop.selectPaths({ title, filters, multiple:false })`
  (App-IPC `hermes:selectPaths`) → absolute Pfade; Bild/Video wird an der
  Endung erkannt.
- **Sessions-Pane (v1.7)**: Ansicht `list`/`grid` über `data-view` am
  `.sf-items`-Wrapper + `--sf-grid-*`-Variablen (`applyGrid()`); Grid-Karten
  sind dieselben TabRows (CSS-only Umbau — Klick, Drag & Drop, Kontextmenü
  bleiben unverändert). Das **More-Menü** (`DropdownMenu` aus dem SDK, mit
  Feature-Detect) und die Dialoge (`RowDialogHost`: rename/color/move/delete)
  rufen dieselben Gateway-RPCs wie die App auf — `session.title` (nur für
  live/geladene Sessions!), `session.branch_stored`, `session.workspace.move`,
  `session.archive`, `session.delete` (vorher Runtime über `$liveMap`
  schließen, sonst Fehler 4023 „cannot delete an active session“) — sowie
  IPC-Doors (`openSessionInTerminal`, `writeClipboard`). Der
  **Neue-Session-Button** liest `hermes.desktop.projectScope` (App-localStorage)
  + `projects.list` und erstellt per `session.create` (Params wie die App:
  cols/source/cwd/cwd_explicit/profile). **Grid-Spalten** (`tabs.gridCols`)
  laufen über `--sf-grid-cols` (Zahl oder `auto-fill`) + `--sf-grid-min`
  (0 bei fester Zahl). **Info-Dichte** (`tabs.infoDensity`) bildet Hermes'
  `sessionListDensity` ab — `auto` folgt live über
  `host.settings.subscribe('sessionListDensity', …)` (Feature-Detect; Fallback
  bleibt `compact`). Stufen (Liste und Grid): Komfortabel vergrößert den Titel
  (13 px), öffnet den Abstand zwischen Titel und Subtext (4 px) und füllt die
  Detail-Zeile (`.sf-tab-details`: Modell · Nachrichten · „zuletzt aktiv“ —
  Modell und Recency kommen für laufende Sessions aus `session.active_list`,
  s. `$liveMap`); Detailreich ergänzt die Vorschau-Zeile (`.sf-tab-preview`)
  und — solange der Kontext-Donut aus ist — die Stats-Zeile mit der
  Kontext-Auslastung (`.sf-tab-stats`; dafür läuft der Kontext-Fetch auch
  ohne `showContext`, Gate: `contextInfoNeeded()`). Detail- und Vorschau-Zeile
  laufen in Detailreich zweizeilig (`-webkit-line-clamp:2`, Grid eingeschlossen).
  In der Liste rendert **Komfortabel einspaltig**: Meta-Infos (Quelle · Zähler ·
  Zeit · Kontext) sitzen als letzte Zeile im Textblock (`.sf-tab-meta-inline`),
  nicht mehr als rechte Spalte; Detailreich behält die Spalten.
  **Datenlage**:
  `session.list` liefert derzeit nur id/title/preview/started_at/
  message_count/source — `git_branch`, `model` und `tool_call_count` erreichen
  das Plugin nicht; Branch und Tool-Zähler erscheinen in der Detail-Zeile
  daher nur, falls das Gateway sie künftig mitliefert.
  **Wichtig**: Plugin-i18n interpoliert Funktions-Keys per
  Args — `t('metaMessages', n)` (NICHT `t('key')(n)`; letzteres warf die Pane
  in den Error-Boundary). **Row-Design** (`tabs.rowGrad*`, `rowShadow`, `titleGrad*`,
  `sel*`, `rowLive`) läuft ebenfalls rein deklarativ über `applyRows()` →
  Attribute/Variablen auf `<html>`; `TabRow` setzt `data-live`
  (`busy`/`waiting`/`idle`) aus `activityFor`, das CSS reagiert per
  `[data-sf-seltint~=…]`-Tönung, `outline`-Kontur, `[data-live=…]`-Glow und
  `sf-live-pulse` (respektiert `prefers-reduced-motion` +
  `[data-renderer-animations-paused]`). **Kontextfenster** (`tabs.showContext`):
  `refreshContextInfo()` fragt für jede LIVE-Session `session.context_breakdown`
  ab — **immer über die Runtime-ID** (Key der Live-Map; die Stored-ID lehnt das
  Gateway ab), Ergebnis wird unter der Stored-ID in `$ctxInfo` abgelegt und als
  `.sf-tab-ctx`-Chip gerendert. Läuft nur bei aktiver Option, gedrosselt über
  den regulären Refresh-Zyklus, max. 10 Sessions. **Max. sichtbare Einträge**
  (`tabs.maxVisible`, v1.11): `SessionsPane` slict je Gruppe auf N Einträge
  (`showAllSections`-Set merkt sich aufgeklappte Gruppen; der Button
  `.sf-showmore` toggelt, im Grid per `grid-column:1/-1` über die volle
  Breite) — rein client-seitig, es wird nichts nachgeladen.
- **Close-Button-Fix (v1.7)**: deckender Kontrast-Chip
  (`color-mix(foreground 9%, dt-card)`) statt gestapelter Transparenzen +
  Hover-Label-Mask für ALLE Tab-Varianten (die App maskiert nur
  `[data-slot='pane-tab']` — die gewrappten Session-Tabs blieben sonst
  unmaskiert und der Text lief unter dem ✕ durch).

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
- **Niemals Backticks im CSS-Template** — auch nicht als Markdown-Zitat in einem
  CSS-Kommentar: der Backtick beendet das Template-Literal. Symptom im Log:
  `SyntaxError: Invalid left-hand side expression in postfix operation`
  (die Zeilenangabe zeigt auf den Template-Start, nicht auf den Backtick).
  Vor jedem Save `npm run check` laufen lassen.
- **Icon-Komponente der App:** `Codicon` erwartet `name` OHNE Marker plus den
  `spinning`-Prop. Ein Name wie `sync~spin` erzeugt die unbekannte Klasse
  `codicon-sync~spin` → Icon rendert 0×0 (unsichtbar). Immer `SfIcon` benutzen:
  trennt den Marker ab, setzt den Prop und zusätzlich die Fallback-Klasse
  `sf-icon-spin` (dreht auch mit SDK-Builds ohne den Prop).
- **Anker für pane-weite Regeln:** `[data-chat-surface]` (Chat-Surface, hat
  `isolate`) und `[data-tree-group]` (Zone). `[data-pane-host]` existiert NUR
  für Keep-Alive-Panes — Regeln dort wirken im normalen Chat gar nicht.
- **Temporäre Debug-Ausgaben** (`console.error`) vor dem Commit entfernen und
  `git commit --amend` nie in derselben Runde wie einen Marker-Save ausführen
  (Tool-Reihenfolge nicht garantiert) — danach mit
  `git show HEAD:full/plugin.js | grep -c <marker>` prüfen.

## Render-Smoketest (`npm test`)

`tests/render-test.mjs` lädt die echte Plugin-Datei (`full/plugin.js` bzw.
`desktop/plugin.js`), ersetzt die drei
Import-Module (`@hermes/plugin-sdk`, `react`, `react/jsx-runtime`) durch Stubs
und rendert `SessionsPane` **und** `SettingsPage` komplett (rekursiver Walk —
Funktions-Komponenten werden tatsächlich aufgerufen). Läuft in Sekunden, nur
Node, keine App nötig — ideal als Vorflug und in der CI:

- **Pane**: 30 Fake-Sessions; Listen-Begrenzung (`tabs.maxVisible`) inkl.
  „Mehr anzeigen (n)“/„Weniger anzeigen“-Toggle, Grenzfälle (Limit = Anzahl,
  > Anzahl) und Render-Stabilität über mehrere Renders.
- **Einstellungen**: komplette Seite rendert; neue Optionszeilen müssen im
  Baum auftauchen.

Trick für echte Interaktionen: `useState` ist im Stub **slot-basiert**
(Map + `__resetSlots()` pro Render) — ein per Walk eingesammelter
`props.onClick()` wirkt damit im nächsten Render, Klicks sind echt simulierbar.
Bei neuen interaktiven UI-Teilen einfach Assertions ergänzen.

## Computed-Style-Test (`npm run test:style`, optional)

`tests/style-test.mjs` extrahiert die echte CSS aus dem jeweiligen Build
(`full/plugin.js`) und lädt sie in
eine minimale Test-Seite (`.sf-items[data-view=list|grid]`); geprüft werden die
**berechneten Styles am echten Chromium** — genau das, was der Render-Smoketest
nicht sieht:

- Liste-vs-Grid-**Parität** für Verlauf, Schatten, Titel-Verlauf, Auswahl-Zustand,
- Auswahl-Tönung als Layer über dem Zeilen-Verlauf, Hover-Stufen (`tabs.selHover`),
- Alpha in Verläufen (`#RRGGBBAA`), Live-Status, „Design aus"-Zustand.

Braucht Playwright + Chromium (z. B. aus einem Hermes-Desktop-Checkout) — ohne
Playwright endet der Test mit SKIP (Exit 0, CI-sicher). Bibliothek vorgeben:
`PLAYWRIGHT_PKG=<…/node_modules/playwright> npm run test:style`.
Screenshot zur Sichtprüfung: `SF_STYLE_SHOTS=<ordner> npm run test:style`.

> Faustregel: Änderungen am Design-CSS (`.sf-tab`-Flächen, Verläufe, Auswahl,
> Grid-Overrides) immer mit dem Style-Test absichern — Spezifitäts-Fallen
> (`:where()`-Overrides, Layer-Reihenfolge) sieht man nur in berechneten Styles.
>
> Achtung Transitions: `.sf-tab` transitioniert `transform`/`box-shadow`/
> `background-color` (130 ms). `getComputedStyle` liefert direkt nach einem
> Zustandswechsel den **Startwert** der laufenden Transition — der Test wartet
> deshalb mit `settle()` (220 ms) vor jeder Messung. Ohne dieses Warten „kleben"
> alte Werte und man jagt Phantom-Bugs in der CSS.

## Troubleshooting

| Symptom | Ursache / Fix |
|---|---|
| Toast „Plugin session-flow failed to load" | Syntaxfehler im letzten Save → `npm run check`, dann speichern |
| Plugin taucht nicht auf | Ordnername ≠ `session-flow`? Datei unter `~/.hermes/desktop-plugins/session-flow/plugin.js`? ⌘K → Reload |
| Hot-Reload belegen (Erfolg ist still) | Temporär `console.error(...)` in `register()` setzen + speichern → erscheint als `[renderer console:main] [session-flow] …` in `~/.hermes/logs/desktop.log` (nur Fehler-Level wird geloggt). Alternativ: `_meta`-Stempel im Plugin-Storage (`hermes.plugin.session-flow._meta`) — nach ~1 min im leveldb sichtbar: `strings *.ldb *.log \| grep hermes.plugin` |
| Auto-Reload stoppt nach Ordner-Tausch | Ein Wechsel Kopie ⇄ Symlink (bzw. Ordner-Ersetzen) lässt die alte File-Watch verwaisen — der Ordner-Reconcile bindet Watches für bekannte Einträge nicht neu. Einmal ⌘K → „Reload desktop plugins" (oder App-Neustart), danach reloaded Speichern wieder automatisch. |
| Glass-Effekt fehlt | `glass.enabled`? Bereichs-Toggles? System-„Transparenz reduzieren" aktiv (Blur wird dann global genullt)? Modell-Pill gibt es nur im Primär-Chat |
| Animation passiert nichts | `prefers-reduced-motion` aktiv? Animation in den Einstellungen aus? Nur Assistant-Nachrichten werden animiert |
| Strg+Scroll reagiert nicht | Fokus in Zoom-Fläche (Bild/Editor)? Andere App-Sektion? `wheel.enabled`? |
| Status-Icon/Indikator unsichtbar | Icon-Name enthält `~spin` → unbekannte Klasse, Icon 0×0. Prüfen: `el.firstElementChild.getBoundingClientRect()` muss ~13–14 px sein, `innerHTML` zeigt die Klassen wörtlich. Fix: über `SfIcon` rendern. |
| Design-Regel wirkt im Chat nicht | Selektor zielt auf `[data-pane-host]` (nur Keep-Alive-Panes). Chat: `[data-chat-surface]`, Zonen: `[data-tree-group]`. |
| Rahmen: „duplicate id" | Zweite Kopie unter anderem Ordner mit gleicher id (z.B. Unified-Package) — nur eine Installation behalten |

## Roadmap-Ideen

- Multi-Profil-Ansicht (profiles.list + per-Profil-Fetch).
- Freies Umsortieren von Gruppen und Tabs; Ordnen per DnD innerhalb der Liste.
- Pro-Gruppe eigene Theme-Akzente via `setAccentOverride`.
- Animation-Presets pro Elementtyp (Headings anders als Code etc.).
