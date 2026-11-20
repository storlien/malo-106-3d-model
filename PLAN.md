# Plan: SY Alizée 3D Model — Boat First, Then Solar Arch

**Goal:** A dimensionally correct 3D model of *Alizée*. That model is then used to
design a solar/targa arch for the stern, ending with an exact fabrication package.
**The boat model is the current phase; the arch comes after we're happy with the boat.**

---

## 1. Core idea: the model is code, not a drawing

The model will be **parametric Python** — every dimension is a named parameter in
small YAML files, and all geometry, previews, and fabrication reports are generated
from those numbers:

- **You specify a change** ("sheer is 3 cm higher at the bow", "cockpit is 40 cm longer")
  → I edit one parameter → everything regenerates consistently.
- **"Reading off dimensions" never means squinting at a viewport.** The same numbers
  that build the geometry produce the reports, so model and dimensions can't drift apart.
- Every iteration is versionable (git) and exactly reproducible.

## 1b. Boat model: stack, workflow, and "good enough" definition

**Stack for the boat (decided, validated):**

| Layer | Choice | Why |
|---|---|---|
| Geometry kernel | **build123d 0.13** (Python + OpenCascade, in `.venv`) | True CAD kernel: hull **lofts through stations**, exact curved surfaces, native exact-distance queries, STEP/GLB export. Smoke-tested: bent hollow tube matched hand calcs to 0.1 mm. |
| Parameters | `params/boat.yaml` | Single source of truth; every station/offset tweakable; versioned in git. |
| Hull construction | Lofted transverse stations (keel→sheer per station, half-sections mirrored) | Exactly how real lines plans work — measured offsets drop straight into the same structure. |
| My self-check | Orthographic PNG renders (auto-generated every build) + dimension assertions | I can read the PNGs myself and verify LOA/beam/freeboard/draft against the YAML automatically on each build — the build fails loudly if geometry and parameters disagree. |
| Your check | Self-contained **three.js GLB viewer** (single HTML, no internet needed) + the PNG renders | You orbit/zoom and compare against photos of the real boat. |
| Your verification tool | FreeCAD 1.1 opening `out/alizee.step` | Measure anything yourself, independently of me. |

**Workflow — the loop for getting the boat right:**

1. **Ingest reference** (published specs, layout drawings, photos; later: measurements)
   → `params/boat.yaml`.
2. **Generate**: `./build` → hull + deck + coachroof + cockpit + keel/rudder + rig +
   deck furniture; exports STEP + GLB + viewer HTML + renders + dimension report.
3. **Assert**: automated checks compare modeled LOA/beam/sheer/draft to YAML (±0.1 mm)
   and print a pass/fail table into `out/report.md`.
4. **You review** the viewer/renders against your photos and your memory of the boat;
   you tell me what's wrong ("bow too plumb", "freeboard too low aft").
5. **Measure**: once visually right, you take my tailored measurement checklist to the
   boat (~1 h, tape + plumb line + phone inclinometer); I replace estimated values with
   measured ones and we repeat 2–4 until it checks out.

**Definition of "good" for the boat model:**

| Region | Standard |
|---|---|
| Stern zone (transom, deck, rails, bimini, backstay — where the arch lands) | **mm-exact** to your measurements |
| Hull proportions & character (bow shape, sheer spring, transom) | visually matches photos from all angles; overall dims within ~2 cm of published/measured |
| Deck layout (cockpit, coachroof, stanchions, hardware positions) | recognizable and dimensionally sane; hardware exactness only where needed later |
| Rig | mast/boom position and stay geometry right; visual otherwise |

## 2. Recommended tech stack

| Layer | Choice | Why |
|---|---|---|
| **Geometry kernel** | **build123d** (Python, OpenCascade/OCCT) | Real CAD kernel → exact BREP geometry, true curved tube bends, STEP export for fabricators, programmatic measurement (exact distances, collisions). Modern successor to CadQuery, headless, no GUI needed. |
| **Parameters** | YAML (`params/boat.yaml`, `params/arch.yaml`) | Human-readable single source of truth for every dimension; you can see and edit the numbers directly. |
| **Boat reference** | Your tape-measure offsets (checklist from me) + photos | A hull surface scan is cm-accurate at best; what the arch needs is exact *mounting geometry* (deck, transom, rails, backstay), which tape + plumb line + phone inclinometer delivers better than photogrammetry. |
| **Preview for you** | Self-contained **three.js GLB viewer** (single HTML file) + PNG/SVG renders | You orbit/zoom the boat + arch in the browser preview; I check renders myself each iteration. Regenerated automatically after every change. |
| **Dimension readout** | Auto-generated fabrication report (Markdown + CSV) + STEP + DXF templates | Cut lengths, bend schedule, hole layouts, assembly diagonals — computed, not measured. |
| **Your inspection** | **FreeCAD 1.1 (already installed)** opening the STEP file | You can independently measure anything in the model yourself — good sanity check that the model is *your* boat. |
| **Optional polish** | **Blender 5.0.1 (already installed)** | Photorealistic render of the agreed design, at the end. |
| **Optional MCP** | `build123d-mcp` added to OpenCode | Interactive CAD tools (build step-by-step, measure, render, fix) instead of always re-running scripts. Nice-to-have, not required. |

Environment (verified): Python 3.14 + uv, FreeCAD 1.1, Blender 5.0.1, 127 GB free disk.
A dedicated `uv` venv (Python 3.12) holds build123d 0.13 — installed and **smoke-tested**:

- bent hollow tube (annulus sweep, true arcs): centerline & volume match hand calcs to 0.1 mm / 0.01%
- exact clearance query (`Shape.distance_to` / OCCT BRepExtrema): works, agrees with hand calc
- exports: STEP ✓ (re-imported headless in FreeCAD 1.1 with identical volume), STL ✓, binary GLB ✓ (valid `glTF` magic)

## 3. Why not the alternatives

- **OpenSCAD** — scriptable and AI-friendly, but mesh-only CSG: no STEP/BREP, no exact
  curved bends (tube bending needs true arcs + tangent control), no exact distance/collision
  queries, weak exports for a metal fabricator. Great for 3D printing; wrong for this.
- **FreeCAD scripting as authoring tool** — same kernel, but the Python API is clunkier and
  GUI-coupled; FreeCAD stays as *your viewer* and for TechDraw dimensioned drawings if wanted.
- **Blender as authoring tool** — excellent renders, weak for dimension-driven design:
  booleans on meshes are fragile, no STEP, measurements manual, no bend/unroll math.
- **Fusion 360 / Onshape** — cloud accounts, no headless scripting for me, exports locked
  behind licenses. Local open-source keeps the whole project in your repo, free and reproducible.
- **Photogrammetry hull scan** — nice visual, ±cm accuracy, heavy toolchain (Meshroom).
  Optional later for hull *looks*; useless for arch mounting precision.

## 4. Repository layout

```
sy-alizee-3d-modell/
├── PLAN.md                  # this file
├── params/
│   ├── boat.yaml            # measured boat offsets (from the measurement session)
│   └── arch.yaml            # solar arch design parameters (we iterate here)
├── src/
│   ├── lib/
│   │   ├── tube.py          # tube_along_path(), fishmouth/notch, bend helpers
│   │   └── report.py        # measurement/collision/section utilities
│   ├── boat.py              # hull loft (visual) + deck, transom, rails (exact)
│   ├── arch.py              # the solar arch + panel frame + accessories
│   ├── assemble.py          # boat + arch → STEP/GLB/SVG/PNG exports + clearance checks
│   └── fab_report.py        # → fabrication_report.md, cutlist.csv, plate DXFs
├── docs/
│   └── MEASUREMENT_CHECKLIST.md   # printable, ~30 measurements with instructions
├── viewer/
│   └── viewer.html          # three.js template (GLB loaded from out/)
└── out/                     # generated: arch.step, model.glb, renders, reports
```

**One command regenerates everything:** `./build` (thin wrapper: regenerate → check → export → report).

**Coordinate system:** origin at the transom, on the centrelime, at design-waterline height;
**X forward** (bow at X = +LOA), **Y starboard**, **Z up**, **Z = 0 at the design waterline**,
units mm. Right-handed; keeps boat coordinates positive and lets the water plane/grid sit
at Z = 0 in renders and the viewer. Arch-related overhangs aft of the transom get small
negative X, which is intuitive ("300 mm aft of the transom").

## 5. How we iterate (the design loop)

1. You describe a change (natural language is fine).
2. I edit `params/arch.yaml` (or code) and run `./build`.
3. Automatic **clearance checks**: exact OCCT distance queries between arch and
   backstay, pushpit, bimini, swim ladder, transom, panels↔helmsman sight line —
   results printed on every build, so regressions are caught immediately.
4. You inspect the regenerated 3D viewer (orbit/zoom) and/or PNG/SVG renders I attach.
5. Repeat. Each accepted state is a git commit ("v3: lowered aft frame 40mm").

Because the checks and reports are automatic, "the exact dimensions are correct" is enforced
by construction every single build, not by memory or eyeballing.

## 6. Fabrication package (Phase 4 output)

- **Bill of materials:** tube segments with OD/wall (default 316L, Ø40×2 legs/frame
  like Baltic-style commercial arches — parameterized), plates, fasteners.
- **Cut list (CSV + MD):** one row per tube segment: length, end cut types/angles,
  weld/coping (fishmouth) angles if built from straight segments instead of bends.
- **Bend schedule** (if bent one-piece sides): per bend — distance to bend start,
  angle, radius, bend plane/direction, centerline length + neutral-axis note so your
  fabricator can apply their bender's stretch allowance.
- **Foot/backing plates:** hole pattern dimensions + drilling template DXFs
  (Ø100–120 mm, 3×M10 style — parameterized).
- **Assembly control dimensions:** leg spacing at deck, height over deck, diagonals
  (to catch twist when installing), panel frame flatness points.
- **Panel mounting:** hole positions relative to frame tubes.
- **Weight & COG estimate** (316L ρ=8.0 g/cm³) — useful for stern-loading sanity checks.
- **`arch.step`** — full colored assembly any fabricator with CAD can open;
  also openable in your FreeCAD for independent inspection.
- Optional: dimensioned PDF drawings via FreeCAD TechDraw (headless).

## 7. Accuracy strategy — what is exact vs. approximate

| Feature | Accuracy | Basis |
|---|---|---|
| Deck/transom mounting geometry (leg positions, heights) | exact (as measured) | your tape offsets, ±5 mm |
| Pushpit, backstay, bimini, obstructions | exact enough to guarantee clearances | tape/photo, checked by automatic distance queries |
| Hull & deck *surface* away from stern | visual only | lofted from few sections + photos |
| Solar panels | exact | your panel model's datasheet dims |
| Arch itself | exact | it *is* the parameter set |

Hand-laid hulls vary cm-to-cm even between sister ships, so the checklist includes the
measurements at the actual leg landing spots, and the design keeps **adjustability**
where boat tolerance bites (e.g. slotted feet, telescoping cross tubes — the same trick
commercial arch makers use). We design to measured reality, not the brochure.

## 8. Phases

- **Phase 0 — Setup (done):** venv + build123d, smoke test, repo skeleton, viewer, git init.
- **Phase 1 — Boat model (current):** v0 from published specs + photos → your visual review
  → tailored measurement checklist → measured values in → verified model (per §1b standards).
- **Phase 2 — Panel sizing:** short market scan of realistic marine panels; pick candidates
  that fit the stern (panel dims stay a parameter).
- **Phase 3 — Arch design:** standard 4-leg targa layout, Ø40×2 316L (DIY: straight welded
  segments), legs integrated with the kept pushpit, clear of the bimini. Iterate per §5.
- **Phase 4 — Fabrication package:** per §6.
- **Phase 5 — Optional:** Blender hero render; TechDraw PDFs; sun-shading study.

## 9. MCP / tooling research summary (what exists out there)

| Server | What it does | Verdict for us |
|---|---|---|
| **build123d-mcp** (pzfreo, PyPI, active) | MCP wrapper over build123d: build step-by-step, render, measure, fix, export STEP/STL/SVG/DXF. Raises CAD-validity to 100% on CADGenBench. | **Optional add** — good "AI eyes"; we can work purely script-based without it. |
| cadquery-mcp (official CadQuery contrib) | Same idea for CadQuery | Equivalent alternative; build123d preferred (same kernel, better API). |
| openscad-mcp / neoscad | Very mature OpenSCAD toolchain (render/measure/check) | Not applicable — OpenSCAD stack rejected (§3). |
| freecad-mcp (neka-nat et al.) | Drives a running FreeCAD GUI over RPC | Not needed — build123d is headless; FreeCAD stays your manual viewer. |
| agentcad | CLI + MCP: run build123d, versioned STEP, PNG renders, A/B diff, browser preview | Overlaps with our own build script; borrow ideas. |
| cadgate | PR-time CAD validation/diff gates | Overkill for a two-person project. |
| blender-mcp (ahujasid) | Drives Blender for scene work | Phase 5 option only. |
| T3/OpenCode built-ins | html preview, browser, shell | Our delivery channel — no extra install needed. |

OpenCode config for the optional MCP (project `opencode.json`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "build123d": {
        "type": "local",
        "command": ["uv", "tool", "run", "--python", "3.12", "build123d-mcp@latest"]
      }
    }
  }
}
```

## 10. Design brief (agreed 2026-11-20)

| Topic | Decision | Consequence for the model |
|---|---|---|
| Boat reference | Known model + layouts + photos + precise measurements on request | Model v0 from published specs & photos; exactness comes from the tailored measurement checklist |
| Solar panels | Design first, panels recommended to fit | Phase 2 includes a panel market scan (marine panels, typical sizes) and the arch is sized with panel choice as a parameter |
| Arch equipment | Panels only | Simplest, lightest arch — no davit/radar load cases |
| Fabrication | **DIY weld/build** | Construction from **straight welded segments** (fishmouth joints) by default — no bender needed; report = exact cut lengths + joint angles + hole positions. `construction: bent \| welded_segments` stays switchable if access to a bender appears |
| Pushpit | Keep and integrate | Pushpit measured and modeled exactly; arch legs positioned to clear/tie in cleanly |
| Bimini | Must clear existing bimini | Bimini frame in the model; automatic clearance check on every build |

## 11. How photos & drawings are handled

Photos and layout drawings (image or PDF) are fully usable by me: my file-reading
tool renders images and PDFs so I can actually look at them. Division of labor:

- **Photos →** what equipment is where, stern layout, proportions, pushpit/bimini
  geometry type, aesthetic checks of renders against reality.
- **Published layouts/drawings →** initial hull proportions and dimension callouts.
- **Your tape measurements (checklist) →** the *only* source for mm-exact numbers.
  Photos distort (lens, angle, unknown distance), so they sanity-check but never
  dimension the model. The checklist itself will be tailored to what I see in the
  photos, so we only measure what matters.
