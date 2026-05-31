import { ApiProperty } from '@nestjs/swagger';

export class ApplicationRuntimeFileDto {
  @ApiProperty({ example: 'report.pdf' })
  name!: string;

  @ApiProperty({ example: '/sdcard/Download/report.pdf' })
  path!: string;

  @ApiProperty({ enum: ['file', 'directory'], example: 'file' })
  type!: 'file' | 'directory';

  @ApiProperty({ example: 1572864, nullable: true })
  sizeBytes!: number | null;

  @ApiProperty({ example: 12, nullable: true })
  itemCount!: number | null;

  @ApiProperty({ example: '2026-05-19T10:15:30.000Z', nullable: true })
  modifiedAt!: string | null;
}

export class ApplicationRuntimeFileUploadDto extends ApplicationRuntimeFileDto {
  @ApiProperty({ example: true })
  uploaded!: boolean;
}

export class ApplicationRuntimeFileDownloadDto {
  @ApiProperty({ example: 'report.pdf' })
  name!: string;

  @ApiProperty({ example: 'application/octet-stream' })
  mimeType!: string;

  @ApiProperty({
    example: 'data:application/octet-stream;base64,SGVsbG8=',
  })
  dataUrl!: string;
}
