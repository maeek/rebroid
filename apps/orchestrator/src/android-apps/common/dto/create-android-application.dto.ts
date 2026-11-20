import { androidApplicationResourceLimits } from '@rebroid/android-application-core/redroid-runtime';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  OptionalNetworkPolicyAllowCidrs,
  OptionalNetworkPolicyEnabled,
} from '../../../network-policy/network-policy-validation';

const { memoryLimitMb, cpuLimitCpus } = androidApplicationResourceLimits;

export class CreateAndroidApplicationDto {
  @ApiProperty({ example: 'Signal Android' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    description: 'Owner user ID supplied by the trusted web service.',
    example: 'user_123',
  })
  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @ApiPropertyOptional({ example: 'redroid/redroid:14.0.0-latest' })
  @IsOptional()
  @IsString()
  containerImage?: string;

  @ApiPropertyOptional({
    default: 900,
    minimum: -1,
    maximum: 86400,
    description: 'Use -1 to keep the session running until manually stopped.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  @Max(86400)
  inactivityTimeoutSeconds?: number;

  @ApiPropertyOptional({
    example: 2048,
    minimum: memoryLimitMb.min,
    maximum: memoryLimitMb.max,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(memoryLimitMb.min)
  @Max(memoryLimitMb.max)
  memoryLimitMb?: number;

  @ApiPropertyOptional({
    example: 2,
    minimum: cpuLimitCpus.min,
    maximum: cpuLimitCpus.max,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(cpuLimitCpus.min)
  @Max(cpuLimitCpus.max)
  cpuLimitCpus?: number;

  @ApiPropertyOptional({
    description:
      'Optional command or arguments passed to the container as Docker Cmd. Use a long-running command if the image would otherwise exit immediately.',
    example: 'sleep infinity',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  containerArgs?: string;

  @ApiPropertyOptional({
    description:
      'Previously uploaded APK id to install into this Android application.',
    example: '98a530d6-a45d-466a-9cb4-c023067c4971',
  })
  @IsOptional()
  @IsUUID()
  uploadedApkId?: string;

  @OptionalNetworkPolicyEnabled({
    default: true,
    description:
      'Whether app outbound traffic is restricted to API/default destinations plus the explicit allowlist.',
  })
  networkPolicyEnabled?: boolean;

  @OptionalNetworkPolicyAllowCidrs()
  networkPolicyAllowCidrs?: string[];
}
