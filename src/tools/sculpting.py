# src/tools/sculpting.py

from mcp import types


def get_sculpting_tools() -> list[types.Tool]:
    """MCP tool schemas for Blender sculpting operations."""
    return [
        types.Tool(
            name="enter_sculpt_mode",
            description="Switch a mesh object into Blender's Sculpt Mode. Must be called before set_dyntopo or symmetrize_mesh.",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "Name of the mesh object to enter sculpt mode on",
                    },
                },
                "required": ["object_name"],
            },
        ),
        types.Tool(
            name="exit_sculpt_mode",
            description="Exit Sculpt Mode and return the active object to Object Mode.",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="set_dyntopo",
            description=(
                "Enable or disable Dynamic Topology (Dyntopo) in Sculpt Mode. "
                "Dyntopo automatically subdivides or merges polygons as you sculpt, "
                "allowing unlimited resolution in specific areas. "
                "Requires enter_sculpt_mode to be called first."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "enabled": {
                        "type": "boolean",
                        "description": "True to enable Dyntopo, False to disable",
                        "default": True,
                    },
                    "detail_size": {
                        "type": "number",
                        "description": "Detail level (lower = more polygons, higher = fewer). Range: 1–100. Default: 12.",
                        "default": 12,
                    },
                    "constant_detail": {
                        "type": "boolean",
                        "description": "Use constant detail (uniform polygon size) instead of relative screen-space detail.",
                        "default": False,
                    },
                },
                "required": ["enabled"],
            },
        ),
        types.Tool(
            name="apply_sculpt_smooth",
            description=(
                "Apply Laplacian smoothing to an entire mesh to round out hard edges and surface bumps. "
                "Works in Object Mode — no live viewport needed. "
                "Use after voxel remesh to soften blocky artifacts."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "Name of the mesh object to smooth",
                    },
                    "iterations": {
                        "type": "integer",
                        "description": "Number of smoothing passes. Higher = rounder. Default: 3.",
                        "default": 3,
                    },
                    "factor": {
                        "type": "number",
                        "description": "Smoothing strength per pass (0.0 = no effect, 1.0 = maximum). Default: 0.5.",
                        "default": 0.5,
                    },
                },
                "required": ["object_name"],
            },
        ),
        types.Tool(
            name="sculpt_inflate",
            description=(
                "Inflate or deflate a mesh by displacing all vertices along their surface normals. "
                "Positive distance = expand outward like a balloon. "
                "Negative distance = shrink inward. "
                "Use mask_below_z to protect the flat base (e.g. mask_below_z=0.0 keeps the bottom flat)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "Name of the mesh object to inflate/deflate",
                    },
                    "distance": {
                        "type": "number",
                        "description": "Displacement distance along normals. Positive = expand, negative = shrink. Default: 0.05.",
                        "default": 0.05,
                    },
                    "mask_below_z": {
                        "type": "number",
                        "description": "Optional world-space Z coordinate below which vertices are NOT moved (protects flat base). Matches the object's Location Z in the UI, not local mesh coordinates.",
                    },
                },
                "required": ["object_name"],
            },
        ),
        types.Tool(
            name="sculpt_grab",
            description=(
                "Grab-brush style sculpt: move vertices near a 3D location by an offset vector. "
                "Uses smooth cosine falloff: vertices at the center move the full offset, "
                "vertices at the radius edge are barely moved. "
                "Use this to pull a boat bow into a point, push in dents, raise terrain hills, etc."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "Name of the mesh object to sculpt",
                    },
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "3D center [x, y, z] of the grab operation in world space",
                    },
                    "offset": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Direction and distance to pull/push [dx, dy, dz]",
                    },
                    "radius": {
                        "type": "number",
                        "description": "Radius of influence around the location. Default: 1.0.",
                        "default": 1.0,
                    },
                },
                "required": ["object_name", "location", "offset"],
            },
        ),
        types.Tool(
            name="symmetrize_mesh",
            description=(
                "Mirror mesh geometry across an axis so both sides are perfectly symmetric. "
                "The source side overwrites the mirror side. "
                "POSITIVE_X copies the +X half to the -X side. "
                "Automatically enters and exits Sculpt Mode."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "Name of the mesh object to symmetrize",
                    },
                    "direction": {
                        "type": "string",
                        "enum": [
                            "POSITIVE_X",
                            "NEGATIVE_X",
                            "POSITIVE_Y",
                            "NEGATIVE_Y",
                            "POSITIVE_Z",
                            "NEGATIVE_Z",
                        ],
                        "description": "Which side is the source that gets mirrored. Default: POSITIVE_X.",
                        "default": "POSITIVE_X",
                    },
                },
                "required": ["object_name"],
            },
        ),
    ]
