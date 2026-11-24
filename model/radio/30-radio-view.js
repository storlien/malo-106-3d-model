/* ===== HF antenna, part 3: the viewer =====
   An "HF antenna" layer: the wire and its hardware, the current in the wire and the rig, and the beam pattern as a
   coloured lobe around the boat. The panel picks the layout, wire length, matching and band, and shows the feed
   impedance, SWR, losses and gain. The solver runs in a Web Worker; nothing is built or held while the layer is off. */
(function hfViewer() {
  const ws = SPEC.hull.floatSink, st = { layout: 'sloper', len: { sloper: 'fit', vee: 20.1, dipole: 9.95 }, rod: 'aft', match: { sloper: 'tuner', vee: 'tuner', dipole: 'balun' }, band: '40', bonded: false, show: 'both' };
  let A = null, on = false, group = null, worker = null, run = 0, cfg = null, res = {}, segs = null;
  const S = p => [p[0], p[1] - ws, p[2]];                                      // boat frame → solver frame (y from the sea)
  const W = (a, b, kind) => ({ a: S(a), b: S(b), r: HF.wires[kind][0], metal: HF.wires[kind][1], kind });
  const sub = (a, b) => a.map((v, i) => v - b[i]), len = v => Math.hypot(...v), along = (a, b, l) => { const d = sub(b, a), n = len(d); return a.map((v, i) => v + d[i]*l/n); };

  /* ---------- Where things are ---------- */
  function places() {
    const mx = RG.mastX, top = RG.mastTop, F = HF.feed, Sl = HF.slopeTop, Ap = HF.apex, Bw = HF.bow;
    return { mx, top, f0: [F.x, sheerY(F.x) + F.above, halfB(F.x) - F.inset], sTop: [mx + Sl.dx, top - Sl.below, Sl.z],
      apex: [mx + Ap.dx, top - Ap.below, Ap.z], bow: [Bw.x, sheerY(Bw.x) + Bw.above, Math.min(Bw.z, halfB(Bw.x) - .12)] };
  }
  function rigWires(bonded) {
    const mx = RG.mastX, top = RG.mastTop, foot = roofY(mx, 0), [sp0, sp1] = RG.spreaders, out = [], T = [mx, top, 0];
    const mast = [[mx, ws, 0], [mx, foot, 0], [mx, RG.boom.y, 0], [mx, sp0[0], 0], [mx, sp1[0], 0], T];
    out.push(W(mast[0], mast[1], 'post')); for (let i = 1; i < mast.length - 1; i++) out.push(W(mast[i], mast[i + 1], 'mast'));
    out.push(W([mx, RG.boom.y, 0], [RG.boom.aft, RG.boom.y, 0], 'boom'));
    const ends = [];
    [1, -1].forEach(s => {
      const tips = RG.spreaders.map(([y, l]) => [mx - RG.spreaderSweep*l, y, s*l]);
      out.push(W([mx, sp0[0], 0], tips[0], 'spreader'), W([mx, sp1[0], 0], tips[1], 'spreader'));
      const cp = chainplate(mx, s), fl = chainplate(mx + .62, s), al = chainplate(mx - .62, s);
      out.push(W(T, tips[1], 'stay'), W(tips[1], tips[0], 'stay'), W(tips[0], cp, 'stay'), W([mx, sp1[0], 0], tips[0], 'stay'), W([mx, sp0[0], 0], fl, 'stay'), W([mx, sp0[0], 0], al, 'stay'));
      ends.push(cp, fl, al);
    });
    const stem = [RG.stem[0], RG.stem[1], 0], bt = [RG.backstayTop[0], RG.backstayTop[1], 0], bf = [RG.backstay[0], RG.backstay[1], 0];
    out.push(W(T, stem, 'forestay'), W(T, bt, 'crane'), W(bt, bf, 'backstay'));
    if (bonded) [...ends, stem, bf].forEach(p => out.push(W(p, [p[0], ws, p[2]], 'bond')));
    return out;
  }
  /* The wire for the chosen layout: solver wires, feed point, earth load, and what to draw. */
  function layout() {
    const P = places(), lay = st.layout, Lsel = st.len[lay], wires = rigWires(st.bonded), draw = { wire: [], rod: null, ends: [], halyards: [], tuner: null, balun: null }, info = {};
    if (lay === 'dipole') {
      const d1 = len(sub(P.f0, P.apex)), d2 = len(sub(P.bow, P.apex)), l = +Lsel;
      const aft = along(P.apex, P.f0, Math.min(l, d1)), fore = along(P.apex, P.bow, Math.min(l, d2));
      wires.push(W(P.apex, aft, 'antenna'), W(P.apex, fore, 'antenna'));
      draw.wire.push([aft, P.apex, fore]); draw.ends.push(aft, fore); draw.halyards.push([P.apex, [P.mx + .1, P.top, 0]]); draw.balun = P.apex;
      if (l > d1 - .3) draw.halyards.push([aft, P.f0]); if (l < d2 - .3) draw.halyards.push([fore, P.bow]);
      info.short = l > Math.min(d1, d2); info.total = 2*l;
      return { wires, feed: S(P.apex), loads: [], draw, info, P };
    }
    const lead = [P.f0[0], ws, P.f0[2]];
    wires.push(W(lead, P.f0, 'lead')); draw.tuner = P.f0;
    if (lay === 'sloper') {
      const D = len(sub(P.sTop, P.f0)), L = Lsel === 'fit' ? D : +Lsel;
      if (L <= D + 1e-6) { const e = along(P.f0, P.sTop, L); wires.push(W(P.f0, e, 'antenna')); draw.wire.push([P.f0, e]); draw.ends.push(e); draw.halyards.push([e, [P.mx - .08, P.top, 0]]); }
      else {
        const R = HF.rods.find(r => r.id === st.rod), k = Math.tan(HF.rodRise*Math.PI/180), u0 = [R.dir[0], k, R.dir[1]], un = len(u0), u = u0.map(v => v/un);
        const tipAt = t => P.f0.map((v, i) => v + u[i]*t), tot = t => t + len(sub(P.sTop, tipAt(t)));
        let a = 0, b = L; for (let i = 0; i < 50; i++) { const m = (a + b)/2; if (tot(m) < L) a = m; else b = m; }
        const tip = tipAt(a); info.rod = a;
        wires.push(W(P.f0, tip, 'antenna'), W(tip, P.sTop, 'antenna')); draw.wire.push([P.f0, tip, P.sTop]); draw.rod = [P.f0, tip]; draw.ends.push(P.sTop); draw.halyards.push([P.sTop, [P.mx - .08, P.top, 0]]);
      }
      info.reach = D; info.total = L;
    } else {
      const d1 = len(sub(P.apex, P.f0)), d2 = len(sub(P.bow, P.apex)), fit = d1 + d2, L = Lsel === 'fit' ? fit : Math.min(+Lsel, fit);
      if (L <= d1) { const e = along(P.f0, P.apex, L); wires.push(W(P.f0, e, 'antenna')); draw.wire.push([P.f0, e]); draw.ends.push(e); }
      else { const e = along(P.apex, P.bow, L - d1); wires.push(W(P.f0, P.apex, 'antenna'), W(P.apex, e, 'antenna')); draw.wire.push([P.f0, P.apex, e]); draw.ends.push(e); if (L < fit - .3) draw.halyards.push([e, P.bow]); }
      draw.halyards.push([P.apex, [P.mx + .1, P.top, 0]]); info.reach = fit; info.total = L;
    }
    return { wires, feed: S(P.f0), loads: [[[lead[0], 0, lead[2]], HF.groundOhm]], draw, info, P };
  }

  /* ---------- Matching ---------- */
  const swr = (Z, ratio) => { const zr = Z.re/ratio, zi = Z.im/ratio, nr = zr - 50, d = (zr + 50)**2 + zi*zi, gr = (nr*(zr + 50) + zi*zi)/d, gi = (zi*(zr + 50) - nr*zi)/d, g = Math.min(.9999, Math.hypot(gr, gi)); return (1 + g)/(1 - g); };
  /* L network to 50 Ω, the better of its layouts: loss in dB from the coil and capacitor Q. */
  function tunerLoss(Z) {
    const R = Math.max(Z.re, .01), X = Z.im, R0 = 50, { L: QL, C: QC } = HF.tunerQ; let best = Infinity;
    if (R < R0) for (const sg of [1, -1]) {                             // series part beside the load, shunt part at the radio side
      const Xt = sg*Math.sqrt(R*(R0 - R)), Xs = Xt - X, q = Math.sqrt(R0/R - 1);
      best = Math.min(best, Math.abs(Xs)/(Xs > 0 ? QL : QC)/R + q/(Xt > 0 ? QC : QL));
    }
    const m2 = R*R + X*X, G = R/m2, B = -X/m2;
    if (G < 1/R0) for (const sg of [1, -1]) {                           // shunt part beside the load, series part at the radio side
      const Bt = sg*Math.sqrt(G*(1/R0 - G)), Bp = Bt - B, q = Math.sqrt(1/(R0*G) - 1);
      best = Math.min(best, Math.abs(Bp)/(Bp > 0 ? QC : QL)/G + q/(Bt > 0 ? QL : QC));
    }
    return 10*Math.log10(1 + best);
  }

  /* ---------- Solver in a worker ---------- */
  function workerFn() {
    const M = hfMoMFactory();
    onmessage = e => {
      const { id, wires, segLen, feed, loads, jobs } = e.data, m = M.build(wires, segLen), fb = m.basisAt(feed), ld = {};
      loads.forEach(([p, R]) => { const b = m.basisAt(p); if (b >= 0) ld[b] = R; });
      postMessage({ id, kind: 'model', segs: m.segs.map(s => [s.A, s.B, s.r, wires[s.wire].kind]), N: m.N });
      jobs.forEach((j, i) => {
        const s = M.solve(m, j.f, fb, ld), out = { id, kind: 'job', i, tag: j.tag, f: j.f, Z: s.Z, Pin: s.Pin, loss: s.loss, earth: s.earth };
        if (j.pattern) out.pat = M.pattern(m, s, j.pattern[0], j.pattern[1]);
        if (j.cur) out.cur = s.seg.map(c => Math.hypot((c[0] + c[2])/2, (c[1] + c[3])/2));
        if (j.cur) out.curMax = Math.max(...s.seg.map(c => Math.max(Math.hypot(c[0], c[1]), Math.hypot(c[2], c[3]))));
        postMessage(out);
      });
      postMessage({ id, kind: 'done' });
    };
  }
  function makeWorker() {
    try {
      const src = `const HF = ${JSON.stringify(HF)};\n${hfMoMFactory.toString()}\n(${workerFn.toString()})();`;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), w = new Worker(url); URL.revokeObjectURL(url); return w;
    } catch (e) { return null; }
  }
  let busy = false;
  function start(onlyBand) {          // onlyBand: same wire, another band; the other bands and the sweep are kept
    run++; const id = run, band = HF.bands.find(b => b.id === st.band), jobs = [{ f: band.f, tag: 'main', pattern: [HF.pattern.az, HF.pattern.el], cur: true }];
    if (onlyBand) { res.main = null; }
    else {
      cfg = { L: layout() }; res = { bands: {}, sweep: [] }; segs = null;
      HF.bands.forEach(b => jobs.push({ f: b.f, tag: 'band:' + b.id, pattern: [24, 18] }));
      const n = 48, f0 = 1.75, f1 = 30.5; for (let i = 0; i <= n; i++) jobs.push({ f: f0*Math.pow(f1/f0, i/n), tag: 'sweep' });
    }
    const L = cfg.L;
    const msg = { id, wires: L.wires, segLen: HF.segment, feed: L.feed, loads: L.loads, jobs };
    if (busy && worker) { worker.terminate(); worker = null; }
    if (!worker) { worker = makeWorker(); if (worker) worker.onmessage = e => receive(e.data); }
    busy = true; if (!onlyBand) drawHardware(); render();
    if (worker) worker.postMessage(msg);
    else setTimeout(() => {                                   // no workers: solve on the page, a step at a time
      const M = HFMoM, m = M.build(msg.wires, msg.segLen), fb = m.basisAt(msg.feed), ld = {}; msg.loads.forEach(([p, R]) => { ld[m.basisAt(p)] = R; });
      receive({ id, kind: 'model', segs: m.segs.map(s => [s.A, s.B, s.r, msg.wires[s.wire].kind]) });
      let i = 0; const step = () => {
        if (id !== run || !on) return; if (i >= jobs.length) { receive({ id, kind: 'done' }); return; }
        const j = jobs[i], s = M.solve(m, j.f, fb, ld), out = { id, kind: 'job', i, tag: j.tag, f: j.f, Z: s.Z, Pin: s.Pin, loss: s.loss, earth: s.earth };
        if (j.pattern) out.pat = M.pattern(m, s, j.pattern[0], j.pattern[1]);
        if (j.cur) { out.cur = s.seg.map(c => Math.hypot((c[0] + c[2])/2, (c[1] + c[3])/2)); out.curMax = Math.max(...out.cur); }
        receive(out); i++; setTimeout(step, 0);
      }; step();
    }, 0);
  }
  function receive(d) {
    if (!on || d.id !== run) return;
    if (d.kind === 'model') { segs = d.segs; return; }
    if (d.kind === 'done') { busy = false; render(); return; }
    if (d.tag === 'main') { res.main = d; drawResult(); }
    else if (d.tag.startsWith('band:')) res.bands[d.tag.slice(5)] = d;
    else res.sweep.push(d);
    render();
  }

  /* ---------- 3D ---------- */
  const cmap = t => { const s = [[0, [43, 58, 140]], [.35, [31, 160, 168]], [.6, [123, 209, 72]], [.8, [242, 208, 59]], [1, [224, 64, 42]]]; t = clamp(t, 0, 1); let i = 0; while (i < s.length - 2 && t > s[i + 1][0]) i++; const [a, ca] = s[i], [b, cb] = s[i + 1], f = (t - a)/(b - a); return ca.map((v, k) => (v + (cb[k] - v)*f)/255); };
  const copper = () => M('#b8642a', { roughness: .45, metalness: .6 });
  function clearGroup(name) { const g = group.getObjectByName(name); if (g) { group.remove(g); disposeTree(g); } const n = new T.Group(); n.name = name; group.add(n); return n; }
  function drawHardware() {
    const g = clearGroup('hardware'), d = cfg.L.draw, wireMat = copper(), white = M('#f2f0e8', { roughness: .4 }), rope = M('#3a3d42', { roughness: .9 });
    d.wire.forEach(pl => { for (let i = 0; i < pl.length - 1; i++) rod(g, pl[i], pl[i + 1], .006, wireMat, 6); });
    d.halyards.forEach(([a, b]) => rod(g, a, b, .003, rope, 5));
    d.ends.forEach(p => put(g, new T.SphereGeometry(.03, 12, 8), white).position.set(...p));
    if (d.rod) { rod(g, d.rod[0], d.rod[1], .022, white, 12, .016); }
    if (d.tuner) box(g, [d.tuner[0] + .12, d.tuner[1] + .07, d.tuner[2] - .08], [.26, .14, .18], M('#8d9399', { roughness: .5 }));
    if (d.balun) box(g, [d.balun[0], d.balun[1] - .08, d.balun[2]], [.06, .14, .06], mat.dark);
    A.renderer.shadowMap.needsUpdate = true;
  }
  function drawResult() {
    const r = res.main; if (!r || !segs) return;
    // currents: a tube over every conductor of the model, coloured by current on a 30 dB scale
    const g = clearGroup('currents'), pos = [], col = [], idx = [], max = Math.max(...r.cur), n = 6;
    segs.forEach(([a, b, rad, kind], k) => {
      if (st.show === 'pattern' && kind !== 'antenna') return;
      const c = cmap(1 + 20*Math.log10(Math.max(r.cur[k], 1e-9)/max)/30), A0 = new V3(a[0], a[1] + ws, a[2]), B0 = new V3(b[0], b[1] + ws, b[2]);
      const ax = B0.clone().sub(A0).normalize(), p1 = Math.abs(ax.y) < .9 ? new V3(0, 1, 0) : new V3(1, 0, 0), u = p1.cross(ax).normalize(), v = ax.clone().cross(u);
      const R = kind === 'antenna' ? .022 : kind === 'mast' ? .115 : kind === 'post' || kind === 'lead' || kind === 'bond' ? .03 : kind === 'boom' ? .07 : kind === 'spreader' ? .035 : .014, base = pos.length/3;
      for (const P of [A0, B0]) for (let i = 0; i < n; i++) { const t = i/n*Math.PI*2, o = u.clone().multiplyScalar(Math.cos(t)*R).addScaledVector(v, Math.sin(t)*R); pos.push(P.x + o.x, P.y + o.y, P.z + o.z); col.push(...c); }
      for (let i = 0; i < n; i++) { const j = (i + 1)%n; idx.push(base + i, base + n + i, base + j, base + j, base + n + i, base + n + j); }
    });
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const cm = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .85, side: T.DoubleSide })); cm.renderOrder = 3; g.add(cm);
    // beam pattern: distance from the mast foot at the water grows with gain, floorDb below the strongest direction is the centre
    const pg = clearGroup('pattern'); if (st.show === 'currents') { A.wake(); return; }
    const { g: grid, nAz, nEl, best } = r.pat, Rm = HF.pattern.radius, fl = HF.pattern.floorDb, O = [RG.mastX, ws + .03, 0];
    const rho = v => Rm*Math.max(0, (v - best.G + fl)/fl), P3 = (j, i) => { const el = Math.max(.5, 90*j/nEl)*Math.PI/180, az = i/nAz*2*Math.PI, q = rho(grid[j][i]); return [O[0] + q*Math.cos(el)*Math.cos(az), O[1] + q*Math.sin(el), O[2] + q*Math.cos(el)*Math.sin(az)]; };
    const lp = [], lc = [], li = [];
    for (let j = 0; j <= nEl; j++) for (let i = 0; i <= nAz; i++) { lp.push(...P3(j, i)); lc.push(...cmap((grid[j][i] - best.G + fl)/fl)); }
    for (let j = 0; j < nEl; j++) for (let i = 0; i < nAz; i++) { const a = j*(nAz + 1) + i, b = a + nAz + 1; li.push(a, b, a + 1, a + 1, b, b + 1); }
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); lg.setAttribute('color', new T.Float32BufferAttribute(lc, 3)); lg.setIndex(li);
    const lobe = new T.Mesh(lg, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .32, side: T.DoubleSide, depthWrite: false })); lobe.renderOrder = 5; pg.add(lobe);
    const line = pts => { const l = new T.Line(new T.BufferGeometry().setFromPoints(pts.map(p => new V3(...p))), new T.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .8 })); l.renderOrder = 6; pg.add(l); };
    const jb = Math.round(best.el/90*nEl), ib = Math.round(best.az/360*nAz)%nAz, ib2 = (ib + nAz/2)%nAz;
    line(Array.from({ length: nAz + 1 }, (_, i) => P3(jb, i)));                                                 // round the boat at the best elevation
    line([...Array.from({ length: nEl + 1 }, (_, j) => P3(j, ib)), ...Array.from({ length: nEl + 1 }, (_, j) => P3(nEl - j, ib2))]);   // the vertical cut through the best bearing
    A.wake();
  }

  /* ---------- Panel ---------- */
  const css = document.createElement('style');
  css.textContent = `#hfPanel{position:fixed;left:16px;top:96px;width:352px;max-height:calc(100dvh - 250px);overflow:auto;max-width:calc(100vw - 32px)}#hfPanel[hidden]{display:none}
  @media (max-width:760px){#hfPanel{top:auto;bottom:calc(112px + env(safe-area-inset-bottom,0px));left:8px;right:8px;width:auto;max-height:45dvh}}
  #hfPanel canvas{display:block;width:100%;margin:6px 0 0}.hf-plots{display:grid;grid-template-columns:1fr;gap:8px}.hf-plots figure:last-child canvas{max-width:230px;margin:6px auto 0}#hfPanel .stats dd.bad{color:#a4331f}.hf-plots figure{margin:0}.hf-plots figcaption,.hf-cap{font-size:11.5px;color:var(--ink2);margin:2px 2px 0}
  .hf-key{margin:8px 2px 0;font-size:12px;color:var(--ink2)}.hf-key i{display:block;height:9px;margin:3px 0 2px;border-radius:5px;background:linear-gradient(90deg,#2b3a8c,#1fa0a8 35%,#7bd148 60%,#f2d03b 80%,#e0402a)}.hf-key span{display:flex;justify-content:space-between}
  .hf-table{width:100%;border-collapse:collapse;font-size:12px;margin:2px 0 4px}.hf-table th{text-align:left;font-weight:600;color:var(--ink2);padding:3px 2px;vertical-align:bottom}.hf-table td{padding:4px 2px;border-top:1px solid var(--line);font-variant-numeric:tabular-nums;white-space:nowrap}.hf-table tr.me td{font-weight:700}
  .hf-table td.good{color:#2d7a3a}.hf-table td.bad{color:#a4331f}.hf-busy{font-size:12px;color:var(--ink2);margin:6px 2px 0}`;
  document.head.append(css);
  const panel = document.createElement('details'); panel.className = 'arch'; panel.id = 'hfPanel'; panel.open = true; panel.hidden = true;
  panel.innerHTML = `<summary>HF antenna <span id="hfCurrent"></span></summary><div class="arch-body">
    <fieldset class="pick" id="hfLayout" style="grid-template-columns:1fr"><legend>Layout</legend></fieldset>
    <fieldset class="seg"><legend id="hfLenLegend">Wire length</legend><div class="chips" id="hfLen"></div></fieldset>
    <fieldset class="seg" id="hfRodWrap"><legend>Rod, if the wire is longer than the reach</legend><div id="hfRod"></div></fieldset>
    <fieldset class="seg"><legend>Matching at the feed</legend><div id="hfMatch"></div></fieldset>
    <fieldset class="seg"><legend>Band</legend><div class="chips" id="hfBand"></div></fieldset>
    <fieldset class="seg"><legend>Stays at deck level</legend><div id="hfBond"></div></fieldset>
    <fieldset class="seg"><legend>Show</legend><div id="hfShow"></div></fieldset>
    <div class="hf-key"><i></i><span><b style="font-weight:500">Weak</b><b style="font-weight:500">Pattern: ${HF.pattern.floorDb} dB range · currents: 30 dB</b><b style="font-weight:500">Strong</b></span></div>
    <p class="hf-busy" id="hfBusy"></p>
    <div class="stats" id="hfStats"></div>
    <div class="hf-plots"><figure><canvas id="hfEl" width="320" height="190"></canvas><figcaption id="hfElCap"></figcaption></figure><figure><canvas id="hfAz" width="320" height="320"></canvas><figcaption id="hfAzCap"></figcaption></figure></div>
    <div class="stats"><h2 id="hfSweepTitle">SWR from 1.8 to 30 MHz</h2></div><canvas id="hfSweep" width="660" height="260"></canvas><p class="hf-cap" id="hfSweepCap"></p>
    <div class="stats" id="hfBands"></div>
    <div class="stats" id="hfVhf"></div>
    <p class="fine">Method of moments on thin wires: the antenna wire with the mast, spreaders, stays and boom, all of them connected at the masthead and grounded to the sea through the mast step and the lead keel. The sea is a perfect conductor next to the boat and real sea water for the far-off reflection. Copper and stainless losses are included; the tuner earth is taken as ${HF.groundOhm} Ω. Not modelled: lifelines, pulpit, pushpit, the solar arch, the coax and the sails, all of which shift the figures a little. Treat SWR and gain as estimates, and check with an antenna analyser on board.</p></div>`;
  document.body.append(panel);
  const $ = id => panel.querySelector('#' + id);
  const radios = (id, name, items, get, set) => {
    const box = $(id); box.innerHTML = '';
    items.forEach(([v, label, dis]) => {
      const l = document.createElement('label'), i = document.createElement('input'); i.type = 'radio'; i.name = name; i.value = v; i.checked = String(get()) === String(v); i.disabled = !!dis;
      i.addEventListener('change', () => { set(v); refresh(); }); l.append(i, document.createTextNode(label)); box.append(l);
    });
  };
  function controls() {
    const lay = HF.layouts.find(l => l.id === st.layout), P = places();
    radios('hfLayout', 'hfLayout', HF.layouts.map(l => [l.id, l.name]), () => st.layout, v => { st.layout = v; });
    const reach = st.layout === 'vee' ? len(sub(P.apex, P.f0)) + len(sub(P.bow, P.apex)) : len(sub(P.sTop, P.f0));
    $('hfLenLegend').textContent = st.layout === 'dipole' ? 'Leg length' : 'Wire length';
    radios('hfLen', 'hfLen', lay.lengths.map(([v, label]) => [v, v === 'fit' ? `${label}, ${f1(reach)} m` : label, st.layout === 'vee' && v !== 'fit' && v > reach]), () => st.len[st.layout], v => { st.len[st.layout] = v === 'fit' ? 'fit' : +v; });
    $('hfRodWrap').hidden = st.layout !== 'sloper';
    radios('hfRod', 'hfRod', HF.rods.map(r => [r.id, r.name]), () => st.rod, v => { st.rod = v; });
    if (!lay.matches.includes(st.match[st.layout])) st.match[st.layout] = lay.matches[0];
    radios('hfMatch', 'hfMatch', lay.matches.map(m => [m, HF.matches[m].name]), () => st.match[st.layout], v => { st.match[st.layout] = v; });
    radios('hfBand', 'hfBand', HF.bands.map(b => [b.id, b.name]), () => st.band, v => { st.band = v; });
    radios('hfBond', 'hfBond', [[0, 'Grounded through the mast'], [1, 'Every stay bonded']], () => +st.bonded, v => { st.bonded = !!+v; });
    radios('hfShow', 'hfShow', [['both', 'Pattern and currents'], ['pattern', 'Pattern'], ['currents', 'Currents']], () => st.show, v => { st.show = v; });
  }
  let lastKey = '', lastBand = '';
  function refresh() {
    controls();
    const key = JSON.stringify([st.layout, st.len[st.layout], st.rod, st.bonded]);
    if (key !== lastKey) { lastKey = key; lastBand = st.band; start(false); }
    else if (st.band !== lastBand) { lastBand = st.band; start(!busy); }
    else { drawResult(); render(); }
  }

  const f0n = v => Math.round(v).toLocaleString('en-GB'), f1 = v => v.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const zTxt = Z => `${f0n(Z.re)} ${Z.im < 0 ? '−' : '+'} j${f0n(Math.abs(Z.im))} Ω`;
  const bearingTxt = a => { a = ((a%360) + 360)%360; return a < 22.5 || a >= 337.5 ? 'ahead' : a < 67.5 ? 'starboard bow' : a < 112.5 ? 'starboard beam' : a < 157.5 ? 'starboard quarter' : a < 202.5 ? 'astern' : a < 247.5 ? 'port quarter' : a < 292.5 ? 'port beam' : 'port bow'; };
  const swrTxt = v => v > 50 ? 'over 50' : v.toFixed(v < 10 ? 1 : 0);
  function judge(r) {                    // SWR the radio sees, and the tuner's loss when there is one
    const m = HF.matches[st.match[st.layout]], s = swr(r.Z, m.ratio), tl = m.tuner ? tunerLoss(r.Z) : 0;
    const wire = r.loss/r.Pin, earth = r.earth/r.Pin;
    return { m, s, tl, wire, earth, radioOk: s <= HF.radioTuner, tunerOk: tl < 3 && Math.hypot(r.Z.re, r.Z.im) < 5000 };
  }
  const row = (k, v, c) => `<div><dt>${k}</dt><dd${c ? ` class="${c}"` : ''}>${v}</dd></div>`;
  function render() {
    if (!on) return;
    const band = HF.bands.find(b => b.id === st.band), r = res.main, info = cfg ? cfg.L.info : {}, done = Object.keys(res.bands || {}).length;
    $('hfBusy').textContent = busy ? (r ? `Working through the other bands… ${done}/${HF.bands.length}` : 'Calculating…') : '';
    if (!r) { $('hfStats').innerHTML = ''; $('hfCurrent').textContent = band.name; return; }
    const j = judge(r), dB = v => `${v < .05 ? '0.0' : f1(v)} dB`, lossDb = p => -10*Math.log10(Math.max(1e-6, 1 - p));
    $('hfCurrent').textContent = `${band.name} · ${j.m.tuner ? `tuner loss ${dB(j.tl)}` : `SWR ${swrTxt(j.s)}`}`;
    const b = r.pat.best, low = r.pat.g[Math.round(10/90*r.pat.nEl)], lowAvg = 10*Math.log10(low.slice(0, -1).reduce((a, v) => a + 10**(v/10), 0)/(low.length - 1));
    const up = r.pat.g[r.pat.nEl][0];
    const wireRows = [];
    if (info.total) wireRows.push(row(st.layout === 'dipole' ? 'Wire, both legs' : 'Wire, feed to end', `${f1(info.total)} m`));
    if (info.reach) wireRows.push(row(st.layout === 'vee' ? 'Stern to masthead to bow' : 'Stern corner to masthead', `${f1(info.reach)} m`));
    if (info.rod !== undefined) wireRows.push(row('Rod needed', `${f1(info.rod)} m`, info.rod > HF.rodMax ? 'bad' : ''));
    if (info.short) wireRows.push(row('Legs', 'Cut short: do not fit', 'bad'));
    $('hfStats').innerHTML = `<h2>The wire</h2><dl>${wireRows.join('')}</dl>
      <h2>At the feed, ${band.name} (${band.f.toFixed(3)} MHz)</h2><dl>
      ${row('Impedance', zTxt(r.Z))}
      ${row(j.m.ratio > 1 ? `SWR after the ${j.m.name}` : 'SWR on 50 Ω coax', swrTxt(j.s), !j.m.tuner && j.s > HF.radioTuner ? 'bad' : '')}
      ${j.m.tuner ? row('Autotuner', j.tunerOk ? `matches, loses ${dB(j.tl)}` : `hard to match, about ${dB(j.tl)} lost`, j.tunerOk ? '' : 'bad') : row(`Radio's own tuner (up to ${HF.radioTuner}:1)`, j.radioOk ? 'copes' : 'cannot match', j.radioOk ? '' : 'bad')}
      ${row('Lost in the wire and rig', dB(lossDb(j.wire)))}${j.earth > 1e-4 ? row('Lost in the tuner earth', dB(lossDb(j.earth))) : ''}</dl>
      <h2>Beam</h2><dl>
      ${row('Strongest direction', `${f1(b.G - j.tl)} dBi`)}${row('at elevation', `${f0n(b.el)}°, ${bearingTxt(b.az)}`)}
      ${row('Average at 10° elevation, for long distance', `${f1(lowAvg - j.tl)} dBi`)}${row('Straight up, for nearby stations', `${f1(up - j.tl)} dBi`)}</dl>`;
    plots(r); sweep(); bandTable();
  }

  /* ---------- Plots ---------- */
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#14275f';
  function polar(cv, pts, half, labels) {   // pts: [angle rad (0 = right, ccw), dB rel to max]
    const c = cv.getContext('2d'), Wd = cv.width, H = cv.height, cx = Wd/2, cy = half ? H - 26 : H/2, R = half ? Math.min(Wd/2 - 14, H - 40) : Wd/2 - 22, fl = HF.pattern.floorDb;
    c.clearRect(0, 0, Wd, H); c.lineWidth = 1.2; c.strokeStyle = 'rgba(20,39,95,.18)'; c.fillStyle = cssVar('--ink2'); c.font = '20px system-ui,sans-serif';
    for (const d of [0, 10, 20]) { const rr = R*(fl - d)/fl; c.beginPath(); c.arc(cx, cy, rr, half ? Math.PI : 0, Math.PI*2); c.stroke(); }
    const rays = half ? [0, 30, 60, 90, 120, 150, 180] : [0, 45, 90, 135, 180, 225, 270, 315];
    rays.forEach(a => { const t = a*Math.PI/180; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R*Math.cos(t), cy - R*Math.sin(t)); c.stroke(); });
    c.beginPath(); pts.forEach(([t, d], i) => { const rr = R*Math.max(0, (d + fl)/fl), x = cx + rr*Math.cos(t), y = cy - rr*Math.sin(t); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    if (!half) c.closePath(); c.fillStyle = 'rgba(31,160,168,.22)'; c.fill(); c.strokeStyle = cssVar('--ink'); c.lineWidth = 3; c.stroke();
    c.fillStyle = cssVar('--ink2'); labels.forEach(([txt, x, y, al]) => { c.textAlign = al || 'center'; c.fillText(txt, x, y); });
  }
  function plots(r) {
    const { g, nAz, nEl, best } = r.pat, ib = Math.round(best.az/360*nAz)%nAz, ib2 = (ib + nAz/2)%nAz, el = [];
    for (let j = 0; j <= nEl; j++) el.push([Math.max(.5, 90*j/nEl)*Math.PI/180, g[j][ib] - best.G]);
    for (let j = nEl; j >= 0; j--) el.push([Math.PI - Math.max(.5, 90*j/nEl)*Math.PI/180, g[j][ib2] - best.G]);
    const cv = $('hfEl'); polar(cv, el, true, [[bearingTxt(best.az), cv.width - 4, cv.height - 4, 'right'], [bearingTxt(best.az + 180), 4, cv.height - 4, 'left'], ['up', cv.width/2, 22]]);
    $('hfElCap').textContent = `Side view of the beam, ${bearingTxt(best.az)} to ${bearingTxt(best.az + 180)}. Rings every 10 dB.`;
    const jb = Math.round(best.el/90*nEl), az = [];
    for (let i = 0; i <= nAz; i++) az.push([Math.PI/2 - i/nAz*2*Math.PI, g[jb][i] - best.G]);   // bow up, starboard right
    const ca = $('hfAz'); polar(ca, az, false, [['bow', ca.width/2, 18], ['stern', ca.width/2, ca.height - 4], ['stbd', ca.width - 4, ca.height/2 + 6, 'right'], ['port', 4, ca.height/2 + 6, 'left']]);
    $('hfAzCap').textContent = `From above at ${f0n(best.el)}° elevation, bow up.`;
  }
  function sweep() {
    const cv = $('hfSweep'), c = cv.getContext('2d'), Wd = cv.width, H = cv.height, l = 52, rgt = 10, t = 12, bt = 30, m = HF.matches[st.match[st.layout]];
    const fx = f => l + (Wd - l - rgt)*Math.log(f/1.75)/Math.log(30.5/1.75), sy = s => t + (H - t - bt)*(1 - Math.log(Math.min(s, 100))/Math.log(100));
    c.clearRect(0, 0, Wd, H); c.font = '21px system-ui,sans-serif'; c.lineWidth = 1;
    HF.bands.forEach(b => { c.fillStyle = b.id === st.band ? 'rgba(20,39,95,.22)' : 'rgba(20,39,95,.09)'; const x0 = fx(b.lo), x1 = Math.max(fx(b.hi), x0 + 3); c.fillRect(x0, t, x1 - x0, H - t - bt); c.fillStyle = cssVar('--ink2'); c.textAlign = 'center'; c.fillText(b.id, (x0 + x1)/2, H - 6); });
    [1, 2, 3, 5, 10, 30, 100].forEach(s => { c.strokeStyle = s === HF.radioTuner ? 'rgba(164,51,31,.55)' : 'rgba(20,39,95,.14)'; c.beginPath(); c.moveTo(l, sy(s)); c.lineTo(Wd - rgt, sy(s)); c.stroke(); c.fillStyle = cssVar('--ink2'); c.textAlign = 'right'; c.fillText(s, l - 6, sy(s) + 6); });
    const pts = (res.sweep || []).slice().sort((a, b) => a.f - b.f);
    if (pts.length > 1) { c.beginPath(); pts.forEach((p, i) => { const x = fx(p.f), y = sy(swr(p.Z, m.ratio)); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.strokeStyle = cssVar('--ink'); c.lineWidth = 3; c.stroke(); }
    $('hfSweepTitle').textContent = m.tuner ? 'SWR into 50 Ω at the feed, before the tuner' : `SWR after the ${m.name}`;
    $('hfSweepCap').textContent = m.tuner ? 'Frequency from 1.8 to 30 MHz across, amateur bands shaded and named in metres. An autotuner hides this from the radio; high SWR here means more loss in the tuner. Red line: 3:1.' : `Frequency from 1.8 to 30 MHz across, amateur bands shaded and named in metres. Red line: 3:1, what most radios' own tuners can take. Dips are where the wire resonates.`;
  }
  function bandTable() {
    const m = HF.matches[st.match[st.layout]], rows = HF.bands.map(b => {
      const r = res.bands[b.id]; if (!r) return `<tr><td>${b.name}</td><td colspan="4">…</td></tr>`;
      const j = judge(r), g = r.pat.best, cls = me => b.id === st.band ? ' class="me"' : '';
      const fit = m.tuner ? `<td class="${j.tunerOk ? (j.tl < 1 ? 'good' : '') : 'bad'}">${j.tl < .05 ? '0.0' : f1(j.tl)} dB</td>` : `<td class="${j.s <= 2 ? 'good' : j.s > HF.radioTuner ? 'bad' : ''}">${swrTxt(j.s)}</td>`;
      return `<tr${cls()}><td>${b.name}</td><td>${zTxt(r.Z)}</td>${fit}<td>${f1(g.G - j.tl)} dBi</td><td>${f0n(g.el)}°</td></tr>`;
    }).join('');
    $('hfBands').innerHTML = `<h2>Every band with this wire</h2><table class="hf-table"><thead><tr><th>Band</th><th>Impedance</th><th>${m.tuner ? 'Tuner loss' : 'SWR'}</th><th>Best gain</th><th>Angle</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="fine">Best gain after ${m.tuner ? 'the tuner\'s loss' : 'losses in the wire and rig'}, and the elevation where it points. Low angles reach far; high angles cover the nearest few hundred miles.</p>`;
    const V = RG.vhf, h = RG.mastTop + .05 + V.base + V.length/2 - ws, rng = t => 2.23*(Math.sqrt(h) + Math.sqrt(t));
    $('hfVhf').innerHTML = `<h2>VHF whip at the masthead, ${f1(h)} m above the water</h2><dl>${HF.vhfTargets.map(([k, t]) => row(k, `${f0n(rng(t))} nm`)).join('')}</dl>`;
  }

  /* ---------- On and off ---------- */
  window.hfAntennaLayer = v => {
    A = window.alizee;
    if (v === on) return; on = v; panel.hidden = !on;
    if (on) { group = new T.Group(); group.name = 'hfAntenna'; boat.add(group); lastKey = ''; refresh(); }
    else {
      run++; busy = false; if (worker) { worker.terminate(); worker = null; }
      if (group) { boat.remove(group); disposeTree(group); group = null; } res = {}; segs = null; cfg = null;   // nothing of it stays in memory
      A.renderer.shadowMap.needsUpdate = true; A.wake();
    }
  };
  document.addEventListener('alizee:mode', () => { if (on) window.alizee.setLayer('hf', false); });
  window.hfAntenna = { state: st, layout: () => layout(), swr, tunerLoss };   // for scripted checks
})();
