# Catalog entry: `session-flow` (resubmission after #134760)

This PR adds a single file, `plugin-catalog/session-flow.yaml`, listing
[`agantila/session-flow`](https://github.com/agantila/session-flow) at the
pinned commit `359f9afecb5872fe0864eec79867a4dfa4d88d33` (**v1.29.1**).

**Resubmission of #134760** (review by @teknium1, two rounds). Round 1
marked three of four decline reasons fixed; round 2's four remaining points
are all addressed in v1.29.1 — see "Review response (round 2)" below.
Contact for this submission: **info@agantila.com** (also in the entry,
plugin.yaml and marketplace.json).

The entry's `image:` is a dedicated 2:1 banner (`docs/marketing/sf-catalog-banner-2x1.png`,
1200×600, per the catalog README's "optional https image on a GitHub host,
2:1 (e.g. 1200x600)") instead of a 16:9 hero screenshot stretched/cropped
into that slot.

Submission checklist (mirrored from the repo, kept here since the entry
YAML itself is comment-free):

1. `sha` pins the full 40-hex commit of the reviewed fix stand
   (v1.29.1); `image`/`screenshots` URLs are pinned to the SAME sha.
2. `image` is 2:1 (1200×600 banner above).
3. Screenshots show only catalog-build features (the composer-glass hero
   was dropped in v1.29.1 — it depicts a full-build-only decoration).
4. The description carries the full rule-13 disclosure and must match the
   code at the pin (that mismatch declined #134760 in round 1 and was the
   "PARTIAL" item in round 2).

## What it does

Five UX features for the Hermes Desktop session sidebar in one plain-ESM
plugin, all live-configurable from a built-in settings page:

1. **Session pane with Firefox-style groups** — list or grid, groups collapse
   into a stack (spine/fanned/pill), optional auto-grouping by date/source/
   project folder (fed by `projects.tree`). Drop a tab on a project header to
   move it. Live status icons (thinking / writing / tool / waiting / done /
   error) from gateway RPCs and events. Search + quick filter bar. App
   quick-start row above the toolbar (SDK `host.navigate` routes).
2. **Ctrl+Scroll = session cycling** — hold a modifier and wheel through your
   active sessions; a HUD shows position and title. The gesture listener only
   reads `event.target.closest(…)` to stay off zoom surfaces — it never
   queries the document and never touches core UI.
3. **Project-aware session actions** — rename (`session.title`), branch
   (`session.branch_stored`), move between projects (`session.cwd.set`),
   archive/close/delete via `session.*` RPCs — all public gateway RPCs.
4. **Project management** — create/edit/delete projects and folders, set
   primary folder, set active project (`projects.*` RPCs, same seams the
   native sidebar uses).
5. **Settings page + i18n** — own route (`ROUTES_AREA`), sidebar nav entry,
   palette commands, keybinds, EN + DE bundles.

The **catalog build (`desktop/plugin.js`) is SDK-only** (catalog rule 8).
The repo also ships a **full build (`full/plugin.js`)** for standalone
installs via `install.sh` — it adds UI decorations that need SDK slots which
do not exist yet (see "SDK slots requested"), reaches past the SDK with the
documented Desktop-Bridge doors, and is disclosed in the repo README. It is
NOT part of this catalog entry; the entry pins the catalog build.

Repo layout (round-2 review point 1 — the documented layout):
`plugin.yaml` at the repo root, catalog entrypoint `desktop/plugin.js`,
`full/` outside `desktop/`.

## Review response (round 2)

| Review point (R2) | Resolution |
|---|---|
| 1. move the catalog build to `desktop/plugin.js` (documented layout; `hermes plugins validate`; installer must not copy `full/`, `install.sh`, docs/marketing) | Done in v1.29.1: `git mv plugin.js desktop/plugin.js`; `plugin.yaml` stays at the root, `full/` stays outside `desktop/`. `scripts/build-catalog.mjs` (out path), `scripts/check.mjs`, all three tests and `install.sh` (catalog variant now sources/symlinks `desktop/`) follow the new path. |
| 2. drop `kickAppRefresh()`'s synthetic window focus / document visibilitychange events (they trigger every focus/visibility listener in the app and other plugins) | Done: the dispatch blocks live in `/* #full */` regions — in the catalog build `kickAppRefresh()` is a documented no-op (call sites stay and no-op). The standalone full build keeps the instant-sync kick and now discloses it in the README. A clean refresh signal after mutations is requested as an SDK invalidate hook on #116305 (added to the slot list). `tests/surface-test.mjs` now trips on `(window\|document).dispatchEvent` in the catalog build so this cannot regress. |
| 3. catalog YAML description must match the catalog build | Done: dropped "Smooth line-by-line chat animation" (full-only, README table lists it absent); dropped the `GET /api/sessions`, `/api/plugins/kanban/board`, `/api/cron/jobs` reads (all three are `#catalog-only` stubs in the code); removed `session.workspace.move` from the writes list (comment-only in the catalog build); settings/groups now described as living "in the app's local plugin storage" (they go through `ctx.storage`); stripped the top comment block and the inline comment on the `sha:` line (submission guidance moved into this doc). The composer-glass screenshot was dropped from `screenshots` for the same reason (depicts a full-only feature). |
| 4. hide the "Project pill in composer" toggle in the catalog build (does nothing there) | Done: the `composer.projectPill` ToggleRow is wrapped in a `#full` region; the catalog settings page no longer renders it. |

Reviewer note (no action needed): at merge the catalog adds their
disclosure line — reads `projects.tree`, `projects.list`, `session.list`,
`session.active_list`, `session.context_breakdown`; writes
`projects.create/update/add_folder/remove_folder/set_primary/set_active/delete`,
`session.create`, `session.cwd.set`, `session.title`,
`session.branch_stored`, `session.archive`, `session.close`,
`session.delete`; Ctrl+wheel capture; settings/groups in the app's local
plugin storage; no outbound network, shell, credentials, self-update. The
entry description in this PR is consistent with that line.

## Review response (round 1, #134760 — kept for reference)

| Review point | Resolution |
|---|---|
| app-markup queries (`plugin.js:1301`, `2658-2732`, `9566`) | Removed from the catalog build: no `document.querySelector(All)` on `data-slot`/`data-tour`/`data-testid`/`data-sidebar` or any app marker. Composer radius measurement and chip injection deleted; kanban detection moved off DOM probing. A repo-side tripwire (`tests/surface-test.mjs`) mirrors the admission lint so this cannot regress. |
| `document.body` observers (`7249-7330`) | Removed (chat animation is full-build-only). The catalog build has zero DOM observers on `body`/`documentElement`. |
| composer injection (`2658-2732`) | Removed from the catalog build; **composer accessory slot requested on #116305**. |
| core-element CSS overrides (`6460-6570`, `6686`) | Removed from the catalog build (glass/chips/statusbar restyle, hide-tabstrip); **tab decoration + theme slots requested on #116305**. |
| `window.hermesDesktop.*` | Zero occurrences in the catalog build (grep-checked in CI); bridge doors are stripped. **REST-read door + file-picker/terminal doors requested on #116305**; pinned/archived quick-filters and status pips degrade honestly (hidden, never faked) until then. |
| disclosure mismatch (localStorage write claim; omitted `projects.*` writes, `session.title`/`session.branch_stored`, `/api/cron/jobs` + kanban reads) | The false write claim is gone. Round 2 completed the fix: the description now lists exactly what the catalog build does — no REST reads (they are stubbed), no `session.workspace.move` (comment-only). |

## Hermes surfaces used (catalog build)

- **`ctx.register` / `ctx.registerMany`** for: pane (`PANES_AREA`), settings
  page (`ROUTES_AREA`), sidebar nav (`SIDEBAR_NAV_AREA`), palette commands
  (`PALETTE_AREA`), keybinds (`KEYBINDS_AREA`); `ctx.i18n.register(...)` for
  EN + DE; `ctx.onEvent` for gateway events (`message.complete`,
  `session.info`, `reasoning.delta`, `tool.start`, …); `ctx.storage` for
  settings and groups (the app's local plugin storage).
- **SDK host API**: `host.state.*` atoms (focused session, gateway, cwd,
  profile), `host.request` (gateway RPCs), `host.openSession`,
  `host.navigate`, `host.notify`/`host.notifyError`,
  `host.settings.get/subscribe` (app density read).
- **Gateway RPCs — reads**: `projects.tree`, `projects.list`,
  `session.list`, `session.active_list`, `session.context_breakdown`.
- **Gateway RPCs — writes (user-initiated)**: `projects.create`,
  `projects.update`, `projects.add_folder`, `projects.remove_folder`,
  `projects.set_primary`, `projects.set_active`, `projects.delete`,
  `session.create`, `session.cwd.set`, `session.title`,
  `session.branch_stored`, `session.archive`, `session.close`,
  `session.delete`.
- **REST reads: none.** The former `/api/sessions` (pinned flag),
  `/api/plugins/kanban/board` and `/api/cron/jobs` reads are `#catalog-only`
  stubs — no request is made; the affected UI (pinned/archived quick
  filters, status pips, kanban button) stays hidden until an SDK REST door
  exists (#116305).
- **DOM scope**: only plugin-owned elements (own pane, own overlays, own
  settings page). One disclosed exception: the wheel gesture handler reads
  `event.target.closest(BUILTIN_IGNORE)` — the event target of its own
  listener, never a document query — to keep off zoom surfaces (lightbox,
  Monaco). No synthetic window/document events are dispatched.

## Capabilities

```yaml
capabilities:
  provides_tools: []
  provides_hooks: []
  provides_middleware: []
  requires_env: []
```

`hermes plugins validate … --install-deps` at the pin reports no undeclared
capability creep.

## Disclosure (rule 13) — catalog build

- **Network calls to third-party services:** none. Only the local Hermes
  gateway through public RPCs over the SDK.
- **Reads outside the plugin's own data:** the gateway atoms/RPCs listed
  above. Nothing else — no other plugin's data, no browser profile, no
  vendor CLI tokens, no app-internal localStorage keys, no REST mirror.
- **Shell commands:** none.
- **Long-running background processes:** none beyond ctx-owned intervals,
  disposed on unload (live-session poll ~30 s, session refresh ~45 s,
  project cache 60 s, activity expiry 30 s, lightweight UI sync 2–5 s).
- **Stored credentials:** none.
- **Telemetry:** none.
- **Approval-system interaction:** none.
- **Self-update:** none (rule 3). Updates only via SHA-bump PRs here.

## SDK slots requested (upstream #116305)

1. **Composer accessory slot** — own React node beside the composer controls
   (for the project chip).
2. **Tab decoration slot** — badge/class per content tab + an approved way to
   replace/hide the native tab strip (for the UI-tabs look and
   "list/grid as tab selector").
3. **Message-render hook** — per rendered assistant markdown block (for the
   chat line animation, without DOM observers).
4. **Theme door** — theme-change event + sanctioned token overrides
   (`--ui-accent`) and/or a workspace-background slot (personalization).
5. **Gateway change events** — `session.changed` / `projects.changed`
   (replaces the full build's sidebar DOM observer).
6. **Invalidate hook after mutations** — an SDK-sanctioned refresh signal so
   plugins never need synthetic focus/visibilitychange events to bring the
   app's own views up to date (round-2 review point 2).
7. **REST-mirror read door** — supported SDK way to read `/api/sessions`
   (pinned flag is not on the RPC wire) plus `/api/cron/jobs` and
   `/api/plugins/kanban/board`.
8. **Doors for native file picker / revealPath / openSessionInTerminal.**

As these land, the full-only regions migrate onto the SDK and the catalog
build regains the features — each as a reviewed SHA-bump PR.

## Verification

- Repo gates at the pin: `npm run check` (syntax + i18n EN/DE + hook-order
  audit on BOTH builds + surface tripwire incl. the new synthetic-event
  rule on the catalog build), `npm test` (render smoketest against both
  builds), `node scripts/build-catalog.mjs --check` (committed
  `desktop/plugin.js` is exactly the SDK-only build of `full/plugin.js`).
- Negative grep over `desktop/plugin.js` at the pin: zero
  `dispatchEvent`, zero `hermesDesktop`, zero `composerProjectPill`
  occurrences outside the i18n bundles (toggle is full-only).
- `hermes plugins validate /path/to/session-flow --install-deps` passes the
  manifest, `desktop surface`, `no core override` and security-scan checks
  (documented layout: `plugin.yaml` at the root, entry `desktop/plugin.js`).

## Why this entry qualifies

Rule 5: owner of `agantila/session-flow`. Rule 2: pinned to a full 40-hex
commit. Rule 3: no self-updater. Rule 4: every SHA bump is a new PR.
Rule 8: catalog build is SDK-only, enforced by the repo's own surface
tripwire. Rule 13: disclosure above matches the code at the pin.
Rule 14: `requires_hermes: ">=0.21.5"` is a SemVer floor; `version: "1.29.1"`
matches the code. Contact: **info@agantila.com**.
