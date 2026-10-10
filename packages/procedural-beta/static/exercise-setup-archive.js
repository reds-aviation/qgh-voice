import { prepareExerciseTemplate, parseExerciseTemplate } from './scenario-library.js';

const databaseName = 'ats-simbox-starting-exercises-v1';
const storeName = 'starting-setups';
const unavailable = 'Starting setup unavailable for this older exercise. Use Download current progress to keep its current state and records.';
const clone = value => JSON.parse(JSON.stringify(value));

// Capture the engine export while time is still zero. Review cannot infer an
// aircraft's original position or chart from its final state.
export function createExerciseSetupArchive(host) {
    const memory = new Map();
    let database;
    function snapshot() {
        const state = host.view();
        if (!state || state.role !== 'instructor' || !state.exerciseId) throw new Error('Open the instructor exercise first.');
        return { generation: host.generation(), exerciseId: state.exerciseId, revision: state.revision, state };
    }
    function check(saved) {
        const current = host.view();
        if (saved.generation !== host.generation() || current?.role !== 'instructor' || saved.exerciseId !== current.exerciseId || saved.revision !== current.revision) {
            throw new Error('The exercise changed while preparing its download. Try again.');
        }
    }
    function open() {
        return database ||= new Promise((resolve, reject) => {
            if (!globalThis.indexedDB) { reject(new Error('Device storage unavailable.')); return; }
            const request = indexedDB.open(databaseName, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'exerciseId' });
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('Device storage is busy.'));
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => { db.close(); database = undefined; };
                resolve(db);
            };
        });
    }
    async function stored(exerciseId, template) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, template ? 'readwrite' : 'readonly');
            const store = transaction.objectStore(storeName);
            const request = template ? store.put({ exerciseId, template }) : store.get(exerciseId);
            transaction.oncomplete = () => resolve(template || request.result?.template);
            transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Device storage unavailable.'));
        });
    }
    async function capture() {
        const saved = snapshot();
        if (saved.state.elapsed !== 0 || saved.state.running) throw new Error(unavailable);
        const bundle = await host.request('/api/procedural/export');
        check(saved);
        if (bundle?.scenario?.exerciseId !== saved.exerciseId || bundle.scenario.revision !== saved.revision) {
            throw new Error('The exported exercise changed. Try again before Run.');
        }
        const previous = memory.get(saved.exerciseId);
        const name = String(saved.state.title || 'Starting exercise').trim().slice(0, 80) || 'Starting exercise';
        // Recovery may contain legacy 21–24 aircraft. Archiving an existing
        // exercise must not apply the smaller limit for creating new traffic.
        const template = clone(prepareExerciseTemplate(bundle, name, previous?.id, previous?.createdAt, { allowLegacy24: true }));
        check(saved);
        memory.set(saved.exerciseId, template);
        // Browser quota or storage restrictions must not prevent an exercise.
        // The same open page can still download the captured setup from memory.
        try { await stored(saved.exerciseId, template); } catch { /* Best-effort durable recovery. */ }
        check(saved);
        return clone(template);
    }
    async function downloadBundle() {
        const saved = snapshot();
        if (saved.state.elapsed === 0 && !saved.state.running) return capture();
        let template = memory.get(saved.exerciseId);
        if (!template) {
            try {
                const record = await stored(saved.exerciseId);
                if (record) template = clone(parseExerciseTemplate(JSON.stringify(record), { allowLegacy24: true }));
            } catch { /* No durable snapshot; never substitute final traffic. */ }
        }
        check(saved);
        if (!template) throw new Error(unavailable);
        memory.set(saved.exerciseId, template);
        return clone(template);
    }
    return { capture, downloadBundle };
}
