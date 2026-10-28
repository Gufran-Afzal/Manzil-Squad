/* ==================================================================
   contact.js — the contact form. Same honest states as booking.js;
   messages are saved to the "Contact" tab of the Google Sheet.
   ================================================================== */
import { submit, refFor, forgetRef } from './booking-service.js';
import { buildLink, buildMessage } from './whatsapp.js';
import { LIMITS, EMAIL_RE, validPhone, textError, setError, clearErrors, focusFirstError, escapeHtml } from './form-utils.js';

export function init(config) {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;
  const statusBox = form.querySelector('[data-form-status]');
  const button = form.querySelector('[data-submit]');
  const label = button.querySelector('.btn__label');
  const startedAt = Date.now();
  const formKey = 'contact';
  let busy = false;

  ['name', 'replyTo', 'message'].forEach((n) => {
    const el = form.elements[n];
    el.addEventListener('blur', () => { if (el.value) setError(form, n, validate()[n]); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid')) setError(form, n, ''); });
  });

  function validate() {
    const e = {};
    e.name = textError(form.elements.namedItem('name').value, { label: 'name', required: true, min: 2, max: LIMITS.name });
    const r = form.replyTo.value.trim();
    if (!r) e.replyTo = 'Enter an email address or mobile number so we can reply.';
    else if (!(EMAIL_RE.test(r) || validPhone(r)) || r.length > LIMITS.replyTo) e.replyTo = 'Enter a valid email address or mobile number.';
    e.message = textError(form.message.value, { label: 'message', required: true, min: 10, max: LIMITS.message });
    if (!form.consentPrivacy.checked) e.consent = 'Tick the box so we can use your details to reply.';
    return e;
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (busy) return;
    clearErrors(form);
    const errors = validate();
    const keys = Object.keys(errors).filter((k) => errors[k]);
    if (keys.length) { keys.forEach((k) => setError(form, k, errors[k])); focusFirstError(form); return; }
    const ref = refFor(formKey, 'MSG');
    const opt = form.tripId.selectedOptions[0];
    const payload = {
      type: 'contact', ref,
      name: form.elements.namedItem('name').value.trim(), replyTo: form.replyTo.value.trim(), topic: form.topic.value,
      tripId: form.tripId.value, message: form.message.value.trim(),
      consentPrivacy: true, consentAt: new Date().toISOString(),
      sourcePage: location.pathname, website: form.website.value, elapsedMs: Date.now() - startedAt,
    };
    if (payload.website) { show('success', ref, opt); return; }
    busy = true; button.disabled = true; button.classList.add('is-loading'); label.textContent = 'Sending…';
    show('sending', ref, opt);
    const result = await submit(payload, config.forms);
    busy = false; button.disabled = false; button.classList.remove('is-loading'); label.textContent = 'Send message';
    document.dispatchEvent(new CustomEvent('site:form', { detail: { event: `contact_${result.status}`, form: 'contact' } }));
    if (result.status === 'saved') { forgetRef(formKey); show('success', ref, opt, result.test); form.classList.add('is-done'); return; }
    if (result.status === 'rejected' && result.error === 'validation') {
      Object.entries(result.fields || {}).forEach(([k, m]) => setError(form, k === 'consentPrivacy' ? 'consent' : k, String(m)));
      focusFirstError(form);
    }
    show(result.status === 'rejected' ? `rejected-${result.error}` : result.status, ref, opt);
  });

  function show(kind, ref, opt, test = false) {
    const trip = opt && opt.value ? { id: opt.value, title: opt.textContent } : null;
    const wa = buildLink(config.whatsapp, buildMessage({ context: 'contact', brand: config.brand, trip, ref }));
    const waBtn = wa ? `<a class="btn btn--accent btn--small" href="${escapeHtml(wa)}" target="_blank" rel="noopener noreferrer">Message us on WhatsApp<span class="visually-hidden"> (opens WhatsApp; press Send to send)</span></a>` : '';
    const mail = config.email ? `<a class="btn btn--ghost btn--small" href="mailto:${escapeHtml(config.email)}?subject=${encodeURIComponent(`Message ${ref}`)}">Email us instead</a>` : '';
    const fb = waBtn || mail ? `<div class="status-actions">${waBtn}${mail}</div>` : '';
    const states = {
      sending: ['pending', 'Sending your message…', ''],
      success: ['success', test ? 'Test message saved' : 'Message sent', `<p>Thank you. Your message was saved and we'll reply using the details you gave.</p><p class="status-ref">Reference <span class="status-ref__code">${escapeHtml(ref)}</span></p>`],
      off: ['offline', 'The contact form is not switched on yet', `<p>Please use ${fb ? 'one of the options below' : 'the other contact options on this page'} for now.</p>${fb}`],
      unknown: ['pending', "We couldn't confirm your message arrived", `<p>It may still have been saved. To be sure, contact us directly and mention reference <strong>${escapeHtml(ref)}</strong>. Sending again is safe; it won't create a duplicate.</p>${fb}`],
      'rejected-validation': ['error', 'Please check the highlighted fields', ''],
      'rejected-rate_limited': ['error', 'Too many messages', `<p>Please wait a few minutes before sending another message.</p>${fb}`],
    };
    const [tone, title, body] = states[kind] || ['error', 'Your message was not sent', `<p>Please try again, or contact us directly.</p>${fb}`];
    statusBox.className = `form__status form__status--${tone}`;
    statusBox.innerHTML = `<h3>${escapeHtml(title)}</h3>${body}`;
    statusBox.hidden = false;
    if (kind !== 'sending') statusBox.focus();
  }
}
