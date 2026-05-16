import { ApiProperty } from '@nestjs/swagger';

export class CleanupUploadedApksResponseDto {
  @ApiProperty({ example: 3 })
  deletedRecords!: number;

  @ApiProperty({ example: 2 })
  removedFiles!: number;
}
