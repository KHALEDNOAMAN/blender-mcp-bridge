/**
 * Ported from index.html #metadataSection + app.js metadata field bindings.
 */
export default function MetadataPanel({ session, collapsed, onToggle, onChange }) {
    const metadata = (session && session.metadata) || {};

    return (
        <section id="metadataSection" className={`card glass metadata-collapsible${collapsed ? ' collapsed' : ''}`}>
            <div className="metadata-header" onClick={onToggle} title="Toggle session details">
                <h2>Session Metadata</h2>
                <span className="metadata-chevron">▼</span>
            </div>
            <div className="metadata-body">
                <div className="form-grid">
                    <div className="form-group">
                        <label htmlFor="sessionName">Name</label>
                        <input
                            type="text"
                            id="sessionName"
                            placeholder="Session Name"
                            spellCheck={false}
                            value={metadata.name || ''}
                            onChange={(e) => onChange('name', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="sessionModel">AI Model</label>
                        <input
                            type="text"
                            id="sessionModel"
                            placeholder="e.g. GPT-4o, Claude 3.5 Sonnet"
                            spellCheck={false}
                            value={metadata.model || ''}
                            onChange={(e) => onChange('model', e.target.value)}
                        />
                    </div>
                    <div className="form-group full-width">
                        <label htmlFor="sessionDescription">Description</label>
                        <textarea
                            id="sessionDescription"
                            placeholder="Describe this recording..."
                            spellCheck={false}
                            style={{ minHeight: 150, resize: 'vertical' }}
                            value={metadata.description || ''}
                            onChange={(e) => onChange('description', e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
