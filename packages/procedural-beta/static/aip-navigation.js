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
    const fixes = new Map(retainedFixes.map(f => [f.id, f]));
    const fixesByName = new Map();
    for (const publishedFix of published.fixes) {
        const fix = { id: publishedFix.id, name: publishedFix.name, ...project(publishedFix, origin) };
        const retained = fixes.get(fix.id);
        if (retained && (retained.name !== fix.name || Math.hypot(retained.xNm - fix.xNm, retained.yNm - fix.yNm) > 1e-8)) {
            // A previous ARP can leave referenced AIP geometry in local space.
            // Keep that navigation intact and give this chart's point its own
            // identity rather than attaching new geographic text to old NM.
            const prefix = fix.id.slice(0, 54); let suffix = 1;
            while (fixes.has(`${prefix}-chart-${suffix}`)) suffix++;
            fix.id = `${prefix}-chart-${suffix}`;
        }
        if (!fixes.has(fix.id)) fixes.set(fix.id, fix);
        fixesByName.set(publishedFix.name, fix.id);
    }
    const routes = new Map(published.routes.map(r => {
        const fixIds = r.fixNames.map(name => {
            const id = fixesByName.get(name);
            if (!id)
                throw new Error(`Published route ${r.name} has no coordinate for ${name}.`);
            return id;
        });
        // Published FL/altitude labels are retained as written, never silently
        // converted into an operational clearance or pressure-reference rule.
        const metadata = Object.fromEntries(['designator', 'publishedLimitsHeading', 'publishedSegments', 'limitsVaryBySegment', 'trackDistance', 'lateralLimits', 'oddLevels', 'evenLevels', 'notes'].filter(key => r[key] !== undefined).map(key => [key, structuredClone(r[key])]));
        const pointsByName = new Map(published.fixes.map(f => [f.name, f]));
        return [r.id, { ...metadata, id: r.id, name: r.name, kind: r.kind, fixIds, active: true,
                availableFrom: 0, availableUntil: 0, minAltitudeFt: -1500, maxAltitudeFt: 60000,
                coordinateOrigin: { latitude: origin.latitude, longitude: origin.longitude },
                geoPoints: r.fixNames.map(name => ({ latitude: pointsByName.get(name).latitude, longitude: pointsByName.get(name).longitude })),
                levelLimits: r.levelLimits, source: r.source, reference: r.reference, effectiveInfo: r.effectiveInfo }];
    }));
    for (const route of retainedRoutes)
        routes.set(route.id, route);
    if (fixes.size > 200 || routes.size > 100)
        throw new Error(`This chart plus retained navigation needs ${fixes.size} fixes and ${routes.size} routes; capacity is 200 fixes / 100 routes. No navigation was replaced. Export the exercise, then remove unused custom navigation or start a fresh scenario before selecting this aerodrome.`);
    return { fixes: [...fixes.values()], routes: [...routes.values()] };
}
