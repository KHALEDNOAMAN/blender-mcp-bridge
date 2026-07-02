import os

import addon_utils
import bmesh
import bpy

from ..utils import get_object


class PrintingTools:
    def set_scene_units(self, system="METRIC", length_unit="MILLIMETERS", scale=0.001):
        """Set scale and length units for the scene (crucial for 3D printing)."""
        scene = bpy.context.scene
        scene.unit_settings.system = system
        scene.unit_settings.length_unit = length_unit
        scene.unit_settings.scale_length = scale
        return {
            "success": True,
            "message": f"Scene units set to {system} ({length_unit}) with scale {scale}.",
        }

    def check_mesh_for_printing(self, object_name):
        """Analyze mesh topology for watertight/manifold checks."""
        obj = get_object(object_name)
        if obj.type != "MESH":
            return {
                "success": False,
                "error": f"Object '{object_name}' is not a mesh (type: {obj.type})",
            }

        # Try to use 3D Print Toolbox addon if enabled or enable it
        is_enabled, is_loaded = addon_utils.check("object_print3d_utils")
        if not is_enabled:
            try:
                addon_utils.enable("object_print3d_utils", default_saved=False)
                is_enabled = True
            except Exception as e:
                print(f"[MCP] Warning: Failed to enable object_print3d_utils addon: {e}")

        # Fallback and exact computation using BMesh
        bm = bmesh.new()
        bm.from_mesh(obj.data)

        # Calculate stats
        boundary_edges = [e for e in bm.edges if e.is_boundary]
        multi_manifold_edges = [e for e in bm.edges if not e.is_manifold and not e.is_boundary]
        degenerate_edges = [e for e in bm.edges if e.calc_length() <= 1e-6]
        degenerate_faces = [f for f in bm.faces if f.calc_area() <= 1e-6]

        # Check volume
        volume = 0.0
        try:
            volume = bm.calc_volume()
        except Exception:
            # Severely broken meshes might cause calculation error
            volume = -1.0

        bm.free()

        is_watertight = len(boundary_edges) == 0 and len(multi_manifold_edges) == 0

        report = {
            "success": True,
            "object_name": object_name,
            "is_watertight": is_watertight,
            "boundary_edges_count": len(boundary_edges),
            "multi_manifold_edges_count": len(multi_manifold_edges),
            "degenerate_edges_count": len(degenerate_edges),
            "degenerate_faces_count": len(degenerate_faces),
            "volume_cubic_meters": volume,
            "message": f"Mesh check completed for '{object_name}'.",
        }

        # If the 3D-Print Toolbox was successfully loaded, we can run print3d_check_all to populate Blender's UI
        if is_enabled:
            try:
                # Store active object & mode
                old_active = bpy.context.view_layer.objects.active
                bpy.context.view_layer.objects.active = obj

                # Check all operator
                bpy.ops.mesh.print3d_check_all()

                # Restore active object
                bpy.context.view_layer.objects.active = old_active
                report["message"] += " UI panel reports populated."
            except Exception as e:
                report["message"] += f" (Note: Failed to populate UI reports: {e})"

        return report

    def repair_mesh(self, object_name, merge_distance=0.0001, recalculate_normals=True):
        """Attempts automated repairs like remove doubles, normals recalculation, and hole filling."""
        obj = get_object(object_name)
        if obj.type != "MESH":
            return {
                "success": False,
                "error": f"Object '{object_name}' is not a mesh.",
            }

        # Store original state context
        original_active = bpy.context.view_layer.objects.active
        original_mode = obj.mode

        bpy.context.view_layer.objects.active = obj

        # Switch to Edit mode to perform repairs
        if obj.mode != "EDIT":
            bpy.ops.object.mode_set(mode="EDIT")

        # 1. Select all elements
        bpy.ops.mesh.select_all(action="SELECT")

        # 2. Merge doubles (remove overlapping vertices)
        bpy.ops.mesh.remove_doubles(threshold=merge_distance)

        # 3. Recalculate normals outside if requested
        if recalculate_normals:
            bpy.ops.mesh.normals_make_consistent(inside=False)

        # 4. Fill holes (Clean up boundary edges)
        bpy.ops.mesh.fill_holes(sides=0)  # sides=0 means fill all holes

        # Return to original mode
        if obj.mode != original_mode:
            bpy.ops.object.mode_set(mode=original_mode)
        bpy.context.view_layer.objects.active = original_active

        # Recheck status
        check_report = self.check_mesh_for_printing(object_name)

        return {
            "success": True,
            "message": f"Repair operations performed on '{object_name}'.",
            "check_after_repair": check_report,
        }

    def apply_voxel_remesh(self, object_name, voxel_size=0.1, adaptivity=0.0, clean_geometry=True):
        """Applies a voxel remesh modifier to fuse overlapping parts and make it manifold."""
        obj = get_object(object_name)

        # Store original active object
        original_active = bpy.context.view_layer.objects.active
        bpy.context.view_layer.objects.active = obj

        # Create and apply Remesh modifier
        mod_name = "MCPServer_VoxelRemesh"
        mod = obj.modifiers.new(name=mod_name, type="REMESH")
        mod.mode = "VOXEL"
        mod.voxel_size = voxel_size
        mod.adaptivity = adaptivity
        mod.use_remove_disconnected = clean_geometry

        # Apply modifier
        try:
            bpy.ops.object.modifier_apply(modifier=mod_name)
            msg = f"Voxel remesh modifier applied to '{object_name}' with voxel_size={voxel_size}."
        except Exception as e:
            # Cleanup if modifier apply failed
            obj.modifiers.remove(mod)
            return {"success": False, "error": f"Failed to apply remesh modifier: {e}"}

        # Restore active object
        bpy.context.view_layer.objects.active = original_active

        # Run topology check
        check_report = self.check_mesh_for_printing(object_name)

        return {
            "success": True,
            "message": msg,
            "check_after_remesh": check_report,
        }

    def export_model(self, object_name=None, filepath=None, format="STL", selection_only=True):
        """Export object(s) to STL or 3MF format."""
        if not filepath:
            name_to_use = object_name if object_name else "scene_export"
            ext = ".stl" if format.upper() == "STL" else ".3mf"
            filepath = f"{name_to_use}{ext}"

        # Standardize filepath (bridge server will resolve it if it's relative)
        # Ensure directory path exists
        dirpath = os.path.dirname(filepath)
        if dirpath and not os.path.exists(dirpath):
            os.makedirs(dirpath, exist_ok=True)

        # Always ensure we are in Object Mode — previous sculpt/edit ops can
        # leave Blender in a mode where select_all is unavailable.
        try:
            if bpy.context.mode != "OBJECT":
                bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass

        original_active = bpy.context.view_layer.objects.active
        selected_objects = bpy.context.selected_objects.copy()

        # Set selection context if object_name is specified
        if object_name:
            obj = get_object(object_name)
            # Clear current selection
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj

        format_upper = format.upper()

        try:
            if format_upper == "STL":
                # Check for Blender 4.x new stl export vs legacy
                if hasattr(bpy.ops.wm, "stl_export"):
                    bpy.ops.wm.stl_export(filepath=filepath, export_selected_objects=selection_only)
                else:
                    bpy.ops.export_mesh.stl(filepath=filepath, use_selection=selection_only)
            elif format_upper == "3MF":
                if hasattr(bpy.ops.wm, "three_mf_export"):
                    bpy.ops.wm.three_mf_export(
                        filepath=filepath, export_selected_objects=selection_only
                    )
                elif hasattr(bpy.ops.export_mesh, "threemf"):
                    bpy.ops.export_mesh.threemf(filepath=filepath, use_selection=selection_only)
                elif hasattr(bpy.ops.export_mesh, "three_mf"):
                    bpy.ops.export_mesh.three_mf(filepath=filepath, use_selection=selection_only)
                else:
                    raise AttributeError(
                        "3MF export operator not found. Ensure a 3MF addon is enabled in Blender."
                    )
            else:
                raise ValueError(f"Unsupported export format: {format}")
        except Exception as e:
            return {"success": False, "error": f"Failed to export: {str(e)}"}
        finally:
            # Restore selection state
            if object_name:
                bpy.ops.object.select_all(action="DESELECT")
                for o in selected_objects:
                    try:
                        o.select_set(True)
                    except Exception:
                        pass
                bpy.context.view_layer.objects.active = original_active

        return {
            "success": True,
            "filepath": filepath,
            "format": format_upper,
            "message": f"Successfully exported to '{filepath}'.",
        }
