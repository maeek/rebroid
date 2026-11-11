import { DataSource } from 'typeorm';
import { InitializeSqliteSchema1800000005000 } from '../../database/migrations/1800000005000-initialize-sqlite-schema';
import { Automation } from '../entities/automation.entity';
import {
  AutomationRun,
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationRunsRepository } from './automation-runs.repository';

it('pages persisted workflow runs by owner and app, retaining deleted workflow runs and excluding ad hoc AI', async () => {
  const db = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [Automation, AutomationRun],
    migrations: [InitializeSqliteSchema1800000005000],
    migrationsRun: true,
  }).initialize();
  try {
    const runs = new AutomationRunsRepository(db.getRepository(AutomationRun));
    await db.getRepository(Automation).insert({
      id: 'workflow',
      ownerUserId: 'owner',
      name: 'Check inventory',
      definitionJson: '{}',
    });
    const save = (values: Partial<AutomationRun> = {}) =>
      runs.save(
        runs.create({
          ownerUserId: 'owner',
          targetApplicationId: 'app',
          automationId: 'workflow',
          trigger: AutomationRunTrigger.Manual,
          status: AutomationRunStatus.Success,
          stepResultsJson: '[]',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          ...values,
        }),
      );
    const completed = await save();
    const failed = await save({
      status: AutomationRunStatus.Failed,
      automationId: 'deleted',
      error: 'Runtime unavailable',
    });
    const otherApp = await save({ targetApplicationId: 'other-app' });
    const otherOwner = await save({ ownerUserId: 'other-owner' });
    const adHoc = await save({ automationId: 'ephemeral-ai-fixture' });

    const first = await runs.listApplicationWorkflows('owner', 'app', 0, 1, '');
    expect(first).toMatchObject({
      total: 2,
      items: [{ run: { id: failed.id }, automationName: null }],
    });
    const second = await runs.listApplicationWorkflows(
      'owner',
      'app',
      1,
      1,
      '',
    );
    expect(second).toMatchObject({
      total: 2,
      items: [
        {
          run: { id: completed.id, status: AutomationRunStatus.Success },
          automationName: 'Check inventory',
        },
      ],
    });
    expect(second.items[0]?.run.stepResultsJson).toBeUndefined();
    await expect(
      runs.listApplicationWorkflows('owner', 'app', 0, 25, 'INVENTORY'),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      runs.listApplicationWorkflows('owner', 'app', 0, 25, '%'),
    ).resolves.toMatchObject({ total: 0 });
    await expect(
      runs.findApplicationWorkflow('owner', 'app', failed.id),
    ).resolves.toMatchObject({
      run: { error: 'Runtime unavailable' },
    });
    for (const excluded of [otherApp, otherOwner, adHoc]) {
      await expect(
        runs.findApplicationWorkflow('owner', 'app', excluded.id),
      ).resolves.toBeNull();
    }
  } finally {
    await db.destroy();
  }
});
