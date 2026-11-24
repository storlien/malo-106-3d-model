/* ===== Interior, part 2c: fit to the hull =====
   Joinery is built from straight faces; this pass trims every interior surface to the inside of the hull lining,
   the way a joiner scribes a panel to the hull, so nothing shows through the hull from outside. */
(function fitToHull() {
  boat.updateMatrixWorld(true);
  const BT = SPEC.keel.bowThruster, toBoat = new T.Matrix4(), toLocal = new T.Matrix4(), inv = new T.Matrix4().copy(boat.matrixWorld).invert(), v = new V3();
  G.interior.traverse(m => {
    if (!m.isMesh) return;
    toBoat.multiplyMatrices(inv, m.matrixWorld); toLocal.copy(toBoat).invert();
    const P = m.geometry.attributes.position; let moved = false;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(toBoat);
      const x = clamp(v.x, .02, L - .02);
      if (v.y > sheerY(x) - .03) continue;                                 // above the hull: deck and coachroof handle it
      let floor = keelY(x) + INT.lining;
      if (Math.abs(x - BT.x) < BT.d/2 + .14) floor = Math.max(floor, BT.y + BT.d/2 + .03);   // stay clear above the bow thruster tunnel
      const y = Math.max(v.y, floor), w = Math.max(0, hullHalf(x, y) - INT.lining*.5);
      if (y === v.y && Math.abs(v.z) <= w) continue;
      v.y = y; v.z = Math.sign(v.z)*Math.min(Math.abs(v.z), w);
      v.applyMatrix4(toLocal); P.setXYZ(i, v.x, v.y, v.z); moved = true;
    }
    if (moved) { P.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); }
  });
})();
