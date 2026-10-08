// Shared release knowledge: the common guide, Gyani and screen tours. Maintain with each UI change.
(function(root){ const knowledge = {
  "revision": "1.0.0",
  "learning": "I am also learning. If I’m unable to answer, please refer to the training guide.",
  "flow": [
    {
      "title": "Procedural",
      "href": "procedural-beta/",
      "text": "Choose connection → Instructor setup → prepare airspace and traffic → create → Session → Admit → Ready → online Meet/audio check → Run → Terminate → Review."
    },
    {
      "title": "QGH & SRA · Single QGH",
      "href": "qgh.html",
      "text": "Single aircraft or Tactical → configure QGH cloud-breaking → Start → control and transmit → Terminate → Review."
    },
    {
      "title": "QGH & SRA · Instructor QGH + SRA",
      "href": "instructor-led/",
      "text": "Choose connection → Instructor setup → QGH, SRE/vectoring or SRA → create → Session → Admit → Ready → online Meet/audio check → Start → Terminate → Review."
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
      "title": "One instructor workspace across the suite",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [
        "quick-heading",
        "homing",
        "pilot-readback",
        "instructorFloatingControls",
        "proceduralFloatingControls"
      ],
      "anchor": "scope",
      "priority": true,
      "match": "\\b(?:where.*(?:homing|pilot message|pilot caption)|homing.*(?:below|moved)|heading.*(?:white|visible|read|dark)|same (?:screen|layout|workspace)|instructor (?:layout|interface|workspace)|scroll ?bar|scroll track|scroll.*(?:aircraft list|tools|legend)|(?:move|drag|reset) (?:the |a )?(?:box|panel|floating|aircraft controls)|floating (?:box|controls|panel))\\b",
      "text": "QGH, SRE/vectoring, SRA and Procedural share the instructor workspace. On desktop, the scope fills the working area. The left floating Aircraft & radio box holds the selected aircraft quick controls, then homing and red pilot captions below. Controls hides or restores this box. Drag its Move handle, or focus Move and use arrow keys; Shift + arrows makes smaller moves. Home or Reset restores its position. Collapse/Expand folds the contents. Drawers, clock, Gyani, tour and same-screen confirmations also have Move/Reset controls. Boxes stay within the visible screen. The right tool rail remains in its usual position. More controls opens the Aircraft controls drawer for target heading, speed and level. Session, Aircraft controls and Review sit on the right tool rail, with chart or mode tools where applicable. One drawer opens at a time and overlays the scope without resizing it. Close or Escape restores focus to the opening control. Status, clock and Run/Pause stay above; Options expands secondary controls and Start/Run collapses them. The phone arrangement stays unchanged, with controls and instruments below the plot. Swipe aircraft, tool or legend strips sideways, or drag the visible track below an overflowing row; arrow keys move a focused track. Tracks hide when everything fits. Long forms and review lists scroll vertically inside their panels, and the page scrolls to lower controls. Beside an aircraft blip on the canvas, heading is shown as three digits followed by H, for example 030 H. Procedural retains a true reference; QGH/SRE/SRA retains a magnetic reference. H means heading; QDM/QTE bearings keep their own references.",
      "questions": [
        "Where is the homing display?",
        "Where are pilot messages now?",
        "The heading is white and not visible",
        "Do QGH and Procedural use the same instructor layout?",
        "How do I close the instructor drawer?",
        "Where is the phone scroll bar?",
        "How do I scroll the aircraft list on a phone?",
        "How do I hide the instructor control strip?",
        "Why does opening a drawer not shrink the scope?",
        "Can I drag the aircraft and radio box?",
        "How do I move a floating panel?",
        "How do I reset a moved box?"
      ]
    },
    {
      "id": "meeting-room",
      "title": "Talk through an online exercise with Google Meet",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [
        "startSetupStatus",
        "openStartSetup",
        "start-setup-status",
        "open-start-setup"
      ],
      "anchor": "voice",
      "priority": true,
      "match": "\\b(?:google meet|meet room|meeting room|video call|conference|voice (?:chat|call)|talk (?:to|with) (?:the |my )?(?:student|instructor|controller)|talk to each other|create (?:a )?meeting|join meet|startup(?: steps)?|start (?:disabled|unavailable|blocked)|why (?:can.?t|cannot|won.?t)(?: i| we)? (?:start|run))\\b",
      "text": "Online startup: create the simulator room, then open Startup steps or Session → Google Meet · exercise voice. In Google Meet choose New meeting → Create a meeting for later, copy its link and Share meeting link in the simulator. Share the exercise PIN; the controller requests admission and the instructor presses Admit. The controller presses Ready — open display & meeting link, then Join Meet. Both join the same meeting, allow microphone access in Google if asked, check you can hear each other, and keep both simulator and Meet open. The instructor ticks The controller and I have joined this Meet and can hear each other, then Start/Run begins aircraft movement. Meet carries conversation throughout the exercise and debrief. This is your confirmation; the simulator cannot detect a Google connection or join for you. A changed/cleared link, new room or refresh of this position clears its confirmation. Loss of the instructor exercise connection also clears the instructor confirmation. After either person reconnects to Meet, recheck together and confirm again before Resume; the simulator cannot detect another person’s Google connection. Startup status beside Start names the missing step. Manual time advance is also blocked until online startup is complete. Offline uses conversation on the same PC and does not require Meet. Meet help & screen sharing contains official Google creation/audio help.",
      "questions": [
        "Can the instructor create a Google Meet room?",
        "How can student and instructor talk to each other online?",
        "Where do I paste the meeting link?",
        "Why can the Procedural student not see Join Meet before Ready?",
        "Can I join Meet after instructor admission?",
        "Does Google Meet work offline?",
        "Why is Start unavailable online?",
        "Do we use Google Meet throughout the exercise?",
        "Why must I check audio again after reconnecting?",
        "Why can't I Start?",
        "Why is Start disabled?",
        "Where are Startup steps?"
      ]
    },
    {
      "id": "meeting-debrief",
      "title": "Share the review screen for a debrief",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [],
      "anchor": "voice",
      "priority": true,
      "match": "\\b(?:screen shar(?:e|ing)|shar(?:e|ing) (?:the |my )?(?:screen|review|replay)|present now|debr(?:ief|eif)(?:ing)?(?:.*(?:meet|online|screen))?|echo|headphones.*meet|meet.*headphones)\\b",
      "text": "Keep the same Meet call open throughout training. For debrief, pause or terminate the exercise and open Review. In the joined Google Meet call choose Present now → A tab or A window, select the simulator review and Share. Share the review when you are ready to discuss instructor truth; live exercise screens keep the controller's information separate. Keep the simulator instructor position open while you present. Use headphones for the conversation. If sound echoes, keep simulator pilot voice muted and use the pilot captions; check that only one nearby device has its microphone and speaker active. Meeting host or organisation settings may restrict presenting. Stop presenting in Meet when the debrief finishes.",
      "questions": [
        "How do I debrief by sharing my screen?",
        "How do I share the replay in Google Meet?",
        "Where is Present now?",
        "Why is there echo during the online exercise?",
        "Should simulator pilot audio be on during Meet?",
        "Can I screen share the instructor review?"
      ]
    },
    {
      "id": "exercise-time",
      "title": "Exercise time starts at zero",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [
        "clock",
        "clock-state",
        "step"
      ],
      "anchor": "exercise",
      "priority": true,
      "match": "\\b00 00 00\\b|\\b(?:scenario clock|scenario time|exercise time|elapsed clock|timer.*(?:start|zero)|clock.*(?:start|begin)|(?:start|begin).*clock|procedural.*clock)\\b",
      "text": "Exercise time begins at 00:00:00 in instructor QGH/SRE/SRA and Procedural. Hours, minutes and seconds show elapsed simulated exercise time on the instructor, controller and review displays. Start/Run advances the exercise; Pause freezes it. Procedural +1 min explicitly advances the paused exercise by one minute. The clock is independent of the device's current time and connection duration. Joining or admission does not start aircraft movement: any admitted controller must be Ready and the instructor must press Start/Run. Review uses the recorded exercise timeline. QGH WAITING means startup has an unfinished step; the message beside Start names it. Startup steps opens Session to share the PIN, Admit, wait for Ready and, online, confirm mutual Meet audio before Start.",
      "questions": [
        "Does the exercise timer start at zero?",
        "What does 00:00:00 mean?",
        "Is Exercise time my computer's current time?",
        "Does connecting to the instructor start the clock?",
        "Does Pause freeze Exercise time?",
        "What does +1 min do to Exercise time?"
      ]
    },
    {
      "id": "training-time",
      "title": "Real time, training acceleration and aircraft motion",
      "topics": [
        "suite",
        "qgh-individual",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [],
      "anchor": "exercise",
      "priority": true,
      "match": "\\b(?:real time|realtime|training (?:time|clock|acceleration)|time (?:scale|rate)|simulation (?:time|clock|rate)|240 knots|knots.*(?:distance|minute)|turn radius|rate of turn|aircraft realism|stopwatch|operator timer|ground ?speed|airspeed|wind drift|ias|aerodynamic|performance limits|resume flight|browser paused|processing gap)\\b",
      "text": "Single and Tactical QGH run at 1×. Their operator Stopwatch starts at 00:00:00 and has independent Start/Stop/Reset controls; recorded flight and replay timestamps use simulated elapsed time. Instructor-led QGH starts at 5× training time and offers 1×, 5× and 10×; SRE/vectoring and SRA start at 1× with optional faster settings. Procedural runs at 1×. Individual replay 1× means one recorded second per real second; 2×, 3× and 10× remain available. Replay pause excludes waiting time and playback never changes the completed flight. Faster training time advances flight and simulation clock together; rates retain their configured values per simulated second or minute. At 240 kt with no wind, straight flight covers 4 NM per simulated minute; a 3°/s turn covers 180° in 60 simulated seconds. Single/Tactical and instructor QGH/SRE/SRA use configured ground speed without wind drift. Procedural airborne speed is through-air speed with the configured steady wind added; Speed kt therefore differs from resultant ground speed when wind is nonzero. No IAS/altitude conversion is modelled. In Single/Tactical a browser processing gap above two seconds freezes aircraft and stopwatch; Stopwatch → RESUME FLIGHT explicitly resumes aircraft and restores the stopwatch only if it had been running; an intentionally stopped stopwatch stays stopped. Instructor-led workspaces pause after a processing gap and require Resume/Run. These are calibrated training kinematics with configured speed, turn and climb/descent rates. Named aircraft types are training presets; the model does not simulate bank/roll, thrust, mass, stalls or aircraft-specific aerodynamic envelopes.",
      "questions": [
        "Does the aircraft fly in real time?",
        "Why does QGH use a faster training clock?",
        "What changes at 5x training time?",
        "How far does 240 knots travel in one minute?",
        "How does rate of turn affect the turn radius?",
        "Where is Resume flight after the browser paused?",
        "Does aircraft type set realistic performance limits?",
        "Does Speed kt mean airspeed or groundspeed?",
        "Does Procedural wind change ground speed?",
        "Is IAS converted for altitude?"
      ]
    },
    {
      "id": "local-pin-recovery",
      "title": "Update safely or recover a rejected local PIN",
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
      "match": "\\b(?:wrong|incorrect|expired|rejected|invalid)\\b.*\\bpin\\b|\\bpin\\b.*\\b(?:wrong|incorrect|expired|rejected|invalid|not working)\\b|\\b(?:update available|update the app|update simulator|update safely|cached layout|older layout)\\b",
      "text": "Update outside the exercise: finish first, return to Suite home or the exercise entry page, accept Update available · reload if offered, then reopen your exercise flow. No update prompt is needed while traffic runs. For a rejected PIN, check that both positions use the same Exercise connection. This device needs the same PC, browser profile and site address; other devices need Online room with internet on both. Copy the PIN currently shown in the instructor Session panel. If an older cached release rejected it, update at entry before creating a new session and sharing its new PIN. An old PIN does not join a newly created session.",
      "questions": [
        "Why is my PIN rejected?",
        "Incorrect session PIN",
        "The local PIN is not working",
        "Where can I update the app?"
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
      "match": "\\b(?:small screen|landscape|screen clipped|buttons off screen|scope disappeared|radar too small|scroll (?:the )?workspace|scroll ?bars?|scrolling)\\b",
      "text": "Select an aircraft in the traffic row and use Left now, Stop turn and Right now below the scope. The target-heading field and buttons wrap together on small screens. More controls opens the scrollable Aircraft controls drawer; Close or Escape returns to the scope. The shared instructor layout keeps status, clock and exercise actions together, with homing and pilot captions below the plot. Options reveals display settings and minimises at Start/Run. Swipe long traffic and tool rows sideways, or drag the visible horizontal track below the row. Scroll long forms and review panels vertically. Use landscape for SRE/SRA controller displays. Gyani stays tucked away during running traffic.",
      "questions": [
        "The scope disappeared on my phone",
        "How do I use landscape?",
        "Buttons are off screen"
      ]
    },
    {
      "id": "logout-position",
      "title": "Log out and return to ATS suite Home",
      "topics": [
        "suite",
        "qgh",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "controls": [
        "workspaceLogout"
      ],
      "anchor": "session",
      "priority": true,
      "match": "\\b(?:log ?out|log ?off|leave (?:this |the |my )?(?:desk|position))\\b",
      "text": "Logout stays at the top right of the QGH/SRE/SRA and Procedural instructor or student setup, waiting, exercise and review screens. It asks: Log out and return to ATS suite Home? Current exercise progress will be lost. Cancel or Escape keeps the current position open and preserves the current attempt. Log out discards this tab’s current exercise progress and recovery, leaves the position and returns to ATS suite Home. Saved starting exercises in the browser library are retained. If leaving cannot complete, the current screen remains open with an error. Use Terminate to stop traffic and review the attempt; use Logout to discard current progress and leave the position.",
      "questions": [
        "Where is Logout?",
        "Can I log out during an exercise?",
        "Does Cancel on Logout keep my progress?",
        "How do I leave the student position?",
        "How do I log out after review?",
        "Does Logout remove my saved exercises?",
        "Can Escape cancel Logout?"
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
      "text": "At either instructor-led entry page, choose Exercise connection above the Instructor setup and Controller position cards. This device / offline: use the SAME PC, SAME browser profile and exact same site address, with instructor and student in separate windows. Online room: use DIFFERENT PCs/devices, with internet on both. Choose the same connection mode and PIN, then Admit → Ready → Start/Run. QGH instructor-led, SRE/vectoring, SRA and Procedural support both choices. QGH role links and its inline PIN request carry the selected connection to the next page. Keep the instructor window open. Separate PCs without internet cannot share a live exercise in this release.",
      "intro": "Use the instructor's connection mode and PIN. This device needs the same PC and browser profile; Online room connects different devices with internet on both. Keep both positions open.",
      "questions": [
        "Can my instructor use another laptop?",
        "Can we train without WiFi?",
        "Can two computers connect without internet?",
        "Is Supabase used for QGH and SRA?",
        "Where do I select the connection before joining?",
        "Will the QGH entry page keep my connection choice?"
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
      "text": "A brief, skippable introduction opens on first use when the workspace is ready, before the first Run; Individual QGH shows it during setup. It does not open automatically after Pause or during review. Next highlights the essential controls; Skip tour or Escape closes it. You can reopen Guided tour before Start, while paused or during review. Run closes all tour overlays without pausing or changing the exercise. The first instructor Start may show a short mouse-control reminder inside the controls shelf. Phone users use the aircraft arrows and Stop turn.",
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
      "text": "Single-click or tap an aircraft to select and transmit for D/F; a mouse click waits briefly to recognise a double-click. Double-left-click turns left now, double-right-click turns right now. Press and release the middle mouse button without dragging to stop: a click on an aircraft selects and stops that aircraft; a blank-scope click stops the selected aircraft. The command completes once on release, even outside the scope. Dragging or cancelling the press sends no command. On phones use Left now / Right now / Stop turn below the scope. More controls opens Aircraft controls: enter Heading °T and choose Turn left or Turn right for a target heading, or set speed, level and orbit controls.",
      "questions": [
        "How to turn right?",
        "How do mouse clicks work?",
        "Can I type a target heading?",
        "Where is More controls?",
        "How does centre mouse click work?"
      ],
      "intro": "Click an aircraft to select and transmit. Double-left/right clicks turn; middle-click stops on release. Click blank scope with the middle button to stop the selected aircraft; a drag sends no command. On a phone, select it and use the arrows and Stop turn. More controls opens Heading °T."
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
      "text": "Middle-click by pressing and releasing the middle mouse button without dragging. A click on an aircraft selects and stops it; a click on blank scope stops the selected aircraft. Release completes the command once even if the pointer is outside the scope; a drag or cancelled press sends no command. You can also select the aircraft and press Stop turn. It stops changing heading at the current heading and exits an orbit immediately. Leave orbit / hold requests an exit after the current lap.",
      "questions": [
        "Can I middle-click blank scope to stop the selected aircraft?",
        "Does middle click stop on press or release?",
        "Why does dragging with the middle button not stop the turn?"
      ]
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
      "text": "SRE/SRA observations use a 4 simulated-second scan period (15 RPM at 1×). One revolution takes 4 real seconds at 1×, 0.8 real seconds at 5× and 0.4 real seconds at 10×. It pauses with the exercise. Choose trail length in scope options; range-aware spacing keeps movement visible. Instructor truth remains continuous; SRE/SRA controller returns update on beam crossing. A visual sweep does not reveal hidden aircraft on the Procedural student screen.",
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
      "text": "Prepare exercise opens one panel with three sections: 1 Choose or edit airspace, 2 Set traffic & create exercise, and 3 Save or load an exercise. Choose Published airspace or Custom airspace, then Continue to traffic. Set 1–20 aircraft; expand Initial traffic for independent callsign, position, heading, level, speed and performance. Phone cards scroll vertically; Jump to aircraft selects a callsign. Create exercise applies the visible roster and opens the workspace paused. Save the prepared starting setup before Run. Switching sections keeps entries; apply or discard unsaved airspace entries before creating traffic.",
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
      "text": "Run starts or resumes the same exercise after any admitted controller is Ready. Pause freezes traffic, clock and radar sweep. +1 min advances one minute. Status, clock and exercise actions stay together at the top. Options minimises when Start/Run begins; reopen it when needed. Terminate finishes the exercise for review; Reopen restores it paused. A Google Meet call remains separate from the exercise clock.",
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
      "match": "\\b(?:turn|turning|left|right|heading|steer|stop turn|middle (?:mouse )?click|centre (?:mouse )?click)\\b",
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
      "text": "Single-click an aircraft to select it and transmit: QGH gives D/F; SRE/SRA gives a pilot position report. Double-left/right mouse clicks turn left/right now. A middle click completes once on release: clicking an aircraft selects and stops it; clicking blank scope stops the selected aircraft. Release can be outside the scope; dragging or cancelling sends no command. On phones use the arrows and Stop turn. More controls opens Aircraft controls: enter a magnetic target in Heading °M for a directed turn. U/S Compass uses timed Left now / Right now and Stop. The student gives instructions; the instructor flies.",
      "questions": [
        "How to turn right?",
        "Can I type a heading?",
        "Does clicking transmit?",
        "Centre mouse click stops turn?",
        "Can I middle-click blank scope to stop the selected aircraft?",
        "Does middle click stop on press or release?"
      ],
      "intro": "Click an aircraft to select and transmit. Double-left/right clicks turn; middle-click stops on release. A blank-scope middle click stops the selected aircraft; a drag sends no command. On a phone, use the arrows and Stop turn. More controls opens Heading °M, speed and level."
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
      "match": "^(?!.*\\bhome\\b).*(?:\\b(?:terminate|terminated|termination)\\b|\\b(?:end|finish|stop) (?:the |this |my )?(?:exercise|session)\\b)",
      "text": "On the instructor scope, press the red ■ Terminate exercise button and confirm. The green Keep exercise button cancels. Traffic stops and the instructor review opens. The student console shows EXERCISE TERMINATED in a red banner that briefly pulses, then remains visible; an open student drawer closes to reveal it. Reduced-motion settings disable the pulse. Students cannot terminate or reopen the instructor exercise. Reopen exercise restores the same traffic and records paused, and clears the student ending message; Run continues. Use Pause for a temporary stop. ATS suite Home in the instructor review returns to the suite home page; Reopen keeps the current exercise for continued training.",
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
        "traffic-review",
        "reviewSuiteHome",
        "review-suite-home"
      ],
      "anchor": "review",
      "priority": true,
      "match": "\\b(?:replay|review|debrief|timeline|separation cue|zoom.*(?:bar|toolbar)|toolbar.*(?:cover|plot))\\b|\\b(?:home.*(?:review|terminat|ended)|(?:review|terminat).*home|return to (?:the )?ats (?:simulator )?suite home)",
      "text": "Terminate before review. Individual QGH replays the recorded flight path, with controls below the plot. Procedural Review offers animated Top, Side · altitude and 3D schematic views at the same replay time. Choose Aircraft to highlight one track and filter its events; select a timeline marker or a Commands & events item to seek to that recorded time. Cues show measured spacing against the configured threshold, the sampled cue interval and duration, plus the supplied source, applicability, evidence and instructor assessment. Red marks a configured threshold warning; amber asks for instructor assessment, and a satisfied measurement stays neutral. These are configured training cues, not a complete Doc 4444 decision; no cue at a sample does not establish safe separation. The instructor checks authorised minima and prerequisites. The 3D view exaggerates altitude, and replay never alters the completed exercise. After terminating an Instructor QGH/SRE/SRA or Procedural exercise, ATS suite Home in the review screen returns to the ATS Simulator Suite home page. Use Restart for another attempt or Replay to inspect the recording; Home is a separate exit from review.",
      "questions": [
        "The replay buttons cover my track",
        "How do I watch my flight again?",
        "How do I seek to a command in review?",
        "What do the separation cues mean?",
        "Where is Home after termination?",
        "How do I return to ATS Simulator Suite home from review?"
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
      "text": "After creating an instructor-led session, TERMINATE is beside Start and Pause. It becomes available once the exercise has started and remains available when paused. Terminate ends the shared exercise and opens the instructor review; the student sees Exercise complete. Student displays cannot terminate it. Use Pause for a temporary stop. ATS suite Home in review returns to the suite home page; Restart exercise prepares another attempt.",
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
      "text": "Choose Exercise connection above the two entry cards. Instructor: Open instructor setup, create the exercise, then open Session on the tool rail and share its six-digit PIN. A new room resets admission and display status. Controller: use the Controller position card, enter the PIN and press Request to join. Procedural also requires your name; QGH Request to join carries the selected connection and PIN into the protected controller route and sends the request. Creating a QGH session stays on the instructor desk; it does not open a controller window automatically. Optional Session → Open controller entry opens the same paired entry page with the PIN filled in, and waits for Request to join. A direct controller link returns to that paired entry; an existing admitted seat can still recover after refresh. This does not bypass admission: Instructor → Admit, Controller → Ready, Instructor → Start/Run. This device needs the same PC and browser profile in separate windows. Online room connects different devices with internet on both. Session → Google Meet · exercise voice shares the Google Meet link for conversation throughout the online exercise. After Ready opens the display/link, both join and check audio; the instructor confirms mutual audio before Start. Keep both simulator positions open.",
      "intro": "Use the instructor's connection choice and six-digit PIN, then Request to join. After admission press Ready; the instructor then starts the exercise. Procedural also asks for your name. QGH's entry-page request keeps the same admission steps.",
      "questions": [
        "How do I join?",
        "Where is my PIN?",
        "What does Ready do?",
        "Can I enter the QGH PIN on the landing page?",
        "Why does only Procedural ask for my name?"
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
      "text": "Choose Exercise connection above the entry cards, then Open instructor setup. Prepare exercise uses one panel: choose/edit airspace, set traffic, then save/load. Published and Custom airspace share section 1; Continue to traffic opens section 2. Choose title/count and expand Initial traffic for exact starting aircraft. Create exercise opens the workspace paused. Section 3 has Load saved exercise and Save current setup; management and file actions are closed until needed. On desktop the scope fills the working area, with the aircraft quick controls in the left floating Aircraft & radio box and homing/readbacks below; Controls hides or restores that box. Session, Aircraft controls and Review open overlay drawers from the right tool rail. Phone controls retain their arrangement below the plot. Session admits the controller; Ready opens the controller display and meeting link. For online training, both join Meet and check audio, then the instructor confirms this before Run. Startup steps opens the checklist and shows what remains. Options expands secondary display controls and collapses when Run begins. Save the starting setup before Run to reuse it later. Creating the session stays on the instructor desk. The controller joins from the paired entry page by entering the PIN and requesting admission. For an online exercise, use Session → Google Meet · exercise voice to share a Google Meet room.",
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
      "intro": "Open Instructor setup. Choose QGH, SRE/vectoring or SRA, prepare the traffic and create the session. Keep this position open while the controller joins.",
      "topics": [
        "qgh-instructor",
        "sra"
      ],
      "anchor": "instructor",
      "match": "\\b(?:start|begin|create|set up|setup|configure|first exercise|what next|sre|vectoring)\\b",
      "text": "Choose Exercise connection above the entry cards, then Open instructor setup and choose QGH, SRE/vectoring or SRA. QGH is the cloud-breaking procedure with Normal or U/S Compass. New QGH sessions allow up to 2 aircraft; SRE/vectoring and SRA allow up to 24. Prepare traffic and pressure/approach references, create the session, admit the controller and wait for Ready. For online training, both join the shared Meet and check audio; the instructor confirms this before Start. Startup steps beside Start opens the checklist and names what is missing. On desktop the scope fills the working area, with quick turns and Transmit in the left floating Aircraft & radio box, followed by homing and red pilot captions. Controls hides or restores the box; More controls opens target heading, speed and level in Aircraft controls. Session, Aircraft controls and Review use right-side overlay drawers without resizing the scope. Phone controls stay below the plot. Options expands secondary display controls and collapses at Start. Creating the session stays on the instructor desk. The controller joins from the paired entry page; Session → Open controller entry is optional and never joins automatically. For an online exercise, use Session → Google Meet · exercise voice to share a Google Meet room.",
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
      "text": "Open Single QGH, then choose Single aircraft or Tactical. Check runway, inbound/outbound tracks, Normal or U/S Compass, initial range, performance and level settings. Start opens the controller console and starts aircraft movement. The Stopwatch starts at 00:00:00 and is operated independently with Start, Stop and Reset. Stop pauses this timer while aircraft keep moving. Flight logs and review use recorded simulated elapsed time, independently of the Stopwatch. In Tactical select the intended aircraft before commanding it. The Training Centre holds the accepted radio-call catalogue.",
      "questions": [
        "How do I start individual QGH?",
        "How do I start Tactical?"
      ],
      "priority": false,
      "controls": [],
      "intro": "Check runway, procedure tracks, Normal or U/S Compass and aircraft settings. Start begins aircraft movement. Start the separate Stopwatch when you want to time your procedure. Use the controller controls, then Terminate to review your track."
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
      "text": "Click the aircraft or choose Transmit. QGH gives a pilot transmission with D/F; SRE/SRA sends the pilot position report. On desktop, homing and red pilot captions sit below the aircraft quick controls in the left floating Aircraft & radio box; on phones they remain below the scope. Controls hides or restores that box. QDM is magnetic homing and QTE is true bearing; QGH retains the last indication briefly after release. The controller’s SRE/SRA plots remain sensor observations.",
      "questions": [
        "Does clicking an aircraft transmit?",
        "What does QDM mean?",
        "Where are pilot messages?"
      ],
      "controls": [],
      "priority": false,
      "intro": "Pilot captions and homing sit below the aircraft quick controls in the desktop left floating Aircraft & radio box and below the phone scope. Click or Transmit gives QGH D/F, or a position report in SRE/SRA. Controls hides or restores the floating box. The student sees the appropriate bearing or radar observation."
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
      "text": "Select the aircraft → More controls. Set speed or target level and command climb/descent. The instructor-led simulator models levels in feet MSL; QNH, TA and TL are shared briefing references. The SRA 3° profile is a guide; the instructor commands descent.",
      "questions": [
        "How do I change altitude?",
        "How do I set speed?"
      ],
      "controls": [],
      "priority": false
    },
    {
      "id": "scope-tools",
      "title": "Scope controls, rings and aircraft labels",
      "topics": [
        "suite",
        "qgh-instructor",
        "sra",
        "procedural"
      ],
      "anchor": "scope",
      "match": "\\b(?:pan|zoom|range rings|ring spacing|scope controls|scope layers|local picture|bearing range ruler|ruler|options dropdown|top controls|controls button|hide controls|show controls|control strip|hud|aircraft labels|selected labels|labels off|aircraft glyph|leader lines)\\b",
      "text": "Drag blank scope to pan. Range or Ctrl + scroll changes the total displayed range; Centre/Home returns to the origin. Options opens secondary display controls and Start/Run collapses them. Under Options, use Ring spacing and Labels beside Range in the scope display settings. Ring spacing chooses a fixed 5 NM or 10 NM interval repeated throughout that total range. The outer range is marked even when it is not an exact multiple of the interval. At a dense scale, fewer distance labels are printed while the rings remain. Instructor aircraft use a common small glyph. Aircraft labels offers Selected (default), All or Off; Off hides text labels, not aircraft glyphs. Selected-aircraft information is placed away from aircraft and connected by leader lines. Controls hides or restores the left floating Aircraft & radio box containing aircraft controls, homing and readbacks; More controls opens the Aircraft controls drawer. Right-side drawers overlay the desktop scope without resizing it; Close or Escape restores focus to the opening control. The phone arrangement is preserved with sideways scroll tracks for long rows. Display settings affect this position only, and do not change aircraft motion or the controller's information.",
      "questions": [
        "How do I pan the scope?",
        "How do I minimise the top controls?",
        "How do I hide or restore the whole control strip?",
        "What does 5 NM ring spacing mean at 60 NM range?",
        "Why are some range-ring numbers hidden?",
        "How do I show only the selected aircraft label?",
        "Can I turn all aircraft labels off?",
        "Why does selected aircraft information move with a leader line?"
      ],
      "controls": [
        "workspace-options-toggle",
        "scope-controls-toggle",
        "ring-spacing",
        "aircraft-labels"
      ],
      "priority": false
    },
    {
      "id": "custom-polygons",
      "title": "Save the ARP, then draw and apply a boundary",
      "topics": [
        "suite",
        "procedural"
      ],
      "anchor": "airspace",
      "match": "\\b(?:polygon|draw|drawing|boundary|boundaries|point to point|set save arp|custom airspace|custom lfa|coordinates)\\b",
      "text": "Pause the instructor exercise, then Prepare exercise → 1 Choose or edit airspace → Custom airspace. Save ARP before drawing; unsaved ARP changes must also be saved first. The drawing readiness message shows what is missing and the current point count. Set / save ARP takes you to the ARP fields when drawing is blocked. Add a boundary name, LFA/P/R/D/CTR type and vertical limits. Expand Draw boundary with mouse / touch: click or tap the preview to add points in order, or drag an existing vertex to move it. Draw / edit on radar scope opens the full scope with its drawing toolbar; aircraft turns, transmissions, panning and exercise shortcuts are isolated while drawing. Drag the toolbar’s Move handle to reposition it, or focus Move and use arrows; Shift + arrows makes small moves, and Home or Reset restores its position. At least three valid points are required. Close boundary checks and closes the ring and returns you to the boundary form; then Save boundary applies it to both desks. Closing alone does not save. Cancel drawing exits drawing mode and keeps the unsaved points. Edit loads a saved ring; select or drag a vertex, or use Selected vertex → Delete selected vertex. Enter closes the ring, Delete/Backspace removes the selected vertex and Escape exits full-scope drawing. A crossed ring is rejected. Remove deletes a saved whole area after confirmation. Published airspace and Advanced chart tools & references remain in section 1. Discard unsaved airspace entries restores saved settings after confirmation; Continue to traffic proceeds to section 2 without applying unfinished entries.",
      "questions": [
        "How do I draw an LFA polygon?",
        "Can I drag boundary points?",
        "How do I delete a polygon vertex?",
        "Where do I enter prohibited area coordinates?",
        "Why is mouse drawing unavailable?",
        "Where is Set / save ARP?",
        "What does the boundary point count mean?",
        "How do I draw an airspace boundary on the radar scope?",
        "Does Close boundary save the polygon?",
        "Does Cancel drawing keep my points?",
        "Why do aircraft controls stop while drawing a boundary?",
        "How do I move the boundary drawing toolbar?"
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
        "boundary-scope-delete",
        "prepare-airspace",
        "prepare-published",
        "prepare-custom",
        "prepare-advanced",
        "prepare-airspace-discard",
        "custom-airspace-discard",
        "prepare-traffic-next",
        "boundary-drawing-status",
        "boundary-go-arp",
        "boundary-scope-tools",
        "boundary-scope-close"
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
      "match": "^(?!.*\\blog ?(?:out|off)\\b).*(?:\\b(?:template|preset|library|import|export|(?:save|saved|load|reuse) (?:the |a |an |my |this |current |starting |same )?(?:exercise|setup|set up))\\b|^(?!.*\\b(?:boundary|polygon|arp|drawing|draw)\\b).*\\b(?:save|saved|reuse|re use|preset|preload|pre loaded|template|same (?:exercise|setup|set up)|import|export|library|(?:duplicate|rename) (?:selected|(?:(?:a|the|my) )?(?:exercise|setup|template|preset)))\\b)",
      "text": "Prepare the starting setup before Run. Procedural: Prepare exercise → 3 Save or load an exercise. Choose a record under Load saved exercise and press Load; it restores the saved airspace and original traffic paused at 00:00:00 after replacement confirmation. Replacement uses a confirmation on the same screen; Cancel keeps unsaved entries. Exercise name → Save current setup updates the selected exercise or saves a new one when none is selected; replacement asks for confirmation. Apply unfinished airspace changes and Create exercise before saving. Manage exercises & files contains Save as new, Duplicate selected, Rename selected, Export selected, Remove selected and Import exercise file. Import adds a stored setup; Load applies it. New Procedural saves/imports allow up to 20 aircraft; older device templates retain their traffic. Instructor QGH/SRE/SRA: Load fills the setup; Create session starts a new room. Save current setup updates the chosen exercise or saves a new one when none is selected. Manage / files keeps Save as new and sharing/management actions. Duplicate copies the stored original, Rename changes its name, and Export downloads a JSON backup. QGH imports create an independent entry with a unique name. Legacy QGH setups above 2 aircraft remain stored and exportable but cannot Load/Import. Restart after review retries the initial roster. Libraries keep starting setups on this browser/device, separate from live attempt recovery; new live sessions have independent PINs/admissions and saved setups contain no room tokens.",
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
        "template-rename",
        "prepare-save-load",
        "template-manage"
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
      "match": "^(?!.*\\b(?:aircraft labels|labels off|turn (?:off|on).*labels)\\b).*\\b(?:turn|turning|heading|left|right|mouse click|middle click|centre click)\\b",
      "text": "Instructor scopes: single-click selects the aircraft and transmits; double-left/right starts the corresponding turn. A middle click completes once on release: a click on an aircraft selects and stops it, and a blank-scope click stops the selected aircraft. Release can be outside the scope; dragging or cancelling sends no command. On phones select the aircraft and use the turn arrows and Stop turn. More controls opens target heading and the other aircraft actions. Procedural target-heading controls use Heading °T; Instructor QGH/SRE/SRA controls use Heading °M. Individual QGH keeps its manual Normal/U/S Compass controls.",
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
        "instructor-entry"
      ],
      "selector": "#exerciseConnection",
      "title": "Choose the connection",
      "entry": "connections",
      "brief": true
    },
    {
      "pages": [
        "instructor-entry"
      ],
      "selector": "#openInstructorSetup",
      "title": "Prepare as instructor",
      "entry": "instructor-start",
      "brief": true
    },
    {
      "pages": [
        "instructor-entry"
      ],
      "selector": "#entryJoinForm",
      "title": "Join as controller",
      "entry": "session",
      "brief": true
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#scope-controls-toggle",
      "title": "Hide or restore the control strip",
      "entry": "scope-tools"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#ring-spacing",
      "title": "Choose fixed ring spacing",
      "entry": "scope-tools"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#aircraft-labels",
      "title": "Selected, all or no aircraft labels",
      "entry": "scope-tools"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#clock",
      "title": "Exercise time starts at zero",
      "entry": "exercise-time"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#scopeControlsToggle",
      "title": "Hide or restore the control strip",
      "entry": "scope-tools"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#ringSpacing",
      "title": "Choose fixed ring spacing",
      "entry": "scope-tools"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#truthLabelMode",
      "title": "Selected, all or no aircraft labels",
      "entry": "scope-tools"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#instructorClock",
      "title": "Exercise time starts at zero",
      "entry": "exercise-time"
    },
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
      "title": "Prepare airspace, traffic and saved exercises",
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
      "selector": "#prepare-airspace",
      "title": "Save ARP, draw, close and save the boundary",
      "entry": "custom-polygons"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#prepare-save-load",
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
      "selector": "#workspaceOptionsToggle",
      "title": "Options and scope settings",
      "entry": "scope-tools"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#instructorTools",
      "title": "Session, aircraft and review tools",
      "entry": "instructor-instrument-shelf"
    },
    {
      "pages": [
        "procedural",
        "instructor"
      ],
      "selector": ".ats-phone-scroll-track:not([hidden])",
      "title": "Scroll an overflowing phone row",
      "entry": "instructor-instrument-shelf"
    },
    {
      "pages": [
        "procedural",
        "instructor",
        "student"
      ],
      "selector": ".ats-meeting-panel",
      "title": "Voice and online debrief",
      "entry": "meeting-room"
    },
    {
      "pages": [
        "procedural",
        "instructor",
        "student"
      ],
      "selector": ".ats-meeting-join",
      "title": "Join Meet and share the review",
      "entry": "meeting-debrief"
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
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#openStartSetup",
      "title": "Complete startup before Start",
      "entry": "meeting-room"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#open-start-setup",
      "title": "Complete startup before Run",
      "entry": "meeting-room"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#boundary-drawing-status",
      "title": "Drawing readiness and point count",
      "entry": "custom-polygons"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#reviewSuiteHome",
      "title": "Return to suite Home after review",
      "entry": "review-controls"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#review-suite-home",
      "title": "Return to suite Home after review",
      "entry": "review-controls"
    },
    {
      "pages": [
        "instructor",
        "student",
        "procedural"
      ],
      "selector": "#workspaceLogout",
      "title": "Logout with confirmation",
      "entry": "logout-position"
    }
  ],
  "startHint": {
    "title": "Aircraft mouse controls",
    "text": "Click: select + D/F · Double-left: turn left · Double-right: turn right · Middle: stop turn on release; blank scope stops selected aircraft. A drag or cancelled press sends no command. Phone: select, then use the turn arrows and Stop turn."
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
      "selector": "#readyPanel",
      "title": "Your exercise connection",
      "entry": "connections"
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
for(const step of knowledge.tours) if(step.entry){const entry=knowledge.entries.find(entry=>entry.id===step.entry);step.text=(step.brief?entry?.intro:entry?.text)||entry?.text||"";}
for(const step of knowledge.firstUse) if(step.entry){const entry=knowledge.entries.find(entry=>entry.id===step.entry);step.text=entry?.intro||entry?.text||"";}
if(typeof module === "object" && module.exports) module.exports=knowledge; else root.ATCGuideKnowledge=knowledge;
})(typeof globalThis==="object"?globalThis:this);
