import { project } from './chart-geometry.js';
export function resolveRouteFixIds(names, fixes, original) {
    const byId = new Map(fixes.map(f => [f.id, f]));
    if (original && original.fixIds.length === names.length && original.fixIds.every((id, i) => byId.get(id)?.name.toUpperCase() === names[i]))
        return [...original.fixIds];
    return names.map(name => {
        const matches = fixes.filter(f => f.name.toUpperCase() === name);
        if (!matches.length)
            throw new Error(`Unknown fix: ${name}`);
        if (matches.length > 1)
            throw new Error(`Fix ${name} appears in retained and current navigation. Rename the intended fix before changing this route.`);
        return matches[0].id;
    });
}
// Replace unused catalogue routes while keeping every navigation dependency of
// traffic already in the exercise. Existing local positions remain unchanged.
export function mergePublishedNavigation(scenario, published, origin) {
    const routeIDs = new Set(), fixIDs = new Set();
    const reference = (value) => {
        if (!value)
            return;
        for (const key of ['routeId', 'resumeRouteId'])
            if (value[key])
                routeIDs.add(value[key]);
        for (const key of ['fixId', 'directFixId'])
            if (value[key])
                fixIDs.add(value[key]);
        if (value.condition?.fixId)
            fixIDs.add(value.condition.fixId);
    };
    for (const aircraft of scenario.aircraft || []) {
        reference(aircraft);
        reference(aircraft.hold);
        (aircraft.pendingClearances || []).forEach(reference);
        for (const id of Object.keys(aircraft.lastFixTimes || {}))
            fixIDs.add(id);
    }
    const retainedRoutes = (scenario.routes || []).filter((r) => !r.id.startsWith('aip-') || routeIDs.has(r.id));
    for (const route of retainedRoutes)
        for (const id of route.fixIds)
            fixIDs.add(id);
    const retainedFixes = (scenario.fixes || []).filter((f) => !f.id.startsWith('aip-') || fixIDs.has(f.id));
    const fixesByName = new Map(published.fixes.map(f => [f.name, f.id]));
    const fixes = new Map(published.fixes.map(f => [f.id, { id: f.id, name: f.name, ...project(f, origin) }]));
    for (const fix of retainedFixes)
        fixes.set(fix.id, fix);
    const routes = new Map(published.routes.map(r => {
        const fixIds = r.fixNames.map(name => {
            const id = fixesByName.get(name);
            if (!id)
                throw new Error(`Published route ${r.name} has no coordinate for ${name}.`);
            return id;
        });
        // Published FL/altitude labels are retained as written, never silently
        // converted into an operational clearance or pressure-reference rule.
        return [r.id, { id: r.id, name: r.name, kind: r.kind, fixIds, active: true,
                availableFrom: 0, availableUntil: 0, minAltitudeFt: -1500, maxAltitudeFt: 60000,
                levelLimits: r.levelLimits, source: r.source, reference: r.reference, effectiveInfo: r.effectiveInfo }];
    }));
    for (const route of retainedRoutes)
        routes.set(route.id, route);
    if (fixes.size > 200 || routes.size > 100)
        throw new Error(`This chart plus retained navigation needs ${fixes.size} fixes and ${routes.size} routes; capacity is 200 fixes / 100 routes. No navigation was replaced. Export the exercise, then remove unused custom navigation or start a fresh scenario before selecting this aerodrome.`);
    return { fixes: [...fixes.values()], routes: [...routes.values()] };
}
