// studio/src/hooks/useConnection.js

import { useEffect, useRef, useState } from 'react';
import { checkConnection, fetchTools } from '../lib/api';
import { API_BASE_DEFAULT } from '../lib/toolCategories';
import { DEMO_TOOLS } from '../lib/demoTools';
import { CONTROL_TOOLS } from '../lib/controlTools';

// Client-side control-flow constructs (for_each) are not in the bridge's
// tools/list nor the demo snapshot, but must appear in the tool catalog so
// the schema-driven forms can render and edit them. Merged here — the single
// place every consumer of availableTools reads from — rather than at each
// call site, so live and demo mode behave identically.
const withControlTools = (tools) => [...CONTROL_TOOLS, ...tools];

/**
 * Ported from session_editor/api.js polling behavior
 * (setInterval(checkConnection, 5000) + checkConnection()).
 *
 * §9: `demoMode` is a separate, user-opted-into state from `connected` —
 * going offline never silently switches behavior. It's exposed here (not
 * derived ad-hoc in App.jsx) because it also needs to widen `availableTools`
 * so "+ New Command" and Edit Command still work with a full tool list while
 * disconnected, the same way they do live.
 */
export function useConnection() {
    const [apiBase, setApiBase] = useState(API_BASE_DEFAULT);
    const [connected, setConnected] = useState(false);
    const [errored, setErrored] = useState(false);
    const [label, setLabel] = useState('Disconnected');
    const [availableTools, setAvailableTools] = useState([]);
    const [demoMode, setDemoMode] = useState(false);
    const apiBaseRef = useRef(apiBase);
    apiBaseRef.current = apiBase;

    const poll = async () => {
        const res = await checkConnection();
        if (res.ok) {
            setApiBase(res.apiBase);
            setConnected(true);
            setErrored(false);
            setLabel(res.port ? `Connected (${res.port})` : 'Connected');
            setDemoMode(false);
            const tools = await fetchTools(res.apiBase);
            if (tools) setAvailableTools(withControlTools(tools));
        } else {
            setConnected(false);
            setErrored(true);
            setLabel('Offline');
        }
    };

    useEffect(() => {
        poll();
        const id = setInterval(poll, 5000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refetchTools = async () => {
        const tools = await fetchTools(apiBaseRef.current);
        if (tools) setAvailableTools(withControlTools(tools));
        return tools;
    };

    // Demo mode has no bridge to ask for a tool list, so it ships a static
    // one (lib/demoTools.js, extracted from a live bridge) — good enough to
    // browse/add commands and see real schema-driven forms while simulating
    // playback.
    const enterDemoMode = () => {
        setDemoMode(true);
        setAvailableTools(withControlTools(DEMO_TOOLS));
    };
    const exitDemoMode = () => {
        setDemoMode(false);
        setAvailableTools([]);
    };

    return {
        apiBase,
        connectionStatus: { connected, error: errored, label },
        availableTools,
        refetchTools,
        demoMode,
        enterDemoMode,
        exitDemoMode,
    };
}
