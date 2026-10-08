(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATSTutorialPlayer = api;
  if (typeof document !== 'undefined') api.load(document, root);
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const host = 'https://www.youtube-nocookie.com';
  function configuration(value, version) {
    if (!value || value.status !== 'ready' || value.version !== version) return null;
    if (!/^[a-zA-Z0-9_-]{11}$/.test(value.youtubeId || '') || typeof value.title !== 'string' || !value.title.trim()
      || !Number.isFinite(value.durationSeconds) || value.durationSeconds <= 0) return null;
    if (!Array.isArray(value.chapters) || !value.chapters.length
      || (value.chapterCount !== undefined && (!Number.isSafeInteger(value.chapterCount)
        || value.chapterCount < 1 || value.chapterCount !== value.chapters.length))) return null;
    const chapters = value.chapters;
    if (chapters[0]?.startSeconds !== 0) return null;
    const ids = new Set();
    let previous = -1;
    for (const chapter of chapters) {
      if (!chapter || typeof chapter.id !== 'string' || !chapter.id.trim() || ids.has(chapter.id)
        || !Number.isSafeInteger(chapter.startSeconds) || chapter.startSeconds < 0 || chapter.startSeconds <= previous
        || typeof chapter.title !== 'string' || !chapter.title.trim()
        || chapter.startSeconds >= value.durationSeconds) return null;
      ids.add(chapter.id);
      previous = chapter.startSeconds;
    }
    return { youtubeId: value.youtubeId, title: value.title.trim(), chapters };
  }
  function embedUrl(videoId, seconds = 0) {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId) || !Number.isInteger(seconds) || seconds < 0) throw new Error('Invalid tutorial destination');
    const url = new URL(`${host}/embed/${videoId}`);
    url.search = new URLSearchParams({ autoplay: '0', playsinline: '1', rel: '0', cc_load_policy: '1', start: String(seconds) });
    return url.href;
  }
  function watchUrl(videoId, seconds = 0) {
    const url = new URL('https://www.youtube.com/watch');
    url.search = new URLSearchParams({ v: videoId, t: String(seconds) });
    return url.href;
  }
  function mount(doc, win, value) {
    const card = doc.getElementById('suiteTutorial');
    if (!card || !value || !/^https?:$/.test(win.location.protocol)) return null;
    const launch = doc.getElementById('suiteTutorialLaunch'), stop = doc.getElementById('suiteTutorialStop');
    const select = doc.getElementById('suiteTutorialChapter'), chapterLabel = doc.getElementById('suiteTutorialChapterLabel');
    const player = doc.getElementById('suiteTutorialPlayer'), status = doc.getElementById('suiteTutorialStatus');
    const external = doc.getElementById('suiteTutorialYouTube');
    let frame = null, seconds = 0;
    doc.getElementById('suiteTutorialTitle').textContent = value.title;
    card.hidden = false;
    for (const chapter of value.chapters) {
      const option = doc.createElement('option');
      option.value = String(chapter.startSeconds);
      option.textContent = `${Math.floor(chapter.startSeconds / 60)}:${String(chapter.startSeconds % 60).padStart(2, '0')} · ${chapter.title}`;
      select.append(option);
    }
    chapterLabel.hidden = !value.chapters.length;
    function updateLink() { external.href = watchUrl(value.youtubeId, seconds); }
    function stopPlayer(message = 'Video stopped. Choose Load tutorial to open it again.') {
      if (!frame) return;
      frame.remove(); frame = null; player.hidden = true; launch.hidden = false; stop.hidden = true;
      status.textContent = message;
    }
    function openPlayer(focusPlayer = false) {
      if (win.navigator.onLine === false) {
        stopPlayer(); status.textContent = 'YouTube needs an internet connection. The written guide and saved local clips remain available.';
        return;
      }
      doc.querySelectorAll('video').forEach(video => video.pause());
      if (frame) frame.remove();
      frame = doc.createElement('iframe');
      frame.id = 'suiteTutorialFrame'; frame.title = value.title;
      frame.setAttribute('allow', 'encrypted-media; fullscreen; picture-in-picture');
      frame.setAttribute('allowfullscreen', '');
      // YouTube requires client identification. Send only the site origin, not
      // its paths or query values, despite the site's default no-referrer policy.
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      frame.setAttribute('src', embedUrl(value.youtubeId, seconds));
      player.replaceChildren(frame); player.hidden = false; launch.hidden = true; stop.hidden = false;
      status.textContent = 'Press Play in the player. You can use its captions and full-screen controls, or Watch on YouTube below.';
      if (focusPlayer) frame.focus({ preventScroll: true });
    }
    launch.addEventListener('click', () => openPlayer(true));
    stop.addEventListener('click', () => { stopPlayer(); launch.focus({ preventScroll: true }); });
    select.addEventListener('change', () => {
      seconds = select.value === '' ? 0 : Number(select.value);
      updateLink(); openPlayer();
    });
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) stopPlayer(); });
    doc.addEventListener('play', event => { if (event.target?.tagName === 'VIDEO') stopPlayer(); }, true);
    win.addEventListener('pagehide', () => stopPlayer());
    win.addEventListener('offline', () => stopPlayer('YouTube needs an internet connection. Use the written guide or a saved local clip.'));
    updateLink();
    return { stop: stopPlayer };
  }
  async function load(doc, win) {
    const card = doc.getElementById('suiteTutorial');
    if (!card || !/^https?:$/.test(win.location.protocol)) return;
    try {
      const responses = await Promise.all([win.fetch('tutorial-video.json', { cache: 'no-cache' }), win.fetch('app-version.json', { cache: 'no-cache' })]);
      if (responses.some(response => !response.ok)) return;
      const [value, release] = await Promise.all(responses.map(response => response.json()));
      mount(doc, win, configuration(value, release.version));
    } catch { /* Written guidance and existing clips remain available. */ }
  }
  return Object.freeze({ configuration, embedUrl, mount, load });
});
