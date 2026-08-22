// studio/src/components/Modal.jsx

import { useEffect } from 'react';

/**
 * Generic modal shell, ported from session_editor/modal.js + the
 * #modalOverlay markup in index.html. Rendering/visibility and the
 * promise-resolution plumbing live in the useModal hook; this component is
 * the presentational half.
 */
export default function Modal({ state, onConfirm, onCancel, onClose }) {
    useEffect(() => {
        if (!state) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [state, onClose]);

    if (!state) return null;

    const { title, message, content, type, testing } = state;

    return (
        <div className="modal-overlay">
            <div className="modal card glass">
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="btn-icon" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {message && <p>{message}</p>}
                    <div id="modalCustomContent">{content}</div>
                </div>
                {testing && testing.showTesting && (
                    <div className="modal-testing-bar">
                        <div className="bar-label">Iterative Testing</div>
                        <div className="bar-buttons">
                            <button className="btn btn-sm btn-secondary" onClick={testing.onUndo}>Undo</button>
                            <button className="btn btn-sm btn-secondary" onClick={testing.onRedo}>Redo</button>
                            <button className="btn btn-sm btn-primary" disabled={testing.running} onClick={testing.onRun}>
                                {testing.running ? 'Running...' : '▶ Run Current'}
                            </button>
                        </div>
                    </div>
                )}
                <div className="modal-footer">
                    {type !== 'alert' && (
                        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    )}
                    <button className="btn btn-primary" onClick={onConfirm}>
                        {(testing && testing.showTesting && testing.confirmText) || 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
}
