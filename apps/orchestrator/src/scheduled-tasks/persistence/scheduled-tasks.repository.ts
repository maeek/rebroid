import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ScheduledTask,
  type ScheduledTaskActionType,
} from '../entities/scheduled-task.entity';

@Injectable()
export class ScheduledTasksRepository {
  constructor(
    @InjectRepository(ScheduledTask)
    private readonly tasks: Repository<ScheduledTask>,
  ) {}

  create(values: Partial<ScheduledTask>) {
    return this.tasks.create(values);
  }

  save(task: ScheduledTask) {
    return this.tasks.save(task);
  }

  updateConfiguration(
    task: ScheduledTask,
    { includePayload = true }: { includePayload?: boolean } = {},
  ) {
    return this.tasks.update(task.id, {
      name: task.name,
      enabled: task.enabled,
      cronExpression: task.cronExpression,
      actionType: task.actionType,
      ...(includePayload ? { payloadJson: task.payloadJson } : {}),
      nextRunAt: task.nextRunAt,
    });
  }

  updatePayload(
    id: string,
    actionType: ScheduledTaskActionType,
    payloadJson: string | null,
  ) {
    return this.tasks.update({ id, actionType }, { payloadJson });
  }

  recordRunResult(
    id: string,
    result: Pick<ScheduledTask, 'lastStatus' | 'lastError' | 'lastRunAt'>,
  ) {
    return this.tasks.update(id, result);
  }

  updateNextRun(
    task: Pick<ScheduledTask, 'id' | 'enabled' | 'cronExpression'>,
    nextRunAt: Date | null,
  ) {
    return this.tasks.update(
      {
        id: task.id,
        enabled: task.enabled,
        cronExpression: task.cronExpression,
      },
      { nextRunAt },
    );
  }

  remove(task: ScheduledTask) {
    return this.tasks.remove(task);
  }

  findAll() {
    return this.tasks.find();
  }

  listForDisplay() {
    return this.tasks.find({ order: { updatedAt: 'DESC' } });
  }

  findById(id: string) {
    return this.tasks.findOneBy({ id });
  }

  findByPredefinedKeys(keys: string[]) {
    return this.tasks.find({ where: { predefinedKey: In(keys) } });
  }
}
