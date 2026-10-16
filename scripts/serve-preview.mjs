/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

// Development-only preview. Production PWA behaviour is tested on an unmodified
// distribution server; this preview avoids retaining earlier local edits.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const sourcePreview = process.argv.includes('--source');
const pwaPreview = process.argv.includes('--pwa');
const root = resolve(import.meta.dirname, sourcePreview ? '../packages/qgh-engine' : '../apps/web/dist');
const port = Number(process.argv[2] || 4271);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.gz': 'application/gzip', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.txt': 'text/plain', '.md': 'text/plain', '.png': 'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ttf': 'font/ttf' };
http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    // Source-only review can inspect the Training Centre while large voice banks
    // are being rendered. It is not a substitute for a verified distribution.
    let bytes = await readFile(sourcePreview && pathname === '/app-version.json'
      ? resolve(import.meta.dirname, '../apps/web/static/app-version.json') : file);
    if (extname(file) === '.html' && !pwaPreview) bytes = Buffer.from(bytes.toString().replace(/<script\b[^>]*src="(?:\.\.\/)?(?:pwa-register|suite-landing-register)\.js[^" ]*"[^>]*><\/script>/g, ''));
    if (extname(file) === '.mp4' && request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      const start = match && match[1] ? Number(match[1]) : match && match[2] ? Math.max(0, bytes.length - Number(match[2])) : NaN;
      const end = match && match[1] && match[2] ? Math.min(bytes.length - 1, Number(match[2])) : bytes.length - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) {
        response.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }); response.end(); return;
      }
      response.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': end - start + 1,
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1)); return;
    }
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': bytes.length,
      ...(extname(file) === '.mp4' ? { 'Accept-Ranges': 'bytes' } : {}),
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Local-only review: http://127.0.0.1:${port}/ (development cache disabled)`));
