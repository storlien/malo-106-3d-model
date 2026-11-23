/* Renderer, light, water, cameras, views and UI. */
(function main() {
  const canvas = document.getElementById('view');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;           // the boat stands still, so shadows are redrawn only when she changes
  renderer.shadowMap.needsUpdate = true;

  const scene = new T.Scene();
  scene.fog = new T.Fog(0xcfe0e8, 70, 520);
  const sky = document.createElement('canvas'); sky.width = 16; sky.height = 512;
  const sg = sky.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#6f9fc9'); gr.addColorStop(.46, '#c5dcea'); gr.addColorStop(.5, '#e8f0f2'); gr.addColorStop(.54, '#5f8c9b'); gr.addColorStop(1, '#23505f');
  sg.fillStyle = gr; sg.fillRect(0, 0, 16, 512);
  const skyTex = new T.CanvasTexture(sky); skyTex.encoding = T.sRGBEncoding;
  const dome = new T.Mesh(new T.SphereGeometry(900, 32, 16), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, toneMapped: false }));
  scene.add(dome);

  // Reflections for gelcoat and stainless come from the same sky.
  const envScene = new T.Scene(); envScene.add(new T.Mesh(new T.SphereGeometry(50, 32, 16), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide })));
  const sun = new T.Mesh(new T.SphereGeometry(7, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(14, 13, 11) })); sun.position.set(22, 30, 18); envScene.add(sun);
  const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, .02).texture;

  scene.add(new T.HemisphereLight(0xdcecf6, 0x47606a, .38));
  const key = new T.DirectionalLight(0xfff1dc, 2.3); key.position.set(9, 19, 13); key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096); Object.assign(key.shadow.camera, { left: -11, right: 11, top: 13, bottom: -7, near: 1, far: 60 });
  key.shadow.bias = -.0004; key.shadow.normalBias = .012; scene.add(key, key.target);

  const centre = L/2;
  boat.position.set(-centre, -SPEC.hull.floatSink, 0); scene.add(boat);

  /* Water */
  const wr = rng(5), WAVES = []; for (let i = 0; i < 46; i++) { const f = 2 + wr()*wr()*26, a = wr()*Math.PI*2; WAVES.push([Math.round(f*Math.cos(a)), Math.round(f*Math.sin(a)), 1.3/(2 + f), wr()*6.28]); }
  const nc = document.createElement('canvas'); nc.width = nc.height = 256;
  const ng = nc.getContext('2d'), img = ng.createImageData(256, 256), h = (x, y) => {
    let v = 0; WAVES.forEach(([a, b, k, ph]) => { v += k*Math.sin((a*x + b*y)*Math.PI*2/256 + ph); });
    return v;
  };
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1), o = 4*(y*256 + x); img.data[o] = clamp(128 + dx*120, 0, 255); img.data[o + 1] = clamp(128 + dy*120, 0, 255); img.data[o + 2] = 255; img.data[o + 3] = 255; }
  ng.putImageData(img, 0, 0);
  const nt = new T.CanvasTexture(nc); nt.wrapS = nt.wrapT = T.RepeatWrapping; nt.repeat.set(95, 95); nt.anisotropy = 8;
  const water = new T.Mesh(new T.CircleGeometry(800, 64), new T.MeshStandardMaterial({ color: C('#123f4b'), roughness: .2, metalness: .1, normalMap: nt, normalScale: new T.Vector2(.1, .1), transparent: true, opacity: .93 }));
  const waterT = { a: { value: new T.Vector2() }, b: { value: new T.Vector2() } };
  water.material.onBeforeCompile = sh => {            // two ripple layers drifting across each other
    sh.uniforms.uDriftA = waterT.a; sh.uniforms.uDriftB = waterT.b;
    sh.fragmentShader = 'uniform vec2 uDriftA;uniform vec2 uDriftB;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>',
      T.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0', 'vec3 mapN = normalize(texture2D(normalMap, vUv + uDriftA).xyz*2.0 - 1.0 + texture2D(normalMap, vUv*1.73 + uDriftB).xyz*2.0 - 1.0)'));
  };
  water.rotation.x = -Math.PI/2; water.receiveShadow = true; scene.add(water);

  /* Hard-stand ground used when the water is hidden, so the keel can be inspected. */
  const ground = new T.Mesh(new T.CircleGeometry(800, 48), new T.MeshStandardMaterial({ color: C('#a8adad'), roughness: .95 }));
  ground.rotation.x = -Math.PI/2; ground.position.y = -SPEC.hull.draft - SPEC.hull.floatSink - .35; ground.receiveShadow = true; ground.visible = false; scene.add(ground);

  /* Brochure drawing overlays, in true scale */
  const overlay = new T.Group(); overlay.visible = false; boat.add(overlay);
  const gx = g => (g - 122)/148.85, gy = g => (512 - g)/150;
  const ovMat = src => { const t = new T.TextureLoader().load(src, () => { needs = 3; }); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return new T.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide, toneMapped: false }); };
  const prof = new T.Mesh(new T.PlaneGeometry(gx(1800) - gx(0), (807)/150), ovMat(OVERLAYS.profile));
  prof.position.set((gx(0) + gx(1800))/2, (gy(0) + gy(807))/2, 3); prof.renderOrder = 20; overlay.add(prof);
  const planK = .989/148.85, plan = new T.Mesh(new T.PlaneGeometry(gx(1800) - gx(0), 697*planK), ovMat(OVERLAYS.plan));
  plan.rotation.x = -Math.PI/2; plan.position.set((gx(0) + gx(1800))/2, 4, (348.5 - 305)*planK); plan.renderOrder = 20; overlay.add(plan);

  /* Cameras: perspective to look around, orthographic for true-scale elevations */
  const persp = new T.PerspectiveCamera(32, 1, .4, 2200), ortho = new T.OrthographicCamera(-1, 1, 1, -1, 1, 1400);
  const view = { th: .78, ph: 1.33, r: 21, tx: 0, ty: 2.7, tz: 0, ortho: false, span: 13 };
  const goal = { ...view };
  const VIEWS = {
    hero:   { th: .78, ph: 1.33, r: 21, tx: 0, ty: 2.7, tz: 0, ortho: false },
    deck:   { th: .62, ph: .92, r: 15.5, tx: -.2, ty: .9, tz: 0, ortho: false },
    stern:  { th: Math.PI*1.5 + 2.0, ph: 1.33, r: 13.5, tx: -2.5, ty: 1.15, tz: 0, ortho: false },
    arch:   { th: -.82, ph: 1.14, r: 9.5, tx: -4.75, ty: 1.75, tz: 0, ortho: false },
    side:   { th: 0, ph: Math.PI/2, r: 60, tx: .15, ty: 1, tz: 0, ortho: true, span: 13.2 },
    full:   { th: 0, ph: Math.PI/2, r: 60, tx: .15, ty: 7.4, tz: 0, ortho: true, span: 20 },
    top:    { th: 0, ph: .0006, r: 60, tx: .15, ty: 0, tz: 0, ortho: true, span: 13.2 },
    aft:    { th: -Math.PI/2, ph: Math.PI/2, r: 60, tx: 0, ty: 1, tz: 0, ortho: true, span: 7.2 },
    bow:    { th: Math.PI/2, ph: Math.PI/2, r: 60, tx: 0, ty: 1, tz: 0, ortho: true, span: 7.2 },
  };
  let needs = 5, anim = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setView(name, instant) {
    const v = VIEWS[name]; if (!v) return;
    Object.assign(goal, v); goal.span = v.span || view.span;
    if (goal.ortho !== view.ortho || instant || reduced) Object.assign(view, goal);
    else { const tau = Math.PI*2; view.th = goal.th + (((view.th - goal.th)%tau + tau*1.5)%tau - tau/2); anim = true; }
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === name));
    needs = 5;
  }
  function placeCamera() {
    const c = view.ortho ? ortho : persp, w = canvas.clientWidth || 1, hh = canvas.clientHeight || 1, a = w/hh;
    const sp = Math.sin(view.ph), d = [view.r*sp*Math.sin(view.th), view.r*Math.cos(view.ph), view.r*sp*Math.cos(view.th)];
    c.position.set(view.tx + d[0], view.ty + d[1], view.tz + d[2]);
    c.up.set(0, 1, 0); if (view.ph < .01) c.up.set(0, 0, -1);
    c.lookAt(view.tx, view.ty, view.tz);
    if (view.ortho) { const s = Math.max(view.span/2, view.span/2/a); const sw = s*a >= view.span/2 ? s : view.span/2/a; c.left = -sw*a; c.right = sw*a; c.top = sw; c.bottom = -sw; c.updateProjectionMatrix(); }
    else { c.aspect = a; c.fov = a < 1 ? 46 : 32; c.updateProjectionMatrix(); }
    return c;
  }
  function resize() {
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    if (canvas.width !== Math.floor(w*renderer.getPixelRatio()) || canvas.height !== Math.floor(hh*renderer.getPixelRatio())) renderer.setSize(w, hh, false);
    needs = 3;
  }
  addEventListener('resize', resize);

  /* Pointer: drag to orbit, right-drag or two fingers to pan, wheel or pinch to zoom */
  const ptrs = new Map(); let pinch = 0;
  const deselect = () => document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button }); anim = false; });
  const release = e => { ptrs.delete(e.pointerId); pinch = 0; };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  function pan(dx, dy) {
    const c = view.ortho ? ortho : persp, k = view.ortho ? (c.top - c.bottom)/canvas.clientHeight : 2*view.r*Math.tan(c.fov*Math.PI/360)/canvas.clientHeight;
    const e = c.matrixWorld.elements;
    view.tx += (-dx*e[0] + dy*e[4])*k; view.ty += (-dx*e[1] + dy*e[5])*k; view.tz += (-dx*e[2] + dy*e[6])*k;
  }
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoom(pinch/dist); pinch = dist; pan(dx/2, dy/2);
    } else if (p.b === 2 || e.shiftKey) pan(dx, dy);
    else {
      if (view.ortho) { view.ortho = false; view.r = Math.min(view.r, 26); view.span = 13; deselect(); }
      view.th -= dx*.0055; view.ph = clamp(view.ph - dy*.0045, .04, 1.72);
    }
    needs = 2;
  });
  function zoom(f) { if (view.ortho) view.span = clamp(view.span*f, 1, 40); else view.r = clamp(view.r*f, 2.5, 60); needs = 2; }
  canvas.addEventListener('wheel', e => { e.preventDefault(); anim = false; zoom(Math.exp(e.deltaY*.001)); }, { passive: false });

  /* Controls */
  function setLayer(name, on) {
    if (name === 'water') { water.visible = on; ground.visible = !on; }
    if (name === 'canvas') G.canvas.visible = on;
    if (name === 'rig') G.rig.visible = on;
    if (name === 'rails') G.rails.visible = on;
    if (name === 'arch') setArch(on ? lastArch : 'none');
    if (name === 'drawing') overlay.visible = on;
    renderer.shadowMap.needsUpdate = true;
    const b = document.querySelector(`[data-layer="${name}"]`); if (b) b.setAttribute('aria-pressed', on);
    needs = 3;
  }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll('[data-layer]').forEach(b => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true'; setLayer(b.dataset.layer, on);
    if (b.dataset.layer === 'drawing' && on && !view.ortho) setView('side');
  }));

  let last = performance.now(), lastWave = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last)/1000); last = now;
    if (anim) {
      const k = 1 - Math.exp(-dt*5.5); let rest = 0;
      ['th', 'ph', 'r', 'tx', 'ty', 'tz', 'span'].forEach(q => { const d = goal[q] - view[q]; view[q] += d*k; rest += Math.abs(d); });
      if (rest < .002) anim = false; needs = 2;
    }
    if (!reduced && now - lastWave > 33) {             // water and flag at about 30 fps; the boat itself never moves
      lastWave = now; const t = now/1000;
      waterT.a.value.set(t*.011, t*.007); waterT.b.value.set(-t*.009, t*.013);
      waveFlags(t); needs = Math.max(needs, 1);
    }
    if (needs <= 0) return;
    needs--;
    renderer.render(scene, placeCamera());
  }
  initArchUI(() => { needs = 3; renderer.shadowMap.needsUpdate = true; }); resize(); setView('hero', true); requestAnimationFrame(frame);

  // Small API for scripted renders and comparison against photos
  window.alizee = { SPEC, setView, setLayer, view, render() { resize(); renderer.render(scene, placeCamera()); }, hullHalf, sheerY, keelY, halfB,
    archReport, setArch, archDesigns: () => SPEC.solarArches.designs.map(d => d.id),
    measure() {                        // true geometry, for checking the model against the spec
      boat.updateMatrixWorld(true); const inv = new T.Matrix4().copy(boat.matrixWorld).invert();
      const bb = list => { const b = new T.Box3(); list.forEach(m => { const q = m.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld)); q.computeBoundingBox(); b.union(q.boundingBox); }); return b; };
      const h = bb(G.hull.children.slice(0, 3)), k = bb(G.hull.children.filter(m => m.isMesh && m.material === mat.anti));
      const r = (v) => +v.toFixed(3);
      return { hullLength: r(h.max.x - h.min.x), beam: r(h.max.z - h.min.z), draftFromDesignWL: r(-k.min.y), mastTop: r(SPEC.rig.mastTop) };
    } };
})();
