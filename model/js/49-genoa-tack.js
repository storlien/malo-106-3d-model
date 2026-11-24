/* The genoa tacking past the mast and radome. Each horizontal slice of the sail swings about the forestay from
   one side to the other; where it meets the radome or the mast it wraps around them and slides across.
   This gives an animation and, for each radar height, how hard the sail works the radome during a tack. */
const TK = RG.genoa.tack;
G.tackSail = new T.Group(); G.tackSail.visible = false; G.rig.add(G.tackSail);

const tackSlices = (() => {
  const yAt = v => GENOA.pt(0, v)[1], n = TK.slices;
  return Array.from({ length: n + 1 }, (_, j) => {
    const v = j/n, P = GENOA.pt(0, v), Q = GENOA.pt(1, v), c = GENOA.chord(v)*TK.clothFactor;
    return { v, P, Q, c, theta0: Math.atan2(Math.abs(Q[2]) + .15, c) };          // sheeted angle off the centreline
  });
})();

/* Obstacles in plan at height y: circles [x, radius, name]. */
function tackObstacles(y, radar) {
  const out = [];
  if (y >= radar.plate && y <= radar.plate + SPEC.rig.radar.height) out.push([RADAR.domeX, SPEC.rig.radar.diameter/2, 'radar']);
  if (y < RG.mastTop) out.push([RG.mastX, RG.mastSize[0]/2, 'mast']);
  return out;
}

/* Path of one slice of cloth in plan, from the luff at angle theta (+ = starboard), wrapping round obstacles.
   Returns points [x, z, s] along the cloth and any contacts { name, wrap (rad), at (m from the luff) }. */
function clothPath(P, c, theta, y, radar, side) {
  const pts = [[P[0], 0, 0]], contacts = [], obs = tackObstacles(y, radar).sort((a, b) => b[0] - a[0]);
  let x = P[0], z = 0, s = 0, h = Math.PI - theta;                                // heading angle in the (x, z) plane; π = straight aft
  const step = (len, hh) => { const L = Math.min(len, c - s); x += Math.cos(hh)*L; z += Math.sin(hh)*L; s += L; pts.push([x, z, s]); };
  obs.forEach(([cx, r, name]) => {
    if (s >= c) return;
    const wx = cx - x, wz = -z, D = Math.hypot(wx, wz); if (D <= r + 1e-3) return;
    const along = wx*Math.cos(h) + wz*Math.sin(h), off = wx*Math.sin(h) - wz*Math.cos(h);
    if (along <= 0 || Math.abs(off) >= r) return;                                  // the straight cloth misses it
    const psi = Math.atan2(wz, wx); let ht = psi - side*Math.asin(r/D); while (ht - h > Math.PI) ht -= 2*Math.PI; while (h - ht > Math.PI) ht += 2*Math.PI;
    const wrap = Math.abs(ht - h);
    step(Math.sqrt(D*D - r*r), ht);
    contacts.push({ name, wrap, at: s });
    const k = Math.max(2, Math.ceil(wrap/.12)); for (let i = 1; i <= k; i++) step(r*wrap/k, ht + (h - ht)*i/k);
  });
  if (s < c) step(c - s, h);
  return { pts, contacts };
}

/* How a radar height fares over one tack. */
function tackReport(radar) {
  const T0 = TK.time, steps = 80; let touch = 0, total = 0, speed = 0, wrap = 0, partMin = 1, partMax = 0, leech = false;
  tackSlices.forEach(sl => {
    const yC = sl.P[1] + (sl.Q[1] - sl.P[1])*.5;
    if (yC < radar.plate - .6 || yC > radar.plate + .9) return;
    for (let i = 0; i <= steps; i++) {
      const f = i/steps, th = sl.theta0*Math.cos(Math.PI*f), w = sl.theta0*Math.PI/T0*Math.sin(Math.PI*f), side = th >= 0 ? 1 : -1;
      const yAt = s => lerp(sl.P[1], sl.Q[1], s/sl.c), path = clothPath(sl.P, sl.c, th, sl.P[1], radar, side);
      // re-test against the radome with the cloth's height where it would reach it
      const dR = sl.P[0] - RADAR.domeX, yR = yAt(dR);
      const p2 = clothPath(sl.P, sl.c, th, yR, radar, side), hit = p2.contacts.find(q => q.name === 'radar');
      total++;
      if (!hit) continue;
      touch++; speed = Math.max(speed, w*hit.at); wrap = Math.max(wrap, hit.wrap);
      partMin = Math.min(partMin, hit.at/sl.c); partMax = Math.max(partMax, hit.at/sl.c);
      if (sl.c - hit.at < TK.leechNear) leech = true;
    }
  });
  return { touches: touch > 0, share: total ? touch/total : 0, speed, wrapDeg: wrap*180/Math.PI, partMin, partMax, leech };
}

/* ---------- Animation ---------- */
const tackAnim = (() => {
  const nu = 30, mat2 = new T.MeshStandardMaterial({ color: C('#eeeee8'), roughness: .8, side: T.DoubleSide }), nv = tackSlices.length;
  const geo = new T.BufferGeometry(), pos = new Float32Array(nv*(nu + 1)*3), idx = [];
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu; i++) { const a = j*(nu + 1) + i, b = a + nu + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setIndex(idx);
  const mesh = new T.Mesh(geo, mat2); mesh.castShadow = true; G.tackSail.add(mesh);
  let t = 0, radar = null, playing = false;
  const frame = () => {
    const ph = (t % (2*TK.time + 2*TK.pause))/TK.time, q0 = clamp(ph, 0, 1), q1 = clamp(ph - 1 - TK.pause/TK.time, 0, 1), back = ph > 1 + TK.pause/TK.time;   // over, pause, and back
    tackSlices.forEach((sl, j) => {
      const th = back ? -sl.theta0*Math.cos(Math.PI*q1) : sl.theta0*Math.cos(Math.PI*q0), side = th >= 0 ? 1 : -1;
      const dR = sl.P[0] - RADAR.domeX, yR = lerp(sl.P[1], sl.Q[1], clamp(dR/sl.c, 0, 1));
      const path = clothPath(sl.P, sl.c, th, yR, radar, side).pts;
      for (let i = 0; i <= nu; i++) {
        const s = sl.c*i/nu; let k = 1; while (k < path.length - 1 && path[k][2] < s) k++;
        const a = path[k - 1], b = path[k], q = b[2] > a[2] ? (s - a[2])/(b[2] - a[2]) : 0, o = (j*(nu + 1) + i)*3;
        pos[o] = lerp(a[0], b[0], q); pos[o + 1] = lerp(sl.P[1], sl.Q[1], i/nu) - RG.genoa.footRound*Math.sin(Math.PI*i/nu)*Math.pow(1 - sl.v, 8); pos[o + 2] = lerp(a[1], b[1], q);
      }
    });
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
  };
  return {
    start(r) { radar = r; playing = true; t = 0; G.tackSail.visible = true; G.genoa.visible = false; G.furledGenoa.visible = false; frame(); },
    stop() { playing = false; G.tackSail.visible = false; const on = document.querySelector('[data-layer="genoa"]').getAttribute('aria-pressed') === 'true'; G.genoa.visible = on; G.furledGenoa.visible = !on; },
    tick(dt) { if (!playing) return false; t += dt; frame(); return true; },
    get playing() { return playing; },
  };
})();
