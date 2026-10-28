/* ==================================================================
   booking.js — the "register interest" form, and the reference card on
   booking-success.html.

   Flow: validate in the browser → send through booking-service.js →
   show one of four honest states (saved / rejected / unknown / off).
   A saved request goes to booking-success.html with its reference.
   Registration is never presented as a confirmed booking.
   ================================================================== */
import { submit, refFor, forgetRef } from './booking-service.js';
import { buildLink, buildMessage } from './whatsapp.js';
import { LIMITS, EMAIL_RE, validPhone, textError, setError, clearErrors, focusFirstError, escapeHtml } from './form-utils.js';

export function init(config) {
  document.querySelectorAll('[data-booking-form]').forEach((form) => setupForm(form, config));
  setupSuccessPage(config);
}

function emit(event, form) { document.dispatchEvent(new CustomEvent('site:form', { detail: { event, form } })); }

function setupForm(form, config) {
  const select = form.querySelector('[data-trip-select]');
  const statusBox = form.querySelector('[data-form-status]');
  const button = form.querySelector('[data-submit]');
  const label = button.querySelector('.btn__label');
  const waDynamic = form.querySelector('[data-whatsapp-dynamic]');
  const startedAt = Date.now();
  const formKey = `booking:${location.pathname}`;
  let busy = false;

  // ?trip=<id> preselects a trip on booking.html
  const wanted = new URLSearchParams(location.search).get('trip');
  if (select && wanted && [...select.options].some((o) => o.value === wanted)) select.value = wanted;

  const trip = () => {
    const opt = select?.selectedOptions[0];
    return opt ? { id: opt.value, title: opt.getAttribute('data-title') || opt.textContent } : null;
  };
  const waLink = (ref) => buildLink(config.whatsapp, buildMessage({ context: 'booking', brand: config.brand, trip: trip(), ref, participants: form.participants?.value }));
  const syncWa = () => { if (waDynamic) { const href = waLink(''); if (href) waDynamic.href = href; } };
  select?.addEventListener('change', syncWa);
  form.participants?.addEventListener('change', syncWa);
  syncWa();

  // validate a field when the visitor leaves it, and clear the error as they fix it
  ['name', 'phone', 'email', 'university', 'participants', 'notes'].forEach((n) => {
    const el = form.elements[n];
    if (!el) return;
    el.addEventListener('blur', () => { if (el.value) setError(form, n, validate(form)[n]); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid')) setError(form, n, ''); });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return; // ignore double clicks while a request is in flight
    clearErrors(form);
    const errors = validate(form);
    const keys = Object.keys(errors).filter((k) => errors[k]);
    if (keys.length) {
      keys.forEach((k) => setError(form, k, errors[k]));
      if (errors.consent) form.querySelectorAll('.check').forEach((c) => c.classList.toggle('is-invalid', !c.querySelector('input').checked));
      focusFirstError(form);
      emit('register_invalid', 'booking');
      return;
    }
    form.querySelectorAll('.check').forEach((c) => c.classList.remove('is-invalid'));

    const ref = refFor(formKey, 'REQ');
    const t = trip();
    const payload = {
      type: 'booking', ref,
      tripId: t.id, tripTitle: t.title,
      name: form.elements.namedItem('name').value.trim(), phone: form.phone.value.trim(), email: form.email.value.trim(),
      university: form.university.value.trim(), participants: Number(form.participants.value),
      contactPreference: form.contactPreference.value, notes: form.notes.value.trim(),
      consentPrivacy: true, consentTerms: true, consentAt: new Date().toISOString(),
      sourcePage: location.pathname, website: form.website.value, elapsedMs: Date.now() - startedAt,
    };

    // Honeypot filled in: almost certainly a bot. Don't send anything.
    if (payload.website) { showStatus('success-bot', { ref }); return; }

    busy = true; setLoading(true);
    showStatus('sending');
    const result = await submit(payload, config.forms);
    busy = false; setLoading(false);
    emit(`register_${result.status}`, 'booking');

    if (result.status === 'saved') {
      forgetRef(formKey);
      try { sessionStorage.setItem('lastBooking', JSON.stringify({ ref, trip: t.title, test: result.test })); } catch { /* ignore */ }
      const base = config.root || './';
      // Script-driven navigation: skip the decorative page transition (Chrome can abort it mid-way).
      window.addEventListener('pageswap', (ev) => { if (ev.viewTransition) { ev.viewTransition.ready.catch(() => {}); ev.viewTransition.finished.catch(() => {}); ev.viewTransition.skipTransition(); } }, { once: true });
      location.assign(`${base}booking-success.html?ref=${encodeURIComponent(ref)}`);
      return;
    }
    if (result.status === 'rejected') {
      if (result.error === 'validation' && result.fields) {
        Object.entries(result.fields).forEach(([k, msg]) => setError(form, k === 'consentPrivacy' || k === 'consentTerms' ? 'consent' : k, String(msg)));
        showStatus('rejected-fields', { ref });
        focusFirstError(form);
      } else showStatus(`rejected-${result.error}`, { ref });
      return;
    }
    showStatus(result.status, { ref });
  });

  function setLoading(on) {
    button.disabled = on;
    button.classList.toggle('is-loading', on);
    button.setAttribute('aria-busy', String(on));
    label.textContent = on ? 'Sending…' : 'Send registration request';
  }

  function showStatus(kind, { ref = '' } = {}) {
    const wa = waLink(ref);
    const waBtn = wa ? `<a class="btn btn--accent btn--small" href="${escapeHtml(wa)}" target="_blank" rel="noopener noreferrer">Continue on WhatsApp<span class="visually-hidden"> (opens WhatsApp; press Send to send)</span></a>` : '';
    const mail = config.email ? `<a class="btn btn--ghost btn--small" href="mailto:${escapeHtml(config.email)}?subject=${encodeURIComponent(`Trip registration ${ref}`)}&body=${encodeURIComponent(buildMessage({ context: 'booking', brand: config.brand, trip: trip(), ref, participants: form.participants.value }))}">Email us instead</a>` : '';
    const fallbacks = waBtn || mail ? `<div class="status-actions">${waBtn}${mail}</div>` : '<p>Please try again later, or use the contact page.</p>';
    const refHtml = ref ? `<p class="status-ref">Reference <span class="status-ref__code">${escapeHtml(ref)}</span></p>` : '';
    const states = {
      sending: ['pending', 'Sending your request…', '<p>This usually takes a few seconds. Please keep this page open.</p>'],
      off: ['offline', 'Online registration is not switched on yet', `<p>We're still setting up online registration. You can send the same details on WhatsApp${config.email ? ' or by email' : ''}: WhatsApp opens with a draft message that includes your reference, and you press Send.</p>${refHtml}${fallbacks}`],
      unknown: ['pending', "We couldn't confirm your request arrived", `<p>Your connection may have dropped, or our form service may be slow. Your request <strong>may</strong> still have been saved, so please don't keep resubmitting.</p>${refHtml}<p>To be sure, send us your reference on WhatsApp. Or wait a minute and press "Send registration request" again: using the same reference means you won't be registered twice.</p>${fallbacks}`],
      'rejected-fields': ['error', 'Please check the highlighted fields', '<p>Our form service could not accept some of the details. Fix the fields marked below and send again.</p>'],
      'rejected-rate_limited': ['error', 'Too many requests', `<p>We've received several requests from these details in a short time. Please wait a few minutes before trying again, or message us instead.</p>${refHtml}${fallbacks}`],
      'rejected-trip_not_allowed': ['error', 'This trip is not open for registration', '<p>Registration for this trip has closed or it is no longer offered. Choose another trip, or contact us.</p>'],
      'rejected-closed': ['error', 'Online registration is paused', `<p>We've paused online registration for now. You can still contact us directly.</p>${refHtml}${fallbacks}`],
      'success-bot': ['success', 'Request received', '<p>Thank you.</p>'],
    };
    const [tone, title, body] = states[kind] || ['error', 'Something went wrong', `<p>Your request was not saved. Please try again, or contact us directly.</p>${refHtml}${fallbacks}`];
    statusBox.className = `form__status form__status--${tone}`;
    statusBox.innerHTML = `<h3>${escapeHtml(title)}</h3>${body}`;
    statusBox.hidden = false;
    if (kind !== 'sending') statusBox.focus({ preventScroll: false });
  }
}

function validate(form) {
  const e = {};
  e.name = textError(form.elements.namedItem('name').value, { label: 'full name', required: true, min: 2, max: LIMITS.name });
  if (!form.phone.value.trim()) e.phone = 'Enter a mobile number so we can contact you.';
  else if (!validPhone(form.phone.value)) e.phone = 'Enter a valid mobile number, for example 0300 1234567 or +92 300 1234567.';
  const email = form.email.value.trim();
  if (email && (!EMAIL_RE.test(email) || email.length > LIMITS.email)) e.email = 'Enter a valid email address, or leave it empty.';
  if (form.contactPreference.value === 'email' && !email) e.email = 'Add an email address, or choose WhatsApp or a phone call.';
  e.university = textError(form.university.value, { label: 'university', required: true, min: 2, max: LIMITS.university });
  const n = Number(form.participants.value);
  if (!Number.isInteger(n) || n < 1 || n > 10) e.participants = 'Enter a number from 1 to 10.';
  e.notes = textError(form.notes.value, { label: 'note', max: LIMITS.notes });
  if (!e.notes && /\b\d{5}-?\d{7}-?\d\b/.test(form.notes.value)) e.notes = 'This looks like a CNIC number. Please remove it; we will ask privately if it is needed.';
  if (!form.consentPrivacy.checked || !form.consentTerms.checked) e.consent = 'Tick both boxes to continue.';
  return e;
}

/* ---------- booking-success.html: show the saved reference ---------- */
function setupSuccessPage(config) {
  const card = document.querySelector('[data-ref-card]');
  if (!card) return;
  const ref = new URLSearchParams(location.search).get('ref') || '';
  if (!/^REQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(ref)) return; // ignore anything unexpected
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem('lastBooking') || '{}'); } catch { /* ignore */ }
  card.querySelector('[data-ref-value]').textContent = ref;
  card.querySelector('[data-ref-trip]').textContent = saved.ref === ref && saved.trip ? `${saved.trip}${saved.test ? ' (test submission)' : ''}` : '';
  card.hidden = false;
  const title = document.querySelector('[data-success-title]');
  if (title) title.textContent = 'Request received';
  card.querySelector('[data-copy-ref]').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(ref); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Select and copy the reference above'; }
  });
  const wa = document.querySelector('[data-whatsapp-dynamic]');
  if (wa) {
    const href = buildLink(config.whatsapp, buildMessage({ context: 'general', brand: config.brand, ref }));
    if (href) wa.href = href;
  }
}
