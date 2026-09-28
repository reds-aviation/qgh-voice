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
    heading.append(element('span', '', 'SCENARIO'), element('h1', '', 'Build the exercise'), element('p', '', 'Set each aircraft’s bearing, range and heading independently. The session starts paused.'));
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
    const count = numberInput('aircraftCount', 1, 24, 1);
    count.step = '1';
    addSetting('Aircraft count · 1–24', count);
    const runway = numberInput('runwayHeadingDeg', 0, 360, 90);
    const qnh = numberInput('qnhHpa', 870, 1085, 1013);
    addSetting('Runway heading °T', runway);
    addSetting('QNH hPa', qnh);
    const airspaceRow = element('div', 'setup-airspace');
    const airspaceLabel = element('p', 'setup-airspace-label');
    airspaceLabel.setAttribute('aria-live', 'polite');
    const airspaceButton = element('button', 'secondary', 'Configure airspace');
    airspaceButton.type = 'button';
    airspaceRow.append(airspaceLabel, airspaceButton);
    const roster = element('div', 'roster-editor');
    roster.append(element('h2', 'roster-editor-head', 'Aircraft roster'));
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
    const create = element('button', 'primary', 'Create session');
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
    let runwayEdited = false;
    let qnhEdited = false;
    let isOpen = false;
    let pending = false;
    let epoch = 0;
    const byteLength = (text) => new TextEncoder().encode(text).length;
    function addRow(index) {
        const row = element('div', 'roster-row');
        row.setAttribute('role', 'row');
        row.dataset.aircraftIndex = String(index);
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
        return { element: row, inputs };
    }
    function syncControls() {
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
        create.textContent = pending ? 'Creating session…' : 'Create session';
        form.setAttribute('aria-busy', String(pending));
    }
    function updateCount() {
        const value = Number(count.value);
        if (count.value.trim() && Number.isInteger(value) && value >= 1 && value <= 24) {
            visibleCount = value;
            syncControls();
        }
    }
    function fail(input, message) {
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
        const size = readNumber(count, 'Aircraft count', 1, 24);
        if (!Number.isInteger(size))
            fail(count, 'Aircraft count must be a whole number from 1 to 24.');
        updateCount();
        const sessionTitle = readText(title, 'Session title', 100, true);
        if (!['area', 'approach', 'aerodrome'].includes(mode.value))
            fail(mode, 'Choose an exercise family.');
        const environment = {
            runwayHeadingDeg: readNumber(runway, 'Runway heading', 0, 360),
            qnhHpa: readNumber(qnh, 'QNH', 870, 1085),
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
        epoch++;
        isOpen = true;
        const view = host.view();
        const environment = view?.environment || {};
        if (!initialized) {
            title.value = view?.title || 'Procedural training session';
            mode.value = ['area', 'approach', 'aerodrome'].includes(view?.mode) ? view.mode : 'area';
            initialized = true;
        }
        if (!runwayEdited)
            runway.value = String(environment.runwayHeadingDeg ?? 90);
        if (!qnhEdited)
            qnh.value = String(environment.qnhHpa ?? 1013);
        airspaceLabel.textContent = `Current aerodrome: ${environment.aerodromeName || 'Synthetic aerodrome'}`;
        error.textContent = '';
        error.hidden = true;
        host.container.hidden = false;
        syncControls();
    }
    count.addEventListener('input', updateCount);
    count.addEventListener('change', updateCount);
    runway.addEventListener('input', () => { runwayEdited = true; });
    qnh.addEventListener('input', () => { qnhEdited = true; });
    form.addEventListener('input', event => {
        if (event.target instanceof HTMLElement)
            event.target.removeAttribute('aria-invalid');
        error.hidden = true;
    });
    airspaceButton.addEventListener('click', () => { close(); host.airspace(); });
    cancel.addEventListener('click', () => { close(); host.cancel(); });
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
    return { open, close };
}
