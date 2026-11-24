/* Radar beam, from the Lowrance Broadband 3G installation guide: the vertical beam reaches 25° above and below
   horizontal, and half the power lies within 12.5° of horizontal (-3 dB width 25°); horizontal beam width 5.2°.
   Shown as two translucent cones around the radome, shaded where the mast and spreaders stand in the beam,
   with the rings where the beam edges reach the water. The radar can be tried at several heights on the mast. */
const RB = SPEC.rig.radarBeam;
G.radarBeam = new T.Group(); G.radarBeam.visible = false; boat.add(G.radarBeam);
const radarState = { pos: RB.positions.find(p => p.current).id };

/* Radome centre in the boat frame, for a mount position. */
function radarCentre(pos) {
  const p = RB.positions.find(q => q.id === pos), y0 = p.plate ?? RADAR.y0;
  return { x: RADAR.domeX, y: y0 + SPEC.rig.radar.height*.5, plate: y0 };
}
function placeRadar(pos) { RADAR.group.position.y = radarCentre(pos).plate; }

/* Share of beam power blocked by the rig, by azimuth and elevation, by casting rays from the antenna. */
function radarShadow(c) {
  boat.updateMatrixWorld(true);
  const near = [], centre = new V3(c.x, c.y, 0).applyMatrix4(boat.matrixWorld), box = new T.Box3(), skip = new Set();
  RADAR.group.traverse(m => skip.add(m));
  [G.mainsail, G.genoa].forEach(g => g && g.traverse(m => skip.add(m)));
  G.rig.traverse(m => { if (!m.isMesh || skip.has(m) || !m.visible) return; box.setFromObject(m); if (box.distanceToPoint(centre) < RB.shadowReach) near.push(m); });
  const ray = new T.Raycaster(); ray.far = RB.shadowReach;
  const az = RB.azSteps, el = RB.elSteps, hit = new Float32Array(az*el), dir = new V3(), q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(boat.matrixWorld));
  for (let i = 0; i < az; i++) for (let j = 0; j < el; j++) {
    const a = i/az*Math.PI*2, e = (-RB.full + 2*RB.full*(j + .5)/el)*Math.PI/180;
    dir.set(Math.cos(e)*Math.cos(a), Math.sin(e), Math.cos(e)*Math.sin(a)).applyQuaternion(q);
    // start just outside the radome so its own skin does not count
    ray.set(centre.clone().addScaledVector(dir, SPEC.rig.radar.diameter/2 + .02), dir);
    hit[i*el + j] = ray.intersectObjects(near, false).length ? 1 : 0;
  }
  // power lost per azimuth, weighted by the vertical beam pattern (Gaussian with the -3 dB points at ±12.5°)
  const sig = RB.main/Math.sqrt(2*Math.log(2)), w = j => Math.exp(-.5*((-RB.full + 2*RB.full*(j + .5)/el)/sig)**2), wSum = Array.from({ length: el }, (_, j) => w(j)).reduce((a, b) => a + b, 0);
  const loss = Array.from({ length: az }, (_, i) => { let s = 0; for (let j = 0; j < el; j++) s += hit[i*el + j]*w(j); return s/wSum; });
  return { hit, loss, az, el };
}

/* Shadow sectors as contiguous azimuth ranges, bearing measured from the bow, clockwise to starboard. */
function shadowSectors(sh) {
  const out = [], n = sh.az, lim = RB.reportLoss, bearing = i => ((i/n*360) + 360)%360;
  let i0 = -1;
  for (let k = 0; k <= n; k++) {
    const on = k < n && sh.loss[k] > lim;
    if (on && i0 < 0) i0 = k;
    if (!on && i0 >= 0) { const seg = sh.loss.slice(i0, k); out.push({ from: bearing(i0), to: bearing(k), width: (k - i0)*360/n, worst: Math.max(...seg) }); i0 = -1; }
  }
  if (out.length > 1 && out[0].from === 0 && out[out.length - 1].to === 360) { const l = out.pop(); out[0] = { from: l.from, to: out[0].to, width: l.width + out[0].width, worst: Math.max(l.worst, out[0].worst) }; }
  return out;
}

function buildRadarBeam() {
  disposeTree(G.radarBeam); G.radarBeam.clear();
  const c = radarCentre(radarState.pos), hw = c.y - SPEC.hull.floatSink, sh = radarShadow(c), R = RB.drawRadius;
  // all round: sheets at 0° and ±12.5° (green) and ±25° (yellow); a sector is left open wherever the rig blocks
  // any part of that band in that direction, so the blocked regions show as gaps
  const water = SPEC.hull.floatSink + .02, r0 = SPEC.rig.radar.diameter/2, na = sh.az;
  const elIdx = d => clamp(Math.round((d + RB.full)/(2*RB.full)*sh.el - .5), 0, sh.el - 1);
  const blockedIn = (i, d0, d1) => { for (let j = elIdx(d0); j <= elIdx(d1); j++) if (sh.hit[i*sh.el + j]) return true; return false; };
  const sheet = (deg, d0, d1, colour, opacity) => {
    const e = deg*Math.PI/180, len = e < 0 ? Math.min(R, (c.y - water)/Math.sin(-e)) : RB.upRadius, nr = 20, pos = [], idx = [];
    const P = (a, r) => [c.x + r*Math.cos(e)*Math.cos(a), Math.max(water, c.y + r*Math.sin(e)), r*Math.cos(e)*Math.sin(a)];
    for (let i = 0; i < na; i++) {
      if (blockedIn(i, d0, d1)) continue;
      const a0 = i/na*Math.PI*2, a1 = (i + 1)/na*Math.PI*2;
      for (let k = 0; k < nr; k++) {
        const ra = r0 + (len - r0)*(k/nr)**1.5, rb = r0 + (len - r0)*((k + 1)/nr)**1.5, b = pos.length/3;
        pos.push(...P(a0, ra), ...P(a1, ra), ...P(a1, rb), ...P(a0, rb)); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: colour, transparent: true, opacity, side: T.DoubleSide, depthWrite: false })); m.renderOrder = 4; G.radarBeam.add(m);
  };
  sheet(0, -RB.main, RB.main, RB.mainColour, .22);
  sheet(RB.main, -RB.main, RB.main, RB.mainColour, .14); sheet(-RB.main, -RB.main, RB.main, RB.mainColour, .14);
  sheet(RB.full, RB.main, RB.full, RB.fullColour, .16); sheet(-RB.full, -RB.full, -RB.main, RB.fullColour, .16);
  // rings on the water where the beam edges reach it
  const ring = (r, colour) => {
    const pts = []; for (let i = 0; i <= 128; i++) { const a = i/128*Math.PI*2; pts.push(new V3(c.x + r*Math.cos(a), SPEC.hull.floatSink + .03, r*Math.sin(a))); }   // on the water surface, in the boat's frame
    const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: colour })); G.radarBeam.add(l);
  };
  const rFull = hw/Math.tan(RB.full*Math.PI/180), rMain = hw/Math.tan(RB.main*Math.PI/180);
  ring(rFull, RB.fullColour); ring(rMain, RB.mainColour);
  return { c, hw, rFull, rMain, sectors: shadowSectors(sh), sh };
}

/* ---------- Panel ---------- */
(function radarPanel() {
  const css = document.createElement('style');
  css.textContent = `#radarPanel{position:fixed;left:16px;top:96px;width:340px;max-height:calc(100dvh - 250px);overflow:auto;max-width:calc(100vw - 32px)}#radarPanel[hidden]{display:none}
  @media (max-width:760px){#radarPanel{top:auto;bottom:calc(112px + env(safe-area-inset-bottom,0px));left:8px;right:8px;width:auto;max-height:45dvh}}
  .tack-table{width:100%;border-collapse:collapse;font-size:12px;margin:2px 0 4px}.tack-table th{text-align:left;font-weight:600;color:var(--ink2);padding:3px 2px;vertical-align:bottom}.tack-table td{padding:4px 2px;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}
  .radar-key{display:flex;gap:12px;margin:8px 2px 0;font-size:12px;color:var(--ink2)}.radar-key i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px}`;
  document.head.append(css);
  const panel = document.createElement('details'); panel.className = 'arch'; panel.id = 'radarPanel'; panel.open = true; panel.hidden = true;
  panel.innerHTML = `<summary>Radar beam <span id="radarCurrent"></span></summary><div class="arch-body">
    <fieldset class="pick" id="radarPick" style="grid-template-columns:1fr"><legend>Radar height on the mast</legend></fieldset>
    <div class="radar-key"><span><i style="background:${RB.fullColour}"></i>Full beam ±${RB.full}°</span><span><i style="background:${RB.mainColour}"></i>Half power ±${RB.main}°</span><span>Gaps: blocked by the rig</span></div>
    <div class="sea-run"><button id="tackPlay">Play a tack</button></div>
    <div class="stats" id="radarStats"></div><div class="stats" id="tackStats"></div>
    <p class="fine">Beam from the Lowrance Broadband 3G installation guide. Shadows are found by tracing the beam past the mast, spreaders and rigging. Ranges use the standard radar horizon, 2.21 × √height in nautical miles.</p></div>`;
  document.body.append(panel);
  RB.positions.forEach(p => {
    const l = document.createElement('label'), i = document.createElement('input'); i.type = 'radio'; i.name = 'radarPos'; i.value = p.id;
    i.addEventListener('change', () => { radarState.pos = p.id; update(); }); l.append(i, document.createTextNode(p.name)); panel.querySelector('#radarPick').append(l);
  });
  const f1 = v => v.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), f0 = v => Math.round(v).toLocaleString('en-GB');
  const side = (a, b) => { const m = ((a + b)/2)%360; return m < 22.5 || m > 337.5 ? 'ahead' : m < 157.5 ? (m < 67.5 ? 'starboard bow' : m < 112.5 ? 'starboard beam' : 'starboard quarter') : m < 202.5 ? 'astern' : m < 247.5 ? 'port quarter' : m < 292.5 ? 'port beam' : 'port bow'; };
  const tackTable = () => {
    const pc = v => `${f0(v*100)} %`, rows = RB.positions.map(p => {
      const r = tackReport(radarCentre(p.id)), me = p.id === radarState.pos ? ' style="font-weight:700"' : '';
      return `<tr${me}><td>${p.name.replace(' (now)', ', now')}</td><td>${r.touches ? `${f1(r.speed)} m/s` : '—'}</td><td>${r.touches ? `${f0(r.wrapDeg)}°` : '—'}</td><td>${r.touches ? `${f0(r.partMin*100)}–${f0(r.partMax*100)} %${r.leech ? ', leech' : ''}` : 'Clear'}</td><td>${r.touches ? pc(r.share) : '—'}</td></tr>`;
    }).join('');
    panel.querySelector('#tackStats').innerHTML = `<h2>Genoa against the radome in a tack</h2>
      <table class="tack-table"><thead><tr><th>Radar height</th><th>Cloth speed</th><th>Bend</th><th>Part of sail, from luff</th><th>Time touching</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="fine">A ${TK.time}-second tack with the ${Math.round(RG.genoa.overlap*100)} % genoa. Lower cloth speed and less bend are gentler; the leech, with its UV strip and leech line, is the roughest part to drag across.</p>`;
  };
  function update() {
    placeRadar(radarState.pos);
    if (tackAnim.playing) tackAnim.start(radarCentre(radarState.pos));
    const r = buildRadarBeam(), hz = t => 2.21*(Math.sqrt(r.hw) + Math.sqrt(t)), row = (k, v, c) => `<div><dt>${k}</dt><dd${c ? ` class="${c}"` : ''}>${v}</dd></div>`;
    panel.querySelector('#radarCurrent').textContent = `${f1(r.hw)} m above water`;
    panel.querySelector(`input[value="${radarState.pos}"]`).checked = true;
    const sec = r.sectors.map(s => row(`${side(s.from, s.to)[0].toUpperCase() + side(s.from, s.to).slice(1)}, ${f0(s.from)}–${f0(s.to)}°`, `${f0(s.width)}° wide, ${f0(s.worst*100)} % lost`)).join('');
    const lost = r.sh.loss.reduce((a, v) => a + v, 0)/r.sh.az;
    panel.querySelector('#radarStats').innerHTML = `<h2>Range to the horizon</h2><dl>
      ${row('Sea-level target', `${f1(hz(0))} nm`)}${row('Small boat, 3 m high', `${f1(hz(3))} nm`)}${row('Ship, 15 m high', `${f1(hz(15))} nm`)}</dl>
      <h2>Close to the boat</h2><dl>
      ${row('Full beam reaches the water at', `${f0(r.rFull)} m`)}${row('Half-power beam reaches the water at', `${f0(r.rMain)} m`)}
      ${row('Shortest range of the radar, from datasheet', `${f0(RB.minRange)} m`)}</dl>
      <h2>Shadows from the rig</h2><dl>${row('Beam power lost all round', `${f1(lost*100)} %`)}${sec || row('Shadow sectors', 'None')}</dl>`;
    tackTable(); A.renderer.shadowMap.needsUpdate = true; A.wake();
  }
  panel.querySelector('#tackPlay').addEventListener('click', e => {
    if (tackAnim.playing) { tackAnim.stop(); e.target.textContent = 'Play a tack'; } else { tackAnim.start(radarCentre(radarState.pos)); e.target.textContent = 'Stop the tack'; }
    A.renderer.shadowMap.needsUpdate = true; A.wake();
  });
  let hooked = false;
  let A = null;
  window.radarBeamLayer = on => {
    A = window.alizee; G.radarBeam.visible = on; panel.hidden = !on;
    if (!hooked) { A.hooks.push(dt => tackAnim.tick(dt)); hooked = true; }
    if (!on && tackAnim.playing) { tackAnim.stop(); panel.querySelector('#tackPlay').textContent = 'Play a tack'; }
    if (on) update(); else { placeRadar(RB.positions.find(p => p.current).id); disposeTree(G.radarBeam); G.radarBeam.clear(); }   // nothing of the beam stays in memory
  };
})();
