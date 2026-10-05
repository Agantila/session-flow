// tests/style-test.mjs — Computed-Style-Test für Session Flow (optional, Playwright).
//
// VERIFIZIERT AM ECHTEN CHROMIUM, dass die Design-Optionen (Zeilen-Verlauf,
// Schatten, Titel-Verlauf, Auswahl-Zustand inkl. Hover-Stufen, Live-Status)
// in Liste UND Grid identisch wirken — inklusive:
//   • Grid-Parität: Karten übernehmen Verlauf/Tönung/Schatten (der Fix zu
//     "Grid zeigte das konfigurierte Design nicht", Spezifitäts-Bug :where()),
//   • Auswahl-Tönung als Layer ÜBER dem Zeilen-Verlauf (Verlauf bleibt sichtbar),
//   • Alpha in Verläufen (#RRGGBBAA → rgba mit Alpha),
//   • selHover-Stufen (off/soft/strong),
//   • Info-Dichte: Detail-/Vorschau-Zeile zweizeilig bei Detailreich
//     (Line-Clamp 2), einzeilig bei Komfortabel; Stats-Zeile bleibt einzeilig.
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
  '--ui-editor-surface-background:#101014',
  '--foreground:#e5e5e5'
].join(';')

const row = (id, label, extra = '') =>
  `<div class="sf-tab" id="${id}"${extra}><span class="sf-tab-lead"></span><span class="sf-tab-main"><span class="sf-tab-title">${label}</span><span class="sf-tab-preview">preview</span></span><span class="sf-tab-meta"><span class="sf-tab-ctx" data-level="warn" style="--sf-ctx-pct:56%">56%</span><span class="sf-tab-time">now</span></span></div>`

// Info-Dichte-Zeilen mit langem Text — macht den Umbruch (Line-Clamp) messbar.
// Struktur wie in der echten Pane: .sf-tab-main und die Textzeilen sind divs.
const densityRow = (id, level) =>
  `<div class="sf-tab" id="${id}" data-density="${level}"><span class="sf-tab-lead"></span><div class="sf-tab-main"><div class="sf-tab-title">Dichte ${level}</div><div class="sf-tab-details">deepseek-flash · 152 Nachrichten · 45 Tool-Aufrufe · zuletzt aktiv 11m · Branch main · Projekt Session-Flow</div><div class="sf-tab-preview">Die Einstellungen für die Info Dichte komfortabel und detailreich anpassen — ein längerer Vorschautext für den Umbruchtest.</div><div class="sf-tab-stats">Kontext 22%</div></div><span class="sf-tab-meta"><span class="sf-tab-time">now</span></span></div>`

// Komfortabel einspaltig: Meta-Zeile IM Textblock (v1.15.1).
const inlineMetaRow = id =>
  `<div class="sf-tab" id="${id}" data-density="comfortable"><span class="sf-tab-lead"></span><div class="sf-tab-main"><div class="sf-tab-title">Dichte komfortabel einspaltig</div><div class="sf-tab-details">deepseek-flash · 152 Nachrichten · zuletzt aktiv 11m</div><div class="sf-tab-meta sf-tab-meta-inline"><span class="sf-tab-time">11m</span><span class="sf-tab-ctx" data-level="ok" style="--sf-ctx-pct:22%">22%</span></div></div></div>`

// Fertig-Effekt-Zeilen (data-done-fx) für die Animations-Checks.
const fxRow = (id, label, withShine) =>
  `<div class="sf-tab" id="${id}" data-done-fx="true"><span class="sf-tab-lead"></span><div class="sf-tab-main"><div class="sf-tab-title">${label}</div></div>${withShine ? '<span class="sf-done-shine"></span>' : ''}</div>`

// Detailreich-Info-Zeile (Aktivitäts-Ticker) für die Style-Checks.
const activityRow = id =>
  `<div class="sf-tab" id="${id}" data-density="detailed"><span class="sf-tab-lead"></span><div class="sf-tab-main"><div class="sf-tab-title">Info-Zeile</div><div class="sf-tab-details">zuletzt aktiv 11m</div><div class="sf-tab-activity" data-tone="accent"><span class="sf-activity-tick"><span class="sf-activity-info sf-activity-out">Denkt nach…</span><span class="sf-activity-info sf-activity-in">Tool läuft: browser_exec</span></span></div></div></div>`

const html = `<!doctype html>
<html lang="de"
  data-sf-rowgrad="on" data-sf-rowshadow="medium" data-sf-titlegrad="on"
  data-sf-seltint="custom" data-sf-selborder="on" data-sf-selshadow="medium"
  data-sf-selhover="soft" data-sf-rowlive="on" data-sf-liveframe="glow"
  data-sf-aligntop="on" data-sf-hoverlift="on" data-sf-ctxpie="on"
  data-sf-shell="on" data-sf-shell-border="on" data-sf-shell-shadow="medium"
  data-sf-bg="on" data-sf-bg-kind="image" data-sf-bg-scope="all"
  style="--sf-row-from:#7c3aed80;--sf-row-to:#00dbda20;--sf-row-angle:120deg;--sf-sel-color:#ff00ff;--sf-title-from:#e4e4e7;--sf-title-to:#8b8b93;--sf-title-angle:90deg;--sf-shell-pad:8px;--sf-shell-radius:10px;--sf-shell-shadow:0 2px 4px rgba(0,0,0,.12), 0 10px 28px rgba(0,0,0,.13)">
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
        ${row('l5', 'Liste aktiv+ausgewählt', ' data-active="true" data-live="busy"')}
        ${fxRow('l6', 'Fertig FX')}
        ${fxRow('l7', 'Fertig Shine', true)}
        ${activityRow('l8')}
      </div>
    </div>
    <div class="sf-section">
      <div class="sf-items" data-view="grid">
        ${row('g1', 'Grid normal')}
        ${row('g2', 'Grid aktiv', ' data-active="true"')}
        ${row('g3', 'Grid busy', ' data-live="busy"')}
      </div>
    </div>
    <div class="sf-section">
      <h4 style="color:#9ca3af;font:600 11px/1 system-ui;margin:14px 4px 6px">Info-Dichte</h4>
      <div style="width:300px">
        <div class="sf-items" data-view="list">
          ${densityRow('dc', 'comfortable')}
          ${densityRow('dd', 'detailed')}
          ${inlineMetaRow('dk')}
        </div>
        <div class="sf-items" data-view="grid">
          ${densityRow('dg', 'detailed')}
        </div>
      </div>
    </div>
    <h4 style="color:#9ca3af;font:600 11px/1 system-ui;margin:14px 4px 6px">Content-Abgrenzung (entfernt)</h4>
    <div id="paneBody" style="position:relative;overflow:hidden;width:320px;height:120px">
      <div data-chat-surface id="chatSurface" style="height:60px"></div>
      <div class="sf-shell-frame" data-sf-shell-frame id="frame1"></div>
    </div>
    <div id="zoneSurface" style="background:var(--ui-editor-surface-background);height:40px;position:relative">
      <div class="sf-bg-layer" data-sf-bg-layer id="bgLayer"></div>
    </div>
  </div>
  <!-- v1.18.x: Section-Header-Icons oben ausgerichtet (statisch + zweizeilig + dreizeilig) -->
  <div class="sf-section">
    <h4 style="color:#9ca3af;font:600 11px/1 system-ui;margin:14px 4px 6px">Section-Header Icon-Ausrichtung</h4>
    <div style="width:320px">
      <div class="sf-group-head" id="gh1">
        <span class="sf-group-caret"><span style="display:inline-block;width:8px;height:8px;background:#888"></span></span>
        <span class="sf-group-lead-icon"><span style="display:inline-block;width:10px;height:10px;background:#0aa"></span></span>
        <span class="sf-group-text">
          <span class="sf-group-name">Einzeilig: nur Titel</span>
        </span>
        <span class="sf-group-actions" id="gh1-actions"><span style="display:inline-block;width:8px;height:8px;background:#0aa"></span></span>
        <span class="sf-group-count">3</span>
      </div>
      <div class="sf-group-head sf-group-twoline" id="gh2">
        <span class="sf-group-caret"><span style="display:inline-block;width:8px;height:8px;background:#888"></span></span>
        <span class="sf-group-lead-icon"><span style="display:inline-block;width:10px;height:10px;background:#0aa"></span></span>
        <span class="sf-group-text">
          <span class="sf-group-name">Zweizeilig: Titel + Pfad</span>
          <span class="sf-group-sub">…/demo-project/app</span>
        </span>
        <span class="sf-group-actions" id="gh2-actions"><span style="display:inline-block;width:8px;height:8px;background:#0aa"></span></span>
        <span class="sf-group-count">5</span>
      </div>
      <div class="sf-group-head sf-group-threeline" id="gh3">
        <span class="sf-group-caret"><span style="display:inline-block;width:8px;height:8px;background:#888"></span></span>
        <span class="sf-group-lead-icon"><span style="display:inline-block;width:10px;height:10px;background:#0aa"></span></span>
        <span class="sf-group-text">
          <span class="sf-group-name">Dreizeilig: Titel + Pfad + Stats-2</span>
          <span class="sf-group-sub">…/demo-project/app</span>
          <span class="sf-group-stats-2"><span>Letzte Änderung: 15. Sep</span><span>Ordner: 12.4 MB</span><span>Tokens: 13k / 64k · 20%</span></span>
        </span>
        <span class="sf-group-actions" id="gh3-actions"><span style="display:inline-block;width:8px;height:8px;background:#0aa"></span></span>
        <span class="sf-group-count">9</span>
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
    const ctxEl = el.querySelector('.sf-tab-ctx')
    const ccs = ctxEl ? getComputedStyle(ctxEl) : null
    const crs = ctxEl ? getComputedStyle(ctxEl, '::before') : null
    const fcs = getComputedStyle(el, '::after')
    return {
      bgImage: cs.backgroundImage,
      bgColor: cs.backgroundColor,
      shadow: cs.boxShadow,
      outline: cs.outline,
      filter: cs.filter,
      alignItems: cs.alignItems,
      transform: cs.transform,
      transition: cs.transitionProperty,
      titleImage: tcs ? tcs.backgroundImage : '',
      titleColor: tcs ? tcs.color : '',
      titleClip: tcs ? tcs.backgroundClip : '',
      ctxBg: ccs ? ccs.backgroundImage : '',
      ctxColor: ccs ? ccs.color : '',
      ctxShadow: ccs ? ccs.textShadow : '',
      ctxWidth: ccs ? ccs.width : '',
      ctxRing: crs ? crs.backgroundImage : '',
      ctxRingMask: crs ? (crs.maskImage || '') + '|' + (crs.webkitMaskImage || '') : '',
      ctxIsolation: ccs ? ccs.isolation : '',
      frameContent: fcs ? fcs.content : '',
      frameAnim: fcs ? fcs.animationName : ''
    }
  }
  const out = {}
  for (const id of ['l1','l2','l3','g1','g2','g3']) out[id] = read(id)
  // v1.18.x: Section-Header-Icons oben ausgerichtet — Computed-Styles
  // für align-items der Head + Caret/Lead-Icon, plus die vertikale
  // Position (offsetTop) relativ zum Titel. Hier wird explizit NICHT
  // über CSS-Klassen-Namen gesprochen — wir messen, was der Browser
  // tatsächlich rendert (Datenlage, nicht Spec).
  const headInfo = id => {
    const head = document.getElementById(id)
    if (!head) return null
    const cs = getComputedStyle(head)
    const caret = head.querySelector('.sf-group-caret')
    const lead = head.querySelector('.sf-group-lead-icon')
    const name = head.querySelector('.sf-group-name')
    const actions = head.querySelector('.sf-group-actions')
    // Beide offsetTop-Werte hängen am selben offsetParent — Differenzen
    // sind also direkt vergleichbar (Head-Top als Ursprung normalisieren).
    const headTop = head.offsetTop
    return {
      headAlign: cs.alignItems,
      caretAlign: caret ? getComputedStyle(caret).alignItems : '',
      caretPaddingTop: caret ? getComputedStyle(caret).paddingTop : '',
      leadAlign: lead ? getComputedStyle(lead).alignItems : '',
      leadPaddingTop: lead ? getComputedStyle(lead).paddingTop : '',
      // Wie weit liegt der Titel unter der Head-Oberkante — damit
      // können wir nachweisen, dass Icon und Titel oben bündig sind
      // und nicht mittig/zentriert zur mehrzeiligen Spalte abdriften.
      caretTop: caret ? caret.offsetTop : -1,
      leadTop: lead ? lead.offsetTop : -1,
      nameTop: name ? name.offsetTop : -1,
      headMinHeight: cs.minHeight,
      headHeight: head.offsetHeight,
      // v1.18.x: Actions-Spalte (Add/Edit/Lösen) — eigene, über die volle
      // Kopf-Höhe gestreckte Spalte mit zentriertem Icon. Zentrierung
      // heißt hier: Icon-Mitte ≈ Kopf-Mitte (Toleranz 2 px), unabhängig
      // von 1/2/3 Textzeilen.
      actionsAlign: actions ? getComputedStyle(actions).alignSelf : '',
      actionsAlignItems: actions ? getComputedStyle(actions).alignItems : '',
      actionsHeight: actions ? actions.offsetHeight : -1,
      // RELATIV zum Kopf messen (getBoundingClientRect-Differenz) —
      // offsetTop wäre relativ zum offsetParent und mit headHeight
      // nicht vergleichbar.
      actionsRelTop: actions
        ? Math.round(actions.getBoundingClientRect().top - head.getBoundingClientRect().top)
        : -1,
      actionsMinWidth: actions ? getComputedStyle(actions).minWidth : ''
    }
  }
  out.gh1 = headInfo('gh1')
  out.gh2 = headInfo('gh2')
  out.gh3 = headInfo('gh3')
  return out
})()`

const read = () => page.evaluate(probeExpr)

// Dichte-Probe: Computed Styles + Höhen der Beschreibungszeilen.
const densityProbeExpr = `(() => {
  const readPart = (rootId, partSel) => {
    const root = document.getElementById(rootId)
    const el = root ? root.querySelector(partSel) : null
    if (!el) return null
    const cs = getComputedStyle(el)
    return {
      whiteSpace: cs.whiteSpace,
      clamp: cs.webkitLineClamp || cs.lineClamp || 'none',
      display: cs.display,
      height: el.offsetHeight
    }
  }
  const mk = id => ({
    details: readPart(id, '.sf-tab-details'),
    preview: readPart(id, '.sf-tab-preview'),
    stats: readPart(id, '.sf-tab-stats')
  })
  return { dc: mk('dc'), dd: mk('dd'), dg: mk('dg') }
})()`
const readDensity = () => page.evaluate(densityProbeExpr)
// .sf-tab transitioniert transform/box-shadow/background-color (130 ms) — nach
// einem Zustandswechsel liefert getComputedStyle sonst den START-Wert der
// laufenden Transition. Vor jeder Messung kurz auslaufen lassen.
const settle = () => page.waitForTimeout(220)
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
  // ── 0) Section-Header: Caret/Lead-Icon oben bündig zum Titel ────────────
  // (Voraussetzung: kein mittiges Abdriften bei zwei-/dreizeiligen Köpfen.)
  let P = await read()
  for (const id of ['gh1', 'gh2', 'gh3']) {
    const h = P[id]
    check(
      `Section-Head ${id}: align-items=flex-start auf der Head-Row`,
      h && h.headAlign === 'flex-start',
      h ? `got=${h.headAlign}` : 'null'
    )
    check(
      `Section-Head ${id}: Caret + Lead-Icon align-items=flex-start (nicht center)`,
      h && h.caretAlign === 'flex-start' && h.leadAlign === 'flex-start',
      h ? `caret=${h.caretAlign} lead=${h.leadAlign}` : 'null'
    )
    // Caret/Lead-Icon und Titel müssen oben bündig sein — die Differenz
    // zwischen caretTop/leadTop und nameTop ist die zentrale Aussage. Bei
    // der bisherigen `align-items:center`-Variante driften Caret + Lead
    // bei gh2/gh3 sichtbar nach unten ab.
    check(
      `Section-Head ${id}: Caret oben bündig zum Titel (Δ ≤ 2 px)`,
      h && Math.abs(h.caretTop - h.nameTop) <= 2,
      h ? `Δ=${h.caretTop - h.nameTop}` : 'null'
    )
    check(
      `Section-Head ${id}: Lead-Icon oben bündig zum Titel (Δ ≤ 2 px)`,
      h && Math.abs(h.leadTop - h.nameTop) <= 2,
      h ? `Δ=${h.leadTop - h.nameTop}` : 'null'
    )
  }
  // zweizeilig + dreizeilig müssen GENAU EIG liegen (Padding-top 2 px
  // ist hier OK — d.h. leicht versetzt ist okay, solange die Differenz
  // winzig ist). Falls jemand später align-items:center einführt, würden
  // Caret + Lead bei gh2/gh3 um ~9 px nach unten rutschen — der Test
  // fängt das dann zuverlässig.
  check(
    'Section-Head: zweizeiliger/gh3-Kopf wächst in der Höhe, einzeiliger/gh1 nicht',
    P.gh2.headHeight > P.gh1.headHeight && P.gh3.headHeight > P.gh2.headHeight,
    `gh1=${P.gh1.headHeight} gh2=${P.gh2.headHeight} gh3=${P.gh3.headHeight}`
  )

  // ── 0b) Actions-Spalte (Add/Edit/Lösen): eigene Spalte, zentriert ────────
  // align-self:stretch über die Kopf-Content-Box + align-items:center →
  // das Icon sitzt vertikal in der Mitte der Kopfzeile. Die Kopf-Box hat
  // symmetrisches Padding (2px oben/unten), die Content-Mitte fällt mit
  // der Box-Mitte zusammen; messbar bleiben bis zu 1-2 px Abweichung
  // durch Rundung — die Toleranz von 3 px ist hier die richtige Marke.
  for (const id of ['gh1', 'gh2', 'gh3']) {
    const h = P[id]
    check(
      `Actions-Spalte ${id}: align-self=stretch (volle Kopf-Höhe)`,
      h && h.actionsAlign === 'stretch',
      h ? `got=${h.actionsAlign}` : 'null'
    )
    check(
      `Actions-Spalte ${id}: Icon zentriert (Δ Mitte ≤ 3 px)`,
      h && h.actionsHeight > 0 &&
        Math.abs(h.actionsRelTop + h.actionsHeight / 2 - h.headHeight / 2) <= 3,
      h ? `relTop=${h.actionsRelTop} h=${h.actionsHeight} head=${h.headHeight}` : 'null'
    )
    check(
      `Actions-Spalte ${id}: Klickfläche ≥ 20 px`,
      h && h.actionsHeight >= 20,
      h ? `h=${h.actionsHeight} minWidth=${h.actionsMinWidth}` : 'null'
    )
  }

  // ── 1) Design AN: Grid übernimmt Verlauf + Alpha (Kern-Bugfix) ────────────
  // (P wurde oben schon gelesen — wiederverwenden, keine zweite Probe.)
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

  // ── 4) Live-Status im Grid (nur Rahmen, kein Hintergrund-Eingriff) ────────
  check(
    'Live busy Grid: nur Rahmen (Hintergrund unverändert)',
    !has(P.g3.bgImage, '90deg') && has(P.g3.shadow, 'inset'),
    `${P.g3.bgImage.slice(0, 80)} | ${P.g3.shadow.slice(0, 70)}`
  )
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

  // ── 7) v1.13: App-Optik — Text oben, Hover-Anhebung, Kontext-Pie, Live-Rahmen ─
  await page.evaluate(() => {
    const r = document.documentElement
    r.setAttribute('data-sf-rowgrad', 'on')
    r.setAttribute('data-sf-seltint', 'custom')
    r.setAttribute('data-sf-selhover', 'soft')
    r.style.setProperty('--sf-row-from', '#7c3aed80')
    r.style.setProperty('--sf-row-to', '#00dbda20')
    r.style.setProperty('--sf-row-angle', '120deg')
  })
  await settle()
  P = await read()
  check(
    'Text oben: Liste=flex-start, Grid nicht zentriert (Text bereits oben)',
    P.l1.alignItems === 'flex-start' && P.g1.alignItems !== 'center',
    `list=${P.l1.alignItems} grid=${P.g1.alignItems}`
  )
  check('Kontext-Donut: Ring als ::before mit conic-gradient', has(P.g1.ctxRing, 'conic-gradient'), P.g1.ctxRing.slice(0, 80))
  check(
    'Kontext-Donut: Loch ausgespart (radiale Maske: transparent bis 50%, Ring ab 52%)',
    has(P.g1.ctxRingMask, 'radial-gradient') &&
      (has(P.g1.ctxRingMask, 'transparent') || has(P.g1.ctxRingMask, 'rgba(0, 0, 0, 0)')) &&
      has(P.g1.ctxRingMask, '50%') &&
      has(P.g1.ctxRingMask, '52%'),
    P.g1.ctxRingMask.slice(0, 140)
  )
  check('Kontext-Donut: eigener Stacking-Kontext (Ring liegt unter der Zahl)', P.g1.ctxIsolation === 'isolate', P.g1.ctxIsolation)
  check('Kontext-Donut: Wert-Fläche ohne eigenen Pie', P.g1.ctxBg === 'none', P.g1.ctxBg)
  check(
    'Kontext-Pie: mehrlagiger Text-Schatten (Kontur + Glow)',
    (P.g1.ctxShadow.match(/rgba\(/g) || []).length >= 4 && has(P.g1.ctxShadow, '1px 1px') && has(P.g1.ctxShadow, '-1px'),
    P.g1.ctxShadow
  )
  check('Kontext-Pie: Wert weiß', P.g1.ctxColor === 'rgb(255, 255, 255)', P.g1.ctxColor)
  check('Kontext-Donut: kompakte Größe (24px)', P.g1.ctxWidth === '24px', P.g1.ctxWidth)
  check('Parität: Kontext-Donut Liste==Grid', P.l1.ctxRing === P.g1.ctxRing, '')
  check('Live-Rahmen: glühender Ring am busy-Eintrag', P.g3.frameContent !== 'none' && has(P.g3.frameAnim, 'sf-arc-turn'), `${P.g3.frameContent} / ${P.g3.frameAnim}`)
  check('Live-Rahmen: kein Ring am normalen Eintrag', P.g1.frameContent === 'none', P.g1.frameContent)
  check('Hover-Anhebung: Transition auf transform', has(P.g1.transition, 'transform'), P.g1.transition)
  await page.hover('#g1')
  await settle()
  const lift = await read()
  check('Hover-Anhebung: transform beim Hover aktiv', lift.g1.transform !== 'none' && has(lift.g1.transform, 'matrix'), lift.g1.transform)
  await page.mouse.move(4, 4)

  // ── 8) Standard-Tönung: App-Standard-Fläche über dem Verlauf, beide Views ─
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
  await settle()
  P = await read()
  check('Design aus: Grid-Karte = App-Fläche @4 %', P.g1.bgImage === 'none' && has(P.g1.bgColor, '0.04'), `${P.g1.bgImage} / ${P.g1.bgColor}`)
  check('Design aus: Listenzeile ohne Hintergrund', P.l1.bgImage === 'none' && P.l1.bgColor === 'rgba(0, 0, 0, 0)', P.l1.bgColor)
  check('Design aus: keine Schatten/Kontur am Auswahl-Eintrag', P.g2.shadow === 'none' && has(P.g2.outline, 'none'), `${P.g2.shadow} / ${P.g2.outline}`)

  // ── 11) v1.13.3: Content-Abgrenzung entfernt — Attribute/Variablen bleiben inert ──
  const removedShell = await page.evaluate(() => {
    const frame = getComputedStyle(document.getElementById('frame1'))
    const surface = getComputedStyle(document.getElementById('chatSurface'))
    return {
      framePos: frame.position,
      frameZ: frame.zIndex,
      surfacePad: `${surface.paddingTop}/${surface.paddingLeft}`
    }
  })
  check(
    'Abgrenzung entfernt: .sf-shell-frame ohne Plugin-Stil (statisch, kein z-index)',
    removedShell.framePos === 'static' && removedShell.frameZ === 'auto',
    `${removedShell.framePos}/${removedShell.frameZ}`
  )
  check('Abgrenzung entfernt: Chat-Surface bekommt keinen Innenabstand', removedShell.surfacePad === '0px/0px', removedShell.surfacePad)

  // ── 12) v1.13.2: Chat-Hintergrund — Layer hinter dem Inhalt + Flächen-Override ──
  const wallpaper = await page.evaluate(() => {
    const layer = getComputedStyle(document.getElementById('bgLayer'))
    const zone = getComputedStyle(document.getElementById('zoneSurface'))
    return { z: layer.zIndex, pointer: layer.pointerEvents, zoneBg: zone.backgroundColor }
  })
  // Layer muss ÜBER der Parent-Background sitzen (sonst frisst die Chat-Surface-
  // Background in opaken Themes das Bild) und gleichzeitig UNTER den
  // Geschwister-Content-Elementen (per DOM-Ordnung: insertBefore firstChild).
  // Wir prüfen hier die statische CSS-Regel (z-index:0) — die Render-Reihen-
  // folge ist ein JS-Detail und wird im Render-Test gespiegelt.
  check('Hintergrund: Layer sitzt z-index=0 (nicht mehr -1, sonst frisst Parent-BG)', wallpaper.z === '0' && wallpaper.pointer === 'none', `${wallpaper.z}/${wallpaper.pointer}`)
  check('Hintergrund: Scope=alle macht die Zonenfläche transparent', wallpaper.zoneBg === 'rgba(0, 0, 0, 0)', wallpaper.zoneBg)
  // ── 13) Info-Dichte: Detailreich bricht Beschreibungen zweizeilig um ─────
  const D = await readDensity()
  check(
    'Dichte komfortabel: Detail-Zeile einzeilig (nowrap, kein Clamp)',
    D.dc.details && D.dc.details.whiteSpace === 'nowrap' && D.dc.details.clamp === 'none' && D.dc.details.height <= 14,
    JSON.stringify(D.dc.details)
  )
  check(
    'Dichte detailreich: Detail-Zeile zweizeilig (Line-Clamp 2, Wrap erlaubt)',
    D.dd.details && D.dd.details.whiteSpace === 'normal' && D.dd.details.clamp === '2',
    JSON.stringify(D.dd.details)
  )
  check(
    'Dichte detailreich: Detail-Zeile rendert zwei Zeilen (Höhe 28 px)',
    D.dd.details && D.dd.details.height >= 26 && D.dd.details.height <= 30 && D.dc.details.height === 14,
    `detailreich=${D.dd.details && D.dd.details.height}px komfortabel=${D.dc.details && D.dc.details.height}px`
  )
  check(
    'Dichte detailreich: Vorschau-Zeile zweizeilig (Clamp 2)',
    D.dd.preview && D.dd.preview.whiteSpace === 'normal' && D.dd.preview.clamp === '2',
    JSON.stringify(D.dd.preview)
  )
  check(
    'Dichte detailreich: Stats-Zeile bleibt einzeilig',
    D.dd.stats && D.dd.stats.whiteSpace === 'nowrap' && D.dd.stats.clamp === 'none',
    JSON.stringify(D.dd.stats)
  )
  check(
    'Dichte Grid: Detail-Zeile bei Detailreich ebenfalls zweizeilig',
    D.dg.details && D.dg.details.whiteSpace === 'normal' && D.dg.details.clamp === '2',
    JSON.stringify(D.dg.details)
  )

  // ── 14) v1.15.1: Komfortabel einspaltig — Inline-Meta unter dem Text ─────
  const IM = await page.evaluate(() => {
    const el = document.getElementById('dk')
    const meta = el.querySelector('.sf-tab-meta-inline')
    const details = el.querySelector('.sf-tab-details')
    const cs = getComputedStyle(meta)
    return {
      display: cs.display,
      marginTop: cs.marginTop,
      paddingTop: cs.paddingTop,
      below: meta.offsetTop >= details.offsetTop + details.offsetHeight,
      gap: meta.offsetTop - (details.offsetTop + details.offsetHeight)
    }
  })
  check('Dichte einspaltig: Meta-Zeile als Flex-Zeile unter dem Text', IM.display === 'flex' && IM.below, JSON.stringify(IM))
  check('Dichte einspaltig: 3 px Abstand, alignTop-Padding ausgesetzt', IM.marginTop === '3px' && IM.paddingTop === '0px', JSON.stringify(IM))

  // ── 15) v1.17.3: Live-Kennzeichnung — Rahmen (Aktive) vs. Schiene (Aktive Auswahl)
  // Frühere Sektionen entfernen die data-sf-*-Attribute des Fixtures — für
  // die Live-/Auswahl-Regeln die nötigen Flags hier explizit setzen.
  await page.evaluate(() => {
    const r = document.documentElement
    r.setAttribute('data-sf-rowgrad', 'on')
    r.setAttribute('data-sf-seltint', 'custom')
    r.setAttribute('data-sf-rowlive', 'on')
  })
  // Kurz warten: .sf-tab transitioniert box-shadow/background (130 ms) — der
  // Attribut-Wechsel oben würde sonst einen Zwischenzustand messen.
  await page.waitForTimeout(320)
  const LV = await page.evaluate(() => {
    const read = id => {
      const el = document.getElementById(id)
      const cs = window.getComputedStyle(el)
      const before = window.getComputedStyle(el, '::before')
      return {
        bg: cs.backgroundImage,
        shadow: cs.boxShadow,
        beforeContent: before.content,
        beforeWidth: before.width
      }
    }
    return { busy: read('l3'), busyGrid: read('g3'), selected: read('l2'), selBusy: read('l5'), normal: read('l1') }
  })
  const hasRail = v => v.beforeContent !== 'none' && v.beforeContent !== 'normal' && v.beforeContent !== ''
  check(
    'v1.17.3: Aktiv ohne Auswahl — nur Rahmen, Hintergrund wie normale Zeile',
    LV.busy.bg === LV.normal.bg && !LV.busy.bg.includes('90deg') && LV.busy.shadow.includes('inset'),
    `bg=${LV.busy.bg.slice(0, 80)} | shadow=${LV.busy.shadow.slice(0, 70)}`
  )
  check(
    'v1.17.3: Aktiv ohne Auswahl — keine Live-Schiene (Liste + Grid)',
    !hasRail(LV.busy) && !hasRail(LV.busyGrid),
    `busy=${LV.busy.beforeContent} grid=${LV.busyGrid.beforeContent}`
  )
  check(
    'v1.17.3: Aktive Auswahl — Live-Schiene links (::before, 3 px), Hintergrund unverändert',
    hasRail(LV.selBusy) && LV.selBusy.beforeWidth === '3px' && LV.selBusy.bg === LV.selected.bg,
    `content=${LV.selBusy.beforeContent} width=${LV.selBusy.beforeWidth}`
  )
  check(
    'v1.17.3: Auswahl ohne Aktiv — keine Live-Schiene',
    !hasRail(LV.selected),
    `content=${LV.selected.beforeContent}`
  )
  check(
    'v1.17.3: Grid-Parität — Aktiv ohne Auswahl ebenfalls nur Rahmen',
    LV.busyGrid.bg === LV.normal.bg && LV.busyGrid.shadow.includes('inset'),
    `bg=${LV.busyGrid.bg.slice(0, 80)}`
  )

  // ── 16) Fertig-Effekt: Animation, Achse, Stärke, Shine ────────────────────
  const FX = await page.evaluate(() => {
    const r = document.documentElement
    r.setAttribute('data-sf-donefx', 'glow-wobble')
    r.setAttribute('data-sf-donefx-axis', 'x')
    r.setAttribute('data-sf-donefx-strength', 'medium')
    const a1 = window.getComputedStyle(document.getElementById('l6')).animationName
    r.setAttribute('data-sf-donefx-axis', 'y')
    const a2 = window.getComputedStyle(document.getElementById('l6')).animationName
    r.setAttribute('data-sf-donefx', 'shine')
    const shineEl = document.querySelector('#l7 .sf-done-shine')
    const shineAnim = shineEl ? window.getComputedStyle(shineEl, '::before').animationName : ''
    const amp = window.getComputedStyle(r).getPropertyValue('--sf-done-amp').trim()
    r.removeAttribute('data-sf-donefx')
    r.removeAttribute('data-sf-donefx-axis')
    r.removeAttribute('data-sf-donefx-strength')
    return { a1, a2, shineAnim, amp }
  })
  check(
    'Fertig-Effekt: glow-wobble (X) → sf-done-glow + sf-done-wob-x',
    FX.a1.includes('sf-done-glow') && FX.a1.includes('sf-done-wob-x'),
    FX.a1
  )
  check(
    'Fertig-Effekt: Achse Y wechselt auf sf-done-wob-y',
    FX.a2.includes('sf-done-wob-y') && !FX.a2.includes('sf-done-wob-x'),
    FX.a2
  )
  check('Fertig-Effekt: Stärke medium → --sf-done-amp: 6deg', FX.amp === '6deg', FX.amp)
  check('Fertig-Effekt: shine animiert sf-done-sweep am Glanzstreifen', FX.shineAnim.includes('sf-done-sweep'), FX.shineAnim)

  // ── 17) Detailreich-Info-Zeile: Slide-up-Wechsel ──────────────────────────
  const AN = await page.evaluate(() => {
    const row = document.getElementById('l8')
    const act = row.querySelector('.sf-tab-activity')
    const tick = row.querySelector('.sf-activity-tick')
    const inEl = row.querySelector('.sf-activity-in')
    const outEl = row.querySelector('.sf-activity-out')
    const cs = window.getComputedStyle
    return {
      actDisplay: cs(act).display,
      tickOverflow: cs(tick).overflow,
      tickHeight: cs(tick).height,
      inAnim: cs(inEl).animationName,
      outAnim: cs(outEl).animationName,
      outPos: cs(outEl).position
    }
  })
  check('Info-Zeile: Aktivitäts-Zeile ist eine Flex-Zeile', AN.actDisplay === 'flex', JSON.stringify(AN))
  check(
    'Info-Zeile: neue Info schiebt hoch (sf-info-in)',
    AN.inAnim.includes('sf-info-in'),
    AN.inAnim
  )
  check(
    'Info-Zeile: vorherige Info schiebt nach oben raus (sf-info-out, absolut)',
    AN.outAnim.includes('sf-info-out') && AN.outPos === 'absolute',
    `${AN.outAnim} / ${AN.outPos}`
  )
  check(
    'Info-Zeile: Ticker klippt den Wechsel (overflow hidden, 14 px)',
    AN.tickOverflow === 'hidden' && AN.tickHeight === '14px',
    `${AN.tickOverflow} / ${AN.tickHeight}`
  )
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
