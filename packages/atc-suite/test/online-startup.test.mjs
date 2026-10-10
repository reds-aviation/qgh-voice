import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import Core from '../suite-core.js';
import Sensors from '../suite-sensors.js';
import Session from '../suite-session.js';
import CommandReference from '../suite-command-reference.js';
import Meeting from '../../procedural-beta/static/meeting-room.js';
import {domHarness} from '../../procedural-beta/testing/dom-harness.mjs';

const meetUrl = 'https://meet.google.com/abc-defg-hij';
const otherUrl = 'https://meet.google.com/xyz-abcd-efg';

function instructorHarness(online = false, sessionAdapter = Session) {
  const h = domHarness(readFileSync(new URL('../instructor.html', import.meta.url), 'utf8'), '/instructor.html', 1280);
  Object.assign(h.context, {structuredClone, confirm:()=>true, ATCSuiteCore: Core, ATCSuiteSensors: Sensors,
    ATCSuiteSession: sessionAdapter, ATCSuiteCommandReference: CommandReference, ATCSuiteMeeting: Meeting});
  let source = readFileSync(new URL('../suite-instructor.js', import.meta.url), 'utf8');
  source = source.slice(0, source.indexOf("  family.addEventListener('change'"))
    + '\n globalThis.fixture={state,updateAll,startExercise,pauseExercise,advanceBy,advanceWallElapsed,performInstructorAction,onSessionEvent,createSession,restoreAttempt,checkpoint,setScenarioInput(input){scenarioInput=()=>input;}};})();';
  vm.runInContext(source, h.context);
  const f = h.context.fixture, state = f.state;
  state.simulation = Core.setLifecycle(Core.createState({exerciseFamily: 'qgh', runwayOrientationDeg: 230, finalTrackDeg: 230,
    aircraft: [{aircraftId: 'AC1', callsign: '101', initialQteDeg: 30, initialRangeNm: 20,
      initialHeadingDeg: 210, altitudeFt: 10000, speedKt: 240, rateDegPerSecond: 3}]}), 'ready');
  state.sensor = Sensors.createDfSensor(); state.review = Sensors.createReviewTimeline(); state.trainingTimeRate = 1;
  const hub = Session.createFakeTransportHub(), transportFactory = name => hub.createTransport(name);
  const host = Session.createInstructorSession({pin: '123456', storage: h.context.localStorage, transportFactory,
    publicMetadata: {mode: 'qgh'}, onEvent: f.onSessionEvent});
  // The VM is a separate JavaScript realm. Clone observation envelopes at the
  // controlled transport boundary before the real session's shape checks.
  state.session = {...host, publishObservation: (value, time) => host.publishObservation(JSON.parse(JSON.stringify(value)), time)};
  if (online) state.cloudTransport = {connected: true};
  const student = Session.createStudentSession({pin: '123456', storage: h.context.localStorage, transportFactory});
  const get = id => h.document.getElementById(id);
  const audio = h.document.querySelector('.ats-meeting-audio-check');
  const acknowledge = () => {audio.checked = true; audio.dispatchEvent(new h.Event('change'));};
  const ready = () => {student.requestJoin(); state.session.admit(student.clientId); student.ready(); f.updateAll();};
  const link = url => {state.session.setMeetingLink(url); state.meetingUrl = url; f.updateAll();};
  const close = () => {student.close(); state.session.close();};
  f.updateAll();
  return {...h, ...f, get, student, acknowledge, ready, link, close};
}

test('actual host connection callbacks clear audio before Start and after recovery, even for a brief drop before protocol timeout', async () => {
  const sessionAdapter = {...Session, createInstructorSession: options => {
    const host = Session.createInstructorSession({...options, publicMetadata: JSON.parse(JSON.stringify(options.publicMetadata))});
    return {...host, publishObservation:(value,time)=>host.publishObservation(JSON.parse(JSON.stringify(value)),time)};
  }};
  const h = instructorHarness(false,sessionAdapter), hub = Session.createFakeTransportHub(), callbacks = [];
  const channelName = 'host-callback-room';
  h.context.ATCSuiteCloud = {prepareHost:async (_,callback) => {
    callbacks.push(callback);
    return {pin:'654321',sessionId:'host-callback-session',channelName,transport:{...hub.createTransport(channelName),connected:true,start(){},recoverySnapshot(){return {id:'host-callback-cloud'};}}};
  }};
  h.get('exerciseConnection').value = 'online'; h.get('scenarioForm').reportValidity = () => true;
  h.setScenarioInput({exerciseFamily:'qgh',qghProcedure:'normal',callsign:'101',approachAircraft:'AC1',runwayOrientationDeg:230,finalTrackDeg:230,
    aircraft:[{aircraftId:'AC1',callsign:'101',initialQteDeg:30,initialRangeNm:20,initialHeadingDeg:210,altitudeFt:10000,speedKt:240,rateDegPerSecond:3}]});
  await h.createSession({preventDefault(){}});
  assert.equal(callbacks.length,1);
  const student = Session.createStudentSession({pin:'654321',transport:hub.createTransport(channelName),discovery:{pin:'654321',sessionId:'host-callback-session',channelName,expiresAt:Date.now()+60000}});
  student.requestJoin(); h.state.session.admit(student.clientId); student.ready(); h.link(meetUrl); h.acknowledge();
  assert.equal(h.get('startExercise').disabled,false);
  h.state.cloudTransport.connected = false; callbacks[0]({connected:false,error:'brief outage'});
  assert.equal(h.document.querySelector('.ats-meeting-audio-check').checked,false);
  assert.equal(h.get('startExercise').disabled,true);
  h.state.cloudTransport.connected = true; callbacks[0]({connected:true});
  assert.equal(h.get('startExercise').disabled,true); assert.equal(h.startExercise(),false);
  h.acknowledge(); assert.equal(h.startExercise(),true); h.pauseExercise(); h.checkpoint(); h.state.session.detach();
  await h.restoreAttempt(); assert.equal(callbacks.length,2); student.rejoin(); h.acknowledge();
  assert.equal(h.get('pauseExercise').disabled,false);
  callbacks[0]({connected:false,error:'obsolete callback'});
  assert.equal(h.document.querySelector('.ats-meeting-audio-check').checked,true,'obsolete room callback is ignored');
  h.state.cloudTransport.connected = false; callbacks[1]({connected:false,error:'brief restored outage'});
  assert.equal(h.document.querySelector('.ats-meeting-audio-check').checked,false);
  h.state.cloudTransport.connected = true; callbacks[1]({connected:true});
  assert.equal(h.get('pauseExercise').disabled,true); assert.equal(h.pauseExercise(),false);
  student.close(); h.close();
});

test('offline instructor Start and Resume still follow admission/Ready without a Meet prerequisite', () => {
  const h = instructorHarness();
  assert.equal(h.get('startExercise').disabled, true); assert.equal(h.startExercise(), false);
  h.ready();
  assert.equal(h.get('startExercise').disabled, false);
  assert.match(h.get('startSetupStatus').textContent, /Controller Ready/);
  assert.equal(h.startExercise(), true); assert.equal(h.state.running, true);
  assert.equal(h.pauseExercise(), true); assert.equal(h.state.simulation.lifecycle, 'paused');
  assert.match(h.get('startSetupStatus').textContent, /Select Resume to continue/);
  assert.doesNotMatch(h.get('startSetupStatus').textContent, /Select Start/);
  assert.equal(h.pauseExercise(), true); assert.equal(h.state.simulation.lifecycle, 'running');
  h.close();
});

test('online instructor Start and Resume require the shared current link and mutual audio acknowledgement', () => {
  const h = instructorHarness(true); h.ready();
  assert.equal(h.startExercise(), false); assert.equal(h.get('startExercise').disabled, true);
  assert.match(h.get('startSetupStatus').textContent, /share a Google Meet link/);
  h.link(meetUrl);
  assert.equal(h.startExercise(), false);
  assert.match(h.get('startSetupStatus').textContent, /check audio/);
  h.acknowledge(); assert.equal(h.get('startExercise').disabled, false);
  assert.equal(h.startExercise(), true);
  assert.equal(h.pauseExercise(), true);
  assert.match(h.get('startSetupStatus').textContent, /Ready to Resume/);
  h.link(otherUrl);
  assert.equal(h.get('pauseExercise').disabled, true); assert.equal(h.pauseExercise(), false);
  const before = h.state.simulation.simulationSeconds;
  const manual = h.performInstructorAction({action: 'advance'});
  assert.equal(manual.accepted, false); assert.equal(h.state.simulation.simulationSeconds, before);
  h.acknowledge(); assert.equal(h.get('pauseExercise').disabled, false);
  assert.equal(h.pauseExercise(), true);
  h.close();
});

test('a running aircraft tick does not silently freeze when a Meet draft invalidates only the next startup acknowledgement', () => {
  const h = instructorHarness(true); h.ready(); h.link(meetUrl); h.acknowledge(); assert.equal(h.startExercise(), true);
  const input = h.document.querySelector('.ats-meeting-panel input[type="url"]');
  input.value = otherUrl; input.dispatchEvent(new h.Event('input'));
  assert.equal(h.document.querySelector('.ats-meeting-audio-check').checked, false);
  const before = h.state.simulation.simulationSeconds;
  h.advanceWallElapsed(.25);
  assert.equal(h.state.simulation.simulationSeconds, before + .25);
  assert.equal(h.state.simulation.lifecycle, 'running'); assert.equal(h.state.running, true);
  h.close();
});

test('online disconnection and controller rejoin invalidate prior audio confirmation before another Start or Resume', () => {
  const h = instructorHarness(true); h.ready(); h.link(meetUrl); h.acknowledge();
  h.state.cloudTransport.connected = false; h.updateAll();
  assert.equal(h.get('startExercise').disabled, true); assert.equal(h.startExercise(), false);
  assert.equal(h.document.querySelector('.ats-meeting-audio-check').checked, false);
  h.state.cloudTransport.connected = true; h.updateAll();
  assert.equal(h.startExercise(), false); h.acknowledge(); assert.equal(h.startExercise(), true);
  h.pauseExercise(); h.student.rejoin(); h.updateAll();
  assert.equal(h.document.querySelector('.ats-meeting-audio-check').checked, false);
  assert.equal(h.pauseExercise(), false); h.acknowledge(); assert.equal(h.pauseExercise(), true);
  h.close();
});
