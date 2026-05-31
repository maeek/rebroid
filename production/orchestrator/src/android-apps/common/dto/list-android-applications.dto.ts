import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ListAndroidApplicationsDto {
  @ApiPropertyOptional({ example: 'user_123' })
  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @ApiPropertyOptional({
    description:
      'Set false for a fast stored-state response without Docker reconciliation.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  reconcile?: boolean;
}
