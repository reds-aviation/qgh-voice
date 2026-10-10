// Shared release knowledge: the common guide, Gyani and screen tours. Maintain with each UI change.
(function(root){ const knowledge = {
  "revision": "1.0.1",
  "learning": "I am also learning. If I’m unable to answer, please refer to the training guide.",
  "flow": [
    {
      "title": "Procedural",
      "href": "procedural-beta/",
      "text": "Choose connection → Set up starting traffic → prepare airspace if needed → Back to traffic setup → Create exercise → Session → Admit → Ready → online Meet/audio check → Run → Terminate → Review."
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
      "id": "youtube-tutorial",
      "title": "Watch the narrated ATS SIM BOX tutorial",
      "topics": [
        "suite",
        "qgh-individual",
        "qgh-instructor",
        "procedural",
        "sra"
      ],
      "controls": [
        "suiteTutorialLaunch",
        "suiteTutorialChapter",
        "suiteTutorialStop"
      ],
      "anchor": "tutorial",
      "priority": true,
      "match": "\\b(?:tutorial|youtube|narrated.*(?:course|video)|watch.*(?:lesson|video)|video.*chapter)\\b",
      "text": "Home → Tutorial, or Training Centre → Demonstrations, opens the course after it is published. Load tutorial, then press Play in the YouTube player; there is no autoplay. Jump to chapter selects a measured start, then press Play. Use the player's captions and full-screen controls, or Watch on YouTube. Stop video, leaving the page or starting a local clip unloads the player. YouTube needs internet and cannot be saved by Make available offline; the complete written guide and individually saved local clips remain available. If publication is pending or the video cannot load, use those written instructions. The course distinguishes recorded actions from source-described controls and does not claim an unrecorded Meet/audio or speech-recognition check.",
      "questions": [
        "Where is the full tutorial?",
        "Can I watch the tutorial inside the web app?",
        "How do I jump to a video chapter?",
        "Does the YouTube tutorial work offline?"
      ]
    },
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
      "match": "\\b(?:align|calibrat|embed|upload.*(?:image|map|layout)|reference point|point c\\b)\\w*\\b",
      "text": "After saving ARP, choose a flat PNG/JPEG up to 5 MB, 4096 pixels per side and 16 megapixels. Enter source, edition and layout notes. Mark A at ARP and B/C at known points, enter coordinates and spread them across the chart. Check alignment → Apply and share. C checks scale and orientation. Aligning an image does not create editable polygons; enter or draw boundaries separately.",
      "questions": [
        "How do I align my LFA image?",
        "Why does point C fail?",
        "Can I upload a simple layout image?"
      ]
    },
    {
      "id": "arp-upload",
      "title": "Place an ARP dot or enter geographic coordinates",
      "topics": [
        "procedural"
      ],
      "controls": [
        "arp-file",
        "arp-template",
        "chart-form",
        "custom-arp-form",
        "drawn-arp-preview",
        "drawn-arp-scope"
      ],
      "anchor": "airspace",
      "priority": true,
      "match": "\\b(?:arp|aerodrome reference point|upload coordinates|origin coordinates)\\b",
      "text": "Prepare airspace → Draw on chart → Place ARP on preview or Place ARP on radar scope, then click or tap where the ARP dot belongs. Drawing does not ask for latitude or longitude. This dot centres range rings and provides the D/F station in local NM; it does not assign real-world geographic coordinates. Replacing an existing ARP asks for confirmation, clears the geographic ARP reference and unsaved route / area points, and keeps saved traffic and chart points in place. Enter coordinates is a separate method: Save the Aerodrome Reference Point (ARP) in WGS-84 latitude/longitude, using decimal degrees or DMS, before entering geographic routes or areas. Saving a geographic ARP after a mouse-placed dot replaces that local reference and aligns the ARP / D/F station at local 0, 0 after confirmation. Saved traffic and chart geometry keep their existing local positions. Advanced tools also accepts the ARP CSV/JSON template. Image alignment requires a geographic ARP. Changing ARP keeps existing local positions; it does not reproject them. Check and rebuild geometry against the new origin.",
      "questions": [
        "How do I upload ARP coordinates?",
        "Can I type latitude and longitude?",
        "Where is the ARP template?",
        "Can I place the ARP with my mouse without coordinates?",
        "What happens when I save geographic ARP coordinates after placing a dot?"
      ]
    },
    {
      "id": "saved-airspaces",
      "title": "Save reusable airspace without traffic",
      "topics": [
        "suite",
        "procedural"
      ],
      "anchor": "airspace",
      "priority": true,
      "match": "\\b(?:saved airspaces?|airspace library|(?:save|load|reuse|export|import|delete|offline|reusable)(?: (?:the|a|an|my|this|current|only|saved))? airspaces?|chart without traffic|airspace storage)\\b",
      "text": "Prepare airspace → Save or load → Setup type: Airspace only (chart). Only that library is shown; choose Complete exercise (aircraft + chart) for a full setup instead. Airspace name → Save airspace stores only chart settings, routes, reporting fixes, areas, visibility selections and an optional image. It can be saved at any paused exercise time after chart entries are applied; traffic drafts do not need to be created first. It excludes aircraft, progress, controller records, PINs and tokens. Selecting an existing record then Save airspace asks before replacing it; clear the selection to save a new named record. Load saved airspace → Load confirms replacement of the chart only. The exercise stays paused, and aircraft, targets, elapsed time, PIN and controller records are kept. If aircraft reference a route, fix, hold or armed instruction that the chart would change, Load is rejected; retain that navigation unchanged before trying again. Reopen an ended exercise before Load. Files contains Download file, Import airspace file and Download unsaved airspace when a storage save failed. Remove saved airspace is a separate collapsed group with Delete selected. Import stores an asset; explicit Load applies it. Up to 50 airspaces fit in a device library and portable JSON files must be under 20 MB including their image. A failed storage write does not count as saved and leaves the existing list unchanged; Download unsaved airspace preserves the failed snapshot. Export JSON backups for sharing. Device libraries stay in the same website origin and browser profile; GitHub Pages and Netlify do not automatically share them. Complete offline guidance and cached chart assets work without a meeting service; Online room and Meet still need internet.",
      "questions": [
        "How do I save airspace without traffic?",
        "Can I load saved airspace without changing aircraft?",
        "Where is the airspace library?",
        "Can I export airspace to another browser?",
        "Can I save airspace after running an exercise?",
        "What happens when airspace storage is full?"
      ],
      "controls": [
        "prepare-airspace-library",
        "prepare-save-load",
        "prepare-save-kind",
        "airspace-remove",
        "airspace-library",
        "airspace-name",
        "airspace-select",
        "airspace-save",
        "airspace-load",
        "airspace-files",
        "airspace-export",
        "airspace-import",
        "airspace-delete",
        "airspace-backup",
        "airspace-library-status"
      ]
    },
    {
      "id": "route-chart-details",
      "title": "Read route levels and directional chart marks",
      "topics": [
        "suite",
        "procedural"
      ],
      "anchor": "airspace",
      "priority": true,
      "match": "\\b(?:route (?:arrows?|levels?|limits?|direction)|odd(?: and)? even|odd levels?|even levels?|unidirectional|bidirectional|one way route|reporting point coordinates|route coordinate labels|published arrow)\\b",
      "text": "The route scope shows ordered reporting fixes, route names, level labels and chart direction marks when labels fit. After drawing at least two route points, Finish route brings the route details into view and focuses ATS route name. Name the route and its reporting points, choose Unidirectional · first → last or Bidirectional · both directions, enter lower / upper route bounds in ft MSL and optional level text, then Save route. Unidirectional follows your drawn point order; Bidirectional shows arrows in both directions along the same route. Finish route alone does not save. Published routes preserve exact per-leg source level text and labelled Odd / Even arrows from the dated AIP table: the table’s downward mark follows the listed point order and its upward mark points back. Those are source level-direction annotations, not an unconditional one-way clearance. Where a source direction is absent, no direction is invented. Labels may be omitted at dense zoom; Chart briefing retains the full route references and per-leg text. Route point coordinates use retained WGS-84 values when available, otherwise local east / north NM. Numeric route bounds are ft MSL; published FL/altitude text is not converted into a pressure-referenced clearance or live activation. Hiding a route changes chart visibility, not its availability or an aircraft instruction.",
      "questions": [
        "How do route arrows work?",
        "What do Odd and Even arrows mean?",
        "Why do route levels vary by leg?",
        "Where are reporting point coordinates?",
        "Does a published arrow make the route one way?",
        "How do I choose a unidirectional route?",
        "Can I make a drawn route bidirectional?"
      ],
      "controls": [
        "custom-route-form",
        "custom-route-name",
        "custom-route-direction",
        "custom-route-list",
        "route-list",
        "shared-routes",
        "tab-airspace"
      ]
    },
    {
      "id": "public-lfa-samples",
      "title": "Published airspace: routes and LFA / P / R / D areas",
      "topics": [
        "suite",
        "procedural"
      ],
      "controls": [
        "traffic-setup",
        "aerodrome-select",
        "aerodrome-layout-svg",
        "aerodrome-selection",
        "prepare-published"
      ],
      "anchor": "airspace",
      "priority": true,
      "match": "\\b(?:lfa|ats route|airspace|aerodrome|public chart|real route|sample map|prohibited|danger area|restricted area|catalogue|unchecking)\\b",
      "text": "Prepare airspace → Published airspace → choose Hindan, Pune, Jodhpur, Chandigarh, Gwalior, Agra or Bareilly. Load aerodrome airspace brings every available route, reporting fix and area from that base’s bundled snapshot. The route and area checkboxes start checked; unchecking hides chart items on both instructor and student scopes without deleting them or changing clearances. Declutter can restore hidden items later. P means prohibited, R restricted and D danger; LFA and CTR have separate boundary types. Chart briefing retains sources, level labels and omitted geometry notes. The bundled AIP AMDT 08/2026 snapshot is effective 3 September 2026, retrieved 27 September 2026. It includes parsed routes intersecting the 250 NM base region and retained nearby areas, and is not a complete operational chart or live NOTAM / activation service. SID/STARs, conventional J/V routes outside the source selection, ambiguous source points and unverified boundaries are omitted. Do not invent the missing geometry. Loading chart data keeps current traffic and elapsed time; referenced aircraft navigation must remain unchanged.",
      "questions": [
        "Where are sample LFAs?",
        "Are these real ATS routes?",
        "Can I hide only one ATS route?",
        "Where are prohibited and danger areas?",
        "Does unchecking a route delete it?",
        "Is the published airspace catalogue complete?"
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
      "title": "Starting traffic first, airspace separately",
      "topics": [
        "procedural"
      ],
      "controls": [
        "setup",
        "prepare-traffic",
        "traffic-setup",
        "prepare-traffic-next",
        "prepare-save-load",
        "prepare-airspace-library"
      ],
      "anchor": "traffic",
      "match": "\\b(?:callsigns?|scroll|roster|keyboard|phone|mobile|aircraft count|add aircraft|generate traffic)\\b",
      "text": "Choose Exercise connection → Set up starting traffic. The opening setup page contains only the initial traffic form: exercise family, title and 1–20 aircraft with their own callsign, position, heading, level, speed, turn / vertical rates, spawn time and compass condition. Phone cards scroll vertically; Jump to aircraft finds a callsign. Prepare airspace offers Published airspace, Draw on chart or Enter coordinates. Setup type in Save or load selects Airspace only (chart) or Complete exercise (aircraft + chart) and shows one library at a time; Advanced tools contains optional settings and sample traffic. Back to traffic setup retains your entries. Create exercise applies the roster and opens the workspace paused; save or discard chart drafts first. For an existing exercise, Return to exercise keeps progress and leaves roster edits unapplied.",
      "questions": []
    },
    {
      "id": "traffic-return-exercise",
      "title": "Return from traffic setup to the same exercise",
      "topics": [
        "procedural"
      ],
      "anchor": "traffic",
      "match": "\\b(?:return to (?:the )?exercise|back to (?:the )?scope|return from traffic|leave traffic setup|traffic setup.*progress)\\b",
      "text": "When you reopen traffic setup for an already created exercise, Return to exercise restores its scope without creating a replacement. The same aircraft, applied airspace, elapsed time, PIN and exercise records are kept. Opening traffic setup pauses a running exercise; Return to exercise leaves it paused, so select Run when ready. If the exercise has ended, Return opens Review and does not reopen the exercise automatically. Roster edits remain draft entries and Return does not apply them. Use Create exercise and confirm replacement to apply those traffic changes; this creates a replacement exercise with a new PIN. A fresh room requires Create exercise, Load of a saved full starting exercise, a restored current progress file or loaded Sample traffic before it can Run.",
      "questions": [
        "How do I return to the exercise from traffic setup?",
        "Can I go back to the scope without creating traffic again?",
        "Will Return to exercise lose my progress?",
        "Does Return to exercise apply my traffic edits?"
      ],
      "controls": [
        "setup",
        "prepare-traffic",
        "prepare-traffic-next",
        "traffic-return-exercise"
      ],
      "priority": true
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
        "step",
        "setup",
        "prepare-traffic",
        "open-start-setup"
      ],
      "anchor": "exercise",
      "match": "\\b(?:run|pause|resume|start|nothing moves|not moving|stopped)\\b",
      "text": "For a fresh instructor room, first use Set up starting traffic → Create exercise, Load a saved full starting exercise, restore a current progress file or load Sample traffic. Successful progress restore or sample loading makes that exercise available to Run without creating its traffic again. Preparing airspace alone does not apply the roster. Startup steps returns to traffic setup when this is missing. Run starts or resumes the same exercise after any admitted controller is Ready. Pause freezes traffic, clock and radar sweep. +1 min advances one minute. Status, clock and exercise actions stay together at the top. Options minimises when Start/Run begins; reopen it when needed. Terminate finishes the exercise for review; Reopen restores it paused. A Google Meet call remains separate from the exercise clock.",
      "questions": [],
      "intro": "Create exercise or Load a full starting exercise first. Admit the controller and wait for Ready, then Run. Pause freezes clock and traffic. The red Terminate button finishes the attempt."
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
        "review-suite-home",
        "review-download-setup",
        "review-download-progress",
        "template-import",
        "template-load"
      ],
      "anchor": "review",
      "priority": true,
      "match": "\\b(?:replay|review|debrief|timeline|separation cue|zoom.*(?:bar|toolbar)|toolbar.*(?:cover|plot)|download.*(?:exercise setup|current progress)|starting setup (?:unavailable|missing))\\b|\\b(?:home.*(?:review|terminat|ended)|(?:review|terminat).*home|return to (?:the )?ats (?:simulator )?suite home)",
      "text": "Terminate before review. Individual QGH replays the recorded flight path, with controls below the plot. Procedural Review offers animated Top, Side · altitude and 3D schematic views at the same replay time. Choose Aircraft to highlight one track and filter its events; select a timeline marker or a Commands & events item to seek to that recorded time. Cues show measured spacing against the configured threshold, the sampled cue interval and duration, plus the supplied source, applicability, evidence and instructor assessment. Red marks a configured threshold warning; amber asks for instructor assessment, and a satisfied measurement stays neutral. These are configured training cues, not a complete Doc 4444 decision; no cue at a sample does not establish safe separation. The instructor checks authorised minima and prerequisites. The 3D view exaggerates altitude, and replay never alters the completed exercise. In Procedural Review, use Download exercise setup before Logout or Home to keep the initial aircraft positions and complete starting airspace, including any map image, as a reusable JSON file. The simulator captures this setup before the first Run or +1 min; the file resets time, events, reports and radio for a new exercise and contains no PIN or room tokens. Later movement and termination do not replace these starting positions. To reuse it, open Prepare airspace → Save or load → Setup type: Complete exercise (aircraft + chart) → Import exercise file, then select the record and Load. Import stores the file; Load opens the starting exercise paused. Download current progress is separate: it keeps the current attempt and records rather than resetting to its start. Older underway exercises without a captured starting setup cannot reconstruct it; use Download current progress instead. After terminating an Instructor QGH/SRE/SRA or Procedural exercise, ATS suite Home in the review screen returns to the ATS Simulator Suite home page. Use Restart for another attempt or Replay to inspect the recording; Home is a separate exit from review.",
      "questions": [
        "The replay buttons cover my track",
        "How do I watch my flight again?",
        "How do I seek to a command in review?",
        "What do the separation cues mean?",
        "Where is Home after termination?",
        "How do I return to ATS Simulator Suite home from review?",
        "How do I download exercise setup after termination?",
        "How do I download current progress?",
        "Starting setup unavailable: what can I download?"
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
      "match": "\\b(?:start|begin|create|set up|setup|configure|first exercise|what next|sample traffic)\\b",
      "text": "Choose Exercise connection → Set up starting traffic. The opening setup page contains only the initial traffic form. Set family, title, aircraft count and individual starting details. Prepare airspace offers three methods: Published airspace, Draw on chart or Enter coordinates. Setup type in Save or load selects Airspace only (chart) or Complete exercise (aircraft + chart); only the selected library is shown. Advanced tools holds optional settings and sample traffic. Back to traffic setup keeps the roster; Create exercise applies it and opens a paused workspace. Return to exercise restores an existing paused scope or ended Review without applying roster drafts. A fresh room can Run after Create exercise, Load of a full starting exercise, current progress Restore or Sample traffic load. Session → Admit → controller Ready → online Meet/audio check → Run. Startup steps shows remaining requirements. Save the full starting exercise before Run; reusable airspace alone can be saved while paused. Prepare airspace → Advanced tools → Sample traffic loads a complete sample exercise after replacement confirmation. It is available to Run without creating its traffic again. Aircraft controls → Additional traffic tools adds traffic to the current exercise.",
      "questions": [
        "How do I start?",
        "Where is the aircraft roster?",
        "How do I set up Procedural?",
        "Why can I not Run before creating traffic?",
        "Why does opening setup show only traffic?",
        "Where is optional sample traffic?",
        "Can I Run optional sample traffic without creating its roster again?"
      ],
      "priority": false,
      "controls": [
        "instructor-login",
        "setup",
        "prepare-traffic",
        "traffic-setup",
        "prepare-save-load",
        "prepare-exercise-library",
        "prepare-sample-traffic",
        "preset-form",
        "prepare-advanced"
      ]
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
      "text": "Open Instructor setup → Set up starting traffic. Choose QGH, SRE/vectoring or SRA, then set the aircraft; new QGH sessions allow up to 2 aircraft, SRE/SRA up to 24. Aircraft performance folds away optional turn and vertical rates. Prepare airspace & radar is collapsed below traffic for runway, final approach, radar and local training boundary settings. Saved exercises folds Save, Load, Import exercise file and Download together; Rename or remove holds occasional management actions. Create session starts the exercise; if an attempt already exists, confirm its replacement or Cancel to keep it. Session → Admit → controller Ready → online Meet/audio check → Start. Startup steps names missing requirements. Traffic setup pauses and retains the current attempt; Return to exercise restores its desk or ended Review without applying setup edits. More controls opens heading, speed and level controls; the floating Aircraft & radio box and right tool rail remain in the workspace.",
      "questions": [
        "How do I start SRA?",
        "How do I start instructor QGH?",
        "How do I practise vectoring?"
      ],
      "priority": false,
      "controls": [
        "setupPanel",
        "scenarioForm",
        "setupEnvironment",
        "qghSavedExercises",
        "newScenario",
        "returnToExercise",
        "createSession"
      ]
    },
    {
      "id": "instructor-traffic-return",
      "title": "Return from QGH/SRE/SRA traffic setup without replacing the attempt",
      "topics": [
        "qgh-instructor",
        "sra"
      ],
      "anchor": "instructor",
      "match": "\\b(?:return to (?:the )?exercise|back to (?:the )?scope|return from traffic|traffic setup|leave traffic setup)\\b",
      "text": "Session → Traffic setup opens the starting form while keeping the current exercise. A running exercise pauses. Return to exercise → restores its desk with the same aircraft, exercise time, PIN, controller admission and records; an ended attempt returns to Review. Setup edits stay as drafts and are not applied by Return. Use Start/Resume when ready to continue a paused exercise. Create session applies the displayed setup as a new exercise after replacement confirmation; Cancel or failed online creation keeps the existing attempt. The Review Restart action deliberately prepares a fresh attempt.",
      "questions": [
        "How do I return to my QGH exercise from traffic setup?",
        "Does QGH Traffic setup replace the current exercise?",
        "Will Return to exercise keep the same PIN?"
      ],
      "controls": [
        "setupPanel",
        "newScenario",
        "returnToExercise",
        "createSession"
      ],
      "priority": true
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
      "text": "Drag blank scope to pan. Range or Ctrl + scroll changes the total displayed range; Centre/Home returns to the origin. Options opens secondary display controls and Start/Run collapses them. Under Options, use Ring spacing and Labels beside Range in the scope display settings. Ring spacing chooses a fixed 5 NM or 10 NM interval repeated throughout that total range. The outer range is marked even when it is not an exact multiple of the interval. At a dense scale, fewer distance labels are printed while the rings remain. Instructor aircraft use a common small glyph. Aircraft labels offers Selected (default), All or Off; Off hides text labels, not aircraft glyphs. Selected-aircraft information is placed away from aircraft and connected by leader lines. Controls hides or restores the left floating Aircraft & radio box containing aircraft controls, homing and readbacks; More controls opens the Aircraft controls drawer. Right-side drawers overlay the desktop scope without resizing it; Close or Escape restores focus to the opening control. The phone arrangement is preserved with sideways scroll tracks for long rows. Ring spacing and aircraft-label settings affect this position only. The instructor’s route / area visibility choices are shared with the controller. Display changes do not change aircraft motion or clearances.",
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
      "title": "Draw or enter airspace boundaries and ATS routes",
      "topics": [
        "suite",
        "procedural"
      ],
      "anchor": "airspace",
      "match": "^(?!.*\\b(?:reporting point coordinates|route coordinate labels|route arrows?|route levels?|odd(?: and)? even)\\b).*\\b(?:polygon|draw|drawing|boundary|boundaries|point to point|set save arp|custom airspace|custom lfa|coordinates)\\b",
      "text": "Pause, then Prepare airspace → Draw on chart. Select Place ARP on preview or Place ARP on radar scope, then click or tap its position. No latitude or longitude is needed for mouse drawing: the ARP dot sets the range-ring centre and D/F station, and routes / areas use local NM. The drawing readiness message explains blockers and shows point count. Add or edit selects Area boundary or ATS route. For an area, name it, choose LFA/P/R/D/CTR and enter lower / upper labels. Click or tap preview points in order, drag a vertex to move it, or use Draw / edit on radar scope. Scope aircraft turns, transmissions, panning and exercise shortcuts are isolated during full-scope drawing and ARP placement. Select a vertex and use Delete selected vertex to remove it. At least three valid area points are required: Close boundary checks the ring and returns to the form, then Save boundary applies it to both desks. Closing alone does not save. Enter coordinates is separate: save the geographic ARP first, then select Latitude, longitude or East NM, north NM and enter one coordinate pair per line; Save boundary validates it. Set / save ARP appears in the coordinate method when that reference needs applying. A mouse-placed ARP does not invent geographic coordinates. Cancel drawing exits the scope editor and keeps completed unsaved points; a cancelled pointer gesture rolls back only that gesture. For an ATS route, draw at least two reporting points in order, then select Finish route. This brings route details into view and focuses ATS route name. Name the route and every reporting point, choose Unidirectional · first → last or Bidirectional · both directions, enter lower / upper route bounds in ft MSL and optional published / instructor level text, then Save route. Unidirectional arrows follow the drawn point order; Bidirectional arrows use both directions along the same geometry. Finish route keeps an unsaved draft; Save route shares the route and its fixes atomically. Coordinate entry uses the same name, direction and level fields before Save route. FL labels remain text and are not converted into numeric limits. Existing routes and areas lists Edit / Remove actions. Changing the feature or starting a New route / boundary confirms discard of unsaved points. Moving an existing ARP confirms that unsaved feature points and its geographic reference will be cleared; saved traffic and chart geometry stay in place. Use the Move handle on the toolbar to drag it, or use arrow keys; Shift + arrows makes small moves and Home or Reset restores its position. Discard unsaved airspace entries appears only when drafts exist and restores saved chart values after confirmation. Back to traffic setup keeps your roster; Create exercise requires chart entries to be applied or discarded.",
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
        "How do I move the boundary drawing toolbar?",
        "How do I draw an ATS route?",
        "How do I enter named route coordinates?",
        "What does Finish route do?",
        "How do I name a route after drawing it?",
        "Can I draw without entering coordinates?"
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
        "boundary-scope-close",
        "airspace-feature-kind",
        "custom-route-form",
        "custom-route-name",
        "custom-route-direction",
        "custom-route-save",
        "custom-route-new",
        "route-drawing-point-names",
        "custom-airspace-features",
        "custom-route-list",
        "drawn-arp-preview",
        "drawn-arp-scope"
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
      "match": "^(?!.*\\b(?:saved airspaces?|airspace library|save (?:only )?airspace|load (?:saved )?airspace|reuse airspace|export airspace|import airspace)\\b)(?!.*\\blog ?(?:out|off)\\b).*(?:\\b(?:template|preset|library|import(?:ing)?|restore (?:the |a |my )?(?:current )?progress|export|(?:save|saved|load|reuse) (?:the |a |an |my |this |current |starting |same )?(?:exercise|setup|set up))\\b|^(?!.*\\b(?:boundary|polygon|arp|drawing|draw)\\b).*\\b(?:save|saved|reuse|re use|preset|preload|pre loaded|template|same (?:exercise|setup|set up)|import|export|library|(?:duplicate|rename) (?:selected|(?:(?:a|the|my) )?(?:exercise|setup|template|preset)))\\b)",
      "text": "Prepare the starting setup before Run. Procedural: Prepare airspace → Save or load → Setup type: Complete exercise (aircraft + chart). This shows the full-exercise library; Airspace only (chart) shows the chart-only library instead. The opening setup page contains only starting traffic. Choose a record under Load saved exercise and press Load; it restores the saved airspace and original traffic paused at 00:00:00 after replacement confirmation. Replacement uses a confirmation on the same screen; Cancel keeps unsaved entries. The four main actions are Save exercise, Load, Import exercise file and Download file. To save a new setup, choose New exercise / choose a saved exercise, enter Exercise name and select Save exercise. Choosing a stored exercise then Save exercise asks before replacing it. Apply unfinished chart changes and create or load the starting exercise before Save exercise. Save the full starting setup before its first Run or +1 minute. After termination, Review → Download exercise setup exports the captured initial aircraft and starting airspace for future use; Import exercise file stores that download, then Load applies it. Older underway exercises without a captured starting setup offer Download current progress instead. Saved airspace in Save or load stores the chart alone and keeps current traffic when loaded. Download file exports the selected saved setup as a portable JSON backup. Rename or remove a saved exercise is a collapsed group containing only Rename selected and Remove selected. Procedural has no separate Save as new or Duplicate action; choose the blank new-exercise option and a new name to save the current setup as a new record. Prepare airspace → Advanced tools → Current progress file (includes records) exports or restores an attempt rather than a reusable starting setup. Restoring this file confirms replacement, retains its elapsed time and records, and opens it paused; it does not require Create exercise again. Normal controller Ready and online audio checks still apply before Run. Import exercise file adds a stored starting setup; Load applies it. New Procedural traffic and template imports allow up to 20 aircraft. Previously stored device exercises and captured starting-setup archives retain 21–24 aircraft for loading, recovery or download. To move an older exercise with more than 20 aircraft to another device, use Download current progress and Restore a saved scenario; a new starting-template import still has the 20-aircraft limit. Instructor QGH/SRE/SRA: expand Saved exercises under the starting traffic form. The main actions are Save, Load, Import exercise file and Download. Load fills starting traffic; Create session opens a new exercise. Save updates the selected exercise after confirmation; choose Choose an exercise and enter a new name to save a new setup. Download exports the selected setup. Rename or remove folds Rename selected and Remove selected away until needed. Traffic setup retains an existing attempt; Return to exercise restores it without applying setup edits. Create session explicitly confirms replacement of the current exercise and PIN. QGH imports create an independent entry with a unique name. Legacy QGH setups above 2 aircraft remain stored and exportable but cannot Load/Import. Restart after review retries the initial roster. Libraries keep starting setups on this browser/device, separate from live attempt recovery; new live sessions have independent PINs/admissions and saved setups contain no room tokens.",
      "questions": [
        "How do I reuse an exercise?",
        "Can I test two students on the same setup?",
        "How do I export a saved exercise?",
        "Can I rename a saved exercise?",
        "How do I save the current setup under a new name?",
        "How do I save a QGH setup under a new name?",
        "Where can I load a saved exercise?",
        "Can I Run after importing a current progress file?",
        "How do I restore current progress?"
      ],
      "controls": [
        "scenario-library",
        "template-name",
        "template-select",
        "template-save",
        "template-load",
        "template-download",
        "template-import",
        "template-rename",
        "prepare-save-load",
        "prepare-save-kind",
        "prepare-exercise-library",
        "prepare-advanced",
        "template-manage",
        "import",
        "export",
        "qghSavedExercises",
        "savedExercise",
        "savedExerciseName",
        "saveExercisePreset",
        "loadExercisePreset",
        "importExercisePreset",
        "exportExercisePreset",
        "renameExercisePreset",
        "removeExercisePreset"
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
        "training-centre"
      ],
      "selector": "#suiteTutorialLaunch",
      "title": "Load the online tutorial",
      "entry": "youtube-tutorial"
    },
    {
      "pages": [
        "training-centre"
      ],
      "selector": "#suiteTutorialChapter",
      "title": "Choose a chapter",
      "entry": "youtube-tutorial"
    },
    {
      "pages": [
        "training-centre"
      ],
      "selector": "#suiteTutorialStop",
      "title": "Stop the video",
      "entry": "youtube-tutorial"
    },
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
      "title": "Set up starting traffic",
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
      "title": "Prepare airspace separately",
      "entry": "public-lfa-samples"
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
      "selector": "#custom-arp-form",
      "title": "Geographic ARP · save at the local origin",
      "entry": "arp-upload"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#drawn-arp-preview",
      "title": "Place the ARP dot with your mouse",
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
      "title": "Draw or enter routes and areas",
      "entry": "custom-polygons"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#prepare-save-load",
      "title": "Save or load · chart only or the full starting exercise",
      "entry": "saved-exercises"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#prepare-save-kind",
      "title": "Setup type · show one library at a time",
      "entry": "saved-exercises"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#import",
      "title": "Restore current progress · resume without creating traffic again",
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
      "selector": "#setupPanel",
      "title": "Starting traffic with optional preparation folded below",
      "entry": "instructor-start"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#setupEnvironment",
      "title": "Prepare airspace & radar when needed",
      "entry": "instructor-start"
    },
    {
      "pages": [
        "instructor"
      ],
      "selector": "#returnToExercise",
      "title": "Return to the same QGH/SRE/SRA attempt",
      "entry": "instructor-traffic-return"
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
        "procedural"
      ],
      "selector": "#review-download-setup",
      "title": "Download starting aircraft and airspace before leaving",
      "entry": "review-controls"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#review-download-progress",
      "title": "Keep this attempt and its records",
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
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#setup",
      "title": "Starting traffic roster",
      "entry": "roster-mobile"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#traffic-return-exercise",
      "title": "Return to the current scope without replacing traffic",
      "entry": "traffic-return-exercise"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#prepare-airspace-library",
      "title": "Saved airspace · chart only",
      "entry": "saved-airspaces"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#prepare-exercise-library",
      "title": "Saved exercise · starting aircraft and chart",
      "entry": "saved-exercises"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#airspace-feature-kind",
      "title": "Choose area boundary or ATS route",
      "entry": "custom-polygons"
    },
    {
      "pages": [
        "procedural"
      ],
      "selector": "#custom-route-form",
      "title": "Finish route · name, direction, levels and Save",
      "entry": "route-chart-details"
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
