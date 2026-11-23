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

  platform: {   // curved teak stern platform with a stainless edge tube [P], from the owner's stern photo
    y: 0.43, halfWidth: 0.68, aftHalfWidth: 0.84, depth: 0.50, bulge: 0.06, corner: 0.06, thick: 0.03, plank: 0.085, tube: 0.025,
    stayTopY: 0.78, postHeight: 0.14,
    anchor: { z: -0.78, spread: 0.23, drop: 0.27, shank: 0.50 },   // claw anchor stowed over the port corner roller
  },

  bowAnchor: {   // Delta anchor stowed through the stem, from the owner's photos [P], replace with measurements
    rollerY: 0.82,            // height of the bow roller on the stem
    shank: 0.27,              // roller to crown of the anchor
    shankAngle: 62,           // shank, degrees below horizontal, pointing forward
    head: 0.52,               // crown to toe of the plough
    headAngle: 13,            // plough, degrees below horizontal, toe pointing aft at the hull
    span: 0.36, thick: 0.012,
    slot: 0.13,               // half-length of the opening in the stem
    chainplate: { width: 0.075, thick: 0.007, bottomY: 0.30 },   // forestay chainplate down the stem, past the anchor
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
    aft: 0.37, fwd: 7.984,      // [D/P] coamings stop here; the bench runs on aft to the toe rail
    topAft: 0.375, topFwd: 7.514, // [D] the raked front runs from topFwd down to fwd
    frontCorner: 0.22,        // [P] how far the rounded corners of the flat, raked front reach aft
    logo: { width: 0.52, midHeight: 0.54 },   // [P] Malö Yachts logo on the front, width in metres
    roof: 1.40,               // [D]
    roofCrown: 0.05,          // [E]
    sideDeck: 0.46,           // [P] side-deck width amidships
    sideDeckAft: 0.30,        // [P] side deck narrows towards the stern
    maxHalf: 1.2,             // [P]
    tumble: 0.93,             // [P] top half-width / base half-width
    teakFrom: 4.284,           // [P] coachroof teak starts forward of the windscreen
    band: { y0: 1.265, y1: 1.325, from: 0.37, to: 6.92 }, // [D] navy stripe
    windows: [2.539, 3.444, 5.124, 6.574], // [D] port-light centres
    windowSize: [0.38, 0.135],          // [P]
    windowY: 1.235,                     // [D]
  },

  cockpit: {   // from the brochure and broker photos [E/P], replace with tape measurements
    benchDepth: 0.50,         // X: helm bench, from the inside of the stern toe rail to the footwell
    aftRail: 0.12,            // Y: width of the toe rail across the stern
    benchBack: 0.06,          // sloped cream back between the toe rail and the teak seat
    aftCorner: 0.17,          // how far the rounded aft corners of the well reach forward
    capWidth: 0.17,           // teak-topped coaming that carries the winches
    fwd: 3.584, halfWidth: 0.86,
    footHalf: 0.40, footFwd: 3.384,
    seat: 0.87, sole: 0.47,
    wheel: { aheadOfBench: 0.25, y: 1.30, r: 0.42 },
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

  canvas: {    // navy sprayhood and bimini with side enclosure, from the owner's marina photo [P]
    hoodFrontY: 2.09,                       // hood height at the top of the windscreen
    hoodWindow: { f: [0.14, 0.86], v: [0.18, 0.84] },
    kneeX: 1.02, kneeY: 2.12, aftX: 0.40, aftY: 1.50, crown: 0.045,   // bimini roof line in side view
    windows: [[0.03, 0.52]], windowV: [0.43, 0.90],                   // one side window each side
    aftWindow: { afterKnee: 0.04, end: 0.95, halfWidth: 0.84 },       // large clear window in the flat, raked aft side
  },

  hatches: [   // [x, z, length, width] [P]
    [5.084, -0.54, 0.50, 0.32], [5.084, 0.54, 0.50, 0.32], [7.10, 0, 0.56, 0.56], [9.004, 0, 0.46, 0.46],
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
    radar: { name: 'Lowrance 3G', diameter: 0.489, height: 0.28, kg: 7.4, aboveSpreader: 0.23, mastGap: 0.015,  // [B] maker's drawing; position is the owner's choice
      // Scanstrut SC20 mast mount [B]: pin = mast fixing pin, holes are measured forward from the pins
      mount: { name: 'Scanstrut SC20', length: 0.395, width: 0.263, pinSpacing: 0.105, armDrop: 0.112, height: 0.232, holeX: [0.159, 0.3005], holeWidth: 0.233 } },
    mainsail: { headBelowTop: 0.20, clewInset: 0.14, headWidth: 0.16, roach: 0.22, camber: 0.05, battens: [0.23, 0.44, 0.64, 0.83], logoV: 0.69 }, // [P] owner's photo
    // 140 % roller genoa [M owner]: LP (clew square to the luff) = 1.40 x J (forestay foot to the mast). Trim and shape are [P]
    genoa: { overlap: 1.40, tackF: 0.05, headF: 0.965, clewY: 2.35, clewZ: 1.72, headWidth: 0.13, hollow: 0.10, footRound: 0.05, camber: 0.085, uvWidth: 0.34, uvPrint: '#0b1845', twist: 6 },
    stem: [10.564, 1.32],      // [D] forestay foot
    backstayTop: [5.864, 15.79], // [P] on a short masthead crane aft of the mast, which lets the sail head clear it
    backstay: [0.10, 1.16],   // [D]
    furlerR: 0.05,           // [P] furled genoa in its blue UV strip
  },

  solarArches: {   // DESIGN PROPOSALS in stainless steel. Check against tape measurements before fabrication.
    panel: { length: 0.895, width: 0.580, thick: 0.030, watts: 100, kg: 4.7 }, // [M] owner's panels
    panelCounts: [2, 3, 4],
    panelGap: 0.015,        // [E] between neighbouring panels
    pipes: [0.025, 0.032],  // [M] pipe sizes available to the owner, outer diameter
    rearAngles: [0, 60],    // selectable rear pipe angles at the top frame, degrees; 0 = pipe meets the aft panel edge. Add values here to test more.
    // vertical arch heights: y is the top of the fore pipes above the design waterline; 'fit' is solved so the panels fill the frame
    archHeights: [{ id: 'fit', name: 'Closes gap' }, { id: 'current', name: 'Current', y: 2.60 }, { id: 'lower', name: 'Lower', y: 2.40 }],
    foreLimitX: 0.22,       // furthest aft the fore pipes can stand, just forward of the pushpit's aft rail
    minFitY: 2.20,          // 'Closes gap' never goes below this height
    pipeWall: 0.002,        // [E] used for the weight estimate
    backstaySlot: 0.09,     // half-width of the opening around the backstay in the split layout
    warnGap: 0.05,          // clearances below this are flagged as tight
    contactGap: 0.01,       // clearances below this are treated as contact
    sidePanels: { counts: [0, 1, 2], startX: 0.60, standoff: 0.065, topAboveWire: 0.06 },  // hung outside the lifelines, just forward of the pushpit
    ensign: { base: [0.10, 1.22, 1.02], tip: [-0.62, 2.08, 1.02] },  // moved under the panels

    // To add a design, copy one entry and change its numbers. It appears on the page automatically.
    // fwdX is the forward edge of the panels. It must stay aft of the backstay unless layout is 'split'.
    designs: [
      { id: 'vertical', name: 'Vertical arch', note: 'Straight, unbent pipes: vertical fore pipes on the side decks and rear pipes on the transom. Choose the rear angle and height below.',
        hoop: { footX: 0.60, footHalf: 1.06, topX: 0.60, topY: 2.60, half: 0.98, bend: 0.20 },
        aftStrut: { footY: 1.00, footHalf: 0.88, standoff: 0.06, straight: true }, fwdX: 0.60 },

      { id: 'low', name: 'Low arch', note: 'Lowest weight and windage. You have to duck under the panels at the stern ladder.',
        hoop: { footX: 0.72, footHalf: 1.06, topX: 0.30, topY: 2.26, half: 0.98, bend: 0.18 },
        aftStrut: { footY: 1.00, footHalf: 0.85, standoff: 0.06 }, fwdX: 0.46 },

      { id: 'tall', name: 'Standing height', note: 'You can stand upright on the aft deck. More weight and windage up high, so the frame must be stiffer.',
        hoop: { footX: 0.72, footHalf: 1.06, topX: 0.62, topY: 2.99, half: 0.98, bend: 0.22 },
        aftStrut: { footY: 1.00, footHalf: 0.85, standoff: 0.06 }, fwdX: 0.74 },

      { id: 'split', name: 'Split at backstay', note: 'Panels pass the backstay on each side and reach forward over the cockpit tent, which keeps the overhang short.',
        hoop: { footX: 0.72, footHalf: 1.06, topX: 0.30, topY: 2.345, half: 0.98, bend: 0.18 },
        aftStrut: { footY: 1.00, footHalf: 0.85, standoff: 0.06 }, foreStrut: { footX: 1.30, footHalf: 1.20 },
        layout: 'split', fwdX: { 2: 0.80, 3: 0.98, 4: 0.98 }, fwdXFore: 0.80, centreX: 0.48 },

    ],
  },

  rails: {
    stanchions: [0.524, 2.084, 3.784, 5.634, 7.564], // [D]
    height: 0.62, inset: 0.085, wires: [0.31, 0.60],
    pulpit: { aftX: 9.384, frontX: 10.964, topY: 1.87 },  // [D]
    pushpit: { topY: 1.76, foreX: 0.524, tube: 0.025 },  // tube is [M]
                    // [D/P]
  },
};
