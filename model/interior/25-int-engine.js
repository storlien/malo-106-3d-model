/* ===== Interior, part 2b: the engine =====
   Yanmar 3JH5E with KM35A gearbox, from Yanmar's installation drawing (overall 774 x 560 x 623 mm; crankshaft
   432 mm below the top and 191 mm above the sump; mounts 412 mm apart fore and aft, 420 mm across).
   It stands just aft of the companionway ladder, belt cover forward, in a foil-lined compartment, as in the owner's photo. */
(function engine() {
  const E = SPEC.keel.engine, [cx, cy] = shaftLine.coupling, t = shaftLine.tilt, ct = Math.cos(t), st = Math.sin(t);
  // engine frame: u forward along the crankshaft from the coupling face, v up, w to starboard
  const P = (u, v, w) => [cx + u*ct - v*st, cy + u*st + v*ct, w];
  const S = o => new T.MeshStandardMaterial(Object.assign({ side: T.DoubleSide }, o));
  const m = {
    block: S({ color: C('#33363a'), roughness: .45, metalness: .5 }), cover: S({ color: C('#5d6165'), roughness: .38, metalness: .55 }),
    black: S({ color: C('#151515'), roughness: .6 }), red: S({ color: C('#c0201c'), roughness: .5 }), orange: S({ color: C('#e88a1a'), roughness: .5 }),
    steel: intMat.steel, rubber: S({ color: C('#222222'), roughness: .9 }), gel: S({ color: C('#ece9e0'), roughness: .6 }),
    foil: S({ color: C('#c9ccd0'), roughness: .35, metalness: .8 }), hose: S({ color: C('#7d8fb0'), roughness: .3, transparent: true, opacity: .85 }),
  };
  const part = (u, v, w, su, sv, sw, mat) => { const b = ibox(P(u, v, w), [su, sv, sw], mat); b.rotation.z = t; return b; };
  const cyl = (u, v, w, r, len, mat, axis = 'u') => {
    const c = iput(new T.CylinderGeometry(r, r, len, 20), mat); c.position.set(...P(u, v, w));
    if (axis === 'u') c.rotation.z = t - Math.PI/2; else if (axis === 'w') { c.rotation.x = Math.PI/2; } else c.rotation.z = t;
    return c;
  };
  // KM35A gearbox and its output flange, bell housing, block, sump, head and rocker cover
  part(.085, -.01, 0, .17, .24, .22, m.block); cyl(-.006, 0, 0, .05, .012, m.steel);
  part(.20, .03, 0, .07, .40, .44, m.block);
  part(.39, .09, 0, .38, .34, .36, m.block);
  part(.38, -.12, 0, .34, .14, .24, m.block);                       // sump, the lowest part, 191 mm below the crankshaft
  part(.40, .32, -.02, .34, .14, .30, m.block);
  part(.42, .405, -.02, .30, .05, .18, m.black);                     // rocker cover
  part(.24, .34, .06, .10, .14, .20, m.black);                       // intake silencer
  cyl(.52, .45, .04, .018, .04, m.orange, 'v');                      // oil filler cap
  // big grey belt cover on the front, with YANMAR cast in, and the alternator and sea-water pump
  part(.70, .10, -.01, .06, .46, .46, m.cover);
  cyl(.66, .27, -.21, .06, .11, m.cover); cyl(.70, -.10, .20, .045, .07, m.cover);
  cyl(.45, .22, .21, .065, .34, m.block);                            // heat exchanger along the starboard side
  cyl(.56, .14, -.27, .035, .14, m.black, 'v');                      // fuel filter
  // mounts on white GRP beds that run down to the hull
  [.168, .58].forEach(u => [1, -1].forEach(s => part(u, -.105, s*.21, .206, .06, .07, m.rubber)));
  [1, -1].forEach(s => {
    const w = s*.21, xs = span(P(.06, 0, 0)[0], P(.70, 0, 0)[0], 10);
    igrid(xs.map(x => {
      const u = (x - cx)/ct, top = P(u, -.135, 0)[1];
      let lo = top; while (lo > keelY(x) - .2 && hullHalf(x, lo) > Math.abs(w) + .04) lo -= .01;    // down to the hull
      return [[x, top, w - .04], [x, top, w + .04], [x, lo + .01, w + .04]];
    }), m.gel);
  });
  // shaft from the coupling down to the stern tube
  const ex = 1.15, [sx, sy] = shaftLine.at(ex);
  rod(IG, [cx, cy, 0], [sx, sy, 0], .015, m.steel, 12);

  // compartment: foil-lined sides on the head and aft-cabin walls, mahogany panel above the front
  const x0 = P(-.05, 0, 0)[0], x1 = INT.steps.topX - .02, top = CP.sole - .05, bot = P(.3, -.2, 0)[1];
  [[INT.head.inner - .006, 1], [INT.aftCabin.wall + .006, -1]].forEach(([z]) => igrid(span(x0, x1, 4).map(x => [[x, bot, z], [x, top, z]]), m.foil));
})();
