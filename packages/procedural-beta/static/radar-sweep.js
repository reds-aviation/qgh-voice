export function advanceSweep(angle, milliseconds, rpm, running = true) {
    if (!running || !Number.isFinite(milliseconds) || milliseconds < 0 || !Number.isFinite(rpm)) return angle;
    return (angle + milliseconds * Math.max(1, Math.min(60, rpm)) * 360 / 60000) % 360;
}

// A display sweep, not a sensor/truth update. Paint separately from the chart
// so animation never rebuilds routes or changes aircraft/DF projections.
export function createRadarSweep(plot, getState, geometry) {
    const canvas = document.createElement('canvas');
    canvas.className = 'radar-sweep';
    canvas.setAttribute('aria-hidden', 'true');
    plot.append(canvas);
    const ctx = canvas.getContext('2d');
    let angle = 0, last = null, frame = 0, exercise = '';
    function paint() {
        const state = getState(), g = geometry(), ratio = Math.min(devicePixelRatio || 1, 2);
        if (canvas.width !== Math.round(g.width * ratio) || canvas.height !== Math.round(g.height * ratio)) {
            canvas.width = Math.round(g.width * ratio); canvas.height = Math.round(g.height * ratio);
        }
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, g.width, g.height);
        if (!state.visible || !state.enabled) return;
        const x = g.cx + (state.xNm || 0) * g.scale, y = g.cy - (state.yNm || 0) * g.scale;
        const radius = state.range * g.scale;
        const radians = (angle - 90) * Math.PI / 180;
        for (let i = 20; i > 0; i--) {
            const end = radians - (i - 1) * Math.PI / 180;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, radius, end - Math.PI / 180, end); ctx.closePath();
            ctx.fillStyle = `rgba(111, 213, 166, ${0.07 * (1 - (i - 1) / 20)})`; ctx.fill();
        }
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(radians) * radius, y + Math.sin(radians) * radius);
        ctx.strokeStyle = 'rgba(135, 224, 183, .32)'; ctx.lineWidth = 1; ctx.stroke();
    }
    function animate(now) {
        frame = 0;
        const state = getState();
        if (!state.visible || !state.enabled || !state.running || document.hidden) { last = null; paint(); return; }
        if (last == null) last = now;
        if (now - last >= 30) {
            angle = advanceSweep(angle, now - last, state.rpm); last = now; paint();
        }
        frame = requestAnimationFrame(animate);
    }
    function update() {
        const state = getState();
        if (exercise !== state.exerciseId) { exercise = state.exerciseId; angle = 0; last = null; }
        if (!state.visible || !state.enabled || !state.running || document.hidden) {
            cancelAnimationFrame(frame); frame = 0; last = null;
        } else if (!frame) frame = requestAnimationFrame(animate);
        paint();
    }
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; last = null; });
    return { update };
}
