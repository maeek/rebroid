import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  QueryFailedError,
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
import { SerialQueue } from '../../common/serial-queue';
import { MetricsService } from '../../metrics/metrics.service';
import type { AutomationStepResult } from '../runner/automation-runner.types';

const eventPageSize = 1_000;
const replayPageBytes = 1024 * 1024;

export class AutomationRunTargetConflictError extends Error {}

function isActiveTargetConflict(error: unknown) {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError: Error & { code?: string } = error.driverError;
  return (
    driverError.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    (driverError.message ===
      'UNIQUE constraint failed: automation_runs.targetApplicationId' ||
      driverError.message ===
        "UNIQUE constraint failed: index 'automation_runs_active_target_unique'")
  );
}

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

type QueuedRun = Pick<
  AutomationRun,
  | 'automationId'
  | 'automationTriggerId'
  | 'ownerUserId'
  | 'targetApplicationId'
  | 'targetProfileMode'
  | 'targetProfileName'
  | 'trigger'
>;

function transitionSources(status: RunTransition['status']) {
  switch (status) {
    case AutomationRunStatus.Running:
      return [AutomationRunStatus.Queued];
    case AutomationRunStatus.Success:
      return [AutomationRunStatus.Running];
    default:
      return [AutomationRunStatus.Queued, AutomationRunStatus.Running];
  }
}

function transitionEvent(
  patch: RunTransition,
  automationId: string,
  data?: Record<string, unknown>,
): Omit<AutomationRunEventInput, 'runId' | 'ownerUserId'> {
  switch (patch.status) {
    case AutomationRunStatus.Running:
      return {
        type: 'run.started',
        message: 'Automation started.',
        data: { automationId },
      };
    case AutomationRunStatus.Canceled:
      return { type: 'run.canceled', message: 'Automation canceled.' };
    case AutomationRunStatus.Failed:
      return {
        type: 'run.failed',
        message: patch.error ?? 'Automation failed.',
        data,
      };
    case AutomationRunStatus.Success:
      return { type: 'run.completed', message: 'Automation completed.' };
  }
}

@Injectable()
export class AutomationRunEventsRepository {
  constructor(
    @InjectRepository(AutomationRunEvent)
    private readonly events: Repository<AutomationRunEvent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly metrics: MetricsService,
    private readonly queue: SerialQueue = new SerialQueue(),
  ) {}

  enqueueRun(
    input: QueuedRun,
    userMessage?: { prompt: string; clientMessageId?: string },
  ) {
    return this.persistEvent(async (manager) => {
      const runs = manager.getRepository(AutomationRun);
      const reservation = runs.create({
        ...input,
        status: AutomationRunStatus.Queued,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        error: null,
        lastEventSequence: 0,
      });
      let run: AutomationRun;
      try {
        run = await runs.save(reservation);
      } catch (error) {
        if (isActiveTargetConflict(error)) {
          throw new AutomationRunTargetConflictError(
            'An automation run already reserves this target.',
            { cause: error },
          );
        }
        throw error;
      }
      const identity = { runId: run.id, ownerUserId: run.ownerUserId };
      const queued = await this.appendInTransaction(manager, {
        ...identity,
        type: 'run.queued',
        message: 'Automation queued.',
        data: { automationId: run.automationId, trigger: run.trigger },
      });
      const events = [toRecord(queued)];
      if (userMessage) {
        events.push(
          toRecord(
            await this.appendInTransaction(manager, {
              ...identity,
              type: 'ai.user.message',
              message: userMessage.prompt,
              data: { clientMessageId: userMessage.clientMessageId ?? null },
            }),
          ),
        );
      }
      run.lastEventSequence = events[events.length - 1].sequence;
      return { run, events };
    });
  }

  appendWhileRunning(input: AutomationRunEventInput) {
    return this.appendWhile(input, AutomationRunStatus.Running);
  }

  appendWhileQueued(input: AutomationRunEventInput) {
    return this.appendWhile(input, AutomationRunStatus.Queued);
  }

  private appendWhile(
    input: AutomationRunEventInput,
    status: AutomationRunStatus,
  ) {
    return this.persistEvent(async (manager) => {
      const matchesRun = await manager.getRepository(AutomationRun).existsBy({
        id: input.runId,
        ownerUserId: input.ownerUserId,
        status,
      });
      return matchesRun
        ? toRecord(await this.appendInTransaction(manager, input))
        : null;
    });
  }

  private async persistEvent<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ) {
    const finishMetrics = this.metrics.beginAutomationEventPersistence();
    try {
      const event = await this.queue.run(() =>
        this.dataSource.transaction(operation),
      );
      if (event) finishMetrics('success');
      return event;
    } catch (error) {
      finishMetrics('error');
      throw error;
    }
  }

  transitionRun(
    id: string,
    patch: RunTransition,
    data?: Record<string, unknown>,
  ) {
    return this.persistEvent(async (manager) => {
      const runs = manager.getRepository(AutomationRun);
      const updated = await runs.update(
        { id, status: In(transitionSources(patch.status)) },
        patch,
      );
      if (!updated.affected) return null;
      const run = await runs.findOneByOrFail({ id });
      const record = await this.appendInTransaction(manager, {
        ...transitionEvent(patch, run.automationId, data),
        runId: id,
        ownerUserId: run.ownerUserId,
      });
      run.lastEventSequence = record.sequence;
      return { run, event: toRecord(record) };
    });
  }

  recordStepOutcome(
    input: AutomationRunEventInput & { type: 'step.completed' | 'step.failed' },
    result: AutomationStepResult,
  ) {
    return this.persistEvent(async (manager) => {
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
    });
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

  listReplayPage(
    ownerUserId: string,
    runId: string,
    after: number,
    through: number,
  ) {
    return this.queue.run(async () => {
      // Keep the first event even if a legacy payload exceeds a page on its own.
      const rows = await this.events
        .createQueryBuilder('event')
        .where(
          `event.id IN (
             SELECT id FROM (
               SELECT id, ROW_NUMBER() OVER (ORDER BY sequence) AS position,
                 SUM(payloadBytes) OVER (ORDER BY sequence) AS pageBytes
               FROM (
                 SELECT id, sequence, octet_length(dataJson) + octet_length(message) AS payloadBytes
                 FROM automation_run_events
                 WHERE ownerUserId = :ownerUserId AND runId = :runId
                   AND sequence > :after AND sequence <= :through
                 ORDER BY sequence LIMIT :pageSize
               )
             ) WHERE position = 1 OR pageBytes <= :pageBytes
           )`,
          {
            ownerUserId,
            runId,
            after: Number.isFinite(after) ? Math.max(0, Math.trunc(after)) : 0,
            through,
            pageSize: eventPageSize,
            pageBytes: replayPageBytes,
          },
        )
        .orderBy('event.sequence', 'ASC')
        .getMany();
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
