/* Teak deck, toe rail, cabin trunk with coamings, cockpit, windscreen, hatches. */
const HO = SPEC.house, CP = SPEC.cockpit;
const teakUV = p => [p[0]/3.4, p[2]/(SPEC.deck.plank*8)];

/* Plan outline of the trunk at deck level, with rounded ends. */
function houseSide(x) { return Math.min(HO.maxHalf, Math.max(.05, halfB(x) - HO.sideDeck*(x > 5.66 ? 1 + (x - 5.66)*.06 : 1))); }
function houseHalf(x) {
  if (x <= HO.aft || x >= HO.fwd) return 0;
  const fR = 1.25, aR = .34; let k = 1;
  if (x > HO.fwd - fR) { const d = (x - (HO.fwd - fR))/fR; k = Math.pow(1 - Math.pow(d, 2.5), 1/2.5); }
  if (x < HO.aft + aR) { const d = (HO.aft + aR - x)/aR; k = Math.pow(1 - d*d*d, 1/3); }
  return houseSide(x)*k;
}
const toTopX = x => lerp(HO.topAft, HO.topFwd, (x - HO.aft)/(HO.fwd - HO.aft));
const fromTopX = x => lerp(HO.aft, HO.fwd, (x - HO.topAft)/(HO.topFwd - HO.topAft));
const roofHalf = x => houseHalf(fromTopX(x))*HO.tumble;
const roofY = (x, z) => { const w = Math.max(roofHalf(x), .2); return HO.roof + HO.roofCrown*Math.max(0, 1 - (z/w)*(z/w)); };

function stations(a, b, step, extra = []) {
  const xs = [...extra]; for (let x = a; x < b; x += step) xs.push(x); xs.push(b);
  return xs.filter(x => x >= a && x <= b).sort((p, q) => p - q).filter((x, i, l) => !i || x - l[i - 1] > 1e-4);
}
const endSamples = (a, b, n = 40) => { const o = []; for (let i = 0; i <= n; i++) { const f = (1 - Math.cos(Math.PI*i/n/2)); o.push(a + (b - a)*f*.2, b - (b - a)*f*.2); } return o; };

/* Deck: two strips from the trunk (or centreline) out to the rail. */
(function deck() {
  const ex = [...endSamples(HO.aft, HO.fwd)]; for (let i = 0; i <= 24; i++) ex.push(.45*(i/24)*(i/24));
  const xs = stations(0, L, .035, ex);
  [1, -1].forEach(s => {
    const rows = xs.map(x => {
      const o = deckHalf(x), a = Math.min(Math.max(houseHalf(x) - .006, 0), o), r = [];
      for (let k = 0; k <= 8; k++) { const z = lerp(a, o, k/8); r.push([x, deckY(x, z), s*z]); }
      return r;
    });
    grid(G.deck, rows, mat.teak, { uv: teakUV });
  });
})();

/* Toe rail, following the sheer and across the transom. */
(function toeRail() {
  const c = HS.transomCurve; let zc = 1; for (let k = 0; k < 30; k++) zc = halfB(c*zc*zc);
  const line = []; for (let i = 0; i <= 26; i++) { const z = zc*i/26; line.push([c*z*z, z]); }
  for (let x = c*zc*zc + .05; x < L - .01; x += .05) line.push([x, halfB(x)]);
  line.push([L, 0]);
  const h = SPEC.deck.toeRail.height, w = SPEC.deck.toeRail.width;
  [1, -1].forEach(s => {
    const rows = line.map((p, i) => {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      let nx = -(b[1] - a[1]), nz = b[0] - a[0]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      const y = sheerY(p[0]), at = (o, dy) => [p[0] + nx*o, y + dy, s*(p[1] + nz*o)];
      return [at(.006, -.022), at(.008, h - .012), at(0, h), at(-w + .008, h - .004), at(-w, .004), at(-w, -.005)];
    });
    grid(G.deck, rows, mat.teakRail);
  });
})();

/* Trunk walls: a loop from aft around to the front, on each side. */
const wallPt = (x, s, h) => {
  const z0 = houseHalf(x), y0 = deckY(x, z0) - .01, tx = toTopX(x), z1 = z0*HO.tumble, y1 = roofY(tx, z1);
  const k = h < .86 ? h/.86*.86 : h;                    // straight wall, rounded shoulder
  return [lerp(x, tx, k), lerp(y0, y1, h), s*(lerp(z0, z1, k) - .012*Math.pow(Math.max(0, h - .9)/.1, 2))];
};
(function walls() {
  const xs = stations(HO.aft + 1e-3, HO.fwd - 1e-3, .03, endSamples(HO.aft + 1e-3, HO.fwd - 1e-3));
  [1, -1].forEach(s => {
    const rows = xs.map(x => { const r = []; for (let k = 0; k <= 12; k++) r.push(wallPt(x, s, k/12)); return r; });
    grid(G.deck, rows, mat.gel);
    // navy stripe around the wall
    const b = HO.band, band = xs.filter(x => x >= b.from && x <= b.to).map(x => {
      const z0 = houseHalf(x), y0 = deckY(x, z0), tx = toTopX(x), y1 = roofY(tx, z0*HO.tumble), r = [];
      for (let k = 0; k <= 2; k++) {
        const y = lerp(b.y0, b.y1, k/2), h = clamp((y - y0)/(y1 - y0), 0, 1);
        const p = wallPt(x, s, h), nx = x < HO.aft + .34 ? -.004 : 0; r.push([p[0] + nx, y, p[2] + s*.003]);
      }
      return r;
    });
    grid(G.deck, band, mat.navy, { noShadow: true });
  });
})();

/* Roof: teak forward of the windscreen, cream around the cockpit. */
const cockpitHalf = x => {
  if (x <= CP.aft || x >= CP.fwd) return 0;
  const r = .16, d = Math.min(x - CP.aft, CP.fwd - x);
  return d >= r ? CP.halfWidth : (CP.halfWidth - r) + Math.sqrt(Math.max(0, r*r - (r - d)*(r - d)));
};
(function roof() {
  const ex = [HO.teakFrom, ...endSamples(CP.aft + 1e-3, CP.fwd - 1e-3, 18), ...endSamples(HO.topAft + 1e-3, HO.topFwd - 1e-3, 30)];
  const xs = stations(HO.topAft + 1e-3, HO.topFwd - 1e-3, .03, ex);
  const build = (list, m, uv) => [1, -1].forEach(s => {
    const rows = list.map(x => {
      const o = roofHalf(x) - .012, a = Math.min(cockpitHalf(x), o), r = [];
      for (let k = 0; k <= 10; k++) { const z = lerp(a, o, k/10); r.push([x, roofY(x, z) + .001, s*z]); }
      return r;
    });
    grid(G.deck, rows, m, uv ? { uv: teakUV } : undefined);
  });
  build(xs.filter(x => x <= HO.teakFrom + 1e-6), mat.gelDeck, false);
  build(xs.filter(x => x >= HO.teakFrom - 1e-6), mat.teak, true);
})();

/* Cockpit well: coaming walls, teak seats, footwell, sole, companionway bulkhead. */
(function cockpit() {
  const xs = stations(CP.aft + 1e-3, CP.fwd - 1e-3, .025, endSamples(CP.aft + 1e-3, CP.fwd - 1e-3, 14));
  [1, -1].forEach(s => {
    grid(G.deck, xs.map(x => { const z = cockpitHalf(x); return [[x, roofY(x, z), s*z], [x, CP.seat, s*z]]; }), mat.gelDeck);
    const foot = x => (x > CP.footAft && x < CP.footFwd) ? CP.footHalf : 0;
    const seat = stations(CP.aft + 1e-3, CP.fwd - 1e-3, .02, [CP.footAft, CP.footAft + 1e-3, CP.footFwd, CP.footFwd - 1e-3, ...endSamples(CP.aft + 1e-3, CP.fwd - 1e-3, 14)]);
    grid(G.deck, seat.map(x => { const a = foot(x), o = cockpitHalf(x), r = []; for (let k = 0; k <= 4; k++) { const z = lerp(a, o, k/4); r.push([x, CP.seat, s*z]); } return r; }), mat.teak, { uv: teakUV });
    box(G.deck, [(CP.footAft + CP.footFwd)/2, (CP.seat + CP.sole)/2, s*CP.footHalf], [CP.footFwd - CP.footAft, CP.seat - CP.sole, .012], mat.gelDeck);
  });
  [CP.footAft, CP.footFwd].forEach(x => box(G.deck, [x, (CP.seat + CP.sole)/2, 0], [.012, CP.seat - CP.sole, CP.footHalf*2], mat.gelDeck));
  const sole = [[CP.footAft, CP.sole, -CP.footHalf], [CP.footAft, CP.sole, CP.footHalf]], sole2 = [[CP.footFwd, CP.sole, -CP.footHalf], [CP.footFwd, CP.sole, CP.footHalf]];
  grid(G.deck, [sole, sole2], mat.teak, { uv: teakUV });
  // companionway opening with washboards in the forward bulkhead
  const cx = CP.fwd - .002, ch = CP.companionHalf;
  box(G.deck, [cx - .015, (CP.seat + HO.roof)/2 + .01, 0], [.03, HO.roof - CP.seat - .02, ch*2], mat.dark);
  for (let i = 0; i < 5; i++) box(G.deck, [cx - .035, CP.seat + .07 + i*.095, 0], [.012, .085, ch*2 - .05], mat.teakDark);
  [-1, 1].forEach(s => rod(G.deck, [cx - .035, CP.seat, s*ch], [cx - .035, HO.roof, s*ch], .014, mat.teakDark));
  // sliding hatch garage on the roof ahead of the companionway
  const gx = CP.fwd + .34, gy = roofY(gx, 0);
  box(G.deck, [gx, gy + .03, 0], [.72, .05, ch*2 + .12], mat.gelDeck);
})();

/* Port lights with stainless frames, set into the trunk wall. */
(function ports() {
  const [w, h] = HO.windowSize, frame = roundRect(w, h, .03), hole = roundRect(w - .036, h - .036, .018);
  const fShape = frame.clone(); fShape.holes.push(new T.Path(hole.getPoints(6)));
  const fGeo = new T.ExtrudeGeometry(fShape, { depth: .012, bevelEnabled: false, curveSegments: 6 });
  const gGeo = new T.ShapeGeometry(hole, 6);
  [1, -1].forEach(s => HO.windows.forEach(x => {
    const z0 = houseHalf(x), y0 = deckY(x, z0), y1 = roofY(toTopX(x), z0*HO.tumble), hh = (HO.windowY - y0)/(y1 - y0);
    const c = new V3(...wallPt(x, s, hh)), a = new V3(...wallPt(x + .02, s, hh)).sub(c).normalize();
    const up = new V3(...wallPt(x, s, Math.min(1, hh + .08))).sub(c).normalize(), n = new V3().crossVectors(a, up).normalize();
    if (n.z*s < 0) n.negate();
    const y = new V3().crossVectors(n, a).normalize(), m = new T.Matrix4().makeBasis(a, y, n);
    const place = (geo, material, off) => { const q = put(G.deck, geo, material, false); q.quaternion.setFromRotationMatrix(m); q.position.copy(c).addScaledVector(n, off); };
    place(fGeo, mat.steel, -.002); place(gGeo, mat.port, .007);
  }));
})();

/* Hatches: white frame, dark smoked lid, round chrome vent, as on the real boat. */
(function hatches() {
  SPEC.hatches.forEach(([x, z, l, w]) => {
    const fwd = x > HO.topFwd, y = fwd ? deckY(x, z) : roofY(x, z);
    const g = new T.Group(); g.position.set(x, y, z); G.deck.add(g);
    const fr = new T.Mesh(new T.ExtrudeGeometry(roundRect(l + .05, w + .05, .05), { depth: .035, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 2, curveSegments: 6 }), mat.white);
    fr.rotation.x = -Math.PI/2; fr.castShadow = true; g.add(fr);
    const lid = new T.Mesh(new T.ExtrudeGeometry(roundRect(l - .02, w - .02, .035), { depth: .01, bevelEnabled: false, curveSegments: 6 }), mat.port);
    lid.rotation.x = -Math.PI/2; lid.position.y = .046; g.add(lid);
    const vent = new T.Mesh(new T.SphereGeometry(.058, 22, 10, 0, Math.PI*2, 0, Math.PI/2), mat.steel);
    vent.scale.y = .62; vent.position.y = .056; vent.castShadow = true; g.add(vent);
  });
})();

/* Teak grab rails on the coachroof. */
(function grabRails() {
  [1, -1].forEach(s => {
    const z = s*(roofHalf(5.66) - .12), pts = [];
    for (let i = 0; i <= 12; i++) { const x = lerp(4.584, 6.814, i/12), zz = s*(roofHalf(x) - .12); pts.push([x, roofY(x, zz) + .055, zz]); }
    tube(G.deck, pts, .014, mat.teakRail);
    for (let i = 0; i <= 6; i++) { const x = lerp(4.584, 6.814, i/6), zz = s*(roofHalf(x) - .12); rod(G.deck, [x, roofY(x, zz), zz], [x, roofY(x, zz) + .055, zz], .012, mat.teakRail); }
  });
})();

/* Winches and helm. */
function winch(parent, x, y, z, k = 1) {
  const g = new T.Group(); g.position.set(x, y, z); g.scale.setScalar(k); parent.add(g);
  const base = put(g, new T.CylinderGeometry(.075, .085, .075, 22), mat.steel); base.position.y = .037;
  const drum = put(g, new T.CylinderGeometry(.055, .066, .075, 22), mat.alu); drum.position.y = .11;
  const top = put(g, new T.CylinderGeometry(.03, .052, .025, 18), mat.steel); top.position.y = .16;
}
(function fittings() {
  [1, -1].forEach(s => {
    [[.914, .94], [2.384, 1.02]].forEach(([x, q]) => winch(G.deck, x, roofY(x, q) - .002, s*q, x < 1.7 ? 1.05 : .9));
    winch(G.deck, 4.714, roofY(4.714, .84), s*.84, .62);
    [[.12, .78], [6.064, 1.36], [9.944, .17]].forEach(([x, q]) => {           // mooring cleats
      const zz = s*Math.min(q, deckHalf(x) - .12), y = deckY(x, zz);
      rod(G.deck, [x - .09, y + .035, zz], [x + .09, y + .035, zz], .012, mat.steel);
      [-.04, .04].forEach(d => rod(G.deck, [x + d, y, zz], [x + d, y + .035, zz], .012, mat.steel));
    });
  });
  const W = CP.wheel, px = W.x + .06;
  rod(G.deck, [px, CP.sole, 0], [px, W.y + .04, 0], .052, mat.white, 18, .042);
  const cmp = put(G.deck, new T.SphereGeometry(.082, 20, 14), mat.dark); cmp.position.set(px, W.y + .135, 0);
  rod(G.deck, [px - .02, W.y, 0], [W.x - .04, W.y, 0], .018, mat.steel);
  const wheel = put(G.deck, new T.TorusGeometry(W.r, .014, 10, 64), mat.steel); wheel.position.set(W.x - .04, W.y, 0); wheel.rotation.y = Math.PI/2;
  for (let i = 0; i < 6; i++) { const a = i*Math.PI/3; rod(G.deck, [W.x - .04, W.y, 0], [W.x - .04, W.y + W.r*Math.sin(a), W.r*Math.cos(a)], .007, mat.steel); }
  const hub = put(G.deck, new T.CylinderGeometry(.05, .05, .04, 18), mat.steel); hub.position.set(W.x - .04, W.y, 0); hub.rotation.z = Math.PI/2;
})();

/* Fixed windscreen on its moulded base with the navy stripe, framed in stainless. */
const SC = SPEC.screen;
function mirrored(line) { return [...line.slice(1).reverse().map(p => [p[0], -p[1]]), ...line]; }
(function windscreen() {
  const base = mirrored(SC.base), top = mirrored(SC.top);
  // moulded base: a low cream plinth from the roof up to the glass line
  const plinth = base.map(([x, z]) => [[x + .08, roofY(Math.min(x + .08, 6.66), z*1.05) - .005, z*1.05], [x, SC.baseY - .035, z], [x - .02, SC.baseY, z*.985]]);
  grid(G.deck, plinth[0].map((_, k) => plinth.map(r => r[k])), mat.gel);
  const stripe = base.map(([x, z]) => [[x + .036, SC.baseY - .03 - .022, z*1.024], [x + .018, SC.baseY - .03 + .008, z*1.009]]);
  grid(G.deck, stripe[0].map((_, k) => stripe.map(r => r[k])), mat.navy, { noShadow: true });
  // close plinth top under the glass
  const inner = base.map(([x, z]) => [x - .02, SC.baseY, z*.985]);
  grid(G.deck, [inner, inner.map(p => [Math.max(p[0] - .12, 1.964), SC.baseY - .004, p[2]*.86])], mat.gelDeck);
  // glass panes
  for (let i = 0; i < base.length - 1; i++) {
    const a = [base[i][0] - .02, SC.baseY, base[i][1]*.985], b = [base[i + 1][0] - .02, SC.baseY, base[i + 1][1]*.985];
    const c = [top[i][0], SC.topY, top[i][1]], d = [top[i + 1][0], SC.topY, top[i + 1][1]];
    const m = grid(G.deck, [[a, b], [c, d]], mat.clear, { noShadow: true }); m.renderOrder = 3; m.castShadow = false;
    rod(G.deck, a, c, .013, mat.steel);
  }
  const l = base.length - 1;
  rod(G.deck, [base[l][0] - .02, SC.baseY, base[l][1]*.985], [top[l][0], SC.topY, top[l][1]], .013, mat.steel);
  rod(G.deck, [base[0][0] - .02, SC.baseY, base[0][1]*.985], [top[0][0], SC.topY, top[0][1]], .013, mat.steel);
  for (let i = 0; i < top.length - 1; i++) {
    rod(G.deck, [top[i][0], SC.topY, top[i][1]], [top[i + 1][0], SC.topY, top[i + 1][1]], .014, mat.steel);
    rod(G.deck, [base[i][0] - .02, SC.baseY + .01, base[i][1]*.985], [base[i + 1][0] - .02, SC.baseY + .01, base[i + 1][1]*.985], .012, mat.steel);
  }
})();

/* The moulded TARGA arch that carries the mainsheet. */
const TG = SPEC.targa;
const targaPt = f => {                 // f from -1 (port foot) over the top to +1 (starboard foot)
  const a = Math.abs(f), leg = .78, s = Math.sign(f) || 1;
  if (a > leg) { const q = (a - leg)/(1 - leg), e = 1 - (1 - q)*(1 - q)*.0;
    return [lerp(TG.topX - .05, TG.baseX, e), lerp(TG.topY - .12, roofY(TG.baseX, TG.baseHalf) - .01, e), s*lerp(TG.topHalf + .01, TG.baseHalf, e)]; }
  const q = a/leg, r = Math.pow(q, 5);
  return [lerp(TG.topX, TG.topX - .05, r), TG.topY - .12*r + .018*(1 - q*q), s*TG.topHalf*q*(1 + .012*(1 - q))];
};
(function targa() {
  const path = []; for (let i = 0; i <= 90; i++) path.push(targaPt(-1 + 2*i/90));
  const w = TG.width/2, d = TG.depth/2, pr = [];
  for (let i = 0; i < 20; i++) { const a = i/20*Math.PI*2, c = Math.cos(a), q = Math.sin(a), e = .55; pr.push([d*Math.sign(c)*Math.pow(Math.abs(c), e), w*Math.sign(q)*Math.pow(Math.abs(q), e)]); }
  const rows = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], t = new V3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const fwd = new V3(1, 0, 0).addScaledVector(t, -t.x).normalize(), n = new V3().crossVectors(t, fwd).normalize();
    return [...pr, pr[0]].map(([u, v]) => [p[0] + n.x*u + fwd.x*v, p[1] + n.y*u + fwd.y*v, p[2] + n.z*u + fwd.z*v]);
  });
  grid(G.deck, rows, mat.white);
})();
