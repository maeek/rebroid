import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApkBlockRule,
  type ApkBlockScope,
} from '../entities/apk-block-rule.entity';

@Injectable()
export class ApkBlockRulesRepository {
  constructor(
    @InjectRepository(ApkBlockRule)
    private readonly rules: Repository<ApkBlockRule>,
  ) {}

  list() {
    return this.rules.find({ order: { scope: 'DESC', value: 'ASC' } });
  }

  exists(scope: ApkBlockScope, value: string) {
    return this.rules.existsBy({ scope, value });
  }

  hasPackageRules() {
    return this.rules.existsBy({ scope: 'package' });
  }

  add(rule: ApkBlockRule) {
    return this.rules.insert(rule);
  }

  async remove(scope: ApkBlockScope, value: string) {
    return Boolean((await this.rules.delete({ scope, value })).affected);
  }
}
