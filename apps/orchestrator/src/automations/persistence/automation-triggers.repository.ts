import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import {
  AutomationTrigger,
  AutomationTriggerType,
} from '../entities/automation-trigger.entity';

@Injectable()
export class AutomationTriggersRepository {
  constructor(
    @InjectRepository(AutomationTrigger)
    private readonly triggers: Repository<AutomationTrigger>,
  ) {}

  create(values: Partial<AutomationTrigger>) {
    return this.triggers.create(values);
  }

  save(trigger: AutomationTrigger) {
    return this.triggers.save(trigger);
  }

  async saveConfiguration(trigger: AutomationTrigger) {
    const {
      id,
      ownerUserId,
      name,
      description,
      automationId,
      targetApplicationId,
      profileMode,
      profileName,
      enabled,
      tagsJson,
      triggerType,
      triggerConfigJson,
      nextRunAt,
    } = trigger;
    await this.triggers.update(
      { id, ownerUserId },
      {
        name,
        description,
        automationId,
        targetApplicationId,
        profileMode,
        profileName,
        enabled,
        tagsJson,
        triggerType,
        triggerConfigJson,
        nextRunAt,
      },
    );
  }

  updateSchedule(
    trigger: AutomationTrigger,
    nextRunAt: Date | null,
    failure?: { at: Date; message: string },
  ) {
    const schedule = {
      id: trigger.id,
      ownerUserId: trigger.ownerUserId,
      enabled: trigger.enabled,
      triggerConfigJson: trigger.triggerConfigJson,
    };
    if (!failure) return this.triggers.update(schedule, { nextRunAt });
    return this.triggers.update(
      [
        { ...schedule, lastEnqueueFailureAt: IsNull() },
        { ...schedule, lastEnqueueFailureAt: LessThanOrEqual(failure.at) },
      ],
      {
        nextRunAt,
        lastEnqueueFailureAt: failure.at,
        lastEnqueueError: failure.message,
      },
    );
  }

  remove(trigger: AutomationTrigger) {
    return this.triggers.remove(trigger);
  }

  findAll() {
    return this.triggers.find();
  }

  listByOwner(ownerUserId: string) {
    return this.triggers.find({
      where: { ownerUserId },
      order: { updatedAt: 'DESC' },
    });
  }

  findByOwnerAndId(ownerUserId: string, id: string) {
    return this.triggers.findOneBy({ ownerUserId, id });
  }

  findEnabledSchedule(id: string) {
    return this.triggers.findOneBy({
      id,
      enabled: true,
      triggerType: AutomationTriggerType.Schedule,
    });
  }

  deleteByAutomation(ownerUserId: string, automationId: string) {
    return this.triggers.delete({ ownerUserId, automationId });
  }
}
