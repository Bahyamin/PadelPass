import { config } from '../../config/index.js';
import { bookingEmailsRepository } from './bookingEmails.repository.js';
import {
  formatDayFr,
  formatEuros,
  formatTimeFr,
  renderEmail,
} from './emailTemplate.js';
import { notificationsService } from './notifications.service.js';

// FR-30, AC-12: an email to the player when a booking is created, changed or
// cancelled. Type of each email in the notifications table, and its wording.
export const BOOKING_EMAILS = {
  CREATED: {
    type: 'BOOKING_CONFIRMATION',
    subject: 'Confirmation de votre réservation',
    intro: 'Votre réservation est confirmée.',
  },
  UPDATED: {
    type: 'BOOKING_UPDATE',
    subject: 'Modification de votre réservation',
    intro: 'Votre réservation a été modifiée. Voici le nouveau créneau.',
  },
  CANCELLED: {
    type: 'BOOKING_CANCELLATION',
    subject: 'Annulation de votre réservation',
    intro: 'Votre réservation a été annulée.',
  },
};

const MINUTE = 60 * 1000;

// Content of the email of a booking: date, time, court, equipment and price.
// Pure function (booking loaded with user, court and equipment), easy to test.
export function bookingEmail(event, booking) {
  const { subject, intro } = BOOKING_EMAILS[event];
  const minutes = Math.round((booking.endTime - booking.startTime) / MINUTE);
  const equipmentCents = booking.equipment.reduce(
    (sum, e) => sum + e.quantity * Math.round(Number(e.unitPrice) * 100),
    0,
  );
  const courtCents = Math.round(Number(booking.courtPrice) * 100);
  const feesCents = Math.round(Number(booking.feesTotal ?? 0) * 100);
  const totalCents = courtCents + equipmentCents + feesCents;

  const equipment = booking.equipment.length
    ? booking.equipment.map((e) => `${e.quantity} × ${e.type.name}`).join(', ')
    : 'aucun';
  let price =
    `${formatEuros(totalCents / 100)} (terrain ${formatEuros(courtCents / 100)}` +
    `, équipement ${formatEuros(equipmentCents / 100)}`;
  if (feesCents > 0) price += `, frais ${formatEuros(feesCents / 100)}`;
  price += ')';

  return renderEmail({
    subject,
    firstName: booking.user.firstName,
    intro,
    details: [
      ['Date', formatDayFr(booking.startTime)],
      [
        'Horaire',
        `${formatTimeFr(booking.startTime)} - ${formatTimeFr(booking.endTime)} (${minutes} min)`,
      ],
      ['Terrain', booking.court.name],
      ['Équipement', equipment],
      ['Prix', price],
    ],
    outro:
      event === 'CANCELLED'
        ? 'Nous espérons vous revoir bientôt sur nos terrains.'
        : 'Le paiement se fait au club. À bientôt sur le terrain !',
  });
}

// Emails being sent in the background (see notify).
const pending = new Set();

export const bookingEmailsService = {
  // Sends the email of a booking event (CREATED, UPDATED or CANCELLED) and
  // logs it in notifications, with 3 retries. Guest bookings have no account,
  // so no email. Returns true when the email was sent.
  async send(event, bookingId) {
    const booking = await bookingEmailsRepository.findBooking(bookingId);
    if (!booking?.user) return false;
    return notificationsService.send({
      user: booking.user,
      type: BOOKING_EMAILS[event].type,
      bookingId: booking.id,
      retries: config.email.retries,
      ...bookingEmail(event, booking),
    });
  },

  // Starts sending without waiting (SDD 6.2: asynchronous, after the commit),
  // so the player gets the answer at once, even while the provider is retried.
  // An error is logged, never thrown: the booking is already saved.
  notify(event, bookingId) {
    const sending = this.send(event, bookingId)
      .catch((err) => {
        console.error(
          `[notifications] ${event} email of booking ${bookingId} failed`,
          err,
        );
      })
      .finally(() => pending.delete(sending));
    pending.add(sending);
  },

  // Waits for the emails being sent (used by the tests).
  async settle() {
    await Promise.all(pending);
  },
};
