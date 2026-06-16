import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AdbClipboardDto {
  @ApiPropertyOptional({ example: "Text copied from the host." })
  text?: string;
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

export class AdbUiDumpDiagnosticsDto {
  @ApiProperty({ example: "uiautomator dump /data/local/tmp/window.xml" })
  command!: string;

  @ApiProperty({ example: false })
  compressed!: boolean;

  @ApiProperty({ example: 138 })
  durationMs!: number;

  @ApiProperty({ type: Number, nullable: true, example: 0 })
  exitCode!: number | null;

  @ApiProperty({
    example: "UI hierarchy dumped to: /data/local/tmp/window.xml",
  })
  stdout!: string;

  @ApiProperty({ example: "" })
  stderr!: string;

  @ApiProperty({ example: 12543 })
  xmlBytes!: number;

  @ApiProperty({ example: 42 })
  rawNodeCount!: number;
}

export class AdbUiDumpDto {
  @ApiProperty({ enum: ["available", "failed"], example: "available" })
  status!: "available" | "failed";

  @ApiPropertyOptional({
    example: "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
  })
  xml?: string;

  @ApiPropertyOptional({ example: "UI hierarchy dump failed." })
  error?: string;

  @ApiPropertyOptional({ type: AdbUiDumpDiagnosticsDto })
  diagnostics?: AdbUiDumpDiagnosticsDto;

  @ApiPropertyOptional({ type: AdbUiDumpDiagnosticsDto, isArray: true })
  attempts?: AdbUiDumpDiagnosticsDto[];

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
