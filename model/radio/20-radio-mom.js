/* ===== HF antenna, part 2: a thin-wire method-of-moments solver =====
   Wires are cut into straight segments. The current is a sum of triangle functions, one over each pair of segments
   meeting at a node, and a half triangle where a wire meets the sea. The sea is a perfect conductor for the currents
   (an image below it) and real sea water for the reflection that shapes the far-field pattern.
   Frame: y up from the sea surface, x forward, z to starboard, metres. Time dependence e^{jωt}.
   Written as one self-contained function so the viewer can also run it in a Web Worker, off the page's thread. */
function hfMoMFactory() {
  const C0 = 299792458, MU = 4e-7*Math.PI, EPS = 1/(MU*C0*C0), ETA = MU*C0;
  const q = (n, t, w) => t.map((x, i) => [[.5 - x/2, w[i]/2], [.5 + x/2, w[i]/2]]).flat().slice(n % 2 ? 1 : 0);
  const G2 = [[.5 - .5/Math.sqrt(3), .5], [.5 + .5/Math.sqrt(3), .5]], G3 = [[.5 - Math.sqrt(.15), 5/18], [.5, 8/18], [.5 + Math.sqrt(.15), 5/18]];
  const G4 = q(4, [.3399810435848563, .8611363115940526], [.6521451548625461, .3478548451374538]);
  const G8 = q(8, [.1834346424956498, .5255324099163290, .7966664774136267, .9602898564975363], [.3626837833783620, .3137066458778873, .2223810344533745, .1012285362903763]);

  /* Wires {a, b, r, metal} → segments, nodes and basis functions. */
  function build(wires, segLen) {
    const segs = [], nodes = new Map(), key = p => p.map(v => Math.round(v*1000)).join(',');
    const node = p => { const k = key(p); if (!nodes.has(k)) nodes.set(k, { p, ends: [] }); return nodes.get(k); };
    wires.forEach((w, wi) => {
      const d = w.b.map((v, i) => v - w.a[i]), len = Math.hypot(...d); if (len < 1e-3) return;
      const n = Math.max(1, Math.round(len/segLen)), t = d.map(v => v/len);
      for (let i = 0; i < n; i++) {
        const A = w.a.map((v, k) => v + d[k]*i/n), B = w.a.map((v, k) => v + d[k]*(i + 1)/n);
        const s = { A, B, t, L: len/n, r: w.r, sigma: HF.sigma[w.metal], wire: wi, mid: A.map((v, k) => (v + B[k])/2), halves: [] };
        segs.push(s); node(A).ends.push([s, 'A']); node(B).ends.push([s, 'B']);
      }
    });
    // a half: flow along the segment (sg = +1 from A to B), peak at the node (w = 1 at B, 0 at A)
    const bases = [], half = (s, end, into, b) => {
      const w = end === 'B' ? 1 : 0, sg = into ? (end === 'B' ? 1 : -1) : (end === 'A' ? 1 : -1);
      const h = { s, w, sg, div: sg*(w ? 1 : -1)/s.L, b }; s.halves.push(h); return h;
    };
    nodes.forEach(nd => {
      nd.ground = nd.p[1] < 1e-6;
      if (nd.ground) nd.ends.forEach(([s, e]) => { const b = { node: nd, halves: [] }; b.halves.push(half(s, e, false, bases.length)); bases.push(b); });
      else for (let k = 1; k < nd.ends.length; k++) {
        const b = { node: nd, halves: [] }, [s0, e0] = nd.ends[0], [s1, e1] = nd.ends[k];
        b.halves.push(half(s0, e0, true, bases.length), half(s1, e1, false, bases.length)); bases.push(b);
      }
    });
    return { segs, bases, nodes, N: bases.length, basisAt: p => { const nd = nodes.get(key(p)); return nd ? bases.findIndex(b => b.node === nd) : -1; } };
  }

  /* ∫∫ w(u) w'(v) e^{-jkR}/R over two segments, for the four pairs of ramps; reduced kernel R² = |r - r'|² + a². */
  function pairK(o, A2, t2, L2, a, k, out) {
    out.fill(0);
    const m2 = [A2[0] + t2[0]*L2/2, A2[1] + t2[1]*L2/2, A2[2] + t2[2]*L2/2];
    const dm = Math.hypot(o.mid[0] - m2[0], o.mid[1] - m2[1], o.mid[2] - m2[2]), near = dm < 1.6*Math.max(o.L, L2) + 6*a;
    if (!near) {
      const GQ = dm > 3*Math.max(o.L, L2) ? G2 : G3;          // far pairs need fewer points
      for (let p = 0; p < GQ.length; p++) {
        const u = GQ[p][0], W = GQ[p][1]*o.L, rx = o.A[0] + o.t[0]*o.L*u, ry = o.A[1] + o.t[1]*o.L*u, rz = o.A[2] + o.t[2]*o.L*u;
        for (let q = 0; q < GQ.length; q++) {
          const v = GQ[q][0], dx = rx - A2[0] - t2[0]*L2*v, dy = ry - A2[1] - t2[1]*L2*v, dz = rz - A2[2] - t2[2]*L2*v, R = Math.sqrt(dx*dx + dy*dy + dz*dz + a*a);
          const ww = W*GQ[q][1]*L2/R, c = Math.cos(k*R)*ww, s = -Math.sin(k*R)*ww, f0 = 1 - u, g0 = 1 - v;
          out[0] += c*f0*g0; out[1] += s*f0*g0; out[2] += c*f0*v; out[3] += s*f0*v; out[4] += c*u*g0; out[5] += s*u*g0; out[6] += c*u*v; out[7] += s*u*v;
        }
      }
      return;
    }
    for (const [u, wu] of G8) {
      const dx = o.A[0] + o.t[0]*o.L*u - A2[0], dy = o.A[1] + o.t[1]*o.L*u - A2[1], dz = o.A[2] + o.t[2]*o.L*u - A2[2], W = wu*o.L;
      const l0 = dx*t2[0] + dy*t2[1] + dz*t2[2], d2 = Math.max(dx*dx + dy*dy + dz*dz - l0*l0, 0) + a*a, d = Math.sqrt(d2);
      const I1 = Math.asinh((L2 - l0)/d) + Math.asinh(l0/d), Il = Math.sqrt((L2 - l0)**2 + d2) - Math.sqrt(l0*l0 + d2) + l0*I1;   // ∫1/R, ∫l'/R
      let s1r = Il/L2, s0r = I1 - Il/L2, s1i = 0, s0i = 0;
      for (const [v, wv] of G4) {   // the smooth rest, (e^{-jkR} - 1)/R
        const R = Math.sqrt((v*L2 - l0)**2 + d2), cr = (Math.cos(k*R) - 1)/R*wv*L2, ci = -Math.sin(k*R)/R*wv*L2;
        s1r += cr*v; s1i += ci*v; s0r += cr*(1 - v); s0i += ci*(1 - v);
      }
      const f = [1 - u, u];
      for (let i = 0; i < 2; i++) { out[i*4] += W*f[i]*s0r; out[i*4 + 1] += W*f[i]*s0i; out[i*4 + 2] += W*f[i]*s1r; out[i*4 + 3] += W*f[i]*s1i; }
    }
  }

  /* Impedance matrix at f (MHz), plus lumped resistances {basis: ohms}. */
  function fill(m, fMHz, loads) {
    const N = m.N, w = 2*Math.PI*fMHz*1e6, k = w/C0, cA = w*MU/(4*Math.PI), cP = 1/(4*Math.PI*w*EPS);
    const Zr = new Float64Array(N*N), Zi = new Float64Array(N*N), K = new Float64Array(8), KI = new Float64Array(8), S = m.segs;
    for (let i = 0; i < S.length; i++) for (let j = i; j < S.length; j++) {
      const o = S[i], s = S[j], a = Math.max(o.r, s.r);
      pairK(o, s.A, s.t, s.L, a, k, K);
      const Ai = [s.A[0], -s.A[1], s.A[2]], ti = [s.t[0], -s.t[1], s.t[2]];
      pairK(o, Ai, ti, s.L, a, k, KI);
      const tt = o.t[0]*s.t[0] + o.t[1]*s.t[1] + o.t[2]*s.t[2], ti2 = o.t[0]*ti[0] + o.t[1]*ti[1] + o.t[2]*ti[2];
      const Ksr = K[0] + K[2] + K[4] + K[6], Ksi = K[1] + K[3] + K[5] + K[7], KIsr = KI[0] + KI[2] + KI[4] + KI[6], KIsi = KI[1] + KI[3] + KI[5] + KI[7];
      for (const h of o.halves) for (const g of s.halves) {
        const e = (h.w*2 + g.w)*2, ss = h.sg*g.sg, dd = h.div*g.div;
        // jωμ/4π (f·f') K  +  1/(4πjωε) (∇·f)(∇·f') K, less the same for the image (whose current and charge are reversed)
        const vr = ss*(tt*K[e] - ti2*KI[e]), vi = ss*(tt*K[e + 1] - ti2*KI[e + 1]), pr = dd*(Ksr - KIsr), pi = dd*(Ksi - KIsi);
        const zr = -cA*vi + cP*pi, zi = cA*vr - cP*pr;
        Zr[h.b*N + g.b] += zr; Zi[h.b*N + g.b] += zi;
        if (i !== j) { Zr[g.b*N + h.b] += zr; Zi[g.b*N + h.b] += zi; }
      }
      if (i === j) {                     // skin-effect loss along the conductor
        const Rp = Math.sqrt(Math.PI*fMHz*1e6*MU/o.sigma)/(2*Math.PI*o.r);
        for (const h of o.halves) for (const g of o.halves) Zr[h.b*N + g.b] += Rp*o.L*h.sg*g.sg*(h.w === g.w ? 1/3 : 1/6);
      }
    }
    Object.entries(loads || {}).forEach(([b, R]) => { Zr[b*N + +b] += R; });
    return { Zr, Zi, k, w };
  }

  /* Complex Gaussian elimination with partial pivoting; the right-hand side is overwritten with the answer. */
  function solveLin(N, Zr, Zi, br, bi) {
    for (let c = 0; c < N; c++) {
      let p = c, best = 0;
      for (let r = c; r < N; r++) { const v = Zr[r*N + c]**2 + Zi[r*N + c]**2; if (v > best) { best = v; p = r; } }
      if (p !== c) { for (let j = 0; j < N; j++) { let t = Zr[c*N + j]; Zr[c*N + j] = Zr[p*N + j]; Zr[p*N + j] = t; t = Zi[c*N + j]; Zi[c*N + j] = Zi[p*N + j]; Zi[p*N + j] = t; } let t = br[c]; br[c] = br[p]; br[p] = t; t = bi[c]; bi[c] = bi[p]; bi[p] = t; }
      const dr = Zr[c*N + c], di = Zi[c*N + c], dn = dr*dr + di*di;
      for (let r = c + 1; r < N; r++) {
        const ar = Zr[r*N + c], ai = Zi[r*N + c]; if (!ar && !ai) continue;
        const fr = (ar*dr + ai*di)/dn, fi = (ai*dr - ar*di)/dn;
        const rc = c*N, rr = r*N;
        for (let j = c; j < N; j++) { const xr = Zr[rc + j], xi = Zi[rc + j]; Zr[rr + j] -= fr*xr - fi*xi; Zi[rr + j] -= fr*xi + fi*xr; }
        br[r] -= fr*br[c] - fi*bi[c]; bi[r] -= fr*bi[c] + fi*br[c];
      }
    }
    for (let r = N - 1; r >= 0; r--) {
      let sr = br[r], si = bi[r];
      for (let j = r + 1; j < N; j++) { sr -= Zr[r*N + j]*br[j] - Zi[r*N + j]*bi[j]; si -= Zr[r*N + j]*bi[j] + Zi[r*N + j]*br[j]; }
      const dr = Zr[r*N + r], di = Zi[r*N + r], dn = dr*dr + di*di; br[r] = (sr*dr + si*di)/dn; bi[r] = (si*dr - sr*di)/dn;
    }
  }

  /* Solve with 1 V across the feed basis. Returns the feed impedance, the currents and the power lost in the metal. */
  function solve(m, fMHz, feed, loads) {
    const { Zr, Zi, k, w } = fill(m, fMHz, loads), N = m.N, Ir = new Float64Array(N), Ii = new Float64Array(N);
    Ir[feed] = 1; solveLin(N, Zr, Zi, Ir, Ii);
    const den = Ir[feed]**2 + Ii[feed]**2, Z = { re: Ir[feed]/den, im: -Ii[feed]/den };
    // current at both ends of every segment
    const seg = m.segs.map(s => { const c = [0, 0, 0, 0]; s.halves.forEach(h => { const o = h.w ? 2 : 0; c[o] += h.sg*Ir[h.b]; c[o + 1] += h.sg*Ii[h.b]; }); return c; });
    let loss = 0, earth = 0;
    m.segs.forEach((s, i) => { const [ar, ai, br, bi] = seg[i], Rp = Math.sqrt(Math.PI*fMHz*1e6*MU/s.sigma)/(2*Math.PI*s.r); loss += .5*Rp*s.L*(ar*ar + ai*ai + br*br + bi*bi + ar*br + ai*bi)/3; });
    Object.entries(loads || {}).forEach(([b, R]) => { earth += .5*R*(Ir[b]**2 + Ii[b]**2); });
    return { f: fMHz, k, Z, Ir, Ii, seg, Pin: .5*Ir[feed], loss, earth };
  }

  /* Gain (dBi) towards elevation el and bearing az (radians; bearing from the bow, clockwise to starboard).
     The image's contribution is weighted by the sea's reflection for each polarisation. */
  const csqrt = (re, im) => { const m = Math.hypot(re, im), r = Math.sqrt((m + re)/2), i = Math.sqrt(Math.max(0, (m - re)/2)); return [r, im < 0 ? -i : i]; };
  const cdiv = (ar, ai, br, bi) => { const d = br*br + bi*bi; return [(ar*br + ai*bi)/d, (ai*br - ar*bi)/d]; };
  function fresnel(el, w) {
    const er = HF.sea.er, ei = -HF.sea.sigma/(w*EPS), s = Math.sin(el), c2 = Math.cos(el)**2, [qr, qi] = csqrt(er - c2, ei);
    const Rv = cdiv(er*s - qr, ei*s - qi, er*s + qr, ei*s + qi), Rh = cdiv(s - qr, -qi, s + qr, qi);
    return { Rv, Rh: [-Rh[0], -Rh[1]] };          // Rh sign flipped: the image of a horizontal current is already reversed
  }
  function patternAt(m, sol, el, az, refl) {
    const r = [Math.cos(el)*Math.cos(az), Math.sin(el), Math.cos(el)*Math.sin(az)];
    const ev = [-Math.sin(el)*Math.cos(az), Math.cos(el), -Math.sin(el)*Math.sin(az)], eh = [-Math.sin(az), 0, Math.cos(az)];
    let dvr = 0, dvi = 0, dhr = 0, dhi = 0, ivr = 0, ivi = 0, ihr = 0, ihi = 0;
    m.segs.forEach((s, n) => {
      const [ar, ai, br, bi] = sol.seg[n], tv = s.t[0]*ev[0] + s.t[1]*ev[1] + s.t[2]*ev[2], th = s.t[0]*eh[0] + s.t[2]*eh[2];
      const tvi = -s.t[0]*ev[0] + s.t[1]*ev[1] - s.t[2]*ev[2], thi = -(s.t[0]*eh[0] + s.t[2]*eh[2]);   // image current (-tx, ty, -tz)
      for (const [u, wu] of G2) {
        const x = s.A[0] + s.t[0]*s.L*u, y = s.A[1] + s.t[1]*s.L*u, z = s.A[2] + s.t[2]*s.L*u;
        const Ire = (ar*(1 - u) + br*u)*wu*s.L, Iim = (ai*(1 - u) + bi*u)*wu*s.L;
        let ph = sol.k*(r[0]*x + r[1]*y + r[2]*z), c = Math.cos(ph), sn = Math.sin(ph), pr = Ire*c - Iim*sn, pi = Ire*sn + Iim*c;
        dvr += pr*tv; dvi += pi*tv; dhr += pr*th; dhi += pi*th;
        ph = sol.k*(r[0]*x - r[1]*y + r[2]*z); c = Math.cos(ph); sn = Math.sin(ph); pr = Ire*c - Iim*sn; pi = Ire*sn + Iim*c;
        ivr += pr*tvi; ivi += pi*tvi; ihr += pr*thi; ihi += pi*thi;
      }
    });
    const { Rv, Rh } = refl, Evr = dvr + Rv[0]*ivr - Rv[1]*ivi, Evi = dvi + Rv[0]*ivi + Rv[1]*ivr, Ehr = dhr + Rh[0]*ihr - Rh[1]*ihi, Ehi = dhi + Rh[0]*ihi + Rh[1]*ihr;
    const U = ETA*sol.k*sol.k/(32*Math.PI*Math.PI)*(Evr*Evr + Evi*Evi + Ehr*Ehr + Ehi*Ehi);
    return { G: 4*Math.PI*U/sol.Pin, v: Evr*Evr + Evi*Evi, h: Ehr*Ehr + Ehi*Ehi };
  }
  /* Gain over a grid of elevations (0…90°) and bearings (0…360°), in dBi. */
  function pattern(m, sol, nAz, nEl, extra = 1) {
    const w = sol.k*C0, g = [];
    for (let j = 0; j <= nEl; j++) {
      const el = Math.max(.5, 90*j/nEl)*Math.PI/180, refl = fresnel(el, w), row = [];
      for (let i = 0; i <= nAz; i++) row.push(10*Math.log10(Math.max(1e-9, patternAt(m, sol, el, i/nAz*2*Math.PI, refl).G*extra)));
      g.push(row);
    }
    let best = { G: -99 }; g.forEach((row, j) => row.forEach((v, i) => { if (v > best.G) best = { G: v, el: Math.max(.5, 90*j/nEl), az: i/nAz*360 }; }));
    return { g, nAz, nEl, best };
  }
  return { build, solve, pattern, patternAt, fresnel, C0 };
}
const HFMoM = hfMoMFactory();
