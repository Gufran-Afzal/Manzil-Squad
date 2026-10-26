# WhatsApp setup

The site uses WhatsApp "click to chat" links (`https://wa.me/<number>?text=<message>`). Clicking one opens WhatsApp with a **draft** message; the visitor still has to press **Send**. Nothing is sent automatically, and the site never claims it is.

## Turn it on

1. Use a number you can answer reliably, ideally a **WhatsApp Business** number rather than someone's personal one.
2. In `content/site.json`, set `contact.whatsapp` to the number in international format, **digits only**:

   ```json
   "contact": {
     "whatsapp": "923001234567",
     "phoneDisplay": "+92 300 1234567"
   }
   ```

   Not `+92 300…`, not `0300…`: the build checks the format and stops with a message if it's wrong. `phoneDisplay` is how the number appears in the footer.
3. Build and check a trip page: the "Ask on WhatsApp" button should appear.

Until a number is set, every WhatsApp button is hidden. In development builds (`npm run dev`) a yellow note shows where each button would be.

## Where the buttons appear

| Place | Draft message |
|---|---|
| Floating button (all pages except booking and contact) | "I'd like to know more about your upcoming trips." |
| Trip page | "I have a question about: <trip title> (trip ID <id>)." |
| Booking form | "I'd like to register interest in: <trip> (trip ID <id>)." plus the number of people once filled in |
| After a form submission that couldn't be confirmed, or when forms are off | The same, plus the visitor's reference number |
| Contact page | "I have a question about your trips." |

The floating button moves out of the way when the footer is on screen or when someone is typing in a form field, and hides while the mobile menu is open, so it never covers buttons or inputs.

## Privacy

Prefilled messages contain only the trip, a reference number and a participant count, **never** names, phone numbers or notes. Links can end up in browser history and logs, so personal details stay out of them.

## How the links are built

All links come from one file, `js/whatsapp.js`:

- `normalizeNumber()` turns `+92 300 1234567`, `0092-300-1234567` or `0300 1234567` into `923001234567`, and returns nothing for invalid numbers.
- `buildMessage()` writes the draft text.
- `buildLink()` URL-encodes it into a `https://wa.me/` link.

The build uses the same file to write links into the HTML (so they work without JavaScript), and the browser uses it to add reference numbers. Tests: `npm run test:whatsapp`.

All WhatsApp links open in a new tab with `rel="noopener noreferrer"`.
