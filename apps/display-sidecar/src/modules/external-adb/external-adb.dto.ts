import { ApiProperty } from "@nestjs/swagger";
import {
  externalAdbTcpCheckStatuses,
  type ExternalAdbTcpCheckStatus,
  externalDeviceFailures,
  externalDeviceStates,
  type ExternalDeviceConnection,
  type ExternalDeviceFailure,
  type ExternalDeviceState,
} from "@rebroid/android-application-core/android-device";

export class ExternalAdbTcpCheckDto {
  @ApiProperty({ enum: externalAdbTcpCheckStatuses })
  status!: ExternalAdbTcpCheckStatus;
}

export class ExternalAdbConnectionDto implements ExternalDeviceConnection {
  @ApiProperty({ enum: externalDeviceStates })
  state!: ExternalDeviceState;
  @ApiProperty({ enum: externalDeviceFailures, nullable: true })
  failure!: ExternalDeviceFailure | null;
  @ApiProperty({ type: String, nullable: true })
  attemptId!: string | null;
  @ApiProperty({ type: String, nullable: true })
  attachmentId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  observedAt!: string | null;
}

export class ExternalAdbCandidateDto {
  @ApiProperty({ format: "uuid" })
  candidateId!: string;
  @ApiProperty()
  label!: string;
  @ApiProperty()
  state!: string;
}

export class ExternalAdbSelectorDto {
  @ApiProperty()
  selector!: string;
}

export class ExternalAdbInstructionsDto {
  @ApiProperty()
  androidPromptObserved!: boolean;
  @ApiProperty({ type: String, nullable: true })
  challenge!: string | null;
  @ApiProperty({ type: String, nullable: true })
  fingerprint!: string | null;
}

export class ExternalAdbDetachedDto {
  @ApiProperty()
  detached!: boolean;
}
