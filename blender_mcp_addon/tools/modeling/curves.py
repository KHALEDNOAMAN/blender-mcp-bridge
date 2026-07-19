# blender_mcp_addon/tools/modeling/curves.py

import fnmatch
import math

import bpy  # type: ignore


class ModelingCurves:
    """Curve drafting tools: Bezier / NURBS / Poly splines with exact arcs,
    grid snapping, curve-native extrusion and beveling."""

    def create_curve(
        self,
        name,
        spline_type="BEZIER",
        points=None,
        segments=None,
        cyclic=False,
        dimensions="2D",
        fill_mode=None,
        extrude=0.0,
        bevel_depth=0.0,
        bevel_resolution=4,
        resolution_u=24,
        snap=None,
        location=(0, 0, 0),
        collection=None,
        **kwargs,
    ):
        """Create a curve object for precise 2D/3D drafting.

        Two input modes (exactly one required):
          points:   [[x, y], ...] or [[x, y, z], ...] — a single spline of
                    `spline_type` (POLY = straight lines / linear drafting,
                    BEZIER = smooth with AUTO handles, NURBS/PATH = smooth
                    approximating spline clamped to its endpoints).
          segments: a mixed straight-line/TRUE-ARC profile, built as one
                    Bezier spline with mathematically exact arc handles
                    (kappa = 4/3*tan(sweep/4), split into <=90-degree pieces).
                    Each item is one of:
                      {"type": "line", "points": [[x, y], ...]}
                      {"type": "arc", "center": [x, y], "radius": r,
                       "start_deg": a0, "end_deg": a1}
                    Consecutive segments whose endpoints coincide are joined
                    into a single continuous spline. Positive sweep
                    (end_deg > start_deg) is counter-clockwise.

        Geometry options:
          cyclic:     close the spline into a loop.
          dimensions: '2D' (flat, fillable) or '3D'.
          fill_mode:  2D: NONE/BACK/FRONT/BOTH (default BOTH).
                      3D: FULL/BACK/FRONT/HALF (default FULL).
          extrude:    TOTAL solid height. The solid spans
                      z = location.z .. location.z + extrude (the +extrude/2
                      Blender-native symmetric offset is compensated here so
                      callers can think in the repo's usual z=0..thickness terms).
          bevel_depth / bevel_resolution: curve-native rounding (pipe/rod
                      profile along the curve). Leave 0 for flat drafting.
          resolution_u: tessellation resolution used when converting/filling.
          snap:       grid increment (e.g. 0.5) — every input coordinate is
                      quantized to the nearest multiple ("grid snapping").

        The result stays a CURVE object (editable, parametric). Use
        convert_to_mesh before booleans/export.
        """
        if (points is None) == (segments is None):
            raise ValueError("Provide exactly one of 'points' or 'segments'.")

        spline_type = (spline_type or "BEZIER").upper()
        if spline_type == "PATH":
            spline_type = "NURBS"  # Blender's Path = NURBS clamped to endpoints
        if spline_type not in ("POLY", "BEZIER", "NURBS"):
            raise ValueError(
                f"spline_type must be POLY, BEZIER, NURBS or PATH, got '{spline_type}'"
            )

        def snapv(v):
            if snap:
                return round(v / snap) * snap
            return float(v)

        def to3d(p):
            if len(p) == 2:
                return (snapv(p[0]), snapv(p[1]), 0.0)
            return (snapv(p[0]), snapv(p[1]), snapv(p[2]))

        curve = bpy.data.curves.new(name, type="CURVE")
        curve.dimensions = "2D" if str(dimensions) == "2D" else "3D"
        curve.resolution_u = int(resolution_u)

        total_points = 0

        if segments is not None:
            # ── mixed line/arc profile -> one BEZIER spline with exact arcs ──
            EPS = 1e-6
            ctrl = []  # {co, hl, hr, hl_type, hr_type}

            def add_point(co, hl_type="VECTOR", hr_type="VECTOR", hl=None, hr=None):
                if ctrl:
                    prev = ctrl[-1]
                    if (
                        abs(prev["co"][0] - co[0]) < EPS
                        and abs(prev["co"][1] - co[1]) < EPS
                        and abs(prev["co"][2] - co[2]) < EPS
                    ):
                        # merge into existing junction point
                        if hr_type != "VECTOR" or hr is not None:
                            prev["hr_type"] = hr_type
                            prev["hr"] = hr
                        return prev
                pt = {"co": co, "hl": hl, "hr": hr, "hl_type": hl_type, "hr_type": hr_type}
                ctrl.append(pt)
                return pt

            for seg in segments:
                stype = (seg.get("type") or "").lower()
                if stype == "line":
                    for p in seg.get("points", []):
                        add_point(to3d(p))
                elif stype == "arc":
                    cx, cy = float(seg["center"][0]), float(seg["center"][1])
                    if snap:
                        cx = round(cx / snap) * snap
                        cy = round(cy / snap) * snap
                    r = float(seg["radius"])
                    a0 = math.radians(float(seg["start_deg"]))
                    a1 = math.radians(float(seg["end_deg"]))
                    sweep = a1 - a0
                    if abs(sweep) < 1e-9:
                        raise ValueError("arc segment has zero sweep")
                    npieces = max(1, math.ceil(abs(sweep) / (math.pi / 2) - 1e-9))
                    da = sweep / npieces
                    kappa = (4.0 / 3.0) * math.tan(da / 4.0)
                    for i in range(npieces):
                        b0 = a0 + i * da
                        b1 = b0 + da
                        p0 = (cx + r * math.cos(b0), cy + r * math.sin(b0), 0.0)
                        p1 = (cx + r * math.cos(b1), cy + r * math.sin(b1), 0.0)
                        t0 = (-math.sin(b0), math.cos(b0))
                        t1 = (-math.sin(b1), math.cos(b1))
                        h_out = (p0[0] + kappa * r * t0[0], p0[1] + kappa * r * t0[1], 0.0)
                        h_in = (p1[0] - kappa * r * t1[0], p1[1] - kappa * r * t1[1], 0.0)
                        start = add_point(p0, hr_type="FREE", hr=h_out)
                        # ensure the outgoing handle is the arc handle even on a merged junction
                        start["hr_type"] = "FREE"
                        start["hr"] = h_out
                        add_point(p1, hl_type="FREE", hl=h_in)
                else:
                    raise ValueError(f"segment type must be 'line' or 'arc', got '{stype}'")

            if len(ctrl) < 2:
                raise ValueError("profile produced fewer than 2 control points")

            # if cyclic and first == last, drop the duplicate closing point but
            # keep its incoming handle on the first point
            if cyclic and len(ctrl) > 2:
                first, last = ctrl[0], ctrl[-1]
                if (
                    abs(first["co"][0] - last["co"][0]) < EPS
                    and abs(first["co"][1] - last["co"][1]) < EPS
                ):
                    first["hl_type"] = last["hl_type"]
                    first["hl"] = last["hl"]
                    ctrl.pop()

            spline = curve.splines.new("BEZIER")
            spline.bezier_points.add(len(ctrl) - 1)
            for bp, c in zip(spline.bezier_points, ctrl, strict=True):
                bp.co = c["co"]
                bp.handle_left_type = c["hl_type"]
                bp.handle_right_type = c["hr_type"]
                if c["hl_type"] == "FREE" and c["hl"] is not None:
                    bp.handle_left = c["hl"]
                if c["hr_type"] == "FREE" and c["hr"] is not None:
                    bp.handle_right = c["hr"]
            spline.use_cyclic_u = bool(cyclic)
            total_points = len(ctrl)
            built_type = "BEZIER(segments)"
        else:
            assert points is not None  # guaranteed by the guard above
            pts = [to3d(p) for p in points]
            if len(pts) < 2:
                raise ValueError("need at least 2 points")
            if spline_type == "BEZIER":
                spline = curve.splines.new("BEZIER")
                spline.bezier_points.add(len(pts) - 1)
                for bp, co in zip(spline.bezier_points, pts, strict=True):
                    bp.co = co
                    bp.handle_left_type = "AUTO"
                    bp.handle_right_type = "AUTO"
            else:
                spline = curve.splines.new(spline_type)  # POLY or NURBS
                spline.points.add(len(pts) - 1)
                for sp, co in zip(spline.points, pts, strict=True):
                    sp.co = (co[0], co[1], co[2], 1.0)
                if spline_type == "NURBS":
                    spline.order_u = min(4, len(pts))
                    spline.use_endpoint_u = True
            spline.use_cyclic_u = bool(cyclic)
            total_points = len(pts)
            built_type = spline_type

        # fill / solidify
        if fill_mode is None:
            fill_mode = "BOTH" if curve.dimensions == "2D" else "FULL"
        try:
            curve.fill_mode = fill_mode
        except TypeError:
            pass  # enum differs between 2D/3D; keep Blender default on mismatch
        curve.extrude = float(extrude) / 2.0
        curve.bevel_depth = float(bevel_depth)
        curve.bevel_resolution = int(bevel_resolution)

        obj = bpy.data.objects.new(name, curve)
        bpy.context.collection.objects.link(obj)
        # compensate Blender's symmetric extrusion so the solid spans
        # z = location.z .. location.z + extrude
        obj.location = (
            float(location[0]),
            float(location[1]),
            float(location[2]) + float(extrude) / 2.0,
        )

        if collection:
            # Defined on the ModelingPrimitives mixin; ModelingTools (see
            # tools/modeling/__init__.py) combines both at runtime.
            self._move_to_collection_helper(obj, collection)  # type: ignore[attr-defined]

        return {
            "success": True,
            "name": obj.name,
            "spline_type": built_type,
            "num_points": total_points,
            "cyclic": bool(cyclic),
            "curve_dimensions": curve.dimensions,
            "fill_mode": curve.fill_mode,
            "extrude_total": float(extrude),
            "bevel_depth": float(bevel_depth),
            "dimensions": list(obj.dimensions),
            "message": (
                f"Curve '{obj.name}' created: {built_type}, {total_points} control points"
                + (", cyclic" if cyclic else "")
                + (f", solid height {extrude}" if extrude else "")
                + "."
            ),
        }

    def extract_sketch(self, pattern="*", include_handles=True, **kwargs):
        """Dump sketch geometry (curve splines + grease pencil strokes) as JSON.

        Coordinates are world-space (object transforms applied), so a sketch
        drawn at true scale in a mm scene comes back in mm. Bezier control
        points include handle positions/types when include_handles is True;
        POLY/NURBS splines return plain point lists. Grease pencil strokes
        return their (usually dense) sampled point lists — callers are
        expected to simplify/fit those downstream.
        """
        objects = []
        for obj in bpy.context.scene.objects:
            if not fnmatch.fnmatch(obj.name, pattern):
                continue
            mw = obj.matrix_world

            def w(co, mw=mw):  # bind per-object matrix (B023)
                v = mw @ co.to_4d() if len(co) == 4 else mw @ co
                return [round(v[0], 6), round(v[1], 6), round(v[2], 6)]

            if obj.type == "CURVE":
                splines = []
                for sp in obj.data.splines:
                    entry = {"spline_type": sp.type, "cyclic": bool(sp.use_cyclic_u)}
                    if sp.type == "BEZIER":
                        pts = []
                        for bp in sp.bezier_points:
                            p = {"co": w(bp.co)}
                            if include_handles:
                                p["handle_left"] = w(bp.handle_left)
                                p["handle_right"] = w(bp.handle_right)
                                p["handle_left_type"] = bp.handle_left_type
                                p["handle_right_type"] = bp.handle_right_type
                            pts.append(p)
                        entry["points"] = pts
                    else:
                        entry["points"] = [{"co": w(p.co.to_3d())} for p in sp.points]
                    splines.append(entry)
                objects.append(
                    {
                        "name": obj.name,
                        "type": "CURVE",
                        "curve_dimensions": obj.data.dimensions,
                        "splines": splines,
                    }
                )
            elif obj.type in ("GPENCIL", "GREASEPENCIL"):
                layers = []
                for layer in obj.data.layers:
                    frame = getattr(layer, "current_frame", None)
                    if callable(frame):
                        frame = frame()
                    if frame is None:
                        frame = getattr(layer, "active_frame", None)
                    strokes = []
                    if frame:
                        drawing = getattr(frame, "drawing", None)
                        if drawing is not None:  # Blender 4.3+ grease pencil v3
                            for st in drawing.strokes:
                                strokes.append({"points": [w(pt.position) for pt in st.points]})
                        else:  # legacy GPENCIL — bpy has no stubs, frame.strokes is dynamic
                            for st in frame.strokes:  # type: ignore[attr-defined]
                                strokes.append({"points": [w(pt.co) for pt in st.points]})
                    layers.append({"layer": layer.name, "strokes": strokes})
                objects.append({"name": obj.name, "type": "GREASE_PENCIL", "layers": layers})

        return {
            "success": True,
            "count": len(objects),
            "objects": objects,
            "message": f"Extracted {len(objects)} sketch object(s) matching '{pattern}'.",
        }
