# ATS SIM BOX · Version 1 web app

This folder creates the ATS SIM BOX Version 1 hosted Progressive Web App (release `1.0.0`). It packages individual QGH, instructor-led QGH/SRE/SRA and Procedural exercises into `apps/web/dist`. Windows and Android native bundles are built separately.

## Build locally

From the repository root:

~~~powershell
$env:QGH_PROCEDURAL_BETA = '1' # Internal compatibility flag; the public suite is Version 1.
node .\scripts\build-web.mjs
python -m http.server 57172 --bind 127.0.0.1 --directory .\apps\web\dist
~~~

Open `http://127.0.0.1:57172/index.html`. A service worker is enabled for HTTPS deployments and for localhost only. The output directory is generated and intentionally excluded from Git.

## What is included

- A web app manifest and Apple home-screen metadata.
- A service worker that caches the QGH application shell for offline use after the first successful load, plus the self-hosted Vosk model only after the user explicitly chooses offline voice setup.
- User-controlled updates: an update never reloads an active exercise.
- A hosted-web-only install area on the entry page. It is absent from the native application bundles.
- Optional Vosk-powered offline voice control with **PTT** by default and an optional Continuous Listening assistant. The PWA downloads its self-hosted model (about 40 MB) only when the user selects **SET UP OFFLINE VOICE** while online, then uses the local cache.
- An optional first-run Guided Familiarisation with Skip and later Guided Tour access.
- A clean allowlist build that excludes local state, stale duplicate screens, tests, installers, and signing material.

Individual QGH keeps the current attempt in memory. Instructor-led exercises support documented browser recovery and saved exercise libraries. Logout clears the current tab's session recovery and returns Home; it retains saved exercises. This device/offline requires the same PC, browser profile and site address. Online room uses different devices with internet on both.

## Native download links

`static/release-links.js` deliberately begins with `null` values. Once real HTTPS release asset URLs exist, add those URLs there and rebuild. Do not add APKs, EXEs, certificates, passwords, or signing keys to this repository or to the PWA cache.

For complete Cloudflare Pages, GitHub, iPhone, and access-control instructions, see [WEB_PWA_DEPLOYMENT.md](../../docs/WEB_PWA_DEPLOYMENT.md).
