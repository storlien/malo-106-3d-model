/* ===== Interior, part 2c: tanks =====
   Two 220 l stainless tanks, shaped to the hull: a flat top and inboard face, and an outboard face and bottom that
   follow the hull 2 cm inside the lining. The top height is found so each tank holds its stated volume. */
INT.tankReport = [];
(function tanks() {
  const steel = new T.MeshStandardMaterial({ color: C('#b9bec3'), roughness: .3, metalness: .85, side: T.DoubleSide });
  INT.tanks.forEach(K => {
    const xs = span(K.aft, K.fwd, 24), gap = .02, outer = (x, y) => hin(x, y) - gap;
    // bottom: where the hull gets narrower than 5 cm outboard of the inboard face; top: solved for the stated volume
    const mid = (K.aft + K.fwd)/2; let bot = K.inner; for (let y = -1.2; y < 1; y += .005) if (outer(mid, y) - K.inner > .05) { bot = y; break; }
    const area = (x, top) => { let a = 0; for (let y = bot; y < top; y += .005) a += Math.max(0, outer(x, y) - K.inner)*.005; return a; };
    const vol = top => xs.reduce((v, x, i) => v + area(x, top)*(i === 0 || i === xs.length - 1 ? .5 : 1)*(K.fwd - K.aft)/24, 0);
    let lo = bot, hi = bot + 1.2;
    for (let k = 0; k < 40; k++) { const m = (lo + hi)/2; if (vol(m) < K.litres/1000) lo = m; else hi = m; }
    K.top = (lo + hi)/2; const s = K.side;
    // outline of one station: inboard top corner, along the top, down the hull side, across the bottom
    const ring = x => {
      const pts = [[K.inner, K.top]], ys = span(K.top, bot, 10);
      ys.forEach(y => pts.push([Math.max(K.inner + .005, outer(x, y)), y]));
      pts.push([K.inner, bot], [K.inner, K.top]);
      return pts.map(([z, y]) => [x, y, s*z]);
    };
    igrid(xs.map(ring), steel);
    [K.aft, K.fwd].forEach(x => { const r = ring(x); igrid(r.map(p => [[x, p[1], s*K.inner], p]), steel); });
    // filler and inspection hatch on top, and a stencilled label on the inboard face
    const cx = (K.aft + K.fwd)/2, cz = s*(K.inner + .2);
    const cap = iput(new T.CylinderGeometry(.04, .04, .025, 20), steel); cap.position.set(K.fwd - .2, K.top + .012, cz);
    ibox([cx, K.top + .004, cz], [.32, .008, .22], steel);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#2b2f33'; g.font = '700 40px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${K.label} 220 L`, 128, 34);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    const lab = iput(new T.PlaneGeometry(.36, .09), new T.MeshBasicMaterial({ map: t, transparent: true, side: T.DoubleSide }));
    lab.position.set(cx, (K.top + bot)/2 + .02, s*(K.inner - .004)); lab.rotation.y = s > 0 ? Math.PI : 0;
    INT.tankReport.push({ name: K.name, litres: Math.round(vol(K.top)*1000), top: +K.top.toFixed(3), depth: +(K.top - bot).toFixed(3), bottom: +bot.toFixed(3) });
  });
})();
