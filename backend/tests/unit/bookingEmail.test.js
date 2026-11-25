import { describe, it, expect } from 'vitest';
import { bookingEmail } from '../../src/modules/notifications/bookingEmails.service.js';
import { renderEmail } from '../../src/modules/notifications/emailTemplate.js';
import { clubTime } from '../../src/utils/time.js';

// A Wednesday 18:00-19:30 booking with 2 rackets and 1 tube of balls.
const booking = {
  id: 7,
  startTime: clubTime('2026-11-25', '18:00'),
  endTime: clubTime('2026-11-25', '19:30'),
  courtPrice: '60.00',
  feesTotal: '0.00',
  user: { firstName: 'Ada' },
  court: { name: 'Court 1' },
  equipment: [
    { quantity: 2, unitPrice: '4.00', type: { name: 'Racket' } },
    { quantity: 1, unitPrice: '5.00', type: { name: 'Balls (tube of 3)' } },
  ],
};

describe('booking emails (FR-30)', () => {
  it('gives the date, time, court, equipment and price, in French', () => {
    const email = bookingEmail('CREATED', booking);

    expect(email.subject).toBe('Confirmation de votre réservation');
    expect(email.text).toContain('Bonjour Ada,');
    expect(email.text).toContain('Votre réservation est confirmée.');
    expect(email.text).toContain('Date : mercredi 25 novembre 2026');
    expect(email.text).toContain('Horaire : 18:00 - 19:30 (90 min)');
    expect(email.text).toContain('Terrain : Court 1');
    expect(email.text).toContain(
      'Équipement : 2 × Racket, 1 × Balls (tube of 3)',
    );
    expect(email.text).toContain(
      'Prix : 73,00 € (terrain 60,00 €, équipement 13,00 €)',
    );
    expect(email.text).toContain("L'équipe PadelBook");
  });

  it('says "aucun" when no equipment is reserved', () => {
    const email = bookingEmail('CREATED', { ...booking, equipment: [] });

    expect(email.text).toContain('Équipement : aucun');
    expect(email.text).toContain(
      'Prix : 60,00 € (terrain 60,00 €, équipement 0,00 €)',
    );
  });

  it('adds the fees to the total when there are some', () => {
    const email = bookingEmail('CREATED', { ...booking, feesTotal: '5.00' });

    expect(email.text).toContain(
      'Prix : 78,00 € (terrain 60,00 €, équipement 13,00 €, frais 5,00 €)',
    );
  });

  it.each([
    ['UPDATED', 'Modification de votre réservation', 'a été modifiée'],
    ['CANCELLED', 'Annulation de votre réservation', 'a été annulée'],
  ])('has its own subject for %s', (event, subject, intro) => {
    const email = bookingEmail(event, booking);

    expect(email.subject).toBe(subject);
    expect(email.text).toContain(intro);
    expect(email.text).toContain('Terrain : Court 1');
  });

  it('uses the common template, which escapes the HTML', () => {
    const email = renderEmail({
      subject: 'Test',
      firstName: '<b>Ada</b>',
      intro: 'Intro',
      details: [['Terrain', 'Court "A" & B']],
      outro: 'Fin',
    });

    expect(email.html).toContain('Bonjour &#60;b&#62;Ada&#60;/b&#62;,');
    expect(email.html).toContain(
      '<li><strong>Terrain :</strong> Court &#34;A&#34; &#38; B</li>',
    );
    expect(email.html).not.toContain('<b>');
  });
});
