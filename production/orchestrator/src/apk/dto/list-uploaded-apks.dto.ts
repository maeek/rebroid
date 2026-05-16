import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListUploadedApksDto {
  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  ownerUserId?: string;
}
