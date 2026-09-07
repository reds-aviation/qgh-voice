// Maintenance-only helper for regenerating the pinned offline pilot clip recipe.
// It performs no synthesis and makes no network requests. The source cache must
// contain the checked CMU dictionary and Kokoro tokenizer used by the renderer.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { phonemize, parseDictionary, tokenize } from '../packages/qgh-engine/vendor/pilot-tts/build-phonemes.mjs';

const engineRoot = fileURLToPath(new URL('../packages/qgh-engine/', import.meta.url));
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const sourceCache = path.resolve(option('--source-cache', path.join(tmpdir(), 'qgh-pilot-tts-build-441')));
const output = path.resolve(option('--output', path.join(engineRoot, 'vendor/pilot-tts/render-recipe.json')));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = Object.freeze({
  cmudict: '81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22',
  tokenizer: '77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34'
});

const cmudictBytes = await readFile(path.join(sourceCache, 'cmudict.dict'));
const tokenizerBytes = await readFile(path.join(sourceCache, 'tokenizer.json'));
if (digest(cmudictBytes) !== expected.cmudict) throw new Error('CMU dictionary checksum mismatch.');
if (digest(tokenizerBytes) !== expected.tokenizer) throw new Error('Kokoro tokenizer checksum mismatch.');
const dictionary = parseDictionary(cmudictBytes.toString('utf8'));
// These procedure terms are absent from the pinned CMU dictionary. Keeping the
// pronunciation here prevents the renderer from spelling them letter by letter.
dictionary.set('hectopascal', 'HH EH2 K T OW0 P AE1 S K AH0 L');
dictionary.set('hectopascals', 'HH EH2 K T OW0 P AE1 S K AH0 L Z');
dictionary.set('wilco', 'W IH1 L K OW0');
const vocabulary = JSON.parse(tokenizerBytes.toString('utf8')).model.vocab;

const basePhrases = [
  'Radio check. Pilot replies are set to one hundred words per minute.',
  'Roger', 'Instruction received. This action is not simulated',
  'Will resume normal after this orbit', 'Resuming normal',
  'Orbit complete, continuing left orbit', 'Orbit complete, continuing right orbit',
  'Continuing left orbit', 'Continuing right orbit', 'Orbiting left', 'Orbiting right',
  'Turning left', 'Turning right', 'Stop turn', 'Roger, turning left', 'Roger, turning right',
  'Will report passing', 'Passed', 'Passing', 'Heading', 'Range', 'decimal', 'nautical miles',
  'Transmitting for direction finding', 'Speed', 'knots', 'Flying independently',
  'Falcon', 'Raven', 'Viper', 'Hawk', 'Eagle',
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'tree', 'fife', 'niner'
];
const procedurePhrases = [
  // Pressure, runway, transponder and frequency readbacks.
  'Q N H', 'Q F E', 'hectopascals set', 'set', 'standard pressure set',
  'runway', 'left', 'right', 'centre', 'squawk', 'frequency', 'megahertz',
  // Vertical-state and deferred-report vocabulary.
  'maintaining', 'maintaining altitude', 'maintaining height', 'maintaining flight level',
  'passing altitude', 'passing height', 'passing flight level',
  'climbing', 'climbing to altitude', 'climbing to height', 'climbing to flight level',
  'descending', 'descending to altitude', 'descending to height', 'descending to flight level',
  'altitude', 'height', 'flight level', 'thousand', 'hundred', 'feet',
  'vertical rate', 'feet per minute', 'wilco', 'will report reaching', 'reaching',
  // Information, visual, standby and overhead responses.
  'Roger, weather received', 'weather received', 'aerodrome in sight', 'runway in sight',
  'negative', 'aerodrome not in sight', 'runway not in sight', 'standing by',
  'request received, not simulated', 'say again', 'overhead indication one of two',
  'overhead confirmed'
];
const letterNames = [
  'ay', 'bee', 'see', 'dee', 'ee', 'eff', 'gee', 'aitch', 'eye', 'jay', 'kay', 'ell', 'em',
  'en', 'oh', 'pee', 'cue', 'are', 'ess', 'tee', 'you', 'vee', 'double you', 'ex', 'why', 'zee'
];
const letterIPA = [
  'ˈeɪ', 'bˈi', 'sˈi', 'dˈi', 'ˈi', 'ˈɛf', 'dʒˈi', 'ˈeɪtʃ', 'ˈaɪ',
  'dʒˈeɪ', 'kˈeɪ', 'ˈɛl', 'ˈɛm', 'ˈɛn', 'ˈoʊ', 'pˈi', 'kjˈu', 'ˈɑɹ',
  'ˈɛs', 'tˈi', 'jˈu', 'vˈi', 'dˈʌbəl jˈu', 'ˈɛks', 'wˈaɪ', 'zˈi'
];
const digitNames = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
// This one voice/token pair naturally lands just above the default 2.0 tempo
// bound. Keep the real one-word count and permit only this named clip to use a
// measured, narrow normalization exception.
const tempoMaxFactors = Object.freeze({ frequency: 2.1 });
// George's naturally slower rendering of this three-syllable word needs a
// slightly faster native synthesis speed so pitch-preserving normalization can
// remain inside the default 2.0 limit. Runtime 100/130/170 WPM is unchanged.
const voiceSpeedMultipliers = Object.freeze({
  maintaining: Object.freeze({ bm_george: 1.2 }),
  descending: Object.freeze({ bm_george: 1.1 }),
  altitude: Object.freeze({ bm_george: 1.1 })
});
const normalizedKey = text => String(text).normalize('NFKC').toLowerCase()
  .replace(/(\d)\.(?=\d)/g, '$1 decimal ')
  .replace(/\d/g, digit => ` ${digitNames[Number(digit)]} `)
  .replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const phrases = [...basePhrases, ...procedurePhrases];
const seen = new Set();
const segments = phrases.map(text => {
  const key = normalizedKey(text);
  if (!key || seen.has(key)) throw new Error(`Duplicate or empty pilot phrase: ${text}`);
  seen.add(key);
  return { key, text, kind: 'phrase', words: key.split(' ').length, phonemes: phonemize(text, dictionary),
    ...(tempoMaxFactors[key] ? { tempoMaxFactor: tempoMaxFactors[key] } : {}),
    ...(voiceSpeedMultipliers[key] ? { voiceSpeedMultipliers: voiceSpeedMultipliers[key] } : {}) };
});
for (let index = 0; index < 26; index += 1) {
  segments.push({ key: `letter:${String.fromCharCode(97 + index)}`, text: letterNames[index], kind: 'letter',
    words: index === 22 ? 2 : 1, phonemes: letterIPA[index] });
}
for (const segment of segments) segment.ids = Array.from(tokenize(segment.phonemes, vocabulary), Number);

const recipe = {
  modelRevision: '1939ad2a8e416c0acfeecc08a694d14ef25f2231',
  phonemeSources: { cmudictSha256: expected.cmudict, tokenizerSha256: expected.tokenizer },
  nativeRenderSpeedMultipliers: voiceSpeedMultipliers,
  tempoNormalization: {
    algorithmVersion: 1, targetWPM: 100, sampleRate: 24000, samplesPerWord: 14400,
    filter: 'atempo', minFactor: 0.5, maxFactor: 2.0, maxSilenceAdjustmentSamples: 720,
    segmentMaxFactorOverrides: tempoMaxFactors,
    ffmpegVersion: '7.1-essentials_build-www.gyan.dev',
    ffmpegDistribution: 'imageio-ffmpeg==0.6.0, Windows x86_64',
    ffmpegSha256: '2ce797a0f88d7f067180338fb227f7b1928ea727bd9a4d7a1d022f7c52af71a3'
  },
  voices: [
    { id: 'am_michael', speed: 0.8167 }, { id: 'am_fenrir', speed: 0.7083 },
    { id: 'am_puck', speed: 0.7056 }, { id: 'bm_george', speed: 0.8333 }
  ],
  segments
};
await writeFile(output, `${JSON.stringify(recipe, null, 2)}\n`);
console.log(`Prepared ${segments.length} deterministic pilot segments at ${output}`);
