# blender_mcp_addon/tools/modeling/__init__.py

from .architectural import ModelingArchitectural
from .modifiers import ModelingModifiers
from .operators import ModelingOperators
from .primitives import ModelingPrimitives
from .selection import ModelingSelection
from .systems import ModelingSystems
from .transforms import ModelingTransforms


class ModelingTools(
    ModelingPrimitives,
    ModelingModifiers,
    ModelingTransforms,
    ModelingSelection,
    ModelingOperators,
    ModelingArchitectural,
    ModelingSystems,
):
    """Refactored Modeling Tools for Blender MCP"""

    pass
