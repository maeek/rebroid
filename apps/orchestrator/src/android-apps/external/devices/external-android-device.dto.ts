import {
  externalAdbTcpCheckStatuses,
  type ExternalAdbTcpCheckStatus,
  externalDeviceFailures,
  externalDeviceStates,
  externalDeviceTransports,
  externalDeviceVerificationProofs,
  type ExternalDeviceConnection,
  type ExternalDeviceFailure,
  type ExternalDeviceState,
  type ExternalDeviceTransport,
  type ExternalDeviceVerificationProof,
} from '@rebroid/android-application-core/android-device';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ExternalAndroidDevice } from './external-android-device.entity';

export class ExternalTcpEndpointDto {
  @ApiProperty({ maxLength: 21 })
  endpoint!: string;
}

export class ExternalDeviceTcpCheckDto {
  @ApiProperty({ enum: externalAdbTcpCheckStatuses })
  status!: ExternalAdbTcpCheckStatus;
}

class ExternalDeviceConnectionDto implements ExternalDeviceConnection {
  @ApiProperty({ enum: externalDeviceStates })
  state!: ExternalDeviceState;
  @ApiProperty({ enum: externalDeviceFailures, nullable: true })
  failure!: ExternalDeviceFailure | null;
  @ApiProperty({ type: String, nullable: true })
  attemptId!: string | null;
  @ApiProperty({ type: String, nullable: true })
  attachmentId!: string | null;
  @ApiProperty({ type: String, nullable: true })
  observedAt!: string | null;
}

export class ExternalAndroidDeviceDto {
  @ApiProperty({ enum: ['external'] })
  kind!: 'external';
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  ownerUserId!: string;
  @ApiProperty({ enum: externalDeviceTransports })
  transport!: ExternalDeviceTransport;
  @ApiProperty({ type: ExternalDeviceConnectionDto })
  connection!: ExternalDeviceConnection;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static fromEntity(device: ExternalAndroidDevice): ExternalAndroidDeviceDto {
    return {
      kind: 'external',
      id: device.id,
      name: device.name,
      ownerUserId: device.ownerUserId,
      transport: device.transport,
      connection: device.connection,
      createdAt: device.createdAt.toISOString(),
    };
  }
}

export class RegisterExternalAndroidDeviceDto {
  @ApiProperty()
  name!: string;
  @ApiProperty({ enum: externalDeviceTransports })
  transport!: ExternalDeviceTransport;
  @ApiPropertyOptional({
    description: 'Allowlisted IPv4 address and port for TCP.',
  })
  endpoint?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Current USB discovery candidate.',
  })
  candidateId?: string;
}

export class VerifyExternalAndroidDeviceDto {
  @ApiProperty({ format: 'uuid' })
  attemptId!: string;
  @ApiProperty({ enum: externalDeviceVerificationProofs })
  proof!: ExternalDeviceVerificationProof;
}

export const externalDeviceAvailabilityStates = [
  'not_configured',
  'feature_disabled',
  'broker_unavailable',
  'available',
] as const;

export class ExternalDeviceAvailabilityDto {
  @ApiProperty()
  enabled!: boolean;
  @ApiProperty({ enum: externalDeviceAvailabilityStates })
  status!: (typeof externalDeviceAvailabilityStates)[number];
}

export class ExternalDeviceCandidateDto {
  @ApiProperty({ format: 'uuid' })
  candidateId!: string;
  @ApiProperty()
  label!: string;
  @ApiProperty()
  state!: string;
}

export class ExternalDeviceVerificationInstructionsDto {
  @ApiProperty()
  androidPromptObserved!: boolean;
  @ApiProperty({ type: String, nullable: true })
  challenge!: string | null;
  @ApiProperty({ type: String, nullable: true })
  fingerprint!: string | null;
}

export class ForgottenExternalDeviceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
}
