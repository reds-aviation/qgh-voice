const numericFields = [
    { key: 'qteDeg', label: 'Bearing °T', min: 0, max: 360, initial: i => (65 + i * 15) % 360 },
    { key: 'rangeNm', label: 'Range NM', min: 0, max: 2000, initial: i => 25 + i * 2 },
    { key: 'headingDeg', label: 'Heading °T', min: 0, max: 360, initial: i => (225 + i * 15) % 360 },
    { key: 'altitudeFt', label: 'Altitude ft', min: -1500, max: 60000, initial: i => 12000 + i * 1000 },
    { key: 'speedKt', label: 'Speed kt', min: 0, max: 700, initial: () => 240 },
    { key: 'turnRateDegSec', label: 'Turn °/sec', min: 0.1, max: 12, initial: () => 3 },
    { key: 'verticalRateFpm', label: 'Climb/descent ft/min', min: 100, max: 10000, initial: () => 1000 },
    { key: 'spawnTime', label: 'Spawn delay sec', min: 0, max: 604800, initial: () => 0 },
];
function element(tag, className = '', text = '') {
    const result = document.createElement(tag);
    result.className = className;
    result.textContent = text;
    return result;
}
function numberInput(name, min, max, value) {
    const input = element('input');
    input.type = 'number';
    input.name = name;
    input.min = String(min);
    input.max = String(max);
    input.step = 'any';
    input.value = String(value);
    input.required = true;
    return input;
}
export function createTrafficSetup(host) {
    const panel = element('section', 'setup-panel');
    const heading = element('div', 'section-title');
    heading.append(element('h2', '', 'Set up starting traffic'), element('p', '', 'Set your aircraft here first. Airspace can be loaded or edited separately; your traffic entries stay available.'));
    const returnExercise = element('button', 'secondary', 'Return to exercise →');
    returnExercise.id = 'traffic-return-exercise';
    returnExercise.type = 'button';
    returnExercise.hidden = true;
    const returnStatus = element('p', 'hint');
    returnStatus.hidden = true;
    heading.append(returnExercise, returnStatus);
    const form = element('form', 'setup-form');
    form.noValidate = true;
    const settings = element('div', 'setup-settings');
    const addSetting = (label, input) => {
        const wrapper = element('label', 'setup-field');
        wrapper.append(element('span', '', label), input);
        settings.append(wrapper);
    };
    const title = element('input');
    title.name = 'title';
    title.type = 'text';
    title.required = true;
    title.maxLength = 100;
    addSetting('Session title', title);
    const mode = element('select');
    mode.name = 'mode';
    for (const [value, label] of [['area', 'Area control'], ['approach', 'Approach control'], ['aerodrome', 'Aerodrome control']]) {
        const option = element('option', '', label);
        option.value = value;
        mode.append(option);
    }
    addSetting('Exercise family', mode);
    const count = numberInput('aircraftCount', 1, 20, 1);
    count.step = '1';
    addSetting('Aircraft count · 1–20', count);
    const airspaceRow = element('div', 'setup-airspace');
    const airspaceLabel = element('p', 'setup-airspace-label');
    airspaceLabel.setAttribute('aria-live', 'polite');
    const airspaceButton = element('button', 'secondary', 'Prepare airspace');
    airspaceButton.type = 'button';
    airspaceRow.append(airspaceLabel, airspaceButton);
    const roster = element('details', 'roster-editor optional-traffic');
    roster.append(element('summary', 'roster-editor-head', 'Initial aircraft · positions and performance'));
    roster.open = true;
    const navigator = element('label', 'roster-navigator', 'Jump to aircraft');
    const jump = element('select'); jump.setAttribute('aria-label', 'Jump to aircraft in roster'); navigator.append(jump); roster.append(navigator);
    jump.onchange = () => {
        const input = rows[Number(jump.value)]?.inputs.callsign;
        input?.focus({ preventScroll: true }); input?.scrollIntoView({ block: 'center', behavior: 'auto' });
    };
    const phone = window.matchMedia('(max-width: 700px)');
    phone.addEventListener('change', () => syncControls());
    const scroll = element('div', 'roster-scroll');
    const table = element('div', 'roster-table');
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', 'Initial aircraft truth inputs');
    const header = element('div', 'roster-row roster-row--head');
    header.setAttribute('role', 'row');
    const columns = ['Callsign', 'Aircraft type', ...numericFields.map(field => field.label), 'Compass unserviceable'];
    for (const label of columns) {
        const cell = element('span', '', label);
        cell.setAttribute('role', 'columnheader');
        header.append(cell);
    }
    const body = element('div', 'roster-body');
    body.setAttribute('role', 'rowgroup');
    table.append(header, body);
    scroll.append(table);
    roster.append(scroll);
    const error = element('p', 'setup-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    const actions = element('div', 'setup-actions');
    const create = element('button', 'primary', 'Create exercise');
    create.type = 'submit';
    const cancel = element('button', 'secondary', 'Cancel');
    cancel.type = 'button';
    actions.append(create, cancel);
    form.append(settings, airspaceRow, roster, error, actions);
    panel.append(heading, form);
    host.container.replaceChildren(panel);
    host.container.hidden = true;
    const rows = [];
    let visibleCount = 1;
    let initialized = false;
    let isOpen = false;
    let pending = false;
    let epoch = 0;
    let dirty = false;
    const byteLength = (text) => new TextEncoder().encode(text).length;
    function addRow(index) {
        const row = element('div', 'roster-row');
        row.setAttribute('role', 'row');
        row.dataset.aircraftIndex = String(index);
        row.dataset.aircraftNumber = String(index + 1);
        const inputs = {};
        const addCell = (key, label, input) => {
            const cell = element('div', 'roster-cell');
            cell.setAttribute('role', 'cell');
            cell.dataset.label = label;
            input.name = `aircraft-${index + 1}-${key}`;
            input.dataset.field = key;
            input.setAttribute('aria-label', `Aircraft ${index + 1} ${label.toLowerCase()}`);
            inputs[key] = input;
            cell.append(input);
            row.append(cell);
        };
        const callsign = element('input');
        callsign.type = 'text';
        callsign.autocomplete = 'off'; callsign.spellcheck = false; callsign.enterKeyHint = 'next';
        const usedCallsigns = new Set(rows.map(existing => existing.inputs.callsign.value.trim()));
        let number = 101;
        while (usedCallsigns.has(String(number)))
            number++;
        callsign.value = String(number);
        callsign.maxLength = 24;
        callsign.required = true;
        addCell('callsign', 'Callsign', callsign);
        const type = element('input');
        type.type = 'text';
        type.value = 'TRAINER';
        type.maxLength = 24;
        addCell('type', 'Aircraft type', type);
        for (const field of numericFields) {
            addCell(field.key, field.label, numberInput(field.key, field.min, field.max, field.initial(index)));
        }
        const compass = element('input');
        compass.type = 'checkbox';
        addCell('compassUnserviceable', 'Compass unserviceable', compass);
        body.append(row);
        return { element: row, inputs, navigation: {} };
    }
    function syncControls() {
        const canReturn = !!host.returnToExercise && !!host.canReturn?.();
        returnExercise.hidden = returnStatus.hidden = !canReturn;
        returnExercise.disabled = pending;
        returnStatus.textContent = host.view()?.terminated
            ? 'Return to Review. Traffic changes stay as a draft until you create another exercise.'
            : 'Your current exercise is paused. Return to its scope; traffic changes stay as a draft.';
        roster.classList.toggle('roster-editor--cards', visibleCount <= 2 || phone.matches);
        while (rows.length < visibleCount)
            rows.push(addRow(rows.length));
        form.querySelectorAll('input, select, button').forEach(control => {
            control.disabled = pending && control !== cancel;
        });
        rows.forEach((row, index) => {
            row.element.hidden = index >= visibleCount;
            for (const input of Object.values(row.inputs))
                input.disabled = pending || index >= visibleCount;
        });
        const chosen = jump.value;
        jump.replaceChildren(...rows.slice(0, visibleCount).map((row, index) => {
            const option = element('option', '', `${index + 1} · ${row.inputs.callsign.value || 'Aircraft'}`); option.value = String(index); return option;
        }));
        jump.value = chosen && Number(chosen) < visibleCount ? chosen : '0';
        navigator.hidden = visibleCount < 2;
        create.textContent = pending ? 'Creating exercise…' : 'Create exercise';
        form.setAttribute('aria-busy', String(pending));
    }
    function updateCount() {
        const value = Number(count.value);
        if (count.value.trim() && Number.isInteger(value) && value >= 1 && value <= 20) {
            visibleCount = value;
            syncControls();
        }
    }
    function fail(input, message) {
        if (roster.contains(input)) roster.open = true;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        throw new Error(message);
    }
    function readNumber(input, label, min, max) {
        const value = Number(input.value);
        if (!input.value.trim() || !Number.isFinite(value) || value < min || value > max) {
            fail(input, `${label} must be a number from ${min} to ${max}.`);
        }
        return value;
    }
    function readText(input, label, max, required = false) {
        const value = input.value.trim();
        if ((required && !value) || value.includes('\0') || byteLength(value) > max) {
            fail(input, `${label} ${required ? 'is required and ' : ''}must fit within ${max} bytes of text.`);
        }
        return value;
    }
    function payload() {
        const size = readNumber(count, 'Aircraft count', 1, 20);
        if (!Number.isInteger(size))
            fail(count, 'Aircraft count must be a whole number from 1 to 20.');
        updateCount();
        const sessionTitle = readText(title, 'Session title', 100, true);
        if (!['area', 'approach', 'aerodrome'].includes(mode.value))
            fail(mode, 'Choose an exercise family.');
        const environment = {
            runwayHeadingDeg: host.view()?.environment.runwayHeadingDeg ?? 90,
            qnhHpa: host.view()?.environment.qnhHpa ?? 1013.25,
        };
        const currentEnvironment = host.view()?.environment || {};
        const callsigns = new Set();
        const aircraft = rows.slice(0, size).map((row, index) => {
            const prefix = `Aircraft ${index + 1}`;
            const callsign = readText(row.inputs.callsign, `${prefix} callsign`, 24, true).toUpperCase();
            if (byteLength(callsign) > 24)
                fail(row.inputs.callsign, `${prefix} callsign must fit within 24 bytes after capitalisation.`);
            if (callsigns.has(callsign))
                fail(row.inputs.callsign, `${prefix}: callsigns must be unique.`);
            callsigns.add(callsign);
            const values = {};
            for (const field of numericFields) {
                values[field.key] = readNumber(row.inputs[field.key], `${prefix} ${field.label.toLowerCase()}`, field.min, field.max);
            }
            const radians = values.qteDeg * Math.PI / 180;
            const x = (currentEnvironment.stationXNm || 0) + Math.sin(radians) * values.rangeNm;
            const y = (currentEnvironment.stationYNm || 0) + Math.cos(radians) * values.rangeNm;
            if (Math.abs(x) > 2000 || Math.abs(y) > 2000) {
                fail(row.inputs.rangeNm, `${prefix}: this bearing and range place the aircraft outside the chart’s ±2000 NM extent.`);
            }
            return {
                id: `ac${index + 1}`, callsign,
                type: readText(row.inputs.type, `${prefix} type`, 24),
                ...values,
                ...row.navigation,
                compassUnserviceable: row.inputs.compassUnserviceable.checked,
            };
        });
        return { title: sessionTitle, mode: mode.value, aircraft, environment: { ...environment, dfHoldSeconds: 10, ...(currentEnvironment.magneticVariationKnown === false && currentEnvironment.trainingMagneticVariationDeg == null ? { trainingMagneticVariationDeg: 0 } : {}) } };
    }
    function close() {
        epoch++;
        isOpen = false;
        host.container.hidden = true;
    }
    function open() {
        if (isOpen) return;
        epoch++;
        isOpen = true;
        const view = host.view();
        const environment = view?.environment || {};
        if (!initialized) {
            title.value = view?.title || 'Procedural training session';
            mode.value = ['area', 'approach', 'aerodrome'].includes(view?.mode) ? view.mode : 'area';
            initialized = true;
        }
        airspaceLabel.textContent = `Airspace: ${environment.aerodromeName || 'Custom airspace'}`;
        error.textContent = '';
        error.hidden = true;
        host.container.hidden = false;
        syncControls();
    }
    count.addEventListener('input', updateCount);
    count.addEventListener('change', updateCount);
    form.addEventListener('focusin', event => {
        if (!phone.matches || !(event.target instanceof HTMLInputElement)) return;
        const current = event.target;
        // Give the software keyboard time to resize the visible viewport.
        setTimeout(() => { if (document.activeElement === current) current.scrollIntoView({ block: 'center', behavior: 'auto' }); }, 300);
    });
    form.addEventListener('change', event => { dirty = true; if (event.target.dataset.field === 'callsign') syncControls(); });
    form.addEventListener('input', event => {
        dirty = true;
        if (event.target instanceof HTMLElement)
            event.target.removeAttribute('aria-invalid');
        error.hidden = true;
    });
    airspaceButton.addEventListener('click', () => { close(); host.airspace(); });
    cancel.addEventListener('click', () => { close(); host.cancel(); });
    returnExercise.addEventListener('click', () => {
        if (pending || !host.canReturn?.()) return;
        close();
        host.returnToExercise?.();
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (pending || !isOpen)
            return;
        const submittedEpoch = epoch;
        error.hidden = true;
        try {
            const value = payload();
            pending = true;
            syncControls();
            await host.submit(value, () => isOpen && epoch === submittedEpoch);
            if (isOpen && epoch === submittedEpoch)
                close();
        }
        catch (reason) {
            if (isOpen && epoch === submittedEpoch) {
                error.textContent = reason instanceof Error ? reason.message : 'The session could not be created. Please try again.';
                error.hidden = false;
            }
        }
        finally {
            // A reopened draft remains intact; only the shared in-flight lock is released.
            pending = false;
            syncControls();
        }
    });
    function resetFromScenario(scenario) {
        if (!scenario) return;
        epoch++; dirty = false; initialized = true;
        title.value = scenario.title || 'Procedural training session'; mode.value = scenario.mode || 'area';
        const aircraft = scenario.aircraft || [];
        rows.length = 0; body.replaceChildren();
        visibleCount = Math.max(1, aircraft.length); count.value = String(visibleCount); syncControls();
        const env = scenario.environment || {};
        aircraft.forEach((item,index) => {
            rows[index].navigation = Object.fromEntries(['routeId', 'wakeCategory'].filter(key => item[key]).map(key => [key, item[key]]));
            const target = rows[index].inputs, east = item.xNm - (env.stationXNm || 0), north = item.yNm - (env.stationYNm || 0);
            target.callsign.value = item.callsign; target.type.value = item.type || 'TRAINER';
            target.qteDeg.value = String((Math.atan2(east,north) * 180 / Math.PI + 360) % 360); target.rangeNm.value = String(Math.hypot(east,north));
            for (const {key} of numericFields) if (key !== 'qteDeg' && key !== 'rangeNm') target[key].value = String(item[key] ?? (key === 'spawnTime' ? 0 : key === 'verticalRateFpm' ? 1000 : key === 'turnRateDegSec' ? 3 : 0));
            target.compassUnserviceable.checked = !!item.compassUnserviceable;
        });
        syncControls();
    }
    return { open, close, hasDraft: () => dirty, markApplied: () => { dirty = false; }, resetFromScenario };
}
