/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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
