# SY Alizée: 3D model

Open `../public/index.html` in a browser. It is one self-contained page and works offline.

## Changing the boat

1. Edit the numbers in `spec.js`. Every dimension lives there, tagged with its source.
2. Run `python3 model/build.py`.
3. Reload the page. Use **Brochure drawing** with the **Side** or **Top** view to compare against the builder's drawing in true scale.

Coordinates are metres: `x` forward from the transom, `y` up from the design waterline, `z` to starboard.

Source tags in `spec.js`: `[B]` brochure data, `[D]` scale drawing, `[P]` photos, `[E]` estimate, `[M]` measured on the boat. Replace `[P]` and `[E]` values with `[M]` as measurements come in.

The brochure drawing shows the optional 11.20 m reverse stern. Alizée has the standard 10.60 m stern, so the drawing's aft tip extends past her transom on purpose.

## Solar arch designs

In the **Solar arch** panel, choose a design, 2, 3 or 4 panels, the panel orientation, 25 or 32 mm pipe, and 0, 1 or 2 panels per side hung along the lifelines. Heights, size, clearances, power and weight are measured from the finished geometry.

To add a design, copy an entry in `solarArches.designs` in `spec.js`, change its `id`, name and numbers, and rebuild. Clearances under `warnGap` are flagged as tight. A link can open one configuration, for example `#arch=split&panels=4&layout=fore&pipe=32`.

## Deploying on Vercel

The site is the static page `public/index.html`, which is committed. Vercel only serves that folder, so `photos/` is not published as part of the site. Run `python3 model/build.py` and commit the result before pushing a change.

## Files

- `spec.js`: all dimensions
- `js/20-hull.js`: hull, livery, keel, rudder, propeller
- `js/30-deck.js`: deck, cabin trunk, cockpit, windscreen, hatches, arch
- `js/40-canvas-rig.js`: canvas, rig, rails, stern and bow gear
- `js/45-solar-arch.js`: builds the solar arch designs and measures them
- `js/50-scene.js`: light, water, cameras, controls
- `sea/`: the **Sea trial** viewer, kept apart from the model. It reads the boat as configured (solar arch included) and nothing in `js/` depends on it.
  - `sea/10-sea-data.js`: published Malö 106 data, masses, sea states and coefficients
  - `sea/20-sea-hydro.js`: weight, hydrostatics and the righting-arm curve from the hull lines
  - `sea/30-sea-motion.js`: irregular waves and the heave, pitch and roll solver
  - `sea/40-sea-view.js`: the wave surface, the boat's motion and the panel
- `interior/`: the **Interior** viewer, kept apart in the same way. Nothing in `js/` or `sea/` depends on it.
  - `interior/10-int-data.js`: layout positions and colours, from the brochure plan and the owner's photos
  - `interior/20-int-build.js`: the joinery, cushions, sole, ceiling and fittings
  - `interior/30-int-view.js`: the places to look from and the panel
- `make_overlays.py`: extracts the drawing overlays from the brochure
