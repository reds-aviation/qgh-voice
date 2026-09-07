# Reds QGH Simulator v5.0.0 — Complete QGH Training Edition

## Release files

- `QGH Simulator 5.0.0.exe` — portable Windows application for 64-bit Windows.
- `Reds-QGH-Simulator-v5.0.0-release.apk` — production-signed Android installer for direct installation.
- `Reds-QGH-Simulator-v5.0.0-play-store.aab` — production-signed Android App Bundle for Google Play Console upload. It is not directly installable on a phone.

## Use

The simulator is designed to run offline after installation. The Android app includes the local voice resources and video guides. Manual controls remain available whether voice is unavailable, muted or interrupted.

For Android, transfer the APK from a trusted source, allow the receiving file manager or browser to install the app when Android asks, and then open **QGH Simulator**. For Play Store submission, upload only the AAB through the owner’s Play Console; do not distribute the AAB to users.

The Windows build is a portable executable. It is not Authenticode-signed, so Windows may show a SmartScreen reputation message until the release has established reputation or a trusted signing certificate is configured. Obtain it only from the verified project release folder or the project owner.

## Package verification

The Android APK was built in release mode, passed Android release lint, and was verified with Android APK Signature Scheme v2 using the project’s 4096-bit release signing key. The AAB was signed and verified as a Play Store upload bundle. The Windows executable is built from the same synchronized engine assets and is checked separately for its unsigned status.

SHA-256 values for the supplied files:

- `QGH Simulator 5.0.0.exe`: `48D6B122B554B5F4781A89792C3A5E4A36F7612740277C09660C4F58D9EB4B48`
- `Reds-QGH-Simulator-v5.0.0-release.apk`: `6DBABFB1698C6B6582FD6EB984973E5A62D1FA468DC063FC8E855729F699AFD3`
- `Reds-QGH-Simulator-v5.0.0-play-store.aab`: `A865C38B956E43C715ED02E714087389C08C352556FA4031323DF9CB31262BD4`

## Scope

This is an instructional QGH simulator, not an ICAO-certified or operationally approved system. It preserves the established Single/Tactical → setup → exercise → terminate → review workflow, including Normal QGH, U/S Compass, local voice operation, optional pilot readbacks, training catalogue and high-quality narrated screen guides.
