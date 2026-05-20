import { ApiProperty } from '@nestjs/swagger';

export class ApplicationLogDto {
  @ApiProperty({ example: 'orchestrator' })
  source!: 'orchestrator' | 'container' | 'adb';

  @ApiProperty({ example: '2026-05-16T18:20:00.000Z' })
  collectedAt!: string;

  @ApiProperty({ example: 'container log output...' })
  output!: string;
}
