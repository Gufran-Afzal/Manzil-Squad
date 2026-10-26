/* ==================================================================
   Code.gs — Google Apps Script web app that saves website
   registrations and contact messages into a Google Sheet.

   Setup: docs/GOOGLE_SHEETS_SETUP.md (step by step).
   Paste this whole file into the Apps Script editor that belongs to
   your spreadsheet (Extensions → Apps Script), then deploy it as a web
   app ("Execute as: Me", "Who has access: Anyone").

   This endpoint is PUBLIC: anyone who finds the URL can send to it.
   So it never trusts the browser. It re-checks every field, only
   accepts known trips, limits how often the same person can submit,
   ignores duplicates, and neutralises anything that a spreadsheet
   could treat as a formula.

   Script properties (Project Settings → Script properties):
     ALLOWED_TRIPS  JSON object of trip IDs → titles that may be
                    registered, e.g. {"galiyat-weekend-01":"Nathiagali and Ayubia weekend"}
                    (`npm run build` prints the current value for you)
     ACCEPTING      "true" to accept submissions, anything else pauses them
     ALLOW_TEST     "true" to accept test submissions (written to the
                    "(Test)" tabs); set to "false" once you are live
     SITE_URL       your public site URL (used for the no-JavaScript reply page)
     NOTIFY_EMAIL   optional: an address that gets a short "new
                    registration" email (no personal notes included)
   ================================================================== */

var CONFIG = {
  SHEETS: { booking: 'Registrations', contact: 'Contact' },
  TEST_SUFFIX: ' (Test)',
  HEADERS: {
    booking: ['Submitted at', 'Reference', 'Trip ID', 'Trip title', 'Participant name', 'Phone', 'Email', 'University', 'Participants', 'Contact preference', 'Booking status', 'Consent at', 'Source page', 'Notes'],
    contact: ['Submitted at', 'Reference', 'Name', 'Reply to', 'Topic', 'Trip ID', 'Message', 'Status', 'Consent at', 'Source page'],
  },
  FIELDS: {
    booking: ['type', 'ref', 'tripId', 'tripTitle', 'name', 'phone', 'email', 'university', 'participants', 'contactPreference', 'notes', 'consentPrivacy', 'consentTerms', 'consentAt', 'sourcePage', 'website', 'elapsedMs', 'mode', 'client', 'formatHint'],
    contact: ['type', 'ref', 'name', 'replyTo', 'topic', 'tripId', 'message', 'consentPrivacy', 'consentAt', 'sourcePage', 'website', 'elapsedMs', 'mode', 'client', 'formatHint'],
  },
  MAX: { name: 80, phone: 20, email: 120, university: 100, notes: 500, replyTo: 120, message: 1500, sourcePage: 200, tripTitle: 120 },
  TOPICS: ['trip-question', 'group-trip', 'parent', 'suggestion', 'other'],
  CONTACT_PREFS: ['whatsapp', 'call', 'email'],
  RATE: { perPersonPer10Min: 3, globalPerMinute: 30 },
  MIN_ELAPSED_MS: 2000,
  REF_RE: /^(REQ|MSG)-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
  EMAIL_RE: /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/,
};

/* ---------------- entry points ---------------- */

function doPost(e) {
  var asHtml = false;
  try {
    var data = parseRequest_(e);
    asHtml = data.formatHint === 'html' && data.client !== 'js';
    var result = handle_(data);
    return asHtml ? htmlReply_(result) : json_(result);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    var fail = { ok: false, error: 'server_error' };
    return asHtml ? htmlReply_(fail) : json_(fail);
  }
}

/** Visiting the URL in a browser shows whether the endpoint is up (no data is revealed). */
function doGet() {
  return json_({ ok: true, service: 'registration-endpoint', accepting: prop_('ACCEPTING') === 'true' });
}

/* ---------------- core ---------------- */

function handle_(d) {
  var type = d.type === 'contact' ? 'contact' : d.type === 'booking' ? 'booking' : null;
  if (!type) return { ok: false, error: 'validation', fields: { type: 'Unknown form type.' } };
  if (prop_('ACCEPTING') !== 'true') return { ok: false, error: 'closed' };

  var isTest = d.mode === 'test';
  if (isTest && prop_('ALLOW_TEST') !== 'true') return { ok: false, error: 'closed' };

  // Reject fields we don't expect (protects the sheet from junk columns and probing).
  var unexpected = Object.keys(d).filter(function (k) { return CONFIG.FIELDS[type].indexOf(k) === -1; });
  if (unexpected.length) return { ok: false, error: 'validation', fields: { _form: 'Unexpected fields: ' + unexpected.slice(0, 5).join(', ') } };

  // No reference from a no-JavaScript submission: create one on the server.
  var ref = String(d.ref || '').trim();
  if (!ref) ref = makeRef_(type === 'contact' ? 'MSG' : 'REQ');
  if (!CONFIG.REF_RE.test(ref)) return { ok: false, error: 'validation', fields: { _form: 'Invalid reference.' } };

  // Spam traps: honeypot filled, or the form was submitted faster than a person could.
  // We answer "ok" so bots learn nothing, but we do NOT save anything.
  var tooFast = d.client === 'js' && Number(d.elapsedMs) >= 0 && Number(d.elapsedMs) < CONFIG.MIN_ELAPSED_MS;
  if (str_(d.website) || tooFast) return { ok: true, ref: ref, test: isTest };

  var v = type === 'booking' ? validateBooking_(d) : validateContact_(d);
  if (v.errors) return { ok: false, error: v.errors._trip ? 'trip_not_allowed' : 'validation', fields: v.errors };

  var cache = CacheService.getScriptCache();
  // Duplicate: the browser retried after a timeout. Treat as success, don't write twice.
  if (cache.get('ref:' + ref)) return { ok: true, ref: ref, duplicate: true, test: isTest };

  // Rate limits: per person (by phone/email) and for the whole endpoint.
  var personKey = 'rl:' + hash_(type + '|' + (type === 'booking' ? v.clean.phone : v.clean.replyTo).toLowerCase());
  var minuteKey = 'rl:all:' + Math.floor(Date.now() / 60000);
  var personCount = Number(cache.get(personKey) || 0);
  var globalCount = Number(cache.get(minuteKey) || 0);
  if (personCount >= CONFIG.RATE.perPersonPer10Min || globalCount >= CONFIG.RATE.globalPerMinute) return { ok: false, error: 'rate_limited' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'busy' };
  try {
    var sheet = sheetFor_(type, isTest);
    if (refExists_(sheet, ref)) { cache.put('ref:' + ref, '1', 21600); return { ok: true, ref: ref, duplicate: true, test: isTest }; }
    var now = new Date();
    var c = v.clean;
    var row = type === 'booking'
      ? [now, ref, c.tripId, c.tripTitle, c.name, c.phone, c.email, c.university, c.participants, c.contactPreference, 'New', c.consentAt, c.sourcePage, c.notes]
      : [now, ref, c.name, c.replyTo, c.topic, c.tripId, c.message, 'New', c.consentAt, c.sourcePage];
    sheet.appendRow(row.map(safeCell_));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  cache.put('ref:' + ref, '1', 21600);
  cache.put(personKey, String(personCount + 1), 600);
  cache.put(minuteKey, String(globalCount + 1), 120);
  notify_(type, ref, v.clean, isTest);
  return { ok: true, ref: ref, test: isTest };
}

/* ---------------- validation ---------------- */

function validateBooking_(d) {
  var e = {}; var c = {};
  var trips = allowedTrips_();
  c.tripId = str_(d.tripId);
  if (!trips[c.tripId]) e._trip = 'This trip is not open for registration.';
  c.tripTitle = trips[c.tripId] || '';
  c.name = str_(d.name);
  if (c.name.length < 2 || c.name.length > CONFIG.MAX.name) e.name = 'Enter your full name (2–' + CONFIG.MAX.name + ' characters).';
  c.phone = normalizePhone_(d.phone);
  if (!c.phone || String(d.phone).length > CONFIG.MAX.phone) e.phone = 'Enter a valid mobile number.';
  c.email = str_(d.email);
  if (c.email && (!CONFIG.EMAIL_RE.test(c.email) || c.email.length > CONFIG.MAX.email)) e.email = 'Enter a valid email address, or leave it empty.';
  c.university = str_(d.university);
  if (c.university.length < 2 || c.university.length > CONFIG.MAX.university) e.university = 'Enter your university.';
  c.participants = Number(d.participants);
  if (!(c.participants % 1 === 0 && c.participants >= 1 && c.participants <= 10)) e.participants = 'Enter a number from 1 to 10.';
  c.contactPreference = str_(d.contactPreference);
  if (CONFIG.CONTACT_PREFS.indexOf(c.contactPreference) === -1) e.contactPreference = 'Choose how we should contact you.';
  if (c.contactPreference === 'email' && !c.email) e.email = 'Add an email address, or choose WhatsApp or a phone call.';
  c.notes = str_(d.notes);
  if (c.notes.length > CONFIG.MAX.notes) e.notes = 'Keep notes under ' + CONFIG.MAX.notes + ' characters.';
  if (/\b\d{5}-?\d{7}-?\d\b/.test(c.notes)) e.notes = 'Please remove the CNIC number from your notes.';
  if (!yes_(d.consentPrivacy)) e.consentPrivacy = 'Consent to the privacy policy is required.';
  if (!yes_(d.consentTerms)) e.consentTerms = 'Please confirm you understand this is not a confirmed booking.';
  c.consentAt = consentTime_(d.consentAt);
  c.sourcePage = str_(d.sourcePage).slice(0, CONFIG.MAX.sourcePage);
  return Object.keys(e).length ? { errors: e } : { clean: c };
}

function validateContact_(d) {
  var e = {}; var c = {};
  c.name = str_(d.name);
  if (c.name.length < 2 || c.name.length > CONFIG.MAX.name) e.name = 'Enter your name.';
  c.replyTo = str_(d.replyTo);
  var asPhone = normalizePhone_(c.replyTo);
  if (CONFIG.EMAIL_RE.test(c.replyTo) && c.replyTo.length <= CONFIG.MAX.replyTo) { /* email ok */ }
  else if (asPhone) c.replyTo = asPhone;
  else e.replyTo = 'Enter a valid email address or mobile number.';
  c.topic = str_(d.topic);
  if (CONFIG.TOPICS.indexOf(c.topic) === -1) e.topic = 'Choose a topic.';
  c.tripId = str_(d.tripId);
  if (c.tripId && !/^[a-z0-9-]{3,40}$/.test(c.tripId)) e.tripId = 'Unknown trip.';
  c.message = str_(d.message);
  if (c.message.length < 10 || c.message.length > CONFIG.MAX.message) e.message = 'Write a message of 10–' + CONFIG.MAX.message + ' characters.';
  if (!yes_(d.consentPrivacy)) e.consentPrivacy = 'Consent to the privacy policy is required.';
  c.consentAt = consentTime_(d.consentAt);
  c.sourcePage = str_(d.sourcePage).slice(0, CONFIG.MAX.sourcePage);
  return Object.keys(e).length ? { errors: e } : { clean: c };
}

/* ---------------- helpers ---------------- */

function parseRequest_(e) {
  if (!e) return {};
  var body = e.postData && e.postData.contents;
  if (body && body.length > 10000) throw new Error('Request too large');
  if (body && /^\s*\{/.test(body)) {
    var obj = JSON.parse(body);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Bad JSON');
    return obj;
  }
  // Plain HTML form post (visitor without JavaScript): fields arrive as parameters.
  var p = {}; var src = e.parameter || {};
  Object.keys(src).forEach(function (k) { p[k] = src[k]; });
  return p;
}

/** Text that starts with = + - @ (or a tab/CR) could run as a spreadsheet formula. Prefix it with ' so it stays text. */
function safeCell_(v) {
  if (v instanceof Date || typeof v === 'number') return v;
  var s = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function str_(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim();
}

function yes_(v) { return v === true || v === 'true' || v === 'yes' || v === 'on'; }

function consentTime_(v) {
  var t = Date.parse(String(v || ''));
  // Accept the browser's timestamp only if it is within a day of now; otherwise record server time.
  return !isNaN(t) && Math.abs(Date.now() - t) < 86400000 ? new Date(t).toISOString() : new Date().toISOString();
}

/** Same rules as js/whatsapp.js normalizeNumber + a Pakistani mobile check. Returns "+<digits>" or ''. */
function normalizePhone_(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s || !/^[+\d][\d\s()-]{6,19}$/.test(s)) return '';
  var plus = s.charAt(0) === '+';
  s = s.replace(/\D/g, '');
  if (!plus) { if (s.indexOf('00') === 0) s = s.slice(2); else if (s.charAt(0) === '0') s = '92' + s.slice(1); }
  if (!/^[1-9]\d{9,14}$/.test(s)) return '';
  if (s.indexOf('92') === 0 && !/^923\d{9}$/.test(s)) return '';
  return '+' + s;
}

function allowedTrips_() {
  try { var t = JSON.parse(prop_('ALLOWED_TRIPS') || '{}'); return t && typeof t === 'object' ? t : {}; } catch (e) { return {}; }
}

function sheetFor_(type, isTest) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = CONFIG.SHEETS[type] + (isTest ? CONFIG.TEST_SUFFIX : '');
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(CONFIG.HEADERS[type]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function refExists_(sheet, ref) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var from = Math.max(2, last - 499); // check the most recent 500 rows
  var refs = sheet.getRange(from, 2, last - from + 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) if (String(refs[i][0]) === ref) return true;
  return false;
}

function makeRef_(prefix) {
  var alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  var hex = Utilities.getUuid().replace(/-/g, '');
  var out = '';
  for (var i = 0; i < 8; i++) out += alphabet.charAt(parseInt(hex.substr(i * 2, 2), 16) % alphabet.length);
  return prefix + '-' + out.slice(0, 4) + '-' + out.slice(4);
}

function hash_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).slice(0, 22);
}

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Reply page for visitors without JavaScript (plain HTML form posts). */
function htmlReply_(r) {
  var site = prop_('SITE_URL') || '';
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var body = r.ok
    ? '<h1>Request received</h1><p>Your request was saved. Your reference is <strong>' + esc(r.ref) + '</strong>. This is not a booking yet; we will contact you with next steps.</p>'
    : '<h1>Your request was not saved</h1><p>' + (r.error === 'validation' ? 'Some details were missing or invalid: ' + esc(Object.keys(r.fields || {}).join(', ')) + '.' : 'Please try again later or contact us directly.') + '</p>';
  var link = site ? '<p><a href="' + esc(site) + '" target="_top">Back to the website</a></p>' : '';
  return HtmlService.createHtmlOutput('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:system-ui,sans-serif;max-width:560px;margin:3rem auto;padding:0 1rem;line-height:1.5">' + body + link + '</div>');
}

function notify_(type, ref, c, isTest) {
  var to = prop_('NOTIFY_EMAIL');
  if (!to) return;
  try {
    var subject = (isTest ? '[TEST] ' : '') + (type === 'booking' ? 'New registration ' : 'New message ') + ref;
    var text = type === 'booking'
      ? 'Trip: ' + c.tripTitle + ' (' + c.tripId + ')\nParticipants: ' + c.participants + '\nContact by: ' + c.contactPreference + '\n\nOpen the spreadsheet to see the details.'
      : 'Topic: ' + c.topic + '\n\nOpen the spreadsheet to read the message.';
    MailApp.sendEmail(to, subject, text);
  } catch (err) { console.error('notify failed', err); }
}

/* ---------------- run this once from the editor to test your setup ---------------- */
function selfTest() {
  var before = prop_('ACCEPTING');
  var res = handle_({ type: 'booking', ref: makeRef_('REQ'), tripId: Object.keys(allowedTrips_())[0] || 'missing', name: 'Setup Test', phone: '03001234567', university: 'Test University', participants: 1, contactPreference: 'whatsapp', consentPrivacy: true, consentTerms: true, mode: 'test', client: 'editor' });
  console.log('ACCEPTING=' + before + ' ALLOW_TEST=' + prop_('ALLOW_TEST') + ' → ' + JSON.stringify(res));
  return res;
}
