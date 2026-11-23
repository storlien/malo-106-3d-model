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

/* Panel positions as [forward x, aft x, port z, starboard z]. Panels lie across the boat unless three share a row. */
function panelLayout(d, count) {
  const { length: P, width: W } = AC.panel, g = AC.panelGap, f = typeof d.fwdX === 'number' ? d.fwdX : d.fwdX[count];
  const pair = (x, s) => [[x, x - W, -s - P, -s], [x, x - W, s, s + P]], row2 = f - W - g;
  if (d.layout === 'split') {
    const first = pair(f, AC.backstaySlot);
    if (count === 2) return first;
    return count === 3 ? [...first, [row2, row2 - W, -P/2, P/2]] : [...first, ...pair(row2, g/2)];
  }
  if (count === 2) return pair(f, g/2);
  if (count === 3) return [-1, 0, 1].map(k => [f, f - P, k*(W + g) - W/2, k*(W + g) + W/2]);
  return [...pair(f, g/2), ...pair(row2, g/2)];
}

function buildArch(d, count, D) {
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
  const panels = panelLayout(d, count), yRail = H.topY + D, panelY = yRail + D/2 + AC.panel.thick/2;
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
    if (H.topX <= f && H.topX >= a) { const y = hoopYAt(r.z); pipe([[onHoop(y), y, r.z], [H.topX, yRail, r.z]], 10); }  // saddle on the hoop
  });
  [railFwd, railAft].forEach(x => pipe([[x, yRail, -halfW], [x, yRail, halfW]]));

  [1, -1].forEach(s => {
    // aft strut stands off the transom, outside the pushpit
    const tz = s*A.footHalf, tx = transomX(A.footY, tz), f = [tx - A.standoff, A.footY, tz];
    pipe([f, [strutTop, yRail, s*halfW]]);
    pipe([[tx, A.footY, tz], f], 10);
    const plate = put(frame, new T.CylinderGeometry(.055, .055, .01, 22), mat.steel); plate.rotation.z = Math.PI/2; plate.position.set(tx - .004, A.footY, tz);
    footPlate([H.footX, fy, s*H.footHalf]);
    if (d.foreStrut) {
      const q = d.foreStrut, b = [q.footX, deckY(q.footX, q.footHalf), s*q.footHalf];
      pipe([b, [fwd, yRail, s*halfW]]); footPlate(b);
    }
    if (d.davits) {
      const v = d.davits, z = s*v.z, a = [H.topX, H.topY - .01, z], m = [lerp(H.topX, v.tipX, .55), lerp(H.topY, v.tipY, .3), z], t = [v.tipX, v.tipY, z];
      pipe([a, m, [lerp(v.tipX, H.topX, .08), v.tipY + .05, z], t]);
      pipe([m, [lerp(f[0], strutTop, .72), lerp(f[1], yRail, .72), s*lerp(A.footHalf, halfW, .72)]]);
      const sheave = put(frame, new T.CylinderGeometry(.04, .04, .025, 18), mat.dark); sheave.rotation.x = Math.PI/2; sheave.position.set(v.tipX, v.tipY - .035, z);
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

  // ensign under the panels, antenna on the port shoulder
  ensign(extras, AC.ensign.base, AC.ensign.tip);
  const yA = yS - .05;
  antenna(extras, [onHoop(yA), yA, -H.half - .005], [onHoop(yA) - .02, yA + .44, -H.half - .12]);
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
function measureArch(b) {
  if (b.report) return b.report;
  const near = (x, y) => x < 2.3 && y > 1.15 && y < 3.7;
  if (!obstacles) {
    const inAsBuilt = m => { for (let q = m; q; q = q.parent) if (q === G.asBuilt) return true; return false; };
    const canvas = surfacePoints(G.canvas, null, near), rails = surfacePoints(G.rails, inAsBuilt, near);
    obstacles = { canvas, rails, canvasCells: toCells(canvas), railCells: toCells(rails) };
  }
  const pts = surfacePoints(b.frame), clear = [];                    // clear = above the deck sockets
  const R = SPEC.rig, B = R.boom, reach = B.fwd - B.aft;
  const s0 = [R.backstay[0], R.backstay[1]], ax = R.mastX + .02 - s0[0], ay = R.mastTop - .03 - s0[1], ll = ax*ax + ay*ay;
  let stay = 9, boom = 9, head = 9, top = -9, minX = 9, maxX = -9, minZ = 9, maxZ = -9;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i], y = pts[i + 1], z = pts[i + 2];
    top = Math.max(top, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    if (y <= 1.21) continue;
    clear.push(x, y, z);
    const t = clamp(((x - s0[0])*ax + (y - s0[1])*ay)/ll, 0, 1);
    stay = Math.min(stay, Math.hypot(x - (s0[0] + ax*t), y - (s0[1] + ay*t), z));
    boom = Math.min(boom, Math.hypot(Math.max(0, Math.hypot(x - B.fwd, z) - reach), Math.max(0, Math.abs(y - B.y) - B.h/2)));   // full swing
    if (Math.abs(z) < .45 && x > 0 && x < .75) head = Math.min(head, y - deckY(x, z));
  }
  const cells = toCells(clear), panelKg = b.count*AC.panel.kg;
  return b.report = {
    panelTopAboveWater: top - HS.floatSink, panelTopAboveDeck: top - deckY(.3, 0), headroom: head,
    width: maxZ - minZ, length: maxX - minX, overhang: Math.max(0, -minX), lengthWithArch: L + Math.max(0, -minX),
    panels: b.count, watts: b.count*AC.panel.watts, panelArea: b.area, pipeMm: b.D*1000, steelM: b.steelM, steelKg: b.steelKg, panelKg, totalKg: b.steelKg + panelKg,
    backstayGap: stay - .0045, railGap: surfaceGap(clear, cells, obstacles.rails, obstacles.railCells),
    canvasGap: surfaceGap(clear, cells, obstacles.canvas, obstacles.canvasCells), boomGap: boom,
  };
}

/* ---------- Selection and page panel ---------- */
const archBuilt = {};
const archState = { design: AC.designs[0].id, panels: 3, pipe: AC.pipes[1] };
let currentArch = 'none', lastArch = AC.designs[0].id, archKick = () => {};
const archById = id => AC.designs.find(d => d.id === id);
const num = (v, n) => v.toLocaleString('en-GB', { minimumFractionDigits: n, maximumFractionDigits: n });
const fmtM = v => `${num(v, 2)} m`, fmtCm = v => `${num(v*100, 0)} cm`;
const gapRow = (label, v) => v < AC.contactGap ? [label, 'Contact', 'hit'] : [label, fmtCm(v), v < AC.warnGap ? 'warn' : ''];

function renderArchStats(r) {
  const groups = [
    ['Height', [['Panel top above water', fmtM(r.panelTopAboveWater)], ['Panel top above deck', fmtM(r.panelTopAboveDeck)], ['Headroom on aft deck', fmtM(r.headroom)]]],
    ['Size', [['Width', fmtM(r.width)], ['Length', fmtM(r.length)], ['Overhang past transom', fmtM(r.overhang)], ['Boat length with arch', fmtM(r.lengthWithArch)]]],
    ['Clearance', [gapRow('Backstay', r.backstayGap), gapRow('Rails and pushpit', r.railGap), gapRow('Canvas', r.canvasGap), gapRow('Boom, full swing', r.boomGap)]],
    ['Power and materials', [['Solar power', `${r.panels} × ${AC.panel.watts} W = ${r.watts} W`], ['Panel area', `${num(r.panelArea, 2)} m²`], [`Pipe, ${num(r.pipeMm, 0)} mm`, `${num(r.steelM, 1)} m`], ['Steel weight (est.)', `${num(r.steelKg, 0)} kg`], ['Panel weight (est.)', `${num(r.panelKg, 0)} kg`], ['Total weight (est.)', `${num(r.totalKg, 0)} kg`]]],
  ];
  document.getElementById('archStats').innerHTML = groups.map(([h, rows]) =>
    `<h2>${h}</h2><dl>${rows.map(([k, v, c]) => `<div><dt>${k}</dt><dd${c ? ` class="${c}"` : ''}>${v}</dd></div>`).join('')}</dl>`).join('');
}
function setArch(id, opts = {}) {
  if (opts.panels && AC.panelCounts.includes(opts.panels)) archState.panels = opts.panels;
  if (opts.pipe && AC.pipes.includes(opts.pipe)) archState.pipe = opts.pipe;
  const d = archById(id);
  if (!d) id = 'none';
  Object.values(archBuilt).forEach(b => { b.group.visible = false; });
  currentArch = id; G.asBuilt.visible = !d;
  document.getElementById('archOptions').hidden = !d;
  const stats = document.getElementById('archStats');
  if (d) {
    lastArch = id; archState.design = id;
    const key = `${id}|${archState.panels}|${archState.pipe}`, b = archBuilt[key] || (archBuilt[key] = buildArch(d, archState.panels, archState.pipe));
    b.group.visible = true; currentBuilt = b; renderArchStats(measureArch(b));
  } else { stats.innerHTML = ''; currentBuilt = null; }
  document.getElementById('archCurrent').textContent = d ? `${d.name}, ${archState.panels} panels` : 'No arch';
  document.getElementById('archNote').textContent = d ? d.note : 'The boat as she is today, with the ensign staff and antenna in their original places.';
  [['archDesign', id], ['archPanels', archState.panels], ['archPipe', archState.pipe]].forEach(([n, v]) => { const r = document.querySelector(`input[name="${n}"][value="${v}"]`); if (r) r.checked = true; });
  try { history.replaceState(null, '', d ? `#arch=${id}&panels=${archState.panels}&pipe=${Math.round(archState.pipe*1000)}` : '#arch=none'); } catch (e) { /* not available in some file:// contexts */ }
  archKick();
}
let currentBuilt = null;
function archReport() { return currentBuilt ? measureArch(currentBuilt) : null; }
function initArchUI(kick) {
  archKick = kick;
  const addRadios = (host, name, items, onPick) => items.forEach(([value, label]) => {
    const l = document.createElement('label'), i = document.createElement('input');
    i.type = 'radio'; i.name = name; i.value = value; i.addEventListener('change', () => onPick(value));
    l.append(i, document.createTextNode(label)); document.getElementById(host).append(l);
  });
  addRadios('archPick', 'archDesign', [...AC.designs.map(d => [d.id, d.name]), ['none', 'No arch']], v => setArch(v));
  addRadios('archPanelPick', 'archPanels', AC.panelCounts.map(n => [n, `${n} panels`]), v => setArch(lastArch, { panels: +v }));
  addRadios('archPipePick', 'archPipe', AC.pipes.map(p => [p, `${Math.round(p*1000)} mm`]), v => setArch(lastArch, { pipe: +v }));
  if (innerWidth <= 760) document.getElementById('archPanel').open = false;
  const q = new URLSearchParams(location.hash.slice(1)), h = q.get('arch');
  setArch(h === 'none' ? 'none' : archById(h) ? h : AC.designs[0].id, { panels: +q.get('panels'), pipe: +q.get('pipe')/1000 });
}
