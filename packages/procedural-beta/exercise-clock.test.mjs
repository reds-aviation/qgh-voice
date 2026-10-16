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
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const cases=[
 ['Procedural','./static/procedural.js',/const clock = \(n\) => \{[\s\S]*?\n\};/],
 ['QGH instructor','../atc-suite/suite-instructor.js',/function clock\(seconds\) \{[^\n]+\}/],
 ['QGH controller','../atc-suite/suite-student.js',/const clock = seconds => \{[^\n]+\};/],
 ['Procedural review','./static/traffic-review.js',/const clock=t=>\{[^\n]+\};/]
];
for(const [name,path,pattern] of cases)test(`${name} uses elapsed time from zero and retains hours after day one`,()=>{
 const source=readFileSync(new URL(path,import.meta.url),'utf8'),definition=source.match(pattern)?.[0];
 assert.ok(definition,`${name} formatter is present`);
 const context=vm.createContext({});vm.runInContext(`${definition};globalThis.format=clock;`,context);
 for(const [seconds,expected] of [[0,'00:00:00'],[59.9,'00:00:59'],[60,'00:01:00'],[3599,'00:59:59'],[3600,'01:00:00'],[86400,'24:00:00'],[-1,'00:00:00']])assert.equal(context.format(seconds),expected);
});
