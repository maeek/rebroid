import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  MoreThan,
  Repository,
  type EntityManager,
} from 'typeorm';
import { AutomationRunEvent } from '../entities/automation-run-event.entity';
import type {
  AutomationRunEventInput,
  AutomationRunEventRecord,
} from '../events/automation-run-events.types';
import {
  AutomationRun,
  AutomationRunStatus,
} from '../entities/automation-run.entity';
import { AutomationPersistenceQueue } from './automation-persistence-queue';
import { MetricsService } from '../../metrics/metrics.service';
import type { AutomationStepResult } from '../runner/automation-runner.types';

type RunTransition =
  | {
      status: AutomationRunStatus.Running;
      targetProfileMode: string;
      targetProfileName: string;
      startedAt: Date;
      error: null;
    }
  | {
      status:
        | AutomationRunStatus.Success
        | AutomationRunStatus.Failed
        | AutomationRunStatus.Canceled;
      completedAt: Date;
      error: string | null;
    };

@Injectable()
export class AutomationRunEventsRepository {
  constructor(
    @InjectRepository(AutomationRunEvent)
    private readonly events: Repository<AutomationRunEvent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly metrics: MetricsService,
    private readonly queue: AutomationPersistenceQueue = new AutomationPersistenceQueue(),
  ) {}

  async append(input: AutomationRunEventInput) {
    const finishMetrics = this.metrics.beginAutomationEventPersistence();
    const append = this.queue.run(() =>
      this.dataSource.transaction((manager) =>
        this.appendInTransaction(manager, input),
      ),
    );
    try {
      const event = await append;
      finishMetrics('success');
      return toRecord(event);
    } catch (error) {
      finishMetrics('error');
      throw error;
    }
  }

  async transitionRun(
    id: string,
    expectedStatuses: AutomationRunStatus[],
    patch: RunTransition,
    event: Omit<AutomationRunEventInput, 'runId' | 'ownerUserId'>,
  ) {
    const finishMetrics = this.metrics.beginAutomationEventPersistence();
    try {
      const result = await this.queue.run(() =>
        this.dataSource.transaction(async (manager) => {
          const runs = manager.getRepository(AutomationRun);
          const updated = await runs.update(
            { id, status: In(expectedStatuses) },
            patch,
          );
          if (!updated.affected) return null;
          const run = await runs.findOneByOrFail({ id });
          const record = await this.appendInTransaction(manager, {
            ...event,
            runId: id,
            ownerUserId: run.ownerUserId,
          });
          run.lastEventSequence = record.sequence;
          return { run, event: toRecord(record) };
        }),
      );
      if (result) finishMetrics('success');
      return result;
    } catch (error) {
      finishMetrics('error');
      throw error;
    }
  }

  async recordStepOutcome(
    input: AutomationRunEventInput & { type: 'step.completed' | 'step.failed' },
    result: AutomationStepResult,
  ) {
    const finishMetrics = this.metrics.beginAutomationEventPersistence();
    try {
      const event = await this.queue.run(() =>
        this.dataSource.transaction(async (manager) => {
          const updated = await manager.getRepository(AutomationRun).update(
            {
              id: input.runId,
              ownerUserId: input.ownerUserId,
              status: AutomationRunStatus.Running,
            },
            { error: result.error },
          );
          if (!updated.affected) return null;
          await manager.query(
            `INSERT INTO automation_run_step_results (runId, sequence, resultJson)
             SELECT ?, COALESCE(MAX(sequence), 0) + 1, ?
             FROM automation_run_step_results WHERE runId = ?`,
            [input.runId, JSON.stringify(result), input.runId],
          );
          return toRecord(await this.appendInTransaction(manager, input));
        }),
      );
      if (event) finishMetrics('success');
      return event;
    } catch (error) {
      finishMetrics('error');
      throw error;
    }
  }

  private async appendInTransaction(
    manager: EntityManager,
    input: AutomationRunEventInput,
  ) {
    const rows = (await manager.query(
      `UPDATE automation_runs
       SET lastEventSequence = lastEventSequence + 1
       WHERE id = ?
       RETURNING lastEventSequence`,
      [input.runId],
    )) as Array<{ lastEventSequence: number }>;
    const sequence = rows[0]?.lastEventSequence;
    if (!Number.isInteger(sequence)) {
      throw new Error(
        `Cannot append an event for missing automation run "${input.runId}".`,
      );
    }
    const events = manager.getRepository(AutomationRunEvent);
    return events.save(
      events.create({
        runId: input.runId,
        ownerUserId: input.ownerUserId,
        sequence,
        type: input.type,
        stepId: input.stepId ?? null,
        parentStepId: input.parentStepId ?? null,
        message: input.message ?? '',
        dataJson: JSON.stringify(input.data ?? {}),
      }),
    );
  }

  latestSequence(ownerUserId: string, runId: string) {
    return this.queue.run(async () => {
      const event = await this.events.findOne({
        where: { ownerUserId, runId },
        order: { sequence: 'DESC' },
        select: { sequence: true },
      });
      return event?.sequence ?? 0;
    });
  }

  listForRun(ownerUserId: string, runId: string, after = 0) {
    return this.queue.run(async () => {
      const rows = await this.events.find({
        where: {
          ownerUserId,
          runId,
          sequence: MoreThan(Math.max(0, Math.trunc(after))),
        },
        order: { sequence: 'ASC' },
        take: 1000,
      });
      return rows.map(toRecord);
    });
  }

  async findFailureDetails(ownerUserId: string, runId: string) {
    const failure = await this.events.findOne({
      where: { ownerUserId, runId, type: 'run.failed' },
      order: { sequence: 'DESC' },
    });
    if (!failure) return {};
    const { requestId, code } = toRecord(failure).data;
    return {
      failureRequestId:
        typeof requestId === 'string' &&
        /^[a-zA-Z0-9._:-]{1,128}$/.test(requestId)
          ? requestId
          : undefined,
      failureCode:
        typeof code === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(code)
          ? code
          : undefined,
    };
  }

  async listConversationEvents(ownerUserId: string, runIds: string[]) {
    if (!runIds.length) return [];
    const query = this.events.createQueryBuilder('event');
    const recent = query
      .subQuery()
      .select('recent.id')
      .from(
        (ranked) =>
          ranked
            .select('candidate.id', 'id')
            .addSelect('candidate.type', 'type')
            .addSelect(
              'ROW_NUMBER() OVER (PARTITION BY candidate.runId, candidate.type ORDER BY candidate.sequence DESC)',
              'typeRank',
            )
            .addSelect(
              'ROW_NUMBER() OVER (PARTITION BY candidate.runId ORDER BY candidate.sequence DESC)',
              'rank',
            )
            .from(AutomationRunEvent, 'candidate')
            .where(
              'candidate.ownerUserId = :ownerUserId AND candidate.runId IN (:...runIds)',
            ),
        'recent',
      )
      .where(
        'recent.rank <= 80 OR (recent.type IN (:...summaryTypes) AND recent.typeRank = 1)',
      )
      .getQuery();
    const rows = await query
      .where(
        'event.ownerUserId = :ownerUserId AND event.runId IN (:...runIds)',
        { ownerUserId, runIds },
      )
      .andWhere(`event.id IN ${recent}`, {
        summaryTypes: [
          'ai.user.message',
          'ai.message.completed',
          'run.completed',
          'run.failed',
          'run.canceled',
        ],
      })
      .orderBy('event.sequence', 'ASC')
      .getMany();
    return rows.map(toRecord);
  }

  async deleteForRuns(ownerUserId: string, runIds: string[]) {
    if (runIds.length === 0) {
      return;
    }
    await this.queue.run(() =>
      this.events.delete({ ownerUserId, runId: In(runIds) }),
    );
  }
}

const toRecord = (event: AutomationRunEvent): AutomationRunEventRecord => ({
  id: event.id,
  runId: event.runId,
  ownerUserId: event.ownerUserId,
  sequence: event.sequence,
  type: event.type as AutomationRunEventRecord['type'],
  stepId: event.stepId,
  parentStepId: event.parentStepId,
  message: event.message,
  data: parseData(event.dataJson),
  createdAt: event.createdAt.toISOString(),
});

const parseData = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};
