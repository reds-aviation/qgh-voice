/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import {cp, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release=JSON.parse(await readFile(resolve(root,'packages/procedural-beta/manifest.json'),'utf8')).version;
const output=resolve(root,'release',`ATC-Suite-Offline-${release}`);
const source=resolve(root,'apps/web/dist');
if(!(await readFile(resolve(source,'procedural-beta/guide-knowledge.js'),'utf8')).includes(release)) throw new Error('Build the current Pages site before preparing the offline kit.');
// Refuse to overwrite an existing kit, which might hold user exports.
await mkdir(dirname(output), {recursive:true});
await mkdir(output);
await cp(source,resolve(output,'site'),{recursive:true,errorOnExist:true,force:false});
for (const file of ['Start-ATC.cmd','serve.py','START-HERE.txt']) await cp(resolve(root,'packages/offline-kit',file),resolve(output,file));
await writeFile(resolve(output,'site/procedural-beta/remote-config.js'),'// Standalone offline distribution: hosted online rooms are intentionally unavailable.\nexport const remoteConfig = Object.freeze({url:"",publishableKey:""});\n');
await writeFile(resolve(output,'site/instructor-led/remote-config.js'),'export const remoteConfig = Object.freeze({url:"",publishableKey:""});\n');
for(const page of ['index.html','procedural.html']) {
  const path=resolve(output,'site/procedural-beta',page);
  let html=await readFile(path,'utf8');
  html=html.replace('Online room · different devices','Online room · unavailable in offline kit');
  await writeFile(path,html);
}
const files=[];
async function walk(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const path=resolve(directory,entry.name);
    if(entry.isDirectory()) await walk(path);
    else {const data=await readFile(path);files.push({path:relative(resolve(output,'site'),path).replaceAll('\\','/'),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
  }
}
await walk(resolve(output,'site'));
await writeFile(resolve(output,'site-files.json'),JSON.stringify({release,generated:new Date().toISOString(),files},null,2)+'\n');
console.log(`Prepared ${files.length} assets (${Math.ceil(files.reduce((n,f)=>n+f.bytes,0)/1048576)} MiB) in ${output}. Runtime/browser installers are not bundled.`);
