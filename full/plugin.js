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
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
const VERSION = '1.29.0'
const SETTINGS_KEY = 'settings.v1'
const GROUPS_KEY = 'groups.v1'

// Pointer-Drag-Ghost-Chip (v1.28.0) — Plugin-Variante des Musters aus
// Hermes Desktops eigenem `src/lib/drag-ghost.ts`: flaches, cursor-
// folgendes Div, reines DOM (kein React), ueberlebt daher einen Pointer-
// Drag ohne Re-Renders und raeumt sich synchron bei Esc/Drop ab.
function createDragGhost(label) {
  const el = document.createElement('div')
  el.className = 'sf-drag-ghost'
  el.textContent = String(label || '')
  document.body.appendChild(el)
  return {
    moveTo(x, y) {
      el.style.transform = `translate3d(${x + 14}px, ${y + 12}px, 0)`
    },
    destroy() {
      el.remove()
    }
  }
}

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
    // v1.27.3: Basis 10px (User-Vorgabe „beide Titelgrößen 10px initial").
    textSize: 100,
    infoDensity: 'auto',
    alignTop: true,
    showContext: false,
    ctxPie: true,
    ctxStyle: 'donut',
    rowGradOn: false,
    rowGradFrom: '#7c3aed',
    rowGradTo: '#00dbda',
    rowGradAngle: 135,
    rowShadow: 'off',
    hoverLift: true,
    titleStyle: 'none',
    titleColor: '#e4e4e7',
    titleGradOn: false,
    titleGradFrom: '#e4e4e7',
    titleGradTo: '#8b8b93',
    titleGradAngle: 90,
    selTint: 'standard',
    selColor: '#7c3aed',
    selBorder: false,
    selShadow: 'off',
    selHover: 'soft',
    rowLive: false,
    liveFrame: 'glow',
    doneFx: 'glow-wobble',
    doneFxAxis: 'x',
    doneFxStrength: 'subtle',
    maxVisible: 0,
    asTabSelector: false,
    appNav: true,
    // ── Liste/Grid-Farben je Theme (Dark/Light) ──────────────────────────
    // Dark nutzt die flachen Keys oben (abwärtskompatibel). Light nutzt den
    // eigenen Satz `lightTheme` — nur aktiv, wenn `themeSplit` an ist.
    // `themeTab` ist reiner UI-Zustand (welcher Subtab in den Einstellungen
    // gerade editiert wird), kein Theme-Schalter.
    themeSplit: false,
    themeAutoDerive: true,
    themeTab: 'dark',
    themeMode: 'auto',
    lightTheme: {
      rowGradOn: false,
      rowGradFrom: '#6d28d9',
      rowGradTo: '#0e7490',
      rowGradAngle: 135,
      rowShadow: 'off',
      titleStyle: 'none',
      titleColor: '#18181b',
      titleGradOn: false,
      titleGradFrom: '#18181b',
      titleGradTo: '#52525b',
      titleGradAngle: 90,
      selColor: '#6d28d9',
      selShadow: 'off'
    }
  },
  groups: {
    enabled: true,
    // v1.27.4: Werksdefault 'project' — Hermes Desktop gruppiert seine
    // Sessions-Liste standardmäßig nach Projekten; ein Session-Flow-Reset
    // soll dieselbe Grundlage wiederherstellen (User-Report: nach Reset
    // waren alle Sessions „ohne Zuweisung", weil 'off' keine Projekt-
    // Gruppierung mehr lief). Die Zuordnung selbst kommt serverseitig aus
    // projects.tree und ist vom Reset nicht betroffen — es fehlte nur die
    // Anzeige-Gruppierung.
    autoMode: 'project',
    headerDensity: 'comfortable',
    // Projekt-/Gruppen-Kopfzeilen-Titel: px-Größe (v1.27.3: Default 10,
    // gleichauf mit den Session-Titeln) + Kapitälchen-Toggle.
    nameSize: 10,
    nameCaps: true,
    stackStyle: 'spine',
    showUngrouped: true
  },
  // Ansichts-Filter/Sortierung — Parität zur Hermes-Desktop-Sessions-Ansicht
  // (Sidebar-Filtermenü). Persistiert wie die App-Einstellungen der Sidebar;
  // Zeilen-Metadaten sind Toggles, Filter sind Multi-Select-Listen.
  view: {
    ordering: 'updated', // 'updated' | 'created' | 'status' | 'tokens' | 'cost'
    statusFilter: [], // ['working','needs-input','unread','draft','idle'] — leer = alle
    projectFilter: [], // Projekt-IDs — leer = alle
    showArchived: false, // Archiv-Anzeigemodus (eigener Tab in der Filterleiste)
    showTokens: false,
    showCost: false,
    showProfile: false,
    dismissedAuto: [] // Auto-Projekt-IDs, die der Nutzer ausgeblendet hat
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
    scopes: { composer: true, chips: false, statusbar: false }
  },
  personal: {
    accentOn: false,
    accentColor: '#7c3aed',
    // Pane-Fläche des Sessions-Panes: 'native' malt dieselbe Variable wie die
    // native Sessions-Sidebar (--ui-sidebar-surface-background), 'chat' den
    // bisherigen Chat-Look, 'none' ganz ohne eigenen Fill.
    paneSurface: 'native',
    bgOn: false,
    bgKind: 'image',
    bgPath: '',
    bgFit: 'cover',
    bgDim: 35,
    bgBlur: 0,
    bgScope: 'chat',
  },
  composer: {
    // Projekt-Kontext-Pill im Composer-Statusstapel (erste Zeile über dem
    // Eingabefeld): zeigt bei New Session das Ziel-Projekt und erlaubt den
    // Wechsel VOR der ersten Eingabe. Default an — die Zuweisung ist der
    // Kern des v1.17.3/v1.19.x-Ankers.
    projectPill: true
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

const $settingsDirty = atom(false)

let settingsSaveTimer = 0

/** Sofort persistieren (überspringt die Debounce) — für den Übernehmen-Button. */
function flushSettingsSave() {
  window.clearTimeout(settingsSaveTimer)
  settingsSaveTimer = 0

  try {
    CTX?.storage?.set(SETTINGS_KEY, $settings.get())
  } catch (error) {
    console.warn(`[${ID}] settings save failed`, error)
  }

  $settingsDirty.set(false)
}

function scheduleSettingsSave() {
  $settingsDirty.set(true)
  window.clearTimeout(settingsSaveTimer)
  settingsSaveTimer = window.setTimeout(() => flushSettingsSave(), 350)
}

/** Alle deklarativen Spiegel (Attribute/Variablen auf <html>) neu anwenden.
 *  Catalog-Build: applyGlass/applyUiTabs existieren dort nicht (Regel 8) —
 *  die Liste wird im #full-Block durch die Vollversion ersetzt. */
function applyAllSettings() {
  for (const apply of [applyRows, applyGrid]) {
    try {
      apply()
    } catch (error) {
      console.warn(`[${ID}] apply failed`, error)
    }
  }
}

/* #full */
applyAllSettings = function applyAllSettings() {
  for (const apply of [applyGlass, applyPersonal, applyRows, applyUiTabs, applyGrid]) {
    try {
      apply()
    } catch (error) {
      console.warn(`[${ID}] apply failed`, error)
    }
  }
}
/* #end */

function loadSettings() {
  let saved = null

  try {
    saved = CTX?.storage?.get(SETTINGS_KEY, null)
  } catch {
    saved = null
  }

  $settings.set(deepMerge(DEFAULT_SETTINGS, isPlainObject(saved) ? saved : {}))

  // v1.27.3 One-Shot-Migration: die Kopfzeilen-Basis ist auf 10px
  // umgestellt (vorher 14px). Nutzer mit dem alten Default (14) werden
  // einmalig auf den neuen Default (10) gesetzt; explizit gesetzte Werte
  // (≠ 14) bleiben unberührt. `tabs.textSize` ist basis-unabhängig
  // (Prozentwert) und braucht keine Migration.
  try {
    const current = $settings.get()
    if (current?.groups?.nameSize === 14) {
      $settings.set({
        ...current,
        groups: { ...current.groups, nameSize: 10 }
      })
      scheduleSettingsSave()
    }
  } catch {
    /* Migration best-effort */
  }

  // Stand 2026-10-05: Chips-Glow/Hintergrund raus, nur Text + Icon. Werks-
  // standard ist jetzt „aus"; wer den Frosted-Look behalten möchte, schaltet
  // ihn in den Glass-Settings wieder ein. Damit der Wechsel auch bei
  // bestehenden Usern sofort sichtbar wird, setzen wir den Wert einmalig
  // zurück, falls er noch aus der alten Standardzeit auf „true" steht.
  try {
    const current = $settings.get()
    if (current?.glass?.scopes?.chips === true) {
      $settings.set({
        ...current,
        glass: { ...current.glass, scopes: { ...current.glass.scopes, chips: false } }
      })
      scheduleSettingsSave()
    }
  } catch {
    /* Settings evtl. noch nicht initialisiert — egal */
  }

  // Migration v1.22.1: der Titel hatte nur „Verlauf an/aus". Neu ist der
  // Titel-Stil `titleStyle` (none|solid|gradient). Wer titleGradOn=true
  // gespeichert hatte, bekommt einmalig 'gradient' — sonst ginge seine
  // Einstellung verloren.
  try {
    const current = $settings.get()
    if (current?.tabs && !current.tabs.titleStyleSaved) {
      const tabs = current.tabs
      const next = { ...tabs, titleStyleSaved: true }
      if (!next.titleStyle || next.titleStyle === DEFAULT_SETTINGS.tabs.titleStyle) {
        if (tabs.titleGradOn === true) next.titleStyle = 'gradient'
      }
      const lt = tabs.lightTheme
      if (lt && typeof lt === 'object') {
        const ltNext = { ...lt }
        if (!ltNext.titleStyle || ltNext.titleStyle === DEFAULT_SETTINGS.tabs.lightTheme.titleStyle) {
          if (lt.titleGradOn === true) ltNext.titleStyle = 'gradient'
        }
        next.lightTheme = ltNext
      }
      $settings.set({ ...current, tabs: next })
      scheduleSettingsSave()
    }
  } catch {
    /* egal */
  }
}

/** Patcht eine Sektion (z.B. 'wheel', {enabled:false}) und persistiert. */
function patchSettings(section, patch) {
  const current = $settings.get()
  $settings.set({ ...current, [section]: { ...current[section], ...patch } })
  scheduleSettingsSave()

  // Ein Dichte-Wechsel kann die Kontext-Daten nötig machen (Stats-Zeile bei Detailreich).
  if (section === 'tabs' && patch && 'infoDensity' in patch) {
    scheduleContextRefresh(600)
  }
}

/** Patcht ein verschachteltes Sub-Objekt einer Sektion (z.B. tabs.lightTheme) und persistiert. */
function patchSubSettings(section, sub, patch) {
  const current = $settings.get()
  const sectionValue = current[section] && typeof current[section] === 'object' ? current[section] : {}
  const subValue = sectionValue[sub] && typeof sectionValue[sub] === 'object' ? sectionValue[sub] : {}
  $settings.set({
    ...current,
    [section]: { ...sectionValue, [sub]: { ...subValue, ...patch } }
  })
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

/* #full */
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
/* #end */

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

/* #full */
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

/* #end */
/* #full */
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
  '--sf-bg-blur'
]

/** URL für lokale Dateien über das App-Protokoll (Range-fähig, Video-tauglich). */
function mediaStreamUrl(filePath) {
  return `hermes-media://stream/${encodeURIComponent(filePath)}`
}
/* #end */

/* #full */
/** Entfernt alle injizierten Hintergrund-Layer (Dispose / deaktiviert). */
function removePaneBackgrounds() {
  try {
    document.querySelectorAll('[data-sf-bg-layer]').forEach(layer => layer.remove())
  } catch {
    /* DOM evtl. schon weg — egal */
  }
}
/* #end */

function clearPersonal() {
  const root = document.documentElement

  // Pane-Fläche ist eigenes Pane-UI — in beiden Builds aufräumen.
  root.removeAttribute('data-sf-panesurface')

  /* #full */
  for (const attr of [
    'data-sf-accent',
    'data-sf-bg',
    'data-sf-bg-kind',
    'data-sf-bg-scope'
  ]) {
    root.removeAttribute(attr)
  }

  for (const name of SF_PERSONAL_VARS) root.style.removeProperty(name)
  removePaneBackgrounds()
  /* #end */
}

function applyPersonal() {
  const p = $settings.get().personal || {}

  try {
    const root = document.documentElement

    // 0) Pane-Fläche: 'native' = dieselbe Variable wie die native
    //    Sessions-Sidebar, 'chat' = Chat-Surface-Farbe (alter Look),
    //    'none' = kein eigener Fill. Immer spiegeln — auch 'none' braucht
    //    das Attribut, damit alte Inline-Fills nie zurückbleiben.
    //    NUR eigenes Pane-UI → legal in beiden Builds (Catalog + Full).
    const surface = p.paneSurface === 'chat' ? 'chat' : p.paneSurface === 'none' ? 'none' : 'native'
    root.setAttribute('data-sf-panesurface', surface)

    // 1)+2) Akzent (--ui-accent-Override der Kern-UI) und Chat-Hintergrund
    //    (Layer-Injektion in App-Panes) greifen in App-eigenes UI ein —
    //    Catalog-Regel 8: nur im Full-Build (SDK-Themes-Door steht aus,
    //    see #116305).
    /* #full */
    const accent = String(p.accentColor || '').trim()

    if (p.accentOn && /^#[0-9a-f]{6}$/i.test(accent)) {
      root.setAttribute('data-sf-accent', 'on')
      root.style.setProperty('--sf-accent-color', accent)
    } else {
      root.removeAttribute('data-sf-accent')
      root.style.removeProperty('--sf-accent-color')
    }

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

    syncPaneBackgrounds()
    /* #end */
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

// ─────────────────────────────────────────────────────────────────────────────
// Theme-Erkennung (Dark/Light) + Farb-Ableitung
// ─────────────────────────────────────────────────────────────────────────────
// Erkennt das aktive App-Theme mehrstufig — Marker-Klasse/-Attribut zuerst,
// sonst die Helligkeit der Fläche, zuletzt prefers-color-scheme. Damit bleibt
// es unabhängig von der genauen Theme-Implementierung der App. Die Gegenfarbe
// fürs jeweils andere Theme wird in HSL abgeleitet (Hue bleibt): Flächen in ein
// lesbares Helligkeitsband, Text/Titel invertiert ins passende Band.

/** Relatives Luminanz-Verhältnis (WCAG) 0..1 aus [r,g,b] (0..255). */
function relLuminance([r, g, b]) {
  const lin = c => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** 'rgb(a,b,c[,a])' / '#rgb' / '#rrggbb' → { rgb:[r,g,b], alpha:0..1 }; null wenn nicht parsebar. */
function parseCssColor(value) {
  const s = String(value || '').trim()
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/i.exec(s)
  if (m) {
    let alpha = 1
    if (m[4] !== undefined) {
      alpha = m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4])
    }
    return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number.isFinite(alpha) ? alpha : 1 }
  }
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s)
  if (h) {
    let x = h[1]
    if (x.length === 3) x = x.split('').map(c => c + c).join('')
    const alpha = x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1
    return { rgb: [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)], alpha }
  }
  return null
}

/** Aktives App-Theme: 'dark' | 'light'. */
function detectAppTheme() {
  try {
    const html = document.documentElement
    const body = document.body
    const cls = `${html?.className || ''} ${body?.className || ''}`.toLowerCase()
    if (/(^|\s)dark(\s|$)/.test(cls)) return 'dark'
    if (/(^|\s)light(\s|$)/.test(cls)) return 'light'

    for (const el of [html, body]) {
      if (!el || typeof el.getAttribute !== 'function') continue
      const mark = String(
        el.getAttribute('data-theme') || el.getAttribute('data-color-scheme')
        || el.getAttribute('data-appearance') || el.getAttribute('data-mode') || ''
      ).toLowerCase()
      if (mark.includes('dark')) return 'dark'
      if (mark.includes('light')) return 'light'
    }

    // `color-scheme` ist das standardisierte Signal (App setzt es oft auf
    // dark/light) — vor der Flächen-Helligkeit geprüft, weil es eindeutig ist.
    if (typeof getComputedStyle === 'function') {
      for (const el of [html, body]) {
        if (!el) continue
        const scheme = String(getComputedStyle(el).colorScheme || '').toLowerCase()
        if (scheme.includes('dark')) return 'dark'
        if (scheme.includes('light') && !scheme.includes('dark')) return 'light'
      }
    }

    // Flächen-Helligkeit — nur wenn die Fläche eine ECHTE, undurchsichtige Farbe
    // hat. Transparente Flächen (rgba(0,0,0,0), App malt den Grund woanders)
    // lieferten früher fälschlich [0,0,0] → „dark"; darum hier überspringen.
    if (typeof getComputedStyle === 'function') {
      for (const el of [html, body]) {
        if (!el) continue
        const rgb = parseCssColor(getComputedStyle(el).backgroundColor)
        if (rgb && rgb.alpha > 0.5) return relLuminance(rgb.rgb) < 0.5 ? 'dark' : 'light'
      }
    }
  } catch {
    /* Tests ohne echtes DOM */
  }

  try {
    if (window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
      if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
    }
  } catch {
    /* egal */
  }

  return 'dark'
}

/** Effektives Theme: manueller Override (`themeMode`) vor Auto-Erkennung. */
function effectiveTheme(themeMode) {
  if (themeMode === 'dark' || themeMode === 'light') return themeMode
  return detectAppTheme()
}

const clamp01 = v => Math.min(1, Math.max(0, v))

function hexToRgb255(hex) {
  const h = String(hex || '').replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgb255ToHex(r, g, b) {
  const to = c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

/** [r,g,b] (0..255) → {h (0..360), s (0..1), l (0..1)}. */
function rgbToHsl(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
  }

  return { h, s, l }
}

/** {h (0..360), s (0..1), l (0..1)} → [r,g,b] (0..255). */
function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let rgb

  if (hue < 60) rgb = [c, x, 0]
  else if (hue < 120) rgb = [x, c, 0]
  else if (hue < 180) rgb = [0, c, x]
  else if (hue < 240) rgb = [0, x, c]
  else if (hue < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255]
}

/**
 * Leitet aus einer Farbe die passende Gegenfarbe fürs andere Theme ab.
 * `kind` = 'fill' (Flächen/Verläufe) | 'text' (Titel/Text).
 *   fill → light: Helligkeit in ein lesbares Band (0.36–0.58), Sättigung leicht hoch.
 *   fill → dark : Helligkeit (0.46–0.72).
 *   text → light: invertiert ins dunkle Band (0.08–0.32) — dunkler Text auf hell.
 *   text → dark : invertiert ins helle Band (0.72–0.96) — heller Text auf dunkel.
 * Hue und Alpha bleiben erhalten.
 */
function deriveForTheme(value, toTheme, kind = 'fill') {
  const parsed = parseColorValue(value)

  if (!parsed) return value

  const [r, g, b] = hexToRgb255(parsed.base)
  const { h, s, l } = rgbToHsl(r, g, b)
  let nl
  let ns = s

  if (kind === 'text') {
    const [lo, hi] = toTheme === 'light' ? [0.08, 0.32] : [0.72, 0.96]
    nl = lo + (1 - l) * (hi - lo)
  } else {
    const [lo, hi] = toTheme === 'light' ? [0.36, 0.58] : [0.46, 0.72]
    nl = l < lo ? lo : l > hi ? hi : l
    ns = clamp01(s * (toTheme === 'light' ? 1.08 : 1.0))
  }

  const out = hslToRgb(h, ns, clamp01(nl))
  const hex = rgb255ToHex(out[0], out[1], out[2])

  return parsed.alpha < 100 ? withAlpha(hex, parsed.alpha) : hex
}

/** Farb-Set fürs aktive Theme: Light nur mit themeSplit aus `lightTheme`. */
function activeRowColors(tabs, theme) {
  if (tabs.themeSplit && theme === 'light' && tabs.lightTheme && typeof tabs.lightTheme === 'object') {
    return { ...tabs, ...tabs.lightTheme }
  }

  return tabs
}

/**
 * Beobachtet Theme-Wechsel der App (Marker-Attribute an <html>/<body> und
 * prefers-color-scheme) und ruft `onChange` — damit die plugin-eigenen
 * <html>-Variablen (Zeilen-/Grid-Farben) sofort aufs neue Theme umschalten.
 * Read-only auf App-Markern; schreibt nur plugin-eigene Custom Properties.
 * @returns {() => void} Disposer.
 */
function watchAppTheme(onChange) {
  const fire = () => {
    try {
      onChange()
    } catch {
      /* egal */
    }
  }

  let observer = null

  /* #full */
  try {
    if (typeof MutationObserver === 'function' && document.documentElement) {
      observer = new MutationObserver(fire)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme', 'data-appearance', 'data-mode']
      })
      if (document.body) {
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ['class', 'data-theme', 'data-color-scheme', 'data-appearance', 'data-mode']
        })
      }
    }
  } catch {
    /* egal */
  }
  /* #end */

  let mql = null
  const onMql = () => fire()

  try {
    if (window.matchMedia) {
      mql = window.matchMedia('(prefers-color-scheme: dark)')
      mql.addEventListener?.('change', onMql)
    }
  } catch {
    /* egal */
  }

  return () => {
    try {
      observer?.disconnect()
    } catch {
      /* egal */
    }
    try {
      mql?.removeEventListener?.('change', onMql)
    } catch {
      /* egal */
    }
  }
}

const SF_ROW_VARS = [
  '--sf-row-from',
  '--sf-row-to',
  '--sf-row-angle',
  '--sf-title-color',
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
    'data-sf-titlecolor',
    'data-sf-seltint',
    'data-sf-selborder',
    'data-sf-selshadow',
    'data-sf-selhover',
    'data-sf-aligntop',
    'data-sf-hoverlift',
    'data-sf-ctxpie',
    'data-sf-ctxstyle',
    'data-sf-liveframe',
    'data-sf-rowlive',
    'data-sf-donefx',
    'data-sf-donefx-axis',
    'data-sf-donefx-strength',
    'data-sf-theme'
  ]) {
    root.removeAttribute(attr)
  }

  for (const name of SF_ROW_VARS) root.style.removeProperty(name)
}

function applyRows() {
  const tabs = $settings.get().tabs || {}
  // Effektives Theme (manueller Override `themeMode` vor Auto-Erkennung) +
  // passendes Farb-Set (Light nur mit themeSplit aktiv).
  const theme = effectiveTheme(tabs.themeMode)
  const c = activeRowColors(tabs, theme)

  try {
    const root = document.documentElement
    root.setAttribute('data-sf-theme', theme)
    // 0) Zeilen-Geometrie — native Sidebar-Parität (row-geometry.ts): 26px
    //    Höhe, 8px Padding-X, 6px Gap, 14×14 Lead, 13px/500 Label, 16×16
    //    Add-Button. Als Custom-Properties gespiegelt (CSS-`:root`-Default
    //    existiert zusätzlich), damit die Werte programmatisch les-/setzbar
    //    bleiben und die Style-Tests sie messen können.
    root.style.setProperty('--sf-row-min-h', '26px')
    root.style.setProperty('--sf-row-pad-x', '8px')
    root.style.setProperty('--sf-row-gap', '6px')
    root.style.setProperty('--sf-row-lead', '14px')
    // v1.27.3: Basis 10px (User-Vorgabe „beide Titelgrößen 10px initial").
    // 100 % = 10px Titel; Detail-/Meta-Zeilen proportional (Faktor 0.8),
    // Floor 8px für Lesbarkeit.
    const textSizePct = clampNumber(Number(tabs.textSize ?? 100), 80, 160, 100)
    const labelPx = 10 * textSizePct / 100
    root.style.setProperty('--sf-row-label-size', `${labelPx.toFixed(2)}px`)
    root.style.setProperty('--sf-row-detail-size', `${Math.max(8, labelPx * 0.8).toFixed(2)}px`)
    root.style.setProperty('--sf-row-add-size', '16px')
    // Hex-Farben: #RGB, #RRGGBB oder #RRGGBBAA (Alpha → Verläufe mit Transparenz).
    const safeColor = (value, fallback) => (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(value || '').trim()) ? String(value).trim() : fallback)

    // 1) Hintergrund-Verlauf der Zeilen (Liste) und Karten (Grid).
    if (c.rowGradOn) {
      root.setAttribute('data-sf-rowgrad', 'on')
      root.style.setProperty('--sf-row-from', safeColor(c.rowGradFrom, '#7c3aed'))
      root.style.setProperty('--sf-row-to', safeColor(c.rowGradTo, '#00dbda'))
      root.style.setProperty('--sf-row-angle', `${clampNumber(c.rowGradAngle, 0, 360, 135)}deg`)
    } else {
      root.removeAttribute('data-sf-rowgrad')
      root.style.removeProperty('--sf-row-from')
      root.style.removeProperty('--sf-row-to')
      root.style.removeProperty('--sf-row-angle')
    }

    // 2) Schlagschatten der Zeilen — je Theme (c.rowShadow).
    root.setAttribute('data-sf-rowshadow', SF_ROW_SHADOWS.includes(c.rowShadow) ? c.rowShadow : 'off')

    // 3) Titel: eigener Stil (none | solid | gradient), je Theme.
    const titleStyle = ['none', 'solid', 'gradient'].includes(c.titleStyle)
      ? c.titleStyle
      : (c.titleGradOn ? 'gradient' : 'none')

    if (titleStyle === 'gradient') {
      root.setAttribute('data-sf-titlegrad', 'on')
      root.removeAttribute('data-sf-titlecolor')
      root.style.removeProperty('--sf-title-color')
      root.style.setProperty('--sf-title-from', safeColor(c.titleGradFrom, theme === 'light' ? '#18181b' : '#e4e4e7'))
      root.style.setProperty('--sf-title-to', safeColor(c.titleGradTo, theme === 'light' ? '#52525b' : '#8b8b93'))
      root.style.setProperty('--sf-title-angle', `${clampNumber(c.titleGradAngle, 0, 360, 90)}deg`)
    } else if (titleStyle === 'solid' && String(c.titleColor || '').trim()) {
      root.setAttribute('data-sf-titlecolor', 'on')
      root.removeAttribute('data-sf-titlegrad')
      root.style.removeProperty('--sf-title-from')
      root.style.removeProperty('--sf-title-to')
      root.style.removeProperty('--sf-title-angle')
      root.style.setProperty('--sf-title-color', safeColor(c.titleColor, theme === 'light' ? '#18181b' : '#e4e4e7'))
    } else {
      root.removeAttribute('data-sf-titlegrad')
      root.removeAttribute('data-sf-titlecolor')
      root.style.removeProperty('--sf-title-color')
      root.style.removeProperty('--sf-title-from')
      root.style.removeProperty('--sf-title-to')
      root.style.removeProperty('--sf-title-angle')
    }

    // 4) Auswahl-Zustand (Tönung, Kontur, Schatten, Hover-Stärke).
    root.setAttribute('data-sf-seltint', ['standard', 'accent', 'custom'].includes(tabs.selTint) ? tabs.selTint : 'standard')
    root.style.setProperty('--sf-sel-color', safeColor(c.selColor, '#7c3aed'))
    root.setAttribute('data-sf-selborder', tabs.selBorder ? 'on' : 'off')
    root.setAttribute('data-sf-selshadow', SF_ROW_SHADOWS.includes(c.selShadow) ? c.selShadow : 'off')
    root.setAttribute('data-sf-selhover', ['off', 'soft', 'strong'].includes(tabs.selHover) ? tabs.selHover : 'soft')

    // 5) Live-Status: Aktiv/Wartend wie im Tab-Design hervorheben.
    root.setAttribute('data-sf-rowlive', tabs.rowLive ? 'on' : 'off')

    // 5b) Fertig-Effekt: einmaliges Aufglühen/Wackeln, wenn eine Session
    // fertig wird (Achse + Stärke einstellbar).
    root.setAttribute('data-sf-donefx', ['off', 'glow', 'wobble', 'glow-wobble', 'shine', 'pop'].includes(tabs.doneFx) ? tabs.doneFx : 'glow-wobble')
    root.setAttribute('data-sf-donefx-axis', ['x', 'y', 'z'].includes(tabs.doneFxAxis) ? tabs.doneFxAxis : 'x')
    root.setAttribute('data-sf-donefx-strength', ['subtle', 'medium', 'strong'].includes(tabs.doneFxStrength) ? tabs.doneFxStrength : 'subtle')

    // 6) App-Optik: Text oben, Hover-Anhebung, Live-Rahmen, Kontext-Pie.
    root.setAttribute('data-sf-aligntop', tabs.alignTop === false ? 'off' : 'on')
    root.setAttribute('data-sf-hoverlift', tabs.hoverLift === false ? 'off' : 'on')
    root.setAttribute('data-sf-ctxpie', tabs.ctxPie === false ? 'off' : 'on')
    root.setAttribute('data-sf-ctxstyle', tabs.ctxStyle === 'bar' ? 'bar' : 'donut')
    root.setAttribute('data-sf-liveframe', ['off', 'ring', 'glow'].includes(tabs.liveFrame) ? tabs.liveFrame : 'glow')
  } catch (error) {
    console.warn(`[${ID}] rows apply failed`, error)
    clearRows()
  }
}

/* #full */
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

    // Ziele: immer die sichtbaren Chat-Surfaces (stabiler Marker `data-chat-surface`;
    // sie sind `isolate`, darum zeichnet ein z-index:-1-Layer über ihrer Fläche und
    // unter ihrem Inhalt). Bei Geltungsbereich „alle" zusätzlich jede Zone OHNE
    // Chat-Surface — dort wird die Zonenfläche per Variablen-Override transparent,
    // weil ein Negativ-Layer sonst hinter ihr läge.
    const inHiddenPane = element => Boolean(element.closest('[data-pane-hidden]'))
    const targets = [...document.querySelectorAll('[data-chat-surface]')]

    if (scopeAll) {
      targets.push(
        ...[...document.querySelectorAll('[data-tree-group]')].filter(zone => !zone.querySelector('[data-chat-surface]'))
      )
    }

    const wanted = new Set(targets.filter(target => !inHiddenPane(target)))

    // Layer entfernen, die nicht mehr gebraucht werden (Option aus, Target weg, Scope gewechselt).
    for (const layer of [...document.querySelectorAll('[data-sf-bg-layer]')]) {
      if (!active || !wanted.has(layer.parentElement)) {
        layer.remove()
      }
    }

    if (!active) {
      return
    }

    for (const target of wanted) {
      const existing = target.querySelector(':scope > [data-sf-bg-layer]')
      const visible = !inHiddenPane(target)
      const sig = `${kind}|${bgPath}|${p.bgFit}|${visible ? 'v' : 'h'}`

      if (existing && existing.getAttribute('data-sf-bg-sig') === sig) {
        continue
      }

      const layer = existing || document.createElement('div')

      if (!existing) {
        layer.className = 'sf-bg-layer'
        layer.setAttribute('data-sf-bg-layer', '')
        // Als ERSTES Kind einsetzen: DOM-Ordnung gewinnt vor z-index unter
        // Geschwistern ohne eigenen z-index, und der Layer ist absolut, also
        // fließt er nicht in den Layout-Flow. Damit landet er zuverlässig
        // hinter positionierten Geschwistern (Chat-Inhalt), aber ÜBER der
        // eigenen Hintergrund-Farbe des Parents — vorher mit z-index:-1
        // verschwand er hinter der Chat-Surface-Background (`bg-(--ui-chat-
        // surface-background)`, opaque in den meisten Themes).
        if (target.firstChild) {
          target.insertBefore(layer, target.firstChild)
        } else {
          target.appendChild(layer)
        }
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
        // Attribute und Property gleichsetzen — autoplay als HTML-Attribut ist
        // auf manchen Chromium-Versionen die Voraussetzung dafür, dass ein
        // absolut positioniertes, gemutetes <video> ohne User-Gesture startet
        // (nur die Property reicht in manchen Builds nicht). `muted` ist
        // Pflicht: nur gemutete Videos sind von der Autoplay-Policy
        // ausgenommen.
        video.muted = true
        video.setAttribute('muted', '')
        video.loop = true
        video.setAttribute('loop', '')
        video.autoplay = true
        video.setAttribute('autoplay', '')
        video.playsInline = true
        video.setAttribute('playsinline', '')
        video.src = mediaStreamUrl(bgPath)
        // Ebenfalls als HTML-Attribut setzen — manche Build-Pfade (auch der
        // Plugin-Test-Stub) spiegeln Property-Setter nicht in `attrs`. Im
        // echten DOM ist das Attribut ohnehin durch die Property gesetzt,
        // schadet also nicht.
        video.setAttribute('src', video.src)
        layer.appendChild(video)

        // play() sofort anstoßen UND nach `loadeddata` erneut versuchen: das
        // erste play() fällt oft in den Lade-Puffer und zeigt nur das erste
        // Frame als „Standbild". Mit dem Retry auf `loadeddata` springt die
        // Wiedergabe an, sobald genug Daten da sind.
        const start = () => {
          const result = video.play()
          if (result && typeof result.catch === 'function') {
            result.catch(() => {})
          }
        }
        start()
        if (typeof video.addEventListener === 'function') {
          video.addEventListener('loadeddata', start, { once: true })
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

    // Nur schreiben, wenn sich der Wert geändert hat (v1.24.0): der 4-s-Takt
    // kostet sonst bei jedem Tick einen Style-Invalidierungsschub, obwohl die
    // Kontur sich selten ändert.
    const next = `max(0px, calc(${value} - 1px))`

    if (document.documentElement.style.getPropertyValue('--sf-arc-radius') === next) {
      return
    }

    document.documentElement.style.setProperty('--sf-arc-radius', next)
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
/* #end */

/* #full */
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
 * Räumt die "Liste/Grid als Tab-Selektor"-Markierung ab (tabs.asTabSelector).
 */
function clearTabSelectorMode() {
  document.documentElement.removeAttribute('data-sf-hide-tabstrip')
}

/**
 * Blendet die native Content-Tab-Leiste für Session-Tabs aus, wenn die
 * List/Grid-Pane dieselbe Funktion schon abdeckt (tabs.asTabSelector).
 * Zielt strukturell auf den Streifen, der mindestens einen Session-Tile-Tab
 * trägt (":has()" — im Plugin bereits an anderer Stelle in Gebrauch, siehe
 * `data-sf-ui-tabs~='nolead'`-Regel) — Terminal-/Dateien-/sonstige
 * Pane-Tab-Leisten ohne Session-Tabs bleiben unberührt.
 */
function applyTabSelectorMode() {
  const cfg = $settings.get().tabs || {}

  try {
    if (!cfg.asTabSelector) {
      clearTabSelectorMode()
      return
    }

    document.documentElement.setAttribute('data-sf-hide-tabstrip', 'on')
  } catch (error) {
    console.warn(`[${ID}] tab-selector apply failed`, error)
    clearTabSelectorMode()
  }
}
/* #end */

// ── Gruppen-Kopfzeilen-Dichte (KEEP): eigenes Pane-Feature, kein App-UI-Griff.
/** Räumt die Gruppen-Kopfzeilen-Dichte ab (groups.headerDensity). */
function clearGroupsDensity() {
  document.documentElement.removeAttribute('data-sf-grpdensity')
  // v1.27.2: Titel-Typografie ebenfalls restlos (Dispose-Zustand).
  document.documentElement.removeAttribute('data-sf-groupcaps')
  document.documentElement.style.removeProperty('--sf-group-name-size')
}

/**
 * Typografie der Sektions-/Gruppen-Kopfzeilen (Liste/Grid): größer & stärker
 * wie die Projekt-Header von Hermes Desktop, plus optionale zweite Zeile
 * (Ordner-Pfad bei Projekt-Gruppen, Kennzahlen bei den übrigen Arten) — siehe
 * `SectionHeader`. Die Stufe steuert nur, WIE VIEL die Kopfzeile zeigt; die
 * Daten selbst werden in React berechnet, hier nur die CSS-Stufe gesetzt.
 */
function applyGroupsDensity() {
  const groups = $settings.get().groups || {}

  try {
    const density = ['compact', 'comfortable', 'detailed'].includes(groups.headerDensity)
      ? groups.headerDensity
      : 'comfortable'

    document.documentElement.setAttribute('data-sf-grpdensity', density)

    // v1.27.2/1.27.3: Kopfzeilen-Titel-Typografie (Projekt-/Gruppen-Header) —
    // px-Größe (Default 10, gleichauf mit den Session-Titeln) + Kapitälchen.
    const namePx = clampNumber(Number(groups.nameSize ?? 10), 10, 24, 10)
    document.documentElement.style.setProperty('--sf-group-name-size', `${namePx}px`)
    document.documentElement.setAttribute('data-sf-groupcaps', groups.nameCaps ? 'on' : 'off')
  } catch (error) {
    console.warn(`[${ID}] groups-density apply failed`, error)
    clearGroupsDensity()
  }
}

/* #full */
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
/* #end */

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

  // Schema-Migration (v1.26.0): manuelle Gruppen waren in v1.25.0 noch
  // `cwd`-basiert (Pflicht-Ordnerpfad). Das Konzept hat sich als
  // semantisch falsch herausgestellt — `session.cwd.set` lässt die neue
  // Session als eigenen Projekt-Knoten im Server-Baum erscheinen, sie
  // "verlässt" damit die Gruppe. v1.26.0 führt stattdessen
  // `projectIds: string[]` ein: eine Gruppe ist ein Container über
  // referenzierte Projekt-Knoten. Die alte `cwd` versuchen wir
  // best-effort auf eine passende `ProjectTreeNode.id` zu mappen
  // (Pfad-Match gegen `$projectsList`, der zum Mount-Zeitpunkt schon
  // gefüllt sein sollte — sonst fällt der Pfad als "Projekt nicht
  // verfügbar"-Hinweis zurück und der User ordnet manuell zu). Wenn
  // `projectIds` schon existiert (v1.26.0-Setups), bleibt es
  // unangetastet; alte `cwd` werden stillschweigend verworfen, sobald
  // die Migration gelaufen ist.
  const liveProjects = $projectsList.get()
  const projectByPath = new Map()
  for (const node of liveProjects) {
    if (!node || !node.id || !node.path) continue
    projectByPath.set(node.path, node)
  }
  const rawGroups = Array.isArray(saved?.groups) ? saved.groups : []
  // v1.25.0→v1.26.0-Migrationsreport: welche `cwd`-Gruppen umgestellt
  // wurden und ob der Pfad noch zu einem Projekt passt. Für den einmaligen
  // Toast unten — gehört NICHT in den persistierten State.
  const migrationReport = []
  const migratedGroups = rawGroups.map(entry => {
    if (!entry || typeof entry !== 'object') return entry
    // Bereits v1.26.0 — Liste normalisieren (Set-Semantik, Duplikate raus).
    if (Array.isArray(entry.projectIds)) {
      return { ...entry, projectIds: Array.from(new Set(entry.projectIds.filter(id => typeof id === 'string' && id))) }
    }
    // v1.25.0-Migration: `cwd` → `projectIds` (best-effort). Wenn weder
    // projectIds noch cwd da sind: leerer Container. Das alte `cwd` wird
    // hier bewusst VERWORFEN (kein Spread inkl. cwd) — wäre semantisch
    // falsch (Header würde sonst + zeigen) und erzeugt Müll in der
    // Persistenz.
    if (typeof entry.cwd === 'string' && entry.cwd) {
      const node = projectByPath.get(entry.cwd)
      const projectId = node ? node.id : null
      migrationReport.push({ group: entry.name || 'Gruppe', project: node ? (node.label || node.name) : null, ok: Boolean(node) })
      return { id: entry.id, name: entry.name, color: entry.color || null, projectIds: projectId ? [projectId] : [], createdAt: entry.createdAt || Date.now() }
    }
    return { id: entry.id, name: entry.name, color: entry.color || null, projectIds: [], createdAt: entry.createdAt || Date.now() }
  })

  // Einmal-Semantik (v1.27.0): der Migrations-Toast erscheint nur beim
  // ERSTEN Laden nach der Umstellung. Das Flag wird mit dem State
  // persistiert (scheduleGroupsSave schreibt $groupsState komplett).
  const alreadyNotified = Boolean(saved?.migrationNotified)
  const shouldNotify = migrationReport.length > 0 && !alreadyNotified

  $groupsState.set({
    groups: migratedGroups,
    assign: isPlainObject(saved?.assign) ? saved.assign : {},
    collapsed: isPlainObject(saved?.collapsed) ? saved.collapsed : {},
    migrationNotified: alreadyNotified || shouldNotify
  })

  if (shouldNotify) {
    scheduleGroupsSave()
    showMigrationToasts(migrationReport)
  }
}

/**
 * Einmaliger Hinweis nach der v1.25.0→v1.26.0-Migration: pro umgestellter
 * Gruppe ein Toast — Erfolg mit Ziel-Projekt, sonst „konnte nicht migriert
 * werden". Rein informativ; Fehler werden geschluckt (Toast ist kein
 * kritischer Pfad).
 */
function showMigrationToasts(report) {
  if (!Array.isArray(report) || report.length === 0) return
  try {
    for (const item of report) {
      if (item.ok && item.project) {
        host.notify({ kind: 'info', message: CTX?.i18n?.t('groupMigrated', { group: item.group, project: item.project }) || `Gruppe „${item.group}" auf Projekt „${item.project}" umgestellt` })
      } else {
        host.notify({ kind: 'info', message: CTX?.i18n?.t('groupMigrateFailed', { group: item.group }) || `Gruppe „${item.group}" konnte nicht migriert werden` })
      }
    }
  } catch {
    /* Toast ist nicht kritisch */
  }
}

let groupSeq = 0

function newGroupId() {
  groupSeq += 1
  return `g${Date.now().toString(36)}${groupSeq.toString(36)}`
}

/** Set-Semantik: Projekt-IDs aus beliebigem Input dedupliziert, leer wenn nichts. */
function normalizeProjectIds(ids) {
  if (!Array.isArray(ids)) return []
  const seen = new Set()
  for (const id of ids) {
    if (typeof id === 'string' && id) seen.add(id)
  }
  return Array.from(seen)
}

function createGroup(name, color, projectIds) {
  const state = $groupsState.get()
  const trimmed = String(name || '').trim() || 'Gruppe'
  const normalized = normalizeProjectIds(projectIds)
  // v1.26.0: eine Gruppe braucht mindestens ein referenziertes Projekt,
  // sonst ist sie semantisch wertlos. Wirft hier, damit der Dialog
  // gezielt reagieren kann.
  if (normalized.length === 0) {
    throw new Error('group-projects-required')
  }
  const group = { id: newGroupId(), name: trimmed, color: color || null, projectIds: normalized, createdAt: Date.now() }
  $groupsState.set({ ...state, groups: [...state.groups, group] })
  scheduleGroupsSave()
  return group
}

function updateGroup(groupId, patch) {
  const state = $groupsState.get()
  // projectIds-Whitelist beim Patch — leere Liste ist erlaubt (User kann
  // Projekte komplett entfernen, der Dialog zeigt dann den Hinweis).
  const normalized = patch && Object.prototype.hasOwnProperty.call(patch, 'projectIds')
    ? { ...patch, projectIds: normalizeProjectIds(patch.projectIds) }
    : patch
  $groupsState.set({
    ...state,
    groups: state.groups.map(group => (group.id === groupId ? { ...group, ...normalized } : group))
  })
  scheduleGroupsSave()
}

/**
 * Projekt-Knoten zu einer Gruppe hinzufügen. Single-Container-Semantik
 * (Frage 3): wenn das Projekt schon in einer anderen Gruppe ist, wird
 * es dort entfernt. Wirft NICHT — Idempotenz ist erwünscht (Drag&Drop-
 * wiederholungen dürfen keinen Fehler werfen).
 */
function addProjectToGroup(groupId, projectId) {
  if (!groupId || !projectId) return
  const state = $groupsState.get()
  const target = state.groups.find(g => g.id === groupId)
  if (!target) return
  // Andere Gruppe, die das Projekt auch enthält → erst dort rausnehmen.
  const cleanedOthers = state.groups.map(g => {
    if (g.id === groupId) return g
    if (Array.isArray(g.projectIds) && g.projectIds.includes(projectId)) {
      return { ...g, projectIds: g.projectIds.filter(id => id !== projectId) }
    }
    return g
  })
  // Bereits enthalten? Idempotent.
  const cleanedTarget = cleanedOthers.find(g => g.id === groupId)
  if (cleanedTarget.projectIds.includes(projectId)) {
    if (cleanedGroupsEqual(cleanedOthers, state.groups)) return
    $groupsState.set({ ...state, groups: cleanedOthers })
    scheduleGroupsSave()
    return
  }
  $groupsState.set({
    ...state,
    groups: cleanedOthers.map(g => g.id === groupId ? { ...g, projectIds: [...g.projectIds, projectId] } : g)
  })
  scheduleGroupsSave()
}

/** Projekt-Knoten aus einer Gruppe entfernen. Idempotent. */
function removeProjectFromGroup(groupId, projectId) {
  if (!groupId || !projectId) return
  const state = $groupsState.get()
  const target = state.groups.find(g => g.id === groupId)
  if (!target) return
  const next = state.groups.map(g => {
    if (g.id !== groupId) return g
    if (!Array.isArray(g.projectIds) || !g.projectIds.includes(projectId)) return g
    return { ...g, projectIds: g.projectIds.filter(id => id !== projectId) }
  })
  if (cleanedGroupsEqual(next, state.groups)) return
  $groupsState.set({ ...state, groups: next })
  scheduleGroupsSave()
}

/** Liste der Group-IDs, die ein Projekt enthalten. Für DnD und Counts. */
function groupsContainingProject(projectId) {
  if (!projectId) return []
  const state = $groupsState.get()
  const out = []
  for (const g of state.groups) {
    if (Array.isArray(g.projectIds) && g.projectIds.includes(projectId)) {
      out.push(g.id)
    }
  }
  return out
}

function cleanedGroupsEqual(a, b) {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ga = a[i]
    const gb = b[i]
    if (ga === gb) continue
    if (!ga || !gb) return false
    if (ga.id !== gb.id) return false
    const ap = Array.isArray(ga.projectIds) ? ga.projectIds : []
    const bp = Array.isArray(gb.projectIds) ? gb.projectIds : []
    if (ap.length !== bp.length) return false
    for (let j = 0; j < ap.length; j++) if (ap[j] !== bp[j]) return false
  }
  return true
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
// „Gerade zieht der User eine Session"-Signal, damit die Pinned-Sektion
// AUCH leer als Drop-Area sichtbar wird — sonst verschwindet sie, wenn
// noch nichts angepinnt ist, und man kann nirgendwo droppen. Set beim
// TabRow-onDragStart, Reset beim onDragEnd (und als Fallback via
// window.dragend, falls die Zeile zwischendurch unmountet).
const $dragActive = atom(false)
// Lade-Phase der Pane: 'gate' (Gateway-Socket noch nicht offen) →
// 'loading' (Requests laufen) → 'ready' (erster Datensatz da) bzw. 'error'.
// Treibt den Ladebalken + Gateway-Hinweis statt eines toten Leerraums.
const $loadPhase = atom('gate')
// true, sobald der ERSTE refreshSessions-Lauf überhaupt Daten geliefert hat —
// danach darf ein Fehler die geladenen Zeilen nicht mehr durch einen Lade-
// balken ersetzen (App-Parität: Fehlerbanner über erhaltenem Stand).
let bootstrapDoneOnce = false

/** Läuft der Projekt-Baum noch? (Noch kein erfolgreicher Refresh NACH Gate-Open.) */
function projectsPending() {
  return gatedBootstrapDone && projectsListSucceededAt === 0
}

// Wird true, sobald das Gateway-Bootstrap-Gate den Initial-Satz gefeuert hat
// (Socket offen). Davor wäre „Projekte laden" irreführend — es warten noch
// beide Datenquellen auf die Verbindung.
let gatedBootstrapDone = false

// Archiv-Ansicht: eigene Zeilenbasis (REST archived=only), on demand geladen.
const $archivedRows = atom([])
let archivedInFlight = null
let archivedSucceededAt = 0
const ARCHIVED_TTL_MS = 60_000

/** Archivierte Sessions über REST nachziehen (nur im Archiv-Modus sichtbar). */
function refreshArchivedSessions() {
  /* #full */
  if (archivedInFlight) {
    return archivedInFlight
  }

  archivedInFlight = (async () => {
    try {
      const bridge = globalThis.window?.hermesDesktop

      if (!bridge || typeof bridge.api !== 'function') {
        return
      }

      const limit = Math.max(10, Math.min(200, Number(readSetting('tabs', 'maxItems')) || 60))
      const result = await bridge.api({
        path: `/api/sessions?limit=${limit}&offset=0&archived=only&order=recent`,
        timeoutMs: 10_000
      })
      const rows = (Array.isArray(result?.sessions) ? result.sessions : [])
        .map(normalizeRow)
        .filter(row => row.id && row.archived)
        .sort((a, b) => (b.lastActiveAt || b.startedAt) - (a.lastActiveAt || a.startedAt))

      $archivedRows.set(rows)
      archivedSucceededAt = Date.now()
      $restMirror.set(true)
    } catch {
      // Bridge/Netzwerk — alter Stand bleibt; der Modus zeigt dann den
      // bestehenden Leerzustand statt zu crashen.
    } finally {
      archivedInFlight = null
    }
  })()

  return archivedInFlight
  /* #end */
  /* #catalog-only */
  // Catalog-Build: kein REST-Door im SDK (Anfrage auf #116305) — das Archiv
  // bleibt eine leere, ehrliche Liste statt einer Bridge-Anfrage.
  return Promise.resolve()
  /* #end */
}

/* #full */
/** Alle sichtbaren ungelesenen Sessions als gelesen markieren (Bulk-PATCH). */
async function markAllSessionsRead(rows) {
  const bridge = globalThis.window?.hermesDesktop

  if (!bridge || typeof bridge.api !== 'function' || !Array.isArray(rows)) {
    return 0
  }

  let done = 0

  for (const row of rows) {
    if (!row?.unread) {
      continue
    }

    try {
      await bridge.api({
        path: `/api/sessions/${encodeURIComponent(row.id)}`,
        method: 'PATCH',
        body: { unread: false },
        timeoutMs: 8000
      })
      done += 1
    } catch {
      // Einzelne Fehler übergehen — der Refresh zeigt den verbleibenden Stand.
    }
  }

  if (done > 0) {
    kickAppRefresh()
    scheduleSessionsRefresh(400)
  }

  return done
}
/* #end */

/**
 * Sanfter Refresh-Kick an die App: die eigene Sidebar horcht auf window-focus
 * und visibilitychange (use-background-sync.ts) und zieht ihre Listen genau
 * auf diese Signale nach. Nach Plugin-seitigen Mutationen (Projekt geändert,
 * Pin, Archiv) feuern wir beide — die App bleibt ohne Restart instantan
 * aktuell. Bewusst generisch: kein App-Store wird angefasst.
 */
function kickAppRefresh() {
  try {
    window.dispatchEvent(new Event('focus'))
  } catch {
    /* kein DOM (Tests) — egal */
  }

  try {
    document.dispatchEvent(new Event('visibilitychange'))
  } catch {
    /* ditto */
  }
}
// Vorherige Aktivität (kurz): speist die Ausblend-Animation der
// Detailreich-Info-Zeile (storedId -> { kind, name, at }).
const $activityPrev = atom({})
const $appDensity = atom('compact') // App-Einstellung "Dichte der Session-Liste" (sessionListDensity)
const $projectsList = atom([]) // [{ id, label, color, icon, isAuto, isNoProject, path, sessionIds:Set<string> }]

let projectsListInFlight = null
let projectsListSucceededAt = 0

/**
 * Projekt-Baum (`projects.tree`) neu laden — dieselbe Backend-Quelle wie
 * Hermes Desktops eigene Sidebar. BEWUSST NICHT `projects.list` + eigener
 * cwd-Abgleich: `session.list` (füllt `$sessions`) liefert gar keine `cwd`
 * oder `git_repo_root` pro Session — `_session_row_summary` in
 * `tui_gateway/methods_session.py` gibt nur `id/title/preview/started_at/
 * message_count/source` zurück. Ein Pfad-Vergleich im Plugin kann also nie
 * etwas treffen, egal wie genau er den Desktop-Algorithmus nachbaut. Die
 * einzige Quelle mit der echten Zuordnung ist `projects.tree`
 * (`ProjectTreeNode.sessionIds`) — die serverseitige, autoritative Liste
 * aller Session-IDs je Projekt (explizit + Auto-Projekte per Git-Root).
 */
async function refreshProjectsList() {
  if (projectsListInFlight) {
    return projectsListInFlight
  }

  projectsListInFlight = (async () => {
    try {
      const payload = await host.request('projects.tree', { session_limit: 2000 })
      const nodes = Array.isArray(payload?.projects) ? payload.projects : []

      $projectsList.set(
        nodes
          .map(node => ({
            id: String(node?.id || '').trim(),
            label: String(node?.label || '').trim(),
            color: node?.color ? String(node.color).trim() : null,
            icon: node?.icon ? String(node.icon).trim() : null,
            isAuto: Boolean(node?.isAuto),
            isNoProject: Boolean(node?.isNoProject),
            path: node?.path ? String(node.path).trim() : '',
            sessionIds: new Set(Array.isArray(node?.sessionIds) ? node.sessionIds.map(String) : [])
          }))
          .filter(node => node.id)
      )
      projectsListSucceededAt = Date.now()
    } catch {
      // Älteres Backend ohne projects.tree — Gruppierung fällt auf "Kein Projekt" zurück.
    } finally {
      projectsListInFlight = null
    }
  })()

  return projectsListInFlight
}

// Zielprojekt frisch erstellter Sessions — Live-Overlay wie Hermes Desktop:
// projects.tree lässt 0-Turn-Sessions weg (min_message_count=1), eine neue
// „+"-Session wäre bis zum ersten persistierten Turn „Kein Projekt". Der
// Seed merkt sich (storedId → Projekt), bis der Baum die Session übernimmt
// oder der Eintrag verfällt.
const $sessionProjectSeed = atom({}) // storedId -> { id, name, color, icon, path, at }

const SESSION_SEED_TTL_MS = 15 * 60_000

/** Seed aufräumen — verhindert ewiges Wachstum bei vielen „+"-Klicks. */
function pruneSessionProjectSeeds() {
  const seeds = $sessionProjectSeed.get()
  const now = Date.now()
  const next = {}

  for (const [storedId, seed] of Object.entries(seeds)) {
    if (seed && now - Number(seed.at || 0) < SESSION_SEED_TTL_MS) {
      next[storedId] = seed
    }
  }

  if (Object.keys(next).length !== Object.keys(seeds).length) {
    $sessionProjectSeed.set(next)
  }
}

// ── Composer-Projekt-Pill (Statusstapel, v1.21) ──────────────────────────────
// Der App-eigene New-Session-Weg (Cmd+N / Tab) ist ein Draft, dessen CWD die
// App erst beim Senden aus $currentCwd/$projectScope auflöst. Der App-Scope-
// Atom hat KEINE Plugin-Schreib-Tür (persistentAtom liest localStorage nur beim
// Modul-Init), also ist der ehrliche Hebel: der Pick im Pill-Menü erzeugt die
// verankerte Session SOFORT über den bewährten Anker-Pfad (session.create mit
// cwd + cwd_explicit → session.cwd.set → Overlay-Seed → open) — die Zuordnung
// steht garantiert vor der ersten Eingabe. Bestehende Sessions re-homen wir per
// session.workspace.move (session_key; persistiert Row + live re-home), mit
// dem cwd.set-Fallback für ältere Gateways. Best-effort zusätzlich
// projects.set_active (dauerhafter Aktiv-Zeiger der App/CLI).
// Injektion (nur Full-Build; Catalog wartet auf den Composer-Accessory-Slot,
// #116305): der Chip sitzt in der EINGABEZEILE des Composers, direkt VOR dem
// „+"-Add-IconButton am Composer-Root-Anker — damit der Projekt-Kontext
// immer der erste Blickpunkt am Eingabefeld ist.

// Letzter Draft-Pick: storedId '': '' → Projekt, das der User vor der ersten
// Eingabe gewählt hat (bis der Create es zur echten Session macht).
const $composerPick = atom({ id: '', label: '', color: null, at: 0 })

// DOM-Marker der injizierten Zeile — identifiziert sie auch nach App-Re-Render
// (React lässt fremde Attribute in Ruhe; bei Remount setzt der Sync-Loop neu).
// Anker: der „+"-Button des Composers (Add-IconButton am Composer-Root, NUR im
// Composer-Root). Der Chip als erstes Kind seines Wrapper-Divs (menu-Grid-
// Bereich) sitzt direkt VOR dem „+", in derselben Zeile wie die Eingabe —
// der Projekt-Kontext ist damit immer der erste Blickfang am Eingabefeld.
const CPROJ_MARKER = 'data-sf-cproj'
const CPROJ_SYNC_MS = 2500

/** Pill aktiv? (Settings-Namespace composer.projectPill, Default an.) */
function composerPillEnabled() {
  return readSetting('composer', 'projectPill') !== false
}

/** TTL des Composer-Chip-Picks (Draft-Anker). 5 Min — lang genug zum Tippen,
 *  kurz genug, dass ein "früheres" Pick nicht versehentlich eine neue Session
 *  in ein anderes Projekt verankert. Wird in `composerDraftLabel` UND in
 *  `resolveNewProjectSessionCwd` ausgewertet. */
const COMPOSER_PICK_TTL_MS = 5 * 60_000

/** Aktuell gültiger Pick (oder null), gleiche Logik wie die Anzeige. */
function activeComposerPick() {
  const pick = $composerPick.get()
  if (!pick || !pick.id || Date.now() - Number(pick.at || 0) >= COMPOSER_PICK_TTL_MS) {
    return null
  }
  return pick
}

/**
 * Projekt-Node für eine Stored-Session: Overlay-Seed hat Vorrang (0-Turn-
 * Sessions fehlen im Baum), sonst projects.tree (sessionIds-Autorität).
 */
function projectForStoredSession(storedId) {
  const seed = $sessionProjectSeed.get()[storedId]

  if (seed && seed.id && seed.id !== '__no_project__') {
    return { id: seed.id, label: seed.name || '', color: seed.color || null, path: seed.path || '' }
  }

  const node = $projectsList.get().find(entry => !entry.isNoProject && entry.sessionIds.has(storedId))

  return node ? { id: node.id, label: node.label, color: node.color, path: node.path } : null
}

/** Projekt-Knoten, dessen Pfad `cwd` enthält (längster Pfad gewinnt — Worktrees/Unterordner). */
function projectForCwd(cwd) {
  const target = String(cwd || '').trim().replace(/[\\/]+$/, '')

  if (!target) {
    return null
  }

  let best = null
  let bestLen = -1

  for (const node of $projectsList.get()) {
    const base = String(node.path || '').trim().replace(/[\\/]+$/, '')

    if (node.isNoProject || !base) {
      continue
    }

    if ((target === base || target.startsWith(`${base}/`)) && base.length > bestLen) {
      best = node
      bestLen = base.length
    }
  }

  return best
}

/**
 * Projekte/Baum und Pill-Zustand gemeinsam nachziehen — Listener-Kontext für
 * register() und die Poll-Ticks.
 * Catalog-Build: No-Op-Default (die Chip-UI existiert dort nicht, Regel 8);
 * der Full-Build überschreibt innerhalb des #full-Blocks mit der echten
 * Sync-Logik — die Tabs-Settings und der Dispose dürfen den Kick in BEIDEN
 * Builds rufen.
 */
function kickComposerPillSync() {}

/* #full */
/**
 * Anker, den die App für einen Draft beim Senden auflöst — SYNCHRON gespiegelt
 * (`use-session-actions`: Home-Scope → detached, sonst `$currentCwd`, sonst
 * `resolveNewSessionCwd` = Projekt-Scope-Wurzel). Quelle sind genau die Atome
 * der NATIVEN Sessions-Seitenleiste: ihr „+" am Projekt / der Projekt-Scope
 * setzen `$currentCwd` bzw. `hermes.desktop.projectScope` (persistentAtom
 * schreibt den Key bei jeder Änderung — Lesen ist ehrlich, Schreiben nicht;
 * deshalb liest NUR diese Funktion den localStorage und KEIN Plugin-Pfad
 * schreibt ihn — siehe applyComposerPick, dort der bewusste Nicht-Schreib-
 * Kommentar). Früher rief diese Funktion die ASYNC
 * `resolveNewProjectSessionCwd()` ohne await auf → `.cwd` eines Promise war
 * immer undefined, der Chip lernte nie einen nativen Anker.
 */
function composerDraftAnchor() {
  let scope = ''
  let cwd = ''

  try {
    scope = String(window.localStorage?.getItem('hermes.desktop.projectScope') || '')
  } catch {
    scope = ''
  }

  if (scope === '__no_project__') {
    return { cwd: '', node: null }
  }

  try {
    cwd = String(host.state?.cwd?.get?.() || '').trim()
  } catch {
    cwd = ''
  }

  if (!cwd && scope && scope !== '__all_projects__') {
    const scoped = $projectsList.get().find(entry => entry.id === scope && !entry.isNoProject)

    cwd = String(scoped?.path || '').trim()
  }

  return { cwd, node: projectForCwd(cwd) }
}

/**
 * Draft-Pick: nur den Anker in `$composerPick` merken (und den App-Scope im
 * localStorage anpassen, damit das App-`use-session-actions` beim Senden den
 * `cwd` auflösen kann). KEIN eager `startNewSessionInCwd` mehr — der erzeugte
 * sofort eine leere Session, noch bevor der User tippt, und der Bug-Report
 * 2026-10-06 (Pill zeigt Projekt, aber neue Sessions landen trotzdem unter
 * "Kein Projekt") lag genau daran: der App-Sendepfad resolve-te seinen CWD
 * unabhängig vom Anker. Mit dem App-Scope-Override greift `startNewProjectSession`
 * jetzt beim tatsächlichen Enter, der Draft bleibt bis dahin offen.
 *
 * Session-Pick: re-home via session.workspace.move (Fallback cwd.set).
 */
async function applyComposerPick(node) {
  const focusedStored = (() => {
    try {
      return String(host.state?.focusedStoredSessionId?.get?.() || '')
    } catch {
      return ''
    }
  })()

  // 1) Anker-Atom setzen (immer) — auch in `startNewProjectSession` lesbar als
  //    erste Quelle vor App-Scope/active_id (siehe resolveNewProjectSessionCwd).
  $composerPick.set({ id: node.id, label: node.label, color: node.color, at: Date.now() })

  // Bewusst KEIN Schreiben von `hermes.desktop.projectScope`: der App-Atom liest
  // den Key nur beim Modul-Init — ein Write änderte nichts am laufenden Draft,
  // ließe die App aber beim NÄCHSTEN Start ungefragt in diesem Projekt
  // einsteigen. Der Draft-Pick wirkt über `adoptComposerPickForNewSession`.

  if (focusedStored) {
    try {
      await rehomeFocusedSession(focusedStored, node)
    } catch (error) {
      host.notifyError(error, CTX?.i18n?.t('composerProject') || 'Projekt')
    }
  } else if (!node.path) {
    // Draft + Home-Pick: kein Anker, nur Hinweis.
    host.notify({
      kind: 'info',
      message: CTX?.i18n?.t('composerProjectNoneHint')
        || 'Home hat keinen Arbeitsordner — für einen Draft bitte ein Projekt wählen.'
    })
  }
  // Draft + Projekt-Pick: nichts weiter — der Anker reicht; der App-Sendepfad
  // liest `$composerPick` als erste Quelle.

  // Best-effort: dauerhafter Aktiv-Zeiger (Ziel zukünftiger App-Scopes/CLI).
  try {
    await setActiveProject(node.id && !node.isNoProject ? node.id : null)
  } catch {
    // Nice-to-have — kein Fehlerfall für den Pill-Flow.
  }
}

/** Bestehende (fokussierte) Session in das Projekt re-homen. */
async function rehomeFocusedSession(storedId, node) {
  const cwd = String(node.path || '').trim()

  if (!cwd) {
    // Home-Pick auf bestehender Session: ein echtes Detachen unterstützt das
    // Gateway nicht (move braucht ein existierendes cwd) — ehrlich sagen.
    host.notify({
      kind: 'info',
      message: CTX?.i18n?.t('composerProjectHomeSessionHint')
        || 'Eine bestehende Session kann nicht nach Home verschoben werden.'
    })
    return
  }

  let persisted = false

  try {
    await host.request('session.workspace.move', { session_key: storedId, cwd })
    persisted = true
  } catch (error) {
    console.warn(`[${ID}] session.workspace.move fehlgeschlagen — Fallback cwd.set`, error)
  }

  if (!persisted) {
    const runtimeId = await findLiveSessionIdByKey(storedId)

    if (runtimeId) {
      try {
        await host.request('session.cwd.set', { cwd, session_id: runtimeId })
        persisted = true
      } catch (error) {
        console.warn(`[${ID}] session.cwd.set (Pill-Fallback) fehlgeschlagen`, error)
      }
    }
  }

  // Beide Schreibwege gescheitert → sichtbar melden (v1.24.0) und Pick
  // verwerfen, damit der Chip nicht weiter Gültigkeit suggeriert. Vorher
  // blieb der Fehler still: kein Toast, Pick stand weiter im Atom.
  if (!persisted) {
    $composerPick.set({ id: '', label: '', color: null, at: 0 })
    host.notify({
      kind: 'error',
      message: CTX?.i18n?.t('composerProjectRehomeFail')
        || 'Projekt konnte nicht gesetzt werden — bitte erneut versuchen.'
    })

    return
  }

  const targetNode = $projectsList.get().find(entry => !entry.isNoProject && entry.path === cwd)

  if (targetNode) {
    const seeds = $sessionProjectSeed.get()
    seeds[storedId] = { id: targetNode.id, name: targetNode.label, color: targetNode.color, icon: targetNode.icon, path: targetNode.path, at: Date.now() }
    $sessionProjectSeed.set({ ...seeds })
  }

  void invalidateProjectTree()
  scheduleSessionsRefresh(400)
  host.notify({
    kind: persisted ? 'success' : 'info',
    message: `${CTX?.i18n?.t('composerProjectRehomeOk') || 'Projekt gesetzt'}${node.label ? ` · ${node.label}` : ''}`
  })
}

/**
 * Draft-Pick → echte Session (der native Sendeweg).
 *
 * Der Composer-Chip im Draft ist nur ein Merker: das App-Senden löst seinen
 * Arbeitsordner selbst auf (`$currentCwd`/`$projectScope`, keine Plugin-
 * Schreib-Tür). Legt die App die Session aus dem Draft an — egal ob der
 * Draft aus der NATIVEN Sessions-Seitenleiste oder dem Plugin-Pane stammt —,
 * wechselt der fokussierte Stored-Id-Wert von leer auf eine neue ID. In genau
 * diesem Moment wird der gültige Pick per `session.workspace.move` auf die
 * neue Session angewandt (Chip verhält sich damit überall gleich). Nicht
 * eingreifen, wenn (a) die ID schon bekannt ist (bestehende Session aus der
 * Seitenleiste geöffnet), (b) das Plugin selbst gerade eine verankerte Session
 * erzeugt (`ownCreateUntil`) oder (c) die Session ohnehin im Pick-Projekt
 * liegt.
 */
/* #end */

// Gemeinsamer Create-Zustand (BEIDE Builds): `startNewSessionInCwd` markiert
// eigene Creates über `ownCreateUntil`; der Chip-Adopt (nur Full-Build)
// liest/setzt zusätzlich `adoptPrevStored`. Deshalb NICHT im #full-Block.
let adoptPrevStored = null
let ownCreateUntil = 0

/* #full */
function adoptComposerPickForNewSession() {
  let next = ''

  try {
    next = String(host.state?.focusedStoredSessionId?.get?.() || '')
  } catch {
    next = ''
  }

  const prev = adoptPrevStored

  adoptPrevStored = next

  if (prev === null || prev || !next) {
    return
  }

  const pick = activeComposerPick()

  // Der Übergang gehört dem eigenen Create (einmalig verbrauchen).
  if (Date.now() < ownCreateUntil) {
    ownCreateUntil = 0

    return
  }

  if (!pick || pick.id === '__no_project__') {
    // Auch hier verbrauchen: ohne Clear bliebe der alte Pick im Atom und der
    // Chip würde beim nächsten Draft weiter das ALT-Label zeigen (v1.24.0).
    $composerPick.set({ id: '', label: '', color: null, at: 0 })

    return
  }

  if ($sessions.get().some(row => row.id === next)) {
    return
  }

  $composerPick.set({ id: '', label: '', color: null, at: 0 })

  const node = $projectsList.get().find(entry => entry.id === pick.id && !entry.isNoProject)
  const path = String(node?.path || '').trim()

  if (!node || !path) {
    return
  }

  let cwd = ''

  try {
    cwd = String(host.state?.cwd?.get?.() || '').trim()
  } catch {
    cwd = ''
  }

  if (cwd && (cwd === path || cwd.startsWith(`${path}/`))) {
    return
  }

  void rehomeFocusedSession(next, node).catch(error => {
    console.warn(`[${ID}] Draft-Pick konnte nicht angewandt werden`, error)
  })
}

/**
 * Draft-Anzeige: aktueller Pick (Composer-Chip) gewinnt — sonst gelernter
 * Anker (App-Logik gespiegelt — Scope/active_id/letzte Session-CWD), sobald
 * ein Projekt daraus ablesbar ist.
 */
function composerDraftLabel() {
  const pick = activeComposerPick()
  if (pick) {
    // Pick-Label aus dem Tree (Live-Update: Umbenennung schlägt durch).
    const node = $projectsList.get().find(entry => entry.id === pick.id)
    if (node) {
      return { id: node.id, label: node.label, color: node.color }
    }
    return { id: pick.id, label: pick.label, color: pick.color }
  }

  const { node } = composerDraftAnchor()

  if (node) {
    return { id: node.id, label: node.label, color: node.color }
  }

  return null
}

/** Eine Pill-Zeile bauen (imperatives DOM — kein react-dom im Plugin). */
function buildComposerPillRow(doc) {
  const row = doc.createElement('div')

  row.className = 'sf-cproj-row'
  row.setAttribute(CPROJ_MARKER, '')

  const pill = doc.createElement('button')

  pill.type = 'button'
  pill.className = 'sf-cproj-pill'
  pill.setAttribute('data-sf-cproj-trigger', '')

  const dot = doc.createElement('span')

  dot.className = 'sf-cproj-dot'

  const name = doc.createElement('span')

  name.className = 'sf-cproj-name'

  const caret = doc.createElement('span')

  caret.className = 'sf-cproj-caret'
  caret.textContent = '▾'
  caret.setAttribute('aria-hidden', 'true')

  pill.appendChild(dot)
  pill.appendChild(name)
  pill.appendChild(caret)
  row.appendChild(pill)

  return row
}

/** Menü einmalig bauen und an document hängen (versteckt per [hidden]). */
function buildComposerPillMenu(doc) {
  const menu = doc.createElement('div')

  menu.className = 'sf-cproj-menu'
  menu.setAttribute('data-sf-cproj-menu', '')
  menu.hidden = true
  menu.setAttribute('role', 'menu')

  const hint = doc.createElement('div')

  hint.className = 'sf-cproj-menu-hint'
  menu.appendChild(hint)
  doc.body.appendChild(menu)

  return menu
}

/** Menü-Einträge rendern (Draft: Home zuerst; Session: nur echte Projekte). */
function renderComposerPillMenu(menu, isDraft, activeId = '') {
  const doc = menu.ownerDocument

  while (menu.firstChild) {
    menu.removeChild(menu.firstChild)
  }

  const hint = doc.createElement('div')

  hint.className = 'sf-cproj-menu-hint'
  hint.textContent = CTX?.i18n?.t('composerProjectMenuHint') || 'Ziel-Projekt für die nächste Eingabe'
  menu.appendChild(hint)

  const entries = []

  if (isDraft) {
    entries.push({ id: '__no_project__', label: CTX?.i18n?.t('composerProjectNone') || 'Kein Projekt (Home)', color: null, path: '' })
  }

  for (const node of $projectsList.get()) {
    if (!node.isNoProject) {
      entries.push({ id: node.id, label: node.label, color: node.color, path: node.path, isNoProject: false })
    }
  }

  for (const entry of entries) {
    const item = doc.createElement('button')

    item.type = 'button'
    item.className = 'sf-cproj-item'
    item.setAttribute('role', 'menuitem')
    item.setAttribute('data-project', entry.id)
    item.setAttribute('data-active', entry.id === activeId ? 'true' : 'false')

    const dot = doc.createElement('span')

    dot.className = 'sf-cproj-dot'
    if (entry.color) {
      dot.style.setProperty('--sf-cproj-color', entry.color)
    }

    const name = doc.createElement('span')

    name.className = 'sf-cproj-name'
    name.textContent = entry.label

    item.appendChild(dot)
    item.appendChild(name)
    item.addEventListener('click', () => {
      setComposerMenuOpen(null)
      void applyComposerPick(entry)
    })
    menu.appendChild(item)
  }

  if (entries.length <= 1 && isDraft) {
    const empty = doc.createElement('div')

    empty.className = 'sf-cproj-empty'
    empty.textContent = CTX?.i18n?.t('composerProjectPickToast') || 'Noch keine Projekte angelegt'
    menu.appendChild(empty)
  }
}

/** Menü-Zustand: Element-Referenz oder null; globaler Listener schließt. */
let composerMenuEl = null
let composerMenuOutside = null
let composerMenuKey = null

function setComposerMenuOpen(target) {
  if (composerMenuEl && target !== composerMenuEl) {
    composerMenuEl.hidden = true
  }

  composerMenuEl = target

  if (composerMenuOutside) {
    composerMenuOutside()
    composerMenuOutside = null
  }

  if (!composerMenuEl) {
    composerMenuKey = null
    return
  }

  const onKey = event => {
    if (event.key === 'Escape') {
      setComposerMenuOpen(null)
    }
  }

  const onDown = event => {
    if (composerMenuEl && !composerMenuEl.contains(event.target) && !event.target.closest?.('[data-sf-cproj-trigger]')) {
      setComposerMenuOpen(null)
    }
  }

  document.addEventListener('keydown', onKey, true)
  document.addEventListener('pointerdown', onDown, true)
  composerMenuOutside = () => {
    document.removeEventListener('keydown', onKey, true)
    document.removeEventListener('pointerdown', onDown, true)
  }
}

/**
 * Pill-Zustand je DOM-Sync aktualisieren: Label/Color aus Fokus/Seed/Baum,
 * Draft-Anzeige aus gelerntem Anker. Data-Marker steuern CSS-Zustände.
 */
function refreshComposerPillState(row) {
  const pill = row.querySelector('.sf-cproj-pill')

  if (!pill) {
    return
  }

  let focusedStored = ''

  try {
    focusedStored = String(host.state?.focusedStoredSessionId?.get?.() || '')
  } catch {
    focusedStored = ''
  }

  let label = ''
  let color = null
  let projectId = ''
  const isDraft = !focusedStored

  if (focusedStored) {
    // Baum/Seed zuerst; steht die Session (noch) in keinem Baum-Knoten — frisch
    // aus der NATIVEN Seitenleiste, 0 Turns —, trägt ihr Arbeitsordner die
    // Zuordnung (der Baum gruppiert genau nach cwd).
    let proj = projectForStoredSession(focusedStored)

    if (!proj) {
      const known = $projectsList.get().some(entry => entry.sessionIds.has(focusedStored))
      let cwd = ''

      try {
        cwd = String(host.state?.cwd?.get?.() || '')
      } catch {
        cwd = ''
      }

      const byCwd = known ? null : projectForCwd(cwd)

      proj = byCwd ? { id: byCwd.id, label: byCwd.label, color: byCwd.color, path: byCwd.path } : null
    }

    if (proj) {
      label = proj.label
      color = proj.color
      projectId = proj.id
    }
  } else {
    const draft = composerDraftLabel()

    if (draft) {
      label = draft.label
      color = draft.color
      projectId = draft.id
    }
  }

  const name = pill.querySelector('.sf-cproj-name')
  const dot = pill.querySelector('.sf-cproj-dot')

  if (name) {
    name.textContent = label || (CTX?.i18n?.t('composerProjectNone') || 'Kein Projekt')
  }

  if (dot) {
    if (color) {
      dot.style.setProperty('--sf-cproj-color', color)
    } else {
      dot.style.removeProperty('--sf-cproj-color')
    }
  }

  row.setAttribute('data-sf-cproj-draft', isDraft ? 'true' : 'false')
  row.setAttribute('data-sf-cproj-id', projectId)
  row.setAttribute('data-sf-cproj-empty', label ? 'false' : 'true')
  row.setAttribute('data-sf-cproj-focus', focusedStored ? 'session' : 'draft')
}

/**
 * Sync-Loop: findet den „+"-Button des fokussierten, sichtbaren Composers und
 * hängt den Chip als erstes Kind in dessen Wrapper (direkt VOR dem „+", selbe
 * Zeile wie die Eingabe). Entfernt die Zeile wieder, wenn die Einstellung aus
 * geht — nichts bleibt nach Dispose übrig.
 */
function syncComposerProjectPills() {
  const doc = document

  if (!doc || !doc.body) {
    return
  }

  if (!composerPillEnabled()) {
    doc.querySelectorAll(`[${CPROJ_MARKER}]`).forEach(el => el.remove())
    setComposerMenuOpen(null)
    return
  }

  // Composer-Roots: sichtbar (nicht overlayt), Fokus-Vorrang (Keep-Alive-Tiles
  // sind [data-pane-hidden] und bekommen bewusst keinen Chip).
  const roots = Array.from(doc.querySelectorAll("[data-slot='composer-root']"))
  const focusedRuntime = (() => {
    try {
      return String(host.state?.focusedSessionId?.get?.() || '')
    } catch {
      return ''
    }
  })()

  let hostRoot = null

  for (const root of roots) {
    // data-popped-out ist bei Pop-out PRESENT (leerer String), sonst ABSENT
    // (null) — getAttribute liefert nie undefined. Der bisherige Vergleich
    // gegen undefined war immer wahr und übersprang ALLE Roots (Probe:
    // chips=0 roots=2 plusIcons=2).
    if (root.closest('[data-pane-overlay]') || root.hasAttribute('data-popped-out')) {
      continue
    }

    const pane = root.closest('[data-pane-host], [data-chat-surface], body')

    if (!pane || pane.getAttribute('data-pane-hidden') === '') {
      continue
    }

    if (pane !== doc.body && pane.offsetParent === null) {
      continue
    }

    const isFocused = focusedRuntime
      ? Array.from(pane.querySelectorAll('[data-session-id]')).some(el => el.getAttribute('data-session-id') === focusedRuntime)
      : false

    if (!hostRoot || isFocused) {
      hostRoot = { root, pane, isFocused }
    }

    if (hostRoot.isFocused) {
      break
    }
  }

  if (!hostRoot) {
    doc.querySelectorAll(`[${CPROJ_MARKER}]`).forEach(el => el.remove())
    return
  }

  // „+"-Button: Codicon "add" ist eindeutig innerhalb des Composer-Roots
  // (Add-Attach-Button). Sein Wrapper ist der menu-Grid-Bereich.
  const plusBtn = hostRoot.root.querySelector('.codicon-add')?.closest('button')

  if (!plusBtn) {
    return
  }

  const row = plusBtn.parentElement

  if (!row || row === hostRoot.root) {
    return
  }

  let chip = row.querySelector(`:scope > [${CPROJ_MARKER}]`)

  if (!chip) {
    for (const existing of doc.querySelectorAll(`[${CPROJ_MARKER}]`)) {
      existing.remove()
    }
    chip = buildComposerPillRow(doc)
    row.insertBefore(chip, plusBtn)
  }

  if (chip.parentElement !== row) {
    chip.parentElement?.removeChild(chip)
    row.insertBefore(chip, plusBtn)
  }

  refreshComposerPillState(chip)

  const pill = chip.querySelector('.sf-cproj-pill')

  if (!pill) {
    return
  }

  if (!pill.dataset.sfCprojBound) {
    pill.dataset.sfCprojBound = '1'
    pill.addEventListener('click', () => {
      let menu = doc.querySelector('[data-sf-cproj-menu]')

      if (!menu) {
        menu = buildComposerPillMenu(doc)
      }

      if (menu.hidden && composerMenuKey !== pill) {
        const isDraft = chip.getAttribute('data-sf-cproj-draft') === 'true'
        const activeId = chip.getAttribute('data-sf-cproj-id') || ''

        renderComposerPillMenu(menu, isDraft, activeId)

        // Projekte in der NATIVEN Seitenleiste angelegt/umbenannt? Das Gateway
        // sendet dazu keine Events — beim Öffnen frisch ziehen (4-s-Guard) und
        // das offene Menü nachrendern, damit es dieselbe Liste zeigt wie dort.
        if (Date.now() - projectsListSucceededAt > 4_000) {
          void refreshProjectsList().then(() => {
            if (!menu.hidden && composerMenuKey === pill) {
              renderComposerPillMenu(menu, isDraft, chip.getAttribute('data-sf-cproj-id') || '')
            }
          })
        }

        const rect = pill.getBoundingClientRect()
        menu.style.left = `${Math.max(8, Math.round(rect.left))}px`
        menu.style.bottom = `${Math.max(8, Math.round(window.innerHeight - rect.top + 6))}px`
        menu.hidden = false
        composerMenuKey = pill
        setComposerMenuOpen(menu)
      } else {
        setComposerMenuOpen(null)
      }
    })
  }
}

/**
 * Projekte/Baum und Pill-Zustand gemeinsam nachziehen — Listener-Kontext für
 * register() und die Poll-Ticks (Full-Build-Override des No-Op-Defaults).
 */
kickComposerPillSync = function kickComposerPillSync() {
  try {
    syncComposerProjectPills()
  } catch (error) {
    console.warn(`[${ID}] composer pill sync failed`, error)
  }
}
/* #end */

/**
 * Zu einem stored session_key die passende Live-session_id (In-Memory-sid)
 * finden. Nötig für `session.cwd.set`, das ausschließlich mit der
 * In-Memory-ID arbeitet (vgl. `_sess_nowait` im Gateway). Reihenfolge:
 *   1) `$liveMap` (schon gepollt) — der häufige Fall.
 *   2) frischer `session.active_list`-RPC — fängt den Timing-Fall direkt
 *      nach `session.create`/vor dem nächsten Poll ab.
 *   3) null — die Session ist nicht live; `session.cwd.set` würde 4001
 *      zurückgeben. Caller entscheidet, ob er die Zuordnung nur optisch
 *      via Overlay-Seed anwendet und einen Hinweis zeigt.
 */
async function findLiveSessionIdByKey(storedId) {
  const needle = String(storedId || '').trim()
  if (!needle) return null

  const live = $liveMap.get()
  for (const [runtimeId, info] of Object.entries(live)) {
    if (info && String(info.storedId || '') === needle) {
      return String(runtimeId)
    }
  }

  try {
    const result = await host.request('session.active_list', {})
    const items = Array.isArray(result?.sessions) ? result.sessions : []
    for (const item of items) {
      if (String(item?.session_key || '') === needle) {
        return String(item?.id || '') || null
      }
    }
  } catch (error) {
    console.warn(`[${ID}] session.active_list lookup failed`, error)
  }

  return null
}

/**
 * Welchem Projekt eine Session gehört — schlägt direkt im Hermes-Projekt-
 * Baum nach (`projects.tree` → `ProjectTreeNode.sessionIds`), statt die
 * Zuordnung client-seitig nachzubauen (siehe `refreshProjectsList()` oben
 * für die Begründung). Der Home/„Kein Projekt"-Knoten (`isNoProject`) zählt
 * genauso als „nicht zugeordnet" wie eine Session-ID, die in KEINEM Knoten
 * auftaucht (z. B. jenseits von `session_limit`).
 *
 * Ausnahme Live-Overlay: eine frisch über „+"/Projekt-Header erstellte
 * Session steht (noch) in keinem Baum-Knoten — ihr Seed liefert das Ziel
 * aus dem Create-Kontext, bis der Baum sie nach dem ersten Turn übernimmt
 * (genau das Prinzip von Hermes Desktops `liveSessionProjectId`-Overlay).
 *
 * @returns {{id:string,name:string,color:?string,icon:?string,anchor:string,isAuto:boolean}|null}
 *   `null` → „Kein Projekt".
 */
function resolveSessionProject(row) {
  const id = String(row?.id || '').trim()

  if (!id) {
    return null
  }

  for (const node of $projectsList.get()) {
    if (node.isNoProject) {
      continue
    }

    if (node.sessionIds.has(id)) {
      return { id: node.id, name: node.label, color: node.color, icon: node.icon, anchor: node.path, isAuto: node.isAuto }
    }
  }

  // Live-Overlay: der Baum führt die ID nicht (0-Turn-Session, noch nicht
  // persistiert). Der Seed existiert NUR für Sessions, die wir selbst mit
  // bekanntem Zielprojekt erstellt haben — unbekannte IDs bleiben null.
  const seed = $sessionProjectSeed.get()[id]

  if (seed) {
    return { id: seed.id, name: seed.name, color: seed.color || null, icon: seed.icon || null, anchor: seed.path, isAuto: false }
  }

  return null
}

/**
 * Kurzform eines Pfads für die Projekt-Gruppen-Subzeile — letzte `segments`
 * Ordner, mit „…/" davor wenn welche abgeschnitten wurden. Der volle Pfad
 * bleibt im `title`-Tooltip erhalten (siehe SectionHeader), das hier ist nur
 * die sichtbare Kurzfassung unter dem Projektnamen.
 */
function shortPath(full, segments = 2) {
  const trimmed = String(full || '').trim().replace(/[\\/]+$/, '')

  if (!trimmed) {
    return ''
  }

  const parts = trimmed.split(/[\\/]/).filter(Boolean)

  if (parts.length <= segments) {
    return parts.join('/')
  }

  return `…/${parts.slice(-segments).join('/')}`
}

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
        scheduleContextRefresh(800)
      })
    }
  } catch {
    /* ältere Builds ohne settings-API */
  }

  return () => {}
}

/* #full */
/**
 * App→Plugin-Instant-Sync: beobachtet den DOM-Container der Hermes-Sidebar
 * ([data-sessions-mode] — von der App selbst als Skin-Anker deklariert).
 * Ändert sich dort etwas (Projekt erstellt/umbenanen/gelöscht, Ordner
 * verknüpft, Session verschoben/gepinnt/archiviert), refresht Session Flow
 * nach kurzem Debounce nach — das Gateway feuert dafür KEINE Events (der
 * RPC-Katalog wurde darauf geprüft), also ist der DOM die einzige sofortige
 * Signalquelle. Zusätzlich zieht ein window-focus nach (Fensterwechsel).
 * Der Observer ist bewusst breit (childList+attributes) und debounced —
 * die reine DOM-Mutation ist billig, nur der nachgelagerte Refresh kostet.
 */
function watchSidebarSync(ctx) {
  if (typeof MutationObserver !== 'function' || typeof document === 'undefined') {
    return () => {}
  }

  let timer = 0
  let queued = false
  let lastRun = 0

  const run = () => {
    lastRun = Date.now()
    queued = false

    // Baum + Sessions nachziehen; die Inflight-/TTL-Guards in beiden
    // Refreshes verhindern Spam, wenn die Sidebar mehrere Mutationen in
    // Folge feuert (Reorder, Collapse-Animationen etc.).
    if (Date.now() - projectsListSucceededAt > 4_000) {
      void refreshProjectsList()
    }

    if (Date.now() - pinnedSucceededAt > 5_000) {
      void refreshPinnedIds()
    }

    void refreshSessions()
  }

  const schedule = () => {
    queued = true

    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      if (!queued) {
        return
      }

      // In schneller Folge: minimal 1,2 s Abstand zwischen echten Läufen.
      const wait = Math.max(0, 1200 - (Date.now() - lastRun))
      window.clearTimeout(timer)

      if (wait === 0) {
        run()
      } else {
        timer = window.setTimeout(() => queued && run(), wait)
      }
    }, 600)
  }

  const attach = root => {
    if (!root || root.__sfSyncObserved) {
      return
    }

    try {
      root.__sfSyncObserved = true
      const observer = new MutationObserver(schedule)
      observer.observe(root, { attributes: true, attributeFilter: ['data-sessions-mode', 'data-sessions-project', 'data-active'], childList: true, subtree: true })
      observers.push({ observer, root })
    } catch {
      /* DOM weg — beim nächsten Tick erneut versuchen */
    }
  }

  const observers = []
  const scan = () => {
    try {
      attach(document.querySelector('[data-sessions-mode]'))
    } catch {
      /* kein DOM */
    }
  }

  scan()
  const scanTimer = ctx.setInterval(scan, 5_000)

  const onFocus = () => {
    // Fenster zurück: die App hat frische Daten, wir auch — gedrosselt.
    if (Date.now() - lastRun > 2_000) {
      schedule()
    }
  }

  // Tab-Visibility (Browser-Shell / zweites Fenster): visibilitychange feuert
  // auch, wenn das Hermes-Fenster nicht den OS-Fokus hat, aber der sichtbare
  // Tab wieder im Vordergrund steht. Ohne diesen Listener bleibt die Pane
  // „alt", bis der User das Fenster wirklich auf den Fokus zieht — reicht
  // in der Praxis nicht, weil er die Pane oft nur anklickt.
  const onVisible = () => {
    try {
      if (document.visibilityState !== 'visible') {
        return
      }
    } catch {
      return
    }

    if (Date.now() - lastRun > 2_000) {
      schedule()
    }
  }

  try {
    window.addEventListener('focus', onFocus)
  } catch {
    /* Tests ohne echtes window */
  }

  try {
    document.addEventListener('visibilitychange', onVisible)
  } catch {
    /* Tests ohne echtes document */
  }

  return () => {
    window.clearTimeout(timer)

    try {
      ctx.clearInterval(scanTimer)
    } catch {
      /* älterer Host */
    }

    try {
      window.removeEventListener('focus', onFocus)
    } catch {
      /* ditto */
    }

    try {
      document.removeEventListener('visibilitychange', onVisible)
    } catch {
      /* ditto */
    }

    for (const { observer, root } of observers) {
      try {
        observer.disconnect()
        delete root.__sfSyncObserved
      } catch {
        /* schon weg */
      }
    }
  }
}
/* #end */

let refreshInFlight = null

/**
 * Projekt-Baum sofort nachziehen — nach User-Aktionen (Session erstellt,
 * Drag&Drop-Verschiebung), nicht erst beim 60-s-Takt. Setzt das Erfolgs-
 * Zeitstempel zurück, damit auch der nächste scheduleSessionsRefresh-Tick
 * noch einmal nachzieht, falls der hier gestartete Lauf die Änderung noch
 * nicht gesehen hat (Inflight-Guard innerhalb von refreshProjectsList
 * bleibt wirksam).
 */
function invalidateProjectTree() {
  projectsListSucceededAt = 0
  return refreshProjectsList()
}

// ─────────────────────────────────────────────────────────────────────────────
// Projekt-Verwaltung — dieselben Gateway-RPCs, die auch die Hermes-Sidebar
// nutzt (methods_projects.py): create/update/add_folder/remove_folder/
// set_primary/delete/set_active. Jede Mutation zieht den Baum sofort nach
// und kickt die App-Sidebar (focus/visibilitychange), damit BEIDE Ansichten
// ohne manuelles Aktualisieren synchron stehen.
// ─────────────────────────────────────────────────────────────────────────────

/** Nach einer Projekt-Mutation: Baum + Sessions sofort, App sanft nachziehen. */
function afterProjectMutation() {
  void invalidateProjectTree()
  scheduleSessionsRefresh(600)
  kickAppRefresh()
}

/** Neues Projekt anlegen (Name + mindestens ein Ordner), optional sofort aktiv. */
async function createProject({ name, folders, color, icon, use }) {
  const params = { name: String(name || '').trim(), folders: (folders || []).map(f => String(f || '').trim()).filter(Boolean) }

  if (color) params.color = color
  if (icon) params.icon = icon
  if (use) params.use = true

  const payload = await host.request('projects.create', params)
  afterProjectMutation()

  return payload?.project || null
}

/** Bestehendes Projekt umbenennen / Farbe+Icon setzen (projects.update). */
async function updateProject(id, patch) {
  const params = { id }

  if (patch?.name != null) params.name = String(patch.name)
  if (patch?.color !== undefined) params.color = patch.color
  if (patch?.icon !== undefined) params.icon = patch.icon

  await host.request('projects.update', params)
  afterProjectMutation()
}

/** Ordner zu einem Projekt verknüpfen (projects.add_folder). */
async function addProjectFolder(id, path) {
  await host.request('projects.add_folder', { id, path: String(path || '') })
  afterProjectMutation()
}

/** Ordner aus einem Projekt lösen (projects.remove_folder). */
async function removeProjectFolder(id, path) {
  await host.request('projects.remove_folder', { id, path: String(path || '') })
  afterProjectMutation()
}

/** Primären Ordner setzen (projects.set_primary). */
async function setProjectPrimaryFolder(id, path) {
  await host.request('projects.set_primary', { id, path: String(path || '') })
  afterProjectMutation()
}

/** Projekt als aktives setzen (projects.set_active) — Ziele neuer Sessions. */
async function setActiveProject(id) {
  await host.request('projects.set_active', id ? { id } : {})
  afterProjectMutation()
}

/** Projekt löschen (explizit) — Auto-Projekte werden stattdessen ausgeblendet. */
async function deleteProject(id) {
  await host.request('projects.delete', { id })
  afterProjectMutation()
}

/** Pfad im OS-Dateimanager zeigen (App-Preload-Door, Remote-safe). */
/* #full */
async function revealProjectPath(path) {
  const desktop = globalThis.window?.hermesDesktop

  if (!desktop || typeof desktop.revealPath !== 'function') {
    host.notify({ kind: 'info', message: CTX?.i18n?.t('projRevealUnavailable') || 'Dateimanager nicht verfügbar' })

    return
  }

  try {
    await desktop.revealPath(path)
  } catch (error) {
    host.notifyError(error, CTX?.i18n?.t('projReveal') || 'Im Dateimanager anzeigen')
  }
}
/* #end */

/* #full */
/** Ordner über den nativen/remote-fähigen Picker wählen; null bei Abbruch. */
async function pickProjectFolder() {
  const desktop = globalThis.window?.hermesDesktop

  if (!desktop || typeof desktop.selectPaths !== 'function') {
    host.notify({ kind: 'info', message: CTX?.i18n?.t('projPickUnavailable') || 'Ordnerauswahl nicht verfügbar' })

    return null
  }

  try {
    const picked = await desktop.selectPaths({ directories: true, multiple: false, title: CTX?.i18n?.t('projPickFolder') || 'Ordner wählen' })

    return Array.isArray(picked) && picked[0] ? String(picked[0]) : null
  } catch {
    return null
  }
}
/* #end */

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
 * Ziel-CWD für eine neue Session — Auflösungsreihenfolge (jede Quelle gewinnt
 * nur, wenn sie einen echten CWD liefert):
 *   1) Composer-Chip-Pick (`$composerPick`, TTL 5 min) — überschreibt den
 *      App-Scope, damit ein vor dem Tippen gewählter Anker wirklich greift.
 *   2) projects.db `active_id` via `projects.list` (der App-Scope-Key im
 *      localStorage wird bewusst NICHT mehr gelesen — App-interner Zustand,
 *      Catalog-Regel 8/13; der aktive Zeiger kommt ausschließlich über die
 *      öffentliche RPC-Tür).
 *   3) letzte bekannte Session-CWD.
 * Leer = Backend löst selbst auf.
 */
async function resolveNewProjectSessionCwd() {
  // 1) Composer-Chip-Pick (höchste Priorität — überschreibt den App-Scope,
  //    damit der User-sichtbare Pill-State mit dem Create-Anker übereinstimmt).
  const pick = $composerPick.get()
  if (pick && pick.id && pick.id !== '__no_project__' && Date.now() - Number(pick.at || 0) < COMPOSER_PICK_TTL_MS) {
    const node = $projectsList.get().find(entry => entry.id === pick.id)
    const cwd = String(node?.path || '').trim()
    if (cwd) {
      return { cwd, label: String(node?.label || pick.label || '') }
    }
  }

  let activeId = ''
  let projects = []

  try {
    const payload = await host.request('projects.list', {})
    projects = Array.isArray(payload?.projects) ? payload.projects : []
    activeId = String(payload?.active_id || '')
  } catch {
    // Älteres Backend ohne projects.* — der Fallback unten greift.
  }

  const wantedId = activeId

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

    // Sichtbarer Hinweis, wenn weder Scope noch active_id noch letzte Session
    // einen Projekt-Anker liefern. Ohne Toast landete die Session stillschweigend
    // in „Kein Projekt" — die Hauptbeschwerde aus v1.17.3/v1.19.0. Jetzt sieht
    // der User sofort, dass der Header-Scope greifen muss.
    if (!target.cwd) {
      host.notify({
        kind: 'info',
        message: CTX?.i18n?.t('noProjectAnchor')
          || 'Neue Session ohne Projekt-Anker — bitte Projekt in der Kopfzeile wählen.'
      })
    }

    await startNewSessionInCwd(target.cwd, target.label)
  } catch (error) {
    host.notifyError(error, CTX?.i18n?.t('newSession') || 'Neue Session')
  }
}

/**
 * Profil des Gateway-Sockets, auf dem `host.request` landet (aktives Profil).
 * Jede per RPC erzeugte Session gehört genau diesem Backend.
 */
function ambientOwnerProfile() {
  try {
    const profile = String(host.state?.profile?.get?.() || '').trim()

    return profile || 'default'
  } catch {
    return 'default'
  }
}

/**
 * Frisch per RPC erzeugte Session öffnen — MIT Owner-Hinweis.
 *
 * Ursache des Fehlers „Session owner could not be resolved" (Neue Session in
 * der Kopfzeile): die App routet jeden session-bezogenen RPC über die
 * Owner-Leiter (Tile-Route → Owner-Hinweis → Session-Zeile → Profil-Probe)
 * und bricht bei unbekanntem Owner fail-closed ab, sobald es mehr als ein
 * Profil gibt. Eine Session, die das Plugin selbst erzeugt, hat weder Zeile
 * (DB-Row entsteht lazy beim 1. Prompt) noch Hinweis — `host.openSession`
 * ohne `profile` legt keinen an. Mit `profile` trägt das SDK den Hinweis
 * (aktive Verbindung + Profil) VOR dem Resume ein.
 *
 * `keepAllProfilesScope: false` hält die Listen-Ansicht im Standard
 * (Profil-Scope); der Default `true` würde die Seitenleiste ungefragt auf
 * „Alle Profile" umschalten. Gilt für ALLE Create-Pfade (+, Projekt-Header,
 * Composer-Chip, Branch) — einmal hier statt pro Aufrufer.
 *
 * Der Intent geht durch `effectiveOpenIntent()` (v1.24.0) — bei aktivem
 * `tabs.asTabSelector` wird IMMER `in-place` erzwungen, sonst öffnet die
 * App den Klick scheinbar „daneben" (siehe Plan
 * `2026-10-06-openintent-tabs-as-selector.md`).
 */
async function openFreshSession(storedId) {
  await host.openSession(storedId, {
    intent: effectiveOpenIntent(),
    profile: ambientOwnerProfile(),
    keepAllProfilesScope: false
  })
}

/**
 * Effektiver Intent für `host.openSession` (v1.24.0).
 *
 * Drei Plugin-Aufrufer (`openFreshSession`, `wheelController.cycleNext`,
 * `TabRow.onClick → on(row, null)`) brauchen denselben Intent — und der
 * ist NICHT immer die rohe `tabs.openIntent`-Einstellung:
 *
 * - **Bei `tabs.asTabSelector = true`** erzwingen wir `in-place`. Die
 *   `:has()`-Regel blendet die native Content-Tab-Leiste nur VISUELL aus;
 *   die App selbst bekommt vom Klick mit und entscheidet bei
 *   `intent: 'stack'`/'tab' weiter, daneben/neu zu öffnen — der User
 *   sieht das als „Ersetzen stapelt trotzdem". Mit Tab-Selektor-Modus
 *   ist daneben öffnen sinnlos (es gibt keinen sichtbaren Tab, der es
 *   aufnimmt), also in-place ist die einzig sinnvolle Wahl.
 * - **Sonst** die UI-Wahl, mit Whitelist-Schutz gegen korrupte/alte
 *   persistierte Werte (jeder unbekannte String fällt auf `in-place`).
 * - **Default**: `in-place` (konsistent mit `DEFAULT_SETTINGS.tabs.openIntent`).
 *
 * Eine Quelle, drei Aufrufer — falls die App-Semantik je driftet, ist
 * dies die einzige Stelle, an der ein Remap sitzen muss.
 */
function effectiveOpenIntent() {
  const forced = !!readSetting('tabs', 'asTabSelector')

  if (forced) {
    return 'in-place'
  }

  const chosen = readSetting('tabs', 'openIntent')

  return chosen === 'stack' || chosen === 'tab' ? chosen : 'in-place'
}

/** Neue Session explizit in `cwd` starten — Projekt-Header-"+"-Button. */
async function startNewSessionInCwd(cwd, label) {
  // Eigene, bereits verankerte Session: die Draft-Pick-Übernahme darf sie nicht
  // nachträglich in ein anderes Projekt umhängen (siehe adoptComposerPickForNewSession).
  ownCreateUntil = Date.now() + 10_000

  try {
    const params = { cols: 96, source: 'desktop' }

    if (cwd) {
      params.cwd = cwd
      params.cwd_explicit = true
    }

    // Owner-Profil = das Profil des Sockets, auf dem `host.request` landet —
    // dort entsteht die Session, und genau dieses Profil muss auch der
    // Owner-Hinweis der App tragen (siehe openFreshSession). Das fokussierte
    // Session-Profil kann davon abweichen und ist KEINE Create-Quelle.
    params.profile = ambientOwnerProfile()

    const created = await host.request('session.create', params)
    const runtimeId = String(created?.session_id || '').trim()
    const createdId = String(created?.stored_session_id || runtimeId || '').trim()

    if (!createdId) {
      throw new Error('session.create lieferte keine Session-ID')
    }

    // Sitzungssicher im Projekt verankern: session.create legt die DB-Row
    // lazy an (erst beim 1. Prompt via _ensure_session_db_row), und ohne
    // `explicit_cwd` landet dort cwd=NULL → Session hängt dauerhaft unter
    // „Kein Projekt". `session.cwd.set` schreibt cwd + git_repo_root sofort
    // in die Row — derselbe Server-Pfad, den auch die Hermes-Desktop-Sidebar
    // für Workspace-Wechsel nutzt. WICHTIG: `session_id` ist hier die
    // IN-MEMORY-ID (8-stellig), nicht der 24-stellige stored_session_id;
    // _sess_nowait im Gateway schlägt genau auf diesem Feld nach.
    // Historische Notiz: v1.17.3/1.19.0 riefen `session.workspace.move` auf
    // mit `session_key` — Methode existiert im Gateway nicht, Call lief in
    // ein stummes catch{}, Zuordnung wurde nie persistiert (live in der DB
    // beobachtet: `+`-Sessions mit 30+ Turns ohne cwd/git_repo_root).
    if (params.cwd && runtimeId) {
      try {
        await host.request('session.cwd.set', { cwd: params.cwd, session_id: runtimeId })
      } catch (error) {
        // Kein harter Fehler: die Session ist bereits offen und nutzbar.
        // Nicht mehr lautlos — ein Logging-Hinweis fängt künftige Vertrags-
        // brüche im Gateway (umbenannte RPC, geänderte Param-Namen) früh ab.
        console.warn(`[${ID}] session.cwd.set nach session.create fehlgeschlagen`, error)
      }

      // Live-Overlay-Seed: die neue Session hat 0 Turns → projects.tree
      // lässt sie weg (min_message_count=1) → „Kein Projekt" bis zum ersten
      // Turn. Der Seed meldet das Zielprojekt aus dem Create-Kontext, bis
      // der Baum übernimmt (Live-Overlay-Prinzip der Desktop-Sidebar).
      const node = $projectsList
        .get()
        .find(entry => !entry.isNoProject && entry.path && (params.cwd === entry.path || params.cwd.startsWith(`${entry.path}/`)))

      if (node) {
        const seeds = $sessionProjectSeed.get()
        seeds[createdId] = { id: node.id, name: node.label, color: node.color, icon: node.icon, path: node.path, at: Date.now() }
        $sessionProjectSeed.set({ ...seeds })
      }
    }

    await openFreshSession(createdId)
    void invalidateProjectTree()
    scheduleSessionsRefresh(600)
    host.notify({
      kind: 'success',
      message: `${CTX?.i18n?.t('newSession') || 'Neue Session'}${label ? ` · ${label}` : ''}`
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
    unread: Boolean(row?.unread),
    archived: Boolean(row?.archived),
    source: String(row?.source || '').trim(),
    profile: String(row?.profile || '').trim(),
    startedAt: Number(row?.started_at || 0) * 1000,
    lastActiveAt: Number(row?.last_active || row?.lastActive || 0) * 1000,
    messageCount: Number(row?.message_count || 0),
    tokens: Number(row?.input_tokens || 0) + Number(row?.output_tokens || 0),
    costUsd: Number(row?.actual_cost_usd || row?.estimated_cost_usd || 0) || 0,
    live: Number(row?.live_message_count || 0)
  }
}

async function refreshSessions() {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    // Phase läuft mit, bevor irgendetwas awaiting passiert — die Lade-UI
    // soll den ersten Frame zeigen, nicht erst nach dem Fetch.
    if (!bootstrapDoneOnce) {
      $loadPhase.set('loading')
    }

    try {
      const limit = Math.max(10, Math.min(200, Number(readSetting('tabs', 'maxItems')) || 60))
      // REST-first: /api/sessions liefert die VOLLSTÄNDIGE Zeile (pinned,
      // unread, tokens, Kosten, last_active) — dieselbe Quelle, aus der die
      // Hermes-Sidebar ihre Status-/Kosten-Sortierung baut. Der dünne
      // session.list-RPC bleibt als Fallback für Shells ohne die Bridge
      // (Features degradieren dann sauber auf „weglassen statt 0").
      // Catalog-Build: KEINE Desktop-Bridge (Regel 8) — der Block wird
      // ausgebaut, usedRpc bleibt true und die Pane läuft über den RPC.
      let rows = []
      let usedRpc = true

      /* #full */
      const bridge = globalThis.window?.hermesDesktop

      if (bridge && typeof bridge.api === 'function') {
        try {
          const result = await bridge.api({
            path: `/api/sessions?limit=${limit}&offset=0&order=recent`,
            timeoutMs: 10_000
          })
          const raw = Array.isArray(result?.sessions) ? result.sessions : []
          rows = raw.map(normalizeRow).filter(row => row.id).sort((a, b) => (b.lastActiveAt || b.startedAt) - (a.lastActiveAt || a.startedAt))
          usedRpc = false
          $restMirror.set(true)
        } catch {
          // Bridge-Fehler → RPC-Fallback unten (kein Crash, nur dünnere Daten).
        }
      }
      /* #end */

      if (usedRpc) {
        const result = await host.request('session.list', { limit, include_hidden: false })
        const raw = Array.isArray(result?.sessions) ? result.sessions : Array.isArray(result) ? result : []
        rows = raw.map(normalizeRow).filter(row => row.id).sort((a, b) => b.startedAt - a.startedAt)
      }

      const pinned = new Set($pinnedRows.get().map(row => row.id))
      rows = rows.map(row => ({ ...row, pinned: row.pinned || pinned.has(row.id) }))

      // Gepinnte Sessions, die das Seiten-Limit verpasst haben (alt und tief
      // unten), aus dem REST-/Pin-Spiegel ergänzen — ein Pin heißt „immer
      // erreichbar", genau wie in der Desktop-Sidebar (include_pinned-Backfill).
      const seen = new Set(rows.map(row => row.id))
      const missed = $pinnedRows.get()
        .filter(row => !seen.has(row.id))
        .map(normalizeRow)
        .map(row => ({ ...row, pinned: true }))
        .filter(row => row.id)

      if (missed.length) {
        rows.push(...missed.sort((a, b) => (b.lastActiveAt || b.startedAt) - (a.lastActiveAt || a.startedAt)))
      }

      $sessions.set(rows)
      $sessionsError.set(null)
      bootstrapDoneOnce = true
      $loadPhase.set('ready')
      scheduleContextRefresh(1200)
    } catch (error) {
      $sessionsError.set(error instanceof Error ? error.message : String(error))
      $loadPhase.set('error')
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

let refreshDebounce = 0

// ─────────────────────────────────────────────────────────────────────────────
// Angepinnt-Status: `session.list` liefert KEIN `pinned` pro Zeile (der
// Gateway-RPC baut die Rows ohne die Flagge — dieselbe Wire-Lücke wie ehemals
// bei cwd). Die App selbst liest die Pins über REST `GET /api/sessions` (liefert
// `pinned: bool` je Zeile inkl. include_pinned-Backfill) und schreibt sie über
// PATCH. Wir spiegeln den Lese-Weg: einmalige Abfrage der gepinnten IDs über
// die REST-Bridge-Tür des Desktop-Renderers (nur Full-Build), gemerged in
// jede session.list-Seite. Fällt die Bridge aus (ältere Shell), bleibt
// `pinned` schlicht false — der Filter zeigt dann nichts, statt zu crashen.
// ─────────────────────────────────────────────────────────────────────────────

const $pinnedRows = atom([]) // volle REST-Rows der gepinnten Sessions (gespiegelt)
// REST-Mirror überhaupt erreichbar? (Catalog-Build: nie true — die Desktop-
// Bridge ist dort verboten; Pinned-/Archiv-Filter bleiben verborgen.)
const $restMirror = atom(false)

let pinnedRefreshInFlight = null
let pinnedSucceededAt = 0

/** Gepinnte Session-IDs über REST `GET /api/sessions` nachziehen. */
function refreshPinnedIds() {
  /* #full */
  if (pinnedRefreshInFlight) {
    return pinnedRefreshInFlight
  }

  pinnedRefreshInFlight = (async () => {
    try {
      const bridge = globalThis.window?.hermesDesktop

      if (!bridge || typeof bridge.api !== 'function') {
        return
      }

      // order=created&limit=1 hält die Seite minimal; der Endpoint verdrahtet
      // include_pinned=True serverseitig fest und fügt ALLE gepinnten Rows
      // wieder an — genau der Trick, den auch `hermes sessions pinned` nutzt.
      const result = await bridge.api({ path: '/api/sessions?limit=1&offset=0&order=created', timeoutMs: 8000 })
      const rows = (Array.isArray(result?.sessions) ? result.sessions : [])
        .filter(row => row && row.pinned === true && row.id)
        .map(row => ({ ...row, id: String(row.id) }))

      $pinnedRows.set(rows)
      pinnedSucceededAt = Date.now()
      $restMirror.set(true)
    } catch {
      // Bridge nicht da / Netzwerk — alter Stand bleibt, kein Crash.
    } finally {
      pinnedRefreshInFlight = null
    }
  })()

  return pinnedRefreshInFlight
  /* #end */
  /* #catalog-only */
  // Catalog-Build: kein REST-Door im SDK (Anfrage läuft auf #116305) —
  // der Pin-Spiegel bleibt leer, der Pinned-Filter bleibt verborgen.
  return Promise.resolve()
  /* #end */
}

function scheduleSessionsRefresh(delay = 1500) {
  window.clearTimeout(refreshDebounce)
  refreshDebounce = window.setTimeout(() => {
    void refreshSessions()
    // Der Projekt-Baum (Zuordnungs-Grundlage) läuft seinem eigenen 60-s-Takt
    // hinterher — eine frisch erstellte Session würde sonst bis zum nächsten
    // Takt in "Kein Projekt" parken. Mit nachziehen bleibt die Gruppierung
    // aktuell; der Inflight-Guard + 15-s-Mindestabstand verhindern Spam.
    if (Date.now() - projectsListSucceededAt > 15_000) {
      void refreshProjectsList()
    }
    // Angepinnt-Spiegel ebenso nachziehen (PIN-Schreibzugriffe erfolgen über
    // den SDK-Speicher der App; der REST-Flaggen-Stand braucht einen Moment).
    if (Date.now() - pinnedSucceededAt > 5_000) {
      void refreshPinnedIds()
    }
  }, delay)
}

// ─────────────────────────────────────────────────────────────────────────────
// Start-/Reconnect-Gate für den ersten Daten-Satz. Vor dem ersten Socket-Open
// wirft jeder `host.request` sofort „Hermes gateway unavailable" — der blinde
// Initial-Aufruf beim Plugin-Load verpuffte beim App-Start damit komplett:
// Fehlerbanner in der Pane + „Kein Projekt"-Gruppierung, bis der Nutzer
// manuell auf Aktualisieren klickte (der nächste reguläre Takt kam erst nach
// 30–60 s). Das Gate feuert den Initial-Satz stattdessen genau dann, wenn der
// Gateway-Socket wirklich offen ist (`host.state.gateway`, Werte
// 'idle' | 'connecting' | 'open' | 'closed' | 'error'), mit 20-s-Fallback für
// ältere Builds ohne das Atom. Danach bleibt der Listener aktiv und zieht bei
// JEDEM geschlossenen→offen-Wechsel (Standby, Backend-Neustart) die Daten
// sofort nach — kein manuelles Aktualisieren mehr nötig.
// ─────────────────────────────────────────────────────────────────────────────

const GATEWAY_BOOTSTRAP_FALLBACK_MS = 20_000
// Settle-In-Nachläufe nach dem Bootstrap: der erste `projects.tree`- und
// `pinned`-Refresh läuft parallel zu `session.list`, aber ihre Serverseite
// cached intern — die ERSTE Antwort nach einem kalten Gateway-Start ist
// gelegentlich noch nicht vollständig (Projekt-Baum leer, Pins fehlen,
// Live-Status zählt 0 Sessions). Zwei getimte Follow-ups ziehen jedes
// noch nicht gefüllte Fach einmal nach, ohne Spam: Inflight-Guard + TTL-
// Checks in jedem Refresh verhindern Doppel-Requests. Ziel: nach spätestens
// 5 s stehen Sessions, Projekte, Pins und Live-Status vollständig — der
// User muss „Aktualisieren" nicht mehr klicken.
const SETTLE_IN_DELAYS_MS = [1800, 4500]

/** Erster Daten-Satz: Sessions + Pins + Live-Status + Projekt-Baum. */
function bootstrapSessionData() {
  gatedBootstrapDone = true

  try {
    void refreshPinnedIds()
    void refreshSessions()
    void pollLiveSessions()
    void refreshProjectsList()
    pruneSessionProjectSeeds()
  } catch (error) {
    console.warn(`[${ID}] Session-Bootstrap fehlgeschlagen`, error)
  }
}

/** Zieht beim Reconnect/Resume genau das nach, was potentiell veraltet ist. */
function reconnectRefresh() {
  // Selbstheilung nach Cold-Start-Fehler (v1.24.0): War der ERSTE Daten-Satz
  // beim App-Start erfolglos (Phase „error", Store leer), läuft der Reconnect
  // wie ein echter Bootstrap — mit Lade-UI statt eingefrorenem Fehlertext.
  // Ohne diesen Zweig blieb die Pane nach einem initialen Gateway-Fehler
  // dauerhaft im error-Zustand, obwohl der Socket längst wieder offen war.
  if (!bootstrapDoneOnce || $loadPhase.get() === 'error') {
    $loadPhase.set('loading')
  }

  // Debounced Session-Liste (REST liefert pinned/unread/costs → der am
  // schnellsten „alt" wirkende Datensatz).
  scheduleSessionsRefresh(400)
  // Live-Status direkt — kein Debounce, es ist ein billiger In-Memory-Enum
  // vom Gateway und steuert Icons/Badges.
  void pollLiveSessions()
  // Projekt-Baum nur, wenn der Cache abgelaufen aussieht; ebenso Pin-Spiegel.
  if (Date.now() - projectsListSucceededAt > 10_000) {
    void refreshProjectsList()
  }
  if (Date.now() - pinnedSucceededAt > 10_000) {
    void refreshPinnedIds()
  }
}

/**
 * Nach dem Bootstrap zwei zusätzliche Nachläufe anstoßen: der erste
 * `projects.tree`/`pinned`-Refresh kann nach einem Kaltstart noch mit
 * teilweise aufgewärmtem Server-Cache zurückkommen (Projekt-Baum leer,
 * Pins fehlen). Nach 1,8 s und 4,5 s ziehen wir jeden Teil-Satz nach, der
 * noch nicht gefüllt aussieht — Session-Liste nur bei leerem Store,
 * Projekt-Baum/Pins analog. Guards + TTL-Checks in jedem Refresh fangen
 * Spam ab.
 *
 * Bekanntes, bewusstes Verhalten (v1.24.0 dokumentiert): Eine ECHT leere
 * Session-Liste (keine Sessions vorhanden) wird von diesem Nachlauf nicht
 * unterschieden von „Cache noch kalt" — der 1,8-s-/4,5-s-Tick fragt dann
 * einmal nach, erhält weiterhin leer und stellt danach nichts mehr an. Der
 * sichtbare Effekt ist ein einmaliger, stiller Doppel-Request, kein UI-
 * Flackern: `$sessions` bleibt auf `[]` und die Pane zeigt ihren normalen
 * Leerzustand. Kein Umbau nötig; falls das je messbar stört, wäre ein
 * „leer + erfolgreich geladen"-Marker (Refresh-Succeeded-Stamp ohne Rows)
 * der ehrliche Hebel.
 */
function scheduleSettleIn(ctx) {
  const setTimer = typeof ctx?.setTimeout === 'function' ? ctx.setTimeout : (fn, ms) => window.setTimeout(fn, ms)

  for (const delay of SETTLE_IN_DELAYS_MS) {
    setTimer(() => {
      try {
        if (!$sessions.get().length) {
          void refreshSessions()
        }
        if (!$projectsList.get().length) {
          void refreshProjectsList()
        }
        if (!$pinnedRows.get().length && Date.now() - pinnedSucceededAt > 2_000) {
          void refreshPinnedIds()
        }
        if (!Object.keys($liveMap.get()).length) {
          void pollLiveSessions()
        }
      } catch (error) {
        console.warn(`[${ID}] Settle-In-Nachlauf fehlgeschlagen`, error)
      }
    }, delay)
  }
}

/**
 * Initial-Bootstrap an den Gateway-Socket-Zustand koppeln.
 * @param {object} ctx Plugin-Kontext (scoped setTimeout + onDispose).
 */
function scheduleGatewayBootstrap(ctx) {
  let gatewayAtom = null

  try {
    gatewayAtom = host.state?.gateway || null
  } catch {
    gatewayAtom = null
  }

  const isOpen = () => {
    try {
      return String(gatewayAtom?.get?.() || '') === 'open'
    } catch {
      return false
    }
  }

  // Älterer SDK-Stand ohne Gateway-Atom (oder Test-Stub): bisheriges
  // Verhalten — sofort laden. Der Socket ist in dem Fall entweder schon
  // offen (Hot-Reload im laufenden Betrieb) oder es gibt ohnehin kein
  // Signal, auf das wir warten könnten.
  if (!gatewayAtom || typeof gatewayAtom.listen !== 'function') {
    bootstrapSessionData()

    return
  }

  let fired = false
  let wasOpen = isOpen()

  const run = () => {
    if (fired) {
      return
    }

    fired = true
    bootstrapSessionData()
    scheduleSettleIn(ctx)
  }

  const stopListen = gatewayAtom.listen(() => {
    const open = isOpen()

    if (open && !wasOpen) {
      if (!fired) {
        // Erstes Öffnen nach dem Load: der komplette Initial-Satz.
        run()
      } else {
        // Reconnect (Standby/Backend-Neustart): Daten sind potentiell
        // veraltet — sofort nachziehen (Debounce + Inflight-Guards
        // verhindern Spam; der Projekt-Baum/Pinned-Spiegel nur bei
        // abgelaufenem Cache). Nach dem Reconnect auch Settle-In laufen
        // lassen, denn das Backend wärmt seinen Projekt-Baum-Cache nach
        // einem Standby-Resume ebenfalls neu auf.
        reconnectRefresh()
        scheduleSettleIn(ctx)
      }
    }

    wasOpen = open
  })

  // Schon offen beim Load (Hot-Reload im laufenden Betrieb): sofort laden,
  // statt bis zum 20-s-Fallback zu warten.
  if (!fired && isOpen()) {
    run()
  }

  // Fallback: Atom vorhanden, aber es kommt nie ein `open` (kaputter Stub,
  // exotischer Route) — nach 20 s trotzdem einmal versuchen statt ewig leer.
  // ctx-scoped: räumt der Host beim Unload selbst auf, die Disposer-Rückgabe
  // muss hier nicht extra gehalten werden.
  ctx.setTimeout(run, GATEWAY_BOOTSTRAP_FALLBACK_MS)

  try {
    ctx.onDispose(() => {
      try {
        stopListen()
      } catch {
        /* Listener schon weg — egal */
      }
    })
  } catch {
    /* onDispose nicht verfügbar (alter Host) — Fallback-Timer läuft via ctx
       scoped ab; der Listener leckt dann maximal einmal pro Load. */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Kontextfenster-Info (reduziert): Prozent-Label je Zeile/Karte für LIVE-
// Sessions über den read-only RPC `session.context_breakdown` (kein Provider-
// Call, kein Prompt-Cache-Impact). Läuft nur bei eingeschalteter Option.
// ─────────────────────────────────────────────────────────────────────────────

const $ctxInfo = atom({}) // storedId -> { used, max, percent, est, at }

// Einmaliger „Fertig"-Effekt: storedId -> Zeitstempel. Der Eintrag wird
// kurz nach dem Auslösen wieder entfernt, damit die Animation genau
// einmal spielt (data-done-fx an der Zeile).
const $doneFx = atom({})

// Ordner-Größen-Cache für Projekt-Gruppen-Header. Keyed by absolutem
// Pfad (section.cwd). Wert: { bytes, fetchedAt } — bei `inflight` Promise
// wird der Race-Schutz geteilt. TTL 60 s; bei App-IPC-Fehler (Door fehlt)
// bleibt der Eintrag null und wird in der Stats-Zeile weggelassen.
const $folderSizes = atom({})
const FOLDER_SIZE_TTL_MS = 60_000
const folderSizeInflight = new Map() // path -> Promise<{ bytes, fetchedAt } | null>

async function fetchFolderSizeOnce(path) {
  /* #full */
  if (!path) {
    return null
  }

  const bridge = globalThis.window?.hermesDesktop

  if (!bridge || typeof bridge.api !== 'function') {
    return null
  }

  try {
    const result = await bridge.api({ path: '/api/getFolderSize', body: { path }, timeoutMs: 4000 })

    if (result && Number.isFinite(Number(result.bytes))) {
      return { bytes: Number(result.bytes), fetchedAt: Date.now() }
    }

    return null
  } catch {
    return null
  }
  /* #end */
  /* #catalog-only */
  // Catalog-Build: kein REST-Door im SDK — Ordnergrößen entfallen ehrlich
  // („omitted", nicht 0; der Header lässt die Stelle weg).
  return null
  /* #end */
}

/** Cache-Hit oder frischer Fetch; teilt eine Inflight-Promise unter mehreren Aufrufern. */
function ensureFolderSize(path) {
  const cached = $folderSizes.get()[path]

  if (cached && Date.now() - cached.fetchedAt < FOLDER_SIZE_TTL_MS) {
    return Promise.resolve(cached)
  }

  const existing = folderSizeInflight.get(path)

  if (existing) {
    return existing
  }

  const inflight = (async () => {
    const next = await fetchFolderSizeOnce(path)

    if (next) {
      const current = $folderSizes.get()
      $folderSizes.set({ ...current, [path]: next })
    }

    return next
  })().finally(() => {
    folderSizeInflight.delete(path)
  })

  folderSizeInflight.set(path, inflight)
  return inflight
}

let ctxRefreshTimer = 0
let ctxRefreshInFlight = false

/** Effektive Info-Dichte: 'auto' folgt der App-Einstellung (sessionListDensity). */
function effectiveInfoDensity() {
  const configured = String(readSetting('tabs', 'infoDensity') || 'auto')
  return configured === 'auto' ? String($appDensity.get() || 'compact') : configured
}

/** Kontext-Daten holen, wenn der Donut sie zeigt ODER die Dichte sie als Text nutzt. */
function contextInfoNeeded() {
  if (readSetting('tabs', 'showContext')) {
    return true
  }

  return effectiveInfoDensity() === 'detailed'
}

async function refreshContextInfo() {
  if (ctxRefreshInFlight || !contextInfoNeeded()) {
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
    const prevLive = $liveMap.get()

    for (const item of items) {
      const runtimeId = String(item?.id || '')
      const storedId = String(item?.session_key || '')
      const status = String(item?.status || 'idle')

      if (runtimeId && storedId) {
        next[runtimeId] = {
          storedId,
          status,
          at: now,
          model: String(item?.model || ''),
          lastActive: Number(item?.last_active || 0) * 1000
        }
      }
    }

    $liveMap.set(next)

    // Live-Status in Aktivitäts-Details spiegeln (Events haben Vorrang).
    const activityPrevSnapshot = $activity.get()
    const activity = { ...activityPrevSnapshot }

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

    // „Fertig"-Erkennung: Was im vorigen Poll noch beschäftigt war und
    // jetzt ruhig (oder ganz weg) ist, hat gerade abgeschlossen —
    // Aktivität sofort bereinigen (statt bis zu ~90 s TTL zu warten)
    // und den einmaligen Fertig-Effekt auslösen.
    const doneBusyStatus = status => ['waiting', 'streaming', 'working', 'starting', 'resuming'].includes(String(status))
    const busyNowIds = new Set()

    for (const [runtimeId, info] of Object.entries(next)) {
      runtimeStoredSeen.set(runtimeId, info.storedId)

      if (doneBusyStatus(info.status)) {
        busyNowIds.add(info.storedId)
      }
    }

    for (const info of Object.values(prevLive)) {
      if (doneBusyStatus(info.status) && !busyNowIds.has(info.storedId)) {
        delete activity[info.storedId]
        noteSessionDone(info.storedId)
      }
    }

    // Aktivitäts-Wechsel für die Info-Zeile stempeln (Ticker-Ausblendung).
    for (const [storedId, nextDetail] of Object.entries(activity)) {
      const previous = activityPrevSnapshot[storedId]

      if (previous && (previous.kind !== nextDetail.kind || (previous.name || '') !== (nextDetail.name || ''))) {
        stampActivityPrev(storedId, previous)
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

  // Ticker-Vorwerte nur kurz halten (Ausblend-Animation ~0,3 s).
  const prevs = $activityPrev.get()
  const fresh = {}

  for (const [storedId, info] of Object.entries(prevs)) {
    if (info && now - info.at < 30_000) {
      fresh[storedId] = info
    }
  }

  if (Object.keys(prevs).length !== Object.keys(fresh).length) {
    $activityPrev.set(fresh)
  }
}

// Zuletzt gesehene Runtime→Stored-Zuordnung: Events können eintreffen,
// kurz bevor/ nachdem der Live-Poll die Runtime führt.
const runtimeStoredSeen = new Map()

/** Event-Session (runtime) auf die gespeicherte Session id auflösen. */
function resolveStoredId(runtimeId) {
  if (!runtimeId) {
    return null
  }

  const live = $liveMap.get()[runtimeId]

  if (live?.storedId) {
    runtimeStoredSeen.set(runtimeId, live.storedId)
    return live.storedId
  }

  if (runtimeStoredSeen.has(runtimeId)) {
    return runtimeStoredSeen.get(runtimeId)
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
  const previous = activity[storedId]

  if (previous && (previous.kind !== kind || (previous.name || '') !== (name || ''))) {
    stampActivityPrev(storedId, previous)
  }

  activity[storedId] = { kind, name: name || '', at: Date.now(), from: 'event' }
  $activity.set(activity)
}

/** Vorherige Aktivität für die Ticker-Ausblendung merken. */
function stampActivityPrev(storedId, detail) {
  if (!storedId || !detail || !detail.kind) {
    return
  }

  $activityPrev.set({
    ...$activityPrev.get(),
    [storedId]: { kind: detail.kind, name: detail.name || '', at: Date.now() }
  })
}

/** Event-Aktivität nur bei echter Änderung setzen — Delta-Events
 *  (reasoning.delta, message.delta, …) würden sonst pro Frame schreiben. */
function noteEventKind(runtimeId, kind, name) {
  const storedId = resolveStoredId(runtimeId)

  if (!storedId) {
    return
  }

  const current = $activity.get()[storedId]

  if (current && current.kind === kind && (current.name || '') === (name || '')) {
    return
  }

  noteEvent(runtimeId, kind, name)
}

/** Einmaligen „Fertig"-Effekt auslösen. Dedupe ~4 s je Session; der
 *  Eintrag räumt sich nach ~1,6 s selbst weg, damit die Animation genau
 *  einmal spielt. */
function noteSessionDone(storedId) {
  if (!storedId) {
    return
  }

  const cfg = $settings.get().tabs || {}

  if ((cfg.doneFx || 'glow-wobble') === 'off') {
    return
  }

  const current = $doneFx.get()
  const at = Date.now()

  if (current[storedId] && at - current[storedId] < 4000) {
    return
  }

  $doneFx.set({ ...current, [storedId]: at })

  try {
    globalThis.setTimeout(() => {
      const entries = $doneFx.get()

      if (entries[storedId] === at) {
        const next = { ...entries }
        delete next[storedId]
        $doneFx.set(next)
      }
    }, 1600)
  } catch {
    /* Ohne Timer bleibt der Eintrag stehen — die Animation ist ohnehin
       einmalig; harmlos. */
  }
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

/** Bytes → kompakte MB/KB-Zahl (eine Nachkommastelle, Locale-unabhängig). */
function fmtBytes(bytes) {
  const n = Number(bytes)

  if (!Number.isFinite(n) || n < 0) {
    return ''
  }

  if (n < 1024) {
    return `${n} B`
  }

  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`
  }

  if (n < 1024 * 1024 * 1024) {
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** Wandelt einen Zeitstempel in „Heute HH:MM" / „Gestern" / „15. Sep" um.
 *  Verwendet die *lokale* Zeitzone des Browsers — wer woanders lebt, sieht
 *  seine eigene Zeit; Datums-Linie „Gestern" richtet sich nach Mitternacht
 *  Lokalzeit. */
function fmtRelativeDate(tsMs) {
  const stamp = Number(tsMs)

  if (!Number.isFinite(stamp) || stamp <= 0) {
    return ''
  }

  const now = new Date()
  const date = new Date(stamp)
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startYesterday = startToday - 86_400_000
  const sameYear = now.getFullYear() === date.getFullYear()

  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  if (stamp >= startToday) {
    return time
  }

  if (stamp >= startYesterday) {
    return 'Gestern'
  }

  if (sameYear) {
    return `${date.getDate()}. ${MONTH_NAMES[date.getMonth()]}`
  }

  return `${date.getDate()}. ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

// Folder-Size-Cache-Peek (synchron), damit computeSectionStats keine Promise
// zurückgeben muss. Der echte Fetch läuft in `ensureFolderSize`, angestoßen
// durch SectionHeader selbst über useEffect.
const folderSizeCache = {
  peek(path) {
    if (!path) {
      return null
    }

    const cached = $folderSizes.get()[path]

    if (cached && Number.isFinite(Number(cached.bytes))) {
      return Number(cached.bytes)
    }

    return null
  }
}

/** Pure Aggregat-Funktion für Sektions-Stat-Zeile (Detailreich). Liest drei
 *  Quellen: max(startedAt, lastActive) über enthaltene Items, Folder-Size
 *  für Projekt-Gruppen, Σ context_used/max über $ctxInfo für Live-Sessions.
 *  Gibt immer alle vier Felder zurück — null signalisiert „nicht
 *  vorhanden", nicht „0" (eine Summe von 0 wäre erfunden). */
function computeSectionStats(section, liveMap, ctxInfo) {
  const items = Array.isArray(section.items) ? section.items : []
  let modifiedAt = null

  for (const item of items) {
    const started = Number(item?.startedAt) || 0

    if (started > (modifiedAt || 0)) {
      modifiedAt = started
    }

    if (liveMap && item?.id && liveMap[item.id] && Number(liveMap[item.id].lastActive)) {
      const lastActive = Number(liveMap[item.id].lastActive)

      if (lastActive > (modifiedAt || 0)) {
        modifiedAt = lastActive
      }
    }
  }

  let tokensUsed = null
  let tokensMax = null

  if (ctxInfo) {
    for (const item of items) {
      const ctx = item?.id && ctxInfo[item.id]

      if (ctx && Number.isFinite(Number(ctx.used)) && Number.isFinite(Number(ctx.max))) {
        tokensUsed = (tokensUsed || 0) + Number(ctx.used)
        tokensMax = (tokensMax || 0) + Number(ctx.max)
      }
    }
  }

  const folderBytes = section?.kind === 'project' && section?.cwd
    ? folderSizeCache.peek(section.cwd)
    : null

  return { modifiedAt, folderBytes, tokensUsed, tokensMax }
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
  const viewCfg = settings.view || {}
  const live = $liveMap.get()
  const activity = $activity.get()
  const projectsList = $projectsList.get()

  // Status-Bucket je Zeile (App-Parität: session-dot-state reduziert
  // 'stalled'/'background' → 'working'; working umfasst alle Busy-Arten).
  const statusBucketOf = row => {
    const detail = activity[row.id]
    const runtimeEntry = Object.values(live).find(entry => entry && entry.storedId === row.id)

    if (runtimeEntry && ['waiting', 'streaming', 'working', 'starting', 'resuming'].includes(String(runtimeEntry.status))) {
      return String(runtimeEntry.status) === 'waiting' ? 'needs-input' : 'working'
    }

    if (detail && ['waiting', 'streaming', 'working', 'tool', 'thinking'].includes(detail.kind)) {
      return detail.kind === 'waiting' ? 'needs-input' : 'working'
    }

    if (row.unread) {
      return 'unread'
    }

    if (!row.messageCount) {
      return 'draft'
    }

    return 'idle'
  }

  // Sortierung innerhalb der Sektionen (view.ordering) — 'updated' fällt auf
  // lastActivityAt zurück (REST), created auf startedAt. Tokens/Kosten nur
  // mit REST-Zeilen (RPC-Fall: alle 0 → Reihenfolge bleibt erhalten).
  const orderBy = viewCfg.ordering || 'updated'
  const sortRows = items => {
    const arr = [...items]

    if (orderBy === 'created') {
      arr.sort((a, b) => b.startedAt - a.startedAt)
    } else if (orderBy === 'tokens') {
      arr.sort((a, b) => b.tokens - a.tokens || b.startedAt - a.startedAt)
    } else if (orderBy === 'cost') {
      arr.sort((a, b) => b.costUsd - a.costUsd || b.startedAt - a.startedAt)
    } else if (orderBy === 'status') {
      const rank = { 'needs-input': 0, working: 1, unread: 2, draft: 3, idle: 4 }

      arr.sort((a, b) => (rank[statusBucketOf(a)] ?? 9) - (rank[statusBucketOf(b)] ?? 9) || lastActivityAt(b, live, activity) - lastActivityAt(a, live, activity))
    } else {
      arr.sort((a, b) => lastActivityAt(b, live, activity) - lastActivityAt(a, live, activity))
    }

    return arr
  }

  // Zeilen-Filter: Status (Multi) + Projekt (Multi) — leer = alles, exakt wie
  // das Filtermenü der App (leerer Filter schränkt nicht ein).
  const statusFilter = Array.isArray(viewCfg.statusFilter) ? viewCfg.statusFilter : []
  const projectFilter = Array.isArray(viewCfg.projectFilter) ? viewCfg.projectFilter : []
  const dismissedAuto = new Set(Array.isArray(viewCfg.dismissedAuto) ? viewCfg.dismissedAuto : [])

  const filtered = rows.filter(row => {
    if (tabsCfg.hideCron && row.source === 'cron') {
      return false
    }

    if (statusFilter.length && !statusFilter.includes(statusBucketOf(row))) {
      return false
    }

    if (projectFilter.length) {
      const resolved = resolveSessionProject(row)
      const projectId = resolved ? resolved.id : '__no_project__'

      if (!projectFilter.includes(projectId)) {
        return false
      }
    }

    return true
  })

  const byId = new Map(filtered.map(row => [row.id, row]))
  const assigned = new Set()
  const sections = []

  // Angepinnte Sessions bilden IMMER die erste Sektion — wie „Pinned" in
  // Hermes Desktops Sidebar. Eine gepinnte Zeile erscheint ausschließlich
  // hier, nicht zusätzlich in Datums-/Quell-/Projekt-Gruppen. Der
  // „Angepinnt"-Schnellfilter der Filterleiste ist dafür entfallen.
  const pinnedItems = filtered.filter(row => row.pinned)
  const pinnedIds = new Set(pinnedItems.map(row => row.id))

  if (pinnedItems.length) {
    sections.push({
      key: 'pinned',
      kind: 'pinned',
      title: null,
      titleKey: 'pinnedSection',
      color: null,
      collapsed: Boolean(groupsState.collapsed['pinned']),
      items: sortRows(pinnedItems)
    })
  } else if ($dragActive.get()) {
    // Drop-Area-Modus: der User zieht gerade eine Zeile. Pinned-Sektion
    // leer rendern, damit sie als sichtbares Pin-Ziel verfügbar ist (sonst
    // kann man bei leerem Pin-Store nirgendwo hin droppen). Nach dem
    // Drag-End verschwindet die Sektion wieder, weil $dragActive=false.
    sections.push({
      key: 'pinned',
      kind: 'pinned',
      title: null,
      titleKey: 'pinnedSection',
      color: null,
      collapsed: false,
      items: [],
      isDropPlaceholder: true
    })
  }

  if (groupsCfg.enabled) {
    // v1.26.0: eine manuelle Gruppe ist jetzt ein Container über
    // `group.projectIds`. Die Section-Items sammeln weiterhin
    // Session-zu-Gruppe-Zuordnungen aus `assign`, aber ZUSÄTZLICH
    // projizieren wir pro referenziertem Projekt-Knoten einen
    // Sub-Header + dessen Items. Damit bekommt jede Gruppe mehrere
    // "Sub-Sections" vom Typ `project`, die im Render unter dem
    // Gruppen-Header verschachtelt dargestellt werden.
    const liveProjects = projectsList
    const projectById = new Map()
    for (const node of liveProjects) {
      if (node && node.id) projectById.set(node.id, node)
    }

    for (const group of groupsState.groups) {
      const key = `group:${group.id}`

      // 1) Items, die explizit per `assign` der Gruppe zugeordnet sind
      //    (Sessions ohne Projekt — die Vorgänger-Semantik bleibt).
      const directItems = []
      for (const row of filtered) {
        if (groupsState.assign[row.id] === group.id) {
          directItems.push(row)
          assigned.add(row.id)
        }
      }

      // 2) Sub-Sections für jedes referenzierte Projekt.
      const subSections = []
      const projectIds = Array.isArray(group.projectIds) ? group.projectIds : []
      for (const projectId of projectIds) {
        const node = projectById.get(projectId)
        if (node && node.isNoProject) continue // Home-Bucket zählt nicht
        const subItems = []
        if (node && node.sessionIds) {
          for (const row of filtered) {
            if (row.pinned) continue // Pinned bleibt in der Pinned-Sektion
            if (node.sessionIds.has(row.id)) {
              subItems.push(row)
              assigned.add(row.id)
            }
          }
        }
        const subKey = node ? `group:${group.id}:project:${node.id}` : `group:${group.id}:project:missing:${projectId}`
        subSections.push({
          key: subKey,
          kind: 'project',
          parentGroupId: group.id,
          projectId: node ? node.id : projectId,
          title: node ? node.label : null,
          titleKey: node ? null : 'groupProjectMissing',
          color: node ? node.color || null : null,
          icon: node ? node.icon || null : null,
          cwd: node ? node.path || '' : '',
          // Pro Projekt eigene Collapse-Aufzeichnung (optional, hier
          // globaler Key damit ein "alle ausklappen" greift).
          collapsed: Boolean(groupsState.collapsed[subKey]),
          items: sortRows(subItems),
          isProjectMissing: !node
        })
      }

      sections.push({
        key,
        kind: 'manual',
        groupId: group.id,
        title: group.name,
        titleKey: null,
        color: group.color || null,
        collapsed: Boolean(groupsState.collapsed[key]),
        items: sortRows(directItems),
        subSections
      })
    }
  }

  const rest = filtered.filter(row => !assigned.has(row.id) && !pinnedIds.has(row.id))

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
        items: sortRows(items)
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
        items: sortRows(bySource.get(source))
      })
    }
  } else if (groupsCfg.enabled && groupsCfg.autoMode === 'status' && rest.length) {
    // Status-Gruppierung (App-Parität: needs-input/working/unread/draft/idle
    // mit derselben Rangfolge wie das Sortierungs-Kriterium 'status').
    const byStatus = new Map()

    for (const row of rest) {
      const bucket = statusBucketOf(row)

      if (!byStatus.has(bucket)) {
        byStatus.set(bucket, [])
      }

      byStatus.get(bucket).push(row)
    }

    const order = ['needs-input', 'working', 'unread', 'draft', 'idle']

    for (const bucket of order) {
      const items = byStatus.get(bucket)

      if (!items || !items.length) {
        continue
      }

      const key = `auto:status:${bucket}`
      sections.push({
        key,
        kind: 'auto',
        title: null,
        titleKey: `status.${bucket}`,
        color: null,
        collapsed: Boolean(groupsState.collapsed[key]),
        items: sortRows(items)
      })
    }
  } else if (groupsCfg.enabled && groupsCfg.autoMode === 'project' && rest.length) {
    // Spiegelt Hermes Desktops eigene Projekt-Zuordnung (liveSessionProjectId):
    // explizites Projekt per längstem Ordner-Treffer (CWD ODER Git-Repo-Root),
    // sonst der Repo-Root selbst als Auto-Projekt — siehe resolveSessionProject().
    const byProject = new Map() // id -> { meta, items }

    for (const row of rest) {
      const resolved = resolveSessionProject(row)
      const bucketKey = resolved ? resolved.id : '__no_project__'

      if (!byProject.has(bucketKey)) {
        byProject.set(bucketKey, { meta: resolved, items: [] })
      }

      byProject.get(bucketKey).items.push(row)
    }

    // Solange der Projekt-Baum lädt (erstes Gate-Open ohne erfolgreichen
    // Refresh), liefert resolveSessionProject() für ALLE Zeilen null — die
    // Welt als „Kein Projekt" zu zeigen wäre falsch und liest sich als
    // „lädt ewig". Stattdessen: ALLE Zeilen in einer einzigen „Projekte
    // laden"-Sektion bündeln und KEINE Projekt-Sektionen mehr pushen.
    // Re-Trigger: sobald projectsPending() false wird, läuft buildSections()
    // erneut durch den normalen Pfad.
    if (projectsPending() && rest.length) {
      sections.push({
        key: 'projects-pending',
        kind: 'project-pending',
        titleKey: 'projectsPendingTitle',
        hintKey: 'projectsPendingHint',
        color: null,
        icon: null,
        cwd: '',
        collapsed: false,
        items: sortRows(rest)
      })

      return sections
    }

    const buckets = [...byProject.entries()].sort(([aKey, aVal], [bKey, bVal]) => {
      if (aKey === '__no_project__') return 1
      if (bKey === '__no_project__') return -1
      return String(aVal.meta?.name || '').localeCompare(String(bVal.meta?.name || ''))
    })

    for (const [bucketKey, { meta, items }] of buckets) {
      const isNoProject = bucketKey === '__no_project__'

      // Vom Nutzer ausgeblendete Auto-Projekte erscheinen nicht (App-
      // Parität: dismissAutoProject filtert aus JEDEM Projekt-Surface).
      if (!isNoProject && meta?.isAuto && dismissedAuto.has(bucketKey)) {
        continue
      }

      const key = `auto:project:${bucketKey}`
      sections.push({
        key,
        kind: 'project',
        title: isNoProject ? null : meta?.name || '',
        titleKey: isNoProject ? 'noProject' : null,
        // Übernimmt Farbe/Icon aus dem Hermes-Projekt-Datensatz (projects.list),
        // genau wie unter Projekte in Hermes Desktop selbst — siehe SectionHeader.
        // Auto-Projekte (kein projects.db-Eintrag, nur Repo-Root) haben keine.
        color: isNoProject ? null : meta?.color || null,
        icon: isNoProject ? null : meta?.icon || null,
        cwd: isNoProject ? '' : meta?.anchor || '',
        collapsed: Boolean(groupsState.collapsed[key]),
        items: sortRows(items)
      })
    }
  } else if (rest.length && (groupsCfg.showUngrouped || sections.length === 0)) {
    // „Nur angepinnt"-Modus: verschwindet der Rest komplett, bleibt die
    // Angepinnt-Sektion trotzdem sichtbar — sie wurde oben bereits gepusht.
    if (rest.length) {
      sections.push({
        key: 'ungrouped',
        kind: 'ungrouped',
        title: null,
        titleKey: 'ungrouped',
        color: null,
        collapsed: false,
        items: sortRows(rest)
      })
    }
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
  errorRetry: 'Retry',

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
  stUnread: 'Done — unread answer',
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
  tabsThemeSplit: 'Separate colours for the light theme',
  tabsThemeSplitDesc: 'On: the list & grid colours below get their own set for the light theme and switch automatically with the app theme. Off: one colour set applies to both themes.',
  tabsThemeAutoDerive: 'Derive the matching colour automatically',
  tabsThemeAutoDeriveDesc: 'When you set a colour in one theme, the matching colour for the other theme is derived (hue kept, brightness and saturation adapted) and preset — you can still adjust it freely.',
  tabsThemeEditing: 'Editing theme colours',
  tabsThemeEditingDark: 'These controls edit the DARK theme colours.',
  tabsThemeEditingLight: 'These controls edit the LIGHT theme colours.',
  tabsThemeDark: 'Dark',
  tabsThemeLight: 'Light',
  tabsThemeMode: 'Detected theme',
  tabsThemeModeDesc: 'Which theme the list & grid colours follow. Automatic follows the app; "Always dark" / "Always light" force a set — handy to preview the light colours while the app is dark.',
  tabsThemeModeAuto: 'Automatic',
  tabsThemeModeDark: 'Always dark',
  tabsThemeModeLight: 'Always light',
  tabsTitleStyle: 'Title',
  tabsTitleStyleDesc: 'None = app default colour. Solid = one colour. Gradient = two-colour fade.',
  tabsTitleStyleNone: 'None',
  tabsTitleStyleSolid: 'Solid colour',
  tabsTitleStyleGradient: 'Gradient',
  tabsTitleColor: 'Title colour',
  tabsTitleColorDesc: 'Solid title colour. Optional alpha via 8-digit hex (#RRGGBBAA).',
  tabsRowGrad: 'Row background gradient',
  tabsRowGradDesc: 'Paints session rows (list) and cards (grid) with a two-color gradient.',
  tabsRowGradFrom: 'Gradient start color',
  tabsRowGradFromDesc: 'First color of the row gradient (left/top depending on angle). Optional alpha via 8-digit hex (#RRGGBBAA).',
  tabsRowGradTo: 'Gradient end color',
  tabsRowGradToDesc: 'Second color of the row gradient. Optional alpha via 8-digit hex (#RRGGBBAA).',
  tabsRowGradAngle: 'Gradient angle',
  tabsRowGradAngleDesc: 'Direction of the gradient in degrees (0–360).',
  tabsAlignTop: 'Top-align text',
  tabsAlignTopDesc: 'Aligns the text column and meta info to the top of each row/card instead of centering them vertically.',
  tabsHoverLift: 'Lift on hover',
  tabsHoverLiftDesc: 'Rows and cards rise slightly on hover and their drop shadow deepens — the app’s tile feel.',
  tabsRowShadow: 'Row drop shadow',
  tabsRowShadowDesc: 'Selectable shadow depth under rows (list) and cards (grid).',
  tabsTitleGradFrom: 'Title gradient start',
  tabsTitleGradFromDesc: 'First color of the title gradient. Optional alpha via 8-digit hex (#RRGGBBAA).',
  tabsTitleGradTo: 'Title gradient end',
  tabsTitleGradToDesc: 'Second color of the title gradient. Optional alpha via 8-digit hex (#RRGGBBAA).',
  tabsTitleGradAngle: 'Title gradient angle',
  tabsTitleGradAngleDesc: 'Direction of the title gradient in degrees (0–360).',
  tabsSelHead: 'Selected state',
  tabsSelTint: 'Selection tint',
  tabsSelTintDesc: 'Background tint of the selected (open) session.',
  tabsSelTintStandard: 'Standard',
  tabsSelTintAccent: 'Accent',
  tabsSelTintCustom: 'Custom color',
  tabsSelColor: 'Selection color',
  tabsSelColorDesc: 'Custom tint color for the selected state. Optional alpha via 8-digit hex (#RRGGBBAA).',
  tabsSelBorder: 'Selection outline',
  tabsSelBorderDesc: 'Thin outline around the selected row (uses the selection tint).',
  tabsSelShadow: 'Selection shadow',
  tabsSelShadowDesc: 'Selectable shadow depth for the selected row/card.',
  tabsSelHover: 'Selection: hover',
  tabsSelHoverDesc: 'How the selected entry reacts to hover (deepening its tint) — identical in list and grid.',
  selHoverOff: 'Unchanged',
  selHoverSoft: 'Deepen',
  selHoverStrong: 'Strong',
  applyNow: 'Apply',
  savedNow: 'Saved',
  applyNowHint: 'Saves the settings immediately and re-applies all effects',
  colorPicker: 'Pick color',
  colorAlpha: 'Opacity in %',
  tabsLiveHead: 'Live status',
  tabsRowLive: 'Highlight active & waiting',
  tabsRowLiveDesc: 'Sessions that are working or waiting get an accent glow and a pulsing status icon — the same visual language as the tab design.',
  tabsLiveFrame: 'Live frame',
  tabsLiveFrameDesc: 'Frame for working & waiting entries: the app’s glowing ring (runs around the edge) or a static ring. Only visible with “Highlight active & waiting”.',
  liveFrameOff: 'Off',
  liveFrameRing: 'Static ring',
  liveFrameGlow: 'Glowing ring',
  tabsDoneFx: 'Completion effect',
  tabsDoneFxDesc: 'One-shot effect when a session stops working (row flash).',
  doneFxOff: 'Off',
  doneFxGlow: 'Glow',
  doneFxWobble: 'Wobble',
  doneFxGlowWobble: 'Glow + wobble',
  doneFxShine: 'Shine',
  doneFxPop: 'Pop',
  tabsDoneFxAxis: 'Wobble axis',
  tabsDoneFxAxisDesc: 'Perspective axis of the wobble (x: tilt, y: turn, z: shake).',
  doneFxAxisX: 'X (tilt)',
  doneFxAxisY: 'Y (turn)',
  doneFxAxisZ: 'Z (shake)',
  tabsDoneFxStrength: 'Wobble strength',
  tabsDoneFxStrengthDesc: 'Amplitude of the wobble effect.',
  doneFxSubtle: 'Subtle',
  doneFxMedium: 'Medium',
  doneFxStrong: 'Strong',
  tabsShowContext: 'Context window (compact)',
  tabsShowContextDesc: 'Compact percent label per row/card for live sessions (read-only context breakdown; no provider call). Turns amber above 70 % and red above 90 %.',
  tabsCtxPie: 'Context window as pie',
  tabsCtxPieDesc: 'Shows the context value on top of a small pie chart (the value keeps a text shadow for readability). Off = plain percent label.',
  tabsCtxStyle: 'Context style',
  tabsCtxStyleDesc: 'Donut = classic ring with the percent inside. Bar = minimalist horizontal fill in text height (no number, tooltip stays).',
  tabsCtxStyleDonut: 'Donut',
  tabsCtxStyleBar: 'Bar',
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
  tabsOpenIntentForcedNote: 'Tab selector is on — clicks always replace the current chat.',
  tabsAsTabSelector: 'Use list/grid as the tab selector',
  tabsAsTabSelectorDesc: 'Hides the native session tab strip in the content area — the list/grid already covers switching between open sessions. Affects every pane that carries session tabs.',
  tabsMaxItems: 'Max sessions',
  tabsMaxItemsDesc: 'Upper limit of sessions listed.',
  tabsMaxVisible: 'Max visible entries',
  tabsMaxVisibleDesc: 'Per group: hide everything beyond this many sessions behind a "Show more" button. 0 = show all.',
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
  groupsAutoProject: 'By project folder',
  groupsHeaderDensity: 'Header density',
  groupsHeaderDensityDesc: 'How much a collapsible section header shows: Comfortable is bigger & bolder with the project folder as a subtext line; Detailed adds pinned/active counts too.',
  groupsNameSize: 'Header title size (px)',
  groupsNameSizeDesc: 'Font size of project and group header titles. Default 10px — matching the session titles.',
  groupsNameCaps: 'Header titles in capitals',
  groupsNameCapsDesc: 'Renders project and group header titles in uppercase letters.',
  headerDensityCompact: 'Compact',
  headerDensityComfortable: 'Comfortable',
  headerDensityDetailed: 'Detailed',
  groupFactsPinned: n => `${n} pinned`,
  groupFactsBusy: n => `${n} active`,
  groupStat2Modified: stamp => `Last change: ${stamp}`,
  groupStat2FolderSize: bytes => `Folder: ${bytes}`,
  groupStat2Tokens: ({ used, max, pct }) => `Tokens: ${used} / ${max} · ${pct}%`,
  viewOptions: 'View options',
  viewOptionsGrouping: 'Grouping',
  viewOptionsDensity: 'Header density',
  groupsStackStyle: 'Stack style (collapsed)',
  groupsStackStyleDesc: 'Look of a collapsed group: spine, fanned cards, or a pill.',
  stackSpine: 'Spine',
  stackFanned: 'Fanned',
  stackPill: 'Pill',
  groupsShowUngrouped: 'Show "Ungrouped" section',
  groupsShowUngroupedDesc: 'Show the ungrouped bucket while automatic grouping is off.',
  groupsHint: 'Manage groups via right-click on a tab or a group header. Drag & drop moves sessions into groups.',
  noProject: 'No project',
  newSessionHere: 'New session in this project',
  groupProjectsLabel: 'Projects in this group',
  groupProjectsEmpty: 'Pick at least one project — the group needs at least one to make sense.',
  groupNoProjectsAvailable: 'No projects available yet. Create a project first, then assign it here.',
  groupAddProject: ({ group, project }) => `„${project}" added to group „${group}"`,
  groupInOtherGroupTag: ({ name }) => `in „${name}"`,
  groupProjectInOtherGroup: ({ name }) => `Currently in group „${name}" — moving it here removes it from there.`,
  groupEmpty: 'Empty group — drop a session here to add its project, or edit the group to pick projects.',
  dropHereHint: label => `→ Move to "${label}"`,
  groupProjectMissing: 'Project not available',
  groupProjectMissingHint: 'This project no longer exists — it was removed or renamed.',
  groupProjectMissingRemove: 'Remove from group',
  groupMigrated: ({ group, project }) => `Group „${group}" converted to project „${project}"`,
  groupMigrateFailed: ({ group }) => `Group „${group}" could not be migrated`,
  pinnedSection: 'Pinned',
  pinnedSectionTip: 'Pinned sessions — drop here to pin',
  pinnedDropHint: 'Drop here to pin',
  dropPinHint: () => '→ Pin',
  unpinAll: 'Unpin all',

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
  aboutResetAll: 'Reset everything',
  aboutResetAllDesc: 'Resets all options AND deletes manual groups, project assignments and the composer pick. Sessions themselves stay untouched.',
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
  paneCountFiltered: (n, shown) => `${shown} / ${n} sessions`,
  showMore: n => `Show more (${n})`,
  showLess: 'Show less',
  filterPlaceholder: 'Search sessions…',
  filterClear: 'Clear search',
  filterAll: 'All',
  filterPinned: 'Pinned',
  filterActive: 'Active',
  filterEmpty: 'No sessions match this filter',
  filterEmptyHint: 'Try a different search term or quick filter.',
  filterArchived: 'Archived',
  filterArchiveEmpty: 'No archived sessions',
  filterArchiveEmptyHint: 'Archived sessions appear here after you archive them.',

  // Loading phase (gateway gate → first data)
  loadingTitle: 'Loading sessions…',
  loadingGateTitle: 'Waiting for the gateway…',
  loadingGateHint: 'As soon as the gateway shows the sessions, they and the projects appear here automatically.',
  loadingHint: 'Sessions and projects are being fetched right now.',

  // View options menu (parity with the Hermes sessions filter menu)
  viewOptionsOrdering: 'Sort by',
  viewOptionsFilters: 'Filters',
  viewOptionsFilterStatus: 'Status',
  viewOptionsFilterProject: 'Project',
  viewOptionsRowMeta: 'Row details',
  viewOptionsActions: 'Actions',
  orderUpdated: 'Last activity',
  orderCreated: 'Created',
  orderStatus: 'Status',
  orderTokens: 'Tokens',
  orderCost: 'Cost',
  statusNeedsInput: 'Needs input',
  statusWorking: 'Working',
  statusUnread: 'Unread',
  statusDraft: 'Draft',
  statusIdle: 'Idle',
  rowMetaTokens: 'Token count',
  rowMetaCost: 'Cost',
  rowMetaProfile: 'Profile',
  actionCollapseAll: 'Collapse all',
  actionExpandAll: 'Expand all',
  actionMarkAllRead: 'Mark all as read',
  actionMarkAllReadDone: n => `${n} marked as read`,
  actionNoUnread: 'No unread sessions',
  projectsAll: 'All projects',
  projectsNoProject: 'No project',

  // Project management
  newProject: 'New project',
  projEdit: 'Edit project',
  projName: 'Name',
  projNamePlaceholder: 'e.g. Customer portal',
  projFolders: 'Folders',
  projAddFolder: 'Link folder',
  projPickFolder: 'Choose folder',
  projPickUnavailable: 'Folder picker not available',
  projRemoveFolder: 'Unlink',
  projMakePrimary: 'Make primary',
  projPrimary: 'primary',
  projColor: 'Color',
  projCreate: 'Create project',
  projSave: 'Save',
  projCancel: 'Cancel',
  projDelete: 'Delete project',
  projDeleteConfirmTitle: 'Delete project?',
  projDeleteConfirmBody: 'The project entry is removed — files and sessions stay untouched.',
  projReveal: 'Reveal in file manager',
  projRevealUnavailable: 'File manager not available',
  projCopyPath: 'Copy path',
  projSetActive: 'Set as active project',
  projDismissAuto: 'Hide auto project',
  projUseActive: 'Set active after creating',
  projCreated: 'Project created',
  projSaved: 'Project saved',
  projDeleted: 'Project deleted',
  projNeedName: 'Please enter a name',
  projNeedFolder: 'Link at least one folder',
  projRename: 'Rename',
  projLinkFolder: 'Link folder',
  archRestore: 'Restore',

  // Projects-pending section (project tree still loading)
  projectsPendingTitle: 'Projects are loading…',
  projectsPendingHint: 'Sessions appear immediately; project grouping follows right after.',

  // Token/cost row meta
  metaTokens: n => `${n} tokens`,
  metaCost: usd => `$${usd}`,

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
  noProjectAnchor: 'New session has no project anchor — pick a project in the header to anchor it.',
  composerProject: 'Project',
  composerProjectNone: 'No project (Home)',
  composerProjectNoneHint: 'Home has no working folder — pick a project to anchor a draft.',
  composerProjectMenuHint: 'Target project for the next message',
  composerProjectPickToast: 'No projects yet — create one in the sessions pane.',
  composerProjectRehomeOk: 'Project set',
  composerProjectRehomeFail: 'Project could not be set — please try again.',
  composerProjectHomeSessionHint: 'An existing session cannot move to Home.',
  composerProjectPill: 'Project pill in composer',
  composerProjectPillDesc: 'Shows the target project above the input field and lets you switch it before the first message (new session) or re-home the current session.',
  moveSessionNotLive: 'Assignment is visible — permanent only after the session is opened.',
  viewSwitch: 'Switch view (list/grid)',
  navAppNewSession: 'New session',
  navAppCapabilities: 'Skills',
  navAppMessaging: 'Messaging',
  navAppArtifacts: 'Artifacts',
  navAppCron: 'Scheduled jobs',
  navAppKanban: 'Kanban',
  navStatusRunning: count => `running: ${count}`,
  navStatusScheduled: count => `scheduled: ${count}`,
  navStatusBlocked: count => `blocked: ${count}`,
  navStatusError: count => `error: ${count}`,
  navStatusReview: count => `review: ${count}`,
  navStatusReady: count => `ready: ${count}`,
  navStatusPaused: count => `paused: ${count}`,
  tabsView: 'View',
  tabsViewDesc: 'Show sessions as a compact list or as grid cards.',
  tabsAppNav: 'App quick-start row',
  tabsAppNavDesc: 'Icon buttons for New session, Skills, Messaging, Artifacts, Scheduled jobs and Kanban above the toolbar. Wraps into more rows when the pane is narrow.',
  tabsViewList: 'List',
  tabsViewGrid: 'Grid',
  tabsGridMin: 'Grid: card width (px)',
  tabsGridMinDesc: 'Minimum width of a grid card; columns fill the pane automatically.',
  tabsGridGap: 'Grid: gap (px)',
  tabsGridGapDesc: 'Space between grid cards.',
  tabsTextSize: 'Text size (%)',
  tabsTextSizeDesc: 'Scales session row text in list and grid. 100% = 10px titles.',
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
  tabsInfoDensityDesc: 'How much context each entry shows — like Hermes Desktop. Comfortable: bigger title, more air, plus model and last-active when known. Detailed: also the preview line and context usage. Follow Hermes mirrors the app setting live.',
  infoDensityAuto: 'Follow Hermes',
  infoDensityCompact: 'Compact',
  infoDensityComfortable: 'Comfortable',
  infoDensityDetailed: 'Detailed',
  metaMessages: n => `${n} messages`,
  metaToolCalls: n => `${n} tool calls`,
  metaLastActive: age => `last active ${age}`,
  metaContextShort: pct => `context ${pct}%`,
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
  personalPaneSurface: 'Pane surface',
  personalPaneSurfaceDesc: 'Background of the Session Flow pane. Native = the same color as the built-in Sessions sidebar (Hermes default). Chat = chat color (previous look). None = no own fill.',
  personalPaneSurfaceNative: 'Native sidebar',
  personalPaneSurfaceChat: 'Chat',
  personalPaneSurfaceNone: 'None',
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
  errorRetry: 'Erneut versuchen',

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

  stThinking: 'Denkt nach…',
  stStreaming: 'Schreibt…',
  stTool: 'Tool läuft',
  stWorking: 'Arbeitet…',
  stWaiting: 'Wartet auf Antwort',
  stDone: 'Fertig',
  stUnread: 'Fertig — Antwort ungesehen',
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
  tabsThemeSplit: 'Eigene Farben fürs Light-Theme',
  tabsThemeSplitDesc: 'An: die Liste-&-Grid-Farben unten haben fürs Light-Theme einen eigenen Satz und schalten mit dem App-Theme automatisch um. Aus: ein Satz gilt für beide Themes.',
  tabsThemeAutoDerive: 'Gegenfarbe automatisch ableiten',
  tabsThemeAutoDeriveDesc: 'Beim Setzen einer Farbe im einen Theme wird die passende Farbe fürs andere Theme abgeleitet (Farbton bleibt, Helligkeit und Sättigung angepasst) und vorbelegt — weiterhin frei änderbar.',
  tabsThemeEditing: 'Farben bearbeiten für Theme',
  tabsThemeEditingDark: 'Diese Controls bearbeiten die DARK-Theme-Farben.',
  tabsThemeEditingLight: 'Diese Controls bearbeiten die LIGHT-Theme-Farben.',
  tabsThemeDark: 'Dunkel',
  tabsThemeLight: 'Hell',
  tabsThemeMode: 'Erkanntes Theme',
  tabsThemeModeDesc: 'Welchem Theme die Liste-&-Grid-Farben folgen. Automatisch folgt der App; „Immer Dunkel“/„Immer Hell“ erzwingen einen Satz — praktisch, um die Hell-Farben in einer dunklen App zu prüfen.',
  tabsThemeModeAuto: 'Automatisch',
  tabsThemeModeDark: 'Immer Dunkel',
  tabsThemeModeLight: 'Immer Hell',
  tabsTitleStyle: 'Titel',
  tabsTitleStyleDesc: 'Kein = App-Standardfarbe. Einfarbig = eine Farbe. Verlauf = Zwei-Farben-Übergang.',
  tabsTitleStyleNone: 'Kein',
  tabsTitleStyleSolid: 'Einfarbig',
  tabsTitleStyleGradient: 'Verlauf',
  tabsTitleColor: 'Titelfarbe',
  tabsTitleColorDesc: 'Einfarbige Titelfarbe. Optional Alpha per 8-stelligem Hex (#RRGGBBAA).',
  tabsRowGrad: 'Zeilen-Hintergrund als Verlauf',
  tabsRowGradDesc: 'Färbt Session-Zeilen (Liste) und Karten (Grid) mit einem Zwei-Farben-Verlauf.',
  tabsRowGradFrom: 'Verlauf Startfarbe',
  tabsRowGradFromDesc: 'Erste Farbe des Zeilen-Verlaufs (links/oben je nach Winkel). Optional Alpha per 8-stelligem Hex (#RRGGBBAA).',
  tabsRowGradTo: 'Verlauf Endfarbe',
  tabsRowGradToDesc: 'Zweite Farbe des Zeilen-Verlaufs. Optional Alpha per 8-stelligem Hex (#RRGGBBAA).',
  tabsRowGradAngle: 'Verlaufswinkel',
  tabsRowGradAngleDesc: 'Richtung des Verlaufs in Grad (0–360).',
  tabsAlignTop: 'Text oben ausrichten',
  tabsAlignTopDesc: 'Richtet Text-Spalte und Meta-Infos oben in Zeile/Karte aus, statt sie vertikal zu zentrieren.',
  tabsHoverLift: 'Anhebung bei Hover',
  tabsHoverLiftDesc: 'Zeilen und Karten heben sich beim Überfahren leicht an; der Schlagschatten wird tiefer — die Kachel-Optik der App.',
  tabsRowShadow: 'Zeilen-Schlagschatten',
  tabsRowShadowDesc: 'Auswählbare Schattenstärke unter Zeilen (Liste) und Karten (Grid).',
  tabsTitleGradFrom: 'Titel Verlauf-Start',
  tabsTitleGradFromDesc: 'Erste Farbe des Titel-Verlaufs. Optional Alpha per 8-stelligem Hex (#RRGGBBAA).',
  tabsTitleGradTo: 'Titel Verlauf-Ende',
  tabsTitleGradToDesc: 'Zweite Farbe des Titel-Verlaufs. Optional Alpha per 8-stelligem Hex (#RRGGBBAA).',
  tabsTitleGradAngle: 'Titel Verlaufswinkel',
  tabsTitleGradAngleDesc: 'Richtung des Titel-Verlaufs in Grad (0–360).',
  tabsSelHead: 'Auswahl-Zustand',
  tabsSelTint: 'Auswahl-Tönung',
  tabsSelTintDesc: 'Hintergrund-Tönung der ausgewählten (geöffneten) Session.',
  tabsSelTintStandard: 'Standard',
  tabsSelTintAccent: 'Akzent',
  tabsSelTintCustom: 'Eigene Farbe',
  tabsSelColor: 'Auswahl-Farbe',
  tabsSelColorDesc: 'Eigene Tönungsfarbe für den Auswahl-Zustand. Optional Alpha per 8-stelligem Hex (#RRGGBBAA).',
  tabsSelBorder: 'Auswahl-Kontur',
  tabsSelBorderDesc: 'Dünne Kontur um die ausgewählte Zeile (nutzt die Auswahl-Tönung).',
  tabsSelShadow: 'Auswahl-Schatten',
  tabsSelShadowDesc: 'Auswählbare Schattenstärke für die ausgewählte Zeile/Karte.',
  tabsSelHover: 'Auswahl: Hover',
  tabsSelHoverDesc: 'Wie der ausgewählte Eintrag auf Hover reagiert (Tönung vertiefen) — identisch in Liste und Grid.',
  selHoverOff: 'Unverändert',
  selHoverSoft: 'Verstärken',
  selHoverStrong: 'Stark',
  applyNow: 'Übernehmen',
  savedNow: 'Gespeichert',
  applyNowHint: 'Speichert die Einstellungen sofort und wendet alle Effekte neu an',
  colorPicker: 'Farbe wählen',
  colorAlpha: 'Deckkraft in %',
  tabsLiveHead: 'Live-Status',
  tabsRowLive: 'Aktiv & Wartend hervorheben',
  tabsRowLiveDesc: 'Arbeitende oder wartende Sessions erhalten einen Akzent-Glow und ein pulsierendes Status-Icon — die gleiche Bildsprache wie im Tab-Design.',
  tabsLiveFrame: 'Live-Rahmen',
  tabsLiveFrameDesc: 'Rahmen für arbeitende & wartende Einträge: der glühende Ring der App (läuft um den Rand) oder ein statischer Ring. Sichtbar mit „Aktiv & Wartend hervorheben“.',
  liveFrameOff: 'Aus',
  liveFrameRing: 'Statischer Ring',
  liveFrameGlow: 'Glühender Ring',
  tabsDoneFx: 'Fertig-Effekt',
  tabsDoneFxDesc: 'Einmaliger Effekt, wenn eine Session fertig wird (kurzes Aufleuchten der Zeile).',
  doneFxOff: 'Aus',
  doneFxGlow: 'Aufglühen',
  doneFxWobble: 'Wackeln',
  doneFxGlowWobble: 'Aufglühen + Wackeln',
  doneFxShine: 'Glanzstreifen',
  doneFxPop: 'Pop',
  tabsDoneFxAxis: 'Wackel-Achse',
  tabsDoneFxAxisDesc: 'Perspektiv-Achse des Wackelns (X: kippen, Y: drehen, Z: rütteln).',
  doneFxAxisX: 'X (kippen)',
  doneFxAxisY: 'Y (drehen)',
  doneFxAxisZ: 'Z (rütteln)',
  tabsDoneFxStrength: 'Wackel-Stärke',
  tabsDoneFxStrengthDesc: 'Amplitude des Wackel-Effekts.',
  doneFxSubtle: 'Dezent',
  doneFxMedium: 'Mittel',
  doneFxStrong: 'Stark',
  tabsShowContext: 'Kontextfenster (kompakt)',
  tabsShowContextDesc: 'Kompaktes Prozent-Label je Zeile/Karte für Live-Sessions (read-only Context-Breakdown; kein Provider-Call). Ab 70 % bernstein, ab 90 % rot.',
  tabsCtxPie: 'Kontextfenster als Torten-Diagramm',
  tabsCtxPieDesc: 'Zeigt den Kontextwert über einem kleinen Torten-Diagramm (der Wert behält einen Text-Schatten für Lesbarkeit). Aus = reines Prozent-Label.',
  tabsCtxStyle: 'Kontext-Stil',
  tabsCtxStyleDesc: 'Donut = klassischer Ring mit Prozentzahl in der Mitte. Bar = minimalistische horizontale Füll-Leiste in Schrifthöhe (ohne Zahl, Tooltip bleibt).',
  tabsCtxStyleDonut: 'Donut',
  tabsCtxStyleBar: 'Bar',
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
  tabsOpenIntentForcedNote: 'Tab-Selektor ist aktiv — Klicks ersetzen immer den aktuellen Chat.',
  tabsAsTabSelector: 'Liste/Grid als Tab-Selektor nutzen',
  tabsAsTabSelectorDesc: 'Blendet die native Session-Tab-Leiste im Content-Bereich aus — die Liste/das Grid deckt das Umschalten zwischen offenen Sessions schon ab. Betrifft jede Pane, die Session-Tabs trägt.',
  tabsMaxItems: 'Max. Sessions',
  tabsMaxItemsDesc: 'Obergrenze der aufgelisteten Sessions.',
  tabsMaxVisible: 'Max. sichtbare Einträge',
  tabsMaxVisibleDesc: 'Je Gruppe: alles über dieser Anzahl verschwindet hinter „Mehr anzeigen". 0 = alle anzeigen.',
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
  groupsAutoProject: 'Nach Projekt-Ordner',
  groupsHeaderDensity: 'Kopfzeilen-Dichte',
  groupsHeaderDensityDesc: 'Wie viel eine einklappbare Sektions-Kopfzeile zeigt: Komfortabel ist größer & stärker mit dem Projekt-Ordner als Subzeile; Detailreich ergänzt außerdem angepinnt/aktiv-Kennzahlen.',
  groupsNameSize: 'Kopfzeilen-Titelgröße (px)',
  groupsNameSizeDesc: 'Schriftgröße der Projekt- und Gruppen-Kopfzeilen-Titel. Standard 10px — gleichauf mit den Session-Titeln.',
  groupsNameCaps: 'Kopfzeilen in Großbuchstaben',
  groupsNameCapsDesc: 'Stellt Projekt- und Gruppen-Kopfzeilen-Titel in Großbuchstaben dar.',
  headerDensityCompact: 'Kompakt',
  headerDensityComfortable: 'Komfortabel',
  headerDensityDetailed: 'Detailreich',
  groupFactsPinned: n => `${n} angepinnt`,
  groupFactsBusy: n => `${n} aktiv`,
  groupStat2Modified: stamp => `Letzte Änderung: ${stamp}`,
  groupStat2FolderSize: bytes => `Ordner: ${bytes}`,
  groupStat2Tokens: ({ used, max, pct }) => `Tokens: ${used} / ${max} · ${pct}%`,
  viewOptions: 'Ansichtsoptionen',
  viewOptionsGrouping: 'Gruppierung',
  viewOptionsDensity: 'Kopfzeilen-Dichte',
  groupsStackStyle: 'Stapel-Stil (eingeklappt)',
  groupsStackStyleDesc: 'Optik einer eingeklappten Gruppe: Rücken, gefächerte Karten oder Pille.',
  stackSpine: 'Rücken',
  stackFanned: 'Gefächert',
  stackPill: 'Pille',
  groupsShowUngrouped: '„Nicht gruppiert"-Bereich zeigen',
  groupsShowUngroupedDesc: 'Zeigt den Bereich „Nicht gruppiert", solange die Auto-Gruppierung aus ist.',
  groupsHint: 'Gruppen verwaltest du per Rechtsklick auf einen Tab oder die Gruppen-Überschrift. Ziehen & Ablegen sortiert Sessions ein.',
  noProject: 'Kein Projekt',
  newSessionHere: 'Neue Session in diesem Projekt',
  groupProjectsLabel: 'Projekte in dieser Gruppe',
  groupProjectsEmpty: 'Mindestens ein Projekt wählen — eine Gruppe ohne Projekte macht keinen Sinn.',
  groupNoProjectsAvailable: 'Noch keine Projekte vorhanden. Lege zuerst ein Projekt an und ordne es hier zu.',
  groupAddProject: ({ group, project }) => `„${project}" zur Gruppe „${group}" hinzugefügt`,
  groupInOtherGroupTag: ({ name }) => `in „${name}"`,
  groupProjectInOtherGroup: ({ name }) => `Aktuell in Gruppe „${name}" — beim Hinzufügen hier wird es dort entfernt.`,
  groupEmpty: 'Leere Gruppe — Session hier ablegen, um ihr Projekt hinzuzufügen, oder Gruppe bearbeiten.',
  dropHereHint: label => `→ Nach „${label}" verschieben`,
  groupProjectMissing: 'Projekt nicht verfügbar',
  groupProjectMissingHint: 'Dieses Projekt existiert nicht mehr — es wurde entfernt oder umbenannt.',
  groupProjectMissingRemove: 'Aus Gruppe entfernen',
  groupMigrated: ({ group, project }) => `Gruppe „${group}" auf Projekt „${project}" umgestellt`,
  groupMigrateFailed: ({ group }) => `Gruppe „${group}" konnte nicht migriert werden`,
  pinnedSection: 'Angepinnt',
  pinnedSectionTip: 'Angepinnte Sessions — hier ablegen zum Anpinnen',
  pinnedDropHint: 'Hier ablegen zum Anpinnen',
  dropPinHint: () => '→ Anpinnen',
  unpinAll: 'Alle lösen',

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
  aboutResetAll: 'Alles zurücksetzen',
  aboutResetAllDesc: 'Setzt alle Optionen zurück UND löscht manuelle Gruppen, Projekt-Zuordnungen und den Composer-Pick. Die Sessions selbst bleiben unberührt.',
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
  paneCountFiltered: (n, shown) => `${shown} / ${n} Sessions`,
  showMore: n => `Mehr anzeigen (${n})`,
  showLess: 'Weniger anzeigen',
  filterPlaceholder: 'Sessions durchsuchen…',
  filterClear: 'Suche löschen',
  filterAll: 'Alle',
  filterPinned: 'Angepinnt',
  filterActive: 'Aktiv',
  filterEmpty: 'Keine Sessions passen zu diesem Filter',
  filterEmptyHint: 'Anderen Suchbegriff oder Schnellfilter versuchen.',
  filterArchived: 'Archiv',
  filterArchiveEmpty: 'Keine archivierten Sessions',
  filterArchiveEmptyHint: 'Archivierte Sessions erscheinen hier, sobald du sie archivierst.',

  // Lade-Phase (Gateway-Gate → erste Daten)
  loadingTitle: 'Sessions werden geladen…',
  loadingGateTitle: 'Warte auf das Gateway…',
  loadingGateHint: 'Sobald das Gateway die Sessions anzeigt, erscheinen sie samt Projekten hier automatisch.',
  loadingHint: 'Sessions und Projekte werden gerade geladen.',

  // Ansichtsoptionen (Parität zum Filtermenü der Hermes-Sessions-Ansicht)
  viewOptionsOrdering: 'Sortieren nach',
  viewOptionsFilters: 'Filter',
  viewOptionsFilterStatus: 'Status',
  viewOptionsFilterProject: 'Projekt',
  viewOptionsRowMeta: 'Zeilen-Details',
  viewOptionsActions: 'Aktionen',
  orderUpdated: 'Letzte Aktivität',
  orderCreated: 'Erstellt',
  orderStatus: 'Status',
  orderTokens: 'Tokens',
  orderCost: 'Kosten',
  statusNeedsInput: 'Braucht Eingabe',
  statusWorking: 'Läuft',
  statusUnread: 'Ungelesen',
  statusDraft: 'Entwurf',
  statusIdle: 'Ruhend',
  rowMetaTokens: 'Token-Anzahl',
  rowMetaCost: 'Kosten',
  rowMetaProfile: 'Profil',
  actionCollapseAll: 'Alle einklappen',
  actionExpandAll: 'Alle ausklappen',
  actionMarkAllRead: 'Alle als gelesen markieren',
  actionMarkAllReadDone: n => `${n} als gelesen markiert`,
  actionNoUnread: 'Keine ungelesenen Sessions',
  projectsAll: 'Alle Projekte',
  projectsNoProject: 'Kein Projekt',

  // Projekt-Verwaltung
  newProject: 'Neues Projekt',
  projEdit: 'Projekt bearbeiten',
  projName: 'Name',
  projNamePlaceholder: 'z. B. Kundenportal',
  projFolders: 'Ordner',
  projAddFolder: 'Ordner verknüpfen',
  projPickFolder: 'Ordner wählen',
  projPickUnavailable: 'Ordnerauswahl nicht verfügbar',
  projRemoveFolder: 'Verknüpfung lösen',
  projMakePrimary: 'Als primär festlegen',
  projPrimary: 'primär',
  projColor: 'Farbe',
  projCreate: 'Projekt erstellen',
  projSave: 'Speichern',
  projCancel: 'Abbrechen',
  projDelete: 'Projekt löschen',
  projDeleteConfirmTitle: 'Projekt löschen?',
  projDeleteConfirmBody: 'Der Projekt-Eintrag wird entfernt — Dateien und Sessions bleiben unberührt.',
  projReveal: 'Im Dateimanager anzeigen',
  projRevealUnavailable: 'Dateimanager nicht verfügbar',
  projCopyPath: 'Pfad kopieren',
  projSetActive: 'Als aktives Projekt festlegen',
  projDismissAuto: 'Auto-Projekt ausblenden',
  projUseActive: 'Nach dem Erstellen aktiv setzen',
  projCreated: 'Projekt erstellt',
  projSaved: 'Projekt gespeichert',
  projDeleted: 'Projekt gelöscht',
  projNeedName: 'Bitte einen Namen eingeben',
  projNeedFolder: 'Mindestens einen Ordner verknüpfen',
  projRename: 'Umbenennen',
  projLinkFolder: 'Ordner verknüpfen',
  archRestore: 'Wiederherstellen',

  // Projekte-laden-Sektion (Projekt-Baum lädt noch)
  projectsPendingTitle: 'Projekte werden geladen…',
  projectsPendingHint: 'Sessions erscheinen sofort; die Projekt-Gruppierung folgt unmittelbar.',

  // Token-/Kosten-Zeilen-Meta
  metaTokens: n => `${n} Tokens`,
  metaCost: usd => `${usd} $`,

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
  noProjectAnchor: 'Neue Session ohne Projekt-Anker — bitte Projekt in der Kopfzeile wählen.',
  composerProject: 'Projekt',
  composerProjectNone: 'Kein Projekt (Home)',
  composerProjectNoneHint: 'Home hat keinen Arbeitsordner — für einen Draft bitte ein Projekt wählen.',
  composerProjectMenuHint: 'Ziel-Projekt für die nächste Eingabe',
  composerProjectPickToast: 'Noch keine Projekte — im Sessions-Pane anlegen.',
  composerProjectRehomeOk: 'Projekt gesetzt',
  composerProjectRehomeFail: 'Projekt konnte nicht gesetzt werden — bitte erneut versuchen.',
  composerProjectHomeSessionHint: 'Eine bestehende Session kann nicht nach Home verschoben werden.',
  composerProjectPill: 'Projekt-Pill im Composer',
  composerProjectPillDesc: 'Zeigt das Ziel-Projekt über dem Eingabefeld und erlaubt den Wechsel vor der ersten Eingabe (neue Session) bzw. das Verschieben der aktuellen Session.',
  moveSessionNotLive: 'Zuordnung sichtbar — dauerhaft erst nach dem Öffnen der Session.',
  viewSwitch: 'Ansicht wechseln (Liste/Grid)',
  navAppNewSession: 'Neue Session',
  navAppCapabilities: 'Fähigkeiten',
  navAppMessaging: 'Messaging',
  navAppArtifacts: 'Artefakte',
  navAppCron: 'Geplante Jobs',
  navAppKanban: 'Kanban',
  navStatusRunning: count => `läuft: ${count}`,
  navStatusScheduled: count => `geplant: ${count}`,
  navStatusBlocked: count => `blockiert: ${count}`,
  navStatusError: count => `Fehler: ${count}`,
  navStatusReview: count => `Review: ${count}`,
  navStatusReady: count => `bereit: ${count}`,
  navStatusPaused: count => `pausiert: ${count}`,
  tabsView: 'Ansicht',
  tabsViewDesc: 'Sessions als kompakte Liste oder als Grid-Karten anzeigen.',
  tabsAppNav: 'App-Schnellstart-Zeile',
  tabsAppNavDesc: 'Icon-Buttons für Neue Session, Fähigkeiten, Messaging, Artefakte, Geplante Jobs und Kanban über der Toolbar. Bricht bei schmalen Panes in weitere Zeilen um.',
  tabsViewList: 'Liste',
  tabsViewGrid: 'Grid',
  tabsGridMin: 'Grid: Kartenbreite (px)',
  tabsGridMinDesc: 'Mindestbreite einer Karte; die Spalten füllen die Pane automatisch.',
  tabsGridGap: 'Grid: Abstand (px)',
  tabsGridGapDesc: 'Abstand zwischen den Karten.',
  tabsTextSize: 'Textgröße (%)',
  tabsTextSizeDesc: 'Skaliert den Text der Session-Zeilen in Liste und Grid. 100 % = 10px Titel.',
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
  tabsInfoDensityDesc: 'Wie viel Kontext jeder Eintrag zeigt — wie in Hermes Desktop. Komfortabel: größerer Titel, mehr Luft, dazu Modell und „zuletzt aktiv“ (wenn bekannt). Detailreich: zusätzlich Vorschau-Zeile und Kontext-Auslastung. „Wie Hermes“ übernimmt die App-Einstellung live.',
  infoDensityAuto: 'Wie Hermes',
  infoDensityCompact: 'Kompakt',
  infoDensityComfortable: 'Komfortabel',
  infoDensityDetailed: 'Detailreich',
  metaMessages: n => `${n} Nachrichten`,
  metaToolCalls: n => `${n} Tool-Aufrufe`,
  metaLastActive: age => `zuletzt aktiv ${age}`,
  metaContextShort: pct => `Kontext ${pct}%`,
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
  personalPaneSurface: 'Pane-Fläche',
  personalPaneSurfaceDesc: 'Hintergrund des Session-Flow-Panes. Native = dieselbe Farbe wie die eingebaute Sessions-Sidebar (Hermes-Default). Chat = Chat-Farbe (bisheriger Look). Ohne = kein eigener Fill.',
  personalPaneSurfaceNative: 'Native Sidebar',
  personalPaneSurfaceChat: 'Chat',
  personalPaneSurfaceNone: 'Ohne',
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
/* Zeilen-Geometrie — native Sidebar-Parität (hermes-agent row-geometry.ts):
   SIDEBAR_ROW_MIN_H=26px, SIDEBAR_ROW_PAD_X=8px, SIDEBAR_ROW_GAP=6px,
   SIDEBAR_ROW_LEAD=14px, Label=13px/500, Add-Button=16px. Als Custom-Properties
   gespiegelt in applyRows() — programmatisch überschreibbar, dokumentiert. */
:root{--sf-row-min-h:26px;--sf-row-pad-x:8px;--sf-row-gap:6px;--sf-row-lead:14px;--sf-row-label-size:13px;--sf-row-add-size:16px}
.sf-pane{display:flex;flex-direction:column;height:100%;min-height:0;font-size:12px}
/* Pane-Fläche (v1.20): 'native' malt exakt die Variable, die auch die native
   Sessions-Sidebar der App füllt (inkl. Theme-/Glass-Varianten), 'chat' den
   bisherigen Chat-Look (body-Farbe), 'none' gar nichts. Unlayered → gewinnt
   über die App-Layer. Ohne Attribut (altes Settings-File vor dem ersten
   apply) bleibt der Zustand undefiniert → App-Durchblick wie bisher. */
.sf-pane[data-sf-panesurface]{background:var(--ui-sidebar-surface-background)}
:root[data-sf-panesurface='native'] .sf-pane{background:var(--ui-sidebar-surface-background)}
:root[data-sf-panesurface='chat'] .sf-pane{background:var(--ui-chat-surface-background)}
:root[data-sf-panesurface='none'] .sf-pane{background:transparent}
.sf-toolbar{display:flex;align-items:center;gap:6px;padding:4px 6px;border-bottom:1px solid var(--ui-stroke-tertiary);color:var(--ui-text-tertiary)}
.sf-toolbar-count{flex:0 1 auto;min-width:0;padding-left:4px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ui-text-quaternary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* App-Nav-Zeile (v1.20): Icon-Buttons der ersten App-Sidebar-Sektionen.
   flex-wrap = dynamisches Umfließen in weitere Zeilen bei schmaler Breite
   oder vielen Buttons (Anforderung „umfließend"). Nur Theme-Variablen. */
.sf-navapps{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:1px;padding:4px 6px;border-bottom:1px solid var(--ui-stroke-tertiary)}
.sf-navapps-btn{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border:none;border-radius:6px;padding:0;background:transparent;color:var(--ui-text-tertiary);cursor:pointer;transition:background-color .12s ease,color .12s ease}
.sf-navapps-btn:hover{background:var(--ui-row-hover-background,rgba(127,127,127,.08));color:var(--foreground)}
.sf-navapps-btn:focus-visible{outline:1px solid var(--ui-accent);outline-offset:1px}
.sf-navapps-btn:active{background:color-mix(in srgb,var(--ui-accent) 14%,transparent)}
/* Status-Pip (v1.20): 7-px-Punkt oben rechts, Tone über data-status.
   Kein Punkt bei data-status="off" (idle/keine Daten). Farben rein über
   Theme-Variablen; destructive als dokumentierte Ausnahme (wie im
   Kontext-Donut bereits etabliert). */
.sf-navapps-btn[data-status]{position:relative}
.sf-navapps-btn[data-status=ok]::after,.sf-navapps-btn[data-status=bad]::after,.sf-navapps-btn[data-status=warn]::after,.sf-navapps-btn[data-status=info]::after{content:'';position:absolute;top:1px;right:1px;width:7px;height:7px;border-radius:50%;box-shadow:0 0 0 2px var(--ui-sidebar-surface-background,transparent);pointer-events:none}
.sf-navapps-btn[data-status=ok]::after{background:var(--sf-status-ok,#34d399)}
.sf-navapps-btn[data-status=bad]::after{background:var(--destructive,var(--sf-status-bad,#f87171))}
.sf-navapps-btn[data-status=warn]::after{background:var(--sf-status-warn,#fbbf24)}
.sf-navapps-btn[data-status=info]::after{background:var(--sf-status-info,#60a5fa)}
.sf-navapps-rule{flex-basis:100%;height:0}
@media (prefers-reduced-motion:reduce){.sf-navapps-btn{transition:none}}
/* Composer-Projekt-Chip (v1.21, nur Full-Build — Catalog wartet auf den
   Composer-Accessory-Slot): sitzt in der Eingabezeile des Composers, direkt
   VOR dem „+"-Add-Button (dessen Wrapper-Button als Anker). Minimalistisch:
   Farb-Dot + Name + Caret, Höhe des Ghost-Icon-Buttons, nur Theme-Variablen. */
/* #full */
.sf-cproj-row{display:flex;align-items:center}
.sf-cproj-pill{display:inline-flex;align-items:center;gap:5px;max-width:200px;height:26px;padding:0 8px;border:1px solid color-mix(in srgb,var(--foreground) 10%,transparent);border-radius:999px;background:color-mix(in srgb,var(--foreground) 4%,transparent);color:var(--ui-text-secondary,var(--foreground));font-size:11px;line-height:1;cursor:pointer;transition:background-color .12s ease,border-color .12s ease,color .12s ease}
.sf-cproj-pill:hover{background:color-mix(in srgb,var(--foreground) 8%,transparent);border-color:color-mix(in srgb,var(--foreground) 16%,transparent);color:var(--foreground)}
.sf-cproj-pill:focus-visible{outline:1px solid var(--ui-accent);outline-offset:1px}
.sf-cproj-dot{width:8px;height:8px;border-radius:999px;background:var(--sf-cproj-color,color-mix(in srgb,var(--foreground) 28%,transparent));flex:none}
.sf-cproj-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sf-cproj-caret{flex:none;font-size:8px;opacity:.6}
.sf-cproj-menu{position:fixed;z-index:60;min-width:200px;max-width:320px;max-height:40vh;overflow-y:auto;padding:4px;border:1px solid color-mix(in srgb,var(--foreground) 12%,transparent);border-radius:10px;background:var(--ui-chat-surface-background);box-shadow:0 8px 24px color-mix(in srgb,var(--foreground) 18%,transparent)}
.sf-cproj-menu-hint{padding:4px 8px 6px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ui-text-quaternary,var(--ui-text-tertiary))}
.sf-cproj-item{display:flex;width:100%;align-items:center;gap:8px;padding:6px 8px;border:none;border-radius:7px;background:transparent;color:var(--foreground);font-size:12px;text-align:left;cursor:pointer}
.sf-cproj-item:hover{background:color-mix(in srgb,var(--foreground) 7%,transparent)}
.sf-cproj-item[data-active='true']{background:color-mix(in srgb,var(--ui-accent) 14%,transparent)}
.sf-cproj-item:focus-visible{outline:1px solid var(--ui-accent);outline-offset:-1px}
.sf-cproj-empty{padding:6px 8px;font-size:11px;color:var(--ui-text-tertiary)}
@media (prefers-reduced-motion:reduce){.sf-cproj-pill{transition:none}}
/* #end */
.sf-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 4px 12px}
.sf-group-head{display:flex;align-items:flex-start;gap:4px;min-height:27px;padding:2px 4px 2px 2px;border-radius:6px;color:var(--ui-text-secondary);cursor:pointer;user-select:none;transition:background-color .12s ease,box-shadow .12s ease}
.sf-group-head:hover{background:var(--ui-row-hover-background,rgba(127,127,127,.08));color:var(--foreground)}
.sf-group-head[data-drop=true]{background:color-mix(in srgb,var(--ui-accent) 14%,transparent);box-shadow:inset 0 0 0 1px var(--ui-accent)}
.sf-group-caret{display:flex;align-items:flex-start;justify-content:center;width:14px;flex-shrink:0;padding-top:2px;color:var(--ui-text-quaternary)}
.sf-group-dot{width:8px;height:8px;flex-shrink:0;margin-top:5px;border-radius:3px}
.sf-group-lead-icon{display:flex;align-items:flex-start;justify-content:center;width:14px;flex-shrink:0;padding-top:2px;color:var(--ui-text-tertiary)}
/* Kopfzeile als Text-Spalte (Titel + optionale Subzeile) — wie die
   Projekt-/Gruppen-Header von Hermes Desktop, nur hier IMMER sichtbar statt
   per Hover-Tooltip, weil "Detaildichte" das ausdrücklich verlangt. */
.sf-group-text{display:flex;flex-direction:column;justify-content:center;min-width:0;flex:1;gap:1px}
/* v1.27.2/1.27.3: Kopfzeilen-Titel-Typografie einstellbar — px-Größe über
   --sf-group-name-size (Default 10, gleichauf mit den Session-Titeln),
   Kapitälchen per data-sf-groupcaps-Toggle (echte Großbuchstaben via
   uppercase + leicht weiterem Letter-Spacing). */
.sf-group-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--sf-group-name-size,10px);font-weight:700;letter-spacing:.01em}
html[data-sf-groupcaps=on] .sf-group-name{text-transform:uppercase;letter-spacing:.04em}
.sf-group-sub{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:500;line-height:1.25;color:var(--ui-text-quaternary)}
.sf-group-count{flex-shrink:0;font-size:10px;color:var(--ui-text-quaternary);font-variant-numeric:tabular-nums}
.sf-group-drophint{flex-shrink:0;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:600;color:var(--ui-accent)}
.sf-group-actions{display:flex;align-items:center;justify-content:center;align-self:stretch;min-width:var(--sf-row-add-size,16px);min-height:var(--sf-row-add-size,16px);margin-left:2px;padding:0 2px;border-radius:5px;opacity:0;flex-shrink:0;transition:opacity .12s ease,background-color .12s ease}
.sf-group-head:hover .sf-group-actions:hover{background:var(--ui-control-hover-background,rgba(127,127,127,.14))}
.sf-group-head:hover .sf-group-actions,.sf-group-head:focus-within .sf-group-actions{opacity:1}
.sf-group-unassigned .sf-group-name{font-weight:600;color:var(--ui-text-tertiary)}
/* v1.26.2: Caret (Collapse-Pfeil) ist IMMER sichtbar — Projekt-Header und
   manuelle Gruppen gleich. Früher hover-only (opacity:0 → :hover 1); der
   Nutzer vermisste die Ein-/Ausklapp-Affordanz ohne Maus-Hover. */
/* Manuelle Gruppen (v1.26.0) — Container, kein eigenes `+` mehr. Die
   `+`-Affordanz wandert komplett auf die Kind-Projekt-Header. */
.sf-group-manual-no-cwd .sf-group-actions[data-sf-action=new]{display:none}
/* Zweizeilige Köpfe (Subzeile vorhanden) bekommen etwas mehr Luft, statt den
   Text einzuquetschen — die Zeilenhöhe wächst nur, wenn wirklich zwei Zeilen
   da sind (Projektpfad oder, in Detailreich, Kennzahlen). */
.sf-group-head.sf-group-twoline{min-height:38px;padding-top:3px;padding-bottom:3px}
.sf-group-head.sf-group-threeline{min-height:50px;padding-top:3px;padding-bottom:3px}
.sf-group-stats-2{display:flex;flex-wrap:wrap;gap:0 6px;min-width:0;overflow:hidden;font-size:9.5px;font-weight:500;line-height:1.25;color:var(--ui-text-quaternary)}
.sf-group-stats-2>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Kopfzeilen-Dichte (groups.headerDensity) — steuert seit v1.27.2 nur noch
   Gewicht/Höhe; die Font-Größe kommt aus --sf-group-name-size (tabs seit
   1.27.2 eigenes Setting). */
html[data-sf-grpdensity='compact'] .sf-group-name{font-weight:600}
html[data-sf-grpdensity='compact'] .sf-group-head{min-height:24px}
/* Section-Rahmen beim Drag-over — klarer Hinweis, was ein Loslassen bewirkt. */
.sf-section{margin-bottom:6px;border-radius:8px;transition:background-color .12s ease}
/* v1.26.0: Kind-Projekt-Sections unter einer manuellen Gruppe — eine
   Einrückungsstufe wie Unterordner in der nativen Sidebar. */
.sf-section-nested{margin-left:14px;margin-bottom:4px}
.sf-section[data-drop=true]{background:color-mix(in srgb,var(--ui-accent) 6%,transparent)}
/* „Drop-Ready": Sektion ist akzeptierendes Ziel, aber noch nicht gehovert.
   Sanfter Rand + leichte Pulse-Animation — Drop-Area wird VISIBLE statt
   im Scroll unterzugehen (vor allem die Pinned-Placeholder-Sektion). */
.sf-section[data-drop-ready=true]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ui-accent) 32%,transparent);animation:sf-drop-ready-pulse 2.1s ease-in-out infinite}
.sf-section[data-drop-ready=true][data-drop=true]{animation:none}
@keyframes sf-drop-ready-pulse{0%,100%{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ui-accent) 24%,transparent)}50%{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ui-accent) 55%,transparent)}}
/* Pinned-Placeholder: dedizierte Zeile mit Pin-Icon + Hinweis-Text in
   akzentuierter Umrandung — zeigt, dass die Sektion AUFNEHMEN kann, auch
   wenn sie gerade leer ist. */
.sf-section[data-pinned-placeholder=true]{background:color-mix(in srgb,var(--ui-accent) 4%,transparent)}
.sf-pin-placeholder{display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 10px;margin:2px 4px 4px;min-height:40px;border-radius:6px;border:1px dashed color-mix(in srgb,var(--ui-accent) 40%,transparent);color:color-mix(in srgb,var(--foreground) 70%,transparent);font-size:11px;font-weight:500;text-align:center;background:color-mix(in srgb,var(--ui-accent) 5%,transparent)}
.sf-section[data-drop=true] .sf-pin-placeholder{border-color:var(--ui-accent);background:color-mix(in srgb,var(--ui-accent) 14%,transparent);color:var(--foreground)}
.sf-pin-placeholder-text{line-height:1.2}
/* „Projekt nicht verfügbar" (v1.27.0): Kind-Projekt-Section unter einer
   manuellen Gruppe referenziert eine tote ProjectTreeNode.id. Hinweis-Zeile
   mit Warn-Icon + Entfernen-Aktion statt leerem Body. */
.sf-group-missing{display:flex;align-items:center;gap:6px;padding:4px 6px;margin:2px 0;border-radius:6px;color:var(--ui-text-quaternary);font-size:11px;background:color-mix(in srgb,var(--ui-text-primary) 4%,transparent)}
.sf-group-missing [class*=codicon]{color:#f59e0b;flex-shrink:0}
.sf-group-missing-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sf-group-missing-remove{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border:1px solid var(--ui-stroke-tertiary);border-radius:5px;background:transparent;color:var(--ui-text-secondary);font-size:10px;cursor:pointer;flex-shrink:0}
.sf-group-missing-remove:hover{background:var(--ui-control-hover-background,rgba(127,127,127,.14));color:var(--foreground)}
/* v1.25.1: ListView-DnD-DropBar — schmale Leiste am Listenanfang, die
   waehrend eines aktiven Drags zwei Ziele (Pin + Ungrouped) anbietet.
   Ohne sie hatte der Flat-List-Modus keine sichtbare Drop-Area. */
.sf-flat-dropbar{display:flex;gap:6px;padding:6px 6px 4px;margin:0 0 4px}
.sf-flat-dropbar-target{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 6px;min-height:30px;border-radius:6px;border:1px dashed color-mix(in srgb,var(--ui-accent) 40%,transparent);color:color-mix(in srgb,var(--foreground) 70%,transparent);font-size:11px;font-weight:500;background:color-mix(in srgb,var(--ui-accent) 4%,transparent);transition:background-color .12s ease,border-color .12s ease,color .12s ease;cursor:default}
.sf-flat-dropbar-target--hot,.sf-flat-dropbar-target[data-drop=true]{border-color:var(--ui-accent);background:color-mix(in srgb,var(--ui-accent) 18%,transparent);color:var(--foreground)}
.sf-flat-dropbar-label{display:inline-flex;align-items:center;gap:5px;line-height:1.1}
.sf-flat-dropbar-label [class*=codicon]{color:var(--ui-accent);flex-shrink:0}
@media (prefers-reduced-motion:reduce){.sf-section[data-drop-ready=true]{animation:none}}
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
.sf-tab{display:flex;align-items:center;gap:var(--sf-row-gap,6px);min-height:var(--sf-row-min-h,26px);padding:4px var(--sf-row-pad-x,8px);border-radius:6px;cursor:pointer;color:var(--ui-text-secondary);position:relative;user-select:none;-webkit-user-select:none}
/* v1.28.0 Pointer-Drag (ersetzt natives HTML5-DnD komplett — Begruendung:
   docs/plans/2026-10-07-dnd-tot-list-grid.md, Nachtrag v1.28.0). user-
   select:none bleibt noetig: ohne das wuerde mousedown+Bewegung ueber den
   Text-Kindern (Title/Details/Meta) eine Browser-Text-Selektion ausloesen,
   statt dass der Pointer-Controller (beginRowDrag in SessionsPane) die
   Bewegung fuer die Drag-Schwelle sieht. Der fruehere pointer-events:none-
   Hit-Test-Bypass (v1.27.6, fuer natives dragover/drop) ist nicht mehr
   nötig — der Hit-Test laeuft jetzt über document.elementFromPoint() +
   [data-sf-drop-key], das ignoriert pointer-events ohnehin korrekt. */
.sf-tab:hover{background:var(--ui-row-hover-background,rgba(127,127,127,.08));color:var(--foreground)}
.sf-tab[data-active=true]{background:var(--ui-row-active-background,rgba(127,127,127,.12));color:var(--foreground)}
.sf-tab[data-drop=true]{box-shadow:inset 0 0 0 1px var(--ui-accent);background:color-mix(in srgb,var(--ui-accent) 10%,transparent)}
.sf-tab[data-dragging=true]{opacity:.5;transform:scale(.97);box-shadow:0 2px 10px rgba(0,0,0,.35);outline:1px dashed color-mix(in srgb,var(--ui-accent) 55%,transparent);outline-offset:-1px;cursor:grabbing;transition:transform .12s ease,opacity .12s ease,box-shadow .12s ease}
@media (prefers-reduced-motion:reduce){.sf-tab[data-dragging=true]{transition:none}}
@keyframes sf-just-moved{0%{background-color:color-mix(in srgb,var(--ui-accent) 32%,transparent);box-shadow:inset 0 0 0 1px var(--ui-accent)}100%{background-color:transparent;box-shadow:none}}
.sf-tab[data-just-moved=true]{animation:sf-just-moved .6s ease-out}
@media (prefers-reduced-motion:reduce){.sf-tab[data-just-moved=true]{animation:none;background-color:color-mix(in srgb,var(--ui-accent) 20%,transparent)}}
html[data-renderer-animations-paused] .sf-tab[data-just-moved=true]{animation-play-state:paused}
.sf-drag-ghost{position:fixed;left:0;top:0;z-index:9999;pointer-events:none;max-width:16rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 8px;border-radius:6px;opacity:.85;background:var(--ui-sidebar-surface-background,var(--dt-card));color:var(--ui-text-primary);font-size:11px;font-weight:500;box-shadow:0 2px 10px rgba(0,0,0,.35);will-change:transform}
.sf-filter-search{position:relative;display:flex;align-items:center;gap:4px;flex:1;min-width:0;height:18px;padding:0 6px;border-radius:6px;background:var(--ui-row-hover-background,rgba(127,127,127,.08));color:var(--ui-text-quaternary)}
.sf-filter-search input{flex:1;min-width:0;height:100%;border:0;border-radius:0;background:transparent;color:var(--foreground);font-size:11px;padding:0;box-shadow:none;outline:none}
.sf-filter-search input:focus,.sf-filter-search input:focus-visible,.sf-filter-search input:focus-within{box-shadow:none;border-color:transparent;outline:none}
.sf-filter-search:focus-within{box-shadow:none}
.sf-filter-clear{display:flex;align-items:center;justify-content:center;width:14px;height:14px;flex-shrink:0;padding:0;border:0;background:transparent;color:var(--ui-text-quaternary);cursor:pointer;border-radius:3px}
.sf-filter-clear:hover{background:var(--ui-control-hover-background,rgba(127,127,127,.14));color:var(--foreground)}
.sf-quickfilter{display:flex;align-items:center;justify-content:center;width:100%;padding:4px 6px 6px;border-bottom:1px solid var(--ui-stroke-tertiary)}
.sf-quickfilter>.sf-seg{width:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.sf-quickfilter>.sf-seg button{width:100%;min-width:0}
.sf-quickfilter :is([data-segmented-control],[role=group],[data-segmented]){width:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.sf-quickfilter :is([data-segmented-control],[role=group],[data-segmented]) :is(button,[role=radio]){width:100%;min-width:0}
.sf-tab-lead{display:flex;align-items:center;justify-content:center;width:var(--sf-row-lead,14px);flex-shrink:0;color:var(--ui-text-tertiary)}
.sf-tab-lead[data-kind=thinking],.sf-tab-lead[data-kind=streaming],.sf-tab-lead[data-kind=working]{color:var(--ui-accent)}
.sf-tab-lead[data-kind=tool]{color:var(--ui-accent)}
.sf-tab-lead[data-kind=waiting]{color:#f59e0b}
.sf-tab-lead[data-kind=done]{color:var(--ui-success,var(--ui-accent))}
.sf-tab-lead[data-kind=unread]{color:var(--ui-success,var(--ui-accent))}
.sf-tab-lead[data-kind=error]{color:var(--destructive,#ef4444)}
.sf-tab-main{min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;gap:1px}
.sf-tab-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--sf-row-label-size,10px);line-height:14px;font-weight:500;color:inherit;margin:0}
.sf-tab[data-active=true] .sf-tab-title{font-weight:600}
.sf-tab-preview{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--sf-row-detail-size,8px);line-height:1.3;color:var(--ui-text-quaternary)}
.sf-tab-meta{display:flex;align-items:center;gap:4px;flex-shrink:0}
/* Komfortabel-Dichte (Liste): einspaltig — Meta-Infos als letzte Zeile unter dem Text. */
.sf-tab-meta-inline{margin-top:3px;flex-wrap:wrap;row-gap:2px}
.sf-tab-ctx{flex-shrink:0;font-size:10px;line-height:14px;font-variant-numeric:tabular-nums;color:var(--ui-text-quaternary)}
.sf-tab-ctx[data-level=warn]{color:#f59e0b}
.sf-tab-ctx[data-level=high]{color:var(--destructive,#ef4444)}
/* Kontextfenster als Donut: Außenring = Füllstand, Innenkreis ausgespart (Loch).
   Der Ring liegt als ::before mit z-index:-1 im EIGENEN Stacking-Kontext
   (isolation:isolate) — dadurch über der Elementfläche, aber unter der Zahl. Die
   radiale Maske schneidet das Loch aus, durch das die Zeilenfläche scheint. Der
   mehrlagige Text-Schatten (Kontur + Glow) hält die weiße Zahl auch auf hellen
   Füllungen (Bernstein/Rot) und im hellen Theme lesbar. */
html[data-sf-ctxpie~=on] .sf-tab-ctx{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-size:9px;line-height:1;font-weight:800;letter-spacing:-.03em;color:#fff;background:transparent;text-shadow:0 0 1px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.9),0 0 4px rgba(0,0,0,.6),0 1px 1px rgba(0,0,0,.85),0 -1px 1px rgba(0,0,0,.75),0 1px 2px rgba(0,0,0,.7)}
html[data-sf-ctxpie~=on] .sf-tab-ctx::before{content:'';position:absolute;inset:0;z-index:-1;border-radius:50%;background:conic-gradient(from -90deg,var(--sf-ctx-color,var(--ui-accent)) var(--sf-ctx-pct,0%),color-mix(in srgb,var(--sf-ctx-color,var(--ui-accent)) 18%,transparent) 0deg);-webkit-mask:radial-gradient(closest-side,transparent 0 50%,#000 52%);mask:radial-gradient(closest-side,transparent 0 50%,#000 52%)}
html[data-sf-ctxpie~=on] .sf-tab-ctx[data-level=warn]{--sf-ctx-color:#d97706}
html[data-sf-ctxpie~=on] .sf-tab-ctx[data-level=high]{--sf-ctx-color:var(--destructive,#dc2626)}
/* Bar-Style (minimalistisch): kleine horizontale Füll-Bar in Höhe der
   Schrift, ohne Prozent-Zahl drin. Breite ca. 22px, Höhe = 1em / 10px.
   Rundungen bleiben scharf-dezent; der Füllstand nutzt denselben
   --sf-ctx-pct wie der Donut, nur als width der Innenfüllung. */
html[data-sf-ctxpie~=on][data-sf-ctxstyle=bar] .sf-tab-ctx{position:relative;isolation:auto;display:inline-flex;align-items:center;justify-content:flex-start;width:28px;height:0.8em;min-height:9px;border-radius:3px;padding:0;font-size:0;line-height:0;color:transparent;background:color-mix(in srgb,var(--sf-ctx-color,var(--ui-accent)) 14%,transparent);text-shadow:none;overflow:hidden}
html[data-sf-ctxpie~=on][data-sf-ctxstyle=bar] .sf-tab-ctx::before{content:'';position:absolute;inset:0;z-index:auto;border-radius:inherit;background:var(--sf-ctx-color,var(--ui-accent));width:var(--sf-ctx-pct,0%);height:100%;-webkit-mask:none;mask:none;transition:width .22s ease-out}
html[data-sf-ctxpie~=on][data-sf-ctxstyle=bar] .sf-tab-ctx[data-level=warn]{--sf-ctx-color:#d97706}
html[data-sf-ctxpie~=on][data-sf-ctxstyle=bar] .sf-tab-ctx[data-level=high]{--sf-ctx-color:var(--destructive,#dc2626)}
@media (prefers-reduced-motion:reduce){html[data-sf-ctxpie~=on][data-sf-ctxstyle=bar] .sf-tab-ctx::before{transition:none}}
.sf-tab-time{font-size:10px;color:var(--ui-text-quaternary);font-variant-numeric:tabular-nums}
.sf-tab-badge{font-size:9.5px;padding:0 4px;border-radius:4px;background:var(--ui-bg-tertiary,rgba(127,127,127,.12));color:var(--ui-text-tertiary);line-height:14px}
.sf-tab-count{font-size:10px;color:var(--ui-text-quaternary)}
/* Session-Ansicht: Liste (Standard) oder Grid-Karten */
.sf-items{display:flex;flex-direction:column;gap:2px}
.sf-items[data-view=grid]{display:grid;grid-template-columns:repeat(var(--sf-grid-cols,auto-fill),minmax(var(--sf-grid-min,150px),1fr));gap:var(--sf-grid-gap,6px);padding:2px 2px 8px}
.sf-items[data-view=grid] .sf-tab{flex-direction:column;align-items:stretch;height:auto;gap:3px;padding:8px;border-radius:8px}
/* Karten-Flächen via :where() = null-spezifisch: die Design-Optionen
   (Zeilen-Verlauf, Auswahl-Tönung, Live-Status) greifen so in Liste UND Grid. */
:where(.sf-items[data-view=grid]) .sf-tab{background:color-mix(in srgb,var(--ui-text-primary) 4%,transparent)}
:where(.sf-items[data-view=grid]) .sf-tab:hover{background:var(--ui-row-hover-background,rgba(127,127,127,.08))}
:where(.sf-items[data-view=grid]) .sf-tab[data-active=true]{background:var(--ui-row-active-background,rgba(127,127,127,.12))}
.sf-items[data-view=grid] .sf-tab-lead{align-self:flex-start;width:auto}
.sf-items[data-view=grid] .sf-tab-main{flex:1 1 auto;width:100%;justify-content:flex-start}
.sf-items[data-view=grid] .sf-tab-title{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:var(--sf-grid-lines,2);overflow:hidden;overflow-wrap:anywhere}
.sf-items[data-view=grid] .sf-tab-preview{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.sf-tab-details{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--sf-row-detail-size,8px);line-height:1.3;color:var(--ui-text-tertiary);margin-top:1px}
/* Info-Dichte-Abstufung: Komfortabel+ zeigt den größeren Titel; in der Liste
   werden die Abstände lockerer, Detailreich ergänzt die Stats-Zeile. Die
   Grid-Karten behalten ihren eigenen Rhythmus (gap) ohne Extra-Margins. */
.sf-tab[data-density=comfortable] .sf-tab-title,.sf-tab[data-density=detailed] .sf-tab-title{font-size:var(--sf-row-label-size,10px);line-height:1.3}
.sf-items[data-view=list] .sf-tab[data-density=comfortable] .sf-tab-details,.sf-items[data-view=list] .sf-tab[data-density=detailed] .sf-tab-details{margin-top:2px}
.sf-items[data-view=grid] .sf-tab-details{margin-top:3px}
.sf-items[data-view=list] .sf-tab[data-density=detailed] .sf-tab-preview{margin-top:3px}
/* Detailreich: die Beschreibungen (Detail- und Vorschau-Zeile) brechen auf
   bis zu zwei Zeilen um statt einzeilig mit Ellipse abzuschneiden. */
.sf-tab[data-density=detailed] .sf-tab-details,.sf-tab[data-density=detailed] .sf-tab-preview{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}
.sf-tab-stats{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:14px;color:var(--ui-text-quaternary)}
.sf-items[data-view=list] .sf-tab-stats{margin-top:3px}
.sf-items[data-view=grid] .sf-tab-meta{margin-top:auto;flex-wrap:wrap;row-gap:2px}
/* More-Button (List- und Grid-Ansicht): dezent, erscheint bei Hover/Fokus */
.sf-more{display:grid;place-items:center;width:18px;height:18px;padding:0;border:0;border-radius:4px;background:transparent;color:var(--ui-text-tertiary);cursor:pointer;opacity:0;transition:opacity .12s ease;flex-shrink:0}
.sf-tab:hover .sf-more,.sf-more:focus-visible{opacity:1}
.sf-more:hover{background:color-mix(in srgb,var(--ui-text-primary) 12%,transparent);color:var(--foreground)}
.sf-items[data-view=grid] .sf-tab{padding-right:30px}
.sf-items[data-view=grid] .sf-more{position:absolute;top:6px;right:6px}
/* „Mehr anzeigen“ — Begrenzung der sichtbaren Einträge je Gruppe (v1.11) */
.sf-showmore{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;min-height:24px;margin-top:4px;padding:3px 8px;border:1px solid var(--ui-stroke-tertiary);border-radius:6px;background:transparent;color:var(--ui-text-tertiary);font-size:11px;cursor:pointer;transition:background .12s ease,color .12s ease,border-color .12s ease}
.sf-showmore:hover{background:var(--ui-row-hover-background,rgba(127,127,127,.08));color:var(--foreground);border-color:var(--ui-stroke-secondary)}
.sf-showmore:focus-visible{outline:1px solid var(--ui-accent);outline-offset:-1px}
.sf-items[data-view=grid] .sf-showmore{grid-column:1/-1;margin-top:0}
.sf-menu-item{display:flex;align-items:center;gap:8px}
.sf-viewmenu{min-width:200px}
.sf-menu-caption{padding:4px 8px 2px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ui-text-quaternary)}
.sf-dialog-list{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow-y:auto}
.sf-dialog-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:var(--foreground);font-size:12px;text-align:left;cursor:pointer}
.sf-dialog-item:hover{background:var(--ui-row-hover-background,rgba(127,127,127,.08))}
.sf-empty{padding:24px 16px;text-align:center;color:var(--ui-text-tertiary)}

/* Lade-Phase: Balken + Gateway-Hinweis, solange noch keine Daten da sind. */
.sf-load{padding:22px 16px;display:flex;flex-direction:column;gap:10px;color:var(--ui-text-tertiary)}
.sf-load-title{font-size:.8125rem;font-weight:600;color:var(--ui-text-secondary);display:flex;align-items:center;gap:7px}
.sf-load-bar{position:relative;height:3px;border-radius:999px;background:color-mix(in srgb,var(--ui-text-primary) 8%,transparent);overflow:hidden}
.sf-load-bar::after{content:"";position:absolute;inset:0;width:38%;border-radius:inherit;background:var(--ui-accent);animation:sf-load-slide 1.15s var(--ease-out,cubic-bezier(0.22,1,0.36,1)) infinite}
@keyframes sf-load-slide{0%{transform:translateX(-110%)}100%{transform:translateX(290%)}}
.sf-load-hint{font-size:.75rem;line-height:1.45;color:var(--ui-text-quaternary)}
/* Retry-Button im Fehler-Leerzustand (v1.24.1): eigene Aktionszeile mit
   Abstand zum Fehlertext, Button nutzt die SDK-Button-Optik (ghost). */
.sf-load-actions{display:flex;justify-content:center;margin-top:10px}
html[data-renderer-animations-paused] .sf-load-bar::after{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){.sf-load-bar::after{animation:none;transform:translateX(60%)}}

/* Zeilen-Meta-Badges: Tokens/Kosten/Profil (rechte Meta-Spalte). */
.sf-tab-tokens,.sf-tab-cost,.sf-tab-prof{font-size:10px;line-height:14px;color:var(--ui-text-quaternary);white-space:nowrap}

/* Projekt-Dialog: Ordner-Zeilen. */
.sf-proj-folders{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.sf-proj-folder{display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid var(--ui-stroke-tertiary);border-radius:6px;font-size:.75rem;color:var(--ui-text-secondary)}
.sf-proj-folder-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
.sf-proj-folder-tag{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--ui-accent)}
.sf-proj-folder button{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;color:var(--ui-text-tertiary);background:transparent;border:none;cursor:pointer}
.sf-proj-folder button:hover{background:var(--ui-control-hover-background);color:var(--foreground)}

/* Archiv-Modus: Wiederherstellen-Aktion in der Zeile. */
.sf-arch-restore{font-size:10px;color:var(--ui-accent);cursor:pointer}
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
.sf-section-title{display:flex;align-items:center;gap:7px;margin:22px 0 4px;font-size:13px;font-weight:700;letter-spacing:.015em;color:var(--foreground)}
.sf-section-title:first-of-type{margin-top:8px}
.sf-section-title > svg,.sf-section-title [class*=codicon]{color:var(--ui-accent);flex-shrink:0}
.sf-section-title > span{line-height:1.2}
.sf-section-desc{font-size:11px;line-height:1.5;color:var(--ui-text-tertiary);margin:1px 0 2px}
/* Einstellungs-Sektion: Trennlinie + dezenter Hover, damit man in der
   Breite der Seite die Zugehörigkeit nicht verliert. Hover tönt nur
   minimal — der Settings-Content soll weiterhin ruhig lesbar bleiben. */
section[id^=sf-sec-]{position:relative;padding:4px 10px 10px;margin:0 -10px;border-radius:10px;transition:background-color .18s ease}
section[id^=sf-sec-] + section[id^=sf-sec-]{margin-top:14px}
section[id^=sf-sec-] + section[id^=sf-sec-]::before{content:'';position:absolute;top:-7px;left:12px;right:12px;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--foreground) 14%,transparent) 20%,color-mix(in srgb,var(--foreground) 14%,transparent) 80%,transparent)}
section[id^=sf-sec-]:hover{background:color-mix(in srgb,var(--ui-accent) 3%,transparent)}
section[id^=sf-sec-]:hover .sf-section-title{color:var(--foreground)}
section[id^=sf-sec-]:hover .sf-section-title > svg,section[id^=sf-sec-]:hover .sf-section-title [class*=codicon]{color:color-mix(in srgb,var(--ui-accent) 85%,var(--foreground))}
@media (prefers-reduced-motion:reduce){section[id^=sf-sec-]{transition:none}}
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
.sf-colorpick{width:24px;height:24px;flex:0 0 auto;padding:0;border:1px solid var(--ui-stroke-secondary);border-radius:6px;background:transparent;cursor:pointer}
.sf-colorpick::-webkit-color-swatch-wrapper{padding:2px}
.sf-colorpick::-webkit-color-swatch{border:0;border-radius:4px}
.sf-seg{display:inline-grid;grid-auto-flow:column;gap:2px;border-radius:5px;background:var(--ui-bg-tertiary,rgba(127,127,127,.12));padding:2px}
.sf-seg button{border:0;background:transparent;border-radius:3px;padding:2px 9px;font-size:11px;color:var(--ui-text-secondary);cursor:pointer}
.sf-seg button[data-active=true]{background:var(--background,#fff);color:var(--foreground);box-shadow:0 1px 2px rgba(0,0,0,.15)}
.sf-dialog-row{display:flex;flex-direction:column;gap:6px;margin:10px 0}
.sf-dialog-label{font-size:11px;font-weight:600;color:var(--ui-text-secondary);display:flex;align-items:center;justify-content:space-between;gap:8px}
.sf-dialog-body{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.sf-dialog-error{font-size:11px;color:var(--ui-danger,#f87171);margin-top:4px}
@media (prefers-reduced-motion: reduce){.sf-hud{transition:none}}

/* #full */
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
/* #end */

/* #full */
/* ── UI-Tabs: Content-Tab-Leiste im Sidebar-Look (optional) ─────────────
   Leicht abgerundete Chips statt eckiger Baender; Label, Close-Button und
   aktiver Zustand einstellbar. Arbeitende Session-Tabs tragen den
   umlaufenden Glow-Ring (Live-Info aus der Aktivitaets-Engine). */

/* Grundform: leicht abgerundet, mit Abstand (Chip-Optik) */
:root[data-sf-ui-tabs~='on'] :is([class~='group/tab'],[data-sf-ui-tab='true']):not([data-vertical]){
  height:auto;
  min-width:0;
  max-width:100%;
  margin-block:var(--sf-ui-tab-inset-y,2px);
  border-radius:var(--sf-ui-tab-radius,4px);
  transition:background-color .1s ease
}
/* Label-Container schrumpfbar — Close-Button bleibt im Anschnitt erreichbar */
:root[data-sf-ui-tabs~='on'] :is([class~='group/tab'],[data-sf-ui-tab='true']) .pane-tab-content{
  min-width:0;
  overflow:hidden
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

/* "Liste/Grid als Tab-Selektor" (tabs.asTabSelector) — blendet NUR die
   Streifen aus, die mindestens einen Session-Tile-Tab tragen (strukturell
   über :has(), siehe DEVELOPMENT.md); Terminal-/Dateien-/sonstige
   Pane-Tab-Leisten ohne Session-Tabs bleiben unberührt. Unabhängig vom
   UI-Tabs-Master (data-sf-ui-tabs) — eigener Schalter. */
html[data-sf-hide-tabstrip='on'] div:has(> [role='tablist'] [data-tree-tab^='session-tile:']){
  display:none
}
/* #end */

/* ── Einstellungs-Navigation: sticky Kategorie-Chips ─────────────────── */
/* #full */
/* ── Individualisierung: Akzent-Tönung · Content-Shell · Hintergrund-Layer ──
   Der .sf-bg-layer wird per JS in die Pane-Hosts gesetzt; hier nur die
   Darstellung. Variablen (--sf-*) kommen von applyPersonal(). Die Akzent-Regel
   ist unlayered und sticht damit die @layer-base-Definition der App. */

html[data-sf-accent~='on']{--ui-accent:var(--sf-accent-color,#7c3aed)}

/* Geltungsbereich „alle": die Zonenfläche transparent schalten, damit der
   Hintergrund-Layer (z-index:-1) hinter dem Pane-Inhalt sichtbar wird — sonst läge
   er hinter der opaken Zonen-Fläche (--ui-editor-surface-background). */
html[data-sf-bg~='on'][data-sf-bg-scope='all']{
  --ui-editor-surface-background:transparent
}

.sf-bg-layer{
  position:absolute;
  inset:0;
  z-index:0;
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
/* #end */

.sf-nav{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:6px;margin:0 -6px 2px;padding:6px;background:color-mix(in srgb,var(--ui-editor-surface-background,var(--background)) 90%,transparent);border-bottom:1px solid var(--ui-stroke-tertiary);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.sf-nav-chips{display:flex;align-items:center;gap:3px;flex:1 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}
.sf-nav-chips::-webkit-scrollbar{display:none}
/* Übernehmen-Button im sticky Menü: erzwingt Persistenz + erneutes Anwenden. */
.sf-savebtn{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 10px;border:1px solid var(--ui-stroke-secondary);border-radius:999px;background:transparent;color:var(--ui-text-tertiary);font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer;transition:background-color .12s ease,color .12s ease,border-color .12s ease}
.sf-savebtn:hover{background:var(--ui-row-hover-background,color-mix(in srgb,var(--dt-foreground) 6%,transparent));color:var(--foreground)}
.sf-savebtn[data-dirty=true]{border-color:color-mix(in srgb,var(--ui-accent) 55%,transparent);color:var(--ui-accent)}
.sf-savebtn[data-state=saved]{border-color:color-mix(in srgb,var(--ui-success,var(--ui-accent)) 60%,transparent);color:var(--ui-success,var(--ui-accent));background:color-mix(in srgb,var(--ui-success,var(--ui-accent)) 14%,transparent)}
.sf-nav-chip{display:inline-flex;flex:0 0 auto;align-items:center;gap:4px;height:24px;padding:0 9px;border:0;border-radius:999px;background:transparent;color:var(--ui-text-tertiary);font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer;transition:background-color .12s ease,color .12s ease}
.sf-nav-chip:hover{background:var(--ui-row-hover-background,color-mix(in srgb,var(--dt-foreground) 6%,transparent));color:var(--foreground)}
.sf-nav-chip[data-active='true']{background:var(--ui-row-active-background,color-mix(in srgb,var(--ui-accent) 16%,transparent));color:var(--foreground)}
.sf-settings section{scroll-margin-top:46px}
.sf-preset-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.sf-subhead{margin:10px 2px 2px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--ui-text-quaternary)}
html[data-sf-rowgrad~=on]{--sf-row-layer:linear-gradient(var(--sf-row-angle,135deg),var(--sf-row-from,#7c3aed),var(--sf-row-to,#00dbda))}
html[data-sf-rowgrad~=on] .sf-tab{background:linear-gradient(var(--sf-row-angle,135deg),var(--sf-row-from,#7c3aed),var(--sf-row-to,#00dbda))}
html[data-sf-rowgrad~=on] .sf-tab:hover{filter:brightness(1.07)}
html[data-sf-rowshadow~=subtle] .sf-tab:not([data-drop=true]){box-shadow:0 1px 2px rgba(0,0,0,.22)}
html[data-sf-rowshadow~=medium] .sf-tab:not([data-drop=true]){box-shadow:0 2px 6px rgba(0,0,0,.3)}
html[data-sf-rowshadow~=strong] .sf-tab:not([data-drop=true]){box-shadow:0 4px 14px rgba(0,0,0,.42)}
/* Text oben ausrichten (Liste & Grid): Text-Spalte und Meta am Zeilenkopf. */
html[data-sf-aligntop~=on] .sf-tab{align-items:flex-start}
html[data-sf-aligntop~=on] .sf-tab-lead{margin-top:2px}
html[data-sf-aligntop~=on] .sf-tab-meta:not(.sf-tab-meta-inline){padding-top:2px}
html[data-sf-aligntop~=on] .sf-items[data-view=grid] .sf-tab-meta{padding-top:0}
/* Hover-Anhebung (App-Kachel-Optik): leicht anheben, Schlagschatten tiefer. */
html[data-sf-hoverlift~=on] .sf-tab{transition:transform .13s ease,box-shadow .13s ease,background-color .13s ease}
html[data-sf-hoverlift~=on] .sf-tab:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.42)}
html[data-sf-hoverlift~=on] .sf-tab[data-dragging=true]:hover{transform:scale(.97);box-shadow:0 2px 10px rgba(0,0,0,.35)}
html[data-sf-titlegrad~=on] .sf-tab-title{background-image:linear-gradient(var(--sf-title-angle,90deg),var(--sf-title-from,#e4e4e7),var(--sf-title-to,#8b8b93));-webkit-background-clip:text;background-clip:text;color:transparent}
/* Einfarbiger Titel (Stil „solid"): überschreibt die App-Titelfarbe, wenn aktiv.
   Steht NACH der Verlauf-Regel, damit sie bei gleicher Spezifität gewinnt. */
html[data-sf-titlecolor~=on] .sf-tab-title{color:var(--sf-title-color,#e4e4e7)}
/* Live-Kennzeichnung (Stand 2026-10-05): Aktive OHNE Auswahl tragen nur
   den Rahmen — der Hintergrund bleibt unangetastet. Die linke Live-Schiene
   markiert die aktive AUSWAHL (aktiv + selektiert); sie liegt als ::before
   über dem Auswahl-Hintergrund und bleibt so bei allen Tönungs- und
   Hover-Varianten stabil. */
html[data-sf-rowlive~=on] .sf-tab[data-live=busy]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ui-accent) 28%,transparent)}
html[data-sf-rowlive~=on] .sf-tab[data-live=waiting]{box-shadow:inset 0 0 0 1px color-mix(in srgb,#f59e0b 30%,transparent)}
html[data-sf-rowlive~=on] .sf-tab[data-active=true][data-live=busy]::before,html[data-sf-rowlive~=on] .sf-tab[data-active=true][data-live=waiting]::before{content:'';position:absolute;left:1px;top:3px;bottom:3px;width:3px;border-radius:2px;background:color-mix(in srgb,var(--ui-accent) 85%,transparent)}
html[data-sf-rowlive~=on] .sf-tab[data-active=true][data-live=waiting]::before{background:color-mix(in srgb,#f59e0b 85%,transparent)}
html[data-sf-rowlive~=on] .sf-tab[data-live=busy] .sf-tab-lead,html[data-sf-rowlive~=on] .sf-tab[data-live=waiting] .sf-tab-lead{animation:sf-live-pulse 1.6s ease-in-out infinite}
@keyframes sf-live-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@media (prefers-reduced-motion:reduce){html[data-sf-rowlive~=on] .sf-tab[data-live=busy] .sf-tab-lead,html[data-sf-rowlive~=on] .sf-tab[data-live=waiting] .sf-tab-lead{animation:none}}
html[data-sf-rowlive~=on][data-renderer-animations-paused] .sf-tab[data-live=busy] .sf-tab-lead,html[data-sf-rowlive~=on][data-renderer-animations-paused] .sf-tab[data-live=waiting] .sf-tab-lead{animation-play-state:paused}
/* Live-Rahmen (App-Technik): glühender umlaufender Ring bzw. statischer Ring. */
html[data-sf-liveframe~=glow] .sf-tab[data-live=busy]::after,html[data-sf-liveframe~=glow] .sf-tab[data-live=waiting]::after{content:'';position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;padding:1px;background-image:conic-gradient(from var(--sf-arc-turn,0deg),transparent 0deg,transparent 238deg,color-mix(in srgb,var(--ui-accent) 30%,transparent) 286deg,var(--ui-accent) 332deg,transparent 360deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;animation:sf-arc-turn var(--sf-arc-duration,3.2s) linear infinite}
html[data-sf-liveframe~=glow] .sf-tab[data-live=waiting]::after{background-image:conic-gradient(from var(--sf-arc-turn,0deg),transparent 0deg,transparent 238deg,color-mix(in srgb,#f59e0b 30%,transparent) 286deg,#f59e0b 332deg,transparent 360deg)}
html[data-sf-liveframe~=ring] .sf-tab[data-live=busy]::after,html[data-sf-liveframe~=ring] .sf-tab[data-live=waiting]::after{content:'';position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;border:1px solid color-mix(in srgb,var(--ui-accent) 45%,transparent)}
html[data-sf-liveframe~=ring] .sf-tab[data-live=waiting]::after{border-color:color-mix(in srgb,#f59e0b 50%,transparent)}
@media (prefers-reduced-motion:reduce){html[data-sf-liveframe~=glow] .sf-tab[data-live=busy]::after,html[data-sf-liveframe~=glow] .sf-tab[data-live=waiting]::after{animation:none}}
html[data-renderer-animations-paused] .sf-tab[data-live=busy]::after,html[data-renderer-animations-paused] .sf-tab[data-live=waiting]::after{animation-play-state:paused}

/* Fertig-Effekt (Stand 2026-10-05): einmalige, dezente Animation, wenn
   eine Session fertig wird (data-done-fx=true an der Zeile, ~1,6 s).
   Presets über data-sf-donefx (glow/wobble/glow-wobble/shine/pop), Achse
   über data-sf-donefx-axis (x/y/z), Stärke über data-sf-donefx-strength. */
html[data-sf-donefx-strength=subtle]{--sf-done-amp:3deg;--sf-done-amp-z:1.2deg}
html[data-sf-donefx-strength=medium]{--sf-done-amp:6deg;--sf-done-amp-z:2.4deg}
html[data-sf-donefx-strength=strong]{--sf-done-amp:10deg;--sf-done-amp-z:4deg}
@keyframes sf-done-glow{0%{box-shadow:0 0 0 0 transparent}35%{box-shadow:0 0 0 2px color-mix(in srgb,var(--ui-success,var(--ui-accent)) 42%,transparent),0 0 16px 2px color-mix(in srgb,var(--ui-success,var(--ui-accent)) 26%,transparent)}100%{box-shadow:0 0 0 0 transparent}}
@keyframes sf-done-wob-x{0%{transform:perspective(560px) rotateX(0)}32%{transform:perspective(560px) rotateX(var(--sf-done-amp,3deg))}64%{transform:perspective(560px) rotateX(calc(var(--sf-done-amp,3deg) * -0.55))}100%{transform:perspective(560px) rotateX(0)}}
@keyframes sf-done-wob-y{0%{transform:perspective(560px) rotateY(0)}32%{transform:perspective(560px) rotateY(var(--sf-done-amp,3deg))}64%{transform:perspective(560px) rotateY(calc(var(--sf-done-amp,3deg) * -0.55))}100%{transform:perspective(560px) rotateY(0)}}
@keyframes sf-done-wob-z{0%{transform:rotate(0)}30%{transform:rotate(var(--sf-done-amp-z,1.2deg))}60%{transform:rotate(calc(var(--sf-done-amp-z,1.2deg) * -0.7))}100%{transform:rotate(0)}}
@keyframes sf-done-pop{0%{transform:scale(1)}40%{transform:scale(1.03)}100%{transform:scale(1)}}
html[data-sf-donefx=glow] .sf-tab[data-done-fx=true]{animation:sf-done-glow .75s ease-out 1}
html[data-sf-donefx=wobble][data-sf-donefx-axis=x] .sf-tab[data-done-fx=true]{animation:sf-done-wob-x .6s ease-in-out 1}
html[data-sf-donefx=wobble][data-sf-donefx-axis=y] .sf-tab[data-done-fx=true]{animation:sf-done-wob-y .6s ease-in-out 1}
html[data-sf-donefx=wobble][data-sf-donefx-axis=z] .sf-tab[data-done-fx=true]{animation:sf-done-wob-z .6s ease-in-out 1}
html[data-sf-donefx=glow-wobble][data-sf-donefx-axis=x] .sf-tab[data-done-fx=true]{animation:sf-done-glow .75s ease-out 1,sf-done-wob-x .6s ease-in-out 1}
html[data-sf-donefx=glow-wobble][data-sf-donefx-axis=y] .sf-tab[data-done-fx=true]{animation:sf-done-glow .75s ease-out 1,sf-done-wob-y .6s ease-in-out 1}
html[data-sf-donefx=glow-wobble][data-sf-donefx-axis=z] .sf-tab[data-done-fx=true]{animation:sf-done-glow .75s ease-out 1,sf-done-wob-z .6s ease-in-out 1}
html[data-sf-donefx=pop] .sf-tab[data-done-fx=true]{animation:sf-done-pop .55s ease-out 1}
.sf-done-shine{position:absolute;inset:0;border-radius:inherit;pointer-events:none;overflow:hidden}
.sf-done-shine::before{content:'';position:absolute;top:-30%;bottom:-30%;left:-34%;width:26%;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--foreground,#fff) 13%,transparent),transparent);transform:translateX(0) skewX(-16deg);animation:sf-done-sweep .8s ease-out 1}
@keyframes sf-done-sweep{to{transform:translateX(560%) skewX(-16deg)}}
@media (prefers-reduced-motion:reduce){html[data-sf-donefx] .sf-tab[data-done-fx=true]{animation:none}html[data-sf-donefx=shine] .sf-tab[data-done-fx=true] .sf-done-shine{display:none}}
html[data-renderer-animations-paused] .sf-tab[data-done-fx=true]{animation-play-state:paused}
html[data-renderer-animations-paused] .sf-done-shine::before{animation-play-state:paused}
/* Info-Zeile (Detailreich): aktuelle Aktivität (Tool Call / Gedanke) als
   eigene Zeile unter der „zuletzt aktiv"-Info; beim Wechsel schiebt die
   neue Info von unten hoch, die vorherige nach oben heraus. */
.sf-tab-activity{display:flex;align-items:center;gap:4px;margin-top:2px;font-size:10px;line-height:14px;color:var(--ui-text-tertiary);overflow:hidden}
.sf-tab-activity[data-tone=waiting]{color:#f59e0b}
.sf-tab-activity[data-tone=error]{color:var(--destructive,#ef4444)}
.sf-activity-tick{position:relative;display:block;flex:1;min-width:0;height:14px;overflow:hidden}
.sf-activity-info{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.sf-activity-in{animation:sf-info-in .3s cubic-bezier(.22,.8,.3,1) 1}
.sf-activity-out{position:absolute;left:0;right:0;top:0;animation:sf-info-out .3s ease-in 1 forwards}
@keyframes sf-info-in{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes sf-info-out{from{transform:translateY(0);opacity:1}to{transform:translateY(-100%);opacity:0}}
@media (prefers-reduced-motion:reduce){.sf-activity-in,.sf-activity-out{animation:none}.sf-activity-out{display:none}}
html[data-renderer-animations-paused] .sf-activity-in,html[data-renderer-animations-paused] .sf-activity-out{animation-play-state:paused}

/* Drehung für Status-Icons (Arbeits-Indikator). Die App-Komponente dreht über
   den Prop spinning (codicon-modifier-spin); diese Klasse ist der Fallback für
   SDK-Builds ohne den Prop — sonst stünde das Icon still und wäre kaum als
   „arbeitet" zu lesen. */
@keyframes sf-icon-spin{to{transform:rotate(360deg)}}
.sf-icon-spin{display:inline-block;animation:sf-icon-spin 1.1s linear infinite}
@media (prefers-reduced-motion:reduce){.sf-icon-spin{animation:none}}
html[data-renderer-animations-paused] .sf-icon-spin{animation-play-state:paused}
html[data-sf-seltint~=accent]{--sf-sel-tone:var(--ui-accent)}
html[data-sf-seltint~=custom]{--sf-sel-tone:var(--sf-sel-color,#7c3aed)}
/* Auswahl-Zustand (Liste UND Grid): Tönung als Layer ÜBER dem optionalen
   Zeilen-Verlauf — der konfigurierte Verlauf bleibt im Auswahl-Zustand sichtbar. */
html[data-sf-seltint~=standard] .sf-tab[data-active=true]{background:linear-gradient(var(--ui-row-active-background,rgba(127,127,127,.12)),var(--ui-row-active-background,rgba(127,127,127,.12))),var(--sf-row-layer,linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)))}
html:is([data-sf-seltint~=accent],[data-sf-seltint~=custom]) .sf-tab[data-active=true]{background:linear-gradient(color-mix(in srgb,var(--sf-sel-tone) 16%,transparent),color-mix(in srgb,var(--sf-sel-tone) 16%,transparent)),var(--sf-row-layer,linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)))}
/* Hover auf dem ausgewählten Eintrag — Stärke über tabs.selHover (off/soft/strong). */
html[data-sf-selhover] .sf-tab[data-active=true]:hover{filter:none}
html[data-sf-selhover~=soft][data-sf-seltint~=standard] .sf-tab[data-active=true]:hover{background:linear-gradient(var(--ui-row-hover-background,rgba(127,127,127,.08)),var(--ui-row-hover-background,rgba(127,127,127,.08))),var(--sf-row-layer,linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)))}
html[data-sf-selhover~=soft]:is([data-sf-seltint~=accent],[data-sf-seltint~=custom]) .sf-tab[data-active=true]:hover{background:linear-gradient(color-mix(in srgb,var(--sf-sel-tone) 24%,transparent),color-mix(in srgb,var(--sf-sel-tone) 24%,transparent)),var(--sf-row-layer,linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)))}
html[data-sf-selhover~=strong][data-sf-seltint~=standard] .sf-tab[data-active=true]:hover{background:linear-gradient(color-mix(in srgb,var(--ui-text-primary) 12%,transparent),color-mix(in srgb,var(--ui-text-primary) 12%,transparent)),var(--sf-row-layer,linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)))}
html[data-sf-selhover~=strong]:is([data-sf-seltint~=accent],[data-sf-seltint~=custom]) .sf-tab[data-active=true]:hover{background:linear-gradient(color-mix(in srgb,var(--sf-sel-tone) 36%,transparent),color-mix(in srgb,var(--sf-sel-tone) 36%,transparent)),var(--sf-row-layer,linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)))}
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
  // „Fertig, aber ungesehen": die Antwort kam an, der User war noch nicht
  // drin (REST `unread:true`). Gefüllter Punkt wie in Mail/Chat-Apps.
  unread: { icon: 'circle-filled', labelKey: 'stUnread' },
  error: { icon: 'error', labelKey: 'stError' },
  idle: { icon: 'circle-outline', labelKey: 'stIdle' }
}

function activityFor(row, live, activity) {
  // Null-safe: Stale-Renderings können mit leeren Zeilen ankommen.
  if (!row || !row.id) {
    return { kind: 'idle', name: '', labelKey: null }
  }

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

  // v1.26.1: „fertig, aber ungesehen" — die Session ist ruhig, trägt aber
  // noch das `unread`-Flag vom REST-Payload. Das schlägt idle: der User
  // soll in Liste UND Grid sehen, dass hier eine ungesehene Antwort
  // liegt (gleiche Quelle wie der „Ungelesen"-Statusfilter). Busy-Zustände
  // oben gewinnen weiterhin — ein laufender Chat mit altem unread zeigt
  // seine Arbeit, nicht den Staub.
  if (row && row.unread) {
    return { kind: 'unread', name: '', labelKey: null }
  }

  return { kind: 'idle', name: '', labelKey: null }
}

/** Zeitstempel der letzten Aktivität für die „Aktiv"-Sortierung:
 *  Live-Liste (Server-`last_active`) → zuletzt gesehenes Gateway-Event →
 *  Startzeit (Bestand ganz ohne Live-Signal). */
function lastActivityAt(row, live, activity) {
  const runtimeEntry = Object.values(live || {}).find(entry => entry && entry.storedId === row.id)
  const liveAt = Number(runtimeEntry && runtimeEntry.lastActive) || 0
  const detail = (activity || {})[row.id]
  const eventAt = Number(detail && detail.at) || 0

  return Math.max(liveAt, eventAt, Number(row.startedAt) || 0)
}

function activityLabel(t, detail) {
  const glyph = ACTIVITY_GLYPHS[detail.kind] || ACTIVITY_GLYPHS.idle
  let label = t(glyph.labelKey)

  if (detail.kind === 'tool' && detail.name) {
    label = `${t('stTool')}: ${detail.name}`
  }

  return label
}

/* #full */
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
/* #end */

// ─────────────────────────────────────────────────────────────────────────────
// Strg+Scroll-Controller + HUD
// ─────────────────────────────────────────────────────────────────────────────

const BUILTIN_IGNORE = 'canvas, .monaco-editor, [data-slot="aui_zoomable-image"]'
// Regel-8-Einordnung: der Selektor wird NICHT gegen document gequeryt, sondern
// nur per closest() auf das Event-Target eines eigenen wheel-Listeners — die
// Geste soll Zoom-Flächen der App (Lightbox, Monaco) nicht kapern. Kein
// Restyle/Hide/Click/Rewrite von Kern-UI; im Catalog-PR disclose.

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
      await host.openSession(row.id, { intent: effectiveOpenIntent() })
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
/**
 * Codicon-Aufruf mit `~spin`-Marker. Die App-Komponente kennt den Marker NICHT —
 * sie erwartet den `spinning`-Prop; ein Name wie `codicon-sync~spin` ist eine
 * unbekannte Klasse und rendert gar kein Glyph (Icon 0×0 → Indikator unsichtbar).
 * Darum Marker abtrennen, als `spinning` weitergeben und zusätzlich die Klasse
 * `sf-icon-spin` setzen (dreht auch dann, wenn ein SDK-Build `spinning` ignoriert).
 */
function SfIcon({ name, size, className, ...rest }) {
  const spinning = String(name).includes('~spin')

  return jsx(Codicon, {
    name: String(name).replace(/~spin/g, ''),
    size,
    spinning,
    className: cn('sf-icon', spinning && 'sf-icon-spin', className),
    ...rest
  })
}

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
      showGlyph ? jsx(SfIcon, { name: glyph.icon, size: '0.8125rem' }) : showDot ? renderDot(row) : null,
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

function NumberInput({ value, onChange, min, max, step, title, 'aria-label': ariaLabel }) {
  return jsx(Input, {
    'aria-label': ariaLabel,
    className: 'sf-num',
    max,
    min,
    title,
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

/** Zerlegt #RGB/#RRGGBB/#RRGGBBAA in { base, alpha (0–100) }; null, wenn ungültig. */
function parseColorValue(value) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(value || '').trim())
  if (!match) return null
  let hex = match[1]
  if (hex.length === 3) hex = hex.split('').map(char => char + char).join('')
  return {
    base: `#${hex.slice(0, 6)}`,
    alpha: hex.length === 8 ? Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 100) : 100
  }
}

/** Setzt Alpha (0–100 %) auf eine #RRGGBB(A)-Farbe; 100 % kürzt zurück auf 6 Stellen. */
function withAlpha(value, percent) {
  const parsed = parseColorValue(value)
  const base = parsed ? parsed.base : '#000000'
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
  if (clamped >= 100) return base
  return `${base}${Math.round((clamped / 100) * 255).toString(16).padStart(2, '0')}`
}

/** Farbwahl-Zeile (Farb-Picker + Swatches + Hex-Eingabe + Deckkraft) für Design-Farben. */
function colorRowControl(value, onChange, resetLabel, opts = {}) {
  const parsed = parseColorValue(value)
  const base = parsed ? parsed.base : '#000000'

  // Basis-Farbe übernehmen — ein vorhandener Alpha-Wert bleibt erhalten.
  const commitBase = next => {
    const picked = String(next || '').trim()

    if (opts.alpha && picked && parsed && parsed.alpha < 100) {
      onChange(withAlpha(picked, parsed.alpha))
    } else {
      onChange(picked)
    }
  }

  return jsxs('div', {
    className: 'sf-row-control',
    children: [
      jsx('input', {
        'aria-label': opts.pickerLabel || 'color',
        className: 'sf-colorpick',
        onChange: event => commitBase(event.target.value),
        title: opts.pickerLabel,
        type: 'color',
        value: base
      }),
      jsx(GroupSwatches, {
        value: parsed ? parsed.base : value || null,
        onChange: next => commitBase(next || ''),
        clearLabel: resetLabel
      }),
      jsx(Input, {
        className: 'sf-num',
        maxLength: opts.alpha ? 9 : 7,
        onChange: event => onChange(String(event.target.value || '').trim()),
        value: value || ''
      }),
      opts.alpha
        ? jsx(NumberInput, {
            min: 0,
            max: 100,
            step: 5,
            title: opts.alphaLabel,
            value: parsed ? parsed.alpha : 100,
            onChange: percent => onChange(withAlpha(value, percent))
          })
        : null
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

function SectionHeader({ section, t, onToggle, onEdit, onNewHere, onPinToggle, dropActive, density }) {
  const open = !section.collapsed
  const color = section.color || null
  const isProject = section.kind === 'project'
  const isManual = section.kind === 'manual'
  const isPinned = section.kind === 'pinned'
  const isProjectPending = section.kind === 'project-pending'
  const title = section.titleKey ? t(section.titleKey) : section.title || t('ungrouped')
  const collapsible = section.kind !== 'ungrouped'
  const editable = section.kind === 'manual'
  // v1.26.0: manuelle Gruppen sind Container — sie tragen kein eigenes
  // `+`-Aktion-Icon mehr. Die `+`-Affordanz wandert komplett auf die
  // Kind-Projekt-Header (kind:'project'), wo sie semantisch korrekt
  // sitzt (neue Session in genau diesem Projektordner). v1.27.0: ein
  // fehlendes Projekt (isProjectMissing) bekommt KEIN `+` — in einem
  // nicht mehr existierenden Ordner lässt sich keine Session anlegen.
  const canNewHere = isProject && !section.isProjectMissing ? Boolean(onNewHere) : false
  const showDetail = section.kind !== 'ungrouped' && density !== 'compact'
  const liveMap = useValue($liveMap)
  const ctxInfo = useValue($ctxInfo)

  // Ordner-Größe für Projekt-Gruppen lazy nachladen (renderer-seitiger Cache,
  // 60 s TTL). Der Hook läuft IMMER — die Bedingung steckt IM Effekt. Läge der
  // Hook im `density === 'detailed'`-Zweig, änderte ein Dichte-Wechsel die
  // Hook-Anzahl und React wirft #300/#310 → die Pane landet in der
  // Error-Boundary ("failed to render"). Der Render-Smoketest sieht das nicht
  // (dort ist useEffect ein No-op); `npm run check` prüft es statisch.
  useEffect(() => {
    if (density === 'detailed' && section.kind === 'project' && section.cwd && section.items.length > 0) {
      void ensureFolderSize(section.cwd)
    }
  }, [density, section.kind, section.cwd, section.items.length])

  // Subzeile: bei Projekt-Gruppen der (gekürzte) Ordnerpfad, sonst — nur in
  // der Detailreich-Stufe — eine kurze Kennzahl (angepinnt/aktiv), wenn sie
  // etwas Echtes zu sagen hat. Nie erfunden: ohne Treffer bleibt die Zeile weg.
  const facts = []

  if (showDetail && density === 'detailed' && !isPinned) {
    const pinnedCount = section.items.filter(row => row.pinned).length
    const busyCount = section.items.filter(row =>
      ['thinking', 'streaming', 'tool', 'working'].includes(activityFor(row, $liveMap.get(), $activity.get()).kind)
    ).length

    if (pinnedCount > 0) {
      facts.push(t('groupFactsPinned', pinnedCount))
    }

    if (busyCount > 0) {
      facts.push(t('groupFactsBusy', busyCount))
    }
  }

  const subtextParts = []

  if (isProject && showDetail && section.cwd) {
    subtextParts.push(shortPath(section.cwd))
  } else if (isProjectPending && section.hintKey) {
    // Solange der Projekt-Baum lädt: kurzer Hinweis unter dem Titel, warum
    // alle Zeilen noch in EINER Sektion sitzen („Gruppierung folgt gleich").
    subtextParts.push(t(section.hintKey))
  }

  subtextParts.push(...facts)
  const subtext = subtextParts.join(' · ')

  // Detailreich-Zusatzzeile (v1.18.0): Datum der letzten Änderung,
  // Ordner-Größe (nur Projekt-Gruppen), Σ Live-Token-Verbrauch. Wird
  // komplett weggelassen, wenn KEIN Wert vorhanden ist — nie erfunden.
  let stats2Children = null

  if (density === 'detailed' && !isPinned && section.items.length > 0) {
    const stats = computeSectionStats(section, liveMap, ctxInfo)
    const parts = []

    if (Number.isFinite(stats.modifiedAt)) {
      parts.push(t('groupStat2Modified', fmtRelativeDate(stats.modifiedAt)))
    }

    if (Number.isFinite(stats.folderBytes)) {
      parts.push(t('groupStat2FolderSize', fmtBytes(stats.folderBytes)))
    }

    if (Number.isFinite(stats.tokensUsed) && Number.isFinite(stats.tokensMax) && stats.tokensMax > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((stats.tokensUsed / stats.tokensMax) * 100)))
      parts.push(t('groupStat2Tokens', {
        used: compactNumber ? compactNumber(stats.tokensUsed) : String(stats.tokensUsed),
        max: compactNumber ? compactNumber(stats.tokensMax) : String(stats.tokensMax),
        pct
      }))
    }

    if (parts.length) {
      stats2Children = parts.map((label, index) =>
        jsx('span', { key: `s2-${index}`, children: label })
      )
    }

    // Folder-Size wird weiter oben (Hook-Block, IMMER ausgeführt) lazy
    // nachgeladen — siehe useEffect am Komponentenanfang.
  }

  // Projekt-Identität aus Hermes Desktop übernehmen (projects.list → Farbe/
  // Icon): eigenes Icon zuerst (optional eingefärbt), sonst ein Farbpunkt wie
  // bei manuellen Gruppen, sonst unser Ordner-Icon mit Auf/Zu-Wechsel.
  const customIcon = isProject ? section.icon || null : null

  // Angepinnt-Sektion: Pin-Glyph als Lead, KEIN Caret — die Zeilen tragen
  // ihr Order/Anpinnen-Symbol bereits; ein zusätzliches Auf/Zu-Dreieck wäre
  // doppelt. Eingeklappt übernimmt das Pin-Icon selbst die Auf/Zu-Optik.
  const lead = isPinned
    ? jsx('span', {
        className: 'sf-group-lead-icon sf-group-lead-pin',
        children: jsx(Codicon, { name: open ? 'pin' : 'pin', size: '0.8rem' })
      })
    : isProject
    ? customIcon
      ? jsx('span', {
          className: 'sf-group-lead-icon',
          style: color ? { color } : undefined,
          children: jsx(Codicon, { name: customIcon, size: '0.8rem' })
        })
      : color
        ? jsx('span', { className: 'sf-group-dot', style: { background: color } })
        : jsx('span', {
            className: 'sf-group-lead-icon',
            children: jsx(Codicon, { name: open ? 'folder-opened' : 'folder', size: '0.8rem' })
          })
    : color
      ? jsx('span', { className: 'sf-group-dot', style: { background: color } })
      : section.kind === 'ungrouped'
        ? null
        : jsx('span', {
            className: 'sf-group-dot',
            style: { background: 'var(--ui-text-quaternary)', opacity: 0.5 }
          })

  const nameBlockChildren = [jsx('span', { className: 'sf-group-name', key: 'name', children: title })]

  if (subtext) {
    nameBlockChildren.push(jsx('span', { className: 'sf-group-sub', key: 'sub', children: subtext }))
  }

  if (stats2Children) {
    nameBlockChildren.push(jsx('span', { className: 'sf-group-stats-2', key: 'stats', children: stats2Children }))
  }

  const nameBlock = jsxs('span', {
    className: 'sf-group-text',
    children: nameBlockChildren
  })

  return jsxs('div', {
    className: cn(
      'sf-group-head',
      section.kind === 'ungrouped' && 'sf-group-unassigned',
      isProject && 'sf-group-project',
      isManual && 'sf-group-manual',
      isPinned && 'sf-group-pinned',
      subtext && 'sf-group-twoline',
      stats2Children && 'sf-group-threeline'
    ),
    'data-drop': dropActive ? 'true' : undefined,
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
    title: isProject
      ? section.cwd || title
      : isPinned
        ? t('pinnedSectionTip')
        : editable
          ? t('editGroup')
          : open
            ? t('collapse')
            : t('expand'),
    children: [
      isPinned ? null : jsx('span', { className: 'sf-group-caret', children: jsx(Caret, { open }) }),
      lead,
      nameBlock,
      dropActive
        ? jsx('span', { className: 'sf-group-drophint', children: t(isPinned ? 'dropPinHint' : 'dropHereHint', title) })
        : null,
      canNewHere
        ? jsx('span', {
            className: 'sf-group-actions',
            'data-sf-action': 'new',
            onClick: event => {
              event.stopPropagation()
              onNewHere(section)
            },
            title: t('newSessionHere'),
            children: jsx(Codicon, { name: 'add', size: '0.875rem' })
          })
        : isPinned
          ? jsx('span', {
              className: 'sf-group-actions',
              'data-sf-action': 'unpin',
              title: t('unpinAll'),
              onClick: event => {
                event.stopPropagation()
                onPinToggle && onPinToggle()
              },
              children: jsx(Codicon, { name: 'clear-all', size: '0.875rem' })
            })
          : editable
          ? jsx('span', {
              className: 'sf-group-actions',
              'data-sf-action': 'edit',
              title: t('editGroup'),
              onClick: event => {
                event.stopPropagation()
                onEdit()
              },
              children: jsx(Codicon, { name: 'edit', size: '0.875rem' })
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

function rowDetailsLine(row, t, liveEntry) {
  const parts = []
  const branch = String(row.branch || '').trim()

  if (branch) {
    parts.push(branch)
  }

  // Modell: die Listen-Zeile liefert es nicht immer; laufende Sessions kennen
  // es über die Live-Liste (session.active_list).
  const liveModel = liveEntry && liveEntry.model ? String(liveEntry.model) : ''
  const model = String(row.model || liveModel).split('/').pop()?.trim()

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

  // Zuletzt aktiv: nur für laufende Sessions bekannt — die wichtigste
  // Scan-Information neben dem Titel selbst.
  const lastActive = Number(liveEntry && liveEntry.lastActive) || 0

  if (lastActive > 0) {
    const age = fmtAge(lastActive, t)

    if (age) {
      parts.push(t('metaLastActive', age))
    }
  }

  return parts.join(' · ')
}

/** Aktivitäts-Zeile (Detailreich): aktueller Tool Call / Gedanke als
 *  eigene Info. Beim Wechsel schiebt die neue Info von unten hoch, die
 *  vorherige nach oben heraus (rein per CSS; der Vorwert kommt aus
 *  $activityPrev, damit kein Komponenten-State nötig ist). */
function ActivityTicker({ detail, previous, t, line }) {
  const glyph = ACTIVITY_GLYPHS[detail.kind] || ACTIVITY_GLYPHS.idle
  const label = activityLabel(t, detail)
  const fresh = Boolean(previous && previous.kind && Date.now() - (previous.at || 0) < 500)

  return jsxs('div', {
    className: 'sf-tab-activity',
    'data-line': line || 'extra',
    'data-kind': detail.kind,
    'data-tone': detail.kind === 'waiting' ? 'waiting' : detail.kind === 'error' ? 'error' : 'accent',
    children: [
      jsx(SfIcon, { key: 'ico', name: glyph.icon, size: '0.7rem' }),
      jsx('span', {
        key: 'tick',
        className: 'sf-activity-tick',
        children: [
          fresh
            ? jsx('span', {
                key: `out-${previous.at}`,
                className: 'sf-activity-info sf-activity-out',
                children: activityLabel(t, previous)
              })
            : null,
          jsx('span', {
            key: `in-${fresh ? previous.at : 'x'}-${detail.kind}-${detail.name || ''}`,
            className: 'sf-activity-info sf-activity-in',
            children: label
          })
        ]
      })
    ]
  })
}

function TabRow({ row, active, section, t, onOpen, onMore, groupsState, onAssign, dragging, setDragging, onRowPointerDown, justMoved }) {
  const settings = useValue($settings)
  const appDensity = useValue($appDensity)
  const activity = useValue($activity)
  const activityPrev = useValue($activityPrev)
  const live = useValue($liveMap)
  const ctxInfo = useValue($ctxInfo)
  const doneFx = useValue($doneFx)
  const tabsCfg = settings.tabs
  const cozy = tabsCfg.density === 'cozy'

  // v1.28.0: Pointer-basiertes Drag ersetzt natives HTML5-DnD (siehe
  // beginRowDrag() in SessionsPane — Begruendung dort). `tabBodyRef`
  // bleibt nur noch als potenzieller DOM-Anker fuer kuenftige Zwecke,
  // der eigentliche Drag-Einstieg laeuft ueber `onPointerDown` am Body-
  // Div, der `onRowPointerDown` (von der Pane injiziert) aufruft.
  // `justDraggedRef` unterdrueckt den synthetischen `click`, der nach
  // einem echten Drag-Drop sonst sofort `onOpen` ausloesen wuerde.
  const tabBodyRef = useRef(null)
  const justDraggedRef = useRef(false)

  const liveEntry = Object.values(live).find(entry => entry && entry.storedId === row.id) || null
  const justDone = Boolean(doneFx && doneFx[row.id])
  const activityDetail =
    activity[row.id] && activity[row.id].kind && activity[row.id].kind !== 'idle' && ACTIVITY_GLYPHS[activity[row.id].kind]
      ? activity[row.id]
      : null
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
            host.sessions.pin(row.id, !row.pinned)
          } catch (error) {
            host.notifyError(error, t('pin'))
          }
          // Eigener REST-Spiegel sofort nachziehen, damit der Pin-Filter ohne
          // Verzögerung reagiert (der SDK-Store schreibt die App-Ansicht, unsere
          // Zeilen bekommen die Flagge sonst erst beim nächsten Refreshtakt).
          pinnedSucceededAt = 0
          void refreshPinnedIds().then(() => scheduleSessionsRefresh(400))
        },
        children: row.pinned ? t('unpin') || 'Unpin' : t('pin')
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

  // Detailreich: eigene dritte Zeile. Komfortabel/Kompakt: die Aktivität
  // belegt die ZWEITE Zeile und blendet deren Detail-Inhalt aus, solange
  // die Aktion läuft.
  const activityInline = activityDetail && (infoDensity === 'comfortable' || infoDensity === 'compact') ? activityDetail : null
  const activityExtra = activityDetail && infoDensity === 'detailed' ? activityDetail : null
  const detailsLine = infoDensity !== 'compact' ? rowDetailsLine(row, t, liveEntry) : ''

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

  // Zeilen-Meta (App-Parität zum Filtermenü „Anzeigen"): Tokens, Kosten und
  // Profil — nur mit REST-Zeilen besetzt; RPC-Fall lässt sie weg (nie 0 lügen).
  if (settings.view?.showTokens && row.tokens > 0) {
    meta.push(jsx('span', { className: 'sf-tab-tokens', key: 'tok', title: t('rowMetaTokens'), children: compactNumber ? compactNumber(row.tokens) : String(row.tokens) }))
  }

  if (settings.view?.showCost && row.costUsd > 0) {
    meta.push(jsx('span', { className: 'sf-tab-cost', key: 'cost', title: t('rowMetaCost'), children: compactNumber ? compactNumber(row.costUsd) : String(row.costUsd) }))
  }

  if (settings.view?.showProfile && row.profile) {
    meta.push(jsx('span', { className: 'sf-tab-prof', key: 'prof', children: row.profile }))
  }

  const ctx = tabsCfg.showContext ? ctxInfo[row.id] : null
  let ctxNode = null

  if (ctx) {
    const ctxLevel = ctx.percent >= 90 ? 'high' : ctx.percent >= 70 ? 'warn' : 'ok'
    const usedLabel = `${ctx.est ? '~' : ''}${compactNumber ? compactNumber(ctx.used) : String(ctx.used)}`
    const maxLabel = compactNumber ? compactNumber(ctx.max) : String(ctx.max)
    // Bar-Style blendet die Zahl bewusst aus (optisches Minimum): die
    // Bar selbst ist der Indikator, Prozent-Zahl bleibt aber als
    // `title` + `aria-label` für Hover-Tooltip und Screenreader.
    const barStyle = tabsCfg.ctxStyle === 'bar'
    const pctValue = Math.max(0, Math.min(100, Number(ctx.percent) || 0))

    ctxNode = jsx('span', {
      className: 'sf-tab-ctx',
      'data-level': ctxLevel,
      'data-style': barStyle ? 'bar' : 'donut',
      'aria-label': t('ctxTooltip', usedLabel, maxLabel, String(ctx.percent)),
      role: 'img',
      key: 'ctx',
      style: { '--sf-ctx-pct': `${pctValue}%` },
      title: t('ctxTooltip', usedLabel, maxLabel, String(ctx.percent)),
      children: barStyle ? '' : `${ctx.percent}%`
    })
  }

  // Detailreich-Zusatz: Kontext-Auslastung als Text, wenn der Donut sie nicht ohnehin zeigt.
  const ctxData = ctxInfo[row.id]
  const ctxPct = ctxData ? Number(ctxData.percent) : NaN
  const statsLine =
    infoDensity === 'detailed' && !tabsCfg.showContext && Number.isFinite(ctxPct)
      ? t('metaContextShort', String(Math.round(ctxPct)))
      : ''

  const timeNode = tabsCfg.showTime
    ? jsx('span', { className: 'sf-tab-time', key: 'time', children: fmtAge(row.startedAt, t) })
    : null

  // Listen-Ansicht: der Kontext-Donut steht ganz rechts am Ende (nach der Zeit).
  // Grid-Ansicht: wie bisher vor der Zeit.
  if (tabsCfg.view === 'list') {
    if (timeNode) meta.push(timeNode)
    if (ctxNode) meta.push(ctxNode)
  } else {
    if (ctxNode) meta.push(ctxNode)
    if (timeNode) meta.push(timeNode)
  }

  // Komfortabel (Listen-Ansicht): EINE Spalte — Zähler · Zeit · Kontext wandern
  // als letzte Zeile unter den Text statt in die rechte Meta-Spalte.
  const metaInline = tabsCfg.view === 'list' && infoDensity === 'comfortable'

  const moreItems = [
    { icon: 'browser', key: 'tab', label: t('openTab'), run: () => onOpen(row, 'tab') },
    { icon: 'link-external', key: 'window', label: t('openWindow'), run: () => onOpen(row, 'window') },
    /* #full */
    { icon: 'terminal', key: 'terminal', label: t('termOpen'), run: () => onMore('terminal', row) },
    /* #end */
    { key: 'sep1', separator: true },
    { icon: 'edit', key: 'rename', label: t('renameMenu'), run: () => onMore('rename', row) },
    { icon: 'symbol-color', key: 'color', label: t('sessionColorAction'), run: () => onMore('color', row) },
    { icon: 'pin', key: 'pin', label: row.pinned ? t('unpin') : t('pin'), run: () => onMore('pin', row) },
    { icon: 'repo-forked', key: 'branch', label: t('branchSession'), run: () => onMore('branch', row) },
    { icon: 'folder', key: 'move', label: t('moveToProject'), run: () => onMore('move', row) },
    { key: 'sep2', separator: true },
    row.archived
      ? { icon: 'history', key: 'restore', label: t('archRestore'), run: () => onMore('restore', row) }
      : { icon: 'archive', key: 'archive', label: t('archiveSession'), run: () => onMore('archive', row) },
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
    ref: tabBodyRef,
    className: 'sf-tab',
    'data-active': active,
    'data-live': liveBucket,
    'data-dragging': dragging === row.id,
    'data-just-moved': justMoved ? 'true' : undefined,
    'data-done-fx': justDone ? 'true' : undefined,
    'data-density': infoDensity,
    onClick: () => {
      // v1.28.0: nach einem echten Pointer-Drag (Schwelle ueberschritten)
      // unterdrueckt justDraggedRef den synthetischen Click, den der
      // Browser nach pointerup ohnehin feuert — sonst oeffnet jeder
      // erfolgreiche Drop die Session zusaetzlich (onOpen).
      if (justDraggedRef.current) {
        justDraggedRef.current = false
        return
      }
      onOpen(row, null)
    },
    // v1.28.0 (ersetzt natives HTML5-DnD, siehe beginRowDrag() in
    // SessionsPane): Hermes Desktop selbst ist aus denselben Gruenden
    // (unzuverlaessiges dragstart/dragover/drop je nach Plattform,
    // u.a. Wayland) auf ein Pointer-basiertes Drag umgestiegen
    // (apps/desktop/src/app/chat/session-drag.ts). `onRowPointerDown`
    // uebernimmt Schwellenwert-Erkennung, Ghost-Chip und Hit-Test —
    // kein `draggable`/`onDragStart`/`onDragEnd` mehr nötig.
    onPointerDown: event => {
      if (event.button !== 0) return
      if (typeof onRowPointerDown === 'function') {
        onRowPointerDown(row, event, { setDragging, justDraggedRef })
      }
    },
    children: [
      lead,
      jsxs('div', {
        className: 'sf-tab-main',
        children: [
          jsx('div', { className: 'sf-tab-title', children: row.title || t('untitled') }),
          infoDensity !== 'compact' && detailsLine && !activityInline
            ? jsx('div', { className: 'sf-tab-details', children: detailsLine })
            : null,
          activityInline
            ? jsx(ActivityTicker, {
                key: 'activity-inline',
                detail: activityInline,
                previous: activityPrev[row.id] || null,
                line: 'inline',
                t
              })
            : null,
          activityExtra
            ? jsx(ActivityTicker, {
                key: 'activity',
                detail: activityExtra,
                previous: activityPrev[row.id] || null,
                line: 'extra',
                t
              })
            : null,
          (((cozy && tabsCfg.showPreview) || (tabsCfg.view === 'grid' && tabsCfg.gridPreview) || infoDensity === 'detailed') &&
          row.preview)
            ? jsx('div', { className: 'sf-tab-preview', children: row.preview })
            : null,
          statsLine ? jsx('div', { className: 'sf-tab-stats', children: statsLine }) : null,
          metaInline && meta.length
            ? jsx('div', { className: 'sf-tab-meta sf-tab-meta-inline', children: meta })
            : null
        ]
      }),
      !metaInline && meta.length ? jsx('div', { className: 'sf-tab-meta', children: meta }) : null,
      moreRowMenu,
      justDone && tabsCfg.doneFx === 'shine'
        ? jsx('span', { key: 'done-shine', className: 'sf-done-shine', 'aria-hidden': 'true' })
        : null
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
// (session.cwd.set), Archivieren (session.archive), Löschen
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

/* #full */
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
/* #end */

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

    await openFreshSession(createdId)
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

  // `session.cwd.set` erwartet die IN-MEMORY-session_id (8-stellig). Die
  // Session-Liste liefert `row.id` als stored_session_key (24-stellig) — ohne
  // Mapping landete der Call in „session not found" (4001). Lookup geht
  // zuerst über $liveMap (Poll-Snapshot), dann frisch über session.active_list.
  // Für eine NICHT live aufgeschlagene Session persistieren wir die Zuordnung
  // nicht (Gateway hat dafür keinen RPC) und zeigen stattdessen den Overlay-
  // Seed + einen Hinweis-Toast; die Zuordnung wird dann beim nächsten Öffnen
  // der Session dauerhaft, sobald sie live ist und einen cwd setzt.
  const runtimeId = await findLiveSessionIdByKey(row.id)
  let persisted = false

  if (runtimeId) {
    try {
      await host.request('session.cwd.set', { cwd, session_id: runtimeId })
      persisted = true
    } catch (error) {
      console.warn(`[${ID}] session.cwd.set bei Drag&Drop fehlgeschlagen`, error)
    }
  }

  // Live-Overlay-Seed: eine 0-Turn-Session taucht im Projekt-Baum nicht auf
  // (min_message_count=1) — der Seed hält sie in der Ziel-Sektion, bis der
  // erste Turn persistiert und der Baum übernimmt. Auch bei nicht-live
  // Sessions sinnvoll: sofortiges visuelles Feedback bis zum nächsten Open.
  const targetNode = $projectsList.get().find(entry => !entry.isNoProject && entry.path === cwd)

  if (targetNode) {
    const seeds = $sessionProjectSeed.get()
    seeds[row.id] = {
      id: targetNode.id,
      name: targetNode.label,
      color: targetNode.color,
      icon: targetNode.icon,
      path: targetNode.path,
      at: Date.now()
    }
    $sessionProjectSeed.set({ ...seeds })
  }

  // Zuordnung sofort sichtbar machen: Der Projekt-Baum ist die Gruppierungs-
  // grundlage — ohne Nachzug bliebe die Zeile bis zum 60-s-Takt in der alten
  // Sektion (live gemeldet: „Veränderungen via Drag and Drop werden nicht
  // gleich aktualisiert").
  void invalidateProjectTree()
  scheduleSessionsRefresh(400)

  if (persisted) {
    host.notify({ kind: 'success', message: `${CTX?.i18n?.t('moveToProject') || 'Projekt'} · ${project.name || cwd}` })
  } else {
    // Overlay-only-Pfad: der User sieht die Zuordnung sofort, aber die DB
    // behält bis zum nächsten Öffnen der Session noch den alten cwd. Ohne
    // diesen Toast wäre „Reload und Zuordnung weg wieder" ein verdeckter Bug.
    host.notify({
      kind: 'info',
      message: CTX?.i18n?.t('moveSessionNotLive')
        || 'Zuordnung sichtbar — dauerhaft erst nach dem Öffnen der Session.'
    })
  }
}

async function archiveSessionRow(row) {
  try {
    await host.request('session.archive', { archived: true, session_id: row.id })
    scheduleSessionsRefresh(800)
  } catch (error) {
    host.notifyError(error, CTX?.i18n?.t('archiveSession') || 'Archivieren')
  }
}

/** Archiviertes wiederherstellen — zieht beide Listen (aktiv + Archiv) nach. */
async function restoreSessionRow(row) {
  try {
    await host.request('session.archive', { archived: false, session_id: row.id })
    archivedSucceededAt = 0
    kickAppRefresh()
    scheduleSessionsRefresh(400)
  } catch (error) {
    host.notifyError(error, CTX?.i18n?.t('archRestore') || 'Wiederherstellen')
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
    // Bewusst nur Web-Standard: navigator.clipboard funktioniert in beiden
    // Builds (Catalog + Full) ohne die Desktop-Bridge.
    await navigator.clipboard.writeText(row.id)
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
  return { open: false, mode: 'create', groupId: null, name: '', color: null, projectIds: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Projekt-Dialog — Erstellen + Bearbeiten (Name, Ordner, Farbe) über dieselben
// Gateway-RPCs wie die Hermes-Sidebar (projects.create/update/add_folder/
// remove_folder/set_primary). Ordner kommen über den nativen/remote-fähigen
// Picker (selectPaths-Door).
// ─────────────────────────────────────────────────────────────────────────────

function newProjectDialogState() {
  return { open: false, mode: 'create', project: null, name: '', color: null, folders: [], primary: '', busy: false, error: '' }
}

// Ordner-Beitrag des Projekt-Dialogs, build-abhängig:
// - Catalog (Default): Manuelleingabe — das SDK hat keinen Picker-Door
//   (Anfrage auf #116305), und die Desktop-Bridge ist dort tabu (Regel 8).
// - Full (Override im #full-Block): nativer Ordner-Picker wie bisher.
let projFolderAddControl = ({ t, state, folderDraft, setFolderDraft, onTyped }) =>
  jsxs('span', {
    style: { display: 'inline-flex', alignItems: 'center', gap: 4 },
    children: [
      jsx(Input, {
        'aria-label': t('projFolders'),
        onChange: event => setFolderDraft(event.target.value),
        placeholder: '/pfad/zum/projekt',
        style: { minWidth: 180 },
        value: folderDraft
      }),
      jsx(Button, { disabled: state.busy || !folderDraft.trim(), onClick: onTyped, size: 'sm', variant: 'ghost', children: jsxs('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 }, children: [jsx(Codicon, { name: 'add', size: '0.75rem' }), t('projAddFolder')] }) })
    ]
  })

/* #full */
projFolderAddControl = ({ t, state, onPick }) =>
  jsx(Button, { disabled: state.busy, onClick: () => void onPick(), size: 'sm', variant: 'ghost', children: jsxs('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 }, children: [jsx(Codicon, { name: 'add', size: '0.75rem' }), t('projAddFolder')] }) })
/* #end */

function ProjectDialog({ state, setState, t }) {
  // Catalog-Build: manueller Ordnerpfad (kein nativer Picker ohne Desktop-
  // Bridge). Im Full-Build wird der Draft nicht gebraucht, aber schadet nicht.
  // Hook MUSS vor jedem frühen return stehen (Rules of Hooks) — die Komponente
  // ist dauerhaft gemountet (full/plugin.js: jsx(ProjectDialog, …) ohne
  // state.open-Gate), nur die Zahl der Hooks darf sich zwischen Renders nie
  // ändern, sonst React #310 beim ersten Öffnen des Dialogs.
  const [folderDraft, setFolderDraft] = useState('')

  if (!state.open) {
    return null
  }

  const close = () => setState({ ...newProjectDialogState() })
  const editing = state.mode === 'edit' ? state.project : null
  const canSubmit = state.name.trim().length > 0 && state.folders.length > 0 && !state.busy

  // Gemeinsamer Einsprung: Pfad normalisieren + in den Dialog-State übernehmen.
  const addFolderPath = rawPath => {
    const path = String(rawPath || '').trim().replace(/[\\/]+$/, '')

    if (!path || state.folders.includes(path)) {
      return false
    }

    setState({ ...state, folders: [...state.folders, path], primary: state.primary || path, error: '' })

    return true
  }

  /* #full */
  const addFolder = async () => {
    addFolderPath(await pickProjectFolder())
  }
  /* #end */

  // Catalog-Build: Ordner per Hand eintippen (SDK hat keinen Picker-Door,
  // Anfrage läuft auf #116305). Im Full-Build unbenutzt, aber harmlos.
  const addTypedFolder = () => {
    if (addFolderPath(folderDraft)) {
      setFolderDraft('')
    }
  }

  const removeFolder = path => {
    const folders = state.folders.filter(entry => entry !== path)

    setState({ ...state, folders, primary: state.primary === path ? (folders[0] || '') : state.primary })
  }

  const submit = async () => {
    if (!canSubmit) {
      setState({ ...state, error: !state.name.trim() ? t('projNeedName') : t('projNeedFolder') })

      return
    }

    setState({ ...state, busy: true, error: '' })

    try {
      if (editing) {
        // Edit: Basis-Update + Ordner-Delta gegenüber dem Projekt-Datensatz.
        await updateProject(editing.id, { name: state.name.trim(), color: state.color })

        const existing = new Set((editing.folders || []).map(f => f.path || f))

        for (const folder of state.folders) {
          if (!existing.has(folder)) {
            await addProjectFolder(editing.id, folder)
          }
        }

        for (const folder of existing) {
          if (!state.folders.includes(folder)) {
            await removeProjectFolder(editing.id, folder)
          }
        }

        if (state.primary && state.primary !== editing.primary_path) {
          await setProjectPrimaryFolder(editing.id, state.primary)
        }

        host.notify({ kind: 'success', message: t('projSaved') })
      } else {
        await createProject({ name: state.name.trim(), folders: state.folders, color: state.color, use: false })
        host.notify({ kind: 'success', message: t('projCreated') })
      }

      close()
    } catch (error) {
      setState({ ...state, busy: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return jsxs(Dialog, {
    open: true,
    onOpenChange: open => {
      if (!open) {
        close()
      }
    },
    children: [
      jsx(DialogContent, {
        className: 'sf-dialog',
        children: jsxs('div', {
          className: 'sf-dialog-inner',
          children: [
            jsx(DialogHeader, { children: jsx(DialogTitle, { children: editing ? t('projEdit') : t('newProject') }) }),
            jsxs('div', {
              className: 'sf-dialog-body',
              children: [
                jsx(Input, {
                  'aria-label': t('projName'),
                  onChange: event => setState({ ...state, name: event.target.value }),
                  placeholder: t('projNamePlaceholder'),
                  value: state.name
                }),
                jsxs('div', {
                  className: 'sf-dialog-label',
                  children: [
                    jsx('span', { children: t('projFolders') }),
                    projFolderAddControl({ t, state, folderDraft, setFolderDraft, onPick: addFolder, onTyped: addTypedFolder })
                  ]
                }),
                state.folders.length
                  ? jsx('div', {
                      className: 'sf-proj-folders',
                      children: state.folders.map(folder =>
                        jsxs('div', {
                          className: 'sf-proj-folder',
                          children: [
                            jsx(Codicon, { name: 'folder', size: '0.875rem' }),
                            jsx('span', { className: 'sf-proj-folder-path', title: folder, children: folder }),
                            state.primary === folder ? jsx('span', { className: 'sf-proj-folder-tag', children: t('projPrimary') }) : null,
                            state.primary !== folder
                              ? jsx('button', {
                                  'aria-label': t('projMakePrimary'),
                                  title: t('projMakePrimary'),
                                  type: 'button',
                                  onClick: () => setState({ ...state, primary: folder }),
                                  children: jsx(Codicon, { name: 'target', size: '0.75rem' })
                                })
                              : null,
                            jsx('button', {
                              'aria-label': t('projRemoveFolder'),
                              title: t('projRemoveFolder'),
                              type: 'button',
                              onClick: () => removeFolder(folder),
                              children: jsx(Codicon, { name: 'close', size: '0.75rem' })
                            })
                          ]
                        }, folder)
                      )
                    })
                  : null,
                jsxs('div', {
                  className: 'sf-dialog-label',
                  children: [jsx('span', { children: t('projColor') })]
                }),
                jsx(GroupSwatches, {
                  clearLabel: t('clearColor'),
                  value: state.color,
                  onChange: color => setState({ ...state, color })
                }),
                state.error ? jsx('div', { className: 'sf-dialog-error', children: state.error }) : null
              ]
            }),
            jsxs(DialogFooter, {
              children: [
                jsx(Button, { onClick: close, variant: 'ghost', children: t('projCancel') }),
                jsx(Button, { disabled: !canSubmit, onClick: () => void submit(), children: state.busy ? '…' : editing ? t('projSave') : t('projCreate') })
              ]
            })
          ]
        })
      })
    ]
  })
}

function GroupDialog({ state, setState, t }) {
  const groupsState = $groupsState.get()
  const projectsList = $projectsList.get()
  const editing = state.mode === 'edit' ? groupsState.groups.find(entry => entry.id === state.groupId) : null

  // Auswahl-State: state.projectIds (Array<string>). Beim Wechsel in den
  // Edit-Modus greift der bestehende Wert, bis der User etwas ändert.
  const editingIds = editing && Array.isArray(editing.projectIds) ? editing.projectIds : []
  const effectiveIds = Array.isArray(state.projectIds)
    ? state.projectIds
    : (state.mode === 'edit' ? editingIds : [])

  // Verfügbare Projekte (ohne Home/NoProject) alphabetisch sortiert.
  const available = projectsList
    .filter(node => node && !node.isNoProject && node.id)
    .slice()
    .sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')))

  const toggleProject = id => {
    if (!id) return
    const set = new Set(effectiveIds)
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
    setState({ ...state, projectIds: Array.from(set) })
  }

  const commit = () => {
    const name = state.name.trim()

    if (state.mode === 'create') {
      try {
        createGroup(name || t('newGroup'), state.color, effectiveIds)
      } catch (error) {
        setState({ ...state, error: String((error && error.message) || error) })
        return
      }
    } else if (state.mode === 'edit' && editing) {
      updateGroup(editing.id, { name: name || editing.name, color: state.color, projectIds: effectiveIds })
    }

    setState(newGroupDialogState())
  }

  // Save-Button: ≥ 1 Projekt muss ausgewählt sein.
  const canSubmit = effectiveIds.length > 0

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
                  if (event.key === 'Enter' && canSubmit) {
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
              jsx('label', { className: 'sf-dialog-label', children: t('groupProjectsLabel') }),
              jsx('div', { className: 'sf-proj-folders', children:
                available.length === 0
                  ? jsx('div', { className: 'sf-proj-folder-empty', children: t('groupNoProjectsAvailable') })
                  : available.map(node => {
                      const checked = effectiveIds.includes(node.id)
                      const alreadyInOtherGroup = (() => {
                        for (const g of groupsState.groups) {
                          if (g.id === editing?.id) continue
                          if (Array.isArray(g.projectIds) && g.projectIds.includes(node.id)) return g.name || ''
                        }
                        return null
                      })()
                      return jsxs('label', {
                        className: 'sf-cproj-item',
                        'data-checked': checked ? 'true' : 'false',
                        title: alreadyInOtherGroup ? t('groupProjectInOtherGroup', { name: alreadyInOtherGroup }) : node.path || '',
                        children: [
                          jsx('input', {
                            type: 'checkbox',
                            checked,
                            disabled: false,
                            onChange: () => toggleProject(node.id)
                          }),
                          jsx('span', {
                            className: 'sf-cproj-dot',
                            style: node.color ? { background: node.color } : undefined
                          }),
                          jsx('span', { className: 'sf-cproj-label', children: node.label || node.id }),
                          alreadyInOtherGroup
                            ? jsx('span', { className: 'sf-cproj-tag', children: t('groupInOtherGroupTag', { name: alreadyInOtherGroup }) })
                            : null
                        ]
                      }, node.id)
                    })
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
          !canSubmit
            ? jsx('div', { className: 'sf-dialog-hint', children: t('groupProjectsEmpty') })
            : null,
          state.error ? jsx('div', { className: 'sf-dialog-error', children: state.error }) : null,
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
                disabled: !canSubmit,
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

/** „Mehr anzeigen/Weniger anzeigen“ — Begrenzung der sichtbaren Einträge je Gruppe (v1.11). */
function ShowMoreRow({ hidden, expanded, onClick, t }) {
  return jsxs('button', {
    type: 'button',
    className: 'sf-showmore',
    'data-expanded': expanded ? 'true' : 'false',
    onClick,
    children: [
      jsx(Codicon, { name: expanded ? 'chevron-up' : 'chevron-down', size: '0.75rem' }),
      jsx('span', { children: expanded ? t('showLess') : t('showMore', hidden) })
    ]
  })
}

// Synthetische „Sektion" für die flache Aktiv-Liste (ohne Kopfzeilen).
const FLAT_SECTION = { color: null, collapsed: false, items: [], key: 'flat-active', kind: 'ungrouped', title: null, titleKey: null }

// ── App-Nav-Zeile (v1.20): Icon-Buttons für die ersten Sidebar-Sektionen ────
// Spiegel von SIDEBAR_NAV der App-Chat-Sidebar (Neue Session, Fähigkeiten,
// Messaging, Artefakte, Geplante Jobs) + Kanban-Beitrag (Plugin, Route
// /kanban). Buttons navigieren über host.navigate (App-Router), Neue Session
// läuft über den bestehenden Projekt-Scope-Pfad (startNewProjectSession).
// Kanban ist Plugin: bleibt der Button weg, statt einen toten Button zu
// zeigen (Feature-Detect unten — niemals geraten).
const SF_NAV_ROUTES = new Set(['/capabilities', '/messaging', '/artifacts', '/cron', '/kanban'])

const NAV_APPS = [
  { id: 'new-session', icon: 'robot', route: null, labelKey: 'navAppNewSession' },
  { id: 'capabilities', icon: 'symbol-misc', route: '/capabilities', labelKey: 'navAppCapabilities' },
  { id: 'messaging', icon: 'comment', route: '/messaging', labelKey: 'navAppMessaging' },
  { id: 'artifacts', icon: 'files', route: '/artifacts', labelKey: 'navAppArtifacts' },
  { id: 'cron', icon: 'watch', route: '/cron', labelKey: 'navAppCron' },
  { id: 'kanban', icon: 'project', route: '/kanban', labelKey: 'navAppKanban' }
]

// ── Status-Pips auf den Nav-Buttons (v1.20): Kanban + Geplante Jobs ─────────
// Ehrliche Quellen über die Desktop-Bridge-REST-Tür, dieselben
// Endpunkte, die auch die App-Sidebar/das App-Plugin selbst lesen:
//   Kanban → GET /api/plugins/kanban/board → Spalten-Counts
//            (running/blocked/review — wie die Kanban-Statusbar-Pill zählt).
//   Cron   → GET /api/cron/jobs → jobState()-Replik der App
//            (state-String, sonst enabled-Flag; app/cron/job-state.ts).
// Fehlt die Bridge oder schlägt ein Fetch fehl, bleibt der jeweilige Eintrag
// null — kein Punkt, kein erfundener Zustand.
const NAV_STATUS_POLL_MS = 60_000

const $navStatus = atom({ kanban: null, cron: null, kanbanOk: false })

let navStatusInFlight = null

/** Zahlen einer Kanban-Response auf Status mappen. board=null → idle-Signal
 *  (Plugin da, aber nichts in Flight). */
function kanbanBoardToStatus(board) {
  const columns = Array.isArray(board?.columns) ? board.columns : []
  const count = name => {
    const col = columns.find(entry => entry && entry.name === name)

    return Array.isArray(col?.tasks) ? col.tasks.length : 0
  }

  const running = count('running')
  const blocked = count('blocked')
  const review = count('review')
  const ready = count('ready')

  if (running > 0) {
    return { state: 'running', count: running }
  }

  if (blocked > 0) {
    return { state: 'blocked', count: blocked }
  }

  if (review > 0) {
    return { state: 'review', count: review }
  }

  if (ready > 0) {
    return { state: 'ready', count: ready }
  }

  return { state: 'idle', count: 0 }
}

/** Effektiver Cron-Job-Zustand — 1:1-Replik der App-Logik
 *  (app/cron/job-state.ts jobState): expliziter state-String gewinnt,
 *  sonst enabled-Flag. */
function cronJobState(job) {
  const state = typeof job?.state === 'string' ? job.state.trim() : ''

  return state || (job?.enabled === false ? 'disabled' : 'scheduled')
}

/** Jobs-Liste auf den höchstrangigsten Zustand mappen (error > paused >
 *  running/scheduled > disabled/completed → idle). */
function cronJobsToStatus(jobs) {
  const rows = Array.isArray(jobs) ? jobs : []

  if (!rows.length) {
    return { state: 'idle', count: 0 }
  }

  const by = name => rows.filter(job => cronJobState(job) === name).length
  const error = by('error')
  const paused = by('paused')
  const running = by('running')
  const scheduled = by('scheduled')

  if (error > 0) {
    return { state: 'error', count: error }
  }

  if (paused > 0) {
    return { state: 'paused', count: paused }
  }

  if (running > 0) {
    return { state: 'running', count: running }
  }

  if (scheduled > 0) {
    return { state: 'scheduled', count: scheduled }
  }

  return { state: 'idle', count: 0 }
}

/** Tone-Name fürs CSS (data-tone am Button). 'off' = kein Punkt. */
function navStatusTone(status) {
  if (!status) {
    return 'off'
  }

  if (status.state === 'running' || status.state === 'scheduled') {
    return 'ok'
  }

  if (status.state === 'blocked' || status.state === 'error') {
    return 'bad'
  }

  if (status.state === 'review' || status.state === 'paused') {
    return 'warn'
  }

  if (status.state === 'ready') {
    return 'info'
  }

  return 'off'
}

/** Beide Status-Quellen nachziehen (Bridge-gated, In-Flight-Guard). */
function refreshNavStatus() {
  /* #full */
  if (navStatusInFlight) {
    return navStatusInFlight
  }

  navStatusInFlight = (async () => {
    try {
      const bridge = globalThis.window?.hermesDesktop

      if (!bridge || typeof bridge.api !== 'function') {
        return
      }

      const [kanbanBoard, cronJobs] = await Promise.all([
        bridge.api({ path: '/api/plugins/kanban/board', timeoutMs: 8000 }).catch(() => null),
        bridge.api({ path: '/api/cron/jobs', timeoutMs: 8000 }).catch(() => null)
      ])

      $navStatus.set({
        kanban: kanbanBoard ? kanbanBoardToStatus(kanbanBoard) : null,
        cron: Array.isArray(cronJobs) ? cronJobsToStatus(cronJobs) : null,
        // Kanban-Präsenz = Board-Endpoint hat geantwortet (404/Fehler → null).
        // Ersetzt den alten DOM-Probe-Weg ([data-tour^=…]) — ein Signal
        // weniger, keine Markup-Kopplung (Regel 8, sauberer in beiden Builds).
        kanbanOk: Boolean(kanbanBoard)
      })
      $restMirror.set(true)
    } catch {
      // Bridge nicht da / Netzwerk — alter Stand bleibt, kein Crash.
    } finally {
      navStatusInFlight = null
    }
  })()

  return navStatusInFlight
  /* #end */
  /* #catalog-only */
  // Catalog-Build: kein REST-Door im SDK (Anfrage auf #116305) — kanbanOk
  // bleibt false, also bleibt der Kanban-Button in NavAppsBar ganz aus
  // (showKanban-Gate unten); der Cron-Pip entfällt ebenso ehrlich.
  /* #end */
}

function navigateAppRoute(route) {
  if (typeof route !== 'string' || !SF_NAV_ROUTES.has(route)) {
    return false
  }

  host.navigate(route)
  return true
}

// Feature-Detect für das Kanban-Plugin — NUR über die öffentliche REST-Tür
// des Kanban-Plugins (GET /api/plugins/kanban/board, siehe refreshNavStatus):
// Antwortet der Endpoint, ist das Plugin da; 404/Fehler → Button weg. Der
// frühere DOM-Probe-Weg (Sidebar-Nav-Marker + Drawer-Klasse) ist entfernt —
// Catalog-Regel 8 erlaubt kein App-Markup-Querying, und ein REST-Handshake
// ist ohnehin das ehrlichere Signal (kann nicht durch Kosmetik-Refactors
// der App brechen).

function NavAppsBar({ t, onNewSession }) {
  const status = useValue($navStatus)
  const showKanban = status.kanbanOk === true
  const buttons = []

  // i18n-Key je Zustand (geteilt zwischen Kanban und Geplanten Jobs).
  const stateKeyMap = {
    running: 'navStatusRunning',
    scheduled: 'navStatusScheduled',
    blocked: 'navStatusBlocked',
    error: 'navStatusError',
    review: 'navStatusReview',
    ready: 'navStatusReady',
    paused: 'navStatusPaused'
  }

  for (const item of NAV_APPS) {
    if (item.id === 'kanban' && !showKanban) {
      continue
    }

    // Status-Pips nur für Kanban + Geplante Jobs (v1.20) — die anderen
    // Buttons haben keine plugin-erreichbare Aktivitäts-Quelle.
    const statusFor = item.id === 'kanban' && showKanban ? status.kanban : item.id === 'cron' ? status.cron : null
    const tone = navStatusTone(statusFor)
    const stateKey = statusFor ? stateKeyMap[statusFor.state] : null
    const base = t(item.labelKey)
    const label = stateKey && tone !== 'off' ? `${base} · ${t(stateKey, statusFor.count)}` : base

    buttons.push(
      jsx(
        'button',
        {
          type: 'button',
          className: 'sf-navapps-btn',
          'data-nav': item.id,
          'data-status': tone,
          onClick: () => {
            if (item.route) {
              navigateAppRoute(item.route)
            } else {
              onNewSession()
            }
          },
          title: label,
          'aria-label': label,
          children: jsx(Codicon, { name: item.icon, size: '0.875rem' })
        },
        item.id
      )
    )
  }

  return jsxs(
    'div',
    {
      className: 'sf-navapps',
      'data-kanban': showKanban ? 'on' : 'off',
      children: [buttons, jsx('span', { className: 'sf-navapps-rule' })]
    }
  )
}

function SessionsPane() {
  const t = usePluginI18n(ID)
  // v1.28.0 "latest ref"-Paar fuer den Pointer-Drag-Controller (siehe
  // beginRowDrag): der Controller lebt zwischen pointerdown und pointerup
  // (document-Listener, kein React-Lifecycle) und muss beim Commit immer
  // den AKTUELLEN rows/flatSections-Stand sehen, nicht den vom Render, in
  // dem der Drag gestartet wurde. Deklaration VOR dem ersten Zuweisen.
  const rowsRef = useRef([])
  const flatSectionsRef = useRef([])
  const rows = useValue($sessions)
  rowsRef.current = rows
  const error = useValue($sessionsError)
  const groupsState = useValue($groupsState)
  const settings = useValue($settings)
  // Abo für die „Aktiv"-Sortierung: hält die Reihenfolge bei jedem Live-Poll
  // (30 s) frisch; die Event-Zeiten liest lastActivityAt beim Berechnen.
  const liveForSort = useValue($liveMap)
  const focused = useValue(host.state.focusedStoredSessionId)
  const active = useValue(host.state.activeSessionId)
  const [dialog, setDialog] = useState(() => newGroupDialogState())
  const [rowDialog, setRowDialog] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [showAllSections, setShowAllSections] = useState(() => new Set())
  const [dragOverKey, setDragOverKey] = useState(null)
  const [justMovedId, setJustMovedId] = useState(null)
  const [filterText, setFilterText] = useState('')
  const [filterMode, setFilterMode] = useState('all')
  const [projDialog, setProjDialog] = useState(() => newProjectDialogState())
  const [projConfirmDelete, setProjConfirmDelete] = useState(null)
  const loadPhase = useValue($loadPhase)
  const projectsList = useValue($projectsList)
  // $dragActive muss in den Dependencies stehen, sonst re-rendert buildSections
  // beim Drag-Start nicht und die leere Pinned-Drop-Area taucht nicht auf.
  const dragActive = useValue($dragActive)
  // REST-Spiegel da? (steuert die Pinned-/Archiv-Subtabs, siehe quickFilter)
  const restMirror = useValue($restMirror)

  // buildSections liest außer rows/groups/settings auch den Projekt-Baum
  // ($projectsList) und den Live-/Aktivitäts-Status (Status-Buckets) — beides
  // muss in den Dependencies stehen, sonst reagiert die Gruppierung nicht auf
  // Baum- oder Live-Updates.
  const sections = useMemo(() => buildSections(), [rows, groupsState, settings, projectsList, liveForSort, dragActive])
  const totalCount = sections.reduce((sum, section) => sum + section.items.length, 0)
  const maxVisible = Math.floor(clampNumber(settings.tabs.maxVisible, 0, 200, 0))

  // Filter-Leiste (wie die Hermes-Sessionliste): Textsuche über Titel/Branch/
  // Vorschau + Schnellfilter (alle/angepinnt/aktiv). Rein clientseitig, nichts
  // wird persistiert — ein Pane-Reload setzt sie zurück, genau wie die App.
  const needle = filterText.trim().toLowerCase()
  // „Aktiv" filtert seit v1.17.1 nichts mehr heraus: Der Subtab zeigt ALLE
  // Sessions und ordnet sie absteigend nach der letzten Aktivität — aktive
  // Sessions stehen dadurch automatisch oben, inaktive folgen darunter.
  const matchesFilter = row => {
    if (!needle) {
      return true
    }

    return [row.title, row.branch, row.preview].some(value => String(value || '').toLowerCase().includes(needle))
  }

  // Suche UND der Aktiv-/Angepinnt-Modus gelten als aktive Filter (Zähler,
  // Leerzustand).
  const filterActive = Boolean(needle) || filterMode === 'active' || filterMode === 'pinned'
  const filteredSections = useMemo(() => {
    // Angepinnt-Modus (v1.24.0): NUR die Pinned-Sektion zeigen — die Zeilen
    // sind bereits der Pin-Spiegel, Suche greift wie überall. Ohne Treffer
    // gilt der normale Filter-Leerzustand.
    if (filterMode === 'pinned') {
      return sections
        .filter(section => section.kind === 'pinned')
        .map(section => ({ ...section, items: section.items.filter(matchesFilter) }))
        .filter(section => section.items.length > 0 || section.isDropPlaceholder)
    }

    if (!needle && filterMode !== 'active') {
      return sections
    }

    const activityNow = $activity.get()
    const sortActive = filterMode === 'active'

    return sections
      .map(section => {
        const items = section.items.filter(matchesFilter)
        const ordered = sortActive
          ? [...items].sort((a, b) => lastActivityAt(b, liveForSort, activityNow) - lastActivityAt(a, liveForSort, activityNow))
          : items

        return { ...section, items: ordered }
      })
      // Platzhalter-Sektionen (Pinned-Drop-Area während eines Drags) dürfen
      // auch ohne Items durchrutschen — sonst verschwindet die Drop-Area,
      // bevor der User sie überhaupt sehen konnte.
      .filter(section => section.items.length > 0 || section.isDropPlaceholder)
  }, [sections, needle, filterMode, liveForSort])

  const activeMode = filterMode === 'active'
  const archivedMode = filterMode === 'archived'

  // Archiv-Modus: Zeilen on demand über REST laden (60 s TTL), sobald der
  // Modus betreten wird — nicht vorher (kein Dauer-Poll auf eine Randliste).
  const archivedRows = useValue($archivedRows)

  useEffect(() => {
    if (archivedMode && (Date.now() - archivedSucceededAt > ARCHIVED_TTL_MS)) {
      void refreshArchivedSessions()
    }
  }, [archivedMode])

  // „Aktiv" als flache, kopfzeilenfreie Liste: laufende Sessions oben,
  // darunter nur Sessions mit HEUTIGER Aktivität (lokale Mitternacht als
  // Grenze) — je absteigend nach letzter Aktivität.
  const activeFlatRows = useMemo(() => {
    if (!activeMode) {
      return []
    }

    const live = $liveMap.get()
    const activity = $activity.get()
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const dayStart = startOfToday.getTime()
    const hideCron = settings.tabs.hideCron
    const items = []

    for (const row of rows) {
      if (hideCron && row.source === 'cron') {
        continue
      }

      if (!matchesFilter(row)) {
        continue
      }

      const kind = activityFor(row, live, activity).kind
      const busy = ['waiting', 'streaming', 'working', 'tool', 'thinking'].includes(kind)
      const last = lastActivityAt(row, live, activity)

      if (!busy && last < dayStart) {
        continue
      }

      items.push({ row, busy, last })
    }

    items.sort((a, b) => (b.busy ? 1 : 0) - (a.busy ? 1 : 0) || b.last - a.last)
    return items.map(entry => entry.row)
  }, [rows, activeMode, needle, liveForSort, settings])

  // Ein kurzer "Gelandet"-Flash auf der Zeile zeigt deutlich, wo eine Session
  // nach einem Drag&Drop angekommen ist (Zuordnung/Projekt-Verschieben).
  const flashJustMoved = sessionId => {
    setJustMovedId(sessionId)
    window.setTimeout(() => setJustMovedId(current => (current === sessionId ? null : current)), 650)
  }

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

    /* #full */
    if (action === 'terminal') {
      void openSessionInTerminalRow(row)

      return
    }
    /* #end */

    if (action === 'branch') {
      void branchSessionRow(row)

      return
    }

    if (action === 'archive') {
      void archiveSessionRow(row)

      return
    }

    if (action === 'restore') {
      void restoreSessionRow(row)

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
        .openSession(row.id, { intent: intent || effectiveOpenIntent() })
        .catch(err => host.notifyError(err, t('errOpen')))
    } catch (err) {
      host.notifyError(err, t('errOpen'))
    }
  }

  const assign = (sessionId, groupId) => {
    // Bug-Fix v1.25.1: Wenn die Session bereits gepinnt war und der User sie
    // per DnD aus der Pinned-Sektion rauszieht, muss das pinned-Flag aktiv
    // entpinnt werden — sonst bleibt sie unsichtbar (sie ist in pinnedItems
    // aber nicht mehr in ungrouped, weil assign nur die Gruppen-Mitgliedschaft
    // aendert).
    const targetRow = rows.find(entry => entry.id === sessionId)
    if (targetRow && targetRow.pinned) {
      try {
        host.sessions.pin(sessionId, false)
      } catch {
        /* Pin-Loeschen fehlgeschlagen - Refresh raeumt auf */
      }
      pinnedSucceededAt = 0
      void refreshPinnedIds().then(() => scheduleSessionsRefresh(400))
    }
    assignSession(sessionId, groupId)
    setDragging(null)
  }

  const toggleShowAll = key => {
    haptic('tap')
    setShowAllSections(prev => {
      const next = new Set(prev)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
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
        color: group.color || null,
        projectIds: Array.isArray(group.projectIds) ? [...group.projectIds] : []
      })
    }
  }

  const newSessionHere = section => {
    haptic('tap')
    void startNewSessionInCwd(section.cwd, section.title || '')
  }

  // Zieht bei einem Projekt-Header die echte Projekt-Verschiebung
  // (session.cwd.set für die live Session) — sichtbar UND wirksam, kein reines
  // Anzeige-Umhängen. Manuelle/ungruppierte Header weisen weiterhin nur die
  // Firefox-artige Gruppe zu.
  //
  // v1.28.0: HTML5-DnD (dragstart/dragover/drop) ist komplett entfernt.
  // Grund: Hermes Desktop selbst hat die eigene Sidebar aus genau diesem
  // Mechanismus herausgezogen (apps/desktop/src/app/chat/session-drag.ts,
  // Kommentar dort: "riding the native DnD layer meant ... failure modes
  // ... A pointer session has none of those failure modes.") — nach
  // sechs Fix-Versuchen (v1.25.1–v1.27.7) auf dem nativen Pfad bestätigt
  // das 1:1 das Symptombild hier (ListView: dragstart feuert, aber nie ein
  // dragover/drop — Browser/Compositor schluckt die Drag-Session nach dem
  // Start). `beginRowDrag()` unten ist die Plugin-Variante derselben
  // Pointer-Architektur: Schwellenwert, Ghost-Chip, Hit-Test gegen
  // `[data-sf-drop-key]`-Marker statt dragover/drop-Events.
  const canSectionDrop = section =>
    section.kind === 'manual' ||
    section.kind === 'ungrouped' ||
    section.kind === 'pinned' ||
    (section.kind === 'project' && Boolean(section.cwd))

  const commitDropOnSection = (section, sessionId) => {
    if (!sessionId) {
      return
    }

    if (section.kind === 'pinned') {
      const targetRow = rows.find(entry => entry.id === sessionId)

      if (targetRow && !targetRow.pinned) {
        try {
          host.sessions.pin(sessionId, true)
        } catch {
          /* SDK-Pin fehlgeschlagen — Refresh zieht den Rest nach */
        }
        pinnedSucceededAt = 0
        void refreshPinnedIds().then(() => scheduleSessionsRefresh(400))
        flashJustMoved(sessionId)
      }

      return
    }

    if (section.kind === 'project') {
      const targetRow = rows.find(entry => entry.id === sessionId)

      if (targetRow && targetRow.cwd !== section.cwd) {
        void moveSessionRow(targetRow, { path: section.cwd, name: section.title || '' })
        flashJustMoved(sessionId)
      }

      return
    }

    // v1.26.0 Hybrid-DnD auf eine manuelle Gruppe (siehe oben).
    if (section.kind === 'manual' && section.groupId) {
      const targetRow = rows.find(entry => entry.id === sessionId)
      if (targetRow) {
        const resolved = resolveSessionProject(targetRow)
        if (resolved && resolved.id && !resolved.isNoProject) {
          addProjectToGroup(section.groupId, resolved.id)
          flashJustMoved(sessionId)
          host.notify({
            kind: 'info',
            message: t('groupAddProject', { group: section.title || '', project: resolved.name || resolved.id })
          })
          return
        }
      }
      // Kein Projekt → alte assign-Semantik.
      assign(sessionId, section.groupId)
      flashJustMoved(sessionId)
      return
    }

    // Rest (ungrouped): Session aus jeder Gruppe rausnehmen.
    assign(sessionId, null)
    flashJustMoved(sessionId)
  }

  // Pointer-Drag-Controller. `flatSectionsRef`/`rowsRef` werden weiter unten
  // bei jedem Render aktualisiert ("latest ref"-Pattern) — der Controller
  // lebt laenger als ein einzelner Render (Listener bleiben zwischen
  // pointerdown und pointerup aktiv), darf aber nie mit einem veralteten
  // Sections-Snapshot committen.
  const beginRowDrag = (row, pointerEvent, { setDragging: setDraggingProp, justDraggedRef }) => {
    const startX = pointerEvent.clientX
    const startY = pointerEvent.clientY
    const THRESHOLD = 6
    let engaged = false
    let ghost = null

    const resolveDropKey = (x, y) => {
      const el = typeof document !== 'undefined' ? document.elementFromPoint(x, y) : null
      const target = el && el.closest ? el.closest('[data-sf-drop-key]') : null
      return target ? target.getAttribute('data-sf-drop-key') : null
    }

    const commit = key => {
      if (!key) return
      if (key === 'flat-pin') {
        const targetRow = rowsRef.current.find(entry => entry.id === row.id)
        if (targetRow && !targetRow.pinned) {
          try {
            host.sessions.pin(row.id, true)
          } catch {
            /* SDK-Pin fehlgeschlagen — Refresh zieht den Rest nach */
          }
          pinnedSucceededAt = 0
          void refreshPinnedIds().then(() => scheduleSessionsRefresh(400))
          flashJustMoved(row.id)
        }
        return
      }
      if (key === 'flat-ungrouped') {
        assign(row.id, null)
        flashJustMoved(row.id)
        return
      }
      const section = flatSectionsRef.current.find(entry => entry.key === key)
      if (section) {
        commitDropOnSection(section, row.id)
      }
    }

    const engage = () => {
      engaged = true
      justDraggedRef.current = true
      setDraggingProp(row.id)
      $dragActive.set(true)
      ghost = createDragGhost(row.title || row.id)
      ghost.moveTo(startX, startY)
    }

    const cleanup = () => {
      document.removeEventListener('pointermove', onMove, true)
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('keydown', onKeyDown, true)
      if (ghost) {
        ghost.destroy()
        ghost = null
      }
      setDraggingProp(null)
      $dragActive.set(false)
      setDragOverKey(null)
    }

    const onMove = moveEvent => {
      const x = moveEvent.clientX
      const y = moveEvent.clientY

      if (!engaged) {
        if (Math.hypot(x - startX, y - startY) < THRESHOLD) return
        engage()
      }

      if (ghost) ghost.moveTo(x, y)
      const key = resolveDropKey(x, y)
      setDragOverKey(current => (current === key ? current : key))
    }

    const onUp = upEvent => {
      try {
        if (engaged) {
          const key = resolveDropKey(upEvent.clientX, upEvent.clientY)
          commit(key)
        } else {
          // Schwelle nie erreicht → ganz normaler Klick, kein Drag.
          justDraggedRef.current = false
        }
      } finally {
        // finally: ein Fehler in commit() (z.B. host.sessions.pin wirft)
        // darf $dragActive/dragging nicht fuer immer auf "aktiv" stehen
        // lassen — sonst bleibt die Pinned-Placeholder-Sektion kleben.
        cleanup()
      }
    }

    const onKeyDown = keyEvent => {
      if (keyEvent.key === 'Escape') {
        justDraggedRef.current = false
        cleanup()
      }
    }

    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('keydown', onKeyDown, true)
  }

  const flatLimit = activeMode && maxVisible > 0 && activeFlatRows.length > maxVisible
  const flatShowingAll = flatLimit && showAllSections.has('flat-active')
  const flatVisible = flatLimit && !flatShowingAll ? activeFlatRows.slice(0, maxVisible) : activeFlatRows

  // ListView-Drop-Bereich: eine schmale Leiste am Listenanfang, die waehrend
  // eines aktiven Drags sichtbar wird. Sie hat zwei Ziele — Pin (links) und
  // Ungrouped (rechts). Im Flat-List-Modus fehlen sonst die Sektion-Header,
  // also gab es nichts, wohin man droppen konnte.
  const flatDropBar = dragActive
    ? jsxs('div', {
        className: 'sf-flat-dropbar',
        children: [
          jsx('div', {
            className: cn('sf-flat-dropbar-target', dragOverKey === 'flat-pin' && 'sf-flat-dropbar-target--hot'),
            'data-drop-ready': 'true',
            'data-drop': dragOverKey === 'flat-pin' ? 'true' : undefined,
            'data-sf-drop-key': 'flat-pin',
            children: jsxs('span', { className: 'sf-flat-dropbar-label', children: [jsx(Codicon, { name: 'pin', size: '0.85rem' }), ' ' , t('pinnedSection')] })
          }),
          jsx('div', {
            className: cn('sf-flat-dropbar-target', dragOverKey === 'flat-ungrouped' && 'sf-flat-dropbar-target--hot'),
            'data-drop-ready': 'true',
            'data-drop': dragOverKey === 'flat-ungrouped' ? 'true' : undefined,
            'data-sf-drop-key': 'flat-ungrouped',
            children: jsxs('span', { className: 'sf-flat-dropbar-label', children: [jsx(Codicon, { name: 'list-unordered', size: '0.85rem' }), ' ', t('ungrouped') || 'Ungrouped'] })
          })
        ]
      })
    : null

  const flatList = jsx('div', {
    className: 'sf-list sf-list-flat',
    'data-flat': 'active',
    children: [
      flatDropBar,
      activeFlatRows.length > 0
        ? jsx('div', {
            className: 'sf-items',
            'data-view': settings.tabs.view === 'grid' ? 'grid' : 'list',
            children: [
              ...flatVisible.map(row =>
                jsx(TabRow, {
                  key: row.id,
                  row,
                  active: row.id === (focused || active),
                  section: FLAT_SECTION,
                  t,
                  onOpen: open,
                  onMore,
                  groupsState,
                  onAssign: assign,
                  dragging,
                  setDragging,
                  onRowPointerDown: beginRowDrag,
                  justMoved: row.id === justMovedId
                })
              ),
              flatLimit
                ? jsx(ShowMoreRow, {
                    key: 'sf-showmore',
                    hidden: activeFlatRows.length - flatVisible.length,
                    expanded: flatShowingAll,
                    onClick: () => toggleShowAll('flat-active'),
                    t
                  })
                : null
            ]
          })
        : null
    ]
  })

  // v1.26.0: flach klappen — manuelle Gruppen-Sections werden zu
  // einer Liste aus [group-header, ...subProjects] aufgeblasen, sodass
  // die Render-Schleife darunter ohne Sonderbehandlung auskommt.
  // Sub-Sections tragen `parentGroupId` und haben ihren eigenen
  // `collapsed`-State, deshalb werden sie unabhängig vom
  // Gruppen-Header collapsed/expanded gerendert.
  const flatSections = []
  for (const section of filteredSections) {
    flatSections.push(section)
    if (section.kind === 'manual' && Array.isArray(section.subSections) && section.subSections.length) {
      flatSections.push(...section.subSections)
    }
  }
  flatSectionsRef.current = flatSections
  const list = jsx('div', {
    className: 'sf-list',
    children: flatSections.map(section => {
      const isSub = section.parentGroupId != null
      const expanded = isSub ? !section.collapsed : !section.collapsed
      const stackStyle = settings.groups.stackStyle
      const showStack = !expanded && stackStyle !== 'pill' && section.items.length > 0 && section.kind !== 'ungrouped'
      const overLimit = maxVisible > 0 && section.items.length > maxVisible
      const showingAll = overLimit && showAllSections.has(section.key)
      const visibleItems = overLimit && !showingAll ? section.items.slice(0, maxVisible) : section.items
      // „Scharfe" Drop-Area während eines Drags: Sektionen, die Drop
      // akzeptieren, bekommen einen zusätzlichen Zustand, der im CSS die
      // pulsierende Ziel-Umrandung anschaltet — besonders wichtig für die
      // leere Pinned-Placeholder-Sektion, die sonst visuell untergeht.
      const dropReady = dragActive && canSectionDrop(section)

      return jsxs('div', {
        className: cn('sf-section', isSub && 'sf-section-nested'),
        key: section.key,
        'data-drop': dragOverKey === section.key ? 'true' : undefined,
        'data-drop-ready': dropReady ? 'true' : undefined,
        'data-pinned-placeholder': section.isDropPlaceholder ? 'true' : undefined,
        'data-parent-group': isSub ? section.parentGroupId : undefined,
        'data-sf-drop-key': canSectionDrop(section) ? section.key : undefined,
        children: [
          jsx(SectionHeader, {
            key: 'head',
            section,
            t,
            density: ['compact', 'comfortable', 'detailed'].includes(settings.groups.headerDensity)
              ? settings.groups.headerDensity
              : 'comfortable',
            onToggle: () => {
              if (section.kind !== 'ungrouped') {
                toggleSectionCollapsed(section.key)
              }
            },
            onEdit: () => editGroup(section),
            // v1.26.0: nur Project-Sections (Top-Level oder als
            // Gruppen-Kind) bekommen das `+` — manuelle Gruppen
            // sind reine Container und nicht selbst Anker.
            onNewHere: section.kind === 'project' ? newSessionHere : undefined,
            onPinToggle:
              section.kind === 'pinned' && section.items.length > 0
                ? () => {
                    for (const row of section.items) {
                      try {
                        host.sessions.pin(row.id, false)
                      } catch {
                        /* einzelne Failed-Pins bleiben, Refresh räumt auf */
                      }
                    }
                    pinnedSucceededAt = 0
                    void refreshPinnedIds().then(() => scheduleSessionsRefresh(400))
                  }
                : undefined,
            dropActive: dragOverKey === section.key
          }),
          showStack ? jsx(StackLayers, { key: 'stack', style: stackStyle, color: section.color }) : null,
          expanded
            ? jsx('div', {
                className: 'sf-items',
                'data-view': settings.tabs.view === 'grid' ? 'grid' : 'list',
                key: 'items',
                children: [
                  ...visibleItems.map(row =>
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
                      setDragging,
                      onRowPointerDown: beginRowDrag,
                      justMoved: row.id === justMovedId
                    })
                  ),
                  // Pinned-Drop-Placeholder (nur während Drag + wenn der
                  // Pin-Store leer ist): zeigt eine freundliche Hinweis-Zeile
                  // mit Pin-Icon, damit auch bei leerer Pin-Sektion ein
                  // sichtbares Ablege-Ziel existiert.
                  section.isDropPlaceholder && section.items.length === 0
                    ? jsx('div', {
                        key: 'sf-pin-placeholder',
                        className: 'sf-pin-placeholder',
                        children: [
                          jsx(Codicon, { name: 'pin', size: '0.875rem' }),
                          jsx('span', { className: 'sf-pin-placeholder-text', children: t('pinnedDropHint') || 'Hier ablegen zum Anpinnen' })
                        ]
                      })
                    : null,
                  // v1.26.0: leere manuelle Gruppe → dezenter Hinweis statt
                  // leerer Body.
                  section.kind === 'manual' && section.items.length === 0
                    && (!Array.isArray(section.subSections) || section.subSections.length === 0)
                    ? jsx('div', {
                        key: 'sf-group-empty',
                        className: 'sf-group-empty',
                        children: t('groupEmpty')
                      })
                    : null,
                  // v1.27.0: „Projekt nicht verfügbar" — Kind-Projekt-Section
                  // referenziert eine tote Projekt-ID (buildSections setzt
                  // isProjectMissing). Hinweis-Zeile mit Warn-Icon + Entfernen-
                  // Aktion statt leerem Body; der Header trägt kein `+`.
                  section.isProjectMissing
                    ? jsx('div', {
                        key: 'sf-group-missing',
                        className: 'sf-group-missing',
                        children: [
                          jsx(Codicon, { name: 'warning', size: '0.875rem' }),
                          jsx('span', { className: 'sf-group-missing-text', children: t('groupProjectMissingHint') }),
                          jsx('button', {
                            type: 'button',
                            className: 'sf-group-missing-remove',
                            onClick: () => removeProjectFromGroup(section.parentGroupId, section.projectId),
                            children: t('groupProjectMissingRemove')
                          })
                        ]
                      })
                    : null,
                  overLimit
                    ? jsx(ShowMoreRow, {
                        key: 'sf-showmore',
                        hidden: section.items.length - visibleItems.length,
                        expanded: showingAll,
                        onClick: () => toggleShowAll(section.key),
                        t
                      })
                    : null
                ]
              })
            : null
        ]
      })
    })
  })

  // "Ansichtsoptionen" — Gruppierung + Kopfzeilen-Dichte direkt aus der Pane
  // umschaltbar, ohne die volle Einstellungsseite zu öffnen. Spiegelt Hermes
  // Desktops Sidebar-Filter-Icon (list-filter) in Form und Platzierung.
  // Jede Zeile bleibt im proven-sicheren DropdownMenuItem-Rahmen (siehe
  // moreRowMenu oben) — keine ungetesteten Radio-/Checkbox-Untermenüs.
  // „Ansichtsoptionen" — volle Parität zum Filtermenü der Hermes-Sessions-
  // Ansicht: Gruppierung, Sortierung, Status-/Projekt-Filter, Zeilen-Details
  // und Aktionen (Alle ein-/ausklappen, Alle als gelesen). Radio-artige
  // Auswahlen laufen über menuChoice, Multi-Filter über Checkbox-Untermenüs.
  const groupingChoices = [
    { id: 'off', icon: 'circle-slash', label: t('groupsAutoOff') },
    { id: 'date', icon: 'clock', label: t('groupsAutoDate') },
    { id: 'source', icon: 'broadcast', label: t('groupsAutoSource') },
    { id: 'status', icon: 'pulse', label: t('orderStatus') },
    { id: 'project', icon: 'root-folder', label: t('groupsAutoProject') }
  ]
  const densityChoices = [
    { id: 'compact', label: t('headerDensityCompact') },
    { id: 'comfortable', label: t('headerDensityComfortable') },
    { id: 'detailed', label: t('headerDensityDetailed') }
  ]
  const orderingChoices = [
    { id: 'updated', icon: 'clock', label: t('orderUpdated') },
    { id: 'created', icon: 'add', label: t('orderCreated') },
    { id: 'status', icon: 'pulse', label: t('orderStatus') },
    { id: 'tokens', icon: 'symbol-numeric', label: t('orderTokens') },
    { id: 'cost', icon: 'credit-card', label: t('orderCost') }
  ]
  const statusChoices = [
    { id: 'needs-input', label: t('statusNeedsInput') },
    { id: 'working', label: t('statusWorking') },
    { id: 'unread', label: t('statusUnread') },
    { id: 'draft', label: t('statusDraft') },
    { id: 'idle', label: t('statusIdle') }
  ]
  const viewCfg = settings.view || {}
  const statusFilter = Array.isArray(viewCfg.statusFilter) ? viewCfg.statusFilter : []
  const projectFilter = Array.isArray(viewCfg.projectFilter) ? viewCfg.projectFilter : []

  const toggleViewList = (key, id) => {
    const current = Array.isArray(viewCfg[key]) ? viewCfg[key] : []
    const next = current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]

    patchSettings('view', { [key]: next })
  }

  // Projekt-Filter-Einträge: echte Projekte + „Kein Projekt" (wie die App
  // den Home-Bucket anbietet). Nur wenn überhaupt Projekte existieren.
  const projectChoices = [
    ...projectsList.filter(node => !node.isNoProject).map(node => ({ id: node.id, label: node.label })),
    { id: '__no_project__', label: t('projectsNoProject') }
  ]

  const menuChoice = (active, label, onSelect, icon) =>
    jsx(DropdownMenuItem, {
      className: 'sf-menu-item',
      key: `${icon || ''}-${label}`,
      onSelect: event => {
        event?.preventDefault?.()
        onSelect()
      },
      children: [
        jsx(Codicon, { key: 'c', name: 'check', size: '0.875rem', style: { opacity: active ? 1 : 0 } }),
        jsx('span', { key: 'l', children: label })
      ]
    })

  const viewOptionsMenu =
    DropdownMenu && DropdownMenuContent && DropdownMenuItem && DropdownMenuSeparator && DropdownMenuTrigger
      ? jsxs(DropdownMenu, {
          children: [
            jsx(DropdownMenuTrigger, {
              asChild: true,
              // WICHTIG: direkt der Button als Trigger-Kind — kein Tip/Wrapper
              // dazwischen, sonst kann Radix den Ref nicht durchreichen und
              // das Menü öffnet nie (siehe moreRowMenu oben, derselbe Bau).
              children: jsx(Button, {
                'aria-label': t('viewOptions'),
                title: t('viewOptions'),
                size: 'icon-xs',
                variant: 'ghost',
                children: jsx(Codicon, { name: 'list-filter', size: '0.875rem' })
              })
            }),
            jsxs(DropdownMenuContent, {
              align: 'start',
              className: 'sf-viewmenu',
              children: [
                jsx('div', { className: 'sf-menu-caption', key: 'cap-group', children: t('viewOptionsGrouping') }),
                ...groupingChoices.map(choice =>
                  menuChoice(
                    settings.groups.autoMode === choice.id,
                    choice.label,
                    () => patchSettings('groups', { autoMode: choice.id }),
                    choice.icon
                  )
                ),
                jsx(DropdownMenuSeparator, { key: 'sep-1' }),
                jsx('div', { className: 'sf-menu-caption', key: 'cap-order', children: t('viewOptionsOrdering') }),
                ...orderingChoices.map(choice =>
                  menuChoice(
                    (viewCfg.ordering || 'updated') === choice.id,
                    choice.label,
                    () => patchSettings('view', { ordering: choice.id }),
                    choice.icon
                  )
                ),
                jsx(DropdownMenuSeparator, { key: 'sep-1b' }),
                ...(() => {
                  // Status-Filter als Checkbox-Untermenü (nur wenn die
                  // DropdownMenuSub-Familie im SDK existiert — ältere Builds
                  // überspringen die Filter, verlieren aber nichts anderes).
                  if (!(DropdownMenuSub && DropdownMenuSubContent && DropdownMenuSubTrigger && DropdownMenuCheckboxItem)) {
                    return []
                  }

                  return [
                    jsxs(DropdownMenuSub, {
                      key: 'sub-status',
                      children: [
                        jsx(DropdownMenuSubTrigger, { children: t('viewOptionsFilterStatus') }),
                        jsx(DropdownMenuSubContent, {
                          children: statusChoices.map(choice =>
                            jsx(DropdownMenuCheckboxItem, {
                              checked: statusFilter.includes(choice.id),
                              key: choice.id,
                              onSelect: event => event?.preventDefault?.(),
                              onCheck: () => toggleViewList('statusFilter', choice.id),
                              children: choice.label
                            })
                          )
                        })
                      ]
                    }),
                    ...(projectChoices.length > 1
                      ? [
                          jsxs(DropdownMenuSub, {
                            key: 'sub-project',
                            children: [
                              jsx(DropdownMenuSubTrigger, { children: t('viewOptionsFilterProject') }),
                              jsx(DropdownMenuSubContent, {
                                children: projectChoices.map(choice =>
                                  jsx(DropdownMenuCheckboxItem, {
                                    checked: projectFilter.includes(choice.id),
                                    key: choice.id,
                                    onSelect: event => event?.preventDefault?.(),
                                    onCheck: () => toggleViewList('projectFilter', choice.id),
                                    children: choice.label
                                  })
                                )
                              })
                            ]
                          })
                        ]
                      : []),
                    jsxs(DropdownMenuSub, {
                      key: 'sub-meta',
                      children: [
                        jsx(DropdownMenuSubTrigger, { children: t('viewOptionsRowMeta') }),
                        jsx(DropdownMenuSubContent, {
                          children: [
                            jsx(DropdownMenuCheckboxItem, {
                              checked: Boolean(viewCfg.showTokens),
                              key: 'tok',
                              onSelect: event => event?.preventDefault?.(),
                              onCheck: () => patchSettings('view', { showTokens: !viewCfg.showTokens }),
                              children: t('rowMetaTokens')
                            }),
                            jsx(DropdownMenuCheckboxItem, {
                              checked: Boolean(viewCfg.showCost),
                              key: 'cost',
                              onSelect: event => event?.preventDefault?.(),
                              onCheck: () => patchSettings('view', { showCost: !viewCfg.showCost }),
                              children: t('rowMetaCost')
                            }),
                            jsx(DropdownMenuCheckboxItem, {
                              checked: Boolean(viewCfg.showProfile),
                              key: 'prof',
                              onSelect: event => event?.preventDefault?.(),
                              onCheck: () => patchSettings('view', { showProfile: !viewCfg.showProfile }),
                              children: t('rowMetaProfile')
                            })
                          ]
                        })
                      ]
                    })
                  ]
                })(),
                jsx(DropdownMenuSeparator, { key: 'sep-1c' }),
                jsx(DropdownMenuItem, {
                  className: 'sf-menu-item',
                  key: 'collapse-all',
                  onSelect: event => {
                    event?.preventDefault?.()

                    const groupsStateNow = $groupsState.get()
                    const next = { ...groupsStateNow.collapsed }

                    for (const section of sections) {
                      if (section.kind !== 'ungrouped' && section.key !== 'pinned') {
                        next[section.key] = true
                      }
                    }

                    $groupsState.set({ ...groupsStateNow, collapsed: next })
                    scheduleGroupsSave()
                  },
                  children: t('actionCollapseAll')
                }),
                jsx(DropdownMenuItem, {
                  className: 'sf-menu-item',
                  key: 'expand-all',
                  onSelect: event => {
                    event?.preventDefault?.()

                    const groupsStateNow = $groupsState.get()
                    $groupsState.set({ ...groupsStateNow, collapsed: {} })
                    scheduleGroupsSave()
                  },
                  children: t('actionExpandAll')
                }),
                /* #full */
                jsx(DropdownMenuItem, {
                  className: 'sf-menu-item',
                  disabled: !rows.some(row => row.unread),
                  key: 'mark-read',
                  onSelect: event => {
                    event?.preventDefault?.()

                    const unread = rows.filter(row => row.unread)

                    if (!unread.length) {
                      host.notify({ kind: 'info', message: t('actionNoUnread') })

                      return
                    }

                    void markAllSessionsRead(unread).then(done => {
                      host.notify({ kind: 'success', message: t('actionMarkAllReadDone', done) })
                    })
                  },
                  children: t('actionMarkAllRead')
                }),
                jsx(DropdownMenuSeparator, { key: 'sep-2' }),
                /* #end */
                jsx('div', { className: 'sf-menu-caption', key: 'cap-density', children: t('viewOptionsDensity') }),
                ...densityChoices.map(choice =>
                  menuChoice(settings.groups.headerDensity === choice.id, choice.label, () =>
                    patchSettings('groups', { headerDensity: choice.id })
                  )
                ),
                jsx(DropdownMenuSeparator, { key: 'sep-3' }),
                menuChoice(settings.groups.showUngrouped, t('groupsShowUngrouped'), () =>
                  patchSettings('groups', { showUngrouped: !settings.groups.showUngrouped })
                )
              ]
            })
          ]
        })
      : null

  // App-Nav-Zeile (v1.20): Icon-Buttons für Neue Session + die ersten
  // Sidebar-Seiten der App, flex-wrap (bricht um, je nach Pane-Breite).
  // Mit der Option schaltet der Nutzer die ganze Zeile ab.
  const navAppsBar = settings.tabs.appNav === false
    ? null
    : jsx(NavAppsBar, { t, onNewSession: () => void startNewProjectSession() })

  // Suchpfad-Komponente (v1.25.0): frei von Filter-Tabs, damit sie an einer
  // anderen Stelle platziert werden kann als das Quick-Filter-Segment.
  // Rein clientseitig (siehe needle/matchesFilter oben), keine Persistierung,
  // damit sie jeden neuen Pane-Besuch frisch startet. Wird in der Toolbar
  // konsumiert (siehe `toolbar` weiter unten). Liegt VOR `toolbar` damit
  // die TDZ-Reihenfolge stimmt.
  const searchField = jsx('div', {
    className: 'sf-filter-search',
    children: [
      jsx(Codicon, { name: 'search', size: '0.75rem' }),
      jsx(Input, {
        'aria-label': t('filterPlaceholder'),
        onChange: event => setFilterText(event.target.value),
        placeholder: t('filterPlaceholder'),
        value: filterText
      }),
      filterText
        ? jsx('button', {
            'aria-label': t('filterClear'),
            className: 'sf-filter-clear',
            onClick: () => setFilterText(''),
            type: 'button',
            children: jsx(Codicon, { name: 'close', size: '0.7rem' })
          })
        : null
    ]
  })

  // Quick-Filter-Komponente (v1.25.0): die Subtabs „Alle / Aktiv / Angepinnt
  // / Archiv" sind EIGENE Komponente, damit sie getrennt vom Suchfeld
  // platziert werden kann. Liegt als eigene Zeile direkt unter der Toolbar
  // mit voller Pane-Breite. Wird im Pane-Root konsumiert.
  // Pinned/Archiv hängen am REST-Spiegel (Desktop-Bridge-REST-Tür) — ohne
  // diese Tür (Catalog-Build) werden die beiden Subtabs ehrlich ausgeblendet,
  // statt leere Listen zu zeigen.
  const quickFilter = jsx('div', {
    className: 'sf-quickfilter',
    children: jsx(Segment, {
      onChange: setFilterMode,
      options: restMirror
        ? [
            { id: 'all', label: t('filterAll') },
            { id: 'active', label: t('filterActive') },
            { id: 'pinned', label: t('filterPinned') },
            { id: 'archived', label: t('filterArchived') }
          ]
        : [
            { id: 'all', label: t('filterAll') },
            { id: 'active', label: t('filterActive') }
          ],
      value: filterMode
    })
  })

  const toolbar = jsxs('div', {
    className: 'sf-toolbar',
    children: [
      // Suchfeld in der Toolbar-Zeile (v1.25.0): gehört zusammen mit
      // der Anzahl-Label in eine Reihe, getrennt vom Subtab-Segment
      // (`quickFilter` separat darunter). Erstes Element der Toolbar.
      searchField,
      jsx('span', {
        className: 'sf-toolbar-count',
        children: filterActive ? t('paneCountFiltered', totalCount, activeMode ? activeFlatRows.length : filteredSections.reduce((sum, section) => sum + section.items.length, 0)) : t('paneCount', totalCount)
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
      viewOptionsMenu,
      jsx(Tip, {
        label: t('newProject'),
        children: jsx(Button, {
          'aria-label': t('newProject'),
          onClick: () => setProjDialog({ ...newProjectDialogState(), open: true }),
          size: 'icon-xs',
          variant: 'ghost',
          children: jsx(Codicon, { name: 'folder-library', size: '0.875rem' })
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

  // Archiv-Liste: flach, mit Restore-Aktion je Zeile (More-Menü zeigt
  // „Wiederherstellen", siehe TabRow), Suche greift wie überall.
  const archivedVisible = useMemo(() => {
    if (!archivedMode) {
      return []
    }

    return archivedRows.filter(matchesFilter)
  }, [archivedMode, archivedRows, needle])

  const archivedList = jsx('div', {
    className: 'sf-list sf-list-flat',
    'data-flat': 'archived',
    children: jsx('div', {
      className: 'sf-items',
      'data-view': settings.tabs.view === 'grid' ? 'grid' : 'list',
      children: archivedVisible.map(row =>
        jsx(TabRow, {
          key: row.id,
          row,
          active: row.id === (focused || active),
          section: FLAT_SECTION,
          t,
          onOpen: open,
          onMore,
          groupsState,
          onAssign: assign,
          dragging,
          setDragging,
          justMoved: row.id === justMovedId
        })
      )
    })
  })

  // Lade-Zustand: solange der erste Datensatz fehlt, Ladebalken + Gateway-
  // Hinweis (statt leerem „Keine Sessions", das wie ein Fehler wirkt).
  const loadingBody = jsxs('div', {
    className: 'sf-load',
    'data-phase': loadPhase,
    children: [
      jsxs('div', {
        className: 'sf-load-title',
        children: [jsx(Codicon, { name: loadPhase === 'gate' ? 'plug' : 'loading', size: '0.875rem', spinning: loadPhase !== 'gate' }), loadPhase === 'gate' ? t('loadingGateTitle') : t('loadingTitle')]
      }),
      jsx('div', { className: 'sf-load-bar' }),
      jsx('div', { className: 'sf-load-hint', children: loadPhase === 'gate' ? t('loadingGateHint') : t('loadingHint') })
    ]
  })

  let body = null

  if (archivedMode) {
    body = archivedVisible.length
      ? archivedList
      : jsxs('div', {
          className: 'sf-empty',
          children: [
            jsx('div', { className: 'sf-empty-title', children: t('filterArchiveEmpty') }),
            jsx('div', { className: 'sf-empty-body', children: t('filterArchiveEmptyHint') })
          ]
        })
  } else if (!rows.length && loadPhase !== 'ready' && loadPhase !== 'error') {
    body = loadingBody
  } else if (!rows.length && error) {
    // Fehler + keine Daten: Fehlertext + Retry-Button statt toter Fläche
    // (v1.24.0) — vorher blieb nur der statische Hinweis ohne Handhabe.
    body = jsxs('div', {
      className: 'sf-empty sf-empty-error',
      'data-phase': 'error',
      children: [
        jsx('div', { className: 'sf-empty-title', children: t('error') }),
        jsx('div', { className: 'sf-empty-body', children: error }),
        jsx('div', { className: 'sf-load-actions', children:
          jsx(Button, {
            onClick: () => {
              haptic('tap')
              void refreshSessions()
              void refreshProjectsList()
              void refreshPinnedIds()
            },
            size: 'sm',
            variant: 'ghost',
            children: t('errorRetry')
          })
        })
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
  } else if (activeMode && activeFlatRows.length === 0) {
    body = jsxs('div', {
      className: 'sf-empty',
      children: [
        jsx('div', { className: 'sf-empty-title', children: t('filterEmpty') }),
        jsx('div', { className: 'sf-empty-body', children: t('filterEmptyHint') })
      ]
    })
  } else if (activeMode) {
    body = flatList
  } else if (filterActive && filteredSections.length === 0) {
    body = jsxs('div', {
      className: 'sf-empty',
      children: [
        jsx('div', { className: 'sf-empty-title', children: t('filterEmpty') }),
        jsx('div', { className: 'sf-empty-body', children: t('filterEmptyHint') })
      ]
    })
  } else {
    body = list
  }

  return jsxs('div', {
    className: 'sf-pane',
    children: [
      navAppsBar,
      // Suchfeld sitzt in der Toolbar-Zeile (siehe oben). Subtabs sind
      // eigene Komponente `quickFilter` und liegen darunter mit voller
      // Pane-Breite.
      toolbar,
      quickFilter,
      body,
      jsx(GroupDialog, { state: dialog, setState: setDialog, t }),
      jsx(RowDialogHost, { state: rowDialog, setState: setRowDialog, t }),
      jsx(ProjectDialog, { state: projDialog, setState: setProjDialog, t }),
      projConfirmDelete
        ? jsx(ConfirmDialog, {
          cancelLabel: t('cancel'),
          confirmLabel: t('projDelete'),
          description: t('projDeleteConfirmBody'),
          destructive: true,
          onClose: () => setProjConfirmDelete(null),
          onConfirm: async () => {
            const target = projConfirmDelete
            setProjConfirmDelete(null)
            try {
              await deleteProject(target.id)
              host.notify({ kind: 'success', message: t('projDeleted') })
            } catch (error) {
              host.notify({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
            }
          },
          open: true,
          title: t('projDeleteConfirmTitle')
        })
        : null
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

/** Sticky „Übernehmen": persistiert sofort und wendet alle Effekte neu an. */
function SettingsSaveAction() {
  const t = usePluginI18n(ID)
  const dirty = useValue($settingsDirty)
  const [saved, setSaved] = useState(false)

  return jsx('button', {
    'aria-live': 'polite',
    className: 'sf-savebtn',
    'data-dirty': dirty ? 'true' : undefined,
    'data-state': saved ? 'saved' : undefined,
    onClick: () => {
      flushSettingsSave()
      applyAllSettings()
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1600)
    },
    title: t('applyNowHint'),
    type: 'button',
    children: [
      jsx(Codicon, { key: 'icon', name: saved ? 'check' : 'save', size: '0.8125rem' }),
      jsx('span', { key: 'label', children: saved ? t('savedNow') : t('applyNow') })
    ]
  })
}

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

  return jsxs('div', {
    className: 'sf-nav',
    role: 'navigation',
    children: [
      jsx('div', {
        className: 'sf-nav-chips',
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
      }),
      jsx(SettingsSaveAction, {})
    ]
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
  // Full-Reset-Bestätigung (v1.24.0): Settings + Gruppen + Zuordnungen in einem
  // Schritt — mit ConfirmDialog, kein stiller Wipe.
  const [resetAllOpen, setResetAllOpen] = useState(false)

  const animation = settings.animation
  const wheel = settings.wheel
  const tabs = settings.tabs
  const groups = settings.groups
  const glass = settings.glass
  const uiTabs = settings.uiTabs
  const personal = settings.personal
  const composer = settings.composer

  const patch = (section, key, value) => patchSettings(section, { [key]: value })

  // ── Liste/Grid-Farben je Theme (Dark/Light) ──────────────────────────────
  // Dark = die flachen `tabs`-Keys, Light = `tabs.lightTheme`. Der Subtab
  // (`tabs.themeTab`) bestimmt, welches Set die Farb-Controls unten editieren.
  // Auto-Ableitung: eine geänderte Farbe setzt die Gegenfarbe im anderen Theme.
  const themeTab = tabs.themeTab === 'light' ? 'light' : 'dark'
  const isLightTab = themeTab === 'light'
  const lightTheme = tabs.lightTheme || {}
  const colorFor = key => (isLightTab ? (lightTheme[key] !== undefined ? lightTheme[key] : tabs[key]) : tabs[key])

  // Titel-Stil des aktiven Theme-Satzes (none|solid|gradient), mit Rückfall auf
  // das alte titleGradOn (Migration).
  const titleStyleVal = (() => {
    const raw = colorFor('titleStyle')
    if (['none', 'solid', 'gradient'].includes(raw)) return raw
    return colorFor('titleGradOn') ? 'gradient' : 'none'
  })()

  const setThemeFlag = (key, value) => {
    if (isLightTab) patchSubSettings('tabs', 'lightTheme', { [key]: value })
    else patch('tabs', key, value)
  }

  const setThemeColor = (key, value, kind = 'fill') => {
    if (isLightTab) {
      patchSubSettings('tabs', 'lightTheme', { [key]: value })
      if (tabs.themeAutoDerive) patch('tabs', key, deriveForTheme(value, 'dark', kind))
    } else {
      patch('tabs', key, value)
      if (tabs.themeAutoDerive) patchSubSettings('tabs', 'lightTheme', { [key]: deriveForTheme(value, 'light', kind) })
    }
  }

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

/* #full */
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

/* #end */
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
          jsx(ToggleRow, {
            label: t('tabsAppNav'),
            description: t('tabsAppNavDesc'),
            checked: tabs.appNav !== false,
            onChange: value => patch('tabs', 'appNav', value)
          }),
          jsx(ToggleRow, {
            label: t('composerProjectPill'),
            description: t('composerProjectPillDesc'),
            checked: composer.projectPill !== false,
            onChange: value => {
              patch('composer', 'projectPill', value)
              kickComposerPillSync()
            }
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
            title: t('tabsTextSize'),
            description: t('tabsTextSizeDesc'),
            action: jsx(NumberInput, {
              min: 80,
              max: 160,
              step: 5,
              value: tabs.textSize,
              onChange: value => patch('tabs', 'textSize', clampNumber(value, 80, 160, 100))
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
          jsx(ToggleRow, {
            label: t('tabsCtxPie'),
            description: t('tabsCtxPieDesc'),
            checked: tabs.ctxPie,
            onChange: value => patch('tabs', 'ctxPie', value)
          }),
          // Darstellungs-Stil nur relevant wenn die visuelle Darstellung
          // überhaupt aktiv ist — Toggle oben entscheidet darüber.
          tabs.ctxPie
            ? jsx(Row, {
                title: t('tabsCtxStyle'),
                description: t('tabsCtxStyleDesc'),
                action: jsx(Segment, {
                  options: [
                    { id: 'donut', label: t('tabsCtxStyleDonut') },
                    { id: 'bar', label: t('tabsCtxStyleBar') }
                  ],
                  value: tabs.ctxStyle === 'bar' ? 'bar' : 'donut',
                  onChange: value => patch('tabs', 'ctxStyle', value === 'bar' ? 'bar' : 'donut')
                })
              })
            : null,
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
            label: t('tabsThemeSplit'),
            description: t('tabsThemeSplitDesc'),
            checked: tabs.themeSplit,
            onChange: value => patch('tabs', 'themeSplit', value)
          }),
          jsx(ToggleRow, {
            label: t('tabsThemeAutoDerive'),
            description: t('tabsThemeAutoDeriveDesc'),
            checked: tabs.themeAutoDerive,
            disabled: !tabs.themeSplit,
            onChange: value => patch('tabs', 'themeAutoDerive', value)
          }),
          jsx(Row, {
            title: t('tabsThemeMode'),
            description: t('tabsThemeModeDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'auto', label: t('tabsThemeModeAuto') },
                { id: 'dark', label: t('tabsThemeModeDark') },
                { id: 'light', label: t('tabsThemeModeLight') }
              ],
              value: ['auto', 'dark', 'light'].includes(tabs.themeMode) ? tabs.themeMode : 'auto',
              onChange: value => patch('tabs', 'themeMode', ['dark', 'light'].includes(value) ? value : 'auto')
            })
          }),
          jsx(Row, {
            title: t('tabsThemeEditing'),
            description: isLightTab ? t('tabsThemeEditingLight') : t('tabsThemeEditingDark'),
            action: jsx(Segment, {
              options: [
                { id: 'dark', label: t('tabsThemeDark') },
                { id: 'light', label: t('tabsThemeLight') }
              ],
              value: themeTab,
              // Hell wählen schaltet themeSplit automatisch ein — sonst würden
              // Edits im Hell-Satz still nichts bewirken (das war der Bug).
              onChange: value => {
                if (value === 'light') {
                  patchSettings('tabs', { themeTab: 'light', themeSplit: true })
                } else {
                  patch('tabs', 'themeTab', 'dark')
                }
              }
            })
          }),
          jsx(ToggleRow, {
            label: t('tabsRowGrad'),
            description: t('tabsRowGradDesc'),
            checked: colorFor('rowGradOn'),
            onChange: value => setThemeFlag('rowGradOn', value)
          }),
          jsx(Row, {
            title: t('tabsRowGradFrom'),
            description: t('tabsRowGradFromDesc'),
            action: colorRowControl(colorFor('rowGradFrom'), value => setThemeColor('rowGradFrom', value, 'fill'), t('personalAccentReset'), { alpha: true, pickerLabel: t('colorPicker'), alphaLabel: t('colorAlpha') })
          }),
          jsx(Row, {
            title: t('tabsRowGradTo'),
            description: t('tabsRowGradToDesc'),
            action: colorRowControl(colorFor('rowGradTo'), value => setThemeColor('rowGradTo', value, 'fill'), t('personalAccentReset'), { alpha: true, pickerLabel: t('colorPicker'), alphaLabel: t('colorAlpha') })
          }),
          jsx(Row, {
            title: t('tabsRowGradAngle'),
            description: t('tabsRowGradAngleDesc'),
            action: jsx(NumberInput, {
              min: 0,
              max: 360,
              step: 15,
              value: colorFor('rowGradAngle'),
              onChange: value => setThemeFlag('rowGradAngle', value)
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
              value: colorFor('rowShadow'),
              onChange: value => setThemeFlag('rowShadow', SF_ROW_SHADOWS.includes(value) ? value : 'off')
            })
          }),
          jsx(ToggleRow, {
            label: t('tabsAlignTop'),
            description: t('tabsAlignTopDesc'),
            checked: tabs.alignTop,
            onChange: value => patch('tabs', 'alignTop', value)
          }),
          jsx(ToggleRow, {
            label: t('tabsHoverLift'),
            description: t('tabsHoverLiftDesc'),
            checked: tabs.hoverLift,
            onChange: value => patch('tabs', 'hoverLift', value)
          }),
          jsx(Row, {
            title: t('tabsTitleStyle'),
            description: t('tabsTitleStyleDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'none', label: t('tabsTitleStyleNone') },
                { id: 'solid', label: t('tabsTitleStyleSolid') },
                { id: 'gradient', label: t('tabsTitleStyleGradient') }
              ],
              value: titleStyleVal,
              onChange: value => setThemeFlag('titleStyle', ['solid', 'gradient'].includes(value) ? value : 'none')
            })
          }),
          titleStyleVal === 'solid'
            ? jsx(Row, {
                title: t('tabsTitleColor'),
                description: t('tabsTitleColorDesc'),
                action: colorRowControl(colorFor('titleColor'), value => setThemeColor('titleColor', value, 'text'), t('personalAccentReset'), { alpha: true, pickerLabel: t('colorPicker'), alphaLabel: t('colorAlpha') })
              })
            : null,
          titleStyleVal === 'gradient'
            ? jsx(Row, {
                title: t('tabsTitleGradFrom'),
                description: t('tabsTitleGradFromDesc'),
                action: colorRowControl(colorFor('titleGradFrom'), value => setThemeColor('titleGradFrom', value, 'text'), t('personalAccentReset'), { alpha: true, pickerLabel: t('colorPicker'), alphaLabel: t('colorAlpha') })
              })
            : null,
          titleStyleVal === 'gradient'
            ? jsx(Row, {
                title: t('tabsTitleGradTo'),
                description: t('tabsTitleGradToDesc'),
                action: colorRowControl(colorFor('titleGradTo'), value => setThemeColor('titleGradTo', value, 'text'), t('personalAccentReset'), { alpha: true, pickerLabel: t('colorPicker'), alphaLabel: t('colorAlpha') })
              })
            : null,
          titleStyleVal === 'gradient'
            ? jsx(Row, {
                title: t('tabsTitleGradAngle'),
                description: t('tabsTitleGradAngleDesc'),
                action: jsx(NumberInput, {
                  min: 0,
                  max: 360,
                  step: 15,
                  value: colorFor('titleGradAngle'),
                  onChange: value => setThemeFlag('titleGradAngle', value)
                })
              })
            : null,
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
            action: colorRowControl(colorFor('selColor'), value => setThemeColor('selColor', value, 'fill'), t('personalAccentReset'), { alpha: true, pickerLabel: t('colorPicker'), alphaLabel: t('colorAlpha') })
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
              value: colorFor('selShadow'),
              onChange: value => setThemeFlag('selShadow', SF_ROW_SHADOWS.includes(value) ? value : 'off')
            })
          }),
          jsx(Row, {
            title: t('tabsSelHover'),
            description: t('tabsSelHoverDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'off', label: t('selHoverOff') },
                { id: 'soft', label: t('selHoverSoft') },
                { id: 'strong', label: t('selHoverStrong') }
              ],
              value: tabs.selHover,
              onChange: value => patch('tabs', 'selHover', value)
            })
          }),
          jsx('p', { className: 'sf-subhead', children: t('tabsLiveHead') }),
          jsx(ToggleRow, {
            label: t('tabsRowLive'),
            description: t('tabsRowLiveDesc'),
            checked: tabs.rowLive,
            onChange: value => patch('tabs', 'rowLive', value)
          }),
          jsx(Row, {
            title: t('tabsLiveFrame'),
            description: t('tabsLiveFrameDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'off', label: t('liveFrameOff') },
                { id: 'ring', label: t('liveFrameRing') },
                { id: 'glow', label: t('liveFrameGlow') }
              ],
              value: tabs.liveFrame,
              onChange: value => patch('tabs', 'liveFrame', value)
            })
          }),
          jsx(Row, {
            title: t('tabsDoneFx'),
            description: t('tabsDoneFxDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'off', label: t('doneFxOff') },
                { id: 'glow', label: t('doneFxGlow') },
                { id: 'wobble', label: t('doneFxWobble') },
                { id: 'glow-wobble', label: t('doneFxGlowWobble') },
                { id: 'shine', label: t('doneFxShine') },
                { id: 'pop', label: t('doneFxPop') }
              ],
              value: tabs.doneFx,
              onChange: value => patch('tabs', 'doneFx', value)
            })
          }),
          jsx(Row, {
            title: t('tabsDoneFxAxis'),
            description: t('tabsDoneFxAxisDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'x', label: t('doneFxAxisX') },
                { id: 'y', label: t('doneFxAxisY') },
                { id: 'z', label: t('doneFxAxisZ') }
              ],
              value: tabs.doneFxAxis,
              onChange: value => patch('tabs', 'doneFxAxis', value)
            })
          }),
          jsx(Row, {
            title: t('tabsDoneFxStrength'),
            description: t('tabsDoneFxStrengthDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'subtle', label: t('doneFxSubtle') },
                { id: 'medium', label: t('doneFxMedium') },
                { id: 'strong', label: t('doneFxStrong') }
              ],
              value: tabs.doneFxStrength,
              onChange: value => patch('tabs', 'doneFxStrength', value)
            })
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
              // v1.24.0: Tab-Selektor-Modus erzwingt `in-place` (siehe
              // `effectiveOpenIntent`). Wir no-oppen onChange hier, damit
              // der UI-Punkt nicht versehentlich auf "Stapeln/Tab" hängen
              // bleibt, wenn der User ihn klickt — der Hinweis-Block
              // darunter macht das Verhalten sichtbar.
              onChange: tabs.asTabSelector ? () => {} : value => patch('tabs', 'openIntent', value)
            })
          }),
          tabs.asTabSelector
            ? jsx(Row, {
                title: t('tabsOpenIntentForcedNote'),
                description: null,
                action: null
              })
            : null,
          jsx(ToggleRow, {
            label: t('tabsAsTabSelector'),
            description: t('tabsAsTabSelectorDesc'),
            checked: tabs.asTabSelector,
            onChange: value => patch('tabs', 'asTabSelector', value)
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
          jsx(Row, {
            title: t('tabsMaxVisible'),
            description: t('tabsMaxVisibleDesc'),
            action: jsx(NumberInput, {
              min: 0,
              max: 200,
              step: 1,
              value: tabs.maxVisible,
              onChange: value => patch('tabs', 'maxVisible', value)
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
                { id: 'source', label: t('groupsAutoSource') },
                { id: 'project', label: t('groupsAutoProject') }
              ],
              value: groups.autoMode,
              disabled: !groups.enabled,
              onChange: value => patch('groups', 'autoMode', value)
            })
          }),
          jsx(Row, {
            title: t('groupsHeaderDensity'),
            description: t('groupsHeaderDensityDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'compact', label: t('headerDensityCompact') },
                { id: 'comfortable', label: t('headerDensityComfortable') },
                { id: 'detailed', label: t('headerDensityDetailed') }
              ],
              value: groups.headerDensity,
              disabled: !groups.enabled,
              onChange: value => patch('groups', 'headerDensity', value)
            })
          }),
          jsx(Row, {
            title: t('groupsNameSize'),
            description: t('groupsNameSizeDesc'),
            action: jsx(NumberInput, {
              min: 10,
              max: 24,
              step: 1,
              value: groups.nameSize,
              onChange: value => patch('groups', 'nameSize', clampNumber(value, 10, 24, 14))
            })
          }),
          jsx(ToggleRow, {
            label: t('groupsNameCaps'),
            description: t('groupsNameCapsDesc'),
            checked: groups.nameCaps,
            onChange: value => patch('groups', 'nameCaps', value)
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

/* #full */
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

/* #end */
/* #full */
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

/* #end */
      // ── Individualisierung ──────────────────────────────────────────────
      jsxs(SettingsSection, {
        icon: 'symbol-color',
        id: 'sf-sec-personal',
        title: t('secPersonal'),
        description: t('secPersonalDesc'),
        children: [
/* #full */
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
                jsx('input', {
                  'aria-label': t('colorPicker'),
                  className: 'sf-colorpick',
                  onChange: event => patch('personal', 'accentColor', String(event.target.value || '').trim()),
                  title: t('colorPicker'),
                  type: 'color',
                  value: /^#[0-9a-f]{6}$/i.test(String(personal.accentColor || '')) ? personal.accentColor : '#7c3aed'
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
/* #end */
          jsx(Row, {
            title: t('personalPaneSurface'),
            description: t('personalPaneSurfaceDesc'),
            action: jsx(Segment, {
              options: [
                { id: 'native', label: t('personalPaneSurfaceNative') },
                { id: 'chat', label: t('personalPaneSurfaceChat') },
                { id: 'none', label: t('personalPaneSurfaceNone') }
              ],
              value: personal.paneSurface === 'chat' || personal.paneSurface === 'none' ? personal.paneSurface : 'native',
              onChange: value => patch('personal', 'paneSurface', value)
            })
          }),
/* #full */
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
/* #end */
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
            title: t('aboutResetAll'),
            description: t('aboutResetAllDesc'),
            action: jsx(Button, {
              onClick: () => setResetAllOpen(true),
              size: 'sm',
              variant: 'ghost',
              children: t('aboutResetAll')
            })
          }),
          jsx(Row, {
            title: t('aboutResetSettings'),
            description: t('aboutResetSettingsDesc'),
            action: jsx(Button, {
              onClick: () => {
                resetSettings()
                // v1.27.4: autoMode ist nach dem Reset 'project' — den
                // Projekt-Baum sofort frisch ziehen, damit die Projekt-
                // Sektionen ohne Verzögerung erscheinen.
                invalidateProjectTree()
                void refreshProjectsList()
                scheduleSessionsRefresh(200)
              },
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
      }),
      resetAllOpen
        ? jsx(ConfirmDialog, {
          cancelLabel: t('cancel'),
          confirmLabel: t('aboutResetAll'),
          destructive: true,
          description: t('aboutResetAllDesc'),
          onClose: () => setResetAllOpen(false),
          onConfirm: () => {
            resetSettings()
            resetGroups()
            // Auch die Laufzeit-Overlays leeren (v1.24.0): Projekt-Seed und
            // Composer-Pick sind Plugin-seitige Zuordnungen — ein „Alles
            // zurücksetzen", das sie überspringt, wäre nur ein halber Wipe.
            $sessionProjectSeed.set({})
            $composerPick.set({ id: '', label: '', color: null, at: 0 })
            // v1.27.4: Nach dem Reset läuft die Gruppierung mit dem neuen
            // Default 'project' — der Projekt-Baum muss sofort frisch
            // gezogen werden, sonst bleiben die Projekt-Sektionen leer,
            // bis der nächste 60-s-Poll kommt (User-Report: „nach Reset
            // werden Sessions ohne Zuweisung dargestellt"). Der Seed-Wipe
            // oben macht Plugin-seitige Overlays platt; die autoritative
            // Zuordnung kommt aus projects.tree — invalidate + sofortiger
            // Refresh stellt sie als Anzeige wieder her.
            invalidateProjectTree()
            void refreshProjectsList()
            scheduleSessionsRefresh(200)
            setResetAllOpen(false)
          },
          open: true,
          title: t('aboutResetAll')
        })
        : null
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

    // 1) i18n + Einstellungen + Gruppen laden, Styles registrieren.
    //    i18n VOR loadGroups: die Migrations-Toasts (showMigrationToasts)
    //    brauchen die Bundles bereits registriert.
    ctx.i18n.register(LOCALES)
    loadSettings()
    loadGroups()
    const removeCss = injectCss()

/* #full */
    // 2) Controller starten (Animation, Strg+Scroll).
    const disposeAnimation = createAnimationController(ctx)
/* #end */
    const wheelController = createWheelController(ctx)

/* #full */
    // 2b) Glass-Lesbarkeit: Einstellungen als Attribute/Variablen auf <html>
    //     spiegeln; das Stylesheet reagiert rein per CSS darauf.
    applyGlass()
    const stopGlassWatch = $settings.listen(() => applyGlass())
/* #end */

/* #full */
    // 2b-3) Individualisierung: Akzent-Tönung, Chat-Hintergrund, Content-Shell.
    applyPersonal()
    const stopPersonalWatch = $settings.listen(() => applyPersonal())
    ctx.setInterval(() => syncPaneBackgrounds(), 2500)
/* #end */

    // 2b-4) Session-Ansicht (Liste/Grid): Layout-Variablen auf <html>.
    applyGrid()
    const stopGridWatch = $settings.listen(() => applyGrid())

    // 2b-4b) Row-Design: Verlauf, Schatten, Titel-Verlauf, Auswahl, Live-Status.
    applyRows()
    const stopRowsWatch = $settings.listen(() => applyRows())
    // Theme-Wechsel der App (Dark↔Light) → Zeilen-/Grid-Farben sofort umschalten.
    const stopThemeWatch = watchAppTheme(() => applyRows())
    // 2b-5) Info-Dichte „Wie Hermes": folgt der App-Einstellung live.
    const stopAppDensityWatch = watchAppDensity()

    // 2b-6) Kontextfenster-Info (reduziert): Prozent je LIVE-Session.
    const stopCtxInfoWatch = $settings.listen(() => {
      if (contextInfoNeeded()) {
        scheduleContextRefresh(400)
      } else {
        window.clearTimeout(ctxRefreshTimer)
        $ctxInfo.set({})
      }
    })

    if (contextInfoNeeded()) {
      scheduleContextRefresh(2500)
    }

/* #full */
    // 2c) Umlaufender Glow-Ring folgt der Aktivität (Modus „busy").
    const stopArcWatch = [
      $activity.listen(() => syncArc()),
      $liveMap.listen(() => syncArc()),
      host.state.focusedStoredSessionId.listen(() => syncArc())
    ]
/* #end */

/* #full */
    // 2d) UI-Tabs: Sidebar-Optik für die Content-Tab-Leiste + Live-Status.
    applyUiTabs()
    const stopUiTabsWatch = $settings.listen(() => applyUiTabs())
    const stopTabBusyWatch = [
      $activity.listen(() => syncTabBusy()),
      $liveMap.listen(() => syncTabBusy())
    ]

    ctx.setInterval(() => syncTabBusy(), 2000)
/* #end */

/* #full */
    // 2e) "Liste/Grid als Tab-Selektor": Hermes-eigene Content-Tab-Leiste
    //     ausblenden, wenn die Pane dieselbe Navigation schon abdeckt.
    applyTabSelectorMode()
    const stopTabSelectorWatch = $settings.listen(() => applyTabSelectorMode())
/* #end */

    // 2f) Gruppen-Kopfzeilen-Dichte (compact/comfortable/detailed).
    applyGroupsDensity()
    const stopGroupsDensityWatch = $settings.listen(() => applyGroupsDensity())

    // Versions-Stempel: belegt im Plugin-Storage, welche Version zuletzt sauber
    // geladen wurde (Hilfe beim Debuggen nach Kopie/Hot-Reload).
    try {
      ctx.storage.set('_meta', { loadedAt: Date.now(), version: VERSION })
    } catch (error) {
      console.warn(`[${ID}] meta write failed`, error)
    }

    console.info(`[${ID}] v${VERSION} loaded (glass: ${readSetting('glass', 'enabled') ? 'on' : 'off'})`)

/* #full */
    // Radius des Glow-Rings folgt live der echten Composer-Kontur (Theme-unabhängig).
    // Idle-Drossel (v1.24.0): alle 4 s wird nur geschrieben, wenn sich der
    // gemessene Wert geändert hat — measureComposerRadius macht den DOM-Read
    // sowieso nur bei vorhandener Composer-Fläche und vergleicht vor dem Set.
    ctx.setInterval(() => measureComposerRadius(), 4000)
/* #end */


    // 3) Session-Daten: initial (via Gateway-Gate) + bei Events + Polls.
    //    Der erste Satz wird NICHT blind gefeuert: vor dem ersten Socket-Open
    //    wirft host.request ab — das war die Ursache für Fehlerbanner +
    //    „Kein Projekt“-Gruppierung beim App-Start (bis zum manuellen
    //    Aktualisieren). scheduleGatewayBootstrap feuert den Initial-Satz
    //    beim ersten `open`, zieht bei Reconnects sofort nach und hat einen
    //    20-s-Fallback für Builds ohne das Gateway-Atom.
    scheduleGatewayBootstrap(ctx)
    pruneSessionProjectSeeds()

    ctx.onEvent('message.complete', event => {
      scheduleSessionsRefresh(1200)
      // Frischer Live-Status direkt nach Abschluss: die Transition im
      // Poll erkennt „fertig" in Sekunden statt erst beim nächsten
      // 30-s-Takt; noteSessionDone dedupliziert Doppel-Auslösungen.
      const completedStoredId = resolveStoredId(String(event?.session_id || ''))

      void pollLiveSessions().then(() => {
        if (!completedStoredId) {
          return
        }

        const cfg = $settings.get().tabs || {}

        if ((cfg.doneFx || 'glow-wobble') === 'off') {
          return
        }

        const busy = Object.values($liveMap.get()).some(
          entry =>
            entry &&
            entry.storedId === completedStoredId &&
            ['waiting', 'streaming', 'working', 'starting', 'resuming'].includes(String(entry.status))
        )

        if (!busy) {
          noteSessionDone(completedStoredId)
        }
      })
    })
    ctx.onEvent('session.info', () => {
      scheduleSessionsRefresh(2500)
      void pollLiveSessions()
    })

    // Gateway-Events in Echtzeit in die Aktivitäts-Engine spiegeln:
    // Tool-Namen für die Detailreich-Info-Zeile und Status ohne
    // Poll-Verzögerung (Delta-Events setzen nur bei echter Änderung).
    const wireActivityEvent = (type, kind, nameOf) => {
      try {
        ctx.onEvent(type, event => {
          try {
            noteEventKind(String(event?.session_id || ''), kind, nameOf ? nameOf(event?.payload) : '')
          } catch {
            /* einzelne kaputte Events ignorieren */
          }
        })
      } catch {
        /* Event-Typ von dieser Runtime nicht unterstützt */
      }
    }

    wireActivityEvent('reasoning.delta', 'thinking')
    wireActivityEvent('thinking.delta', 'thinking')
    wireActivityEvent('message.delta', 'streaming')
    wireActivityEvent('tool.generating', 'tool', payload => (payload && typeof payload.name === 'string' ? payload.name : ''))
    wireActivityEvent('tool.start', 'tool', payload => (payload && typeof payload.name === 'string' ? payload.name : ''))
    wireActivityEvent('tool.complete', 'thinking')
    wireActivityEvent('error', 'error')

    ctx.setInterval(() => {
      void pollLiveSessions()
    }, Math.max(10, Number(readSetting('tabs', 'livePollSec')) || 30) * 1000)

    ctx.setInterval(() => {
      void refreshSessions()
    }, Math.max(15, Number(readSetting('tabs', 'refreshSec')) || 45) * 1000)

    // Projekt-Cache (Name/Pfad) — selten, aber leichtgewichtig: einmal pro
    // Minute reicht für die Projekt-Gruppierungs-Labels.
    ctx.setInterval(() => {
      void refreshProjectsList()
    }, 60_000)

    // Status-Pips der App-Nav-Zeile (v1.20): Kanban-Board + Cron-Jobs über
    // die App-Bridge — gleicher Takt wie der Projekt-Cache, In-Flight-Guard
    // drin. Sofortiger erster Satz + 60-s-Takt.
    void refreshNavStatus()
    ctx.setInterval(() => {
      void refreshNavStatus()
    }, NAV_STATUS_POLL_MS)

/* #full */
    // Composer-Projekt-Pill (v1.21): Sync-Takt fängt App-Re-Renders (Zeile weg
    // → neu injizieren) und Pane-Wechsel; die Listener ziehen Label/Menu-
    // Zustand sofort nach, wenn Projekte, Seed oder Fokus sich ändern.
    adoptComposerPickForNewSession() // Baseline: aktueller Fokus, kein Übergang
    kickComposerPillSync()
    const stopComposerPillWatch = [
      $projectsList.listen(() => kickComposerPillSync()),
      $sessionProjectSeed.listen(() => kickComposerPillSync()),
      $composerPick.listen(() => kickComposerPillSync()),
      host.state.focusedStoredSessionId.listen(() => {
        adoptComposerPickForNewSession()
        kickComposerPillSync()
      })
    ]
    ctx.setInterval(() => kickComposerPillSync(), CPROJ_SYNC_MS)
/* #end */

    ctx.setInterval(() => {
      expireActivity()
    }, 30_000)

/* #full */
    // 3c) Sidebar-Observer: App→Plugin-Sync für Projekt-/Session-Änderungen
    //     in der Hermes-Desktop-Sidebar (Gateway feuert dafür keine Events).
    //     MutationObserver auf [data-sessions-mode] + window focus. Disposer
    //     läuft im onDispose-Block unten.
    const stopSidebarSync = watchSidebarSync(ctx)
/* #end */

    // 3d) Window-globale Drag-End-/Drop-Fallbacks: wenn eine Zeile während
    //     eines Drags unmountet (Rerender wegen refresh), feuert ihr lokaler
    //     onDragEnd nicht mehr — $dragActive wäre stuck auf true und die
    //     Pinned-Placeholder-Sektion bliebe für immer sichtbar. Window-Hook
    //     resettet den Zustand defensiv auf jedem dragend/drop.
    const resetDragActive = () => {
      try {
        $dragActive.set(false)
      } catch {
        /* Atom weg — egal */
      }
    }
    try {
      window.addEventListener('dragend', resetDragActive)
      window.addEventListener('drop', resetDragActive)
    } catch {
      /* Tests ohne echtes window */
    }

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
/* #full */
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
/* #end */
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
/* #full */
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
/* #end */
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
/* #full */
        for (const stop of stopArcWatch) stop()
        for (const stop of stopTabBusyWatch) stop()
        stopUiTabsWatch()
        clearUiTabs()
        stopTabSelectorWatch()
        clearTabSelectorMode()
/* #end */
        stopGroupsDensityWatch()
        clearGroupsDensity()
/* #full */
        stopGlassWatch()
        clearGlass()
        stopPersonalWatch()
        clearPersonal()
/* #end */
        stopGridWatch()
        stopRowsWatch()
        stopThemeWatch()
        clearRows()
        stopAppDensityWatch()
        stopCtxInfoWatch()
/* #full */
        for (const stop of stopComposerPillWatch) stop()
        setComposerMenuOpen(null)
        document.querySelectorAll(`[${CPROJ_MARKER}]`).forEach(el => el.remove())
        const cprojMenu = document.querySelector('[data-sf-cproj-menu]')
        if (cprojMenu) cprojMenu.remove()
/* #end */
        window.clearTimeout(ctxRefreshTimer)
/* #full */
        if (typeof stopSidebarSync === 'function') stopSidebarSync()
/* #end */
        try {
          window.removeEventListener('dragend', resetDragActive)
          window.removeEventListener('drop', resetDragActive)
        } catch {
          /* kein echtes window — ignorieren */
        }
        removeCss()
/* #full */
        disposeAnimation()
/* #end */
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
