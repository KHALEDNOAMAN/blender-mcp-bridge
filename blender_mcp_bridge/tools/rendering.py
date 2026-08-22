# blender_mcp_bridge/tools/rendering.py

from mcp import types


def get_rendering_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="configure_render_settings",
            description="Configure render settings.",
            inputSchema={
                "type": "object",
                "properties": {
                    "engine": {
                        "type": "string",
                        "enum": ["CYCLES", "BLENDER_EEVEE_NEXT"],
                    },
                    "samples": {"type": "integer"},
                    "resolution_x": {"type": "integer"},
                    "resolution_y": {"type": "integer"},
                },
            },
        ),
        types.Tool(
            name="render_frame",
            description="Render the current frame.",
            inputSchema={
                "type": "object",
                "properties": {
                    "output_path": {"type": "string"},
                },
            },
        ),
        types.Tool(
            name="render_animation",
            description="Render an animation sequence.",
            inputSchema={
                "type": "object",
                "properties": {
                    "start_frame": {"type": "integer"},
                    "end_frame": {"type": "integer"},
                    "output_dir": {"type": "string"},
                },
            },
        ),
        types.Tool(
            name="generate_views",
            description=(
                "Render orthographic top/front/side/iso previews of the scene in one call. "
                "Temporary cameras and lights are framed automatically from the scene's bounding box "
                "and removed afterwards, so no camera/light/render commands are needed in the session."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "views": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": [
                                "top",
                                "bottom",
                                "front",
                                "back",
                                "side",
                                "left",
                                "right",
                                "iso",
                            ],
                        },
                        "description": "Which views to render.",
                        "default": ["top", "front", "side", "iso"],
                    },
                    "prefix": {
                        "type": "string",
                        "description": "Filename prefix; each image is saved as '<prefix>_<view>.png'.",
                        "default": "view",
                    },
                    "output_dir": {
                        "type": "string",
                        "description": "Directory for the images, relative to BLENDER_ASSETS_DIR. Studio serves this folder at /views.",
                        "default": "views",
                    },
                    "samples": {
                        "type": "integer",
                        "description": "Render samples. Higher is cleaner but slower.",
                        "default": 32,
                    },
                    "resolution": {
                        "type": "integer",
                        "description": "Output image size in pixels (square).",
                        "default": 800,
                    },
                    "margin": {
                        "type": "number",
                        "description": "Padding around the model; 1.0 exactly fills the frame.",
                        "default": 1.35,
                    },
                    "engine": {
                        "type": "string",
                        "enum": [
                            "BLENDER_EEVEE_NEXT",
                            "BLENDER_EEVEE",
                            "CYCLES",
                            "BLENDER_WORKBENCH",
                        ],
                        "description": "Render engine. Defaults to whatever the scene already uses.",
                    },
                    "objects": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional: only frame these objects. Defaults to all visible meshes.",
                    },
                },
            },
        ),
    ]
