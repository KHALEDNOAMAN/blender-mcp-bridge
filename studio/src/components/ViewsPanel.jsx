// studio/src/components/ViewsPanel.jsx

import { useEffect, useState, useCallback } from 'react';
import { runCommand } from '../lib/api';

// Blender's own numpad bindings, kept as the labels so the mapping is
// obvious to anyone who models: 7=top, 1=front, 3=side, 0=iso.
const VIEW_BUTTONS = [
    { key: 'top', label: 'Top', numpad: '7' },
    { key: 'front', label: 'Front', numpad: '1' },
    { key: 'side', label: 'Side', numpad: '3' },
    { key: 'iso', label: 'Iso', numpad: '0' },
];

/**
 * Shows the images rendered by a session's `views` branch.
 *
 * The bridge serves $BLENDER_ASSETS_DIR/views read-only at /views, and lists
 * them at /views-index. Nothing here knows about a particular session — it
 * just displays whatever has been rendered, so any project with a views
 * branch gets this for free.
 *
 * It can also RENDER them on demand via the generate_views tool, which frames
 * temporary ortho cameras/lights from the scene bounding box and cleans them
 * up. That's the same output the hand-written views branch produced (~29
 * commands of per-project trigonometry), without the branch.
 *
 * Images are cache-busted on refresh: re-rendering writes the SAME filenames,
 * so without a changing query string the browser would keep showing the
 * previous render and the panel would look broken.
 */
export default function ViewsPanel({ apiBase, collapsed, onToggle, embedded = false, sessionName }) {
    const [views, setViews] = useState([]);
    const [error, setError] = useState(null);
    const [stamp, setStamp] = useState(() => Date.now());
    const [zoomed, setZoomed] = useState(null);
    const [busy, setBusy] = useState(null);
    const [genError, setGenError] = useState(null);

    // Images are written to one shared folder and keyed only by this prefix,
    // so without a session name every project would render over the previous
    // one's view_*.png. Gate generation on having a usable name rather than
    // silently producing files that collide.
    const prefix = (sessionName || '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const canGenerate = prefix.length > 0;

    const load = useCallback(async () => {
        if (!apiBase) return;
        try {
            const resp = await fetch(`${apiBase}/views-index`);
            // A bridge started before the /views routes existed answers with a
            // plain-text 404, which would otherwise surface as an opaque
            // "Unexpected token 'N'" JSON parse error. Check the status first
            // and say what to actually do about it.
            if (resp.status === 404) {
                setViews([]);
                setError('stale-bridge');
                return;
            }
            if (!resp.ok) {
                setViews([]);
                setError(`server returned ${resp.status}`);
                return;
            }
            const data = await resp.json();
            setViews(data.views || []);
            setStamp(Date.now());
            setError(null);
        } catch (err) {
            setViews([]);
            setError(err.message);
        }
    }, [apiBase]);

    useEffect(() => { load(); }, [load]);

    /**
     * Render one view (or all four) through generate_views, then reload the
     * index so the new PNG appears. `prefix` is derived from the session name
     * so two projects' views don't overwrite each other in the shared folder.
     */
    const generate = useCallback(async (which) => {
        if (!apiBase || busy || !canGenerate) return;
        setBusy(which.join('+'));
        setGenError(null);
        const res = await runCommand(apiBase, 'generate_views', { views: which, prefix });
        setBusy(null);
        // The bridge reports tool-level failures as {error}, but a Blender-side
        // refusal (no meshes yet) comes back as {success:false, error} inside a
        // 200 — surface both rather than silently showing a stale grid.
        if (res && (res.error || res.success === false)) {
            setGenError(res.error || 'Render failed');
            return;
        }
        await load();
    }, [apiBase, busy, load, prefix, canGenerate]);

    const body = (
        <>
            <div className="views-actions">
                <span className="views-gen-label">Generate:</span>
                {VIEW_BUTTONS.map((v) => (
                    <button
                        key={v.key}
                        className="btn btn-secondary btn-sm"
                        disabled={!!busy || !canGenerate}
                        onClick={(e) => { e.stopPropagation(); generate([v.key]); }}
                        title={canGenerate
                            ? `Render the ${v.label.toLowerCase()} view (Blender numpad ${v.numpad})`
                            : 'Load a session first — images are named after it so projects don\'t overwrite each other'}
                    >{busy === v.key ? '…' : v.label}</button>
                ))}
                <button
                    className="btn btn-primary btn-sm"
                    disabled={!!busy || !canGenerate}
                    onClick={(e) => { e.stopPropagation(); generate(VIEW_BUTTONS.map((v) => v.key)); }}
                    title={canGenerate
                        ? 'Render all four views'
                        : 'Load a session first — images are named after it so projects don\'t overwrite each other'}
                >{busy && busy.includes('+') ? 'Rendering…' : '⚡ All 4'}</button>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); load(); }}
                    title="Re-read the rendered images from disk"
                >↻ Refresh</button>
            </div>

            {genError && <p className="views-empty">Could not render: {genError}</p>}

            {!canGenerate && (
                <p className="views-empty">
                    Load a session to generate views — images are named after it
                    so projects don't overwrite each other.
                </p>
            )}

            {error === 'stale-bridge' && (
                <p className="views-empty">
                    This bridge doesn't serve <code>/views</code> yet — restart it
                    (<code>python -m src.main serve</code>) and hit Refresh.
                </p>
            )}

            {error && error !== 'stale-bridge' && (
                <p className="views-empty">Could not load views: {error}</p>
            )}

            {!error && views.length === 0 && !genError && canGenerate && (
                <p className="views-empty">
                    No rendered views yet. Build the model, then hit
                    <code> ⚡ All 4 </code> above to render them.
                </p>
            )}

            <div className={`views-grid${embedded ? ' views-grid-wide' : ''}`}>
                {views.map((v) => (
                    <figure
                        key={v.name}
                        className="views-item"
                        onClick={() => setZoomed(`${apiBase}${v.url}?t=${stamp}`)}
                        title={`${v.name} — click to enlarge`}
                    >
                        <img src={`${apiBase}${v.url}?t=${stamp}`} alt={v.name} loading="lazy" />
                        <figcaption>{v.name.replace(/\.(png|jpe?g|webp)$/i, '')}</figcaption>
                    </figure>
                ))}
            </div>
        </>
    );

    const lightbox = zoomed && (
        <div className="views-lightbox" onClick={() => setZoomed(null)}>
            <img src={zoomed} alt="" />
        </div>
    );

    // Embedded in the main pane (a tab): no card chrome of its own.
    if (embedded) {
        return (
            <div className="views-embedded">
                {body}
                {lightbox}
            </div>
        );
    }

    return (
        <section className={`card glass metadata-collapsible${collapsed ? ' collapsed' : ''}`}>
            <div className="metadata-header" onClick={onToggle} title="Toggle views">
                <h2>Views <span className="badge">{views.length}</span></h2>
                <span className="metadata-chevron">▼</span>
            </div>
            <div className="metadata-body">{body}</div>
            {lightbox}
        </section>
    );
}
