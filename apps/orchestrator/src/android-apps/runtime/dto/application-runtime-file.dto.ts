import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ApplicationRuntimeFileDto {
  @ApiProperty({ example: 'report.pdf' })
  name!: string;

  @ApiProperty({ example: '/sdcard/Download/report.pdf' })
  path!: string;

  @ApiProperty({ enum: ['file', 'directory'], example: 'file' })
  type!: 'file' | 'directory';

  @ApiProperty({ type: Number, example: 1572864, nullable: true })
  sizeBytes!: number | null;

  @ApiProperty({ type: Number, example: 12, nullable: true })
  itemCount!: number | null;

  @ApiProperty({
    type: String,
    example: '2026-05-19T10:15:30.000Z',
    nullable: true,
  })
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

export class CreateApplicationRuntimeDirectoryDto {
  @ApiProperty({ example: '/data/media/0/Documents' })
  @IsString()
  @MaxLength(4096)
  parentPath!: string;

  @ApiProperty({ example: 'Reports' })
  @IsString()
  @MaxLength(255)
  name!: string;
}

export class RenameApplicationRuntimeFileDto {
  @ApiProperty({ example: '/data/media/0/Documents/report-draft.pdf' })
  @IsString()
  @MaxLength(4096)
  path!: string;

  @ApiProperty({ example: 'report.pdf' })
  @IsString()
  @MaxLength(255)
  name!: string;
}

export class DeleteApplicationRuntimeFileDto {
  @ApiProperty({ example: true })
  deleted!: boolean;

  @ApiProperty({ example: '/data/media/0/Documents/report.pdf' })
  path!: string;

  @ApiProperty({ enum: ['file', 'directory'], example: 'file' })
  type!: 'file' | 'directory';
}
