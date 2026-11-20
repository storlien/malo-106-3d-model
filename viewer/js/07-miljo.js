'use strict';
/* miljo — se deloverskriftene i filen. */

/* =====================================================================
   LYS OG MILJØ — sol med skygger, himmelkuppel, stjerner og havet.
   Havshaderen er portert fra Abela: seks bølgekomponenter, baugbølge
   som brer seg ut i Kelvin-vinkelen, kjølvann som ligger i landskapet
   etter båten (via historikk-tekstur), skumblonder, vindstriper og
   speiling av himmelen — samme sjø som Abela, tilpasset Malöens linjer.
   ===================================================================== */
const sun = new T.DirectionalLight(0xffffff, 1.35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 2; sun.shadow.camera.far = 90;
sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
sun.shadow.bias = -0.00035;
scene.add(sun); scene.add(sun.target);
const SUN0 = new V3(-7, 20, 11), sunTmp = new V3(), moonTmp = new V3();
const hemi = new T.HemisphereLight(C('#eef4fa'), C('#6d6150'), 0.45); scene.add(hemi);
const fill = new T.DirectionalLight(C('#cfe2f2'), 0.3); fill.position.set(9, 6, -8); scene.add(fill);
const dirFrom = (el, az, v) => { const e = el*Math.PI/180, a = az*Math.PI/180; return v.set(Math.cos(e)*Math.cos(a), Math.sin(e), Math.cos(e)*Math.sin(a)); };

/* miljøkart for speilingene i gelcoat, glass og krom: himmelgradient
   tegnet på et lerret (samme fremgangsmåte som Abela — fromScene med
   egne shadere gifter PMREM-teksturen og gjør alle materialer svarte) */
(function envMap(){
  try {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5b8fc9'); gr.addColorStop(0.42, '#cfe0ee'); gr.addColorStop(0.5, '#e8eff4');
    gr.addColorStop(0.52, '#7d97a6'); gr.addColorStop(1, '#183444');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    const sg = g.createRadialGradient(150, 50, 0, 150, 50, 26);
    sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg; g.fillRect(100, 0, 100, 100);
    const tex = new T.CanvasTexture(c);
    tex.mapping = T.EquirectangularReflectionMapping; tex.encoding = T.sRGBEncoding;
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(tex).texture;
    pm.dispose();
  } catch (e) { console.warn('Miljøkart hoppet over:', e); }
})();

const wxU = { cloud:{ value:WX.cloud }, dayF:{ value:1 }, fog:{ value:0 }, twi:{ value:0 }, flash:{ value:0 }, boltDir:{ value:new V2(1, 0) }, dark:{ value:0 } };
const oceanU = {
  time:{ value:0 }, amp:{ value:1 }, opacity:{ value:0 }, wakeK:{ value:0 }, drift:{ value:0 }, rip:{ value:1 },
  wdir:{ value:new V2(-0.42, -0.91) }, lscale:{ value:1 }, lscaleS:{ value:1 }, ampS:{ value:1 }, farR:{ value:520 }, white:{ value:0 },
  gale:{ value:0 }, rain:{ value:0 }, hullOff:{ value:0 }, histTex:{ value:null }, histHead:{ value:0 }, histAge:{ value:0 }, vel:{ value:3 },
  hullTex:{ value:null }, hullPos:{ value:new V2() }, tailK:{ value:1 }, foamDrift:{ value:0 }, lowQ:{ value:0 },
  hullYaw:{ value:new V2(1, 0) }, hullX:{ value:new T.Vector4(-5.8, 5.9, 5.6, -5.6) },
  sunDir:{ value:new V3(-0.32, 0.82, 0.47).normalize() }, cloud:wxU.cloud, dayF:wxU.dayF, fog:wxU.fog, twi:wxU.twi, flash:wxU.flash, boltDir:wxU.boltDir, dark:wxU.dark,
};
/* Himmelen: samme farger i kuppelen og i speilingen i sjøen, så horisonten blir sømløs */
const SKY_GLSL = `
  uniform float cloud; uniform float dayF; uniform float fog; uniform float twi; uniform float flash; uniform vec2 boltDir; uniform float dark;
  vec3 hazeCol(){
    vec3 day = mix(vec3(0.60, 0.75, 0.91), vec3(0.66, 0.69, 0.72), cloud*0.9)*(1.0 - 0.5*dark);
    day = mix(day, vec3(0.7, 0.38, 0.26), twi*0.72*(1.0 - cloud));
    return mix(vec3(0.018, 0.028, 0.05), day, dayF);
  }
  vec3 skyCol(vec3 d, vec3 sd){
    float h = clamp(d.y, 0.0, 1.0);
    vec3 hor = vec3(0.58, 0.74, 0.92), zen = vec3(0.07, 0.26, 0.72);
    vec3 c = mix(hor, zen, pow(h, 0.38));
    c = mix(c, mix(vec3(0.66, 0.69, 0.72), vec3(0.44, 0.48, 0.54), pow(h, 0.6))*(1.0 - 0.55*dark), cloud*0.9);
    float s = max(dot(d, sd), 0.0), up = smoothstep(-0.05, 0.05, sd.y);
    c += mix(vec3(1.0, 0.92, 0.78), vec3(1.0, 0.56, 0.22), twi)*(pow(s, 5.0)*0.10 + pow(s, 60.0)*0.28)*(1.0 - 0.85*cloud)*up;
    vec2 dh = normalize(d.xz + 1e-4), sh = normalize(sd.xz + 1e-4);
    float sg = pow(max(dot(dh, sh), 0.0), 2.0);
    float hz = pow(1.0 - h, 2.4);
    vec3 dusk = mix(vec3(0.12, 0.13, 0.3), mix(vec3(0.5, 0.22, 0.28), vec3(1.12, 0.3, 0.06), sg), hz);
    dusk = mix(dusk, vec3(1.3, 0.6, 0.2), pow(s, 8.0)*0.85);
    c = mix(c, dusk, twi*(0.75 + 0.2*sg)*(1.0 - 0.45*cloud));
    c += vec3(0.22, 0.06, 0.16)*twi*(1.0 - sg)*pow(1.0 - h, 1.6)*0.25*(1.0 - 0.7*cloud);
    vec3 night = mix(vec3(0.020, 0.032, 0.06), vec3(0.003, 0.007, 0.02), pow(h, 0.5));
    c = mix(night, c, dayF);
    c = mix(c, hazeCol(), fog*(1.0 - smoothstep(0.0, 0.5, h))*0.9);
    return c + vec3(0.72, 0.78, 1.0)*flash*(0.25 + 0.9*pow(max(dot(dh, boltDir), 0.0), 6.0)*(1.0 - 0.5*h));
  }`;
/* Historikk for baugen: kjølvannet blir liggende der baugen var, selv om båten stamper */
const HIST_GLSL = `
  uniform sampler2D histTex; uniform float histHead; uniform float histAge; uniform float vel;
  vec2 histAt(float tau){
    float i = histHead - max(0.0, tau - histAge)/0.125;
    vec4 t = texture2D(histTex, vec2((i + 0.5)/256.0, 0.5));
    return vec2(4.0 + 4.0*t.r, -8.0 + 4.0*t.g);
  }
  float bowAge(float x, float bowNow){
    float V = max(vel, 0.5), a0 = max(bowNow - x, 0.0), a = max(histAt(a0/V).x - x, 0.0);
    float bh = histAt(a/V).x;
    return mix(bowNow, bh, smoothstep(0.6, 3.5, a0)) - x;
  }
  float sternAge(float x, float sternNow){
    float V = max(vel, 0.5), a0 = max(sternNow - x, 0.0), a = max(histAt(a0/V).y - x, 0.0);
    float sh = histAt(a/V).y;
    return mix(sternNow, sh, smoothstep(0.6, 3.5, a0)) - x;
  }`;
const ocean = (() => {
  // polart rutenett: tett ved båten, glissent ute ved horisonten
  const NR = 240, NA = 200, RMAX = 1400, pos = [], idx = [];
  for (let i = 0; i <= NR; i++){
    const r = RMAX*Math.pow(i/NR, 3);
    for (let j = 0; j < NA; j++){ const a = 2*Math.PI*j/NA; pos.push(r*Math.cos(a), 0, r*Math.sin(a)); }
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++){
    const a = i*NA + j, b = i*NA + (j+1)%NA, c = a + NA, d = b + NA; idx.push(a, c, b, b, c, d);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.boundingSphere = new T.Sphere(new V3(), RMAX + 2);
  const m = new T.ShaderMaterial({
    uniforms: oceanU, transparent:true, side:T.DoubleSide, extensions:{ derivatives:true },
    vertexShader: `
      uniform float time; uniform float amp; uniform float drift; uniform vec2 wdir; uniform float lscale; uniform float lscaleS; uniform float ampS; uniform float farR;
      uniform float wakeK; uniform vec4 hullX; uniform vec2 hullYaw; uniform float hullOff; uniform vec2 hullPos; uniform float tailK;
      ${HIST_GLSL}
      varying vec3 vPos; varying vec3 vNrm; varying float vH;
      void main(){
        vec2 p0 = (modelMatrix*vec4(position, 1.0)).xz;
        vec2 p = p0 + vec2(drift, 0.0);
        float bd = length(vec2(max(abs(p0.x) - 5.2, 0.0), max(abs(p0.y) - 1.3, 0.0)));
        float nearF = mix(0.85, 1.0, smoothstep(0.0, 9.0, bd))*(1.0 - smoothstep(farR*0.3, farR, length(p0)));
        float att = amp*nearF, attS = ampS*nearF;
        float far = 1.0 - smoothstep(25.0*lscaleS, 70.0*lscaleS, length(position.xz));
        vec3 disp = vec3(0.0); vec3 n = vec3(0.0, 1.0, 0.0);
        float ca = wdir.x, sa = wdir.y;
        #define GW(ang, L, A, Q) { \
          float c_ = cos(ang), s_ = sin(ang); vec2 D = vec2(ca*c_ - sa*s_, sa*c_ + ca*s_); \
          float k = 6.2831853/(L); float w = sqrt(9.81*k); float a = A; \
          float f = k*dot(D, p) - w*time; float cf = cos(f), sf = sin(f); \
          disp += vec3(Q*a*D.x*cf, a*sf, Q*a*D.y*cf); \
          n -= vec3(D.x*k*a*cf, Q*k*a*sf, D.y*k*a*cf); }
        GW(0.0, 34.0*lscale, 0.30*att, 0.55)
        GW(0.42, 21.0*lscale, 0.17*att, 0.6)
        GW(-0.55, 13.0*lscale, 0.11*att, 0.6)
        GW(0.9, 8.2*lscaleS, (0.06*far + 0.02)*attS, 0.6)
        GW(-1.1, 5.1*lscaleS, 0.035*far*attS, 0.6)
        GW(0.25, 3.1*lscaleS, 0.02*far*attS, 0.55)
        // baugbølgen: vannet hoper seg opp ved baugen og ruller utover langs siden
        if (wakeK > 0.01){
          vec2 q0 = p0 - hullPos, b = vec2(q0.x*hullYaw.x - q0.y*hullYaw.y, q0.x*hullYaw.y + q0.y*hullYaw.x);
          float db = bowAge(b.x, hullX.z), ab = max(db, 0.0), azb = abs(b.y - hullOff);
          if (db > -2.5 && db < 26.0 && azb < 10.0){
            float dz = 0.36*ab + 0.95*(1.0 - exp(-ab/2.2)), arm = azb - dz, cw = 0.5 + 0.5*exp(-ab/5.0) + 0.03*ab;
            float H = wakeK*0.55*exp(-ab/(7.5*mix(0.35, 1.0, tailK)))*smoothstep(-1.4, 0.3, db);
            float e1 = exp(-arm*arm/(cw*cw)), t2 = arm + cw*1.3, e2 = exp(-t2*t2/(cw*cw));
            float hb = H*(e1 - 0.35*e2);
            float gy = H*(-2.0*arm/(cw*cw)*e1 + 0.7*t2/(cw*cw)*e2)*sign(b.y - hullOff);
            disp.y += hb; n -= vec3(hullYaw.y*gy, 0.0, hullYaw.x*gy);
          }
        }
        vec3 wp = vec3(p0.x + disp.x, disp.y, p0.y + disp.z);
        vPos = wp; vNrm = normalize(n); vH = disp.y;
        gl_Position = projectionMatrix*viewMatrix*vec4(wp, 1.0);
      }`,
    fragmentShader: `
      uniform float time; uniform float opacity; uniform vec3 sunDir; uniform float wakeK; uniform float drift; uniform float rip; uniform float white; uniform float lowQ;
      uniform float amp; uniform float rain; uniform float gale; uniform vec2 wdir; uniform sampler2D hullTex; uniform vec2 hullYaw; uniform vec4 hullX; uniform float hullOff; uniform vec2 hullPos; uniform float tailK; uniform float foamDrift;
      ${HIST_GLSL}
      varying vec3 vPos; varying vec3 vNrm; varying float vH;
      ${SKY_GLSL}
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a*noise(p); p = p*2.07 + vec2(1.7, 9.2); a *= 0.5; } return s; }
      vec2 worley(vec2 p){
        vec2 c = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
          vec2 g = vec2(float(i), float(j)), o = vec2(hash(c + g), hash(c + g + 17.31));
          vec2 r = g + o - f; float d = dot(r, r);
          if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return sqrt(vec2(d1, d2));
      }
      float lace(vec2 p){
        vec2 wp = p + 0.75*vec2(noise(p*0.55), noise(p*0.55 + 3.3)) + 0.3*vec2(noise(p*1.7 + 1.1), noise(p*1.7 + 7.7));
        vec2 a = worley(wp), b = worley(wp*2.3 + 5.1);
        float w1 = 0.06 + 0.2*noise(p*0.8), w2 = 0.05 + 0.13*noise(p*1.9 + 2.0);
        float v = max(1.0 - smoothstep(0.0, w1, a.y - a.x), 0.75*(1.0 - smoothstep(0.0, w2, b.y - b.x)));
        float clump = smoothstep(0.52, 0.82, noise(p*1.25 + 9.0)*0.6 + noise(p*3.1)*0.4);
        return max(v*(0.55 + 0.45*noise(p*2.6 + 4.0)), clump);
      }
      float hullW(float x, float side){
        float u = (x - hullX.x)/(hullX.y - hullX.x);
        if (u < 0.0 || u > 1.0 || x > hullX.z || x < hullX.w) return 0.0;
        vec4 t = texture2D(hullTex, vec2(u, 0.5));
        return (side > 0.5 ? t.g : t.r)*1.7;
      }
      float hullDist(vec2 b){
        float sd = b.y > 0.0 ? 1.0 : 0.0, z = abs(b.y), best = 1e3;
        if (b.x < hullX.z && b.x > hullX.w && z < hullW(b.x, sd)) return 0.0;
        for (int k = -4; k <= 4; k++){
          float xi = b.x + float(k)*0.3;
          if (xi > hullX.z || xi < hullX.w) continue;
          best = min(best, length(vec2(b.x - xi, z - hullW(xi, sd))));
        }
        best = min(best, length(vec2(b.x - hullX.z, z)));
        float ws = hullW(hullX.w + 0.06, sd);
        best = min(best, length(vec2(b.x - hullX.w, max(0.0, z - ws))));
        return best;
      }
      vec2 rainRings(vec2 p, float t, float dens){
        vec2 g = vec2(0.0);
        for (int l = 0; l < 3; l++){
          float fl = float(l), sc = 1.1 + 0.6*fl;
          vec2 q = p*sc + vec2(17.3, 5.1)*fl, c = floor(q), f = fract(q);
          float h1 = hash(c + 3.7*fl), h2 = hash(c + vec2(9.1, 2.3) + fl);
          float age = fract(t*(0.75 + 0.3*h2) + h1);
          float on = step(h2, dens)*step(0.5, hash(c + floor(t*(0.75 + 0.3*h2) + h1)*1.37));
          vec2 o = vec2(0.28) + 0.44*vec2(hash(c + 1.3 + floor(t*0.8 + h1)), hash(c + 7.9 + floor(t*0.8 + h1)));
          vec2 d = f - o; float r = length(d) + 1e-4;
          float R = 0.04 + age*0.38, s = r - R, w = 0.025 + 0.035*age;
          float env = exp(-s*s/(w*w))*(1.0 - age)*(1.0 - age)*on;
          g += cos(s*48.0)*env*(d/r);
        }
        return g;
      }
      void main(){
        vec2 p = vPos.xz, pw = p + vec2(drift, 0.0);
        float dist = length(p - cameraPosition.xz);
        float gust = smoothstep(0.35, 0.75, fbm(pw*0.03 + vec2(time*0.04, -time*0.11)))*rip;
        float fpx = sqrt(length(dFdx(p))*length(dFdy(p)));
        float fade0 = 1.0 - smoothstep(10.0, 60.0, dist);
        vec2 wn = normalize(wdir + vec2(1e-4)), wq = vec2(-wn.y, wn.x);
        vec2 warp = 0.45*vec2(sin(time*0.41 + pw.y*0.17), cos(time*0.33 + pw.x*0.19));
        vec2 q = (pw + warp)*1.1 - wn*time*1.1;
        vec2 q2 = mat2(0.8, -0.6, 0.6, 0.8)*(pw*1.1*1.47) - (wn*0.6 + wq*0.4)*time*0.75;
        float e = 0.06;
        float n0 = fbm(q), nx = fbm(q + vec2(e, 0.0)), nz = fbm(q + vec2(0.0, e));
        vec2 rg0 = vec2(n0 - nx, n0 - nz);
        if (lowQ < 0.5){ float o0 = fbm(q2), ox = fbm(q2 + vec2(e, 0.0)), oz = fbm(q2 + vec2(0.0, e)); rg0 += 0.75*mat2(0.8, 0.6, -0.6, 0.8)*vec2(o0 - ox, o0 - oz); }
        vec3 N = normalize(vNrm + vec3(rg0.x, 0.0, rg0.y)*(4.2 + 5.0*gust)*fade0*rip);
        float fadeM = smoothstep(18.0, 70.0, dist)*(1.0 - smoothstep(160.0, 420.0, dist))*(1.0 - lowQ);
        if (fadeM > 0.0){
          vec2 qm = (pw + warp*3.0)*0.16 - wn*time*0.32 + wq*sin(time*0.11)*0.4;
          float m0 = fbm(qm), mx2 = fbm(qm + vec2(e, 0.0)), mz2 = fbm(qm + vec2(0.0, e));
          N = normalize(N + vec3(m0 - mx2, 0.0, m0 - mz2)*(4.5 + 6.0*gust)*fadeM*rip);
        }
        float fadeL = smoothstep(130.0, 360.0, dist)*(1.0 - smoothstep(900.0, 1350.0, dist));
        if (fadeL > 0.0){
          vec2 ql = (pw + warp*8.0)*0.035 - wn*time*0.07;
          float l0 = fbm(ql), lx = fbm(ql + vec2(e, 0.0)), lz = fbm(ql + vec2(0.0, e));
          N = normalize(N + vec3(l0 - lx, 0.0, l0 - lz)*(3.5 + 5.0*gust)*fadeL*rip);
        }
        if (rain > 0.0){
          float rf = 1.0 - smoothstep(14.0, 45.0, dist);
          vec2 rg = rf > 0.0 ? rainRings(p, time, 0.35 + 0.6*rain) : vec2(0.0);
          N = normalize(N - vec3(rg.x, 0.0, rg.y)*0.45*rf*rain);
          N = normalize(mix(N, vec3(0.0, 1.0, 0.0), 0.15*rain*(1.0 - rf)));
        }
        vec3 V = normalize(cameraPosition - vPos);
        float ndv = max(dot(N, V), 0.0);
        float fres = 0.02 + 0.98*pow(1.0 - ndv, 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 sky = skyCol(R, sunDir);
        vec3 deep = vec3(0.012, 0.085, 0.150), body = vec3(0.025, 0.190, 0.250);
        float lit = max(dot(N, sunDir), 0.0);
        float hN = vH/max(1.0, amp*0.75);
        vec3 water = mix(deep, body, clamp(0.35 + hN*1.1, 0.0, 1.0)) * (0.55 + 0.6*lit) * mix(0.75, 1.0, 1.0 - cloud) * mix(0.1, 1.0, dayF);
        water = mix(water, water*0.75, gust*0.6);
        vec3 col = mix(water, sky, fres*0.9);
        float sd = max(dot(R, sunDir), 0.0);
        col += mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.58, 0.26), twi)*(pow(sd, 700.0)*6.0 + pow(sd, 90.0)*0.35)*(1.0 - 0.9*cloud)*smoothstep(-0.02, 0.06, sunDir.y);
        float foam = smoothstep(0.5, 0.68, hN + 0.25*fbm(pw*0.8))*smoothstep(0.5, 0.82, fbm(pw*2.3 + time*0.2))*0.42;
        float wc = white*smoothstep(0.55, 0.8, fbm(pw*0.5 + vec2(time*0.1, -time*0.25)))*smoothstep(-0.2, 0.5, hN);
        if (wc > 0.01){ float lp = 0.65*lace(pw*1.15 + vec2(0.0, time*0.05)) + 0.35*fbm(pw*3.0 - time*0.3); foam += smoothstep(1.0 - wc, 1.3 - wc, lp + 0.2*wc)*0.8*(1.0 - smoothstep(60.0, 140.0, dist)); }
        float farW = white*smoothstep(25.0, 100.0, dist)*(1.0 - smoothstep(700.0, 1300.0, dist));
        if (farW > 0.01){
          float sc = dist < 260.0 ? 0.16 : 0.06;
          vec2 fq = pw*sc + vec2(time*0.05, -time*0.13);
          float cap = smoothstep(0.7 - 0.14*white, 0.84 - 0.08*white, fbm(fq))*smoothstep(0.32, 0.68, noise(pw*sc*4.0 + time*0.25));
          foam += cap*farW*(0.55 + 0.25*smoothstep(-0.3, 0.6, hN));
        }
        if (gale > 0.01){
          vec2 wd2 = normalize(wdir), pp = vec2(dot(pw, wd2), dot(pw, vec2(-wd2.y, wd2.x)));
          float st = fbm(vec2(pp.x*0.03 - time*0.12, pp.y*0.55))*0.7 + fbm(vec2(pp.x*0.08, pp.y*1.4) + 3.0)*0.3;
          foam += smoothstep(0.6, 0.78, st)*gale*0.4*(1.0 - smoothstep(500.0, 1250.0, dist));
        }
        if (wakeK > 0.01){
          vec2 qb = p - hullPos, bq = vec2(qb.x*hullYaw.x - qb.y*hullYaw.y, qb.x*hullYaw.y + qb.y*hullYaw.x);
          float az = abs(bq.y), cov = 0.0, aer = 0.0;
          vec2 sp = vec2(bq.x + drift + foamDrift, bq.y);
          if (bq.x < hullX.z + 4.0 && bq.x > hullX.w - 2.0 && az < 6.0){
            float hd = hullDist(bq), nb = smoothstep(hullX.w + 3.0, hullX.z - 0.5, bq.x);
            float hf = exp(-hd/(0.28 + 0.32*nb))*(0.45 + 0.55*nb);
            cov += hf; aer += hf*0.6;
          }
          float db = bowAge(bq.x, hullX.z);
          if (db > -0.6){
            float a = max(db, 0.0), sd2 = bq.y > 0.0 ? 1.0 : 0.0, azo = abs(bq.y - hullOff);
            float dz = 0.36*a + 0.95*(1.0 - exp(-a/2.2)), arm = azo - dz;
            float cw = 0.38 + 0.7*exp(-a/5.0) + 0.022*a;
            float crest = exp(-arm*arm/(cw*cw));
            float hwl = hullW(bq.x, sd2);
            float skirt = (1.0 - smoothstep(-0.25, 0.3, arm))*smoothstep(-0.15, 0.25, az - hwl);
            float nearB = exp(-a/((10.0 + 9.0*wakeK))), farB = exp(-a/(55.0 + 60.0*wakeK))*tailK;
            float broken = mix(1.0, smoothstep(0.3, 0.62, fbm(vec2(sp.x*0.09, azo*0.09) + vec2(bq.y > 0.0 ? 2.0 : 9.0, 0.0))), smoothstep(10.0, 28.0, a));
            float armC = (crest*(0.55*farB + 0.75*nearB) + skirt*0.85*nearB)*broken*smoothstep(-0.6, 0.4, db);
            cov += armC; aer += armC*0.45;
          }
          float ds = sternAge(bq.x, hullX.w), age = max(ds, 0.0);
          if (tailK > 0.01 && ds > -0.8 && ds < 190.0){
            float W = (1.05 + 0.12*age)*(0.85 + 0.3*fbm(vec2(sp.x*0.07, 7.0)));
            float azw = abs(bq.y - hullOff*exp(-age/12.0));
            float core = exp(-(azw*azw)/(W*W)*1.4);
            float edge = exp(-pow((azw - W*0.9)/(0.32 + 0.03*age), 2.0));
            float holes = smoothstep(0.25, 0.7, fbm(sp*0.1 + vec2(3.0, 1.0)));
            float on = smoothstep(-0.8, 0.8, ds);
            cov += (core*mix(0.3, 1.0, holes)*(0.62 + 0.9*exp(-age/7.0)) + edge*0.45)*exp(-age/(26.0 + 55.0*wakeK))*on;
            aer += core*exp(-age/(45.0 + 80.0*wakeK))*on*1.3;
          }
          cov = clamp(cov*wakeK, 0.0, 1.0); aer = clamp(aer*wakeK, 0.0, 1.0);
          col = mix(col, vec3(0.17, 0.58, 0.6)*(0.55 + 0.45*lit)*mix(0.12, 1.0, dayF), aer*0.58);
          if (cov > 0.003){
            float streak = fbm(vec2(sp.x*0.42, sp.y*1.8) + vec2(0.0, time*0.1));
            float fine = fbm(sp*2.4 + vec2(time*0.25, 0.0));
            float net = cov < 0.75 ? lace(vec2(sp.x*0.8, sp.y*1.1)) : 0.0;
            float pat = 0.5*streak + 0.33*fine + 0.17*net;
            float wf = smoothstep(1.0 - cov, 1.28 - cov, pat + 0.2*cov);
            foam = max(foam, wf*(0.62 + 0.33*cov)*(0.8 + 0.2*noise(sp*7.0 + vec2(time*0.4, 0.0))));
          }
        }
        foam = clamp(foam, 0.0, 1.0);
        col = mix(col, vec3(0.88, 0.92, 0.94)*(0.7 + 0.38*lit)*mix(0.12, 1.0, dayF), foam);
        float horizon = pow(smoothstep(mix(60.0, 8.0, fog), mix(1380.0, 140.0, fog), dist), mix(1.15, 0.7, fog));
        col = mix(col, hazeCol(), horizon);
        gl_FragColor = vec4(col, opacity);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const o = new T.Mesh(g, m); o.visible = false; o.renderOrder = 1; o.frustumCulled = false; scene.add(o);
  return o;
})();

/* Himmelkuppel som følger kameraet */
const skyU = { opacity:{ value:0 }, sunDir:oceanU.sunDir, cloud:wxU.cloud, dayF:wxU.dayF, fog:wxU.fog, twi:wxU.twi, flash:wxU.flash, boltDir:wxU.boltDir, dark:wxU.dark };
const sky = (() => {
  const m = new T.ShaderMaterial({
    uniforms:skyU, side:T.BackSide, transparent:false, depthWrite:false, depthTest:false,
    blending:T.CustomBlending, blendSrc:T.SrcAlphaFactor, blendDst:T.OneMinusSrcAlphaFactor,
    vertexShader:`varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
    fragmentShader:`
      uniform float opacity; uniform vec3 sunDir; varying vec3 vDir;
      ${SKY_GLSL}
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*noise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir), c = skyCol(d, sunDir);
        if (d.y > 0.0){
          vec3 G = normalize(vec3(0.35, 0.55, -0.76));
          float gb = dot(d, G), night = 1.0 - smoothstep(0.0, 0.3, dayF);
          if (night > 0.0){
            vec2 mq = d.xz/(d.y + 0.35);
            float body = exp(-gb*gb/0.03)*(0.5 + 0.7*fbm(mq*2.2 + 11.0)) + 0.6*exp(-gb*gb/0.006)*fbm(mq*5.0 + 2.0);
            float dust = smoothstep(0.42, 0.72, fbm(mq*3.4 + 5.5))*exp(-gb*gb/0.008);
            c += vec3(0.6, 0.65, 0.8)*body*(1.0 - 0.75*dust)*0.07*night*(1.0 - cloud)*smoothstep(0.02, 0.3, d.y);
          }
          vec2 uv = d.xz/(d.y + 0.1)*1.3;
          float cl = smoothstep(mix(0.6, 0.22, cloud), mix(0.84, 0.52, cloud), fbm(uv + vec2(3.1, 7.7)))*smoothstep(0.04, 0.3, d.y);
          float sh = fbm(uv*1.8 + vec2(5.0, 1.0));
          vec3 cc = mix(vec3(0.82, 0.86, 0.92), vec3(1.05), sh)*mix(1.0, 0.62, cloud)*(1.0 - 0.55*dark);
          cc = mix(vec3(0.03, 0.04, 0.06), cc, dayF);
          { vec2 dh2 = normalize(d.xz + 1e-4), sh2 = normalize(sunDir.xz + 1e-4); float sgc = pow(max(dot(dh2, sh2), 0.0), 2.0);
            cc = mix(cc, cc*mix(vec3(0.55, 0.4, 0.55), vec3(1.2, 0.52, 0.26), sgc), twi*(1.0 - 0.5*cloud)); }
          c = mix(c, cc, cl*0.9*(1.0 - 0.6*fog));
        }
        c += mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.55, 0.2), twi)*pow(max(dot(d, sunDir), 0.0), 1600.0)*6.0*(1.0 - cloud)*smoothstep(-0.02, 0.03, sunDir.y);
        gl_FragColor = vec4(c, opacity);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const o = new T.Mesh(new T.SphereGeometry(4000, 48, 24), m);
  o.renderOrder = -100; o.frustumCulled = false; o.visible = false; scene.add(o);
  return o;
})();

/* Stjernehimmel: punkter med ulik lysstyrke og farge, tettere langs Melkeveien */
const starU = { opacity:{ value:0 }, dayF:wxU.dayF, cloud:wxU.cloud, time:{ value:0 }, px:{ value:1 } };
const stars = (() => {
  const N = 4200, pos = new Float32Array(N*3), mag = new Float32Array(N), tint = new Float32Array(N*3), ph = new Float32Array(N);
  const G = new V3(0.35, 0.55, -0.76).normalize(), v = new V3();
  let seed = 7; const rnd = () => { seed = (seed*16807) % 2147483647; return (seed - 1)/2147483646; };
  for (let i = 0; i < N; i++){
    for (let k = 0; k < 40; k++){
      const u = rnd()*2 - 1, f = rnd()*Math.PI*2, r = Math.sqrt(1 - u*u); v.set(r*Math.cos(f), u, r*Math.sin(f));
      if (v.y > -0.05 && (i % 3 !== 0 || Math.abs(v.dot(G)) < 0.16)) break;
    }
    pos.set([v.x*3500, v.y*3500, v.z*3500], i*3);
    mag[i] = Math.pow(rnd(), 3.6);
    const t = rnd(), tc = t < 0.68 ? [1, 1, 1] : t < 0.85 ? [0.78, 0.86, 1.0] : t < 0.96 ? [1.0, 0.9, 0.74] : [1.0, 0.76, 0.6];
    tint.set(tc, i*3); ph[i] = rnd()*6.283;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aMag', new T.BufferAttribute(mag, 1));
  g.setAttribute('aTint', new T.BufferAttribute(tint, 3)); g.setAttribute('aPh', new T.BufferAttribute(ph, 1));
  const m = new T.ShaderMaterial({ uniforms:starU, transparent:true, depthWrite:false, blending:T.AdditiveBlending,
    vertexShader:`attribute float aMag; attribute vec3 aTint; attribute float aPh;
      uniform float opacity; uniform float dayF; uniform float cloud; uniform float time; uniform float px;
      varying vec3 vT; varying float vB;
      void main(){
        float tw = 0.75 + 0.25*sin(time*(1.2 + aMag*1.6) + aPh);
        vB = opacity*(1.0 - cloud*0.9)*tw*(0.3 + aMag);
        vT = aTint;
        gl_PointSize = px*(1.1 + 2.4*aMag);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0);
      }`,
    fragmentShader:`varying vec3 vT; varying float vB;
      void main(){
        float r = length(gl_PointCoord - 0.5)*2.0;
        float a = smoothstep(1.0, 0.1, r)*vB;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vT*a, a);
      }` });
  const o = new T.Points(g, m); o.frustumCulled = false; o.renderOrder = -90; o.visible = false; scene.add(o);
  return o;
})();

/* Bølgehøyde i et punkt, regnet likt som i havshaderen (de samme seks bølgene) */
const GWS = [[0.0, 34.0, 0.30, 0], [0.42, 21.0, 0.17, 0], [-0.55, 13.0, 0.11, 0], [0.9, 8.2, 0.08, 1], [-1.1, 5.1, 0.035, 1], [0.25, 3.1, 0.02, 1]].map(([ang, L, A, sh]) => ({ c:Math.cos(ang), s:Math.sin(ang), L, A, sh }));
function waveH(x, z){
  const ca = oceanU.wdir.value.x, sa = oceanU.wdir.value.y, px = x + oceanU.drift.value, t = oceanU.time.value;
  let h = 0;
  for (const g of GWS){
    const L = g.L*(g.sh ? oceanU.lscaleS.value : oceanU.lscale.value), a = g.A*0.85*(g.sh ? oceanU.ampS.value : oceanU.amp.value);
    const Dx = ca*g.c - sa*g.s, Dz = sa*g.c + ca*g.s, k = 2*Math.PI/L, w = Math.sqrt(9.81*k);
    h += a*Math.sin(k*(Dx*px + Dz*z) - w*t);
  }
  return h;
}
const effPeriod = () => Math.max(WX.period, 3.4*Math.sqrt(Math.max(0, WX.wave)) + 1.5);
const wav = { heave:0, pitch:0, roll:0 };
let camLift = 0, camWaterCheck = true;

/* Vannlinjen rundt skroget: skum og baugbølge tegnes langs denne, så de følger
   skroget når det løftes, stamper og krenger */
const HN = 64, HX0 = -0.3, HX1 = 11.5, hullData = new Uint8Array(HN*4).fill(0);
const hullTex = new T.DataTexture(hullData, HN, 1, T.RGBAFormat);
hullTex.magFilter = hullTex.minFilter = T.LinearFilter; hullTex.needsUpdate = true;
oceanU.hullTex.value = hullTex; oceanU.hullX.value.set(HX0 + OX, HX1 + OX, 5.6, -5.6);
const hlP = new V3(), hlU = new V3();
const HIST = 256, histData = new Uint8Array(HIST*4).fill(0);
const histTex = new T.DataTexture(histData, HIST, 1, T.RGBAFormat);
histTex.wrapS = T.RepeatWrapping; histTex.magFilter = histTex.minFilter = T.LinearFilter; histTex.needsUpdate = true;
oceanU.histTex.value = histTex;
const hist = { head:0, acc:0, fresh:true };
const encB = v => Math.max(0, Math.min(255, Math.round((v - 4)/4*255))), encS = v => Math.max(0, Math.min(255, Math.round((v + 8)/4*255)));
function pushHist(dt){
  const b = encB(oceanU.hullX.value.z), st = encS(oceanU.hullX.value.w);
  if (hist.fresh){ for (let i = 0; i < HIST; i++){ histData[i*4] = b; histData[i*4 + 1] = st; } hist.fresh = false; hist.acc = 0; histTex.needsUpdate = true; }
  hist.acc += dt; let n = 0;
  while (hist.acc >= 0.125 && n < 64){ hist.acc -= 0.125; hist.head = (hist.head + 1) % HIST; histData[hist.head*4] = b; histData[hist.head*4 + 1] = st; n++; }
  if (n) histTex.needsUpdate = true;
  oceanU.histHead.value = hist.head; oceanU.histAge.value = hist.acc;
}
function updateHullLine(){
  heelPivot.updateMatrixWorld(true);
  hlU.set(0, 1, 0).applyQuaternion(heelPivot.quaternion);
  const uy = Math.max(0.5, hlU.y), sea = oceanU.opacity.value > 0.02;
  let bow = -1e9, stern = 1e9; const wl = new Float32Array(HN*2);
  for (let i = 0; i < HN; i++){
    const x = HX0 + (HX1 - HX0)*i/(HN - 1);
    boat.localToWorld(hlP.set(x, 0, 0));
    const yC = sea ? (waveH(hlP.x, hlP.z) - hlP.y)/uy : 0;
    [-1, 1].forEach((sd, ch) => {
      let y = yC, w = halfWidthAt(x, y);
      if (sea){ boat.localToWorld(hlP.set(x, y, sd*w)); y += (waveH(hlP.x, hlP.z) - hlP.y)/uy; w = halfWidthAt(x, y); }
      let lz = 0;
      if (w > 0.005){ boat.localToWorld(hlP.set(x, y, sd*w)); lz = Math.abs(hlP.z); }
      hullData[i*4 + ch] = Math.min(255, Math.round(lz/1.7*255)); wl[i*2 + ch] = lz;
      if (lz > 0.02){ bow = Math.max(bow, x + OX); stern = Math.min(stern, x + OX); }
    });
  }
  hullTex.needsUpdate = true;
  oceanU.hullYaw.value.set(1, 0); oceanU.hullPos.value.set(heelPivot.position.x, heelPivot.position.z);
  if (bow > -1e8) oceanU.hullX.value.z = bow, oceanU.hullX.value.w = stern;
  let so = 0, sw = 0;
  for (let i = 0; i < HN; i++){ const x = HX0 + (HX1 - HX0)*i/(HN - 1) + OX; if (x > bow - 5 && x <= bow && wl[i*2] + wl[i*2 + 1] > 0.05){ so += (wl[i*2 + 1] - wl[i*2])/2; sw++; } }
  oceanU.hullOff.value = sw ? so/sw : 0;
}

/* Regn: streker som faller rundt kameraet og skrår med vinden */
const rainU = { time:{ value:0 }, inten:{ value:0 }, vel:{ value:new V3(0, -9, 0) }, col:{ value:new T.Color(0.78, 0.82, 0.88) }, slen:{ value:1 } };
const rainLines = (() => {
  const N = 9000, pos = new Float32Array(N*6), seed = new Float32Array(N*8), end = new Float32Array(N*2);
  for (let i = 0; i < N; i++){
    const s4 = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let e = 0; e < 2; e++){ seed.set(s4, (2*i + e)*4); end[2*i + e] = e; }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new T.BufferAttribute(seed, 4)); g.setAttribute('aEnd', new T.BufferAttribute(end, 1));
  const m = new T.ShaderMaterial({ uniforms:rainU, transparent:true, depthWrite:false,
    vertexShader:`attribute vec4 aSeed; attribute float aEnd; uniform float time; uniform float inten; uniform vec3 vel; uniform float slen; varying float vA;
      void main(){
        const vec3 BOX = vec3(56.0, 36.0, 56.0);
        vec3 p0 = aSeed.xyz*BOX + vel*time*(0.85 + 0.3*aSeed.w);
        vec3 rel = mod(p0 - cameraPosition + BOX*0.5, BOX) - BOX*0.5;
        vec3 wp = cameraPosition + rel + normalize(vel)*aEnd*(0.45 + 0.45*aSeed.w)*slen + vec3(sin(time*1.3 + aSeed.w*40.0), 0.0, cos(time*1.1 + aSeed.x*40.0))*0.25*(1.0 - slen);
        vA = step(aSeed.w, inten)*(1.0 - smoothstep(10.0, 27.0, length(rel)))*step(0.0, wp.y)*0.5;
        gl_Position = projectionMatrix*viewMatrix*vec4(wp, 1.0);
      }`,
    fragmentShader:`uniform vec3 col; varying float vA;
      void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(col, vA);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }` });
  const o = new T.LineSegments(g, m); o.frustumCulled = false; o.renderOrder = 4; o.visible = false; scene.add(o);
  return o;
})();
let rainClock = 0;
function stepRain(dt, dayF){
  const k = WX.rain;
  rainLines.visible = k > 0.01;
  if (!rainLines.visible) return;
  if (!reduceMotion) rainClock += dt;
  rainU.time.value = rainClock; rainU.inten.value = Math.min(1, k);
  const rr = WX.windDir*Math.PI/180;
  rainU.vel.value.set(-Math.cos(rr)*WX.wind*0.55, -9.5, -Math.sin(rr)*WX.wind*0.55);
  rainU.col.value.setRGB(0.78, 0.82, 0.88).multiplyScalar(0.18 + 0.82*dayF + 1.2*wxU.flash.value);
  oceanU.rain.value = k;
}

/* Torden og lyn */
const storm = { next:2.5, age:9, dist:900, bolt:null };
const boltMat = new T.MeshBasicMaterial({ color:0xf2f5ff, transparent:true, opacity:1, depthWrite:false, blending:T.AdditiveBlending, toneMapped:false, fog:false });
const flashLight = new T.DirectionalLight(C('#cdd8ff'), 0); scene.add(flashLight);
function strike(){
  const fw = new V3(); cam.getWorldDirection(fw); fw.y = 0; if (fw.lengthSq() < 1e-4) fw.set(1, 0, 0); fw.normalize();
  const a = Math.atan2(fw.z, fw.x) + (Math.random() - 0.5)*1.3, dist = 500 + Math.random()*900;
  const base = new V3(cam.position.x + Math.cos(a)*dist, 0, cam.position.z + Math.sin(a)*dist);
  const top = base.clone().add(new V3((Math.random() - 0.5)*260, 520 + Math.random()*200, (Math.random() - 0.5)*260));
  const jag = (A, B, depth, out) => {
    if (depth === 0){ out.push(B.clone()); return; }
    const M = A.clone().lerp(B, 0.5), L = A.distanceTo(B);
    M.x += (Math.random() - 0.5)*L*0.28; M.z += (Math.random() - 0.5)*L*0.28; M.y += (Math.random() - 0.5)*L*0.08;
    jag(A, M, depth - 1, out); jag(M, B, depth - 1, out);
  };
  const main = [top.clone()]; jag(top, base, 6, main);
  const grp = new T.Group();
  const ribbon = (pts, r) => { const c = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.1); grp.add(new T.Mesh(new T.TubeGeometry(c, pts.length*2, r, 5, false), boltMat)); };
  ribbon(main, 2.6*dist/900);
  for (let b = 0; b < 3; b++){
    const i0 = 8 + Math.floor(Math.random()*30), A = main[Math.min(i0, main.length - 2)];
    const B = A.clone().add(new V3((Math.random() - 0.5)*180, -(80 + Math.random()*160), (Math.random() - 0.5)*180));
    const br = [A.clone()]; jag(A, B, 4, br); ribbon(br, 1.3*dist/900);
  }
  if (storm.bolt){ scene.remove(storm.bolt); storm.bolt.traverse(o => o.geometry && o.geometry.dispose()); }
  storm.bolt = grp; scene.add(grp);
  wxU.boltDir.value.set(Math.cos(a), Math.sin(a));
  flashLight.position.set(Math.cos(a)*30, 40, Math.sin(a)*30);
  storm.age = 0; storm.dist = dist; storm.pulses = [0, 0.08 + Math.random()*0.05, 0.2 + Math.random()*0.12, Math.random() < 0.5 ? 0.42 : 9];
}
function stepStorm(dt){
  const on = WX.thunder > 0.5;
  if (on && !reduceMotion){ storm.next -= dt; if (storm.next <= 0){ strike(); storm.next = 5 + Math.random()*10; } }
  storm.age += dt;
  let f = 0; if (storm.pulses) storm.pulses.forEach(t0 => { const x = (storm.age - t0)/0.035; if (x > -1) f = Math.max(f, Math.exp(-x*x*0.5)*(x < 0 ? 0.3 : 1)); });
  wxU.flash.value = f*0.9;
  flashLight.intensity = f*2.2;
  if (storm.bolt){ storm.bolt.visible = f > 0.12; boltMat.opacity = Math.min(1, f*1.3); if (storm.age > 1.2){ scene.remove(storm.bolt); storm.bolt.traverse(o => o.geometry && o.geometry.dispose()); storm.bolt = null; } }
}

/* Fartslys: babord/styrbord i pulpiten og toppmontert lanterne — tenner i mørket */
const NIGHT = { lamps:[] };
(function navLights(){
  function lamp(x, y, z, hex, r){
    const m = new T.Mesh(new T.SphereGeometry(r || 0.028, 10, 8), new T.MeshStandardMaterial({ color:C(hex), emissive:C(hex), emissiveIntensity:0, roughness:0.4 }));
    m.position.set(x, y, z); add(m, boat); NIGHT.lamps.push(m); return m;
  }
  const py = x => deckY(x, 0.86) + 0.74;
  lamp(10.32, py(10.32), -0.84, '#ff2e1f');        // babord, rødt
  lamp(10.32, py(10.32), 0.84, '#17d95f');         // styrbord, grønt
  lamp(RIG.mx, 14.88, 0, '#fff4d6', 0.034);        // masttoppslanterne
})();

/* Speilinger dempes når det er mørkt eller overskyet */
let envMats = null, envDim = 1;
function dimEnvMaps(k){
  if (Math.abs(k - envDim) < 0.004) return;
  if (!envMats){ envMats = []; const seen = new Set(); scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (!seen.has(m) && 'envMapIntensity' in m){ seen.add(m); envMats.push([m, m.envMapIntensity]); } }); }); }
  envDim = k; envMats.forEach(([m, b]) => { m.envMapIntensity = b*k; });
}
const clamp01 = v => Math.min(1, Math.max(0, v));
let motorOnly = false;
const boatSpeed = d => WX.speed != null ? WX.speed : motorOnly ? 3.0 : d.sailSpeed*ease(Math.min(1, sail.p/0.6));
const SUNCOL = { day:C('#fff5e6'), low:C('#ffa25a'), set:C('#ff7438'), moon:C('#9db4dc'), t:new T.Color() };

/* Hoveddriveren: hav, lys og båtens bevegelser i sjøen, kjøres hvert bilde */
let envClock = 0, envWas = false, snapNext = false;
function applyScene(){
  const d = wxDerived(), speed = boatSpeed(d), t = envClock;
  const dtY = Math.max(0, Math.min(0.2, t - applyScene.last || 0)); applyScene.last = t;
  SAIL_WIND = d.r >= 0 ? -1 : 1;                                    // vind fra styrbord → seil til babord
  // vending og jibbing: seilsiden glir over
  if (sail.p < 0.15 || reduceMotion || snapNext) sideS.v = SAIL_WIND;
  else if (sideS.v !== SAIL_WIND){ const rate = Math.abs(d.sgn) > 90 ? 1.1 : 0.55; sideS.v = SAIL_WIND > sideS.v ? Math.min(SAIL_WIND, sideS.v + dtY*rate) : Math.max(SAIL_WIND, sideS.v - dtY*rate); }
  // gennakeren i lett vind når vinden kommer akterlig
  { const th = Math.abs(d.sgn);
    const g = (sail.goal > 0 && !motorOnly && WX.wind > 1.5 && WX.wind < 9.5 && th > 95 && th < 170) ? 1 : 0;
    gen.p = (reduceMotion || snapNext) ? g : (g > gen.p ? Math.min(1, gen.p + dtY/4) : Math.max(0, gen.p - dtY/3)); }
  // havet
  ocean.visible = true; oceanU.opacity.value = 1;
  oceanU.wakeK.value = ease((speed - 0.4)/2.8);
  oceanU.amp.value = Math.min(12, Math.max(0.06, WX.wave/0.9));
  oceanU.rip.value = Math.min(1.6, Math.max(0.3, 0.35 + WX.wind/10));
  oceanU.white.value = ease((WX.wind - 7)/7);
  oceanU.gale.value = ease((WX.wind - 12)/8);
  const rr = d.r*Math.PI/180; oceanU.wdir.value.set(-Math.cos(rr), -Math.sin(rr));
  const Tp = effPeriod(), lsL = Math.min(9, Math.max(0.35, 1.56*Tp*Tp/34)), ampNow = oceanU.amp.value;
  oceanU.lscale.value = lsL; oceanU.lscaleS.value = Math.max(0.6, Math.sqrt(lsL));
  oceanU.ampS.value = ampNow <= 1 ? ampNow : 1 + 0.45*(ampNow - 1);
  oceanU.farR.value = Math.min(1250, 520 + 90*lsL);
  sky.visible = true; skyU.opacity.value = 1;
  // døgn, skyer og tåke
  const dayF = ease((WX.sunEl + 6)/12);
  const cloudE = WX.rain > 0.02 ? Math.max(WX.cloud, 0.6 + 0.4*WX.rain) : WX.cloud, fogE = Math.max(WX.fog, 0.4*WX.rain);
  const darkE = clamp01(0.75*WX.rain + 0.35*WX.thunder);
  wxU.dayF.value = dayF; wxU.cloud.value = cloudE; wxU.fog.value = fogE; wxU.dark.value = darkE;
  wxU.twi.value = clamp01(1 - Math.abs(WX.sunEl - 1)/13);
  dimEnvMaps((0.1 + 0.9*dayF)*(1 - 0.3*cloudE));
  dirFrom(WX.sunEl, WX.sunAz, oceanU.sunDir.value);
  dirFrom(Math.max(WX.sunEl, 4), WX.sunAz, sunTmp); dirFrom(32, WX.sunAz + 160, moonTmp);
  moonTmp.lerp(sunTmp, dayF).normalize().multiplyScalar(SUN0.length());
  sun.position.copy(SUN0).lerp(moonTmp, 1);
  sun.target.position.set(heelPivot.position.x, 0, heelPivot.position.z); sun.target.updateMatrixWorld();
  const iEnv = dayF*1.35*(1 - 0.62*cloudE)*(1 - 0.45*darkE)*ease((WX.sunEl + 1)/7) + (1 - dayF)*0.16;
  sun.intensity = iEnv;
  SUNCOL.t.copy(SUNCOL.day).lerp(SUNCOL.low, ease((16 - WX.sunEl)/16)*(1 - cloudE)).lerp(SUNCOL.set, ease((6 - WX.sunEl)/7)*(1 - 0.8*cloudE)); SUNCOL.t.lerp(SUNCOL.moon, 1 - dayF);
  sun.color.copy(SUNCOL.t);
  hemi.intensity = 0.45 + 0.45*(0.12 + 0.88*dayF)*(1 - 0.4*darkE) + 0.2*cloudE*dayF - 0.45 + 1.4*wxU.flash.value;
  fill.intensity = 0.3*dayF + 0.04;
  renderer.toneMappingExposure = 1 + 0.5*(1 - dayF);
  NIGHT.lamps.forEach(m => { m.material.emissiveIntensity = 0.5 + 3.0*(1 - dayF); });
  // ratt og vindpeker
  const aw = Math.hypot(Math.cos(rr), Math.sin(rr))*WX.wind + speed;
  if (WHEEL){ const amp = 0.04 + 0.022*WX.wind/5 + 0.05*Math.min(2.5, WX.wave/1.2);
    WHEEL.rotation.x = (reduceMotion ? 0 : 1)*(amp*Math.sin(t*0.47 + 0.4) + 0.45*amp*Math.sin(t*1.21 + 1.3) + 1.4*wav.roll); }
  if (WINDEX){ const ax = -Math.cos(rr)*WX.wind - speed, az = -Math.sin(rr)*WX.wind; WINDEX.rotation.y = -Math.atan2(-az, -ax); }
  // krengning mot le og bevegelser i sjøen
  const calm = reduceMotion ? 0 : 1, sh = ease((sail.p - 0.35)/0.65);
  const PX = heelPivot.position.x, PZ = heelPivot.position.z;
  const hAt = (lx, lz) => waveH(PX + lx, PZ + lz);
  const hb = hAt(5.6, 0), hs = hAt(-5.6, 0), hp = hAt(0.3, -1.55), hsb = hAt(0.3, 1.55), hc = hAt(0.3, 0), hf = hAt(2.8, 0), ha = hAt(-2.8, 0);
  const kM = reduceMotion ? 1 : 1 - Math.exp(-dtY/0.12), kH = reduceMotion ? 1 : 1 - Math.exp(-dtY/0.08);
  if (dtY > 0){
    wav.heave += ((hb + hs + hp + hsb + hc + hf + ha)/7 - wav.heave)*kH;
    wav.pitch += (Math.atan2(hb - hs, 11.2) - wav.pitch)*kM;
    wav.roll  += (Math.atan2(hp - hsb, 3.1)*0.8 - wav.roll)*kM;
  }
  { const lx = -1.25, propTop = wav.heave + lx*Math.sin(wav.pitch) - 0.95 + 0.27, wp = hAt(lx, 0) - 0.12;   // propellen skal alltid være under vann
    if (propTop > wp) wav.heave -= propTop - wp; }
  const rock = 0.5 + WX.wind/10, mv = calm;
  const reefH = 1 - 0.25*ease((WX.wind - 12)/6);
  heelPivot.rotation.x = sideS.v*d.heelR*sh*reefH + mv*wav.roll + calm*Math.sin(t*0.53)*0.0025*rock;
  heelPivot.rotation.z = mv*wav.pitch;
  if (propSpin && !reduceMotion) propSpin.rotation.x += dtY*16*(motorOnly ? 1 : (sail.p < 0.5 ? 0.4 : 0));
  heelPivot.position.y = mv*wav.heave + calm*Math.sin(t*0.61)*0.006*rock;
  camLift = mv*wav.heave*0.75;
  oceanU.vel.value = speed; oceanU.foamDrift.value = Math.min(3, speed*0.35);
  if (dtY > 0) updateHullLine();
  pushHist(reduceMotion ? 0 : dtY);
  stepRain(dtY, dayF);
  stepStorm(dtY);
  root.classList.toggle('b3d-night', (1 - dayF) > 0.55);
}
applyScene.last = 0;
