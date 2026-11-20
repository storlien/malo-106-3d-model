'use strict';
/* dekk — se deloverskriftene i filen. */

/* =====================================================================
   DEKK — full teakdekke (105 mm planker, malt i tekstur) med 45 mm dekkfall,
   mørk teaklisterail langs rælingen, kryssede livliner i to høyder,
   pulpit forut og pushpit med daviter akter (som på ekte Malöer).
   ===================================================================== */
function deckPatch(x0, x1, z0, z1, m, parent){
  const nx = Math.max(2, Math.ceil((x1-x0)/0.12)), nz = 6, sections = [];
  for (let i = 0; i <= nx; i++){
    const x = x0 + (x1-x0)*i/nx, w = halfWidthAt(x, deckY(x, 0)) - 0.012;
    // klipp begge kanter mot skrogbredden (uansett fortegn på z)
    const cl = v => Math.sign(v)*Math.min(Math.abs(v), w);
    const a = cl(z0), b = cl(z1);
    const sec = [];
    for (let j = 0; j <= nz; j++){
      const z = a + (b-a)*j/nz;
      sec.push([x, deckY(x, z), z]);
    }
    sections.push(sec);
  }
  if (sections.length < 2) return null;
  const g = loft(sections);
  const pos = g.attributes.position, uv = [];
  for (let i = 0; i < pos.count; i++) uv.push(pos.getX(i), pos.getZ(i));   // uv i meter → 105 mm planker med repeat
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  return add(new T.Mesh(g, m), parent);
}
(function buildDeck(){
  const CR = 1.01, CK = 1.175;                       // coachroof- og cockpit-halvbredde
  deckPatch(0.42, 0.85, -3, 3, dmat.teak, boat);      // akterdekk bak cockpit
  for (const s of [1, -1]) deckPatch(0.85, 3.60, s*CK, s*3, dmat.teak, boat);     // sidedekk ved cockpit
  deckPatch(3.60, 4.35, -3, 3, dmat.teak, boat);      // dekk mellom cockpit og coachroof
  for (const s of [1, -1]) deckPatch(4.35, 8.95, s*CR, s*3, dmat.teak, boat);    // sidedekk ved coachroof
  deckPatch(8.95, 11.06, -3, 3, dmat.teak, boat);     // fordekk
})();

/* Teaklisterail (mørk, 55 x 35 mm) langs hele dekkskanten */
(function toeRail(){
  for (const s of [1, -1]){
    const secs = [], n = 96;
    for (let i = 0; i <= n; i++){
      const x = X_DK + (11.02 - X_DK)*i/n;
      const w = halfWidthAt(x, deckY(x, 0)) - 0.012;
      if (w < 0.06) continue;
      const y = deckY(x, s*(w - 0.03));
      secs.push([[x, y - 0.025, s*(w - 0.10)], [x, y + 0.035, s*(w - 0.095)], [x, y + 0.035, s*(w + 0.005)], [x, y - 0.025, s*(w + 0.01)]]);
    }
    add(new T.Mesh(loft(secs), dmat.rail), boat);   // malt i krem, ikke teak
  }
})();

/* Støtter (6 par) med kryssede livliner i to høyder */
(function lifelines(){
  const ST = [1.6, 3.05, 4.5, 8.2, 9.5, 10.3];
  const holes = [];
  ST.forEach(x => {
    const w = halfWidthAt(x, deckY(x, 0)) - 0.012;
    const z = w - 0.085, y = deckY(x, z);
    for (const s of [1, -1]){
      rod([x, y - 0.03, s*z], [x, y + 0.64, s*z], 0.009, dmat.chrome, boat, 8);
      const base = new T.Mesh(new T.CylinderGeometry(0.017, 0.021, 0.02, 12), dmat.chrome);
      base.position.set(x, y + 0.001, s*z); add(base, boat);
    }
    holes.push({ x, y, z });
  });
  const stern = { x: 0.52, y: deckY(0.52, 1.28) }, bowD = deckY(10.42, 0.75);
  for (const s of [1, -1]){
    for (const L of [0.30, 0.60]){
      const pts = [];
      const ends = [
        [stern.x, stern.y + Math.min(L + 0.02, 0.62), s*1.29],
        ...holes.map(h => [h.x, h.y + L, s*h.z]),
        [10.42, bowD + Math.min(L + 0.05, 0.66), s*0.72]
      ];
      for (let i = 0; i < ends.length; i++){
        pts.push(ends[i]);
        if (i < ends.length-1){
          const a = ends[i], b = ends[i+1];
          pts.push([(a[0]+b[0])/2, Math.min(a[1], b[1]) - 0.018, (a[2]+b[2])/2]);   // liten kattlesagging
        }
      }
      tube(pts, 0.0055, dmat.steel, boat);
    }
  }
})();

/* Pulpit forut: krombuet ramme rundt baugen */
(function pulpit(){
  const r = 0.011, dY = x => deckY(x, 0.6);
  const legs = [[10.30, 0.88], [10.62, 0.78]];
  for (const s of [1, -1]) legs.forEach(([x, z]) => rod([x, dY(x) - 0.02, s*z], [x, dY(x) + 0.72, s*(z - 0.06)], r, dmat.steel, boat, 10));
  for (const s of [1, -1]){
    tube([[10.30, dY(10.30) + 0.72, s*0.82], [10.62, dY(10.62) + 0.72, s*0.72],
          [10.80, dY(10.80) + 0.68, s*0.42], [10.87, dY(10.87) + 0.62, s*0.10]], r, dmat.steel, boat);
  }
  tube([[10.87, dY(10.87) + 0.62, -0.10], [10.90, dY(10.90) + 0.60, 0], [10.87, dY(10.87) + 0.62, 0.10]], r, dmat.steel, boat);
})();

/* Pushpit akter med S-formede daviter til gummibåten */
(function pushpit(){
  const r = 0.011, TOP = 1.62;
  const dY = x => deckY(x, 1.25);
  for (const s of [1, -1]){
    rod([0.52, dY(0.52) - 0.02, s*1.28], [0.52, TOP, s*1.29], r, dmat.steel, boat, 10);
    rod([0.86, dY(0.86) - 0.02, s*1.33], [0.86, TOP, s*1.32], r, dmat.steel, boat, 10);
    tube([[0.86, TOP, s*1.32], [0.50, TOP, s*1.30], [0.22, TOP, s*1.06], [0.04, TOP, s*0.60], [0.00, TOP, s*0.12]], r, dmat.steel, boat);
    rod([0.26, 1.10, s*1.14], [0.22, TOP, s*1.06], r, dmat.steel, boat, 10);      // mellomstang
  }
  tube([[0.00, TOP, -0.12], [0.00, TOP, 0], [0.00, TOP, 0.12]], r, dmat.steel, boat);
  // daviter: solide buer fra dekket ved pushpiten, opp og bak over akterspeilet (som på foto)
  const ddY = x => deckY(x, 1.2);
  for (const s of [1, -1]){
    tube([[0.80, ddY(0.80), s*1.22], [0.55, TOP + 0.30, s*1.10],
          [0.05, TOP + 0.80, s*0.78], [-0.40, TOP + 0.85, s*0.50], [-0.60, TOP + 0.78, s*0.38]], 0.02, dmat.chrome, boat);
    rod([0.44, TOP + 0.38, s*1.06], [0.70, ddY(0.70) - 0.02, s*1.26], 0.014, dmat.chrome, boat, 8);   // støtte
  }
})();

/* Fortøyningsgripere (fire) og baugeruller */
(function deckFurniture(){
  const cleat = (x, z) => {
    const y = deckY(x, z);
    box(x-0.065, x+0.065, y-0.005, y+0.028, z-0.028, z+0.028, dmat.chrome, boat);
    rod([x, y+0.03, z-0.075], [x, y+0.055, z+0.075], 0.013, dmat.chrome, boat, 10);
  };
  cleat(1.15, 1.33); cleat(1.15, -1.33);
  cleat(10.05, 0.82); cleat(10.05, -0.82);
  // baugeruller på stevnehodet
  const by = deckY(10.95, 0.2);
  for (const s of [1, -1]) box(10.88, 11.02, by, by + 0.05, s*0.075 - 0.012, s*0.075 + 0.012, dmat.steel, boat);
  rod([10.93, by + 0.075, -0.10], [10.93, by + 0.075, 0.10], 0.028, dmat.dark, boat, 14);
})();
