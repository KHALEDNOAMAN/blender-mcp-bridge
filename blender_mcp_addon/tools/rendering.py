# blender_mcp_addon/tools/rendering.py

import os

import bpy  # type: ignore


def _resolve_output_path(path):
    """Resolve relative render paths against BLENDER_ASSETS_DIR, like export_model.

    Absolute paths and Blender-relative '//' paths pass through untouched.
    Without this, a bare filename lands in Blender's CWD (often unwritable, e.g. C:\\).
    """
    if os.path.isabs(path) or path.startswith("//"):
        return path
    assets_dir = os.environ.get("BLENDER_ASSETS_DIR")
    if assets_dir:
        return os.path.join(assets_dir, path)
    return os.path.abspath(path)


class RenderingTools:
    def configure_render_settings(
        self,
        engine=None,
        samples=None,
        resolution_x=None,
        resolution_y=None,
        output_path=None,
    ):
        """Configure render settings"""
        scene = bpy.context.scene

        if engine:
            scene.render.engine = engine
        if samples:
            if scene.render.engine == "CYCLES":
                scene.cycles.samples = samples
            elif scene.render.engine == "BLENDER_EEVEE":
                scene.eevee.taa_render_samples = samples
        if resolution_x:
            scene.render.resolution_x = resolution_x
        if resolution_y:
            scene.render.resolution_y = resolution_y
        if output_path:
            scene.render.filepath = _resolve_output_path(output_path)

        return {
            "success": True,
            "engine": scene.render.engine,
            "message": "Render settings updated",
        }

    def render_frame(self, output_path=None):
        """Render current frame"""
        if output_path:
            bpy.context.scene.render.filepath = _resolve_output_path(output_path)

        bpy.ops.render.render(write_still=True)

        return {
            "success": True,
            "output_path": bpy.context.scene.render.filepath,
            "message": "Frame rendered",
        }

    def render_animation(self, start_frame=None, end_frame=None, output_dir=None):
        """Render animation"""
        scene = bpy.context.scene

        if start_frame:
            scene.frame_start = start_frame
        if end_frame:
            scene.frame_end = end_frame
        if output_dir:
            scene.render.filepath = _resolve_output_path(output_dir)

        bpy.ops.render.render(animation=True)

        return {
            "success": True,
            "frames": f"{scene.frame_start}-{scene.frame_end}",
            "message": "Animation render started",
        }
