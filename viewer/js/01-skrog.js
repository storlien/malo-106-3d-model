'use strict';
/* skrog — se deloverskriftene i filen. */

/* =====================================================================
   SKROGFORM — Malö 36 (meter; x = 0 ved akterspeilets underkant, baug
   ved X_BOW; y = 0 er vannlinjen; z = halvbredde mot styrbord).
   Tabellene er Malö 36 sine linjer: Lål 11,20 m (negativ akter),
   bredde 3,35 m, dypgang 1,58 m, fribord akter/midtskips/før 0,96/1,08/1,38.
   Negativ akter: akterspeilets underkant rager lengst akterover (x=0),
   dekkskanten ligger X_DK lengre fremme — som på ekte Malöer.
   ===================================================================== */
const X_DK = 0.42, X_BOW = 11.2, OX = -5.6;   // dekkskant akter, baugspiss, sentrering
const RAKE = 0.54, TC = 0.05;                 // akterspeilets helling fremover + bul i plan
const TB = [[0,1.375],[0.7,1.46],[1.8,1.57],[3.2,1.655],[4.6,1.675],[5.6,1.675],[6.6,1.65],[7.8,1.58],[8.9,1.46],[9.8,1.28],[10.5,1.02],[11.0,0.7],[11.2,0.0]];   // halvbredde i dekkskant
const TS = [[0,0.955],[0.9,0.965],[2.2,0.99],[3.6,1.02],[5.2,1.07],[6.8,1.115],[8.2,1.16],[9.3,1.22],[10.2,1.29],[10.9,1.345],[11.2,1.38]];                         // dekkslinje (fribord)
const TK = [[0,0.18],[0.6,0.02],[1.3,-0.22],[2.2,-0.36],[3.2,-0.43],[4.2,-0.46],[5.5,-0.48],[6.8,-0.44],[7.8,-0.36],[8.6,-0.26],[9.3,-0.12],[9.9,0.02],[10.35,0.16],[10.75,0.42],[11.0,0.78],[11.1,1.1],[11.2,1.38]];   // kanobunn + stevneprofil
const TP = [[0,0.55],[3,0.45],[6,0.38],[8,0.42],[9.5,0.55],[10.6,0.85],[11.2,1.6]];               // flare
const TQ = [[0,1.9],[4,2.1],[6,2.2],[8,2.0],[9.5,1.8],[10.4,1.6],[11.2,1.7]];                     // tverrsnittsform

function interp(tb, x){
  const n = tb.length;
  if (x <= tb[0][0]) return tb[0][1];
  if (x >= tb[n-1][0]) return tb[n-1][1];
  let i = 0; while (x > tb[i+1][0]) i++;
  const p0 = tb[Math.max(i-1,0)], p1 = tb[i], p2 = tb[i+1], p3 = tb[Math.min(i+2,n-1)];
  const dx = p2[0]-p1[0], t = (x-p1[0])/dx, t2 = t*t, t3 = t2*t;
  const m1 = (p2[1]-p0[1])/(p2[0]-p0[0])*dx;
  const m2 = (p3[1]-p1[1])/(p3[0]-p1[0])*dx;
  return (2*t3-3*t2+1)*p1[1] + (t3-2*t2+t)*m1 + (-2*t3+3*t2)*p2[1] + (t3-t2)*m2;
}
function hullParams(x){ return { B:interp(TB,x), S:interp(TS,x), K:interp(TK,x), p:interp(TP,x), q:interp(TQ,x) }; }
/* Stevnen: hvor langt forut skroget når i hver høyde (24° stevnraking), og en
   innsnevring som gjør baugen skarp i overgangen til dekk. */
const STEM_T = (() => { const o = []; for (let i = 0; i <= 200; i++){ const y = -0.6 + 2.0*i/200; let a = 7.5, b = X_BOW;
  for (let k = 0; k < 40; k++){ const m = (a+b)/2; if (interp(TK,m) < y) a = m; else b = m; } o.push((a+b)/2); } return o; })();
function stemXAt(y){ const f = (y + 0.6)/2.0*200; if (f <= 0) return STEM_T[0]; if (f >= 200) return STEM_T[200]; const i = Math.floor(f), t = f - i; return STEM_T[i]*(1-t) + STEM_T[i+1]*t; }
const smq = v => { const t = Math.min(1, Math.max(0, v)); return t*t*(3-2*t); };
function stemTaper(x, y, S){
  const d = stemXAt(y) - x; if (d > 2.5) return 1;
  return 1 - 0.85*smq((y + 0.05)/0.25)*smq((S - y)/0.35)*Math.exp(-Math.max(0, d)/0.3);
}
/* Tverrsnitt: t = 0 ved kjøllinjen, t = ±1 ved dekkskant */
function hullPt(x, t){
  const h = hullParams(x), th = Math.abs(t)*Math.PI/2;
  const y = h.S - (h.S-h.K)*Math.pow(Math.cos(th), h.q);
  const w = h.B*Math.pow(Math.sin(th), h.p)*stemTaper(x, y, h.S);
  return [x, y, Math.sign(t)*w];
}
const xTr = y => X_DK - Math.max(0, interp(TS, X_DK) - y)*RAKE;   // akterspeilets kant i hver høyde
function hullWidth0(x, y){
  const h = hullParams(x);
  if (y <= h.K) return 0;
  if (y >= h.S) return h.B;
  const c = Math.pow((h.S-y)/(h.S-h.K), 1/h.q);
  return h.B*Math.pow(Math.sin(Math.acos(Math.min(1,c))), h.p)*stemTaper(x, y, h.S);
}
function halfWidthAt(x, y){
  if (x < 0 || x > X_BOW) return 0;
  const dTr = x - xTr(y);
  if (dTr <= 0) return 0;
  return Math.min(hullWidth0(x, y), Math.sqrt(dTr/TC));
}
/* Dekket har 70 mm fall mot rælingen og smyger ned mot akterspeilet */
const deckY = (x, z) => {
  const h = hullParams(x), f = Math.min(1, Math.max(0, (x - X_DK)/0.45)), c = 0.07*f*f*(3-2*f);
  return h.S + (h.B > 0.01 ? c*(1-Math.min(1,(z/h.B)**2)) : 0);
};

/* ---------- Teksturer ---------- */
function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function plankTexture(opts){
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'), r = rng(opts.seed), n = 8, ph = 512/n;
  for (let i = 0; i < n; i++){
    const l = opts.light + (r()-0.5)*opts.vary;
    g.fillStyle = `hsl(${opts.hue},${opts.sat}%,${l}%)`;
    g.fillRect(0, i*ph, 512, ph);
    for (let k = 0; k < 26; k++){
      g.strokeStyle = `rgba(40,20,8,${0.05+r()*0.07})`; g.lineWidth = 1 + r()*1.4;
      const y0 = i*ph + 4 + r()*(ph-8), a = r()*3;
      g.beginPath(); g.moveTo(0, y0);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y0 + Math.sin(x*0.012 + a)*2.2);
      g.stroke();
    }
    const bx = r()*512;
    g.fillStyle = opts.seam; g.fillRect(bx, i*ph, 2, ph);
  }
  g.fillStyle = opts.seam;
  for (let i = 0; i < n; i++) g.fillRect(0, i*ph - opts.seamW/2, 512, opts.seamW);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.repeat.set(opts.rx, opts.ry);
  return t;
}
/* 105 mm teakplanker (8 planker per flis) */
const teakTex = plankTexture({ seed:7, hue:31, sat:42, light:45, vary:7, seam:'rgba(28,22,16,.9)', seamW:5, rx:1.19, ry:1.19 });

/* Tekst i skråskrift (navnet på akterspeilet) */
const SCRIPT = '"Pinyon Script", "Snell Roundhand", "Segoe Script", "Apple Chancery", Georgia, serif';
function textTexture(text, w, h, color, px, baseFrac){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const draw = () => {
    const g = c.getContext('2d'); g.clearRect(0,0,w,h);
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = baseFrac ? 'alphabetic' : 'middle';
    let size = px;
    g.font = `${size}px ${SCRIPT}`;
    const m = g.measureText(text).width;
    if (m > w*0.94){ size *= w*0.94/m; g.font = `${size}px ${SCRIPT}`; }
    g.fillText(text, w/2, h*(baseFrac || 0.56));
    t.needsUpdate = true;
  };
  draw();
  if (document.fonts && document.fonts.load){
    document.fonts.load(`${px}px "Pinyon Script"`).then(() => { draw(); kick(true); }).catch(() => {});
  }
  return t;
}
function radialAlpha(){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128,128,0,128,128,128);
  gr.addColorStop(0,'#fff'); gr.addColorStop(0.32,'#fff'); gr.addColorStop(1,'#000');
  g.fillStyle = gr; g.fillRect(0,0,256,256);
  return new T.CanvasTexture(c);
}

/* ---------- Materialer ---------- */
const clipOpts = { clippingPlanes:[clip], clipShadows:true };
const MI = (hex, o) => new T.MeshStandardMaterial(Object.assign({ color:C(hex), roughness:0.6, metalness:0, envMapIntensity:0.7 }, clipOpts, o||{}));
const MD = (hex, o) => new T.MeshStandardMaterial(Object.assign({ color:C(hex), roughness:0.6, metalness:0, side:T.DoubleSide }, o||{}));
const mat = {
  anti:   MI('#214785', { roughness:0.7, side:T.DoubleSide }),   // blå bunnstoff
  steel:  MI('#cfd5da', { roughness:0.2, metalness:0.85 }),
  zinc:   MI('#8f9599', { roughness:0.6, metalness:0.3 }),
  bronze: MI('#b8874c', { roughness:0.3, metalness:0.85, side:T.DoubleSide }),
  dark:   MI('#25292f', { roughness:0.45 }),
};
const dmat = {
  teak:    MD('#ffffff', { map:teakTex, roughness:0.8 }),
  teakP:   MD('#704f2b', { roughness:0.7 }),
  gel:     MD('#ede5cc', { roughness:0.22 }),                     // kremgelcoat
  port:    MD('#1a1f29', { roughness:0.12, metalness:0.3 }),
  glass:   MD('#2a3a46', { roughness:0.05, metalness:0.3, transparent:true, opacity:0.5, depthWrite:false }),
  canvas:  MD('#dcddd6', { roughness:0.95 }),
  navy:    MD('#0f1742', { roughness:0.9 }),                      // sprayhood, vinduer, puter
  steel:   MD('#e2e6ea', { roughness:0.14, metalness:0.85 }),
  chrome:  MD('#eef1f4', { roughness:0.08, metalness:0.95 }),
  dark:    MD('#262a31', { roughness:0.5 }),
  mast:    MD('#f0f0ed', { roughness:0.35, metalness:0.3 }),      // hvitmalt rigg
  sail:    MD('#f2f1ec', { roughness:0.85 }),
  cushion: MD('#1d2840', { roughness:0.92 }),
  varnish: MD('#5e2610', { roughness:0.22, envMapIntensity:0.8 }),
  screen:  MD('#25313c', { roughness:0.08, metalness:0.3 }),
  black:   MD('#16181b', { roughness:0.45 }),
  drum:    MD('#a6abb0', { roughness:0.85, metalness:0.55 }),
};
const lineMat = new T.LineBasicMaterial({ color:C('#4a515b'), transparent:true, opacity:0.85 });

/* ---------- Geometrihjelpere ---------- */
function add(m, parent){ m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
function loft(sections){
  const M = sections[0].length, pos = [], idx = [];
  sections.forEach(s => s.forEach(p => pos.push(p[0],p[1],p[2])));
  for (let i = 0; i < sections.length-1; i++) for (let j = 0; j < M-1; j++){
    const a = i*M+j, b = a+1, c = a+M, d = c+1; idx.push(a,c,b, b,c,d);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function capGeom(sec){
  const pos = [], idx = []; let cx = 0, cy = 0, cz = 0;
  sec.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; });
  pos.push(cx/sec.length, cy/sec.length, cz/sec.length);
  sec.forEach(p => pos.push(p[0],p[1],p[2]));
  for (let j = 0; j < sec.length; j++) idx.push(0, 1+j, 1+((j+1)%sec.length));
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
/* Plate som følger skroget: rektangel i plan, klippet mot skrogbredden */
function slabGeom(x0, x1, z0, z1, yb, yt, hb){
  if (hb === undefined) hb = yb;
  const n = Math.max(2, Math.ceil((x1-x0)/0.05)), st = [], pt = [];
  for (let i = 0; i <= n; i++){
    const x = x0 + (x1-x0)*i/n, w = halfWidthAt(x, hb) - 0.02;
    const zs = Math.min(z1, w), zp = Math.max(z0, -w);
    if (zs - zp > 0.015){ st.push([x,zs]); pt.push([x,zp]); }
  }
  if (st.length < 2) return null;
  const pts = st.map(p => new V2(p[0], -p[1]));
  for (let i = pt.length-1; i >= 0; i--) pts.push(new V2(pt[i][0], -pt[i][1]));
  const g = new T.ExtrudeGeometry(new T.Shape(pts), { depth:yt-yb, bevelEnabled:false, curveSegments:1 });
  g.rotateX(-Math.PI/2); g.translate(0, yb, 0);
  return g;
}
/* Tverrskott som følger skrogets tverrsnitt (til interiør senere) */
function bulkGeom(x, z0, z1, yb, yt, th){
  th = th || 0.035;
  const n = 32, R = [], L = [];
  for (let i = 0; i <= n; i++){
    const y = yb + (yt-yb)*i/n;
    const w = Math.min(halfWidthAt(x-th/2, y), halfWidthAt(x+th/2, y)) - 0.03;
    const zs = Math.min(z1, w), zp = Math.max(z0, -w);
    if (zs - zp > 0.015){ R.push([zs,y]); L.push([zp,y]); }
  }
  if (R.length < 2) return null;
  const pts = R.map(p => new V2(-p[0], p[1]));
  for (let i = L.length-1; i >= 0; i--) pts.push(new V2(-L[i][0], L[i][1]));
  const g = new T.ExtrudeGeometry(new T.Shape(pts), { depth:th, bevelEnabled:false, curveSegments:1 });
  g.rotateY(Math.PI/2); g.translate(x-th/2, 0, 0);
  return g;
}
function box(x0,x1,y0,y1,z0,z1,m,parent){
  const b = new T.Mesh(new T.BoxGeometry(x1-x0, y1-y0, z1-z0), m);
  b.position.set((x0+x1)/2, (y0+y1)/2, (z0+z1)/2);
  return add(b, parent);
}
function rod(a, b, r, m, parent, seg){
  const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = d.length();
  const c = new T.Mesh(new T.CylinderGeometry(r, r, len, seg||10), m);
  c.position.copy(A).addScaledVector(d, 0.5);
  c.quaternion.setFromUnitVectors(new V3(0,1,0), d.normalize());
  return add(c, parent);
}
function beam(a, b, w, h, m, parent){
  const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = d.length();
  const c = new T.Mesh(new T.BoxGeometry(len, h, w), m);
  c.position.copy(A).addScaledVector(d, 0.5);
  c.quaternion.setFromUnitVectors(new V3(1,0,0), d.normalize());
  return add(c, parent);
}
function taperRod(a, b, r0, r1, m, parent){
  const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = d.length();
  const c = new T.Mesh(new T.CylinderGeometry(r1, r0, len, 14), m);
  c.position.copy(A).addScaledVector(d, 0.5);
  c.quaternion.setFromUnitVectors(new V3(0,1,0), d.normalize());
  return add(c, parent);
}
function tube(points, r, m, parent){
  const curve = new T.CatmullRomCurve3(points.map(p => new V3(...p)), false, 'centripetal');
  return add(new T.Mesh(new T.TubeGeometry(curve, points.length*10, r, 8, false), m), parent);
}
function rrectGeom(len, h){
  const s = new T.Shape(), r = h/2;
  s.moveTo(-len/2+r, -h/2); s.lineTo(len/2-r, -h/2);
  s.absarc(len/2-r, 0, r, -Math.PI/2, Math.PI/2, false);
  s.lineTo(-len/2+r, h/2);
  s.absarc(-len/2+r, 0, r, Math.PI/2, Math.PI*1.5, false);
  return new T.ShapeGeometry(s, 8);
}
/* ---------- Båten ---------- */
const heelPivot = new T.Group(); heelPivot.rotation.order = 'YXZ'; scene.add(heelPivot);
const boat = new T.Group(); boat.position.set(OX, 0, 0); heelPivot.add(boat);

/* Skrog med stripene, boot top og bunnstoff malt i shaderen (skarpe linjer i alle zoomer) */
function tStart(t){ let x = 0.2; for (let k = 0; k < 30; k++){ const p = hullPt(x, t); x = Math.max(0, xTr(p[1]) + TC*p[2]*p[2]); } return x; }
function secNormalIn(x, t){                       // innoverpekende normal i tverrsnittet [y, z]
  const e = 0.002, a = hullPt(x, Math.max(-1, t-e)), b = hullPt(x, Math.min(1, t+e));
  const dy = b[1]-a[1], dz = b[2]-a[2], L = Math.hypot(dy, dz) || 1;
  return [dz/L, -dy/L];
}
const FR = 0.055, NF = 7;                           // radius på den avrundede akterkanten
function filletPt(x0, t, phi){
  const d = FR*(1-Math.cos(phi)), inset = FR*(1-Math.sin(phi)), p = hullPt(x0+d, t), n = secNormalIn(x0+d, t);
  return [x0+d, p[1]+n[0]*inset, p[2]+n[1]*inset];
}
const transomX = (y, z) => xTr(y) + TC*z*z;
function buildHull(){
  const NU = 260, NV = 44, M = 2*NV+1, pos = [], sh = [], idx = [], starts = [];
  for (let j = 0; j < M; j++) starts.push(tStart((j-NV)/NV));
  for (let i = 0; i <= NU; i++) for (let j = 0; j < M; j++){
    const t = (j-NV)/NV, x0 = starts[j];
    let p;
    if (i <= NF) p = filletPt(x0, t, Math.PI/2*i/NF);
    else { const x = x0 + FR + (X_BOW-x0-FR)*(i-NF)/(NU-NF); p = hullPt(x, t); }
    pos.push(p[0],p[1],p[2]); sh.push(interp(TS,p[0])-p[1]);
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < M-1; j++){
    const a = i*M+j, b = a+1, c = a+M, d = c+1; idx.push(a,c,b, b,c,d);
  }
  // akterspeilet: hellende (negativ akter) og buet i plan; rader tettes opp for jevn oppløsning
  const base = pos.length/3, NC = 90, tIdx = [], rows = [];
  for (let k = 0; k <= NV; k++){ const p = filletPt(starts[k], (k-NV)/NV, 0); rows.push({ x:p[0], y:p[1], w:Math.abs(p[2]) }); }
  const sub = [];
  for (let k = 0; k < NV; k++){
    const a = rows[k], b = rows[k+1], n = Math.max(1, Math.ceil(Math.abs(a.y - b.y)/0.018));
    for (let i = 0; i < n; i++){ const f = i/n; sub.push({ x:a.x+(b.x-a.x)*f, y:a.y+(b.y-a.y)*f, w:a.w+(b.w-b.w)*f }); }
  }
  sub.push(rows[NV]);
  sub.forEach(r => {
    for (let c = 0; c <= NC; c++){
      const z = -r.w + 2*r.w*c/NC, x = (c === 0 || c === NC) ? r.x : transomX(r.y, z);
      pos.push(x, r.y, z); sh.push(interp(TS,x)-r.y);
    }
  });
  for (let k = 0; k < sub.length-1; k++) for (let c = 0; c < NC; c++){
    const a = base + k*(NC+1) + c, b = a+1, cc = a+NC+1, d = cc+1; tIdx.push(a,b,cc, b,d,cc);
  }
  // sørg for at akterspeilets utsiden peker akterover
  const P = i => new V3(pos[3*i], pos[3*i+1], pos[3*i+2]);
  const mid = base + 1*(NC+1) + NC/2;
  const nrm = new V3().crossVectors(P(mid+1).sub(P(mid)), P(mid+NC+1).sub(P(mid)));
  if (nrm.x > 0) for (let i = 0; i < tIdx.length; i += 3){ const t = tIdx[i+1]; tIdx[i+1] = tIdx[i+2]; tIdx[i+2] = t; }
  idx.push(...tIdx);

  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos,3));
  g.setAttribute('aSheer', new T.Float32BufferAttribute(sh,1));
  g.setIndex(idx); g.computeVertexNormals();
  return add(new T.Mesh(g, makeHullMat()), boat);
}
buildHull();

/* Skrogmaterialet: krem med marineblå striper (fra eierens malingsplan), boot top
   på vannlinjen og blå bunnstoff — alt i fragment-shaderen, med avstand under
   dekkskanten (vSheer) og høyde over vannlinjen (vH) som varying-er. */
function makeHullMat(){
  const m = new T.MeshStandardMaterial(Object.assign({ color:0xffffff, roughness:0.17, metalness:0, side:T.DoubleSide }, clipOpts));
  m.customProgramCacheKey = () => 'alizee-hull-v1';
  m.onBeforeCompile = sh => {
    sh.uniforms.uCream = { value:C('#ede5cc') };
    sh.uniforms.uNavy  = { value:C('#0f1742') };
    sh.uniforms.uAnti  = { value:C('#214785') };
    sh.uniforms.uInner = { value:C('#e7dfcf') };
    sh.vertexShader = 'attribute float aSheer;\nvarying float vSheer;\nvarying float vH;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSheer = aSheer; vH = position.y;');
    sh.fragmentShader = 'uniform vec3 uCream;\nuniform vec3 uNavy;\nuniform vec3 uAnti;\nuniform vec3 uInner;\nvarying float vSheer;\nvarying float vH;\n' +
      sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 hc = uCream;
        float e = 0.0045;
        hc = mix(hc, uAnti, 1.0 - smoothstep(-0.06-e, -0.06+e, vH));            // blå bunnstoff
        float boot = smoothstep(-0.06-e, -0.06+e, vH) * (1.0 - smoothstep(0.13-e, 0.13+e, vH));
        hc = mix(hc, uNavy, boot);                                              // boot top over vannlinjen
        float st1 = smoothstep(0.04-e, 0.04+e, vSheer) * (1.0 - smoothstep(0.125-e, 0.125+e, vSheer));
        hc = mix(hc, uNavy, st1);                                               // bred stripe under rælingen
        float st2 = smoothstep(0.19-e, 0.19+e, vSheer) * (1.0 - smoothstep(0.235-e, 0.235+e, vSheer));
        hc = mix(hc, uNavy, st2);                                               // tynn nedre stripe
        if (!gl_FrontFacing) hc = uInner;
        diffuseColor.rgb = hc;`);
  };
  return m;
}

/* Navnet i skråskrift på akterspeilet, bøyd langs plata */
(function transomName(){
  const tex = textTexture('Alizée', 512, 176, '#0f1742', 140);
  const NX = 16, NY = 3, W = 1.5, H = 0.44, Y0 = 0.64;
  const g = new T.BufferGeometry(), pos = [], uv = [], idx = [];
  for (let iy = 0; iy <= NY; iy++){
    const fy = iy/NY, y = Y0 + (fy - 0.5)*H;
    for (let ix = 0; ix <= NX; ix++){
      const fx = ix/NX, z = (fx - 0.5)*W;
      pos.push(xTr(y) + TC*z*z - 0.006, y, z);
      uv.push(1 - fx, 1 - fy);   // speiles: sett bakfra peker +z mot venstre
    }
  }
  for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++){
    const a = iy*(NX+1)+ix, b = a+1, c = a+NX+1, d = c+1;
    idx.push(a,b,c, b,d,c);
  }
  g.setAttribute('position', new T.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new T.Mesh(g, new T.MeshStandardMaterial({ map:tex, transparent:true, roughness:0.45, metalness:0 }));
  m.castShadow = false; boat.add(m);
})();

/* Kjøl, skjegg og ror som profilerte finner (NACA-form, tykkelse pr. nivå) */
function foil(levels, m, parent){
  const N = 18, secs = [];
  levels.forEach(L => {
    const chord = L.le - L.te, s = [];
    const pt = (c, side) => {
      const yt = 5*L.tr*(0.2969*Math.sqrt(c) - 0.126*c - 0.3516*c*c + 0.2843*c**3 - 0.1036*c**4);
      return [L.le - c*chord, L.y, side*yt*chord];
    };
    for (let i = 0; i <= N; i++) s.push(pt((1-Math.cos(Math.PI*i/N))/2, 1));
    for (let i = N-1; i >= 1; i--) s.push(pt((1-Math.cos(Math.PI*i/N))/2, -1));
    s.push(s[0]);
    secs.push(s);
  });
  add(new T.Mesh(loft(secs), m), parent);
  add(new T.Mesh(capGeom(secs[secs.length-1].slice(0,-1)), m), parent);
}
/* Finnekjølen: 2,3 m rotkord, 1,35 m tipkord, dypgang 1,58 m */
foil([{y:-0.42, le:7.0, te:4.7, tr:0.085},{y:-0.85, le:6.62, te:4.76, tr:0.082},
      {y:-1.30, le:6.35, te:4.90, tr:0.078},{y:-1.58, le:6.20, te:4.85, tr:0.074}], mat.anti, boat);
/* Skjegget under akterspeilet, med roret hengt på baksiden */
foil([{y:-0.385, le:4.40, te:3.40, tr:0.075},{y:-0.68, le:4.26, te:3.50, tr:0.070},
      {y:-0.95, le:4.12, te:3.62, tr:0.065}], mat.anti, boat);
/* Ror: eget gruppe rundt rorstammen, kan styres */
const rudderGrp = new T.Group(); rudderGrp.position.set(3.55, 0, 0); boat.add(rudderGrp);
foil([{y:-0.90, le:-0.02, te:-1.12, tr:0.050},{y:-1.10, le:-0.10, te:-0.95, tr:0.046},
      {y:-1.28, le:-0.16, te:-0.72, tr:0.042}], mat.anti, rudderGrp);

/* Aksling og propell i aperturen mellom kjøl og skjegg */
let propSpin = null;
let WHEEL = null, WINDEX = null;   // ratt og vindpeker, animert i applyScene
(function propeller(){
  const ang = Math.atan2(0.15, 0.50);                        // ca. 17° stigende aksling
  const hub = new V3(4.35, -0.95, 0), dir = new V3(Math.cos(ang), Math.sin(ang), 0);
  const at = d => hub.clone().addScaledVector(dir, d);
  // akslingen fra navet og opp i kjølens akterkant
  rod(at(0.10).toArray(), at(0.62).toArray(), 0.019, mat.steel, boat, 14);
  const sl = new T.Mesh(new T.CylinderGeometry(0.042, 0.055, 0.16, 16), mat.anti);
  sl.position.copy(at(0.42)); sl.quaternion.setFromUnitVectors(new V3(0,1,0), dir); add(sl, boat);
  // sinkanode på akslingen
  const zn = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.07, 14), mat.zinc);
  zn.position.copy(at(0.28)); zn.quaternion.setFromUnitVectors(new V3(0,1,0), dir); add(zn, boat);
  // propellgruppen: roterer rundt akslingen
  const align = new T.Group(); align.position.copy(hub);
  align.quaternion.setFromUnitVectors(new V3(0,1,0), dir); boat.add(align);
  propSpin = new T.Group(); align.add(propSpin);
  const hubM = new T.Mesh(new T.CylinderGeometry(0.055, 0.048, 0.13, 18), mat.bronze);
  propSpin.add(hubM);
  const cone = new T.Mesh(new T.CylinderGeometry(0.008, 0.05, 0.08, 16), mat.bronze);
  cone.position.y = -0.10; propSpin.add(cone);
  // tre blader med banetvist
  const bladeGeom = (() => {
    const NR = 9, secs = [];
    for (let i = 0; i <= NR; i++){
      const f = i/NR, rr = 0.055 + 0.155*f;
      const c = 0.15*(0.5 + 0.9*f)*(1 - 0.85*f);
      const beta = 0.95 - 0.62*f;                       // pitch: bred ved nav, flatere ytterst
      const rake = -0.05*f;
      const sy = Math.sin(beta)*c/2, cz = Math.cos(beta)*c/2;
      secs.push([[rr, sy + rake, cz], [rr, -sy + rake, -cz]]);
    }
    const g = loft(secs); return g;
  })();
  for (let k = 0; k < 3; k++){
    const b = new T.Mesh(bladeGeom, mat.bronze);
    b.rotation.y = k*2*Math.PI/3; b.position.y = 0.02;
    b.castShadow = true; propSpin.add(b);
  }
})();
