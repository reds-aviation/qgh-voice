// Shared release knowledge: the common guide, Gyani and screen tours. Maintain with each UI change.
(function(root){ const knowledge = {
  "revision": "2026.10.03.2",
  "learning": "I am also learning. If I’m unable to answer, please refer to the training guide.",
  "flow": [
    {
      "title": "Procedural",
      "href": "procedural-beta/",
      "text": "Instructor setup → prepare airspace → create → Traffic setup → Session → Admit → Ready → Run → Terminate → Review."
    },
    {
      "title": "QGH & SRA · Single QGH",
      "href": "qgh.html",
      "text": "Single aircraft or Tactical → configure QGH cloud-breaking → Start → control and transmit → Terminate → Review."
    },
    {
      "title": "QGH & SRA · Instructor QGH + SRA",
      "href": "instructor-led/",
      "text": "Choose QGH, SRE/vectoring or SRA → create → Session → Admit → Ready → Start → Terminate → Review."
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
      "text": "After saving ARP, choose a flat PNG/JPEG up to 5 MB, 4096 pixels per side and 16 megapixels. Enter source, edition and layout notes. Mark A at ARP and B/C at known points, enter coordinates and spread them across the chart. Check alignment → Apply and share. C checks scale and orientation. Aligning an image does not create editable polygons; enter or draw boundaries separately.",
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
      "text": "Edit airspace → set the Aerodrome Reference Point in WGS-84 latitude/longitude (decimal degrees or DMS), or upload the ARP CSV/JSON template. Save the origin before adding geographic polygons or aligning an image. Changing ARP keeps existing local positions; it does not reproject them. Check and rebuild geometry against the new origin.",
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
      "text": "Edit airspace lets you choose a published base or enter a custom ARP and polygon coordinates. Preview a base, then select only the ATS routes and areas needed for the exercise. The instructor selection is reflected on the student picture. Public AIP samples carry source/edition information and are dated training snapshots, not live NOTAM activation. Multiple LFA, prohibited, restricted and danger polygons can be entered.",
      "questions": [
        "Where are sample LFAs?",
        "Are these real ATS routes?",
        "How do I draw an LFA polygon?",
        "Can I select only one ATS route?"
      ]
    },
    {
      "id": "instructor-instrument-shelf",
      "title": "Instructor homing and pilot messages below the scope",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
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
      "text": "The scope takes the main exercise area. Quick aircraft controls, homing and compact red pilot captions sit below it. More controls opens aircraft actions. Collapse exercise options above the scope when flying; they minimise when Start/Run begins. Declutter selects shared chart items. Pan, range, labels and local picture tools change only your own scope.",
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
        "suite",
        "qgh",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [],
      "anchor": "session",
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
        "sra"
      ],
      "controls": [],
      "anchor": "scope",
      "priority": true,
      "match": "\\b(?:small screen|landscape|screen clipped|buttons off screen|scope disappeared|radar too small|scroll (?:the )?workspace)\\b",
      "text": "Select an aircraft and use the arrows and Stop turn below the scope. More controls opens the full scrollable aircraft panel; Close returns to the scope. Collapse exercise options above the scope to gain space; they minimise when Start/Run begins. Scroll vertically when controls are below the display and swipe long tool rows sideways. Use landscape for SRE/SRA controller displays. Gyani stays tucked away during running traffic.",
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
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [],
      "anchor": "session",
      "priority": true,
      "match": "\\b(?:reconnect|disconnected|lost link|stale|network error|connection lost|internet.*lost)\\b",
      "text": "Keep the instructor window open. Lost connectivity pauses the exercise; restore internet and reconnect the student before resuming. QGH/SRE/SRA can restore the same instructor tab paused after refresh, retaining its PIN, student seat and review; let the student reconnect before Resume. In Procedural, keep the instructor tab open and use the offered reconnect flow. Save reusable exercise setups before beginning. Reloaded pilot audio starts muted.",
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
        "procedural"
      ],
      "controls": [],
      "anchor": "connection",
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
        "procedural"
      ],
      "controls": [],
      "anchor": "connection",
      "priority": true,
      "match": "\\b(?:online|internet|supabase|different (?:devices|systems|pcs|computers)|same (?:pc|browser)|offline capability|connection mode|another (?:pc|computer|device))\\b",
      "text": "This device / offline: use the SAME PC, SAME browser profile and exact same site address, with instructor and student in separate windows. Online room: use DIFFERENT PCs/devices, with internet on both. Choose the same connection mode and PIN, then Admit → Ready → Start/Run. QGH instructor-led, SRE/vectoring, SRA and Procedural support both choices. Keep the instructor window open. Separate PCs without internet cannot share a live exercise in this release.",
      "questions": [
        "Can my instructor use another laptop?",
        "Can we train without WiFi?",
        "Can two computers connect without internet?",
        "Is Supabase used for QGH and SRA?"
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
        "procedural"
      ],
      "controls": [],
      "anchor": "tour",
      "priority": true,
      "match": "\\b(?:guided tour|screen tour|walkthrough|walk through|show me around|where are the controls)\\b",
      "text": "A brief, skippable introduction opens on first use when the workspace is ready, before traffic runs; Individual QGH shows it during setup. Next highlights the essential controls; Skip tour or Escape closes it. You can reopen Guided tour before Start, while paused or during review. Run closes all tour overlays without pausing or changing the exercise. The first instructor Start may show a short mouse-control reminder inside the controls shelf. Phone users use the aircraft arrows and Stop turn.",
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
        "procedural"
      ],
      "controls": [],
      "anchor": "help",
      "priority": true,
      "match": "\\b(?:embeddings?|rag|llm|artificial intelligence|limitations?|learning|trained|smart answers|update (?:the )?guides)\\b",
      "text": "Gyani searches the same versioned knowledge as the common training guide and screen tour, using keywords, spelling tolerance and a small local vector index. It does not inspect live traffic or invent operational clearances. Every feature change must update this shared knowledge before release. I am also learning. If I’m unable to answer, please refer to the training guide.",
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
      "anchor": "aircraft",
      "match": "\\b(?:turn|turning|steer|heading|left|right)\\b",
      "text": "Single-click or tap an aircraft to select and transmit for D/F; a mouse click waits briefly to recognise a double-click. Double-left-click turns left now, double-right-click turns right now. Middle mouse click stops the turn. On phones use Left now / Right now / Stop turn below the scope. Enter Heading °T and choose Turn left or Turn right for a target heading. More controls opens speed, level and orbit controls.",
      "questions": [
        "How to turn right?",
        "How do mouse clicks work?",
        "Can I type a target heading?",
        "Where is More controls?",
        "How does centre mouse click work?"
      ],
      "intro": "Click an aircraft to select and transmit. Double-left/right clicks turn; middle-click stops. On a phone, select it and use the arrows and Stop turn. Target headings use °T."
    },
    {
      "id": "stop-turn",
      "title": "Stop a turn",
      "topics": [
        "procedural"
      ],
      "controls": [],
      "anchor": "aircraft",
      "match": "\\b(?:stop|end|cancel|level)\\b.*\\b(?:turn|turning|wings|orbit)\\b|\\bwings level\\b",
      "text": "Middle-click the aircraft on the instructor scope, or select it and press Stop turn. The aircraft levels its wings at its current heading and exits an orbit immediately. Leave orbit / hold instead requests an exit after the current lap.",
      "questions": []
    },
    {
      "id": "orbit",
      "title": "Orbit and leave an orbit",
      "topics": [
        "procedural"
      ],
      "controls": [],
      "anchor": "aircraft",
      "match": "\\borbit|circle|circling\\b",
      "text": "Select the aircraft, open Aircraft controls (or More controls), then choose Orbit left or Orbit right. Leave orbit / hold requests an exit after the current lap. Stop turn exits immediately. The exercise must be running for movement.",
      "questions": []
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
      "anchor": "aircraft",
      "match": "\\b(?:speed|altitude|climb|descend|descent|flight level|height|level)\\b",
      "text": "Select the aircraft → More controls / Aircraft controls. Enter speed in knots and press Set speed. For altitude, choose feet QNH or Flight level, enter the target, then use Set level, Climb to or Descend to. Climb/descent follows the configured rate. Configure QNH before assigning levels.",
      "questions": []
    },
    {
      "id": "transmit",
      "title": "Transmit and read the bearing",
      "topics": [
        "procedural"
      ],
      "controls": [
        "quick-transmit",
        "bearing-type",
        "transmit-form"
      ],
      "anchor": "pilot",
      "match": "\\b(?:transmit|transmission|talk|pilot readback|readbacks?|qdm|qte|homing|bearing|df)\\b",
      "text": "Click/tap an aircraft or use quick Transmit for D/F. In Pilot transmission, type a message and choose Transmit custom message to send your own pilot caption. The bearing ray and homing display follow the transmitting aircraft. QDM is magnetic homing; QTE is true bearing. More controls → Bearing display sets the released hold from 2–30 seconds; new exercises use 10 seconds. Pilot captions appear in red.",
      "questions": [
        "Does clicking an aircraft transmit?",
        "How do I send a custom message?",
        "What does QDM mean?"
      ],
      "intro": "Pilot captions and homing sit beside the aircraft controls. Click or Transmit obtains D/F; Pilot transmission also accepts your custom message. Student scope receives bearings, not instructor truth."
    },
    {
      "id": "sweep",
      "title": "Radar scan and RPM",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [
        "trail-count"
      ],
      "anchor": "scope",
      "match": "\\b(?:radar sweep|sweep|scanning|rpm|revolutions?|rotation|scan speed)\\b",
      "text": "The radar scan is fixed at 15 RPM: one revolution every 4 real seconds. It pauses with the exercise. Choose trail length in scope options; range-aware spacing keeps movement visible. Instructor truth remains continuous; SRE/SRA controller returns update on beam crossing. A visual sweep does not reveal hidden aircraft on the Procedural student screen.",
      "questions": [
        "How do I set radar RPM?",
        "The trail is not visible",
        "How many history dots?"
      ],
      "intro": "SRE/SRA returns update on the 15 RPM radar scan. Use your own range and pan controls. The instructor picture and student observations are different views."
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
      "text": "Initial traffic is optional and collapsed during setup; expand it when you need to prepare an exact starting roster. You can also open Traffic at the desk. Set 1–20 aircraft with independent callsign, position, heading, level, speed and performance. Phone cards scroll vertically; Jump to aircraft selects a callsign. Create session applies the visible roster. Save the prepared setup before Run for a repeatable assessment.",
      "questions": []
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
      "anchor": "exercise",
      "match": "\\b(?:run|pause|resume|start|nothing moves|not moving|stopped)\\b",
      "text": "Run starts or resumes the same exercise after any admitted controller is Ready. Pause freezes traffic, clock and radar sweep. +1 min advances one minute. Exercise options minimise when Run starts; reopen the options dropdown when needed. Terminate finishes the exercise for review; Reopen restores it paused.",
      "questions": [],
      "intro": "Admit the controller and wait for Ready, then Run. Pause freezes the clock and traffic. Exercise options minimise at Run; the red Terminate button finishes the attempt."
    },
    {
      "id": "session-isolation",
      "title": "Separate exercises and student PINs",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [],
      "anchor": "session",
      "match": "\\b(?:multiple|many users|same time|different users|separate|another device|another phone|remote|load balanc|independent)\\b",
      "text": "Each instructor room has its own exercise, PIN, aircraft and clock. A student joins only that room and must be admitted. This device / offline is limited to one PC and the same browser profile; two extended screens are recommended. Online room connects different devices with internet on both. The instructor tab must stay open; lost connectivity pauses traffic. Only the student projection is shared.",
      "questions": []
    },
    {
      "id": "qgh-turn",
      "title": "Turn controls in QGH",
      "topics": [
        "qgh",
        "qgh-individual"
      ],
      "controls": [],
      "anchor": "individual",
      "match": "\\b(?:turn|turning|left|right|heading|steer|stop turn)\\b",
      "text": "Normal QGH: enter the target heading and choose Turn left or Turn right. U/S Compass: use Turn left now / Turn right now and Stop turn now for a timed turn. In Tactical select the intended aircraft first. Individual practice uses its manual controller controls.",
      "questions": []
    },
    {
      "id": "instructor-turn",
      "title": "Instructor-led turn controls",
      "topics": [
        "qgh-instructor",
        "sra"
      ],
      "controls": [],
      "anchor": "aircraft",
      "match": "\\b(?:turn|turning|left|right|heading|steer|stop turn)\\b",
      "text": "Single-click an aircraft to select it and transmit: QGH gives D/F; SRE/SRA gives a pilot position report. Double-left/right mouse clicks turn left/right now; middle-click stops. On phones use the arrows and Stop turn. Type a magnetic target in Heading °M for a directed turn; U/S Compass uses timed Left now / Right now and Stop. More controls opens the other aircraft actions. The student gives instructions; the instructor flies.",
      "questions": [
        "How to turn right?",
        "Can I type a heading?",
        "Does clicking transmit?",
        "Centre mouse click stops turn?"
      ],
      "intro": "Click an aircraft to select and transmit. Double-left/right clicks turn; middle-click stops. On a phone, use the arrows and Stop turn. Target headings use °M; More controls opens speed and level."
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
      "anchor": "review",
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
        "suite",
        "qgh",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [
        "traffic-review"
      ],
      "anchor": "review",
      "priority": true,
      "match": "\\b(?:replay|review|debrief|timeline|separation cue|zoom.*(?:bar|toolbar)|toolbar.*(?:cover|plot))\\b",
      "text": "Terminate before review. Individual QGH replays the recorded flight path, with controls below the plot. Procedural Review offers animated Top, Side · altitude and 3D schematic views at the same replay time. Choose Aircraft to highlight one track and filter its events; select a timeline marker or a Commands & events item to seek to that recorded time. Cues show measured spacing against the configured threshold, the sampled cue interval and duration, plus the supplied source, applicability, evidence and instructor assessment. Red marks a configured threshold warning; amber asks for instructor assessment, and a satisfied measurement stays neutral. These are configured training cues, not a complete Doc 4444 decision; no cue at a sample does not establish safe separation. The instructor checks authorised minima and prerequisites. The 3D view exaggerates altitude, and replay never alters the completed exercise.",
      "questions": [
        "The replay buttons cover my track",
        "How do I watch my flight again?",
        "How do I seek to a command in review?",
        "What do the separation cues mean?"
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
      "anchor": "review",
      "priority": true,
      "match": "\\b(?:terminate|terminated|termination)\\b|\\b(?:end|finish|stop) (?:the |this |my )?(?:exercise|session)\\b",
      "text": "Procedural and Instructor QGH + SRA have a red Terminate exercise control at the instructor workspace. Individual QGH has TERMINATE EXERCISE in controller controls. Confirming ends traffic and opens review. The student cannot terminate an instructor exercise.",
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
        "sra"
      ],
      "controls": [],
      "anchor": "review",
      "priority": true,
      "match": "\\b(?:terminate|terminated|termination)\\b|\\b(?:end|finish|stop) (?:the |this |my )?(?:exercise|session)\\b",
      "text": "After creating an instructor-led session, TERMINATE is beside Start and Pause. It becomes available once the exercise has started and remains available when paused. Terminate ends the shared exercise and opens the instructor review; the student sees Exercise complete. Student displays cannot terminate it. Use Pause for a temporary stop.",
      "questions": [
        "Where is terminate?",
        "I cannot see the terminate button",
        "How do I end the exercise?"
      ],
      "intro": "Admit the controller and wait for Ready, then Start. Pause freezes traffic. The red Terminate button ends the attempt for both positions and opens review."
    },
    {
      "id": "terminate-individual",
      "title": "Where to find Terminate",
      "topics": [
        "qgh-individual"
      ],
      "controls": [],
      "anchor": "review",
      "priority": true,
      "match": "\\b(?:terminate|terminated|termination)\\b|\\b(?:end|finish|stop) (?:the |this |my )?(?:exercise|session)\\b",
      "text": "TERMINATE EXERCISE is in the controller controls after starting Single or Tactical QGH. Press it and confirm to open the recorded flight-path review. Keep exercise cancels the confirmation without ending the flight. Replay and zoom controls sit below the review plot.",
      "questions": [
        "Where is terminate?",
        "I cannot see the terminate button",
        "How do I end the exercise?"
      ]
    },
    {
      "id": "suite-choice",
      "title": "Choose an exercise",
      "topics": [
        "suite",
        "qgh",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "anchor": "start",
      "match": "\\b(?:which (?:simulator|exercise|mode)|choose (?:a |the )?simulator|what is (?:qgh|sra|sre|procedural)|atss)\\b",
      "text": "Procedural trains Aerodrome, Approach and Area control in one exercise. QGH & SRA has Single QGH (single-aircraft or Tactical individual practice) and Instructor QGH + SRA (QGH cloud-breaking, SRE/vectoring and Surveillance Radar Approach).",
      "questions": [
        "Which simulator should I choose?",
        "What is QGH?",
        "Where is vectoring?"
      ],
      "priority": true,
      "controls": []
    },
    {
      "id": "session",
      "title": "Create, admit and start",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "anchor": "session",
      "match": "\\b(?:join|admit|admission|ready|six digit|6 digit|session pin|share.*pin|find.*pin|where.*pin)\\b",
      "text": "Create the instructor exercise, then open Session. Share its six-digit PIN. The controller opens Student position, selects the matching connection mode, enters name and PIN and requests admission. Instructor: Admit. Student: Ready. Instructor: Start/Run. This device needs the same PC and browser profile in separate windows. Online room connects different devices with internet on both. Keep both positions open.",
      "questions": [
        "How do I join?",
        "Where is my PIN?",
        "What does Ready do?"
      ],
      "priority": true,
      "controls": []
    },
    {
      "id": "procedural-start",
      "title": "Start Procedural",
      "topics": [
        "procedural"
      ],
      "anchor": "procedural",
      "match": "\\b(?:start|begin|create|set up|setup|configure|first exercise|what next)\\b",
      "text": "Open Instructor setup. Choose connection, title and airspace. Initial traffic is optional and collapsed; expand it for exact starting aircraft, or edit Traffic later at the desk. Create session opens the scope paused. Session admits the controller, then Run after Ready. Save the starting setup before Run to reuse it later.",
      "questions": [
        "How do I start?",
        "Where is the aircraft roster?",
        "How do I set up Procedural?"
      ],
      "priority": false,
      "controls": []
    },
    {
      "id": "instructor-start",
      "title": "Start Instructor QGH + SRA",
      "topics": [
        "qgh-instructor",
        "sra"
      ],
      "anchor": "instructor",
      "match": "\\b(?:start|begin|create|set up|setup|configure|first exercise|what next|sre|vectoring)\\b",
      "text": "Choose QGH, SRE/vectoring or SRA. QGH is the cloud-breaking procedure with Normal or U/S Compass. New QGH sessions allow up to 2 aircraft; SRE/vectoring and SRA allow up to 24. Prepare traffic and pressure/approach references, create the session, admit the controller and start after Ready. The scope, compact aircraft controls and collapsible exercise options follow the Procedural workspace.",
      "questions": [
        "How do I start SRA?",
        "How do I start instructor QGH?",
        "How do I practise vectoring?"
      ],
      "priority": false,
      "controls": []
    },
    {
      "id": "individual-start",
      "title": "Start Single or Tactical QGH",
      "topics": [
        "qgh",
        "qgh-individual"
      ],
      "anchor": "individual",
      "match": "\\b(?:start|begin|set up|setup|configure|first exercise|what next)\\b",
      "text": "Open Single QGH, then choose Single aircraft or Tactical. Check runway, inbound/outbound tracks, Normal or U/S Compass, initial range, performance and level settings. Start opens the controller console. In Tactical select the intended aircraft before commanding it. The Training Centre holds the accepted radio-call catalogue.",
      "questions": [
        "How do I start individual QGH?",
        "How do I start Tactical?"
      ],
      "priority": false,
      "controls": [],
      "intro": "Check runway, procedure tracks, Normal or U/S Compass and aircraft settings. Start begins the clock. Use the controller controls, then Terminate to review your track."
    },
    {
      "id": "approach-reference",
      "title": "SRA distance and 3° reference",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "anchor": "approach",
      "match": "\\b(?:3 degree|three degree|glide|threshold|sra distances|half mile|0 5 nm|descent (?:guide|altitudes?|profile))\\b",
      "text": "SRA final marks include 0.5 NM spacing within the last 5 NM. The 3° reference is altitude MSL = field elevation + threshold crossing height + distance NM × 6076.12 × tan(3°), rounded to 10 ft. Set elevation and crossing height before the exercise. Distance is from the runway threshold in the documented approach geometry. The instructor must command descent and assess the procedure.",
      "questions": [
        "Where are half-mile marks?",
        "What is the 3 degree descent altitude?",
        "Does the aircraft follow the glidepath?"
      ],
      "priority": false,
      "controls": []
    },
    {
      "id": "pressure",
      "title": "QNH, transition altitude and level",
      "topics": [
        "suite",
        "qgh",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "anchor": "approach",
      "match": "\\b(?:qnh|transition altitude|transition level|ta|tl)\\b",
      "text": "Set QNH, transition altitude (TA), transition level (TL), field elevation and threshold crossing height before starting. Both desks receive the briefing references; zero TA/TL means unset. Procedural retains its documented QNH/Standard training conversion. Instructor QGH/SRE/SRA levels are modelled in ft MSL; pressure references do not calculate local minima or trigger automatic pressure changes.",
      "questions": [
        "How do I set QNH?",
        "What are TA and TL?"
      ],
      "priority": false,
      "controls": []
    },
    {
      "id": "individual-voice",
      "title": "Individual radio practice",
      "topics": [
        "qgh",
        "qgh-individual"
      ],
      "anchor": "individual",
      "match": "\\b(?:voice|audio|microphone|ptt|radio|accepted call|command)\\b",
      "text": "Individual QGH provides manual controls and its own voice setup. Check installed pilot voice and microphone before enabling audible replies. The Training Centre contains the searchable accepted-call catalogue, prerequisites and simulator effects. Pilot captions remain the readable record. Instructor-led and Procedural use instructor-operated controls rather than microphone recognition.",
      "questions": [
        "Which radio calls work?",
        "How do I enable voice?",
        "What is PTT?"
      ],
      "priority": false,
      "controls": []
    },
    {
      "id": "instructor-transmit",
      "title": "Instructor pilot transmission and D/F",
      "topics": [
        "qgh-instructor",
        "sra"
      ],
      "anchor": "pilot",
      "match": "\\b(?:transmit|transmission|talk|pilot readback|readback|bearing|homing|qdm|qte|df)\\b",
      "text": "Click the aircraft or choose Transmit. QGH gives a pilot transmission with D/F; SRE/SRA sends the pilot position report. Homing and red pilot captions sit below the scope. QDM is magnetic homing and QTE is true bearing; QGH retains the last indication briefly after release. The controller’s SRE/SRA plots remain sensor observations.",
      "questions": [
        "Does clicking an aircraft transmit?",
        "What does QDM mean?",
        "Where are pilot messages?"
      ],
      "controls": [],
      "priority": false,
      "intro": "Pilot captions and homing sit below the scope. Click or Transmit gives QGH D/F, or a position report in SRE/SRA. The student sees the appropriate bearing or radar observation."
    },
    {
      "id": "instructor-speed-level",
      "title": "Instructor speed and level",
      "topics": [
        "qgh-instructor",
        "sra"
      ],
      "anchor": "aircraft",
      "match": "\\b(?:speed|altitude|climb|descend|descent|flight level|height|level)\\b",
      "text": "Select the aircraft → More controls. Set speed or target level and command climb/descent. This instructor beta models levels in feet MSL; QNH, TA and TL are shared briefing references. The SRA 3° profile is a guide; the instructor commands descent.",
      "questions": [
        "How do I change altitude?",
        "How do I set speed?"
      ],
      "controls": [],
      "priority": false
    },
    {
      "id": "scope-tools",
      "title": "Pan, range and collapsed options",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "anchor": "scope",
      "match": "\\b(?:pan|zoom|range rings|scope controls|scope layers|local picture|bearing range ruler|ruler|options dropdown|top controls)\\b",
      "text": "Drag the scope background to pan. Use range controls or Ctrl + scroll to zoom and Centre/Home to return to the origin. Procedural Options hides navigation, range tools and aircraft tabs; Start/Run closes them automatically. Instructor QGH/SRE/SRA Scope settings groups range, centre and trail controls and closes at Start with navigation, Session, Clock, aircraft and event drawers. Its summary stays accessible. Pause/Resume/Terminate remains visible while the scope scrolls. Range and pan are local view changes.",
      "questions": [
        "How do I pan the scope?",
        "How do I minimise the top controls?"
      ],
      "controls": [
        "workspace-options-toggle"
      ],
      "priority": false
    },
    {
      "id": "custom-polygons",
      "title": "Custom ARP and point-by-point boundaries",
      "topics": [
        "suite",
        "procedural"
      ],
      "anchor": "airspace",
      "match": "\\b(?:polygon|draw|drawing|boundary|boundaries|point to point|custom airspace|custom lfa|coordinates)\\b",
      "text": "Pause → Edit airspace → Custom airspace. Enter ARP latitude/longitude and Save ARP. Add a boundary name, type (LFA/P/R/D/CTR), vertical limits and coordinate points, or click/tap points on the canvas. Edit loads an existing ring; drag a vertex or choose Selected vertex → Delete selected vertex. Draw / edit on radar scope allows the same changes; Enter closes the ring, Delete/Backspace removes the selected vertex and Escape cancels drawing. Only Save boundary shares the edited polygon to the student; a crossed ring is rejected. Remove deletes a whole area. Select only needed published routes and areas before loading a base.",
      "questions": [
        "How do I draw an LFA polygon?",
        "Can I drag boundary points?",
        "How do I delete a polygon vertex?",
        "Where do I enter prohibited area coordinates?"
      ],
      "controls": [
        "airspace-preparation",
        "custom-arp-form",
        "custom-boundary-form",
        "boundary-sketch",
        "boundary-sketch-canvas",
        "custom-boundary-list",
        "aerodrome-selection",
        "boundary-scope-edit",
        "boundary-vertex-select",
        "boundary-vertex-delete",
        "boundary-scope-delete"
      ],
      "priority": true
    },
    {
      "id": "saved-exercises",
      "title": "Save and reuse the same starting exercise",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "anchor": "traffic",
      "match": "\\b(?:save|saved|reuse|re use|preset|preload|pre loaded|template|same (?:exercise|setup|set up)|import|export|library|(?:duplicate|rename) (?:selected|(?:(?:a|the|my) )?(?:exercise|setup|template|preset)))\\b",
      "text": "Prepare the starting setup before Run. Procedural: Saved exercises → name → Save starting setup; replacing the same name asks for confirmation. Save as new needs a new name. Duplicate selected copies the stored setup; Rename selected keeps its traffic and chart selections. Use selected exercise restores original traffic paused at 00:00. Export selected saves a JSON backup; Import exercise file adds a transferred setup. New Procedural saves/imports allow up to 20 aircraft; older device templates retain their traffic. Instructor QGH/SRE/SRA: Save as new creates a uniquely named setup; Update selected replaces the chosen record from the current form. Duplicate copies the stored original; Rename changes only its name. Load selected restores the stored setup; Export selected exports that original. Import creates an independent entry with a unique name. Remove deletes the local record after confirmation. Legacy QGH setups above 2 aircraft cannot Load/Import; the original remains stored and exportable, with no silent truncation. Restart after review retries the initial roster. Libraries belong to this browser/device; new live sessions have independent PINs/admissions and saved setups contain no room tokens.",
      "questions": [
        "How do I reuse an exercise?",
        "Can I test two students on the same setup?",
        "How do I export a saved exercise?",
        "Can I duplicate or rename a saved exercise?"
      ],
      "controls": [
        "scenario-library",
        "template-name",
        "template-select",
        "template-save",
        "template-load",
        "template-download",
        "template-import",
        "template-save-as",
        "template-duplicate",
        "template-rename"
      ],
      "priority": true
    },
    {
      "id": "student-estimates",
      "title": "Student estimate dots",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "anchor": "scope",
      "match": "\\b(?:estimate|estimated|plotting|manual plot|add (?:a |an )?(?:dot|blip|point)|drag (?:a |the )?dot|dot label|place by coordinates|dot without dragging)\\b",
      "text": "Student position → Your estimate dots. Type a callsign, choose + Add estimate and click/tap the scope to place it. Drag the dot with mouse or touch to update your estimate. For keyboard entry, open Place by coordinates, enter East/west and North/south NM from the scope origin (negative = west/south), then press Enter or Place estimate / Move selected. Choose a dot in the selector to Rename or Delete it; Clear dots removes all after confirmation. Violet dashed dots labelled EST are your own position estimates, not aircraft truth or radar returns. Up to 24 dots stay local to this exercise, student and browser/device; other users and the instructor do not receive them. Shared airspace changes still appear on your scope.",
      "questions": [
        "How do I add a student estimate dot?",
        "Can I drag and rename a dot?",
        "Are estimate dots real aircraft positions?",
        "Can I move a dot without dragging?"
      ],
      "controls": [
        "student-plotting",
        "estimate-callsign",
        "estimate-add",
        "estimate-select",
        "estimate-rename",
        "estimate-delete",
        "estimate-clear",
        "estimate-coordinate-entry",
        "estimate-east",
        "estimate-north",
        "estimate-coordinate-move"
      ],
      "priority": true,
      "intro": "EST dots are your own position estimates. Add a callsign, place a dot and drag it, or use Place by coordinates. These dots stay local and do not move the instructor aircraft."
    },
    {
      "id": "suite-turn",
      "title": "Instructor mouse turns and heading references",
      "topics": [
        "suite"
      ],
      "anchor": "aircraft",
      "match": "\\b(?:turn|turning|heading|left|right|mouse click|middle click|centre click)\\b",
      "text": "Instructor scopes: single-click selects the aircraft and transmits, double-left/right starts the corresponding turn, middle-click stops it. On phones select the aircraft and use the turn arrows and Stop turn. Procedural target headings use °T; Instructor QGH/SRE/SRA target headings use °M. Individual QGH uses its manual Normal/U/S Compass controls. More controls opens the other aircraft actions.",
      "questions": [
        "How to turn right?",
        "How do I stop a turn with the mouse?"
      ],
      "controls": [],
      "priority": false
    },
    {
      "id": "aircraft-limits",
      "title": "Aircraft limits by exercise",
      "topics": [
        "suite",
        "qgh",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [],
      "anchor": "traffic",
      "priority": true,
      "match": "\\b(?:how many aircraft|maximum aircraft|aircraft limit|traffic limit|max aircraft|20 aircraft|2 aircraft|24 aircraft)\\b",
      "text": "New Procedural exercises support up to 20 aircraft. New instructor-led QGH sessions allow up to 2 aircraft. SRE/vectoring and SRA retain up to 24 aircraft. Single QGH uses one aircraft; Tactical keeps its existing setup controls. Older stored exercises retain their original traffic for replay and export.",
      "questions": [
        "How many aircraft can I create?",
        "What is the QGH aircraft limit?",
        "Can Procedural use 20 aircraft?"
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
      "entry": "connections"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#instructor-login",
      "title": "Prepare exercise",
      "entry": "procedural-start"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#student-join",
      "title": "Controller admission",
      "entry": "session"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#traffic-setup",
      "title": "Traffic and session",
      "entry": "roster-mobile"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#scope",
      "title": "Scope picture",
      "entry": "turn"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#aircraft-quick-controls",
      "title": "Quick aircraft control",
      "entry": "turn"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#homing",
      "title": "Homing instrument",
      "entry": "transmit"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#aerodrome-form",
      "title": "Preview public base airspace",
      "entry": "public-lfa-samples"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#chart-form",
      "title": "Set the ARP",
      "entry": "arp-upload"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#map-align-form",
      "title": "Align your local layout",
      "entry": "lfa-image-alignment"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#edge-actions",
      "title": "Choose your tools",
      "entry": "instructor-instrument-shelf"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#terminate-quick",
      "title": "Pause or finish",
      "entry": "terminate-exercise"
    },
    {
      "pages": [
        "instructor",
        "student"
      ],
      "selector": "#exerciseConnection",
      "title": "Offline or online",
      "entry": "connections"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#exerciseFamily",
      "title": "QGH, SRE/vectoring or SRA",
      "entry": "instructor-start"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#aircraftRoster",
      "title": "Build your traffic",
      "entry": "instructor-start"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#createSession",
      "title": "Create the room",
      "entry": "session"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#sessionPin",
      "title": "Connect the controller",
      "entry": "session"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#aircraftRosterTabs",
      "title": "Select before commanding",
      "entry": "instructor-turn"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#keyboardCommandInput",
      "title": "Aircraft commands",
      "entry": "instructor-turn"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": ".lifecycle-actions",
      "title": "Run, pause and finish",
      "entry": "terminate-instructor"
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#joinPin",
      "title": "Request admission",
      "entry": "session"
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#studentReady",
      "title": "Signal Ready",
      "entry": "session"
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#qghStudentView",
      "title": "QGH bearings",
      "entry": "transmit"
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#radarStudentView",
      "title": "Surveillance and SRA",
      "entry": "sweep"
    },
    {
      "pages": [
        "single"
      ],
      "selector": "#setup",
      "title": "Set up QGH",
      "entry": "individual-start"
    },
    {
      "pages": [
        "tactical"
      ],
      "selector": "#tSetup",
      "title": "Set up Tactical QGH",
      "entry": "individual-start"
    },
    {
      "pages": [
        "single",
        "tactical"
      ],
      "selector": ".review-toolbar, .tactical-review-toolbar",
      "title": "Review your exercise",
      "entry": "review-controls"
    },
    {
      "pages": [
        "single"
      ],
      "selector": "#runway",
      "title": "Runway and procedure tracks",
      "entry": "individual-start"
    },
    {
      "pages": [
        "single"
      ],
      "selector": "#normal",
      "title": "Normal or U/S Compass",
      "entry": "qgh-turn"
    },
    {
      "pages": [
        "single"
      ],
      "selector": "#startExercise",
      "title": "Run, transmit, then review",
      "entry": "individual-start"
    },
    {
      "pages": [
        "tactical"
      ],
      "selector": "#tRunway",
      "title": "Runway and procedure tracks",
      "entry": "individual-start"
    },
    {
      "pages": [
        "tactical"
      ],
      "selector": "#tProcedureNormal",
      "title": "Normal or U/S Compass",
      "entry": "qgh-turn"
    },
    {
      "pages": [
        "tactical"
      ],
      "selector": "#tStart",
      "title": "Run, transmit, then review",
      "entry": "individual-start"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#airspace-preparation",
      "title": "Custom airspace",
      "entry": "custom-polygons"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#scenario-library",
      "title": "Save a reusable exercise",
      "entry": "saved-exercises"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#workspace-options-toggle",
      "title": "Collapse exercise options",
      "entry": "scope-tools"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#savedExercise",
      "title": "Reuse a starting exercise",
      "entry": "saved-exercises"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#instructorHoming",
      "title": "Pilot transmission and D/F",
      "entry": "instructor-transmit"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#truthTrailCount",
      "title": "Range-aware history trail",
      "entry": "sweep"
    },
    {
      "pages": [
        "procedural",
        "student"
      ],
      "selector": "#student-plotting",
      "title": "Plot your position estimates",
      "entry": "student-estimates"
    }
  ],
  "startHint": {
    "title": "Aircraft mouse controls",
    "text": "Click: select + D/F · Double-left: turn left · Double-right: turn right · Middle: stop turn. Phone: select, then use the turn arrows and Stop turn."
  },
  "firstUse": [
    {
      "pages": [
        "procedural"
      ],
      "selector": "#scope",
      "title": "Select and turn",
      "entry": "turn"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#homing",
      "title": "Pilot and homing",
      "entry": "transmit"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#clock-controls",
      "title": "Ready, then Run",
      "entry": "run-pause"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#instructorScope",
      "title": "Select and turn",
      "entry": "instructor-turn"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#instructorHoming",
      "title": "Pilot and homing",
      "entry": "instructor-transmit"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": ".lifecycle-actions",
      "title": "Ready, then Start",
      "entry": "terminate-instructor"
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#qghStudentView",
      "title": "Read the bearing",
      "entry": "instructor-transmit"
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#radarStudentView",
      "title": "Your radar observations",
      "entry": "sweep"
    },
    {
      "pages": [
        "student"
      ],
      "selector": "#student-estimate-panel",
      "title": "Plot your own estimates",
      "entry": "student-estimates"
    },
    {
      "pages": [
        "single"
      ],
      "selector": "#setup",
      "title": "Prepare Single QGH",
      "entry": "individual-start"
    },
    {
      "pages": [
        "tactical"
      ],
      "selector": "#tSetup",
      "title": "Prepare Tactical QGH",
      "entry": "individual-start"
    }
  ]
};
for(const step of knowledge.tours) if(step.entry) step.text=knowledge.entries.find(entry=>entry.id===step.entry)?.text||"";
for(const step of knowledge.firstUse) if(step.entry){const entry=knowledge.entries.find(entry=>entry.id===step.entry);step.text=entry?.intro||entry?.text||"";}
if(typeof module === "object" && module.exports) module.exports=knowledge; else root.ATCGuideKnowledge=knowledge;
})(typeof globalThis==="object"?globalThis:this);
