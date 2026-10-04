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
const hostStub = {
  state: {
    focusedSessionId: makeAtom('rt-live'),
    focusedStoredSessionId: makeAtom('st-live'),
    activeSessionId: makeAtom('rt-live'),
    cwd: makeAtom('/tmp'),
    model: makeAtom('test/model'),
    profile: makeAtom('default')
  },
  request: async method => {
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
  setTimeout: () => 0,
  clearTimeout() {},
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
export const SegmentedControl = pc
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
    '\nexport { patchSettings, applyPersonal, syncPaneBackgrounds, StatusLead, pollLiveSessions, $liveMap, $ctxInfo, $sessions }\n'
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

console.log(failed ? '\n=== FEHLGESCHLAGEN ===' : '\n=== RENDER-SMOKETEST BESTANDEN ===')
process.exit(failed ? 1 : 0)
