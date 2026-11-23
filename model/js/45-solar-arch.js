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

function buildArch(d) {
  const group = new T.Group(), frame = new T.Group(), extras = new T.Group();
  group.add(frame, extras); group.visible = false; G.arch.add(group);
  let steelKg = 0;
  const kgPerM = D => Math.PI*(D - AC.wall)*AC.wall*7980;
  const pipe = (pts, D, seg = 12) => {
    for (let i = 0; i < pts.length - 1; i++) steelKg += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2])*kgPerM(D);
    return pts.length === 2 ? rod(frame, pts[0], pts[1], D/2, mat.steel, seg) : tube(frame, pts, D/2, mat.steel, false, seg);
  };
  const footPlate = (p, D) => {
    const plate = put(frame, new T.CylinderGeometry(.062, .068, .012, 22), mat.steel); plate.position.set(p[0], p[1] + .006, p[2]);
    const socket = put(frame, new T.CylinderGeometry(D/2 + .006, D/2 + .009, .06, 18), mat.steel); socket.position.set(p[0], p[1] + .035, p[2]);
  };

  // main hoop
  const H = d.hoop, fy = deckY(H.footX, H.footHalf);
  const onHoop = y => lerp(H.footX, H.topX, (y - fy)/(H.topY - fy));
  const side = s => {
    const pts = [[H.footX, fy, s*H.footHalf]], yS = H.topY - H.bend;
    for (let i = 1; i <= 5; i++) { const f = i/5, y = lerp(fy, yS, f); pts.push([onHoop(y), y, s*lerp(H.footHalf, H.half, f)]); }
    for (let i = 1; i <= 8; i++) { const a = i/8*Math.PI/2, y = yS + H.bend*Math.sin(a); pts.push([onHoop(y), y, s*(H.half - H.bend + H.bend*Math.cos(a))]); }
    return pts;
  };
  pipe([...side(-1), [H.topX, H.topY, 0], ...side(1).reverse()], AC.tube, 14);

  // carrier rails under the panel edges, closed by two cross tubes
  const yRail = d.panelY - AC.panelThick/2 - AC.rail/2;
  const fwd = Math.max(...d.panels.map(q => q[0])), aft = Math.min(...d.panels.map(q => q[1]));
  const halfW = Math.max(...d.panels.flatMap(q => [Math.abs(q[2]), Math.abs(q[3])]));
  const edges = d.panels.flatMap(q => [q[2], q[3]]).sort((a, b) => a - b).reduce((o, z) => {
    if (o.length && z - o[o.length - 1] < .06) o[o.length - 1] = (o[o.length - 1] + z)/2; else o.push(z); return o;
  }, []);
  edges.forEach(z => {
    pipe([[fwd, yRail, z], [aft, yRail, z]], AC.rail);
    pipe([[H.topX, H.topY, Math.sign(z)*Math.min(Math.abs(z), H.half - H.bend*.3)], [H.topX, yRail, z]], AC.rail*.8, 10);
  });
  [fwd, aft].forEach(x => pipe([[x, yRail, -halfW], [x, yRail, halfW]], AC.rail));

  const A = d.aftStrut;
  [1, -1].forEach(s => {
    const f = [A.footX, deckY(A.footX, A.footHalf), s*A.footHalf];
    pipe([f, [A.topX, yRail, s*halfW]], AC.strut);
    footPlate(f, AC.strut); footPlate([H.footX, fy, s*H.footHalf], AC.tube);
    if (d.foreStrut) {
      const q = d.foreStrut, b = [q.footX, deckY(q.footX, q.footHalf), s*q.footHalf];
      pipe([b, [fwd, yRail, s*halfW]], AC.strut); footPlate(b, AC.strut);
    }
    if (d.davits) {
      const v = d.davits, z = s*v.z, a = [H.topX, H.topY - .01, z], m = [lerp(H.topX, v.tipX, .55), lerp(H.topY, v.tipY, .3), z], t = [v.tipX, v.tipY, z];
      pipe([a, m, [lerp(v.tipX, H.topX, .08), v.tipY + .05, z], t], AC.tube, 12);
      pipe([m, [lerp(A.footX, A.topX, .72), lerp(f[1], yRail, .72), s*lerp(A.footHalf, halfW, .72)]], AC.rail);
      const sheave = put(frame, new T.CylinderGeometry(.04, .04, .025, 18), mat.dark); sheave.rotation.x = Math.PI/2; sheave.position.set(v.tipX, v.tipY - .035, z);
    }
  });

  // panels, framed in anodised aluminium
  let area = 0;
  d.panels.forEach(([f, a, z0, z1]) => {
    const len = f - a, w = z1 - z0, xc = (f + a)/2, zc = (z0 + z1)/2; area += len*w;
    box(frame, [xc, d.panelY, zc], [len, AC.panelThick, w], mat.alu);
    const face = put(frame, new T.PlaneGeometry(len - .03, w - .03), mat.cell, false);
    face.rotation.x = -Math.PI/2; face.position.set(xc, d.panelY + AC.panelThick/2 + .001, zc);
  });

  // ensign under the panels, antenna on the port shoulder
  ensign(extras, AC.ensign.base, AC.ensign.tip);
  const yA = H.topY - H.bend - .05;
  antenna(extras, [onHoop(yA), yA, -H.half - .005], [onHoop(yA) - .02, yA + .44, -H.half - .12]);
  return { d, group, frame, area, steelKg };
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
  const cells = toCells(clear), panelKg = b.area*AC.panelKgPerM2;
  return b.report = {
    panelTopAboveWater: top - HS.floatSink, panelTopAboveDeck: top - deckY(.3, 0), headroom: head,
    width: maxZ - minZ, length: maxX - minX, overhang: Math.max(0, -minX), lengthWithArch: L + Math.max(0, -minX),
    panelArea: b.area, estimatedWp: b.area*AC.wattPerM2, steelKg: b.steelKg, panelKg, totalKg: b.steelKg + panelKg,
    backstayGap: stay - .0045, railGap: surfaceGap(clear, cells, obstacles.rails, obstacles.railCells),
    canvasGap: surfaceGap(clear, cells, obstacles.canvas, obstacles.canvasCells), boomGap: boom,
  };
}

/* ---------- Selection and page panel ---------- */
const archBuilt = {};
let currentArch = 'none', lastArch = AC.designs[0].id, archKick = () => {};
const archById = id => AC.designs.find(d => d.id === id);
const nb = (v, n) => v.toLocaleString('nb-NO', { minimumFractionDigits: n, maximumFractionDigits: n });
const fmtM = v => `${nb(v, 2)} m`, fmtCm = v => `${nb(v*100, 0)} cm`;

function renderArchStats(r) {
  const groups = [
    ['Høyde', [['Paneltopp over vannet', fmtM(r.panelTopAboveWater)], ['Paneltopp over dekk', fmtM(r.panelTopAboveDeck)], ['Fri høyde på akterdekket', fmtM(r.headroom)]]],
    ['Størrelse', [['Bredde', fmtM(r.width)], ['Lengde', fmtM(r.length)], ['Overheng bak akterspeilet', fmtM(r.overhang)], ['Båtlengde med bue', fmtM(r.lengthWithArch)]]],
    ['Klaring', [['Akterstag', r.backstayGap], ['Rekker og pushpit', r.railGap], ['Kalesje', r.canvasGap], ['Bom, hele svingen', r.boomGap]].map(([k, v]) => [k, fmtCm(v), v < AC.warnGap])],
    ['Effekt og vekt (anslag)', [['Panelareal', `${nb(r.panelArea, 2)} m²`], ['Effekt', `${nb(Math.round(r.estimatedWp/10)*10, 0)} Wp`], ['Stålramme', `${nb(r.steelKg, 0)} kg`], ['Paneler', `${nb(r.panelKg, 0)} kg`], ['Totalt', `${nb(r.totalKg, 0)} kg`]]],
  ];
  document.getElementById('archStats').innerHTML = groups.map(([h, rows]) =>
    `<h2>${h}</h2><dl>${rows.map(([k, v, warn]) => `<div><dt>${k}</dt><dd${warn ? ' class="warn"' : ''}>${v}</dd></div>`).join('')}</dl>`).join('');
}
function setArch(id) {
  const d = archById(id);
  if (!d) id = 'none';
  Object.values(archBuilt).forEach(b => { b.group.visible = false; });
  currentArch = id; G.asBuilt.visible = !d;
  const stats = document.getElementById('archStats');
  if (d) { lastArch = id; const b = archBuilt[id] || (archBuilt[id] = buildArch(d)); b.group.visible = true; renderArchStats(measureArch(b)); }
  else stats.innerHTML = '';
  document.getElementById('archCurrent').textContent = d ? d.name : 'Uten bue';
  document.getElementById('archNote').textContent = d ? d.note : 'Båten slik den er i dag, med flaggstang og antenne på opprinnelig plass.';
  const r = document.querySelector(`input[name="archDesign"][value="${id}"]`); if (r) r.checked = true;
  try { history.replaceState(null, '', d ? `#bue=${id}` : '#bue=ingen'); } catch (e) { /* file:// in some browsers */ }
  archKick();
}
function archReport() { const b = archBuilt[currentArch]; return b ? measureArch(b) : null; }
function initArchUI(kick) {
  archKick = kick;
  const pick = document.getElementById('archPick');
  [...AC.designs.map(d => [d.id, d.name]), ['none', 'Uten bue']].forEach(([id, name]) => {
    const l = document.createElement('label'), i = document.createElement('input');
    i.type = 'radio'; i.name = 'archDesign'; i.value = id; i.addEventListener('change', () => setArch(id));
    l.append(i, document.createTextNode(name)); pick.append(l);
  });
  if (innerWidth <= 760) document.getElementById('archPanel').open = false;
  const h = (location.hash.match(/bue=([\w-]+)/) || [])[1];
  setArch(h === 'ingen' ? 'none' : archById(h) ? h : AC.designs[0].id);
}
