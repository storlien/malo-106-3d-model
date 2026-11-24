/* ===== Sea trial, part 1: data =====
   The sea trial is a separate viewer. Its code lives only in model/sea/ and reads the boat (hull lines, rig,
   solar arch as currently chosen) through the model's globals. Nothing in model/js depends on it.
   Sources: [S1] yachtdatabase.com review of the Malö 106, [S2] sailboats.schubert.space boat 2702, [E] estimate. */
const SEA = {
  published: {
    displacement: 6100,       // kg [M owner]; the sources give 6,600 kg (14,550 lb) [S2]
    ballast: 2500,            // kg lead [M owner], 5,512 lb [S2]
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
  load: { kg: 300, y: 0.40, x: 3.8 },                         // two crew and their stores [E]
  sidePanelY: 1.55,                                            // lifeline panels' centre height [E]

  // Hydrodynamic coefficients for a heavy long-fin cruiser [E]
  addedMass: { heave: 0.9, pitch: 0.9, roll: 0.18 },
  damping: { heave: 0.22, pitch: 0.24, roll: 0.12, rollPerKnot: 0.015, rollQuadratic: 2400 },   // fractions of critical (the deep fin damps roll); quadratic in N·m·s²
  rollDepth: 0.5,                    // extra depth over which the wave slope acting on roll is averaged, for the deep fin [E]

  // Sea states on offer. Combinations steeper than waves can stand (Hs above 1/14 of the peak wavelength) are disabled.
  heights: [0.5, 1, 2, 3, 4, 6, 8, 10],   // significant wave height Hs, m
  periods: [4, 5, 6, 7, 8, 10, 12, 14],   // peak period Tp, s; short periods make steep, breaking seas
  headings: [['head', 'Head', 180], ['bow', 'Bow quarter', 135], ['beam', 'Beam', 90], ['stern', 'Stern quarter', 45], ['following', 'Following', 0]],
  // How she is sailed. Heel is the steady heel from the wind on a beat; it falls off as she bears away (heelByHeading).
  // The wind blows from the side the waves come from, so she heels away from them. Sails add roll damping. [E]
  modes: [
    { id: 'drift', name: 'Drifting', knots: 0, heel: 0, sailDamping: 0, sails: false },
    { id: 'light', name: 'Sailing lightly', knots: 5, heel: 12, sailDamping: .06, sails: true },
    { id: 'heavy', name: 'Sailing heavy', knots: 6.5, heel: 25, sailDamping: .09, sails: true },
  ],
  heelByHeading: { head: 1, bow: 1, beam: .85, stern: .55, following: .2 },
  gusts: 0.18,                        // wind moment varies this much, slowly

  // Breaking crests. A wave coming at the boat breaks when its own steepness H/λ passes 0.10–0.14.
  // Its blow is the roll energy E = refEnergy·(H / (0.55·LOA))^power·sin²(wave angle on the beam), delivered in 0.4 s.
  // Calibrated so a breaking wave 55 % of the boat's length beam-on just capsizes a typical 1979 Fastnet yacht
  // (Wolfson Unit tank tests): about 5,000 kg with 0.7 m·rad of righting energy. [E]
  breaking: { steepness: [0.10, 0.14], minHeight: 0.12, refEnergy: 5000*9.81*0.7, power: 1.5, pulse: 0.4 },
  waves: { frequencies: 24, directions: 3, spread: 50, gamma: 3.3, seed: 11 },   // JONSWAP, short-crested with cos² spreading
  maxSteepness: 1/10,                // steeper seas than this are not offered
};
