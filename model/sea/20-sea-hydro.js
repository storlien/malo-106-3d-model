/* ===== Sea trial, part 2: weight, hydrostatics and the righting-arm (GZ) curve =====
   Buoyancy is integrated over cross-sections of the model's own hull, with the fin keel and the deckhouse,
   less the open cockpit. Heights are in the boat frame: y up from the drawing's waterline, x forward from the transom. */
const SeaHydro = (() => {
  const P = SEA.published, nSt = 56, x0 = .06, x1 = L - .02, dx = (x1 - x0)/nSt;
  const xs = Array.from({ length: nSt + 1 }, (_, i) => x0 + i*dx);

  /* Fin and deadwood as NACA-like sections: their outline at station x, or null. */
  function foilOutline(levels, x) {
    const right = [];
    for (let i = 0; i <= 24; i++) {
      const f = i/24, y = lerp(levels[0][0], levels[levels.length - 1][0], f);
      let k = 0; while (k < levels.length - 2 && y < levels[k + 1][0]) k++;
      const a = levels[k], b = levels[k + 1], t = clamp((y - a[0])/(b[0] - a[0]), 0, 1);
      const le = lerp(a[1], b[1], t), te = lerp(a[2], b[2], t), tc = lerp(a[3], b[3], t), c = le - te, u = (le - x)/c;
      if (u < 0 || u > 1) continue;
      const half = 5*tc*c*(.2969*Math.sqrt(u) - .126*u - .3516*u*u + .2843*u*u*u - .1015*u*u*u*u);
      right.push([half, y]);
    }
    if (right.length < 2) return null;
    return [...right, ...right.slice().reverse().map(([w, y]) => [-w, y])];   // down the starboard face, up the port face
  }
  /* All outlines at one station, each with a sign: hull and deckhouse +, open cockpit −. */
  function sections(x) {
    const out = [], st = [];
    for (let i = 0; i <= 20; i++) st.push(sectionPt(x, i/20));
    const S = sheerY(x), top = [];
    if (x > SPEC.cockpit.fwd && x < SPEC.house.fwd - .02 && houseHalf(x) > .05) {
      const hb = houseHalf(x), ht = hb*SPEC.house.tumble, R = SPEC.house.roof;
      top.push([hb, S], [ht, R], [-ht, R], [-hb, S]);
    }
    out.push({ s: 1, p: [...st, ...top, ...st.slice().reverse().map(([w, y]) => [-w, y])] });
    [SPEC.keel.fin, SPEC.keel.deadwood].forEach(lv => { const f = foilOutline(lv, x); if (f) out.push({ s: 1, p: f.slice().reverse() }); });
    const CPk = SPEC.cockpit, ch = cockpitHalf(x);
    if (ch > .02) {                                     // the cockpit is open to the sea: seats to sheer, and the footwell
      out.push({ s: -1, p: [[ch, CPk.seat], [ch, S + .05], [-ch, S + .05], [-ch, CPk.seat]] });
      if (x > CPk.aftRail + CPk.benchDepth && x < CPk.footFwd) out.push({ s: -1, p: [[CPk.footHalf, CPk.sole], [CPk.footHalf, CPk.seat], [-CPk.footHalf, CPk.seat], [-CPk.footHalf, CPk.sole]] });
    }
    return out;
  }
  const SECT = xs.map(sections);

  /* Area and first moments of the part of an outline below the water at heel (c, s) and waterline d. */
  function wet(poly, c, s, d) {
    const q = poly.map(([z, y]) => [y*s + z*c, y*c - z*s]), o = [];
    for (let i = 0; i < q.length; i++) {
      const a = q[i], b = q[(i + 1)%q.length], ia = a[1] <= d, ib = b[1] <= d;
      if (ia) o.push(a);
      if (ia !== ib) { const t = (d - a[1])/(b[1] - a[1]); o.push([a[0] + t*(b[0] - a[0]), d]); }
    }
    let A = 0, MH = 0, MY = 0;
    for (let i = 0; i < o.length; i++) {
      const [h0, y0] = o[i], [h1, y1] = o[(i + 1)%o.length], k = h0*y1 - h1*y0;
      A += k; MH += (h0 + h1)*k; MY += (y0 + y1)*k;
    }
    return [A/2, MH/6, MY/6];
  }
  /* Displaced volume and centre of buoyancy (horizontal H, vertical Y in the heeled frame; x along the boat). */
  function displaced(phi, d) {
    const c = Math.cos(phi), s = Math.sin(phi); let V = 0, H = 0, Y = 0, X = 0;
    SECT.forEach((list, i) => list.forEach(({ s: sg, p }) => {
      const [A, a, b] = wet(p, c, s, d), w = (i === 0 || i === nSt ? .5 : 1)*dx*sg;
      V += A*w; H += a*w; Y += b*w; X += A*w*xs[i];
    }));
    return { V, H: H/V, Y: Y/V, X: X/V };
  }
  const draftFor = (phi, Vt) => { let a = -4, b = 4; for (let k = 0; k < 44; k++) { const m = (a + b)/2; if (displaced(phi, m).V < Vt) a = m; else b = m; } return (a + b)/2; };

  /* Fin centroid, where the lead sits. */
  function finCentroid() {
    let V = 0, X = 0, Y = 0;
    xs.forEach(x => { const f = foilOutline(SPEC.keel.fin, x); if (!f) return; const [A, , MY] = wet(f.slice().reverse(), 1, 0, 99); V += A; X += A*x; Y += MY; });
    return { x: X/V, y: Y/V, V: V*dx };
  }

  /* Weight: published displacement, with the stated items inside it, plus load and the solar arch as chosen. */
  function weights(arch) {
    const fin = finCentroid(), list = [], beam = 2*Math.max(...xs.map(halfB));
    SEA.items.forEach(([name, kg, y, x, len]) => list.push({ name, kg, y, x, len }));
    list.push({ name: 'Lead keel', kg: P.ballast, y: fin.y, x: fin.x, len: 0 });
    const inside = list.reduce((a, q) => a + q.kg, 0);
    list.push({ name: 'Hull, deck and interior', kg: P.displacement - inside, y: SEA.rest.y, x: 0, len: 0, rest: true });
    list.push({ name: 'Crew, stores, half tanks', kg: SEA.load.kg, y: SEA.load.y, x: SEA.load.x, len: 0 });
    if (arch) arch.forEach(a => list.push(a));
    const m = list.reduce((a, q) => a + q.kg, 0);
    // the hull share sits where it puts the boat's centre of gravity over its centre of buoyancy
    const restItem = list.find(q => q.rest);
    return { list, m, beam, fin, restItem };
  }

  function analyse(arch) {
    const W = weights(arch), Vt = W.m/SEA.rho;
    const d0 = draftFor(0, Vt), B0 = displaced(0, d0);
    W.restItem.x = (B0.X*W.m - W.list.filter(q => !q.rest).reduce((a, q) => a + q.kg*q.x, 0))/W.restItem.kg;   // level trim
    const xG = W.list.reduce((a, q) => a + q.kg*q.x, 0)/W.m, yG = W.list.reduce((a, q) => a + q.kg*q.y, 0)/W.m;

    // waterplane and strips at the upright waterline
    const strips = xs.map(x => ({ x, b: hullHalf(x, d0), T: Math.max(0, d0 - Math.min(keelY(x), sheerY(x))) })).filter(q => q.b > .01);
    const Aw = strips.reduce((a, q) => a + 2*q.b*dx, 0), LCF = strips.reduce((a, q) => a + 2*q.b*q.x*dx, 0)/Aw;
    const IT = strips.reduce((a, q) => a + 2/3*q.b**3*dx, 0), IL = strips.reduce((a, q) => a + 2*q.b*(q.x - LCF)**2*dx, 0);
    const lwl = strips.length ? strips[strips.length - 1].x - strips[0].x + dx : 0, bwl = 2*Math.max(...strips.map(q => q.b));
    const BM = IT/Vt, GM = B0.Y + BM - yG;

    // inertia about the centre of gravity
    let I44 = 0, I55 = 0;
    W.list.forEach(q => {
      const dy = q.y - yG, dxg = q.x - xG;
      I44 += q.kg*dy*dy + q.kg*q.len*q.len/12; I55 += q.kg*(dy*dy + dxg*dxg) + q.kg*q.len*q.len/12*.05;
      if (q.rest) { I44 += q.kg*(SEA.rest.rollGyration*W.beam)**2; I55 += q.kg*(SEA.rest.pitchGyration*L)**2; }
    });

    // righting arm, every 2.5 degrees to 180
    const gz = [];
    for (let a = 0; a <= 180.01; a += 2.5) {
      const phi = a*Math.PI/180, d = draftFor(phi, Vt), B = displaced(phi, d);
      gz.push([a, a === 0 ? 0 : B.H - yG*Math.sin(phi)]);
    }
    let iMax = 0; gz.forEach((p, i) => { if (p[1] > gz[iMax][1]) iMax = i; });
    let avs = 180; for (let i = iMax; i < gz.length - 1; i++) if (gz[i][1] > 0 && gz[i + 1][1] <= 0) { avs = gz[i][0] + 2.5*gz[i][1]/(gz[i][1] - gz[i + 1][1]); break; }
    const posArea = gz.reduce((a, p, i) => a + (i && p[1] > 0 ? p[1]*2.5 : 0), 0), negArea = gz.reduce((a, p, i) => a + (i && p[1] < 0 ? -p[1]*2.5 : 0), 0);

    const g = SEA.g, A = SEA.addedMass;
    const Troll = 2*Math.PI*Math.sqrt(I44*(1 + A.roll)/(W.m*g*GM)), Theave = 2*Math.PI*Math.sqrt(W.m*(1 + A.heave)/(SEA.rho*g*Aw)), Tpitch = 2*Math.PI*Math.sqrt(I55*(1 + A.pitch)/(SEA.rho*g*IL));
    const lb = W.m*2.20462, bft = W.beam/.3048, loaFt = L/.3048, lwlFt = lwl/.3048;
    return {
      W, m: W.m, V: Vt, d0, sink: d0 - SPEC.hull.floatSink, xG, yG, KB: B0.Y, BM, GM, Aw, IT, IL, LCF, lwl, bwl, strips, stripDx: dx,
      I44, I55, gz, gzMax: gz[iMax], avs, ratio: negArea ? posArea/negArea : Infinity, Troll, Theave, Tpitch,
      capsize: bft/Math.cbrt(lb/64), comfort: lb/(.65*(.7*lwlFt + .3*loaFt)*Math.pow(bft, 1.333)),
      immersion: SEA.rho*Aw/100, finKg: W.fin.V*11340,
    };
  }
  const gzAt = (S, deg) => {                           // interpolated, odd about upright, any angle
    const d = ((deg + 180)%360 + 360)%360 - 180, b = Math.abs(d), i = Math.min(S.gz.length - 2, Math.floor(b/2.5)), f = (b - S.gz[i][0])/2.5;
    return Math.sign(d)*lerp(S.gz[i][1], S.gz[i + 1][1], f);
  };
  return { analyse, gzAt };
})();
