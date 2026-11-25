import { prisma } from '../../src/config/db.js';
import { bookingEmailsService } from '../../src/modules/notifications/bookingEmails.service.js';

// Empties every table of the test database, whatever the foreign keys.
// Each test file calls it so that it starts from a clean database.
export async function resetDb() {
  // Booking emails are sent in the background: let them finish first, so
  // none of them writes in the database after it was emptied.
  await bookingEmailsService.settle();
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
}

// Deletes the bookings between two tests of a file, with their emails
// (a notification row keeps its booking: it must be deleted first).
export async function clearBookings() {
  await bookingEmailsService.settle();
  await prisma.notification.deleteMany();
  await prisma.booking.deleteMany();
}
