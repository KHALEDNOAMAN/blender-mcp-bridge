import { useEffect, useRef, useState } from 'react';
import { checkConnection, fetchTools } from '../lib/api';
import { API_BASE_DEFAULT } from '../lib/toolCategories';

/**
 * Ported from session_editor/api.js polling behavior
 * (setInterval(checkConnection, 5000) + checkConnection()).
 */
export function useConnection() {
    const [apiBase, setApiBase] = useState(API_BASE_DEFAULT);
    const [connected, setConnected] = useState(false);
    const [errored, setErrored] = useState(false);
    const [label, setLabel] = useState('Disconnected');
    const [availableTools, setAvailableTools] = useState([]);
    const apiBaseRef = useRef(apiBase);
    apiBaseRef.current = apiBase;

    const poll = async () => {
        const res = await checkConnection();
        if (res.ok) {
            setApiBase(res.apiBase);
            setConnected(true);
            setErrored(false);
            setLabel(`Connected (${res.port})`);
            const tools = await fetchTools(res.apiBase);
            if (tools) setAvailableTools(tools);
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
        if (tools) setAvailableTools(tools);
        return tools;
    };

    return {
        apiBase,
        connectionStatus: { connected, error: errored, label },
        availableTools,
        refetchTools,
    };
}
