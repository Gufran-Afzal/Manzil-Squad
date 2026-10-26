/* ==================================================================
   booking-service.js — the only code that talks to the Google Apps
   Script endpoint. Used by booking.js and contact.js.

   How the request works (and why)
   - GitHub Pages can't run server code, so submissions go to a Google
     Apps Script web app (see docs/GOOGLE_SHEETS_SETUP.md).
   - We POST JSON with Content-Type text/plain. That counts as a
     "simple" cross-origin request, so the browser sends no CORS
     preflight (Apps Script can't answer preflights). Apps Script
     replies with a redirect to script.googleusercontent.com, which
     returns our JSON with Access-Control-Allow-Origin: *, so we CAN
     read the reply and know whether the row was really saved.
   - We do NOT use mode: 'no-cors'. With no-cors the browser hides the
     reply, so the site could never honestly say "saved".

   Outcomes, kept honest
   - saved:     the script replied ok: the row is in the sheet.
   - rejected:  the script replied with a reason (validation, limit…).
   - unknown:   network error, timeout or unreadable reply. The row MAY
                have been saved. The UI says so and offers WhatsApp.
                Retrying is safe: the same reference is reused and the
                script ignores duplicates.
   - off:       online forms are switched off in content/site.json.
   ================================================================== */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L
export function makeRef(prefix = 'REQ') {
  const bytes = new Uint8Array(8);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${prefix}-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** A stable reference per form until it is successfully sent, so retries don't create duplicates. */
export function refFor(formKey, prefix) {
  const key = `ref:${formKey}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const ref = makeRef(prefix);
    sessionStorage.setItem(key, ref);
    return ref;
  } catch {
    return makeRef(prefix);
  }
}
export function forgetRef(formKey) { try { sessionStorage.removeItem(`ref:${formKey}`); } catch { /* ignore */ } }

/**
 * @param {object} payload  the fields to send (already validated)
 * @param {{mode:string, endpoint:string}} forms  from the site config
 * @returns {Promise<{status:'saved'|'rejected'|'unknown'|'off', ref?:string, error?:string, fields?:object}>}
 */
export async function submit(payload, forms, { timeoutMs = 15000 } = {}) {
  if (!forms || forms.mode === 'off' || !forms.endpoint) return { status: 'off' };
  const body = JSON.stringify({ ...payload, mode: forms.mode, client: 'js' });
  const ctrl = 'AbortController' in window ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await fetch(forms.endpoint, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      signal: ctrl?.signal,
    });
  } catch (err) {
    return { status: 'unknown', error: err?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    if (timer) clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch { return { status: 'unknown', error: 'unreadable_reply' }; }
  if (data && data.ok === true && data.ref === payload.ref) return { status: 'saved', ref: data.ref, duplicate: !!data.duplicate, test: !!data.test };
  if (data && data.ok === false) return { status: 'rejected', error: String(data.error || 'rejected'), fields: data.fields || {} };
  return { status: 'unknown', error: 'unexpected_reply' };
}
