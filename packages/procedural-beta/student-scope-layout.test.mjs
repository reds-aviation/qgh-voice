import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { domHarness } from './testing/dom-harness.mjs';

const require = createRequire(import.meta.url);
const { parse } = require('cssom');
const css = parse(readFileSync(new URL('./static/scope-workspace.css', import.meta.url), 'utf8'));
const html = readFileSync(new URL('./static/procedural.html', import.meta.url), 'utf8');

// Evaluate the applicable CSS cascade, not a browser layout. The live browser
// check still measures the canvas and exercises tapping/dragging estimate dots.
function mediaMatches(query, width, height) {
    return query.split(',').some(part => {
        const bounds = [...part.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)];
        if (!bounds.length) return false;
        return bounds.every(([, direction, axis, number]) => {
            const size = axis === 'width' ? width : height;
            return direction === 'min' ? size >= Number(number) : size <= Number(number);
        });
    });
}
function specificity(selector) {
    return (selector.match(/#[\w-]+/g)?.length || 0) * 10000
        + (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g)?.length || 0) * 100
        + (selector.match(/(^|[\s>+~])(?:body|div|section|details|canvas|nav|main)\b/g)?.length || 0);
}
function styleFor(element, width, height) {
    const values = new Map(); let order = 0;
    function visit(rules) {
        for (const rule of rules) {
            if (rule.type === 4) {
                if (mediaMatches(rule.media.mediaText, width, height)) visit(rule.cssRules);
                continue;
            }
            if (rule.type !== 1) continue;
            for (const selector of rule.selectorText.split(',')) {
                let matches = false;
                try { matches = element.matches(selector.trim()); } catch { /* Unrelated browser pseudo classes. */ }
                if (!matches) continue;
                const rank = specificity(selector);
                for (let i = 0; i < rule.style.length; i++) {
                    const property = rule.style[i], important = rule.style.getPropertyPriority(property) === 'important';
                    const next = { value: rule.style.getPropertyValue(property), rank, important, order: ++order };
                    const old = values.get(property);
                    if (!old || Number(important) > Number(old.important) || important === old.important && (rank > old.rank || rank === old.rank && next.order > old.order)) values.set(property, next);
                }
            }
        }
    }
    visit(css.cssRules);
    return Object.fromEntries([...values].map(([key, value]) => [key, value.value]));
}
function tracks(value) {
    const result = []; let depth = 0, token = '';
    for (const char of value) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (/\s/.test(char) && depth === 0) { if (token) result.push(token); token = ''; }
        else token += char;
    }
    if (token) result.push(token);
    return result;
}
function studentDesk({ width, height, collapsed, ended = false, drawer = false, homingRight = false, estimatesOpen = false }) {
    const h = domHarness(html, '/qgh-voice/procedural-beta/', width);
    h.document.body.className = ['desk-open', 'student-desk', width <= 1000 ? 'compact-controls' : '', collapsed ? 'options-collapsed' : '', ended ? '' : 'exercise-running', drawer ? 'drawer-open' : ''].join(' ');
    const panel = h.document.querySelector('.scope-panel'); panel.classList.toggle('homing-right', homingRight);
    const estimates = h.document.createElement('details'); estimates.className = 'student-estimate-panel'; estimates.open = estimatesOpen;
    // Linkedom exposes the property without reflecting this native attribute.
    estimates.toggleAttribute('open', estimatesOpen);
    h.document.getElementById('scope-wrap').append(estimates);
    return { ...h, panel, estimates, style: element => styleFor(element, width, height) };
}

test('phone student Options collapse preserves seven mobile rows and gives the plot the flexible row', () => {
    for (const [width, height] of [[320, 568], [390, 844], [700, 500]])
        for (const collapsed of [false, true])
            for (const ended of [false, true])
                for (const drawer of [false, true])
                    for (const homingRight of [false, true]) {
                        const h = studentDesk({ width, height, collapsed, ended, drawer, homingRight });
                        const style = h.style(h.panel), rows = tracks(style['grid-template-rows']);
                        const areas = [...style['grid-template-areas'].matchAll(/"([^"]+)"/g)].map(m => m[1]);
                        const plot = areas.findIndex(area => area.split(/\s+/).includes('plot'));
                        assert.equal(rows.length, areas.length, JSON.stringify({ width, collapsed, ended, drawer, rows, areas }));
                        assert.equal(rows[plot].replace(/\s/g, ''), 'minmax(0,1fr)', 'Scope retains the flexible mobile row, never a fixed 62px desktop row');
                        assert.equal(rows[areas.findIndex(area => area.includes('instruments'))], '132px');
                    }
});

test('open estimate controls retain a usable phone canvas in running and ended exercises', () => {
    for (const ended of [false, true]) for (const estimatesOpen of [false, true]) {
        const h = studentDesk({ width: 390, height: 844, collapsed: true, ended, estimatesOpen });
        assert.equal(h.style(h.document.getElementById('scope-plot'))['min-height'], '200px');
        assert.equal(h.style(h.document.getElementById('scope-wrap'))['overflow-y'], 'auto');
        if (estimatesOpen) {
            assert.equal(h.style(h.estimates)['max-height'], 'min(350px,40dvh)');
            assert.equal(h.style(h.estimates)['overflow-y'], 'auto');
        }
    }
});

test('the phone repair leaves the tablet and laptop student grid intact', () => {
    for (const [width, height] of [[768, 1024], [1366, 768]]) {
        const h = studentDesk({ width, height, collapsed: true });
        const style = h.style(h.panel), rows = tracks(style['grid-template-rows']);
        const areas = [...style['grid-template-areas'].matchAll(/"([^"]+)"/g)].map(m => m[1]);
        assert.equal(rows.length, 5); assert.equal(areas.length, 5);
        assert.equal(rows[2].replace(/\s/g, ''), 'minmax(0,1fr)');
        assert.equal(h.style(h.document.getElementById('scope-plot'))['min-height'], '0');
    }
});
