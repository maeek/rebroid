import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AndroidApplication } from '../android-application.entity';
import { AndroidApplicationStatus } from '../android-application-status';

@Injectable()
export class AndroidApplicationsRepository {
  constructor(
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
  ) {}

  async findExistingIds(ids: string[]) {
    if (!ids.length) {
      return new Set<string>();
    }

    const applications = await this.applications.find({
      select: { id: true },
      where: { id: In(ids) },
    });
    return new Set(applications.map((app) => app.id));
  }

  findRunningWithNetworkPolicy() {
    return this.applications.find({
      where: {
        status: AndroidApplicationStatus.Running,
        networkPolicyEnabled: true,
      },
    });
  }
}
