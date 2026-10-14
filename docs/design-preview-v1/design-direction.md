# QGH Design Preview v1 — direction and baseline

Baseline: 1.0.4, `6e63cdef4f25ff47af222174dd8224ac84e9441d`. Local preview only.

## Observed baseline

Actual frozen build at loopback port 4426 was inspected before interface edits. Screens captured at 1366 × 768 include home, shared instructor entry, QGH traffic, instructor waiting/paused, student QGH, Procedural entry/traffic/airspace and individual QGH setup/live. Additional matching phone/tablet/wide captures are part of the evidence folder.

- Instructor entry has a 286px illustration panel and tall masthead: position actions require scrolling at a typical laptop size.
- QGH traffic has a large illustrated heading and duplicate starting-position summary. Actual aircraft fields are necessary and will stay.
- Live QGH hides its instructor role/title. Its right-rail Review action actually opens Event history.
- Left aircraft/radio panel is draggable and has functioning keyboard positioning. Selection is retained when minimized. Its aircraft summary and D/F status need stronger hierarchy; actual D/F status is hidden at desktop widths.
- Individual QGH uses a large empty D/F panel, tiny uppercase control labels and a separate voice dock. Voice is initially disabled until offline recognition is configured; this is an existing setup requirement, not a new failure.
- Help presents three long arrow sequences as equal cards. One concise instructor flow diagram will replace this visual burden while preserving correct mode-specific explanations.
- Baseline start/admit/Ready/Start/Pause works in QGH. Google Meet is optional. Procedural creation is asynchronous and must be allowed to complete before interaction.
- QA wrapper scrolling can move the outer page during frame interaction; that is a capture harness limitation, not a simulator regression. App dimensions and overflow are checked within the frame.

Baseline automated checks: 563 QGH/web + 246 suite/web + 241 Procedural = 1050 passing tests, zero failures.

## Direction

Retain the roundel, blue masthead, current Gyani instructor avatar and established IBM Plex assets. Use restrained light preparation pages and the existing dark operational palette. No cockpit decoration, new runtime dependency or decorative imagery behind live controls.

1. Compact entries and traffic headings, with readable 14–16px labels, clear primary actions and less nested decoration. Keep optional performance, airspace and saved setup disclosures.
2. Live instructor conventions: explicit role and mode, fixed numerical clock/status slots, reachable lifecycle controls, strong selected-aircraft summary, familiar right tools and movable left aircraft/radio instruments. Restore real D/F status. Keep controls as the same DOM nodes.
3. Shared 4px-derived spacing and semantic surface/action/selection/focus/error tokens. Sans chrome, Plex numerical displays. Scope-drawn typography and geometry remain untouched.
4. Phone layouts stack/wrap rather than squeeze essential labels; 44px touch controls, bounded drawers, readable focus and scroll paths. Keep essential Pause/status visible and selections unchanged on collapse.
5. One semantic HTML/SVG instructor flow in Help only. Optional Meet remains a note; no invented offline/network guarantees.

## Guardrails and evidence

Do not edit kinematics, timing, RT, commands, sensor calculations, session core, save formats or truth boundaries. UI wording changes require shared guide alignment. Root owns builds, manifests, tests and review evidence. Parallel workers own disjoint presentation files only and do not commit, build or publish.

Verify actual instructor/student admission and sync, start/pause/resume, controls, typed feedback, panel collapse, save/reload, guide, rendering at 1366 × 768, 1920 × 1080, 768 × 1024 and 390 × 844. Browser backend has no advertised recording/network-block switch: report limits honestly, supplement offline tests and local asset evidence rather than claiming unperformed checks.
