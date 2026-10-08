# Website tutorial publication

The Training Centre retains its written guide and optional local clips. The full online course is configured separately in `packages/qgh-engine/tutorial-video.json` and is hidden while its status is `pending`. No external player is created until the user chooses **Load tutorial** or a measured chapter. Playback requires a further **Play** action in YouTube.

## Configure the uploaded course

After the approved upload to the ATS SIMBOX channel (`UC_y2KPhcRDs9ogs6vglbwdA`), update the configuration with:

- `status`: `ready`.
- `youtubeId`: the actual uploaded 11-character video ID.
- `durationSeconds`: the measured final video duration.
- Every chapter's `startSeconds`: its measured whole-second start in the final upload, beginning at zero and in strictly increasing order. Keep all existing chapter IDs and titles; the declared `chapterCount` must match the complete list.
- `version`: the current application version.

The web build rejects a ready configuration without a valid ID, duration and measured chapter starts. Never substitute an example ID or estimated timestamps. The **Watch on YouTube** link is also constructed from this configuration.

## Build and verify

Follow the normal release workflow: refresh changed guide and tour asset hashes in the Procedural manifest, run the focused tutorial/guide/header tests and the hosted suite build with `QGH_PROCEDURAL_BETA=1`, and preserve its generated guides. `scripts/build-web.mjs` injects the player into web packages only; native packages retain the written guide and their existing local clips.

Check the actual upload on both GitHub Pages and Netlify before announcing it:

- Home **Tutorial** opens Training Centre **Demonstrations**; written guidance works without the video.
- The player loads only on a deliberate action. Play, chapter selection, captions, full screen and the external link work with the real uploaded course.
- **Stop video**, leaving the page, hiding the tab, starting a local clip and losing connectivity remove the embedded player.
- Offline guidance and saved local clips remain available; **Make available offline** does not download YouTube.
- Only `/training-centre.html` permits the privacy-enhanced YouTube frame. Individual, instructor, student and review documents retain their frame restrictions, voice/worker settings and exact online-service policies.

The frame sends the website origin as its referrer, never exercise paths or query values. It uses no external player API script or automatic playback. These settings apply to the embed; the user may separately choose the external YouTube link.
