#!/usr/bin/env node
/* The Board: dev server. Zero dependencies (Node 18+).
 *
 *   node server/dev-server.js [port]
 *
 * Serves the front end and answers /api/v1/* over real HTTP using the same
 * MockServer the browser uses in mock mode. It forces the front end into
 * "http" mode so you can test exactly what a real backend will see.
 * Data is saved to server/data.json. Delete that file to reset.
 *
 * It is a reference for your backend, not a production server. */
const http = require('http'), fs = require('fs'), path = require('path');
const MockServer = require('../js/mock-backend.js');

const ROOT = path.resolve(__dirname, '..');
const PORT = +process.argv[2] || +process.env.PORT || 8787;
const DATA = path.join(__dirname, 'data.json');
const BASE = '/api/v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

let state = null;
try { state = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (_) {}
let saveT = null;
const server0 = new MockServer({
  state, autoReply: process.env.NO_AUTOREPLY ? false : true, demoActAsAnyOwner: !process.env.STRICT_OWNERS,
  onChange: s => { clearTimeout(saveT); saveT = setTimeout(() => fs.writeFile(DATA, JSON.stringify(s), () => {}), 150); }
});

const CONFIG_JS = `window.BOARD_CONFIG = { mode: 'http', apiBase: '${BASE}', useCookies: false, pollMs: null };\n`;

function readBody(req, limit = 12e6) {
  return new Promise((res, rej) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { rej(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => res(Buffer.concat(chunks)));
    req.on('error', rej);
  });
}

/* Minimal multipart reader: returns { fields, file: { type, name, buf } } */
function parseMultipart(buf, ctype) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ctype || ''); if (!m) return null;
  const sep = Buffer.from('--' + (m[1] || m[2])), out = { fields: {}, file: null };
  let pos = buf.indexOf(sep);
  while (pos !== -1) {
    const start = pos + sep.length; if (buf.slice(start, start + 2).toString() === '--') break;
    const next = buf.indexOf(sep, start); if (next === -1) break;
    const part = buf.slice(start + 2, next - 2), he = part.indexOf('\r\n\r\n'); if (he === -1) { pos = next; continue; }
    const head = part.slice(0, he).toString(), data = part.slice(he + 4);
    const name = /name="([^"]*)"/.exec(head), fn = /filename="([^"]*)"/.exec(head), ct = /content-type:\s*([^\r\n]+)/i.exec(head);
    if (fn) out.file = { name: fn[1], type: ct ? ct[1].trim() : '', buf: data }; else if (name) out.fields[name[1]] = data.toString();
    pos = next;
  }
  return out;
}

async function api(req, res, url) {
  const cors = { 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Vary': 'Origin' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const r = { method: req.method, path: url.pathname.slice(BASE.length) || '/', query: Object.fromEntries(url.searchParams), body: {}, token: (/^Bearer (.+)$/.exec(req.headers.authorization || '') || [])[1] || null };
  try {
    const raw = await readBody(req), ct = req.headers['content-type'] || '';
    if (/multipart\/form-data/i.test(ct)) {
      const mp = parseMultipart(raw, ct);
      if (mp && mp.file) r.upload = { type: mp.file.type, size: mp.file.buf.length, purpose: mp.fields.purpose, dataUrl: 'data:' + mp.file.type + ';base64,' + mp.file.buf.toString('base64') };
      else r.body = {};
    } else if (raw.length) { try { r.body = JSON.parse(raw.toString()); } catch (_) { res.writeHead(400, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 'validation_failed', message: 'Body is not valid JSON.' } })); } }
  } catch (e) { res.writeHead(e.status || 400, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 'too_large', message: 'That upload is too large.' } })); }
  const out = await server0.handle(r);
  res.writeHead(out.status, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(out.status === 204 ? undefined : JSON.stringify(out.body));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith(BASE)) return api(req, res, url);
  if (url.pathname === '/js/config.js') { res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' }); return res.end(CONFIG_JS); }
  let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  const allowed = /^(index\.html|css|js|docs)([\\/]|$)/.test(path.relative(ROOT, file));
  if (!file.startsWith(ROOT) || !allowed) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(buf);
  });
}).listen(PORT, () => console.log(`The Board dev server: http://localhost:${PORT}  (API at ${BASE})`));
