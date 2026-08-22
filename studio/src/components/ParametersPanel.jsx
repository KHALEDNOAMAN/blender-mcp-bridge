// studio/src/components/ParametersPanel.jsx

/**
 * Global Parameters panel — declare-first store for ${name} tokens used in
 * command arguments. See docs/studio_design_v1.md §4.
 * Same collapsible-card pattern as MetadataPanel/BranchesPanel.
 */
import ParameterControl from './ParameterControl';

export default function ParametersPanel({ parameters, parameterUi, collapsed, onToggle, onChange }) {
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
                    {entries.map(([name, value]) => {
                        const ui = (parameterUi || {})[name];
                        // Typed controls (slider/checkbox/select) get a STACKED
                        // row: label line on top, full-width control beneath.
                        // The sidebar is only ~250px, so the old single-line
                        // layout left a slider about 60px wide once the name
                        // field, number box and delete button had taken their
                        // share. Plain text params keep the compact inline row.
                        const stacked = ui && ['slider', 'checkbox', 'select'].includes(ui.type);
                        if (stacked) {
                            return (
                                <div className="params-row params-row-stacked" key={name}>
                                    <div className="params-row-head">
                                        <input
                                            type="text"
                                            className="params-row-name-stacked"
                                            size={1}
                                            defaultValue={name}
                                            spellCheck={false}
                                            onBlur={(e) => handleNameChange(name, e.target.value.trim())}
                                            title={ui.label || name}
                                        />
                                        {ui.label && <span className="params-row-label">{ui.label}</span>}
                                        <button
                                            className="btn-icon params-row-delete"
                                            title={`Delete parameter "${name}"`}
                                            onClick={() => handleDelete(name)}
                                        >×</button>
                                    </div>
                                    <ParameterControl
                                        name={name}
                                        value={value}
                                        ui={ui}
                                        onChange={(v) => handleValueChange(name, v)}
                                    />
                                </div>
                            );
                        }
                        return (
                            <div className="params-row" key={name}>
                                <input
                                    type="text"
                                    className="params-row-name"
                                    defaultValue={name}
                                    spellCheck={false}
                                    onBlur={(e) => handleNameChange(name, e.target.value.trim())}
                                    title="Parameter name"
                                />
                                <ParameterControl
                                    name={name}
                                    value={value}
                                    ui={ui}
                                    onChange={(v) => handleValueChange(name, v)}
                                />
                                <button
                                    className="btn-icon params-row-delete"
                                    title={`Delete parameter "${name}"`}
                                    onClick={() => handleDelete(name)}
                                >×</button>
                            </div>
                        );
                    })}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add Parameter</button>
            </div>
        </section>
    );
}
