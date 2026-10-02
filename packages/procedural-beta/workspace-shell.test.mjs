import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {domHarness} from './testing/dom-harness.mjs';
test('shared workspace collapses once, preserves explicitly reopened controls through Run updates',()=>{
 const h=domHarness('<html><body><main id="root"><details id="panel" open></details><button id="toggle"></button><canvas id="scope"></canvas></main></body></html>');
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const shell=h.context.ATCSuiteWorkspace,root=h.document.getElementById('root'),panel=h.document.getElementById('panel');
 shell.bindShell({root,scope:h.document.getElementById('scope')});assert.equal(root.classList.contains('ats-workspace-shell'),true);
 const mode=shell.createFocusMode({root,panels:[panel],toggle:h.document.getElementById('toggle')});
 mode.setPhase('running');assert.equal(panel.open,false);mode.setExpanded(true);mode.setPhase('running');assert.equal(panel.open,true);
 mode.setPhase('paused');mode.setPhase('running');assert.equal(panel.open,true,'Resume retains instructor choice');
 let scrolled=0;root.scrollIntoView=()=>scrolled++;shell.enter(root);assert.equal(scrolled,1);
});
