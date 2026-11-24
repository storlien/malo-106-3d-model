/* ===== Sea trial, part 4: the viewer =====
   A button in the view bar opens the sea trial. It weighs the boat as she is configured right now (solar arch and
   lifeline panels included), builds her stability, and runs her through the chosen sea while the 3D view follows. */
(function seaTrial() {
  const A = window.alizee, scene = A.scene, NW = SEA.waves.frequencies*SEA.waves.directions;
  const state = { Hs: 2, Tp: 8, heading: 'beam', mode: 'drift', rate: 1, running: true };
  let on = false, S = null, sim = null, stats = null, lastUi = 0, saved = null;

  /* ---------- Sea surface: displaced in the vertex shader from the same wave trains the boat feels ---------- */
  const R = 320, n = 260, geo = new T.PlaneGeometry(2, 2, n, n); geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const f = v => Math.sign(v)*R*Math.pow(Math.abs(v), 2.1); pos.setX(i, f(pos.getX(i))); pos.setZ(i, f(pos.getZ(i))); }
  const uvs = geo.attributes.uv; for (let i = 0; i < pos.count; i++) uvs.setXY(i, pos.getX(i)/(2*R) + .5, -pos.getZ(i)/(2*R) + .5);
  geo.computeBoundingSphere(); geo.boundingSphere.radius = R*1.5;
  const uW = { value: Array.from({ length: NW }, () => new T.Vector4()) }, uOff = { value: L/2 }, uBreak = { value: 0 }, uBreakPos = { value: new T.Vector2() };
  const ripples = A.water.material.normalMap.clone(); ripples.needsUpdate = true; ripples.repeat.set(70, 70); ripples.wrapS = ripples.wrapT = T.RepeatWrapping;   // the calm water's ripples ride on the swell
  const seaMat = new T.MeshStandardMaterial({ color: C('#0b3344'), roughness: .2, metalness: .08, envMapIntensity: 1.0, normalMap: ripples, normalScale: new T.Vector2(.35, .35) });
  seaMat.onBeforeCompile = sh => {
    sh.uniforms.uW = uW; sh.uniforms.uOff = uOff; sh.uniforms.uBreak = uBreak; sh.uniforms.uBreakPos = uBreakPos;
    const fn = `uniform vec4 uW[${NW}]; uniform float uOff; varying float vFoam; varying vec2 vP;
      vec3 seaAt(vec2 p) { float e = 0.0, gx = 0.0, gz = 0.0;
        for (int i = 0; i < ${NW}; i++) { vec4 w = uW[i]; float ph = w.x*p.x + w.y*p.y - w.w; float s = -w.z*sin(ph); e += w.z*cos(ph); gx += s*w.x; gz += s*w.y; }
        return vec3(e, gx, gz); }\n`;
    sh.vertexShader = fn + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `vec3 sw = seaAt(vec2(position.x + uOff, position.z)); vec3 objectNormal = normalize(vec3(-sw.y, 1.0, -sw.z)); vFoam = smoothstep(.26, .5, length(sw.yz)); vP = vec2(position.x + uOff, position.z);`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position); transformed.y += sw.x;');
    sh.fragmentShader = 'varying float vFoam; varying vec2 vP; uniform float uBreak; uniform vec2 uBreakPos;\n' + sh.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n float br = uBreak*smoothstep(11.0, 2.0, length(vP - uBreakPos))*(.75 + .25*sin(vP.x*1.7)*sin(vP.y*2.3));\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.86, .9, .92), clamp(vFoam*.85 + br, 0.0, .95));');
  };
  const sea = new T.Mesh(geo, seaMat); sea.visible = false; sea.receiveShadow = true; sea.frustumCulled = false; scene.add(sea);

  /* ---------- Weigh the boat as configured ---------- */
  function archMasses() {
    const r = typeof archReport === 'function' ? archReport() : null, out = [];
    if (r && r.totalKg) {
      const top = r.panelTopAboveWater + SPEC.hull.floatSink, x = .3 - r.overhang/2;
      out.push({ name: 'Solar arch steel', kg: r.steelKg, y: (top + 1.0)/2, x, len: 0 }, { name: 'Solar arch panels', kg: r.panelKg, y: top, x, len: 0 });
    }
    const q = r && r.lifeline;
    if (q && q.panels) out.push({ name: 'Lifeline panels', kg: q.panels*SPEC.solarArches.panel.kg, y: SEA.sidePanelY, x: 1.2, len: 0 });
    return out;
  }

  function restart() {
    const hd = SEA.headings.find(h => h[0] === state.heading)[2];
    const mode = SEA.modes.find(m => m.id === state.mode);
    sim = SeaMotion.create(S, { Hs: state.Hs, Tp: state.Tp, heading: hd, mode, heelFactor: SEA.heelByHeading[state.heading] });
    if (on) { A.setLayer('sail', mode.sails); A.setLayer('genoa', mode.sails); }
    const b = hd*Math.PI/180; uBreakPos.value.set(S.LCF - Math.cos(b)*4, -Math.sin(b)*4);
    stats = SeaMotion.stats(S); lastUi = 0;
    // let the sea build up gently over the first wave periods
    sim.ramp = 0; render(true);
  }

  /* ---------- Place the boat ---------- */
  const qx = new T.Quaternion(), qz = new T.Quaternion(), X = new T.Vector3(1, 0, 0), Z = new T.Vector3(0, 0, 1), pv = new T.Vector3();
  function placeBoat() {
    const st = sim.st, base = new T.Vector3(-A.centre, -S.d0, 0);
    qz.setFromAxisAngle(Z, st.th); qx.setFromAxisAngle(X, st.ph); boat.quaternion.copy(qz).multiply(qx);
    pv.set(S.LCF, S.yG, 0); const rot = pv.clone().applyQuaternion(boat.quaternion);
    boat.position.copy(base).add(pv).sub(rot); boat.position.y += st.z;
  }
  function pushWaves() {
    const t = sim.st.t, ramp = Math.min(1, t/ (2*state.Tp));
    sim.trains.forEach((q, i) => uW.value[i].set(q[0], q[1], q[2]*ramp, q[3]*t - q[4]));
    sim.ramp = ramp; uBreak.value = sim.breaking;
    ripples.offset.x = (sim.knots*.5144*t/(2*R/70))%1;         // the water streams past at her speed
  }

  A.hooks.push(dt => {
    if (!on) return false;
    if (state.running) {
      const h = 1/120, steps = Math.round(dt*state.rate/h);
      for (let k = 0; k < steps; k++) { sim.step(h); if (sim.st.t > 2*state.Tp) stats.add(sim.st, h); }
    }
    pushWaves(); placeBoat();
    const now = performance.now(); if (now - lastUi > 400) { lastUi = now; render(false); }
    return true;
  });

  /* ---------- Panel ---------- */
  const css = document.createElement('style');
  css.textContent = `#seaPanel[hidden]{display:none}.gz-svg{display:block;width:100%;height:auto;margin:4px 0 2px;border-radius:9px;background:rgba(20,39,95,.05);touch-action:none}
  .gz-axis{stroke:var(--line);stroke-width:1}.gz-zero{stroke:var(--ink2);stroke-width:1}.gz-line{fill:none;stroke:var(--ink);stroke-width:2;stroke-linejoin:round}
  .gz-avs{stroke:#a4331f;stroke-width:1.2;stroke-dasharray:4 3}.gz-t{fill:var(--ink2);font-size:10.5px}.gz-v{fill:#a4331f;font-size:11px;font-weight:700}
  .gz-dot{fill:#b4471f;stroke:var(--panelSolid);stroke-width:2}.gz-cross{stroke:var(--ink2);stroke-width:1}.gz-tip{fill:var(--ink);font-size:11px;font-weight:600}
  .sea-run{display:flex;gap:6px;margin-top:10px}.sea-run button{flex:1;background:rgba(20,39,95,.08);color:var(--ink);border-radius:9px;padding:8px}
  .stats dd.bad{color:#fff;background:#a4331f;padding:0 6px;border-radius:5px}`;
  document.head.append(css);
  const panel = document.createElement('details'); panel.className = 'arch'; panel.id = 'seaPanel'; panel.open = true; panel.hidden = true;
  panel.innerHTML = `<summary>Sea trial <span id="seaCurrent"></span></summary><div class="arch-body">
    <fieldset class="seg"><legend>Significant wave height, metres</legend><div id="seaHs"></div></fieldset>
    <fieldset class="seg"><legend>Peak wave period, seconds</legend><div id="seaTp"></div></fieldset>
    <fieldset class="seg"><legend>Waves from</legend><div id="seaHead"></div></fieldset>
    <fieldset class="seg"><legend>How she is sailed</legend><div id="seaMode"></div></fieldset>
    <fieldset class="seg"><legend>Simulation speed</legend><div id="seaRate"></div></fieldset>
    <div class="sea-run"><button id="seaPause">Pause</button><button id="seaRestart">Start again</button></div>
    <p class="note" id="seaNote"></p><div class="stats" id="seaStats" aria-live="off"></div>
    <p class="fine">An estimate from the model's hull lines, the published displacement and ballast, and standard seakeeping approximations.
    She holds a fixed heading and speed; the wind is a steady heeling moment with gusts, and breaking crests are an empirical blow scaled to tank tests. It is not a stability certificate.</p></div>`;
  document.body.append(panel);
  const radios = (host, name, items, pick) => items.forEach(([v, label]) => {
    const l = document.createElement('label'), i = document.createElement('input'); i.type = 'radio'; i.name = name; i.value = v;
    i.addEventListener('change', () => pick(v)); l.append(i, document.createTextNode(label)); panel.querySelector('#' + host).append(l);
  });
  const set = (k, v) => { state[k] = v; restart(); };
  radios('seaHs', 'seaHs', SEA.heights.map(h => [h, String(h).replace('.', '·')]), v => set('Hs', +v));
  radios('seaTp', 'seaTp', SEA.periods.map(p => [p, String(p)]), v => set('Tp', +v));
  radios('seaHead', 'seaHead', SEA.headings.map(h => [h[0], h[1]]), v => set('heading', v));
  radios('seaMode', 'seaMode', SEA.modes.map(m => [m.id, m.name]), v => set('mode', v));
  radios('seaRate', 'seaRate', [[1, 'Real time'], [4, '4 × faster']], v => { state.rate = +v; });
  panel.querySelector('#seaPause').addEventListener('click', e => { state.running = !state.running; e.target.textContent = state.running ? 'Pause' : 'Run'; });
  panel.querySelector('#seaRestart').addEventListener('click', restart);

  const steep = (Hs, Tp) => Hs/(SEA.g*Tp*Tp/(2*Math.PI)) > SEA.maxSteepness;
  const seaName = h => h < .1 ? 'Calm' : h <= .5 ? 'Smooth to slight' : h <= 1.25 ? 'Slight' : h <= 2.5 ? 'Moderate' : h <= 4 ? 'Rough' : h <= 6 ? 'Very rough' : 'High';
  const f1 = v => v.toLocaleString('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 }), f2 = v => v.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 2 }), f0 = v => Math.round(v).toLocaleString('en-GB');

  function gzChart(heel) {
    const W = 286, H = 150, pl = 30, pr = 14, pt = 12, pb = 22, g = S.gz, ys = g.map(p => p[1]), lo = Math.min(-.2, ...ys), hi = Math.max(...ys)*1.1;
    const X = a => pl + a/180*(W - pl - pr), Y = v => pt + (hi - v)/(hi - lo)*(H - pt - pb);
    const path = g.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('');
    const ticks = [0, 30, 60, 90, 120, 150, 180].map(a => `<text class="gz-t" x="${X(a)}" y="${H - 6}" text-anchor="middle">${a}°</text>`).join('');
    const yt = [0, .5, 1].filter(v => v < hi).map(v => `<text class="gz-t" x="${pl - 4}" y="${Y(v) + 3.5}" text-anchor="end">${v ? f1(v) : '0'}</text>`).join('');
    const h = Math.min(180, Math.abs(heel)), dot = `<circle class="gz-dot" id="gzDot" r="4.5" cx="${X(h)}" cy="${Y(SeaHydro.gzAt(S, h))}"/>`;
    return `<svg class="gz-svg" id="gzSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Righting arm against heel angle. Largest ${f2(S.gzMax[1])} m at ${f0(S.gzMax[0])} degrees, vanishing at ${f0(S.avs)} degrees.">
      <line class="gz-axis" x1="${pl}" y1="${pt}" x2="${pl}" y2="${H - pb}"/><line class="gz-zero" x1="${pl}" y1="${Y(0)}" x2="${W - pr}" y2="${Y(0)}"/>
      <line class="gz-avs" x1="${X(S.avs)}" y1="${pt}" x2="${X(S.avs)}" y2="${H - pb}"/><text class="gz-v" x="${X(S.avs) - 4}" y="${pt + 9}" text-anchor="end">${f0(S.avs)}°</text>
      <path class="gz-line" d="${path}"/>${ticks}${yt}<text class="gz-t" x="${pl + 4}" y="${pt + 1}">GZ, m</text>
      <g id="gzHover" visibility="hidden"><line class="gz-cross" id="gzCross" y1="${pt}" y2="${H - pb}"/><text class="gz-tip" id="gzTip" y="${pt + 22}"></text></g>${dot}</svg>`;
  }
  function hookChart() {
    const svg = panel.querySelector('#gzSvg'); if (!svg) return;
    const W = 286, pl = 30, pr = 14, hov = svg.querySelector('#gzHover');
    const move = e => {
      const r = svg.getBoundingClientRect(), x = (e.clientX - r.left)/r.width*W, a = clamp((x - pl)/(W - pl - pr)*180, 0, 180), px = pl + a/180*(W - pl - pr);
      svg.querySelector('#gzCross').setAttribute('x1', px); svg.querySelector('#gzCross').setAttribute('x2', px);
      const tip = svg.querySelector('#gzTip'); tip.textContent = `${f0(a)}°: ${f2(SeaHydro.gzAt(S, a))} m`; tip.setAttribute('x', a > 120 ? px - 6 : px + 6); tip.setAttribute('text-anchor', a > 120 ? 'end' : 'start');
      hov.setAttribute('visibility', 'visible');
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerleave', () => hov.setAttribute('visibility', 'hidden'));
  }

  function render(full) {
    if (!S) return;
    const r = stats.report(), deg = sim.st.ph*180/Math.PI, P = SEA.published;
    if (!full) {                                         // live numbers only, so the chart keeps its hover
      const dot = panel.querySelector("#gzDot"), W = 286, pl = 30, pr = 14;
      if (dot) { const h = Math.min(180, Math.abs(deg)), g = S.gz, ys = g.map(p => p[1]), lo = Math.min(-.2, ...ys), hi = Math.max(...ys)*1.1; dot.setAttribute('cx', pl + h/180*(W - pl - pr)); dot.setAttribute('cy', 12 + (hi - SeaHydro.gzAt(S, h))/(hi - lo)*(150 - 34)); }
      panel.querySelector('#seaLive').innerHTML = live(r, deg); return;
    }
    const arch = S.W.list.filter(q => /Solar|Lifeline/.test(q.name)).reduce((a, q) => a + q.kg, 0);
    const hd = SEA.headings.find(h => h[0] === state.heading);
    panel.querySelector('#seaCurrent').textContent = `Hs ${state.Hs} m, ${state.Tp} s, ${hd[1].toLowerCase()}`;
    const md = SEA.modes.find(m => m.id === state.mode);
    const lmax = 1.86*state.Hs, steepness = state.Hs/(SEA.g*state.Tp*state.Tp/(2*Math.PI));
    panel.querySelector('#seaNote').textContent = `${seaName(state.Hs)} sea${steepness > 1/16 ? ', steep enough for crests to break' : ''}. The largest wave in three hours is likely to be about ${f1(lmax)} m. ` +
      (md.heel ? `${md.name} at ${md.knots} knots, heeled about ${f0(md.heel*SEA.heelByHeading[state.heading])}° away from the waves by the wind. ` : 'Bare poles, lying to the sea. ') +
      `Breaking crests hit her harder the more they come from the beam; one of 55 % of her length (${f1(.55*L)} m) beam-on capsized most yachts in the 1979 Fastnet tank tests.`;
    const row = (k, v, c) => `<div><dt>${k}</dt><dd${c ? ` class="${c}"` : ''}>${v}</dd></div>`;
    panel.querySelector('#seaStats').innerHTML = `
      <h2>Stability of the boat as configured</h2>${gzChart(deg)}<dl>
      ${row('Weight in the trial', `${f0(S.m)} kg`)}${row('Of which solar arch and panels', arch ? `${f0(arch)} kg` : 'None')}
      ${row('Centre of gravity above waterline', `${f2(S.yG - S.d0)} m`)}${row('Metacentric height, GM', `${f2(S.GM)} m`)}
      ${row('Largest righting arm', `${f2(S.gzMax[1])} m at ${f0(S.gzMax[0])}°`)}${row('Angle of vanishing stability', `${f0(S.avs)}°`)}
      ${row('Stability ratio, positive to negative area', isFinite(S.ratio) ? f1(S.ratio) : '—')}
      ${row('Roll period', `${f1(S.Troll)} s`)}${row('Pitch period', `${f1(S.Tpitch)} s`)}${row('Heave period', `${f1(S.Theave)} s`)}
      ${row('Capsize screening (published 1.76)', f2(S.capsize))}${row(`Comfort ratio (published ${f1(P.comfort[0])}–${f1(P.comfort[1])})`, f1(S.comfort))}
      ${row('Immersion (published 188)', `${f0(S.immersion)} kg/cm`)}</dl><div id="seaLive">${live(r, deg)}</div>`;
    hookChart();
    const pick = (name, v) => { const el = panel.querySelector(`input[name="${name}"][value="${v}"]`); if (el) el.checked = true; };
    pick('seaHs', state.Hs); pick('seaTp', state.Tp); pick('seaHead', state.heading); pick('seaMode', state.mode); pick('seaRate', state.rate);
    SEA.periods.forEach(p => { const el = panel.querySelector(`input[name="seaTp"][value="${p}"]`); if (el) el.disabled = steep(state.Hs, p); });
    SEA.heights.forEach(h => { const el = panel.querySelector(`input[name="seaHs"][value="${h}"]`); if (el) el.disabled = steep(h, state.Tp); });
  }
  function live(r, deg) {
    const row = (k, v, c) => `<div><dt>${k}</dt><dd${c ? ` class="${c}"` : ''}>${v}</dd></div>`;
    const warm = sim.st.t < 2*state.Tp, ev = sim.events, md = SEA.modes.find(m => m.id === state.mode);
    const clock = t => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2, '0')}`;
    const log = ev.slice(-5).reverse().map(v => `<div><dt>${clock(v.t)} breaking crest ${f1(v.H)} m</dt><dd${v.maxHeel > S.avs ? ' class="bad"' : v.maxHeel > 90 ? ' class="warn"' : ''}>to ${f0(v.maxHeel)}°</dd></div>`).join('');
    return `<h2>In this sea${warm ? ', the sea is building' : `, after ${clock(r.t)}`}</h2><dl>
      ${row('Heel now', `${f0(deg)}°`, r.capsized ? 'bad' : '')}${md.heel ? row('Average heel from the wind', `${f0(Math.abs(r.heelMean))}°`) : ''}
      ${row('Roll either side of that, significant', `± ${f0(r.rollSig)}°`)}${row('Largest heel', `${f0(r.rollMax)}°`, r.rollMax > S.avs ? 'bad' : r.rollMax > 60 ? 'warn' : '')}
      ${row('Pitch, significant', `± ${f1(r.pitchSig)}°`)}${row('Pitch, largest', `${f1(r.pitchMax)}°`)}
      ${row('Heave, significant height', `${f2(r.heaveSig)} m`)}
      ${row('Vertical acceleration at the helm, RMS', `${f2(r.accRms)} g`)}${row('Largest sideways push at the helm', `${f2(r.latMax)} g`)}
      ${row('Largest sideways acceleration at the masthead', `${f2(r.mastLatMax)} g`)}
      ${row('Breaking crests that hit her', f0(ev.length), ev.length ? 'warn' : '')}
      ${row('Heeled past 60°', f0(r.k60), r.k60 ? 'warn' : '')}${row('Knockdowns, mast in the water (past 90°)', f0(r.knock), r.knock ? 'warn' : '')}
      ${row('Capsizes, past the vanishing angle', f0(r.capsizes), r.capsizes ? 'bad' : '')}
      ${row('Seasick after 2 hours (MSI)', `${f0(r.msi)} %`)}</dl>${log ? `<h2>Breaking crests, latest first</h2><dl>${log}</dl>` : ''}`;
  }

  /* ---------- Turning the trial on and off ---------- */
  function enter() {
    S = SeaHydro.analyse(archMasses()); on = true;
    const pressed = n => document.querySelector(`[data-layer="${n}"]`).getAttribute('aria-pressed') === 'true';
    saved = { water: A.water.visible, ground: A.ground.visible, pos: boat.position.clone(), quat: boat.quaternion.clone(), sail: pressed('sail'), genoa: pressed('genoa') };
    A.water.visible = false; A.ground.visible = false; sea.visible = true;
    document.getElementById('archPanel').hidden = true; panel.hidden = false;
    A.renderer.shadowMap.autoUpdate = true;
    restart(); Object.assign(A.view, { th: .95, ph: 1.3, r: 24, tx: 0, ty: 2.2, tz: 0, ortho: false }); A.wake();
  }
  function leave() {
    on = false; sea.visible = false; A.water.visible = saved.water; A.ground.visible = saved.ground;
    boat.position.copy(saved.pos); boat.quaternion.copy(saved.quat); A.setLayer('sail', saved.sail); A.setLayer('genoa', saved.genoa);
    document.getElementById('archPanel').hidden = false; panel.hidden = true;
    A.renderer.shadowMap.autoUpdate = false; A.renderer.shadowMap.needsUpdate = true; A.wake();
  }
  const btn = document.createElement('button'); btn.textContent = 'Sea trial'; btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => { const v = !on; btn.setAttribute('aria-pressed', v); v ? enter() : leave(); });
  const bar = document.querySelector('.bar'), grp = document.createElement('div'); grp.className = 'group'; grp.setAttribute('role', 'group'); grp.setAttribute('aria-label', 'Sea trial'); grp.append(btn); bar.append(grp);

  A.sea = { enter, leave, set(o) { Object.assign(state, o); if (on) restart(); }, analyse: () => SeaHydro.analyse(archMasses()), get S() { return S; }, get sim() { return sim; }, report: () => stats && stats.report() };
})();
