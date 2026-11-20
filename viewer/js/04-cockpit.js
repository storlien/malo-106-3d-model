'use strict';
/* cockpit — se deloverskriftene i filen. */

/* =====================================================================
   COCKPIT — hvite karmer med teaklokk (tre flater utover/oppå/innenfor,
   som Abela), puter i marineblått som avrundede ekstruderinger med fasing,
   styrekonsoll sveipt av superelliptiske ring som vider seg ut mot hodet
   med kartplotter, stor ratt med fem eiker. Spill: dreide
   kromprofiler (LatheGeometry) med selvhalende topp.
   ===================================================================== */

/* Spill: drept krom-profil (fot, trommel, selvhaler, topp) + avtaksarm */
function winch(x, y, z, sc){
  const g = new T.Group(); g.position.set(x, y, z); g.scale.setScalar(sc); boat.add(g);
  const lathe = (pts, m) => { const me = new T.Mesh(new T.LatheGeometry(pts.map(([r,h]) => new V2(r,h)), 40), m); me.castShadow = true; me.receiveShadow = true; g.add(me); return me; };
  lathe([[0,0],[0.104,0],[0.109,0.004],[0.11,0.012],[0.11,0.036],[0.106,0.042],[0.1,0.046],[0.092,0.05],[0.08,0.062],[0.07,0.078],[0.066,0.09],[0.065,0.096]], dmat.chrome);
  lathe([[0.065,0.095],[0.064,0.13],[0.064,0.158],[0.066,0.162]], dmat.drum);
  lathe([[0.066,0.161],[0.084,0.168],[0.088,0.176],[0.088,0.196],[0.082,0.203],[0.07,0.205]], dmat.black);
  lathe([[0.07,0.204],[0.083,0.206],[0.085,0.212],[0.08,0.221],[0.06,0.227],[0.03,0.23],[0.018,0.23],[0.016,0.226],[0,0.226]], dmat.chrome);
  const arm = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.03), dmat.chrome);
  arm.position.set(0.082, 0.186, 0); arm.rotation.z = -0.2; g.add(arm);
  const lip = new T.Mesh(new T.BoxGeometry(0.03, 0.012, 0.026), dmat.chrome);
  lip.position.set(0.1, 0.165, 0); g.add(lip);
  g.rotation.y = Math.random()*Math.PI*2;
  return g;
}

/* Pute: avrundet rektangel ekstrudert med fasing — ser polstret ut */
function cushion(x0, x1, z0, z1, y0, h){
  const s = new T.Shape(), r = Math.min(0.05, (x1-x0)/4, (z1-z0)/4);
  s.moveTo(x0+r, -z0); s.lineTo(x1-r, -z0); s.quadraticCurveTo(x1, -z0, x1, -z0-r);
  s.lineTo(x1, -z1+r); s.quadraticCurveTo(x1, -z1, x1-r, -z1);
  s.lineTo(x0+r, -z1); s.quadraticCurveTo(x0, -z1, x0, -z1+r);
  s.lineTo(x0, -z0-r); s.quadraticCurveTo(x0, -z0, x0+r, -z0);
  const g = new T.ExtrudeGeometry(s, { depth:h-0.024, bevelEnabled:true, bevelThickness:0.012, bevelSize:0.012, bevelSegments:3, curveSegments:4 });
  g.rotateX(-Math.PI/2); g.translate(0, y0+0.012, 0);
  return add(new T.Mesh(g, dmat.cushion), boat);
}

function teakPlate(x0, x1, z0, z1, y){
  const g = new T.PlaneGeometry(x1-x0, z1-z0); g.rotateX(-Math.PI/2); g.translate((x0+x1)/2, y, (z0+z1)/2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
  return add(new T.Mesh(g, dmat.teak), boat);
}

(function cockpit(){
  const X0 = 0.85, X1 = 3.60, HW = 1.175;
  const F = deckY(2.2, HW) - 0.43;                 // dor hoveddor (sole)
  const SEAT = F + 0.32;
  const COAM = deckY(2.2, HW) + 0.26;              // karmens topp

  /* karmer: hvit utside, teaklokk oppå, hvit innside ned mot setene */
  for (const s of [1, -1]){
    const outer = [], top = [], inner = [];
    for (let x = X0; x <= X1 + 1e-6; x += 0.05){
      const W = HW;
      outer.push([[x, deckY(x, W) - 0.02, s*W], [x, COAM - 0.035, s*(W - 0.025)], [x, COAM, s*(W - 0.06)]]);
      top.push([[x, COAM, s*(W - 0.06)], [x, COAM + 0.004, s*1.22]]);
      inner.push([[x, COAM, s*1.22], [x, COAM - 0.03, s*1.2], [x, SEAT + 0.01, s*1.19]]);
    }
    add(new T.Mesh(loft(outer), dmat.gel), boat);
    add(new T.Mesh(loftUV(top), dmat.teak), boat);
    add(new T.Mesh(loft(inner), dmat.gel), boat);
    const end = i => { const o = outer[i], t = inner[i]; return [o[0], o[1], o[2], t[0], t[1], t[2]]; };
    add(new T.Mesh(capGeom(end(0)), dmat.gel), boat);
    add(new T.Mesh(capGeom(end(outer.length-1)), dmat.gel), boat);
    /* sidesete med pute, åpning akterst der rattet går ned */
    box(1.08, 2.38, F, SEAT, s > 0 ? 0.75 : -1.2, s > 0 ? 1.2 : -0.75, dmat.gel, boat);
    box(2.38, 3.44, F, SEAT, s > 0 ? 0.55 : -1.2, s > 0 ? 1.2 : -0.55, dmat.gel, boat);
    cushion(2.4, 3.42, s > 0 ? 0.57 : -1.17, s > 0 ? 1.17 : -0.57, SEAT, 0.075);
    cushion(1.1, 2.36, s > 0 ? 0.77 : -1.17, s > 0 ? 1.17 : -0.77, SEAT, 0.075);
    /* spill på karmen */
    winch(3.15, COAM + 0.004, s*1.30, 1.0);
    winch(2.0, COAM + 0.004, s*1.29, 0.82);
  }
  /* rorsmannssete på tvers akter + pute */
  box(X0 + 0.06, 1.06, F, SEAT, -1.2, 1.2, dmat.gel, boat);
  cushion(X0 + 0.1, 1.04, -1.17, 1.17, SEAT, 0.075);
  box(X0 + 0.04, X0 + 0.065, SEAT, deckY(X0, 0) + 0.06, -1.2, 1.2, dmat.gel, boat);
  /* dor i teak med hvit bunn */
  teakPlate(1.08, 3.42, -0.72, 0.72, F + 0.003);
  box(1.08, 3.42, F - 0.04, F, -0.72, 0.72, dmat.gel, boat);

  /* styrekonsoll: smal søyle som vider seg ut til hodet med plotter */
  (() => {
    const cx = 3.30, N = 48;
    const ring = (y, hx, hz, yTop) => {
      const pts = [];
      for (let i = 0; i < N; i++){
        const t = 2*Math.PI*i/N, c = Math.cos(t), s2 = Math.sin(t);
        const x = cx + hx*Math.sign(c)*Math.pow(Math.abs(c), 0.5), z = hz*Math.sign(s2)*Math.pow(Math.abs(s2), 0.5);
        pts.push([x, yTop ? yTop(x) : y, z]);
      }
      pts.push(pts[0]);
      return pts;
    };
    const topY = x => SEAT + 0.62 + (x - cx)*0.3;
    const levels = [
      ring(F, 0.09, 0.11), ring(F + 0.55, 0.10, 0.12), ring(SEAT + 0.18, 0.115, 0.14),
      ring(SEAT + 0.30, 0.17, 0.24), ring(SEAT + 0.38, 0.20, 0.30), ring(SEAT + 0.46, 0.20, 0.31), ring(0, 0.195, 0.305, topY),
    ];
    add(new T.Mesh(loft(levels), dmat.gel), boat);
    const top = levels[levels.length-1].slice(0, -1);
    add(new T.Mesh(capGeom(top.map(p => [p[0], p[1] - 0.002, p[2]])), dmat.dark), boat);
    const slope = Math.atan(0.3);
    /* kartplotter felt ned i toppen */
    const g = new T.Group(); g.position.set(cx - 0.01, topY(cx - 0.01) + 0.012, 0); g.rotation.z = slope; boat.add(g);
    const body = new T.Mesh(new T.BoxGeometry(0.24, 0.035, 0.34), dmat.black); body.castShadow = true; g.add(body);
    const sg = new T.PlaneGeometry(0.30, 0.18); sg.rotateX(-Math.PI/2); sg.rotateY(-Math.PI/2);
    const scr = new T.Mesh(sg, new T.MeshStandardMaterial({ color:C('#1a2f3c'), roughness:0.15, metalness:0.1, emissive:C('#7fd4ff'), emissiveIntensity:0.35 }));
    scr.position.set(0.005, 0.0185, 0); g.add(scr);
    /* stålhåndtak foran plotteren */
    const hx = cx + 0.15;
    [-0.24, 0.24].forEach(z => rod([hx, topY(hx), z], [hx, topY(hx) + 0.11, z], 0.011, dmat.chrome, boat, 8));
    rod([hx, topY(hx) + 0.11, -0.24], [hx, topY(hx) + 0.11, 0.24], 0.011, dmat.chrome, boat, 8);
    /* gasshendel på styrbord side */
    const lev = add(new T.Mesh(new T.BoxGeometry(0.03, 0.15, 0.03), dmat.black), boat);
    lev.position.set(cx + 0.02, SEAT + 0.42, 0.33); lev.rotation.z = -0.5;
    const knob = add(new T.Mesh(new T.SphereGeometry(0.026, 14, 10), dmat.black), boat);
    knob.position.set(cx - 0.02, SEAT + 0.49, 0.33);
    /* instrumenter på baksiden av hodet */
    const face = cx - 0.19;
    [[-0.17, SEAT + 0.36], [0.17, SEAT + 0.36]].forEach(([z, y]) => {
      box(face - 0.01, face, y - 0.04, y + 0.04, z - 0.04, z + 0.04, dmat.black, boat);
      const pg = new T.PlaneGeometry(0.07, 0.07); pg.rotateY(-Math.PI/2);
      const m = new T.Mesh(pg, dmat.screen); m.position.set(face - 0.0105, y, z); boat.add(m);
    });
  })();

  /* ratt: stor ring med fem eiker i rustfritt */
  const wx = 3.02, wy = SEAT + 0.52;
  rod([3.24, wy, 0], [wx - 0.04, wy, 0], 0.028, dmat.chrome, boat, 10);
  const wheel = new T.Group(); wheel.position.set(wx, wy, 0); boat.add(wheel);
  const hub = add(new T.Mesh(new T.CylinderGeometry(0.045, 0.055, 0.08, 20), dmat.chrome), wheel); hub.rotation.z = Math.PI/2;
  const rim = add(new T.Mesh(new T.TorusGeometry(0.44, 0.017, 10, 64), dmat.dark), wheel); rim.rotation.y = Math.PI/2;
  for (let k = 0; k < 5; k++){
    const a = Math.PI/2 + k*2*Math.PI/5;
    rod([0, 0, 0], [0, Math.sin(a)*0.435, Math.cos(a)*0.435], 0.009, dmat.chrome, wheel, 8);
  }
  wheel.rotation.z = Math.PI/2; wheel.rotation.y = -0.22;
  wheel.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  WHEEL = wheel;
})();

/* Self-tailing spill på sidedekkene ved skyvedøra (i tillegg til karmspillene) */
for (const s of [1, -1]) winch(4.55, deckY(4.55, s*1.25) + 0.004, s*1.25, 0.95);
