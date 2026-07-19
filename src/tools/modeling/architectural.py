# src/tools/modeling/architectural.py

from mcp import types


def get_architectural_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="build_room_shell",
            description=(
                "PRIMARY TOOL for a 3D architectural shell from a 2D floor plan: call ONCE for "
                "the whole building outer perimeter (ordered [x,y] vertices), never per room. "
                "Creates {name}_Floor, {name}_Walls, {name}_Ceiling. Then add interior "
                "partitions with build_wall_segment / build_wall_with_door."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "vertices": {
                        "type": "array",
                        "minItems": 3,
                        "items": {
                            "type": "array",
                            "minItems": 2,
                            "items": {"type": "number"},
                            "description": "[x, y] or [x, y, z] — z is ignored, floor is always at Z=0",
                        },
                        "description": (
                            "Ordered perimeter vertices of the building/unit footprint. "
                            "Minimum 3 vertices required. "
                            "E.g. for a 10x6 rectangle: [[0,0],[10,0],[10,6],[0,6]]"
                        ),
                    },
                    "height": {
                        "type": "number",
                        "default": 2.8,
                        "description": "Ceiling/wall height in metres (default 2.8)",
                    },
                    "wall_thickness": {
                        "type": "number",
                        "default": 0.2,
                        "description": "Exterior wall thickness in metres (default 0.2 = 200mm standard).",
                    },
                    "floor_thickness": {
                        "type": "number",
                        "default": 0.15,
                        "description": "Floor slab thickness in metres, grows downward (default 0.15 = 150mm).",
                    },
                    "name": {
                        "type": "string",
                        "description": "Base name — objects will be {name}_Floor, {name}_Walls, {name}_Ceiling",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Collection to place the three objects in",
                    },
                    "doors": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "edge_index": {
                                    "type": "integer",
                                    "description": "0-indexed index of the edge in the vertices loop",
                                },
                                "door_offset": {
                                    "type": "number",
                                    "description": "Distance from the start vertex of the edge",
                                },
                                "door_width": {
                                    "type": "number",
                                    "default": 0.9,
                                    "description": "Width of the door opening",
                                },
                                "door_height": {
                                    "type": "number",
                                    "default": 2.1,
                                    "description": "Height of the door opening",
                                },
                            },
                            "required": ["edge_index", "door_offset"],
                        },
                        "description": "List of door openings to cut into the exterior walls",
                    },
                    "windows": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "edge_index": {
                                    "type": "integer",
                                    "description": "0-indexed index of the edge in the vertices loop",
                                },
                                "window_offset": {
                                    "type": "number",
                                    "description": "Distance from the start vertex of the edge",
                                },
                                "window_width": {
                                    "type": "number",
                                    "default": 1.2,
                                    "description": "Width of the window opening",
                                },
                                "window_height": {
                                    "type": "number",
                                    "default": 1.5,
                                    "description": "Height of the window opening",
                                },
                                "window_sill_height": {
                                    "type": "number",
                                    "default": 0.9,
                                    "description": "Height from floor to bottom of window",
                                },
                            },
                            "required": ["edge_index", "window_offset"],
                        },
                        "description": "List of window openings to cut into the exterior walls",
                    },
                },
                "required": ["vertices"],
            },
        ),
        types.Tool(
            name="build_wall_segment",
            description=(
                "Plain interior partition wall (no door): a surface from floor Z=0 to ceiling "
                "height. Workflow: build_room_shell first, then this for solid partitions, "
                "build_wall_with_door for partitions with openings."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "start_point": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "[x, y] or [x, y, z] start of wall base (Z forced to 0)",
                    },
                    "end_point": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "[x, y] or [x, y, z] end of wall base (Z forced to 0)",
                    },
                    "height": {
                        "type": "number",
                        "default": 2.8,
                        "description": "Wall height in metres",
                    },
                    "thickness": {
                        "type": "number",
                        "default": 0.15,
                        "description": "Wall thickness in metres (default 0.15 = 150mm standard interior partition).",
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "collection": {
                        "type": "string",
                        "description": "Collection to place object in",
                    },
                },
                "required": ["start_point", "end_point"],
            },
        ),
        types.Tool(
            name="build_wall_with_door",
            description=(
                "Interior wall with a door opening (open aperture, no booleans). Door is "
                "centred by default; pass door_offset to place it off-centre."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "start_point": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "[x, y] or [x, y, z] start of wall base (Z forced to 0)",
                    },
                    "end_point": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "[x, y] or [x, y, z] end of wall base (Z forced to 0)",
                    },
                    "height": {
                        "type": "number",
                        "default": 2.8,
                        "description": "Total wall height in metres",
                    },
                    "thickness": {
                        "type": "number",
                        "default": 0.15,
                        "description": "Wall thickness in metres (default 0.15 = 150mm standard interior partition).",
                    },
                    "door_offset": {
                        "type": "number",
                        "description": "Distance from start_point to left edge of door. Omit to centre.",
                    },
                    "door_width": {
                        "type": "number",
                        "default": 0.9,
                        "description": "Door opening width in metres",
                    },
                    "door_height": {
                        "type": "number",
                        "default": 2.1,
                        "description": "Door opening height in metres",
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "collection": {
                        "type": "string",
                        "description": "Collection to place object in",
                    },
                },
                "required": ["start_point", "end_point"],
            },
        ),
        types.Tool(
            name="set_view",
            description="Switch viewport view (TOP, ISO, FRONT, SIDE). Use TOP for drawing floor plans, ISO to inspect the 3D result.",
            inputSchema={
                "type": "object",
                "properties": {
                    "mode": {
                        "type": "string",
                        "enum": ["TOP", "ISO", "FRONT", "SIDE"],
                        "default": "TOP",
                        "description": "View mode to switch to",
                    },
                },
            },
        ),
        types.Tool(
            name="build_column",
            description=(
                "Create a structural column at a specific location. "
                "Can optionally be merged (union) with a target object (e.g. Room_Walls) "
                "to ensure seamless geometry without internal overlapping faces."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "[x, y] coordinates of the column's bottom-left corner.",
                    },
                    "width": {
                        "type": "number",
                        "default": 0.4,
                        "description": "Column width (X-dimension).",
                    },
                    "depth": {
                        "type": "number",
                        "default": 0.4,
                        "description": "Column depth (Y-dimension).",
                    },
                    "height": {
                        "type": "number",
                        "default": 2.8,
                        "description": "Column height (default 2.8m).",
                    },
                    "name": {
                        "type": "string",
                        "description": "Object name (default 'Column')",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Target collection",
                    },
                    "union_with": {
                        "type": "string",
                        "description": "Optional: Name of object to merge with (e.g. 'Room_Walls').",
                    },
                },
                "required": ["location"],
            },
        ),
    ]
