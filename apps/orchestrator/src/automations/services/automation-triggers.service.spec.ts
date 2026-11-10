import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAutomationTriggerDto } from '../dto/automation-trigger.dto';
import {
  AutomationTrigger,
  AutomationTriggerType,
} from '../entities/automation-trigger.entity';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationTriggersRepository } from '../persistence/automation-triggers.repository';
import { AutomationsRepository } from '../persistence/automations.repository';
import { AutomationRunnerService } from '../runner/automation-runner.service';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import { AutomationTargetApplicationService } from './automation-target-application.service';
import { AutomationTriggerSchedulerService } from './automation-trigger-scheduler.service';
import { AutomationsDtoMapper } from './automations-dto-mapper.service';
import { AutomationsQueryService } from './automations-query.service';
import { AutomationTriggersService } from './automation-triggers.service';

describe('trigger descriptions', () => {
  let database: DataSource;
  let service: AutomationTriggersService;
  const assertOwnerAccess = jest.fn();
  const getEntity = jest.fn();
  const input: CreateAutomationTriggerDto = {
    ownerUserId: 'owner',
    name: 'Morning check',
    automationId: 'workflow',
    targetApplicationId: 'app',
    triggerType: AutomationTriggerType.Schedule,
    triggerConfig: { cronExpression: '0 9 * * *' },
    description: '  Stock check before opening.  ',
    tags: [{ name: 'nightly', color: '#2563eb' }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    database = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [AutomationTrigger],
      synchronize: true,
    }).initialize();
    const module = await Test.createTestingModule({
      providers: [
        AutomationTriggersService,
        AutomationsDtoMapper,
        {
          provide: AutomationTriggersRepository,
          useValue: new AutomationTriggersRepository(
            database.getRepository(AutomationTrigger),
          ),
        },
        {
          provide: AutomationsRepository,
          useValue: { listByOwner: jest.fn().mockResolvedValue([]) },
        },
        { provide: AutomationRunnerService, useValue: {} },
        {
          provide: AutomationRunsRepository,
          useValue: {
            latestForTriggers: jest.fn().mockResolvedValue(new Map()),
          },
        },
        { provide: AutomationDefinitionService, useValue: {} },
        {
          provide: AutomationTriggerSchedulerService,
          useValue: {
            normalizeConfig: jest.fn((_type, config) => config),
            nextRunForTrigger: jest.fn(() => new Date('2026-11-09T09:00:00Z')),
            register: jest.fn(),
          },
        },
        { provide: AutomationsQueryService, useValue: { getEntity } },
        {
          provide: AutomationTargetApplicationService,
          useValue: { assertOwnerAccess },
        },
      ],
    }).compile();
    service = module.get(AutomationTriggersService);
  });

  afterEach(async () => {
    if (database?.isInitialized) await database.destroy();
  });

  it('persists and returns descriptions, keeps omitted values, and clears explicit empty values', async () => {
    const created = await service.create(input);
    expect(created.description).toBe('Stock check before opening.');
    expect((await service.get('owner', created.id)).description).toBe(
      created.description,
    );
    expect(
      (await service.update('owner', created.id, { enabled: false }))
        .description,
    ).toBe(created.description);
    expect(
      (
        await service.update('owner', created.id, {
          description: '  New notes  ',
        })
      ).description,
    ).toBe('New notes');
    expect(
      (await service.update('owner', created.id, { description: '  ' }))
        .description,
    ).toBeNull();
    await service.update('owner', created.id, { description: 'Notes' });
    expect(
      (await service.update('owner', created.id, { description: null }))
        .description,
    ).toBeNull();
    expect(getEntity).toHaveBeenCalledWith('owner', 'workflow');
    expect(assertOwnerAccess).toHaveBeenCalledWith('owner', 'app');
  });

  it('searches descriptions within the owner scope and retains tag facets independently of search', async () => {
    const created = await service.create(input);
    await service.create({
      ...input,
      ownerUserId: 'other',
      name: 'Foreign trigger',
      tags: [{ name: 'private', color: '#64748b' }],
    });
    const page = await service.listGrid({
      ownerUserId: 'owner',
      q: 'before opening',
    });
    expect(page.items.map((item) => item.id)).toEqual([created.id]);
    const empty = await service.listGrid({
      ownerUserId: 'owner',
      q: 'no match',
    });
    expect(empty.total).toBe(0);
    expect(empty.facets.tags).toEqual(['nightly']);
    await expect(
      service.update('other', created.id, { description: 'Unauthorized' }),
    ).rejects.toThrow('was not found');
  });

  it('accepts nullable descriptions and rejects oversized or non-text descriptions', async () => {
    for (const description of [undefined, null, '', 'Notes']) {
      expect(
        await validate(
          plainToInstance(CreateAutomationTriggerDto, {
            ...input,
            description,
          }),
        ),
      ).toEqual([]);
    }
    for (const description of ['a'.repeat(2001), 123]) {
      expect(
        (
          await validate(
            plainToInstance(CreateAutomationTriggerDto, {
              ...input,
              description,
            }),
          )
        ).map((error) => error.property),
      ).toContain('description');
    }
  });
});
