# blender_mcp_bridge/tools/lighting.py

from mcp import types


def get_lighting_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="create_light",
            description="Create light (POINT, SUN, SPOT, AREA)",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "type": {
                        "type": "string",
                        "description": "POINT, SUN, SPOT, or AREA",
                    },
                    "location": {"type": "array", "items": {"type": "number"}},
                    "energy": {"type": "number"},
                    "color": {
                        "type": "string",
                        "description": "Hex color string (e.g., '#FF9900')",
                    },
                    "angle": {
                        "type": "number",
                        "description": "For SUN: angular diameter in degrees",
                    },
                    "size": {
                        "type": "number",
                        "description": "For AREA: size of the light",
                    },
                },
                "required": ["name", "type", "location"],
            },
        ),
        types.Tool(
            name="configure_light",
            description="Modify an existing light's properties (energy, color, rotation, angle, size).",
            inputSchema={
                "type": "object",
                "properties": {
                    "light_name": {"type": "string"},
                    "energy": {"type": "number"},
                    "color": {
                        "type": "string",
                        "description": "Hex color string (e.g., '#FF9900')",
                    },
                    "rotation": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Euler rotation in degrees [x, y, z]",
                    },
                    "angle": {
                        "type": "number",
                        "description": "For SUN: angular diameter in degrees",
                    },
                    "size": {
                        "type": "number",
                        "description": "For AREA: size of the light",
                    },
                },
                "required": ["light_name"],
            },
        ),
        types.Tool(
            name="set_world_background",
            description="Set the world background to a solid color, a procedural sky, or an HDRI environment image.",
            inputSchema={
                "type": "object",
                "properties": {
                    "mode": {
                        "type": "string",
                        "description": "'color', 'sky' (Nishita), or 'hdri' (Image)",
                        "enum": ["color", "sky", "hdri"],
                    },
                    "color": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "RGB color for 'color' mode (default dark grey)",
                    },
                    "strength": {
                        "type": "number",
                        "description": "Emission strength (default 1.0)",
                    },
                    "image_path": {
                        "type": "string",
                        "description": "Path to HDRI image. Can be absolute, or relative if BLENDER_ASSETS_DIR is set in .env.",
                    },
                    "rotation_z": {
                        "type": "number",
                        "description": "Z-axis rotation in degrees for HDRI",
                    },
                },
                "required": ["mode"],
            },
        ),
    ]
