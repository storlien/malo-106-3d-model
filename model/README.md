# SY Alizée: 3D model

Open `../alizee.html` in a browser. It is one self-contained file and works offline.

## Changing the boat

1. Edit the numbers in `spec.js`. Every dimension lives there, tagged with its source.
2. Run `python3 model/build.py`.
3. Reload `alizee.html`. Use **Brosjyretegning** with the **Side** or **Ovenfra** view to compare against the builder's drawing in true scale.

Coordinates are metres: `x` forward from the transom, `y` up from the design waterline, `z` to starboard.

Source tags in `spec.js`: `[B]` brochure data, `[D]` scale drawing, `[P]` photos, `[E]` estimate, `[M]` measured on the boat. Replace `[P]` and `[E]` values with `[M]` as measurements come in.

The brochure drawing shows the optional 11.20 m reverse stern. Alizée has the standard 10.60 m stern, so the drawing's aft tip extends past her transom on purpose.

## Files

- `spec.js`: all dimensions
- `js/20-hull.js`: hull, livery, keel, rudder, propeller
- `js/30-deck.js`: deck, cabin trunk, cockpit, windscreen, hatches, arch
- `js/40-canvas-rig.js`: canvas, rig, rails, stern and bow gear
- `js/50-scene.js`: light, water, cameras, controls
- `make_overlays.py`: extracts the drawing overlays from the brochure
