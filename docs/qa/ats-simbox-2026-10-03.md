# ATS SIMBOX scope and preparation release

Release knowledge: 2026.10.03.2. Suite desk version: 0.2.6-beta.1. Automated acceptance complete; public rendered verification follows deployment.

The instructor desk now uses the same scope-first structure for QGH, SRA and vectoring. Start collapses setup/navigation; immediate turns, heading assignments, pilot transmissions and termination remain accessible. Radar samples remain fixed at 15 RPM. Dotted history adapts to the displayed range, and SRA has half-mile references within the final 5 NM. PAR is removed from the selectable flow; compatibility with existing recorded states remains in the engine.

Procedural preparation uses an ARP, named polygons and explicitly selected routes/areas. Mouse/touch drawing has visible finish/undo/cancel controls. Named starting setups can be saved locally and downloaded/imported for reuse. The initial traffic editor is collapsed; desk Traffic keeps the detailed editor available.

Students can place violet EST dots, label them with callsigns, drag them, or use numeric coordinates and keyboard actions. These are local estimates, independent of instructor aircraft state and isolated by exercise/student identity. Instructor airspace edits retain the shared chart boundary; procedural students receive no live aircraft truth.

Pending controller calls are beside the instruction form. Applying a linked clearance acknowledges that pending call atomically, with replay-safe command IDs. Clearance drafts keep separate units for heading, speed and altitude. Terminated desks disable traffic instructions. Pointer state resets when leaving the desk.

Procedural review has animated top/altitude-side/3D schematic projections and configured separation cues. Aircraft selection highlights a track and filters its events; timeline markers and Commands & events seek to recorded times. Cues retain measured spacing, configured threshold and the supplied source/applicability/evidence/assessment fields. It records brief cue changes and edited starting positions. This schematic exaggerates altitude and is not a photorealistic replay or universal Doc 4444 rule validator. No recorded cue does not establish that separation is valid.

One common training guide, Gyani and contextual tours share the release knowledge. Legacy handbook links redirect to the common guide. The continuation patch adds a brief, skippable first-use introduction before the clock runs; Start/Run closes it without pausing traffic. The short mouse reminder is inside the controls shelf. UI uses consistent Sans typography and Mono numeric data, semantic action colours, visible focus and reduced-motion handling.

New exercises are limited to 20 aircraft for Procedural and 2 for instructor-led QGH. SRA and SRE/vectoring retain 24. Historical stored exercises remain compatible. Custom polygon editing now supports moving and deleting selected vertices before Save. Saved Procedural setups can be saved as new, duplicated and renamed while preserving their starting traffic and selected chart layers.

## Verification

- Published .1 Node regression suite: 735 tests passed, 0 failed. Includes QGH engine, web/PWA, instructor suite, procedural browser engine, guide/build/cache routing, session/role boundaries and Supabase SQL tests. This total predates the continuation patch and is not a full .2 result.
- Go tests: passed, including linked-call atomicity/idempotency and geographic polygon metadata validation.
- Procedural WASM rebuilt from the changed Go source; published source/static manifest hashes refreshed.
- Independent implementation reviews identified and resolved replay sampling/seek bounds, transmission form reset, stale gestures and termination-button state issues.
- GitHub publication of .1 succeeded: commit [99ecd8d](https://github.com/reds-aviation/qgh-voice/commit/99ecd8d), deployment [37066241470](https://github.com/reds-aviation/qgh-voice/actions/runs/37066241470). Key public JavaScript matched the staged release.
- Public 390 px review confirmed the landing flow and QGH instructor/student admission, Ready and Start; pilot Transmit produced a 032° student homing indication and scope bearing. This was a same-browser paired session, not a test on two separate physical devices.
- The public review found an update notice overlapping an active exercise. Its suppression is being corrected in .2; verification of the corrected public behavior is still required. Other full journeys have not completed rendered review.
- Continuation guide checks: 9 guide/tour tests and 3 guide interface tests passed. Source knowledge audit: 43 answers, 40 manual tour steps, 11 first-use steps; all documented controls and guide anchors resolve. The complete .2 build and regression passed; public review follows deployment.
- Final .2 Node regression: **757 passed, 0 failed**. Full Go suite passed; WASM rebuilt with new 20-aircraft admission checks. Legacy 24-aircraft checkpoint validation and recovery passed.
- No mobile visual certification, WCAG conformance claim or real-user performance score is implied by DOM or regression tests.

Deployment scope: GitHub Pages only. The release commit uses Netlify's documented skip marker. No native build, private reference photo, owner hardware handbook or new external AI runtime is included.

## Original 20-point acceptance checklist

Statuses refer to the whole numbered request. Functional test evidence is identified separately from visual review; a completed source change alone does not establish that its complete mobile/laptop journey has been reviewed. Allowed statuses: Not started, Implemented but unverified, Verified, Blocked, Deferred.

| # | Requested outcome | Status | Evidence and remaining check |
| --- | --- | --- | --- |
| 1 | Simple ARP/polygon entry, point-by-point drawing, uncluttered scope and shared instructor flow | Implemented but unverified | `airspace-preparation.js` and its tests cover ARP, multiple polygons, pointer drawing and shared save; `scope-workspace.css`, `suite-instructor.js` and `workspace-shell.js` provide matching scope-first desks. Complete custom-airspace/mobile and all-mode rendered journeys remain. |
| 2 | Minimisable top scope controls | Implemented but unverified | `workspace-shell.test.mjs` verifies collapse-once and explicitly reopened controls; instructor console tests verify Start closes drawers. .2 groups range/trail controls in Scope settings. Active public overlay correction and every scroll state still need review. |
| 3 | Remove unnecessary entrance roster | Implemented but unverified | Initial traffic is collapsed and optional, retained by the later instruction for exact prepared setups. `procedural.js` and roster tests preserve editable traffic; handset entry and keyboard scrolling require final rendered check. |
| 4 | Consistent professional typography | Implemented but unverified | Shared `flow-theme.css` uses Sans UI and Mono numeric data; no new theme applied. Font loading and wrapping across all screens are not fully visually checked. |
| 5 | QGH heading includes SRA/vectoring, remove PAR, only 15 RPM and visible adaptive trail | Implemented but unverified | Instructor console tests assert visible mode/RPM choices; renderer tests cover scan/trail behavior. Published QGH desk checked, but SRA/vectoring and all trail ranges still need rendered inspection. Historical PAR engine data remain for replay compatibility only. |
| 6 | Fix text exceeding boxes | Implemented but unverified | Wrapping/min-width rules and safe radar-label bounds are in shared styles and radar UI tests. Complete width/zoom/keyboard sweep remains. |
| 7 | Procedural-style SRA/vectoring layout | Implemented but unverified | Shared scope workspace adapter, compact quick controls and collapsible drawers are implemented; instructor and student contract tests pass in .1. Both radar-mode journeys remain to be visually reviewed. |
| 8 | Procedural and QGH & SRA headings with Single QGH and Instructor QGH + SRA entries | Verified | `packages/site-landing/index.html` contains this hierarchy; the published 390 px landing and QGH instructor path were reviewed. “SAR” is treated as SRA as clarified by the surrounding request. |
| 9 | Middle mouse click stops aircraft turn | Verified | Instructor console test “double right click turns and middle click stops without browser autoscroll” and Procedural pointer tests verify the operation, role boundary and drag safety. |
| 10 | Initial guided control instructions | Implemented but unverified | .2 `suite-tour.js` provides skippable first-use instructions before Run, then only a shelf reminder during traffic. New DOM test verifies skip, once-only behavior, unchanged clock and Start dismissal. Final public first-use/returning-user checks pending. |
| 11 | Improve Session UI | Implemented but unverified | Compact Session drawer, PIN actions, admission states and second-display actions exist; public QGH admission/Ready/Start worked. Other modes and all mobile/reconnect states remain. |
| 12 | Remove flight-strip UI | Verified | Visible Flight strips tab/record fields are removed; controller Calls remains. `.1` interface boot/role tests passed. Internal compatible data are retained for old exercise records. |
| 13 | D/F Transmit under pilot panel and custom Procedural message | Implemented but unverified | Pilot panel/quick Transmit and `transmit-form` are implemented. Live QGH Transmit produced 032° homing/bearing. Procedural custom-message delivery to the admitted student still needs an end-to-end public check. |
| 14 | Simple custom LFA and opt-in published route/area selection | Implemented but unverified | Airspace tests verify deselected published items are not loaded and selected layers remain shared. .2 adds existing vertex drag/delete; selection persistence and visual shared declutter require final rendered exercise. |
| 15 | Reusable prepared exercises; remove synthetic-airspace selection and improve setup UI | Implemented but unverified | Local template library, JSON import/export, exact starting state, new names, duplicate and rename are implemented/tested; no selectable synthetic-airspace mode is required. Repeat assessment, storage failure and import flow need public UI review. |
| 16 | Less text, objective-oriented controls | Implemented but unverified | Compact workspace controls, optional drawers and one task-based guide replace repeated instructions. Usability of every state has not yet been checked with a trainee. |
| 17 | Animated top, side and 3D review for separation mistakes | Implemented but unverified | `traffic-review.test.mjs` verifies interpolation, cue timing, rewind and replacement. Top/altitude-side/3D schematic views exist; all projections and cue seeking need visual confirmation. This is configured spacing training, not a complete Doc 4444 validator. |
| 18 | SRA half-mile marks within final 5 NM | Implemented but unverified | Instructor/student SRA renderers and the common guide include the half-mile references and 3° calculation. Final public SRA approach at relevant range settings is still required. |
| 19 | Effective screen space and user-friendly exercise | Implemented but unverified | Shared scope-first layout, compact shelf and minimized tools are implemented. Partial QGH live review passed, but full mobile/laptop interaction coverage remains. |
| 20 | Minimise controls above instructor truth once started | Implemented but unverified | Start-collapse behavior is covered by workspace/instructor tests. The .2 Scope settings grouping extends it; safe update-notice suppression and all working views must pass the final rendered check. |

## Continuation acceptance

- First-use guide is before Run, skippable, and never commands/pause traffic: DOM verified; public .2 verification pending.
- Procedural 20 / new instructor QGH 2 limits, SRA/vectoring unchanged: shared knowledge updated; limits implementation/regression is owned by the corresponding simulator packages.
- Moving/deleting existing polygon vertices, saving only on Save boundary, and duplicate/rename preserving stored exercise content: implementation and dedicated tests available; public end-to-end check pending.
- Online instructor/student on physically separate devices: not verified by the same-browser public session. Full remote-network check remains outstanding.
- Complete all-mode mobile/laptop visual review, active update suppression and generated guide/link verification after the final .2 build before treating the continuation as accepted.

## Five-minute morning review

1. Open the suite home and follow QGH & SRA → Instructor. Choose QGH with two aircraft, create a session and join its PIN in a second window of the same browser. Admit and press Ready.
2. Start: navigation/settings should collapse. Click an aircraft for D/F; double-left/right to turn; middle-click to stop the turn. Type a heading and check the readback.
3. Terminate with the red control: the student should show Exercise terminated. Cancel once first to verify Keep exercise is readable.
4. Open Procedural: edit ARP and a polygon, choose only required chart items, save the starting setup, Duplicate and Rename it. Join a controller; add a labelled EST dot and move it.
5. Run briefly and review: seek a command marker, switch Top/Side/3D, and check the same time remains selected. Open the common guide and ask Gyani about joining, turns, saved exercises and an unsupported question.

Rollback reference before this iteration: `d159af2ab7b3d357b3fdc3c24718fe49ef124562`. Rollback uses a new revert commit, preserving later history. Netlify is excluded with the release commit marker `[skip netlify]`.
