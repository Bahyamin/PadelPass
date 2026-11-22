import { describe, it, expect, vi, afterEach } from 'vitest';

// The job is tested without a real scheduler and without a database.
vi.mock('node-cron', () => ({ default: { schedule: vi.fn(() => 'task') } }));
vi.mock('../../src/modules/notifications/reminders.service.js', () => ({
  remindersService: { sendDueReminders: vi.fn() },
}));

const cron = (await import('node-cron')).default;
const { remindersService } =
  await import('../../src/modules/notifications/reminders.service.js');
const { runRemindersJob, startRemindersJob } =
  await import('../../src/jobs/reminders.job.js');

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('reminders job', () => {
  it('runs every 15 minutes in the club time zone, without overlapping runs', () => {
    expect(startRemindersJob()).toBe('task');

    const [pattern, , options] = cron.schedule.mock.calls[0];
    expect(pattern).toBe('*/15 * * * *');
    expect(options).toMatchObject({
      timezone: 'Europe/Paris',
      noOverlap: true,
    });
  });

  it('calls the reminders service at each run', async () => {
    remindersService.sendDueReminders.mockResolvedValue({ due: 0, sent: 0 });
    startRemindersJob();
    const runTask = cron.schedule.mock.calls[0][1];

    await runTask();

    expect(remindersService.sendDueReminders).toHaveBeenCalledTimes(1);
  });

  it('never throws: an error is logged and the next run tries again', async () => {
    remindersService.sendDueReminders.mockRejectedValue(new Error('DB down'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runRemindersJob()).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith(
      '[reminders] job failed',
      expect.any(Error),
    );
  });
});
