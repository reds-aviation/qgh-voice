// Reproducible offline screen-guide production. Input screenshots are captured from the actual release UI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const captures = path.join(repo, 'docs/qa/v5-media-captures');
const work = path.join(captures, 'work'), masters = path.join(captures, 'masters');
const output = path.join(repo, 'packages/qgh-engine/training-media');
const release = JSON.parse(fs.readFileSync(path.join(repo, 'apps/web/static/app-version.json'), 'utf8'));
const catalogue = require('../packages/qgh-engine/rt-catalogue.js').entries;
const toolRoot = 'C:/Users/pc/Documents/Codex/2026-08-28/wings-over-india-picture-edit-desk/work/tools/ffmpeg/ffmpeg-master-latest-win64-gpl/bin';
const ffmpeg = process.env.QGH_FFMPEG || path.join(toolRoot, 'ffmpeg.exe');
const ffprobe = process.env.QGH_FFPROBE || path.join(path.dirname(ffmpeg), 'ffprobe.exe');
const cli = (exe, args, options = {}) => {
  const result = spawnSync(exe, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1048576, ...options });
  if (result.status !== 0) throw new Error(`${path.basename(exe)} failed: ${result.stderr || result.error || result.stdout}`);
  return result.stdout.trim();
};
const duration = file => Number(cli(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file]));
const durationLabel = seconds => `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;
function call(id) { const entry = catalogue.find(item => item.id === id); if (!entry) throw new Error(`Missing accepted call ${id}`); return entry.canonicalPhrase; }
const sentence = (screen, title, text, speech = text) => ({ screen, title, text, speech });
const clips = [
  { id: 'basic-controls', title: 'Basic controls', description: 'Single, Normal and U/S Compass: a narrated screen guide.', sentences: [
    sentence('entry', 'Choose your exercise', 'Welcome to Reds QGH Simulator. This narrated screen guide uses captures from the actual release. It explains the controls; it is not a live microphone recognition test.'),
    sentence('setup', 'Check the setup', 'Choose Single Aircraft or Tactical, then check the procedure, tracks, aircraft profile, initial distance, speed and rate of turn.'),
    sentence('setup', 'Level and airfield', 'Check initial altitude and airfield settings. A runway designator is separate from runway orientation. Keep their units clear.'),
    sentence('normal', 'Normal QGH', `In Normal QGH, ${call('right-heading')} assigns a right turn to the selected heading. The aircraft follows a curved path at its configured rate.`, 'In Normal Q G H, turn right heading two three zero assigns a right turn to the selected heading. The aircraft follows a curved path at its configured rate.'),
    sentence('us', 'U/S Compass', `In U/S Compass, use ${call('left-now')}, ${call('right-now')}, and ${call('stop-now')}. Left and right work independently.`, 'In unserviceable compass, use turn left now, turn right now, and stop turn now. Left and right work independently.'),
    sentence('normal', 'Observe the transmission', 'Request a transmission to see the direction-finding indication. It follows the aircraft during the reply, holds briefly after release, then blanks.'),
    sentence('normal', 'Control remains available', 'Watch the red acknowledgement and the highlighted control. The buttons remain available whenever you prefer manual control.'),
    sentence('review', 'Finish with review', 'Terminate the exercise to inspect the track and command history. Replay helps connect each instruction with the movement that followed.')
  ] },
  { id: 'offline-voice-setup', title: 'Offline voice setup', description: 'Prepare local resources and test headphone output.', sentences: [
    sentence('setup', 'Prepare before practice', 'Prepare voice resources while connected, before relying on offline practice. The microphone and pilot resources operate on the device after preparation.'),
    sentence('voice', 'Permission and input', 'Allow microphone access for this site. Check that the intended headset or microphone is selected in your device settings.'),
    sentence('voice', 'Pilot replies start muted', 'Pilot replies start muted. Their captions and simulated transmissions still work. Sound is optional, and manual exercise controls stay available.'),
    sentence('voice', 'Connect and test headphones', 'For audible pilot replies, wear headphones, play the headphone test, then confirm that you heard the test through them.'),
    sentence('voice', 'Choose a learning pace', 'Choose one hundred, one hundred and thirty, or one hundred and seventy words per minute. This setting controls pilot speech, not aircraft speed.'),
    sentence('voice', 'Prevent speaker feedback', 'Keep replies muted on speakers. Sound entering the microphone can be mistaken for a controller call. Device changes are not reported reliably by every browser.'),
    sentence('training', 'Prepare a fallback', 'If recognition is unavailable, use the on-screen controls and consult the accepted-call catalogue. This screen guide does not certify a microphone or headphone route.'),
    sentence('setup', 'Test on your device', 'Before a full exercise, make a short call on your own device and check the acknowledgement. Physical microphone and mobile testing remain essential.')
  ] },
  { id: 'ptt-continuous', title: 'PTT and Continuous Listening', description: 'Transmission boundaries, readback and controller priority.', sentences: [
    sentence('voice', 'Choose your listening mode', 'PTT gives you a clear transmission boundary. Continuous Listening is optional when you need hands-free calls in a quiet environment.', 'P T T gives you a clear transmission boundary. Continuous Listening is optional when you need hands free calls in a quiet environment.'),
    sentence('normal', 'Press, speak, release', 'Hold PTT, speak one complete instruction, then release. Allow the final words to arrive before treating the transmission as complete.', 'Hold P T T, speak one complete instruction, then release. Allow the final words to arrive before treating the transmission as complete.'),
    sentence('normal', 'Execution and response', 'The accepted instruction executes before the pilot reply. Check the red result and affected control instead of relying on the sound alone.'),
    sentence('voice', 'A natural pause', 'With Continuous Listening, finish the complete call and leave a short natural pause. Background conversation can be heard by the microphone.'),
    sentence('normal', 'Controller has priority', 'Controller PTT interrupts pilot audio. A fresh accepted command gets its own response. An interrupted old reply is not replayed afterward.', 'Controller P T T interrupts pilot audio. A fresh accepted command gets its own response. An interrupted old reply is not replayed afterward.'),
    sentence('voice', 'Mute when needed', 'Mute pilot sound before removing headphones. Muting does not cancel accepted instructions or stop the aircraft moving.'),
    sentence('normal', 'Keep the console visible', 'Move the compact voice control or reset its position if it obscures a control. Use the Controls toggle to manage the exercise panel.'),
    sentence('training', 'Practice complete calls', 'Practise these steps with your own microphone. The images here illustrate the interface and do not claim that a spoken call was captured during recording.')
  ] },
  { id: 'accepted-calls', title: 'Accepted calls and outcomes', description: 'Clearances, reports, information and calls outside the model.', sentences: [
    sentence('training', 'Find the exact contract', 'The accepted-call catalogue is the reference for this release. Filter by procedure or category, then read the required state and limitations.'),
    sentence('normal', 'Heading clearances', `${call('left-heading')} and turn left 140 have the same heading-turn meaning. Use a complete heading and a clear direction.`, 'Turn left heading one four zero, and turn left one four zero, have the same heading turn meaning. Use a complete heading and a clear direction.'),
    sentence('normal', 'A report is not a turn', `${call('passing-heading')} arms a report. It does not assign that heading. The aircraft reports only when it actually crosses the requested value.`, 'Report heading passing zero six five arms a report. It does not assign that heading. The aircraft reports only when it actually crosses the requested value.'),
    sentence('us', 'Respect the selected mode', 'U/S Compass uses immediate left, right and stop commands. It does not provide actual aircraft heading reports.', 'Unserviceable compass uses immediate left, right and stop commands. It does not provide actual aircraft heading reports.'),
    sentence('normal', 'Level and information', `${call('qnh')} applies a pressure setting. Weather is received as information. ${call('passing-level')} arms a separate level report.`, 'Q N H one zero one three applies a pressure setting. Weather is received as information. Report passing altitude six thousand feet arms a separate level report.'),
    sentence('training', 'Do not infer execution', 'Standby is preparation, not a turn. Unclear, conditional or negated calls must not silently create a manoeuvre. Check the displayed outcome.'),
    sentence('training', 'Outside this model', 'A landing instruction can be recognised as not simulated. It does not create an automatic landing. Use the catalogue to distinguish these outcomes.'),
    sentence('normal', 'Manual demonstration', 'These captured screens show controls and their reported states. They are a guide to intended operation; test real recognition with your own voice.')
  ] },
  { id: 'tactical-formation', title: 'Tactical QGH and formation', description: 'Addressed aircraft, selection and independent control.', sentences: [
    sentence('tactical', 'Two to four aircraft', 'Tactical QGH supports two to four aircraft. Check every callsign, colour and level before starting.', 'Tactical Q G H supports two to four aircraft. Check every callsign, colour and level before starting.'),
    sentence('tactical', 'Address each aircraft', 'Speak the configured callsign for every aircraft instruction. Text callsigns and three-digit numbers are supported. The name identifies the aircraft; colour is an additional aid.'),
    sentence('tactical', 'Selection and radio target', 'The radio target highlights during the transmission. Addressing another aircraft does not change your manual selection. Check the callsign in each acknowledgement.'),
    sentence('tactical', 'Formation leader', 'Choose the formation leader in setup. Attached followers follow its movement and preserve their formation level offsets.'),
    sentence('tactical', 'Detach before independent control', 'Stop Following Leader releases the addressed follower. It preserves its flight state until a new instruction changes it. You can then give individual turns.'),
    sentence('tactical', 'Speed and level', 'A follower must detach before choosing its own speed. Individual vertical instructions detach a follower, and level conflicts require the visible confirmation.'),
    sentence('tactical', 'Independent approaches', 'Separate instructions let you vary the timing of base turns and the distances used for individual approaches. No automatic track join is added.'),
    sentence('review', 'Review all aircraft', 'During debrief, use callsigns and track colours to follow each aircraft. Compare the accepted call, its timing and the actual path before the next exercise.')
  ] },
  { id: 'review-debrief', title: 'Review and debrief', description: 'Read the track, replay events and choose one improvement.', sentences: [
    sentence('review', 'Start with the whole path', 'After termination, the review shows the completed flight path and command history. Fit the track before inspecting a smaller section.'),
    sentence('review', 'Use the reference lines', 'Cardinal radials and configured outbound and approach references help relate the flown path to the exercise. These lines are references, not automatic clearances.'),
    sentence('review', 'Inspect curved turns', 'Turn radius depends on speed and turn rate. Inspect the overhead manoeuvre and base turn as curved paths, not single-point changes of direction.'),
    sentence('review', 'Replay deliberately', 'Choose a faster replay speed to cover quiet portions, then pause around an instruction. Zoom and fit controls let you keep the useful part of the path in view.'),
    sentence('review-log', 'Command and response', 'Match each accepted instruction to its aircraft and response. Distinguish a received information call from a report request or an applied flight action.'),
    sentence('normal', 'Armed reports', 'A request to report a heading or level creates a future condition. The report occurs only when the aircraft reaches the corresponding event.'),
    sentence('tactical', 'Look for sequencing', 'For Tactical exercises, inspect separation and detachment timing alongside each callsign. The shared display does not mean all aircraft received one clearance.'),
    sentence('setup', 'Practise one improvement', 'Choose one improvement and restart with a new random exercise. Keep the same setup or return to setup to change its demands. This is a training debrief, not operational certification.')
  ] },
  { id: 'phone-use', title: 'Phone use and offline practice', description: 'Responsive controls, audio routes and release updates.', sentences: [
    sentence('phone', 'A smaller screen', 'On a phone, keep the exercise display in view and use the Controls toggle when you need the panel. Compact aircraft tabs retain the callsigns.'),
    sentence('phone', 'Make room for the task', 'Close open settings after use. Move or reset the voice controls if they cover a control. Change orientation only when it helps your task.'),
    sentence('voice', 'Test the audio route', 'Check microphone permission and headphone output on the actual phone. A laptop test cannot prove the phone uses the same route or microphone.'),
    sentence('phone', 'Prepare offline resources', 'Open the site while connected and complete resource preparation. An installed web app still needs its resources available locally before offline practice.'),
    sentence('training', 'Save only useful clips', 'Demonstration videos are optional. Save one clip deliberately for offline use. Wait for the complete saved confirmation before disconnecting.'),
    sentence('training', 'Storage and updates', 'Remove unneeded clips to free storage. Older-version videos are not used by a new release. The remove button clears only that site’s older video caches.'),
    sentence('phone', 'Avoid interrupting a run', 'Finish the exercise before accepting an update or reloading the page. If the layout or version stays wrong, record the site, device and visible version when reporting it.'),
    sentence('training', 'Keep a manual fallback', 'Use manual controls whenever voice is unavailable. These screen guides explain the interface; physical phone, microphone and offline testing remain necessary on your device.')
  ] }
];
if (fs.existsSync(path.join(captures, 'catalogue.png'))) for (const item of clips.find(clip => clip.id === 'accepted-calls').sentences) { if (item.screen === 'training') item.screen = 'catalogue'; }
if (fs.existsSync(path.join(captures, 'voice-settings.png'))) for (const item of clips.find(clip => clip.id === 'ptt-continuous').sentences) { if (item.screen === 'voice') item.screen = 'voice-settings'; }
const required = [...new Set(clips.flatMap(clip => clip.sentences.map(item => item.screen)))];
const draft = process.argv.includes('--prepare-narration');
if (!draft) for (const name of required) if (!fs.existsSync(path.join(captures, `${name}.png`))) throw new Error(`Capture required: ${name}.png`);
for (const tool of [ffmpeg, ffprobe]) if (!fs.existsSync(tool)) throw new Error(`Tool unavailable: ${tool}`);
for (const folder of [work, masters, output]) fs.mkdirSync(folder, { recursive: true });
const plan = path.join(work, 'narration-plan.json');
fs.writeFileSync(plan, JSON.stringify({ version: release.version, source: 'Actual UI captures; narrated screen guide, not real-time recognition footage', clips }, null, 2));
cli('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(repo, 'scripts/create-training-media.ps1'), '-PlanPath', plan, '-AudioDirectory', work]);
if (draft) {
  for (const clip of clips) {
    const spoken = clip.sentences.reduce((sum, _, i) => sum + duration(path.join(work, `${clip.id}-${String(i).padStart(2, '0')}.wav`)), 0);
    console.log(`${clip.id}: ${spoken.toFixed(1)} seconds of offline narration`);
  }
  console.log('Narration is prepared; final rendering waits for release screenshots.');
  process.exit(0);
}
function stamp(seconds, comma = false) {
  const value = Math.round(seconds * 1000), ms = value % 1000;
  return `${String(Math.floor(value / 3600000)).padStart(2, '0')}:${String(Math.floor(value / 60000) % 60).padStart(2, '0')}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}${comma ? ',' : '.'}${String(ms).padStart(3, '0')}`;
}
function textFile(name, text) { const target = path.join(work, name); fs.writeFileSync(target, text); return target; }
function escapedFilterPath(file) { return file.replaceAll('\\', '/').replace(':', '\\:').replaceAll("'", "\\'"); }
function encode(args) { return cli(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args]); }
const font = escapedFilterPath(path.join(repo, 'packages/qgh-engine/fonts/ibm-plex-sans-600.ttf'));
const fontRegular = escapedFilterPath(path.join(repo, 'packages/qgh-engine/fonts/ibm-plex-sans-400.ttf'));
function focusFilter(item) {
  // Added focus markers, not a fabricated live mouse trace. Coordinates identify visible regions of actual captures.
  let box;
  if (item.screen === 'voice') box = [.31, .15, .36, .70];
  if (['normal', 'us'].includes(item.screen)) {
    box = /transmission|response|Execution/i.test(item.title) ? [.33, .20, .58, .53]
      : /Press|priority|console visible/i.test(item.title) ? [.935, .30, .06, .25]
      : [.04, .20, .27, .53];
  }
  if (!box) return '';
  const [x, y, w, h] = box;
  return `drawbox=x=iw*${x}:y=ih*${y}:w=iw*${w}:h=ih*${h}:t=3:color=0xc07835@0.90:enable='between(t,1,4)',drawbox=x=iw*${x}-6:y=ih*${y}-6:w=13:h=13:t=3:color=0xc07835:enable='between(t,1,4)',`;
}
function cropFilter(item) {
  const { screen, title } = item;
  // Editorial crops keep the control being explained large enough to read in
  // the embedded player. They use only the real interface capture; no control
  // or state is reconstructed for the video.
  if (['normal', 'us'].includes(screen)) {
    const display = /transmission|response|observe/i.test(title);
    return display
      ? 'crop=iw*0.68:ih*0.68:iw*0.32:ih*0.05,'
      : 'crop=iw*0.38:ih*0.50:0:ih*0.11,';
  }
  if (screen === 'setup') return 'crop=iw:ih*0.75:0:0,';
  if (screen === 'tactical') return 'crop=iw:ih*0.78:0:0,';
  if (screen === 'voice-settings') return 'crop=iw*0.60:ih*0.54:iw*0.40:ih*0.15,';
  if (screen === 'voice') {
    const y = /learning pace/i.test(title) ? 0.24 : /Connect and test/i.test(title) ? 0.10 : 0;
    return `crop=iw:iw*0.5625:0:ih*${y},`;
  }
  if (screen === 'review') {
    const y = /Replay deliberately/i.test(title) ? 0.46 : 0.18;
    return `crop=iw:iw*0.5625:0:ih*${y},`;
  }
  if (screen === 'review-log') return 'crop=iw:iw*0.5625:0:0,';
  if (screen === 'phone') {
    const y = /room|audio route/i.test(title) ? 0.34 : /offline resources|Storage/i.test(title) ? 0.52 : 0.05;
    return `crop=iw:iw*0.5625:0:ih*${y},`;
  }
  if (['training', 'catalogue'].includes(screen)) return 'crop=iw:iw*0.5625:0:0,';
  if (screen === 'entry') return 'crop=iw:iw*0.5625:0:ih*0.06,';
  return '';
}
const records = [], allCues = [], allChapters = [];
let combinedOffset = 0;
for (const clip of clips) {
  const mediaDir = path.join(output, clip.id); fs.mkdirSync(mediaDir, { recursive: true });
  let cursor = 0; const cues = [], segments = [];
  const audioDurations = clip.sentences.map((_, i) => duration(path.join(work, `${clip.id}-${String(i).padStart(2, '0')}.wav`)));
  const minimum = 56, totalSpeech = audioDurations.reduce((a, b) => a + b, 0);
  const padding = Math.max(.45, (minimum - totalSpeech) / clip.sentences.length);
  const titleFile = textFile(`${clip.id}-title.txt`, clip.title);
  const labelFile = textFile(`${clip.id}-label.txt`, `REDS QGH  |  ${release.version}  |  NARRATED SCREEN GUIDE`);
  for (let i = 0; i < clip.sentences.length; i++) {
    const item = clip.sentences[i], segmentDuration = audioDurations[i] + padding;
    const subtitleFile = textFile(`${clip.id}-${i}-subtitle.txt`, item.title);
    const scene = path.join(work, `${clip.id}-${i}.mp4`);
    const shot = path.join(captures, `${item.screen}.png`);
    const audio = path.join(work, `${clip.id}-${String(i).padStart(2, '0')}.wav`);
    const vf = `${focusFilter(item)}${cropFilter(item)}scale=1740:880:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:105:color=0xf4f3ef,setsar=1,drawbox=x=0:y=0:w=1920:h=84:color=0x075e60:t=fill,drawtext=fontfile='${font}':textfile='${escapedFilterPath(titleFile)}':fontcolor=white:fontsize=31:x=72:y=24,drawtext=fontfile='${fontRegular}':textfile='${escapedFilterPath(labelFile)}':fontcolor=0xd6eae5:fontsize=17:x=w-tw-70:y=31,drawbox=x=68:y=998:w=1784:h=2:color=0x007d7d:t=fill,drawtext=fontfile='${font}':textfile='${escapedFilterPath(subtitleFile)}':fontcolor=0x17262b:fontsize=25:x=72:y=1024`;
    // Interface text is the subject of these guides. Encode it once at 1080p
    // with a visually lossless still-screen setting; a second 720p encode made
    // labels and small values noticeably soft in the Training Centre player.
    encode(['-loop', '1', '-framerate', '30', '-i', shot, '-i', audio, '-t', segmentDuration.toFixed(3), '-vf', vf, '-af', 'apad', '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-ac', '1', '-movflags', '+faststart', scene]);
    const measured = duration(scene); segments.push(scene);
    cues.push({ start: cursor, end: Math.min(cursor + audioDurations[i] + .2, cursor + measured), text: item.text });
    cursor += measured;
  }
  const list = textFile(`${clip.id}-concat.txt`, segments.map(file => `file '${file.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join('\n'));
  const master = path.join(masters, `${clip.id}-1080p.mp4`);
  encode(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', master]);
  const movie = path.join(mediaDir, `${clip.id}.mp4`);
  // The concatenated master already has the final distribution settings.
  // Stream-copy prevents an unnecessary generation-loss pass.
  encode(['-i', master, '-c', 'copy', '-movflags', '+faststart', movie]);
  const seconds = duration(movie);
  const vtt = ['WEBVTT', '', ...cues.flatMap(cue => [`${stamp(cue.start)} --> ${stamp(cue.end)}`, cue.text, ''])].join('\n');
  fs.writeFileSync(path.join(mediaDir, `${clip.id}.vtt`), vtt);
  fs.writeFileSync(path.join(mediaDir, `${clip.id}.txt`), `${clip.title}\nReds QGH Simulator ${release.version}\nNarrated screen guide using actual UI captures. Not a live microphone-recognition test.\n\n${cues.map(cue => `${stamp(cue.start)} ${cue.text}`).join('\n\n')}\n`);
  const chapters = clip.sentences.map((item, i) => ({ title: item.title, start: cues[i].start }));
  fs.writeFileSync(path.join(mediaDir, `${clip.id}-chapters.json`), JSON.stringify({ version: release.version, chapters }, null, 2));
  encode(['-ss', '0', '-i', movie, '-frames:v', '1', '-q:v', '3', path.join(mediaDir, `${clip.id}.jpg`)]);
  records.push({ id: clip.id, title: clip.title, description: clip.description, version: release.version, src: `training-media/${clip.id}/${clip.id}.mp4`, captions: `training-media/${clip.id}/${clip.id}.vtt`, transcript: `training-media/${clip.id}/${clip.id}.txt`, poster: `training-media/${clip.id}/${clip.id}.jpg`, chaptersFile: `training-media/${clip.id}/${clip.id}-chapters.json`, chapters, bytes: fs.statSync(movie).size, duration: durationLabel(seconds), durationSeconds: seconds, presentation: 'narrated-screen-guide' });
  allChapters.push({ title: clip.title, start: combinedOffset });
  allCues.push(...cues.map(cue => ({ ...cue, start: cue.start + combinedOffset, end: cue.end + combinedOffset })));
  combinedOffset += seconds;
  console.log(`Created ${clip.id}: ${seconds.toFixed(1)} seconds, ${(fs.statSync(movie).size / 1048576).toFixed(2)} MB`);
}
const fullId = 'complete-walkthrough', fullDir = path.join(output, fullId); fs.mkdirSync(fullDir, { recursive: true });
const masterList = textFile('walkthrough-masters.txt', clips.map(clip => `file '${path.join(masters, `${clip.id}-1080p.mp4`).replaceAll('\\', '/')}'`).join('\n'));
const fullMaster = path.join(masters, `${fullId}-1080p.mp4`);
encode(['-f', 'concat', '-safe', '0', '-i', masterList, '-c', 'copy', '-movflags', '+faststart', fullMaster]);
const distributionList = textFile('walkthrough-distribution.txt', records.map(record => `file '${path.join(repo, 'packages/qgh-engine', record.src).replaceAll('\\', '/')}'`).join('\n'));
const fullVideo = path.join(fullDir, `${fullId}.mp4`);
encode(['-f', 'concat', '-safe', '0', '-i', distributionList, '-c', 'copy', '-movflags', '+faststart', fullVideo]);
const completeSeconds = duration(fullVideo);
if (completeSeconds < 360 || completeSeconds > 480) throw new Error(`Walkthrough must be 6–8 minutes; measured ${completeSeconds}`);
fs.writeFileSync(path.join(fullDir, `${fullId}.vtt`), ['WEBVTT', '', ...allCues.flatMap(cue => [`${stamp(cue.start)} --> ${stamp(cue.end)}`, cue.text, ''])].join('\n'));
fs.writeFileSync(path.join(fullDir, `${fullId}.txt`), `Complete QGH walkthrough\nReds QGH Simulator ${release.version}\nNarrated screen guide using actual UI captures. This is not a live microphone-recognition test.\n\n${allCues.map(cue => `${stamp(cue.start)} ${cue.text}`).join('\n\n')}\n`);
fs.writeFileSync(path.join(fullDir, `${fullId}-chapters.json`), JSON.stringify({ version: release.version, chapters: allChapters }, null, 2));
encode(['-ss', '0', '-i', fullVideo, '-frames:v', '1', '-q:v', '3', path.join(fullDir, `${fullId}.jpg`)]);
records.unshift({ id: fullId, title: 'Complete QGH walkthrough', description: 'Seven narrated screen guides in one chaptered walkthrough. Actual interface captures; not a live recognition test.', version: release.version, src: `training-media/${fullId}/${fullId}.mp4`, captions: `training-media/${fullId}/${fullId}.vtt`, transcript: `training-media/${fullId}/${fullId}.txt`, poster: `training-media/${fullId}/${fullId}.jpg`, chaptersFile: `training-media/${fullId}/${fullId}-chapters.json`, chapters: allChapters, bytes: fs.statSync(fullVideo).size, duration: durationLabel(completeSeconds), durationSeconds: completeSeconds, presentation: 'narrated-screen-guide' });
fs.writeFileSync(path.join(repo, 'packages/qgh-engine/training-videos.json'), JSON.stringify({ schemaVersion: 1, versionSource: 'app-version.json', version: release.version, productionStatus: 'screen-guides-ready', generatedWith: 'Offline Windows SAPI and ffmpeg; actual release screenshot captures', videos: records }, null, 2) + '\n');
const totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);
console.log(`Complete: ${records.length} videos, ${(totalBytes / 1048576).toFixed(2)} MB, ${completeSeconds.toFixed(1)} second walkthrough.`);
