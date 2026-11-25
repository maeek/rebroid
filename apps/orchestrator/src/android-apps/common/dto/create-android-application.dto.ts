import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import {
  managedAndroidDeviceKind,
  type ManagedAndroidDeviceKind,
} from '@rebroid/android-application-core/android-device';
import {
  InactivityTimeout,
  MemoryLimit,
  CpuLimit,
  ContainerArgs,
} from './application-runtime-properties';
import {
  OptionalNetworkPolicyAllowCidrs,
  OptionalNetworkPolicyEnabled,
} from '../../../network-policy/network-policy-validation';

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

  @InactivityTimeout({ default: 900 })
  inactivityTimeoutSeconds?: number;

  @MemoryLimit()
  memoryLimitMb?: number;

  @CpuLimit()
  cpuLimitCpus?: number;

  @ContainerArgs()
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

export class CreateManagedAndroidDeviceDto extends CreateAndroidApplicationDto {
  @ApiProperty({ enum: [managedAndroidDeviceKind] })
  @Equals(managedAndroidDeviceKind)
  kind!: ManagedAndroidDeviceKind;
}
