// tests/surface-test.mjs — Catalog-Regel-8-Wächter (Spiegelbild des
// `desktop surface`-Checks im Plugin-Katalog-CI).
//
// Geprüft wird NUR der Catalog-Build (Root plugin.js), denn genau dieser
// wird im Plugin-Katalog am gepinnten SHA geladen. Verboten sind:
//   - App-Markup-Queries: document.querySelector(All) mit data-slot /
//     data-tour / data-testid / data-sidebar / data-tree-tab / data-chat-
//     surface / data-sessions-mode / data-pane-host / aui_* / codicon-*
//   - Observer auf document.body / document.documentElement
//   - window.hermesDesktop / globalThis.window?.hermesDesktop (alle Doors)
//   - der App-interne localStorage-Key hermes.desktop.projectScope
//   - CSS-Override-Selektoren auf App-Marker im Stylesheet
//   - eval / new Function / dynamic import() außer SDK+react / Script-Inject
//
// Erlaubt und disclosed: `closest(BUILTIN_IGNORE)` auf dem Event-Target des
// eigenen wheel-Listeners (Geste-Disambiguierung, kein document-Query).
//
// Aufruf: node tests/surface-test.mjs   (Exit != 0 bei Verstoß)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pluginPath = fileURLToPath(new URL('../plugin.js', import.meta.url))
const source = readFileSync(pluginPath, 'utf8')
const lines = source.split('\n')

let failed = false
const hits = []

// ── 1) CSS-Template-Literal extrahieren (alles zwischen `const CSS = \`` und
//        der schließenden Backtick-Zeile) ────────────────────────────────────
const cssStart = lines.findIndex(l => l.startsWith('const CSS = `'))
let cssEnd = -1
if (cssStart >= 0) {
  cssEnd = lines.findIndex((l, i) => i > cssStart && l.trim() === '`')
}
if (cssStart < 0 || cssEnd < 0) {
  console.error('✗ CSS-Block nicht gefunden — plugin.js-Struktur geändert?')
  process.exit(1)
}
const cssText = lines.slice(cssStart, cssEnd + 1).join('\n')
const jsText = lines.slice(0, cssStart).concat(lines.slice(cssEnd + 1)).join('\n')

// ── 2) CSS: keine Override-Selektoren auf App-Marker ────────────────────────
const CSS_FORBIDDEN = [
  /\[data-slot=/,
  /\[data-tour=/,
  /\[data-testid=/,
  /\[data-sidebar=/,
  /\[data-tree-tab/,
  /\[data-chat-surface/,
  /\[data-pane-host/,
  /\[data-sessions-mode/,
  /\[role='tablist'\]/,
  /\[role="tablist"\]/,
  /\.aui-md/,
  /\.kanban-drawer-content/,
  /\.codicon-add/,
  /\.pane-tab-content/
]
for (const pattern of CSS_FORBIDDEN) {
  if (pattern.test(cssText)) {
    failed = true
    hits.push(`CSS-Selektor auf App-Marker: ${pattern}`)
  }
}

// ── 3) JS: keine document-Queries auf App-Marker ────────────────────────────
const QUERY_APP_MARKER =
  /document\.(querySelector|querySelectorAll)\s*\([^)]*(data-slot|data-tour|data-testid|data-sidebar|data-tree-tab|data-chat-surface|data-pane-host|data-sessions-mode|data-pane-overlay|aui_|codicon-|kanban-drawer|pane-tab-content)/
for (const [i, line] of lines.entries()) {
  if (QUERY_APP_MARKER.test(line)) {
    failed = true
    hits.push(`Z.${i + 1}: App-Markup-Query — ${line.trim().slice(0, 120)}`)
  }
}

// ── 4) JS: keine Observer auf body/documentElement ──────────────────────────
for (const [i, line] of lines.entries()) {
  if (/\.observe\(\s*document\.(body|documentElement)/.test(line)) {
    failed = true
    hits.push(`Z.${i + 1}: DOM-Observer auf body/documentElement — ${line.trim().slice(0, 120)}`)
  }
}

// ── 5) JS: keine Desktop-Bridge-Doors, kein App-Scope-Key ───────────────────
const JS_FORBIDDEN = [
  [/window\.hermesDesktop/, 'window.hermesDesktop (Desktop-Bridge)'],
  [/globalThis\.window\?\.hermesDesktop/, 'globalThis.window?.hermesDesktop (Desktop-Bridge)'],
  [/hermes\.desktop\.projectScope/, 'localStorage-Key hermes.desktop.projectScope (App-intern)'],
  [/\beval\s*\(/, 'eval()'],
  [/new Function/, 'new Function'],
  [/document\.createElement\(\s*['"]script['"]\s*\)/, 'Script-Tag-Injection']
]
for (const [i, line] of lines.entries()) {
  for (const [pattern, label] of JS_FORBIDDEN) {
    if (pattern.test(line)) {
      failed = true
      hits.push(`Z.${i + 1}: ${label} — ${line.trim().slice(0, 120)}`)
    }
  }
}

// ── 6) dynamic import() nur für SDK/react ───────────────────────────────────
for (const match of jsText.matchAll(/import\(\s*(['"`])([^'"`]+)\1\s*\)/g)) {
  const target = match[2]
  if (target !== '@hermes/plugin-sdk' && target !== 'react' && target !== 'react/jsx-runtime') {
    failed = true
    hits.push(`dynamic import() von Nicht-SDK-Modul: ${target}`)
  }
}

// ── 7) prototype-Patching ───────────────────────────────────────────────────
for (const [i, line] of lines.entries()) {
  if (/\.prototype\.\w+\s*=/.test(line) || /Object\.defineProperty\([^)]*prototype/.test(line) || /__proto__\s*=/.test(line)) {
    failed = true
    hits.push(`Z.${i + 1}: Prototype-Patching — ${line.trim().slice(0, 120)}`)
  }
}

if (failed) {
  console.error(`✗ Surface-Check FEHLGESCHLAGEN (${hits.length} Befunde) — Catalog-Regel 8:`)
  for (const hit of hits) console.error('  ' + hit)
  process.exit(1)
}

console.log('✓ Surface-Check: Catalog-Build ist frei von App-Markup-Zugriff,')
console.log('  Desktop-Bridge-Doors, Core-CSS-Overrides und Prototype-Patching.')
