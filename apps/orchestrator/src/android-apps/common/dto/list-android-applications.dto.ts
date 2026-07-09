import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListAndroidApplicationsDto {
  @ApiPropertyOptional({ example: 'user_123' })
  @IsOptional()
  @IsString()
  ownerUserId?: string;
}
