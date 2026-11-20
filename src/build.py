#!/usr/bin/env python3
"""
Build pipeline for the SY Alizée (Malö 36) model.

    ./build            -> full pipeline (geometry, checks, exports, viewer, renders)
    ./build --no-view  -> skip viewer HTML generation
    ./build --viewer   -> regenerate only the viewer from the existing GLB

Outputs into out/:
    alizee.step          - full model, opens in FreeCAD
    alizee.glb           - web viewer model
    alizee_viewer.html   - self-contained interactive viewer (no internet needed)
    report.md            - dimension assertions + displacement reconciliation
    renders/*.png        - orthographic check renders
"""
from __future__ import annotations

import base64
import json
import pathlib
import sys

import yaml

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build123d as bd  # noqa: E402

import boat  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
RENDERS = OUT / "renders"

# Material palette (from photos of the real boat)
CREAM = (0.93, 0.90, 0.80)        # topsides / coachroof
NAVY = (0.06, 0.09, 0.26)         # stripes, canvas
ANTIFOUL = (0.13, 0.28, 0.52)     # medium blue antifoul
TEAK = (0.64, 0.48, 0.28)
TEAK_DARK = (0.44, 0.31, 0.17)
STAINLESS = (0.72, 0.73, 0.75)
WHITE = (0.94, 0.94, 0.93)
GLASS = (0.10, 0.12, 0.16)

COLORS = {
    "hull": CREAM,
    "hull_antifoul": ANTIFOUL,
    "boot_stripe": NAVY,
    "sheer_stripe": NAVY,
    "second_stripe": NAVY,
    "deck": TEAK,
    "cockpit_sole": TEAK,
    "toe_rail": TEAK_DARK,
    "coachroof": CREAM,
    "coachroof_windshield": GLASS,
    "windows": NAVY,
    "window_glass": GLASS,
    "hatches": WHITE,
    "hatch_glass": GLASS,
    "sprayhood": NAVY,
    "bimini_frame": STAINLESS,
    "bimini_fabric": NAVY,
    "keel": ANTIFOUL,
    "skeg": ANTIFOUL,
    "rudder": ANTIFOUL,
    "shaft": (0.55, 0.56, 0.58),
    "prop": (0.55, 0.56, 0.58),
    "mast": WHITE,
    "boom": WHITE,
    "sail_cover": NAVY,
    "standing_rigging": (0.80, 0.81, 0.82),
    "rails": STAINLESS,
    "wheel": STAINLESS,
}


def build_geometry(p):
    parts = boat.build_boat(p)
    for name, part in parts.items():
        col = COLORS.get(name)
        if col is not None:
            part.color = bd.Color(*col)
    return parts


def check_dimensions(parts, p):
    """Assert modeled geometry matches parameters; return report rows."""
    model = bd.Compound(children=list(parts.values()))
    bb = model.bounding_box()
    hull_bb = parts["hull"].bounding_box()
    rows = []

    def chk(name, actual, expected, tol):
        ok = abs(actual - expected) <= tol
        rows.append((name, actual, expected, actual - expected, ok))
        return ok

    # OCCT bounding boxes on spline faces are computed from control poles and can
    # overshoot the exact surface — measure principal dims on the hull solid itself.
    all_ok = True
    all_ok &= chk("LOA hull: bbox max X (stem tip)", hull_bb.max.X, float(p["loa_hull"]), 3.0)
    all_ok &= chk("Beam: hull bbox Y extent", hull_bb.size.Y, float(p["beam"]), 4.0)
    all_ok &= chk("Draft: bbox min Z (keel tip)", -bb.min.Z, float(p["draft"]), 3.0)
    all_ok &= chk("Masthead: bbox max Z", bb.max.Z, float(p["rig_top"]), 3.0)
    all_ok &= chk("Canoe body depth: antifoul min Z",
                  -parts["hull_antifoul"].bounding_box().min.Z, float(p["canoe_draft"]), 8.0)

    # Displacement reconciliation vs brochure (6100 kg): submerged hull + appendages.
    water = bd.Solid.make_box(2 * float(p["loa_hull"]), 2 * float(p["beam"]), 4000,
                              plane=bd.Plane(origin=(-float(p["loa_hull"]) / 2,
                                                     -float(p["beam"]), -4000)))
    displaced = 0.0
    for name in ("hull", "keel", "skeg", "rudder", "hull_antifoul", "boot_stripe",
                 "sheer_stripe", "second_stripe"):
        try:
            sub = parts[name] & water
            displaced += sub.volume
        except Exception:
            pass
    mass_t = displaced * 1.025e-9  # mm^3 * (1.025 t/m^3) * (1e-9 m^3/mm^3)
    all_ok &= chk("Displacement (t, brochure 6.10)", mass_t, float(p["displacement_kg"]) / 1000,
                  2.0)
    return rows, all_ok


def write_report(parts, rows, all_ok, p):
    lines = [
        f"# Model report — {p.get('name', 'SY Alizée')}",
        "",
        "Automated dimension assertions (modeled geometry vs parameters/brochure):",
        "",
        "| Check | Modeled | Expected | Δ | Status |",
        "|---|---:|---:|---:|:-:|",
    ]
    for name, actual, expected, delta, ok in rows:
        unit = " t" if "Displacement" in name else " mm"
        lines.append(f"| {name} | {actual:.2f}{unit} | {expected:.2f}{unit} | {delta:+.2f} | {'✅' if ok else '❌'} |")
    lines += ["", "Part volumes:", "", "| Part | Volume (l) |", "|---|---:|"]
    for name, part in parts.items():
        try:
            lines.append(f"| {name} | {part.volume / 1e6:.1f} |")
        except Exception:
            lines.append(f"| {name} | n/a |")
    lines += ["", "**Overall: " + ("ALL CHECKS PASSED ✅" if all_ok else "SOME CHECKS FAILED ❌") + "**"]
    (OUT / "report.md").write_text("\n".join(lines))
    print("\n".join(lines))


def render(parts, path, exclude=()):
    """Three orthographic check renders via matplotlib (no GPU needed)."""
    import numpy as np
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    fig = plt.figure(figsize=(17, 6))
    views = [("side (from starboard)", 0, -90),
             ("plan (top)", 90, -90),
             ("aft quarter", 18, -125)]
    for i, (label, elev, azim) in enumerate(views, 1):
        ax = fig.add_subplot(1, 3, i, projection="3d")
        for name, part in parts.items():
            if name in exclude:
                continue
            try:
                verts, tris = part.tessellate(4.0, 0.4)
            except TypeError:
                verts, tris = part.tessellate(4.0)
            v = np.array([[vv.X, vv.Y, vv.Z] for vv in verts])
            polys = v[np.array(tris)]
            col = COLORS.get(name, (0.8, 0.8, 0.8))
            pc = Poly3DCollection(polys, facecolors=col, edgecolor="none")
            ax.add_collection3d(pc)
        all_bb = bd.Compound(children=[s for n, s in parts.items() if n not in exclude]).bounding_box()
        ax.set_xlim(all_bb.min.X, all_bb.max.X)
        ax.set_ylim(all_bb.min.Y, all_bb.max.Y)
        ax.set_zlim(all_bb.min.Z, all_bb.max.Z)
        try:
            ax.set_box_aspect((all_bb.size.X, all_bb.size.Y, all_bb.size.Z))
        except AttributeError:
            pass
        ax.view_init(elev=elev, azim=azim)
        ax.set_axis_off()
        ax.set_title(label, fontsize=9)
    fig.tight_layout()
    fig.savefig(path, dpi=140)
    plt.close(fig)


def make_viewer(p, parts=None, template_path=ROOT / "viewer" / "viewer_template.html"):
    glb = OUT / "alizee.glb"
    if parts is not None:
        compound = bd.Compound(children=list(parts.values()))
        bd.export_gltf(compound, str(glb), binary=True)
    if not glb.exists():
        raise FileNotFoundError("out/alizee.glb missing - run a full build first")
    b64 = base64.b64encode(glb.read_bytes()).decode()
    tpl = template_path.read_text()
    for marker, rel in [("__THREE__", "three.min.js"), ("__ORBIT__", "OrbitControls.js"),
                        ("__GLTF__", "GLTFLoader.js")]:
        js = (ROOT / "viewer" / "vendor" / rel).read_text()
        tpl = tpl.replace(f"/* {marker} */", js)
    title = f"{p.get('name', 'SY Alizée')} — LOA {p['loa_hull'] / 1000:.2f} m"
    if p.get("placeholder"):
        title += "  ⚠ PLACEHOLDER DATA"
    html = tpl.replace("__TITLE__", title).replace("__MODEL_B64__", b64)
    (OUT / "alizee_viewer.html").write_text(html)


def make_web_viewer(p, hf):
    """Self-contained procedural three.js viewer: hull sections sampled from the
    same HullForm curves the CAD model uses, everything else from params."""
    import numpy as np
    from scipy.interpolate import PchipInterpolator

    # ---- curve tables (Catmull-Rom sampled in JS)
    n_tbl = 200
    s = np.linspace(0.0, 1.0, n_tbl + 1)
    table = {k: [round(float(v), 2) for v in f(s)] for k, f in (
        ("sheer", hf.sheer), ("hb", hf.half_beam), ("bottom", hf.bottom),
        ("f1", hf.f1), ("f2", hf.f2), ("f3", hf.f3))}

    # ---- hull section grid: chord-length-parametrised spline through the same
    # control points _section_wire uses (nS stations x nT half-section points)
    n_st, n_t = 41, 25
    ss = (1 - np.cos(np.pi * np.arange(n_st) / (n_st - 1))) / 2
    hx, hy, hz = [], [], []
    for si in ss:
        x = si * hf.loa
        hbx, zsh, zb = hf.hb_at(x), hf.sheer_at(x), hf.bottom_at(x)
        h = zsh - zb
        ctrl = np.array([(0.0, zb), (hf.f1(si) * hbx, zb + 0.10 * h),
                         (hf.f2(si) * hbx, zb + 0.36 * h),
                         (hf.f3(si) * hbx, zb + 0.70 * h), (hbx, zsh)])
        d = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(ctrl[:, 0]), np.diff(ctrl[:, 1])))])
        tt = np.linspace(0.0, 1.0, n_t) * d[-1]
        py = PchipInterpolator(d, ctrl[:, 0])(tt)   # lateral (starboard)
        pz = PchipInterpolator(d, ctrl[:, 1])(tt)   # vertical
        hx.append(round(float(x), 1))
        hy += [round(float(v), 1) for v in py]
        hz += [round(float(v), 1) for v in pz]

    def hexc(c):
        return "#{:02X}{:02X}{:02X}".format(*(int(round(v * 255)) for v in c))

    web = {
        "loa": float(p["loa_hull"]), "draft": float(p["draft"]),
        "canoe": float(p["canoe_draft"]),
        "tableN": n_tbl + 1, "table": table,
        "hull": {"x": hx, "y": hy, "z": hz},
        "col": {
            "cream": hexc(CREAM), "navy": hexc(NAVY), "anti": hexc(ANTIFOUL),
            "teak": hexc(TEAK), "teak2": hexc(TEAK_DARK), "caulk": "#2A241E",
            "steel": hexc(STAINLESS), "white": hexc(WHITE), "glass": hexc(GLASS),
        },
        "boot": [float(p["boot_stripe"]["z0"]), float(p["boot_stripe"]["z1"])],
        "sheerStripe": [float(p["sheer_stripe"]["down0"]), float(p["sheer_stripe"]["down1"])],
        "secondStripe": [float(p["second_stripe"]["down0"]), float(p["second_stripe"]["down1"])],
        "deckCrown": float(p["deck_crown"]), "plankPitch": float(p["deck_plank_pitch"]),
        "cockpit": {"x0": float(p["cockpit"]["x0"]), "x1": float(p["cockpit"]["x1"]),
                    "w": float(p["cockpit"]["width"]),
                    "soleBelow": float(p["cockpit"]["sole_below_deck"])},
        "coachroof": {"x0": float(p["coachroof"]["x0"]), "x1": float(p["coachroof"]["x1"]),
                      "hw": float(p["coachroof"]["half_width"]),
                      "topOff": float(p["coachroof"]["top_z_off_deck"])},
        "winRows": [[float(w[0]), float(w[1])] for w in p["window_rows"]],
        "hatches": [[float(v) for v in h] for h in p["hatches"]],
        "sprayhood": {"x0": float(p["sprayhood"]["x_aft"]), "x1": float(p["sprayhood"]["x_fwd"]),
                      "peak": float(p["sprayhood"]["peak_z"]),
                      "hw": float(p["sprayhood"]["half_width"])},
        "bimini": {"x0": float(p["bimini"]["x_aft"]), "x1": float(p["bimini"]["x_fwd"]),
                   "top": float(p["bimini"]["top_z"]), "hw": float(p["bimini"]["half_width"])},
        "keel": {"x0": float(p["keel_root_x0"]), "x1": float(p["keel_root_x1"]),
                 "tipX0": float(p["keel_tip_x0"]), "tipX1": float(p["keel_tip_x1"]),
                 "halfThk": float(p["keel_half_thk"])},
        "skeg": {"x0": float(p["skeg_x0"]), "topX1": float(p["skeg_top_x1"]),
                 "botX0": float(p["skeg_bottom_x0"])},
        "rud": {"x0": float(p["rudder_x0"]), "x1": float(p["rudder_x1"]),
                "botX0": float(p["rudder_bottom_x0"]), "halfThk": float(p["rudder_half_thk"])},
        "shaft": {"xHull": float(p["shaft_x_hull"]), "zHull": float(p["shaft_z_hull"]),
                  "xProp": float(p["shaft_x_prop"]), "zProp": float(p["shaft_z_prop"])},
        "innerStay": {"x": float(p["inner_forestay_x"])},
        "mast": {"x": float(p["mast_x"]), "r": float(p["mast_r"]), "top": float(p["rig_top"]),
                 "boomZ": float(p["boom_z"]), "boomLen": float(p["boom_len"]),
                 "coverR": float(p["sail_cover_r"]),
                 "s1f": float(p["spreader1_z_frac"]), "s2f": float(p["spreader2_z_frac"]),
                 "s1l": float(p["spreader1_len"]), "s2l": float(p["spreader2_len"]),
                 "sweep": float(p["spreader_sweep_deg"])},
        "rails": {"tubeR": float(p["rail_tube_r"]), "pushX": float(p["pushpit_x"]),
                  "pushTop": float(p["pushpit_top"]), "pulpX": float(p["pulpit_x"]),
                  "stanchions": [float(v) for v in p["stanchion_x"]],
                  "stTop": float(p["stanchion_top_above_deck"]),
                  "lifelines": [float(v) for v in p["lifeline_levels"]],
                  "davitH": float(p["davit_height"]), "davitO": float(p["davit_overhang"]),
                  "chainInset": float(p["chainplate_inset"]),
                  "pedX": float(p["wheel_pedestal_x"]), "wheelR": float(p["wheel_radius"])},
    }
    tpl = (ROOT / "viewer" / "web_template.html").read_text()
    for marker, rel in [("__THREE__", "three.min.js"), ("__ORBIT__", "OrbitControls.js")]:
        js = (ROOT / "viewer" / "vendor" / rel).read_text()
        tpl = tpl.replace(f"/* {marker} */", js)
    title = f"Malö 36 · LOA {p['loa_hull'] / 1000:.2f} m"
    if p.get("placeholder"):
        title += "  ⚠ PLACEHOLDER DATA"
    tpl = tpl.replace("__TITLE__", title).replace("__PARAMS__", json.dumps(web))
    (OUT / "alizee_web.html").write_text(tpl)


def main():
    OUT.mkdir(exist_ok=True)
    RENDERS.mkdir(parents=True, exist_ok=True)
    p = yaml.safe_load((ROOT / "params" / "boat.yaml").read_text())

    if "--viewer" in sys.argv or "--web" in sys.argv:  # fast path: viewers only
        if "--viewer" in sys.argv:
            make_viewer(p)
            print(f"viewer:  {OUT / 'alizee_viewer.html'}")
        if "--web" in sys.argv:
            make_web_viewer(p, boat.HullForm(p))
            print(f"web:     {OUT / 'alizee_web.html'}")
        return

    print(f"Building {p.get('name', 'boat')} ...")
    parts = build_geometry(p)

    rows, all_ok = check_dimensions(parts, p)
    write_report(parts, rows, all_ok, p)

    compound = bd.Compound(children=list(parts.values()))
    bd.export_step(compound, str(OUT / "alizee.step"))
    print(f"export: {OUT / 'alizee.step'}")

    (OUT / "parts.json").write_text(json.dumps(
        {n: {"volume_mm3": getattr(s, "volume", None)} for n, s in parts.items()}, indent=2))

    print("rendering check images ...")
    render(parts, RENDERS / "full_boat.png")
    render(parts, RENDERS / "hull_only.png", exclude=("mast", "standing_rigging", "boom",
                                                      "sail_cover", "sprayhood", "bimini_fabric",
                                                      "bimini_frame", "rails"))

    if "--no-view" not in sys.argv:
        make_viewer(p, parts)
        print(f"viewer:  {OUT / 'alizee_viewer.html'}")
        make_web_viewer(p, hf := boat.HullForm(p))
        print(f"web:     {OUT / 'alizee_web.html'}")

    if not all_ok:
        print("WARNING: dimension checks failed — see out/report.md", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
