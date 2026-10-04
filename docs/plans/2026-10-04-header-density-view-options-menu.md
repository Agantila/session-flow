# Kopfzeilen-Dichte, Projekt-Subzeile & Ansichtsoptionen-Icon

- **Status**: Done
- **Erstellt**: 2026-10-04
- **Abgeschlossen**: 2026-10-04
- **Betrifft**: `plugin.js` (`groups.headerDensity`, `SectionHeader`, Pane-
  Toolbar, CSS), `tests/render-test.mjs`, `docs/SETTINGS.md`, `CHANGELOG.md`,
  `package.json`, `.hermes/skills/hermes-desktop-plugins` (Lektion)
- **Version**: 1.15.0

## Anforderung

Wörtlich aus dem Auftrag:

> „Ich weiß nicht, ob meine Anforderungen nicht richtig durchkamen, aber die
> Gruppierungstoggzeile mit dem Namen und dem Indikator soll überarbeitet
> werden. Damit ich die Sessions, die innerhalb der Sektionen gruppiert
> werden, wie CLI und Desktop und Telegram und Terminal jetzt. Diese
> Gruppierungen bzw. Sektionen, die collapsible sind, sollen in der
> Typografie größer und stärker. Sie sollen, so wie bei Hermes Desktop,
> sowohl die Typen als auch Projektnamen mit Ordner als Subtext ermöglichen.
> Ich möchte die Detaildichte für dieses Collapsible mit Optionen sowie
> weitere Session für dieses Projekt hinzufügen, möchte ich erweitern. Schau
> dir die Hermes Desktop Projekt und Filteroptionen an und füge sie der
> Session Ansicht unter Session Flow hinzu und auch die Möglichkeit, das
> dort über ein Iconbutton zu toggeln, so wie es auch bei der Sessions Side
> Panel Optionen ist bei Hermes Desktop."

Anschließend, als Folgemeldung nach dem ersten Umsetzungsversuch:

> „Der Neue Icon Button mit Ansichtsoptionen funktioniert nicht und zeigt
> nicht die von Hermes Desktop verfübaren Optionen an, es kommt nichts und
> passiert nichts."

Dieser Plan deckt beide Teile ab: die ursprüngliche Feature-Umsetzung UND
den anschließend gemeldeten Bugfix (Abschnitt „Nachgebesserter Fehler"
unten).

## Kontext

Recherche im parallelen `hermes-agent`-Checkout lieferte die Vorbilder:
`app/chat/sidebar/filter-menu.tsx` (`SidebarFilterMenu` — Icon-Button
`list-filter`, Dropdown mit Gruppierung/Ordering/Show-Optionen/Filtern),
`app/chat/sidebar/chrome.tsx` (`WorkspaceHeader`/`SidebarGroupRow` —
Header-Typografie `text-[0.6875rem]`, `font-semibold`/`font-medium` je
Emphase-Stufe) und `app/chat/sidebar/projects/overview-row.tsx`
(`ProjectOverviewRow` — Projektname + Tooltip-Pfad, kein dauerhaft
sichtbarer zweiter Textzeile in Hermes selbst; unsere Umsetzung macht die
Subzeile bewusst DAUERHAFT sichtbar statt nur im Tooltip, weil „Detaildichte"
das ausdrücklich verlangt).

`$sidebarRowMeta`/`toggleSidebarRowMeta` (`store/layout.ts`) war das Vorbild
für „Kennzahlen optional je Dichte-Stufe zeigen" (dort: tokens/cost/pr/
profile; bei uns, da ohne Token/Kosten-Tracking: angepinnt/aktiv-Anzahl).

## Scope

- `groups.headerDensity: 'compact'|'comfortable'|'detailed'` (Default
  `comfortable`) — Typografie + optionale Subzeile der Gruppen-Kopfzeile.
- `SectionHeader`: Subzeile = gekürzter Ordnerpfad (Projekt-Gruppen) bzw.
  Angepinnt-/Aktiv-Kennzahl (`detailed`, alle Gruppen-Arten) — nie erfunden,
  ohne Treffer bleibt die Zeile weg.
- Ansichtsoptionen-Icon (`list-filter`) in der Pane-Toolbar: Dropdown mit
  Gruppierung, Kopfzeilen-Dichte, „Nicht gruppiert"-Toggle — gebaut
  ausschließlich aus bereits proven-sicheren SDK-Primitiven
  (`DropdownMenu`/`-Item`/`-Separator`/`-Trigger`/`-Content`, Checkmark statt
  Radio/Checkbox-Untermenüs).
- Settings-Seite: neue Zeile für `groups.headerDensity`.
- i18n EN/DE, Render-Smoketests, Doku (SETTINGS/CHANGELOG/package.json).

## Nicht-Scope (bewusst ausgeklammert)

- **Radio-/Checkbox-Untermenüs** (`DropdownMenuRadioGroup`/
  `DropdownMenuCheckboxItem`/`DropdownMenuSub*`) wie im Hermes-Vorbild —
  nicht verifiziert im Plugin-SDK verfügbar; stattdessen Checkmark-Icon-Items
  im proven-sicheren `DropdownMenuItem`-Rahmen (wie `moreRowMenu`).
- **Tokens/Kosten in der Kennzahl-Subzeile** — das Plugin trackt keine
  Token-/Kosten-Daten für Sessions; die Kennzahl-Subzeile zeigt daher nur,
  was echt vorhanden ist (angepinnt/aktiv), keine erfundenen Zahlen.
- **Vollständige Ordering/PR-/Profil-Filter-Untermenüs** aus
  `SidebarFilterMenu` — das Ansichtsoptionen-Menü bildet nur die drei
  Optionen ab, die auch unsere Settings-Seite schon hat (Gruppierung,
  Dichte, Ungrouped-Toggle); keine zusätzliche Filterlogik, die es in
  Session Flow noch nicht gibt.

## Umsetzung

Siehe `CHANGELOG.md` → `[1.15.0]` für die vollständige Liste. Kernpunkte:
`applyGroupsDensity()`/`clearGroupsDensity()` (gleiches Muster wie
`applyRows`/`applyTabSelectorMode`), `shortPath()`-Helfer, `SectionHeader`
um `density`-Prop + Subzeilen-Logik erweitert, `viewOptionsMenu` in
`SessionsPane` vor dem `toolbar`-Konstrukt gebaut und als zweites
Toolbar-Kind eingehängt.

## Nachgebesserter Fehler: Ansichtsoptionen-Button reagierte nicht

**Symptom** (Nutzer-Meldung): Klick auf den neuen Icon-Button zeigte nichts
an — kein Menü, keine Fehlermeldung.

**Ursache**: `DropdownMenuTrigger asChild` wickelte den Button in `Tip` ein
(`DropdownMenuTrigger > Tip > Button`). Radix' `asChild`/Slot-Mechanismus
kann den Ref nur EINE Ebene tief durchreichen — ein zusätzlicher
Wrapper (auch ein scheinbar transparenter wie `Tip`, der selbst intern
`asChild` nutzt) unterbricht die Kette lautlos: kein Fehler, keine Konsolen-
Warnung, der Button tut beim Klick einfach nichts. Exakt derselbe,
bereits dokumentierte Pitfall wie bei `PopoverTrigger asChild` — hier zum
ersten Mal live für `DropdownMenuTrigger` bestätigt.

**Fix**: Button ist jetzt das direkte und einzige Kind des
`DropdownMenuTrigger` (wie bei der bereits funktionierenden Zeilen-„⋯"-
Aktionsmenü `moreRowMenu`); die Tooltip-Beschriftung läuft über `title` statt
über einen `Tip`-Wrapper.

**Lektion festgehalten** in der Skill `hermes-desktop-plugins` (Pitfalls):
der Hinweis zu Radix-`asChild`-Triggern erweitert um die Bestätigung für
`DropdownMenuTrigger` plus den Symptom-Wortlaut, damit eine künftige
Fehlermeldung „der Button tut nichts" sofort hierher führt.

## Verifikation

```
$ npm run check
✓ Syntax ok (ESM)
✓ EN: alle 384 benutzten Keys vorhanden
✓ DE: alle 384 benutzten Keys vorhanden
Alles gut.

$ npm test
… (alle 72 Checks grün, inkl.) …
✓ v1.15.0: Komfortabler Projekt-Header ist zweizeilig (Subzeile)
✓ v1.15.0: Subzeile zeigt den gekürzten Projekt-Pfad — …/demo-project/app
✓ v1.15.0: Kompakt-Dichte zeigt keine Subzeile
✓ v1.15.0: Detailreich zeigt die angepinnt-Kennzahl
✓ v1.15.0: Ansichtsoptionen-Button + Menü aufgebaut (keine Crash)
✓ v1.15.0: Einstellungen enthalten groupsHeaderDensity-Zeile

=== RENDER-SMOKETEST BESTANDEN ===

$ npm run test:style
… (alle bestehenden Computed-Style-Paritätstests weiterhin grün) …
=== STYLE-TEST BESTANDEN (Chromium Computed-Styles) ===
```

Der Render-Smoketest-Stub reicht Button-Props (inkl. `aria-label`/`onClick`)
nicht durch (`pc`-Stub gibt nur `children` zurück) — er kann das
Trigger-Verhalten selbst (öffnet das Menü wirklich?) NICHT beweisen, nur dass
die Komponente ohne Crash aufgebaut wird. Die eigentliche Korrektheit des
Fixes (Button als direktes Trigger-Kind) ist durch den bekannten, bereits
live bestätigten Radix-Pitfall und den Vergleich mit der funktionierenden
`moreRowMenu` abgesichert — **manuelle Live-Prüfung in der laufenden App
bleibt empfohlen** (siehe Follow-ups).

## Follow-ups

- **Manuelle Live-Verifikation** (nächste Sitzung mit laufender App): Klick
  auf das neue Ansichtsoptionen-Icon öffnet das Menü, alle drei Optionen
  (Gruppierung/Dichte/Ungrouped) lassen sich umschalten und bleiben beim
  erneuten Öffnen offen (kein Schließen bei jeder Auswahl, wie im
  Hermes-Vorbild).
- **Radio-/Checkbox-Untermenüs nachrüsten**, falls sich
  `DropdownMenuRadioGroup`/`-CheckboxItem` im Plugin-SDK als verfügbar
  bestätigen lässt — siehe `docs/ROADMAP.md`.
