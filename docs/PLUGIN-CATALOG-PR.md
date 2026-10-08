# Catalog entry: `session-flow` (resubmission after #134760)

This PR adds a single file, `plugin-catalog/session-flow.yaml`, listing
[`agantila/session-flow`](https://github.com/agantila/session-flow) at the
pinned commit `PIN_SHA_HERE` (**v1.29.0**).

**Resubmission of #134760** (review by @teknium1). Every point of the review
is addressed; see "Review response" below. Contact for this submission:
**info@agantila.com** (also in the entry, plugin.yaml and marketplace.json).

## What it does

Six UX features for the Hermes Desktop session sidebar in one plain-ESM
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
   (`session.branch_stored`), move between projects (`session.workspace.move`
   / `session.cwd.set`), pin/unpin via the SDK `host.sessions.pin` door,
   archive/close/delete via `session.*` RPCs — all public gateway RPCs.
4. **Project management** — create/edit/delete projects and folders, set
   primary folder, set active project (`projects.*` RPCs, same seams the
   native sidebar uses).
5. **Status pips** — Scheduled-jobs and Kanban buttons with honest status
   dots fed by read-only local-gateway REST reads (`/api/cron/jobs`,
   `/api/plugins/kanban/board`) where the host exposes them; kanban presence
   is detected by the endpoint answering, not by probing app markup.
6. **Settings page + i18n** — own route (`ROUTES_AREA`), sidebar nav entry,
   palette commands, keybinds, EN + DE bundles.

The **catalog build (`plugin.js`) is SDK-only** (catalog rule 8). The repo
also ships a **full build (`full/plugin.js`)** for standalone installs via
`install.sh` — it adds UI decorations that need SDK slots which do not exist
yet (see "SDK slots requested"), reaches past the SDK with the documented
Desktop-Bridge doors, and is disclosed in the repo README. It is NOT part of
this catalog entry; the entry pins the catalog build.

## Review response (#134760)

| Review point | Resolution |
|---|---|
| app-markup queries (`plugin.js:1301`, `2658-2732`, `9566`) | Removed from the catalog build: no `document.querySelector(All)` on `data-slot`/`data-tour`/`data-testid`/`data-sidebar` or any app marker. Composer radius measurement and chip injection deleted; kanban detection now uses the REST endpoint answer instead of DOM probing. A repo-side tripwire (`tests/surface-test.mjs`) mirrors the admission lint so this cannot regress. |
| `document.body` observers (`7249-7330`) | Removed (chat animation is full-build-only). The catalog build has zero DOM observers on `body`/`documentElement`. |
| composer injection (`2658-2732`) | Removed from the catalog build; **composer accessory slot requested on #116305**. |
| core-element CSS overrides (`6460-6570`, `6686`) | Removed from the catalog build (glass/chips/statusbar restyle, hide-tabstrip); **tab decoration + theme slots requested on #116305**. |
| `window.hermesDesktop.*` | Zero occurrences in the catalog build (grep-checked in CI): REST mirror reads, file picker, reveal-path, open-in-terminal and clipboard bridges are stripped or replaced (clipboard = `navigator.clipboard`). **REST-read door + file-picker/terminal doors requested on #116305**; pinned/archived quick-filters and status pips degrade honestly (hidden, never faked) until then. |
| disclosure mismatch (localStorage write claim; omitted `projects.*` writes, `session.title`/`session.branch_stored`, `/api/cron/jobs` + kanban reads) | The false write claim is gone — the code never wrote it, and v1.29.0 no longer even READS the app-internal key (active project resolves via `projects.list` `active_id` only). The full RPC/REST list is in the entry `description` above, in the repo `plugin.yaml`, and in the README disclosure section. |

## Hermes surfaces used (catalog build)

- **`ctx.register` / `ctx.registerMany`** for: pane (`PANES_AREA`), settings
  page (`ROUTES_AREA`), sidebar nav (`SIDEBAR_NAV_AREA`), palette commands
  (`PALETTE_AREA`), keybinds (`KEYBINDS_AREA`); `ctx.i18n.register(...)` for
  EN + DE; `ctx.onEvent` for gateway events (`message.complete`,
  `session.info`, `reasoning.delta`, `tool.start`, …); `ctx.storage` for
  settings/groups under `~/.hermes/cache/desktop-plugins/session-flow/`.
- **SDK host API**: `host.state.*` atoms (focused session, gateway, cwd,
  profile), `host.request` (gateway RPCs), `host.openSession`,
  `host.sessions.pin`, `host.navigate`, `host.notify`/`host.notifyError`,
  `host.settings.get/subscribe` (app density read).
- **Gateway RPCs — reads**: `projects.tree`, `projects.list`,
  `session.list`, `session.active_list`, `session.context_breakdown`.
- **Gateway RPCs — writes (user-initiated)**: `projects.create`,
  `projects.update`, `projects.add_folder`, `projects.remove_folder`,
  `projects.set_primary`, `projects.set_active`, `projects.delete`,
  `session.create`, `session.cwd.set`, `session.workspace.move`,
  `session.title`, `session.branch_stored`, `session.archive`,
  `session.close`, `session.delete`.
- **Local REST mirror — reads only** (full/known hosts; degrades hidden):
  `GET /api/sessions` (pinned flag — the RPC wire has no pinned field),
  `GET /api/plugins/kanban/board` (kanban presence + counts),
  `GET /api/cron/jobs` (job states).
- **DOM scope**: only plugin-owned elements (own pane, own overlays, own
  settings page). One disclosed exception: the wheel gesture handler reads
  `event.target.closest(BUILTIN_IGNORE)` — the event target of its own
  listener, never a document query — to keep off zoom surfaces (lightbox,
  Monaco).

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
  gateway (RPC + localhost REST mirror).
- **Reads outside the plugin's own data:** the gateway atoms/RPCs and REST
  endpoints listed above. Nothing else — no other plugin's data, no browser
  profile, no vendor CLI tokens, no app-internal localStorage keys.
- **Shell commands:** none.
- **Long-running background processes:** none beyond ctx-owned intervals,
  disposed on unload (live-session poll ~30 s, session refresh ~45 s,
  project cache + nav status 60 s, activity expiry 30 s, lightweight UI
  sync 2–5 s).
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
6. **REST-mirror read door** — supported SDK way to read `/api/sessions`
   (pinned flag is not on the RPC wire) plus `/api/cron/jobs` and
   `/api/plugins/kanban/board`.
7. **Doors for native file picker / revealPath / openSessionInTerminal.**

As these land, the full-only regions migrate onto the SDK and the catalog
build regains the features — each as a reviewed SHA-bump PR.

## Verification

- Repo gates at the pin: `npm run check` (syntax + i18n EN/DE + hook-order
  audit on BOTH builds + surface tripwire on the catalog build), `npm test`
  (render smoketest against both builds), `npm run test:style`
  (Chromium computed styles, full build).
- `node scripts/build-catalog.mjs --check` proves the committed `plugin.js`
  is exactly the SDK-only build of `full/plugin.js`.
- `hermes plugins validate /path/to/session-flow --install-deps` passes the
  manifest, `desktop surface`, `no core override` and security-scan checks.

## Why this entry qualifies

Rule 5: owner of `agantila/session-flow`. Rule 2: pinned to a full 40-hex
commit. Rule 3: no self-updater. Rule 4: every SHA bump is a new PR.
Rule 8: catalog build is SDK-only, enforced by the repo's own surface
tripwire. Rule 13: disclosure above matches the code at the pin.
Rule 14: `requires_hermes: ">=0.21.5"` is a SemVer floor; `version: "1.29.0"`
matches the code. Contact: **info@agantila.com**.
