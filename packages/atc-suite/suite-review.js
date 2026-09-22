(function exposeSuiteReview(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATCSuiteReview = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createSuiteReview() {
  'use strict';

  const clone = value => JSON.parse(JSON.stringify(value));
  const heading = value => String(Math.round(((Number(value) % 360) + 360) % 360)).padStart(3, '0');

  function readbackFor(command = {}, callsign = 'AIRCRAFT') {
    const prefix = `${String(callsign || 'AIRCRAFT').trim().toUpperCase()}, `;
    switch (command.type) {
      case 'turn-heading':
        return `${prefix}TURNING ${command.direction === 'left' ? 'LEFT' : 'RIGHT'} HEADING ${heading(command.heading)}`;
      case 'turn-now':
        return `${prefix}TURNING ${command.direction === 'left' ? 'LEFT' : 'RIGHT'}`;
      case 'stop-turn': return `${prefix}STOPPING TURN`;
      case 'continue-heading': return `${prefix}CONTINUING HEADING ${heading(command.heading)}`;
      case 'report-heading': return `${prefix}HEADING ${heading(command.heading)}`;
      case 'report-heading-passing': return `${prefix}PASSING HEADING ${heading(command.heading)}`;
      case 'transmit': return `${prefix}TRANSMITTING FOR D/F`;
      case 'climb': return `${prefix}CLIMBING TO ${Math.round(Number(command.altitudeFt))} FEET`;
      case 'descend': return `${prefix}DESCENDING TO ${Math.round(Number(command.altitudeFt))} FEET`;
      case 'maintain': return `${prefix}MAINTAINING ${Math.round(Number(command.altitudeFt))} FEET`;
      case 'orbit': return `${prefix}ORBITING ${command.direction === 'left' ? 'LEFT' : 'RIGHT'}`;
      case 'resume': return `${prefix}RESUMING HEADING ${heading(command.heading)}`;
      default: return `${prefix}ROGER`;
    }
  }

  function createReadbackController(options = {}) {
    if (typeof options.speak !== 'function') throw new Error('A readback speaker is required.');
    let current = null;
    let sequence = 0;

    function cancel() {
      if (current) current.abort();
      current = null;
    }

    function play(text, metadata = {}) {
      cancel();
      const controller = new AbortController();
      const token = ++sequence;
      current = controller;
      const promise = Promise.resolve(options.speak(String(text), controller.signal, { ...metadata, token }))
        .catch(error => {
          if (!controller.signal.aborted) options.onError?.(error);
        })
        .finally(() => {
          if (current === controller) current = null;
        });
      return { token, promise, cancel: () => controller.abort() };
    }

    return Object.freeze({ play, cancel, get active() { return Boolean(current); } });
  }

  function buildTimeline(record = {}) {
    const groups = [
      ['truth', record.truth],
      ['observations', record.observations],
      ['events', record.events]
    ];
    return groups.flatMap(([layer, items]) => Array.isArray(items)
      ? items.map(item => ({ ...clone(item), layer, time: Number(item.time) })) : [])
      .filter(item => Number.isFinite(item.time))
      .sort((left, right) => left.time - right.time
        || ['truth', 'events', 'observations'].indexOf(left.layer) - ['truth', 'events', 'observations'].indexOf(right.layer));
  }

  function selectLayers(record = {}, selection = {}) {
    const enabled = name => selection[name] !== false;
    return Object.freeze({
      truth: enabled('truth') ? clone(record.truth || []) : [],
      observations: enabled('observations') ? clone(record.observations || []) : [],
      events: enabled('events') ? clone(record.events || []) : []
    });
  }

  return Object.freeze({ heading, readbackFor, createReadbackController, buildTimeline, selectLayers });
});
