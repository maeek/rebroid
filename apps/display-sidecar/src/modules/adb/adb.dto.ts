import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { viewerCommands } from "../display/display.dto";

export class AdbControlDto {
  @ApiPropertyOptional({ enum: viewerCommands, example: "home" })
  command?: string;
}

export class AdbClipboardDto {
  @ApiPropertyOptional({ example: "Text copied from the host." })
  text?: string;
}

export class AdbControlResultDto {
  @ApiPropertyOptional({
    enum: viewerCommands,
    example: "home",
    nullable: true,
  })
  command?: string | null;

  @ApiProperty({ example: true })
  executed!: boolean;

  @ApiPropertyOptional({ example: "Unsupported ADB control command: missing" })
  message?: string;

  @ApiPropertyOptional({ example: "" })
  stdout?: string;

  @ApiPropertyOptional({ example: "" })
  stderr?: string;
}

export class AdbClipboardResultDto {
  @ApiProperty({ example: "Clipboard text" })
  text!: string;

  @ApiProperty({ example: true })
  supported!: boolean;
}

export class AdbLogcatDto {
  @ApiProperty({ example: "adb" })
  source!: "adb";

  @ApiProperty({ example: "2026-05-25T20:30:00.000Z" })
  collectedAt!: string;

  @ApiProperty({ example: "05-25 20:30:00.000 ..." })
  output!: string;
}

export class AdbNotificationsDto {
  @ApiProperty({ example: "Notification dump output" })
  output!: string;
}

export class AdbScreenshotDto {
  @ApiProperty({ example: "image/png" })
  mimeType!: "image/png";

  @ApiProperty({ example: "data:image/png;base64,iVBORw0KGgo..." })
  dataUrl!: string;

  @ApiProperty({ example: "2026-05-25T20:30:00.000Z" })
  capturedAt!: string;
}

export class AdbTapDto {
  @ApiProperty({ example: 120 })
  x!: number;

  @ApiProperty({ example: 640 })
  y!: number;
}

export class AdbSwipeDto {
  @ApiProperty({ example: 120 })
  x1!: number;

  @ApiProperty({ example: 900 })
  y1!: number;

  @ApiProperty({ example: 120 })
  x2!: number;

  @ApiProperty({ example: 200 })
  y2!: number;

  @ApiPropertyOptional({ example: 300 })
  durationMs?: number;
}

export class AdbInputTextDto {
  @ApiProperty({ example: "example text" })
  text!: string;
}

export class AdbKeyDto {
  @ApiProperty({ example: "ENTER" })
  key!: string;
}

export class AdbRotateDisplayDto {
  @ApiProperty({
    enum: ["portrait", "landscape", "reverse-portrait", "reverse-landscape"],
    example: "landscape",
  })
  orientation!:
    | "portrait"
    | "landscape"
    | "reverse-portrait"
    | "reverse-landscape";
}

export class AdbShellDto {
  @ApiProperty({ example: "pm list packages" })
  command!: string;

  @ApiPropertyOptional({ example: 15000 })
  timeoutMs?: number;
}

export class AdbShellResultDto {
  @ApiProperty({ example: "" })
  stdout!: string;

  @ApiProperty({ example: "" })
  stderr!: string;

  @ApiProperty({ example: 0 })
  exitCode!: number;
}

export class AdbUiDumpDto {
  @ApiProperty({
    example: "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
  })
  xml!: string;

  @ApiProperty({ example: "2026-05-25T20:30:00.000Z" })
  dumpedAt!: string;
}

export class AdbTapTextDto {
  @ApiProperty({ example: "Install" })
  text!: string;
}

export class AdbTapTextResultDto {
  @ApiProperty({ example: true })
  found!: boolean;

  @ApiProperty({ type: Number, nullable: true })
  x!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  y!: number | null;
}

export class AdbFileDto {
  @ApiProperty({ example: "/sdcard/Download/example.txt" })
  path!: string;
}

export class AdbPushFileDto extends AdbFileDto {
  @ApiProperty({ example: "SGVsbG8=" })
  contentBase64!: string;
}

export class AdbPullFileResultDto extends AdbFileDto {
  @ApiProperty({ example: "SGVsbG8=" })
  contentBase64!: string;

  @ApiProperty({ example: 5 })
  sizeBytes!: number;
}

export class AdbFileExistsResultDto {
  @ApiProperty({ example: true })
  exists!: boolean;
}

export class AdbListFilesResultDto {
  @ApiProperty({ type: String, isArray: true })
  files!: string[];
}
