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
