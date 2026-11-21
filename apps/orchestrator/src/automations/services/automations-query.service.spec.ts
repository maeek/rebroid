import type { AutomationDefinition } from '@rebroid/automation-core/definition';
import { DataSource } from 'typeorm';
import { InitializeSqliteSchema1800000005000 } from '../../database/migrations/1800000005000-initialize-sqlite-schema';
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
  let definitions: AutomationDefinitionService;
  let queries: AutomationsQueryService;
  let runs: AutomationRunsRepository;

  beforeEach(async () => {
    db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Automation, AutomationRun, AutomationTrigger],
      migrations: [InitializeSqliteSchema1800000005000],
      migrationsRun: true,
    }).initialize();
    runs = new AutomationRunsRepository(db.getRepository(AutomationRun));
    definitions = new AutomationDefinitionService({} as never);
    queries = new AutomationsQueryService(
      new AutomationsRepository(db.getRepository(Automation)),
      new AutomationTriggersRepository(db.getRepository(AutomationTrigger)),
      runs,
      new AutomationsDtoMapper(definitions),
    );
    await db.getRepository(Automation).insert({
      id: 'workflow',
      ownerUserId: 'owner',
      name: 'Check inventory',
      definitionJson: '{"metadata":{},"spec":{"steps":[]}}',
    });
  });

  afterEach(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  it('returns paged summaries with nested step counts and leaves YAML to full workflow reads', async () => {
    const log = (id: string) => ({
      id,
      uses: 'debug.log',
      with: { message: id },
    });
    const definition: AutomationDefinition = {
      apiVersion: 'rebroid.io/automation/v1',
      kind: 'AndroidAutomation',
      metadata: {
        name: 'Inventory audit',
        tags: [{ name: 'nightly', color: '#64748b' }],
      },
      spec: {
        steps: [
          {
            id: 'condition',
            type: 'condition',
            condition: {
              groups: [
                {
                  conditions: [
                    {
                      value: { source: 'literal', value: true },
                      operator: 'isTrue',
                    },
                  ],
                },
              ],
            },
            then: [log('then')],
            else: [log('else')],
          },
          {
            id: 'switch',
            type: 'switch',
            value: { source: 'literal', value: 'a' },
            cases: [{ value: 'a', steps: [log('case')] }],
            default: [log('default')],
          },
          {
            id: 'repeat',
            type: 'repeat',
            count: 3,
            maxIterations: 3,
            steps: [log('repeat-log')],
          },
        ],
      },
    };
    await db.getRepository(Automation).insert({
      id: 'audit',
      ownerUserId: 'owner',
      name: 'Inventory audit',
      definitionJson: JSON.stringify(definition),
    });
    const trigger = {
      ownerUserId: 'owner',
      automationId: 'audit',
      targetApplicationId: 'app-1',
      triggerType: AutomationTriggerType.Schedule,
      triggerConfigJson: '{}',
    };
    await db.getRepository(AutomationTrigger).insert([
      { ...trigger, name: 'Inventory morning' },
      { ...trigger, name: 'Inventory evening' },
    ]);
    const toYaml = jest.spyOn(definitions, 'toYaml');

    const grid = await queries.listGrid({
      ownerUserId: 'owner',
      q: 'inventory',
      sort: 'name:asc',
      page: 2,
      pageSize: 1,
    });
    expect(grid).toMatchObject({
      total: 2,
      page: 2,
      pageSize: 1,
      facets: { tags: ['nightly'], targetApplicationIds: ['app-1'] },
      items: [
        {
          id: 'audit',
          tags: [{ name: 'nightly' }],
          stepCount: 8,
          targetApplicationIds: ['app-1'],
        },
      ],
    });
    expect(grid.items[0]).not.toHaveProperty('definition');
    expect(grid.items[0]).not.toHaveProperty('yaml');
    expect(
      (await queries.listOptions('owner')).find(({ id }) => id === 'audit'),
    ).toEqual({
      id: 'audit',
      name: 'Inventory audit',
      description: null,
      tags: definition.metadata.tags,
      topLevelStepCount: 3,
    });
    expect(
      (await queries.listRunnableOptions('owner')).find(
        ({ id }) => id === 'audit',
      ),
    ).toEqual({
      id: 'audit',
      name: 'Inventory audit',
    });
    await expect(queries.listOptions('other-owner')).resolves.toEqual([]);
    await expect(queries.listRunnableOptions('other-owner')).resolves.toEqual(
      [],
    );
    expect(toYaml).not.toHaveBeenCalled();
    await expect(queries.get('owner', 'audit')).resolves.toMatchObject({
      definition,
      yaml: expect.stringContaining('name: Inventory audit'),
    });
  });

  it('shows a failed run before any steps start, even after an older run completes', async () => {
    await expect(queries.get('owner', 'workflow')).resolves.toMatchObject({
      lastRunId: null,
      lastRunAt: null,
      lastStatus: AutomationLastStatus.NeverRun,
      lastError: null,
    });

    const enqueue = (targetApplicationId: string) =>
      db.getRepository(AutomationRun).save({
        automationId: 'workflow',
        ownerUserId: 'owner',
        targetApplicationId,
        trigger: AutomationRunTrigger.Manual,
        status: AutomationRunStatus.Queued,
        createdAt: new Date('2026-01-02T00:00:00Z'),
      });
    const older = await enqueue('app-1');
    const newer = await enqueue('app-2');

    await db.getRepository(AutomationRun).update(newer.id, {
      status: AutomationRunStatus.Failed,
      error: 'Run authorization was revoked.',
      completedAt: new Date('2026-01-02T00:00:01Z'),
    });
    await db.getRepository(AutomationRun).update(older.id, {
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
    const automations = new AutomationsRepository(db.getRepository(Automation));
    const listDefinitions = jest.spyOn(automations, 'listByOwner');
    const listNames = jest.spyOn(automations, 'listNamesByOwner');
    const service = new AutomationTriggersService(
      automations,
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
    await expect(
      service.listGrid({ ownerUserId: 'owner', q: '  ' }),
    ).resolves.toMatchObject({ total: 1 });
    expect(listNames).not.toHaveBeenCalled();
    await expect(
      service.listGrid({ ownerUserId: 'owner', q: 'Check inventory' }),
    ).resolves.toMatchObject({ total: 1 });
    expect(listNames).toHaveBeenCalledWith('owner');
    expect(listDefinitions).not.toHaveBeenCalled();

    const enqueue = (createdAt: string) =>
      db.getRepository(AutomationRun).save({
        automationId: 'workflow',
        automationTriggerId: trigger.id,
        ownerUserId: 'owner',
        targetApplicationId: 'app',
        trigger: AutomationRunTrigger.Schedule,
        createdAt: new Date(createdAt),
      });
    await triggers.updateSchedule(trigger, new Date('2026-01-02T00:00:00Z'), {
      at: new Date('2026-01-01T00:00:00Z'),
      message: 'First enqueue rejected.',
    });
    await expect(service.get('owner', trigger.id)).resolves.toMatchObject({
      lastRunId: null,
      lastRunAt: null,
      lastStatus: AutomationLastStatus.Failed,
      lastError: 'First enqueue rejected.',
    });

    const oldRun = await enqueue('2026-01-02T00:00:00Z');
    await db.getRepository(AutomationRun).update(oldRun.id, {
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
