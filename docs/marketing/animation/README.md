# Animation

Die 5-Sekunden-**Hyperframes-Animation** zeigt in einem einzigen Loop die
vier wichtigsten visuellen Effekte, die das neue UI prägen:

| # | Stufe | Effekt |
|---|---|---|
| 1 | `s1-kaskade` | Line-by-line-Kaskade: User-Frage → 3 Assistant-Zeilen faden weich ein (Opacity 0→1, TranslateY 14→0, gestaffelt) |
| 2 | `s2-chip` | Projekt-Chip im Composer pulst rein (scale 0.85→1.06→1), Glass-Overlay atmet ein, Glow-Ring fadet hoch |
| 3 | `s3-hud` | Strg+Scroll-HUD fadet von unten ein, Scroll-Thumb fährt von Position 1 → 5 (Index tickt 3/12 → 4/12 → 5/12) |
| 4 | `s4-donut` | Kontext-Donut (3 Stufen) und Bar wachsen synchron von 0 % → 42 % / 78 % / 93 % per SVG-stroke-dasharray + JS-easing (cubic-out) |

## Deliverables

| Datei | Format | Größe | Zweck |
|---|---|---|---|
| `sf-hyperframes-1920x1080-5s.mp4` | H.264/AVC, 24 fps, 5.000 s | ~440 KB | Social, README-Hauptvideo |
| `sf-hyperframes-1920x1080-5s.webm` | VP9, 24 fps, 5.000 s | ~150 KB | GitHub inline (klein) |
| `sf-hyperframes-1920x1080-5s.gif` | Palette, 18 fps, 960×540 | ~700 KB | Chat-Preview, überall abspielbar |

Gesamt: 120 deterministische Frames bei 1920×1080, sRGB, 2×-Render,
lossless MP4-Encode (CRF 18).

## Quelle & Re-Render

```
docs/marketing/animation/
├── src/                       # 4 Master-Stages + Renderer
│   ├── s1-kaskade.html        # 1920×1080, CSS-Keyframes für 3 Zeilen
│   ├── s2-chip.html           # 1920×1080, CSS für Chip-Pulse + Glass
│   ├── s3-hud.html            # 1920×1080, CSS für HUD + Sweep + Index-Tick
│   ├── s4-donut.html          # 1920×1080, JS rAF für Donut-Grow
│   └── render_frames.mjs      # Playwright-Renderer, 30 Frames/Stufe
├── frames/                    # 120 Roh-Frames (nicht committen)
├── frames.txt                 # Concat-Liste (per-Frame, 1/24s)
├── seq.txt                    # Concat-Liste (pro Stufe, 1.25s)
├── encode.sh                  # MP4 + WebM + GIF erzeugen
└── sf-hyperframes-*.{mp4,webm,gif}   # ← Lieferung
```

```bash
# 1) Frames neu rendern (120 PNGs, ~3 min)
cd docs/marketing/animation/src
PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright node render_frames.mjs

# 2) In MP4/WebM/GIF kodieren (~10 s)
cd docs/marketing/animation
./encode.sh
```

## Warum diese Pipeline?

- **Deterministisch**: Pro Frame wird `animation-delay` so gesetzt, dass die
  CSS-Keyframe-Animation *exakt* zum gewünschten Zeit-Offset eingefroren ist
  (override über alle Elemente). JS-gesteuerte Animationen (s4) bekommen einen
  überschriebenen `performance.now()`. Dadurch ist jedes Frame reproduzierbar
  und der Re-Render ist pixelidentisch.
- **sRGB + 2×**: identische Render-Pipeline wie die statischen Hero-PNGs in
  `../heroes/` (Playwright-Chromium headless, sRGB-Chunk, 1920×1080).
- **Drei Formate**: MP4 für die meisten Use-Cases, WebM für GitHub-inline
  (klein), GIF für Chat-Vorschauen und Plattformen ohne Video-Embed.
