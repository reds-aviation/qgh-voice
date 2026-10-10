(function () {
  'use strict';
  const knowledge = typeof module === 'object' && module.exports ? require('./guide-knowledge.js') : globalThis.ATCGuideKnowledge;
  const searchAPI = typeof module === 'object' && module.exports ? require('./guide-search.js') : globalThis.ATCGuideSearch;
  const searchGuides = searchAPI?.createIndex(knowledge?.entries || []);
  const scriptURL = typeof document === 'object' ? document.currentScript?.src : null;

  // All operational answers come from the same release knowledge as the handbook.
  const destinations = {
    individual: {label:'Open Single QGH',href:'../qgh.html'},
    instructor: {label:'Open Instructor QGH + SRA',href:'../instructor-led/'},
    procedural: {label:'Open Procedural',href:'procedural.html'},
  };
  const commonGuide = {label:'Common suite training guide',href:'../user-guide.html'};
  const allGuides = [commonGuide];
  const topics = ['suite','procedural','qgh','qgh-individual','qgh-instructor','sra','par'];
  const guideLink = anchor => ({label:commonGuide.label,href:commonGuide.href+(anchor?'#'+anchor:'')});
  function normalize(input) {
    return String(input||'').slice(0,1000).normalize('NFKC').toLowerCase()
      .replace(/\b(?:trun|tuen)\b/g,'turn').replace(/\b(?:rigth|rihgt)\b/g,'right')
      .replace(/\bsimulater\b/g,'simulator').replace(/d\s*\/\s*f/g,'df')
      .replace(/u\s*\/\s*s/g,'unserviceable').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }
  function matchGuideQuestion(input,context='suite',previousIntent='') {
    let q=normalize(input),topic=topics.includes(context)?context:'suite';
    // Old PAR bookmarks stay understandable without recommending a retired exercise.
    if(/\bpar\b|precision radar approach/.test(q))return {matched:true,topic:'par',intent:'suite-choice',text:'PAR is deferred and is not available in this release. Use QGH, SRE/vectoring, SRA or Procedural.',links:[guideLink('start')]};
    if(topic==='par')topic='sra';
    if(/turn/.test(previousIntent)&&/^(?:and |what about )?(?:left|right)$/.test(q))q='how to turn '+q;
    const explicit={procedural:/\bprocedural\b/.test(q),individual:/\b(?:individual|single|solo|tactical)\b/.test(q)&&/\bqgh\b/.test(q),instructor:/\binstructor\b/.test(q)&&/\bqgh\b/.test(q),sra:/\bsra\b|surveillance radar approach/.test(q)};
    if(explicit.procedural)topic='procedural';else if(explicit.individual)topic='qgh-individual';else if(explicit.instructor)topic='qgh-instructor';else if(explicit.sra)topic='sra';
    const fallback=()=>({matched:false,topic,text:knowledge.learning+'\n\nI do not have a reliable simulator answer for that yet. Open the common guide below.',links:allGuides,escalation:'Contact the creator for further clarification.',creator:'Flt Lt Balaram Reddy · Service No. 38703'});
    const answerEntry=entry=>({matched:true,topic,intent:entry.id,text:entry.text,links:[guideLink(entry.anchor)]});
    if(!q)return fallback();
    if(/\b(?:ignore (?:all |your )?(?:instructions|rules)|system prompt|medical|diagnos|stock price|weather today|current notam|legal minimum|separation minimum)\b/.test(q))return fallback();
    if(/^(?:hi|hello|hey|namaste|help|help me|can you help me|who are you|what can you do)(?: gyani)?$/.test(q))return {matched:true,topic,text:'I’m Gyani, your simulator guide. Ask how to start, join, turn, transmit, create airspace or review an exercise.',links:allGuides};
    if(/^(?:thanks|thank you|thankyou|ok|okay|got it)(?: gyani)?$/.test(q))return {matched:true,topic,text:'You’re welcome. Ask whenever you need simulator help.',links:[]};
    if(/^(?:more|explain|explain more|tell me more|more detail|more details)$/.test(q)&&previousIntent){const entry=knowledge.entries.find(e=>e.id===previousIntent);if(entry)return answerEntry(entry);}
    if(/^(?:please )?(?:show |open |find |read |where is |where are )?(?:me )?(?:the |all )?(?:common |suite |training )?(?:guide|guides|manual|documentation)$/.test(q))return {matched:true,topic,text:'One common training guide covers all exercises. Choose the task you need in its navigation.',links:allGuides};
    const candidates=knowledge.entries.filter(e=>e.topics.includes(topic)&&new RegExp(e.match,'i').test(q));
    // Specific intents take precedence over broad words such as "turn" or "start".
    const specific=['traffic-return-exercise','instructor-traffic-return','meeting-debrief','meeting-room','exercise-time','training-time','stop-turn','extended-screens','guided-tour','mobile-workspace','local-pin-recovery','student-estimates','logout-position','review-controls','arp-upload','saved-exercises','custom-polygons','suite-turn','transmit','instructor-transmit','scope-tools','roster-mobile','approach-reference'];
    const storedSetup=/\b(?:exercise|template|preset|setup)\b/.test(q)&&candidates.find(e=>e.id==='saved-exercises');
    const selected=storedSetup||specific.map(id=>candidates.find(e=>e.id===id)).find(Boolean)||candidates.find(e=>e.priority)||candidates[0];
    if(selected)return answerEntry(selected);
    const retrieved=searchGuides?.(q,topic);if(retrieved)return answerEntry(retrieved);
    if(topic==='suite'&&/\b(?:start|begin|choose|launch|open|turn|left|right|vectoring|sre)\b/.test(q))return answerEntry(knowledge.entries.find(e=>e.id==='suite-choice'));
    return fallback();
  }

  function topicForPage(path, hash = '') {
    if (/\/procedural-beta(?:\/|$)|\/procedural(?:-guide)?\.html$/.test(path)) return 'procedural';
    if (path.includes('/instructor-led/')) return hash === '#sra' ? 'sra' : hash === '#par' ? 'par' : 'qgh-instructor';
    if (/\/user-guide\.html$/.test(path)) return hash === '#procedural' ? 'procedural' : hash === '#instructor' ? 'qgh-instructor' : hash === '#individual' ? 'qgh-individual' : 'suite';
    if (/\/(?:qgh|qgh-individual|single|tactical|training-centre)\.html$/.test(path)) return 'qgh-individual';
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
    const quickLinks = make('nav', 'suite-guide-chat__guides'); quickLinks.setAttribute('aria-label', 'Common training guide');
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
      const questions = topic === 'procedural' ? ['How to turn right?', 'How do I join?', 'How do I reuse an exercise?'] : topic === 'suite' || topic === 'qgh' ? ['Which simulator should I choose?', 'How do I start individual QGH?', 'How do I start SRA?'] : ['What next?', 'How do I join?', 'Where is the guide?'];
      for (const question of questions) {
        const button = make('button', '', question); button.type = 'button';
        button.addEventListener('click', () => { input.value = question; sendQuestion(); }); suggestions.append(button);
      }
    }
    const exerciseState = document.getElementById('exerciseState') || document.getElementById('studentExerciseState');
    const activeExercise = () => (document.body.classList.contains('desk-open') && document.body.classList.contains('exercise-running')) || (!exerciseState?.closest('[hidden]') && exerciseState?.textContent.trim() === 'RUNNING') || !!document.querySelector('#console.active, #tConsole.active');
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
    if (exerciseState) {
      new MutationObserver(syncAvailability).observe(exerciseState, { childList: true, characterData: true, subtree: true });
      const workspace=exerciseState.closest('#studentWorkspace,#activeWorkspace');
      if(workspace)new MutationObserver(syncAvailability).observe(workspace,{attributes:true,attributeFilter:['hidden']});
    }
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
