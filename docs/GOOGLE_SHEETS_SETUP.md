# Saving form submissions to Google Sheets

The registration form and the contact form can save each submission as a row in a Google Sheet you own. GitHub Pages can't run server code, so a small, free **Google Apps Script web app** receives the submissions and writes the rows.

> **Status:** the Apps Script code is tested automatically (`npm run test:apps-script`, 20 checks) and the browser side is tested against a local copy of it (`npm run mock:forms`). It has **not** been deployed to a real Google account. Do the "Verify with a real test submission" step below before switching to live.

Until you finish this guide, `content/site.json` has `"forms": { "mode": "off" }`. In that mode the forms don't send anything: after validation, they show the visitor a WhatsApp draft and/or an email link with their reference number.

## How it works

1. The visitor fills in the form. The browser checks every field.
2. `js/booking-service.js` sends the fields as JSON to your Apps Script URL using `POST` with `Content-Type: text/plain`. That kind of request needs no CORS "preflight", which Apps Script can't answer.
3. Google replies with a redirect to `script.googleusercontent.com`, which returns the script's JSON answer. The browser can read it, so the site only says **"saved"** when the script confirms the row was written.
4. If the network fails or the reply can't be read, the site says **"We couldn't confirm your request arrived"**, shows the reference number and offers WhatsApp/email. It never claims success it can't see. Sending again is safe: the script ignores a reference it has already saved.

We deliberately do **not** use `fetch(..., { mode: 'no-cors' })`. With no-cors the browser hides the reply, so the site could never honestly report success.

## What gets saved

**Registrations** tab (and **Registrations (Test)** for test submissions):

| Column | Notes |
|---|---|
| Submitted at | Server time |
| Reference | e.g. `REQ-7K3F-Q9MP`, shown to the visitor |
| Trip ID | Must be on your allowlist |
| Trip title | Taken from the allowlist, not from the browser |
| Participant name | 2–80 characters |
| Phone | Stored as `+92…`; Pakistani numbers must be mobiles |
| Email | Optional; required if they chose "Email" as contact method |
| University | 2–100 characters |
| Participants | 1–10 |
| Contact preference | `whatsapp`, `call` or `email` |
| Booking status | Always `New`; you change it by hand (e.g. Contacted, Paid, Confirmed, Cancelled) |
| Consent at | When they ticked the consent boxes |
| Source page | Which page the form was on |
| Notes | Optional, up to 500 characters; CNIC numbers are rejected |

**Contact** tab (and **Contact (Test)**): Submitted at, Reference (`MSG-…`), Name, Reply to, Topic, Trip ID, Message, Status, Consent at, Source page.

The form never asks for CNIC numbers or images, card or bank details, passwords or medical information.

## Step 1: create the spreadsheet

1. Go to [sheets.google.com](https://sheets.google.com) with the Google account that should own the data (ideally a dedicated business account, not someone's personal one).
2. Create a blank spreadsheet and name it, e.g. "Website registrations".
3. You don't need to create tabs or headers: the script creates **Registrations**, **Contact** and the **(Test)** tabs, with headers, the first time each is used.

## Step 2: add the script

1. In the spreadsheet, open **Extensions → Apps Script**.
2. Delete the sample code in `Code.gs`.
3. Copy everything from `integrations/google-apps-script/Code.gs` in this project and paste it in.
4. Click **Save** (the disk icon).

## Step 3: set the script properties

In the Apps Script editor, open **Project Settings** (the gear icon) → **Script properties** → **Add script property**, and add:

| Property | Value |
|---|---|
| `ALLOWED_TRIPS` | Copy the line `npm run build` prints, e.g. `{"galiyat-weekend-01":"Nathiagali and Ayubia weekend"}` |
| `ACCEPTING` | `true` |
| `ALLOW_TEST` | `true` (for now) |
| `SITE_URL` | Your public site URL, e.g. `https://yourname.github.io/student-travel-site` |
| `NOTIFY_EMAIL` | Optional. An address that receives a short "new registration" email. Leave it out if you don't want emails |

Whenever you add, rename or close a trip, update `ALLOWED_TRIPS` with the new line from `npm run build`. A trip that isn't listed is rejected.

## Step 4: check the script runs

1. In the editor, choose the function **`selfTest`** from the dropdown next to **Run** and click **Run**.
2. Google asks you to authorise the script. Review the permissions (it needs access to this spreadsheet, and to send email only if you set `NOTIFY_EMAIL`) and allow them. If you see "Google hasn't verified this app", that's normal for your own script: choose **Advanced → Go to (project name)**.
3. Check the **Execution log**: it should end with `{"ok":true,…,"test":true}`.
4. In the spreadsheet, a **Registrations (Test)** tab now exists with one "Setup Test" row. Delete that row.

## Step 5: deploy as a web app

1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Description: `Website forms v1`.
4. **Execute as: Me** (so the script can write to your sheet).
5. **Who has access: Anyone** (visitors aren't signed in to Google; anything else makes the request fail).
6. Click **Deploy** and copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.

Open that URL in your browser. You should see `{"ok":true,"service":"registration-endpoint","accepting":true}`.

## Step 6: connect the website in test mode

In `content/site.json`:

```json
"forms": {
  "mode": "test",
  "endpoint": "https://script.google.com/macros/s/AKfy…/exec"
}
```

Build, commit and push. In test mode, the forms show a "Test mode" notice and rows go to the **(Test)** tabs.

## Step 7: verify with a real test submission

On the deployed website (not just locally):

1. Open a trip page and submit the registration form with your own details.
2. You should be taken to the "Request received" page with a reference number.
3. In the spreadsheet, check that **Registrations (Test)** has a row with **the same reference**.
4. Send the contact form too and check **Contact (Test)**.
5. Try submitting with a deliberately wrong phone number: the form should show an error and nothing should be saved.
6. Submit the same form twice quickly: only one row should appear.

Only if every check passes:

## Step 8: go live

1. In `content/site.json`, set `"mode": "live"`, then build and push.
2. In the script properties, set `ALLOW_TEST` to `false`.
3. Submit one real registration, check it appears in **Registrations**, then delete it.

> ⚠️ **Before going live**, have the privacy policy and booking terms reviewed, and be ready to answer every registration you receive. Live mode means real people's details arrive in your sheet.

## Updating the script later

Editing the code doesn't change the live web app by itself. After saving changes, choose **Deploy → Manage deployments**, edit (pencil icon) your deployment, set **Version: New version**, and click **Deploy**. The URL stays the same.

To pause submissions without touching the website, set `ACCEPTING` to `false`. Visitors are told that online registration is paused and offered your other contact options.

## Security, privacy and limits

- **The URL is public.** Anyone who finds it can send to it. The script defends against that: it re-validates every field, accepts only allowlisted trips, rejects unexpected fields, limits each phone number or email to 3 requests per 10 minutes and the whole endpoint to 30 saved requests per minute, silently drops honeypot and too-fast submissions, ignores duplicate references, caps request size, and prefixes text that starts with `= + - @` with `'` so the sheet never runs it as a formula.
- **No secrets are in the website.** The web app URL isn't a secret; nothing else is needed.
- **Who can see the data:** only people you share the spreadsheet with. Keep sharing to the people who organise trips, and turn on 2-step verification for the owner account.
- **Retention:** delete rows you no longer need, in line with your privacy policy (the draft says 12 months after the trip).
- **Quotas:** Google limits how much Apps Script and email can be used each day (consumer accounts can send roughly 100 emails a day through `MailApp`). Current limits: [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas). A student trip's volume is far below them.

## Troubleshooting

| What you see | Likely cause and fix |
|---|---|
| Site says "We couldn't confirm your request arrived" every time | The deployment's access isn't **Anyone**, the URL is wrong, or it's the `/dev` URL. Use the `/exec` URL from **Manage deployments**. Open the URL in a private browser window: it must show the JSON status, not a sign-in page |
| Site says "Online registration is paused" | `ACCEPTING` isn't exactly `true`, or a test submission was sent while `ALLOW_TEST` isn't `true` |
| "This trip is not open for registration" | The trip ID is missing from `ALLOWED_TRIPS`, or the JSON in that property is invalid |
| Row appears in "(Test)" but you expected the live tab | `content/site.json` still has `"mode": "test"` (rebuild and push after changing it) |
| Code changes have no effect | You didn't deploy a **New version** (see "Updating the script later") |
| The build fails with "forms.endpoint must be a Google Apps Script web app URL" | The URL must start with `https://script.google.com/macros/s/` and end with `/exec` |
| "Authorization required" in the log | Run `selfTest` again in the editor and accept the permissions |
| Nothing at all happens when submitting | Open the browser console (F12) for errors, and check `npm run build` passed |

## Testing on your own computer first

You can try every form state without a Google account:

```bash
npm run mock:forms                                      # terminal 1: runs Code.gs locally with fake Google services
FORMS_ENDPOINT=http://localhost:4174/exec npm run dev   # terminal 2
```

Then visit `http://localhost:4174/__behaviour/down` (or `slow`, `garbage`, `ok`) to see how the site handles failures, and `http://localhost:4174/__rows` to see what was "saved".
