'use strict';
/* overbygg — se deloverskriftene i filen. */

/* =====================================================================
   COACHROOF — bygd som et sveipt «hus» med kamberet topp og vegger med
   fall innover (slik Abela gjør det): kvartsnitt loftet lengdeskips,
   lukket gavl mot cockpit. Vinduene bøyes langs veggens egen profil
   (marineblå ramme + mørkt glass), hjørneglasset foran vikler rundt
   rufffronten. Sprayhood i marineblått over skyvedøra.
   ===================================================================== */
const CR = { x0: 4.35, x1: 8.95, top: 0.48, hw: 1.01 };
function crHalf(x){
  if (x <= CR.x0 || x >= CR.x1) return 0.001;
  if (x <= 7.55) return CR.hw;
  const f = (x - 7.55)/1.4;
  return Math.max(0.001, CR.hw*Math.sqrt(Math.max(0, 1 - f*f)));
}
function crTopY(x){                       // absolutt topphøyde (følger dekkets stigning)
  if (x <= CR.x0) return 0;
  const base = deckY(x, 0);
  if (x >= CR.x1) return base;
  if (x <= 7.9) return base + CR.top;
  const f = (x - 7.9)/(CR.x1 - 7.9);
  return base + CR.top*(1 - f*f*(3 - 2*f));
}
function crSec(x){
  const w = crHalf(x), yb = deckY(x, w) - 0.02, top = crTopY(x);
  const wt = Math.max(0.001, w - 0.055*Math.min(1, (top - yb)/0.4));   // veggene heller innover
  const top0 = [];
  for (let k = 0; k <= 10; k++){ const z = -wt + 2*wt*k/10; top0.push([x, top + 0.03*(1 - (z/wt)**2), z]); }
  const side = s => [[x, yb, s*w], [x, top - 0.005, s*(wt + 0.012)]];
  return { top: top0, port: side(-1), stbd: side(1), yb, top0: top, w, wt };
}
/* bredde (uten fortegn) på sideveggen ved høyde Y */
function crZWall(X, Y){
  const q = crSec(X), f = Math.max(0, Math.min(1, (Y - q.yb)/(q.top0 - q.yb)));
  return q.w + (q.wt + 0.012 - q.w)*f;
}
/* punkt på sideveggen: f = 0 ved dekk, 1 ved takkant (signert z) */
function crWallPt(x, f, s){
  const q = crSec(x), y = q.yb + (q.top0 - q.yb)*f;
  return new V3(x, y, s*crZWall(x, y));
}

(function buildCoachroof(){
  const xs = [];
  for (let x = CR.x0; x <= CR.x1 + 1e-6; x += 0.05) xs.push(Math.min(x, CR.x1));
  const secs = xs.map(x => Object.assign(crSec(x), { x }));
  add(new T.Mesh(loft(secs.map(s => s.top)), dmat.gel), boat);
  ['port', 'stbd'].forEach(k => { const m = add(new T.Mesh(loft(secs.map(s => s[k])), dmat.gel), boat); m.castShadow = false; });
  const ring = s => [...s.port, ...s.top.slice(1, -1), ...s.stbd.slice().reverse()];
  add(new T.Mesh(capGeom(ring(secs[0])), dmat.gel), boat);   // gavl mot skyvedøra

  /* hjørneglasset foran: mørkt glass-bånd som vikler rundt rufffronten
     langs omrisset (fra 7,7 og frem), med marineblå karm under */
  for (const s of [1, -1]){
    const strip = (f0, f1, off) => {
      const secs = [];
      for (let x = 7.7; x <= CR.x1 - 0.05; x += 0.04){
        const q = crSec(x), y0 = q.yb + (q.top0 - q.yb)*f0, y1 = q.yb + (q.top0 - q.yb)*f1;
        secs.push([[x, y0, s*(crZWall(x, y0) - 0.012 - off)], [x, y1, s*(crZWall(x, y1) - 0.012 - off)]]);
      }
      return secs;
    };
    add(new T.Mesh(loft(strip(0.40, 0.94, 0.014)), dmat.glass), boat);
    add(new T.Mesh(loft(strip(0.36, 0.41, 0.017)), dmat.navy), boat);
  }
})();

/* Vinduer som bøyes etter veggen: avrundet rektangel bygget som stripe
   av kolonner (portert fra Abela), her med marineblå ramme. */
function winStrip(len, h, r){
  const a = len/2, b = h/2, us = [];
  for (let k = 8; k >= 1; k--) us.push(-(a - r) - r*Math.sin(k/8*Math.PI/2));
  const m = Math.max(2, Math.ceil(2*(a - r)/0.04));
  for (let k = 0; k <= m; k++) us.push(-(a - r) + 2*(a - r)*k/m);
  for (let k = 1; k <= 8; k++) us.push((a - r) + r*Math.sin(k/8*Math.PI/2));
  const half = u => { const e = Math.abs(u) - (a - r); return e <= 0 ? b : (b - r) + Math.sqrt(Math.max(0, r*r - e*e)); };
  const pts = [], idx = [];
  us.forEach((u, i) => { pts.push([u, -half(u)], [u, half(u)]);
    if (i){ const p0 = 2*(i-1), p1 = 2*i; idx.push(p0, p1, p1+1, p0, p1+1, p0+1); } });
  return { pts, idx };
}
function sideWindow(len, h, basis, pos, n, s, zWall, frameMat){
  frameMat = frameMat || dmat.navy;
  const R = new T.Matrix3().setFromMatrix4(basis);
  const make = (L, H, r, off, mat) => {
    const { pts, idx } = winStrip(L, H, r), arr = [];
    pts.forEach(([u, v]) => {
      const q = new V3(u, v, 0).applyMatrix3(R).add(pos);
      if (zWall){ const tz = s*(zWall(q.x, q.y) + off); q.addScaledVector(n, (tz - q.z)/n.z); }
      else q.addScaledVector(n, off);
      arr.push(q.x, q.y, q.z);
    });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new T.Mesh(g, mat); boat.add(mesh); return mesh;
  };
  make(len + 0.035, h + 0.035, 0.05, 0.005, frameMat);
  make(len, h, 0.035, 0.009, dmat.glass);
}
/* to sidevinduer per side (hjørneglasset foran er eget bånd) */
(function sideWindows(){
  const rows = [[6.55, 0.78, 0.17, 0.64], [5.3, 0.5, 0.13, 0.58]];
  for (const s of [1, -1]){
    for (const [xc, len, hgt, f] of rows){
      const q = crSec(xc);
      const c = crWallPt(xc, f, s), a = crWallPt(xc - 0.05, f, s), b = crWallPt(xc + 0.05, f, s);
      const along = b.clone().sub(a).normalize();
      const up = new V3(0, q.top0 - q.yb, s*(q.wt + 0.012 - q.w)).normalize();
      let n = new V3().crossVectors(along, up).normalize();
      if (n.z*s < 0) n.negate();
      const yAx = new V3().crossVectors(n, along).normalize();
      sideWindow(len, hgt, new T.Matrix4().makeBasis(along, yAx, n), c, n, s, crZWall);
    }
  }
})();

/* Skyvedøra forut: hvit karm, mørk himling, garasjehus med teak-luke */
(function companionway(){
  const x = CR.x0, deck = deckY(x, 0), q = crSec(x);
  const hw = 0.52, cw = 0.31, top = q.top0;
  box(x - 0.06, x + 0.02, deck - 0.01, top, -hw, -cw, dmat.gel, boat);
  box(x - 0.06, x + 0.02, deck - 0.01, top, cw, hw, dmat.gel, boat);
  box(x - 0.06, x + 0.02, deck - 0.01, deck + 0.13, -cw, cw, dmat.gel, boat);
  box(x - 0.10, x - 0.05, deck + 0.11, top - 0.06, -cw, cw, dmat.port, boat);        // mørk himling
  box(x + 0.02, x + 1.0, top - 0.035, top + 0.055, -cw - 0.05, cw + 0.05, dmat.gel, boat);
  box(x + 0.30, x + 0.92, top + 0.055, top + 0.075, -cw, cw, dmat.port, boat);
  const secs = [];
  for (const xx of [x + 0.04, x + 0.96]){
    const yy = top + (xx < x + 0.4 ? 0.055 : 0.075) + 0.001;
    secs.push([[xx, yy, -cw], [xx, yy, cw]]);
  }
  add(new T.Mesh(loftUV(secs), dmat.teak), boat);   // teak-skyveluke
})();

/* Luker: stålramme + mørkt lokk (som på foto), takluker og dekkluke */
(function hatches(){
  function hatch(x, zc, hl, hw, y){
    box(x - hl - 0.03, x + hl + 0.03, y, y + 0.035, zc - hw - 0.03, zc + hw + 0.03, dmat.steel, boat);
    box(x - hl, x + hl, y + 0.035, y + 0.058, zc - hw, zc + hw, dmat.port, boat);
  }
  hatch(5.75, 0, 0.30, 0.25, crTopY(5.75) + 0.045);
  hatch(6.95, -0.30, 0.27, 0.23, crTopY(6.95) + 0.05);
  hatch(9.35, 0, 0.30, 0.25, deckY(9.35, 0) + 0.008);       // dekkluke forut
  /* ankerkisteteke i baugen */
  const g = rrectGeom(0.56, 0.48); g.rotateX(-Math.PI/2);
  const lid = new T.Mesh(g, dmat.teak); lid.position.set(10.0, deckY(10.0, 0) + 0.012, 0); add(lid, boat);
  box(9.72, 9.74, deckY(9.73, 0.22) + 0.0, deckY(9.73, 0.22) + 0.03, -0.21, 0.21, dmat.chrome, boat);
})();

/* Håndrekker i teak på rufftaket, med støtter */
(function handrails(){
  for (const s of [1, -1]){
    const zAt = x => s*(crHalf(x) - 0.22);
    const yAt = x => crTopY(x) + 0.03*(1 - (zAt(x)/crHalf(x))**2) + 0.045;
    const pts = [];
    for (let x = 4.75; x <= 7.45; x += 0.25) pts.push([x, yAt(x), zAt(x)]);
    tube(pts, 0.017, dmat.teakP, boat);
    for (const fx of [4.85, 6.1, 7.35]){
      rod([fx, crTopY(fx) + 0.035, zAt(fx)], [fx, yAt(fx) - 0.005, zAt(fx)], 0.012, dmat.teakP, boat, 8);
    }
  }
})();

/* Sprayhood i marineblått over skyvedøra, med krombøyle i front */
(function sprayhood(){
  const pts = [
    [3.20, 0.55, 1.30], [3.80, 0.80, 1.58], [4.60, 0.95, 1.85],
    [5.20, 0.95, 1.99], [5.85, 0.92, 1.55]
  ];
  const yAt = (x, z) => {   // canvas-høyde: boksform over bredden
    let i = 0; while (i < pts.length-2 && x > pts[i+1][0]) i++;
    const a = pts[i], b = pts[i+1], f = Math.min(1, Math.max(0, (x-a[0])/(b[0]-a[0])));
    const top = a[2] + (b[2]-a[2])*f, w = a[1] + (b[1]-a[1])*f;
    const edge = deckY(x, w*0.9) + 0.10;
    return { top, w, edge, y: edge + (top - edge)*Math.pow(Math.max(0, 1 - (z/w)**2), 0.38) };
  };
  const sections = [], n = 26;
  for (let i = 0; i <= n; i++){
    const x = 3.2 + (5.85-3.2)*i/n, sec = [];
    for (let j = 0; j <= 10; j++){
      const z = -0.95 + 1.9*j/10;
      const s = yAt(Math.max(3.2, Math.min(5.85, x)), Math.abs(z)*0.98);
      if (Math.abs(z) <= s.w) sec.push([x, s.y, z]); else sec.push([x, s.edge, Math.sign(z)*s.w]);
    }
    sections.push(sec);
  }
  add(new T.Mesh(loft(sections), dmat.navy), boat);
  /* krombøyler som holder duken oppe */
  for (const hx of [3.55, 5.0]){
    const s = yAt(hx, 0);
    tube([[hx, s.edge + 0.02, -s.w*0.92], [hx, s.y*0.99 - 0.02, -s.w*0.55], [hx, s.y, 0],
          [hx, s.y*0.99 - 0.02, s.w*0.55], [hx, s.edge + 0.02, s.w*0.92]], 0.011, dmat.chrome, boat);
  }
  /* krokbeslag ned til dekket akter */
  for (const s of [1, -1]){
    rod([3.22, yAt(3.3, 0.7).y - 0.06, s*0.62], [3.30, deckY(3.30, 0.75) + 0.02, s*0.72], 0.008, dmat.chrome, boat, 8);
  }
})();
