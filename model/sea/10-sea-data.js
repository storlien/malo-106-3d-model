/* ===== Sea trial, part 1: data =====
   The sea trial is a separate viewer. Its code lives only in model/sea/ and reads the boat (hull lines, rig,
   solar arch as currently chosen) through the model's globals. Nothing in model/js depends on it.
   Sources: [S1] yachtdatabase.com review of the Malö 106, [S2] sailboats.schubert.space boat 2702, [E] estimate. */
const SEA = {
  published: {
    displacement: 6600,       // kg, 14,550 lb [S2]
    ballast: 2500,            // kg, 5,512 lb lead [S2], ballast ratio 37.9 %
    capsizeRatio: 1.76,       // [S1][S2]
    comfort: [28.5, 31.4],    // motion comfort ratio [S1]
    immersion: 188,           // kg/cm [S1]
    lwl: 8.60, beamFt: 10.73, loaFt: 34.78, lwlFt: 28.22,   // [S2]
  },
  rho: 1025, g: 9.81,

  // Masses on top of the published displacement are added; masses inside it are placed so the total matches it.
  // [name, kg, height above the drawing's waterline (m), x from the transom (m), length for its own inertia (m)] [E]
  items: [
    ['Mast and spreaders', 72, 8.60, 6.16, 14.3],
    ['Boom, vang and furled mainsail', 50, 2.55, 4.05, 4.1],
    ['Standing rigging', 38, 7.40, 5.80, 13],
    ['Running rigging', 15, 6.00, 5.60, 10],
    ['Genoa on its furler', 36, 8.40, 8.40, 14],
    ['Radar and mast mount', 11.5, 7.75, 6.42, 0],
    ['Engine and gearbox, Volvo Penta MD17', 165, -0.12, 3.60, 0],
  ],
  rest: { y: 0.30, rollGyration: 0.33, pitchGyration: 0.24 },  // hull, deck, interior: height, and gyration radii as fractions of beam and length [E]
  load: { kg: 450, y: 0.35, x: 4.4 },                         // two crew, stores, tanks half full [E]
  sidePanelY: 1.55,                                            // lifeline panels' centre height [E]

  // Hydrodynamic coefficients for a heavy long-fin cruiser [E]
  addedMass: { heave: 0.9, pitch: 0.9, roll: 0.18 },
  damping: { heave: 0.22, pitch: 0.24, roll: 0.12, rollPerKnot: 0.02, rollQuadratic: 2400 },   // fractions of critical (the deep fin damps roll); quadratic in N·m·s²
  rollDepth: 0.5,                    // extra depth over which the wave slope acting on roll is averaged, for the deep fin [E]

  // Sea states on offer. Combinations steeper than waves can stand (Hs above 1/14 of the peak wavelength) are disabled.
  heights: [0.5, 1, 2, 3, 4, 6],      // significant wave height Hs, m
  periods: [4, 6, 8, 10, 12, 14],     // peak period Tp, s
  headings: [['head', 'Head', 180], ['bow', 'Bow quarter', 135], ['beam', 'Beam', 90], ['stern', 'Stern quarter', 45], ['following', 'Following', 0]],
  speeds: [0, 3, 6],                  // knots through the water
  waves: { frequencies: 24, directions: 3, spread: 50, gamma: 3.3, seed: 11 },   // JONSWAP, short-crested with cos² spreading
  maxSteepness: 1/14,
};
