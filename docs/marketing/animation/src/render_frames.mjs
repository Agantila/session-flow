#!/usr/bin/env node
// Hyperframes-Renderer: 4 Stufen × 30 Frames @ 24fps = 120 PNGs (1920x1080)
// Nutzt CSS-Keyframes + JS-Animations in den HTML-Stages; Playwright pausiert den
// Zeit-Offset pro Frame, damit jedes Frame deterministisch eingefroren wird.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/home/deniz/.cache/ms-playwright';
const { chromium } = await import('/home/deniz/.local/lib/python3.14/site-packages/playwright/driver/package/index.mjs');
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = ROOT;
const OUT = join(ROOT, '..', 'frames');
mkdirSync(OUT, { recursive: true });

const STAGES = ['s1-kaskade', 's2-chip', 's3-hud', 's4-donut'];
const FPS = 24;
const DUR_MS = 1250;             // 1.25 s pro Stufe
const FRAMES = Math.round(FPS * DUR_MS / 1000); // 30
const W = 1920, H = 1080;
const LOOP = false;              // wir rendern NICHT loopend, sondern linear

const browser = await chromium.launch();
let total = 0;
for (const stage of STAGES) {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });
  await page.goto('file://' + join(SRC, stage + '.html'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // kurze Stabilisierung (CSS-Keyframes starten bei load, JS tickt ab t0)
  await page.waitForTimeout(50);

  for (let f = 0; f < FRAMES; f++) {
    const ms = (f / FRAMES) * DUR_MS;          // momentaner Zeit-Offset in der Stufe
    // CSS-Keyframes reagieren auf wall-clock, deshalb setzen wir die Animation-Startzeit
    // zurück und warten die exakte Millisekunden-Pause ab, bevor wir screenshooten.
    await page.evaluate((offsetMs) => {
      // Finde alle Elemente mit Animationen und setze animation-delay so,
      // dass die Animation 'jetzt' bei offsetMs ist. animation-play-state bleibt running.
      const all = document.querySelectorAll('*');
      all.forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.animationName && cs.animationName !== 'none') {
          el.style.animationDelay = (-offsetMs) + 'ms';
        }
      });
      // Skripte wie s4-donut rufen requestAnimationFrame mit performance.now() auf;
      // ueberschreiben wir performance.now() temporaer, damit die JS-Animation
      // beim gewuenschten Offset einfriert.
      const origNow = performance.now.bind(performance);
      const offset = offsetMs;
      performance.now = () => origNow() - offset + 0;
    }, ms);
    await page.waitForTimeout(20);              // Frame stabilisieren
    const out = join(OUT, `${stage}-${String(f).padStart(3, '0')}.png`);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
    total++;
    if (f % 6 === 0) console.log(`  ${stage} frame ${f + 1}/${FRAMES}`);
  }
  await page.close();
  console.log(`OK ${stage} (${FRAMES} frames)`);
}
await browser.close();
console.log(`ALL DONE: ${total} frames in ${OUT}`);
