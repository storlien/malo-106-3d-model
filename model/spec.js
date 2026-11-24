/* SY Alizée (Malö 106): every dimension of the model lives in this file.
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
  type: 'Malö 106',

  hull: {
    length: 10.60,        // [B] standard stern, confirmed by owner
    beam: 3.35,           // [B]
    draft: 1.58,          // [B]
    floatSink: 0.10,      // [P] real boat floats this much below the drawing's design waterline
    transomRake: 0.05,    // [P] top of transom aft of bottom, m per m of height
    transomArc: 2.00,     // [M 2026-11-23] around the curve of the transom, at the top of the navy band
    transomCurve: 0.12,   // [P] plan curvature of transom: x = curve * z^2

    // [x, height of sheer]. [D] blended with [P]: photos show a little more spring forward
    sheer: [[0, 1.095], [1.16, 1.085], [2.56, 1.075], [4.56, 1.075], [5.86, 1.09], [7.91, 1.135], [9.26, 1.175], [10.60, 1.235]],

    // [x, half-breadth at sheer] [D], normalised to the published beam
    halfBreadth: [[0, 0.9229], [0.524, 1.21], [1.194, 1.39], [1.864, 1.495], [2.539, 1.58], [3.214, 1.64], [3.884, 1.668],
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
    prop: { x: 0.914, y: -0.42, r: 0.19, blades: 3, pitch: 0.30 },  // [D/P] polished brass, owner's photo; pitch [E]
    shaftFrom: [1.224, -0.405],   // replaced by the line from the gearbox coupling to the propeller (engine below)
    // Yanmar 3JH5E with KM35A gearbox [M owner], dimensions from Yanmar's drawing 3JH5E_KM35A-2013.06.01.
    // The engine stands just aft of the companionway ladder, front (belt cover) forward. tilt: front up, degrees [E];
    // the KM35A output is angled 7° down from the crankshaft [B Yanmar].
    engine: { name: 'Yanmar 3JH5E, KM35A gearbox', frontX: 2.27, tilt: 7, gearAngle: 7, length: 0.774, kg: 156 },
    bowThruster: { x: 7.90, y: -0.12, d: 0.185 },   // [P] owner's yard photos: about 1 m aft of the bow 'm', 40 % of the way from the boot-top to the keel line; 185 mm tunnel [E]
  },

  deck: {
    crown: 0.07,              // [E] camber at the centreline
    plank: 0.056,             // [P] teak plank + caulking pitch
    toeRail: { height: 0.05, width: 0.05, sternCapTo: 1.00 }, // [P] aft of sternCapTo there is no lowered deck, only a wide solid teak toe rail
  },

  house: {   // cabin trunk and cockpit coamings, one continuous moulding [D/P]
    aft: 0.37, fwd: 7.984,      // [D/P] coamings stop here; the bench runs on aft to the toe rail
    topAft: 0.375, topFwd: 7.514, // [D] the raked front runs from topFwd down to fwd
    frontCorner: 0.22,        // [P] how far the rounded corners of the flat, raked front reach aft
    logo: { width: 0.52, midHeight: 0.54 },   // [P] Malö Yachts logo on the front, width in metres
    roof: 1.40,               // [D]
    roofCrown: 0.05,          // [E]
    sideDeck: 0.46,           // [P] side-deck width amidships
    maxHalf: 1.2,             // [P]
    tumble: 0.93,             // [P] top half-width / base half-width
    teakFrom: 2.33,            // [P] teak from the companionway forward, under the windscreen too
    band: { y0: 1.265, y1: 1.325, from: 0.37, to: 6.92 }, // [D] navy stripe
    windows: [2.539, 3.444, 5.124, 6.574], // [D] port-light centres
    windowSize: [0.38, 0.135],          // [P]
    windowY: 1.235,                     // [D]
  },

  cockpit: {   // from the brochure and broker photos [E/P], replace with tape measurements
    benchDepth: 0.38,         // [M 2026-11-23] helm bench, from the inside of the stern toe rail to the footwell
    aftRail: 0.15,            // [M 2026-11-23] width of the toe rail across the stern
    benchBelowRail: 0.10,     // [M 2026-11-23] bench surface below the top of the toe rail
    benchBack: 0.025,         // sloped cream back between the toe rail and the teak seat
    aftInnerHalf: 0.73,       // [M 2026-11-23] inner width between the coamings at their aft end, and so the bench, is 1.46 m
    aftCorner: 0.10,          // how far the rounded aft corners of the well reach forward
    capWidth: 0.15,           // teak-topped coaming that carries the winches
    fwd: 2.32, halfWidth: 0.86,   // [B][P] companionway bulkhead, at the aft side of the ladder; forward of it, under the windscreen, is a raised teak deck
    footHalf: 0.40, footFwd: 2.32,   // [P] the footwell and seats run right up to the bulkhead
    seat: 0.87, sole: 0.47,
    wheel: { aheadOfBench: 0.25, y: 1.30, r: 0.42 },
    companionHalf: 0.28,      // [P] tall, narrow opening with a teak frame
    threshold: 0.67,          // [P] sill of the companionway, above the footwell sole
  },

  screen: {    // fixed windscreen on its moulded base, read from the brochure drawing and photos [D/P]
    base: [[4.01, 0], [4.01, 0.45], [3.36, 0.94], [1.964, 1.02]],  // plan polyline at the base of the glass, [x, z]; the moulding below carries on in the plane of the glass
    top: [[3.56, 0], [3.56, 0.42], [3.10, 0.80], [2.184, 0.88]],   // one wide centre pane, angled corner panes, long side panes
    baseY: [[1.964, 1.50], [3.36, 1.60], [4.01, 1.66]],            // [x, height]: [B/D] the moulded base rises to the front; the front glass keeps the drawing's rake, so the centre pane is low
    topY: [[2.184, 1.82], [3.10, 1.93], [3.56, 2.00]],             // [x, height]: the top edge rises towards the front
  },

  targa: {     // Malö's moulded mainsheet arch [D/P]
    baseX: 1.684, topX: 2.224, baseHalf: 1.0, topHalf: 0.88, topY: 2.238, width: 0.11, depth: 0.05,
  },

  canvas: {    // navy sprayhood and bimini with side enclosure, from the owner's marina photo [P]
    hoodFrontY: 2.09,                       // hood height at the top of the windscreen
    hoodWindow: { f: [0.14, 0.86], v: [0.18, 0.84] },
    kneeX: 1.02, kneeY: 2.188, aftX: 0.40, aftY: 1.50, crown: 0.045,   // bimini roof line in side view
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
    mastWinch: { aboveRoof: 0.78, scale: 0.6 },   // [B] halyard winch on each side of the mast, height read from the brochure
    spreaders: [[7.05, 1.14], [11.65, 0.80]], // [D/E] height, half-length
    spreaderSweep: 0.10,      // [E]
    spreaderBlade: { rootChord: 0.15, tipChord: 0.105, rootThick: 0.03, tipThick: 0.02 },   // [P] wide, flat aluminium blades, from the owner's photo
    chainplateInset: 0.13,    // [P] from the sheer
    boom: { fwd: 6.064, aft: 1.984, y: 2.45, h: 0.155, w: 0.09 }, // [D]
    coverAft: 2.684,           // [P] sail cover end
    radar: { name: 'Lowrance 3G', diameter: 0.489, height: 0.28, kg: 7.4, aboveSpreader: 0.23, mastGap: 0.015,  // [B] maker's drawing; position is the owner's choice
      // Scanstrut SC20 mast mount [B]: pin = mast fixing pin, holes are measured forward from the pins
      mount: { name: 'Scanstrut SC20', length: 0.395, width: 0.263, pinSpacing: 0.105, armDrop: 0.112, height: 0.232, holeX: [0.159, 0.3005], holeWidth: 0.233 } },
    // Lowrance Broadband 3G beam [B installation guide 2011-12-19]: full vertical beam ±25°, half power within ±12.5°, horizontal 5.2°, shortest range 200 ft.
    // plate: height of the mount plate (the radome's bottom); null = the owner's position, just above the lower spreaders.
    radarBeam: {
      full: 25, main: 12.5, minRange: 61, drawRadius: 40, upRadius: 12, shadowReach: 3.5, azSteps: 180, elSteps: 26, reportLoss: 0.05,
      fullColour: '#f2a541', mainColour: '#e0482b', shadowColour: '#2a1a2e',
      positions: [
        { id: 'belowLower', name: 'Below the lower spreaders', plate: 6.67 },
        { id: 'aboveLower', name: 'Just above the lower spreaders (now)', plate: null, current: true },
        { id: 'middle', name: 'Halfway between the spreaders', plate: 9.30 },
        { id: 'belowUpper', name: 'Below the upper spreaders', plate: 11.27 },
        { id: 'aboveUpper', name: 'Just above the upper spreaders', plate: 11.88 },
      ],
    },
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
    foreAngles: [60, 0],   // Angled arch: fore pipe angle to the toe rail it stands on, degrees; 0 = at the panel edge: the foot stays put and the pipe meets the forward panel edge
    rearAngles: [0, 60],    // selectable rear pipe angles at the top frame, degrees; 0 = unfixed, the pipe meets the aft panel edge at whatever angle the height gives. Add values here to test more.
    // vertical and angled arch heights: headroom from the top of the stern toe rail to the underside of the frame.
    // The bimini top is 1.25 m above the helm bench [M], which is 0.10 m below the toe rail [M].
    archHeights: [{ id: 'bimini', name: 'Same as bimini', headroom: 1.15 }, { id: 'middle', name: 'Middle', headroom: 1.27 }, { id: 'highest', name: 'Highest', headroom: 1.47 }],
    foreLimitX: 0.25,       // where the vertical arch's fore pipes stand, just forward of the pushpit's aft rail
    pipeWall: 0.002,        // [E] wall thickness, for weight and strength
    // Structural check of the straight-piped arches (46-arch-strength.js). Loads are the extremes the arch must survive,
    // from the sea trial and common practice; the frame is welded 316 stainless, feet and transom plates fixed.
    strength: {
      E: 193e9, yield: 205e6, gamma: 1.25,   // 316L welded tube: the weld zone is annealed, so its yield is used; utilisation = stress / (yield / gamma)
      fatigueRange: 40,                      // MPa stress range for welded tube joints over millions of rolls (about FAT 40)
      sleeveLength: 0.3,                     // m of inner sleeve at each foot
      colourScale: { avg: 0.6, max: 1.0 },  // stress colours: deep red at this share of the allowed stress
      panelFrame: 0.6,                       // panel end frames (aluminium, bolted) as a fraction of the pipe's bending stiffness
      warnUtil: 0.8, swayLimit: 15, minFreq: 4, element: 0.2, extraKg: 4,   // extraKg: cables, antenna, ensign
      cases: {
        knock: { side: 2.0, down: 0.5 },     // sea trial: knocked down past 90° by a breaking crest (1 g from gravity, ~1 g from the snap roll)
        slam: { down: 3.0, side: 0.5 },      // falling off a wave
        pitch: { fore: 1.5, down: 1.0 },     // burying the bow / hobby-horsing
        wind: { speed: 40, cn: 1.2, drag: 0.35 },   // storm gust at anchor, panels at the worst angle; lift up plus sideways drag
        person: { push: 1000, hang: 1500 },  // N: crew thrown against a corner; crew hanging from the aft tube (or a MOB hoist)
        fatigue: { side: 0.5 },              // ± g at the arch top in everyday rolling: ±13° at 4.2 s in 3 m seas (sea trial)
      },
      // supporting pipes; presets combine them
      braces: { knee: { down: 0.35, inboard: 0.32 }, side: { low: 0.55, along: 0.5 }, stays: { forward: 0.75, outboard: 0.10 }, aftBar: { up: 0.8 }, rungs: { above: 0.25, below: 0.2 } },   // aftBar: 1.8 m clear over the stern platform
      braceNames: [['knee', 'Knee braces'], ['planX', 'X under panels'], ['aftBar', 'Rear truss'], ['side', 'Side diagonals'], ['stays', 'Forward stays'], ['sleeves', 'Foot sleeves'], ['rungs2', '2 side rungs'], ['rungs3', '3 side rungs'], ['rungs4', '4 side rungs']],
      // presets from the analysis with 32 mm pipe (all vertical and angled layouts tried):
      // coastal passes every case except someone hanging from the aft tube; offshore passes all, hanging at the limit; bluewater passes all with margin
      presets: [['off', 'None', []], ['coastal', 'Coastal', ['knee', 'sleeves']], ['offshore', 'Offshore', ['knee', 'stays', 'sleeves']], ['bluewater', 'Bluewater', ['knee', 'aftBar', 'stays', 'sleeves']]],
    },
    backstaySlot: 0.09,     // half-width of the opening around the backstay in the split layout
    warnGap: 0.05,          // clearances below this are flagged as tight
    contactGap: 0.01,       // clearances below this are treated as contact
    sidePanels: { counts: [0, 1, 2], startX: 0.84, standoff: 0.065, topAboveWire: 0.06 },  // hung outside the lifelines, just forward of the pushpit
    ensign: { base: [0.10, 1.22, 1.02], tip: [-0.62, 2.08, 1.02] },  // moved under the panels

    // To add a design, copy one entry and change its numbers. It appears on the page automatically.
    // fwdX is the forward edge of the panels. It must stay aft of the backstay unless layout is 'split'.
    designs: [
      { id: 'vertical', name: 'Vertical arch', note: 'Straight, unbent pipes: vertical fore pipes on the side decks and rear pipes on the transom. The fore pipes stay in one place at every height; choose the rear angle, where it meets the frame and the height below.',
        hoop: { footX: 0.60, footHalf: 1.06, topX: 0.60, topY: 2.60, half: 0.98, bend: 0.20 },
        aftStrut: { footY: 1.00, footHalf: 0.88, standoff: 0.06, straight: true }, fwdX: 0.60 },

      { id: 'angled', alias: 'low', name: 'Angled arch', note: 'Straight, unbent pipes: fore pipes leaning aft from the stern toe rail and rear pipes on the transom. Low weight and windage. You have to duck under the panels at the stern ladder.',
        hoop: { footX: 0.72, footHalf: 1.06, topX: 0.30, topY: 2.26, half: 0.98, bend: 0.18 },
        foreStraight: true,   // two straight fore pipes instead of a bent hoop; their angle is chosen on the page (foreAngles)
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
    stanchions: [2.084, 3.784, 5.634, 7.564], // [D]
    height: 0.62, inset: 0.085, wires: [0.31, 0.60],
    pulpit: { aftX: 9.384, frontX: 10.964, topY: 1.87 },  // [D]
    pushpit: { tube: 0.025, topAboveRail: 0.62, opening: 0.42, aftSide: 0.80, foreTop: 0.26, foreBottom: 0.60, footInset: 0.075 },  // [M 2026-11-23] except footInset [P]
                    // [D/P]
  },
};
