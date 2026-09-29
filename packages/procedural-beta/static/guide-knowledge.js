// Shared release knowledge: guides, Gyani and screen tours. Maintain with every UI change.
(function(root){ const knowledge = {
  "revision": "2026.09.29.21",
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
      "id": "lfa-image-alignment",
      "title": "Align an uploaded LFA layout",
      "topics": [
        "procedural"
      ],
      "controls": [
        "map-file",
        "map-align-form",
        "map-align-apply"
      ],
      "anchor": "airspace",
      "priority": true,
      "match": "\\b(?:align|calibrat|embed|upload.*(?:image|map|layout)|reference point|point c)\\w*\\b",
      "text": "Pause and save the correct ARP first. In Edit airspace → LFA image · guided alignment, choose a flat PNG/JPEG (up to 5 MB, 4096 pixels per side, 16 megapixels). Enter source, edition/date, LFA limits and layout notes. Select A and tap the ARP in the image; mark B and C at known points and enter their coordinates. Spread the points across the chart, with C away from line A–B. Percentages can be entered instead of tapping. Check alignment calculates width and true-north rotation and checks C independently. Apply and share stores the calibrated image and notes for both desks; students enable Map to display it. A distorted photo or unscaled sketch may fail the check; use a flat chart with known points. The image does not automatically create editable boundaries; enter those in the boundary editor. Fine-tune changes require another check against known points.",
      "questions": [
        "How do I align my LFA image?",
        "Why does point C fail?",
        "Can I upload a simple layout image?"
      ]
    },
    {
      "id": "arp-upload",
      "title": "Enter or upload ARP coordinates",
      "topics": [
        "procedural"
      ],
      "controls": [
        "arp-file",
        "arp-template",
        "chart-form"
      ],
      "anchor": "airspace",
      "priority": true,
      "match": "\\b(?:arp|aerodrome reference point|upload coordinates|origin coordinates)\\b",
      "text": "Open Edit airspace → Chart origin & shared briefing. ARP means Aerodrome Reference Point; it anchors geographic entries. Enter WGS-84 latitude/longitude in decimal degrees or DMS, or upload one JSON/CSV record with aerodromeName, latitude, longitude, chartReference and effectiveInfo. Download ARP template uses the selected published base, or supplies an editable blank template. Review, then Save shared chart settings. The VOR has separate offsets. Changing the ARP removes the old image and keeps existing local traffic/routes/areas at their local positions; it does not reproject them. Reload a published base to restore its sourced geometry, or enter custom coordinates after setting your origin.",
      "questions": [
        "How do I upload ARP coordinates?",
        "Can I type latitude and longitude?",
        "Where is the ARP template?"
      ]
    },
    {
      "id": "public-lfa-samples",
      "title": "Public LFA samples and real ATS routes",
      "topics": [
        "suite",
        "procedural"
      ],
      "controls": [
        "aerodrome-select",
        "aerodrome-layout-svg"
      ],
      "anchor": "airspace",
      "priority": true,
      "match": "\\b(?:lfa|ats route|airspace|aerodrome|public chart|real route|sample map)\\b",
      "text": "In Procedural, open Configure airspace during setup or Edit airspace on the instructor desk. Select Hindan, Pune, Jodhpur, Chandigarh, Gwalior, Agra or Bareilly to preview numbered LFA/CTR outlines, real published ATS route sections and source links. Load aerodrome airspace applies the dated AIP sample to both desks and pauses the exercise. The snapshot is effective 3 September 2026, with disclosed omissions; it is not live NOTAM data or the complete network. Route overview fits the network; Local view returns to the base. Declutter selects which routes and boundaries both desks see. A public AIP source is not a licence to redistribute chart images.",
      "questions": [
        "Where are the sample LFAs?",
        "Are these real ATS routes?",
        "Show public airspace charts"
      ]
    },
    {
      "id": "instructor-instrument-shelf",
      "title": "Instructor homing and pilot messages below the scope",
      "topics": [
        "suite",
        "procedural"
      ],
      "controls": [
        "quick-heading",
        "homing",
        "pilot-readback"
      ],
      "anchor": "scope",
      "priority": true,
      "match": "\\b(?:where.*(?:homing|pilot message|pilot caption)|homing.*(?:below|moved)|heading.*(?:white|visible|read|dark))\\b",
      "text": "On the Procedural instructor screen, homing and pilot transmissions sit beside the turn and heading controls below the radar, leaving more room for the scope. On phones, the heading controls use the left column and a larger homing display plus a compact, scrollable red pilot message use the right column. The heading field has a dark background, bright digits and a gold focus border. More controls opens the full Aircraft panel, including speed, altitude and Local pilot voice controls. The phone radar has a larger reserved area; scroll to reach the lower controls. Hide controls keeps homing and pilot messages visible. The student instrument layout is unchanged.",
      "questions": [
        "Where is the homing display?",
        "Where are pilot messages now?",
        "The heading is white and not visible"
      ]
    },
    {
      "id": "local-pin-recovery",
      "title": "Recover a rejected local session PIN",
      "topics": [
        "procedural"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:wrong|incorrect|expired|rejected|invalid)\\b.*\\bpin\\b|\\bpin\\b.*\\b(?:wrong|incorrect|expired|rejected|invalid|not working)\\b",
      "text": "Check that both positions use the same Exercise connection. This device needs the same PC, browser profile and site address; other devices need Online room with internet on both. Copy the PIN currently shown in the instructor Session panel. If an older cached release rejects that local PIN, finish the exercise, return to Suite home, choose Update available · reload, then create a new session and share its new PIN. An old PIN does not join a newly created session.",
      "questions": [
        "Why is my PIN rejected?",
        "Incorrect session PIN",
        "The local PIN is not working"
      ]
    },
    {
      "id": "mobile-workspace",
      "title": "Use the suite on a small screen",
      "topics": [
        "suite",
        "qgh",
        "procedural",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "par"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:small screen|landscape|screen clipped|buttons off screen|scope disappeared|radar too small|scroll (?:the )?workspace)\\b",
      "text": "On narrow or short screens, scroll the Procedural workspace vertically to reach the scope and controls; the radar keeps a usable height. Swipe the top navigation, scope tools and panel tabs sideways to reach extra actions. Setup navigation wraps onto additional rows. Hide controls also collapses the quick aircraft bar to free more scope space; Show controls restores it. More controls opens a scrollable Aircraft panel; Close returns to the full workspace. QGH instructor clock and speed controls wrap below the title on phones and narrow browser windows, including windows with visible scrollbars. The aircraft toolbar label also wraps so Start, Pause and Terminate remain within the screen. Tactical QGH aircraft-count buttons wrap below the aircraft heading when space is tight. Surveillance, SRA and PAR student displays require landscape on phones; portrait shows rotation guidance. Gyani can be collapsed with its close button. If an older cached version rejects a current local PIN, finish the exercise, update from Suite home, then create a new session and share its new PIN.",
      "questions": [
        "The scope disappeared on my phone",
        "How do I use landscape?",
        "Buttons are off screen"
      ]
    },
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
      "text": "Choose Guided tour in the page navigation or scope tool rail. It highlights the visible controls one at a time with Back and Next. It never flies aircraft or changes settings. Finish or press Escape to close it. Tours are available on setup, paused exercises and review; pause before consulting help during an exercise. Gyani hides during active exercises. For individual QGH, use it in setup or after terminating into review. QGH also retains its separate radio-practice familiarisation.",
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
      "match": "\\b(?:embeddings?|rag|llm|artificial intelligence|limitations?|learning|trained|smart answers|update (?:the )?guides)\\b",
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
        "quick-stop",
        "quick-heading-form",
        "quick-heading",
        "quick-heading-left",
        "quick-heading-right",
        "quick-more"
      ],
      "anchor": "pilot",
      "match": "\\b(?:turn|turning|steer|heading|left|right)\\b",
      "text": "Single-click an aircraft on the instructor scope to select it and transmit for D/F. A single mouse click waits half a second so a double-click can be recognised. Double-click the left mouse button on the same aircraft to turn left now, or double-click the right mouse button to turn right now; these turns do not send an extra D/F request. On a phone, tap to select and transmit, then use Left now / Right now below the scope. Stop turn levels the wings. For a target heading, enter Heading °T below the scope and choose Turn left or Turn right. More controls opens Aircraft controls for levels, speed and orbit. The student sends instructions; the instructor flies the aircraft.",
      "questions": [
        "How to turn right?",
        "How do mouse clicks work?",
        "Can I type a target heading?",
        "Where is More controls?"
      ]
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
      "text": "Select the aircraft, open Aircraft controls (or More controls), then choose Orbit left or Orbit right. Leave orbit / hold requests an exit after the current lap. Stop turn exits immediately. The exercise must be running for movement."
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
      "text": "Select the aircraft → More controls / Aircraft controls. Enter speed in knots and press Set speed. For altitude, choose feet QNH or Flight level, enter the target, then use Set level, Climb to or Descend to. Climb/descent follows the configured rate. Configure QNH before assigning levels."
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
      "text": "Single-click or tap an aircraft on the instructor scope to select it and transmit for D/F. A single mouse click waits half a second to distinguish a double-click turn. You can also press Transmit below the scope, or T with the scope focused. The bearing ray and homing instrument follow the transmitting aircraft. QDM selects magnetic homing; QTE selects true bearing. More controls → Bearing display sets the released hold from 2–30 seconds; new exercises use 10 seconds. Pilot replies appear in red."
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
      "text": "Open Traffic setup and set 1–24 aircraft. On phones each aircraft has a card with labelled inputs; scroll the page vertically. Jump to aircraft goes straight to a callsign. Reducing the count keeps hidden row edits. Create session applies the visible roster together and starts paused. Use the selected aircraft’s arrows for quick turns; More controls opens the other controls."
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
        "terminate-quick",
        "keep-exercise",
        "exercise-notice"
      ],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:terminate|terminated|termination)\\b|\\b(?:end|finish|stop) (?:the |this |my )?(?:exercise|session)\\b",
      "text": "On the instructor scope, press the red ■ Terminate exercise button and confirm. The green Keep exercise button cancels. Traffic stops and the instructor review opens. The student console shows EXERCISE TERMINATED in a red banner that briefly pulses, then remains visible; an open student drawer closes to reveal it. Reduced-motion settings disable the pulse. Students cannot terminate or reopen the instructor exercise. Reopen exercise restores the same traffic and records paused, and clears the student ending message; Run continues. Use Pause for a temporary stop.",
      "questions": [
        "How do I finish this session?",
        "Where is the red end button?",
        "Will the student see exercise terminated?",
        "Does ending the instructor session show on the student screen?"
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
    },
    {
      "id": "terminate-location",
      "title": "Where to find Terminate",
      "topics": [
        "suite",
        "qgh"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:terminate|terminated|termination)\\b|\\b(?:end|finish|stop) (?:the |this |my )?(?:exercise|session)\\b",
      "text": "Procedural: the instructor’s red ■ Terminate exercise button is in the EXERCISE controls around the scope; it is also in Review. Close any open side panel to see the scope controls. QGH instructor-led / Surveillance / SRA / PAR: create a session, then find TERMINATE beside Start and Pause; it becomes available once the exercise has started. Individual QGH: TERMINATE EXERCISE is in the controller controls. Student displays cannot end the instructor’s exercise. If an old page lacks the new Procedural button, finish or leave the exercise, return to Suite home, choose Update available · reload, then reopen it.",
      "questions": [
        "Where is terminate?",
        "I cannot see the terminate button",
        "How do I end the exercise?"
      ]
    },
    {
      "id": "terminate-instructor",
      "title": "Where to find Terminate",
      "topics": [
        "qgh-instructor",
        "sra",
        "par"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:terminate|terminated|termination)\\b|\\b(?:end|finish|stop) (?:the |this |my )?(?:exercise|session)\\b",
      "text": "After creating an instructor-led session, TERMINATE is beside Start and Pause. It becomes available once the exercise has started and remains available when paused. Terminate ends the shared exercise and opens the instructor review; the student sees Exercise complete. Student displays cannot terminate it. Use Pause for a temporary stop.",
      "questions": [
        "Where is terminate?",
        "I cannot see the terminate button",
        "How do I end the exercise?"
      ]
    },
    {
      "id": "terminate-individual",
      "title": "Where to find Terminate",
      "topics": [
        "qgh-individual"
      ],
      "controls": [],
      "anchor": "current-flow",
      "priority": true,
      "match": "\\b(?:terminate|terminated|termination)\\b|\\b(?:end|finish|stop) (?:the |this |my )?(?:exercise|session)\\b",
      "text": "TERMINATE EXERCISE is in the controller controls after starting Single or Tactical QGH. Press it and confirm to open the recorded flight-path review. Keep exercise cancels the confirmation without ending the flight. Replay and zoom controls sit below the review plot.",
      "questions": [
        "Where is terminate?",
        "I cannot see the terminate button",
        "How do I end the exercise?"
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
      "text": "Drag to pan; Ctrl + scroll zooms. Instructor: single-click or tap an aircraft to select and transmit. Double left/right mouse click turns it left/right now. Student: use transmitted bearings and strips; the full instructor truth is withheld."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#aircraft-quick-controls",
      "title": "Quick aircraft control",
      "text": "Click or tap an aircraft to select and transmit. Left now / Right now start continuous turns; Stop turn levels the wings. Enter Heading °T and choose Turn left / Turn right for an assigned heading. More controls opens Aircraft controls."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#homing",
      "title": "Homing instrument",
      "text": "QDM selects magnetic homing; QTE selects true bearing. On the instructor desk, homing and the red pilot reply share the control shelf below the scope. The student keeps its existing instrument dock. Bearing indications follow the transmitting aircraft."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#aerodrome-form",
      "title": "Preview public base airspace",
      "text": "Select a base to see its sample LFA/CTR layout, real ATS route sections and AIP sources. Load applies the shared sample while paused; Declutter selects the displayed routes."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#chart-form",
      "title": "Set the ARP",
      "text": "Type WGS-84 coordinates or upload the ARP CSV/JSON template. Review the source and date, then save before adding custom geographic points or aligning an image."
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#map-align-form",
      "title": "Align your local layout",
      "text": "Choose a flat image. Mark A at the ARP and B/C at known coordinates. Supply source, date and LFA limits. Check alignment, then Apply and share. C independently checks the scale and orientation."
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
      "text": "On the instructor scope, press the red ■ Terminate exercise button and confirm. The green Keep exercise button cancels. Traffic stops and the instructor review opens. The student console shows EXERCISE TERMINATED in a red banner that briefly pulses, then remains visible; an open student drawer closes to reveal it. Reduced-motion settings disable the pulse. Students cannot terminate or reopen the instructor exercise. Reopen exercise restores the same traffic and records paused, and clears the student ending message; Run continues. Use Pause for a temporary stop."
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
