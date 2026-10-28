/* forms.js — loaded on demand, only on pages that contain a form.
   Registers both the booking and contact handlers (each is a no-op
   when its markup is absent) and the optional analytics hooks. */
import { init as booking } from './booking.js';
import { init as contact } from './contact.js';

export function init(config) {
  booking(config);
  contact(config);
}
