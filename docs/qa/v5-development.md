# QGH v5.0.0 development and release evidence

Target: Complete QGH Training Edition. The local candidate was user-approved for publication and native packaging after verification.

Baseline: commit 5e76ca2 (v4.4.9.1), clean checkout, 245 automated tests passing. Development branch: feature/qgh-v5-training.

Implementation authority: the user's two supplied audits and the qgh-release-orchestrator product contract, system interfaces and implementation programme under C:/Users/pc/.codex/skills. Compound Engineering is used in return-to-caller mode for implementation/local verification; QGH release verification owns the final gate. Native execution uses the current Astra session.

## State and vertical foundation

Added structured environment/aircraft state, pure bounded RT parsing, atomic domain validation, continuous altitude integration, level reports, visual gates, overhead evidence, and an expandable manual Level & Radio panel in both exercise modes.

Evidence: existing 245 tests were inspected/run unchanged; new procedure tests cover structured briefing, invalid compound atomicity, callsigns, datums, vertical integration, time-crossing, reports, formation and migration. A failing large-step reaching timestamp was observed (90 seconds instead of 60), then fixed and retested. A read-only parallel agent found parsing/domain edge cases; reproductions now have regression tests.

Real-browser smoke: Edge opened Single setup, started an exercise, and applied a descent transcript through the real workspace with no page error. This is transcript injection, not a microphone test.

## Implemented local candidate

- Completed-call voice transactions buffer recognition finals until release/drain, preserving corrections and rejecting conditional/negated/chained manoeuvres before mutation.
- Tactical voice commands target a stable aircraft ID without changing manual selection; transient target highlighting preserves U/S restrictions.
- Structured QNH/QFE, runway, squawk, frequency, weather, vertical clearances and reports have explicit response classes and one radio queue.
- Altitude integrates continuously and clamps at clearance. Pressure changes do not move accepted targets; passing/reaching events retain exact simulation timestamps.
- Formation offsets persist. Intermediate climb/descent trajectories and rate amendments are checked for vertical conflicts, not just final levels. This is an instructional vertical warning, not an operational conflict-protection system.
- Visual eligibility uses multiple scenario gates; separate qualifying transmissions are required for overhead confirmation.
- Searchable Training Centre includes 47 documented calls, mode/category filters, contextual help and original guidance (no reproduced marked manual tables).
- Seven narrated screenshot-based guides and one 7:00 walkthrough: high-quality 1080p distribution, captions/transcripts/chapters, about 21.27 MB total video. These are not recordings of live microphone recognition.
- Optional video storage validates path/version/MIME/bytes and complete resource sets, retains incomplete downloads as unavailable, and removes older same-site video caches only on explicit user action.
- Review adds an optional recorded altitude profile below the existing flight track. Existing exercise layout and manual controls remain available.

## Bugs found and corrected during development

1. A large vertical step timestamped reaching late. Event timing now interpolates actual target crossing.
2. A changed QNH could reconvert an already cleared flight level when arming Reaching. It now uses the accepted physical target.
3. Endpoint-only separation checks missed faster-aircraft catch-up. Checks now include both target-arrival boundaries and intervening crossings.
4. Some compound correction prefixes silently dropped weather/frequency fields. The complete original clause must now contain exactly one valid correctable action.
5. Initial/migrated weather bypassed validation. Create, apply and migration now share strict validation without corrupting original data.
6. A new leader clearance left stale follower reaching obligations. Replacement/stop cancels obsolete reaching reports while preserving passing reports.
7. At a 320px viewport with a desktop scrollbar, a 320px minimum width overflowed the available 305px. Removed the unnecessary minimum width.
8. The voice dock could retain a stale PILOT TRANSMITTING label after the transmission ended. It now restores the appropriate setup/ready indication.
9. A deferred altitude-passing reply could say PASSING after its event had already occurred. Delayed delivery now says PASSED, retains the original event value, and uses current aircraft D/F during the actual reply.
10. Expanded audio segments change bank offsets. The new pack uses a separate en-3 cache generation; a regression test verifies an old open client can still read its old bank while the current client uses the replacement bank offline.
11. Training Centre button layout overrode the HTML hidden attribute, exposing both Save and Remove actions. An explicit hidden rule now preserves the state; verified in the browser and guarded by a regression test.
12. The training guides were being encoded twice: a 1080p scene encode followed by a lossy 720p distribution encode. Small simulator labels became visibly soft. Distribution now retains the slow CRF18 1080p still-image-optimised encode without a second lossy pass; every generated lesson reports 1920x1080 in the browser.
13. Raising only the output resolution exposed that the original screenshot inputs were already soft and whole-page framing still made controls unreadable inside the embedded player. A reproducible browser capture pass now records the real simulator at 2x desktop and 3x phone density. Scene-specific editorial crops enlarge the actual control, D/F display, headphone prompt, phone view, track or command log being explained. An explicit View Full Screen action uses the standard API and iPhone native-video fallback.

## Offline audio build evidence

The new recipe retains actual spoken-word counts. One generated `frequency` clip required a 2.0409 tempo factor, just above the former 2.0 build-time quality guard. A narrowly named 2.1 maximum is recorded for that segment only; all other segments retain 2.0. George-only native synthesis speed corrections are maintaining1.2, descending1.1 and altitude1.1; their measured normalization factors are1.82049/1.88639/1.78854, below2.0. The renderer now caches raw and normalized PCM using model/voice hashes, exact input IDs, speed and pinned runtime versions. Corrupt or missing metadata is a cache miss, not trusted audio. Exact-match legacy segments were reused only after immutable baseline recipe/index/manifest/bank checks.

Final pack: four voices ×121 segments; en-3 index and manifest agree; all9 assets verified,26,823,315 bytes. Recipe SHA256: ef2e872399dbee3aea334a667709ddd13d7c93cca2b39bf63062df77dd6565c2. Pilot/procedure focused suite35/35 passed, including fixed-word readbacks without letter fallback. Cache self-tests rejected missing/malformed/wrong-shaped metadata and corrupt PCM. No subjective microphone/audio-route result is implied.

## Final local verification

- `node --test --test-reporter=spec packages/qgh-engine/test/*.test.js apps/web/test/*.test.mjs`: **487 passed,0 failed,0 skipped**.
- `node scripts/prepare-pilot-voices.mjs --verify`: **9/9 assets**,26,823,315 bytes.
- `node scripts/build-web.mjs`: **PASS**,assembled v5.0.0 web distribution.
- Final assembled browser check at4272: eight guides,current release,no video errors,no horizontal overflow; walkthrough and sampled lessons report 1920x1080 native video dimensions; all eight cards expose View Full Screen; extracted source and final frames were inspected at native resolution for readable controls, D/F, headphone, phone and review content; Single callsign430,start,manual right230 and D/F worked with recognition unprepared; headphones dialog exposes only100/130/170 WPM; no console errors. Audio completion restored SET UP OFFLINE VOICE rather than a stale transmitting label.
- `git diff --check`: **PASS** (line-ending normalization warnings only).
- Local review: http://127.0.0.1:4272/ . This preview deliberately disables service-worker registration; production-worker cache behavior is covered separately by tests.
- Browser viewport restored after testing. Live deployment is performed only from this verified source state; native packages are built from the synchronized assets described below.

## Release package verification

- The native synchronization step now copies the Training Centre, high-quality video/media resources, local pilot voice resources and release metadata into both native bundles. `Sync-WebAssets.ps1 -Target All` followed by `Verify-WebAssets.ps1 -Target All` passed before package creation. Windows and Android explicitly whitelist `training-centre.html`; the Windows local-media policy permits only its packaged `training-media` directory.
- Android: `:app:lintRelease`, `:app:assembleRelease` and `:app:bundleRelease` passed. The installable release APK and Play Store AAB are signed by the project 4096-bit release key. `apksigner verify` reported a valid v2 signature; `jarsigner -verify` reported `jar verified` for the AAB. The AAB certificate is self-signed, which is normal for a Play upload key; Play App Signing will manage distribution signing after upload.
- Android content inspection confirmed `app-version.json`, the pilot voice pack, Training Centre and 1080p walkthrough are inside the release APK.
- Windows: the portable x64 `QGH Simulator 5.0.0.exe` was built from the synchronized bundle. Its ASAR contains the Training Centre, walkthrough, voice manifest and offline TTS runtime. Authenticode status is `NotSigned`; no claim is made that SmartScreen warnings are removed.

## Browser evidence

Driver: integrated CUA Chromium browser. This is **not** physical Safari/iPhone/Android certification.

- Single Normal: editable numeric callsign 430, runway230/outbound065/inbound225, manual heading command/report, descent15000→12000, armed reaching report, three one-minute advances, termination and curved review path.
- Single U/S: direct left→right→stop without an intermediate Stop command; no numeric heading disclosure in review text; 10× replay.
- Tactical Normal: four aircraft, numeric430/431 plus text callsigns, formation leader initially selected, four readable phone tabs.
- Tactical U/S: four aircraft, select HAWK41, left→right→stop, advance and terminate, four-level review profile.
- Training Centre search returned two passing calls; U/S filtering excluded heading-control/report entries.
- Headphone prompt displayed only100/130/170WPM, disabled confirmation until audio test, and retained Keep Muted.
- Local recognition preparation reached PTT READY without browser errors. No live speech was supplied in this browser test.
- Width checks with zero horizontal overflow: 320px Single/Tactical setup/exercise/review/Training Centre, 390px four-aircraft console, 844×390 landscape Single. Additional Tactical measurements at360/375/390/393/412px passed. Rapid later resize measurements were discarded because the driver reported stale viewport values.
- Development preview disables only service-worker registration and uses no-store responses to avoid stale same-version local edits. It is not evidence of installed-PWA cold-start behavior.
- Training Centre source preview: all eight guides rendered without console errors; the walkthrough saved as a verified offline blob, sought to its 4:55 chapter (295.665 seconds), advanced during native playback, and removed cleanly back to its online source. The narrow viewport had no horizontal overflow. This validates optional clip caching/playback, not an installed-device offline cold start. Local preview gained MP4 byte-range support so native seeking behaves properly.

## Explicit remaining device evidence

- User verification of the published candidate, including actual microphone calls and pilot audio.
- Physical Android and iPhone/Safari: first load, installed PWA, rotation, browser chrome, permission denial/recovery, headset disconnect, speaker-feedback, interruption and offline cold start.
- Physical microphone recognition: accents, fast/slow speech, pauses, noise and zero unintended manoeuvres.
- Real installed-device upgrade from4.4.9.1 (internal version4.4.9-1); automated worker tests cover cache isolation/current assets but are not device evidence.
- Physical Windows portable-app smoke test and Android installation/first-run test remain user-device checks; release build validation does not substitute for them.
