# QGH Design Preview v1 — verification

Local preview only. Baseline source is 1.0.4 at `6e63cdef4f25ff47af222174dd8224ac84e9441d`. The public version was not bumped. No push, PR, deployment, public tunnel or hosting configuration change was made.

## Automated

Baseline and final modified source each passed 1,050 existing tests: 563 QGH/web, 246 suite/web, 241 Procedural. Explicit online-startup coverage is included. JavaScript syntax checks and Git whitespace checks passed. Procedural manifest file hashes were refreshed after presentation changes and independently validated. Final combined build ran after all tests, because tests share distribution output.

## Actual browser checks

- QGH: create synthetic traffic, join with PIN, admit, Ready, Start, Pause, Resume; controller clock/caption updates.
- Applied `SPD 220` and rejected invalid typed input; selected aircraft retained. Actual turn-left command followed by middle-mouse stop produced the wings-level response.
- Floating controls minimize/restore retained selection and values. Scope client 1366×644 and intrinsic 2049×966 dimensions were identical before/after this collapse.
- Startup prompt is available through Session in Waiting/Ready/Paused and the actual node is hidden while Running. No new state machine or invented feedback was introduced.
- Procedural: traffic setup, create paused exercise, Run/Pause, airspace save/reload and placing an ARP by canvas click. Existing import/export and drawing formats remain unchanged.
- Individual Single and Tactical QGH: actual setup/start screens, readouts and existing offline voice setup state. Single stopwatch timer/buttons no longer compete for one row.
- Termination review and setup-download acknowledgement; Help flow, drawers, keyboard Enter/Escape and visible focus.
- Rendered representative screens at 1366×768, 1920×1080, 768×1024 and 390×844. Real app rendered in an exact-size capture iframe. Wide outer-page scrolling belongs to the capture harness; app overflow was measured inside it.
- Corrected a new tablet clipping issue during inspection: lifecycle actions now fit the header. Tablet Procedural Run is 44px high with bounds inside its header. Restored D/F content and bounded the Gyani launcher/panel away from lifecycle controls.

## Console classification

Some capture-wrapper reloads emitted a MutationObserver non-Node error without a source URL or stack. The unchanged frozen baseline wrapper reproduced the identical error. Direct baseline and modified Single QGH routes each remained clear before and after reload. A capture/tool artifact is inferred; its exact origin is unconfirmed. This is recorded separately from source regressions, not described as zero errors in every capture log.

## Limits

No browser recording or network-blocking capability was available. No manual network-blocked PWA test, physical microphone/PTT/device voice test, physical Android/iOS test or native build is claimed. Existing offline/cache/PTT safety tests passed. The normal preview disables service-worker registration on a separate origin to avoid updates interfering with review.

The download action produced the application's acknowledgement, but native file-path retrieval timed out; no manual downloaded-file/import round trip is claimed. No comprehensive rendering-performance benchmark was performed. Existing simulation hot paths, runtime dependencies and external-request code were untouched. Online rooms, optional Meet and YouTube retain their existing internet requirements; the YouTube tutorial was not regenerated.

## Artifacts

Private local evidence is in the chat workspace's `outputs/design-preview-v1`: matching screenshots, HTML gallery, test logs, reference receipts, scope measurements, console comparison and a portable app/server/README package. Reference revisions and design direction are recorded in `design-direction.md` and the package README. The four requested design repositories were applied as documented guidance, not installed or added to the runtime.

Publication requires explicit approval of **QGH Design Preview v1** (or a later named revision). Any later approved deployment is restricted to the existing GitHub Pages target. Netlify remains excluded by this task.
