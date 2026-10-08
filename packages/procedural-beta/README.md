# ATS SIM BOX · Version 1 — Procedural

Procedural control is included in the same ATS SIM BOX Version 1 build on GitHub Pages and Netlify. This device/offline shares the authoritative Go WebAssembly engine through a SharedWorker on one PC, in the same browser profile and site address. Online room connects different devices through the configured service, with internet on both. This is a training simulator, not an operational ATC service.

The instructor generates 1–20 aircraft, admits students by PIN, and controls the exercise. Students receive the explicit student projection, including transmission-only D/F and instructor-selected chart layers, without radar truth. Maps and checkpoints use browser storage. Commands and deduplication receipts commit together before acknowledgement. Loss of instructor, storage failure or a suspended browser pauses the exercise. Logout discards this tab's recovery and leaves its session; saved exercise libraries remain. Export portable scenarios before clearing browser storage. The first page load requires connectivity.

`manifest.json` is the explicit publication allowlist and SHA-256 inventory. Only `static/` goes into the site. No uploaded reference photographs, runtime databases or access files are included. Chart data carries source/effective-date information; it is not a live navigation feed.

Engine source is in `engine/`. The current verified WASM was built with Go 1.27.1. From that folder run `GOOS=js GOARCH=wasm go build -trimpath -buildvcs=false -o ../static/procedural-engine.wasm ./cmd/browser`, then copy the same Go installation's `lib/wasm/wasm_exec.js` into `static/` and update the inventory. The public bridge runs the procedural state, motion, validation, radio and student-projection code; online rooms use the configured relay.

`QGH_PROCEDURAL_BETA=1 node scripts/build-web.mjs` includes the whole suite. The flag, directory and existing `/procedural-beta/` route keep their internal names for compatibility; they are not public release-stage labels. Both hosting configurations use the suite build.
