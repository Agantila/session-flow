/**
 * Session Flow — Hermes Desktop Plugin
 * ====================================
 *
 * Drei Features, alle in den Plugin-Einstellungen anpassbar:
 *
 *  1. CHAT-ANIMATION — Antworten werden "Zeile für Zeile" mit Easing eingeblendet.
 *     • Beim Laden/Wechsel eines Chats: die sichtbaren Zeilen kaskadieren von oben
 *       nach unten (gestaffelte Verzögerung, konfigurierbare Stärke/Dauer/Easing).
 *     • Beim Streamen: jede Zeile animiert genau einmal, sobald sie "fertig" ist
 *       (d.h. wenn die nächste Zeile erscheint bzw. der Stream endet).
 *     Nutzt ausschließlich die Web Animations API auf den stabilen Markdown-
 *     Blöcken — keine CSS-Keyframes auf Parser-erzeugten Elementen (bekanntes
 *     Flacker-Problem bei streamendem Markdown). respektiert immer
 *     `prefers-reduced-motion`.
 *
 *  2. STRG+SCROLL — Session-Zyklus. Mit gedrückter Zusatztaste (Standard: Ctrl)
 *     und Mausrad durch die aktiven Sessions scrollen. Optionales HUD zeigt
 *     Position + Titel. Zoom-Flächen (Bilder, Monaco, Canvas) bleiben unberührt.
 *
 *  3. SESSION-TABS-PANE — Firefox-artige Tab-Gruppen:
 *     • Session-Liste als kompakte Tabs mit Aktivitäts-Icon (arbeitet / denkt /
 *       Tool läuft / wartet auf Antwort / fertig-ungelesen / Fehler / idle).
 *     • Manuelle Gruppen mit Name + Farbe (wie Firefox Tab Groups), Collapse
 *       mit "Stack"-Optik (spine/fanned/pill), Drag & Drop zum Einsortieren.
 *     • Optional automatische Gruppierung (nach Datum oder Source).
 *     • Öffnen per Klick, Kontextmenü (Rechtsklick) für Gruppen/Pin/Farbe.
 *
 * Install: Datei nach `$HERMES_HOME/desktop-plugins/session-flow/plugin.js`
 * kopieren (Ordnername == Plugin-id!). Das Repo liefert `install.sh` dafür.
 * Das Plugin wird zur Laufzeit als reines ESM geladen — kein Build, und jede
 * Speicherung des Files hot-reloaded es in der App.
 *
 * Regelwerk dieses Files:
 *  - Nur `@hermes/plugin-sdk`, `react`, `react/jsx-runtime` sind importierbar.
 *  - Kein JSX (wird nicht kompiliert) — `jsx()` / `jsxs()` von react/jsx-runtime.
 *  - Keine hartkodierten Farben — nur Theme-Variablen (`var(--ui-*)`, `--chrome-*`).
 *  - Alle Timers/Listener/Avatare laufen über `ctx` (Dispose-sicher); DOM-
 *    Observer + injizierte Styles werden über `ctx.onDispose` abgeräumt.
 *
 * Lizenz: MIT. Siehe README.md im Repo.
 */

import * as SDK from '@hermes/plugin-sdk'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

// ─────────────────────────────────────────────────────────────────────────────
// SDK-Deskriptoren (Namespace-Import + Destrukturierung: fehlt ein neuerer
// Export in älteren Builds, lädt das Plugin trotzdem — nur der betroffene
// Teil degradiert, statt dass der Import stirbt.)
// ─────────────────────────────────────────────────────────────────────────────

const {
  atom,
  computed,
  cn,
  haptic,
  host,
  useValue,
  Button,
  Input,
  Switch,
  Codicon,
  Tip,
  Separator,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  SegmentedControl,
  SessionStatusDot,
  ColorSwatches,
  PROFILE_SWATCHES,
  LocalizedTabTitle,
  usePluginI18n,
  coarseElapsed,
  compactNumber,
  icons,
  PANES_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  PALETTE_AREA,
  KEYBINDS_AREA,
  ListRow: SDKListRow,
  ToggleRow: SDKToggleRow
} = SDK

const ID = 'session-flow'
const VERSION = '1.1.0'
const SETTINGS_KEY = 'settings.v1'
const GROUPS_KEY = 'groups.v1'

/** Modul-globaler Kontext; in register() gesetzt, von Komponenten benutzt. */
let CTX = null

// ─────────────────────────────────────────────────────────────────────────────
// Einstellungen — Schema, Defaults, Store
// ─────────────────────────────────────────────────────────────────────────────

const EASINGS = {
  smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
  soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
  gentle: 'cubic-bezier(0.33, 1, 0.68, 1)',
  back: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
}

const DEFAULT_SETTINGS = {
  animation: {
    enabled: true,
    historyCascade: true,
    streamReveal: true,
    durationMs: 320,
    staggerMs: 55,
    maxStaggerSteps: 24,
    travelPx: 10,
    easing: 'soft',
    skipReasoning: true,
    includeCode: true,
    includeLists: true
  },
  wheel: {
    enabled: true,
    modifier: 'ctrl',
    threshold: 40,
    cooldownMs: 200,
    invert: false,
    wrap: true,
    hud: true,
    hudMs: 1100,
    ignoreSelector: ''
  },
  tabs: {
    density: 'compact',
    statusStyle: 'glyph',
    showTime: true,
    showPreview: false,
    showCounts: false,
    showSource: true,
    showProfile: false,
    openIntent: 'in-place',
    maxItems: 60,
    hideCron: true,
    livePollSec: 30,
    refreshSec: 45
  },
  groups: {
    enabled: true,
    autoMode: 'off',
    stackStyle: 'spine',
    showUngrouped: true
  },
  glass: {
    enabled: true,
    blurPx: 10,
    saturate: 115,
    tint: 8,
    fill: 86,
    gradient: true,
    angle: 165,
    gradOpacity: 12,
    reach: 72,
    ring: true,
    scopes: { composer: true, chips: true, statusbar: false }
  }
}

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** Rekursives Merge für kleine Schema-Bäume (persistierte Settings über Defaults). */
function deepMerge(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? base : patch
  }

  const out = { ...base }

  for (const [key, value] of Object.entries(patch)) {
    out[key] = key in base ? deepMerge(base[key], value) : value
  }

  return out
}

const $settings = atom(DEFAULT_SETTINGS)

let settingsSaveTimer = 0

function scheduleSettingsSave() {
  window.clearTimeout(settingsSaveTimer)
  settingsSaveTimer = window.setTimeout(() => {
    try {
      CTX?.storage?.set(SETTINGS_KEY, $settings.get())
    } catch (error) {
      console.warn(`[${ID}] settings save failed`, error)
    }
  }, 350)
}

function loadSettings() {
  let saved = null

  try {
    saved = CTX?.storage?.get(SETTINGS_KEY, null)
  } catch {
    saved = null
  }

  $settings.set(deepMerge(DEFAULT_SETTINGS, isPlainObject(saved) ? saved : {}))
}

/** Patcht eine Sektion (z.B. 'wheel', {enabled:false}) und persistiert. */
function patchSettings(section, patch) {
  const current = $settings.get()
  $settings.set({ ...current, [section]: { ...current[section], ...patch } })
  scheduleSettingsSave()
}

function resetSettings() {
  $settings.set(deepMerge(DEFAULT_SETTINGS, {}))
  scheduleSettingsSave()
}

function readSetting(section, key) {
  const value = $settings.get()[section]
  return value ? value[key] : undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// Glass & Lesbarkeit — Frost + Akzent-Verlauf für Eingabefeld und UI-Chips
// ─────────────────────────────────────────────────────────────────────────────
//
// Rein deklarativ: die Einstellungen werden als Attribute + Custom Properties
// auf <html> gespiegelt (data-sf-glass="composer chips …"), das Stylesheet
// reagiert ausschließlich per CSS-Selektor darauf. Es wird also nie CSS neu
// gebaut — nur Variablen gesetzt. Kein backdrop-filter mit !important, damit
// der app-weite „Transparenz reduzieren"-Gate unangetastet bleibt.

const SF_GLASS_VARS = [
  '--sf-glass-blur',
  '--sf-glass-sat',
  '--sf-glass-tint',
  '--sf-glass-fill',
  '--sf-glass-angle',
  '--sf-glass-grad',
  '--sf-glass-reach'
]

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

/** Entfernt Attribut + Variablen wieder vollständig (Dispose / deaktiviert). */
function clearGlass() {
  const root = document.documentElement
  root.removeAttribute('data-sf-glass')
  for (const name of SF_GLASS_VARS) root.style.removeProperty(name)
}

function applyGlass() {
  const glass = $settings.get().glass || {}

  try {
    if (!glass.enabled) {
      clearGlass()
      return
    }

    const root = document.documentElement
    const tokens = []

    if (glass.scopes?.composer) tokens.push('composer')
    if (glass.scopes?.chips) tokens.push('chips')
    if (glass.scopes?.statusbar) tokens.push('statusbar')
    if (!glass.gradient) tokens.push('nograd')
    if (!glass.ring) tokens.push('noring')

    root.setAttribute('data-sf-glass', tokens.join(' ') || 'none')
    root.style.setProperty('--sf-glass-blur', `${clampNumber(glass.blurPx, 0, 40, 10)}px`)
    root.style.setProperty('--sf-glass-sat', `${clampNumber(glass.saturate, 100, 200, 115)}%`)
    root.style.setProperty('--sf-glass-tint', `${clampNumber(glass.tint, 0, 40, 8)}%`)
    root.style.setProperty('--sf-glass-fill', `${clampNumber(glass.fill, 50, 94, 86)}%`)
    root.style.setProperty('--sf-glass-angle', `${clampNumber(glass.angle, 0, 360, 165)}deg`)
    root.style.setProperty('--sf-glass-grad', `${clampNumber(glass.gradOpacity, 0, 60, 12)}%`)
    root.style.setProperty('--sf-glass-reach', `${clampNumber(glass.reach, 20, 100, 72)}%`)
  } catch (error) {
    console.warn(`[${ID}] glass apply failed`, error)
    clearGlass()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gruppen-Store (manuelle Firefox-artige Tab-Gruppen + Collapse-Zustände)
// ─────────────────────────────────────────────────────────────────────────────

const $groupsState = atom({ groups: [], assign: {}, collapsed: {} })

let groupsSaveTimer = 0

function scheduleGroupsSave() {
  window.clearTimeout(groupsSaveTimer)
  groupsSaveTimer = window.setTimeout(() => {
    try {
      CTX?.storage?.set(GROUPS_KEY, $groupsState.get())
    } catch (error) {
      console.warn(`[${ID}] groups save failed`, error)
    }
  }, 350)
}

function loadGroups() {
  let saved = null

  try {
    saved = CTX?.storage?.get(GROUPS_KEY, null)
  } catch {
    saved = null
  }

  $groupsState.set({
    groups: Array.isArray(saved?.groups) ? saved.groups : [],
    assign: isPlainObject(saved?.assign) ? saved.assign : {},
    collapsed: isPlainObject(saved?.collapsed) ? saved.collapsed : {}
  })
}

let groupSeq = 0

function newGroupId() {
  groupSeq += 1
  return `g${Date.now().toString(36)}${groupSeq.toString(36)}`
}

function createGroup(name, color) {
  const state = $groupsState.get()
  const trimmed = String(name || '').trim() || 'Gruppe'
  const group = { id: newGroupId(), name: trimmed, color: color || null, createdAt: Date.now() }
  $groupsState.set({ ...state, groups: [...state.groups, group] })
  scheduleGroupsSave()
  return group
}

function updateGroup(groupId, patch) {
  const state = $groupsState.get()
  $groupsState.set({
    ...state,
    groups: state.groups.map(group => (group.id === groupId ? { ...group, ...patch } : group))
  })
  scheduleGroupsSave()
}

function deleteGroup(groupId) {
  const state = $groupsState.get()
  const assign = {}

  for (const [sessionId, target] of Object.entries(state.assign)) {
    if (target !== groupId) {
      assign[sessionId] = target
    }
  }

  $groupsState.set({
    ...state,
    groups: state.groups.filter(group => group.id !== groupId),
    assign
  })
  scheduleGroupsSave()
}

function assignSession(sessionId, groupId) {
  const state = $groupsState.get()
  const assign = { ...state.assign }

  if (groupId) {
    assign[sessionId] = groupId
  } else {
    delete assign[sessionId]
  }

  // Verwaiste Zuweisungen (Session weg) bei Gelegenheit aufräumen lassen.
  $groupsState.set({ ...state, assign })
  scheduleGroupsSave()
}

function toggleSectionCollapsed(key) {
  const state = $groupsState.get()
  const collapsed = { ...state.collapsed, [key]: !state.collapsed[key] }
  $groupsState.set({ ...state, collapsed })
  scheduleGroupsSave()
}

function resetGroups() {
  $groupsState.set({ groups: [], assign: {}, collapsed: {} })
  scheduleGroupsSave()
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions-Store — Liste (session.list), Live-Status (session.active_list),
// Aktivitäts-Details (Gateway-Events)
// ─────────────────────────────────────────────────────────────────────────────

const $sessions = atom([])
const $sessionsError = atom(null)
const $liveMap = atom({}) // runtimeId -> { storedId, status, at }
const $activity = atom({}) // storedId -> { kind, name, at }

let refreshInFlight = null

function normalizeRow(row) {
  const id = String(row?.id || '')
  return {
    id,
    title: String(row?.title || '').trim(),
    preview: String(row?.preview || '').trim(),
    source: String(row?.source || '').trim(),
    startedAt: Number(row?.started_at || 0) * 1000,
    messageCount: Number(row?.message_count || 0),
    live: Number(row?.live_message_count || 0)
  }
}

async function refreshSessions() {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    try {
      const limit = Math.max(10, Math.min(200, Number(readSetting('tabs', 'maxItems')) || 60))
      const result = await host.request('session.list', { limit, include_hidden: false })
      const raw = Array.isArray(result?.sessions) ? result.sessions : Array.isArray(result) ? result : []
      const rows = raw
        .map(normalizeRow)
        .filter(row => row.id)
        .sort((a, b) => b.startedAt - a.startedAt)
      $sessions.set(rows)
      $sessionsError.set(null)
    } catch (error) {
      $sessionsError.set(error instanceof Error ? error.message : String(error))
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

let refreshDebounce = 0

function scheduleSessionsRefresh(delay = 1500) {
  window.clearTimeout(refreshDebounce)
  refreshDebounce = window.setTimeout(() => {
    void refreshSessions()
  }, delay)
}

async function pollLiveSessions() {
  try {
    const result = await host.request('session.active_list', {})
    const items = Array.isArray(result?.sessions) ? result.sessions : []
    const next = {}
    const now = Date.now()

    for (const item of items) {
      const runtimeId = String(item?.id || '')
      const storedId = String(item?.session_key || '')
      const status = String(item?.status || 'idle')

      if (runtimeId && storedId) {
        next[runtimeId] = { storedId, status, at: now }
      }
    }

    $liveMap.set(next)

    // Live-Status in Aktivitäts-Details spiegeln (Events haben Vorrang).
    const activity = { ...$activity.get() }

    for (const [runtimeId, info] of Object.entries(next)) {
      const mapped =
        info.status === 'waiting'
          ? 'waiting'
          : info.status === 'streaming'
            ? 'streaming'
            : info.status === 'working' || info.status === 'starting' || info.status === 'resuming'
              ? 'working'
              : null

      if (!mapped) {
        continue
      }

      const existing = activity[info.storedId]

      if (!existing || now - existing.at > 60_000 || existing.kind === 'done' || existing.kind === 'error') {
        activity[info.storedId] = { kind: mapped, name: '', at: now, from: 'live' }
      }
    }

    $activity.set(activity)
  } catch {
    // Poll ist best-effort; Events liefern die schnellen Updates.
  }
}

/** Aktivitäts-Details altern lassen (Timer im Controller). */
function expireActivity() {
  const activity = $activity.get()
  const now = Date.now()
  let changed = false
  const next = {}

  for (const [storedId, info] of Object.entries(activity)) {
    const ttl = info.kind === 'done' || info.kind === 'error' ? 10 * 60_000 : 90_000

    if (now - info.at < ttl) {
      next[storedId] = info
    } else {
      changed = true
    }
  }

  if (changed) {
    $activity.set(next)
  }
}

/** Event-Session (runtime) auf die gespeicherte Session id auflösen. */
function resolveStoredId(runtimeId) {
  if (!runtimeId) {
    return null
  }

  const live = $liveMap.get()[runtimeId]

  if (live?.storedId) {
    return live.storedId
  }

  // Manche Events tragen bereits die gespeicherte id.
  return $sessions.get().some(row => row.id === runtimeId) ? runtimeId : null
}

function noteEvent(runtimeId, kind, name) {
  const storedId = resolveStoredId(runtimeId)

  if (!storedId) {
    return
  }

  const activity = { ...$activity.get() }
  activity[storedId] = { kind, name: name || '', at: Date.now(), from: 'event' }
  $activity.set(activity)
}

// ─────────────────────────────────────────────────────────────────────────────
// Quell-Labels + Anzeige-Helfer
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_LABELS = {
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
  signal: 'Signal',
  matrix: 'Matrix',
  cron: 'Cron',
  tui: 'Terminal',
  desktop: 'Desktop',
  local: 'Desktop',
  webhook: 'Webhook'
}

function sourceLabel(source) {
  if (!source) {
    return ''
  }

  return SOURCE_LABELS[source] || source.charAt(0).toUpperCase() + source.slice(1)
}

function fmtAge(tsMs, t) {
  if (!tsMs) {
    return ''
  }

  const diff = Math.max(0, Date.now() - tsMs)
  const minutes = Math.floor(diff / 60_000)

  if (minutes < 1) {
    return t ? t('ageNow') : 'now'
  }

  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h`
  }

  const days = Math.floor(hours / 24)

  if (days < 7) {
    return `${days}d`
  }

  return `${Math.floor(days / 7)}w`
}

function dayBucket(tsMs) {
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  if (tsMs >= startToday) {
    return 'today'
  }

  if (tsMs >= startToday - 86_400_000) {
    return 'yesterday'
  }

  if (tsMs >= startToday - 6 * 86_400_000) {
    return 'week'
  }

  return 'older'
}

// ─────────────────────────────────────────────────────────────────────────────
// Sektionen bauen — manuelle Gruppen zuerst, dann Auto-Gruppen/Ungruppiert.
// Diese Reihenfolge benutzt sowohl das Pane als auch der Strg+Scroll-Zyklus.
// ─────────────────────────────────────────────────────────────────────────────

function buildSections() {
  const rows = $sessions.get()
  const groupsState = $groupsState.get()
  const settings = $settings.get()
  const tabsCfg = settings.tabs
  const groupsCfg = settings.groups

  const filtered = rows.filter(row => {
    if (tabsCfg.hideCron && row.source === 'cron') {
      return false
    }

    return true
  })

  const byId = new Map(filtered.map(row => [row.id, row]))
  const assigned = new Set()
  const sections = []

  if (groupsCfg.enabled) {
    for (const group of groupsState.groups) {
      const items = []

      for (const row of filtered) {
        if (groupsState.assign[row.id] === group.id) {
          items.push(row)
          assigned.add(row.id)
        }
      }

      const key = `group:${group.id}`
      sections.push({
        key,
        kind: 'manual',
        groupId: group.id,
        title: group.name,
        color: group.color || null,
        collapsed: Boolean(groupsState.collapsed[key]),
        items
      })
    }
  }

  const rest = filtered.filter(row => !assigned.has(row.id))

  if (groupsCfg.enabled && groupsCfg.autoMode === 'date' && rest.length) {
    const buckets = { today: [], yesterday: [], week: [], older: [] }

    for (const row of rest) {
      buckets[dayBucket(row.startedAt)].push(row)
    }

    const order = ['today', 'yesterday', 'week', 'older']

    for (const bucket of order) {
      const items = buckets[bucket]

      if (!items.length) {
        continue
      }

      const key = `auto:date:${bucket}`
      sections.push({
        key,
        kind: 'auto',
        title: null,
        titleKey: `bucket.${bucket}`,
        color: null,
        collapsed: Boolean(groupsState.collapsed[key]),
        items
      })
    }
  } else if (groupsCfg.enabled && groupsCfg.autoMode === 'source' && rest.length) {
    const bySource = new Map()

    for (const row of rest) {
      const source = row.source || 'local'

      if (!bySource.has(source)) {
        bySource.set(source, [])
      }

      bySource.get(source).push(row)
    }

    const sources = [...bySource.keys()].sort()

    for (const source of sources) {
      const key = `auto:source:${source}`
      sections.push({
        key,
        kind: 'auto',
        title: sourceLabel(source),
        color: null,
        collapsed: Boolean(groupsState.collapsed[key]),
        items: bySource.get(source)
      })
    }
  } else if (rest.length && (groupsCfg.showUngrouped || sections.length === 0)) {
    sections.push({
      key: 'ungrouped',
      kind: 'ungrouped',
      title: null,
      titleKey: 'ungrouped',
      color: null,
      collapsed: false,
      items: rest
    })
  }

  return sections
}

/** Flache, angezeigte Reihenfolge — Basis für den Strg+Scroll-Zyklus. */
function orderedRows() {
  const out = []

  for (const section of buildSections()) {
    for (const row of section.items) {
      out.push(row)
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Lokalisierung — eigene Bundles (en + de); nie core en.ts anfassen.
// ─────────────────────────────────────────────────────────────────────────────

const EN = {
  pluginName: 'Session Flow',
  paneTab: 'Session Flow',
  paneTabTitle: 'Session Flow — tabs, groups & animation',
  settingsTitle: 'Session Flow',
  settingsSubtitle: 'Chat animation, Ctrl+Scroll session cycling, and tab groups',
  untitled: 'Untitled',
  ungrouped: 'Ungrouped',
  'bucket.today': 'Today',
  'bucket.yesterday': 'Yesterday',
  'bucket.week': 'This week',
  'bucket.older': 'Older',
  empty: 'No sessions found',
  emptyHint: 'Start a chat — it will show up here as a tab.',
  error: 'Could not load the session list',

  // Actions
  open: 'Open',
  openTab: 'Open in new tab',
  openWindow: 'Open in new window',
  refresh: 'Refresh',
  settings: 'Plugin settings',
  newGroup: 'New group…',
  moveToGroup: 'Move to group',
  removeFromGroup: 'Remove from group',
  renameGroup: 'Rename group…',
  editGroup: 'Edit group…',
  deleteGroup: 'Delete group',
  collapse: 'Collapse',
  expand: 'Expand',
  pin: 'Pin',
  unpin: 'Unpin',
  color: 'Color',
  clearColor: 'No color',
  sessionColor: 'Session color',
  cycleNext: 'Next session',
  cyclePrev: 'Previous session',

  // Status (tooltip/accessibility)
  stThinking: 'Thinking…',
  stStreaming: 'Writing…',
  stTool: 'Tool running',
  stWorking: 'Working…',
  stWaiting: 'Waiting for input',
  stDone: 'Done',
  stError: 'Error',
  stIdle: 'Idle',

  // Settings — animation
  secAnimation: 'Chat animation',
  animEnabled: 'Line animation enabled',
  animEnabledDesc: 'Assistant lines ease in instead of popping at once.',
  animHistoryCascade: 'Cascade history on open',
  animHistoryCascadeDesc: 'When a chat loads or is switched, its visible lines cascade in top to bottom.',
  animStreamReveal: 'Line-by-line while streaming',
  animStreamRevealDesc: 'Each line animates once as soon as it is fully written.',
  animDuration: 'Duration (ms)',
  animStagger: 'Stagger per line (ms)',
  animMaxSteps: 'Max stagger steps',
  animMaxStepsDesc: 'Caps total cascade time on long answers.',
  animTravel: 'Travel (px)',
  animEasing: 'Easing',
  animSkipReasoning: 'Skip thinking blocks',
  animSkipReasoningDesc: 'Show reasoning/thinking content without the line animation.',
  animIncludeCode: 'Animate code blocks',
  animIncludeLists: 'Animate list items individually',
  easingSmooth: 'Smooth (expo)',
  easingSoft: 'Soft',
  easingGentle: 'Gentle',
  easingBack: 'Springy',

  // Settings — Ctrl+Scroll
  secWheel: 'Ctrl+Scroll session cycling',
  wheelEnabled: 'Enabled',
  wheelEnabledDesc: 'Scroll through active sessions with a modifier key + wheel.',
  wheelModifier: 'Modifier key',
  wheelModCtrl: 'Ctrl',
  wheelModAlt: 'Alt',
  wheelModCtrlShift: 'Ctrl+Shift',
  wheelModMeta: 'Meta',
  wheelThreshold: 'Threshold (delta)',
  wheelThresholdDesc: 'How much wheel movement advances one session.',
  wheelCooldown: 'Cooldown (ms)',
  wheelCooldownDesc: 'Minimum gap between two switches — prevents speed-running.',
  wheelInvert: 'Invert direction',
  wheelWrap: 'Wrap at the end',
  wheelHud: 'Show HUD',
  wheelHudDesc: 'Briefly overlay the position and title of the session.',
  wheelHudMs: 'HUD duration (ms)',
  wheelIgnore: 'Ignore selectors (CSS)',
  wheelIgnoreDesc: 'Zones where Ctrl+Scroll does not engage (comma separated). Default: images, Monaco, canvas.',
  wheelHint: 'Tip: zoom surfaces (image lightbox, code editor) keep their own Ctrl+Scroll behaviour.',

  // Settings — tabs
  secTabs: 'Session tabs',
  tabsDensity: 'Density',
  tabsDensityCompact: 'Compact',
  tabsDensityCozy: 'Cozy',
  tabsStatusStyle: 'Status display',
  tabsStatusGlyph: 'Icon',
  tabsStatusDot: 'Dot',
  tabsStatusBoth: 'Icon + dot',
  tabsShowTime: 'Show time',
  tabsShowPreview: 'Show preview',
  tabsShowCounts: 'Show message count',
  tabsShowSource: 'Show source (Telegram, cron, …)',
  tabsOpenIntent: 'Open as',
  tabsOpenIntentInPlace: 'Replace',
  tabsOpenIntentStack: 'Stack',
  tabsOpenIntentTab: 'Tab',
  tabsMaxItems: 'Max sessions',
  tabsHideCron: 'Hide cron sessions',
  tabsHideCronDesc: 'Cron runs would fill the list; the sidebar also shows them separately.',
  tabsLivePoll: 'Live status poll (s)',
  tabsRefresh: 'List refresh (s)',

  // Settings — groups
  secGroups: 'Tab groups',
  groupsEnabled: 'Groups enabled',
  groupsEnabledDesc: 'Firefox-style groups with name, color, and collapse stack.',
  groupsAutoMode: 'Automatic grouping',
  groupsAutoOff: 'Off (manual only)',
  groupsAutoDate: 'By date',
  groupsAutoSource: 'By source',
  groupsStackStyle: 'Stack style (collapsed)',
  stackSpine: 'Spine',
  stackFanned: 'Fanned',
  stackPill: 'Pill',
  groupsShowUngrouped: 'Show "Ungrouped" section',
  groupsHint: 'Manage groups via right-click on a tab or a group header. Drag & drop moves sessions into groups.',

  // Settings — about
  secAbout: 'About',
  aboutVersion: 'Version',
  aboutStats: (sessions, groups) => `${sessions} sessions · ${groups} groups`,
  aboutResetSettings: 'Reset settings',
  aboutResetGroups: 'Reset groups',
  aboutHint: 'Changes apply and persist immediately. File: desktop-plugins/session-flow/plugin.js',

  // Dialogs
  groupName: 'Group name',
  groupNamePlaceholder: 'e.g. Work',
  groupColor: 'Color',
  save: 'Save',
  cancel: 'Cancel',
  create: 'Create',
  delete: 'Delete',
  errOpen: 'Could not open the session',
  ageNow: 'now',
  paneCount: n => `${n} sessions`,

  // Glass & readability
  secGlass: 'Glass & readability',
  glassEnabled: 'Glass effect',
  glassEnabledDesc:
    'Gives the input field and chips a soft frosted fill with a subtle accent gradient — labels stay readable even over busy backdrops.',
  glassBlur: 'Blur (px)',
  glassSaturate: 'Saturation (%)',
  glassFill: 'Fill opacity (%)',
  glassTint: 'Accent tint (%)',
  glassGradient: 'Accent gradient',
  glassGradientDesc: 'Linear gradient from the accent color fading to transparent, layered over the fill.',
  glassAngle: 'Gradient angle (°)',
  glassGradOpacity: 'Gradient strength (%)',
  glassReach: 'Gradient fades by (%)',
  glassRing: 'Hairline outline',
  glassRingDesc: 'A fine accent-tinted outline around chips.',
  glassScopeComposer: 'Input field',
  glassScopeChips: 'Chips (model / reasoning)',
  glassScopeStatusbar: 'Status bar items',
  glassHint:
    'Blur follows the system reduce-transparency preference automatically; zoom surfaces stay untouched. Blur on the input costs a little GPU while the transcript scrolls — lower it if it ever feels heavy.'
}

const DE = {
  pluginName: 'Session Flow',
  paneTab: 'Session Flow',
  paneTabTitle: 'Session Flow — Tabs, Gruppen & Animation',
  settingsTitle: 'Session Flow',
  settingsSubtitle: 'Chat-Animation, Strg+Scroll-Sessionwechsel und Tab-Gruppen',
  untitled: 'Ohne Titel',
  ungrouped: 'Nicht gruppiert',
  'bucket.today': 'Heute',
  'bucket.yesterday': 'Gestern',
  'bucket.week': 'Diese Woche',
  'bucket.older': 'Älter',
  empty: 'Keine Sessions gefunden',
  emptyHint: 'Starte einen Chat — er erscheint hier als Tab.',
  error: 'Session-Liste konnte nicht geladen werden',

  open: 'Öffnen',
  openTab: 'In neuem Tab öffnen',
  openWindow: 'In neuem Fenster öffnen',
  refresh: 'Aktualisieren',
  settings: 'Plugin-Einstellungen',
  newGroup: 'Neue Gruppe…',
  moveToGroup: 'In Gruppe verschieben',
  removeFromGroup: 'Aus Gruppe entfernen',
  renameGroup: 'Gruppe umbenennen…',
  editGroup: 'Gruppe bearbeiten…',
  deleteGroup: 'Gruppe löschen',
  collapse: 'Einklappen',
  expand: 'Ausklappen',
  pin: 'Anpinnen',
  unpin: 'Loslösen',
  color: 'Farbe',
  clearColor: 'Keine Farbe',
  sessionColor: 'Session-Farbe',
  cycleNext: 'Nächste Session',
  cyclePrev: 'Vorherige Session',

  stThinking: 'Denkt…',
  stStreaming: 'Schreibt…',
  stTool: 'Tool läuft',
  stWorking: 'Arbeitet…',
  stWaiting: 'Wartet auf Antwort',
  stDone: 'Fertig',
  stError: 'Fehler',
  stIdle: 'Inaktiv',

  secAnimation: 'Chat-Animation',
  animEnabled: 'Zeilen-Animation aktiv',
  animEnabledDesc: 'Antwortzeilen werden mit Easing eingeblendet statt sofort zu erscheinen.',
  animHistoryCascade: 'Verlauf beim Öffnen kaskadieren',
  animHistoryCascadeDesc: 'Beim Laden oder Wechseln eines Chats laufen die sichtbaren Zeilen von oben nach unten ein.',
  animStreamReveal: 'Beim Streamen Zeile für Zeile',
  animStreamRevealDesc: 'Jede Zeile blendet genau einmal ein, sobald sie fertig geschrieben ist.',
  animDuration: 'Dauer (ms)',
  animStagger: 'Versatz pro Zeile (ms)',
  animMaxSteps: 'Max. Staffel-Schritte',
  animMaxStepsDesc: 'Deckelt die Gesamtlaufzeit der Kaskade bei langen Antworten.',
  animTravel: 'Bewegung (px)',
  animEasing: 'Easing',
  animSkipReasoning: 'Thinking-Blöcke überspringen',
  animSkipReasoningDesc: 'Reasoning-/Thinking-Inhalte ohne Zeilen-Animation anzeigen.',
  animIncludeCode: 'Code-Blöcke mitanimieren',
  animIncludeLists: 'Listenpunkte einzeln animieren',
  easingSmooth: 'Sanft (Expo)',
  easingSoft: 'Weich',
  easingGentle: 'Ruhig',
  easingBack: 'Federnd',

  secWheel: 'Strg+Scroll Sessionwechsel',
  wheelEnabled: 'Aktiviert',
  wheelEnabledDesc: 'Mit Zusatztaste + Mausrad durch die aktiven Sessions scrollen.',
  wheelModifier: 'Zusatztaste',
  wheelModCtrl: 'Strg',
  wheelModAlt: 'Alt',
  wheelModCtrlShift: 'Strg+Umschalt',
  wheelModMeta: 'Meta',
  wheelThreshold: 'Schwelle (Delta)',
  wheelThresholdDesc: 'So viel Mausrad-Bewegung, bis eine Session weiter geschaltet wird.',
  wheelCooldown: 'Sperrzeit (ms)',
  wheelCooldownDesc: 'Mindestabstand zwischen zwei Wechseln — verhindert Durchrasen.',
  wheelInvert: 'Richtung umkehren',
  wheelWrap: 'Am Ende umlaufen',
  wheelHud: 'HUD anzeigen',
  wheelHudDesc: 'Kurz ein Overlay mit Position und Titel der Session einblenden.',
  wheelHudMs: 'HUD-Dauer (ms)',
  wheelIgnore: 'Ignorier-Selektoren (CSS)',
  wheelIgnoreDesc: 'Zonen, in denen Strg+Scroll nicht greift (kommasepariert). Standard: Bilder, Monaco, Canvas.',
  wheelHint: 'Tipp: Zoom-Flächen (Bild-Lightbox, Code-Editor) behalten ihr eigenes Strg+Scroll-Verhalten.',

  secTabs: 'Session-Tabs',
  tabsDensity: 'Dichte',
  tabsDensityCompact: 'Kompakt',
  tabsDensityCozy: 'Bequem',
  tabsStatusStyle: 'Status-Darstellung',
  tabsStatusGlyph: 'Icon',
  tabsStatusDot: 'Punkt',
  tabsStatusBoth: 'Icon + Punkt',
  tabsShowTime: 'Zeit anzeigen',
  tabsShowPreview: 'Vorschau anzeigen',
  tabsShowCounts: 'Nachrichtenanzahl anzeigen',
  tabsShowSource: 'Quelle anzeigen (Telegram, Cron, …)',
  tabsOpenIntent: 'Öffnen als',
  tabsOpenIntentInPlace: 'Ersetzen',
  tabsOpenIntentStack: 'Stapeln',
  tabsOpenIntentTab: 'Tab',
  tabsMaxItems: 'Max. Sessions',
  tabsHideCron: 'Cron-Sessions ausblenden',
  tabsHideCronDesc: 'Cron-Läufe füllen sonst die Liste; die Sidebar zeigt sie ebenfalls separat.',
  tabsLivePoll: 'Live-Status-Abfrage (s)',
  tabsRefresh: 'Listen-Refresh (s)',

  secGroups: 'Tab-Gruppen',
  groupsEnabled: 'Gruppen aktiviert',
  groupsEnabledDesc: 'Firefox-artige Gruppen mit Name, Farbe und Collapse-Stapel.',
  groupsAutoMode: 'Automatische Gruppierung',
  groupsAutoOff: 'Aus (nur manuell)',
  groupsAutoDate: 'Nach Datum',
  groupsAutoSource: 'Nach Quelle',
  groupsStackStyle: 'Stapel-Stil (eingeklappt)',
  stackSpine: 'Rücken',
  stackFanned: 'Gefächert',
  stackPill: 'Pille',
  groupsShowUngrouped: '„Nicht gruppiert"-Bereich zeigen',
  groupsHint: 'Gruppen verwaltest du per Rechtsklick auf einen Tab oder die Gruppen-Überschrift. Ziehen & Ablegen sortiert Sessions ein.',

  secAbout: 'Über',
  aboutVersion: 'Version',
  aboutStats: (sessions, groups) => `${sessions} Sessions · ${groups} Gruppen`,
  aboutResetSettings: 'Einstellungen zurücksetzen',
  aboutResetGroups: 'Gruppen zurücksetzen',
  aboutHint: 'Änderungen werden sofort wirksam und gespeichert. Datei: desktop-plugins/session-flow/plugin.js',

  groupName: 'Gruppenname',
  groupNamePlaceholder: 'z. B. Arbeit',
  groupColor: 'Farbe',
  save: 'Speichern',
  cancel: 'Abbrechen',
  create: 'Erstellen',
  delete: 'Löschen',
  deleteGroupConfirm: 'Gruppe „{0}" löschen? Die Sessions bleiben erhalten und wandern zurück in die Liste.',
  errOpen: 'Session konnte nicht geöffnet werden',
  ageNow: 'jetzt',
  paneCount: n => `${n} Sessions`,

  // Glass & Lesbarkeit
  secGlass: 'Glass & Lesbarkeit',
  glassEnabled: 'Glass-Effekt',
  glassEnabledDesc:
    'Gibt Eingabefeld und Chips eine weiche Frost-Fläche mit dezentem Akzent-Verlauf — Beschriftungen bleiben auch über unruhigem Hintergrund gut lesbar.',
  glassBlur: 'Blur (px)',
  glassSaturate: 'Sättigung (%)',
  glassFill: 'Flächen-Deckkraft (%)',
  glassTint: 'Akzent-Tönung (%)',
  glassGradient: 'Akzent-Verlauf',
  glassGradientDesc: 'Linearer Verlauf von der Akzentfarbe ins Transparente, über der Fläche.',
  glassAngle: 'Verlaufs-Winkel (°)',
  glassGradOpacity: 'Verlaufs-Stärke (%)',
  glassReach: 'Verlauf endet bei (%)',
  glassRing: 'Feine Kontur',
  glassRingDesc: 'Hauchdünner, akzentgefärbter Rand um die Chips.',
  glassScopeComposer: 'Eingabefeld',
  glassScopeChips: 'Chips (Modell / Reasoning)',
  glassScopeStatusbar: 'Statusleisten-Einträge',
  glassHint:
    'Der Blur folgt automatisch der System-Einstellung „Transparenz reduzieren"; Zoom-Flächen bleiben unberührt. Blur auf dem Eingabefeld kostet beim Scrollen etwas GPU — bei Bedarf einfach senken.'
}

const LOCALES = { en: EN, de: DE }

// ─────────────────────────────────────────────────────────────────────────────
// Injiziertes Stylesheet (Klassen sind mit `sf-` genamespaced). Nur Theme-Vars!
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
.sf-pane{display:flex;flex-direction:column;height:100%;min-height:0;font-size:12px}
.sf-toolbar{display:flex;align-items:center;gap:2px;padding:4px 6px;border-bottom:1px solid var(--ui-stroke-tertiary);color:var(--ui-text-tertiary)}
.sf-toolbar-count{flex:1;min-width:0;padding-left:2px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ui-text-quaternary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sf-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 4px 12px}
.sf-section{margin-bottom:6px}
.sf-group-head{display:flex;align-items:center;gap:4px;height:24px;padding:0 4px 0 2px;border-radius:6px;color:var(--ui-text-secondary);cursor:pointer;user-select:none}
.sf-group-head:hover{background:var(--ui-row-hover-background,rgba(127,127,127,.08));color:var(--foreground)}
.sf-group-caret{display:flex;align-items:center;justify-content:center;width:14px;flex-shrink:0;color:var(--ui-text-quaternary)}
.sf-group-dot{width:8px;height:8px;border-radius:3px;flex-shrink:0}
.sf-group-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;letter-spacing:.01em}
.sf-group-count{flex-shrink:0;font-size:10px;color:var(--ui-text-quaternary);font-variant-numeric:tabular-nums}
.sf-group-actions{display:flex;align-items:center;opacity:0;flex-shrink:0}
.sf-group-head:hover .sf-group-actions,.sf-group-head:focus-within .sf-group-actions{opacity:1}
.sf-group-unassigned .sf-group-name{font-weight:500;color:var(--ui-text-tertiary)}
.sf-stack{position:relative;height:12px;margin:0 4px 3px}
.sf-stack i{position:absolute;left:0;right:0;height:7px;border-radius:5px;border:1px solid color-mix(in srgb,var(--sf-accent,var(--ui-accent)) 22%,transparent);background:color-mix(in srgb,var(--sf-accent,var(--ui-accent)) 10%,transparent)}
.sf-stack[data-style=spine] i:nth-child(1){left:0;right:0;top:0;opacity:.85}
.sf-stack[data-style=spine] i:nth-child(2){left:3px;right:3px;top:3px;opacity:.55}
.sf-stack[data-style=spine] i:nth-child(3){left:6px;right:6px;top:6px;opacity:.3}
.sf-stack[data-style=fanned] i:nth-child(1){left:0;right:0;top:0;opacity:.85}
.sf-stack[data-style=fanned] i:nth-child(2){left:5px;right:5px;top:2px;opacity:.6}
.sf-stack[data-style=fanned] i:nth-child(3){left:10px;right:10px;top:5px;opacity:.35}
.sf-stack[data-style=pill] i{height:8px;top:1px}
.sf-stack[data-style=pill] i:nth-child(1){left:0;right:0;opacity:.8}
.sf-stack[data-style=pill] i:nth-child(2){left:2px;right:2px;top:3px;opacity:.45}
.sf-stack[data-style=pill] i:nth-child(3){left:4px;right:4px;top:5px;opacity:.2}
.sf-tab{display:flex;align-items:center;gap:6px;min-height:26px;padding:2px 6px 2px 4px;border-radius:6px;cursor:pointer;color:var(--ui-text-secondary);position:relative}
.sf-tab:hover{background:var(--ui-row-hover-background,rgba(127,127,127,.08));color:var(--foreground)}
.sf-tab[data-active=true]{background:var(--ui-row-active-background,rgba(127,127,127,.12));color:var(--foreground)}
.sf-tab[data-drop=true]{box-shadow:inset 0 0 0 1px var(--ui-accent);background:color-mix(in srgb,var(--ui-accent) 10%,transparent)}
.sf-tab[data-dragging=true]{opacity:.45}
.sf-tab-lead{display:flex;align-items:center;justify-content:center;width:16px;flex-shrink:0;color:var(--ui-text-tertiary)}
.sf-tab-lead[data-kind=thinking],.sf-tab-lead[data-kind=streaming],.sf-tab-lead[data-kind=working]{color:var(--ui-accent)}
.sf-tab-lead[data-kind=tool]{color:var(--ui-accent)}
.sf-tab-lead[data-kind=waiting]{color:#f59e0b}
.sf-tab-lead[data-kind=done]{color:var(--ui-success,var(--ui-accent))}
.sf-tab-lead[data-kind=unread]{color:var(--ui-success,var(--ui-accent))}
.sf-tab-lead[data-kind=error]{color:var(--destructive,#ef4444)}
.sf-tab-main{min-width:0;flex:1}
.sf-tab-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:16px;color:inherit}
.sf-tab[data-active=true] .sf-tab-title{font-weight:600}
.sf-tab-preview{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;line-height:14px;color:var(--ui-text-quaternary)}
.sf-tab-meta{display:flex;align-items:center;gap:4px;flex-shrink:0}
.sf-tab-time{font-size:10px;color:var(--ui-text-quaternary);font-variant-numeric:tabular-nums}
.sf-tab-badge{font-size:9.5px;padding:0 4px;border-radius:4px;background:var(--ui-bg-tertiary,rgba(127,127,127,.12));color:var(--ui-text-tertiary);line-height:14px}
.sf-tab-count{font-size:10px;color:var(--ui-text-quaternary)}
.sf-empty{padding:24px 16px;text-align:center;color:var(--ui-text-tertiary)}
.sf-empty-title{font-weight:600;color:var(--ui-text-secondary);margin-bottom:4px}
.sf-empty-body{font-size:11px;line-height:1.5}
.sf-hud{position:fixed;left:50%;bottom:52px;transform:translateX(-50%) translateY(6px);z-index:80;pointer-events:none;opacity:0;transition:opacity .16s ease-out,transform .16s ease-out}
.sf-hud[data-visible=true]{opacity:1;transform:translateX(-50%) translateY(0)}
.sf-hud-card{display:flex;align-items:center;gap:8px;max-width:min(520px,60vw);padding:6px 12px;border-radius:10px;border:1px solid var(--ui-stroke-secondary);background:color-mix(in srgb,var(--ui-bg-elevated,#16181d) 94%,transparent);box-shadow:0 6px 24px rgba(0,0,0,.28);backdrop-filter:blur(8px)}
.sf-hud-index{font-size:11px;font-variant-numeric:tabular-nums;color:var(--ui-text-tertiary);flex-shrink:0}
.sf-hud-title{font-size:12px;font-weight:600;color:var(--foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sf-hud-group{font-size:10px;color:var(--ui-text-quaternary);flex-shrink:0;padding-left:4px;border-left:1px solid var(--ui-stroke-tertiary)}
.sf-settings{height:100%;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px 20px 96px}
.sf-settings-head{margin-bottom:14px}
.sf-settings-title{font-size:15px;font-weight:600;color:var(--foreground)}
.sf-settings-sub{font-size:12px;color:var(--ui-text-tertiary);margin-top:3px}
.sf-section-title{display:flex;align-items:center;gap:6px;margin:22px 0 4px;font-size:12px;font-weight:600;color:var(--foreground)}
.sf-section-title:first-of-type{margin-top:8px}
.sf-hint{font-size:11px;line-height:1.55;color:var(--ui-text-quaternary);margin:6px 0 0}
.sf-wide{width:16rem}
.sf-dialog{max-width:24rem}
.sf-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0}
.sf-row-label{min-width:0}
.sf-row-title{font-size:12px;font-weight:500;color:var(--foreground)}
.sf-row-desc{font-size:11px;line-height:1.5;color:var(--ui-text-tertiary);margin-top:2px}
.sf-row-control{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.sf-num{width:76px;text-align:right}
.sf-swatches{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.sf-swatch{width:16px;height:16px;border-radius:50%;border:1px solid var(--ui-stroke-secondary);cursor:pointer}
.sf-swatch[data-selected=true]{box-shadow:0 0 0 2px var(--ui-bg-elevated,#16181d),0 0 0 3.5px currentColor}
.sf-seg{display:inline-grid;grid-auto-flow:column;gap:2px;border-radius:5px;background:var(--ui-bg-tertiary,rgba(127,127,127,.12));padding:2px}
.sf-seg button{border:0;background:transparent;border-radius:3px;padding:2px 9px;font-size:11px;color:var(--ui-text-secondary);cursor:pointer}
.sf-seg button[data-active=true]{background:var(--background,#fff);color:var(--foreground);box-shadow:0 1px 2px rgba(0,0,0,.15)}
.sf-dialog-row{display:flex;flex-direction:column;gap:6px;margin:10px 0}
.sf-dialog-label{font-size:11px;font-weight:600;color:var(--ui-text-secondary)}
@media (prefers-reduced-motion: reduce){.sf-hud{transition:none}}

/* ── Glass & Lesbarkeit (optional; gesteuert über :root[data-sf-glass]-Tokens) ─
   Rein additiv: Flächen bekommen einen weichen Frost + dezenten, akzent-
   gefärbten Verlauf, damit Beschriftungen auch ohne eigene Fläche lesbar
   bleiben. Kein !important auf backdrop-filter — der app-weite
   „prefers-reduced-transparency"-Gate (styles.css) nullt dann alles global. */

/* Eingabefeld: Basis-Fläche des Composers + Dock-Karten mit Akzent-Tönung */
:root[data-sf-glass~='composer'] [data-slot='composer-root']{
  --composer-fill:color-mix(in srgb,var(--ui-accent) var(--sf-glass-tint,8%),color-mix(in srgb,var(--dt-card) var(--sf-glass-fill,86%),transparent))
}
:root[data-sf-glass~='composer'] [data-slot='composer-root'][data-thread-scrolled-up]{
  --composer-fill:color-mix(in srgb,var(--ui-accent) var(--sf-glass-tint,8%),color-mix(in srgb,var(--dt-card) calc(var(--sf-glass-fill,86%) + 6%),transparent))
}
:root[data-sf-glass~='composer'] [data-slot='composer-surface']{
  backdrop-filter:blur(var(--sf-glass-blur,10px)) saturate(var(--sf-glass-sat,115%));
  -webkit-backdrop-filter:blur(var(--sf-glass-blur,10px)) saturate(var(--sf-glass-sat,115%))
}
:root[data-sf-glass~='composer']:not([data-sf-glass~='nograd']) [data-slot='composer-surface']::after{
  content:'';position:absolute;inset:0;z-index:0;border-radius:inherit;pointer-events:none;
  background-image:linear-gradient(var(--sf-glass-angle,165deg),color-mix(in srgb,var(--ui-accent) var(--sf-glass-grad,12%),transparent),transparent var(--sf-glass-reach,72%))
}

/* UI-Chips: Modell- und Reasoning-Pill im Composer */
:root[data-sf-glass~='chips'] :is([data-tour='model-pill'],[data-testid='reasoning-pill']){
  background-color:color-mix(in srgb,var(--ui-accent) var(--sf-glass-tint,8%),color-mix(in srgb,var(--dt-card) 90%,transparent));
  backdrop-filter:blur(calc(var(--sf-glass-blur,10px) * .75)) saturate(var(--sf-glass-sat,115%));
  -webkit-backdrop-filter:blur(calc(var(--sf-glass-blur,10px) * .75)) saturate(var(--sf-glass-sat,115%))
}
:root[data-sf-glass~='chips']:not([data-sf-glass~='nograd']) :is([data-tour='model-pill'],[data-testid='reasoning-pill']){
  background-image:linear-gradient(var(--sf-glass-angle,165deg),color-mix(in srgb,var(--ui-accent) var(--sf-glass-grad,12%),transparent),transparent var(--sf-glass-reach,72%))
}
:root[data-sf-glass~='chips']:not([data-sf-glass~='noring']) :is([data-tour='model-pill'],[data-testid='reasoning-pill']){
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ui-accent) 24%,var(--ui-stroke-secondary))
}
:root[data-sf-glass~='chips'] :is([data-tour='model-pill'],[data-testid='reasoning-pill']):hover{
  background-color:color-mix(in srgb,var(--ui-accent) calc(var(--sf-glass-tint,8%) * 2),color-mix(in srgb,var(--dt-card) 94%,transparent))
}

/* Statusleiste: Einträge als Chips */
:root[data-sf-glass~='statusbar'] [data-slot='statusbar'] :is(button,a){
  background-color:color-mix(in srgb,var(--ui-accent) var(--sf-glass-tint,8%),color-mix(in srgb,var(--dt-card) 88%,transparent));
  backdrop-filter:blur(calc(var(--sf-glass-blur,10px) * .6)) saturate(var(--sf-glass-sat,115%));
  -webkit-backdrop-filter:blur(calc(var(--sf-glass-blur,10px) * .6)) saturate(var(--sf-glass-sat,115%))
}
:root[data-sf-glass~='statusbar']:not([data-sf-glass~='nograd']) [data-slot='statusbar'] :is(button,a){
  background-image:linear-gradient(var(--sf-glass-angle,165deg),color-mix(in srgb,var(--ui-accent) var(--sf-glass-grad,12%),transparent),transparent var(--sf-glass-reach,72%))
}
:root[data-sf-glass~='statusbar']:not([data-sf-glass~='noring']) [data-slot='statusbar'] :is(button,a){
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ui-accent) 20%,var(--ui-stroke-secondary))
}
:root[data-sf-glass~='statusbar'] [data-slot='statusbar'] :is(button,a):hover{
  background-color:color-mix(in srgb,var(--ui-accent) calc(var(--sf-glass-tint,8%) * 2),color-mix(in srgb,var(--dt-card) 94%,transparent))
}
`

function injectCss() {
  const style = document.createElement('style')
  style.textContent = CSS
  style.setAttribute('data-session-flow', '')
  document.head.append(style)
  return () => style.remove()
}

// ─────────────────────────────────────────────────────────────────────────────
// Aktivitäts-Engine — Icon + Status je gespeicherter Session id
// ─────────────────────────────────────────────────────────────────────────────

/** Codicon je Aktivitätsart; `~spin` dreht das Icon (Codicon-Konvention). */
const ACTIVITY_GLYPHS = {
  thinking: { icon: 'loading~spin', labelKey: 'stThinking' },
  streaming: { icon: 'pulse', labelKey: 'stStreaming' },
  tool: { icon: 'tools', labelKey: 'stTool' },
  working: { icon: 'sync~spin', labelKey: 'stWorking' },
  waiting: { icon: 'bell', labelKey: 'stWaiting' },
  done: { icon: 'check', labelKey: 'stDone' },
  error: { icon: 'error', labelKey: 'stError' },
  idle: { icon: 'circle-outline', labelKey: 'stIdle' }
}

function activityFor(row, live, activity) {
  const detail = activity[row.id]

  if (detail) {
    return { kind: detail.kind, name: detail.name || '', labelKey: null }
  }

  const runtimeEntry = Object.values(live).find(entry => entry.storedId === row.id)

  if (runtimeEntry) {
    if (runtimeEntry.status === 'waiting') {
      return { kind: 'waiting', name: '', labelKey: null }
    }

    if (runtimeEntry.status === 'streaming') {
      return { kind: 'streaming', name: '', labelKey: null }
    }

    if (['working', 'starting', 'resuming'].includes(runtimeEntry.status)) {
      return { kind: 'working', name: '', labelKey: null }
    }
  }

  return { kind: 'idle', name: '', labelKey: null }
}

function activityLabel(t, detail) {
  const glyph = ACTIVITY_GLYPHS[detail.kind] || ACTIVITY_GLYPHS.idle
  let label = t(glyph.labelKey)

  if (detail.kind === 'tool' && detail.name) {
    label = `${t('stTool')}: ${detail.name}`
  }

  return label
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation-Controller — Zeilen-Kaskade + Stream-Reveal über die Web
// Animations-API. Zustand liegt PRO Element (WeakMap), Dedupe über die
// Zeilen-Indizes — so kann ein Re-Parse der Markdown-Blöcke nichts flackern
// lassen (jede Zeile animiert höchstens einmal).
// ─────────────────────────────────────────────────────────────────────────────

const LINE_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, table, pre, [data-slot="aui_markdown-image"], [data-streamdown="code-block"], [data-slot="code-card"]'
const ASSISTANT_CONTENT = '[data-slot="aui_assistant-message-content"]'
const SWITCHING_ATTR = 'data-session-switching'
const HOT_WINDOW_MS = 2600

function createAnimationController(ctx) {
  const lineState = new WeakMap() // el -> { done:Set<number>, lastMutation:number, finalized:boolean }
  const surfaceState = new WeakMap() // surface -> { cascadedAt:number, switching:boolean }
  let scanScheduled = false
  let settleTimer = 0
  let disposed = false

  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

  function stateFor(el) {
    let state = lineState.get(el)

    if (!state) {
      state = { done: new Set(), lastMutation: 0, finalized: false }
      lineState.set(el, state)
    }

    return state
  }

  function shouldSkipReasoning(el) {
    if (!readSetting('animation', 'skipReasoning')) {
      return false
    }

    return Boolean(el.closest("[data-slot='aui_thinking-disclosure']"))
  }

  /** Alle "Zeilen"-Einheiten eines Markdown-Blocks, in Dokumentreihenfolge. */
  function lineUnits(md) {
    const includeLists = readSetting('animation', 'includeLists') !== false
    const includeCode = readSetting('animation', 'includeCode') !== false
    const units = []

    for (const child of md.children) {
      const tag = child.tagName

      if (tag === 'UL' || tag === 'OL') {
        if (includeLists) {
          for (const item of child.children) {
            if (item.tagName === 'LI') {
              units.push(item)
            }
          }
        } else {
          units.push(child)
        }

        continue
      }

      if (!includeCode && (tag === 'PRE' || child.matches?.("[data-streamdown='code-block'], [data-slot='code-card']"))) {
        continue
      }

      units.push(child)
    }

    return units
  }

  function animateUnit(el, delay, settings) {
    if (!el.isConnected) {
      return
    }

    const duration = Math.max(60, Number(settings.durationMs) || 320)
    const travel = Math.max(0, Number(settings.travelPx) || 0)
    const easing = EASINGS[settings.easing] || EASINGS.soft

    try {
      const animation = el.animate(
        travel > 0
          ? [
              { opacity: 0, transform: `translateY(${travel}px)` },
              { opacity: 1, transform: 'translateY(0)' }
            ]
          : [{ opacity: 0 }, { opacity: 1 }],
        { duration, delay: Math.max(0, delay), easing, fill: 'backwards' }
      )

      animation.onfinish = () => {
        try {
          animation.cancel()
        } catch {
          // ignore
        }
      }
    } catch {
      // WAAPI nicht verfügbar — einfach sichtbar lassen.
    }
  }

  function collectMessages(surface) {
    const messages = []
    const nodes = surface.querySelectorAll(`${ASSISTANT_CONTENT} .aui-md`)

    for (const md of nodes) {
      if (shouldSkipReasoning(md)) {
        continue
      }

      const messageRoot = md.closest(ASSISTANT_CONTENT)

      if (!messageRoot) {
        continue
      }

      messages.push({ md, messageRoot })
    }

    return messages
  }

  function inViewport(el, margin = 320) {
    try {
      const rect = el.getBoundingClientRect()
      return rect.bottom > -margin && rect.top < window.innerHeight + margin
    } catch {
      return true
    }
  }

  /** Kaskade: alle sichtbaren Zeilen einer Fläche nacheinander einblenden. */
  function cascadeSurface(surface, settings) {
    if (disposed || reducedMotion() || surface.hasAttribute(SWITCHING_ATTR)) {
      return
    }

    const messages = collectMessages(surface)
    let order = 0
    const stagger = Math.max(0, Number(settings.staggerMs) || 0)
    const cap = Math.max(1, Number(settings.maxStaggerSteps) || 1)

    for (const { md } of messages) {
      if (!inViewport(md)) {
        continue
      }

      const units = lineUnits(md)
      const state = stateFor(md)
      state.finalized = false

      for (let index = 0; index < units.length; index += 1) {
        const unit = units[index]

        if (state.done.has(index)) {
          order += 1
          continue
        }

        const delay = Math.min(order, cap) * stagger
        order += 1
        state.done.add(index)

        if (unit.getBoundingClientRect().height >= 2 || unit.tagName === 'PRE') {
          animateUnit(unit, delay, settings)
        }
      }

      state.lastMutation = Date.now()
    }
  }

  /** Während des Streamens: fertig geschriebene Zeilen einmal animieren. */
  function processHotElement(md, settings, now) {
    const state = lineState.get(md)

    if (!state || state.lastMutation === 0) {
      return
    }

    const units = lineUnits(md)

    if (!units.length) {
      return
    }

    const hot = now - state.lastMutation < HOT_WINDOW_MS
    const stagger = Math.max(0, Number(settings.staggerMs) || 0)

    // Alle Zeilen außer der letzten gelten als "fertig", sobald die nächste
    // erscheint. Die letzte Zeile bekommt ihre Animation beim Settle.
    let batch = 0

    for (let index = 0; index < units.length - 1; index += 1) {
      if (state.done.has(index)) {
        continue
      }

      state.done.add(index)
      animateUnit(units[index], batch * Math.min(stagger, 90), settings)
      batch += 1
    }

    if (!hot && !state.finalized) {
      const lastIndex = units.length - 1

      if (!state.done.has(lastIndex)) {
        state.done.add(lastIndex)
        animateUnit(units[lastIndex], batch * Math.min(stagger, 90), settings)
      }

      state.finalized = true
    }
  }

  function scan() {
    scanScheduled = false

    if (disposed || !readSetting('animation', 'enabled')) {
      return
    }

    const settings = $settings.get().animation
    const now = Date.now()
    const surfaces = document.querySelectorAll('[data-chat-surface]')

    for (const surface of surfaces) {
      if (surface.hasAttribute(SWITCHING_ATTR)) {
        continue // Kaskade übernimmt, sobald das Attribut fällt.
      }

      if (!readSetting('animation', 'streamReveal')) {
        continue
      }

      const messages = collectMessages(surface)

      for (const { md } of messages) {
        if (!inViewport(md, 600)) {
          continue
        }

        const state = lineState.get(md)

        if (!state) {
          continue
        }

        // Nur Elemente mit frischen Mutationen sind "heiße" Stream-Kandidaten;
        // state.lastMutation wird vom Observer gesetzt.
        if (state.lastMutation > 0) {
          processHotElement(md, settings, now)
        }
      }
    }
  }

  function scheduleScan() {
    if (scanScheduled || disposed) {
      return
    }

    scanScheduled = true
    window.requestAnimationFrame(() => {
      scan()
    })
  }

  /** Settle-Prüfung: endet der Stream, bekommt die letzte Zeile ihre Animation. */
  function scheduleSettleCheck() {
    window.clearTimeout(settleTimer)
    settleTimer = window.setTimeout(() => {
      if (disposed) {
        return
      }

      const settings = $settings.get().animation
      const now = Date.now()

      for (const surface of document.querySelectorAll('[data-chat-surface]')) {
        for (const { md } of collectMessages(surface)) {
          const state = lineState.get(md)

          if (state && state.lastMutation > 0 && now - state.lastMutation >= HOT_WINDOW_MS && !state.finalized) {
            processHotElement(md, settings, now)
          }
        }
      }

      scheduleSettleCheck()
    }, 1800)
  }

  const observer = new MutationObserver(records => {
    if (disposed || !readSetting('animation', 'enabled')) {
      return
    }

    const now = Date.now()
    let hot = false

    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target?.parentElement

      if (!target) {
        continue
      }

      const md = target.closest?.('.aui-md')

      if (!md || !md.closest?.(ASSISTANT_CONTENT)) {
        continue
      }

      if (md.closest(`[${SWITCHING_ATTR}]`)) {
        continue
      }

      if (shouldSkipReasoning(md)) {
        continue
      }

      const state = stateFor(md)
      state.lastMutation = now
      state.finalized = false
      hot = true
    }

    if (hot) {
      scheduleScan()
      scheduleSettleCheck()
    }
  })

  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  // Attribut-Beobachter: Session-Wechsel-Ende => Kaskade für diese Fläche.
  const attrObserver = new MutationObserver(records => {
    for (const record of records) {
      const target = record.target

      if (!(target instanceof Element) || !target.matches?.('[data-chat-surface]')) {
        continue
      }

      if (target.hasAttribute(SWITCHING_ATTR)) {
        const info = surfaceState.get(target) || { cascadedAt: 0 }
        surfaceState.set(target, { ...info, switching: true })
      } else {
        const info = surfaceState.get(target) || { cascadedAt: 0, switching: false }

        if (!info.switching) {
          continue
        }

        surfaceState.set(target, { ...info, switching: false })
        const settings = $settings.get().animation

        if (settings.enabled && settings.historyCascade) {
          // Ein Frame warten: Rows sollen laut Kontrakt "auf dem Schirm"
          // sein, wenn das Attribut fällt — trotzdem erst nach dem Paint.
          window.requestAnimationFrame(() => {
            cascadeSurface(target, $settings.get().animation)
          })
        }
      }
    }
  })

  attrObserver.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: [SWITCHING_ATTR]
  })

  // Fallback: Fokuswechsel (falls ein Open das Attribut nicht setzt).
  let focusTimer = 0
  const stopFocus = host.state.focusedStoredSessionId.listen(() => {
    window.clearTimeout(focusTimer)
    focusTimer = window.setTimeout(() => {
      const settings = $settings.get().animation

      if (!settings.enabled || !settings.historyCascade || reducedMotion()) {
        return
      }

      for (const surface of document.querySelectorAll('[data-chat-surface]')) {
        if (surface.hasAttribute(SWITCHING_ATTR)) {
          continue
        }

        cascadeSurface(surface, settings)
      }
    }, 450)
  })

  // Start-Kaskade: einmal nach dem Laden des Plugins.
  const initialTimer = ctx.setTimeout(() => {
    if (reducedMotion()) {
      return
    }

    const settings = $settings.get().animation

    if (settings.enabled && settings.historyCascade) {
      for (const surface of document.querySelectorAll('[data-chat-surface]')) {
        cascadeSurface(surface, settings)
      }
    }
  }, 900)

  scheduleSettleCheck()

  return () => {
    disposed = true
    observer.disconnect()
    attrObserver.disconnect()
    window.clearTimeout(settleTimer)
    window.clearTimeout(focusTimer)
    try {
      stopFocus()
      initialTimer()
    } catch {
      // ignore
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Strg+Scroll-Controller + HUD
// ─────────────────────────────────────────────────────────────────────────────

const BUILTIN_IGNORE = 'canvas, .monaco-editor, [data-slot="aui_zoomable-image"]'

function modifierMatches(event, modifier) {
  switch (modifier) {
    case 'alt':
      return event.altKey && !event.ctrlKey && !event.metaKey
    case 'ctrl+shift':
      return event.ctrlKey && event.shiftKey && !event.altKey
    case 'meta':
      return event.metaKey && !event.ctrlKey && !event.altKey
    case 'ctrl':
    default:
      return event.ctrlKey && !event.altKey && !event.metaKey
  }
}

function createWheelController(ctx) {
  const accumulator = { value: 0, lastAt: 0, lastDir: 0 }
  let hudEl = null
  let hudTimer = 0
  let hudIndexEl = null
  let hudTitleEl = null
  let hudGroupEl = null

  function ensureHud() {
    if (hudEl) {
      return hudEl
    }

    hudEl = document.createElement('div')
    hudEl.className = 'sf-hud'
    hudEl.setAttribute('aria-hidden', 'true')
    const card = document.createElement('div')
    card.className = 'sf-hud-card'
    hudIndexEl = document.createElement('span')
    hudIndexEl.className = 'sf-hud-index'
    hudTitleEl = document.createElement('span')
    hudTitleEl.className = 'sf-hud-title'
    hudGroupEl = document.createElement('span')
    hudGroupEl.className = 'sf-hud-group'
    card.append(hudIndexEl, hudTitleEl, hudGroupEl)
    hudEl.append(card)
    document.body.append(hudEl)

    return hudEl
  }

  function showHud(row, index, total) {
    if (!readSetting('wheel', 'hud')) {
      return
    }

    ensureHud()
    const groupsState = $groupsState.get()
    const groupId = groupsState.assign[row.id]
    const group = groupId ? groupsState.groups.find(entry => entry.id === groupId) : null

    hudIndexEl.textContent = `${index + 1} / ${total}`
    hudTitleEl.textContent = row.title || CTX?.i18n?.t('untitled') || 'Ohne Titel'
    hudGroupEl.textContent = group ? group.name : ''
    hudGroupEl.style.display = group ? '' : 'none'
    hudEl.setAttribute('data-visible', 'true')

    window.clearTimeout(hudTimer)
    hudTimer = window.setTimeout(() => {
      hudEl?.setAttribute('data-visible', 'false')
    }, Math.max(300, Number(readSetting('wheel', 'hudMs')) || 1100))
  }

  async function cycle(direction) {
    const settings = $settings.get().wheel
    let rows = orderedRows()

    if (!rows.length) {
      await refreshSessions()
      rows = orderedRows()
    }

    if (!rows.length) {
      return
    }

    const focused = host.state.focusedStoredSessionId.get() || host.state.activeSessionId.get() || ''
    const step = direction * (settings.invert ? -1 : 1)
    let index = rows.findIndex(row => row.id === focused)

    if (index < 0) {
      index = step > 0 ? -1 : 0
    }

    let next = index + step

    if (next < 0 || next >= rows.length) {
      if (!settings.wrap) {
        return
      }

      next = ((next % rows.length) + rows.length) % rows.length
    }

    if (next === index) {
      return
    }

    const row = rows[next]
    showHud(row, next, rows.length)

    try {
      await host.openSession(row.id, { intent: readSetting('tabs', 'openIntent') || 'in-place' })
    } catch (error) {
      host.notifyError(error, CTX?.i18n?.t('errOpen') || 'Session konnte nicht geöffnet werden')
    }
  }

  function isIgnoredTarget(target) {
    if (!(target instanceof Element)) {
      return false
    }

    const extra = String(readSetting('wheel', 'ignoreSelector') || '').trim()
    const selector = extra ? `${BUILTIN_IGNORE}, ${extra}` : BUILTIN_IGNORE

    try {
      return Boolean(target.closest(selector))
    } catch {
      try {
        return Boolean(target.closest(BUILTIN_IGNORE))
      } catch {
        return false
      }
    }
  }

  const onWheel = event => {
    const settings = $settings.get().wheel

    if (!settings.enabled) {
      return
    }

    if (!modifierMatches(event, settings.modifier)) {
      return
    }

    // Zoom-Flächen (Bild-Lightbox, Monaco, …) haben bereits übernommen.
    if (event.defaultPrevented) {
      return
    }

    if (isIgnoredTarget(event.target)) {
      return
    }

    // Ab hier gehört die Geste uns: Browser-Zoom unterdrücken.
    event.preventDefault()

    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1
    const delta = (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * scale

    if (!delta) {
      return
    }

    const now = Date.now()

    if (now - accumulator.lastAt > 800) {
      accumulator.value = 0
    }

    const coalesced = accumulator.value === 0 || Math.sign(accumulator.value) === Math.sign(delta)
    accumulator.value = coalesced ? accumulator.value + delta : delta
    accumulator.lastAt = now

    const threshold = Math.max(8, Number(settings.threshold) || 40)
    const cooldown = Math.max(60, Number(settings.cooldownMs) || 200)

    if (Math.abs(accumulator.value) < threshold) {
      return
    }

    if (now - accumulator.lastDir < cooldown) {
      return
    }

    const direction = accumulator.value > 0 ? 1 : -1
    accumulator.value = 0
    accumulator.lastDir = now

    void cycle(direction)
  }

  const off = ctx.addEventListener(window, 'wheel', onWheel, { passive: false })

  return {
    cycleNext: () => void cycle(1),
    cyclePrev: () => void cycle(-1),
    dispose: () => {
      off()
      window.clearTimeout(hudTimer)
      hudEl?.remove()
      hudEl = null
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI — kleine Bausteine
// ─────────────────────────────────────────────────────────────────────────────

/** Eigener Status-Glyph (Aktivitäts-Icon) mit Core-Fallback via SessionStatusDot. */
function StatusLead({ row, live, activity, style, t }) {
  const detail = activityFor(row, live, activity)
  const glyph = ACTIVITY_GLYPHS[detail.kind] || ACTIVITY_GLYPHS.idle
  const label = activityLabel(t, detail)
  const showGlyph = style === 'glyph' || style === 'glyph+dot'
  const showDot = style === 'dot' || style === 'glyph+dot'

  return jsxs('span', {
    className: 'sf-tab-lead',
    'data-kind': detail.kind,
    title: label,
    role: 'status',
    'aria-label': label,
    children: [
      showGlyph
        ? jsx(Codicon, { name: glyph.icon, size: '0.8125rem' })
        : showDot
          ? renderDot(row)
          : null,
      showDot && showGlyph ? renderDot(row) : null
    ]
  })
}

function renderDot(row) {
  if (SessionStatusDot) {
    return jsx(SessionStatusDot, { storedSessionId: row.id, session: null })
  }

  return jsx('span', {
    'aria-hidden': 'true',
    style: {
      width: '5px',
      height: '5px',
      borderRadius: '50%',
      background: 'var(--ui-text-quaternary)',
      display: 'inline-block'
    }
  })
}

/** Fallback-Zeilen, falls ein älterer Build die Settings-Primitives nicht hat. */
function LocalRow({ title, description, action }) {
  return jsx('div', {
    className: 'sf-row',
    children: [
      jsxs('div', {
        className: 'sf-row-label',
        children: [
          jsx('div', { className: 'sf-row-title', children: title }),
          description ? jsx('div', { className: 'sf-row-desc', children: description }) : null
        ]
      }),
      jsx('div', { className: 'sf-row-control', children: action })
    ]
  })
}

const Row = SDKListRow || LocalRow

function LocalToggleRow({ label, description, checked, onChange, disabled }) {
  return jsx(LocalRow, {
    title: label,
    description,
    action: jsx(Switch, { 'aria-label': label, checked, disabled, onCheckedChange: onChange })
  })
}

const ToggleRow = SDKToggleRow || LocalToggleRow

function LocalSegment({ options, value, onChange }) {
  return jsx('div', {
    className: 'sf-seg',
    role: 'radiogroup',
    children: options.map(option =>
      jsx(
        'button',
        {
          'aria-pressed': value === option.id,
          'data-active': value === option.id,
          onClick: () => onChange(option.id),
          type: 'button',
          children: option.label
        },
        option.id
      )
    )
  })
}

function Segment(props) {
  if (SegmentedControl) {
    return jsx(SegmentedControl, props)
  }

  return jsx(LocalSegment, props)
}

function NumberInput({ value, onChange, min, max, step }) {
  return jsx(Input, {
    className: 'sf-num',
    max,
    min,
    onChange: event => {
      const next = Number(event.target.value)

      if (Number.isFinite(next)) {
        onChange(next)
      }
    },
    step,
    type: 'number',
    value
  })
}

/** Swatch-Reihe für Gruppen-Farben (bevorzugt den Core-ColorSwatches-Look). */
function GroupSwatches({ value, onChange, clearLabel }) {
  if (ColorSwatches && Array.isArray(PROFILE_SWATCHES)) {
    return jsx(ColorSwatches, {
      swatches: PROFILE_SWATCHES,
      value: value || null,
      onChange,
      clearLabel
    })
  }

  const swatches = Array.isArray(PROFILE_SWATCHES) ? PROFILE_SWATCHES : []

  return jsx('div', {
    className: 'sf-swatches',
    children: [
      ...swatches.map(color =>
        jsx('button', {
          'aria-label': color,
          className: 'sf-swatch',
          'data-selected': value === color,
          onClick: () => onChange(color),
          style: { background: color, color },
          type: 'button'
        }, color)
      ),
      jsx(Button, { onClick: () => onChange(null), size: 'sm', variant: 'ghost', children: clearLabel })
    ]
  })
}

/** Ein-/Ausklapp-Caret. */
function Caret({ open }) {
  return jsx(Codicon, { name: open ? 'chevron-down' : 'chevron-right', size: '0.875rem' })
}

// ─────────────────────────────────────────────────────────────────────────────
// UI — Sessions-Pane (Tabs + Gruppen)
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ section, t, onToggle, onEdit }) {
  const open = !section.collapsed
  const color = section.color || null
  const title = section.titleKey ? t(section.titleKey) : section.title || t('ungrouped')
  const collapsible = section.kind !== 'ungrouped'
  const editable = section.kind === 'manual'

  return jsxs('div', {
    className: cn('sf-group-head', section.kind === 'ungrouped' && 'sf-group-unassigned'),
    onClick: collapsible ? () => onToggle() : undefined,
    onContextMenu: editable
      ? event => {
          event.preventDefault()
          onEdit()
        }
      : undefined,
    onDoubleClick: editable ? () => onEdit() : undefined,
    role: collapsible ? 'button' : undefined,
    'aria-expanded': collapsible ? open : undefined,
    title: editable ? t('editGroup') : open ? t('collapse') : t('expand'),
    children: [
      jsx('span', { className: 'sf-group-caret', children: jsx(Caret, { open }) }),
      color
        ? jsx('span', { className: 'sf-group-dot', style: { background: color } })
        : section.kind === 'ungrouped'
          ? null
          : jsx('span', {
              className: 'sf-group-dot',
              style: { background: 'var(--ui-text-quaternary)', opacity: 0.5 }
            }),
      jsx('span', { className: 'sf-group-name', children: title }),
      editable
        ? jsx('span', {
            className: 'sf-group-actions',
            onClick: event => {
              event.stopPropagation()
              onEdit()
            },
            children: jsx(Codicon, { name: 'edit', size: '0.75rem' })
          })
        : null,
      jsx('span', { className: 'sf-group-count', children: String(section.items.length) })
    ]
  })
}

function StackLayers({ style, color }) {
  return jsx('div', {
    className: 'sf-stack',
    'data-style': style,
    style: color ? { '--sf-accent': color } : undefined,
    children: [jsx('i', { key: 0 }), jsx('i', { key: 1 }), jsx('i', { key: 2 })]
  })
}

function TabRow({ row, active, section, t, onOpen, groupsState, onAssign, dragging, setDragging }) {
  const settings = useValue($settings)
  const activity = useValue($activity)
  const live = useValue($liveMap)
  const tabsCfg = settings.tabs
  const cozy = tabsCfg.density === 'cozy'
  const group = section.kind === 'manual' ? groupsState.groups.find(entry => entry.id === section.groupId) : null

  const menuItems = []

  menuItems.push(
    jsx(ContextMenuItem, { key: 'open', onSelect: () => onOpen(row, 'in-place'), children: t('open') })
  )
  menuItems.push(
    jsx(ContextMenuItem, { key: 'tab', onSelect: () => onOpen(row, 'tab'), children: t('openTab') })
  )
  menuItems.push(
    jsx(ContextMenuItem, { key: 'window', onSelect: () => onOpen(row, 'window'), children: t('openWindow') })
  )
  menuItems.push(jsx(ContextMenuSeparator, { key: 'sep1' }))

  if (host.sessions && typeof host.sessions.pin === 'function') {
    menuItems.push(
      jsx(ContextMenuItem, {
        key: 'pin',
        onSelect: () => {
          try {
            host.sessions.pin(row.id, true)
          } catch (error) {
            host.notifyError(error, t('pin'))
          }
        },
        children: t('pin')
      })
    )
  }

  const groupChoices = groupsState.groups.map(entry =>
    jsx(
      ContextMenuItem,
      {
        key: `g-${entry.id}`,
        onSelect: () => onAssign(row.id, entry.id),
        children: jsxs(Fragment, {
          children: [
            entry.color
              ? jsx('span', {
                  className: 'sf-group-dot',
                  style: { background: entry.color, display: 'inline-block', marginRight: 6 }
                })
              : null,
            entry.name
          ]
        })
      },
      entry.id
    )
  )

  menuItems.push(
    jsxs(
      ContextMenuSub,
      {
        key: 'move',
        children: [
          jsx(ContextMenuSubTrigger, { children: t('moveToGroup') }),
          jsxs(ContextMenuSubContent, {
            children: [
              ...groupChoices,
              groupChoices.length ? jsx(ContextMenuSeparator, { key: 'gsep' }) : null,
              jsx(ContextMenuItem, { key: 'ungroup', onSelect: () => onAssign(row.id, null), children: t('removeFromGroup') })
            ]
          })
        ]
      },
      'move-sub'
    )
  )

  if (host.sessions && typeof host.sessions.setColor === 'function' && Array.isArray(PROFILE_SWATCHES)) {
    menuItems.push(
      jsxs(
        ContextMenuSub,
        {
          key: 'color',
          children: [
            jsx(ContextMenuSubTrigger, { children: t('sessionColor') }),
            jsx(ContextMenuSubContent, {
              children: [
                ...PROFILE_SWATCHES.slice(0, 12).map(color =>
                  jsx(ContextMenuItem, {
                    key: color,
                    onSelect: () => {
                      try {
                        host.sessions.setColor(row.id, color)
                      } catch (error) {
                        host.notifyError(error, t('color'))
                      }
                    },
                    children: jsx('span', {
                      className: 'sf-group-dot',
                      style: { background: color, display: 'inline-block', marginRight: 6 }
                    })
                  }, color)
                ),
                jsx(ContextMenuItem, {
                  key: 'clear',
                  onSelect: () => {
                    try {
                      host.sessions.setColor(row.id, null)
                    } catch (error) {
                      host.notifyError(error, t('clearColor'))
                    }
                  },
                  children: t('clearColor')
                })
              ]
            })
          ]
        },
        'color-sub'
      )
    )
  }

  const lead = jsx(StatusLead, {
    row,
    live,
    activity,
    style: tabsCfg.statusStyle,
    t
  })

  const meta = []

  if (tabsCfg.showSource && row.source && row.source !== 'local' && row.source !== 'desktop' && row.source !== 'tui') {
    meta.push(jsx('span', { className: 'sf-tab-badge', key: 'src', children: sourceLabel(row.source) }))
  }

  if (tabsCfg.showCounts) {
    meta.push(
      jsx('span', {
        className: 'sf-tab-count',
        key: 'count',
        children: compactNumber ? compactNumber(row.messageCount) : String(row.messageCount)
      })
    )
  }

  if (tabsCfg.showTime) {
    meta.push(jsx('span', { className: 'sf-tab-time', key: 'time', children: fmtAge(row.startedAt, t) }))
  }

  const body = jsxs('div', {
    className: 'sf-tab',
    'data-active': active,
    'data-dragging': dragging === row.id,
    draggable: true,
    onClick: () => onOpen(row, null),
    onDragStart: event => {
      setDragging(row.id)

      try {
        event.dataTransfer.setData('text/session-flow-session', row.id)
        event.dataTransfer.setData('text/plain', row.id)
        event.dataTransfer.effectAllowed = 'move'
      } catch {
        // ignore
      }
    },
    onDragEnd: () => setDragging(null),
    children: [
      lead,
      jsxs('div', {
        className: 'sf-tab-main',
        children: [
          jsx('div', { className: 'sf-tab-title', children: row.title || t('untitled') }),
          cozy && tabsCfg.showPreview && row.preview
            ? jsx('div', { className: 'sf-tab-preview', children: row.preview })
            : null
        ]
      }),
      meta.length ? jsx('div', { className: 'sf-tab-meta', children: meta }) : null
    ]
  })

  return jsxs(ContextMenu, {
    children: [
      jsx(ContextMenuTrigger, { asChild: true, children: body }),
      jsx(ContextMenuContent, { children: menuItems })
    ]
  })
}

function newGroupDialogState() {
  return { open: false, mode: 'create', groupId: null, name: '', color: null }
}

function GroupDialog({ state, setState, t }) {
  const groupsState = $groupsState.get()
  const editing = state.mode === 'edit' ? groupsState.groups.find(entry => entry.id === state.groupId) : null

  const commit = () => {
    const name = state.name.trim()

    if (state.mode === 'create') {
      const group = createGroup(name || t('newGroup'), state.color)
      void group
    } else if (state.mode === 'edit' && editing) {
      updateGroup(editing.id, { name: name || editing.name, color: state.color })
    }

    setState(newGroupDialogState())
  }

  return jsx(Dialog, {
    open: state.open,
    onOpenChange: open => setState(open ? state : newGroupDialogState()),
    children: jsx(DialogContent, {
      className: 'sf-dialog',
      children: jsxs(Fragment, {
        children: [
          jsx(DialogHeader, {
            children: jsx(DialogTitle, {
              children: state.mode === 'edit' ? t('editGroup') : t('newGroup')
            })
          }),
          jsxs('div', {
            className: 'sf-dialog-row',
            children: [
              jsx('label', { className: 'sf-dialog-label', children: t('groupName') }),
              jsx(Input, {
                autoFocus: true,
                onChange: event => setState({ ...state, name: event.target.value }),
                onKeyDown: event => {
                  if (event.key === 'Enter') {
                    commit()
                  }
                },
                placeholder: t('groupNamePlaceholder'),
                value: state.name
              })
            ]
          }),
          jsxs('div', {
            className: 'sf-dialog-row',
            children: [
              jsx('label', { className: 'sf-dialog-label', children: t('groupColor') }),
              jsx(GroupSwatches, {
                value: state.color,
                onChange: color => setState({ ...state, color }),
                clearLabel: t('clearColor')
              })
            ]
          }),
          jsxs(DialogFooter, {
            children: [
              state.mode === 'edit'
                ? jsx(Button, {
                    onClick: () => {
                      const name = editing ? editing.name : ''
                      deleteGroup(state.groupId)
                      setState(newGroupDialogState())
                      host.notify({ kind: 'info', message: `${t('deleteGroup')}: ${name}` })
                    },
                    variant: 'ghost',
                    children: t('delete')
                  })
                : null,
              jsx(Button, {
                onClick: () => setState(newGroupDialogState()),
                variant: 'ghost',
                children: t('cancel')
              }),
              jsx(Button, {
                onClick: commit,
                children: state.mode === 'edit' ? t('save') : t('create')
              })
            ]
          })
        ]
      })
    })
  })
}

function SessionsPane() {
  const t = usePluginI18n(ID)
  const rows = useValue($sessions)
  const error = useValue($sessionsError)
  const groupsState = useValue($groupsState)
  const settings = useValue($settings)
  const focused = useValue(host.state.focusedStoredSessionId)
  const active = useValue(host.state.activeSessionId)
  const [dialog, setDialog] = useState(() => newGroupDialogState())
  const [dragging, setDragging] = useState(null)

  const sections = useMemo(() => buildSections(), [rows, groupsState, settings])
  const totalCount = sections.reduce((sum, section) => sum + section.items.length, 0)

  const open = (row, intent) => {
    haptic('tap')

    try {
      void host
        .openSession(row.id, { intent: intent || readSetting('tabs', 'openIntent') || 'in-place' })
        .catch(err => host.notifyError(err, t('errOpen')))
    } catch (err) {
      host.notifyError(err, t('errOpen'))
    }
  }

  const assign = (sessionId, groupId) => {
    assignSession(sessionId, groupId)
    setDragging(null)
  }

  const editGroup = section => {
    if (section.kind !== 'manual') {
      return
    }

    const group = groupsState.groups.find(entry => entry.id === section.groupId)

    if (group) {
      setDialog({
        open: true,
        mode: 'edit',
        groupId: group.id,
        name: group.name,
        color: group.color || null
      })
    }
  }

  const sectionHandlers = section => ({
    onDragOver: event => {
      if (section.kind === 'manual' || section.kind === 'ungrouped') {
        event.preventDefault()

        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move'
        }
      }
    },
    onDrop: event => {
      event.preventDefault()
      const sessionId =
        event.dataTransfer?.getData('text/session-flow-session') || event.dataTransfer?.getData('text/plain')

      if (sessionId) {
        assign(sessionId, section.kind === 'manual' ? section.groupId : null)
      }
    }
  })

  const list = jsx('div', {
    className: 'sf-list',
    children: sections.map(section => {
      const expanded = !section.collapsed
      const stackStyle = settings.groups.stackStyle
      const showStack = !expanded && stackStyle !== 'pill' && section.items.length > 0 && section.kind !== 'ungrouped'

      return jsxs('div', {
        className: 'sf-section',
        key: section.key,
        ...sectionHandlers(section),
        children: [
          jsx(SectionHeader, {
            key: 'head',
            section,
            t,
            onToggle: () => {
              if (section.kind !== 'ungrouped') {
                toggleSectionCollapsed(section.key)
              }
            },
            onEdit: () => editGroup(section)
          }),
          showStack ? jsx(StackLayers, { key: 'stack', style: stackStyle, color: section.color }) : null,
          expanded
            ? section.items.map(row =>
                jsx(TabRow, {
                  key: row.id,
                  row,
                  active: row.id === (focused || active),
                  section,
                  t,
                  onOpen: open,
                  groupsState,
                  onAssign: assign,
                  dragging,
                  setDragging
                })
              )
            : null
        ]
      })
    })
  })

  const toolbar = jsxs('div', {
    className: 'sf-toolbar',
    children: [
      jsx('span', {
        className: 'sf-toolbar-count',
        children: t('paneCount', totalCount)
      }),
      jsx(Tip, {
        label: t('newGroup'),
        children: jsx(Button, {
          'aria-label': t('newGroup'),
          onClick: () => setDialog({ ...newGroupDialogState(), open: true }),
          size: 'icon-xs',
          variant: 'ghost',
          children: jsx(Codicon, { name: 'add', size: '0.875rem' })
        })
      }),
      jsx(Tip, {
        label: t('refresh'),
        children: jsx(Button, {
          'aria-label': t('refresh'),
          onClick: () => void refreshSessions(),
          size: 'icon-xs',
          variant: 'ghost',
          children: jsx(Codicon, { name: 'refresh', size: '0.875rem' })
        })
      }),
      jsx(Tip, {
        label: t('settings'),
        children: jsx(Button, {
          'aria-label': t('settings'),
          onClick: () => host.navigate('/session-flow'),
          size: 'icon-xs',
          variant: 'ghost',
          children: jsx(Codicon, { name: 'settings-gear', size: '0.875rem' })
        })
      })
    ]
  })

  let body = null

  if (!rows.length && error) {
    body = jsxs('div', {
      className: 'sf-empty',
      children: [
        jsx('div', { className: 'sf-empty-title', children: t('error') }),
        jsx('div', { className: 'sf-empty-body', children: error })
      ]
    })
  } else if (!rows.length) {
    body = jsxs('div', {
      className: 'sf-empty',
      children: [
        jsx('div', { className: 'sf-empty-title', children: t('empty') }),
        jsx('div', { className: 'sf-empty-body', children: t('emptyHint') })
      ]
    })
  } else {
    body = list
  }

  return jsxs('div', {
    className: 'sf-pane',
    children: [toolbar, body, jsx(GroupDialog, { state: dialog, setState: setDialog, t })]
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// UI — Einstellungs-Seite
// ─────────────────────────────────────────────────────────────────────────────

function SettingsSection({ icon, title, children }) {
  return jsxs('section', {
    children: [
      jsxs('div', {
        className: 'sf-section-title',
        children: [jsx(Codicon, { name: icon, size: '0.9rem' }), jsx('span', { children: title })]
      }),
      ...children
    ]
  })
}

function SettingsPage() {
  const t = usePluginI18n(ID)
  const settings = useValue($settings)
  const rows = useValue($sessions)
  const groupsState = useValue($groupsState)

  const animation = settings.animation
  const wheel = settings.wheel
  const tabs = settings.tabs
  const groups = settings.groups
  const glass = settings.glass

  const patch = (section, key, value) => patchSettings(section, { [key]: value })

  return jsxs('div', {
    className: 'sf-settings',
    children: [
      jsxs('div', {
        className: 'sf-settings-head',
        children: [
          jsx('div', { className: 'sf-settings-title', children: t('settingsTitle') }),
          jsx('div', { className: 'sf-settings-sub', children: t('settingsSubtitle') })
        ]
      }),

      // ── Chat-Animation ─────────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'sparkle',
        title: t('secAnimation'),
        children: [
          jsx(ToggleRow, {
            label: t('animEnabled'),
            description: t('animEnabledDesc'),
            checked: animation.enabled,
            onChange: value => patch('animation', 'enabled', value)
          }),
          jsx(ToggleRow, {
            label: t('animHistoryCascade'),
            description: t('animHistoryCascadeDesc'),
            checked: animation.historyCascade,
            disabled: !animation.enabled,
            onChange: value => patch('animation', 'historyCascade', value)
          }),
          jsx(ToggleRow, {
            label: t('animStreamReveal'),
            description: t('animStreamRevealDesc'),
            checked: animation.streamReveal,
            disabled: !animation.enabled,
            onChange: value => patch('animation', 'streamReveal', value)
          }),
          jsx(Row, {
            title: t('animDuration'),
            action: jsx(NumberInput, {
              min: 80,
              max: 2000,
              step: 20,
              value: animation.durationMs,
              onChange: value => patch('animation', 'durationMs', value)
            })
          }),
          jsx(Row, {
            title: t('animStagger'),
            action: jsx(NumberInput, {
              min: 0,
              max: 500,
              step: 5,
              value: animation.staggerMs,
              onChange: value => patch('animation', 'staggerMs', value)
            })
          }),
          jsx(Row, {
            title: t('animMaxSteps'),
            description: t('animMaxStepsDesc'),
            action: jsx(NumberInput, {
              min: 1,
              max: 200,
              step: 1,
              value: animation.maxStaggerSteps,
              onChange: value => patch('animation', 'maxStaggerSteps', value)
            })
          }),
          jsx(Row, {
            title: t('animTravel'),
            action: jsx(NumberInput, {
              min: 0,
              max: 64,
              step: 1,
              value: animation.travelPx,
              onChange: value => patch('animation', 'travelPx', value)
            })
          }),
          jsx(Row, {
            title: t('animEasing'),
            action: jsx(Segment, {
              options: [
                { id: 'soft', label: t('easingSoft') },
                { id: 'smooth', label: t('easingSmooth') },
                { id: 'gentle', label: t('easingGentle') },
                { id: 'back', label: t('easingBack') }
              ],
              value: animation.easing,
              onChange: value => patch('animation', 'easing', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('animSkipReasoning'),
            description: t('animSkipReasoningDesc'),
            checked: animation.skipReasoning,
            disabled: !animation.enabled,
            onChange: value => patch('animation', 'skipReasoning', value)
          }),
          jsx(ToggleRow, {
            label: t('animIncludeCode'),
            checked: animation.includeCode,
            disabled: !animation.enabled,
            onChange: value => patch('animation', 'includeCode', value)
          }),
          jsx(ToggleRow, {
            label: t('animIncludeLists'),
            checked: animation.includeLists,
            disabled: !animation.enabled,
            onChange: value => patch('animation', 'includeLists', value)
          })
        ]
      }),

      // ── Strg+Scroll ────────────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'arrow-both',
        title: t('secWheel'),
        children: [
          jsx(ToggleRow, {
            label: t('wheelEnabled'),
            description: t('wheelEnabledDesc'),
            checked: wheel.enabled,
            onChange: value => patch('wheel', 'enabled', value)
          }),
          jsx(Row, {
            title: t('wheelModifier'),
            action: jsx(Segment, {
              options: [
                { id: 'ctrl', label: t('wheelModCtrl') },
                { id: 'alt', label: t('wheelModAlt') },
                { id: 'ctrl+shift', label: t('wheelModCtrlShift') },
                { id: 'meta', label: t('wheelModMeta') }
              ],
              value: wheel.modifier,
              onChange: value => patch('wheel', 'modifier', value)
            })
          }),
          jsx(Row, {
            title: t('wheelThreshold'),
            description: t('wheelThresholdDesc'),
            action: jsx(NumberInput, {
              min: 8,
              max: 400,
              step: 4,
              value: wheel.threshold,
              onChange: value => patch('wheel', 'threshold', value)
            })
          }),
          jsx(Row, {
            title: t('wheelCooldown'),
            description: t('wheelCooldownDesc'),
            action: jsx(NumberInput, {
              min: 60,
              max: 1200,
              step: 20,
              value: wheel.cooldownMs,
              onChange: value => patch('wheel', 'cooldownMs', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('wheelInvert'),
            checked: wheel.invert,
            onChange: value => patch('wheel', 'invert', value)
          }),
          jsx(ToggleRow, {
            label: t('wheelWrap'),
            checked: wheel.wrap,
            onChange: value => patch('wheel', 'wrap', value)
          }),
          jsx(ToggleRow, {
            label: t('wheelHud'),
            description: t('wheelHudDesc'),
            checked: wheel.hud,
            onChange: value => patch('wheel', 'hud', value)
          }),
          jsx(Row, {
            title: t('wheelHudMs'),
            action: jsx(NumberInput, {
              min: 300,
              max: 5000,
              step: 100,
              value: wheel.hudMs,
              onChange: value => patch('wheel', 'hudMs', value)
            })
          }),
          jsx(Row, {
            title: t('wheelIgnore'),
            description: t('wheelIgnoreDesc'),
            action: jsx(Input, {
              className: 'sf-wide',
              onChange: event => patch('wheel', 'ignoreSelector', event.target.value),
              placeholder: 'z. B. .xterm, [data-pane="preview"]',
              value: wheel.ignoreSelector
            })
          }),
          jsx('p', { className: 'sf-hint', children: t('wheelHint') })
        ]
      }),

      // ── Tabs ───────────────────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'window',
        title: t('secTabs'),
        children: [
          jsx(Row, {
            title: t('tabsDensity'),
            action: jsx(Segment, {
              options: [
                { id: 'compact', label: t('tabsDensityCompact') },
                { id: 'cozy', label: t('tabsDensityCozy') }
              ],
              value: tabs.density,
              onChange: value => patch('tabs', 'density', value)
            })
          }),
          jsx(Row, {
            title: t('tabsStatusStyle'),
            action: jsx(Segment, {
              options: [
                { id: 'glyph', label: t('tabsStatusGlyph') },
                { id: 'dot', label: t('tabsStatusDot') },
                { id: 'glyph+dot', label: t('tabsStatusBoth') }
              ],
              value: tabs.statusStyle,
              onChange: value => patch('tabs', 'statusStyle', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('tabsShowTime'),
            checked: tabs.showTime,
            onChange: value => patch('tabs', 'showTime', value)
          }),
          jsx(ToggleRow, {
            label: t('tabsShowPreview'),
            checked: tabs.showPreview,
            onChange: value => patch('tabs', 'showPreview', value)
          }),
          jsx(ToggleRow, {
            label: t('tabsShowCounts'),
            checked: tabs.showCounts,
            onChange: value => patch('tabs', 'showCounts', value)
          }),
          jsx(ToggleRow, {
            label: t('tabsShowSource'),
            checked: tabs.showSource,
            onChange: value => patch('tabs', 'showSource', value)
          }),
          jsx(Row, {
            title: t('tabsOpenIntent'),
            action: jsx(Segment, {
              options: [
                { id: 'in-place', label: t('tabsOpenIntentInPlace') },
                { id: 'stack', label: t('tabsOpenIntentStack') },
                { id: 'tab', label: t('tabsOpenIntentTab') }
              ],
              value: tabs.openIntent,
              onChange: value => patch('tabs', 'openIntent', value)
            })
          }),
          jsx(Row, {
            title: t('tabsMaxItems'),
            action: jsx(NumberInput, {
              min: 10,
              max: 200,
              step: 10,
              value: tabs.maxItems,
              onChange: value => patch('tabs', 'maxItems', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('tabsHideCron'),
            description: t('tabsHideCronDesc'),
            checked: tabs.hideCron,
            onChange: value => patch('tabs', 'hideCron', value)
          }),
          jsx(Row, {
            title: t('tabsLivePoll'),
            action: jsx(NumberInput, {
              min: 10,
              max: 300,
              step: 5,
              value: tabs.livePollSec,
              onChange: value => patch('tabs', 'livePollSec', value)
            })
          }),
          jsx(Row, {
            title: t('tabsRefresh'),
            action: jsx(NumberInput, {
              min: 15,
              max: 600,
              step: 5,
              value: tabs.refreshSec,
              onChange: value => patch('tabs', 'refreshSec', value)
            })
          })
        ]
      }),

      // ── Gruppen ────────────────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'layers',
        title: t('secGroups'),
        children: [
          jsx(ToggleRow, {
            label: t('groupsEnabled'),
            description: t('groupsEnabledDesc'),
            checked: groups.enabled,
            onChange: value => patch('groups', 'enabled', value)
          }),
          jsx(Row, {
            title: t('groupsAutoMode'),
            action: jsx(Segment, {
              options: [
                { id: 'off', label: t('groupsAutoOff') },
                { id: 'date', label: t('groupsAutoDate') },
                { id: 'source', label: t('groupsAutoSource') }
              ],
              value: groups.autoMode,
              disabled: !groups.enabled,
              onChange: value => patch('groups', 'autoMode', value)
            })
          }),
          jsx(Row, {
            title: t('groupsStackStyle'),
            action: jsx(Segment, {
              options: [
                { id: 'spine', label: t('stackSpine') },
                { id: 'fanned', label: t('stackFanned') },
                { id: 'pill', label: t('stackPill') }
              ],
              value: groups.stackStyle,
              disabled: !groups.enabled,
              onChange: value => patch('groups', 'stackStyle', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('groupsShowUngrouped'),
            checked: groups.showUngrouped,
            disabled: !groups.enabled,
            onChange: value => patch('groups', 'showUngrouped', value)
          }),
          jsx('p', { className: 'sf-hint', children: t('groupsHint') })
        ]
      }),

      // ── Glass & Lesbarkeit ─────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'paintcan',
        title: t('secGlass'),
        children: [
          jsx(ToggleRow, {
            label: t('glassEnabled'),
            description: t('glassEnabledDesc'),
            checked: glass.enabled,
            onChange: value => patch('glass', 'enabled', value)
          }),
          jsx(Row, {
            title: t('glassBlur'),
            action: jsx(NumberInput, {
              min: 0,
              max: 40,
              step: 1,
              value: glass.blurPx,
              onChange: value => patch('glass', 'blurPx', value)
            })
          }),
          jsx(Row, {
            title: t('glassSaturate'),
            action: jsx(NumberInput, {
              min: 100,
              max: 200,
              step: 5,
              value: glass.saturate,
              onChange: value => patch('glass', 'saturate', value)
            })
          }),
          jsx(Row, {
            title: t('glassFill'),
            action: jsx(NumberInput, {
              min: 50,
              max: 94,
              step: 2,
              value: glass.fill,
              onChange: value => patch('glass', 'fill', value)
            })
          }),
          jsx(Row, {
            title: t('glassTint'),
            action: jsx(NumberInput, {
              min: 0,
              max: 40,
              step: 1,
              value: glass.tint,
              onChange: value => patch('glass', 'tint', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('glassGradient'),
            description: t('glassGradientDesc'),
            checked: glass.gradient,
            disabled: !glass.enabled,
            onChange: value => patch('glass', 'gradient', value)
          }),
          jsx(Row, {
            title: t('glassAngle'),
            action: jsx(NumberInput, {
              min: 0,
              max: 360,
              step: 5,
              value: glass.angle,
              onChange: value => patch('glass', 'angle', value)
            })
          }),
          jsx(Row, {
            title: t('glassGradOpacity'),
            action: jsx(NumberInput, {
              min: 0,
              max: 60,
              step: 2,
              value: glass.gradOpacity,
              onChange: value => patch('glass', 'gradOpacity', value)
            })
          }),
          jsx(Row, {
            title: t('glassReach'),
            action: jsx(NumberInput, {
              min: 20,
              max: 100,
              step: 4,
              value: glass.reach,
              onChange: value => patch('glass', 'reach', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('glassRing'),
            description: t('glassRingDesc'),
            checked: glass.ring,
            disabled: !glass.enabled,
            onChange: value => patch('glass', 'ring', value)
          }),
          jsx(ToggleRow, {
            label: t('glassScopeComposer'),
            checked: glass.scopes.composer,
            disabled: !glass.enabled,
            onChange: value => patch('glass', 'scopes', { ...glass.scopes, composer: value })
          }),
          jsx(ToggleRow, {
            label: t('glassScopeChips'),
            checked: glass.scopes.chips,
            disabled: !glass.enabled,
            onChange: value => patch('glass', 'scopes', { ...glass.scopes, chips: value })
          }),
          jsx(ToggleRow, {
            label: t('glassScopeStatusbar'),
            checked: glass.scopes.statusbar,
            disabled: !glass.enabled,
            onChange: value => patch('glass', 'scopes', { ...glass.scopes, statusbar: value })
          }),
          jsx('p', { className: 'sf-hint', children: t('glassHint') })
        ]
      }),

      // ── Über ───────────────────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'info',
        title: t('secAbout'),
        children: [
          jsx(Row, {
            title: t('aboutVersion'),
            action: jsx('span', { className: 'sf-row-desc', children: VERSION })
          }),
          jsx(Row, {
            title: t('aboutStats', rows.length, groupsState.groups.length),
            action: null
          }),
          jsx(Row, {
            title: t('aboutResetSettings'),
            action: jsx(Button, {
              onClick: () => resetSettings(),
              size: 'sm',
              variant: 'ghost',
              children: t('aboutResetSettings')
            })
          }),
          jsx(Row, {
            title: t('aboutResetGroups'),
            action: jsx(Button, {
              onClick: () => resetGroups(),
              size: 'sm',
              variant: 'ghost',
              children: t('aboutResetGroups')
            })
          }),
          jsx('p', { className: 'sf-hint', children: t('aboutHint') })
        ]
      })
    ]
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin — Registrierung
// ─────────────────────────────────────────────────────────────────────────────

export default {
  id: ID,
  name: 'Session Flow',
  description:
    'Smoothe Zeilen-Animation im Chat, Strg+Scroll durch aktive Sessions, Firefox-artige Tab-Gruppen.',
  defaultEnabled: true,

  register(ctx) {
    CTX = ctx

    // 1) Einstellungen + Gruppen laden, i18n + Styles registrieren.
    loadSettings()
    loadGroups()
    ctx.i18n.register(LOCALES)
    const removeCss = injectCss()

    // 2) Controller starten (Animation, Strg+Scroll).
    const disposeAnimation = createAnimationController(ctx)
    const wheelController = createWheelController(ctx)

    // 2b) Glass-Lesbarkeit: Einstellungen als Attribute/Variablen auf <html>
    //     spiegeln; das Stylesheet reagiert rein per CSS darauf.
    applyGlass()
    const stopGlassWatch = $settings.listen(() => applyGlass())

    // Versions-Stempel: belegt im Plugin-Storage, welche Version zuletzt sauber
    // geladen wurde (Hilfe beim Debuggen nach Kopie/Hot-Reload).
    try {
      ctx.storage.set('_meta', { loadedAt: Date.now(), version: VERSION })
    } catch (error) {
      console.warn(`[${ID}] meta write failed`, error)
    }

    console.info(`[${ID}] v${VERSION} loaded (glass: ${readSetting('glass', 'enabled') ? 'on' : 'off'})`)

    // 3) Session-Daten: initial + bei Events + Polls.
    void refreshSessions()
    void pollLiveSessions()

    ctx.onEvent('message.complete', () => {
      scheduleSessionsRefresh(1200)
    })
    ctx.onEvent('session.info', () => {
      scheduleSessionsRefresh(2500)
    })

    ctx.setInterval(() => {
      void pollLiveSessions()
    }, Math.max(10, Number(readSetting('tabs', 'livePollSec')) || 30) * 1000)

    ctx.setInterval(() => {
      void refreshSessions()
    }, Math.max(15, Number(readSetting('tabs', 'refreshSec')) || 45) * 1000)

    ctx.setInterval(() => {
      expireActivity()
    }, 30_000)

    // 4) UI-Beiträge: Pane, Einstellungs-Seite, Sidebar-Nav, Palette, Keybinds.
    ctx.register({
      id: 'pane',
      area: PANES_AREA,
      title: 'Session Flow',
      data: {
        placement: 'left',
        width: '256px',
        tabTitle: () => jsx(PaneTabTitle, {}),
        tabTitleText: () => ctx.i18n.t('paneTab')
      },
      render: () => jsx(SessionsPane, {})
    })

    ctx.register({
      id: 'settings-page',
      area: ROUTES_AREA,
      data: { path: '/session-flow' },
      render: () => jsx(SettingsPage, {})
    })

    ctx.register({
      id: 'nav',
      area: SIDEBAR_NAV_AREA,
      data: { path: '/session-flow', label: 'Session Flow', codicon: 'layout' }
    })

    ctx.registerMany([
      {
        id: 'cmd-settings',
        area: PALETTE_AREA,
        data: {
          id: 'session-flow.settings',
          label: 'Session Flow: Einstellungen',
          keywords: ['session', 'flow', 'tabs', 'gruppen', 'animation', 'settings'],
          run: () => host.navigate('/session-flow')
        }
      },
      {
        id: 'cmd-next',
        area: PALETTE_AREA,
        data: {
          id: 'session-flow.next',
          label: 'Session Flow: Nächste Session',
          keywords: ['session', 'next', 'zyklus', 'wheel'],
          run: () => wheelController.cycleNext()
        }
      },
      {
        id: 'cmd-prev',
        area: PALETTE_AREA,
        data: {
          id: 'session-flow.prev',
          label: 'Session Flow: Vorherige Session',
          keywords: ['session', 'prev', 'zyklus', 'wheel'],
          run: () => wheelController.cyclePrev()
        }
      },
      {
        id: 'cmd-toggle-animation',
        area: PALETTE_AREA,
        data: {
          id: 'session-flow.toggleAnimation',
          label: 'Session Flow: Zeilen-Animation umschalten',
          keywords: ['animation', 'zeilen', 'easing'],
          run: () => {
            const next = !readSetting('animation', 'enabled')
            patchSettings('animation', { enabled: next })
            host.notify({ kind: 'info', message: `Session Flow: Animation ${next ? 'an' : 'aus'}` })
          }
        }
      },
      {
        id: 'cmd-toggle-wheel',
        area: PALETTE_AREA,
        data: {
          id: 'session-flow.toggleWheel',
          label: 'Session Flow: Strg+Scroll umschalten',
          keywords: ['wheel', 'scroll', 'strg', 'ctrl'],
          run: () => {
            const next = !readSetting('wheel', 'enabled')
            patchSettings('wheel', { enabled: next })
            host.notify({ kind: 'info', message: `Session Flow: Strg+Scroll ${next ? 'an' : 'aus'}` })
          }
        }
      },
      {
        id: 'cmd-toggle-glass',
        area: PALETTE_AREA,
        data: {
          id: 'session-flow.toggleGlass',
          label: 'Session Flow: Glass-Effekt umschalten',
          keywords: ['glass', 'blur', 'chips', 'lesbarkeit', 'readability'],
          run: () => {
            const next = !readSetting('glass', 'enabled')
            patchSettings('glass', { enabled: next })
            host.notify({ kind: 'info', message: `Session Flow: Glass ${next ? 'an' : 'aus'}` })
          }
        }
      },
      {
        id: 'key-next',
        area: KEYBINDS_AREA,
        data: {
          id: 'session-flow.next',
          label: 'Session Flow: Nächste Session',
          category: 'Session Flow',
          defaults: [],
          run: () => wheelController.cycleNext()
        }
      },
      {
        id: 'key-prev',
        area: KEYBINDS_AREA,
        data: {
          id: 'session-flow.prev',
          label: 'Session Flow: Vorherige Session',
          category: 'Session Flow',
          defaults: [],
          run: () => wheelController.cyclePrev()
        }
      }
    ])

    // 5) Aufräumen — alles über ctx getrackte wird automatisch entfernt;
    //    hier nur die eigenen Observer/Styles/HUD.
    ctx.onDispose(() => {
      window.clearTimeout(settingsSaveTimer)
      window.clearTimeout(groupsSaveTimer)
      window.clearTimeout(refreshDebounce)
      try {
        stopGlassWatch()
        clearGlass()
        removeCss()
        disposeAnimation()
        wheelController.dispose()
      } catch (error) {
        console.warn(`[${ID}] dispose failed`, error)
      }
    })
  }
}

/** Tab-Label des Panes (folgt der App-Locale). */
function PaneTabTitle() {
  const t = usePluginI18n(ID)
  return jsx(Fragment, { children: t('paneTab') })
}
