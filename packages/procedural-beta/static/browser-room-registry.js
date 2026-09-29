/* A local PIN directory only. No aircraft, tokens or simulation state here. */
(function (root) {
  'use strict';
  let database;
  function open() {
    return database ||= new Promise((resolve, reject) => {
      const request = indexedDB.open('qgh-procedural-room-directory-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('rooms', { keyPath: 'id' }).createIndex('pin', 'pin', { unique: true });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close older procedural tabs, then reopen.'));
    });
  }
  async function register(id, active, rotate = false) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rooms', 'readwrite'), store = tx.objectStore('rooms');
      let record;
      tx.oncomplete = () => resolve(record);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Cannot save the room PIN.'));
      const existing = store.get(id);
      existing.onsuccess = () => {
        const old = existing.result;
        function save(pin) { record = { id, pin, expiresAt: active ? Date.now() + 20000 : 0 }; store.put(record); }
        if (old && !rotate) { save(old.pin); return; }
        function choose() {
          const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
          if (pin === old?.pin) { choose(); return; }
          const used = store.index('pin').get(pin);
          used.onsuccess = () => { if (used.result) choose(); else save(pin); };
        }
        choose();
      };
    });
  }
  async function find(pin) {
    if (!/^\d{6}$/.test(pin)) return null;
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rooms', 'readonly');
      const request = tx.objectStore('rooms').index('pin').get(pin);
      tx.oncomplete = () => resolve(request.result?.expiresAt > Date.now() ? request.result.id : null);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }
  root.ProceduralRooms = { register, find };
})(globalThis);
