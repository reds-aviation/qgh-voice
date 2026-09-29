import { destination, project } from './chart-geometry.js';

// A small overview drawn from the same coordinate records as the scope, not a chart scan.
export function drawAirspacePreview(svg, base, navigation) {
    svg.replaceChildren();
    const add = (tag, attrs, text) => {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
        if (text) node.textContent = text;
        svg.append(node); return node;
    };
    if (!base) return;
    const areas = base.areas.map(a => ({ ...a, local: (a.circle ? Array.from({ length: 72 }, (_, i) => destination(a.circle, i * 5, a.circle.radiusNm)) : a.points).map(p => project(p, base.origin)) }));
    const extent = Math.max(25, ...areas.flatMap(a => a.local.map(p => Math.max(Math.abs(p.xNm), Math.abs(p.yNm))))) * 1.12;
    const scale = 150 / extent, xy = p => [210 + p.xNm * scale, 170 - p.yNm * scale];
    svg.setAttribute('viewBox', '0 0 420 340');
    svg.setAttribute('aria-label', `${base.name}: sample LFA and CTR outlines, nearby published ATS routes, ARP at centre; true north up`);
    add('rect', { width: 420, height: 340, fill: '#10191f' });
    for (const radius of [extent / 2, extent]) {
        add('circle', { cx: 210, cy: 170, r: radius * scale, fill: 'none', stroke: '#40525a', 'stroke-dasharray': '3 4' });
        add('text', { x: 214, y: 170 - radius * scale + 12, fill: '#bacbd0', 'font-size': 10 }, `${radius.toFixed(0)} NM`);
    }
    const fixes = new Map((navigation?.fixes || []).map(f => [f.name, project(f, base.origin)]));
    for (const route of navigation?.routes || []) {
        const points = route.fixNames.map(n => fixes.get(n)).filter(Boolean).map(p => xy(p).join(',')).join(' ');
        add('polyline', { points, fill: 'none', stroke: '#5fb88b', 'stroke-width': .7, opacity: .55 });
    }
    areas.forEach((area, i) => {
        const color = area.kind === 'control-zone' ? '#76cada' : '#ef808a';
        add('polygon', { points: area.local.map(p => xy(p).join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': 1.5 });
        const center = area.local.reduce((sum, p) => ({ xNm: sum.xNm + p.xNm / area.local.length, yNm: sum.yNm + p.yNm / area.local.length }), { xNm: 0, yNm: 0 });
        const [x, y] = xy(center);
        add('text', { x, y, fill: color, 'font-size': 14, 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: '#10191f', 'stroke-width': 3 }, String(i + 1));
    });
    add('path', { d: 'M204 170h12 M210 164v12', stroke: '#ffffff', 'stroke-width': 2 });
    add('text', { x: 219, y: 185, fill: '#ffffff', 'font-size': 12 }, 'ARP');
    add('text', { x: 16, y: 23, fill: '#ffffff', 'font-size': 12 }, 'N ↑ TRUE');
}
