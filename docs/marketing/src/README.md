# Session Flow — Marketing-Referenzbilder · Quellen

Reproduzierbare HTML-Quellen der Portfolio-Renderings. Die PNGs liegen in den
Schwesterordnern `../heroes/`, `../crops/` und `../components/`.

```
docs/marketing/
├── heroes/        # 8 Heroes, 16:9, 3200×1800
├── crops/         # 3 Social-Crops, 4:5, 2000×2500
├── components/    # 19 Komponenten-Karten, 1:1, 2000×2000
├── src/
│   ├── heroes/    # Lane A: a1–a8 HTML + base.css + assets/ + render.sh
│   └── components/# Lane B: b1–b17 HTML + showcase.css + sf-plugin.css + assets/ + render.sh
├── animation/     # 5s-Hyperframes-Animation (separater Task)
└── INVENTORY.md
```

## Re-Render

Lane A (Heroes + Crops):

```
cd docs/marketing/src/heroes
./render.sh                       # alle 8 Heroes + 3 Crops
./render.sh a4-composer-glass     # einzelnes Motiv
```

Lane B (Komponenten-Karten):

```
cd docs/marketing/src/components
./render.sh                       # alle 19 Karten
./render.sh b9-composer-chip      # einzelne Karten
```

Beide Pipelines: HTML → Playwright-Chromium headless → PNG → sRGB-Chunk.
Playwright-Browser werden aus `~/.cache/ms-playwright` genutzt
(`PLAYWRIGHT_BROWSERS_PATH` wird von `render.sh` gesetzt).

## Verbindliche Stilvorgaben

- Hintergrund-Verlauf `#141518 → #0c0d10`, radiale Akzent-Vignette, Rahmen
  `rgba(255,255,255,.10)`, Radius 16 px, Doppel-Schatten gemäß Brief §2.
- **Akzentfarbe: `#58a6ff`** in beiden Lanes (siehe `INVENTORY.md`, Abschnitt
  „Akzent-Entscheid" — entspricht dem realen Host-Akzent der Hermes-Desktop;
  `plugin.js` `data-sf-accent`-Default ist `#7c3aed`, aber `accentOn` ist
  per Default **aus**).
- UI-Texte wortgleich aus der deutschen i18n; Composer-Placeholder
  `Was kommt als Nächstes?` (echter `composer.followUpPlaceholders`-Wert).
