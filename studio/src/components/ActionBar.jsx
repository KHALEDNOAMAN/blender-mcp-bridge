/**
 * Command actionbar — playback transport + branch selection. See
 * docs/studio_design_v1.md §7.4, §7.5. Docked directly under the Command
 * Timeline's title row (not its own standalone card, and NOT inside the
 * click-to-collapse title row itself) so transport controls and the branch
 * dropdown stay reachable and clickable even while the timeline's diagram
 * body is collapsed — the whole point of moving it here instead of a
 * separate bar above `main` was that a separate bar disappears the moment
 * its own card is scrolled or the layout is tight, while this dock is
 * always on screen.
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
        <div className="action-bar">
            <div className="control-group main-controls">
                <button className="btn btn-secondary btn-sm" title="Undo Last Command (Ctrl+Z)" onClick={onUndo}>↶ Undo</button>
                <button className="btn btn-secondary btn-sm" title="Redo Last Command (Ctrl+Y)" onClick={onRedo}>↷ Redo</button>
                <div className="vr"></div>
                <button className="btn btn-success btn-sm" disabled={playAllDisabled} title={hasBranches ? branchNote : 'Play All Commands (Space)'} onClick={onPlayAll}>▶ Play All</button>
                <button className="btn btn-success btn-sm" disabled={playDisabled} title={hasBranches ? branchNote : 'Play from Active, or resume after it if already run (Ctrl+Enter)'} onClick={onPlay}>▶ Play</button>
                <button className="btn btn-success btn-sm" disabled={playToActiveDisabled} title={hasBranches ? branchNote : 'Play up to Active Command'} onClick={onPlayToActive}>▶ Play to Active</button>
                <button className="btn btn-danger btn-sm" disabled={stopDisabled} title="Stop Playback (Esc)" onClick={onStop}>⏹ Stop</button>
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
