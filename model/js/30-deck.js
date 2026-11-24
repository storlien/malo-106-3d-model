/* Teak deck, toe rail, cabin trunk with coamings, cockpit, windscreen, hatches. */
const HO = SPEC.house, CP = SPEC.cockpit;
const teakUV = p => [p[0]/3.4, p[2]/(SPEC.deck.plank*8)];

/* Plan outline of the trunk at deck level, with rounded ends. */
function houseSide(x) {
  const side = x > 5.66 ? HO.sideDeck*(1 + (x - 5.66)*.06) : HO.sideDeck, normal = Math.min(HO.maxHalf, Math.max(.05, halfB(x) - side));
  const aftW = (CP.aftInnerHalf + CP.capWidth)/HO.tumble;
  return lerp(aftW, x < 4 ? Math.max(normal, aftW) : normal, 1 - Math.pow(1 - clamp((x - HO.aft)/(1.6 - HO.aft), 0, 1), 2.2));     // measured width at the aft end, blending into the side decks; forward it follows the side decks to the front
}
function houseHalf(x) {
  if (x <= HO.aft || x >= HO.fwd) return 0;
  const R = HO.frontCorner; let k = 1;
  if (x > HO.fwd - R) { const d = (x - (HO.fwd - R))/R; k = Math.pow(1 - Math.pow(d, 3.2), 1/3.2); }
  return houseSide(x)*k;
}
const toTopX = x => lerp(HO.topAft, HO.topFwd, (x - HO.aft)/(HO.fwd - HO.aft));
const fromTopX = x => lerp(HO.aft, HO.fwd, (x - HO.topAft)/(HO.topFwd - HO.topAft));
const roofHalf = x => houseHalf(fromTopX(x))*HO.tumble;
const roofSide = x => houseSide(fromTopX(x))*HO.tumble;                   // width without the rounded front corners
const roofY = (x, z) => { const w = Math.max(roofSide(x), .2); return HO.roof + HO.roofCrown*Math.max(0, 1 - (z/w)*(z/w)); };

/* Stations packed towards the tip of the front, where the outline turns quickly. */
const frontStations = (end, n = 48) => Array.from({ length: n + 1 }, (_, i) => end - HO.frontCorner*Math.pow(i/n, 3));

/* Half-width of the cockpit well. Its aft edge curves with the transom, right behind the stern toe rail. */
const cockpitHalf = x => {
  if (x <= CP.aftRail || x >= CP.fwd) return 0;
  const side = Math.min(CP.halfWidth, roofHalf(Math.max(x, HO.topAft + 1e-3)) - CP.capWidth), knee = CP.aftRail + CP.aftCorner;
  const aft = Math.pow(1 - Math.pow(clamp((knee - x)/CP.aftCorner, 0, 1), 2.6), 1/2.6);
  const r = .16, d = CP.fwd - x, fwd = d >= r ? side : side - r + Math.sqrt(Math.max(0, r*r - (r - d)*(r - d)));
  return fwd*aft;
};

function stations(a, b, step, extra = []) {
  const xs = [...extra]; for (let x = a; x < b; x += step) xs.push(x); xs.push(b);
  const o = xs.filter(x => x >= a && x <= b).sort((p, q) => p - q).filter((x, i, l) => !i || x - l[i - 1] > 1e-6);
  o[o.length - 1] = b; return o;                       // always end exactly at b, so closed outlines have no gap
}
const endSamples = (a, b, n = 40) => { const o = []; for (let i = 0; i <= n; i++) { const f = (1 - Math.cos(Math.PI*i/n/2)); o.push(a + (b - a)*f*.2, b - (b - a)*f*.2); } return o; };

/* Deck: two strips from the trunk (or centreline) out to the rail. */
(function deck() {
  const ex = [...endSamples(HO.aft + 1e-3, HO.fwd), ...frontStations(HO.fwd), HO.aft, HO.aft + 1e-3]; for (let i = 0; i <= 24; i++) ex.push(.45*(i/24)*(i/24), CP.aftRail + CP.aftCorner*(i/24)*(i/24));
  const xs = stations(SPEC.deck.toeRail.sternCapTo, L, .035, ex);
  [1, -1].forEach(s => {
    const rows = xs.map(x => {
      const o = deckHalf(x), a = Math.min(x <= HO.aft ? cockpitHalf(x) : Math.max(houseHalf(x) - .006, 0), o), r = [];
      for (let k = 0; k <= 8; k++) { const z = lerp(a, o, k/8); r.push([x, deckY(x, z), s*z]); }
      return r;
    });
    grid(G.deck, rows, mat.teak, { uv: teakUV });
  });
})();

/* Solid teak plank for the toe rail: warm, with the grain running along its length. */
mat.toeRail = (() => {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 128;
  const g = c.getContext('2d'), r = rng(73); g.fillStyle = '#a97c4a'; g.fillRect(0, 0, 2048, 128);
  for (let i = 0; i < 520; i++) { g.strokeStyle = `rgba(${r() < .62 ? '74,46,22' : '214,170,116'},${.05 + r()*.14})`; g.lineWidth = .6 + r()*1.6;
    const y = r()*128, x = r()*2048, l = 140 + r()*620, a = r()*6; g.beginPath(); g.moveTo(x, y); for (let q = 0; q <= l; q += 28) g.lineTo(x + q, y + Math.sin(q*.009 + a)*2.2); g.stroke(); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 12;
  return M('#ffffff', { map: t, roughness: .62 });
})();

/* Toe rail, following the sheer and across the transom. */
(function toeRail() {
  const c = HS.transomCurve; let zc = 1; for (let k = 0; k < 30; k++) zc = halfB(c*zc*zc);
  const line = []; for (let i = 0; i <= 26; i++) { const z = zc*i/26; line.push([c*z*z, z]); }
  for (let x = c*zc*zc + .05; x < L - .01; x += .05) line.push([x, halfB(x)]);
  line.push([L, 0]);
  const h = SPEC.deck.toeRail.height, side = SPEC.deck.toeRail.width, cornerX = c*zc*zc;
  const widthAt = () => side;                      // the wide stern part is its own plank, built with the cockpit
  [1, -1].forEach(s => {
    const rows = line.map((p, i) => {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      let nx = -(b[1] - a[1]), nz = b[0] - a[0]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      const w = widthAt(p[0]), y = sheerY(p[0]), at = (o, dy) => [p[0] + nx*o, y + dy, s*(p[1] + nz*o)];
      return [at(.006, -.022), at(.008, h - .012), at(0, h), at(-w + .008, h - .004), at(-w, .004), at(-w, -.005)];
    });
    const geo = gridGeo(rows), uv = []; let run = 0;
    rows.forEach((q, i) => { if (i) run += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); q.forEach((_, k) => uv.push(run/2.4, k/(q.length - 1))); });
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); put(G.deck, geo, mat.toeRail);
  });
})();

/* Trunk walls: a loop from aft around to the front, on each side. */
const wallPt = (x, s, h) => {
  const z0 = houseHalf(x), y0 = deckLevel(x, z0) - .01, tx = toTopX(x), z1 = z0*HO.tumble, y1 = roofY(tx, z1);
  const k = h < .86 ? h/.86*.86 : h;                    // straight wall, rounded shoulder
  return [lerp(x, tx, k), lerp(y0, y1, h), s*(lerp(z0, z1, k) - .012*Math.pow(Math.max(0, h - .9)/.1, 2))];
};
(function walls() {
  const xs = stations(HO.aft + 1e-3, HO.fwd, .03, [...endSamples(HO.aft + 1e-3, HO.fwd), ...frontStations(HO.fwd)]);
  [1, -1].forEach(s => {
    const rows = xs.map(x => { const r = []; for (let k = 0; k <= 12; k++) r.push(wallPt(x, s, k/12)); return r; });
    grid(G.deck, rows, mat.gel);
    // navy stripe around the wall
    const b = HO.band, band = xs.filter(x => x >= b.from && x <= b.to).map(x => {
      const z0 = houseHalf(x), y0 = deckLevel(x, z0), tx = toTopX(x), y1 = roofY(tx, z0*HO.tumble), r = [];
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
(function roof() {
  const ex = [HO.teakFrom, ...endSamples(HO.topAft + 1e-3, CP.fwd - 1e-3, 18), ...endSamples(HO.topAft + 1e-3, HO.topFwd, 30), ...frontStations(HO.fwd).map(toTopX)];
  const xs = stations(HO.topAft + 1e-3, HO.topFwd, .03, ex);
  const sprung = p => [p[0]/3.4, p[2]/roofSide(p[0])*.9/(SPEC.deck.plank*8)];     // planks follow the sides of the trunk
  const build = (list, m, uv) => [1, -1].forEach(s => {
    const rows = list.map(x => {
      const o = Math.max(roofHalf(x) - .012, 0), a = Math.min(cockpitHalf(x), o), r = [];
      for (let k = 0; k <= 10; k++) { const z = lerp(a, o, k/10); r.push([x, roofY(x, z) + .001, s*z]); }
      return r;
    });
    grid(G.deck, rows, m, uv ? { uv: sprung } : undefined);
  });
  build(xs.filter(x => x <= HO.teakFrom + 1e-6), mat.gelDeck, false);
  const teakXs = xs.filter(x => x >= HO.teakFrom - 1e-6);
  build(teakXs, mat.teak, true);
  // margin plank around the edge of the teak
  const edge = teakXs.map(x => [x, Math.max(roofHalf(x) - .012, 0)]);
  [1, -1].forEach(s => grid(G.deck, edge.map((p, i) => {
    const a = edge[Math.max(0, i - 1)], b = edge[Math.min(edge.length - 1, i + 1)];
    let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    if (i === edge.length - 1) { nx = -1; nz = 0; }
    const ix = p[0] + nx*.055, iz = Math.max(0, p[1] + nz*.055);
    return [[p[0], roofY(p[0], p[1]) + .004, s*p[1]], [ix, roofY(ix, iz) + .004, s*iz]];
  }), mat.teakRail));
})();

/* Cockpit well: coaming walls, helm bench to the stern toe rail, side seats, footwell and sole. */
const footAft = CP.aftRail + CP.benchDepth, benchY = sheerY(0) + SPEC.deck.toeRail.height - CP.benchBelowRail, TG_CAP_END = SPEC.targa.baseX - .06, benchEdge = M('#6b5844', { roughness: .75 });
(function cockpit() {
  const knee = CP.aftRail + CP.aftCorner, back = CP.benchBack, W = cockpitHalf(knee + .01);
  const aftEdge = z => knee - CP.aftCorner*Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, z/W), 2.6)), 1/2.6);
  const seatHalf = x => x < knee + back ? cockpitHalf(x - back) : cockpitHalf(x);
  const wallTop = (x, z) => x <= HO.aft ? deckY(x, z) : x >= HO.topAft ? roofY(x, z) : lerp(deckY(x, z), roofY(x, z), (x - HO.aft)/(HO.topAft - HO.aft));
  const xs = stations(knee, CP.fwd - 1e-3, .025, [HO.aft, HO.aft + 1e-3, HO.topAft, HO.topAft + 1e-3, ...endSamples(HO.topAft + 1e-3, CP.fwd - 1e-3, 14)]);
  const arc = []; for (let i = 0; i <= 44; i++) arc.push(W*(1 - Math.pow(1 - i/44, 2)));
  [1, -1].forEach(s => {
    grid(G.deck, xs.map(x => { const z = cockpitHalf(x); return [[x, wallTop(x, z), s*z], [x, CP.seat, s*z]]; }), mat.gelDeck);
    grid(G.deck, arc.map(z => { const x = aftEdge(z); return [[x, deckY(x, z) + .002, s*z], [x + back, benchY, s*z]]; }), mat.gelDeck);   // sloped back up to the toe rail
    // wide solid teak toe rail: one plank across the stern, mitred at the coaming corner to one along each side
    const capTo = SPEC.deck.toeRail.sternCapTo, c = HS.transomCurve; let hz = 1; for (let k = 0; k < 30; k++) hz = halfB(c*hz*hz);
    const Cx = HO.aft, Cz = houseHalf(HO.aft + 1e-3) - .004, Hx = c*hz*hz, inX = z => z < W ? aftEdge(z) : z <= Cz ? HO.aft : lerp(HO.aft, Hx, (z - Cz)/(hz - Cz));
    const zs = [...arc, W + 1e-4, ...Array.from({ length: 9 }, (_, i) => lerp(W + 2e-4, Cz, (i + 1)/9)), ...Array.from({ length: 14 }, (_, i) => lerp(Cz, hz, (i + 1)/14))];
    const aftRows = zs.map(z => Array.from({ length: 5 }, (_, k) => { const x = lerp(c*z*z, inX(z), k/4); return [x, deckY(x, z), s*z]; }));
    const plank = (rows, uvAt) => { const g = gridGeo(rows), uv = []; rows.forEach(r => r.forEach(q => uv.push(...uvAt(q)))); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); put(G.deck, g, mat.toeRail); };
    plank(aftRows, q => [Math.abs(q[2])/2.4, q[0]/.3]);
    const inner = x => x <= HO.aft ? Cz : houseHalf(x) - .004, outer = x => deckHalf(x);
    const sideRows = Array.from({ length: 41 }, (_, t) => Array.from({ length: 9 }, (_, j) => {
      const k = j/8, mx = lerp(Cx, Hx, k), mz = lerp(Cz, hz, k), q0 = clamp((mz - inner(mx))/(outer(mx) - inner(mx)), 0, 1), x = lerp(mx, capTo, t/40), q = lerp(q0, k, t/40), z = t ? lerp(inner(x), outer(x), q) : mz;
      return [x, deckY(Math.min(x, capTo - 1e-4), z), s*z];
    }));
    plank(sideRows, q => [q[0]/2.4, Math.abs(q[2])/.3]);
    rod(G.deck, [Cx, deckY(Cx, Cz) + .001, s*Cz], [Hx, deckY(Hx, hz) + .001, s*hz], .0018, mat.dark, 5);               // mitre joint
    const endRows = Array.from({ length: 13 }, (_, i) => { const z = lerp(inner(capTo), outer(capTo), i/12); return [[capTo, deckY(capTo - 1e-4, z), s*z], [capTo, deckLevel(capTo, z) - .003, s*z]]; });
    plank(endRows, q => [Math.abs(q[2])/2.4, q[1]/.3]);
    // square end of the coaming, where the bench runs past it to the stern
    const endX = HO.aft + 1e-3, endZ = cockpitHalf(endX);
    grid(G.deck, Array.from({ length: 11 }, (_, i) => i/10).map(h => { const p = wallPt(endX, s, h); return [p, [p[0], p[1], s*endZ]]; }), mat.gelDeck);
    // teak cap on the coaming, carrying the aft winch
    const capX = stations(HO.topAft + .004, TG_CAP_END, .03);
    grid(G.deck, capX.map(x => { const a = cockpitHalf(x) + .006, o = roofHalf(x) - .014, r = []; for (let k = 0; k <= 4; k++) { const z = lerp(a, o, k/4); r.push([x, roofY(x, z) + .004, s*z]); } return r; }), mat.teak, { uv: teakUV });
    const foot = x => (x > footAft && x < CP.footFwd) ? CP.footHalf : 0, first = CP.aftRail + back + 1e-3, ex = [footAft, footAft + 1e-3, CP.footFwd, CP.footFwd - 1e-3, knee + back, ...endSamples(HO.topAft + 1e-3, CP.fwd - 1e-3, 14)];
    for (let i = 0; i <= 24; i++) ex.push(first + CP.aftCorner*(i/24)*(i/24));
    const seatXs = stations(first, CP.fwd - 1e-3, .02, ex), seatRows = (list, y) => grid(G.deck, list.map(x => { const a = y === benchY ? 0 : Math.min(foot(x), seatHalf(x)), o = seatHalf(x), r = []; for (let k = 0; k <= 4; k++) { const z = lerp(a, o, k/4); r.push([x, y, s*z]); } return r; }), mat.teak, { uv: teakUV });
    seatRows(seatXs.filter(x => x <= footAft), benchY);      // helm bench, higher than the side seats
    seatRows(seatXs.filter(x => x > footAft), CP.seat);
    box(G.deck, [(footAft + CP.footFwd)/2, (CP.seat + CP.sole)/2, s*CP.footHalf], [CP.footFwd - footAft, CP.seat - CP.sole, .012], mat.gelDeck);
    tube(G.deck, arc.map(z => [aftEdge(z) + back + .012, benchY + .007, s*z*.985]), .012, benchEdge, false, 6);     // dark border around the bench
    box(G.deck, [CP.aftRail + back + .06, benchY + .006, s*.27], [.1, .012, .035], mat.steel);                                   // locker hinge
  });
  box(G.deck, [footAft - .018, benchY + .007, 0], [.04, .018, cockpitHalf(footAft)*2 - .02], benchEdge);                                // bench front edge
  box(G.deck, [footAft, (benchY + CP.sole)/2, 0], [.012, benchY - CP.sole, cockpitHalf(footAft)*2], mat.gelDeck);          // front of the bench
  box(G.deck, [CP.footFwd, (CP.seat + CP.sole)/2, 0], [.012, CP.seat - CP.sole, CP.footHalf*2], mat.gelDeck);
  const sole = [[footAft, CP.sole, -CP.footHalf], [footAft, CP.sole, CP.footHalf]], sole2 = [[CP.footFwd, CP.sole, -CP.footHalf], [CP.footFwd, CP.sole, CP.footHalf]];
  grid(G.deck, [sole, sole2], mat.teak, { uv: teakUV });
  // companionway opening with washboards in the forward bulkhead
  const cx = CP.fwd - .002, ch = CP.companionHalf;
  box(G.deck, [cx - .015, (CP.seat + HO.roof)/2 + .01, 0], [.03, HO.roof - CP.seat - .02, ch*2], mat.dark);
  for (let i = 0; i < 5; i++) box(G.deck, [cx - .035, CP.seat + .07 + i*.095, 0], [.012, .085, ch*2 - .05], mat.teakDark);
  [-1, 1].forEach(s => rod(G.deck, [cx - .035, CP.seat, s*ch], [cx - .035, HO.roof, s*ch], .014, mat.teakDark));
  // sliding hatch garage on the roof ahead of the companionway
  const gEnd = SPEC.screen.base[0][0] - .06, gx = (CP.fwd + gEnd)/2, gy = roofY(gx, 0);
  box(G.deck, [gx, gy + .03, 0], [gEnd - CP.fwd, .05, ch*2 + .12], mat.gelDeck);
})();

/* Malö Yachts logo, following the curved, raked front of the trunk. */
function placeLogo(loaded) {
  const { width, midHeight } = HO.logo, img = new Image();
  img.onload = () => {
    const tex = new T.Texture(img); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8; tex.needsUpdate = true;
    const front = z => { let a = HO.fwd - HO.frontCorner, b = HO.fwd; for (let i = 0; i < 40; i++) { const m = (a + b)/2; if (houseHalf(m) > z) a = m; else b = m; } return (a + b)/2; };
    const slope = Math.hypot(HO.fwd - HO.topFwd, HO.roof - deckY(HO.fwd, 0)), dh = width*img.height/img.width/slope/2, rows = [], uv = [];
    for (let j = 0; j <= 10; j++) { const v = j/10, h = midHeight + dh*(2*v - 1), r = [];
      for (let i = 0; i <= 28; i++) { const u = i/28, z = width/2*(1 - 2*u), z0 = Math.abs(z)/lerp(1, HO.tumble, h), q = wallPt(front(z0), z < 0 ? -1 : 1, h); r.push([q[0] + .004, q[1] + .002, q[2]]); uv.push(u, v); }
      rows.push(r); }
    const geo = gridGeo(rows); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    const m = put(G.deck, geo, new T.MeshStandardMaterial({ map: tex, color: 0x777777, transparent: true, depthWrite: false, roughness: .45, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), false);
    m.renderOrder = 2; loaded();
  };
  img.src = OVERLAYS.logo;
}

/* Port lights with stainless frames, set into the trunk wall. */
(function ports() {
  const [w, h] = HO.windowSize, frame = roundRect(w, h, .03), hole = roundRect(w - .036, h - .036, .018);
  const fShape = frame.clone(); fShape.holes.push(new T.Path(hole.getPoints(6)));
  const fGeo = new T.ExtrudeGeometry(fShape, { depth: .012, bevelEnabled: false, curveSegments: 6 });
  const gGeo = new T.ShapeGeometry(hole, 6);
  [1, -1].forEach(s => HO.windows.forEach(x => {
    const z0 = houseHalf(x), y0 = deckLevel(x, z0), y1 = roofY(toTopX(x), z0*HO.tumble), hh = (HO.windowY - y0)/(y1 - y0);
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
    [.914, 2.384].forEach(x => { const q = (cockpitHalf(x) + roofHalf(x))/2; winch(G.deck, x, roofY(x, q) - .002, s*q, x < 1.7 ? 1.05 : .9); });
    winch(G.deck, 4.714, roofY(4.714, .84), s*.84, .62);
    [[.50, 1.04], [6.064, 1.36], [9.944, .17]].forEach(([x, q]) => {           // mooring cleats
      const zz = s*Math.min(q, deckHalf(x) - .12), y = deckY(x, zz);
      rod(G.deck, [x - .09, y + .035, zz], [x + .09, y + .035, zz], .012, mat.steel);
      [-.04, .04].forEach(d => rod(G.deck, [x + d, y, zz], [x + d, y + .035, zz], .012, mat.steel));
    });
  });
  /* Helm: white pedestal, compass, stainless guard with a teak bar, leather-covered wheel. */
  const W = CP.wheel, wx = footAft + W.aheadOfBench, px = wx + .13, leather = M('#b4b69c', { roughness: .85 });
  rod(G.deck, [px, CP.sole, 0], [px, W.y + .05, 0], .085, mat.white, 22, .062);
  rod(G.deck, [px - .1, W.y, 0], [wx, W.y, 0], .018, mat.steel);
  const rim = put(G.deck, new T.TorusGeometry(W.r, .019, 12, 72), leather); rim.position.set(wx, W.y, 0); rim.rotation.y = Math.PI/2;
  for (let i = 0; i < 3; i++) { const a = Math.PI/2 + i*2*Math.PI/3; rod(G.deck, [wx, W.y, 0], [wx, W.y + W.r*Math.sin(a), W.r*Math.cos(a)], .009, leather); }
  const hub = put(G.deck, new T.CylinderGeometry(.05, .05, .045, 18), mat.steel); hub.position.set(wx, W.y, 0); hub.rotation.z = Math.PI/2;
  const bowl = put(G.deck, new T.CylinderGeometry(.115, .095, .07, 28), mat.dark); bowl.position.set(px, W.y + .10, 0);
  const card = put(G.deck, new T.SphereGeometry(.088, 22, 10, 0, Math.PI*2, 0, Math.PI/2), mat.glass, false); card.position.set(px, W.y + .135, 0);
  const gx = px + .16, gz = .155, gt = W.y + .25;
  tube(G.deck, [[gx, CP.sole, -gz], [gx, gt - .08, -gz], [gx - .02, gt - .015, -gz*.72], [gx - .03, gt, 0], [gx - .02, gt - .015, gz*.72], [gx, gt - .08, gz], [gx, CP.sole, gz]], .0125, mat.steel, false, 10);
  box(G.deck, [gx + .014, W.y + .03, 0], [.022, .085, gz*2 + .05], mat.teakDark);
  [-1, 1].forEach(s => rod(G.deck, [gx, W.y - .22, s*gz], [px, W.y - .22, s*.06], .008, mat.steel));
  // engine controls, recessed in the starboard footwell-side wall beside the wheel
  const ex = footAft + .42, ez = cockpitHalf(ex) - .004, ey = CP.seat + .23;
  box(G.deck, [ex, ey, ez], [.40, .30, .008], M('#e9e0c4', { roughness: .4 }));
  const dial = put(G.deck, new T.CylinderGeometry(.052, .052, .012, 24), mat.dark); dial.rotation.x = Math.PI/2; dial.position.set(ex - .09, ey + .04, ez - .007);
  box(G.deck, [ex + .1, ey - .02, ez - .012], [.07, .13, .018], mat.steel);
  rod(G.deck, [ex + .1, ey, ez - .02], [ex + .1, ey + .13, ez - .075], .009, mat.dark);
})();

/* Fixed windscreen on its moulded base with the navy stripe, in slim anodised frames. */
const SC = SPEC.screen;
const tableY = (t, x) => { if (x <= t[0][0]) return t[0][1]; for (let i = 0; i < t.length - 1; i++) if (x <= t[i + 1][0]) return lerp(t[i][1], t[i + 1][1], (x - t[i][0])/(t[i + 1][0] - t[i][0])); return t[t.length - 1][1]; };
const screenTop = x => tableY(SC.topY, x), screenBase = x => tableY(SC.baseY, x);
(function windscreen() {
  const loop = l => [...l.slice(1).reverse().map(p => [p[0], -p[1]]), ...l.slice(1)], base = loop(SC.base), top = loop(SC.top), dense = [];
  for (let i = 0; i < base.length - 1; i++) for (let k = i ? 1 : 0; k <= 14; k++) {
    const f = k/14, p = [lerp(base[i][0], base[i + 1][0], f), lerp(base[i][1], base[i + 1][1], f)];
    p.top = [lerp(top[i][0], top[i + 1][0], f), lerp(top[i][1], top[i + 1][1], f)]; dense.push(p);
  }
  // the moulding's face carries on in the plane of the glass, from the glass base down to the roof
  const low = p => {
    const [x, z] = p, yb = screenBase(x), yt = screenTop(p.top[0]), dx = x - p.top[0], dz = z - p.top[1];
    let t = 0; for (let k = 0; k < 4; k++) t = (yb - (roofY(x + dx*t, z + dz*t) - .005))/Math.max(yt - yb, .05);
    const q = x + dx*t + .01*Math.sign(dx), w = z + dz*t; return [q, roofY(q, w) - .005, w];
  }, up = ([x, z]) => [x, screenBase(x) - .035, z];
  // moulded base: a cream plinth from the roof up to the glass line
  const plinth = dense.map(p => { const b = screenBase(p[0]); return [low(p), up(p), [p[0] - .02, b, p[1]*.985]]; });
  grid(G.deck, plinth[0].map((_, k) => plinth.map(r => r[k])), mat.gel);
  const onFace = (p, f) => { const a = low(p), c = up(p); return [lerp(a[0], c[0], f) + .004, lerp(a[1], c[1], f) + .001, lerp(a[2], c[2], f)*1.004]; };
  const stripe = dense.map(p => [onFace(p, .42), onFace(p, .82)]);
  grid(G.deck, stripe[0].map((_, k) => stripe.map(r => r[k])), mat.navy, { noShadow: true });
  // close the plinth top under the glass
  const inner = dense.map(([x, z]) => [x - .02, screenBase(x), z*.985]);
  grid(G.deck, [inner, inner.map(p => [Math.max(p[0] - .12, 1.964), p[1] - .004, p[2]*.86])], mat.gelDeck);
  // five panes: side, corner, one wide centre, corner, side
  const B = base.map(([x, z]) => [x - .02, screenBase(x), z*.985]), Tp = top.map(([x, z]) => [x, screenTop(x), z]);
  for (let i = 0; i < B.length - 1; i++) {
    const m = grid(G.deck, [[B[i], B[i + 1]], [Tp[i], Tp[i + 1]]], mat.clear, { noShadow: true }); m.renderOrder = 3; m.castShadow = false;
    rod(G.deck, Tp[i], Tp[i + 1], .015, mat.alu, 12);
    rod(G.deck, [B[i][0], B[i][1] + .008, B[i][2]], [B[i + 1][0], B[i + 1][1] + .008, B[i + 1][2]], .012, mat.alu, 12);
  }
  B.forEach((p, i) => { rod(G.deck, p, Tp[i], .014, mat.alu, 12); const j = put(G.deck, new T.SphereGeometry(.017, 12, 8), mat.alu); j.position.set(...Tp[i]); });
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
