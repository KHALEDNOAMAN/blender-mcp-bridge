# src/tools/modeling/curves.py

from mcp import types


def get_curve_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="create_curve",
            description=(
                "Create a curve for precise 2D/3D drafting: POLY/BEZIER/NURBS/PATH splines, or "
                "a mixed line + TRUE-ARC profile via 'segments' (exact arcs from center/radius/"
                "angles — use this for radius-gauge-style geometry, never tessellated points). "
                "Supports grid snapping, extrusion into a solid, bevel, and fill. Result stays "
                "an editable CURVE; run convert_to_mesh before booleans or export."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Object name"},
                    "spline_type": {
                        "type": "string",
                        "enum": ["POLY", "BEZIER", "NURBS", "PATH"],
                        "default": "BEZIER",
                        "description": (
                            "Spline type for 'points' mode. POLY = straight segments (linear "
                            "drafting). PATH = NURBS clamped to its endpoints. Ignored in "
                            "'segments' mode (always exact-arc Bezier)."
                        ),
                    },
                    "points": {
                        "type": "array",
                        "items": {"type": "array", "items": {"type": "number"}},
                        "description": (
                            "[[x,y],...] or [[x,y,z],...] control points for a single spline. "
                            "Provide either 'points' OR 'segments', not both."
                        ),
                    },
                    "segments": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string", "enum": ["line", "arc"]},
                                "points": {
                                    "type": "array",
                                    "items": {"type": "array", "items": {"type": "number"}},
                                    "description": "For 'line': ordered [[x,y],...] vertices.",
                                },
                                "center": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                    "description": "For 'arc': [cx, cy] arc center.",
                                },
                                "radius": {"type": "number", "description": "For 'arc': radius."},
                                "start_deg": {
                                    "type": "number",
                                    "description": "For 'arc': start angle in degrees.",
                                },
                                "end_deg": {
                                    "type": "number",
                                    "description": (
                                        "For 'arc': end angle in degrees. end > start sweeps "
                                        "counter-clockwise; end < start sweeps clockwise."
                                    ),
                                },
                            },
                            "required": ["type"],
                        },
                        "description": (
                            "Mixed profile of line and TRUE-ARC segments, joined into one "
                            "continuous Bezier spline (exact arc handles, split into <=90deg "
                            "pieces). Segments whose endpoints coincide are welded."
                        ),
                    },
                    "cyclic": {
                        "type": "boolean",
                        "default": False,
                        "description": "Close the spline into a loop (needed for fillable outlines).",
                    },
                    "dimensions": {
                        "type": "string",
                        "enum": ["2D", "3D"],
                        "default": "2D",
                        "description": "2D = flat, fillable drafting plane. 3D = free-space curve.",
                    },
                    "fill_mode": {
                        "type": "string",
                        "description": "2D: NONE/BACK/FRONT/BOTH (default BOTH). 3D: FULL/BACK/FRONT/HALF (default FULL).",
                    },
                    "extrude": {
                        "type": "number",
                        "default": 0,
                        "description": (
                            "TOTAL solid height in scene units (mm). The filled curve becomes a "
                            "solid spanning z = location.z .. location.z + extrude."
                        ),
                    },
                    "bevel_depth": {
                        "type": "number",
                        "default": 0,
                        "description": "Curve-native bevel radius (turns the curve into a rounded rod/pipe profile).",
                    },
                    "bevel_resolution": {
                        "type": "integer",
                        "default": 4,
                        "description": "Smoothness of the bevel cross-section.",
                    },
                    "resolution_u": {
                        "type": "integer",
                        "default": 24,
                        "description": "Tessellation resolution per spline segment when filling/converting.",
                    },
                    "snap": {
                        "type": "number",
                        "description": (
                            "Grid-snap increment (e.g. 0.5): every input coordinate is quantized "
                            "to the nearest multiple before building the curve."
                        ),
                    },
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ world-space origin (default [0,0,0]).",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: collection to place the object in.",
                    },
                },
                "required": ["name"],
            },
        ),
        types.Tool(
            name="extract_sketch",
            description=(
                "Reverse of create_curve: dump sketched CURVE and grease-pencil geometry as "
                "world-space JSON (control points, cyclic flags, Bezier handles, stroke points). "
                "Read-only. Feed the result to scripts/sketch_to_session.py to fit lines/arcs "
                "into a replayable session.json."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "default": "*",
                        "description": "fnmatch pattern of object names to extract (e.g. 'Sketch*').",
                    },
                    "include_handles": {
                        "type": "boolean",
                        "default": True,
                        "description": "Include Bezier handle positions/types for curve points.",
                    },
                },
            },
        ),
    ]
