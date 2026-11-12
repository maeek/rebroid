import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ListAndroidApplicationsDto } from './list-android-applications.dto';

export class ListAndroidApplicationSummariesDto extends ListAndroidApplicationsDto {
  @ApiPropertyOptional({ type: [String], maxItems: 5 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? [value] : value,
  )
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(128, { each: true })
  applicationIds?: string[];

  @ApiPropertyOptional({
    enum: ['true'],
    description: 'Include running applications alongside any requested IDs.',
  })
  @IsOptional()
  @IsIn(['true'])
  includeRunning?: 'true';
}
