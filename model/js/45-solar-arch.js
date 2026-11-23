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

function buildArch(d, count, D, orient) {
  const group = new T.Group(), frame = new T.Group(), extras = new T.Group();
  group.add(frame, extras); group.visible = false; G.arch.add(group);
  let steelKg = 0, steelM = 0;
  const kgPerM = Math.PI*(D - AC.pipeWall)*AC.pipeWall*7980;
  const pipe = (pts, seg = 12) => {
    for (let i = 0; i < pts.length - 1; i++) steelM += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
    return pts.length === 2 ? rod(frame, pts[0], pts[1], D/2, mat.steel, seg) : tube(frame, pts, D/2, mat.steel, false, seg);
  };
  const footPlate = p => {
    const plate = put(frame, new T.CylinderGeometry(.062, .068, .012, 22), mat.steel); plate.position.set(p[0], p[1] + .006, p[2]);
    const socket = put(frame, new T.CylinderGeometry(D/2 + .006, D/2 + .009, .06, 18), mat.steel); socket.position.set(p[0], p[1] + .035, p[2]);
  };

  // main hoop
  const H = d.hoop, fy = deckY(H.footX, H.footHalf), yS = H.topY - H.bend;
  const onHoop = y => lerp(H.footX, H.topX, (y - fy)/(H.topY - fy));
  const side = s => {
    const pts = [[H.footX, fy, s*H.footHalf]];
    for (let i = 1; i <= 5; i++) { const f = i/5, y = lerp(fy, yS, f); pts.push([onHoop(y), y, s*lerp(H.footHalf, H.half, f)]); }
    for (let i = 1; i <= 8; i++) { const a = i/8*Math.PI/2, y = yS + H.bend*Math.sin(a); pts.push([onHoop(y), y, s*(H.half - H.bend + H.bend*Math.cos(a))]); }
    return pts;
  };
  pipe([...side(-1), [H.topX, H.topY, 0], ...side(1).reverse()], 14);
  const hoopYAt = z => { const o = Math.abs(z) - (H.half - H.bend); return o <= 0 ? H.topY : yS + Math.sqrt(Math.max(0, H.bend*H.bend - o*o)); };

  // carrier rails rest on the hoop and run under the panel edges, closed by two cross tubes
  const panels = panelLayout(d, count, orient), yRail = H.topY + D, panelY = yRail + D/2 + AC.panel.thick/2;
  const fwd = Math.max(...panels.map(q => q[0])), aft = Math.min(...panels.map(q => q[1]));
  const halfW = Math.max(...panels.flatMap(q => [Math.abs(q[2]), Math.abs(q[3])]));
  const A = d.aftStrut, strutTop = Math.min(aft, -.04), railFwd = Math.max(fwd, H.topX + .01), railAft = strutTop;
  // each rail runs under the panels it carries; the outer pair also ties the hoop to the struts
  const rails = [];
  panels.forEach(([f, a, z0, z1]) => [z0, z1].forEach(z => {
    const r = rails.find(q => Math.abs(q.z - z) < .06);
    if (r) { r.z = (r.z*r.n + z)/(r.n + 1); r.n++; r.f = Math.max(r.f, f); r.a = Math.min(r.a, a); } else rails.push({ z, n: 1, f, a });
  }));
  rails.forEach(r => {
    const outer = Math.abs(Math.abs(r.z) - halfW) < .001, f = outer ? railFwd : r.f, a = outer ? railAft : r.a;
    pipe([[f, yRail, r.z], [a, yRail, r.z]]);
    if (H.topX <= f && H.topX >= a && Math.abs(r.z) <= H.half) { const y = hoopYAt(r.z); pipe([[onHoop(y), y, r.z], [H.topX, yRail, r.z]], 10); }  // saddle on the hoop
  });
  // panels wider than the hoop get a third cross tube resting on it
  [railFwd, railAft, ...(halfW > H.half - .02 ? [H.topX] : [])].forEach(x => pipe([[x, yRail, -halfW], [x, yRail, halfW]]));

  [1, -1].forEach(s => {
    // aft strut stands off the transom, outside the pushpit
    const tz = s*A.footHalf, tx = transomX(A.footY, tz), f = [tx - A.standoff, A.footY, tz];
    pipe([f, [strutTop, yRail, s*halfW]]);
    pipe([[tx, A.footY, tz], f], 10);
    const plate = put(frame, new T.CylinderGeometry(.055, .055, .01, 22), mat.steel); plate.rotation.z = Math.PI/2; plate.position.set(tx - .004, A.footY, tz);
    footPlate([H.footX, fy, s*H.footHalf]);
    if (d.foreStrut) {
      const q = d.foreStrut, b = [q.footX, deckY(q.footX, q.footHalf), s*q.footHalf];
      pipe([b, [railFwd, yRail, s*Math.min(halfW, H.half)]]); footPlate(b);   // stays inboard of the lifelines
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
  const az = -halfW - .04;
  rod(extras, [railFwd, yRail, -halfW], [railFwd, yRail, az], .012, mat.steel);
  antenna(extras, [railFwd, yRail, az], [railFwd, yRail + .42, az]);
  return { d, group, frame, count, D, area: count*AC.panel.length*AC.panel.width, steelKg, steelM };
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
  for (let i = 0; i < rails.length; i += 3) if (rails[i] < .56) pushpit.push(rails[i], rails[i + 1], rails[i + 2]);
  return obstacles = { canvas, rails, pushpit, canvasCells: toCells(canvas), railCells: toCells(rails), pushpitCells: toCells(pushpit) };
}
function measureArch(b) {
  if (b.report) return b.report;
  ensureObstacles();
  const pts = surfacePoints(b.frame), clear = [];                    // clear = above the deck sockets
  const R = SPEC.rig, B = R.boom, reach = B.fwd - B.aft;
  const s0 = [R.backstay[0], R.backstay[1]], ax = R.mastX + .02 - s0[0], ay = R.mastTop - .03 - s0[1], ll = ax*ax + ay*ay;
  let past = -9, stay = 9, boom = 9, head = 9, top = -9, minX = 9, maxX = -9, minZ = 9, maxZ = -9;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i], y = pts[i + 1], z = pts[i + 2];
    top = Math.max(top, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    if (y <= 1.21) continue;
    clear.push(x, y, z);
    past = Math.max(past, Math.abs(z) - halfB(Math.max(x, 0)));
    const t = clamp(((x - s0[0])*ax + (y - s0[1])*ay)/ll, 0, 1);
    stay = Math.min(stay, Math.hypot(x - (s0[0] + ax*t), y - (s0[1] + ay*t), z));
    boom = Math.min(boom, Math.hypot(Math.max(0, Math.hypot(x - B.fwd, z) - reach), Math.max(0, Math.abs(y - B.y) - B.h/2)));   // full swing
    if (Math.abs(z) < .45 && x > 0 && x < .75) head = Math.min(head, y - deckY(x, z));
  }
  const cells = toCells(clear), panelKg = b.count*AC.panel.kg;
  b.clear = clear; b.cells = cells;
  return b.report = {
    panelTopAboveWater: top - HS.floatSink, panelTopAboveDeck: top - deckY(.3, 0), headroom: head,
    width: maxZ - minZ, length: maxX - minX, overhang: Math.max(0, -minX), lengthWithArch: L + Math.max(0, -minX), pastHull: Math.max(0, past),
    panels: b.count, watts: b.count*AC.panel.watts, panelArea: b.area, pipeMm: b.D*1000, steelM: b.steelM, steelKg: b.steelKg, panelKg, totalKg: b.steelKg + panelKg,
    backstayGap: stay - .0045, railGap: surfaceGap(clear, cells, obstacles.rails, obstacles.railCells),
    canvasGap: surfaceGap(clear, cells, obstacles.canvas, obstacles.canvasCells), boomGap: boom,
  };
}

/* ---------- Panels hung along the lifelines ---------- */
G.sidePanels = new T.Group(); G.rails.add(G.sidePanels);
function buildSidePanels(count) {
  const R = SPEC.rails, Q = R.pushpit, S = AC.sidePanels, { length: P, width: W, thick } = AC.panel, group = new T.Group();
  group.visible = false; G.sidePanels.add(group);
  [1, -1].forEach(s => {
    // the lifeline span from the pushpit to the next stanchion, the same line the wires follow
    const zA = s*(deckHalf(Q.foreX) - R.inset)*.985, xB = R.stanchions[1], zB = s*(deckHalf(xB) - R.inset), yB = deckY(xB, zB);
    const wire = h => { const k = h/R.height; return [[Q.foreX, lerp(deckY(Q.foreX, zA), Q.topY - .02, k), zA], [xB, lerp(yB, yB + R.height, k), zB*.985]]; };
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
    perSide: sb.count, panels: sb.count*2, watts: sb.count*2*AC.panel.watts, kg: sb.count*2*AC.panel.kg,
    toeGap: sb.toeGap, pushpitGap: sb.pushpitGap, wireGap: sb.wireGap, pastHull: sb.pastHull,
    archGap: b ? surfaceGap(sb.pts, sb.cells, b.clear, b.cells) : null,
  };
}

/* ---------- Selection and page panel ---------- */
const archBuilt = {}, sideBuilt = {};
const archState = { design: AC.designs[0].id, panels: 3, pipe: AC.pipes[1], orient: 'across', sides: 0 };
let currentArch = 'none', lastArch = AC.designs[0].id, currentBuilt = null, currentSide = null, archKick = () => {};
const archById = id => AC.designs.find(d => d.id === id);
const num = (v, n) => v.toLocaleString('en-GB', { minimumFractionDigits: n, maximumFractionDigits: n });
const fmtM = v => `${num(v, 2)} m`, fmtCm = v => `${num(v*100, 0)} cm`;
const gapRow = (label, v, byDesign) => v < (byDesign ? 0 : AC.contactGap) ? [label, 'Contact', 'hit'] : [label, fmtCm(v), !byDesign && v < AC.warnGap ? 'warn' : ''];

function renderArchStats(r, q) {
  const groups = [];
  if (r) groups.push(
    ['Height', [['Panel top above water', fmtM(r.panelTopAboveWater)], ['Panel top above deck', fmtM(r.panelTopAboveDeck)], ['Headroom on aft deck', fmtM(r.headroom)]]],
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
  if (r) rows.push([`Pipe, ${num(r.pipeMm, 0)} mm`, `${num(r.steelM, 1)} m`], ['Steel weight (est.)', `${num(r.steelKg, 0)} kg`]);
  if (r || q) rows.push(['Panel weight (est.)', `${num((r ? r.panelKg : 0) + (q ? q.kg : 0), 0)} kg`], ['Total weight (est.)', `${num((r ? r.totalKg : 0) + (q ? q.kg : 0), 0)} kg`]);
  if (rows.length) groups.push(['Power and materials', rows]);
  document.getElementById('archStats').innerHTML = groups.map(([h, list]) =>
    `<h2>${h}</h2><dl>${list.map(([k, v, c]) => `<div><dt>${k}</dt><dd${c ? ` class="${c}"` : ''}>${v}</dd></div>`).join('')}</dl>`).join('');
}
function setArch(id, opts = {}) {
  if (opts.panels && AC.panelCounts.includes(opts.panels)) archState.panels = opts.panels;
  if (opts.pipe && AC.pipes.includes(opts.pipe)) archState.pipe = opts.pipe;
  if (opts.orient === 'across' || opts.orient === 'fore') archState.orient = opts.orient;
  if (AC.sidePanels.counts.includes(opts.sides)) archState.sides = opts.sides;
  const d = archById(id);
  if (!d) id = 'none';
  Object.values(archBuilt).forEach(b => { b.group.visible = false; });
  Object.values(sideBuilt).forEach(b => { b.group.visible = false; });
  currentArch = id; G.asBuilt.visible = !d; currentBuilt = null;
  document.getElementById('archOptions').hidden = !d;
  if (d) {
    lastArch = id; archState.design = id;
    const key = `${id}|${archState.panels}|${archState.pipe}|${archState.orient}`;
    const b = archBuilt[key] || (archBuilt[key] = Object.assign(buildArch(d, archState.panels, archState.pipe, archState.orient), { key }));
    b.group.visible = true; currentBuilt = b;
  }
  const n = archState.sides;
  currentSide = n ? (sideBuilt[n] || (sideBuilt[n] = buildSidePanels(n))) : null;
  if (currentSide) currentSide.group.visible = true;
  const r = currentBuilt ? measureArch(currentBuilt) : null, q = currentSide ? measureSides(currentSide, currentBuilt) : null;
  renderArchStats(r, q);
  document.getElementById('archCurrent').textContent = d ? `${d.name}, ${n ? `${archState.panels} + ${n*2}` : archState.panels} panels` : n ? `No arch, ${n*2} panels` : 'No arch';
  document.getElementById('archNote').textContent = d ? d.note : 'The boat as she is today, with the ensign staff and antenna in their original places.';
  [['archDesign', id], ['archPanels', archState.panels], ['archOrient', archState.orient], ['archPipe', archState.pipe], ['archSides', n]].forEach(([k, v]) => { const el = document.querySelector(`input[name="${k}"][value="${v}"]`); if (el) el.checked = true; });
  try { history.replaceState(null, '', (d ? `#arch=${id}&panels=${archState.panels}&layout=${archState.orient}&pipe=${Math.round(archState.pipe*1000)}` : '#arch=none') + `&sides=${n}`); } catch (e) { /* not available in some file:// contexts */ }
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
  addRadios('archPipePick', 'archPipe', AC.pipes.map(p => [p, `${Math.round(p*1000)} mm`]), v => setArch(lastArch, { pipe: +v }));
  addRadios('archSidePick', 'archSides', AC.sidePanels.counts.map(n => [n, n ? `${n} per side` : 'None']), v => setArch(currentArch, { sides: +v }));
  if (innerWidth <= 760) document.getElementById('archPanel').open = false;
  const h = new URLSearchParams(location.hash.slice(1)), a = h.get('arch'), sd = h.get('sides');
  setArch(a === 'none' ? 'none' : archById(a) ? a : AC.designs[0].id, { panels: +h.get('panels'), pipe: +h.get('pipe')/1000, orient: h.get('layout'), sides: sd === null ? undefined : +sd });
}
