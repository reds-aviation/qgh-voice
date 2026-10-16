/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import { loadRuntime } from './vendor/pilot-tts/runtime.mjs';

let runtime = null;
let preparing = null;
let latest = 0;
let pending = null;
let generating = false;

function prepare() {
  if (runtime) return Promise.resolve(runtime);
  if (!preparing) preparing = loadRuntime(progress => self.postMessage({ type: 'progress', progress }))
    .then(loaded => { runtime = loaded; return runtime; })
    .catch(error => { preparing = null; throw error; });
  return preparing;
}

async function drain() {
  if (generating) return;
  generating = true;
  try {
    while (pending) {
      const request = pending;
      pending = null;
      try {
        if (!runtime) throw new Error('Pilot voice pack has not been prepared.');
        const result = await runtime.generate(request.text, request.voice);
        if (request.token === latest) self.postMessage({ type: 'audio', token: request.token, ...result }, [result.samples.buffer]);
      } catch (error) {
        if (request.token === latest) self.postMessage({ type: 'error', token: request.token, error: error.message });
      }
    }
  } finally { generating = false; }
}

self.onmessage = event => {
  const message = event.data || {};
  if (message.type === 'prepare') {
    prepare().then(() => self.postMessage({ type: 'ready' }))
      .catch(error => self.postMessage({ type: 'error', error: error.message }));
  } else if (message.type === 'cancel') {
    latest = message.token;
    pending = null;
  } else if (message.type === 'speak') {
    latest = message.token;
    pending = message;
    void drain();
  }
};
