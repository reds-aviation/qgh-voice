import { coordinate } from './chart-geometry.js';
import { calibrateImage, alignmentBriefing } from './chart-calibration.js';

export function createMapWorkshop(context) {
    const $ = id => document.getElementById(id), form = $('map-align-form');
    const field = name => form.elements.namedItem(name), value = name => field(name).value.trim();
    let staged = null, imageURL = '', stageNumber = 0, currentExercise = '', candidate = null;
    const status = text => $('map-align-status').textContent = text;
    function reset() {
        stageNumber++; staged = null; candidate = null;
        if (imageURL) URL.revokeObjectURL(imageURL);
        imageURL = ''; $('map-file').value = ''; $('map-image-preview').hidden = true;
        $('map-align-apply').disabled = true; form.reset(); status('Select a chart image to begin.');
    }
    function invalidate() { candidate = null; $('map-align-apply').disabled = true; }
    function markers() {
        for (const name of ['a', 'b', 'c']) {
            const marker = $(`map-point-${name}`), x = value(`${name}X`), y = value(`${name}Y`);
            marker.hidden = x === '' || y === '';
            marker.style.left = `${Number(x)}%`; marker.style.top = `${Number(y)}%`;
        }
    }
    const run = action => async () => { try { await action(); } catch (e) { status(e.message); context.message(e.message, true); } };
    form.addEventListener('input', () => { invalidate(); markers(); });
    form.addEventListener('change', invalidate);
    $('map-file').addEventListener('change', run(async () => {
        const file = $('map-file').files?.[0];
        invalidate(); staged = null; const token = ++stageNumber;
        if (imageURL) URL.revokeObjectURL(imageURL);
        imageURL = ''; $('map-image-preview').hidden = true;
        if (!file) return;
        if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a PNG/JPEG image no larger than 5 MB.');
        imageURL = URL.createObjectURL(file);
        const image = $('map-align-image'); image.src = imageURL;
        await image.decode();
        if (token !== stageNumber) return;
        if (image.naturalWidth > 4096 || image.naturalHeight > 4096 || image.naturalWidth * image.naturalHeight > 16000000) throw new Error('Use an image no larger than 4096 pixels per side and 16 megapixels.');
        staged = { file, width: image.naturalWidth, height: image.naturalHeight, exercise: context.view()?.exerciseId, generation: context.generation() };
        for (const name of ['aX', 'aY', 'bX', 'bY', 'cX', 'cY']) field(name).value = '';
        field('point').value = 'a'; markers(); $('map-image-preview').hidden = false;
        status('Image ready. Mark A at the ARP, then B and C at known coordinates. Nothing has been shared yet.');
    }));
    $('map-image-preview').addEventListener('click', e => {
        if (!staged) return;
        const rect = $('map-align-image').getBoundingClientRect(), name = value('point');
        field(`${name}X`).value = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100)).toFixed(3);
        field(`${name}Y`).value = Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100)).toFixed(3);
        invalidate(); markers(); status(`Point ${name.toUpperCase()} marked. Select the next point above the image.`);
    });
    function calculate() {
        const state = context.view(), origin = state?.environment.chartOrigin;
        if (!staged || staged.exercise !== state?.exerciseId || staged.generation !== context.generation()) throw new Error('Choose the image again for this exercise.');
        if (!origin) throw new Error('Save ARP coordinates in Chart origin & shared briefing first.');
        if (state.running) throw new Error('Pause the exercise before calibrating a chart.');
        if (!value('source') || !value('edition') || !value('description')) throw new Error('Enter the chart source, edition/date, and the LFA name/limits or layout notes.');
        const pixel = name => {
            if (!value(`${name}X`) || !value(`${name}Y`)) throw new Error('Mark all three image points, or enter their left/top percentages.');
            return { x: Number(value(`${name}X`)), y: Number(value(`${name}Y`)) };
        };
        const geo = name => ({ latitude: coordinate(value(`${name}Lat`), 'latitude'), longitude: coordinate(value(`${name}Lon`), 'longitude') });
        const fit = calibrateImage({ origin, width: staged.width, height: staged.height, a: pixel('a'), b: pixel('b'), c: pixel('c'), bGeo: geo('b'), cGeo: geo('c') });
        const detail = `${value('description')}\nSource: ${value('source')} · ${value('edition')}\nARP ${origin.latitude}, ${origin.longitude}; B ${value('bLat')}, ${value('bLon')}; C ${value('cLat')}, ${value('cLon')}.\nImage width ${fit.widthNm.toFixed(3)} NM; clockwise rotation ${fit.rotationDeg.toFixed(3)}°; A ${fit.originXPct.toFixed(3)}% left / ${fit.originYPct.toFixed(3)}% top. C residual ${fit.errorNm.toFixed(3)} NM. Instructor-supplied alignment; shape is not an entry clearance.`;
        const fingerprint = JSON.stringify([...form.querySelectorAll('input,textarea')].map(input => [input.name, input.value]));
        return { fit, fingerprint, origin: JSON.stringify(origin), image: staged, briefing: alignmentBriefing(state.environment.briefing, detail) };
    }
    form.addEventListener('submit', e => { e.preventDefault(); void run(async () => {
        invalidate(); candidate = calculate();
        status(`Alignment ready: width ${candidate.fit.widthNm.toFixed(2)} NM · rotation ${candidate.fit.rotationDeg.toFixed(1)}° clockwise · check C error ${candidate.fit.errorNm.toFixed(2)} NM. Confirm the points, then Apply and share.`);
        $('map-align-apply').disabled = false;
    })(); });
    $('map-align-apply').onclick = run(async () => {
        if (!candidate) throw new Error('Check alignment first.');
        const checked = candidate;
        invalidate();
        const next = calculate();
        if (checked.origin !== next.origin || checked.image !== next.image || checked.fingerprint !== next.fingerprint) { invalidate(); throw new Error('The chart or alignment inputs changed. Check alignment again.'); }
        const button = $('map-align-apply'); button.disabled = true;
        try {
            const uploaded = await context.request('/api/procedural/map', staged.file);
            if (checked.image !== staged || staged.exercise !== context.view()?.exerciseId || staged.generation !== context.generation() || context.view()?.running || checked.origin !== JSON.stringify(context.view()?.environment.chartOrigin)) throw new Error('Exercise or ARP changed during upload. Check alignment again.');
            // Re-read the briefing after upload so unrelated instructor text is not overwritten.
            const final = calculate(), { errorNm, toleranceNm, ...map } = final.fit;
            if (checked.fingerprint !== final.fingerprint) throw new Error('Alignment inputs changed during upload. Check alignment again.');
            await context.command('environment', { map: { ...map, opacity: .45, imageId: uploaded.imageId }, briefing: final.briefing }, undefined, staged.exercise);
            for (const name of ['widthNm', 'originXPct', 'originYPct', 'rotationDeg', 'opacity']) $('map-form').elements.namedItem(name).value = String(name === 'opacity' ? .45 : map[name]);
            context.showMap(); invalidate();
            status('Calibrated image and alignment notes shared. The image is visible on this desk; students can enable Map. Boundaries remain editable separately.');
        } catch (e) { invalidate(); throw e; }
    });
    return { render() {
        const state = context.view();
        if ((state?.exerciseId || '') !== currentExercise) { currentExercise = state?.exerciseId || ''; reset(); }
        $('map-arp-summary').textContent = state?.environment.chartOrigin ? `Saved ARP: ${state.environment.chartOrigin.latitude.toFixed(6)}, ${state.environment.chartOrigin.longitude.toFixed(6)}. A must mark this exact point, not the VOR unless they coincide.` : 'No ARP saved. Enter or upload ARP coordinates below first.';
    } };
}
