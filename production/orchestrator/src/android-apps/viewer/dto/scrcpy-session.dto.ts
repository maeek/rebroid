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

  @ApiPropertyOptional({ nullable: true })
  exitCode!: number | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  command!: string[] | null;

  @ApiPropertyOptional({ nullable: true })
  stdout!: string | null;

  @ApiPropertyOptional({ nullable: true })
  stderr!: string | null;
}

export class DisplaySessionDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  appId?: string;

  @ApiProperty()
  udid!: string;

  @ApiPropertyOptional({ nullable: true })
  ownerUserId?: string;

  @ApiProperty({ enum: ['created', 'active', 'released', 'expired'] })
  status!: 'created' | 'active' | 'released' | 'expired';

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  lastActivityAt!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty({ type: [String] })
  capabilities!: string[];

  @ApiProperty()
  streamPath!: string;

  @ApiProperty()
  viewerPath!: string;
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

  @ApiProperty({ nullable: true })
  viewerMessage!: string | null;

  @ApiPropertyOptional({ type: ScrcpyViewerErrorDto, nullable: true })
  viewerError!: ScrcpyViewerErrorDto | null;

  @ApiProperty()
  adbHost!: string;

  @ApiProperty()
  adbPort!: number;

  @ApiPropertyOptional({ type: DisplaySessionDto, nullable: true })
  displaySession!: DisplaySessionDto | null;
}
