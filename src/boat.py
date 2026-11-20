"""
Parametric model of SY Alizée — Malö 36 (Malö 36/106).

Coordinate system: origin at the transom, on the centreline, at design-waterline
height. X forward, Y starboard, Z up. Z = 0 is the design waterline. Units: mm.

Hull construction: transverse stations (spline half-sections, mirrored) lofted
into a solid; deck lofted as cambered slabs on top; paint bands (boot top,
stripes, antifoul) cut from a slightly offset copy of the hull so they sit proud
of the surface (no z-fighting). Rig, rails, canvas and hardware are assembled
from exact cylinders/tori so every stay, rail and stanchion has a real
position that later measurement passes can correct individually.
"""
from __future__ import annotations

from typing import Any

import numpy as np
from scipy.interpolate import PchipInterpolator

import build123d as bd
from build123d import Edge, Plane, Solid, Wire

# Side-view sketch plane: 2D point (u, v) -> world (u, 0, v); extrudes span ±Y.
SIDE_PLANE = Plane(origin=(0, 0, 0), x_dir=(1, 0, 0), z_dir=(0, -1, 0))


def _vec(p) -> bd.Vector:
    return bd.Vector(float(p[0]), float(p[1]), float(p[2]))


def cylinder_between(p1, p2, radius) -> Solid:
    p1 = np.asarray(p1, float)
    p2 = np.asarray(p2, float)
    d = p2 - p1
    h = float(np.linalg.norm(d))
    if h < 1e-9:
        raise ValueError("degenerate cylinder")
    u = d / h
    return Solid.make_cylinder(radius, h, plane=Plane(origin=tuple(p1), z_dir=tuple(u)))


def tube_along(points, radius) -> Solid:
    """Polyline of cylinders + joint spheres (stainless-rail look, exact path)."""
    pts = [np.asarray(p, float) for p in points]
    parts = [cylinder_between(pts[i], pts[i + 1], radius) for i in range(len(pts) - 1)]
    parts += [Solid.make_sphere(radius, plane=Plane(origin=tuple(p))) for p in pts]
    return parts[0].fuse(*parts[1:])


def side_solid(pts2d, half_thickness) -> Solid:
    """Extrude a closed side-view (X,Z) polygon symmetrically about the centreline."""
    with bd.BuildPart() as part:
        with bd.BuildSketch(SIDE_PLANE):
            with bd.BuildLine():
                bd.Polyline(pts2d, close=True)
            bd.make_face()
        bd.extrude(amount=half_thickness, both=True)
    return part.part


def _interp(points):
    pts = np.asarray(points, float)
    return PchipInterpolator(pts[:, 0], pts[:, 1])


class HullForm:
    """Interpolated hull definition curves (normalised s = x / LOA, 0 transom .. 1 stem)."""

    def __init__(self, p: dict[str, Any]):
        self.loa = float(p["loa_hull"])
        self.beam = float(p["beam"])
        self.bt = float(p["beam_transom"])
        self.canoe = float(p["canoe_draft"])
        self.fb = {k: float(p[f"freeboard_{k}"]) for k in ("aft", "mid", "fwd")}

        self.sheer = _interp([(0.0, self.fb["aft"]), (0.50, self.fb["mid"]), (1.0, self.fb["fwd"])])
        self.half_beam = _interp([
            (0.00, self.bt / 2), (0.30, 0.965 * self.beam / 2), (0.55, self.beam / 2),
            (0.80, 0.80 * self.beam / 2), (0.93, 0.42 * self.beam / 2), (1.00, 20.0),
        ])
        self.bottom = _interp([
            (0.00, -0.62 * self.canoe), (0.15, -0.92 * self.canoe), (0.45, -self.canoe),
            (0.78, -self.canoe), (0.93, -0.55 * self.canoe), (1.00, -0.05 * self.canoe),
        ])
        # Section fullness: U-shaped midship -> V-shaped bow (control-point fractions).
        self.f1 = _interp([(0.0, 0.36), (0.50, 0.30), (1.00, 0.10)])
        self.f2 = _interp([(0.0, 0.80), (0.50, 0.72), (1.00, 0.44)])
        self.f3 = _interp([(0.0, 0.97), (0.50, 0.93), (1.00, 0.80)])

    def sheer_at(self, x):
        """Sheer height above WL; scalar or numpy array input."""
        s = self.sheer(np.clip(np.asarray(x, float) / self.loa, 0.0, 1.0))
        return s if isinstance(s, np.ndarray) else float(s)

    def hb_at(self, x):
        s = self.half_beam(np.clip(np.asarray(x, float) / self.loa, 0.0, 1.0))
        return s if isinstance(s, np.ndarray) else float(s)

    def bottom_at(self, x):
        s = self.bottom(np.clip(np.asarray(x, float) / self.loa, 0.0, 1.0))
        return s if isinstance(s, np.ndarray) else float(s)

    def deck_z(self, x) -> float:
        """Centreline deck-top height (sheer + camber crown)."""
        return self.sheer_at(x) + float(CROWN)


CROWN = 70.0  # deck camber crown (mm) at centreline


def _section_wire(hf: HullForm, x: float) -> Wire:
    """One transverse hull station at world x: spline half-sections + flat top."""
    hb, zs = hf.hb_at(x), hf.sheer_at(x)
    zb = hf.bottom_at(x)
    h = zs - zb
    pts = [
        (0.0, zb),
        (hf.f1(x / hf.loa) * hb, zb + 0.10 * h),
        (hf.f2(x / hf.loa) * hb, zb + 0.36 * h),
        (hf.f3(x / hf.loa) * hb, zb + 0.70 * h),
        (hb, zs),
    ]
    stbd = Edge.make_spline([_vec((x, y, z)) for y, z in pts])
    port = Edge.make_spline([_vec((x, -y, z)) for y, z in pts])
    top = Edge.make_line((x, hb, zs), (x, -hb, zs))
    return Wire.combine([stbd, port, top])[0]


def build_hull(hf: HullForm, n: int) -> Solid:
    s = (1 - np.cos(np.pi * np.arange(n) / (n - 1))) / 2
    wires = [_section_wire(hf, si * hf.loa) for si in s]
    return Solid.make_loft(wires, ruled=False)


def build_deck(hf: HullForm, n: int, thk: float) -> Solid:
    """Deck slab: cambered top, flat bottom, edges following the sheer."""

    def deck_wire(x):
        hb, zs = hf.hb_at(x), hf.sheer_at(x)
        arc = Edge.make_three_point_arc(
            (x, -hb, zs), (x, 0, zs + CROWN), (x, hb, zs))
        return Wire.combine([
            arc,
            Edge.make_line((x, hb, zs), (x, hb, zs - thk)),
            Edge.make_line((x, hb, zs - thk), (x, -hb, zs - thk)),
            Edge.make_line((x, -hb, zs - thk), (x, -hb, zs)),
        ])[0]

    s = (1 - np.cos(np.pi * np.arange(n) / (n - 1))) / 2
    wires = [deck_wire(si * hf.loa) for si in s]
    return Solid.make_loft(wires, ruled=False)


def _side_band_solid(hf: HullForm, down0: float, down1: float, half_width: float) -> Solid:
    """Vertical band below the sheer line, as a side-view polygon extruded ±Y."""
    xs = np.linspace(-50, hf.loa - 300, 45)
    top = hf.sheer_at(xs) - down0
    bot = hf.sheer_at(xs) - down1
    pts = list(zip(xs, top)) + list(zip(xs[::-1], bot[::-1]))
    return side_solid(pts, half_width)


def build_boat(p: dict[str, Any]) -> dict[str, Any]:
    hf = HullForm(p)
    loa = hf.loa
    parts: dict[str, Any] = {}

    # ---- hull + deck
    hull = build_hull(hf, int(p.get("stations", 21)))
    parts["deck"] = build_deck(hf, 15, float(p["deck_thk"]))

    # ---- paint bands: partition the hull surface (each region belongs to one
    # solid, so paint and gelcoat never share a face -> no z-fighting)
    bs = p["boot_stripe"]
    slab_w = hf.beam + 800  # paint slabs span the full beam plus margin
    boot_slab = Solid.make_box(
        loa + 200, slab_w, float(bs["z1"]) - float(bs["z0"]),
        plane=Plane(origin=(-100, -slab_w / 2, float(bs["z0"]))),
    )
    sheer_slab = _side_band_solid(hf, p["sheer_stripe"]["down0"], p["sheer_stripe"]["down1"],
                                  hf.beam / 2 + 400)
    second_slab = _side_band_solid(hf, p["second_stripe"]["down0"], p["second_stripe"]["down1"],
                                   hf.beam / 2 + 400)
    foul_bot = -float(p["draft"]) - 200
    foul_slab = Solid.make_box(
        loa + 200, slab_w, float(bs["z0"]) - foul_bot,
        plane=Plane(origin=(-100, -slab_w / 2, foul_bot)),
    )
    parts["boot_stripe"] = hull & boot_slab
    parts["sheer_stripe"] = hull & sheer_slab
    parts["second_stripe"] = hull & second_slab
    parts["hull_antifoul"] = hull & foul_slab
    parts["hull"] = hull - boot_slab - sheer_slab - second_slab - foul_slab

    # ---- keel, skeg, rudder, shaft (antifoul-coloured appendages)
    kh = float(p["keel_half_thk"])
    parts["keel"] = side_solid([
        (float(p["keel_root_x0"]), -0.80 * hf.canoe),
        (float(p["keel_root_x1"]), -0.86 * hf.canoe),
        (float(p["keel_tip_x1"]), -float(p["draft"])),
        (float(p["keel_tip_x0"]), -float(p["draft"])),
    ], kh)
    parts["skeg"] = side_solid([
        (float(p["skeg_x0"]), -0.55 * hf.canoe),
        (float(p["skeg_top_x1"]), -0.60 * hf.canoe),
        (float(p["skeg_bottom_x0"]), -float(p["draft"]) + 210),
    ], 45)
    parts["rudder"] = side_solid([
        (float(p["rudder_x0"]), -0.35 * hf.canoe),
        (float(p["rudder_x1"]), -0.42 * hf.canoe),
        (float(p["rudder_bottom_x0"]), -float(p["draft"]) + 130),
    ], float(p["rudder_half_thk"]))
    sx_h, sz_h = float(p["shaft_x_hull"]), float(p["shaft_z_hull"])
    sx_p, sz_p = float(p["shaft_x_prop"]), float(p["shaft_z_prop"])
    parts["shaft"] = cylinder_between((sx_h, 0, sz_h), (sx_p, 0, sz_p), 18)
    parts["prop"] = Solid.make_cylinder(
        105, 55, plane=Plane(origin=(sx_p - 20, 0, sz_p), z_dir=(1, 0, 0)))

    # ---- cockpit recess + teak sole + wheel pedestal
    c = p["cockpit"]
    cx0, cx1, cw = float(c["x0"]), float(c["x1"]), float(c["width"])
    sole_z = hf.deck_z((cx0 + cx1) / 2) - float(c["sole_below_deck"])
    cut = Solid.make_box(cx1 - cx0, cw, 900,
                         plane=Plane(origin=(cx0, -cw / 2, sole_z)))
    parts["deck"] = parts["deck"] - cut
    sole = Solid.make_box(cx1 - cx0 - 60, cw - 90, 20,
                          plane=Plane(origin=(cx0 + 30, -(cw - 90) / 2, sole_z)))
    parts["cockpit_sole"] = sole
    wx = float(p["wheel_pedestal_x"])
    ped_top = hf.deck_z(wx) + 170
    parts["wheel"] = cylinder_between((wx, 0, sole_z), (wx, 0, ped_top), 30).fuse(
        Solid.make_torus(float(p["wheel_radius"]), 16,
                         plane=Plane(origin=(wx, 0, ped_top + 290), z_dir=(1, 0, 0))),
        cylinder_between((wx, 0, ped_top + 290), (wx, 0, ped_top + 420), 16),
    )

    # ---- coachroof, windshield, side windows, deck hatches
    cr = p["coachroof"]
    crx0, crx1 = float(cr["x0"]), float(cr["x1"])
    hw = float(cr["half_width"])
    top_off = float(cr["top_z_off_deck"])

    def cz(x):
        return hf.deck_z(x)

    prof = [
        (crx0, cz(crx0) - 60),
        (crx0 + 260, cz(crx0 + 260) + top_off),
        (crx1 - 2900, cz(crx1 - 2900) + top_off + 20),
        (crx1 - 2500, cz(crx1 - 2500) + top_off + 110),   # raised doghouse fwd
        (crx1 - 700, cz(crx1 - 700) + top_off + 110),
        (crx1 - 160, cz(crx1 - 160) + top_off - 220),
        (crx1, cz(crx1) - 60),
    ]
    parts["coachroof"] = side_solid(prof, hw)
    parts["coachroof_windshield"] = Solid.make_box(
        330, 2 * (hw - 120), 300,
        plane=Plane(origin=(crx1 - 420, -(hw - 120), cz(crx1 - 420) + top_off - 130)))
    win_base = []
    win_glass = []
    for w in p["window_rows"]:
        wx0, wx1 = float(w[0]), float(w[1])
        wxm = (wx0 + wx1) / 2
        z0 = cz(wxm) + 280
        z1 = min(z0 + 170, cz(wxm) + top_off + 90)
        win_glass.append(Solid.make_box(wx1 - wx0, 2 * (hw + 8), z1 - z0 - 30,
                                        plane=Plane(origin=(wx0, -(hw + 8), z0 + 15))))
        win_base.append(Solid.make_box(wx1 - wx0 + 60, 2 * (hw + 2), z1 - z0,
                                       plane=Plane(origin=(wx0 - 30, -(hw + 2), z0))))
    parts["windows"] = win_base[0].fuse(*win_base[1:])
    parts["window_glass"] = win_glass[0].fuse(*win_glass[1:])
    hatches_base = []
    hatches_glass = []
    for hx, hy, hl, hwd in p["hatches"]:
        zb = hf.deck_z(hx) + CROWN * (1 - abs(hy) / 1600) - 30
        hatches_base.append(Solid.make_box(2 * hl, 2 * hwd, 45,
                                           plane=Plane(origin=(hx - hl, hy - hwd, zb))))
        hatches_glass.append(Solid.make_box(2 * hl - 60, 2 * hwd - 60, 22,
                                            plane=Plane(origin=(hx - hl + 30, hy - hwd + 30, zb + 38))))
    parts["hatches"] = hatches_base[0].fuse(*hatches_base[1:])
    parts["hatch_glass"] = hatches_glass[0].fuse(*hatches_glass[1:])

    # ---- canvas: sprayhood + bimini (TARGA) with stainless arches
    sh = p["sprayhood"]
    sh_xa, sh_xf = float(sh["x_aft"]), float(sh["x_fwd"])
    sh_pk = float(sh["peak_z"])
    parts["sprayhood"] = side_solid([
        (sh_xa, hf.deck_z(sh_xa) - 40),
        (sh_xa + 350, sh_pk - 130),
        (sh_xa + 1050, sh_pk),
        (sh_xf - 950, sh_pk - 60),
        (sh_xf - 500, hf.deck_z(sh_xf) + 340),   # windshield slopes onto coachroof top
        (sh_xf, hf.deck_z(sh_xf) - 40),
    ], float(sh["half_width"]))
    bm = p["bimini"]
    bx0, bx1, btop, bhw = float(bm["x_aft"]), float(bm["x_fwd"]), float(bm["top_z"]), float(bm["half_width"])
    frame = []
    for bx in (bx0 + 40, bx1 - 40):
        zd = hf.deck_z(bx)
        for sgn in (1, -1):
            frame.append(tube_along([
                (bx, sgn * bhw, zd - 20),
                (bx, sgn * (bhw + 150), zd + (btop - zd) * 0.55),
                (bx, sgn * 180, btop),
            ], 11))
    parts["bimini_frame"] = frame[0].fuse(*frame[1:])
    parts["bimini_fabric"] = side_solid([
        (bx0, btop - 260), (bx0 + 70, btop + 10),
        (bx1 - 70, btop - 20), (bx1, btop - 290),
    ], bhw + 40)

    # ---- rig: mast, boom + furled-main cover, double spreaders, standing rigging
    mast_x, rig_top = float(p["mast_x"]), float(p["rig_top"])
    mast_r = float(p["mast_r"])
    mast_base = cz(mast_x) + 60
    parts["mast"] = Solid.make_cylinder(
        mast_r, rig_top - mast_base,
        plane=Plane(origin=(mast_x, 0, mast_base), z_dir=(0, 0, 1)))
    boom_z, boom_len = float(p["boom_z"]), float(p["boom_len"])
    boom_end = mast_x - boom_len
    parts["boom"] = cylinder_between((mast_x - 80, 0, boom_z), (boom_end, 0, boom_z), 58)
    parts["sail_cover"] = cylinder_between(
        (mast_x - 320, 0, boom_z + 20), (boom_end + 130, 0, boom_z + 20), float(p["sail_cover_r"]))

    r_rig = 5.5
    s1z, s2z = float(p["spreader1_z_frac"]) * rig_top, float(p["spreader2_z_frac"]) * rig_top
    s1l, s2l = float(p["spreader1_len"]), float(p["spreader2_len"])
    sweep = float(np.sin(np.deg2rad(float(p["spreader_sweep_deg"]))))
    rig_bits = []
    for sgn in (1, -1):
        tip2 = (mast_x - sweep * s2l, sgn * s2l, s2z)
        tip1 = (mast_x - sweep * s1l, sgn * s1l, s1z)
        rig_bits.append(tube_along([tip1, (mast_x, 0, s1z)], 14))   # spreader 1
        rig_bits.append(tube_along([tip2, (mast_x, 0, s2z)], 14))   # spreader 2
        cp = (mast_x - 260, sgn * (hf.hb_at(mast_x - 260) - float(p["chainplate_inset"])),
              hf.sheer_at(mast_x - 260) - 10)
        rig_bits.append(tube_along([(mast_x, 0, rig_top - 120), tip2, tip1, cp], r_rig))  # cap shroud
        mid_z = (s1z + s2z) / 2
        rig_bits.append(tube_along([(mast_x, 0, mid_z + 350), (cp[0] + 320, cp[1], cp[2])], r_rig))
        rig_bits.append(tube_along([(mast_x, 0, s1z - 500), (cp[0] - 250, cp[1], cp[2])], r_rig))
    rig_bits.append(tube_along([(mast_x, 0, rig_top - 80), (loa - 200, 0, hf.sheer_at(loa - 200) + 60)], 6))
    rig_bits.append(tube_along([(mast_x, 0, 0.72 * rig_top),
                                (float(p["inner_forestay_x"]), 0, hf.deck_z(float(p["inner_forestay_x"])))], 5))
    rig_bits.append(tube_along([(mast_x, 0, rig_top - 80), (140, 0, hf.sheer_at(140) + 60)], 6))
    parts["standing_rigging"] = rig_bits[0].fuse(*rig_bits[1:])

    # ---- rails: pushpit (+ davits), pulpit, stanchions, double lifelines
    r = float(p["rail_tube_r"])
    px, ptop = float(p["pushpit_x"]), float(p["pushpit_top"])
    py = hf.hb_at(px) - 130
    pz = hf.sheer_at(px)
    rails = []
    dh = ptop + float(p["davit_height"])
    do = float(p["davit_overhang"])
    for sgn in (1, -1):
        rails.append(tube_along([(px, sgn * py, pz - 20), (px, sgn * py, ptop)], r))
        rails.append(tube_along([(px + 420, sgn * (py - 60), pz - 20), (px + 420, sgn * (py - 60), ptop - 40)], r))
        rails.append(tube_along([(px, sgn * py, ptop), (px + 420, sgn * (py - 60), ptop - 40)], r))
        rails.append(tube_along([(px, sgn * py, ptop - 320), (px + 420, sgn * (py - 60), ptop - 360)], r))
        # davits: up and over the transom
        rails.append(tube_along([
            (px, sgn * py, ptop), (-120, sgn * (py - 60), dh - 120), (do, sgn * (py - 90), dh),
        ], r))
    rails.append(cylinder_between((do, -(py - 90), dh), (do, py - 90, dh), r))
    pulp_x = float(p["pulpit_x"])
    pulp_y = hf.hb_at(pulp_x) - 70
    pulp_z = hf.sheer_at(pulp_x)
    for sgn in (1, -1):
        rails.append(tube_along([(pulp_x, sgn * pulp_y, pulp_z - 20), (pulp_x, sgn * pulp_y, pulp_z + 660)], r))
    rails.append(cylinder_between((pulp_x, -pulp_y, pulp_z + 660), (pulp_x, pulp_y, pulp_z + 660), r))
    for sx in p["stanchion_x"]:
        sx = float(sx)
        sy = hf.hb_at(sx) - 30
        sz = hf.sheer_at(sx)
        for sgn in (1, -1):
            rails.append(cylinder_between((sx, sgn * sy, sz - 15),
                                          (sx, sgn * sy, sz + float(p["stanchion_top_above_deck"])), 10))
    lv = p["lifeline_levels"]
    for lvl in lv:
        for sgn in (1, -1):
            rails.append(cylinder_between(
                (pulp_x, sgn * pulp_y, pulp_z + 660 - float(lvl) + 100),
                (px, sgn * py, ptop - float(lvl) + 60), 3.5))
    parts["rails"] = rails[0].fuse(*rails[1:])

    return parts
