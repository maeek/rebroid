import { Module } from '@nestjs/common';
import { SharedSecretGuard } from './shared-secret.guard';

@Module({
  providers: [SharedSecretGuard],
  exports: [SharedSecretGuard],
})
export class SecurityModule {}
