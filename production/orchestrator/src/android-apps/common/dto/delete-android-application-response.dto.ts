import { ApiProperty } from '@nestjs/swagger';

export class DeleteAndroidApplicationResponseDto {
  @ApiProperty({ example: '98a530d6-a45d-466a-9cb4-c023067c4971' })
  id!: string;

  @ApiProperty({ example: true })
  deleted!: boolean;

  @ApiProperty({ example: true })
  cleanupQueued!: boolean;

  @ApiProperty({ example: true })
  removedData!: boolean;
}
