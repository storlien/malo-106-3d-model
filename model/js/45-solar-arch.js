/* Solar arch designs. Each entry in SPEC.solarArches.designs is built from the same parts,
   and its measurements are taken from the finished geometry rather than from the inputs. */
const AC = SPEC.solarArches;
mat.cell = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), n = 8, s = 512/n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 22 + ((i*7 + j*3)%5);
    g.fillStyle = `rgb(${v},${v + 8},${v + 34})`; g.fillRect(i*s + 1, j*s + 1, s - 2, s - 2);
    g.fillStyle = '#d7dde2'; for (let b = 1; b <= 3; b++) g.fillRect(i*s + 1, j*s + b*s/4 - .6, s - 2, 1.2);
  }
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 16;
  return M('#ffffff', { map: t, roughness: .14, metalness: .25, envMapIntensity: 1.1 });
})();

/* Panel positions as [forward x, aft x, port z, starboard z].
   'across': long side across the boat. 'fore': long side fore-and-aft, panels side by side. */
function panelLayout(d, count, orient) {
  const { length: P, width: W } = AC.panel, g = AC.panelGap, slot = AC.backstaySlot;
  const pair = (x, h) => [[x, x - W, -h - P, -h], [x, x - W, h, h + P]];
  if (orient === 'fore') {
    const strip = (f, z0) => [f, f - P, z0, z0 + W], mirror = (f, z0) => [strip(f, z0), [f, f - P, -z0 - W, -z0]];
    if (d.layout === 'split') {
      const f = d.fwdXFore;
      if (count === 2) return mirror(f, slot);
      if (count === 3) return [strip(d.centreX, -W/2), ...mirror(f, W/2 + g)];     // the middle panel sits aft of the backstay
      return [...mirror(f, slot), ...mirror(f, slot + W + g)];
    }
    const total = count*W + (count - 1)*g;
    return Array.from({ length: count }, (_, i) => strip(d.fwdX, -total/2 + i*(W + g)));
  }
  const f = typeof d.fwdX === 'number' ? d.fwdX : d.fwdX[count], row2 = f - W - g;
  if (d.layout === 'split') {
    const first = pair(f, slot);
    if (count === 2) return first;
    return count === 3 ? [...first, [row2, row2 - W, -P/2, P/2]] : [...first, ...pair(row2, g/2)];
  }
  if (count === 2) return pair(f, g/2);
  return count === 3 ? [...pair(f, g/2), [row2, row2 - W, -P/2, P/2]] : [...pair(f, g/2), ...pair(row2, g/2)];
}

function buildArch(d, count, D, orient, rearAngle = 0, heightId = 'current', foreAngle = 0) {
  const group = new T.Group(), frame = new T.Group(), extras = new T.Group();
  group.add(frame, extras); group.visible = false; G.arch.add(group);
  let steelKg = 0, steelM = 0, rear = null, fore = null, foreLength = 0;
  const kgPerM = Math.PI*(D - AC.pipeWall)*AC.pipeWall*7980;
  const pipe = (pts, seg = 12) => {
    for (let i = 0; i < pts.length - 1; i++) steelM += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
    return pts.length === 2 ? rod(frame, pts[0], pts[1], D/2, mat.steel, seg) : tube(frame, pts, D/2, mat.steel, false, seg);
  };
  const footPlate = p => {
    const plate = put(frame, new T.CylinderGeometry(.062, .068, .012, 22), mat.steel); plate.position.set(p[0], p[1] + .006, p[2]);
    const socket = put(frame, new T.CylinderGeometry(D/2 + .006, D/2 + .009, .06, 18), mat.steel); socket.position.set(p[0], p[1] + .035, p[2]);
  };

  // main hoop, or two straight fore pipes on the 'straight' designs
  const A = d.aftStrut, straight = !!A.straight, rawPanels = panelLayout(d, count, orient);
  const depth = Math.max(...rawPanels.map(q => q[0])) - Math.min(...rawPanels.map(q => q[1]));
  let H = d.hoop, shift = 0;
  if (straight) {
    // at a set rear angle the panels sit flush with the aft end of the frame, and the fore pipes follow them aft
    const opt = AC.archHeights.find(q => q.id === heightId), footAt = transomX(A.footY, A.footHalf) - A.standoff;
    let topY = (opt && opt.y) || d.hoop.topY, foreX = d.hoop.topX;
    if (rearAngle) {
      const tanR = Math.tan(rearAngle*Math.PI/180);
      if (heightId === 'fit') topY = Math.max(AC.minFitY, A.footY + (footAt - (AC.foreLimitX - depth))*tanR - D);
      const frameAft = footAt - (topY + D - A.footY)/tanR;
      foreX = clamp(frameAft + depth, AC.foreLimitX, d.hoop.topX);
      shift = frameAft - Math.min(...rawPanels.map(q => q[1]));
    } else {                                            // a lower frame meets the sloping backstay further aft
      const R = SPEC.rig, stayX = R.backstay[0] + (topY + D - R.backstay[1])*(R.backstayTop[0] - R.backstay[0])/(R.backstayTop[1] - R.backstay[1]);
      foreX = Math.min(foreX, stayX - .075); shift = foreX - d.hoop.topX;
    }
    H = Object.assign({}, d.hoop, { topX: foreX, topY });
  }
  const fy = deckY(H.footX, H.footHalf), yS = H.topY - H.bend;
  const onHoop = y => lerp(H.footX, H.topX, (y - fy)/(H.topY - fy));
  const side = s => {
    const pts = [[H.footX, fy, s*H.footHalf]];
    for (let i = 1; i <= 5; i++) { const f = i/5, y = lerp(fy, yS, f); pts.push([onHoop(y), y, s*lerp(H.footHalf, H.half, f)]); }
    for (let i = 1; i <= 8; i++) { const a = i/8*Math.PI/2, y = yS + H.bend*Math.sin(a); pts.push([onHoop(y), y, s*(H.half - H.bend + H.bend*Math.cos(a))]); }
    return pts;
  };
  const foreStraight = !!d.foreStraight;
  if (!straight && !foreStraight) pipe([...side(-1), [H.topX, H.topY, 0], ...side(1).reverse()], 14);
  const hoopYAt = z => { const o = Math.abs(z) - (H.half - H.bend); return o <= 0 ? H.topY : yS + Math.sqrt(Math.max(0, H.bend*H.bend - o*o)); };

  // carrier rails rest on the hoop and run under the panel edges, closed by two cross tubes
  const panels = rawPanels.map(q => [q[0] + shift, q[1] + shift, q[2], q[3]]), yRail = H.topY + D, panelY = yRail + D/2 + AC.panel.thick/2;
  const fwd = Math.max(...panels.map(q => q[0])), aft = Math.min(...panels.map(q => q[1]));
  const halfW = Math.max(...panels.flatMap(q => [Math.abs(q[2]), Math.abs(q[3])]));
  const frameHalf = straight ? Math.max(halfW, A.footHalf) : foreStraight ? Math.max(halfW, H.half) : d.foreStrut ? Math.max(halfW, H.half) : halfW,   // fore struts must land outside the bimini
     footX = transomX(A.footY, A.footHalf) - A.standoff;
  // a chosen rear angle fixes where the pipe reaches the frame; the frame extends aft to meet it
  const strutTop = straight && rearAngle ? footX - (yRail - A.footY)/Math.tan(rearAngle*Math.PI/180) : Math.min(aft, -.04);
  const railFwd = Math.max(fwd, straight || foreStraight ? H.topX : H.topX + .01), railAft = Math.min(aft, strutTop);
  // each rail runs under the panels it carries; the outer pair also ties the hoop to the struts
  const rails = [];
  panels.forEach(([f, a, z0, z1]) => [z0, z1].forEach(z => {
    const r = rails.find(q => Math.abs(q.z - z) < .06);
    if (r) { r.z = (r.z*r.n + z)/(r.n + 1); r.n++; r.f = Math.max(r.f, f); r.a = Math.min(r.a, a); } else rails.push({ z, n: 1, f, a });
  }));
  if (straight || foreStraight) [1, -1].forEach(k => {                // side rails directly above the fore (and rear) pipes
    const z = k*(straight ? A.footHalf : H.half), r = rails.find(q => Math.abs(q.z - z) < .06);
    if (r) r.frame = true; else rails.push({ z, n: 1, f: railFwd, a: railAft, frame: true });
  });
  rails.forEach(r => {
    const outer = r.frame || Math.abs(Math.abs(r.z) - halfW) < .001, f = outer ? railFwd : r.f, a = outer ? railAft : r.a;
    pipe([[f, yRail, r.z], [a, yRail, r.z]]);
    if (!straight && H.topX <= f && H.topX >= a && Math.abs(r.z) <= H.half) { const y = hoopYAt(r.z); pipe([[onHoop(y), y, r.z], [H.topX, yRail, r.z]], 10); }  // saddle on the hoop
  });
  // panels wider than the hoop get a third cross tube resting on it
  // straight fore pipes lean aft from the toe rail to the frame at the chosen angle
  const foreFoot = (() => {
    if (!foreStraight) return null;
    const tanF = Math.tan((foreAngle || 90)*Math.PI/180), capEnd = SPEC.deck.toeRail.sternCapTo - .075, run = x => (yRail - deckY(x, H.footHalf))/tanF;
    let x = H.footX; for (let k = 0; k < 6; k++) x = H.topX + run(x);
    if (x > capEnd && x < capEnd + .15) x = capEnd;                 // keep the foot plate wholly on the wide toe rail, clear of the step down
    return { x, topX: x - run(x) };
  })();
  const crossAt = straight ? [railFwd, railAft, strutTop] : foreStraight ? [railFwd, railAft, foreFoot.topX] : [railFwd, railAft, ...(halfW > H.half - .02 ? [H.topX] : [])];
  crossAt.filter((x, i, l) => l.findIndex(q => Math.abs(q - x) < 1e-6) === i).forEach(x => pipe([[x, yRail, -frameHalf], [x, yRail, frameHalf]]));

  [1, -1].forEach(s => {
    // aft strut stands off the transom, outside the pushpit
    // a 'straight' rear pipe stays in one fore-and-aft plane and lands on the aft cross tube
    const tz = s*A.footHalf, tx = transomX(A.footY, tz), f = [tx - A.standoff, A.footY, tz];
    const strutEnd = [strutTop, yRail, A.straight ? tz : s*halfW];
    pipe([f, strutEnd]);
    if (s === 1) rear = { foot: f, top: strutEnd };
    pipe([[tx, A.footY, tz], f], 10);
    const plate = put(frame, new T.CylinderGeometry(.055, .055, .01, 22), mat.steel); plate.rotation.z = Math.PI/2; plate.position.set(tx - .004, A.footY, tz);
    if (straight) {
      const onRail = H.topX < HS.transomCurve*tz*tz + SPEC.cockpit.aftRail, base = [H.topX, onRail ? PP.railTop : deckY(H.topX, tz), tz];
      pipe([base, [H.topX, yRail, tz]]); footPlate(base); foreLength = yRail - base[1];
    } else if (foreStraight) {
      // straight fore pipe from the toe rail up to the frame, leaning aft at the chosen angle to the frame
      const base = [foreFoot.x, deckY(foreFoot.x, s*H.footHalf), s*H.footHalf], top = [foreFoot.topX, yRail, s*H.half];
      pipe([base, top]); footPlate(base);
      if (s === 1) { fore = { foot: base, top }; foreLength = Math.hypot(top[0] - base[0], top[1] - base[1], top[2] - base[2]); }
    } else footPlate([H.footX, fy, s*H.footHalf]);
    if (d.foreStrut) {
      const q = d.foreStrut, b = [q.footX, deckY(q.footX, q.footHalf), s*q.footHalf];
      pipe([b, [railFwd, yRail, s*Math.min(frameHalf, H.half)]]); footPlate(b);   // stays inboard of the lifelines
    }
  });
  steelKg = steelM*kgPerM;

  // panels in anodised aluminium frames
  panels.forEach(([f, a, z0, z1]) => {
    const len = f - a, w = z1 - z0, xc = (f + a)/2, zc = (z0 + z1)/2;
    box(frame, [xc, panelY, zc], [len, AC.panel.thick, w], mat.alu);
    const face = put(frame, new T.PlaneGeometry(len - .03, w - .03), mat.cell, false);
    face.rotation.x = -Math.PI/2; face.position.set(xc, panelY + AC.panel.thick/2 + .001, zc);
  });

  // ensign under the panels, antenna on the forward port corner
  ensign(extras, AC.ensign.base, AC.ensign.tip);
  const az = -frameHalf - .04;
  rod(extras, [railFwd, yRail, -frameHalf], [railFwd, yRail, az], .012, mat.steel);
  antenna(extras, [railFwd, yRail, az], [railFwd, yRail + .42, az]);
  return { d, group, frame, count, D, rear, fore, foreLength, foreX: H.topX, uncovered: Math.max(0, railFwd - railAft - depth), area: count*AC.panel.length*AC.panel.width, steelKg, steelM };
}

/* ---------- Measurements ----------
   Every surface is sampled about every 8 mm, because long tubes and panels have vertices only at their ends. */
const SAMPLE = .008, CELL = .05;
function surfacePoints(root, skip, keep) {
  boat.updateMatrixWorld(true);
  const out = [], seen = new Set(), a = new V3(), b = new V3(), c = new V3(), ox = boat.position.x, oy = boat.position.y;
  root.traverse(m => {
    if (!m.isMesh || (skip && skip(m))) return;
    const p = m.geometry.attributes.position, ix = m.geometry.index, n = ix ? ix.count : p.count;
    for (let t = 0; t < n; t += 3) {
      a.fromBufferAttribute(p, ix ? ix.getX(t) : t).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(p, ix ? ix.getX(t + 1) : t + 1).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(p, ix ? ix.getX(t + 2) : t + 2).applyMatrix4(m.matrixWorld);
      const k = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a))/SAMPLE));
      for (let i = 0; i <= k; i++) for (let j = 0; j <= k - i; j++) {
        const u = i/k, v = j/k, w = 1 - u - v, x = a.x*w + b.x*u + c.x*v - ox, y = a.y*w + b.y*u + c.y*v - oy, z = a.z*w + b.z*u + c.z*v;
        if (keep && !keep(x, y, z)) continue;
        const key = Math.round(x/.004) + 4096 + (Math.round(y/.004) + 4096)*8192 + (Math.round(z/.004) + 4096)*67108864;   // tubes share many edges
        if (!seen.has(key)) { seen.add(key); out.push(x, y, z); }
      }
    }
  });
  return out;
}
function toCells(pts) {
  const cells = new Map();
  for (let i = 0; i < pts.length; i += 3) {
    const a = Math.floor(pts[i]/CELL), b = Math.floor(pts[i + 1]/CELL), d = Math.floor(pts[i + 2]/CELL), key = (a + 512) + (b + 512)*1024 + (d + 512)*1048576;
    let q = cells.get(key);
    if (!q) cells.set(key, q = { x: (a + .5)*CELL, y: (b + .5)*CELL, z: (d + .5)*CELL, at: [] });
    q.at.push(i);
  }
  return [...cells.values()];
}
/* Smallest distance between two sampled surfaces; whole cells that cannot beat the best so far are skipped. */
function surfaceGap(pa, ca, pb, cb) {
  const diag = CELL*Math.sqrt(3), pairs = []; let seed = Infinity;
  for (const p of ca) for (const q of cb) { const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, e = dx*dx + dy*dy + dz*dz; if (e < seed) seed = e; }
  const reach = Math.sqrt(seed) + 2*diag;
  for (const p of ca) for (const q of cb) { const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, e = dx*dx + dy*dy + dz*dz; if (e <= reach*reach) pairs.push([e, p, q]); }
  pairs.sort((u, v) => u[0] - v[0]);
  let best = Math.sqrt(seed) + diag;
  for (const [e, p, q] of pairs) {
    if (Math.sqrt(e) - diag >= best) break;                          // pairs are closest-first, so none of the rest can win
    for (const i of p.at) for (const j of q.at) {
      const ex = pa[i] - pb[j], ey = pa[i + 1] - pb[j + 1], ez = pa[i + 2] - pb[j + 2], d = ex*ex + ey*ey + ez*ez;
      if (d < best*best) best = Math.sqrt(d);
    }
  }
  return best;
}
let obstacles = null;
function ensureObstacles() {
  if (obstacles) return obstacles;
  const near = (x, y) => x < 2.6 && y > 1.1 && y < 3.7;
  const notRail = m => { for (let q = m; q; q = q.parent) if (q === G.asBuilt || q === G.sidePanels) return true; return false; };
  const canvas = surfacePoints(G.canvas, null, near), rails = surfacePoints(G.rails, notRail, near), pushpit = [];
  for (let i = 0; i < rails.length; i += 3) if (rails[i] < PP.foot[0] + .03) pushpit.push(rails[i], rails[i + 1], rails[i + 2]);
  return obstacles = { canvas, rails, pushpit, canvasCells: toCells(canvas), railCells: toCells(rails), pushpitCells: toCells(pushpit) };
}
const toeRailTop = x => sheerY(clamp(x, 0, L)) + SPEC.deck.toeRail.height;
const railTopY = toeRailTop(0);                                    // top of the stern toe rail, at the transom
function measureArch(b) {
  if (b.report) return b.report;
  ensureObstacles();
  const pts = surfacePoints(b.frame), clear = [];                    // clear = above the deck sockets
  const R = SPEC.rig, B = R.boom, reach = B.fwd - B.aft;
  const s0 = [R.backstay[0], R.backstay[1]], ax = R.backstayTop[0] - s0[0], ay = R.backstayTop[1] - s0[1], ll = ax*ax + ay*ay;
  let past = -9, stay = 9, boom = 9, under = 9, underX = 0, top = -9, minX = 9, maxX = -9, minZ = 9, maxZ = -9;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i], y = pts[i + 1], z = pts[i + 2];
    top = Math.max(top, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    if (y <= 1.21) continue;
    clear.push(x, y, z);
    past = Math.max(past, Math.abs(z) - halfB(Math.max(x, 0)));
    const t = clamp(((x - s0[0])*ax + (y - s0[1])*ay)/ll, 0, 1);
    stay = Math.min(stay, Math.hypot(x - (s0[0] + ax*t), y - (s0[1] + ay*t), z));
    boom = Math.min(boom, Math.hypot(Math.max(0, Math.hypot(x - B.fwd, z) - reach), Math.max(0, Math.abs(y - B.y) - B.h/2)));   // full swing
    if (Math.abs(z) < .45 && y < under) { under = y; underX = x; }                // underside of the frame, clear of the legs
  }
  const cells = toCells(clear), panelKg = b.count*AC.panel.kg, rear = Object.assign(rearAngles(b.rear), { foreLength: b.fore ? 0 : b.foreLength, foreX: b.foreX, uncovered: b.uncovered }), fore = b.fore && foreAngles(b.fore);
  b.clear = clear; b.cells = cells;
  return b.report = {
    panelTopAboveWater: top - HS.floatSink, panelTopAboveRail: top - railTopY, railHeadroom: under - toeRailTop(underX), platformHeadroom: under - SPEC.platform.y,
    width: maxZ - minZ, length: maxX - minX, overhang: Math.max(0, -minX), lengthWithArch: L + Math.max(0, -minX), pastHull: Math.max(0, past),
    panels: b.count, watts: b.count*AC.panel.watts, panelArea: b.area, pipeMm: b.D*1000, steelM: b.steelM, steelKg: b.steelKg, panelKg, totalKg: b.steelKg + panelKg,
    rear, fore, backstayGap: stay - .0045, railGap: surfaceGap(clear, cells, obstacles.rails, obstacles.railCells),
    canvasGap: surfaceGap(clear, cells, obstacles.canvas, obstacles.canvasCells), boomGap: boom,
  };
}

/* Rear pipe angles, from its real end points and the transom surface at its foot. */
function rearAngles({ foot, top }) {
  const deg = v => v*180/Math.PI, dx = top[0] - foot[0], dy = top[1] - foot[1], dz = top[2] - foot[2], len = Math.hypot(dx, dy, dz);
  const k = HS.transomRake, c = HS.transomCurve, side = Math.hypot(dx, dy), ul = Math.hypot(k, 1);
  const n = [1, k, -2*c*foot[2]], nl = Math.hypot(...n);
  return {
    foot, top, length: len,
    topForward: deg(Math.atan2(Math.abs(dy), Math.abs(dx))),
    transomSide: deg(Math.acos(clamp((dx*-k + dy)/(side*ul), -1, 1))),
    transomTrue: deg(Math.asin(clamp(Math.abs(dx*n[0] + dy*n[1] + dz*n[2])/(len*nl), 0, 1))),
    transomCurve: deg(Math.atan(2*c*Math.abs(foot[2]))),
    sideways: deg(Math.atan2(Math.abs(dz), Math.abs(dx))),
    fromVertical: deg(Math.atan2(Math.abs(dx), Math.abs(dy))),
  };
}
/* Fore pipe angles: to the top frame, and to the toe rail it stands on, both measured in side view. */
function foreAngles({ foot, top }) {
  const deg = v => v*180/Math.PI, dx = top[0] - foot[0], dy = top[1] - foot[1], dz = top[2] - foot[2];
  const slope = Math.atan2(sheerY(foot[0] + .05) - sheerY(foot[0] - .05), .1), pipe = Math.atan2(dy, -dx);   // pipe rises aft
  return {
    foot, top, length: Math.hypot(dx, dy, dz),
    topAft: deg(Math.atan2(Math.abs(dy), Math.abs(dx))),          // between the pipe and the frame running aft
    deckAft: deg(pipe + slope),                                    // between the pipe and the deck running aft
    sideways: deg(Math.atan2(Math.abs(dz), Math.hypot(dx, dy))),
    footX: foot[0],
  };
}
/* True-scale side view of the rear pipe, bow to the right. */
function angleDiagram(a) {
  const W = 286, H = 200, k0 = HS.transomRake, [fx, fy] = a.foot, [tx, ty] = a.top;
  const x0 = Math.min(fx, tx) - .08, x1 = Math.max(fx, tx) + .46, y0 = fy - .13, y1 = ty + .1, s = Math.min((W - 12)/(x1 - x0), (H - 12)/(y1 - y0));
  const ox = (W - (x1 - x0)*s)/2, X = x => +(ox + (x - x0)*s).toFixed(1), Y = y => +(H - 6 - (y - y0)*s).toFixed(1);
  const tr = y => transomX(y, a.foot[2]);
  const arc = (cx, cy, u, v, r) => {
    const su = [u[0], -u[1]], sv = [v[0], -v[1]], sweep = su[0]*sv[1] - su[1]*sv[0] > 0 ? 1 : 0;
    return `M${(cx + su[0]*r).toFixed(1)} ${(cy + su[1]*r).toFixed(1)}A${r} ${r} 0 0 ${sweep} ${(cx + sv[0]*r).toFixed(1)} ${(cy + sv[1]*r).toFixed(1)}`;
  };
  const unit = (p, q) => { const l = Math.hypot(p, q); return [p/l, q/l]; };
  const down = unit(fx - tx, fy - ty), up = unit(tx - fx, ty - fy), face = unit(-k0, 1), fwd = [1, 0];
  const mid = (u, v) => unit(u[0] + v[0], u[1] + v[1]), tm = mid(fwd, down), fm = mid(face, up);
  const cx = X(tx), cy = Y(ty), bx = X(fx), by = Y(fy), yTop = Math.min(ty, sheerY(0));
  const label = `Side view of the rear pipe. ${num(a.topForward, 1)} degrees at the top frame and ${num(a.transomSide, 1)} degrees at the transom.`;
  return `<svg class="angle-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    <line class="d-hull" x1="${X(tr(fy - .12))}" y1="${Y(fy - .12)}" x2="${X(tr(yTop))}" y2="${Y(yTop)}"/>
    <line class="d-frame" x1="${cx}" y1="${cy}" x2="${X(Math.min(x1, tx + .55))}" y2="${cy}"/>
    <line class="d-ref" x1="${bx}" y1="${by}" x2="${(bx + face[0]*62).toFixed(1)}" y2="${(by - face[1]*62).toFixed(1)}"/>
    <line class="d-stub" x1="${X(tr(fy))}" y1="${by}" x2="${bx}" y2="${by}"/>
    <line class="d-pipe" x1="${bx}" y1="${by}" x2="${cx}" y2="${cy}"/>
    <path class="d-arc" d="${arc(cx, cy, fwd, down, 30)}"/><path class="d-arc" d="${arc(bx, by, face, up, 50)}"/>
    <line class="d-lead" x1="${(bx + fm[0]*50).toFixed(1)}" y1="${(by - fm[1]*50).toFixed(1)}" x2="${(bx + 29).toFixed(1)}" y2="${(by - 46).toFixed(1)}"/>
    <text class="d-val" x="${(cx + tm[0]*40 + 4).toFixed(1)}" y="${(cy - tm[1]*40 + 4).toFixed(1)}">${num(a.topForward, 1)}°</text>
    <text class="d-val" x="${(bx + 32).toFixed(1)}" y="${(by - 42).toFixed(1)}">${num(a.transomSide, 1)}°</text>
    <text class="d-tag" x="${X(Math.min(x1, tx + .55))}" y="${cy - 6}" text-anchor="end">Panel frame</text>
    <text class="d-tag" x="${(X(tr(fy)) + 7).toFixed(1)}" y="${(by + 13).toFixed(1)}">Transom</text>
    <text class="d-tag" x="${(cx - 5).toFixed(1)}" y="${(cy + (by - cy)*.55).toFixed(1)}" text-anchor="end">Rear pipe</text>
  </svg>`;
}

/* ---------- Panels hung along the lifelines ---------- */
G.sidePanels = new T.Group(); G.rails.add(G.sidePanels);
function buildSidePanels(count) {
  const R = SPEC.rails, Q = R.pushpit, S = AC.sidePanels, { length: P, width: W, thick } = AC.panel, group = new T.Group();
  group.visible = false; G.sidePanels.add(group);
  [1, -1].forEach(s => {
    // the lifeline span from the pushpit to the next stanchion, the same line the wires follow
    const xB = R.stanchions[0], zB = s*(deckHalf(xB) - R.inset), yB = deckY(xB, zB);
    const wire = h => { const k = h/R.height; return [PP.leg(s, k), [xB, lerp(yB, yB + R.height, k), zB*.985]]; };
    const [A, B] = wire(R.wires[1]), [A2, B2] = wire(R.wires[0]);
    const a = new V3(B[0] - A[0], B[1] - A[1], B[2] - A[2]), span = a.length(); a.normalize();
    const out = new V3().crossVectors(a, new V3(0, 1, 0)).normalize(); if (out.z*s < 0) out.negate();
    const up = new V3().crossVectors(out, a).normalize(); if (up.y < 0) up.negate();
    const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(a, up, new V3().crossVectors(a, up)));
    const d0 = (S.startX - A[0])/a.x;
    for (let i = 0; i < count; i++) {
      const d = d0 + i*(P + AC.panelGap) + P/2;
      const c = new V3(...A).addScaledVector(a, d).addScaledVector(out, S.standoff).addScaledVector(up, S.topAboveWire - W/2);
      const body = put(group, new T.BoxGeometry(P, W, thick), mat.alu); body.quaternion.copy(q); body.position.copy(c);
      const face = put(group, new T.PlaneGeometry(P - .03, W - .03), mat.cell, false); face.quaternion.copy(q); face.position.copy(c).addScaledVector(out, thick/2 + .001);
      [-.32, .32].forEach(k => {                                       // clips onto the upper and lower wire
        const e = d + k*P, f = e/span;
        const t = new V3(...A).addScaledVector(a, e), l = new V3(lerp(A2[0], B2[0], f), lerp(A2[1], B2[1], f), lerp(A2[2], B2[2], f));
        [t, l].forEach(p => { rod(group, p.toArray(), p.clone().addScaledVector(out, S.standoff).toArray(), .006, mat.steel, 8).userData.clip = true; });
      });
    }
  });
  return { group, count, gaps: {} };
}
function measureSides(sb, b) {
  const key = b ? b.key : 'none';
  if (sb.gaps[key]) return sb.gaps[key];
  ensureObstacles();
  if (!sb.pts) {
    sb.pts = surfacePoints(sb.group, m => m.userData.clip); sb.cells = toCells(sb.pts);
    let toe = 9, past = -9;
    for (let i = 0; i < sb.pts.length; i += 3) {
      const x = sb.pts[i], y = sb.pts[i + 1], z = sb.pts[i + 2];
      toe = Math.min(toe, y - (sheerY(x) + SPEC.deck.toeRail.height)); past = Math.max(past, Math.abs(z) - halfB(x));
    }
    sb.toeGap = toe; sb.pastHull = Math.max(0, past);
    sb.pushpitGap = surfaceGap(sb.pts, sb.cells, obstacles.pushpit, obstacles.pushpitCells);
    sb.wireGap = surfaceGap(sb.pts, sb.cells, obstacles.rails, obstacles.railCells);
  }
  return sb.gaps[key] = {
    perSide: sb.count, panels: sb.count*2, watts: sb.count*2*AC.panel.watts,
    toeGap: sb.toeGap, pushpitGap: sb.pushpitGap, wireGap: sb.wireGap, pastHull: sb.pastHull,
    archGap: b ? surfaceGap(sb.pts, sb.cells, b.clear, b.cells) : null,
  };
}

/* ---------- Selection and page panel ---------- */
const archBuilt = {}, sideBuilt = {};
const archState = { design: AC.designs[0].id, panels: 3, pipe: AC.pipes[1], orient: 'across', sides: 0, rear: 60, height: 'fit', fore: AC.foreAngles[0] };
let currentArch = 'none', lastArch = AC.designs[0].id, currentBuilt = null, currentSide = null, archKick = () => {};
const archById = id => AC.designs.find(d => d.id === id || d.alias === id);
const num = (v, n) => v.toLocaleString('en-GB', { minimumFractionDigits: n, maximumFractionDigits: n });
const fmtM = v => `${num(v, 2)} m`, fmtCm = v => `${num(v*100, 0)} cm`;
const gapRow = (label, v, byDesign) => v < (byDesign ? 0 : AC.contactGap) ? [label, 'Contact', 'hit'] : [label, fmtCm(v), !byDesign && v < AC.warnGap ? 'warn' : ''];

function renderArchStats(r, q) {
  const groups = [], deg = v => `${num(v, 1)}°`;
  if (r) groups.push(
    [r.fore ? 'Rear pipe angles and lengths' : 'Pipe angles and lengths', [['Top frame, forward side', deg(r.rear.topForward)], ['Top frame, aft side', deg(180 - r.rear.topForward)], ['Transom face, side view', deg(r.rear.transomSide)],
      ['Transom face, true angle', deg(r.rear.transomTrue)], ['Transom curve at mount', deg(r.rear.transomCurve)], ['Sideways from ship’s line', deg(r.rear.sideways)], ['Rear pipe length', fmtM(r.rear.length)], ...(r.rear.foreLength ? [['Fore pipe length, vertical', fmtM(r.rear.foreLength)], ['Fore pipes forward of transom', fmtM(r.rear.foreX)], ['Frame not covered by panels', fmtCm(r.rear.uncovered)]] : [])], angleDiagram(r.rear)],
    ...(r.fore ? [['Fore pipe angles and lengths', [['Top frame, aft side', deg(r.fore.topAft)], ['Top frame, forward side', deg(180 - r.fore.topAft)], ['Toe rail, aft side', deg(r.fore.deckAft)], ['Toe rail, forward side', deg(180 - r.fore.deckAft)],
      ['Inward lean, front view', deg(r.fore.sideways)], ['Fore pipe length', fmtM(r.fore.length)], ['Fore pipe foot from transom', fmtM(r.fore.footX)]]]] : []),
    ['Height', [['Panel top above water', fmtM(r.panelTopAboveWater)], ['Panel top above toe rail', fmtM(r.panelTopAboveRail)], ['Headroom above toe rail', fmtM(r.railHeadroom)], ['Headroom above stern platform', fmtM(r.platformHeadroom)]]],
    ['Size', [['Width', fmtM(r.width)], ['Length', fmtM(r.length)], ['Overhang past transom', fmtM(r.overhang)], ['Past hull side', fmtM(r.pastHull)], ['Boat length with arch', fmtM(r.lengthWithArch)]]],
    ['Clearance', [gapRow('Backstay', r.backstayGap), gapRow('Rails and pushpit', r.railGap), gapRow('Canvas', r.canvasGap), gapRow('Boom, full swing', r.boomGap)]]);
  if (q) groups.push(['Lifeline panels', [
    ['Panels', `${q.perSide} per side`],
    ...(q.archGap === null ? [] : [gapRow('Gap to arch', q.archGap)]),
    gapRow('Gap to pushpit', q.pushpitGap),
    gapRow('Gap to wires, stanchions', q.wireGap, true),
    gapRow('Height above toe rail', q.toeGap),
    ['Past hull side', fmtM(q.pastHull)],
  ]]);
  const topW = r ? r.watts : 0, sideW = q ? q.watts : 0, rows = [];
  if (r) rows.push(['Arch panels', `${r.panels} × ${AC.panel.watts} W = ${r.watts} W`]);
  if (q) rows.push(['Lifeline panels', `${q.panels} × ${AC.panel.watts} W = ${q.watts} W`]);
  if (r || q) rows.push(['Total rated power', `${topW + sideW} W`]);
  if (r) rows.push([`Pipe, ${num(r.pipeMm, 0)} mm`, `${num(r.steelM, 1)} m`], ['Arch steel weight (est.)', `${num(r.steelKg, 1)} kg`]);
  if (r) rows.push(['Arch panel weight', `${num(r.panelKg, 1)} kg`], ['Arch total weight (est.)', `${num(r.totalKg, 1)} kg`]);
  if (rows.length) groups.push(['Power and materials', rows]);
  groups.push([RADAR.name + ' radar', [['Top above water', fmtM(RADAR.top - HS.floatSink)], ['Bottom above water', fmtM(RADAR.bottom - HS.floatSink)], ['Size', `Ø${num(RADAR.diameter*1000, 0)} × ${num(RADAR.height*1000, 0)} mm`], ['Mast mount', RADAR.mount], ['Mount above spreaders', fmtCm(RADAR.spreaderGap)], ['Radome to mast', `${num(RADAR.mastGap*100, 1)} cm`], ['Radar weight', `${num(RADAR.kg, 1)} kg`]]]);
  document.getElementById('archStats').innerHTML = groups.map(([h, list, before]) =>
    `<h2>${h}</h2>${before || ''}<dl>${list.map(([k, v, c]) => `<div><dt>${k}</dt><dd${c ? ` class="${c}"` : ''}>${v}</dd></div>`).join('')}</dl>`).join('');
}
function setArch(id, opts = {}) {
  if (opts.panels && AC.panelCounts.includes(opts.panels)) archState.panels = opts.panels;
  if (opts.pipe && AC.pipes.includes(opts.pipe)) archState.pipe = opts.pipe;
  if (opts.orient === 'across' || opts.orient === 'fore') archState.orient = opts.orient;
  if (AC.sidePanels.counts.includes(opts.sides)) archState.sides = opts.sides;
  if (AC.rearAngles.includes(opts.rear)) archState.rear = opts.rear;
  if (AC.foreAngles.includes(opts.fore)) archState.fore = opts.fore;
  if (AC.archHeights.some(q => q.id === opts.height)) archState.height = opts.height;
  const d = archById(id);
  if (!d) id = 'none'; else id = d.id;
  Object.values(archBuilt).forEach(b => { b.group.visible = false; });
  Object.values(sideBuilt).forEach(b => { b.group.visible = false; });
  currentArch = id; G.asBuilt.visible = !d; currentBuilt = null;
  document.getElementById('archOptions').hidden = !d;
  const canAngle = !!(d && d.aftStrut.straight), rearA = canAngle ? archState.rear : 0;
  const canFore = !!(d && d.foreStrut === undefined && d.foreStraight), foreA = canFore ? archState.fore : 0;
  document.getElementById('archForeWrap').hidden = !canFore;
  document.getElementById('archRearWrap').hidden = !canAngle; document.getElementById('archHeightWrap').hidden = !canAngle;
  const heightA = canAngle ? (archState.height === 'fit' && !rearA ? 'current' : archState.height) : 'current';   // an arch at the panel edge has no gap to close
  const fitRadio = document.querySelector('input[name="archHeight"][value="fit"]'); if (fitRadio) fitRadio.disabled = !rearA;
  if (d) {
    lastArch = id; archState.design = id;
    const key = `${id}|${archState.panels}|${archState.pipe}|${archState.orient}|${rearA}|${heightA}|${foreA}`;
    const b = archBuilt[key] || (archBuilt[key] = Object.assign(buildArch(d, archState.panels, archState.pipe, archState.orient, rearA, heightA, foreA), { key }));
    b.group.visible = true; currentBuilt = b;
  }
  const n = archState.sides;
  currentSide = n ? (sideBuilt[n] || (sideBuilt[n] = buildSidePanels(n))) : null;
  if (currentSide) currentSide.group.visible = true;
  const r = currentBuilt ? measureArch(currentBuilt) : null, q = currentSide ? measureSides(currentSide, currentBuilt) : null;
  renderArchStats(r, q);
  document.getElementById('archCurrent').textContent = d ? `${d.name}, ${n ? `${archState.panels} + ${n*2}` : archState.panels} panels` : n ? `No arch, ${n*2} panels` : 'No arch';
  document.getElementById('archNote').textContent = d ? d.note : 'The boat as she is today, with the ensign staff and antenna in their original places.';
  [['archDesign', id], ['archPanels', archState.panels], ['archOrient', archState.orient], ['archPipe', archState.pipe], ['archSides', n], ['archRear', archState.rear], ['archFore', archState.fore], ['archHeight', canAngle ? heightA : archState.height]].forEach(([k, v]) => { const el = document.querySelector(`input[name="${k}"][value="${v}"]`); if (el) el.checked = true; });
  try { history.replaceState(null, '', (d ? `#arch=${id}&panels=${archState.panels}&layout=${archState.orient}&pipe=${Math.round(archState.pipe*1000)}&rear=${archState.rear}&height=${archState.height}${canFore ? `&fore=${archState.fore}` : ''}` : '#arch=none') + `&sides=${n}`); } catch (e) { /* not available in some file:// contexts */ }
  archKick();
}
function archReport() {
  const r = currentBuilt ? measureArch(currentBuilt) : null, q = currentSide ? measureSides(currentSide, currentBuilt) : null;
  return r || q ? Object.assign({}, r, { lifeline: q }) : null;
}
function initArchUI(kick) {
  archKick = kick;
  const addRadios = (host, name, items, onPick) => items.forEach(([value, label]) => {
    const l = document.createElement('label'), i = document.createElement('input');
    i.type = 'radio'; i.name = name; i.value = value; i.addEventListener('change', () => onPick(value));
    l.append(i, document.createTextNode(label)); document.getElementById(host).append(l);
  });
  addRadios('archPick', 'archDesign', [...AC.designs.map(d => [d.id, d.name]), ['none', 'No arch']], v => setArch(v));
  addRadios('archPanelPick', 'archPanels', AC.panelCounts.map(n => [n, `${n} panels`]), v => setArch(lastArch, { panels: +v }));
  addRadios('archOrientPick', 'archOrient', [['across', 'Long side across'], ['fore', 'Long side fore-aft']], v => setArch(lastArch, { orient: v }));
  addRadios('archRearPick', 'archRear', AC.rearAngles.map(a => [a, a ? `${a}°` : 'At panel edge']), v => setArch(lastArch, { rear: +v }));
  addRadios('archForePick', 'archFore', AC.foreAngles.map(a => [a, `${a}°`]), v => setArch(lastArch, { fore: +v }));
  addRadios('archHeightPick', 'archHeight', AC.archHeights.map(q => [q.id, q.name]), v => setArch(lastArch, { height: v }));
  addRadios('archPipePick', 'archPipe', AC.pipes.map(p => [p, `${Math.round(p*1000)} mm`]), v => setArch(lastArch, { pipe: +v }));
  addRadios('archSidePick', 'archSides', AC.sidePanels.counts.map(n => [n, n ? `${n} per side` : 'None']), v => setArch(currentArch, { sides: +v }));
  if (innerWidth <= 760) document.getElementById('archPanel').open = false;
  const h = new URLSearchParams(location.hash.slice(1)), a = h.get('arch'), sd = h.get('sides');
  setArch(a === 'none' ? 'none' : archById(a) ? a : AC.designs[0].id, { panels: +h.get('panels'), pipe: +h.get('pipe')/1000, orient: h.get('layout'), rear: h.has('rear') ? +h.get('rear') : undefined, height: h.get('height'), fore: h.has('fore') ? +h.get('fore') : undefined, sides: sd === null ? undefined : +sd });
}
