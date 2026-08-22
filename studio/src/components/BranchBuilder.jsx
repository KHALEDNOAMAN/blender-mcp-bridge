// studio/src/components/BranchBuilder.jsx

import { useEffect, useState } from 'react';

/**
 * Range-click picker for building a branch's ranges (design doc §5.2).
 * Click a command to mark range start, click another (or the same one) to
 * mark range end, "Add Range" appends [start, end] to the list being built.
 * Rendered inside the generic Modal (see App.jsx handleAddBranch), not part
 * of the main CommandList — kept fully isolated from linear-editing state.
 */
export default function BranchBuilder({ commands, initialName = '', initialRanges = [], onReady }) {
    const [name, setName] = useState(initialName);
    const [ranges, setRanges] = useState(initialRanges);
    const [pendingStart, setPendingStart] = useState(null);

    const handleCardClick = (idx) => {
        if (pendingStart === null) {
            setPendingStart(idx);
        } else {
            const start = Math.min(pendingStart, idx);
            const end = Math.max(pendingStart, idx);
            setRanges((prev) => [...prev, [start, end]]);
            setPendingStart(null);
        }
    };

    const removeRange = (i) => {
        setRanges((prev) => prev.filter((_, idx) => idx !== i));
    };

    const validate = () => name.trim().length > 0 && ranges.length > 0;

    useEffect(() => {
        if (onReady) onReady({ name, ranges, validate });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name, ranges]);

    // Which ranges (already added, or the in-progress pendingStart) cover a given index.
    const rangeIndexFor = (idx) => ranges.findIndex(([s, e]) => idx >= s && idx <= e);

    return (
        <div className="branch-builder">
            <div className="form-group">
                <label htmlFor="branchName">Branch Name</label>
                <input
                    type="text"
                    id="branchName"
                    placeholder="e.g. Feature1 (keychain)"
                    spellCheck={false}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            <div style={{ margin: '0.75rem 0', fontSize: '0.85em', opacity: 0.75 }}>
                {pendingStart === null
                    ? 'Click a command to mark the start of a range.'
                    : `Range start set at #${pendingStart + 1}. Click another command to mark the end.`}
            </div>

            {ranges.length > 0 && (
                <div className="branch-ranges-list" style={{ marginBottom: '0.75rem' }}>
                    {ranges.map(([s, e], i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span className="badge">#{s + 1}–#{e + 1}</span>
                            <button type="button" className="btn-icon" title="Remove range" onClick={() => removeRange(i)}>×</button>
                        </div>
                    ))}
                </div>
            )}

            <div className="branch-command-picker" style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                {commands.map((cmd, idx) => {
                    const inRangeIdx = rangeIndexFor(idx);
                    const isPendingStart = pendingStart === idx;
                    const isSelected = inRangeIdx !== -1 || isPendingStart;
                    return (
                        <div
                            key={idx}
                            onClick={() => handleCardClick(idx)}
                            style={{
                                display: 'flex',
                                gap: '0.5rem',
                                padding: '0.4rem 0.75rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--glass-border)',
                                background: isPendingStart
                                    ? 'rgba(59, 130, 246, 0.25)'
                                    : (inRangeIdx !== -1 ? 'rgba(34, 197, 94, 0.15)' : 'transparent'),
                            }}
                        >
                            <span style={{ opacity: 0.6, minWidth: '2.5em' }}>#{idx + 1}</span>
                            <span className="tool-name">{cmd.tool}</span>
                            {isSelected && <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{isPendingStart ? 'start' : 'in range'}</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
