import { InitializeSqliteSchema1800000000000 } from '../../database/migrations/1800000000000-initialize-sqlite-schema';
import { DataSource } from 'typeorm';
import { AutomationRunEvent } from '../entities/automation-run-event.entity';
import { AutomationRunEventsRepository } from './automation-run-events.repository';

it('projects the original prompt and terminal outcome past the first event page', async () => {
  const database = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [AutomationRunEvent],
    migrations: [InitializeSqliteSchema1800000000000],
    migrationsRun: true,
  }).initialize();
  try {
    const events = database.getRepository(AutomationRunEvent);
    const base = {
      runId: 'run',
      ownerUserId: 'owner',
      dataJson: '{}',
      message: 'fixture',
    };
    const rows = [
      { ...base, sequence: 1, type: 'ai.user.message' },
      ...Array.from({ length: 1_050 }, (_, index) => ({
        ...base,
        sequence: index + 2,
        type: 'ai.action.decided',
      })),
      { ...base, sequence: 1_052, type: 'ai.message.completed' },
      { ...base, sequence: 1_053, type: 'run.completed' },
      {
        ...base,
        runId: 'other',
        ownerUserId: 'different',
        sequence: 1,
        type: 'ai.user.message',
      },
    ];
    for (let index = 0; index < rows.length; index += 200) {
      await events.insert(rows.slice(index, index + 200));
    }
    const repository = new AutomationRunEventsRepository(
      events,
      database,
      {} as never,
    );
    const history = await repository.listConversationEvents('owner', [
      'run',
      'other',
    ]);
    expect(history[0]).toMatchObject({ sequence: 1, type: 'ai.user.message' });
    expect(history.slice(-2).map((event) => event.type)).toEqual([
      'ai.message.completed',
      'run.completed',
    ]);
    expect(history).toHaveLength(81);
    expect(history.every((event) => event.ownerUserId === 'owner')).toBe(true);
  } finally {
    await database.destroy();
  }
});
