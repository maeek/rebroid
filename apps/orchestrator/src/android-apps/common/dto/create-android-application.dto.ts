import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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
  IsIpv4Cidr,
  toStringArray,
} from '../../../network-policy/network-policy-validation';

export class CreateAndroidApplicationDto {
  @ApiProperty({ example: 'Signal Android' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    description: 'Frontend user id that owns the app. No auth is enforced yet.',
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

  @ApiPropertyOptional({ example: 2048, minimum: 128, maximum: 262144 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(128)
  @Max(262144)
  memoryLimitMb?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0.1, maximum: 128 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(128)
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

  @ApiPropertyOptional({
    default: true,
    description:
      'Whether app outbound traffic is restricted to API/default destinations plus the explicit allowlist.',
  })
  @IsOptional()
  @IsBoolean()
  networkPolicyEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Additional app-specific destination CIDRs the Android container may reach. Backend default destinations such as API_IP are applied automatically and are not stored here.',
    example: ['10.20.0.0/16', '203.0.113.10/32'],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @IsIpv4Cidr({ each: true })
  networkPolicyAllowCidrs?: string[];
}
