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
};
