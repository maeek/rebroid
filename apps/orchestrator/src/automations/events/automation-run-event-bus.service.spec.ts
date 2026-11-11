import { AutomationRunEventsRepository } from '../persistence/automation-run-events.repository';
import { AutomationRunEventBus } from './automation-run-event-bus.service';
import type { AutomationRunEventRecord } from './automation-run-events.types';

const event = (sequence: number): AutomationRunEventRecord => ({
  id: `event-${sequence}`,
  runId: 'run-1',
  ownerUserId: 'owner-1',
  sequence,
  type: sequence === 1 ? 'run.queued' : 'run.started',
  stepId: null,
  parentStepId: null,
  message: `event ${sequence}`,
  data: {},
  createdAt: new Date(sequence).toISOString(),
});

describe('AutomationRunEventBus', () => {
  it('buffers live events while replay is loading and delivers each sequence once', async () => {
    let resolveReplay!: (events: AutomationRunEventRecord[]) => void;
    const replay = new Promise<AutomationRunEventRecord[]>((resolve) => {
      resolveReplay = resolve;
    });
    const repository = {
      latestSequence: jest.fn().mockResolvedValue(2),
      listForRun: jest.fn().mockReturnValue(replay),
      append: jest.fn().mockResolvedValue(event(2)),
    } as unknown as AutomationRunEventsRepository;
    const bus = new AutomationRunEventBus(repository);
    const received: number[] = [];

    const subscription = bus.subscribeWithReplay(
      'owner-1',
      'run-1',
      0,
      (record) => received.push(record.sequence),
    );
    await bus.emit({
      runId: 'run-1',
      ownerUserId: 'owner-1',
      type: 'run.started',
    });
    resolveReplay([event(1), event(2)]);
    const unsubscribe = await subscription;

    expect(received).toEqual([1, 2]);
    unsubscribe();
  });

  it('replays through the initial sequence across pages before handing off live events', async () => {
    const page = Array.from({ length: 1000 }, (_, index) => event(index + 1));
    const repository = {
      latestSequence: jest.fn().mockResolvedValue(1002),
      listForRun: jest.fn(),
      append: jest.fn().mockResolvedValue(event(1003)),
    };
    const bus = new AutomationRunEventBus(repository as never);
    repository.listForRun
      .mockResolvedValueOnce(page)
      .mockImplementationOnce(async () => {
        await bus.emit({
          runId: 'run-1',
          ownerUserId: 'owner-1',
          type: 'run.started',
        });
        return [event(1001), event(1002), event(1003)];
      });
    const received: number[] = [];
    const unsubscribe = await bus.subscribeWithReplay(
      'owner-1',
      'run-1',
      0,
      (record) => received.push(record.sequence),
    );
    expect(repository.listForRun.mock.calls).toEqual([
      ['owner-1', 'run-1', 0],
      ['owner-1', 'run-1', 1000],
    ]);
    expect(received).toEqual(
      Array.from({ length: 1003 }, (_, index) => index + 1),
    );
    unsubscribe();
  });

  it('delegates reads/deletes and filters live events by owner', async () => {
    const repository = {
      latestSequence: jest.fn().mockResolvedValue(0),
      listForRun: jest.fn().mockResolvedValue([]),
      deleteForRuns: jest.fn().mockResolvedValue(undefined),
      append: jest
        .fn()
        .mockResolvedValueOnce({ ...event(1), ownerUserId: 'owner-2' })
        .mockResolvedValueOnce(event(2)),
    } as unknown as AutomationRunEventsRepository;
    const bus = new AutomationRunEventBus(repository);
    const received: number[] = [];
    const unsubscribe = await bus.subscribeWithReplay(
      'owner-1',
      'run-1',
      0,
      (record) => received.push(record.sequence),
    );

    await bus.emit({
      runId: 'run-1',
      ownerUserId: 'owner-2',
      type: 'run.queued',
    });
    await bus.emit({
      runId: 'run-1',
      ownerUserId: 'owner-1',
      type: 'run.started',
    });
    await bus.deleteForRuns('owner-1', ['run-1']);

    expect(received).toEqual([2]);
    expect(repository.deleteForRuns).toHaveBeenCalledWith('owner-1', ['run-1']);
    unsubscribe();
  });
});
