#!/usr/bin/env node
/* ==================================================================
   mock-apps-script.mjs — a local stand-in for your Apps Script web app,
   for trying the forms on your own computer. It runs the real
   integrations/google-apps-script/Code.gs (with fake Google services)
   and copies how Google answers: POST → 302 redirect → JSON reply.

     terminal 1:  npm run mock:forms
     terminal 2:  FORMS_ENDPOINT=http://localhost:4174/exec npm run dev
     (Windows PowerShell: $env:FORMS_ENDPOINT="http://localhost:4174/exec"; npm run dev)

   Change how the mock behaves to see every form state:
     http://localhost:4174/__behaviour/ok       normal (default)
     http://localhost:4174/__behaviour/down     network failure  → "couldn't confirm"
     http://localhost:4174/__behaviour/slow     20 s delay       → timeout state
     http://localhost:4174/__behaviour/garbage  non-JSON reply   → "couldn't confirm"
     http://localhost:4174/__rows               see the saved rows
   Nothing is sent anywhere; rows only live in memory.
   ================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarness } from './lib/gas-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.MOCK_PORT || 4174);
const trips = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/trips.json'), 'utf8'));
const allowed = Object.fromEntries(trips.filter((t) => !['full', 'completed', 'cancelled'].includes(t.availability)).map((t) => [t.id, t.title]));
const h = createHarness({ ALLOWED_TRIPS: JSON.stringify(allowed), SITE_URL: 'http://localhost:4173' });
const replies = new Map();
let behaviour = process.env.MOCK_BEHAVIOUR || 'ok';
let seq = 0;

export const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (url.pathname.startsWith('/__behaviour/')) { behaviour = url.pathname.split('/').pop(); res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(`behaviour: ${behaviour}\n`); }
  if (url.pathname === '/__rows') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    return res.end(JSON.stringify(Object.fromEntries([...h.sheets].map(([k, s]) => [k, s.rows])), null, 2));
  }
  if (url.pathname === '/__reset') { h.sheets.clear(); h.cache.clear(); res.writeHead(200); return res.end('reset\n'); }
  if (req.method === 'OPTIONS') { res.writeHead(405); return res.end(); } // Apps Script can't answer preflights either
  if (url.pathname === '/exec' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', () => {
      if (behaviour === 'down') return req.socket.destroy();
      const ct = req.headers['content-type'] || '';
      const result = ct.includes('application/x-www-form-urlencoded')
        ? h.post(null, { params: Object.fromEntries(new URLSearchParams(body)) })
        : h.post(body, { raw: true });
      const id = String(++seq); replies.set(id, result);
      const send = () => { res.writeHead(302, { Location: `http://localhost:${PORT}/echo?id=${id}`, ...cors }); res.end(); };
      if (behaviour === 'slow') setTimeout(send, 20000); else send();
    });
    return;
  }
  if (url.pathname === '/echo') {
    const r = replies.get(url.searchParams.get('id'));
    if (!r) { res.writeHead(404, cors); return res.end(); }
    if (behaviour === 'garbage') { res.writeHead(200, { 'Content-Type': 'text/html', ...cors }); return res.end('<html>Sign in</html>'); }
    if (r.html) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(r.html); }
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors }); return res.end(JSON.stringify(r));
  }
  if (url.pathname === '/exec' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json', ...cors }); return res.end(JSON.stringify(h.get())); }
  res.writeHead(404); res.end();
});

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server.listen(PORT, () => console.log(`Mock form endpoint: http://localhost:${PORT}/exec  (allowed trips: ${Object.keys(allowed).join(', ')})\nBehaviour: ${behaviour}. Change it at http://localhost:${PORT}/__behaviour/<ok|down|slow|garbage>`));
}
