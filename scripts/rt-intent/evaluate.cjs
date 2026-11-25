// Score held-out synthetic transcripts against the shipped browser model.
'use strict';
const { classify } = require('../../packages/qgh-engine/rt-intent-model.js');
const { evaluation } = require('./phrases.json');
let correct = 0;
let total = 0;
for (const [label, phrases] of Object.entries(evaluation)) {
  const right = phrases.filter(text => (classify(text)?.intent || 'other') === label).length;
  console.log(label + ': ' + right + '/' + phrases.length);
  correct += right;
  total += phrases.length;
}
console.log('Overall: ' + correct + '/' + total + ' held-out synthetic transcripts.');
