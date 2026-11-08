import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import type { DockerOperationLimits } from '../../contracts/docker-operation-limits';

export class DockerOperationLimitsDto implements DockerOperationLimits {
  @ApiProperty({ minimum: 1, maximum: 64 })
  @IsInt()
  @Min(1)
  @Max(64)
  maxConcurrentReads!: number;

  @ApiProperty({ minimum: 1, maximum: 16 })
  @IsInt()
  @Min(1)
  @Max(16)
  maxConcurrentLongOperations!: number;

  @ApiProperty({ minimum: 100, maximum: 300_000 })
  @IsInt()
  @Min(100)
  @Max(300_000)
  slowRequestWarningMs!: number;

  @ApiProperty({ minimum: 1_000, maximum: 3_600_000 })
  @IsInt()
  @Min(1_000)
  @Max(3_600_000)
  longOperationTimeoutMs!: number;
}
