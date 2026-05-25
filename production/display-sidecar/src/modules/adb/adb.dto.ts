import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { viewerCommands } from '../display/display.dto';

export class AdbControlDto {
  @ApiPropertyOptional({ enum: viewerCommands, example: 'home' })
  command?: string;
}

export class AdbClipboardDto {
  @ApiPropertyOptional({ example: 'Text copied from the host.' })
  text?: string;
}

export class AdbControlResultDto {
  @ApiPropertyOptional({ enum: viewerCommands, example: 'home', nullable: true })
  command?: string | null;

  @ApiProperty({ example: true })
  executed!: boolean;

  @ApiPropertyOptional({ example: 'Unsupported ADB control command: missing' })
  message?: string;

  @ApiPropertyOptional({ example: '' })
  stdout?: string;

  @ApiPropertyOptional({ example: '' })
  stderr?: string;
}

export class AdbClipboardResultDto {
  @ApiProperty({ example: 'Clipboard text' })
  text!: string;

  @ApiProperty({ example: true })
  supported!: boolean;
}

export class AdbLogcatDto {
  @ApiProperty({ example: 'adb' })
  source!: 'adb';

  @ApiProperty({ example: '2026-05-25T20:30:00.000Z' })
  collectedAt!: string;

  @ApiProperty({ example: '05-25 20:30:00.000 ...' })
  output!: string;
}

export class AdbNotificationsDto {
  @ApiProperty({ example: 'Notification dump output' })
  output!: string;
}

export class AdbScreenshotDto {
  @ApiProperty({ example: 'image/png' })
  mimeType!: 'image/png';

  @ApiProperty({ example: 'data:image/png;base64,iVBORw0KGgo...' })
  dataUrl!: string;

  @ApiProperty({ example: '2026-05-25T20:30:00.000Z' })
  capturedAt!: string;
}
