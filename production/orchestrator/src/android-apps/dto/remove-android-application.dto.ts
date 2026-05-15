import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class RemoveAndroidApplicationDto {
  @ApiPropertyOptional({
    default: true,
    description: 'When true, remove the persisted redroid Docker volume too.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  removeData?: boolean = true;
}
