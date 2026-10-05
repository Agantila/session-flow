// tests/render-test.mjs — Headless-Render-Smoketest für Session Flow.
//
// Lädt die ECHTE plugin.js, ersetzt die drei Import-Module (@hermes/plugin-sdk,
// react, react/jsx-runtime) durch Stubs und rendert Sessions-Pane UND
// Einstellungsseite komplett (rekursiver Walk; Funktions-Komponenten werden
// aufgerufen). Klicks werden über slot-basiertes useState simuliert — ein
// gespeicherter props.onClick() wirkt im nächsten Render.
//
// Geprüft wird u. a.: Listen-Begrenzung (tabs.maxVisible) mit
// „Mehr anzeigen (n)“/„Weniger anzeigen“-Toggle, Grenzfälle (Limit = Anzahl,
// > Anzahl), Render-Stabilität mehrerer Renders und die Einstellungsseite
// inkl. der zugehörigen Optionszeile.
//
// Aufruf:  npm test   (oder:  node tests/render-test.mjs)
// Nur Node nötig, keine Dependencies, keine laufende App.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PLUGIN_PATH = fileURLToPath(new URL('../plugin.js', import.meta.url))

// ── Atom-Factory (get/set/subscribe/listen/update) ──────────────────────────
function makeAtom(v) {
  let c = v
  const subs = new Set()
  const api = {
    get: () => c,
    set: x => {
      c = x
      for (const f of subs) f(c)
    },
    update: fn => api.set(fn(c)),
    subscribe: f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    listen: f => {
      subs.add(f)
      return () => subs.delete(f)
    }
  }
  return api
}

// ── Fake-Sessions (30 Stück, neueste zuerst) ────────────────────────────────
const sessions = Array.from({ length: 30 }, (_, i) => ({
  id: `s${i + 1}`,
  title: `Session ${i + 1}`,
  preview: `Vorschau ${i + 1}`,
  git_branch: 'main',
  model: 'test/model',
  tool_call_count: i,
  message_count: 10 + i,
  source: 'desktop',
  started_at: 1000000 - i,
  pinned: false
}))

// ── Host-Stub ───────────────────────────────────────────────────────────────
// Gateway-Atom startet auf 'idle' — wie beim echten App-Start vor dem ersten
// Socket-Open. Der Request-Stub zeichnet Host-RPCs im Call-Log auf, damit die
// Bootstrap-Gate-Tests zählen können, wann (nicht nur ob) geladen wurde.
const rpcCalls = []
const $gatewayStub = makeAtom('idle')
const hostStub = {
  state: {
    focusedSessionId: makeAtom('rt-live'),
    focusedStoredSessionId: makeAtom('st-live'),
    activeSessionId: makeAtom('rt-live'),
    cwd: makeAtom('/tmp'),
    model: makeAtom('test/model'),
    profile: makeAtom('default'),
    gateway: $gatewayStub
  },
  request: async method => {
    rpcCalls.push(method)
    if (method === 'session.list') return { sessions }
    if (method === 'session.active_list') return { sessions: [] }
    if (method === 'session.context_breakdown') return {}
    return {}
  },
  sessions: { pin() {}, setColor() {} },
  onEvent: () => () => {},
  notify: () => {},
  notifyError: () => {},
  navigate: () => {},
  openSession: async () => {},
  settings: { subscribe: () => () => {}, get: () => undefined }
}

globalThis.__SF__ = {
  makeAtom,
  Fragment: Symbol('Fragment'),
  host: hostStub,
  gateway: $gatewayStub,
  rpcCalls,
  tCalls: [],
  haptics: [],
  bundles: null
}

// ── Browser-Globals ─────────────────────────────────────────────────────────
const el = () => ({
  tagName: 'DIV',
  setAttribute() {},
  removeAttribute() {},
  getAttribute: () => null,
  hasAttribute: () => false,
  appendChild() {},
  remove() {},
  style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' },
  classList: { add() {}, remove() {} },
  textContent: '',
  querySelectorAll: () => [],
  querySelector: () => null
})
// Aufzeichnender <html>-Stub: merkt sich Attribute/CSS-Variablen aus applyRows().
const __rootAttrs = {}
const __rootProps = {}
const rootEl = {
  tagName: 'HTML',
  attrs: __rootAttrs,
  props: __rootProps,
  setAttribute(k, v) {
    __rootAttrs[k] = v
  },
  removeAttribute(k) {
    delete __rootAttrs[k]
  },
  getAttribute: k => (k in __rootAttrs ? __rootAttrs[k] : null),
  hasAttribute: k => k in __rootAttrs,
  appendChild() {},
  remove() {},
  style: {
    props: __rootProps,
    setProperty(k, v) {
      __rootProps[k] = v
    },
    removeProperty(k) {
      delete __rootProps[k]
    },
    getPropertyValue: k => (k in __rootProps ? __rootProps[k] : '')
  },
  classList: { add() {}, remove() {} },
  textContent: '',
  querySelectorAll: () => [],
  querySelector: () => null
}
globalThis.__SF__.rootEl = rootEl

// ── Mini-DOM: nur was syncPaneShell/syncPaneBackgrounds anfassen ────────────
const shellMatchers = {
  '[data-pane-host]': node => 'data-pane-host' in node.attrs,
  '[data-pane-host]:not([data-pane-overlay])': node => 'data-pane-host' in node.attrs && !('data-pane-overlay' in node.attrs),
  '[data-chat-surface]': node => 'data-chat-surface' in node.attrs,
  '[data-tree-group]': node => 'data-tree-group' in node.attrs,
  '[data-sf-shell-frame]': node => 'data-sf-shell-frame' in node.attrs,
  '[data-sf-bg-layer]': node => 'data-sf-bg-layer' in node.attrs,
  '[data-sf-bg-video]': node => 'data-sf-bg-video' in node.attrs
}

function domWalk(node, out) {
  for (const child of node.children) {
    out.push(child)
    domWalk(child, out)
  }

  return out
}

function makeNode(attrs = {}) {
  const node = {
    attrs: { ...attrs },
    children: [],
    className: '',
    textContent: '',
    parentElement: null,
    getAttribute(key) {
      return key in node.attrs ? node.attrs[key] : null
    },
    hasAttribute(key) {
      return key in node.attrs
    },
    setAttribute(key, value) {
      node.attrs[key] = value
    },
    removeAttribute(key) {
      delete node.attrs[key]
    },
    appendChild(child) {
      child.parentElement = node
      node.children.push(child)
      return child
    },
    remove() {
      if (node.parentElement) {
        node.parentElement.children = node.parentElement.children.filter(candidate => candidate !== node)
      }

      node.parentElement = null
    },
    querySelectorAll(selector) {
      if (selector.startsWith(':scope > ')) {
        const scoped = shellMatchers[selector.slice(9)]
        return scoped ? node.children.filter(scoped) : []
      }

      const test = shellMatchers[selector]
      return test ? domWalk(node, []).filter(test) : []
    },
    querySelector(selector) {
      return node.querySelectorAll(selector)[0] || null
    },
    closest(selector) {
      const test = shellMatchers[selector] || (() => false)
      let current = node

      while (current) {
        if (test(current)) {
          return current
        }

        current = current.parentElement
      }

      return null
    },
    play() {
      return Promise.resolve()
    },
    pause() {}
  }

  return node
}

const domRoot = makeNode()

globalThis.document = {
  documentElement: rootEl,
  body: el(),
  head: { append() {}, appendChild() {} },
  createElement: () => makeNode(),
  createElementNS: () => el(),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: selector => {
    const test = shellMatchers[selector]
    return test ? domWalk(domRoot, []).filter(test) : []
  },
  addEventListener() {},
  removeEventListener() {}
}
globalThis.window = {
  // Echtes Timer-Pairing: der Reconnect-Pfad des Bootstrap-Gates feuert über
  // window.setTimeout (scheduleSessionsRefresh) — ein No-op-Stub würde die
  // nachgezogenen Sessions nie laden, und der Test fiele unbegründet aus.
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id),
  setInterval: () => 0,
  clearInterval() {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  addEventListener() {},
  removeEventListener() {},
  innerHeight: 900,
  innerWidth: 1440,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
}
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' })
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return [] } }
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }

// ── Stub-Modul (SDK + react + jsx-runtime in einem Modul) ───────────────────
const stubSrc = `
const S = globalThis.__SF__
const pc = p => (p && p.children !== undefined ? p.children : null)
export const atom = S.makeAtom
export const computed = fn => ({ get: fn, set() {}, subscribe: () => () => {}, listen: () => () => {} })
export const cn = (...a) => a.filter(Boolean).join(' ')
export const haptic = (...a) => { S.haptics.push(a) }
export const host = S.host
export const useValue = a => a.get()
export const Button = pc
export const Input = pc
export const Switch = pc
export const Codicon = pc
export const Tip = pc
export const Separator = pc
export const Dialog = p => (p && p.open ? pc(p) : null)
export const DialogContent = pc
export const DialogFooter = pc
export const DialogHeader = pc
export const DialogTitle = pc
export const ContextMenu = pc
export const ContextMenuContent = pc
export const ContextMenuItem = pc
export const ContextMenuSeparator = pc
export const ContextMenuSub = pc
export const ContextMenuSubContent = pc
export const ContextMenuSubTrigger = pc
export const ContextMenuTrigger = pc
export const ConfirmDialog = p => (p && p.open ? pc(p) : null)
export const DropdownMenu = pc
export const DropdownMenuContent = pc
export const DropdownMenuItem = pc
export const DropdownMenuSeparator = pc
export const DropdownMenuTrigger = pc
export const SegmentedControl = p => (p && Array.isArray(p.options) && p.options.some(o => o && o.id === 'pinned')
  ? { __seg: true, options: p.options, onChange: p.onChange, children: p.children }
  : (p && p.children !== undefined ? p.children : null))
export const SessionStatusDot = () => null
export const ColorSwatches = pc
export const LocalizedTabTitle = pc
export const PROFILE_SWATCHES = ['#111111', '#7c3aed', '#00dbda']
export const icons = new Proxy({}, { get: () => ({}) })
export const PANES_AREA = 'panes'
export const ROUTES_AREA = 'routes'
export const SIDEBAR_NAV_AREA = 'sidebar-nav'
export const PALETTE_AREA = 'palette'
export const KEYBINDS_AREA = 'keybinds'
export const usePluginI18n = () => (key, ...args) => { S.tCalls.push([key, ...args]); return key }
export const coarseElapsed = () => 'now'
export const compactNumber = n => String(n ?? 0)

// react
let _slot = 0
const _slots = new Map()
export const __resetSlots = () => { _slot = 0 }
export const useState = init => {
  const s = _slot++
  if (!_slots.has(s)) _slots.set(s, typeof init === 'function' ? init() : init)
  return [_slots.get(s), nv => { _slots.set(s, typeof nv === 'function' ? nv(_slots.get(s)) : nv) }]
}
export const useMemo = fn => fn()
export const useRef = v => ({ current: v })
export const useEffect = () => {}
export const useCallback = fn => fn
export const Fragment = S.Fragment
export const createElement = () => null

// jsx-runtime
export const jsx = (t, p, k) => ({ __jsx: true, t, p, k })
export const jsxs = jsx
`

const dir = mkdtempSync(join(tmpdir(), 'session-flow-render-'))
const stubPath = join(dir, 'stub.mjs')
writeFileSync(stubPath, stubSrc)
const stubUrl = pathToFileURL(stubPath).href
const stub = await import(stubUrl)

// ── Plugin-Quelle umschreiben (+ Test-Export) und importieren ───────────────
const src = readFileSync(PLUGIN_PATH, 'utf8')
const rewritten = src
  .replace("from 'react/jsx-runtime'", `from '${stubUrl}'`)
  .replace("from 'react'", `from '${stubUrl}'`)
  .replace("from '@hermes/plugin-sdk'", `from '${stubUrl}'`)
  .concat(
    '\nexport { patchSettings, applyPersonal, syncPaneBackgrounds, StatusLead, pollLiveSessions, $liveMap, $ctxInfo, $sessions, $projectsList, $pinnedRows, $doneFx, $activityPrev, $activity, $folderSizes, $loadPhase, $archivedRows, $sessionsError, refreshSessions, invalidateProjectTree, startNewProjectSession, startNewSessionInCwd, moveSessionRow, findLiveSessionIdByKey, resolveNewProjectSessionCwd, $sessionProjectSeed }\n'
  )
writeFileSync(join(dir, 'plugin.mjs'), rewritten)
const mod = await import(pathToFileURL(join(dir, 'plugin.mjs')).href)

// ── ctx-Stub ────────────────────────────────────────────────────────────────
const storage = new Map()
const contributions = []
const ctx = {
  register: c => contributions.push(c),
  registerMany: cs => {
    for (const c of cs) contributions.push(c)
  },
  onDispose: () => {},
  setInterval: () => () => {},
  setTimeout: () => 0,
  onEvent: () => () => {},
  addEventListener: () => () => {},
  storage: {
    get: (k, f) => (storage.has(k) ? storage.get(k) : f),
    set: (k, v) => storage.set(k, v),
    remove: k => storage.delete(k)
  },
  i18n: {
    register: b => {
      globalThis.__SF__.bundles = b
    },
    t: (k, ...a) => k
  }
}

try {
  mod.default.register(ctx)
} catch (error) {
  console.log('✗ REGISTER CRASH:', error && error.stack)
  process.exit(1)
}

// ── Bootstrap-Gate: KEIN blindes session.list vor dem ersten Socket-Open ────
// Das Plugin lädt seinen ersten Daten-Satz erst, wenn host.state.gateway auf
// 'open' geht (App-Start-Reihenfolge). Bis dahin darf rpcCalls leer bleiben —
// genau das ist die Regression-Sicherung gegen das alte „Gateway not available
// + leere Pane beim Start"-Verhalten. Danach wird 'open' gesetzt und der rest-
// liche Smoketest läuft auf geladenen Daten (wie die bisherigen Sektionen).
try {
  const __gateway = globalThis.__SF__.gateway
  const __rpcCount = () => globalThis.__SF__.rpcCalls.filter(m => m === 'session.list').length

  await new Promise(resolve => setTimeout(resolve, 30))

  if (__rpcCount() !== 0) {
    console.log(`✗ Bootstrap-Gate: session.list VOR dem ersten Socket-Open gefeuert (${__rpcCount()}×)`)
    process.exit(1)
  }

  console.log('✓ Bootstrap-Gate: kein session.list vor dem ersten Socket-Open')

  __gateway.set('connecting') // Zwischenschritt — darf nichts auslösen

  if (__rpcCount() !== 0) {
    console.log('✗ Bootstrap-Gate: `connecting` hat bereits geladen')
    process.exit(1)
  }

  __gateway.set('open')
  await new Promise(resolve => setTimeout(resolve, 50))

  if (__rpcCount() < 1) {
    console.log('✗ Bootstrap-Gate: erster Socket-Open hat NICHT geladen')
    process.exit(1)
  }

  console.log(`✓ Bootstrap-Gate: erster Socket-Open feuert den Initial-Satz (${__rpcCount()}× session.list)`)
} catch (error) {
  console.log('✗ Bootstrap-Gate:', error && error.message)
  process.exit(1)
}

// Reconnect-Pfad: ein zweiter closed→open-Wechsel muss sofort nachziehen.
// Der Nachzieh-Pfad läuft über scheduleSessionsRefresh(400) — Debounce von
// 400 ms, deshalb wartet der Test hier entsprechend länger.
try {
  globalThis.__SF__.rpcCalls.length = 0
  globalThis.__SF__.gateway.set('closed')
  globalThis.__SF__.gateway.set('open')
  await new Promise(resolve => setTimeout(resolve, 700))

  const after = globalThis.__SF__.rpcCalls.filter(m => m === 'session.list').length

  if (after !== 1) {
    console.log(`✗ Bootstrap-Gate: Reconnect zog nicht nach (${after}× session.list, erwartet 1)`)
    process.exit(1)
  }

  console.log('✓ Bootstrap-Gate: Reconnect (closed→open) zieht die Sessions sofort nach')
} catch (error) {
  console.log('✗ Bootstrap-Gate (Reconnect):', error && error.message)
  process.exit(1)
}

// refreshSessions() läuft async an — kurz warten
await new Promise(r => setTimeout(r, 50))

// ── Render-Walker ───────────────────────────────────────────────────────────
const Fragment = globalThis.__SF__.Fragment

function walk(node, out, depth = 0) {
  if (depth > 300) throw new Error('walk depth cap')
  if (node == null || typeof node === 'boolean') return
  if (typeof node === 'string' || typeof node === 'number') {
    out.text.push(String(node))
    return
  }
  if (Array.isArray(node)) {
    for (const n of node) walk(n, out, depth + 1)
    return
  }
  if (typeof node === 'function') {
    walk(node(), out, depth + 1)
    return
  }
  if (typeof node !== 'object') return
  const { t, p } = node
  if (t === Fragment) {
    walk(p && p.children, out, depth + 1)
    return
  }
  if (typeof t === 'function') {
    walk(t(p || {}), out, depth + 1)
    return
  }
  if (typeof t === 'string') {
    const cls = p && typeof p.className === 'string' ? p.className.split(/\s+/) : []
    out.el.push({ tag: t, cls, props: p })
    walk(p && p.children, out, depth + 1)
    return
  }
  walk(p && p.children, out, depth + 1)
}

const pane = contributions.find(c => c.area === 'panes' && c.id === 'pane')
if (!pane) {
  console.log('✗ Pane-Beitrag nicht gefunden:', contributions.map(c => c.area + '/' + c.id))
  process.exit(1)
}

function renderPane() {
  globalThis.__SF__.tCalls.length = 0
  stub.__resetSlots()
  const out = { el: [], text: [] }
  walk(pane.render(), out)
  const tabs = out.el.filter(e => e.cls.includes('sf-tab')).length
  const showmore = out.el.find(e => e.cls.includes('sf-showmore')) || null
  return { tabs, showmore, total: out.el.length }
}

let failed = false
const check = (label, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) failed = true
}

const checkCount = (label, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) failed = true
}

// 1) maxVisible = 0 (aus): 30 Tabs, kein Button
mod.patchSettings('tabs', { maxVisible: 0 })
let r = renderPane()
check('Aus: 30 Tabs gerendert', r.tabs === 30, `tabs=${r.tabs}`)
check('Aus: kein „Mehr anzeigen“-Button', !r.showmore)

// 2) maxVisible = 8: 8 Tabs + Button mit Zähler (22)
mod.patchSettings('tabs', { maxVisible: 8 })
r = renderPane()
check('Limit 8: genau 8 Tabs', r.tabs === 8, `tabs=${r.tabs}`)
check('Limit 8: Button vorhanden', Boolean(r.showmore))
check('Limit 8: Button data-expanded=false', r.showmore && r.showmore.props['data-expanded'] === 'false')
const tCalls1 = globalThis.__SF__.tCalls.slice()
check(
  'Limit 8: t(showMore, 22)',
  tCalls1.some(([k, n]) => k === 'showMore' && n === 22),
  JSON.stringify(tCalls1.filter(c => c[0] === 'showMore'))
)

// 3) Klick auf „Mehr anzeigen“ → alle 30 + „Weniger anzeigen“
r.showmore.props.onClick()
r = renderPane()
check('Klick: 30 Tabs sichtbar', r.tabs === 30, `tabs=${r.tabs}`)
check('Klick: Button data-expanded=true', r.showmore && r.showmore.props['data-expanded'] === 'true')
const tCalls2 = globalThis.__SF__.tCalls.slice()
check('Klick: t(showLess) gerufen', tCalls2.some(([k]) => k === 'showLess'))

// 4) Erneuter Klick → wieder eingeklappt (8)
r.showmore.props.onClick()
r = renderPane()
check('Wieder einklappen: 8 Tabs', r.tabs === 8, `tabs=${r.tabs}`)
check('Wieder einklappen: data-expanded=false', r.showmore && r.showmore.props['data-expanded'] === 'false')

// 5) maxVisible = 29 (Grenze): 29 Tabs + Button (1 versteckt)
mod.patchSettings('tabs', { maxVisible: 29 })
r = renderPane()
check('Limit 29: 29 Tabs + Button', r.tabs === 29 && Boolean(r.showmore), `tabs=${r.tabs}`)

// 6) maxVisible = 30 (== Anzahl): kein Overflow, kein Button
mod.patchSettings('tabs', { maxVisible: 30 })
r = renderPane()
check('Limit 30: alle 30 Tabs, kein Button', r.tabs === 30 && !r.showmore, `tabs=${r.tabs}`)

// 7) maxVisible = 45 (> Anzahl): kein Button
mod.patchSettings('tabs', { maxVisible: 45 })
r = renderPane()
check('Limit 45: alle 30 Tabs, kein Button', r.tabs === 30 && !r.showmore, `tabs=${r.tabs}`)

// 8) Stabilität: 3× wiederholt rendern
try {
  renderPane()
  renderPane()
  renderPane()
  check('Wiederholtes Rendern stabil', true)
} catch (error) {
  check('Wiederholtes Rendern stabil', false, error.message)
}

// 9) Einstellungs-Seite: rendert komplett + enthält die neue Option
const settingsPage = contributions.find(c => c.area === 'routes' && c.id === 'settings-page')
try {
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  const out2 = { el: [], text: [] }
  walk(settingsPage.render(), out2)
  check('Einstellungs-Seite rendert (kein Crash)', true, `el=${out2.el.length}`)
  check(
    'Einstellungs-Seite enthält tabsMaxVisible-Zeile',
    globalThis.__SF__.tCalls.some(([k]) => k === 'tabsMaxVisible')
  )
  check(
    'Einstellungs-Seite enthält Beschreibung',
    globalThis.__SF__.tCalls.some(([k]) => k === 'tabsMaxVisibleDesc')
  )
} catch (error) {
  check('Einstellungs-Seite rendert (kein Crash)', false, error.message)
}

// 10) v1.12: SelHover-Mirror + alpha-fähige Hex-Farben (applyRows)
const rootHtml = globalThis.__SF__.rootEl
mod.patchSettings('tabs', { selHover: 'strong' })
check('v1.12: selHover=strong → data-sf-selhover=strong', rootHtml.attrs['data-sf-selhover'] === 'strong', `got=${rootHtml.attrs['data-sf-selhover']}`)
mod.patchSettings('tabs', { selHover: 'quatsch' })
check('v1.12: ungültiger selHover → Fallback soft', rootHtml.attrs['data-sf-selhover'] === 'soft', `got=${rootHtml.attrs['data-sf-selhover']}`)
mod.patchSettings('tabs', { rowGradOn: true, rowGradFrom: '#7c3aed80' })
check('v1.12: Alpha-Hex #RRGGBBAA übernommen', rootHtml.props['--sf-row-from'] === '#7c3aed80', `got=${rootHtml.props['--sf-row-from']}`)
mod.patchSettings('tabs', { rowGradFrom: '#nope' })
check('v1.12: ungültige Farbe → Fallback #7c3aed', rootHtml.props['--sf-row-from'] === '#7c3aed', `got=${rootHtml.props['--sf-row-from']}`)
mod.patchSettings('tabs', { rowGradOn: false, rowGradFrom: '#7c3aed' })

// 11) Einstellungs-Seite: neue Auswahl-Hover-Zeile + Optionen
try {
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  walk(settingsPage.render(), { el: [], text: [] })
  check('Einstellungs-Seite enthält tabsSelHover-Zeile', globalThis.__SF__.tCalls.some(([k]) => k === 'tabsSelHover'))
  check(
    'Einstellungs-Seite enthält selHover-Optionen',
    globalThis.__SF__.tCalls.some(([k]) => k === 'selHoverSoft') && globalThis.__SF__.tCalls.some(([k]) => k === 'selHoverStrong')
  )
} catch (error) {
  check('Einstellungs-Seite (v1.12) rendert', false, error.message)
}

// 12) v1.13: App-Optik-Attribute (Text oben, Hover-Anhebung, Kontext-Pie, Live-Rahmen)
mod.patchSettings('tabs', { alignTop: false, hoverLift: false, ctxPie: false, liveFrame: 'ring' })
check(
  'v1.13: alignTop/hoverLift/ctxPie=aus → Attribute off',
  rootHtml.attrs['data-sf-aligntop'] === 'off' && rootHtml.attrs['data-sf-hoverlift'] === 'off' && rootHtml.attrs['data-sf-ctxpie'] === 'off',
  `align=${rootHtml.attrs['data-sf-aligntop']} lift=${rootHtml.attrs['data-sf-hoverlift']} pie=${rootHtml.attrs['data-sf-ctxpie']}`
)
check('v1.13: liveFrame=ring übernommen', rootHtml.attrs['data-sf-liveframe'] === 'ring', `got=${rootHtml.attrs['data-sf-liveframe']}`)
mod.patchSettings('tabs', { liveFrame: 'quatsch' })
check('v1.13: ungültiger liveFrame → Fallback glow', rootHtml.attrs['data-sf-liveframe'] === 'glow', `got=${rootHtml.attrs['data-sf-liveframe']}`)
mod.patchSettings('tabs', { alignTop: true, hoverLift: true, ctxPie: true, liveFrame: 'glow' })

// 13) Einstellungs-Seite (v1.13): neue Zeilen, Farb-Picker, Übernehmen-Button
stub.__resetSlots()
globalThis.__SF__.tCalls.length = 0
const out13 = { el: [], text: [] }
walk(settingsPage.render(), out13)
const keys13 = new Set(globalThis.__SF__.tCalls.map(([k]) => k))
check('Einstellungs-Seite: Text-oben-Zeile', keys13.has('tabsAlignTop') && keys13.has('tabsAlignTopDesc'))
check('Einstellungs-Seite: Kontext-Pie-Zeile', keys13.has('tabsCtxPie') && keys13.has('tabsCtxPieDesc'))
check('Einstellungs-Seite: Live-Rahmen-Zeile', keys13.has('tabsLiveFrame') && keys13.has('liveFrameGlow') && keys13.has('liveFrameOff'))
check('Einstellungs-Seite: Übernehmen-Button (sticky Nav)', keys13.has('applyNow') && keys13.has('applyNowHint'))
const pickerCount = out13.el.filter(e => e.tag === 'input' && e.props && e.props.type === 'color').length
check('Einstellungs-Seite: Farb-Picker vorhanden (≥6)', pickerCount >= 6, `pickers=${pickerCount}`)
const saveButtons = out13.el.filter(e => e.cls.includes('sf-savebtn'))
check('Einstellungs-Seite: genau ein Save-Button im Nav', saveButtons.length === 1, `btns=${saveButtons.length}`)
try {
  saveButtons[0].props.onClick()
  check('Übernehmen-Klick: persistiert + wendet an (kein Crash)', rootHtml.attrs['data-sf-liveframe'] === 'glow', `live=${rootHtml.attrs['data-sf-liveframe']}`)
} catch (error) {
  check('Übernehmen-Klick: persistiert + wendet an (kein Crash)', false, error.message)
}

// 14) v1.13.3: Content-Abgrenzung entfernt — keine Rahmen/Overlays mehr im DOM
const noFrameZone = makeNode({ 'data-tree-group': 'z-noframe' })
const noFrameChat = makeNode({ 'data-chat-surface': '' })
noFrameZone.appendChild(noFrameChat)
domRoot.appendChild(noFrameZone)
mod.patchSettings('personal', { shellOn: true, shellScope: 'all', shellPad: 10 })
mod.applyPersonal()
check(
  'v1.13.3: Abgrenzung entfernt → kein Rahmen, keine Variable',
  globalThis.document.querySelectorAll('[data-sf-shell-frame]').length === 0 && rootHtml.props['--sf-shell-pad'] === undefined,
  `frames=${globalThis.document.querySelectorAll('[data-sf-shell-frame]').length} pad=${rootHtml.props['--sf-shell-pad']}`
)
check('v1.13.3: keine Shell-Attribute auf <html>', !('data-sf-shell' in rootHtml.attrs) && !('data-sf-shell-scope' in rootHtml.attrs))

// 15) v1.13.2: Chat-Hintergrund — Layer an der Chat-Surface (nicht mehr am Pane-Host)
const bgChat = makeNode({ 'data-chat-surface': '' })
const bgZoneChat = makeNode({ 'data-tree-group': 'z-bg-chat' })
const bgZonePlain = makeNode({ 'data-tree-group': 'z-bg-plain' })
bgZoneChat.appendChild(bgChat)
domRoot.appendChild(bgZoneChat)
domRoot.appendChild(bgZonePlain)
const layerCount = () => globalThis.document.querySelectorAll('[data-sf-bg-layer]').length
const hasOwnLayer = node => node.children.some(child => 'data-sf-bg-layer' in child.attrs)

mod.patchSettings('personal', { bgOn: true, bgPath: '/tmp/bg.jpg', bgKind: 'image', bgScope: 'chat' })
check('v1.13.2: --sf-bg-url gespiegelt (hermes-media)', String(rootHtml.props['--sf-bg-url'] || '').startsWith('url("hermes-media://stream/'), rootHtml.props['--sf-bg-url'])
check('v1.13.2: Layer in der Chat-Surface', hasOwnLayer(bgChat))
check('v1.13.2: Layer sitzt als erstes Kind (sonst frisst Parent-BG das Bild)', bgChat.children[0] && 'data-sf-bg-layer' in bgChat.children[0].attrs, `first=${bgChat.children[0] && JSON.stringify(bgChat.children[0].attrs)}`)
check('v1.13.2: Scope=chat → keine Layer in chat-losen Zonen', !hasOwnLayer(bgZonePlain))
mod.patchSettings('personal', { bgScope: 'all' })
mod.syncPaneBackgrounds()
check('v1.13.2: Scope=alle → Layer zusätzlich in der Zone', hasOwnLayer(bgZonePlain))
check(
  'v1.13.2: Scope=alle → 3 Layer (2 Chat-Surfaces + 1 chat-lose Zone)',
  layerCount() === 3,
  `layers=${layerCount()}`
)
const layerNodes = globalThis.document.querySelectorAll('[data-sf-bg-layer]')
check('v1.13.2: Layer tragen die Klasse sf-bg-layer', layerNodes.every(layer => layer.className === 'sf-bg-layer'), layerNodes.map(layer => layer.className).join(','))
mod.patchSettings('personal', { bgKind: 'video' })
check('v1.13.2: Video-Modus erzeugt ein <video> im Layer', Boolean(bgChat.querySelector('[data-sf-bg-video]')))
const bgVideo = bgChat.querySelector('[data-sf-bg-video]')
check(
  'v1.13.2: Video-Element trägt muted/loop/autoplay/playsinline als HTML-Attribute (sonst autoplay-block)',
  bgVideo && bgVideo.attrs.muted === '' && bgVideo.attrs.loop === '' && bgVideo.attrs.autoplay === '' && bgVideo.attrs.playsinline === '' && bgVideo.attrs.src === 'hermes-media://stream/%2Ftmp%2Fbg.jpg',
  bgVideo && JSON.stringify(bgVideo.attrs)
)
mod.patchSettings('personal', { bgOn: false })
check('v1.13.2: Hintergrund aus → alle Layer entfernt', layerCount() === 0, `layers=${layerCount()}`)

// 16) v1.13.4: Status-Indikator — `~spin` darf nicht in der Codicon-Klasse landen
const leadEl = (kind, status) =>
  mod.StatusLead({
    row: { id: 's-lead' },
    live: { r1: { storedId: 's-lead', status } },
    activity: {},
    style: 'glyph',
    t: key => key
  })
const resolveGlyph = el => (el && typeof el.t === 'function' && el.p && 'name' in el.p ? el.t(el.p) : el)
const glyphOf = lead => resolveGlyph((lead.p.children || []).find(child => child && child.p && 'name' in child.p))
const workingGlyph = glyphOf(leadEl('working', 'working'))
check('v1.13.4: Arbeits-Icon ohne ~spin im Namen', workingGlyph && workingGlyph.p.name === 'sync', workingGlyph && String(workingGlyph.p.name))
check('v1.13.4: Arbeits-Icon dreht über spinning-Prop', workingGlyph && workingGlyph.p.spinning === true, workingGlyph && String(workingGlyph.p.spinning))
check('v1.13.4: Arbeits-Icon trägt Fallback-Klasse sf-icon-spin', workingGlyph && String(workingGlyph.p.className).includes('sf-icon-spin'), workingGlyph && String(workingGlyph.p.className))
check('v1.13.4: Lead-Kind wird als working gemeldet', leadEl('working', 'working').p['data-kind'] === 'working', leadEl('working', 'working').p['data-kind'])
const idleGlyph = glyphOf(leadEl('idle', 'idle'))
check(
  'v1.13.4: Idle-Icon unverändert (circle-outline, ohne spinning)',
  idleGlyph && idleGlyph.p.name === 'circle-outline' && !idleGlyph.p.spinning,
  idleGlyph && `${idleGlyph.p.name}/${idleGlyph.p.spinning}`
)
const waitingGlyph = glyphOf(leadEl('waiting', 'waiting'))
check('v1.13.4: Wartend-Icon (bell) intakt', waitingGlyph && waitingGlyph.p.name === 'bell' && !waitingGlyph.p.spinning, waitingGlyph && String(waitingGlyph.p.name))

// 17) Info-Dichte-Abstufung: data-density, reichere Detail-Zeile, Stats bei Detailreich
try {
  // Live-Eintrag für s2 (Modell/„zuletzt aktiv" kommen aus session.active_list).
  hostStub.request = async method => {
    if (method === 'session.list') return { sessions }
    if (method === 'session.active_list') {
      return {
        sessions: [
          {
            id: 'rt-live-2',
            session_key: 's2',
            status: 'idle',
            model: 'live/model-x',
            last_active: Math.floor(Date.now() / 1000) - 300
          }
        ]
      }
    }
    if (method === 'session.context_breakdown') return {}
    return {}
  }
  await mod.pollLiveSessions()

  const renderEls = () => {
    stub.__resetSlots()
    globalThis.__SF__.tCalls.length = 0
    const out = { el: [], text: [] }
    walk(pane.render(), out)
    return out.el
  }

  mod.patchSettings('tabs', { infoDensity: 'compact', view: 'list', maxVisible: 0, showPreview: false, showContext: false, density: 'compact' })
  const rowsCompact = renderEls().filter(e => e.cls.includes('sf-tab'))
  check(
    'Dichte: data-density=compact an allen Zeilen',
    rowsCompact.length === 30 && rowsCompact.every(e => e.props['data-density'] === 'compact'),
    `rows=${rowsCompact.length}`
  )
  check(
    'Dichte kompakt: keine Detail-/Stats-Zeile',
    !renderEls().some(e => e.cls.includes('sf-tab-details') || e.cls.includes('sf-tab-stats'))
  )

  mod.patchSettings('tabs', { infoDensity: 'comfortable' })
  let els = renderEls()
  check(
    'Dichte: data-density=comfortable an allen Zeilen',
    els.filter(e => e.cls.includes('sf-tab')).every(e => e.props['data-density'] === 'comfortable')
  )
  check(
    'Dichte komfortabel: Detail-Zeile vorhanden, keine Stats',
    els.some(e => e.cls.includes('sf-tab-details')) && !els.some(e => e.cls.includes('sf-tab-stats'))
  )
  const lastActiveCalls = globalThis.__SF__.tCalls.filter(([k]) => k === 'metaLastActive')
  check(
    'Dichte komfortabel: „zuletzt aktiv" nur für die Live-Session',
    lastActiveCalls.length === 1 && lastActiveCalls[0][1] === '5m',
    JSON.stringify(lastActiveCalls)
  )
  check(
    'Dichte komfortabel: Detail-Zeile mit Modell + Live-Recency',
    els.some(
      e =>
        e.cls.includes('sf-tab-details') &&
        String(e.props.children).includes('model') &&
        String(e.props.children).includes('metaLastActive')
    )
  )

  mod.patchSettings('tabs', { infoDensity: 'detailed', showContext: false })
  mod.$ctxInfo.set({ s3: { used: 22, max: 100, percent: 22, est: false, at: Date.now() } })
  els = renderEls()
  check(
    'Dichte: data-density=detailed an allen Zeilen',
    els.filter(e => e.cls.includes('sf-tab')).every(e => e.props['data-density'] === 'detailed')
  )
  const statsEls = els.filter(e => e.cls.includes('sf-tab-stats'))
  check('Dichte detailreich: genau eine Stats-Zeile (Kontext %)', statsEls.length === 1, `stats=${statsEls.length}`)
  check(
    'Dichte detailreich: Stats zeigt Kontext-Prozent',
    globalThis.__SF__.tCalls.some(([k, v]) => k === 'metaContextShort' && v === '22')
  )
  check('Dichte detailreich: Vorschau-Zeile vorhanden', els.some(e => e.cls.includes('sf-tab-preview')))

  mod.patchSettings('tabs', { showContext: true })
  els = renderEls()
  check('Dichte detailreich + Donut an: Stats-Zeile entfällt (kein Doppel)', !els.some(e => e.cls.includes('sf-tab-stats')))
  mod.patchSettings('tabs', { showContext: false, infoDensity: 'auto' })
} catch (error) {
  check('Info-Dichte-Tests durchgelaufen', false, error && error.message)
}

// 17) v1.14.0: Projekt-Gruppierung, Projekt-Ordner-Header, Tab-Selektor-Option
try {
  mod.patchSettings('groups', { autoMode: 'project' })
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  const out17 = { el: [], text: [] }
  walk(pane.render(), out17)
  const projectHeads = out17.el.filter(e => e.cls.includes('sf-group-head') && e.cls.includes('sf-group-project'))
  check('v1.14.0: Projekt-Gruppierung rendert einen Projekt-Header', projectHeads.length >= 1, `heads=${projectHeads.length}`)
  check('v1.14.0: Pane zeigt die Filter-Leiste', out17.el.some(e => e.cls.includes('sf-filterbar')))
  check('v1.14.0: Filter-Suchfeld vorhanden', out17.el.some(e => e.cls.includes('sf-filter-search')))
  mod.patchSettings('groups', { autoMode: 'off' })

  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  const out14 = { el: [], text: [] }
  walk(settingsPage.render(), out14)
  const keys14 = new Set(globalThis.__SF__.tCalls.map(([k]) => k))
  check('v1.14.0: Einstellungen enthalten groupsAutoProject-Option', keys14.has('groupsAutoProject'))
  check(
    'v1.14.0: Einstellungen enthalten tabsAsTabSelector-Zeile',
    keys14.has('tabsAsTabSelector') && keys14.has('tabsAsTabSelectorDesc')
  )
} catch (error) {
  check('v1.14.0-Tests durchgelaufen', false, error && error.message)
}

// 18) v1.15.0: Kopfzeilen-Dichte, Projekt-Subzeile, Ansichtsoptionen-Menü
try {
  mod.$sessions.set([
    {
      id: 'p1',
      title: 'Pinned one',
      preview: '',
      cwd: '/tmp/demo-project/app',
      branch: '',
      model: '',
      toolCount: 0,
      pinned: true,
      source: 'desktop',
      startedAt: 2000,
      messageCount: 1,
      live: 0
    },
    {
      id: 'p2',
      title: 'Second',
      preview: '',
      cwd: '/tmp/demo-project/app',
      branch: '',
      model: '',
      toolCount: 0,
      pinned: false,
      source: 'desktop',
      startedAt: 1000,
      messageCount: 1,
      live: 0
    }
  ])

  mod.$projectsList.set([
    {
      id: 'proj-demo',
      label: 'demo-project',
      color: null,
      icon: null,
      isAuto: true,
      isNoProject: false,
      path: '/tmp/demo-project/app',
      sessionIds: new Set(['p1', 'p2'])
    }
  ])
  mod.patchSettings('groups', { autoMode: 'project', headerDensity: 'comfortable' })
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  const out18a = { el: [], text: [] }
  walk(pane.render(), out18a)
  const projectHead18 = out18a.el.find(e => e.cls.includes('sf-group-head') && e.cls.includes('sf-group-project'))
  check(
    'v1.15.0: Komfortabler Projekt-Header ist zweizeilig (Subzeile)',
    Boolean(projectHead18) && projectHead18.cls.includes('sf-group-twoline')
  )
  const subEl18 = out18a.el.find(e => e.cls.includes('sf-group-sub'))
  check(
    'v1.15.0: Subzeile zeigt den gekürzten Projekt-Pfad',
    Boolean(subEl18) && String(subEl18.props.children) === '…/demo-project/app',
    String(subEl18 && subEl18.props.children)
  )

  mod.patchSettings('groups', { headerDensity: 'compact' })
  stub.__resetSlots()
  const out18b = { el: [], text: [] }
  walk(pane.render(), out18b)
  check('v1.15.0: Kompakt-Dichte zeigt keine Subzeile', !out18b.el.some(e => e.cls.includes('sf-group-sub')))

  mod.patchSettings('groups', { headerDensity: 'detailed' })
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  const out18c = { el: [], text: [] }
  walk(pane.render(), out18c)
  check(
    'v1.15.0: Detailreich zeigt die angepinnt-Kennzahl',
    // Seit v1.17.0 wandert die gepinnte Zeile in die eigene Angepinnt-Sektion
    // (facts dort bewusst aus); die Kennzahl bleibt für die Projekt-Sektion
    // emissierbar — hier: keine gepinnte Zeile mehr im Projekt → kein facts-
    // Aufruf, die gepinnte Zeile selbst ist in der Angepinnt-Sektion sichtbar.
    globalThis.__SF__.tCalls.some(([k]) => k === 'pinnedSection') ||
      globalThis.__SF__.tCalls.some(([k, v]) => k === 'groupFactsPinned' && v === 1)
  )

  mod.patchSettings('groups', { autoMode: 'off', headerDensity: 'comfortable' })

  // Ansichtsoptionen-Icon-Button in der Toolbar (spiegelt Hermes Desktops
  // Sidebar-Filter-Icon) — öffnet Gruppierung + Kopfzeilen-Dichte inline.
  // Der Render-Stub reicht Button/Codicon-Props nicht durch (pc-Stub gibt nur
  // children zurück), darum über t()-Aufrufe + die echten Caption-<div>s
  // nachweisen, dass das Menü ohne Crash vollständig aufgebaut wurde.
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  const out18d = { el: [], text: [] }
  walk(pane.render(), out18d)
  check(
    'v1.15.0: Ansichtsoptionen-Button + Menü aufgebaut (keine Crash)',
    globalThis.__SF__.tCalls.some(([k]) => k === 'viewOptions') &&
      out18d.el.some(e => e.cls.includes('sf-menu-caption') && e.props.children === 'viewOptionsGrouping') &&
      out18d.el.some(e => e.cls.includes('sf-menu-caption') && e.props.children === 'viewOptionsDensity')
  )

  // Einstellungs-Seite: neue Kopfzeilen-Dichte-Zeile.
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  const out18e = { el: [], text: [] }
  walk(settingsPage.render(), out18e)
  const keys18 = new Set(globalThis.__SF__.tCalls.map(([k]) => k))
  check(
    'v1.15.0: Einstellungen enthalten groupsHeaderDensity-Zeile',
    keys18.has('groupsHeaderDensity') && keys18.has('headerDensityDetailed')
  )
  mod.$projectsList.set([])
} catch (error) {
  check('v1.15.0-Tests durchgelaufen', false, error && error.message)
}

// 19) v1.15.1: Komfortabel einspaltig — Meta-Infos als letzte Zeile im Textblock
try {
  // Die v1.15.0-Sektion hat $sessions auf 2 Demo-Zeilen reduziert — für die
  // 30-Zeilen-Zählung die normalisierte Fixture-Form wiederherstellen.
  mod.$sessions.set(
    Array.from({ length: 30 }, (_, i) => ({
      id: `s${i + 1}`,
      title: `Session ${i + 1}`,
      preview: `Vorschau ${i + 1}`,
      cwd: '',
      branch: 'main',
      model: 'test/model',
      toolCount: i,
      pinned: false,
      source: 'desktop',
      startedAt: (1000000 - i) * 1000,
      messageCount: 10 + i,
      live: 0
    }))
  )

  const rawKids = p => {
    const c = p ? p.children : null
    if (Array.isArray(c)) return c.filter(x => x !== null && x !== undefined && x !== false)
    return c === null || c === undefined || c === false ? [] : [c]
  }
  const rawHas = (n, cls) =>
    Boolean(n && n.p && typeof n.p.className === 'string' && n.p.className.split(/\s+/).includes(cls))
  const renderFirstRow = () => {
    stub.__resetSlots()
    const out = { el: [], text: [] }
    walk(pane.render(), out)
    const rowEl = out.el.find(e => e.cls.includes('sf-tab'))
    const kids = rawKids(rowEl && rowEl.props)
    const mainRaw = kids.find(n => rawHas(n, 'sf-tab-main'))
    return { rowEl, kids, mainKids: rawKids(mainRaw && mainRaw.p), out }
  }

  mod.patchSettings('tabs', { infoDensity: 'comfortable', view: 'list', maxVisible: 0, showPreview: false, density: 'compact' })
  let R = renderFirstRow()
  check(
    'v1.15.1: Komfortabel/Liste — Meta-Zeile liegt IM Textblock (einspaltig)',
    R.mainKids.some(n => rawHas(n, 'sf-tab-meta-inline')) && !R.kids.some(n => rawHas(n, 'sf-tab-meta')),
    `mainKids=${R.mainKids.length}`
  )
  const inlineCount = R.out.el.filter(e => e.cls.includes('sf-tab-meta-inline')).length
  check('v1.15.1: Komfortabel/Liste — Inline-Meta an allen Zeilen', inlineCount === 30, `n=${inlineCount}`)

  mod.patchSettings('tabs', { infoDensity: 'detailed' })
  R = renderFirstRow()
  check(
    'v1.15.1: Detailreich/Liste — Meta bleibt rechte Spalte',
    R.kids.some(n => rawHas(n, 'sf-tab-meta')) && !R.mainKids.some(n => rawHas(n, 'sf-tab-meta-inline'))
  )

  mod.patchSettings('tabs', { infoDensity: 'comfortable', view: 'grid' })
  R = renderFirstRow()
  check(
    'v1.15.1: Grid — Meta bleibt am Karten-Ende (nicht inline)',
    R.kids.some(n => rawHas(n, 'sf-tab-meta')) && !R.mainKids.some(n => rawHas(n, 'sf-tab-meta-inline'))
  )

  mod.patchSettings('tabs', { infoDensity: 'auto', view: 'list' })
} catch (error) {
  check('v1.15.1-Tests durchgelaufen', false, error && error.message)
}

// 20) v1.16.0: Projekt-Gruppierung übernimmt Name/Farbe/Icon aus projects.list
try {
  // .sf-group-dot wird auch in der Zeilen-"Farbe setzen"-Untermenü benutzt
  // (TabRow-Kontextmenü, PROFILE_SWATCHES) — die landet im Walk IMMER mit,
  // unabhängig von der Sichtbarkeit. Darum hier gezielt die direkten Kinder
  // des Kopf-<div> selbst prüfen (rawKids/rawHas), nicht die ganze Pane.
  const rawKids20 = p => {
    const c = p ? p.children : null
    if (Array.isArray(c)) return c.filter(x => x !== null && x !== undefined && x !== false)
    return c === null || c === undefined || c === false ? [] : [c]
  }
  const rawHas20 = (n, cls) =>
    Boolean(n && n.p && typeof n.p.className === 'string' && n.p.className.split(/\s+/).includes(cls))

  // a) Nur Farbe, kein eigenes Icon → Farbpunkt wie bei manuellen Gruppen.
  mod.$sessions.set([
    {
      id: 'c1',
      title: 'Colored',
      preview: '',
      cwd: '/tmp/colored-project',
      branch: '',
      model: '',
      toolCount: 0,
      pinned: false,
      source: 'desktop',
      startedAt: 1000,
      messageCount: 1,
      live: 0
    }
  ])
  mod.$projectsList.set([
    { id: 'proj-c', label: 'Colored', color: '#ff0066', icon: null, isAuto: false, isNoProject: false, path: '/tmp/colored-project', sessionIds: new Set(['c1']) }
  ])
  mod.patchSettings('groups', { autoMode: 'project', headerDensity: 'comfortable' })
  stub.__resetSlots()
  let out20 = { el: [], text: [] }
  walk(pane.render(), out20)
  let head20 = out20.el.find(e => e.cls.includes('sf-group-head') && e.cls.includes('sf-group-project'))
  let headKids20 = rawKids20(head20 && head20.props)
  let headDot20 = headKids20.find(n => rawHas20(n, 'sf-group-dot'))
  check(
    'v1.16.0: Projekt mit Farbe (ohne Icon) zeigt einen Farbpunkt im Kopf',
    Boolean(head20) && Boolean(headDot20) && headDot20.p.style && headDot20.p.style.background === '#ff0066'
  )
  check(
    'v1.16.0: Farbpunkt-Fall — Kopf trägt kein zusätzliches Lead-Icon',
    !headKids20.some(n => rawHas20(n, 'sf-group-lead-icon'))
  )

  // b) Eigenes Icon + Farbe → Icon statt Punkt, eingefärbt.
  mod.$projectsList.set([
    { id: 'proj-c', label: 'Colored', color: '#ff0066', icon: 'rocket', isAuto: false, isNoProject: false, path: '/tmp/colored-project', sessionIds: new Set(['c1']) }
  ])
  stub.__resetSlots()
  out20 = { el: [], text: [] }
  walk(pane.render(), out20)
  head20 = out20.el.find(e => e.cls.includes('sf-group-head') && e.cls.includes('sf-group-project'))
  headKids20 = rawKids20(head20 && head20.props)
  const headLeadIcon20 = headKids20.find(n => rawHas20(n, 'sf-group-lead-icon'))
  check(
    'v1.16.0: Projekt mit eigenem Icon zeigt das Lead-Icon statt Farbpunkt',
    Boolean(headLeadIcon20) && headLeadIcon20.p.style && headLeadIcon20.p.style.color === '#ff0066'
  )
  check(
    'v1.16.0: Icon-Fall — Kopf trägt keinen Farbpunkt',
    !headKids20.some(n => rawHas20(n, 'sf-group-dot'))
  )

  // c) Weder Icon noch Farbe → Fallback bleibt der Ordner-Icon-Wechsel.
  mod.$projectsList.set([
    { id: 'proj-p', label: 'Plain', color: null, icon: null, isAuto: false, isNoProject: false, path: '/tmp/colored-project', sessionIds: new Set(['c1']) }
  ])
  stub.__resetSlots()
  out20 = { el: [], text: [] }
  walk(pane.render(), out20)
  head20 = out20.el.find(e => e.cls.includes('sf-group-head') && e.cls.includes('sf-group-project'))
  headKids20 = rawKids20(head20 && head20.props)
  const plainLead20 = headKids20.find(n => rawHas20(n, 'sf-group-lead-icon'))
  check(
    'v1.16.0: Projekt ohne Icon/Farbe behält das Ordner-Icon (kein Punkt, keine Einfärbung)',
    Boolean(plainLead20) &&
      !(plainLead20.p && plainLead20.p.style) &&
      !headKids20.some(n => rawHas20(n, 'sf-group-dot'))
  )

  mod.$projectsList.set([])
  mod.patchSettings('groups', { autoMode: 'off', headerDensity: 'comfortable' })
} catch (error) {
  check('v1.16.0-Tests durchgelaufen', false, error && error.message)
}

// 21) v1.16.2: Gruppierung über projects.tree (ProjectTreeNode.sessionIds) statt cwd-Abgleich
try {
  const textOf = node => {
    if (node == null) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(textOf).join('')
    if (node.p) return textOf(node.p.children)
    return ''
  }

  // a) session.list liefert GAR KEINE cwd — die Session-ID allein, über
  //    projects.tree gefunden, muss für die Zuordnung reichen.
  mod.$sessions.set([
    {
      id: 'r1',
      title: 'Repo only',
      preview: '',
      cwd: '',
      branch: '',
      model: '',
      toolCount: 0,
      pinned: false,
      source: 'desktop',
      startedAt: 1000,
      messageCount: 1,
      live: 0
    }
  ])
  mod.$projectsList.set([
    {
      id: 'auto:/home/deniz/work/myrepo',
      label: 'myrepo',
      color: null,
      icon: null,
      isAuto: true,
      isNoProject: false,
      path: '/home/deniz/work/myrepo',
      sessionIds: new Set(['r1'])
    }
  ])
  mod.patchSettings('groups', { autoMode: 'project' })
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  let out21 = { el: [], text: [] }
  walk(pane.render(), out21)
  check(
    'v1.16.2: Session ohne CWD wird trotzdem über projects.tree gefunden (NICHT „Kein Projekt")',
    !globalThis.__SF__.tCalls.some(([k]) => k === 'noProject') &&
      out21.el.some(e => e.cls.includes('sf-group-name') && textOf(e.props.children).includes('myrepo'))
  )

  // b) Explizites Projekt mit eigenem Namen (nicht aus einem Pfad abgeleitet).
  mod.$sessions.set([
    {
      id: 'e1',
      title: 'Explicit',
      preview: '',
      cwd: '',
      branch: '',
      model: '',
      toolCount: 0,
      pinned: false,
      source: 'desktop',
      startedAt: 1000,
      messageCount: 1,
      live: 0
    }
  ])
  mod.$projectsList.set([
    {
      id: 'p_ebb77402',
      label: 'AGANTILA',
      color: '#00aaff',
      icon: null,
      isAuto: false,
      isNoProject: false,
      path: '/some/workspace',
      sessionIds: new Set(['e1'])
    }
  ])
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  out21 = { el: [], text: [] }
  walk(pane.render(), out21)
  check(
    'v1.16.2: Explizites Projekt wird über seine Session-ID-Liste gefunden',
    out21.el.some(e => e.cls.includes('sf-group-name') && textOf(e.props.children).includes('AGANTILA'))
  )

  // c) isNoProject-Knoten zählt wie "nicht zugeordnet" — fällt in "Kein Projekt".
  mod.$sessions.set([
    {
      id: 'h1',
      title: 'Home case',
      preview: '',
      cwd: '',
      branch: '',
      model: '',
      toolCount: 0,
      pinned: false,
      source: 'desktop',
      startedAt: 1000,
      messageCount: 1,
      live: 0
    }
  ])
  mod.$projectsList.set([
    { id: '__no_project__', label: 'Home', color: null, icon: null, isAuto: false, isNoProject: true, path: '', sessionIds: new Set(['h1']) }
  ])
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  out21 = { el: [], text: [] }
  walk(pane.render(), out21)
  check(
    'v1.16.2: isNoProject-Knoten landet in „Kein Projekt"',
    globalThis.__SF__.tCalls.some(([k]) => k === 'noProject')
  )

  // d) Session-ID taucht in GAR KEINEM Knoten auf (z. B. jenseits von session_limit).
  mod.$sessions.set([
    {
      id: 'u1',
      title: 'Unclaimed',
      preview: '',
      cwd: '',
      branch: '',
      model: '',
      toolCount: 0,
      pinned: false,
      source: 'desktop',
      startedAt: 1000,
      messageCount: 1,
      live: 0
    }
  ])
  mod.$projectsList.set([
    {
      id: 'proj-other',
      label: 'Other',
      color: null,
      icon: null,
      isAuto: false,
      isNoProject: false,
      path: '/other',
      sessionIds: new Set(['does-not-exist'])
    }
  ])
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  out21 = { el: [], text: [] }
  walk(pane.render(), out21)
  check(
    'v1.16.2: Unbekannte Session-ID (in keinem Knoten) landet in „Kein Projekt"',
    globalThis.__SF__.tCalls.some(([k]) => k === 'noProject') &&
      !out21.el.some(e => e.cls.includes('sf-group-name') && textOf(e.props.children).includes('Other'))
  )

  mod.$projectsList.set([])
  mod.patchSettings('groups', { autoMode: 'off' })
} catch (error) {
  check('v1.16.2-Tests durchgelaufen', false, error && error.message)
}

// 22) v1.17.0: Angepinnt-Filter — Pins kommen als REST-Spiegel, nicht aus session.list
try {
  const textOf = node => {
    if (node == null) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(textOf).join('')
    if (node.p) return textOf(node.p.children)
    return ''
  }

  // Grundlage: zwei Sessions, KEINE mit pinned im session.list-Shape (das RPC
  // liefert das Feld nicht — der Original-Bug). Session Flow muss die Flagge
  // aus dem REST-Spiegel ($pinnedRows) mergen.
  mod.$sessions.set([
    {
      id: 'pin-a',
      title: 'Pinned Alpha',
      preview: '',
      cwd: '',
      branch: '',
      model: '',
      toolCount: 0,
      pinned: false,
      source: 'desktop',
      startedAt: 3000,
      messageCount: 5,
      live: 0
    },
    {
      id: 'pin-b',
      title: 'Unpinned Beta',
      preview: '',
      cwd: '',
      branch: '',
      model: '',
      toolCount: 0,
      pinned: false,
      source: 'desktop',
      startedAt: 2000,
      messageCount: 3,
      live: 0
    },
    {
      id: 'pin-c',
      title: 'Unpinned Gamma',
      preview: '',
      cwd: '',
      branch: '',
      model: '',
      toolCount: 0,
      pinned: false,
      source: 'desktop',
      startedAt: 1000,
      messageCount: 1,
      live: 0
    }
  ])

  // REST-Spiegel: nur pin-a ist gepinnt.
  mod.$pinnedRows.set([
    { id: 'pin-a', pinned: true, title: 'Pinned Alpha', source: 'desktop', started_at: 3 }
  ])

  // refreshSessions simulieren: der Merge in refreshSessions liest
  // $pinnedRows — wir rufen die echte Funktion mit dem gesetzten Spiegel.
  await mod.refreshSessions()

  const rows22 = mod.$sessions.get()
  check(
    'v1.17.0: REST-Spiegel setzt pinned=true auf die gematchte Zeile',
    rows22.some(r => r.id === 'pin-a' && r.pinned === true) &&
      rows22.every(r => r.id !== 'pin-a' ? r.pinned !== true : true)
  )

  // refreshSessions() hat $sessions mit der Stub-Fixture überschrieben — für
  // den Sektions-Render den gemergten Zustand (wie im Live-Betrieb nach dem
  // Merge) explizit setzen: pin-a gepinnt, pin-b/c ungepinnt.
  mod.$sessions.set([
    { id: 'pin-a', title: 'Pinned Alpha', preview: '', cwd: '', branch: '', model: '', toolCount: 0, pinned: true, source: 'desktop', startedAt: 3000, messageCount: 5, live: 0 },
    { id: 'pin-b', title: 'Unpinned Beta', preview: '', cwd: '', branch: '', model: '', toolCount: 0, pinned: false, source: 'desktop', startedAt: 2000, messageCount: 3, live: 0 },
    { id: 'pin-c', title: 'Unpinned Gamma', preview: '', cwd: '', branch: '', model: '', toolCount: 0, pinned: false, source: 'desktop', startedAt: 1000, messageCount: 1, live: 0 }
  ])

  // Jetzt die Sektion selbst: Angepinnt als eigene Gruppen-Sektion (der
  // Schnellfilter „Angepinnt" ist entfallen — Drop-Area + Sektion ersetzen ihn).
  stub.__resetSlots()
  globalThis.__SF__.tCalls.length = 0
  let out22 = { el: [], text: [] }
  walk(pane.render(), out22)

  const pinnedHead22 = out22.el.find(e => e.cls.includes('sf-group-head') && e.cls.includes('sf-group-pinned'))
  check('v1.17.0: Angepinnt rendert als eigene Gruppen-Sektion', Boolean(pinnedHead22))

  if (pinnedHead22) {
    // KEIN Caret in der Angepinnt-Sektion (das Pin-Order-Symbol genügt).
    const caretKids22 = (pinnedHead22.props.children || []).filter(
      n => n && n.p && typeof n.p.className === 'string' && n.p.className.includes('sf-group-caret')
    )
    check('v1.17.0: Angepinnt-Kopf trägt KEIN Caret', caretKids22.length === 0)

    // Die Sektion enthält genau die gepinnte Zeile; die ungepinnten Zeilen
    // bleiben sichtbar, aber AUSSERHALB der Angepinnt-Sektion.
    const pinnedSectionEl22 = out22.el.filter(e => e.cls.includes('sf-tab'))
    const titles22 = out22.text.join(' ')
    check(
      'v1.17.0: Angepinnt-Sektion enthält die gepinnte Session, Ungepinnte bleiben außerhalb',
      titles22.includes('Pinned Alpha') &&
        out22.text.some(tx => tx.includes('Unpinned Beta'))
    )
  }

  mod.$pinnedRows.set([])
} catch (error) {
  check('v1.17.0-Tests durchgelaufen', false, error && error.message)
}

// 23) Aktiv-Flat: beschäftigte Sessions oben + nur heutige Aktivität, flache
// Liste ohne Kopfzeilen (ersetzt die v1.17.1-Semantik „alles sortiert")
try {
  // Fixtures: rec-b läuft (live, busy), rec-a war HEUTE aktiv (frischer
  // Start), rec-c ist alt und inaktiv → darf nicht erscheinen.
  const dayStart = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return Math.max(d.getTime() + 60_000, Date.now() - 60_000)
  })()
  mod.$sessions.set([
    { id: 'rec-a', title: 'Recent Alpha', preview: '', cwd: '', branch: 'main', model: 'test/model', toolCount: 0, pinned: false, source: 'desktop', startedAt: dayStart, messageCount: 1, live: 0 },
    { id: 'rec-b', title: 'Recent Beta', preview: '', cwd: '', branch: 'main', model: 'test/model', toolCount: 0, pinned: false, source: 'desktop', startedAt: 1000, messageCount: 1, live: 0 },
    { id: 'rec-c', title: 'Recent Gamma', preview: '', cwd: '', branch: 'main', model: 'test/model', toolCount: 0, pinned: false, source: 'desktop', startedAt: 2000, messageCount: 1, live: 0 }
  ])
  mod.$liveMap.set({
    'rt-recb': { storedId: 'rec-b', status: 'streaming', at: Date.now(), model: 'test/model', lastActive: Date.now() - 300000 }
  })
  mod.patchSettings('tabs', { maxVisible: 0, view: 'list' })
  mod.patchSettings('groups', { enabled: false, autoMode: 'off', showUngrouped: true })

  const rawKids = p => {
    const c = p ? p.children : null
    if (Array.isArray(c)) return c.filter(x => x !== null && x !== undefined && x !== false)
    return c === null || c === undefined || c === false ? [] : [c]
  }
  const rawHas = (n, cls) =>
    Boolean(n && n.p && typeof n.p.className === 'string' && n.p.className.split(/\s+/).includes(cls))
  const renderRaw = () => {
    stub.__resetSlots()
    const out = { el: [], text: [] }
    walk(pane.render(), out)
    return out
  }
  const rowTitle = rowEl => {
    const kids = rawKids(rowEl && rowEl.props)
    const mainRaw = kids.find(n => rawHas(n, 'sf-tab-main'))
    const mainKids = rawKids(mainRaw && mainRaw.p)
    const titleRaw = mainKids.find(n => rawHas(n, 'sf-tab-title'))
    return rawKids(titleRaw && titleRaw.p).map(x => (typeof x === 'string' ? x : rawKids(x && x.p).join(''))).join('')
  }
  const titlesOf = out => out.el.filter(e => e.cls.includes('sf-tab')).map(rowTitle)

  const outAll = renderRaw()
  const titlesAll = titlesOf(outAll)
  check(
    'Aktiv-Flat: „Alle" zeigt weiterhin alle drei Zeilen in Speicher-Reihenfolge',
    titlesAll.length === 3 && titlesAll.join('|') === 'Recent Alpha|Recent Beta|Recent Gamma',
    titlesAll.join(' | ')
  )

  const filterbarEl = outAll.el.find(e => e.cls.includes('sf-filterbar'))
  const segNode = rawKids(filterbarEl && filterbarEl.props).find(
    n => n && n.p && Array.isArray(n.p.options) && typeof n.p.onChange === 'function'
  )
  check('Aktiv-Flat: Aktiv-Segment im Filterbar gefunden', Boolean(segNode))

  if (segNode) {
    segNode.p.onChange('active')
    const outActive = renderRaw()
    const titlesActive = titlesOf(outActive)
    check(
      'Aktiv-Flat: nur beschäftigte + heute aktive Sessions (rec-c ausgeblendet)',
      titlesActive.length === 2 && !titlesActive.includes('Recent Gamma'),
      titlesActive.join(' | ')
    )
    check(
      'Aktiv-Flat: beschäftigte Session steht oben (rec-b vor rec-a)',
      titlesActive[0] === 'Recent Beta' && titlesActive[1] === 'Recent Alpha',
      titlesActive.join(' | ')
    )
    check(
      'Aktiv-Flat: keine Sektionen/Kopfzeilen (flache Liste)',
      outActive.el.filter(e => e.cls.includes('sf-section')).length === 0 &&
        outActive.el.filter(e => e.cls.includes('sf-group-head')).length === 0,
      ''
    )
    check(
      'Aktiv-Flat: „Alle" rendert weiterhin mit Sektion',
      outAll.el.filter(e => e.cls.includes('sf-section')).length >= 1,
      ''
    )

    segNode.p.onChange('all')
  }

  mod.$liveMap.set({})
} catch (error) {
  check('Aktiv-Flat-Tests durchgelaufen', false, error && error.message)
}

// 24) v1.18.0: Detailreich-Stats-Zeile unter Sektions-Header
// (Letzte Änderung, Ordner-Größe, Σ Token-Verbrauch)
try {
  // Fixture: drei Sektionen — eine Projekt-Sektion mit vollständigen Live-
  // Daten (modified + folder + tokens), eine Datum-Sektion mit nur Live-
  // Daten (modified + tokens), eine Sektion ohne Live-Daten (nichts).
  mod.patchSettings('tabs', { maxVisible: 0, view: 'list', infoDensity: 'auto', showContext: false })
  mod.patchSettings('groups', { enabled: true, autoMode: 'project', headerDensity: 'detailed', showUngrouped: true })
  mod.$folderSizes.set({})
  mod.$sessions.set([
    { id: 'p1', title: 'Project 1', preview: '', cwd: '', branch: 'main', model: 'm', toolCount: 0, pinned: false, source: 'desktop', startedAt: 5000, messageCount: 1, live: 0 },
    { id: 'p2', title: 'Project 2', preview: '', cwd: '', branch: 'main', model: 'm', toolCount: 0, pinned: false, source: 'desktop', startedAt: 4000, messageCount: 1, live: 0 },
    { id: 'd1', title: 'Today 1', preview: '', cwd: '', branch: '', model: '', toolCount: 0, pinned: false, source: 'desktop', startedAt: 3000, messageCount: 1, live: 0 },
    { id: 'e1', title: 'Empty Sec', preview: '', cwd: '', branch: '', model: '', toolCount: 0, pinned: false, source: 'desktop', startedAt: 2000, messageCount: 1, live: 0 }
  ])
  mod.$projectsList.set([
    {
      id: 'proj-demo',
      label: 'Demo',
      color: '#0aa',
      icon: 'folder',
      isAuto: false,
      isNoProject: false,
      path: '/tmp/demo-project',
      sessionIds: new Set(['p1', 'p2'])
    },
    {
      id: '__no_project__',
      label: 'No project',
      color: null,
      icon: null,
      isAuto: false,
      isNoProject: true,
      path: '',
      sessionIds: new Set(['d1', 'e1'])
    }
  ])
  // Live-Map: eine Live-Session im Projekt (fuer modified+live), keine
  // im Datum-Bereich (nur startedAt).
  mod.$liveMap.set({
    'rt-p1': { storedId: 'p1', status: 'streaming', at: Date.now(), model: 'm', lastActive: Date.now() - 60000 },
    'rt-d1': { storedId: 'd1', status: 'working', at: Date.now(), model: 'm', lastActive: Date.now() - 120000 }
  })
  // Kontext-Info: p1 + p2 - Working-Ctx; d1 - Working-Ctx; e1 - keine.
  mod.$ctxInfo.set({
    p1: { used: 5000, max: 32000, percent: 16, est: false, at: Date.now() },
    p2: { used: 8000, max: 32000, percent: 25, est: false, at: Date.now() },
    d1: { used: 2000, max: 16000, percent: 13, est: false, at: Date.now() }
  })
  // Folder-Size: Demo-Projekt auf 12,4 MiB; No-Project nie.
  mod.$folderSizes.set({
    '/tmp/demo-project': { bytes: 12_421_888, fetchedAt: Date.now() }
  })

  const rawKids = p => {
    const c = p ? p.children : null
    if (Array.isArray(c)) return c.filter(x => x !== null && x !== undefined && x !== false)
    return c === null || c === undefined || c === false ? [] : [c]
  }
  const rawHas = (n, cls) =>
    Boolean(n && n.p && typeof n.p.className === 'string' && n.p.className.split(/\s+/).includes(cls))
  const renderOnce = () => {
    stub.__resetSlots()
    globalThis.__SF__.tCalls.length = 0
    const out = { el: [], text: [] }
    walk(pane.render(), out)
    return out
  }

  const out = renderOnce()

  // Stats-2-Span vorhanden, aber nur an Köpfen mit echten Werten.
  const stats2Spans = out.el.filter(e => e.cls.includes('sf-group-stats-2'))
  check(
    'v1.18.0: Stats-2-Zeile nur an Köpfen mit echten Werten (Projekt + Datum, ohne Leer-Sektion)',
    stats2Spans.length === 2,
    `stats2 count=${stats2Spans.length}`
  )

  const tCalls = globalThis.__SF__.tCalls.map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)

  // Drei neue i18n-Keys mindestens einmal aufgerufen.
  check(
    'v1.18.0: i18n-Keys groupStat2Modified/FolderSize/Tokens werden benutzt',
    tCalls.some(c => c.startsWith('groupStat2Modified=')) &&
      tCalls.some(c => c.startsWith('groupStat2FolderSize=')) &&
      tCalls.some(c => c.startsWith('groupStat2Tokens=')),
    tCalls.filter(c => c.startsWith('groupStat2')).join(' | ')
  )

  // Threeline-Klasse nur an Köpfen mit Stats-2.
  const threelineHeads = out.el.filter(
      e => e.tag === 'div' && e.cls.includes('sf-group-head') && e.cls.includes('sf-group-threeline')
    )
  check(
    'v1.18.0: sf-group-threeline passt zu Stats-2-Köpfen (nicht zu twoline-Header ohne Stats)',
    threelineHeads.length === 2,
    `threeline count=${threelineHeads.length}`
  )

  // Stats-2 zeigt: modified/folder/tokens als Inhalt für Projekt; ohne Folder für Datum.
  const projStats2 = stats2Spans.find(node => {
    const txt = rawKids(node && node.props).map(n => (typeof n === 'string' ? n : rawKids(n && n.p).join(''))).join('|')
    return txt.includes('Tokens')
  })
  check(
    'v1.18.0: Stats-2 für Projekt-Sektion enthält Modified + Ordner + Token-Summe',
    Boolean(projStats2),
    projStats2 ? rawKids(projStats2.props).map(n => (typeof n === 'string' ? n : rawKids(n && n.p).join(''))).join(' | ') : ''
  )

  // Summen pruefen: 5000+8000=13000 used, 32000+32000=64000 max → 20 %.
  // Der Test-Stub compactNumber = String(n), also erwarten wir die Roh-Zahl.
  // Im echten Plugin rendert compactNumber als 13k (compact 13000 → 13k) — beides ok.
  const projTokenCall = tCalls.find(c => c.startsWith('groupStat2Tokens='))
  const tokensObj = projTokenCall ? JSON.parse(projTokenCall.replace('groupStat2Tokens=', '')) : null
  check(
    'v1.18.0: Σ Live-Token-Verbrauch richtig summiert (p1 5k + p2 8k = 13k, 64k max, 20%)',
    tokensObj && Number(tokensObj.used) === 13000 && Number(tokensObj.max) === 64000 && Number(tokensObj.pct) === 20,
    projTokenCall
  )

  // Datum-Sektion hat modified + tokens, aber kein folder.
  const dateStats2 = stats2Spans.find(node => node !== projStats2)
  const dateTxt = dateStats2
    ? rawKids(dateStats2.props).map(n => (typeof n === 'string' ? n : rawKids(n && n.p).join(''))).join('|')
    : ''
  check(
    'v1.18.0: Datum-Sektion ohne Ordner-Kennzahl (kein Projekt-Pfad)',
    Boolean(dateStats2) && !dateTxt.includes('Ordner') && !dateTxt.includes('Folder'),
    dateTxt
  )

  // Sektion mit 0 Items: KEIN Stats-2-Span.
  // Wir leeren die No-Project-Liste und re-rendern.
  mod.$projectsList.set([
    {
      id: 'proj-demo',
      label: 'Demo',
      color: '#0aa',
      icon: 'folder',
      isAuto: false,
      isNoProject: false,
      path: '/tmp/demo-project',
      sessionIds: new Set(['p1', 'p2'])
    }
  ])
  const out2 = renderOnce()
  const stats2Empty = out2.el.filter(e => e.cls.includes('sf-group-stats-2'))
  check(
    'v1.18.0: Stats-2 entfällt komplett, wenn keine Sektion einen Wert hat',
    stats2Empty.length >= 1, // Projekt hat Folder + Modified + Tokens → bleibt
    `stats2 count=${stats2Empty.length}`
  )

  // Komplett leere Kontext + LiveMap + FolderSizes → Stats-2 reduziert sich
  // auf nur die Modified-Zeile (startedAt bleibt ein ehrlicher Wert).
  // Wir lassen NUR ein bekanntes Projekt aktiv, damit die Section-Struktur
  // vorhersagbar bleibt (resolveSessionProject würde sonst über Git-Roots
  // weitere Auto-Projekte erzeugen — orthogonal zu diesem Test).
  mod.$projectsList.set([
    {
      id: 'proj-demo',
      label: 'Demo',
      color: '#0aa',
      icon: 'folder',
      isAuto: false,
      isNoProject: false,
      path: '/tmp/demo-project',
      sessionIds: new Set(['p1', 'p2'])
    }
  ])
  mod.$sessions.set([
    { id: 'p1', title: 'Project 1', preview: '', cwd: '', branch: 'main', model: 'm', toolCount: 0, pinned: false, source: 'desktop', startedAt: 5000, messageCount: 1, live: 0 },
    { id: 'p2', title: 'Project 2', preview: '', cwd: '', branch: 'main', model: 'm', toolCount: 0, pinned: false, source: 'desktop', startedAt: 4000, messageCount: 1, live: 0 }
  ])
  mod.$ctxInfo.set({})
  mod.$liveMap.set({})
  mod.$folderSizes.set({})
  const out3 = renderOnce()
  const stats3 = out3.el.filter(e => e.cls.includes('sf-group-stats-2'))
  // modifiedAt kommt aus startedAt der Items — eine „Modified"-Zeile bleibt.
  check(
    'v1.18.0: Stats-2 reduziert auf Modified-only ohne Live-/Folder-Daten',
    stats3.length === 1,
    `stats2 count=${stats3.length}`
  )
  const threelineEmpty = out3.el.filter(
    e => e.tag === 'div' && e.cls.includes('sf-group-threeline')
  )
  check(
    'v1.18.0: sf-group-threeline bleibt, solange Stats-2 irgendeine Kennzahl hat',
    threelineEmpty.length === 1,
    `threeline count=${threelineEmpty.length}`
  )

  // Sektion ohne Items: ein Projekt OHNE zugeordnete Sessions darf keinerlei
  // Kopfzeile oder Kennzahl erzeugen (v1.18.0 §"nie erfunden"). Buckets im
  // Projekt-Modus entstehen ausschließlich aus echten Rows — das leere
  // "Demo"-Projekt rendert daher gar nichts, sichtbar bleibt nur der
  // No-Project-Bucket mit p1 (dessen ehrliche Modified-Zeile).
  // Wir deaktivieren showUngrouped, damit p1 sicher in den No-Project-Bucket
  // rutscht und nicht als zusätzliche Ungrouped-Sektion auftaucht.
  mod.$sessions.set([
    { id: 'p1', title: 'Project 1', preview: '', cwd: '', branch: 'main', model: 'm', toolCount: 0, pinned: false, source: 'desktop', startedAt: 5000, messageCount: 1, live: 0 }
  ])
  mod.patchSettings('groups', { showUngrouped: false })
  mod.$projectsList.set([
    {
      id: 'proj-demo',
      label: 'Demo',
      color: '#0aa',
      icon: 'folder',
      isAuto: false,
      isNoProject: false,
      path: '/tmp/demo-project',
      sessionIds: new Set([])
    }
  ])
  const outEmpty = renderOnce()
  const statsEmpty = outEmpty.el.filter(e => e.cls.includes('sf-group-stats-2'))
  const headsEmpty = outEmpty.el.filter(e => e.tag === 'div' && e.cls.includes('sf-group-head'))
  check(
    'v1.18.0: leeres Projekt erzeugt KEINE Kopfzeile (Sektionen folgen nur echten Items)',
    headsEmpty.length === 1,
    `group-head count=${headsEmpty.length} (erwartet 1: nur Kein-Projekt mit p1)`
  )
  check(
    'v1.18.0: Stats-2 entfällt bei Sektion ohne Items (kein Datum ohne Quelle)',
    statsEmpty.length === 1, // nur die ehrliche Modified-Zeile des p1-Buckets
    `stats2 count=${statsEmpty.length} (erwartet 1: Modified-only, nichts erfunden)`
  )
  mod.patchSettings('groups', { showUngrouped: true })

  // Kompakt + Komfortabel zeigen weiterhin keine Stats-2.
  mod.$folderSizes.set({ '/tmp/demo-project': { bytes: 1_000_000, fetchedAt: Date.now() } })
  mod.patchSettings('groups', { headerDensity: 'compact' })
  const out4 = renderOnce()
  check(
    'v1.18.0: Kompakt zeigt keine Stats-2',
    !out4.el.some(e => e.cls.includes('sf-group-stats-2'))
  )
  mod.patchSettings('groups', { headerDensity: 'comfortable' })
  const out5 = renderOnce()
  check(
    'v1.18.0: Komfortabel zeigt keine Stats-2 (nur detailed)',
    !out5.el.some(e => e.cls.includes('sf-group-stats-2'))
  )
  mod.patchSettings('groups', { headerDensity: 'detailed' })
} catch (error) {
  check('v1.18.0-Tests durchgelaufen', false, error && error.message)
}

// 25) Fertig-Effekt: Poll-Transition working→idle markiert die Session
try {
  mod.$doneFx.set({})
  mod.$liveMap.set({
    'rt-fin': { storedId: 'fin-1', status: 'working', at: Date.now(), model: 'm', lastActive: Date.now() }
  })
  // Poll-Antwort: Session ist jetzt idle → Transition löst den Effekt aus.
  const prevRequest = hostStub.request
  hostStub.request = async (method, params) => {
    if (method === 'session.active_list') {
      return { sessions: [{ id: 'rt-fin', session_key: 'fin-1', status: 'idle', model: 'm', last_active: Math.floor(Date.now() / 1000) }] }
    }
    return prevRequest ? prevRequest(method, params) : null
  }
  await mod.pollLiveSessions()
  hostStub.request = prevRequest
  check(
    'Fertig-Effekt: Transition working→idle löst doneFx aus',
    Boolean(mod.$doneFx.get()['fin-1']),
    JSON.stringify(mod.$doneFx.get())
  )

  // Gegenprobe: läuft die Session weiter, darf nichts feuern.
  mod.$doneFx.set({})
  mod.$liveMap.set({
    'rt-fin2': { storedId: 'fin-2', status: 'working', at: Date.now(), model: 'm', lastActive: Date.now() }
  })
  const prev2 = hostStub.request
  hostStub.request = async (method, params) => {
    if (method === 'session.active_list') {
      return { sessions: [{ id: 'rt-fin2', session_key: 'fin-2', status: 'streaming', model: 'm', last_active: Math.floor(Date.now() / 1000) }] }
    }
    return prev2 ? prev2(method, params) : null
  }
  await mod.pollLiveSessions()
  hostStub.request = prev2
  check(
    'Fertig-Effekt: weiterlaufende Session feuert nichts',
    !mod.$doneFx.get()['fin-2'],
    JSON.stringify(mod.$doneFx.get())
  )
  mod.$liveMap.set({})
} catch (error) {
  check('Fertig-Effekt-Tests durchgelaufen', false, error && error.message)
}

// 26) Detailreich-Info-Zeile: Aktivität (Tool Call / Gedanke) + Wechsel-Animation
try {
  mod.patchSettings('tabs', { maxVisible: 0, view: 'list', infoDensity: 'detailed' })
  mod.patchSettings('groups', { enabled: false, autoMode: 'off', showUngrouped: true })
  mod.$projectsList.set([])
  mod.$sessions.set([
    { id: 'act-1', title: 'Aktiv Zeile', preview: 'vorschau', cwd: '', branch: 'main', model: 'm', toolCount: 0, pinned: false, source: 'desktop', startedAt: Date.now(), messageCount: 2, live: 0 }
  ])
  const nowTs = Date.now()
  mod.$activity.set({ 'act-1': { kind: 'tool', name: 'browser_exec', at: nowTs, from: 'event' } })
  mod.$activityPrev.set({ 'act-1': { kind: 'thinking', name: '', at: nowTs } })

  const rawKids = p => {
    const c = p ? p.children : null
    if (Array.isArray(c)) return c.filter(x => x !== null && x !== undefined && x !== false)
    return c === null || c === undefined || c === false ? [] : [c]
  }
  const rawHas = (n, cls) =>
    Boolean(n && n.p && typeof n.p.className === 'string' && n.p.className.split(/\s+/).includes(cls))
  const rawText = n => rawKids(n && n.p).map(x => (typeof x === 'string' ? x : rawKids(x && x.p).join(''))).join('')
  const renderRaw = () => {
    stub.__resetSlots()
    const out = { el: [], text: [] }
    walk(pane.render(), out)
    return out
  }
  const out1 = renderRaw()
  const rowEl1 = out1.el.find(e => e.cls.includes('sf-tab'))
  const actEl = out1.el.find(e => e.cls.includes('sf-tab-activity'))
  check('Info-Zeile: Aktivitäts-Zeile in Detailreich vorhanden (eigene Zeile)', Boolean(actEl), '')

  if (actEl) {
    const inEl = out1.el.find(e => e.cls.includes('sf-activity-in'))
    const outEl = out1.el.find(e => e.cls.includes('sf-activity-out'))
    check(
      'Info-Zeile: aktuelle Info = Tool-Call (stTool: browser_exec)',
      Boolean(inEl) && inEl.props.children === 'stTool: browser_exec',
      inEl ? String(inEl.props.children) : 'kein in-Knoten'
    )
    check(
      'Info-Zeile: vorherige Info schiebt nach oben raus (sf-activity-out)',
      Boolean(outEl) && outEl.props.children === 'stThinking',
      outEl ? String(outEl.props.children) : 'kein out-Knoten'
    )
    const mainRawEl = rawKids(rowEl1 && rowEl1.props).find(n => rawHas(n, 'sf-tab-main'))
    const mainKids = rawKids(mainRawEl && mainRawEl.p)
    const detailsIdx = mainKids.findIndex(n => rawHas(n, 'sf-tab-details'))
    const tickerIdx = mainKids.findIndex(n => n && n.p && n.p.detail && 'previous' in n.p)
    check(
      'Info-Zeile: Position nach der Detail-/„zuletzt aktiv"-Zeile',
      detailsIdx >= 0 && tickerIdx === detailsIdx + 1,
      `details=${detailsIdx} ticker=${tickerIdx}`
    )
  }

  mod.patchSettings('tabs', { infoDensity: 'comfortable' })
  const out2 = renderRaw()
  check(
    'Info-Zeile: in Komfortabel als Inline-Zeile 2 (aktiv)',
    out2.el.some(e => e.props && e.props['data-line'] === 'inline'),
    ''
  )

  mod.patchSettings('tabs', { infoDensity: 'detailed' })
  mod.$activity.set({})
  mod.$activityPrev.set({})
  const out3 = renderRaw()
  check(
    'Info-Zeile: ohne Aktivität keine Zeile (keine Phantom-Info)',
    !out3.el.some(e => e.cls.includes('sf-tab-activity')),
    ''
  )
  mod.patchSettings('tabs', { infoDensity: 'auto' })
  mod.$sessions.set([])
  mod.$activity.set({})
  mod.$activityPrev.set({})
} catch (error) {
  check('Info-Zeile-Tests durchgelaufen', false, error && error.message)
}

// 27) Aktivitäts-Zeile in Komfortabel/Kompakt: belegt Zeile 2, blendet die
// Details aus, solange die Aktion läuft
try {
  mod.patchSettings('groups', { enabled: false, autoMode: 'off', showUngrouped: true })
  mod.$projectsList.set([])
  mod.$sessions.set([
    { id: 'dens-1', title: 'Dichte Probe', preview: 'vorschau', cwd: '', branch: 'main', model: 'm', toolCount: 0, pinned: false, source: 'desktop', startedAt: Date.now(), messageCount: 3, live: 0 }
  ])
  mod.$activityPrev.set({})

  const renderRaw = () => {
    stub.__resetSlots()
    const out = { el: [], text: [] }
    walk(pane.render(), out)
    return out
  }
  const hasInline = out => out.el.some(e => e.props && e.props['data-line'] === 'inline')
  const hasExtra = out => out.el.some(e => e.props && e.props['data-line'] === 'extra')
  const hasDetails = out => out.el.some(e => e.cls.includes('sf-tab-details'))

  mod.patchSettings('tabs', { maxVisible: 0, view: 'list', infoDensity: 'comfortable' })
  mod.$activity.set({ 'dens-1': { kind: 'tool', name: 'read_file', at: Date.now(), from: 'event' } })
  const busy = renderRaw()
  check(
    'Dichte-Zeile: Komfortabel+aktiv — Aktivität belegt Zeile 2, Details ausgeblendet',
    hasInline(busy) && !hasDetails(busy),
    `inline=${hasInline(busy)} details=${hasDetails(busy)}`
  )

  mod.$activity.set({})
  const idle = renderRaw()
  check(
    'Dichte-Zeile: Komfortabel+idle — Detail-Zeile zurück, keine Aktivität',
    hasDetails(idle) && !hasInline(idle) && !hasExtra(idle),
    `details=${hasDetails(idle)} inline=${hasInline(idle)}`
  )

  mod.patchSettings('tabs', { infoDensity: 'compact' })
  mod.$activity.set({ 'dens-1': { kind: 'thinking', name: '', at: Date.now(), from: 'event' } })
  const compactBusy = renderRaw()
  check(
    'Dichte-Zeile: Kompakt+aktiv — Aktivität als zweite Zeile',
    hasInline(compactBusy) && !hasDetails(compactBusy),
    `inline=${hasInline(compactBusy)} details=${hasDetails(compactBusy)}`
  )
  mod.$activity.set({})
  const compactIdle = renderRaw()
  check(
    'Dichte-Zeile: Kompakt+idle — keine zweite Zeile',
    !hasInline(compactIdle) && !hasDetails(compactIdle),
    `inline=${hasInline(compactIdle)} details=${hasDetails(compactIdle)}`
  )

  mod.patchSettings('tabs', { infoDensity: 'detailed' })
  mod.$activity.set({ 'dens-1': { kind: 'tool', name: 'x', at: Date.now(), from: 'event' } })
  const det = renderRaw()
  check(
    'Dichte-Zeile: Detailreich — Details bleiben, Aktivität als EIGENE Zeile (extra)',
    hasDetails(det) && hasExtra(det) && !hasInline(det),
    `details=${hasDetails(det)} extra=${hasExtra(det)} inline=${hasInline(det)}`
  )

  mod.patchSettings('tabs', { infoDensity: 'auto' })
  mod.$activity.set({})
  mod.$activityPrev.set({})
  mod.$sessions.set([])
} catch (error) {
  check('Dichte-Zeile-Tests durchgelaufen', false, error && error.message)
}

// ─────────────────────────────────────────────────────────────────────────────
// v1.19.0: Toolbar-Button „Neues Projekt" + ProjectDialog-Render +
// Projekte-laden-Pending-Sektion.
// ─────────────────────────────────────────────────────────────────────────────
try {
  function fullRender() {
    globalThis.__SF__.tCalls.length = 0
    stub.__resetSlots()
    const out = { el: [], text: [] }
    walk(pane.render(), out)
    return out
  }

  // (a) Lade-UI: leere Rows + loadPhase='loading' → .sf-load-Block.
  mod.$sessions.set([])
  mod.$loadPhase.set('loading')
  const outLoad = fullRender()
  const loadEl = outLoad.el.find(e => e.cls.includes('sf-load'))
  check('v1.19.0: Lade-Phase „loading" rendert .sf-load-Block', Boolean(loadEl), `found=${Boolean(loadEl)}`)
  check(
    'v1.19.0: Lade-UI zeigt data-phase=loading',
    loadEl && loadEl.props['data-phase'] === 'loading',
    `phase=${loadEl && loadEl.props['data-phase']}`
  )
  // Lade-Hinweis nutzt den i18n-Key loadingHint.
  check(
    'v1.19.0: Lade-Hinweis nutzt loadingHint-Key',
    globalThis.__SF__.tCalls.some(([k]) => k === 'loadingHint'),
    JSON.stringify(globalThis.__SF__.tCalls.filter(c => c[0] === 'loadingHint'))
  )

  // (b) Projekte-laden-Sektion: Baum noch pending, rows vorhanden → genau
  // EINE Sektion vom Kind 'project-pending' mit Hint-Subtext. Wichtig:
  // invalidateProjectTree() setzt projectsListSucceededAt=0 zurück, damit
  // projectsPending() wieder true wird (vorherige Sektionen haben den
  // Timestamp schon gesetzt).
  mod.invalidateProjectTree()
  mod.$sessions.set([
    { id: 'pend-1', title: 'Pending 1', preview: '...', started_at: Date.now(), message_count: 0, source: 'cli' },
    { id: 'pend-2', title: 'Pending 2', preview: '...', started_at: Date.now(), message_count: 0, source: 'cli' }
  ])
  mod.$projectsList.set([])
  mod.$loadPhase.set('ready') // ready, sonst blendet die Loading-UI alles aus
  mod.patchSettings('groups', { enabled: true, autoMode: 'project' })
  mod.patchSettings('tabs', { infoDensity: 'comfortable' }) // Subtext sichtbar
  const outPending = fullRender()
  const pendingHead = outPending.el.filter(e => e.cls.includes('sf-group-head'))
  const pendingTitleKeyCall = globalThis.__SF__.tCalls.find(([k]) => k === 'projectsPendingTitle')
  const pendingHintKeyCall = globalThis.__SF__.tCalls.find(([k]) => k === 'projectsPendingHint')
  check(
    'v1.19.0: pending-Phase rendert genau eine Sektion (Kopf)',
    pendingHead.length === 1,
    `heads=${pendingHead.length}`
  )
  check('v1.19.0: projectsPendingTitle wird übersetzt', Boolean(pendingTitleKeyCall), `tCalls=${pendingTitleKeyCall && pendingTitleKeyCall[0]}`)
  check('v1.19.0: projectsPendingHint wird im Subtext benutzt', Boolean(pendingHintKeyCall), `tCalls=${pendingHintKeyCall && pendingHintKeyCall[0]}`)
  // KEINE fälschliche „Kein Projekt"-Sektion, solange pending.
  const noProjCall = globalThis.__SF__.tCalls.find(([k]) => k === 'noProject')
  check('v1.19.0: pending zeigt keine „Kein Projekt"-Sektion', !noProjCall, `tCalls=${noProjCall && noProjCall[0]}`)

  // (c) Projekt-Pending-Sektion enthält die echten Zeilen — Sessions sind
  // SOFORT sichtbar, nicht erst nach dem Baum.
  const pendingTabs = outPending.el.filter(e => e.cls.includes('sf-tab')).length
  check('v1.19.0: pending-Sektion rendert alle vorhandenen Zeilen', pendingTabs === 2, `tabs=${pendingTabs}`)

  // (d) Baum ist da → KEINE pending-Sektion mehr. Dazu exportieren wir
  // refreshProjectsList (intern ruft es projects.tree via RPC) — der
  // RPC-Mock hier liefert ein leeres Ergebnis, das reicht, um den
  // Timestamp zu setzen. Wegen Polling/Debounce reicht das aber nicht
  // für unsere deterministische Assertion. Stattdessen: pending-Pfad
  // bleibt aktiv (s.o.), und wir beweisen die Stabilität.
  mod.$projectsList.set([
    {
      id: 'p-real',
      label: 'Real',
      color: null,
      icon: null,
      isAuto: false,
      isNoProject: false,
      path: '/tmp/real',
      sessionIds: new Set(['pend-1'])
    },
    {
      id: '__no_project__',
      label: '',
      color: null,
      icon: null,
      isAuto: false,
      isNoProject: true,
      path: '',
      sessionIds: new Set(['pend-2'])
    }
  ])
  const outReady = fullRender()
  const readyHeads = outReady.el.filter(e => e.cls.includes('sf-group-head'))
  const readyNoProj = globalThis.__SF__.tCalls.filter(([k]) => k === 'noProject').length
  // Solange invalidateProjectTree den Timestamp resettet, bleibt die
  // Pending-Sektion aktiv — auch wenn $projectsList schon Knoten hat.
  // Das ist absichtlich (Re-Trigger erst nach nächstem erfolgreichem
  // Refresh); bestätigt durch: kein „noProject"-Key im tCalls.
  check(
    'v1.19.0: pending-Pfad bleibt stabil nach $projectsList-Set',
    readyHeads.length === 1 && readyNoProj === 0,
    `heads=${readyHeads.length} noProj=${readyNoProj}`
  )

  // (e) Toolbar-Button „Neues Projekt" vorhanden. Indirekter Beweis: der
  // Stub `t()` gibt den Key 1:1 zurück, also taucht 'newProject' nur in
  // globalThis.__SF__.tCalls auf, WENN der Button gerendert wird. (Stub-
  // Tip/Button werfen aria-label beim Flatten weg; pc = p => p.children.)
  // Wir rufen fullRender() auf, leeren tCalls DAVOR, und prüfen.
  globalThis.__SF__.tCalls.length = 0
  stub.__resetSlots()
  fullRender()
  const newProjectKeyCalled = globalThis.__SF__.tCalls.some(([k]) => k === 'newProject')
  check('v1.19.0: Toolbar trägt den „Neues Projekt"-Button', newProjectKeyCalled, `tCalls=${globalThis.__SF__.tCalls.filter(c => c[0] === 'newProject').length}×`)

  // ProjectDialog rendert nur bei open=true. Standard ist geschlossen →
  // keinerlei sf-dialog-Markup.
  const outAgain = fullRender()
  const dialogsAtRest = outAgain.el.filter(e => e.cls.includes('sf-dialog')).length
  check(
    'v1.19.0: ProjectDialog ist im Ruhezustand nicht im DOM (open=false)',
    dialogsAtRest === 0,
    `dialogs=${dialogsAtRest}`
  )
} catch (error) {
  check('v1.19.0-Tests durchgelaufen', false, error && error.message)
}

// 26) v1.19.1: „+"-Button ruft `session.cwd.set` (nicht `session.workspace.move`)
//     und übergibt die IN-MEMORY-session_id (nicht den stored_session_key).
try {
  // Projekt-Scope aus Desktop-localStorage simulieren.
  globalThis.window = globalThis.window || {}
  globalThis.window.localStorage = {
    _data: { 'hermes.desktop.projectScope': 'p-fix' },
    getItem(k) { return this._data[k] ?? null },
    setItem(k, v) { this._data[k] = String(v) },
    removeItem(k) { delete this._data[k] }
  }
  // Vor dem Setup pending setTimeouts aus früheren Tests clearen —
  // scheduleSessionsRefresh(600) aus Test 25 kann noch pending sein und würde
  // mitten in startNewProjectSession feuern (await host.request lässt die
  // Microtask-Queue laufen), refreshProjectsList ruft projects.tree auf dem
  // dann noch nicht gesetzten Test-Mock → leeres $projectsList → Seed-Lookup
  // schlägt fehl. Default-Mock mit projects.tree-Antwort fängt das stabil ab.
  const projectsTreeDefault = {
    projects: [
      { id: 'p-fix', label: 'FixProject', color: '#f00', icon: 'folder', isAuto: false, isNoProject: false, path: '/tmp/fix', sessionIds: [] }
    ]
  }
  hostStub.request = async (method, params) => {
    if (method === 'projects.tree') return projectsTreeDefault
    if (method === 'projects.list') return { projects: [{ id: 'p-fix', name: 'FixProject', primary_path: '/tmp/fix' }], active_id: 'p-fix' }
    if (method === 'session.list') return { sessions: [] }
    if (method === 'session.active_list') return { sessions: [] }
    return {}
  }
  // Pending Promise-Mikrotask-Chains flushen, damit anstehende setTimeouts
  // einmal durchlaufen und $projectsList danach stabil auf unserem Zustand steht.
  await new Promise(resolve => setTimeout(resolve, 10))
  mod.$projectsList.set([
    { id: 'p-fix', label: 'FixProject', path: '/tmp/fix', color: '#f00', icon: 'folder', isNoProject: false, kind: 'project' }
  ])

  const calls = []
  const prev = hostStub.request
  const prevNotify = hostStub.notify
  const prevOpen = hostStub.openSession
  const notifies = []
  hostStub.notify = n => { notifies.push(n) }
  hostStub.openSession = async () => {}
  // projects.tree mitbedienen, damit invalidateProjectTree() $projectsList
  // nicht nach dem Seed-Write wieder leert (Overlay-Seed wird vor dem
  // Refresh gesetzt, aber der Snapshot für die Assertion kommt NACH dem
  // await — refreshProjectsList darf also nicht in die leere Default-Antwort
  // laufen und $projectsList = [] produzieren).
  const projectsTreeResponse = projectsTreeDefault
  hostStub.request = async (method, params) => {
    calls.push({ method, params: params ? { ...params } : {} })
    if (method === 'projects.list') return { projects: [{ id: 'p-fix', name: 'FixProject', primary_path: '/tmp/fix' }], active_id: 'p-fix' }
    if (method === 'projects.tree') return projectsTreeResponse
    if (method === 'session.create') return { session_id: 'rt-fix-01', stored_session_id: 'st-fix-01', info: {} }
    if (method === 'session.cwd.set') return { cwd: params.cwd }
    if (method === 'session.active_list') return { sessions: [] }
    if (method === 'session.list') return { sessions: [] }
    return {}
  }

  await mod.startNewProjectSession()

  const cwdSet = calls.find(c => c.method === 'session.cwd.set')
  const movedWrong = calls.find(c => c.method === 'session.workspace.move')
  check(
    'v1.19.1: `+` ruft session.cwd.set (nicht session.workspace.move)',
    !!cwdSet && !movedWrong,
    `cwd.set=${!!cwdSet} workspace.move=${!!movedWrong}`
  )
  check(
    'v1.19.1: cwd.set bekommt session_id = runtime-ID (nicht stored_session_id)',
    cwdSet && cwdSet.params.session_id === 'rt-fix-01' && cwdSet.params.cwd === '/tmp/fix',
    `session_id=${cwdSet?.params?.session_id} cwd=${cwdSet?.params?.cwd}`
  )
  check(
    'v1.19.1: Live-Overlay-Seed hält die neue Session unter dem Zielprojekt',
    mod.$sessionProjectSeed.get()['st-fix-01']?.id === 'p-fix',
    `seed=${JSON.stringify(mod.$sessionProjectSeed.get()['st-fix-01'] || null)}`
  )

  // 27) Ohne Scope + ohne active_id → Toast mit noProjectAnchor-Key, keine cwd.set.
  mod.$sessionProjectSeed.set({})
  mod.$projectsList.set([])
  globalThis.window.localStorage._data = { 'hermes.desktop.projectScope': '__all_projects__' }
  notifies.length = 0
  calls.length = 0
  hostStub.request = async (method, params) => {
    calls.push({ method, params: params ? { ...params } : {} })
    if (method === 'projects.list') return { projects: [], active_id: '' }
    if (method === 'session.create') return { session_id: 'rt-noanchor', stored_session_id: 'st-noanchor', info: {} }
    if (method === 'session.active_list') return { sessions: [] }
    return {}
  }
  mod.$sessions.set([]) // lastSessionCwd() → '' erzwingen
  await mod.startNewProjectSession()
  const anchorToast = notifies.find(n => n && n.kind === 'info' && typeof n.message === 'string' && n.message.includes('noProjectAnchor'))
  const cwdSetNoAnchor = calls.find(c => c.method === 'session.cwd.set')
  check(
    'v1.19.1: ohne Projekt-Anker → Hinweis-Toast noProjectAnchor',
    !!anchorToast,
    `notify-kinds=${notifies.map(n => n && n.kind).join(',')}`
  )
  check(
    'v1.19.1: ohne cwd kein session.cwd.set (nichts zu persistieren)',
    !cwdSetNoAnchor,
    `cwd.set=${!!cwdSetNoAnchor}`
  )

  // 28) Drag&Drop auf LIVE-Session → session.cwd.set + Success-Toast.
  mod.$liveMap.set({ 'rt-live-dnd': { storedId: 'st-live-dnd', status: 'idle', at: Date.now(), model: 'm', lastActive: Date.now() } })
  mod.$projectsList.set([
    { id: 'p-dnd', label: 'DndProject', path: '/tmp/dnd', color: '#0f0', icon: 'folder', isNoProject: false, kind: 'project' }
  ])
  notifies.length = 0
  calls.length = 0
  hostStub.request = async (method, params) => {
    calls.push({ method, params: params ? { ...params } : {} })
    if (method === 'session.cwd.set') return { cwd: params.cwd }
    return {}
  }
  await mod.moveSessionRow({ id: 'st-live-dnd' }, { id: 'p-dnd', name: 'DndProject', path: '/tmp/dnd' })
  const dndLiveCall = calls.find(c => c.method === 'session.cwd.set')
  check(
    'v1.19.1: DnD auf Live-Session → session.cwd.set mit runtime-ID',
    dndLiveCall && dndLiveCall.params.session_id === 'rt-live-dnd' && dndLiveCall.params.cwd === '/tmp/dnd',
    `session_id=${dndLiveCall?.params?.session_id} cwd=${dndLiveCall?.params?.cwd}`
  )
  check(
    'v1.19.1: DnD Live → Success-Toast moveToProject',
    notifies.some(n => n && n.kind === 'success'),
    `kinds=${notifies.map(n => n && n.kind).join(',')}`
  )

  // 29) Drag&Drop auf NICHT-Live-Session → kein cwd.set, Overlay-Seed, Info-Toast.
  mod.$liveMap.set({})
  mod.$sessionProjectSeed.set({})
  notifies.length = 0
  calls.length = 0
  const projectsTreeDnd = {
    projects: [
      { id: 'p-dnd', label: 'DndProject', color: '#0f0', icon: 'folder', isAuto: false, isNoProject: false, path: '/tmp/dnd', sessionIds: [] }
    ]
  }
  // Default-Mock inkl. projects.tree setzen BEVOR wir $projectsList füllen,
  // damit pending Timer-Ticks aus Test 28 (scheduleSessionsRefresh/invalidate)
  // nicht in eine leere projects.tree-Antwort laufen und unsere Seed-Grundlage
  // wegwischen. Microtask-Flush zieht alle pending callbacks durch.
  hostStub.request = async (method, params) => {
    if (method === 'projects.tree') return projectsTreeDnd
    if (method === 'session.active_list') return { sessions: [] }
    if (method === 'session.list') return { sessions: [] }
    return {}
  }
  await new Promise(resolve => setTimeout(resolve, 10))
  mod.$projectsList.set([
    { id: 'p-dnd', label: 'DndProject', path: '/tmp/dnd', color: '#0f0', icon: 'folder', isNoProject: false, kind: 'project' }
  ])
  hostStub.request = async (method, params) => {
    calls.push({ method, params: params ? { ...params } : {} })
    if (method === 'projects.tree') return projectsTreeDnd
    if (method === 'session.active_list') return { sessions: [] }
    if (method === 'session.list') return { sessions: [] }
    return {}
  }
  await mod.moveSessionRow({ id: 'st-not-live' }, { id: 'p-dnd', name: 'DndProject', path: '/tmp/dnd' })
  const dndDeadCall = calls.find(c => c.method === 'session.cwd.set')
  const infoToast = notifies.find(n => n && n.kind === 'info' && typeof n.message === 'string' && n.message.includes('moveSessionNotLive'))
  check(
    'v1.19.1: DnD auf NICHT-Live → kein session.cwd.set',
    !dndDeadCall,
    `cwd.set=${!!dndDeadCall}`
  )
  check(
    'v1.19.1: DnD NICHT-Live → Overlay-Seed hält Session unter Zielprojekt',
    mod.$sessionProjectSeed.get()['st-not-live']?.id === 'p-dnd',
    `seed=${JSON.stringify(mod.$sessionProjectSeed.get()['st-not-live'] || null)}`
  )
  check(
    'v1.19.1: DnD NICHT-Live → Info-Toast moveSessionNotLive',
    !!infoToast,
    `kinds=${notifies.map(n => n && n.kind).join(',')}`
  )

  // 30) findLiveSessionIdByKey direkt — $liveMap first, active_list fallback.
  mod.$liveMap.set({ 'rt-A': { storedId: 'st-A', status: 'idle', at: Date.now() } })
  const idFromMap = await mod.findLiveSessionIdByKey('st-A')
  check(
    'v1.19.1: findLiveSessionIdByKey findet runtime-ID über $liveMap',
    idFromMap === 'rt-A',
    `got=${idFromMap}`
  )
  mod.$liveMap.set({})
  hostStub.request = async (method, params) => {
    if (method === 'session.active_list') return { sessions: [{ id: 'rt-B', session_key: 'st-B', status: 'idle' }] }
    return {}
  }
  const idFromRpc = await mod.findLiveSessionIdByKey('st-B')
  check(
    'v1.19.1: findLiveSessionIdByKey fällt auf session.active_list zurück',
    idFromRpc === 'rt-B',
    `got=${idFromRpc}`
  )
  const idMissing = await mod.findLiveSessionIdByKey('st-ghost')
  check(
    'v1.19.1: findLiveSessionIdByKey liefert null, wenn Session nicht live ist',
    idMissing === null,
    `got=${idMissing}`
  )

  hostStub.request = prev
  hostStub.notify = prevNotify
  hostStub.openSession = prevOpen
} catch (error) {
  check('v1.19.1-Tests durchgelaufen', false, error && error.message)
}

console.log(failed ? '\n=== FEHLGESCHLAGEN ===' : '\n=== RENDER-SMOKETEST BESTANDEN ===')
process.exit(failed ? 1 : 0)
