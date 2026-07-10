//session_editor/globals.js

const fileInput = document.getElementById('fileInput');
const loadBtn = document.getElementById('loadBtn');
const newSessionBtn = document.getElementById('newSessionBtn');
const addCommandBtn = document.getElementById('addCommandBtn');
const saveBtn = document.getElementById('saveBtn');
const commandList = document.getElementById('commandList');
const commandCount = document.getElementById('commandCount');
const commandFilter = document.getElementById('commandFilter');
const sessionName = document.getElementById('sessionName');
const sessionModel = document.getElementById('sessionModel');
const sessionCreatedAt = document.getElementById('sessionCreatedAt');
const sessionDescription = document.getElementById('sessionDescription');
const commandTemplate = document.getElementById('commandTemplate');
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

const connectionStatus = document.getElementById('connectionStatus');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const playAllBtn = document.getElementById('playAllBtn');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const clearSceneBtn = document.getElementById('clearSceneBtn');
const resetStateBtn = document.getElementById('resetStateBtn');
const playbackDelay = document.getElementById('playbackDelay');

let currentSession = null;
let isPlaying = false;
let playbackTimeout = null;
let availableTools = [];

const TOOL_CATEGORIES = {
    'Collections': ['create_collection', 'set_active_collection', 'move_to_collection', 'get_collections', 'remove_collection', 'select_by_collection', 'duplicate_collection', 'set_collection_visibility'],
    'Modeling': ['create_cube', 'create_cylinder', 'create_sphere', 'create_icosphere', 'create_torus', 'create_plane', 'create_text', 'create_empty', 'duplicate_object', 'duplicate_selection', 'invert_mesh_selection', 'create_and_array', 'batch_transform', 'apply_modifier', 'copy_modifier', 'remove_modifier', 'boolean_operation', 'transform_object', 'circular_array', 'select_objects', 'select_by_pattern', 'set_object_dimensions', 'join_objects', 'random_distribute', 'extrude_mesh', 'inset_faces', 'shear_mesh', 'delete_object', 'set_object_visibility'],
    '3D Printing & Validation': ['set_scene_units', 'import_model', 'check_mesh_for_printing', 'repair_mesh', 'apply_voxel_remesh', 'export_model'],
    'Architectural Modeling': ['build_room_shell', 'build_wall_segment', 'build_wall_with_door', 'build_column', 'set_view'],
    'MEP (Systems) Engineering': ['build_pipe_run', 'build_cable_tray', 'add_tray_support'],
    'Materials': ['create_material', 'assign_material', 'set_material_properties', 'add_shader_node', 'connect_shader_nodes', 'assign_builtin_texture', 'assign_texture_map', 'set_world_background'],
    'Animation': ['set_keyframe', 'get_keyframes', 'set_timeline_range', 'play_animation'],
    'Rendering': ['configure_render_settings', 'render_frame', 'render_animation'],
    'Camera': ['create_camera', 'set_active_camera', 'camera_look_at'],
    'Lighting': ['create_light', 'configure_light']
};

const HIDDEN_TOOLS = [
    'get_scene_info', 'get_object_info', 'get_viewport_screenshot', 'get_distance', 'get_debug_info',
    'undo', 'redo'
];

const API_BASE_DEFAULT = (window.location.protocol === 'file:' || window.location.origin === 'null')
    ? 'http://localhost:8008'
    : window.location.origin;

let API_BASE = API_BASE_DEFAULT;
