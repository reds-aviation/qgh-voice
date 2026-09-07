(function expose(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./voice-control.js') : root.QGHVoiceControl);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QGHProcedureIntent = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function (DefaultVoice) {
  'use strict';
  const START = /\b(?:stand by|standby|qnh|qfe|squawk|runway in use|set (?:qnh|qfe|standard|squawk|vertical rate)|report (?:your )?(?:pressure|squawk|level|altitude|height|flight level|reaching|passing (?:altitude|height|flight level)|aerodrome|runway|field|visual)|confirm (?:level|altimeter|squawk)|check altimeter|level information|climb|descend|maintain (?:level|altitude|height|flight level)|stop (?:climb|climbing|descent|descending)|surface wind|weather|wind|temperature|visibility|cloud|dew point|trend|contact tower|change frequency|set frequency|frequency|vertical rate)\b/;
  const NUMWORDS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand tree fife niner'.split(' ');
  function numeric(text, Voice) {
    const clean = text.trim();
    if (!clean || clean.split(' ').some(word => !NUMWORDS.includes(word) && !/^\d+(?:\.\d+)?$/.test(word) && !['decimal', 'point', 'minus'].includes(word))) return null;
    if (/^\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
    if (clean.startsWith('minus ')) { const number = numeric(clean.slice(6), Voice); return number == null ? null : -number; }
    const decimal = clean.split(/ (?:decimal|point) /);
    if (decimal.length === 2) {
      const left = numeric(decimal[0], Voice), right = digitString(decimal[1], Voice);
      return left != null && right != null ? Number(`${left}.${right}`) : null;
    }
    return Voice.parseNumber(clean);
  }
  function digitString(text, Voice) {
    const normalized = text.replace(/\btree\b/g, 'three').replace(/\bfife\b/g, 'five').replace(/\bniner\b/g, 'nine');
    if (/^\d+$/.test(normalized)) return normalized;
    const words = normalized.split(' '), digits = NUMWORDS.slice(0, 10);
    if (words.every(word => digits.includes(word))) return words.map(word => digits.indexOf(word)).join('');
    const number = numeric(normalized, Voice);
    return Number.isInteger(number) ? String(number) : null;
  }
  function target(text, Voice) {
    const match = /^(?:(flight level|altitude|height) )?(.+?)(?: (feet|foot))?$/.exec(text.trim());
    if (!match) return null;
    const value = numeric(match[2], Voice);
    if (value == null) return null;
    const datum = match[1] === 'flight level' ? 'STANDARD' : match[1] === 'height' ? 'QFE' : 'QNH';
    if (datum !== 'STANDARD' && !match[1] && !match[3]) return null;
    return { datum, value };
  }
  function parse(value, options = {}, Voice = DefaultVoice) {
    const transcript = Voice.normalizeTranscript(String(value).replace(/[-−](?=\d)/g, 'minus '));
    const anchor = START.exec(transcript);
    if (!anchor) return null;
    const prefix = transcript.slice(0, anchor.index).replace(/^please\s*/, '').trim();
    let aircraft = options.single ? 'single' : null;
    if (prefix) {
      const addressed = Voice.parseCommand(`${prefix} transmit for df`, { callsigns: options.callsigns });
      if (!addressed.accepted || !addressed.aircraft) return { accepted: false, transcript, reason: 'unknown-aircraft' };
      aircraft = addressed.aircraft;
    }
    const reject = reason => ({ accepted: false, transcript, reason, aircraft });
    if (!aircraft) return reject('callsign-required');
    let body = transcript.slice(anchor.index).replace(/ please$/, '');
    const accept = actions => ({ accepted: true, transcript, intent: 'procedure-command', aircraft, actions });
    if (/^(?:stand by|standby)(?: |$)/.test(body)) {
      if (/\b(?:unk|if|unless)\b/.test(body)) return reject('unclear-standby');
      return accept([{ type: 'standby', subject: body.replace(/^(?:stand by|standby)\s*/, '') }]);
    }
    // A correction replaces a value in this transaction only. It never reverts an earlier executed call.
    const correction = body.split(' correction ');
    if (correction.length > 2) return reject('unclear-correction');
    if (correction.length === 2) {
      // Parse the complete earlier clause before replacing it. A keyword list
      // cannot prove that a visibility, frequency or other briefing was not lost.
      const previous = parse(correction[0], { single: true }, Voice);
      if (!previous?.accepted || previous.actions?.length !== 1) return reject('unclear-correction');
      const family = /^(?:set )?(qnh|qfe|squawk)\b/.exec(correction[0]);
      if (family && ['pressure', 'squawk'].includes(previous.actions[0].type)) {
        const revised = /^(?:set )?(qnh|qfe|squawk)\b/.exec(correction[1]);
        if (revised && revised[1] !== family[1]) return reject('correction-changes-field');
        body = revised ? correction[1] : `${family[1]} ${correction[1]}`;
      }
      else if (previous.actions[0].type === 'vertical' && /^(?:climb|descend)\b/.test(correction[0]) && /^(?:climb|descend)\b/.test(correction[1])) body = correction[1];
      else return reject('unclear-correction');
    }
    if (/\b(?:if|unless|negative|not|cancel|unk|dont|don't)\b/.test(body)) return reject('conditional-or-negated-call');
    if (/^(?:report (?:your )?(?:level(?: maintaining)?|altitude|height|flight level)|confirm level|level information)$/.test(body)) return accept([{ type: 'report-level',
      ...(/\bheight$/.test(body) ? { datum: 'QFE' } : /flight level$/.test(body) ? { datum: 'STANDARD' } : /altitude$/.test(body) ? { datum: 'QNH' } : {}) }]);
    if (/^(?:(?:confirm|check) altimeter(?: setting)?|report (?:your )?pressure)$/.test(body)) return accept([{ type: 'report-pressure' }]);
    if (/^(?:confirm|report(?: your)?) squawk$/.test(body)) return accept([{ type: 'report-squawk' }]);
    if (/^(?:set )?standard(?: pressure)?$/.test(body)) return accept([{ type: 'pressure', reference: 'STANDARD' }]);
    if (/^(?:stop (?:climb|climbing|descent|descending)(?: now)?|maintain (?:level|altitude))$/.test(body)) return accept([{ type: 'stop-vertical' }]);
    const rate = /^(?:set )?vertical rate (.+?)(?: feet per minute)?$/.exec(body);
    if (rate) { const n = numeric(rate[1], Voice); return n == null ? reject('invalid-vertical-rate') : accept([{ type: 'vertical-rate', value: n }]); }
    const move = /^(climb|descend|maintain)(?: to)? (.+?)(?: (?:and )?report reaching)?$/.exec(body);
    if (move) {
      const parsed = target(move[2], Voice);
      return parsed ? accept([{ type: 'vertical', direction: move[1] === 'climb' ? 'CLIMB' : move[1] === 'descend' ? 'DESCENT' : 'MAINTAIN', target: parsed, reportReaching: /report reaching$/.test(body) }]) : reject('specify-level-and-reference');
    }
    const report = /^report (reaching|passing)(?: (.+))?$/.exec(body);
    if (report) {
      const parsed = report[2] ? target(report[2], Voice) : null;
      if (report[2] && !parsed || !parsed && report[1] !== 'reaching') return reject('specify-report-level');
      return accept([{ type: 'arm-level', kind: report[1], target: parsed }]);
    }
    const sight = /^report (aerodrome|field|runway|visual)(?: (?:in sight|visual))?$/.exec(body);
    if (sight) return accept([{ type: 'report-visual', kind: sight[1] === 'runway' ? 'runway' : 'aerodrome' }]);
    // Only information fields can form a compound message; manoeuvres do not enter this scanner.
    const marker = /(?:^|\s)(?:and )?((?:set )?qnh|(?:set )?qfe|(?:set )?squawk|runway in use|surface wind|wind|temperature|dew point|visibility|cloud|trend|contact tower(?: (?:frequency|channel))?|(?:(?:set|change) )?frequency)\s+/g;
    body = body.replace(/^weather\s+/, '');
    const parts = [...body.matchAll(marker)];
    if (!parts.length || parts[0].index !== 0) return null;
    const actions = [];
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index], field = part[1].replace(/^set /, '');
      const text = body.slice(part.index + part[0].length, parts[index + 1]?.index ?? body.length).trim();
      let n;
      if (['qnh', 'qfe'].includes(field)) {
        n = numeric(text.replace(/ (?:hpa|hectopascals?|millibars?)$/, ''), Voice);
        if (n == null) return reject('invalid-pressure');
        actions.push({ type: 'pressure', reference: field.toUpperCase(), value: n });
      } else if (field === 'squawk') {
        const code = digitString(text, Voice);
        if (!/^[0-7]{4}$/.test(code || '')) return reject('invalid-squawk');
        actions.push({ type: 'squawk', value: code });
      } else if (field === 'runway in use') {
        const suffix = / (left|right|centre|center)$/.exec(text);
        const bare = suffix ? text.slice(0, suffix.index) : text;
        const code = digitString(bare, Voice);
        if (!code || Number(code) < 1 || Number(code) > 36 || code.length > 2) return reject('invalid-runway');
        actions.push({ type: 'runway', value: code.padStart(2, '0') + (suffix ? { left: 'L', right: 'R', centre: 'C', center: 'C' }[suffix[1]] : '') });
      } else if (field.includes('frequency') || field.startsWith('contact tower')) {
        n = numeric(text.replace(/ megahertz$/, ''), Voice);
        if (n == null) return reject('invalid-frequency');
        actions.push({ type: 'frequency', value: n });
      } else {
        const values = {};
        if (field.includes('wind')) {
          if (text === 'calm') { values.windSpeedKt = 0; values.windDirectionDeg = 0; }
          else {
            const match = /^(.+?) (?:degrees? |at )?(.+?) knots?(?: gust(?:ing)? (.+?) knots?)?$/.exec(text);
            // Direction and speed require a separator so four spoken digits cannot silently change meaning.
            const explicit = /^(.+?) (?:degrees?(?: at)?|at) (.+?) knots?(?: gust(?:ing)? (.+?) knots?)?$/.exec(text);
            const source = explicit || (/^\d{3} \d{1,3} knots?/.test(text) ? match : null);
            if (!source) return reject('specify-wind-degrees-and-knots');
            values.windDirectionDeg = numeric(source[1], Voice); values.windSpeedKt = numeric(source[2], Voice);
            if (source[3]) values.windGustKt = numeric(source[3], Voice);
          }
        } else if (field === 'temperature' || field === 'dew point') {
          values[field === 'temperature' ? 'temperatureC' : 'dewPointC'] = numeric(text.replace(/ degrees?(?: celsius)?$/, ''), Voice);
        } else if (field === 'visibility') {
          const units = /^(.+?) (metres|meters|kilometres|kilometers)$/.exec(text);
          if (!units) return reject('specify-visibility-unit');
          n = numeric(units[1], Voice); values.visibilityM = n == null ? null : n * (units[2].startsWith('kilo') ? 1000 : 1);
        } else if (field === 'cloud') {
          if (text === 'clear') values.cloudLayers = [];
          else {
            const layer = /^(few|scattered|broken|overcast) (.+?) feet$/.exec(text);
            if (!layer) return reject('specify-cloud-cover-base-feet');
            n = numeric(layer[2], Voice); if (n == null) return reject('invalid-cloud-base');
            values.cloudLayers = [{ cover: layer[1], baseFt: n }];
          }
        } else if (field === 'trend') values.trend = text;
        if (Object.values(values).some(v => v === null)) return reject('invalid-weather-number');
        actions.push({ type: 'weather', values });
      }
    }
    return accept(actions);
  }
  function speech(text) {
    const digits = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const numberWords = value => String(value).split('').map(digit => digits[Number(digit)]).join(' ');
    const feetWords = value => {
      const n = Number(value);
      const thousands = Math.floor(n / 1000), hundreds = Math.floor(n % 1000 / 100), remainder = n % 100;
      return [thousands ? `${numberWords(thousands)} thousand` : '', hundreds ? `${digits[hundreds]} hundred` : '',
        remainder ? numberWords(remainder) : '', !n ? 'zero' : ''].filter(Boolean).join(' ');
    };
    return text.toLowerCase().replace(/\b(\d+) feet\b/g, (_, n) => `${feetWords(n)} feet`)
      .replace(/\b(qnh|qfe)\b/g, value => value.split('').join(' '))
      .replace(/\b(\d{2})([lrc])\b/g, (_, n, suffix) => `${n} ${{ l: 'left', r: 'right', c: 'centre' }[suffix]}`)
      .replace(/\d/g, digit => `${digits[Number(digit)]} `).replace(/\./g, ' decimal ').replace(/\s+/g, ' ').trim();
  }
  return Object.freeze({ parse, numeric, target, speech });
});
