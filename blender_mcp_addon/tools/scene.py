# blender_mcp_addon/tools/scene.py

import math

import bpy  # type: ignore

from ..utils import get_object


class SceneTools:
    def get_scene_info(self):
        """Get information about the current Blender scene"""
        scene_info = {
            "name": bpy.context.scene.name,
            "object_count": len(bpy.context.scene.objects),
            "objects": [],
            "collections": [c.name for c in bpy.data.collections],
        }

        for obj in bpy.context.scene.objects[:1000]:
            scene_info["objects"].append(
                {
                    "name": obj.name,
                    "type": obj.type,
                    "location": list(obj.location),
                }
            )

        scene_info["success"] = True
        scene_info["message"] = (
            f"Retrieved scene info for '{bpy.context.scene.name}'. Found {scene_info['object_count']} objects across {len(scene_info['collections'])} collections."
        )
        return scene_info

    def get_object_info(self, name):
        """Get detailed information about a specific object"""
        obj = get_object(name)

        info = {
            "name": obj.name,
            "type": obj.type,
            "location": list(obj.location),
            "rotation": list(obj.rotation_euler),
            "scale": list(obj.scale),
            "dimensions": list(obj.dimensions),
        }

        if obj.type == "MESH":
            info["vertices"] = len(obj.data.vertices)
            info["faces"] = len(obj.data.polygons)

        info["modifiers"] = []
        for mod in obj.modifiers:
            mod_info = {
                "name": mod.name,
                "type": mod.type,
                "show_viewport": mod.show_viewport,
                "show_render": mod.show_render,
            }
            # Add type-specific info if needed
            if mod.type == "MIRROR":
                mod_info["use_axis"] = list(mod.use_axis)
            elif mod.type == "ARRAY":
                mod_info["count"] = mod.count
            info["modifiers"].append(mod_info)

        info["success"] = True
        info["message"] = f"Retrieved detailed info for object '{name}' (Type: {obj.type})."
        return info

    def get_distance(self, object_a, object_b, mode="CENTER"):
        """Measure distance between two objects"""
        obj_a = get_object(object_a)
        obj_b = get_object(object_b)

        loc_a = obj_a.location
        loc_b = obj_b.location

        if mode == "VERTICAL":
            dist = abs(loc_a.z - loc_b.z)
        elif mode == "HORIZONTAL":
            dist = math.sqrt((loc_a.x - loc_b.x) ** 2 + (loc_a.y - loc_b.y) ** 2)
        else:  # CENTER (Euclidean)
            dist = (loc_a - loc_b).length

        return {
            "success": True,
            "distance": dist,
            "message": f"Distance ({mode}): {dist:.4f}",
        }

    def get_viewport_screenshot(self, max_size=800, filepath=None):
        """Capture the 3D viewport to a PNG. Works from the socket-server timer by
        overriding the context onto an open VIEW_3D area; falls back to an OpenGL
        viewport render, then a Workbench camera render when no window exists."""
        import os
        import tempfile

        if not filepath:
            assets_dir = os.environ.get("BLENDER_ASSETS_DIR")
            base = os.path.join(assets_dir, "screenshots") if assets_dir else tempfile.gettempdir()
            os.makedirs(base, exist_ok=True)
            filepath = os.path.join(base, "viewport.png")
        elif not os.path.isabs(filepath):
            assets_dir = os.environ.get("BLENDER_ASSETS_DIR")
            if assets_dir:
                filepath = os.path.join(assets_dir, filepath)

        # Find an open 3D viewport to capture
        win = area = region = None
        for w in bpy.context.window_manager.windows:
            for a in w.screen.areas:
                if a.type == "VIEW_3D":
                    win, area = w, a
                    region = next((r for r in a.regions if r.type == "WINDOW"), None)
                    break
            if area:
                break

        method = None
        if area and region:
            try:
                with bpy.context.temp_override(window=win, area=area, region=region):
                    bpy.ops.screen.screenshot_area(filepath=filepath)
                method = "viewport"
            except Exception:
                method = None
            if method is None:
                # Some builds refuse screenshot_area from a timer — OpenGL render
                # of the same viewport is the next best thing.
                try:
                    with bpy.context.temp_override(window=win, area=area, region=region):
                        prev_path = bpy.context.scene.render.filepath
                        bpy.context.scene.render.filepath = filepath
                        bpy.ops.render.opengl(write_still=True, view_context=True)
                        bpy.context.scene.render.filepath = prev_path
                    method = "opengl"
                except Exception:
                    method = None

        if method is None:
            # Headless fallback: quick Workbench render through the scene camera.
            scene = bpy.context.scene
            if scene.camera is None:
                return {
                    "success": False,
                    "error": "No 3D viewport window and no scene camera — create a camera "
                    "(create_camera + camera_look_at) and retry, or use render_frame.",
                }
            prev_engine = scene.render.engine
            prev_path = scene.render.filepath
            try:
                scene.render.engine = "BLENDER_WORKBENCH"
                scene.render.filepath = filepath
                bpy.ops.render.render(write_still=True)
                method = "workbench_render"
            finally:
                scene.render.engine = prev_engine
                scene.render.filepath = prev_path

        # Downscale in place so payloads stay small
        try:
            img = bpy.data.images.load(filepath)
            w, h = img.size
            if max(w, h) > max_size:
                scale = max_size / max(w, h)
                img.scale(int(w * scale), int(h * scale))
                img.save_render(filepath)
            bpy.data.images.remove(img)
        except Exception:
            pass  # keep the full-size capture if resizing fails

        return {
            "success": True,
            "filepath": filepath.replace("\\", "/"),
            "method": method,
            "message": f"Screenshot ({method}) saved to {filepath}",
        }
