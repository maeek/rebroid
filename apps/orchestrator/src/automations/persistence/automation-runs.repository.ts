import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Like, Not, Repository } from 'typeorm';
import { adHocAiAutomationIdPrefix } from '../contracts/automation-run-kind';
import type { WorkflowHistoryMaintenancePort } from '../contracts/workflow-history-maintenance.port';
import { AutomationPersistenceQueue } from './automation-persistence-queue';
import { Automation } from '../entities/automation.entity';
import { AutomationRunEvent } from '../entities/automation-run-event.entity';
import {
  AutomationRun,
  AutomationRunStatus,
} from '../entities/automation-run.entity';

const adHocAiPattern = `${adHocAiAutomationIdPrefix}%`;
const historyBatchSize = 250;

@Injectable()
export class AutomationRunsRepository implements WorkflowHistoryMaintenancePort {
  constructor(
    @InjectRepository(AutomationRun)
    private readonly runs: Repository<AutomationRun>,
    private readonly queue: AutomationPersistenceQueue = new AutomationPersistenceQueue(),
  ) {}

  create(values: Partial<AutomationRun>) {
    const run = this.runs.create(values);
    run.stepResultsJson = '[]';
    return run;
  }

  save(run: AutomationRun) {
    return this.queue.run(() => this.runs.save(run));
  }

  findById(id: string) {
    return this.runs.findOneBy({ id });
  }

  listAllActive() {
    return this.runs.find({
      select: { id: true },
      where: [
        { status: AutomationRunStatus.Queued },
        { status: AutomationRunStatus.Running },
      ],
      order: { createdAt: 'ASC' },
    });
  }

  listForAutomation(ownerUserId: string, automationId: string, limit = 50) {
    return this.runs
      .createQueryBuilder('run')
      .addSelect('run.stepResultsJson')
      .where({ ownerUserId, automationId })
      .orderBy('run.createdAt', 'DESC')
      .addOrderBy('run.rowid', 'DESC')
      .limit(Math.max(1, Math.min(Math.trunc(limit), 100)))
      .getMany();
  }

  async latestForAutomations(ownerUserId: string, id?: string) {
    const runs = await this.latestFor(
      'automations',
      'automationId',
      ownerUserId,
      id,
    );
    return new Map(runs.map((run) => [run.automationId, run]));
  }

  async latestForTriggers(ownerUserId: string, id?: string) {
    const runs = await this.latestFor(
      'automation_triggers',
      'automationTriggerId',
      ownerUserId,
      id,
    );
    return new Map(runs.map((run) => [run.automationTriggerId, run]));
  }

  private latestFor(
    table: 'automations' | 'automation_triggers',
    foreignKey: 'automationId' | 'automationTriggerId',
    ownerUserId: string,
    id?: string,
  ) {
    // SQLite assigns a rowid on insertion, which breaks ties for existing second-precision timestamps.
    return this.runs
      .createQueryBuilder('run')
      .select([
        'run.id',
        'run.automationId',
        'run.automationTriggerId',
        'run.status',
        'run.error',
        'run.createdAt',
        'run.startedAt',
        'run.completedAt',
      ])
      .where(
        `run.id IN (
          SELECT (SELECT latest.id FROM automation_runs latest
                  WHERE latest.ownerUserId = resource.ownerUserId AND latest.${foreignKey} = resource.id
                  ORDER BY latest.createdAt DESC, latest.rowid DESC LIMIT 1)
          FROM ${table} resource
          WHERE resource.ownerUserId = :ownerUserId ${id === undefined ? '' : 'AND resource.id = :id'}
        )`,
        { ownerUserId, id },
      )
      .getMany();
  }

  listActive(ownerUserId: string) {
    return this.runs
      .createQueryBuilder('run')
      .addSelect('run.stepResultsJson')
      .where([
        { ownerUserId, status: AutomationRunStatus.Queued },
        { ownerUserId, status: AutomationRunStatus.Running },
      ])
      .orderBy('run.createdAt', 'DESC')
      .getMany();
  }

  async listApplicationWorkflows(
    ownerUserId: string,
    targetApplicationId: string,
    page: number,
    pageSize: number,
    search: string,
  ) {
    const query = this.applicationWorkflows(ownerUserId, targetApplicationId);
    if (search) {
      query.andWhere(
        '(instr(lower(workflow.name), lower(:search)) > 0 OR instr(lower(run.id), lower(:search)) > 0)',
        { search },
      );
    }
    const [total, result] = await Promise.all([
      query.getCount(),
      query
        .clone()
        .select([
          'run.id',
          'run.automationId',
          'run.status',
          'run.trigger',
          'run.createdAt',
          'run.startedAt',
          'run.completedAt',
        ])
        .addSelect('workflow.name', 'automationName')
        .orderBy('run.createdAt', 'DESC')
        .addOrderBy('run.rowid', 'DESC')
        .limit(pageSize)
        .offset(page * pageSize)
        .getRawAndEntities<{ automationName: string | null }>(),
    ]);
    return {
      items: result.entities.map((run, index) => ({
        run,
        automationName: result.raw[index]?.automationName ?? null,
      })),
      total,
    };
  }

  async findApplicationWorkflow(
    ownerUserId: string,
    targetApplicationId: string,
    runId: string,
  ) {
    const {
      entities: [run],
      raw,
    } = await this.applicationWorkflows(ownerUserId, targetApplicationId)
      .andWhere('run.id = :runId', { runId })
      .addSelect('run.stepResultsJson')
      .addSelect('workflow.name', 'automationName')
      .getRawAndEntities<{ automationName: string | null }>();
    return run ? { run, automationName: raw[0]?.automationName ?? null } : null;
  }

  private applicationWorkflows(
    ownerUserId: string,
    targetApplicationId: string,
  ) {
    return this.runs
      .createQueryBuilder('run')
      .leftJoin(
        Automation,
        'workflow',
        'workflow.id = run.automationId AND workflow.ownerUserId = run.ownerUserId',
      )
      .where({ ownerUserId, targetApplicationId })
      .andWhere('run.automationId NOT LIKE :adHocAiPattern', {
        adHocAiPattern,
      });
  }

  listAdHocAiForTarget(
    ownerUserId: string,
    targetApplicationId: string,
    limit = 20,
  ) {
    return this.runs
      .createQueryBuilder('run')
      .addSelect('run.stepResultsJson')
      .where({
        ownerUserId,
        targetApplicationId,
        automationId: Like(adHocAiPattern),
      })
      .orderBy('run.createdAt', 'DESC')
      .take(Math.max(1, Math.min(Math.trunc(limit), 50)))
      .getMany();
  }

  listAllAdHocAiForTarget(ownerUserId: string, targetApplicationId: string) {
    return this.runs.find({
      select: { id: true, status: true },
      where: {
        ownerUserId,
        targetApplicationId,
        automationId: Like(adHocAiPattern),
      },
      order: { createdAt: 'DESC' },
    });
  }

  findByOwnerAndId(ownerUserId: string, id: string) {
    return this.runs
      .createQueryBuilder('run')
      .addSelect('run.stepResultsJson')
      .where({ ownerUserId, id })
      .getOne();
  }

  findMetadataByOwnerAndId(ownerUserId: string, id: string) {
    return this.runs.findOneBy({ ownerUserId, id });
  }

  existsForOwner(ownerUserId: string, id: string) {
    return this.runs.existsBy({ ownerUserId, id });
  }

  findActiveByTarget(targetApplicationId: string) {
    return this.runs.findOne({
      where: [
        { targetApplicationId, status: AutomationRunStatus.Queued },
        { targetApplicationId, status: AutomationRunStatus.Running },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async deleteByIds(ownerUserId: string, ids: string[]) {
    if (ids.length === 0) {
      return;
    }
    await this.queue.run(() => this.runs.delete({ ownerUserId, id: In(ids) }));
  }

  async pruneWorkflowHistory(cutoff: Date) {
    let removedRuns = 0;
    const finishedWorkflows = {
      automationId: Not(Like(adHocAiPattern)),
      status: In([
        AutomationRunStatus.Success,
        AutomationRunStatus.Failed,
        AutomationRunStatus.Canceled,
      ]),
    };
    while (true) {
      const count = await this.queue.run(() =>
        this.runs.manager.transaction(async (manager) => {
          const runs = manager.getRepository(AutomationRun);
          const expired = await runs.find({
            select: { id: true },
            where: [
              { ...finishedWorkflows, completedAt: LessThan(cutoff) },
              {
                ...finishedWorkflows,
                completedAt: IsNull(),
                updatedAt: LessThan(cutoff),
              },
            ],
            order: { completedAt: 'ASC', id: 'ASC' },
            take: historyBatchSize,
          });
          if (!expired.length) return 0;
          const ids = In(expired.map(({ id }) => id));
          await manager
            .getRepository(AutomationRunEvent)
            .delete({ runId: ids });
          // Step results cascade with the run. Events are removed in the same transaction.
          await runs.delete({ id: ids });
          return expired.length;
        }),
      );
      removedRuns += count;
      if (count < historyBatchSize) return { removedRuns };
    }
  }
}
