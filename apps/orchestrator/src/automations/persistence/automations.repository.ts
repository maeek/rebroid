import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Automation } from '../entities/automation.entity';

@Injectable()
export class AutomationsRepository {
  constructor(
    @InjectRepository(Automation)
    private readonly automations: Repository<Automation>,
  ) {}

  create(values: Partial<Automation>) {
    return this.automations.create(values);
  }

  save(automation: Automation) {
    return this.automations.save(automation);
  }

  remove(automation: Automation) {
    return this.automations.remove(automation);
  }

  findAll() {
    return this.automations.find();
  }

  listByOwner(ownerUserId: string) {
    return this.automations.find({
      where: { ownerUserId },
      order: { updatedAt: 'DESC' },
    });
  }

  findByOwnerAndId(ownerUserId: string, id: string) {
    return this.automations.findOneBy({ ownerUserId, id });
  }

  findByIds(ids: string[]) {
    return this.automations.find({ where: { id: In(ids) } });
  }
}
