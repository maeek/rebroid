import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import {
  AutomationRun,
  AutomationRunStatus,
} from '../entities/automation-run.entity';

@Injectable()
export class AutomationRunsRepository {
  constructor(
    @InjectRepository(AutomationRun)
    private readonly runs: Repository<AutomationRun>,
  ) {}

  create(values: Partial<AutomationRun>) {
    return this.runs.create(values);
  }

  save(run: AutomationRun) {
    return this.runs.save(run);
  }

  findById(id: string) {
    return this.runs.findOneBy({ id });
  }

  async transition(
    id: string,
    expectedStatuses: AutomationRunStatus[],
    patch: Partial<AutomationRun>,
  ) {
    const result = await this.runs.update(
      { id, status: In(expectedStatuses) },
      patch,
    );
    if (!result.affected) {
      return null;
    }
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

  updateProgress(id: string, stepResultsJson: string, error: string | null) {
    return this.runs.update(
      { id, status: AutomationRunStatus.Running },
      { stepResultsJson, error },
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
    await this.runs.delete({ ownerUserId, id: In(ids) });
  }
}
