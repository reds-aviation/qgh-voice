(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QGHTrainingMedia = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const limits = Object.freeze({ src: 192 * 1048576, captions: 512 * 1024, transcript: 2 * 1048576, poster: 4 * 1048576 });
  const extensions = { src: /\.(mp4|webm)$/i, captions: /\.vtt$/i, transcript: /\.(txt|md|html)$/i, poster: /\.(jpg|jpeg|png|webp)$/i };
  function policy(href, version) {
    if (!/^[\w.\-]+$/.test(version || '')) throw new Error('Invalid release');
    const site = new URL('./', href), media = new URL('training-media/', site);
    const prefix = `qgh-training-videos:${encodeURIComponent(site.pathname)}:`;
    function url(path, kind) {
      if (typeof path !== 'string' || !path.trim() || !extensions[kind]) throw new Error('Missing media resource');
      const resolved = new URL(path, site);
      const sameLocalBundle = site.protocol === 'file:' && resolved.protocol === 'file:';
      if ((!sameLocalBundle && (resolved.origin !== site.origin || !['https:', 'http:'].includes(resolved.protocol))) || resolved.username || resolved.password || resolved.search || resolved.hash || !resolved.pathname.startsWith(media.pathname)) throw new Error('Media must belong to this simulator’s training-media directory');
      const relative = resolved.pathname.slice(media.pathname.length);
      if (!relative || /%|\\|(?:^|\/)\.{1,2}(?:\/|$)/.test(relative) || !extensions[kind].test(relative)) throw new Error('Invalid media path');
      return resolved.href;
    }
    function resources(clip) {
      if (!/^[a-z0-9-]+$/.test(clip.id || '') || clip.version !== version || !Number.isSafeInteger(clip.bytes) || clip.bytes <= 0 || clip.bytes > limits.src) throw new Error('Invalid clip metadata');
      const files = ['src', 'captions', 'transcript', ...(clip.poster ? ['poster'] : [])].map(kind => ({ kind, url: url(clip[kind], kind), limit: kind === 'src' ? clip.bytes : limits[kind] }));
      if (new Set(files.map(file => file.url)).size !== files.length) throw new Error('Duplicate media resource');
      return files;
    }
    function marker(clip) { resources(clip); return new URL(`.offline-${version}-${clip.id}.json`, media).href; }
    function signature(clip) { return JSON.stringify({ version, id: clip.id, bytes: clip.bytes, files: resources(clip).map(file => file.url) }); }
    return Object.freeze({ prefix, cacheName: prefix + version, url, resources, marker, signature,
      oldCache: name => typeof name === 'string' && name.startsWith(prefix) && name !== prefix + version });
  }
  async function readBounded(response, resource) {
    async function rejectDownload(message) { await response?.body?.cancel?.().catch(() => {}); throw new Error(message); }
    if (!response?.ok || response.type === 'opaque' || response.redirected) return rejectDownload('Media download failed');
    const declared = response.headers.get('content-length');
    const compressed = Boolean(response.headers.get('content-encoding'));
    if (declared != null && (!/^\d+$/.test(declared) || Number(declared) > resource.limit)) return rejectDownload('Media size exceeds its limit');
    if (!response.body?.getReader) return rejectDownload('Bounded download is unavailable');
    const reader = response.body.getReader(), chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > resource.limit) throw new Error('Media size exceeds its limit');
        chunks.push(value);
      }
      if (!total || resource.kind === 'src' && total !== resource.limit || !compressed && declared != null && Number(declared) !== total) throw new Error('Incomplete media download');
      const types = { src: 'video/', captions: 'text/vtt', transcript: 'text/', poster: 'image/' };
      const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (!mime.startsWith(types[resource.kind])) throw new Error('Unexpected media format');
      return new Blob(chunks, { type: mime });
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
  }
  async function cachedClip(cache, rules, clip) {
    const completion = await cache.match(rules.marker(clip));
    if (!completion) return null;
    const record = await completion.json();
    if (record.signature !== rules.signature(clip) || !Array.isArray(record.files)) return null;
    const blobs = new Map();
    for (const resource of rules.resources(clip)) {
      const stored = record.files.find(file => file.url === resource.url);
      if (!stored || !Number.isSafeInteger(stored.bytes) || stored.bytes <= 0 || stored.bytes > resource.limit) return null;
      const response = await cache.match(resource.url);
      if (!response) return null;
      const blob = await readBounded(response, resource);
      if (blob.size !== stored.bytes) return null;
      blobs.set(resource.url, blob);
    }
    return blobs;
  }
  async function saveClip(cache, rules, clip, fetchFile = fetch) {
    // The completion record is committed last. Closing the tab mid-save leaves an unusable partial copy.
    await cache.delete(rules.marker(clip));
    const files = [];
    try {
      for (const resource of rules.resources(clip)) {
        const response = await fetchFile(resource.url, { cache: 'no-cache', redirect: 'error', credentials: 'same-origin' });
        const blob = await readBounded(response, resource);
        await cache.put(resource.url, new Response(blob, { headers: { 'Content-Type': blob.type, 'Content-Length': String(blob.size) } }));
        files.push({ url: resource.url, bytes: blob.size });
      }
      await cache.put(rules.marker(clip), new Response(JSON.stringify({ signature: rules.signature(clip), files }), { headers: { 'Content-Type': 'application/json' } }));
      if (!await cachedClip(cache, rules, clip)) throw new Error('Offline verification failed');
    } catch (error) {
      await cache.delete(rules.marker(clip));
      await Promise.allSettled(files.map(file => cache.delete(file.url)));
      throw error;
    }
  }
  return Object.freeze({ policy, readBounded, cachedClip, saveClip, limits });
});

(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  const Media = globalThis.QGHTrainingMedia;
  const $ = id => document.getElementById(id);
  const entries = globalThis.QGHRTCatalogue?.entries || [];
  const params = new URLSearchParams(location.search);
  const versionPromise = fetch('app-version.json', { cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error('Release information is unavailable');
    return response.json();
  }).then(data => {
    if (typeof data.version !== 'string' || !/^[\w.\-]+$/.test(data.version)) throw new Error('Release information is invalid');
    $('guideVersion').textContent = data.releaseName || `Version ${data.version}`;
    $('releaseDetail').textContent = `${data.name || 'Reds QGH Simulator'} · ${data.releaseName || data.version}${data.updated ? ` · Updated ${data.updated}` : ''}. Guide and catalogue are delivered with this installation.`;
    return data;
  }).catch(() => {
    $('guideVersion').textContent = 'Release information unavailable';
    $('releaseDetail').textContent = 'The release metadata could not be read. Written guidance remains available. Reopen while connected to check this installation’s version.';
    return null;
  });
  function node(tag, text, attributes = {}) {
    const result = document.createElement(tag);
    if (text != null) result.textContent = text;
    Object.entries(attributes).forEach(([name, value]) => result.setAttribute(name, value));
    return result;
  }
  function paragraph(parent, title, text) { const p = node('p'); p.append(node('strong', `${title}: `), document.createTextNode(text)); parent.append(p); }
  let visibleEntries = entries;
  function renderCalls() {
    const query = $('callSearch').value.trim().toLowerCase();
    const mode = $('modeFilter').value, category = $('categoryFilter').value;
    visibleEntries = entries.filter(entry => (mode === 'all' || entry.modes.includes(mode)) && (category === 'all' || entry.category === category) && (!query || [entry.canonicalPhrase, ...entry.acceptedVariants, entry.category, entry.simulatorEffect, entry.limitations].join(' ').toLowerCase().includes(query)));
    $('callCount').textContent = `${visibleEntries.length} of ${entries.length} calls`;
    const fragment = document.createDocumentFragment();
    for (const entry of visibleEntries) {
      const card = node('article', null, { class: 'call-card', id: `call-${entry.id}` });
      const top = node('div', null, { class: 'call-top' });
      top.append(node('h3', entry.canonicalPhrase), node('span', entry.classification, { class: 'call-badge' })); card.append(top);
      card.append(node('p', entry.simulatorEffect));
      if (entry.acceptedVariants.length) paragraph(card, 'Also accepted', entry.acceptedVariants.join(' · '));
      const detail = node('details'); detail.append(node('summary', 'State, reply and limits'));
      const list = node('dl');
      const fields = [['When', entry.requiredState], ['Callsign', entry.callsignRule], ['Reply', entry.pilotResponseClass.replaceAll('_', ' ')], ['D/F', entry.dfBehavior], ['Limits', entry.limitations]];
      fields.forEach(([key, value]) => list.append(node('dt', key), node('dd', value)));
      detail.append(list); card.append(detail); fragment.append(card);
    }
    if (!visibleEntries.length) fragment.append(node('p', 'No matching calls. Try a shorter search or choose All procedures and All categories.', { class: 'empty-state' }));
    $('callResults').replaceChildren(fragment);
  }
  ['callSearch', 'modeFilter', 'categoryFilter'].forEach(id => $(id).addEventListener('input', renderCalls));
  document.querySelectorAll('[data-call-filter]').forEach(link => link.addEventListener('click', () => { $('modeFilter').value = link.dataset.callFilter; renderCalls(); }));
  const initialMode = params.get('mode');
  if (['normal', 'us', 'tactical'].includes(initialMode)) $('modeFilter').value = initialMode;
  if (params.has('q')) $('callSearch').value = params.get('q');
  renderCalls();
  $('printReference').addEventListener('click', () => window.print());
  let previouslyOpen = [];
  window.addEventListener('beforeprint', () => {
    previouslyOpen = [...document.querySelectorAll('details')].map(detail => [detail, detail.open]);
    previouslyOpen.forEach(([detail]) => { detail.open = true; });
  });
  window.addEventListener('afterprint', () => { previouslyOpen.forEach(([detail, open]) => { detail.open = open; }); });
  const helpAliases = { continuous: 'continuous-listening', 'report-heading-passing': 'heading-passing', 'resume': 'resume-normal', 'detach': 'stop-following-leader', 'pilot-replies': 'voice', 'headphones': 'voice', 'level': 'controls' };
  function revealTopic() {
    const requested = location.hash.slice(1) || params.get('topic') || params.get('help');
    const target = document.getElementById(helpAliases[requested] || requested);
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    target.scrollIntoView({ block: 'start' });
  }
  if ('IntersectionObserver' in window) {
    const sections = [...document.querySelectorAll('main>.section')];
    const active = new Map();
    const observer = new IntersectionObserver(changes => {
      changes.forEach(change => active.set(change.target.id, change.isIntersecting));
      const current = sections.find(section => active.get(section.id));
      if (!current) return;
      document.querySelectorAll('.section-nav a').forEach(link => {
        if (link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-10% 0px -50% 0px' });
    sections.forEach(section => observer.observe(section));
  }
  window.addEventListener('hashchange', revealTopic);
  requestAnimationFrame(revealTopic);

  const blobs = new Map();
  function releaseBlobs(id) { (blobs.get(id) || []).forEach(URL.revokeObjectURL); blobs.delete(id); }
  async function bindOffline(clip, video, track, transcriptLink, rules) {
    if (!('caches' in window)) return false;
    const cache = await caches.open(rules.cacheName);
    const saved = await Media.cachedClip(cache, rules, clip);
    if (!saved) return false;
    const objectUrls = [];
    const objects = new Map();
    for (const [path, blob] of saved) { const value = URL.createObjectURL(blob); objects.set(path, value); objectUrls.push(value); }
    releaseBlobs(clip.id); blobs.set(clip.id, objectUrls);
    video.src = objects.get(rules.url(clip.src, 'src'));
    track.src = objects.get(rules.url(clip.captions, 'captions'));
    transcriptLink.href = objects.get(rules.url(clip.transcript, 'transcript'));
    if (clip.poster) video.poster = objects.get(rules.url(clip.poster, 'poster'));
    return true;
  }
  function onlineSources(clip, video, track, transcriptLink, rules) {
    video.src = rules.url(clip.src, 'src'); track.src = rules.url(clip.captions, 'captions'); transcriptLink.href = rules.url(clip.transcript, 'transcript');
    if (clip.poster) video.poster = rules.url(clip.poster, 'poster');
  }
  async function oldVideoControls(rules) {
    if (!('caches' in window)) return;
    const old = (await caches.keys()).filter(rules.oldCache);
    if (!old.length) return;
    const wrap = node('div', null, { class: 'note' });
    const status = node('p', `${old.length} previous-version video cache${old.length === 1 ? '' : 's'} saved for this site. They are not used by this release.`, { role: 'status' });
    const remove = node('button', 'Remove previous-version videos', { type: 'button' });
    wrap.append(status, remove); $('videoResults').before(wrap);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        const currentOld = (await caches.keys()).filter(rules.oldCache);
        await Promise.all(currentOld.map(name => caches.delete(name)));
        status.textContent = 'Previous-version videos removed. Current videos and simulator data are unchanged.'; remove.hidden = true;
      } catch { status.textContent = 'Previous-version videos could not be removed. Please retry.'; }
      finally { remove.disabled = false; }
    });
  }
  async function renderVideos() {
    try {
      const [release, response] = await Promise.all([versionPromise, fetch('training-videos.json', { cache: 'no-cache' })]);
      if (!response.ok) throw new Error('Manifest unavailable');
      const manifest = await response.json();
      if (!Array.isArray(manifest.videos)) throw new Error('Manifest invalid');
      const rules = release ? Media.policy(location.href, release.version) : null;
      if (rules) await oldVideoControls(rules).catch(() => {});
      if (!manifest.videos.length) {
        $('videoStatus').textContent = 'Recordings are being prepared after the exercise controls are finalised. There are no video downloads in this candidate; the written guide is ready to use.';
        $('videoStatus').className = 'empty-state'; return;
      }
      if (!release) throw new Error('Version unavailable');
      const ids = new Set(), claimedFiles = new Set();
      const valid = manifest.videos.filter(clip => {
        try {
          const files = rules.resources(clip);
          if (!clip.title || ids.has(clip.id) || files.some(file => claimedFiles.has(file.url))) return false;
          ids.add(clip.id); files.forEach(file => claimedFiles.add(file.url)); return true;
        } catch { return false; }
      });
      $('videoStatus').textContent = valid.length ? `${valid.length} demonstrations for this release. No clip plays automatically; offline saving is optional. Use View Full Screen for fine simulator labels.` : 'No demonstration matches this installed release. Written guidance remains available.';
      for (const clip of valid) {
        const card = node('article', null, { class: 'video-card' });
        card.append(node('h3', clip.title), node('p', `${clip.description || ''} · ${(clip.bytes / 1048576).toFixed(1)} MB${clip.duration ? ` · ${clip.duration}` : ''}`));
        const video = node('video', null, { controls: '', preload: 'metadata', playsinline: '', 'aria-label': clip.title });
        const track = node('track', null, { kind: 'captions', srclang: 'en', label: 'English', default: '' }); video.append(track);
        const transcript = node('a', 'Read transcript', { class: 'button', target: '_blank', rel: 'noopener' });
        onlineSources(clip, video, track, transcript, rules);
        // Load metadata only; complete offline saving requires the user's button press.
        video.addEventListener('play', () => { document.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); }); });
        const expand = node('button', 'View full screen', { type: 'button' });
        const save = node('button', 'Make available offline', { type: 'button' });
        const remove = node('button', 'Remove offline copy', { type: 'button', hidden: '' });
        const row = node('div', null, { class: 'action-row' }); row.append(expand, save, remove, transcript);
        const status = node('p', '', { class: 'video-state', role: 'status', 'aria-live': 'polite' });
        card.append(video, row, status); $('videoResults').append(card);
        expand.addEventListener('click', async () => {
          try {
            if (video.requestFullscreen) await video.requestFullscreen();
            else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
            else throw new Error('unsupported');
          } catch { status.textContent = 'Full-screen video is unavailable in this browser. Rotate the device or use its video full-screen control.'; }
        });
        const chapters = (Array.isArray(clip.chapters) ? clip.chapters : []).filter(chapter => typeof chapter.title === 'string' && Number.isFinite(chapter.start) && chapter.start >= 0);
        if (chapters.length) {
          const label = node('label', 'Jump to chapter', { class: 'video-chapters' });
          const select = node('select', null, { 'aria-label': `Chapters: ${clip.title}` });
          select.append(node('option', 'Choose a chapter', { value: '' }));
          chapters.forEach(chapter => select.append(node('option', `${Math.floor(chapter.start / 60)}:${String(Math.floor(chapter.start % 60)).padStart(2, '0')} · ${chapter.title}`, { value: String(chapter.start) })));
          select.addEventListener('change', () => {
            if (select.value === '') return;
            const seconds = Number(select.value);
            const seek = () => { if (Number.isFinite(video.duration)) video.currentTime = Math.min(seconds, video.duration); };
            if (video.readyState > 0) seek();
            else video.addEventListener('loadedmetadata', seek, { once: true });
          });
          label.append(select); card.append(label);
        }
        if (!('caches' in window)) { save.disabled = true; status.textContent = 'Offline video storage is unavailable in this browser.'; }
        else {
          try { if (await bindOffline(clip, video, track, transcript, rules)) { save.hidden = true; remove.hidden = false; status.textContent = 'Available offline for this version.'; } } catch { status.textContent = 'Saved media could not be opened. You can try saving this clip again.'; }
        }
        save.addEventListener('click', async () => {
          save.disabled = true; status.textContent = 'Saving the clip, captions and transcript. Keep this page open…';
          let cache;
          try {
            const estimate = await navigator.storage?.estimate?.();
            if (estimate?.quota && estimate.quota - estimate.usage < clip.bytes * 1.1) throw new Error('storage');
            cache = await caches.open(rules.cacheName);
            await Media.saveClip(cache, rules, clip);
            if (!await bindOffline(clip, video, track, transcript, rules)) throw new Error('verification');
            save.hidden = true; remove.hidden = false; status.textContent = 'Available offline for this version.';
          } catch {
            if (cache) await cache.delete(rules.marker(clip)).catch(() => {});
            status.textContent = 'The clip could not be saved. Check your connection and available storage, then retry. No incomplete copy is marked offline.';
          } finally { save.disabled = false; }
        });
        remove.addEventListener('click', async () => {
          remove.disabled = true; video.pause();
          try {
            const cache = await caches.open(rules.cacheName);
            await cache.delete(rules.marker(clip));
            await Promise.all(rules.resources(clip).map(file => cache.delete(file.url)));
            releaseBlobs(clip.id); onlineSources(clip, video, track, transcript, rules); save.hidden = false; remove.hidden = true;
            status.textContent = 'Offline copy removed. This clip now requires a connection.';
          } catch { status.textContent = 'The offline copy could not be removed. Please retry.'; }
          finally { remove.disabled = false; }
        });
      }
    } catch {
      $('videoStatus').textContent = 'Demonstrations could not be loaded. You can use the complete written guide and accepted-call catalogue above.';
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) document.querySelectorAll('video').forEach(video => video.pause()); });
  window.addEventListener('pagehide', event => {
    document.querySelectorAll('video').forEach(video => video.pause());
    if (!event.persisted) for (const id of blobs.keys()) releaseBlobs(id);
  });
  renderVideos();
})();
