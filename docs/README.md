# Docs — Index

Kurzbeschreibung aller Dokumente in diesem Ordner. Alles hier ist
entwicklerorientiert; die Nutzer-Doku steht im Root-README.

**Neu hier?** Fang bei [AGENT-GUIDE.md](AGENT-GUIDE.md) an — das ist der
Einstiegspunkt, der durch den Rest hier verlinkt.

| Datei | Kurzbeschreibung |
|---|---|
| [AGENT-GUIDE.md](AGENT-GUIDE.md) | **Einstiegspunkt** für Mensch & KI-Agent: Lesereihenfolge, Plan-Prozess (Kurzfassung), unveränderliche Regeln, Verifikations-Befehle, Git-Identität. |
| [AGENT-GUIDE-EN.md](AGENT-GUIDE-EN.md) | **English entry point** for AI agents & contributors: reading order, hard rules, data-layer/test-suite traps, parallel-session rules, git identity. Mirrors AGENT-GUIDE.md. |
| [PLANNING.md](PLANNING.md) | **Plan-Prozess im Detail**: wann ein Plan unter `plans/` angelegt wird, Lebenszyklus (Offen → In Arbeit → Done/Blockiert/Verworfen), Template-Erklärung, Pflege-Checkliste beim Abschließen. |
| [plans/](plans/) | **Einzelpläne** — ein Dokument pro nicht-trivialem Vorhaben (Anforderung im Original-Wortlaut, Scope/Nicht-Scope, Umsetzung, Verifikation, Follow-ups). `plans/TEMPLATE.md` ist die Vorlage. Das durchsuchbare Langzeitgedächtnis des Projekts — siehe PLANNING.md für Details. |
| [SETTINGS.md](SETTINGS.md) | **Optionen-Referenz**: jede Einstellung mit Key, Default und Wirkung — Sektion für Sektion (Animation, Strg+Scroll, Session-Tabs, Gruppen, UI-Tabs, Glass, Individualisierung). Bei jeder neuen Option pflegen! |
| [DEVELOPMENT.md](DEVELOPMENT.md) | **Architektur & Dev-Workflow**: Controller-Design (Animation, Wheel, Glass, UI-Tabs), Animations-Dedupe, Stores, i18n, Konventionen, Troubleshooting-Tabelle. |
| [APP-INTEGRATION.md](APP-INTEGRATION.md) | **App-Hooks & fragile Selektoren**: alle DOM-Anker, Theme-Tokens und Techniken, auf die das Plugin sich stützt (inkl. Risiko-Einschätzung) + Verifikations-Rezepte (Log-Kanal, `_meta`-Stempel, Hot-Reload). |
| [ROADMAP.md](ROADMAP.md) | **Ideen & bekannte Grenzen**: was als Nächstes ansteht und was bewusst nicht passiert. |


## Verwandte Dateien im Repo-Root

| Datei | Kurzbeschreibung |
|---|---|
| [../README.md](../README.md) | Nutzer-README (englisch, GitHub-Hauptansicht). |
| [../README.de.md](../README.de.md) | Nutzer-README (deutsch). |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Beitrags-Guide inkl. GitHub-Veröffentlichung. |
| [../CHANGELOG.md](../CHANGELOG.md) | Versionshistorie (Keep a Changelog). |
| [../SECURITY.md](../SECURITY.md) | Sicherheitsmodell & Meldewege. |
| [../scripts/check.mjs](../scripts/check.mjs) | Pre-Flight: Syntaxcheck + i18n-Key-Audit (`npm run check`). |
| [../tests/render-test.mjs](../tests/render-test.mjs) | **Render-Smoketest** (`npm test`): rendert Sessions-Pane & Einstellungsseite headless gegen SDK-Stubs — prüft UI-Verhalten (u. a. Listen-Begrenzung) ohne laufende App. |
| [../tests/style-test.mjs](../tests/style-test.mjs) | **Computed-Style-Test** (`npm run test:style`, optional): prüft die berechneten Styles am echten Chromium (Playwright) — Liste-vs-Grid-Parität, Alpha-Verläufe, Auswahl-/Hover-Stufen, Kontext-Donut (Ring + Loch), Live-Glow-Ring, Hover-Anhebung, Hintergrund-Layer. Skip ohne Playwright. |
