# ATS SIM BOX 1.0.3 publication gate — 12 October 2026

- User approved publishing the reviewed candidate to GitHub Pages and Netlify. Display branding remains ATS SIM BOX · Version 1; hosted release/cache metadata is 1.0.3.
- All publishing workflow test groups passed: QGH/web 562, instructor/suite 237, Procedural 240; total 1,039 passed, zero failed. Go flight-engine tests passed. The Version 1 build succeeded.
- Fixed the final pending-login Logout visibility case before release. Tests enter the actual desk/entry lifecycle; cancellation preserves the pending operation, confirmation invalidates late login completion, and untouched opening pages keep Logout hidden.
- Verified the 72 Procedural asset hashes against staged Git bytes, normalizing only two line-ending differences. This prevents Linux production builds from rejecting a Windows-calculated manifest.
- Aligned application, shared guide and tutorial delivery manifests with 1.0.3. Focused recordings retain their original captureVersion and compatibility note; their media was not rerecorded. Native source version metadata is aligned but no native package was built or distributed.
- Public deployment targets are `https://reds-aviation.github.io/qgh-voice/` and `https://voice-qgh-reds.netlify.app/`. Both build from the same production main branch; Netlify auto publishing was verified on. Private continuity, owner handbook and local capture/output files are excluded from the commit.
- Final deployment status and live asset comparison will be recorded in the continuation workspace publication receipt.

---

# QGH Saved exercises simplification — 11 October 2026

- Removed the separate Load button from instructor QGH/SRE/SRA traffic setup. The Saved on this device selector now restores the chosen setup directly using the existing capacity guard. The blank Current setup option keeps the traffic fields and clears only the saved-exercise name for a separate new record.
- Import exercise file still fills traffic setup and saves an independent device entry. Create session remains the explicit exercise-start action. Updated the common guide, Gyani questions, guided tour and instructor training guide to match.
- 55 targeted preset, guide, instructor setup and console checks passed. The preset harness now runs the actual saved-selector event binding; direct selection restores exact heading/speed, and invalid legacy capacity cannot silently truncate traffic. Local build and manifest refresh succeeded.
- Browser proof: saved Preview QGH setup at heading127, changed the draft to300, selected the saved entry and verified restoration to127 while staying on traffic setup. No separate Load button exists and no session was created. Browser error log empty. Screenshot: `C:/Users/pc/Documents/Codex/2026-10-03/qgh-continuation/work/airspace-ui-2026-10-11/saved-exercises.jpg`.
- Local preview only; not published. Procedural's separate import/store-and-apply workflow is unaffected by this QGH-page change.

---

# ATS SIM BOX header, airspace editor and runway review — 11 October 2026

## Scope and changes

- Unified the IAF header brand, navigation typography and creator identity. Name uses 12px semibold Suite Sans; service number uses 11px regular Suite Sans in the same grid position across QGH and Procedural. Phone identity stays visible. Fresh Procedural entry no longer shows Logout or reserves space for it.
- Published airspace, mouse drawing and coordinate entry remain direct choices. Drawing has independent LFA, Prohibited, Restricted, Danger, Control zone and ATS route tools. Routes remain open polylines. Removed the Advanced tools wrapper, leaving named optional chart settings.
- Added visible new-route/new-area actions beside existing records. Edit opens the matching editor and Remove clears only a successfully deleted feature's matching draft. Cancellation and unrelated drafts survive.
- New route names accept up to six alphanumeric characters with numeric groups from 1–999. Route direction and minimum/maximum flight levels are editable; the scope displays the route name and `FL260/FL460` as a two-line label. Existing published names remain compatible.
- Airspace-only Save, Load, Download file and Import airspace file preserve aircraft and exercise progress. The complete exercise option remains available for aircraft-plus-chart backups.
- Window controls use compact close/reset/minimize symbols. Noninteractive title-bar space supports dragging; inputs and buttons retain their own actions. Phone touch targets remain 44px. Drawer icons reserve separate space for Logout.
- The runway is a grey strip with physical length, configured orientation and an ARP-relative lateral offset. New defaults are 3km length and 0.15NM offset. Geographic ARP is the local chart origin; drawn ARP is its selected chart position. New published loads place the simulated NAV/DF station at ARP while retaining source aid identity and coordinates in the briefing. Previously saved explicit offsets remain compatible.
- Instructor/student approach geometry and the flight engine use the landing threshold for SRA distances. NAV/DF and general chart ranges use the station at ARP. The runway width has a small screen minimum for visibility; length retains physical scale.

## Verification

- Local Version 1 build succeeded. No commit, Git push or publication performed.
- All 995 QGH engine, instructor/student and Procedural Node regression checks passed. After the final phone fix, 40 targeted shell/entry/phone checks passed. The three entry theme checks also passed after header normalization.
- Go procedural tests passed, including landing-threshold and runway geometry checks. Rebuilt the WebAssembly engine with the configured Go 1.27.1 toolchain. Procedural manifest hashes and guide knowledge are synchronized.
- Browser: placed ARP using the preview mouse canvas; drew and saved an open three-point bidirectional A123 route with FL260/FL460; reopened its correct editor; saved an offline chart copy. Drew and saved PTEST as Prohibited with GND/FL120, then reopened its area editor independently of LFA.
- Browser: blank-title-bar drag changed the preparation drawer from x896 to x626, and reset restored x896. Reviewed the grey runway at 5NM range and route/area presentation at 60NM.
- Browser: QGH and Procedural header fonts match exactly. Phone check at 390×844 has no document horizontal overflow. Detected and corrected Logout overlapping the drawer close button; final bounds are Close x234–278 and Logout x294.7–366.7. Actual Close returned to the workspace without a Logout confirmation.
- Final browser error log was empty. Viewport overrides were reset; the local preview tab is retained for the user.
- Phone checks use browser emulation rather than a physical handset. JSON download/import round trips are covered by automated handler/storage tests; browser file transfer was not performed in this pass.

## Evidence

Current captures and test logs are in `C:/Users/pc/Documents/Codex/2026-10-03/qgh-continuation/work/airspace-ui-2026-10-11/`:

- `header-desktop.jpg`, `qgh-header-desktop.jpg`, `header-phone.jpg`
- `airspace-desktop.jpg`, `airspace-phone.jpg`, `runway.jpg`
- `regression-final.txt`

---

# ATS SIM BOX app theme review — 11 October 2026

## Scope

Extend the approved IAF palette to QGH selection, Single/Tactical setup, instructor traffic setup, controller joining, training guides and post-termination review. Keep live, READY and paused exercise canvases, instruments and operational control chrome unchanged. Existing navigation, labels and flight code are unchanged.

The pre-traffic airspace preparation drawer receives the palette locally; its surrounding scope retains the operational design. Once starting traffic is created, that drawer returns to the existing exercise palette. Procedural review styling requires actual termination, so opening review during an exercise does not alter its appearance.

## Verification

- Local Version 1 web build passed. No publication or Git push performed.
- Eight targeted checks passed: entry cascade and single managed scope helper, role-card label consistency, Pages asset/route integrity, safe offline update, guide/Gyani source consistency, Version 1 branding, and Gyani mounting.
- Independent static review verified setup/join/review state boundaries and preparation-drawer isolation. Restored the invalid-coordinate red border and destructive-action hover semantics after applying the light panel palette.
- Single QGH was started before and after the shared theme was added. Computed body/header/console/control colours, typography and geometry matched exactly. Evidence: `work/iaf-app-theme/exercise-colours.json`, `exercise-before.jpg`, `exercise-after.jpg` in the continuation workspace.
- Desktop browser review: QGH selection, Single setup and terminated review, instructor entry/traffic setup, Procedural entry/traffic setup/pre-traffic preparation, and shared guide.
- Phone review at 390 × 844 CSS pixels: QGH, Tactical setup, instructor/controller entry, Procedural traffic setup and shared guide. No horizontal overflow found on those pages. The temporary viewport override was reset.
- Fixed white text on pale Procedural header buttons discovered in the phone pass. Review warnings, metadata and home links now use readable colours on light surfaces.
- Browser error log was empty after the final route review. No multiplayer room was created for the appearance checks.
- This is a presentation-only change. The shared guide knowledge remains unchanged because no function or workflow changed.

## Evidence

All current screenshots are under `C:/Users/pc/Documents/Codex/2026-10-03/qgh-continuation/work/iaf-app-theme/`:

- `qgh-desktop.jpg`, `qgh-phone.jpg`
- `instructor-entry-desktop.jpg`, `instructor-setup-desktop.jpg`, `instructor-entry-phone.jpg`
- `procedural-entry-desktop.jpg`, `procedural-setup-phone.jpg`, `airspace-preparation-desktop.jpg`
- `tactical-setup-phone.jpg`, `single-review.jpg`
- `guide-desktop.jpg`, `guide-phone.jpg`

The palette retains the approved blue-grey header, pale sky background, navy type, white forms/cards, real roundel asset and restrained tricolour divider. Existing aviation artwork is reused. Contrast fixes use navy/muted blue for neutral text and red/amber for warnings; no affiliation claim was added.

---

# ATS SIM BOX landing theme review — 10 October 2026

## Scope and visual target

Implement the user-approved Indian Air Force-inspired theme on the suite home only. Preserve its existing navigation, content, responsive layout and all exercise screens.

- Source visual: `C:/Users/pc/.codex/generated_images/01a10297-a26e-76f3-8f38-56e52df38b6d/exec-d5eb5465-f39b-4ac0-a580-ada230f43949.png`.
- Implementation: `http://127.0.0.1:4407/` (local candidate, not published).
- Desktop screenshot: `C:/Users/pc/Documents/Codex/2026-10-03/qgh-continuation/work/iaf-landing-theme/desktop-full.jpg`.
- Phone screenshot: `C:/Users/pc/Documents/Codex/2026-10-03/qgh-continuation/work/iaf-landing-theme/phone.jpg`.
- Combined comparison: `C:/Users/pc/Documents/Codex/2026-10-03/qgh-continuation/work/iaf-landing-theme/comparison.png` (reference left, implementation right).
- Reference 1445 × 1088 pixels, proportionally normalized to 1280 × 964. Implementation 1280 × 980 pixels and CSS viewport, density 1; 16 pixels of additional page background reflect viewport height, not a layout change. State: landing, help collapsed, page top. Phone CSS width 390, height 844; full-page capture. Also checked 320 CSS pixels.

## Findings and required fidelity surfaces

No actionable P0/P1/P2 findings in the first visual comparison. A second agent independently inspected the combined desktop comparison and phone capture.

- Typography: existing Plex Sans/Mono retained, all labels and hierarchy preserved, captions darkened for readability. No clipping or joined words.
- Spacing/layout: existing hero and card dimensions and navigation structure retained. Roundel added within the brand link. Header fits desktop and wraps on phone; all three simulator paths remain visible and usable. No horizontal overflow at 390 or 320 CSS pixels.
- Colours: blue-grey header, navy headings, pale sky surfaces and restrained tricolour accents. Opaque contrast measurements: white/header 6.899:1, supporting text/white 7.090:1, action text/white 7.673:1. These are colour-pair checks, not a full accessibility audit.
- Image quality: existing shared watercolor illustrations and icons preserved. Generated roundel is a transparent 160-pixel PNG displayed at 36–48 CSS pixels, with no stretch or clipping. The shared illustrations are slightly more muted than the mockup; retaining them is intentional within the landing-only scope.
- Copy/content: unchanged. The independent-training identity remains. No claims of official affiliation added.
- Focused review: the combined image at 2560 pixels clearly exposes headings, navigation and card labels; header/roundel, keyboard-focus state and the open Gyani panel were also inspected directly in the browser. No further crop was needed.

## Verification

- Pages package build/test passed: asset integrity, route targets, unique IDs and offline room URLs.
- Three targeted interface checks passed: shared guide/Gyani source, Version 1 branding and Gyani mounting/collapse.
- Browser navigation passed for Single QGH, Instructor QGH/SRE/SRA and Procedural, with return to suite home.
- Gyani opened/closed; landing-only blue treatment remained readable. Keyboard Tab exposed a visible light-saffron focus outline on the dark header.
- Browser error log empty after navigation checks.
- Instructor and Procedural entries do not load `suite-landing.css` and have no roundel. No flight logic, scope styles, shared artwork bytes or shared help styles changed.
- Roundel copied into the build and included in the root offline precache. Existing release number retained for this local candidate; publication/versioning is a separate step.
- Temporary browser viewport override reset. Phone checks used browser emulation, not physical devices.

## Implementation checklist

- [x] Apply approved theme to suite home.
- [x] Add roundel asset and offline build inclusion.
- [x] Preserve other entry pages and exercise surfaces.
- [x] Compare approved mock and real browser capture together.
- [x] Check phone fit, navigation, help and focus.

Follow-up polish: none required for this scope.

final result: passed

---

# Previous review

# ATC suite release review — 29 September 2026

The current entry and radar colours are retained. Inner light-theme work is deferred. The saved earlier landing review is in `docs/design-reviews/landing-light-qa.md`.

## Implemented

- Whole Procedural card is a keyboard-accessible link.
- Compact scope-side aircraft actions, mouse hover information and deliberate double-click turning. Touch selects an aircraft and exposes arrows; it cannot accidentally issue a double-click turn.
- Phone aircraft rosters use labelled cards, one page scroll and a jump selector. Advanced controls occupy a bounded drawer; the plot and homing instrument retain their own space.
- Gyani is a collapsible original fox guide. It sits in the navigation or tool rail, answers common control questions, and uses the same maintained source as the generated guide sections. It is hidden during running exercises.
- Feedback form removed; adjustable real-time 360-degree display sweep added.
- Independent local rooms and optional online Procedural rooms. Instructor and student permissions are enforced in the worker and the private Supabase session API.

## Evidence

- Existing QGH/web regression suite: 508 passed; instructor-led/ATSS suite: 173 passed.
- Procedural worker, DOM-unit interactions, guide matching, SQL role isolation, safe updates and Pages packaging: 16 checks passed. DOM tests do not constitute real-phone verification.
- Live Supabase check passed with two instructor rooms and two separate controller identities: admission/Ready, student-only projections, typed-call acknowledgement and retry, rejected clearances, shared declutter, cross-room denial and controller removal.
- Supabase project in Mumbai on the Free plan. Migration applied successfully; only its browser-safe publishable key is included in the website.
- Source asset integrity checks, local navigation/asset targets, unique IDs and offline worker/controller URL handling are checked in the Pages test.

## Published browser review

GitHub Pages deployment and all CI checks passed for release `2026.09.29.5` (`5bd29e0`). The public site was reviewed through the authorized in-app browser after deployment. The saved local-preview denial was not bypassed.

- Whole-card navigation, online room entry, PIN admission, Ready, Run/Pause, remote typed controller calls and matching readbacks/bearings were exercised in independent browser sessions.
- Double left/right mouse clicks produced the expected pilot replies. Gyani answered “How to turn right” and collapsed; it disappeared during Run.
- Instructor route deselection reached the student as a disabled, unchecked control. Student scope remained a procedural bearing display.
- The 390-pixel phone roster reached aircraft 24. The phone panel review exposed an inherited grid column and a sticky call card. Both were corrected: the final scope measured 390 pixels wide with the drawer open, and the call button was clickable after scrolling.
- The QDM selector and magnetic-reference line fit the compact homing box. Instructor quick actions and the smaller aircraft drawer were exercised at 390 × 720; laptop layout bounds were checked at 1280 × 800.
- An old offline cache retained previous styles. Entry-page update controls and fresh network requests during cache installation corrected the update. Active exercise pages are not automatically reloaded.
- Review image: `artifacts/qa/procedural-phone-controls-published.png` (local, not deployed). Supabase setup proof: `artifacts/qa/supabase-project-ready.png`.

## Remaining device checks

An actual instructor laptop plus student phone trial, iOS/Android software-keyboard behaviour, and measured concurrent-user capacity remain unverified. The native Create-session confirmation blocked the automation interface; scenario creation is covered by the worker and DOM checks, while published browser checks used the paused sample traffic. No claim of unlimited users or production availability is made.

Original reference photographs are not included in the deployed assets. The fox artwork is generated and the navigation artwork predates this release.
