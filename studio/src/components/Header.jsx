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
}) {
    const statusClass = [
        'status-indicator',
        connectionStatus.connected ? 'connected' : '',
        connectionStatus.error ? 'error' : '',
    ].filter(Boolean).join(' ');

    return (
        <header>
            <div className="logo-section">
                <h1>Blender<span>Studio</span></h1>
                <p className="subtitle">Blender MCP Recording Studio</p>
            </div>
            <div className="actions">
                <div className={statusClass} title="Server Connection Status">
                    <span className="dot"></span> <span className="status-text">{connectionStatus.label}</span>
                </div>
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
                <button className="btn btn-success" onClick={onAddCommand}>+ New Command</button>
                <button className="btn btn-secondary" disabled={saveDisabled} onClick={onSave}>Export JSON</button>
            </div>
        </header>
    );
}
