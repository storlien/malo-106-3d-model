/* Shared helpers: fair curves, mesh builders, materials. */
const T = THREE, V3 = T.Vector3;
const C = hex => new T.Color(hex).convertSRGBToLinear();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a)*t;
const smooth = t => { t = clamp(t, 0, 1); return t*t*(3 - 2*t); };

/* Monotone cubic through a table, so hull curves stay fair and never overshoot. */
function fair(table, col = 1) {
  const xs = table.map(r => r[0]), ys = table.map(r => r[col]), n = xs.length;
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i])/(xs[i + 1] - x));
  const m = ys.map((_, i) => i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1]*d[i] <= 0 ? 0 : (d[i - 1] + d[i])/2);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i]/d[i], b = m[i + 1]/d[i], s = a*a + b*b;
    if (s > 9) { const k = 3/Math.sqrt(s); m[i] = k*a*d[i]; m[i + 1] = k*b*d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i])/h, t2 = t*t, t3 = t2*t;
    return (2*t3 - 3*t2 + 1)*ys[i] + (t3 - 2*t2 + t)*h*m[i] + (3*t2 - 2*t3)*ys[i + 1] + (t3 - t2)*h*m[i + 1];
  };
}

/* Mesh from a grid of points (rows of [x,y,z]). */
function gridGeo(rows, opts = {}) {
  const nr = rows.length, nc = rows[0].length, pos = [], uv = [], idx = [];
  rows.forEach(r => r.forEach(p => { pos.push(p[0], p[1], p[2]); if (opts.uv) { const q = opts.uv(p); uv.push(q[0], q[1]); } }));
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) {
    const a = i*nc + j, b = a + 1, c = a + nc, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  if (opts.uv) g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function put(parent, geo, mat, shadow = true) {
  const m = new T.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
const grid = (parent, rows, mat, opts) => put(parent, gridGeo(rows, opts), mat, !(opts && opts.noShadow));

function rod(parent, a, b, r, mat, seg = 10, r2) {
  const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = d.length();
  const m = put(parent, new T.CylinderGeometry(r2 === undefined ? r : r2, r, len, seg), mat);
  m.position.copy(A).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  return m;
}
function tube(parent, pts, r, mat, closed = false, seg = 8) {
  const c = new T.CatmullRomCurve3(pts.map(p => new V3(...p)), closed, 'centripetal');
  return put(parent, new T.TubeGeometry(c, Math.max(24, pts.length*12), r, seg, closed), mat);
}
function box(parent, c, s, mat) {
  const m = put(parent, new T.BoxGeometry(s[0], s[1], s[2]), mat); m.position.set(c[0], c[1], c[2]); return m;
}
/* Sweep a closed 2D profile [out, up] along a path, keeping "up" vertical. */
function sweep(parent, path, profile, mat, opts = {}) {
  const prof = profile.concat([profile[0]]), rows = [];
  path.forEach((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const t = new V3(b[0] - a[0], opts.tilt ? b[1] - a[1] : 0, b[2] - a[2]).normalize();
    const up = new V3(0, 1, 0), out = new V3().crossVectors(t, up).normalize().multiplyScalar(opts.flip ? -1 : 1);
    const u2 = opts.tilt ? new V3().crossVectors(out, t).normalize().multiplyScalar(opts.flip ? -1 : 1) : up;
    rows.push(prof.map(q => [p[0] + out.x*q[0] + u2.x*q[1], p[1] + out.y*q[0] + u2.y*q[1], p[2] + out.z*q[0] + u2.z*q[1]]));
  });
  return grid(parent, rows, mat, opts);
}
function roundRect(w, h, r) {
  const s = new T.Shape(), x = -w/2, y = -h/2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* ---------- Textures ---------- */
function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; }
function teakTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'), r = rng(19), n = 8, ph = c.height/n;
  for (let i = 0; i < n; i++) {
    let x = -r()*300;
    while (x < c.width) {                       // individual lengths with butt joints
      const len = 260 + r()*420, l = 54 + r()*12, s = 7 + r()*7, hue = 34 + r()*8;
      g.fillStyle = `hsl(${hue},${s}%,${l}%)`; g.fillRect(x, i*ph, len, ph);
      for (let k = 0; k < 16; k++) {            // weathered grain
        g.strokeStyle = `rgba(${r() < .5 ? '70,60,48' : '240,235,225'},${.05 + r()*.1})`; g.lineWidth = .6 + r()*1.3;
        const y = i*ph + 3 + r()*(ph - 6), a = r()*6; g.beginPath(); g.moveTo(x, y);
        for (let q = x; q <= x + len; q += 24) g.lineTo(q, y + Math.sin(q*.011 + a)*1.6);
        g.stroke();
      }
      g.fillStyle = 'rgba(38,34,30,.85)'; g.fillRect(x, i*ph, 2.5, ph);
      x += len;
    }
    g.fillStyle = '#2c2925'; g.fillRect(0, i*ph - 3, c.width, 6);
  }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 16;
  return t;
}
function flagTexture() {
  const c = document.createElement('canvas'); c.width = 220; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#ba0c2f'; g.fillRect(0, 0, 220, 160);
  g.fillStyle = '#fff'; g.fillRect(60, 0, 40, 160); g.fillRect(0, 60, 220, 40);
  g.fillStyle = '#00205b'; g.fillRect(70, 0, 20, 160); g.fillRect(0, 70, 220, 20);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
}

/* ---------- Materials ---------- */
const M = (hex, o) => new T.MeshStandardMaterial(Object.assign({ color: C(hex), roughness: .55, metalness: 0, side: T.DoubleSide }, o || {}));
const teakTex = teakTexture();
const mat = {
  gel:     M(SPEC.paint.topsides, { roughness: .3, envMapIntensity: .7 }),
  gelDeck: M('#ddd2b2', { roughness: .42 }),
  navy:    M(SPEC.paint.navy, { roughness: .35 }),
  anti:    M(SPEC.paint.antifoul, { roughness: .72 }),
  teak:    M('#ffffff', { map: teakTex, roughness: .86 }),
  teakRail:M('#a59c8b', { roughness: .8 }),
  teakDark:M('#8a6a45', { roughness: .6 }),
  canvas:  M('#0c1740', { roughness: .96, envMapIntensity: .35 }),
  canvasD: M('#091233', { roughness: .97, envMapIntensity: .3 }),
  clear:   M('#7f9299', { roughness: .05, metalness: .2, transparent: true, opacity: .26, depthWrite: false }),
  glass:   M('#26343c', { roughness: .06, metalness: .4, transparent: true, opacity: .62, depthWrite: false }),
  port:    M('#1b2329', { roughness: .1, metalness: .45 }),
  steel:   M('#dfe4e8', { roughness: .16, metalness: .95 }),
  alu:     M('#cfd4d8', { roughness: .36, metalness: .7 }),
  dark:    M('#1f2226', { roughness: .5 }),
  bronze:  M('#c9c3ae', { roughness: .32, metalness: .75 }),
  wire:    M('#b9bfc4', { roughness: .3, metalness: .85 }),
  blue:    M('#101f58', { roughness: .92, envMapIntensity: .25 }),
  white:   M('#f2f0e8', { roughness: .35 }),
  flag:    M('#ffffff', { map: flagTexture(), roughness: .85 }),
  logo:    M('#7a5a24', { roughness: .4, transparent: true }),
};
