// studio/src/components/AssistantPanel.jsx

import { useCallback, useEffect, useRef, useState } from 'react';
import AutoExpandTextarea from './AutoExpandTextarea';
import { fetchProviders, streamChat, uploadModel } from '../lib/assistantApi';

// Fallback list when /assistant/providers is unreachable (e.g. older bridge).
const FALLBACK_PROVIDERS = [
    { id: 'anthropic', label: 'Anthropic (Claude)', configured: false, models: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'] },
    { id: 'google', label: 'Google (Gemini)', configured: false, models: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
    { id: 'openrouter', label: 'OpenRouter', configured: false, models: ['anthropic/claude-sonnet-4.5', 'google/gemini-2.5-flash', 'openai/gpt-4.1'] },
];

/**
 * AI Assistant dock: chat with a model that drives Blender through the
 * bridge's tool set. Transcript items:
 *   { kind: 'user' | 'assistant' | 'error', text }
 *   { kind: 'tool', name, args, result, ok }
 */
export default function AssistantPanel({ apiBase, connected, demoMode, onClose }) {
    const [providers, setProviders] = useState(FALLBACK_PROVIDERS);
    const [provider, setProvider] = useState(() => localStorage.getItem('assistantProvider') || 'anthropic');
    const [model, setModel] = useState(() => localStorage.getItem('assistantModel') || '');
    const [apiKey, setApiKey] = useState('');
    const [input, setInput] = useState('');
    const [items, setItems] = useState([]);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    // Custom model id, persisted per provider — survives restarts.
    const [customModel, setCustomModel] = useState('');
    // Drag-resizable panel width, persisted.
    const [width, setWidth] = useState(() => {
        const saved = parseInt(localStorage.getItem('assistantWidth'), 10);
        return Number.isFinite(saved) ? saved : 520;
    });

    const abortRef = useRef(null);
    const fileRef = useRef(null);
    const scrollRef = useRef(null);
    // Chat history sent to the server: [{role, content}] text-only turns.
    const historyRef = useRef([]);

    const activeProvider = providers.find((p) => p.id === provider) || providers[0];
    const models = activeProvider ? activeProvider.models : [];
    const usingCustom = model === '__custom__';
    const effectiveModel = usingCustom && customModel.trim()
        ? customModel.trim()
        : (models.includes(model) ? model : (models[0] || ''));
    // A key typed in the panel always overrides the bridge's env key; when the
    // bridge has no key configured, typing one here is required.
    const bridgeHasKey = !!(activeProvider && activeProvider.configured);
    const usable = connected && !demoMode;

    useEffect(() => {
        if (!apiBase) return;
        fetchProviders(apiBase).then(setProviders).catch(() => { /* keep fallback */ });
    }, [apiBase]);

    // Persist provider/model choices; restore any locally saved key per provider.
    useEffect(() => { localStorage.setItem('assistantProvider', provider); }, [provider]);
    useEffect(() => { if (model) localStorage.setItem('assistantModel', model); }, [model]);
    useEffect(() => { setApiKey(localStorage.getItem(`assistantKey:${provider}`) || ''); }, [provider]);
    useEffect(() => {
        const saved = localStorage.getItem(`assistantCustomModel:${provider}`) || '';
        // A URL is never a model id — discard bad saved values instead of
        // re-showing them (e.g. "https://openrouter.ai/api/v1" pasted by mistake).
        setCustomModel(/^https?:\/\//i.test(saved) ? '' : saved);
    }, [provider]);

    const handleCustomModelChange = (val) => {
        setCustomModel(val);
        localStorage.setItem(`assistantCustomModel:${provider}`, val);
    };

    // Left-edge drag handle: width = distance from pointer to the right edge.
    const handleResizeStart = (e) => {
        e.preventDefault();
        const onMove = (ev) => {
            const w = Math.min(900, Math.max(360, window.innerWidth - 16 - ev.clientX));
            setWidth(w);
        };
        const onUp = (ev) => {
            const w = Math.min(900, Math.max(360, window.innerWidth - 16 - ev.clientX));
            localStorage.setItem('assistantWidth', String(w));
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [items]);

    const pushItem = useCallback((item) => setItems((prev) => [...prev, { ...item, ts: Date.now() }]), []);

    // Export the visible transcript (user/assistant text + tool calls) as Markdown.
    const handleExportMarkdown = () => {
        const lines = [
            '# AI Assistant Session',
            '',
            `- **Date:** ${new Date().toLocaleString()}`,
            `- **Provider:** ${activeProvider ? activeProvider.label : provider}`,
            `- **Model:** ${effectiveModel}`,
            '',
            '---',
            '',
        ];
        for (const item of items) {
            if (item.kind === 'user') {
                lines.push(`## 🧑 User`, '', item.text, '');
            } else if (item.kind === 'assistant') {
                lines.push(`**Assistant:**`, '', item.text, '');
            } else if (item.kind === 'error') {
                lines.push(`> ⚠️ **Error:** ${item.text}`, '');
            } else if (item.kind === 'tool') {
                lines.push(
                    `<details><summary>🔧 <code>${item.name}</code>${item.ok === false ? ' ❌' : ''}</summary>`,
                    '',
                    '```json',
                    JSON.stringify(item.args, null, 2),
                    '```',
                );
                if (item.result !== null && item.result !== undefined) {
                    lines.push('', 'Result:', '', '```json', item.result, '```');
                }
                lines.push('', '</details>', '');
            }
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `assistant_session_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const runTurn = useCallback(async (userText) => {
        historyRef.current = [...historyRef.current, { role: 'user', content: userText }];
        pushItem({ kind: 'user', text: userText });
        setBusy(true);
        const controller = new AbortController();
        abortRef.current = controller;
        let assistantText = '';
        try {
            await streamChat(
                apiBase,
                { provider, model: effectiveModel, apiKey: apiKey || undefined, messages: historyRef.current },
                (ev) => {
                    if (ev.type === 'text') {
                        assistantText += (assistantText ? '\n\n' : '') + ev.text;
                        pushItem({ kind: 'assistant', text: ev.text });
                    } else if (ev.type === 'tool_call') {
                        pushItem({ kind: 'tool', name: ev.name, args: ev.args, result: null, ok: null });
                    } else if (ev.type === 'tool_result') {
                        setItems((prev) => {
                            const next = [...prev];
                            for (let i = next.length - 1; i >= 0; i--) {
                                if (next[i].kind === 'tool' && next[i].name === ev.name && next[i].result === null) {
                                    next[i] = { ...next[i], result: ev.result, ok: ev.ok };
                                    break;
                                }
                            }
                            return next;
                        });
                    } else if (ev.type === 'error') {
                        pushItem({ kind: 'error', text: ev.message });
                    }
                },
                controller.signal,
            );
        } catch (err) {
            if (err.name !== 'AbortError') pushItem({ kind: 'error', text: err.message });
        }
        if (assistantText) {
            historyRef.current = [...historyRef.current, { role: 'assistant', content: assistantText }];
        }
        abortRef.current = null;
        setBusy(false);
    }, [apiBase, provider, effectiveModel, apiKey, pushItem]);

    const handleSend = () => {
        const text = input.trim();
        if (!text || busy) return;
        setInput('');
        runTurn(text);
    };

    const handleStop = () => {
        if (abortRef.current) abortRef.current.abort();
    };

    const handleClear = () => {
        historyRef.current = [];
        setItems([]);
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file || busy) return;
        setUploading(true);
        try {
            const { path } = await uploadModel(apiBase, file);
            setUploading(false);
            runTurn(
                `I've uploaded a model file at "${path}" (relative to the assets directory). ` +
                'Import it into the scene with import_model, then briefly describe the object: its name, dimensions, and anything notable.'
            );
        } catch (err) {
            setUploading(false);
            pushItem({ kind: 'error', text: `Upload failed: ${err.message}` });
        }
    };

    const handleKeyChange = (val) => {
        setApiKey(val);
        localStorage.setItem(`assistantKey:${provider}`, val);
    };

    return (
        <aside className="assistant-panel card glass" style={{ width }}>
            <div
                className="assistant-resize-handle"
                onPointerDown={handleResizeStart}
                title="Drag to resize"
            />
            <div className="assistant-header">
                <h2>🤖 AI Assistant</h2>
                <div className="assistant-header-actions">
                    <button className="btn btn-secondary btn-small" onClick={handleExportMarkdown} disabled={items.length === 0} title="Download this conversation (messages + tool calls) as a Markdown file">💾 MD</button>
                    <button className="btn btn-secondary btn-small" onClick={handleClear} disabled={busy || items.length === 0} title="Clear conversation">Clear</button>
                    <button className="btn btn-secondary btn-small" onClick={onClose} title="Close assistant">✕</button>
                </div>
            </div>

            <div className="assistant-config">
                <select
                    className="form-select"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    disabled={busy}
                    title="Model provider"
                >
                    {providers.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}{p.configured ? '' : ' (no key on bridge)'}</option>
                    ))}
                </select>
                <select
                    className="form-select"
                    value={usingCustom ? '__custom__' : effectiveModel}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={busy}
                    title="Model"
                >
                    {models.map((m) => <option key={m} value={m}>{m}</option>)}
                    <option value="__custom__">
                        {customModel ? `Custom: ${customModel}` : 'Custom model…'}
                    </option>
                </select>
                {usingCustom && (
                    <div className="assistant-field">
                        <label>
                            Model name
                            <span className="assistant-field-hint">
                                {provider === 'openrouter'
                                    ? ' — model id only (not a URL), e.g. tencent/hunyuan-a13b-instruct:free'
                                    : provider === 'google'
                                        ? ' — model id only, e.g. gemini-2.0-flash'
                                        : ' — model id only, e.g. claude-sonnet-5'}
                            </span>
                        </label>
                        <input
                            type="text"
                            className="search-bar assistant-key-input"
                            placeholder={provider === 'openrouter' ? 'e.g. tencent/hunyuan-a13b-instruct:free' : 'e.g. gemini-2.0-flash'}
                            value={customModel}
                            onChange={(e) => handleCustomModelChange(e.target.value)}
                            disabled={busy}
                            title="The model identifier only — not a URL. Saved per provider in this browser."
                        />
                    </div>
                )}
                <div className="assistant-field">
                    <label>
                        API key
                        <span className="assistant-field-hint">
                            {apiKey
                                ? ' — using a key saved in this browser (overrides the bridge)'
                                : bridgeHasKey
                                    ? ' — optional: the bridge already has a key in its environment'
                                    : ' — required: no key configured on the bridge'}
                        </span>
                    </label>
                    <div className="assistant-key-row">
                        <input
                            type="password"
                            className="search-bar assistant-key-input"
                            placeholder={provider === 'openrouter' ? 'sk-or-…' : provider === 'anthropic' ? 'sk-ant-…' : 'AIza…'}
                            value={apiKey}
                            onChange={(e) => handleKeyChange(e.target.value)}
                            disabled={busy}
                            title="Stored only in this browser (localStorage) and sent only to your local bridge. Leave empty to use the key from the bridge's environment (env vars / .env)."
                        />
                        {apiKey && (
                            <button
                                className="btn btn-secondary btn-small"
                                onClick={() => handleKeyChange('')}
                                disabled={busy}
                                title="Forget the key saved in this browser and use the bridge's key instead"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="assistant-transcript" ref={scrollRef}>
                {demoMode && (
                    <div className="assistant-msg error">
                        The AI Assistant is unavailable in Demo Mode — it needs a live
                        Blender bridge and real model APIs. Exit demo mode and connect
                        the bridge to use it.
                    </div>
                )}
                {items.length === 0 && !demoMode && (
                    <div className="assistant-empty">
                        Chat with an AI that can see and edit your Blender scene.
                        <br /><br />
                        Try: load an STL below, then ask <em>"add a keychain loop to this object"</em>.
                    </div>
                )}
                {items.map((item, i) => {
                    if (item.kind === 'tool') {
                        return (
                            <details key={i} className={`assistant-tool${item.ok === false ? ' error' : ''}`}>
                                <summary>
                                    {item.result === null ? '⏳' : item.ok === false ? '❌' : '🔧'} {item.name}
                                </summary>
                                <pre>{JSON.stringify(item.args, null, 2)}</pre>
                                {item.result !== null && <pre className="assistant-tool-result">{item.result}</pre>}
                            </details>
                        );
                    }
                    return (
                        <div key={i} className={`assistant-msg ${item.kind}`}>
                            {item.text}
                        </div>
                    );
                })}
                {busy && <div className="assistant-msg thinking">Working…</div>}
            </div>

            <div className="assistant-input-row">
                <input type="file" accept=".stl,.obj,.fbx" hidden ref={fileRef} onChange={handleUpload} />
                <button
                    className="btn btn-secondary"
                    onClick={() => fileRef.current && fileRef.current.click()}
                    disabled={busy || uploading || !usable}
                    title={usable ? 'Upload an STL/OBJ/FBX and import it into the scene' : 'Requires a live bridge connection'}
                >
                    {uploading ? '⏳' : '📦 Load STL'}
                </button>
                <AutoExpandTextarea
                    className="assistant-input"
                    rows={3}
                    placeholder={demoMode ? 'Unavailable in demo mode' : (connected ? 'Ask the assistant… (Enter to send, Shift+Enter for a new line)' : 'Bridge not connected')}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    disabled={busy || !usable}
                />
                {busy ? (
                    <button className="btn btn-danger" onClick={handleStop}>Stop</button>
                ) : (
                    <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim() || !usable}>Send</button>
                )}
            </div>
        </aside>
    );
}
