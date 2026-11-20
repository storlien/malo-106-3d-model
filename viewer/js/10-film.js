'use strict';
/* film — se deloverskriftene i filen. */

/* =====================================================================
   FILMMODUS — kinokamera med ulike objektiver. Hvert bilde har en
   brennvidde og en blender; lang linse og åpen blender gir kort
   skarphetsdybde. Bildet etterbehandles: letterbox 2,39:1, glød og
   anamorfe striper fra sola, litt kromatisk aberrasjon, vignett og
   filmkorn.
   ===================================================================== */
let filmActive = false;
const film = { shot:null, t:0, k:null, bag:[], last:null, lock:null, bars:0, cuts:0, capT:0 };
const fP = new V3(), fT = new V3(), fU = new V3(), fQ = new V3(), fF = new V3(), fV = new V3();
const BL = (x, y, z, out) => boat.localToWorld(out.set(x, y, z));
const BUP = out => out.set(0, 1, 0).applyQuaternion(heelPivot.quaternion);
const yawRot = (x, z, out, y) => out.set(x, y || 0, z);
const freeSide = () => -SAIL_WIND;
const heave = () => heelPivot.position.y;
const seaOn = () => oceanU.opacity.value > 0.5;
const pick = a => a[Math.floor(Math.random()*a.length)];
const CINE_SENSOR = 24.9, CINE_ASPECT = 2.39;
const shakeN = (t, s) => Math.sin(t*1.31 + s)*0.55 + Math.sin(t*2.77 + s*1.7)*0.3 + Math.sin(t*5.3 + s*2.9)*0.15;
const SHOTS = [
  { navn:'Drone', dur:11, mm:[24, 35], f:5.6, near:0.3,
    init:() => ({ a:Math.random()*Math.PI*2, r:26 + Math.random()*8, h:8 + Math.random()*5, w:(Math.random() < 0.5 ? -1 : 1)*0.045 }),
    cam:(t, k) => { const a = k.a + t*k.w, r = k.r*(35/k.mm0)**0.6; fP.set(Math.cos(a)*r, k.h + heave() + t*0.3, Math.sin(a)*r); fT.set(0, 3.0 + heave(), 0); fU.set(0, 1, 0); k.roll = 0.03*Math.sin(t*0.4); } },
  { navn:'Drone, forbi', dur:9, mm:[18, 24], f:4, near:0.3, init:() => ({ s:freeSide(), d:13 + Math.random()*5 }),
    cam:(t, k) => { yawRot(26 - 52*t/9, k.s*k.d, fP, 4.5 + heave()); fT.set(0, 2.8 + heave(), 0); fU.set(0, 1, 0); k.roll = -k.s*0.06*Math.sin(t/9*Math.PI); } },
  { navn:'Rett ovenfra', kind:'top', dur:11, mm:[50], f:8, near:1.0, init:() => ({ a:Math.random()*6.28, h:120 + Math.random()*35 }),
    cam:(t, k) => { fP.set(1.2, k.h - t*1.2 + heave(), 0.02); fT.set(0, 0, 0); const a = k.a + t*0.03; fU.set(Math.cos(a), 0, Math.sin(a)); } },
  { navn:'Baugen', dur:9, mm:[8], fish:116, f:8, near:0.03, shake:0.35,
    cam:t => { const zs = -SAIL_WIND*(0.35 + 0.55*sail.p); BL(11.35, 1.9 + 0.04*Math.sin(t*0.7), zs, fP); BL(4.0, 1.5, -zs*0.3, fT); BUP(fU); } },
  { navn:'Masttoppen', kind:'top', dur:8, mm:[16], f:8, near:0.06,
    cam:() => { BL(7.05, 15.7, 0.35, fP); BL(4.5, 1.6, 0, fT); fU.set(1, 0, 0).applyQuaternion(heelPivot.quaternion); } },
  { navn:'Ved rattet', dur:9, mm:[28, 35], f:2.8, near:0.05, shake:0.8,
    cam:() => { BL(2.95, 1.9, 0.55, fP); BL(9.5, 1.6, 0.2, fT); BUP(fU); } },
  { navn:'Følgebåt', dur:9, mm:[35, 50], f:2.8, near:0.3, shake:1.2, init:() => ({ s:freeSide() }),
    cam:(t, k) => { const d = 7*k.mm/35; yawRot(-27*k.mm/35, k.s*(d + 2*Math.sin(t*0.3)), fP, 4.0 + 0.6*heave()); BL(5.6, 2.6, 0, fT); fU.set(0, 1, 0); } },
  { navn:'Lang linse', dur:10, mm:[135, 200], f:2.8, near:1.0, shake:0.25, init:() => ({ s:freeSide(), a:-35 + Math.random()*25 }),
    cam:(t, k) => { const d = 0.7*k.mm, a = (k.a + t*0.8)*Math.PI/180; yawRot(Math.sin(a)*d, k.s*Math.cos(a)*d, fP, 3.0 + heave()); BL(6.0, 3.2, 0, fT); fU.set(0, 1, 0); } },
  { navn:'Lavt over vannet', dur:8, mm:[18], f:4, near:0.04, sea:true, low:true, shake:0.3, init:() => ({ s:freeSide() }),
    cam:(t, k) => { BL(11.4 - t*0.22, 0, k.s*3.8, fP); fP.y = waveH(fP.x, fP.z) + 0.32; BL(0.8, 1.3, k.s*0.5, fT); fU.set(0, 1, 0); k.roll = k.s*0.04; } },
  { navn:'Vertigo', dur:9, mm:[24], f:4, near:0.3, init:() => ({ s:freeSide() }),
    cam:(t, k) => { const e = t/9, m = 24 + (85 - 24)*e*e*(3 - 2*e); k.mm = m; const d = 19*m/24; yawRot(-d*0.18, k.s*d, fP, 2.4 + 0.04*d + heave()); BL(5.6, 2.4, 0, fT); fU.set(0, 1, 0); } },
  { navn:'Drone høyt, langt unna', dur:12, mm:[85], f:5.6, near:1.0, init:() => ({ s:freeSide(), a:0.5 + Math.random()*2.1, d:280 + Math.random()*60, h:110 + Math.random()*40 }),
    cam:(t, k) => { const a = k.a + t*0.006; yawRot(Math.cos(a)*k.d, k.s*Math.sin(a)*k.d, fP, k.h - t*0.8 + heave()); BL(5.6, 2.5, 0, fT); fU.set(0, 1, 0); } },
  { navn:'Drone lavt, langt unna', dur:12, mm:[200], f:4, near:1.0, init:() => ({ s:freeSide(), a:0.4 + Math.random()*2.3, d:210 + Math.random()*60, h:13 + Math.random()*9 }),
    cam:(t, k) => { const a = k.a - t*0.008; yawRot(Math.cos(a)*k.d, k.s*Math.sin(a)*k.d, fP, k.h + 0.4*heave()); BL(5.6, 4.0, 0, fT); fU.set(0, 1, 0); } },
  { navn:'Mot sola', dur:10, mm:[135], f:2.8, near:1.0, shake:0.2, init:() => ({ a:(Math.random() - 0.5)*0.5 }),
    cam:(t, k) => { const sx = sun.position.x, sz = sun.position.z, L = Math.hypot(sx, sz) || 1, d = 0.6*k.mm;
      const c = Math.cos(k.a + t*0.012), s = Math.sin(k.a + t*0.012), ux = -sx/L, uz = -sz/L;
      fP.set((ux*c - uz*s)*d, 2.0 + heave(), (ux*s + uz*c)*d); BL(5.6, 4.2, 0, fT); fU.set(0, 1, 0); } },
];
function nextShot(){
  const ok = s => !s.sea || seaOn();
  if (film.lock && ok(film.lock)){ start(film.lock); return; }
  if (!film.bag.length){ film.bag = SHOTS.filter(ok).sort(() => Math.random() - 0.5); if (film.bag[0] === film.last) film.bag.push(film.bag.shift()); }
  const out = s => s.mm[0] >= 35 || /Drone|ovenfra|Følge|Lang|Vertigo|sola/.test(s.navn);
  const lastKind = film.last && film.last.kind, okKind = s => !lastKind || s.kind !== lastKind;
  let i = film.bag.findIndex(s => okKind(s) && out(s) !== (film.last ? out(film.last) : false));
  if (i < 0) i = film.bag.findIndex(okKind);
  if (i < 0){ film.bag = SHOTS.filter(s => (!s.sea || seaOn()) && okKind(s) && s !== film.last).sort(() => Math.random() - 0.5); i = 0; }
  start(film.bag.splice(i, 1)[0]);
  function start(sh){
    film.shot = sh; film.last = sh; film.t = 0; film.cuts++;
    const mm = pick(sh.mm);
    film.k = Object.assign({ mm, mm0:mm, roll:0 }, sh.init ? sh.init() : {});
    CINE.lens(film.k.mm, sh.f);
    film.dip = film.cuts === 1 || film.cuts % 4 === 0 ? 0.6 : 0;
    showCap();
  }
}
function showCap(){
  if (!film.shot) return;
  CINE.cap(film.shot.navn, film.k.mm, film.shot.f, !!film.shot.fish);
  film.capT = 3.2;
}
function applyFilm(dt){
  if (!filmActive) return;
  film.t += dt;
  if (film.t > film.shot.dur) nextShot();
  const sh = film.shot, k = film.k, t = film.t;
  film.bars = Math.min(1, film.bars + dt/0.9);
  if (film.capT > 0){ film.capT -= dt; if (film.capT <= 0) CINE.capHide(); }
  const fade = film.dip ? Math.max(0, 1 - t/film.dip) : 0;
  heelPivot.updateMatrixWorld(true);
  sh.cam(t, k);
  if (sh.shake && !reduceMotion){
    const a = sh.shake, d = fP.distanceTo(fT);
    fP.x += 0.025*a*shakeN(t, 1); fP.y += 0.02*a*shakeN(t, 2); fP.z += 0.025*a*shakeN(t, 3);
    fT.x += 0.004*a*d*shakeN(t*0.9, 4); fT.y += 0.004*a*d*shakeN(t*0.9, 5); fT.z += 0.004*a*d*shakeN(t*0.9, 6);
  }
  if (oceanU.opacity.value > 0.05){ const hw = waveH(fP.x, fP.z) + (sh.low ? 0.18 : 0.5); if (fP.y < hw) fP.y = hw; }
  cam.position.copy(fP); cam.up.copy(fU).normalize(); cam.lookAt(fT);
  if (k.roll) cam.rotateZ(k.roll);
  const fishA = sh.fish ? (sh.fish/2 + 4)*Math.PI/180 : 0;
  const hf = sh.fish ? 2*fishA : 2*Math.atan(CINE_SENSOR/(2*k.mm)), vf = 2*Math.atan(Math.tan(hf/2)*H/W)*180/Math.PI;
  if (Math.abs(cam.fov - vf) > 1e-3 || Math.abs(cam.near - sh.near) > 1e-3){ cam.fov = vf; cam.near = sh.near; cam.updateProjectionMatrix(); }
  fV.subVectors(fT, fP).normalize();
  fF.copy(fT);
  CINE.focus(Math.max(0.2, fF.sub(fP).dot(fV)), k.mm, film.bars, fade, sh.fish ? { theta:sh.fish/2*Math.PI/180, tanA:Math.tan(fishA) } : null);
}
const shotsEl = document.getElementById('cineChips');
function buildShotChips(){
  shotsEl.innerHTML = '';
  [{ navn:'Bland', shot:null }].concat(SHOTS.filter(s => !s.sea || seaOn()).map(sh => ({ navn:sh.navn, shot:sh }))).forEach(o => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = o.navn; b.setAttribute('aria-pressed', film.lock === o.shot ? 'true' : 'false');
    b.addEventListener('click', ev => { ev.stopPropagation(); film.lock = o.shot; if (o.shot){ film.t = 0; nextShot(); } else { film.bag = []; nextShot(); }
      shotsEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); kick(true); });
    shotsEl.appendChild(b);
  });
}
let filmFS = false;
function startFilm(){
  filmActive = true; root.classList.add('b3d-film');
  const btn = document.getElementById('btnFilm');
  btn.setAttribute('aria-pressed', 'true'); btn.querySelector('span').textContent = 'Avslutt film';
  film.bag = []; film.last = null; film.lock = null; film.bars = reduceMotion ? 1 : 0; film.cuts = 0;
  CINE.show(true); buildShotChips(); shotsEl.hidden = false; nextShot(); cineWake(); kick(true);
}
function stopFilm(){
  shotsEl.hidden = true;
  filmActive = false; root.classList.remove('b3d-film', 'cine-ui'); document.getElementById('fade').classList.remove('on');
  CINE.show(false);
  if (filmFS) toggleFS(false);
  const btn = document.getElementById('btnFilm');
  btn.setAttribute('aria-pressed', 'false'); btn.querySelector('span').textContent = 'Film';
  cam.up.set(0, 1, 0); cam.fov = view.cur.fov; cam.near = clampN(view.cur.r*0.035, 0.06, 2.5); cam.updateProjectionMatrix(); applyCam();
  kick(true);
}
const fsOK = !!(root.requestFullscreen || root.webkitRequestFullscreen);
function toggleFS(on){
  const cur = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (on === undefined) on = !cur;
  if (on && !cur){ const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); filmFS = true; if (p && p.catch) p.catch(() => { filmFS = false; }); }
  else if (!on && cur){ (document.exitFullscreen || document.webkitExitFullscreen).call(document); filmFS = false; }
}
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => {
  const cur = !!(document.fullscreenElement || document.webkitFullscreenElement); if (!cur) filmFS = false;
}));
let wakeT = 0;
function cineWake(){ if (!filmActive) return; root.classList.add('cine-ui'); clearTimeout(wakeT); wakeT = setTimeout(() => root.classList.remove('cine-ui'), 2600); }
['pointermove', 'pointerdown', 'touchstart'].forEach(ev => root.addEventListener(ev, cineWake, { passive:true }));
document.getElementById('btnFilm').addEventListener('click', () => filmActive ? stopFilm() : startFilm());
document.getElementById('cineNext').addEventListener('click', e => { e.stopPropagation(); film.lock = null; nextShot(); cineWake(); });
document.getElementById('cinePrev').addEventListener('click', e => { e.stopPropagation(); film.t = Math.max(0, film.t - 4); cineWake(); });
const capBtn = document.getElementById('cineCapBtn'), capEl = document.getElementById('cineCap');
capBtn.addEventListener('click', e => {
  e.stopPropagation();
  const on = capBtn.getAttribute('aria-pressed') !== 'true';
  capBtn.setAttribute('aria-pressed', String(on)); capBtn.classList.toggle('on', on);
  capEl.style.display = on ? '' : 'none';
});
document.getElementById('cineExit').addEventListener('click', e => { e.stopPropagation(); stopFilm(); });
if (fsOK){
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cine-btn'; b.textContent = 'Fullskjerm';
  b.addEventListener('click', e => { e.stopPropagation(); toggleFS(); });
  document.querySelector('.cine-ctrl').appendChild(b);
}
window.addEventListener('keydown', e => {
  if (!filmActive) return;
  if (e.key === 'Escape') stopFilm();
  else if (e.key === 'f' || e.key === 'F'){ if (fsOK) toggleFS(); }
  else if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N'){ film.lock = null; nextShot(); cineWake(); }
  else return;
  e.preventDefault();
});

/* ---------- Etterbehandling for filmmodus ---------- */
var CINE = (() => {
  let ready = false, failed = false, texS = null, rtD = null, rtA = null, rtB = null, rtS = null, qS = null, qC = null, quad = null, mats = null, depthMat = null, bw = 0, bh = 0;
  const L = { mm:35, f:4, focus:20, bars:0, fade:0 };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  function mk(fs, uniforms, defines){ return new T.ShaderMaterial({ vertexShader:VS, fragmentShader:fs, uniforms, defines:defines || {}, depthTest:false, depthWrite:false }); }
  function init(){
    if (ready || failed) return ready;
    try {
      const g = new T.PlaneGeometry(2, 2); quad = new T.Mesh(g); quad.frustumCulled = false;
      qS = new T.Scene(); qS.add(quad); qC = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      depthMat = new T.MeshDepthMaterial({ depthPacking:T.RGBADepthPacking });
      const u = {
        tScene:{ value:null }, tDepth:{ value:null }, tGlow:{ value:null }, tStreak:{ value:null }, res:{ value:new V2(1, 1) },
        cNear:{ value:0.1 }, cFar:{ value:6000 }, mm:{ value:35 }, fstop:{ value:4 }, focusD:{ value:20 }, maxCoC:{ value:12 },
        fish:{ value:0 }, fishTheta:{ value:1 }, fishTanA:{ value:1 }, band:{ value:1 }, ca:{ value:0 }, distort:{ value:0 }, vig:{ value:0.3 }, grain:{ value:0.04 }, time:{ value:0 }, fade:{ value:0 }, flare:{ value:1 },
        bgTop:{ value:new T.Color() }, bgBot:{ value:new T.Color() }
      };
      mats = {
        bright:mk(`uniform sampler2D tSrc; uniform vec2 px; varying vec2 vUv;
          void main(){ vec3 c = (texture2D(tSrc, vUv + px*vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + px*vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + px*vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + px*vec2(1.0, 1.0)).rgb)*0.25;
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); gl_FragColor = vec4(c*smoothstep(0.86, 1.0, l)*smoothstep(0.86, 1.0, max(c.r, max(c.g, c.b))), 1.0); }`, { tSrc:{ value:null }, px:{ value:new V2() } }),
        streak:mk(`uniform sampler2D tSrc; uniform vec2 px; varying vec2 vUv;
          void main(){ vec3 c = vec3(0.0); float ws = 0.0;
            for (int i = -24; i <= 24; i++){ float x = float(i), w = exp(-abs(x)/8.0); c += texture2D(tSrc, vUv + vec2(x*px.x*2.0, 0.0)).rgb*w; ws += w; }
            gl_FragColor = vec4(c/ws*1.7, 1.0); }`, { tSrc:{ value:null }, px:{ value:new V2() } }),
        blur:mk(`uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
          void main(){ vec3 c = texture2D(tSrc, vUv).rgb*0.227;
            c += (texture2D(tSrc, vUv + dir*1.385).rgb + texture2D(tSrc, vUv - dir*1.385).rgb)*0.316;
            c += (texture2D(tSrc, vUv + dir*3.231).rgb + texture2D(tSrc, vUv - dir*3.231).rgb)*0.07;
            gl_FragColor = vec4(c, 1.0); }`, { tSrc:{ value:null }, dir:{ value:new V2() } }),
        comp:mk(`#include <packing>
          uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tGlow; uniform sampler2D tStreak;
          uniform vec2 res; uniform float cNear; uniform float cFar; uniform float mm; uniform float fstop; uniform float focusD; uniform float maxCoC;
          uniform float fish; uniform float fishTheta; uniform float fishTanA; uniform float band; uniform float ca; uniform float distort; uniform float vig; uniform float grain; uniform float time; uniform float fade; uniform float flare;
          uniform vec3 bgTop; uniform vec3 bgBot;
          varying vec2 vUv;
          float dist(vec2 uv){ return -perspectiveDepthToViewZ(unpackRGBAToDepth(texture2D(tDepth, uv)), cNear, cFar); }
          float coc(float D){ float f = mm, S = max(focusD*1000.0, f*2.0), Dm = max(D*1000.0, 1.0);
            return min(f*f/(fstop*(S - f))*abs(Dm - S)/Dm/24.9*res.x, maxCoC); }
          float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
          void main(){
            float asp = res.x/res.y, yb = abs(vUv.y - 0.5)*2.0;
            if (yb > band){ gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
            vec2 p = (vUv - 0.5)*vec2(asp, 1.0);
            float r2 = dot(p, p)/(0.25*asp*asp + 0.25);
            vec2 uv = 0.5 + (vUv - 0.5)*(1.0 + distort*r2)/(1.0 + distort*0.55);
            if (fish > 0.5){
              vec2 q = (vUv - 0.5)*vec2(2.0, 2.0/asp);
              float rho = length(q), th = min(rho*fishTheta, 1.5), rn = tan(th)/fishTanA;
              uv = 0.5 + (rho > 1e-5 ? q/rho*rn : vec2(0.0))*vec2(0.5, 0.5*asp);
            }
            float D0 = dist(uv), c0 = coc(D0), R = max(c0, 0.5*maxCoC);
            vec2 cd = normalize(p + 1e-5)*ca*r2/res;
            vec4 cs = texture2D(tScene, uv); cs.r = texture2D(tScene, uv + cd).r; cs.b = texture2D(tScene, uv - cd).b;
            vec4 acc = cs; float ws = 1.0;
            for (int i = 0; i < TAPS; i++){
              float fi = float(i) + 0.5, r = sqrt(fi/float(TAPS))*R, a = fi*2.39996323;
              vec2 su = uv + vec2(cos(a), sin(a))*r/res;
              float Di = dist(su), ci = coc(Di), cc = Di > D0 ? min(ci, c0) : ci;
              float w = clamp(cc - r + 1.0, 0.0, 1.0);
              acc += texture2D(tScene, su)*w; ws += w;
            }
            vec4 col = acc/ws;
            vec3 c = col.rgb + mix(bgBot, bgTop, vUv.y)*(1.0 - col.a);
            c += texture2D(tGlow, uv).rgb*0.3 + texture2D(tStreak, uv).rgb*vec3(0.45, 0.68, 1.1)*flare;
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(l), c, 0.9);
            c += vec3(-0.018, 0.004, 0.028)*(1.0 - smoothstep(0.0, 0.5, l)) + vec3(0.032, 0.012, -0.022)*smoothstep(0.45, 1.0, l);
            c = clamp(c, 0.0, 1.0); c = mix(c, c*c*(3.0 - 2.0*c), 0.32);
            c *= 1.0 - vig*smoothstep(0.2, 1.2, r2);
            float g = hash(vUv*res + fract(time*7.31)*91.7) - 0.5;
            c += g*grain*(0.55 + 0.45*(1.0 - l));
            c *= 1.0 - fade;
            float edge = smoothstep(band, band - 2.0/res.y, yb);
            gl_FragColor = vec4(c*edge, 1.0);
          }`, u, { TAPS:Math.min(QUAL.level.taps, coarse ? 14 : 28) })
      };
      ready = true;
    } catch (e) { failed = true; console.warn('Filmeffekter er slått av:', e); }
    return ready;
  }
  const v2 = new V2(), ZERO = new V2(0, 0), cc = new T.Color();
  function size(){
    renderer.getDrawingBufferSize(v2);
    const w = Math.max(4, Math.floor(v2.x)), h = Math.max(4, Math.floor(v2.y));
    if (w === bw && h === bh) return;
    bw = w; bh = h;
    [texS, rtD, rtA, rtB, rtS].forEach(o => o && o.dispose());
    texS = new T.DataTexture(null, w, h, T.RGBAFormat); texS.minFilter = texS.magFilter = T.LinearFilter; texS.generateMipmaps = false; texS.needsUpdate = true;
    rtD = new T.WebGLRenderTarget(Math.ceil(w/2), Math.ceil(h/2), { minFilter:T.NearestFilter, magFilter:T.NearestFilter });
    const q = { minFilter:T.LinearFilter, magFilter:T.LinearFilter, depthBuffer:false };
    rtA = new T.WebGLRenderTarget(Math.ceil(w/4), Math.ceil(h/4), q); rtB = new T.WebGLRenderTarget(Math.ceil(w/4), Math.ceil(h/4), q); rtS = new T.WebGLRenderTarget(Math.ceil(w/4), Math.ceil(h/4), q);
  }
  function pass(m, target){ quad.material = m; renderer.setRenderTarget(target); renderer.render(qS, qC); }
  function render(){
    if (!init()){ renderer.render(scene, cam); return; }
    size();
    renderer.render(scene, cam);
    renderer.copyFramebufferToTexture(ZERO, texS);
    renderer.getClearColor(cc); const ca0 = renderer.getClearAlpha();
    scene.overrideMaterial = depthMat; renderer.setRenderTarget(rtD); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, cam); scene.overrideMaterial = null;
    renderer.setClearColor(0x000000, 1);
    const m = mats, qx = 1/bw, qy = 1/bh;
    m.bright.uniforms.tSrc.value = texS; m.bright.uniforms.px.value.set(qx, qy); pass(m.bright, rtA);
    m.streak.uniforms.tSrc.value = rtA.texture; m.streak.uniforms.px.value.set(4/bw, 4/bh); pass(m.streak, rtS);
    m.blur.uniforms.tSrc.value = rtA.texture; m.blur.uniforms.dir.value.set(4/bw, 0); pass(m.blur, rtB);
    m.blur.uniforms.tSrc.value = rtB.texture; m.blur.uniforms.dir.value.set(0, 4/bh); pass(m.blur, rtA);
    const u = m.comp.uniforms;
    u.tScene.value = texS; u.tDepth.value = rtD.texture; u.tGlow.value = rtA.texture; u.tStreak.value = rtS.texture;
    u.res.value.set(bw, bh); u.cNear.value = cam.near; u.cFar.value = cam.far; u.time.value = performance.now()/1000;
    u.mm.value = L.mm; u.fstop.value = L.f; u.focusD.value = L.focus; u.maxCoC.value = Math.max(2, bw*0.008);
    const wide = Math.max(0, Math.min(1, (28 - L.mm)/14));
    const fe = L.fish ? 1 : 0; u.fish.value = fe; if (L.fish){ u.fishTheta.value = L.fish.theta; u.fishTanA.value = L.fish.tanA; }
    u.distort.value = fe ? 0 : 0.16*wide*wide; u.ca.value = (0.6 + 2.2*wide + 1.2*fe)*bw/1600; u.vig.value = 0.28 + 0.22*wide + 0.3*fe; u.flare.value = 0.8 + 0.5*Math.min(1, L.mm/135);
    u.grain.value = reduceMotion ? 0.02 : 0.045;
    u.band.value = 1 - L.bars*(1 - Math.min(1, (W/CINE_ASPECT)/H)); u.fade.value = L.fade;
    pass(m.comp, null);
    renderer.setRenderTarget(null);
    renderer.setClearColor(cc, ca0);
  }
  function readBg(){
    const cs = getComputedStyle(root), top = cs.getPropertyValue('--sea-top').trim() || '#c8d8e1', bot = cs.getPropertyValue('--sea-bottom').trim() || '#edf2f4';
    if (mats){ mats.comp.uniforms.bgTop.value.set(top); mats.comp.uniforms.bgBot.value.set(bot); }
  }
  return {
    on:() => filmActive && !failed,
    render,
    show(on){ document.getElementById('cineHud').classList.toggle('show', on); if (on){ init(); readBg(); } else { capEl.classList.remove('on'); } },
    lens(mm, f){ L.mm = mm; L.f = f; },
    taps(n){ n = Math.min(n, coarse ? 14 : 28); if (mats && mats.comp.defines.TAPS !== n){ mats.comp.defines.TAPS = n; mats.comp.needsUpdate = true; } },
    focus(d, mm, bars, fade, fish){ L.focus = d; L.mm = mm; L.bars = bars; L.fade = fade; L.fish = fish; },
    cap(name, mm, f, fish){ document.getElementById('capTitle').textContent = name; document.getElementById('capSub').textContent = `${Math.round(mm)} mm${fish ? ' fiskeøye' : ''}, f/${String(f).replace('.', ',')}`; capEl.classList.add('on'); },
    capHide(){ capEl.classList.remove('on'); }
  };
})();

