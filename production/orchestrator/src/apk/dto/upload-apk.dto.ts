import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadApkDto {
  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  ownerUserId?: string;
}
