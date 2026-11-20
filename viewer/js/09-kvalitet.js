'use strict';
/* kvalitet — se deloverskriftene i filen. */

/* =====================================================================
   GRAFIKKVALITET — Høy, Middels og Lav (lagres i nettleseren),
   pluss strømsparing som holder seg på høyst 30 bilder i sekundet.
   ===================================================================== */
const QUAL = (() => {
  const LV = {
    hoy:     { navn:'Høy',     pr:2,   shadow:2048, ocean:0, taps:28, info:'Full kvalitet — skarpe skygger og full oppløsning.' },
    middels: { navn:'Middels', pr:1.5, shadow:1024, ocean:0, taps:14, info:'Litt lavere oppløsning og mindre skygger.' },
    lav:     { navn:'Lav',     pr:1,   shadow:512,  ocean:1, taps:6,  info:'Lavest oppløsning, minst skygger og enklere hav.' }
  };
  const ORDER = ['lav', 'middels', 'hoy'], KEY = 'alizee-kvalitet', SAVEKEY = 'alizee-sparstrom';
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
  let key = phone ? 'middels' : 'hoy';
  let save30 = false;
  try { const k = localStorage.getItem(KEY); if (LV[k]) key = k; save30 = localStorage.getItem(SAVEKEY) === '1'; } catch (e) {}
  let lastDraw = 0;
  const Q = {
    busy:true,
    get key(){ return key; }, get level(){ return LV[key]; }, LV, ORDER,
    skip(now){
      if (save30 && now - lastDraw < 1000/30 - 3) return true;
      lastDraw = now; return false;
    },
    set(k, save = true){
      if (!LV[k]) return;
      key = k;
      if (save) try { localStorage.setItem(KEY, k); } catch (e) {}
      apply(); syncUI();
    }
  };
  function apply(){
    const L = LV[key];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, L.pr));
    resize();
    if (sun.shadow.mapSize.x !== L.shadow){
      sun.shadow.mapSize.set(L.shadow, L.shadow);
      if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }
      shadowDirty = true;
    }
    oceanU.lowQ.value = L.ocean;
    if (typeof CINE !== 'undefined') CINE.taps(L.taps);
    kick(true);
  }
  const btn = document.getElementById('btnQ'), pop = document.getElementById('qpop'), lab = document.getElementById('qLabel'),
        range = document.getElementById('qRange'), info = document.getElementById('qInfo'), eco = document.getElementById('qEco');
  function syncUI(){
    const L = LV[key];
    lab.textContent = L.navn;
    range.value = ORDER.indexOf(key);
    range.setAttribute('aria-valuetext', L.navn);
    info.textContent = L.info;
  }
  function openPop(on){ pop.hidden = !on; btn.setAttribute('aria-expanded', String(on)); }
  btn.addEventListener('click', e => { e.stopPropagation(); openPop(pop.hidden); });
  range.addEventListener('input', () => Q.set(ORDER[+range.value]));
  eco.checked = save30;
  eco.addEventListener('change', () => { save30 = eco.checked; try { localStorage.setItem(SAVEKEY, save30 ? '1' : '0'); } catch (e) {} });
  pop.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { if (!pop.hidden) openPop(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden){ openPop(false); btn.focus(); } });
  apply(); syncUI();
  return Q;
})();

/* ---------- Teller for bilder i sekundet ---------- */
const FPS = (() => {
  const KEY = 'alizee-fps';
  const el = document.getElementById('fps'), num = document.getElementById('fpsN'), lab = document.getElementById('fpsQ'), dot = el.querySelector('i');
  let on = false, n = 0, t0 = performance.now(), worst = 0, lastT = 0;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
  // bryter for tellingen legges inn i kvalitetspopupen
  const wrap = document.createElement('label');
  wrap.className = 'b3d-qcheck';
  const chk = document.createElement('input'); chk.type = 'checkbox';
  wrap.appendChild(chk); wrap.appendChild(document.createTextNode(' Vis FPS-teller'));
  document.getElementById('qpop').appendChild(wrap);
  function show(v, save = true){
    on = v; el.hidden = !on; n = 0; t0 = performance.now(); worst = 0; lastT = 0;
    chk.checked = on; lab.textContent = QUAL.level.navn;
    if (save) try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
  }
  chk.addEventListener('change', () => show(chk.checked));
  setInterval(() => {
    if (!on) return;
    const t = performance.now(), dt = t - t0;
    if (n === 0 && lastT && t - lastT < 2500){ num.textContent = '<2'; lab.textContent = 'svært tregt'; dot.style.background = '#d9534f'; }
    else if (n === 0){ num.textContent = '0'; lab.textContent = 'står stille'; dot.style.background = 'var(--ink-2)'; }
    else {
      const fps = n*1000/dt;
      num.textContent = Math.round(fps);
      lab.textContent = QUAL.level.navn;
      dot.style.background = fps >= 45 ? '#3fae6a' : fps >= 25 ? '#e0a526' : '#d9534f';
    }
    n = 0; t0 = t;
  }, 500);
  show(on, false);
  return { drew(now){ if (!on) return; n++; if (lastT) worst = Math.max(worst, now - lastT); lastT = now; }, show };
})();

/* ---------- Meldinger nederst på skjermen ---------- */
let toastT = 0;
function toast(msg, ms){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms || 2800);
}

/* ---------- Byggeskiltet: Om båten ---------- */
(function plate(){
  const el = document.getElementById('plate'), btn = document.getElementById('btnPlate'), close = document.getElementById('plateClose');
  const open = v => { el.hidden = !v; btn.setAttribute('aria-expanded', String(v)); };
  btn.addEventListener('click', e => { e.stopPropagation(); open(el.hidden); });
  close.addEventListener('click', () => open(false));
  el.addEventListener('click', e => { if (e.target === el) open(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) open(false); });
})();

/* ---------- Seilknappen: seil opp og seil ned ---------- */
function setSailing(on){
  sail.goal = on ? 1 : 0;
  if (on) motorOnly = false;
  const btn = document.getElementById('btnSail');
  btn.setAttribute('aria-pressed', String(on));
  btn.querySelector('span').textContent = on ? 'Ta ned seilene' : 'La oss seile';
  if (reduceMotion){ sail.p = sail.goal; sideS.v = SAIL_WIND; applySail(); applyScene(); }
  kick(true);
}
document.getElementById('btnSail').addEventListener('click', () => setSailing(sail.goal < 0.5));
if (reduceMotion){ view.cur.t.copy(view.goal.t); }
