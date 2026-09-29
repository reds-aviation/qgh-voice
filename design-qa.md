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
