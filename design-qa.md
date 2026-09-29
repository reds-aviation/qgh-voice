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
- Procedural worker, DOM-unit interactions, guide matching, SQL role isolation and Pages packaging checks passed. DOM tests do not constitute rendered browser or real-phone verification.
- Live Supabase check passed with two instructor rooms and two separate controller identities: admission/Ready, student-only projections, typed-call acknowledgement and retry, rejected clearances, shared declutter, cross-room denial and controller removal.
- Supabase project in Mumbai on the Free plan. Migration applied successfully; only its browser-safe publishable key is included in the website.
- Source asset integrity checks, local navigation/asset targets, unique IDs and offline worker/controller URL handling are checked in the Pages test.

## Remaining visual verification

The saved browser permission previously blocked the local preview. No alternate browser, port or raw browser-control workaround was used. Rendered desktop/phone layout checks and an actual instructor laptop plus student phone trial remain to be completed. No claim of unlimited users, measured load capacity or production availability is made.

Original reference photographs are not included in the deployed assets. The fox artwork is generated and the navigation artwork predates this release.
