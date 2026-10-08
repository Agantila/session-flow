# Marketplace-Compliance: Catalog-Regel 8, plugin.yaml, Disclosure — Aufnahme in den Hermes Plugin Catalog

- **Status**: Umgesetzt (Verifikation siehe unten; Submission-Schritte Phase 5
  offen — SHA-Pin + PR + #116305-Kommentar erfolgen nach dem Commit)
- **Erstellt**: 2026-10-08
- **Abgeschlossen**: 2026-10-08
- **Betrifft**: plugin.js (alle DOM-/CSS-/Bridge-Bereiche), neu: plugin.yaml, neu: scripts/build-catalog.mjs, install.sh, tests/*, marketplace.json, plugin-catalog/session-flow.yaml, docs/PLUGIN-CATALOG-PR.md, README/README.de, CHANGELOG.md, docs/APP-INTEGRATION.md, docs/DEVELOPMENT.md, AGENTS.md
- **Version**: geplant 1.29.0

## Anforderung

Original-Anfrage (2026-10-08, wörtlich):

> Ich brauche deine Hilfe, um mein Repository passend für die Hermes Marketplace
> für die Plugins zu fixen und das Problem zu lösen, was hier vor dem
> Merge-Request zurückkam. Dort wird beschrieben, was ich machen muss, damit das
> Repository als Plugin in den Marketplace angenommen wird. Bitte recherchiere
> auch nochmal genau, was sich als Repository berücksichtigen muss, um im
> Marketplace von Hermes Plugins aufgenommen zu werden von Nous Research.
> Wichtig ist, dass du info@agantila.com die E Mail mit referenzierst.
> Prüft bitte die folgende Beschreibung auf unser Repository und erstellt einen
> Plan für den vollständigen Fix der genannten Probleme, damit wir es committen
> und deployen können und den Pull Request machen können. Sollte das unsere
> Funktionen brechen, bitte ich dich um eine Alternativplanung, sodass wir die
> Funktionen und die Features in der UX beibehalten und das Problem technisch
> besser lösen.

Ablehnungs-Kommentar (teknium1, NousResearch/hermes-agent#134760, wörtlich):

> Thanks @Agantila for the submission. We reviewed session-flow at 6eebf540 and
> can't list it as it stands: catalog rule 8 doesn't allow Desktop plugins to
> read or modify the app's own UI, because several plugins doing that break each
> other and the app. Our desktop-surface check finds it querying app markup and
> observing document.body, injecting into the core composer, and
> restyling/hiding core elements with CSS.
>
> If you want to come back:
> (1) add a plugin.yaml at the repo root (name: session-flow, version: 1.28.1,
> requires_hermes); (2) remove every app-markup query, document.body observer,
> composer injection and core-element CSS override (plugin.js:1301, 2658-2732,
> 6460-6570, 6686, 7249-7330, 9566) and ask for SDK slots (composer accessory,
> tab decoration, message-render hook) instead; (3) use SDK calls instead of
> window.hermesDesktop.*; (4) make the description's disclosure match the code:
> it claims a localStorage write the code never makes, and omits the projects.*
> writes, session.title/session.branch_stored, and the /api/cron/jobs and
> kanban board reads.
>
> For the composer chip and tab decorations, tell us which SDK slot you need on
> #116305 and we'll build it.

## Kontext

**Recherche-Stand (2026-10-08, offizielle Quellen):**

- Katalog-Regeln: `plugin-catalog/README.md` in NousResearch/hermes-agent,
  gespiegelt auf
  <https://hermes-agent.nousresearch.com/docs/developer-guide/plugins/catalog-submission>.
- **Regel 8** (der knackende Punkt): Ein gelistetes `plugin.js` darf nur das
  Plugin-SDK nutzen — kein Prototyping-Patching, kein `eval`/`new Function`,
  kein `import()` außer `@hermes/plugin-sdk`/`react`, kein Script-Tag-Injection,
  ** kein Zugriff auf interne Stores oder das eigene Markup der App** („querying
  `data-slot` / `data-tour` / `data-sidebar` / `data-testid` elements from
  `document`, or a `document.body` MutationObserver, to restyle, hide, click or
  rewrite core UI"). Der `desktop surface`-Check in `hermes plugins validate`
  lehnt das bei Admission ab. Fehlende SDK-Fähigkeit ⇒ **SDK-Hook anfragen**
  statt patchen („we would rather add the seam than list a patch").
- **Regel 13** (Disclosure): Was der Nutzer wissen will, steht im PR-Beschreibung
  und README — u. a. „reads outside the plugin's own data". Verhalten, das im
  Review gefunden wird, aber nicht disclosed war ⇒ „request for changes".
- **Regel 14**: `requires_hermes` ist SemVer-Floor; `version` muss zum gepinnten
  Code passen.
- Submission-Form: ein PR, der `plugin-catalog/<name>.yaml` in hermes-agent
  hinzufügt; exakter 40-Hex-SHA-Pin; kein Self-Update; CI läuft
  `hermes plugins validate --install-deps` am Pin.
- PR #115579: der `desktop surface`-Check ist ein regex-Tripwire über die
  Plugin-JS-Dateien; Issue #107262 + Abschlusskommentar: Standalone-Desktop-
  Plugins sind erste Klasse — Katalog-CI validiert „either a `plugin.yaml` or a
  portable `plugin.json` at the entry's subdir"; bei uns: Repo-Root.
- **Präzedenzfall für den Feature-Erhalt**: `pinned-folders` (im Katalog)
  schiffT **zwei Builds aus einem Quellcode**: Catalog-Build (`desktop/plugin.js`,
  SDK-only) und Full-Build (`full/plugin.js`) — `node scripts/build.mjs`
  löscht `// #full` … `// #end`-Blöcke. Der Catalog-Build degradiert Features
  ohne SDK-Door sauber (Menüeintrag mit „update Desktop"-Hinweis statt tot).
  Genau dieses Modell übernehmen wir.

**Befund am Repo (verifiziert, Stand `c2fc8ff`, plugin.js v1.28.1):**

Alle vom Review genannten Stellen existieren; der Review hat NICHT alles
gefunden. Vollständiges Inventar der Regel-8-Verletzungen:

| # | Stelle(n) | Was | Feature |
|---|---|---|---|
| 1 | plugin.js:1301 (+1307) | `querySelector("[data-slot='composer-surface']")` + Radius-Messung | Glass Glow-Ring |
| 2 | plugin.js:2658–2732, 2646–2740, 12914–12915 | Composer-Root-Query + Chip-`insertBefore` in den nativen Composer (`.codicon-add`-Anker) | Composer-Projekt-Chip |
| 3 | plugin.js:6460–6497 | CSS-Override `[data-slot='composer-root'/'composer-surface']`, Fill-Layer `[class~='-z-10']` | Glass Composer |
| 4 | plugin.js:6500–6527 | CSS-Override `[data-tour='model-pill']`, `[data-testid='reasoning-pill']` | Glass Chips |
| 5 | plugin.js:6530–6559 | CSS-Override `[data-slot='statusbar'] button/a` | Glass Statusleiste |
| 6 | plugin.js:6572–6679 | CSS-Override `[role='tab']`, `.pane-tab-content`, Close-Wrapper (UI-Tabs-Look) | UI-Tabs |
| 7 | plugin.js:6686 | `html[data-sf-hide-tabstrip] div:has(> [role='tablist'] [data-tree-tab^='session-tile:']){display:none}` — **versteckt Kern-UI** | „Liste/Grid als Tab-Selektor" |
| 8 | plugin.js:7249–7330 | 2× `MutationObserver` auf `document.body` (childList/characterData + Attribute) | Chat-Animation |
| 9 | plugin.js:9566, 9570 | `querySelector('[data-tour^="sidebar-nav-kanban"]')`, `.kanban-drawer-content` | Kanban-Feature-Detect |
| 10 | plugin.js:910–921 | Observer auf `documentElement` **und `document.body`** (Theme-Attribute) | watchAppTheme |
| 11 | plugin.js:2938–3009 | Observer am App-Markup `[data-sessions-mode]` (Sidebar-Sync) | watchSidebarSync |
| 12 | plugin.js:611, 1117–1163 | `.sf-bg-layer` wird in `[data-chat-surface]` / `[data-tree-group]` **injiziert** | Persönlicher Hintergrund |
| 13 | plugin.js:1377, 1507, 1517, 7180, 7235, 7342, 7361 | `querySelectorAll('[role=tab]')`, `[data-tree-tab^='session-tile:']`, `[data-chat-surface]`, `.aui-md` / `[data-slot="aui_assistant-message-content"]` (6960) | UI-Tab-Busy-Markierung, Chat-Scan |
| 14 | plugin.js:1226–1258, 8591–8597, 8762–8765, 1867–1913, 3514–3521, 3597–3606, 3172–3179 | `window.hermesDesktop.selectPaths / openSessionInTerminal / writeClipboard / api (REST) / revealPath` | Datei-Picker, Terminal, Clipboard, REST-Mirror, Dateimanager |
| 15 | plugin.js:2143, 3246 | **Read** von `localStorage['hermes.desktop.projectScope']` (App-interner Atom-Backing-Key) | Chip-/Projekt-Scope-Fallback |

**Disclosure-Fehler (Regel 13, Punkt 4 des Reviews):**

- `plugin-catalog/session-flow.yaml` (Zeilen 14–19) behauptet ein **Write** von
  `hermes.desktop.projectScope` — der Code schreibt den Key **nie**, er liest
  ihn nur (Zeilen 2143, 3246). Gleiche falsche Behauptung in
  `docs/PLUGIN-CATALOG-PR.md` (Zeilen 61–64, 98) und implizit im Changelog
  v1.21.0.
- Nicht disclosed: **Writes** `projects.create`, `projects.update`,
  `projects.add_folder`, `projects.remove_folder`, `projects.set_primary`,
  `projects.set_active`, `projects.delete` (Zeilen 3120–3164),
  `session.title` (8617), `session.branch_stored` (8642), `session.archive`
  (8726/8736), `session.close` (8750), `session.delete` (8756); **Reads**
  `/api/cron/jobs` + `/api/plugins/kanban/board` (9530/9531),
  `/api/getFolderSize` (3878).

**E-Mail-Anforderung:** `info@agantila.com` ist als Kontakt überall zu
referenzieren (marketplace.json trägt aktuell `deniz@agantila.com`, das
Catalog-YAML gar keine Adresse).

## Scope

1. **plugin.yaml** am Repo-Root (Punkt 1 des Reviews) mit `name: session-flow`,
   `version: "1.29.0"` (Review nannte 1.28.1 = damaliger Pin; der neue Pin
   trägt die neue Version — Regel 14: version ≙ Code), `requires_hermes:
   ">=0.21.5"` (SemVer-Floor, konsistent mit plugin-catalog/session-flow.yaml),
   `license: MIT`, Disclosure-konforme `description`, Kontakt
   `info@agantila.com`, Desktop-Einstiegspunkt deklariert (Root-`plugin.js`,
   Standalone-Desktop-Vertrag nach #107262).
2. **Regel-8-Bereinigung des Catalog-Builds** (Punkt 2): Root-`plugin.js` wird
   der SDK-only Catalog-Build (Zweibuild-Modell nach pinned-folders-Präzedenz).
   Kein Feature stirbt: der Full-Build bleibt Quelle der Wahrheit und wird
   weiter über `install.sh` (Standalone, Symlink/Copy) verteilt.
3. **SDK statt window.hermesDesktop** (Punkt 3): im Catalog-Build ersatzlos
   entfernen bzw. über Web-Standard/SDK ersetzen; SDK-Doors auf #116305
   anfragen (Text liegt diesem Plan bei).
4. **Disclosure-Reparatur** (Punkt 4): localStorage-Read entfernen (technisch
   besser: App-internen Key gar nicht mehr anfassen, s. u.), volle
   RPC/REST-Liste disclose in plugin.yaml, plugin-catalog/session-flow.yaml,
   docs/PLUGIN-CATALOG-PR.md, README-Abschnitt „What the plugin reads/writes".
5. **Kontakt `info@agantila.com`** in marketplace.json (`author.contact`),
   plugin-catalog/session-flow.yaml (`maintainer`/Kontakt),
   docs/PLUGIN-CATALOG-PR.md, README + README.de (Kontakt/PR-Abschnitt),
   plugin.yaml.
6. **Guard gegen Regression**: neuer Test `tests/surface-test.mjs`, der den
   Catalog-Build auf die Tripwire-Muster prüft (`document.querySelector`/`All`
   auf `data-slot|data-tour|data-sidebar|data-testid`, Observer auf
   `document.body`, `window.hermesDesktop`, `insertBefore` in Composer-Anker,
   CSS-Override-Selektoren) und bei Treffern rot schlägt — Spiegelbild des
   Katalog-CI-Checks, damit so etwas nie wieder einzieht.
7. Dokumentation: APP-INTEGRATION.md wird zweigeteilt (Catalog-Build = SDK-only;
   Full-Build = Bestandsanker mit Risiko-Notizen), ROADMAP, SETTINGS
   (Catalog-Build-Defaults), DEVELOPMENT.md/AGENTS.md (Zweibuild-Workflow,
   Re-Link-Hinweis für die lokale Maschine), CHANGELOG.

## Nicht-Scope (bewusst ausgeklammert)

- **Keine Feature-Entwicklung** — ausschließlich Compliance-Umbau; neue
  Funktionen (z. B. SDK-Slot-Migrationen) folgen nach Annahme der Doors.
- Kein Umbau der DnD-/Grid-/Gruppen-Logik (bereits rule-8-clean, eigene Pane).
- Keine Änderung an Gateway-Bootstrap-Gate (docs/plans/2026-10-05-…) außer wo
  der Sidebar-Observer entfernt wird.
- Kein eigener Update-Mechanismus (bleibt verboten, Regel 3 — install.sh ist
  Standalone-Verteilung, nicht Self-Update im Catalog-Build).
- Kein Wechsel des Repo-Namens/der IDs; `hermes://plugin/install?repo=…`
  Deep-Link bleibt.

## Umsetzung

### Architektur-Entscheidung: Zwei Builds, ein Quellcode (Plan B — empfohlen)

Der Review verlangt Bereinigung des gelisteten `plugin.js`. Ein strikter
Einzelsystem-Weg würde Glass, UI-Tabs, Chat-Animation, Composer-Chip und
Hintergrund-Personalisierung **löschen**. Stattdessen das Muster des bereits
gelisteten Plugins `pinned-folders`:

- **`full/plugin.js`** = heutige `plugin.js` (12.9k Zeilen), Quelle der
  Wahrheit. Kritische Regionen werden mit `// #full` … `// #end` markiert.
- **`scripts/build-catalog.mjs`** (neu, ~60 Zeilen, kein Transpiler — rein
  Block-Entfernung, damit das Repo-Gesetz „kein Build-Schritt/JSX" unangetastet
  bleibt; das Skript ist optional für die Catalog-Veröffentlichung):
  schreibt **Root-`plugin.js`** = Catalog-Build.
- **`plugin.yaml`** (Root) beschreibt genau diesen Standalone-Desktop-Package.
- **`install.sh`**: `--variant full` (Default, Copy) kopiert `full/plugin.js`;
  `--variant catalog` kopiert Root-`plugin.js`; `--link` symlinkt künftig
  `full/` als Plugin-Ordner (Hot-Reload-Dev auf dem Full-Build, wie heute —
  die App lädt `$dir/plugin.js`, und `full/` enthält genau das);
  `--link --variant catalog` symlinkt das Repo-Root.
- **Lokale Maschine**: einmalig `./install.sh --link` neu ausführen (Symlink
  zeigt danach auf `full/`) — nach Dokumentation in DEVELOPMENT.md/AGENTS.md.
- **Tests** laufen künftig gegen beide Builds: `npm test` (Root = Catalog) und
  `npm run test:full` (full/plugin.js); `check.mjs` analog parametrisiert;
  `test:style` primär gegen Full (Style-Features), plus Catalog-Rauchtest.
- Versionierung: beide Builds tragen dieselbe VERSION (1.29.0).

### Phase 1 — Markierungen + Catalog-Build erzeugen (Regel 8, Punkt 2)

`// #full`-Regionen im Quellcode (Zuordnung zum Inventar):

1. **Glass komplett** (Inventar 1, 3, 4, 5): CSS-Blöcke 6460–6559 +
   `measureComposerRadius()` (1290–1330) + deren Timer/Apply-Pfade.
   `#full` — im Catalog-Build existiert das Glass-Settings-Kapitel nicht
   (Settings-Sektion ebenfalls `#full`).
2. **UI-Tabs-Look + Tab-Selektor-Hide** (6, 7, 13-Tab-Marker): CSS 6572–6688,
   JS 1377, 1507–1530 (`data-sf-tab-busy`-Markierung über App-Tabs),
   `data-sf-hide-tabstrip`-Schalter. `#full`. Die **eigene** Pane
   (`tabs.asTabSelector`-Modus der Session-Flow-Pane selbst) bleibt im
   Catalog-Build; nur das Verstecken/Hübschen des NATIVEN Streifens wartet auf
   den Tab-Decoration-Slot.
3. **Chat-Animation** (8, 13-Chat-Scanner): 6960 (`ASSISTANT_CONTENT`),
   7000–7460 (Scan/Kaskade/Streaming), Observer 7249–7330. `#full` bis der
   Message-Render-Hook existiert.
4. **Composer-Chip** (2, 15): CPROJ-Sync (2640–2830), Menü, Cleanup
   (12914–12915). `#full` bis Composer-Accessory-Slot existiert. Der
   localStorage-Fallback im Scope-Resolver (2143, 3246) wird **auch im
   Full-Build ersetzt**: aktives Projekt kommt künftig nur noch aus dem
   plugin-eigenen `projects.set_active`-Stand + `projects.tree`/`active`
   -Auflösung — der App-interne localStorage-Key wird nicht mehr gelesen
   (Punkt 4, technisch sauberer: keine App-Internen mehr).
5. **Persönlicher Hintergrund + Content-Shell** (12): `syncPaneBackgrounds`
   (1097–1170), Cleanup 611, Content-Shell-CSS auf `[data-pane-host]`.
   `#full` bis ein Workspace-Background-/Theme-Door existiert.
6. **watchAppTheme** (10): Observer-Teil `#full`; Catalog-Build behält nur
   `matchMedia('(prefers-color-scheme)')` (reicht für eigene Pane-Farben).
7. **watchSidebarSync** (11): Observer `#full`; Catalog-Build nutzt die
   bestehenden Poll-Takt (~45 s) + `host.state`-Atom-Listener + Focus-Kick.
   Full-Build behält den Instant-Sync.
8. **Kanban-Detect** (9): **kein `#full`, sondern Neuschreib-Regel-8-clean**:
   Feature-Detect über den REST-Read selbst —
   `GET /api/plugins/kanban/board` erfolgreich ⇒ Kanban da; Fehler/404 ⇒
   Button entfällt. Damit fällt der DOM-Probe-Weg komplett weg (technisch
   besser: ein Signal weniger, kein Markup-Kopplung).
9. **App-Nav-Reihe / Status-Pips**: Cron-Pips bleiben (REST-Read, disclosed);
   Kanban-Pip folgt der neuen REST-Detect.

### Phase 2 — window.hermesDesktop ersetzen (Punkt 3)

Catalog-Build:

- `writeClipboard` → nur noch `navigator.clipboard.writeText` (Fallback gibt es
  schon, Zeile 8766 — wird zum Primärweg).
- `selectPaths` / `revealPath` / `openSessionInTerminal` /
  `bridge.api` (REST-Mirror) → im Catalog-Build **degradieren**, nicht
  simulieren: Menüpunkte ausgeblendet bzw. mit Hinweis-Toast (Muster
  pinned-folders: „Aktion benötigt neuere Desktop-/SDK-Version"); Settings-
  Hintergrundpfad per Text-`Input` (existiert) statt Picker.
- Full-Build: unverändert (Standalone darf die Desktop-Bridge nutzen; sauber
  disclose im README des Full-Builds).
- **Parallel SDK-Doors anfragen** (s. Follow-ups) und nach Annahme migrieren:
  dann wandeln die `#full`-Regionen sich in SDK-Pfade um und der Catalog-Build
  holt die Features nach.

### Phase 3 — plugin.yaml + Disclosure + Kontakt (Punkte 1 + 4)

- **`plugin.yaml`** (Root, Felder nach Review + Regel 14): `name: session-flow`,
  `version: "1.29.0"`, `requires_hermes: ">=0.21.5"`, `license: MIT`,
  `description:` (Disclosure-Kurzfassung), Kontakt `info@agantila.com`,
  Einstiegspunkt Root-`plugin.js` (Standalone-Desktop nach #107262).
- **plugin-catalog/session-flow.yaml** (unser Spiegel-Copy für den PR nach
  hermes-agent): neuer `sha` (40-hex des Fix-Commits), `version: "1.29.0"`,
  Disclosure-Text komplett neu:
  - streichen: localStorage-Write-Behauptung (falsch);
  - aufnehmen: `projects.create/update/add_folder/remove_folder/set_primary/
    set_active/delete`, `session.title`, `session.branch_stored`,
    `session.archive`, `session.close`, `session.delete`, REST-Reads
    `/api/sessions` (pinned), `/api/plugins/kanban/board`, `/api/cron/jobs`,
    `/api/getFolderSize` (Catalog-Build: nur `/api/sessions` + kanban/cron);
  - Full-Build-Zusatz disclose: Desktop-Bridge (`selectPaths`, `revealPath`,
    `openSessionInTerminal`, REST-Mirror), Background-Layer-Injektion in
    App-Panes — klar als „nur im Standalone-Full-Build, nicht im Catalog-Build"
    markiert.
- **docs/PLUGIN-CATALOG-PR.md**: PR-Beschreibung neu schreiben (Was-es-tut,
  Surfaces-Liste SDK-only, Capabilities-Block, Disclosure, Zwei-Build-Erklärung,
  Verifikationsbelege, Slot-Anfragen-Verweis #116305, Kontakt
  info@agantila.com).
- **marketplace.json**: `author.contact` → `info@agantila.com`; `version`
  1.29.0; `permissions`/Notes um Zwei-Build-Modell ergänzen;
  `platform.minVersion` mit `requires_hermes` abgleichen (aktuell 0.5.0 vs.
  0.21.5 — echten Floor verifizieren und konsistent setzen).
- **README/README.de**: Abschnitt „Catalog vs. Full build" (Tabelle: Feature ⇄
  Build), Kontakt `info@agantila.com`, Disclosure-Abschnitt korrigieren.
- **CHANGELOG.md**: 1.29.0-Eintrag (Compliance-Release, Feature-Matrix).

### Phase 4 — Guards + Tests

- **`tests/surface-test.mjs`** (neu): scannt Root-`plugin.js` auf
  Verbots-Muster (Liste wie Katalog-CI: `querySelector(All)` mit
  `data-slot|data-tour|data-sidebar|data-testid`, `document.body`-Observer,
  `window.hermesDesktop`, `insertBefore` in Fremd-Roots,
  CSS-Override-Selektoren `[data-slot=`/`[data-tour=`/`[data-testid=`,
  `eval(`/`new Function`/verbotene `import()`). Läuft in `npm run check` ein.
- render-test/style-test: parametrisiert auf beide Builds (siehe Umsetzung);
  Fixtures für entfernte Features im Catalog-Build-Skip markieren.
- `scripts/build-catalog.mjs` Selbsttest: Output enthält keine `#full`-Marker,
  Byte-Größe plausibel kleiner, Parse-Check (`new Function`-freier Syntaxcheck
  via `node --check`).

### Phase 5 — Submission

1. Lokal: `npm run check && npm test && npm run test:full && npm run
   test:style` grün; `node scripts/build-catalog.mjs`; auf dem Linux-App-Rechner
   `hermes plugins validate . --install-deps` (erwartet: `desktop surface` +
   `no core override` + Security-Scan grün).
2. Commit (Repo-Regeln: `git -c user.name="Deniz" -c
   user.email="dezooyi@users.noreply.github.com" commit`), Push, dann PR in
   **NousResearch/hermes-agent** mit dem einen File
   `plugin-catalog/session-flow.yaml` (neuer Pin) — Beschreibung aus
   docs/PLUGIN-CATALOG-PR.md; **Kontakt info@agantila.com** in der
   PR-Beschreibung.
3. Parallel: Kommentar auf **#116305** mit den Slot-Anfragen (Liste unten).
4. Full-Build weiter wie bisher über Repo/install.sh verteilen; Deep-Link
   bleibt.

### SDK-Slot-Anfragen für #116305 (Formulierung liegt bei Umsetzung bei)

1. **Composer-Accessory-Slot** — eigene React-Node neben den Composer-Controls
   (für den Projekt-Chip; heute `insertBefore` in `[data-slot='composer-root']`).
2. **Tab-Decoration-Slot** — Badge/Klassen pro Content-Tab + optionaler
   „Tab-Strip ersetzen/verstecken"-Schalter (UI-Tabs-Look + `asTabSelector`).
3. **Message-Render-Hook** — Callback/Wrapper pro gerendertem Assistant-
   Markdown-Block (Chat-Animation ohne `document.body`-Observer).
4. **Theme-Door** — Theme-Wechsel-Event + gestattete Token-Overrides
   (`--ui-accent`), ggf. Workspace-Background-Slot (Personalisierung).
5. **Gateway-Änderungs-Events** — `session.changed` / `projects.changed` (statt
   Sidebar-DOM-Observer).
6. **REST-Mirror-Lese-Door** — offizieller SDK-Weg für `GET /api/sessions` u. a.
   (pinned state ist nicht via RPC verfügbar — Datenlagen-Falle).
7. **Doors für Datei-Picker / revealPath / openSessionInTerminal**.

## Verifikation

Ausgeführt am 2026-10-08 (Windows-Dev-Maschine, Node v26.7.0), beide Builds:

- [x] `node scripts/build-catalog.mjs` → „Catalog-Build geschrieben:
      plugin.js (401.1 KB, 10008 Zeilen, 3030 Full-only-Zeilen entfernt)“;
      der Build-Script verifiziert Balance der Marker + `node --check` des
      Outputs vor dem Schreiben und bricht bei `window.hermesDesktop`-
      Resten ab (Guard scharf getestet — fing zwei survivede Kommentare).
- [x] `npm run check` grün: Syntax ok (ESM) für beide Builds, i18n EN/DE
      komplett (Full: 519 Keys, Catalog: 368 benutzte Keys), Hook-Reihenfolge
      sauber in beiden, **Surface-Check ok** (Catalog-Build frei von
      App-Markup-Zugriff, Desktop-Bridge-Doors, Core-CSS-Overrides,
      Prototype-Patching). Guard-Negativtest: der Surface-Check fing die
      verbliebenen Kommentar-Nennungen (`window.hermesDesktop`,
      `.codicon-add` im CSS-Kommentar) und schlug rot, bis die Texte
      umformuliert bzw. die Chip-CSS ins `#full` verschoben waren.
- [x] `npm test` (= render-test full + render-test catalog): **BEIDE Builds
      „RENDER-SMOKETEST BESTANDEN“**. Full-only-Testsektionen laufen im
      Catalog-Lauf als `skipFullOnly(...)` (3 Sektionen: Chat-Hintergrund-
      Layer, Composer-Chip-Adopt v1.23.0, Chip-Pick-Verbrauch v1.24.1 B/E).
      Die v1.20-Kanban-Tests wurden auf die neue REST-Detect
      (`$navStatus.kanbanOk`) umgeschrieben und laufen in BEIDEN Builds;
      der v1.24.1-Pinned-Filter-Test setzt `$restMirror` für den Lauf.
- [x] Reparaturen dabei (Regression-Fänge durch Doppel-Build-Tests):
      `applyGroupsDensity`/`clearGroupsDensity` aus dem UI-Tabs-Strip
      gerettet (Gruppen-Feature!), `ownCreateUntil`/`adoptPrevStored` in
      geteilten Scope verschoben (sonst ReferenceError in
      `startNewSessionInCwd` im Catalog-Build), `applyAllSettings` build-
      abhängig (sonst Crash beim Settings-Save im Catalog-Build),
      Projekt-Dialog bekommt Manuelleingabe für Ordner im Catalog-Build.
- [x] `node --check` auf `full/plugin.js`, `plugin.js` und allen geänderten
      Skripten grün.
- [x] Disclosure-Abgleich per grep: Catalog-Build enthält **keine** Treffer
      für `window.hermesDesktop`, `hermes.desktop.projectScope`,
      `data-tour`, `data-testid`; `data-slot` nur noch im disclosed
      `BUILTIN_IGNORE`-String (Event-Target-`closest`, kein document-Query)
      — im Quellcode mit Regel-8-Einordnung kommentiert.
- [ ] `hermes plugins validate . --install-deps` am neuen Pin — **manuell
      auf dem Linux-App-Rechner** auszuführen (Hermes-CLI steht hier nicht
      zur Verfügung); erwartet grün, da die Muster identisch mit dem
      lokal geprüften Stand sind.
- [ ] Live-Check im laufenden Hermes-Desktop (Full-Build via
      `./install.sh --link` neu setzen — der Symlink zeigt jetzt auf
      `full/`): Chip, Glass, UI-Tabs, Animation, Hintergrund, Sidebar-Sync.

### Follow-ups (Submission)

1. Commit + Push (Repo-Regeln: Git-Identity Deniz; BEIDE Builds + plugin.yaml
   committen).
2. `plugin-catalog/session-flow.yaml` + `docs/PLUGIN-CATALOG-PR.md`:
   `PIN_SHA_HERE` → den neuen 40-hex-Commit einsetzen (YAML + Bild-URLs).
3. PR in NousResearch/hermes-agent mit nur dieser einen Datei; Beschreibung
   aus docs/PLUGIN-CATALOG-PR.md; Kontakt info@agantila.com.
4. Parallel Slot-Anfragen-Kommentar auf #116305 (Liste steht in diesem Plan).

## Follow-ups

- Nach Door-Annahme auf #116305: `#full`-Regionen schrittweise durch SDK-Pfade
  ersetzen, Catalog-Build feature-paritieren (jeweils eigener Mini-Plan +
  SHA-Bump-PR).
- ROADMAP-Eintrag „Catalog-Build-Parität nach SDK-Doors".
- SOUND/Extras: keine — bewusst minimal halten, um Review-Oberfläche klein zu
  halten.
