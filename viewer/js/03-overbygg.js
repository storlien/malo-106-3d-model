'use strict';
/* overbygg — se deloverskriftene i filen. */

/* =====================================================================
   COACHROOF / DOGHOUSE — lav og strømlinjeformet (480 mm over dekkskant),
   med de tre høye sidevinduene (marineblå ramme, mørkt glass, litt stolt av
   veggen), krumbuet vindskjerm forut, skyveluke og sprayhood i marineblått.
   ===================================================================== */
const CR = { x0: 4.35, x1: 8.9, hw: 1.01, top: 0.48 };
function crTopH(x){
  if (x < CR.x0 || x > CR.x1) return 0;
  if (x < 5.0) return CR.top * smq((x - CR.x0)/0.55);
  if (x <= 7.4) return CR.top;
  return CR.top * (1 - smq((x - 7.4)/1.5));
}
/* vegg/skulder-profil: f = 0 ved dekk, 1 på tak */
const CR_SEC = [[0,1.01],[0.30,0.995],[0.62,0.94],[0.88,0.85],[1,0.74]];
function crZ(f){ return interp(CR_SEC, f); }
function crPt(x, f){
  const h = crTopH(x), deck = deckY(x, 0.95);
  return [x, deck + h*f, crZ(f)];
}
function crPatch(x0, x1, f0, f1, off, m){
  const sections = [], n = Math.max(2, Math.ceil((x1-x0)/0.1));
  for (let i = 0; i <= n; i++){
    const x = x0 + (x1-x0)*i/n, sec = [];
    for (let j = 0; j <= 6; j++) sec.push([x, crPt(x, f0 + (f1-f0)*j/6)[1], crPt(x, f0 + (f1-f0)*j/6)[2] + off]);
    sections.push(sec);
  }
  return add(new T.Mesh(loft(sections), m), boat);
}
(function buildCoachroof(){
  /* selve doghouse-kroppen: speilet tverrsnitt loftet lengdeskips */
  const sections = [], n = 34;
  for (let i = 0; i <= n; i++){
    const x = CR.x0 + (CR.x1-CR.x0)*i/n, sec = [];
    for (const s of [1, -1]){
      const h = crTopH(x), deck = deckY(x, 0.99);
      const pts = [
        [CR.hw, deck - 0.008],
        [CR.hw - 0.02, deck + 0.30*h], [crZ(0.62), deck + 0.62*h],
        [crZ(0.88), deck + 0.88*h], [crZ(1), deck + h],
        [0.55, deck + h + 0.012], [0, deck + h + 0.02]
      ];
      pts.forEach(p => sec.push([x, p[1], s*p[0]]));
    }
    sec.reverse();                       // kontinuerlig fra styrbord til babord
    sections.push(sec.filter((p, i, a) => i === 0 || Math.hypot(p[1]-a[i-1][1], p[2]-a[i-1][2]) > 1e-6));
  }
  add(new T.Mesh(loft(sections), dmat.gel), boat);

  /* de tre sidevinduene: marineblå ramme + mørkt glass, fulgt langs veggen */
  const rows = [[4.9, 5.6], [6.0, 6.8], [7.25, 8.38]];
  for (const s of [1, -1]){
    for (const [x0, x1] of rows){
      crPatch(x0, x1, 0.46, 1.0, s*0.012, dmat.navy);
      crPatch(x0+0.035, x1-0.035, 0.50, 0.955, s*0.024, dmat.glass);
    }
  }

  /* vindskjermen: krumbuet glass rundt doghouse-fronten */
  (function windshield(){
    const cols = [];
    for (let i = 0; i <= 16; i++){
      const f = i/16, zc = -0.78 + 1.56*f;
      const x = 8.42 + 0.30*Math.sin(Math.PI*f);
      const h = crTopH(x), deck = deckY(x, 0.7);
      cols.push([[x, deck + h + 0.012, zc], [x, deck + h*0.40 + 0.02, zc]]);
    }
    const g = loft(cols);
    add(new T.Mesh(g, dmat.glass), boat);
    const topEdge = cols.map(c => [c[0][0], c[0][1], c[0][2]]);
    tube(topEdge, 0.009, dmat.chrome, boat);
  })();

  /* fremside med skyvedørspor, mørk himling og teak-skyveluke */
  (function companionway(){
    const deck = deckY(CR.x0, 0.5), y = deck;
    const hw = 0.52, cw = 0.31;
    box(CR.x0 - 0.06, CR.x0, y, y + 0.50, -hw, -cw, dmat.gel, boat);
    box(CR.x0 - 0.06, CR.x0, y, y + 0.50, cw, hw, dmat.gel, boat);
    box(CR.x0 - 0.06, CR.x0, y, y + 0.13, -cw, cw, dmat.gel, boat);
    box(CR.x0 - 0.10, CR.x0 - 0.05, y + 0.11, y + 0.50, -cw, cw, dmat.port, boat);   // mørk himling
    // teak-skyveluke i sporet opp på doghouse-taket
    const secs = [];
    for (const xx of [4.38, 5.32]){
      const yy = deckY(xx, 0.4) + 0.505 + (xx < 4.7 ? 0.0 : 0.005);
      secs.push([[xx, yy, -cw], [xx, yy, cw]]);
    }
    add(new T.Mesh(loft(secs), dmat.teak), boat);
    box(4.36, 4.40, deck + 0.49, deck + 0.545, -cw - 0.03, cw + 0.03, dmat.gel, boat);   // listverk
  })();

  /* håndrekker i teak på taket */
  for (const s of [1, -1]){
    tube([[5.0, crPt(5.0, 1)[1] + 0.045, s*0.74], [5.3, crPt(5.3, 1)[1] + 0.045, s*0.72],
          [7.6, crPt(7.6, 1)[1] + 0.045, s*0.72], [7.9, crPt(7.9, 1)[1] + 0.045, s*0.74]], 0.017, dmat.teakP, boat);
    for (const fx of [5.15, 7.75]) rod([fx, crPt(fx, 1)[1] + 0.01, s*0.73], [fx, crPt(fx, 1)[1] + 0.05, s*0.73], 0.012, dmat.teakP, boat, 8);
  }
})();

/* Luker: tre hvite takluker på doghouse, dekkluke + fortøyningslukke forut */
(function hatches(){
  function hatch(x, zc, hl, hw, y, lidMat){
    const g1 = rrectGeom(2*hl, 2*hw); g1.rotateX(-Math.PI/2);
    const f1 = new T.Mesh(g1, dmat.mast); f1.position.set(x, y + 0.012, zc); add(f1, boat);
    const g2 = rrectGeom(2*hl - 0.07, 2*hw - 0.06); g2.rotateX(-Math.PI/2);
    const f2 = new T.Mesh(g2, lidMat || dmat.hatch); f2.position.set(x, y + 0.026, zc); add(f2, boat);
  }
  const topY = (x, zc) => deckY(x, Math.abs(zc)) + crTopH(x) + 0.02;
  hatch(5.10, 0, 0.31, 0.26, topY(5.10, 0));
  hatch(6.30, -0.32, 0.28, 0.24, topY(6.30, -0.32));
  hatch(7.30, 0, 0.33, 0.26, topY(7.30, 0));
  hatch(9.20, 0, 0.30, 0.25, deckY(9.20, 0) + 0.008);
  /* ankerkisteteke i baugen */
  const g = rrectGeom(0.56, 0.48); g.rotateX(-Math.PI/2);
  const lid = new T.Mesh(g, dmat.teak); lid.position.set(10.0, deckY(10.0, 0) + 0.012, 0); add(lid, boat);
  box(9.72, 9.74, deckY(9.73, 0.22) + 0.0, deckY(9.73, 0.22) + 0.03, -0.21, 0.21, dmat.chrome, boat);
})();

/* Sprayhood i marineblått over skyvedøra, med krombøyle i front */
(function sprayhood(){
  const pts = [
    [3.20, 0.55, 1.30], [3.80, 0.80, 1.58], [4.60, 0.95, 1.85],
    [5.20, 0.95, 1.99], [5.85, 0.92, 1.55]
  ];
  const yAt = (x, z) => {   // canvas-høyde: kuppform over bredden
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
