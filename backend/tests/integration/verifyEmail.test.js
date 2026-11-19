import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';
import { mailer } from '../../src/modules/notifications/mailer.js';

const player = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'padel1234',
  phone: '0612345678',
  acceptedTerms: true,
};

let sendMock;

// The token is only in the email: read it from the link of the last email sent.
const tokenFromLastEmail = () => {
  const { text } = sendMock.mock.calls.at(-1)[0];
  return text.match(/verify-email\?token=([a-f0-9]+)/)[1];
};

const verify = (token) =>
  request(app).post('/api/auth/verify-email').send({ token });

const resend = (email) =>
  request(app).post('/api/auth/resend-verification').send({ email });

describe('email verification', () => {
  beforeEach(async () => {
    sendMock = vi.spyOn(mailer, 'send').mockResolvedValue({});
    await resetDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('emails a verification link after registration and stores only its hash', async () => {
    await request(app).post('/api/auth/register').send(player);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const email = sendMock.mock.calls[0][0];
    expect(email.to).toBe('ada@example.com');
    expect(email.text).toMatch(
      /http:\/\/localhost:5173\/verify-email\?token=[a-f0-9]{64}/,
    );
    expect(email.text).toMatch(/valid for 48 hours/);

    const token = tokenFromLastEmail();
    const stored = await prisma.emailVerificationToken.findFirst();
    expect(stored.tokenHash).not.toBe(token);
    const notification = await prisma.notification.findFirst();
    expect(notification).toMatchObject({
      type: 'EMAIL_VERIFICATION',
      status: 'SENT',
    });
  });

  it('activates the account with the link, and then the player can log in', async () => {
    await request(app).post('/api/auth/register').send(player);
    const before = await request(app)
      .post('/api/auth/login')
      .send({ email: player.email, password: player.password });
    expect(before.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const res = await verify(tokenFromLastEmail());

    expect(res.status).toBe(200);
    const user = await prisma.user.findUnique({
      where: { email: player.email },
    });
    expect(user.isVerified).toBe(true);
    const after = await request(app)
      .post('/api/auth/login')
      .send({ email: player.email, password: player.password });
    expect(after.status).toBe(200);
  });

  it('refuses a link used twice or unknown', async () => {
    await request(app).post('/api/auth/register').send(player);
    const token = tokenFromLastEmail();
    await verify(token);

    const twice = await verify(token);
    const unknown = await verify('a'.repeat(64));

    for (const res of [twice, unknown]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    }
  });

  it('refuses a link older than 48 hours, and the account stays unverified', async () => {
    await request(app).post('/api/auth/register').send(player);
    await prisma.emailVerificationToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await verify(tokenFromLastEmail());

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'TOKEN_EXPIRED',
      message: 'This verification link has expired, ask for a new one',
    });
    const user = await prisma.user.findUnique({
      where: { email: player.email },
    });
    expect(user.isVerified).toBe(false);
  });

  it('sends a new working link on request after the old one expired', async () => {
    await request(app).post('/api/auth/register').send(player);
    await prisma.emailVerificationToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await resend(' ADA@example.com ');

    expect(res.status).toBe(202);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect((await verify(tokenFromLastEmail())).status).toBe(200);
  });

  it('gives the same answer for an unknown or already verified email, without sending anything', async () => {
    const unknown = await resend('nobody@example.com');

    await request(app).post('/api/auth/register').send(player);
    await verify(tokenFromLastEmail());
    sendMock.mockClear();
    const verified = await resend(player.email);

    expect(unknown.status).toBe(202);
    expect(verified.status).toBe(202);
    expect(verified.body).toEqual(unknown.body);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('still creates the account when the email cannot be sent', async () => {
    sendMock.mockRejectedValue(new Error('SMTP down'));

    const res = await request(app).post('/api/auth/register').send(player);

    expect(res.status).toBe(201);
    const notification = await prisma.notification.findFirst();
    expect(notification).toMatchObject({
      status: 'FAILED',
      error: 'SMTP down',
    });
  });
});
