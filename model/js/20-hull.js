/* Hull surface, painted livery, moulding, keel, skeg, rudder, propeller. */
const HS = SPEC.hull, L = HS.length;
const sheerY = fair(HS.sheer), halfB = fair(HS.halfBreadth), keelY = fair(HS.keelLine);
const shBilge = fair(HS.shape, 1), shDead = fair(HS.shape, 2), shSide = fair(HS.shape, 3), shDrop = fair(HS.shape, 4);

/* Half-section at station x: a cubic from the keel (t=0) to the sheer (t=1). Returns [halfWidth, y]. */
function sectionPt(x, t) {
  const S = sheerY(x), K = Math.min(keelY(x), S), B = halfB(x), H = S - K, u = 1 - t;
  const y1 = K + shDead(x)*H, y2 = S - shDrop(x)*H, w1 = shBilge(x)*B, w2 = shSide(x)*B;
  return [3*u*u*t*w1 + 3*u*t*t*w2 + t*t*t*B, u*u*u*K + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*S];
}
/* Hull half-width at a given station and height. */
function hullHalf(x, y) {
  if (x < 0 || x > L) return 0;
  const S = sheerY(x), K = Math.min(keelY(x), S);
  if (y <= K) return 0; if (y >= S) return halfB(x);
  let a = 0, b = 1;
  for (let k = 0; k < 26; k++) { const m = (a + b)/2; if (sectionPt(x, m)[1] < y) a = m; else b = m; }
  return sectionPt(x, (a + b)/2)[0];
}
const transomX = (y, z) => HS.transomRake*(sheerY(0) - y) + HS.transomCurve*z*z;
function transomStart(t) {
  let x = 0.1;
  for (let k = 0; k < 40; k++) { const p = sectionPt(x, t); x = Math.max(0, lerp(x, transomX(p[1], p[0]), .7)); }
  return x;
}
const deckHalf = x => x <= 0 ? 0 : Math.min(halfB(x), Math.sqrt(x/HS.transomCurve));
const deckY = (x, z) => { const B = Math.max(halfB(x), .01), f = smooth(x/.35); return sheerY(x) + SPEC.deck.crown*f*Math.max(0, 1 - (z/B)*(z/B)); };

const boat = new T.Group();
const G = { hull: new T.Group(), deck: new T.Group(), canvas: new T.Group(), rig: new T.Group(), rails: new T.Group() };
Object.values(G).forEach(g => boat.add(g));

/* Livery is painted per pixel in the shader, so stripes stay crisp at any zoom. */
function hullMaterial() {
  const P = SPEC.paint;
  const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .3, envMapIntensity: .55, side: T.DoubleSide });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uCream: { value: C(P.topsides) }, uNavy: { value: C(P.navy) }, uAnti: { value: C(P.antifoul) } });
    sh.vertexShader = 'attribute float aDown;varying float vDown;varying float vH;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDown=aDown;vH=position.y;');
    sh.fragmentShader = 'uniform vec3 uCream,uNavy,uAnti;varying float vDown;varying float vH;\n' +
      sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float e=.0022; vec3 c=uCream;
      c=mix(c,uNavy,smoothstep(${P.sheerBand[0]}-e,${P.sheerBand[0]}+e,vDown)*(1.-smoothstep(${P.sheerBand[1]}-e,${P.sheerBand[1]}+e,vDown)));
      c=mix(c,uNavy,1.-smoothstep(${P.boot[1]}-e,${P.boot[1]}+e,vH));
      c=mix(c,uCream,1.-smoothstep(${P.pin[1]}-e,${P.pin[1]}+e,vH));
      c=mix(c,uAnti,1.-smoothstep(${P.pin[0]}-e,${P.pin[0]}+e,vH));
      diffuseColor.rgb=c;`);
  };
  return m;
}

(function buildHull() {
  const NU = 320, NV = 64, hm = hullMaterial();
  const starts = []; for (let j = 0; j <= NV; j++) starts.push(transomStart(j/NV));
  [1, -1].forEach(side => {
    const rows = [];
    for (let i = 0; i <= NU; i++) {
      const u = i/NU, r = [];
      for (let j = 0; j <= NV; j++) { const x = lerp(starts[j], L, u), p = sectionPt(x, j/NV); r.push([x, p[1], side*p[0]]); }
      rows.push(r);
    }
    const g = gridGeo(rows), down = [];
    rows.forEach(r => r.forEach(p => down.push(sheerY(p[0]) - p[1])));
    g.setAttribute('aDown', new T.Float32BufferAttribute(down, 1));
    put(G.hull, g, hm);
  });
  // transom panel
  const rows = [];
  for (let j = 0; j <= NV; j++) {
    const x0 = starts[j], p = sectionPt(x0, j/NV), r = [];
    for (let k = 0; k <= 48; k++) { const z = lerp(-p[0], p[0], k/48); r.push([transomX(p[1], z), p[1], z]); }
    rows.push(r);
  }
  const g = gridGeo(rows), down = [];
  rows.forEach(r => r.forEach(p => down.push(sheerY(p[0]) - p[1])));
  g.setAttribute('aDown', new T.Float32BufferAttribute(down, 1));
  put(G.hull, g, hm);
})();

/* Raised strake below the sheer band; its ends taper to nothing like the real moulding. */
(function moulding() {
  const q = SPEC.paint.moulding, n = 260;
  [1, -1].forEach(s => {
    const rows = [];
    for (let i = 0; i <= n; i++) {
      const x = lerp(q.from, q.to, i/n), yc = sheerY(x) - q.below;
      const e = Math.min(smooth((x - q.from)/.55), smooth((q.to - x)/.8));
      const h = q.height*(.12 + .88*e)/2, pr = q.proud*e, r = [];
      for (let k = 0; k <= 6; k++) { const a = Math.PI*k/6, y = yc - h*Math.cos(a); r.push([x, y, s*(hullHalf(x, y) + pr*Math.sin(a) - .001)]); }
      rows.push(r);
    }
    grid(G.hull, rows, mat.gelDeck);
  });
})();

/* Malö "m" on each bow */
(function logo() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#6d5020'; g.font = 'italic 900 118px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('m', 128, 58);
  const tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding; tx.anisotropy = 8;
  [1, -1].forEach(s => {
    const rows = [], x0 = 8.944, y0 = sheerY(x0) - .30, w = .26, h = .13;
    for (let i = 0; i <= 8; i++) { const r = []; for (let j = 0; j <= 4; j++) { const x = x0 + (i/8 - .5)*w, y = y0 + (j/4 - .5)*h; r.push([x, y, s*(hullHalf(x, y) + .003)]); } rows.push(r); }
    const uv = []; rows.forEach((r, i) => r.forEach((_, j) => uv.push(s > 0 ? 1 - i/8 : i/8, j/4)));
    const geo = gridGeo(rows); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    put(G.hull, geo, new T.MeshStandardMaterial({ map: tx, transparent: true, roughness: .4, side: T.DoubleSide, depthWrite: false }), false);
  });
})();

/* Foils: stacked NACA sections between tabulated levels. */
function foil(levels, material, parent = G.hull) {
  const N = 22, secs = [];
  const expanded = [];
  levels.forEach((l, i) => {
    expanded.push(l);
    if (i < levels.length - 1 && Math.abs(l[0] - levels[i + 1][0]) > .05) {
      const n = 6; for (let k = 1; k < n; k++) { const q = levels[i + 1], f = k/n; expanded.push([lerp(l[0], q[0], f), lerp(l[1], q[1], f), lerp(l[2], q[2], f), lerp(l[3], q[3], f)]); }
    }
  });
  expanded.forEach(([y, le, te, tr]) => {
    const chord = le - te, s = [];
    const pt = (c, side) => [le - c*chord, y, side*5*tr*chord*(.2969*Math.sqrt(c) - .126*c - .3516*c*c + .2843*c*c*c - .1036*c*c*c*c)];
    for (let i = 0; i <= N; i++) s.push(pt((1 - Math.cos(Math.PI*i/N))/2, 1));
    for (let i = N - 1; i >= 0; i--) s.push(pt((1 - Math.cos(Math.PI*i/N))/2, -1));
    secs.push(s);
  });
  grid(parent, secs, material);
  // closed tip
  const tip = secs[secs.length - 1], rows = [tip, tip.map(p => [p[0], p[1], p[2]*.55]), tip.map(p => [p[0], p[1], 0])];
  grid(parent, rows, material);
}
foil(SPEC.keel.fin, mat.anti);
foil(SPEC.keel.deadwood, mat.anti);
foil(SPEC.keel.skeg, mat.anti);
foil(SPEC.keel.rudder, mat.anti);

(function propeller() {
  const p = SPEC.keel.prop, f = SPEC.keel.shaftFrom;
  rod(G.hull, [f[0], f[1], 0], [p.x + .05, p.y, 0], .016, mat.steel);
  const hub = put(G.hull, new T.SphereGeometry(.045, 16, 12), mat.bronze); hub.position.set(p.x, p.y, 0); hub.scale.set(1.5, 1, 1);
  const prop = new T.Group(); prop.position.set(p.x, p.y, 0); G.hull.add(prop);
  const s = new T.Shape(); s.moveTo(.03, -.025); s.bezierCurveTo(p.r*.5, -.085, p.r*.95, -.075, p.r, -.005);
  s.bezierCurveTo(p.r*.95, .06, p.r*.45, .07, .03, .025); s.closePath();
  for (let i = 0; i < p.blades; i++) {
    const h = new T.Group(); h.rotation.x = i*Math.PI*2/p.blades; prop.add(h);
    const b = put(h, new T.ShapeGeometry(s, 14), mat.bronze);
    b.rotation.order = 'YXZ'; b.rotation.y = 1.05; b.rotation.z = Math.PI/2;
  }
})();
