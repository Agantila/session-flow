#!/usr/bin/env python3
"""Rendert jede Karte aus src/<motiv>.html als 2000x2000-PNG (1000x1000 @2x)
nach components/sf-comp-<motiv>-1x1.png."""
import os
import pathlib
import sys
import glob

# Chromium-Speicherort: Browser liegen im Nutzer-Cache, Playwright sucht im
# profil-eigenen XDG-Cache. Pfad setzen, falls dort nichts liegt.
if 'PLAYWRIGHT_BROWSERS_PATH' not in os.environ:
    for cand in (os.path.expanduser('~/.cache/ms-playwright'),):
        if glob.glob(os.path.join(cand, 'chromium*')):
            os.environ['PLAYWRIGHT_BROWSERS_PATH'] = cand
            break

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from add_srgb import insert_srgb  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent  # = src/components/
SRC = ROOT
OUT = ROOT / '..' / '..' / 'components'
OUT.mkdir(parents=True, exist_ok=True)

rows = [l.split('\t') for l in (ROOT / 'tools' / 'manifest.tsv').read_text(encoding='utf-8').splitlines() if l]
only = set(sys.argv[1:])

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1000, 'height': 1000}, device_scale_factor=2)
    for key, hover, png in rows:
        if only and key not in only:
            continue
        page.goto((SRC / f'{key}.html').as_uri())
        page.wait_for_timeout(300)
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(150)
        if hover:
            try:
                page.hover(hover, timeout=3000)
                page.wait_for_timeout(250)
            except Exception as exc:  # noqa: BLE001
                print(f'  !! hover failed for {key}: {exc}')
        el = page.query_selector('#shot')
        box = el.bounding_box()
        target = OUT / png
        el.screenshot(path=str(target))
        srgb = insert_srgb(target)
        print(f'{png}  box={box["width"]:.0f}x{box["height"]:.0f}  {srgb}')
    browser.close()
print('done')
