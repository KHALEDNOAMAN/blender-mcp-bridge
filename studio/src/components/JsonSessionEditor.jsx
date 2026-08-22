// studio/src/components/JsonSessionEditor.jsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorState, StateEffect } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { validateSessionShape } from '../lib/sessionValidation';
import { findExpressionProblems } from '../lib/jsonExprLinter';
import ParametersPanel from './ParametersPanel';

// A no-op-to-the-document StateEffect used purely as a signal: dispatching
// it (with an empty change) gives the lint plugin's needsRefresh() a real
// transaction to react to, so the parametric-expression linter re-runs
// against the current parametersRef even though the document text itself
// didn't change. forceLinting() from @codemirror/lint was tried first and
// doesn't work for this — it only fast-forwards an ALREADY-scheduled lint
// (this.set === true internally); if no lint is pending (the common case,
// since the doc hasn't changed), it's a silent no-op.
const paramsChangedEffect = StateEffect.define();

/**
 * Whole-session JSON editor — the "JSON" side of the Guided/JSON toggle.
 * See docs/studio_design_v1.md §6, §6.4, §6.5, §6.6. Explicit-apply, not
 * live two-way binding (§6.2): the editor is seeded once on mount from the
 * session snapshot passed in; edits stay local until "Apply JSON" parses +
 * validates (§6.3) and hands the parsed session back to the caller.
 *
 * CodeMirror 6 (§6.4), not a hand-rolled textarea: gets real syntax
 * highlighting, line numbers, bracket matching, and live inline lint
 * squiggles for free.
 *
 * Two lint sources share one gutter (§6.5): plain JSON syntax (jsonParseLinter)
 * and parametric ${...} expressions (expressionLinter, scoped to
 * commands[].arguments only — NOT metadata/description text, see
 * jsonExprLinter.js for the false-positive bug this fixes). Session-schema
 * shape checks (branch range bounds etc.) stay a separate Apply-time check
 * via `validateSessionShape`.
 *
 * §6.6: the expression linter checks against the LIVE `parameters` prop
 * (via `liveParametersRef`, always current without needing an editor
 * re-create on every keystroke elsewhere), not whatever's currently typed
 * in the pending JSON text's own "parameters" key — editing a parameter in
 * the docked ParametersPanel here takes effect immediately, same as Guided
 * mode always has, independent of the JSON textarea's own pending edits.
 */

// Reports JSON.parse's SyntaxError as a lint diagnostic, since
// @codemirror/lang-json ships a parser (lezer) but no built-in linter of
// its own — this glues plain JSON.parse into CodeMirror's lint UI.
function jsonParseLinter() {
    return linter((view) => {
        const text = view.state.doc.toString();
        try {
            JSON.parse(text);
            return [];
        } catch (err) {
            const match = /position (\d+)/.exec(err.message);
            const pos = match ? Math.min(Number(match[1]), text.length) : 0;
            return [{
                from: pos,
                to: Math.min(pos + 1, text.length),
                severity: 'error',
                message: err.message,
            }];
        }
    });
}

// §6.5: flags undefined ${param} refs and broken expressions (syntax error,
// divide-by-zero/non-finite per §4.5) as you type, scoped to
// commands[].arguments only. `parametersRef` is a ref so the live parameter
// store (§6.6, editable in-place, independent of the pending JSON text) is
// always current without needing to rebuild the linter extension itself.
// `needsRefresh` reacts to `paramsChangedEffect` so a parameter edit (which
// doesn't touch the document) still triggers a re-lint.
function expressionLinter(parametersRef) {
    return linter(
        (view) => {
            const text = view.state.doc.toString();
            const problems = findExpressionProblems(text, parametersRef.current);
            return problems.map((p) => ({ ...p, severity: 'error' }));
        },
        {
            needsRefresh: (update) => update.transactions.some((tr) => tr.effects.some((e) => e.is(paramsChangedEffect))),
        }
    );
}

function buildExtensions(theme, parametersRef, onDocChanged) {
    const themeExtension = theme === 'dark-theme' ? githubDark : githubLight;
    return [
        lintGutter(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        json(),
        jsonParseLinter(),
        expressionLinter(parametersRef),
        themeExtension,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
            if (update.docChanged) onDocChanged(update.state.doc.toString());
        }),
    ];
}

export default function JsonSessionEditor({
    session, onApply, onDiscard, theme, parameters, parameterUi, onParametersChange,
    sidebarWidth, isSidebarDragging, onSidebarPointerDown,
}) {
    const initialText = useMemo(
        () => JSON.stringify(session || { metadata: {}, commands: [] }, null, 2),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [] // seeded once on mount only, per §6.2 explicit-apply model
    );

    const [errors, setErrors] = useState([]);
    const [paramsCollapsed, setParamsCollapsed] = useState(() => localStorage.getItem('jsonParametersCollapsed') === 'true');
    const toggleParamsCollapsed = () => setParamsCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('jsonParametersCollapsed', next);
        return next;
    });
    const editorHostRef = useRef(null);
    const viewRef = useRef(null);
    const textRef = useRef(initialText);
    const parametersRef = useRef(parameters || {});
    parametersRef.current = parameters || {};

    // Outline (§6.1 unchanged visually): best-effort scan for `"tool": "..."`
    // lines. Still a text scan, not a parse, so it keeps working on
    // currently-invalid/mid-edit JSON — recomputed from the live doc text.
    const [outline, setOutline] = useState(() => scanOutline(initialText));

    const handleDocChanged = (text) => {
        textRef.current = text;
        setOutline(scanOutline(text));
    };

    const forceRelint = () => {
        const view = viewRef.current;
        if (!view) return;
        // parametersRef already has the new value by the time this fires
        // (updated synchronously above) — dispatch a no-op-to-the-document
        // transaction carrying paramsChangedEffect so expressionLinter's
        // needsRefresh sees a real transaction to react to and re-runs
        // against the fresh ref, even though the doc text itself is unchanged.
        view.dispatch({ effects: paramsChangedEffect.of(null) });
    };

    useEffect(() => {
        const state = EditorState.create({
            doc: initialText,
            extensions: buildExtensions(theme, parametersRef, handleDocChanged),
        });

        const view = new EditorView({ state, parent: editorHostRef.current });
        viewRef.current = view;

        return () => view.destroy();
        // Theme changes are handled by the separate effect below — this
        // effect only (re)creates the editor once, on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Swap the theme extension live if the user toggles dark/light while
    // JSON mode is open, without losing document state/undo history.
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        // CodeMirror requires a Compartment to reconfigure a single
        // extension slot cleanly; a full state re-create (reusing the
        // current doc) is simpler and cheap enough for a session-sized doc.
        const newState = EditorState.create({
            doc: view.state.doc,
            extensions: buildExtensions(theme, parametersRef, handleDocChanged),
        });
        view.setState(newState);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme]);

    // Re-lint whenever the live parameter store changes (§6.6) — a param
    // added/fixed in the docked panel should clear a squiggle immediately,
    // not only on the next keystroke in the editor itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(forceRelint, [parameters]);

    const jumpToLine = (lineNumber1Based) => {
        const view = viewRef.current;
        if (!view) return;
        const line = view.state.doc.line(Math.min(lineNumber1Based, view.state.doc.lines));
        view.dispatch({
            selection: { anchor: line.from, head: line.to },
            effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
        });
        view.focus();
    };

    const handleApply = () => {
        const text = textRef.current;
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (err) {
            setErrors([`JSON syntax error: ${err.message}`]);
            return;
        }
        const shapeErrors = validateSessionShape(parsed);
        if (shapeErrors.length > 0) {
            setErrors(shapeErrors);
            return;
        }
        // §6.9: reuse the same live-lint check (§6.5) at Apply time — the
        // gutter already shows these as squiggles, but Apply itself never
        // consulted them before, so a session with an undefined ${param}
        // reference (e.g. from deleting a parameter the arguments still use)
        // could be applied anyway. Hard-blocks, same as shape errors, not a
        // warn-and-allow confirm — that would just be one accidental click
        // away from the exact bug this was.
        const exprProblems = findExpressionProblems(text, parametersRef.current);
        if (exprProblems.length > 0) {
            // Dedupe: the same undefined param is commonly referenced by
            // multiple fields on one command (e.g. both location and
            // dimensions), which would otherwise repeat an identical
            // message once per occurrence.
            setErrors([...new Set(exprProblems.map((p) => p.message))]);
            return;
        }
        setErrors([]);
        onApply(parsed);
    };

    return (
        <div className="json-session-editor-container">
            <div className="json-session-editor-header">
                <p>Edit the whole session as JSON. Changes only take effect after Apply.</p>
                <div className="json-session-editor-actions">
                    <button className="btn btn-secondary btn-sm" onClick={onDiscard}>Discard</button>
                    <button className="btn btn-primary btn-sm" onClick={handleApply}>Apply JSON</button>
                </div>
            </div>
            {errors.length > 0 && (
                <div className="json-session-editor-errors">
                    {errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
            )}
            <div className="json-session-editor-body">
                <div className="json-editor-sidebar" style={{ flexBasis: sidebarWidth }}>
                    <div className="json-outline">
                        <div className="json-outline-title">Commands ({outline.length})</div>
                        {outline.length === 0 && (
                            <p className="json-outline-empty">No commands found.</p>
                        )}
                        {outline.map((entry, i) => (
                            <button
                                key={i}
                                type="button"
                                className="json-outline-item"
                                onClick={() => jumpToLine(entry.line + 1)}
                                title={`Jump to line ${entry.line + 1}`}
                            >
                                <span className="json-outline-index">#{i + 1}</span>
                                <span className="json-outline-tool">{entry.tool}</span>
                            </button>
                        ))}
                    </div>
                    <ParametersPanel
                        parameters={parameters || {}}
                        collapsed={paramsCollapsed}
                        onToggle={toggleParamsCollapsed}
                        parameterUi={parameterUi}
                        onChange={onParametersChange}
                    />
                </div>
                <div
                    className={`sidebar-resize-handle${isSidebarDragging ? ' dragging' : ''}`}
                    onPointerDown={onSidebarPointerDown}
                    title="Drag to resize"
                />
                <div ref={editorHostRef} className="json-codemirror-host" />
            </div>
        </div>
    );
}

function scanOutline(text) {
    const lines = text.split('\n');
    const entries = [];
    const toolRe = /"tool":\s*"([^"]+)"/;
    lines.forEach((line, i) => {
        const m = line.match(toolRe);
        if (m) entries.push({ line: i, tool: m[1] });
    });
    return entries;
}
