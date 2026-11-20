'use strict';
/* cockpit — se deloverskriftene i filen. */

/* =====================================================================
   COCKPIT — dypt og trygt (sole 430 mm under dekkskant), teak-spir i
   tverrgående planker, felgteak-seter langs sidene, akterkiste, teaklist
   på rekka, pult med ratt (r = 230 mm) og self-tailing spill forut.
   ===================================================================== */
(function cockpit(){
  const X0 = 0.85, X1 = 3.60, HW = 1.175;
  const soleY = () => deckY(2.2, HW) - 0.43;                 // 0.59-ish
  const seatY = soleY() + 0.32;

  /* sole i teak med tverrgående planker */
  const soleTex = teakTex.clone();
  soleTex.needsUpdate = true; soleTex.rotation = Math.PI/2; soleTex.center.set(0.5, 0.5);
  const soleMat = MD('#ffffff', { map:soleTex, roughness:0.8 });
  box(X0 + 0.07, X1 - 0.07, soleY() - 0.03, soleY(), -HW + 0.035, HW - 0.035, soleMat, boat);

  /* kumvegger i kremgelcoat fra sole og opp til dekk */
  for (const s of [1, -1]){
    const secs = [], n = 22;
    for (let i = 0; i <= n; i++){
      const x = X0 + (X1-X0)*i/n;
      secs.push([[x, soleY() - 0.03, s*HW], [x, deckY(x, s*HW) + 0.005, s*HW]]);
    }
    add(new T.Mesh(loft(secs), dmat.gel), boat);
  }
  const wallAft = [], wallFwd = [];
  for (let i = 0; i <= 12; i++){
    const z = -HW + 2*HW*i/12;
    wallAft.push([X0 + 0.07, soleY() - 0.03, z], [X0 + 0.07, deckY(X0 + 0.07, z) + 0.005, z]);
    wallFwd.push([X1 - 0.07, soleY() - 0.03, z], [X1 - 0.07, deckY(X1 - 0.07, z) + 0.005, z]);
  }
  add(new T.Mesh(loft([wallAft.filter((p, i) => i % 2 === 0).concat(wallAft.filter((p, i) => i % 2 === 1))]), dmat.gel), boat);
  add(new T.Mesh(loft([wallFwd.filter((p, i) => i % 2 === 0).concat(wallFwd.filter((p, i) => i % 2 === 1))]), dmat.gel), boat);

  /* seter: tre felgteak-planker per side, front i gelcoat */
  for (const s of [1, -1]){
    for (const p of [0, 1, 2]){
      const z0 = s*(0.66 + p*0.17), z1 = s*(0.66 + p*0.17 + 0.14);
      box(0.97, 3.44, seatY, seatY + 0.03, Math.min(z0, z1), Math.max(z0, z1), dmat.teak, boat);
    }
    box(0.97, 3.44, soleY(), seatY, s*0.63, s*0.655, dmat.gel, boat);
    /* pute i marineblått på setet */
    box(1.1, 3.3, seatY + 0.03, seatY + 0.07, s*0.68, s*1.12, dmat.cushion, boat);
  }
  /* akterkiste på tvers, med teakkant */
  box(X0 + 0.09, 1.62, soleY(), seatY, -HW + 0.04, HW - 0.04, dmat.gel, boat);
  box(X0 + 0.09, 1.58, seatY, seatY + 0.03, -HW + 0.05, HW - 0.05, dmat.teak, boat);
  box(1.1, 1.55, seatY + 0.03, seatY + 0.07, -1.05, 1.05, dmat.cushion, boat);

  /* teakliste på cockpit-rekka */
  for (const s of [1, -1]){
    const secs = [], n = 22;
    for (let i = 0; i <= n; i++){
      const x = X0 + (X1-X0)*i/n, y = deckY(x, s*HW);
      secs.push([[x, y - 0.01, s*(HW - 0.02)], [x, y + 0.035, s*(HW - 0.015)], [x, y + 0.035, s*(HW + 0.065)], [x, y - 0.01, s*(HW + 0.07)]]);
    }
    add(new T.Mesh(loft(secs), dmat.teakP), boat);
  }
  box(X0 - 0.075, X0 - 0.015, deckY(X0, 0) - 0.01, deckY(X0, 0) + 0.035, -HW - 0.07, HW + 0.07, dmat.teakP, boat);

  /* styrepult med ratt, instrumentbryn og gass/spaker */
  const pedX = 3.36;
  box(pedX - 0.10, pedX + 0.10, soleY(), soleY() + 0.47, -0.11, 0.11, dmat.gel, boat);
  box(pedX - 0.08, pedX + 0.08, soleY() + 0.47, soleY() + 0.85, -0.085, 0.085, dmat.gel, boat);
  box(pedX - 0.075, pedX + 0.075, soleY() + 0.85, soleY() + 0.92, -0.10, 0.10, dmat.dark, boat);   // bryn
  const compass = new T.Mesh(new T.CylinderGeometry(0.048, 0.052, 0.035, 18), dmat.black);
  compass.position.set(pedX, soleY() + 0.94, 0); add(compass, boat);
  const wheel = new T.Group();
  const rim = new T.Mesh(new T.TorusGeometry(0.23, 0.017, 12, 40), dmat.steel);
  wheel.add(rim);
  for (let k = 0; k < 3; k++){
    const sp = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 0.23, 8), dmat.steel);
    sp.position.set(0, 0.115, 0);
    const holder = new T.Group(); holder.add(sp);
    holder.rotation.x = k*2*Math.PI/3; wheel.add(holder);
  }
  const hubb = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.05, 14), dmat.dark);
  hubb.rotation.z = Math.PI/2; wheel.add(hubb);
  wheel.position.set(pedX - 0.10, soleY() + 0.72, 0);
  wheel.rotation.order = 'ZYX'; wheel.rotation.z = Math.PI/2; wheel.rotation.y = -0.26;   // lener akterover
  wheel.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  boat.add(wheel); WHEEL = wheel;
  rod([pedX + 0.09, soleY() + 0.62, 0.10], [pedX + 0.13, soleY() + 0.72, 0.13], 0.007, dmat.dark, boat, 8);   // gass
  rod([pedX + 0.09, soleY() + 0.62, -0.10], [pedX + 0.13, soleY() + 0.72, -0.13], 0.007, dmat.dark, boat, 8); // gearbox
})();

/* Self-tailing spill på sidedekkene ved skyvedøra */
for (const s of [1, -1]){
  const x = 4.52, y = deckY(x, s*1.25) + 0.004, z = s*1.25;
  const base = new T.Mesh(new T.CylinderGeometry(0.075, 0.082, 0.012, 20), dmat.chrome);
  base.position.set(x, y + 0.006, z); add(base, boat);
  const drum = new T.Mesh(new T.CylinderGeometry(0.06, 0.066, 0.088, 20), dmat.chrome);
  drum.position.set(x, y + 0.056, z); add(drum, boat);
  const cap = new T.Mesh(new T.CylinderGeometry(0.05, 0.054, 0.02, 20), dmat.dark);
  cap.position.set(x, y + 0.11, z); add(cap, boat);
}
