/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

(function (root) {
  'use strict';
  // These aliases drive BOTH execution and the generated training guide.
  const commands = [
    ['transmit', ['DF','D/F','TRANSMIT DF','TRANSMIT D/F','TRANSMIT FOR DF','TRANSMIT FOR D/F'], 'QGH only: request a pilot transmission and D/F indication.'],
    ['report', ['REPORT'], 'Normal QGH: heading report. Radar: position report. Unavailable in U/S Compass.'],
    ['report-heading', ['REPORT HEADING'], 'Report current aircraft heading; unavailable in U/S Compass.'],
    ['report-position', ['REPORT POSITION'], 'Radar modes only: pilot position report.'],
    ['advance', ['ADVANCE','ADVANCE 1','ADVANCE 1 MIN'], 'Advance ALL aircraft by one simulation minute. Radio timing remains in real seconds.'],
    ['continue', ['CONTINUE'], 'Normal QGH/vectoring: use the assigned-heading field. SRA: continue approach acknowledgement; descent remains instructor-controlled.'],
    ['visual', ['VISUAL'], 'SRA: report runway visual using the simulator training gate.'],
    ['missed', ['MISSED'], 'SRA: training climb to current altitude +3,000 ft, rounded up to 100 ft and limited to 45,000 ft.'],
    ['next', ['NEXT','NEXT AIRCRAFT'], 'Select the next aircraft; wrap at the end of the roster.'],
    ['previous', ['PREV','PREVIOUS','PREV AIRCRAFT'], 'Select the previous aircraft.'],
    ['start', ['START'], 'Start after instructor admission and student Ready.'],
    ['pause', ['PAUSE'], 'Pause a running exercise.'],
    ['resume', ['RESUME'], 'Resume a paused exercise deliberately.'],
    ['turn-left-now', ['LEFT NOW'], 'U/S Compass only: start or reverse to a left turn immediately.'],
    ['turn-right-now', ['RIGHT NOW'], 'U/S Compass only: start or reverse to a right turn immediately.'],
    ['stop-turn', ['STOP','STOP TURN'], 'U/S Compass only: stop the turn on the current heading.']
  ].map(([action, aliases, description]) => Object.freeze({action, aliases:Object.freeze(aliases), description}));
  const direct = Object.freeze({ ...Object.fromEntries(commands.flatMap(row => row.aliases.map(alias => [alias,row.action]))), 'TRANSFER PAR': 'transfer-par' });
  const api = Object.freeze({commands:Object.freeze(commands), direct});
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATCSuiteCommandReference = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
