'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const release = JSON.parse(fs.readFileSync(path.resolve(root,'../../apps/web/static/app-version.json'),'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root,'training-videos.json'),'utf8'));
const media = require('../training-centre.js');
const policy = media.policy('https://qgh.example/qgh-voice/training-centre.html',release.version);
const seconds = value => { const [h,m,s] = value.split(':').map(Number); return h*3600+m*60+s; };

test('training renders preserve 1080p interface text without a second lossy distribution encode', () => {
  const generator = fs.readFileSync(path.resolve(root,'../../scripts/create-training-media.mjs'),'utf8');
  assert.match(generator, /scale=1740:880/);
  assert.match(generator, /cropFilter\(item\)/);
  assert.match(generator, /'-crf', '18'/);
  assert.match(generator, /'-tune', 'stillimage'/);
  assert.doesNotMatch(generator, /scale=1280:720/);
  assert.match(generator, /encode\(\['-i', master, '-c', 'copy'/);
});

test('training sources are high-density real-interface captures', () => {
  const captures = path.resolve(root,'../../docs/qa/v5-media-captures');
  const dimensions = file => {
    const png = fs.readFileSync(path.join(captures,file));
    assert.equal(png.subarray(1,4).toString(),'PNG');
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  };
  for (const file of ['entry.png','setup.png','normal.png','us.png','review.png','tactical.png','training.png','catalogue.png','voice.png','voice-settings.png']) {
    const image = dimensions(file);
    assert.ok(image.width >= 1000 && image.height >= 900, `${file} is not a high-density capture`);
  }
  const log = dimensions('review-log.png');
  assert.ok(log.width >= 600 && log.height >= 900, 'the narrow command log must retain its double-density text');
  assert.ok(dimensions('phone.png').width >= 1000, 'phone capture must retain triple-density text');
});

test('Training Centre hidden actions cannot be redisplayed by button layout styles', () => {
  assert.match(fs.readFileSync(path.join(root,'training-centre.css'),'utf8'), /\[hidden\]\s*\{\s*display\s*:\s*none\s*!important/);
});

test('Training Centre exposes explicit desktop and iPhone full-screen playback', () => {
  const centre = fs.readFileSync(path.join(root,'training-centre.js'),'utf8');
  assert.match(centre,/View full screen/);
  assert.match(centre,/video\.requestFullscreen/);
  assert.match(centre,/video\.webkitEnterFullscreen/);
});

test('Training Centre permits media from its packaged Windows bundle without allowing arbitrary files', () => {
  const local = media.policy('file:///C:/QGH%20Simulator/app/training-centre.html', release.version);
  assert.match(local.url('training-media/basic-controls/basic-controls.mp4', 'src'), /^file:/);
  assert.throws(() => local.url('file:///C:/outside.mp4', 'src'), /training-media/);
});

test('native release bundles whitelist and synchronize the Training Centre with its media', () => {
  const repo = path.resolve(root, '../..');
  const windows = fs.readFileSync(path.join(repo, 'apps/windows/main.js'), 'utf8');
  const android = fs.readFileSync(path.join(repo, 'apps/android/app/src/main/java/in/qgh/simulator/MainActivity.java'), 'utf8');
  const sync = fs.readFileSync(path.join(repo, 'scripts/Sync-WebAssets.ps1'), 'utf8');
  const verify = fs.readFileSync(path.join(repo, 'scripts/Verify-WebAssets.ps1'), 'utf8');
  for (const source of [windows, android, sync, verify]) assert.match(source, /training-centre\.html/);
  for (const source of [sync, verify]) {
    assert.match(source, /training-media/);
    assert.match(source, /app-version\.json/);
  }
});

test('version-linked screen guides ship complete resources and synchronized captions without initial video precache',()=>{
  assert.equal(manifest.version,release.version);
  assert.equal(manifest.videos.length,8);
  assert.ok(manifest.videos[0].durationSeconds >= 360 && manifest.videos[0].durationSeconds <= 480);
  const worker = fs.readFileSync(path.resolve(root,'../../apps/web/static/service-worker.js'),'utf8');
  assert.doesNotMatch(worker,/training-media\/[^'"\s]+\.mp4/);
  const seen = new Set();
  for (const clip of manifest.videos) {
    assert.equal(clip.presentation,'narrated-screen-guide');
    for (const resource of policy.resources(clip)) {
      assert.equal(seen.has(resource.url),false); seen.add(resource.url);
      const bytes = fs.readFileSync(path.join(root,clip[resource.kind]));
      assert.ok(bytes.length > 0 && bytes.length <= resource.limit);
      if (resource.kind === 'src') assert.equal(bytes.length,clip.bytes);
    }
    const captions = fs.readFileSync(path.join(root,clip.captions),'utf8');
    assert.match(captions,/^WEBVTT/);
    const cues = [...captions.matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})/g)];
    assert.ok(cues.length >= 6);
    let previous = 0;
    for (const cue of cues) { const start=seconds(cue[1]),end=seconds(cue[2]); assert.ok(start>=previous && end>start && end<=clip.durationSeconds+.1); previous=end; }
    const chapters = JSON.parse(fs.readFileSync(path.join(root,clip.chaptersFile),'utf8'));
    assert.equal(chapters.version,release.version);
    assert.deepEqual(chapters.chapters,clip.chapters);
    assert.ok(clip.chapters.every(c=>c.start>=0 && c.start<clip.durationSeconds));
    assert.match(fs.readFileSync(path.join(root,clip.transcript),'utf8'),/not a live microphone/i);
  }
});
