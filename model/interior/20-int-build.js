/* ===== Interior, part 2: geometry =====
   Built once, hidden until the interior viewer opens it. Joinery follows the hull's own lines (hullHalf),
   the ceiling follows the deck, coachroof and cockpit above. */
G.interior = new T.Group(); G.interior.visible = false; boat.add(G.interior);
G.ceiling = new T.Group(); G.interior.add(G.ceiling);
const IG = G.interior, IC = INT.colours;

/* ---------- Materials ---------- */
const intMat = (() => {
  const canvas = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t; };
  const grain = (base, dark, light, seed) => canvas(512, 512, (g, w, h) => {      // ribbon-striped mahogany veneer
    const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const x = r()*w, wd = 1 + r()*7; g.fillStyle = `rgba(${r() < .55 ? dark : light},${.05 + r()*.12})`; g.fillRect(x, 0, wd, h); }
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(${dark},.08)`; g.lineWidth = 1; g.beginPath(); const x = r()*w; g.moveTo(x, 0); for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y*.02 + i)*4, y); g.stroke(); }
  });
  const wood = grain(IC.mahogany, '60,18,6', '196,110,60', 41), trim = grain(IC.trim, '45,14,4', '170,90,50', 43);
  const cushionTex = canvas(256, 256, (g, w, h) => {                               // woven light blue-grey with button tufts
    const r = rng(7); g.fillStyle = IC.cushion; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '60,80,95'},.10)`; g.fillRect(r()*w, r()*h, 2, 1); }
    [[64, 64], [192, 192]].forEach(([x, y]) => { g.fillStyle = 'rgba(70,90,105,.55)'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
  });
  const soleTex = canvas(512, 64, (g, w, h) => {                                   // teak sole with holly strips, running fore and aft
    g.fillStyle = IC.sole; g.fillRect(0, 0, w, h); const r = rng(5);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(${r() < .6 ? '50,20,8' : '200,130,80'},.10)`; g.fillRect(r()*w, r()*h, 20 + r()*120, 1 + r()*2); }
    g.fillStyle = IC.holly; g.fillRect(0, h - 5, w, 5);
  });
  const S = (o) => new T.MeshStandardMaterial(Object.assign({ side: T.DoubleSide }, o));
  return {
    wood: S({ map: wood, roughness: .38, envMapIntensity: .5 }), trim: S({ map: trim, roughness: .35, envMapIntensity: .5 }),
    cushion: S({ map: cushionTex, roughness: .95, envMapIntensity: .2 }), sole: S({ map: soleTex, roughness: .45, envMapIntensity: .4 }),
    headliner: S({ color: C(IC.headliner), roughness: .85 }), laminate: S({ color: C(IC.laminate), roughness: .6 }),
    white: S({ color: C('#f4f2ec'), roughness: .25 }), dark: S({ color: C('#1c1a18'), roughness: .5 }), steel: S({ color: C('#c9ced2'), roughness: .22, metalness: .9 }),
    brass: S({ color: C('#c9a24e'), roughness: .3, metalness: .9 }), glass: new T.MeshBasicMaterial({ color: C('#dfeaf1'), side: T.DoubleSide }), opening: S({ color: C('#3a1a0c'), roughness: .8 }),
    hatch: new T.MeshBasicMaterial({ color: C('#eef6fa'), side: T.DoubleSide }), panel: S({ color: C('#101114'), roughness: .4 }),
  };
})();
const soleUV = p => [p[0]/1.6, p[2]/.055];
const iput = (geo, m) => put(IG, geo, m, false);
const ibox = (c, s, m) => { const b = iput(new T.BoxGeometry(s[0], s[1], s[2]), m); b.position.set(...c); return b; };
const igrid = (rows, m, uv) => { const geo = gridGeo(rows, uv ? { uv } : undefined); return iput(geo, m); };

/* Inside face of the hull lining at station x and height y. */
const hin = (x, y) => Math.max(0, hullHalf(x, Math.min(y, sheerY(x) - .005)) - INT.lining);
const span = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => lerp(a, b, i/n));

/* A block from a straight inner face (|z| = zi) out to the hull, on one side. */
function hullBlock(x0, x1, y0, y1, zi, side, m, faces = 'all') {
  const xs = span(x0, x1, 12), ys = span(y0, y1, 6), out = z => Math.max(zi, z), s = side;
  igrid(xs.map(x => [[x, y1, s*zi], [x, y1, s*out(hin(x, y1))]]), m);                       // top
  if (faces !== 'top') {
    igrid(xs.map(x => [[x, y0, s*zi], [x, y1, s*zi]]), m);                                  // inner face
    [x0, x1].forEach(x => igrid(ys.map(y => [[x, y, s*zi], [x, y, s*out(hin(x, y))]]), m));  // ends
  }
}
/* Door and drawer fronts: a slightly proud panel with a darker inset and a round finger hole. */
function front(c, w, h, normal, kind = 'door') {
  const [nx, nz] = normal, along = nx ? [0, 0, 1] : [1, 0, 0], d = .012;
  const size = nx ? [d, h, w] : [w, h, d];
  ibox([c[0] + nx*d/2, c[1], c[2] + nz*d/2], size, intMat.trim);
  if (kind === 'door') ibox([c[0] + nx*d*1.2, c[1], c[2] + nz*d*1.2], nx ? [d, h*.72, w*.66] : [w*.66, h*.72, d], intMat.wood);
  const hole = iput(new T.CircleGeometry(.014, 14), intMat.dark); hole.position.set(c[0] + nx*d*1.5 + along[0]*w*.32, c[1] + (kind === 'door' ? h*.36 : 0), c[2] + nz*d*1.5 + along[2]*w*.32*(nx ? 1 : 0));
  hole.lookAt(hole.position.x + nx, hole.position.y, hole.position.z + nz);
}

/* ---------- Shell: sole, lining, ceiling, trunk sides, windows and hatches ---------- */
(function shell() {
  const sole = INT.sole;
  // saloon, galley and navigation sole, with the aft-cabin entry
  const xs = span(INT.head.aft, INT.wardrobe.fwd, 50);          // one sole from the head and aft cabin forward
  const bay = INT.steps.botX - .02;                              // aft of the ladder foot the engine bay is open between the two cabin walls
  igrid(xs.filter(x => x >= bay).map(x => { const h = hin(x, sole + .01); return [[x, sole, -h], [x, sole, 0], [x, sole, h]]; }), intMat.sole, soleUV);
  [[INT.aftCabin.wall, -1], [INT.head.inner, 1]].forEach(([w, s]) => igrid(span(INT.head.aft, bay, 8).map(x => [[x, sole, w], [x, sole, s*hin(x, sole + .01)]]), intMat.sole, soleUV));
  // forward cabin floor, a step up, and the head and aft-cabin floors
  const v = INT.vBerth, hf = INT.head, fh = v.floorHalf;
  igrid(span(v.aft - .03, v.floorFwd, 4).map(x => [[x, INT.foreSole, -fh], [x, INT.foreSole, fh]]), intMat.sole, soleUV);
  ibox([v.aft - .04, (sole + INT.foreSole)/2, 0], [.04, INT.foreSole - sole, fh*2], intMat.trim);
  for (let k = 0; k < 9; k++) ibox([(hf.floorAft + hf.door[0][0])/2, INT.aftSole + .012, hf.inner + .05 + k*.065], [hf.door[0][0] - hf.floorAft, .02, .045], intMat.trim);   // slatted head floor

  // hull lining from the sole up to the deck, both sides
  const lx = span(.45, 8.86, 90);
  [1, -1].forEach(s => igrid(lx.map(x => span(Math.max(keelY(x) + .12, sole - .05), sheerY(x) - .03, 8).map(y => [x, y, s*hin(x, y)])), intMat.wood));

  // ceiling: coachroof, side decks, and the cockpit seats and sole over the aft cabins
  const ceilY = (x, a) => {
    if (x >= CP.fwd && x < HO.fwd - .02 && a < houseHalf(x) - .03) return HO.roof - .04;
    if (x < CP.fwd) { if (x > footAft && (a < CP.footHalf || (x < sideAft && a < cockpitHalf(x)))) return CP.sole - .04; if (a < cockpitHalf(x)) return CP.seat - .04; if (a < houseHalf(x) - .03) return HO.roof - .05; }
    return deckLevel(x, a) - .045;
  };
  const cx = span(.45, 8.86, 180);
  const across = (x, w) => {                                   // sample densely, and twice at each edge so the steps stand vertical
    const edges = [CP.footHalf, cockpitHalf(x), houseHalf(x) - .03].filter(e => e > .01 && e < w).flatMap(e => [e - .0015, e + .0015]);
    return [...span(0, w, 30), ...edges].sort((a, b) => a - b);
  };
  [1, -1].forEach(s => { const g = gridGeo(cx.map(x => { const w = hin(x, sheerY(x) - .04); return across(x, w).slice(0, 36).concat(Array(Math.max(0, 36 - across(x, w).length)).fill(w)).map(a => [x, ceilY(x, a), s*a]); })); put(G.ceiling, g, intMat.headliner, false); });
  // mahogany battens along the coachroof
  [-.72, -.36, .36, .72].forEach(z => { const b = put(G.ceiling, new T.BoxGeometry(HO.fwd - CP.fwd - .5, .02, .035), intMat.trim, false); b.position.set((CP.fwd + HO.fwd)/2 - .15, HO.roof - .05, z); });

  // inside of the trunk sides, with the port lights
  const tx = span(CP.fwd + .02, HO.fwd - .06, 60);
  [1, -1].forEach(s => {
    igrid(tx.map(x => { const h = houseHalf(x); return [[x, deckLevel(x, h) - .05, s*(h - .03)], [x, HO.roof - .045, s*(h*HO.tumble - .03)]]; }), intMat.wood);
    HO.windows.forEach(wx => { const h = houseHalf(wx), p = put(G.ceiling, new T.PlaneGeometry(HO.windowSize[0], HO.windowSize[1]), intMat.glass, false);
      p.position.set(wx, HO.windowY, s*(lerp(h, h*HO.tumble, .5) - .036)); p.rotation.y = Math.PI/2; });
  });
  // opening hatches overhead, with mahogany frames
  SPEC.hatches.forEach(([x, z, l, w]) => {
    if (x > INT.vBerth.fwd) return;
    const y = (x > CP.fwd && x < HO.fwd ? HO.roof : deckLevel(x, Math.abs(z))) - .046, p = put(G.ceiling, new T.PlaneGeometry(l - .06, w - .06), intMat.hatch, false);
    p.rotation.x = Math.PI/2; p.position.set(x, y, z);
    [[0, w/2 - .02, l, .04], [0, -w/2 + .02, l, .04], [l/2 - .02, 0, .04, w], [-l/2 + .02, 0, .04, w]].forEach(([dx, dz, a, b]) => { const f = put(G.ceiling, new T.BoxGeometry(a, .025, b), intMat.trim, false); f.position.set(x + dx, y - .01, z + dz); });
  });
})();

/* ---------- Saloon ---------- */
(function saloon() {
  const s0 = INT.sole, D = INT.dinette, seatTop = s0 + D.seat, base = seatTop - D.cushion;
  // port U-dinette: the long seat along the hull and two legs reaching to the table
  hullBlock(D.aft, D.fwd, s0, base, D.inner, -1, intMat.wood);
  hullBlock(D.aft, D.fwd, base, seatTop, D.inner, -1, intMat.cushion, 'top');
  [[D.aft, D.aft + .52], [D.fwd - .52, D.fwd]].forEach(([a, b]) => {
    ibox([(a + b)/2, (s0 + base)/2, -(D.inner + D.legInner)/2], [b - a, base - s0, D.inner - D.legInner], intMat.wood);
    ibox([(a + b)/2, base + D.cushion/2, -(D.inner + D.legInner)/2], [b - a - .02, D.cushion, D.inner - D.legInner - .02], intMat.cushion);
  });
  // backs: along the hull, and across the two ends of the U
  const back = (x0, x1, side, inset) => igrid(span(x0, x1, 12).map(x => [[x, seatTop + .02, side*(hin(x, seatTop) - inset)], [x, seatTop + D.back, side*(hin(x, seatTop + D.back) - .05)]]), intMat.cushion);
  back(D.aft + .1, D.fwd - .1, -1, .14);
  [D.aft + .06, D.fwd - .06].forEach(x => ibox([x, seatTop + D.back/2, -(hin(x, seatTop) + D.legInner)/2], [.10, D.back, hin(x, seatTop) - D.legInner], intMat.cushion));
  // table with its drop leaf hanging down to starboard, on a single pedestal
  const T0 = INT.table, ty = s0 + T0.height;
  ibox([(T0.aft + T0.fwd)/2, ty, (T0.port + T0.stbd)/2], [T0.fwd - T0.aft, .032, T0.stbd - T0.port], intMat.trim);
  ibox([(T0.aft + T0.fwd)/2, ty - T0.leaf/2, T0.stbd + .018], [T0.fwd - T0.aft, T0.leaf, .022], intMat.trim);
  rod(IG, [(T0.aft + T0.fwd)/2, s0, (T0.port + T0.stbd)/2], [(T0.aft + T0.fwd)/2, ty, (T0.port + T0.stbd)/2], .035, intMat.steel);
  const foot = iput(new T.CylinderGeometry(.16, .18, .02, 24), intMat.steel); foot.position.set((T0.aft + T0.fwd)/2, s0 + .01, (T0.port + T0.stbd)/2);

  // starboard settee with its back along the hull
  const St = INT.settee;
  hullBlock(St.aft, St.fwd, s0, base, St.inner, 1, intMat.wood);
  hullBlock(St.aft, St.fwd, base, seatTop, St.inner, 1, intMat.cushion, 'top');
  back(St.aft + .08, St.fwd - .1, 1, .14);
  ibox([St.fwd - .05, seatTop + D.back/2, (hin(St.fwd, seatTop) + St.inner)/2], [.10, D.back, hin(St.fwd, seatTop) - St.inner], intMat.cushion);
  ibox([St.aft + .02, (s0 + seatTop + .25)/2, (hin(St.aft, seatTop) + St.inner)/2], [.04, seatTop + .25 - s0, hin(St.aft, seatTop) - St.inner], intMat.trim);   // curved mahogany end, squared off here
  // grab pole
  rod(IG, [INT.pole.x, s0, INT.pole.z], [INT.pole.x, HO.roof - .04, INT.pole.z], INT.pole.r, intMat.trim, 14);

  // lockers and bookshelves above both settees, with a fiddle along the shelves
  const Lk = INT.lockers;
  [[D.aft + .05, D.fwd - .05, -1], [St.aft + .05, St.fwd - .05, 1]].forEach(([a, b, s]) => {
    const zi = Math.min(...span(a, b, 8).map(x => hin(x, Lk.bottom))) - Lk.depth;
    hullBlock(a, b, Lk.bottom, Lk.top, zi, s, intMat.wood);
    let x = a + .05; const pattern = ['shelf', 'door', 'door', 'shelf', 'door', 'door', 'door'];
    for (const p of pattern) {
      const w = p === 'shelf' ? .55 : .27; if (x + w > b - .03) break;
      const c = [x + w/2, (Lk.bottom + Lk.top)/2, s*(zi - .002)];
      if (p === 'shelf') { ibox([c[0], c[1] + .01, s*(zi + .02)], [w, Lk.top - Lk.bottom - .1, .045], intMat.opening); ibox([c[0], Lk.bottom + .1, s*(zi - .008)], [w, .03, .016], intMat.trim); }
      else front(c, w - .02, Lk.top - Lk.bottom - .08, [0, -s]);
      x += w + .02;
    }
  });
  // bulkhead fittings: clocks to starboard, a painting to port, brass reading lamps
  const fb = INT.forwardBulkhead - .025;
  [[.92, .5], [.72, .5]].forEach(([y, z]) => { const c = iput(new T.CylinderGeometry(.065, .065, .03, 24), intMat.brass); c.rotation.z = Math.PI/2; c.position.set(fb, y, z); const f = iput(new T.CircleGeometry(.055, 24), intMat.white); f.position.set(fb - .017, y, z); f.rotation.y = -Math.PI/2; });
  ibox([fb, .85, -.55], [.02, .26, .36], intMat.brass); ibox([fb - .012, .85, -.55], [.004, .22, .32], new T.MeshStandardMaterial({ color: C('#8a9aa0'), roughness: .8 }));
})();

/* ---------- Bulkheads, hanging lockers and the forward cabin ---------- */
(function forward() {
  const s0 = INT.sole, W = INT.wardrobe, dh = INT.doorHalf, top = HO.roof - .045;
  // forward bulkhead, with the door opening in the middle
  [1, -1].forEach(s => igrid(span(s0, top, 10).map(y => [[INT.forwardBulkhead, y, s*dh], [INT.forwardBulkhead, y, s*Math.max(dh, hin(INT.forwardBulkhead, y))]]), intMat.wood));
  ibox([INT.forwardBulkhead, (1.36 + top)/2, 0], [.03, top - 1.36, dh*2], intMat.wood);
  [1, -1].forEach(s => {
    hullBlock(W.aft, W.fwd, s0, top, dh, s, intMat.wood);
    front([(W.aft + W.fwd)/2, (s0 + 1.2)/2 + .05, s*(dh - .002)], W.fwd - W.aft - .08, 1.3, [0, -s]);
  });
  // V-berth: two wings beside the little floor, then the full width forward, with a chest of drawers facing aft
  const V = INT.vBerth, by = INT.foreSole + V.height;
  [1, -1].forEach(s => { hullBlock(V.aft, V.floorFwd, INT.foreSole, by, V.floorHalf, s, intMat.wood); hullBlock(V.aft, V.fwd, by, by + .12, s > 0 ? .005 : .005, s, intMat.cushion, 'top'); });
  hullBlock(V.floorFwd, V.fwd, INT.foreSole, by, 0, 1, intMat.wood); hullBlock(V.floorFwd, V.fwd, INT.foreSole, by, 0, -1, intMat.wood);
  for (let i = 0; i < 4; i++) front([V.floorFwd - .002, INT.foreSole + .07 + i*.115, 0], .36, .1, [-1, 0], 'drawer');
  // forward bulkhead of the cabin, and lockers above the berth
  igrid(span(INT.foreSole, sheerY(V.fwd) - .05, 8).map(y => [[V.fwd, y, -hin(V.fwd, y)], [V.fwd, y, hin(V.fwd, y)]]), intMat.wood);
  [1, -1].forEach(s => { const zi = Math.min(...span(7.0, 8.3, 6).map(x => hin(x, .8))) - .28; hullBlock(7.0, 8.3, .78, 1.02, Math.max(.2, zi), s, intMat.wood); });
})();

/* ---------- Galley, navigation station and companionway steps ---------- */
(function midships() {
  const s0 = INT.sole, Gy = INT.galley, top = s0 + Gy.height;
  // outboard counter the length of the galley, and the forward leg reaching in towards the steps
  hullBlock(Gy.aft, Gy.fwd, s0, top, -Gy.inner, -1, intMat.wood);
  ibox([(Gy.legAft + Gy.fwd)/2, (s0 + top)/2, (Gy.inner + Gy.legInner)/2], [Gy.fwd - Gy.legAft, top - s0, Gy.legInner - Gy.inner], intMat.wood);
  ibox([(Gy.legAft + Gy.fwd)/2, top + .015, (Gy.inner + Gy.legInner)/2], [Gy.fwd - Gy.legAft + .02, .03, Gy.legInner - Gy.inner + .02], intMat.trim);
  // cooker and oven facing the centreline, recessed into the outboard counter, with a drawer below
  const st = INT.stove, fz = Gy.inner + .006;
  ibox([st.x, s0 + .62, fz], [.46, .44, .012], intMat.dark);
  ibox([st.x, s0 + .55, fz + .008], [.32, .2, .004], new T.MeshStandardMaterial({ color: C('#2a2624'), roughness: .2, metalness: .3 }));
  ibox([st.x, s0 + .8, fz + .01], [.4, .05, .006], intMat.steel);
  front([st.x, s0 + .2, Gy.inner - .002], .42, .22, [0, 1], 'drawer');
  // sink and tap in the forward leg, drawers and a locker facing aft and to starboard
  const sk = INT.sink, sy = top + .033;
  const sinkTop = iput(new T.PlaneGeometry(sk.half[0]*2, sk.half[1]*2), intMat.steel); sinkTop.rotation.x = -Math.PI/2; sinkTop.position.set(sk.x, sy, sk.z);
  rod(IG, [sk.x + sk.half[0] + .04, sy, sk.z - .12], [sk.x + sk.half[0] + .04, sy + .22, sk.z - .12], .012, intMat.steel); rod(IG, [sk.x + sk.half[0] + .04, sy + .22, sk.z - .12], [sk.x + .02, sy + .2, sk.z - .12], .01, intMat.steel);
  for (let i = 0; i < 4; i++) front([Gy.legAft - .002, s0 + .12 + i*.18, -.24], .22, .15, [-1, 0], 'drawer');
  front([Gy.legAft - .002, s0 + .45, -.6], .3, .7, [-1, 0]);
  front([3.8, s0 + .45, Gy.legInner - .002], .36, .7, [0, 1]);
  // bulkhead to the aft cabin above the counter, and lockers along the hull
  igrid(span(top, 1.3, 6).map(y => [[Gy.aft, y, Gy.inner], [Gy.aft, y, -Math.max(-Gy.inner, hin(Gy.aft, y))]]), intMat.wood);
  { const zi = Math.min(...span(Gy.aft, Gy.fwd, 6).map(x => hin(x, .72))) - .3; hullBlock(Gy.aft + .02, Gy.fwd - .02, .68, 1.0, Math.max(zi, .5), -1, intMat.wood); }

  // navigation station: seat facing forward, chart table, and the Malö electrical panel on the hull side
  const N = INT.nav;
  hullBlock(N.aft, N.seatFwd, s0, s0 + .33, N.inner, 1, intMat.wood); hullBlock(N.aft, N.seatFwd, s0 + .33, s0 + .43, N.inner, 1, intMat.cushion, 'top');
  hullBlock(N.seatFwd + .05, N.fwd, s0, s0 + N.table, N.inner, 1, intMat.wood);
  const px = (N.seatFwd + N.fwd)/2 + .1, py = s0 + N.table + .42, pz = hin(px, py) - .02;
  ibox([px, py, pz], [.34, .3, .012], intMat.trim); ibox([px, py - .01, pz - .008], [.28, .2, .006], intMat.panel);
  for (let i = 0; i < 3; i++) { const g = iput(new T.CircleGeometry(.022, 18), intMat.white); g.position.set(px + .03 + i*.05, py - .03, pz - .012); g.rotation.y = Math.PI; }

  // companionway steps from the cockpit down to the sole, in their own group so they can be lifted out
  const S = INT.steps, n = S.treads, before = IG.children.length;
  for (let i = 0; i < n; i++) {
    const f = (i + 1)/(n + 1), x = lerp(S.botX, S.topX, f), y = lerp(s0, CP.threshold, f);
    ibox([x, y, S.z], [.13, .03, S.half*2], intMat.trim);
  }
  [1, -1].forEach(s => rod(IG, [S.botX + .02, s0, S.z + s*(S.half + .02)], [S.topX - .02, CP.threshold, S.z + s*(S.half + .02)], .022, intMat.trim));
  // engine compartment front: a mahogany wall right behind the ladder, from the sole up to the cockpit, lifted out with it
  const wx = INT.steps.topX - .03, wl = INT.aftCabin.wall, wr = INT.head.inner;
  ibox([wx, (s0 + CP.threshold)/2, (wl + wr)/2], [.02, CP.threshold - s0, wr - wl], intMat.wood);
  for (let k = 0; k < 2; k++) front([wx + .012, s0 + .25 + k*.5, (wl + wr)/2], .46, .4, [1, 0]);
  G.ladder = new T.Group(); IG.children.slice(before).forEach(c => G.ladder.add(c)); IG.add(G.ladder);
})();

/* ---------- Head, aft cabin and engine box ---------- */
(function aft() {
  const H = INT.head, A = INT.aftCabin, fy = INT.aftSole, ceil = x => CP.seat - .04;
  const wall = (a, b, m = intMat.wood) => igrid(span(fy, ceil(), 6).map(y => [[a[0], y, a[1]], [b[0], y, b[1]]]), m);   // straight wall, sole to ceiling
  const door = ([a, b]) => {                                     // angled door with a framed panel and a steel handle
    wall(a, b, intMat.trim); const mx = (a[0] + b[0])/2, mz = (a[1] + b[1])/2, ang = Math.atan2(b[0] - a[0], b[1] - a[1]), w = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const p = ibox([mx, (fy + ceil())/2, mz], [.012, (ceil() - fy)*.7, w*.7], intMat.wood); p.rotation.y = ang;
    const hnd = ibox([lerp(a[0], b[0], .85), fy + .95, lerp(a[1], b[1], .85)], [.03, .02, .1], intMat.steel); hnd.rotation.y = ang;
  };
  // head: inboard wall beside the ladder, forward wall, angled door; light laminate inside
  wall([H.aft, H.inner], [H.door[0][0], H.inner]);
  wall([H.door[1][0], H.door[1][1]], [H.door[1][0], hin(H.door[1][0], .2)]);
  door(H.door);
  igrid(span(fy, ceil(), 6).map(y => [[H.aft, y, H.inner], [H.aft, y, Math.max(H.inner, hin(H.aft, y))]]), intMat.laminate);
  const [tx, tz] = H.toilet; const bowl = iput(new T.CylinderGeometry(.17, .13, .36, 20), intMat.white); bowl.position.set(tx, fy + .18, tz); bowl.scale.set(1.2, 1, 1);
  const lid = iput(new T.CylinderGeometry(.18, .18, .03, 20), intMat.white); lid.position.set(tx, fy + .38, tz); lid.scale.set(1.2, 1, 1);
  const zi = H.door[1][1] + .02;                                 // basin counter outboard of the floor
  hullBlock(H.basin[0], H.basin[1], fy, fy + .78, zi, 1, intMat.wood); hullBlock(H.basin[0], H.basin[1], fy + .78, fy + .8, zi - .01, 1, intMat.white, 'top');
  const basin = iput(new T.CircleGeometry(.14, 24), new T.MeshStandardMaterial({ color: C('#e8e6e0'), roughness: .2 })); basin.rotation.x = -Math.PI/2; basin.scale.set(1.5, 1, 1); basin.position.set((H.basin[0] + H.basin[1])/2, fy + .805, zi + .16);

  // aft cabin: the berth aft, a standing area forward of it, an inboard wall beside the ladder and an angled door
  aftBerth();
  wall([A.aft, A.wall], [A.door[0][0], A.wall]);
  door(A.door);
})();

/* ---------- Aft cabin double berth ----------
   From the brochure plan: a wide berth under the cockpit to port, from the stern forward to the standing area,
   inboard edge at the cabin wall. It sits low, so there is sitting headroom under the cockpit seat. */
function aftBerth() {
  const B = INT.aftBerth, z0 = -B.inner, top = B.top, base = top - B.mattress, xs = span(B.aft, B.fwd, 30);
  const out = (x, y) => Math.max(B.inner + .1, hin(x, y) - .01);
  // mahogany platform with a front facing the standing area, and a lee board along the inboard side
  hullBlock(B.aft, B.fwd, INT.sole, base, B.inner, -1, intMat.wood);
  ibox([B.fwd + .012, (INT.sole + base + .04)/2, -(B.inner + out(B.fwd, base))/2], [.024, base + .04 - INT.sole, out(B.fwd, base) - B.inner], intMat.trim);
  for (let i = 0; i < 2; i++) front([B.fwd + .026, INT.sole + .14 + i*.2, -(B.inner + .25)], .32, .15, [1, 0], 'drawer');
  ibox([(B.aft + B.fwd)/2, base + .03, z0 - .012], [B.fwd - B.aft, .06, .024], intMat.trim);
  // mattress: rounded edges, following the hull on its outboard side, with a seam along the middle
  const rows = xs.map(x => { const o = out(x, top); return span(B.inner + .02, o - .02, 10).map(a => [x, top, -a]); });
  igrid(rows, intMat.cushion);
  igrid(xs.map(x => [[x, base, -(B.inner)], [x, top - .025, -(B.inner)], [x, top, -(B.inner + .02)]]), intMat.cushion);
  igrid(xs.map(x => { const o = out(x, top); return [[x, top, -(o - .02)], [x, top - .025, -o], [x, base, -out(x, base)]]; }), intMat.cushion);
  [B.aft, B.fwd].forEach((x, k) => { const o = out(x, top); igrid(span(B.inner, o, 10).map(a => [[x + (k ? .004 : -.004), base, -a], [x + (k ? .004 : -.004), top - .01, -a]]), intMat.cushion); });
  ibox([(B.aft + B.fwd)/2, top + .002, -(B.inner + out(1.4, top))/2], [B.fwd - B.aft - .08, .004, .012], new T.MeshStandardMaterial({ color: C('#8796a0'), roughness: .9 }));
  // two pillows at the forward end, where the headroom is
  [.27, .62].forEach(d => { const p = iput(new T.SphereGeometry(1, 20, 12), new T.MeshStandardMaterial({ color: C('#f2f0ea'), roughness: .9 }));
    p.scale.set(.2, .06, .26); p.position.set(B.fwd - .26, top + .05, -(B.inner + d)); });
  // folded blanket at the foot
  ibox([B.aft + .45, top + .025, -(B.inner + out(B.aft + .45, top))/2], [.35, .05, out(B.aft + .45, top) - B.inner - .1], new T.MeshStandardMaterial({ color: C('#23457f'), roughness: .95 }));
  // reading lamp on the hull side
  const lx = B.fwd - .45, ly = top + .4, lz = -(hin(lx, ly) - .03); const l = iput(new T.CylinderGeometry(.03, .045, .07, 16), intMat.brass); l.position.set(lx, ly, lz);
}

/* ---------- Warm cabin lights, on only when the interior is open ---------- */
const intLights = [[5.2, 1.18, 0], [3.5, 1.18, -.4], [3.5, 1.18, .6], [7.6, 1.0, 0], [1.4, .7, -.7], [2.4, 1.1, .8], [6.6, 1.15, 0]].map(([x, y, z]) => {
  const l = new T.PointLight(0xffd9a8, .55, 3.2, 2); l.position.set(x, y, z); IG.add(l); return l;
});
