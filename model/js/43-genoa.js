/* 140 % roller genoa, unfurled to starboard. While it is off, the furled sail on the forestay shows instead. */
G.genoa = new T.Group(); G.genoa.visible = false; G.rig.add(G.genoa);
const GN = RG.genoa;
const GENOA = (() => {
  const a = RG.stem, b = [RG.mastX + .1, RG.mastTop - .02], len = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0])/len, (b[1] - a[1])/len];
  const n = [-d[1], d[0]].map(q => q*(d[1] > 0 ? -1 : 1)), aft = n[0] < 0 ? n : [-n[0], -n[1]];    // square to the luff, pointing aft
  const luffAt = f => [a[0] + d[0]*len*f, a[1] + d[1]*len*f], tack = luffAt(GN.tackF), head = luffAt(GN.headF);
  const J = a[0] - (RG.mastX + RG.mastSize[0]/2), LP = GN.overlap*J, s = (GN.clewY - a[1] - aft[1]*LP)/d[1];
  const clew = [a[0] + d[0]*s + aft[0]*LP, GN.clewY], headAft = [head[0] + aft[0]*GN.headWidth, head[1] + aft[1]*GN.headWidth];
  const leech = v => [lerp(clew[0], headAft[0], v) + GN.hollow*Math.sin(Math.PI*v), lerp(clew[1], headAft[1], v)];
  const leechZ = v => GN.clewZ*(1 - Math.pow(v, GN.twist))*(1 - .25*v);
  const pt = (u, v, off = 0) => {
    const p = [lerp(tack[0], head[0], v), lerp(tack[1], head[1], v)], q = leech(v), c = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [lerp(p[0], q[0], u), lerp(p[1], q[1], u) - GN.footRound*Math.sin(Math.PI*u)*Math.pow(1 - v, 8),
      off + u*leechZ(v) + GN.camber*c*Math.pow(Math.sin(Math.PI*Math.pow(u, .75)), 1.3)*(1 - .3*v)];
  };
  const chord = v => { const p = pt(0, v), q = pt(1, v); return Math.hypot(q[0] - p[0], q[1] - p[1]); };
  return { pt, chord, tack, head, clew, J, LP, luff: Math.hypot(head[0] - tack[0], head[1] - tack[1]) };
})();

(function buildGenoa() {
  const W = 2048, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), r = rng(47), X = u => u*W, Y = v => H*(1 - v);
  g.fillStyle = '#eeeeE8'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(${r() < .5 ? '255,255,252' : '125,124,116'},${.012 + r()*.02})`; g.fillRect(r()*W, r()*H, 40 + r()*220, 1 + r()*4); }
  g.strokeStyle = 'rgba(105,105,98,.3)'; g.lineWidth = 2.5;                  // cross-cut cloth, seams square to the leech
  for (let v = -.25; v < 1.05; v += .043) { g.beginPath(); g.moveTo(0, Y(v)); g.quadraticCurveTo(W*.55, Y(v + .012), W, Y(v + .075)); g.stroke(); }
  g.fillStyle = 'rgba(120,118,108,.38)'; g.fillRect(0, 0, 12, H);            // luff tape
  // blue UV strip along the leech and the foot, the part left outside when the sail is furled
  const footV = GN.uvWidth/GENOA.luff, band = v => clamp(GN.uvWidth/Math.max(GENOA.chord(v), .01), 0, .8);
  g.fillStyle = GN.uvPrint; g.fillRect(0, Y(footV), W, H - Y(footV));   // printed darker so it reads as the hull's navy on the brighter cloth
  g.beginPath(); g.moveTo(W, H);
  for (let i = 0; i <= 80; i++) { const v = i/80; g.lineTo(X(1 - band(v)), Y(v)); }
  g.lineTo(W, 0); g.closePath(); g.fill();
  const tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding; tx.anisotropy = 12;
  const cloth = M('#ffffff', { map: tx, roughness: .8, envMapIntensity: .55 }), nu = 48, nv = 80, rows = [], uv = [];
  for (let j = 0; j <= nv; j++) { const q = []; for (let i = 0; i <= nu; i++) { q.push(GENOA.pt(i/nu, j/nv)); uv.push(i/nu, j/nv); } rows.push(q); }
  const geo = gridGeo(rows); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); put(G.genoa, geo, cloth);

  // aluminium luff foil, tack pennant and head swivel
  const f = GENOA.tack, h = GENOA.head;
  rod(G.genoa, [RG.stem[0], RG.stem[1], 0], [h[0], h[1], 0], .016, mat.alu, 10);
  rod(G.genoa, [f[0], f[1] - .16, 0], [f[0], f[1], 0], .006, mat.wire, 6);
  const sw = put(G.genoa, new T.CylinderGeometry(.028, .028, .09, 14), mat.steel); sw.position.set(h[0], h[1], 0); sw.rotation.z = Math.atan2(RG.mastTop - RG.stem[1], RG.stem[0] - RG.mastX) - Math.PI/2;

  // clew ring, sheet and lead block on the side deck
  const cl = GENOA.pt(1, 0), ring = put(G.genoa, new T.TorusGeometry(.03, .007, 8, 20), mat.steel); ring.position.set(cl[0], cl[1], cl[2]);
  const bx = GENOA.clew[0] - 1.05, bz = halfB(bx) - .11, by = deckY(bx, bz);
  rod(G.genoa, cl, [bx, by + .055, bz], .006, mat.white, 6);
  const blk = put(G.genoa, new T.SphereGeometry(.042, 14, 10), mat.dark); blk.scale.set(1.15, 1, .6); blk.position.set(bx, by + .05, bz);
  box(G.genoa, [bx, by + .006, bz], [.44, .012, .03], mat.alu);           // sheet track
})();
