/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

(function () {
  'use strict';
  const knowledge = typeof module === 'object' && module.exports ? require('./guide-knowledge.js') : globalThis.ATCGuideKnowledge;
  const searchAPI = typeof module === 'object' && module.exports ? require('./guide-search.js') : globalThis.ATCGuideSearch;
  const screenContext = typeof module === 'object' && module.exports ? require('./guide-context.js') : globalThis.ATCGuideContext;
  const searchGuides = searchAPI?.createIndex(knowledge?.entries || []);
  const scriptURL = typeof document === 'object' ? document.currentScript?.src : null;

  // All operational answers come from the same release knowledge as the handbook.
  const destinations = {
    individual: {label:'Open Single QGH',href:'../qgh.html'},
    instructor: {label:'Open Instructor QGH + SRA',href:'../instructor-led/'},
    procedural: {label:'Open Procedural',href:'procedural.html'},
  };
  const commonGuide = {label:'Training guide',href:'../training-centre.html'};
  const allGuides = [commonGuide];
  const topics = ['suite','procedural','qgh','qgh-individual','qgh-instructor','sra','par'];
  const guideLink = anchor => ({label:commonGuide.label,href:commonGuide.href+(anchor?'#'+anchor:'')});
  function normalize(input) {
    return String(input||'').slice(0,1000).normalize('NFKC').toLowerCase()
      .replace(/\b(?:trun|tuen)\b/g,'turn').replace(/\b(?:rigth|rihgt)\b/g,'right')
      .replace(/\bsimulater\b/g,'simulator').replace(/d\s*\/\s*f/g,'df')
      .replace(/u\s*\/\s*s/g,'unserviceable').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }
  function matchGuideQuestion(input,context='suite',previousIntent='',screen) {
    let q=normalize(input),topic=topics.includes(context)?context:'suite';
    // Old PAR bookmarks stay understandable without recommending a retired exercise.
    if(/\bpar\b|precision radar approach/.test(q))return {matched:true,topic:'par',intent:'suite-choice',text:'PAR is deferred and is not available in this release. Use QGH, SRE/vectoring, SRA or Procedural.',links:[guideLink('start')]};
    if(topic==='par')topic='sra';
    if(/turn/.test(previousIntent)&&/^(?:and |what about )?(?:left|right)$/.test(q))q='how to turn '+q;
    const explicit={procedural:/\bprocedural\b/.test(q),individual:/\b(?:individual|single|solo|tactical)\b/.test(q)&&/\bqgh\b/.test(q),instructor:/\binstructor\b/.test(q)&&/\bqgh\b/.test(q),sra:/\bsra\b|surveillance radar approach/.test(q)};
    if(explicit.procedural)topic='procedural';else if(explicit.individual)topic='qgh-individual';else if(explicit.instructor)topic='qgh-instructor';else if(explicit.sra)topic='sra';
    const fallback=()=>({matched:false,topic,text:knowledge.learning+'\n\nI do not have a reliable simulator answer for that yet. Open the Training guide below.',links:allGuides,escalation:'Contact the creator for further clarification.',creator:'Flt Lt Balaram Reddy · Service No. 38703'});
    const answerEntry=entry=>({
      matched:true,topic,intent:entry.id,text:entry.text,
      brief:searchAPI?.briefAnswer?.(entry,q),
      choices:knowledge.examples?.[entry.id]?['Tell me more']:[],
      controls:entry.controls,links:[guideLink(entry.anchor)]
    });
    const fromScreen=(step,intent)=>({matched:true,topic,intent,text:step.text,choices:['Tell me more'],
      controls:step.controlId?[step.controlId]:[],links:[guideLink(step.anchor)]});
    const nextQuestion=/^(?:what(?: s| is)? next|what (?:do|should|can) i do (?:now|next))$/;
    if(!q)return fallback();
    if(/\b(?:ignore (?:all |your )?(?:instructions|rules)|system prompt|medical|diagnos|stock price|weather today|current notam|legal minimum|separation minimum)\b/.test(q))return fallback();
    if(/^(?:hi|hello|hey|namaste|help|help me|can you help me|who are you|what can you do)(?: (?:saarthi|gyani))?$/.test(q))return {matched:true,topic,text:'I’m Saarthi, your simulator guide. Ask “What next?” for help with this screen.',links:allGuides};
    if(/^(?:thanks|thank you|thankyou|ok|okay|got it)(?: (?:saarthi|gyani))?$/.test(q))return {matched:true,topic,text:'You’re welcome. Ask whenever you need simulator help.',links:[]};
    const drawRoute=/\b(?:draw(?:ing)?|creat(?:e|ing)|add(?:ing)?|plot(?:ting)?|sketch(?:ing)?|mak(?:e|ing)|finish(?:ing)?)\b/.test(q) && /\b(?:ats route|route|airway)s?\b/.test(q) && !/\b(?:levels?|arrow|directions?|limits?|remove|rename)\b/.test(q);
    if(screen && (drawRoute || (previousIntent==='screen-route' && nextQuestion.test(q)))){
      const step=screenContext?.routeAnswer?.(screen,topic);
      if(step)return fromScreen(step,'screen-route');
    }
    const startQuestion=/^(?:(?:how (?:do|can) (?:i|we) |why (?:can t|can not|cannot|cant) (?:i|we) )(?:start|run|join)(?: (?:the |this |an? )?(?:exercise|session|room))?|why (?:is (?:the )?start (?:button )?(?:disabled|greyed out|grayed out)|am i (?:still )?waiting)|how (?:do|can) i (?:get ready|mark ready)|(?:start|startup) (?:help|steps))$/;
    if(screen && (nextQuestion.test(q) || startQuestion.test(q))){
      const step=screenContext?.startAnswer(screen,topic,q);
      if(step)return fromScreen(step,'screen-start');
      if(nextQuestion.test(q)){
        const startId=({'procedural':'procedural-start','qgh-individual':'individual-start','qgh-instructor':'instructor-start','sra':'instructor-start'})[topic]||'suite-choice';
        const entry=knowledge.entries.find(e=>e.id===startId);
        return {...answerEntry(entry),text:entry.intro||entry.text};
      }
    }
    const saveOptions=knowledge.saveHelp?.[topic];
    const ambiguousSave=/^(?:(?:how|where|what) (?:do|can|should) (?:i|we) |(?:i|we) (?:want|need) to )?save(?: (?:it|this|(?:the |my |an? |this )?(?:exercise|session)))?(?: please)?$/.test(q);
    const saveChoice=saveOptions && Object.keys(saveOptions).find(label=>normalize(label)===q);
    if((ambiguousSave || saveChoice) && screenContext?.isControllerDesk?.(screen)){
      return {matched:true,topic,intent:'controller-save',text:'Ask your instructor to save the exercise from their desk.',links:[guideLink('review')]};
    }
    if(ambiguousSave && topic==='qgh-individual'){
      return {matched:true,topic,intent:'solo-save',text:'In individual QGH, terminate when you are ready to review the recorded track. Exercise-file downloads are available in the instructor-led simulators.',links:[guideLink('answer-terminate-individual')]};
    }
    if(saveOptions){
      const choices=Object.keys(saveOptions);
      if(ambiguousSave){
        return {matched:true,topic,intent:'choose-save',text:'What would you like to keep?',choices,links:[]};
      }
      if(saveChoice){
        const detail=saveOptions[saveChoice];
        return {matched:true,topic,intent:'save-'+normalize(saveChoice),text:detail.text,controls:detail.controls,
          links:[guideLink('answer-'+detail.entry)]};
      }
    }
    if(/^(?:more|explain|explain more|tell me more|more details?|give me an example|(?:worked )?example)(?: please)?$/.test(q)&&previousIntent){
      if(previousIntent==='choose-save' && saveOptions)return {matched:true,topic,intent:'choose-save',text:topic==='procedural'?'Choose Starting setup to run the exercise again from the beginning, Current progress to keep the clock and records, or Airspace only for the chart.':'Choose Starting setup before the session, or Download setup after review to keep its original aircraft and airspace.',choices:Object.keys(saveOptions),links:[]};
      const detail=Object.entries(saveOptions||{}).find(([label])=>'save-'+normalize(label)===previousIntent)?.[1];
      let entryId=detail?.entry||previousIntent.replace(/^example-/, '');
      if(previousIntent==='screen-route')entryId=topic==='procedural'?'custom-polygons':'public-lfa-samples';
      if(previousIntent==='screen-start')entryId=topic==='qgh-individual'?'individual-start':'session';
      const entry=knowledge.entries.find(e=>e.id===entryId);
      if(entry){
        const guideOnly=previousIntent.startsWith('example-') || (previousIntent==='screen-route' && screenContext?.isControllerDesk?.(screen));
        const extra=guideOnly?null:detail?.example || knowledge.examples?.[entry.id];
        return {matched:true,topic,intent:'example-'+entry.id,
          text:extra || 'Open “'+entry.title+'” in the Training guide for the complete steps.',
          links:[{label:entry.title,href:guideLink('answer-'+entry.id).href}]};
      }
    }
    if(/^(?:please )?(?:show |open |find |read |where is |where are )?(?:me )?(?:the |all )?(?:common |suite |training )?(?:guide|guides|manual|documentation)$/.test(q))return {matched:true,topic,text:'The Training guide covers all exercises. Choose QGH, Instructor or Procedural, then follow the short flow and task pointers.',links:allGuides};
    const candidates=knowledge.entries.filter(e=>e.topics.includes(topic)&&new RegExp(e.match,'i').test(q));
    // Specific intents take precedence over broad words such as "turn" or "start".
    const specific=['individual-distance','traffic-return-exercise','instructor-traffic-return','meeting-debrief','meeting-room','exercise-time','training-time','stop-turn','extended-screens','guided-tour','mobile-workspace','local-pin-recovery','student-estimates','logout-position','review-controls','arp-upload','saved-exercises','custom-polygons','suite-turn','transmit','instructor-transmit','scope-tools','roster-mobile','approach-reference'];
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
    if (/\/(?:user-guide|training-centre)\.html$/.test(path)) return hash === '#procedural' ? 'procedural' : hash === '#instructor' ? 'qgh-instructor' : ['#qgh','#individual','#calls'].includes(hash) ? 'qgh-individual' : 'suite';
    if (/\/(?:qgh|qgh-individual|single|tactical)\.html$/.test(path)) return 'qgh-individual';
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
    const root = make('div', 'suite-guide-chat'); root.id = 'suite-guide-chat';
    const launcher = make('button', 'suite-guide-chat__launcher');
    const avatar = make('img', 'suite-guide-chat__avatar'); avatar.src = new URL('gyani-instructor.png', scriptURL || location.href).href; avatar.alt = ''; avatar.width = 48; avatar.height = 48; avatar.decoding = 'async';
    const invitation = make('span', 'suite-guide-chat__invitation', 'Saarthi · Simulator guide');
    launcher.append(avatar, invitation); launcher.setAttribute('aria-label', 'Ask Saarthi for simulator help'); launcher.title = 'Saarthi · Simulator guide';
    launcher.type = 'button'; launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-controls', 'suite-guide-chat-panel'); launcher.setAttribute('aria-expanded', 'false');
    const panel = make('section', 'suite-guide-chat__panel'); panel.id = 'suite-guide-chat-panel'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'suite-guide-chat-title');
    if (typeof panel.showPopover === 'function') panel.setAttribute('popover', 'manual');
    const header = make('header', 'suite-guide-chat__header');
    const heading = make('div');
    const title = make('h2', '', 'Saarthi'); title.id = 'suite-guide-chat-title';
    heading.append(title, make('p', '', 'Simulator guide'));
    const close = make('button', 'suite-guide-chat__close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Collapse Saarthi');
    header.append(avatar.cloneNode(), heading, close);
    const history = make('div', 'suite-guide-chat__history'); history.setAttribute('role', 'log'); history.setAttribute('aria-live', 'polite'); history.setAttribute('aria-relevant', 'additions'); history.setAttribute('aria-label', 'Conversation with Saarthi');
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
    const controlIdsByButton = new WeakMap();
    let highlightedControl = null;
    let highlightTimer;
    function clearHighlight() {
      clearTimeout(highlightTimer);
      highlightedControl?.classList.remove('suite-guide-chat-target');
      highlightedControl = null;
    }
    function findVisibleControl(ids) {
      for (const id of ids) {
        const control = document.getElementById(id);
        if (!control || control.matches(':disabled') || control.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
        if (control.checkVisibility && !control.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
        const bounds = control.getBoundingClientRect();
        if (bounds.width > 0 && bounds.height > 0) return control;
      }
      return null;
    }
    function pointToControl(control) {
      closePanel(false);
      clearHighlight();
      highlightedControl = control;
      control.classList.add('suite-guide-chat-target');
      if (control.tabIndex < 0 && !control.hasAttribute('tabindex')) {
        control.setAttribute('tabindex', '-1');
        control.addEventListener('blur', () => control.removeAttribute('tabindex'), { once: true });
      }
      control.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      control.focus({ preventScroll: true });
      highlightTimer = setTimeout(clearHighlight, 5000);
    }
    function addMessage(kind, text, answer) {
      const item = make('article', 'suite-guide-chat__message suite-guide-chat__message--' + kind);
      item.append(make('span', 'suite-guide-chat__speaker', kind === 'user' ? 'You' : 'Saarthi'), make('p', '', answer?.brief || text));
      if (answer?.controls?.length && findVisibleControl(answer.controls)) {
        const show = make('button', 'suite-guide-chat__show', 'Show me');
        show.type = 'button';
        controlIdsByButton.set(show, answer.controls);
        show.addEventListener('click', () => {
          const control = findVisibleControl(answer.controls);
          if (control) pointToControl(control);
          else { show.remove(); input.focus(); }
        });
        item.append(show);
      }
      if (answer?.choices?.length) {
        const options = make('div', 'suite-guide-chat__suggestions suite-guide-chat__choices');
        options.setAttribute('role', 'group');
        options.setAttribute('aria-label', 'Choose a follow-up question');
        for (const choice of answer.choices) {
          const button = make('button', '', choice);
          button.type = 'button';
          button.addEventListener('click', () => { input.value = choice; sendQuestion(answer.topic, answer.intent); });
          options.append(button);
        }
        item.append(options);
      }
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
      const questions = topic === 'procedural' ? ['What next?', 'How to turn right?', 'How do I save?'] : topic === 'suite' || topic === 'qgh' ? ['Which simulator should I choose?', 'How do I start individual QGH?', 'How do I start SRA?'] : ['What next?', 'How do I join?', 'Where is the guide?'];
      for (const question of questions) {
        const button = make('button', '', question); button.type = 'button';
        button.addEventListener('click', () => { input.value = question; sendQuestion(); }); suggestions.append(button);
      }
    }
    window.addEventListener('hashchange', () => {
      topic = topicForPage(location.pathname, location.hash);
      previousIntent = '';
      setSuggestions();
    });
    const exerciseState = document.getElementById('exerciseState') || document.getElementById('studentExerciseState');
    const activeExercise = () => (document.body.classList.contains('desk-open') && document.body.classList.contains('exercise-running')) || (!exerciseState?.closest('[hidden]') && exerciseState?.textContent.trim() === 'RUNNING') || !!document.querySelector('#console.active, #tConsole.active');
    function closePanel(restoreFocus = true) {
      panel.hidePopover?.();
      panel.hidden = true; launcher.hidden = false; launcher.setAttribute('aria-expanded', 'false');
      if (restoreFocus) launcher.focus({ preventScroll: true });
    }
    function sendQuestion(answerTopic = topic, answerIntent = previousIntent) {
      const question = input.value.trim().slice(0, 1000); if (!question) return;
      addMessage('user', question);
      const answer = matchGuideQuestion(question, answerTopic, answerIntent, document); topic = answer.topic; previousIntent = answer.intent || '';
      addMessage('assistant', answer.text, answer); input.value = ''; send.disabled = true; setSuggestions(); input.focus();
    }
    launcher.addEventListener('click', () => {
      clearHighlight();
      for (const button of history.querySelectorAll('.suite-guide-chat__show')) {
        button.hidden = !findVisibleControl(controlIdsByButton.get(button));
      }
      panel.hidden = false; panel.showPopover?.(); launcher.hidden = true;
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
    // Keep keys used inside help away from exercise shortcuts and push-to-talk.
    root.addEventListener('keydown', event => event.stopPropagation());
    root.addEventListener('keyup', event => event.stopPropagation());
    function exerciseDock() {
      const selectors = document.body.classList.contains('desk-open')
        ? ['#work-panel:not([hidden]) > .drawer-head', '#edge-actions', '.exercisebar']
        : ['#activeWorkspace:not([hidden]) #instructorTools', '#activeWorkspace:not([hidden]) .workspace-head',
           '#studentWorkspace:not([hidden]) #studentTools', '#studentWorkspace:not([hidden]) .student-head',
           '#console.active .console-head', '#tConsole.active .tactical-console-head'];
      for (const selector of selectors) {
        const dock = document.querySelector(selector);
        if (dock && !dock.closest('[hidden]') && (!dock.checkVisibility || dock.checkVisibility())) return dock;
      }
    }
    let wasRunning = false;
    function syncAvailability() {
      const dock = exerciseDock();
      const destination = dock || document.querySelector('.topbar nav, .suite-header-left, .entry-program-tabs, .header-links, .header-nav, .app-header .brand, .tactical-app-header .tactical-brand') || document.body;
      const running = activeExercise();
      // A newly started exercise opens with a clear screen. Help opens again
      // only on request and remains open through subsequent clock updates.
      if (!panel.hidden && ((!wasRunning && running) || root.parentElement !== destination)) closePanel(panel.contains(document.activeElement));
      wasRunning = running;
      if (root.parentElement !== destination) {
        const drawerTools = destination.matches('.drawer-head') && destination.querySelector(':scope > .ats-overlay-tools, :scope > #drawer-close');
        destination.insertBefore(root, drawerTools || null);
      }
      root.classList.toggle('suite-guide-chat--desk', Boolean(dock));
    }
    new MutationObserver(syncAvailability).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const proceduralDrawer = document.getElementById('work-panel');
    if (proceduralDrawer) new MutationObserver(syncAvailability).observe(proceduralDrawer, {attributes:true, attributeFilter:['hidden']});
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
    addMessage('assistant', 'I’m Saarthi, your simulator guide. Ask “What next?” for help with this screen, or ask about a control.');
    setSuggestions();
    syncAvailability();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
