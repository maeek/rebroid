import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SharedSecretGuard } from './shared-secret.guard';

@Module({
  providers: [
    SharedSecretGuard,
    {
      provide: APP_GUARD,
      useExisting: SharedSecretGuard,
    },
  ],
  exports: [SharedSecretGuard],
})
export class SecurityModule {}
