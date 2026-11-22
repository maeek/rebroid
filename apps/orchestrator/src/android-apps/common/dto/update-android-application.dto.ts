import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import {
  InactivityTimeout,
  MemoryLimit,
  CpuLimit,
  ContainerArgs,
} from './application-runtime-properties';

export class UpdateAndroidApplicationDto {
  @ApiPropertyOptional({ example: 'Signal Android' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @InactivityTimeout()
  inactivityTimeoutSeconds?: number;

  @MemoryLimit({ nullable: true })
  memoryLimitMb?: number | null;

  @CpuLimit({ nullable: true })
  cpuLimitCpus?: number | null;

  @ContainerArgs({ nullable: true })
  containerArgs?: string | null;
}
