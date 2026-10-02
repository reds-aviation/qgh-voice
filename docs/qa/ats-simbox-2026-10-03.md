# ATS SIMBOX scope and preparation release

Release knowledge: 2026.10.03.1. Instructor suite: 0.2.5-beta.1.

The instructor desk now uses the same scope-first structure for QGH, SRA and vectoring. Start collapses setup/navigation; immediate turns, heading assignments, pilot transmissions and termination remain accessible. Radar samples remain fixed at 15 RPM. Dotted history adapts to the displayed range, and SRA has half-mile references within the final 5 NM. PAR is removed from the selectable flow; compatibility with existing recorded states remains in the engine.

Procedural preparation uses an ARP, named polygons and explicitly selected routes/areas. Mouse/touch drawing has visible finish/undo/cancel controls. Named starting setups can be saved locally and downloaded/imported for reuse. The initial traffic editor is collapsed; desk Traffic keeps the detailed editor available.

Students can place violet EST dots, label them with callsigns, drag them, or use numeric coordinates and keyboard actions. These are local estimates, independent of instructor aircraft state and isolated by exercise/student identity. Instructor airspace edits retain the shared chart boundary; procedural students receive no live aircraft truth.

Pending controller calls are beside the instruction form. Applying a linked clearance acknowledges that pending call atomically, with replay-safe command IDs. Clearance drafts keep separate units for heading, speed and altitude. Terminated desks disable traffic instructions. Pointer state resets when leaving the desk.

Procedural review has animated top/altitude-side/3D schematic projections and configured separation cues. It records brief cue changes and edited starting positions. This schematic is a training visualization, not a photorealistic replay or universal Doc 4444 rule validator.

One common training guide, Gyani and contextual tours share the release knowledge. Legacy handbook links redirect to the common guide. UI uses consistent Sans typography and Mono numeric data, semantic action colours, visible focus and reduced-motion handling.

## Verification

- Complete Node regression suite: 735 tests passed, 0 failed. Includes QGH engine, web/PWA, instructor suite, procedural browser engine, guide/build/cache routing, session/role boundaries and Supabase SQL tests.
- Go tests: passed, including linked-call atomicity/idempotency and geographic polygon metadata validation.
- Procedural WASM rebuilt from the changed Go source; published source/static manifest hashes refreshed.
- Independent implementation reviews identified and resolved replay sampling/seek bounds, transmission form reset, stale gestures and termination-button state issues.
- Local rendered review could not run because a saved browser permission blocks localhost. The user explicitly authorized publication after automated checks and asked to review the public site afterward. No mobile visual certification, WCAG conformance claim or real-user performance score is implied by these tests.

Deployment scope: GitHub Pages only. The release commit uses Netlify's documented skip marker. No native build, private reference photo, owner hardware handbook or new external AI runtime is included.
