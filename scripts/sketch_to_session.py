# scripts/sketch_to_session.py
"""Convert an extract_sketch dump into a replayable session.json.

Pipeline (Level-1 "literal trace"):
  1. Load the JSON returned by the extract_sketch tool.
  2. Sample every curve spline / grease pencil stroke into a dense 2D polyline
     (z is dropped — sketches are assumed flat).
  3. Greedy segment fitting: grow maximal windows of points that fit either a
     straight line (chord deviation < tol) or a TRUE ARC (Kasa circle fit,
     radial deviation < tol). Arcs win when they reach further than lines, so
     a hand-drawn or Bezier circle comes back as an exact create_curve arc.
  4. The largest closed loop becomes the extruded outer body; every other
     closed loop inside it becomes a boolean-cut hole.
  5. Emit session.json: set_scene_units, create_curve per loop,
     convert_to_mesh, boolean_operation DIFFERENCE per hole, repair_mesh and
     the check_mesh_for_printing gate.

Usage:
  python scripts/sketch_to_session.py extract.json -o session.json \
      --name MyPart --extrude 5 --tol 0.15
  python scripts/sketch_to_session.py --selftest
"""

import argparse
import json
import math
import sys

# ---------------------------------------------------------------- sampling


def _cubic(p0, c0, c1, p1, t):
    u = 1.0 - t
    return (
        u * u * u * p0[0] + 3 * u * u * t * c0[0] + 3 * u * t * t * c1[0] + t * t * t * p1[0],
        u * u * u * p0[1] + 3 * u * u * t * c0[1] + 3 * u * t * t * c1[1] + t * t * t * p1[1],
    )


def sample_spline(spline, samples_per_seg=32):
    """Dense 2D polyline from one extract_sketch spline entry."""
    pts = spline["points"]
    cyclic = bool(spline.get("cyclic"))
    if spline.get("spline_type") == "BEZIER" and pts and "handle_right" in pts[0]:
        out = []
        n = len(pts)
        pairs = n if cyclic else n - 1
        for i in range(pairs):
            a, b = pts[i], pts[(i + 1) % n]
            for k in range(samples_per_seg):
                out.append(
                    _cubic(a["co"], a["handle_right"], b["handle_left"], b["co"], k / samples_per_seg)
                )
        if not cyclic:
            out.append((pts[-1]["co"][0], pts[-1]["co"][1]))
        return out, cyclic
    return [(p["co"][0], p["co"][1]) for p in pts], cyclic


def dedupe(poly, eps=1e-6):
    out = []
    for p in poly:
        if not out or abs(p[0] - out[-1][0]) > eps or abs(p[1] - out[-1][1]) > eps:
            out.append(p)
    return out


# ---------------------------------------------------------------- fitting


def _chord_dev(pts, i, j):
    ax, ay = pts[i]
    bx, by = pts[j]
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    if L < 1e-12:
        return max(math.hypot(p[0] - ax, p[1] - ay) for p in pts[i : j + 1])
    return max(abs((p[0] - ax) * dy - (p[1] - ay) * dx) / L for p in pts[i : j + 1])


def _kasa_fit(pts):
    """Least-squares circle (Kasa). Returns (cx, cy, r) or None if degenerate."""
    n = len(pts)
    sx = sum(p[0] for p in pts) / n
    sy = sum(p[1] for p in pts) / n
    suu = suv = svv = suuu = svvv = suvv = svuu = 0.0
    for x, y in pts:
        u, v = x - sx, y - sy
        suu += u * u
        svv += v * v
        suv += u * v
        suuu += u * u * u
        svvv += v * v * v
        suvv += u * v * v
        svuu += v * u * u
    det = suu * svv - suv * suv
    if abs(det) < 1e-12:
        return None
    b1 = 0.5 * (suuu + suvv)
    b2 = 0.5 * (svvv + svuu)
    uc = (svv * b1 - suv * b2) / det
    vc = (suu * b2 - suv * b1) / det
    r = math.sqrt(uc * uc + vc * vc + (suu + svv) / n)
    return (sx + uc, sy + vc, r)


def _arc_dev(pts, fit):
    cx, cy, r = fit
    return max(abs(math.hypot(p[0] - cx, p[1] - cy) - r) for p in pts)


def _fits(pts, i, j, tol, min_arc_pts=6, max_radius=5000.0):
    """Return ('line'|'arc'|None, fit) for window [i..j]."""
    if _chord_dev(pts, i, j) <= tol:
        return "line", None
    if j - i + 1 >= min_arc_pts:
        fit = _kasa_fit(pts[i : j + 1])
        if fit and fit[2] <= max_radius and _arc_dev(pts[i : j + 1], fit) <= tol:
            return "arc", fit
    return None, None


def _arc_params(pts, i, j, fit):
    """center/radius/start/end degrees, sweep following the point direction."""
    cx, cy, r = fit
    a0 = math.atan2(pts[i][1] - cy, pts[i][0] - cx)
    prev = a0
    total = 0.0
    for k in range(i + 1, j + 1):
        a = math.atan2(pts[k][1] - cy, pts[k][0] - cx)
        d = a - prev
        while d > math.pi:
            d -= 2 * math.pi
        while d < -math.pi:
            d += 2 * math.pi
        total += d
        prev = a
    return {
        "type": "arc",
        "center": [round(cx, 4), round(cy, 4)],
        "radius": round(r, 4),
        "start_deg": round(math.degrees(a0), 3),
        "end_deg": round(math.degrees(a0 + total), 3),
    }


def densify(poly, max_step=0.5, closed=True):
    """Insert points so consecutive spacing <= max_step. Long straight edges
    with only 2 vertices would otherwise have no interior samples, letting a
    large-radius arc 'fit' right through them."""
    out = []
    n = len(poly)
    edges = n if closed else n - 1
    for k in range(edges):
        a, b = poly[k], poly[(k + 1) % n]
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        steps = max(1, math.ceil(d / max_step))
        for s in range(steps):
            t = s / steps
            out.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
    if not closed:
        out.append(poly[-1])
    return out


def fit_segments(poly, tol=0.15, closed=True):
    """Greedy maximal line/arc fitting over a dense polyline.

    Returns a create_curve 'segments' list. For closed loops the input should
    NOT repeat the first point; the closing edge is handled by cyclic=True on
    the emitted curve (the fitter appends the first point to close the walk).
    """
    pts = densify(poly, closed=closed)
    if closed:
        pts = pts + [pts[0]]
    n = len(pts)
    segments = []
    pending_line = []  # accumulated line vertices to merge into one segment

    def flush_line():
        nonlocal pending_line
        if len(pending_line) >= 2:
            segments.append(
                {"type": "line", "points": [[round(x, 4), round(y, 4)] for x, y in pending_line]}
            )
        pending_line = []

    def max_window(i, ok):
        """Largest j >= i+1 such that ok(i, j) holds (exponential + binary search)."""
        j = i + 1
        step = 4
        while j < n - 1 and ok(i, min(j + step, n - 1)):
            j = min(j + step, n - 1)
            step *= 2
        lo, hi = j, min(j + step, n - 1)
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if ok(i, mid):
                lo = mid
            else:
                hi = mid - 1
        return lo

    def line_ok(i, j):
        return _chord_dev(pts, i, j) <= tol

    def arc_ok(i, j):
        return _fits(pts, i, j, tol)[0] is not None

    i = 0
    while i < n - 1:
        j_line = max_window(i, line_ok)
        j_any = max_window(i, arc_ok)
        # only accept an arc when it reaches meaningfully further than the
        # best straight line — otherwise huge-radius arcs eat straight edges
        if j_any - i > 1.3 * (j_line - i) + 2:
            kind, fit = _fits(pts, i, j_any, tol)
            if kind == "arc" and fit is not None:
                flush_line()
                segments.append(_arc_params(pts, i, j_any, fit))
                i = j_any
                continue
        if not pending_line:
            pending_line.append(pts[i])
        pending_line.append(pts[j_line])
        i = j_line
    flush_line()
    return segments


# ---------------------------------------------------------------- loops


def shoelace(poly):
    s = 0.0
    for k in range(len(poly)):
        x0, y0 = poly[k]
        x1, y1 = poly[(k + 1) % len(poly)]
        s += x0 * y1 - x1 * y0
    return 0.5 * s


def point_in_poly(pt, poly):
    x, y = pt
    inside = False
    for k in range(len(poly)):
        x0, y0 = poly[k]
        x1, y1 = poly[(k + 1) % len(poly)]
        if (y0 > y) != (y1 > y):
            if x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
                inside = not inside
    return inside


def collect_loops(extract, close_tol=1.0, samples_per_seg=32):
    """All closed loops (dense polylines) from an extract_sketch payload."""
    loops, skipped = [], []
    for obj in extract.get("objects", extract if isinstance(extract, list) else []):
        if obj["type"] == "CURVE":
            sources = [(obj["name"], sp) for sp in obj["splines"]]
            for name, sp in sources:
                poly, cyclic = sample_spline(sp, samples_per_seg)
                poly = dedupe(poly)
                if len(poly) < 3:
                    continue
                if not cyclic:
                    gap = math.hypot(poly[0][0] - poly[-1][0], poly[0][1] - poly[-1][1])
                    if gap <= close_tol:
                        cyclic = True
                        if gap > 1e-6:
                            poly = poly[:-1] if gap < 1e-6 else poly
                if cyclic:
                    if math.hypot(poly[0][0] - poly[-1][0], poly[0][1] - poly[-1][1]) < 1e-6:
                        poly = poly[:-1]
                    loops.append({"name": name, "poly": poly})
                else:
                    skipped.append(name)
        elif obj["type"] == "GREASE_PENCIL":
            for layer in obj["layers"]:
                for si, st in enumerate(layer["strokes"]):
                    poly = dedupe([(p[0], p[1]) for p in st["points"]])
                    if len(poly) < 3:
                        continue
                    gap = math.hypot(poly[0][0] - poly[-1][0], poly[0][1] - poly[-1][1])
                    name = f"{obj['name']}_{layer['layer']}_{si}"
                    if gap <= close_tol:
                        loops.append({"name": name, "poly": poly})
                    else:
                        skipped.append(name)
    return loops, skipped


# ---------------------------------------------------------------- session


def build_session(loops, name, extrude, tol, model="claude-fable-5"):
    for lp in loops:
        lp["area"] = abs(shoelace(lp["poly"]))
    loops.sort(key=lambda a: -a["area"])
    outer, rest = loops[0], loops[1:]
    holes = [lp for lp in rest if point_in_poly(lp["poly"][0], outer["poly"])]
    ignored = [lp["name"] for lp in rest if lp not in holes]

    cmds = [
        {
            "tool": "set_scene_units",
            "arguments": {"system": "METRIC", "length_unit": "MILLIMETERS", "scale": 0.001},
            "description": "Set scene to mm",
        }
    ]
    body = f"{name}_body"
    cmds.append(
        {
            "tool": "create_curve",
            "arguments": {
                "name": body,
                "segments": fit_segments(outer["poly"], tol),
                "cyclic": True,
                "dimensions": "2D",
                "extrude": extrude,
            },
            "description": f"Outer outline traced from sketch '{outer['name']}', extruded {extrude}mm",
        }
    )
    cmds.append(
        {
            "tool": "convert_to_mesh",
            "arguments": {"object_name": body},
            "description": "Curve -> mesh before booleans",
        }
    )
    for hi, lp in enumerate(holes, 1):
        hname = f"{name}_hole{hi}"
        cmds.append(
            {
                "tool": "create_curve",
                "arguments": {
                    "name": hname,
                    "segments": fit_segments(lp["poly"], tol),
                    "cyclic": True,
                    "dimensions": "2D",
                    "extrude": extrude + 2.0,
                    "location": [0, 0, -1.0],
                },
                "description": f"Hole cutter from sketch loop '{lp['name']}' (overshoots both faces)",
            }
        )
        cmds.append(
            {
                "tool": "convert_to_mesh",
                "arguments": {"object_name": hname},
                "description": "Cutter curve -> mesh",
            }
        )
        cmds.append(
            {
                "tool": "boolean_operation",
                "arguments": {"object_a": body, "object_b": hname, "operation": "DIFFERENCE"},
                "description": f"Cut hole {hi}",
            }
        )
    cmds.append(
        {
            "tool": "repair_mesh",
            "arguments": {"object_name": body},
            "description": "Repair before print gate",
        }
    )
    cmds.append(
        {
            "tool": "check_mesh_for_printing",
            "arguments": {"object_name": body},
            "description": "Watertight/degenerate gate — must pass before export",
        }
    )
    session = {
        "metadata": {
            "name": f"{name} — generated from Blender sketch",
            "model": model,
            "description": (
                f"Auto-generated by sketch_to_session.py: outer loop '{outer['name']}' "
                f"extruded {extrude}mm with {len(holes)} hole(s). Fit tolerance {tol}mm."
            ),
        },
        "commands": cmds,
    }
    return session, ignored


# ---------------------------------------------------------------- selftest


def _selftest():
    """Rounded rectangle 60x40 (R8 corners) with a 6mm-radius hole."""

    def rounded_rect(w, h, r, step=0.5):
        pts = []

        def arc(cx, cy, a0, a1):
            n = max(2, int(abs(a1 - a0) * r / step))
            for k in range(n + 1):
                a = a0 + (a1 - a0) * k / n
                pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))

        pts.append((r, 0))
        pts.append((w - r, 0))
        arc(w - r, r, -math.pi / 2, 0)
        pts.append((w, h - r))
        arc(w - r, h - r, 0, math.pi / 2)
        pts.append((r, h))
        arc(r, h - r, math.pi / 2, math.pi)
        pts.append((0, r))
        arc(r, r, math.pi, 3 * math.pi / 2)
        return dedupe(pts)

    outer = rounded_rect(60, 40, 8)
    hole = [
        (30 + 6 * math.cos(2 * math.pi * k / 96), 20 + 6 * math.sin(2 * math.pi * k / 96))
        for k in range(96)
    ]
    loops = [{"name": "outer", "poly": outer}, {"name": "hole", "poly": hole}]
    session, _ = build_session(loops, "SelfTest", 5.0, 0.1)
    segs = session["commands"][1]["arguments"]["segments"]
    arcs = [s for s in segs if s["type"] == "arc"]
    lines = [s for s in segs if s["type"] == "line"]
    assert len(arcs) >= 4, f"expected >=4 corner arcs, got {len(arcs)}: {segs}"
    for a in arcs:
        assert abs(a["radius"] - 8.0) < 0.15, f"corner radius off: {a}"
    hole_cmd = next(c for c in session["commands"] if "hole1" in c["arguments"].get("name", ""))
    hsegs = hole_cmd["arguments"]["segments"]
    harcs = [s for s in hsegs if s["type"] == "arc"]
    assert harcs and all(abs(s["radius"] - 6.0) < 0.1 for s in harcs), f"hole fit bad: {hsegs}"
    total_sweep = sum(abs(s["end_deg"] - s["start_deg"]) for s in harcs)
    assert total_sweep > 350, f"hole arcs only sweep {total_sweep} deg"
    boolean = [c for c in session["commands"] if c["tool"] == "boolean_operation"]
    assert len(boolean) == 1
    print(f"selftest OK: outer = {len(lines)} line seg(s) + {len(arcs)} arc(s), "
          f"hole = {len(harcs)} arc(s) sweeping {round(total_sweep, 1)} deg")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", nargs="?", help="extract_sketch JSON dump")
    ap.add_argument("-o", "--output", default="sketch_session.json")
    ap.add_argument("--name", default="Sketch", help="Base name for generated objects")
    ap.add_argument("--extrude", type=float, default=5.0, help="Solid height in mm")
    ap.add_argument("--tol", type=float, default=0.15, help="Fit tolerance in mm")
    ap.add_argument("--close-tol", type=float, default=1.0, help="Max gap (mm) to snap a loop closed")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        _selftest()
        return
    if not args.input:
        ap.error("input JSON required (or --selftest)")

    with open(args.input, encoding="utf-8") as f:
        extract = json.load(f)
    loops, skipped = collect_loops(extract, close_tol=args.close_tol)
    if not loops:
        sys.exit("No closed loops found in the sketch dump.")
    session, ignored = build_session(loops, args.name, args.extrude, args.tol)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(session, f, indent=2)
    print(f"Wrote {args.output}: {len(session['commands'])} commands from {len(loops)} loop(s).")
    if skipped:
        print(f"Skipped open (non-closed) paths: {', '.join(skipped)}")
    if ignored:
        print(f"Ignored loops outside the outer outline: {', '.join(ignored)}")


if __name__ == "__main__":
    main()
