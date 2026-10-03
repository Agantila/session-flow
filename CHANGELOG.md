# Changelog

Alle nennenswerten Änderungen an diesem Plugin. Format lose angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [1.0.0] — 2026-10-03

### Added
- **Chat-Animation**: gestaffelte Zeilen-Kaskade beim Öffnen/Wechseln eines
  Chats; Zeile-für-Zeile-Reveal während des Streamens (Web Animations API,
  Index-Dedupe gegen Markdown-Re-Parse-Flackern, `prefers-reduced-motion`-safe).
  Konfigurierbar: Dauer, Versatz, max. Schritte, Bewegung, Easing-Presets,
  Thinking-/Code-/Listen-Optionen.
- **Strg+Scroll-Sessionzyklus** mit konfigurierbarer Zusatztaste, Schwelle,
  Sperrzeit, Invertierung, Umlauf und HUD-Overlay; Zoom-Flächen und
  benutzerdefinierte CSS-Selektoren werden ausgenommen.
- **Session-Tabs-Pane** mit Aktivitäts-Icons (denkt/schreibt/Tool/wartet/fertig/
  Fehler), optionalem Core-Status-Punkt, Zeit, Vorschau, Anzahl, Quellen-Badge.
- **Firefox-artige Tab-Gruppen**: Name, Farbe, Collapse mit Stapel-Optik
  (spine/fanned/pill), Drag & Drop, Kontextmenüs, optionale Auto-Gruppierung
  nach Datum/Quelle.
- **Einstellungsseite** (`/session-flow`) mit Sidebar-Eintrag, Palette-Commands
  und optionalen Keybinds.
- i18n: Englisch + Deutsch.
