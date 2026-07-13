/**
 * Branches panel — saved feature branches (named ranges over commands[]).
 * See docs/studio_design_v1.md §5. Same collapsible-card pattern as
 * ParametersPanel/MetadataPanel/PlaybackPanel.
 */
export default function BranchesPanel({ branches, collapsed, onToggle, onNewBranch, onRunBranch, onDeleteBranch, isPlaying, runningBranch }) {
    const entries = Object.entries(branches || {});

    return (
        <section id="branchesSection" className={`card glass metadata-collapsible${collapsed ? ' collapsed' : ''}`}>
            <div className="metadata-header" onClick={onToggle} title="Toggle branches">
                <h2>Branches <span className="badge">{entries.length}</span></h2>
                <span className="metadata-chevron">▼</span>
            </div>
            <div className="metadata-body">
                {entries.length === 0 && (
                    <p style={{ opacity: 0.6, fontSize: '0.85em', marginBottom: '0.75rem' }}>
                        No branches yet. A branch is a named set of command ranges you can
                        run independently — e.g. run commands 1–10, then jump to 20–30.
                    </p>
                )}
                <div className="branches-list">
                    {entries.map(([name, branch]) => (
                        <div key={name} className="branch-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{name}</div>
                                <div style={{ fontSize: '0.75em', opacity: 0.6 }}>
                                    {branch.ranges.map(([s, e]) => `#${s + 1}–#${e + 1}`).join(', ')}
                                </div>
                            </div>
                            <button
                                className="btn btn-sm btn-success"
                                disabled={isPlaying}
                                onClick={() => onRunBranch(name)}
                            >
                                {runningBranch === name ? '▶ Running…' : '▶ Run'}
                            </button>
                            <button className="btn-icon" title={`Delete branch "${name}"`} onClick={() => onDeleteBranch(name)}>×</button>
                        </div>
                    ))}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={onNewBranch}>+ New Branch</button>
            </div>
        </section>
    );
}
