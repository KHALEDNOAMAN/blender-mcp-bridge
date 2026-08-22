# blender_mcp_addon/tools/rendering.py

import os

import bpy  # type: ignore
from mathutils import Vector  # type: ignore


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

    def generate_views(
        self,
        views=None,
        prefix="view",
        output_dir="views",
        samples=32,
        resolution=800,
        margin=1.35,
        engine=None,
        objects=None,
    ):
        """Render orthographic TOP/FRONT/SIDE (+ISO) previews of the scene.

        Replaces the ~29 hand-written commands a "views branch" used to need
        (4 lights, then per view: create_camera + camera_look_at +
        set_active_camera + configure_render_settings + render_frame +
        delete_object). All framing is derived from the scene's own bounding
        box here, so nothing has to be re-derived as trigonometric
        "${bin_width}/2"-style expressions per project.

        Cameras are ORTHO, which is what makes these read as real engineering
        views: a perspective camera skews parallel edges, so a "top view"
        of a box shows its side walls. Ortho scale is the fitted extent, so
        the part fills the frame the same way at any model size.

        Every object created here is named with a "_MCPVIEW_" prefix and
        deleted in a finally block, so an exception mid-render can't leave
        stray cameras/lights in the user's scene (they would then show up in
        exports and in later renders).
        """
        import math

        scene = bpy.context.scene
        view_names = views or ["top", "front", "side", "iso"]

        # --- Bounding box over the meshes actually being previewed ----------
        targets = []
        for obj in scene.objects:
            if obj.type != "MESH" or not obj.visible_get():
                continue
            if objects and obj.name not in objects:
                continue
            if obj.name.startswith("_MCPVIEW_"):
                continue
            targets.append(obj)

        if not targets:
            return {
                "success": False,
                "error": "No visible mesh objects to render. Build the model first.",
            }

        xs, ys, zs = [], [], []
        for obj in targets:
            for corner in obj.bound_box:
                wc = obj.matrix_world @ Vector(corner)
                xs.append(wc.x)
                ys.append(wc.y)
                zs.append(wc.z)
        lo = Vector((min(xs), min(ys), min(zs)))
        hi = Vector((max(xs), max(ys), max(zs)))
        center = (lo + hi) / 2.0
        size = hi - lo
        # Guard a flat/degenerate axis (a plane has zero thickness) so the
        # ortho scale below can never be 0 and render an empty frame.
        extent = max(size.x, size.y, size.z, 1e-4)
        dist = extent * 3.0  # ortho: distance only needs to clear the geometry

        created = []
        prev_engine = scene.render.engine
        prev_filepath = scene.render.filepath
        prev_camera = scene.camera
        prev_res_x = scene.render.resolution_x
        prev_res_y = scene.render.resolution_y
        prev_pct = scene.render.resolution_percentage

        written = []
        try:
            # --- Key/fill/rim/bottom suns, so ISO isn't half-black ---------
            for i, (dx, dy, dz, energy) in enumerate(
                [(1, 1, 1, 3.0), (-1, 1, 0.6, 1.5), (1, -1, 0.6, 1.5), (0, 0, -1, 0.7)]
            ):
                light_data = bpy.data.lights.new(f"_MCPVIEW_L{i}", type="SUN")
                light_data.energy = energy
                light = bpy.data.objects.new(f"_MCPVIEW_L{i}", light_data)
                scene.collection.objects.link(light)
                light.location = center + Vector((dx, dy, dz)) * dist
                light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()
                created.append(light)

            cam_data = bpy.data.cameras.new("_MCPVIEW_Cam")
            cam_data.type = "ORTHO"
            cam = bpy.data.objects.new("_MCPVIEW_Cam", cam_data)
            scene.collection.objects.link(cam)
            created.append(cam)
            scene.camera = cam

            if engine:
                scene.render.engine = engine
            scene.render.resolution_x = resolution
            scene.render.resolution_y = resolution
            scene.render.resolution_percentage = 100
            try:
                if scene.render.engine == "CYCLES":
                    scene.cycles.samples = samples
                elif "EEVEE" in scene.render.engine:
                    scene.eevee.taa_render_samples = samples
            except Exception:
                pass  # sample count is cosmetic; never fail the render over it

            # Direction each view looks FROM, and the two axes that span the
            # frame for it (used to fit ortho scale to that view specifically,
            # so a tall thin part isn't shrunk by its longest axis).
            specs = {
                "top": ((0, 0, 1), (size.x, size.y)),
                "bottom": ((0, 0, -1), (size.x, size.y)),
                "front": ((0, -1, 0), (size.x, size.z)),
                "back": ((0, 1, 0), (size.x, size.z)),
                "side": ((1, 0, 0), (size.y, size.z)),
                "left": ((-1, 0, 0), (size.y, size.z)),
                "right": ((1, 0, 0), (size.y, size.z)),
                "iso": ((1, -1, 1), (extent, extent)),
            }

            for name in view_names:
                key = str(name).strip().lower()
                spec = specs.get(key)
                if not spec:
                    continue
                direction, (span_a, span_b) = spec
                offset = Vector(direction)
                offset.normalize()
                cam.location = center + offset * dist
                cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
                # ISO sees the box corner-on, so its silhouette is wider than
                # any single axis — scale by the diagonal instead.
                if key == "iso":
                    fit = math.sqrt(size.x**2 + size.y**2 + size.z**2)
                else:
                    fit = max(span_a, span_b, 1e-4)
                cam_data.ortho_scale = fit * margin

                out = os.path.join(output_dir, f"{prefix}_{key}.png")
                scene.render.filepath = _resolve_output_path(out)
                bpy.ops.render.render(write_still=True)
                written.append({"view": key, "path": scene.render.filepath.replace("\\", "/")})
        finally:
            for obj in created:
                try:
                    data = obj.data
                    bpy.data.objects.remove(obj, do_unlink=True)
                    if isinstance(data, bpy.types.Camera):
                        bpy.data.cameras.remove(data)
                    elif isinstance(data, bpy.types.Light):
                        bpy.data.lights.remove(data)
                except Exception:
                    pass
            scene.camera = prev_camera
            scene.render.engine = prev_engine
            scene.render.filepath = prev_filepath
            scene.render.resolution_x = prev_res_x
            scene.render.resolution_y = prev_res_y
            scene.render.resolution_percentage = prev_pct

        if not written:
            return {
                "success": False,
                "error": f"No valid views in {view_names}. Choose from {sorted(specs)}.",
            }

        return {
            "success": True,
            "views": written,
            "count": len(written),
            "bounds": {
                "min": [round(v, 4) for v in lo],
                "max": [round(v, 4) for v in hi],
                "size": [round(v, 4) for v in size],
            },
            "message": f"Rendered {len(written)} view(s) to {output_dir}/",
        }
