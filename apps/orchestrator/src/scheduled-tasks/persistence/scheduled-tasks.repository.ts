import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ScheduledTask } from '../entities/scheduled-task.entity';

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
