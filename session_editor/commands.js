//session_editor/commands.js

async function openEditModal(cmd, index) {
    const content = document.getElementById('newCommandTemplate').content.cloneNode(true);
    const catSelect = content.querySelector('#categorySelect');
    const toolSelect = content.querySelector('#toolSelect');
    const toolArgsForm = content.querySelector('#toolArgsForm');

    Object.keys(TOOL_CATEGORIES).forEach(cat => {
        const o = document.createElement('option'); o.value = cat; o.textContent = cat; catSelect.appendChild(o);
    });
    if (availableTools.some(at => !Object.values(TOOL_CATEGORIES).flat().includes(at.name))) {
        const o = document.createElement('option'); o.value = 'Uncategorized'; o.textContent = 'Uncategorized'; catSelect.appendChild(o);
    }

    addToolTestingListeners(content, catSelect, toolSelect, toolArgsForm);

    let currentCat = 'Uncategorized';
    for (const [cat, tools] of Object.entries(TOOL_CATEGORIES)) { if (tools.includes(cmd.tool)) { currentCat = cat; break; } }
    catSelect.value = currentCat; catSelect.dispatchEvent(new Event('change'));
    toolSelect.value = cmd.tool; toolSelect.dispatchEvent(new Event('change'));
    catSelect.disabled = toolSelect.disabled = true;

    const preFill = (args, pPath = '') => {
        Object.entries(args).forEach(([k, v]) => {
            const path = pPath ? `${pPath}.${k}` : k;
            if (v !== null && typeof v === 'object' && !Array.isArray(v)) preFill(v, path);
            else {
                const input = toolArgsForm.querySelector(`[name="${path}"]`);
                if (input) {
                    input.value = (input.dataset.type === 'json') ? stringifyCompact(v) : v;
                    if (input.tagName === 'TEXTAREA') updateTextareaHeight(input);
                }
            }
        });
    };
    setTimeout(() => preFill(cmd.arguments), 0);

    const getArgs = () => {
        const args = {};
        toolArgsForm.querySelectorAll('[name]').forEach(i => {
            let v = i.value; if (v === '') return;
            const type = i.dataset.type;
            if (type === 'number' || type === 'integer') v = parseFloat(v);
            if (type === 'boolean') v = (v === 'true');
            if (type === 'json') { try { v = JSON.parse(v); } catch (e) { return; } }
            const parts = i.name.split('.');
            let target = args;
            for (let j = 0; j < parts.length - 1; j++) { if (!target[parts[j]]) target[parts[j]] = {}; target = target[parts[j]]; }
            target[parts[parts.length - 1]] = v;
        });
        return args;
    };

    const validate = () => {
        const inputs = toolArgsForm.querySelectorAll('[required]');
        for (const input of inputs) { if (!input.value.trim()) { input.style.borderColor = 'var(--danger-color)'; input.focus(); return false; } input.style.borderColor = ''; }
        return true;
    };

    const config = {
        confirmText: 'Apply Changes', showTesting: true,
        onRun: async () => { if (!validate()) return; modal.runBtn.disabled = true; const res = await runCommand(cmd.tool, getArgs()); if (res.error) modal.alert('Failed', res.error); modal.runBtn.disabled = false; },
        onUndo: () => runCommand('undo', {}), onRedo: () => runCommand('redo', {})
    };

    if (await modal.show('Edit Command', `Editing ${cmd.tool}:`, 'action', content, validate, config)) {
        cmd.arguments = getArgs(); renderCommands(index);
    }
}

function renderSession() {
    if (!currentSession) return;
    sessionName.value = currentSession.metadata.name || '';
    sessionModel.value = currentSession.metadata.model || '';
    sessionDescription.value = currentSession.metadata.description || '';
    renderCommands();
}

function renderCommands(expandIdx = 0) {
    const filter = commandFilter.value.toLowerCase();
    commandList.innerHTML = '';
    if (!currentSession || !currentSession.commands) return;
    const filtered = currentSession.commands.filter(c => c.tool.toLowerCase().includes(filter));
    commandCount.textContent = filtered.length;
    if (filtered.length === 0) { commandList.innerHTML = '<div class="empty-state">No matching commands.</div>'; return; }

    filtered.forEach((cmd, idx) => {
        const clone = commandTemplate.content.cloneNode(true);
        const card = clone.querySelector('.command-card');
        card.id = `cmd-${idx}`;
        card.querySelector('.index').textContent = '#' + (idx + 1);

        let displayName = cmd.tool;
        if (cmd.arguments) {
            let identifier = cmd.arguments.name || cmd.arguments.object_name || cmd.arguments.pattern;

            // Handle Destination Collections (with arrow indicator)
            const targetColl = cmd.arguments.target_collection || cmd.arguments.collection;

            // Handle Source Collections
            if (!identifier && cmd.arguments.collection_names) {
                const names = cmd.arguments.collection_names.slice(0, 2);
                identifier = names.join(', ') + (cmd.arguments.collection_names.length > 2 ? '...' : '');
            } else if (!identifier && cmd.arguments.collection_name) {
                identifier = cmd.arguments.collection_name;
            }

            // Append Target Collection if it exists
            if (targetColl) {
                identifier = (identifier ? identifier + " -> " : "-> ") + targetColl;
            }

            if (cmd.tool === 'boolean_operation' && cmd.arguments.object_a && cmd.arguments.object_b) {
                identifier = `${cmd.arguments.object_a}, ${cmd.arguments.object_b}`;
            }
            if (identifier) displayName += ` <span style="opacity: 0.6; font-size: 0.85em;">(${identifier})</span>`;
        }
        card.querySelector('.tool-name').innerHTML = displayName;
        card.querySelector('.command-header').addEventListener('click', (e) => { if (!e.target.closest('.command-actions')) expandCard(card); });

        const btn = card.querySelector('.run-cmd');
        btn.addEventListener('click', async () => {
            btn.disabled = true; card.style.borderColor = 'var(--accent-color)'; btn.style.color = ''; btn.style.backgroundColor = '';
            const cmd = currentSession.commands[idx];
            const res = await runCommand(cmd.tool, cmd.arguments);
            if (res.error) {
                cmd.execution_status = 'error';
                card.style.borderColor = 'var(--danger-color)';
                btn.textContent = '✗ Error';
                btn.style.color = '#fff';
                btn.style.backgroundColor = 'var(--danger-color)';
                btn.style.borderColor = 'var(--danger-color)';
                modal.alert('Execution Error', res.error);
            } else {
                cmd.execution_status = 'success';
                card.style.borderColor = 'var(--success-color)';
                card.classList.add('cmd-executed');
                btn.textContent = '✓ Done';
                btn.style.color = '';
                btn.style.backgroundColor = '';
                btn.style.borderColor = '';
                const nextCard = card.nextElementSibling;
                if (nextCard) {
                    expandCard(nextCard);
                    scrollToCard(nextCard);
                }

                else { expandCard(card); } // last command — keep it expanded & marked active
                updatePlaybackButtonsState();
            }
        });

        card.querySelector('.cmd-description').value = cmd.description || '';
        card.querySelector('.cmd-description').addEventListener('input', (e) => cmd.description = e.target.value);
        initAutoExpand(card.querySelector('.cmd-description'));

        const args = card.querySelector('.args-editor');
        args.value = stringifyCompact(cmd.arguments);
        args.addEventListener('input', (e) => { try { cmd.arguments = JSON.parse(e.target.value); args.style.color = ''; updateTextareaHeight(args); } catch (e) { args.style.color = 'var(--danger-color)'; } });
        initAutoExpand(args);

        card.querySelector('.edit-cmd').addEventListener('click', (e) => { e.stopPropagation(); openEditModal(cmd, idx); });
        card.querySelector('.delete-cmd').addEventListener('click', async () => {
            const displayName = cmd.arguments && cmd.arguments.name ? `${cmd.tool} (${cmd.arguments.name})` : cmd.tool;
            if (await modal.confirm('Delete Command', `Are you sure you want to delete ${displayName}?`)) {
                const i = currentSession.commands.indexOf(cmd);
                if (i !== -1) {
                    currentSession.commands.splice(i, 1);
                    renderCommands();
                }
            }
        });
        card.querySelector('.move-up').addEventListener('click', () => {
            const i = currentSession.commands.indexOf(cmd);
            if (i > 0) {
                [currentSession.commands[i], currentSession.commands[i - 1]] = [currentSession.commands[i - 1], currentSession.commands[i]];
                renderCommands(i - 1);
            }
        });
        card.querySelector('.move-down').addEventListener('click', () => {
            const i = currentSession.commands.indexOf(cmd);
            if (i < currentSession.commands.length - 1) {
                [currentSession.commands[i], currentSession.commands[i + 1]] = [currentSession.commands[i + 1], currentSession.commands[i]];
                renderCommands(i + 1);
            }
        });
        const runBtn = card.querySelector('.run-cmd');
        if (cmd.execution_status === 'success') {
            card.style.borderColor = 'var(--success-color)';
            card.classList.add('cmd-executed');
            runBtn.textContent = '✓ Done';
        } else if (cmd.execution_status === 'error') {
            card.style.borderColor = 'var(--danger-color)';
            runBtn.textContent = '✗ Error';
            runBtn.style.color = '#fff';
            runBtn.style.backgroundColor = 'var(--danger-color)';
            runBtn.style.borderColor = 'var(--danger-color)';
        }

        commandList.appendChild(card);
    });
    if (commandList.children.length > 0) {
        const targetCard = commandList.children[Math.min(expandIdx, commandList.children.length - 1)];
        expandCard(targetCard);
        scrollToCard(targetCard);
    }

    updatePlaybackButtonsState();
}
