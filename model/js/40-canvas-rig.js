/* Navy canvas, rig, guard rails, stern gear and bow gear. */

/* Navy sprayhood forward of the arch; bimini with a closed side enclosure aft of it. */
mat.clearCanvas = M('#b4c5c8', { roughness: .08, metalness: .1, transparent: true, opacity: .3, depthWrite: false });
(function canvasWork() {
  const Q = SPEC.canvas, top = SC.top, frontX = top[0][0], archX = TG.topX - .015;
  const edge = x => {
    for (let i = 0; i < top.length - 1; i++) { const [x0, z0] = top[i], [x1, z1] = top[i + 1]; if (x <= x0 && x >= x1 && x0 !== x1) return lerp(z0, z1, (x0 - x)/(x0 - x1)); }
    return x > top[1][0] ? top[1][1] : top[top.length - 1][1];
  };
  const clearPane = (rows) => { const m = grid(G.canvas, rows, mat.clearCanvas, { noShadow: true }); m.renderOrder = 2; m.castShadow = false; };
  const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => lerp(a, b, i/n));

  /* Sprayhood */
  const hx = f => lerp(frontX, archX, f), hy = f => lerp(Q.hoodFrontY, TG.topY + .005, smooth(f));
  const hoodSide = (f, v, s) => { const x = hx(f), w = Math.min(edge(x), TG.topHalf - .012); return [x, lerp(SC.topY, hy(f) - .035, v), s*w*lerp(1.004, .975, v)]; };
  const hoodF = [...range(0, 1, 44), (frontX - top[2][0])/(frontX - archX)].sort((a, b) => a - b);
  grid(G.canvas, hoodF.map(f => { const x = hx(f), w = Math.min(edge(x), TG.topHalf - .012)*.975, y = hy(f); return range(-1, 1, 28).map(q => [x, y - .035*Math.pow(Math.abs(q), 3.4), q*w]); }), mat.canvas);
  grid(G.canvas, range(-1, 1, 28).map(q => { const w = edge(frontX)*.975; return [[frontX, SC.topY, q*w], [frontX + .004, Q.hoodFrontY - .035*Math.pow(Math.abs(q), 3.4), q*w]]; }), mat.canvas);
  const H = Q.hoodWindow, hoodPatch = (s, f0, f1, v0, v1, m) => {
    const fs = [...range(f0, f1, 18), ...hoodF.filter(f => f > f0 && f < f1)].sort((a, b) => a - b), rows = fs.map(f => range(v0, v1, 3).map(v => hoodSide(f, v, s)));
    m ? grid(G.canvas, rows, m) : clearPane(rows);
  };
  [1, -1].forEach(s => {
    hoodPatch(s, 0, 1, 0, H.v[0], mat.canvas); hoodPatch(s, 0, 1, H.v[1], 1, mat.canvas);
    hoodPatch(s, 0, H.f[0], H.v[0], H.v[1], mat.canvas); hoodPatch(s, H.f[1], 1, H.v[0], H.v[1], mat.canvas);
    hoodPatch(s, H.f[0], H.f[1], H.v[0], H.v[1], null);
    // stainless grab rail along the top of the glass
    tube(G.canvas, range(.02, .98, 14).map(f => { const p = hoodSide(f, 0, s); return [p[0], SC.topY + .03, p[2] + s*.016]; }), .009, mat.steel);
  });

  /* Bimini roof line in side view: arch, knee, raked aft end */
  const A = [TG.topX - .02, TG.topY + .012], K = [Q.kneeX, Q.kneeY], E = [Q.aftX, Q.aftY], r = .14;
  const toward = (a, b, d) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [a[0] + (b[0] - a[0])*d/l, a[1] + (b[1] - a[1])*d/l]; };
  const K1 = toward(K, A, r), K2 = toward(K, E, r), l1 = Math.hypot(K1[0] - A[0], K1[1] - A[1]), l3 = Math.hypot(E[0] - K2[0], E[1] - K2[1]), l2 = r*1.7, total = l1 + l2 + l3;
  const prof = t => {
    const d = t*total;
    if (d <= l1) return [lerp(A[0], K1[0], d/l1), lerp(A[1], K1[1], d/l1)];
    if (d >= l1 + l2) { const q = (d - l1 - l2)/l3; return [lerp(K2[0], E[0], q), lerp(K2[1], E[1], q)]; }
    const q = (d - l1)/l2, u = 1 - q; return [u*u*K1[0] + 2*u*q*K[0] + q*q*K2[0], u*u*K1[1] + 2*u*q*K[1] + q*q*K2[1]];
  };
  const halfAt = x => Math.min(TG.topHalf - .015, Math.max(roofHalf(x) - .03, .3));
  const sidePt = (t, v, s, off = 0) => {
    const [tx, ty] = prof(t), bx = lerp(TG.baseX + .04, Q.aftX, t), wb = Math.min(halfAt(bx) + .012, roofHalf(bx) - .012), by = roofY(bx, wb) + .004;
    return [lerp(bx, tx, v), lerp(by, ty, v), s*(lerp(wb, halfAt(tx), v) + off)];
  };
  const patch = (s, t0, t1, v0, v1, m) => {
    const rows = range(t0, t1, Math.max(4, Math.ceil((t1 - t0)*70))).map(t => range(v0, v1, 3).map(v => sidePt(t, v, s, m ? 0 : .002)));
    m ? grid(G.canvas, rows, m) : clearPane(rows);
  };
  // roof and flat aft side, with the large clear window in the aft side
  const tK = (l1 + l2)/total, roofPt = (t, q) => {
    const [x, y] = prof(t), c = Q.crown*(1 - smooth((t - tK + .08)/.1));
    return [x, y + c*(1 - Math.pow(Math.abs(q), 2.6)), q*halfAt(x)];
  };
  const roofPatch = (t0, t1, q0, q1, m) => {
    const rows = range(t0, t1, Math.max(3, Math.ceil((t1 - t0)*70))).map(t => range(q0, q1, Math.max(2, Math.ceil((q1 - q0)*15))).map(q => roofPt(t, q)));
    m ? grid(G.canvas, rows, m) : clearPane(rows);
  };
  const W = Q.aftWindow, wA = tK + W.afterKnee, wB = W.end, wq = W.halfWidth;
  roofPatch(0, wA, -1, 1, mat.canvas); roofPatch(wB, 1, -1, 1, mat.canvas);
  roofPatch(wA, wB, -1, -wq, mat.canvas); roofPatch(wA, wB, wq, 1, mat.canvas); roofPatch(wA, wB, -wq, wq, null);
  const last = range(-1, 1, 30).map(q => roofPt(1, q));   // closed band below the window, down to the coaming
  const [vA, vB] = Q.windowV, [w1] = Q.windows;
  [1, -1].forEach(s => {
    patch(s, 0, 1, 0, vA, mat.canvas); patch(s, 0, 1, vB, 1, mat.canvas);
    patch(s, 0, w1[0], vA, vB, mat.canvas); patch(s, w1[1], 1, vA, vB, mat.canvas);
    patch(s, w1[0], w1[1], vA, vB, null);
    // snap rail along the coaming
    tube(G.canvas, range(.01, .99, 22).map(t => { const p = sidePt(t, .025, s, .008); return p; }), .006, mat.steel);
    for (let i = 0; i < 9; i++) { const p = sidePt(.05 + i*.11, .065, s, .006), b = put(G.canvas, new T.SphereGeometry(.009, 8, 6), mat.steel); b.position.set(p[0], p[1], p[2]); }
  });
  // stainless bow inside the enclosure, visible through the windows
  const bowT = .27, bow = [...range(-1, 1, 14).map(q => { const [x, y] = prof(bowT), w = halfAt(x) - .03; return [x, y + (Q.crown - .03)*(1 - q*q) - .012, q*w]; })];
  tube(G.canvas, bow, .009, mat.steel);
  [1, -1].forEach(k => { const p = sidePt(bowT, 1, k, -.03), b = sidePt(.14, .03, k, -.03); rod(G.canvas, [p[0], p[1] - .012, p[2]], b, .009, mat.steel); });
})();

/* ---------- Rig ---------- */
const RG = SPEC.rig;
function chainplate(x, s) { const z = s*(halfB(x) - RG.chainplateInset); return [x, deckY(x, z) + .03, z]; }
(function rig() {
  const [mL, mW] = RG.mastSize, mx = RG.mastX, foot = roofY(mx, 0);
  const sh = new T.Shape(); sh.absellipse(0, 0, mL/2, mW/2, 0, Math.PI*2);
  const mast = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: RG.mastTop - foot, bevelEnabled: false, curveSegments: 22 }), mat.alu);
  mast.rotation.x = -Math.PI/2; mast.position.set(mx, foot, 0); mast.castShadow = true; G.rig.add(mast);
  box(G.rig, [mx, foot + .025, 0], [.27, .05, .19], mat.steel);                    // mast collar
  box(G.rig, [mx, RG.mastTop + .025, 0], [.3, .05, .13], mat.dark);               // masthead box
  rod(G.rig, [mx - .05, RG.mastTop + .05, 0], [mx - .05, RG.mastTop + .85, 0], .005, mat.dark);   // VHF whip
  const wind = [mx + .1, RG.mastTop + .22, 0]; rod(G.rig, [mx + .05, RG.mastTop + .05, 0], wind, .007, mat.dark);
  rod(G.rig, [wind[0] - .12, wind[1], 0], [wind[0] + .12, wind[1], 0], .004, mat.dark);

  const top = [mx + .02, RG.mastTop - .03, 0];
  [1, -1].forEach(s => {
    const tips = RG.spreaders.map(([y, l]) => {
      const t = [mx - RG.spreaderSweep*l, y, s*l];
      rod(G.rig, [mx, y, s*mW/2], t, .026, mat.alu, 10, .012);
      return t;
    });
    const cp = chainplate(mx, s), fl = chainplate(mx + .62, s), al = chainplate(mx - .62, s);
    const wire = (a, b, r = .0042) => rod(G.rig, a, b, r, mat.wire, 6);
    wire(top, tips[1]); wire(tips[1], tips[0]); wire(tips[0], cp);                // cap shroud
    wire([mx, RG.spreaders[1][0] - .05, s*mW/2], tips[0]); // intermediate
    wire([mx, RG.spreaders[0][0] - .05, s*mW/2], fl); wire([mx, RG.spreaders[0][0] - .05, s*mW/2], al);
    [cp, fl, al].forEach(p => { box(G.rig, [p[0], p[1] - .012, p[2]], [.09, .03, .035], mat.steel); rod(G.rig, p, [p[0], p[1] + .19, p[2]*(1 - .19/15)], .009, mat.steel); });
  });

  // forestay, with the genoa furled in its blue UV strip
  const st = RG.stem, head = [mx + .1, RG.mastTop - .02, 0], foot2 = [st[0], st[1], 0];
  rod(G.rig, foot2, head, .005, mat.wire, 6);
  const dir = new V3(head[0] - st[0], head[1] - st[1], 0), at = f => [st[0] + dir.x*f, st[1] + dir.y*f, 0];
  rod(G.rig, at(.022), at(.965), RG.furlerR, mat.blue, 14, RG.furlerR*.42);
  rod(G.rig, at(0), at(.022), .05, mat.steel, 18);
  rod(G.rig, at(.965), at(.982), .02, mat.steel);
  box(G.rig, [(mx + RG.backstayTop[0])/2, RG.backstayTop[1], 0], [mx - RG.backstayTop[0] + .06, .03, .05], mat.alu);   // masthead crane
  rod(G.rig, [RG.backstayTop[0], RG.backstayTop[1], 0], [RG.backstay[0], RG.backstay[1], 0], .0045, mat.wire, 6);        // backstay
  box(G.rig, [RG.backstay[0], RG.backstay[1] - .02, 0], [.05, .05, .03], mat.steel);

  // boom
  const b = RG.boom, bs = new T.Shape(); bs.absellipse(0, 0, b.w/2, b.h/2, 0, Math.PI*2);
  const boom = new T.Mesh(new T.ExtrudeGeometry(bs, { depth: b.fwd - b.aft, bevelEnabled: false, curveSegments: 16 }), mat.alu);
  boom.rotation.y = Math.PI/2; boom.position.set(b.aft, b.y, 0); boom.castShadow = true; G.rig.add(boom);
  box(G.rig, [b.aft - .012, b.y, 0], [.035, b.h*.96, b.w*.96], mat.dark);
  box(G.rig, [b.fwd + .025, b.y, 0], [.11, .09, .075], mat.steel);
  rod(G.rig, [b.fwd - .75, b.y - b.h/2, 0], [mx + .05, foot + .2, 0], .021, mat.alu);            // kicker
  rod(G.rig, [b.aft + .34, b.y - b.h/2, 0], [TG.topX - .02, TG.topY + .03, 0], .006, mat.white);  // mainsheet

  const coverGroup = G.sailCover = new T.Group(); G.rig.add(coverGroup);
  // sail cover: tall at the mast, tapering aft, with lashing straps
  const nC = 40, cover = [], cY = b.y + b.h/2 - .02;
  for (let i = 0; i <= nC; i++) {
    const f = i/nC, x = lerp(mx - .1, RG.coverAft, f), h = lerp(.74, .22, Math.pow(f, .75)), w = lerp(.135, .085, f), fold = 1 + .05*Math.sin(f*38), r = [];
    for (let k = 0; k <= 18; k++) {
      const a = Math.PI*(k/18), yy = cY + h*Math.sin(a)*(1 + .0*fold), zz = -Math.cos(a)*w*(Math.sin(a) > .6 ? fold : 1);
      r.push([x, yy, zz]);
    }
    r.unshift([x, cY - .07, -w*.82]); r.push([x, cY - .07, w*.82]);
    cover.push(r);
  }
  grid(coverGroup, cover, mat.canvas);
  grid(coverGroup, [cover[0], cover[0].map(p => [p[0] + .01, cY + .1, 0])], mat.canvasD);
  grid(coverGroup, [cover[nC], cover[nC].map(p => [p[0] - .02, cY + .05, 0])], mat.canvasD);
  [.2, .45, .7].forEach(f => { const r = cover[Math.round(f*nC)]; tube(coverGroup, r.map(p => [p[0], p[1], p[2]*1.035]).filter((_, k) => k%2 === 0), .005, mat.dark); });
})();

/* Lowrance 3G radome on a Scanstrut SC20 mount, on the front of the mast just above the lower spreaders. */
const RADAR = (() => {
  const q = RG.radar, m = q.mount, k = q.diameter/.489, mx = RG.mastX, nose = mx + RG.mastSize[0]/2, cx0 = (m.holeX[0] + m.holeX[1])/2;
  const pinX = nose + q.mastGap + q.diameter/2 - cx0, y0 = RG.spreaders[0][0] + q.aboveSpreader, cx = pinX + cx0, g = new T.Group();
  g.position.set(pinX, y0, 0); G.rig.add(g);                 // local x = forward from the pins, y = 0 on the top of the plate

  // radome outline from the maker's dimension drawing: [radius, height]
  const outline = [[0, 0], [.160, 0], [.190, .010], [.222, .030], [.240, .047], [.2445, .058], [.2425, .080], [.207, .250], [.203, .258], [.196, .266], [.183, .272], [.120, .277], [0, .280]].map(([r, y]) => [r*k, y*q.height/.28]);
  const radiusAt = y => { for (let i = 5; i < outline.length - 1; i++) if (y <= outline[i + 1][1]) return lerp(outline[i][0], outline[i + 1][0], (y - outline[i][1])/(outline[i + 1][1] - outline[i][1])); return 0; };
  const dome = put(g, new T.LatheGeometry(outline.map(([r, y]) => new T.Vector2(r, y)), 64), mat.white); dome.position.set(cx0, 0, 0);
  // cover joint, lower at the front than at the back as in the drawing
  const joint = []; for (let i = 0; i <= 64; i++) { const a = i/64*Math.PI*2, y = .066 - .017*Math.cos(a), r = (y < .058 ? lerp(.240, .2445, (y - .047)/.011)*k : radiusAt(y)) + .0015; joint.push([cx0 + r*Math.cos(a), y, r*Math.sin(a)]); }
  tube(g, joint, .0022, mat.dark, true, 6);

  // LOWRANCE in blue on port and starboard
  const c = document.createElement('canvas'); c.width = 1024; c.height = 180;
  const t = c.getContext('2d'); t.fillStyle = '#1558b0'; t.font = 'italic 900 138px Arial Black, Arial, sans-serif'; t.textAlign = 'center'; t.textBaseline = 'middle'; t.fillText('LOWRANCE', 512, 94, 990);
  const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 12;
  const logoMat = new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: .4, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  [1, -1].forEach(s => {
    const span = .68, yA = .135, yB = .185, rows = [], uv = [];
    for (let j = 0; j <= 2; j++) { const y = lerp(yA, yB, j/2), r = radiusAt(y) + .0012, row = []; for (let i = 0; i <= 24; i++) { const a = (i/24 - .5)*span; row.push([cx0 + r*Math.sin(a), y, s*r*Math.cos(a)]); uv.push(s > 0 ? i/24 : 1 - i/24, j/2); } rows.push(row); }
    const d = gridGeo(rows); d.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); const q2 = put(g, d, logoMat, false); q2.renderOrder = 3;
  });

  // SC20 plate: narrow at the mast, round at the forward end
  const W = m.width/2, R = W, tip = m.length - R, h = m.pinSpacing/2, plate = new T.Shape();
  plate.moveTo(0, h + .012); plate.bezierCurveTo(.07, h + .018, .13, W - .03, tip, W); plate.absarc(tip, 0, R, Math.PI/2, -Math.PI/2, true); plate.bezierCurveTo(.13, -W + .03, .07, -h - .018, 0, -h - .012); plate.closePath();
  const pg = new T.Mesh(new T.ExtrudeGeometry(plate, { depth: .006, bevelEnabled: false, curveSegments: 18 }), mat.white); pg.rotation.x = -Math.PI/2; pg.position.y = -.006; pg.castShadow = true; g.add(pg);
  m.holeX.forEach(x => [1, -1].forEach(s => { const b = put(g, new T.CylinderGeometry(.0095, .0095, .012, 10), mat.steel); b.position.set(x, -.012, s*m.holeWidth/2); }));

  const yPad = (m.height - m.armDrop)/2;
  [1, -1].forEach(s => {
    const z = s*h, lo = [0, -m.armDrop, z];
    rod(g, lo, [m.length - .03, -.008, s*.05], .012, mat.white, 10, .005);                 // lower arm running out under the plate
    tube(g, [[.012, -m.armDrop + .006, z], [.045, -.085, s*.05], [.052, -.04, s*.05], [.085, -.008, s*.055]], .005, mat.white, false, 6);
    rod(g, [.03, -m.armDrop + .012, z], [.17, -.008, s*(W - .022)], .008, mat.white, 8, .004);   // side web
    [0, -m.armDrop].forEach(y => {                                                         // mast fittings
      const pad = new T.Shape(); pad.moveTo(0, yPad); pad.lineTo(.018, .012); pad.lineTo(.018, -.012); pad.lineTo(0, -yPad); pad.lineTo(-.018, -.012); pad.lineTo(-.018, .012); pad.closePath();
      const f = put(g, new T.ExtrudeGeometry(pad, { depth: .016, bevelEnabled: false }), mat.dark); f.position.set(-.018, y, z - .008);
      const pin = put(g, new T.CylinderGeometry(.0065, .0065, .026, 10), mat.steel); pin.rotation.x = Math.PI/2; pin.position.set(0, y, z);
      const zM = s*Math.min(h, RG.mastSize[1]/2 - .004), xM = (mx - pinX) + (RG.mastSize[0]/2)*Math.sqrt(Math.max(0, 1 - Math.pow(zM/(RG.mastSize[1]/2), 2)));
      rod(g, [-.012, y, z], [xM, y, zM], .009, mat.steel, 8);                              // link back to the mast wall
    });
  });
  const bottom = y0, mountBottom = y0 - m.armDrop - yPad;
  return { bottom, top: y0 + q.height, spreaderGap: mountBottom - (RG.spreaders[0][0] + .026), mastGap: cx - q.diameter/2 - nose, name: q.name, mount: m.name, kg: q.kg, diameter: q.diameter, height: q.height };
})();

/* ---------- Guard rails ---------- */
(function rails() {
  const R = SPEC.rails, P = R.pulpit, Q = R.pushpit, rail = (x, s) => { const z = s*(deckHalf(x) - R.inset); return [x, deckY(x, z), z]; };
  const posts = [];
  [1, -1].forEach(s => {
    const list = R.stanchions.map(x => {
      const b = rail(x, s), t = [x, b[1] + R.height, b[2]*.985];
      rod(G.rails, b, t, .0125, mat.steel, 10);
      const f = put(G.rails, new T.CylinderGeometry(.034, .04, .022, 14), mat.steel); f.position.set(b[0], b[1] + .011, b[2]);
      return { b, t };
    });
    posts.push(list);
    const pulpitAft = [P.aftX, deckY(P.aftX, 0) + R.height + .03, s*(deckHalf(P.aftX) - R.inset)];
    const pushFwd = [Q.foreX, Q.topY - .02, s*(deckHalf(Q.foreX) - R.inset)*.985];
    R.wires.forEach(h => {
      const k = h/R.height, seq = [[pushFwd[0], lerp(deckY(Q.foreX, pushFwd[2]), pushFwd[1], k), pushFwd[2]], ...list.slice(1).map(q => [q.b[0], lerp(q.b[1], q.t[1], k), q.t[2]]), [pulpitAft[0], lerp(deckY(P.aftX, pulpitAft[2]), pulpitAft[1], k), pulpitAft[2]]];
      for (let i = 0; i < seq.length - 1; i++) rod(G.rails, seq[i], seq[i + 1], .0032, mat.wire, 5);
    });
  });

  // pulpit: wide, flat, projecting over the stem as in the drawing
  const top = s => [[P.aftX, deckY(P.aftX, 0) + R.height + .03, s*(deckHalf(P.aftX) - R.inset)], [9.914, P.topY - .025, s*.47], [10.514, P.topY, s*.37], [10.864, P.topY + .005, s*.24], [P.frontX, P.topY + .005, s*.05]];
  const loop = [...top(-1), ...top(1).reverse().slice(1)].map(p => p);
  tube(G.rails, loop, .0135, mat.steel, false, 10);
  const mid = loop.map(p => [p[0] - .01, lerp(deckY(Math.min(p[0], L), 0), p[1], .52), p[2]*.97]);
  tube(G.rails, mid, .0105, mat.steel, false, 8);
  [1, -1].forEach(s => {
    const c = top(s);
    rod(G.rails, [c[0][0], deckY(c[0][0], c[0][2]), c[0][2]], c[0], .0135, mat.steel);
    const xf = 10.224, zf = s*Math.max(deckHalf(xf) - .05, .08);
    rod(G.rails, [xf, deckY(xf, zf), zf], [10.514, P.topY - .005, s*.37], .0135, mat.steel);
    rod(G.rails, [9.644, deckY(9.644, s*.2), s*.2], [9.924, P.topY - .03, s*.45], .011, mat.steel);
  });

  // pushpit: double rail across the stern with a central boarding gate
  const yt = Q.topY, stern = s => {
    const z = s*(deckHalf(Q.foreX) - R.inset)*.985, xs = [[Q.foreX, z], [.30, s*1.04], [.13, s*.92], [.07, s*.46]];
    return xs.map(([x, q]) => [x, yt, q]);
  };
  [1, -1].forEach(s => {
    const line = stern(s);
    tube(G.rails, line, Q.tube/2, mat.steel, false, 10);
    tube(G.rails, line.map(p => [p[0], lerp(deckY(p[0], p[2]), yt, .52), p[2]]), Q.tube/2, mat.steel, false, 10);
    line.forEach((p, i) => { if (i === 2 || i === 0 || i === 3) { const x = Math.max(p[0], HS.transomCurve*p[2]*p[2] + .05), z = p[2], b = [x, deckY(x, z), z]; rod(G.rails, b, [p[0], yt, p[2]], Q.tube/2, mat.steel); } });
    const g = line[3];
    tube(G.rails, [[g[0], yt, g[2]], [g[0] - .012, yt + .05, g[2]*.6], [g[0] - .012, yt + .05, 0]], Q.tube/2, mat.steel);
    rod(G.rails, [g[0], yt - .34, g[2]], [g[0], yt - .34, 0], Q.tube/2, mat.steel);
  });
})();

/* Flags are animated in place; nothing else on the boat moves. */
const FLAGS = [];
function waveFlags(t) {
  FLAGS.forEach(F => {
    for (let q = F.mesh; q; q = q.parent) if (!q.visible) return;
    const p = F.mesh.geometry.attributes.position, { base, tip, W, n } = F;
    let o = 0;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= 6; j++, o++) {
      const f = i/n, h = lerp(.5, .985, j/6), amp = .095*Math.min(1, f*2.6)*(.75 + .25*Math.sin(t*.43));
      const w = Math.sin(f*6.2 - t*3.1 + j*.13) + .35*Math.sin(f*11.5 - t*4.7 + j*.3);
      p.setXYZ(o, lerp(base[0], tip[0], h) - f*W*(.97 + .02*Math.sin(t*1.1 + f*3)), lerp(base[1], tip[1], h) - f*f*.1 + .018*f*Math.sin(f*4.5 - t*2.3), base[2] + amp*w);
    }
    p.needsUpdate = true; F.mesh.geometry.computeVertexNormals();
  });
}
function ensign(parent, base, tip) {
  rod(parent, base, tip, .013, mat.teakDark);
  const rows = [], W = .98, n = 22, uv = [];
  for (let i = 0; i <= n; i++) {
    const f = i/n, r = [];
    for (let j = 0; j <= 6; j++) {
      const q = lerp(.5, .985, j/6);
      r.push([lerp(base[0], tip[0], q) - f*W, lerp(base[1], tip[1], q) - f*f*.10, base[2] + Math.sin(f*5.4 + j*.12)*.075*Math.min(1, f*3.2)]);
      uv.push(f, j/6);
    }
    rows.push(r);
  }
  const g = gridGeo(rows); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.attributes.position.setUsage(T.DynamicDrawUsage);
  FLAGS.push({ mesh: put(parent, g, mat.flag, false), base, tip, W, n });
}
function antenna(parent, base, top) {
  rod(parent, base, top, .018, mat.steel);
  const d = put(parent, new T.SphereGeometry(.16, 26, 14), mat.white); d.position.set(top[0], top[1] + .09, top[2]); d.scale.y = .42;
}

/* ---------- Stern gear (photo of the haul-out) ---------- */
(function sternGear() {
  const P = SPEC.platform, A = P.anchor, w0 = P.halfWidth, w1 = P.aftHalfWidth, plat = new T.Group(); G.hull.add(plat);
  const inner = z => transomX(P.y, z) - .002;
  const outer = z => {                                  // convex aft edge with rounded corners
    const q = Math.abs(z) - (w1 - P.corner), c = q > 0 ? P.corner - Math.sqrt(Math.max(0, P.corner*P.corner - q*q)) : 0;
    return -P.depth - P.bulge*(1 - (z/w1)*(z/w1)) + c;
  };
  // teak deck flares outward from the transom; planks follow the curve of the aft edge
  const nz = 64, nd = 12, top = [], under = [], uv = [];
  for (let i = 0; i <= nz; i++) {
    const a = Math.sin((-1 + 2*i/nz)*Math.PI/2), x0 = inner(a*w0), x1 = outer(a*w1), r = [], b = [];
    for (let j = 0; j <= nd; j++) { const f = j/nd, x = lerp(x0, x1, f), z = a*lerp(w0, w1, f); r.push([x, P.y, z]); b.push([x, P.y - P.thick, z]); uv.push(a*w1/3.4, f*P.depth/(P.plank*8)); }
    top.push(r); under.push(b);
  }
  const tg = gridGeo(top); tg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); const platTeak = mat.teak.clone(); platTeak.color.setScalar(.62); put(plat, tg, platTeak);   // more weathered than the deck
  grid(plat, under, mat.teakRail);
  grid(plat, top.map((r, i) => [r[nd], under[i][nd]]), mat.teakRail);
  tube(plat, top.map(r => [r[0][0] - .006, P.y + .006, r[0][2]]).filter((_, i) => i%2 === 0), .007, mat.white);    // light trim against the transom
  box(plat, [outer(-.1) + .09, P.y + .009, -.1], [.05, .018, .34], mat.teakRail);                                 // raised strip

  // stainless edge tube from flange to flange, around the flared sides and aft edge
  const edgeZ = w0 + .035, edgeY = P.y + .025, path = [[transomX(edgeY, -edgeZ), edgeY, -edgeZ]];
  for (let i = 1; i <= 3; i++) { const f = i/4; path.push([lerp(transomX(edgeY, -edgeZ), outer(-w1 + .01), f), lerp(edgeY, P.y + .004, f), lerp(-edgeZ, -w1 - .012, f)]); }
  for (let i = 0; i <= 48; i++) { const a = -1 + 2*i/48, z = (w1 + .012)*Math.sin(a*Math.PI/2); path.push([outer(z*w1/(w1 + .012)) - .012, P.y + .004, z]); }
  for (let i = 3; i >= 1; i--) { const f = i/4; path.push([lerp(transomX(edgeY, edgeZ), outer(w1 - .01), f), lerp(edgeY, P.y + .004, f), lerp(edgeZ, w1 + .012, f)]); }
  path.push([transomX(edgeY, edgeZ), edgeY, edgeZ]);
  tube(plat, path, P.tube/2, mat.steel, false, 10);
  const flange = (x, y, z, r = .032) => { const m = put(plat, new T.CylinderGeometry(r, r, .012, 22), mat.steel); m.rotation.z = Math.PI/2; m.position.set(x - .004, y, z); };
  [1, -1].forEach(s => {
    flange(transomX(edgeY, s*edgeZ), edgeY, s*edgeZ);
    // corner post with a white fitting, and a diagonal stay up to the transom
    const cx = outer(s*(w1 - .05)) + .05, cz = s*(w1 - .025), py = P.y + P.postHeight, sz = s*(w0 + .12);
    rod(plat, [cx, P.y, cz], [cx, py, cz], P.tube/2, mat.steel, 10);
    box(plat, [cx + .012, py + .008, cz], [.12, .026, .08], mat.dark);
    const fit = put(plat, new T.CylinderGeometry(.033, .033, .07, 18), mat.white); fit.rotation.x = Math.PI/2; fit.position.set(cx, py + .052, cz);
    rod(plat, [cx + .05, py + .012, cz], [transomX(P.stayTopY, sz), P.stayTopY, sz], .011, mat.steel, 10);
    flange(transomX(P.stayTopY, sz), P.stayTopY, sz, .026);
  });

  // claw anchor: shank over a white roller at the port corner, head hanging aft of it
  const metal = M('#6d6a57', { roughness: .68, metalness: .35 });
  const rx = outer(A.z) - .005, ry = P.y + .075, anchorZ = A.z, splay = Math.atan2(w1 - w0, P.depth);
  const roller = put(plat, new T.CylinderGeometry(.036, .036, .11, 20), mat.white); roller.rotation.x = Math.PI/2; roller.position.set(rx, ry - .04, anchorZ);
  [1, -1].forEach(k => rod(plat, [rx + .07, P.y + .006, anchorZ + k*.062], [rx, ry - .04, anchorZ + k*.062], .006, mat.steel, 8));
  const eL = A.shank, eH = .15, sh = new T.Shape();          // shank and centre claw, drawn from the roller
  sh.moveTo(eL, eH + .042); sh.lineTo(.06, .055); sh.lineTo(-.035, .02); sh.lineTo(-.1, -.1); sh.lineTo(-.085, -A.drop + .015);
  sh.lineTo(.008, -A.drop + .012); sh.lineTo(.03, -.07); sh.lineTo(.08, -.022); sh.lineTo(eL, eH - .042); sh.closePath();
  const shank = new T.Group(); shank.position.set(rx, ry, anchorZ); shank.rotation.y = -splay; plat.add(shank);
  const plate = put(shank, new T.ExtrudeGeometry(sh, { depth: .024, bevelEnabled: true, bevelSize: .003, bevelThickness: .003, bevelSegments: 1 }), metal); plate.position.z = -.012;
  const clawSpan = 1.25, claw = [];
  for (let i = 0; i <= 38; i++) {
    const t = -1 + 2*i/38, a = t*clawSpan, cz = anchorZ + A.spread*Math.sin(a)/Math.sin(clawSpan), cy = ry - A.drop + (A.drop - .025)*(1 - Math.cos(a))/(1 - Math.cos(clawSpan));
    const wid = .125*Math.pow(1 - t*t, .5) + .006, nz2 = -Math.sin(a), ny = Math.cos(a), cx0 = rx - .05 + .05*t*t, ring = [];
    for (let k = 0; k <= 12; k++) { const f = k/12*Math.PI*2, th = .015*Math.sin(f); ring.push([cx0 + wid*Math.cos(f), cy + ny*th, cz + nz2*th]); }
    claw.push(ring);
  }
  grid(plat, claw, metal);
  const ex = rx + eL*Math.cos(splay), ey = ry + eH, ez = anchorZ + eL*Math.sin(splay);
  const bar = put(plat, new T.CylinderGeometry(.012, .012, .05, 10), mat.steel); bar.rotation.x = Math.PI/2; bar.position.set(ex - .012, ey, ez);
  const tz0 = ez + .1, tx0 = transomX(.86, tz0);
  tube(plat, [[ex, ey, ez], [ex + .025, ey + .05, ez + .02], [lerp(ex, tx0, .65), .8, lerp(ez, tz0, .65)], [tx0 - .012, .86, tz0]], .006, mat.wire, false, 6);
  box(plat, [tx0 - .012, .865, tz0], [.035, .055, .05], mat.white);

  // transom fittings from the photo
  const ring = (y, z, r) => { const x = transomX(y, z) - .004, m = put(G.hull, new T.TorusGeometry(r, r*.26, 8, 22), mat.steel); m.position.set(x, y, z); m.rotation.y = Math.PI/2; const d = put(G.hull, new T.CircleGeometry(r, 18), mat.dark, false); d.position.set(x + .001, y, z); d.rotation.y = -Math.PI/2; };
  ring(.985, -.86, .024); ring(.985, -.72, .024);
  const disc = put(G.hull, new T.CylinderGeometry(.062, .066, .018, 28), mat.white); disc.rotation.z = Math.PI/2; disc.position.set(transomX(.89, .06) - .008, .89, .06);
  const discIn = put(G.hull, new T.TorusGeometry(.034, .004, 6, 24), M('#b9bcb8')); discIn.rotation.y = Math.PI/2; discIn.position.set(transomX(.89, .06) - .019, .89, .06);
  // exhaust outlet on the starboard quarter
  const ex2 = .24, ey2 = .36, ez2 = hullHalf(ex2, ey2) + .004;
  const out = put(G.hull, new T.TorusGeometry(.04, .011, 8, 24), mat.steel); out.position.set(ex2, ey2, ez2);
  const hole = put(G.hull, new T.CircleGeometry(.04, 20), mat.dark, false); hole.position.set(ex2, ey2, ez2 - .001);
  // ensign and antenna as they are today; the solar arch carries its own versions
  const fx = .12, fz = .74;
  ensign(G.asBuilt, [fx, deckY(fx, fz) + .02, fz], [-.34, 2.46, fz]);
  const az = -.86, ax = .32;
  antenna(G.asBuilt, [ax, deckY(ax, az) + .02, az], [ax - .05, 2.45, az]);
})();

/* ---------- Bow gear ---------- */
(function bowGear() {
  const x = L - .22, y = sheerY(x) + .01;
  // stemhead fitting and roller
  box(G.deck, [x, y + .012, 0], [.44, .03, .11], mat.steel);
  [1, -1].forEach(s => { const p = [[L - .44, y + .02, s*.055], [L - .02, y + .03, s*.05], [L + .16, y - .05, s*.05], [L + .08, y - .12, s*.05]]; tube(G.deck, p, .009, mat.steel); });
  const roller = put(G.deck, new T.CylinderGeometry(.04, .04, .085, 16), mat.dark); roller.rotation.x = Math.PI/2; roller.position.set(L + .09, y - .055, 0);
  // Bruce anchor stowed under the stem
  const a = new T.Group(); a.position.set(L + .09, y - .06, 0); a.rotation.z = .62; a.scale.setScalar(.6); G.deck.add(a);
  const shank = new T.Shape(); shank.moveTo(-.34, .01); shank.lineTo(.02, .03); shank.lineTo(.08, -.16); shank.lineTo(.02, -.20); shank.lineTo(-.03, -.03); shank.lineTo(-.34, -.015); shank.closePath();
  const sg = put(a, new T.ExtrudeGeometry(shank, { depth: .022, bevelEnabled: false }), mat.steel); sg.position.z = -.011;
  [1, -1].forEach(s => {
    const claw = gridGeo([[[.0, -.13, 0], [.0, -.22, s*.03]], [[.10, -.26, s*.05], [.0, -.30, s*.17]], [[.20, -.34, s*.11], [.06, -.33, s*.26]]]);
    put(a, claw, mat.steel);
  });
  // anchor locker lid outline
  const lx = L - .89, lid = new T.Mesh(new T.ExtrudeGeometry(roundRect(.42, .34, .05), { depth: .012, bevelEnabled: false }), mat.teakRail);
  lid.rotation.x = -Math.PI/2; lid.position.set(lx, deckY(lx, 0) + .001, 0); G.deck.add(lid);
  // navigation light on the pulpit
  [[1, '#2fbf5d'], [-1, '#d9303c']].forEach(([s, col]) => { const m = put(G.rails, new T.BoxGeometry(.075, .06, .04), M(col, { roughness: .25, emissive: C(col), emissiveIntensity: .25 })); m.position.set(L + .10, SPEC.rails.pulpit.topY - .012, s*.325); });
})();
