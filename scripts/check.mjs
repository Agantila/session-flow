#!/usr/bin/env node
/**
 * Check für plugin.js:
 *   1. Syntaxcheck (ESM) über `node --check`.
 *   2. i18n-Audit: vergleicht alle im Code benutzten `t('key')`-Keys mit den
 *      Locale-Bundles (EN/DE) und meldet fehlende sowie unbenutzte Keys.
 *
 * Aufruf:  npm run check   (oder: node scripts/check.mjs)
 * Exit-Code != 0 bei Fehlern.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pluginPath = fileURLToPath(new URL('../plugin.js', import.meta.url))
const source = readFileSync(pluginPath, 'utf8')

let failed = false

// ── 1) Syntaxcheck ───────────────────────────────────────────────────────────
const check = spawnSync(process.execPath, ['--check', pluginPath], { encoding: 'utf8' })

if (check.status !== 0) {
  failed = true
  console.error('✗ Syntaxcheck fehlgeschlagen:')
  console.error(check.stderr || check.stdout)
} else {
  console.log('✓ Syntax ok (ESM)')
}

// ── 2) i18n-Audit ────────────────────────────────────────────────────────────
const used = new Set()

for (const match of source.matchAll(/\bt\('([^'\\]+)'\)/g)) {
  used.add(match[1])
}

function bundleKeys(name) {
  const start = source.indexOf(`const ${name} = {`)
  const end = source.indexOf('\n}', start)

  if (start < 0 || end < 0) {
    return null
  }

  const block = source.slice(start, end)
  const keys = new Set()

  for (const line of block.split('\n')) {
    const match = line.match(/^\s{2}(?:'([^']+)'|([A-Za-z_][\w]*))\s*:/)

    if (match) {
      keys.add(match[1] || match[2])
    }
  }

  return keys
}

for (const locale of ['EN', 'DE']) {
  const keys = bundleKeys(locale)

  if (!keys) {
    failed = true
    console.error(`✗ Locale-Bundle ${locale} nicht gefunden`)
    continue
  }

  const missing = [...used].filter(key => !keys.has(key))

  if (missing.length) {
    failed = true
    console.error(`✗ ${locale}: fehlende Keys: ${missing.join(', ')}`)
  } else {
    console.log(`✓ ${locale}: alle ${used.size} benutzten Keys vorhanden`)
  }
}

// ── 3) Hook-Reihenfolge-Audit ────────────────────────────────────────────────
// React verlangt, dass ALLE Hooks eines Components bei JEDEM Render in
// gleicher Anzahl und Reihenfolge laufen. Ein Hook innerhalb eines
// if/for/while/switch/else/&&/||/Ternary-Zweigs ändert die Hook-Anzahl, sobald
// sich der steuernde Render-Input ändert — React wirft dann #300 ("Rendered
// fewer hooks") bzw. #310 ("Rendered more hooks") und die Pane landet in der
// Error-Boundary („session-flow:pane failed to render"). Genau das passierte
// beim Umschalten der Kopfzeilen-Dichte auf „Detailreich" (v1.18.0–v1.22.1).
//
// Der Render-Smoketest kann das NICHT sehen (dort sind useEffect/useState
// Stubs bzw. No-ops), deshalb prüft dieser Check statisch.
//
// Grenzen: erkennt Hooks in bedingten Blöcken und auf bedingten Zeilen, nicht
// aber Hooks nach einem frühzeitigen `return` in einem bedingten Zweig. Die
// Analyse läuft über einen maskierten Quelltext (Kommentare/Strings/
// Template-Literale durch Leerzeichen ersetzt, Zeilennummern bleiben stabil).

/** Ersetzt Kommentare, Strings und Template-Literale durch Leerzeichen
 *  (gleiche Länge, Zeilenumbrüche bleiben). */
function maskNonCode(source) {
  let out = ''
  let i = 0
  let st = 'code'
  const stack = []

  while (i < source.length) {
    const c = source[i]
    const n = source[i + 1]

    if (st === 'code') {
      if (c === '/' && n === '/') { st = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && n === '*') { st = 'block'; out += '  '; i += 2; continue }
      if (c === "'") { st = 'sq'; out += ' '; i += 1; continue }
      if (c === '"') { st = 'dq'; out += ' '; i += 1; continue }
      if (c === '`') { st = 'tpl'; out += ' '; i += 1; continue }
      if (c === '}' && stack.length) { st = stack.pop(); out += ' '; i += 1; continue }
      out += c; i += 1; continue
    }

    if (st === 'line') {
      if (c === '\n') { st = 'code'; out += '\n' } else { out += ' ' }
      i += 1; continue
    }

    if (st === 'block') {
      if (c === '*' && n === '/') { st = 'code'; out += '  '; i += 2; continue }
      out += c === '\n' ? '\n' : ' '
      i += 1; continue
    }

    if (st === 'sq' || st === 'dq') {
      const quote = st === 'sq' ? "'" : '"'
      if (c === '\\') { out += '  '; i += 2; continue }
      if (c === quote) { st = 'code'; out += ' '; i += 1; continue }
      out += c === '\n' ? '\n' : ' '
      i += 1; continue
    }

    // st === 'tpl'
    if (c === '\\') { out += '  '; i += 2; continue }
    if (c === '$' && n === '{') { stack.push('tpl'); st = 'code'; out += '  '; i += 2; continue }
    if (c === '`') { st = stack.pop() || 'code'; out += ' '; i += 1; continue }
    out += c === '\n' ? '\n' : ' '
    i += 1
  }

  return out
}

const HOOK_CALL = /(?:^|[^\w$.])(use(?:State|Effect|Memo|Ref|Callback|Value|LayoutEffect|Reducer)\s*\()/
const GUARD_HEAD = /(?:^|[^\w$.])(?:if|for|while|switch)\s*\(|\belse\b\s*\{?\s*$|[&|]{2}\s*$|\?\s*$/
const TERNARY_LINE = /^\s*[?:]\s/

/** Findet Hook-Aufrufe innerhalb eines bedingten Blocks / auf bedingten Zeilen. */
function findConditionalHooks(source) {
  const lines = maskNonCode(source).split('\n')
  const guards = []
  const hits = []
  let pending = false

  lines.forEach((line, index) => {
    const persistent = GUARD_HEAD.test(line)
    const sameLine = persistent || TERNARY_LINE.test(line)

    if (persistent) {
      pending = true
    }

    for (const ch of line) {
      if (ch === '{') {
        guards.push(pending)
        pending = false
      } else if (ch === '}' && guards.length) {
        guards.pop()
      }
    }

    if (HOOK_CALL.test(line) && (guards.some(Boolean) || sameLine)) {
      hits.push({ line: index + 1, text: line.trim() })
    }
  })

  return hits
}

// Selbsttest: der Scanner MUSS den bedingten Hook finden und den sauberen
// Hook NICHT melden. Sonst ist der Audit ein stiller No-op.
const auditSelfTest =
  findConditionalHooks(
    [
      'function Ok() {',
      '  const a = useState(1)',
      '  useEffect(() => {}, [a])',
      '  if (a) {',
      '    useEffect(() => {}, [a])',
      '  }',
      '  return a',
      '}'
    ].join('\n')
  )

if (auditSelfTest.length !== 1 || auditSelfTest[0].line !== 5) {
  failed = true
  console.error(`✗ Hook-Audit-Selbsttest fehlgeschlagen (Treffer: ${JSON.stringify(auditSelfTest)})`)
} else {
  console.log('✓ Hook-Audit-Selbsttest ok')
}

const conditionalHooks = findConditionalHooks(source)

if (conditionalHooks.length) {
  failed = true
  console.error('✗ Bedingte Hooks gefunden (React #300/#310 → Pane-Crash):')
  console.error('  Hooks müssen IMMER laufen — Bedingung IN den Hook, nie um ihn herum.')

  for (const hit of conditionalHooks) {
    console.error(`  Z.${hit.line}: ${hit.text}`)
  }
} else {
  console.log('✓ Hook-Reihenfolge: keine bedingten Hooks')
}

if (failed) {
  process.exit(1)
}

console.log('Alles gut.')
