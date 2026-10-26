/* ==================================================================
   form-utils.js — field validation shared by the booking and contact
   forms. The same limits are enforced again on the server in
   integrations/google-apps-script/Code.gs; keep the two in step.
   ================================================================== */
import { normalizeNumber } from './whatsapp.js';

export const LIMITS = { name: 80, phone: 20, email: 120, university: 100, notes: 500, replyTo: 120, message: 1500 };
export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/** Pakistani mobile (03XXXXXXXXX) or international (+ and 10–15 digits). */
export function validPhone(v) {
  const s = String(v || '').trim();
  if (!/^[+\d][\d\s()-]{6,19}$/.test(s)) return false;
  const n = normalizeNumber(s);
  if (!n) return false;
  if (n.startsWith('92')) return /^923\d{9}$/.test(n); // Pakistani mobile numbers
  return true;
}

export function textError(value, { label, required = false, min = 0, max }) {
  const v = String(value || '').trim();
  if (required && !v) return `Enter your ${label}.`;
  if (v && min && v.length < min) return `Your ${label} looks too short.`;
  if (v && max && v.length > max) return `Keep your ${label} under ${max} characters.`;
  return '';
}

/** Show or clear an error under a field, wiring aria-invalid for screen readers. */
export function setError(form, name, message) {
  const box = form.querySelector(`[data-error-for="${name}"]`);
  const inputs = form.querySelectorAll(`[name="${name}"]`);
  inputs.forEach((el) => {
    el.classList.toggle('is-invalid', !!message && el.type !== 'radio' && el.type !== 'checkbox');
    if (message) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  });
  if (box) { box.textContent = message || ''; box.hidden = !message; }
}

export function clearErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((b) => { b.hidden = true; b.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
}

/** Focus the first invalid field so keyboard and screen-reader users land on it. */
export function focusFirstError(form) {
  const el = form.querySelector('[aria-invalid="true"]');
  if (el) el.focus();
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
