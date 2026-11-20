"""
Parametric model of SY Alizée (build123d / OpenCascade).

Coordinate system: origin at the transom, on the centreline, at design-waterline
height. X forward, Y starboard, Z up. Z = 0 is the design waterline. Units: mm.

Hull construction: transverse stations from keel to sheer are lofted through
(smooth spline half-sections mirrored to port). When real measured offsets
arrive, the control tables below are replaced with measured data and the loft
pipeline stays untouched.
"""
from __future__ import annotations

from typing import Any

import numpy as np
from scipy.interpolate import PchipInterpolator

import build123d as bd
from build123d import Edge, Plane, Solid, Wire

# Side-view sketch plane: 2D point (u, v) -> world (u, 0, v); extrudes go along -Y.
SIDE_PLANE = Plane(origin=(0, 0, 0), x_dir=(1, 0, 0), z_dir=(0, -1, 0))


def _vec(p) -> bd.Vector:
    return bd.Vector(float(p[0]), float(p[1]), float(p[2]))


def cylinder_between(p1, p2, radius) -> Solid:
    """Solid cylinder from p1 to p2 (3-vectors)."""
    p1 = np.asarray(p1, float)
    p2 = np.asarray(p2, float)
    d = p2 - p1
    h = float(np.linalg.norm(d))
    if h < 1e-9:
        raise ValueError("degenerate cylinder")
    u = d / h
    return Solid.make_cylinder(radius, h, plane=Plane(origin=tuple(p1), z_dir=tuple(u)))


def _interp(points):
    pts = np.asarray(points, float)
    return PchipInterpolator(pts[:, 0], pts[:, 1])


def side_solid(pts2d, half_thickness) -> Solid:
    """Extrude a closed side-view (X,Z) polygon symmetrically about the centreline."""
    with bd.BuildPart() as part:
        with bd.BuildSketch(SIDE_PLANE):
            with bd.BuildLine():
                bd.Polyline(pts2d, close=True)
            bd.make_face()
        bd.extrude(amount=half_thickness, both=True)
    return part.part


def _section_wire(x, hb, zb, zs) -> Wire:
    """One transverse hull station: spline half-section starboard + mirrored port."""
    h = zs - zb
    pts = [
        (0.0, zb),
        (0.30 * hb, zb + 0.10 * h),
        (0.72 * hb, zb + 0.36 * h),
        (0.93 * hb, zb + 0.70 * h),
        (hb, zs),
    ]
    stbd = Edge.make_spline([_vec((x, y, z)) for y, z in pts])
    port = Edge.make_spline([_vec((x, -y, z)) for y, z in pts])
    top = Edge.make_line((x, hb, zs), (x, -hb, zs))
    return Wire.combine([stbd, port, top])[0]


def build_boat(p: dict[str, Any]) -> dict[str, Any]:
    """Return named parts: hull, coachroof, keel, rudder, rig, rails."""
    loa = float(p["loa"])
    beam = float(p["beam"])
    bt = float(p["beam_transom"])
    canoe = float(p["canoe_draft"])
    draft = float(p["draft"])
    fb_aft, fb_mid, fb_fwd = (float(p[k]) for k in ("freeboard_aft", "freeboard_mid", "freeboard_fwd"))

    # ---- shape curves (placeholder control tables; measured offsets replace these)
    sheer = _interp([(0.0, fb_aft), (0.50, fb_mid), (1.0, fb_fwd)])
    half_beam = _interp([
        (0.00, bt / 2), (0.30, 0.96 * beam / 2), (0.55, beam / 2),
        (0.78, 0.82 * beam / 2), (0.92, 0.42 * beam / 2), (1.00, 18.0),
    ])
    bottom = _interp([
        (0.00, -0.55 * canoe), (0.18, -0.90 * canoe), (0.45, -canoe),
        (0.75, -canoe), (0.92, -0.60 * canoe), (1.00, -0.12 * canoe),
    ])

    def hb_at(x):  # half beam at world x
        return float(half_beam(np.clip(x / loa, 0.0, 1.0)))

    def sheer_at(x):
        return float(sheer(np.clip(x / loa, 0.0, 1.0)))

    # ---- hull: loft through stations (cosine spacing: dense at bow and transom)
    n = int(p.get("stations", 18))
    wires = [
        _section_wire(s * loa, hb_at(s * loa), float(bottom(s)), float(sheer(s)))
        for s in (1 - np.cos(np.pi * np.arange(n) / (n - 1))) / 2
    ]
    hull = Solid.make_loft(wires, ruled=False)

    # ---- cockpit recess (cut through the deck)
    c = p["cockpit"]
    cut = Solid.make_box(
        float(c["len"]), float(c["width"]), 600.0,
        plane=Plane(origin=(float(c["x0"]), -float(c["width"]) / 2, float(c["z_floor"]))),
    )
    hull = hull - cut

    # ---- keel & rudder (side-view fins, extruded symmetric)
    keel = side_solid(
        [(0.34 * loa, -0.92 * canoe), (0.66 * loa, -0.92 * canoe),
         (0.60 * loa, -draft), (0.44 * loa, -draft)],
        float(p["keel_half_thk"]),
    )
    rudder = side_solid(
        [(250.0, -0.40 * canoe), (1450.0, -0.40 * canoe),
         (1250.0, -draft + 250), (450.0, -draft + 250)],
        float(p["rudder_half_thk"]),
    )

    # ---- rig
    mast_x = float(p["mast_x"])
    rig_top = float(p["rig_top"])
    boom_z = float(p["boom_z"])
    mast = Solid.make_cylinder(
        float(p["mast_r"]), rig_top - 900,
        plane=Plane(origin=(mast_x, 0, 900), z_dir=(0, 0, 1)),
    )
    boom = cylinder_between((mast_x - 60, 0, boom_z),
                            (mast_x - float(p["boom_len"]), 0, boom_z), 50)
    head = (mast_x, 0, rig_top - 200)
    forestay = cylinder_between((loa - 60, 0, sheer_at(loa)), head, 9)
    backstay = cylinder_between((0, 0, fb_aft), head, 9)
    shrouds = []
    for x_cp, frac in ((0.52 * loa, 0.78), (0.40 * loa, 0.55)):
        y = hb_at(x_cp) - 100
        shrouds.append(cylinder_between((x_cp, y, sheer_at(x_cp) - 20), (mast_x, 0, frac * rig_top), 9))
        shrouds.append(cylinder_between((x_cp, -y, sheer_at(x_cp) - 20), (mast_x, 0, frac * rig_top), 9))
    rig = mast.fuse(boom, forestay, backstay, *shrouds)

    # ---- coachroof (low wedge on deck, base sunk into the hull so it fuses visually)
    cr_x0, cr_x1 = float(p["coachroof_x0"]), float(p["coachroof_x1"])
    peak = float(p["coachroof_peak_z"])
    coachroof = side_solid(
        [(cr_x0, 1010.0), (0.55 * cr_x0 + 0.45 * cr_x1, peak), (cr_x1 - 200, peak - 20), (cr_x1, 1010.0)],
        float(p["coachroof_half_width"]),
    )

    # ---- deck rails: pushpit, pulpit, stanchions, lifelines (rough placeholder)
    r = float(p["rail_tube_r"])
    push_x, push_y, push_top = (float(p[k]) for k in ("pushpit_x", "pushpit_y", "pushpit_top"))
    push_z = sheer_at(push_x)
    rail_parts = []
    for sgn in (1, -1):
        rail_parts.append(cylinder_between((push_x, sgn * push_y, push_z), (push_x, sgn * push_y, push_top), r))
    rail_parts.append(cylinder_between((push_x, -push_y, push_top), (push_x, push_y, push_top), r))
    rail_parts.append(cylinder_between((push_x, -push_y, push_z + (push_top - push_z) / 2),
                                       (push_x, push_y, push_z + (push_top - push_z) / 2), r))
    pulp_x = float(p["pulpit_x"])
    pulp_y = max(hb_at(pulp_x) - 40, 60)
    pulp_z = sheer_at(pulp_x)
    for sgn in (1, -1):
        rail_parts.append(cylinder_between((pulp_x, sgn * pulp_y, pulp_z), (pulp_x, sgn * pulp_y, pulp_z + 650), r))
    rail_parts.append(cylinder_between((pulp_x, -pulp_y, pulp_z + 650), (pulp_x, pulp_y, pulp_z + 650), r))
    stanchion_h = float(p["stanchion_height"])
    for xs in np.linspace(2200, 8600, 6):
        y = hb_at(float(xs)) - 80
        for sgn in (1, -1):
            rail_parts.append(cylinder_between((float(xs), sgn * y, sheer_at(float(xs))),
                                              (float(xs), sgn * y, sheer_at(float(xs)) + stanchion_h), 20))
    lifeline_r = float(p["lifeline_r"])
    for sgn in (1, -1):
        rail_parts.append(cylinder_between(
            (pulp_x, sgn * pulp_y, pulp_z + 650 - 60), (push_x, sgn * push_y, push_top - 60), lifeline_r))
    rails = rail_parts[0].fuse(*rail_parts[1:])

    return {
        "hull": hull,
        "coachroof": coachroof,
        "keel": keel,
        "rudder": rudder,
        "rig": rig,
        "rails": rails,
    }
