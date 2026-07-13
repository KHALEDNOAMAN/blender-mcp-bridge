import { useMemo, useRef, useState } from 'react';
import { validateSessionShape } from '../lib/sessionValidation';

/**
 * Whole-session JSON editor — the "JSON" side of the Guided/JSON toggle.
 * See docs/studio_design_v1.md §6. Explicit-apply, not live two-way binding
 * (§6.2): the textarea is seeded once on mount from the session snapshot
 * passed in; edits stay local until "Apply JSON" parses + validates (§6.3)
 * and hands the parsed session back to the caller.
 *
 * Layout: a bordered, height-constrained card (matches the rest of Studio's
 * panel language) with a command outline on the left for quick navigation —
 * plain-text JSON has no structure browser otherwise, and a multi-hundred-
 * line session is otherwise unnavigable. The outline is derived from a
 * best-effort line scan (not a full parse, so it still works while the JSON
 * is mid-edit/invalid) that finds each `"tool": "..."` occurrence and its
 * source line number.
 */
export default function JsonSessionEditor({ session, onApply, onDiscard }) {
    const [text, setText] = useState(() => JSON.stringify(session || { metadata: {}, commands: [] }, null, 2));
    const [errors, setErrors] = useState([]);
    const textareaRef = useRef(null);

    // Best-effort outline: scan for `"tool": "name"` lines. Works even on
    // currently-invalid/mid-edit JSON since it's a text scan, not a parse.
    const outline = useMemo(() => {
        const lines = text.split('\n');
        const entries = [];
        const toolRe = /"tool":\s*"([^"]+)"/;
        lines.forEach((line, i) => {
            const m = line.match(toolRe);
            if (m) entries.push({ line: i, tool: m[1] });
        });
        return entries;
    }, [text]);

    const jumpToLine = (lineIndex) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const lines = text.split('\n');
        let charIndex = 0;
        for (let i = 0; i < lineIndex; i++) charIndex += lines[i].length + 1;
        ta.focus();
        ta.setSelectionRange(charIndex, charIndex + lines[lineIndex].length);
        // Scroll the selected line to a comfortable position, not just barely into view.
        const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 18;
        ta.scrollTop = Math.max(0, lineHeight * lineIndex - ta.clientHeight / 3);
    };

    const handleApply = () => {
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
                            onClick={() => jumpToLine(entry.line)}
                            title={`Jump to line ${entry.line + 1}`}
                        >
                            <span className="json-outline-index">#{i + 1}</span>
                            <span className="json-outline-tool">{entry.tool}</span>
                        </button>
                    ))}
                </div>
                <textarea
                    ref={textareaRef}
                    className="json-session-textarea"
                    spellCheck={false}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
            </div>
        </div>
    );
}
