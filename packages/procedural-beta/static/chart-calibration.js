import { coordinate, project } from './chart-geometry.js';

// ARP uploads are data only. One explicit record avoids accidentally importing a route fix.
export function parseARP(text) {
    let row;
    if (text.trim().startsWith('{')) row = JSON.parse(text);
    else {
        const lines = text.trim().split(/\r?\n/);
        const cells = line => {
            const values = []; let value = '', quoted = false;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
                else if (line[i] === ',' && !quoted) { values.push(value.trim()); value = ''; }
                else value += line[i];
            }
            if (quoted) throw new Error('Close the quotation marks in the CSV record.');
            return [...values, value.trim()];
        };
        if (lines.length !== 2) throw new Error('ARP CSV needs a header and exactly one record.');
        const names = cells(lines[0]), values = cells(lines[1]);
        if (names.length !== values.length || new Set(names).size !== names.length) throw new Error('ARP CSV columns do not match.');
        row = Object.fromEntries(names.map((name, i) => [name, values[i]]));
    }
    if (!row || Array.isArray(row) || row.latitude == null || row.longitude == null) throw new Error('Include latitude and longitude in the ARP record.');
    const result = { latitude: coordinate(String(row.latitude), 'latitude'), longitude: coordinate(String(row.longitude), 'longitude') };
    if (Math.abs(result.latitude) > 85) throw new Error('The simulator supports ARP latitude between 85°S and 85°N.');
    for (const [key, limit] of [['aerodromeName', 100], ['chartReference', 240], ['effectiveInfo', 240]]) {
        if (typeof row[key] !== 'string' || !row[key].trim() || row[key].length > limit) throw new Error(`Include ${key} (up to ${limit} characters).`);
        result[key] = row[key].trim();
    }
    return result;
}

export function calibrateImage({ origin, width, height, a, b, c, bGeo, cGeo }) {
    if (!origin || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Save the ARP and select an image first.');
    for (const point of [a, b, c]) if (!point || ![point.x, point.y].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) throw new Error('Mark A, B and C within the image (0–100%).');
    for (const point of [origin, bGeo, cGeo]) if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 85 || Math.abs(point.longitude) > 180) throw new Error('Enter valid WGS-84 coordinates for all three points.');
    const vector = p => ({ x: (p.x - a.x) / 100, y: -(p.y - a.y) / 100 * height / width });
    const ib = vector(b), ic = vector(c), nb = Math.hypot(ib.x, ib.y), nc = Math.hypot(ic.x, ic.y);
    if (nb < .04 || nc < .04 || Math.abs(ib.x * ic.y - ib.y * ic.x) / (nb * nc) < .12) throw new Error('Choose widely separated points. C must be away from the A–B line.');
    const pb = project(bGeo, origin), pc = project(cGeo, origin), distance = Math.hypot(pb.xNm, pb.yNm);
    if (distance < .25 || Math.hypot(pc.xNm, pc.yNm) < .25) throw new Error('Use reference points at least 0.25 NM from the ARP.');
    const widthNm = distance / nb;
    if (widthNm < 1 || widthNm > 2000) throw new Error('Calculated image width must be 1–2,000 NM. Check the coordinates and image points.');
    const angle = Math.atan2(ib.y, ib.x) - Math.atan2(pb.yNm, pb.xNm);
    const check = { x: widthNm * (ic.x * Math.cos(angle) + ic.y * Math.sin(angle)), y: widthNm * (-ic.x * Math.sin(angle) + ic.y * Math.cos(angle)) };
    const errorNm = Math.hypot(check.x - pc.xNm, check.y - pc.yNm);
    const toleranceNm = Math.max(.15, Math.min(1, Math.hypot(pc.xNm, pc.yNm) * .02));
    if (errorNm > toleranceNm) throw new Error(`Point C misses by ${errorNm.toFixed(2)} NM (allowed ${toleranceNm.toFixed(2)}). Check all points or use a flat, undistorted chart. A sketch or angled photo may not align.`);
    return { widthNm, originXPct: a.x, originYPct: a.y, rotationDeg: ((angle * 180 / Math.PI + 540) % 360) - 180, errorNm, toleranceNm };
}

export function alignmentBriefing(briefing, detail) {
    const clean = (briefing || '').replace(/\n?\[LFA image alignment\][\s\S]*?\[\/LFA image alignment\]/g, '').trim();
    const result = `${clean}\n[LFA image alignment]\n${detail}\n[/LFA image alignment]`.trim();
    if (result.length > 2000) throw new Error('Shorten the shared briefing to leave room for the image alignment record.');
    return result;
}
