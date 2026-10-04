// tests/style-test.mjs — Computed-Style-Test für Session Flow (optional, Playwright).
//
// VERIFIZIERT AM ECHTEN CHROMIUM, dass die Design-Optionen (Zeilen-Verlauf,
// Schatten, Titel-Verlauf, Auswahl-Zustand inkl. Hover-Stufen, Live-Status)
// in Liste UND Grid identisch wirken — inklusive:
//   • Grid-Parität: Karten übernehmen Verlauf/Tönung/Schatten (der Fix zu
//     "Grid zeigte das konfigurierte Design nicht", Spezifitäts-Bug :where()),
//   • Auswahl-Tönung als Layer ÜBER dem Zeilen-Verlauf (Verlauf bleibt sichtbar),
//   • Alpha in Verläufen (#RRGGBBAA → rgba mit Alpha),
//   • selHover-Stufen (off/soft/strong).
//
// Die CSS wird direkt aus plugin.js extrahiert (die echte, injizierte Quelle)
// und in eine minimale Test-Seite mit .sf-items[data-view=list|grid]-Struktur
// geladen. Verglichen werden IMMER Liste gegen Grid (Paritäts-Asserts).
//
// Aufruf:  node tests/style-test.mjs            (skip ohne Playwright)
//          PLAYWRIGHT_PKG=<pfad/zu/node_modules/playwright> node tests/style-test.mjs
//          SF_STYLE_SHOTS=<ordner> node tests/style-test.mjs   (Screenshots)
//
// Keine Repo-Dependencies: Playwright wird nur geladen, wenn vorhanden;
// sonst endet der Test mit SKIP und Exit 0 (CI-sicher).
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const PLUGIN_PATH = fileURLToPath(new URL('../plugin.js', import.meta.url))
const require = createRequire(import.meta.url)

// ── Playwright optional laden ───────────────────────────────────────────────
function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PKG,
    join(process.env.HOME || '/root', '_Linux_VS_Code_Workspace', 'hermes-agent', 'node_modules', 'playwright'),
    join(process.env.HOME || '/root', 'hermes-agent', 'node_modules', 'playwright'),
    'playwright'
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      const mod = require(candidate)
      if (mod && mod.chromium) return { api: mod, from: candidate }
    } catch {
      /* nächster Kandidat */
    }
  }
  return null
}

const pw = loadPlaywright()
if (!pw) {
  console.log('⏭  SKIP: Playwright nicht gefunden — Computed-Style-Test übersprungen.')
  console.log('   Optional: PLAYWRIGHT_PKG=/pfad/zu/node_modules/playwright node tests/style-test.mjs')
  process.exit(0)
}

// ── CSS aus plugin.js extrahieren (die echte injizierte Quelle) ─────────────
const src = readFileSync(PLUGIN_PATH, 'utf8')
const marker = 'const CSS = `'
const markerIdx = src.indexOf(marker)
const injectIdx = src.indexOf('function injectCss')
if (markerIdx < 0 || injectIdx < 0) {
  console.log('✗ CSS-Block nicht gefunden — plugin.js-Struktur geändert?')
  process.exit(1)
}
const css = src.slice(markerIdx + marker.length, src.lastIndexOf('`', injectIdx))
if (!css.includes('data-sf-rowgrad') || css.includes('${')) {
  console.log('✗ CSS-Extraktion unerwartet (fehlende Selektoren oder Interpolation).')
  process.exit(1)
}

// ── Test-Seite bauen: Liste + Grid, gleiche Struktur, gleiche Klassen ───────
const tokens = [
  '--ui-accent:#3b82f6',
  '--ui-text-primary:#e5e5e5',
  '--ui-text-secondary:#c8c8c8',
  '--ui-text-tertiary:#a3a3a3',
  '--ui-text-quaternary:#8b8b93',
  '--ui-row-hover-background:rgba(127,127,127,.08)',
  '--ui-row-active-background:rgba(127,127,127,.12)',
  '--ui-bg-tertiary:rgba(127,127,127,.12)',
  '--ui-stroke-tertiary:rgba(127,127,127,.2)',
  '--foreground:#e5e5e5'
].join(';')

const row = (id, label, extra = '') =>
  `<div class="sf-tab" id="${id}"${extra}><span class="sf-tab-lead"></span><span class="sf-tab-main"><span class="sf-tab-title">${label}</span><span class="sf-tab-preview">preview</span></span><span class="sf-tab-meta"><span class="sf-tab-time">now</span></span></div>`

const html = `<!doctype html>
<html lang="de"
  data-sf-rowgrad="on" data-sf-rowshadow="medium" data-sf-titlegrad="on"
  data-sf-seltint="custom" data-sf-selborder="on" data-sf-selshadow="medium"
  data-sf-selhover="soft" data-sf-rowlive="on"
  style="--sf-row-from:#7c3aed80;--sf-row-to:#00dbda20;--sf-row-angle:120deg;--sf-sel-color:#ff00ff;--sf-title-from:#e4e4e7;--sf-title-to:#8b8b93;--sf-title-angle:90deg">
<head><meta charset="utf-8">
<style>:root{${tokens}}body{background:#1c1c1e;padding:16px;margin:0}</style>
<style id="sf-css">${css}</style>
</head>
<body>
  <div class="sf-pane">
    <div class="sf-section">
      <div class="sf-items" data-view="list">
        ${row('l1', 'Liste normal')}
        ${row('l2', 'Liste aktiv', ' data-active="true"')}
        ${row('l3', 'Liste busy', ' data-live="busy"')}
      </div>
    </div>
    <div class="sf-section">
      <div class="sf-items" data-view="grid">
        ${row('g1', 'Grid normal')}
        ${row('g2', 'Grid aktiv', ' data-active="true"')}
        ${row('g3', 'Grid busy', ' data-live="busy"')}
      </div>
    </div>
  </div>
</body></html>`

const dir = mkdtempSync(join(tmpdir(), 'session-flow-style-'))
const htmlPath = join(dir, 'style-test.html')
writeFileSync(htmlPath, html)

// ── Checks ──────────────────────────────────────────────────────────────────
let failed = 0
function check(name, ok, detail) {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

const probeExpr = `(() => {
  const read = id => {
    const el = document.getElementById(id)
    const cs = getComputedStyle(el)
    const title = el.querySelector('.sf-tab-title')
    const tcs = title ? getComputedStyle(title) : null
    return {
      bgImage: cs.backgroundImage,
      bgColor: cs.backgroundColor,
      shadow: cs.boxShadow,
      outline: cs.outline,
      filter: cs.filter,
      titleImage: tcs ? tcs.backgroundImage : '',
      titleColor: tcs ? tcs.color : '',
      titleClip: tcs ? tcs.backgroundClip : ''
    }
  }
  const out = {}
  for (const id of ['l1','l2','l3','g1','g2','g3']) out[id] = read(id)
  return out
})()`

const read = () => page.evaluate(probeExpr)
const has = (s, sub) => typeof s === 'string' && s.includes(sub)
const gradCount = s => (typeof s === 'string' && s.match(/linear-gradient\(/g) || []).length

const { chromium } = pw.api
let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
} catch (error) {
  // Fallback: irgendein installierter Chromium-Headless-Shell aus ~/.cache/ms-playwright
  const base = join(process.env.HOME || '', '.cache', 'ms-playwright')
  const { readdirSync } = await import('node:fs')
  let exe = null
  try {
    for (const d of readdirSync(base).filter(n => n.includes('headless_shell') || n.startsWith('chromium-')).sort().reverse()) {
      for (const sub of ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const p = join(base, d, sub)
        try {
          readFileSync(p)
          exe = p
          break
        } catch {
          /* weiter */
        }
      }
      if (exe) break
    }
  } catch {
    /* kein Cache */
  }
  if (!exe) throw error
  browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--no-sandbox'] })
}

const page = await browser.newPage({ viewport: { width: 760, height: 1800 } })
await page.goto(pathToFileURL(htmlPath).href)
await page.waitForLoadState('load')

try {
  // ── 1) Design AN: Grid übernimmt Verlauf + Alpha (Kern-Bugfix) ────────────
  let P = await read()
  check(
    'Grid-Karte zeigt Zeilen-Verlauf (war vorher: color-mix-Fläche)',
    has(P.g1.bgImage, 'linear-gradient(120deg'),
    P.g1.bgImage.slice(0, 90)
  )
  check('Alpha aus #7c3aed80 (≈0.50) im Grid-Verlauf', has(P.g1.bgImage, 'rgba(124, 58, 237, 0.5'), P.g1.bgImage.slice(0, 140))
  check('Alpha aus #00dbda20 (≈0.125) im Grid-Verlauf', has(P.g1.bgImage, 'rgba(0, 219, 218, 0.1'), '')
  check('Parität: Liste und Grid-Karte identischer Verlauf', P.l1.bgImage === P.g1.bgImage, '')

  // ── 2) Schlagschatten + Titel-Verlauf in beiden Views ─────────────────────
  check('Grid-Karte: Schatten medium aktiv', has(P.g1.shadow, '0.3'), P.g1.shadow)
  check('Parität: Schatten Liste==Grid', P.l1.shadow === P.g1.shadow, '')
  check('Grid-Titel: Verlauf aktiv (clip:text, transparent)', has(P.g1.titleImage, 'linear-gradient') && P.g1.titleClip === 'text' && P.g1.titleColor === 'rgba(0, 0, 0, 0)', `clip=${P.g1.titleClip}`)
  check('Parität: Titel-Verlauf Liste==Grid', P.l1.titleImage === P.g1.titleImage, '')

  // ── 3) Auswahl-Zustand: Tönung als Layer ÜBER dem Verlauf, beide Views ────
  check('Auswahl Grid: 2 Layer (Tönung + Verlauf)', gradCount(P.g2.bgImage) === 2, P.g2.bgImage.slice(0, 120))
  check('Auswahl Grid: Custom-Tönung #ff00ff @16 %', has(P.g2.bgImage, '0.16'), '')
  check('Auswahl Grid: Verlaufs-Layer bleibt sichtbar (120deg)', has(P.g2.bgImage, 'linear-gradient(120deg'), '')
  check('Parität: Auswahl Liste==Grid (bg)', P.l2.bgImage === P.g2.bgImage, '')
  check('Auswahl: Kontur aktiv', has(P.g2.outline, '1px') && has(P.g2.outline, 'solid'), P.g2.outline)
  check('Auswahl: Schatten medium aktiv (nicht Row-Schatten)', has(P.g2.shadow, '0.35'), P.g2.shadow)
  check('Parität: Auswahl Liste==Grid (Schatten+Kontur)', P.l2.shadow === P.g2.shadow && P.l2.outline === P.g2.outline, '')

  // ── 4) Live-Status im Grid (9 %-Akzent-Layer über Verlauf) ────────────────
  check('Live busy Grid: Akzent-Layer (9 %)', has(P.g3.bgImage, '0.09'), P.g3.bgImage.slice(0, 120))
  check('Parität: Live Liste==Grid', P.l3.bgImage === P.g3.bgImage, '')

  // ── 5) Hover: Nicht-Auswahl behält Verlauf (Brightness), Auswahl vertieft ─
  await page.hover('#g1')
  let H = await read()
  check('Hover normal: Verlauf bleibt + Brightness-Feedback', has(H.g1.bgImage, 'linear-gradient(120deg') && has(H.g1.filter, 'brightness'), H.g1.filter)

  await page.hover('#g2')
  H = await read()
  check('selHover soft: Auswahl vertieft auf 24 %', has(H.g2.bgImage, '0.24'), '')
  check('selHover: Brightness auf Auswahl unterdrückt', H.g2.filter === 'none', H.g2.filter)
  const gridHover = H.g2.bgImage
  await page.hover('#l2')
  H = await read()
  check('Parität: Auswahl-Hover Liste==Grid', H.l2.bgImage === gridHover && has(H.l2.bgImage, '0.24'), '')

  await page.mouse.move(4, 4)
  P = await read()
  check('Unhover: Auswahl fällt auf 16 % zurück', has(P.g2.bgImage, '0.16'), '')

  // ── 6) selHover = off: Auswahl bleibt beim Hover unverändert ──────────────
  await page.evaluate(() => document.documentElement.setAttribute('data-sf-selhover', 'off'))
  const before = await read()
  await page.hover('#g2')
  H = await read()
  check('selHover off: Auswahl+Hover unverändert', H.g2.bgImage === before.g2.bgImage && H.g2.filter === 'none', H.g2.filter)
  await page.evaluate(() => document.documentElement.setAttribute('data-sf-selhover', 'soft'))
  await page.mouse.move(4, 4)

  // ── 7) Standard-Tönung: App-Standard-Fläche über dem Verlauf, beide Views ─
  await page.evaluate(() => document.documentElement.setAttribute('data-sf-seltint', 'standard'))
  P = await read()
  check('Standard-Tönung: App-Fläche @12 % als Layer', has(P.g2.bgImage, 'rgba(127, 127, 127, 0.12'), P.g2.bgImage.slice(0, 150))
  check('Standard-Tönung: Verlauf bleibt darunter sichtbar', has(P.g2.bgImage, 'linear-gradient(120deg'), '')
  check('Parität: Standard-Auswahl Liste==Grid', P.l2.bgImage === P.g2.bgImage, '')

  // ── 8) Verlauf AUS + Tönung accent: Fallback-Layer transparent, Tönung solo ─
  await page.evaluate(() => {
    const r = document.documentElement
    r.setAttribute('data-sf-seltint', 'custom')
    r.removeAttribute('data-sf-rowgrad')
    r.style.removeProperty('--sf-row-from')
    r.style.removeProperty('--sf-row-to')
    r.style.removeProperty('--sf-row-angle')
    r.style.setProperty('--sf-sel-color', '#ff00ff')
  })
  P = await read()
  check('Verlauf aus: Tönung solo (transparenter Fallback-Layer)', gradCount(P.g2.bgImage) === 2 && has(P.g2.bgImage, '0.16') && has(P.g2.bgImage, 'rgba(0, 0, 0, 0)'), P.g2.bgImage.slice(0, 160))
  check('Parität: ohne Verlauf Liste==Grid', P.l2.bgImage === P.g2.bgImage, '')

  // ── 9) Design komplett AUS: Standard-Flächen, keine Design-Reste ──────────
  await page.evaluate(() => {
    const r = document.documentElement
    for (const a of ['data-sf-rowgrad', 'data-sf-rowshadow', 'data-sf-titlegrad', 'data-sf-seltint', 'data-sf-selborder', 'data-sf-selshadow', 'data-sf-selhover', 'data-sf-rowlive']) r.removeAttribute(a)
  })
  P = await read()
  check('Design aus: Grid-Karte = App-Fläche @4 %', P.g1.bgImage === 'none' && has(P.g1.bgColor, '0.04'), `${P.g1.bgImage} / ${P.g1.bgColor}`)
  check('Design aus: Listenzeile ohne Hintergrund', P.l1.bgImage === 'none' && P.l1.bgColor === 'rgba(0, 0, 0, 0)', P.l1.bgColor)
  check('Design aus: keine Schatten/Kontur am Auswahl-Eintrag', P.g2.shadow === 'none' && has(P.g2.outline, 'none'), `${P.g2.shadow} / ${P.g2.outline}`)
} catch (error) {
  check('Testlauf ohne Exception', false, error && error.message)
}

// ── Optional: Screenshots für die Sichtprüfung ──────────────────────────────
if (process.env.SF_STYLE_SHOTS) {
  try {
    await page.evaluate(() => {
      const r = document.documentElement
      r.setAttribute('data-sf-rowgrad', 'on')
      r.setAttribute('data-sf-rowshadow', 'medium')
      r.setAttribute('data-sf-titlegrad', 'on')
      r.setAttribute('data-sf-seltint', 'accent')
      r.setAttribute('data-sf-selborder', 'on')
      r.setAttribute('data-sf-selshadow', 'medium')
      r.setAttribute('data-sf-selhover', 'soft')
      r.setAttribute('data-sf-rowlive', 'on')
      r.style.setProperty('--sf-row-from', '#7c3aedcc')
      r.style.setProperty('--sf-row-to', '#00dbdacc')
      r.style.setProperty('--sf-row-angle', '120deg')
    })
    const { mkdirSync } = await import('node:fs')
    mkdirSync(process.env.SF_STYLE_SHOTS, { recursive: true })
    await page.screenshot({ path: join(process.env.SF_STYLE_SHOTS, 'style-test-full.png'), fullPage: true })
    console.log(`ℹ  Screenshot: ${join(process.env.SF_STYLE_SHOTS, 'style-test-full.png')}`)
  } catch (error) {
    console.log(`ℹ  Screenshot übersprungen: ${error && error.message}`)
  }
}

await browser.close()
console.log(failed ? `\n=== STYLE-TEST FEHLGESCHLAGEN (${failed}) ===` : '\n=== STYLE-TEST BESTANDEN (Chromium Computed-Styles) ===')
process.exit(failed ? 1 : 0)
