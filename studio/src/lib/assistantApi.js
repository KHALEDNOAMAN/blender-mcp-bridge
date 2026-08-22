// studio/src/lib/api.js

// AI Assistant API client — talks to the bridge's /assistant/* endpoints.
// The chat endpoint streams NDJSON events ({type: text|tool_call|tool_result|error|done}).

export async function fetchProviders(apiBase) {
    const resp = await fetch(`${apiBase}/assistant/providers`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.providers || [];
}

/**
 * Run one agent turn. Calls onEvent(event) for each NDJSON event as it
 * arrives. Resolves when the stream ends. Supports AbortSignal.
 */
export async function streamChat(apiBase, { provider, model, apiKey, messages }, onEvent, signal) {
    const resp = await fetch(`${apiBase}/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, api_key: apiKey || undefined, messages }),
        signal,
    });
    if (!resp.ok) {
        let message = `HTTP ${resp.status}`;
        try {
            const err = await resp.json();
            if (err.error) message = err.error;
        } catch { /* keep default */ }
        throw new Error(message);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            try {
                onEvent(JSON.parse(line));
            } catch { /* skip malformed line */ }
        }
    }
}

/** Upload an STL/OBJ/FBX file; returns { path } relative to the assets dir. */
export async function uploadModel(apiBase, file) {
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch(`${apiBase}/assistant/upload`, { method: 'POST', body: form });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
}
