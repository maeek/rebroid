import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class PruneImagesDto {
  @ApiPropertyOptional({
    default: true,
    description: 'When false, prune all unused images instead of only dangling images.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  danglingOnly?: boolean = true;
}
