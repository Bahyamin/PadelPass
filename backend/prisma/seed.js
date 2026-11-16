import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/db.js';

// Starting data of the club (BRD 2.1, SRS RULE-02, RULE-04, RULE-07).
const DAYS = [0, 1, 2, 3, 4, 5, 6]; // 0 = Sunday ... 6 = Saturday
const WEEKEND = [0, 6];

const COURTS = [
  { name: 'Court 1', type: 'INDOOR' },
  { name: 'Court 2', type: 'INDOOR' },
  { name: 'Court 3', type: 'OUTDOOR' },
  { name: 'Court 4', type: 'OUTDOOR' },
];

// Default booking parameters, editable later by the administrator (FR-25).
const SETTINGS = {
  max_active_bookings: '3',
  booking_window_days: '14',
  cancellation_deadline_hours: '24',
  equipment_change_deadline_hours: '2',
};

const OFF_PEAK = { label: 'Off-peak', pricePerHour: 28 };
const PEAK = { label: 'Peak', pricePerHour: 40 };

const EQUIPMENT = [
  {
    name: 'Racket',
    category: 'RACKET',
    rentalPrice: 4,
    damageFee: 60,
    prefix: 'RKT',
    count: 8,
  },
  {
    name: 'Balls (tube of 3)',
    category: 'BALLS',
    rentalPrice: 5,
    damageFee: 5,
    prefix: 'BAL',
    count: 10,
  },
  {
    name: 'Shoes',
    category: 'SHOES',
    rentalPrice: 3,
    damageFee: 40,
    prefix: 'SHO',
    count: 6,
  },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

// Peak = weekdays 17:00-22:00 and the whole weekend (RULE-07).
function pricingRulesFor(dayOfWeek) {
  if (WEEKEND.includes(dayOfWeek)) {
    return [{ ...PEAK, startTime: '08:00', endTime: '23:00' }];
  }
  return [
    { ...OFF_PEAK, startTime: '08:00', endTime: '17:00' },
    { ...PEAK, startTime: '17:00', endTime: '22:00' },
    { ...OFF_PEAK, startTime: '22:00', endTime: '23:00' },
  ];
}

// Every step is an upsert on a unique key, so the seed can be run several times.
async function main() {
  for (const court of COURTS) {
    await prisma.court.upsert({
      where: { name: court.name },
      update: {},
      create: court,
    });
  }

  for (const dayOfWeek of DAYS) {
    await prisma.openingHours.upsert({
      where: { dayOfWeek },
      update: {},
      create: { dayOfWeek, openTime: '08:00', closeTime: '23:00' },
    });
    for (const rule of pricingRulesFor(dayOfWeek)) {
      await prisma.pricingRule.upsert({
        where: {
          dayOfWeek_startTime: { dayOfWeek, startTime: rule.startTime },
        },
        update: {},
        create: { dayOfWeek, ...rule },
      });
    }
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  for (const { prefix, count, ...type } of EQUIPMENT) {
    const saved = await prisma.equipmentType.upsert({
      where: { name: type.name },
      update: {},
      create: type,
    });
    for (let n = 1; n <= count; n++) {
      const code = `${prefix}-${String(n).padStart(2, '0')}`;
      await prisma.equipmentItem.upsert({
        where: { code },
        update: {},
        create: { code, typeId: saved.id },
      });
    }
  }

  const accounts = [
    {
      firstName: 'Club',
      lastName: 'Admin',
      email: 'admin@padelbook.local',
      role: 'ADMIN',
      password: requireEnv('SEED_ADMIN_PASSWORD'),
    },
    {
      firstName: 'Front',
      lastName: 'Desk',
      email: 'staff@padelbook.local',
      role: 'STAFF',
      password: requireEnv('SEED_STAFF_PASSWORD'),
    },
  ];
  for (const { password, ...account } of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        ...account,
        phone: '0100000000',
        isVerified: true,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
  }
}

main()
  .then(() => console.log('Seed done'))
  .finally(() => prisma.$disconnect());
