//session_editor/ui.js

function stringifyCompact(obj) {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/\[\s+([^\[\{\]]+)\s+\]/g, (match, p1) => {
        return "[" + p1.replace(/\s+/g, ' ').trim() + "]";
    });
}

function updateTextareaHeight(ta) {
    if (!ta.classList.contains('auto-expand')) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
}

function initAutoExpand(ta) {
    ta.addEventListener('input', () => updateTextareaHeight(ta));
    setTimeout(() => updateTextareaHeight(ta), 0);
}

function renderSchemaField(name, prop, parentPath = '', isRequired = false) {
    const fieldPath = parentPath ? parentPath + '.' + name : name;
    const f = document.createElement('div'); f.className = 'arg-field';
    const label = document.createElement('label');
    label.textContent = name;
    if (isRequired) {
        const star = document.createElement('span');
        star.textContent = ' *'; star.style.color = 'var(--danger-color)';
        label.appendChild(star);
    }
    if (prop.description) {
        const span = document.createElement('span');
        span.textContent = ` (${prop.description})`;
        span.style.opacity = '1'; span.style.color = 'var(--accent-color)';
        span.style.fontSize = '0.7rem'; span.style.fontWeight = '700';
        span.style.textTransform = 'none'; label.appendChild(span);
    }
    f.appendChild(label);

    if (prop.type === 'object' && prop.properties) {
        const g = document.createElement('div'); g.className = 'nested-group';
        f.innerHTML = '';
        const t = document.createElement('div'); t.className = 'nested-group-title';
        t.textContent = name + (isRequired ? ' *' : '');
        g.appendChild(t);
        const reqs = prop.required || [];
        Object.entries(prop.properties).forEach(([pN, pP]) => {
            g.appendChild(renderSchemaField(pN, pP, fieldPath, reqs.includes(pN)));
        });
        return g;
    } else if (prop.type === 'array' && prop.items && prop.items.type === 'object') {
        const g = document.createElement('div'); g.className = 'nested-group'; g.dataset.full = "true";
        label.textContent += ' [JSON Array]';
        g.appendChild(label);
        const ta = document.createElement('textarea'); ta.className = 'auto-expand';

        // Generate a helpful placeholder based on sub-properties
        let hint = 'Enter as JSON array of objects...';
        if (prop.items.properties) {
            const keys = Object.keys(prop.items.properties).join(', ');
            hint = `e.g. [{ "${Object.keys(prop.items.properties)[0]}": ... }]\nFields: ${keys}`;
        }
        ta.placeholder = hint;

        ta.name = fieldPath; ta.dataset.type = 'json';
        ta.spellcheck = false;
        if (isRequired) ta.required = true;
        initAutoExpand(ta); g.appendChild(ta); return g;
    }

    let i;
    if (prop.type === 'array') {
        i = document.createElement('textarea'); i.className = 'auto-expand'; i.dataset.full = "true";

        if (prop.items && prop.items.type === 'string') {
            i.placeholder = 'e.g. ["Item1", "Item2"]';
        } else if (prop.items && prop.items.type === 'array') {
            i.placeholder = 'e.g. [[0, 0, 0], [1, 1, 1]]';
        } else {
            i.placeholder = 'e.g. [0, 0, 0]';
        }

        i.dataset.type = 'json';
        i.spellcheck = false;
        if (isRequired) i.required = true;
        initAutoExpand(i); f.dataset.full = "true";
    } else if (prop.enum) {
        i = document.createElement('select'); i.className = 'form-select'; i.dataset.type = 'enum';
        prop.enum.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; i.appendChild(o); });
    } else if (prop.type === 'boolean') {
        i = document.createElement('select'); i.className = 'form-select'; i.dataset.type = 'boolean';
        const oT = document.createElement('option'); oT.value = 'true'; oT.textContent = 'true';
        const oF = document.createElement('option'); oF.value = 'false'; oF.textContent = 'false';
        i.appendChild(oT); i.appendChild(oF);
        if (prop.default !== undefined) i.value = prop.default.toString();
    } else {
        i = document.createElement('input');
        i.type = (prop.type === 'number' || prop.type === 'integer') ? 'number' : 'text';
        if (prop.default !== undefined) i.value = prop.default;
        i.dataset.type = prop.type;
        i.spellcheck = false;
        if (isRequired) i.required = true;
    }
    i.name = fieldPath; f.appendChild(i); return f;
}

function collapseAllCards() {
    document.querySelectorAll('.command-card').forEach(c => c.classList.remove('expanded', 'active-card'));
}

function expandCard(card) {
    collapseAllCards();
    card.classList.add('expanded', 'active-card');
}

/**
 * Scroll the command list so the card's header is visible.
 * Waits for the accordion's max-height transition to finish before scrolling.
 */
function scrollToCard(card) {
    const content = card.querySelector('.accordion-content');
    const commandList = document.getElementById('commandList');

    function doScroll() {
        commandList.scrollTo({ top: card.offsetTop - 8, behavior: 'smooth' });
    }

    function onDone(e) {
        if (e.propertyName !== 'max-height') return;
        content.removeEventListener('transitionend', onDone);
        doScroll();
    }

    content.addEventListener('transitionend', onDone);
    // Fallback: if already expanded (no transition fires), scroll immediately
    setTimeout(() => {
        content.removeEventListener('transitionend', onDone);
        doScroll();
    }, 400);
}


function addToolTestingListeners(content, catSelect, toolSelect, toolArgsForm) {
    catSelect.addEventListener('change', () => {
        toolSelect.innerHTML = '<option value="" disabled selected>Select tool...</option>'; toolSelect.disabled = false;
        let list = [];
        if (catSelect.value === 'Uncategorized') {
            list = availableTools.filter(at => !Object.values(TOOL_CATEGORIES).flat().includes(at.name) && !HIDDEN_TOOLS.includes(at.name));
        } else {
            const names = TOOL_CATEGORIES[catSelect.value] || [];
            // Allow showing tools even if availableTools is empty (fallback to basic info)
            list = names.map(n => {
                const tool = availableTools.find(at => at.name === n);
                return tool || { name: n, inputSchema: { properties: {} } };
            });
        }
        if (list.length === 0) {
            const o = document.createElement('option'); o.disabled = true; o.textContent = "No tools available"; toolSelect.appendChild(o);
        } else {
            list.forEach(t => {
                const o = document.createElement('option');
                o.value = t.name; o.textContent = t.name;
                toolSelect.appendChild(o);
            });
        }
        toolArgsForm.innerHTML = '';
    });
    toolSelect.addEventListener('change', () => {
        const tool = availableTools.find(t => t.name === toolSelect.value) || { name: toolSelect.value, inputSchema: { properties: {} } };
        toolArgsForm.innerHTML = '';
        if (tool && tool.inputSchema && tool.inputSchema.properties) {
            const reqs = tool.inputSchema.required || [];
            Object.entries(tool.inputSchema.properties).forEach(([name, prop]) => {
                toolArgsForm.appendChild(renderSchemaField(name, prop, '', reqs.includes(name)));
            });
        }
    });
}
