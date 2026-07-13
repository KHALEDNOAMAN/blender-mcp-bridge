/**
 * Ported from index.html #playbackSection + playback.js button wiring.
 */
export default function PlaybackPanel({
    collapsed,
    onToggle,
    isPlaying,
    playAllDisabled,
    playDisabled,
    playToActiveDisabled,
    stopDisabled,
    hasBranches,
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
    const branchNote = 'This session has branches — use the Branches panel to run a specific branch instead of raw linear playback.';

    return (
        <section id="playbackSection" className={`card glass playback-collapsible${collapsed ? ' collapsed' : ''}`}>
            <div className="playback-header" onClick={onToggle} title="Toggle playback controls">
                <h2>Session Playback</h2>
                <span className="playback-chevron">▼</span>
            </div>
            <div className="playback-body">
                {hasBranches && (
                    <p style={{ opacity: 0.7, fontSize: '0.8em', marginBottom: '0.5rem' }}>{branchNote}</p>
                )}
                <div className="playback-controls-container">
                    <div className="control-group main-controls">
                        <button className="btn btn-secondary" title="Undo Last Command (Ctrl+Z)" onClick={onUndo}>↶ Undo</button>
                        <button className="btn btn-secondary" title="Redo Last Command (Ctrl+Y)" onClick={onRedo}>↷ Redo</button>
                        <div className="vr"></div>
                        <button className="btn btn-success" disabled={playAllDisabled} title={hasBranches ? branchNote : 'Play All Commands (Space)'} onClick={onPlayAll}>▶ Play All</button>
                        <button className="btn btn-success" disabled={playDisabled} title={hasBranches ? branchNote : 'Play from Active (Ctrl+Enter)'} onClick={onPlay}>▶ Play</button>
                        <button className="btn btn-success" disabled={playToActiveDisabled} title={hasBranches ? branchNote : 'Play up to Active Command'} onClick={onPlayToActive}>▶ Play to Active</button>
                        <button className="btn btn-danger" disabled={stopDisabled} title="Stop Playback (Esc)" onClick={onStop}>⏹ Stop</button>
                    </div>
                    <div className="control-group secondary-controls">
                        <button className="btn btn-secondary btn-sm" title="Re-enable all Run buttons (Alt+R)" onClick={onReset}>↺ Reset</button>
                        <button className="btn btn-danger btn-sm" title="Delete all objects in Blender scene" onClick={onClearScene}>🗑 Clear</button>
                    </div>
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
        </section>
    );
}
