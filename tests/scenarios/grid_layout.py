# tests/scenarios/grid_layout.py

from tests.scenarios.modules.row_collections import create_collections_row
from tests.scenarios.modules.row_modifiers import create_modifiers_row
from tests.scenarios.modules.row_operators import create_operators_row
from tests.scenarios.modules.row_primitives import create_primitives_row
from tests.scenarios.modules.row_systems import create_systems_row
from tests.scenarios.modules.row_transforms import create_transforms_row
from tests.utils.mcp_client import MCPClient


class GridLayoutScenario:
    def __init__(self, client: MCPClient):
        self.client = client

    def run(self, module: str | None = None):
        print(f"Starting Grid Layout Scenario (Modular) - Module: {module or 'ALL'}...")

        if not module or module == "primitives":
            # Row 1: Primitives (Y=0)
            collection_name = "PRIM_BASIC"
            self.client.call_tool("create_collection", {"name": collection_name})

            self.client.call_tool(
                "create_text",
                {
                    "text": "Primitives",
                    "location": [-5.0, 0.0, 0.0],
                    "name": "PRIM_Label",
                    "size": 1.0,
                    "align_x": "RIGHT",
                    "collection": collection_name,
                },
            )
            create_primitives_row(self.client, y_offset=0.0)

        if not module or module == "modifiers":
            # Row 2: Modifiers & Operations (Y=10)
            collection_name = "MOD_APPLY"
            self.client.call_tool("create_collection", {"name": collection_name})

            self.client.call_tool(
                "create_text",
                {
                    "text": "Modifiers",
                    "location": [-5.0, 10.0, 0.0],
                    "name": "MOD_Label",
                    "size": 1.0,
                    "align_x": "RIGHT",
                    "collection": collection_name,
                },
            )
            create_modifiers_row(self.client, y_offset=10.0)

        if not module or module == "collections":
            # Row 3: Collections (Y=20)
            collection_name = "COL_INTEGRATION"
            self.client.call_tool("create_collection", {"name": collection_name})

            self.client.call_tool(
                "create_text",
                {
                    "text": "Collections",
                    "location": [-5.0, 20.0, 0.0],
                    "name": "COL_Label",
                    "size": 1.0,
                    "align_x": "RIGHT",
                    "collection": collection_name,
                },
            )
            create_collections_row(self.client, y_offset=20.0)

        if not module or module == "operators":
            # Row 4: Operators (Y=30)
            collection_name = "OP_BASIC"
            self.client.call_tool("create_collection", {"name": collection_name})

            self.client.call_tool(
                "create_text",
                {
                    "text": "Operators",
                    "location": [-5.0, 30.0, 0.0],
                    "name": "OP_Label",
                    "size": 1.0,
                    "align_x": "RIGHT",
                    "collection": collection_name,
                },
            )
            create_operators_row(self.client, y_offset=30.0)

        if not module or module == "transforms":
            # Row 5: Transforms (Y=40)
            collection_name = "TRSF_BASIC"
            self.client.call_tool("create_collection", {"name": collection_name})

            self.client.call_tool(
                "create_text",
                {
                    "text": "Transforms",
                    "location": [-5.0, 40.0, 0.0],
                    "name": "TRSF_Label",
                    "size": 1.0,
                    "align_x": "RIGHT",
                    "collection": collection_name,
                },
            )
            create_transforms_row(self.client, y_offset=40.0)

        if not module or module == "systems":
            # Row 6: Systems (Y=50)
            collection_name = "SYS_MEP"
            self.client.call_tool("create_collection", {"name": collection_name})

            self.client.call_tool(
                "create_text",
                {
                    "text": "Systems",
                    "location": [-5.0, 50.0, 0.0],
                    "name": "SYS_Label",
                    "size": 1.0,
                    "align_x": "RIGHT",
                    "collection": collection_name,
                },
            )
            create_systems_row(self.client, y_offset=50.0)

        print("Grid Layout Scenario Completed.")
