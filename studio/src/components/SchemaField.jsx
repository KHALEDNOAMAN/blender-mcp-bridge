import AutoExpandTextarea from './AutoExpandTextarea';
import { extractParamName, isParametric } from '../lib/params';
import { looksLikeExpression, collectParamNames } from '../lib/expr';

/**
 * Inline "create parameter" affordance (design doc §4.1 hybrid model,
 * extended by §4.4 for expressions). Shown under a field whose value is a
 * bare "${name}" token or an arithmetic expression referencing one or more
 * "${name}" tokens, when any referenced name isn't a known parameter yet.
 */
function ParamTokenHint({ fieldValue, parameters, pendingParams, onCreateParam }) {
    if (!isParametric(fieldValue)) return null;

    const refs = extractParamName(fieldValue) !== null
        ? [extractParamName(fieldValue)]
        : (looksLikeExpression(fieldValue) ? collectParamNames(fieldValue) : []);
    if (refs.length === 0) return null;

    const missing = refs.filter((n) => !(n in parameters) && !(n in pendingParams));

    if (missing.length === 0) {
        return (
            <div style={{ fontSize: '0.75em', opacity: 0.6, marginTop: '0.25rem' }}>
                Uses parameter{refs.length > 1 ? 's' : ''} {refs.map((n) => <code key={n}>{n}</code>).reduce((a, b) => [a, ', ', b])}
            </div>
        );
    }

    return (
        <div style={{ fontSize: '0.8em', marginTop: '0.25rem', color: 'var(--danger-color)' }}>
            Undefined parameter{missing.length > 1 ? 's' : ''}: {missing.map((n) => (
                <span key={n} style={{ marginRight: '0.5rem' }}>
                    <code>{n}</code>{' '}
                    <button
                        type="button"
                        className="btn-icon"
                        style={{ textDecoration: 'underline', color: 'inherit', width: 'auto', height: 'auto' }}
                        onClick={() => onCreateParam(n)}
                    >
                        Create it
                    </button>
                </span>
            ))}
        </div>
    );
}

/**
 * Renders one field of a JSON-schema-driven form. Ported from
 * session_editor/ui.js renderSchemaField(), preserving the same
 * dotted-path `name` scheme and `data-type` semantics so getArgs()/preFill()
 * logic (in DynamicArgsForm) can stay a faithful, flat-map port too.
 *
 * `values` is a flat map of fieldPath -> string value (all values stored as
 * strings, same as raw DOM input.value, and parsed back to typed values by
 * the caller via fieldTypes).
 *
 * `parameters`/`pendingParams`/`onCreateParam`: the global param store (§4)
 * plus this form's not-yet-committed quick-created params, and the callback
 * to quick-create one when a field holds an unrecognized "${name}" token.
 */
export default function SchemaField({
    name, prop, parentPath = '', isRequired = false, values, onChange, invalidPaths,
    parameters = {}, pendingParams = {}, onCreateParam = () => {},
}) {
    const fieldPath = parentPath ? parentPath + '.' + name : name;

    const label = (
        <label>
            {name}
            {isRequired && <span style={{ color: 'var(--danger-color)' }}> *</span>}
            {prop.description && (
                <span style={{ opacity: 1, color: 'var(--accent-color)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'none' }}>
                    {` (${prop.description})`}
                </span>
            )}
        </label>
    );

    // Nested object: recurse, no wrapping input of its own.
    if (prop.type === 'object' && prop.properties) {
        const reqs = prop.required || [];
        return (
            <div className="nested-group">
                <div className="nested-group-title">{name}{isRequired ? ' *' : ''}</div>
                {Object.entries(prop.properties).map(([pN, pP]) => (
                    <SchemaField
                        key={pN}
                        name={pN}
                        prop={pP}
                        parentPath={fieldPath}
                        isRequired={reqs.includes(pN)}
                        values={values}
                        onChange={onChange}
                        invalidPaths={invalidPaths}
                        parameters={parameters}
                        pendingParams={pendingParams}
                        onCreateParam={onCreateParam}
                    />
                ))}
            </div>
        );
    }

    // Array of objects -> raw JSON textarea
    if (prop.type === 'array' && prop.items && prop.items.type === 'object') {
        let hint = 'Enter as JSON array of objects...';
        if (prop.items.properties) {
            const keys = Object.keys(prop.items.properties).join(', ');
            hint = `e.g. [{ "${Object.keys(prop.items.properties)[0]}": ... }]\nFields: ${keys}`;
        }
        const invalid = invalidPaths && invalidPaths.has(fieldPath);
        const fieldValue = values[fieldPath] ?? '';
        return (
            <div className="nested-group" data-full="true">
                {label}
                <AutoExpandTextarea
                    name={fieldPath}
                    data-type="json"
                    placeholder={hint}
                    required={isRequired}
                    value={fieldValue}
                    onChange={(e) => onChange(fieldPath, e.target.value, 'json')}
                    style={invalid ? { borderColor: 'var(--danger-color)' } : undefined}
                />
                <ParamTokenHint fieldValue={fieldValue} parameters={parameters} pendingParams={pendingParams} onCreateParam={onCreateParam} />
            </div>
        );
    }

    const invalid = invalidPaths && invalidPaths.has(fieldPath);
    const borderStyle = invalid ? { borderColor: 'var(--danger-color)' } : undefined;

    const fieldValue = values[fieldPath] ?? '';

    let input;
    if (prop.type === 'array') {
        let placeholder = 'e.g. [0, 0, 0]';
        if (prop.items && prop.items.type === 'string') placeholder = 'e.g. ["Item1", "Item2"]';
        else if (prop.items && prop.items.type === 'array') placeholder = 'e.g. [[0, 0, 0], [1, 1, 1]]';

        input = (
            <AutoExpandTextarea
                name={fieldPath}
                data-type="json"
                data-full="true"
                placeholder={placeholder}
                required={isRequired}
                value={fieldValue}
                onChange={(e) => onChange(fieldPath, e.target.value, 'json')}
                style={borderStyle}
            />
        );
        return (
            <div className="arg-field" data-full="true">
                {label}
                {input}
                <ParamTokenHint fieldValue={fieldValue} parameters={parameters} pendingParams={pendingParams} onCreateParam={onCreateParam} />
            </div>
        );
    } else if (prop.enum) {
        input = (
            <select
                className="form-select"
                name={fieldPath}
                data-type="enum"
                value={values[fieldPath] ?? ''}
                onChange={(e) => onChange(fieldPath, e.target.value, 'enum')}
                style={borderStyle}
            >
                {prop.enum.map((v) => (
                    <option key={v} value={v}>{v}</option>
                ))}
            </select>
        );
    } else if (prop.type === 'boolean') {
        const defaultVal = prop.default !== undefined ? prop.default.toString() : 'true';
        input = (
            <select
                className="form-select"
                name={fieldPath}
                data-type="boolean"
                value={values[fieldPath] ?? defaultVal}
                onChange={(e) => onChange(fieldPath, e.target.value, 'boolean')}
                style={borderStyle}
            >
                <option value="true">true</option>
                <option value="false">false</option>
            </select>
        );
    } else {
        const defaultVal = prop.default !== undefined ? String(prop.default) : '';
        const currentVal = values[fieldPath] ?? defaultVal;
        // A number/integer field must fall back to a text input while it
        // holds a "${name}" token or an arithmetic expression — a native
        // <input type="number"> can't display non-numeric text and would
        // silently clear the value.
        const isNumericType = prop.type === 'number' || prop.type === 'integer';
        const type = (isNumericType && !isParametric(currentVal)) ? 'number' : 'text';
        input = (
            <input
                type={type}
                name={fieldPath}
                data-type={prop.type}
                spellCheck={false}
                required={isRequired}
                value={currentVal}
                onChange={(e) => onChange(fieldPath, e.target.value, prop.type)}
                style={borderStyle}
            />
        );
    }

    return (
        <div className="arg-field">
            {label}
            {input}
            <ParamTokenHint fieldValue={fieldValue} parameters={parameters} pendingParams={pendingParams} onCreateParam={onCreateParam} />
        </div>
    );
}
