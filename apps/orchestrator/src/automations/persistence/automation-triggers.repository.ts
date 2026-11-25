import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import {
  AutomationTrigger,
  AutomationTriggerType,
} from '../entities/automation-trigger.entity';

type TriggerConfigurationPatch = Partial<
  Pick<
    AutomationTrigger,
    | 'name'
    | 'description'
    | 'automationId'
    | 'targetDeviceId'
    | 'profileMode'
    | 'profileName'
    | 'enabled'
    | 'tagsJson'
    | 'triggerType'
    | 'triggerConfigJson'
    | 'nextRunAt'
  >
>;

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

  updateConfiguration(
    ownerUserId: string,
    id: string,
    prepare: (current: AutomationTrigger) => TriggerConfigurationPatch,
  ) {
    return this.triggers.manager.transaction(async (manager) => {
      const repository = manager.getRepository(AutomationTrigger);
      const criteria = { id, ownerUserId };
      const current = await repository.findOneBy(criteria);
      if (!current) return null;
      await repository.update(criteria, prepare(current));
      return repository.findOneByOrFail(criteria);
    });
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
      automationId: trigger.automationId,
      targetDeviceId: trigger.targetDeviceId,
      profileMode: trigger.profileMode ?? IsNull(),
      profileName: trigger.profileName ?? IsNull(),
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
    return this.triggers.manager.transaction(async (manager) => {
      const repository = manager.getRepository(AutomationTrigger);
      const where = { ownerUserId, automationId };
      const triggers = await repository.find({ where, select: { id: true } });
      await repository.delete(where);
      return triggers.map(({ id }) => id);
    });
  }
}
