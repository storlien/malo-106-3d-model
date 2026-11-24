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
const deckLevel = (x, z) => { const B = Math.max(halfB(x), .01), f = smooth(x/.35); return sheerY(x) + SPEC.deck.crown*f*Math.max(0, 1 - (z/B)*(z/B)); };   // the lowered teak deck
const deckY = (x, z) => x < SPEC.deck.toeRail.sternCapTo ? sheerY(x) + SPEC.deck.toeRail.height + .001 : deckLevel(x, z);        // what you stand on: the wide stern toe rail, then the deck

const boat = new T.Group();
const G = { hull: new T.Group(), deck: new T.Group(), canvas: new T.Group(), rig: new T.Group(), rails: new T.Group() };
Object.values(G).forEach(g => boat.add(g));
G.asBuilt = new T.Group(); G.rails.add(G.asBuilt);   // stern items the solar arch replaces
G.arch = new T.Group(); boat.add(G.arch);

/* Livery is painted per pixel in the shader, so stripes stay crisp at any zoom. */
function hullMaterial(insideFront = false) {
  const P = SPEC.paint;
  const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .3, envMapIntensity: .55, side: T.DoubleSide });
  m.customProgramCacheKey = () => 'hull' + insideFront;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uInsideFront: { value: insideFront }, uCream: { value: C(P.topsides) }, uNavy: { value: C(P.navy) }, uAnti: { value: C(P.antifoul) } });
    sh.vertexShader = 'attribute float aDown;varying float vDown;varying float vH;varying float vX;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDown=aDown;vH=position.y;vX=position.x;');
    const BT = SPEC.keel.bowThruster;
    sh.fragmentShader = 'uniform vec3 uCream,uNavy,uAnti;uniform bool uInsideFront;varying float vDown;varying float vH;varying float vX;\n' +
      sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (length(vec2(vX - ${BT.x.toFixed(4)}, vH - (${BT.y.toFixed(4)}))) < ${(BT.d/2).toFixed(4)}) discard;   // bow thruster tunnel
      float e=.0022; vec3 c=uCream;
      c=mix(c,uNavy,smoothstep(${P.sheerBand[0]}-e,${P.sheerBand[0]}+e,vDown)*(1.-smoothstep(${P.sheerBand[1]}-e,${P.sheerBand[1]}+e,vDown)));
      c=mix(c,uNavy,1.-smoothstep(${P.boot[1]}-e,${P.boot[1]}+e,vH));
      c=mix(c,uCream,1.-smoothstep(${P.pin[1]}-e,${P.pin[1]}+e,vH));
      c=mix(c,uAnti,1.-smoothstep(${P.pin[0]}-e,${P.pin[0]}+e,vH));
      if (gl_FrontFacing == uInsideFront) c = vec3(.86, .85, .81);   // inside of the hull: white-painted GRP, never the topside paint
      diffuseColor.rgb=c;`);
  };
  return m;
}

(function buildHull() {
  const NU = 320, NV = 64;
  // which faces of a surface look into the boat, from one triangle near the middle and the outward direction there
  const hm = (g, out) => {
    const p = g.attributes.position, ix = g.index, t = Math.floor(ix.count/6)*3, v = k => new V3().fromBufferAttribute(p, ix.getX(t + k));
    const a = v(0), n = new V3().subVectors(v(1), a).cross(new V3().subVectors(v(2), a));
    return hullMaterial(n.dot(out) < 0);
  };
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
    put(G.hull, g, hm(g, new V3(0, 0, side)));
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
  put(G.hull, g, hm(g, new V3(-1, 0, 0)));
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

/* Bow thruster: a tunnel straight through the forefoot, its ends cut by the hull, with the propeller in the middle. [P] */
(function bowThruster() {
  const B = SPEC.keel.bowThruster, r = B.d/2, n = 40, rows = [];
  for (let i = 0; i <= n; i++) {
    const a = i/n*Math.PI*2, x = B.x + r*Math.cos(a), y = B.y + r*Math.sin(a), h = hullHalf(x, y) + .004;
    rows.push([[x, y, -h], [x, y, 0], [x, y, h]]);
  }
  put(G.hull, gridGeo(rows), mat.anti, false);
  const motor = put(G.hull, new T.CylinderGeometry(r*.32, r*.32, .05, 18), mat.dark); motor.rotation.x = Math.PI/2; motor.position.set(B.x, B.y, 0);
  for (let k = 0; k < 4; k++) {                          // four-bladed thruster propeller
    const b = put(G.hull, new T.BoxGeometry(r*.62, .006, .035), mat.dark); const a = k*Math.PI/2 + .3;
    b.position.set(B.x + Math.cos(a)*r*.5, B.y + Math.sin(a)*r*.5, .03); b.rotation.set(.5, 0, a);
  }
  const strut = put(G.hull, new T.BoxGeometry(.03, r*.9, .03), mat.dark); strut.position.set(B.x, B.y + r*.55, 0);
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
mat.foil = mat.anti.clone();           // keel, skeg and rudder: their roots inside the hull are never drawn, so nothing shows inside the boat
(() => {
  const N = 200, keel = Array.from({ length: N + 1 }, (_, i) => Math.min(keelY(i/N*L), sheerY(i/N*L)).toFixed(4));
  mat.foil.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec2 vXY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvXY = position.xy;');
    sh.fragmentShader = `varying vec2 vXY; const float KEEL[${N + 1}] = float[](${keel.join(',')});\n` + sh.fragmentShader.replace('#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>\n float kf = clamp(vXY.x/${L.toFixed(3)}, 0.0, 1.0)*${N}.0; int ki = int(min(kf, ${N - 1}.0));
       if (vXY.y > mix(KEEL[ki], KEEL[ki + 1], kf - float(ki)) + .003) discard;`);
  };
  mat.foil.customProgramCacheKey = () => 'foil';
})();
foil(SPEC.keel.fin, mat.foil);
(function deadwood() {     // horizontal slices from inside the hull down to the flat bottom, each a thick rounded outline in plan
  const D = SPEC.keel.deadwoodShape, top = sheerY(1.5) - .2, ny = 24, nu = 40, rows = [];
  const aftAt = y => y <= D.bottom ? D.aftBottom : D.aftBottom - (D.aftBottom - D.aftTop)*Math.pow(clamp((y - D.bottom)/(D.topY - D.bottom), 0, 1.6), .7);
  for (let j = 0; j <= ny; j++) {
    const f = j/ny, y = lerp(D.bottom, top, Math.pow(f, 1.3)), lift = Math.max(0, 1 - f*ny/2.5), hw = D.halfWidth*Math.sqrt(1 - lift*lift*.85);   // bottom edge rounded
    const xa = aftAt(y), xf = D.fwd, row = [];
    for (let i = 0; i <= nu; i++) {
      const a = i/nu*Math.PI*2, c = Math.cos(a), sn = Math.sin(a);
      // aft half: a semicircle of radius hw; forward: a long taper to the fin
      let x, z;
      if (c <= 0) { x = xa + hw + c*hw; z = sn*hw; }
      else { x = xa + hw + c*(xf - xa - hw); z = sn*hw*Math.pow(1 - c, .35); }
      row.push([x, y, z]);
    }
    rows.push(row);
  }
  grid(G.hull, rows, mat.foil);
  const cap = rows[0].map(p => [p[0], D.bottom, p[2]]), mid = rows[0].map(p => [p[0], D.bottom, 0]);
  grid(G.hull, [cap, mid], mat.foil);
})();
foil(SPEC.keel.skeg, mat.foil);
foil(SPEC.keel.rudder, mat.foil);

/* Propeller shaft: a straight line from the gearbox coupling down to the propeller. */
const shaftLine = (() => {
  const E = SPEC.keel.engine, p = SPEC.keel.prop, t = E.tilt*Math.PI/180, a = (E.tilt + E.gearAngle)*Math.PI/180;
  const cx = E.frontX - E.length*Math.cos(t), cy = p.y + (cx - p.x)*Math.tan(a);
  return { coupling: [cx, cy], tilt: t, angle: a, at: x => [x, p.y + (x - p.x)*Math.tan(a)] };
})();
/* Three-bladed polished brass propeller, turning the other way from the first model (owner) with broad, rounded, slightly skewed blades, a brass boss and a zinc anode cone [P]. */
mat.brass = M('#d9a43c', { roughness: .22, metalness: .9, envMapIntensity: 1.3 });
mat.zinc = M('#b9bec2', { roughness: .45, metalness: .85 });
(function propeller() {
  const p = SPEC.keel.prop, f = shaftLine.at(1.224), R = p.r, pitch = p.pitch, hubR = .042;
  rod(G.hull, [f[0], f[1], 0], [p.x + .06, p.y, 0], .016, mat.steel);
  const prop = new T.Group(); prop.position.set(p.x, p.y, 0); prop.rotation.z = shaftLine.angle; G.hull.add(prop);   // in line with the shaft
  // faired boss round the shaft at the aft end of the deadwood, ending just ahead of the hub, with the cutless bearing
  const SB = SPEC.keel.shaftBoss, x0 = .064 + SB.gap, prof = [[0, x0], [SB.endR*.55, x0], [SB.endR*.75, x0 + .004], [SB.endR, x0 + .02], [SB.r*.97, x0 + .09], [SB.r, x0 + .17], [SB.r*.92, x0 + SB.length*.6], [SB.r*.6, x0 + SB.length*.85], [SB.r*.15, x0 + SB.length], [0, x0 + SB.length]];   // tapers forward into the deadwood
  const boss = put(prop, new T.LatheGeometry(prof.map(([r, u]) => new T.Vector2(r, u)), 32), mat.anti); boss.rotation.z = -Math.PI/2;
  const bearing = put(prop, new T.RingGeometry(.018, SB.endR*.55, 24), mat.dark); bearing.rotation.y = -Math.PI/2; bearing.position.x = x0 - .001;
  // boss and anode along the shaft axis (x), the anode aft
  const lathe = (pts, m) => { const g = new T.LatheGeometry(pts.map(([r, x]) => new T.Vector2(r, x)), 28); const o = put(prop, g, m); o.rotation.z = Math.PI/2; return o; };
  lathe([[.0, -.064], [.034, -.064], [.04, -.05], [hubR, -.02], [hubR, .03], [.036, .05], [.022, .062], [0, .062]].map(([r, x]) => [r, -x]), mat.brass);
  lathe([[0, -.064], [.031, -.064], [.029, -.08], [.022, -.13], [.012, -.13], [.012, -.12], [0, -.12]].map(([r, x]) => [r, -x]), mat.zinc);
  const hole = put(prop, new T.CircleGeometry(.0115, 16), mat.dark); hole.rotation.y = -Math.PI/2; hole.position.x = -.119;
  // blade: chord follows a broad rounded outline; each section lies on the pitch helix and is skewed back towards the tip
  const nr = 24, nc = 16, half = q => { const q0 = .55, cm = .42*R; return q <= q0 ? cm*(.34 + .66*Math.sin(Math.PI/2*q/q0)) : cm*Math.sqrt(Math.max(0, 1 - Math.pow((q - q0)/(1 - q0), 2))); };   // broad paddle with a round tip
  for (let b = 0; b < p.blades; b++) {
    const th0 = b*Math.PI*2/p.blades, top = [], bot = [];
    for (let i = 0; i <= nr; i++) {
      const q = i/nr, rho = lerp(hubR*.9, R, q), c = half(q), skew = .22*q*q, rt = [], rb = [];
      for (let k = 0; k <= nc; k++) {
        const u = -1 + 2*k/nc, a = th0 - skew - u*c/rho, x = -pitch/(2*Math.PI)*(u*c/rho), t = .006*(1 - q*.7)*Math.sqrt(Math.max(0, 1 - u*u));
        const P = (dx) => [x + dx, rho*Math.cos(a), rho*Math.sin(a)];
        rt.push(P(t)); rb.push(P(-t));
      }
      top.push(rt); bot.push(rb);
    }
    grid(prop, top, mat.brass); grid(prop, bot.map(r => r.slice().reverse()), mat.brass);
  }
})();
