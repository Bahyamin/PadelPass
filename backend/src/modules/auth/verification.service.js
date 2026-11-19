import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../config/db.js';
import { config } from '../../config/index.js';
import { ValidationError } from '../../utils/errors.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { usersRepository } from '../users/users.repository.js';

// Only the hash goes to the database; the raw token only exists in the email.
const hash = (token) => createHash('sha256').update(token).digest('hex');

// The first name comes from the user: escape it before putting it in HTML.
const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Email verification (FR-02, RULE-10).
export const verificationService = {
  // Creates a link valid 48 hours and emails it to the user.
  async sendLink(user, now = new Date()) {
    const token = randomBytes(32).toString('hex');
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hash(token),
        expiresAt: new Date(
          now.getTime() + config.verificationLinkHours * 60 * 60 * 1000,
        ),
      },
    });

    const link = `${config.appUrl}/verify-email?token=${token}`;
    return notificationsService.send({
      user,
      type: 'EMAIL_VERIFICATION',
      subject: 'Verify your PadelBook email address',
      text:
        `Hello ${user.firstName},\n\n` +
        `Please confirm your email address by opening this link:\n${link}\n\n` +
        `The link is valid for ${config.verificationLinkHours} hours.`,
      html:
        `<p>Hello ${escapeHtml(user.firstName)},</p>` +
        `<p>Please confirm your email address:</p>` +
        `<p><a href="${link}">Verify my email address</a></p>` +
        `<p>The link is valid for ${config.verificationLinkHours} hours.</p>`,
    });
  },

  // Activates the account of a valid, unused and unexpired token.
  async verify(token, now = new Date()) {
    const record =
      typeof token === 'string' && token
        ? await prisma.emailVerificationToken.findUnique({
            where: { tokenHash: hash(token) },
          })
        : null;

    if (!record || record.usedAt) {
      throw new ValidationError(
        'This verification link is not valid',
        'INVALID_TOKEN',
      );
    }
    if (record.expiresAt < now) {
      throw new ValidationError(
        'This verification link has expired, ask for a new one',
        'TOKEN_EXPIRED',
      );
    }

    // Both changes or none: the account is verified and the link used once.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { isVerified: true },
      }),
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
    ]);
  },

  // Sends a new link if the account exists and is not verified yet. The caller
  // always gives the same answer, so nobody learns which emails have an account.
  async resend(email) {
    const user = await usersRepository.findByEmail(email);
    if (user && !user.isVerified && user.isActive) {
      await this.sendLink(user);
    }
  },
};
