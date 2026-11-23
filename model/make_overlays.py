#!/usr/bin/env python3
"""Extract the builder's profile and plan drawings from the brochure as
transparent red line-art overlays. Pixel grid: 1800 px across = page x 295..540
(at 827 px page width), which is the 'G' coordinate used in spec.js."""
import subprocess, tempfile
from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parent.parent
pdf = root / 'photos/M106-Brochure (1).pdf'
with tempfile.TemporaryDirectory() as d:
    subprocess.run(['pdftoppm', '-r', '400', '-f', '5', '-l', '5', '-png', str(pdf), f'{d}/p'], check=True)
    page = Image.open(next(Path(d).glob('p*.png'))).convert('L')

for name, (y0, y1) in {'profile': (735, 845), 'plan': (640, 735)}.items():
    c = page.crop((295*4, y0*4, 540*4, y1*4))
    c = c.resize((1800, round(c.size[1]*1800/c.size[0])), Image.LANCZOS)
    a = np.clip((205 - np.asarray(c, float))*2.1, 0, 255).astype('uint8')
    rgba = np.dstack([np.full_like(a, 225), np.full_like(a, 20), np.full_like(a, 40), a])
    Image.fromarray(rgba, 'RGBA').quantize(32, method=Image.Quantize.FASTOCTREE).save(root/f'model/assets/{name}.png', optimize=True)
    print(name, c.size)
