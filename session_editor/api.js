async function checkConnection() {
    const ports = [8008, 8000];
    for (const port of ports) {
        const testBase = (window.location.protocol === 'file:' || window.location.origin === 'null')
            ? `http://localhost:${port}`
            : window.location.origin;

        try {
            const resp = await fetch(testBase + '/', { method: 'GET' });
            if (resp.ok) {
                API_BASE = testBase;
                connectionStatus.classList.add('connected');
                connectionStatus.classList.remove('error');
                connectionStatus.querySelector('.status-text').textContent = `Connected (${port})`;
                fetchTools();
                return true;
            }
        } catch (err) { }
    }

    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('error');
    connectionStatus.querySelector('.status-text').textContent = 'Offline';
    return false;
}

async function fetchTools() {
    try {
        const resp = await fetch(API_BASE + '/mcp', {
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
            availableTools = data.result.tools;
            addCommandBtn.disabled = false;
            return true;
        }
    } catch (err) {
        console.error('Error fetching tools:', err);
    }
    return false;
}

setInterval(checkConnection, 5000);
checkConnection();

async function runCommand(tool, args) {
    try {
        console.log(`[JS] Calling tool: ${tool}`, args);
        const response = await fetch(API_BASE + '/mcp/', {
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
