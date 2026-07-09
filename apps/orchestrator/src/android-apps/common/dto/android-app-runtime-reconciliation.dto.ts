import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { AndroidAppRuntimeReconciliationResult } from '../services/android-apps-runtime-state-reconciler.service';
import { AndroidApplicationResponseDto } from './android-application-response.dto';

export class ReconcileAndroidApplicationsDto {
  @ApiPropertyOptional({ example: 'user_123' })
  @IsOptional()
  @IsString()
  ownerUserId?: string;
}

export class AndroidAppRuntimeReconciliationDto {
  @ApiProperty({ type: () => AndroidApplicationResponseDto })
  application!: AndroidApplicationResponseDto;

  @ApiProperty({ enum: ['updated', 'unchanged', 'unavailable'] })
  outcome!: 'updated' | 'unchanged' | 'unavailable';

  @ApiPropertyOptional()
  message?: string;

  static fromResult(
    result: AndroidAppRuntimeReconciliationResult,
  ): AndroidAppRuntimeReconciliationDto {
    return {
      application: AndroidApplicationResponseDto.fromEntity(result.application),
      outcome: result.outcome,
      ...(result.message ? { message: result.message } : {}),
    };
  }
}
