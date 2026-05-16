import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateAndroidApplicationApkDto {
  @ApiProperty({ example: '98a530d6-a45d-466a-9cb4-c023067c4971' })
  @IsUUID()
  uploadedApkId!: string;
}
