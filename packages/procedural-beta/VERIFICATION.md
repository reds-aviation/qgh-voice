# Browser beta verification — 28 September 2026

- Existing QGH engine/web and instructor-led suites, plus the procedural worker integration check: 681 tests passed.
- Canonical procedural Go tests across all packages, Go vet and TypeScript compilation passed.
- The worker integration uses the actual shipped WebAssembly engine. It verifies PIN admission, Ready gating, per-port session binding, student projection, instructor-only commands/export, command retry deduplication, shared route visibility, atomic checkpoint/receipt persistence, instructor departure, paused recovery, deduplication after restart and a rejected acknowledgement after simulated storage failure.
- Built the copied engine source independently with Go 1.25.0 and `-trimpath -buildvcs=false`. Its WebAssembly SHA-256 matches the shipped binary: `d7f2d1fbc031732d73ef681332bfb114d853ac285184a1775933b044868156cc`.
- Static `/qgh-voice/` browser preview: created three aircraft, opened a student in a new tab, entered PIN, admitted and marked Ready, ran/paused traffic, hid one route and observed the student's disabled matching selection, transmitted D/F and observed pilot caption/QDM and station bearing, then reloaded the instructor and recovered the same paused traffic and clock.
- The GitHub build adds adjacent Instructor Beta and Procedural Beta links to the top-right header. Individual Single/Tactical pages and the existing instructor-led package remain intact. The default build was checked to contain neither the Procedural Beta link nor its directory. Netlify configuration was not changed.
- Browser checks used desktop Chromium in the in-app browser. Physical Edge, mobile devices and multiple computers were not tested. This beta explicitly requires same-computer, same-profile desktop tabs; it is not a network classroom service.
- Publication inventory is allowlisted and checksum-verified. It excludes uploaded reference photos, saved exercise data, operator credentials and native executables.
