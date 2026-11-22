import { ScheduledTaskActionType } from '../entities/scheduled-task.entity';
import { ScheduledTaskActionsService } from './scheduled-task-actions.service';

const cleanup = jest.fn();
const pruneImages = jest.fn();
const service = new ScheduledTaskActionsService(
  {} as never,
  { cleanup } as never,
  { pruneImages } as never,
  {} as never,
  {} as never,
);

it.each([true, [1], -1, 3651])(
  'rejects invalid saved log retention (%j) before cleanup',
  async (value) => {
    const action = ScheduledTaskActionType.CleanRuntimeLogs;
    const payload = { retentionDays: value };
    expect(() => service.normalizePayload(action, payload)).toThrow(
      'retentionDays must be an integer',
    );
    await expect(async () => service.run(action, payload)).rejects.toThrow(
      'retentionDays must be an integer',
    );
    expect(cleanup).not.toHaveBeenCalled();
  },
);

it('rejects an invalid stored image prune flag before running the adapter', async () => {
  await expect(async () =>
    service.run(ScheduledTaskActionType.PruneImages, { danglingOnly: 0 }),
  ).rejects.toThrow('danglingOnly must be a boolean');
  expect(pruneImages).not.toHaveBeenCalled();
});
