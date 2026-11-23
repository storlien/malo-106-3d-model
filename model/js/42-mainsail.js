/* Hoisted mainsail, switched on and off from the page. The sail cover is hidden while it is up. */
G.mainsail = new T.Group(); G.mainsail.visible = false; G.rig.add(G.mainsail);
const MS = RG.mainsail;
const SAIL = (() => {
  const B = RG.boom, xL = RG.mastX - RG.mastSize[0]/2 - .012, y0 = B.y + B.h/2 + .012, y1 = RG.mastTop - MS.headBelowTop, xClew = B.aft + MS.clewInset;
  const leech = v => lerp(xClew, xL - MS.headWidth, v) - MS.roach*Math.pow(Math.sin(Math.PI*v), 1.15);
  const pt = (u, v, off = 0) => {
    const c = xL - leech(v);
    return [xL - u*c, lerp(y0, y1, v) + .018*Math.sin(Math.PI*u)*(1 - v), off + MS.camber*c*Math.pow(Math.sin(Math.PI*Math.pow(u, .8)), 1.3)*(1 - .35*v)];
  };
  return { pt, leech, xL, y0, y1 };
})();

(function buildMainsail() {
  const W = 1024, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), r = rng(31), X = u => u*W, Y = v => H*(1 - v);
  g.fillStyle = '#e4e3dc'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < .5 ? '255,255,250' : '120,118,110'},${.015 + r()*.025})`; g.fillRect(r()*W, r()*H, 30 + r()*160, 1 + r()*5); }
  g.strokeStyle = 'rgba(95,95,90,.3)'; g.lineWidth = 2;                 // cross-cut cloth seams, rising toward the leech
  for (let v = -.1; v < 1.05; v += .052) { g.beginPath(); g.moveTo(0, Y(v)); g.quadraticCurveTo(W*.5, Y(v + .012), W, Y(v + .05)); g.stroke(); }
  const patch = (u, v, rx, ry) => { g.fillStyle = 'rgba(165,163,150,.26)'; g.strokeStyle = 'rgba(100,98,90,.4)'; g.lineWidth = 2; g.beginPath(); g.ellipse(X(u), Y(v), rx, ry, 0, 0, Math.PI*2); g.fill(); g.stroke(); };
  [[.91, .035], [.9, .21], [.88, .42]].forEach(([u, v]) => patch(u, v, .34/(SAIL.xL - SAIL.leech(v))*W, 46));   // reef patches at the leech
  [.03, .19, .39].forEach(v => patch(.015, v, 26, 40));                                     // and at the luff
  g.fillStyle = 'rgba(112,110,100,.45)'; g.fillRect(0, H - 34, W, 34); g.fillRect(0, 0, W, 8); g.fillRect(0, 0, 14, H); g.fillRect(W - 12, 0, 12, H);
  MS.battens.forEach(v => { g.fillStyle = 'rgba(120,118,108,.5)'; g.fillRect(0, Y(v) - 9, W, 18); });
  const tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding; tx.anisotropy = 12;
  const cloth = M('#ffffff', { map: tx, roughness: .82, envMapIntensity: .55 });
  const nu = 34, nv = 56, rows = [], uv = [];
  for (let j = 0; j <= nv; j++) { const q = []; for (let i = 0; i <= nu; i++) { q.push(SAIL.pt(i/nu, j/nv)); uv.push(i/nu, j/nv); } rows.push(q); }
  const geo = gridGeo(rows); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); put(G.mainsail, geo, cloth);

  MS.battens.forEach(v => tube(G.mainsail, Array.from({ length: 13 }, (_, i) => SAIL.pt(i/12, v)), .007, mat.white, false, 6));
  rod(G.mainsail, SAIL.pt(0, 1), SAIL.pt(1, 1), .012, mat.alu, 8);                         // headboard
  for (let v = .03; v < 1; v += .06) box(G.mainsail, [SAIL.xL + .008, lerp(SAIL.y0, SAIL.y1, v), 0], [.03, .035, .014], mat.dark);   // luff slides

  // the sail's double "m" insignia, reading correctly from both sides
  const lc = document.createElement('canvas'); lc.width = 256; lc.height = 300;
  const l = lc.getContext('2d'); l.textAlign = 'center'; l.textBaseline = 'middle'; l.font = '900 170px Arial Black, Arial, sans-serif';
  l.fillStyle = '#7c8799'; l.fillText('m', 128, 78); l.fillStyle = '#23457f'; l.fillText('m', 128, 224);
  const lt = new T.CanvasTexture(lc); lt.encoding = T.sRGBEncoding; lt.anisotropy = 8;
  const lm = new T.MeshStandardMaterial({ map: lt, transparent: true, roughness: .8, depthWrite: false });
  const v0 = MS.logoV, u0 = .46, dv = .058, du = .62/(SAIL.xL - SAIL.leech(v0));
  [1, -1].forEach(s => {
    const q = [], t = [];
    for (let j = 0; j <= 6; j++) { const a = []; for (let i = 0; i <= 6; i++) { a.push(SAIL.pt(u0 + (i/6 - .5)*du, v0 + (j/6 - .5)*dv, s*.006)); t.push(s > 0 ? 1 - i/6 : i/6, j/6); } q.push(a); }
    const d = gridGeo(q); d.setAttribute('uv', new T.Float32BufferAttribute(t, 2));
    const m = new T.Mesh(d, lm.clone()); m.material.side = T.DoubleSide; m.material.polygonOffset = true; m.material.polygonOffsetFactor = -2; m.renderOrder = 2; G.mainsail.add(m);
  });
})();
