'use strict';
/* hoved — se deloverskriftene i filen. */

/* =====================================================================
   HOVEDLØKKE — seilene glir opp, været glir mot målet, båten følger
   sjøen, og bildet tegnes bare når noe har endret seg (havet lever).
   ===================================================================== */
function stepSail(dt){
  let moving = false;
  if (Math.abs(sail.goal - sail.p) > 1e-4){
    const rate = reduceMotion ? 1 : dt/4.5;
    sail.p = sail.goal > sail.p ? Math.min(sail.goal, sail.p + rate) : Math.max(sail.goal, sail.p - rate);
    moving = true;
  }
  return moving;
}
applySail();
applyScene();
applyCam();
let last = performance.now();
function frame(now){
  if (QUAL.skip(now)){ requestAnimationFrame(frame); return; }
  const dt = Math.min(0.05, (now - last)/1000); last = now;
  const moving = stepView(dt);
  const sailing = stepSail(dt);
  if (!reduceMotion){
    envClock += dt;
    oceanU.time.value = envClock;
    const spd = boatSpeed(wxDerived())*((sail.p > 0.02 || motorOnly) ? 1 : 0);
    oceanU.drift.value += dt*spd;
  }
  stepWeather(dt);
  applyScene();
  if (sail.p > 0.001){ if (!reduceMotion) sail.t += dt; applySail(); }
  else if (sailing) applySail();
  applyFilm(dt);
  if (sky.visible) sky.position.copy(cam.position);
  stars.visible = sky.visible && wxU.dayF.value < 0.32;
  if (stars.visible){ stars.position.copy(cam.position); starU.opacity.value = skyU.opacity.value; starU.time.value = performance.now()/1000; starU.px.value = renderer.getPixelRatio(); }
  if (sailing && (sail.p !== sail.goal || (sail.frame = (sail.frame + 1) % 3) === 0)) shadowDirty = true;
  const live = !reduceMotion;
  QUAL.busy = moving || live || filmActive || sailing;
  if (moving || dirty || live || filmActive || sailing){
    FPS.drew(now);
    if (shadowDirty){ renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    if (CINE.on()) CINE.render(); else renderer.render(scene, cam);
    dirty = false;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- Api for utsida: AIS, vær og lignende kan styre modellen ---------- */
window.alizee = {
  seil: on => on === undefined ? sail.goal > 0 : setSailing(!!on),
  setState, getState, setWeather,
  film: on => on === false ? (filmActive && stopFilm()) : (!filmActive && startFilm()),
  weather: () => Object.assign({}, WXT)
};
