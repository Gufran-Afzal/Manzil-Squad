/* ==================================================================
   whatsapp.js — the ONE place WhatsApp click-to-chat links are made.

   Used twice:
   - at build time (build.mjs imports it) to write static links into
     the HTML, so they work without JavaScript;
   - in the browser (booking.js, contact.js) to add the trip and the
     visitor's reference number to the prefilled message.

   A wa.me link only opens WhatsApp with a draft message. The visitor
   still has to press Send — nothing is sent automatically.
   Keep personal data out of these links: they can end up in browser
   history and server logs. We include the trip, a reference number
   and a participant count, never names, phone numbers or notes.
   ================================================================== */

/**
 * Normalise a phone number to international digits only (wa.me format).
 * Accepts "+92 300 1234567", "0092-300-1234567" or a Pakistani local
 * "0300 1234567" (assumes country code 92 for a leading single 0).
 * Returns '' when the result is not a plausible international number.
 */
export function normalizeNumber(raw, defaultCountry = '92') {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (!s) return '';
  const hadPlus = s.startsWith('+');
  s = s.replace(/[^\d]/g, '');
  if (!hadPlus) {
    if (s.startsWith('00')) s = s.slice(2);
    else if (s.startsWith('0')) s = defaultCountry + s.slice(1);
  }
  if (s.startsWith('0')) return '';
  return /^\d{10,15}$/.test(s) ? s : '';
}

const clean = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Build the draft message.
 * context: 'general' | 'trip' | 'booking' | 'contact' | 'fallback'
 */
export function buildMessage({ context = 'general', brand = '', trip = null, ref = '', participants = '' } = {}) {
  const lines = [];
  const who = brand && !/^\s*\[.*\]\s*$/.test(brand) ? ` ${clean(brand, 60)}` : '';
  lines.push(`Hello${who},`);
  if (trip && trip.title) {
    if (context === 'booking' || context === 'fallback') lines.push(`I'd like to register interest in: ${clean(trip.title)} (trip ID ${clean(trip.id, 40)}).`);
    else lines.push(`I have a question about: ${clean(trip.title)} (trip ID ${clean(trip.id, 40)}).`);
  } else if (context === 'contact') {
    lines.push('I have a question about your trips.');
  } else {
    lines.push("I'd like to know more about your upcoming trips.");
  }
  const n = parseInt(participants, 10);
  if (n > 0 && n <= 20) lines.push(`Number of people: ${n}.`);
  if (ref) lines.push(`My reference: ${clean(ref, 24)}.`);
  return lines.join('\n');
}

/** Full https://wa.me/ link, or '' when the number is not configured. */
export function buildLink(number, message = '') {
  const n = normalizeNumber(number);
  if (!n) return '';
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
