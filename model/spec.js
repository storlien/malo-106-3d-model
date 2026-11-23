/* SY Alizée (Malö 36): every dimension of the model lives in this file.
 *
 * Axes, in metres:  x = forward from the aft face of the transom
 *                   y = up from the design waterline
 *                   z = towards starboard, 0 on the centreline
 *
 * Source tags:
 *   [B] brochure data table       [D] read off the brochure's scale drawing
 *   [P] estimated from photos     [E] engineering estimate, not yet measured
 * When a tape measurement replaces a value, tag it [M] with the date.
 *
 * Drawing scale: x = (G - 122) / 148.85, y = (512 - Gy) / 150, where G is the
 * pixel grid from make_overlays.py. Draft and beam from the data table both
 * reproduce this scale to within 1 %. The drawing shows the optional reverse
 * stern (11.20 m). Alizée has the standard stern (10.60 m, confirmed by owner),
 * so her transom sits at G = 122 and the drawing's stern tip is not part of her.
 */
const SPEC = {
  name: 'Alizée',
  type: 'Malö 36',

  hull: {
    length: 10.60,        // [B] standard stern, confirmed by owner
    beam: 3.35,           // [B]
    draft: 1.58,          // [B]
    floatSink: 0.10,      // [P] real boat floats this much below the drawing's design waterline
    transomRake: 0.05,    // [P] top of transom aft of bottom, m per m of height
    transomCurve: 0.12,   // [P] plan curvature of transom: x = curve * z^2

    // [x, height of sheer]. [D] blended with [P]: photos show a little more spring forward
    sheer: [[0, 1.095], [1.16, 1.085], [2.56, 1.075], [4.56, 1.075], [5.86, 1.09], [7.91, 1.135], [9.26, 1.175], [10.60, 1.235]],

    // [x, half-breadth at sheer] [D], normalised to the published beam
    halfBreadth: [[0, 1.07], [0.524, 1.21], [1.194, 1.39], [1.864, 1.495], [2.539, 1.58], [3.214, 1.64], [3.884, 1.668],
      [4.554, 1.675], [5.224, 1.635], [5.894, 1.56], [6.574, 1.45], [7.244, 1.28], [7.914, 1.06], [8.584, 0.81], [9.254, 0.585], [9.934, 0.28], [10.60, 0]],

    // [x, height of canoe-body centreline, up the stem to the sheer] [D]
    keelLine: [[0, 0.12], [0.264, -0.04], [0.764, -0.19], [1.194, -0.27], [1.864, -0.40], [2.534, -0.51], [3.864, -0.53], [5.464, -0.52], [6.574, -0.487],
      [7.914, -0.387], [8.584, -0.32], [8.854, -0.187], [9.094, 0], [9.254, 0.147], [10.264, 1.01], [10.60, 1.235]],

    // Section shape along the hull: a cubic curve from keel to sheer. [P]
    // bilge = how far out the lower handle reaches, dead = deadrise,
    // side  = how far out the upper handle reaches, drop = how far it sits below the sheer
    shape: [
      // x     bilge dead  side  drop
      [0.00,   0.92, 0.02, 1.00, 0.40],
      [1.16,   0.82, 0.04, 1.00, 0.45],
      [2.66,   0.76, 0.05, 1.00, 0.50],
      [4.56,   0.70, 0.06, 1.00, 0.52],
      [6.56,   0.56, 0.11, 0.98, 0.48],
      [7.91,   0.34, 0.20, 0.92, 0.42],
      [9.06,   0.22, 0.26, 0.82, 0.36],
      [10.60,  0.20, 0.30, 0.72, 0.30],
    ],
  },

  paint: {
    topsides: '#e2d6b2',      // [P] cream gelcoat
    navy: '#14275f',          // [P]
    antifoul: '#17307a',      // [P]
    sheerBand: [0.018, 0.185],// [D] navy band, distance below sheer
    boot: [0.095, 0.185],     // [D] navy boot-top, height above design waterline
    pin: [0.08, 0.095],       // [P] cream pinstripe under the boot-top
    moulding: { from: 0.40, to: 9.01, below: 0.235, height: 0.032, proud: 0.016 }, // [D] raised strake
  },

  keel: {   // [D] levels are [y, leading edge x, trailing edge x, thickness/chord]
    fin: [[-0.30, 6.614, 2.404, 0.085], [-0.52, 6.414, 2.404, 0.085], [-0.72, 5.894, 2.434, 0.092], [-1.58, 4.824, 2.574, 0.105]],
    deadwood: [[-0.18, 2.664, 1.184, 0.075], [-0.52, 2.664, 1.194, 0.075]],
    skeg: [[0.05, 0.844, 0.424, 0.22], [-0.25, 0.624, 0.424, 0.34], [-0.83, 0.554, 0.424, 0.34]],
    rudder: [[0.05, 0.409, 0.164, 0.14], [-0.82, 0.409, 0.024, 0.12], [-0.84, 0.524, 0.024, 0.11], [-1.34, 0.504, -0.036, 0.10]],
    prop: { x: 0.914, y: -0.42, r: 0.19, blades: 3 },  // [D/P]
    shaftFrom: [1.224, -0.405],
  },

  deck: {
    crown: 0.07,              // [E] camber at the centreline
    plank: 0.056,             // [P] teak plank + caulking pitch
    toeRail: { height: 0.05, width: 0.05 }, // [P]
  },

  house: {   // cabin trunk and cockpit coamings, one continuous moulding [D/P]
    aft: 0.286, fwd: 7.984,     // [D] ends at deck level
    topAft: 0.324, topFwd: 7.514, // [D] the raked front runs from topFwd down to fwd
    roof: 1.40,               // [D]
    roofCrown: 0.05,          // [E]
    sideDeck: 0.46,           // [P] minimum side-deck width
    maxHalf: 1.2,             // [P]
    tumble: 0.93,             // [P] top half-width / base half-width
    teakFrom: 4.284,           // [P] coachroof teak starts forward of the windscreen
    band: { y0: 1.265, y1: 1.325, from: 0.286, to: 6.92 }, // [D] navy stripe
    windows: [2.539, 3.444, 5.124, 6.574], // [D] port-light centres
    windowSize: [0.38, 0.135],          // [P]
    windowY: 1.235,                     // [D]
  },

  cockpit: {   // [E/P] pending measurement
    aft: 0.684, fwd: 3.584, halfWidth: 0.86,
    footHalf: 0.40, footAft: 0.944, footFwd: 3.384,
    seat: 0.87, sole: 0.47,
    wheel: { x: 1.384, y: 1.30, r: 0.42 },
    companionHalf: 0.40,
  },

  screen: {    // fixed windscreen on its moulded base [D/P]
    base: [[4.384, 0], [4.384, 0.46], [3.884, 0.92], [1.964, 1.02]],  // plan polyline at the roof, [x, z]
    top: [[3.744, 0], [3.744, 0.42], [3.484, 0.74], [2.184, 0.88]],
    baseY: 1.47, topY: 1.97,
  },

  targa: {     // Malö's moulded mainsheet arch [D/P]
    baseX: 1.684, topX: 2.224, baseHalf: 1.0, topHalf: 0.88, topY: 2.17, width: 0.11, depth: 0.05,
  },

  aftCanvas: { x1: 0.324, y1: 1.46 },  // [P] where the cockpit tent meets the aft coaming

  hatches: [   // [x, z, length, width] [P]
    [5.084, -0.44, 0.50, 0.50], [5.084, 0.44, 0.50, 0.50], [7.214, 0, 0.56, 0.56], [9.004, 0, 0.46, 0.46],
  ],

  rig: {
    mastX: 6.164,              // [D]
    mastTop: 15.78,           // [D]
    mastSize: [0.195, 0.125], // [E] fore-aft, athwart
    spreaders: [[7.05, 1.14], [11.65, 0.80]], // [D/E] height, half-length
    spreaderSweep: 0.10,      // [E]
    chainplateInset: 0.13,    // [P] from the sheer
    boom: { fwd: 6.064, aft: 1.984, y: 2.45, h: 0.155, w: 0.09 }, // [D]
    coverAft: 2.684,           // [P] sail cover end
    stem: [10.564, 1.32],      // [D] forestay foot
    backstay: [0.10, 1.16],   // [D]
    furlerR: 0.05,           // [P] furled genoa in its blue UV strip
  },

  rails: {
    stanchions: [0.524, 2.084, 3.784, 5.634, 7.564], // [D]
    height: 0.62, inset: 0.085, wires: [0.31, 0.60],
    pulpit: { aftX: 9.384, frontX: 10.964, topY: 1.87 },  // [D]
    pushpit: { topY: 1.76, foreX: 0.524 },               // [D/P]
  },
};
