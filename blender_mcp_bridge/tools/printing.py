# blender_mcp_bridge/tools/printing.py

from mcp import types


def get_printing_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="set_scene_units",
            description="Configure the scene measurement units and scaling. This is crucial for 3D printing because slicers expect absolute millimeter dimensions while Blender defaults to meters.",
            inputSchema={
                "type": "object",
                "properties": {
                    "system": {
                        "type": "string",
                        "enum": ["METRIC", "IMPERIAL"],
                        "description": "The unit system to use.",
                        "default": "METRIC",
                    },
                    "length_unit": {
                        "type": "string",
                        "enum": [
                            "MILLIMETERS",
                            "CENTIMETERS",
                            "METERS",
                            "INCHES",
                            "FEET",
                        ],
                        "description": "Length units of the scene.",
                        "default": "MILLIMETERS",
                    },
                    "scale": {
                        "type": "number",
                        "description": "Unit scale factor. For metric millimeters, set this to 0.001 to map 1 Blender grid unit to 1 millimeter.",
                        "default": 0.001,
                    },
                },
            },
        ),
        types.Tool(
            name="check_mesh_for_printing",
            description="Analyze a mesh object's topology for 3D printing readiness. Checks for boundary edges (holes), non-manifold edges (T-junctions), degenerate edges/faces (zero size), and computes mesh volume.",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "The name of the mesh object to analyze.",
                    }
                },
                "required": ["object_name"],
            },
        ),
        types.Tool(
            name="repair_mesh",
            description="Attempt automated non-destructive mesh cleanup and repairs (merge double vertices, fill holes, and recalculate face normals outwards).",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "The name of the mesh object to repair.",
                    },
                    "merge_distance": {
                        "type": "number",
                        "description": "Threshold distance for merging overlapping vertices.",
                        "default": 0.0001,
                    },
                    "recalculate_normals": {
                        "type": "boolean",
                        "description": "Recalculate face normals to point consistently outwards.",
                        "default": True,
                    },
                },
                "required": ["object_name"],
            },
        ),
        types.Tool(
            name="apply_voxel_remesh",
            description="Fuse multiple overlapping geometry parts into a single watertight manifold volume using a Voxel Remesh operation. Note: This operation can be lossy and deletes original UV maps.",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "The name of the mesh object to remesh.",
                    },
                    "voxel_size": {
                        "type": "number",
                        "description": "Resolution grid size. Smaller values preserve finer detail but increase processing time and mesh density.",
                        "default": 0.1,
                    },
                    "adaptivity": {
                        "type": "number",
                        "description": "Reduces polygon count on planar areas. Ranges from 0.0 (no reduction) to 1.0 (maximum decimation).",
                        "default": 0.0,
                    },
                    "clean_geometry": {
                        "type": "boolean",
                        "description": "Automatically delete disconnected loose parts from the mesh during remesh.",
                        "default": True,
                    },
                },
                "required": ["object_name"],
            },
        ),
        types.Tool(
            name="export_model",
            description="Export the specified object or the entire selection to standard formats (STL or 3MF). 3MF preserves materials and colors for multi-color printing. Relative paths are resolved against the BLENDER_ASSETS_DIR folder.",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "Optional: Name of the object to isolate and export. If omitted, exports currently selected objects.",
                    },
                    "filepath": {
                        "type": "string",
                        "description": "Optional: Filepath to export the model to (e.g. 'keychain.stl', 'model.3mf'). Defaults to '[object_name].stl' inside assets directory if omitted.",
                    },
                    "format": {
                        "type": "string",
                        "enum": ["STL", "3MF"],
                        "description": "File format to export. Use 3MF for multi-color printing with material preservation. Requires threemf_io addon for 3MF export.",
                        "default": "STL",
                    },
                    "selection_only": {
                        "type": "boolean",
                        "description": "Export only selected objects.",
                        "default": True,
                    },
                },
            },
        ),
        types.Tool(
            name="import_model",
            description="Import a 3D model file (STL, OBJ, or FBX) into the scene and select it. Relative paths are resolved against the BLENDER_ASSETS_DIR folder.",
            inputSchema={
                "type": "object",
                "properties": {
                    "filepath": {
                        "type": "string",
                        "description": "Filepath of the model to import (e.g. 'keychain.stl' or 'f:/models/part.obj').",
                    },
                },
                "required": ["filepath"],
            },
        ),
    ]
