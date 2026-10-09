# AGENT GUIDE (EN) — Session Flow (Hermes Desktop Plugin)

> English quick-reference for AI agents and contributors. The deep
> documentation lives in [`docs/README.md`](README.md) (German). If an
> `AGENTS.md` exists in the repo root, it mirrors this file.

## What this is

A Hermes Desktop plugin as **one plain-ESM source file** (`full/plugin.js`, ~13k lines,
no build, no dependencies). Six feature areas: chat line animation,
Ctrl+Scroll session cycling, a session pane (list/grid + groups + filters),
glass readability, UI-tab styling, and personalization — all live-configurable
from a built-in settings page.

It is installed as a **symlink**: `~/.hermes/desktop-plugins/session-flow` →
this repo. Saving a file here IS the deploy (hot reload within ~5 s). Never
copy files around to "install".

## Read first (in this order)

1. [`AGENT-GUIDE.md`](AGENT-GUIDE.md) — reading order, plan process,
   unbreakable rules, git identity (German).
2. [`DEVELOPMENT.md`](DEVELOPMENT.md) — architecture, conventions,
   troubleshooting.
3. [`APP-INTEGRATION.md`](APP-INTEGRATION.md) — every DOM anchor / theme
   token / SDK door the plugin relies on, with risk notes. **Check this first
   after any Hermes Desktop update.**
4. [`SETTINGS.md`](SETTINGS.md) — every option: key, default, effect.
5. [`ROADMAP.md`](ROADMAP.md) — what was done last, what is planned, known
   limits.

## Unbreakable rules (the plugin will not load otherwise)

- No JSX, no build step. Only import `@hermes/plugin-sdk`, `react`,
  `react/jsx-runtime`.
- No hardcoded colors — only `var(--ui-*)` / `var(--chrome-*)`.
- **No backticks anywhere inside the CSS template literal** (not even in CSS
  comments).
- New i18n keys MUST exist in both bundles (`EN` and `DE`) — `npm run check`
  fails otherwise.
- Before every commit: `npm run check && npm test` green. `npm run test:style`
  (real Chromium) is mandatory for design-CSS changes.

## Data-layer traps (learned the hard way — do not re-learn them)

- **Gateway readiness**: `host.request` throws `Hermes gateway unavailable`
  synchronously before the first socket open. NEVER fire initial data loads
  blindly at plugin load — they are coupled to `host.state.gateway === 'open'`
  via `scheduleGatewayBootstrap()` (see
  [`plans/2026-10-05-gateway-bootstrap-gate.md`](plans/2026-10-05-gateway-bootstrap-gate.md)).
  A fallback timer covers SDK builds without that atom.
- `session.list` rows carry only `id/title/preview/started_at/message_count/
  source` — no `cwd`, no `pinned`. Session→project assignment comes from the
  `projects.tree` RPC (`ProjectTreeNode.sessionIds`); pinned state is mirrored
  via REST `GET /api/sessions`. Client-side path matching can never work.
- Live enrichment (`session.active_list`, `session.context_breakdown`) is
  runtime-ID-only; stored IDs resolve to "session not found".
- If a metric's data is not on the wire and cannot be honestly derived:
  hybrid-aggregate from existing signals, defer to a gateway patch, or refuse
  — never invent numbers. Missing data collapses to "omitted", never "0".

## Test-suite traps (render smoke test)

- The SDK stub discards every prop except `children` on `Button`/`Codicon`/
  `Tip`/`DropdownMenu*` — assert on real DOM-tag descendants, CSS classes and
  the `t()` call log, never on props of stubbed atoms.
- Walked nodes carry `.tag`, not `.kind`.
- New atoms used by `useValue` must be appended to the export-list concat in
  `tests/render-test.mjs` or tests fail with `mod.$newAtom is undefined`.
- `$sessions` is global for the whole run — every appended test section sets
  its own fixture at its start and restores the normalized fixture before it
  ends.
- The gateway stub atom starts on `'idle'`; the Bootstrap-Gate tests fire the
  initial load by setting `'open'`. Tests that need loaded data must run AFTER
  that section.
- `window.setTimeout`/`clearTimeout` in the harness are real timers — code
  paths that debounce through them (e.g. `scheduleSessionsRefresh`) now run
  for real; await the debounce window before asserting.

## Parallel sessions on this repo are normal

Several agent sessions may work on this checkout at once. Snapshot with
`git status`/`git log` before editing, keep edits small and atomic, verify
your markers, and re-check git state before final reports. Run the full test
suite over the COMBINED tree.

## Plans & docs discipline

Non-trivial work gets a plan file: copy `plans/TEMPLATE.md` to
`plans/<YYYY-MM-DD>-<slug>.md` with the request quoted verbatim; a plan is
only `Done` with verification evidence inside. Before finishing, update:
`../CHANGELOG.md`, `SETTINGS.md` (option changes), `ROADMAP.md`,
`APP-INTEGRATION.md` (new doors/anchors), `README.md` (new files), and keep
`package.json` version + the `VERSION` constant in `full/plugin.js` in sync.

## Git identity

```bash
git -c user.name="Deniz" -c user.email="dezooyi@users.noreply.github.com" commit -m "…"
```
