# v5.0.0 acceptance check

This is an instructional simulator, not an operationally certified release. Keep pilot sound muted on speakers. Enable audible replies only after the headphone test and confirmation.

## 1. Existing exercise controls

Use Single Normal with callsign 430, runway orientation 230, outbound 065 and inbound 225. Confirm that heading turns, speed changes, the clock, D/F requests, one-minute advance, termination and replay still behave as expected. Manual buttons must remain usable while voice is enabled or unavailable.

Repeat in U/S Compass: Left Now → Right Now → Stop Now. Reversal must not require an intermediate stop, movement must remain continuous, and no actual heading may be exposed. Check orbit, Continue Orbit and Resume Normal separately.

## 2. Your microphone and headset

Try both PTT and Continuous Listening. In Single, use both “430 transmit for DF” and “transmit for DF”; both should address the one aircraft. In Normal, compare “turn right 230” with “turn right heading 230”. Check the red result and affected control, not just the audible reply.

Arm a heading-passing report for a heading the aircraft will actually cross during its current turn. It must report once at the crossing without changing the turn target. A heading already passed or not crossed should not cause an immediate fictitious report.

Interrupt a pilot reply with a new instruction. The new accepted instruction must execute, the obsolete audio must stop, and manual controls must remain usable. Try 100, 130 and 170 WPM. Before removing headphones, mute pilot sound. Do not enable speaker playback while testing recognition.

## 3. New level and radio functions

Start at altitude 6,000 ft with a 1,000 ft/min vertical rate. Give “climb to 7000 feet” and “report reaching”. One minute of simulated climb must reach and hold 7,000 ft and produce only one reaching event. Pressure changes must not jump the aircraft's physical altitude or silently move its accepted target.

Check QNH/QFE, runway, squawk and frequency against the red readback and Level & Radio panel. Weather information should be received without a turn. “Stand by for left turn” must not initiate a turn. Conditional, contradictory or unclear manoeuvres must not execute.

## 4. Tactical, review and learning

Use four aircraft including numeric 430 and 431. Address the aircraft that is not manually selected: only the intended aircraft should respond, while manual selection remains unchanged. Try an unknown callsign; it must not move another aircraft. Check formation following, individual detachment and vertical separation warnings.

Terminate and inspect curved tracks, command timing and the optional altitude profile. Open the Training Centre, search for a call, watch a guide, select a chapter, save one clip offline and remove it again.

## Physical-device checks still needed

On an actual Android phone and iPhone/Safari, check first load, portrait/landscape, open keyboard, scrolling dialogs, permissions, headphone changes, background/resume and a prepared installed-PWA offline cold start. Desktop viewport checks do not establish these results.
