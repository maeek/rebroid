import { ApiProperty } from '@nestjs/swagger';

export class ApplicationScreenshotDto {
  @ApiProperty({ example: 'image/png' })
  mimeType!: string;

  @ApiProperty({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
  })
  dataUrl!: string;

  @ApiProperty({ example: '2026-05-19T10:15:30.000Z' })
  capturedAt!: string;
}
