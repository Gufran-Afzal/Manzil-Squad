#!/usr/bin/env node
/* Unit tests for js/whatsapp.js. Run: node scripts/test-whatsapp.mjs */
import assert from 'node:assert/strict';
import { normalizeNumber, buildMessage, buildLink } from '../js/whatsapp.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log('whatsapp.js');
t('normalises +92 with spaces', () => assert.equal(normalizeNumber('+92 300 1234567'), '923001234567'));
t('normalises 0092 prefix', () => assert.equal(normalizeNumber('0092-300-1234567'), '923001234567'));
t('normalises Pakistani local 03xx', () => assert.equal(normalizeNumber('0300 1234567'), '923001234567'));
t('keeps digits-only international', () => assert.equal(normalizeNumber('923001234567'), '923001234567'));
t('rejects empty and junk', () => { assert.equal(normalizeNumber(''), ''); assert.equal(normalizeNumber(null), ''); assert.equal(normalizeNumber('abc'), ''); });
t('rejects too short / too long', () => { assert.equal(normalizeNumber('12345'), ''); assert.equal(normalizeNumber('+1234567890123456'), ''); });
t('no link without a number', () => assert.equal(buildLink('', 'hi'), ''));
t('link encodes message', () => {
  const url = buildLink('923001234567', 'Hello & welcome?\nLine 2 #3');
  assert.equal(url, 'https://wa.me/923001234567?text=Hello%20%26%20welcome%3F%0ALine%202%20%233');
  assert.equal(new URL(url).searchParams.get('text'), 'Hello & welcome?\nLine 2 #3');
});
t('booking message has trip, id, count, ref; no brand placeholder', () => {
  const m = buildMessage({ context: 'booking', brand: '[Brand Name]', trip: { id: 'galiyat-weekend-01', title: 'Nathiagali and Ayubia weekend' }, ref: 'REQ-7K3F9Q2M', participants: '2' });
  assert.match(m, /^Hello,\n/);
  assert.match(m, /Nathiagali and Ayubia weekend \(trip ID galiyat-weekend-01\)/);
  assert.match(m, /Number of people: 2\./);
  assert.match(m, /My reference: REQ-7K3F9Q2M\./);
});
t('message uses real brand when configured', () => assert.match(buildMessage({ brand: 'Example Trips' }), /^Hello Example Trips,/));
t('message strips control characters and caps length', () => {
  const m = buildMessage({ context: 'trip', trip: { id: 'x\u0000y', title: 'A'.repeat(500) } });
  assert.ok(!/\u0000/.test(m)); assert.ok(m.length < 300);
});
t('ignores implausible participant counts', () => assert.ok(!/Number of people/.test(buildMessage({ participants: '500' }))));
console.log(`${passed} passed`);
