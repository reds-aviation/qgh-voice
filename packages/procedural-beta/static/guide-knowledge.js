// Shared release knowledge: guides, Gyani and screen tours. Maintain with every UI change.
(function(root){ const knowledge = {
  "revision": "2026.09.29.8",
  "learning": "I am also learning. If I’m unable to answer, please refer to the training guides.",
  "flow": [
    {
      "title": "QGH · Individual practice",
      "href": "qgh.html",
      "text": "QGH cloud-breaking procedure: Suite home → QGH Individual Practice → Single aircraft or Tactical → configure → start → terminate and review."
    },
    {
      "title": "QGH · Instructor-led / ATSS",
      "href": "instructor-led/",
      "text": "Suite home → QGH Instructor-led → Instructor → QGH, Surveillance/SRE, SRA or PAR → choose This device / Online room → create → matching connection + PIN → Admit → Ready → Start."
    },
    {
      "title": "Procedural",
      "href": "procedural-beta/",
      "text": "Suite home → Procedural → Instructor setup → edit aircraft roster and airspace → Create session → Session → open student tab → PIN → Admit → Ready → Run."
    }
  ],
  "entries": [
    {
      "id": "online-recovery",
      "title": "Lost connection or stale picture",
      "topics": [
        "qgh-instructor",
        "sra",
        "par"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:reconnect|disconnected|lost link|stale|network error|connection lost|internet.*lost)\\b",
      "text": "Keep the instructor window open. A lost online connection pauses the instructor exercise and invalidates stale student indications. Restore internet, use Reconnect on the student if needed, then let the instructor Resume. Reloading the same student tab can restore its admitted seat; pilot audio starts muted. If necessary, Release Student Seat and admit a replacement. Refreshing or closing the instructor tab ends its live QGH/ATSS exercise.",
      "questions": [
        "My trainee has a frozen display",
        "The student lost connectivity",
        "Can I refresh the instructor?"
      ]
    },
    {
      "id": "extended-screens",
      "title": "Best offline setup: two extended screens",
      "topics": [
        "suite",
        "qgh",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "par",
        "procedural"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:extend|extended|duplicate|second screen|second monitor|two screens|2 screens|two monitors|2 monitors|dual monitor|screen 2|another monitor)\\b",
      "text": "For the best offline instructor-led exercise, use one PC and two monitors in Extend mode. On Windows press Windows + P → Extend. Open instructor and student in separate windows of the SAME browser profile. Drag the student window to screen 2; Windows + Shift + Left/Right Arrow moves a window between monitors. Do not choose Duplicate: it reveals the instructor picture. One PC still shares one mouse pointer and keyboard focus. The student gives verbal instructions while the instructor operates the aircraft.",
      "questions": [
        "How do I put the pupil on another monitor?",
        "Best offline display arrangement",
        "Both monitors show identical pictures",
        "Can I use two keyboards independently?"
      ]
    },
    {
      "id": "connections",
      "title": "Offline and online: which connection?",
      "topics": [
        "suite",
        "qgh",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "par",
        "procedural"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:online|internet|supabase|different (?:devices|systems|pcs|computers)|same (?:pc|browser)|offline capability|connection mode|another (?:pc|computer|device))\\b",
      "text": "This device / offline: instructor and student must use the SAME PC, SAME browser profile and exact same site address, in separate windows. Two monitors in Extend mode are recommended. Online room: instructor and student can use DIFFERENT PCs/devices, with internet on both. Choose Online room on both, use the same PIN, then Admit → Ready → Start/Run. QGH instructor-led, Surveillance/SRE, SRA, PAR and Procedural support these choices. Keep the instructor window open. Separate PCs without internet cannot share a live exercise in this release.",
      "questions": [
        "Can my instructor use another laptop?",
        "Can we train without WiFi?",
        "Can two computers connect without internet?",
        "Is Supabase used for QGH and PAR?"
      ]
    },
    {
      "id": "guided-tour",
      "title": "Guided tour of the current screen",
      "topics": [
        "suite",
        "qgh",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "par",
        "procedural"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:guided tour|screen tour|walkthrough|walk through|show me around|where are the controls)\\b",
      "text": "Choose Guided tour in the page navigation or scope tool rail. It highlights the visible controls one at a time with Back and Next. It never flies aircraft or changes settings. Finish or press Escape to close it. Tours are available on setup, paused exercises and review; pause before consulting help during an exercise. QGH also retains its separate radio-practice familiarisation.",
      "questions": [
        "Show me around the simulator",
        "Where are all the buttons?",
        "How can a beginner learn the interface?"
      ]
    },
    {
      "id": "help-limits",
      "title": "What Gyani knows",
      "topics": [
        "suite",
        "qgh",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "par",
        "procedural"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:embeddings?|llm|artificial intelligence|limitations?|learning|trained|smart answers|update (?:the )?guides)\\b",
      "text": "I am Gyani, a fast local guide. I match simulator questions to versioned guide answers using keywords, spelling tolerance and a small local vector index. I am not an LLM and do not invent operational advice or inspect your live traffic. My answers and the current-flow guide sections are built from the same content. Every feature change still needs its explanation to be maintained and checked before release. I am also learning. If I’m unable to answer, please refer to the training guides.",
      "questions": [
        "Are you a real AI?",
        "Can you see my aircraft?",
        "Are answers automatically updated?"
      ]
    },
    {
      "id": "turn",
      "title": "Turn left or right",
      "topics": [
        "procedural"
      ],
      "controls": [
        "quick-left",
        "quick-right",
        "quick-stop"
      ],
      "anchor": "pilot",
      "match": "\\b(?:turn|turning|steer|heading|left|right)\\b",
      "text": "Select an aircraft on the instructor scope. Double-click the left mouse button on that aircraft to turn left now, or double-click the right mouse button to turn right now. On a phone, tap the aircraft, then use ← Left or Right → below the scope. These are continuous turns: press Stop turn to level the wings. For a specific heading, open More → heading controls and use Turn to. The student sends instructions; the instructor flies the aircraft."
    },
    {
      "id": "stop-turn",
      "title": "Stop a turn",
      "topics": [
        "procedural"
      ],
      "controls": [],
      "anchor": "pilot",
      "match": "\\b(?:stop|end|cancel|level)\\b.*\\b(?:turn|turning|wings|orbit)\\b|\\bwings level\\b",
      "text": "Select the aircraft, then press Stop turn below the scope. The aircraft levels its wings at its current heading. This also exits an orbit immediately. Leave orbit / hold instead completes the current orbit lap before leaving."
    },
    {
      "id": "orbit",
      "title": "Orbit and leave an orbit",
      "topics": [
        "procedural"
      ],
      "controls": [],
      "anchor": "pilot",
      "match": "\\borbit|circle|circling\\b",
      "text": "Select the aircraft, open Aircraft controls (or More), then choose Orbit left or Orbit right. Leave orbit / hold requests an exit after the current lap. Stop turn exits immediately. The exercise must be running for movement."
    },
    {
      "id": "speed-level",
      "title": "Speed, climb and descent",
      "topics": [
        "procedural"
      ],
      "controls": [
        "scope-speed-form",
        "scope-level-form",
        "climb-to",
        "descend-to"
      ],
      "anchor": "pilot",
      "match": "\\b(?:speed|altitude|climb|descend|descent|flight level|height|level)\\b",
      "text": "Select the aircraft → More / Aircraft controls. Enter speed in knots and press Set speed. For altitude, choose feet QNH or Flight level, enter the target, then use Set level, Climb to or Descend to. Climb/descent follows the configured rate. Configure QNH before assigning levels."
    },
    {
      "id": "transmit",
      "title": "Transmit and read the bearing",
      "topics": [
        "procedural"
      ],
      "controls": [
        "quick-transmit",
        "bearing-type"
      ],
      "anchor": "pilot",
      "match": "\\b(?:transmit|transmission|talk|pilot readback|readbacks?|qdm|qte|homing|bearing|df)\\b",
      "text": "Select the aircraft and press Transmit below the scope (or T with the scope focused). This activates the bearing ray and homing instrument. QDM selects magnetic homing; QTE selects true bearing. More → Bearing display sets the released bearing hold from 2–30 seconds. New exercises use 10 seconds. Pilot replies appear in red. Optional local pilot voice is separate from the bearing display."
    },
    {
      "id": "sweep",
      "title": "Radar scan and RPM",
      "topics": [
        "procedural"
      ],
      "controls": [],
      "anchor": "scope",
      "match": "\\b(?:radar sweep|sweep|scanning|rpm|revolutions?|rotation|scan speed)\\b",
      "text": "Open Declutter → Scope detail & tools. Enable 360° radar sweep and set 1–60 RPM. At 12 RPM one revolution takes 5 real seconds. The sweep pauses when the exercise pauses. It is a visual scan; instructor truth and student transmission-only bearings retain their existing behaviour. Reduced-motion devices start with the sweep off."
    },
    {
      "id": "roster-mobile",
      "title": "Edit aircraft on a phone",
      "topics": [
        "procedural"
      ],
      "controls": [
        "traffic-setup"
      ],
      "anchor": "traffic",
      "match": "\\b(?:callsigns?|scroll|roster|keyboard|phone|mobile|aircraft count|add aircraft|generate traffic)\\b",
      "text": "Open Traffic setup and set 1–24 aircraft. On phones each aircraft has a card with labelled inputs; scroll the page vertically. Jump to aircraft goes straight to a callsign. Reducing the count keeps hidden row edits. Create session applies the visible roster together and starts paused. Use the selected aircraft’s arrows for quick turns; More opens the other controls."
    },
    {
      "id": "run-pause",
      "title": "Run, pause and resume",
      "topics": [
        "procedural"
      ],
      "controls": [
        "resume",
        "pause",
        "step"
      ],
      "anchor": "review",
      "match": "\\b(?:run|pause|resume|start|nothing moves|not moving|stopped)\\b",
      "text": "Run starts the prepared exercise. An admitted controller must press Ready first; manage admission in Session. Pause freezes traffic, the exercise clock and radar sweep. Run continues the same exercise. +1 min advances the scenario by one minute. The red Terminate exercise button is for review; Reopen exercise restores the same exercise paused."
    },
    {
      "id": "session-isolation",
      "title": "Separate exercises and student PINs",
      "topics": [
        "procedural"
      ],
      "controls": [],
      "anchor": "start",
      "match": "\\b(?:multiple|many users|same time|different users|separate|another device|another phone|remote|load balanc|independent)\\b",
      "text": "Each instructor room has its own exercise, PIN, aircraft and clock. A student joins only that room and must be admitted. This device / offline is limited to one PC and the same browser profile; two extended screens are recommended. Online room connects different devices with internet on both. The instructor tab must stay open; lost connectivity pauses traffic. Only the student projection is shared."
    },
    {
      "id": "qgh-turn",
      "title": "Turn controls in QGH",
      "topics": [
        "qgh",
        "qgh-individual"
      ],
      "controls": [],
      "anchor": "controls",
      "match": "\\b(?:turn|turning|left|right|heading|steer|stop turn)\\b",
      "text": "In Normal QGH, enter the target heading and use Turn left or Turn right. In U/S Compass, use Turn left now / Turn right now, then Stop turn now after the required timed turn. In Tactical practice select the intended aircraft first. Mouse double-click turning is a Procedural feature; individual QGH retains its own manual controls."
    },
    {
      "id": "instructor-turn",
      "title": "Instructor-led turn controls",
      "topics": [
        "qgh-instructor",
        "sra",
        "par"
      ],
      "controls": [],
      "anchor": "commands",
      "match": "\\b(?:turn|turning|left|right|heading|steer|stop turn)\\b",
      "text": "Select the aircraft in the instructor console. Use the heading and turn controls for a normal heading-directed turn. For U/S Compass use Left now / Right now and Stop turn. The controller display does not fly aircraft. Command Bar → HELP lists the exact commands accepted by this beta."
    },
    {
      "id": "terminate-exercise",
      "title": "Terminate and reopen a Procedural exercise",
      "topics": [
        "procedural"
      ],
      "controls": [
        "terminate",
        "terminate-quick"
      ],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:terminate|termination|end exercise|finish exercise|stop exercise)\\b",
      "text": "On the instructor scope, press the red ■ Terminate exercise button and confirm. Traffic stops, the button reads Exercise terminated and the review opens. Use Reopen exercise to restore the same traffic and records paused, then Run. Pause is the choice for a temporary stop. Students cannot terminate the instructor exercise.",
      "questions": [
        "How do I finish this session?",
        "Where is the red end button?"
      ]
    },
    {
      "id": "review-controls",
      "title": "Review and replay without covering the plot",
      "topics": [
        "qgh",
        "qgh-individual"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:replay|review|debrief|zoom.*(?:bar|toolbar)|toolbar.*(?:cover|plot))\\b",
      "text": "After termination, scroll to the review plot. Replay, replay speed, Zoom and Fit controls sit below the plot instead of floating over it. Return Console goes back to the console; New Exercise prepares another exercise. Replay does not change the completed flight.",
      "questions": [
        "The replay buttons cover my track",
        "How do I watch my flight again?"
      ]
    }
  ],
  "tours": [
    {
      "pages": [
        "procedural"
      ],
      "selector": "#session-mode",
      "title": "Choose where you train",
      "text": "This device / offline: instructor and student must use the SAME PC, SAME browser profile and exact same site address, in separate windows. Two monitors in Extend mode are recommended. Online room: instructor and student can use DIFFERENT PCs/devices, with internet on both. Choose Online room on both, use the same PIN, then Admit → Ready → Start/Run. QGH instructor-led, Surveillance/SRE, SRA, PAR and Procedural support these choices. Keep the instructor window open. Separate PCs without internet cannot share a live exercise in this release."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#instructor-login",
      "title": "Prepare traffic",
      "text": "Open instructor setup, enter the aircraft roster and prepare your airspace. Create the session to reach the scope paused."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#student-join",
      "title": "Controller admission",
      "text": "Choose the same connection as the instructor. Enter your name and PIN, request admission, then press Ready when admitted."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#traffic-setup",
      "title": "Traffic and session",
      "text": "Traffic setup edits aircraft. Session shows the PIN and student admission. Use the same browser profile on one offline PC, or Online room on both internet-connected devices."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#scope",
      "title": "Scope picture",
      "text": "Drag or scroll to pan; Ctrl + scroll zooms. Instructor: select an aircraft to control it. Student: use transmitted bearings and strips; the full instructor truth is withheld."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#aircraft-quick-controls",
      "title": "Quick aircraft control",
      "text": "Left and Right start continuous turns. Stop turn levels the wings. Transmit produces the bearing indication; More opens heading, level and speed controls."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#homing",
      "title": "Homing instrument",
      "text": "QDM selects magnetic homing; QTE selects true bearing. Read the pilot reply above it. Bearing indications follow the transmitting aircraft."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#edge-actions",
      "title": "Choose your tools",
      "text": "Declutter selects routes and boundaries for both desks. Flight strips, chart briefing, separation and approach aids are available around the scope."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#terminate-quick",
      "title": "Pause or finish",
      "text": "On the instructor scope, press the red ■ Terminate exercise button and confirm. Traffic stops, the button reads Exercise terminated and the review opens. Use Reopen exercise to restore the same traffic and records paused, then Run. Pause is the choice for a temporary stop. Students cannot terminate the instructor exercise."
    },
    {
      "pages": [
        "instructor",
        "student"
      ],
      "selector": "#exerciseConnection",
      "title": "Offline or online",
      "text": "This device / offline: instructor and student must use the SAME PC, SAME browser profile and exact same site address, in separate windows. Two monitors in Extend mode are recommended. Online room: instructor and student can use DIFFERENT PCs/devices, with internet on both. Choose Online room on both, use the same PIN, then Admit → Ready → Start/Run. QGH instructor-led, Surveillance/SRE, SRA, PAR and Procedural support these choices. Keep the instructor window open. Separate PCs without internet cannot share a live exercise in this release."
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#exerciseFamily",
      "title": "Select the exercise",
      "text": "QGH is the cloud-breaking procedure. Choose Normal or U/S Compass. Surveillance/SRE, SRA and PAR use their own sensor displays in the same instructor flow."
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#aircraftRoster",
      "title": "Build your traffic",
      "text": "Set 1–24 aircraft and edit their callsign, position, heading, level and performance. Each callsign tab selects the aircraft you will control."
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#createSession",
      "title": "Create the room",
      "text": "Create the session. Offline opens a student window on the same PC. Online students open Controller Position on their device. Share the six-digit PIN, Admit, wait for Ready, then Start."
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#sessionPin",
      "title": "Connect the controller",
      "text": "Share this PIN only with your controller. Admit the request and wait for Ready. For offline training use two extended screens, with a separate student window on screen 2."
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#aircraftRosterTabs",
      "title": "Select before commanding",
      "text": "Click the aircraft tab or its scope symbol. Heading, speed, level and report controls apply to the selected aircraft. PAR continues tracking the designated approach aircraft."
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#keyboardCommandInput",
      "title": "Aircraft commands",
      "text": "Buttons remain available. Command Bar accepts exact aliases such as L 230, SPD 240, ALT 7000 and HELP. QGH D/F appears during pilot transmission. SRA/PAR guide lines do not command descent."
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": ".lifecycle-actions",
      "title": "Run, pause and finish",
      "text": "Start after Ready. Pause freezes the exercise; Resume continues it. Terminate ends the exercise and opens the instructor review."
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#joinPin",
      "title": "Request admission",
      "text": "Enter the instructor’s six-digit PIN in the matching connection mode. Request to join; wait for admission and press Position Ready."
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#studentReady",
      "title": "Signal Ready",
      "text": "Check the exercise mode and optional installed pilot voice. Press Position Ready so the instructor can start."
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#qghStudentView",
      "title": "QGH bearings",
      "text": "QDM is magnetic homing; QTE is true bearing. Only the pilot transmission provides D/F. The full instructor traffic picture is not shown."
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#radarStudentView",
      "title": "Surveillance and SRA",
      "text": "Returns are sampled on radar-beam crossing. Range and history adjust your picture. Scope options hide labels or provided aids locally. Primary plots remain anonymous; SRA descent cues are references."
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#parStudentView",
      "title": "PAR guidance",
      "text": "Compare elevation and azimuth for the designated aircraft. Adjust range and history as needed. The displayed glidepath does not fly the aircraft."
    },
    {
      "pages": [
        "single"
      ],
      "selector": "#setup",
      "title": "Set up QGH",
      "text": "Choose Normal or U/S Compass. Check runway, inbound/outbound tracks, callsign, initial range, speed and turn rate before starting."
    },
    {
      "pages": [
        "tactical"
      ],
      "selector": "#tSetup",
      "title": "Set up Tactical QGH",
      "text": "Choose the procedure, aircraft count and individual performance. Check formation settings before starting."
    },
    {
      "pages": [
        "single",
        "tactical"
      ],
      "selector": ".review-toolbar, .tactical-review-toolbar",
      "title": "Review your exercise",
      "text": "After termination, scroll to the review plot. Replay, replay speed, Zoom and Fit controls sit below the plot instead of floating over it. Return Console goes back to the console; New Exercise prepares another exercise. Replay does not change the completed flight."
    },
    {
      "pages": [
        "single"
      ],
      "selector": "#runway",
      "title": "Runway and procedure tracks",
      "text": "Check runway, inbound and outbound tracks for the exercise. These are training settings; QGH is a cloud-breaking procedure."
    },
    {
      "pages": [
        "single"
      ],
      "selector": "#normal",
      "title": "Normal or U/S Compass",
      "text": "Normal uses left/right turns to an assigned heading. U/S Compass uses timed Left now / Right now and Stop turn now. Select the appropriate procedure before starting."
    },
    {
      "pages": [
        "single"
      ],
      "selector": "#startExercise",
      "title": "Run, transmit, then review",
      "text": "Start after checking the aircraft settings. Select the intended aircraft in Tactical. Use Transmit for D/F, then the manual turn, level and speed controls. Terminate opens the review. The existing radio-practice tour provides guided familiarisation."
    },
    {
      "pages": [
        "tactical"
      ],
      "selector": "#tRunway",
      "title": "Runway and procedure tracks",
      "text": "Check runway, inbound and outbound tracks for the exercise. These are training settings; QGH is a cloud-breaking procedure."
    },
    {
      "pages": [
        "tactical"
      ],
      "selector": "#tProcedureNormal",
      "title": "Normal or U/S Compass",
      "text": "Normal uses left/right turns to an assigned heading. U/S Compass uses timed Left now / Right now and Stop turn now. Select the appropriate procedure before starting."
    },
    {
      "pages": [
        "tactical"
      ],
      "selector": "#tStart",
      "title": "Run, transmit, then review",
      "text": "Start after checking the aircraft settings. Select the intended aircraft in Tactical. Use Transmit for D/F, then the manual turn, level and speed controls. Terminate opens the review. The existing radio-practice tour provides guided familiarisation."
    }
  ]
};
if(typeof module === 'object' && module.exports) module.exports=knowledge; else root.ATCGuideKnowledge=knowledge;
})(typeof globalThis==='object'?globalThis:this);
