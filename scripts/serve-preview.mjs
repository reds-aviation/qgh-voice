// Development-only preview. Production PWA behaviour is tested on an unmodified
// distribution server; this preview avoids retaining earlier local edits.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const sourcePreview = process.argv.includes('--source');
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
    if (extname(file) === '.html') bytes = Buffer.from(bytes.toString().replace(/<script\b[^>]*src="pwa-register\.js[^" ]*"[^>]*><\/script>/g, ''));
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
