/* Supporting pipes for the vertical and angled arches, and a structural check of the frame as built.
   The frame is analysed as welded 3D beams (finite elements); every load case gives the stress in every pipe,
   and the feet give the loads the deck and transom fittings must carry. Load cases and limits live in SPEC.solarArches.strength. */
const ST = AC.strength;

/* ---------- Supporting pipes ---------- */
function archBraces({ list, pipe, footPlate, legs, yRail, railFwd, railAft, frameHalf, crossAt }) {
  const on = id => list.includes(id), at = (leg, t) => leg.base.map((v, i) => lerp(v, leg.top[i], t));
  const crossed = new Set(crossAt.map(x => x.toFixed(3)));
  const cross = x => {                                   // a cross tube where a leg meets the frame, if there is none
    if (crossAt.some(c => Math.abs(c - x) < .02) || crossed.has(x.toFixed(3))) return;
    crossed.add(x.toFixed(3)); pipe([[x, yRail, -frameHalf], [x, yRail, frameHalf]]);
  };
  const B = ST.braces;
  if (on('knee')) legs.forEach(l => {                    // knee in the top corner of each leg, in the leg's own athwartships plane
    cross(l.top[0]);
    pipe([at(l, 1 - B.knee.down/Math.hypot(l.top[0] - l.base[0], l.top[1] - l.base[1], l.top[2] - l.base[2])), [l.top[0], yRail, l.top[2] - l.s*B.knee.inboard]]);
  });
  if (on('side')) [1, -1].forEach(s => {                 // diagonal from low on the fore leg up to the side of the frame, halfway aft
    const f = legs.find(l => l.kind === 'fore' && l.s === s), r = legs.find(l => l.kind === 'rear' && l.s === s);
    const xm = lerp(f.top[0], r.top[0], B.side.along), zm = lerp(f.top[2], r.top[2], B.side.along);
    pipe([at(f, B.side.low), [xm, yRail, zm]]);
  });
  if (on('stays')) legs.filter(l => l.kind === 'fore').forEach(l => {   // stay from the frame corner forward and down to the side deck
    const fx = l.base[0] + B.stays.forward, fz = l.s*(Math.abs(l.base[2]) + B.stays.outboard), foot = [fx, standY(fx, fz), fz];
    pipe([at(l, .97), foot]); footPlate(foot);
  });
  if (on('aftBar')) {                                    // rear truss: a cross bar between the rear pipes above head height, and a V up to the middle of the aft tube
    const rl = [1, -1].map(s => legs.find(l => l.kind === 'rear' && l.s === s)), [a, b] = rl.map(l => at(l, B.aftBar.up)), tx = (rl[0].top[0] + rl[1].top[0])/2;
    cross(tx); pipe([a, b]); pipe([a, [tx, yRail, 0]]); pipe([b, [tx, yRail, 0]]);
  }
  const rungs = list.find(id => id.startsWith('rungs'));
  if (rungs) [1, -1].forEach(s => {                      // horizontal pipes between the fore and rear pipe on each side, evenly up the legs
    const f = legs.find(l => l.kind === 'fore' && l.s === s), r = legs.find(l => l.kind === 'rear' && l.s === s), n = +rungs.slice(5);
    const y0 = Math.max(f.base[1], r.base[1]) + B.rungs.above, y1 = yRail - B.rungs.below, onLeg = (l, y) => at(l, (y - l.base[1])/(l.top[1] - l.base[1]));
    for (let k = 0; k < n; k++) { const y = n === 1 ? y0 : lerp(y0, y1, k/(n - 1)); pipe([onLeg(f, y), onLeg(r, y)]); }
  });
  if (on('planX')) [1, -1].forEach(s => pipe([[railFwd, yRail, s*frameHalf], [railAft, yRail, -s*frameHalf]]));   // X under the panels
}

/* ---------- Frame analysis ---------- */
function archStrength(b) {
  if (b.strength !== undefined) return b.strength;
  if (!b.members || !b.supports) return b.strength = null;
  const D = b.D, t = AC.pipeWall, E = ST.E, Gm = E/(2*(1 + .3));
  const A = Math.PI*(D - t)*t, I = Math.PI/64*(D**4 - (D - 2*t)**4), J = 2*I, W = I/(D/2), kgPerM = A*7980;
  // foot sleeves: a tube welded inside the bottom of each pipe, sliding fit, same wall
  const sleeve = (b.braces || []).includes('sleeves'), di = D - 2*t - .001, As = Math.PI*(di - t)*t, Is = Math.PI/64*(di**4 - (di - 2*t)**4);

  // 1. straight segments, split wherever another pipe's end lands on them, then into short elements
  const segs = []; b.members.forEach(pts => { for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i].slice(), pts[i + 1].slice(), 1]); });
  // the panels' aluminium frames are bolted across the rails under them and tie those rails together
  const railZ = segs.filter(([a, c]) => Math.abs(a[1] - b.yRail) < .005 && Math.abs(c[1] - b.yRail) < .005 && Math.abs(a[2] - c[2]) < .001).map(([a]) => a[2]);
  const snap = z => { let best = z, bd = .07; railZ.forEach(r => { if (Math.abs(r - z) < bd) { bd = Math.abs(r - z); best = r; } }); return best; };
  b.panels.forEach(([f, a, z0, z1]) => { const p0 = snap(z0), p1 = snap(z1); [f, a].forEach(x => segs.push([[x, b.yRail, p0], [x, b.yRail, p1], ST.panelFrame])); });
  // pipe ends that touch another pipe (centres within a diameter) are welded to it: move them onto its centre line
  const weld = D;
  segs.forEach((sg, si) => [0, 1].forEach(e => {
    const p = sg[e]; let best = null, bd = weld;
    segs.forEach((o, oi) => {
      if (oi === si) return;
      const [a, c] = o, d = c.map((v, i) => v - a[i]), L2 = d[0]*d[0] + d[1]*d[1] + d[2]*d[2], q = clamp(((p[0] - a[0])*d[0] + (p[1] - a[1])*d[1] + (p[2] - a[2])*d[2])/L2, 0, 1);
      const x = a.map((v, i) => v + d[i]*q), dist = Math.hypot(x[0] - p[0], x[1] - p[1], x[2] - p[2]);
      if (dist > 1e-4 && dist < bd) { bd = dist; best = x; }
    });
    if (best) { const old = p.slice(); segs.forEach(o => [0, 1].forEach(k => { if (Math.hypot(o[k][0] - old[0], o[k][1] - old[1], o[k][2] - old[2]) < 1e-4) o[k] = best.slice(); })); }
  }));
  const ends = segs.flatMap(s => [s[0], s[1]]);
  const pieces = [];
  segs.forEach(([a, c, ef]) => {
    const d = c.map((v, i) => v - a[i]), L2 = d[0]*d[0] + d[1]*d[1] + d[2]*d[2], ts = [0, 1];
    ends.forEach(p => {
      const q = ((p[0] - a[0])*d[0] + (p[1] - a[1])*d[1] + (p[2] - a[2])*d[2])/L2;
      if (q <= .002 || q >= .998) return;
      const e = Math.hypot(a[0] + d[0]*q - p[0], a[1] + d[1]*q - p[1], a[2] + d[2]*q - p[2]);
      if (e < .008) ts.push(q);
    });
    ts.sort((x, y) => x - y);
    for (let i = 0; i < ts.length - 1; i++) {
      const p0 = a.map((v, k) => v + d[k]*ts[i]), p1 = a.map((v, k) => v + d[k]*ts[i + 1]), len = Math.sqrt(L2)*(ts[i + 1] - ts[i]);
      if (len < .003) continue;
      const n = Math.max(1, Math.ceil(len/ST.element));
      for (let k = 0; k < n; k++) pieces.push([p0.map((v, j) => lerp(v, p1[j], k/n)), p0.map((v, j) => lerp(v, p1[j], (k + 1)/n)), ef]);
    }
  });
  // 2. nodes, merged within 6 mm
  const nodes = [], key = p => p.map(v => Math.round(v/.006)).join(','), grid = new Map();
  const node = p => {
    const k0 = p.map(v => Math.round(v/.006));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const i = grid.get([k0[0] + dx, k0[1] + dy, k0[2] + dz].join(','));
      if (i !== undefined && Math.hypot(nodes[i][0] - p[0], nodes[i][1] - p[1], nodes[i][2] - p[2]) < .006) return i;
    }
    nodes.push(p.slice()); grid.set(key(p), nodes.length - 1); return nodes.length - 1;
  };
  const els = pieces.map(([p, q, ef]) => [node(p), node(q), ef]).filter(([i, j]) => i !== j);
  const n = nodes.length, N = n*6;
  // 3. supports: welded base plates and transom plates, fixed in all six directions
  const fixed = new Set();
  b.supports.forEach(s => {
    let best = -1, bd = .04; nodes.forEach((p, i) => { const d = Math.hypot(p[0] - s.p[0], p[1] - s.p[1], p[2] - s.p[2]); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) fixed.add(best);
  });
  // 4. element stiffness in global axes
  const K = new Float64Array(N*N), mass = new Float64Array(n), Ts = [];
  const supP = b.supports.map(s => s.p);
  els.forEach(([i, j, ef]) => {
    const a = nodes[i], c = nodes[j], L = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const mid = a.map((v, k) => (v + c[k])/2), sl = sleeve && ef === 1 && supP.some(p => Math.hypot(p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]) < ST.sleeveLength);
    const Ae = sl ? A + As : A, Ie = sl ? I + Is : I, Je = 2*Ie;
    const ex = [(c[0] - a[0])/L, (c[1] - a[1])/L, (c[2] - a[2])/L], ref = Math.abs(ex[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    let ez = [ex[1]*ref[2] - ex[2]*ref[1], ex[2]*ref[0] - ex[0]*ref[2], ex[0]*ref[1] - ex[1]*ref[0]]; const nz = Math.hypot(...ez); ez = ez.map(v => v/nz);
    const ey = [ez[1]*ex[2] - ez[2]*ex[1], ez[2]*ex[0] - ez[0]*ex[2], ez[0]*ex[1] - ez[1]*ex[0]], R = [ex, ey, ez];
    const k = new Float64Array(144), set = (r, q, v) => { k[r*12 + q] += v; if (r !== q) k[q*12 + r] += v; };
    const Ee = E*ef, EA = Ee*Ae/L, GJ = Gm*ef*Je/L, a1 = 12*Ee*Ie/L**3, a2 = 6*Ee*Ie/L**2, a3 = 4*Ee*Ie/L, a4 = 2*Ee*Ie/L;
    set(0, 0, EA); set(6, 6, EA); set(0, 6, -EA); set(3, 3, GJ); set(9, 9, GJ); set(3, 9, -GJ);
    // bending about local z (deflection in y): dofs 1, 5, 7, 11; about local y (deflection in z): dofs 2, 4, 8, 10
    set(1, 1, a1); set(7, 7, a1); set(1, 7, -a1); set(1, 5, a2); set(1, 11, a2); set(7, 5, -a2); set(7, 11, -a2); set(5, 5, a3); set(11, 11, a3); set(5, 11, a4);
    set(2, 2, a1); set(8, 8, a1); set(2, 8, -a1); set(2, 4, -a2); set(2, 10, -a2); set(8, 4, a2); set(8, 10, a2); set(4, 4, a3); set(10, 10, a3); set(4, 10, a4);
    // kg = Tᵀ k T, with T block-diagonal R
    const kg = new Float64Array(144);
    for (let r = 0; r < 12; r++) for (let q = 0; q < 12; q++) {
      let v = 0; const br = Math.floor(r/3), bq = Math.floor(q/3), rr = r%3, qq = q%3;
      for (let a3_ = 0; a3_ < 3; a3_++) for (let b3 = 0; b3 < 3; b3++) v += R[a3_][rr]*k[(br*3 + a3_)*12 + bq*3 + b3]*R[b3][qq];
      kg[r*12 + q] = v;
    }
    const dof = [...[0, 1, 2, 3, 4, 5].map(d => i*6 + d), ...[0, 1, 2, 3, 4, 5].map(d => j*6 + d)];
    for (let r = 0; r < 12; r++) for (let q = 0; q < 12; q++) K[dof[r]*N + dof[q]] += kg[r*12 + q];
    Ts.push({ i, j, L, R, k, dof, steel: ef === 1, A: Ae, W: Ie/(D/2) });
    if (ef === 1) { const kgm = kgPerM*Ae/A; mass[i] += kgm*L/2; mass[j] += kgm*L/2; }
  });
  // panels: each panel's weight and wind load go to the frame nodes nearest its four corners
  const panelNodes = b.panels.map(([f, a, z0, z1]) => [[f, z0], [f, z1], [a, z0], [a, z1]].map(([x, z]) => {
    let best = 0, bd = 9; nodes.forEach((p, i) => { const d = Math.hypot(p[0] - x, (p[1] - b.yRail)*3, p[2] - z); if (d < bd) { bd = d; best = i; } });
    return best;
  }));
  panelNodes.forEach(c => c.forEach(i => { mass[i] += AC.panel.kg/4; }));
  ST.extraKg && nodes.forEach((p, i) => { if (Math.abs(p[1] - b.yRail) < .01) mass[i] += ST.extraKg/nodes.filter(q => Math.abs(q[1] - b.yRail) < .01).length; });

  // 5. Cholesky factor of the free part
  const free = []; for (let i = 0; i < n; i++) if (!fixed.has(i)) for (let d = 0; d < 6; d++) free.push(i*6 + d);
  const m = free.length, Lc = new Float64Array(m*m);
  for (let r = 0; r < m; r++) for (let q = 0; q <= r; q++) Lc[r*m + q] = K[free[r]*N + free[q]];
  let dMax = 0; for (let j = 0; j < m; j++) dMax = Math.max(dMax, Lc[j*m + j]);
  for (let j = 0; j < m; j++) {
    let d = Lc[j*m + j]; for (let k = 0; k < j; k++) d -= Lc[j*m + k]**2;
    if (d <= 1e-9*dMax) return b.strength = { unstable: true };            // a part that is not held: no answer
    d = Math.sqrt(d); Lc[j*m + j] = d;
    for (let r = j + 1; r < m; r++) { let v = Lc[r*m + j]; for (let k = 0; k < j; k++) v -= Lc[r*m + k]*Lc[j*m + k]; Lc[r*m + j] = v/d; }
  }
  const solve = F => {
    const y = new Float64Array(m); for (let r = 0; r < m; r++) { let v = F[free[r]]; for (let k = 0; k < r; k++) v -= Lc[r*m + k]*y[k]; y[r] = v/Lc[r*m + r]; }
    for (let r = m - 1; r >= 0; r--) { let v = y[r]; for (let k = r + 1; k < m; k++) v -= Lc[k*m + r]*y[k]; y[r] = v/Lc[r*m + r]; }
    const u = new Float64Array(N); free.forEach((g, r) => { u[g] = y[r]; }); return u;
  };
  // 6. stresses and foot loads for one load vector
  const g = 9.81;
  const evaluate = (F, perEl) => {
    const u = solve(F); let sMax = 0, where = null;
    const reac = new Map();
    Ts.forEach((e, ei) => {
      const ue = e.dof.map(d => u[d]), ul = new Float64Array(12);
      for (let blk = 0; blk < 4; blk++) for (let r = 0; r < 3; r++) { let v = 0; for (let q = 0; q < 3; q++) v += e.R[r][q]*ue[blk*3 + q]; ul[blk*3 + r] = v; }
      const f = new Float64Array(12); for (let r = 0; r < 12; r++) { let v = 0; for (let q = 0; q < 12; q++) v += e.k[r*12 + q]*ul[q]; f[r] = v; }
      if (e.steel) [0, 6].forEach(o => {
        const Nx = f[o], Tq = f[o + 3], M = Math.hypot(f[o + 4], f[o + 5]), sig = Math.abs(Nx)/e.A + M/e.W, tau = Math.abs(Tq)/(2*e.W), vm = Math.sqrt(sig*sig + 3*tau*tau);
        if (vm > sMax) { sMax = vm; where = nodes[o ? e.j : e.i]; }
        if (perEl && vm/1e6 > perEl[ei]) perEl[ei] = vm/1e6;
      });
      [[e.i, 0], [e.j, 6]].forEach(([nd, o]) => {
        if (!fixed.has(nd)) return;
        const r = reac.get(nd) || new Float64Array(6);
        for (let blk = 0; blk < 2; blk++) for (let q = 0; q < 3; q++) { let v = 0; for (let k2 = 0; k2 < 3; k2++) v += e.R[k2][q]*f[o + blk*3 + k2]; r[blk*3 + q] += v; }
        reac.set(nd, r);
      });
    });
    let fMax = 0, mMax = 0; reac.forEach(r => { fMax = Math.max(fMax, Math.hypot(r[0], r[1], r[2])); mMax = Math.max(mMax, Math.hypot(r[3], r[4], r[5])); });
    return { u, stress: sMax/1e6, where, foot: fMax, footM: mMax };
  };
  const inertia = (ax, ay, az) => { const F = new Float64Array(N); for (let i = 0; i < n; i++) { F[i*6] = mass[i]*ax*g; F[i*6 + 1] = mass[i]*ay*g; F[i*6 + 2] = mass[i]*az*g; } return F; };
  const add = (F, i, v) => { F[i*6] += v[0]; F[i*6 + 1] += v[1]; F[i*6 + 2] += v[2]; return F; };
  const near = (x, y, z) => { let best = 0, bd = 9; nodes.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y, p[2] - z); if (d < bd && !fixed.has(i)) { bd = d; best = i; } }); return best; };

  // 7. load cases
  const C = ST.cases, out = [], allow = ST.yield/ST.gamma;
  const q = .5*1.225*C.wind.speed**2*C.wind.cn, area = b.panels.length*AC.panel.length*AC.panel.width;
  const perCase = [];                                   // each case's stress in every element, as a fraction of what it may carry
  const run = (id, name, F, factor = 1) => { const el = new Float64Array(Ts.length), r = evaluate(F, el); perCase.push(el.map(v => v*factor/(allow/1e6))); out.push({ id, name, stress: r.stress*factor, util: r.stress*factor/(allow/1e6), foot: r.foot*factor, footM: r.footM*factor, where: r.where }); return r; };
  run('knock', `Knockdown, ${C.knock.side} g sideways`, inertia(0, -C.knock.down, C.knock.side));
  run('slam', `Slamming, ${C.slam.down} g down`, inertia(0, -C.slam.down, C.slam.side));
  run('pitch', `Pitching, ${C.pitch.fore} g fore and aft`, inertia(C.pitch.fore, -C.pitch.down, 0));
  { const F = inertia(0, -1, 0), per = q*area/panelNodes.length/4;
    panelNodes.forEach(c => c.forEach(i => add(F, i, [0, per, per*C.wind.drag]))); run('wind', `Gale on the panels, ${C.wind.speed} m/s`, F); }
  { const F = add(inertia(0, -1, 0), near(b.railFwd, b.yRail, b.frameHalf), [0, 0, -C.person.push]); run('push', `Person thrown against a corner, ${C.person.push/1000} kN`, F); }
  { const F = add(inertia(0, -1, 0), near(b.railAft, b.yRail, 0), [0, -C.person.hang, 0]); run('hang', `Person hanging from the aft tube, ${C.person.hang/1000} kN`, F); }
  // fatigue: stress range from everyday rolling, both ways
  const fatEl = new Float64Array(Ts.length), fatR = evaluate(inertia(0, 0, C.fatigue.side), fatEl), fat = fatR.stress*2;
  perCase.push(fatEl.map(v => v*2/ST.fatigueRange));
  const elements = Ts.map((e, k) => e.steel ? { a: nodes[e.i], b: nodes[e.j], avg: perCase.reduce((a, c) => a + c[k], 0)/perCase.length, max: Math.max(...perCase.map(c => c[k])) } : null).filter(Boolean);
  // sway: 1 kN at the top corner, and natural frequencies by Rayleigh's method
  const push = evaluate(add(new Float64Array(N), near(b.railFwd, b.yRail, b.frameHalf), [0, 0, 1000])).u, cn = near(b.railFwd, b.yRail, b.frameHalf);
  const freq = (ax, az) => { const u = solve(inertia(ax, 0, az)); let s1 = 0, s2 = 0; for (let i = 0; i < n; i++) { const d = ax ? u[i*6] : u[i*6 + 2]; s1 += mass[i]*d; s2 += mass[i]*d*d; } return Math.sqrt(9.81*Math.abs(s1)/s2)/(2*Math.PI); };
  const gov = out.reduce((a, c) => c.util > a.util ? c : a, out[0]);
  return b.strength = {
    cases: out, governing: gov, fatigueRange: fat, fatigueAt: fatR.where, fatigueUtil: fat/ST.fatigueRange, sway: Math.abs(push[cn*6 + 2])*1000,
    freqSide: freq(0, 1), freqFore: freq(1, 0), steelKg: mass.reduce((a, v) => a + v, 0), braceKg: (b.braceKg || 0) + (sleeve ? b.supports.length*ST.sleeveLength*As*7980 : 0), sleeves: sleeve,
    stressMap: elements, footF: Math.max(...out.map(c => c.foot))/1000, footM: Math.max(...out.map(c => c.footM))/1000, nodes: n, elements: els.length, section: { D, t },
  };
}

/* Rows for the arch panel. */
function strengthRows(s) {
  if (!s) return null;
  if (s.unstable) return [['Frame', 'Unstable: not enough joints to carry load', 'hit']];
  const pc = v => `${num(v*100, 0)} %`, cls = u => u > 1 ? 'hit' : u > ST.warnUtil ? 'warn' : '';
  return [
    ...s.cases.map(c => [c.name, `${pc(c.util)} (${num(c.stress, 0)} MPa)`, cls(c.util)]),
    ['Everyday rolling, stress range', `${num(s.fatigueRange, 0)} MPa of ${ST.fatigueRange}`, cls(s.fatigueUtil)],
    ['Sway at a corner under 1 kN', `${num(s.sway, 0)} mm`, s.sway > ST.swayLimit ? 'warn' : ''],
    ['Sway frequency, athwartships', `${num(s.freqSide, 1)} Hz`, s.freqSide < ST.minFreq ? 'warn' : ''],
    ['Sway frequency, fore and aft', `${num(s.freqFore, 1)} Hz`, s.freqFore < ST.minFreq ? 'warn' : ''],
    ['Largest foot load', `${num(s.footF, 1)} kN, ${num(s.footM, 2)} kN·m`],
    ['Supporting pipes and sleeves', s.braceKg ? `${num(s.braceKg, 1)} kg` : 'None'],
  ];
}

/* ---------- Stress colours: every pipe tinted from steel to deep red by how hard it works ---------- */
const stressColour = (() => {
  const lo = C('#dfe3e6'), mid = C('#f08a7a'), hi = C('#8c0a12'), cache = new Map();
  return u => {
    const k = Math.round(clamp(u, 0, 1)*32); if (cache.has(k)) return cache.get(k);
    const f = k/32, c = f < .5 ? lo.clone().lerp(mid, f/.5) : mid.clone().lerp(hi, (f - .5)/.5);
    const m = new T.MeshStandardMaterial({ color: c, roughness: .5, metalness: .2 }); cache.set(k, m); return m;
  };
})();
function showStress(b, mode) {
  b.stressViews = b.stressViews || {};
  Object.values(b.stressViews).forEach(g => { g.visible = false; });
  const s = mode !== 'off' && b.strength && b.strength.stressMap;
  b.frame.traverse(m => { if (m.isMesh && m.material === mat.steel) m.visible = !s; });     // the plain steel hides while the colours show
  if (!s) return;
  if (!b.stressViews[mode]) {
    const g = new T.Group(), full = ST.colourScale[mode];
    s.forEach(e => rod(g, e.a, e.b, b.D/2 + .0012, stressColour(e[mode]/full), 10));
    b.group.add(g); b.stressViews[mode] = g;
  }
  b.stressViews[mode].visible = true;
}
function stressLegend(mode) {
  if (mode === 'off') return '';
  const full = ST.colourScale[mode], label = mode === 'avg' ? 'Average over all loads' : 'Worst single load';
  return `<div class="stress-legend"><span>${label}, share of what the pipe may carry</span><i></i><b><em>0 %</em><em>${num(full*50, 0)} %</em><em>${num(full*100, 0)} % +</em></b></div>`;
}
