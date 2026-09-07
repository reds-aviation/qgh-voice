# QGH v5.0.0 local development evidence

Target: Complete QGH Training Edition. Publication requires user verification and explicit approval. Native packages are outside this web implementation run.

Baseline: commit 5e76ca2 (v4.4.9.1), clean checkout, 245 automated tests passing. Development branch: feature/qgh-v5-training.

Implementation authority: the user's two supplied audits and the qgh-release-orchestrator product contract, system interfaces and implementation programme under C:/Users/pc/.codex/skills. Compound Engineering is used in return-to-caller mode for implementation/local verification; QGH release verification owns the final gate. Native execution uses the current Astra session.

## State and vertical foundation

Added structured environment/aircraft state, pure bounded RT parsing, atomic domain validation, continuous altitude integration, level reports, visual gates, overhead evidence, and an expandable manual Level & Radio panel in both exercise modes.

Evidence: existing 245 tests were inspected/run unchanged; new procedure tests cover structured briefing, invalid compound atomicity, callsigns, datums, vertical integration, time-crossing, reports, formation and migration. A failing large-step reaching timestamp was observed (90 seconds instead of 60), then fixed and retested. A read-only parallel agent found parsing/domain edge cases; reproductions now have regression tests.

Real-browser smoke: Edge opened Single setup, started an exercise, and applied a descent transcript through the real workspace with no page error. This is transcript injection, not a microphone test.

## Remaining work

- Complete transaction-level recognition dispatch, Tactical targeting, response/queue integration and offline phrase-bank expansion.
- Training Centre, canonical catalogue, version unification, help and recorded demonstrations.
- Browser, responsive, regression and PWA upgrade/offline checks; local user verification.
- Physical Android/iPhone microphone and audio-route tests remain unverified until performed on devices.
