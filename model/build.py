#!/usr/bin/env python3
"""Bundle model/ into one self-contained static page: public/index.html."""
import base64
from pathlib import Path

here = Path(__file__).resolve().parent
uri = lambda n: 'data:image/png;base64,' + base64.b64encode((here/f'assets/{n}.png').read_bytes()).decode()
safe = lambda s: s.replace('</script', '<\\/script')

parts = [f"const OVERLAYS={{profile:'{uri('profile')}',plan:'{uri('plan')}',logo:'{uri('malo-logo')}'}};", (here/'spec.js').read_text('utf-8')]
parts += [p.read_text('utf-8') for p in sorted((here/'js').glob('*.js'))]
parts += [p.read_text('utf-8') for p in sorted((here/'sea').glob('*.js'))]   # sea trial viewer, kept in its own files
# interior viewer, kept in its own files. Its geometry (files 20-29) is wrapped in one function that runs only when
# the interior is opened, so nothing of it is built or held while the other viewers are in use.
lazy = lambda names, fn: f"function {fn}() {{\n" + '\n'.join(n.read_text('utf-8') for n in names) + "\n}"
ints = sorted((here/'interior').glob('*.js'))
parts += [p.read_text('utf-8') for p in ints if p.name < '20']
parts += [lazy([p for p in ints if '20' <= p.name < '30'], 'buildInteriorGeometry')]
parts += [p.read_text('utf-8') for p in ints if p.name >= '30']

html = (here/'template.html').read_text('utf-8')
html = html.replace('/*THREE*/', safe((here/'vendor/three.min.js').read_text('utf-8')))
html = html.replace('/*MODEL*/', safe('\n'.join(parts)))
out = here.parent/'public/index.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, 'utf-8')
print(f'{out} ({len(html)/1e6:.2f} MB)')
