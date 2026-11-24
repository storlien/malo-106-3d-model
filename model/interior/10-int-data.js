/* ===== Interior, part 1: layout =====
   The interior is a separate viewer. Its code lives only in model/interior/ and reads the hull and deck through the
   model's globals; nothing in model/js depends on it.
   Positions come from the brochure's accommodation plan, scaled to the model (the mast lands at 6.17 m on both),
   and from the owner's photos. Boat frame: x forward from the transom, y up from the drawing's waterline, z to starboard.
   [B] brochure plan, [P] owner's photos, [E] estimate. */
const INT = {
  sole: -0.38,            // [E] saloon sole, which gives about 1.8 m headroom under the coachroof ("full standing height" [B])
  foreSole: -0.12,        // [E] forward cabin sole, a step up
  aftSole: -0.38,         // [B] head and aft-cabin floors are level with the saloon sole
  lining: 0.022,          // hull lining thickness

  saloon: { aft: 4.15, fwd: 6.30 },                       // [B]
  dinette: { aft: 4.15, fwd: 6.25, inner: 0.80, legInner: 0.12, seat: 0.43, cushion: 0.10, back: 0.46 },   // port U [B][P], heights above the sole
  table: { aft: 4.69, fwd: 5.63, port: -0.66, stbd: 0.06, height: 0.76, leaf: 0.30 },   // [B][P] with a drop leaf to starboard
  settee: { aft: 4.30, fwd: 6.25, inner: 0.68 },          // starboard [B][P], curved at its forward end
  pole: { x: 4.20, z: 0.60, r: 0.032 },                   // [P] mahogany grab pole at the aft end of the saloon
  lockers: { bottom: 0.57, top: 1.00, depth: 0.30 },      // [P] lockers and bookshelves above the settee backs, up under the side deck (heights in the boat frame)

  forwardBulkhead: 6.30, doorHalf: 0.30, wardrobe: { aft: 6.30, fwd: 6.85 },   // [B] hanging lockers each side of the door
  vBerth: { aft: 6.88, fwd: 8.86, height: 0.52, floorFwd: 7.45, floorHalf: 0.30 },   // [B][P] above the forward-cabin sole

  galley: { aft: 2.94, fwd: 4.02, inner: -0.80, legAft: 3.55, legInner: -0.10, height: 0.90 },   // port, L-shaped: outboard counter, and a forward leg reaching in to the steps [B][P]
  stove: { x: 3.22, z: -0.80 },                           // [B][P] gimballed cooker with oven in the outboard counter, facing the centreline
  sink: { x: 3.78, z: -0.42, half: [0.16, 0.22] },        // [B][P] in the forward leg
  nav: { aft: 2.94, fwd: 4.02, inner: 0.88, seatFwd: 3.36, table: 0.78 },   // starboard, the navigator faces forward [B]
  // Aft end, from the owner's marked-up brochure plan (2026-11-24): ladder on the centreline between the head and the aft cabin,
  // each with an angled door in its forward inboard corner
  steps: { topX: 2.32, botX: 2.76, z: 0.0, half: 0.26, treads: 4 },   // [B] companionway ladder, rising aft
  head: { aft: 1.80, fwd: 2.95, inner: 0.28, floorAft: 2.30, door: [[2.77, 0.28], [2.95, 0.90]], toilet: [2.04, 0.60], basin: [2.37, 2.90] },   // starboard aft [B][P]
  aftCabin: { aft: 0.42, fwd: 2.37, inner: -0.27, berth: 0.40, floorFwd: 2.74, wall: -0.31, door: [[2.74, -0.31], [2.95, -0.78]] },   // port aft: berth, then a standing area [B][P]

  colours: { mahogany: '#8a3f1e', trim: '#6e2f14', cushion: '#aebdc6', headliner: '#f1ede4', laminate: '#d9e0e4', sole: '#7a4524', holly: '#e0c79a' },   // [P]
};
