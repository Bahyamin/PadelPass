import { prisma } from '../../config/db.js';

// Database queries on the users table. Only this layer talks to Prisma.
export const usersRepository = {
  findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data) {
    return prisma.user.create({ data });
  },

  // Fields left undefined are not changed.
  update(id, data) {
    return prisma.user.update({ where: { id }, data });
  },
};
