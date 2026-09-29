(function () {
  'use strict';
  const knowledge = typeof module === 'object' && module.exports ? require('./guide-knowledge.js') : globalThis.ATCGuideKnowledge;
  const searchAPI = typeof module === 'object' && module.exports ? require('./guide-search.js') : globalThis.ATCGuideSearch;
  const searchGuides = searchAPI?.createIndex(knowledge?.entries || []);
  const scriptURL = typeof document === 'object' ? document.currentScript?.src : null;

  // Curated from procedural-guide.html, instructor-led/training-guide.html and
  // the published QGH Training Centre. No questions leave this page.
  const destinations = {
    individual: { label: 'Open individual QGH', href: '../qgh.html' },
    instructor: { label: 'Open instructor-led QGH', href: '../instructor-led/instructor.html#qgh' },
    sra: { label: 'Open SRA instructor beta', href: '../instructor-led/instructor.html#sra' },
    par: { label: 'Open PAR instructor beta', href: '../instructor-led/instructor.html#par' },
    procedural: { label: 'Open Procedural Studio', href: 'procedural.html' },
  };
  const guides = {
    individual: { label: 'Individual QGH Training Centre', href: '../training-centre.html' },
    instructor: { label: 'Instructor-led QGH / ATSS guide', href: '../instructor-led/training-guide.html' },
    procedural: { label: 'Procedural Studio guide', href: 'procedural-guide.html' },
  };
  const allGuides = Object.values(guides);
  const topics = ['suite', 'procedural', 'qgh', 'qgh-individual', 'qgh-instructor', 'sra', 'par'];
  const sections = (guide, anchor) => ({ label: guide.label, href: guide.href + (anchor ? '#' + anchor : '') });

  function normalize(input) {
    return String(input || '').slice(0, 1000).normalize('NFKC').toLowerCase()
      .replace(/\b(?:trun|tuen)\b/g, 'turn').replace(/\b(?:rigth|rihgt)\b/g, 'right').replace(/\bsimulater\b/g, 'simulator')
      .replace(/d\s*\/\s*f/g, 'df').replace(/u\s*\/\s*s/g, 'unserviceable')
      .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }

  function matchGuideQuestion(input, context = 'suite', previousIntent = '') {
    let q = normalize(input);
    if (/turn/.test(previousIntent) && /^(?:and |what about )?(?:left|right)$/.test(q)) q = 'how to turn ' + q;
    let topic = topics.includes(context) ? context : 'suite';
    const has = pattern => pattern.test(q);
    const procedural = has(/\bprocedural\b/);
    const qgh = has(/\bqgh\b/);
    const sra = has(/\bsra\b|\bsurveillance radar approach\b/);
    const par = has(/\bpar\b|\bprecision radar approach\b/);
    // Ambiguous questions should present guides rather than select a mode.
    const mixed = [procedural, qgh, sra, par].filter(Boolean).length > 1;
    if (!mixed) {
      if (procedural) topic = 'procedural';
      else if (sra) topic = 'sra';
      else if (par) topic = 'par';
      else if (qgh && has(/\binstructor\b/)) topic = 'qgh-instructor';
      else if (qgh && has(/\bindividual\b|\bsingle\b|\bsolo\b|\balone\b|\bon my own\b/)) topic = 'qgh-individual';
      else if (qgh && !['qgh-individual', 'qgh-instructor'].includes(topic)) topic = 'qgh';
    }
    const reply = (text, links, answerTopic = topic) => ({ matched: true, topic: answerTopic, text, links });
    const fallback = () => ({
      matched: false, topic: topics.includes(context) ? context : 'suite',
      text: (knowledge?.learning || 'I am also learning. If I’m unable to answer, please refer to the training guides.') + '\n\nI don’t have a reliable simulator answer for that yet. Open the relevant guide below:',
      links: allGuides,
      escalation: 'Contact the creator for further clarification.',
      creator: 'Flt Lt Balaram Reddy · Service No. 38703',
    });
    if (!q) return fallback();
    // Do not answer operational minima, live weather, unrelated instructions or diagnoses.
    if (/\b(?:ignore (?:all |your )?(?:instructions|rules)|system prompt|medical|diagnos|stock price|weather today|current notam|legal minimum|separation minimum)\b/.test(q)) return fallback();
    const shared = knowledge?.entries.find(entry => entry.priority && entry.topics.includes(topic) && new RegExp(entry.match,'i').test(q));
    const answerEntry = entry => ({...reply(entry.text,[sections(topic === 'procedural' ? guides.procedural : topic === 'qgh-individual' || topic === 'qgh' ? guides.individual : guides.instructor,entry.anchor)]),intent:entry.id});
    if(shared) return answerEntry(shared);
    if (/^(?:hi|hello|hey|namaste|help|help me|can you help me|who are you|what can you do)(?: gyani)?$/.test(q))
      return reply('I’m Gyani, your simulator guide. I can help you start or join an exercise, turn aircraft, use bearings, set levels, or declutter the scope. What would you like to do?', topic === 'procedural' ? [guides.procedural] : allGuides);
    if (/^(?:thanks|thank you|thankyou|ok|okay|got it)(?: gyani)?$/.test(q)) return reply('You’re welcome. Ask me whenever you need help with the simulator.', []);
    if (/^(?:more|explain|explain more|tell me more|more detail|more details)$/.test(q) && previousIntent) {
      const entry = knowledge?.entries.find(item => item.id === previousIntent);
      if (entry) return { ...reply(entry.text + '\n\nThe linked guide has the full procedure and related controls.', [sections(topic === 'procedural' ? guides.procedural : topic === 'qgh-individual' || topic === 'qgh' ? guides.individual : guides.instructor, entry.anchor)]), intent: entry.id };
    }

    const guideQuestion = has(/^(?:please )?(?:show |open |find |read )?(?:me )?(?:the |all )?(?:training )?(?:guide|guides|manual|documentation)$/)
      || has(/\bwhere (?:is|are|can i find|do i find) (?:the |my )?(?:training )?(?:guide|guides|manual)\b/)
      || has(/^(?:where is|open|show me) (?:the )?(?:procedural|qgh|sra|par|instructor led|individual)(?: studio)? (?:training )?guide$/);
    if (guideQuestion) {
      const chosen = mixed || topic === 'suite' ? allGuides : topic === 'procedural' ? [guides.procedural] : topic === 'qgh-individual' ? [guides.individual] : topic === 'qgh' ? [guides.individual, guides.instructor] : [guides.instructor];
      return reply('Open the matching training guide below. It includes setup, controls and recovery instructions.', chosen);
    }
    if (mixed) return fallback();

    const start = has(/^(?:please )?(?:how (?:do|can) (?:i|we)|how to|help me|where (?:do|can) i) (?:start|begin|set up)(?: (?:a|an|the|my|new|first|local|shared|exercise|session|training|simulator))*(?: please)?$/)
      || has(/^(?:what next|what do i do next|getting started|first exercise|create (?:a |the )?session)$/);
    const join = has(/\bhow (?:do|can) (?:i|we|a student|the student) join\b/)
      || has(/\b(?:join|admit) (?:a |the )?(?:student|controller|session|exercise)\b/)
      || has(/\b(?:student|controller) (?:join|admission|ready)|\b(?:session|six digit|6 digit) pin\b/)
      || has(/\b(?:enter|share|find|expired|invalid|wrong|current) (?:the |my |a )?pin\b|\bpin (?:expired|invalid|not working)\b/)
      || has(/\bpress ready\b|\b(?:where|what) (?:is|s) (?:the |my )?pin\b/);
    const choose = has(/\bwhich (?:simulator|exercise|mode)|\bchoose (?:a |the )?simulator\b/);
    const namedModule = procedural || qgh || sra || par || has(/\batss\b/);
    const navigation = (namedModule && has(/\b(?:open|launch|try|practise|practice|choose|start|use|set up|help me with|take me to)\b/))
      || /^(?:(?:what|where) is (?:the )?)?(?:procedural(?: studio)?|qgh(?: individual| instructor(?: led)?)?|individual qgh|instructor led qgh|sra|par|atss)$/.test(q);
    const bearing = has(/\b(?:df|bearing|homing) (?:hold|display|timing|duration)|\b(?:frozen|released) bearing\b/)
      || has(/\bhow long\b.*\b(?:df|bearing|homing)\b|\b(?:df|bearing|homing)\b.*\bhow long\b/)
      || has(/\b(?:no|missing|blank) (?:df|bearing|homing)|\b(?:qdm|qte) (?:mean|meaning|display)\b/);
    const audio = has(/\b(?:pilot|local) (?:audio|voice)|\b(?:no|muted|missing) (?:audio|sound)|\bvoice (?:control|commands|recognition)|\bmicrophone\b/);
    const timing = has(/\b(?:flight|exercise|simulation) (?:clock|speed)|\b(?:clock|time) (?:speed|multiplier)|\b(?:5x|1x|10x|real time)\b/);
    const pressure = has(/\bqnh\b|\btransition (?:altitude|level)\b|\b(?:ta|tl)\b/);
    const approachReference = has(/\b(?:3|three) (?:degree|degrees|deg|approach|descent|guide|reference|altitudes?)\b|\bsra (?:distances|heights|altitudes)\b|\b(?:threshold crossing height|crossing height|tch|aerodrome elevation|descent (?:guide|cues|altitudes?)|approach (?:reference|marks|view)|height aal|altitude msl)\b/);
    const pictureControls = has(/\b(?:pan|zoom|range rings|scope controls|scope layers|local picture|bearing range ruler|ruler)\b/);
    const routeOverview = has(/\b(?:route overview|local view|250 nm|long range (?:routes?|charts?)|enr (?:3|6)|official (?:charts?|chart links)|aip (?:routes|charts))\b/);

    if (topic === 'suite' && (start || join || choose || navigation)) {
      return reply('Choose QGH Individual for individual practice, instructor-led QGH for a shared direction-finding exercise, SRA or PAR for the radar-approach beta, or Procedural Studio for Area, Approach and Aerodrome traffic. Open a branch, then ask how to start or join it.', Object.values(destinations));
    }
    if (topic === 'qgh' && (start || join || navigation || bearing || audio || timing)) {
      return reply('Which QGH workspace are you using? Individual QGH and instructor-led QGH have separate setup and controls. Choose one below, or type “individual QGH” or “instructor-led QGH”.', [destinations.individual, destinations.instructor, guides.individual, guides.instructor]);
    }

    if (topic === 'procedural') {
      const directIds = ['stop-turn', 'sweep', 'roster-mobile', 'session-isolation'];
      const direct = knowledge?.entries.find(entry => directIds.includes(entry.id) && new RegExp(entry.match, 'i').test(q));
      if (direct) return { ...reply(direct.text, [sections(guides.procedural, direct.anchor)]), intent: direct.id };
      if (approachReference) return reply('Open 3° approach for the 10–0 NM table. Approach view frames the final; Show approach marks adds local cues. Distances start at the synthetic runway threshold, not the VOR. Altitude MSL = aerodrome elevation + threshold crossing height + distance NM × 6076.12 × tan(3°), rounded to 10 ft. The instructor sets these references in Edit airspace → Aerodrome & environment. This geometric guide does not command descent or assess obstacle clearance.', [sections(guides.procedural, 'approach-reference')]);
      if (pressure) return reply('The instructor sets QNH, transition altitude (TA), transition level (TL), elevation and threshold crossing height in Edit airspace → Aerodrome & environment. Both desks show QNH/TA/TL; zero TA/TL means unset. These settings are shared; a student’s local scope controls do not change them. Procedural altitude clearances retain the documented QNH/Standard training conversion.', [sections(guides.procedural, 'approach-reference'), sections(guides.procedural, 'pilot')]);
      if (routeOverview) return reply('The selected base loads published route sections crossing a 250 NM region, retaining full source endpoints outside that region. Route overview fits the visible loaded network; Local view returns to the aerodrome. These are local view controls, available on both desks. Chart briefing links official AAI ENR 6 charts with their edition dates, ENR 3 references and published leg limits. This regional selection is not the complete national network or live NOTAM status.', [sections(guides.procedural, 'airspace')]);
      if (pictureControls) return reply('Both procedural desks can drag or scroll to pan, use Ctrl + scroll or +/− to zoom, and use Centre station/Home or Pan arrows. Declutter → Scope detail & tools controls local rings, labels and approach marks. Enable Bearing / range ruler there, then click two map points for true bearing and NM. The instructor’s route and boundary selection is shared; pan, zoom and the ruler affect only your desk. The student still receives no continuous aircraft targets or hidden truth.', [sections(guides.procedural, 'scope'), sections(guides.procedural, 'student')]);
      if (join) return reply('In Procedural Studio, the instructor opens Session and shares the six-digit PIN. The student opens the student tab, enters their name and PIN, and requests to join. The instructor selects Admit; the student presses Ready. The instructor can then select Run. Choose This device for two tabs on one computer. When Online room is enabled, select it on both devices and open this same site on the controller device. Keep the instructor tab open.', [sections(guides.procedural, 'start')]);
      if (start || navigation) return reply('Open instructor setup, edit the 1–24 aircraft roster and set the title, runway heading and QNH. Configure airspace if needed, then Create session. The exercise opens paused. Open Session to share the PIN and admit a controller, then select Run when they are Ready.', [destinations.procedural, sections(guides.procedural, 'start')]);
      if (has(/\breopen (?:an? |the |my )?(?:ended )?(?:exercise|session)|\b(?:end|ended|pause|resume) (?:the |my )?exercise|\bexercise (?:ended|paused)|\b(?:nothing moves|traffic (?:stopped|not moving))\b|\brun (?:and |or )?pause buttons?\b|\b(?:run|pause) button\b/)
        || has(/^(?:how (?:do|can) i )?(?:pause|resume|run|end|reopen)(?: (?:the |my )?(?:exercise|session))?$/)) return reply('Pause is an ordinary break. End exercise stops traffic and clears radio for review. Reopen exercise keeps the same aircraft, elapsed time, strips, reports and event history, paused; select Run to continue. If Run is waiting for a controller, they must press Ready or the instructor can remove them in Session.', [sections(guides.procedural, 'review')]);
      if (bearing) return reply('Procedural Studio shows D/F during a pilot transmission. D/F transmission only gives a neutral acknowledgement without a heading or position report. After release, new setups hold the frozen bearing for 10 seconds; Aircraft controls → Bearing display accepts 2–30 seconds. Older saved scenarios without the setting retain 2 seconds.', [sections(guides.procedural, 'pilot'), sections(guides.procedural, 'student')]);
      if (audio) return reply('Procedural Studio uses structured controls and typed controller calls, with no microphone recognition or voice control. Local pilot voice can use an installed English voice. It starts off; captions and D/F remain available without audio.', [sections(guides.procedural, 'pilot')]);
      if (has(/\b(?:aircraft|manual|flight) controls|\b(?:compact|small|short) (?:screen|display)|\b(?:where|missing)\b.*\b(?:controls|buttons)\b/)) return reply('On larger screens, manual controls sit around the scope. On compact or short screens, they move into the scrollable Aircraft controls drawer. The homing instrument stays outside the plot. While running, the header and help captions are hidden; Pause restores them.', [sections(guides.procedural, 'scope')]);
      if (has(/\bdeclutter|\b(?:show|hide|select|filter)\b.*\b(?:routes?|boundaries|airspace)\b/)) return reply('Open Declutter. The instructor can search by route name or reporting fix, select individual routes, or use Show/Hide all, Show/Hide matches and Only matches. Airspace boundaries has P/R/D/LFA/CTR filters. Selections update both consoles and survive reconnects; students can inspect them but cannot change them. Hiding chart items does not close routes or change aircraft instructions. Scope detail & tools holds local labels, rings and the ruler.', [sections(guides.procedural, 'scope')]);
      if (has(/\b(?:upload|calibrate|show|hide) (?:a |the )?(?:map|chart)|\bconfigure airspace|\b(?:aip|jeppesen) (?:chart|route)|\b(?:scope|map) layers\b/)) return reply('Use Configure airspace during setup or Edit airspace at the desk. Select a dated Indian AIP preset, enter chart fixes/routes, or upload and manually calibrate a PNG/JPEG. Raster maps and boundary names start off; route labels are spaced and fix names appear at local zoom. Use Declutter for detail. Chart briefing holds source links; published airspace is a dated snapshot, not live NOTAM activation.', [sections(guides.procedural, 'airspace')]);
      if (has(/\b(?:how many|max(?:imum)?|number of) aircraft|\b(?:aircraft|traffic) (?:count|roster)|\b(?:add|generate) (?:aircraft|traffic)\b/)) return reply('Traffic setup supports 1–24 aircraft, including aircraft scheduled to appear later. Each row has independent bearing, range, heading, altitude, speed and performance settings. Reducing the count keeps hidden row edits for later. Create session applies the visible roster together.', [sections(guides.procedural, 'traffic')]);
      if (has(/\b(?:student scope|student display)\b.*\b(?:aircraft|targets|empty|blank)|\b(?:no|missing) aircraft\b/)) return reply('The student procedural scope intentionally has no continuous aircraft targets or hidden truth tracks. It shows shared static airspace and a bearing ray during pilot transmissions. Explicit position reports are observations at their recorded time.', [sections(guides.procedural, 'student')]);
      if (has(/\b(?:doc 4444|separation worksheet|separation method|separation minimum|automatic compliance)\b/)) return reply('Use the Separation worksheet to record the applicable document, prerequisites, minimum and evidence for each pair. The simulator provides training measurements and instructor assessment; it does not automatically certify every Doc 4444 provision. Use the applicable source and local authorization.', [sections(guides.procedural, 'separation')]);
    }

    if (['qgh-instructor', 'sra', 'par'].includes(topic)) {
      const destination = topic === 'qgh-instructor' ? destinations.instructor : destinations[topic];
      if (approachReference) return reply('In the radar beta, the synthetic threshold and station share the approach origin. SRA marks show threshold NM and altitude MSL = field elevation + threshold crossing height + distance NM × 6076.12 × tan(3°), rounded to 10 ft. The instructor sets elevation and crossing height in Pressure & approach references. PAR retains them through transfer and shows height above aerodrome. These are geometric aids; they do not command descent or assess obstacle clearance.', [sections(guides.instructor, 'references')]);
      if (pressure) return reply('Set QNH, transition altitude, transition level, field elevation and crossing height in the instructor setup’s Pressure & approach references. Both positions show QNH/TA/TL; zero TA/TL means unset. In this beta, QNH is a shared briefing reference and aircraft levels remain modelled in ft MSL. TA/TL do not trigger automatic pressure changes or calculate local minima.', [sections(guides.instructor, 'references')]);
      if (pictureControls) return reply('On the Surveillance/SRA student scope, drag or scroll to pan; Ctrl + scroll, +/− or Range zoom. Centre station/Home recentres; arrow buttons or keyboard arrows pan while the scope is focused. Scope toggles rings, SSR labels and instructor-provided aids locally. Primary returns remain anonymous. PAR keeps separate range/history controls; QGH has its homing controls. These controls do not change the instructor picture.', [sections(guides.instructor, 'display')]);
      if (join) return reply('Choose the same Exercise connection on both positions. This device / offline requires one PC and the same browser profile; two extended screens are recommended. Online room connects different PCs/devices with internet on both. Create Session, enter its six-digit PIN on Controller Position, Admit, Ready, then Start. Keep the instructor window open.', [sections(guides.instructor, 'start')]);
      if (bearing && topic === 'qgh-instructor') return reply('Instructor-led QGH uses a default 5× flight clock. D/F appears during the pilot transmission and freezes for two real seconds at release. Selecting another aircraft does not change the transmitting source. QDM is magnetic homing; QTE is true bearing.', [sections(guides.instructor, 'modes'), sections(guides.instructor, 'display')]);
      if (audio) return reply('The instructor-led QGH / ATSS beta uses buttons and keyboard, not voice recognition. Optional pilot audio uses an installed device voice and starts muted. Enable it on the student position; captions and simulated transmissions still work when sound is unavailable.', [sections(guides.instructor, 'start')]);
      if (timing) return reply(topic === 'qgh-instructor' ? 'Instructor-led QGH defaults to a 5× flight clock. Its released D/F indication holds for two real seconds.' : 'SRA and PAR default to real-time 1×. Optional 5× and 10× accelerate flight and the sensor clock together. Advance One Minute advances every aircraft, not only the selected one.', [sections(guides.instructor, 'modes')]);
      if (has(/\b(?:typed commands|command bar|type (?:a |the )?command|keyboard controls)\b/)) return reply('Select the aircraft, type an accepted command into Command Bar, then press Enter or Execute. This is an exact grammar, not free-form radio speech or callsign addressing. HELP or ? opens the quick reference. Invalid or unavailable commands make no change.', [sections(guides.instructor, 'commands')]);
      if (has(/\b(?:reconnect|refresh) (?:the |my )?(?:student|instructor)|\b(?:lost link|simulation stalled|picture stale|student seat)\b/)) return reply('Keep the instructor window open: refreshing or closing it ends the local beta session. Refreshing the same student window can restore the admitted seat; audio restarts muted. Use Reconnect for a lost link. If necessary, the instructor can Release Student Seat and admit a new window.', [sections(guides.instructor, 'recovery')]);
      if (start || navigation || (topic === 'par' && has(/\btransfer (?:to )?par\b/))) {
        const mode = topic === 'qgh-instructor' ? 'Choose Normal QGH or U/S Compass, then check the aircraft and runway settings.' : topic === 'sra' ? 'Choose SRA and check the aircraft, runway/final track and sensor settings. The centreline and 3° descent cues are reference aids; the instructor commands descent.' : 'Choose PAR for direct PAR setup. For a vectoring-to-PAR exercise, start in Surveillance, vector inbound, then use Transfer PAR when the configured gate permits it, normally at or within 10 NM inbound.';
        return reply(mode + ' Set 1–24 aircraft, create the session, admit the student display and wait for Ready before Start.', [destination, sections(guides.instructor, 'start'), sections(guides.instructor, 'modes')]);
      }
    }

    if (topic === 'qgh-individual') {
      if (join) return reply('Individual QGH opens the Single practice console. For a shared session with instructor admission and a student PIN, choose instructor-led QGH and follow its separate setup guide.', [destinations.individual, destinations.instructor, sections(guides.instructor, 'start')]);
      if (bearing) return reply('In individual QGH, QDM selects magnetic homing and QTE selects true bearing. D/F follows the transmitting aircraft, holds its last indication for two seconds on release, then disappears. Muted audio still produces simulated transmissions.', [sections(guides.individual, 'controls')]);
      if (audio) return reply('Individual QGH has its own voice controls and preflight audio guidance. The Training Centre explains PTT, Continuous Listening and pilot replies. Manual controls remain available. Follow its headphone check before enabling audible replies.', [sections(guides.individual, 'voice'), sections(guides.individual, 'setup')]);
      if (start || navigation) return reply('Open Single QGH. Choose Normal QGH or U/S Compass, then set tracks, aircraft performance and initial distance. Check the level and airfield settings before starting. The individual Training Centre explains the console and accepted radio calls.', [destinations.individual, sections(guides.individual, 'quick-start')]);
    }
    const candidates = (knowledge?.entries || []).filter(entry => entry.topics.includes(topic) && new RegExp(entry.match, 'i').test(q));
    const entry = candidates.find(item => item.id === 'stop-turn') || candidates[0];
    if (entry) return { ...reply(entry.text, [sections(topic === 'procedural' ? guides.procedural : topic === 'qgh-individual' || topic === 'qgh' ? guides.individual : guides.instructor, entry.anchor)]), intent: entry.id };
    const retrieved = searchGuides?.(q,topic);
    if(retrieved) return answerEntry(retrieved);
    if (topic === 'suite' && /\b(?:turn|left|right|controls)\b/.test(q)) return reply('For Procedural, select the aircraft and use the left/right arrow buttons. On a mouse, double left-click turns left and double right-click turns right; Stop turn levels the wings. In QGH the controls depend on Normal or U/S Compass. Which simulator are you using?', [destinations.procedural, destinations.individual, destinations.instructor]);
    return fallback();
  }

  function topicForPage(path, hash = '') {
    if (/\/procedural-beta(?:\/|$)|\/procedural(?:-guide)?\.html$/.test(path)) return 'procedural';
    if (path.includes('/instructor-led/')) return hash === '#sra' ? 'sra' : hash === '#par' ? 'par' : 'qgh-instructor';
    if (/\/(?:qgh|qgh-individual|single|tactical|training-centre|user-guide)\.html$/.test(path)) return 'qgh-individual';
    return 'suite';
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = { matchGuideQuestion, topicForPage };
    return;
  }
  if (typeof document === 'undefined') return;

  function mount() {
    if (!document.body || document.getElementById('suite-guide-chat')) return;
    const make = (tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };
    let topic = topicForPage(location.pathname, location.hash);
    let previousIntent = '';
    let returnFocus = null;
    const root = make('div', 'suite-guide-chat'); root.id = 'suite-guide-chat';
    const launcher = make('button', 'suite-guide-chat__launcher');
    const fox = make('img', 'suite-guide-chat__fox'); fox.src = new URL('gyani-fox.png', scriptURL || location.href).href; fox.alt = ''; fox.width = 48; fox.height = 48; fox.decoding = 'async';
    const invitation = make('span', 'suite-guide-chat__invitation', 'Gyani · Ask me if you need help');
    launcher.append(fox, invitation); launcher.setAttribute('aria-label', 'Ask Gyani for simulator help');
    launcher.type = 'button'; launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-controls', 'suite-guide-chat-panel'); launcher.setAttribute('aria-expanded', 'false');
    const panel = make('section', 'suite-guide-chat__panel'); panel.id = 'suite-guide-chat-panel'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'suite-guide-chat-title');
    const header = make('header', 'suite-guide-chat__header');
    const heading = make('div');
    const title = make('h2', '', 'Gyani'); title.id = 'suite-guide-chat-title';
    heading.append(title, make('p', '', 'Your simulator guide'));
    const close = make('button', 'suite-guide-chat__close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Collapse Gyani');
    header.append(fox.cloneNode(), heading, close);
    const history = make('div', 'suite-guide-chat__history'); history.setAttribute('role', 'log'); history.setAttribute('aria-live', 'polite'); history.setAttribute('aria-relevant', 'additions'); history.setAttribute('aria-label', 'Conversation with Gyani');
    const suggestions = make('div', 'suite-guide-chat__suggestions'); suggestions.setAttribute('aria-label', 'Suggested questions');
    const quickLinks = make('nav', 'suite-guide-chat__guides'); quickLinks.setAttribute('aria-label', 'All training guides');
    const form = make('form', 'suite-guide-chat__composer');
    const label = make('label', '', 'Your question'); label.htmlFor = 'suite-guide-chat-input';
    const input = make('textarea'); input.id = 'suite-guide-chat-input'; input.rows = 2; input.maxLength = 1000; input.placeholder = 'Ask about setup, joining or controls…';
    const composeRow = make('div', 'suite-guide-chat__compose-row');
    const hint = make('small', '', 'Local guide answers · no messages sent');
    const send = make('button', 'suite-guide-chat__send', 'Send'); send.type = 'submit'; send.disabled = true;
    composeRow.append(hint, send); form.append(label, input, composeRow);
    panel.append(header, history, suggestions, quickLinks, form); root.append(launcher, panel); document.body.append(root);

    function linkNode(link) {
      const a = make('a', '', link.label); a.href = new URL(link.href, scriptURL || location.href).href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', link.label + ' (opens in a new tab)'); return a;
    }
    for (const link of allGuides) quickLinks.append(linkNode(link));
    function addMessage(kind, text, answer) {
      const item = make('article', 'suite-guide-chat__message suite-guide-chat__message--' + kind);
      item.append(make('span', 'suite-guide-chat__speaker', kind === 'user' ? 'You' : 'Gyani'), make('p', '', text));
      if (answer?.links?.length) {
        const links = make('div', 'suite-guide-chat__answer-links');
        for (const link of answer.links) links.append(linkNode(link));
        item.append(links);
      }
      if (answer?.escalation) item.append(make('p', 'suite-guide-chat__escalation', answer.escalation), make('p', 'suite-guide-chat__creator', answer.creator));
      history.append(item);
      while (history.children.length > 25) history.firstElementChild.remove();
      history.scrollTop = history.scrollHeight;
    }
    function setSuggestions() {
      suggestions.replaceChildren();
      const questions = topic === 'procedural' ? ['How to turn right?', 'How do I join?', 'How do I set radar RPM?'] : topic === 'suite' || topic === 'qgh' ? ['Which simulator should I choose?', 'How do I start individual QGH?', 'How do I start SRA?'] : ['What next?', 'How do I join?', 'Where is the guide?'];
      for (const question of questions) {
        const button = make('button', '', question); button.type = 'button';
        button.addEventListener('click', () => { input.value = question; sendQuestion(); }); suggestions.append(button);
      }
    }
    const exerciseState = document.getElementById('exerciseState') || document.getElementById('studentExerciseState');
    const activeExercise = () => (document.body.classList.contains('desk-open') && document.body.classList.contains('exercise-running')) || exerciseState?.textContent.trim() === 'RUNNING' || !!document.querySelector('#console.active, #tConsole.active');
    function closePanel(restoreFocus = true) {
      const heldFocus = panel.contains(document.activeElement);
      panel.hidden = true; launcher.hidden = false; launcher.setAttribute('aria-expanded', 'false');
      if (restoreFocus && returnFocus?.isConnected && !activeExercise()) returnFocus.focus();
      else if (heldFocus && activeExercise()) document.getElementById('scope')?.focus({ preventScroll: true });
    }
    function sendQuestion() {
      if (activeExercise()) { closePanel(false); return; }
      const question = input.value.trim().slice(0, 1000); if (!question) return;
      addMessage('user', question);
      const answer = matchGuideQuestion(question, topic, previousIntent); topic = answer.topic; previousIntent = answer.intent || '';
      addMessage('assistant', answer.text, answer); input.value = ''; send.disabled = true; setSuggestions(); input.focus();
    }
    launcher.addEventListener('click', () => {
      if (activeExercise()) return;
      returnFocus = document.activeElement; panel.hidden = false; launcher.hidden = true;
      launcher.setAttribute('aria-expanded', 'true'); input.focus(); history.scrollTop = history.scrollHeight;
    });
    close.addEventListener('click', () => closePanel());
    input.addEventListener('input', () => { send.disabled = !input.value.trim(); });
    form.addEventListener('submit', event => { event.preventDefault(); sendQuestion(); });
    panel.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); closePanel(); }
      else if (event.target === input && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendQuestion(); }
    });
    function syncAvailability() {
      const destination = document.body.classList.contains('desk-open')
        ? document.getElementById('edge-actions')
        : document.querySelector('.topbar nav, .suite-header-left, .entry-program-tabs, .header-links, .header-nav') || document.body;
      if (root.parentElement !== destination) destination.append(root);
      root.classList.toggle('suite-guide-chat--desk', document.body.classList.contains('desk-open'));
      root.hidden = activeExercise();
      if (root.hidden) closePanel(false);
    }
    new MutationObserver(syncAvailability).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    for (const console of document.querySelectorAll('#console, #tConsole')) {
      new MutationObserver(syncAvailability).observe(console, { attributes: true, attributeFilter: ['class'] });
    }
    if (exerciseState) new MutationObserver(syncAvailability).observe(exerciseState, { childList: true, characterData: true, subtree: true });
    function fitKeyboard() {
      const viewport = window.visualViewport;
      if (viewport) { panel.style.setProperty('--gyani-height', `${Math.max(240, viewport.height - 16)}px`); panel.style.top = `${viewport.offsetTop + 8}px`; }
    }
    window.visualViewport?.addEventListener('resize', fitKeyboard);
    window.visualViewport?.addEventListener('scroll', fitKeyboard);
    fitKeyboard();
    addMessage('assistant', 'I’m Gyani, your simulator guide. Ask me how to turn, join, transmit or use the scope.\n\n' + knowledge.learning);
    setSuggestions();
    syncAvailability();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
