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

if (failed) {
  process.exit(1)
}

console.log('Alles gut.')
