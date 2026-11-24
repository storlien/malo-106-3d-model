/* ===== Interior, part 3: the viewer =====
   An "Interior" button opens it in place of the solar arch panel. The cutaway lifts the deck off; the other
   places put the camera at standing eye height inside, where dragging looks around. */
(function interiorViewer() {
  const A = window.alizee, off = { x: -L/2, y: -SPEC.hull.floatSink };
  const eye = (x, y, z, th, ph) => ({ tx: x + off.x, ty: y + off.y, tz: z, th, ph, r: .35, fov: 72, near: .03, rMin: .05, phMax: 2.9, ortho: false, inside: true });
  const s0 = INT.sole, h = 1.55;
  const PLACES = [
    ['cutaway', 'Cutaway from above', { tx: .3, ty: .2, tz: 0, th: .95, ph: .72, r: 10.5, ortho: false, fov: 40, near: .1, rMin: 1, phMax: 1.72 }],
    ['plan', 'Plan from above', { tx: .15, ty: 0, tz: 0, th: 0, ph: .0006, r: 60, ortho: true, span: 4.2 }],
    ['saloon', 'Saloon, looking forward', eye(4.35, s0 + h, .25, -Math.PI/2, 1.42)],
    ['saloonAft', 'Saloon, looking aft', eye(6.05, s0 + h, .1, Math.PI/2, 1.42)],
    ['galley', 'Galley', eye(3.95, s0 + h, .2, .8, 1.2)],
    ['nav', 'Navigation', eye(3.95, s0 + h, -.25, 2.35, 1.2)],
    ['engine', 'Engine, ladder lifted out', Object.assign(eye(2.78, .48, 0, Math.PI/2, .92), { noLadder: true })],
    ['forward', 'Forward cabin', eye(6.55, s0 + h, 0, -Math.PI/2, 1.3)],
    ['aftCabin', 'Aft cabin and galley', { tx: 2.6 + off.x, ty: -.1 + off.y, tz: -.5, th: -.6, ph: .5, r: 5.5, ortho: false, fov: 40, near: .1, rMin: 1, phMax: 1.72, cut: true }],
    ['head', 'Head and navigation', { tx: 2.6 + off.x, ty: -.1 + off.y, tz: .5, th: -2.5, ph: .5, r: 5.5, ortho: false, fov: 40, near: .1, rMin: 1, phMax: 1.72, cut: true }],
  ];
  let on = false, saved = null, place = 'cutaway';

  const panel = document.createElement('details'); panel.className = 'arch'; panel.id = 'intPanel'; panel.open = true; panel.hidden = true;
  panel.innerHTML = `<summary>Interior <span id="intCurrent"></span></summary><div class="arch-body">
    <fieldset class="pick" id="intPick"><legend>Where to look</legend></fieldset>
    <p class="note">Inside, drag to look around and scroll to step closer. In the plan, <b>Brochure drawing</b> lays the builder's plan over it. The layout follows the brochure's accommodation plan, scaled to the model, and the owner's photos.</p>
</div>`;
  document.body.append(panel);
  PLACES.forEach(([id, label]) => {
    const l = document.createElement('label'), i = document.createElement('input'); i.type = 'radio'; i.name = 'intPlace'; i.value = id;
    i.addEventListener('change', () => go(id)); l.append(i, document.createTextNode(label)); panel.querySelector('#intPick').append(l);
  });

  const exterior = () => Object.values(G).filter(g => g && g.parent === boat && g !== G.hull && g !== G.interior);   // everything the model hangs above the hull
  function go(id) {
    place = id; const p = PLACES.find(q => q[0] === id), v = p[2], cut = id === 'cutaway' || id === 'plan' || !!v.cut;
    exterior().forEach((g, i) => { g.visible = cut ? false : saved.vis[i]; });
    G.ceiling.visible = !cut;
    Object.assign(A.view, v); delete A.view.inside; delete A.view.cut; delete A.view.noLadder; if (G.ladder) G.ladder.visible = !v.noLadder;
    panel.querySelector('#intCurrent').textContent = p[1];
    const el = panel.querySelector(`input[value="${id}"]`); if (el) el.checked = true;
    A.renderer.shadowMap.needsUpdate = true; A.wake();
  }
  function enter() {
    document.dispatchEvent(new CustomEvent('alizee:mode', { detail: 'interior' }));
    if (!G.interior) buildInteriorGeometry();               // built on demand, released again on leaving
    on = true; saved = { water: A.water.visible, ground: A.ground.visible, vis: exterior().map(g => g.visible), view: Object.assign({}, A.view) };
    A.water.visible = false; A.ground.visible = false; G.interior.visible = true; if (G.companionShade) G.companionShade.visible = false;
    document.getElementById('archPanel').hidden = true; panel.hidden = false;
    go(place);
  }
  function leave() {
    if (!on) return; on = false; btn.setAttribute('aria-pressed', 'false');
    A.water.visible = saved.water; A.ground.visible = saved.ground; G.interior.visible = false; if (G.ladder) G.ladder.visible = true; if (G.companionShade) G.companionShade.visible = true;
    exterior().forEach((g, i) => { g.visible = saved.vis[i]; });
    disposeTree(G.interior); boat.remove(G.interior); G.interior = G.ceiling = G.ladder = null;
    panel.hidden = true; document.getElementById('archPanel').hidden = false;
    A.setView('hero', true); A.renderer.shadowMap.needsUpdate = true; A.wake();
  }
  document.addEventListener('alizee:mode', e => { if (e.detail !== 'interior') leave(); });
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { if (on) leave(); }));

  const btn = document.createElement('button'); btn.textContent = 'Interior'; btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => { if (on) leave(); else { btn.setAttribute('aria-pressed', 'true'); enter(); } });
  const bar = document.querySelector('.bar'), grp = [...bar.querySelectorAll('.group')].find(g => g.getAttribute('aria-label') === 'Sea trial');
  if (grp) grp.append(btn); else { const g = document.createElement('div'); g.className = 'group'; g.append(btn); bar.append(g); }
  A.interior = { enter, leave, go, places: PLACES.map(p => p[0]) };
})();
