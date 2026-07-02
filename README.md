# Blender MCP Server for n8n

A Model Context Protocol (MCP) server that exposes Blender's 3D modeling capabilities to n8n workflows.

## System Architecture

To avoid confusion, this project consists of two core components:

1.  **Blender MCP Addon**: A plugin installed *inside* Blender. It acts as the local execution engine, receiving commands and manipulating the 3D scene.
2.  **MCP Bridge Server**: A standalone Python server (`src/`) that acts as the gateway. Clients like **n8n** connect to this Bridge, which then forwards commands to the active Blender Addon.

```mermaid
graph LR
    n8n[n8n / AI Agent] -- "MCP (HTTP Streamable)" --> Bridge[MCP Bridge Server]
    Bridge -- "Local WebSockets" --> Addon[Blender MCP Addon]
    Addon -- "Python API" --> Blender[Blender Engine]
```

## Quick Start

### 1. Install Dependencies

We recommend using [`uv`](https://docs.astral.sh/uv/) for fast virtual environment management and package installation:

```bash
# 1. Sync dependencies (automatically creates .venv if missing)
uv sync

# 2. Activate it
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
```

## Configuration

Create a `.env` file in the root directory to customize your setup:

| Variable | Description | Default |
|---|---|---|
| `MCP_BRIDGE_HOST` | Host IP for the MCP Bridge Server | `0.0.0.0` |
| `MCP_BRIDGE_PORT` | Port for the MCP Bridge Server (n8n connects here) | `8008` |
| `BLENDER_ADDON_HOST` | IP where Blender is running (for Bridge to connect to) | `127.0.0.1` |
| `BLENDER_ADDON_PORT` | Port Blender addon is listening on | `8888` |
| `BLENDER_ASSETS_DIR` | Directory to resolve relative textures/HDRIs | (Optional) |

## Installation

### Method 1: Zip & Install (Recommended)
1. Zip the `blender_mcp_addon` folder (into `blender_mcp_addon.zip`).
2. Open Blender.
3. **For Blender 4.2+**: Go to **Edit** > **Preferences** > **Get Extensions** > Click the dropdown arrow in the top right > **Install from Disk...** and select the `.zip`.
   **For Blender 4.0 / 4.1**: Go to **Edit** > **Preferences** > **Add-ons** > **Install...** and select the `.zip`.
4. Search for "Blender MCP" and enable the checkbox.

### Method 2: Manual Copy (Developer)
1. Copy the `blender_mcp_addon` folder to your Blender addons directory:
   - **Windows**: `%USERPROFILE%\AppData\Roaming\Blender Foundation\Blender\4.x\scripts\addons`
   - **macOS**: `~/Library/Application Support/Blender/4.x/scripts/addons`
2. Restart Blender.
3. Enable "Blender MCP" in Preferences.

## Why a folder instead of a single file?
As the addon grows, a single 1800+ line file becomes unmaintainable. We've split the logic into functional modules (`modeling`, `materials`, `anim`, etc.) to make it professional, readable, and easier to extend.

## Usage

### 1. Start Blender MCP Addon

1. Open the **N Panel** (press `N` in the 3D Viewport).
2. Look for the **Blender MCP** tab.
3. Click **Start MCP Server**.

### 2. Start the MCP Bridge Server

```bash
# Standard mode
uv run python -m src.main serve

# Recording mode (Save all commands to a file)
uv run python -m src.main serve --record my_session.json --name "Building My House"
```

The server will start on `http://localhost:8008` with HTTP Streamable endpoint at `/mcp`. It uses detailed logging to show exactly which tools are being called and their results.

## Bridge Sessions (Record & Playback)

The **Bridge Sessions** feature allows you to record yours or an AI's tool calls and replay them later. This is useful for macros, versioning your creations, or setting up complex scenes consistently.

### Recording a Session
To record all tool calls made to the bridge while the server is running:
```bash
uv run python -m src.main serve --record path/to/session.json --name "My Project" --description "Optional description"
```
Any tool calls made by n8n or other clients will be automatically saved to the JSON file.

### Replaying a Session

To playback a previously recorded session:
```bash
# Default (Stateful - HTTP Streamable) - Recommended for speed
uv run python -m src.main play path/to/session.json

# Stateless mode (Standard HTTP) - Slower due to handshake overhead
uv run python -m src.main play path/to/session.json --transport stateless
```

> [!TIP]
> **Performance Note**: Stateful mode is significantly faster for playback because it maintains a persistent connection. Stateless mode requires a full MCP handshake (Initialize/Discover) for *every* individual tool call in the recording, leading to noticeable overhead.

### Session Format
Sessions are stored as JSON files containing metadata (name, description, timestamp) and a list of command objects (tool name, arguments, timestamp).

### Session Editor (Visual Inspector)
We provide a built-in static web editor to inspect and edit your recordings:
1. Open `session_editor/index.html` in your web browser.
2. Click **Load Session** and select your `session.json`.
3. You can:
   - Edit metadata (Session Name, Description).
   - Filter commands by tool name.
   - **Add & Edit Commands**: Use the interactive modal with schema validation to discover tools, safely modify arguments, or add entirely new steps.
   - Edit tool arguments directly in the JSON editor cards.
   - Reorder or delete unnecessary commands.
   - **Export JSON** to save your changes to a new file.

### 3. Configure n8n Workflow

![n8n Design](docs/images/blender-mcp-for-n8n.png)

1. Add **MCP Client Tool** node
2. Configure:
   - **HTTP Streamable Endpoint**: `http://localhost:8008/mcp`
   - **Authentication**: None
   - **Tools to Include**: All
3. Connect to an **AI Agent** node

### 4. Development: Updating & Applying Changes

If you modify the addon code or the MCP server logic, follow these steps to ensure changes are applied:

1. **Reload Scripts**: In Blender, press `F3` and type **"Reload Scripts"** (or use the shortcut `Alt + R` if configured).
2. **Restart Blender Server**: In the N-Panel, click **Stop MCP Server** and then **Start MCP Server** again.
3. **Restart Python Server**: Stop and restart the server with `uv run python -m src.main serve`.

> [!IMPORTANT]
> All Blender operations now run on the main thread via a command queue, ensuring stability and preventing dependency graph errors.

## Available Tools

The server exposes **70+ Blender tools** across several categories:

### Inspection
| Tool | Explanation |
|---|---|
| `get_scene_info` | Get information about the current Blender scene (objects, collections, etc.). |
| `get_object_info` | Get detailed information about a specific object. |
| `get_viewport_screenshot` | Capture a screenshot of the 3D viewport. |
| `get_distance` | Measure the distance between two objects. |
| `get_debug_info` | Get diagnostic information about the MCP server. |

### Collections
| Tool | Explanation |
|---|---|
| `create_collection` | Create a new collection in the scene. |
| `set_active_collection` | Set the active collection for new objects. |
| `move_to_collection` | Move objects to a specific collection. |
| `get_collections` | Get the hierarchy of all collections in the scene. |
| `remove_collection` | Delete a collection and optionally its contents. |
| `duplicate_collection` | Duplicate an entire collection hierarchy. |
| `set_collection_visibility`| Toggle visibility of a collection in viewport/render. |

### Modeling
| Tool | Explanation |
|---|---|
| `create_cube` | Create/update a cube mesh. |
| `create_cylinder` | Create/update a cylinder mesh. |
| `create_icosphere` | Create/update an Ico sphere mesh. |
| `create_sphere` | Create/update a UV sphere mesh. |
| `create_torus` | Create/update a torus mesh. |
| `create_plane` | Create/update a plane mesh. |
| `create_text` | Create/update a 3D text object. |
| `create_empty` | Create an Empty object for reference or rigging. |
| `apply_modifier` | Add and configure a modifier (ARRAY, SOLIDIFY, BEVEL, etc.). |
| `remove_modifier` | Remove a modifier from an object. |
| `copy_modifier` | Copy a modifier from a source object to targets. |
| `boolean_operation` | Perform INTERSECT, UNION, or DIFFERENCE between objects. |
| `duplicate_object` | Duplicate an object with optional transformations. |
| `duplicate_selection` | Duplicate all currently selected objects. |
| `transform_object` | Transform an existing object (location, rotation, scale). |
| `set_object_dimensions` | Set exact dimensions for an object in meters. |
| `batch_transform` | Transform multiple existing objects at once. |
| `select_objects` | Select multiple objects by name. |
| `select_by_pattern` | Select objects matching a glob pattern (e.g., 'Facade_Fin*'). |
| `select_by_collection` | Select all objects within a specific collection. |
| `invert_mesh_selection` | Invert the current mesh element selection (vertices, edges, faces). |
| `circular_array` | Create objects arranged in a radial pattern with optional collection targeting and immediate joining. |
| `join_objects` | Join multiple objects into a single mesh. TIP: Use after `select_by_pattern`. |
| `create_and_array` | Create a primitive and apply a linear array modifier in one step. |
| `random_distribute` | Randomly distribute copies of an object with deterministic seed support. |
| `extrude_mesh` | Extrude mesh geometry (vertices/edges/faces) with normal filtering. |
| `inset_faces` | Inset faces of a mesh (great for creating walls from floors). |
| `shear_mesh` | Shear mesh geometry along an axis (useful for sloped roofs). |
| `delete_object` | Delete object(s) by name or pattern (e.g. 'Test_*'). |
| `set_object_visibility`| Quickly hide/show objects to look inside Shells or isolate items. |

### Architectural Modeling
| Tool | Explanation |
|---|---|
| `build_room_shell` | PRIMARY TOOL: Create a full building shell (floor, walls, ceiling) from vertices in one call. |
| `build_wall_segment` | Create solid interior partition walls with specified thickness. |
| `build_wall_with_door` | Create interior walls with clean door apertures (no booleans). |
| `set_view` | Switch viewport (TOP, ISO, FRONT, SIDE) for precision drafting. |
| `build_column` | Create structural columns, optionally merged (union) with walls. |

### MEP (Systems) Engineering
| Tool | Explanation |
|---|---|
| `build_pipe_run` | Create color-coded pipe segments (WATER, CHILLER, FIRE, etc.) with optional auto-fittings. |
| `build_cable_tray` | Create electrical containment runs (LADDER, TROUGH) with automated supports. |
| `add_tray_support` | Move existing supports or add new ones (TRAPEZE, CANTILEVER, WALL) to tray runs. |
| `add_auto_cable_drops` | Automatically generate smooth Bezier cable drops from trays to racks/equipment beneath. |

### 3D Printing (Validation & Repair)
| Tool | Explanation |
|---|---|
| `set_scene_units` | Set scene units and scale (e.g., metric millimeters) crucial for 3D slicers. |
| `check_mesh_for_printing` | Analyze mesh topology for non-manifold edges, holes, and degenerate geometry. |
| `repair_mesh` | Automated, non-destructive mesh repair (merge vertices, fill holes, recalculate normals). |
| `apply_voxel_remesh` | Fuse overlapping parts into a single manifold volume using voxel remeshing. |
| `apply_sculpt_smooth` | Smooth mesh geometry with sculpt-mode brush for organic cleanup. |
| `apply_transforms` | Bake location/rotation/scale transforms into mesh data (required before boolean ops). |
| `apply_all_modifiers` | Apply all pending modifiers on an object and convert to clean mesh. |
| `convert_to_mesh` | Convert FONT/Curve objects (e.g. text) to editable mesh geometry. |
| `export_model` | Export objects or selections to standard 3D print formats (STL or 3MF). |

### Sculpting
| Tool | Explanation |
|---|---|
| `enter_sculpt_mode` / `exit_sculpt_mode` | Switch an object into/out of Sculpt Mode. |
| `set_dyntopo` | Enable/configure Dynamic Topology for adaptive detail while sculpting. |
| `sculpt_inflate` | Inflate/deflate a mesh along vertex normals; optional world-space Z mask to protect a flat base. |
| `sculpt_grab` | Simulate the Grab brush — pull vertices near a world-space point by an offset, with cosine falloff. |
| `symmetrize_mesh` | Mirror one half of a mesh onto the other across an axis, in Sculpt Mode. |

### Materials
| Tool | Explanation |
|---|---|
| `create_material` | **POWER TOOL**: Create PBR materials and assign to `pattern` or `collection` in ONE call. |
| `assign_material` | Assign existing materials to bulk objects/collections without selection turns. |
| `set_material_properties` | Modify color, metallic, roughness, and emission of existing materials. |
| `add_shader_node` | Add procedural or image-based nodes to a material tree. |
| `connect_shader_nodes` | Link nodes to build complex custom shaders. |
| `assign_builtin_texture` | Apply noise, voronoi, or wave textures to a material. |
| `assign_texture_map` | Apply an image texture directly to a material map. |
| `set_world_background` | Set scene background (color, HDRI, sky texture). |

### Animation
| Tool | Explanation |
|---|---|
| `set_keyframe` | Set a keyframe for an object property at a specific frame. |
| `get_keyframes` | Get all keyframes for an object. |
| `set_timeline_range` | Set the start, end, and current playback frames. |
| `play_animation` | Start or stop animation playback. |

### Rendering
| Tool | Explanation |
|---|---|
| `configure_render_settings` | Set render engine, samples, and resolution. |
| `render_frame` | Render the current frame to a file. |
| `render_animation` | Render an animation sequence to a directory. |

### Camera
| Tool | Explanation |
|---|---|
| `create_camera` | Create a new camera in the scene. |
| `set_active_camera` | Set the active camera for the viewport and rendering. |
| `camera_look_at` | Point a camera at a target location. |

### Lighting
| Tool | Explanation |
|---|---|
| `create_light` | Create POINT, SUN, SPOT, or AREA lights. |
| `configure_light` | Update light properties like energy, color, and size. |

### History
| Tool | Explanation |
|---|---|
| `undo` | Undo the last Blender action. |
| `redo` | Redo the last undone Blender action. |

## Example Usage in n8n

### Example Interaction

**User:** "Create a red metallic sphere at position [0, 0, 2]"
> **Assistant:** Perfect! I've successfully created a red metallic sphere at position [0, 0, 2]. Here's what was done:
> - Created a sphere named "RedMetallicSphere" with a radius of 1 unit at coordinates [0, 0, 2]
> - Applied a red metallic material using a polished metal preset with a red base color (#FF0000)
> 
> The sphere is now ready in your Blender scene with a shiny red metallic appearance.

**User:** "Duplicate the red sphere, move it to [5, 0, 2], and change its color to blue"
> **Assistant:** Perfect! I've successfully completed all the tasks:
> - Duplicated the red sphere and created a new object named "BlueMetallicSphere"
> - Moved it to position [5, 0, 2]
> - Changed the material to blue metallic with a polished metal finish
> 
> You now have two metallic spheres in your scene: RedMetallicSphere at [0, 0, 2] (red) and BlueMetallicSphere at [5, 0, 2] (blue).

**User:** "Select both the original red sphere and the duplicate, then add a Subdivision modifier to both"
> **Assistant:** Excellent! I've successfully:
> - Selected both spheres (RedMetallicSphere and BlueMetallicSphere)
> - Added a Subdivision Surface modifier (SUBSURF) to both objects with 2 levels of subdivision
> 
> This modifier will smooth and refine the geometry of both spheres, giving them a more polished and rounded appearance.

**User:** "Add a torus with minor_radius 0.1 and major_radius 25 at [2, 0, 0]"
> **Assistant:** Perfect! I've successfully created a torus with the specifications you requested:
> - **Name:** Torus
> - **Position:** [2, 0, 0]
> - **Major radius:** 25 (distance from center to center of the tube)
> - **Minor radius:** 0.1 (thickness of the tube)
> 
> This creates a very thin, large torus - essentially a large ring with a thin profile. It's now in your Blender scene alongside the two metallic spheres!

## Community Showcase

This project is powered by its community! Explore recorded sessions and documentation created by users to see what's possible with the Blender MCP:

*   [**Community Gallery**](community/README.md): Browse all user-submitted projects and learn how to contribute your own recordings.
*   [**Condominium Tower**](community/condominium_tower/README.md): A complete guide to creating a procedural 20-story building with glass facade and balconies.
*   [**Boolean Pavilion**](community/boolean_pavilion/README.md): Demonstrates boolean operations, unified structures, and advanced lighting/camera setup.

> [!TIP]
> **Share Your Work**: Have you built something cool? Check out our [**Contribution Guide**](community/README.md) to learn how to record, clean, and share your session with the community!

## ⚡ POWER TIPS: Avoiding Rate Limits

To prevent n8n or LLM "Too many requests" errors, follow these **Stateless Power Working** rules:

### 1. Avoid Selection-Based Workflows
❌ **Slow (4+ turns):** `select_by_pattern('Wall_*')` → `create_material('M_Gray')` → `assign_material()`
✅ **Fast (1 turn):** `create_material(name='M_Gray', pattern='Wall_*')`

### 2. Group by Collections
❌ **Unreliable:** Selecting individual objects.
✅ **Reliable:** `create_material(name='M_Glass', collection='Cutters')`

### 3. Bulk creation
If you need 10 objects, don't create them one-by-one. Use `create_and_array` or `duplicate_object` with `count`.

## Configuration

Set environment variables in `.env`:

```
BLENDER_MCP_HOST=127.0.0.1
BLENDER_MCP_PORT=8888
BLENDER_ASSETS_DIR=C:/path/to/your/assets

```

## Architecture & Technical Design

This project uses a modular `src/` structure to ensure maintainability:

```mermaid
graph TD
    A[main.py] --> B[server.py]
    B --> C[tools/ package]
    C --> D[modeling.py]
    C --> E[scene.py]
    C --> F[materials.py]
    B --> G[connection.py]
    B --> I[sessions.py]
    G --> H[Blender]
```

### Transport Model

Although the MCP specification supports persistent HTTP Streamable sessions, many clients (including n8n) currently operate in a stateless execution model, performing:

`Initialize` → `Discover Tools` → `Call Tool` → `Close`

for each interaction.

The server uses the official **HTTP Streamable** transport introduced in MCP SDK 1.8.0+, which supports both stateful sessions and stateless requests.

### The Stateless Fallback Mechanism

To ensure reliability across clients, the server implements a robust fallback strategy:

1. **Protocol Resilience**: If no active HTTP Streamable session exists, the server transparently handles standard JSON-RPC requests over HTTP.
2. **Execution Isolation**: Each tool call is processed independently, preventing session corruption or deadlocks.
3. **Visual Success Indicators**: Tool responses are prefixed with `✓` when successful. This helps the AI Agent’s conversational memory confirm task completion and avoid unintended re-execution loops.
4. **Clear State Boundaries**: Persistent state is intentionally separated:
   - 🧠 **Conversation memory** → AI Agent (n8n Simple Memory)
   - 🧩 **Scene state** → Blender runtime
   - 🚀 **MCP server** → Stateless execution bridge

### Architecture Diagram

```
n8n AI Agent 
      ↓
MCP Client (HTTP Streamable / JSON-RPC)
      ↓
MCP Server (ASGI)
      ↓
TCP Socket Bridge
      ↓
Blender Addon (Main Thread Queue)
      ↓
Blender Scene (Persistent State)
```

## Testing

We use an integrated test suite to verify Blender tools and layout scenarios.

```bash
# Run the Arch layout test
uv run python tests/run_integration.py run --scenario arch

# Run the standard functional grid test
uv run python tests/run_integration.py run --scenario grid

# Run the 3D Printing tool verification test
uv run python tests/run_integration.py run --scenario print

# Run the Filament Name Tag & Stand generation test
uv run python tests/run_integration.py run --scenario filament_tag
```

### Scenarios

| Scenario | Key | Description |
|---|---|---|
| Grid Layout | `grid` | Functional grid test covering all tool categories |
| Arch Layout | `arch` | Architectural scene generation test |
| Print Validation | `print` | 3D printing workflow: units, mesh repair, export |
| Filament Tag | `filament_tag` | Generates a 4-piece modular filament name tag & clip system (NameTagCard, AMSClip, StickonHolder, DeskStand) |

See the [Integration Testing Guide](docs/integration_tests.md) for full details on verification and benchmarking.

## Code Quality & Standards

We enforce code quality standards using [Ruff](https://docs.astral.sh/ruff/) and [Mypy](https://mypy.readthedocs.io/). These are run automatically on GitHub Actions CI.

To run these checks locally:

```bash
# 1. Format code (strict black-compatible formatting)
uv run ruff format src/ tests/ blender_mcp_addon/

# 2. Run linter and check code complexity (McCabe <= 12)
uv run ruff check src/ tests/ blender_mcp_addon/

# 3. Auto-fix standard lint issues
uv run ruff check src/ tests/ blender_mcp_addon/ --fix

# 4. Run static type checking
uv run mypy src/
```

## Troubleshooting

**Server won't start**: Install dependencies with `uv sync`

**Connection failed**: Ensure Blender MCP addon is running on port 8888.

**Dependency Graph Error**: If you see this, ensure you have the latest `blender_mcp_addon` package which implements the main-thread command queue.

**Tools not appearing in n8n**: Check the HTTP Streamable endpoint URL is correct (`http://localhost:8008/mcp`)

## Acknowledgments

This project was inspired by [blender-mcp](https://github.com/ahujasid/blender-mcp) by [ahujasid], which demonstrated the potential of MCP servers for Blender automation.

## License

MIT License - See LICENSE file for details


