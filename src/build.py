#!/usr/bin/env python3
"""
Build pipeline for the SY Alizée model.

    ./build            -> full pipeline (geometry, checks, exports, viewer, renders)
    ./build --no-view  -> skip viewer HTML generation

Outputs into out/:
    alizee.step          - full model, opens in FreeCAD
    alizee.glb           - web viewer model
    alizee_viewer.html   - self-contained interactive viewer (no internet needed)
    report.md            - dimension assertions + part volumes
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

COLORS = {
    "hull": (0.93, 0.94, 0.96),
    "coachroof": (0.87, 0.88, 0.90),
    "keel": (0.33, 0.36, 0.40),
    "rudder": (0.33, 0.36, 0.40),
    "rig": (0.72, 0.74, 0.77),
    "rails": (0.60, 0.63, 0.66),
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

    all_ok = True
    # Note: OCCT bounding boxes on spline faces are slightly loose (~2-3 mm),
    # so tolerances below are a few mm, not sub-mm.
    all_ok &= chk("LOA: bbox max X (stem at X=LOA)", bb.max.X, float(p["loa"]), 2.0)
    all_ok &= chk("Beam: bbox Y extent", bb.size.Y, float(p["beam"]), 5.0)
    all_ok &= chk("Draft: bbox min Z (keel tip)", -bb.min.Z, float(p["draft"]), 2.0)
    all_ok &= chk("Sheer fwd: hull top at bow", hull_bb.max.Z, float(p["freeboard_fwd"]), 3.0)
    all_ok &= chk("Masthead: bbox max Z", bb.max.Z, float(p["rig_top"]), 2.0)
    all_ok &= chk("Canoe bottom: hull min Z", -hull_bb.min.Z, float(p["canoe_draft"]), 5.0)
    return rows, all_ok


def write_report(parts, rows, all_ok, p):
    lines = [
        f"# Model report — {p.get('name', 'SY Alizée')}",
        "",
        "Automated dimension assertions (modeled geometry vs YAML parameters):",
        "",
        "| Check | Modeled (mm) | Expected (mm) | Δ (mm) | Status |",
        "|---|---:|---:|---:|:-:|",
    ]
    for name, actual, expected, delta, ok in rows:
        lines.append(f"| {name} | {actual:.1f} | {expected:.1f} | {delta:+.1f} | {'✅' if ok else '❌'} |")
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


def make_viewer(parts, p, template_path=ROOT / "viewer" / "viewer_template.html"):
    compound = bd.Compound(children=list(parts.values()))
    glb = OUT / "alizee.glb"
    bd.export_gltf(compound, str(glb), binary=True)
    b64 = base64.b64encode(glb.read_bytes()).decode()
    tpl = template_path.read_text()
    for marker, rel in [("__THREE__", "three.min.js"), ("__ORBIT__", "OrbitControls.js"),
                        ("__GLTF__", "GLTFLoader.js")]:
        js = (ROOT / "viewer" / "vendor" / rel).read_text()
        tpl = tpl.replace(f"/* {marker} */", js)
    title = f"{p.get('name', 'SY Alizée')} — placeholder v0 — LOA {p['loa'] / 1000:.2f} m"
    if p.get("placeholder"):
        title += "  ⚠ PLACEHOLDER DATA"
    html = tpl.replace("__TITLE__", title).replace("__MODEL_B64__", b64)
    (OUT / "alizee_viewer.html").write_text(html)


def main():
    OUT.mkdir(exist_ok=True)
    RENDERS.mkdir(parents=True, exist_ok=True)
    p = yaml.safe_load((ROOT / "params" / "boat.yaml").read_text())
    print(f"Building {p.get('name', 'boat')} (placeholder={bool(p.get('placeholder'))}) ...")

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
    render(parts, RENDERS / "hull_only.png", exclude=("rig",))

    if "--no-view" not in sys.argv:
        make_viewer(parts, p)
        print(f"viewer:  {OUT / 'alizee_viewer.html'}")

    if not all_ok:
        print("WARNING: dimension checks failed — see out/report.md", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
