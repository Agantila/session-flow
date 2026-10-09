# Marketplace-Review R2: desktop/-Layout, keine synthetischen Events, Disclosure-Truth

- **Status**: Done (Repo-Seite; Push/Re-Pin/PR-Kommentar folgen als Auslieferungs-Schritte)
- **Erstellt**: 2026-10-09
- **Abgeschlossen**: 2026-10-09
- **Betrifft**: `plugin.js` → `desktop/plugin.js` (Layout), `full/plugin.js` (Quelle: `kickAppRefresh`, Composer-Pill-Toggle, `VERSION`), `plugin-catalog/session-flow.yaml`, `plugin.yaml`, `install.sh`, `scripts/build-catalog.mjs`, `scripts/check.mjs`, `tests/*` (Pfade + Tripwire), README/README.de, `marketplace.json`, `package.json`, AGENTS.md, docs
- **Version**: 1.29.0 → **1.29.1** (erreicht)

## Anforderung

Review von @teknium1 (2026-10-09) zur Resubmission des Catalog-PRs (geprüft
bei `6d6fbfa7`). Drei der vier alten Ablehnungsgründe aus #134760 sind laut
Review gefixt; Disclosure weiterhin nur „PARTIAL". Verbatim aus dem Review
— „Still needed before it can list":

> 1. plugin.js (repo root): move the catalog build to desktop/plugin.js. Keep
>    plugin.yaml at the root and full/ outside desktop/, and update
>    scripts/build-catalog.mjs:22 and install.sh to match. That's the
>    documented layout, it makes hermes plugins validate pass, and it stops
>    the installer from copying full/plugin.js, install.sh and the multi-MB
>    docs/marketing/ into the Desktop plugins folder.
> 2. plugin.js:1325-1337: drop kickAppRefresh()'s synthetic window focus and
>    document visibilitychange events. They trigger every focus/visibility
>    listener in the app and in other plugins without the user doing
>    anything. If you need a refresh signal after mutations, ask for an SDK
>    invalidate hook on #116305.
> 3. Catalog YAML description: make it match the catalog build.
>    - Drop "Smooth line-by-line chat animation" (your own README.md:128
>      lists it as absent).
>    - Drop the GET /api/sessions, /api/plugins/kanban/board and
>      /api/cron/jobs reads. They're stubbed out at plugin.js:2119-2125,
>      7305-7311, 1310-1314.
>    - Remove session.workspace.move, which only appears in comments.
>    - Say settings live in the app's local plugin storage, not
>      ~/.hermes/cache/....
>    - Strip the comment block at the top and the inline comment on the
>      sha: line.
> 4. plugin.js:8988-8993: hide the "Project pill in composer" toggle in the
>    catalog build. It does nothing there.
>
> At merge we'll add this disclosure line (no action needed): […fullständige
> Zeile im Review; unsre Beschreibung muss dazu konsistent sein…]
>
> Push the fixes, re-pin sha: here and comment when it's in; we'll re-review
> that commit.

## Kontext

- Resubmission nach #134760; Review-Runde 2 auf Stand `6d6fbfa` (v1.29.0,
  Pin-Commit `503efe9`). Gefixt laut Review: plugin.yaml, Rule-8-Surface,
  keine `window.hermesDesktop`-Zugriffe.
- Verifizierte Ist-Lage (dieser Checkout, Clean Tree bei `503efe9`):
  - `kickAppRefresh()` (Quelle `full/plugin.js:1988-2000`) steht **außerhalb**
    jeder Build-Region → landet mit synthetischem `focus` +
    `visibilitychange` im Catalog-Build; Aufrufstellen dort:
    `afterProjectMutation` (`plugin.js:1690`) und `restoreSessionRow`
    (`plugin.js:6490`).
  - Alle drei REST-Lesetüren sind im Catalog-Build bereits ehrlich gestubbt
    (`#catalog-only`-No-Ops): Pinned `plugin.js:2119-2125`, Nav-Status
    `7305-7311`, Archiv `1310-1314`. Die YAML-Beschreibung behauptet sie
    trotzdem — das ist der Disclosure-Mismatch.
  - `session.workspace.move` kommt im Catalog-Build **nur in Kommentaren**
    vor (`plugin.js:1428`, `1952`); der echte Aufruf
    (`full/plugin.js:2301`) liegt in einer `#full`-Region.
  - Einstellungen laufen in beiden Builds über `ctx.storage`
    (`full/plugin.js:12806`) → „app's local plugin storage", nicht
    `~/.hermes/cache/...` (alte YAML-Behauptung Zeile 38-39).
  - Composer-Pill-Toggle: Quelle `full/plugin.js:11530-11538`, unmarkiert →
    rendern auch im Catalog-Build, wo der Pill nicht existiert (wartet auf
    SDK-Slot, #116305). README-Tabelle (Zeile 129/130) weist beides als
    „– (waits for SDK …)" aus.
  - Kein Test greift auf `composerProjectPill`, `kickAppRefresh` oder die
    Events zu (grep über `tests/`) — Umstellungen sind testseitig nur
    Pfad-Angelegenheiten.

## Scope

1. **Layout-Umzug** (Review-Punkt 1): Catalog-Build von `plugin.js` (Root)
   nach `desktop/plugin.js`; `plugin.yaml` bleibt Root, `full/` bleibt
   außerhalb von `desktop/`. Alle Pfade in Scripts, Tests, install.sh und
   Doku nachziehen.
2. **Synthetische Events entfernen** (Review-Punkt 2): Catalog-Build darf
   kein `window.dispatchEvent(new Event('focus'))` / `document`-`visibilitychange`
   mehr feuern. Full-Build (Standalone-Distro, nicht Teil des Catalogs)
   behält den Kick, mit ergänzender Disclosure-Zeile im README.
3. **Composer-Pill-Toggle im Catalog-Build verbergen** (Review-Punkt 4): 
   ToggleRow in `#full`-Region.
4. **Disclosure-Truth** (Review-Punkt 3): Catalog-YAML-Beschreibung auf
   Ist-Stand des Catalog-Builds kürzen; Kommentarblock + sha-Kommentar
   entfernen; Gleicheichtigkeit in `plugin.yaml`, README/README.de,
   `docs/PLUGIN-CATALOG-PR.md`, `marketplace.json`.
5. **Version 1.29.1**, Rebuild, Gates, Commit/Push, Re-Pin (sha + image +
   screenshots) im Mirror-YAML und im hermes-agent-PR, Kommentar im PR.

## Nicht-Scope (bewusst ausgeklammert)

- **Full-Build-Features**: Chat-Animation, REST-Doors (Pinned/Archiv/Kanban/
  Cron), Composer-Pill, Desktop-Bridge — bleiben unverändert in
  `full/plugin.js` (Standalone-Distro; nur der Catalog-Build wird
  bereinigt). Auch `kickAppRefresh` bleibt im Full-Build aktiv.
- **SDK-Migration**: kein Eigenbau eines Refresh-/Invalidate-Hooks — das ist
  Upstream-Angelegenheit (#116305, dort bereits angefragt; Review bestätigt
  diesen Weg ausdrücklich).
- **Marketing-Assets**: Banner/Screenshots bleiben, nur die SHA-Pins in den
  raw.githubusercontent-URLs werden neu gesetzt.
- **Historische Einträge**: CHANGELOG-Altversionen, alte Pläne und
  `docs/APP-INTEGRATION.md`-Historie werden nicht rückwirkend umgeschrieben
  (nur aktuelle Referenzen pflegen).
- `uninstall.sh` (referenziert keine Build-Pfade — verifiziert) und
  `.github/workflows/check.yml` (ruft nur Scripts; pfadfrei).

## Umsetzung

Umgesetzt am 2026-10-09 wie geplant; Abweichungen/Ergänzungen:

- **Zusätzlich**: `tests/surface-test.mjs` prüft jetzt aktiv auf
  `(window|document).dispatchEvent` im Catalog-Build (Regressionsschutz
  für Review-Punkt 2, Regel in AGENTS.md/README aufgenommen).
- **Zusätzlich**: Composer-Glass-Screenshot (`sf-hero-a4-…`) aus dem
  Screenshot-Set der Catalog-YAML entfernt (zeigt ein Full-only-Feature —
  gleiche Disclosure-Logik wie Review-Punkt 3).
- **Zusätzlich**: `marketplace.json` (Tagline/Summary/Beschreibung auf fünf
  Catalog-Features, Builds-/Install-Entry-Pfade, Größe), `CONTRIBUTING.md`,
  `docs/AGENT-GUIDE(-EN).md`, `docs/PLANNING.md`, `docs/DEVELOPMENT.md`,
  `docs/APP-INTEGRATION.md`, `docs/SETTINGS.md` auf das neue Layout/die
  neue Wahrheit gepflegt.
- Commits: (1) Fix-Stand v1.29.1 (alles Obige; Catalog-YAML mit neuer
  Beschreibung, sha noch alt), (2) Re-Pin (sha + image + screenshots +
  `docs/PLUGIN-CATALOG-PR.md` auf den Fix-Commit).

Reihenfolge der Arbeit: erst Layout (damit der Rebuild am neuen Ort landet), dann
Quell-Edits, dann Rebuild + Gates, dann Docs/Metadaten, dann Re-Pin.

### 1. Layout: `plugin.js` → `desktop/plugin.js`

- `mkdir desktop && git mv plugin.js desktop/plugin.js` (Datei bleibt
  committet/trackiert; CI-`--check`-Parität bleibt erhalten).
- `scripts/build-catalog.mjs`: `outPath = path.join(root, 'desktop',
  'plugin.js')` (statt Zeile 23; Review zitierte :22). Header-Kommentare
  und Konsolen-Meldungen (`./plugin.js` → `./desktop/plugin.js`) anpassen;
  vor `writeFileSync` optional `mkdirSync(dirname(outPath), { recursive:
  true })` zur Härtung.
- `scripts/check.mjs:19`: `'../plugin.js'` → `'../desktop/plugin.js'`
  (Label „Catalog-Build (desktop/plugin.js)").
- `tests/render-test.mjs:28`, `tests/surface-test.mjs:22`,
  `tests/style-test.mjs:36`: Catalog-Pfad → `'../desktop/plugin.js'`
  (+ Kopfkommentare).
- `install.sh`: im Catalog-Zweig `SOURCE_FILE="$REPO_DIR/desktop/plugin.js"`
  und `LINK_DIR="$REPO_DIR/desktop"` (App lädt `$DIR/plugin.js` — Symlink
  muss auf `desktop/` zeigen), Kopfkommentar aktualisieren.
- `package.json` (description), `marketplace.json`
  (`platform.builds.catalog.entry`, `install.entry`, `notes`; `size` erst
  nach Rebuild), README.md/README.de.md (Projektstruktur-Baum,
  Two-builds-Abschnitt, Regenerate-Hinweis), `AGENTS.md` (Zwei-Build-
  Absatz + Regel-8-Zeile), `docs/README.md` (Zeilen 30-34), ggf.
  `docs/DEVELOPMENT.md`-Pfade.

### 2. `kickAppRefresh()`: synthetische Events aus dem Catalog-Build

Quelle `full/plugin.js:1981-2000`:

- Beide `try { … dispatchEvent … }`-Blöcke in je eine
  `/* #full */ … /* #end */`-Region packen. Die Funktion bleibt in beiden
  Builds existierend, wird im Catalog-Build zum dokumentierten No-Op —
  Aufrufstellen (`afterProjectMutation`, `restoreSessionRow`; Catalog
  `plugin.js:1690`, `6490`) bleiben unverändert und laufen ins Leere.
- Doc-Kommentar umschreiben: Catalog-Build kickt nicht (Review R2, Punkt 2;
  sauberes Refresh-Signal als SDK-invalidate-Hook auf #116305 angefragt);
  Full-Build (Standalone) feuert weiter wie beschrieben.
- README „Disclosure (full build)": ein Satz ergänzen — nach eigenen
  Mutationen (Projekt, Pin, Archiv) feuert der Full-Build synthetische
  `focus`/`visibilitychange`-Events, damit die App-Sidebar nachzieht.

### 3. Composer-Pill-Toggle nur im Full-Build

Quelle `full/plugin.js:11530-11538`: die komplette `jsx(ToggleRow, …
composerProjectPill …)` in `/* #full */ … /* #end */` packen (Muster ist
erprobt — Regionen in `children:[…]`-Arrays funktionieren, vgl.
`mark-read`-Menüitem `full/plugin.js:10715`). i18n-Keys
`composerProjectPill(+Desc)` bleiben in beiden Bundles (check.mjs prüft
Existenz, nicht Nutzung; Full-Build nutzt sie weiter). Vorab grep'en, dass
keine andere Catalog-Stelle `composer.projectPill` liest (erwartet: keine).

### 4. Disclosure-Truth (Catalog-YAML + Spiegelstellen)

`plugin-catalog/session-flow.yaml` (Mirror der PR-Datei in
NousResearch/hermes-agent):

- Kommentarblock Zeilen 1-13 und Inline-Kommentar an `sha:` entfernen. Die
  Submission-Leitfaden-Inhalte (2:1-Regel für `image`, Pin-Prozedur) nicht
  verlieren → nach `docs/PLUGIN-CATALOG-PR.md` verschieben.
- `description` neu (konsistent zur Merge-Disclosure-Zeile des Reviews):
  - Feature-Satz ohne „Smooth line-by-line chat animation"; „six features"
    → **„five features"** (Animation wartet auf SDK-Message-Render-Hook,
    README-Tabelle weist sie als absent aus).
  - Reads: nur öffentliche RPCs (`projects.tree`, `projects.list`,
    `session.list`, `session.active_list`, `session.context_breakdown`) +
    Focused-Session-State. **Kein REST-Satz** mehr (`/api/sessions`,
    `/api/plugins/kanban/board`, `/api/cron/jobs` sind im Catalog-Build
    gestubbt).
  - Writes: Liste ohne `session.workspace.move` (im Catalog-Build nur in
    Kommentaren).
  - Speicher: „Settings and groups stay in the app's local plugin storage"
    (statt `~/.hermes/cache/…`).
  - Timer-Satz: „project cache + nav status 60 s" → „project cache 60 s"
    (Nav-Status-Timer ist im Catalog-Build ein No-Ops-Intervall).
  - Behalten: Ctrl+Scroll-Capture-Satz, kein Outbound-Network/Telemetry/
    Credentials/Shell/Self-Update, Kontakt. Full-Build-Hinweis (Standalone,
    README-disclosed, NOT part of this entry) bleibt.
- `sha:` auf den neuen Fix-Commit setzen (nach Push), `image` + alle
  `screenshots` auf denselben SHA re-pinnen.
- `plugin.yaml`: dieselben inhaltlichen Fixes (Feature-Liste ohne
  Animation, REST-Lese-Behauptung aus dem Catalog-Satz streichen — die
  REST-Lesetüren gehören in den Full-Build-Absatz), Header-Kommentar:
  Einstiegspunkt ist jetzt `desktop/plugin.js`.
- README.md/README.de.md, „Disclosure (catalog build)": REST-Satz streichen,
  Speicher-Aussage auf „app's local plugin storage (ctx.storage)" korrigieren.
- `docs/PLUGIN-CATALOG-PR.md`: Review-Response um R2-Tabelle ergänzen
  (Layout, synthetic events, Disclosure-Truth, Toggle), Surfaces-Liste
  ohne REST-Lesetüren und ohne `session.workspace.move`, neuer Pin-SHA,
  Hinweis auf desktop/-Layout.
- `marketplace.json`: `summary`/`description` ohne „Smooth line-by-line
  chat animation" (Six→Five im Tagline-Zähler), `builds.catalog.entry` =
  `desktop/plugin.js`, `notes` + `size` aktualisieren.

### 5. Version, Rebuild, Gates

- Bump auf **1.29.1**: `VERSION` in `full/plugin.js:120`, `package.json`,
  `plugin.yaml`, `plugin-catalog/session-flow.yaml`, `marketplace.json`.
- `node scripts/build-catalog.mjs` → schreibt `desktop/plugin.js`
  (enthält danach: No-Op-`kickAppRefresh`, keine Composer-Pill-ToggleRow,
  keine synthetischen Events, `VERSION` 1.29.1).
- Negativ-Grep über `desktop/plugin.js`: `dispatchEvent` = 0 Treffer,
  `composerProjectPill` = 0, `hermesDesktop` = 0 (auch surface-test deckt
  das letzte ab).

### 6. Commit, Push, Re-Pin, PR-Kommentar

- Commit(s) mit Repo-Identität (`Deniz`/`dezooyi@users.noreply.github.com`),
  z. B. „fix(catalog): R2-Review — desktop/-Layout, keine synthetischen
  Events, Disclosure auf Ist-Stand, Composer-Pill-Toggle nur Full (v1.29.1)".
  Commit BOTH files (Quelle + generierter Build) — CI schlägt sonst auf
  stale Catalog-Build.
- Push → neuen 40-Hex-SHA notieren → Mirror-YAML im Repo (sha + image +
  screenshots) setzen und committen.
- Im hermes-agent-PR die Datei `plugin-catalog/session-flow.yaml` auf
  denselben Stand bringen und kommentieren („re-pinned @ <SHA>; alle vier
  Punkte adressiert"), Referenz auf Plan/Commit.

## Verifikation

Gelaufen am 2026-10-09 (Windows-Checkout, Node 22):

- `node scripts/build-catalog.mjs --check` — ✓ „desktop/plugin.js ist aktuell
  (Catalog-Build = Stand von full/plugin.js)".
- `npm run check` — ✓ „Alles gut": Syntax/i18n/Hook-Audit Full (519 Keys) +
  Catalog (366 Keys, ohne die Full-only-Keys), Surface-Check inkl. der
  NEUEN `(window|document).dispatchEvent`-Regel grün.
- `npm test` — ✓ Render-Smoketest BEIDE Builds bestanden (full + catalog,
  neue Pfade); Full-only-Sektionen im Catalog-Build wie erwartet geskippt.
- Negativ-Grep über `desktop/plugin.js`: `dispatchEvent` = 0 Treffer,
  `hermesDesktop` = 0, `composerProjectPill` nur in den i18n-Bundles
  (Toggle ist Full-only, Keys bewusst erhalten).
- `plugin-catalog/session-flow.yaml`: 0 Kommentarzeilen, beginnt direkt mit
  `name:` (Review-Punkt „strip comments" erfüllt).
- `npm run test:style` — nicht gelaufen (keine Design-CSS-Änderung; kein
  Playwright auf diesem Rechner). Nachziehen, fallsavailable.

Auslieferung (erledigt am 2026-10-09):

- `hermes plugins validate` (lokal, Hermes Agent v0.21.6+302): **Validation
  passed** — u. a. „✓ loadable — entry: desktop/plugin.js", „✓ desktop
  surface", „✓ no core override", „✓ security scan" (bestätigt genau den
  Layout-Punkt des Reviews).
- Push: `origin/main` 503efe9 → 15a50c6 (Agantila/session-flow).
- PR #135216 (NousResearch/hermes-agent): PR-Branch `catalog/session-flow`
  um den Re-Pin-Commit `27fad6000b` ergänzt (nur die YAML, 28+/46−; über
  separaten Worktree — der lokale hermes-agent-Checkout blieb unangetastet),
  Titel auf „… v1.29.1 @ 359f9af …" und Body auf die neue Fassung von
  `docs/PLUGIN-CATALOG-PR.md` aktualisiert, Re-Pin-Kommentar an @teknium1
  gepostet (PR-Head bestätigt: 27fad6000b).

Offen (nur auf der Zielmaschine möglich, kein Repo-Blocker):

- Manuell in Hermes Desktop: `./install.sh --link --variant catalog` →
  Plugin lädt, Tabs-Sektion ohne Projekt-Pill-Toggle; Archiv/Wiederherstellen
  + Projekt-Mutationen feuern kein `focus`/`visibilitychange` mehr; Full-Build
  unverändert (Kick weiterhin).

## Follow-ups

- SDK-invalidate-Hook (Refresh-Signal nach Mutationen) + REST-read-door +
  Composer-Accessory-Slot bleiben auf Upstream #116305 angebietet — sobald
  sie landen, holt der Catalog-Build Pips/Pinned-Filters/Composer-Pill per
  reviewed SHA-bump-PR zurück (siehe `docs/ROADMAP.md`, Abschnitt SDK-Slots).
- Ausblick: wenn der Full-Build irgendwann komplett auf SDK-Slots läuft,
  entfällt auch dort `kickAppRefresh()` (dann gesamte Funktion löschen, nicht
  nur die Catalog-Hälfte).
