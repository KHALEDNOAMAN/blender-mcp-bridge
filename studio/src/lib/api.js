// studio/src/lib/api.js

// Faithful port of the MCP JSON-RPC client, including response-unwrapping edge cases.

// The bridge's root route (src/server.py `root_redirect`) always returns this
// exact plain-text body. Used to confirm the same-origin fallback below is
// actually talking to the bridge, not some other server that happens to
// return 200 for `/` — e.g. a static host like GitHub Pages, where Studio's
// own index.html satisfies `resp.ok` and previously produced a false-positive
// "Connected" state with no bridge behind it (surfaced as "Connected (null)"
// in the UI, since there's no real port to report).
const BRIDGE_ROOT_MARKER = 'Blender MCP Server is running';

/**
 * Try ports 8008 then 8000 explicitly, then fall back to same-origin.
 * Returns { ok, apiBase, port } — the caller decides how to reflect this
 * in UI state (React state instead of direct DOM writes).
 *
 * Always probes explicit localhost ports first: when Studio is served from
 * its own origin (Vite dev server, or any static host), same-origin would
 * silently resolve to Studio's own port instead of the MCP bridge's.
 */
export async function checkConnection() {
    const ports = [8008, 8000];
    for (const port of ports) {
        const testBase = `http://localhost:${port}`;
        try {
            const resp = await fetch(testBase + '/', { method: 'GET' });
            if (resp.ok) {
                return { ok: true, apiBase: testBase, port };
            }
        } catch (err) { /* try next port */ }
    }

    // Fallback: same-origin (covers the case where Studio is mounted
    // directly on the bridge itself, e.g. /editor-style deployment). Body
    // is checked against BRIDGE_ROOT_MARKER, not just HTTP 200 — a static
    // host serving Studio's own index.html at `/` is also a 200, but isn't
    // the bridge.
    try {
        const resp = await fetch(window.location.origin + '/', { method: 'GET' });
        if (resp.ok) {
            const text = await resp.text();
            if (text.includes(BRIDGE_ROOT_MARKER)) {
                return { ok: true, apiBase: window.location.origin, port: null };
            }
        }
    } catch (err) { /* fall through */ }

    return { ok: false, apiBase: null, port: null };
}

export async function fetchTools(apiBase) {
    try {
        const resp = await fetch(apiBase + '/mcp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/list',
                params: {},
                id: 'list-tools'
            })
        });
        const data = await resp.json();
        if (data.result && data.result.tools) {
            return data.result.tools;
        }
    } catch (err) {
        console.error('Error fetching tools:', err);
    }
    return null;
}

export async function runCommand(apiBase, tool, args) {
    try {
        console.log(`[JS] Calling tool: ${tool}`, args);
        const response = await fetch(apiBase + '/mcp/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: { name: tool, arguments: args },
                id: Math.random().toString(36).substring(7)
            })
        });

        const text = await response.text();
        console.log(`[JS] Server Response (${response.status}):`, text);

        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${text || 'Unknown error'}` };
        }

        let data;
        try { data = JSON.parse(text); }
        catch (e) { return { error: `Invalid JSON from server: ${text.substring(0, 100)}...` }; }

        if (data.error) return { error: data.error.message || JSON.stringify(data.error) };

        if (data.result && data.result.isError) {
            const errorMsg = data.result.content && data.result.content[0] ? data.result.content[0].text : 'Tool execution failed';
            return { error: errorMsg };
        }

        if (data.result && data.result.content) {
            try {
                const parsed = JSON.parse(data.result.content[0].text);
                if (parsed.status === 'error') return { error: parsed.message || 'Unknown server error' };
                return parsed;
            }
            catch { return { result: data.result.content[0].text }; }
        }
        if (data.result && data.result.status === 'error') return { error: data.result.message || 'Unknown error' };
        return data.result || data;
    } catch (err) {
        console.error('[JS] Fetch Error:', err);
        return { error: err.message };
    }
}
