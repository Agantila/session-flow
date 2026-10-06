# Catalog entry: `session-flow`

This PR adds a single file, `plugin-catalog/session-flow.yaml`, listing
[`agantila/session-flow`](https://github.com/agantila/session-flow) at the
pinned commit **`3b731466f63229a6486d7033675dbec835d63fc0`** (v1.21.1).

## What it does

Six UX features for the Hermes Desktop session sidebar in one plain-ESM
plugin, all live-configurable from a built-in settings page:

1. **Line-by-line chat animation** — assistant answers cascade in instead of
   popping. Duration, stagger, easing, code/list options — all configurable.
2. **Ctrl+Scroll = session cycling** — hold a modifier and wheel through your
   active sessions; a HUD shows position and title. Zoom surfaces keep their
   own behaviour.
3. **Session pane with Firefox-style groups** — list or grid, groups collapse
   into a stack (spine/fanned/pill), optional auto-grouping by date/source/
   project folder. Drop a tab on a project header to move it. Live status
   icons (thinking / writing / tool / waiting / done / error). Search + quick
   filter bar. App quick-start row above the toolbar.
4. **Glass & readability** — optional frost for the input field and UI chips,
   with a soft accent-tinted gradient overlay that fades to transparent. Blur,
   saturation, opacity, gradient angle/strength, scopes, and a travelling glow
   ring — all configurable.
5. **Sidebar-style UI tabs** — content-area tabs become rounded chips like
   the sidebar session rows. Live session info from the sidebar: working
   sessions get the travelling glow ring on their tab.
6. **Personalization** — pick your own accent color, set a chat background
   (image or video, fit/dim/blur/scope), and choose the pane surface (native
   sidebar / chat / none).

Plus v1.21.1: a **Composer project chip** in front of the `+` Add button
so the project anchor for the next message is visible before typing, and
the chip's pick now actually anchors the new session in the chosen
project (v1.21.0 created an empty session eagerly and the App-send path
ignored the pick — fixed in v1.21.1 by writing `hermes.desktop.projectScope`
and reading the chip as the first source in the resolve order).

## Hermes surfaces used

Public surfaces only, per Rule 9:

- **`ctx.register`** for: pane (`PANES_AREA`), settings page
  (`ROUTES_AREA`), sidebar nav (`SIDEBAR_NAV_AREA`), palette commands
  (`PALETTE_AREA`), `ctx.i18n.register(...)` for EN + DE translation keys.
- **Sampled atoms** (read-only): `host.state.focusedSessionId`,
  `host.state.focusedStoredSessionId`, `host.state.focusedSessionProfile`,
  `host.state.gateway`. Internal `$composerPick`, `$sessionProjectSeed`,
  `$projectsList`, `$sessions`, `$liveMap` are plugin-local Jotai-style
  atoms.
- **Gateway RPCs** (read or write, all public): `projects.tree`,
  `projects.list`, `projects.set_active`, `session.active_list`,
  `sessions.list`, `session.context_breakdown`, `session.title`,
  `session.workspace.move`, `session.cwd.set`, `session.create`,
  `host.openSession`. **No** `AIAgent.<method> = …`, `setattr(server, …)`,
  `sys.modules[…]` writes, no overrides of core internals.
- **localStorage** read + write of a single key:
  `hermes.desktop.projectScope` (the App's existing scope atom backing
  key — the plugin writes it when the user picks a project in the
  composer chip; the App reads it on init).
- **DOM scope** (per Rule 8): only `MutationObserver` on
  `[data-slot='composer-root']` for the chip's sync loop, and
  `[data-pane-overlay]`, `[data-pane-hidden]`, `[data-popped-out]` for
  pane filtering. No `data-slot` / `data-tour` / `data-sidebar` /
  `data-testid` queries to rewrite core UI. No prototype patching,
  no `eval` / `new Function`, no dynamic `import()` of non-SDK
  modules, no script-tag injection.

## Capabilities

```yaml
capabilities:
  provides_tools: []      # no agent tools
  provides_hooks: []      # no ctx.hooks
  provides_middleware: [] # no ctx.middleware
  requires_env: []        # no environment variables
```

The declared block matches reality at `3b731466`. `hermes plugins validate
…--install-deps` should report no undeclared capability creep.

## Disclosure (Rule 13)

Pure UI layer — what to know before installing:

- **Network calls to third-party services:** none. The plugin makes no
  outbound HTTP / WebSocket calls of its own. It only reads the Hermes
  gateway (localhost) and writes its own settings file.
- **Reads outside the plugin's own data:** the Hermes gateway atoms
  (`projects.tree`, `projects.list`, `session.active_list`,
  `sessions.list`, `session.context_breakdown`, `session.title`,
  `session.workspace.move`, `session.cwd.set`) and the localStorage
  key `hermes.desktop.projectScope` (only). No other plugin's data,
  no browser profile, no vendor CLI token file.
- **Shell commands:** none. No `child_process`, no `exec`, no shelling out
  to system CLIs.
- **Long-running background processes:** one `ctx.setInterval(…, 30_000)`
  for session activity expiry, one `ctx.setInterval(…, 60_000)` for
  project-tree refresh, one `ctx.setInterval(…, 2_500)` for the
  composer-chip sync loop, and three short HTTP polls driven by
  Hermes's `host.request` (poll rhythm is Hermes's). All are owned by
  `ctx` and disposed on plugin unload.
- **Stored credentials:** none. The plugin has no `config_schema`
  secrets, no API keys, no OAuth tokens. It only reads what Hermes
  itself has in memory.
- **Telemetry / usage reporting:** none — fully opt-in by being
  absent.
- **Approval-system interaction:** none. The plugin never auto-approves,
  never spawns child Hermes processes that inherit YOLO or non-interactive
  mode, never disables guards. OAuth / interactive prompts are not in
  its flow.

## Known issues

None at v1.21.1. The composer-chip v1.21.0 bug (new sessions not
anchoring in the picked project) is fixed in this pin; users on
v1.21.0 should bump via `hermes plugins update session-flow` after the
catalog picks up this PR.

## Verification commands (run locally)

```
hermes plugins validate /path/to/agantila/session-flow --install-deps
```

…should pass the manifest check, the desktop surface check, the no
core override check, the security scan (expect zero `dangerous`; some
`caution` findings are normal — read the log), and the capabilities
check against this PR's empty `provides_*` blocks.

## Why this entry qualifies

Rule 5: I'm the owner of `agantila/session-flow`. Rule 2: pinned to a
full 40-hex commit SHA (`3b731466…`), not a branch or tag. Rule 3: no
self-updater in the catalog build (the `install.sh` symlink flow stays
out of the plugin entrypoint; the catalog loader will clone + checkout
the exact SHA on every install). Rule 4: every SHA bump is a new PR
that re-reviews the diff. Rule 14: `requires_hermes: ">=0.21.5"` is a
SemVer floor, `version: "1.21.1"` matches the code at the pin.