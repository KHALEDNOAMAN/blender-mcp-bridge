# blender_mcp_bridge/tools/modeling/modifiers.py

from mcp import types


def get_modifier_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="apply_modifier",
            description=(
                "ADDS and configures a modifier - despite the name it does NOT "
                "bake it. ALWAYS follow with apply_all_modifiers, or the "
                "modifier stays live and the next operation sees unmodified "
                "geometry. Verify with the vertex count, not the success flag. "
                "POWER TIP: Use 'target_objects' to add AND sync this modifier "
                "to multiple objects in ONE call! This is much faster than "
                "adding modifiers one-by-one or using copy_modifier."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "Primary object to add modifier to",
                    },
                    "modifier_type": {
                        "type": "string",
                        "description": (
                            "ARRAY, SOLIDIFY, BEVEL, MIRROR, SUBSURF, "
                            "WIREFRAME, SMOOTH, BOOLEAN, DECIMATE, SCREW, "
                            "SIMPLE_DEFORM, TRIANGULATE, REMESH. Only these "
                            "types are configured; any other is created but "
                            "left at its defaults while still reporting "
                            "success."
                        ),
                    },
                    "name": {
                        "type": "string",
                        "description": "Optional custom name for the modifier",
                    },
                    "target_objects": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of additional object names to sync this modifier to.",
                    },
                    "count": {
                        "type": "integer",
                        "description": "For ARRAY: number of copies",
                    },
                    "use_relative_offset": {
                        "type": "boolean",
                        "description": "For ARRAY",
                    },
                    "use_constant_offset": {
                        "type": "boolean",
                        "description": "For ARRAY",
                    },
                    "constant_offset_displace": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "For ARRAY: XYZ offset",
                    },
                    "relative_offset_displace": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "For ARRAY: Relative XYZ offset",
                    },
                    "thickness": {
                        "type": "number",
                        "description": "For SOLIDIFY, WIREFRAME",
                    },
                    "offset": {"type": "number", "description": "For SOLIDIFY"},
                    "ratio": {
                        "type": "number",
                        "description": "For DECIMATE (collapse): keep this fraction of faces, e.g. 0.35",
                    },
                    "decimate_type": {
                        "type": "string",
                        "description": "For DECIMATE: COLLAPSE (default), UNSUBDIV, or DISSOLVE",
                    },
                    "mode": {
                        "type": "string",
                        "description": "For REMESH: BLOCKS, SMOOTH, SHARP (default) or VOXEL",
                    },
                    "octree_depth": {
                        "type": "integer",
                        "description": (
                            "For REMESH in BLOCKS/SMOOTH/SHARP mode: resolution "
                            "of the octree scan. Higher is finer and far heavier."
                        ),
                    },
                    "voxel_size": {
                        "type": "number",
                        "description": "For REMESH in VOXEL mode: cell size in scene units",
                    },
                    "adaptivity": {
                        "type": "number",
                        "description": "For REMESH: collapse flat areas to reduce face count",
                    },
                    "quad_method": {
                        "type": "string",
                        "description": (
                            "For TRIANGULATE: BEAUTY (default), FIXED, "
                            "FIXED_ALTERNATE or SHORTEST_DIAGONAL"
                        ),
                    },
                    "ngon_method": {
                        "type": "string",
                        "description": "For TRIANGULATE: BEAUTY (default) or CLIP",
                    },
                    "min_vertices": {
                        "type": "integer",
                        "description": "For TRIANGULATE: only split faces with at least this many verts",
                    },
                    "width": {
                        "type": "number",
                        "description": "For BEVEL: how far the rounding reaches back from the edge, in scene units. Keep it under half the thinnest wall it touches.",
                    },
                    "segments": {
                        "type": "integer",
                        "description": "For BEVEL: 1 gives a flat chamfer, 2+ approximates a fillet. Each segment multiplies the face count, so 2-3 is usually enough for printed parts.",
                    },
                    "use_clamp_overlap": {
                        "type": "boolean",
                        "description": "For BEVEL: shrink the width automatically where geometry is too close for the requested size, instead of self-intersecting.",
                    },
                    "limit_method": {
                        "type": "string",
                        "enum": ["ANGLE", "NONE", "WEIGHT", "VGROUP"],
                        "description": "For BEVEL: which edges are affected. ANGLE (Blender's default, 30 degrees) bevels every edge sharper than angle_limit_deg, which on a boxy part means ALL of them. NONE bevels every edge unconditionally. Raise angle_limit_deg to target only sharp corners.",
                    },
                    "angle_limit_deg": {
                        "type": "number",
                        "description": "For BEVEL with limit_method ANGLE: only edges sharper than this are bevelled, in degrees. Blender's default is 30.",
                    },
                    "affect": {
                        "type": "string",
                        "enum": ["EDGES", "VERTICES"],
                        "description": "For BEVEL: round edges (the usual choice) or only the corner vertices.",
                    },
                    "harden_normals": {
                        "type": "boolean",
                        "description": "For BEVEL: shading only, no effect on exported geometry.",
                    },
                    "miter_outer": {
                        "type": "string",
                        "enum": ["SHARP", "PATCH", "ARC"],
                        "description": "For BEVEL: how bevels meet at an outer corner. ARC gives the roundest result.",
                    },
                    "levels": {"type": "integer", "description": "For SUBSURF"},
                    "render_levels": {"type": "integer", "description": "For SUBSURF"},
                    "use_axis": {
                        "type": "array",
                        "items": {"type": "boolean"},
                        "description": "For MIRROR: List of 3 booleans [X, Y, Z]",
                    },
                    "mirror_object": {
                        "type": "string",
                        "description": "For MIRROR: Object to use as mirror center",
                    },
                    "use_replace_original": {
                        "type": "boolean",
                        "description": "For WIREFRAME",
                    },
                    "factor": {"type": "number", "description": "For SMOOTH"},
                    "iterations": {"type": "integer", "description": "For SMOOTH"},
                    "object_b": {
                        "type": "string",
                        "description": "For BOOLEAN: Cutter object",
                    },
                    "axis": {
                        "type": "string",
                        "enum": ["X", "Y", "Z"],
                        "description": (
                            "For SCREW (lathe/spin/revolve): axis to revolve the profile "
                            "around. The profile (a 2D curve profile converted to mesh, or an "
                            "edge chain) must sit offset from this axis in the plane "
                            "perpendicular to it, e.g. an XZ profile with axis='Z' traces a "
                            "cup/vase wall from the object's local origin outward."
                        ),
                    },
                    "angle_deg": {
                        "type": "number",
                        "default": 360,
                        "description": "For SCREW: total sweep angle in degrees (360 = full lathe revolution).",
                    },
                    "steps": {
                        "type": "integer",
                        "default": 32,
                        "description": "For SCREW: number of rotational steps (viewport and render) — higher = smoother revolution.",
                    },
                    "screw_offset": {
                        "type": "number",
                        "default": 0,
                        "description": "For SCREW: distance to move along the axis per revolution (0 for a closed lathe shape, nonzero for a helix/thread).",
                    },
                    "use_merge_vertices": {
                        "type": "boolean",
                        "default": True,
                        "description": "For SCREW: weld the seam vertices where the revolution closes (needed for a watertight print).",
                    },
                    "merge_threshold": {
                        "type": "number",
                        "default": 0.0001,
                        "description": "For SCREW: distance under which seam vertices are merged.",
                    },
                    "deform_method": {
                        "type": "string",
                        "enum": ["TWIST", "BEND", "TAPER", "STRETCH"],
                        "default": "TWIST",
                        "description": (
                            "For SIMPLE_DEFORM: deformation type. TWIST rotates geometry "
                            "progressively along deform_axis (e.g. a spiral-fluted vase on top "
                            "of a SCREW-lathed ribbed profile). BEND curves it, TAPER/STRETCH "
                            "scale it along the axis."
                        ),
                    },
                    "deform_axis": {
                        "type": "string",
                        "enum": ["X", "Y", "Z"],
                        "default": "Z",
                        "description": "For SIMPLE_DEFORM: axis the deformation is applied along.",
                    },
                    "limits": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "For SIMPLE_DEFORM: [low, high] 0-1 range along the axis that the deform applies to (default full range).",
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["INTERSECT", "UNION", "DIFFERENCE", "N.A"],
                        "default": "N.A",
                        "description": "For BOOLEAN",
                    },
                    "solver": {
                        "type": "string",
                        "enum": ["FLOAT", "EXACT", "N.A"],
                        "default": "N.A",
                        "description": "For BOOLEAN",
                    },
                    "hide_cutter": {
                        "type": "boolean",
                        "default": True,
                        "description": "For BOOLEAN: Hide the cutter object",
                    },
                },
                "required": ["object_name", "modifier_type"],
            },
        ),
        types.Tool(
            name="remove_modifier",
            description="Remove a modifier from an object",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "Name of the object to remove modifier from",
                    },
                    "modifier_name": {
                        "type": "string",
                        "description": "Name of the modifier to remove",
                    },
                },
                "required": ["object_name", "modifier_name"],
            },
        ),
        types.Tool(
            name="copy_modifier",
            description="Copy a modifier from a source object to target objects.",
            inputSchema={
                "type": "object",
                "properties": {
                    "source_object": {
                        "type": "string",
                        "description": "Name of the object that has the modifier",
                    },
                    "target_objects": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of object names to copy to",
                    },
                    "target_collection": {
                        "type": "string",
                        "description": "Name of collection. All objects in it will be targets.",
                    },
                    "modifier_name": {
                        "type": "string",
                        "description": "Exact name of the modifier to copy.",
                    },
                },
                "required": ["source_object", "modifier_name"],
            },
        ),
        types.Tool(
            name="boolean_operation",
            description=(
                "Boolean operation between objects or collections. SLICE cuts a hole AND keeps "
                "the piece as a new object; operand_type='COLLECTION' uses all objects in a "
                "collection as cutters. CRITICAL: object_a must NOT be inside collection "
                "object_b (self-subtraction deletes it). Prefer the 'EXACT' solver. The cutter "
                "is auto-hidden."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "object_a": {"type": "string", "description": "Base object name"},
                    "object_b": {
                        "type": "string",
                        "description": "Operand name (Object or Collection name)",
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["INTERSECT", "UNION", "DIFFERENCE", "SLICE"],
                        "description": "Operation type. SLICE is custom: Difference + Intersection result.",
                    },
                    "operand_type": {
                        "type": "string",
                        "enum": ["OBJECT", "COLLECTION"],
                        "default": "OBJECT",
                        "description": "Whether object_b is a single object or a collection of objects.",
                    },
                    "solver": {
                        "type": "string",
                        "enum": ["FLOAT", "EXACT", "MANIFOLD", "N.A"],
                        "default": "EXACT",
                        "description": "Solver algorithm: FLOAT (legacy/fast), EXACT (reliable), MANIFOLD (mesh-safe)",
                    },
                    "hide_cutter": {
                        "type": "boolean",
                        "default": True,
                        "description": "Hide the cutter object after operation",
                    },
                },
                "required": ["object_a", "object_b", "operation"],
            },
        ),
    ]
