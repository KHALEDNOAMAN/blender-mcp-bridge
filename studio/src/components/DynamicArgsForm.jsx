import { useEffect, useMemo, useState } from 'react';
import { TOOL_CATEGORIES, HIDDEN_TOOLS } from '../lib/toolCategories';
import { stringifyCompact } from '../lib/uiUtils';
import { isParametric, extractParamName } from '../lib/params';
import { looksLikeExpression, collectParamNames, evaluateExpression, candidateStringsForField } from '../lib/expr';
import SchemaField from './SchemaField';

const categorizedTools = Object.values(TOOL_CATEGORIES).flat();

/**
 * Ported from session_editor's addToolTestingListeners + the New/Edit Command
 * modal wiring in app.js/commands.js. Used both for "new command" and
 * "edit command" (via initialTool/initialArgs).
 *
 * Exposes an imperative-ish API via onReady(getArgs, validate) so the parent
 * modal can pull values out on confirm, mirroring the original's
 * getArgs()/validate() closures.
 *
 * `parameters` (§4 hybrid model): the global param store as it existed when
 * this form opened. Any "${name}" typed into a field that isn't in this map
 * gets an inline "create parameter" affordance (see SchemaField) rather than
 * failing validation — newly-created names are tracked in `pendingParams` and
 * exposed via onReady's `pendingParams` so the caller can merge them into the
 * session's global parameters on confirm.
 */
export default function DynamicArgsForm({ availableTools, initialTool, initialArgs, onReady, lockToolSelection = false, parameters = {} }) {
    const [category, setCategory] = useState('');
    const [tool, setTool] = useState(initialTool || '');
    const [values, setValues] = useState({});
    const [pendingParams, setPendingParams] = useState({});
    const [invalidPaths, setInvalidPaths] = useState(new Set());

    const hasUncategorized = availableTools.some(
        (at) => !categorizedTools.includes(at.name) && !HIDDEN_TOOLS.includes(at.name)
    );

    // On mount, if editing an existing command, resolve its category.
    useEffect(() => {
        if (initialTool) {
            let cat = 'Uncategorized';
            for (const [c, tools] of Object.entries(TOOL_CATEGORIES)) {
                if (tools.includes(initialTool)) { cat = c; break; }
            }
            setCategory(cat);
            setTool(initialTool);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toolList = useMemo(() => {
        if (!category) return [];
        if (category === 'Uncategorized') {
            return availableTools.filter((at) => !categorizedTools.includes(at.name) && !HIDDEN_TOOLS.includes(at.name));
        }
        const names = TOOL_CATEGORIES[category] || [];
        return names.map((n) => availableTools.find((at) => at.name === n) || { name: n, inputSchema: { properties: {} } });
    }, [category, availableTools]);

    const selectedTool = useMemo(() => {
        if (!tool) return null;
        return availableTools.find((t) => t.name === tool) || { name: tool, inputSchema: { properties: {} } };
    }, [tool, availableTools]);

    const schemaProps = selectedTool && selectedTool.inputSchema && selectedTool.inputSchema.properties
        ? selectedTool.inputSchema.properties
        : {};
    const schemaRequired = (selectedTool && selectedTool.inputSchema && selectedTool.inputSchema.required) || [];

    // Pre-fill values when editing an existing command.
    useEffect(() => {
        if (!initialArgs || !selectedTool) return;
        const flat = {};
        const walk = (args, pPath = '') => {
            Object.entries(args).forEach(([k, v]) => {
                const path = pPath ? `${pPath}.${k}` : k;
                if (v !== null && typeof v === 'object' && !Array.isArray(v)) walk(v, path);
                else {
                    // Determine if this path is a json-typed field (array) by walking schema.
                    const isJsonArray = Array.isArray(v);
                    flat[path] = isJsonArray ? stringifyCompact(v) : String(v);
                }
            });
        };
        walk(initialArgs);
        setValues((prev) => ({ ...prev, ...flat }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTool, initialArgs]);

    const handleCategoryChange = (e) => {
        setCategory(e.target.value);
        setTool('');
        setValues({});
    };

    const handleToolChange = (e) => {
        setTool(e.target.value);
        setValues({});
    };

    const handleFieldChange = (path, val) => {
        setValues((prev) => ({ ...prev, [path]: val }));
        setInvalidPaths((prev) => {
            if (!prev.has(path)) return prev;
            const next = new Set(prev);
            next.delete(path);
            return next;
        });
    };

    // Build the args object from the flat values map, same algorithm as
    // the original getArgs() in app.js/commands.js.
    const getArgs = () => {
        const args = {};
        const walkSchema = (props, parentPath = '') => {
            const typeMap = {};
            Object.entries(props).forEach(([name, prop]) => {
                const path = parentPath ? parentPath + '.' + name : name;
                if (prop.type === 'object' && prop.properties) {
                    Object.assign(typeMap, walkSchema(prop.properties, path));
                } else if (prop.type === 'array' && prop.items && prop.items.type === 'object') {
                    typeMap[path] = 'json';
                } else if (prop.type === 'array') {
                    typeMap[path] = 'json';
                } else if (prop.enum) {
                    typeMap[path] = 'enum';
                } else if (prop.type === 'boolean') {
                    typeMap[path] = 'boolean';
                } else {
                    typeMap[path] = prop.type;
                }
            });
            return typeMap;
        };
        const typeMap = walkSchema(schemaProps);

        Object.entries(values).forEach(([path, raw]) => {
            if (raw === '' || raw === undefined) return;
            const type = typeMap[path];
            let v = raw;
            // A "${name}" token or arithmetic expression is stored as-is
            // (not coerced) so the saved command stays parametric — real
            // resolution/coercion happens at dispatch time (lib/params.js
            // resolveArgsObject), once param values are known. See §4.3/§4.4.
            if (!isParametric(raw)) {
                if (type === 'number' || type === 'integer') v = parseFloat(v);
                if (type === 'boolean') v = (v === 'true');
                if (type === 'json') {
                    try { v = JSON.parse(v); } catch (e) { return; }
                }
            }
            const parts = path.split('.');
            let target = args;
            for (let j = 0; j < parts.length - 1; j++) {
                if (!target[parts[j]]) target[parts[j]] = {};
                target = target[parts[j]];
            }
            target[parts[parts.length - 1]] = v;
        });
        return args;
    };

    const validate = () => {
        const invalid = new Set();
        const walkRequired = (props, reqs, parentPath = '') => {
            Object.entries(props).forEach(([name, prop]) => {
                const path = parentPath ? parentPath + '.' + name : name;
                const isRequired = reqs.includes(name);
                if (prop.type === 'object' && prop.properties) {
                    walkRequired(prop.properties, prop.required || [], path);
                } else if (isRequired) {
                    const v = values[path];
                    if (!v || !String(v).trim()) invalid.add(path);
                }
            });
        };
        walkRequired(schemaProps, schemaRequired);

        // A "${name}" token or expression referencing a param that isn't
        // known (and wasn't created inline via the quick-create affordance)
        // blocks confirm, same as a required-and-empty field. Once every ref
        // IS defined, also actually evaluate expressions (§4.5) — a syntax
        // error or non-finite result (divide-by-zero etc.) blocks confirm
        // too, not just an inline hint the user could otherwise ignore.
        // Array/JSON-typed fields (location, dimensions) are checked
        // per-element, not as one whole-field string — a field holding
        // `[0, 0, "${h} / 0"]` is itself valid JSON syntax, so only walking
        // its parsed elements finds the broken expression inside it.
        const mergedParams = { ...parameters, ...pendingParams };
        Object.entries(values).forEach(([path, raw]) => {
            if (typeof raw !== 'string') return;
            const hasBadCandidate = candidateStringsForField(raw).some((candidate) => {
                const bareName = extractParamName(candidate);
                const isExpression = bareName === null && looksLikeExpression(candidate);
                const names = bareName !== null ? [bareName] : (isExpression ? collectParamNames(candidate) : []);
                if (names.length === 0) return false;
                const hasUndefined = names.some((n) => !(n in mergedParams));
                if (hasUndefined) return true;
                if (isExpression) {
                    try { evaluateExpression(candidate, mergedParams); } catch { return true; }
                }
                return false;
            });
            if (hasBadCandidate) invalid.add(path);
        });

        setInvalidPaths(invalid);
        if (!tool) return false;
        return invalid.size === 0;
    };

    const createParam = (name) => {
        setPendingParams((prev) => (name in prev ? prev : { ...prev, [name]: '' }));
        setInvalidPaths((prev) => {
            if (prev.size === 0) return prev;
            // Re-validation on next validate() call will clear stale entries;
            // eagerly drop paths whose token now resolves via pendingParams.
            return prev;
        });
    };

    useEffect(() => {
        if (onReady) onReady({ getArgs, validate, tool, pendingParams });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values, tool, schemaProps, pendingParams]);

    return (
        <div className="new-command-form">
            <div className="selection-grid">
                <div className="form-group">
                    <label htmlFor="categorySelect">Step 1: Category</label>
                    <select
                        id="categorySelect"
                        className="form-select"
                        value={category}
                        onChange={handleCategoryChange}
                        disabled={lockToolSelection}
                    >
                        <option value="" disabled>Select category...</option>
                        {Object.keys(TOOL_CATEGORIES).map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                        {hasUncategorized && <option value="Uncategorized">Uncategorized</option>}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="toolSelect">Step 2: Tool</label>
                    <select
                        id="toolSelect"
                        className="form-select"
                        value={tool}
                        onChange={handleToolChange}
                        disabled={lockToolSelection || !category}
                    >
                        <option value="" disabled>{category ? 'Select tool...' : 'Select category first...'}</option>
                        {toolList.length === 0 && category && <option disabled>No tools available</option>}
                        {toolList.map((t) => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="tool-args-form">
                {selectedTool && Object.entries(schemaProps).map(([name, prop]) => (
                    <SchemaField
                        key={name}
                        name={name}
                        prop={prop}
                        isRequired={schemaRequired.includes(name)}
                        values={values}
                        onChange={handleFieldChange}
                        invalidPaths={invalidPaths}
                        parameters={parameters}
                        pendingParams={pendingParams}
                        onCreateParam={createParam}
                    />
                ))}
            </div>
        </div>
    );
}
