import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { AutomationRunEvent } from '../entities/automation-run-event.entity';
import type {
  AutomationRunEventInput,
  AutomationRunEventRecord,
} from '../events/automation-run-events.types';

@Injectable()
export class AutomationRunEventsRepository {
  constructor(
    @InjectRepository(AutomationRunEvent)
    private readonly events: Repository<AutomationRunEvent>,
  ) {}

  async append(input: AutomationRunEventInput) {
    const latest = await this.events.findOne({
      where: { runId: input.runId },
      order: { sequence: 'DESC' },
    });
    const event = await this.events.save(
      this.events.create({
        runId: input.runId,
        ownerUserId: input.ownerUserId,
        sequence: (latest?.sequence ?? 0) + 1,
        type: input.type,
        stepId: input.stepId ?? null,
        parentStepId: input.parentStepId ?? null,
        message: input.message ?? '',
        dataJson: JSON.stringify(input.data ?? {}),
      }),
    );
    return toRecord(event);
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
