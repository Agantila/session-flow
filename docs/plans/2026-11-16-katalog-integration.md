# Feature-Linie in die Katalog-Linie überführt (Zwei-Build-Modell + Status-Loader)

- **Status**: Done
- **Erstellt**: 2026-11-16
- **Abgeschlossen**: 2026-11-16 (v1.30.0)
- **Betrifft**: `full/plugin.js` (Quelle), `desktop/plugin.js` (generierter
  Catalog-Build), `plugin.yaml`, `plugin-catalog/session-flow.yaml`,
  `scripts/build-catalog.mjs`, `tests/*`, `docs/*`, `package.json`,
  `marketplace.json`
- **Version**: 1.29.1 (Katalog-Linie) → **1.30.0**

## Anforderung

> Alles dokumentieren und committen und push damit es auch von Hermes Desktop
> Repository gepulld werden kann so das es in dem hermes plugin Marketplace
> auch geupdated wird.

## Kontext

Das Repo hatte zwei divergierende Linien:

- **`origin/main`** (veröffentlicht, im Marketplace gepinnt auf `359f9af`,
  v1.29.1): Review-R2-Layout — `full/plugin.js` als Quelle, daraus per
  `scripts/build-catalog.mjs` der SDK-only Catalog-Build `desktop/plugin.js`,
  `plugin.yaml` am Root, Disclosure-Truth.
- **Lokale Linie** (ungepusht, v1.29.0–v1.29.3): Feature-Arbeit am alten
  Root-Layout — Settings-Subtabs (v1.29.0), Session-Löschen repariert
  (v1.29.1), Authority-Umstellung auf REST (v1.29.2), Revision-Fence
  (v1.29.3) — plus der Status-Loader (v1.30.0).

Ein Push der lokalen Linie hätte den Marketplace **nicht** aktualisiert
(der Catalog lädt `desktop/plugin.js` am gepinnten SHA) und die
Full-only-Kennzeichnung (`#full`-Regionen) wäre verloren gegangen. Also:
beide Linien zu einer zusammenführen — auf der Katalog-Linie, damit der
nächste Push den Marketplace erreicht.

## Scope

1. **Merge der Feature-Linie in die Katalog-Linie** (Quelle `full/plugin.js`):
   Settings-Subtabs, Delete/Archive über REST-Fence, Status-Loader.
2. **`#full`-Marker für die neue Feature-Arbeit setzen** — die Feature-Linie
   entstand nach dem R2-Umbau und kannte die Marker nicht:
   - `deleteSessionRowViaRest` / `fetchMutationSnapshot` / `mutationIdentity`
     → `#full` (Bridge-only),
   - Bridge-Zugriff in `deleteSessionRow` und `setSessionArchivedRow` →
     `#full` mit `#catalog-only`-Fallback auf den Legacy-RPC,
   - Composer-Pill-Toggle → `#full` (wie im R2-Stand),
   - Individualisierungs-Subtabs (Akzent/Hintergrund) → `#full`; die
     Pane-Flächen-Option bleibt als flache Row in **beiden** Builds (der
     Catalog-Build bekommt dadurch keine leeren Subtabs).
3. **Build + Gates**: `scripts/build-catalog.mjs` (Catalog-Build neu bauen),
   `npm run check`, `npm test` (full **und** catalog), `npm run test:surface`,
   `npm run test:style` (Chromium).
4. **Tests build-fähig machen**: die neuen Feature-Tests galten bisher für
   beide Builds; jetzt sind sie build-abhängig (REST-Tests nur im Full-Build,
   Subtab-Erwartungen je Build, `kanbanAvailable` aus der Export-Liste
   entfernt — der R2-Stand nutzt `status.kanbanOk` statt DOM-Feature-Detect).
5. **Versionierung**: v1.29.0/v1.29.1 waren vom Katalog-Build belegt → die
   Feature-Linie wurde auf v1.29.2–v1.29.5 verschoben, der Loader ist
   v1.30.0. Der CHANGELOG nennt die Verschiebung ausdrücklich.
6. **Auslieferung**: Push auf `main`, Re-Pin in `plugin-catalog/session-flow.yaml`
   (sha + version + image/screenshots), PR im Hermes-Repo
   (`NousResearch/hermes-agent`, Datei `plugin-catalog/session-flow.yaml`).

## Nicht-Scope

- **Kein SDK-REST-Door**: das Löschen/Archivieren über REST bleibt Full-only
  (Anfrage auf hermes-agent #116305); der Catalog-Build nutzt den
  Legacy-RPC und dokumentiert dessen Sperre auf Authority-Backends.
- **Keine neue Funktionalität** außer dem Status-Loader — der Merge führt
  vorhandene Arbeit zusammen, er erweitert sie nicht.
- **Kein Marketing-Asset** wird neu erzeugt; Banner/Screenshots bleiben und
  werden nur auf den neuen SHA gepinnt.

## Umsetzung

- Merge von `c335d16` (Feature-Linie inkl. Loader) in `origin/main`:
  7 Konflikte (VERSION, Settings-Sektionen, Metadaten, CHANGELOG/ROADMAP/
  SETTINGS, Test-Export-Liste) aufgelöst — 4 davon mit Combine (Katalog-
  Marker + Feature-Struktur), 3 mit Both/Metadaten-Stand.
- Marker-Nacharbeit an der neu gemergten Feature-Arbeit (Punkt 2) — der
  Build-Strip hat die zwei Bridge-Zugriffe sofort als Regel-8-Verstoß
  gemeldet (`build-catalog.mjs` bricht ab).
- `desktop/plugin.js` neu gebaut: 10 278 Zeilen, 3 201 Full-only-Zeilen
  entfernt, keine verbotenen Muster (`surface-test` grün).

## Verifikation

- `npm run check` — Syntax + i18n-Audit (364 benutzte Keys, EN/DE) +
  Hook-Audit: grün.
- `npm test` (full **und** catalog): beide BESTANDEN; der Catalog-Build
  meldet erwartungsgemäß die fehlenden Full-only-Exporte.
- `npm run test:surface` — Catalog-Build frei von App-Markup, Bridge-Doors,
  Core-CSS-Overrides und synthetischen Events: grün.
- `node scripts/build-catalog.mjs --check` — Catalog-Build ist aktuell: grün.
- `npm run test:style` (Chromium) — Computed-Style-Asserts inkl. Loader
  (Ring-Geometrie, Spin-Dauern, Farben, Konzentrizität): grün.
