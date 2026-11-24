/* ===== HF antenna, part 1: bands, layouts, wire lengths and matching =====
   The wire is modelled with the rig as thin conductors over the sea and solved by the method of moments
   (20-radio-mom.js). 30-radio-view.js draws the wire, the currents and the beam pattern, and holds the panel.
   [E] marks estimates; positions of the wire are the owner's plan: fed at the aftmost starboard corner. */
const HF = {
  // amateur bands, IARU region 1 (MHz): low edge, high edge, the frequency shown
  bands: [
    { id: '160', name: '160 m', lo: 1.810, hi: 2.000, f: 1.850 },
    { id: '80', name: '80 m', lo: 3.500, hi: 3.800, f: 3.650 },
    { id: '60', name: '60 m', lo: 5.3515, hi: 5.3665, f: 5.360 },
    { id: '40', name: '40 m', lo: 7.000, hi: 7.200, f: 7.100 },
    { id: '30', name: '30 m', lo: 10.100, hi: 10.150, f: 10.125 },
    { id: '20', name: '20 m', lo: 14.000, hi: 14.350, f: 14.175 },
    { id: '17', name: '17 m', lo: 18.068, hi: 18.168, f: 18.118 },
    { id: '15', name: '15 m', lo: 21.000, hi: 21.450, f: 21.225 },
    { id: '12', name: '12 m', lo: 24.890, hi: 24.990, f: 24.940 },
    { id: '10', name: '10 m', lo: 28.000, hi: 29.700, f: 28.500 },
  ],
  sea: { er: 80, sigma: 5 },                       // sea water, for the reflection off the sea far from the boat
  sigma: { copper: 5.8e7, stainless: 1.4e6, alu: 3.5e7 },
  groundOhm: 3,                                    // [E] tuner earth through a sintered plate or the keel bolts into the sea
  tunerQ: { L: 100, C: 600 },                      // [E] coil and capacitor quality of a typical automatic tuner
  radioTuner: 3,                                   // most HF radios' built-in tuners match up to 3:1
  segment: 0.70,                                   // m, about a fifteenth of a wavelength on 10 m
  // where the wire runs, in the boat frame
  feed: { x: 0.35, inset: 0.08, above: 0.05 },     // tuner and deck insulator at the aftmost starboard corner
  slopeTop: { dx: -0.30, below: 0.60, z: 0.15 },   // insulator below the masthead block, hoisted on a halyard aft of the mast
  apex: { dx: 0.22, below: 0.45, z: 0.14 },        // over a block just forward of the masthead, clear of the mast
  bow: { x: 9.70, above: 0.65, z: 0.55 },          // tied off at the starboard side of the bow pulpit
  rodRise: 15,                                     // degrees the rod points up from horizontal
  rodMax: 3,                                       // m, longer rods are marked as impractical
  rods: [
    { id: 'aft', name: 'Aft', dir: [-1, 0] },
    { id: 'quarter', name: 'Aft and out', dir: [-0.7071, 0.7071] },
    { id: 'out', name: 'Out to starboard', dir: [0, 1] },
  ],
  // conductors: radius (m) and metal
  wires: {
    antenna: [0.0012, 'copper'],  // 2.5 mm² stranded copper
    lead: [0.008, 'copper'],      // 25 mm copper strap from the tuner to the sea earth
    post: [0.03, 'alu'],          // compression post and keel bolts, mast to the lead keel
    mast: [0.08, 'alu'], spreader: [0.02, 'alu'], boom: [0.045, 'alu'], crane: [0.02, 'alu'],
    forestay: [0.012, 'alu'],     // stay inside the aluminium furler foil
    stay: [0.0042, 'stainless'], backstay: [0.0045, 'stainless'], bond: [0.003, 'copper'],
  },
  layouts: [
    { id: 'sloper', name: 'End-fed, stern to masthead', matches: ['tuner', 'unun9', 'unun49'],
      lengths: [['fit', 'Just reaches the masthead'], [8.8, '8.8 m (29 ft)'], [10.1, '10.1 m, half wave on 20 m'], [10.8, '10.8 m (35½ ft)'], [12.5, '12.5 m (41 ft)'], [17.7, '17.7 m (58 ft), on a rod'], [20.1, '20.1 m, half wave on 40 m, on a rod']] },
    { id: 'vee', name: 'End-fed inverted V, stern over the masthead to the bow', matches: ['tuner', 'unun9', 'unun49'],
      lengths: [[17.7, '17.7 m (58 ft)'], [20.1, '20.1 m, half wave on 40 m'], [21.6, '21.6 m (71 ft)'], [25.6, '25.6 m (84 ft)'], ['fit', 'All the way to the bow']] },
    { id: 'dipole', name: 'Inverted-V dipole fed at the masthead', matches: ['balun', 'tuner'],
      lengths: [[13.1, '2 × 13.1 m, for 60 m'], [9.95, '2 × 9.95 m, for 40 m'], [6.95, '2 × 6.95 m, for 30 m'], [4.97, '2 × 4.97 m, for 20 m'], [3.32, '2 × 3.32 m, for 15 m'], [2.47, '2 × 2.47 m, for 10 m']] },
  ],
  matches: {
    tuner: { name: 'Autotuner at the feed', ratio: 1, tuner: true },
    unun9: { name: '9:1 unun', ratio: 9 },
    unun49: { name: '49:1 transformer', ratio: 49 },
    balun: { name: '1:1 choke balun', ratio: 1 },
  },
  pattern: { radius: 13, floorDb: 30, az: 72, el: 30 },   // drawn lobe: metres for the strongest direction, dB shown below it, grid steps
  vhfTargets: [['Handheld VHF, 2 m up', 2], ['Another yacht\'s masthead, 15 m', 15], ['Coast station, 100 m', 100]],
};
