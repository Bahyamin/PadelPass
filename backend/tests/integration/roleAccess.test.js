import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';
import { clubToday } from '../../src/utils/time.js';

const PASSWORD = 'padel1234';
const ROLES = ['PLAYER', 'STAFF', 'EQUIPMENT_MANAGER', 'ADMIN'];
const today = clubToday();

// FR-07, NFR-08, AC-03: the access matrix of every /api route (SDD 5.1).
// When you add a route, add it to the right list: the tests then check that
// the server itself refuses the roles that are not allowed.

// Open to everybody, even without login.
const PUBLIC_ROUTES = [
  ['GET', '/api/health'],
  ['GET', '/api/courts'],
  ['GET', `/api/availability?date=${today}`],
  ['GET', `/api/equipment/availability?date=${today}&start=10:00&duration=60`],
  ['POST', '/api/auth/logout'],
  ['POST', '/api/auth/register'],
  ['POST', '/api/auth/verify-email'],
  ['POST', '/api/auth/resend-verification'],
  ['POST', '/api/auth/login'],
];

// Any logged-in user ("Player" access in the SDD).
const LOGGED_IN_ROUTES = [
  ['GET', '/api/users/me'],
  ['GET', '/api/pricing/quote'],
  ['POST', '/api/bookings'],
  ['GET', '/api/bookings/me'],
  ['GET', '/api/bookings/1/equipment'],
  ['PUT', '/api/bookings/1/equipment'],
];

// Administrators only: requireRole(ADMIN).
const ADMIN_ROUTES = [
  ['GET', '/api/admin/opening-hours'],
  ['PUT', '/api/admin/opening-hours'],
  ['GET', '/api/admin/pricing-rules'],
  ['POST', '/api/admin/pricing-rules'],
  ['PATCH', '/api/admin/pricing-rules/1'],
  ['DELETE', '/api/admin/pricing-rules/1'],
  ['GET', '/api/admin/settings'],
  ['PUT', '/api/admin/settings'],
];

describe('role-based access to the API', () => {
  // One logged-in agent per role: agents.PLAYER, agents.ADMIN...
  const agents = {};

  const call = (agent, method, url) => agent[method.toLowerCase()](url);

  beforeAll(async () => {
    await resetDb();
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    for (const role of ROLES) {
      const email = `${role.toLowerCase()}@test.local`;
      await prisma.user.create({
        data: {
          firstName: 'Test',
          lastName: role,
          email,
          phone: '0600000000',
          passwordHash,
          role,
          isVerified: true,
        },
      });
      agents[role] = request.agent(app);
      await agents[role]
        .post('/api/auth/login')
        .send({ email, password: PASSWORD });
    }
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it.each(PUBLIC_ROUTES)('%s %s is public', async (method, url) => {
    const res = await call(request(app), method, url);

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it.each(LOGGED_IN_ROUTES)(
    '%s %s: 401 without login, open to every role',
    async (method, url) => {
      const anonymous = await call(request(app), method, url);
      expect(anonymous.status).toBe(401);
      expect(anonymous.body.error.code).toBe('UNAUTHORIZED');

      for (const role of ROLES) {
        const res = await call(agents[role], method, url);
        expect(res.status, role).not.toBe(401);
        expect(res.status, role).not.toBe(403);
      }
    },
  );

  it.each(ADMIN_ROUTES)(
    '%s %s: 401 without login, 403 for every role but ADMIN',
    async (method, url) => {
      const anonymous = await call(request(app), method, url);
      expect(anonymous.status).toBe(401);

      for (const role of ['PLAYER', 'STAFF', 'EQUIPMENT_MANAGER']) {
        const res = await call(agents[role], method, url);
        expect(res.status, role).toBe(403);
        expect(res.body.error.code, role).toBe('FORBIDDEN');
        expect(res.body.error.message, role).toBe('Access denied');
      }

      const asAdmin = await call(agents.ADMIN, method, url);
      expect(asAdmin.status).not.toBe(401);
      expect(asAdmin.status).not.toBe(403);
    },
  );

  it('changes nothing when a player calls an admin route', async () => {
    const res = await agents.PLAYER.put('/api/admin/settings').send({
      maxActiveBookings: 50,
    });

    expect(res.status).toBe(403);
    expect(await prisma.setting.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
    const settings = await agents.ADMIN.get('/api/admin/settings');
    expect(settings.body.maxActiveBookings).toBe(3); // still the default
  });

  it('checks the role stored in the token, not one sent by the client', async () => {
    const res = await agents.PLAYER.get('/api/admin/settings')
      .set('X-Role', 'ADMIN')
      .query({ role: 'ADMIN' });

    expect(res.status).toBe(403);
  });
});
