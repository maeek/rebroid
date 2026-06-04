import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  listForAutomation(ownerUserId: string, automationId: string, limit = 50) {
    return this.runs.find({
      where: { ownerUserId, automationId },
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(Math.trunc(limit), 100)),
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
}
