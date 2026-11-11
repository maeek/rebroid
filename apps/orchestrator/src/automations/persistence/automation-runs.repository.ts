import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import type { AutomationStepResult } from '../runner/automation-runner.types';
import { AutomationPersistenceQueue } from './automation-persistence-queue';
import { Automation } from '../entities/automation.entity';
import {
  AutomationRun,
  AutomationRunStatus,
} from '../entities/automation-run.entity';

@Injectable()
export class AutomationRunsRepository {
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
      where: [
        { status: AutomationRunStatus.Queued },
        { status: AutomationRunStatus.Running },
      ],
      order: { createdAt: 'ASC' },
    });
  }

  appendStepResults(
    id: string,
    firstSequence: number,
    results: AutomationStepResult[],
    error: string | null,
  ) {
    return this.queue.run(() =>
      this.runs.manager.transaction(async (manager) => {
        const updated = await manager
          .getRepository(AutomationRun)
          .update({ id, status: AutomationRunStatus.Running }, { error });
        if (!updated.affected) return false;
        for (const [index, result] of results.entries()) {
          await manager.query(
            `INSERT INTO automation_run_step_results (runId, sequence, resultJson)
             VALUES (?, ?, ?)`,
            [id, firstSequence + index, JSON.stringify(result)],
          );
        }
        return true;
      }),
    );
  }

  listForAutomation(ownerUserId: string, automationId: string, limit = 50) {
    return this.runs
      .createQueryBuilder('run')
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
    return this.runs.find({
      where: [
        { ownerUserId, status: AutomationRunStatus.Queued },
        { ownerUserId, status: AutomationRunStatus.Running },
      ],
      order: { createdAt: 'DESC' },
    });
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
      .andWhere("run.automationId NOT LIKE 'ephemeral-ai-%'");
  }

  listAdHocAiForTarget(
    ownerUserId: string,
    targetApplicationId: string,
    limit = 20,
  ) {
    return this.runs.find({
      where: {
        ownerUserId,
        targetApplicationId,
        automationId: Like('ephemeral-ai-%'),
      },
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(Math.trunc(limit), 50)),
    });
  }

  listAllAdHocAiForTarget(ownerUserId: string, targetApplicationId: string) {
    return this.runs.find({
      where: {
        ownerUserId,
        targetApplicationId,
        automationId: Like('ephemeral-ai-%'),
      },
      order: { createdAt: 'DESC' },
    });
  }

  findByOwnerAndId(ownerUserId: string, id: string) {
    return this.runs.findOneBy({ ownerUserId, id });
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
}
