# ATC Training Suite maintenance

- Preserve the simulator's operational canvas and flight semantics unless the requested change includes them.
- Every user-facing feature change must update `packages/procedural-beta/static/guide-knowledge.js` in the same change: explanation, relevant controls, question variants and screen-tour steps. Update the detailed affected training guide as needed; remove contradictory old guidance.
- Gyani, guided screen tours and generated current-flow sections share that release knowledge. Do not maintain competing answers or promise that software can infer undocumented behaviour automatically.
- Keep the guide revision equal to the Procedural manifest version. Recompute changed asset hashes and include new static assets. Run the guide/interaction tests and relevant simulator tests before release.
- Clearly distinguish This device/offline (same PC AND browser profile, separate windows) from Online room (different devices, internet on both). Recommend two extended monitors for offline use; Duplicate exposes instructor truth. A second screen does not provide independent keyboard/mouse control.
- Sirsa and Jamnagar are excluded from selectable airspace presets. Do not reintroduce them through a catalogue refresh.
- Publish only with user authorization. Keep GitHub Pages and Netlify hosted suite builds aligned when the user requests deployment; build native apps only when requested.

- Keep hardware procurement and the owner’s offline installation handbook private in untracked output. Do not publish its pages, source document, links or Gyani answers about the handbook. Retain brief operational connection and extended-screen guidance.

## QGH Design Preview approval gate — 15 October 2026

- This design task is local preview only. Do not push any branch, open remote PRs, merge production, upload artifacts, trigger deployments, change hosting settings or expose public tunnels.
- Earlier publication approvals do not apply. Publish only after the user explicitly approves a named preview; that later approval is for the existing GitHub Pages target only, never Netlify.
- Preserve simulation, command, radio and instructor/student semantics. Use synthetic traffic and a separate local preview origin. Consult `docs/design-preview-v1/brief.md` for scope and evidence.
