# Einstellungen — Referenz

Alle Einstellungen liegen unter `hermes.plugin.session-flow.settings.v1` (ctx.storage)
und sind live: Änderungen greifen sofort. Erreichbar über die Seite
`/session-flow` (Sidebar „Session Flow" oder ⌘K → „Session Flow: Einstellungen").

## Chat-Animation

| Key | Default | Wirkung |
|---|---|---|
| `animation.enabled` | `true` | Master-Schalter. Aus = keine Zeilen-Animationen. |
| `animation.historyCascade` | `true` | Beim Öffnen/Wechseln eines Chats laufen die sichtbaren Zeilen als Kaskade (oben → unten) ein. |
| `animation.streamReveal` | `true` | Während des Streamens blendet jede Zeile einmal ein, sobald sie fertig ist (Zeile N-1 animiert, wenn Zeile N erscheint; die letzte beim Stream-Ende). |
| `animation.durationMs` | `320` | Dauer einer einzelnen Zeilen-Animation. |
| `animation.staggerMs` | `55` | Verzögerung zwischen aufeinanderfolgenden Zeilen. |
| `animation.maxStaggerSteps` | `24` | Deckel für die Staffelung (Gesamtlaufzeit) bei langen Antworten. |
| `animation.travelPx` | `10` | Vertikale Bewegung der Zeile in px. 0 = reines Fade. |
| `animation.easing` | `soft` | `smooth` (Expo), `soft` (weich), `gentle` (ruhig), `back` (leicht federnd). |
| `animation.skipReasoning` | `true` | Thinking-/Reasoning-Blöcke nicht animieren. |
| `animation.includeCode` | `true` | Code-Blöcke als Zeilen animieren. |
| `animation.includeLists` | `true` | Listenpunkte (`<li>`) einzeln animieren statt die Liste als Ganzes. |

Hinweis: `prefers-reduced-motion: reduce` (Betriebssystem) deaktiviert alle
Animationen unabhängig von diesen Schaltern.

## Strg+Scroll (Session-Zyklus)

| Key | Default | Wirkung |
|---|---|---|
| `wheel.enabled` | `true` | Master-Schalter. |
| `wheel.modifier` | `ctrl` | `ctrl`, `alt`, `ctrl+shift`, `meta`. |
| `wheel.threshold` | `40` | Nötige Mausrad-Delta bis ein Wechsel ausgelöst wird. |
| `wheel.cooldownMs` | `200` | Mindestabstand zwischen zwei Wechseln. |
| `wheel.invert` | `false` | Richtung umkehren. |
| `wheel.wrap` | `true` | Am Listenende umlaufen. |
| `wheel.hud` | `true` | HUD-Overlay mit Position/Titel anzeigen. |
| `wheel.hudMs` | `1100` | Anzeigedauer des HUD. |
| `wheel.ignoreSelector` | `''` | Zusätzliche CSS-Selektoren (kommasepariert), in denen Strg+Scroll nicht greift. Basis-Liste ist immer aktiv: `canvas`, `.monaco-editor`, Bild-Zoom (`aui_zoomable-image`). |

## Session-Tabs

| Key | Default | Wirkung |
|---|---|---|
| `tabs.density` | `compact` | `compact` (einzeilig) oder `cozy` (mit Vorschau-Zeile). |
| `tabs.statusStyle` | `glyph` | `glyph` (Aktivitäts-Icon), `dot` (Core-Status-Punkt), `glyph+dot`. |
| `tabs.showTime` | `true` | Alter der Session anzeigen. |
| `tabs.showPreview` | `false` | Letzte Nachricht als Vorschau (cozy-Dichte). |
| `tabs.showCounts` | `false` | Nachrichtenanzahl anzeigen. |
| `tabs.showSource` | `true` | Quellen-Badge (Telegram, Discord, Cron …). |
| `tabs.openIntent` | `in-place` | `in-place` (ersetzen), `stack` (neben dran), `tab`. |
| `tabs.maxItems` | `60` | Maximal geladene Sessions. |
| `tabs.hideCron` | `true` | Cron-Sessions ausblenden. |
| `tabs.livePollSec` | `30` | Intervall der Live-Status-Abfrage (`session.active_list`). Min. 10s. |
| `tabs.refreshSec` | `45` | Intervall des Listen-Refresh (`session.list`). Min. 15s. |

## Tab-Gruppen

| Key | Default | Wirkung |
|---|---|---|
| `groups.enabled` | `true` | Manuelle Gruppen aktiv. |
| `groups.autoMode` | `off` | `off`, `date` (Heute/Gestern/Woche/Älter) oder `source`. |
| `groups.stackStyle` | `spine` | Optik eingeklappter Gruppen: `spine`, `fanned`, `pill`. |
| `groups.showUngrouped` | `true` | „Nicht gruppiert"-Bereich zeigen, wenn Auto-Modus aus ist. |

Gruppen-Daten (Name, Farbe, Zuordnung, Collapse-Zustand) liegen separat unter
`hermes.plugin.session-flow.groups.v1`.

## Gruppe vs. Session-Farbe

- **Gruppenfarbe**: eigener Swatch-Picker im Gruppen-Dialog (Rechtsklick auf
  die Gruppen-Überschrift).
- **Session-Farbe**: Rechtsklick auf einen Tab → „Session-Farbe". Diese Farbe
  setzt `host.sessions.setColor` und erscheint damit auch auf der
  Core-Sidebar-Zeile (gleiche Quelle).
