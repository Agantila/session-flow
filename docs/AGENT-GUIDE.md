# Agent-/Contributor-Guide — Einstiegspunkt für Weiterentwicklung

Diese Datei ist der **erste Stopp** für jeden — Mensch oder KI-Agent — der an
`session-flow` arbeitet. Sie bündelt, wo Wissen liegt, wie ein Vorhaben
geplant/dokumentiert wird, und welche Regeln das Plugin lauffähig halten.
Details leben in den verlinkten Dateien; hier steht nur die **Reihenfolge**.

## 0. Was ist das hier?

Ein Hermes-Desktop-Plugin (`full/plugin.js`, ein Quellfile, kein Build;
Catalog-Build generiert nach `desktop/plugin.js`) mit sechs
Bereichen: Chat-Animation, Strg+Scroll-Zyklus, Session-Pane (Liste/Grid +
Gruppen + Filter), Glass/Lesbarkeit, UI-Tabs, Individualisierung. Siehe
`../README.md` für die Nutzer-Perspektive.

## 1. Lies zuerst (in dieser Reihenfolge)

| Schritt | Datei | Warum |
|---|---|---|
| 1 | `README.md` (dieser Ordner) | Index aller Doku-Dateien — kurzer Überblick, wo was steht. |
| 2 | `DEVELOPMENT.md` | Architektur, Datei-Layout von `full/plugin.js`, Konventionen, Troubleshooting. |
| 3 | `APP-INTEGRATION.md` | Jeder DOM-Anker/Theme-Token, auf den das Plugin sich stützt, inkl. Risiko. **Bei App-Updates zuerst hier.** |
| 4 | `SETTINGS.md` | Jede Einstellung: Key, Default, Wirkung. |
| 5 | `ROADMAP.md` | Was zuletzt umgesetzt wurde, was geplant ist, was bewusst nicht passiert, bekannte Grenzen. |
| 6 | `PLANNING.md` | **Der Plan-Prozess selbst** (dieses Dokument beschreibt NUR die Reihenfolge — PLANNING.md ist die Anleitung). |

Wenn du Claude Code / Cursor / einen anderen Agenten bist und eine
`hermes-desktop-plugins`-Skill verfügbar ist: lade sie zusätzlich — sie
enthält plattformweite Lektionen (App-Verhalten, Electron-Fallstricke), die
über dieses eine Repo hinausgehen. Was hier steht, ist projektspezifisch und
gewinnt im Konfliktfall (dieses Repo ist die Quelle der Wahrheit für sich
selbst).

## 2. Der Plan-Prozess (Kurzfassung — Details in `PLANNING.md`)

Für **jedes nicht-triviale Vorhaben** (neues Feature, Verhaltensänderung,
größerer Umbau — nicht für Typos oder Ein-Zeilen-Fixes):

1. **Vor der Umsetzung**: Plan-Datei unter `plans/<YYYY-MM-DD>-<slug>.md`
   anlegen (Kopie von `plans/TEMPLATE.md`). Status `In Arbeit`.
2. **Während der Umsetzung**: Code ändern, `npm run check` + `npm test` nach
   jedem sinnvollen Zwischenschritt laufen lassen (nicht erst am Ende).
3. **Nach der Umsetzung**:
   - Plan auf Status `Done` setzen, Verifikations-Belege eintragen
     (Testausgabe, manuell geprüfte Punkte).
   - `../CHANGELOG.md` → neuer Eintrag unter der aktuellen (oder einer neuen)
     Version, mit Link/Verweis auf den Plan.
   - `SETTINGS.md` → neue/geänderte Optionen eintragen.
   - `ROADMAP.md` → „Zuletzt umgesetzt" ergänzen; betroffene
     „Geplant/Ideen"- oder „Bekannte Grenzen"-Einträge anpassen/entfernen.
   - `APP-INTEGRATION.md` → neue DOM-Anker/Doors eintragen, falls das
     Vorhaben neue App-Hooks angefasst hat.
   - `../package.json` + `VERSION`-Konstante in `../full/plugin.js` synchron
      halten.
4. **Nie ohne Plan-Datei ausliefern**, wenn das Vorhaben mehr als eine
   Sitzung/einen Kontext braucht — die Plan-Datei IST das Gedächtnis für die
   nächste Sitzung (eigene oder eines anderen Agenten), nicht nur eine
   Formalität. Ein halb erledigtes Vorhaben bekommt Status `Blockiert`/`Offen`
   mit einer kurzen Begründung, nie stillschweigend liegen gelassen.

`plans/` ist damit das **durchsuchbare Langzeitgedächtnis** des Projekts:
„Warum ist X so gebaut?" lässt sich dort nachlesen, statt aus Commit-Diffs
rekonstruiert zu werden.

## 3. Unveränderliche Regeln (sonst lädt das Plugin nicht)

Kurzfassung — volle Liste in `DEVELOPMENT.md` → „Konventionen":

- Kein JSX, kein Build. Nur `@hermes/plugin-sdk`, `react`, `react/jsx-runtime`
  importieren.
- Keine hartkodierten Farben — nur `var(--ui-*)`/`var(--chrome-*)`.
- Keine Backticks im CSS-Template-Literal (auch nicht in Kommentaren).
- Neue i18n-Keys immer in **beiden** Bundles (`EN`/`DE`) — `npm run check`
  schlägt sonst an.
- Vor jedem Commit: `npm run check && npm test` grün.

## 4. Verifikation vor „Done"

| Befehl | Prüft |
|---|---|
| `npm run check` | Syntax (Node `--check`) + i18n-Key-Parität EN/DE. |
| `npm test` | Render-Smoketest: Pane + Einstellungsseite komplett gegen SDK-Stubs (kein App-Start nötig). |
| `npm run test:style` | Optional: berechnete Styles am echten Chromium (Playwright) — nur für Design-CSS-Änderungen Pflicht. |

Ein Plan gilt erst als `Done`, wenn alle drei (bzw. die relevanten) grün sind
und das in der Plan-Datei vermerkt ist.

## 5. Git

Commits in diesem Repo tragen die Identität
`Deniz <dezooyi@users.noreply.github.com>`:

```bash
git -c user.name="Deniz" -c user.email="dezooyi@users.noreply.github.com" commit -m "…"
```

Siehe `../CONTRIBUTING.md` für PR-/Release-Ablauf.
