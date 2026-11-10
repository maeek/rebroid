import { DataSource } from 'typeorm';
import { WorkflowRunSummaries1800000001000 } from '../../database/migrations/1800000001000-workflow-run-summaries';
import { InitializeSqliteSchema1800000000000 } from '../../database/migrations/1800000000000-initialize-sqlite-schema';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import {
  Automation,
  AutomationLastStatus,
} from '../entities/automation.entity';
import {
  AutomationRun,
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import {
  AutomationTrigger,
  AutomationTriggerType,
} from '../entities/automation-trigger.entity';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationTriggersRepository } from '../persistence/automation-triggers.repository';
import { AutomationsRepository } from '../persistence/automations.repository';
import { AutomationTriggersService } from './automation-triggers.service';
import { AutomationsDtoMapper } from './automations-dto-mapper.service';
import { AutomationsQueryService } from './automations-query.service';

describe('workflow run summaries', () => {
  let db: DataSource;
  let queries: AutomationsQueryService;
  let runs: AutomationRunsRepository;

  beforeEach(async () => {
    db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Automation, AutomationRun, AutomationTrigger],
      migrations: [
        InitializeSqliteSchema1800000000000,
        WorkflowRunSummaries1800000001000,
      ],
      migrationsRun: true,
    }).initialize();
    runs = new AutomationRunsRepository(db.getRepository(AutomationRun));
    queries = new AutomationsQueryService(
      new AutomationsRepository(db.getRepository(Automation)),
      new AutomationTriggersRepository(db.getRepository(AutomationTrigger)),
      runs,
      new AutomationsDtoMapper(new AutomationDefinitionService({} as never)),
    );
    await db.getRepository(Automation).insert({
      id: 'workflow',
      ownerUserId: 'owner',
      name: 'Check inventory',
      definitionJson: '{"metadata":{}}',
      lastStatus: AutomationLastStatus.Running,
      lastRunAt: new Date('2026-01-01T00:00:00Z'),
    });
  });

  afterEach(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  it('shows a failed run before any steps start, even after an older run completes', async () => {
    const enqueue = (targetApplicationId: string) =>
      runs.save(
        runs.create({
          automationId: 'workflow',
          ownerUserId: 'owner',
          targetApplicationId,
          trigger: AutomationRunTrigger.Manual,
          status: AutomationRunStatus.Queued,
          createdAt: new Date('2026-01-02T00:00:00Z'),
          stepResultsJson: '[]',
        }),
      );
    const older = await enqueue('app-1');
    const newer = await enqueue('app-2');

    await runs.transition(newer.id, [AutomationRunStatus.Queued], {
      status: AutomationRunStatus.Failed,
      error: 'Run authorization was revoked.',
      completedAt: new Date('2026-01-02T00:00:01Z'),
    });
    await runs.transition(older.id, [AutomationRunStatus.Queued], {
      status: AutomationRunStatus.Canceled,
      error: 'Canceled by user.',
      completedAt: new Date('2026-01-02T00:00:02Z'),
    });

    const summary = {
      lastStatus: AutomationLastStatus.Failed,
      lastError: 'Run authorization was revoked.',
      lastRunAt: '2026-01-02T00:00:01.000Z',
    };
    await expect(
      runs.listForAutomation('owner', 'workflow'),
    ).resolves.toMatchObject([{ id: newer.id }, { id: older.id }]);
    await expect(queries.get('owner', 'workflow')).resolves.toMatchObject(
      summary,
    );
    await expect(queries.list('owner')).resolves.toMatchObject([summary]);
    await expect(
      queries.listGrid({
        ownerUserId: 'owner',
        status: AutomationLastStatus.Failed,
      }),
    ).resolves.toMatchObject({ total: 1, items: [summary] });
  });

  it('shows scheduled rejection separately from recorded runs until a later run is queued', async () => {
    const triggers = new AutomationTriggersRepository(
      db.getRepository(AutomationTrigger),
    );
    const service = new AutomationTriggersService(
      new AutomationsRepository(db.getRepository(Automation)),
      triggers,
      {} as never,
      new AutomationsDtoMapper(new AutomationDefinitionService({} as never)),
      {} as never,
      queries,
      {} as never,
      runs,
    );
    const trigger = await triggers.save(
      triggers.create({
        ownerUserId: 'owner',
        name: 'Inventory schedule',
        automationId: 'workflow',
        targetApplicationId: 'app',
        triggerType: AutomationTriggerType.Schedule,
        triggerConfigJson: '{}',
      }),
    );
    const enqueue = (createdAt: string) =>
      runs.save(
        runs.create({
          automationId: 'workflow',
          automationTriggerId: trigger.id,
          ownerUserId: 'owner',
          targetApplicationId: 'app',
          trigger: AutomationRunTrigger.Schedule,
          createdAt: new Date(createdAt),
          stepResultsJson: '[]',
        }),
      );
    const oldRun = await enqueue('2026-01-02T00:00:00Z');
    await runs.transition(oldRun.id, [AutomationRunStatus.Queued], {
      status: AutomationRunStatus.Success,
      completedAt: new Date('2026-01-02T00:00:01Z'),
    });
    await triggers.updateSchedule(trigger, new Date('2026-01-03T00:00:00Z'), {
      at: new Date('2026-01-02T00:00:02Z'),
      message: 'Target already reserved.',
    });
    const failed = {
      lastRunAt: '2026-01-02T00:00:01.000Z',
      lastStatus: AutomationLastStatus.Failed,
      lastError: 'Target already reserved.',
      nextRunAt: '2026-01-03T00:00:00.000Z',
    };
    await expect(service.get('owner', trigger.id)).resolves.toMatchObject(
      failed,
    );
    await expect(
      service.listGrid({
        ownerUserId: 'owner',
        status: AutomationLastStatus.Failed,
      }),
    ).resolves.toMatchObject({ total: 1, items: [failed] });

    await enqueue('2026-01-03T00:00:00Z');
    await expect(service.list('owner')).resolves.toMatchObject([
      {
        lastRunAt: '2026-01-03T00:00:00.000Z',
        lastStatus: AutomationLastStatus.Running,
        lastError: null,
      },
    ]);
  });
});
