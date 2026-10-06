// Hero-Renderer für Session Flow (t_5611440a)
// 16:9-Hero: Viewport 1600×900, deviceScaleFactor 2 → 3200×1800 PNG.
// 4:5-Crop : echter Ausschnitt aus derselben Szene (Fokus-Selektor), 720×900 CSS-px
//            bei deviceScaleFactor 2000/720 → 2000×2500 PNG, kein Upscaling.
// Nutzung: node render_heroes.mjs [a1 a2 ...]
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/home/deniz/.cache/ms-playwright';
// dynamischer Import, damit PLAYWRIGHT_BROWSERS_PATH vor dem Laden greift
const { chromium } = await import('/home/deniz/.local/lib/python3.14/site-packages/playwright/driver/package/index.mjs');
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = ROOT;
const OUT = join(ROOT, '..', '..', 'heroes');
const CROPS = join(ROOT, '..', '..', 'crops');
mkdirSync(OUT, { recursive: true });
mkdirSync(CROPS, { recursive: true });

const MOTIVES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['a1-sessionpane-liste', 'a2-sessionpane-grid', 'a3-chat-kaskade',
     'a4-composer-glass', 'a5-ctrlscroll-hud', 'a6-contenttabs',
     'a7-settings', 'a8-workspace-personal'];

// 4:5 = linker 720-px-Ausschnitt über die volle Höhe des 16:9-Renders.
// Die Bühne ist 16:9 (1600×900) → ein Porträt-Crop zeigt bewusst nur einen
// Ausschnitt in Originalauflösung (2.78x DPI), nicht das ganze Fenster.
// Einheitliche Sprache: jede 4:5-Variante beginnt an der Fensterkante links,
// damit Fensterrahmen und Ecken als Rahmen-Anker sichtbar bleiben.
const CROP45 = new Set(['a1-sessionpane-liste', 'a4-composer-glass', 'a7-settings']);

const WIN_W = 1280;               // Fensterbreite aller Motive (CSS-px)
const STAGE_W = 1600, STAGE_H = 900;
const CROP_W = 720, CROP_H = 900; // 4:5 → 720×900 CSS-px
const CROP_SCALE = 2000 / CROP_W; // = 2.7778 → 2000×2500 px

const browser = await chromium.launch();

async function render(motiv, ratio) {
  const isCrop = ratio === '4x5';
  const page = await browser.newPage({
    viewport: { width: STAGE_W, height: STAGE_H },
    deviceScaleFactor: isCrop ? CROP_SCALE : 2,
  });
  await page.goto('file://' + join(SRC, motiv + '.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'html,body{width:100%!important;height:100%!important}' });

  let clip = { x: 0, y: 0, width: STAGE_W, height: STAGE_H };
  if (isCrop) {
    // Caption ausblenden: im Porträt-Crop gibt es keinen Platz für die
    // Beschriftungszeile (Brief §2: Beschriftung optional) → Fenster rückt
    // sauber in die Mitte der Bühne.
    await page.addStyleTag({ content: '.capwrap{display:none!important}' });
    const winLeft = (STAGE_W - WIN_W) / 2;          // 160
    clip = { x: winLeft, y: 0, width: CROP_W, height: CROP_H };
    await page.waitForTimeout(100);
  }

  const out = isCrop
    ? join(CROPS, `sf-hero-${motiv}-4x5.png`)
    : join(OUT, `sf-hero-${motiv}-16x9.png`);
  await page.screenshot({ path: out, clip });
  await page.close();
  console.log('done', out, JSON.stringify(clip));
}

for (const m of MOTIVES) {
  await render(m, '16x9');
  if (CROP45.has(m)) await render(m, '4x5');
}
await browser.close();
console.log('ALL DONE');
