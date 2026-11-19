import { prisma } from '../../config/db.js';

// Failed login attempts, one row per email (table login_attempts).
export const authRepository = {
  findAttempt(email) {
    return prisma.loginAttempt.findUnique({ where: { email } });
  },

  saveAttempt(email, data) {
    return prisma.loginAttempt.upsert({
      where: { email },
      update: data,
      create: { email, ...data },
    });
  },

  clearAttempts(email) {
    return prisma.loginAttempt.deleteMany({ where: { email } });
  },
};
