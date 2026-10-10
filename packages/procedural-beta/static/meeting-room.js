(function exposeMeetingRoom(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATCSuiteMeeting = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const INVALID_LINK = 'Paste a Google Meet meeting link, such as https://meet.google.com/abc-defg-hij.';
  function normalizeMeetUrl(value) {
    if (value === '' || value == null) return '';
    if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(value)) throw new Error(INVALID_LINK);
    let url;
    try { url = new URL(value.trim()); } catch (_) { throw new Error(INVALID_LINK); }
    if (url.protocol !== 'https:' || url.hostname !== 'meet.google.com' || url.username || url.password || url.port
      || !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(url.pathname)) throw new Error(INVALID_LINK);
    return `https://meet.google.com/${url.pathname.slice(1).replace(/\/$/, '').toLowerCase()}`;
  }

  function startupReadiness({ online = false, connected = true, meetingUrl = '', admitted = false, ready = false, disconnected = false, voiceReady = false } = {}) {
    let shared = false; try { shared = !!normalizeMeetUrl(meetingUrl); } catch (_) {}
    const reason = online && !connected ? 'Reconnect the online exercise before Start or Resume.'
      : online && !shared ? 'Open Session and share a Google Meet link.'
      : !admitted ? 'Open Session: share the PIN and admit the controller.'
      : disconnected ? 'Reconnect the controller before Start or Resume.'
      : !ready ? 'Ask the admitted controller to press Ready to open the display and meeting link.'
      : online && !voiceReady ? 'Both join Meet and check audio, then confirm this in Session.' : '';
    return { allowed: !reason, reason, shared };
  }
  function createStartupChecklist({ container }) {
    if (!container) return null;
    const doc = container.ownerDocument || document, section = doc.createElement('section'), title = doc.createElement('h3'), list = doc.createElement('ol');
    section.className = 'ats-startup-checklist'; title.textContent = 'Before Start'; section.append(title,list); container.prepend(section);
    return Object.freeze({ element: section, update(options = {}) {
      const result = startupReadiness(options);
      const steps = options.online ? [
        [result.shared, 'Create a Google Meet room and share its link below.'],
        [options.admitted, 'Share the exercise PIN; the controller requests admission and you Admit.'],
        [options.ready && !options.disconnected, 'Controller presses Ready to open the display and meeting link.'],
        [options.voiceReady, 'Both Join Meet, check you can hear each other, and confirm below.'],
        [result.allowed, 'Start begins aircraft movement. Keep Meet open throughout training.']
      ] : options.localSolo === true ? [
        [false, 'You can run this local Procedural exercise without a controller. Select Run when ready.'],
        [false, 'To work with a controller, share the PIN on this PC, Admit the controller, then ask them to press Ready before Run.']
      ] : [[options.admitted, 'Share the PIN on this PC and Admit the controller.'],[options.ready && !options.disconnected, 'Controller presses Ready; then Start begins aircraft movement.']];
      list.replaceChildren(...steps.map(([done,text]) => {const item = doc.createElement('li'); item.textContent = `${done ? 'Done · ' : ''}${text}`; return item;}));
      return result;
    }});
  }
  function createPanel({ container, role = 'instructor', onSave = () => {}, onReadinessChange = () => {} }) {
    if (!container) return null;
    const doc = container.ownerDocument || document;
    const make = (tag, text, className) => {
      const node = doc.createElement(tag);
      if (text) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    const external = (label, className) => {
      const link = make('a', label, className);
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      return link;
    };
    const panel = make('details', '', 'ats-meeting-panel');
    panel.append(make('summary', 'Google Meet · exercise voice'));
    const help = make('p', '', 'ats-meeting-help');
    const form = make('div', '', 'ats-meeting-form');
    const create = external('Create in Google Meet ↗', 'button-link');
    create.href = 'https://meet.google.com/';
    const createHelp = make('p', 'In Google Meet, choose New meeting → Create a meeting for later. Copy the meeting link and paste it below. Google handles your account and meeting.', 'ats-meeting-help');
    const label = make('label', 'Meeting link');
    const input = make('input');
    input.type = 'url'; input.placeholder = 'https://meet.google.com/abc-defg-hij';
    input.maxLength = 2048; input.autocomplete = 'off'; input.setAttribute('aria-label', 'Google Meet meeting link');
    label.append(input);
    const actions = make('div', '', 'ats-meeting-actions');
    const save = make('button', 'Share meeting link'); save.type = 'button';
    const clear = make('button', 'Clear link'); clear.type = 'button';
    actions.append(save, clear);
    form.append(create, createHelp, label, actions);
    const join = external('Join Meet ↗', 'ats-meeting-join button-link');
    const status = make('p', '', 'ats-meeting-status'); status.setAttribute('role', 'status');
    const audioLabel = make('label', '', 'ats-meeting-audio-label'), audioCheck = make('input', '', 'ats-meeting-audio-check'), audioText = make('span');
    audioCheck.type = 'checkbox'; audioLabel.append(audioCheck,audioText);
    const readiness = make('p', '', 'ats-meeting-readiness'); readiness.setAttribute('role', 'status');
    const debrief = make('p', 'For debrief, pause or end the exercise, then use Present now in Meet to share the simulator tab or window. Share the instructor truth screen only when the exercise is ready for review.', 'ats-meeting-help');
    const radio = make('p', 'Meet carries live conversation throughout training. Use headphones. If you hear echo, keep simulator pilot voice muted and use captions.', 'ats-meeting-help');
    const extraHelp = make('details', '', 'ats-meeting-extra-help'); extraHelp.append(make('summary','Meet help & screen sharing'),createHelp,debrief,radio);
    for (const [label,href] of [['Google: create or join a meeting','https://support.google.com/meet/answer/9302870'],['Google: check microphone & audio','https://support.google.com/meet/answer/10409699']]) {const link = external(label); link.href = href; extraHelp.append(link);}
    panel.append(help, form, join, audioLabel, readiness, status, extraHelp);
    container.append(panel);
    const joins = [join];
    let online = false, instructor = role === 'instructor', editable = false, meetingUrl = '', dirty = false, busy = false, voiceReady = false, roomKey = '', generation = 0;
    const notifyReady = () => onReadinessChange({ ready: online && !!meetingUrl && !dirty && !busy && voiceReady, meetingUrl, roomKey });
    const resetVoice = () => { const wasReady = voiceReady; voiceReady = false; audioCheck.checked = false; if (wasReady) notifyReady(); };
    const render = () => {
      panel.hidden = !online;
      form.hidden = !instructor;
      save.disabled = !editable || busy; clear.disabled = !editable || busy || !meetingUrl;
      create.hidden = !editable;
      input.disabled = !editable || busy;
      audioCheck.disabled = !online || !meetingUrl || dirty || busy;
      audioCheck.checked = voiceReady;
      audioText.textContent = instructor ? 'The controller and I have joined this Meet and can hear each other.' : 'I have joined this Meet and checked audio with the instructor.';
      readiness.textContent = voiceReady ? 'Audio confirmed for this meeting link. Keep Meet open during the exercise.' : meetingUrl ? 'Join Meet, check audio together, then tick this confirmation.' : 'Share a meeting link before checking audio.';
      for (const link of joins) {
        link.hidden = !online || !meetingUrl;
        if (meetingUrl) link.href = meetingUrl;
        else link.removeAttribute('href');
      }
    };
    input.addEventListener('input', () => { dirty = true; resetVoice(); render(); });
    audioCheck.addEventListener('change', () => { voiceReady = online && !!meetingUrl && !dirty && !busy && audioCheck.checked; render(); notifyReady(); });
    async function persist(value) {
      if (!editable || busy) return;
      const stamp = generation;
      try {
        const url = normalizeMeetUrl(value);
        busy = true; render();
        const result = await onSave(url);
        if (stamp !== generation) return;
        if (meetingUrl !== url) resetVoice();
        meetingUrl = url; dirty = false; input.value = url;
        status.textContent = result?.status || (url ? 'Meeting link saved. Admitted controllers receive it through this exercise.' : 'Meeting link cleared.');
      } catch (error) { if (stamp === generation) status.textContent = error.message || INVALID_LINK; }
      finally { if (stamp === generation) busy = false; render(); }
    }
    save.addEventListener('click', () => { void persist(input.value); });
    clear.addEventListener('click', () => { void persist(''); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); void persist(input.value); }
    });
    return Object.freeze({
      element: panel,
      isVoiceReady() { return online && !!meetingUrl && !dirty && !busy && voiceReady; },
      resetVoice() { resetVoice(); render(); },
      open() { panel.open = true; audioCheck.disabled ? input.focus?.({preventScroll:true}) : join.focus?.({preventScroll:true}); },
      move(next) { if (next && panel.parentElement !== next) next.append(panel); },
      addShortcut(next) {
        if (!next) return;
        const link = external('Join Meet ↗', 'ats-meeting-join button-link');
        joins.push(link); next.append(link); render();
      },
      update(options = {}) {
        const nextRoom = `${options.role || role}:${String(options.roomKey || '')}`;
        const roomChanged = nextRoom !== roomKey;
        if (roomChanged) { roomKey = nextRoom; generation++; dirty = false; busy = false; input.value = ''; resetVoice(); }
        online = options.online === true;
        instructor = (options.role || role) === 'instructor';
        editable = online && instructor && options.canEdit !== false;
        let next = '';
        try { next = normalizeMeetUrl(options.meetingUrl || ''); } catch (_) { /* Invalid incoming links are never rendered. */ }
        if (next !== meetingUrl) { meetingUrl = next; resetVoice(); if (!dirty) input.value = next; }
        if (roomChanged) input.value = next;
        if (!online) resetVoice();
        help.textContent = instructor
          ? 'Meet carries your voice throughout the online exercise. Both join and check audio before Start. The simulator cannot check your Google connection.'
          : 'Press Ready to open your display and the shared meeting link. Join Meet, check audio with the instructor and tell them when you can hear each other. Keep both tabs open.';
        if (!busy && !dirty) status.textContent = options.status || (meetingUrl ? 'A Google Meet link is shared for this exercise.' : instructor ? 'No meeting link shared.' : 'The instructor has not shared a meeting link yet.');
        render();
      }
    });
  }
  return Object.freeze({ normalizeMeetUrl, startupReadiness, createStartupChecklist, createPanel });
});
