# Sicherheit

## Kontext

Session Flow ist ein **Hermes-Desktop-Plugin**. Plugins laufen im Renderer der
App **ungesandboxed** — sie teilen sich Prozess und DOM mit der Oberfläche.
Das Plugin hält sich bewusst an die engen Vorgaben des Plugin-SDK:

- Nur drei Imports: `@hermes/plugin-sdk`, `react`, `react/jsx-runtime`.
- Kein Netzwerkzugriff, kein Dateisystemzugriff, keine externen Ressourcen.
- Zugriff auf App-Daten ausschließlich über die dokumentierten SDK-/Gateway-
  Schnittstellen (`ctx.storage`, `session.list`-RPC, Gateway-Events).
- Keine Telemetrie, kein Tracking; alle Einstellungen liegen lokal
  (`hermes.plugin.session-flow.settings.v1`).

## Was das Plugin mit dem DOM macht

Das Plugin injiziert ein `<style>`-Tag, setzt Marker-Attribute
(`data-sf-*`) auf `<html>` und auf Tab-Elementen sowie CSS-Variablen.
Es liest App-Zustand nur lesend; es schreibt keine App-Daten.

## Meldung von Sicherheitsproblemen

Bitte **nicht** öffentlich als Issue mit Ausnutzungsdetails posten. Nutze
stattdessen:

- GitHub → **Security → Report a vulnerability** (privater Kanal), oder
- eine kurze Issue ohne Reproduktionsschritte mit der Bitte um Kontakt.

Bitte angeben:

- Betroffene Version (`plugin.js` → `VERSION` oder Einstellungen → Über),
- Hermes-Desktop-Version,
- Beschreibung + Minimal-Reproduktion, falls möglich.

## Unterstützte Versionen

Nur die jeweils **aktuelle Minor-Version** (siehe `CHANGELOG.md`) wird mit
Sicherheitsfixes versorgt. Fixes erscheinen als Patch-Release.
