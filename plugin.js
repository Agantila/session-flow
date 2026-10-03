/**
 * Session Flow — Hermes Desktop Plugin
 * ====================================
 *
 * Sechs Bereiche, alle in den Plugin-Einstellungen anpassbar:
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
 *  4. GLASS & LESBARKEIT — optionaler Frost-Effekt + Akzent-Verlauf für
 *     Eingabefeld, Chips und Statusleiste, inkl. umlaufendem Glow-Ring.
 *
 *  5. UI-TABS — Sidebar-Optik für die Content-Tab-Leiste: Label, Close-Button,
 *     Live-Status (Glow an arbeitenden Tabs).
 *
 *  6. INDIVIDUALISIERUNG — Akzentfarben-Tönung für elementare UI, eigener
 *     Chat-Hintergrund (Bild/Video über hermes-media://stream/…), Content-
 *     Bereich mit runden Ecken + dezentem Schlagschatten.
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
 * Entwickler & Lizenzinhaber: AGANTILA — Deniz Yilmaz (https://agantila.com)
 * Lizenz: MIT (Open Source). Siehe LICENSE im Repo.
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
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
const VERSION = '1.10.0'
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
    refreshSec: 45,
    view: 'list',
    gridCols: 'auto',
    gridMin: 150,
    gridGap: 6,
    gridLines: 2,
    gridPreview: true,
    infoDensity: 'auto',
    showContext: false,
    rowGradOn: false,
    rowGradFrom: '#7c3aed',
    rowGradTo: '#00dbda',
    rowGradAngle: 135,
    rowShadow: 'off',
    titleGradOn: false,
    titleGradFrom: '#e4e4e7',
    titleGradTo: '#8b8b93',
    titleGradAngle: 90,
    selTint: 'standard',
    selColor: '#7c3aed',
    selBorder: false,
    selShadow: 'off',
    rowLive: false
  },
  groups: {
    enabled: true,
    autoMode: 'off',
    stackStyle: 'spine',
    showUngrouped: true
  },
  uiTabs: {
    enabled: true,
    radius: 4,
    gap: 2,
    insetY: 2,
    separators: false,
    activeStyle: 'sidebar',
    labelCase: 'normal',
    labelSize: 11,
    showLead: true,
    closeMode: 'hover',
    closeWidth: 22,
    closeHover: true,
    arc: true
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
    arc: true,
    arcMode: 'always',
    arcWidth: 1.5,
    arcDuration: 3.2,
    scopes: { composer: true, chips: true, statusbar: false }
  },
  personal: {
    accentOn: false,
    accentColor: '#7c3aed',
    bgOn: false,
    bgKind: 'image',
    bgPath: '',
    bgFit: 'cover',
    bgDim: 35,
    bgBlur: 0,
    bgScope: 'chat',
    shellOn: false,
    shellRadius: 10,
    shellShadow: 'subtle',
    shellBorder: true,
    shellScope: 'all'
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
  '--sf-glass-reach',
  '--sf-arc-width',
  '--sf-arc-duration',
  '--sf-arc-radius'
]

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

/** Entfernt Attribut + Variablen wieder vollständig (Dispose / deaktiviert). */
function clearGlass() {
  const root = document.documentElement
  root.removeAttribute('data-sf-glass')
  root.removeAttribute('data-sf-arc')
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
    root.style.setProperty('--sf-arc-width', `${clampNumber(glass.arcWidth, 0.5, 4, 1.5)}px`)
    root.style.setProperty('--sf-arc-duration', `${clampNumber(glass.arcDuration, 1, 12, 3.2)}s`)
    measureComposerRadius()
    syncArc()
  } catch (error) {
    console.warn(`[${ID}] glass apply failed`, error)
    clearGlass()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individualisierung — Akzent-Tönung, Chat-Hintergrund, Content-Abgrenzung
// ─────────────────────────────────────────────────────────────────────────────
//
//  • Akzent: überschreibt --ui-accent (Quelle der Fills/Strokes/Hover/aktiver
//    Zustände der App). Das Plugin-<style> ist unlayered und gewinnt damit
//    gegen die @layer-base-Definition — kein !important nötig.
//  • Hintergrund: lokale Dateien laufen über das App-Protokoll
//    hermes-media://stream/<encodeURIComponent(pfad)> (Range-fähig, auch für
//    Videos). Das Plugin setzt nur Variablen; ein JS-Sync legt pro Pane-Host
//    einen .sf-bg-layer an (Bild als background-image, Video als <video>-Kind).
//  • Shell: runde Ecken + Schlagschatten auf [data-pane-host] (ohne Overlays).
//    Nichts an overflow/Geometrie ändern — die Panes werden per Anchor
//    positioniert (Inline-Styles), ein Eingriff dort bricht das Layout.

const SF_PERSONAL_VARS = [
  '--sf-accent-color',
  '--sf-bg-url',
  '--sf-bg-fit',
  '--sf-bg-dim',
  '--sf-bg-blur',
  '--sf-shell-radius',
  '--sf-shell-shadow'
]

const SHELL_SHADOWS = {
  off: 'none',
  subtle: '0 1px 2px color-mix(in srgb, #000 10%, transparent), 0 6px 16px color-mix(in srgb, #000 9%, transparent)',
  medium: '0 2px 4px color-mix(in srgb, #000 12%, transparent), 0 10px 28px color-mix(in srgb, #000 13%, transparent)',
  strong: '0 3px 10px color-mix(in srgb, #000 16%, transparent), 0 18px 44px color-mix(in srgb, #000 20%, transparent)'
}

/** URL für lokale Dateien über das App-Protokoll (Range-fähig, Video-tauglich). */
function mediaStreamUrl(filePath) {
  return `hermes-media://stream/${encodeURIComponent(filePath)}`
}

/** Entfernt alle injizierten Hintergrund-Layer (Dispose / deaktiviert). */
function removePaneBackgrounds() {
  try {
    document.querySelectorAll('[data-sf-bg-layer]').forEach(layer => layer.remove())
  } catch {
    /* DOM evtl. schon weg — egal */
  }
}

function clearPersonal() {
  const root = document.documentElement

  for (const attr of [
    'data-sf-accent',
    'data-sf-bg',
    'data-sf-bg-kind',
    'data-sf-bg-scope',
    'data-sf-shell',
    'data-sf-shell-shadow',
    'data-sf-shell-border',
    'data-sf-shell-scope'
  ]) {
    root.removeAttribute(attr)
  }

  for (const name of SF_PERSONAL_VARS) root.style.removeProperty(name)
  removePaneBackgrounds()
}

function applyPersonal() {
  const p = $settings.get().personal || {}

  try {
    const root = document.documentElement

    // 1) Akzentfarbe → --ui-accent (färbt Buttons, aktive Zustände, Hover,
    //    Fokusringe und Hervorhebungen der App).
    const accent = String(p.accentColor || '').trim()

    if (p.accentOn && /^#[0-9a-f]{6}$/i.test(accent)) {
      root.setAttribute('data-sf-accent', 'on')
      root.style.setProperty('--sf-accent-color', accent)
    } else {
      root.removeAttribute('data-sf-accent')
      root.style.removeProperty('--sf-accent-color')
    }

    // 2) Chat-Hintergrund (Bild/Video).
    const bgPath = String(p.bgPath || '').trim()
    const hasBg = Boolean(p.bgOn) && bgPath.length > 0

    if (hasBg) {
      root.setAttribute('data-sf-bg', 'on')
      root.setAttribute('data-sf-bg-kind', p.bgKind === 'video' ? 'video' : 'image')
      root.setAttribute('data-sf-bg-scope', p.bgScope === 'all' ? 'all' : 'chat')
      root.style.setProperty('--sf-bg-url', `url("${mediaStreamUrl(bgPath)}")`)
      root.style.setProperty('--sf-bg-fit', p.bgFit === 'contain' ? 'contain' : 'cover')
      root.style.setProperty('--sf-bg-dim', `${clampNumber(p.bgDim, 0, 85, 35)}%`)
      root.style.setProperty('--sf-bg-blur', `${clampNumber(p.bgBlur, 0, 24, 0)}px`)
    } else {
      for (const attr of ['data-sf-bg', 'data-sf-bg-kind', 'data-sf-bg-scope']) {
        root.removeAttribute(attr)
      }

      for (const name of ['--sf-bg-url', '--sf-bg-fit', '--sf-bg-dim', '--sf-bg-blur']) {
        root.style.removeProperty(name)
      }
    }

    // 3) Content-Abgrenzung (runde Ecken + Schlagschatten + optionale Kontur).
    if (p.shellOn) {
      root.setAttribute('data-sf-shell', 'on')
      root.setAttribute('data-sf-shell-shadow', SHELL_SHADOWS[p.shellShadow] ? p.shellShadow : 'subtle')
      root.setAttribute('data-sf-shell-border', p.shellBorder ? 'on' : 'off')
      root.setAttribute('data-sf-shell-scope', p.shellScope === 'chat' ? 'chat' : 'all')
      root.style.setProperty('--sf-shell-radius', `${clampNumber(p.shellRadius, 4, 24, 10)}px`)
      root.style.setProperty('--sf-shell-shadow', SHELL_SHADOWS[p.shellShadow] || SHELL_SHADOWS.subtle)
    } else {
      for (const attr of ['data-sf-shell', 'data-sf-shell-shadow', 'data-sf-shell-border', 'data-sf-shell-scope']) {
        root.removeAttribute(attr)
      }

      root.style.removeProperty('--sf-shell-radius')
      root.style.removeProperty('--sf-shell-shadow')
    }

    syncPaneBackgrounds()
  } catch (error) {
    console.warn(`[${ID}] personal apply failed`, error)
    clearPersonal()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Row-Design (Liste & Grid): Hintergrund-Verlauf, Schlagschatten, Titel-Verlauf,
// Auswahl-Zustand und Live-Status ( Aktiv/Wartend ). Alles als Attribute und
// Variablen auf <html> — das Stylesheet reagiert rein deklarativ.
// ─────────────────────────────────────────────────────────────────────────────

const SF_ROW_VARS = [
  '--sf-row-from',
  '--sf-row-to',
  '--sf-row-angle',
  '--sf-title-from',
  '--sf-title-to',
  '--sf-title-angle',
  '--sf-sel-color'
]

const SF_ROW_SHADOWS = ['off', 'subtle', 'medium', 'strong']

function clearRows() {
  const root = document.documentElement

  for (const attr of [
    'data-sf-rowgrad',
    'data-sf-rowshadow',
    'data-sf-titlegrad',
    'data-sf-seltint',
    'data-sf-selborder',
    'data-sf-selshadow',
    'data-sf-rowlive'
  ]) {
    root.removeAttribute(attr)
  }

  for (const name of SF_ROW_VARS) root.style.removeProperty(name)
}

function applyRows() {
  const tabs = $settings.get().tabs || {}

  try {
    const root = document.documentElement
    const safeHex = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(String(value || '').trim()) ? String(value).trim() : fallback)

    // 1) Hintergrund-Verlauf der Zeilen (Liste) und Karten (Grid).
    if (tabs.rowGradOn) {
      root.setAttribute('data-sf-rowgrad', 'on')
      root.style.setProperty('--sf-row-from', safeHex(tabs.rowGradFrom, '#7c3aed'))
      root.style.setProperty('--sf-row-to', safeHex(tabs.rowGradTo, '#00dbda'))
      root.style.setProperty('--sf-row-angle', `${clampNumber(tabs.rowGradAngle, 0, 360, 135)}deg`)
    } else {
      root.removeAttribute('data-sf-rowgrad')
      root.style.removeProperty('--sf-row-from')
      root.style.removeProperty('--sf-row-to')
      root.style.removeProperty('--sf-row-angle')
    }

    // 2) Auswählbare Schlagschatten-Stufen.
    root.setAttribute('data-sf-rowshadow', SF_ROW_SHADOWS.includes(tabs.rowShadow) ? tabs.rowShadow : 'off')

    // 3) Titel als Verlauf.
    if (tabs.titleGradOn) {
      root.setAttribute('data-sf-titlegrad', 'on')
      root.style.setProperty('--sf-title-from', safeHex(tabs.titleGradFrom, '#e4e4e7'))
      root.style.setProperty('--sf-title-to', safeHex(tabs.titleGradTo, '#8b8b93'))
      root.style.setProperty('--sf-title-angle', `${clampNumber(tabs.titleGradAngle, 0, 360, 90)}deg`)
    } else {
      root.removeAttribute('data-sf-titlegrad')
      root.style.removeProperty('--sf-title-from')
      root.style.removeProperty('--sf-title-to')
      root.style.removeProperty('--sf-title-angle')
    }

    // 4) Auswahl-Zustand (Tönung, Kontur, Schatten).
    root.setAttribute('data-sf-seltint', ['standard', 'accent', 'custom'].includes(tabs.selTint) ? tabs.selTint : 'standard')
    root.style.setProperty('--sf-sel-color', safeHex(tabs.selColor, '#7c3aed'))
    root.setAttribute('data-sf-selborder', tabs.selBorder ? 'on' : 'off')
    root.setAttribute('data-sf-selshadow', SF_ROW_SHADOWS.includes(tabs.selShadow) ? tabs.selShadow : 'off')

    // 5) Live-Status: Aktiv/Wartend wie im Tab-Design hervorheben.
    root.setAttribute('data-sf-rowlive', tabs.rowLive ? 'on' : 'off')
  } catch (error) {
    console.warn(`[${ID}] rows apply failed`, error)
    clearRows()
  }
}

/**
 * Legt je Pane-Host einen .sf-bg-layer an bzw. aktualisiert ihn. Video nur auf
 * SICHTBAREN Panes — Keep-Alive-Panes bleiben sonst dekodierend im Hintergrund
 * (data-pane-hidden markiert inaktive Tab-Layer). Läuft im 2,5-s-Takt, damit
 * neu gemountete Panes versorgt werden; React lässt fremde Kinder in Ruhe.
 */
function syncPaneBackgrounds() {
  try {
    const p = $settings.get().personal || {}
    const bgPath = String(p.bgPath || '').trim()
    const active = Boolean(p.bgOn) && bgPath.length > 0
    const kind = p.bgKind === 'video' ? 'video' : 'image'
    const scopeAll = p.bgScope === 'all'

    for (const host of document.querySelectorAll('[data-pane-host]')) {
      const paneId = host.getAttribute('data-pane-host') || ''
      const applies = active && (scopeAll || paneId.startsWith('session-tile:'))
      const existing = host.querySelector('[data-sf-bg-layer]')

      if (!applies) {
        if (existing) {
          existing.remove()
        }

        continue
      }

      const visible = !host.hasAttribute('data-pane-hidden')
      const sig = `${kind}|${bgPath}|${p.bgFit}|${visible ? 'v' : 'h'}`

      if (existing && existing.getAttribute('data-sf-bg-sig') === sig) {
        continue
      }

      const layer = existing || document.createElement('div')

      if (!existing) {
        layer.className = 'sf-bg-layer'
        layer.setAttribute('data-sf-bg-layer', '')
        host.appendChild(layer)
      }

      layer.setAttribute('data-sf-bg-sig', sig)

      const oldVideo = layer.querySelector('[data-sf-bg-video]')

      if (oldVideo) {
        oldVideo.remove()
      }

      if (kind === 'video' && visible) {
        const video = document.createElement('video')
        video.setAttribute('data-sf-bg-video', '')
        video.setAttribute('aria-hidden', 'true')
        video.muted = true
        video.loop = true
        video.autoplay = true
        video.playsInline = true
        video.src = mediaStreamUrl(bgPath)
        layer.appendChild(video)

        const play = video.play()

        if (play && typeof play.catch === 'function') {
          play.catch(() => {})
        }
      }
    }
  } catch (error) {
    console.warn(`[${ID}] pane background sync failed`, error)
  }
}

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi']

/** Nativer Datei-Picker (App-IPC selectPaths) + Auto-Erkennung Bild/Video. */
function pickBackgroundFile() {
  try {
    const desktop = window.hermesDesktop

    if (!desktop || typeof desktop.selectPaths !== 'function') {
      console.warn(`[${ID}] selectPaths nicht verfügbar`)
      return
    }

    desktop
      .selectPaths({
        multiple: false,
        title: 'Hintergrund-Bild oder -Video wählen',
        filters: [
          {
            name: 'Bilder & Videos',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'mp4', 'webm', 'mov', 'mkv', 'm4v']
          }
        ]
      })
      .then(paths => {
        const first = Array.isArray(paths) && paths.length ? String(paths[0]) : ''

        if (!first) {
          return
        }

        const ext = (first.split('.').pop() || '').toLowerCase()
        patchSettings('personal', {
          bgPath: first,
          bgOn: true,
          bgKind: VIDEO_EXTENSIONS.includes(ext) ? 'video' : 'image'
        })
      })
      .catch(error => console.warn(`[${ID}] background picker failed`, error))
  } catch (error) {
    console.warn(`[${ID}] background picker failed`, error)
  }
}

/** Arbeitet diese gespeicherte Session gerade (denkt/schreibt/Tool/arbeitet)? */
function isSessionBusy(storedId) {
  if (!storedId) {
    return false
  }

  const detail = $activity.get()[storedId]

  if (detail && ['thinking', 'streaming', 'tool', 'working'].includes(detail.kind)) {
    return true
  }

  const live = Object.values($liveMap.get()).find(entry => entry.storedId === storedId)

  return Boolean(live && ['working', 'starting', 'resuming', 'streaming'].includes(live.status))
}

/** Arbeitet die gerade fokussierte Session? (für den Composer-Glow) */
function currentSessionBusy() {
  try {
    return isSessionBusy(host.state.focusedStoredSessionId.get() || null)
  } catch {
    return false
  }
}

/**
 * Misst den ECHTEN Radius des Composer-Surfaces und leitet daraus den
 * konzentrischen Innenradius des Glow-Rings ab (r − 1px Border).
 *
 * Warum messen statt rechnen? Der Radius folgt dem Theme-Skalar
 * (`rounded-2xl` = calc(--radius-scalar × 1.5rem)) — Tailwind v4 inlined die
 * Theme-Variablen aber, `--radius-2xl` existiert zur Laufzeit nicht. Nur der
 * gemessene Wert trifft die vorhandene Kontur exakt (Theme-unabhängig).
 */
function measureComposerRadius() {
  try {
    const surface = document.querySelector("[data-slot='composer-surface']")

    if (!surface) {
      return
    }

    const raw = getComputedStyle(surface).borderTopLeftRadius || ''
    const value = raw.split(' ')[0].trim()

    if (!value || value.endsWith('%')) {
      return
    }

    document.documentElement.style.setProperty('--sf-arc-radius', `max(0px, calc(${value} - 1px))`)
  } catch (error) {
    console.warn(`[${ID}] radius measure failed`, error)
  }
}

/**
 * Umlaufender Glow-Ring (derselbe Effekt, den Hermes bei laufenden Sessions
 * zeigt): im Modus „busy" nur, solange die aktive Session arbeitet.
 */
function syncArc() {
  const root = document.documentElement
  const glass = $settings.get().glass || {}

  try {
    if (!glass.enabled || !glass.arc) {
      root.removeAttribute('data-sf-arc')
      return
    }

    if (glass.arcMode === 'busy' && !currentSessionBusy()) {
      root.removeAttribute('data-sf-arc')
      return
    }

    root.setAttribute('data-sf-arc', 'on')
  } catch (error) {
    console.warn(`[${ID}] arc sync failed`, error)
    root.removeAttribute('data-sf-arc')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI-Tabs — Content-Tab-Leiste im Sidebar-Look (+ Live-Info aus der Engine)
// ─────────────────────────────────────────────────────────────────────────────

const SF_UITABS_VARS = [
  '--sf-ui-tab-radius',
  '--sf-ui-tab-gap',
  '--sf-ui-tab-inset-y',
  '--sf-ui-tab-label-size',
  '--sf-ui-tab-close-w'
]

/** Räumt Tokens/Variablen + Tab-Markierungen restlos ab. */
function clearUiTabs() {
  const root = document.documentElement
  root.removeAttribute('data-sf-ui-tabs')

  for (const name of SF_UITABS_VARS) {
    root.style.removeProperty(name)
  }

  try {
    document.querySelectorAll('[data-sf-tab-busy],[data-sf-ui-tab]').forEach(tab => {
      tab.removeAttribute('data-sf-tab-busy')
      tab.removeAttribute('data-sf-ui-tab')
    })
  } catch {
    /* DOM evtl. schon weg — egal */
  }
}

/**
 * Spiegelt die UI-Tabs-Einstellungen als Tokens + Variablen auf <html>.
 * (Rein deklarativ: das Stylesheet reagiert per Selektor — nie CSS-Rebuild.)
 */
function applyUiTabs() {
  const cfg = $settings.get().uiTabs || {}

  try {
    if (!cfg.enabled) {
      clearUiTabs()
      return
    }

    const root = document.documentElement
    const tokens = ['on']

    if (cfg.separators) tokens.push('sep')
    if (!cfg.showLead) tokens.push('nolead')
    tokens.push(
      cfg.activeStyle === 'underline'
        ? 'active-underline'
        : cfg.activeStyle === 'both'
          ? 'active-both'
          : 'active-sidebar'
    )
    tokens.push(cfg.labelCase === 'upper' ? 'case-upper' : 'case-normal')
    if (cfg.closeMode === 'always') tokens.push('close-always')
    else if (cfg.closeMode === 'active') tokens.push('close-active')
    if (!cfg.closeHover) tokens.push('noclosehover')
    if (!cfg.arc) tokens.push('noarc')

    root.setAttribute('data-sf-ui-tabs', tokens.join(' '))
    root.style.setProperty('--sf-ui-tab-radius', `${clampNumber(cfg.radius, 0, 12, 4)}px`)
    root.style.setProperty('--sf-ui-tab-gap', `${clampNumber(cfg.gap, 0, 10, 2)}px`)
    root.style.setProperty('--sf-ui-tab-inset-y', `${clampNumber(cfg.insetY, 0, 8, 2)}px`)
    root.style.setProperty('--sf-ui-tab-label-size', `${clampNumber(cfg.labelSize, 9, 14, 11)}px`)
    root.style.setProperty('--sf-ui-tab-close-w', `${clampNumber(cfg.closeWidth, 14, 32, 22)}px`)
    syncTabBusy()
  } catch (error) {
    console.warn(`[${ID}] ui tabs apply failed`, error)
    clearUiTabs()
  }
}

/**
 * Markiert Session-Tabs arbeitender Sessions (denkt/schreibt/Tool/arbeitet) —
 * dieselbe Live-Info, die auch die Sidebar (Status-Punkt/Arc) zeigt. Das CSS
 * zeichnet darauf den umlaufenden Glow-Ring.
 */
function syncTabBusy() {
  try {
    // Styling-Marke: strukurell über role=tab + .pane-tab-content — die in
    // Kontextmenüs gewrappten Session-Tabs im Content-Bereich tragen NICHT
    // data-slot='pane-tab' (der Trigger überschreibt das Attribut).
    const roleTabs = document.querySelectorAll("[role='tab']")

    for (const tab of roleTabs) {
      if (tab.querySelector('[class~="pane-tab-content"]') && tab.getAttribute('data-sf-ui-tab') !== 'true') {
        tab.setAttribute('data-sf-ui-tab', 'true')
      }
    }

    // Live-Busy (Glow) für Session-Tabs — Selektor ohne data-slot, damit auch
    // die gewrappten Tabs erfasst werden.
    const sessionTabs = document.querySelectorAll("[data-tree-tab^='session-tile:']")

    for (const tab of sessionTabs) {
      const paneId = tab.getAttribute('data-tree-tab') || ''
      const busy = isSessionBusy(paneId.slice('session-tile:'.length))

      if (busy && tab.getAttribute('data-sf-tab-busy') !== 'true') {
        tab.setAttribute('data-sf-tab-busy', 'true')
      } else if (!busy && tab.hasAttribute('data-sf-tab-busy')) {
        tab.removeAttribute('data-sf-tab-busy')
      }
    }
  } catch (error) {
    console.warn(`[${ID}] tab sync failed`, error)
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
const $appDensity = atom('compact') // App-Einstellung "Dichte der Session-Liste" (sessionListDensity)

/** Folgt der App-Einstellung zur Session-Listen-Dichte (Feature-Detect). */
function watchAppDensity() {
  try {
    const settingsApi = host.settings

    if (!settingsApi || typeof settingsApi.get !== 'function') {
      return () => {}
    }

    try {
      $appDensity.set(String(settingsApi.get('sessionListDensity') || 'compact'))
    } catch {
      $appDensity.set('compact')
    }

    if (typeof settingsApi.subscribe === 'function') {
      return settingsApi.subscribe('sessionListDensity', value => {
        $appDensity.set(String(value || 'compact'))
      })
    }
  } catch {
    /* ältere Builds ohne settings-API */
  }

  return () => {}
}

let refreshInFlight = null

/** CWD der zuletzt bekannten Session (Fallback, wenn kein Projekt bestimmt ist). */
function lastSessionCwd() {
  const rows = $sessions.get()

  for (const row of rows) {
    const cwd = String(row.cwd || '').trim()

    if (cwd) {
      return cwd
    }
  }

  return ''
}

/**
 * Ziel-CWD für eine neue Session: zuerst das zuletzt gewählte Projekt
 * (projectScope im App-localStorage; '__no_project__' = Home bleibt bewusst
 * abgekoppelt), dann das aktive Projekt (projects.db `active_id`), zuletzt die
 * zuletzt bekannte Session-CWD. Leer = das Backend löst selbst auf.
 */
async function resolveNewProjectSessionCwd() {
  let scopeId = ''
  let activeId = ''
  let projects = []

  try {
    scopeId = String(window.localStorage?.getItem('hermes.desktop.projectScope') || '')
  } catch {
    scopeId = ''
  }

  try {
    const payload = await host.request('projects.list', {})
    projects = Array.isArray(payload?.projects) ? payload.projects : []
    activeId = String(payload?.active_id || '')
  } catch {
    // Älteres Backend ohne projects.* — der Fallback unten greift.
  }

  if (scopeId === '__no_project__') {
    return { cwd: '', label: '' }
  }

  const wantedId = (scopeId && scopeId !== '__all_projects__' ? scopeId : '') || activeId

  if (wantedId) {
    const project = projects.find(entry => entry?.id === wantedId)
    const cwd = String(project?.primary_path || '').trim()

    if (cwd) {
      return { cwd, label: String(project?.name || '') }
    }
  }

  return { cwd: lastSessionCwd(), label: '' }
}

/** Neue Session im zuletzt gewählten Projekt starten (Kern-Params wie die App). */
async function startNewProjectSession() {
  try {
    const target = await resolveNewProjectSessionCwd()
    const params = { cols: 96, source: 'desktop' }

    if (target.cwd) {
      params.cwd = target.cwd
      params.cwd_explicit = true
    }

    try {
      const profile = host.state?.focusedSessionProfile?.get?.()

      if (typeof profile === 'string' && profile.trim()) {
        params.profile = profile.trim()
      }
    } catch {
      // Ohne Profil resolve-t das Backend selbst.
    }

    const created = await host.request('session.create', params)
    const createdId = String(created?.stored_session_id || created?.session_id || '').trim()

    if (!createdId) {
      throw new Error('session.create lieferte keine Session-ID')
    }

    await host.openSession(createdId, { intent: readSetting('tabs', 'openIntent') || 'in-place' })
    scheduleSessionsRefresh(1500)
    host.notify({
      kind: 'success',
      message: `${CTX?.i18n?.t('newSession') || 'Neue Session'}${target.label ? ` · ${target.label}` : ''}`
    })
  } catch (error) {
    host.notifyError(error, CTX?.i18n?.t('newSession') || 'Neue Session')
  }
}

/** Grid-Layout-Variablen der Session-Ansicht auf <html> spiegeln. */
function applyGrid() {
  try {
    const tabs = $settings.get().tabs || {}
    const root = document.documentElement
    const cols = String(tabs.gridCols || 'auto')
    const fixedCols = ['1', '2', '3', '4'].includes(cols)

    root.style.setProperty('--sf-grid-cols', fixedCols ? cols : 'auto-fill')
    root.style.setProperty('--sf-grid-min', fixedCols ? '0px' : `${clampNumber(tabs.gridMin, 110, 280, 150)}px`)
    root.style.setProperty('--sf-grid-gap', `${clampNumber(tabs.gridGap, 2, 16, 6)}px`)
    root.style.setProperty('--sf-grid-lines', String(clampNumber(tabs.gridLines, 1, 4, 2)))
  } catch (error) {
    console.warn(`[${ID}] grid apply failed`, error)
  }
}

function normalizeRow(row) {
  const id = String(row?.id || '')
  return {
    id,
    title: String(row?.title || '').trim(),
    preview: String(row?.preview || '').trim(),
    cwd: String(row?.cwd || '').trim(),
    branch: String(row?.git_branch || '').trim(),
    model: String(row?.model || '').trim(),
    toolCount: Number(row?.tool_call_count || 0),
    pinned: Boolean(row?.pinned),
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
      scheduleContextRefresh(1200)
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

// ─────────────────────────────────────────────────────────────────────────────
// Kontextfenster-Info (reduziert): Prozent-Label je Zeile/Karte für LIVE-
// Sessions über den read-only RPC `session.context_breakdown` (kein Provider-
// Call, kein Prompt-Cache-Impact). Läuft nur bei eingeschalteter Option.
// ─────────────────────────────────────────────────────────────────────────────

const $ctxInfo = atom({}) // storedId -> { used, max, percent, est, at }

let ctxRefreshTimer = 0
let ctxRefreshInFlight = false

async function refreshContextInfo() {
  if (ctxRefreshInFlight || !readSetting('tabs', 'showContext')) {
    return
  }

  const live = $liveMap.get() || {}
  const entries = Object.entries(live)
    .map(([runtimeId, entry]) => ({ runtimeId, storedId: String((entry && entry.storedId) || '') }))
    .filter(pair => pair.runtimeId && pair.storedId)
    .slice(0, 10)

  if (!entries.length) {
    if (Object.keys($ctxInfo.get()).length) {
      $ctxInfo.set({})
    }

    return
  }

  ctxRefreshInFlight = true

  try {
    const next = {}

    for (const { runtimeId, storedId } of entries) {
      try {
        // Live-Doors (SessionParams) adressieren Sessions über ihre RUNTIME-ID;
        // die durable Stored-ID lehnt das Gateway mit "session not found" ab.
        const result = await host.request('session.context_breakdown', { session_id: runtimeId })
        const max = Number(result?.context_max || 0)

        if (max > 0) {
          const used = Number(result?.context_used || 0)
          const percentRaw = Number(result?.context_percent)
          next[storedId] = {
            used,
            max,
            percent: Number.isFinite(percentRaw) && percentRaw >= 0 ? Math.round(percentRaw) : Math.round((used / max) * 100),
            est: Boolean(result?.context_estimated),
            at: Date.now()
          }
        }
      } catch {
        /* Session nicht (mehr) live — Eintrag entfällt */
      }
    }

    $ctxInfo.set(next)
  } finally {
    ctxRefreshInFlight = false
  }
}

function scheduleContextRefresh(delay = 1500) {
  window.clearTimeout(ctxRefreshTimer)
  ctxRefreshTimer = window.setTimeout(() => {
    void refreshContextInfo()
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
  secAnimationDesc: 'How assistant answers appear — cascade on open, line by line while streaming.',
  animEnabled: 'Line animation enabled',
  animEnabledDesc: 'Assistant lines ease in instead of popping at once.',
  animHistoryCascade: 'Cascade history on open',
  animHistoryCascadeDesc: 'When a chat loads or is switched, its visible lines cascade in top to bottom.',
  animStreamReveal: 'Line-by-line while streaming',
  animStreamRevealDesc: 'Each line animates once as soon as it is fully written.',
  animDuration: 'Duration (ms)',
  animDurationDesc: 'How long a single line takes to ease in.',
  animStagger: 'Stagger per line (ms)',
  animStaggerDesc: 'Delay between consecutive lines of the cascade.',
  animMaxSteps: 'Max stagger steps',
  animMaxStepsDesc: 'Caps total cascade time on long answers.',
  animTravel: 'Travel (px)',
  animTravelDesc: 'How far a line slides in — 0 is a pure fade.',
  animEasing: 'Easing',
  animEasingDesc: 'Motion curve: soft/smooth/gentle are calm, springy adds a light overshoot.',
  animSkipReasoning: 'Skip thinking blocks',
  animSkipReasoningDesc: 'Show reasoning/thinking content without the line animation.',
  animIncludeCode: 'Animate code blocks',
  animIncludeCodeDesc: 'Also animate fenced code blocks.',
  animIncludeLists: 'Animate list items individually',
  animIncludeListsDesc: 'Animate each list item on its own.',
  easingSmooth: 'Smooth (expo)',
  easingSoft: 'Soft',
  easingGentle: 'Gentle',
  easingBack: 'Springy',

  // Settings — Ctrl+Scroll
  secWheel: 'Ctrl+Scroll session cycling',
  secWheelDesc: 'Cycle through your sessions with the wheel — without clicking.',
  wheelEnabled: 'Enabled',
  wheelEnabledDesc: 'Scroll through active sessions with a modifier key + wheel.',
  wheelModifier: 'Modifier key',
  wheelModifierDesc: 'Key you hold while scrolling to cycle sessions.',
  wheelModCtrl: 'Ctrl',
  wheelModAlt: 'Alt',
  wheelModCtrlShift: 'Ctrl+Shift',
  wheelModMeta: 'Meta',
  wheelThreshold: 'Threshold (delta)',
  wheelThresholdDesc: 'How much wheel movement advances one session.',
  wheelCooldown: 'Cooldown (ms)',
  wheelCooldownDesc: 'Minimum gap between two switches — prevents speed-running.',
  wheelInvert: 'Invert direction',
  wheelInvertDesc: 'Reverse the direction — wheel up then goes forward.',
  wheelWrap: 'Wrap at the end',
  wheelWrapDesc: 'After the last session, continue at the first.',
  wheelHud: 'Show HUD',
  wheelHudDesc: 'Briefly overlay the position and title of the session.',
  wheelHudMs: 'HUD duration (ms)',
  wheelHudMsDesc: 'How long the HUD overlay stays visible.',
  wheelIgnore: 'Ignore selectors (CSS)',
  wheelIgnoreDesc: 'Zones where Ctrl+Scroll does not engage (comma separated). Default: images, Monaco, canvas.',
  wheelHint: 'Tip: zoom surfaces (image lightbox, code editor) keep their own Ctrl+Scroll behaviour.',

  // Settings — tabs
  secTabs: 'Session tabs',
  secTabsDesc: 'What the session tabs show and how a click opens a session.',
  tabsDensity: 'Density',
  tabsDensityDesc: 'Compact shows one line per tab; cozy adds the preview line.',
  tabsDensityCompact: 'Compact',
  tabsDensityCozy: 'Cozy',
  tabsStatusStyle: 'Status display',
  tabsStatusStyleDesc: 'Activity marker per tab: icon, core status dot, or both.',
  tabsStatusGlyph: 'Icon',
  tabsStatusDot: 'Dot',
  tabsStatusBoth: 'Icon + dot',
  tabsDesignHead: 'Design — List & Grid',
  tabsRowGrad: 'Row background gradient',
  tabsRowGradDesc: 'Paints session rows (list) and cards (grid) with a two-color gradient.',
  tabsRowGradFrom: 'Gradient start color',
  tabsRowGradFromDesc: 'First color of the row gradient (left/top depending on angle).',
  tabsRowGradTo: 'Gradient end color',
  tabsRowGradToDesc: 'Second color of the row gradient.',
  tabsRowGradAngle: 'Gradient angle',
  tabsRowGradAngleDesc: 'Direction of the gradient in degrees (0–360).',
  tabsRowShadow: 'Row drop shadow',
  tabsRowShadowDesc: 'Selectable shadow depth under rows (list) and cards (grid).',
  tabsTitleGrad: 'Gradient title',
  tabsTitleGradDesc: 'Renders session titles as two-color gradient text.',
  tabsTitleGradFrom: 'Title gradient start',
  tabsTitleGradFromDesc: 'First color of the title gradient.',
  tabsTitleGradTo: 'Title gradient end',
  tabsTitleGradToDesc: 'Second color of the title gradient.',
  tabsTitleGradAngle: 'Title gradient angle',
  tabsTitleGradAngleDesc: 'Direction of the title gradient in degrees (0–360).',
  tabsSelHead: 'Selected state',
  tabsSelTint: 'Selection tint',
  tabsSelTintDesc: 'Background tint of the selected (open) session.',
  tabsSelTintStandard: 'Standard',
  tabsSelTintAccent: 'Accent',
  tabsSelTintCustom: 'Custom color',
  tabsSelColor: 'Selection color',
  tabsSelColorDesc: 'Custom tint color for the selected state.',
  tabsSelBorder: 'Selection outline',
  tabsSelBorderDesc: 'Thin outline around the selected row (uses the selection tint).',
  tabsSelShadow: 'Selection shadow',
  tabsSelShadowDesc: 'Selectable shadow depth for the selected row/card.',
  tabsLiveHead: 'Live status',
  tabsRowLive: 'Highlight active & waiting',
  tabsRowLiveDesc: 'Sessions that are working or waiting get an accent glow and a pulsing status icon — the same visual language as the tab design.',
  tabsShowContext: 'Context window (compact)',
  tabsShowContextDesc: 'Compact percent label per row/card for live sessions (read-only context breakdown; no provider call). Turns amber above 70 % and red above 90 %.',
  ctxTooltip: (used, max, pct) => `Context window: ${used} / ${max} (${pct} %)`,

  tabsShowTime: 'Show time',
  tabsShowTimeDesc: 'How long ago the session was last active.',
  tabsShowPreview: 'Show preview',
  tabsShowPreviewDesc: 'Last message as a second line (cozy density only).',
  tabsShowCounts: 'Show message count',
  tabsShowCountsDesc: 'Message count next to the title.',
  tabsShowSource: 'Show source (Telegram, cron, …)',
  tabsShowSourceDesc: 'Badge showing where the session came from.',
  tabsOpenIntent: 'Open as',
  tabsOpenIntentDesc: 'What a click does: replace the open chat, stack beside it, or open a tab.',
  tabsOpenIntentInPlace: 'Replace',
  tabsOpenIntentStack: 'Stack',
  tabsOpenIntentTab: 'Tab',
  tabsMaxItems: 'Max sessions',
  tabsMaxItemsDesc: 'Upper limit of sessions listed.',
  tabsHideCron: 'Hide cron sessions',
  tabsHideCronDesc: 'Cron runs would fill the list; the sidebar also shows them separately.',
  tabsLivePoll: 'Live status poll (s)',
  tabsLivePollDesc: 'Interval of the live status check (thinking / writing / tool).',
  tabsRefresh: 'List refresh (s)',
  tabsRefreshDesc: 'Interval at which the session list is re-read.',

  // Settings — groups
  secGroups: 'Tab groups',
  secGroupsDesc: 'Bundle sessions into named, coloured groups — Firefox style.',
  groupsEnabled: 'Groups enabled',
  groupsEnabledDesc: 'Firefox-style groups with name, color, and collapse stack.',
  groupsAutoMode: 'Automatic grouping',
  groupsAutoModeDesc: 'Group automatically by date or source; off keeps everything manual.',
  groupsAutoOff: 'Off (manual only)',
  groupsAutoDate: 'By date',
  groupsAutoSource: 'By source',
  groupsStackStyle: 'Stack style (collapsed)',
  groupsStackStyleDesc: 'Look of a collapsed group: spine, fanned cards, or a pill.',
  stackSpine: 'Spine',
  stackFanned: 'Fanned',
  stackPill: 'Pill',
  groupsShowUngrouped: 'Show "Ungrouped" section',
  groupsShowUngroupedDesc: 'Show the ungrouped bucket while automatic grouping is off.',
  groupsHint: 'Manage groups via right-click on a tab or a group header. Drag & drop moves sessions into groups.',

  // Settings — about
  secAbout: 'About',
  secAboutDesc: 'Version, counters, and the reset actions.',
  aboutVersion: 'Version',
  aboutVersionDesc: 'Version currently loaded by the app.',
  aboutDeveloper: 'Developer & license holder',
  aboutDeveloperDesc: 'Session Flow is an open-source project by AGANTILA — Deniz Yilmaz.',
  aboutLicense: 'License',
  aboutLicenseDesc: 'MIT — free to use, modify, and share (see LICENSE in the repo).',
  aboutStats: (sessions, groups) => `${sessions} sessions · ${groups} groups`,
  aboutStatsDesc: 'Sessions and manual groups in the current list.',
  aboutResetSettings: 'Reset settings',
  aboutResetSettingsDesc: 'Restore every option on this page to its default.',
  aboutResetGroups: 'Reset groups',
  aboutResetGroupsDesc: 'Delete all manual groups — the sessions stay in the list.',
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

  // Settings navigation + UI-tab presets
  navChat: 'Chat',
  navWheel: 'Ctrl+Scroll',
  navSessions: 'Session list',
  navGroups: 'Groups',
  navUiTabs: 'UI tabs',
  navGlass: 'Glass',
  navAbout: 'About',
  uiTabsPresets: 'Quick presets',
  uiTabsPresetsDesc: 'One click to a known-good look — every option below stays adjustable.',
  uiTabsPresetSidebar: 'Sidebar look',
  uiTabsPresetMinimal: 'Minimal',
  uiTabsPresetStock: 'Hermes stock',

  // UI tabs (content tab strip)
  secUiTabs: 'UI tabs (content strip)',
  secUiTabsDesc: 'How the content tab strip looks — sidebar-style chips, label and close behaviour.',
  uiTabsEnabled: 'Sidebar-style tabs',
  uiTabsEnabledDesc: 'Restyled content tabs: rounded chips, calmer label, a friendlier close button.',
  uiTabsRadius: 'Corner radius (px)',
  uiTabsRadiusDesc: 'How round a tab is — 4 px reads like the sidebar rows.',
  uiTabsGap: 'Gap between tabs (px)',
  uiTabsGapDesc: 'Air between neighbouring tabs.',
  uiTabsInset: 'Vertical inset (px)',
  uiTabsInsetDesc: 'Lifts tabs off the strip edge — 0 fills the bar like stock.',
  uiTabsSeparators: 'Divider lines',
  uiTabsSeparatorsDesc: 'Keep the thin lines between tabs (off looks cleaner with rounded chips).',
  uiTabsActive: 'Active tab',
  uiTabsActiveDesc: 'Filled like a sidebar row, the app underline, or both.',
  uiTabsActiveSidebar: 'Filled',
  uiTabsActiveUnderline: 'Underline',
  uiTabsActiveBoth: 'Both',
  uiTabsLabelCase: 'Label case',
  uiTabsLabelCaseDesc: 'As written, or the app uppercase.',
  uiTabsCaseNormal: 'As written',
  uiTabsCaseUpper: 'UPPERCASE',
  uiTabsLabelSize: 'Label size (px)',
  uiTabsLabelSizeDesc: 'Font size of the tab title.',
  uiTabsShowLead: 'Session status dot',
  uiTabsShowLeadDesc: 'The live status (and colour) dot from the sidebar, before the title.',
  uiTabsCloseMode: 'Close button',
  uiTabsCloseModeDesc: 'When the ✕ appears: on hover, always, or only on the active tab.',
  uiTabsCloseOnHover: 'On hover',
  uiTabsCloseAlways: 'Always',
  uiTabsCloseActive: 'Active tab',
  uiTabsCloseWidth: 'Close hit area (px)',
  uiTabsCloseWidthDesc: 'Width of the clickable ✕ zone.',
  uiTabsCloseHoverBg: 'Highlight on hover',
  uiTabsCloseHoverBgDesc: 'A soft chip behind the ✕ while hovered.',
  uiTabsArc: 'Glow on working tabs',
  uiTabsArcDesc: 'Sessions that are thinking / writing / running tools get the travelling glow ring, as in the sidebar.',
  uiTabsHint: 'Applies to the content tab strip (all panes). Status info comes from the same live engine as the sidebar.',

  // Glass & readability
  secGlass: 'Glass & readability',
  secGlassDesc: 'Optional frost plus an accent gradient behind chips and the input field.',
  glassEnabled: 'Glass effect',
  glassEnabledDesc:
    'Gives the input field and chips a soft frosted fill with a subtle accent gradient — labels stay readable even over busy backdrops.',
  glassBlur: 'Blur (px)',
  glassBlurDesc: 'Frost strength in pixels — higher blurs more of the backdrop.',
  glassSaturate: 'Saturation (%)',
  glassSaturateDesc: 'Colour richness of the frosted surface.',
  glassFill: 'Fill opacity (%)',
  glassFillDesc: 'Opacity of the surface — higher is more solid, less see-through.',
  glassTint: 'Accent tint (%)',
  glassTintDesc: 'How much of the Hermes accent colour mixes into the surface.',
  glassGradient: 'Accent gradient',
  glassGradientDesc: 'Linear gradient from the accent color fading to transparent, layered over the fill.',
  glassAngle: 'Gradient angle (°)',
  glassAngleDesc: 'Direction of the gradient overlay.',
  glassGradOpacity: 'Gradient strength (%)',
  glassGradOpacityDesc: 'Strength of the accent gradient.',
  glassReach: 'Gradient fades by (%)',
  glassReachDesc: 'Point where the gradient has fully faded to transparent.',
  glassRing: 'Hairline outline',
  glassRingDesc: 'A fine accent-tinted outline around chips.',
  glassArc: 'Travelling glow',
  glassArcDesc: 'A soft accent highlight runs along the border — the same effect Hermes shows on running sessions.',
  glassArcMode: 'Glow mode',
  glassArcModeDesc: 'Always visible, or only while the current session is working.',
  glassArcAlways: 'Always',
  glassArcBusy: 'While working',
  glassArcWidth: 'Glow width (px)',
  glassArcWidthDesc: 'Thickness of the travelling highlight.',
  glassArcDuration: 'Glow lap (s)',
  glassArcDurationDesc: 'Seconds one lap around the border takes.',
  glassScopeComposer: 'Input field',
  glassScopeComposerDesc: 'Input field plus the cards docked to it.',
  glassScopeChips: 'Chips (model / reasoning)',
  glassScopeChipsDesc: 'Model and reasoning pills in the composer.',
  glassScopeStatusbar: 'Status bar items',
  glassScopeStatusbarDesc: 'Items in the bar along the bottom edge.',
  newSession: 'New session',
  viewSwitch: 'Switch view (list/grid)',
  tabsView: 'View',
  tabsViewDesc: 'Show sessions as a compact list or as grid cards.',
  tabsViewList: 'List',
  tabsViewGrid: 'Grid',
  tabsGridMin: 'Grid: card width (px)',
  tabsGridMinDesc: 'Minimum width of a grid card; columns fill the pane automatically.',
  tabsGridGap: 'Grid: gap (px)',
  tabsGridGapDesc: 'Space between grid cards.',
  tabsGridLines: 'Grid: title lines',
  tabsGridLinesDesc: 'How many lines a card title may use before it is clipped.',
  tabsGridPreview: 'Grid: preview text',
  tabsGridPreviewDesc: 'Shows the last-message preview on grid cards.',
  rowMore: 'More actions',
  termOpen: 'Open in terminal',
  renameMenu: 'Rename…',
  renameDialogTitle: 'Rename session',
  renameConfirm: 'Rename',
  sessionTitleLabel: 'Title',
  sessionColorAction: 'Color…',
  branchSession: 'Branch',
  moveToProject: 'Move to project…',
  moveNoProjects: 'No projects found',
  archiveSession: 'Archive',
  deleteSession: 'Delete',
  deleteConfirmTitle: 'Delete session?',
  deleteConfirmBody: 'Removes the session and its transcript — this cannot be undone.',
  copySessionId: 'Copy ID',
  renameLiveOnly: 'Renaming is available once the session is active/loaded — open it, then rename.',
  tabsGridCols: 'Grid: columns',
  tabsGridColsDesc: 'Fixed column count, or automatic based on card width.',
  tabsGridColsAuto: 'Auto',
  tabsInfoDensity: 'Info density',
  tabsInfoDensityDesc: 'How much context each entry shows — like Hermes Desktop. Comfortable adds branch/model/counters, Detailed also the preview line. Follow Hermes mirrors the app setting live.',
  infoDensityAuto: 'Follow Hermes',
  infoDensityCompact: 'Compact',
  infoDensityComfortable: 'Comfortable',
  infoDensityDetailed: 'Detailed',
  metaMessages: n => `${n} messages`,
  metaToolCalls: n => `${n} tool calls`,
  unpin: 'Unpin',
  navPersonal: 'Personal',
  secPersonal: 'Personalization',
  secPersonalDesc: 'Accent tint for core UI, a custom chat background (image or video), and a content area framed with rounded corners and a soft shadow.',
  personalAccentOn: 'Accent tint',
  personalAccentOnDesc: 'Applies your own accent color to core UI elements — buttons, active states, hovers, focus rings and highlights.',
  personalAccentColor: 'Accent color',
  personalAccentColorDesc: 'Pick a swatch or type a hex value (#rrggbb).',
  personalAccentReset: 'Reset',
  personalAccentHint: 'Takes effect immediately; disabling restores the theme accent.',
  personalBgOn: 'Chat background',
  personalBgOnDesc: 'Shows your own image or video behind the chat messages.',
  personalBgKind: 'Background type',
  personalBgKindDesc: 'Image (static file) or video (muted, loops automatically).',
  personalBgKindImage: 'Image',
  personalBgKindVideo: 'Video',
  personalBgPath: 'File',
  personalBgPathDesc: 'Absolute path to a local image or video file.',
  personalBgPathPick: 'Choose…',
  personalBgPathHint: 'Pick a file with "Choose…" or paste a path like /home/deniz/Pictures/bg.jpg.',
  personalBgFit: 'Fit',
  personalBgFitDesc: 'How the media fills the pane.',
  personalBgFitCover: 'Cover',
  personalBgFitContain: 'Contain',
  personalBgDim: 'Dim %',
  personalBgDimDesc: 'Darkens the background so text stays readable (0 = off).',
  personalBgBlur: 'Blur px',
  personalBgBlurDesc: 'Softens the background image (0 = off).',
  personalBgScope: 'Applies to',
  personalBgScopeDesc: 'Only session chats, or every pane view.',
  personalBgScopeChat: 'Chats',
  personalBgScopeAll: 'All panes',
  personalShellOn: 'Frame content area',
  personalShellOnDesc: 'Rounds the view area of tabs and lifts it with a soft drop shadow.',
  personalShellRadius: 'Corner radius px',
  personalShellRadiusDesc: 'Roundness of the content area corners.',
  personalShellShadow: 'Shadow',
  personalShellShadowDesc: 'Strength of the drop shadow.',
  personalShellShadowOff: 'Off',
  personalShellShadowSubtle: 'Subtle',
  personalShellShadowMedium: 'Medium',
  personalShellShadowStrong: 'Strong',
  personalShellBorder: 'Hairline outline',
  personalShellBorderDesc: 'Draws a fine line around the content area.',
  personalShellScope: 'Applies to',
  personalShellScopeDesc: 'Only session chats, or every pane view.',
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
  secAnimationDesc: 'Wie Antworten erscheinen — Kaskade beim Öffnen, Zeile für Zeile beim Streamen.',
  animEnabled: 'Zeilen-Animation aktiv',
  animEnabledDesc: 'Antwortzeilen werden mit Easing eingeblendet statt sofort zu erscheinen.',
  animHistoryCascade: 'Verlauf beim Öffnen kaskadieren',
  animHistoryCascadeDesc: 'Beim Laden oder Wechseln eines Chats laufen die sichtbaren Zeilen von oben nach unten ein.',
  animStreamReveal: 'Beim Streamen Zeile für Zeile',
  animStreamRevealDesc: 'Jede Zeile blendet genau einmal ein, sobald sie fertig geschrieben ist.',
  animDuration: 'Dauer (ms)',
  animDurationDesc: 'Wie lange eine einzelne Zeile zum Einblenden braucht.',
  animStagger: 'Versatz pro Zeile (ms)',
  animStaggerDesc: 'Verzögerung zwischen aufeinanderfolgenden Zeilen der Kaskade.',
  animMaxSteps: 'Max. Staffel-Schritte',
  animMaxStepsDesc: 'Deckelt die Gesamtlaufzeit der Kaskade bei langen Antworten.',
  animTravel: 'Bewegung (px)',
  animTravelDesc: 'Wie weit eine Zeile einfliegt — 0 bedeutet reines Einblenden.',
  animEasing: 'Easing',
  animEasingDesc: 'Bewegungskurve: weich/sanft/ruhig sind ruhig, federnd schwingt leicht über.',
  animSkipReasoning: 'Thinking-Blöcke überspringen',
  animSkipReasoningDesc: 'Reasoning-/Thinking-Inhalte ohne Zeilen-Animation anzeigen.',
  animIncludeCode: 'Code-Blöcke mitanimieren',
  animIncludeCodeDesc: 'Auch Code-Blöcke animieren.',
  animIncludeLists: 'Listenpunkte einzeln animieren',
  animIncludeListsDesc: 'Jeden Listenpunkt einzeln animieren.',
  easingSmooth: 'Sanft (Expo)',
  easingSoft: 'Weich',
  easingGentle: 'Ruhig',
  easingBack: 'Federnd',

  secWheel: 'Strg+Scroll Sessionwechsel',
  secWheelDesc: 'Mit dem Mausrad durch die Sessions wechseln — ohne Klicken.',
  wheelEnabled: 'Aktiviert',
  wheelEnabledDesc: 'Mit Zusatztaste + Mausrad durch die aktiven Sessions scrollen.',
  wheelModifier: 'Zusatztaste',
  wheelModifierDesc: 'Taste, die beim Scrollen gehalten wird, um Sessions zu wechseln.',
  wheelModCtrl: 'Strg',
  wheelModAlt: 'Alt',
  wheelModCtrlShift: 'Strg+Umschalt',
  wheelModMeta: 'Meta',
  wheelThreshold: 'Schwelle (Delta)',
  wheelThresholdDesc: 'So viel Mausrad-Bewegung, bis eine Session weiter geschaltet wird.',
  wheelCooldown: 'Sperrzeit (ms)',
  wheelCooldownDesc: 'Mindestabstand zwischen zwei Wechseln — verhindert Durchrasen.',
  wheelInvert: 'Richtung umkehren',
  wheelInvertDesc: 'Richtung umkehren — Rad nach oben schaltet dann vorwärts.',
  wheelWrap: 'Am Ende umlaufen',
  wheelWrapDesc: 'Nach der letzten Session wieder bei der ersten weiterlaufen.',
  wheelHud: 'HUD anzeigen',
  wheelHudDesc: 'Kurz ein Overlay mit Position und Titel der Session einblenden.',
  wheelHudMs: 'HUD-Dauer (ms)',
  wheelHudMsDesc: 'Wie lange das HUD-Overlay sichtbar bleibt.',
  wheelIgnore: 'Ignorier-Selektoren (CSS)',
  wheelIgnoreDesc: 'Zonen, in denen Strg+Scroll nicht greift (kommasepariert). Standard: Bilder, Monaco, Canvas.',
  wheelHint: 'Tipp: Zoom-Flächen (Bild-Lightbox, Code-Editor) behalten ihr eigenes Strg+Scroll-Verhalten.',

  secTabs: 'Session-Tabs',
  secTabsDesc: 'Was die Session-Tabs zeigen und wie ein Klick eine Session öffnet.',
  tabsDensity: 'Dichte',
  tabsDensityDesc: 'Kompakt zeigt eine Zeile je Tab; bequem ergänzt die Vorschauzeile.',
  tabsDensityCompact: 'Kompakt',
  tabsDensityCozy: 'Bequem',
  tabsStatusStyle: 'Status-Darstellung',
  tabsStatusStyleDesc: 'Aktivitäts-Marker je Tab: Icon, Core-Status-Punkt oder beides.',
  tabsStatusGlyph: 'Icon',
  tabsStatusDot: 'Punkt',
  tabsStatusBoth: 'Icon + Punkt',
  tabsDesignHead: 'Design — Liste & Grid',
  tabsRowGrad: 'Zeilen-Hintergrund als Verlauf',
  tabsRowGradDesc: 'Färbt Session-Zeilen (Liste) und Karten (Grid) mit einem Zwei-Farben-Verlauf.',
  tabsRowGradFrom: 'Verlauf Startfarbe',
  tabsRowGradFromDesc: 'Erste Farbe des Zeilen-Verlaufs (links/oben je nach Winkel).',
  tabsRowGradTo: 'Verlauf Endfarbe',
  tabsRowGradToDesc: 'Zweite Farbe des Zeilen-Verlaufs.',
  tabsRowGradAngle: 'Verlaufswinkel',
  tabsRowGradAngleDesc: 'Richtung des Verlaufs in Grad (0–360).',
  tabsRowShadow: 'Zeilen-Schlagschatten',
  tabsRowShadowDesc: 'Auswählbare Schattenstärke unter Zeilen (Liste) und Karten (Grid).',
  tabsTitleGrad: 'Titel als Verlauf',
  tabsTitleGradDesc: 'Stellt Session-Titel als Zwei-Farben-Verlauf dar.',
  tabsTitleGradFrom: 'Titel Verlauf-Start',
  tabsTitleGradFromDesc: 'Erste Farbe des Titel-Verlaufs.',
  tabsTitleGradTo: 'Titel Verlauf-Ende',
  tabsTitleGradToDesc: 'Zweite Farbe des Titel-Verlaufs.',
  tabsTitleGradAngle: 'Titel Verlaufswinkel',
  tabsTitleGradAngleDesc: 'Richtung des Titel-Verlaufs in Grad (0–360).',
  tabsSelHead: 'Auswahl-Zustand',
  tabsSelTint: 'Auswahl-Tönung',
  tabsSelTintDesc: 'Hintergrund-Tönung der ausgewählten (geöffneten) Session.',
  tabsSelTintStandard: 'Standard',
  tabsSelTintAccent: 'Akzent',
  tabsSelTintCustom: 'Eigene Farbe',
  tabsSelColor: 'Auswahl-Farbe',
  tabsSelColorDesc: 'Eigene Tönungsfarbe für den Auswahl-Zustand.',
  tabsSelBorder: 'Auswahl-Kontur',
  tabsSelBorderDesc: 'Dünne Kontur um die ausgewählte Zeile (nutzt die Auswahl-Tönung).',
  tabsSelShadow: 'Auswahl-Schatten',
  tabsSelShadowDesc: 'Auswählbare Schattenstärke für die ausgewählte Zeile/Karte.',
  tabsLiveHead: 'Live-Status',
  tabsRowLive: 'Aktiv & Wartend hervorheben',
  tabsRowLiveDesc: 'Arbeitende oder wartende Sessions erhalten einen Akzent-Glow und ein pulsierendes Status-Icon — die gleiche Bildsprache wie im Tab-Design.',
  tabsShowContext: 'Kontextfenster (kompakt)',
  tabsShowContextDesc: 'Kompaktes Prozent-Label je Zeile/Karte für Live-Sessions (read-only Context-Breakdown; kein Provider-Call). Ab 70 % bernstein, ab 90 % rot.',
  ctxTooltip: (used, max, pct) => `Kontextfenster: ${used} / ${max} (${pct} %)`,

  tabsShowTime: 'Zeit anzeigen',
  tabsShowTimeDesc: 'Wie lange die letzte Aktivität der Session her ist.',
  tabsShowPreview: 'Vorschau anzeigen',
  tabsShowPreviewDesc: 'Letzte Nachricht als zweite Zeile (nur bei Dichte bequem).',
  tabsShowCounts: 'Nachrichtenanzahl anzeigen',
  tabsShowCountsDesc: 'Nachrichtenanzahl neben dem Titel.',
  tabsShowSource: 'Quelle anzeigen (Telegram, Cron, …)',
  tabsShowSourceDesc: 'Kennzeichnung, woher die Session stammt.',
  tabsOpenIntent: 'Öffnen als',
  tabsOpenIntentDesc: 'Was ein Klick tut: Chat ersetzen, daneben stapeln oder als Tab öffnen.',
  tabsOpenIntentInPlace: 'Ersetzen',
  tabsOpenIntentStack: 'Stapeln',
  tabsOpenIntentTab: 'Tab',
  tabsMaxItems: 'Max. Sessions',
  tabsMaxItemsDesc: 'Obergrenze der aufgelisteten Sessions.',
  tabsHideCron: 'Cron-Sessions ausblenden',
  tabsHideCronDesc: 'Cron-Läufe füllen sonst die Liste; die Sidebar zeigt sie ebenfalls separat.',
  tabsLivePoll: 'Live-Status-Abfrage (s)',
  tabsLivePollDesc: 'Intervall der Live-Status-Abfrage (denkt / schreibt / Tool).',
  tabsRefresh: 'Listen-Refresh (s)',
  tabsRefreshDesc: 'Intervall, in dem die Session-Liste neu gelesen wird.',

  secGroups: 'Tab-Gruppen',
  secGroupsDesc: 'Sessions in benannte, farbige Gruppen bündeln — im Firefox-Stil.',
  groupsEnabled: 'Gruppen aktiviert',
  groupsEnabledDesc: 'Firefox-artige Gruppen mit Name, Farbe und Collapse-Stapel.',
  groupsAutoMode: 'Automatische Gruppierung',
  groupsAutoModeDesc: 'Automatisch nach Datum oder Quelle gruppieren; aus bedeutet nur manuelle Gruppen.',
  groupsAutoOff: 'Aus (nur manuell)',
  groupsAutoDate: 'Nach Datum',
  groupsAutoSource: 'Nach Quelle',
  groupsStackStyle: 'Stapel-Stil (eingeklappt)',
  groupsStackStyleDesc: 'Optik einer eingeklappten Gruppe: Rücken, gefächerte Karten oder Pille.',
  stackSpine: 'Rücken',
  stackFanned: 'Gefächert',
  stackPill: 'Pille',
  groupsShowUngrouped: '„Nicht gruppiert"-Bereich zeigen',
  groupsShowUngroupedDesc: 'Zeigt den Bereich „Nicht gruppiert", solange die Auto-Gruppierung aus ist.',
  groupsHint: 'Gruppen verwaltest du per Rechtsklick auf einen Tab oder die Gruppen-Überschrift. Ziehen & Ablegen sortiert Sessions ein.',

  secAbout: 'Über',
  secAboutDesc: 'Version, Zähler und die Zurücksetzen-Aktionen.',
  aboutVersion: 'Version',
  aboutVersionDesc: 'Version, die die App aktuell geladen hat.',
  aboutDeveloper: 'Entwickler & Lizenzinhaber',
  aboutDeveloperDesc: 'Session Flow ist ein Open-Source-Projekt von AGANTILA — Deniz Yilmaz (agantila.com).',
  aboutLicense: 'Lizenz',
  aboutLicenseDesc: 'MIT — frei nutzbar, veränderbar und teilbar (siehe LICENSE im Repo).',
  aboutStats: (sessions, groups) => `${sessions} Sessions · ${groups} Gruppen`,
  aboutStatsDesc: 'Sessions und manuelle Gruppen in der aktuellen Liste.',
  aboutResetSettings: 'Einstellungen zurücksetzen',
  aboutResetSettingsDesc: 'Setzt alle Optionen dieser Seite auf ihre Standardwerte zurück.',
  aboutResetGroups: 'Gruppen zurücksetzen',
  aboutResetGroupsDesc: 'Löscht alle manuellen Gruppen — die Sessions bleiben in der Liste.',
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

  // Einstellungs-Navigation + UI-Tabs-Presets
  navChat: 'Chat',
  navWheel: 'Strg+Scroll',
  navSessions: 'Session-Liste',
  navGroups: 'Gruppen',
  navUiTabs: 'UI-Tabs',
  navGlass: 'Glass',
  navAbout: 'Über',
  uiTabsPresets: 'Schnellauswahl',
  uiTabsPresetsDesc: 'Ein Klick zu einem stimmigen Look — jede Option darunter bleibt feinjustierbar.',
  uiTabsPresetSidebar: 'Sidebar-Look',
  uiTabsPresetMinimal: 'Minimal',
  uiTabsPresetStock: 'Hermes-Standard',

  // UI-Tabs (Content-Leiste)
  secUiTabs: 'UI-Tabs (Tab-Leiste)',
  secUiTabsDesc: 'Wie die Content-Tab-Leiste aussieht — Sidebar-Chips, Label und Close-Verhalten.',
  uiTabsEnabled: 'Sidebar-Optik für Tabs',
  uiTabsEnabledDesc: 'Content-Tabs im Sidebar-Look: runde Chips, ruhigeres Label, freundlicherer Close-Button.',
  uiTabsRadius: 'Ecken-Radius (px)',
  uiTabsRadiusDesc: 'Wie rund ein Tab ist — 4 px wirkt wie die Sidebar-Zeilen.',
  uiTabsGap: 'Abstand zwischen Tabs (px)',
  uiTabsGapDesc: 'Luft zwischen benachbarten Tabs.',
  uiTabsInset: 'Vertikaler Abstand (px)',
  uiTabsInsetDesc: 'Hebt die Tabs von der Leistenkante ab — 0 füllt die Leiste wie bisher.',
  uiTabsSeparators: 'Trennlinien',
  uiTabsSeparatorsDesc: 'Die feinen Linien zwischen Tabs behalten (aus wirkt mit runden Chips aufgeräumter).',
  uiTabsActive: 'Aktiver Tab',
  uiTabsActiveDesc: 'Gefüllt wie eine Sidebar-Zeile, der App-Unterstrich oder beides.',
  uiTabsActiveSidebar: 'Gefüllt',
  uiTabsActiveUnderline: 'Unterstrich',
  uiTabsActiveBoth: 'Beides',
  uiTabsLabelCase: 'Schreibweise',
  uiTabsLabelCaseDesc: 'Normale Schreibweise oder GROSSBUCHSTABEN der App.',
  uiTabsCaseNormal: 'Wie getippt',
  uiTabsCaseUpper: 'GROSS',
  uiTabsLabelSize: 'Label-Größe (px)',
  uiTabsLabelSizeDesc: 'Schriftgröße des Tab-Titels.',
  uiTabsShowLead: 'Session-Status-Punkt',
  uiTabsShowLeadDesc: 'Der Live-Status (inkl. Farbe) aus der Sidebar, vor dem Titel.',
  uiTabsCloseMode: 'Close-Button',
  uiTabsCloseModeDesc: 'Wann das ✕ erscheint: bei Hover, immer oder nur am aktiven Tab.',
  uiTabsCloseOnHover: 'Bei Hover',
  uiTabsCloseAlways: 'Immer',
  uiTabsCloseActive: 'Aktiver Tab',
  uiTabsCloseWidth: 'Klickfläche ✕ (px)',
  uiTabsCloseWidthDesc: 'Breite der klickbaren ✕-Zone.',
  uiTabsCloseHoverBg: 'Hover-Highlight',
  uiTabsCloseHoverBgDesc: 'Ein weicher Chip hinter dem ✕ beim Überfahren.',
  uiTabsArc: 'Glow an arbeitenden Tabs',
  uiTabsArcDesc: 'Sessions, die denken / schreiben / Tools ausführen, bekommen den umlaufenden Glow-Ring — wie in der Sidebar.',
  uiTabsHint: 'Gilt für die Content-Tab-Leiste (alle Panes). Die Status-Infos kommen aus derselben Live-Engine wie die Sidebar.',

  // Glass & Lesbarkeit
  secGlass: 'Glass & Lesbarkeit',
  secGlassDesc: 'Optionaler Frost plus Akzent-Verlauf hinter Chips und Eingabefeld.',
  glassEnabled: 'Glass-Effekt',
  glassEnabledDesc:
    'Gibt Eingabefeld und Chips eine weiche Frost-Fläche mit dezentem Akzent-Verlauf — Beschriftungen bleiben auch über unruhigem Hintergrund gut lesbar.',
  glassBlur: 'Blur (px)',
  glassBlurDesc: 'Frost-Stärke in Pixeln — höher verwischt den Hintergrund stärker.',
  glassSaturate: 'Sättigung (%)',
  glassSaturateDesc: 'Farbintensität der Frost-Fläche.',
  glassFill: 'Flächen-Deckkraft (%)',
  glassFillDesc: 'Deckkraft der Fläche — höher ist fester und weniger durchsichtig.',
  glassTint: 'Akzent-Tönung (%)',
  glassTintDesc: 'Wie stark die Hermes-Akzentfarbe in die Fläche einfließt.',
  glassGradient: 'Akzent-Verlauf',
  glassGradientDesc: 'Linearer Verlauf von der Akzentfarbe ins Transparente, über der Fläche.',
  glassAngle: 'Verlaufs-Winkel (°)',
  glassAngleDesc: 'Richtung des Verlaufs-Overlays.',
  glassGradOpacity: 'Verlaufs-Stärke (%)',
  glassGradOpacityDesc: 'Stärke des Akzent-Verlaufs.',
  glassReach: 'Verlauf endet bei (%)',
  glassReachDesc: 'Punkt, ab dem der Verlauf vollständig transparent ist.',
  glassRing: 'Feine Kontur',
  glassRingDesc: 'Hauchdünner, akzentgefärbter Rand um die Chips.',
  glassArc: 'Umlaufender Glow',
  glassArcDesc: 'Ein weicher Akzent-Lichtpunkt läuft am Rand entlang — derselbe Effekt, den Hermes bei laufenden Sessions zeigt.',
  glassArcMode: 'Glow-Modus',
  glassArcModeDesc: 'Immer sichtbar oder nur, während die aktuelle Session arbeitet.',
  glassArcAlways: 'Immer',
  glassArcBusy: 'Bei Aktivität',
  glassArcWidth: 'Glow-Breite (px)',
  glassArcWidthDesc: 'Dicke des umlaufenden Lichtpunkts.',
  glassArcDuration: 'Glow-Umlauf (s)',
  glassArcDurationDesc: 'Sekunden für eine Runde um den Rand.',
  glassScopeComposer: 'Eingabefeld',
  glassScopeComposerDesc: 'Eingabefeld samt der angedockten Karten.',
  glassScopeChips: 'Chips (Modell / Reasoning)',
  glassScopeChipsDesc: 'Modell- und Reasoning-Pills im Eingabebereich.',
  glassScopeStatusbar: 'Statusleisten-Einträge',
  glassScopeStatusbarDesc: 'Einträge in der Leiste am unteren Rand.',
  newSession: 'Neue Session',
  viewSwitch: 'Ansicht wechseln (Liste/Grid)',
  tabsView: 'Ansicht',
  tabsViewDesc: 'Sessions als kompakte Liste oder als Grid-Karten anzeigen.',
  tabsViewList: 'Liste',
  tabsViewGrid: 'Grid',
  tabsGridMin: 'Grid: Kartenbreite (px)',
  tabsGridMinDesc: 'Mindestbreite einer Karte; die Spalten füllen die Pane automatisch.',
  tabsGridGap: 'Grid: Abstand (px)',
  tabsGridGapDesc: 'Abstand zwischen den Karten.',
  tabsGridLines: 'Grid: Titel-Zeilen',
  tabsGridLinesDesc: 'Wie viele Zeilen ein Kartentitel nutzen darf, bevor er abgeschnitten wird.',
  tabsGridPreview: 'Grid: Vorschautext',
  tabsGridPreviewDesc: 'Zeigt die Vorschau der letzten Nachricht auf den Karten.',
  rowMore: 'Weitere Aktionen',
  termOpen: 'Im Terminal öffnen',
  renameMenu: 'Umbenennen…',
  renameDialogTitle: 'Session umbenennen',
  renameConfirm: 'Umbenennen',
  sessionTitleLabel: 'Titel',
  sessionColorAction: 'Farbe…',
  branchSession: 'Zweig erstellen',
  moveToProject: 'In Projekt verschieben…',
  moveNoProjects: 'Keine Projekte gefunden',
  archiveSession: 'Archivieren',
  deleteSession: 'Löschen',
  deleteConfirmTitle: 'Session löschen?',
  deleteConfirmBody: 'Entfernt die Session samt Verlauf — nicht rückgängig zu machen.',
  copySessionId: 'ID kopieren',
  renameLiveOnly: 'Umbenennen ist möglich, sobald die Session aktiv/geladen ist — einmal öffnen, dann umbenennen.',
  tabsGridCols: 'Grid: Spalten',
  tabsGridColsDesc: 'Feste Spaltenzahl oder automatisch nach Kartenbreite.',
  tabsGridColsAuto: 'Auto',
  tabsInfoDensity: 'Info-Dichte',
  tabsInfoDensityDesc: 'Wie viel Kontext jeder Eintrag zeigt — wie in Hermes Desktop. Komfortabel ergänzt Branch/Modell/Zähler, Detailreich zusätzlich die Vorschau-Zeile. „Wie Hermes“ übernimmt die App-Einstellung live.',
  infoDensityAuto: 'Wie Hermes',
  infoDensityCompact: 'Kompakt',
  infoDensityComfortable: 'Komfortabel',
  infoDensityDetailed: 'Detailreich',
  metaMessages: n => `${n} Nachrichten`,
  metaToolCalls: n => `${n} Tool-Aufrufe`,
  unpin: 'Anpinnen aufheben',
  navPersonal: 'Individuell',
  secPersonal: 'Individualisierung',
  secPersonalDesc: 'Akzent-Tönung für die Kern-UI, eigener Chat-Hintergrund (Bild oder Video) und ein Content-Bereich mit runden Ecken und dezentem Schlagschatten.',
  personalAccentOn: 'Akzentfarben-Tönung',
  personalAccentOnDesc: 'Wendet deine eigene Akzentfarbe auf elementare UI-Elemente an — Buttons, aktive Zustände, Hover, Fokusringe und Hervorhebungen.',
  personalAccentColor: 'Akzentfarbe',
  personalAccentColorDesc: 'Swatch wählen oder Hex-Wert eintippen (#rrggbb).',
  personalAccentReset: 'Zurücksetzen',
  personalAccentHint: 'Wirkt sofort; Deaktivieren stellt die Theme-Akzentfarbe wieder her.',
  personalBgOn: 'Chat-Hintergrund',
  personalBgOnDesc: 'Zeigt ein eigenes Bild oder Video hinter den Chat-Nachrichten.',
  personalBgKind: 'Art des Hintergrunds',
  personalBgKindDesc: 'Bild (statische Datei) oder Video (stumm, läuft in Schleife).',
  personalBgKindImage: 'Bild',
  personalBgKindVideo: 'Video',
  personalBgPath: 'Datei',
  personalBgPathDesc: 'Absoluter Pfad zu einer lokalen Bild- oder Videodatei.',
  personalBgPathPick: 'Datei wählen…',
  personalBgPathHint: 'Über "Datei wählen…" auswählen oder Pfad einfügen, z. B. /home/deniz/Bilder/hintergrund.jpg.',
  personalBgFit: 'Darstellung',
  personalBgFitDesc: 'Wie das Medium die Fläche füllt.',
  personalBgFitCover: 'Füllen',
  personalBgFitContain: 'Einpassen',
  personalBgDim: 'Abdunkeln %',
  personalBgDimDesc: 'Dunkelt den Hintergrund ab, damit Texte lesbar bleiben (0 = aus).',
  personalBgBlur: 'Weichzeichnen px',
  personalBgBlurDesc: 'Zeichnet den Hintergrund weich (0 = aus).',
  personalBgScope: 'Gilt für',
  personalBgScopeDesc: 'Nur Chat-Sessions oder alle Pane-Ansichten.',
  personalBgScopeChat: 'Chats',
  personalBgScopeAll: 'Alle Panes',
  personalShellOn: 'Content-Bereich abgrenzen',
  personalShellOnDesc: 'Gibt dem Ansichtsbereich der Tabs runde Ecken und hebt ihn mit einem dezenten Schlagschatten ab.',
  personalShellRadius: 'Ecken-Radius px',
  personalShellRadiusDesc: 'Rundung der Ecken des Content-Bereichs.',
  personalShellShadow: 'Schatten',
  personalShellShadowDesc: 'Stärke des Schlagschattens.',
  personalShellShadowOff: 'Aus',
  personalShellShadowSubtle: 'Dezent',
  personalShellShadowMedium: 'Mittel',
  personalShellShadowStrong: 'Stark',
  personalShellBorder: 'Feine Kontur',
  personalShellBorderDesc: 'Zieht eine feine Linie um den Content-Bereich.',
  personalShellScope: 'Gilt für',
  personalShellScopeDesc: 'Nur Chat-Sessions oder alle Pane-Ansichten.',
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
.sf-tab-ctx{flex-shrink:0;font-size:10px;line-height:14px;font-variant-numeric:tabular-nums;color:var(--ui-text-quaternary)}
.sf-tab-ctx[data-level=warn]{color:#f59e0b}
.sf-tab-ctx[data-level=high]{color:var(--destructive,#ef4444)}
.sf-tab-time{font-size:10px;color:var(--ui-text-quaternary);font-variant-numeric:tabular-nums}
.sf-tab-badge{font-size:9.5px;padding:0 4px;border-radius:4px;background:var(--ui-bg-tertiary,rgba(127,127,127,.12));color:var(--ui-text-tertiary);line-height:14px}
.sf-tab-count{font-size:10px;color:var(--ui-text-quaternary)}
/* Session-Ansicht: Liste (Standard) oder Grid-Karten */
.sf-items{display:flex;flex-direction:column;gap:2px}
.sf-items[data-view=grid]{display:grid;grid-template-columns:repeat(var(--sf-grid-cols,auto-fill),minmax(var(--sf-grid-min,150px),1fr));gap:var(--sf-grid-gap,6px);padding:2px 2px 8px}
.sf-items[data-view=grid] .sf-tab{flex-direction:column;align-items:stretch;height:auto;gap:3px;padding:8px;border-radius:8px;background:color-mix(in srgb,var(--ui-text-primary) 4%,transparent)}
.sf-items[data-view=grid] .sf-tab:hover{background:var(--ui-row-hover-background,rgba(127,127,127,.08))}
.sf-items[data-view=grid] .sf-tab[data-active=true]{background:var(--ui-row-active-background,rgba(127,127,127,.12))}
.sf-items[data-view=grid] .sf-tab-lead{align-self:flex-start;width:auto}
.sf-items[data-view=grid] .sf-tab-main{flex:1 1 auto;width:100%}
.sf-items[data-view=grid] .sf-tab-title{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:var(--sf-grid-lines,2);overflow:hidden;overflow-wrap:anywhere}
.sf-items[data-view=grid] .sf-tab-preview{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.sf-tab-details{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;line-height:14px;color:var(--ui-text-tertiary)}
.sf-items[data-view=grid] .sf-tab-meta{margin-top:auto;flex-wrap:wrap;row-gap:2px}
/* More-Button (List- und Grid-Ansicht): dezent, erscheint bei Hover/Fokus */
.sf-more{display:grid;place-items:center;width:18px;height:18px;padding:0;border:0;border-radius:4px;background:transparent;color:var(--ui-text-tertiary);cursor:pointer;opacity:0;transition:opacity .12s ease;flex-shrink:0}
.sf-tab:hover .sf-more,.sf-more:focus-visible{opacity:1}
.sf-more:hover{background:color-mix(in srgb,var(--ui-text-primary) 12%,transparent);color:var(--foreground)}
.sf-items[data-view=grid] .sf-tab{padding-right:30px}
.sf-items[data-view=grid] .sf-more{position:absolute;top:6px;right:6px}
.sf-menu-item{display:flex;align-items:center;gap:8px}
.sf-dialog-list{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow-y:auto}
.sf-dialog-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:var(--foreground);font-size:12px;text-align:left;cursor:pointer}
.sf-dialog-item:hover{background:var(--ui-row-hover-background,rgba(127,127,127,.08))}
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
.sf-section-desc{font-size:11px;line-height:1.5;color:var(--ui-text-tertiary);margin:1px 0 2px}
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

/* Eingabefeld — Fläche + Verlauf malt das Surface SELBST (Border-Box): exakt
   derselbe Radius wie die Outline, also keine Haarlinien-Lücke mehr an den
   Ecken. Der Input-Fill-Layer wird dafür transparent und trägt stattdessen
   den umlaufenden Glow-Ring. */
:root[data-sf-glass~='composer'] [data-slot='composer-root']{
  --composer-fill:color-mix(in srgb,var(--ui-accent) var(--sf-glass-tint,8%),color-mix(in srgb,var(--dt-card) var(--sf-glass-fill,86%),transparent))
}
:root[data-sf-glass~='composer'] [data-slot='composer-root'][data-thread-scrolled-up]{
  --composer-fill:color-mix(in srgb,var(--ui-accent) var(--sf-glass-tint,8%),color-mix(in srgb,var(--dt-card) calc(var(--sf-glass-fill,86%) + 6%),transparent))
}
:root[data-sf-glass~='composer'] [data-slot='composer-surface']{
  background-color:color-mix(in srgb,var(--ui-accent) var(--sf-glass-tint,8%),color-mix(in srgb,var(--dt-card) var(--sf-glass-fill,86%),transparent));
  background-origin:border-box;background-clip:border-box;
  backdrop-filter:blur(var(--sf-glass-blur,10px)) saturate(var(--sf-glass-sat,115%));
  -webkit-backdrop-filter:blur(var(--sf-glass-blur,10px)) saturate(var(--sf-glass-sat,115%))
}
:root[data-sf-glass~='composer']:not([data-sf-glass~='nograd']) [data-slot='composer-surface']{
  background-image:linear-gradient(var(--sf-glass-angle,165deg),color-mix(in srgb,var(--ui-accent) var(--sf-glass-grad,12%),transparent),transparent var(--sf-glass-reach,72%))
}
/* Fill-Layer: transparent + konzentrischer Radius (r − 1px = Innenkante des
   Borders). Der Ring-Radius wird zur Laufzeit am echten Surface gemessen
   (Theme-unabhängig); der Fallback rechnet mit dem Theme-Skalar. */
:root[data-sf-glass~='composer'] [data-slot='composer-surface'] > [class~='-z-10']{
  background-color:transparent;
  border-radius:var(--sf-arc-radius,max(0px,calc(var(--radius-scalar,1) * 1.5rem - 1px)))
}
/* Umlaufender Glow-Ring — gleiche Technik wie .arc-border der App (Mask-Ring
   + per transform animierter Verlaufs-Layer, rein auf dem Compositor). */
:root[data-sf-glass~='composer'][data-sf-arc~='on'] [data-slot='composer-surface'] > [class~='-z-10']{
  overflow:hidden;
  padding:var(--sf-arc-width,1.5px);
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude
}
:root[data-sf-glass~='composer'][data-sf-arc~='on'] [data-slot='composer-surface'] > [class~='-z-10']::before{
  content:'';position:absolute;top:0;left:0;width:240%;height:240%;
  background:repeating-linear-gradient(var(--sf-arc-angle,160deg),transparent 0%,color-mix(in srgb,var(--ui-accent) 0%,transparent) 18.75%,var(--ui-accent) 25%,color-mix(in srgb,var(--ui-accent) 45%,transparent) 31.25%,transparent 43.75%,transparent 50%);
  will-change:transform;
  animation:sf-arc-ring var(--sf-arc-duration,3.2s) linear infinite
}
@keyframes sf-arc-ring{0%{transform:translate(0,0)}100%{transform:translate(-50%,-50%)}}

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
/* Umlaufender Glow der Chips: radialer Conic-Highlight (kleine Fläche, daher
   als @property-Turn umgesetzt); läuft um den Chip-Rand. */
:root[data-sf-glass~='chips'][data-sf-arc~='on'] :is([data-tour='model-pill'],[data-testid='reasoning-pill']){
  position:relative
}
:root[data-sf-glass~='chips'][data-sf-arc~='on'] :is([data-tour='model-pill'],[data-testid='reasoning-pill'])::after{
  content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  padding:var(--sf-arc-width,1.5px);
  background-image:conic-gradient(from var(--sf-arc-turn,0deg),transparent 0deg,transparent 232deg,color-mix(in srgb,var(--ui-accent) 40%,transparent) 285deg,var(--ui-accent) 330deg,transparent 360deg);
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  animation:sf-arc-turn var(--sf-arc-duration,3.2s) linear infinite
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
:root[data-sf-glass~='statusbar'][data-sf-arc~='on'] [data-slot='statusbar'] :is(button,a){
  position:relative
}
:root[data-sf-glass~='statusbar'][data-sf-arc~='on'] [data-slot='statusbar'] :is(button,a)::after{
  content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  padding:var(--sf-arc-width,1.5px);
  background-image:conic-gradient(from var(--sf-arc-turn,0deg),transparent 0deg,transparent 232deg,color-mix(in srgb,var(--ui-accent) 40%,transparent) 285deg,var(--ui-accent) 330deg,transparent 360deg);
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  animation:sf-arc-turn var(--sf-arc-duration,3.2s) linear infinite
}

/* Registrierte Winkel-Property für den Conic-Glow (Chips/Statusleiste). */
@property --sf-arc-turn{syntax:'<angle>';inherits:false;initial-value:0deg}
@keyframes sf-arc-turn{to{--sf-arc-turn:360deg}}

/* Barrierearmut: reduzierter Motion stoppt den Umlauf; pausierte Renderer
   (Fenster im Hintergrund) pausieren ihn wie die App-eigenen Arcs. */
@media (prefers-reduced-motion: reduce){
  :root[data-sf-arc] [data-slot='composer-surface'] > [class~='-z-10']::before,
  :root[data-sf-arc] :is([data-tour='model-pill'],[data-testid='reasoning-pill'])::after,
  :root[data-sf-arc] [data-slot='statusbar'] :is(button,a)::after{animation:none}
}
:root[data-renderer-animations-paused] [data-slot='composer-surface'] > [class~='-z-10']::before,
:root[data-renderer-animations-paused] :is([data-tour='model-pill'],[data-testid='reasoning-pill'])::after,
:root[data-renderer-animations-paused] [data-slot='statusbar'] :is(button,a)::after{animation-play-state:paused}

/* ── UI-Tabs: Content-Tab-Leiste im Sidebar-Look (optional) ─────────────
   Leicht abgerundete Chips statt eckiger Baender; Label, Close-Button und
   aktiver Zustand einstellbar. Arbeitende Session-Tabs tragen den
   umlaufenden Glow-Ring (Live-Info aus der Aktivitaets-Engine). */

/* Grundform: leicht abgerundet, mit Abstand (Chip-Optik) */
:root[data-sf-ui-tabs~='on'] :is([class~='group/tab'],[data-sf-ui-tab='true']):not([data-vertical]){
  height:auto;
  margin-block:var(--sf-ui-tab-inset-y,2px);
  border-radius:var(--sf-ui-tab-radius,4px);
  transition:background-color .1s ease
}
:root[data-sf-ui-tabs~='on'] :is([class~='group/tab'],[data-sf-ui-tab='true']):not([data-vertical]):not(:first-child){
  margin-left:var(--sf-ui-tab-gap,2px)
}
/* Trennlinien standardmaessig aus (Token 'sep' behaelt sie) */
:root[data-sf-ui-tabs~='on']:not([data-sf-ui-tabs~='sep']) :is([class~='group/tab'],[data-sf-ui-tab='true']):not([data-vertical]):not(:first-child){
  border-left-color:transparent
}
/* Hover: ruhige Flaeche statt Farbstich-Schatten */
:root[data-sf-ui-tabs~='on'] :is([class~='group/tab'],[data-sf-ui-tab='true']):not([data-vertical]):not([data-active='true']):hover{
  background:var(--ui-row-hover-background,color-mix(in srgb,var(--dt-foreground) 6%,transparent));
  box-shadow:none
}
/* Aktiver Tab: Sidebar-Optik (gefuellte Zeile), App-Unterstrich oder beides */
:root[data-sf-ui-tabs~='on'][data-sf-ui-tabs~='active-sidebar'] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-active='true']{
  background:var(--ui-row-active-background,color-mix(in srgb,var(--ui-accent) 16%,transparent));
  box-shadow:none;
  color:var(--foreground)
}
:root[data-sf-ui-tabs~='on'][data-sf-ui-tabs~='active-both'] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-active='true']{
  background:var(--ui-row-active-background,color-mix(in srgb,var(--ui-accent) 16%,transparent));
  color:var(--foreground)
}
/* Label: Groesse & Schreibweise */
:root[data-sf-ui-tabs~='on'] :is([class~='group/tab'],[data-sf-ui-tab='true']) .pane-tab-content [class~='truncate']{
  font-size:var(--sf-ui-tab-label-size,11px)
}
:root[data-sf-ui-tabs~='on'][data-sf-ui-tabs~='case-normal'] :is([class~='group/tab'],[data-sf-ui-tab='true']) .pane-tab-content [class~='truncate']{
  text-transform:none;
  letter-spacing:normal
}
/* Session-Status (Punkt aus dem Sidepanel) optional ausblenden */
:root[data-sf-ui-tabs~='on'][data-sf-ui-tabs~='nolead'] :is([class~='group/tab'],[data-sf-ui-tab='true']) .pane-tab-content > span:first-child:has([class~='rounded-full']){
  display:none
}
/* Close-Button: Klickflaeche + eigener, DECKENDER Kontrast-Chip — keine
   gestapelten Transparenzen (Label/Flaeche darunter waeren sonst durch das
   X sichtbar und es bliebe unklar, dass es ein Close-Button ist). */
:root[data-sf-ui-tabs~='on'] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-closeable]{
  --pane-tab-close-width:var(--sf-ui-tab-close-w,22px)
}
:root[data-sf-ui-tabs~='on'] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-closeable] > [class~='inset-y-0'] button{
  border-radius:var(--sf-ui-tab-radius,4px);
  margin-block:3px;
  margin-right:3px;
  color:var(--foreground);
  background-color:color-mix(in srgb,var(--foreground) 9%,var(--dt-card));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--foreground) 13%,transparent)
}
:root[data-sf-ui-tabs~='on']:not([data-sf-ui-tabs~='noclosehover']) :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-closeable] > [class~='inset-y-0'] button:hover{
  background-color:color-mix(in srgb,var(--foreground) 18%,var(--dt-card));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--foreground) 24%,transparent);
  color:var(--foreground)
}
/* Label-Pixel unter dem Close-Button auch im Hover-Modus entfernen — die App
   tut das nur fuer data-slot='pane-tab'; gewrappte Session-Tabs haetten sonst
   Text unter dem X. */
:root[data-sf-ui-tabs~='on'] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-closeable]:hover > .pane-tab-content{
  -webkit-mask-image:linear-gradient(to right,#000 calc(100% - var(--pane-tab-close-width) - 1rem),transparent calc(100% - var(--pane-tab-close-width)));
  mask-image:linear-gradient(to right,#000 calc(100% - var(--pane-tab-close-width) - 1rem),transparent calc(100% - var(--pane-tab-close-width)))
}
/* Sichtbarkeit: bei Hover (App-Standard), immer oder nur am aktiven Tab */
:root[data-sf-ui-tabs~='on'][data-sf-ui-tabs~='close-always'] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-closeable] > [class~='inset-y-0'],
:root[data-sf-ui-tabs~='on'][data-sf-ui-tabs~='close-active'] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-closeable][data-active='true'] > [class~='inset-y-0']{
  opacity:1;
  pointer-events:auto
}
/* Label-Fade dauerhaft, wo der Close-Button steht */
:root[data-sf-ui-tabs~='on'][data-sf-ui-tabs~='close-always'] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-closeable] > .pane-tab-content,
:root[data-sf-ui-tabs~='on'][data-sf-ui-tabs~='close-active'] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-closeable][data-active='true'] > .pane-tab-content{
  -webkit-mask-image:linear-gradient(to right,#000 calc(100% - var(--pane-tab-close-width) - 1rem),transparent calc(100% - var(--pane-tab-close-width)));
  mask-image:linear-gradient(to right,#000 calc(100% - var(--pane-tab-close-width) - 1rem),transparent calc(100% - var(--pane-tab-close-width)))
}
/* Arbeitende Session-Tabs: umlaufender Glow-Ring (Session-Info aus der Sidebar-Engine) */
:root[data-sf-ui-tabs~='on']:not([data-sf-ui-tabs~='noarc']) :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-sf-tab-busy='true']{
  position:relative
}
:root[data-sf-ui-tabs~='on']:not([data-sf-ui-tabs~='noarc']) :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-sf-tab-busy='true']::after{
  content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  padding:var(--sf-arc-width,1.5px);
  background-image:conic-gradient(from var(--sf-arc-turn,0deg),transparent 0deg,transparent 232deg,color-mix(in srgb,var(--ui-accent) 40%,transparent) 285deg,var(--ui-accent) 330deg,transparent 360deg);
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  animation:sf-arc-turn var(--sf-arc-duration,3.2s) linear infinite
}
@media (prefers-reduced-motion: reduce){
  :root[data-sf-ui-tabs~='on'] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-sf-tab-busy='true']::after{animation:none}
}
:root[data-renderer-animations-paused] :is([class~='group/tab'],[data-sf-ui-tab='true'])[data-sf-tab-busy='true']::after{animation-play-state:paused}

/* ── Einstellungs-Navigation: sticky Kategorie-Chips ─────────────────── */
/* ── Individualisierung: Akzent-Tönung · Content-Shell · Hintergrund-Layer ──
   Der .sf-bg-layer wird per JS in die Pane-Hosts gesetzt; hier nur die
   Darstellung. Variablen (--sf-*) kommen von applyPersonal(). Die Akzent-Regel
   ist unlayered und sticht damit die @layer-base-Definition der App. */

html[data-sf-accent~='on']{--ui-accent:var(--sf-accent-color,#7c3aed)}

html[data-sf-shell~='on'] [data-pane-host]:not([data-pane-overlay]){
  border-radius:var(--sf-shell-radius,10px);
  border:1px solid transparent;
  box-shadow:var(--sf-shell-shadow,none)
}
html[data-sf-shell~='on'][data-sf-shell-scope='chat'] [data-pane-host]:not([data-pane-overlay]):not([data-pane-host^='session-tile:']){
  border-radius:0;
  border:none;
  box-shadow:none
}
html[data-sf-shell~='on'][data-sf-shell-border='on'] [data-pane-host]:not([data-pane-overlay]){
  border-color:var(--ui-stroke-tertiary,color-mix(in srgb,currentColor 12%,transparent))
}

.sf-bg-layer{
  position:absolute;
  inset:0;
  z-index:-1;
  pointer-events:none;
  background-image:var(--sf-bg-url,none);
  background-size:var(--sf-bg-fit,cover);
  background-position:center;
  background-repeat:no-repeat;
  border-radius:inherit;
  filter:blur(var(--sf-bg-blur,0px))
}
.sf-bg-layer::after{
  content:'';
  position:absolute;
  inset:0;
  background:color-mix(in srgb,#000 var(--sf-bg-dim,35%),transparent)
}
.sf-bg-layer video{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:var(--sf-bg-fit,cover);
  pointer-events:none
}

.sf-nav{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:3px;margin:0 -6px 2px;padding:6px;overflow-x:auto;background:color-mix(in srgb,var(--ui-editor-surface-background,var(--background)) 90%,transparent);border-bottom:1px solid var(--ui-stroke-tertiary);scrollbar-width:none;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.sf-nav::-webkit-scrollbar{display:none}
.sf-nav-chip{display:inline-flex;flex:0 0 auto;align-items:center;gap:4px;height:24px;padding:0 9px;border:0;border-radius:999px;background:transparent;color:var(--ui-text-tertiary);font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer;transition:background-color .12s ease,color .12s ease}
.sf-nav-chip:hover{background:var(--ui-row-hover-background,color-mix(in srgb,var(--dt-foreground) 6%,transparent));color:var(--foreground)}
.sf-nav-chip[data-active='true']{background:var(--ui-row-active-background,color-mix(in srgb,var(--ui-accent) 16%,transparent));color:var(--foreground)}
.sf-settings section{scroll-margin-top:46px}
.sf-preset-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.sf-subhead{margin:10px 2px 2px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--ui-text-quaternary)}
html[data-sf-rowgrad~=on] .sf-tab{background:linear-gradient(var(--sf-row-angle,135deg),var(--sf-row-from,#7c3aed),var(--sf-row-to,#00dbda))}
html[data-sf-rowgrad~=on] .sf-tab:hover{filter:brightness(1.07)}
html[data-sf-rowshadow~=subtle] .sf-tab:not([data-drop=true]){box-shadow:0 1px 2px rgba(0,0,0,.22)}
html[data-sf-rowshadow~=medium] .sf-tab:not([data-drop=true]){box-shadow:0 2px 6px rgba(0,0,0,.3)}
html[data-sf-rowshadow~=strong] .sf-tab:not([data-drop=true]){box-shadow:0 4px 14px rgba(0,0,0,.42)}
html[data-sf-titlegrad~=on] .sf-tab-title{background-image:linear-gradient(var(--sf-title-angle,90deg),var(--sf-title-from,#e4e4e7),var(--sf-title-to,#8b8b93));-webkit-background-clip:text;background-clip:text;color:transparent}
html[data-sf-rowlive~=on] .sf-tab[data-live=busy]{background:color-mix(in srgb,var(--ui-accent) 9%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ui-accent) 28%,transparent)}
html[data-sf-rowlive~=on] .sf-tab[data-live=waiting]{background:color-mix(in srgb,#f59e0b 9%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,#f59e0b 30%,transparent)}
html[data-sf-rowlive~=on] .sf-tab[data-live=busy] .sf-tab-lead,html[data-sf-rowlive~=on] .sf-tab[data-live=waiting] .sf-tab-lead{animation:sf-live-pulse 1.6s ease-in-out infinite}
@keyframes sf-live-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@media (prefers-reduced-motion:reduce){html[data-sf-rowlive~=on] .sf-tab[data-live=busy] .sf-tab-lead,html[data-sf-rowlive~=on] .sf-tab[data-live=waiting] .sf-tab-lead{animation:none}}
html[data-sf-rowlive~=on][data-renderer-animations-paused] .sf-tab[data-live=busy] .sf-tab-lead,html[data-sf-rowlive~=on][data-renderer-animations-paused] .sf-tab[data-live=waiting] .sf-tab-lead{animation-play-state:paused}
html[data-sf-seltint~=accent]{--sf-sel-tone:var(--ui-accent)}
html[data-sf-seltint~=custom]{--sf-sel-tone:var(--sf-sel-color,#7c3aed)}
html:is([data-sf-seltint~=accent],[data-sf-seltint~=custom]) .sf-tab[data-active=true]{background:color-mix(in srgb,var(--sf-sel-tone) 16%,transparent)}
html:is([data-sf-seltint~=accent],[data-sf-seltint~=custom]) .sf-tab[data-active=true]:hover{background:color-mix(in srgb,var(--sf-sel-tone) 24%,transparent)}
html[data-sf-selborder~=on] .sf-tab[data-active=true]{outline:1px solid color-mix(in srgb,var(--sf-sel-tone,var(--ui-accent)) 55%,transparent);outline-offset:-1px}
html[data-sf-selshadow~=subtle] .sf-tab[data-active=true]{box-shadow:0 1px 3px rgba(0,0,0,.25)}
html[data-sf-selshadow~=medium] .sf-tab[data-active=true]{box-shadow:0 2px 8px rgba(0,0,0,.35)}
html[data-sf-selshadow~=strong] .sf-tab[data-active=true]{box-shadow:0 4px 16px rgba(0,0,0,.5)}
`

function injectCss() {
  // Verwaiste Stylesheets früherer Instanzen entfernen (nach unvollständigem
  // Dispose gestapelt) — sonst wirken Effekte doppelt.
  try {
    document.querySelectorAll('style[data-session-flow]').forEach(style => style.remove())
  } catch {
    /* egal */
  }

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

/** Farbwahl-Zeile (Swatches + Hex-Eingabe) für Design-Farben. */
function colorRowControl(value, onChange, resetLabel) {
  return jsxs('div', {
    className: 'sf-row-control',
    children: [
      jsx(GroupSwatches, {
        value: value || null,
        onChange: next => onChange(next || ''),
        clearLabel: resetLabel
      }),
      jsx(Input, {
        className: 'sf-num',
        maxLength: 7,
        onChange: event => onChange(String(event.target.value || '').trim()),
        value: value || ''
      })
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

function rowDetailsLine(row, t) {
  const parts = []
  const branch = String(row.branch || '').trim()

  if (branch) {
    parts.push(branch)
  }

  const model = String(row.model || '').split('/').pop()?.trim()

  if (model) {
    parts.push(model)
  }

  if (row.messageCount > 0) {
    const count = compactNumber ? compactNumber(row.messageCount) : row.messageCount
    parts.push(t('metaMessages', count))
  }

  if (row.toolCount > 0) {
    const count = compactNumber ? compactNumber(row.toolCount) : row.toolCount
    parts.push(t('metaToolCalls', count))
  }

  return parts.join(' · ')
}

function TabRow({ row, active, section, t, onOpen, onMore, groupsState, onAssign, dragging, setDragging }) {
  const settings = useValue($settings)
  const appDensity = useValue($appDensity)
  const activity = useValue($activity)
  const live = useValue($liveMap)
  const ctxInfo = useValue($ctxInfo)
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

  // Info-Dichte (wie Hermes Desktop): kompakt = Basis, komfortabel = + Details-
  // Zeile (Branch · Modell · Zähler), detailreich = + Vorschau-Zeile.
  const infoDensity = tabsCfg.infoDensity === 'auto' ? appDensity : tabsCfg.infoDensity
  const detailsLine = infoDensity !== 'compact' ? rowDetailsLine(row, t) : ''

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

  const ctx = tabsCfg.showContext ? ctxInfo[row.id] : null

  if (ctx) {
    const ctxLevel = ctx.percent >= 90 ? 'high' : ctx.percent >= 70 ? 'warn' : 'ok'
    const usedLabel = `${ctx.est ? '~' : ''}${compactNumber ? compactNumber(ctx.used) : String(ctx.used)}`
    const maxLabel = compactNumber ? compactNumber(ctx.max) : String(ctx.max)

    meta.push(
      jsx('span', {
        className: 'sf-tab-ctx',
        'data-level': ctxLevel,
        key: 'ctx',
        title: t('ctxTooltip', usedLabel, maxLabel, String(ctx.percent)),
        children: `${ctx.percent}%`
      })
    )
  }

  if (tabsCfg.showTime) {
    meta.push(jsx('span', { className: 'sf-tab-time', key: 'time', children: fmtAge(row.startedAt, t) }))
  }

  const moreItems = [
    { icon: 'browser', key: 'tab', label: t('openTab'), run: () => onOpen(row, 'tab') },
    { icon: 'link-external', key: 'window', label: t('openWindow'), run: () => onOpen(row, 'window') },
    { icon: 'terminal', key: 'terminal', label: t('termOpen'), run: () => onMore('terminal', row) },
    { key: 'sep1', separator: true },
    { icon: 'edit', key: 'rename', label: t('renameMenu'), run: () => onMore('rename', row) },
    { icon: 'symbol-color', key: 'color', label: t('sessionColorAction'), run: () => onMore('color', row) },
    { icon: 'pin', key: 'pin', label: row.pinned ? t('unpin') : t('pin'), run: () => onMore('pin', row) },
    { icon: 'repo-forked', key: 'branch', label: t('branchSession'), run: () => onMore('branch', row) },
    { icon: 'folder', key: 'move', label: t('moveToProject'), run: () => onMore('move', row) },
    { key: 'sep2', separator: true },
    { icon: 'archive', key: 'archive', label: t('archiveSession'), run: () => onMore('archive', row) },
    { icon: 'trash', key: 'delete', label: t('deleteSession'), run: () => onMore('delete', row) },
    { key: 'sep3', separator: true },
    { icon: 'copy', key: 'copy', label: t('copySessionId'), run: () => onMore('copy', row) }
  ]

  const moreRowMenu =
    DropdownMenu && DropdownMenuContent && DropdownMenuItem && DropdownMenuSeparator && DropdownMenuTrigger
      ? jsxs(DropdownMenu, {
          children: [
            jsx(DropdownMenuTrigger, {
              asChild: true,
              children: jsx('button', {
                'aria-label': t('rowMore'),
                className: 'sf-more',
                onClick: event => event.stopPropagation(),
                onPointerDown: event => event.stopPropagation(),
                type: 'button',
                children: jsx(Codicon, { name: 'ellipsis', size: '0.875rem' })
              })
            }),
            jsx(DropdownMenuContent, {
              align: 'end',
              children: moreItems.map(item =>
                item.separator
                  ? jsx(DropdownMenuSeparator, { key: item.key })
                  : jsx(DropdownMenuItem, {
                      className: 'sf-menu-item',
                      key: item.key,
                      onSelect: () => item.run(),
                      children: [
                        jsx(Codicon, { key: 'i', name: item.icon, size: '0.875rem' }),
                        jsx('span', { key: 'l', children: item.label })
                      ]
                    })
              )
            })
          ]
        })
      : null

  const liveKind = activityFor(row, live, activity).kind
  const liveBucket = ['thinking', 'streaming', 'tool', 'working'].includes(liveKind)
    ? 'busy'
    : liveKind === 'waiting'
      ? 'waiting'
      : 'idle'

  const body = jsxs('div', {
    className: 'sf-tab',
    'data-active': active,
    'data-live': liveBucket,
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
          detailsLine ? jsx('div', { className: 'sf-tab-details', children: detailsLine }) : null,
          (((cozy && tabsCfg.showPreview) || (tabsCfg.view === 'grid' && tabsCfg.gridPreview) || infoDensity === 'detailed') &&
          row.preview)
            ? jsx('div', { className: 'sf-tab-preview', children: row.preview })
            : null
        ]
      }),
      meta.length ? jsx('div', { className: 'sf-tab-meta', children: meta }) : null,
      moreRowMenu
    ]
  })

  return jsxs(ContextMenu, {
    children: [
      jsx(ContextMenuTrigger, { asChild: true, children: body }),
      jsx(ContextMenuContent, { children: menuItems })
    ]
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Row-Aktionen (More-Menü): Hermes-Session-Aktionen für List- und Grid-Ansicht
// ─────────────────────────────────────────────────────────────────────────────
// Spiegel der Desktop-Aktionen, soweit das Gateway sie für Plugins anbietet:
// Terminal öffnen (IPC), Umbenennen (session.title), Anpinnen/Farbe (SDK),
// Zweig erstellen (session.branch_stored), In Projekt verschieben
// (session.workspace.move), Archivieren (session.archive), Löschen
// (session.delete — schließt eine laufende Runtime vorher) und ID kopieren.
// Lokale App-Zustände (gelesen/ungelesen, Export) haben keine Plugin-Door und
// bleiben bewusst außen vor.

function liveRuntimeIdFor(storedId) {
  try {
    for (const [runtimeId, entry] of Object.entries($liveMap.get())) {
      if (entry && entry.storedId === storedId) {
        return runtimeId
      }
    }
  } catch {
    /* Live-Map evtl. noch leer */
  }

  return ''
}

function makeIdempotencyKey() {
  return `sf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function openSessionInTerminalRow(row) {
  try {
    const desktop = window.hermesDesktop

    if (!desktop || typeof desktop.openSessionInTerminal !== 'function') {
      throw new Error('Desktop-API nicht verfuegbar')
    }

    const result = await desktop.openSessionInTerminal(row.id, {})

    if (result && result.ok === false) {
      throw new Error(String(result.error || 'open failed'))
    }
  } catch (error) {
    host.notifyError(error, CTX?.i18n?.t('termOpen') || 'Terminal')
  }
}

async function renameSessionRow(row, title) {
  const next = String(title || '').trim()

  if (!next || next === row.title) {
    return
  }

  const runtimeId = liveRuntimeIdFor(row.id)

  try {
    await host.request('session.title', { session_id: runtimeId || row.id, title: next })
  } catch (error) {
    if (!runtimeId) {
      throw new Error(CTX?.i18n?.t('renameLiveOnly') || String(error))
    }

    throw error
  }

  scheduleSessionsRefresh(1200)
}

async function branchSessionRow(row) {
  try {
    const params = {
      cols: 96,
      idempotency_key: makeIdempotencyKey(),
      parent_session_id: row.id,
      source: 'desktop'
    }

    if (row.cwd) {
      params.cwd = row.cwd
    }

    const created = await host.request('session.branch_stored', params)
    const createdId = String(created?.stored_session_id || created?.session_id || '').trim()

    if (!createdId) {
      throw new Error('branch lieferte keine Session-ID')
    }

    await host.openSession(createdId, { intent: readSetting('tabs', 'openIntent') || 'in-place' })
    scheduleSessionsRefresh(1500)
    host.notify({ kind: 'success', message: CTX?.i18n?.t('branchSession') || 'Zweig erstellt' })
  } catch (error) {
    host.notifyError(error, CTX?.i18n?.t('branchSession') || 'Zweig')
  }
}

async function moveSessionRow(row, project) {
  const cwd = String(project?.path || '').trim()

  if (!cwd) {
    throw new Error(CTX?.i18n?.t('moveNoProjects') || 'Kein Projekt')
  }

  await host.request('session.workspace.move', { cwd, session_key: row.id })
  scheduleSessionsRefresh(1200)
  host.notify({ kind: 'success', message: `${CTX?.i18n?.t('moveToProject') || 'Projekt'} · ${project.name || cwd}` })
}

async function archiveSessionRow(row) {
  try {
    await host.request('session.archive', { archived: true, session_id: row.id })
    scheduleSessionsRefresh(800)
  } catch (error) {
    host.notifyError(error, CTX?.i18n?.t('archiveSession') || 'Archivieren')
  }
}

async function deleteSessionRow(row) {
  const runtimeId = liveRuntimeIdFor(row.id)

  if (runtimeId) {
    try {
      await host.request('session.close', { session_id: runtimeId })
    } catch {
      /* Runtime evtl. schon weg — delete entscheidet */
    }
  }

  await host.request('session.delete', { session_id: row.id })
  scheduleSessionsRefresh(800)
}

async function copySessionIdRow(row) {
  try {
    const desktop = window.hermesDesktop

    if (desktop && typeof desktop.writeClipboard === 'function') {
      await desktop.writeClipboard(row.id)
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(row.id)
    }

    host.notify({ kind: 'info', message: `${CTX?.i18n?.t('copySessionId') || 'ID'}: ${row.id}` })
  } catch (error) {
    host.notifyError(error, CTX?.i18n?.t('copySessionId') || 'ID')
  }
}

async function fetchProjectChoices() {
  const payload = await host.request('projects.list', {})

  return (Array.isArray(payload?.projects) ? payload.projects : [])
    .map(project => ({
      id: String(project?.id || ''),
      name: String(project?.name || '').trim(),
      path: String(project?.primary_path || '').trim()
    }))
    .filter(project => project.path)
}

function RowRenameDialog({ row, t, onDone }) {
  const [value, setValue] = useState(row.title || '')

  const commit = async () => {
    try {
      await renameSessionRow(row, value)
      onDone()
    } catch (error) {
      host.notifyError(error, t('renameDialogTitle'))
    }
  }

  return jsxs(Dialog, {
    open: true,
    onOpenChange: open => {
      if (!open) {
        onDone()
      }
    },
    children: [
      jsx(DialogContent, {
        className: 'sf-dialog',
        children: jsxs(Fragment, {
          children: [
            jsx(DialogHeader, { children: jsx(DialogTitle, { children: t('renameDialogTitle') }) }),
            jsxs('div', {
              className: 'sf-dialog-row',
              children: [
                jsx('label', { className: 'sf-dialog-label', children: t('sessionTitleLabel') }),
                jsx(Input, {
                  autoFocus: true,
                  onChange: event => setValue(event.target.value),
                  onKeyDown: event => {
                    if (event.key === 'Enter') {
                      void commit()
                    }
                  },
                  value
                })
              ]
            }),
            jsxs(DialogFooter, {
              children: [
                jsx(Button, { onClick: onDone, size: 'sm', variant: 'ghost', children: t('cancel') }),
                jsx(Button, { onClick: () => void commit(), size: 'sm', children: t('renameConfirm') })
              ]
            })
          ]
        })
      })
    ]
  })
}

function RowColorDialog({ row, t, onDone }) {
  return jsxs(Dialog, {
    open: true,
    onOpenChange: open => {
      if (!open) {
        onDone()
      }
    },
    children: [
      jsx(DialogContent, {
        className: 'sf-dialog',
        children: jsxs(Fragment, {
          children: [
            jsx(DialogHeader, { children: jsx(DialogTitle, { children: t('sessionColorAction') }) }),
            jsx('div', {
              className: 'sf-dialog-row',
              children: jsx(GroupSwatches, {
                clearLabel: t('clearColor'),
                onChange: color => {
                  try {
                    host.sessions.setColor(row.id, color)
                  } catch (error) {
                    host.notifyError(error, t('sessionColorAction'))
                  }

                  onDone()
                },
                value: null
              })
            })
          ]
        })
      })
    ]
  })
}

function RowMoveDialog({ row, t, onDone }) {
  const [choices, setChoices] = useState(null)

  useEffect(() => {
    let alive = true

    fetchProjectChoices()
      .then(list => {
        if (alive) {
          setChoices(list)
        }
      })
      .catch(() => {
        if (alive) {
          setChoices([])
        }
      })

    return () => {
      alive = false
    }
  }, [])

  const pick = async project => {
    try {
      await moveSessionRow(row, project)
      onDone()
    } catch (error) {
      host.notifyError(error, t('moveToProject'))
    }
  }

  return jsxs(Dialog, {
    open: true,
    onOpenChange: open => {
      if (!open) {
        onDone()
      }
    },
    children: [
      jsx(DialogContent, {
        className: 'sf-dialog',
        children: jsxs(Fragment, {
          children: [
            jsx(DialogHeader, { children: jsx(DialogTitle, { children: t('moveToProject') }) }),
            choices === null
              ? jsx('div', { className: 'sf-row-desc', children: '…' })
              : choices.length === 0
                ? jsx('div', { className: 'sf-row-desc', children: t('moveNoProjects') })
                : jsx('div', {
                    className: 'sf-dialog-list',
                    children: choices.map(project =>
                      jsx('button', {
                        className: 'sf-dialog-item',
                        key: project.path,
                        onClick: () => void pick(project),
                        type: 'button',
                        children: project.name || project.path
                      })
                    )
                  }),
            jsx(DialogFooter, {
              children: jsx(Button, { onClick: onDone, size: 'sm', variant: 'ghost', children: t('cancel') })
            })
          ]
        })
      })
    ]
  })
}

function RowDeleteDialog({ row, t, onDone }) {
  const confirm = async () => {
    await deleteSessionRow(row)
    onDone()
  }

  if (ConfirmDialog) {
    return jsx(ConfirmDialog, {
      cancelLabel: t('cancel'),
      confirmLabel: t('deleteSession'),
      description: t('deleteConfirmBody'),
      destructive: true,
      onClose: onDone,
      onConfirm: confirm,
      open: true,
      title: t('deleteConfirmTitle')
    })
  }

  return jsxs(Dialog, {
    open: true,
    onOpenChange: open => {
      if (!open) {
        onDone()
      }
    },
    children: [
      jsx(DialogContent, {
        className: 'sf-dialog',
        children: jsxs(Fragment, {
          children: [
            jsx(DialogHeader, { children: jsx(DialogTitle, { children: t('deleteConfirmTitle') }) }),
            jsx('div', { className: 'sf-row-desc', children: t('deleteConfirmBody') }),
            jsxs(DialogFooter, {
              children: [
                jsx(Button, { onClick: onDone, size: 'sm', variant: 'ghost', children: t('cancel') }),
                jsx(Button, {
                  onClick: () => {
                    void confirm().catch(error => host.notifyError(error, t('deleteSession')))
                  },
                  size: 'sm',
                  children: t('deleteSession')
                })
              ]
            })
          ]
        })
      })
    ]
  })
}

function RowDialogHost({ state, setState, t }) {
  if (!state) {
    return null
  }

  const row = state.row
  const close = () => setState(null)

  if (state.kind === 'rename') {
    return jsx(RowRenameDialog, { row, t, onDone: close })
  }

  if (state.kind === 'color') {
    return jsx(RowColorDialog, { row, t, onDone: close })
  }

  if (state.kind === 'move') {
    return jsx(RowMoveDialog, { row, t, onDone: close })
  }

  if (state.kind === 'delete') {
    return jsx(RowDeleteDialog, { row, t, onDone: close })
  }

  return null
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
  const [rowDialog, setRowDialog] = useState(null)
  const [dragging, setDragging] = useState(null)

  const sections = useMemo(() => buildSections(), [rows, groupsState, settings])
  const totalCount = sections.reduce((sum, section) => sum + section.items.length, 0)

  // More-Menü: direkte Aktionen oder Dialog (Umbenennen/Farbe/Projekt/Löschen).
  const onMore = (action, row) => {
    if (!row) {
      return
    }

    if (action === 'rename' || action === 'color' || action === 'move' || action === 'delete') {
      setRowDialog({ kind: action, row })

      return
    }

    if (action === 'pin') {
      try {
        host.sessions.pin(row.id, !row.pinned)
      } catch (error) {
        host.notifyError(error, t('pin'))
      }

      return
    }

    if (action === 'terminal') {
      void openSessionInTerminalRow(row)

      return
    }

    if (action === 'branch') {
      void branchSessionRow(row)

      return
    }

    if (action === 'archive') {
      void archiveSessionRow(row)

      return
    }

    if (action === 'copy') {
      void copySessionIdRow(row)
    }
  }

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
            ? jsx('div', {
                className: 'sf-items',
                'data-view': settings.tabs.view === 'grid' ? 'grid' : 'list',
                key: 'items',
                children: section.items.map(row =>
                  jsx(TabRow, {
                    key: row.id,
                    row,
                    active: row.id === (focused || active),
                    section,
                    t,
                    onOpen: open,
                    onMore,
                    groupsState,
                    onAssign: assign,
                    dragging,
                    setDragging
                  })
                )
              })
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
        label: t('viewSwitch'),
        children: jsx(Button, {
          'aria-label': t('viewSwitch'),
          onClick: () => patchSettings('tabs', { view: settings.tabs.view === 'grid' ? 'list' : 'grid' }),
          size: 'icon-xs',
          variant: 'ghost',
          children: jsx(Codicon, {
            name: settings.tabs.view === 'grid' ? 'list-unordered' : 'layout',
            size: '0.875rem'
          })
        })
      }),
      jsx(Tip, {
        label: t('newSession'),
        children: jsx(Button, {
          'aria-label': t('newSession'),
          onClick: () => void startNewProjectSession(),
          size: 'icon-xs',
          variant: 'ghost',
          children: jsx(Codicon, { name: 'add', size: '0.875rem' })
        })
      }),
      jsx(Tip, {
        label: t('newGroup'),
        children: jsx(Button, {
          'aria-label': t('newGroup'),
          onClick: () => setDialog({ ...newGroupDialogState(), open: true }),
          size: 'icon-xs',
          variant: 'ghost',
          children: jsx(Codicon, { name: 'layers', size: '0.875rem' })
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
    children: [
      toolbar,
      body,
      jsx(GroupDialog, { state: dialog, setState: setDialog, t }),
      jsx(RowDialogHost, { state: rowDialog, setState: setRowDialog, t })
    ]
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// UI — Einstellungs-Seite
// ─────────────────────────────────────────────────────────────────────────────

function SettingsSection({ id, icon, title, description, children }) {
  return jsxs('section', {
    id,
    children: [
      jsxs('div', {
        className: 'sf-section-title',
        children: [jsx(Codicon, { name: icon, size: '0.9rem' }), jsx('span', { children: title })]
      }),
      description ? jsx('div', { className: 'sf-section-desc', children: description }) : null,
      ...children
    ]
  })
}

// Kategorien der Einstellungsseite — Reihenfolge = Sektions-Reihenfolge.
const SETTINGS_CATEGORIES = [
  { id: 'sf-sec-chat', icon: 'sparkle', labelKey: 'navChat' },
  { id: 'sf-sec-wheel', icon: 'arrow-both', labelKey: 'navWheel' },
  { id: 'sf-sec-sessions', icon: 'window', labelKey: 'navSessions' },
  { id: 'sf-sec-groups', icon: 'layers', labelKey: 'navGroups' },
  { id: 'sf-sec-uitabs', icon: 'multiple-windows', labelKey: 'navUiTabs' },
  { id: 'sf-sec-glass', icon: 'paintcan', labelKey: 'navGlass' },
  { id: 'sf-sec-personal', icon: 'symbol-color', labelKey: 'navPersonal' },
  { id: 'sf-sec-about', icon: 'info', labelKey: 'navAbout' }
]

/** Sticky Kategorie-Leiste: springt zur Sektion, markiert die aktuelle. */
function SettingsNav() {
  const t = usePluginI18n(ID)
  const [active, setActive] = useState(SETTINGS_CATEGORIES[0].id)

  useEffect(() => {
    const els = SETTINGS_CATEGORIES.map(category => document.getElementById(category.id)).filter(Boolean)

    if (!els.length || typeof IntersectionObserver !== 'function') {
      return undefined
    }

    const io = new IntersectionObserver(
      entries => {
        const hit = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (hit.length) {
          setActive(hit[0].target.id)
        }
      },
      { rootMargin: '-6% 0px -78% 0px', threshold: 0 }
    )

    els.forEach(el => io.observe(el))

    return () => io.disconnect()
  }, [])

  return jsx('div', {
    className: 'sf-nav',
    role: 'navigation',
    children: SETTINGS_CATEGORIES.map(category =>
      jsx('button', {
        'aria-current': active === category.id ? 'true' : undefined,
        className: 'sf-nav-chip',
        'data-active': active === category.id ? 'true' : undefined,
        key: category.id,
        onClick: () => {
          setActive(category.id)
          document.getElementById(category.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
        type: 'button',
        children: [
          jsx(Codicon, { key: 'i', name: category.icon, size: '0.8125rem' }),
          jsx('span', { key: 'l', children: t(category.labelKey) })
        ]
      })
    )
  })
}

// Ein-Klick-Presets für die UI-Tabs (alles bleibt feinjustierbar).
const UI_TABS_PRESETS = {
  sidebar: {
    label: 'Sidebar-Look',
    values: {
      enabled: true,
      radius: 4,
      gap: 2,
      insetY: 2,
      separators: false,
      activeStyle: 'sidebar',
      labelCase: 'normal',
      labelSize: 11,
      showLead: true,
      closeMode: 'hover',
      closeWidth: 22,
      closeHover: true,
      arc: true
    }
  },
  minimal: {
    label: 'Minimal',
    values: {
      enabled: true,
      radius: 2,
      gap: 0,
      insetY: 0,
      separators: true,
      activeStyle: 'underline',
      labelCase: 'upper',
      labelSize: 10,
      showLead: false,
      closeMode: 'hover',
      closeWidth: 18,
      closeHover: false,
      arc: false
    }
  },
  stock: {
    label: 'Hermes-Standard',
    values: { enabled: false }
  }
}

function applyUiTabsPreset(name) {
  const preset = UI_TABS_PRESETS[name]

  if (!preset) {
    return
  }

  patchSettings('uiTabs', preset.values)

  try {
    host.notify({ kind: 'info', message: `Session Flow: UI-Tabs-Look „${preset.label}" übernommen` })
  } catch (error) {
    console.warn(`[${ID}] preset notify failed`, error)
  }
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
  const uiTabs = settings.uiTabs
  const personal = settings.personal

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

      jsx(SettingsNav, {}),

      // ── Chat-Animation ─────────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'sparkle',
        id: 'sf-sec-chat',
        title: t('secAnimation'),
        description: t('secAnimationDesc'),
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
            description: t('animDurationDesc'),
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
            description: t('animStaggerDesc'),
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
            description: t('animTravelDesc'),
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
            description: t('animEasingDesc'),
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
            description: t('animIncludeCodeDesc'),
            checked: animation.includeCode,
            disabled: !animation.enabled,
            onChange: value => patch('animation', 'includeCode', value)
          }),
          jsx(ToggleRow, {
            label: t('animIncludeLists'),
            description: t('animIncludeListsDesc'),
            checked: animation.includeLists,
            disabled: !animation.enabled,
            onChange: value => patch('animation', 'includeLists', value)
          })
        ]
      }),

      // ── Strg+Scroll ────────────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'arrow-both',
        id: 'sf-sec-wheel',
        title: t('secWheel'),
        description: t('secWheelDesc'),
        children: [
          jsx(ToggleRow, {
            label: t('wheelEnabled'),
            description: t('wheelEnabledDesc'),
            checked: wheel.enabled,
            onChange: value => patch('wheel', 'enabled', value)
          }),
          jsx(Row, {
            title: t('wheelModifier'),
            description: t('wheelModifierDesc'),
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
            description: t('wheelInvertDesc'),
            checked: wheel.invert,
            onChange: value => patch('wheel', 'invert', value)
          }),
          jsx(ToggleRow, {
            label: t('wheelWrap'),
            description: t('wheelWrapDesc'),
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
            description: t('wheelHudMsDesc'),
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
        id: 'sf-sec-sessions',
        title: t('secTabs'),
        description: t('secTabsDesc'),
        children: [
          jsx(Row, {
            title: t('tabsDensity'),
            description: t('tabsDensityDesc'),
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
            title: t('tabsView'),
            description: t('tabsViewDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'list', label: t('tabsViewList') },
                { id: 'grid', label: t('tabsViewGrid') }
              ],
              value: tabs.view,
              onChange: value => patch('tabs', 'view', value)
            })
          }),
          jsx(Row, {
            title: t('tabsGridMin'),
            description: t('tabsGridMinDesc'),
            action: jsx(NumberInput, {
              min: 110,
              max: 280,
              step: 10,
              value: tabs.gridMin,
              onChange: value => patch('tabs', 'gridMin', value)
            })
          }),
          jsx(Row, {
            title: t('tabsGridCols'),
            description: t('tabsGridColsDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'auto', label: t('tabsGridColsAuto') },
                { id: '1', label: '1' },
                { id: '2', label: '2' },
                { id: '3', label: '3' },
                { id: '4', label: '4' }
              ],
              value: tabs.gridCols,
              onChange: value => patch('tabs', 'gridCols', value)
            })
          }),
          jsx(Row, {
            title: t('tabsGridGap'),
            description: t('tabsGridGapDesc'),
            action: jsx(NumberInput, {
              min: 2,
              max: 16,
              step: 1,
              value: tabs.gridGap,
              onChange: value => patch('tabs', 'gridGap', value)
            })
          }),
          jsx(Row, {
            title: t('tabsGridLines'),
            description: t('tabsGridLinesDesc'),
            action: jsx(NumberInput, {
              min: 1,
              max: 4,
              step: 1,
              value: tabs.gridLines,
              onChange: value => patch('tabs', 'gridLines', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('tabsGridPreview'),
            description: t('tabsGridPreviewDesc'),
            checked: tabs.gridPreview,
            onChange: value => patch('tabs', 'gridPreview', value)
          }),
          jsx(Row, {
            title: t('tabsInfoDensity'),
            description: t('tabsInfoDensityDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'auto', label: t('infoDensityAuto') },
                { id: 'compact', label: t('infoDensityCompact') },
                { id: 'comfortable', label: t('infoDensityComfortable') },
                { id: 'detailed', label: t('infoDensityDetailed') }
              ],
              value: tabs.infoDensity,
              onChange: value => patch('tabs', 'infoDensity', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('tabsShowContext'),
            description: t('tabsShowContextDesc'),
            checked: tabs.showContext,
            onChange: value => patch('tabs', 'showContext', value)
          }),
          jsx(Row, {
            title: t('tabsStatusStyle'),
            description: t('tabsStatusStyleDesc'),
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
          jsx('p', { className: 'sf-subhead', children: t('tabsDesignHead') }),
          jsx(ToggleRow, {
            label: t('tabsRowGrad'),
            description: t('tabsRowGradDesc'),
            checked: tabs.rowGradOn,
            onChange: value => patch('tabs', 'rowGradOn', value)
          }),
          jsx(Row, {
            title: t('tabsRowGradFrom'),
            description: t('tabsRowGradFromDesc'),
            action: colorRowControl(tabs.rowGradFrom, value => patch('tabs', 'rowGradFrom', value), t('personalAccentReset'))
          }),
          jsx(Row, {
            title: t('tabsRowGradTo'),
            description: t('tabsRowGradToDesc'),
            action: colorRowControl(tabs.rowGradTo, value => patch('tabs', 'rowGradTo', value), t('personalAccentReset'))
          }),
          jsx(Row, {
            title: t('tabsRowGradAngle'),
            description: t('tabsRowGradAngleDesc'),
            action: jsx(NumberInput, {
              min: 0,
              max: 360,
              step: 15,
              value: tabs.rowGradAngle,
              onChange: value => patch('tabs', 'rowGradAngle', value)
            })
          }),
          jsx(Row, {
            title: t('tabsRowShadow'),
            description: t('tabsRowShadowDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'off', label: t('personalShellShadowOff') },
                { id: 'subtle', label: t('personalShellShadowSubtle') },
                { id: 'medium', label: t('personalShellShadowMedium') },
                { id: 'strong', label: t('personalShellShadowStrong') }
              ],
              value: tabs.rowShadow,
              onChange: value => patch('tabs', 'rowShadow', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('tabsTitleGrad'),
            description: t('tabsTitleGradDesc'),
            checked: tabs.titleGradOn,
            onChange: value => patch('tabs', 'titleGradOn', value)
          }),
          jsx(Row, {
            title: t('tabsTitleGradFrom'),
            description: t('tabsTitleGradFromDesc'),
            action: colorRowControl(tabs.titleGradFrom, value => patch('tabs', 'titleGradFrom', value), t('personalAccentReset'))
          }),
          jsx(Row, {
            title: t('tabsTitleGradTo'),
            description: t('tabsTitleGradToDesc'),
            action: colorRowControl(tabs.titleGradTo, value => patch('tabs', 'titleGradTo', value), t('personalAccentReset'))
          }),
          jsx(Row, {
            title: t('tabsTitleGradAngle'),
            description: t('tabsTitleGradAngleDesc'),
            action: jsx(NumberInput, {
              min: 0,
              max: 360,
              step: 15,
              value: tabs.titleGradAngle,
              onChange: value => patch('tabs', 'titleGradAngle', value)
            })
          }),
          jsx('p', { className: 'sf-subhead', children: t('tabsSelHead') }),
          jsx(Row, {
            title: t('tabsSelTint'),
            description: t('tabsSelTintDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'standard', label: t('tabsSelTintStandard') },
                { id: 'accent', label: t('tabsSelTintAccent') },
                { id: 'custom', label: t('tabsSelTintCustom') }
              ],
              value: tabs.selTint,
              onChange: value => patch('tabs', 'selTint', value)
            })
          }),
          jsx(Row, {
            title: t('tabsSelColor'),
            description: t('tabsSelColorDesc'),
            action: colorRowControl(tabs.selColor, value => patch('tabs', 'selColor', value), t('personalAccentReset'))
          }),
          jsx(ToggleRow, {
            label: t('tabsSelBorder'),
            description: t('tabsSelBorderDesc'),
            checked: tabs.selBorder,
            onChange: value => patch('tabs', 'selBorder', value)
          }),
          jsx(Row, {
            title: t('tabsSelShadow'),
            description: t('tabsSelShadowDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'off', label: t('personalShellShadowOff') },
                { id: 'subtle', label: t('personalShellShadowSubtle') },
                { id: 'medium', label: t('personalShellShadowMedium') },
                { id: 'strong', label: t('personalShellShadowStrong') }
              ],
              value: tabs.selShadow,
              onChange: value => patch('tabs', 'selShadow', value)
            })
          }),
          jsx('p', { className: 'sf-subhead', children: t('tabsLiveHead') }),
          jsx(ToggleRow, {
            label: t('tabsRowLive'),
            description: t('tabsRowLiveDesc'),
            checked: tabs.rowLive,
            onChange: value => patch('tabs', 'rowLive', value)
          }),
          jsx(ToggleRow, {
            label: t('tabsShowTime'),
            description: t('tabsShowTimeDesc'),
            checked: tabs.showTime,
            onChange: value => patch('tabs', 'showTime', value)
          }),
          jsx(ToggleRow, {
            label: t('tabsShowPreview'),
            description: t('tabsShowPreviewDesc'),
            checked: tabs.showPreview,
            onChange: value => patch('tabs', 'showPreview', value)
          }),
          jsx(ToggleRow, {
            label: t('tabsShowCounts'),
            description: t('tabsShowCountsDesc'),
            checked: tabs.showCounts,
            onChange: value => patch('tabs', 'showCounts', value)
          }),
          jsx(ToggleRow, {
            label: t('tabsShowSource'),
            description: t('tabsShowSourceDesc'),
            checked: tabs.showSource,
            onChange: value => patch('tabs', 'showSource', value)
          }),
          jsx(Row, {
            title: t('tabsOpenIntent'),
            description: t('tabsOpenIntentDesc'),
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
            description: t('tabsMaxItemsDesc'),
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
            description: t('tabsLivePollDesc'),
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
            description: t('tabsRefreshDesc'),
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
        id: 'sf-sec-groups',
        title: t('secGroups'),
        description: t('secGroupsDesc'),
        children: [
          jsx(ToggleRow, {
            label: t('groupsEnabled'),
            description: t('groupsEnabledDesc'),
            checked: groups.enabled,
            onChange: value => patch('groups', 'enabled', value)
          }),
          jsx(Row, {
            title: t('groupsAutoMode'),
            description: t('groupsAutoModeDesc'),
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
            description: t('groupsStackStyleDesc'),
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
            description: t('groupsShowUngroupedDesc'),
            checked: groups.showUngrouped,
            disabled: !groups.enabled,
            onChange: value => patch('groups', 'showUngrouped', value)
          }),
          jsx('p', { className: 'sf-hint', children: t('groupsHint') })
        ]
      }),

      // ── UI-Tabs (Content-Bereich) ─────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'multiple-windows',
        id: 'sf-sec-uitabs',
        title: t('secUiTabs'),
        description: t('secUiTabsDesc'),
        children: [
          jsx(Row, {
            title: t('uiTabsPresets'),
            description: t('uiTabsPresetsDesc'),
            action: jsxs('div', {
              className: 'sf-preset-row',
              children: [
                jsx(Button, {
                  onClick: () => applyUiTabsPreset('sidebar'),
                  size: 'sm',
                  variant: 'secondary',
                  children: t('uiTabsPresetSidebar')
                }),
                jsx(Button, {
                  onClick: () => applyUiTabsPreset('minimal'),
                  size: 'sm',
                  variant: 'ghost',
                  children: t('uiTabsPresetMinimal')
                }),
                jsx(Button, {
                  onClick: () => applyUiTabsPreset('stock'),
                  size: 'sm',
                  variant: 'ghost',
                  children: t('uiTabsPresetStock')
                })
              ]
            })
          }),
          jsx(ToggleRow, {
            label: t('uiTabsEnabled'),
            description: t('uiTabsEnabledDesc'),
            checked: uiTabs.enabled,
            onChange: value => patch('uiTabs', 'enabled', value)
          }),
          jsx(Row, {
            title: t('uiTabsRadius'),
            description: t('uiTabsRadiusDesc'),
            action: jsx(NumberInput, {
              min: 0,
              max: 12,
              step: 1,
              value: uiTabs.radius,
              onChange: value => patch('uiTabs', 'radius', value)
            })
          }),
          jsx(Row, {
            title: t('uiTabsGap'),
            description: t('uiTabsGapDesc'),
            action: jsx(NumberInput, {
              min: 0,
              max: 10,
              step: 1,
              value: uiTabs.gap,
              onChange: value => patch('uiTabs', 'gap', value)
            })
          }),
          jsx(Row, {
            title: t('uiTabsInset'),
            description: t('uiTabsInsetDesc'),
            action: jsx(NumberInput, {
              min: 0,
              max: 8,
              step: 1,
              value: uiTabs.insetY,
              onChange: value => patch('uiTabs', 'insetY', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('uiTabsSeparators'),
            description: t('uiTabsSeparatorsDesc'),
            checked: uiTabs.separators,
            disabled: !uiTabs.enabled,
            onChange: value => patch('uiTabs', 'separators', value)
          }),
          jsx(Row, {
            title: t('uiTabsActive'),
            description: t('uiTabsActiveDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'sidebar', label: t('uiTabsActiveSidebar') },
                { id: 'underline', label: t('uiTabsActiveUnderline') },
                { id: 'both', label: t('uiTabsActiveBoth') }
              ],
              value: uiTabs.activeStyle,
              onChange: value => patch('uiTabs', 'activeStyle', value)
            })
          }),
          jsx(Row, {
            title: t('uiTabsLabelCase'),
            description: t('uiTabsLabelCaseDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'normal', label: t('uiTabsCaseNormal') },
                { id: 'upper', label: t('uiTabsCaseUpper') }
              ],
              value: uiTabs.labelCase,
              onChange: value => patch('uiTabs', 'labelCase', value)
            })
          }),
          jsx(Row, {
            title: t('uiTabsLabelSize'),
            description: t('uiTabsLabelSizeDesc'),
            action: jsx(NumberInput, {
              min: 10,
              max: 13,
              step: 1,
              value: uiTabs.labelSize,
              onChange: value => patch('uiTabs', 'labelSize', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('uiTabsShowLead'),
            description: t('uiTabsShowLeadDesc'),
            checked: uiTabs.showLead,
            disabled: !uiTabs.enabled,
            onChange: value => patch('uiTabs', 'showLead', value)
          }),
          jsx(Row, {
            title: t('uiTabsCloseMode'),
            description: t('uiTabsCloseModeDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'hover', label: t('uiTabsCloseOnHover') },
                { id: 'always', label: t('uiTabsCloseAlways') },
                { id: 'active', label: t('uiTabsCloseActive') }
              ],
              value: uiTabs.closeMode,
              onChange: value => patch('uiTabs', 'closeMode', value)
            })
          }),
          jsx(Row, {
            title: t('uiTabsCloseWidth'),
            description: t('uiTabsCloseWidthDesc'),
            action: jsx(NumberInput, {
              min: 14,
              max: 32,
              step: 2,
              value: uiTabs.closeWidth,
              onChange: value => patch('uiTabs', 'closeWidth', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('uiTabsCloseHoverBg'),
            description: t('uiTabsCloseHoverBgDesc'),
            checked: uiTabs.closeHover,
            disabled: !uiTabs.enabled,
            onChange: value => patch('uiTabs', 'closeHover', value)
          }),
          jsx(ToggleRow, {
            label: t('uiTabsArc'),
            description: t('uiTabsArcDesc'),
            checked: uiTabs.arc,
            disabled: !uiTabs.enabled,
            onChange: value => patch('uiTabs', 'arc', value)
          }),
          jsx('p', { className: 'sf-hint', children: t('uiTabsHint') })
        ]
      }),

      // ── Glass & Lesbarkeit ─────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'paintcan',
        id: 'sf-sec-glass',
        title: t('secGlass'),
        description: t('secGlassDesc'),
        children: [
          jsx(ToggleRow, {
            label: t('glassEnabled'),
            description: t('glassEnabledDesc'),
            checked: glass.enabled,
            onChange: value => patch('glass', 'enabled', value)
          }),
          jsx(Row, {
            title: t('glassBlur'),
            description: t('glassBlurDesc'),
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
            description: t('glassSaturateDesc'),
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
            description: t('glassFillDesc'),
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
            description: t('glassTintDesc'),
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
            description: t('glassAngleDesc'),
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
            description: t('glassGradOpacityDesc'),
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
            description: t('glassReachDesc'),
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
            label: t('glassArc'),
            description: t('glassArcDesc'),
            checked: glass.arc,
            disabled: !glass.enabled,
            onChange: value => patch('glass', 'arc', value)
          }),
          jsx(Row, {
            title: t('glassArcMode'),
            description: t('glassArcModeDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'always', label: t('glassArcAlways') },
                { id: 'busy', label: t('glassArcBusy') }
              ],
              value: glass.arcMode,
              onChange: value => patch('glass', 'arcMode', value)
            })
          }),
          jsx(Row, {
            title: t('glassArcWidth'),
            description: t('glassArcWidthDesc'),
            action: jsx(NumberInput, {
              min: 0.5,
              max: 4,
              step: 0.5,
              value: glass.arcWidth,
              onChange: value => patch('glass', 'arcWidth', value)
            })
          }),
          jsx(Row, {
            title: t('glassArcDuration'),
            description: t('glassArcDurationDesc'),
            action: jsx(NumberInput, {
              min: 1,
              max: 12,
              step: 0.5,
              value: glass.arcDuration,
              onChange: value => patch('glass', 'arcDuration', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('glassScopeComposer'),
            description: t('glassScopeComposerDesc'),
            checked: glass.scopes.composer,
            disabled: !glass.enabled,
            onChange: value => patch('glass', 'scopes', { ...glass.scopes, composer: value })
          }),
          jsx(ToggleRow, {
            label: t('glassScopeChips'),
            description: t('glassScopeChipsDesc'),
            checked: glass.scopes.chips,
            disabled: !glass.enabled,
            onChange: value => patch('glass', 'scopes', { ...glass.scopes, chips: value })
          }),
          jsx(ToggleRow, {
            label: t('glassScopeStatusbar'),
            description: t('glassScopeStatusbarDesc'),
            checked: glass.scopes.statusbar,
            disabled: !glass.enabled,
            onChange: value => patch('glass', 'scopes', { ...glass.scopes, statusbar: value })
          }),
          jsx('p', { className: 'sf-hint', children: t('glassHint') })
        ]
      }),

      // ── Individualisierung ──────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'symbol-color',
        id: 'sf-sec-personal',
        title: t('secPersonal'),
        description: t('secPersonalDesc'),
        children: [
          jsx(ToggleRow, {
            label: t('personalAccentOn'),
            description: t('personalAccentOnDesc'),
            checked: personal.accentOn,
            onChange: value => patch('personal', 'accentOn', value)
          }),
          jsx(Row, {
            title: t('personalAccentColor'),
            description: t('personalAccentColorDesc'),
            action: jsxs('div', {
              className: 'sf-row-control',
              children: [
                jsx(GroupSwatches, {
                  value: personal.accentColor || null,
                  onChange: value => patch('personal', 'accentColor', value || '#7c3aed'),
                  clearLabel: t('personalAccentReset')
                }),
                jsx(Input, {
                  className: 'sf-num',
                  maxLength: 7,
                  onChange: event => patch('personal', 'accentColor', String(event.target.value || '').trim()),
                  placeholder: '#7c3aed',
                  value: personal.accentColor || ''
                })
              ]
            })
          }),
          jsx('p', { className: 'sf-hint', children: t('personalAccentHint') }),
          jsx(ToggleRow, {
            label: t('personalBgOn'),
            description: t('personalBgOnDesc'),
            checked: personal.bgOn,
            onChange: value => patch('personal', 'bgOn', value)
          }),
          jsx(Row, {
            title: t('personalBgKind'),
            description: t('personalBgKindDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'image', label: t('personalBgKindImage') },
                { id: 'video', label: t('personalBgKindVideo') }
              ],
              value: personal.bgKind,
              onChange: value => patch('personal', 'bgKind', value)
            })
          }),
          jsx(Row, {
            title: t('personalBgPath'),
            description: t('personalBgPathDesc'),
            action: jsxs('div', {
              className: 'sf-row-control',
              children: [
                jsx(Input, {
                  onChange: event => patch('personal', 'bgPath', String(event.target.value || '').trim()),
                  placeholder: '/home/deniz/Pictures/bg.jpg',
                  value: personal.bgPath || ''
                }),
                jsx(Button, {
                  onClick: () => pickBackgroundFile(),
                  size: 'sm',
                  variant: 'ghost',
                  children: t('personalBgPathPick')
                })
              ]
            })
          }),
          jsx('p', { className: 'sf-hint', children: t('personalBgPathHint') }),
          jsx(Row, {
            title: t('personalBgFit'),
            description: t('personalBgFitDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'cover', label: t('personalBgFitCover') },
                { id: 'contain', label: t('personalBgFitContain') }
              ],
              value: personal.bgFit,
              onChange: value => patch('personal', 'bgFit', value)
            })
          }),
          jsx(Row, {
            title: t('personalBgDim'),
            description: t('personalBgDimDesc'),
            action: jsx(NumberInput, {
              min: 0,
              max: 85,
              step: 5,
              value: personal.bgDim,
              onChange: value => patch('personal', 'bgDim', value)
            })
          }),
          jsx(Row, {
            title: t('personalBgBlur'),
            description: t('personalBgBlurDesc'),
            action: jsx(NumberInput, {
              min: 0,
              max: 24,
              step: 2,
              value: personal.bgBlur,
              onChange: value => patch('personal', 'bgBlur', value)
            })
          }),
          jsx(Row, {
            title: t('personalBgScope'),
            description: t('personalBgScopeDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'chat', label: t('personalBgScopeChat') },
                { id: 'all', label: t('personalBgScopeAll') }
              ],
              value: personal.bgScope,
              onChange: value => patch('personal', 'bgScope', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('personalShellOn'),
            description: t('personalShellOnDesc'),
            checked: personal.shellOn,
            onChange: value => patch('personal', 'shellOn', value)
          }),
          jsx(Row, {
            title: t('personalShellRadius'),
            description: t('personalShellRadiusDesc'),
            action: jsx(NumberInput, {
              min: 4,
              max: 24,
              step: 1,
              value: personal.shellRadius,
              onChange: value => patch('personal', 'shellRadius', value)
            })
          }),
          jsx(Row, {
            title: t('personalShellShadow'),
            description: t('personalShellShadowDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'off', label: t('personalShellShadowOff') },
                { id: 'subtle', label: t('personalShellShadowSubtle') },
                { id: 'medium', label: t('personalShellShadowMedium') },
                { id: 'strong', label: t('personalShellShadowStrong') }
              ],
              value: personal.shellShadow,
              onChange: value => patch('personal', 'shellShadow', value)
            })
          }),
          jsx(ToggleRow, {
            label: t('personalShellBorder'),
            description: t('personalShellBorderDesc'),
            checked: personal.shellBorder,
            onChange: value => patch('personal', 'shellBorder', value)
          }),
          jsx(Row, {
            title: t('personalShellScope'),
            description: t('personalShellScopeDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'all', label: t('personalBgScopeAll') },
                { id: 'chat', label: t('personalBgScopeChat') }
              ],
              value: personal.shellScope,
              onChange: value => patch('personal', 'shellScope', value)
            })
          })
        ]
      }),

      // ── Über ───────────────────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'info',
        id: 'sf-sec-about',
        title: t('secAbout'),
        description: t('secAboutDesc'),
        children: [
          jsx(Row, {
            title: t('aboutVersion'),
            description: t('aboutVersionDesc'),
            action: jsx('span', { className: 'sf-row-desc', children: VERSION })
          }),
          jsx(Row, {
            title: t('aboutDeveloper'),
            description: t('aboutDeveloperDesc'),
            action: jsx('span', { className: 'sf-row-desc', children: 'AGANTILA — Deniz Yilmaz' })
          }),
          jsx(Row, {
            title: t('aboutLicense'),
            description: t('aboutLicenseDesc'),
            action: jsx('span', { className: 'sf-row-desc', children: 'MIT (Open Source)' })
          }),
          jsx(Row, {
            title: t('aboutStats', rows.length, groupsState.groups.length),
            description: t('aboutStatsDesc'),
            action: null
          }),
          jsx(Row, {
            title: t('aboutResetSettings'),
            description: t('aboutResetSettingsDesc'),
            action: jsx(Button, {
              onClick: () => resetSettings(),
              size: 'sm',
              variant: 'ghost',
              children: t('aboutResetSettings')
            })
          }),
          jsx(Row, {
            title: t('aboutResetGroups'),
            description: t('aboutResetGroupsDesc'),
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

    // 2b-3) Individualisierung: Akzent-Tönung, Chat-Hintergrund, Content-Shell.
    applyPersonal()
    const stopPersonalWatch = $settings.listen(() => applyPersonal())
    ctx.setInterval(() => syncPaneBackgrounds(), 2500)

    // 2b-4) Session-Ansicht (Liste/Grid): Layout-Variablen auf <html>.
    applyGrid()
    const stopGridWatch = $settings.listen(() => applyGrid())

    // 2b-4b) Row-Design: Verlauf, Schatten, Titel-Verlauf, Auswahl, Live-Status.
    applyRows()
    const stopRowsWatch = $settings.listen(() => applyRows())
    // 2b-5) Info-Dichte „Wie Hermes": folgt der App-Einstellung live.
    const stopAppDensityWatch = watchAppDensity()

    // 2b-6) Kontextfenster-Info (reduziert): Prozent je LIVE-Session.
    const stopCtxInfoWatch = $settings.listen(() => {
      if (readSetting('tabs', 'showContext')) {
        scheduleContextRefresh(400)
      } else {
        window.clearTimeout(ctxRefreshTimer)
        $ctxInfo.set({})
      }
    })

    if (readSetting('tabs', 'showContext')) {
      scheduleContextRefresh(2500)
    }

    // 2c) Umlaufender Glow-Ring folgt der Aktivität (Modus „busy").
    const stopArcWatch = [
      $activity.listen(() => syncArc()),
      $liveMap.listen(() => syncArc()),
      host.state.focusedStoredSessionId.listen(() => syncArc())
    ]

    // 2d) UI-Tabs: Sidebar-Optik für die Content-Tab-Leiste + Live-Status.
    applyUiTabs()
    const stopUiTabsWatch = $settings.listen(() => applyUiTabs())
    const stopTabBusyWatch = [
      $activity.listen(() => syncTabBusy()),
      $liveMap.listen(() => syncTabBusy())
    ]

    ctx.setInterval(() => syncTabBusy(), 2000)

    // Versions-Stempel: belegt im Plugin-Storage, welche Version zuletzt sauber
    // geladen wurde (Hilfe beim Debuggen nach Kopie/Hot-Reload).
    try {
      ctx.storage.set('_meta', { loadedAt: Date.now(), version: VERSION })
    } catch (error) {
      console.warn(`[${ID}] meta write failed`, error)
    }

    console.info(`[${ID}] v${VERSION} loaded (glass: ${readSetting('glass', 'enabled') ? 'on' : 'off'})`)

    // Radius des Glow-Rings folgt live der echten Composer-Kontur (Theme-unabhängig).
    ctx.setInterval(() => measureComposerRadius(), 4000)


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
        for (const stop of stopArcWatch) stop()
        for (const stop of stopTabBusyWatch) stop()
        stopUiTabsWatch()
        clearUiTabs()
        stopGlassWatch()
        clearGlass()
        stopPersonalWatch()
        clearPersonal()
        stopGridWatch()
        stopRowsWatch()
        clearRows()
        stopAppDensityWatch()
        stopCtxInfoWatch()
        window.clearTimeout(ctxRefreshTimer)
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
