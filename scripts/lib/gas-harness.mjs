/* ==================================================================
   gas-harness.mjs — runs integrations/google-apps-script/Code.gs in
   Node with small fakes of the Google services it uses, so the server
   logic can be tested without a Google account.

   It is a faithful-enough fake for testing OUR logic (validation,
   allowlist, rate limits, duplicates, formula escaping, test tabs).
   It does not prove the real deployment works: that still needs the
   manual test in docs/GOOGLE_SHEETS_SETUP.md.
   ================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function createHarness(props = {}) {
  const sheets = new Map();
  const cache = new Map();
  const mail = [];
  const properties = { ACCEPTING: 'true', ALLOW_TEST: 'true', ALLOWED_TRIPS: '{}', SITE_URL: 'https://example.org/site', ...props };

  const makeSheet = (name) => {
    const rows = [];
    return {
      name, rows,
      appendRow: (r) => rows.push(r.slice()),
      setFrozenRows: () => {},
      getLastRow: () => rows.length,
      getRange: (row, col, n, m) => ({ getValues: () => rows.slice(row - 1, row - 1 + n).map((r) => r.slice(col - 1, col - 1 + m)) }),
    };
  };

  const logs = [];
  // Code.gs logs server errors; keep them out of test output (set DEBUG=1 to see them)
  const quietConsole = { log: (...a) => logs.push(a.join(' ')), error: (...a) => { logs.push(a.join(' ')); if (process.env.DEBUG) console.error(...a); } };
  const sandbox = {
    console: quietConsole,
    Date, JSON, Math, Number, String, Object, Array, isNaN, parseInt, RegExp, Error,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => sheets.get(n) || null,
        insertSheet: (n) => { const s = makeSheet(n); sheets.set(n, s); return s; },
      }),
      flush: () => {},
    },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, String(v)) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in properties ? properties[k] : null) }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (t) => ({ _text: t, _type: 'text', setMimeType(m) { this._type = m; return this; }, getContent() { return this._text; } }),
    },
    HtmlService: { createHtmlOutput: (h) => ({ _html: h, _type: 'text/html', getContent() { return this._html; } }) },
    MailApp: { sendEmail: (to, subject, body) => mail.push({ to, subject, body }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()],
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url'),
      getUuid: () => crypto.randomUUID(),
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'integrations/google-apps-script/Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });

  const post = (body, { raw = false, params = null } = {}) => {
    const e = params ? { parameter: params, postData: null } : { postData: { contents: raw ? body : JSON.stringify(body), type: 'text/plain' }, parameter: {} };
    const out = sandbox.doPost(e);
    return out._type === 'text/html' ? { html: out.getContent() } : JSON.parse(out.getContent());
  };
  return { logs, post, get: () => JSON.parse(sandbox.doGet().getContent()), sheets, cache, mail, properties, clearRateLimits: () => [...cache.keys()].filter((k) => k.startsWith('rl:')).forEach((k) => cache.delete(k)) };
}
