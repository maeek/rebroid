import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FeatureFlagKey } from './feature-flag.registry';
import { FeatureFlagsService } from './feature-flags.service';

const requiredFeatureMetadata = Symbol('required-feature');

export const RequiresFeature = (...keys: FeatureFlagKey[]) =>
  SetMetadata(requiredFeatureMetadata, keys);

@Injectable()
export class FeatureFlagsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeatureFlagsService,
  ) {}

  canActivate(context: ExecutionContext) {
    const keys = this.reflector.getAllAndOverride<FeatureFlagKey[]>(
      requiredFeatureMetadata,
      [context.getHandler(), context.getClass()],
    );
    for (const key of keys ?? []) this.features.assertEnabled(key);
    return true;
  }
}
