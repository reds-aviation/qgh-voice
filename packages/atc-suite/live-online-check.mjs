/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Session from './suite-session.js';
import Cloud from './suite-cloud.js';
import {createRemoteService} from '../procedural-beta/static/remote-service.js';
import {remoteConfig} from '../procedural-beta/static/remote-config.js';
if(process.env.ATC_SUPABASE_LIVE_TEST!=='1')throw Error('Set ATC_SUPABASE_LIVE_TEST=1 to create disposable synthetic exercise rooms.');
const client=async()=>{const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};const service=createRemoteService(remoteConfig,randomUUID(),{storage,rpc:'atc_suite_session'});const auth=await service.authenticate();return{service,id:auth.user.id};};
const host=await client(),student=await client();
for(const mode of ['qgh','surveillance','sra','par']){
 const hostKey=randomUUID(),room={...await host.service.call('create',null,{hostKey}),hostKey};
 try{
  await student.service.call('join',null,{pin:room.pin});
  const h=Cloud.createTransport({service:host.service,room,host:true,sessionApi:Session}),s=Cloud.createTransport({service:student.service,room,host:false,sessionApi:Session});
  const hi=Session.createInstructorSession({transport:h,pin:room.pin,sessionId:room.id,senderId:host.id,publicMetadata:{mode}}),st=Session.createStudentSession({transport:s,pin:room.pin,clientId:student.id,discovery:{...room,expiresAt:Date.now()+100000}});
  st.requestJoin();await s.sync();await h.sync();assert.deepEqual(hi.snapshot().waitingClientIds,[student.id]);
  hi.admit(student.id);await h.sync();await s.sync();st.ready();await s.sync();await h.sync();await h.sync();await s.sync();
  assert.equal(hi.start(0),true);await h.sync();await s.sync();assert.equal(st.snapshot().state,'running');
  const observation=mode==='qgh'?{mode,status:'held',transmissionState:'held',bearingType:'qdm',bearingDeg:120}:mode==='par'?{mode,rangeNm:8,trackState:'tracking',azimuth:{deviationDeg:1},elevation:{deviationDeg:-.5}}:{mode,scanAngleDeg:140,plots:[{trackId:'T1',rangeNm:10,azimuthDeg:45,timestamp:1}]};
  hi.publishObservation(observation,1);await h.sync();await s.sync();assert.equal(st.snapshot().observation.mode,mode);
  hi.pause(1);await h.sync();await s.sync();assert.equal(st.snapshot().state,'paused');
  hi.terminate('test-complete',1);await h.sync();await s.sync();assert.equal(st.snapshot().state,'terminated');
  console.log(`${mode}: hosted PIN → admission → ready → start → sensor → pause → terminate passed`);
 }finally{await host.service.call('close',room.id,{hostKey});}
}
