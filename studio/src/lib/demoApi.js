/**
 * Demo mode: a drop-in stand-in for `runCommand` (lib/api.js) used when no
 * real Blender bridge is reachable — e.g. Studio deployed standalone on
 * GitHub Pages, see docs/studio_design_v1.md §9. Lets a loaded session be
 * "played" (Play All/Play/Play to Active/branch runs, even Undo/Redo/Clear
 * Scene) so the UI/workflow can be demonstrated without a live Blender.
 *
 * Deliberately does NOT fake a 3D result — no placeholder viewport image,
 * no simulated scene state. It only ever resolves as a generic success
 * after the same delay real playback would take. This mirrors the earlier,
 * explicit decision against a fake geometry preview in the Command Timeline
 * (§7 non-goals): pretending to show Blender's output would be misleading
 * about what actually happened, whereas "this step would have run" is an
 * honest simulation of the recording/playback workflow itself.
 */
export async function simulateCommand(tool, args) {
    return {
        status: 'success',
        demo: true,
        message: `Demo mode: "${tool}" would run here with a connected Blender bridge.`,
    };
}
