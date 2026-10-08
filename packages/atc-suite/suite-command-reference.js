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
