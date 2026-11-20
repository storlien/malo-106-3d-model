'use strict';
/* seil — se deloverskriftene i filen. */

/* =====================================================================
   SEIL — rutenett spent mellom hals, topp og skjøtehorn, med buk mot le
   og blafring i akterliket (portert maskineri, malt med hjørnefarger).
   Storseil på bommen, genua på rullsystemet, stagseil på innerforstaget
   (mye vind), og fyldig blå gennaker. Seilpose i marineblått når det
   ikke seiles — som på foto av båten.
   ===================================================================== */
let SAIL_WIND = -1;                    // -1: vind fra styrbord, seil til babord
const sideS = { v:-1 };                // glir mellom -1 og +1 i vendinger
const gen = { p:0 };
const sail = { p:0, goal:0, t:0, frame:0, kind:'seil' };
const rigUp = { p:1 };                 // 1 = seil ute; 0 = rullet inn (motor)
const WX = { wind:5, windDir:65, wave:0.5, period:4.2, cloud:0.15, fog:0,
             sunEl:42, sunAz:135, speed:null, rain:0, thunder:0, hour:13, heading:0 };
const WXT = Object.assign({}, WX);    // målverdier: WX glir mot disse
const WX_WRAP = { windDir:360, sunAz:360, hour:24 };
const ease = x => { x = Math.min(1, Math.max(0, x)); return x*x*(3-2*x); };
function wxDerived(){
  const r = ((WX.windDir % 360) + 360) % 360, sgn = r > 180 ? r - 360 : r, th = Math.abs(sgn);
  const irons = ease((th - 25)/15);                                  // nesten 0 rett mot vinden
  const closeF = th <= 60 ? 1 : Math.max(0.15, 1 - (th - 60)/120*0.85);
  return { r, sgn, th, reach:ease((th - 55)/95), boom:0.2 + 0.95*ease((th - 45)/120),
    heelR:0.26*Math.min(1, WX.wind/10)*closeF*irons,
    sailSpeed:Math.min(4.0, 0.42*WX.wind + 0.5)*(0.35 + 0.65*irons)*Math.min(1, WX.wind/2) };
}
function stepWeather(dt){
  const kk = Math.min(1, dt*2.2);
  for (const key in WXT){
    const wrap = WX_WRAP[key];
    if (wrap){
      const d = ((WXT[key] - WX[key] + wrap/2) % wrap + wrap) % wrap - wrap/2;
      WX[key] = ((WX[key] + d*kk) % wrap + wrap) % wrap;
    } else if (WXT[key] != null && WX[key] != null){
      WX[key] += (WXT[key] - WX[key])*kk;      // null betyr «automatisk» (f.eks. fart)
    }
  }
}

const sailMat = new T.MeshStandardMaterial({ color:0xffffff, vertexColors:true, roughness:0.85, side:T.DoubleSide });
function makeSail(nv, nf, colorAt){
  const n = (nv+1)*(nf+1), pos = new Float32Array(n*3), col = new Float32Array(n*3), idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nf; i++){ const c = colorAt(j/nv, i/nf); col.set([c.r, c.g, c.b], (j*(nf+1)+i)*3); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nf; i++){ const a = j*(nf+1)+i; idx.push(a, a+1, a+nf+1, a+1, a+nf+2, a+nf+1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  g.setIndex(idx);
  const m = new T.Mesh(g, sailMat); m.castShadow = true; m.receiveShadow = true; m.visible = false; boat.add(m);
  return { m, nv, nf };
}
const cloth = C('#f2f1ec'), uvBlue = C('#22346b');
const mainSail = makeSail(30, 16, () => cloth);
const genoaSail = makeSail(26, 16, (v, f) => (f > 0.93 || v < 0.035) ? uvBlue : cloth);
const staySail = makeSail(24, 14, (v, f) => (f > 0.93 || v < 0.04) ? uvBlue : cloth);
const stSheet = new T.BufferGeometry(); stSheet.setAttribute('position', new T.Float32BufferAttribute(new Array(6).fill(0), 3));
const stSheetL = new T.LineSegments(stSheet, lineMat); stSheetL.visible = false; boat.add(stSheetL);
const genBlue = C('#1d63e6'), genSeam = C('#1957d2'), genPatch = C('#1548b4');
const gennaker = makeSail(48, 30, (v, f) => {
  const j = Math.round(v*48), i = Math.round(f*30);
  if ((j <= 3 && (i <= 3 || i >= 27)) || j >= 46) return genPatch;   // forsterkede hjørner
  return (j % 6 === 0 && j > 0) ? genSeam : genBlue;                 // jevne, tynne tverrsømmer
});
const genSheet = new T.BufferGeometry(); genSheet.setAttribute('position', new T.Float32BufferAttribute(new Array(6).fill(0), 3));
const genSheetL = new T.LineSegments(genSheet, lineMat); genSheetL.visible = false; boat.add(genSheetL);
const sheetGeo = new T.BufferGeometry(); sheetGeo.setAttribute('position', new T.Float32BufferAttribute(new Array(18).fill(0), 3));
boat.add(new T.LineSegments(sheetGeo, lineMat));

/* Gennakeren: asymmetrisk og svært fyldig; forliket buer forover, akterliket ut */
function shapeGennaker(s, tack, head, clew, k, t, fl, sv){
  const p = s.m.geometry.attributes.position, sg = sv >= 0 ? 1 : -1;
  const fwd = new V3(1, 0, 0), out = new V3(0, 0, sg), Lp = new V3(), Rp = new V3(), q = new V3(), d = new V3(), n = new V3();
  for (let j = 0; j <= s.nv; j++){
    const v = j/s.nv, sb = Math.sin(Math.PI*v), sh = Math.sin(Math.PI*Math.min(1, v*1.12));
    Lp.copy(tack).lerp(head, v).addScaledVector(fwd, 1.7*sb*k).addScaledVector(out, 0.6*sb*k);
    Rp.copy(clew).lerp(head, Math.pow(v, 0.85)).addScaledVector(out, 2.4*sh*k).addScaledVector(fwd, -0.5*sb*k);
    d.copy(Rp).sub(Lp); const cl = d.length();
    n.set(d.z, 0, -d.x).normalize(); if (n.z*sg < 0) n.negate();
    for (let i = 0; i <= s.nf; i++){
      const f = i/s.nf, ki = j*(s.nf + 1) + i;
      const belly = 0.26*cl*Math.sin(Math.PI*Math.pow(f, 0.75))*(0.5 + 0.5*sh)*k;
      const foot = -1.0*Math.sin(Math.PI*f)*Math.pow(1 - v, 3)*k;
      const flap = fl*Math.pow(f, 6)*Math.sin(t*5.5 + v*18.0);
      q.copy(Lp).addScaledVector(d, f).addScaledVector(n, belly + flap); q.y += foot;
      p.setXYZ(ki, q.x, q.y, q.z);
    }
  }
  p.needsUpdate = true; s.m.geometry.computeVertexNormals(); s.m.geometry.computeBoundingSphere();
}
function shapeSail(s, tack, head, clew, depth, t, flutter){
  const p = s.m.geometry.attributes.position;
  const A = new V3(), Bv = new V3(), d = new V3(), n = new V3(), q = new V3();
  for (let j = 0; j <= s.nv; j++){
    const v = j/s.nv;
    A.copy(tack).lerp(head, v); Bv.copy(clew).lerp(head, v);
    d.copy(Bv).sub(A); const cl = d.length();
    n.set(d.z, 0, -d.x).normalize(); if (n.z*(sideS.v >= 0 ? 1 : -1) < 0) n.negate();
    for (let i = 0; i <= s.nf; i++){
      const f = i/s.nf, k = j*(s.nf+1)+i;
      const bulge = depth*cl*Math.sin(Math.PI*Math.pow(f, 0.85))*(1 - 0.35*v)
                  + flutter*Math.pow(f, 7)*(Math.sin(t*6.5 + v*22.0) + 0.35*Math.sin(t*10.0 + v*37.0));
      q.copy(A).addScaledVector(d, f).addScaledVector(n, bulge);
      p.setXYZ(k, q.x, q.y, q.z);
    }
  }
  p.needsUpdate = true;
  s.m.geometry.computeVertexNormals(); s.m.geometry.computeBoundingSphere();
}

/* Seilpose (furlet storseil) og rullede fofock-seil */
let furledMain = null;
(function sailCover(){
  const g = new T.CylinderGeometry(0.075, 0.125, RIG.boomLen - 0.3, 14);
  g.rotateZ(Math.PI/2); g.translate(-(RIG.boomLen)/2 + 0.05, 0.145, 0);
  furledMain = new T.Mesh(g, dmat.navy); furledMain.castShadow = true; boomPivot.add(furledMain);
})();
const genoaFurled = (function(){
  const base = new V3(10.62, deckY(10.62, 0) + 0.20, 0), top = base.clone().lerp(new V3(RIG.mx + 0.02, 15.08, 0), 0.40);
  const dir = top.clone().sub(base), len = dir.length();
  const m = new T.Mesh(new T.CylinderGeometry(0.05, 0.085, len, 12), dmat.sail);
  m.position.copy(base).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new V3(0,1,0), dir.clone().normalize());
  m.castShadow = true; boat.add(m); return m;
})();
const staysailFurled = (function(){
  const base = new V3(9.40, deckY(9.40, 0) + 0.09, 0), top = base.clone().lerp(new V3(RIG.mx, 12.32, 0), 0.5);
  const dir = top.clone().sub(base), len = dir.length();
  const m = new T.Mesh(new T.CylinderGeometry(0.028, 0.05, len, 10), dmat.sail);
  m.position.copy(base).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new V3(0,1,0), dir.clone().normalize());
  m.castShadow = true; boat.add(m); return m;
})();

/* Seilstand: rev, genua/stagseil, bomutslag, skjøter — kjøres hver ramme under seiling */
function applySail(){
  const e2 = s01 => s01*s01*(3-2*s01);
  const unfurl = e2(Math.min(1, Math.max(0, (sail.p - 0.12)/0.55)))*rigUp.p;
  const heel = e2(Math.min(1, Math.max(0, (sail.p - 0.35)/0.65)))*rigUp.p;
  const wd = wxDerived(), sv = sideS.v, sgn = sv >= 0 ? 1 : -1, cross = 1 - Math.min(1, Math.abs(sv));
  const reefM = 0.28*ease((WX.wind - 12)/7), strong = ease((WX.wind - 12)/4);
  const genK = ease(gen.p);
  const beta = sv*wd.boom*unfurl, Y2 = new V3(0,1,0);
  boomPivot.rotation.y = beta;
  const bp = boomPivot.position;
  const xs = RIG.mx - 0.085;
  mainSail.m.visible = genoaSail.m.visible = unfurl > 0.004;
  if (unfurl > 0.004){
    const clewM = new V3(-RIG.boomLen*0.97*unfurl*(1 - reefM), 0.12, 0).applyAxisAngle(Y2, beta).add(bp);
    const tt = sail.t, fl = reduceMotion ? 0 : 0.016*heel + 0.14*cross*unfurl;
    const depthK = Math.sqrt(Math.min(1, Math.abs(sv)))*(1 - 0.3*reefM);
    shapeSail(mainSail, new V3(xs, RIG.boomY + 0.06, 0), new V3(RIG.mx, 15.02, 0), clewM,
              0.075*unfurl*depthK, tt, fl);
    const tack = new V3(10.64, deckY(10.64, 0) + 0.24, 0);
    const head = new V3(10.86, deckY(10.86, 0) + 0.09, 0).lerp(new V3(RIG.mx + 0.02, 15.08, 0), 0.92);
    const gU = unfurl*(1 - strong)*(1 - genK);
    const clew0 = tack.clone().lerp(head, 0.04);
    const clewG = clew0.clone().lerp(new V3(5.2 + 0.9*wd.reach, 2.5 + 0.3*wd.reach, (1.55 + 1.2*wd.reach)*sv), gU);
    genoaSail.m.visible = gU > 0.004;
    if (gU > 0.004) shapeSail(genoaSail, tack, head, clewG, 0.1*gU*depthK, tt + 1.3, fl*1.3);
    const sU = unfurl*strong;
    staySail.m.visible = stSheetL.visible = sU > 0.004;
    if (sU > 0.004){
      const sT = new V3(9.40, deckY(9.40, 0) + 0.10, 0), sH = new V3(RIG.mx, 12.32, 0);
      const sC0 = sT.clone().lerp(sH, 0.04);
      const sC = sC0.clone().lerp(new V3(6.3 + 0.6*wd.reach, 2.6 + 0.2*wd.reach, (1.0 + 0.9*wd.reach)*sv), sU);
      shapeSail(staySail, sT, sH, sC, 0.09*sU*depthK, tt + 0.7, fl);
      const ssp = stSheet.attributes.position; ssp.setXYZ(0, sC.x, sC.y, sC.z);
      ssp.setXYZ(1, 4.5, deckY(4.5, 1.34) + 0.08, 1.34*sgn); ssp.needsUpdate = true;
    }
    gennaker.m.visible = genK > 0.01 && unfurl > 0.3;
    genSheetL.visible = gennaker.m.visible;
    if (gennaker.m.visible){
      const gt = new V3(10.95, deckY(10.95, 0) + 0.45, -0.1);
      const ghFull = new V3(RIG.mx, 14.6, 0);
      const gcFull = new V3(3.6 + 0.8*wd.reach, 2.75, (3.2 + 1.6*wd.reach)*sv);
      const gh = gt.clone().lerp(ghFull, genK), gc = gt.clone().lerp(gcFull, genK);
      shapeGennaker(gennaker, gt, gh, gc, genK*depthK, tt + 2.1, fl*1.4, sv);
      const gp = genSheet.attributes.position; gp.setXYZ(0, gc.x, gc.y, gc.z);
      gp.setXYZ(1, 2.4, deckY(2.4, 1.0) + 0.12, 1.0*sgn); gp.needsUpdate = true;
    }
    const sp = sheetGeo.attributes.position, boomMid = new V3(-RIG.boomLen*0.93, -0.06, 0).applyAxisAngle(Y2, beta).add(bp);
    sp.setXYZ(0, boomMid.x, boomMid.y, boomMid.z); sp.setXYZ(1, RIG.traveler.carX, RIG.traveler.blockY, 0);
    sp.setXYZ(2, clewG.x, clewG.y, clewG.z); sp.setXYZ(3, 4.5, deckY(4.5, 1.34) + 0.065, 1.34*sgn);
    sp.setXYZ(4, 4.5, deckY(4.5, 1.34) + 0.065, 1.34*sgn); sp.setXYZ(5, 4.52, deckY(4.52, 1.25) + 0.11, 1.25*sgn);
    sp.needsUpdate = true;
  } else {
    const sp = sheetGeo.attributes.position, boomMid = new V3(-RIG.boomLen*0.92, -0.02, 0).add(bp);
    for (let i = 0; i < 6; i++) sp.setXYZ(i, boomMid.x, boomMid.y, boomMid.z);
    sp.needsUpdate = true;
  }
  furledMain.visible = unfurl < 0.02;
  { const gU = unfurl*(1 - strong)*(1 - genK); genoaFurled.visible = gU < 0.97; genoaFurled.scale.set(1 - 0.75*gU, 1, 1 - 0.75*gU); }
  { const sU = unfurl*strong; staysailFurled.visible = sU < 0.97; staysailFurled.scale.set(1 - 0.75*sU, 1, 1 - 0.75*sU); }
  if (!(unfurl > 0.004)){ gennaker.m.visible = false; genSheetL.visible = false; staySail.m.visible = false; stSheetL.visible = false; }
}
