/**
 * Global Parameters panel — declare-first store for ${name} tokens used in
 * command arguments. See docs/studio_design_v1.md §4.
 * Same collapsible-card pattern as MetadataPanel/PlaybackPanel.
 */
export default function ParametersPanel({ parameters, collapsed, onToggle, onChange }) {
    const entries = Object.entries(parameters || {});

    const handleNameChange = (oldName, newName) => {
        if (!newName || newName === oldName) return;
        if (newName in parameters) return; // no silent overwrite of an existing param
        const next = {};
        Object.entries(parameters).forEach(([k, v]) => {
            next[k === oldName ? newName : k] = v;
        });
        onChange(next);
    };

    const handleValueChange = (name, value) => {
        onChange({ ...parameters, [name]: value });
    };

    const handleDelete = (name) => {
        const next = { ...parameters };
        delete next[name];
        onChange(next);
    };

    const handleAdd = () => {
        let candidate = 'param';
        let i = 1;
        while (candidate in parameters) { candidate = `param${i}`; i += 1; }
        onChange({ ...parameters, [candidate]: '' });
    };

    return (
        <section id="parametersSection" className={`card glass metadata-collapsible${collapsed ? ' collapsed' : ''}`}>
            <div className="metadata-header" onClick={onToggle} title="Toggle parameters">
                <h2>Parameters <span className="badge">{entries.length}</span></h2>
                <span className="metadata-chevron">▼</span>
            </div>
            <div className="metadata-body">
                <div className="params-table">
                    {entries.length === 0 && (
                        <p style={{ opacity: 0.6, fontSize: '0.85em' }}>
                            No parameters yet. Add one, or use "${'{name}'}" in a command
                            argument and create it inline.
                        </p>
                    )}
                    {entries.map(([name, value]) => (
                        <div className="params-row" key={name} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input
                                type="text"
                                defaultValue={name}
                                spellCheck={false}
                                style={{ flex: '0 0 40%' }}
                                onBlur={(e) => handleNameChange(name, e.target.value.trim())}
                                title="Parameter name"
                            />
                            <input
                                type="text"
                                value={value}
                                spellCheck={false}
                                style={{ flex: 1 }}
                                onChange={(e) => handleValueChange(name, e.target.value)}
                                title="Parameter value"
                            />
                            <button
                                className="btn-icon"
                                title={`Delete parameter "${name}"`}
                                onClick={() => handleDelete(name)}
                            >×</button>
                        </div>
                    ))}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add Parameter</button>
            </div>
        </section>
    );
}
