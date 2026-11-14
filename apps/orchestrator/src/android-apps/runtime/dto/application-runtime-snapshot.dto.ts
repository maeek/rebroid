import { ApiProperty } from '@nestjs/swagger';

export class ApplicationRuntimeSnapshotDto {
  @ApiProperty({ enum: ['image/webp'] })
  mimeType!: 'image/webp';

  @ApiProperty({ example: 'data:image/webp;base64,UklGRg==' })
  dataUrl!: string;

  @ApiProperty({ format: 'date-time' })
  capturedAt!: string;
}
