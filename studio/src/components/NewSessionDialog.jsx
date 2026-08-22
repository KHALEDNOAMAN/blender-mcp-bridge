// studio/src/components/NewSessionDialog.jsx

import { useState } from 'react';

/**
 * Ported from app.js newSessionBtn handler's customContent template.
 */
export default function NewSessionDialog({ innerRef }) {
    const [template, setTemplate] = useState('blank');
    if (innerRef) innerRef.current = template;
    return (
        <div className="new-session-dialog">
            <div className="form-group" style={{ marginTop: '1rem' }}>
                <label htmlFor="templateSelect">Choose a Template</label>
                <select
                    id="templateSelect"
                    className="form-select"
                    style={{ width: '100%', padding: '0.8rem', background: 'var(--input-bg)', border: '1px solid var(--glass-border)', borderRadius: 6, color: 'var(--text-primary)', marginTop: '0.5rem' }}
                    value={template}
                    onChange={(e) => { setTemplate(e.target.value); if (innerRef) innerRef.current = e.target.value; }}
                >
                    <option value="blank">Blank Session (Start from Scratch)</option>
                    <option value="3d_print">3D Printing Template (Sets units to mm, scale to 0.001)</option>
                    <option value="stl_edit">STL Edit Template (Set units &amp; Import STL)</option>
                </select>
            </div>
        </div>
    );
}
