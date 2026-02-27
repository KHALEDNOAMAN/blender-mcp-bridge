import bpy
from ..utils import get_collection, get_object


class CollectionTools:
    def create_collection(self, name, parent_collection=None, **kwargs):
        """Create new collection (idempotent)"""
        existing = bpy.data.collections.get(name)
        if existing:
            return {
                "success": True,
                "name": name,
                "message": f"Collection '{name}' already exists.",
            }

        new_collection = bpy.data.collections.new(name)

        if parent_collection:
            parent = get_collection(parent_collection)
            parent.children.link(new_collection)
        else:
            bpy.context.scene.collection.children.link(new_collection)

        return {
            "success": True,
            "name": name,
            "message": f"Collection '{name}' created successfully.",
        }

    def set_active_collection(self, collection_name):
        """Set active collection for new objects"""
        get_collection(collection_name)

        layer_collection = bpy.context.view_layer.layer_collection
        for lc in self._find_layer_collection(layer_collection, collection_name):
            bpy.context.view_layer.active_layer_collection = lc
            return {
                "success": True,
                "active_collection": collection_name,
                "message": f"Collection '{collection_name}' is now set as the active collection for new objects.",
            }

        raise ValueError(f"Could not set active collection '{collection_name}'")

    def _find_layer_collection(self, layer_collection, name):
        """Recursively find layer collection by name"""
        if layer_collection.collection.name == name:
            yield layer_collection
        for child in layer_collection.children:
            yield from self._find_layer_collection(child, name)

    def move_to_collection(
        self,
        object_names=None,
        pattern=None,
        collection_names=None,
        target_collection=None,
        keep_hierarchy=False,
        remove_original_collections=False,
        **kwargs,
    ):
        """Move objects or collections to target collection"""
        import fnmatch

        if not target_collection:
            return {
                "success": False,
                "message": "Missing required parameter 'target_collection'.",
            }

        target_coll = get_collection(target_collection)
        targets = set()
        collections_moved = 0
        objects_moved = 0

        # Handle moving entire collections (hierarchy) nested inside target_collection
        if keep_hierarchy and collection_names:
            if isinstance(collection_names, str):
                collection_names = [collection_names]
            for source_name in collection_names:
                source_coll = bpy.data.collections.get(source_name)
                if not source_coll or source_coll == target_coll:
                    continue

                # Unlink from all current parents
                for parent in bpy.data.collections:
                    if source_coll.name in parent.children:
                        parent.children.unlink(source_coll)
                if source_coll.name in bpy.context.scene.collection.children:
                    bpy.context.scene.collection.children.unlink(source_coll)

                # Link to target collection
                if source_coll.name not in target_coll.children:
                    target_coll.children.link(source_coll)
                    collections_moved += 1

        else:
            # Flatten objects
            if object_names:
                if isinstance(object_names, str):
                    object_names = [object_names]
                targets.update(object_names)

            if pattern:
                matches = fnmatch.filter(bpy.data.objects.keys(), pattern)
                targets.update(matches)

            if collection_names:
                if isinstance(collection_names, str):
                    collection_names = [collection_names]
                for source_name in collection_names:
                    source_coll = bpy.data.collections.get(source_name)
                    if source_coll:
                        targets.update([obj.name for obj in source_coll.objects])

            for obj_name in targets:
                obj = get_object(obj_name)
                for coll in obj.users_collection:
                    coll.objects.unlink(obj)
                target_coll.objects.link(obj)
                objects_moved += 1

            # Optionally remove empty source collections after flattening
            if remove_original_collections and collection_names:
                for source_name in collection_names:
                    source_coll = bpy.data.collections.get(source_name)
                    if source_coll:
                        # Ensure we don't accidentally remove target_coll
                        if source_coll != target_coll:
                            # Actually delete the collection
                            for parent in bpy.data.collections:
                                if source_coll.name in parent.children:
                                    parent.children.unlink(source_coll)
                            if (
                                source_coll.name
                                in bpy.context.scene.collection.children
                            ):
                                bpy.context.scene.collection.children.unlink(
                                    source_coll
                                )
                            bpy.data.collections.remove(source_coll)

        if objects_moved == 0 and collections_moved == 0:
            return {
                "success": False,
                "message": "No objects or collections found to move.",
            }

        msg = "Successfully moved "
        if objects_moved > 0:
            msg += f"{objects_moved} object(s) "
        if collections_moved > 0:
            if objects_moved > 0:
                msg += "and "
            msg += f"{collections_moved} collection(s) "
        msg += f"to '{target_collection}'."

        return {
            "success": True,
            "moved_objects": objects_moved,
            "moved_collections": collections_moved,
            "message": msg,
        }

    def get_collections(self):
        """List all collections"""

        def build_hierarchy(collection, level=0):
            return {
                "name": collection.name,
                "level": level,
                "objects": [obj.name for obj in collection.objects],
                "children": [
                    build_hierarchy(child, level + 1) for child in collection.children
                ],
            }

        return build_hierarchy(bpy.context.scene.collection)

    def remove_collection(self, name=None, pattern=None, delete_objects=True, **kwargs):
        """Remove collection(s) by name or pattern"""
        import fnmatch

        collections_to_remove = []
        if pattern:
            for coll in bpy.data.collections:
                if fnmatch.fnmatch(coll.name, pattern):
                    collections_to_remove.append(coll)
        elif name:
            coll = bpy.data.collections.get(name)
            if coll:
                collections_to_remove.append(coll)

        if not collections_to_remove:
            return {
                "success": True,
                "message": f"No collections found matching {f'pattern {pattern}' if pattern else f'name {name}'}",
            }

        count = 0
        for coll in collections_to_remove:
            if delete_objects:
                # Delete all objects in this collection
                for obj in list(coll.objects):
                    bpy.data.objects.remove(obj, do_unlink=True)

            # To remove a collection, we must unlink it from all its parents
            for parent in bpy.data.collections:
                if coll.name in parent.children:
                    parent.children.unlink(coll)
            if coll.name in bpy.context.scene.collection.children:
                bpy.context.scene.collection.children.unlink(coll)

            # Finally remove the collection from data
            bpy.data.collections.remove(coll)
            count += 1

        return {
            "success": True,
            "removed": count,
            "message": f"Removed {count} collection(s).",
        }

    def duplicate_collection(
        self,
        collection_name,
        new_name=None,
        target_parent=None,
        copy_contents_only=False,
        location_offset=None,
        rotation_offset=None,
        **kwargs,
    ):
        """Duplicate an entire collection hierarchy"""
        import math

        source_coll = bpy.data.collections.get(collection_name)
        if not source_coll:
            return {
                "success": False,
                "message": f"Collection '{collection_name}' not found.",
            }

        objects_copied = 0
        collections_copied = 0

        def clone_recursive(src, dst):
            nonlocal objects_copied, collections_copied

            # 1. Copy Objects
            for obj in src.objects:
                new_obj = obj.copy()
                if hasattr(obj.data, "copy"):
                    new_obj.data = obj.data.copy()

                # Apply offsets
                if location_offset:
                    new_obj.location[0] += location_offset[0]
                    new_obj.location[1] += location_offset[1]
                    new_obj.location[2] += location_offset[2]

                if rotation_offset:
                    for i in range(3):
                        new_obj.rotation_euler[i] += math.radians(rotation_offset[i])

                dst.objects.link(new_obj)
                objects_copied += 1

            # 2. Copy Child Collections
            for child_src in src.children:
                # Use original name, Blender auto-appends .001 if needed
                new_child_coll = bpy.data.collections.new(child_src.name)
                dst.children.link(new_child_coll)
                collections_copied += 1
                clone_recursive(child_src, new_child_coll)

        if copy_contents_only:
            if not target_parent:
                return {
                    "success": False,
                    "message": "Parameter 'target_parent' is required when 'copy_contents_only' is true.",
                }
            target_dst = get_collection(target_parent)
            clone_recursive(source_coll, target_dst)
            msg = f"Contents of '{collection_name}' duplicated into '{target_parent}'."
        else:
            # Create a new root collection
            final_name = new_name or f"{source_coll.name}_Copy"
            new_root_coll = bpy.data.collections.new(final_name)

            # Link to target parent or scene root
            if target_parent:
                parent = get_collection(target_parent)
                parent.children.link(new_root_coll)
            else:
                bpy.context.scene.collection.children.link(new_root_coll)

            collections_copied += 1
            clone_recursive(source_coll, new_root_coll)
            msg = f"Hierarchy duplicated as '{new_root_coll.name}'."

        return {
            "success": True,
            "objects_copied": objects_copied,
            "collections_copied": collections_copied,
            "message": f"{msg} Copied {objects_copied} objects and {collections_copied} collections.",
        }

    def set_collection_visibility(
        self, name, hide_viewport=None, hide_render=None, **kwargs
    ):
        """Toggle collection visibility"""
        coll = bpy.data.collections.get(name)
        if not coll:
            return {"success": False, "message": f"Collection '{name}' not found."}

        # Hide in Viewport (View Layer level)
        if hide_viewport is not None:
            # We need to find the layer collection to hide in viewport
            def set_hide(layer_coll):
                if layer_coll.collection == coll:
                    layer_coll.hide_viewport = hide_viewport
                    return True
                for child in layer_coll.children:
                    if set_hide(child):
                        return True
                return False

            set_hide(bpy.context.view_layer.layer_collection)

        # Hide in Render (Data level)
        if hide_render is not None:
            coll.hide_render = hide_render

        return {
            "success": True,
            "message": f"Updated visibility for collection '{name}'.",
        }
