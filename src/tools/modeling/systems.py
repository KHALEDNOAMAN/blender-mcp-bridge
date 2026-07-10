# src/tools/modeling/systems.py

from mcp import types


def get_systems_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="build_pipe_run",
            description=(
                "Create a straight pipe segment or a sequence of connected pipe segments. "
                "Pipes are typically rounded and color-coded based on their system type."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "points": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {"type": "number"},
                            "minItems": 2,
                            "maxItems": 3,
                        },
                        "description": "Sequence of [x, y] or [x, y, z] points defining the pipe path.",
                    },
                    "radius": {
                        "type": "number",
                        "default": 0.05,
                        "description": "Outer radius of the pipe in metres.",
                    },
                    "system_type": {
                        "type": "string",
                        "enum": ["WATER", "CHILLER", "FIRE", "GAS", "DRAINAGE"],
                        "description": "Standard MEP system type for automatic color-coding.",
                    },
                    "name": {
                        "type": "string",
                        "description": "Base name for the pipe objects.",
                    },
                    "add_fittings": {
                        "type": "boolean",
                        "default": False,
                        "description": "If true, adds junction spheres at corners to bridge segments.",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Target collection.",
                    },
                },
                "required": ["points", "system_type"],
            },
        ),
        types.Tool(
            name="build_cable_tray",
            description=(
                "Create a cable tray run with a standard profile (Ladder, Trough, etc.). "
                "Used for electrical containment."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "points": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {"type": "number"},
                            "minItems": 3,
                            "maxItems": 3,
                        },
                        "description": "Sequence of [x, y, z] points defining the tray path.",
                    },
                    "width": {
                        "type": "number",
                        "default": 0.3,
                        "description": "Width of the cable tray (standard trunking sizing).",
                    },
                    "depth": {
                        "type": "number",
                        "default": 0.05,
                        "description": "Depth/height of the tray side rails.",
                    },
                    "tray_type": {
                        "type": "string",
                        "enum": ["LADDER", "TROUGH", "SOLID", "CHANNEL"],
                        "default": "LADDER",
                        "description": "Profile style of the cable tray.",
                    },
                    "system_type": {
                        "type": "string",
                        "enum": ["POWER", "DATA", "FIBER", "FIRE_ALARM"],
                        "default": "POWER",
                        "description": "System type for automatic color-coding of the tray and supports.",
                    },
                    "auto_support_spacing": {
                        "type": "number",
                        "description": "Interval (metres) for automated support placement.",
                    },
                    "auto_support_type": {
                        "type": "string",
                        "enum": [
                            "TRAPEZE_HANGER",
                            "CANTILEVER_BRACKET",
                            "WALL_BRACKET",
                        ],
                        "default": "TRAPEZE_HANGER",
                        "description": "Type of support to use for automated placement.",
                    },
                    "height_to_ceiling": {
                        "type": "number",
                        "default": 0.5,
                        "description": "Rod length for hangers (relative to tray Z).",
                    },
                    "support_start_offset": {
                        "type": "number",
                        "default": 0.2,
                        "description": "Tolerance buffer (metres) from the start of the run for the first support.",
                    },
                    "name": {"type": "string", "description": "Object name."},
                    "collection": {
                        "type": "string",
                        "description": "Target collection.",
                    },
                    "side_direction": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional [x, y, z] vector to override the auto-determined direction for wall/cantilever brackets (automated placement).",
                    },
                    "supports": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "location": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                    "minItems": 3,
                                    "maxItems": 3,
                                },
                                "support_type": {
                                    "type": "string",
                                    "enum": [
                                        "TRAPEZE_HANGER",
                                        "CANTILEVER_BRACKET",
                                        "WALL_BRACKET",
                                    ],
                                },
                                "height_to_ceiling": {"type": "number"},
                                "width": {"type": "number"},
                                "system_type": {"type": "string"},
                                "side_direction": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                },
                                "rotation": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                },
                            },
                        },
                        "description": "Optional list of manual support placements.",
                    },
                },
                "required": ["points"],
            },
        ),
        types.Tool(
            name="add_tray_support",
            description=(
                "Add a support joint (overhung) that secures trunking/trays to the ceiling or walls."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "[x, y, z] mounting point on the tray.",
                    },
                    "rotation": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Euler rotation in degrees [X, Y, Z]",
                    },
                    "support_type": {
                        "type": "string",
                        "enum": [
                            "TRAPEZE_HANGER",
                            "CANTILEVER_BRACKET",
                            "WALL_BRACKET",
                        ],
                        "description": "Type of support joint.",
                    },
                    "height_to_ceiling": {
                        "type": "number",
                        "description": "Distance from tray to ceiling for hangers.",
                    },
                    "width": {
                        "type": "number",
                        "default": 0.3,
                        "description": "Width of the tray to support (for trapeze sizing).",
                    },
                    "name": {"type": "string", "description": "Object name."},
                    "collection": {
                        "type": "string",
                        "description": "Target collection.",
                    },
                    "side_direction": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional [x, y, z] vector to override the auto-determined direction for wall/cantilever brackets.",
                    },
                },
                "required": ["location", "support_type"],
            },
        ),
    ]
