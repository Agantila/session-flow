/**
 * build-catalog.mjs — erzeugt den SDK-only Catalog-Build (`desktop/plugin.js`)
 * aus der Quelle `full/plugin.js`, indem jede Full-only-Region (die
 * Build-Marker full/end, siehe unten) entfernt wird — Modell pinned-folders:
 * ein Quellfile, zwei Builds.
 *
 *  - `node scripts/build-catalog.mjs`          → schreibt ./desktop/plugin.js
 *  - `node scripts/build-catalog.mjs --check`  → vergleicht nur (CI: ist der
 *    committete Catalog-Build aktuell?)
 *
 * Layout (Review R2, documented layout): `plugin.yaml` am Repo-Root,
 * Catalog-Eintrittspunkt `desktop/plugin.js`, `full/` außerhalb von
 * `desktop/`. Der Catalog-Build ist der Eintrittspunkt, den der Plugin-Katalog
 * am gepinnten SHA lädt (Catalog-Regel 8: SDK-only, kein App-Markup, keine
 * window.hermesDesktop-Doors). Der Full-Build bleibt die Standalone-
 * Distribution über install.sh.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const srcPath = path.join(root, 'full', 'plugin.js')
const outPath = path.join(root, 'desktop', 'plugin.js')

const src = readFileSync(srcPath, 'utf8')
const lines = src.split('\n')
const out = []
let openKind = null // null | 'full' | 'catalog'
let removed = 0

for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim()

  if (t === '/* #full */' || t === '/* #catalog-only */') {
    if (openKind !== null) {
      throw new Error(`Zeile ${i + 1}: Build-Region in Build-Region geöffnet (${t})`)
    }
    openKind = t === '/* #full */' ? 'full' : 'catalog'

    // Der Catalog-Marker selbst bleibt als Doku-Kommentar im Output.
    if (openKind === 'catalog') out.push(lines[i])
    continue
  }

  if (t === '/* #end */') {
    if (openKind === null) {
      throw new Error(`Zeile ${i + 1}: #end ohne offene Build-Region`)
    }
    if (openKind === 'catalog') out.push(lines[i])
    openKind = null
    continue
  }

  if (openKind === null || openKind === 'catalog') {
    out.push(lines[i])
  } else {
    removed++
  }
}

if (openKind !== null) {
  throw new Error('Offene Build-Region am Dateiende')
}

const result = out.join('\n')

// Der Catalog-Build darf die Full-only Muster nicht enthalten (Spiegelbild
// des desktop-surface-Checks im Catalog-CI). Details: tests/surface-test.mjs.
const forbidden = [
  /window\.hermesDesktop/,
  /globalThis\.window\?\.hermesDesktop/,
  /hermes\.desktop\.projectScope/
]
for (const pattern of forbidden) {
  if (pattern.test(result)) {
    throw new Error(`Catalog-Build enthält verbotenes Muster: ${pattern}`)
  }
}

const check = process.argv.includes('--check')

if (check) {
  const current = readFileSync(outPath, 'utf8')

  if (current !== result) {
    console.error('desktop/plugin.js (Catalog-Build) ist nicht aktuell — bitte `node scripts/build-catalog.mjs` ausführen und committen.')
    process.exit(1)
  }
  console.log('desktop/plugin.js ist aktuell (Catalog-Build = Stand von full/plugin.js).')
  process.exit(0)
}

// Syntax-Verifikation des Outputs, bevor geschrieben wird.
mkdirSync(path.dirname(outPath), { recursive: true })
const tmpPath = outPath
writeFileSync(tmpPath, result)
const nodeCheck = spawnSync(process.execPath, ['--check', tmpPath], { encoding: 'utf8' })

if (nodeCheck.status !== 0) {
  console.error(nodeCheck.stderr)
  throw new Error('Catalog-Build ist nicht parse-bar (node --check fehlgeschlagen)')
}

console.log(
  `Catalog-Build geschrieben: desktop/plugin.js (${(result.length / 1024).toFixed(1)} KB, ` +
    `${result.split('\n').length} Zeilen, ${removed} Full-only-Zeilen entfernt)`
)
