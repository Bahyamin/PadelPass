import { CLUB_TIME_ZONE } from '../../utils/time.js';

// Common template of the emails sent to players (FR-30, SDD 3.3: French
// templates). Every email has the same parts: a greeting, an introduction,
// a list of details ("Date : ..."), a closing line and the club signature.

const SIGNATURE = "L'équipe PadelBook";

// Values come from the database (first name, court name): escape them in HTML.
export const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// "mercredi 25 novembre 2026", in the club time zone.
export const formatDayFr = (instant) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: CLUB_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);

// "18:00", in the club time zone.
export const formatTimeFr = (instant) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: CLUB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);

// "60,00 €" (a Decimal, a number or a string such as "60.00").
export const formatEuros = (amount) =>
  `${Number(amount).toFixed(2).replace('.', ',')} €`;

// Builds { subject, text, html } from the parts of the email.
// details: [[label, value], ...], shown in this order.
export function renderEmail({ subject, firstName, intro, details, outro }) {
  const text = [
    `Bonjour ${firstName},`,
    '',
    intro,
    '',
    ...details.map(([label, value]) => `${label} : ${value}`),
    '',
    outro,
    '',
    SIGNATURE,
  ].join('\n');

  const rows = details
    .map(
      ([label, value]) =>
        `<li><strong>${escapeHtml(label)} :</strong> ${escapeHtml(value)}</li>`,
    )
    .join('');
  const html =
    `<p>Bonjour ${escapeHtml(firstName)},</p>` +
    `<p>${escapeHtml(intro)}</p>` +
    `<ul>${rows}</ul>` +
    `<p>${escapeHtml(outro)}</p>` +
    `<p>${escapeHtml(SIGNATURE)}</p>`;

  return { subject, text, html };
}
