/* ===== Sea trial, part 3: irregular waves and the boat's motion =====
   Waves: a JONSWAP spectrum for the chosen Hs and Tp, short-crested with cos² spreading, as a sum of wave trains.
   Motion: heave, pitch and roll, each a mass-spring-damper driven by the wave pressure on the hull (Froude–Krylov,
   strip by strip along the waterline). Roll uses the full righting-arm curve, so knockdowns and capsizes come out of it.
   Surge, sway and yaw are not modelled: the boat holds her heading and speed. */
const SeaMotion = (() => {
  const g = SEA.g;

  /* Wave trains for one sea state: [kx, kz, amplitude, encounter frequency, phase, k] in the boat frame. */
  function waveTrains(Hs, Tp, headingDeg, knots) {
    const W = SEA.waves, wp = 2*Math.PI/Tp, U = knots*.5144, r = rng(W.seed), out = [];
    const S = w => { const sg = w <= wp ? .07 : .09, x = Math.exp(-((w - wp)**2)/(2*sg*sg*wp*wp)); return Math.pow(w, -5)*Math.exp(-1.25*Math.pow(wp/w, 4))*Math.pow(W.gamma, x); };
    const w0 = .55*wp, w1 = 3.2*wp, dw = (w1 - w0)/W.frequencies; let m0 = 0;
    const freqs = Array.from({ length: W.frequencies }, (_, i) => w0 + (i + .2 + .6*r())*dw);
    freqs.forEach(w => { m0 += S(w)*dw; });
    const scale = (Hs/4)**2/m0, nd = W.directions;
    const dirs = Array.from({ length: nd }, (_, j) => nd === 1 ? 0 : (-1 + 2*j/(nd - 1))*W.spread), dsum = dirs.reduce((a, d) => a + Math.cos(d*Math.PI/180)**2, 0);
    freqs.forEach(w => dirs.forEach(dd => {
      const amp = Math.sqrt(2*S(w)*scale*dw*Math.cos(dd*Math.PI/180)**2/dsum), k = w*w/g, b = (headingDeg + dd + (r() - .5)*8)*Math.PI/180;
      out.push([k*Math.cos(b), k*Math.sin(b), amp, w - k*U*Math.cos(b), r()*Math.PI*2, k]);
    }));
    return out;
  }

  /* Wave forces split into fixed spatial sums per train, so each time step is cheap. */
  function excitation(S, trains) {
    return trains.map(([kx, kz, a, , , k]) => {
      let hc = 0, hs = 0, pc = 0, ps = 0, rc = 0, rs = 0;
      S.strips.forEach(({ x, b, T }) => {
        const att = Math.exp(-k*T*.5), kb = kz*b, sinc = Math.abs(kb) < 1e-6 ? 1 : Math.sin(kb)/kb, w = 2*b*sinc*att*S.stripDx;
        const J = Math.abs(kz) < 1e-6 ? 0 : 2*(Math.sin(kb)/(kz*kz) - b*Math.cos(kb)/kz);   // ∫ z sin(kz z) dz across the strip
        const c = Math.cos(kx*x), s = Math.sin(kx*x);
        hc += w*c; hs += w*s; pc += w*(x - S.LCF)*c; ps += w*(x - S.LCF)*s; const ar = att*Math.exp(-k*SEA.rollDepth); rc += J*ar*S.stripDx*c; rs += J*ar*S.stripDx*s;
      });
      return [hc, hs, pc, ps, rc, rs];
    });
  }

  function create(S, sea) {
    const trains = waveTrains(sea.Hs, sea.Tp, sea.heading, sea.knots), ex = excitation(S, trains), rg = SEA.rho*g, D = SEA.damping, A = SEA.addedMass;
    const m3 = S.m*(1 + A.heave), m4 = S.I44*(1 + A.roll), m5 = S.I55*(1 + A.pitch);
    const c3 = rg*S.Aw, c5 = rg*S.IL, b3 = 2*D.heave*Math.sqrt(c3*m3), b5 = 2*D.pitch*Math.sqrt(c5*m5);
    const b4 = 2*(D.roll + D.rollPerKnot*sea.knots)*Math.sqrt(S.m*g*S.GM*m4), rollScale = S.GM/S.BM;   // wave slope acts through GM, not BM
    const st = { t: 0, z: 0, zd: 0, th: 0, thd: 0, ph: 0, phd: 0, zdd: 0, thdd: 0, phdd: 0 };
    function forces(t) {
      let F3 = 0, M5 = 0, M4 = 0;
      for (let j = 0; j < trains.length; j++) {
        const q = trains[j], e = ex[j], ps = q[3]*t - q[4], c = Math.cos(ps), s = Math.sin(ps), a = q[2];
        F3 += a*(e[0]*c + e[1]*s); M5 += a*(e[2]*c + e[3]*s);
        M4 += a*(e[5]*c - e[4]*s);     // −∫ z p dz: pressure lifting the starboard side rolls her to port
      }
      const ramp = Math.min(1, t/(2*sea.Tp));          // the sea builds up over the first two periods
      return [rg*F3*ramp, rg*M5*ramp, rg*M4*rollScale*ramp];
    }
    function deriv(y, t) {
      const [F3, M5, M4] = forces(t), [z, zd, th, thd, ph, phd] = y;
      const zdd = (F3 - c3*z - b3*zd)/m3, thdd = (M5 - c5*th - b5*thd)/m5;
      const phdd = (M4 - S.m*g*SeaHydro.gzAt(S, ph*180/Math.PI) - b4*phd - D.rollQuadratic*phd*Math.abs(phd))/m4;
      return [zd, zdd, thd, thdd, phd, phdd];
    }
    function step(dt) {
      const y = [st.z, st.zd, st.th, st.thd, st.ph, st.phd], t = st.t;
      const k1 = deriv(y, t), add = (a, b, h) => a.map((v, i) => v + b[i]*h);
      const k2 = deriv(add(y, k1, dt/2), t + dt/2), k3 = deriv(add(y, k2, dt/2), t + dt/2), k4 = deriv(add(y, k3, dt), t + dt);
      const n = y.map((v, i) => v + dt/6*(k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
      [st.z, st.zd, st.th, st.thd, st.ph, st.phd] = n; st.t = t + dt;
      st.zdd = k4[1]; st.thdd = k4[3]; st.phdd = k4[5];
      if (st.ph > Math.PI) st.ph -= 2*Math.PI; if (st.ph < -Math.PI) st.ph += 2*Math.PI;
    }
    const elevation = (x, z, t) => { let e = 0; for (const q of trains) e += q[2]*Math.cos(q[0]*x + q[1]*z - q[3]*t + q[4]); return e; };
    return { st, step, trains, elevation };
  }

  /* Running statistics over the trial. */
  function stats(S) {
    const helm = { x: 1.0, y: 1.25, z: .55 }, mast = { x: SPEC.rig.mastX, y: SPEC.rig.mastTop };
    const acc = { n: 0, roll2: 0, pitch2: 0, heave2: 0, av2: 0, avAbs: 0, zc: 0, lastSign: 0, rollMax: 0, pitchMax: 0, latMax: 0, mastLatMax: 0, knock: 0, inKnock: false, capsized: false, capsizes: 0, t: 0 };
    function add(st, dt) {
      const ph = st.ph, deg = ph*180/Math.PI;
      const av = st.zdd + (helm.x - S.LCF)*st.thdd - helm.z*st.phdd;            // vertical acceleration at the helm
      const lat = (helm.y - S.yG)*st.phdd + g*Math.sin(ph);                         // sideways push felt at the helm
      const mlat = (mast.y - S.yG)*st.phdd;
      acc.n++; acc.t += dt; acc.roll2 += deg*deg; acc.pitch2 += (st.th*180/Math.PI)**2; acc.heave2 += st.z*st.z; acc.av2 += av*av; acc.avAbs += Math.abs(av);
      const sg = Math.sign(av); if (sg && sg !== acc.lastSign) { acc.zc++; acc.lastSign = sg; }
      acc.rollMax = Math.max(acc.rollMax, Math.abs(deg)); acc.pitchMax = Math.max(acc.pitchMax, Math.abs(st.th*180/Math.PI));
      acc.latMax = Math.max(acc.latMax, Math.abs(lat)); acc.mastLatMax = Math.max(acc.mastLatMax, Math.abs(mlat));
      if (Math.abs(deg) > 60 && !acc.inKnock) { acc.knock++; acc.inKnock = true; } else if (Math.abs(deg) < 40) acc.inKnock = false;
      const over = Math.abs(deg) > S.avs; if (over && !acc.capsized) acc.capsizes++; acc.capsized = over;
    }
    function report() {
      const n = Math.max(1, acc.n), rms = v => Math.sqrt(v/n), f = acc.zc/2/Math.max(acc.t, 1), aMean = acc.avAbs/n;
      // motion sickness incidence after two hours, O'Hanlon & McCauley (1974)
      const za = 2.128*Math.log10(Math.max(aMean, 1e-3)/g) - 9.277*Math.log10(Math.max(f, .05)) - 5.809*Math.log10(Math.max(f, .05))**2 - 1.851;
      const msi = 100*.5*(1 + erf(za/Math.SQRT2));
      return { t: acc.t, rollSig: 2*rms(acc.roll2), rollMax: acc.rollMax, pitchSig: 2*rms(acc.pitch2), pitchMax: acc.pitchMax, heaveSig: 4*rms(acc.heave2),
        accRms: rms(acc.av2)/g, latMax: acc.latMax/g, mastLatMax: acc.mastLatMax/g, msi, knock: acc.knock, capsizes: acc.capsizes, capsized: acc.capsized };
    }
    return { add, report };
  }
  function erf(x) { const s = Math.sign(x), a = Math.abs(x), t = 1/(1 + .3275911*a); return s*(1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - .284496736)*t + .254829592)*t*Math.exp(-a*a)); }

  return { create, stats, waveTrains };
})();
