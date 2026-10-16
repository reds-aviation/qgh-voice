/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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
