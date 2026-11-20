#!/usr/bin/env python3
"""Pakk viewer/index.html til én selvstendig fil: out/alizee_web.html.

CSS og <script src>-filer leses inn og settes inline, i samme rekkefølge
som index.html laster dem. Kjøres med python3 viewer/assemble.py.
"""
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
vdir = root / 'viewer'
html = (vdir / 'index.html').read_text(encoding='utf-8')

# css inn
css = (vdir / 'css/style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="css/style.css">',
                    f'<style>\n{css}</style>', 1)

# skript inn (three.min.js og js-modulene, i lasterekkefølgen)
def inline(m):
    src = m.group(1)
    code = (vdir / src).read_text(encoding='utf-8')
    return f'<script>\n{code}\n</script>'

html, n = re.subn(r'<script src="([^"]+)"></script>', inline, html)
assert n == 14, f'forventet 14 skript (three + 13 moduler), fant {n}'

dest = root / 'out/alizee_web.html'
dest.parent.mkdir(exist_ok=True)
dest.write_text(html, encoding='utf-8')
print(f'{dest}  ({len(html)/1e6:.2f} MB)')
