const earthNm = 3440.065;
const rad = Math.PI / 180;
// Accept decimal degrees, compact AIP DMS, or spaced degrees/minutes/seconds.
export function coordinate(input, axis) {
    const value = input.trim().toUpperCase();
    const hemisphere = value.match(/[NSEW]/g);
    if (hemisphere && (hemisphere.length !== 1 || !(axis === 'latitude' ? 'NS' : 'EW').includes(hemisphere[0])))
        throw new Error(`Invalid ${axis} hemisphere: ${input}`);
    const body = value.replace(/[NSEW]/g, '').trim();
    let result;
    if (/^[+-]?\d{1,3}(\.\d+)?$/.test(body))
        result = Number(body);
    else {
        const digits = axis === 'latitude' ? 2 : 3;
        const compact = body.match(new RegExp(`^(\\d{${digits}})(\\d{2})(\\d{2}(?:\\.\\d+)?)$`));
        const parts = compact ? compact.slice(1).map(Number) : body.split(/[\s°'"′″:]+/).filter(Boolean).map(Number);
        if (parts.length !== 3 || parts.some(n => !Number.isFinite(n) || n < 0) || parts[1] >= 60 || parts[2] >= 60)
            throw new Error(`Use decimal degrees or DMS for ${axis}: ${input}`);
        result = parts[0] + parts[1] / 60 + parts[2] / 3600;
    }
    if (hemisphere) {
        if (result < 0)
            throw new Error('Use either a signed coordinate or a hemisphere, not both.');
        if ('SW'.includes(hemisphere[0]))
            result = -result;
    }
    if (!Number.isFinite(result) || Math.abs(result) > (axis === 'latitude' ? 90 : 180))
        throw new Error(`${axis} is outside its valid range.`);
    return result;
}
// Spherical azimuthal-equidistant chart projection about the exercise origin.
export function project(point, origin) {
    const p = point.latitude * rad, o = origin.latitude * rad, dl = (point.longitude - origin.longitude) * rad;
    const h = Math.sin((p - o) / 2) ** 2 + Math.cos(o) * Math.cos(p) * Math.sin(dl / 2) ** 2;
    const distance = 2 * earthNm * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
    const bearing = Math.atan2(Math.sin(dl) * Math.cos(p), Math.cos(o) * Math.sin(p) - Math.sin(o) * Math.cos(p) * Math.cos(dl));
    const result = { xNm: distance * Math.sin(bearing), yNm: distance * Math.cos(bearing) };
    if (Math.abs(result.xNm) > 2000 || Math.abs(result.yNm) > 2000)
        throw new Error('Chart point exceeds the 2,000 NM exercise extent.');
    return result;
}
export function destination(origin, bearing, distance) {
    const p = origin.latitude * rad, l = origin.longitude * rad, b = bearing * rad, d = distance / earthNm;
    const lat = Math.asin(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(b));
    const lon = l + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(lat));
    return { latitude: lat / rad, longitude: ((lon / rad + 540) % 360) - 180 };
}
export function circle(center, radius) {
    if (!Number.isFinite(radius) || radius <= 0 || radius > 1000)
        throw new Error('Circle radius must be greater than zero and no more than 1,000 NM.');
    return Array.from({ length: 72 }, (_, i) => ({ xNm: center.xNm + radius * Math.sin(i * 5 * rad), yNm: center.yNm + radius * Math.cos(i * 5 * rad) }));
}
export function readPoint(first, second, mode, origin) {
    if (mode === 'geographic') {
        if (!origin)
            throw new Error('Set the chart origin before entering latitude/longitude.');
        return project({ latitude: coordinate(first, 'latitude'), longitude: coordinate(second, 'longitude') }, origin);
    }
    if (!first.trim() || !second.trim())
        throw new Error('Both east and north coordinates are required.');
    const point = { xNm: Number(first), yNm: Number(second) };
    if (!Number.isFinite(point.xNm) || !Number.isFinite(point.yNm) || Math.abs(point.xNm) > 2000 || Math.abs(point.yNm) > 2000)
        throw new Error('Coordinates must be within ±2,000 NM.');
    return point;
}
