/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import {readFile, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const esc = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function inline(text) {
  return esc(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,'<a href="$2">$1</a>');
}
export async function buildOfflineGuide(output, root, version) {
  const source = (await readFile(resolve(root,'output/private-reference/offline-setup.md'),'utf8')).replaceAll('__SUITE_RELEASE__', version);
  const lines = source.split(/\r?\n/), sections = [];
  let html='',list='',table=false,code=false;
  const closeList=()=>{if(list){html+=`</${list}>`;list='';}};
  const closeTable=()=>{if(table){html+='</tbody></table></div>';table=false;}};
  for(const line of lines) {
    if(line.startsWith('```')) {closeList();closeTable();html+=code?'</code></pre>':'<pre><code>';code=!code;continue;}
    if(code){html+=esc(line)+'\n';continue;}
    if(!line.trim()){closeList();closeTable();continue;}
    const heading=line.match(/^(#{1,3}) (.+)$/);
    if(heading){closeList();closeTable();const level=heading[1].length,id=heading[2].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');html+=`<h${level} id="${id}">${inline(heading[2])}</h${level}>`;if(level===2) sections.push([id,heading[2]]);continue;}
    if(line.startsWith('|')) {closeList();const cells=line.split('|').slice(1,-1).map(c=>c.trim());if(cells.every(c=>/^:?-+:?$/.test(c)))continue;if(!table){html+='<div class="table-scroll"><table><thead><tr>'+cells.map(c=>`<th>${inline(c)}</th>`).join('')+'</tr></thead><tbody>';table=true;}else html+='<tr>'+cells.map(c=>`<td>${inline(c)}</td>`).join('')+'</tr>';continue;}
    closeTable();const item=line.match(/^(?:([-*]) |(\d+)\. )(.+)$/);
    if(item){const type=item[1]?'ul':'ol';if(list!==type){closeList();html+=`<${type}>`;list=type;}html+=`<li>${inline(item[3])}</li>`;continue;}
    closeList();html+=`<p>${inline(line)}</p>`;
  }
  closeList();closeTable();
  await writeFile(resolve(output,'offline-setup.md'),source);
  await copyFile(resolve(root,'packages/site-landing/offline-guide.css'),resolve(output,'offline-guide.css'));
  await writeFile(resolve(output,'offline-setup.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fafaf8"><title>Offline PC setup · ATC Training Suite</title><link rel="stylesheet" href="offline-guide.css"></head><body><header><strong>ATC TRAINING SUITE · PRIVATE REFERENCE</strong><nav><a href="offline-setup.md" download>Download written guide</a></nav></header><div class="guide-layout"><aside><p>ZERO INTERNET · SETUP HANDBOOK</p><nav>${sections.map(([id,title])=>`<a href="#${id}">${esc(title)}</a>`).join('')}</nav><small>Use Ctrl+P to print or save a PDF. Private reference copy; not part of the public website.</small></aside><main>${html}</main></div><footer>ATC TRAINING SUITE · Release ${version} · Independent training simulator</footer></body></html>`);
}
