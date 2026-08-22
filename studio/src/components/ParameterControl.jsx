// studio/src/components/ParameterControl.jsx

/**
 * Renders one parameter's value editor, typed by the session's optional
 * `parameter_ui` block:
 *
 *   "parameter_ui": {
 *     "bin_width":   { "type": "slider",   "min": 40, "max": 200, "step": 1, "unit": "mm" },
 *     "bin_holes_1": { "type": "checkbox", "on": "1", "off": "0" },
 *     "bin_preset":  { "type": "select",   "options": ["small", "large"] }
 *   }
 *
 * With no entry (or an unrecognised type) it falls back to the plain text
 * input, so every existing session keeps working untouched.
 *
 * IMPORTANT: parameter values are always written back as STRINGS. Playback
 * resolves "${name}" tokens straight out of the parameters map and a bare
 * token yields the raw stored value — storing a JS number here would put a
 * non-string into the session JSON and diverge from every hand-authored
 * session.
 */
export default function ParameterControl({ name, value, ui, onChange }) {
    const type = ui && ui.type;

    if (type === 'slider') {
        const min = Number(ui.min ?? 0);
        const max = Number(ui.max ?? 100);
        const step = Number(ui.step ?? 1);
        // A parameter can legitimately hold an expression rather than a
        // number. Don't force a broken value into the slider — fall back to
        // text so it stays editable and visible.
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return (
                <input
                    type="text"
                    className="params-row-value"
                    value={value}
                    spellCheck={false}
                    onChange={(e) => onChange(e.target.value)}
                    title={`${name} (not a number — slider hidden)`}
                />
            );
        }
        return (
            <div className="params-control params-control-slider">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={numeric}
                    onChange={(e) => onChange(String(e.target.value))}
                    title={`${name}: ${min}–${max}`}
                />
                <input
                    type="number"
                    className="params-control-number"
                    min={min}
                    max={max}
                    step={step}
                    value={numeric}
                    onChange={(e) => onChange(String(e.target.value))}
                />
                {ui.unit && <span className="params-control-unit">{ui.unit}</span>}
            </div>
        );
    }

    if (type === 'checkbox') {
        const on = String(ui.on ?? '1');
        const off = String(ui.off ?? '0');
        return (
            <div className="params-control params-control-checkbox">
                <label>
                    <input
                        type="checkbox"
                        checked={String(value) === on}
                        onChange={(e) => onChange(e.target.checked ? on : off)}
                    />
                    <span>{String(value) === on ? on : off}</span>
                </label>
            </div>
        );
    }

    if (type === 'select' && Array.isArray(ui.options)) {
        return (
            <select
                className="params-row-value"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {ui.options.map((opt) => (
                    <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                ))}
            </select>
        );
    }

    return (
        <input
            type="text"
            className="params-row-value"
            value={value}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            title="Parameter value"
        />
    );
}
