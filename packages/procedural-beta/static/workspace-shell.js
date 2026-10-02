(function () {
  'use strict';
  // One UI shell for the existing simulator adapters. It never owns flight state.
  function enter(element, options = {}) {
    if (!element) return;
    element.scrollIntoView?.({block:options.block || 'start', behavior:'auto'});
    const target = options.focusTarget;
    if (target) { if (!target.hasAttribute?.('tabindex')) target.setAttribute?.('tabindex','-1'); target.focus?.({preventScroll:true}); }
  }
  function bindShell({root,scope,shelf,actions}) {
    root?.classList.add('ats-workspace-shell');
    scope?.classList.add('ats-scope-surface');
    shelf?.classList.add('ats-aircraft-shelf');
    actions?.classList.add('ats-workspace-actions');
  }
  function createFocusMode({root,panels=[],toggle,onChange=()=>{}}) {
    let phase='prepare',expanded=true;
    function setExpanded(value) {
      expanded=Boolean(value); root?.classList.toggle('ats-focus-mode',!expanded);
      for (const panel of panels) if (panel && (panel.tagName==='DETAILS' || 'open' in panel)) { panel.open=expanded; panel.toggleAttribute?.('open',expanded); }
      toggle?.setAttribute('aria-expanded',String(expanded));onChange(expanded);
    }
    return {setExpanded,enterRun(){setExpanded(false);},setPhase(next){if(next==='running' && phase!=='running' && phase!=='paused')setExpanded(false);phase=next;},isExpanded:()=>expanded};
  }
  globalThis.ATCSuiteWorkspace=Object.freeze({enter,bindShell,createFocusMode});
})();
