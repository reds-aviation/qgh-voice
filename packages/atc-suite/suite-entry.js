/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

(function () {
  'use strict';
  const connection = document.getElementById('exerciseConnection');
  const instructor = document.getElementById('openInstructorSetup');
  const controller = document.getElementById('openControllerPosition');
  const form = document.getElementById('entryJoinForm');
  const pin = document.getElementById('entryJoinPin');
  if (!connection || !instructor || !controller || !form || !pin) return;
  try {
    const params = new URLSearchParams(location.search);
    const mode = params.get('connection');
    if (mode === 'local' || mode === 'online') connection.value = mode;
    if (/^\d{6}$/.test(params.get('pin') || '')) pin.value = params.get('pin');
  } catch (_) { /* Manual connection and PIN entry remain available. */ }

  const urlFor = (page, requestPin = '') => {
    const url = new URL(page, location.href);
    url.searchParams.set('connection', connection.value === 'online' ? 'online' : 'local');
    if (requestPin) { url.searchParams.set('pin', requestPin); url.searchParams.set('join', '1'); }
    return url.href;
  };
  const refreshLinks = () => {
    instructor.href = urlFor('instructor.html');
    controller.href = '#entryJoinPin';
  };
  connection.addEventListener('change', refreshLinks);
  for (const link of [instructor, controller]) {
    for (const event of ['click', 'auxclick', 'contextmenu']) link.addEventListener(event, refreshLinks);
  }
  pin.addEventListener('input', () => { pin.value = pin.value.replace(/\D/g, '').slice(0, 6); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    location.assign(urlFor('student.html', pin.value));
  });
  refreshLinks();
})();
