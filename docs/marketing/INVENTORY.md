# Session Flow — Referenzbilder · Inventarliste

**Projekt:** Session Flow (Hermes-Desktop-Plugin) · `/home/deniz/_Linux_VS_Code_Workspace/session-flow`
**Ablage:** `docs/marketing/` · **Stand:** 2026-10-06 · **Produktstand:** plugin.js v1.21.0
**Umfang:** 30 PNGs (8 Heroes 16:9 · 3 Crops 4:5 · 19 Komponenten-Karten 1:1), alle 2×-Render, sRGB.
**Grundlage:** Shotlist- & Portfolio-Layout-Brief Rev. 2 (`t_85381cf2`) + QA-Freigabeliste (`t_f8562499`).

## Ordnerstruktur

```
docs/marketing/
├── heroes/        8 × 16:9   3200×1800   (Shotlist A)
├── crops/         3 × 4:5    2000×2500   (Social-Crops A1/A4/A7)
├── components/   19 × 1:1    2000×2000   (Shotlist B)
├── animation/     5s-Hyperframes (MP4 + WebM + GIF, 1920×1080)
├── src/           HTML-Quellen (src/heroes/, src/components/, src/animation/)
└── INVENTORY.md   diese Datei
```

## Inventarliste

### heroes/ — Shotlist A, 16:9

| Datei | # | Motiv | Format |
|---|---|---|---|
| `sf-hero-a1-sessionpane-liste-16x9.png` | A1 | Session Pane, Listen-Ansicht — Gruppen, Angepinnt-Sektion, Projekt-Ordner, Suche + Segment (Alle/Aktiv/Archiv) | 16:9 · 3200×1800 |
| `sf-hero-a2-sessionpane-grid-16x9.png` | A2 | Session Pane, Grid-Ansicht — Cards mit Aktivitäts-Icon und offenem ⋯-Menü | 16:9 · 3200×1800 |
| `sf-hero-a3-chat-kaskade-16x9.png` | A3 | Chat mit eingefrorener Line-by-line-Kaskade | 16:9 · 3200×1800 |
| `sf-hero-a4-composer-glass-16x9.png` | A4 | Composer im Glass-Look — Frost, Akzent-Gradient, Projekt-Kontext-Chip am „+" | 16:9 · 3200×1800 |
| `sf-hero-a5-ctrlscroll-hud-16x9.png` | A5 | Ctrl+Scroll-HUD als Overlay (Position + Session-Titel) | 16:9 · 3200×1800 |
| `sf-hero-a6-contenttabs-16x9.png` | A6 | Content-Tabs als Sidebar-Style-Chips — ruhiger Hover/Active, arbeitende Session mit Glow-Ring | 16:9 · 3200×1800 |
| `sf-hero-a7-settings-16x9.png` | A7 | Settings „Session Flow" — sticky Kategorie-Bar, Akzent + Chat-Hintergrund | 16:9 · 3200×1800 |
| `sf-hero-a8-workspace-personal-16x9.png` | A8 | Personalisierter Workspace — eigenes Chat-Bild (Dim+Blur), Akzent in Fokusring/Send-Button | 16:9 · 3200×1800 |

### crops/ — 4:5-Social-Varianten der Heroes

| Datei | # | Motiv | Format |
|---|---|---|---|
| `sf-hero-a1-sessionpane-liste-4x5.png` | A1 | Session Pane, Listen-Ansicht (linker Ausschnitt) | 4:5 · 2000×2500 |
| `sf-hero-a4-composer-glass-4x5.png` | A4 | Composer im Glass-Look + Projekt-Chip (linker Ausschnitt) | 4:5 · 2000×2500 |
| `sf-hero-a7-settings-4x5.png` | A7 | Settings-Seite, Kategorie-Bar + Section-Köpfe (linker Ausschnitt) | 4:5 · 2000×2500 |

### components/ — Shotlist B, Komponenten-Showcase-Karten, 1:1

| Datei | # | Motiv | Format |
|---|---|---|---|
| `sf-comp-b1-navapps-1x1.png` | B1 | App-Schnellstart-Zeile — 6 Icon-Buttons, volle + schmale Breite (Wrap) | 1:1 · 2000×2000 |
| `sf-comp-b10-projekt-menue-1x1.png` | B10 | Projekt-Kontext-Menü — „Kein Projekt (Home)" + Projektliste mit Farb-Dots | 1:1 · 2000×2000 |
| `sf-comp-b11-suche-filter-1x1.png` | B11 | Suche + Quick-Filter — Suchfeld + Chips (Alle/Angepinnt/Aktiv) | 1:1 · 2000×2000 |
| `sf-comp-b12-status-icons-1x1.png` | B12 | Aktivitäts-Icon-Set — Denkt nach · Schreibt · Tool läuft · Wartet · Fertig · Fehler | 1:1 · 2000×2000 |
| `sf-comp-b13-kontext-anzeige-1x1.png` | B13 | Kontext-Fenster — 3 Donuts + 2 Bars (28×0,8 em, ohne Zahl) | 1:1 · 2000×2000 |
| `sf-comp-b14-drop-ready-1x1.png` | B14 | Drop-Ready-Puls — Sektion mit pulsierender Akzent-Umrandung (eingefroren) | 1:1 · 2000×2000 |
| `sf-comp-b15-empty-state-1x1.png` | B15 | Empty-State — leere Pane | 1:1 · 2000×2000 |
| `sf-comp-b15a-ladezustand-1x1.png` | B15a | Ladezustand — Pending-Sektion, Gate-Phase, Ladebalken | 1:1 · 2000×2000 |
| `sf-comp-b15b-filter-empty-1x1.png` | B15b | Filter-Empty — „Keine Sessions passen zu diesem Filter" | 1:1 · 2000×2000 |
| `sf-comp-b16-streaming-1x1.png` | B16 | Streaming — 2 fertige Zeilen + 1 Zeile im Schreib-Moment (Cursor) | 1:1 · 2000×2000 |
| `sf-comp-b17-glass-vergleich-1x1.png` | B17 | Glass aus vs. an — gleiche Szene, 2-up | 1:1 · 2000×2000 |
| `sf-comp-b2-pane-toolbar-1x1.png` | B2 | Pane-Toolbar — Listen-/Grid-Ansicht, „+" im Hover | 1:1 · 2000×2000 |
| `sf-comp-b3-tab-close-1x1.png` | B3 | UI-Tabs Close-Button — normal + Hover-Chip | 1:1 · 2000×2000 |
| `sf-comp-b4-session-liste-1x1.png` | B4 | Session-Zeile (Liste) — Aktivitäts-Icon, Titel, ⋯-Menü | 1:1 · 2000×2000 |
| `sf-comp-b5-session-grid-glow-1x1.png` | B5 | Session-Card (Grid) mit Glow-Ring | 1:1 · 2000×2000 |
| `sf-comp-b6-projekt-header-1x1.png` | B6 | Projekt-Header — Hover-Caret, Hover-„+", Drop-Ziel + Landing-Flash | 1:1 · 2000×2000 |
| `sf-comp-b7-gruppen-stack-1x1.png` | B7 | Gruppen-Stack — Spine / Fanned / Pill | 1:1 · 2000×2000 |
| `sf-comp-b8-pinned-empty-1x1.png` | B8 | Angepinnt (leer) — gestrichelter Drop-Platzhalter „Hier ablegen zum Anpinnen" | 1:1 · 2000×2000 |
| `sf-comp-b9-composer-chip-1x1.png` | B9 | Projekt-Kontext-Chip — kalt in der Composer-Zeile | 1:1 · 2000×2000 |

**Summe: 30 Dateien** — 8 + 3 + 19.

## Verzeichnis `docs/marketing/animation/`

| Datei | Format | Größe | Zweck |
|---|---|---|---|
| `sf-hyperframes-1920x1080-5s.mp4` | H.264/AVC, 24 fps | ~440 KB | README/Social-Hauptvideo |
| `sf-hyperframes-1920x1080-5s.webm` | VP9, 24 fps | ~150 KB | GitHub inline (klein) |
| `sf-hyperframes-1920x1080-5s.gif` | Palette, 18 fps, 960×540 | ~700 KB | Chat-Preview |
| `src/{s1-kaskade,s2-chip,s3-hud,s4-donut}.html` | 1920×1080 Stages | – | Reproduzierbare HTML-Quellen |
| `src/render_frames.mjs` | Node-Playwright | – | 30 Frames/Stufe |
| `encode.sh` | Bash | – | MP4 + WebM + GIF erzeugen |
| `frames.txt` / `seq.txt` | Concat-Listen | – | ffmpeg-Input |
| `frames/` | 120 PNGs (nicht committen) | ~150 MB | Renderer-Output |

Pipeline: HTML (CSS-Keyframes + JS-rAF) → Playwright-Chromium headless @ 1920×1080
→ 120 Frames → concat demuxer (4×1.25s) → ffmpeg x264/VP9/palette.

> Drei Stufen sind reine CSS-Keyframe-Animationen (cascade, chip-pulse, hud-sweep),
> Stufe 4 (Donut) nutzt requestAnimationFrame + stroke-dasharray für die
> prozentual gefüllten SVG-Ringe. Pro Frame wird `animation-delay` so gesetzt,
> dass die Animation exakt zum gewünschten Zeit-Offset einfriert — dadurch ist
> jedes Frame deterministisch reproduzierbar.

## QA-Nachbesserungen (aus `t_f8562499` / `freigabeliste-portfolio-renderings.md`)

| # | Punkt | Status | Umsetzung |
|---|---|---|---|
| WA-1 | Akzentfarben-Konflikt Lane A `#7c3aed` vs. Lane B `#58a6ff` | **entschieden & vereinheitlicht** | Gesamtes Set auf **`#58a6ff`** gezogen (Produkt-Realität, s. u.); Lane A (11 PNGs) neu gerendert |
| HI-1 | Lane A ohne sRGB-Chunk (11 Dateien) | **behoben** | sRGB-Chunk (perceptual) in alle Lane-A-PNGs injiziert; jetzt 30/30 mit sRGB |
| WA-2 | Composer-Placeholder zweierlei + unbelegt | **behoben** | Einheitlicher echter i18n-Wert `Was kommt als Nächstes?` in A3/A4/A6/A8 + B9/B17 |
| INFO | A6-Legendenpanel im Bild (einzigartig im Set) | **entfernt** | Für „eine Bildsprache über alle Bilder" entfernt; A6 neu gerendert |

### Akzent-Entscheid (WA-1) — Begründung

Der Brief §1 nennt „Plugin-Default-Akzent" (`plugin.js` Z. 265 `accentColor: '#7c3aed'`).
Dieser Wert ist jedoch an `personal.accentOn` gebunden, und `accentOn` ist **per Default aus**
(Z. 536) — die violette Färbung erscheint im Produkt also gar nicht. Im tatsächlich laufenden
Produkt (Hermes-Desktop) färbt der **Host-Akzent** `--ui-accent` die aktiven Zustände; die
Messung am echten Produkt-Screenshot (`Bildschirmfoto_20261006_021932.png`) liefert den blauen
Akzent (RGB 88/166/255 = `#58a6ff`). Da die Bilder die *reale* UI zeigen sollen (Marketing-Zweck,
README/Marketplace-Sichtbarkeit), wurde das gesamte Set auf **`#58a6ff`** vereinheitlicht
(Lane B war bereits so, daher nur Lane A neu gerendert). Empfehlung: Brief Rev. 3 mit dieser
Akzent-Festlegung, damit künftige Lanes nicht erneut abweichen.

### Composer-Placeholder (WA-2)

Beide Alt-Wortlaute („Nachricht an den Agent…" / „Nachricht an Hermes …") sind in `plugin.js`
unbelegt. Echter Wert aus der Desktop-i18n (`apps/desktop/src/i18n/de.ts`,
`composer.followUpPlaceholders`): **`Was kommt als Nächstes?`** — in allen betroffenen Motiven einheitlich gesetzt.

## README-Verlinkung (Block, bereit zum Einfügen)

> Hinweis: Die README-/Marketplace-Verlinkung gehört laut Task-Body des Root-Cards
> `t_63b4c535` zum Root-Task. Dieser Block ist die im Brief §5 definierte Vorlage
> (Pfade relativ `docs/marketing/…`).

```markdown
<p align="center">
  <img src="docs/marketing/heroes/sf-hero-a1-sessionpane-liste-16x9.png" alt="Session Flow — Session Pane mit Projekt-Gruppen" width="100%">
</p>
<p align="center">
  <img src="docs/marketing/heroes/sf-hero-a3-chat-kaskade-16x9.png" alt="Line-by-line-Kaskade" width="49%">
  <img src="docs/marketing/heroes/sf-hero-a4-composer-glass-16x9.png" alt="Composer im Glass-Look mit Projekt-Chip" width="49%">
</p>
<p align="center">
  <img src="docs/marketing/heroes/sf-hero-a5-ctrlscroll-hud-16x9.png" alt="Ctrl+Scroll-HUD" width="49%">
  <img src="docs/marketing/heroes/sf-hero-a7-settings-16x9.png" alt="Settings: alles einstellbar" width="49%">
</p>
<p align="center">
  <a href="docs/marketing/components/"><b>Alle 19 Komponenten-Karten ansehen →</b></a>
</p>
```

## Reproduzierbarkeit

Alle 30 PNGs sind aus `src/` 1:1 reproduzierbar (verifiziert: Re-Render pixelidentisch).
`src/heroes/./render.sh` (Heroes + Crops) · `src/components/./render.sh` (Karten).
Pipeline: HTML → Playwright-Chromium (headless) → PNG → sRGB-Chunk.
