'use strict';
/* rigg — se deloverskriftene i filen. */

/* =====================================================================
   RIGG — masthead-slup fra Malö-brosjyren: mast i x = 7,0 m, topp 15,2 m
   over vannlinjen, doble spreddere (44 % / 73 %, 1,45 / 1,15 m, feid 7°
   akterover), rullfock på rulleforesystem i stevnen, bom 3,75 m i 2,15 m
   høyde, mestersheet på spor på doghouse-taket.
   ===================================================================== */
const RIG = { mx: 7.0, top: 15.2, r: 0.082, boomY: 2.15, boomLen: 3.75, drumR: 0.145 };
let boomPivot = null;   // settes i buildRig, roteres av seilene
const mastBaseY = () => deckY(RIG.mx, 0) + crTopH(RIG.mx) + 0.02;   // doghouse-tak under masten
function mastAt(y){ return [RIG.mx, y, 0]; }
const spreader = (frac, len) => {
  const y = frac*RIG.top, sweep = 7*Math.PI/180;
  return { y, len, tips: [1, -1].map(s => [RIG.mx - len*Math.sin(sweep), y + 0.012, s*len]) };
};
const S1 = spreader(0.44, 1.45), S2 = spreader(0.73, 1.15);
const chainZ = x => halfWidthAt(x, deckY(x, 0)) - 0.06;
const CAP_CP = [6.30], LOW_CP = [6.90];      // x for overfall / D1-fester på sidedekkene

(function buildRig(){
  /* mast: åttekantet, hvitmalt, konisk 82 → 52 mm */
  const mastSecs = [], radii = [[mastBaseY(), 0.082], [6.69, 0.074], [11.1, 0.064], [15.2, 0.052]];
  for (const [y, r] of radii){
    const sec = [];
    for (let i = 0; i < 12; i++){
      const a = Math.PI*2*i/12;
      sec.push([RIG.mx + r*Math.cos(a), y, r*Math.sin(a)]);
    }
    mastSecs.push(sec);
  }
  const mast = new T.Mesh(loft(mastSecs), dmat.mast); add(mast, boat);
  add(new T.Mesh(capGeom(mastSecs[mastSecs.length-1]), dmat.mast), boat);
  /* mastefot og krage på doghouse-taket */
  const cradge = new T.Mesh(new T.CylinderGeometry(0.115, 0.135, 0.09, 16), dmat.mast);
  cradge.position.set(RIG.mx, mastBaseY() + 0.04, 0); add(cradge, boat);
  /* mastehode: plate, seilskiver, logg/lanterner, windex */
  box(RIG.mx - 0.05, RIG.mx + 0.05, 15.20, 15.27, -0.05, 0.05, dmat.mast, boat);
  const sheave = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.03, 12), dmat.dark);
  sheave.rotation.z = Math.PI/2; sheave.position.set(RIG.mx + 0.005, 15.14, 0.03); add(sheave, boat);
  const sheave2 = sheave.clone(); sheave2.position.z = -0.03; boat.add(sheave2);
  const windexG = new T.Group(); windexG.position.set(RIG.mx, 15.30, 0);
  const wA = new T.Mesh(new T.BoxGeometry(0.55, 0.008, 0.008), dmat.black); wA.position.x = 0.34; windexG.add(wA);
  const wB = new T.Mesh(new T.BoxGeometry(0.20, 0.008, 0.008), dmat.black); wB.rotation.y = Math.PI/2; wB.position.set(-0.16, 0, 0.10); windexG.add(wB);
  const wC = wB.clone(); wC.position.z = -0.10; windexG.add(wC);
  windexG.traverse(o => { if (o.isMesh){ o.castShadow = true; } }); boat.add(windexG); WINDEX = windexG;

  /* spreddere: koniske rør feid akterover, med tipplate */
  [S1, S2].forEach(S => {
    for (const s of [1, -1]){
      const tip = S.tips[s === 1 ? 0 : 1];
      taperRod(mastAt(S.y - 0.015), [RIG.mx - 0.06, S.y + 0.015, s*0.07], 0.026, 0.018, dmat.mast, boat);
      rod([RIG.mx - 0.06, S.y + 0.015, s*0.07], [tip[0], tip[1], tip[2]], 0.015, dmat.mast, boat, 10);
      box(tip[0] - 0.02, tip[0] + 0.02, tip[1] - 0.02, tip[1] + 0.02, s*(S.len - 0.015), s*(S.len + 0.015), dmat.mast, boat);
    }
  });

  /* bom i eget rotasjonspunkt ved gOnkelringen; kick (vang) henger med */
  boomPivot = new T.Group();
  boomPivot.position.set(RIG.mx - 0.07, RIG.boomY - 0.02, 0);
  boat.add(boomPivot);
  box(RIG.mx - 0.11, RIG.mx - 0.03, RIG.boomY - 0.05, RIG.boomY + 0.03, -0.05, 0.05, dmat.dark, boat);
  const boom = new T.Mesh(new T.BoxGeometry(RIG.boomLen, 0.15, 0.10), dmat.mast);
  boom.position.set(-RIG.boomLen/2, 0, 0);
  boom.castShadow = boom.receiveShadow = true; boomPivot.add(boom);
  const boomCap = new T.Mesh(new T.BoxGeometry(0.05, 0.17, 0.11), dmat.mast);
  boomCap.position.set(-RIG.boomLen - 0.025, 0, 0);
  boomCap.castShadow = boomCap.receiveShadow = true; boomPivot.add(boomCap);
  for (const s of [1, -1]) rod([0.05, -0.12, s*0.02], [-0.68, -0.005, s*0.05], 0.011, dmat.steel, boomPivot, 8);

  /* stående rigg (5 mm vantropper): fall, bardun, D1/D2, overfall */
  const stayR = 0.0048, shroudR = 0.0062;
  const turnbuckle = (a, b, m) => {
    const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = d.length();
    const tb = new T.Mesh(new T.CylinderGeometry(0.013, 0.013, 0.11, 10), dmat.chrome);
    tb.position.copy(A).addScaledVector(d, 0.07/len);
    tb.quaternion.setFromUnitVectors(new V3(0,1,0), d.clone().normalize());
    add(tb, boat);
  };
  /* forstag til rullsystemet i stevnen */
  const stemTop = [10.86, deckY(10.86, 0) + 0.09, 0];
  rod([RIG.mx + 0.02, 15.08, 0], stemTop, stayR, dmat.steel, boat, 8);
  turnbuckle([10.75, stemTop[1] - 0.42, 0], [10.86, stemTop[1], 0], dmat.steel);
  /* innerforstag (kryssfock) */
  rod([RIG.mx, 12.35, 0], [9.40, deckY(9.40, 0) + 0.05, 0], stayR, dmat.steel, boat, 8);
  /* bakstay ned til akterspeilet */
  rod([RIG.mx - 0.01, 15.10, 0], [0.50, 1.06, 0], stayR, dmat.steel, boat, 8);
  turnbuckle([0.60, 1.30, 0], [0.50, 1.06, 0], dmat.steel);
  /* overfall (cap) via øvre spreddertips */
  for (const s of [1, -1]){
    const tip = S2.tips[s === 1 ? 0 : 1];
    rod([RIG.mx + 0.04, 15.02, s*0.06], [tip[0], tip[1], tip[2]], shroudR, dmat.steel, boat, 8);
    const cpA = [CAP_CP[0], deckY(CAP_CP[0], chainZ(CAP_CP[0])) + 0.03, s*chainZ(CAP_CP[0])];
    rod([tip[0], tip[1], tip[2]], cpA, shroudR, dmat.steel, boat, 8);
    turnbuckle([cpA[0], cpA[1] - 0.35, s*chainZ(cpA[0])], cpA, dmat.steel);
    /* D1: dekk → nedre spreddertip; D2: tip → tip */
    const t1 = S1.tips[s === 1 ? 0 : 1];
    const cpB = [LOW_CP[0], deckY(LOW_CP[0], chainZ(LOW_CP[0])) + 0.03, s*chainZ(LOW_CP[0])];
    rod(cpB, [t1[0], t1[1], t1[2]], shroudR, dmat.steel, boat, 8);
    turnbuckle([cpB[0], cpB[1] - 0.35, s*chainZ(cpB[0])], cpB, dmat.steel);
    rod([t1[0], t1[1], t1[2]], [tip[0], tip[1], tip[2]], shroudR, dmat.steel, boat, 8);
    /* vantrok-belastningsplater på dekk */
    for (const cpx of [CAP_CP[0], LOW_CP[0]]){
      box(cpx - 0.03, cpx + 0.03, deckY(cpx, s*chainZ(cpx)) - 0.004, deckY(cpx, s*chainZ(cpx)) + 0.018, s*(chainZ(cpx) - 0.03), s*(chainZ(cpx) + 0.03), dmat.steel, boat);
    }
  }

  /* rullforesystem: profil i stevnen + svart trommel ved dekk */
  const furlerDir = new V3().sub(new V3(...stemTop)).normalize();
  const foil = new V3(...stemTop).sub(new V3(10.60, deckY(10.60, 0) + 0.10, 0));
  rod([10.60, deckY(10.60, 0) + 0.10, 0], [stemTop[0], stemTop[1] - 0.01, 0], 0.016, dmat.steel, boat, 10);
  const drum = new T.Mesh(new T.CylinderGeometry(0.075, 0.09, 0.17, 18), dmat.black);
  drum.position.set(10.62, deckY(10.62, 0) + 0.14, 0); add(drum, boat);

  /* mestersheet-spor på doghouse-taket, med bil og skjøteblokker */
  const trY = crPt(4.62, 1)[1] + 0.055;
  for (const s of [1, -1]) box(4.60, 4.66, trY - 0.012, trY, s*0.75 - 0.016, s*0.75 + 0.016, dmat.steel, boat);
  box(4.56, 4.70, trY - 0.05, trY - 0.012, -0.8, 0.8, dmat.gel, boat);
  const car = box(4.59, 4.67, trY, trY + 0.035, -0.07, 0.07, dmat.dark, boat);
  const msBlock = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.045, 12), dmat.dark);
  msBlock.rotation.z = Math.PI/2; msBlock.position.set(4.63, trY + 0.065, 0); add(msBlock, boat);
  RIG.traveler = { y: trY, carX: 4.63, blockY: trY + 0.065, car };

  /* fockeskjøtespor på sidedekkene med biler */
  for (const s of [1, -1]){
    box(3.70, 5.30, deckY(4.5, s*1.34) + 0.008, deckY(4.5, s*1.34) + 0.022, s*1.325, s*1.355, dmat.steel, boat);
    const carG = new T.Group();
    const carB = box(4.45, 4.55, deckY(4.5, s*1.34) + 0.022, deckY(4.5, s*1.34) + 0.045, s*1.30, s*1.38, dmat.dark, boat);
    const lead = new T.Mesh(new T.CylinderGeometry(0.028, 0.028, 0.04, 12), dmat.dark);
    lead.rotation.z = Math.PI/2; lead.rotation.y = -s*0.35;
    lead.position.set(4.50, deckY(4.5, s*1.34) + 0.065, s*1.34); add(lead, boat);
  }
})();
