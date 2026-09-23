# Instructor beta 0.2.3-beta.1 verification

Date: 2026-09-23. Individual Practice remains at its existing version and workflow.

## Scope and outcomes

- Separate simulation advancement from rendering; pause explicitly after a processing gap above two seconds instead of silently dropping time.
- Preserve QGH's 5x default. Radar/vectoring/SRA/PAR default to 1x, retaining optional 5x/10x.
- Use real elapsed time for pilot transmission and the two-second DF hold. Bound audio completion waits and reject stale playback callbacks.
- Normalize rounded northbound headings to 000 before wire validation.
- Restore the student seat and last safe observation after refresh. Distinguish link liveness, picture freshness and simulation progress. Provide seat release and reconnect.
- Add dedicated student-window/second-display support and a version-linked training guide.

## Evidence

- PASS: 172 beta unit/integration/build/offline-shell tests.
- PASS: 508 existing QGH and web regression tests.
- PASS: real browser, actual same-origin BroadcastChannel, two-position local fixture: QGH heading report caption and live DF; 24-aircraft SRA at default 1x; advance one minute; pause; refresh only student; same paused time and 24-return sampled picture recovered.
- PASS: built guide displays beta version and generated aliases. Phone-width browser measurement showed no horizontal page overflow; this is viewport emulation, not physical-device acceptance.
- Review: targeted manual inspection of timing, wire validation, seat recovery, command routing and offline packaging. Existing overlapping multi-display work was preserved rather than broadly refactored.
- NOT RUN: physical Android/iPhone, external-monitor permission/placement, audible pilot readback with real headphones, device sleep/resume, production installed-PWA upgrade. Browser suspension and late-callback paths have deterministic tests, not hardware proof.

## Limits

PIN sessions still require one device, browser profile and origin. This release does not add a cloud/LAN transport. Beta is a training approximation, not certified radar equipment or an operational procedure. Publication requested for GitHub only; Netlify deployment is skipped for this commit.

## Required checklist for every future beta release

1. Update the beta version in app-version.json and service-worker cache identity.
2. Change direct aliases in suite-command-reference.js; the parser and generated guide table share this catalogue.
3. Review training-guide.html whenever controls, numeric grammar, shortcuts, ranges, timing, joining, recovery, display behaviour or limitations change. Update examples and mode restrictions in the same change.
4. Add behaviour tests for new/changed commands; run all beta and legacy suites. The build tests reject missing alias coverage, stale guide version and missing offline guide assets.
5. Check the built guide and affected pages at desktop and phone widths. Label emulation and physical-device results separately.
6. Publish only with user authorization; verify the live beta version and guide after deployment. Do not claim real-device acceptance until tested.
