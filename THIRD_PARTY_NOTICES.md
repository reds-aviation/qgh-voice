# Third-party notices

## IBM Plex fonts

This project redistributes unmodified IBM Plex Sans and IBM Plex Mono font files for offline use.

- Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"
- Licence: SIL Open Font License, Version 1.1 (OFL-1.1)
- Full licence text: `packages/qgh-engine/fonts/OFL-1.1.txt`, copied into the Windows and Android asset packages and the generated PWA
- Upstream licence: https://github.com/IBM/plex/blob/master/LICENSE.txt

The project's application licence does not relicense these font files. Their original licence and reserved font name continue to apply.

## Offline voice recognition

This project redistributes the following unmodified Apache-2.0 components for fully offline speech recognition:

- **Vosk Browser 0.0.8** — WebAssembly worker adapter by Ciaran O'Reilly, from https://github.com/ccoreilly/vosk-browser
- **Vosk small US English model 0.15** — Alpha Cephei model package, from https://alphacephei.com/vosk/models
- **Vosk Android 0.3.75** — resolved by Gradle from Maven Central for the Android application, from https://github.com/alphacep/vosk-api

The browser adapter is pinned and stored at `packages/qgh-engine/vendor/vosk-browser-0.0.8.js`. The model archive is stored at `packages/qgh-engine/voice-models/qgh-vosk-en-us-small-0.15.tar.gz`. The Apache License 2.0 text is provided at `packages/qgh-engine/vendor/Apache-2.0.txt` and is included in the native asset copies and generated web package.

The project's application licence does not relicense these components or the language model. Preserve the additional upstream notices embedded in the browser adapter.

## Radio transcript intent model

The simulator's small English transcript classifier uses a vocabulary-specific transformation of Google's Apache-2.0 [BERT-Tiny embeddings](https://huggingface.co/google/bert_uncased_L-2_H-128_A-2/tree/30b0a37ccaaa32f332884b96992754e246e48c5f). The simulator training script fits a new classification head on synthetic radiotelephony examples and exports token scores. The source model and its weights retain their Apache-2.0 terms. The distribution includes the licence at `vendor/Apache-2.0.txt`.

The Windows x64 offline distribution also includes [Hugging Face SmolLM2-360M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct), [Bartowski's Q4_K_M conversion](https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/tree/7be6f65f1db715fe5dc5a4634c0d459b4eed42ec), and [llama.cpp b12669](https://github.com/ggml-org/llama.cpp/releases/tag/b12669). Reuse and redistribution of the model are under Apache-2.0, the llama.cpp runtime under MIT, and its LLVM OpenMP library under Apache-2.0 with LLVM exceptions. The pack contains unmodified Microsoft Visual C++ x64 runtime DLLs under Microsoft's Visual Studio redistributable terms. Original licence texts and notices accompany these files in the installed radio model directory.

## Go browser runtime

The Procedural browser engine uses the Go runtime and `wasm_exec.js`. Their BSD-3-Clause licence is in `packages/procedural-beta/static/GO-LICENSE.txt` and is included in the generated Procedural package. The compiled `procedural-engine.wasm` contains both application code and Go runtime portions; the application's CPAL licence does not relicense the Go portions.

## Pilot voice resources and preparation tools

`packages/qgh-engine/vendor/pilot-tts/NOTICE.md` records the Kokoro Apache-2.0 model provenance, CMUdict BSD-2-Clause pronunciation data and ONNX Runtime MIT tooling. Preserve the notices and licence files alongside those components and the published pilot-voice provenance records. These materials retain their original terms. FFmpeg used to prepare audio is not distributed as part of the simulator.

The first-party helper code under `packages/qgh-engine/vendor/pilot-tts/` remains an intentional MIT-licensed exception to the application CPAL scope. Its existing `NOTICE.md` and corresponding native copies remain unchanged; this does not alter the third-party terms recorded there.

## Native and development dependencies

The Gradle wrapper retains its embedded Apache-2.0 licence. Electron, AndroidX, Vosk Android and development-only packages retain their upstream licences. Native distributions must retain the notices for the dependencies they actually bundle.

## External aeronautical data and insignia

Published airspace records retain their original source and edition references. The application licence does not assert copyright ownership or grant a new licence over external aeronautical data or government insignia. Preserve their applicable source notices and permissions.

## Surya Kiran formation photograph

Exercise setup shows the Indian Air Force Surya Kiran Aerobatic Team at Jodhpur on 8 October 2026. U.S. Air Force photograph by Airman 1st Class Nathaniel Jackson, Pacific Air Forces. DVIDS identifies the photograph as public domain. This app includes a resized WebP copy for offline use.

Source: https://www.dvidshub.net/image/10004641/iaf-day-showcases-tarang-shakti-26
