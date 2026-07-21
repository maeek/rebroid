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

export const RequiresFeature = (key: FeatureFlagKey) =>
  SetMetadata(requiredFeatureMetadata, key);

@Injectable()
export class FeatureFlagsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeatureFlagsService,
  ) {}

  canActivate(context: ExecutionContext) {
    const key = this.reflector.getAllAndOverride<FeatureFlagKey>(
      requiredFeatureMetadata,
      [context.getHandler(), context.getClass()],
    );
    if (key) this.features.assertEnabled(key);
    return true;
  }
}
