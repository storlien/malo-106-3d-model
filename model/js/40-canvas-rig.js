/* Navy canvas, rig, guard rails, stern gear and bow gear. */

/* Sprayhood between the windscreen and the arch, and the cockpit tent aft of it. */
(function canvasWork() {
  const top = SC.top, last = top[top.length - 1];
  const edge = x => {                       // half-width of the hood at station x, along the screen's top line
    for (let i = 0; i < top.length - 1; i++) {
      const [x0, z0] = top[i], [x1, z1] = top[i + 1];
      if (x <= x0 && x >= x1 && x0 !== x1) return lerp(z0, z1, (x0 - x)/(x0 - x1));
    }
    return x > top[1][0] ? top[1][1] : last[1];
  };
  const hoodSec = (x, w, yEdge, yCrown) => {
    const r = [];
    for (let k = 0; k <= 28; k++) {
      const f = -1 + 2*k/28, a = Math.pow(Math.abs(f), 3.2);
      r.push([x, yEdge + (yCrown - yEdge)*(1 - a), Math.sign(f)*w*Math.pow(Math.abs(f), .9)]);
    }
    return r;
  };
  const rows = [];
  for (let i = 0; i <= 44; i++) {
    const f = i/44, x = lerp(top[1][0] + .0, TG.topX - .015, f), w = Math.min(lerp(edge(x), TG.topHalf - .01, smooth(f)*.5), TG.topHalf - .015);
    rows.push(hoodSec(x, w, lerp(SC.topY, TG.topY - .1, f), lerp(SC.topY + .1, TG.topY + .012, Math.pow(f, .8))));
  }
  // front lip back to the screen's top bar
  const front = rows[0].map(p => [top[0][0], SC.topY + (p[1] - SC.topY)*.12, p[2]*.98]);
  grid(G.canvas, [front, ...rows], mat.canvas);

  // lower valance: canvas from the side top rail down over the aft part of the side glass
  [1, -1].forEach(s => {
    const a = [], n = 18;
    for (let i = 0; i <= n; i++) {
      const f = i/n, x = lerp(last[0] + .02, TG.baseX + .16, f), z = s*lerp(last[1] + .005, TG.baseHalf - .03, f);
      const yT = lerp(SC.topY, TG.topY - .25, f), yB = lerp(SC.topY - .13, SC.baseY + .22, f);
      a.push([[x, yT + .015, z], [x, yB, z]]);
    }
    grid(G.canvas, a, mat.canvas);
    // side band under the glass line, as on the real hood
    const b = [];
    for (let i = 0; i <= n; i++) {
      const f = i/n, x = lerp(top[2][0] + .1, TG.baseX + .06, f), z = s*lerp(top[2][1] + .1, TG.baseHalf - .005, f);
      b.push([[x, lerp(SC.baseY + .04, SC.baseY + .13, f), z], [x, SC.baseY - .02, z*1.003]]);
    }
    grid(G.canvas, b, mat.canvasD);
  });

  // cockpit tent, from the arch to the aft coaming
  const A = SPEC.aftCanvas, tent = [], nT = 44, tW = x => Math.min(TG.topHalf - .015, Math.max(roofHalf(x) - .035, .3));
  for (let i = 0; i <= nT; i++) {
    const f = i/nT, x = lerp(TG.topX - .02, A.x1 + .06, f), w = tW(x)*lerp(.97, .86, smooth(f));
    const yC = lerp(TG.topY + .015, A.y1 + .62, Math.pow(f, 1.5)), yE = lerp(TG.topY - .15, A.y1 + .24, f);
    tent.push(hoodSec(x, w, yE, yC));
  }
  grid(G.canvas, tent, mat.canvas);
  [1, -1].forEach(s => {                    // tent sides with a clear window
    const a = [], b = [];
    for (let i = 0; i <= nT; i++) {
      const f = i/nT, x = lerp(TG.topX - .02, A.x1 + .06, f), w = tW(x)*lerp(.97, .86, smooth(f)), yE = lerp(TG.topY - .15, A.y1 + .24, f);
      const zB = s*Math.min(roofHalf(x) - .02, w + .06), yB = roofY(x, zB) + .004;
      a.push([[x, yE + .004, s*w], [x, yB, zB]]);
      if (x > .62 && x < 1.56) { const q = (x - .62)/.94, h = Math.sin(q*Math.PI); b.push([[x, lerp(yB, yE, .78), lerp(zB, s*w, .78) + s*.004], [x, lerp(yB, yE, .24 + .1*(1 - h)), lerp(zB, s*w, .24) + s*.004]]); }
    }
    grid(G.canvas, a, mat.canvas);
    if (b.length > 2) { const w = grid(G.canvas, b, mat.glass, { noShadow: true }); w.renderOrder = 2; }
  });
  // tent's aft wall
  const e = tent[nT], low = e.map(p => [A.x1 + .04, roofY(.6, p[2]*.7) + .004, p[2]*.98]);
  grid(G.canvas, [e, low], mat.canvasD);
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
  rod(G.rig, top, [RG.backstay[0], RG.backstay[1], 0], .0045, mat.wire, 6);        // backstay
  box(G.rig, [RG.backstay[0], RG.backstay[1] - .02, 0], [.05, .05, .03], mat.steel);

  // boom
  const b = RG.boom, bs = new T.Shape(); bs.absellipse(0, 0, b.w/2, b.h/2, 0, Math.PI*2);
  const boom = new T.Mesh(new T.ExtrudeGeometry(bs, { depth: b.fwd - b.aft, bevelEnabled: false, curveSegments: 16 }), mat.alu);
  boom.rotation.y = Math.PI/2; boom.position.set(b.aft, b.y, 0); boom.castShadow = true; G.rig.add(boom);
  box(G.rig, [b.aft - .012, b.y, 0], [.035, b.h*.96, b.w*.96], mat.dark);
  box(G.rig, [b.fwd + .025, b.y, 0], [.11, .09, .075], mat.steel);
  rod(G.rig, [b.fwd - .75, b.y - b.h/2, 0], [mx + .05, foot + .2, 0], .021, mat.alu);            // kicker
  rod(G.rig, [b.aft + .34, b.y - b.h/2, 0], [TG.topX - .02, TG.topY + .03, 0], .006, mat.white);  // mainsheet

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
  grid(G.rig, cover, mat.canvas);
  grid(G.rig, [cover[0], cover[0].map(p => [p[0] + .01, cY + .1, 0])], mat.canvasD);
  grid(G.rig, [cover[nC], cover[nC].map(p => [p[0] - .02, cY + .05, 0])], mat.canvasD);
  [.2, .45, .7].forEach(f => { const r = cover[Math.round(f*nC)]; tube(G.rig, r.map(p => [p[0], p[1], p[2]*1.035]).filter((_, k) => k%2 === 0), .005, mat.dark); });
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
    tube(G.rails, line, .0135, mat.steel, false, 10);
    tube(G.rails, line.map(p => [p[0], lerp(deckY(p[0], p[2]), yt, .52), p[2]]), .0105, mat.steel, false, 8);
    line.forEach((p, i) => { if (i === 2 || i === 0 || i === 3) { const x = Math.max(p[0], HS.transomCurve*p[2]*p[2] + .05), z = p[2], b = [x, deckY(x, z), z]; rod(G.rails, b, [p[0], yt, p[2]], .0135, mat.steel); } });
    const g = line[3];
    tube(G.rails, [[g[0], yt, g[2]], [g[0] - .012, yt + .05, g[2]*.6], [g[0] - .012, yt + .05, 0]], .01, mat.steel);
    rod(G.rails, [g[0], yt - .34, g[2]], [g[0], yt - .34, 0], .0095, mat.steel);
  });
})();

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
  const g = gridGeo(rows); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); put(parent, g, mat.flag);
}
function antenna(parent, base, top) {
  rod(parent, base, top, .018, mat.steel);
  const d = put(parent, new T.SphereGeometry(.16, 26, 14), mat.white); d.position.set(top[0], top[1] + .09, top[2]); d.scale.y = .42;
}

/* ---------- Stern gear (photo of the haul-out) ---------- */
(function sternGear() {
  const yP = .635, xB = .0;
  // fold-down teak platform on stainless brackets
  const py = yP, pw = .74;
  const plat = new T.Mesh(new T.BoxGeometry(.40, .025, pw*2), mat.teak.clone()); plat.position.set(xB - .22, py, 0); plat.castShadow = true; G.hull.add(plat);
  [1, -1].forEach(s => {
    rod(G.hull, [.03, py + .014, s*pw], [xB - .43, py + .014, s*pw], .012, mat.steel);
    rod(G.hull, [.03, py - .10, s*.62], [xB - .28, py - .012, s*.65], .012, mat.steel);
  });
  rod(G.hull, [xB - .43, py + .014, -pw], [xB - .43, py + .014, pw], .012, mat.steel);
  // boarding ladder
  [1, -1].forEach(s => {
    const z = s*.21;
    tube(G.hull, [[.05, py + .03, z], [.03, .95, z], [.015, 1.25, z], [.05, 1.42, z], [.20, 1.52, z]], .0125, mat.steel);
  });
  [.78, .96, 1.14].forEach(y => { const x = .025 - (y - .78)*.02; box(G.hull, [x - .05, y, 0], [.11, .014, .42], mat.steel); });
  // transom drain, fuel-vent and shore-power details from the photo
  const ring = (y, z, r) => { const x = transomX(y, z) - .004, m = put(G.hull, new T.TorusGeometry(r, r*.26, 8, 22), mat.steel); m.position.set(x, y, z); m.rotation.y = Math.PI/2; const d = put(G.hull, new T.CircleGeometry(r, 18), mat.dark, false); d.position.set(x + .001, y, z); d.rotation.y = -Math.PI/2; };
  ring(.56, .50, .034); ring(.92, -.58, .024);
  // outboard bracket with folded motor mount on port side
  const oz = -.92, ox = transomX(.84, oz);
  box(G.hull, [ox - .03, .84, oz], [.05, .16, .18], mat.steel);
  rod(G.hull, [ox - .03, .92, oz + .05], [ox - .34, .94, oz + .05], .014, mat.steel);
  rod(G.hull, [ox - .03, .92, oz - .05], [ox - .34, .94, oz - .05], .014, mat.steel);
  const cowl = put(G.hull, new T.SphereGeometry(.12, 18, 12), mat.dark); cowl.position.set(ox - .37, .98, oz); cowl.scale.set(1.25, .8, .85);
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
