'use strict';
/* kamera — se deloverskriftene i filen. */

/* =====================================================================
   KAMERA OG KONTROLLER — dreie med én finger, flytte med to (eller
   høyreklikk), snele med hjul eller klype. Kameraet glir mot målet,
   og starter med et rolig innflyvingsbilde av båten.
   ===================================================================== */
let dirty = true, shadowDirty = true;
function kick(keep){ dirty = true; if (keep === true) shadowDirty = true; }

let W = 1, H = 1;
function resize(){
  const rc = root.getBoundingClientRect();
  W = Math.max(1, rc.width); H = Math.max(1, rc.height);
  renderer.setSize(W, H, false);
  cam.aspect = W/H; cam.updateProjectionMatrix();
  kick();
}
new ResizeObserver(resize).observe(root);
resize();

const view = {
  cur:  { r:58, phi:1.34, theta:-2.3, fov:38, t:new V3(0, 2.6, 0) },
  goal: { r:27, phi:1.16, theta:-0.85, fov:38, t:new V3(0, 2.6, 0) },
};
if (reduceMotion) Object.assign(view.cur, { r:27, phi:1.16, theta:-0.85 });
const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const portrait = () => W/H < 0.85;
const fitR = r => r * (portrait() ? Math.min(2.1, 0.95/(W/H)) : 1);
const maxR = () => sail.goal > 0 ? 110 : 60;
function applyCam(){
  const c = view.cur, sp = Math.sin(c.phi);
  cam.position.set(c.t.x + c.r*sp*Math.sin(c.theta), c.t.y + camLift + c.r*Math.cos(c.phi), c.t.z + c.r*sp*Math.cos(c.theta));
  cam.lookAt(c.t.x, c.t.y + camLift, c.t.z);
  if (camWaterCheck && oceanU.opacity.value > 0.05){
    const hw = waveH(cam.position.x, cam.position.z) + 1.6;
    if (cam.position.y < hw){ cam.position.y = hw; cam.lookAt(c.t.x, c.t.y + camLift, c.t.z); }
  }
}
function stepView(dt){
  const k = reduceMotion ? 1 : 1 - Math.exp(-dt*(dragging ? 14 : 5.5));
  let moving = false;
  ['r','phi','theta','fov'].forEach(key => {
    const d = view.goal[key] - view.cur[key];
    if (Math.abs(d) > 1e-4){ view.cur[key] += d*k; moving = true; } else view.cur[key] = view.goal[key];
  });
  const dv = view.goal.t.clone().sub(view.cur.t);
  if (dv.lengthSq() > 1e-8){ view.cur.t.addScaledVector(dv, k); moving = true; } else view.cur.t.copy(view.goal.t);
  if (typeof filmActive !== 'undefined' && filmActive) return moving;
  const near = clampN(view.cur.r*0.035, 0.06, 2.5);
  if (Math.abs(cam.fov - view.cur.fov) > 1e-4 || Math.abs(cam.near - near) > 1e-3){ cam.fov = view.cur.fov; cam.near = near; cam.updateProjectionMatrix(); }
  applyCam();
  return moving;
}
const ptrs = new Map();
let drag = null, dragging = false;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (typeof filmActive !== 'undefined' && filmActive){ if (typeof cineWake === 'function') cineWake(); return; }
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (ptrs.size === 1){
    drag = { mode:(e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey) ? 'pan' : 'rot', x:e.clientX, y:e.clientY, moved:0 };
    hint.classList.add('off');
  } else if (ptrs.size === 2){
    const [a, b] = [...ptrs.values()];
    drag = { mode:'pinch', d:Math.hypot(a.x-b.x, a.y-b.y), x:(a.x+b.x)/2, y:(a.y+b.y)/2, moved:99 };
  }
  dragging = true;
});
function pan(dx, dy){
  const s = view.cur.r * Math.tan(cam.fov*Math.PI/360) * 2 / H;
  const right = new V3().setFromMatrixColumn(cam.matrix, 0), up = new V3().setFromMatrixColumn(cam.matrix, 1);
  const t = view.goal.t.addScaledVector(right, -dx*s).addScaledVector(up, dy*s);
  t.set(clampN(t.x, -9, 9), clampN(t.y, -2, 12), clampN(t.z, -6, 6));
}
canvas.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (!drag) return;
  if (drag.mode === 'pinch'){
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x-b.x, a.y-b.y), cx = (a.x+b.x)/2, cy = (a.y+b.y)/2;
    if (drag.d > 0) view.goal.r = clampN(view.goal.r * drag.d / Math.max(d, 1), 3, maxR());
    pan(cx-drag.x, cy-drag.y);
    drag.d = d; drag.x = cx; drag.y = cy;
  } else {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.mode === 'rot'){
      view.goal.theta -= dx * 2*Math.PI / H * 0.75;
      view.goal.phi = clampN(view.goal.phi - dy * Math.PI / H * 0.9, 0.002, 1.72);
    } else pan(dx, dy);
  }
  kick();
});
function endPtr(e){
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size === 1){ const [p] = [...ptrs.values()]; drag = { mode:'rot', x:p.x, y:p.y, moved:99 }; }
  else if (ptrs.size === 0){ drag = null; dragging = false; }
}
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (typeof filmActive !== 'undefined' && filmActive) return;
  view.goal.r = clampN(view.goal.r * Math.exp(e.deltaY * 0.0012), 3, maxR());
  kick();
}, { passive:false });

