import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
