/**
 * Ported from index.html <header>.
 */
export default function Header({
    connectionStatus, // { connected: bool, error: bool, label: string }
    theme,
    onThemeToggle,
    onNewSession,
    onLoadClick,
    onFileSelected,
    onAddCommand,
    onSave,
    saveDisabled,
    fileInputRef,
    viewMode,
    onToggleViewMode,
    viewModeToggleDisabled,
    demoMode,
    onToggleDemoMode,
    communitySessions,
    onLoadCommunitySession,
    assistantOpen,
    onToggleAssistant,
}) {
    // §9: demo mode is a distinct badge state, never folded into
    // connected/error — going offline must never silently look like
    // "connected" (that was the "Connected (null)" bug on GitHub Pages),
    // and demo mode itself must read as "this is a simulation," not as a
    // real connection.
    const statusClass = [
        'status-indicator',
        demoMode ? 'demo' : '',
        connectionStatus.connected ? 'connected' : '',
        connectionStatus.error && !demoMode ? 'error' : '',
    ].filter(Boolean).join(' ');
    const statusLabel = demoMode ? 'Demo Mode' : connectionStatus.label;

    return (
        <header>
            <div className="logo-section">
                <h1>Blender<span>Studio</span></h1>
                <p className="subtitle">Blender MCP Recording Studio</p>
            </div>
            <div className="actions">
                <div className={statusClass} title={demoMode ? 'Simulated playback — no Blender bridge connected' : 'Server Connection Status'}>
                    <span className="dot"></span> <span className="status-text">{statusLabel}</span>
                </div>
                {!connectionStatus.connected && (
                    <button
                        className="btn btn-secondary"
                        onClick={onToggleDemoMode}
                        title={demoMode
                            ? 'Exit demo mode'
                            : 'No Blender bridge reachable — simulate playback to explore Studio without one'}
                    >
                        {demoMode ? '✕ Exit Demo' : '▶ Try Demo Mode'}
                    </button>
                )}
                <button className="btn btn-secondary" onClick={onThemeToggle}>
                    {theme === 'dark-theme' ? '☀️ Light' : '🌙 Dark'}
                </button>
                <button
                    className="btn btn-secondary"
                    onClick={onToggleViewMode}
                    disabled={viewModeToggleDisabled}
                    title={viewModeToggleDisabled ? 'Load or create a session first' : 'Toggle between guided panels and raw session JSON'}
                >
                    {viewMode === 'json' ? '🧭 Guided' : '{ } JSON'}
                </button>
                <input
                    type="file"
                    accept=".json"
                    hidden
                    ref={fileInputRef}
                    onChange={onFileSelected}
                />
                <button className="btn btn-secondary" onClick={onNewSession}>New Session</button>
                <button className="btn btn-primary" onClick={onLoadClick}>Load Session</button>
                {communitySessions.length > 0 && (
                    <select
                        className="form-select community-sample-select"
                        value=""
                        onChange={(e) => onLoadCommunitySession(e.target.value)}
                        title="Load a sample session from the community gallery"
                    >
                        <option value="" disabled>Community Sample…</option>
                        {communitySessions.map((s) => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                    </select>
                )}
                <button
                    className={`btn ${assistantOpen ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={onToggleAssistant}
                    title="Toggle the AI Assistant panel"
                >
                    🤖 Assistant
                </button>
                <button className="btn btn-success" onClick={onAddCommand}>+ New Command</button>
                <button className="btn btn-secondary" disabled={saveDisabled} onClick={onSave}>Export JSON</button>
            </div>
        </header>
    );
}
