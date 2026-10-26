#!/usr/bin/env node
/* Tests for integrations/google-apps-script/Code.gs (run in Node with fakes).
   Run: node scripts/test-apps-script.mjs   (also part of `npm test`) */
import assert from 'node:assert/strict';
import { createHarness } from './lib/gas-harness.mjs';

const TRIPS = JSON.stringify({ 'galiyat-weekend-01': 'Nathiagali and Ayubia weekend' });
let n = 0; let refN = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const ref = (p = 'REQ') => `${p}-TEST-${String(++refN).padStart(4, '0')}`;
const booking = (over = {}) => ({
  type: 'booking', ref: ref(), tripId: 'galiyat-weekend-01', tripTitle: 'anything', name: 'Ayesha Khan', phone: '0300 1234567',
  email: '', university: 'University of Lahore', participants: 2, contactPreference: 'whatsapp', notes: 'Travelling with a friend',
  consentPrivacy: true, consentTerms: true, consentAt: new Date().toISOString(), sourcePage: '/trips/x.html',
  website: '', elapsedMs: 15000, mode: 'live', client: 'js', ...over,
});
const contact = (over = {}) => ({
  type: 'contact', ref: ref('MSG'), name: 'Bilal', replyTo: 'bilal@example.com', topic: 'trip-question', tripId: '',
  message: 'Is the coach air-conditioned?', consentPrivacy: true, consentAt: new Date().toISOString(), sourcePage: '/contact.html',
  website: '', elapsedMs: 9000, mode: 'live', client: 'js', ...over,
});

console.log('Code.gs');
t('saves a valid booking with the server-side trip title and normalised phone', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  const b = booking();
  const r = h.post(b);
  assert.deepEqual(r, { ok: true, ref: b.ref, test: false });
  const rows = h.sheets.get('Registrations').rows;
  assert.equal(rows.length, 2); // header + row
  assert.equal(rows[0][1], 'Reference');
  assert.equal(rows[1][1], b.ref);
  assert.equal(rows[1][3], 'Nathiagali and Ayubia weekend'); // not the client's "anything"
  assert.equal(rows[1][5], "'+923001234567"); // phone kept as text
  assert.equal(rows[1][10], 'New');
});
t('test mode writes to the "(Test)" tab only', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  const r = h.post(booking({ mode: 'test' }));
  assert.equal(r.ok, true); assert.equal(r.test, true);
  assert.ok(h.sheets.get('Registrations (Test)')); assert.ok(!h.sheets.get('Registrations'));
});
t('test submissions are refused when ALLOW_TEST is not "true"', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS, ALLOW_TEST: 'false' });
  assert.deepEqual(h.post(booking({ mode: 'test' })), { ok: false, error: 'closed' });
});
t('everything is refused while ACCEPTING is not "true"', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS, ACCEPTING: 'false' });
  assert.equal(h.post(booking()).error, 'closed');
});
t('rejects trips that are not on the allowlist', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  assert.equal(h.post(booking({ tripId: 'made-up-trip' })).error, 'trip_not_allowed');
});
t('rejects unexpected fields', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  const r = h.post(booking({ cnic: '35202-1234567-1' }));
  assert.equal(r.error, 'validation'); assert.match(r.fields._form, /cnic/);
});
t('validates required fields, lengths, phone, email and consent', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  const r = h.post(booking({ name: 'A', phone: '12345', email: 'nope', university: '', participants: 40, contactPreference: 'pigeon', notes: 'x'.repeat(501), consentPrivacy: false, consentTerms: 'no' }));
  assert.equal(r.error, 'validation');
  ['name', 'phone', 'email', 'university', 'participants', 'contactPreference', 'notes', 'consentPrivacy', 'consentTerms'].forEach((k) => assert.ok(r.fields[k], `expected error for ${k}`));
});
t('rejects a CNIC number in the notes', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  assert.ok(h.post(booking({ notes: 'my cnic 35202-1234567-1' })).fields.notes);
});
t('rejects non-mobile Pakistani numbers but accepts international ones', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  assert.ok(h.post(booking({ phone: '042 35761234' })).fields.phone); // landline
  assert.equal(h.post(booking({ phone: '+44 7700 900123' })).ok, true);
});
t('neutralises spreadsheet formulas in every text field', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  h.post(booking({ name: '=HYPERLINK("http://evil","x")', university: '+SUM(A1)', notes: '@cmd' }));
  const row = h.sheets.get('Registrations').rows[1];
  assert.equal(row[4], '\'=HYPERLINK("http://evil","x")');
  assert.equal(row[7], "'+SUM(A1)");
  assert.equal(row[13], "'@cmd");
});
t('honeypot or instant submissions get "ok" but nothing is saved', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  assert.equal(h.post(booking({ website: 'http://spam' })).ok, true);
  assert.equal(h.post(booking({ elapsedMs: 300 })).ok, true);
  assert.ok(!h.sheets.get('Registrations'));
});
t('a retried submission with the same reference is not saved twice', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  const b = booking();
  assert.equal(h.post(b).ok, true);
  const again = h.post(b);
  assert.equal(again.ok, true); assert.equal(again.duplicate, true);
  h.cache.delete(`ref:${b.ref}`); // even if the cache expired, the sheet is checked
  assert.equal(h.post(b).duplicate, true);
  assert.equal(h.sheets.get('Registrations').rows.length, 2);
});
t('limits each person to 3 requests per 10 minutes', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  for (let i = 0; i < 3; i++) assert.equal(h.post(booking()).ok, true);
  assert.equal(h.post(booking()).error, 'rate_limited');
  assert.equal(h.post(booking({ phone: '03111234567' })).ok, true); // someone else is fine
});
t('limits the whole endpoint to 30 saved requests per minute', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  for (let i = 0; i < 30; i++) assert.equal(h.post(booking({ phone: `0300${String(1000000 + i)}` })).ok, true);
  assert.equal(h.post(booking({ phone: '03459999999' })).error, 'rate_limited');
});
t('rejects malformed references and bodies', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  assert.equal(h.post(booking({ ref: 'DROP TABLE' })).error, 'validation');
  assert.equal(h.post('not json at all {', { raw: true }).ok, false);
  assert.equal(h.post('x'.repeat(20000), { raw: true }).error, 'server_error');
});
t('saves a valid contact message to the Contact tab', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  const c = contact();
  assert.equal(h.post(c).ok, true);
  const row = h.sheets.get('Contact').rows[1];
  assert.equal(row[1], c.ref); assert.equal(row[3], 'bilal@example.com'); assert.equal(row[4], 'trip-question');
});
t('contact form validates reply address and topic', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  const r = h.post(contact({ replyTo: 'not-an-address', topic: 'hack', message: 'short' }));
  assert.ok(r.fields.replyTo && r.fields.topic && r.fields.message);
});
t('no-JavaScript form posts are accepted and answered with an HTML page', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS });
  const r = h.post(null, { params: { type: 'booking', tripId: 'galiyat-weekend-01', name: 'Sara Ali', phone: '03001234567', email: '', university: 'UOL', participants: '1', contactPreference: 'call', notes: '', consentPrivacy: 'yes', consentTerms: 'yes', website: '', formatHint: 'html' } });
  assert.match(r.html, /Request received/); assert.match(r.html, /REQ-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  assert.match(r.html, /https:\/\/example\.org\/site/);
});
t('sends a short notification without personal notes when NOTIFY_EMAIL is set', () => {
  const h = createHarness({ ALLOWED_TRIPS: TRIPS, NOTIFY_EMAIL: 'team@example.org' });
  h.post(booking({ notes: 'private detail' }));
  assert.equal(h.mail.length, 1); assert.ok(!h.mail[0].body.includes('private detail'));
});
t('doGet reports status without revealing data', () => {
  assert.deepEqual(createHarness().get(), { ok: true, service: 'registration-endpoint', accepting: true });
});
console.log(`${n} passed`);
