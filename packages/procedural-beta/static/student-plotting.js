const prefix = 'ats-simbox-student-estimates-v1:';
const maxPlots = 24;
export function validateStudentPlots(value) {
    if (!Array.isArray(value) || value.length > maxPlots) throw new Error('Up to 24 estimate dots are supported.');
    const ids = new Set(), names = new Set();
    return value.map(p => {
        if (!p || typeof p.id !== 'string' || p.id.length > 80 || !p.id || ids.has(p.id)) throw new Error('Estimate dot identity is invalid.');
        const callsign = String(p.callsign || '').trim().toUpperCase();
        if (!callsign || callsign.length > 24 || callsign.includes('\0') || names.has(callsign)) throw new Error('Estimate callsigns must be unique and fit within 24 characters.');
        if (![p.xNm, p.yNm].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 2000)) throw new Error('Estimate position must be within ±2,000 NM.');
        ids.add(p.id); names.add(callsign);
        return { id: p.id, callsign, xNm: p.xNm, yNm: p.yNm };
    });
}
function element(tag, text = '', className = '') { const e = document.createElement(tag); e.textContent = text; e.className = className; return e; }
function button(text, action) { const b = element('button', text); b.type = 'button'; b.addEventListener('click', action); return b; }
export function createStudentPlotting(host) {
    const toolbar = element('section', '', 'student-plotting'); toolbar.id = 'student-plotting'; toolbar.setAttribute('aria-label', 'Your manual estimate dots');
    const label = element('label', 'Callsign'), name = element('input'); name.id = 'estimate-callsign'; name.maxLength = 24; name.value = '101'; name.placeholder = '101'; name.autocomplete = 'off'; label.append(name);
    const select = element('select'); select.id = 'estimate-select'; select.setAttribute('aria-label', 'Select your estimate dot');
    const status = element('p', 'Your estimates only · drag dots to update.', 'student-plotting-status'); status.id = 'estimate-status'; status.setAttribute('role', 'status');
    let plots = [], loadedKey = '', chosen = '', adding = false, dragging = '', dragPointer = null, enabled = true;
    const key = () => { const value = typeof host.sessionKey === 'function' ? host.sessionKey() : host.sessionKey; return value ? prefix + encodeURIComponent(String(value)) : ''; };
    function redraw() { host.requestDraw?.(); }
    function update() {
        select.replaceChildren(new Option(plots.length ? 'Choose estimate…' : 'No estimate dots', ''), ...plots.map(p => new Option(p.callsign, p.id)));
        select.value = chosen;
        const p = plots.find(p => p.id === chosen); if (p) { name.value = p.callsign; east.value = String(Math.round(p.xNm * 100) / 100); north.value = String(Math.round(p.yNm * 100) / 100); }
        add.textContent = adding ? 'Cancel placing' : '+ Add estimate'; add.setAttribute('aria-pressed', String(adding));
        toolbar.dataset.placing = String(adding); rename.disabled = !p; remove.disabled = !p; clear.disabled = !plots.length;
        coordinateMove.textContent = adding ? 'Place estimate' : 'Move selected'; coordinateMove.disabled = !enabled || (!adding && !p);
    }
    function releaseDrag() { const id = dragPointer; dragging = ''; dragPointer = null; if (id != null && host.canvas.hasPointerCapture?.(id)) host.canvas.releasePointerCapture?.(id); }
    function syncSession() {
        const current = key(); if (loadedKey === current) return;
        releaseDrag(); loadedKey = current; chosen = ''; adding = false; plots = [];
        if (current) { try { plots = validateStudentPlots(JSON.parse(localStorage.getItem(current) || '[]')); } catch { status.textContent = 'Previous estimates could not be restored. Add new dots.'; } }
        update();
    }
    function persist() {
        if (!loadedKey) return;
        try { localStorage.setItem(loadedKey, JSON.stringify(plots)); } catch { status.textContent = 'Estimate storage is unavailable. Dots remain for this page only.'; }
    }
    function callsign() { const value = name.value.trim().toUpperCase(); if (!value || value.length > 24 || value.includes('\0')) throw new Error('Enter a callsign of 1–24 characters.'); return value; }
    function nextName() { let value = 101; while (plots.some(p => p.callsign === String(value))) value++; name.value = String(value); }
    const add = button('+ Add estimate', () => { syncSession(); if (!enabled) return; if (adding) { adding = false; status.textContent = 'Placement cancelled.'; update(); redraw(); return; } try { if (!loadedKey) throw new Error('Wait for the exercise to connect.'); if (plots.length >= maxPlots) throw new Error('Maximum 24 estimate dots.'); const value = callsign(); if (plots.some(p => p.callsign === value)) throw new Error('That callsign already has a dot. Select and drag it.'); adding = true; chosen = ''; update(); status.textContent = `Tap the scope to place ${value}.`; redraw(); } catch (e) { status.textContent = e.message; } }); add.id = 'estimate-add';
    const rename = button('Rename', () => { syncSession(); try { const p = plots.find(p => p.id === chosen); if (!p) throw new Error('Select an estimate dot.'); const value = callsign(); if (plots.some(other => other.id !== p.id && other.callsign === value)) throw new Error('That callsign already has a dot.'); p.callsign = value; persist(); update(); redraw(); status.textContent = 'Estimate label updated.'; } catch (e) { status.textContent = e.message; } }); rename.id = 'estimate-rename';
    const remove = button('Delete', () => { syncSession(); plots = plots.filter(p => p.id !== chosen); chosen = ''; persist(); nextName(); update(); redraw(); status.textContent = 'Estimate removed.'; }); remove.id = 'estimate-delete';
    const clear = button('Clear dots', () => { syncSession(); if (!confirm('Clear your manual estimate dots?')) return; plots = []; chosen = ''; adding = false; persist(); nextName(); update(); redraw(); status.textContent = 'Your estimate dots cleared.'; }); clear.id = 'estimate-clear';
    const row = element('div', '', 'student-plotting-controls'); row.append(label, add, select, rename, remove, clear); toolbar.append(row, status);
    const coordinates = element('details', '', 'student-plotting-coordinates'); coordinates.id = 'estimate-coordinate-entry';
    const coordinateSummary = element('summary', 'Place by coordinates'), coordinateRow = element('div', '', 'student-plotting-coordinate-fields');
    const east = element('input'), north = element('input');
    for (const [input, id] of [[east, 'estimate-east'], [north, 'estimate-north']]) { input.id = id; input.type = 'number'; input.min = '-2000'; input.max = '2000'; input.step = '0.01'; input.value = '0'; input.inputMode = 'decimal'; }
    const eastLabel = element('label', 'East / west NM'), northLabel = element('label', 'North / south NM'); eastLabel.append(east); northLabel.append(north);
    const coordinateMove = button('Move selected', () => {
        syncSession(); if (!enabled) return;
        try {
            if (!east.value.trim() || !north.value.trim()) throw new Error('Enter both estimate coordinates.');
            const next = { xNm: Number(east.value), yNm: Number(north.value) };
            if (![next.xNm, next.yNm].every(v => Number.isFinite(v) && Math.abs(v) <= 2000)) throw new Error('Estimate coordinates must be within ±2,000 NM.');
            if (adding) {
                if (!loadedKey || plots.length >= maxPlots) throw new Error('Connect to an exercise with fewer than 24 estimate dots.');
                const plot = { id: crypto.randomUUID(), callsign: callsign(), ...next }; validateStudentPlots([...plots, plot]); plots.push(plot); chosen = plot.id; adding = false;
            } else {
                const p = plots.find(p => p.id === chosen); if (!p) throw new Error('Select an estimate or choose Add estimate.'); Object.assign(p, next);
            }
            persist(); update(); redraw(); status.textContent = `${plots.find(p => p.id === chosen).callsign} estimate placed at ${next.xNm} east, ${next.yNm} north NM.`;
        } catch (error) { status.textContent = error.message; }
    }); coordinateMove.id = 'estimate-coordinate-move';
    coordinateRow.append(eastLabel, northLabel, coordinateMove); coordinates.append(coordinateSummary, element('p', 'Positive: east / north. Negative: west / south. NM from the scope origin.', 'student-plotting-status'), coordinateRow); toolbar.append(coordinates);
    coordinateRow.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target === east || e.target === north)) { e.preventDefault(); coordinateMove.click(); } });
    select.addEventListener('change', () => { syncSession(); chosen = select.value; adding = false; update(); redraw(); });
    function point(e) { const p = host.screenToPoint(e); return { xNm: Number(p?.xNm ?? p?.x ?? p?.[0]), yNm: Number(p?.yNm ?? p?.y ?? p?.[1]) }; }
    function hit(e) {
        const r = host.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        const radius = e.pointerType === 'touch' ? 25 : 15;
        let best = null, distance = radius;
        for (const p of plots) { const projected = host.projectPoint(p.xNm, p.yNm), d = Math.hypot(projected[0] - x, projected[1] - y); if (d < distance) { best = p; distance = d; } }
        return best;
    }
    function pointerDown(e) {
        syncSession(); if (!enabled || e.button !== 0 && e.pointerType !== 'touch') return false;
        if (adding) {
            e.preventDefault();
            try { const p = point(e), value = callsign(); if (plots.some(p => p.callsign === value)) throw new Error('That callsign already has an estimate.'); const plot = { id: crypto.randomUUID(), callsign: value, ...p }; validateStudentPlots([...plots, plot]); plots.push(plot); chosen = plot.id; adding = false; persist(); update(); redraw(); status.textContent = `${value} placed as your estimate. Drag it to update.`; } catch (error) { status.textContent = error.message; }
            return true;
        }
        const p = hit(e); if (!p) return false;
        e.preventDefault(); chosen = p.id; dragging = p.id; dragPointer = e.pointerId; host.canvas.setPointerCapture?.(e.pointerId); update(); redraw(); status.textContent = `Move ${p.callsign} to your estimated position.`; return true;
    }
    function pointerMove(e) {
        syncSession(); if (!enabled || !dragging || dragPointer !== e.pointerId) return false;
        const p = plots.find(p => p.id === dragging), next = point(e); if (p && [next.xNm, next.yNm].every(v => Number.isFinite(v) && Math.abs(v) <= 2000)) Object.assign(p, next); e.preventDefault(); redraw(); return true;
    }
    function pointerUp(e) {
        if (!dragging || dragPointer !== e.pointerId) return false;
        const p = plots.find(p => p.id === dragging); releaseDrag(); persist(); update(); status.textContent = p ? `${p.callsign} estimate updated.` : 'Estimate updated.'; return true;
    }
    function draw(ctx) {
        syncSession(); if (!enabled) return;
        ctx.save(); ctx.lineWidth = 1.5; ctx.font = '600 12px Plex,"IBM Plex Sans",Arial,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        for (const p of plots) {
            const [x, y] = host.projectPoint(p.xNm, p.yNm); ctx.strokeStyle = p.id === chosen ? '#ffce74' : '#d4b1ff'; ctx.fillStyle = '#d4b1ff'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, p.id === chosen ? 11 : 8, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
            const text = `${p.callsign} · EST`, width = ctx.measureText(text).width; ctx.fillStyle = '#0d111ae8'; ctx.fillRect(x + 12, y - 15, width + 8, 20); ctx.fillStyle = p.id === chosen ? '#ffce74' : '#d4b1ff'; ctx.fillText(text, x + 16, y);
        }
        ctx.restore();
    }
    syncSession();
    return { toolbar, mount(container) { container.append(toolbar); }, draw, onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerCancel: pointerUp, isPlacing: () => adding, setEnabled(value) { enabled = Boolean(value); toolbar.hidden = !enabled; if (!enabled) { adding = false; releaseDrag(); } update(); }, estimates: () => plots.map(p => ({ ...p })) };
}
