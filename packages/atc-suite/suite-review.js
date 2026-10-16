/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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
