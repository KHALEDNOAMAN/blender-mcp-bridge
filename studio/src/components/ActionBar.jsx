/**
 * Commands actionbar — playback transport + branch selection, docked below
 * the header. See docs/studio_design_v1.md §7.4. Replaces the old
 * PlaybackPanel sidebar card: Undo/Redo, Play All/Play/Play to Active/Stop,
 * Reset/Clear Scene, the delay input, and (new) a branch dropdown all live
 * here now, always visible regardless of what's scrolled in the sidebar.
 *
 * The branch dropdown is select-then-run, not a live filter — running a
 * branch is still the auto-wipe-and-replay behavior from §5.3, unchanged.
 * BranchesPanel (sidebar) keeps create/delete/inspect; this is just "pick
 * one and run it" for the common case.
 */
export default function ActionBar({
    isPlaying,
    playAllDisabled,
    playDisabled,
    playToActiveDisabled,
    stopDisabled,
    hasBranches,
    branches,
    selectedBranch,
    onSelectedBranchChange,
    runningBranch,
    onRunBranch,
    playbackDelay,
    onDelayChange,
    onUndo,
    onRedo,
    onPlayAll,
    onPlay,
    onPlayToActive,
    onStop,
    onReset,
    onClearScene,
}) {
    const branchNote = 'This session has branches — pick one from the dropdown and Run instead of raw linear playback.';
    const branchNames = Object.keys(branches || {});

    return (
        <div className="action-bar card glass">
            <div className="control-group main-controls">
                <button className="btn btn-secondary" title="Undo Last Command (Ctrl+Z)" onClick={onUndo}>↶ Undo</button>
                <button className="btn btn-secondary" title="Redo Last Command (Ctrl+Y)" onClick={onRedo}>↷ Redo</button>
                <div className="vr"></div>
                <button className="btn btn-success" disabled={playAllDisabled} title={hasBranches ? branchNote : 'Play All Commands (Space)'} onClick={onPlayAll}>▶ Play All</button>
                <button className="btn btn-success" disabled={playDisabled} title={hasBranches ? branchNote : 'Play from Active (Ctrl+Enter)'} onClick={onPlay}>▶ Play</button>
                <button className="btn btn-success" disabled={playToActiveDisabled} title={hasBranches ? branchNote : 'Play up to Active Command'} onClick={onPlayToActive}>▶ Play to Active</button>
                <button className="btn btn-danger" disabled={stopDisabled} title="Stop Playback (Esc)" onClick={onStop}>⏹ Stop</button>
                <div className="vr"></div>
                <button className="btn btn-secondary btn-sm" title="Re-enable all Run buttons (Alt+R)" onClick={onReset}>↺ Reset</button>
                <button className="btn btn-danger btn-sm" title="Delete all objects in Blender scene" onClick={onClearScene}>🗑 Clear</button>
            </div>

            <div className="control-group action-bar-right">
                {hasBranches && (
                    <div className="branch-run-group" title={branchNote}>
                        <select
                            className="form-select branch-select"
                            value={selectedBranch || ''}
                            onChange={(e) => onSelectedBranchChange(e.target.value)}
                        >
                            {branchNames.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                        <button
                            className="btn btn-sm btn-success"
                            disabled={isPlaying || !selectedBranch}
                            onClick={() => onRunBranch(selectedBranch)}
                        >
                            {runningBranch === selectedBranch ? '▶ Running…' : '▶ Run Branch'}
                        </button>
                    </div>
                )}
                <div className="playback-delay-group">
                    <label htmlFor="playbackDelay">Delay (ms)</label>
                    <input
                        type="number"
                        id="playbackDelay"
                        value={playbackDelay}
                        min={0}
                        step={100}
                        spellCheck={false}
                        onChange={(e) => onDelayChange(e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}
