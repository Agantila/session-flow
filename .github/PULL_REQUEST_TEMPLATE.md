# Pull Request

## Was & warum

<!-- Kurz: was ändert dieser PR und warum? Verlinke Issues (Fixes #123). -->

## Art der Änderung

- [ ] Fix
- [ ] Feature
- [ ] Doku
- [ ] Refactor / intern

## Checkliste

- [ ] `npm run check` ist grün (Syntax + i18n-Parität)
- [ ] `npm test` ist grün (Render-Smoketest: Pane + Einstellungen)
- [ ] Neue Keys/I18n **in beiden Bundles** (EN + DE) angelegt
- [ ] Neue Optionen haben einen **Subtext** (…Desc, beide Sprachen) und stehen in `docs/SETTINGS.md`
- [ ] **CHANGELOG.md** aktualisiert (Version + Datum)
- [ ] `VERSION` in `plugin.js` und `package.json` **angleich**
- [ ] Keine hartkodierten Farben; nur Theme-Tokens
- [ ] Kein JSX, nur die drei erlaubten Imports
- [ ] Keine Backticks im CSS-Template (auch nicht in Kommentaren)
- [ ] Aufräumen via `ctx` / `ctx.onDispose` für alles Neue

## Live-Verifikation

<!--
Wie hast du getestet? (Dev-Loop mit ./install.sh --link, Log-Check,
_meta-Stempel, betroffene Einstellungs-Sektion …)
Screenshots willkommen — unter Wayland gern stattdessen Messwerte aus dem Log.
-->
