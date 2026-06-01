import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScrcpyTransport } from '../../android-application-status';

export class ScrcpyViewerErrorDto {
  @ApiProperty({
    enum: ['sidecar_unavailable', 'adb_missing', 'adb_unreachable', 'unknown'],
  })
  code!: 'sidecar_unavailable' | 'adb_missing' | 'adb_unreachable' | 'unknown';

  @ApiProperty()
  message!: string;

  @ApiProperty()
  retryable!: boolean;

  @ApiProperty({ type: Number, nullable: true })
  exitCode!: number | null;

  @ApiProperty({ type: [String], nullable: true })
  command!: string[] | null;

  @ApiProperty({ type: String, nullable: true })
  stdout!: string | null;

  @ApiProperty({ type: String, nullable: true })
  stderr!: string | null;
}

export class DisplaySessionDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  appId?: string;

  @ApiProperty({ enum: ['created', 'active', 'released', 'expired'] })
  status!: 'created' | 'active' | 'released' | 'expired';

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  lastActivityAt!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty()
  maxExpiresAt!: string;

  @ApiProperty({ type: [String] })
  capabilities!: string[];

  @ApiProperty()
  streamPath!: string;

  @ApiProperty()
  viewerPath!: string;

  @ApiProperty()
  webrtcOfferPath!: string;
}

export class ScrcpySessionDto {
  @ApiProperty()
  applicationId!: string;

  @ApiProperty({ enum: ScrcpyTransport })
  transport!: ScrcpyTransport;

  @ApiProperty()
  udid!: string;

  @ApiProperty()
  proxyRemote!: string;

  @ApiProperty()
  player!: string;

  @ApiProperty()
  viewerServiceConfigured!: boolean;

  @ApiProperty()
  viewerTargetConnected!: boolean;

  @ApiProperty({ type: String, nullable: true })
  viewerMessage!: string | null;

  @ApiProperty({ type: ScrcpyViewerErrorDto, nullable: true })
  viewerError!: ScrcpyViewerErrorDto | null;

  @ApiProperty()
  adbHost!: string;

  @ApiProperty()
  adbPort!: number;

  @ApiProperty({ type: DisplaySessionDto, nullable: true })
  displaySession!: DisplaySessionDto | null;
}
