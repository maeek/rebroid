import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import { AutomationRunEvent } from '../entities/automation-run-event.entity';
import type {
  AutomationRunEventInput,
  AutomationRunEventRecord,
} from '../events/automation-run-events.types';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class AutomationRunEventsRepository {
  private appendTail: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(AutomationRunEvent)
    private readonly events: Repository<AutomationRunEvent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly metrics: MetricsService,
  ) {}

  async append(input: AutomationRunEventInput) {
    const finishMetrics = this.metrics.beginAutomationEventPersistence();
    const append = this.appendTail.then(
      () => this.appendInTransaction(input),
      () => this.appendInTransaction(input),
    );
    this.appendTail = append.then(
      () => undefined,
      () => undefined,
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

  private appendInTransaction(input: AutomationRunEventInput) {
    return this.dataSource.transaction(async (manager) => {
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

      return manager.getRepository(AutomationRunEvent).save(
        manager.getRepository(AutomationRunEvent).create({
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
    });
  }

  async listForRun(ownerUserId: string, runId: string, after = 0) {
    return (
      await this.events.find({
        where: {
          ownerUserId,
          runId,
          sequence: MoreThan(Math.max(0, Math.trunc(after))),
        },
        order: { sequence: 'ASC' },
        take: 1000,
      })
    ).map(toRecord);
  }

  async findFailureRequestId(ownerUserId: string, runId: string) {
    const failure = await this.events.findOne({
      where: { ownerUserId, runId, type: 'run.failed' },
      order: { sequence: 'DESC' },
    });
    if (!failure) return undefined;
    const { requestId } = toRecord(failure).data;
    return typeof requestId === 'string' &&
      /^[a-zA-Z0-9._:-]{1,128}$/.test(requestId)
      ? requestId
      : undefined;
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
    await this.events.delete({ ownerUserId, runId: In(runIds) });
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
