import { useRef } from 'react';
import AutoExpandTextarea from './AutoExpandTextarea';
import { stringifyCompact } from '../lib/uiUtils';

function computeDisplayName(cmd) {
    let displayName = cmd.tool;
    let identifier = null;
    if (cmd.arguments) {
        identifier = cmd.arguments.name || cmd.arguments.object_name || cmd.arguments.pattern;
        const targetColl = cmd.arguments.target_collection || cmd.arguments.collection;

        if (!identifier && cmd.arguments.collection_names) {
            const names = cmd.arguments.collection_names.slice(0, 2);
            identifier = names.join(', ') + (cmd.arguments.collection_names.length > 2 ? '...' : '');
        } else if (!identifier && cmd.arguments.collection_name) {
            identifier = cmd.arguments.collection_name;
        }

        if (targetColl) {
            identifier = (identifier ? identifier + ' -> ' : '-> ') + targetColl;
        }

        if (cmd.tool === 'boolean_operation' && cmd.arguments.object_a && cmd.arguments.object_b) {
            identifier = `${cmd.arguments.object_a}, ${cmd.arguments.object_b}`;
        }
    }
    return { displayName, identifier };
}

/**
 * Ported from session_editor/commands.js renderCommands() (per-card portion)
 * + the #commandTemplate markup in index.html.
 */
export default function CommandCard({
    cmd,
    idx,
    isExpanded,
    isActive,
    onExpand,
    onRun,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    onDescriptionChange,
    onArgumentsChange,
    isRunning,
}) {
    const argsInvalidRef = useRef(false);
    const { displayName, identifier } = computeDisplayName(cmd);

    const executed = cmd.execution_status === 'success';
    const errored = cmd.execution_status === 'error';

    const borderColor = errored ? 'var(--danger-color)' : (executed ? 'var(--success-color)' : (isActive ? undefined : undefined));

    const cardClasses = [
        'command-card glass accordion-item',
        isExpanded ? 'expanded' : '',
        isActive ? 'active-card' : '',
        executed ? 'cmd-executed' : '',
    ].filter(Boolean).join(' ');

    const handleArgsChange = (e) => {
        try {
            const parsed = JSON.parse(e.target.value);
            argsInvalidRef.current = false;
            onArgumentsChange(idx, parsed, e.target.value, false);
        } catch (err) {
            argsInvalidRef.current = true;
            onArgumentsChange(idx, null, e.target.value, true);
        }
    };

    let runLabel = '▶ Run';
    let runStyle = {};
    if (isRunning) {
        runLabel = '▶ Run';
    } else if (errored) {
        runLabel = '✗ Error';
        runStyle = { color: '#fff', backgroundColor: 'var(--danger-color)', borderColor: 'var(--danger-color)' };
    } else if (executed) {
        runLabel = '✓ Done';
    }

    return (
        <div className={cardClasses} id={`cmd-${idx}`} style={borderColor ? { borderColor } : undefined}>
            <div
                className="command-header accordion-header"
                onClick={(e) => { if (!e.target.closest('.command-actions')) onExpand(idx); }}
            >
                <div className="command-info">
                    <span className="index">#{idx + 1}</span>
                    <span className="tool-name">
                        {displayName}
                        {identifier && (
                            <span style={{ opacity: 0.6, fontSize: '0.85em' }}> ({identifier})</span>
                        )}
                    </span>
                </div>
                <div className="command-actions">
                    <button
                        className="btn btn-sm btn-run run-cmd"
                        title="Execute in Blender (Alt+Enter)"
                        disabled={isRunning}
                        style={runStyle}
                        onClick={(e) => { e.stopPropagation(); onRun(idx); }}
                    >
                        {runLabel}
                    </button>
                    <button className="btn-icon edit-cmd" title="Edit Parameters" onClick={(e) => { e.stopPropagation(); onEdit(cmd, idx); }}>⚙️</button>
                    <button className="btn-icon move-up" title="Move up" onClick={(e) => { e.stopPropagation(); onMoveUp(idx); }}>↑</button>
                    <button className="btn-icon move-down" title="Move down" onClick={(e) => { e.stopPropagation(); onMoveDown(idx); }}>↓</button>
                    <button className="btn-icon delete-cmd" title="Remove command" onClick={(e) => { e.stopPropagation(); onDelete(cmd, idx); }}>×</button>
                    <span className="accordion-icon">▼</span>
                </div>
            </div>
            <div className="command-body accordion-content">
                <div className="command-description-section">
                    <label>Description / Reasoning</label>
                    <AutoExpandTextarea
                        className="cmd-description"
                        placeholder="Why was this tool called?"
                        value={cmd.description || ''}
                        onChange={(e) => onDescriptionChange(idx, e.target.value)}
                    />
                </div>
                <div className="editor-container">
                    <label>Arguments (JSON)</label>
                    <div className="args-editor-wrapper">
                        <AutoExpandTextarea
                            className="args-editor"
                            defaultValue={stringifyCompact(cmd.arguments)}
                            key={idx + '-' + (cmd._argsRevision || 0)}
                            onChange={handleArgsChange}
                            style={argsInvalidRef.current ? { color: 'var(--danger-color)' } : undefined}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
