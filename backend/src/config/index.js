// All configuration comes from environment variables (see .env.example).
export const config = {
  port: Number(process.env.PORT) || 3000,
  isProduction: process.env.NODE_ENV === 'production',

  // JWT stored in an httpOnly cookie (SDD section 8), valid 24 hours.
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresInSeconds: 24 * 60 * 60,
  authCookieName: 'token',

  // RULE-11: 5 consecutive failed logins block the email for 15 minutes.
  maxFailedLogins: 5,
  lockMinutes: 15,

  // Address of the front end, used to build the links sent by email.
  appUrl: process.env.APP_URL || 'http://localhost:5173',

  // RULE-10: a verification link expires after 48 hours.
  verificationLinkHours: 48,

  // Emails (SDD 3.3): Mailtrap in development. Without SMTP_HOST the emails
  // are not sent but printed in the backend console.
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 2525,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  mailFrom: process.env.MAIL_FROM || 'PadelBook <no-reply@padelbook.local>',

  // FR-31, AC-13: a reminder email 24 hours (+/- 15 minutes) before each
  // booking, checked by a job every 15 minutes (SDD 3.3).
  reminder: { leadHours: 24, toleranceMinutes: 15, cron: '*/15 * * * *' },

  // SDD 6.5, PAD-39: a booking email is retried 3 times with exponential
  // back-off (1 s, 2 s, 4 s), well within the minute of FR-30.
  email: { retries: 3, retryDelayMs: 1000 },
};
