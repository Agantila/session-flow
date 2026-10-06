#!/usr/bin/env python3
"""Baut die 19 Komponenten-Showcase-Karten (Shotlist B) als eigenstaendige
HTML-Quellen unter src/.  Jede Datei ist fuer sich reproduzierbar:
  src/<motiv>.html  +  src/showcase.css  +  src/sf-plugin.css  +  src/assets/*
"""
import html
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent  # = src/components/
SRC = ROOT
SRC.mkdir(parents=True, exist_ok=True)

HEAD = """<!doctype html>
<html lang="de"{attrs}>
<head>
<meta charset="utf-8">
<title>{title}</title>
<link rel="stylesheet" href="assets/codicon.css">
<link rel="stylesheet" href="sf-plugin.css">
<link rel="stylesheet" href="showcase.css">
</head>
<body class="card-body">
<div class="card" id="shot">
  <div class="stage">
    <div class="motif{motifcls}" style="{motifstyle}">
{body}
    </div>
  </div>
  <div class="note">{note}</div>
</div>
</body>
</html>
"""


def ic(name, cls='', style=''):
    c = ('codicon codicon-' + name + (' ' + cls if cls else '')).strip()
    s = f' style="{style}"' if style else ''
    return f'<i class="{c}"{s}></i>'


def chip(name='session-flow', color='var(--ui-accent)'):
    return (
        '<div class="sf-cproj-row">'
        '<button type="button" class="sf-cproj-pill">'
        f'<span class="sf-cproj-dot" style="--sf-cproj-color:{color}"></span>'
        f'<span class="sf-cproj-name">{name}</span>'
        '<span class="sf-cproj-caret" aria-hidden="true">&#9662;</span>'
        '</button></div>'
    )


def navapps(width, extra=''):
    btns = [
        ('new-session', 'robot', None, 'Neue Session'),
        ('capabilities', 'symbol-misc', None, 'F\u00e4higkeiten'),
        ('messaging', 'comment', None, 'Messaging'),
        ('artifacts', 'files', None, 'Artefakte'),
        ('cron', 'watch', 'ok', 'Geplante Jobs \u00b7 2 aktiv'),
        ('kanban', 'project', 'warn', 'Kanban \u00b7 3 offen'),
    ]
    parts = []
    for nav, icon, status, title in btns:
        st = f' data-status="{status}"' if status else ''
        parts.append(
            f'<button type="button" class="sf-navapps-btn" data-nav="{nav}"{st} '
            f'title="{title}">{ic(icon, style="font-size:15px")}</button>'
        )
    return (f'<div class="sf-navapps" style="width:{width}px"{extra}>'
            + ''.join(parts) + '<span class="sf-navapps-rule"></span></div>')


def toolbar(view='list', add_hover=False):
    switch = 'list-unordered' if view == 'grid' else 'layout'
    ah = ' data-nav="add"' if add_hover else ''
    items = [
        ('list-filter', 'Ansichtsoptionen', ''),
        ('folder-library', 'Neues Projekt', ''),
        ('add', 'Neue Session', ah),
        ('layers', 'Neue Gruppe\u2026', ''),
        ('refresh', 'Aktualisieren', ''),
        ('settings-gear', 'Plugin-Einstellungen', ''),
    ]
    out = [f'<span class="sf-toolbar-count">60 Sessions</span>',
           f'<button type="button" class="iconbtn" title="Ansicht wechseln (Liste/Grid)">'
           f'{ic(switch, style="font-size:14px")}</button>']
    for icon, title, extra in items:
        out.append(f'<button type="button" class="iconbtn" title="{title}"{extra}>'
                   f'{ic(icon, style="font-size:14px")}</button>')
    return '<div class="sf-toolbar">' + ''.join(out) + '</div>'


def grp_head(name, sub=None, count='0', lead='folder', color=None,
             drop=False, cls_extra='', caret=True):
    caret_html = (f'<span class="sf-group-caret">{ic("chevron-down", style="font-size:12px")}</span>'
                  if caret else '')
    if lead == 'dot':
        lead_html = f'<span class="sf-group-dot" style="background:{color}"></span>'
    else:
        lead_html = (f'<span class="sf-group-lead-icon">'
                     f'{ic(lead, style=f"font-size:13px;{"color:" + color if color else ""}")}</span>')
    sub_html = f'<span class="sf-group-sub">{sub}</span>' if sub else ''
    two = ' sf-group-twoline' if sub else ''
    return (
        f'<div class="sf-group-head sf-group-project{two}{cls_extra}"'
        f'{" data-drop=\"true\"" if drop else ""}>'
        + caret_html + lead_html +
        f'<span class="sf-group-text"><span class="sf-group-name">{name}</span>{sub_html}</span>'
        '<span class="sf-group-actions" title="Neue Session in diesem Projekt">'
        + ic('add', style='font-size:14px') + '</span>'
        f'<span class="sf-group-count">{count}</span></div>'
    )


def tab_row(kind, icon, title, details, count, age, active=False, live='idle',
            extra_meta='', spinning=False, just_moved=False):
    lead_cls = ' sf-icon-spin' if spinning else ''
    jm = ' data-just-moved="true"' if just_moved else ''
    return (
        f'<div class="sf-tab" data-active="{"true" if active else "false"}" data-live="{live}" '
        f'data-density="comfortable"{jm}>'
        f'<span class="sf-tab-lead" data-kind="{kind}">'
        f'{ic(icon, cls=lead_cls, style="font-size:13px")}</span>'
        '<div class="sf-tab-main">'
        f'<div class="sf-tab-title">{title}</div>'
        f'<div class="sf-tab-details">{details}</div>'
        '</div>'
        '<div class="sf-tab-meta">'
        f'<span class="sf-tab-count">{count}</span>'
        f'<span class="sf-tab-time">{age}</span>{extra_meta}'
        '</div>'
        f'<button type="button" class="sf-more" aria-label="Mehr Optionen">'
        f'{ic("ellipsis", style="font-size:14px")}</button>'
        '</div>'
    )


def seg(active='Alle'):
    out = []
    for label in ('Alle', 'Aktiv', 'Archiv'):
        a = 'true' if label == active else 'false'
        out.append(f'<button type="button" data-active="{a}">{label}</button>')
    return '<div class="seg-track" role="radiogroup">' + ''.join(out) + '</div>'


def searchbar(value='', placeholder='Sessions durchsuchen\u2026', clear=True):
    val = f' value="{html.escape(value)}"' if value else ''
    x = (f'<button type="button" class="sf-filter-clear" aria-label="Suche l\u00f6schen">'
         f'{ic("close", style="font-size:11px")}</button>') if clear else ''
    return ('<div class="sf-filter-search">'
            + ic('search', style='font-size:12px')
            + f'<input type="text" placeholder="{placeholder}"{val} readonly>'
            + x + '</div>')


# ---------------------------------------------------------------- card bodies
C = {}

C['b1-navapps'] = dict(
    note='App-Schnellstart-Zeile \u2014 6 Icon-Buttons mit Wrap-Verhalten',
    motifstyle='--w:470px;--z:1.6;--r:10px',
    body='''      <div style="padding:14px 16px;display:flex;flex-direction:column;gap:18px">
        <div>
          <div class="sf-subhead" style="margin:0 0 7px">Volle Breite</div>
          ''' + navapps(430, ' data-wide="1"') + '''
        </div>
        <div>
          <div class="sf-subhead" style="margin:0 0 7px">Schmale Breite \u2014 umflie\u00dfend</div>
          ''' + navapps(112) + '''
        </div>
      </div>''',
    hover='.sf-navapps[data-wide] .sf-navapps-btn[data-nav="capabilities"]',
)

C['b2-pane-toolbar'] = dict(
    note='Pane-Toolbar \u2014 Ansicht, Filter-Optionen, Projekt, Session, Gruppe, Refresh, Einstellungen',
    motifstyle='--w:600px;--z:1.25;--r:10px',
    body='''      <div style="padding:18px 20px;display:flex;flex-direction:column;gap:22px">
        <div>
          <div class="sf-subhead" style="margin:0 0 8px">Listen-Ansicht</div>
          ''' + toolbar('list') + '''
        </div>
        <div>
          <div class="sf-subhead" style="margin:0 0 8px">Grid-Ansicht \u00b7 Neue Session im Hover</div>
          ''' + toolbar('grid', add_hover=True) + '''
        </div>
      </div>''',
    hover='.sf-toolbar .iconbtn[data-nav="add"]',
)

C['b3-tab-close'] = dict(
    note='UI-Tabs \u2014 Close-Button normal und im Hover-Zustand',
    attrs=' data-sf-ui-tabs="on active-sidebar close-always"',
    motifstyle='--w:440px;--z:1.7;--r:10px',
    body='''      <div class="uitab-row">
        <div class="uitab" data-sf-ui-tab="true" data-closeable>
          <span class="pane-tab-content"><span class="truncate">Chat</span></span>
          <span class="inset-y-0"><button type="button" title="Tab schlie\u00dfen">'''
        + ic('close', style='font-size:12px') + '''</button></span>
        </div>
        <div class="uitab" data-sf-ui-tab="true" data-closeable>
          <span class="pane-tab-content"><span class="truncate">Kanban</span></span>
          <span class="inset-y-0"><button type="button" title="Tab schlie\u00dfen" data-hov="1">'''
        + ic('close', style='font-size:12px') + '''</button></span>
        </div>
      </div>''',
    hover='.uitab .inset-y-0 button[data-hov="1"]',
)

C['b4-session-liste'] = dict(
    note='Session-Liste \u2014 Status-Icon, Titel, Details, Z\u00e4hler und Mehr-Men\u00fc',
    motifstyle='--w:600px;--z:1.15;--r:10px',
    body='''      <div class="sf-pane">
        <div class="sf-items" data-view="list" style="padding:10px 8px">
'''
        + tab_row('working', 'sync', 'Der Composer soll bei New Session mir die\u2026',
                  'main \u00b7 glm-5.3-flash \u00b7 304 Nachrichten', '304', '1 h',
                  active=True, live='busy', spinning=True)
        + '\n' + tab_row('done', 'check', 'Icon Buttons f\u00fcr Sidepanel-Sektionen',
                         'main \u00b7 glm-5.3-flash \u00b7 493 Nachrichten', '493', '2 h',
                         live='idle')
        + '\n' + tab_row('error', 'error', 'Gruppierung und Drag-Drop f\u00fcr Session Flow Views',
                         'main \u00b7 glm-5.3 \u00b7 683 Nachrichten', '683', '1 d',
                         live='idle')
        + '''
        </div>
      </div>''',
    hover='.sf-pane .sf-tab[data-active="true"]',
)

C['b5-session-grid-glow'] = dict(
    note='Session-Grid \u2014 Karte mit Glow-Ring der arbeitenden Session',
    attrs=' data-sf-liveframe="glow" data-sf-seltint="accent"',
    motifstyle='--w:590px;--z:1.15;--r:10px',
    body='''      <div class="sf-items" data-view="grid"
        style="--sf-grid-cols:2;--sf-grid-min:210px;--sf-grid-gap:10px;padding:12px 10px">
        <div class="sf-tab" data-active="true" data-live="busy" data-density="comfortable">
          <span class="sf-tab-lead" data-kind="working">'''
        + ic('sync', cls='sf-icon-spin', style='font-size:13px') + '''</span>
          <div class="sf-tab-main">
            <div class="sf-tab-title">Der Composer soll bei New Session mir die M\u00f6glichkeit\u2026</div>
            <div class="sf-tab-preview">Der Composer soll bei New Session mir die M\u00f6glichkeit des Projekt-Chips geben.</div>
          </div>
          <div class="sf-tab-meta"><span class="sf-tab-count">304</span><span class="sf-tab-time">1 h</span></div>
          <button type="button" class="sf-more">''' + ic('ellipsis', style='font-size:14px') + '''</button>
        </div>
        <div class="sf-tab" data-live="idle" data-density="comfortable">
          <span class="sf-tab-lead" data-kind="idle">''' + ic('circle-outline', style='font-size:13px') + '''</span>
          <div class="sf-tab-main">
            <div class="sf-tab-title">Icon Buttons f\u00fcr Sidepanel-Sektionen</div>
            <div class="sf-tab-preview">Session Flow \u2014 die Icon-Buttons f\u00fcr die ersten App-Seiten.</div>
          </div>
          <div class="sf-tab-meta"><span class="sf-tab-count">493</span><span class="sf-tab-time">2 h</span></div>
          <button type="button" class="sf-more">''' + ic('ellipsis', style='font-size:14px') + '''</button>
        </div>
      </div>''',
)

C['b6-projekt-header'] = dict(
    note='Projekt-Header \u2014 Ordner, Hover-Caret, Hover-Plus, Drop-Ziel mit Landing-Flash',
    motifstyle='--w:600px;--z:1.15;--r:10px',
    body='''      <div class="sf-pane" style="padding:12px 8px">
        <div class="sf-section">
          ''' + grp_head('session-flow', '~/Linux_VS_Code_Workspace/session-flow', '10',
                         lead='folder-opened', color='#58a6ff') + '''
          ''' + grp_head('AGANTILA_Workspace', '~/Arbeit/2026/AGANTILA_Workspace', '5',
                         lead='dot', color='#34d399', caret=False) + '''
        </div>
        <div class="sf-section">
          ''' + grp_head('session-flow', '~/Linux_VS_Code_Workspace/session-flow', '10',
                         lead='folder-opened', color='#58a6ff', drop=True) + '''
          <div class="sf-items" data-view="list" style="padding:2px 2px 6px">
            ''' + tab_row('done', 'check', 'Icon Buttons f\u00fcr Sidepanel-Sektionen',
                          'main \u00b7 glm-5.3-flash \u00b7 493 Nachrichten', '493', '2 h',
                          just_moved=True) + '''
          </div>
        </div>
      </div>''',
    hover='.sf-section:last-child .sf-group-head[data-drop="true"]',
)

C['b7-gruppen-stack'] = dict(
    note='Gruppen-Stack \u2014 Spine, Fanned, Pill (kollabierte Gruppe)',
    motifstyle='--w:620px;--z:1.5;--r:10px',
    body='''      <div style="padding:18px 16px;display:flex;gap:18px">
        <div class="stack-cell">
          <div class="sf-group-head sf-group-project sf-group-collapsed">
            <span class="sf-group-caret" style="opacity:1">''' + ic('chevron-right', style='font-size:12px') + '''</span>
            <span class="sf-group-lead-icon">''' + ic('folder', style='font-size:13px;color:#58a6ff') + '''</span>
            <span class="sf-group-text"><span class="sf-group-name">session-flow</span></span>
            <span class="sf-group-count">10</span>
          </div>
          <div class="sf-stack" data-style="spine" style="--sf-accent:#58a6ff"><i></i><i></i><i></i></div>
          <div class="stack-cell-label sf-subhead">Spine</div>
        </div>
        <div class="stack-cell">
          <div class="sf-group-head sf-group-project sf-group-collapsed">
            <span class="sf-group-caret" style="opacity:1">''' + ic('chevron-right', style='font-size:12px') + '''</span>
            <span class="sf-group-lead-icon">''' + ic('folder', style='font-size:13px;color:#58a6ff') + '''</span>
            <span class="sf-group-text"><span class="sf-group-name">session-flow</span></span>
            <span class="sf-group-count">10</span>
          </div>
          <div class="sf-stack" data-style="fanned" style="--sf-accent:#58a6ff"><i></i><i></i><i></i></div>
          <div class="stack-cell-label sf-subhead">Fanned</div>
        </div>
        <div class="stack-cell">
          <div class="sf-group-head sf-group-project sf-group-collapsed">
            <span class="sf-group-caret" style="opacity:1">''' + ic('chevron-right', style='font-size:12px') + '''</span>
            <span class="sf-group-lead-icon">''' + ic('folder', style='font-size:13px;color:#58a6ff') + '''</span>
            <span class="sf-group-text"><span class="sf-group-name">session-flow</span></span>
            <span class="sf-group-count">10</span>
          </div>
          <div class="sf-stack" data-style="pill" style="--sf-accent:#58a6ff"><i></i><i></i><i></i></div>
          <div class="stack-cell-label sf-subhead">Pill</div>
        </div>
      </div>''',
)

C['b8-pinned-empty'] = dict(
    note='Angepinnt \u2014 leerer Drop-Platzhalter',
    motifstyle='--w:600px;--z:1.3;--r:10px',
    body='''      <div class="sf-pane" style="padding:10px">
        <div class="sf-section" data-pinned-placeholder="true">
          <div class="sf-group-head sf-group-pinned">
            <span class="sf-group-lead-icon sf-group-lead-pin">'''
        + ic('pin', style='font-size:13px') + '''</span>
            <span class="sf-group-text"><span class="sf-group-name">Angepinnt</span></span>
            <span class="sf-group-actions" title="Alle l\u00f6sen">'''
        + ic('clear-all', style='font-size:14px') + '''</span>
            <span class="sf-group-count">0</span>
          </div>
          <div class="sf-pin-placeholder">''' + ic('pin', style='font-size:14px') + '''
            <span class="sf-pin-placeholder-text">Hier ablegen zum Anpinnen</span>
          </div>
        </div>
      </div>''',
)

C['b9-composer-chip'] = dict(
    note='Projekt-Kontext-Chip \u2014 kalt in der Composer-Zeile',
    motifstyle='--w:620px;--z:1.2;--r:12px',
    body='''      <div style="padding:20px 22px;background:var(--ui-chat-surface-background)">
        <div class="composer-surface">
          ''' + chip() + '''
          <button type="button" class="composer-add" title="Anhang / Befehl">'''
        + ic('add', style='font-size:15px') + '''</button>
          <input class="composer-input" placeholder="Was kommt als N\u00e4chstes?" readonly>
        </div>
      </div>''',
)

C['b10-projekt-menue'] = dict(
    note='Projekt-Kontext-Men\u00fc \u2014 Home und Projektliste mit Farb-Dots',
    motifstyle='--w:340px;--z:2.1;--r:12px',
    body='''      <div style="padding:16px 18px;background:var(--ui-chat-surface-background)">
        ''' + chip() + '''
        <div class="sf-cproj-menu" style="position:static;min-width:290px;margin-top:10px">
          <div class="sf-cproj-menu-hint">Ziel-Projekt f\u00fcr die n\u00e4chste Eingabe</div>
          <button type="button" class="sf-cproj-item"><span class="sf-cproj-dot"></span><span class="sf-cproj-name">Kein Projekt (Home)</span></button>
          <button type="button" class="sf-cproj-item"><span class="sf-cproj-dot" style="--sf-cproj-color:#58a6ff"></span><span class="sf-cproj-name">session-flow</span></button>
          <button type="button" class="sf-cproj-item"><span class="sf-cproj-dot" style="--sf-cproj-color:#34d399"></span><span class="sf-cproj-name">AGANTILA_Workspace</span></button>
          <button type="button" class="sf-cproj-item"><span class="sf-cproj-dot" style="--sf-cproj-color:#f87171"></span><span class="sf-cproj-name">Colaborate Vault</span></button>
          <button type="button" class="sf-cproj-item"><span class="sf-cproj-dot" style="--sf-cproj-color:#a78bfa"></span><span class="sf-cproj-name">hermes-workspace</span></button>
        </div>
      </div>''',
)

C['b11-suche-filter'] = dict(
    note='Suche &amp; Schnellfilter \u2014 Suchfeld mit L\u00f6schen-X und Segment-Control',
    motifstyle='--w:600px;--z:1.35;--r:10px',
    body='''      <div style="padding:16px 18px;display:flex;flex-direction:column;gap:20px">
        <div>
          <div class="sf-subhead" style="margin:0 0 9px">Treffer \u00b7 Suche aktiv</div>
          <div class="sf-filterbar">''' + searchbar('composer') + seg('Alle') + '''</div>
        </div>
        <div>
          <div class="sf-subhead" style="margin:0 0 9px">Archiv-Filter \u00b7 ohne Suchtext</div>
          <div class="sf-filterbar">''' + searchbar('', clear=False) + seg('Archiv') + '''</div>
        </div>
      </div>''',
)

C['b12-status-icons'] = dict(
    note='Aktivit\u00e4ts-Set \u2014 Denkt nach, Schreibt, Tool l\u00e4uft, Wartet, Fertig, Fehler',
    motifstyle='--w:620px;--z:1.2;--r:12px',
    body='''      <div style="padding:22px 24px">
        <div class="status-grid">
          <div class="status-tile"><span class="sf-tab-lead" data-kind="thinking">''' + ic('loading', cls='sf-icon-spin', style='font-size:15px') + '''</span><span class="status-label">Denkt nach\u2026</span></div>
          <div class="status-tile"><span class="sf-tab-lead" data-kind="streaming">''' + ic('pulse', style='font-size:15px') + '''</span><span class="status-label">Schreibt\u2026</span></div>
          <div class="status-tile"><span class="sf-tab-lead" data-kind="tool">''' + ic('tools', style='font-size:15px') + '''</span><span class="status-label">Tool l\u00e4uft</span></div>
          <div class="status-tile"><span class="sf-tab-lead" data-kind="waiting">''' + ic('bell', style='font-size:15px') + '''</span><span class="status-label">Wartet auf Antwort</span></div>
          <div class="status-tile"><span class="sf-tab-lead" data-kind="done">''' + ic('check', style='font-size:15px') + '''</span><span class="status-label">Fertig</span></div>
          <div class="status-tile"><span class="sf-tab-lead" data-kind="error">''' + ic('error', style='font-size:15px') + '''</span><span class="status-label">Fehler</span></div>
        </div>
      </div>''',
)

C['b13-kontext-anzeige'] = dict(
    note='Kontext-Fenster \u2014 Donut und Bar',
    attrs=' data-sf-ctxpie="on"',
    motifstyle='--w:600px;--z:1.2;--r:12px',
    body='''      <div style="padding:26px 28px;display:flex;flex-direction:column;gap:30px">
        <div class="ctx-row">
          <div class="ctx-cell"><span class="sf-tab-ctx" data-level="ok" data-style="donut" style="--sf-ctx-pct:42%">42%</span><span class="cap">Donut \u00b7 42 %</span></div>
          <div class="ctx-cell"><span class="sf-tab-ctx" data-level="warn" data-style="donut" style="--sf-ctx-pct:78%">78%</span><span class="cap">Donut \u00b7 78 %</span></div>
          <div class="ctx-cell"><span class="sf-tab-ctx" data-level="high" data-style="donut" style="--sf-ctx-pct:93%">93%</span><span class="cap">Donut \u00b7 93 %</span></div>
        </div>
        <div class="ctx-row ctx-scope-bar">
          <div class="ctx-cell"><span class="sf-tab-ctx" data-level="ok" data-style="bar" style="--sf-ctx-pct:62%" title="Kontext 62 %"></span><span class="cap">Bar \u00b7 28 px, ohne Zahl</span></div>
          <div class="ctx-cell"><span class="sf-tab-ctx" data-level="warn" data-style="bar" style="--sf-ctx-pct:88%" title="Kontext 88 %"></span><span class="cap">Bar \u00b7 warn</span></div>
        </div>
      </div>''',
)

C['b14-drop-ready'] = dict(
    note='Drop-Ready \u2014 Sektion als akzeptierendes Ziel mit pulsierender Umrandung',
    motifstyle='--w:600px;--z:1.15;--r:10px',
    body='''      <div class="sf-pane" style="padding:12px 8px">
        <div class="sf-section" data-drop-ready="true">
          ''' + grp_head('session-flow', '~/Linux_VS_Code_Workspace/session-flow', '10',
                         lead='folder-opened', color='#58a6ff') + '''
          <div class="sf-items" data-view="list" style="padding:2px 2px 6px">
            ''' + tab_row('done', 'check', 'Icon Buttons f\u00fcr Sidepanel-Sektionen',
                          'main \u00b7 glm-5.3-flash \u00b7 493 Nachrichten', '493', '2 h') + '''
            ''' + tab_row('working', 'sync', 'Der Composer soll bei New Session mir die\u2026',
                          'main \u00b7 glm-5.3-flash \u00b7 304 Nachrichten', '304', '1 h',
                          live='busy', spinning=True) + '''
          </div>
        </div>
      </div>''',
)

C['b15-empty-state'] = dict(
    note='Empty-State \u2014 leere Pane mit dezentem Hinweis',
    motifstyle='--w:600px;--z:1.3;--r:10px',
    body='''      <div class="sf-pane" style="padding:8px">
        <div class="sf-list">
          <div class="sf-empty">
            <div class="sf-empty-title">Keine Sessions gefunden</div>
            <div class="sf-empty-body">Starte einen Chat \u2014 er erscheint hier als Tab.</div>
          </div>
        </div>
      </div>''',
)

C['b15a-ladezustand'] = dict(
    note='Ladezustand \u2014 Gateway-Gate, Ladebalken und Pending-Sektion',
    motifstyle='--w:600px;--z:1.12;--r:10px',
    body='''      <div class="sf-pane" style="padding:8px">
        <div class="sf-section">
          ''' + grp_head('Projekte werden geladen\u2026',
                         'Sessions erscheinen sofort; die Projekt-Gruppierung folgt unmittelbar.',
                         '0', lead='folder', color='#58a6ff') + '''
        </div>
        <div class="sf-load" data-phase="gate">
          <div class="sf-load-title">''' + ic('plug', style='font-size:14px') + ''' Warte auf das Gateway\u2026</div>
          <div class="sf-load-bar"></div>
          <div class="sf-load-hint">Sobald das Gateway die Sessions anzeigt, erscheinen sie samt Projekten hier automatisch.</div>
        </div>
        <div class="sf-load" data-phase="loading">
          <div class="sf-load-title">''' + ic('loading', cls='sf-icon-spin', style='font-size:14px') + ''' Sessions werden geladen\u2026</div>
          <div class="sf-load-bar"></div>
          <div class="sf-load-hint">Sessions und Projekte werden gerade geladen.</div>
        </div>
      </div>''',
)

C['b15b-filter-empty'] = dict(
    note='Filter-Empty \u2014 kein Treffer im Schnellfilter',
    motifstyle='--w:600px;--z:1.15;--r:10px',
    body='''      <div class="sf-pane">
        <div class="sf-filterbar">''' + searchbar('ollama') + seg('Aktiv') + '''</div>
        <div class="sf-list">
          <div class="sf-empty">
            <div class="sf-empty-title">Keine Sessions passen zu diesem Filter</div>
            <div class="sf-empty-body">Anderen Suchbegriff oder Schnellfilter versuchen.</div>
          </div>
        </div>
      </div>''',
)

C['b16-streaming'] = dict(
    note='Streaming \u2014 zwei fertige Zeilen, eine im Schreib-Moment',
    motifstyle='--w:620px;--z:1.3;--r:12px',
    body='''      <div class="chat-surface">
        <div class="chat-line is-written">Der Projekt-Kontext-Chip sitzt jetzt direkt vor dem Plus-Button in der Eingabezeile.</div>
        <div class="chat-line is-written">Der Farb-Dot im Chip zeigt das Ziel-Projekt; das Caret \u00f6ffnet die Projektliste.</div>
        <div class="chat-line">Beim Streaming laufen die Zeilen von oben nach unten ein \u2014 die letzte ist noch im Schreib-Moment<span class="caret"></span></div>
      </div>''',
)

C['b17-glass-vergleich'] = dict(
    note='Glass \u2014 aus vs. an in der gleichen Szene',
    motifstyle='--w:620px;--z:1.15;--r:12px',
    body='''      <div style="padding:22px 24px;background:var(--ui-chat-surface-background)">
        <div class="glass-compare">
          <div class="glass-cell">
            <span class="glass-caption">Glass aus</span>
            <div class="composer-surface" style="--sf-glass-grad:0%">
              ''' + chip() + '''
              <button type="button" class="composer-add">''' + ic('add', style='font-size:15px') + '''</button>
              <input class="composer-input" placeholder="Was kommt als N\u00e4chstes?" readonly>
            </div>
          </div>
          <div class="glass-cell">
            <span class="glass-caption">Glass an</span>
            <div class="composer-surface" data-slot="composer-surface" style="--composer-fill:color-mix(in srgb, var(--ui-accent) 8%, color-mix(in srgb, var(--dt-card) 86%, transparent));--sf-glass-grad:12%;-webkit-backdrop-filter:blur(10px) saturate(115%);backdrop-filter:blur(10px) saturate(115%)">
              ''' + chip() + '''
              <button type="button" class="composer-add">''' + ic('add', style='font-size:15px') + '''</button>
              <input class="composer-input" placeholder="Was kommt als N\u00e4chstes?" readonly>
            </div>
          </div>
        </div>
      </div>''',
)


def main():
    order = ['b1-navapps', 'b2-pane-toolbar', 'b3-tab-close', 'b4-session-liste',
             'b5-session-grid-glow', 'b6-projekt-header', 'b7-gruppen-stack',
             'b8-pinned-empty', 'b9-composer-chip', 'b10-projekt-menue',
             'b11-suche-filter', 'b12-status-icons', 'b13-kontext-anzeige',
             'b14-drop-ready', 'b15-empty-state', 'b15a-ladezustand',
             'b15b-filter-empty', 'b16-streaming', 'b17-glass-vergleich']
    manifest = []
    for key in order:
        spec = C[key]
        out = HEAD.format(
            attrs=spec.get('attrs', ''),
            title='Session Flow \u2014 ' + key,
            note=spec['note'],
            motifcls=spec.get('motifcls', ''),
            motifstyle=spec['motifstyle'],
            body=spec['body'],
        )
        path = SRC / f'{key}.html'
        path.write_text(out, encoding='utf-8')
        manifest.append((key, spec.get('hover', ''), f'sf-comp-{key}-1x1.png'))
    with open(ROOT / 'tools' / 'manifest.tsv', 'w', encoding='utf-8') as fh:
        for key, hover, png in manifest:
            fh.write(f'{key}\t{hover}\t{png}\n')
    print(f'wrote {len(manifest)} cards')
    for key, hover, png in manifest:
        print(' ', key, '->', png)


if __name__ == '__main__':
    main()
