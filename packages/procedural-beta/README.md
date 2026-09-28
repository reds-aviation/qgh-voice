# Procedural Beta

GitHub Pages only: instructor and student tabs share an authoritative Go WebAssembly engine in a SharedWorker on the same computer/browser profile. Desktop Chrome and Edge are the initial supported browsers. This is a training beta, not an operational ATC service.

The instructor generates 1–24 aircraft, admits students by PIN, and controls the exercise. Students receive the existing explicit student projection, including transmission-only D/F and instructor-selected chart layers, without radar truth. Maps and checkpoints stay in this browser's IndexedDB. Commands and deduplication receipts commit together before acknowledgement. Restart, loss of instructor, storage failure or a suspended browser pauses the exercise. Export portable scenarios before clearing browser storage. The first page load requires connectivity.

`manifest.json` is the explicit publication allowlist and SHA-256 inventory. Only `static/` goes into the site. No uploaded reference photographs, runtime databases or access files are included. Chart data carries source/effective-date information; it is not a live navigation feed.

Engine source is in `engine/`. Rebuild with Go 1.25.0: from that folder run `GOOS=js GOARCH=wasm go build -trimpath -buildvcs=false -o ../static/procedural-engine.wasm ./cmd/browser`, then copy the same Go installation's `lib/wasm/wasm_exec.js` into `static/` and update the inventory. The public bridge runs the same procedural state, motion, validation, radio and student-projection code as the local simulator. There is no hosted API or cross-computer relay.

`QGH_PROCEDURAL_BETA=1 node scripts/build-web.mjs` adds the package and the top-right header links. The GitHub Pages workflow enables it; the default build and Netlify configuration do not. Publishing commits use `[skip netlify]`.
